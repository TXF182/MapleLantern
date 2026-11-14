# 灯台 MapleLantern — 维护知识与错误台账

> 最后核对：2026-11-15 / 1.3.0 开发基线（基于 1.2.0 发布版，未发布）；主题、动效与代码分区改动在工作树，HEAD `f7213b9`，123/123 PASS
> 本文件只记「为什么这样定」和「已经踩过的坑」。可执行判据仍在 `README.md`、`tests/`、`tools/`。
> 历史设计稿在 `docs/archive/`，只作追溯，不代表当前行为。

## 1. 当前几何基线（v1.2.0 起，1.3.0 沿用）

v1.2.0 起的立绘与侧栏**完全走游戏原生**，1.3.0 沿用，不重写画布。任何缩放、432 或 540 视口都不应再改变这套几何。

| 区域 | 当前规则 | 说明 |
|---|---|---|
| `#ui-bar` 宽度 | **280px（原生）** | 不写 `#ui-bar#ui-bar { width: ... }` |
| `#img` 定位 | **`left:64px`（原生）** | 不写 `body.has-images #img` |
| `#img > canvas` | **256×256（原生）** | 不写 `width:100%; height:auto` |
| `#stats` | `width:100% !important` | 状态卡占满可用宽度 |
| 顶栏 | 四格（菜单/金额/时间/日期） | 窄屏 `@media max-width:632px` 保留 |
| 金额 | 单行 `nowrap` | 不换行、不拆成两行 |
| 日期 | 横排 | 不竖排成“星期/日”两行 |
| 正文选项 | 窄屏单列 | 只重排，不改按钮业务 |

**禁止项**（回归测试已锁）：

- `body.has-images #img`
- `#img > canvas`
- `#ui-bar#ui-bar { width: ... }`

取证：`git show v1.1.22:src/maplelantern-native.css` 里没有上述三类规则；用户实机的正常基线就是 v1.1.22。

## 2. 缩放判据（手机与预览对不上时先查这个）

DoL 手机端的“页面缩放”与预览工具不是同一个值。实测：

- 预览 `540@85`：侧栏物理宽约 **480px**
- 同一 540 视口 `540@100`：侧栏物理宽约 **565px**
- `565 / 480 = 1.177 ≈ 100 / 85`

所以用户手机截图里 565px 的侧栏，不是 CSS 断点写错，而是**手机跑在 100% 缩放**，预览跑在 85%。只拿 85% 预览去对手机，会得出“右侧被盖住/画布被压缩”的错误结论。

**规则**：

1. 任何“手机布局正常/不正常”的结论，必须同时看 **85% 与 100%** 两张同视口截图。
2. CSS 宽度换算物理像素：`CSS px × DPR × 页面缩放`。540 视口、DPR=2 时，100% 下 280px 侧栏约 560px（含边框约 565px）。
3. 不用 85% 预览单独验收 100% 实机。

对照图（保留在 `prototype/shots/`）：

- `v1131f-85-540.png` / `v1131f-100-540.png`
- `v1131h-85-540.png` / `v1131h-100-540.png`

## 3. 第三方共存：O0O 战斗美化G2

包：`[可直装]O0O战斗美化G2.zip`，技术名 `[修改版]O0O战斗美化G2`，version `1.100.0`。

结构事实：

- `imgFileList` 5100 项；`scriptFileList` / `tweeFileList` 为空
- `scriptFileList_inject_early`: `dist/CombatImageHook.js`、`dist/legfix.js`
- `scriptFileList_preload`: `dist/preload.js`
- 依赖：`ModLoader >=2.100.0`、`ImageLoaderHook >=2.100.0`、`ReplacePatcher >=1.2.1`
- `ReplacePatcher` 只有一条：`30-canvasmodel-editor.js` 的 `button.append(icon);` → `icon.style.width='auto';button.append(icon);`
- `CombatImageHook` 只包装 `ImageLoader`，处理 `img/sex/*`，按路径缓存 dataURL，并预加载全部战斗图
- `legfix` 包装 `PlayerCombatMapper.mapPlayerToOptions`，创建 body 直属 `#o0o-legfix`（44×44「腿」按钮，`z-index:999999`，默认 `display:none`，仅战斗显示）

结论：**不需要为 MapleLantern 1.3.0 做适配**。它不接管 `#ui-bar`/`#passages`/正文按钮/画布，灯台也不再覆盖 `#img`/canvas。

联合装载实测（隔离 profile，540×1170）：

- MapleLantern mounted、`data-ml-native=on`
- O0O 索引 **5095** 张、缓存 **5095** 张
- `#o0o-legfix` 已创建且战斗外 `display:none`
- pageerror **0** → `COEXIST: PASS`

风险（属 O0O 自身，不是适配缺口）：

1. 压缩 **21.17MB** / 解压 **27.10MB** / 7692 条目，超过 15MB；Android WebView 有内存与首次加载压力。
2. `preloadAll()` 把 5095 张图转 dataURL 全量缓存，移动端可能出现明显内存峰值。
3. 「腿」按钮固定在右下、`z-index:999999`；若同时开灯台悬浮球，可能视觉重叠，但按钮可拖动，不是功能冲突。

装载顺序：按 O0O README，放在其他图像包之后；MapleLantern 放前放后均可。若手机卡顿，优先做 O0O 的按需加载补丁，不要改灯台几何。

## 4. 主题扩展：雾港 / 旧校舍 / 纸灯（1.3.0，未发布）

主题从 6 套扩到 **9 项**（`auto` + 8 套）。新增三套的接入点固定为五处，少一处就会“设置里能选、实际只换一半”：

1. `src/core.js`：`THEMES` 增加 `fog / school / paper`，`PALETTES` 增加三套，中英文 `theme.*` 各增加三条。
2. `src/render.js`：设置页主题 segmented 增加三项；主题组使用 `ml-seg--themes` 3×3 网格，避免第 9 个按钮单独换行。
3. `src/style.css`：新增三套 `#ml-root[data-theme="..."]` 变量/纹理块；纸灯额外覆盖选中态边框、卡片内高光、悬浮球亮纸材质。
4. `src/maplelantern-native.css`：新增三套 `html[data-ml-native="on"][data-ml-theme="..."]` 变量/纹理块；纸灯额外覆盖 8 个状态色、危险删除按钮、`#ui-bar` 暖棕阴影、普通弹层/内容层暖纸兜底。
5. `tests/core.test.js` + `tests/contract.test.js`：主题总数 9、三套 `includes`、三套对比度、三套双 CSS 入口与设置项。

三套色板（正文/次要/强调均按 WCAG 逐项算过，正文与背景 ≥4.5:1）：

| 主题 | 背景 | 主文字 | 强调 | 原生 radius |
|---|---|---|---|---|
| 雾港 `fog` | `#0B1418` | `#E9F2F3` | `#E7B66B` | 12 / 8 |
| 旧校舍 `school` | `#12110D` | `#ECE5D4` | `#C9AE72` | 6 / 4 |
| 纸灯 `paper` | `#F1E7D3` | `#2A2118` | `#A9362A` | 12 / 8 |

纸灯是唯一亮色主题，必须额外处理原版语义色。原版 `.gold` `#FFD700`、`.teal` `#08C1C1`、`.red` `#EC3535` 在暖纸底上对比不足；已逐类换深墨：

| 类 | 深墨值 | 对 `#F1E7D3` 对比度 |
|---|---|---|
| `.gold` | `#6F5210` | 5.92 |
| `.teal` | `#0E5F5F` | 6.07 |
| `.red` | `#A02A1F` | 6.01 |
| `.green` | `#2F6B45` | 5.17 |
| `.blue` | `#2C4F85` | 6.67 |
| `.lblue` | `#2E6378` | 5.39 |
| `.pink` | `#8A3D6A` | 5.79 |
| `.purple` | `#5D3F86` | 6.79 |
| `.orange` | `#8A4B1E` | 5.51 |

### 原生层不能只扫正文：侧栏/开始页/菜单也要扫

第一次只覆盖了 `#passages .passage`，侧栏仍有 15 处低于 4.5:1。实测位置与修复：

| 主题 | 位置 | 原值 | 修复值 | 对背景 |
|---|---|---|---|---|
| 纸灯 | `#startCaption .gold` | `#FFD700` | `#6F5210` | 5.92 |
| 纸灯 | `#startCaption .link-external` | `#5888DD` | `#2C4F85` | 6.67 |
| 纸灯 | `#menu a` | `#EEEEEE` | `var(--mln-text)` | 12.87 |
| 纸灯 | `#ui-bar .macro-button` | 黑底 `#222` + 白字 | `#F3E7D2` 底 + `#2A2118` 字 | 12.92 |
| 纸灯 | `.small-description` | `#888888` | `var(--mln-muted)` | 5.03 |
| 纸灯 | `#gameVersionDisplay(2)` | `#777777` | `var(--mln-muted)` | 5.03 |
| 雾港 | `#history-backward/forward` | `#444444` | `var(--mln-muted)` | 8.34 |
| 雾港 | `#passages .passage .red` | `#EC3535` | `#E58C7F` | 6.20 |
| 雾港 | `#gameVersionDisplay(2)` | `#777777` | `var(--mln-faint)` | 5.56 |
| 旧校舍 | `#history-backward/forward` | `#444444` | `var(--mln-muted)` | 6.91 |
| 旧校舍 | `#passages .passage .red` | `#EC3535` | `#E08373` | 6.08 |
| 旧校舍 | `#gameVersionDisplay(2)` | `#777777` | `var(--mln-faint)` | 4.91 |
| 纸灯 | OPTIONS `.gold` | `#FFD700` | `#6F5210` | 5.92 |
| 纸灯 | OPTIONS `.linkBlue` / `(?)` | `#5888DD` | `#2C4F85` | 6.67 |
| 纸灯 | SAVES `a.link-external`（Fanbox） | `#5888DD` | `#2C4F85` | 6.67 |

扫描口径：540×1170、隔离 profile、逐可见文字节点取 `getComputedStyle().color` 与最近不透明祖先背景，按 WCAG 相对亮度算对比度；三套原生页修复后 `lowCount = 0`，三套 OPTIONS / SAVES 弹层复扫也均为 `lowCount = 0`。注意 `#history-*` 禁用态还有 `opacity`，禁用控件不计入 WCAG 正文要求。

视觉验收截图（540×1170，隔离 profile，0 pageerror）：

- 面板设置页：`prototype/shots/theme-fog-settings-540.png` / `theme-school-settings-540.png` / `theme-paper-settings-540.png`（本轮已刷新）
- 原生开始页：`prototype/shots/theme-fog-native-540.png` / `theme-school-native-540.png` / `theme-paper-native-540.png`（本轮已刷新，侧栏已展开以显示光带）
- 窄屏设置页：`prototype/shots/theme-paper-settings-390.png` / `theme-paper-settings-320.png`（本轮新增）
- 侧栏细节：`prototype/shots/theme-fog-bar-540.png` / `theme-school-bar-540.png` / `theme-paper-bar-540.png`（本轮新增，280 宽侧栏元素截图，避免 540 展开侧栏后正文被裁）
- 纸灯弹层：`prototype/shots/theme-paper-options-540.png` / `theme-paper-saves-540.png`（上一轮静态，未随动效重拍）
- 游戏内 Bedroom：`prototype/shots/theme-fog-game-540.png` / `theme-school-game-540.png` / `theme-paper-game-540.png`（上一轮静态，未随动效重拍）
- 原生几何实测：`#ui-bar 281`、`#img 216×192`、`canvas 256×256`、`#stats 280×72`

### 动效层（1.3.0，未发布）

三套主题的动效全部是 CSS，不读 `capabilities.reducedMotion`，也不改任何业务状态。

| 层 | 实现 | 三套参数 |
|---|---|---|
| 面板环境光 | `.ml-panel::after` 两层 radial，`translate3d(-3.5%,-2%)→(3.5%,2%)`，`opacity .34→.5→.38`，`scale 1.03→1.07` | 26 / 31 / 22s |
| 面板发丝线 | `.ml-panel::before` `ml-hairline`，`opacity .55→1→.55` | 7s |
| 页签淡入 | `.ml-pane` `ml-pane-in`，`opacity 0 + translateY(4px) → 1 + 0` | 200ms |
| 表盘呼吸 | `.ml-ring::after` `ml-ring-breathe`，`opacity .72→1`，`scale 1→1.015` | 5.6s |
| 原生侧栏光带 | `#ui-bar#ui-bar` `mln-bar-drift`，`background-position 0%→100%` | 28 / 32 / 24s |
| 悬浮反馈 | 按钮/页签/图标 `translateY(-1px)`；卡片 `translateY(-2px)`；active `scale(.97~.98)` | 160–220ms |

关键约束：

- 原生侧栏 **不能用环境光替换纹理**。`background-image` 必须写成 `var(--mln-bar-ambient), var(--mln-bar-texture)`；三套主题合计 5 层（2 环境光 + 3 纹理），`background-size` 也必须给 5 个值，否则第 5 层会回退到 230% 并被拉变形（ERR-007）。
- 环境光 alpha：雾港 `rgba(121,201,190,.16)` + `rgba(231,182,107,.10)`；旧校舍 `rgba(201,174,114,.16)` + `rgba(127,156,132,.09)`；纸灯 `rgba(255,250,238,.52)` + `rgba(169,54,42,.06)`。暗色两套从首版 .10/.07 提到 .16/.10，静态截图才能看出；纸灯保持高亮底不刺眼。
- 侧栏光带 alpha：雾港 11% 冷青 + 6% 暖金；旧校舍 11% 粉笔金 + 2.5% 横纹；纸灯 38% 宣纸白 + 4% 朱红。全部是低 alpha 背景层，文字仍在内容层。
- 三路关断：`data-motion="off"`（面板）、`data-ml-motion="off"`（原生）、`@media (prefers-reduced-motion: reduce)`；面板/环形/侧栏/页签四类动画均 `none`，hover/active 的 `transform` 与 `box-shadow` 也清零。
- 320/390 追加 `@media (max-width:430px)`：5 个页签 `flex:1 1 0; min-width:0`，320 下 61×44、390 下 71×44，全部可见；此前 `flex:1 0 auto` + `min-width:54px` 会让最后一个「设置」页被横向裁掉。

实机探针（540×1170，Edge 隔离 profile，三套主题）：

- `#ml-panel::after`：`ml-panel-ambient` / 26s、31s、22s，`opacity ≈0.34`；`::before`：`ml-hairline`；`.ml-pane`：`ml-pane-in`；`#ml-panel .ml-ring::after`：`ml-ring-breathe / 5.6s`。
- `#ui-bar`：`mln-bar-drift` / 28s、32s、24s；`background-size` 5 层；`background-image` 同时含环境光与纹理，纹理未被吞。
- hover 选中态主题按钮：`matrix(1,0,0,1,0,-1)`（-1px）；`ml-hairline` / `ml-panel-ambient` 均为 `running`。
- 关断：`data-motion=off` + `data-ml-motion=off` 后 panel/ring/bar/pane 全 `none`；`prefers-reduced-motion: reduce` 后同样全 `none`；0 pageerror。
- 窄屏：390/320 面板宽 390/320，页签 71/61×44 全部可见，主题网格 3×115 / 3×91×44，文档 `scrollWidth == clientWidth`，0 pageerror。

### 动效库分区（`src/effects.css`，2026-11-15）

`src/effects.css` 于 2026-11-15 从两套组件 CSS 中抽出，专门承载可复用的动效定义；组件文件只保留选择器与状态，不再内联 `@keyframes`。

- 加载顺序：`src/boot.json` 的 `styleFileList = ["style.css","maplelantern-native.css","effects.css"]`；`effects.css` 最后加载，因此 `:root` token 与 12 个 keyframes 对面板层和原生层都可见。
- 时间/缓动 token：`--ml-fx-dur-fast .16s`、`--ml-fx-dur-hover .18s`、`--ml-fx-dur-pane .2s`、`--ml-fx-dur-panel .22s`、`--ml-fx-dur-ripple .46s`、`--ml-fx-dur-orb 4.2s`、`--ml-fx-dur-hairline 7s`、`--ml-fx-dur-ring 5.6s`、`--ml-fx-dur-native 160ms`；缓动 `--ml-fx-ease-out cubic-bezier(.16,1,.3,1)`、`--ml-fx-ease-pane cubic-bezier(.2,.8,.2,1)`、`--ml-fx-ease-ripple cubic-bezier(.2,.8,.25,1)`。
- keyframes：面板层 `ml-breathe` / `ml-tabline` / `ml-hairline` / `ml-panel-ambient` / `ml-pane-in` / `ml-ring-breathe` / `ml-press-ripple`；原生层 `mln-bar-drift` / `mln-passage-in` / `mln-overlay-in` / `mln-stat-row-in` / `mln-press-ripple`。
- 工具类：`#ml-root .ml-fx-pane`（页签/面板淡入）、`.ml-fx-hairline`（发丝线呼吸）、`.ml-fx-breathe`（环形呼吸）、`.ml-fx-drift`（侧栏光带漂移）；新增组件可直接加类，不再复制 animation 定义。
- 测试：`tests/contract.test.js` 增加 `effects.css` 专项断言；`style.css` / `native.css` 若再出现 `@keyframes` 会直接失败。
- 实机探针（隔离 profile，Edge）：雾港主题下 `#ml-panel::before`=`ml-hairline`、`::after`=`ml-panel-ambient`、`.ml-pane`=`ml-pane-in`、`#ui-bar`=`mln-bar-drift`、`--ml-fx-dur-pane`=`.2s`、`--ml-fx-dur-ripple`=`.46s`；`#ml-root[data-motion="off"]` 后三者全为 `none`。

## 5. 验证命令（当前链路）

```powershell
node --test tests\*.test.js
pwsh -File pack.ps1
$env:ML_ZIP="dist\MapleLantern-1.3.0.mod.zip"; node tools\game-smoke.js
node tools\compat-smoke.js
$env:COMPAT_HOSTS="1"; node tools\compat-smoke.js
node tools\bench-native.js
python C:\Users\27352\Doubao\skills\dol-ui-design\scripts\check_ui_mod.py dist\MapleLantern-1.3.0.mod.zip
```

`boot.json` 必须是 **UTF-8 无 BOM**；版本双源为 `src/core.js VERSION` 与 `src/boot.json version`，两处必须一致。

当前实测（2026-11-15，1.3.0 正式包 107,985 B / 8 条目，SHA256 `955ef43920eb6c590d4a16586978d20cf9cdc16a70855d6722d642844fd96e00`；两次打包哈希一致）：

- `node --test tests\*.test.js`：**123 / 123 PASS**。
- `check_ui_mod.py`：**13 PASS / 1 WARN / 0 FAIL**；唯一 WARN 仍是 `maplelantern-native.js` 引用 `window.DoLGameUI` 但未声明 `StoneFreeHost` 依赖，与 1.2.0 / 1.3.0 基线一致。
- `ML_ZIP=dist\MapleLantern-1.3.0.mod.zip node tools\game-smoke.js`：**SMOKE: PASS**，18 项断言全 PASS。
- Edge 计算样式探针：`effects.css` token `.2s` / `.46s` / `cubic-bezier(.16, 1, .3, 1)` 可读，雾港 `#ml-panel::after`=`ml-panel-ambient`、`#ui-bar`=`mln-bar-drift`，关断后全 `none`。
- 主题环境层探针（390/1280）：`#ml-root .ml-ambient` 8 颗节点、mobile 5 颗可见、`pointer-events:none`、`z-index:0`；雾港 `::after` 呼吸层 `ml-fog-breathe` 生效；中心点位命中 `story`，环境层不拦截正文。面板打开后雾港 ambient `0.9 → 0.495`（`.55` 降亮规则），星空 `::after` 动画名为 `ml-star-meteor`。

## 6. 错误台账

### ERR-20261114-001 `ui.canvas.native-geometry-overreach`

- 状态：**fixed**（v1.2.0）
- 现象：为了“侧栏左右贴边”，1.1.25 起把侧栏压到 216px、`#img left:0`；1.1.28 又用 `canvas width:100%;height:auto;left:0` 把 256 画布缩进窄栏。人物被侧栏背景盖住，实机与 1.1.22 不一致。
- 根因：把“侧栏贴边”当成画布问题，连续加断点补丁（216 / 420–480 / 481–632），没有回到 v1.1.22 取证。
- 取证：`git show v1.1.22:src/maplelantern-native.css` —— v1.1.22 没有 `body.has-images #img`、没有 `#img > canvas`、没有 `#ui-bar` 宽度覆盖。
- 修复：删除三套画布规则与全部 `#img`/canvas 覆盖（CSS 共 111 行），`#stats` 改 100%；新增“不得覆盖 `#img`/canvas/`#ui-bar` 宽度”回归测试。
- 防复发：任何“侧栏/立绘几何”改动先跑该回归测试；不得用 `canvas` 缩放解决栏宽。

### ERR-20261114-002 `ui.zoom.preview-vs-device-mismatch`

- 状态：**resolved**
- 现象：用户手机截图与 540 预览不一致；人物更大、背景边界不同，误判为 CSS 断点 bug。
- 根因：预览是 85% 缩放，手机是 100%。`565/480 = 100/85`，不是布局差异。
- 修复：补 540@100 对照图，确认手机与 100% 预览比例一致；不再用 85% 预览单独验收手机。
- 防复发：见本文第 2 节；任何手机几何结论必须双缩放对照。

### ERR-20261114-003 `compat.o0o.preload-memory-risk`

- 状态：**audit-only**（未改第三方包）
- 现象：O0O 与灯台共存无异常，但 21.17MB / 5100 图 / 全量 `preloadAll` 在 Android 上有内存与加载风险。
- 结论：不是适配缺陷；不改 O0O 源码。若实机卡顿/闪退，再做“按需加载”补丁，并单独验证。
- 防复发：把“体积、条目数、是否全量预加载”纳入第三方包评估；不把 `COEXIST: PASS` 当成移动端性能通过。

### ERR-20261114-004 `theme.paper.semantic-text-contrast`

- 状态：**fixed**（1.3.0，未发布）
- 现象：纸灯亮色主题首次截图中，原版 `.gold` / `.teal` / `.red` 语义文字在暖纸底上过亮，链接与警告几乎不可读。
- 根因：只替换了主题变量与面板/原生容器色，没有覆盖 DoL 正文里按 class 写死的语义色（`.gold` `#FFD700`、`.teal` `#08C1C1`、`.red` `#EC3535`）。
- 修复：在 `html[data-ml-native="on"][data-ml-theme="paper"] #passages .passage` 下逐类换深墨，9 类全部 ≥4.5:1（表见第 4 节）。
- 防复发：新增亮色主题时必须检查 `#passages .passage` 的 `.gold/.teal/.red/.green/.blue/.lblue/.pink/.purple/.orange` 九类，不能只看主题主色对比度。

### ERR-20261114-005 `theme.paper.native-link-context`

- 状态：**fixed**（1.3.0，未发布）
- 现象：纸灯原生正文中“broad changes / randomly / Gameplay Settings / Options”在首版截图里仍是青/亮金。
- 根因：这些是 SugarCube 生成的 `<span class="teal|gold">` 语义文字，不是 `a.link-internal`；只改 `a.link-internal` 选择器不会命中。
- 修复：同 ERR-004，按语义 class 覆盖；截图复验为深青 `#0E5F5F` / 深金 `#6F5210`。
- 防复发：DoL 正文强调色有两套载体（`a.link-internal` 与 `span.gold/teal/red`），亮色主题两套都要查。

### ERR-20261114-006 `theme.native-contrast-scope-partial`

- 状态：**fixed**（1.3.0，未发布）
- 现象：修完正文九类语义色后，纸灯侧栏仍有 15 处低于 4.5:1；雾港/旧校舍侧栏也有历史按钮、红色语义和版本号 6 处偏低；后续弹层复扫又发现纸灯 OPTIONS `.gold` 1.28、`.linkBlue` 3.21，SAVES `a.link-external` 2.86。
- 根因：对比度扫描只覆盖 `#passages .passage`，漏掉 `#startCaption`、`#menu`、`#ui-bar .macro-button`、`#gameVersionDisplay(2)`、`#history-*`、按钮内的 `.red` 以及 `#customOverlay` / `#ui-dialog` 弹层。
- 修复：按上表补纸灯侧栏/开始页/菜单/宏按钮/版本号与弹层 `.gold`/`.linkBlue`/外部链接，补雾港/旧校舍历史按钮、红色语义与版本号；三套原生页与三套 OPTIONS/SAVES 弹层重扫均 `lowCount = 0`。
- 防复发：对比度验收必须按"可见文字节点 + 最近不透明背景"扫全 `#ui-bar`、`#passages .passage`、`#customOverlay`、`#ui-dialog`，不能只扫正文；新增主题至少跑一次 540×1170 全页扫描 + 一次弹层扫描。

### ERR-20261114-007 `effects.native-sidebar-texture-shadowed`

- 状态：**fixed**（1.3.0，未发布）
- 现象：给三套原生侧栏加 `background-image: var(--mln-bar-ambient)` 后，侧栏只剩环境光，原有 `--mln-bar-texture` 三层纹理全部消失。
- 根因：`#ui-bar` 的纹理层与动效层共用 `background-image`。后写的主题规则用单值环境光覆盖了前面的纹理规则，浏览器只保留最后一个 `!important` 的完整声明；`background-size` 也只给了 2 个值。
- 修复：改为 `background-image: var(--mln-bar-ambient), var(--mln-bar-texture)`，并给 `background-size` 5 个值（2 层 230% 光带 + 3 层 100% 纹理）；契约测试锁住“ambient + texture”与 5 个 size。
- 防复发：任何“给已有背景加动效”的改动，先确认原 `background-image` 是否多值；不能把 `background-image` 当单层属性整体替换。

### ERR-20261114-008 `qa.effect-probe.state-contamination`

- 状态：**fixed**（探针脚本）
- 现象：纸灯设置页截图里「旧校舍」按钮带红边，雾港/旧校舍设置页顶部还露出展开的原生侧栏；看起来像主题选择器或层级 bug。
- 根因：探针按主题串行截图，上一轮为拍原生侧栏光带点了 `#ui-bar-toggle` 展开，下一轮没有恢复 `stowed`；同时鼠标停在上一个主题按钮上，`:hover` 残留，两个状态被带进下一张图。
- 修复：每轮设置页截图前若 `#ui-bar` 非 `stowed` 则点回收起；截图前 `page.mouse.move(1,1)` 清 hover；原生截图再单独展开侧栏。
- 防复发：视觉脚本必须把“页面状态”与“产品状态”分开记录；截图前显式复位 hover、抽屉、滚动与展开态，不能只靠上一步自然结束。
