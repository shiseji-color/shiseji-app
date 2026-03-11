export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const imageBase64 = body.imageBase64;
        
        // 🔥 核心升级 1：接收前端传来的重试层级，默认是 0
        const fallbackLevel = body.fallbackLevel || 0;

        if (!imageBase64) return new Response(JSON.stringify({ error: '未收到面部图像数据，请重新上传' }), { status: 400 });

        const API_KEY = env.API_KEY;
        const BASE_URL = env.BASE_URL;

        if (!API_KEY || !BASE_URL) return new Response(JSON.stringify({ error: '核心系统组件未配置，请联系主理人' }), { status: 500 });

        // 🔥 核心升级 2：视觉大模型降级池（必须全用带 -vl- 的视觉模型）
        const modelPool = [
            'qwen-vl-plus',       // 0档：主力（速度快，并发高）
            'qwen-vl-max',        // 1档：备用（高配版，防主力拥堵）
            'qwen-vl-max-latest'  // 2档：兜底（最新旗舰版，绝对保命）
        ];
        // 根据前端传来的层级，智能选定当前使用的模型
        const currentModel = modelPool[Math.min(fallbackLevel, modelPool.length - 1)];

        // 🚀【终极高定版 System Prompt】：修复逻辑幻觉、强制色号统一、增加深度解读、精细化明星与面料建议
        const systemPrompt = `
You are an expert Image Color Analyst for a high-end beauty salon. 

### 🚨 FACE DETECTION (CRITICAL):
First, check if the image contains a clear human face. If it is NOT a human face, you MUST output exactly this JSON and stop generating anything else:
{"season_name": "⚠️ 未检测到人脸", "description": "抱歉，未能清晰识别到面部特征，请尝试更换一张正面无遮挡的素颜照片哦~"}

### IF HUMAN FACE IS DETECTED, FOLLOW THESE STRICT INSTRUCTIONS:
1. Analyze the uploaded person's facial features, skin tone, and hair color to determine their 16-season color type.
2. 🔴【绝对强约束 - 逻辑自洽】：如果你在 avoid_colors 中建议避开深色/暗色，那么 best_colors 绝对不能出现深色（如 #8B0000 酒红色）！前后逻辑必须 100% 自洽。
3. 🔴【绝对强约束 - 色号统一】：你在 makeup_advice 和 outfit_advice 中推荐的颜色，必须来源于你生成的 best_colors 数组。绝不要在文本中凭空捏造前面没出现过的颜色！
4. 🟡【增加深度解读】：radar_data 的每一项必须包含一个 desc 字段，用 1-2 句话解读该数值（例如：“您的皮肤对暖色系适配度极高，冷色易显暗沉”）。
5. 🟡【精细化明星对标】：celebrity_reference 必须列出 2-3 位同季型明星，并用括号精准标注她们的具体风格标签（如：毛晓彤【温婉汉服风】、刘诗诗【清冷气质向】）。
6. 🟡【落地化穿搭建议】：outfit_advice 必须结合具体的季节或场景给出面料建议（如：春夏推荐真丝雪纺，秋冬推荐羊毛混纺）。

🔥【前端视觉引擎强制触发词库】🔥
在生成 best_colors 的 name 时，请尽量优先使用以下高级色彩词汇：
["玫瑰粉", "珊瑚红", "奶油黄", "薄荷绿", "雾霾蓝", "奶茶色", "炭灰色", "藏青色", "酒红色", "香槟色", "燕麦色", "莫兰迪", "卡其色", "豆沙色", "裸粉色", "樱花粉", "抹茶绿", "克莱因蓝"]

REQUIRED JSON structure for human face:
{
  "season_name": "String (如：暮春花妍 / 暖春型)",
  "season_en": "String",
  "description": "String (整体气质与色彩风格的高级描述)",
  "feature_colors": [
    {"label": "String (如：自然肤色)", "hex": "#HEX"}
  ],
  "radar_data": [
    {"name": "冷暖色调", "value": Number, "desc": "String (一句话深度解读)"},
    {"name": "深浅明度", "value": Number, "desc": "String"},
    {"name": "饱和彩度", "value": Number, "desc": "String"},
    {"name": "清透清浊", "value": Number, "desc": "String"},
    {"name": "明暗对比", "value": Number, "desc": "String"}
  ],
  "best_colors": [
    {"name": "String (具体颜色名)", "hex": "#HEX"}
  ],
  "makeup_advice": "String",
  "outfit_advice": "String (必须包含季节性面料建议)",
  "accessory_advice": "String",
  "celebrity_reference": "String (含2-3位明星及带括号的具体风格标签)",
  "avoid_colors": ["String", "String"] // 必须是一个字符串数组，包含2-3个需要避雷的具体颜色名
}`;

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: currentModel, // 🔥 动态使用当前轮询到的模型
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: [{ type: 'text', text: 'Analyze the person in this image and provide a high-end color diagnosis in Chinese.' }, { type: 'image_url', image_url: { url: imageBase64 } }] }
                ],
                temperature: 0.2, // 保持低温度，确保AI不乱发散，严格遵守格式
                max_tokens: 2000
            })
        });

        // 🔥 核心升级 3：精准透传 429 限流警报给前端
        if (response.status === 429) {
            return new Response(JSON.stringify({ error: `通道 ${currentModel} 拥挤，触发自动切换...` }), { status: 429, headers: { 'Content-Type': 'application/json' } });
        }

        const data = await response.json();
        
        if (!data.choices || !data.choices[0].message.content) {
            return new Response(JSON.stringify({ error: '专属引擎生成超时，请稍后再试' }), { status: 500 });
        }

        const rawContent = data.choices[0].message.content;
        let cleanedJSONStr = "";
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanedJSONStr = jsonMatch[0];
        } else {
            return new Response(JSON.stringify({ error: '高定图文档案生成异常，请重新上传' }), { status: 500 });
        }

        let finalJSON;
        try {
            finalJSON = JSON.parse(cleanedJSONStr);
        } catch (e) {
            return new Response(JSON.stringify({ error: '色彩矩阵数据解析失败，请重新测算' }), { status: 500 });
        }

        // ================= 数据清洗防崩溃区域 =================
        finalJSON.celebrity_reference = finalJSON.celebrity_reference || finalJSON.celebrity || finalJSON.star || "需参考专属形象顾问，定制您的个人风格";

        // 🚀 微调后端清洗逻辑：确保 avoid_colors 作为一个纯净的 Array 输出给前端，以便渲染多个红色 🚫 胶囊
        if (Array.isArray(finalJSON.avoid_colors)) {
            finalJSON.avoid_colors = finalJSON.avoid_colors.map(item => typeof item === 'object' ? (item.name || "暗沉色") : String(item));
        } else if (typeof finalJSON.avoid_colors === 'string') {
            // 如果AI不听话输出了字符串，强行切分成数组
            finalJSON.avoid_colors = finalJSON.avoid_colors.split(/[,、，]/).map(s => s.trim()).filter(Boolean);
        } else {
            finalJSON.avoid_colors = ["冷冽银", "暗沉黑", "荧光黄"];
        }

        finalJSON.season_name = finalJSON.season_name || "专属高定季";
        finalJSON.season_en = finalJSON.season_en || "Exclusive Season";

        // 雷达图清洗逻辑保持不变，它会自动保留并透传新增的 desc 字段
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
        return new Response(JSON.stringify({ error: `色彩引擎运算波动，请刷新页面重新测算` }), { status: 500 });
    }
}
