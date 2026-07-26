import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enforceRateLimit,
  resetRateLimitsForTesting,
} from '../lib/rate-limit.js';

test.beforeEach(resetRateLimitsForTesting);

test('limits repeated requests and exposes a retry delay', () => {
  const request = { headers: { 'x-forwarded-for': '203.0.113.10' } };
  enforceRateLimit(request, 'test', { limit: 2, windowMs: 60_000 }, 1_000);
  enforceRateLimit(request, 'test', { limit: 2, windowMs: 60_000 }, 1_001);

  assert.throws(
    () =>
      enforceRateLimit(
        request,
        'test',
        { limit: 2, windowMs: 60_000 },
        1_002,
      ),
    (error) => error.statusCode === 429 && error.retryAfter === 60,
  );
});

test('separates clients and resets expired windows', () => {
  const first = { headers: { 'x-real-ip': '203.0.113.11' } };
  const second = { headers: { 'x-real-ip': '203.0.113.12' } };
  enforceRateLimit(first, 'test', { limit: 1, windowMs: 10 }, 1_000);
  enforceRateLimit(second, 'test', { limit: 1, windowMs: 10 }, 1_001);
  enforceRateLimit(first, 'test', { limit: 1, windowMs: 10 }, 1_011);
});
