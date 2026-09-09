import test from 'node:test';
import assert from 'node:assert/strict';
import verify from '../api/verify-code.js';
import start from '../api/start-analysis.js';
import status from '../api/analysis-status.js';
import analyze from '../api/analyze.js';
import { createStyleImageHandler } from '../api/generate-style-image.js';

test('all five API handlers stop before reading business input on shared denial or outage', async () => {
  const settings = {
    SHARED_RATE_LIMIT_ENABLED: 'true', VERCEL: '1',
    SUPABASE_URL: 'https://limiter-test.invalid', SUPABASE_SECRET_KEY: 'sb_secret_test',
    RATE_LIMIT_IDENTITY_SECRET: 'test-only-identity-secret-not-real-12345678',
  };
  const previous = Object.fromEntries(Object.keys(settings).map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  Object.assign(process.env, settings);
  try {
    const handlers = { verify, start, status, analyze,
      style: createStyleImageHandler({ env: { STYLE_IMAGE_GENERATION_ENABLED: 'true' } }) };
    for (const [name, handler] of Object.entries(handlers)) {
      for (const mode of ['denied', 'network-failure', 'malformed', 'untrusted-ip']) {
        let calls = 0, businessReads = 0;
        globalThis.fetch = async (url, options) => {
          calls++;
          assert.equal(new URL(url).pathname, '/rest/v1/rpc/consume_request_rate_limit');
          assert.equal(options.method, 'POST');
          if (mode === 'network-failure') throw Error('sensitive upstream message');
          return { ok: true, json: async () => mode === 'malformed' ? [] : [{ allowed: false, retry_after: 11 }] };
        };
        const req = { method: 'POST', headers: mode === 'untrusted-ip' ? { 'cf-connecting-ip': '203.0.113.7' } : { 'x-forwarded-for': '203.0.113.7' },
          get body() { businessReads++; throw Error('Business input must not be read'); } };
        const output = { headers: {} };
        const res = { setHeader(k, v) { output.headers[k] = v; },
          status(code) { output.code = code; return res; }, json(body) { output.body = body; return res; } };
        await handler(req, res);
        assert.equal(output.code, mode === 'denied' ? 429 : 503, name + ': ' + mode);
        assert.equal(output.headers['Retry-After'], mode === 'denied' ? '11' : '3');
        assert.equal(output.headers['Cache-Control'], 'no-store');
        assert.equal(businessReads, 0);
        assert.equal(calls, mode === 'untrusted-ip' ? 0 : 1);
        assert.ok(!JSON.stringify(output.body).includes('sensitive'));
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
