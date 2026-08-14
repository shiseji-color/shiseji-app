import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAnalysisToken,
  createVisualToken,
  verifyAnalysisToken,
  verifyVisualToken,
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

test('binds visual generation authorization to its completed analysis request', () => {
  const codeHash = 'c'.repeat(64);
  const requestId = 'c9a6464f-65ef-4d3e-a9f7-d7e1b443d586';
  const analysis = { identity_code: 'SSJ-01', best_colors: [{ hex: '#AABBCC' }] };
  const token = createVisualToken(codeHash, requestId, analysis, 1_000_000);

  assert.deepEqual(
    verifyVisualToken(token, requestId, analysis, 1_000_001),
    { codeHash, requestId },
  );
  assert.throws(
    () => verifyVisualToken(token, '404ebf3e-9bb9-4188-b82d-b4c0c099c16b', analysis, 1_000_001),
    /INVALID_VISUAL_TOKEN/,
  );
  assert.throws(
    () => verifyVisualToken(token, requestId, { ...analysis, identity_code: 'SSJ-16' }, 1_000_001),
    /INVALID_VISUAL_TOKEN/,
  );
  assert.throws(
    () => verifyVisualToken(token, requestId, analysis, 2_800_001),
    /INVALID_VISUAL_TOKEN/,
  );
});
