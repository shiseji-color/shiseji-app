import OpenAI from 'openai';
import {
  consumeActivationUse,
  hashActivationCode,
  isActivationCodeFormatValid,
  normalizeActivationCode,
  refundActivationUse,
} from '../lib/activation-store.js';

// 初始化大模型客户端（对接阿里云百炼）
const openai = new OpenAI({
  apiKey: process.env.API_KEY, // 后续在Vercel填你的API Key
  baseURL: process.env.BASE_URL, // 阿里云兼容地址
});

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: '仅支持POST请求' });
  }

  let consumedCodeHash = null;

  try {
    const { imageBase64, activationCode } = req.body ?? {};
    const code = normalizeActivationCode(activationCode);

    if (!isActivationCodeFormatValid(code)) {
      return res.status(400).json({ error: '激活码格式不正确' });
    }

    if (
      typeof imageBase64 !== 'string' ||
      !/^data:image\/(?:jpeg|png|webp);base64,/i.test(imageBase64)
    ) {
      return res.status(400).json({ error: '请上传有效照片' });
    }

    if (imageBase64.length > 4_000_000) {
      return res.status(413).json({ error: '照片过大，请压缩后重试' });
    }

    consumedCodeHash = hashActivationCode(code);
    const remainingUses = await consumeActivationUse(consumedCodeHash);

    if (remainingUses === null) {
      consumedCodeHash = null;
      return res.status(403).json({ error: '激活码无效或可用次数已用完' });
    }

    // 色彩诊断核心指令：保留成熟版的人脸质量检查和十六型分析。
    const systemPrompt = `你是一名拥有15年经验的专业个人色彩诊断师。

先检查照片质量：
1. 照片必须只有一张清晰可见的人脸；多人、无人脸、非真人或翻拍屏幕必须拒绝。
2. 医用口罩、深色墨镜、大面积遮挡、重度磨皮或明显改变肤色的滤镜必须拒绝。
3. 可以接受透明近视眼镜、普通帽子和轻妆，但面颊、鼻部及下颌肤色必须清晰可见。

不符合要求时，只返回标准JSON：
{
  "season_name": "无法完成诊断",
  "season_en": "PHOTO_NOT_ELIGIBLE",
  "description": "请上传自然光下、单人正面、无遮挡且无重度滤镜的清晰照片。",
  "feature_colors": [],
  "radar_data": [],
  "best_colors": [],
  "makeup_advice": "",
  "outfit_advice": "",
  "accessory_advice": "",
  "celebrity_reference": "",
  "avoid_colors": []
}

照片合格时，基于真实肤色、面颊、原生发色和瞳孔特征，完成十六型个人色彩诊断。只返回标准JSON，结构必须为：
{
  "season_name": "中文季型名称",
  "season_en": "英文季型名称",
  "description": "诊断特征说明",
  "feature_colors": [
    {"label": "肌肤底色", "hex": "#RRGGBB"},
    {"label": "面颊色调", "hex": "#RRGGBB"},
    {"label": "原生发色", "hex": "#RRGGBB"},
    {"label": "瞳孔特征", "hex": "#RRGGBB"}
  ],
  "radar_data": [
    {"name": "冷暖", "value": 0},
    {"name": "明度", "value": 0},
    {"name": "纯度", "value": 0},
    {"name": "柔和度", "value": 0},
    {"name": "对比度", "value": 0}
  ],
  "best_colors": [{"name": "颜色名称", "hex": "#RRGGBB"}],
  "makeup_advice": "彩妆建议",
  "outfit_advice": "穿搭建议",
  "accessory_advice": "饰品建议",
  "celebrity_reference": "明星参考",
  "avoid_colors": ["避坑色名称"]
}

不得返回Markdown代码块、注释或JSON以外的任何文字。`;

    // 调用阿里云百炼多模态模型
    const response = await openai.chat.completions.create({
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
      max_tokens: 2000,
      temperature: 0.1
    });

    // 处理AI返回结果
    let text = response.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('AI返回内容为空');

    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const data = JSON.parse(text);

    return res.status(200).json({ data, remainingUses });

  } catch (e) {
    console.error('Color analysis failed:', e);

    if (consumedCodeHash) {
      try {
        await refundActivationUse(consumedCodeHash);
      } catch (refundError) {
        console.error('Activation use refund failed:', refundError);
      }
    }

    return res.status(502).json({ error: '色彩诊断失败，系统已尝试退回本次次数，请重试' });
  }
}
