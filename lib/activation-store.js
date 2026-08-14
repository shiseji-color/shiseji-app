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

async function callActivationRpc(functionName, codeHash, extraParameters = {}) {
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
    body: JSON.stringify({
      ...(codeHash ? { p_code_hash: codeHash } : {}),
      ...extraParameters,
    }),
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

export async function consumeActivationUse(codeHash, requestId) {
  const result = await callActivationRpc(
    'consume_activation_use',
    codeHash,
    { p_request_id: requestId },
  );
  const row = Array.isArray(result) ? result[0] : null;
  return row
    ? {
        remainingUses: Number(row.remaining_uses),
        alreadyProcessed: Boolean(row.already_processed),
      }
    : null;
}

export async function refundActivationUse(codeHash, requestId) {
  const result = await callActivationRpc(
    'refund_activation_use',
    codeHash,
    { p_request_id: requestId },
  );
  return result === null ? null : Number(result);
}

export async function claimStyleImageJob(codeHash, requestId, kind, ownerId) {
  const rows = await callActivationRpc('claim_style_image_job', codeHash, {
    p_request_id: requestId,
    p_kind: kind,
    p_owner_id: ownerId,
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error('Style image job claim returned no result');
  return { status: row.job_status, resultUrl: row.result_url || null };
}

export async function completeStyleImageJob(requestId, kind, ownerId, resultUrl) {
  return callActivationRpc('complete_style_image_job', null, {
    p_request_id: requestId,
    p_kind: kind,
    p_owner_id: ownerId,
    p_result_url: resultUrl,
  });
}

export async function failStyleImageJob(requestId, kind, ownerId) {
  return callActivationRpc('fail_style_image_job', null, {
    p_request_id: requestId,
    p_kind: kind,
    p_owner_id: ownerId,
  });
}
