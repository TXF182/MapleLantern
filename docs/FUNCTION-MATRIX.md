# 灯台 MapleLantern — 功能矩阵

> 生成：2026-11-27 / 版本 **1.6.0**（行号锚点以 1.6.0 源码为准；1.5.1–1.5.13 的细分行号保留作历史，大改后按文末「行号复核命令」重抓）。
> 用途：按「功能 → 文件:行号 → 实现要点 → 测试 → 坑位」快速定位。行号随改码漂移，大改后按文末「行号复核命令」重抓锚点。
> 维护纪律：新增/改名函数时同步本表与 `docs/KNOWLEDGE-GRAPH.md`。
> **1.6.0 扫描口径**：`src` 21 文件 = 11 JS + 7 CSS + `boot.json` + `README.md`；测试 17 个 `*.test.js` / **340 断言**；图库 106 背景 + 106 前景；`tools/verify.ps1` 4/4（76 文件 / `63e90109f370a51d`，stamp `482206de…`）。1.6.0 新增 `ui-kit.js` / `ui-kit.css` 两文件（五入口原语 + 状态矩阵 + 四高频面/布景/原生衣柜迁移），行号与测试计数在此表补齐。

## 0. 模块总览（加载顺序 = boot.json `scriptFileList`）

| ID | 文件 | 行数 | 职责 | 全局出口 |
|---|---|---|---|---|
| MOD-core | `src/core.js` | 781 | 纯逻辑层：设置/字符串/主题/视口/面板原点，无 DOM | `window.MapleLanternCore` |
| MOD-deco-core | `src/deco-core.js` | 1,110 | 九层布景纯逻辑：4 背景 + 5 前景、地点链、自动收录、预设、JSON 往返、宿主桥接 | `window.MapleLanternDeco` |
| MOD-native | `src/maplelantern-native.js` | 2,395 | 原生层接管：侧栏四格、状态卡、商店/衣柜、CE 共存、入口注入 | `window.MapleLanternNative` |
| MOD-render | `src/render.js` | 1,940 | 面板渲染：悬浮球、面板、页签、按压反馈、生命周期 | `window.MapleLantern` |
| MOD-ui-kit | `src/ui-kit.js` | 169 | UI 组件原语：row/card/section/segmented/mark；状态与键盘语义 | `window.MapleLanternUI` |
| MOD-dossier-core | `src/dossier-core.js` | 568 | 自定义外观逻辑：颜色推导、对比度、背景几何、设置净化 | `window.MapleLanternDossierCore` |
| MOD-dossier-assets | `src/dossier-assets.js` | 325 | 图库：IndexedDB 存取、解码缩放、webp 检测、CSP data URL | `window.MapleLanternDossierAssets` |
| MOD-dossier-theme | `src/dossier-theme.js` | 241 | 外观应用层：CSS 变量、背景层几何、主题变量快照 | `window.MapleLanternDossierTheme` |
| MOD-dossier-panel | `src/dossier-panel.js` | 1,145 | 自定义外观设置面板：舞台拖拽、文件拾取、颜色/滑杆控件 | `window.MapleLanternDossierPanel` |
| MOD-custom | `src/custom.js` | 71 | 外观持久化与应用入口 | `window.MapleLanternCustom` |
| MOD-deco-panel | `src/deco-panel.js` | 1,612 | 布景页：九层卡、图库选择器、图库包状态、自动地点、预设、JSON 导入导出 | `window.MapleLanternDecoPanel` |
| MOD-compat | `src/compat-preload.js` | 110 | inject_early：MEE 假阳性修复（`window.mee` 未安装保持 undefined） | — |
| CSS-native | `src/maplelantern-native.css` | 5,364 | 原生层样式（`html[data-ml-native="on"]` 前导） | — |
| CSS-style | `src/style.css` | 2,104 | 面板层样式（`#ml-root` 作用域） | — |
| CSS-effects | `src/effects.css` | 859 | 动效层 keyframes | — |
| CSS-custom | `src/custom.css` | 503 | 玩家自定义外观三件套（背景/按钮底纹/浮窗卡片） | — |
| CSS-deco | `src/deco.css` | 188 | 布景页九层卡/图库选择器/状态条样式 | — |
| CSS-ornaments | `src/ornaments.css` | 136 | 主题边饰：`#passages::before` 四边框、标题枝、八套主题、小屏收敛 | — |
| CSS-ui-kit | `src/ui-kit.css` | 271 | UI 语义层：44px 触控、间距/线/面/文字/强调/危险令牌、状态矩阵、600/899/1280 与减少动效 | — |

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
| FN-render-boot | boot() / window.MapleLantern 出口 | render.js:1900/1912 | 绑定全部事件；出口含 toggle/openPanel/closePanel/destroy/refresh 等 | dom/native-round2 |
| FN-render-settings | loadSettings/saveSettings/setSetting/applySettings | render.js:165/189/201/240 | 设置读写（`MapleLantern.settings.v1`）；applySettings 同步 body 属性与原生层 | core/dom |
| FN-render-buildroot | buildRoot() | render.js:394 | 构建 #ml-root 面板 DOM | dom |
| FN-render-tabs | renderTabs/activateTab/onTabKey | render.js:510/558/585 | 七页签切换与键盘 | dom |
| FN-render-now | renderNow/renderBridge/bridgeRow | render.js:650/727/771 | 「此刻」页：桥接行（含第三方） | dom |
| FN-render-vitals | renderVitals | render.js:867 | 「身心」页 | dom |
| FN-render-worn | renderWorn | render.js:905 | 「着装」页 | dom |
| FN-render-system | renderSystem | render.js:947 | 「系统」页：诊断/复制 | dom |
| FN-render-switches | renderSwitches | render.js:1024 | 「开关」页 | dom |
| FN-render-settings-page | renderSettings | render.js:1072 | 「设置」页：滑杆/主题/密度/语言/门控；滑杆生成含 pointercancel 清理；主题下的「文字色」行只重画色点不重建整页 | dom |
| FN-render-textcolor | colorControl（renderSettings 内） | render.js:1158-1221 | 自动/预设色点/自定义取色器；换主题时 `textColorFor` 不达标即回 auto + 提示 | dom/contract |
| FN-render-findbutton | findButton(root, rx, allowAnchor) | render.js:805 | 按钮查找；`allowAnchor` 支持 `<a>` 入口（1.4.22 修复） | native-round2 |
| FN-render-thirdparty | findOptionsButton/findOverlayButton/openThirdParty | render.js:818/823/841 | 第三方美化页入口策略 | native-round2 |
| FN-render-panel | openPanel/closePanel/togglePanel/syncPanelOrigin | render.js:1399/1454/1491/1430 | 面板开关；closePanel(reason) 触发级联 destroy | dom |
| FN-render-orb | placeOrb/onOrbDown/onGripDown | render.js:362/1564/1644 | 悬浮球拖拽/双击回中（仅「悬浮灯台」开启时） | dom |
| FN-render-press | PRESS_SELECTOR/onPressFx/clearPressTimers | render.js:1816-1865 | 按压反馈 JS 侧：pointerdown 加 `.ml-is-pressed`，只缩放不下沉 | contract |
| FN-render-passage | applyPassage/onPassage | render.js:1707/1721 | passage 渲染后同步（不再加入场 transform，1.4.22 修复） | contract |
| FN-render-destroy | destroy() | render.js:1778 | 级联：撤销事件、清 root、清按压、原生/主题/面板层 destroy | dom |

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

### 1.5 deco-core.js（九层布景纯逻辑）

| ID | 功能 | 位置 | 要点 | 测试 |
|---|---|---|---|---|
| FN-deco-layers | LAYERS 九层定义 | deco-core.js:19-29 | 4 背景 `baseZ -30/-25/-20/-15` + 5 前景 `300/305/310/315/320`；`varKey/showKey/zKey` 与原「前景背景模组」兼容 | deco |
| FN-deco-catalog | CATALOG 图库键 | deco-core.js:40-58 | **106 项**：88 地点 + Core4 + 14 街道总线 + 3 室内借用页 + `hotel`；目录只决定选择器展示 | deco |
| FN-deco-passage | PASSAGE_MAP | deco-core.js:61-75 | 6 条：`bus station` / `soup kitchen` / `soup kitchen closed` / `police back office` / `underground dance` / `underground dance intro` | deco |
| FN-deco-bus | BUS_ALIAS | deco-core.js:77-81 | `commercial→com_alley` / `industrial→ind_alley` / `residential→res_alley`，修正 `$bus` 街区档位与图库键不同名 | deco |
| FN-deco-path | safeImagePath / imagePath | deco-core.js:140/158 | 背景目录 `img/decorations/ml/background1`、前景 `foreground1`；绝对/`..`/非 png 路径拒绝，legacy 路径归一 | deco |
| FN-deco-location | locationInfo | deco-core.js:184-254 | 地点链：visual 派生 → `$location` → 父级回退；`town/outside` 才吃 `$bus`，passage 优先插链首 | deco |
| FN-deco-auto | autoCatalogName / ensureAutoLocation | deco-core.js:296/311 | 白名单内自动收录；玩家手动移除进 `decoAutoBgExcluded` 不再回流；`skill` 由入口触发 | deco |
| FN-deco-presets | savePreset / applyPreset / deletePreset / nextPresetSlot | deco-core.js:335-398 | 预设槽 1–99；保存九图、Z、override、显示与自动名单；套用前先恢复自动层 | deco |
| FN-deco-recent | decoRecent / decoRemember | deco-core.js:399/413 | 最近使用去重、置顶、上限 8；空值不入表 | deco |
| FN-deco-export | exportDeco / importDeco | deco-core.js:486/521 | JSON 往返：只覆盖布景键；Z 夹紧 ±50；路径拒绝 `..`；坏数据整段拒收 | deco |
| FN-deco-overlay | computeOverlay / applyOverlay | deco-core.js:568/819 | 夜间/雨天滤镜只作用于声明层；颜色/亮度输出可预测 | deco |
| FN-deco-autoapply | applyAutoBackground / applyAutoForeground | deco-core.js:641/687 | 备份玩家原图/显示；重复匹配不覆盖备份；关闭后完整恢复 | deco |
| FN-deco-register | registerLayers / mode | deco-core.js:971/1063 | 原模组存在则只读兼容让出渲染权；原模组缺失时灯台注册九层；异常不向游戏抛 | deco |
| FN-deco-refresh | refresh / applyAutoOnPassage | deco-core.js:807/709 | passage 渲染后刷新；自动背景/前景按当前地点链套用 | deco |

### 1.6 deco-panel.js（布景页 UI）

| ID | 功能 | 位置 | 要点 | 测试 |
|---|---|---|---|---|
| FN-deco-page | renderPage / rebuildPage | deco-panel.js:1315/1367 | `deco` 页签入口；九层卡 + 状态条 + 图库/自动/预设/交换四区 | deco-panel |
| FN-deco-mark | markDeco / syncPackStatus 重标 | deco-panel.js:1343/733 | 布景语义标注；缺包只让 `.ml-deco-status` 承载 danger，预设/自动/地点区块保持 normal | deco-panel |
| FN-deco-layersui | buildLayers / layerCard / layerGroup | deco-panel.js:941/879/926 | 4 背景 + 5 前景分组；缩略图、显示开关、Z 滑杆、选择/清除 | deco-panel |
| FN-deco-picker | openPicker / renderPickerGrid / renderRecentRow | deco-panel.js:1384/1452/1421 | 图库选择器：搜索 150ms 去抖、中文输入法组合期不重建、最近使用 8 项可点可清 | deco-panel |
| FN-deco-set | setImage / setVisible / setZ | deco-panel.js:507/535/542 | 写 `background_image* / foreground_image*`、`show_*`、`deco_bg*/deco_fg*`；路径与 Z 走净化 | deco-panel |
| FN-deco-pack | probeImagePack / probe / syncPackStatus | deco-panel.js:659/676/733 | 图库包检测：ready/partial/missing 三态；缩略图按需加载、失败态不阻塞面板 | deco-panel |
| FN-deco-autoUI | buildAuto / addLocation / addAllLocations / removeLocation | deco-panel.js:1101/585/597/619 | 自动背景/前景开关、当前地点加入、一键全收录、移除进排除 | deco-panel |
| FN-deco-presetUI | buildPresets | deco-panel.js:971 | 预设保存/套用/删除；槽位 1–99 与名称输入 | deco-panel |
| FN-deco-exchange | buildExchange | deco-panel.js:1042 | 配置 JSON 导出/导入；失败提示与整段拒收 | deco-panel |
| FN-deco-filterUI | buildFilter | deco-panel.js:1250 | 夜间/雨天滤镜开关与强度；只改声明层 | deco-panel |
| FN-deco-boot | bootHost / onPassage / onStoryReady / bindHost / destroy | deco-panel.js:1520/1530/1541/1550/1564 | 原模组先注册；1000ms 后补自举；passage/storyready/destroy 生命周期 | deco-panel |

### 1.7 ui-kit.js（UI 原语与状态语义）

| ID | 功能 | 位置 | 要点 | 测试 |
|---|---|---|---|---|
| FN-ui-mark | mark(node, kind, state) | ui-kit.js:24 | 只追加 `data-ui` / `data-ui-state` 与 `ml-ui-*` 类；既有 DOM 可复用，不重建布局 | ui-kit |
| FN-ui-row | row(opts) | ui-kit.js:38 | 整宽行卡；默认 `normal`；迁移身心行、开关行、`dlRow` 与原生衣柜行 | ui-kit/dom |
| FN-ui-card | card(opts) | ui-kit.js:44 | 状态卡/主题预览/空槽；可带 label/value；主题卡与 option 分开标记避免覆盖 | ui-kit/dom |
| FN-ui-section | section(opts) | ui-kit.js:62 | 标题 + hint + body；hint 用 `--ml-ui-muted`（绿茵 faint 仅 3.05:1，不作正文） | ui-kit |
| FN-ui-segmented | segmented(opts) | ui-kit.js:95 | radiogroup；`aria-checked`、`data-ui-option`、方向键/Home/End；disabled 保持 disabled 状态且键盘跳过 | ui-kit |
| FN-ui-export | window.MapleLanternUI | ui-kit.js:161 | 导出 el/mark/row/card/section/segmented；ES5，无 :scope/模板字符串/可选链 | ui-kit/contract |

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
| CSSO-frame | 主题边饰层（独立 `src/ornaments.css`，见 2.6） | 2.6 | `#passages::before` 12px `border-image` 帧 + `.passage` 内衬 + `h1::after` 标题枝 |
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

### 2.5 deco.css（布景页）

| ID | 分区 | 位置 | 主要选择器/内容 |
|---|---|---|---|
| CSSD-page | 页容器/状态条 | :2-19 | `.ml-deco-page`、`.ml-deco-status`、`.ml-deco-pill`、`.ml-deco-chain`、图库三态色 |
| CSSD-group | 九层分组 | :21-39 | `.ml-deco-section`、`.ml-deco-group`、`details` 折叠头与箭头 |
| CSSD-grid | 九层卡网格 | :40-66 | 三列 `.ml-deco-grid`、缩略图 2:1、缺失态红边 |
| CSSD-controls | 卡内控件/重试 | :67-188 | 小按钮、图库就绪隐藏重试、勾选、滑杆、选择器/预设/JSON 区 |

### 2.6 ornaments.css（主题边饰）

| ID | 分区 | 位置 | 主要选择器/内容 |
|---|---|---|---|
| CSSO-tokens | 边饰变量 | :13-19 | `--mln-orn-frame/title/a/thick/pad`；auto 保持 `none` |
| CSSO-frame | 正文四边框 | :23-39 | `#passages` 内衬 + `#passages::before` 12px `border-image`；`pointer-events:none` |
| CSSO-passage | 正文内衬/标题枝 | :40-61 | `.passage` 内衬、`h1::after` 枝；不挂 background |
| CSSO-themes | 八套主题图案 | :62-113 | cyberpunk/amber/jade/star/fog/school/paper/grass 八套 `--mln-orn-*` |
| CSSO-small | 小屏收敛 | :114-135 | ≤600 收 8px；≤420 仅标题枝；静态、无动画 |

### 2.7 ui-kit.css（UI 语义层）

| ID | 分区 | 位置 | 主要选择器/内容 |
|---|---|---|---|
| CSSU-tokens | 原语令牌 | :6-26 | 44px 触控、4 档间距、线/面/文字/强调/危险/圆角/focus；同时挂 `#ml-root` 与原生正文 |
| CSSU-primitives | 原语底座 | :30-77 | row 最小 44px；card `min-width:0/overflow:hidden`；section 标题省略、hint 不换行 |
| CSSU-states | 状态矩阵 | :85-126 | selected / disabled / danger / empty / loading；loading 只在 `prefers-reduced-motion:no-preference` 播 shimmer |
| CSSU-hover | 细指针 hover | :131-151 | 只在 `(hover:hover) and (pointer:fine)`；active 只 `scale(.97)`，无 `translateY` |
| CSSU-migrate | 迁移面 | :154-222 | 此刻/身心/着装/设置/布景/原生衣柜的追加语义，不覆盖原 `.ml-*` 布局 |
| CSSU-responsive | 响应式 | :226-251 | 600 收间距与空槽高度；899 hint 右对齐；1280 放大 section gap |
| CSSU-motion | 动效关断 | :254-270 | `data-motion=off` + 原生 `data-ml-motion=off` + `prefers-reduced-motion` 三覆盖 |

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

### 3.3 布景九层（游戏存档 `V.*`，不是 localStorage；以 `deco-core.js` 为准）

| 键组 | 键 | 说明 |
|---|---|---|
| 图层图 | `background_image1..4` / `foreground_image1..5` | 图层图名（图库键）；空/none/undefined 均视为无图 |
| 显示 | `show_background1..4` / `show_foreground1..5` | 未声明为显示，显式 `false` 才隐藏 |
| Z 偏移 | `decoImageZ` → `deco_bg1..4` / `deco_fg1..5` | 基准 Z + 偏移，夹紧 ±50；非数值按 0 |
| 路径覆盖 | `decoImagePath` → 图层 id | `safeImagePath` 只允许 png 与图库目录，拒绝 `..` |
| 自动背景 | `decoAutoBgEnabled` / `decoAutoBgLocations` / `decoAutoBgExcluded` / `decoAutoBgActive` / `decoAutoBgSource` / `decoAutoBgBackup` / `decoAutoBgBackupShow` | 开启后按地点链收录；移除进排除；`Active/Backup` 用于关闭后恢复 |
| 自动前景 | `decoAutoFgEnabled` / `decoAutoFgLocations` / `decoAutoFgActive` / `decoAutoFgSource` / `decoAutoFgBackup` / `decoAutoFgBackupShow` | 与背景同构；`decoAutoFgLocations` 独立白名单 |
| 预设 | `decoPresets` | 槽 1–99；每槽含九图、Z、路径、显示与自动名单 |
| 最近使用 | `decoRecent` | 去重置顶，上限 8 |
| 滤镜 | `decoColorOverlay` / `decoFilterLayers` / `decoAutoBgFilterEnabled` | 夜间/雨天只作用于声明层；关闭清空 |

## 4. 测试矩阵

**17 个 `*.test.js` / 340 断言**（`pwsh tools\verify.ps1` 2026-11-27 实测：340/340 PASS，fail 0 / cancelled 0 / skipped 0）。

| 测试文件 | 覆盖 |
|---|---|
| core.test.js | core 纯逻辑全量（版本断言、九主题调色板与浅底对比度、文字色逐色 ≥4.5:1） |
| dom.test.js | render 面板层 DOM 装配（文字色落值/换主题回退） |
| native.test.js / native-round2.test.js | 原生层打标（round2 含 `<a>` 入口、CE 结构签名回归） |
| contract.test.js | CSS/JS 契约不变量（按压选择器分列、主题落值、边饰八套/开关/小屏、文字色只挂正文层） |
| custom.test.js / custom-card.test.js | custom.js 外观应用与浮窗卡片 |
| dossier-lifecycle.test.js | dossier 四件套生命周期（含 1.5.0 修复回归） |
| compat-preload.test.js | MEE 代理（假阳性修复回归） |
| deco.test.js | 九层定义、路径/Z/地点链、`$bus` 三档、PASSAGE_MAP 六条、自动背景/前景、预设、JSON 往返、滤镜、CATALOG 106 |
| deco-panel.test.js | 布景页生命周期、九层卡、图库选择器、图库包三态、自动地点、预设、交换、销毁 |
| theme-matrix.test.js | 主题元数据唯一性/顺序、zh/en 文案、4.5:1 对比度、预览、面板块/原生块/边饰 |
| hover-guard.test.js | 触屏 hover 粘连回归（`@media (hover:hover)` 10 条规则） |
| wardrobe-card.test.js | 衣柜行卡化（图标回卡内、整行 100%、动作行两列、商店分支） |
| ui-kit.test.js | UI kit 原语/状态矩阵/四高频面语义/布景与原生衣柜/segmented disabled 与键盘 |
| dolsmartphone-compat.test.js | DolSmartPhone 手机壳隔离矩阵（`#phone-wrapper` 整机子树） |
| modhub-companion.test.js | ModHub 伴生入口与兼容 |

## 5. 坑位速查（详文在 KNOWLEDGE.md）

| 主题 | 位置 |
|---|---|
| 几何基线（#ui-bar 280px / #img 原生） | KNOWLEDGE.md §1 |
| 缩放判据（预览 vs 设备） | KNOWLEDGE.md §2 |
| 动效库分区 | KNOWLEDGE.md §4「动效库分区」 |
| 自定义外观四道判据 + CSP | KNOWLEDGE.md §7.2/7.3 |
| 布景九层 / 地点链 / `$bus` 三档 / PASSAGE_MAP | KNOWLEDGE.md 顶部 1.5.11–1.5.14 记录；`docs/COVERAGE.md` |
| 布景图库 106+106 / 前景安全区 `x=86–237` | `docs/FOREGROUND-STYLE.md` |
| 图库包三态（ready/partial/missing）与重试门控 | `src/deco-panel.js:659/733`；`tools/deco-pack-probe.js` |
| 原生层开关 + CE 共存 | KNOWLEDGE.md §8 / ERR-20261115-002/003 |
| 错误台账全集 | KNOWLEDGE.md §6 |
| 游戏外：冒烟门禁口径（init 非 mod 数、仅 A/B/C 判失败） | 项目根 `mce-e2e\real_smoke_baseline.json` |

## 6. 行号复核命令（大改后跑）

```powershell
cd MapleLantern\src
Select-String -Path *.js -Pattern '^  (function \w+|var [A-Z_]+ =)' | ForEach-Object { $_.Filename + ":" + $_.LineNumber }
Select-String -Path *.css -Pattern '^-{1,3} [-=]+ .*' | ForEach-Object { $_.Filename + ":" + $_.LineNumber }
```
