# 生产候选版本核验记录（2026-09-08）

## 当前结论

代码与本地发布包已达到候选版本标准，并已发布到唯一获准的 staging 项目。正式生产环境尚未发布。

## 已完成

- 首页、上传、隐私同意、分析等待与报告页面已完成视觉和交互收口。
- 32 张 V2 风格参考图完整覆盖 SSJ-01 至 SSJ-16 的妆容与穿搭用途。
- production 运行范围只允许选择 `released` 状态、档案编号和用途都精确匹配的资产；缺图时明确降级，不跨分类借图。
- 低置信结果继续显示不确定性说明；所有示例图继续标记为 AI 虚构人物，非本人试妆或试穿效果。
- 手机长图的圆点和文字改为同一画布绘制；妆容、穿搭及首页关键词色点已由用户在移动 Safari 实机确认。
- 完整项目根目录构建成功，`dist/` 包含 32 张 V2 资产。
- Vercel `shiseji-staging` 部署 `dpl_Ce6oQkbLF7wdgGXwUbjEuZydC5Yy` 状态为 READY，已绑定 `https://staging.shiseji.com`。

## 验证证据

- `npm run check`：通过。
- `npm test`：191/191 通过。
- `npm run build`：通过。
- `npm audit --omit=dev --audit-level=high`：0 个漏洞。
- `git diff --check`：无空白错误；只有 Windows 行尾提示。
- 本地报告端到端：390×844 与 1440×900 均无控制台错误、破图或横向溢出；均成功生成 6 页图册和 1 张长图。
- 本地参考图导出：移动长图 1055×15199，桌面长图 1980×14290，均在 Safari 画布上限内。
- staging 安全冒烟：主页、核心资源、安全响应头与密钥格式拦截通过；未调用分析或图片模型。
- staging 环境变量名称与 Production 作用域齐全；秘密值保持隐藏。`SHARED_RATE_LIMIT_ENABLED=false`，与 SU-464011 约束一致。
- staging 造型图开关通过线上非计费空请求验证：在鉴权、存储、队列和模型调用之前固定返回 503 与 `Retry-After: 300`。
- staging 预报告流程：390×844 与 1440×900 的首页、激活入口、上传、隐私同意、等待及取消均通过，无错误、溢出或意外 API 请求；主图重复色卡保持隐藏。
- staging 报告导出：两个视口均成功生成 6 页图册和 1 张长图；尺寸分别为 1055×15199 与 1980×14290，无破图、溢出、控制台错误或意外 API 请求。
- 已确认线上公开构建文件包含 `released` 状态、production 精确映射且不再包含 `staging-candidate`。
- 部署后错误日志查询未发现记录；这只能证明当前无已记录错误，不能替代正式生产监控和告警。
- 移动 Safari 实机确认见 `artifacts/safari-cues-20260907/verification.md`。

## 尚需外部完成的发布门禁

- 正式生产发布仍需生产环境负责人确认备份/PITR、环境变量、监控与告警、回滚负责人和发布观察窗口。
- 共享 Supabase 限流继续保持关闭，等待工单 SU-464011；不得启用 `SHARED_RATE_LIMIT_ENABLED`，不得重启、轮换密钥或输出秘密。
- 只允许发布到 Vercel 项目 `shiseji-staging` 做候选验证；不得触碰正式 production Vercel 或生产 Supabase。

## Staging 回滚锚点

- 当前候选：`dpl_Ce6oQkbLF7wdgGXwUbjEuZydC5Yy`。
- 上一个 READY 部署：`dpl_9DpXSFzJchMgh3KHptXb16WhKrWo`，URL 为 `https://shiseji-staging-l5k35wi6e-shiseji-colors-projects.vercel.app`。
- 如需回滚，只在 `shiseji-staging` 项目内将别名重新指向上一个 READY 部署；正式 production 环境不在本记录授权范围内。
