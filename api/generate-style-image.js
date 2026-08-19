import { createHash } from 'node:crypto';
import { applyIdentityKnowledge } from '../lib/color-framework.js';
import {
  beginStyleImageProviderSubmission,
  claimStyleImageJob,
  completeStyleImageJob,
  failStyleImageJob,
  saveStyleImageProviderTask,
} from '../lib/activation-store.js';
import { validateAnalysisResult } from '../lib/analysis-schema.js';
import { verifyVisualToken } from '../lib/analysis-token.js';
import { enforceRateLimit } from '../lib/rate-limit.js';
import {
  buildStyleImagePrompt,
  extractGeneratedImageUrl,
  extractStyleImageTaskId,
  normalizeStyleImageTaskStatus,
  styleImageNegativePrompt,
  validateStyleImageKind,
} from '../lib/style-image.js';
import {
  createStyleImageSignedUrl,
  persistStyleImage,
} from '../lib/style-image-storage.js';

const SAFE_STYLE_IMAGE_FAILURE_CODES = new Set([
  'style_image_configuration_failed',
  'style_image_request_build_failed',
  'style_image_job_claim_failed',
  'style_image_model_request_failed',
  'style_image_model_rejected',
  'style_image_response_parse_failed',
  'style_image_result_extract_failed',
  'style_image_provider_task_write_failed',
  'style_image_storage_failed',
  'style_image_job_complete_failed',
  'style_image_sign_failed',
  'style_image_job_timeout',
  'style_image_handler_failed',
]);

class StyleImageStageError extends Error {
  constructor(diagnosticCode, options = {}) {
    super(diagnosticCode, options);
    this.name = 'StyleImageStageError';
    this.diagnosticCode = diagnosticCode;
  }
}

function styleImageStageError(code, cause) {
  if (cause instanceof StyleImageStageError) return cause;
  return new StyleImageStageError(code, { cause });
}

async function runStyleImageStage(code, operation) {
  try {
    return await operation();
  } catch (error) {
    throw styleImageStageError(code, error);
  }
}

async function requireJobWrite(operation) {
  const result = await operation();
  if (result !== true) throw new Error('Style image job state was not updated');
  return result;
}

export function classifyStyleImageFailure(error) {
  return SAFE_STYLE_IMAGE_FAILURE_CODES.has(error?.diagnosticCode)
    ? error.diagnosticCode
    : 'style_image_handler_failed';
}

function styleImageOwnerId(codeHash, requestId, kind) {
  const hex = createHash('sha256').update(`${codeHash}:${requestId}:${kind}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function providerConfig(env = process.env) {
  const baseUrl = env.IMAGE_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl || !env.API_KEY) {
    throw new StyleImageStageError('style_image_configuration_failed');
  }
  return {
    apiKey: env.API_KEY,
    endpoint: `${baseUrl}/services/aigc/multimodal-generation/generation`,
    tasksEndpoint: `${baseUrl}/tasks`,
    model: env.IMAGE_MODEL_NAME || 'qwen-image-edit-max',
  };
}

export function buildImageEditorRequest({ imageBase64, kind, analysis }, env = process.env) {
  try {
    const config = providerConfig(env);
    return {
      endpoint: config.endpoint,
      options: {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: config.model,
          input: {
            messages: [{
              role: 'user',
              content: [
                { image: imageBase64 },
                { text: buildStyleImagePrompt(kind, analysis) },
              ],
            }],
          },
          parameters: {
            n: 1,
            size: '960*1280',
            prompt_extend: true,
            watermark: false,
            negative_prompt: styleImageNegativePrompt(),
          },
        }),
      },
    };
  } catch (error) {
    throw styleImageStageError('style_image_request_build_failed', error);
  }
}

async function requestJson(endpoint, options, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    let response;
    try {
      response = await fetchImpl(endpoint, { ...options, signal: controller.signal });
    } catch (error) {
      throw styleImageStageError('style_image_model_request_failed', error);
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw styleImageStageError('style_image_response_parse_failed', error);
    }
    if (!response.ok) throw new StyleImageStageError('style_image_model_rejected');
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function validImage(imageBase64) {
  return typeof imageBase64 === 'string'
    && /^data:image\/(?:jpeg|png|webp);base64,/i.test(imageBase64)
    && imageBase64.length <= 4_000_000;
}

export function createStyleImageHandler(dependencies = {}) {
  const fetchImpl = dependencies.fetchImpl || globalThis.fetch;
  const claimJob = dependencies.claimJob || claimStyleImageJob;
  const beginSubmission = dependencies.beginSubmission || beginStyleImageProviderSubmission;
  const saveProviderTask = dependencies.saveProviderTask || saveStyleImageProviderTask;
  const completeJob = dependencies.completeJob || completeStyleImageJob;
  const failJob = dependencies.failJob || failStyleImageJob;
  const persistImage = dependencies.persistImage || persistStyleImage;
  const signImage = dependencies.signImage || createStyleImageSignedUrl;
  const env = dependencies.env || process.env;

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: '仅支持POST请求' });
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
        authorization.codeHash, requestId, kind, ownerId, retry === true,
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

      const config = providerConfig(env);
      let providerTaskId = job.providerTaskId;
      if (!providerTaskId) {
        if (job.stage === 'submitting') {
          return res.status(202).json({ kind, status: 'processing' });
        }
        if (!validImage(imageBase64)) {
          return res.status(400).json({ error: '请上传有效且大小合适的照片' });
        }
        const request = buildImageEditorRequest({ imageBase64, kind, analysis: trustedAnalysis }, env);
        const acquired = await runStyleImageStage(
          'style_image_provider_task_write_failed',
          () => beginSubmission(authorization.codeHash, requestId, kind, ownerId),
        );
        if (acquired !== true) {
          return res.status(202).json({ kind, status: 'processing' });
        }
        try {
          const payload = await requestJson(request.endpoint, request.options, fetchImpl);
          providerTaskId = extractStyleImageTaskId(payload);
          await runStyleImageStage(
            'style_image_provider_task_write_failed',
            () => requireJobWrite(() => saveProviderTask(
              authorization.codeHash, requestId, kind, ownerId, providerTaskId,
            )),
          );
          return res.status(202).json({ kind, status: 'processing' });
        } catch (error) {
          const diagnosticCode = classifyStyleImageFailure(error);
          if (diagnosticCode === 'style_image_model_rejected') {
            await failJob(authorization.codeHash, requestId, kind, ownerId, diagnosticCode).catch(() => {});
          }
          throw error;
        }
      }

      const payload = await requestJson(
        `${config.tasksEndpoint}/${encodeURIComponent(providerTaskId)}`,
        { headers: { Authorization: `Bearer ${config.apiKey}` } },
        fetchImpl,
      );
      const providerStatus = normalizeStyleImageTaskStatus(payload);
      if (providerStatus === 'pending' || providerStatus === 'running' || providerStatus === 'unknown') {
        return res.status(202).json({ kind, status: 'processing' });
      }
      if (providerStatus === 'failed' || providerStatus === 'canceled') {
        const diagnosticCode = 'style_image_model_rejected';
        await failJob(authorization.codeHash, requestId, kind, ownerId, diagnosticCode).catch(() => {});
        return res.status(409).json({ kind, status: 'failed', diagnosticCode });
      }

      const sourceUrl = await runStyleImageStage(
        'style_image_result_extract_failed',
        async () => extractGeneratedImageUrl(payload),
      );
      const resultPath = await runStyleImageStage(
        'style_image_storage_failed',
        () => persistImage({ sourceUrl, codeHash: authorization.codeHash, requestId, kind }),
      );
      await runStyleImageStage(
        'style_image_job_complete_failed',
        () => requireJobWrite(() => completeJob(
          authorization.codeHash, requestId, kind, ownerId, resultPath,
        )),
      );
      const imageUrl = await runStyleImageStage('style_image_sign_failed', () => signImage(resultPath));
      return res.status(200).json({ kind, status: 'completed', reused: false, imageUrl });
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
