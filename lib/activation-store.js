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

export async function createAnalysisJob(codeHash, requestId, taskId, ownerId, photoPath) {
  const rows = await callActivationRpc('create_analysis_job', codeHash, {
    p_request_id: requestId, p_task_id: taskId, p_owner_id: ownerId, p_photo_path: photoPath,
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return null;
  return {
    taskId: row.task_id,
    ownerId: row.owner_id,
    status: row.job_status,
    created: Boolean(row.created),
    photoPath: row.photo_path,
  };
}

export async function claimAnalysisJob(claims) {
  const rows = await callActivationRpc('claim_analysis_job', claims.codeHash, {
    p_request_id: claims.requestId, p_task_id: claims.taskId, p_owner_id: claims.ownerId,
  });
  return Array.isArray(rows) ? rows[0]?.job_status ?? null : null;
}

export async function completeAnalysisJob(claims, data, visualToken) {
  const rows = await callActivationRpc('complete_analysis_job', claims.codeHash, {
    p_request_id: claims.requestId, p_task_id: claims.taskId, p_owner_id: claims.ownerId,
    p_result: data, p_visual_token: visualToken,
    p_charge_use: data.season_en !== 'PHOTO_NOT_ELIGIBLE',
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? { completed: Boolean(row.completed), remainingUses: Number(row.remaining_uses) } : null;
}

export async function failAnalysisJob(claims, reason = 'analysis_failed') {
  return callActivationRpc('fail_analysis_job', claims.codeHash, {
    p_request_id: claims.requestId, p_task_id: claims.taskId,
    p_owner_id: claims.ownerId, p_reason: reason,
  });
}

export async function getAnalysisJob(claims) {
  const rows = await callActivationRpc('get_analysis_job', claims.codeHash, {
    p_request_id: claims.requestId, p_task_id: claims.taskId, p_owner_id: claims.ownerId,
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  return row ? {
    status: row.job_status, result: row.result, visualToken: row.visual_token,
    remainingUses: row.remaining_uses === null ? null : Number(row.remaining_uses),
    failureCode: row.failure_code,
    photoPath: row.photo_path,
  } : null;
}

export async function claimExpiredAnalysisPhotos() {
  const rows = await callActivationRpc('claim_expired_analysis_photos', null);
  return Array.isArray(rows) ? rows.map((row) => row.photo_path).filter(Boolean) : [];
}
