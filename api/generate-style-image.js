import { randomUUID } from 'node:crypto';
import { applyIdentityKnowledge } from '../lib/color-framework.js';
import {
  claimStyleImageJob,
  completeStyleImageJob,
  failStyleImageJob,
} from '../lib/activation-store.js';
import { validateAnalysisResult } from '../lib/analysis-schema.js';
import { verifyVisualToken } from '../lib/analysis-token.js';
import { enforceRateLimit } from '../lib/rate-limit.js';
import {
  buildStyleImagePrompt,
  extractGeneratedImageUrl,
  styleImageNegativePrompt,
  validateStyleImageKind,
} from '../lib/style-image.js';
import { runStyleImageJob } from '../lib/style-image-job.js';

const MAX_GENERATED_IMAGE_BYTES = 5_500_000;
const SAFE_STYLE_IMAGE_FAILURE_CODES = new Set([
  'style_image_configuration_failed',
  'style_image_request_build_failed',
  'style_image_job_claim_failed',
  'style_image_model_request_failed',
  'style_image_model_rejected',
  'style_image_response_parse_failed',
  'style_image_result_extract_failed',
  'style_image_job_complete_failed',
  'style_image_download_failed',
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

export function classifyStyleImageFailure(error) {
  return SAFE_STYLE_IMAGE_FAILURE_CODES.has(error?.diagnosticCode)
    ? error.diagnosticCode
    : 'style_image_handler_failed';
}

function imageApiEndpoint() {
  const baseUrl = process.env.IMAGE_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl || !process.env.API_KEY) {
    throw new StyleImageStageError('style_image_configuration_failed');
  }
  return `${baseUrl}/services/aigc/multimodal-generation/generation`;
}

export function buildImageEditorRequest({ imageBase64, kind, analysis }) {
  try {
    return {
      endpoint: imageApiEndpoint(),
      options: {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.IMAGE_MODEL_NAME || 'qwen-image-edit-max',
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

async function callImageEditor({ endpoint, options }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    let response;
    try {
      response = await fetch(endpoint, { ...options, signal: controller.signal });
    } catch (error) {
      throw styleImageStageError('style_image_model_request_failed', error);
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw styleImageStageError('style_image_response_parse_failed', error);
    }
    if (!response.ok) {
      const error = new StyleImageStageError('style_image_model_rejected');
      error.retryGeneration = response.status >= 400 && response.status < 500;
      throw error;
    }
    try {
      return extractGeneratedImageUrl(payload);
    } catch (error) {
      throw styleImageStageError('style_image_result_extract_failed', error);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadAsDataUrl(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error('Unable to download generated image');
  const contentType = response.headers.get('content-type') || 'image/png';
  if (!/^image\/(?:png|jpeg|webp)$/i.test(contentType)) {
    throw new Error('Generated asset has an unsupported content type');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_GENERATED_IMAGE_BYTES) {
    throw new Error('Generated image is empty or too large');
  }
  return `data:${contentType};base64,${bytes.toString('base64')}`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '仅支持POST请求' });
  }

  try {
    enforceRateLimit(req, 'generate-style-image', { limit: 12, windowMs: 60_000 });
  } catch (error) {
    res.setHeader('Retry-After', String(error.retryAfter));
    return res.status(429).json({ error: error.message });
  }

  try {
    const { imageBase64, visualToken, requestId, analysis, kind } = req.body ?? {};
    try {
      var visualAuthorization = verifyVisualToken(visualToken, requestId, analysis);
    } catch {
      return res.status(403).json({ error: '造型生成授权无效或已过期，请重新完成分析' });
    }
    validateStyleImageKind(kind);
    if (
      typeof imageBase64 !== 'string' ||
      !/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageBase64) ||
      imageBase64.length > 4_000_000
    ) {
      return res.status(400).json({ error: '请上传有效且大小合适的照片' });
    }

    const validated = validateAnalysisResult(analysis);
    if (validated.season_en === 'PHOTO_NOT_ELIGIBLE') {
      return res.status(400).json({ error: '当前照片不适合生成个性化造型' });
    }
    const trustedAnalysis = applyIdentityKnowledge(validated);
    // Complete all configuration, prompt and JSON work before claiming a job.
    // A deterministic preflight failure must never strand an unpaid job in processing.
    const imageRequest = buildImageEditorRequest({ imageBase64, kind, analysis: trustedAnalysis });
    const ownerId = randomUUID();
    const job = await runStyleImageJob({
      claim: () => runStyleImageStage('style_image_job_claim_failed', () => claimStyleImageJob(
        visualAuthorization.codeHash, requestId, kind, ownerId,
      )),
      generate: () => callImageEditor(imageRequest),
      complete: (resultUrl) => runStyleImageStage(
        'style_image_job_complete_failed',
        () => completeStyleImageJob(requestId, kind, ownerId, resultUrl),
      ),
      fail: () => failStyleImageJob(requestId, kind, ownerId),
    });
    if (job.status === 'processing') {
      return res.status(202).json({ kind, status: 'processing' });
    }
    const imageDataUrl = await runStyleImageStage(
      'style_image_download_failed',
      () => downloadAsDataUrl(job.resultUrl),
    );
    return res.status(200).json({ kind, status: 'completed', reused: job.reused, imageDataUrl });
  } catch (error) {
    const diagnosticCode = classifyStyleImageFailure(error);
    console.error('Personalized style image generation failed:', diagnosticCode);
    return res.status(502).json({
      error: '专属造型图暂时生成失败，请稍后重试',
      diagnosticCode,
    });
  }
}
