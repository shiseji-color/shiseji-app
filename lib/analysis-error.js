const SAFE_ANALYSIS_FAILURE_CODES = new Set([
  'model_auth_failed',
  'model_rate_limited',
  'model_request_rejected',
  'model_content_rejected',
  'model_timeout',
  'model_request_aborted',
  'model_unavailable',
  'model_request_build_failed',
  'model_response_extract_failed',
  'model_response_truncated',
  'model_empty_response',
  'model_invalid_json',
  'model_schema_invalid',
  'photo_download_failed',
  'analysis_rule_failed',
  'analysis_completion_save_failed',
  'analysis_failure_write_failed',
  'analysis_failed',
]);

function numericStatus(error) {
  const value = Number(error?.status ?? error?.statusCode);
  return Number.isInteger(value) ? value : null;
}

const NETWORK_UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH',
  'ENOTFOUND', 'EAI_AGAIN', 'EPIPE', 'EPROTO',
  'UND_ERR_CONNECT', 'UND_ERR_SOCKET',
  'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_SSL_PROTOCOL_ERROR', 'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

const NETWORK_TIMEOUT_CODES = new Set([
  'ETIMEDOUT', 'ESOCKETTIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT',
]);

function nestedErrors(error, seen = new Set(), depth = 0) {
  if (!error || typeof error !== 'object' || seen.has(error) || depth > 8) return [];
  seen.add(error);
  const values = [error];
  if (error.cause) values.push(...nestedErrors(error.cause, seen, depth + 1));
  if (Array.isArray(error.errors)) {
    for (const nested of error.errors) values.push(...nestedErrors(nested, seen, depth + 1));
  }
  return values;
}

export function classifyModelNetworkFailure(error) {
  const errors = nestedErrors(error);
  const codes = errors.map((item) => String(item?.code || '').toUpperCase());
  if (codes.some((code) => NETWORK_TIMEOUT_CODES.has(code))) return 'model_timeout';
  if (codes.some((code) => NETWORK_UNAVAILABLE_CODES.has(code) || code.startsWith('ERR_SSL_'))) {
    return 'model_unavailable';
  }
  return null;
}

export async function runModelCall(operation) {
  try {
    return await operation();
  } catch (error) {
    const failureCode = classifyModelNetworkFailure(error);
    if (failureCode) throw analysisFailureError(failureCode);
    throw error;
  }
}

export function classifyAnalysisFailure(error) {
  if (SAFE_ANALYSIS_FAILURE_CODES.has(error?.failureCode)) {
    return error.failureCode;
  }

  const message = String(error?.message || '');
  const status = numericStatus(error);
  const code = String(error?.code || '').toUpperCase();
  const name = String(error?.name || '');
  const networkFailure = classifyModelNetworkFailure(error);

  if (/Temporary photo download failed|INVALID_STORED_PHOTO/.test(message)) {
    return 'photo_download_failed';
  }
  if (name === 'ContentFilterFinishReasonError') return 'model_content_rejected';
  if (name === 'LengthFinishReasonError') return 'model_response_truncated';
  if (name === 'APIUserAbortError' || name === 'AbortError') return 'model_request_aborted';
  if (name === 'APIConnectionTimeoutError' || name === 'TimeoutError') return 'model_timeout';
  if (name === 'AuthenticationError' || name === 'PermissionDeniedError') return 'model_auth_failed';
  if (name === 'RateLimitError') return 'model_rate_limited';
  if (['BadRequestError', 'NotFoundError', 'ConflictError', 'UnprocessableEntityError'].includes(name)) return 'model_request_rejected';
  if (name === 'APIConnectionError' || name === 'InternalServerError') return 'model_unavailable';
  if (name === 'SyntaxError') return 'model_invalid_json';
  if (/^AI response (?:field|must)/.test(message)) return 'model_schema_invalid';
  if (/AI返回内容为空/.test(message)) return 'model_empty_response';
  if (status === 401 || status === 403) return 'model_auth_failed';
  if (status === 429) return 'model_rate_limited';
  if (/content.?filter|content policy|safety/i.test(`${code} ${message}`)) {
    return 'model_content_rejected';
  }
  if ([400, 404, 409, 422].includes(status)) return 'model_request_rejected';
  if (status !== null && status >= 500) return 'model_unavailable';
  if (name === 'APIError') return 'model_unavailable';
  if (networkFailure === 'model_unavailable') return networkFailure;
  if (
    networkFailure === 'model_timeout' ||
    /\btime(?:d)?\s*out\b/i.test(message)
  ) return 'model_timeout';

  return 'analysis_failed';
}

export function analysisFailureError(code) {
  const error = new Error('Analysis failed');
  error.failureCode = SAFE_ANALYSIS_FAILURE_CODES.has(code)
    ? code
    : 'analysis_failed';
  return error;
}

export function runAnalysisStage(code, operation) {
  try {
    const result = operation();
    return result && typeof result.then === 'function'
      ? result.catch(() => { throw analysisFailureError(code); })
      : result;
  } catch {
    throw analysisFailureError(code);
  }
}
