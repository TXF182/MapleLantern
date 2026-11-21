# 灯台 MapleLantern — 知识图谱（机器可检索版）

> 生成：2026-11-21 / 版本 1.5.1。
> 定位约定：`FN-*` 功能条目见 `docs/FUNCTION-MATRIX.md`（带 file:line）；本图只画「谁调谁、谁约束谁、哪条坑位解释哪段设计」。
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
| KG-MOD-RENDER | 面板渲染 | src/render.js（全局 MapleLantern） |
| KG-MOD-NATIVE | 原生层接管 | src/maplelantern-native.js（全局 MapleLanternNative） |
| KG-MOD-DCORE | 外观逻辑 | src/dossier-core.js（MapleLanternDossierCore） |
| KG-MOD-DASSETS | 图库存储 | src/dossier-assets.js（MapleLanternDossierAssets） |
| KG-MOD-DTHEME | 外观应用层 | src/dossier-theme.js（MapleLanternDossierTheme） |
| KG-MOD-DPANEL | 外观面板 | src/dossier-panel.js（MapleLanternDossierPanel） |
| KG-MOD-CUSTOM | 外观入口 | src/custom.js（MapleLanternCustom） |
| KG-MOD-COMPAT | inject_early 兼容层 | src/compat-preload.js |
| KG-MOD-CSSN | 原生层样式 | src/maplelantern-native.css（`html[data-ml-native="on"]` 前导） |
| KG-MOD-CSSP | 面板样式 | src/style.css（#ml-root） |
| KG-MOD-CSSF | 动效层 | src/effects.css |
| KG-MOD-CSSC | 自定义外观样式 | src/custom.css |

### 1.2 功能（FUNC，锚点用 FUNCTION-MATRIX 的 FN-ID）

| ID | 名称 | FN-ID |
|---|---|---|
| KG-FUNC-SETTINGS | 主设置链路（读写/净化/应用） | FN-core-defaults, FN-core-sanitize, FN-render-settings |
| KG-FUNC-THEMES | 九主题调色板 | FN-core-palettes |
| KG-FUNC-ORNAMENT | 主题边饰 | FN-render-settings, CSSO-frame |
| KG-FUNC-TEXTCOLOR | 正文文字色 | FN-core-textcolor, FN-render-textcolor, FN-native-textcolor, CSSN-textcolor, CSSP-color |
| KG-FUNC-CONTRAST | 对比度与颜色推导 | FN-core-contrast, FN-dc-colors |
| KG-FUNC-VIEWPORT | 缩放/视口/面板原点 | FN-core-viewport |
| KG-FUNC-PANEL | 面板开关与页签 | FN-render-panel, FN-render-tabs |
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
| KG-CST-TEXTCOLOR | 文字色只改正文与标题 | 自定义色走 `--mln-text-custom`，只挂 `#passages`/`.passage` 与 `.passage h1–h4`；不改写 `--mln-text`，选项/读数/侧栏不受影响；低于 4.5:1 不生效 |
| KG-CST-MOTION | 动效三层关断 | `data-ml-motion="off"` + prefers-reduced-motion + 原生层同构 |
| KG-CST-STORE | 存储键与迁移 | MapleLantern.settings.v1 / MapleLanternDossier.settings.v1；sanitize 白名单 |
| KG-CST-BOOT | 加载顺序 | boot.json scriptFileList：core→native→render→dossier 四件→custom；inject_early=compat-preload |
| KG-CST-VERSION | 版本三源一致 | boot.json:3 / core.js:16 / dossier-core.js:17 必须同步 |
| KG-CST-OLDVIEW | 旧 WebView 验证口径 | 无旧设备实测；用「静态剥离模拟 + D3 契约 + 真实 mouse.down 测量」替代 |

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

### 1.5 验证（VLD）

| ID | 名称 | 详情 |
|---|---|---|
| KG-VLD-TESTS | 全量测试 | `node --test tests\*.test.js`；1.5.1 = 246/246（含绿茵/边饰/石墨移除/文字色断言） |
| KG-VLD-HOSTPROBE | 宿主探针 | `pwsh tools\host-probe.ps1`（服务根=工程根，否则全 false） |
| KG-VLD-PACK | 确定性打包 | `pwsh .\pack.ps1` → dist + SHA256.txt |
| KG-VLD-CHECK | 包结构校验 | dol-ui-design `check_ui_mod.py`（14 PASS/1 WARN 基线） |
| KG-VLD-REAL | 实机安装探针 | `%TEMP%\ml_151_real.js`：真实导入页→IDB→游戏（1.5.1），含绿茵色板/边饰伪元素/窄屏收敛/边饰开关/文字色落值与回退 |
| KG-VLD-SMOKE | game-smoke | mce-e2e\real_smoke.ps1 |

## 2. 边（依赖/调用/约束关系，每行一条）

```text
# --- 装配顺序（boot.json） ---
KG-MOD-COMPAT -> KG-MOD-CORE        inject_early 先于主链
KG-MOD-CORE   -> KG-MOD-RENDER      render 消费 MapleLanternCore
KG-MOD-CORE   -> KG-MOD-NATIVE      native 消费 MapleLanternCore
KG-MOD-CORE   -> KG-MOD-DCORE       dossier 消费 core 的 palette/luminance
KG-MOD-RENDER -> KG-MOD-DTHEME      render.destroy 级联 DTheme.destroy
KG-MOD-RENDER -> KG-MOD-DPANEL      render.destroy 级联 DPanel.destroy
KG-MOD-RENDER -> KG-MOD-NATIVE      setSetting→Native.refresh；destroy 级联
KG-MOD-CUSTOM -> KG-MOD-DTHEME      custom.boot→DTheme.apply
KG-MOD-CUSTOM -> KG-MOD-DASSETS     custom.attach 走 dataUrlFor

# --- 功能内依赖 ---
KG-FUNC-SETTINGS -> KG-CST-STORE    净化白名单与迁移
KG-FUNC-SETTINGS -> KG-FUNC-THEMES  theme 枚举约束
KG-FUNC-SETTINGS -> KG-MOD-NATIVE   opt* 门控→OPT_ATTRS 属性
KG-FUNC-VIEWPORT -> KG-CST-ZOOM     缩放换算口径
KG-FUNC-VIEWPORT -> KG-CST-GEOM     面板原点不破原生几何
KG-FUNC-PANEL -> KG-FUNC-ORB        悬浮球 toggle 面板
KG-FUNC-PANEL -> KG-FUNC-DESTROY    closePanel(reason) 级联
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
KG-FUNC-MEE -> KG-PIT-MEE           compat-preload 修复点

# --- 样式层 ---
KG-MOD-CSSN -> KG-CST-GATE          全部规则 data-ml-native 前导
KG-MOD-CSSN -> KG-FUNC-PRESS        CSSN-press 按压组
KG-MOD-CSSP -> KG-FUNC-PRESS        CSSP-press 按压组
KG-MOD-CSSP -> KG-CST-MOTION        CSSP-motion-off 零 JS 判据
KG-MOD-CSSC -> KG-FUNC-DOSSIER      三件套样式
KG-MOD-CSSF -> KG-MOD-CSSN          mln-* keyframes 供原生层
KG-MOD-CSSF -> KG-MOD-CSSP          ml-* keyframes 供面板层

# --- 验证链 ---
KG-VLD-TESTS -> KG-CST-VERSION      测试断言版本三源
KG-VLD-TESTS -> KG-CST-HAS          contract D3 不变量
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
#图片 #image #图库      KG-FUNC-GALLERY KG-CST-CSP KG-PIT-IMG-RETRY KG-PIT-FILEINPUT
#主题 #theme           KG-FUNC-THEMES CSSN-cyber CSSP-cyber CSSN-texture
#边饰 #ornament        KG-FUNC-ORNAMENT CSSO-frame
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
