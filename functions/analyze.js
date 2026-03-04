export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const imageBase64 = body.imageBase64;
        if (!imageBase64) return new Response(JSON.stringify({ error: '未收到图片数据' }), { status: 400 });

        const API_KEY = env.API_KEY;
        const BASE_URL = env.BASE_URL;

        if (!API_KEY || !BASE_URL) return new Response(JSON.stringify({ error: '环境变量缺失' }), { status: 500 });

        // 🔥 安全升级版 Prompt：在原版基础上注入词库，明确雷达图5个维度
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

🔥【前端视觉引擎强制触发词库】🔥
为了配合前端的视觉渲染，你在输出 makeup_advice, outfit_advice, accessory_advice 时，必须自然地使用以下词库中的至少 4-6 个具体颜色词汇（必须一字不差）：
["玫瑰粉", "珊瑚红", "奶油黄", "薄荷绿", "雾霾蓝", "奶茶色", "炭灰色", "藏青色", "酒红色", "香槟色", "燕麦色", "莫兰迪", "卡其色", "豆沙色", "裸粉色", "樱花粉", "抹茶绿", "克莱因蓝"]

REQUIRED JSON structure for human face:
{
  "season_name": "String",
  "season_en": "String",
  "description": "String",
  "feature_colors": [{"label": "String", "hex": "#HEX"}],
  "radar_data": [
    {"name": "冷暖色调", "value": Number},
    {"name": "深浅明度", "value": Number},
    {"name": "饱和彩度", "value": Number},
    {"name": "清透清浊", "value": Number},
    {"name": "明暗对比", "value": Number}
  ],
  "best_colors": [{"name": "String", "hex": "#HEX"}],
  "makeup_advice": "String (必须包含上述词库中的颜色词)",
  "outfit_advice": "String (必须包含上述词库中的颜色词)",
  "accessory_advice": "String (必须包含上述词库中的颜色词)",
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
                temperature: 0.2, // 微调到 0.2，让 AI 更灵活地抓取颜色词
                max_tokens: 2000
            })
        });

        const data = await response.json();
        if (!data.choices || !data.choices[0].message.content) {
            return new Response(JSON.stringify({ error: 'AI接口无返回内容' }), { status: 500 });
        }

        // 🔥 安全提取防线：用正则精准挖出 JSON，防止 AI 回答前后带废话导致崩溃
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

        // ================= 数据清洗防崩溃区域 (保留你的原版兜底，一字未改) =================

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
