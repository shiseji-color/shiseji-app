import OpenAI from 'openai';

export const handler = async (event, context) => {
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
        const { imageBase64 } = body;

        if (!imageBase64) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'CTO 的灵魂拷问：老板，你忘传图片了？' }) };
        }

        const { API_KEY, BASE_URL } = process.env;

        if (!API_KEY || !BASE_URL) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: '💔 大脑缺电：环境变量没配！' }) };
        }

        const openai = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

        const systemPrompt = `
        【CRITICAL & MANDATORY FIRST STEP: FACE QUALITY CHECK】
        Before analyzing any colors, you MUST verify that the image contains a clear, distinct, unobscured human face. 
        If the image contains NO HUMAN FACE (e.g., landscapes, objects, cartoons, animals), OR if the face is obscured by medical masks, heavy filters, extreme beauty-enhancing effects, heavy accessories, or is mostly obscured by shadows, YOU MUST IMMEDIATELY ABORT the color analysis!
        
        If the face is blocked, missing, or heavily filtered, your output MUST BE EXACTLY this JSON and nothing else:
        {
          "season_name": "⚠️ 引擎已阻断",
          "season_en": "Access Denied",
          "description": "抱歉，未能读取完整原生面部底色。<br><br>高定精准诊断，仅支持自然光正面全脸素颜原图。<br>不适用：口罩遮挡、重度滤镜美颜、翻拍、非人像照片。<br><br>请重新上传合规原图，获取您的专属 16 维色彩档案。"
        }

        If and ONLY if a clear, natural human face is detected, proceed with the luxury high-end AI color analysis for "拾色季".
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
            {"name": "Color 2", "hex": "#HEX"},
            {"name": "Color 3", "hex": "#HEX"},
            {"name": "Color 4", "hex": "#HEX"}
          ],
          "makeup_advice": "A paragraph with specific luxury product code recommendations (e.g., YSL #B10, DIOR #999, NARS Orgasm).",
          "outfit_advice": "A paragraph covering fashion, silhouette, and high-end fabrics.",
          "accessory_advice": "A paragraph covering metal, leather, and jewelry texture.",
          "celebrity_reference": "Provide a full, descriptive Chinese sentence mentioning a famous person known for styling in this season's colors. CRITICAL RULE: You MUST randomly select a DIFFERENT celebrity each time to ensure '千人千面'.",
          "avoid_colors": "Provide Chinese names for 2-3 colors this season should avoid. Never output hex codes for avoid colors, use plain text descriptive names."
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
