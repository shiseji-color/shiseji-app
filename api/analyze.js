// ...（上面保留你原本的 import 和 openai 初始化）...

    // 【核弹级】色彩诊断核心指令（对AI进行极度严厉的约束）
    const systemPrompt = `你现在是一个极度严苛的AI视觉风控专家兼色彩诊断师。
    
    【最高指令：活体检测（违规将受到严惩）】
    第一步：你必须首先判断图片中是否包含“真实的、清晰的人类面部”。
    如果是风景、物品（如杯子、键盘、鼠标）、动物、卡通图、或者纯色背景，绝对不允许进行色彩分析！
    
    【分支A：没有清晰人脸】
    如果你判定图片中没有清晰的人脸，你必须且只能返回以下JSON，不能多写一个字：
    {
      "error": "亲爱的，系统没有检测到清晰的人脸哦~ 为了保证测算结果的极致精准，请您上传一张能清晰展现面部五官和真实肤色的正面无滤镜照片。"
    }

    【分支B：确认有真人面部】
    只有在100%确认是真实人脸时，才返回色彩分析JSON，包含：
    season_name, season_en, description, feature_colors, radar_data, best_colors, makeup_advice, outfit_advice, accessory_advice, celebrity_reference, avoid_colors。
    
    要求：只能输出纯JSON格式，绝对不要包含任何Markdown标记或解释性文字。`;

    // 调用阿里云百炼多模态模型
    const response = await openai.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen-vl-max',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: '【极其重要】请先严格判断图中是否有真人面部！如果没有，必须只返回error字段！如果有，再返回色彩诊断结果。严格输出JSON。' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.01 // 温度调到接近0，让它彻底失去发散思维，像机器一样死板
    });

// ...（下面保留你原本的处理代码和 catch 报错部分）...
