import { createHash } from 'node:crypto';

const buckets = new Map();

function getClientAddress(req) {
  const headers = req.headers ?? {};
  const forwarded = headers['x-forwarded-for'];
  return (
    headers['cf-connecting-ip'] ||
    headers['x-nf-client-connection-ip'] ||
    headers['x-real-ip'] ||
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') ||
    'unknown'
  );
}

export function enforceRateLimit(
  req,
  namespace,
  { limit, windowMs },
  now = Date.now(),
) {
  if (buckets.size > 1000) {
    for (const [key, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(key);
    }
  }

  const clientHash = createHash('sha256')
    .update(getClientAddress(req))
    .digest('hex');
  const key = `${namespace}:${clientHash}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    const error = new Error('请求过于频繁，请稍后重试');
    error.statusCode = 429;
    error.retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw error;
  }

  current.count += 1;
}

export function resetRateLimitsForTesting() {
  buckets.clear();
}
