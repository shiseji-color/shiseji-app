import test from 'node:test';
import assert from 'node:assert/strict';
import { trustedClientIdentity, enforceRequestRateLimit } from '../lib/request-rate-limit.js';
const policy = { limit: 2, windowMs: 60000 };
test('uses only platform-specific headers and rejects unknown or ambiguous sources', () => {
  const req = { headers: { 'x-forwarded-for': '203.0.113.2', 'cf-connecting-ip': '203.0.113.9', 'x-nf-client-connection-ip': '203.0.113.3' } };
  assert.equal(trustedClientIdentity(req, { VERCEL: '1' }), '203.0.113.2');
  assert.equal(trustedClientIdentity(req, { NETLIFY: 'true' }), '203.0.113.3');
  assert.throws(() => trustedClientIdentity(req, {}), e => e.statusCode === 503);
  assert.throws(() => trustedClientIdentity({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }, { VERCEL: '1' }));
  assert.equal(trustedClientIdentity({ headers: { 'x-forwarded-for': '2001:0db8::1' } }, { VERCEL: '1' }), '[2001:db8::1]');
});
test('disabled mode does not contact storage; enabled mode awaits and propagates denial', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => [{ allowed: false, retry_after: 9 }] }; };
  const req = { headers: { 'x-forwarded-for': '203.0.113.77' } };
  await enforceRequestRateLimit(req, 'integration-test', policy, { env: {}, fetchImpl });
  assert.equal(calls, 0);
  const env = { SHARED_RATE_LIMIT_ENABLED: 'true', VERCEL: '1', SUPABASE_URL: 'https://example.invalid', SUPABASE_SECRET_KEY: 'test', RATE_LIMIT_IDENTITY_SECRET: 'x'.repeat(32) };
  await assert.rejects(enforceRequestRateLimit(req, 'integration-test', policy, { env, fetchImpl }), e => e.statusCode === 429 && e.retryAfter === 9);
  assert.equal(calls, 1);
  await assert.rejects(enforceRequestRateLimit(req, 'integration-test', policy, { env: { ...env, RATE_LIMIT_IDENTITY_SECRET: '' }, fetchImpl }), e => e.statusCode === 503);
});
