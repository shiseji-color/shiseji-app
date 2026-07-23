import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashActivationCode,
  isActivationCodeFormatValid,
  normalizeActivationCode,
} from '../lib/activation-store.js';

test('normalizes activation codes without exposing plaintext storage', () => {
  assert.equal(normalizeActivationCode('  abcd-123-xyz '), 'ABCD-123-XYZ');
});

test('accepts only the expected 12-character code shape', () => {
  assert.equal(isActivationCodeFormatValid('ABCD-123-XYZ'), true);
  assert.equal(isActivationCodeFormatValid('VIP888'), false);
  assert.equal(isActivationCodeFormatValid('abcd-123-xyz'), false);
});

test('hashes activation codes with SHA-256', () => {
  assert.match(hashActivationCode('ABCD-123-XYZ'), /^[0-9a-f]{64}$/);
});
