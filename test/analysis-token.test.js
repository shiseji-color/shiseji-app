import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAnalysisToken,
  verifyAnalysisToken,
} from '../lib/analysis-token.js';

const originalSecret = process.env.AUTH_TOKEN_SECRET;
process.env.AUTH_TOKEN_SECRET = 'test-secret-with-at-least-thirty-two-characters';

test.after(() => {
  if (originalSecret === undefined) delete process.env.AUTH_TOKEN_SECRET;
  else process.env.AUTH_TOKEN_SECRET = originalSecret;
});

test('creates a short-lived signed token for a code hash', () => {
  const codeHash = 'a'.repeat(64);
  const token = createAnalysisToken(codeHash, 1_000_000);
  assert.equal(verifyAnalysisToken(token, 1_000_001), codeHash);
  assert.throws(() => verifyAnalysisToken(token, 1_700_001), /expired/);
});

test('rejects a modified token', () => {
  const token = createAnalysisToken('b'.repeat(64));
  assert.throws(
    () => verifyAnalysisToken(`${token.slice(0, -1)}x`),
    /signature/,
  );
});
