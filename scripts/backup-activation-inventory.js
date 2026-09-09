import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

const MAGIC = Buffer.from('SSJVAULT1', 'ascii');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function collectFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(root, absolute));
    else if (entry.isFile()) {
      const content = await readFile(absolute);
      files.push({
        path: relative(root, absolute).replaceAll('\\', '/'),
        sha256: digest(content),
        content: content.toString('base64'),
      });
    }
  }
  return files;
}

const source = resolve(argument('--source') || '');
const vaultPath = resolve(argument('--vault') || '');
const recoveryPath = resolve(argument('--recovery-key') || '');
if (!argument('--source') || !argument('--vault') || !argument('--recovery-key')) {
  throw new Error('Required: --source, --vault and --recovery-key');
}

const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
const files = await collectFiles(source);
const payload = Buffer.from(JSON.stringify({
  format: 'shiseji-activation-backup-v1',
  created_at: new Date().toISOString(),
  batch_id: manifest.batch_id,
  code_count: manifest.code_count,
  uses_per_code: manifest.uses_per_code,
  files,
}), 'utf8');

const key = randomBytes(32);
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
cipher.setAAD(MAGIC);
const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
const tag = cipher.getAuthTag();
const vault = Buffer.concat([MAGIC, iv, tag, ciphertext]);
const recovery = {
  format: 'shiseji-activation-recovery-key-v1',
  batch_id: manifest.batch_id,
  vault_sha256: digest(vault),
  key_encoding: 'base64url',
  recovery_key: key.toString('base64url'),
};

await Promise.all([
  mkdir(dirname(vaultPath), { recursive: true }),
  mkdir(dirname(recoveryPath), { recursive: true }),
]);
await writeFile(vaultPath, vault, { flag: 'wx' });
await writeFile(recoveryPath, `${JSON.stringify(recovery, null, 2)}\n`, { flag: 'wx' });

console.log(`Encrypted batch ${manifest.batch_id}: ${files.length} files.`);
console.log(`Vault SHA-256: ${recovery.vault_sha256}`);
console.log('Recovery key was written separately and was not printed.');
