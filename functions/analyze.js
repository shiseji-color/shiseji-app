export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const imageBase64 = body.imageBase64;

        if (!imageBase64) return new Response(JSON.stringify({ error: '未收到图片数据' }), { status: 400 });

        const API_KEY = env.API_KEY;
        const BASE_URL = env.BASE_URL;

        if (!API_KEY || !BASE_URL) return new Response(JSON.stringify({ error: '环境变量丢失' }), { status: 500 });

        const systemPrompt = `
You are a luxury high-end AI color美学专家. 
### CRITICAL: Output ONLY the JSON object, no markdown, no code blocks, no other text.
Expected JSON structure:
{
  "season_name": "String",
  "season_en": "String",
  "description": "String",
  "feature_colors": [{"label": "String", "hex": "#HEX"}, ...],
  "radar_data": [{"name": "String", "value": Number}, ...],
  "best_colors": [{"name": "String", "hex": "#HEX"}, ...],
  "makeup_advice": "String",
  "outfit_advice": "String",
  "accessory_advice": "String",
  "celebrity_reference": "String",
  "avoid_colors": "String"
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

        const data = await response.json();
        
        if (!response.ok || !data.choices || data.choices.length === 0) {
            return new Response(JSON.stringify({ error: 'AI接口响应异常' }), { status: 500 });
        }

        const rawContent = data.choices[0].message.content;
        const cleanedJSON = rawContent.replace(/```json|```/g, '').trim();
        let finalJSON = JSON.parse(cleanedJSON);

        // --- 核心修复：保险丝机制 ---
        // 确保字段绝对存在，如果 AI 偷懒没生成，我们就给它补上默认值，防止前端 undefined
        finalJSON.celebrity_reference = finalJSON.celebrity_reference || finalJSON.celebrity || finalJSON.star || "由拾色季AI为您定制专属美学";
        finalJSON.season_name = finalJSON.season_name || "待诊断";
        finalJSON.description = finalJSON.description || "正在为您分析色彩...";
        // --------------------------

        return new Response(JSON.stringify(finalJSON), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: `系统处理异常: ${error.message}` }), { status: 500 });
    }
}
