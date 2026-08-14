import { getAnalysisJob } from '../lib/activation-store.js';
import { verifyAnalysisJobToken } from '../lib/analysis-token.js';
import { enforceRateLimit } from '../lib/rate-limit.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '仅支持 POST 请求' });
  }
  try { enforceRateLimit(req, 'analysis-status', { limit: 90, windowMs: 60_000 }); }
  catch (error) {
    res.setHeader('Retry-After', String(error.retryAfter));
    return res.status(429).json({ error: error.message });
  }
  try {
    const claims = verifyAnalysisJobToken(req.body?.jobToken);
    if (claims.taskId !== req.body?.taskId) return res.status(403).json({ error: '任务授权无效' });
    const job = await getAnalysisJob(claims);
    if (!job) return res.status(404).json({ error: '任务不存在' });
    const payload = { taskId: claims.taskId, status: job.status };
    if (job.status === 'completed') Object.assign(payload, {
      data: job.result, visualToken: job.visualToken,
      remainingUses: job.remainingUses, requestId: claims.requestId,
    });
    if (job.status === 'failed') payload.error = '分析未完成，本次不会扣除次数';
    return res.status(200).json(payload);
  } catch {
    return res.status(403).json({ error: '任务授权无效或已过期' });
  }
}
