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
        【CRITICAL: FACE QUALITY CHECK - DYNAMIC TOLERANCE】
        Before analyzing colors, you MUST count the faces and evaluate image compliance based on these strict rules:

        1. MULTIPLE FACES (多人合照): If you detect 2 or more faces, YOU MUST REJECT. The analysis is for ONE person only.
        2. NO FACE: If there is no human face, REJECT.
        3. HARD REJECTION (拦截项): REJECT if the core face area (cheeks, nose, jaw) is heavily obscured by MEDICAL MASKS (口罩), DARK SUNGLASSES (遮光墨镜), or FULL-FACE HATS. REJECT if the image has HEAVY FILTERS or EXTREME BEAUTY EFFECTS (重度磨皮/美颜).
        4. SOFT ALLOWANCE (豁免项): You MUST ALLOW transparent prescription glasses (透明眼镜) and normal decorative hats (like berets/baseball caps) AS LONG AS the cheeks and core skin tones are visible.

        If ANY of the Hard Rejection rules are violated (including multiple faces), output EXACTLY this JSON and ABORT:
        {
          "season_name": "⚠️ 引擎已阻断",
          "season_en": "Access Denied",
          "description": "检测到多人合照、核心面部遮挡或重度滤镜，无法精准提取原生底色。<br><br>请上传自然光下的【单人正面素颜照】。<br>🚫禁止：多人合照、口罩/墨镜、全遮脸帽、重度美颜。<br>✅允许：透明眼镜、不遮挡脸颊的装饰帽、轻微淡妆。"
        }

        If the image is a valid, single person, proceed to extract colors based ONLY on raw skin data, ignoring the hat or transparent glasses.
        
        Expected JSON structure for valid faces:
        {
          "season_name": "The 12-season type",
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
