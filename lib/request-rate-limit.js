import { isIP } from 'node:net';
import { enforceRateLimit as enforceMemoryRateLimit } from './rate-limit.js';
import { createSharedRateLimiter } from './shared-rate-limit.js';

function unavailable() {
  const error = Error('请求保护服务暂不可用，请稍后重试');
  error.statusCode = 503; error.retryAfter = 3;
  return error;
}

export function trustedClientIdentity(req, env) {
  // Platform environment flags, never a user-supplied platform selector.
  const header = env.VERCEL === '1' ? 'x-forwarded-for'
    : env.NETLIFY === 'true' ? 'x-nf-client-connection-ip' : null;
  const raw = header && req.headers?.[header];
  if (typeof raw !== 'string' || !isIP(raw.trim())) throw unavailable();
  // Reject ambiguous lists. Normalize equivalent IPv6 spellings before hashing.
  const address = raw.trim();
  return isIP(address) === 6 ? new URL('http://[' + address + ']').hostname : address;
}

export async function enforceRequestRateLimit(req, namespace, policy, dependencies = {}) {
  const env = dependencies.env || process.env;
  if (env.SHARED_RATE_LIMIT_ENABLED !== 'true') {
    return enforceMemoryRateLimit(req, namespace, policy);
  }
  const clientIdentity = trustedClientIdentity(req, env);
  let enforce;
  try {
    enforce = createSharedRateLimiter({ url: env.SUPABASE_URL,
      key: env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY,
      identitySecret: env.RATE_LIMIT_IDENTITY_SECRET,
      fetchImpl: dependencies.fetchImpl || fetch });
  } catch { throw unavailable(); }
  return enforce({ clientIdentity, namespace, ...policy });
}

export async function enforceInteractiveRequestRateLimit(req) {
  if (req.backgroundMode === true) return;
  return enforceRequestRateLimit(req, 'analyze', { limit: 5, windowMs: 60000 });
}
