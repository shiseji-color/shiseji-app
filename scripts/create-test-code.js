import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY?.trim() ||
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY.');
  process.exit(1);
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const random = randomBytes(8);
const suffix = Array.from(random, (value) => alphabet[value % alphabet.length])
  .join('');
const testCode = `TST-${suffix}`;
const codeHash = createHash('sha256')
  .update(testCode, 'utf8')
  .digest('hex');

const headers = {
  apikey: supabaseKey,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
};

if (supabaseKey.startsWith('eyJ')) {
  headers.Authorization = `Bearer ${supabaseKey}`;
}

const response = await fetch(
  `${supabaseUrl}/rest/v1/activation_codes?on_conflict=code_hash`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code_hash: codeHash,
      remaining_uses: 9999,
      total_uses: 9999,
      enabled: true,
    }),
  },
);

if (!response.ok) {
  console.error(
    `Failed to create test code (${response.status}):`,
    (await response.text()).slice(0, 300),
  );
  process.exit(1);
}

await mkdir('private', { recursive: true });
await writeFile(
  'private/test-activation-code.txt',
  [
    '拾色季测试专用激活码',
    testCode,
    '可用次数：9999',
    '请勿截图、公开或提交到Git。',
    '',
  ].join('\r\n'),
  'utf8',
);

console.log('Secure test activation code created.');
console.log('Plaintext saved only to private/test-activation-code.txt');
console.log('The private/ directory is ignored by Git.');
