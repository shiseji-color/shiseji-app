import { createHash } from 'node:crypto';
import { applyIdentityKnowledge } from '../lib/color-framework.js';
import { claimStyleImageJob, saveStyleImageSource } from '../lib/activation-store.js';
import { validateAnalysisResult } from '../lib/analysis-schema.js';
import { createStyleImageWorkerToken, verifyVisualToken } from '../lib/analysis-token.js';
import { dispatchStyleImage } from '../lib/background-style-image-dispatch.js';
import { enforceRateLimit } from '../lib/rate-limit.js';
import { validateStyleImageKind } from '../lib/style-image.js';
import {
  classifyStyleImageFailure,
  runStyleImageStage,
} from '../lib/style-image-provider.js';
import { createStyleImageSignedUrl } from '../lib/style-image-storage.js';
import {
  decodePhotoDataUrl,
  temporaryPhotoPath,
  uploadTemporaryPhoto,
} from '../lib/temporary-photo-store.js';

export {
  buildImageEditorRequest,
  classifyStyleImageFailure,
} from '../lib/style-image-provider.js';

const MAX_BACKGROUND_PAYLOAD_BYTES = 200_000;

async function requireJobWrite(operation) {
  const result = await operation();
  if (result !== true) throw new Error('Style image job state was not updated');
  return result;
}

export function buildStyleImageBackgroundPayload(claims) {
  const body = JSON.stringify({ workerToken: createStyleImageWorkerToken(claims) });
  if (Buffer.byteLength(body, 'utf8') > MAX_BACKGROUND_PAYLOAD_BYTES) {
    throw new Error('Background payload exceeds safe limit');
  }
  return body;
}

function styleImageOwnerId(codeHash, requestId, kind) {
  const hex = createHash('sha256').update(`${codeHash}:${requestId}:${kind}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function createStyleImageHandler(dependencies = {}) {
  const claimJob = dependencies.claimJob || claimStyleImageJob;
  const dispatchBackground = dependencies.dispatchBackground || dispatchStyleImage;
  const saveSource = dependencies.saveSource || saveStyleImageSource;
  const signImage = dependencies.signImage || createStyleImageSignedUrl;
  const uploadPhoto = dependencies.uploadPhoto || uploadTemporaryPhoto;
  const env = dependencies.env || process.env;

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: '仅支持POST请求' });
    }
    if (env.STYLE_IMAGE_GENERATION_ENABLED !== 'true') {
      res.setHeader('Retry-After', '300');
      return res.status(503).json({ error: '专属造型图正在维护，请稍后重试' });
    }

    try {
      enforceRateLimit(req, 'generate-style-image', { limit: 60, windowMs: 60_000 });
    } catch (error) {
      res.setHeader('Retry-After', String(error.retryAfter));
      return res.status(429).json({ error: error.message });
    }

    const { imageBase64, visualToken, requestId, analysis, kind, retry = false } = req.body ?? {};
    let authorization;
    try {
      authorization = verifyVisualToken(visualToken, requestId, analysis);
    } catch {
      return res.status(403).json({ error: '造型生成授权无效或已过期，请重新完成分析' });
    }

    try {
      validateStyleImageKind(kind);
      const validated = validateAnalysisResult(analysis);
      if (validated.season_en === 'PHOTO_NOT_ELIGIBLE') {
        return res.status(400).json({ error: '当前照片不适合生成个性化造型' });
      }
      const trustedAnalysis = applyIdentityKnowledge(validated);
      const ownerId = styleImageOwnerId(authorization.codeHash, requestId, kind);
      const job = await runStyleImageStage('style_image_job_claim_failed', () => claimJob(
        authorization.codeHash,
        requestId,
        kind,
        ownerId,
        retry === true,
      ));

      if (job.status === 'completed') {
        const imageUrl = await runStyleImageStage(
          'style_image_sign_failed',
          () => signImage(job.resultPath),
        );
        return res.status(200).json({ kind, status: 'completed', reused: true, imageUrl });
      }
      if (job.status === 'failed') {
        return res.status(409).json({
          kind,
          status: 'failed',
          diagnosticCode: job.failureCode || 'style_image_handler_failed',
        });
      }
      if (job.stage === 'submitting' || job.stage === 'provider_submitted') {
        return res.status(202).json({ kind, status: 'processing' });
      }

      let sourcePath = job.sourcePath;
      if (!sourcePath) {
        let photo;
        try {
          photo = decodePhotoDataUrl(imageBase64);
        } catch (error) {
          return res.status(error.message === 'PHOTO_TOO_LARGE' ? 413 : 400)
            .json({ error: '请上传有效且大小合适的照片' });
        }
        sourcePath = temporaryPhotoPath(requestId, ownerId, photo.contentType);
        await runStyleImageStage(
          'style_image_queue_dispatch_failed',
          () => uploadPhoto(sourcePath, photo),
        );
        await runStyleImageStage(
          'style_image_queue_dispatch_failed',
          () => requireJobWrite(() => saveSource(
            authorization.codeHash,
            requestId,
            kind,
            ownerId,
            sourcePath,
          )),
        );
      }

      const workerClaims = {
        codeHash: authorization.codeHash,
        requestId,
        taskId: requestId,
        ownerId,
        kind,
        photoPath: sourcePath,
        analysis: trustedAnalysis,
      };
      const body = buildStyleImageBackgroundPayload(workerClaims);
      const phase = job.stage === 'provider_completed' ? 'persist' : 'generate';
      await runStyleImageStage(
        'style_image_queue_dispatch_failed',
        () => dispatchBackground(req, body, `${requestId}-${kind}-${phase}`),
      );
      return res.status(202).json({ kind, status: 'processing' });
    } catch (error) {
      const diagnosticCode = classifyStyleImageFailure(error);
      console.error('Personalized style image generation failed:', diagnosticCode);
      return res.status(502).json({
        error: '专属造型图暂时生成失败，请稍后重试',
        diagnosticCode,
      });
    }
  };
}

export default createStyleImageHandler();
