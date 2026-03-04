export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const imageBase64 = body.imageBase64;
        if (!imageBase64) return new Response(JSON.stringify({ error: '未收到图片数据' }), { status: 400 });

        const API_KEY = env.API_KEY;
        const BASE_URL = env.BASE_URL;

        if (!API_KEY || !BASE_URL) return new Response(JSON.stringify({ error: '环境变量缺失' }), { status: 500 });

        // 🔥 高定升级版 Prompt：注入强制胶囊词库，并微调各字段的输出要求
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
5. "radar_data" values MUST be positive integers between 0 and 100. DO NOT use decimals or negative numbers.

🔥【前端视觉引擎强制触发词库 - 极度重要】🔥
为了触发前端UI的“高定胶囊色块”特效，你在撰写 makeup_advice, outfit_advice, accessory_advice 和 avoid_colors 时，必须极其自然地使用以下词库中的至少 4-6 个具体颜色词汇（必须一字不差）：
["玫瑰粉", "珊瑚红", "奶油黄", "薄荷绿", "雾霾蓝", "奶茶色", "炭灰色", "藏青色", "酒红色", "香槟色", "燕麦色", "莫兰迪", "卡其色", "豆沙色", "裸粉色", "樱花粉", "抹茶绿", "克莱因蓝"]

REQUIRED JSON structure for human face:
{
  "season_name": "String",
  "season_en": "String",
  "description": "String",
  "feature_colors": [{"label": "String", "hex": "#HEX"}],
  "radar_data": [{"name": "String", "value": Number}],
  "best_colors": [{"name": "String", "hex": "#HEX"}],
  "makeup_advice": "String (MUST naturally include color terms from the mandatory vocabulary list)",
  "outfit_advice": "String (MUST naturally include color terms from the mandatory vocabulary list)",
  "accessory_advice": "String (MUST naturally include color terms from the mandatory vocabulary list)",
  "celebrity_reference": "String (Randomly choose a DIFFERENT high-fashion celebrity each time to ensure '千人千面')",
  "avoid_colors": "String (Provide 2-3 colors to avoid, separated by '、'. Use terms from the vocabulary list if applicable)"
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
                temperature: 0.3, // 🔥 从 0.1 微微调高到 0.3，让 AI 用词更丰富自然，且能更好触发千人千面的明星举例
                max_tokens: 2000
            })
        });

        const data = await response.json();
        if (!data.choices || !data.choices[0].message.content) {
            return new Response(JSON.stringify({ error: 'AI接口无返回内容' }), { status: 500 });
        }

        // 🔥 防崩溃升级：精准剥离废话，提取核心 JSON 数据
        const rawContent = data.choices[0].message.content;
        let cleanedJSONStr = "";
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanedJSONStr = jsonMatch[0];
        } else {
            return new Response(JSON.stringify({ error: 'AI 引擎返回格式错误，未找到有效 JSON' }), { status: 500 });
        }

        let finalJSON;
        try {
            finalJSON = JSON.parse(cleanedJSONStr);
        } catch (e) {
            return new Response(JSON.stringify({ error: `AI返回格式错误，无法解析JSON: ${cleanedJSONStr}` }), { status: 500 });
        }

        // ================= 数据清洗防崩溃区域 =================
        // （绝对保持原样，捍卫你的安全底线）

        // 1. 修复 undefined 和 [object Object] 问题
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

        // 2. 🌟 强制洗净雷达图数据，绝对防空包
        if (Array.isArray(finalJSON.radar_data)) {
            finalJSON.radar_data = finalJSON.radar_data.map(item => {
                let val = parseFloat(item.value);
                if (isNaN(val)) val = 85; // 如果遇到完全不是数字的情况，给个兜底值
                if (val <= 1 && val >= -1) val = Math.abs(val) * 100; // 处理类似 0.8 或 -0.8 的小数，放大成 80
                item.value = Math.max(0, Math.min(100, Math.round(val))); // 死锁在 0-100 整数
                return item;
            });
        }

        return new Response(JSON.stringify(finalJSON), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({ error: `代码执行异常: ${error.message}` }), { status: 500 });
    }
}
