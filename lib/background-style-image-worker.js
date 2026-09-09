import { applyIdentityKnowledge } from './color-framework.js';
import {
  beginStyleImageProviderSubmission,
  claimStyleImageJob,
  completeStyleImageJob,
  failStyleImageJob,
  saveStyleImageProviderResult,
} from './activation-store.js';
import { validateAnalysisResult } from './analysis-schema.js';
import { verifyStyleImageWorkerToken } from './analysis-token.js';
import {
  buildImageEditorRequest,
  classifyStyleImageFailure,
  requestStyleImageJson,
  runStyleImageStage,
} from './style-image-provider.js';
import { extractGeneratedImageUrl, validateStyleImageKind } from './style-image.js';
import { persistStyleImage } from './style-image-storage.js';
import {
  deleteTemporaryObject,
  downloadTemporaryPhoto,
} from './temporary-photo-store.js';

async function requireJobWrite(operation) {
  const result = await operation();
  if (result !== true) throw new Error('Style image job state was not updated');
  return result;
}

export function createBackgroundStyleImageHandler(dependencies = {}) {
  const {
    beginSubmission = beginStyleImageProviderSubmission,
    claimJob = claimStyleImageJob,
    completeJob = completeStyleImageJob,
    deletePhoto = deleteTemporaryObject,
    downloadPhoto = downloadTemporaryPhoto,
    failJob = failStyleImageJob,
    fetchImpl = globalThis.fetch,
    persistImage = persistStyleImage,
    saveProviderResult = saveStyleImageProviderResult,
    verifyWorkerToken = verifyStyleImageWorkerToken,
    env = process.env,
  } = dependencies;

  return async function handleBackgroundStyleImage(event) {
    let claims;
    try {
      const body = typeof event?.body === 'string' ? JSON.parse(event.body) : event;
      claims = verifyWorkerToken(body?.workerToken);
      validateStyleImageKind(claims.kind);
    } catch {
      console.error('Background style image failed:', 'background_payload_invalid');
      return;
    }

    let phase = 'preparing';
    try {
      const job = await runStyleImageStage('style_image_job_claim_failed', () => claimJob(
        claims.codeHash,
        claims.requestId,
        claims.kind,
        claims.ownerId,
        false,
      ));
      if (job.status === 'completed' || job.status === 'failed') {
        await deletePhoto(claims.photoPath).catch(() => {});
        return;
      }
      if (job.stage === 'submitting' || job.stage === 'provider_submitted') return;

      let sourceUrl = job.resultUrl;
      if (!sourceUrl) {
        const analysis = applyIdentityKnowledge(validateAnalysisResult(claims.analysis));
        const imageBase64 = await runStyleImageStage(
          'style_image_photo_download_failed',
          () => downloadPhoto(claims.photoPath),
        );
        const request = buildImageEditorRequest({
          imageBase64,
          kind: claims.kind,
          analysis,
        }, env);
        const acquired = await runStyleImageStage(
          'style_image_provider_result_write_failed',
          () => beginSubmission(claims.codeHash, claims.requestId, claims.kind, claims.ownerId),
        );
        if (acquired !== true) return;

        phase = 'submitting';
        const payload = await requestStyleImageJson(request.endpoint, request.options, fetchImpl);
        sourceUrl = await runStyleImageStage(
          'style_image_result_extract_failed',
          async () => extractGeneratedImageUrl(payload),
        );
        await runStyleImageStage(
          'style_image_provider_result_write_failed',
          () => requireJobWrite(() => saveProviderResult(
            claims.codeHash,
            claims.requestId,
            claims.kind,
            claims.ownerId,
            sourceUrl,
          )),
        );
      }

      phase = 'provider_completed';
      const resultPath = await runStyleImageStage(
        'style_image_storage_failed',
        () => persistImage({
          sourceUrl,
          codeHash: claims.codeHash,
          requestId: claims.requestId,
          kind: claims.kind,
        }),
      );
      await deletePhoto(claims.photoPath).catch(() => {
        console.error('Background style image diagnostic:', 'photo_cleanup_failed');
      });
      await runStyleImageStage(
        'style_image_job_complete_failed',
        () => requireJobWrite(() => completeJob(
          claims.codeHash,
          claims.requestId,
          claims.kind,
          claims.ownerId,
          resultPath,
        )),
      );
    } catch (error) {
      const diagnosticCode = classifyStyleImageFailure(error);
      const safelyRetryable = phase === 'preparing'
        || diagnosticCode === 'style_image_model_rejected';
      if (safelyRetryable) {
        try {
          await failJob(
            claims.codeHash,
            claims.requestId,
            claims.kind,
            claims.ownerId,
            diagnosticCode,
          );
          await deletePhoto(claims.photoPath).catch(() => {});
        } catch {
          console.error('Background style image failed:', 'style_image_job_complete_failed');
        }
      }
      console.error('Background style image failed:', diagnosticCode);
    }
  };
}
