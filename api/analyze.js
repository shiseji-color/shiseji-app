import OpenAI from 'openai';

// 初始化大模型客户端（对接阿里云百炼）
const openai = new OpenAI({
  apiKey: process.env.API_KEY, // 后续在Vercel填你的API Key
  baseURL: process.env.BASE_URL, // 阿里云兼容地址
});

export default async function handler(req, res) {
  // 只接受POST请求
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: '请上传照片' });

    // 色彩诊断核心指令
    const systemPrompt = `你是15年经验的韩国顶级色彩诊断师，分析用户照片后仅返回标准JSON，字段包含：
    season_name(四季型名称)、season_en(英文)、description(特征描述)、
    feature_colors(肌肤/面颊/发色/瞳孔HEX)、radar_data(五维数据)、
    best_colors(最佳配色)、makeup_advice(彩妆建议)、outfit_advice(穿搭)、
    accessory_advice(饰品)、celebrity_reference(明星参考)、avoid_colors(避坑色)。
    无多余文字、无Markdown、无注释。`;

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
    let text = response.choices[0].message.content.trim();
    text = text.replace(/^```json/, '').replace(/```$/, '');
    const data = JSON.parse(text);
    res.json(data);

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '色彩诊断失败，请重试' });
  }
}