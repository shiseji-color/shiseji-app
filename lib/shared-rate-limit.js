import { createHmac } from 'node:crypto';

// Public routes opt in through request-rate-limit.js; disabled by default.
// clientIdentity MUST be obtained from a verified platform boundary, not arbitrary headers.
export function createSharedRateLimiter({ url, key, identitySecret, fetchImpl = fetch }) {
  if (!url || !key || typeof identitySecret !== 'string' || identitySecret.length < 32) throw Error('Shared limiter configuration missing');
  const endpoint = new URL('/rest/v1/rpc/consume_request_rate_limit', url);
  if (endpoint.protocol !== 'https:') throw Error('Shared limiter requires HTTPS');
  return async function enforce({ clientIdentity, namespace, limit, windowMs }) {
    if (typeof clientIdentity !== 'string' || !clientIdentity || clientIdentity.length > 512 ||
        typeof namespace !== 'string' || !/^[a-z0-9-]{1,64}$/.test(namespace) ||
        !Number.isInteger(limit) || limit < 1 || limit > 100000 ||
        !Number.isInteger(windowMs) || windowMs < 1000 || windowMs > 86400000) throw Error('Invalid rate limit input');
    const bucket = createHmac('sha256', identitySecret).update(JSON.stringify([namespace, limit, windowMs, clientIdentity])).digest('hex');
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
    let result;
    let failureCode = 'rate_limit_network_error';
    try {
      const response = await fetchImpl(endpoint, { method: 'POST', headers,
        signal: AbortSignal.timeout(3000),
        body: JSON.stringify({ p_bucket_key: bucket, p_limit: limit, p_window_ms: windowMs }) });
      if (!response.ok) {
        failureCode = 'rate_limit_http_' + (Number.isInteger(response.status) ? response.status : 'error');
        throw Error('RPC unavailable');
      }
      failureCode = 'rate_limit_invalid_response';
      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length !== 1) throw Error('Invalid RPC result');
      result = rows[0];
      if (typeof result.allowed !== 'boolean' || !Number.isInteger(result.retry_after) ||
          result.retry_after < (result.allowed ? 0 : 1) || result.retry_after > 86400) throw Error('Invalid RPC result');
    } catch (cause) {
      const error = Error('请求保护服务暂不可用，请稍后重试');
      error.statusCode = 503; error.retryAfter = 3;
      error.diagnosticCode = ['TimeoutError', 'AbortError'].includes(cause?.name)
        ? 'rate_limit_timeout' : failureCode;
      throw error; // Do not silently fall back to per-instance memory.
    }
    if (!result.allowed) {
      const error = Error('请求过于频繁，请稍后重试');
      error.statusCode = 429; error.retryAfter = result.retry_after;
      throw error;
    }
  };
}
