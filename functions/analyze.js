export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const imageBase64 = body.imageBase64;
        if (!imageBase64) return new Response(JSON.stringify({ error: '未收到图片数据' }), { status: 400 });

        const API_KEY = env.API_KEY;
        const BASE_URL = env.BASE_URL;

        if (!API_KEY || !BASE_URL) return new Response(JSON.stringify({ error: '环境变量缺失' }), { status: 500 });

        const systemPrompt = `
You are an expert Image Color Analyst. 

### 🚨 FACE DETECTION (CRITICAL):
First, check if the image contains a clear human face. If it is NOT a human face (e.g., an object like a mouse, animal, or landscape), you MUST output exactly this JSON and stop generating anything else:
{"season_name": "⚠️ 未检测到人脸", "description": "抱歉，未能清晰识别到面部特征，请尝试更换一张正面无遮挡的素颜照片哦~"}

### IF HUMAN FACE IS DETECTED, FOLLOW THESE STRICT INSTRUCTIONS:
1. You MUST analyze the uploaded person's facial features, skin tone, and hair color.
2. DO NOT use generic brand templates. 
3. Output ONLY valid JSON, no markdown, no code blocks.
4. "avoid_colors" MUST be a single String, NOT an array or object.

REQUIRED JSON structure for human face:
{
  "season_name": "String",
  "season_en": "String",
  "description": "String",
  "feature_colors": [{"label": "String", "hex": "#HEX"}],
  "radar_data": [{"name": "String", "value": Number}],
  "best_colors": [{"name": "String", "hex": "#HEX"}],
  "makeup_advice": "String",
  "outfit_advice": "String",
  "accessory_advice": "String",
  "celebrity_reference": "String",
  "avoid_colors": "String"
}`;

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'qwen-vl-plus',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: [{ type: 'text', text: 'Analyze the person in this image and provide a high-end color diagnosis in Chinese.' }, { type: 'image_url', image_url: { url: imageBase64 } }] }
                ],
                temperature: 0.1,
                max_tokens: 2000
            })
        });

        const data = await response.json();
        if (!data.choices || !data.choices[0].message.content) {
            return new Response(JSON.stringify({ error: 'AI接口无返回内容' }), { status: 500 });
        }

        const rawContent = data.choices[0].message.content.replace(/```json|```/g, '').trim();
        let finalJSON;
        try {
            finalJSON = JSON.parse(rawContent);
        } catch (e) {
            return new Response(JSON.stringify({ error: `AI返回格式错误，无法解析JSON: ${rawContent}` }), { status: 500 });
        }

        // 数据清洗：修复 undefined 和 [object Object] 问题
        finalJSON.celebrity_reference = finalJSON.celebrity_reference || finalJSON.celebrity || finalJSON.star || "需参考专属形象顾问，定制您的个人风格";

        if (Array.isArray(finalJSON.avoid_colors)) {
            finalJSON.avoid_colors = finalJSON.avoid_colors.map(item => typeof item === 'object' ? (item.name || JSON.stringify(item)) : item).join('、');
        } else if (typeof finalJSON.avoid_colors === 'object' && finalJSON.avoid_colors !== null) {
            finalJSON.avoid_colors = finalJSON.avoid_colors.name || "深灰黑、冷冽银灰、暗淡土黄";
        } else if (!finalJSON.avoid_colors) {
            finalJSON.avoid_colors = "深灰黑、冷冽银灰、暗淡土黄";
        }

        finalJSON.season_name = finalJSON.season_name || "专属高定季";
        finalJSON.season_en = finalJSON.season_en || "Exclusive Season";

        return new Response(JSON.stringify(finalJSON), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({ error: `代码执行异常: ${error.message}` }), { status: 500 });
    }
}
