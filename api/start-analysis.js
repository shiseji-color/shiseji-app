import { randomUUID } from 'node:crypto';
import { claimExpiredAnalysisPhotos, createAnalysisJob } from '../lib/activation-store.js';
import { createAnalysisJobToken, createAnalysisWorkerToken, verifyAnalysisToken } from '../lib/analysis-token.js';
import { enforceRateLimit } from '../lib/rate-limit.js';
import { dispatchBackground } from '../lib/background-analysis-dispatch.js';
import {
  decodePhotoDataUrl, deleteTemporaryPhotos, temporaryPhotoPath, uploadTemporaryPhoto,
} from '../lib/temporary-photo-store.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BACKGROUND_PAYLOAD_BYTES = 200_000;

export function buildBackgroundPayload(claims) {
  const body = JSON.stringify({ workerToken: createAnalysisWorkerToken(claims) });
  if (Buffer.byteLength(body, 'utf8') > MAX_BACKGROUND_PAYLOAD_BYTES) {
    throw new Error('Background payload exceeds safe limit');
  }
  return body;
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
    let photo;
    try { photo = decodePhotoDataUrl(imageBase64); }
    catch (error) { return res.status(error.message === 'PHOTO_TOO_LARGE' ? 413 : 400).json({ error: '请上传有效且大小合适的照片' }); }
    try { await deleteTemporaryPhotos(await claimExpiredAnalysisPhotos()); } catch {}
    const proposed = { taskId: randomUUID(), ownerId: randomUUID() };
    const proposedPath = temporaryPhotoPath(proposed.taskId, proposed.ownerId, photo.contentType);
    const job = await createAnalysisJob(codeHash, requestId, proposed.taskId, proposed.ownerId, proposedPath);
    if (!job) return res.status(403).json({ error: '激活码无效或次数已用完' });
    const claims = { codeHash, requestId, taskId: job.taskId, ownerId: job.ownerId };
    const jobToken = createAnalysisJobToken(claims);
    // Re-enqueueing a still-queued job is safe: the database claim below lets
    // exactly one background invocation reach the paid model.
    if (job.status === 'queued') {
      await uploadTemporaryPhoto(job.photoPath, photo);
      const workerClaims = { ...claims, photoPath: job.photoPath };
      await dispatchBackground(req, buildBackgroundPayload(workerClaims));
    }
    return res.status(202).json({ taskId: job.taskId, status: job.status, jobToken });
  } catch (error) {
    console.error('Analysis enqueue failed:', error?.message || 'unknown');
    return res.status(502).json({ error: '分析任务暂时无法提交，请稍后重试' });
  }
}
