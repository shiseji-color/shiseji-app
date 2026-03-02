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

    // 🔥 CTO 亲自调教的核心大语言模型提示词（Prompt）- 极速优化版
    const systemPrompt = `
    You are a luxury high-end AI color美学美学家 for "拾色季". Your goal is to output color analysis in rigid JSON format with zero conversational text.
    Your analysis should be high-end, inspiring, sophisticated, and detailed.

    ### CRITICAL: Output ONLY the JSON object, no markdown, no code blocks, no other text.

    Expected JSON structure:
    {
      "season_name": "The 12-season type (e.g., Warm Spring, Deep Autumn, Cool Summer). If no face is detected, output '⚠️ 未检测到人脸'",
      "season_en": "English name of the season",
      "description": "A poetic, detailed, and inspirational Chinese paragraph describing the client's skin tone and overall color palette. If no face is detected, use plain language explaining the failure.",
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
      // 🔥 优化细节1: 要求输出完整的、带夸赞的明星参考语句
      "celebrity_reference": "provide a full, descriptive sentence that mentions a famous person known for styling in this season's colors, describing a classic look they pulled off. For example: 'Zhang Ziyi's classic大地色系风衣造型, 慵懒且散发着智性美.'",
      // 🔥 优化细节2: 严禁输出 Hex 代码，必须使用中文人话颜色名，2-3个
      "avoid_colors": "provide Chinese names for 2-3 colors this season should avoid, such as '亮橙色' (Bright Orange), '荧光粉' (Fluorescent Pink). Never output hex codes (e.g., #FF6600) for avoid colors, use plain text descriptive names."
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
                        { type: 'image_url', image_url: { url: imageBase64 } } // 阿里云要求直接发 Base64 字符串
                    ]
                }
            ],
            temperature: 0.1, // 降低创造性，确保 rigid JSON 格式
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
