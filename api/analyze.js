import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.API_KEY, 
  baseURL: process.env.BASE_URL, 
});

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  try {
    const { imageBase64 } = JSON.parse(event.body);
    if (!imageBase64) return { statusCode: 200, headers, body: JSON.stringify({ error: '请上传照片' }) };

    // 【核弹级防线】强制二选一
    const systemPrompt = `你是一个极其严格的安检员兼色彩诊断师。请严格按顺序执行：
    第一步：安检图片。图片里是否有清晰的【真实人类脸部】？（窗帘、水杯、衣物、风景、卡通等一律算没有！）
    第二步：如果【没有】人脸，停止一切分析！【必须且只能】输出这一个JSON：
    {"error": "亲爱的，系统没有检测到清晰的人脸哦~ 请上传一张清晰的正面无滤镜照片。"}
    第三步：如果【有】清晰人脸，再输出完整的色彩分析JSON（包含 season_name, feature_colors 等字段）。
    
    【致命警告】：绝对不准给窗帘、杯子等物品编造色彩数据！`;

    const response = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen-vl-max',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [{ type: 'text', text: '请先严格判断是否有人脸！如果没有，只返回带 error 的 JSON！' }, { type: 'image_url', image_url: { url: imageBase64 } }] }
      ],
      max_tokens: 2000,
      temperature: 0.01 // 极度死板
    });

    let text = response.choices[0].message.content.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const data = JSON.parse(text);

    // 【核心修改】：就算报错，也给前端返回 200 状态码，这样前端就不会触发假数据了！
    if (data.error) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: data.error }) };
    }
    
    // 正常返回数据
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (e) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'AI 大脑暂时走神了，请稍后再试' }) };
  }
};
