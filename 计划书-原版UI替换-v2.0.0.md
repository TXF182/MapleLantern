# 灯台 v2.0.0 计划书：把原版 UI 直接换成卡片

> 评审稿 · 2026-11-11 · 尚未实施
> 目标不是“再叠一个面板”，而是把原版游戏自己的 `#ui-bar` / `#stats` / `#statmeters` / `#passages` 直接呈现为卡片。

## 0. 结论先行

- **做法：替换呈现，不替换业务。** 原版 DOM 节点、点击事件、`data-passage`、存档变量全部保留，只改外观与少量展示性标记。
- **不用 TweeReplacer 改 passage 源码。** 所有目标都在运行时 DOM 里，CSS 为主、JS 只做“展示投影”。卸载模组后原版外观原样恢复。
- **默认形态：原生卡片层开启，悬浮灯台关闭。** 悬浮球/浮卡保留为可选项，不再作为主界面。
- **版本建议：2.0.0。** 这是产品方向变更，不是 1.x 的小修。
- **性能策略：CSS 承担 90% 以上；JS 每次 passage 只跑一遍，不常驻轮询，不监听整个文档。**

---

## 1. 四张图的需求翻译

| 图 | 现在是什么 | 在新方案里的角色 |
|---|---|---|
| 图 1 | 我方面板「身心」页：意志/压力/创伤/兴奋/疲惫，彩色条 + 数值 | 状态卡片的**视觉参考**，用来替换图 3 的原版状态行 |
| 图 2 | 我方面板「此刻」页：时间环 + **金钱卡** + 场景/时段卡 | 金钱/时间/日期的**卡片参考**，用来替换原版 `#stats` 顶部行 |
| 图 3 | 原版侧栏展开后的状态行：疼痛/性欲/疲劳/压力/创伤/自控/诱惑 + 灰色进度条 | **被替换的目标**：`#statmeters` |
| 图 4 | 原版侧栏收起后的 32px 左轨（07:48 + 痛/欲/疲/压/创/控/诱）+ 正文选项列表 | **被优化的目标**：`#mobileStats` + `#passages` 选项 |

对应关系一句话：

> 图 1 的状态卡 → 换掉图 3 的 `#statmeters`
> 图 2 的金钱卡 → 换掉图 1/4 里的 `#stats` 金钱、时间、星期行
> 图 4 的选项列表 → 换成卡片式选项
> 图 4 的左侧窄轨 + 展开侧栏 → 统一优化

---

## 2. 取证：原版真实 DOM（不是截图推测）

### 2.1 取证方法

- 文件：`DoL-Project\game\Degrees of Lewdity.html`（64,576,232 B，UTF-8，源码为 HTML-escape 形态）。
- 工具：`MapleLantern\tools\vanilla-survey.js`（本轮新增，只读）。
- 环境：Edge headless，纯原版 profile `%TEMP%\lantern-vanilla-profile`，viewport **390×844**，无任何 Mod。
- 路径：`Start2` → 点击 `(1) Next` → `Orphanage Intro`，再点 `#ui-bar-toggle` 展开侧栏。
- 证据图：`prototype\shots\vanilla-sidebar-open.png`（展开侧栏）、`prototype\shots\vanilla-survey.png`（收起侧栏）。

### 2.2 四个目标节点的真实结构

| 区域 | 真实选择器 | 实测结构 / 事实 |
|---|---|---|
| 金钱/时间/星期 | `#stats > .content > .first-row > .centered-elements` | 4 个子 `div`：侧栏开合图标、金钱 `<span class="true"><span class="true">£5</span></span>`、`.clockContainer` + 文本 `07:00`、星期图标 + `Sun`。`#stats` 为 `display:grid`，展开侧栏时在 `#storyCaptionDiv` 顶部。 |
| 状态数值行 | `#statmeters` | 7 个 `#paincaption` / `#arousalcaption` / `#tirednesscaption` / `#stresscaption` / `#traumacaption` / `#controlcaption` / `#allurecaption`；每个带 `title="Pain: 0.00"`，内部是「标签 + 一句状态描述 + `.meter > .greenbar/.tealbar width%`」。这是图 3 的原始来源。 |
| 正文选项 | `#passages a.link-internal.macro-link` | 每个选项是独立 `<a>`，带 `data-passage`、`role="link"`、`tabindex="0"`；正文里的普通行内链接没有 `macro-link`。 |
| 侧栏 | `#ui-bar` / `#ui-bar-body` / `#story-caption` / `#overlayButtons` / `#menu` | `#ui-bar` fixed 281px、z=298；`#story-caption` 内含 `#stats`、`#statmeters`、`#overlayButtons`；`#menu` 是底部菜单。 |
| 手机左轨 | `#mobileStats` | fixed 32px 宽、z=299；内部是 `.stat.time`（竖排 07 / : / 48）+ 若干 `.stat green`（字母 P/Ar/F/S/T/C/Al），不是正文内容。 |

### 2.3 关键布局事实（决定不能只换颜色）

- `#stats` 当前高度只有 **25px**；一旦做成 3 张卡，高度会变成约 **70–90px**。
- `#storyCaptionDiv` 与 `#storyCaptionContent` 在带图模式下是**绝对定位**：`#storyCaptionDiv top:192px`，`#storyCaptionContent` 从顶部偏移 `calc(5px + 1.32em)` 开始。
- 所以**只给 `#stats` 加卡片样式会让下面的状态区被顶住/重叠**；必须同时把 `#storyCaptionDiv` 改成纵向 flex，让 `#stats` 占自然高度，`#storyCaptionContent` 自己滚动。
- `#statmeters` 当前约 **270×176px**；7 张卡会把高度推到约 **380–450px**，`#storyCaptionContent` 必须继续可滚动，不能把 `#overlayButtons` 挤出可视区。

---

## 3. 为什么不用 TweeReplacer 改源码

这是一个明确取舍，不是省事：

1. `findString` 是字节级精确匹配，上游带真实 `\t` 与换行；失败只写日志、不报错，最后表现为“改了但游戏里没变化”。
2. 状态行由 `#statmeters` 在每次 passage 重建；改 passage 源码会与 I18n、CE、MapleBirch 等同样改 `StoryCaption` 的包互相覆盖。
3. 我们只需要**呈现**，不需要改数据；用 CSS + 运行时投影，卸载即恢复，回滚成本最低。
4. 原版选项的 `data-passage` 与事件必须原样保留；改源码最容易把点击语义改坏。

因此：**不新增 Twee 片段，不改 passage 文本，不接管游戏业务。**

---

## 4. 视觉方向：原生卡片语言

### 4.1 三类卡

| 类型 | 用在哪 | 结构 |
|---|---|---|
| 信息卡（Header Card） | `#stats` 金钱、时间、星期 | 小标签 + 主值 + 轻边框；金钱用大号等宽数字，时间用时钟图标，星期用短标签 |
| 状态卡（Stat Card） | `#statmeters` 7 项 | 顶行「名称 + 数值」，第二行原版状态句，底部 4px 进度条；危险值用玫红/红，良好用青绿 |
| 选项卡（Action Card） | `#passages a.link-internal.macro-link` | 左侧图标/序号，中间选项文字，右侧时间；整行可点，最小高度 44px |

侧栏本身只做“容器与节奏”：280px 宽不变、玻璃底、细分隔线、卡片间距 8px、分组标题；不新增导航层级。

### 4.2 数值语言

- 复用现有色板：`--ml-bg #0B0D10`、`--ml-text #E9E3D6`、`--ml-accent #E3B25F`、`--ml-jade #5FBFAC`、`--ml-rose #D2737B`、`--ml-danger #C65449`。
- 状态条颜色不重算业务，沿用原版 `.greenbar / .tealbar / .pinkbar / .redbar` 的语义，只把轨道和圆角统一。
- 金额显示**直接使用原版 `printmoney` 已渲染的文本**，不自己算，避免再次出现“£999,899 vs £9,998.99”的 ×100 偏差。

### 4.3 动效

- 只做 120–180ms 的 hover / focus / 展开反馈；不做三维翻页、旋转、裁切。
- 系统 `prefers-reduced-motion: reduce` 时全部关闭。
- 侧栏开合沿用原版行为，不新增动画依赖。

---

## 5. 技术方案（逐模块）

### 5.1 总原则

```
CSS 负责：布局、颜色、圆角、字体、间距、焦点态
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
- 布局配套：`#storyCaptionDiv` 改 `display:flex; flex-direction:column`，`#stats` 自然高度，`#storyCaptionContent` `flex:1; overflow-y:auto`。

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
- **不伪造上限**：原版 DOM 只有当前值和条宽百分比，没有 `x/max`。首版显示「当前值 + 百分比」；若要看 `x/max`，必须从 `State.variables` 只读取值，作为第二阶段可选项，先在样张确认。
- `#statmeters.condensed`（原版关闭描述文本时）也要成立：只剩名称 + 数值 + 条。
- 解析失败的条目**原样保留**，不隐藏、不抛错；CSS 仍会给它基础卡片外观。

### 5.4 正文选项（`#passages`）

- **纯 CSS**：`#passages a.link-internal.macro-link` 改成整行卡片。
- 保留：原序号 `(1)`、图标 `<img>`、时间 `(0:01)`、`data-passage`、`role`、`tabindex`。
- 行内链接（没有 `macro-link` 的 `a.link-internal`）保持行内样式，不变成卡。
- 卡片最小高度 44px；hover/focus 只改边框与底色；不做位移导致的点击区漂移。
- 如果原版某 passage 用 `button.link-internal.macro-button` 作为正文选项，测试夹具会覆盖，CSS 同步支持，但**不把侧栏按钮规则带到正文**。

### 5.5 侧栏（`#ui-bar` / `#mobileStats`）

- `#ui-bar` 宽度保持 **280px**（原版 17.5em），不改 `#story` 的左边距，避免牵动全局布局。
- `#story-caption` 分区：`#stats` 信息卡 → `#storyCaptionContent`（穿着/状态卡/Tip）→ `#overlayButtons` 两列按钮 → `#menu`。
- `#overlayButtons` 用 2 列网格；`sidebarButtonSplit` 不再挤压；每个按钮 ≥44px。
- `#ui-bar-toggle` 与 `#ui-bar-history` 只换外观，不改事件。
- `#mobileStats` 保持 **32px 宽**（不抢正文宽度）；只优化：
  - 时间竖排字距、颜色；
  - 状态字母改成「短字母 + 左侧 2px 色点」，保留原 tooltip；
  - 背景一层低对比玻璃，不用 `backdrop-filter` 大面积模糊。
- 如果 32px 下文字拥挤，最多加到 **34px**，并在 320px / 390px 两档截图对比后定；不直接上 44px。

### 5.6 与现有悬浮灯台的关系

推荐默认：

- v2.0.0 首次安装：`native` 开启，悬浮球/浮卡关闭。
- 设置页保留「悬浮灯台」开关；打开后仍是现有五页签浮卡，但不再默认出现。
- 两套共用色板与字号 token，但 DOM 互不嵌套：原生卡在 `#ui-bar/#passages`，浮卡在 `#ml-root`，避免选择器互相污染。

### 5.7 与 DoLGameUI / CE / MapleBirch 的边界

- **DoLGameUI 已启用时：原生层默认让位。** 检测 `window.DoLGameUI?.ui.apiVersion === 1` 且 `getCapabilities().enabled`，不挂 `data-ml-native`，不改原版 DOM；避免两套全局 UI 互相覆盖。玩家可在设置中强制开启，但需明确警告。
- **CE**：CE 面板是 `body` 直属 `#mce-root`；本方案不碰它，所有选择器限定在 `#ui-bar` / `#stats` / `#statmeters` / `#mobileStats` / `#passages`。需要与 CE v1.20.3.1 同开实测。
- **MapleBirch Framework 5.6.2**：同样只改上述原生节点，不改框架业务；需要实测。
- **I18n**：名称/句子直接读现有 DOM，不硬编码中文；数值读 `title`，与语言无关。解析不了就保留原样。

---

## 6. 文件与包结构

```
src/
  core.js           版本/常量/设置（v2.0.0）
  native.js         新增：原生 UI 展示投影
  render.js         现有悬浮面板（默认关闭）
  style.css         现有浮卡样式（保持 #ml-root 作用域）
  native.css        新增：原版节点卡片化
  boot.json         version 2.0.0
tests/
  native.test.js    新增：投影幂等/不写数据/解析失败回退
  contract.test.js  更新 script/style 列表与 native 约定
  dom.test.js       更新悬浮面板默认关闭
tools/
  vanilla-survey.js 本轮取证工具（保留）
  native-probe.js   新增：原版 DOM 断言 + 截图
prototype/
  native.html       新增：用真实 DOM 片段做静态样张
```

`boot.json` 变更：

```json
"version": "2.0.0",
"scriptFileList": ["core.js", "native.js", "render.js"],
"styleFileList": ["style.css", "native.css"],
"dependenceInfo": [
  { "modName": "ModLoader", "version": ">=2.100.0" },
  { "modName": "GameVersion", "version": "=0.5.12.13" }
]
```

仍不声明 StoneFreeHost / DoLGameUI 硬依赖；它们只是可选共存对象。

---

## 7. 验收计划

### 7.1 分层断言

| 层 | 怎么做 | 通过标准 |
|---|---|---|
| 静态样张 | `prototype/native.html`，直接粘贴 `#stats` / `#statmeters` / 选项 / 侧栏真实 DOM 片段 | 390×844、320×568、1280×720、1920×1080 四档不溢出；44px 命中区；文字不糊 |
| 单测 | `node --test tests\*.test.js` | 现有 46 项全绿 + native 新增 ≥12 项 |
| 原版实机 | Edge 纯原版 profile，`Orphanage Intro` 等 5 个 passage | 卡片出现；选项仍跳转；状态/金钱/时间更新；无重复卡 |
| 侧栏交互 | 开合、CHARACTERISTICS/SOCIAL/TRAITS/JOURNAL/STATS/FEATS/OPTIONS/SAVES | 每个入口都能打开原版 overlay；`#ui-bar-toggle` 正常 |
| CE 同开 | CE v1.20.3.1 + MapleBirch 5.6.2 隔离 profile | 无 `#mce-root` 冲突；原生卡仍可读可点 |
| 宿主同开 | DoLGameUI 4.2.0 + StoneFreeHost 0.1.5 + Dynamicest 3.3 | 原生层让位；不抢 DoLGameUI 样式；现有 18 项仍 PASS |
| 包校验 | `check_ui_mod.py` | 0 FAIL；WARN 逐条确认 |
| 性能 | `native.js` 单次 apply 计时 | < 2ms / passage；空闲无定时器；无整文档 observer |

### 7.2 必须逐条走查的玩家路径

1. 冷启动进入游戏 → 展开侧栏 → 看金钱/时间/星期/状态卡。
2. 点任意正文选项 → passage 切换 → 卡片重建后不重复、不闪白、不丢失点击。
3. 侧栏收起到 32px 左轨 → 时间/状态字母仍可读；再展开 → 卡片完整。
4. 打开 CHARACTERISTICS / SOCIAL / TRAITS / JOURNAL / STATS / FEATS / OPTIONS / SAVES 八个入口。
5. 金钱变化的 passage（买东西/领钱）→ 卡片金额跟随原版文本变化。
6. 中文 I18n + 英文各一遍：标签/句子跟随，不出现硬编码残留。
7. CE 面板打开/关闭与原生卡互不影响。
8. 卸载模组 → 原版恢复原样（无残留 `data-ml-*` 选择器影响）。

### 7.3 不做假绿

- `missing / not-run / cancelled / timed-out` 一律不算 PASS。
- 自动化截图 PASS ≠ 视觉验收；最终要按原速点一遍。
- 不用“jsdom 字符串存在”证明层叠生效；层叠与几何走 Edge `getComputedStyle` / 截图。

---

## 8. 风险与对策

| 风险 | 后果 | 对策 |
|---|---|---|
| `#stats` 变高，`#storyCaptionContent` 绝对定位重叠 | 状态卡被金钱卡盖住 | 同步把 `#storyCaptionDiv` 改纵向 flex，`#storyCaptionContent` 自滚动；先样张验证 |
| 7 张状态卡把侧栏撑太长 | 底部按钮被推远 | 卡片紧凑化（52–60px/张）；`#storyCaptionContent` 滚动；不隐藏原按钮 |
| `title` 属性/文本被 I18n 或其他 Mod 改写 | 数值/名称解析失败 | 解析失败原样保留；只对成功条目加标记；不删节点 |
| 选项选择器误伤行内链接 | 正文可读性破坏 | 只匹配 `.macro-link`；行内 `link-internal` 不改 |
| DoLGameUI 同时启用 | 两套 UI 互相覆盖 | 默认让位；强制开启需显式设置并提示 |
| CE/MapleBirch 也操作 `#story-caption` | 状态卡被重建/错位 | 只在 `:passageend` 幂等重应用；必要时监听 `#statmeters` 单节点（rAF 合帧），不监听全文档 |
| 32px 左轨加宽 | 正文变窄 | 保持 32px；最多 34px，320/390 两档实测后定 |
| 全局 CSS 命中其他 Mod | 不可控外观污染 | 所有选择器限定五个原生 ID；不用 `body *`、不用 `*` |
| 改 passage 源码的诱惑 | 与 I18n/CE 冲突、不可回退 | 明确禁止 TweeReplacer；只做 DOM 呈现 |

---

## 9. 迭代顺序（每步都可停、可回退）

| Gate | 产出 | 通过条件 |
|---|---|---|
| **G0 计划评审** | 本文档 | 用户确认方向、默认形态、版本号 |
| **G1 静态样张** | `prototype/native.html` + 4 档截图 | 卡片语言成立；不改游戏包 |
| **G2 原版替换层** | `native.css` + `native.js` + 单测 | 纯原版游戏里状态/金钱/选项/侧栏成立 |
| **G3 共存验证** | CE + MapleBirch + I18n + 宿主 profile | 不冲突、可回退、性能达标 |
| **G4 打包交付** | 2.0.0 包 + 校验 + 实机冒烟 + 报告 | 0 FAIL；玩家路径逐条走查 |

**本轮只做到 G0**，不写产品代码。G1 样张出来后再决定是否进入 G2。

---

## 10. 需要你拍板的四件事

1. **默认形态**：推荐“原生卡片开启 + 悬浮灯台默认关闭”；还是保留悬浮球常驻？
2. **DoLGameUI 已装时**：推荐原生层自动让位；还是允许强制覆盖？
3. **状态卡数值**：首版显示“当前值 + 百分比”（不伪造上限）；还是必须显示 `当前/上限`（需要只读 `State.variables` 的上限映射）？
4. **版本号**：用 **2.0.0**（方向变更），还是 **1.2.0**（延续 1.x）？

---

## 11. 本轮取证清单（可复查）

- `game\Degrees of Lewdity.html`：`#stats` / `#statmeters` / `#mobileStats` / `#ui-bar` / `#passages` 实际结构。
- `MapleLantern\tools\vanilla-survey.js`：可重复跑的只读 DOM 取样。
- `prototype\shots\vanilla-sidebar-open.png`：展开侧栏原版状态行与 `#stats` 行。
- `prototype\shots\vanilla-survey.png`：收起侧栏原版 32px 左轨。
- 取样条件：纯原版、无 Mod、Edge headless、390×844、`Orphanage Intro`。
