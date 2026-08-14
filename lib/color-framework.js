export const COLOR_DIMENSION_OPTIONS = Object.freeze([
  { key: 'skin_temperature', name: '肤色冷暖倾向', low: '偏冷', high: '偏暖' },
  { key: 'skin_lightness', name: '肤色明度', low: '偏深', high: '偏浅' },
  { key: 'skin_clarity', name: '肤色清透度', low: '偏雾', high: '清透' },
  { key: 'skin_softness', name: '肤色柔和度', low: '鲜明', high: '柔和' },
  { key: 'cheek_temperature', name: '面颊色调', low: '偏冷', high: '偏暖' },
  { key: 'lip_temperature', name: '原生唇色倾向', low: '偏冷', high: '偏暖' },
  { key: 'eye_depth', name: '瞳孔深浅', low: '偏浅', high: '偏深' },
  { key: 'eye_clarity', name: '瞳孔清晰度', low: '柔雾', high: '清晰' },
  { key: 'hair_depth', name: '原生发色深浅', low: '偏浅', high: '偏深' },
  { key: 'hair_temperature', name: '原生发色冷暖', low: '偏冷', high: '偏暖' },
  { key: 'hair_skin_contrast', name: '发肤对比度', low: '低对比', high: '高对比' },
  { key: 'facial_contrast', name: '五官整体对比度', low: '低对比', high: '高对比' },
  { key: 'depth_capacity', name: '深色承载力', low: '较弱', high: '较强' },
  { key: 'brightness_capacity', name: '明亮色承载力', low: '较弱', high: '较强' },
  { key: 'chroma_capacity', name: '鲜艳色承载力', low: '较弱', high: '较强' },
  { key: 'muted_capacity', name: '柔雾色适配度', low: '较弱', high: '较强' },
]);

const profile = (code, name, en, target, keywords, palette, avoid, copy) =>
  Object.freeze({ code, name, en, target, keywords, palette, avoid, ...copy });

export const COLOR_IDENTITY_OPTIONS = Object.freeze([
  profile('SSJ-01', '晨露浅暖', 'Dawn Warm', [76, 84, 64, 55, 34], ['轻盈', '温润', '晨光感'], [['杏仁奶油','#F2D6B8'],['浅杏粉','#EAB89E'],['蜜瓜橙','#E9A06F'],['香草黄','#E8CF83'],['嫩芽绿','#A9B883'],['浅驼色','#C8A486'],['香槟金','#CDAA63'],['可可棕','#806656']], ['冷黑色','蓝紫色','冰灰色'], { makeup:'杏桃唇色、浅杏腮红与香槟米金眼妆。', outfit:'奶油白、浅杏与嫩芽绿做轻盈低对比搭配。', accessory:'优先细巧香槟金、浅金珍珠与暖米色皮具。', style:'清晨自然光、轻薄针织与细腻浅金饰品。' }),
  profile('SSJ-02', '杏光柔暖', 'Soft Apricot', [72, 70, 43, 82, 30], ['柔暖', '细腻', '低对比'], [['裸杏玫瑰','#CFA08D'],['蜜桃豆沙','#D58F7C'],['燕麦米','#D9C3A8'],['柔沙棕','#A98A72'],['鼠尾草绿','#9EA68E'],['陶土粉','#BC7E70'],['雾金色','#BCA06C'],['柔炭棕','#78665E']], ['荧光玫粉','冷硬纯黑','冰冷浅灰'], { makeup:'蜜桃豆沙唇、杏粉薄扫与柔可可棕眼妆。', outfit:'裸杏、燕麦与柔沙棕同色系叠搭，保持低对比。', accessory:'雾面香槟金、柔棕皮具与珍珠母贝更协调。', style:'柔焦午后、磨砂材质与安静温暖的低对比层次。' }),
  profile('SSJ-03', '日曜明暖', 'Solar Bright', [82, 72, 88, 28, 70], ['明亮', '热烈', '清晰'], [['珊瑚橙','#F07E62'],['番茄红','#E85A48'],['向日葵黄','#F2C84B'],['清亮绿','#63A96B'],['孔雀蓝','#218B91'],['奶油白','#FFF0D3'],['亮驼色','#C98F5B'],['暖海军蓝','#31566B']], ['灰粉色','烟灰紫','浑浊卡其'], { makeup:'清透珊瑚唇、暖橙腮红与明亮金棕眼妆。', outfit:'用一处高纯度暖色做视觉焦点，搭配干净奶油白。', accessory:'亮金、黄铜与线条清晰的暖色配件。', style:'正午阳光、清晰轮廓与饱满明快的色彩节奏。' }),
  profile('SSJ-04', '琥珀深暖', 'Deep Amber', [78, 28, 58, 48, 78], ['深暖', '浓郁', '沉稳'], [['琥珀棕','#9A5D3D'],['砖红色','#A94F3F'],['南瓜橙','#C66A32'],['橄榄绿','#667044'],['芥末金','#B89032'],['深驼色','#87654E'],['象牙白','#EADBC4'],['浓咖啡','#4C352D']], ['冰蓝色','荧光粉','纯白色'], { makeup:'砖红或暖浆果唇、肉桂腮红与深金棕眼妆。', outfit:'深咖、橄榄与琥珀色建立稳重层次，象牙白提亮。', accessory:'古金、黄铜、琥珀与深棕皮革。', style:'黄昏暖光、厚实天然材质与深沉有重量的色彩。' }),
  profile('SSJ-05', '月纱浅冷', 'Moonlight Veil', [25, 84, 57, 68, 30], ['清冷', '轻柔', '月光感'], [['月光白','#F1EEF3'],['樱花粉','#E8C2CE'],['浅薰衣草','#CFC5DF'],['雾霾蓝','#AABFD0'],['薄荷灰绿','#B9CDC7'],['冷米灰','#D5D1D3'],['玫瑰银','#B8A8B5'],['蓝灰色','#788895']], ['橙红色','芥末黄','浓咖色'], { makeup:'冷粉唇、淡玫瑰腮红与珍珠灰紫眼妆。', outfit:'月光白、雾蓝和浅薰衣草保持轻柔低对比。', accessory:'亮银、白金、冷调珍珠与灰蓝配件。', style:'月光薄纱、通透银饰与轻冷柔和的浅色层次。' }),
  profile('SSJ-06', '雾蓝柔冷', 'Misty Blue', [23, 60, 38, 88, 32], ['柔冷', '安静', '雾感'], [['灰玫瑰','#B58F9C'],['雾蓝色','#879EAD'],['李子灰','#796878'],['灰紫色','#9B8EA4'],['冷鼠尾草','#879A94'],['柔海军蓝','#4F6070'],['贝壳灰','#D4CED0'],['炭灰色','#625F65']], ['亮橙色','荧光黄','暖驼色'], { makeup:'灰玫瑰唇、冷豆沙腮红与雾紫灰棕眼妆。', outfit:'雾蓝、灰紫与柔海军蓝做低对比哑光叠搭。', accessory:'哑光银、旧银、灰珍珠与磨砂皮具。', style:'薄雾清晨、哑光银饰与轻柔针织的安静气质。' }),
  profile('SSJ-07', '晶露明冷', 'Crystal Dew', [18, 72, 90, 20, 74], ['清亮', '冷艳', '晶透'], [['宝石蓝','#1769AA'],['冷玫红','#D72B70'],['蓝紫色','#6654B7'],['翡翠绿','#128B78'],['冰粉色','#F1B8D0'],['纯白色','#FAFAFC'],['亮银色','#BFC7D1'],['冷海军蓝','#183D62']], ['土橙色','芥末黄','浑浊米色'], { makeup:'清亮莓红唇、冷粉腮红与银灰蓝紫眼妆。', outfit:'宝石色与纯白形成清晰对比，控制颜色数量。', accessory:'亮银、白金、水晶与线条利落的冷色配件。', style:'清澈冬日光、镜面金属与鲜明纯净的色彩切面。' }),
  profile('SSJ-08', '暮蓝深冷', 'Twilight Blue', [16, 24, 60, 35, 88], ['深冷', '克制', '夜色感'], [['深海军蓝','#1D2F4B'],['黑莓色','#592E4A'],['酒红色','#722F43'],['深松绿','#234D48'],['冷紫色','#493A62'],['冰灰色','#C8CCD5'],['白金色','#C7C9CE'],['炭黑色','#22242A']], ['橙棕色','杏黄色','暖驼色'], { makeup:'黑莓或酒红唇、冷玫瑰腮红与深灰紫眼妆。', outfit:'深海军蓝、黑莓和炭黑构成高质感深色层次。', accessory:'白金、冷银、黑色皮革与深色宝石。', style:'暮色城市、丝绒与冷金属形成克制而深邃的轮廓。' }),
  profile('SSJ-09', '珍珠浅净', 'Pearl Light', [50, 88, 76, 54, 28], ['浅净', '柔亮', '珍珠感'], [['珍珠白','#F3EEE8'],['贝壳粉','#E6C7C3'],['浅水蓝','#BFD6DE'],['嫩紫色','#D6CBE2'],['清浅绿','#C4D6C3'],['浅灰褐','#C8BDB5'],['柔金银','#C9BFB2'],['可可灰','#817A78']], ['暗黑色','浓橘红','深酒红'], { makeup:'贝壳粉唇、浅玫瑰腮红与柔金灰棕眼妆。', outfit:'珍珠白搭配一至两种浅净色，保持通透留白。', accessory:'浅金银、珍珠母贝与轻盈小体量配饰。', style:'珍珠柔光、轻盈织物与干净不偏冷暖的浅色空间。' }),
  profile('SSJ-10', '烟霞柔和', 'Muted Rosy', [48, 55, 34, 91, 27], ['柔雾', '雅致', '含蓄'], [['烟霞粉','#B78F8D'],['灰豆沙','#9E7B7E'],['灰紫褐','#81727B'],['雾绿灰','#89938A'],['藕荷色','#A38C9E'],['燕麦灰','#C7BBB1'],['旧金色','#A9936F'],['柔煤灰','#666064']], ['荧光色','纯黑白撞色','明亮橙黄'], { makeup:'灰豆沙唇、烟粉腮红与藕灰棕眼妆。', outfit:'烟霞粉、雾绿灰和燕麦灰低对比叠搭。', accessory:'旧金、哑银、灰珍珠与绒面配件。', style:'阴天柔光、水彩晕染与安静雅致的灰调层次。' }),
  profile('SSJ-11', '琉璃清透', 'Clear Glaze', [52, 66, 92, 18, 72], ['清透', '醒目', '利落'], [['琉璃蓝','#267AA3'],['清莓红','#C83D68'],['孔雀绿','#218A78'],['明紫色','#7555A3'],['柠檬白','#F7F2D8'],['清水粉','#E7A9B8'],['亮金银','#C6B991'],['墨蓝色','#263B59']], ['灰棕色','浑浊卡其','烟粉色'], { makeup:'清莓红唇、净粉腮红与清晰灰棕眼线。', outfit:'清透色与墨蓝或亮白形成利落而不过度的对比。', accessory:'抛光金银、水晶与轮廓简洁的现代配件。', style:'玻璃折光、平滑材质与清晰有节奏的现代配色。' }),
  profile('SSJ-12', '墨曜高对比', 'Ink Contrast', [45, 22, 82, 18, 94], ['锐利', '高对比', '都会感'], [['墨黑色','#15171C'],['正红色','#B51F32'],['皇家蓝','#163F83'],['深紫色','#3E285A'],['冷白色','#F4F5F7'],['银灰色','#AEB4BE'],['祖母绿','#0F6957'],['深酒红','#5A2031']], ['浅驼色','灰杏色','浑浊橄榄'], { makeup:'正红或深莓唇、清晰轮廓与冷调深色眼妆。', outfit:'墨黑、冷白与宝石色建立干净高对比。', accessory:'亮银、白金、黑色漆皮与几何配饰。', style:'夜间都会、光泽材质与黑白宝石色的锐利秩序。' }),
  profile('SSJ-13', '蜜桃明柔', 'Peach Bloom', [70, 78, 58, 76, 24], ['蜜桃感', '明柔', '亲和'], [['蜜桃粉','#E6A08C'],['杏花粉','#EAB7A8'],['奶油黄','#EAD89B'],['浅珊瑚','#DC8C78'],['青瓷绿','#AAC4AE'],['暖天蓝','#9FC2CD'],['浅蜂蜜','#C7A66D'],['奶咖色','#9C806E']], ['深黑色','冷紫色','荧光玫红'], { makeup:'蜜桃粉唇、杏花腮红与浅蜂蜜棕眼妆。', outfit:'蜜桃粉、奶油黄和青瓷绿营造亲和明柔感。', accessory:'浅金、玫瑰金与轻巧圆润的暖色配件。', style:'春日花瓣、奶油光线与轻快亲和的柔亮配色。' }),
  profile('SSJ-14', '岩茶稳暖', 'Earthy Tea', [68, 38, 42, 72, 60], ['稳暖', '自然', '质朴'], [['岩茶棕','#80624D'],['肉桂色','#A66E52'],['陶土红','#A85F4F'],['苔藓绿','#67705A'],['茶金色','#AD8B4F'],['暖灰米','#B9AA98'],['象牙色','#DFD1BD'],['深橄榄','#4D5140']], ['冰粉色','宝石蓝','纯白色'], { makeup:'肉桂豆沙唇、陶土腮红与茶棕眼妆。', outfit:'岩茶、苔藓绿与暖灰米做有材质感的稳暖搭配。', accessory:'古金、木质、琥珀与植鞣深棕皮革。', style:'自然土壤、粗纺亚麻与茶色木质的稳定温度。' }),
  profile('SSJ-15', '银雾静冷', 'Silver Mist', [28, 46, 35, 90, 42], ['静冷', '灰调', '理性'], [['银雾灰','#A6A7AE'],['冷灰蓝','#718493'],['灰葡萄','#756A78'],['冷杉绿','#536A65'],['干枯玫瑰','#9B767E'],['石英灰','#C2BEC1'],['旧银色','#969BA3'],['炭蓝灰','#444E5B']], ['亮橙色','金黄色','暖珊瑚'], { makeup:'干枯玫瑰唇、灰粉腮红与冷灰紫眼妆。', outfit:'银雾灰、冷杉绿与炭蓝灰构成安静理性层次。', accessory:'哑银、枪灰、灰珍珠与简洁磨砂材质。', style:'雨后水泥、雾面金属与安静克制的冷灰秩序。' }),
  profile('SSJ-16', '星夜锐冷', 'Starlit Night', [12, 18, 94, 12, 98], ['锐冷', '纯净', '星夜感'], [['星夜黑','#0C1020'],['电光蓝','#124EAF'],['冷艳红','#C0184B'],['紫罗兰','#552B87'],['冰白色','#F7F8FC'],['铂金银','#C7CDD8'],['翡翠绿','#00735E'],['深靛蓝','#172751']], ['米驼色','灰橙色','暖卡其'], { makeup:'冷艳红或深莓唇、锋利眼线与冰银高光。', outfit:'星夜黑与冰白形成极致对比，加入单一宝石色。', accessory:'铂金、亮银、黑色宝石与锐利几何线条。', style:'星夜灯光、高光泽表面与极致冷锐的黑白宝石色。' }),
]);

export const COLOR_IDENTITY_CODES = new Set(COLOR_IDENTITY_OPTIONS.map(({ code }) => code));
export const COLOR_DIMENSION_KEYS = COLOR_DIMENSION_OPTIONS.map(({ key }) => key);

function dimensionMap(dimensionData) {
  return Object.fromEntries(dimensionData.map(({ key, value }) => [key, Number(value)]));
}

export function deriveColorAxes(dimensionData) {
  const d = dimensionMap(dimensionData);
  return {
    warmth: (d.skin_temperature + d.cheek_temperature + d.lip_temperature + d.hair_temperature) / 4,
    lightness: (d.skin_lightness + d.brightness_capacity + (100 - d.eye_depth) + (100 - d.hair_depth)) / 4,
    clarity: (d.skin_clarity + d.eye_clarity + d.chroma_capacity) / 3,
    softness: (d.skin_softness + d.muted_capacity + (100 - d.facial_contrast)) / 3,
    contrast: (d.hair_skin_contrast + d.facial_contrast + d.depth_capacity) / 3,
  };
}

export function rankColorIdentities(dimensionData) {
  const axes = deriveColorAxes(dimensionData);
  const values = [axes.warmth, axes.lightness, axes.clarity, axes.softness, axes.contrast];
  return COLOR_IDENTITY_OPTIONS
    .map((candidate) => ({
      ...candidate,
      distance: Math.sqrt(candidate.target.reduce(
        (sum, target, index) => sum + ((values[index] - target) ** 2),
        0,
      )),
    }))
    .sort((first, second) => first.distance - second.distance);
}

export function assessColorIdentity(dimensionData) {
  const [primary, secondary] = rankColorIdentities(dimensionData);
  const margin = secondary.distance - primary.distance;
  const level = margin < 2 ? 'low' : margin < 5 ? 'medium' : 'high';
  const messages = {
    low: `本次照片更接近${primary.name}，但与${secondary.name}非常接近；建议在稳定自然光下复测确认。`,
    medium: `本次照片主要呈现${primary.name}倾向，同时保留少量${secondary.name}特征。`,
    high: `本次照片呈现出较明确的${primary.name}倾向。`,
  };
  return {
    level,
    margin: Number(margin.toFixed(2)),
    primary: {
      code: primary.code,
      name: primary.name,
      distance: Number(primary.distance.toFixed(2)),
    },
    secondary: {
      code: secondary.code,
      name: secondary.name,
      distance: Number(secondary.distance.toFixed(2)),
    },
    message: messages[level],
  };
}

export function selectColorIdentity(dimensionData) {
  return rankColorIdentities(dimensionData)[0];
}

export function applyIdentityKnowledge(result) {
  const assessment = assessColorIdentity(result.dimension_data);
  const identity = COLOR_IDENTITY_OPTIONS.find(({ code }) => code === assessment.primary.code);
  const axes = deriveColorAxes(result.dimension_data);
  return {
    ...result,
    identity_code: identity.code,
    season_name: identity.name,
    season_en: identity.en,
    style_keywords: [...identity.keywords],
    radar_data: [
      { name: '冷暖', value: Math.round(axes.warmth), desc: axes.warmth >= 55 ? '偏暖色更容易提气色' : axes.warmth <= 45 ? '偏冷色更容易显清透' : '冷暖相对均衡' },
      { name: '明度', value: Math.round(axes.lightness), desc: axes.lightness >= 60 ? '中浅色更轻盈' : '中深色更有支撑感' },
      { name: '纯度', value: Math.round(axes.clarity), desc: axes.clarity >= 60 ? '清晰颜色更衬五官' : '降低饱和度更协调' },
      { name: '柔和度', value: Math.round(axes.softness), desc: axes.softness >= 60 ? '柔和过渡更自然' : '清晰边界更利落' },
      { name: '对比度', value: Math.round(axes.contrast), desc: axes.contrast >= 60 ? '可承载较明显反差' : '低对比搭配更耐看' },
    ],
    best_colors: identity.palette.map(([name, hex]) => ({ name, hex })),
    makeup_advice: identity.makeup,
    outfit_advice: identity.outfit,
    accessory_advice: identity.accessory,
    style_reference: identity.style,
    avoid_colors: [...identity.avoid],
    identity_assessment: assessment,
  };
}

export function frameworkPromptReference() {
  const dimensions = COLOR_DIMENSION_OPTIONS
    .map(({ key, name, low, high }) => `${key}=${name}（0=${low}，100=${high}）`)
    .join('；');
  return `你只负责照片质量与16维可见特征观察，不负责最终色彩身份判定。\n拾色季16维观察项与评分方向：${dimensions}`;
}
