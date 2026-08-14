const STYLE_IMAGE_KINDS = new Set(['beauty', 'outfit']);

const NEGATIVE_PROMPT = [
  'different person',
  'identity change',
  'face swap',
  'altered ethnicity',
  'altered age',
  'plastic skin',
  'extreme retouching',
  'distorted face',
  'asymmetrical eyes',
  'bad anatomy',
  'extra fingers',
  'deformed hands',
  'text',
  'logo',
  'watermark',
].join(', ');

function text(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function colorList(analysis) {
  return (Array.isArray(analysis?.best_colors) ? analysis.best_colors : [])
    .slice(0, 6)
    .map((color) => `${text(color?.name, '推荐色')} ${text(color?.hex)}`)
    .join('、');
}

export function validateStyleImageKind(kind) {
  if (!STYLE_IMAGE_KINDS.has(kind)) {
    throw new Error('Unsupported style image kind');
  }
  return kind;
}

export function buildStyleImagePrompt(kind, analysis) {
  validateStyleImageKind(kind);
  const identity = `${text(analysis?.season_name)}（${text(analysis?.season_en)}）`;
  const colors = colorList(analysis);
  const shared = `
以输入照片中的女性为唯一人物和身份参考，生成一张真实摄影质感的高端私人形象杂志照片。
必须保持她可被熟人一眼认出的身份：保留五官结构、脸型基础、年龄感、肤色特征与个人辨识度；不要换脸，不要改变族裔，不要夸张瘦脸，不要把她变成另一个人。
允许重新设计更适合她的发型、刘海、卷度、蓬松度和发色，也允许优化神态、姿态、光线和真实肤质。目标是“还是她，但让她惊喜地看见更适合自己的样子”。
个人色彩身份：${identity}。推荐色：${colors}。
整体视觉：自然、克制、昂贵、现代东方女性审美，柔和自然光，真实皮肤纹理，奢侈品美妆或时装编辑摄影，不要网红塑料感，不要过度磨皮，不要文字和品牌标志。
`.trim();

  if (kind === 'beauty') {
    return `${shared}
画面为胸像或肩部以上的美妆编辑肖像，镜头重点在脸部、眼神、妆容和新发型。
妆发设计必须贯彻以下专业建议：${text(analysis?.makeup_advice)}
发型应修饰她的真实脸型，并与妆容和个人色彩一致；妆容包括协调的眉形、眼妆、腮红和唇色，效果明显比原照更精致、更有精神，但现实中可以复刻。
构图留有呼吸感，背景干净柔和，输出竖版 3:4 高级美妆大片。`;
  }

  return `${shared}
将画面扩展为三分之二身或全身的完整造型编辑照片，确保仍然是输入照片中的同一位女性。
穿搭设计必须贯彻以下专业建议：${text(analysis?.outfit_advice)}
配饰与材质建议：${text(analysis?.accessory_advice)}
风格意象：${text(analysis?.style_reference)}
服装的主色、辅助色、点睛色、轮廓、面料和配饰应与个人色彩诊断一致；发型与妆容延续完整造型。姿态自然优雅，身体比例真实，双手结构正确。
场景为简洁柔光影棚或克制的生活化高级空间，输出竖版 3:4 奢侈品 Lookbook。`;
}

export function styleImageNegativePrompt() {
  return NEGATIVE_PROMPT;
}

export function extractGeneratedImageUrl(payload) {
  const content = payload?.output?.choices?.[0]?.message?.content;
  const image = Array.isArray(content)
    ? content.find((item) => typeof item?.image === 'string')?.image
    : null;
  if (!image || !/^https:\/\//i.test(image)) {
    throw new Error('Image model returned no valid image URL');
  }
  return image;
}
