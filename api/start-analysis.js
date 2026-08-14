import { randomUUID } from 'node:crypto';
import { createAnalysisJob } from '../lib/activation-store.js';
import { createAnalysisJobToken, createAnalysisWorkerToken, verifyAnalysisToken } from '../lib/analysis-token.js';
import { enforceRateLimit } from '../lib/rate-limit.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function backgroundUrl(req) {
  const allowed = [process.env.DEPLOY_PRIME_URL, process.env.URL].filter(Boolean).map((value) => new URL(value));
  const forwardedHost = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const origin = allowed.find((url) => url.host === forwardedHost) || allowed[0];
  if (!origin) throw new Error('Netlify site URL is unavailable');
  return new URL('/.netlify/functions/analyze-background', origin).href;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }
  try { enforceRateLimit(req, 'analyze', { limit: 8, windowMs: 60_000 }); }
  catch (error) {
    res.setHeader('Retry-After', String(error.retryAfter));
    return res.status(429).json({ error: error.message });
  }
  try {
    const { imageBase64, analysisToken, requestId } = req.body ?? {};
    let codeHash;
    try { codeHash = verifyAnalysisToken(analysisToken); }
    catch { return res.status(403).json({ error: '授权已过期，请重新验证激活码' }); }
    if (!UUID_V4.test(requestId || '')) return res.status(400).json({ error: '请求标识无效' });
    if (typeof imageBase64 !== 'string' || !/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageBase64)) {
      return res.status(400).json({ error: '请上传有效照片' });
    }
    if (imageBase64.length > 4_000_000) return res.status(413).json({ error: '照片过大' });
    const proposed = { taskId: randomUUID(), ownerId: randomUUID() };
    const job = await createAnalysisJob(codeHash, requestId, proposed.taskId, proposed.ownerId);
    if (!job) return res.status(403).json({ error: '激活码无效或次数已用完' });
    const claims = { codeHash, requestId, taskId: job.taskId, ownerId: job.ownerId };
    const jobToken = createAnalysisJobToken(claims);
    // Re-enqueueing a still-queued job is safe: the database claim below lets
    // exactly one background invocation reach the paid model.
    if (job.status === 'queued') {
      const queued = await fetch(backgroundUrl(req), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, analysisToken, requestId, workerToken: createAnalysisWorkerToken(claims) }),
      });
      if (queued.status !== 202) throw new Error(`Background queue rejected (${queued.status})`);
    }
    return res.status(202).json({ taskId: job.taskId, status: job.status, jobToken });
  } catch (error) {
    console.error('Analysis enqueue failed:', error?.message || 'unknown');
    return res.status(502).json({ error: '分析任务暂时无法提交，请稍后重试' });
  }
}
