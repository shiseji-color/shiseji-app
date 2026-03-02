export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const imageBase64 = body.imageBase64;

        if (!imageBase64) return new Response(JSON.stringify({ error: '未收到图片数据' }), { status: 400 });

        const API_KEY = env.API_KEY;
        const BASE_URL = env.BASE_URL;

        if (!API_KEY || !BASE_URL) return new Response(JSON.stringify({ error: '环境变量丢失：请回 Cloudflare 检查 API_KEY 和 BASE_URL' }), { status: 500 });

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
You are a luxury high-end AI color美学专家. Your output must be high-end, inspiring, sophisticated, and detailed.

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
    {"name": "色调(冷暖)", "value": 75},
    {"name": "明度(深浅)", "value": 60},
    {"name": "彩度(饱和)", "value": 85},
    {"name": "清浊(清透)", "value": 70},
    {"name": "对比(反差)", "value": 65}
  ],
  "best_colors": [
    {"name": "Sophisticated Chinese name", "hex": "#HEX"},
    {"name": "Sophisticated Chinese name", "hex": "#HEX"},
    {"name": "Sophisticated Chinese name", "hex": "#HEX"},
    {"name": "Sophisticated Chinese name", "hex": "#HEX"}
  ],
  "makeup_advice": "A paragraph with specific luxury product code recommendations (e.g., YSL #B10, DIOR #999, NARS Orgasm).",
  "outfit_advice": "A paragraph covering fashion, silhouette, and high-end fabrics.",
  "accessory_advice": "A paragraph covering metal, leather, and jewelry texture.",
  "celebrity_reference": "Provide a full, descriptive Chinese sentence mentioning a famous person known for styling in this season's colors. CRITICAL RULE: You MUST randomly select a DIFFERENT celebrity each time.",
  "avoid_colors": "Provide Chinese names for 2-3 colors this season should avoid."
}`;

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
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
                max_tokens: 1500
            })
        });

        // 核心诊断逻辑：捕获阿里的真实返回
        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            return new Response(JSON.stringify({ error: `无法解析阿里返回的数据: ${responseText.substring(0, 100)}` }), { status: 500 });
        }

        if (!response.ok || data.error) {
            return new Response(JSON.stringify({ error: `阿里接口报错: ${JSON.stringify(data)}` }), { status: 500 });
        }

        if (!data.choices || data.choices.length === 0) {
            return new Response(JSON.stringify({ error: `阿里返回了空数据` }), { status: 500 });
        }

        const rawContent = data.choices[0].message.content;
        const cleanedJSON = rawContent.replace(/```json|```/g, '').trim();
        const finalJSON = JSON.parse(cleanedJSON);

        return new Response(JSON.stringify(finalJSON), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        // 把代码崩溃的真实原因抛出来
        return new Response(JSON.stringify({ error: `后端执行崩溃: ${error.message}` }), { status: 500 });
    }
}
