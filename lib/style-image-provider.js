import {
  buildStyleImagePrompt,
  styleImageNegativePrompt,
} from './style-image.js';

export const STYLE_IMAGE_PROVIDER_TIMEOUT_MS = 240_000;

const SAFE_STYLE_IMAGE_FAILURE_CODES = new Set([
  'style_image_configuration_failed',
  'style_image_request_build_failed',
  'style_image_job_claim_failed',
  'style_image_queue_dispatch_failed',
  'style_image_photo_download_failed',
  'style_image_model_timeout',
  'style_image_model_request_failed',
  'style_image_model_rejected',
  'style_image_response_parse_failed',
  'style_image_result_extract_failed',
  'style_image_provider_result_write_failed',
  'style_image_storage_failed',
  'style_image_job_complete_failed',
  'style_image_sign_failed',
  'style_image_job_timeout',
  'style_image_queue_timeout',
  'style_image_submission_unknown',
  'style_image_handler_failed',
]);

export class StyleImageStageError extends Error {
  constructor(diagnosticCode, options = {}) {
    super(diagnosticCode, options);
    this.name = 'StyleImageStageError';
    this.diagnosticCode = diagnosticCode;
  }
}

export function styleImageStageError(code, cause) {
  if (cause instanceof StyleImageStageError) return cause;
  return new StyleImageStageError(code, { cause });
}

export async function runStyleImageStage(code, operation) {
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

function providerConfig(env = process.env) {
  const baseUrl = env.IMAGE_BASE_URL?.replace(/\/$/, '');
  if (!baseUrl || !env.API_KEY) {
    throw new StyleImageStageError('style_image_configuration_failed');
  }
  return {
    apiKey: env.API_KEY,
    endpoint: `${baseUrl}/services/aigc/multimodal-generation/generation`,
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

export async function requestStyleImageJson(endpoint, options, fetchImpl = globalThis.fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STYLE_IMAGE_PROVIDER_TIMEOUT_MS);
  try {
    let response;
    try {
      response = await fetchImpl(endpoint, { ...options, signal: controller.signal });
    } catch (error) {
      const code = controller.signal.aborted || error?.name === 'AbortError'
        ? 'style_image_model_timeout'
        : 'style_image_model_request_failed';
      throw styleImageStageError(code, error);
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
