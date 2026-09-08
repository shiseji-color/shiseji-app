import test from 'node:test';
import assert from 'node:assert/strict';
import { createSharedRateLimiter } from '../lib/shared-rate-limit.js';
const config = { url: 'https://example.invalid', key: 'sb_secret_test', identitySecret: 'x'.repeat(32) };
const policy = { clientIdentity: '203.0.113.8', namespace: 'verify-code', limit: 10, windowMs: 60000 };
test('diagnostics distinguish timeout, HTTP failure and malformed response without retaining payloads', async () => {
  for (const [fetchImpl, code] of [
    [async () => { throw new DOMException('private detail', 'TimeoutError'); }, 'rate_limit_timeout'],
    [async () => ({ ok: false, status: 503 }), 'rate_limit_http_503'],
    [async () => ({ ok: true, json: async () => [] }), 'rate_limit_invalid_response'],
  ]) {
    await assert.rejects(createSharedRateLimiter({ ...config, fetchImpl })(policy), e =>
      e.statusCode === 503 && e.diagnosticCode === code && !JSON.stringify(e).includes('private detail'));
  }
});
test('independent callers derive the same private bucket and policies stay separate', async () => {
  const bodies = [];
  const fetchImpl = async (_, options) => {
    assert.equal(options.headers.Authorization, undefined);
    assert.ok(options.signal);
    bodies.push(JSON.parse(options.body));
    return { ok: true, json: async () => [{ allowed: true, retry_after: 0 }] };
  };
  await createSharedRateLimiter({ ...config, fetchImpl })(policy);
  await createSharedRateLimiter({ ...config, fetchImpl })(policy);
  await createSharedRateLimiter({ ...config, fetchImpl })({ ...policy, limit: 5 });
  assert.equal(bodies[0].p_bucket_key, bodies[1].p_bucket_key);
  assert.notEqual(bodies[0].p_bucket_key, bodies[2].p_bucket_key);
  assert.ok(!JSON.stringify(bodies).includes(policy.clientIdentity));
});
test('denial returns 429 with retry delay', async () => {
  const enforce = createSharedRateLimiter({ ...config, fetchImpl: async () => ({ ok: true, json: async () => [{ allowed: false, retry_after: 45 }] }) });
  await assert.rejects(enforce(policy), e => e.statusCode === 429 && e.retryAfter === 45);
});

test('upstream 401 fails closed without retrying or exposing credentials', async () => {
  let calls = 0;
  const fetchImpl = async (_, options) => {
    calls++;
    assert.equal(options.headers.apikey, config.key);
    assert.equal(options.headers.Authorization, undefined);
    return { ok: false, status: 401, json: async () => { throw Error('Response body must not be consumed'); } };
  };
  await assert.rejects(createSharedRateLimiter({ ...config, fetchImpl })(policy), error => {
    assert.equal(error.statusCode, 503);
    assert.equal(error.diagnosticCode, 'rate_limit_http_401');
    assert.equal(error.retryAfter, 3);
    assert.equal(error.cause, undefined);
    assert.ok(!JSON.stringify(error).includes(config.key));
    return true;
  });
  assert.equal(calls, 1);
});
test('network failure and malformed results fail closed with 503', async () => {
  for (const fetchImpl of [async () => { throw Error('secret diagnostic'); }, async () => ({ ok: true, json: async () => [] })]) {
    await assert.rejects(createSharedRateLimiter({ ...config, fetchImpl })(policy), e => e.statusCode === 503 && !e.message.includes('secret'));
  }
});
