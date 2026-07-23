import {
  getActivationStatus,
  hashActivationCode,
  isActivationCodeFormatValid,
  normalizeActivationCode,
} from '../lib/activation-store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '仅支持POST请求' });
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

    return res.status(200).json(status);
  } catch (error) {
    console.error('Activation verification failed:', error);
    return res.status(503).json({
      valid: false,
      remainingUses: 0,
      error: '激活服务暂时不可用，请稍后重试',
    });
  }
}
