import OpenAI from 'openai';

export const handler = async (event, context) => {
    // 1. 基础预安检
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'CTO 警告：非 POST 请求被无情拦截！' }) };
    }

    const { imageBase64 } = JSON.parse(event.body || '{}');
    if (!imageBase64) {
        return { statusCode: 400, body: JSON.stringify({ error: 'CTO 的灵魂拷问：老板，你忘传图片了？' }) };
    }

    // 2. 从 Netlify 环境变量中精准提取那两把阿里云钥匙
    const { API_KEY, BASE_URL } = process.env;

    if (!API_KEY || !BASE_URL) {
        return { statusCode: 500, body: JSON.stringify({ error: '💔 大脑缺电：阿里云的 API_KEY 或 BASE_URL 环境变量没配！' }) };
    }

    const openai = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

    // 🔥 CTO 亲自重构：加入“钢铁防线”的核心大语言模型提示词（Prompt）
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
      // 🔥 反幻觉防线升级版：彻底切断粉红大象效应，强行注入高级感代餐库
      "celebrity_reference": "Provide a full, descriptive Chinese sentence mentioning a famous person known for styling in this season's colors. CRITICAL RULE: You MUST randomly select a DIFFERENT celebrity each time to ensure '千人千面'. Randomly choose from high-fashion icons such as Shu Qi (舒淇), Tang Wei (汤唯), Ni Ni (倪妮), Anne Hathaway, Jun Ji-hyun (全智贤), Zendaya, Liu Yifei (刘亦菲), Gao Yuanyuan (高圆圆), etc. Describe a specific classic look they pulled off.",
      "avoid_colors": "Provide Chinese names for 2-3 colors this season should avoid. Never output hex codes for avoid colors, use plain text descriptive names (e.g., '荧光绿', '亮橙色')."
    }`;

    try {
        // 3. 呼叫真正的阿里云 AI 大脑
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
            // 🔥 关键改动：将发散度从 0.1 调高到 0.4。既能保证 JSON 不乱，又能激发 AI 的创造力，让明星参考每次都不一样！
            temperature: 0.4, 
            max_tokens: 1500,
        });

        const rawContent = response.choices[0].message.content;
        
        // 4. 彻底清洗 AI 返回的字符串（去除 markdown 标记等）
        const cleanedJSON = rawContent.replace(/```json|```/g, '').trim();

        // 5. 验证清理后的内容是否为有效 JSON
        let finalJSON;
        try {
            finalJSON = JSON.parse(cleanedJSON);
        } catch (e) {
            console.error('JSON 解析失败，AI 返回原文为:', rawContent);
            return {
                statusCode: 500,
                body: JSON.stringify({ error: '💔 大脑瓦解：AI 的数据格式崩溃了，请再测一次！', debug_content: rawContent })
            };
        }

        // 6. 将最终清理好的 JSON 送回前端
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalJSON)
        };

    } catch (error) {
        console.error('阿里云 API 呼叫失败:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '💔 大脑罢工：AI 引擎连接阿里云服务器时发生了意外！', details: error.message })
        };
    }
};
