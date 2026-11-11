# 灯台 1.1.2 计划书：全量原版 UI 卡片化与动效

> 评审稿 · 2026-11-11 · 尚未实施
> 不是再叠一个面板；是把原版游戏的全部界面直接换成同一套卡片语言，并补上克制的动效。
> 你已拍板：默认原生层 / 悬浮入口移进选项 / DoLGameUI 让位 / 状态卡显示“当前值 + 百分比” / 版本 1.1.2。

## 0. 结论先行

- **替换呈现，不替换业务。** 原版 DOM 节点、点击事件、`data-passage`、存档变量全部保留；只改外观、加展示标记。
- **不用 TweeReplacer 改 passage 源码。** 原版状态/选项/弹层都是运行时 DOM；CSS 为主，JS 只做展示投影。卸载后原版外观原样恢复。
- **范围是全量原版 UI，不是四个样例。** 图 1–4 只是你给的直观锚点；下面用“原生界面根节点 + 组件族”覆盖整张 UI。
- **默认形态：原生卡片开启，悬浮灯台关闭。** 入口移到游戏「选项」里，不再常驻悬浮球。
- **DoLGameUI 已启用时自动让位**，不抢它的全局按钮/字号规则。
- **状态卡首版显示“当前值 + 百分比”**，不伪造 `x/上限`。
- **版本 1.1.2。**
- **性能策略：CSS 承担 90% 以上；JS 每次 passage 只跑一遍，不常驻轮询，不全文档监听。**

---

## 1. 你给的四张图，在新方案里的位置

| 图 | 现在是什么 | 新方案里的角色 |
|---|---|---|
| 图 1 | 我方面板「身心」页：意志/压力/创伤/兴奋/疲惫，彩色条 + 数值 | 状态卡片的视觉参考，替换图 3 的原版状态行 |
| 图 2 | 我方面板「此刻」页：时间环 + 金钱卡 + 场景/时段卡 | 金钱/时间/日期的卡片参考，替换原版 `#stats` 顶部行 |
| 图 3 | 原版侧栏展开后的状态行：疼痛/性欲/疲劳/压力/创伤/自控/诱惑 + 灰色进度条 | 被替换目标：`#statmeters` |
| 图 4 | 原版 32px 左轨（07:48 + 痛/欲/疲/压/创/控/诱）+ 正文选项列表 | 被优化目标：`#mobileStats` + `#passages` 选项 |

对应关系：图 1 的状态卡 → `#statmeters`；图 2 的金钱卡 → `#stats`；图 4 的列表 → `#passages` 选项卡；图 4 的左轨与展开侧栏 → `#mobileStats` / `#ui-bar`。

---

## 2. 取证：原版真实 DOM（不是截图推测）

### 2.1 方法

- 文件：`DoL-Project\game\Degrees of Lewdity.html`（64,576,232 B，UTF-8，源码为 HTML-escape 形态）。
- 工具：`MapleLantern\tools\vanilla-survey.js`（本轮新增，只读）。
- 环境：Edge headless，纯原版 profile `%TEMP%\lantern-vanilla-profile`，viewport **390×844**，无任何 Mod。
- 路径：`Start2` → `(1) Next` → `Orphanage Intro`，再点 `#ui-bar-toggle` 展开侧栏。
- 证据图：`prototype\shots\vanilla-sidebar-open.png`、`prototype\shots\vanilla-survey.png`。

### 2.2 关键节点

| 区域 | 真实选择器 | 实测结构 / 事实 |
|---|---|---|
| 金钱/时间/星期 | `#stats > .content > .first-row > .centered-elements` | 4 个子 `div`：侧栏开合图标、金钱 `<span class="true"><span class="true">£5</span></span>`、`.clockContainer` + `07:00`、星期图标 + `Sun`。`#stats` 为 `display:grid`，当前高度 25px。 |
| 状态数值行 | `#statmeters` | 7 个 `#paincaption` / `#arousalcaption` / `#tirednesscaption` / `#stresscaption` / `#traumacaption` / `#controlcaption` / `#allurecaption`；每个带 `title="Pain: 0.00"`，内部是「标签 + 一句状态描述 + `.meter > .greenbar/.tealbar width%`」。 |
| 正文选项 | `#passages a.link-internal.macro-link` | 每个选项是独立 `<a>`，带 `data-passage`、`role="link"`、`tabindex="0"`；正文行内链接没有 `macro-link`。 |
| 侧栏 | `#ui-bar` / `#ui-bar-body` / `#story-caption` / `#overlayButtons` / `#menu` | `#ui-bar` fixed 281px、z=298；`#story-caption` 内含 `#stats`、`#statmeters`、`#overlayButtons`；`#menu` 是底部菜单。 |
| 手机左轨 | `#mobileStats` | fixed 32px 宽、z=299；内部是 `.stat.time`（竖排 07 / : / 48）+ 若干 `.stat green`（字母 P/Ar/F/S/T/C/Al），不是正文内容。 |
| 弹层 | `#customOverlayContainer` → `#customOverlay` → `#customOverlayTitle` + `#customOverlayContent` | 原版 8 个入口（CHARACTERISTICS / SOCIAL / TRAITS / JOURNAL / STATS / FEATS / OPTIONS / SAVES）共用；`#customOverlay` z=1000，`#customOverlayContent` 自身滚动。 |
| SugarCube 对话框 | `#ui-overlay` + `#ui-dialog` → `#ui-dialog-titlebar` + `#ui-dialog-body` | 通用确认/输入弹窗；另有 ModLoader 自己的 overlay，需排除。 |
| 底部菜单 | `#menu` → `#menu-core` | 存档 / 重新开始。 |

### 2.3 一个必须提前处理的布局事实

- `#stats` 当前高度只有 **25px**；做成 3 张信息卡后会变成约 **70–90px**。
- `#storyCaptionDiv` 与 `#storyCaptionContent` 在带图模式下是绝对定位：`#storyCaptionDiv top:192px`，`#storyCaptionContent` 从 `calc(5px + 1.32em)` 开始。
- **只给 `#stats` 加卡片样式，下面的状态区会被顶住/重叠。** 必须同步把 `#storyCaptionDiv` 改成纵向 flex，`#storyCaptionContent` 自己滚动。
- `#statmeters` 当前约 **270×176px**；7 张卡会推到约 **380–450px**，`#storyCaptionContent` 必须继续可滚动，不能把 `#overlayButtons` 挤出可视区。

---

## 3. 全量覆盖：不只四个样例

### 3.1 五个原生根节点

所有样式只挂在以下原生根与它们的后代上，不碰第三方根：

| 根 | 覆盖内容 |
|---|---|
| `#ui-bar` | 侧栏外壳、标题、`#stats`、`#statmeters`、`#overlayButtons`、`#menu`、开关/历史按钮 |
| `#mobileStats` | 手机 32px 左轨：时间、状态字母/色点、天气图标 |
| `#passages` | 正文、标题、段落、行内链接、选项、图片、列表、表格、提示块、进度条/状态条、战斗/商店/衣柜等页面内的通用控件 |
| `#customOverlay` (+ `#customOverlayContent` / `#customOverlayTitle` / `#overlayTabs` / `.tab`) | 8 个原版弹层页面及其内部按钮、表单、表格、列表、分页、关闭按钮 |
| `#ui-dialog` (+ `#ui-dialog-titlebar` / `#ui-dialog-body` / `#ui-dialog-close`) | 原生确认/输入弹窗；不含 ModLoader 自己的 overlay |

`#menu` 附着在 `#ui-bar` 内，随侧栏一起改。

### 3.2 页面清单（G1 逐页截图，不遗漏）

| 页面 / 家族 | 根 | 主要组件 |
|---|---|---|
| 正文 passage | `#passages` | 标题、段落、行内链接、选项卡、图片、列表、引用、提示、计时器、状态条 |
| 角色创建 | `#passages` | 表单、输入、选择、按钮、说明文字 |
| 战斗 | `#passages` / 战斗菜单节点 | 行动选项、状态条、目标信息、回合提示 |
| 商店 | `#passages` / overlay | 商品卡、价格、购买按钮、分页、筛选 |
| 衣柜 | `#passages` / overlay | 槽位卡、服装列表、分页、搜索、穿戴按钮；只改外框，不重绘像素图 |
| 特性 / 社交 / 特质 / 日志 | `#customOverlay` | 标题、卡片/列表、关系条、表格、正文排版 |
| 统计 / 额外统计 | `#customOverlay` | 表格、分组、数字对齐、滚动 |
| 成就 / Feats | `#customOverlay` | 徽章卡、进度、锁定态 |
| 选项 / 设置 | `#customOverlay[data-overlay="options"]` | 输入、下拉、复选框、滑块、分组、按钮、说明 |
| 存档 / 读档 | `#customOverlay[data-overlay="saves"]` | 存档卡、日期、分页、删除/覆盖/导出按钮 |
| 原生对话框 | `#ui-dialog` | 标题、正文、确认/取消、输入框 |
| 底部菜单 | `#menu` | 存档 / 重新开始 |
| 移动端左轨 | `#mobileStats` | 时间、状态字母、色点、天气 |

G1 用 `tools/ui-inventory.js` 逐个入口点开、抓真实 DOM 与截图；不靠文档列表猜。8 个入口每个都至少 390×844 + 1280×720 两档。

### 3.3 明确不接管的

- `#mce-root`（CE 面板）：不改、不抢 z-index、不改业务。
- `#customOverlay[data-overlay="modloader"]`、ModLoader 自己的对话框：不套本方案。
- DoLGameUI 已启用时的全局样式：原生层自动让位。
- 游戏 canvas（角色图、衣柜像素图、场景 canvas）：只改外框/按钮/文字，**不重绘像素**。
- 存档数据、属性数值、交易、战斗判定：零写入。

---

## 4. 视觉系统：一套 token + 一组组件

### 4.1 token

```css
--ml-bg: #0B0D10;
--ml-surface: #12161B;
--ml-surface-2: #171C22;
--ml-border: #2A313A;
--ml-text: #E9E3D6;
--ml-muted: #9AA3AD;
--ml-accent: #E3B25F;
--ml-jade: #5FBFAC;
--ml-rose: #D2737B;
--ml-danger: #C65449;
--ml-radius: 14px;
--ml-radius-sm: 10px;
--ml-shadow: 0 8px 24px rgb(0 0 0 / 28%);
```

原则：深色底、细边框、少量金色强调、青绿/玫红只用于状态语义；不用大面积紫色，不堆多层阴影。

### 4.2 组件族（所有页面共用）

| 组件 | 规则 |
|---|---|
| 卡片 | `surface + 1px border + 14px radius`；可点击的才加 hover；不套 `backdrop-filter` |
| 按钮 | 44px 最小高度；primary / secondary / ghost / danger 四态；focus 用 2px accent ring |
| 链接 | 正文行内链接保持下划线/强调色；选项链接才卡片化 |
| 输入 / 下拉 | 深底、1px 边框、focus ring；不用系统白底 |
| 滑块 | 自绘轨道与拇指；保留原 `input[type=range]` 语义 |
| 标签页 | `#overlayTabs .tab` 用下划线/胶囊选中态，不做翻页动画 |
| 表格 | 紧凑行、右对齐数字、粘性表头只在长表；320px 下允许横滚 |
| 列表 | 行卡/分隔线；可点击行有 hover；不可点击行不加手型 |
| 徽章 | 小号圆角标签；状态/危险/成就三类色 |
| 提示 | 原版 tooltip / `Tip:` 文本统一字号与颜色；不新造弹层 |
| 滚动条 | 8px 细轨，thumb 用 `--ml-border`，hover 提亮 |
| 焦点 | 所有可交互元素 `:focus-visible` 可见；不靠 `outline:none` 隐藏 |
| 关闭按钮 | `#customOverlayContent` / `#ui-dialog` 的关闭保持 44px 命中区 |

### 4.3 动效（你要的“动效”，但不乱动）

| 场景 | 动效 | 约束 |
|---|---|---|
| passage 进入 | 160ms opacity + 6px 上移 | 只作用于新 passage；不遮内容；不重播旧内容 |
| 侧栏展开/收起 | 160ms transform/opacity | 沿用原版 class；不改开合逻辑 |
| 弹层打开/关闭 | 160ms opacity + scale 0.98→1 | 关闭 120ms；背景不 blur |
| 卡片 hover / focus | 120ms 边框/底色 | 不做位移，避免点击区漂移 |
| 状态条变化 | 180ms width | 只做 CSS transition，不读 JS |
| 按钮按下 | 80ms scale 0.98 | 仅视觉，不影响点击 |
| 减少动态 | 全部 `animation:none / transition:none` | `prefers-reduced-motion` + 现有 `motion` 开关 |

**不做**：全屏三维翻页、旋转、裁切、模糊转场、长时间循环动画。动效必须可关闭，关闭后信息完全可达。

---

## 5. 技术方案（逐模块）

### 5.1 总原则

```
CSS 负责：布局、颜色、圆角、字体、间距、焦点态、动效
JS 负责：只加展示标记、数值徽标、幂等重应用
JS 不做：改数据、改 href、改 data-passage、替换点击处理器、删除原节点
```

新增 `src/native.js`，命名空间 `window.MapleLanternNative`，与现有 `render.js` 解耦；即使悬浮面板初始化失败，原生卡片层也能独立工作。

### 5.2 金钱 / 时间 / 星期（`#stats`）

- CSS：`#stats .centered-elements` 改为 3 列 grid（金钱 1.2fr / 时间 1fr / 星期 0.8fr），每列一张信息卡；`#stats` 从 25px 自然增高。
- JS：给 `#stats .centered-elements > div` 打 `data-ml-chip="money|time|day|toggle"`：
  - 含 `.true` 的 → money
  - 含 `.clockContainer` 的 → time
  - 含 `img[src*="sidebar-day"]` 的 → day
  - 含 `img[src*="sidebar-open"], img[src*="sidebar-closed"]` 的 → toggle
- 只加属性，不改文本、不改 `onclick="extendStats()"`。
- 金额直接用原版 `printmoney` 已渲染的文本，不自己换算；这也是对现有面板 `£999,899` 偏差的修正方向。

### 5.3 状态卡（`#statmeters`）

- JS 投影，幂等：
  1. 遍历 `#statmeters > div[id$="caption"]`（不写死 7 个，兼容 `oxygencaption`、drunk/drugged/hallucinogen）。
  2. 从 `title` 取数值（`"Pain: 0.00"` → `0.00`），从第一个子 `div` 的文本取名称；原状态句 `<span>` 原样保留。
  3. 加 `data-ml-stat-card`、`data-ml-stat-key`、`data-ml-value`；把数值作为右上角徽标，不删除原标签。
  4. 原 `.meter` 保留，只改高度/轨道/圆角；fill 的 `width%` 不动。
- 卡片结构：
  ```
  [名称]                 [0.00]
  [原版状态句]
  [==== 4px 进度条 ====]
  ```
- **首版显示“当前值 + 百分比”**：数值来自 `title`，百分比来自 `.meter` 子元素 `width`；不伪造 `x/上限`。
- `#statmeters.condensed`（原版关闭描述文本时）也要成立：只剩名称 + 数值 + 条。
- 解析失败的条目原样保留，不隐藏、不抛错；CSS 仍给基础卡片外观。

### 5.4 正文选项（`#passages`）

- 纯 CSS：`#passages a.link-internal.macro-link` 改成整行卡片。
- 保留：原序号 `(1)`、图标 `<img>`、时间 `(0:01)`、`data-passage`、`role`、`tabindex`。
- 行内链接（没有 `macro-link`）保持行内样式，不变成卡。
- 卡片最小高度 44px；hover/focus 只改边框与底色；不做位移导致的点击区漂移。
- 如果某 passage 用 `button.link-internal.macro-button` 作为正文选项，测试夹具会覆盖，CSS 同步支持，但不把侧栏按钮规则带到正文。

### 5.5 侧栏与手机左轨

- `#ui-bar` 宽度保持 **280px**（原版 17.5em），不改 `#story` 左边距，避免牵动全局布局。
- `#story-caption` 分区：`#stats` 信息卡 → `#storyCaptionContent`（穿着/状态卡/Tip）→ `#overlayButtons` 两列按钮 → `#menu`。
- `#overlayButtons` 用 2 列网格；`sidebarButtonSplit` 不再挤压；每个按钮 ≥44px。
- `#ui-bar-toggle` 与 `#ui-bar-history` 只换外观，不改事件。
- `#mobileStats` 保持 **32px 宽**（不抢正文宽度）；只优化时间竖排、状态字母 + 2px 色点、底色与对比。最多 34px，320/390 实测后定。
- 展开侧栏时 `#storyCaptionContent` 自己滚动，`#overlayButtons` 不被状态卡挤没。

### 5.6 弹层与对话框（全量页面）

- `#customOverlay`：改边框、圆角、底色、标题栏、关闭按钮；`#customOverlayContent` 改内边距与滚动条；不改变 `#customOverlay` 的 `left:-17.6em` 移动端偏移逻辑，先测再调。
- `#overlayTabs` / `.tab`：改成胶囊/下划线页签；保留原按钮和 `<<replace #customOverlayContent>>` 行为。
- 各页面内部统一用卡片/表格/按钮/输入组件；不逐页写死颜色。
- `#ui-dialog`：只改外框、标题、按钮、输入；不接管 ModLoader 自己的 overlay；确认/取消语义原样。
- `#menu`：存档/重新开始做成两行卡或并排按钮，保留原事件。

### 5.7 入口移进选项（你的第 1 条决定）

- 移除默认悬浮球；不创建新的常驻 HUD。
- 在 **`OPTIONS` 弹层**（`#customOverlay[data-overlay="options"]`）里加一行「灯台」入口，点击打开现有五页签浮卡；入口只做展示，不改游戏选项。
- 该入口由 `native.js` 幂等注入，`data-ml-entry="panel"`；`OPTIONS` 重绘后重新加，不重复。
- 如果用户关闭「悬浮灯台」开关，入口隐藏；如果用户卸载模组，入口随 `data-ml-native` 一起消失。

### 5.8 与 DoLGameUI / CE / MapleBirch

- **DoLGameUI 已启用：原生层让位。** 检测 `window.DoLGameUI?.ui.apiVersion === 1` 且 `getCapabilities().enabled`，不挂 `data-ml-native`，不改原版 DOM；避免两套全局 UI 互相覆盖。
- **CE**：CE 面板是 `body` 直属 `#mce-root`；本方案不碰它，所有选择器限定在五个原生根。
- **MapleBirch Framework 5.6.2**：只改原生节点，不改框架业务；与 CE 同开实测。
- **I18n**：名称/句子直接读现有 DOM，不硬编码中文；数值读 `title`，与语言无关。解析不了就保留原样。

---

## 6. 文件与包结构

```
src/
  core.js          版本/常量/设置（1.1.2）
  native.js        新增：原生 UI 展示投影
  render.js        现有悬浮面板（默认关闭，入口在选项）
  style.css        现有浮卡样式（保持 #ml-root 作用域）
  native.css       新增：全量原生 UI 卡片化
  boot.json         version 1.1.2
tests/
  native.test.js   新增：投影幂等/解析/回退/不写数据/宿主让位
  contract.test.js 更新 script/style 列表与 native 约定
  dom.test.js      更新悬浮面板默认关闭与入口
tools/
  vanilla-survey.js 本轮取证工具（保留）
  ui-inventory.js   新增：逐页抓原版 DOM 与截图
  native-probe.js   新增：原版 DOM 断言 + 视觉回归
prototype/
  native.html       新增：真实 DOM 片段静态样张
```

`boot.json` 变更：

```json
"version": "1.1.2",
"scriptFileList": ["core.js", "native.js", "render.js"],
"styleFileList": ["style.css", "native.css"],
"dependenceInfo": [
  { "modName": "ModLoader", "version": ">=2.100.0" },
  { "modName": "GameVersion", "version": "=0.5.12.13" }
]
```

仍不声明 StoneFreeHost / DoLGameUI 硬依赖；它们是可选共存对象。

---

## 7. 验收计划

### 7.1 分层断言

| 层 | 怎么做 | 通过标准 |
|---|---|---|
| 静态样张 | `prototype/native.html`，直接粘贴真实 DOM 片段 | 390×844、320×568、1280×720、1920×1080 四档不溢出；44px；文字不糊 |
| 单测 | `node --test tests\*.test.js` | 现有 46 项全绿 + native 新增 ≥15 项 |
| 原版实机 | Edge 纯原版 profile，至少 5 个 passage | 卡片出现；选项仍跳转；状态/金钱/时间更新；无重复卡 |
| 全页面 | 8 个弹层入口 + 角色创建 + 战斗 + 商店 + 衣柜 + 存档 | 每个页面都有统一卡片语言；关闭/返回正常；无溢出 |
| 侧栏交互 | 开合、8 个入口、菜单 | 每个入口都能打开原版 overlay；`#ui-bar-toggle` 正常 |
| CE 同开 | CE v1.20.3.1 + MapleBirch 5.6.2 隔离 profile | 无 `#mce-root` 冲突；原生卡可读可点 |
| 宿主同开 | DoLGameUI 4.2.0 + StoneFreeHost 0.1.5 + Dynamicest 3.3 | 原生层让位；不抢 DoLGameUI 样式；现有 18 项仍 PASS |
| 动效 | reduced-motion / 关闭动效 | 全部动效可关；关闭后操作与信息不受影响 |
| 包校验 | `check_ui_mod.py` | 0 FAIL；WARN 逐条确认 |
| 性能 | `native.js` 单次 apply 计时 | < 2ms / passage；空闲无定时器；无整文档 observer |

### 7.2 玩家路径走查

1. 冷启动进入游戏 → 展开侧栏 → 金钱/时间/星期/状态卡。
2. 点任意正文选项 → passage 切换 → 卡片重建后不重复、不闪白、不丢点击。
3. 侧栏收起 32px 左轨 → 再展开 → 卡片完整。
4. 逐个打开 8 个侧栏入口 → 每个弹层卡片化、关闭正常。
5. 金钱变化 passage → 卡片金额跟随原版文本。
6. 中文 I18n + 英文各一遍：标签/句子跟随，无硬编码残留。
7. 打开「选项」→ 找到「灯台」入口 → 打开浮卡 → 关闭后回到游戏。
8. CE 面板打开/关闭与原生卡互不影响。
9. 卸载模组 → 原版恢复原样（无残留 `data-ml-*` 选择器影响）。

### 7.3 不做假绿

- `missing / not-run / cancelled / timed-out` 一律不算 PASS。
- 自动化截图 PASS ≠ 视觉验收；最终按原速点一遍。
- 不用“jsdom 字符串存在”证明层叠生效；层叠与几何走 Edge `getComputedStyle` / 截图。
- 不同设备档（Windows / Android / iOS / macOS）不互相代替；至少注明实际跑在哪一档。

---

## 8. 风险与对策

| 风险 | 后果 | 对策 |
|---|---|---|
| `#stats` 变高，`#storyCaptionContent` 绝对定位重叠 | 状态卡被金钱卡盖住 | `#storyCaptionDiv` 改纵向 flex，`#storyCaptionContent` 自滚动；先样张验证 |
| 7 张状态卡把侧栏撑太长 | 底部按钮被推远 | 卡片紧凑化（52–60px/张）；内容区滚动；不隐藏原按钮 |
| 全量 CSS 命中其他 Mod | 不可控外观污染 | 所有选择器限定五个原生根；不用 `body *`、不用 `*` |
| `#customOverlay` 移动端 `left:-17.6em` | 弹层偏移/越界 | 保留原偏移；只改内部；390/320 实测 |
| `#ui-dialog` 被 ModLoader 复用 | 把第三方弹窗也套皮 | 排除 ModLoader overlay；只在原生对话框上下文启用 |
| 选项选择器误伤行内链接 | 正文可读性破坏 | 只匹配 `.macro-link`；行内 `link-internal` 不改 |
| DoLGameUI 同时启用 | 两套 UI 互相覆盖 | 默认让位；不强制覆盖 |
| CE/MapleBirch 也操作 `#story-caption` | 状态卡被重建/错位 | `:passageend` 幂等重应用；必要时只监听 `#statmeters` 单节点（rAF 合帧） |
| 32px 左轨加宽 | 正文变窄 | 保持 32px；最多 34px，320/390 实测后定 |
| 动效影响操作 | 点击延迟/眩晕 | 仅 120–180ms；reduced-motion 全关；不做全屏转场 |
| 全量页面工作量 | 逐页不可控 | 先做组件层，再按页面家族套用；G1 逐页截图，不靠猜 |

---

## 9. 迭代顺序（每步可停、可回退）

| Gate | 产出 | 通过条件 |
|---|---|---|
| **G0 计划评审** | 本文档 | 用户确认全量范围、入口位置、版本 1.1.2 |
| **G1 全量盘点 + 静态样张** | `ui-inventory.js` 页面清单 + `prototype/native.html` + 4 档截图 | 每个原生页面都有真实 DOM 记录；卡片语言成立；不改游戏包 |
| **G2 原生基础层** | `native.css` + `native.js` + 单测 | 纯原版：侧栏/状态/金钱/选项成立；无重复、无写入 |
| **G3 全页面铺开** | 弹层、表单、表格、按钮、动效 | 8 个入口 + 角色创建/战斗/商店/衣柜/存档逐页通过 |
| **G4 共存与打包** | CE/MapleBirch/I18n/宿主 profile + 1.1.2 包 | 不冲突、可回退、性能达标；0 FAIL；玩家路径逐条走查 |

**本轮只做到 G0**；G1 样张出来后再进入 G2。

---

## 10. 你的四条决定已写入

1. **默认**：原生卡片开启；悬浮灯台关闭；入口移到 **OPTIONS 弹层**里的「灯台」行。
2. **DoLGameUI**：原生层自动让位，不强制覆盖。
3. **状态卡**：首版显示“当前值 + 百分比”，不伪造上限。
4. **版本**：**1.1.2**。

---

## 11. 本轮取证清单（可复查）

- `game\Degrees of Lewdity.html`：`#stats` / `#statmeters` / `#mobileStats` / `#ui-bar` / `#passages` / `#customOverlay` / `#ui-dialog` 实际结构。
- `MapleLantern\tools\vanilla-survey.js`：可重复跑的只读 DOM 取样。
- `prototype\shots\vanilla-sidebar-open.png`：展开侧栏原版状态行与 `#stats` 行。
- `prototype\shots\vanilla-survey.png`：收起侧栏原版 32px 左轨。
- 取样条件：纯原版、无 Mod、Edge headless、390×844、`Orphanage Intro`。
