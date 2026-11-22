# 灯台 MapleLantern — 功能矩阵

> 生成：2026-11-21 / 版本 1.5.1（行号锚点以 1.5.1 源码为准）。
> 用途：按「功能 → 文件:行号 → 实现要点 → 测试 → 坑位」快速定位。行号随改码漂移，大改后按文末「行号复核命令」重抓锚点。
> 维护纪律：新增/改名函数时同步本表与 `docs/KNOWLEDGE-GRAPH.md`。

## 0. 模块总览（加载顺序 = boot.json `scriptFileList`）

| ID | 文件 | 行数 | 职责 | 全局出口 |
|---|---|---|---|---|
| MOD-core | `src/core.js` | ~637 | 纯逻辑层：设置/字符串/主题/视口/面板原点，无 DOM | `window.MapleLanternCore` |
| MOD-native | `src/maplelantern-native.js` | ~2160 | 原生层接管：侧栏四格、状态卡、商店/衣柜、CE 共存、入口注入 | `window.MapleLanternNative` |
| MOD-render | `src/render.js` | ~1780 | 面板渲染：悬浮球、面板、页签、按压反馈、生命周期 | `window.MapleLantern` |
| MOD-dossier-core | `src/dossier-core.js` | ~540 | 自定义外观逻辑：颜色推导、对比度、背景几何、设置净化 | `window.MapleLanternDossierCore` |
| MOD-dossier-assets | `src/dossier-assets.js` | ~310 | 图库：IndexedDB 存取、解码缩放、webp 检测、CSP data URL | `window.MapleLanternDossierAssets` |
| MOD-dossier-theme | `src/dossier-theme.js` | ~215 | 外观应用层：CSS 变量、背景层几何、主题变量快照 | `window.MapleLanternDossierTheme` |
| MOD-dossier-panel | `src/dossier-panel.js` | ~1120 | 自定义外观设置面板：舞台拖拽、文件拾取、颜色/滑杆控件 | `window.MapleLanternDossierPanel` |
| MOD-custom | `src/custom.js` | ~60 | 外观持久化与应用入口 | `window.MapleLanternCustom` |
| MOD-compat | `src/compat-preload.js` | ~110 | inject_early：MEE 假阳性修复（`window.mee` 未安装保持 undefined） | — |
| CSS-native | `src/maplelantern-native.css` | ~4660 | 原生层样式（`html[data-ml-native="on"]` 前导） | — |
| CSS-style | `src/style.css` | ~1740 | 面板层样式（`#ml-root` 作用域） | — |
| CSS-effects | `src/effects.css` | ~790 | 动效层 keyframes | — |
| CSS-custom | `src/custom.css` | ~500 | 玩家自定义外观三件套（背景/按钮底纹/浮窗卡片） | — |

## 1. JS 功能矩阵

### 1.1 core.js（纯逻辑，无 DOM）

| ID | 功能 | 位置 | 要点 | 测试 |
|---|---|---|---|---|
| FN-core-version | VERSION 常量 | core.js:16 | 版本三源之一（另：boot.json:3、dossier-core.js:17） | contract:version |
| FN-core-constants | TAB_KEYS / THEMES / DENSITIES / LANGS | core.js:18-21 | 枚举白名单，供 sanitize 用 | core |
| FN-core-palettes | PALETTES / STRINGS / SLOT_LABELS | core.js:31/82/225 | 八主题调色板（含绿茵浅色档）、zh/en 文案、着装槽标签；石墨已移除 | core |
| FN-core-defaults | DEFAULTS 冻结表 | core.js:242 | 全部设置默认值（含 opt* 门控默认 true、`panel:false`） | core |
| FN-core-sanitize | sanitizeSettings(raw) | core.js:275 | 设置净化：oneOf 白名单 + clamp + 未知键丢弃 | core |
| FN-core-readmodel | readModel(env) | core.js:471 | 从 `V.*` 读金钱/时间/日期/穿衣/天气/第 x 部分等 | core |
| FN-core-thirdparty | readThirdParty(vars) | core.js:430 | 第三方状态读取（O0O/BasicNeeds 等） | core |
| FN-core-format | fmt/formatClock/formatDate/formatWeekday/formatMoney | core.js:368-410 | 双语格式化 | core |
| FN-core-contrast | hexToRgb/luminance/contrast | core.js:542-560 | WCAG 对比度计算 | core |
| FN-core-textcolor | normalizeHex/textColorFor/textColorChoices | core.js:579-605 | 正文文字色：预设从主题调色板逐色过 4.5:1，自定义按主题底色校验；非法值回落 auto + repaired | core |
| FN-core-viewport | zoomFactor/viewportSize/panelOrigin | core.js:573-624 | 缩放换算与面板原点（详见 KNOWLEDGE.md §2） | core/dom |
| FN-core-diag | buildDiagnostics(info) | core.js:625 | 诊断信息组装 | core |

### 1.2 render.js（面板层）

| ID | 功能 | 位置 | 要点 | 测试 |
|---|---|---|---|---|
| FN-render-mount | `__mounted` 防重挂 | render.js:11 | 重复加载直接 return | dom |
| FN-render-boot | boot() / window.MapleLantern 出口 | render.js:1741/1753 | 绑定全部事件；出口含 toggle/openPanel/closePanel/destroy/refresh 等 | dom/native-round2 |
| FN-render-settings | loadSettings/saveSettings/setSetting/applySettings | render.js:159/183/195/216 | 设置读写（`MapleLantern.settings.v1`）；applySettings 同步 body 属性与原生层 | core/dom |
| FN-render-buildroot | buildRoot() | render.js:369 | 构建 #ml-root 面板 DOM | dom |
| FN-render-tabs | renderTabs/activateTab/onTabKey | render.js:482/530/556 | 六页签切换与键盘 | dom |
| FN-render-now | renderNow/renderBridge/bridgeRow | render.js:619/695/739 | 「此刻」页：桥接行（含第三方） | dom |
| FN-render-vitals | renderVitals | render.js:835 | 「身心」页 | dom |
| FN-render-worn | renderWorn | render.js:872 | 「着装」页 | dom |
| FN-render-system | renderSystem | render.js:912 | 「系统」页：诊断/复制 | dom |
| FN-render-switches | renderSwitches | render.js:974 | 「开关」页 | dom |
| FN-render-settings | renderSettings | render.js:1049 | 「设置」页：滑杆/主题/密度/语言/门控；滑杆生成含 pointercancel 清理；主题下的「文字色」行只重画色点不重建整页 |
| FN-render-textcolor | colorControl（renderSettings 内） | render.js:1079-1140 | 自动/预设色点/自定义取色器；换主题时 `textColorFor` 不达标即回 auto + 提示 | dom/contract |
| FN-render-findbutton | findButton(root, rx, allowAnchor) | render.js:773 | 按钮查找；`allowAnchor` 支持 `<a>` 入口（1.4.22 修复） | native-round2 |
| FN-render-thirdparty | findOptionsButton/findOverlayButton/openThirdParty | render.js:786/791/809 | 第三方美化页入口策略 | native-round2 |
| FN-render-panel | openPanel/closePanel/togglePanel/syncPanelOrigin | render.js:1241/1296/1333/1272 | 面板开关；closePanel(reason) 触发级联 destroy | dom |
| FN-render-orb | placeOrb/onOrbDown/onGripDown | render.js:337/1406/1486 | 悬浮球拖拽/双击回中（仅「悬浮灯台」开启时） | dom |
| FN-render-press | PRESS_SELECTOR/onPressFx/clearPressTimers | render.js:1657-1700 | 按压反馈 JS 侧：pointerdown 加 `.ml-is-pressed`，只缩放不下沉 | contract |
| FN-render-passage | applyPassage/onPassage | render.js:1549/1563 | passage 渲染后同步（不再加入场 transform，1.4.22 修复） | contract |
| FN-render-destroy | destroy() | render.js:1620 | 级联：撤销事件、清 root、清按压、原生/主题/面板层 destroy | dom |

### 1.3 maplelantern-native.js（原生层）

| ID | 功能 | 位置 | 要点 | 测试 |
|---|---|---|---|---|
| FN-native-attr | ATTR=`data-ml-native` / setAttr / setModuleAttrs | native.js:15/49/76 | 门控属性；OPT_ATTRS 映射设置→属性 | native |
| FN-native-root | hostEnabled/setRoot | native.js:86/95 | DoLGameUI 启用时原生层整体让位（apiVersion!==1 回退） | native |
| FN-native-stats | markStats/mergeStatsRows/markStatmeters/markRailMeters | native.js:171/154/322/374 | 侧栏四格打标、状态卡、滑杆皮肤（RAIL_KEYS） | native |
| FN-native-statsmax | STAT_MAX/readStatMax/INVERTED_STAT | native.js:268/287/314 | 各属性上限与反比属性（innocence→awareness） | native |
| FN-native-shop | markShopCats/tidyShopText/markEmptyDetails/markShopTools | native.js:472/516/529/539 | 商店内层美化；工具栏换标签保留按钮内部链接 | native |
| FN-native-options | packIconOptions/unpackOptions | native.js:604/966 | 选项图标收纳/还原（含 CE 结构签名识别） | native |
| FN-native-ce | ceStructureSig/normalizeCheatLayout/rememberCeStyle/restoreCeStyle | native.js:996-1385 | CE 共存：识别 CE 结构、临时接管布局、退出还原 | native |
| FN-native-passages | packSignature/markPassages | native.js:1386/1398 | 正文打标（签名缓存防重复） | native |
| FN-native-overlay | overlayKey/openPanel/thirdPartyOverlay/markThirdPartyOverlay | native.js:1449-1506 | 第三方弹层识别与标记 | native |
| FN-native-entry | addEntry/removeEntry/markEntry | native.js:1507-1551 | OPTIONS 弹层「灯台」入口行 | native |
| FN-native-textcolor | applyStoryColor | native.js:103-118 | 写 `data-ml-text="custom"` 与 `--mln-text-custom`；对比度不合格即撤除，回落主题色 | contract/dom |
| FN-native-feats | markFeatsIntro/armFeatsIntro/restoreFeatsIntro | native.js:1552-1596 | Feats 说明卡折叠 | native |
| FN-native-saverows | alignStatRows/markSaveRows | native.js:1597/1661 | 存档行对齐与打标 | native |
| FN-native-dialog | markOverlay/markDialog/liftOverlay/restoreOverlay | native.js:1674-1722 | 弹层/对话框接管与 lift 层级 | native |
| FN-native-sidebar | fitSidebarLabels/restoreSidebarLabels | native.js:1723/1749 | 侧栏标签自适应（挤压换短文本） | native |
| FN-native-clear | clearMarks() | native.js:1762 | 清全部打标 | native |
| FN-native-apply | apply() | native.js:1808 | 主入口：一次性 DOM 流程 | native |
| FN-native-watch | watchPassages/watchSidebar/watchOverlay/watchZoom/onClick/syncSidebar | native.js:1895/1936/2058/2118/1961/2003 | MutationObserver/事件监听族；onClick 防误点入口 | native |
| FN-native-bind | bind() | native.js:2133 | 装配全部监听与 ready 钩子 | native |

### 1.4 dossier-* 与 custom / compat

| ID | 功能 | 位置 | 要点 | 测试 |
|---|---|---|---|---|
| FN-dc-version | VERSION 1.5.0 / SETTINGS_KEY | dossier-core.js:17/18 | 版本三源之三 | dossier-lifecycle |
| FN-dc-defaults | CUSTOM_DEFAULTS / DEFAULTS | dossier-core.js:23/49 | 自定义外观默认值（三 kind：bg/btn/card） | dossier-lifecycle |
| FN-dc-colors | isHexColor/normalizeHex/hexToRgb/relLuminance/contrastRatio/derivePalette | dossier-core.js:100-176 | 颜色解析与调色板推导 | dossier-lifecycle |
| FN-dc-sanitize | sanitizeCustom/sanitize/merge/resetCustom | dossier-core.js:177-332 | 净化 + 合并 + RESET_GROUPS 分组重置 | dossier-lifecycle |
| FN-dc-plan | ML_MAP/planVars/alignForBackground | dossier-core.js:376-453 | 同步灯台 CSS 变量的计划表；背景对齐角 | dossier-lifecycle |
| FN-dc-geometry | computeBackgroundSize/dragToPosition/fitWithin | dossier-core.js:454-503 | 背景缩放/拖拽几何 | dossier-lifecycle |
| FN-da-db | DB_NAME/openDb/tx/load/save/drop | dossier-assets.js:19-97 | IndexedDB `MapleLanternDossier.assets.v1`，MAX_FILE 15MB | dossier-lifecycle |
| FN-da-decode | decode/decodeViaImg/canvasOf/supportsWebp/toBlob/process | dossier-assets.js:105-244 | 图片解码缩放；webp 探测；有限重试 LOAD_RETRY_LIMIT=2（dossier-panel.js:670） | dossier-lifecycle |
| FN-da-url | toDataUrl/dataUrlFor/urlFor/release/releaseAll | dossier-assets.js:268-310 | CSP 只认 data:/blob: → dataUrlFor 兜底（KNOWLEDGE.md §7.2） | dossier-lifecycle |
| FN-dt-apply | apply(settings)/attach(kind,img)/destroy | dossier-theme.js:136/201/208 | 外观应用层 + 主题变量快照 snapshotMl/restoreMl | dossier-lifecycle |
| FN-dt-geometry | applyBackgroundGeometry/bgBox/ensureLayer | dossier-theme.js:93/81/125 | 背景层几何与滚动视差层 | dossier-lifecycle |
| FN-dp-panel | panelOpen/inject/bind/destroy | dossier-panel.js:1051/1059/1094/1107 | 面板生命周期；destroy 级联（1.4.22） | dossier-lifecycle |
| FN-dp-stage | buildStage/onStageDown/onStageMove/onStageUp/paintStage | dossier-panel.js:258-506 | 预览舞台拖拽/双击居中 | dossier-lifecycle |
| FN-dp-file | pickFile/onFilePick/ingest/setImage | dossier-panel.js:507-600 | 文件框复用（单实例 file input，1.4.22） | dossier-lifecycle |
| FN-dp-load | loadImages() | dossier-panel.js:672 | 启动回载三 kind 图片，有限重试 | dossier-lifecycle |
| FN-dp-colors | COLOR_ROWS/cssColorToHex/fallbackHex/contrastHint/buildColorRow | dossier-panel.js:697-780 | 颜色行与对比度提示 | dossier-lifecycle |
| FN-custom-boot | storage/attach/migrate/boot | custom.js:14/20/36/45 | CSP data URL 注释(custom.js:18) + 启动装配 | custom |
| FN-compat-mee | variables/hasDaily/guard/makeProxy/ensureDaily | compat-preload.js:21-110 | `window.mee` 代理：MEE 未安装保持 undefined，避免 `if (window.mee)` 假阳性 | compat-preload |

## 2. CSS 分区矩阵

### 2.1 maplelantern-native.css（`html[data-ml-native="on"]` 前导；行号 = 分区起点）

| ID | 分区 | 位置 | 主要选择器/内容 |
|---|---|---|---|
| CSSN-shell | 外壳 | :497 | `#ui-bar` 本体与容器 |
| CSSN-topbar | 金钱/时间/星期 | :570 | 四格芯片、金额/时间/日期 |
| CSSN-stats | 状态卡 | :724 | `#stats` 芯片与数值 |
| CSSN-btns | 侧栏按钮/菜单 | :918 | `#ui-bar` 按钮、菜单 |
| CSSN-rail | 手机左轨 | :1003 | `#mobileStats` |
| CSSN-story | 正文与选项 | :1157 | `#passages` 选项、`.ml-native-entry` |
| CSSN-textcolor | 正文自定义文字色 | 见 `[data-ml-text="custom"]` 段 | 只给 `#passages` / `.passage` / `.passage h1–h4` 挂 `--mln-text-custom`，不碰按钮/读数 |
| CSSN-inner | 衣柜/商店内层 | :1471 | `#shop`/`#wardrobe` 类内层 |
| CSSN-overlay | 弹层 | :2041 | `#customOverlay`（含 `:not(:has(...))` 排除 CE） |
| CSSN-basicneeds | BasicNeeds 0.5.0 适配 | :2131 | 第三方适配段 |
| CSSN-dialog | 对话框 | :2409 | `#ui-dialog`（含 CE 排除） |
| CSSN-feats | Feats 说明卡 | :3550 | feats 卡片 |
| CSSN-statsfold | Statistics 折叠卡 | :3579 | 折叠统计 |
| CSSN-entry | 入口 | :3696 | OPTIONS「灯台」行 |
| CSSN-scrollbar | 滚动条 | :3748 | `::-webkit-scrollbar` |
| CSSN-motion | 动效 | :3786 | 入场/呼吸动效 |
| CSSN-cyber | 赛博朋克主题装饰 | :4083 | `[data-ml-theme="cyberpunk"]` |
| CSSN-grass | 绿茵主题（阳光草场浅色档） | 见 `[data-ml-theme="grass"]` 段 | 割草条纹、斑驳阳光、青绿边框与亮色语义覆盖 |
| CSSO-frame | 主题边饰层（`src/ornaments.css`） | 文件首段 | `#passages::before` 12px `border-image` 帧 + `.passage` 内衬 + `h1::after` 标题枝；八套图案、auto 无图案、≤600 收 8px、≤420 仅标题枝 |
| CSSN-texture | 主题纹理层 | :4477 | 纹理变量层 |
| CSSN-press | 原生按压反馈 | :4584 | 按压组：平铺规则与 `:not(:has(...))` 排除规则**分列**（1.5.0 拆净，见契约 D3） |

### 2.2 style.css（`#ml-root` 作用域）

| ID | 分区 | 位置 |
|---|---|---|
| CSSP-orb | 悬浮球 | :383 |
| CSSP-mask | 遮罩与面板 | :461 |
| CSSP-now | 此刻 | :740 |
| CSSP-vitals | 身心 | :956 |
| CSSP-worn | 着装 | :991 |
| CSSP-system | 系统 | :1038 |
| CSSP-settings | 设置（含文字色点） | :1087 |
| CSSP-color | 正文文字色色点 | :1190 | 44px 触控目标 + 26px 视觉圆；自动点「A」、自定义点彩虹环内嵌取色器 |
| CSSP-drawer | 抽屉模式 | :1222 |
| CSSP-toast | 提示 | :1317 |
| CSSP-motion-off | 动效关断（零 JS 判据） | :1352 |
| CSSP-host-counter | 宿主按钮反制（逐类封回） | :1387 |
| CSSP-cyber | 赛博朋克主题装饰 | :1432 |
| CSSP-native-entry | 原生选项入口 | :1581 |
| CSSP-texture | 主题纹理层 | :1611 |
| CSSP-press | 点击/按压反馈 | :1688 |

### 2.3 effects.css（keyframes）

| ID | 内容 | 位置 |
|---|---|---|
| CSSF-core | ml-breathe / ml-tabline / ml-hairline / ml-panel-ambient / ml-pane-in / ml-ring-breathe / ml-press-ripple | :35-74 |
| CSSF-native | mln-bar-drift / mln-passage-in / mln-overlay-in / mln-stat-row-in / mln-press-ripple | :75-100 |
| CSSF-sky | ml-ambient-drift / ml-veil-flow / ml-sky-band / ml-sky-glow / ml-sky-ribbon / ml-dust-drift / ml-scan-sweep | :739-780 |

### 2.4 custom.css（玩家自定义外观）

| ID | 分区 | 位置 |
|---|---|---|
| CSSC-bg | 8a 背景层 | :35 |
| CSSC-btn | 8b 按钮底纹（含 `.md-apply:active` 只缩放） | :69 |
| CSSC-card | 8b2 浮窗卡片 | :132 |
| CSSC-stage | 8c 设置页预览舞台 | :175 |
| CSSC-controls | 8c 设置页控件 | :411 |

## 3. 设置键矩阵

### 3.1 灯台主设置（`MapleLantern.settings.v1`，默认见 core.js:242）

| 键 | 默认 | 含义 |
|---|---|---|
| theme | cyberpunk | 八主题之一（auto/cyberpunk/amber/jade/star/fog/school/paper/grass） |
| ornament | true | 主题边饰总开关（auto 在原生层解析为 cyberpunk，边饰随 cyberpunk） |
| scale / glass | 100 / 60 | 面板缩放 / 玻璃度 |
| density | cozy | cozy/compact |
| motion | true | 动效总开关 |
| lang | auto | auto/zh/en |
| side / y | right / 0.78 | 面板侧与纵坐标 |
| native | true | 原生层总开关 |
| thirdPartyNative | false | 第三方美化页原生接管 |
| optStats / optMoney / optRailSkin / optRailPct / optMeterSkin / optMeterValue / optOptions / optSidebar / optOverlay | 均 true | 原生层细粒度门控（映射到 `data-ml-opt-*` 属性，见 native.js:68 OPT_ATTRS） |
| panel / seen | false | 面板当前开合 / 是否见过 |

### 3.2 自定义外观（`MapleLanternDossier.settings.v1`，默认见 dossier-core.js:23）

| 键组 | 键 | 说明 |
|---|---|---|
| 背景 bg | bgOn / bgOpacity / bgFit / bgZoom / bgX / bgY / bgSoft | fit ∈ cover/contain/fill |
| 按钮 btn | btnOn / btnOpacity / btnFit / btnZoom / btnX / btnY | 同构 |
| 卡片 card | cardOn / cardOpacity / cardFit / cardZoom / cardX / cardY | 同构 |
| 通用 | fontScale / surfaceAlpha / syncMl | syncMl=true 时同步灯台主题变量（dossier-core.js:376 ML_MAP） |
| 颜色 | colors.{accent,surface,text,line} | 空串=跟随灯台主题 |

## 4. 测试矩阵

| 测试文件 | 覆盖 |
|---|---|
| core.test.js | core 纯逻辑全量（含 1.5.1 版本断言、绿茵调色板与浅底对比度、石墨迁移、文字色预设逐色 ≥4.5:1） |
| dom.test.js | render 面板层 DOM 装配（含文字色落值/换主题回退） |
| native.test.js / native-round2.test.js | 原生层打标（round2 含 `<a>` 入口等 1.4.22 修复回归） |
| contract.test.js | CSS/JS 契约不变量（D3 = 按压选择器不得混排 `:has` 成员；1.5.1 增绿茵落值、边饰八套/开关/小屏、石墨零残留、文字色只挂正文层）；全量 246 断言 |
| custom.test.js / custom-card.test.js | custom.js 外观应用与浮窗卡片 |
| dossier-lifecycle.test.js | dossier 四件套生命周期（1.5.0 修复回归） |
| compat-preload.test.js | MEE 代理（假阳性修复回归） |

## 5. 坑位速查（详文在 KNOWLEDGE.md）

| 主题 | 位置 |
|---|---|
| 几何基线（#ui-bar 280px / #img 原生） | KNOWLEDGE.md §1 |
| 缩放判据（预览 vs 设备） | KNOWLEDGE.md §2 |
| 动效库分区 | KNOWLEDGE.md §4「动效库分区」 |
| 自定义外观四道判据 + CSP | KNOWLEDGE.md §7.2/7.3 |
| 原生层开关 + CE 共存 | KNOWLEDGE.md §8 / ERR-20261115-002/003 |
| 错误台账全集 | KNOWLEDGE.md §6 |
| 游戏外：冒烟门禁口径（init 非 mod 数、仅 A/B/C 判失败） | 项目根 `mce-e2e\real_smoke_baseline.json` |

## 6. 行号复核命令（大改后跑）

```powershell
cd MapleLantern\src
Select-String -Path *.js -Pattern '^  (function \w+|var [A-Z_]+ =)' | ForEach-Object { $_.Filename + ":" + $_.LineNumber }
Select-String -Path *.css -Pattern '^-{1,3} [-=]+ .*' | ForEach-Object { $_.Filename + ":" + $_.LineNumber }
```
