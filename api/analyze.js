import OpenAI from 'openai';
import {
  analysisFailureError,
  runAnalysisStage,
  runModelCall,
  safelyClassifyAnalysisFailure,
} from '../lib/analysis-error.js';
import { parseAnalysisResult } from '../lib/analysis-result.js';
import {
  consumeActivationUse,
  refundActivationUse,
} from '../lib/activation-store.js';
import { createVisualToken, verifyAnalysisToken } from '../lib/analysis-token.js';
import { enforceInteractiveAnalysisRateLimit } from '../lib/rate-limit.js';
import {
  frameworkPromptReference,
} from '../lib/color-framework.js';

export function createModelClient(factory = (options) => new OpenAI(options)) {
  return runAnalysisStage('model_request_build_failed', () => factory({
    apiKey: process.env.API_KEY,
    baseURL: process.env.BASE_URL,
  }));
}

function backgroundDiagnostic(req, code) {
  return req.backgroundMode === true ? { diagnosticCode: code } : {};
}

async function handleAnalysisRequest(req, res, setFailureCode) {
  setFailureCode('analysis_handler_setup_failed');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '仅支持POST请求' });
  }

  try {
    enforceInteractiveAnalysisRateLimit(req);
  } catch (error) {
    res.setHeader('Retry-After', String(error.retryAfter));
    return res.status(429).json({ error: error.message });
  }

  let consumedCodeHash = null;
  let consumedRequestId = null;
  let fallbackFailureCode = 'background_payload_invalid';

  setFailureCode('analysis_handler_processing_failed');
  try {
    const { imageBase64, analysisToken, requestId } = req.body ?? {};
    let codeHash;
    try {
      codeHash = verifyAnalysisToken(analysisToken);
    } catch {
      return res.status(403).json({
        error: '授权已过期，请重新验证激活码',
        ...backgroundDiagnostic(req, 'background_payload_invalid'),
      });
    }

    if (
      typeof requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
    ) {
      return res.status(400).json({
        error: '请求标识无效，请重新发起分析',
        ...backgroundDiagnostic(req, 'background_payload_invalid'),
      });
    }

    if (
      typeof imageBase64 !== 'string' ||
      !/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageBase64)
    ) {
      return res.status(400).json({
        error: '请上传有效照片',
        ...backgroundDiagnostic(req, 'photo_download_failed'),
      });
    }

    if (imageBase64.length > 4_000_000) {
      return res.status(413).json({
        error: '照片过大，请压缩后重试',
        ...backgroundDiagnostic(req, 'photo_download_failed'),
      });
    }

    const backgroundMode = req.backgroundMode === true;
    let remainingUses = null;
    const consumption = backgroundMode ? { remainingUses: null, alreadyProcessed: false }
      : await consumeActivationUse(codeHash, requestId);
    if (!backgroundMode) {
      consumedCodeHash = codeHash;
      consumedRequestId = requestId;
    }

    if (consumption === null) {
      consumedCodeHash = null;
      consumedRequestId = null;
      return res.status(403).json({
        error: '激活码无效或可用次数已用完',
        ...backgroundDiagnostic(req, 'background_handler_failed'),
      });
    }

    remainingUses = consumption.remainingUses;
    if (consumption.alreadyProcessed) {
      consumedCodeHash = null;
      consumedRequestId = null;
      return res.status(409).json({
        error: '该分析请求已处理，请勿重复提交',
        remainingUses,
        ...backgroundDiagnostic(req, 'background_handler_failed'),
      });
    }

    fallbackFailureCode = 'model_request_build_failed';
    // 色彩诊断核心指令：保留成熟版的人脸质量检查和十六型分析。
    const systemPrompt = runAnalysisStage('model_request_build_failed', () => `你是一名拥有15年经验的专业个人色彩诊断师。

先检查照片质量：
1. 照片必须只有一张清晰可见的人脸；多人、无人脸、非真人或翻拍屏幕必须拒绝。
2. 医用口罩、深色墨镜、大面积遮挡、重度磨皮或明显改变肤色的滤镜必须拒绝。
3. 可以接受透明近视眼镜、普通帽子和轻妆，但面颊、鼻部及下颌肤色必须清晰可见。

不符合要求时，只返回标准JSON：
{
  "season_name": "无法完成诊断",
  "season_en": "PHOTO_NOT_ELIGIBLE",
  "identity_code": "PHOTO_NOT_ELIGIBLE",
  "description": "请上传自然光下、单人正面、无遮挡且无重度滤镜的清晰照片。",
  "style_keywords": [],
  "color_impression": "",
  "feature_colors": [],
  "radar_data": [],
  "dimension_data": [],
  "best_colors": [],
  "makeup_advice": "",
  "outfit_advice": "",
  "accessory_advice": "",
  "style_reference": "",
  "avoid_colors": []
}

照片合格时，只基于照片中可见的肤色、面颊、原生发色和瞳孔特征完成16维观察。每个value必须严格遵循下方0与100的方向定义；看不清的特征取50并在observation中说明不确定性。不得臆测种族、健康、性格、职业或社会身份，不得使用“官方认证”“医学检测”或保证准确率的表述。最终色彩身份、推荐色、避坑色和固定建议由服务端规则知识库判定，不得返回这些字段。特征色必须提供4个，16维观察必须按给定key顺序完整提供。

${frameworkPromptReference()}

只返回标准JSON，结构必须为：
{
  "description": "诊断特征说明",
  "color_impression": "一句具有画面感、但不夸大效果的专属色彩印象",
  "feature_colors": [
    {"label": "肌肤底色", "hex": "#RRGGBB"},
    {"label": "面颊色调", "hex": "#RRGGBB"},
    {"label": "原生发色", "hex": "#RRGGBB"},
    {"label": "瞳孔特征", "hex": "#RRGGBB"}
  ],
  "dimension_data": [
    {"key": "skin_temperature", "name": "肤色冷暖倾向", "value": 0, "observation": "一句克制、可理解的观察"},
    {"key": "skin_lightness", "name": "肤色明度", "value": 0, "observation": "一句观察"},
    {"key": "skin_clarity", "name": "肤色清透度", "value": 0, "observation": "一句观察"},
    {"key": "skin_softness", "name": "肤色柔和度", "value": 0, "observation": "一句观察"},
    {"key": "cheek_temperature", "name": "面颊色调", "value": 0, "observation": "一句观察"},
    {"key": "lip_temperature", "name": "原生唇色倾向", "value": 0, "observation": "一句观察"},
    {"key": "eye_depth", "name": "瞳孔深浅", "value": 0, "observation": "一句观察"},
    {"key": "eye_clarity", "name": "瞳孔清晰度", "value": 0, "observation": "一句观察"},
    {"key": "hair_depth", "name": "原生发色深浅", "value": 0, "observation": "一句观察"},
    {"key": "hair_temperature", "name": "原生发色冷暖", "value": 0, "observation": "一句观察"},
    {"key": "hair_skin_contrast", "name": "发肤对比度", "value": 0, "observation": "一句观察"},
    {"key": "facial_contrast", "name": "五官整体对比度", "value": 0, "observation": "一句观察"},
    {"key": "depth_capacity", "name": "深色承载力", "value": 0, "observation": "一句观察"},
    {"key": "brightness_capacity", "name": "明亮色承载力", "value": 0, "observation": "一句观察"},
    {"key": "chroma_capacity", "name": "鲜艳色承载力", "value": 0, "observation": "一句观察"},
    {"key": "muted_capacity", "name": "柔雾色适配度", "value": 0, "observation": "一句观察"}
  ]
}

不得返回Markdown代码块、注释或JSON以外的任何文字。`);

    // 调用阿里云百炼多模态模型
    const openai = createModelClient();
    const modelRequest = runAnalysisStage('model_request_build_failed', () => ({
      model: process.env.MODEL_NAME || 'qwen-vl-max',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: '分析这张照片并返回JSON' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ],
      max_tokens: 3200,
      temperature: 0.1
    }));
    fallbackFailureCode = 'model_request_failed';
    const response = await runModelCall(() => openai.chat.completions.create(
      modelRequest,
      { timeout: 45_000 },
    ));

    // 处理AI返回结果
    const responseContent = runAnalysisStage(
      'model_response_extract_failed',
      () => response.choices?.[0]?.message?.content,
    );
    const data = parseAnalysisResult(responseContent);

    if (!backgroundMode && data.season_en === 'PHOTO_NOT_ELIGIBLE') {
      const refundedUses = await refundActivationUse(codeHash, requestId);
      if (refundedUses !== null) remainingUses = refundedUses;
      consumedCodeHash = null;
      consumedRequestId = null;
    }

    const visualToken = data.season_en === 'PHOTO_NOT_ELIGIBLE' || backgroundMode
      ? null
      : createVisualToken(codeHash, requestId, data);
    return runAnalysisStage(
      'analysis_handler_success_response_failed',
      () => res.status(200).json({ data, remainingUses, visualToken, requestId }),
    );

  } catch (e) {
    setFailureCode('analysis_failure_classification_failed');
    const classified = safelyClassifyAnalysisFailure(
      e,
      'analysis_failure_classification_failed',
    );
    const failureCode = classified === 'analysis_failed'
      ? fallbackFailureCode
      : classified;
    setFailureCode('analysis_failure_logging_failed');
    try {
      console.error('Color analysis failed:', failureCode);
    } catch {
      // Logging must never replace the fixed diagnostic returned to the worker.
    }

    setFailureCode('analysis_failure_refund_failed');
    if (!req.backgroundMode && consumedCodeHash && consumedRequestId) {
      try {
        await refundActivationUse(consumedCodeHash, consumedRequestId);
      } catch {
        try {
          console.error('Activation use refund failed:', 'activation_refund_failed');
        } catch {
          // Logging must not turn a handled failure into a handler rejection.
        }
      }
    }

    setFailureCode('analysis_failure_response_failed');
    try {
      return res.status(502).json({
        error: '色彩诊断失败，系统已尝试退回本次次数，请重试',
        ...(req.backgroundMode ? { diagnosticCode: failureCode } : {}),
      });
    } catch {
      throw analysisFailureError('analysis_failure_response_failed');
    }
  }
}

export function createAnalysisHandler(operation = handleAnalysisRequest) {
  return async function boundedAnalysisHandler(req, res) {
    let failureCode = 'analysis_handler_setup_failed';
    try {
      return await operation(req, res, (code) => { failureCode = code; });
    } catch {
      throw analysisFailureError(failureCode);
    }
  };
}

export async function analyzeBackgroundInput(body) {
  let statusCode = 200;
  let payload;
  const response = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return response;
    },
    json(value) {
      payload = value;
      return response;
    },
  };

  await createAnalysisHandler()({
    method: 'POST',
    headers: {},
    body,
    backgroundMode: true,
  }, response);

  if (statusCode >= 400) {
    const code = payload?.diagnosticCode;
    throw analysisFailureError(
      code && code !== 'analysis_failed'
        ? code
        : code === 'analysis_failed'
          ? 'analysis_handler_reported_failure'
          : 'analysis_diagnostic_missing',
    );
  }
  if (!payload || !Object.hasOwn(payload, 'data')) {
    throw analysisFailureError('analysis_handler_response_invalid');
  }
  return payload.data;
}

export default createAnalysisHandler();
