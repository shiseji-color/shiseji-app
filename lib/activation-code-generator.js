import { createHash, randomInt } from 'node:crypto';

export const ACTIVATION_CODE_LENGTH = 12;
export const ACTIVATION_CODE_USES = 6;
export const ACTIVATION_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateActivationCode() {
  return Array.from(
    { length: ACTIVATION_CODE_LENGTH },
    () => ACTIVATION_CODE_ALPHABET[randomInt(ACTIVATION_CODE_ALPHABET.length)],
  ).join('');
}

export function hashGeneratedActivationCode(code) {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

export function generateActivationBatch(count) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 100_000) {
    throw new TypeError('count must be an integer between 1 and 100000');
  }

  const codes = new Set();
  while (codes.size < count) {
    codes.add(generateActivationCode());
  }

  return [...codes].map((code, index) => ({
    sequence: index + 1,
    code,
    codeHash: hashGeneratedActivationCode(code),
    totalUses: ACTIVATION_CODE_USES,
  }));
}
