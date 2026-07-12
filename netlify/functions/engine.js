import OpenAI from 'openai';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'shiseji_core_matrix_2026';

function verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const validSign = crypto.createHmac('sha256', JWT_SECRET).update(parts[0] + "." + parts[1]).digest('base64url');
    if (validSign !== parts[2]) return null; 
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null; 
    
    return payload;
}

export const handler = async (event, context) => {
    const headers = { 
        "Access-Control-Allow-Origin": "*", 
        "Access-Control-Allow-Headers": "Content-Type, Authorization", 
        "Content-Type": "application/json" 
    };
    if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "OK" };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'CTO: 非法请求拦截' }) };

    // 零信任验签
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { statusCode: 401, headers, body: JSON.stringify({ error: '⛔ 权限拦截：未携带高定通行证' }) };
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: '⛔ 权限拦截：通行证伪造或已过期' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { imageBase64 } = body;
        if (!imageBase64) return { statusCode: 400, headers, body: JSON.stringify({ error: '未接收到图像特征' }) };

        const { API_KEY, BASE_URL } = process.env;
        if (!API_KEY || !BASE_URL) return { statusCode: 500, headers, body: JSON.stringify({ error: '环境变量未配置' }) };

        const openai = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

        const systemPrompt = `
        【CRITICAL & MANDATORY FIRST STEP: FACE QUALITY CHECK】
        Before analyzing any colors, you MUST verify that the image contains a clear, distinct, unobscured human face. 
        If the image contains NO HUMAN FACE (e.g., landscapes, objects, cartoons, animals), OR if the face is obscured by medical masks, heavy filters, extreme beauty-enhancing effects, heavy accessories, or shadows, YOU MUST IMMEDIATELY ABORT!
        
        If the face is blocked, missing, or heavily filtered, output EXACTLY this JSON:
        {
          "season_name": "⚠️ 引擎已阻断",
          "season_en": "Access Denied",
          "description": "抱歉，未能读取完整原生面部底色。<br><br>高定精准诊断，仅支持自然光正面全脸素颜原图。<br>不适用：口罩遮挡、重度滤镜美颜、翻拍、非人像照片。<br><br>请重新上传合规原图，获取您的专属 16 维色彩档案。"
        }

        If and ONLY if a clear, natural human face is detected, proceed with the luxury high-end AI color analysis for "拾色季".
        Output ONLY the JSON object, no markdown.

        Expected JSON structure for valid faces:
        {
          "season_name": "The 12-season type (e.g., 暖春型, 深秋型, 冷夏型)",
          "season_en": "English name of the season",
          "description": "Poetic Chinese description",
          "feature_colors": [
            {"label": "肌肤底色", "hex": "#HEX"},
            {"label": "面颊色调", "hex": "#HEX"},
            {"label": "原生发色", "hex": "#HEX"},
            {"label": "瞳孔特征", "hex": "#HEX"}
          ],
          "radar_data": [
            {"name": "色调(冷暖)", "value": 80},
            {"name": "明度(深浅)", "value": 70},
            {"name": "彩度(饱和)", "value": 60},
            {"name": "清浊(清透)", "value": 90},
            {"name": "对比(反差)", "value": 50}
          ],
          "best_colors": [
            {"name": "Color 1", "hex": "#HEX"},
            {"name": "Color 2", "hex": "#HEX"}
          ],
          "makeup_advice": "Specific luxury product advice.",
          "outfit_advice": "Fashion and fabric advice.",
          "accessory_advice": "Metal and jewelry advice.",
          "celebrity_reference": "A Chinese sentence mentioning a famous person.",
          "avoid_colors": "Colors to avoid in plain Chinese."
        }`;

        const response = await openai.chat.completions.create({
            model: 'qwen-vl-plus',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user', content: [
                        { type: 'text', text: '请对我进行拾色季的高定 AI 色彩诊断，请以最精简的 JSON 格式输出。' },
                        { type: 'image_url', image_url: { url: imageBase64 } } 
                    ]
                }
            ],
            temperature: 0.1,  
            max_tokens: 600,   
        });

        const rawContent = response.choices[0].message.content;
        const cleanedJSON = rawContent.replace(/```json|```/g, '').trim();
        const finalJSON = JSON.parse(cleanedJSON);

        return { statusCode: 200, headers, body: JSON.stringify(finalJSON) };

    } catch (error) {
        console.error('引擎执行异常:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: '💔 核心引擎算力溢出，请重试' }) };
    }
};
