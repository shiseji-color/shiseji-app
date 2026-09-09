---
name: "拾色季"
description: "以私人色彩档案揭幕为核心的克制、温暖、可珍藏的编辑式设计系统"
colors:
  paper: "#FBF8F3"
  canvas: "#F7F4F0"
  surface: "#FFFDFC"
  surface-muted: "#F2EAE5"
  ink: "#3D342F"
  cocoa: "#51433C"
  muted-ink: "#6F6058"
  archive-index: "#957567"
  tea-rose: "#B97861"
  focus: "#8B5B49"
  hairline: "rgba(125, 94, 78, 0.22)"
  ivory-pink: "#E7D5C8"
  soft-clay: "#C99A8C"
  warm-taupe: "#B89A7D"
  moss-grey: "#8C8A78"
typography:
  display:
    fontFamily: "ui-serif, STZhongsong, Songti SC, Noto Serif CJK SC, SimSun, serif"
    fontSize: "clamp(2.15rem, 5vw, 4.35rem)"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.055em"
  title:
    fontFamily: "ui-serif, STZhongsong, Songti SC, Noto Serif CJK SC, SimSun, serif"
    fontSize: "clamp(1.25rem, 2.8vw, 1.8rem)"
    fontWeight: 400
    letterSpacing: "0.08em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: "0.055em"
  index:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.58rem"
    fontWeight: 400
    letterSpacing: "0.2em"
rounded:
  archival: "0"
  action: "0.2rem"
  control: "16px"
  shell: "clamp(1.5rem, 4vw, 3rem)"
spacing:
  micro: "0.45rem"
  compact: "0.7rem"
  base: "1rem"
  mobile-gutter: "1.25rem"
  section: "2rem"
  editorial-gap: "clamp(2rem, 6vw, 5.25rem)"
components:
  archive-action:
    backgroundColor: "{colors.cocoa}"
    textColor: "{colors.surface}"
    rounded: "{rounded.action}"
    height: "3.5rem"
    padding: "0.875rem 1.25rem"
  archive-field:
    backgroundColor: "rgba(255, 255, 255, 0.28)"
    textColor: "{colors.ink}"
    rounded: "{rounded.archival}"
    height: "3.5rem"
    padding: "1rem"
---

# Design System: 拾色季

## Overview

**Creative North Star: “私人色彩档案的揭幕”**

主页不是说明工具功能的营销卡，而是一份只属于用户的档案被缓慢打开。暖象牙纸、茶玫瑰人像、编号、细线和色谱共同建立可保存、可回看的珍藏感；高级感来自内容秩序、真实人物和克制仪式，不来自装饰堆叠。

设计论点：用户先感到“这是我的色彩身份”，再理解一张真实照片将生成本命色、妆容与穿搭方向，最后才用 12 位专属密钥开启档案。品牌承诺是照见与肯定自己，不制造外貌焦虑，不暗示用户必须改变。

**Key Characteristics:**

- 编辑式双栏、档案编号与细线索引，而非居中标题加功能卡。
- 真实自然窗光、茶玫瑰色调的主导人像；色彩克制、轻降饱和。
- 衬线体承载身份，无衬线体负责说明，等宽体负责编号与索引。
- 色彩身份、可验证产物、档案入口构成唯一叙事顺序。
- 方向键：`archive-unveiling-20260825`。

## Colors

以暖象牙纸、深可可墨和低饱和茶玫瑰构成；强调色稀少且总与档案语义或状态有关。前置 YAML 是颜色值的规范来源。

### Primary

- **暖象牙纸：** 页面与档案底色，形成纸张而非纯白应用面板的感觉。
- **深可可墨：** 主标题、主按钮和最重要的信息，保证温暖而清晰的对比。
- **茶玫瑰：** 品牌提案、索引、状态和少量记忆点，不做大面积促销色块。

### Neutral

- **柔白表面：** 输入、弹层和需要与纸面分离的功能表面。
- **暖灰文字：** 正文与说明；不得承担关键操作的唯一状态表达。
- **档案细线：** 只用于分段、索引和秩序，不把每块内容框成卡片。

### Secondary

- **身份色谱：** 象牙粉、柔陶粉、暖灰棕、苔灰绿与茶玫瑰横向成带，用来预告报告内容；不得演变成彩虹渐变或无语义装饰。

**The Rare Accent Rule.** 茶玫瑰只标记身份、索引或状态；大面积背景由纸色与真实人像承担。

## Typography

**Display Font:** 中文宋体/衬线系统栈。

**Body Font:** 系统无衬线栈。
**Index Font:** 系统等宽栈。

**Character:** 大标题轻字重、宽松字距，像档案封面题名；正文紧凑但行距舒展；英文标签与编号冷静、精确。

### Hierarchy

- **Display：** 只用于首屏身份主张和报告关键结论；移动端为 `clamp(1.85rem, 8.3vw, 2.35rem)`、行高 `1.12`，避免标题挤占主图与行动入口。
- **Title：** 用于档案入口与分区标题，不与 Display 竞争。
- **Body：** 用于价值说明与帮助文本，短行优先，避免大段居中排版。
- **Index：** 全大写英文、档案编号、栏目索引；高字距、小字号，只作结构提示。

**The Three Voices Rule.** 衬线体讲身份，无衬线体讲说明，等宽体讲编号；不要互换职责或加入第四套装饰字体。

## Layout

叙事顺序固定为：品牌签名 → 档案编号与身份主张 → 主导人像与示例色谱 → 可生成内容索引 → 专属密钥入口。主图与身份主张先建立价值，密钥紧接主图出现但不得压过它们。

桌面激活态容器上限 `62rem`。主档案为两列：文字约 `0.95fr`、人像约 `1.05fr`；入口区延续双列。主列使用 `editorial-gap`，内部按 `0.7–2rem` 组织，外侧留白大于卡片内填充。

`699px` 及以下把获批概念图作为视觉母版，而不是把 972×1619 整张海报缩进浏览器。首屏拆为真实网页层：品牌与档案编号、身份主张、人物主视觉裁切、色谱索引、专属密钥与开启按钮。人物和纸张质感来自概念图，文字、输入和按钮必须保持原生可读、可聚焦、可触摸。关键操作进入首屏并避开 Safari 底栏，底部叠加 `env(safe-area-inset-bottom)`，首次触摸必须立即反馈。

**The One Reveal Rule.** 每个视口只讲一次“档案揭幕”；不在下方重复英雄标题、再造功能宫格或追加营销证据墙。

## Elevation & Depth

以纸张层级、真实影像、细线和少量环境阴影建立深度。激活壳使用宽而轻的阴影，人像使用次一级阴影；档案内容与入口默认平坦。毛玻璃只允许在主图色谱托片或有遮罩语义的弹层，不能成为通用卡片材质。

动效是“揭页”而非“弹跳”：文字与入口轻微上移淡入，人像纵向裁切揭示；进入节奏 `0.68–0.86s`，缓动 `cubic-bezier(.2,.7,.2,1)`。交互状态用 `160–300ms` 颜色/边框过渡。`prefers-reduced-motion` 下不播放进入动效，状态变化仍需立即可见。

**The Flat Archive Rule.** 内容靠排版、线条和留白分层；静止状态不为每个区块添加阴影。

## Shapes

主形语言是直边、细线与矩形裁切：主图、色谱、输入下划线和内容分区保持直角。仅最外层壳、既有上传/弹层控件和必须强调可点击性的功能控件保留柔和圆角；主操作按钮接近方形的小圆角，不用胶囊形。

边框通常为 `1px` 低对比暖灰线。输入聚焦时下划线增至 `2px` 并切换焦点色；同时保留清晰键盘焦点，不以阴影代替。

**The No Card Stack Rule.** 不把标题、主图、色谱、入口分别包进圆角白卡；它们属于同一份连续档案。

## Components

### Activation Archive

- **Shell：** 仅当 `#step-activation` 可见时启用宽版档案布局；此作用域是硬边界。
- **Folio：** `PRIVATE COLOR ARCHIVE` 与档案编号分置两端，使用等宽小字和高字距。
- **Portrait：** 固定使用获批概念原图 `web/assets/color-archive-concept.png`，并以 `references/candidate-original-concept.png` 为视觉权威；保留自然窗光、暖象牙服装、档案纸张、索引与印章。桌面继续使用横向档案裁切；移动端裁取人物与纸张主体，以真实 HTML 重建色谱和档案入口，不复刻图内不可交互的输入区。图上附加信息不得遮挡面部。
- **Palette strip：** 五段横向色谱，第一段稍宽；半透明纸色托片只服务可读性。

### Archive Access

- **Field：** `#activationCode` 后端仍校验 12 位密钥，但前端统一显示“专属密钥”，不反复强调长度；平坦纸面配下划线，居中输入并保留明确聚焦态。帮助文案使用平台中性表述“密钥已自动下发至店铺聊天框”。
- **Action：** `#activationSubmit` 高度不小于 `3.5rem`，小圆角、深可可底；禁用态用浅纸灰与边框，不能只降低不透明度。
- **Feedback：** `#activationStatus` 实时状态、`aria-invalid`、禁用状态和帮助入口必须持续可用；视觉改动不得延迟首次点击反馈。

### Behavior Compatibility Contract

以下 ID 是行为接口，不是可随重构改名的样式钩子：

- **框架与激活：** `appHeader`、`mainContainer`、`step-activation`、`activation-title`、`activationCode`、`activationHelp`、`activationStatus`、`activationSubmit`。
- **上传与分析：** `step-upload`、`dropzone-file`、`imagePreview`、`uploadText`、`privacyConsent`、`photoQuality`、`analyzeBtn`、`restoreContainer`、`step-loading`、`loadingText`、`analysisSteps`、`analysisRecoveryBtn`。
- **报告与保存：** `step-result`、`captureArea`、`report-palette`、`report-identity`、`report-styling`、`report-beauty`、`report-outfit`、`report-advice`、`saveBtn`、`xhsSaveBtn`、`saveOverlay`。

主页视觉层只能作用于激活态。上传照片、隐私确认、分析进度、恢复任务、完整报告、六页 3:4 分享图、保存/分享弹层及可访问状态均为不可回归流程；不得改变字段语义、事件绑定、扣次提示、报告数据映射、捕获尺寸或导出顺序。

## Do's and Don'ts

### Do:

- **Do** 让用户先看到色彩身份，再看到可生成内容，最后看到密钥动作。
- **Do** 用真实人像、编辑式排版、编号、细线和色谱建立信任与珍藏感。
- **Do** 保持标签、键盘焦点、足够触摸面积、可读对比度、状态提示和减少动态效果支持。
- **Do** 将主页新样式严格限定在 `#step-activation` 可见时，并在桌面与 iPhone Safari 同时复核。
- **Do** 只在 staging 做视觉与等效流程验证；staging 不调用真实模型，不访问或部署生产。
- **Do** 让报告中的个性化结论只来自实际分析结果。

### Don't:

- **Don't** 回到“居中大标题 + 功能卡 + 大按钮”的通用工具首屏，或堆叠圆角卡、胶囊、彩虹渐变与无语义玻璃面板。
- **Don't** 用装饰压过主导人像、色彩身份与档案入口，也不要在图上遮挡面部。
- **Don't** 修改或删除行为 ID，不让激活态 CSS 泄漏到上传、分析、报告和分享图。
- **Don't** 编造客户评价、媒体背书、量化效果、商业证明或不来自分析结果的个性化结论。
- **Don't** 以 staging 名义触发真实模型、生产数据、生产部署或其他不可逆外部操作。

## 2026-09-07 首页精修决定

在既有纸张、人像与茶棕色体系内精修：移除主页 PRIVATE COLOR ARCHIVE、SSJ·01、PRIVATE ACCESS 装饰文字；保留品牌英文签名。密钥入口以五段固定品牌色谱连接主图和行动，取代重复的英文索引。输入与按钮采用小圆角、纸色底与克制边线；禁用状态仍清楚区分，启用状态使用深茶棕。

移动端保持单层主图和图内居中短色卡，帮助链接与密钥标签同排，44px触摸目标与16px输入字号不变。此决定替代上文对首页英文编号必须出现的旧描述；不改变报告结构、内容和导出。

2026-09-07补充：入口色谱成为主页唯一的网页色谱标识。主图上的preview-cover-content整体隐藏，消除重复色卡及白色底托；顶部COLOR SEASON与图片素材自身英文保留。此条替代此前“手机主图内保留短色卡”的旧要求，报告色卡不受影响。
