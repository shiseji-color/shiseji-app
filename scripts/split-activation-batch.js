import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function unquote(value) {
  if (!value.startsWith('"') || !value.endsWith('"')) {
    throw new Error('Unexpected activation inventory CSV format.');
  }
  return value.slice(1, -1).replaceAll('""', '"');
}

const batchDirectory = resolve(readArgument('--batch-dir') || '');
const waveSize = Number(readArgument('--wave-size') || 500);
if (!Number.isSafeInteger(waveSize) || waveSize < 1) {
  throw new TypeError('--wave-size must be a positive integer');
}

const manifest = JSON.parse(await readFile(resolve(batchDirectory, 'manifest.json'), 'utf8'));
const csvText = await readFile(resolve(batchDirectory, 'plaintext-inventory.csv'), 'utf8');
const hashRecords = JSON.parse(await readFile(resolve(batchDirectory, 'database-hashes.json'), 'utf8'));
const lines = csvText.split(/\r?\n/).filter(Boolean);
const header = lines.shift();

if (lines.length !== manifest.code_count || hashRecords.length !== manifest.code_count) {
  throw new Error('Batch record count does not match its manifest.');
}

const seenCodes = new Set();
const seenHashes = new Set();
lines.forEach((line, index) => {
  const fields = line.split(',');
  const code = unquote(fields[2]);
  const expectedHash = sha256(code);
  const hashRecord = hashRecords[index];
  if (hashRecord.code_hash !== expectedHash) {
    throw new Error(`Plaintext and hash mismatch at sequence ${index + 1}.`);
  }
  if (seenCodes.has(code) || seenHashes.has(expectedHash)) {
    throw new Error(`Duplicate activation code at sequence ${index + 1}.`);
  }
  seenCodes.add(code);
  seenHashes.add(expectedHash);
});

const wavesRoot = resolve(batchDirectory, 'waves');
await mkdir(wavesRoot, { recursive: false });
const waveCount = Math.ceil(lines.length / waveSize);

for (let waveIndex = 0; waveIndex < waveCount; waveIndex += 1) {
  const start = waveIndex * waveSize;
  const end = Math.min(start + waveSize, lines.length);
  const waveId = `wave-${String(waveIndex + 1).padStart(2, '0')}`;
  const waveDirectory = resolve(wavesRoot, waveId);
  const plaintext = [header, ...lines.slice(start, end), ''].join('\r\n');
  const hashes = `${JSON.stringify(hashRecords.slice(start, end), null, 2)}\n`;
  const waveManifest = {
    format: 'shiseji-activation-wave-v1',
    parent_batch_id: manifest.batch_id,
    wave_id: waveId,
    sequence_start: start + 1,
    sequence_end: end,
    code_count: end - start,
    uses_per_code: manifest.uses_per_code,
    database_imported: false,
    fulfillment_uploaded: false,
    files: {
      plaintext_csv: {
        name: 'plaintext-inventory.csv',
        sha256: sha256(plaintext),
        warning: 'Contains plaintext activation codes. Keep private and encrypted.',
      },
      hashes_json: {
        name: 'database-hashes.json',
        sha256: sha256(hashes),
      },
    },
  };
  await mkdir(waveDirectory);
  await Promise.all([
    writeFile(resolve(waveDirectory, 'plaintext-inventory.csv'), plaintext, 'utf8'),
    writeFile(resolve(waveDirectory, 'database-hashes.json'), hashes, 'utf8'),
    writeFile(resolve(waveDirectory, 'manifest.json'), `${JSON.stringify(waveManifest, null, 2)}\n`, 'utf8'),
  ]);
}

console.log(`Verified ${lines.length} unique activation codes in ${basename(batchDirectory)}.`);
console.log(`Created ${waveCount} fulfillment waves of up to ${waveSize} codes.`);
