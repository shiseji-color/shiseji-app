const SAFE_ANALYSIS_FAILURE_CODES = new Set([
  'model_auth_failed',
  'model_rate_limited',
  'model_request_rejected',
  'model_content_rejected',
  'model_timeout',
  'model_request_aborted',
  'model_unavailable',
  'model_response_truncated',
  'model_empty_response',
  'model_invalid_json',
  'model_schema_invalid',
  'photo_download_failed',
  'analysis_rule_failed',
  'analysis_failed',
]);

function numericStatus(error) {
  const value = Number(error?.status ?? error?.statusCode);
  return Number.isInteger(value) ? value : null;
}

export function classifyAnalysisFailure(error) {
  if (SAFE_ANALYSIS_FAILURE_CODES.has(error?.failureCode)) {
    return error.failureCode;
  }

  const message = String(error?.message || '');
  const status = numericStatus(error);
  const code = String(error?.code || '').toUpperCase();
  const name = String(error?.name || '');
  const causeCode = String(error?.cause?.code || '').toUpperCase();

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
  if (['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'].includes(code) ||
      ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED'].includes(causeCode)) {
    return 'model_unavailable';
  }
  if (
    ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(code) ||
    ['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT'].includes(causeCode) ||
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
