import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVATION_CODE_USES,
  generateActivationBatch,
  generateActivationCode,
  hashGeneratedActivationCode,
} from '../lib/activation-code-generator.js';
import { isActivationCodeFormatValid } from '../lib/activation-store.js';

test('generates codes accepted by the activation API', () => {
  for (let index = 0; index < 100; index += 1) {
    assert.equal(isActivationCodeFormatValid(generateActivationCode()), true);
  }
});

test('generates a unique batch with six uses per code', () => {
  const batch = generateActivationBatch(1_000);
  assert.equal(batch.length, 1_000);
  assert.equal(new Set(batch.map((record) => record.code)).size, 1_000);
  assert.equal(new Set(batch.map((record) => record.codeHash)).size, 1_000);
  assert.ok(batch.every((record) => record.totalUses === ACTIVATION_CODE_USES));
  assert.equal(ACTIVATION_CODE_USES, 6);
});

test('hashes generated codes without retaining plaintext in database rows', () => {
  const code = 'ABCDEFGH2345';
  assert.match(hashGeneratedActivationCode(code), /^[0-9a-f]{64}$/);
});

test('rejects unsafe batch sizes', () => {
  assert.throws(() => generateActivationBatch(0), /between 1 and 100000/);
  assert.throws(() => generateActivationBatch(100_001), /between 1 and 100000/);
});
