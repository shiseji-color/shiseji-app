import {
  getActivationStatus,
  hashActivationCode,
  isActivationCodeFormatValid,
  normalizeActivationCode,
} from '../lib/activation-store.js';
import { createAnalysisToken } from '../lib/analysis-token.js';
import { enforceRateLimit } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '仅支持POST请求' });
  }

  try {
    enforceRateLimit(req, 'verify-code', { limit: 10, windowMs: 60_000 });
  } catch (error) {
    res.setHeader('Retry-After', String(error.retryAfter));
    return res.status(429).json({ error: error.message });
  }

  const code = normalizeActivationCode(req.body?.activationCode);

  if (!isActivationCodeFormatValid(code)) {
    return res.status(400).json({
      valid: false,
      remainingUses: 0,
      error: '激活码格式不正确',
    });
  }

  try {
    const status = await getActivationStatus(hashActivationCode(code));

    return res.status(200).json({
      ...status,
      analysisToken: status.valid ? createAnalysisToken(hashActivationCode(code)) : null,
    });
  } catch {
    console.error('Activation verification failed:', 'activation_store_unavailable');
    return res.status(503).json({
      valid: false,
      remainingUses: 0,
      error: '激活服务暂时不可用，请稍后重试',
    });
  }
}
