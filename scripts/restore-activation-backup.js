import { createDecipheriv, createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

const MAGIC = Buffer.from('SSJVAULT1', 'ascii');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || isAbsolute(value)) return false;
  const parts = value.replaceAll('\\', '/').split('/');
  return !parts.includes('..') && !parts.includes('');
}

const vaultPath = resolve(argument('--vault') || '');
const recoveryPath = resolve(argument('--recovery-key') || '');
const outputArgument = argument('--output');
const verifyOnly = process.argv.includes('--verify-only');
if (!argument('--vault') || !argument('--recovery-key') || (!verifyOnly && !outputArgument)) {
  throw new Error('Required: --vault, --recovery-key, and either --verify-only or --output');
}

const [vault, recoveryText] = await Promise.all([
  readFile(vaultPath),
  readFile(recoveryPath, 'utf8'),
]);
const recovery = JSON.parse(recoveryText);
if (digest(vault) !== recovery.vault_sha256) throw new Error('Vault checksum mismatch.');
if (!vault.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Unknown vault format.');

const ivStart = MAGIC.length;
const tagStart = ivStart + 12;
const cipherStart = tagStart + 16;
const key = Buffer.from(recovery.recovery_key, 'base64url');
if (key.length !== 32) throw new Error('Invalid recovery key.');
const decipher = createDecipheriv('aes-256-gcm', key, vault.subarray(ivStart, tagStart));
decipher.setAAD(MAGIC);
decipher.setAuthTag(vault.subarray(tagStart, cipherStart));
const plaintext = Buffer.concat([decipher.update(vault.subarray(cipherStart)), decipher.final()]);
const payload = JSON.parse(plaintext.toString('utf8'));
if (payload.batch_id !== recovery.batch_id || !Array.isArray(payload.files)) {
  throw new Error('Recovery metadata mismatch.');
}

for (const file of payload.files) {
  if (!safeRelativePath(file.path)) throw new Error('Unsafe path in backup.');
  const content = Buffer.from(file.content, 'base64');
  if (digest(content) !== file.sha256) throw new Error(`File checksum mismatch: ${file.path}`);
}

if (!verifyOnly) {
  const output = resolve(outputArgument);
  try {
    await stat(output);
    throw new Error('Restore output already exists.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(output, { recursive: true });
  for (const file of payload.files) {
    const target = resolve(output, file.path);
    if (!target.startsWith(`${output}\\`) && target !== output) throw new Error('Restore path escaped output.');
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(file.content, 'base64'), { flag: 'wx' });
  }
}

console.log(`Verified encrypted backup for batch ${payload.batch_id}.`);
console.log(`Files: ${payload.files.length}; codes: ${payload.code_count}; uses each: ${payload.uses_per_code}.`);
console.log(verifyOnly ? 'No plaintext files were restored.' : 'Restore completed.');
