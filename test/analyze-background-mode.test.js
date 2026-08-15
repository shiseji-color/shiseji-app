import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enforceInteractiveAnalysisRateLimit,
  resetRateLimitsForTesting,
} from '../lib/rate-limit.js';

test('trusted background invocations do not share the browser rate-limit bucket', () => {
  resetRateLimitsForTesting();
  for (let index = 0; index < 7; index += 1) {
    assert.doesNotThrow(() => enforceInteractiveAnalysisRateLimit({
      headers: {}, backgroundMode: true,
    }));
  }
});

test('browser-facing analysis still enforces its existing rate limit', () => {
  resetRateLimitsForTesting();
  for (let index = 0; index < 5; index += 1) {
    assert.doesNotThrow(() => enforceInteractiveAnalysisRateLimit({ headers: {} }));
  }
  assert.throws(
    () => enforceInteractiveAnalysisRateLimit({ headers: {} }),
    (error) => error.statusCode === 429 && error.retryAfter >= 1,
  );
});
