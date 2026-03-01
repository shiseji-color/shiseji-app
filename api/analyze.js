import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY, 
  baseURL: process.env.BASE_URL, 
});

// Netlify 专属的 (event) 语法
export const handler = async (event) => {
  // 跨域通行证
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { imageBase64 } = JSON.parse(event.body);
    if (!imageBase64) return { statusCode: 400, headers, body: JSON.stringify({ error: '请上传照片' }) };

    // 【终极保安指令】
    const systemPrompt = `你是一个极其严格的视觉审核员兼顶级色彩诊断师。
    【第一步：活体检测】如果是风景、物品（如水杯、键盘）、动物等非真实人脸，必须且只能输出JSON：{"error": "亲爱的，系统没有检测到清晰的人脸哦~ 请上传一张清晰的正面无滤镜照片。"}
    【第二步：如果是真人】输出色彩分析JSON包含：season_name, season_en, description, feature_colors, radar_data, best_colors, makeup_advice, outfit_advice, accessory_advice, celebrity_reference, avoid_colors。`;

    const response = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen-vl-max',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [{ type: 'text', text: '严格判断并输出JSON' }, { type: 'image_url', image_url: { url: imageBase64 } }] }
      ],
      max_tokens: 2000,
      temperature: 0.01 // 极度死板，杜绝胡编乱造
    });

    let text = response.choices[0].message.content.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const data = JSON.parse(text);

    if (data.error) return { statusCode: 400, headers, body: JSON.stringify({ error: data.error }) };
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'AI 大脑暂时走神了，请稍后再试' }) };
  }
};
