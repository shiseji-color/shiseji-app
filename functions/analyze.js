export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const imageBase64 = body.imageBase64;
        if (!imageBase64) return new Response(JSON.stringify({ error: '未收到图片数据' }), { status: 400 });

        const API_KEY = env.API_KEY;
        const BASE_URL = env.BASE_URL;

        // 优化后的 System Prompt：严禁生成固定的拾色季介绍，强迫 AI 必须根据图片分析
        const systemPrompt = `
You are an expert Image Color Analyst. 
### INSTRUCTION: 
1. Analyze the provided image ONLY. Do not use generic brand templates.
2. If the image is not a human face, output specific error JSON.
3. You MUST provide real-time analysis based on the actual visual data.
4. Output ONLY JSON, no markdown. 
Fields required: season_name, season_en, description, feature_colors (label/hex), radar_data (name/value), best_colors (name/hex), makeup_advice, outfit_advice, accessory_advice, celebrity_reference, avoid_colors.
`;

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
            body: JSON.stringify({
                model: 'qwen-vl-plus',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: [{ type: 'text', text: 'Analyze this person and provide a detailed color analysis report in Chinese.' }, { type: 'image_url', image_url: { url: imageBase64 } }] }
                ],
                temperature: 0.2, // 调低温度，减少 AI 瞎编
                max_tokens: 1500
            })
        });

        const data = await response.json();
        const rawContent = data.choices[0].message.content.replace(/```json|```/g, '').trim();
        
        // 调试窗口：如果解析报错，我们把 AI 的“胡言乱语”直接抛出来
        let finalJSON;
        try {
            finalJSON = JSON.parse(rawContent);
        } catch (e) {
            return new Response(JSON.stringify({ error: `AI解析失败，原始输出为: ${rawContent}` }), { status: 500 });
        }

        // 强行对齐字段，防止 undefined
        finalJSON.celebrity_reference = finalJSON.celebrity_reference || "需参考专属形象顾问";

        return new Response(JSON.stringify(finalJSON), { headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        return new Response(JSON.stringify({ error: `执行崩溃: ${error.message}` }), { status: 500 });
    }
} 
  
 
