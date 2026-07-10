import OpenAI from 'openai';

// 拾色季 SHISEJI · 边缘计算核心风控模块
const MASTER_SALT = "SHISEJI-MOYING-2026"; 
const MASTER_KEYS = ["VIP888", "MY666", "SHISEJI2026"]; 

// 🛡️ 哈希校验引擎
function verifySecretKey(userKey) {
    if (!userKey) return false;

    // 1. 最高优先级：主理人后门
    if (MASTER_KEYS.includes(userKey.toUpperCase())) return true; 

    // 2. 动态卡密校验
    if (!userKey.startsWith('SSJ-')) return false;
    const parts = userKey.split('-');
    if (parts.length !== 3) return false;
    
    const randomPart = parts[1];
    const providedChecksum = parts[2];
    
    let sum = 0;
    for(let i = 0; i < randomPart.length; i++) sum += randomPart.charCodeAt(i);
    for(let i = 0; i < MASTER_SALT.length; i++) sum += MASTER_SALT.charCodeAt(i);
    
    const expectedChecksum = (sum % 100).toString().padStart(2, '0');
    return expectedChecksum === providedChecksum;
}

export const handler = async (event, context) => {
    // 强制跨域放行
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    };

    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers, body: "OK" };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'CTO 警告：非 POST 请求被无情拦截！' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const userKey = body.userCode || body.activationCode;

        // ⚔️ 绝对拦截线：哈希校验失败，直接阻断，保护阿里云算力
        if (!verifySecretKey(userKey)) {
            return { 
                statusCode: 403, 
                headers,
                body: JSON.stringify({ 
                    error: "权限拒绝：高定密钥无效或已逾期，请联系主理人提取新档案。" 
                }) 
            };
        }

        const { imageBase64 } = body;
        if (!imageBase64) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'CTO 的灵魂拷问：老板，你忘传图片了？' }) };
        }

        // ==========================================
        // 🟢 校验通过，开始呼叫大模型算力
        // ==========================================
        const { API_KEY, BASE_URL } = process.env;

        if (!API_KEY || !BASE_URL) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: '💔 大脑缺电：环境变量没配！' }) };
        }

        const openai = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

        const systemPrompt = `
        【CRITICAL & MANDATORY FIRST STEP: FACE DETECTION】
        Before analyzing any colors, you MUST verify that the image contains a clear, distinct human face. 
        If the image contains NO HUMAN FACE (e.g., landscapes, neon lights, objects, animals, cartoons, mice, keyboards, heavily obscured faces, or dark scenes without visible features), YOU MUST IMMEDIATELY ABORT the color analysis!
        If no face is detected, your output MUST BE EXACTLY this JSON and nothing else. Do not hallucinate colors from the background:
        {
          "season_name": "⚠️ 未检测到人脸",
          "season_en": "No Face Detected",
          "description": "抱歉，未能清晰识别到您的面部特征。系统无法为风景、物品或非清晰人像进行高定色彩诊断，请尝试更换一张正面无遮挡的素颜照片哦~"
        }

        If and ONLY if a clear human face is detected, proceed with the luxury high-end AI color analysis for "拾色季".
        You are a luxury high-end AI color美学美学家. Your output must be high-end, inspiring, sophisticated, and detailed.

        ### CRITICAL: Output ONLY the JSON object, no markdown, no code blocks, no other text.

        Expected JSON structure for valid faces:
        {
          "season_name": "The 12-season type (e.g., 暖春型, 深秋型, 冷夏型)",
          "season_en": "English name of the season",
          "description": "A poetic, detailed, and inspirational Chinese paragraph describing the client's skin tone and overall color palette.",
          "feature_colors": [
            {"label": "肌肤底色", "hex": "#HEX"},
            {"label": "面颊色调", "hex": "#HEX"},
            {"label": "原生发色", "hex": "#HEX"},
            {"label": "瞳孔特征", "hex": "#HEX"}
          ],
          "radar_data": [
            {"name": "色调(冷暖)", "value": "1-100 score, higher for warm"},
            {"name": "明度(深浅)", "value": "1-100 score, higher for bright"},
            {"name": "彩度(饱和)", "value": "1-100 score, higher for saturated"},
            {"name": "清浊(清透)", "value": "1-100 score, higher for clear"},
            {"name": "对比(反差)", "value": "1-100 score, higher for contrast"}
          ],
          "best_colors": [
            {"name": "Sophisticated Chinese name for the color", "hex": "#HEX"},
            ...4 best colors
          ],
          "makeup_advice": "A paragraph with specific luxury product code recommendations (e.g., YSL #B10, DIOR #999, NARS Orgasm).",
          "outfit_advice": "A paragraph covering fashion, silhouette, and high-end fabrics.",
          "accessory_advice": "A paragraph covering metal, leather, and jewelry texture.",
          "celebrity_reference": "Provide a full, descriptive Chinese sentence mentioning a famous person known for styling in this season's colors. CRITICAL RULE: You MUST randomly select a DIFFERENT celebrity each time to ensure '千人千面'. Randomly choose from high-fashion icons such as Shu Qi (舒淇), Tang Wei (汤唯), Ni Ni (倪妮), Anne Hathaway, Jun Ji-hyun (全智贤), Zendaya, Liu Yifei (刘亦菲), Gao Yuanyuan (高圆圆), etc. Describe a specific classic look they pulled off.",
          "avoid_colors": "Provide Chinese names for 2-3 colors this season should avoid. Never output hex codes for avoid colors, use plain text descriptive names (e.g., '荧光绿', '亮橙色')."
        }`;

        const response = await openai.chat.completions.create({
            model: 'qwen-vl-plus',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user', content: [
                        { type: 'text', text: '请对我进行拾色季的高定 AI 色彩诊断。' },
                        { type: 'image_url', image_url: { url: imageBase64 } } 
                    ]
                }
            ],
            temperature: 0.4, 
            max_tokens: 1500,
        });

        const rawContent = response.choices[0].message.content;
        const cleanedJSON = rawContent.replace(/```json|```/g, '').trim();

        let finalJSON;
        try {
            finalJSON = JSON.parse(cleanedJSON);
        } catch (e) {
            console.error('JSON 解析失败，AI 返回原文为:', rawContent);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: '💔 大脑瓦解：AI 数据格式崩溃，请重试！', debug_content: rawContent })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(finalJSON)
        };

    } catch (error) {
        console.error('阿里云 API 呼叫失败:', error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: '💔 大脑罢工：连接云端服务器时发生意外！' })
        };
    }
};
