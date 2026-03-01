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

    // 【全新逻辑】强制 AI 先做判断题，再做填空题
    const systemPrompt = `你是一个专业的色彩诊断AI。请严格按照以下JSON结构返回：
    {
      "is_human": true或者false,
      "season_name": "...",
      "season_en": "...",
      "description": "...",
      "feature_colors": ["#...", "#...", "#...", "#..."],
      "radar_data": [80, 70, 60, 90, 85],
      "best_colors": ["#...", "#...", "#..."],
      "makeup_advice": "...",
      "outfit_advice": "...",
      "accessory_advice": "...",
      "celebrity_reference": "...",
      "avoid_colors": ["#...", "#..."]
    }

    【最高判定规则】：
    如果图片是一个清晰的真实人类面部，"is_human"必须为true，并认真填写色彩测算字段。
    如果图片是衣服、水杯、鼠标、风景等非人类主体，"is_human"必须为false！并且其他所有字段随便填即可，不要去分析它！`;

    const response = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen-vl-max',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: [{ type: 'text', text: '请分析图片并严格返回JSON' }, { type: 'image_url', image_url: { url: imageBase64 } }] }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    let text = response.choices[0].message.content.trim().replace(/^```json/, '').replace(/```$/, '').trim();
    const data = JSON.parse(text);

    // 🐎 【木马策略启动】：如果AI判定不是人，我们伪造一份数据骗过前端！
    if (data.is_human === false) {
       data.season_name = "⚠️ 未检测到人脸";
       data.season_en = "No Face Detected";
       data.description = "亲爱的，系统没有检测到清晰的人脸哦~ 您的算力额度非常宝贵，为了保证测算结果的极致精准，请您上传一张能清晰展现面部五官的正面自拍照片！";
       // 塞入兜底假数据防止前端崩溃
       data.feature_colors = ["#EEEEEE", "#EEEEEE", "#EEEEEE", "#EEEEEE"];
       data.radar_data = [10, 10, 10, 10, 10];
       data.best_colors = [];
       data.makeup_advice = "请上传人脸后查看";
       data.outfit_advice = "请上传人脸后查看";
       data.accessory_advice = "请上传人脸后查看";
       data.celebrity_reference = "无";
       data.avoid_colors = [];
    }

    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (e) {
    console.error(e);
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'AI 大脑暂时走神了，请稍后再试' }) };
  }
};
