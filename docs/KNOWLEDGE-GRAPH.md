# 灯台 MapleLantern — 知识图谱（机器可检索版）

> 生成：2026-11-27 / 版本 **1.6.0**。
> 定位约定：`FN-*` 功能条目见 `docs/FUNCTION-MATRIX.md`（带 file:line）；本图只画「谁调谁、谁约束谁、哪条坑位解释哪段设计」。1.5.1 的旧节点保留；1.5.7–1.5.14 的布景/图库增量已补入；1.6.0 补 UI kit 组件层并完成版本升档。
> 检索方法（给 AI 用）：
> 1. 想找「某功能怎么实现」→ 先 FUNCTION-MATRIX 拿 `FN-*` 与行号，回源码精读。
> 2. 想找「动它会牵动什么」→ 下图按节点 ID grep `-> KG-xxx` 与 `KG-xxx ->`。
> 3. 想找「为什么这么设计/踩过什么坑」→ 节点类型 PIT/CST 指向 `docs/KNOWLEDGE.md` 章节或 `.learnings/ERRORS.md`。
> 4. 维护：新增功能/约束/坑位时，在 §2 加一条边，必要时在 §3 加 tag；行号改了就顺手更新 FUNCTION-MATRIX。

## 1. 节点清单

### 1.1 模块（MOD）

| ID | 名称 | 锚点 |
|---|---|---|
| KG-MOD-CORE | 纯逻辑核 | src/core.js（全局 MapleLanternCore） |
| KG-MOD-UIKIT | UI 组件原语 | src/ui-kit.js（全局 MapleLanternUI；ES5，无 :scope/模板字符串/可选链） |
| KG-MOD-RENDER | 面板渲染 | src/render.js（全局 MapleLantern） |
| KG-MOD-NATIVE | 原生层接管 | src/maplelantern-native.js（全局 MapleLanternNative） |
| KG-MOD-DCORE | 外观逻辑 | src/dossier-core.js（MapleLanternDossierCore） |
| KG-MOD-DASSETS | 图库存储 | src/dossier-assets.js（MapleLanternDossierAssets） |
| KG-MOD-DTHEME | 外观应用层 | src/dossier-theme.js（MapleLanternDossierTheme） |
| KG-MOD-DPANEL | 外观面板 | src/dossier-panel.js（MapleLanternDossierPanel） |
| KG-MOD-CUSTOM | 外观入口 | src/custom.js（MapleLanternCustom） |
| KG-MOD-DECO | 布景九层逻辑 | src/deco-core.js（MapleLanternDeco） |
| KG-MOD-DECOPANEL | 布景页 | src/deco-panel.js（MapleLanternDecoPanel） |
| KG-MOD-COMPAT | inject_early 兼容层 | src/compat-preload.js |
| KG-MOD-CSSN | 原生层样式 | src/maplelantern-native.css（`html[data-ml-native="on"]` 前导） |
| KG-MOD-CSSP | 面板样式 | src/style.css（#ml-root） |
| KG-MOD-CSSUIKIT | UI kit 语义样式 | src/ui-kit.css（#ml-root + 原生正文；状态矩阵/触屏/断点） |
| KG-MOD-CSSF | 动效层 | src/effects.css |
| KG-MOD-CSSC | 自定义外观样式 | src/custom.css |
| KG-MOD-CSSDECO | 布景页样式 | src/deco.css（#ml-root .ml-deco-*） |
| KG-MOD-CSSORN | 主题边饰样式 | src/ornaments.css（#passages::before） |

### 1.2 功能（FUNC，锚点用 FUNCTION-MATRIX 的 FN-ID）

| ID | 名称 | FN-ID |
|---|---|---|
| KG-FUNC-SETTINGS | 主设置链路（读写/净化/应用） | FN-core-defaults, FN-core-sanitize, FN-render-settings |
| KG-FUNC-THEMES | 九主题调色板 | FN-core-palettes |
| KG-FUNC-ORNAMENT | 主题边饰 | FN-render-settings-page, CSSO-frame |
| KG-FUNC-TEXTCOLOR | 正文文字色 | FN-core-textcolor, FN-render-textcolor, FN-native-textcolor, CSSN-textcolor, CSSP-color |
| KG-FUNC-CONTRAST | 对比度与颜色推导 | FN-core-contrast, FN-dc-colors |
| KG-FUNC-VIEWPORT | 缩放/视口/面板原点 | FN-core-viewport |
| KG-FUNC-PANEL | 面板开关与页签 | FN-render-panel, FN-render-tabs |
| KG-FUNC-UIKIT | UI 原语与状态矩阵（row/card/section/segmented/mark） | FN-ui-mark, FN-ui-row, FN-ui-card, FN-ui-section, FN-ui-segmented, FN-ui-export |
| KG-FUNC-ORB | 悬浮球 | FN-render-orb |
| KG-FUNC-PRESS | 按压反馈（只缩放） | FN-render-press, CSSP-press, CSSN-press |
| KG-FUNC-PASSAGE | passage 同步（无入场 transform） | FN-render-passage |
| KG-FUNC-DESTROY | 级联销毁 | FN-render-destroy, FN-dp-panel |
| KG-FUNC-SIDEBAR | 侧栏四格打标 | FN-native-stats, FN-native-sidebar, FN-native-watch |
| KG-FUNC-INNER | 商店/衣柜内层 | FN-native-shop |
| KG-FUNC-OPTIONS | 选项图标收纳 | FN-native-options |
| KG-FUNC-CE | CE 共存与布局 | FN-native-ce, FN-native-dialog |
| KG-FUNC-ENTRY | 灯台入口注入 | FN-native-entry, FN-render-findbutton, FN-render-thirdparty |
| KG-FUNC-FEATS | Feats/Statistics 折叠 | FN-native-feats, FN-native-saverows |
| KG-FUNC-DOSSIER | 自定义外观（三件套） | FN-dc-defaults, FN-dt-apply, KG-MOD-CSSC |
| KG-FUNC-STAGE | 预览舞台拖拽 | FN-dp-stage, FN-dc-geometry |
| KG-FUNC-GALLERY | 图库与图片处理 | FN-da-db, FN-da-decode, FN-da-url, FN-dp-file, FN-dp-load |
| KG-FUNC-DECO | 布景九层（4 背景 + 5 前景） | FN-deco-layers, FN-deco-location, FN-deco-auto, FN-deco-presets, FN-deco-export, FN-deco-overlay, FN-deco-register |
| KG-FUNC-DECOPANEL | 布景页交互 | FN-deco-page, FN-deco-layersui, FN-deco-picker, FN-deco-pack, FN-deco-autoUI, FN-deco-presetUI, FN-deco-exchange |
| KG-FUNC-CATALOG | 图库键与覆盖链 | FN-deco-catalog, FN-deco-passage, FN-deco-bus, KG-MOD-DECO |
| KG-FUNC-FOREGROUND | 前景规格与安全区 | KG-CST-DECOSAFE；106/106；见 docs/FOREGROUND-STYLE.md |
| KG-FUNC-MEE | MEE 假阳性修复 | FN-compat-mee |

### 1.3 约束（CST）

| ID | 名称 | 详情 |
|---|---|---|
| KG-CST-GEOM | 原生几何基线 | #ui-bar 280px、#img left:64px、canvas 256×256 不重写；KNOWLEDGE.md §1 |
| KG-CST-ZOOM | 缩放判据 | 预览 vs 设备缩放换算；KNOWLEDGE.md §2 |
| KG-CST-CSP | DoL CSP 只认 'self' + data: | 图片必须 data URL；KNOWLEDGE.md §7.2 |
| KG-CST-GATE | 原生层门控 | 全部 CSS 以 `html[data-ml-native="on"]` 前导；DoLGameUI 启用时让位；native.js:86 |
| KG-CST-HAS | 旧 WebView `:has` 降级 | 平铺选择器与 `:not(:has(...))` 成员**不得混排**（旧引擎整条丢弃）；契约 D3；FUNCTION-MATRIX CSSN-press |
| KG-CST-PRESSSEM | 按压语义 = 只缩放不下沉 | 契约 contract.test.js「按压反馈」+「.md-apply:active 只缩放」 |
| KG-CST-UIKITSTATE | UI kit 状态语义 | `data-ui` 只放一个主语义；segmented 选项用 `data-ui-option=1`，避免覆盖主题卡 card；状态 normal/hover/active/selected/disabled/danger/empty/loading；disabled 不被选中同步覆盖，方向键/Home/End 跳过禁用项 |
| KG-CST-UIKITREAD | UI kit 可读性 | section hint 与 empty 文字统一用 `--ml-ui-muted`，不得用 faint；绿茵 `#7D8C6B` 对 `#E6F0D4` 仅 3.05:1，低于正文 4.5:1 |
| KG-CST-TEXTCOLOR | 文字色只改正文与标题 | 自定义色走 `--mln-text-custom`，只挂 `#passages`/`.passage` 与 `.passage h1–h4`；不改写 `--mln-text`，选项/读数/侧栏不受影响；低于 4.5:1 不生效 |
| KG-CST-MOTION | 动效三层关断 | `data-ml-motion="off"` + prefers-reduced-motion + 原生层同构 |
| KG-CST-STORE | 存储键与迁移 | MapleLantern.settings.v1 / MapleLanternDossier.settings.v1；sanitize 白名单 |
| KG-CST-BOOT | 加载顺序 | boot.json scriptFileList：core→ui-kit→deco-core→native→render→dossier 四件→custom→deco-panel；style：style→ui-kit→native→effects→custom→deco→ornaments；inject_early=compat-preload |
| KG-CST-VERSION | 版本三源一致 | boot.json:3 / core.js:16 / dossier-core.js:17 必须同步 |
| KG-CST-OLDVIEW | 旧 WebView 验证口径 | 无旧设备实测；用「静态剥离模拟 + D3 契约 + 真实 mouse.down 测量」替代 |
| KG-CST-DECODIR | 布景目录分离 | 背景 `img/decorations/ml/background1`、前景 `img/decorations/ml/foreground1`，不得混放；背景/前景均为 512×256 |
| KG-CST-DECOSAFE | 前景中央安全区 | 前景中央 `x=86–237` 必须透明；106/106 PASS（严格静态 102/106，4 张动画帧白名单）；见 docs/FOREGROUND-STYLE.md |
| KG-CST-DECOJSON | 布景 JSON 往返 | `exportDeco`/`importDeco` 只覆盖布景键；Z 夹紧 ±50、路径拒绝 `..`、预设 1–99、坏数据整段拒收 |
| KG-CST-DECOREG | 原模组优先 | 原「前景背景模组」已注册图层时只读兼容、让出渲染权；原模组缺失时才由灯台注册九层，异常不向游戏抛 |

### 1.4 坑位（PIT → KNOWLEDGE.md / .learnings）

| ID | 名称 | 详情 |
|---|---|---|
| KG-PIT-SIDEBAR-SCOPE | 原生层不能只扫正文 | 侧栏/开始页/菜单也要扫；KNOWLEDGE.md §4 |
| KG-PIT-CE-STACK | 作弊层叠灯台 | ERR-20261115-002 / §8 |
| KG-PIT-CE-SHIFT | CE 层偏移出屏 | ERR-20261115-003 |
| KG-PIT-TOPBAR-CLIP | 四格顶栏裁剪 | ERR-20261115-004 |
| KG-PIT-MEE | MEE 假阳性（未装也被判装了） | compat-preload.js 头注 + compat-preload.test.js |
| KG-PIT-IMG-RETRY | 图片加载有限重试 | LOAD_RETRY_LIMIT=2；dossier-panel.js:670 |
| KG-PIT-FILEINPUT | 文件框复用 | 单实例 file input；dossier-panel.js pickFile |
| KG-PIT-SMOKE | 冒烟口径 | init 非 mod 数、仅 A/B/C 判失败；项目根 mce-e2e\real_smoke_baseline.json |
| KG-PIT-IDB | 实机装载通道 | file:// IndexedDB；game\mce-mod-import.html 导入；项目 AGENTS.md §6 |
| KG-PIT-BUS | `$bus` 街区档位不同名 | DoL 的 commercial/industrial/residential 不是图库键；必须走 `BUS_ALIAS` → com_alley/ind_alley/res_alley；`alley`/`industrial` 场景同样适用 |
| KG-PIT-PASSAGE | 室内借用页同 location | 车站/施粥所/警局办公室与几百个室内页共用 `$location`，只能按 passage 名命中；`underground dance` 同理 |
| KG-PIT-PACKSTATE | 图库包三态 | ready/partial/missing；missing 时缩略图不阻塞面板、重试入口只在非 ready 显示；`deco-panel.js:654/728` |
| KG-PIT-FGSAFE | 前景中央压人物 | 前景中央 `x=86–237` alpha 必须为 0；新增前景先跑 `validate_foreground.py`，动画帧走 `--animated-allow` 白名单 |

### 1.5 验证（VLD）

| ID | 名称 | 详情 |
|---|---|---|
| KG-VLD-TESTS | 全量测试 | `node --test tests\*.test.js`；1.6.0 源码 = **340/340 PASS**（17 个测试文件，fail 0 / cancelled 0 / skipped 0） |
| KG-VLD-UIKIT | UI kit 专项 | `node --test tests\ui-kit.test.js`（5 条：原语/状态矩阵/四高频面/布景+原生衣柜/disabled 键盘）；视觉基线 12 张 contact（3 主题 × 390/600/899/1280），DOM 溢出 0 |
| KG-VLD-DECO | 布景专项 | `node --test tests\deco.test.js tests\deco-panel.test.js`；九层/路径/地点链/`$bus`/PASSAGE_MAP/自动/预设/JSON/滤镜/面板生命周期 |
| KG-VLD-VERIFY | 四步验证 | `pwsh tools\verify.ps1`：全量测试 / 宿主装配 / 源码防漂移 / 写指纹；1.6.0 = 4/4（76 文件 / `63e90109f370a51d` / stamp `482206de…`） |
| KG-VLD-HOSTPROBE | 宿主探针 | `pwsh tools\host-probe.ps1`（服务根=工程根，否则全 false） |
| KG-VLD-PACK | 确定性打包 | `pwsh .\pack.ps1` + `.\pack-image.ps1` → dist + 两份 SHA 文件；当前 1.6.0 本地双包：主包 240,431 B / 21 条目 / `cc8e469c…f665c`、图库 14,352,462 B / 214 条目 / 212 图 / `5885c117…e75a`（未发布）；上一版 1.5.14 Release 主包 234,182 B / 19 条目 / `5786985b…c0512`（不含 UI kit） |
| KG-VLD-CHECK | 包结构校验 | dol-ui-design `check_ui_mod.py`（14 PASS/1 WARN 基线） |
| KG-VLD-REAL | 实机安装探针 | 1.5.14 双包 both/missing 0 失败；Release 458919886 / tag v1.5.14；两资产 digest 与下载回读全等；1.6.0 双包探针 PASS（both：106 背景 / 106 前景、9 层、7 页签、320 无溢出、pageErrors 0；非真实 file:// IDB）。**1.6.0 真实 file:// IDB PASS**（全新 Edge profile；导入页回读双包 240,431 B / 14,352,462 B；游戏内 version/core/dossier 三源 1.6.0、7 页签、设置 37 UI 打标、布景「图库已接入 · 背景 106 / 前景 106」、1280/390 0 越界、按压 `matrix(0.97…)` 无 translate、pageerror 0；控制台 6 条 ModLoader fetch / file-not-found 保留为噪声；默认 `panel:false`，API 开面板，原生 OPTIONS → `[data-ml-entry=panel]` 补测 PASS）。改前 `02751c9` 12 组基线：严格 0.5% 10/12，grass 600/899/1280 0.5951–0.5978% 窄超线且差异集中卡片轮廓，见 `.ml-verify/baseline-1.5.14-20261127/contract.md`、`diff-strict-1.5.14-to-1.6.0-20261127` |
| KG-VLD-SMOKE | game-smoke | mce-e2e\real_smoke.ps1 |

## 2. 边（依赖/调用/约束关系，每行一条）

```text
# --- 装配顺序（boot.json） ---
KG-MOD-COMPAT -> KG-MOD-CORE        inject_early 先于主链
KG-MOD-CORE   -> KG-MOD-UIKIT       UI kit 在 core 之后装配，语义层不依赖 core
KG-MOD-UIKIT  -> KG-MOD-RENDER      render 消费 UI.mark / UI.segmented
KG-MOD-UIKIT  -> KG-MOD-DECOPANEL   deco-panel 消费 UI.mark 做布景语义
KG-MOD-UIKIT  -> KG-MOD-NATIVE      native 衣柜行追加 row/filled 标记
KG-MOD-UIKIT  -> KG-MOD-CSSUIKIT    原语与状态矩阵样式
KG-MOD-CORE   -> KG-MOD-DECO        deco 消费 core 的 normalizeName/palette
KG-MOD-DECO   -> KG-MOD-DECOPANEL   deco-panel 消费 MapleLanternDeco
KG-MOD-CORE   -> KG-MOD-RENDER      render 消费 MapleLanternCore
KG-MOD-CORE   -> KG-MOD-NATIVE      native 消费 MapleLanternCore
KG-MOD-CORE   -> KG-MOD-DCORE       dossier 消费 core 的 palette/luminance
KG-MOD-RENDER -> KG-MOD-DTHEME      render.destroy 级联 DTheme.destroy
KG-MOD-RENDER -> KG-MOD-DPANEL      render.destroy 级联 DPanel.destroy
KG-MOD-RENDER -> KG-MOD-NATIVE      setSetting→Native.refresh；destroy 级联
KG-MOD-RENDER -> KG-MOD-DECOPANEL   deco 页签按需 renderPage；destroy 级联
KG-MOD-CUSTOM -> KG-MOD-DTHEME      custom.boot→DTheme.apply
KG-MOD-CUSTOM -> KG-MOD-DASSETS     custom.attach 走 dataUrlFor
KG-MOD-DECOPANEL -> KG-MOD-CSSDECO  布景页样式
KG-MOD-CSSORN -> KG-FUNC-ORNAMENT   边饰伪元素层

# --- 功能内依赖 ---
KG-FUNC-SETTINGS -> KG-CST-STORE    净化白名单与迁移
KG-FUNC-SETTINGS -> KG-FUNC-THEMES  theme 枚举约束
KG-FUNC-SETTINGS -> KG-MOD-NATIVE   opt* 门控→OPT_ATTRS 属性
KG-FUNC-VIEWPORT -> KG-CST-ZOOM     缩放换算口径
KG-FUNC-VIEWPORT -> KG-CST-GEOM     面板原点不破原生几何
KG-FUNC-PANEL -> KG-FUNC-ORB        悬浮球 toggle 面板
KG-FUNC-PANEL -> KG-FUNC-DESTROY    closePanel(reason) 级联
KG-FUNC-UIKIT -> KG-CST-UIKITSTATE  状态/键盘/单一主语义
KG-FUNC-UIKIT -> KG-CST-UIKITREAD   hint/empty 用 muted 的可读性门槛
KG-FUNC-UIKIT -> KG-FUNC-PANEL      面板控件消费原语
KG-FUNC-PRESS -> KG-CST-PRESSSEM    只缩放契约
KG-FUNC-PRESS -> KG-CST-HAS         按压选择器拆净混排（D3）
KG-FUNC-PRESS -> KG-CST-MOTION      reduced-motion 下停涟漪
KG-FUNC-PASSAGE -> KG-CST-MOTION    passage 入场动效受 motion 关断
KG-FUNC-SIDEBAR -> KG-PIT-SIDEBAR-SCOPE   扫描范围坑
KG-FUNC-CE -> KG-PIT-CE-STACK      CE 共存
KG-FUNC-CE -> KG-PIT-CE-SHIFT      CE 布局回退
KG-FUNC-CE -> KG-CST-GATE           CE 面板排除在原生层之外
KG-FUNC-ENTRY -> KG-FUNC-OPTIONS    入口行在 OPTIONS 弹层
KG-FUNC-DOSSIER -> KG-CST-CSP       图片 data URL 硬约束
KG-FUNC-DOSSIER -> KG-FUNC-CONTRAST 颜色对比度提示
KG-FUNC-STAGE -> KG-FUNC-DOSSIER    舞台拖拽写 bgX/bgY/zoom
KG-FUNC-GALLERY -> KG-PIT-IMG-RETRY 有限重试
KG-FUNC-GALLERY -> KG-PIT-FILEINPUT 文件框复用
KG-FUNC-DECO -> KG-CST-DECODIR      背景/前景目录分离
KG-FUNC-DECO -> KG-CST-DECOSAFE     前景中央安全区
KG-FUNC-DECO -> KG-CST-DECOJSON     九层 JSON 往返
KG-FUNC-DECO -> KG-CST-DECOREG      原模组优先、缺失才接管
KG-FUNC-DECO -> KG-PIT-BUS          `$bus` 三档别名
KG-FUNC-DECO -> KG-PIT-PASSAGE      室内借用页 passage 命中
KG-FUNC-DECO -> KG-FUNC-CATALOG     106 键图库
KG-FUNC-DECO -> KG-FUNC-DECOPANEL   布景页读写九层
KG-FUNC-CATALOG -> KG-FUNC-FOREGROUND 图库与前景规格同源
KG-FUNC-FOREGROUND -> KG-CST-DECOSAFE 安全区校验
KG-FUNC-DECOPANEL -> KG-PIT-PACKSTATE 图库包三态
KG-FUNC-DECOPANEL -> KG-CST-DECOJSON 导出/导入
KG-FUNC-MEE -> KG-PIT-MEE           compat-preload 修复点

# --- 样式层 ---
KG-MOD-CSSN -> KG-CST-GATE          全部规则 data-ml-native 前导
KG-MOD-CSSUIKIT -> KG-FUNC-UIKIT    UI 原语语义/状态矩阵
KG-MOD-CSSUIKIT -> KG-CST-UIKITSTATE 状态选择器
KG-MOD-CSSUIKIT -> KG-CST-UIKITREAD  hint/empty 可读性色
KG-MOD-CSSUIKIT -> KG-CST-MOTION    loading/hover 三路关断
KG-MOD-CSSN -> KG-FUNC-PRESS        CSSN-press 按压组
KG-MOD-CSSP -> KG-FUNC-PRESS        CSSP-press 按压组
KG-MOD-CSSP -> KG-CST-MOTION        CSSP-motion-off 零 JS 判据
KG-MOD-CSSC -> KG-FUNC-DOSSIER      三件套样式
KG-MOD-CSSDECO -> KG-FUNC-DECOPANEL 九层卡/选择器/状态条
KG-MOD-CSSORN -> KG-FUNC-ORNAMENT   八套主题边饰
KG-MOD-CSSF -> KG-MOD-CSSN          mln-* keyframes 供原生层
KG-MOD-CSSF -> KG-MOD-CSSP          ml-* keyframes 供面板层

# --- 验证链 ---
KG-VLD-TESTS -> KG-CST-VERSION      测试断言版本三源
KG-VLD-TESTS -> KG-CST-HAS          contract D3 不变量
KG-VLD-TESTS -> KG-VLD-DECO         17 文件 / 340 断言中的布景专项
KG-VLD-UIKIT -> KG-FUNC-UIKIT       原语/状态/四高频面迁移
KG-VLD-UIKIT -> KG-CST-UIKITSTATE   disabled 保持与键盘跳过
KG-VLD-UIKIT -> KG-CST-UIKITREAD    hint/empty 对比度契约
KG-VLD-DECO -> KG-FUNC-DECO         九层/地点链/自动/JSON
KG-VLD-DECO -> KG-PIT-BUS           `$bus` 三档断言
KG-VLD-DECO -> KG-PIT-PASSAGE       PASSAGE_MAP 六条断言
KG-VLD-VERIFY -> KG-VLD-TESTS       四步验证第 1 步
KG-VLD-VERIFY -> KG-CST-BOOT        宿主装配检查加载顺序
KG-VLD-HOSTPROBE -> KG-CST-BOOT     四全局装配+双源
KG-VLD-PACK -> KG-VLD-CHECK         打包后过 check_ui_mod
KG-VLD-REAL -> KG-PIT-IDB           真实导入路径
KG-VLD-SMOKE -> KG-PIT-SMOKE        口径约束
```

## 3. 标签索引（tag → 节点）

```text
#按压 #press          KG-FUNC-PRESS KG-CST-PRESSSEM KG-CST-HAS CSSP-press CSSN-press
#悬浮球 #orb           KG-FUNC-ORB CSSP-orb
#面板 #panel           KG-FUNC-PANEL KG-MOD-RENDER CSSP-mask
#侧栏 #sidebar         KG-FUNC-SIDEBAR KG-MOD-NATIVE KG-PIT-SIDEBAR-SCOPE CSSN-shell CSSN-topbar
#商店 #shop            KG-FUNC-INNER CSSN-inner
#选项 #options         KG-FUNC-OPTIONS FN-native-options
#CE #作弊 #cheat       KG-FUNC-CE KG-PIT-CE-STACK KG-PIT-CE-SHIFT CSSN-overlay CSSN-dialog
#入口 #entry           KG-FUNC-ENTRY CSSN-entry CSSP-native-entry
#外观 #dossier         KG-FUNC-DOSSIER KG-MOD-DCORE KG-MOD-DPANEL KG-MOD-CSSC
#图片 #image #图库      KG-FUNC-GALLERY KG-FUNC-CATALOG KG-CST-CSP KG-PIT-IMG-RETRY KG-PIT-FILEINPUT
#布景 #deco            KG-FUNC-DECO KG-FUNC-DECOPANEL KG-MOD-DECO KG-MOD-DECOPANEL KG-MOD-CSSDECO
#前景 #foreground      KG-FUNC-FOREGROUND KG-CST-DECOSAFE KG-PIT-FGSAFE
#主题 #theme           KG-FUNC-THEMES CSSN-cyber CSSP-cyber CSSN-texture
#UI #uikit            KG-FUNC-UIKIT KG-MOD-UIKIT KG-MOD-CSSUIKIT KG-CST-UIKITSTATE KG-CST-UIKITREAD KG-VLD-UIKIT
#边饰 #ornament        KG-FUNC-ORNAMENT KG-MOD-CSSORN CSSO-frame
#文字色 #textcolor     KG-FUNC-TEXTCOLOR KG-CST-TEXTCOLOR CSSN-textcolor CSSP-color
#动效 #motion          KG-CST-MOTION KG-MOD-CSSF CSSP-motion-off
#几何 #缩放 #viewport   KG-FUNC-VIEWPORT KG-CST-ZOOM KG-CST-GEOM
#销毁 #destroy         KG-FUNC-DESTROY
#MEE #compat           KG-FUNC-MEE KG-PIT-MEE KG-MOD-COMPAT
#版本 #version         KG-CST-VERSION KG-VLD-TESTS
#打包 #pack            KG-VLD-PACK KG-VLD-CHECK
#冒烟 #smoke           KG-VLD-SMOKE KG-PIT-SMOKE KG-PIT-IDB
#feats #统计           KG-FUNC-FEATS CSSN-feats CSSN-statsfold
```

## 4. 版本里程碑节点（只记大版本行为线）

| ID | 版本 | 行为线 |
|---|---|---|
| KG-VER-1422 | 1.4.22 | 审计落修轮（本表基线前）：默认外观门控、pointercancel、MEE、destroy 级联、CSP data URL、图片有限重试、文件框复用、`:is(:has)` 拆分、入口 `<a>` |
| KG-VER-150 | 1.5.0 | 压按语义改「只缩放」、`:not(:has)` 混排 32 条拆净（契约 D3）、237/237、重打包 SHA `b9c8eaffd626aaf1da2287320fbd9ff59d1226a2d7ccbb1fb2e157bbd2e28109` |
| KG-VER-151 | 1.5.1 | 新增绿茵（阳光草场浅色档）与主题边饰（8 套 SVG 边框，可总开关；auto 解析为 cyberpunk，边饰随 cyberpunk）；新增正文文字色（跟随主题/预设/自定义，4.5:1 护栏，只挂正文层）；删除石墨并让旧档回落默认；246/246；包 `MapleLantern-1.5.1.mod.zip` 189,445 B / 16 条目 / SHA256 `5cefdd342e4d056aed176c3864643e42fa7b0c1c8bd04c96496477d5e8a05e0d`；实机探针 20/20 |
| KG-VER-157_10 | 1.5.7–1.5.10 | 布景九层/图库分包起步（83 图）→ 自动背景收录、一键全收录、桌面 7 页签等分；图库逐步扩到 106 背景 + 106 前景 |
| KG-VER-1511 | 1.5.11 | 街道总线 `BUS_ALIAS` 三档 + 室内借用页 `PASSAGE_MAP`；`hotel` 补图；图库 106+106；测试 326/326；`check_ui_mod` 14 PASS/1 WARN |
| KG-VER-1512 | 1.5.12 | 覆盖清单 107 地点 / 67 同名 / 7 visual / 32 父链 / 可达但无图 0；图库本地可用过滤、最近 8 项、JSON 往返、4 张前景两帧微差 + `--animated-allow`；326/326 |
| KG-VER-1513 | 1.5.13 | 触屏 hover 收进 `@media (hover:hover)`；抽屉底部留白 16→10；衣柜衣物行卡化（图标 38×38 回卡内、整行 358×74、动作行仍两列）；334/334；包 `2c623bcc…` 233,682 B / 19 条目 |
| KG-VER-1514 | 1.5.14 | 衣柜行卡兜底：扫描全部 `.wardrobeItem`（商店列表除外）、`span.spanIcon` 兼容、`:has()` 分组行摊平整宽、正文 `flex:1 1 0` 防换行；390 宽实测普通/已分组/已标记均 326×86、图标 38×38 `inRow=true`；335/335；`verify.ps1` 4/4（73 文件 / `04c3b1db…`）；双包 `MapleLantern-1.5.14.mod.zip` 234,182 B / 19 条目 / `5786985b…c0512`、图库 14,352,459 B / 214 条目 / 212 图 / `e16afc29…a09cb`；Release 458919886 / tag v1.5.14 |
| KG-VER-1514-UI | 1.5.14 · UI kit | 新增 `ui-kit.js` / `ui-kit.css` 五入口（row/card/section/segmented/mark）+ 八状态矩阵；迁移此刻/身心/着装/设置/布景/原生衣柜；44px 触控、hover 只细指针、active 只缩放、三路动效关断；340/340（17 文件）；12 张 contact 视觉基线（3 主题 × 390/600/899/1280），DOM 溢出 0；1.5.14 源上完成，未单独发版；并入 1.6.0 |
| KG-VER-160-UI | 1.6.0 | UI kit 从 1.5.14 工作区升为正式版；六源版本同步（本体 boot/core/dossier-core/deco-core + 图库 boot/README），图库依赖 `>=1.6.0`；340/340；verify 4/4（76 文件 / `63e90109f370a51d` / stamp `482206de…`）；主包 240,431 B / 21 条目 / `cc8e469c…f665c`、图库 14,352,462 B / 214 条目 / 212 图 / `5885c117…e75a`；本地 dist，未发布 Release；真实安装与改前基线见 KG-VLD-REAL |
