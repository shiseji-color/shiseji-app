import OpenAI from 'openai';

// 初始化大模型客户端（对接阿里云百炼）
const openai = new OpenAI({
  apiKey: process.env.API_KEY, 
  baseURL: process.env.BASE_URL, 
});

export default async function handler(req, res) {
  // 只接受POST请求
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: '请上传照片' });

    // 【升级版】色彩诊断核心指令（加入了顶级风控保安）
    const systemPrompt = `你是15年经验的韩国顶级色彩诊断师。
    
    【极其重要：前置风控检测】
    请首先仔细检查用户上传的照片中，是否包含清晰的“真实人类面部”。
    如果照片中【没有检测到人脸】或者是【风景、物品、动物、卡通插画等非人类主体】：
    请务必立刻停止分析，并仅返回如下严格的JSON格式（不要带任何其他字段）：
    {
      "error": "亲爱的，系统没有检测到清晰的人脸哦~ 为了保证测算结果的极致精准，请您上传一张能清晰展现面部五官和真实肤色的正面无滤镜照片。"
    }

    如果照片中【检测到了人脸】：
    请开始你的专业色彩诊断，分析照片后仅返回标准JSON，字段必须包含：
    season_name(四季型名称)、season_en(英文)、description(特征描述)、
    feature_colors(肌肤/面颊/发色/瞳孔HEX)、radar_data(五维数据)、
    best_colors(最佳配色)、makeup_advice(彩妆建议)、outfit_advice(穿搭)、
    accessory_advice(饰品)、celebrity_reference(明星参考)、avoid_colors(避坑色)。
    
    【输出要求】：无论是报错还是正常分析，都必须只输出纯JSON对象。无多余文字、无Markdown格式标记(如\`\`\`json)、无注释。`;

    // 调用阿里云百炼多模态模型
    const response = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen-vl-max',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请分析这张照片并严格按照要求返回JSON' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1 // 保持低温度，让AI像机器一样严谨
    });

    // 处理AI返回结果
    let text = response.choices[0].message.content.trim();
    // 强力清洗AI可能带上的代码块标记
    text = text.replace(/^```json/, '').replace(/```$/, '').trim();
    
    const data = JSON.parse(text);

    // 【新增拦截逻辑】：如果AI返回了错误说明（说明没检测到人脸），直接抛给前端报错提示
    if (data.error) {
      return res.status(400).json({ error: data.error });
    }

    // 正常返回测算数据
    res.json(data);

  } catch (e) {
    console.error('诊断接口异常:', e);
    res.status(500).json({ error: 'AI 大脑正在开小差，请稍后再试或换一张照片哦~' });
  }
}
