import OpenAI from 'openai';

export default async function handler(req, res) {
    // 强制阻断非 POST 的恶意探测
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Error 405: Method Not Allowed' });
    }

    try {
        const { imageBase64 } = req.body;
        if (!imageBase64) {
            return res.status(400).json({ error: 'Error 400: Face Image Missing' });
        }

        const { API_KEY, BASE_URL } = process.env;
        if (!API_KEY || !BASE_URL) {
            return res.status(500).json({ error: 'Error 500: Core Configuration Missing' });
        }

        const openai = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

        const systemPrompt = `【CRITICAL & MANDATORY FIRST STEP: FACE DETECTION】
Before analyzing any colors, you MUST verify that the image contains a clear, distinct human face. 
If the image contains NO HUMAN FACE (e.g., landscapes, neon lights, objects, animals, cartoons, mice, keyboards, heavily obscured faces, or dark scenes without visible features), YOU MUST IMMEDIATELY ABORT the color analysis!
If no face is detected, your output MUST BE EXACTLY this JSON and nothing else:
{"season_name": "⚠️ 未检测到人脸", "description": "抱歉，未能清晰识别到您的面部特征。系统无法为风景、物品或非清晰人像进行高定色彩诊断，请尝试更换一张正面无遮挡的素颜照片哦~"}

If and ONLY if a clear human face is detected, proceed with the luxury high-end AI color analysis for "拾色季".
You are a luxury high-end AI color美学美学家. Your output must be high-end, inspiring, sophisticated, and detailed.
Output ONLY the JSON object, no markdown, no code blocks, no other text.

Expected JSON structure:
{
  "season_name": "String (如：暖春型, 深秋型, 冷夏型)",
  "season_en": "String",
  "description": "String (诗意且高级的气质与色彩风格描述)",
  "feature_colors": [
    {"label": "肌肤底色", "hex": "#HEX"},
    {"label": "面颊色调", "hex": "#HEX"},
    {"label": "原生发色", "hex": "#HEX"},
    {"label": "瞳孔特征", "hex": "#HEX"}
  ],
  "radar_data": [
    {"name": "色调(冷暖)", "value": Number, "desc": "String (深度解读)"},
    {"name": "明度(深浅)", "value": Number, "desc": "String"},
    {"name": "彩度(饱和)", "value": Number, "desc": "String"},
    {"name": "清浊(清透)", "value": Number, "desc": "String"},
    {"name": "对比(反差)", "value": Number, "desc": "String"}
  ],
  "best_colors": [
    {"name": "高级中文色彩名", "hex": "#HEX"}
  ],
  "makeup_advice": "String (含大牌口红/粉底具体色号推荐)",
  "outfit_advice": "String (含面料与剪裁建议)",
  "accessory_advice": "String",
  "celebrity_reference": "String (随机选择舒淇、汤唯、倪妮、全智贤、刘亦菲等，描述其经典造型)",
  "avoid_colors": ["String", "String"]
}`;

        const response = await openai.chat.completions.create({
            model: 'qwen-vl-plus',
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user', content: [
                        { type: 'text', text: 'Analyze the person in this image and provide a high-end color diagnosis in Chinese.' },
                        { type: 'image_url', image_url: { url: imageBase64 } }
                    ]
                }
            ],
            temperature: 0.4,
            max_tokens: 1500,
        });

        const rawContent = response.choices[0].message.content;
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(500).json({ error: 'Error 500: Data Format Collapse' });
        }

        let finalJSON = JSON.parse(jsonMatch[0]);

        // 强风控：数据清洗，防止前端解析崩盘
        if (Array.isArray(finalJSON.avoid_colors)) {
            finalJSON.avoid_colors = finalJSON.avoid_colors.map(item => typeof item === 'object' ? (item.name || "暗沉色") : String(item));
        } else if (typeof finalJSON.avoid_colors === 'string') {
            finalJSON.avoid_colors = finalJSON.avoid_colors.split(/[,、，]/).map(s => s.trim()).filter(Boolean);
        } else {
            finalJSON.avoid_colors = ["冷冽银", "暗沉黑", "荧光黄"];
        }

        if (Array.isArray(finalJSON.radar_data)) {
            finalJSON.radar_data = finalJSON.radar_data.map(item => {
                let val = parseFloat(item.value);
                if (isNaN(val)) val = 85;
                item.value = Math.max(0, Math.min(100, Math.round(val)));
                return item;
            });
        }

        return res.status(200).json(finalJSON);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error 500: Engine Computational Disruption' });
    }
}
