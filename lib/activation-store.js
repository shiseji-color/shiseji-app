import { createHash } from 'node:crypto';

const CODE_PATTERN = /^[A-Z0-9-]{12}$/;

export function normalizeActivationCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function isActivationCodeFormatValid(value) {
  return CODE_PATTERN.test(value);
}

export function hashActivationCode(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase server environment variables are missing');
  }

  return { url, key };
}

async function callActivationRpc(functionName, codeHash) {
  const { url, key } = getSupabaseConfig();
  const headers = {
    apikey: key,
    'Content-Type': 'application/json',
  };

  // Legacy service_role keys are JWTs. New sb_secret_ keys must not be
  // placed in the Authorization header.
  if (key.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${key}`;
  }

  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_code_hash: codeHash }),
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `Supabase RPC ${functionName} failed (${response.status}): ${detail}`,
    );
  }

  return response.json();
}

export async function getActivationStatus(codeHash) {
  const rows = await callActivationRpc('activation_status', codeHash);
  const status = Array.isArray(rows) ? rows[0] : null;

  return {
    valid: Boolean(status?.is_valid),
    remainingUses: Number(status?.remaining_uses ?? 0),
  };
}

export async function consumeActivationUse(codeHash) {
  const remaining = await callActivationRpc(
    'consume_activation_use',
    codeHash,
  );

  return remaining === null ? null : Number(remaining);
}

export async function refundActivationUse(codeHash) {
  const remaining = await callActivationRpc(
    'refund_activation_use',
    codeHash,
  );

  return remaining === null ? null : Number(remaining);
}
