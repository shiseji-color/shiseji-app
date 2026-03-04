export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const imageBase64 = body.imageBase64;
        if (!imageBase64) return new Response(JSON.stringify({ error: '未收到图片数据' }), { status: 400 });

        const API_KEY = env.API_KEY;
        const BASE_URL = env.BASE_URL;

        if (!API_KEY || !BASE_URL) return new Response(JSON.stringify({ error: '环境变量缺失' }), { status: 500 });

        // 🔥 修复雷达图维度 BUG：已恢复 5 个核心维度！
        const systemPrompt = `
You are an expert high-end Image Color Analyst for "拾色季". 

### 🚨 AUTHENTICITY & AUTHORITY (CRITICAL):
Your analysis is based on the "16-Model Facial Aesthetics Algorithm". 
You MUST provide a professional diagnosis extracting skin tone, hair color, and pupil HEX values.
First, check if the image contains a clear human face. If it is NOT a human face (e.g., an object like a mouse, animal, or landscape), you MUST output exactly this JSON and stop generating anything else:
{"season_name": "⚠️ 未检测到人脸", "description": "抱歉，未能清晰识别到面部特征，请尝试更换一张正面无遮挡的素颜照片哦~"}

🔥【前端视觉引擎强制触发词库 - 极度重要】🔥
为了触发前端UI的高级感，你在撰写建议时，必须极其自然地使用以下词库中的至少 5 个具体颜色词汇（必须一字不差）：
["玫瑰粉", "珊瑚红", "奶油黄", "薄荷绿", "雾霾蓝", "奶茶色", "炭灰色", "藏青色", "酒红色", "香槟色", "燕麦色", "莫兰迪", "卡其色", "豆沙色", "裸粉色", "樱花粉", "抹茶绿", "克莱因蓝"]

### REQUIRED JSON structure (DO NOT USE MARKDOWN):
{
  "season_name": "String (e.g., 春日暖阳, 柔雾之秋)",
  "season_en": "String",
  "description": "Poetic Chinese analysis using technical terms like '明度', '彩度'.",
  "feature_colors": [{"label": "肌肤底色", "hex": "#HEX"}, {"label": "面颊色调", "hex": "#HEX"}, {"label": "原生发色", "hex": "#HEX"}, {"label": "瞳孔色值", "hex": "#HEX"}],
  "radar_data": [
    {"name": "色调(冷暖)", "value": 85}, 
    {"name": "明度(深浅)", "value": 70}, 
    {"name": "彩度(饱和)", "value": 40}, 
    {"name": "清浊(清透)", "value": 60}, 
    {"name": "对比(反差)", "value": 55}
  ],
  "best_colors": [{"name": "String", "hex": "#HEX"}],
  "makeup_advice": "Specific products + MUST include mandatory color keywords.",
  "outfit_advice": "Fabrics + MUST include mandatory color keywords.",
  "accessory_advice": "Texture + MUST include mandatory color keywords.",
  "celebrity_reference": "String (Randomly choose a DIFFERENT high-fashion celebrity each time to ensure uniqueness)",
  "avoid_colors": "String (Provide 2-3 colors to avoid, separated by '、')"
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
                temperature: 0.3, 
                max_tokens: 2000
            })
        });

        const data = await response.json();
        if (!data.choices || !data.choices[0].message.content) {
            return new Response(JSON.stringify({ error: 'AI接口无返回内容' }), { status: 500 });
        }

        // 🔥 防崩溃提取 JSON
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

        // 🌟 强制洗净雷达图数据，绝对防空包
        if (Array.isArray(finalJSON.radar_data)) {
            finalJSON.radar_data = finalJSON.radar_data.map(item => {
                let val = parseFloat(item.value);
                if (isNaN(val)) val = 85; 
                if (val <= 1 && val >= -1) val = Math.abs(val) * 100; 
                item.value = Math.max(0, Math.min(100, Math.round(val))); 
                return item;
            });
        }

        return new Response(JSON.stringify(finalJSON), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({ error: `代码执行异常: ${error.message}` }), { status: 500 });
    }
}
