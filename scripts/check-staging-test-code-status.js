import { readFile } from 'node:fs/promises';

const baseUrl = new URL(process.env.STAGING_BASE_URL || 'https://staging.shiseji.com');
if (baseUrl.protocol !== 'https:' || baseUrl.hostname !== 'staging.shiseji.com') {
  throw new Error('Test code status checks are restricted to staging.shiseji.com.');
}

const plaintext = await readFile('private/test-activation-code.txt', 'utf8');
const activationCode = plaintext.match(/\bTST-[A-HJ-NP-Z2-9]{8}\b/)?.[0];
if (!activationCode) throw new Error('The private staging review key is unavailable.');

const response = await fetch(new URL('/api/verify-code', baseUrl), {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ activationCode }),
  redirect: 'error',
  signal: AbortSignal.timeout(15_000),
});
const payload = await response.json();
if (!response.ok || payload.valid !== true) {
  throw new Error(`Staging review key check failed with HTTP ${response.status}.`);
}

console.log(JSON.stringify({
  valid: true,
  remainingUses: payload.remainingUses,
}, null, 2));
