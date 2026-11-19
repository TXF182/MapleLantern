# 灯台 MapleLantern — 维护知识与错误台账

> 最后核对：2026-11-19 / 1.4.14 修复电脑端作弊菜单堆叠、MEE 随身衣物槽塌列与 T.currentOverlay 缺失；BasicNeeds 卡面独立、左轨可滚动；206/206 PASS，45/0 仿真，check_ui 13 PASS / 1 WARN；game-smoke 本轮未跑
> 本文件只记「为什么这样定」和「已经踩过的坑」。可执行判据仍在 `README.md`、`tests/`、`tools/`。
> 历史设计稿在 `docs/archive/`，只作追溯，不代表当前行为。

## 1. 当前几何基线（v1.2.0 起，1.3.0/1.3.1 沿用）

v1.2.0 起的立绘与侧栏**完全走游戏原生**，1.3.0/1.3.1 沿用，不重写画布。任何缩放、432 或 540 视口都不应再改变这套几何。

| 区域 | 当前规则 | 说明 |
|---|---|---|
| `#ui-bar` 宽度 | **280px（原生）** | 不写 `#ui-bar#ui-bar { width: ... }` |
| `#img` 定位 | **`left:64px`（原生）** | 不写 `body.has-images #img` |
| `#img > canvas` | **256×256（原生）** | 不写 `width:100%; height:auto` |
| `#stats` | `width:100% !important` | 状态卡占满可用宽度 |
| 顶栏 | 两行三列：开关跨两行 / 金额+时间在上 / 日期整行在下 | 280 宽日期格 233px，216 宽 169px |
| 金额 | 单行 `nowrap`，窄屏 10px | 不换行、不拆成两行 |
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

## 4. 主题扩展：雾港 / 旧校舍 / 纸灯（1.3.0 已发布）

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

### 动效层（1.3.0/1.3.1 已发布）

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
- 320/390 追加 `@media (max-width:430px)`：6 个页签 `flex:1 1 0; min-width:0`，全部可见；此前 `flex:1 0 auto` + `min-width:54px` 会让最后一个「设置」页被横向裁掉。

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
node --test tests\*.test.js                                  # 205 项：契约 / 原生 / 自定义 / DOM
python tests\custom_host.py                                  # 真实 DOM 宿主 58 断言（含像素取色）
python tests\custom_viewports.py                             # 六档视口 49 断言（实测「应用背景」可点）
python tests\custom_formats.py                               # 图片格式矩阵（自建 tests\fmt 素材）
python tests\_diag_csp.py                                    # CSP A/B：blob 被拦 / data 出图
python tests\_diag_realinject.py                             # 真实 64MB 页面注入 + 像素判据
pwsh -File pack.ps1                                          # 确定性 zip（14 条目）
$env:ML_ZIP="dist\MapleLantern-1.4.8.mod.zip"; node tools\game-smoke.js
node tools\compat-smoke.js
$env:COMPAT_HOSTS="1"; node tools\compat-smoke.js
node tools\bench-native.js
python C:\Users\27352\Doubao\skills\dol-ui-design\scripts\check_ui_mod.py dist\MapleLantern-1.4.8.mod.zip
```

`boot.json` 必须是 **UTF-8 无 BOM**；**版本双源**为 `src\dossier-core.js` 的 `VERSION` 与 `src\boot.json` 的 `version`（1.4.x 起；1.3.x 及以前是 `src\core.js`），两处必须一致，且已由 `tests\contract.test.js` 强制断言——漏改一处会表现为「包是新的、行为是旧的」。

`tests\_edge_profile_*` / `tests\shots` / `tests\fmt` / `tests\fixtures` 全部是**可再生产物**（脚本自建），不入库、可随时删除；删掉后重跑对应脚本会重新生成。

### 1.3.8 孩子详情恢复原版正文色（2026-11-15）

- **根因**：`src\maplelantern-native.css:1114` 的 `#passages .passage { color: var(--mln-text) }` 把主题正文色（赛博主题 `--mln-text #E6F7FF`）继承到孩子详情容器 `.childDetails`；原版该容器没有独立颜色，沿用正文 `--100`。FertilityExpansion 的 `modules\css\eden.css` 与 `boot.json` 均未改 `.childDetails` 颜色，排除该模组。
- **修复**：新增 `html[data-ml-native="on"] #passages .passage .childDetails { color: var(--100, #eee); }`（特异性 1,3,0 > 1,1,0）。`Type:` 的 `.gold` 标签、`.childName input` 与孩子图标各有自己的颜色，不受影响。
- **实测**（Edge 1280×720，赛博主题，原生层开启）：注入 `.childDetails` 后计算色 `rgb(221, 221, 221)`（即当前 `--100 #ddd`），修复前为 `rgb(230, 247, 255)`；`.gold` 仍 `rgb(255, 215, 0)`。版本显示 `v1.3.8`。
- **测试**：`node --test tests\*.test.js` **131 / 131 PASS**；新增断言恢复 `--100` 且不再出现 `--mln-text`。
- **最终产物**：`dist\MapleLantern-1.3.8.mod.zip`，**115,287 B / 8 条目 / SHA256 `6b240707ed49ed385578c2ac1762814195b0ba47cdd6ea1364e860a542d62d05`**；`check_ui_mod.py` 13 PASS / 1 WARN / 0 FAIL；`game-smoke` 18 项 PASS / `SMOKE: PASS`。

### 1.3.7 手机面板滚动摘模糊（2026-11-15）

- **改动**：`src\style.css` 末尾新增 `@media (max-width:899px)`，`#ml-root .ml-panel[data-scrolling="1"]` 双写 `-webkit-backdrop-filter:none!important` / `backdrop-filter:none!important`；`src\render.js` 新增 `state.scrollTimer`、`markPanelScrolling()`，在 `body` 与 `window` 各挂 `{ passive:true }` 滚动监听，滚动置 `data-scrolling="1"`，停止 160ms 后 `removeAttribute`；`closePanel()` 同步清计时器与属性，`destroy()` 解绑 `body` / `window` 滚动监听。桌面断点不启用，静止时材质不变。
- **测试**：`node --test tests\*.test.js` **130 / 130 PASS**（约 15.7s）；版本双源 `1.3.7`；新增 `1.3.7：手机面板滚动期间摘掉 backdrop-filter，停止 160ms 后恢复` 契约（CSS 媒体块 + `markPanelScrolling` + passive 双监听 + 160ms 恢复）。
- **单变量 A/B（`ml_131_ab.js`，Edge 390×844 DPR2、CPU 4x、`--disable-gpu`、`--disable-frame-rate-limit`，页面追加 3000px filler）**：
  - `body::before` 固定底层替代 `html background-attachment:fixed`：基线页面 `1.91 / 1.56 / 1.09ms`、TaskDuration `188.1 / 154.6 / 115.2ms`；底层页面 `2.55 / 1.59 / 1.23ms`、TaskDuration **`250.3 / 187.8 / 122.8ms`**，全面更差，**否决**，原方案保持。
  - 面板滚动期摘 blur：基线 `3.69 / 3.38 / 4.97ms` → 关模糊 **`3.15 / 2.92 / 2.40ms`**，约省 20–35%，**采用**。
- **真实 1.3.7 包复测**（同一套 Edge 参数，5 轮去冷启首轮）：页面 `2.04 / 1.32 / 1.62 / 1.55ms`（首轮冷启 7.25ms），与 1.3.6 的 1.19–1.93ms 同区间；面板 `3.50 / 3.23 / 3.77 / 3.42 / 3.07ms`，区间 **3.07–3.77ms，均值约 3.40ms**（1.3.6 同环境 3.63–5.18ms）。
- **实时状态取证**（`ml_137_probe.js`）：滚动中 `data-scrolling="1"`、`backdropFilter:none`；停止 260ms 后属性 `null`、恢复 `blur(12px) saturate(1.1)`。静止/滚动截图 `%TEMP%\ml_137\panel-rest.png` / `panel-scrolling.png` 对照，静止仍为完整玻璃，滚动期背景变清晰。
- **最终产物**：`dist\MapleLantern-1.3.7.mod.zip`，**115,043 B / 8 条目 / SHA256 `07b604d31c73faa4985a75432b8f946c35aece1bebff7f00c425728d47f050b7`**；`check_ui_mod.py` 13 PASS / 1 WARN / 0 FAIL（WARN 与历史一致：依赖仅 ModLoader/GameVersion，未声明 StoneFreeHost；`maplelantern-native.js` 已有 `apiVersion !== 1` 退出守卫）。
- **冒烟**：`ML_ZIP=dist\MapleLantern-1.3.7.mod.zip node tools\game-smoke.js` 18 项 PASS；`node tools\compat-smoke.js` 21 项 `COMPAT: PASS`。失败请求均为 `game\` 缺失的 `modList.json` / `style.css` / `usettings.js` / 旧图，非本次改动引入。

### 1.3.6 手机端二次收口（2026-11-15）

- **改动**：`src\effects.css` 手机媒体查询在 1.3.5 基础上再隐藏 `.ml-ambient__veil` 与 `.ml-ambient::before` / `::after` 两条主题光带；粒子 `nth-child(n + 4)` → `nth-child(n + 3)`，只留 2 颗。保留静态天空层（`--ml-sky-dust` 星场 + 天光）和 2 颗静态粒子。
- **测试**：`node --test tests\*.test.js` **129 / 129 PASS**；新增断言覆盖 `n + 3`、veil 隐藏、两条 ambient 伪元素隐藏。
- **5 轮基准**（Edge 390×844 DPR2、`--disable-gpu`、CPU 4x、`--disable-frame-rate-limit`；`ml_final_bench_136.js`，去冷启首轮）：页面 **5.54–8.78ms，均值 6.66ms**；强制可滚动面板 **12.26–15.16ms，均值 13.16ms**。1.3.5 对应约 13.05 / 14.54ms；关 ambient 约 5.4–7.5ms，页面已基本贴住下限。
- **视觉**：`ml_sky_game.js` 星/auto 390×844 截图仍保留全屏星场；`ml_mobile_probe_136.js` 实测 390 宽 `veil display:none`、wisp 仅前 2 个 `display:block`、ambient 动画 `none`。
- **最终产物**：`dist\MapleLantern-1.3.6.mod.zip`，**114,385 B / 8 条目 / SHA256 `c4289d417f91d2ce8855e9e7107bf4d7adf03d60416bbde819fb5e5d5aa2523b`**；`check_ui_mod.py` 13 PASS / 1 WARN / 0 FAIL（WARN 与历史一致：依赖仅 ModLoader/GameVersion，未声明 StoneFreeHost；`maplelantern-native.js` 已有 `apiVersion !== 1` 退出守卫）。
- **冒烟**：`ML_ZIP=dist\MapleLantern-1.3.6.mod.zip node tools\game-smoke.js` 18 项 PASS；`node tools\compat-smoke.js` 21 项 `COMPAT: PASS`。失败请求均为 `game\` 缺失的 `modList.json` / `style.css` / `usettings.js` / 旧图，非本次改动引入。

### 1.3.5 性能收口（2026-11-15，最终包以 `dist\SHA256.txt` 为准）

- **星空页底 87→9 层**：`src\maplelantern-native.css` 星空 `--mln-page-texture` 删除约 78 个逐点星层，只留 6 个基础渐变；`html` 的 `background-image` / `background-attachment` 实测均为 9，`--mln-page-texture` 从 8,313 字符 / 84 gradient 降到 554 字符 / 6 gradient。
- **星尘改平铺**：新增 `--ml-sky-dust`，星空 `220px/280px`、auto night `240px/300px`；`.ml-ambient__sky` 以 `background: var(--ml-sky-dust, none)` 消费，星点全屏可见但不增加 `html` fixed 层。
- **手机 ambient 降载**：`@media (max-width:600px)` 粒子 `nth-child(n + 4)`（5→3）；`.ml-ambient` `inset:0`；环境层及其所有子元素/伪元素 `animation:none!important`、`will-change:auto!important`；`#ml-root[data-open="1"] .ml-ambient { display:none!important; }`，面板打开时不再绘制环境层。桌面/平板不受影响。
- **面板模糊封顶 12px**：`src\render.js` 在 tier 计算后加 `if (innerWidth > 0 && innerWidth <= 899) blur = Math.min(blur, 12);`；`onResize()` 150ms 后重算 `applySettings()`。390 宽实测 `blur(12px) saturate(1.1)`；桌面 1024 宽 glass 100 仍 `32px`。
- **CE 模糊 10→6**：`#customOverlay .dol-shadow` 两条 `backdrop-filter` 改为 `blur(6px) saturate(1.08)`。
- **测试**：`node --test tests\*.test.js` **129 / 129 PASS**（约 15.2s）；新增 `--ml-sky-dust`、星空页底 ≤9 gradient、手机 `n + 4`、ambient 全量静态、面板打开隐藏、CE `blur(6px)`、render 手机封顶与 390/1024 双断点用例。
- **无头滚动基准**（Edge 390×844 DPR2、`--disable-gpu`、CPU 4x、`--disable-frame-rate-limit`；`ml_scroll_bench2.js`，3 轮）：`page-base` 21.83 / 12.56 / 13.05ms（中位 13.05；1.3.4 基线 18.5–24.3）；`page-ambient-off` 7.70 / 5.40 / 6.75ms；`panel-base` 18.22 / 13.58 / 14.54ms（中位 14.54；1.3.4 基线 21–24）；`panel-ambient-off` 12.05 / 15.34 / 15.22ms。第一轮含冷启动，看中位与后两轮；软件渲染只作同向对比。
- **视觉**：`ml_sky_game.js` 星/auto 390×844 截图（`%TEMP%\ml_sky_game\game-star-390.png` / `game-auto-390.png`）；`::before/::after` 计算值 `animation:none`，星点仍全屏；`ml_sky_matrix.js` 320/360/390 closed + 390 open 无 `pageerror`，面板显示 v1.3.5 且打开时 ambient 隐藏。
- **导入状态**：Edge profile `%TEMP%\lantern-edge-profile` 的 ModLoader 列表已移除 1.3.2/1.3.3/1.3.4，仅加载 `MapleLantern-1.3.5.mod.zip`；旧包数据键未删。
- **最终产物**：`dist\MapleLantern-1.3.5.mod.zip`，**114,201 B / 8 条目 / SHA256 `5d0fa36284d57a917ac2636307781a5825471ac06f19354b80f93ae3d421a57e`**；`check_ui_mod.py` 13 PASS / 1 WARN / 0 FAIL（WARN 与历史一致）。
- **冒烟**：`ML_ZIP=dist\MapleLantern-1.3.5.mod.zip node tools\game-smoke.js` 18 项 PASS；`node tools\compat-smoke.js` 与 `COMPAT_HOSTS=1` 两轮均 `COMPAT: PASS`（各 21 项）。失败请求均为 `game\` 缺失的 `modList.json` / `style.css` / `usettings.js` / 旧图，非本次改动引入。

### 1.3.4 天空层基线（历史）

- `node --test tests\*.test.js`：**127 / 127 PASS**。
- `check_ui_mod.py`：**13 PASS / 1 WARN / 0 FAIL**；唯一 WARN 仍是 `maplelantern-native.js` 引用 `window.DoLGameUI` 但未声明 `StoneFreeHost` 依赖，与 1.2.0 / 1.3.0 / 1.3.1 / 1.3.2 / 1.3.3 基线一致。
- `ML_ZIP=dist\MapleLantern-1.3.4.mod.zip node tools\game-smoke.js`：**SMOKE: PASS**，18 项断言全 PASS。
- 天空层探针（390×844，`prototype/index.html?hud=0&theme=<theme>`）：`skyRect 491×945`（随 ambient 的 `inset:-6vmax` 外扩盒），`z-index:0`；`::before` 为 `ml-sky-glow`（实测 24/30/32/36s 随主题），`mask` 上 48%，背景含 `linear-gradient(180deg, --ml-sky-c2, transparent 42%)` + 双径向 + `--ml-sky-stars`；`::after` 为 `ml-sky-ribbon`，`mask` 下缘 66–92%，背景含 `radial-gradient(56% 38% at 50% 104%, --ml-sky-a, transparent 74%)` + 104° 斜带。实测 `--ml-sky-opacity`：auto `.62`、star `.68`、cyberpunk `.58`、fog `.70`。
- `auto` 四时段变量实测：dawn `rgba(255,196,120,.48)` / `rgba(255,143,112,.30)` / `rgba(255,228,180,.28)`；day `rgba(126,190,255,.36)` / `rgba(255,255,255,.24)` / `rgba(126,214,200,.22)`；dusk `rgba(255,150,90,.46)` / `rgba(255,110,150,.30)` / `rgba(255,205,130,.26)`；night `rgba(120,150,255,.34)` / `rgba(90,210,220,.24)` / `rgba(255,255,255,.20)`，night 另有 6 颗 `--ml-sky-stars`。
- `auto` 旧地平光/天光带已改吃同一组变量（390×844 计算样式回读）：`::before` dawn `rgba(255,196,120,.48)`→night `rgba(120,150,255,.34)`；`::after` dawn 奶白 `rgba(255,228,180,.28)`→day 青 `rgba(126,214,200,.22)`→night 蓝白 `rgba(255,255,255,.20)`，不再固定暖橙。
- 1.3.3 顶栏两行网格探针（1.3.3 包，540×1170 展开侧栏，强制 `#stats` 宽 280/216/180，金额 `£9,474.99`、日期 `星期日 9月4日`）：280 下 row `264×67`、toggle `28×67`、money `172×32`、time `58×32`、day `233×32`；216 下 money `108`、day `169`；180 下 money `72`、day `133`。三档 `scrollWidth ≤ clientWidth`，无裁切；`#stats` 恒 72 高，不把状态卡下推。
- 合成 CE 几何探针（1.3.2/1.3.3 包，540×1170 / 360×780）：540 `#customOverlay` `x=0,y=10,w=524,h=1150`、`left/right=0`，content `x=8,w=508`，CE `x=17,w=490`；360 `x=0,y=10,w=344,h=760`，content `x=8,w=328`，CE `x=17,w=310`；容器 `visibility=visible` / `pointer=auto`，`#story` hidden，`errors=[]`。
- Edge 计算样式探针：`effects.css` token `.2s` / `.46s` / `cubic-bezier(.16, 1, .3, 1)` 可读，雾港 `#ml-panel::after`=`ml-panel-ambient`、`#ui-bar`=`mln-bar-drift`，关断后全 `none`。
- 主题环境层探针（390/1280）：`#ml-root .ml-ambient` 为 8 颗粒子 + 1 层 veil + 1 层 sky（共 10 个节点）、mobile 5 颗粒子可见、`pointer-events:none`、`z-index:0`；雾港 ambient `1.0`、veil `.44`，打开面板后 ambient 降到 `.55`；`auto` 根节点带 `data-phase`，环境层 `::after` 天光带动画名为 `ml-sky-band`，天空层 `::after` 为 `ml-sky-ribbon`。

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

### ERR-20261115-001 `layout.mobile-story-two-char-column`

- 状态：**fixed**（1.3.1）
- 现象：手机展开侧栏后，右侧正文被压成两字一列，立绘/状态卡同时错位。
- 根因：`src/maplelantern-native.css` 的 `@media (max-width:632px)` 里写着 `html[data-ml-native="on"] body.has-images #ui-bar:not(.stowed) ~ #story { margin-left:17.5em !important; }`。该规则由 `c20205f`（v1.1.25）引入；360 视口只剩约 64px，扣掉 `.passage` 左右 padding 后约两字宽。
- 反证：1.2.0 官方包 `maplelantern-native.css` 528–532 行同样有这条规则，所以 1.2 不是“没写”，而是 `body.has-images` + 侧栏展开 + `<=632px` 三个条件未同时成立，未显形。
- 修复：删除 17.5em 覆盖；`<=560px` 改为抽屉语义，侧栏**实际可见**时隐藏 `#story` 并断 `pointer-events`，收起立即恢复。是否可见由 `syncSidebar()` 读 `display/visibility/opacity/getBoundingClientRect()` 后挂 `data-ml-sidebar-open`，不再按 `.stowed` class 猜——侧栏自身 `display:none` 时不会误隐藏正文。
- 防复发：窄屏侧栏只能二选一，要么并排且给正文留足宽度，要么抽屉隐藏正文；不得用 `margin-left` 把正文压到两字宽。

### ERR-20261115-002 `overlay.native-cheat-layer-stacks-lantern`

- 状态：**fixed**（1.3.1）
- 现象：点开模组作弊/原生菜单后，`#customOverlay` 与灯台浮卡同屏叠加，中央菜单被左侧浮卡裁切。
- 根因：原生层由 CE 异步挂载，正文观察器看不到 `#customOverlay` 子树；浮卡只按自身开关判断是否退场。
- 修复：`nativeLayerVisible(overlay)` 同时看 `hidden`、计算样式与几何；`watchOverlay()` 维护 `state.overlayVisible`，隐藏→可见跳变时调用 `MapleLantern.close()`；原生入口点击后 80ms 再按真实几何补关，覆盖观察器来不及的首帧；`ensureOverlayFinder()` 在 `#customOverlay` 节点换代时重挂。
- 防复发：原生弹层与自有浮层不得只靠 class 判断可见性；必须读真实几何，并覆盖“节点重建”与“点击后异步挂载”两条路径。

### ERR-20261115-003 `overlay.ce-layer-shifted-offscreen`

- 状态：**fixed**（1.3.2）
- 现象：手机点开「模组作弊」后，CE 层内容只占左半屏，右半屏只剩星空背景；540×1170 实机截图 `DvNUdYPGju` 复现。
- 根因：原版游戏 CSS `@media only screen and (max-width:870px) { .customOverlay { left:-17.6em } }` 用 280px 侧栏宽度做左移。灯台把 `#customOverlayContainer` 改成 `position:fixed; inset:0; width:100vw` 后容器已全视口，这条左移把 `.customOverlay` 整体推到屏幕左侧外 281.6px。540 探针修复前 `#customOverlay` `left:-281.6px`、`x=-281.59`、`width=524`、`right=242.41`；`#customOverlayContent` `x=-273.59`；合成 CE `x=-264.59`。
- 修复：`src/maplelantern-native.css` 的 `@media (max-width:899px)` 给 `html[data-ml-native="on"] #customOverlay` 补 `left:0 !important; right:0 !important`，宽度继续由既有 `max-width: calc(100vw - 16px)` 约束。540 复测 `left/right=0`、`x=0`、`width=524`，内容 `x=8 / width=508`，CE `x=17 / width=490`；360 复测 `x=0 / width=344`，内容 `x=8 / width=328`。另在 `<=560px` 侧栏展开时给 `#customOverlayContainer` 补 `visibility:visible !important; pointer-events:auto !important`：该容器由 PassageFooter 渲染，可能落在 `#passages` 子树内，`#story` 的抽屉隐藏会连带吞掉作弊层。
- 防复发：任何把第三方弹层容器改成全视口 fixed 的覆盖，必须同步封回原版针对侧栏宽度的 `left/right/margin` 补偿；验收不能只看盒子 `width`，要同时读 `x/right`，否则“宽度对了但整体在屏外”会被漏掉。合成 CE 探针只能证明几何，真实 CE 入口仍需实机/存档验证。
- 后续（2026-11-19 复核）：本条历史的「容器全视口」前提已不成立——fixed 包含块实际是游戏缩放祖先，容器改为 `width:100%` 只吃包含块；详见 §8「fixed 弹层容器约束」与 ERR-20261119-004。

### ERR-20261115-004 `topbar.four-column-clipping`

- 状态：**fixed**（1.3.3）
- 现象：手机顶栏四格一行时，日期只显示「星期」或「星期日」，`9月4日` 被裁；更窄容器下金额被裁成 `£9,4`，开关图标单独换行居中，四格错位。实机截图 `jub5F0bpUq` 复现。
- 根因：顶栏被写成四列定宽 `28px | 1fr | 46px | 44px`。日期格只有 44px，中文完整日期 `星期日 9月4日` 文本约 61.5px，`scrollWidth 54 > clientWidth 42`；金额格在容器变窄时被 `minmax(0,1fr)` 压到 37px，`overflow:hidden` 直接裁字。原版 `#stats .centered-elements` 是 `display:flex; justify-content:center; gap:20px`，本来允许收缩换行，不是固定四列。
- 修复：改成两行三列 `28px minmax(0,1fr) 64px`，`grid-template-areas: "toggle money time" / "toggle day day"`；开关跨两行，金额+时间在上，日期独占整行。280 宽日期格 233px，216 宽 169px，180 宽仍有 133px。`markStats()` 增加 `ml-src` / `ml-replaced-src` 与中文星期文本兜底，翻译改图后日期格不再丢标记。
- 防复发：`#stats` 内容区固定 280 宽，不要再按视口加第 4 列；验收必须同时量 280/216/180 三档的 `scrollWidth/clientWidth`，只看截图会漏掉尾部裁切。

## 7. 玩家自定义外观（1.4.0 → 1.4.11，1.4.8 增加第三方美化页入口策略，1.4.9 新增原生模块开关）

### 7.1 分层与数据流

```
玩家选文件  <input type=file>
   → Assets.process(file)        Image/ImageBitmap 解码，长边压到 1200（窄屏）/1600（宽屏），上限 15MB
   → Assets.save(key, blob)      IndexedDB: MapleLanternDossier.assets.v1 / store=images / key=bg|btn
   → Assets.dataUrlFor(key, blob) FileReader.readAsDataURL → data: URL（按 blob 缓存同一串）
   → Theme.attach(kind, url)     探针 Image onload 后才写变量
   → Theme.apply()               Core.planVars(settings) → 一组 --mlc-* 变量 + data-mlc / data-mlc-bg / data-mlc-btn
```

- 设置持久化：`localStorage` 键 `MapleLanternDossier.settings.v1`；图库在 IndexedDB，两者分开，**恢复出厂不动图库**。
- 承载：背景 `#mlc-bg`（`position:fixed; inset:0; z-index:-1`）画在 `body` 底色之上、内容之下；底纹挂 `#passages .passage a.link-internal:not(.macro-link)`。
- 舞台：`paintStage()` 用 `cap=min(max(240, vh*0.46), 420)` 定高，比例取当前视口，**与真实页面同构**（预览通过 ≠ 真机通过，见 LRN-20261117-009）。

### 7.2 硬约束：DoL 的 CSP 只认 `'self'` 与 `data:`

`game\Degrees of Lewdity.html` 的 `<head>` 内：

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self' 'unsafe-eval' 'unsafe-inline' *; img-src 'self' data:; font-src 'self' data:">
```

- `img-src` 不含 `blob:` ⇒ `URL.createObjectURL` 出来的 `blob:file:///...` 一律被拦，`securitypolicyviolation` 报 `img-src blob`。
- 后果很反直觉：`--mlc-bg-img` 有值、`#mlc-bg` 的 computed `background-image` 也是合法 url、rect 满屏、opacity 1，**但一个像素都不画**。
- 因此**图库的一切载体必须是 `data:`**；`Assets.urlFor()` 已降级为「同步取已编码结果」，不再产 blob。
- 自建宿主 `tests/custom-host.html` 没有这条 CSP，所以在那里 blob 一直是能用的——**宿主不复刻 CSP，就永远测不出这类拦截**（LRN-20261117-011）。

### 7.3 判据（改这块必须过的四道）

| 层 | 命令 | 通过标准 |
|---|---|---|
| 纯逻辑/契约 | `node --test tests\*.test.js` | 205/205，含版本双源一致性 |
| 真实 DOM 宿主 | `python tests\custom_host.py` | 58/0，含「载体必须是 data: URL」与像素取色（B−R ≥ 25） |
| 六档视口 | `python tests\custom_viewports.py` | 49/0，含「应用背景」44px 可点、面板外透出背景 |
| 真机 | `python tests\_diag_realinject.py` / `_diag_csp.py` | 页面与舞台取色命中判据图（左红右绿） |

### 7.4 已踩过的坑（按修复顺序）

1. `decode()` 返回 ImageBitmap 本体却被当 `{source,...}` 解构 → 导入必失败（1.4.1，ERR-20261117-007）。
2. 面板底板 `--ml-surface-alpha` 与滑杆 `--mlc-surface-alpha` 没接线 → 图在上面被自家面板挡住（1.4.2，ERR-20261117-008）。
3. 选项原版是内联文字链接，底纹只铺文字宽度 → 加 `data-mlc-btn=on` 才立成按钮盒（1.4.3）。
4. 不透明度 45% 把深色立绘洗成背景色 → 默认 100 + `alignForBackground` 双修正 + 旧档迁移（1.4.4，ERR-20261117-009）。
5. `blob:` 被 CSP 拦 → `data:` 载体（1.4.5，ERR-20261117-010）。
6. 浮窗卡片底图：原生 `#customOverlayContent` / `#ui-dialog-body` 的 `background-attachment: fixed` 必须收回 `scroll`；手机端用 `!important` + 双 ID 对抗，且排除 ModLoader GUI 与 CE 面板（1.4.6）。
7. 着装页服饰名：优先 `cn_name_cap` / `cn_name`，中文显示、英文保留原名，空白回落、不二次翻译；页签只保留一个 `.ml-tab-glint`，旧分段 `::after` 删除（1.4.7）。

## 8. 原生 UI 模块开关（1.4.9，1.4.10/1.4.11/1.4.12 扩属性卡与 CE）

「开关」页位于「系统」与「设置」之间，9 个键默认 `true`，关闭只撤对应模块：

| 键 | 根属性 | 管什么 |
|---|---|---|
| `optStats` | `data-ml-opt-stats` | 顶部金钱/时间/日期/开关四格 |
| `optMoney` | `data-ml-opt-money` | 金额整数补 `.00` |
| `optRailSkin` | `data-ml-opt-rail-skin` | 手机左轨胶囊/色条/描边 |
| `optRailPct` | `data-ml-opt-rail-pct` | 左轨七项百分比小条 |
| `optMeterSkin` | `data-ml-opt-meter-skin` | 状态七行一张大卡 |
| `optMeterValue` | `data-ml-opt-meter-value` | 状态卡「当前/上限 · 百分比」 |
| `optOptions` | `data-ml-opt-options` | 正文选项整行卡片 |
| `optSidebar` | `data-ml-opt-sidebar` | 侧栏按钮两列卡片 |
| `optOverlay` | `data-ml-opt-overlay` | 原生弹层外壳圆角/留白/背景 + 属性页卡片皮肤 |

**1.4.12 CE 设置页约束**：CheatExtended 1.20.4 的设置页（`<<CE_options>>`）由 JS 动态建 `.settingsGrid`；§8 另见 2026-11-19 复核补丁 `fixed 弹层容器约束`，子项是原生 `.settingsToggleItem`；其桌面几何必须回到 DoL 原版 `repeat(auto-fit,minmax(48.5%,1fr))`，不能用 520px 最小列宽（否则 900–1000px 面板宽只放一列，表现为手机端）。同一行必须 `align-items:stretch`，否则不同高度的卡片各自起排、看起来错位；卡片不能 `overflow:hidden`，否则 tooltip 与焦点框被裁。规则只允许挂 `#customOverlay #cheat_extended_options ~ *` 与 `#customOverlay #CE_settingsDiv`，不得再挂 `#customOverlayContent`——原生 Options 也在这个容器里，挂上去会把它一起压成单列。几何探针 `tests\ce_settings_probe.py` 24/0（1280/900/390，含原生 Options 双列对照）。

**1.4.12 复核补丁 fixed 弹层容器约束**：`#customOverlayContainer` 挂在被游戏缩放/平移的 `#story` 祖先里，fixed 包含块不是视口；横向不得用 `100vw`（桌面实测右缘多 320px），改 `width:100%; max-width:100%`，纵向用 `height:var(--ml-vh,100vh)`。`#customOverlay` 不得再用 `top+bottom`，改 `bottom:auto` + `height/max-height:calc(var(--ml-vh,100vh) - 96px)`、`min-height:0`。真实页探针：桌面 `docW=1280`、面板 `920×804`；手机 `docW=390`、面板 `326×748`；CE 设置页真实页模拟桌面 `908×880`/2 列、手机 `326×824`/1 列，均 `out=0/overlaps=0`。

**1.4.11 属性卡约束**：皮肤只改外观，不覆盖原生排版。通用 `.characteristic-box-list` 保持 DoL 原生 `flex-wrap`，属性、技能、成绩、职业页按自身 `min-width` 换行；`#sex-diagram` 单独保留左右 50% 纵排双列，`<=450px` 回 100%。社交页同理：`.relation-box-list` 保留原生 grid 列数，`#global-recognition` 保留原生 `flex-wrap`，不得统一压成单列。属性页真机探针 `tests\sexdiagram_probe.py` 扩到 5 个平铺列表，桌面 + 手机 73/0，含旧 grid 压立绘复现。

**1.4.10 属性页约束**：DoL 原生 `#sex-diagram` 是左右两列 50% flex，中央 `#player-body` 绝对定位；通用 `.characteristic-box-list` 的 `grid` 不能覆盖它，否则卡片横铺压住人物。修复规则在 `maplelantern-native.css` 的 `#sex-diagram` 专用段：列表纵排、宽 50%，`<=450px` 回 100%；所有 `.characteristic-*` 皮肤规则都挂 `data-ml-opt-overlay="1"`，关闭开关即回原版卡片与布局。

**gate 边界**：CSS 只 gate 纯视觉皮肤规则。结构、可见性与几何约束必须常开——`#customOverlayContainer` 的 z-index/visibility、`#ui-dialog-body#ui-dialog-body` 的视口约束、`@media (max-width:899px)` 下 `#customOverlay` 的左右归零、`#story` 侧栏抽屉；关闭外壳开关不能把弹层推出屏幕，也不能让 `#story` 的 hidden 把它吞掉。JS 侧由 `maplelantern-native.js` 的 `setModuleAttrs()` 写根属性，`markStats/markStatmeters/markRailMeters/markPassages` 按各自键跳过标记或还原文本；`clearMarks()` 同时撤掉全部根属性并还原金额。

## 9. 第三方模组适配（1.4.13）
只针对具体第三方 DOM 加规则，第三方不存在时选择器不命中；不改第三方包、不改原版 DOM 结构。所有规则仍以 `html[data-ml-native="on"]` 为前导，关闭原生层即回第三方原样。

| 模组 | 页面/结构 | 灯台侧处置 | 判据 |
|---|---|---|---|
| BasicNeeds 0.5.0 | `#bn-bp-detailbox` 被 append 到 `#customOverlay`，第三方写 `left:100%` | 仅在 `#customOverlay:has(.bn-bp)` 时把详情盒放回面板内右侧栏（`right:12px`、`top:104px`、`max-height:calc(100% - 116px)`、`overflow:auto`），内容区 `padding-right:312px`；`<=760px` 改底部抽屉（`max-height:32vh` + 内容 `padding-bottom:calc(32vh + 24px)`） | 1280×900：盒 `807→1087`、`dClip=0`、吃掉按钮 `useHit=true`；390×844：盒 `17→373`、`dClip=0`、`useHit=true`；网格与盒交集 0 |
| MyExhibitionism 1.0.4 | `#statmeters` 内四行 `courage/calm/desire/satisfaction`，上限 1000 | `STAT_MAX` 补四键为 1000，读数统一为 `当前/1000`；不新增 MEE 专用行宽规则 | S5：四条 `data-ml-total=1000`、读数 `307.2/1000` 等；11 行无重叠/无裁切 |
| MyExhibitionism 1.0.4 | 随身衣物页 `#titleCarriedclothes`，第三方写 `left:10px`，窄屏 `left:-17.6em !important` / `height:40%` | 同页高特异性拉回 `left/right:0`、`margin:auto`、`top:48px`、`height/max-height:calc(var(--ml-vh,100vh) - 96px)`；不覆盖 width | 1280×900 面板 `920×804@180,48`；390×844 面板 `374×748@8,48`；`mee-carry-panel-clamped` PASS |

**反向条口径**：原版 `statbarinverted` 只换配色，条宽仍是 `current/max`；`INVERTED_STAT` 只保留 `innocence`（`awareness -200` 才是无知进度），`control` / `oxygen` 不再二次反向。S7 断言自控 1000/1000→100%、氧气 45/100→45%。

**验证入口**：七文件 `206/206`；`tools\host-probe.ps1` 输出 `version=1.4.14`、`cardKeys=True bgKeys=True scripts=5`；第三方仿真 `%TEMP%\lantern_adapt\fix_probe.py` 45 PASS / 0 FAIL（1280 / 798 / 390 三档，含作弊页块级断行、步进器无横向溢出、衣物槽多列、正文宽度、BasicNeeds 卡面在状态卡皮肤开/关两态下的文字与 7px 轨道、左轨滚动与视口收束）。

## 10. 1.4.14 电脑端排版与随身衣物

- **flex 是作弊页错位与衣物槽塌列的共同根因**：灯台曾把非 CE 的 `.settingsToggleItem` / `.settingsToggleItemWide` 写成 `display:flex; flex-wrap:wrap`。DoL 原版这些条目靠块级流和 `<br>` 排版，flex 会把 `<br>` 当 flex 项，BasicNeeds 的膀胱/大便步进器与说明挤到一行；MEE 的 `auto-fill` 网格作为 flex 子项按 max-content 计算，8 个空槽纵向堆叠。1.4.14 改回 `display:block`，与 `game_base.css:14211` 原版一致。
- **步进器宽度只收敛 BasicNeeds 追加项**：`#bn-cheat`、`#bn-cheat-stats` 与 `.settingsToggleItem:has(.bn-water-all)` 内的 `numberStepperContainer` 设 100%，不动原版 Options 的 446px 固定宽度。
- **MEE 随身衣物需要补 `T.currentOverlay`**：本版游戏 `overlayReplace` 宏写 `T.currentOverlay = T.key`，而 `T.key` 全包无赋值，实际为 `undefined`；MEE `clothingCaptionButtonClick`（`js\mee_js.js:546`）只在 `=== "carriedclothes"` 时调 `putToCarried`，否则走脱衣。灯台 `overlayKey()` 按 `#customOverlayContent` 内的 `#titleCarriedclothes` / `.clothing-takeback-button-container` 结构识别该页，`markOverlay()` 在叠层未 hidden 时补写 `window.T.currentOverlay`；关闭由游戏 `closeOverlay()` 删除，切到其他页时灯台也会清掉该临时值。
- **桌面正文不再压成 72ch**：`@media (min-width:701px)` 下 `#passages .passage` 改为 `max-width:min(100%,1100px)`；手机仍 72ch。
- **BasicNeeds 状态列表独立卡面**：`#bn-panel` 的 8 行文字与 7px 轨道只挂在 `data-ml-native="on"`，不再要求 `#statmeters` 祖先或状态卡皮肤开启；`.bn-text` 解除第三方 `nowrap/ellipsis`。关闭「原版数值优化」只回退原版六行，BasicNeeds 作为第三方仍保持卡面。
- **证据边界**：合成宿主里 `getComputedStyle(.settingsGrid).display` 为 `block`，是该探针宿主 `#grid` 的 id 样式所致，**不能用来判断真实作弊页列数**；真实两列布局仍以游戏 `.settingsGrid` 的 `repeat(auto-fit,minmax(48.5%,1fr))` 为准。真实 `file://` + ModLoader 同时装三模组的点击级验收仍未做。
