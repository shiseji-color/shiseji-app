import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const suffix = Array.from(randomBytes(8), (value) => alphabet[value % alphabet.length]).join('');
const testCode = `TST-${suffix}`;
const codeHash = createHash('sha256').update(testCode, 'utf8').digest('hex');

const sql = `-- Staging-only review key. Contains only a one-way hash, never plaintext.\ninsert into public.activation_codes (code_hash, remaining_uses, total_uses, enabled)\nvalues ('${codeHash}', 9999, 9999, true)\non conflict (code_hash) do update\nset remaining_uses = excluded.remaining_uses,\n    total_uses = excluded.total_uses,\n    enabled = true,\n    updated_at = now();\n`;

await mkdir('private', { recursive: true });
await Promise.all([
  writeFile(
    'private/test-activation-code.txt',
    ['拾色季 staging 测试专用密钥', testCode, '可用次数：9999', '请勿公开、上传或提交到 Git。', ''].join('\r\n'),
    { encoding: 'utf8', flag: 'wx' },
  ),
  writeFile('private/test-activation-code.sql', sql, { encoding: 'utf8', flag: 'wx' }),
]);

console.log('Prepared one staging-only review key.');
console.log('Plaintext and hash-only SQL were saved under the Git-ignored private directory.');
