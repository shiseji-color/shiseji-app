import { createHash, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  ACTIVATION_CODE_USES,
  generateActivationBatch,
} from '../lib/activation-code-generator.js';

function parseCount(argv) {
  const countIndex = argv.indexOf('--count');
  const rawCount = countIndex >= 0 ? argv[countIndex + 1] : '10';
  const count = Number(rawCount);

  if (!Number.isSafeInteger(count) || count < 1 || count > 100_000) {
    throw new TypeError('--count must be an integer between 1 and 100000');
  }

  return count;
}

function csvEscape(value) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

const count = parseCount(process.argv.slice(2));
const createdAt = new Date();
const timestamp = createdAt.toISOString().replaceAll(':', '-').replace('.', '-');
const batchId = `${timestamp}-${randomBytes(4).toString('hex')}`;
const outputDirectory = resolve('private', 'activation-batches', batchId);
const records = generateActivationBatch(count);

const plaintextCsv = [
  ['batch_id', 'sequence', 'activation_code', 'total_uses', 'status']
    .map(csvEscape)
    .join(','),
  ...records.map((record) =>
    [
      batchId,
      record.sequence,
      record.code,
      record.totalUses,
      'unsold',
    ]
      .map(csvEscape)
      .join(','),
  ),
  '',
].join('\r\n');

const databaseRecords = records.map((record) => ({
  code_hash: record.codeHash,
  remaining_uses: record.totalUses,
  total_uses: record.totalUses,
  enabled: true,
}));
const hashesJson = `${JSON.stringify(databaseRecords, null, 2)}\n`;

const manifest = {
  format: 'shiseji-activation-batch-v1',
  batch_id: batchId,
  created_at: createdAt.toISOString(),
  code_count: count,
  uses_per_code: ACTIVATION_CODE_USES,
  database_imported: false,
  files: {
    plaintext_csv: {
      name: 'plaintext-inventory.csv',
      sha256: digest(plaintextCsv),
      warning: 'Contains plaintext activation codes. Keep private and encrypted.',
    },
    hashes_json: {
      name: 'database-hashes.json',
      sha256: digest(hashesJson),
    },
  },
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(
    resolve(outputDirectory, 'plaintext-inventory.csv'),
    plaintextCsv,
    'utf8',
  ),
  writeFile(
    resolve(outputDirectory, 'database-hashes.json'),
    hashesJson,
    'utf8',
  ),
  writeFile(
    resolve(outputDirectory, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  ),
]);

console.log(`Generated ${count} activation codes with ${ACTIVATION_CODE_USES} uses each.`);
console.log(`Batch: ${batchId}`);
console.log(`Saved under: ${outputDirectory}`);
console.log('No database changes were made.');
