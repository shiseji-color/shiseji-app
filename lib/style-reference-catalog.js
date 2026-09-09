// Reviewed fictional references. Mapping is editorial, not evidence of personal accuracy.
const shared = {
  sampleKey: 'warm-spring',
  sampleName: '柔光暖春',
  profileId: 'SSJ-02',
  canonicalName: '杏光柔暖',
  version: 2,
  status: 'released',
  origin: 'ai-generated-fictional-adult',
  userPhotoUsed: false,
  provenance: 'web/assets/style-references/v2-prompts.md',
};

const moon = {
  sampleKey: 'moonlight-veil', sampleName: '月纱浅冷',
  profileId: 'SSJ-05', canonicalName: '月纱浅冷', version: 2,
  status: 'released', origin: 'ai-generated-fictional-adult',
  userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-05-v2-prompts.md',
};

const rockTea = {
  sampleKey: 'rock-tea-steady-warm', sampleName: '岩茶稳暖',
  profileId: 'SSJ-14', canonicalName: '岩茶稳暖', version: 2,
  status: 'released', origin: 'ai-generated-fictional-adult',
  userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-14-v2-prompts.md',
};

const crystalDew = {
  sampleKey: 'crystal-dew-clear-cool', sampleName: '晶露明冷',
  profileId: 'SSJ-07', canonicalName: '晶露明冷', version: 2,
  status: 'released', origin: 'ai-generated-fictional-adult',
  userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-07-v2-prompts.md',
};

const inkGlow = {
  sampleKey: 'ink-glow-high-contrast', sampleName: '墨曜高对比',
  profileId: 'SSJ-12', canonicalName: '墨曜高对比', version: 2,
  status: 'released', origin: 'ai-generated-fictional-adult',
  userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-12-v2-prompts.md',
};

const peachBright = {
  sampleKey: 'peach-bright-soft', sampleName: '蜜桃明柔',
  profileId: 'SSJ-13', canonicalName: '蜜桃明柔', version: 2,
  status: 'released', origin: 'ai-generated-fictional-adult',
  userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-13-v2-prompts.md',
};

const clearGlaze = {
  sampleKey: 'clear-glaze-balanced', sampleName: '琉璃清透',
  profileId: 'SSJ-11', canonicalName: '琉璃清透', version: 2,
  status: 'released', origin: 'ai-generated-fictional-adult',
  userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-11-v2-prompts.md',
};

const starlitNight = {
  sampleKey: 'starlit-night-sharp-cool', sampleName: '星夜锐冷',
  profileId: 'SSJ-16', canonicalName: '星夜锐冷', version: 2,
  status: 'released', origin: 'ai-generated-fictional-adult',
  userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-16-v2-prompts.md',
};

const dawnWarm = {
  sampleKey: 'dawn-warm-light', sampleName: '晨露浅暖', profileId: 'SSJ-01', canonicalName: '晨露浅暖',
  version: 2, status: 'released', origin: 'ai-generated-fictional-adult', userPhotoUsed: false,
  provenance: 'web/assets/style-references/ssj-01-v2-prompts.md',
};

const solarBright = {
  sampleKey: 'solar-bright-warm', sampleName: '日曜明暖', profileId: 'SSJ-03', canonicalName: '日曜明暖',
  version: 2, status: 'released', origin: 'ai-generated-fictional-adult', userPhotoUsed: false,
  provenance: 'web/assets/style-references/ssj-03-v2-prompts.md',
};

const deepAmber = { sampleKey: 'deep-amber-warm', sampleName: '琥珀深暖', profileId: 'SSJ-04', canonicalName: '琥珀深暖', version: 2, status: 'released', origin: 'ai-generated-fictional-adult', userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-04-v2-prompts.md' };
const twilightBlue = { sampleKey: 'twilight-blue-deep-cool', sampleName: '暮蓝深冷', profileId: 'SSJ-08', canonicalName: '暮蓝深冷', version: 2, status: 'released', origin: 'ai-generated-fictional-adult', userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-08-v2-prompts.md' };
const mistyBlue = { sampleKey: 'misty-blue-soft-cool', sampleName: '雾蓝柔冷', profileId: 'SSJ-06', canonicalName: '雾蓝柔冷', version: 2, status: 'released', origin: 'ai-generated-fictional-adult', userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-06-v2-prompts.md' };
const pearlLight = { sampleKey: 'pearl-light-clean', sampleName: '珍珠浅净', profileId: 'SSJ-09', canonicalName: '珍珠浅净', version: 2, status: 'released', origin: 'ai-generated-fictional-adult', userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-09-v2-prompts.md' };
const mutedRosy = { sampleKey: 'muted-rosy-soft', sampleName: '烟霞柔和', profileId: 'SSJ-10', canonicalName: '烟霞柔和', version: 2, status: 'released', origin: 'ai-generated-fictional-adult', userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-10-v2-prompts.md' };
const silverMist = { sampleKey: 'silver-mist-quiet-cool', sampleName: '银雾静冷', profileId: 'SSJ-15', canonicalName: '银雾静冷', version: 2, status: 'released', origin: 'ai-generated-fictional-adult', userPhotoUsed: false, provenance: 'web/assets/style-references/ssj-15-v2-prompts.md' };

export const styleReferenceCatalog = Object.freeze([
  Object.freeze({ ...mutedRosy, id: 'muted-rosy-soft-beauty-v2', kind: 'beauty', path: 'web/assets/style-references/ssj-10-beauty-v2.png', width: 1122, height: 1402, scene: '妆容配色参考', composition: '纺织布样背景的头肩近景，双眼、完整唇部与头顶可见', background: '浅中性纺织工作室与虚化灰粉布样', paletteIntent: '燕麦灰、灰豆沙、烟霞粉、藕灰棕、旧金', cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点', notice: 'AI 生成风格示例，非本人试妆效果。' }),
  Object.freeze({ ...mutedRosy, id: 'muted-rosy-soft-outfit-v2', kind: 'outfit', path: 'web/assets/style-references/ssj-10-outfit-v2.png', width: 1024, height: 1536, scene: '纺织空间 / 柔雾日常', composition: '全身自然迈步，头顶、手部、裤脚与双鞋完整', description: '烟霞粉垂坠衬衫搭雾绿灰宽裤，以灰紫褐绒面鞋包和微量旧金收束。', background: '浅灰墙、窄窗与中性布帘', paletteIntent: '雾绿灰、烟霞粉、燕麦灰、灰紫褐、旧金', cropPolicy: '保留头顶、手部、裤脚与双鞋，使用完整画幅', notice: 'AI 生成风格示例，非本人试穿效果。' }),
  Object.freeze({ ...silverMist, id: 'silver-mist-quiet-cool-beauty-v2', kind: 'beauty', path: 'web/assets/style-references/ssj-15-beauty-v2.png', width: 1122, height: 1402, scene: '妆容配色参考', composition: '磨砂金属窗边的头肩近景，双眼、完整唇部与头顶可见', background: '明亮中性灰墙、磨砂金属边框与雨后反光', paletteIntent: '冷杉绿、干枯玫瑰、灰粉、冷灰紫、旧银', cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点', notice: 'AI 生成风格示例，非本人试妆效果。' }),
  Object.freeze({ ...silverMist, id: 'silver-mist-quiet-cool-outfit-v2', kind: 'outfit', path: 'web/assets/style-references/ssj-15-outfit-v2.png', width: 1024, height: 1536, scene: '雨后步道 / 静冷日常', composition: '全身轻侧站姿，头顶、手部、裙摆与双靴完整', description: '银雾灰短夹克与石英灰内搭建立结构，以冷杉绿直裙和炭蓝灰鞋包形成静冷层次。', background: '雨后中性灰城市步道与磨砂金属门面', paletteIntent: '冷杉绿、银雾灰、石英灰、炭蓝灰、旧银', cropPolicy: '保留头顶、手部、裙摆与双靴，使用完整画幅', notice: 'AI 生成风格示例，非本人试穿效果。' }),
  Object.freeze({ ...mistyBlue, id: 'misty-blue-soft-cool-beauty-v2', kind: 'beauty', path: 'web/assets/style-references/ssj-06-beauty-v2.png', width: 1122, height: 1402, scene: '妆容配色参考', composition: '灰紫织物背景的头肩近景，双眼、完整唇部与头顶可见', background: '浅中性灰墙与虚化灰紫织物', paletteIntent: '柔海军蓝、灰玫瑰、冷豆沙、雾紫灰棕、哑银', cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点', notice: 'AI 生成风格示例，非本人试妆效果。' }),
  Object.freeze({ ...mistyBlue, id: 'misty-blue-soft-cool-outfit-v2', kind: 'outfit', path: 'web/assets/style-references/ssj-06-outfit-v2.png', width: 1024, height: 1536, scene: '安静露台 / 柔冷日常', composition: '全身轻侧站姿，头顶、手部、裙摆与双鞋完整', description: '雾蓝软针织搭灰紫直线长裙，以贝壳灰内搭和柔海军蓝鞋包收束。', background: '浅中性墙与简洁木质长椅', paletteIntent: '雾蓝、灰紫、贝壳灰、柔海军蓝、哑银', cropPolicy: '保留头顶、手部、裙摆与双鞋，使用完整画幅', notice: 'AI 生成风格示例，非本人试穿效果。' }),
  Object.freeze({ ...pearlLight, id: 'pearl-light-clean-beauty-v2', kind: 'beauty', path: 'web/assets/style-references/ssj-09-beauty-v2.png', width: 1122, height: 1402, scene: '妆容配色参考', composition: '磨砂玻璃空间中的头肩近景，双眼、完整唇部与头顶可见', background: '浅中性空间、纸灯与虚化磨砂玻璃', paletteIntent: '浅水蓝、贝壳粉、浅玫瑰、柔金灰棕、母贝', cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点', notice: 'AI 生成风格示例，非本人试妆效果。' }),
  Object.freeze({ ...pearlLight, id: 'pearl-light-clean-outfit-v2', kind: 'outfit', path: 'web/assets/style-references/ssj-09-outfit-v2.png', width: 1024, height: 1536, scene: '设计庭院 / 浅净日常', composition: '全身自然前行，头顶、手部、裤脚与双鞋完整', description: '珍珠白短袖衬衫搭浅水蓝垂坠宽裤，以贝壳粉小包和浅灰褐鞋履点缀。', background: '浅灰设计庭院、简洁台阶与磨砂玻璃', paletteIntent: '浅水蓝、珍珠白、贝壳粉、浅灰褐、母贝', cropPolicy: '保留头顶、手部、裤脚与双鞋，使用完整画幅', notice: 'AI 生成风格示例，非本人试穿效果。' }),
  Object.freeze({ ...deepAmber, id: 'deep-amber-warm-beauty-v2', kind: 'beauty', path: 'web/assets/style-references/ssj-04-beauty-v2.png', width: 1122, height: 1402, scene: '妆容配色参考', composition: '琥珀器物背景的头肩近景，双眼、完整唇部与头顶可见', background: '浅中性设计空间与虚化琥珀玻璃', paletteIntent: '浓咖、砖红、肉桂、深金棕、古金', cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点', notice: 'AI 生成风格示例，非本人试妆效果。' }),
  Object.freeze({ ...deepAmber, id: 'deep-amber-warm-outfit-v2', kind: 'outfit', path: 'web/assets/style-references/ssj-04-outfit-v2.png', width: 1024, height: 1536, scene: '设计店外 / 深暖日常', composition: '全身自然迈步，头顶、手部、裙摆与双鞋完整', description: '琥珀棕短外套与浓咖长裙建立深暖层次，以象牙内搭和橄榄小包提亮。', background: '中性浅墙与玻璃窗城市店面', paletteIntent: '浓咖、琥珀棕、象牙、橄榄绿、古金', cropPolicy: '保留头顶、手部、裙摆与双鞋，使用完整画幅', notice: 'AI 生成风格示例，非本人试穿效果。' }),
  Object.freeze({ ...twilightBlue, id: 'twilight-blue-deep-cool-beauty-v2', kind: 'beauty', path: 'web/assets/style-references/ssj-08-beauty-v2.png', width: 1122, height: 1402, scene: '妆容配色参考', composition: '灰蓝空间中的轻侧头肩近景，双眼、完整唇部与头顶可见', background: '中性灰蓝墙面与虚化黑莓软椅', paletteIntent: '深海军蓝、酒红、黑莓、深灰紫、冷银', cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点', notice: 'AI 生成风格示例，非本人试妆效果。' }),
  Object.freeze({ ...twilightBlue, id: 'twilight-blue-deep-cool-outfit-v2', kind: 'outfit', path: 'web/assets/style-references/ssj-08-outfit-v2.png', width: 1024, height: 1536, scene: '文化空间 / 暮色日常', composition: '全身轻侧站姿，头顶、手部、裤脚与双鞋完整', description: '深海军蓝细针织搭黑莓色垂坠长裤，以冰灰小包轻提亮。', background: '中性灰实体墙与深色文化空间门面', paletteIntent: '黑莓、深海军蓝、冰灰、炭黑、冷银', cropPolicy: '保留头顶、手部、裤脚与双鞋，使用完整画幅', notice: 'AI 生成风格示例，非本人试穿效果。' }),
  Object.freeze({ ...dawnWarm, id: 'dawn-warm-light-beauty-v2', kind: 'beauty', path: 'web/assets/style-references/ssj-01-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '晨间窗边头肩近景，双眼、完整唇部与头顶可见', background: '浅中性墙、开放窗框与亚麻帘',
    paletteIntent: '杏仁奶油、浅杏粉、浅杏桃、香槟米金', cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点', notice: 'AI 生成风格示例，非本人试妆效果。' }),
  Object.freeze({ ...dawnWarm, id: 'dawn-warm-light-outfit-v2', kind: 'outfit', path: 'web/assets/style-references/ssj-01-outfit-v2.png', width: 1024, height: 1536,
    scene: '晨间窗廊 / 轻盈日常', composition: '全身轻侧站姿，头顶、手部、裤脚与双鞋完整', description: '杏仁奶油上衣搭浅杏直筒裤，以嫩芽绿小包和浅驼鞋履收尾。',
    background: '浅灰米石阶与简洁窗廊', paletteIntent: '浅杏粉、杏仁奶油、嫩芽绿、浅驼', cropPolicy: '保留头顶、手部、裤脚与双鞋，使用完整画幅', notice: 'AI 生成风格示例，非本人试穿效果。' }),
  Object.freeze({ ...solarBright, id: 'solar-bright-warm-beauty-v2', kind: 'beauty', path: 'web/assets/style-references/ssj-03-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '几何墙面前的头肩近景，双眼、完整唇部与头顶可见', background: '浅中性墙与暖海军蓝门框',
    paletteIntent: '珊瑚橙、暖海军蓝、奶油白、明亮金棕', cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点', notice: 'AI 生成风格示例，非本人试妆效果。' }),
  Object.freeze({ ...solarBright, id: 'solar-bright-warm-outfit-v2', kind: 'outfit', path: 'web/assets/style-references/ssj-03-outfit-v2.png', width: 1024, height: 1536,
    scene: '城市步行 / 明快日常', composition: '全身自然迈步，头顶、手部、裤脚与双鞋完整', description: '珊瑚橙府绸上衣与奶油白长裤形成明快色块，以暖海军蓝鞋包稳定画面。',
    background: '浅中性石材步行街转角', paletteIntent: '奶油白、珊瑚橙、暖海军蓝、少量亮金', cropPolicy: '保留头顶、手部、裤脚与双鞋，使用完整画幅', notice: 'AI 生成风格示例，非本人试穿效果。' }),
  Object.freeze({
    ...clearGlaze, id: 'clear-glaze-balanced-beauty-v2', kind: 'beauty',
    path: 'web/assets/style-references/ssj-11-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '设计工作室中的轻侧头肩近景，双眼、完整唇部与头顶可见',
    background: '浅中性墙面与少量透明玻璃器皿折光',
    paletteIntent: '墨蓝、清水粉、清莓红、浅中性白、少量浅金银',
    cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点',
    notice: 'AI 生成风格示例，非本人试妆效果。',
  }),
  Object.freeze({
    ...clearGlaze, id: 'clear-glaze-balanced-outfit-v2', kind: 'outfit',
    path: 'web/assets/style-references/ssj-11-outfit-v2.png', width: 1024, height: 1536,
    scene: '设计庭院 / 清透日常', composition: '全身松弛站姿，头顶、手部、裙摆与双鞋完整',
    description: '孔雀绿垂坠衬衫搭墨蓝长裙，以清水粉小包形成轻盈点睛。',
    background: '玻璃砖与浅墙构成的安静城市小庭院',
    paletteIntent: '墨蓝、孔雀绿、清水粉、少量浅金银',
    cropPolicy: '保留头顶、手部、裙摆与双鞋，使用完整画幅',
    notice: 'AI 生成风格示例，非本人试穿效果。',
  }),
  Object.freeze({
    ...starlitNight, id: 'starlit-night-sharp-cool-beauty-v2', kind: 'beauty',
    path: 'web/assets/style-references/ssj-16-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '深石墨空间中的紧凑正面头肩近景，双眼、完整唇部与头顶可见',
    background: '中性深石墨墙面与明亮磨砂窗切面',
    paletteIntent: '星夜黑、冷艳莓红、铂金银、少量冰白',
    cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点',
    notice: 'AI 生成风格示例，非本人试妆效果。',
  }),
  Object.freeze({
    ...starlitNight, id: 'starlit-night-sharp-cool-outfit-v2', kind: 'outfit',
    path: 'web/assets/style-references/ssj-16-outfit-v2.png', width: 1024, height: 1536,
    scene: '城市步道 / 锐冷日常', composition: '全身侧向停步姿态，头顶、手部、裙摆与双鞋完整',
    description: '冰白细罗纹上衣与星夜黑结构裙建立极致明暗，以电光蓝小包收束。',
    background: '拉丝金属门面与中性灰铺地的当代城市步道',
    paletteIntent: '星夜黑、冰白、电光蓝、少量铂金银',
    cropPolicy: '保留头顶、手部、裙摆与双鞋，使用完整画幅',
    notice: 'AI 生成风格示例，非本人试穿效果。',
  }),
  Object.freeze({
    ...inkGlow, id: 'ink-glow-high-contrast-beauty-v2', kind: 'beauty',
    path: 'web/assets/style-references/ssj-12-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '冷白建筑空间中的正面头肩近景，双眼、完整唇部与头顶可见',
    background: '冷白石材与深墨金属线条，清晰中性窗光',
    paletteIntent: '墨黑、冷白、正红、微量冷玫瑰、银灰',
    cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点',
    notice: 'AI 生成风格示例，非本人试妆效果。',
  }),
  Object.freeze({
    ...inkGlow, id: 'ink-glow-high-contrast-outfit-v2', kind: 'outfit',
    path: 'web/assets/style-references/ssj-12-outfit-v2.png', width: 1024, height: 1536,
    scene: '城市工作 / 清晰通勤', composition: '建筑外廊中的全身停步姿态，头顶、手部、裤脚与双鞋完整',
    description: '墨黑剪裁与冷白衬衫建立清晰秩序，以小面积正红包袋点睛。',
    background: '冷白石材与深墨金属框的当代建筑入口',
    paletteIntent: '墨黑、冷白、正红、银灰',
    cropPolicy: '保留头顶、手部、裤脚与双鞋，使用完整画幅',
    notice: 'AI 生成风格示例，非本人试穿效果。',
  }),
  Object.freeze({
    ...peachBright, id: 'peach-bright-soft-beauty-v2', kind: 'beauty',
    path: 'web/assets/style-references/ssj-13-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '玻璃花房中的自然头肩近景，双眼、完整唇部与头顶可见',
    background: '浅奶油色玻璃花房与少量嫩绿植物光斑',
    paletteIntent: '蜜桃粉、杏花粉、柔金灰棕、奶油白、青瓷绿',
    cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点',
    notice: 'AI 生成风格示例，非本人试妆效果。',
  }),
  Object.freeze({
    ...peachBright, id: 'peach-bright-soft-outfit-v2', kind: 'outfit',
    path: 'web/assets/style-references/ssj-13-outfit-v2.png', width: 1024, height: 1536,
    scene: '花房漫步 / 轻松日常', composition: '全身自然步态，头顶、手部、裙摆与双鞋完整',
    description: '青瓷绿棉质长裙搭配奶油黄轻外套，以浅蜂蜜棕鞋包收尾。',
    background: '浅米石材与玻璃花房外廊，明亮柔和日光',
    paletteIntent: '青瓷绿、奶油黄、浅蜂蜜棕、暖白、少量杏花粉',
    cropPolicy: '保留头顶、手部、裙摆与双鞋，使用完整画幅',
    notice: 'AI 生成风格示例，非本人试穿效果。',
  }),
  Object.freeze({
    ...crystalDew, id: 'crystal-dew-clear-cool-beauty-v2', kind: 'beauty',
    path: 'web/assets/style-references/ssj-07-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '玻璃空间中的自然头肩近景，双眼、完整唇部与头顶可见',
    background: '当代玻璃与浅石材空间，明亮中性窗光',
    paletteIntent: '清莓红、薄雾粉、银灰、晶透冷白',
    cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点',
    notice: 'AI 生成风格示例，非本人试妆效果。',
  }),
  Object.freeze({
    ...crystalDew, id: 'crystal-dew-clear-cool-outfit-v2', kind: 'outfit',
    path: 'web/assets/style-references/ssj-07-outfit-v2.png', width: 1024, height: 1536,
    scene: '城市文化 / 明亮通勤', composition: '全身行走姿态，头顶、手部、裤脚与双鞋完整',
    description: '宝石蓝连体套装建立明快主轴，以冷白包袋和银色鞋履提亮。',
    background: '玻璃与浅石材文化空间外廊，明亮自然日光',
    paletteIntent: '宝石蓝、晶透冷白、银灰、少量清莓粉',
    cropPolicy: '保留头顶、手部、裤脚与双鞋，使用完整画幅',
    notice: 'AI 生成风格示例，非本人试穿效果。',
  }),
  Object.freeze({
    ...rockTea, id: 'rock-tea-steady-warm-beauty-v2', kind: 'beauty',
    path: 'web/assets/style-references/ssj-14-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '自然侧光头肩近景，双眼、完整唇部与头顶可见',
    background: '当代茶室的暖灰泥墙、原木与陶器虚化背景',
    paletteIntent: '肉桂豆沙、克制陶土、茶棕、暖灰米',
    cropPolicy: '保留双眼、完整唇部与头顶，不裁切妆容重点',
    notice: 'AI 生成风格示例，非本人试妆效果。',
  }),
  Object.freeze({
    ...rockTea, id: 'rock-tea-steady-warm-outfit-v2', kind: 'outfit',
    path: 'web/assets/style-references/ssj-14-outfit-v2.png', width: 1024, height: 1536,
    scene: '创意工作 / 松弛通勤', composition: '全身自然站姿，头顶、手部、裤脚与双鞋完整',
    description: '苔藓绿亚麻、象牙色针织与岩茶棕长裤，配植鞣深棕皮革。',
    background: '当代陶艺与石材工作室，柔和侧窗光',
    paletteIntent: '苔藓绿、岩茶棕、象牙色、暖灰米、深棕皮革',
    cropPolicy: '保留头顶、手部、裤脚与双鞋，使用完整画幅',
    notice: 'AI 生成风格示例，非本人试穿效果。',
  }),
  Object.freeze({
    ...moon, id: 'moonlight-veil-beauty-v2', kind: 'beauty',
    path: 'web/assets/style-references/ssj-05-beauty-v2.png', width: 1122, height: 1402,
    scene: '妆容配色参考', composition: '自然微笑头肩近景，双眼和完整唇部可见',
    background: '浅灰墙面与柔和窗光', paletteIntent: '冷粉、浅玫瑰、珠光灰紫',
    cropPolicy: '保留双眼与完整唇部，不裁切妆容重点',
    notice: 'AI 生成风格示例，非本人试妆效果。',
  }),
  Object.freeze({
    ...moon, id: 'moonlight-veil-outfit-v2', kind: 'outfit',
    path: 'web/assets/style-references/ssj-05-outfit-v2.png', width: 1024, height: 1536,
    scene: '周末日常 / 轻社交', composition: '全身自然站姿，月白裙摆与双鞋完整',
    description: '雾蓝上衣搭配月白长裙，以浅紫色包袋点缀。',
    background: '书店玻璃外墙与自然日光', paletteIntent: '月白、浅雾蓝、浅薰衣草、冷灰',
    cropPolicy: '保留头顶、裙摆与双鞋，使用完整画幅',
    notice: 'AI 生成风格示例，非本人试穿效果。',
  }),
  Object.freeze({
    ...shared,
    id: 'warm-spring-beauty-v2',
    kind: 'beauty',
    path: 'web/assets/style-references/ssj-02-beauty-v2.png',
    width: 1122, height: 1402,
    scene: '妆容配色参考',
    composition: '头肩近景，眼部与唇部清晰',
    background: '中性象牙白墙面，自然窗光',
    paletteIntent: '蜜桃豆沙、柔暖珊瑚、香槟米金',
    cropPolicy: '保留双眼与完整唇部，不裁切妆容重点',
    notice: 'AI 生成风格示例，非本人试妆效果。',
  }),
  Object.freeze({
    ...shared,
    id: 'warm-spring-outfit-v2',
    kind: 'outfit',
    path: 'web/assets/style-references/ssj-02-outfit-v2.png',
    width: 1024, height: 1536,
    scene: '日常通勤 / 轻社交',
    description: '燕麦米与暖米铺开柔和层次，以榛果棕细节点缀。',
    composition: '全身自然步态，鞋履与裙摆完整',
    background: '浅石庭院，柔和自然光',
    paletteIntent: '燕麦米、暖米、榛果棕',
    cropPolicy: '保留头顶、裙摆与双鞋，使用完整画幅',
    notice: 'AI 生成风格示例，非本人试穿效果。',
  }),
]);

// Every supported profile/use-case has an explicit slot. Null is an honest
// missing asset, never permission to borrow an image from another profile.
export const STYLE_REFERENCE_PROFILE_MAP = Object.freeze(Object.fromEntries(
  Array.from({ length: 16 }, (_, index) => {
    const code = 'SSJ-' + String(index + 1).padStart(2, '0');
    return [code, Object.freeze({
      beauty: styleReferenceCatalog.find(a => a.profileId === code && a.kind === 'beauty')?.id ?? null,
      outfit: styleReferenceCatalog.find(a => a.profileId === code && a.kind === 'outfit')?.id ?? null,
    })];
  }),
));

export function selectProfileStyleReference({ profileId, kind, scope } = {}) {
  if (!['staging', 'production'].includes(scope)) return { asset: null, reason: 'not-released' };
  if (!['beauty', 'outfit'].includes(kind)) return { asset: null, reason: 'unsupported-kind' };
  if (!Object.hasOwn(STYLE_REFERENCE_PROFILE_MAP, profileId)) return { asset: null, reason: 'unknown-profile' };
  const id = STYLE_REFERENCE_PROFILE_MAP[profileId][kind];
  const asset = styleReferenceCatalog.find(item =>
    item.id === id && item.profileId === profileId && item.kind === kind &&
    item.status === 'released');
  return asset ? { asset, reason: null } : { asset: null, reason: 'missing-exact-match' };
}

/** Exact local sample lookup; never substitutes across profiles or use cases. */
export function selectStyleReference({ sampleKey, kind, scope } = {}) {
  if (scope !== 'local-preview') return { asset: null, reason: 'not-released' };
  if (!['beauty', 'outfit'].includes(kind)) return { asset: null, reason: 'unsupported-kind' };
  const asset = styleReferenceCatalog.find(item =>
    item.sampleKey === sampleKey && item.kind === kind && item.status === 'released');
  return asset ? { asset, reason: null } : { asset: null, reason: 'missing-exact-match' };
}
