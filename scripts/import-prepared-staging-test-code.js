import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertStagingTarget } from '../lib/staging-guard.js';

const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
const supabaseKey = (
  process.env.SUPABASE_SECRET_KEY?.trim()
  || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
);

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing staging Supabase configuration.');
}

if (supabaseUrl === '[SENSITIVE]' || supabaseKey === '[SENSITIVE]') {
  throw new Error('The staging Supabase credential was withheld and cannot be used.');
}

const projectRef = assertStagingTarget(supabaseUrl);
if (!supabaseKey.startsWith('sb_secret_') && !supabaseKey.startsWith('eyJ')) {
  throw new Error('The staging Supabase secret key format is invalid.');
}

const plaintext = await readFile('private/test-activation-code.txt', 'utf8');
const match = plaintext.match(/\bTST-[A-HJ-NP-Z2-9]{8}\b/);
if (!match) {
  throw new Error('The prepared staging test code file is missing a valid code.');
}

const codeHash = createHash('sha256').update(match[0], 'utf8').digest('hex');
const headers = {
  apikey: supabaseKey,
  'Content-Type': 'application/json',
  Prefer: 'resolution=merge-duplicates,return=minimal',
};
if (supabaseKey.startsWith('eyJ')) headers.Authorization = `Bearer ${supabaseKey}`;

const writeResponse = await fetch(
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
    signal: AbortSignal.timeout(15_000),
  },
);

if (!writeResponse.ok) {
  throw new Error(`Staging test code import failed with HTTP ${writeResponse.status}.`);
}

const verifyResponse = await fetch(
  `${supabaseUrl}/rest/v1/activation_codes?code_hash=eq.${codeHash}&select=remaining_uses,total_uses,enabled`,
  {
    headers: { apikey: supabaseKey, ...(supabaseKey.startsWith('eyJ') ? { Authorization: `Bearer ${supabaseKey}` } : {}) },
    signal: AbortSignal.timeout(15_000),
  },
);
if (!verifyResponse.ok) {
  throw new Error(`Staging test code verification failed with HTTP ${verifyResponse.status}.`);
}

const rows = await verifyResponse.json();
const row = rows[0];
if (rows.length !== 1 || row.remaining_uses !== 9999 || row.total_uses !== 9999 || row.enabled !== true) {
  throw new Error('Staging test code verification returned an unexpected record.');
}

console.log(`Prepared staging review key imported and verified for ${projectRef}.`);
