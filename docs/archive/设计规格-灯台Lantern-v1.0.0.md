# 灯台 · MapleLantern — UI 模组设计规格 v1.0.0

> 目标游戏：Degrees of Lewdity `0.5.12.13`（SugarCube 2.36.1）
> 技术名 `MapleLantern` / 显示名「灯台」/ 形态：独立 `.mod.zip`（路径 C，可选跟随路径 B）
> 本文是设计合同，不是效果描述。每条设计决定都附取证或判据；未取证的一律标注「未验证」。

---

## 0. 本次使用的方法与工具（可复查）

| 手段 | 用途 | 复现方式 |
|---|---|---|
| 原始 HTML 词法探针（Python 3.13，只读） | 取 SugarCube 版本、`window.Time`、`State.variables`、`V.worn` 槽位、`:root` 调色板、z-index | `python probe*.py`，探针脚本与命中片段记在 §1 |
| zip 直读（`System.IO.Compression`） | 读 SmartPhone / MapleBirchCE 真实 `boot.json`，取挂载与依赖写法 | PowerShell `ZipFile.OpenRead` |
| 源码直读（MapleBirchCE 仓库） | 复用已在生产环境验证过的宿主兼容层（token / 按钮反制 / 断点 / 动效） | `07a-host-compat.js` |
| moli 1.1.22 + CDP（playwright-core） | 真实布局量测（390 / 844 / 1280）、截图、游戏内安装与注入 | `moli serve` + `tools/lantern-probe.js` |
| jsdom 30.1.3 | DOM / 焦点 / 持久化 / ARIA 行为断言 | `node --test tests/*.test.js` |
| `check_ui_mod.py`（技能自带） | 包结构、依赖、静默失效面 | `python scripts/check_ui_mod.py <zip>` |
| `real_smoke.ps1` | 游戏本体启动级回归（不覆盖本模组） | `.\real_smoke.ps1` |

**不用的手段**：不看截图猜 DOM、不抄二手摘要、不用 jsdom 断言代替层叠与布局、不把 PASS 当视觉验收。

---

## 1. 事实基线（全部来自原始文件）

| # | 事实 | 证据位置 |
|---|---|---|
| F1 | SugarCube `v2.36.1`，基础字号 `html{font:16px/1 Helmet,Freesans,sans-serif}` | `game/Degrees of Lewdity.html` 首 4 KB + normalize 样式块 |
| F2 | 当前 passage：`State.passage`；存档变量：`State.variables`（`window.SugarCube.State.variables` 亦可） | HTML 内 `passage-override.js`、`ce_smoke.js` 实测路径 |
| F3 | 时间：`window.Time`，暴露 `date/hour/minute/days/dayState/weekDay/monthDay/month` 与 `secondsSinceMidnight` | `window.Time = Time` 前的 `Object.create({...})` getter 表 |
| F4 | 状态字段真实存在：`V.willpower/willpowermax`、`V.stress/stressmax`、`V.trauma/traumamax`、`V.arousal/arousalmax`、`V.tiredness`；疲惫上限在 `window.Constants.tiredness.max = 2000` | `V.willpower` 用法上下文 + `const constants` 块 + `window.Constants = Constants` |
| F5 | 金钱 `V.money`；场景 `State.passage` | 商店 `canAfford = V.money >= item.cost` |
| F6 | `V.worn` 槽位实测：`over_head/head/face/neck/over_upper/upper/under_upper/hands/handheld/over_lower/lower/under_lower/legs/feet/butt_plug/genitals` | 正则统计 `V.worn.<slot>` 词频 |
| F7 | 游戏调色板在 `:root`：`--000…--900`、`--gold`、`--danger`、`--link` 等 | 第二个 `:root{}` 块 |
| F8 | 层级：`#ui-bar` z=50、`#mobileStats` z=299、SugarCube `#ui-overlay` z=100000、`#ui-dialog` z=100100 | normalize / ui-dialog 样式块原文 |
| F9 | 事件：jQuery `:passageinit` / `:passagerender` / `:passageend` 均存在；`scriptFileList` 阶段 SugarCube 已起、`$` 可用 | SmartPhone `smartphone-main.js` 顶层直接用 `V`、`$(document).on(":passagerender")` |
| F10 | ModLoader 只认 zip 根 `boot.json`；四个列表缺失只 log 不报错 | 技能 `mod-anatomy.md` + 现有 16 个包实测 |
| F11 | 主 UI 契约：`apiVersion===1`、`getCapabilities()`、`getTheme().tokens` 是变量名、layout 断点 600/899 且不挂 DOM、两条全局按钮规则 (1,3,2) | `ui-contract.md` / `ui-host-overrides.md`（原始 `DoLGameUI-4.2.0`） |
| F12 | 本机当前未安装 DoLGameUI（`C:\Users\27352\Doubao` 全盘无 `*DoLGameUI*`），所以宿主分支只能做契约级验证，不能做本机视觉验证 | 本轮 `Get-ChildItem -Recurse -Filter *DoLGameUI*` 返回空 |

---

## 2. 产品定位

**一句话**：在 DoL 的黑暗界面角落放一盏可收起的「灯」，只读地把「此刻 / 身心 / 着装 / 系统 / 设置」五件事讲清楚。

**为什么不是又一个作弊面板**：CE 负责改状态，灯台负责**读状态**。它不写存档、不推进剧情、不替玩家做选择；关闭后不留任何痕迹。视觉实验与业务状态彻底分开，是技能的第一条红线。

**不做什么**（写进合同，防止后续扩展失控）：
- 不提供传送/跳转/时间推进（会改业务状态）。
- 不读取、显示 `butt_plug` / `genitals` 槽位（成人内容最小化，见 §7.3）。
- 不注册 `StyleAdapter`（没有第三方目标；CE 面板是 `body` 直属自有 DOM，结构层匹配不上，注册只会拿 `partial`）。
- 不改任何 `V.*`，包括「看起来无害」的缓存字段。
- 不做常驻轮询、不做后台定时器。

---

## 3. 信息架构

```
灯台（悬浮球）
└─ 面板（5 页签）
   ├─ 此刻 Now       时间 / 日期-时段 / 今日进度 / 金钱 / 场景
   ├─ 身心 Vitals    意志 / 压力 / 创伤 / 兴奋 / 疲惫（只读条）
   ├─ 着装 Worn      13 个服饰槽位当前名称（不含私密槽）
   ├─ 系统 System    版本 / 宿主 / 视口 / 存储 / 动效 + 复制诊断
   └─ 设置 Settings  主题 / 字号 / 密度 / 动效 / 语言 / 位置 / 分项复位
```

**入口只有两个**：右下（或左下）悬浮球点击；键盘 `Alt+L`（不与 DoL 现有按键冲突，失败不影响游戏）。没有第二套隐藏手势。

**默认页签**：`此刻`。上次停留页签持久化，但「复位」不回退页签。

---

## 4. 视觉系统

### 4.1 主题语义

「灯」不是霓虹，是**暖光落在冷暗底上**。四套主题只换光源色与表面色阶，不换布局：

| 主题 | 光源 | 表面 | 用途 |
|---|---|---|---|
| `auto`（默认） | 有宿主→取宿主 accent；无宿主→琥珀 | 墨黑 | 跟随环境 |
| `amber` | `#E3B25F` | `#0B0D10 / #12151A` | 灯台默认身份 |
| `jade` | `#5FBFAC` | `#0A1110 / #111A18` | 冷静读数 |
| `graphite` | `#C9CDD4` | `#0C0D0F / #15171B` | 无色干扰 |

**约束**：任何主题下正文对比度 ≥ 7:1，次要文字 ≥ 4.5:1（脚本计算，见 `tests/core.test.js`）。

### 4.2 色板（墨黑主题）

| Token | 值 | 用途 |
|---|---|---|
| `--ml-bg` | `#0B0D10` | 面板底（不透明兜底） |
| `--ml-bg-soft` | `#12151A` | 卡片 |
| `--ml-bg-raise` | `#1A1E25` | 悬停 / 选中底 |
| `--ml-line` | `rgba(255,255,255,.09)` | 1px 发丝线 |
| `--ml-text` | `#E9E3D6` | 正文（暖象牙） |
| `--ml-muted` | `#9A9388` | 次要 |
| `--ml-faint` | `#6E685F` | 三级 / 禁用 |
| `--ml-accent` | `#E3B25F` | 光源（强调、进度、焦点） |
| `--ml-accent-ink` | `#1A1206` | 琥珀底上的字 |
| `--ml-jade` | `#5FBFAC` | 意志 / 正向 |
| `--ml-rose` | `#D2737B` | 兴奋 |
| `--ml-danger` | `#C65449` | 创伤 / 危险动作 |

**禁止**：纯黑 `#000` 大面积、纯白正文、彩虹渐变、发光阴影叠三层。

### 4.3 字体与排版

- 标题：`"Noto Serif SC","Songti SC","Source Han Serif SC",serif`（与 CE 一致，中文不塌）。
- 正文：`system-ui,"Segoe UI","Noto Sans SC",sans-serif`。
- 数字：`font-variant-numeric: tabular-nums`（时间与数值不跳动）。
- 字号阶梯（全部经 `calc(* var(--dgu-font-scale,1) * var(--ml-scale,1))`）：
  `11 / 12 / 13 / 15 / 17 / 22 / 34 px`；面板正文 15，标签 12，页签 13，大时钟 34。
- 行高：正文 1.55；标题 1.2。
- 字距：小号全大写标签 `+0.08em`。

### 4.4 形状与材质

- 面板圆角 `var(--dgu-card-radius,16px)`；卡片 12；胶囊 999。
- 玻璃：`backdrop-filter: blur(18px) saturate(1.15)`；不支持时 `@supports not` 退到 96% 不透明底。
- 边缘：外 1px `rgba(255,255,255,.08)` + 顶部 1px 琥珀渐变高光（模拟灯罩边缘）。
- 阴影：`0 24px 64px rgba(0,0,0,.55)`；不开多层彩色阴影。

### 4.5 图标

- 内联 SVG，20×20，`stroke-width:1.6`，圆头；不引外部图片（包体与离线稳定）。
- 五个页签图标：日轮 / 心电 / 衣架 / 齿轮 / 滑杆。
- 悬浮球：灯罩轮廓 + 火苗（CSS 绘制，不用 SVG 贴图）。

### 4.6 悬浮球（签名元素）

- 56×56（移动 52），圆形；外圈 3px 的**时间环**用 `conic-gradient` 表示「今日已过百分比」，随 `:passageend` 更新。
- 中心火苗：两层径向渐变，`dayState` 决定色温（night 偏蓝、dawn 暖橙、day 浅金、dusk 玫金）。
- 悬停：外环亮 1 档 + 轻微上浮 1px；按下：内缩 0.98。
- 位置：默认左下；可拖，松手吸附最近左右边缘，纵向保留；坐标持久化。
- 角标：右侧 6px 圆点表示「有可读状态 / 读取降级」。

---

## 5. 组件规格

### 5.1 面板外壳

| 项 | 桌面 | 平板（561–900） | 手机（≤560 或宿主 mobile） |
|---|---|---|---|
| 形态 | 浮动卡片，贴 orb 同侧 | 同桌面 | 底部抽屉（bottom sheet） |
| 宽 | 380 | 380 | `auto`（左右各让安全区） |
| 高 | `min(70vh, 620px)`（定高，切页不跳动） | 同 | `auto`，上限 `84vh` |
| 圆角 | 18 四角 | 18 | 18 18 0 0 |
| 安全区 | 右/左 16px + `env(safe-area-inset-*)` | 同 | `env(safe-area-inset-bottom)` + 左右安全区 |
| 关闭 | 右上 44×44 | 同 | 右上 44 + 下滑手柄（>64px 关闭） |

**层叠**：`#ml-root` 整体 `z-index:89900`（面板内部局部 `z-index:2`）；低于 SugarCube overlay `100000`/dialog `100100`（原生存档/设置对话框必须压在我们上面），高于 `#ui-bar` 50 与 `#mobileStats` 299。CE 面板 `2147483000` 仍在我们之上（不抢作弊面板）。

### 5.2 页签

- `role="tablist"`，5 个 `role="tab"`，`aria-selected`，`aria-controls`。
- 激活：文字转 `--ml-accent`，底部 2px 琥珀线（`transform: scaleX()` 动画，reduced motion 下直接显示）。
- 键盘：`←/→` 循环、`Home/End` 跳端、`Enter/Space` 激活。
- 窄屏：横向滚动，隐藏滚动条但保留键盘可达；每个页签最小 44×44。

### 5.3 数据条（Vitals）

- 行高 44；左标签 64px，中轨 1fr，右数值 52px 右对齐。
- 轨道 4px，圆角 2；填充按比例；填充色按语义（意志 jade、压力 琥珀→玫、创伤 danger、兴奋 rose、疲惫 灰蓝）。
- 数值 `当前/上限`，等宽数字；超上限按 100% 显示并在数值后加 `↑`。
- 缺失字段：整行不渲染，页底显示「本存档缺少 N 项可读字段」。

### 5.4 进度环（Now）

- 120×120，`conic-gradient`；中心 34px 时钟或百分比。
- 环从 0 点顺时针；当前小时决定 4 段色（夜/晨/昼/暮）。
- 环下三张卡：金钱（大数字 + 「£」用手绘 `£` 字符）、场景（截断 1 行）、时段（中文）。

### 5.5 设置控件

- 分段选择（主题/密度/语言）：`role="radiogroup"`，按钮 44 高。
- 滑块：**自绘 `.ml-slider`**（原生 `input[type=range]` 在 moli/Edge 真实渲染下只有孤立圆点、没有可见轨道）。`role="slider"` + `tabindex="0"` + `aria-valuemin=80/max=140/now/valuetext`；内部 `.ml-track` / `.ml-fill` / `.ml-thumb`；`pointerdown` 拖动、5% 吸附；`←/→/↑/↓`、`Shift` 步进 10、`Home`=80、`End`=140；`focus-visible` 双层光晕。
- 开关：`role="switch"` + `aria-checked`，44×26 轨道。
- 复位是**分项**的：`字号回 100%`、`密度回舒适`、`主题回自动`、`位置复位`，没有「一键全清」。

---

## 6. 交互与状态机

```
closed ──click orb──▶ opening ──180ms──▶ open
open ──Esc / 关闭 / 点击外部(桌面) / 下滑(移动)──▶ closing ──140ms──▶ closed
open ──:passageend──▶ open(数据刷新，不关闭)
任意 ──destroy()──▶ destroyed（移除 DOM、解绑全部监听、清 localStorage 监听）
```

- 打开时焦点进入首个页签；关闭时焦点回到 orb（若 orb 仍存在）。
- 焦点陷阱：Tab 在面板内循环；`Shift+Tab` 反向。
- 桌面点击外部关闭：`document` 捕获阶段 `pointerdown`，命中 orb/面板内部则忽略。
- 移动端：半透明遮罩（`rgba(0,0,0,.45)`），点击遮罩关闭；面板顶部 24px 拖拽区，下滑 >64px 关闭。
- 拖动 orb：`pointerdown` → 6px 阈值 → 跟手；`pointerup` 吸附；拖动中不触发打开（用 `moved` 标记）。
- 双击 orb 不放大（禁止 `dblclick` 缩放页面：`touch-action: manipulation`）。

---

## 7. 数据桥（只读）

### 7.1 读取顺序

```
状态: window.SugarCube?.State?.variables → window.State?.variables
时间: window.Time
常量: window.Constants
场景: window.SugarCube?.State?.passage → State.passage
游戏版本: window.StartConfig?.version
```

任何一层抛错或缺失 → 返回 `null`，UI 降级，不抛到控制台。

### 7.2 字段表

| 组 | 字段 | 上限来源 | 缺失表现 |
|---|---|---|---|
| 时间 | `Time.hour/minute/days/dayState/month/monthDay` | — | 时间卡显示「—」 |
| 金钱 | `V.money` | — | 显示「—」 |
| 场景 | `State.passage` | — | 显示「未知场景」 |
| 意志 | `V.willpower` | `V.willpowermax` | 行隐藏 |
| 压力 | `V.stress` | `V.stressmax` | 行隐藏 |
| 创伤 | `V.trauma` | `V.traumamax` | 行隐藏 |
| 兴奋 | `V.arousal` | `V.arousalmax` | 行隐藏 |
| 疲惫 | `V.tiredness` | `Constants.tiredness.max ?? 2000` | 行隐藏 |
| 着装 | `V.worn[slot].name` | — | 槽显示「—」 |

### 7.3 着装槽位（14 个，明确排除 2 个）

显示：`over_head/head/face/neck/over_upper/upper/under_upper/hands/handheld/over_lower/lower/under_lower/legs/feet`（14 个，含 handheld）。
排除：`butt_plug/genitals`——不因「技术上能读」就展示，属于成人内容最小化。

`name === "naked"` 映射为「无」；其余原样显示（内部名，不做二次翻译，避免自造译名）。

### 7.4 只读的机器证明

测试用 `Proxy` 包住假 `V`，`set` 陷阱记录并抛错；跑完整交互（开面板、切五个页签、改设置、拖 orb、关闭）后断言 `set` 调用数 = 0。

---

## 8. 宿主接入（路径 B，可选）

| 项 | 做法 | 依据 |
|---|---|---|
| 检测 | `window.DoLGameUI?.ui` + `apiVersion===1` + `typeof getCapabilities==="function"` | F11 |
| 缺失 | 全部走自有默认，不抛错、不提示失败 | 契约：原生回退 |
| accent | `--ml-accent: var(<tokens.ocean>, #E3B25F)` | tokens 是变量名，转发引用 |
| radius | `--ml-radius: var(<tokens.radius>, 12px)` | 同上 |
| 不跟随 | **不接** `text/surface/card/danger`：`--dgu-card` 仅 `html[data-stone-free]` 可达、`--dgu-danger` 不可达；宿主浅色时接 text 会让自绘深底对比度反转 | F11 + 取舍记录 |
| 字号 | `calc(px * var(--dgu-font-scale,1) * var(--ml-scale,1))` | 主 UI 字号规则射程不含 body 直属面板 |
| 按钮 | 每类逐条封回，双 ID `#ml-root#ml-root`，前导 `html[data-dgu-buttons-scaled]` | 主 UI 规则 (1,3,2)、padding 带 `!important` |
| 断点 | 自监 `resize` 150ms 节流；`sheet = innerWidth<=560 \|\| (宿主 layout==='mobile' && innerWidth<=600)` | cap 是快照，不挂 DOM |
| 动效 | 零 JS：`@media (prefers-reduced-motion:reduce)` + `html[data-dol-midnight]:not([data-dgu-visualMotion])` | 不读 `cap.reducedMotion` |
| 浮层 | **不用** `ui.openDrawer`：自有面板需要跨环境一致的几何与 z-index，宿主浮层会把我们塞进 `#customOverlay`（z 1000），层级反而更低 | 取舍记录 |

**未装主 UI 时零匹配**：所有反制规则以 `html[data-dgu-*]` 或 `html[data-dol-midnight]` 前导；测试断言这些规则在无属性页面不生效（选择器匹配数为 0）。

---

## 9. 响应式与设备档

| 档 | 判据 | 几何 | 排版 |
|---|---|---|---|
| 手机 | `w<=560` 或宿主 mobile | 底部抽屉，左右让安全区 | 单列、页签横滚、行 44、基础字号 15 |
| 平板 | `561–900` | 380 浮卡（与桌面同宽） | 单列、卡片内 2 列槽位 |
| 桌面 | `>900` | 380 浮卡 | 单列、卡片内 2 列槽位 |

**取舍**：技能警告「不要拿 600/899 顶替自有断点」。这里 560 是「380 面板 + 32 边距在 412 以下会挤压」的实际阈值；与宿主 600 取并集，代价是 561–600 提前进抽屉（≤40px），换来「宿主判为手机时本模组不会仍是浮卡」。已实测回归宽度：320×568、390×844、844×390、1280×720、1280×720&lang=zh、1280×720&host=1、1920×1080、320×568&scale=140&lang=en。

安全区：竖屏 `env(safe-area-inset-bottom)`；横屏左右安全区；刘海不遮 orb。

---

## 10. 无障碍

- 对比度：正文/次要/强调三档全部脚本计算（WCAG 相对亮度公式），阈值 7 / 4.5 / 4.5。
- 焦点：`:focus-visible` 2px 琥珀描边 + 2px offset；不用 `outline:none`。
- 键盘全路径：`Alt+L` 开 → Tab 到页签 → 方向键切页 → Tab 到控件 → Esc 关。
- 读屏：orb `aria-label` 动态为「灯台 · 8月10日 · 23:45」；面板 `role=dialog aria-modal=true aria-label`；切页 `aria-live=polite` 播报页名。
- 动效：系统减弱 → 全部 `animation/transition:none`，进度环直接给终值；自有开关 `data-motion=off` 同效。
- 触控：所有可点元素 ≥44×44（含关闭、页签、chip、开关热区）。
- 文本缩放：140% 时面板不溢出（`min-width:0`、`overflow-wrap:anywhere`、数值 `tabular-nums`）。

---

## 11. 持久化

- 键：`MapleLantern.settings.v1`（单键，JSON）。
- 形态：`{v:1, theme, scale, density, motion, lang, tab, side, y, seen}`
- 读取：JSON 解析失败 / 字段越界 → 逐字段回默认（**不整包丢弃**），并把 `repaired:true` 记进诊断。
- 写入：每次变更立即写，`try/catch`；失败 → 内存态继续，底部一次性提示「设置只在本次生效」。
- 版本迁移：`v!==1` → 只保留能识别的字段，其余默认；不删除旧键（不覆盖用户数据）。
- 清除：`destroy()` 不删设置（玩家重装后保留偏好）；提供 `MapleLantern.reset()` 显式清除。

---

## 12. 国际化

- 支持 `zh-Hans` / `en`；检测顺序：设置 → `navigator.language` → `zh`。
- 文案集中在 `core.js` 的 `STRINGS`，键名语义化（`tab.now`、`vital.willpower`…）。
- 不缺键：测试断言 zh/en 键集合完全相等。
- 数字/时间本地化：`08:20` 两语言一致（24 小时制），日期 `3月14日` / `Mar 14`。
- 不翻译游戏内专有名词（passage 名与衣物内部名原样输出）。

---

## 13. 性能预算

| 指标 | 预算 | 判据 |
|---|---|---|
| 首次挂载 | < 8 ms | 测试中 `performance.now()` 包裹 `mount()`（jsdom 近似值，标注非真机） |
| 每次 `:passageend` | < 2 ms | 只更新文本与 CSS 变量，不重建 DOM |
| 常驻监听 | 4 个 | `:passageend`、`resize`、`keydown`、`document pointerdown`；无 `setInterval` |
| 包体 | < 120 KB（zip） | `check_ui_mod.py` 体积项 |
| DOM 节点 | < 180 | 打开面板时统计 |

---

## 14. 错误隔离与卸载

- 全入口 `try/catch`；单次失败后置 `disabled=true`，移除 orb，控制台只留一条 `[MapleLantern]` 前缀日志。
- `window.MapleLantern = { version, open, close, toggle, destroy, reset, diagnostics }` 为唯一对外面。
- `destroy()`：移除 `#ml-root`、解绑 4 个监听、清 `--ml-*` inline 变量、恢复 `documentElement` 上无我们添加的属性（本模组不往 html 挂属性，天然满足）。
- 与其他 UI 共存：不覆盖全局 `button`/`a` 样式；所有选择器以 `#ml-root` 作用域；不修改 `body` 类名。

---

## 15. 打包与验收矩阵

| 层 | 手段 | 通过标准 |
|---|---|---|
| 逻辑 | `node --test tests/core.test.js` | 全绿；覆盖格式化、降级、主题对比度、设置修复、i18n 键对齐 |
| DOM/ARIA | `node --test tests/dom.test.js`（jsdom） | orb/面板/焦点陷阱/切页/持久化/宿主 token/零写入/销毁 |
| 契约 | `node --test tests/contract.test.js` | CSS 含双 ID 反制、两条动效判据、44px、无 `!important` 污染全局；boot 字段齐全 |
| 包结构 | `python scripts/check_ui_mod.py dist/*.zip` | exit 0；WARN 逐条解释 |
| 真实布局 | moli + CDP，8 case × 5 页签（320/390/844/1280/1920/host/140%） | 命中区 ≥44、内容区无横向溢出、面板不越界、截图落盘且 PNG 魔数正确 |
| 包体/路径 | zip 正斜杠、根 `boot.json`、SHA256、两次打包同哈希 | 与 `check_ui_mod.py` 一致 |
| 游戏本体 | `.\real_smoke.ps1` | A/B/C 三项通过；D/G 按基线；声明「不覆盖本模组」 |
| 游戏内 | Edge 隔离 `user-data-dir` + `mce-mod-import.html` 导入 + `file://` 打开游戏 | `#ml-root` 注入、面板 380×504、orb 56×56、z 89900、无未捕获异常；截图落盘 |

**永远不算 PASS**：`missing / not-run / cancelled / timed-out`；原型认可；jsdom 断言；单设备结论外推。

---

## 16. 风险与未验证项

| 风险 | 影响 | 处置 |
|---|---|---|
| 本机无 DoLGameUI | 宿主分支只有契约级验证 | 代码按契约写 + 单测假宿主 + `?host=1` 原型；标注「真机未验证」 |
| 本机无 Android/iOS | 移动端只有 390/320/844×390 视口模拟 | 标注「模拟视口 ≠ 真机」 |
| 游戏基座缺外部资源 | 隔离 profile 首启有 5 类 `ERR_FILE_NOT_FOUND`（`modList.json` / `style.css` / `usettings.js` / 两张 UI 图） | 均不在本包内；本包 5 条目无外部引用；不据此判本模组失败 |
| CE 同时打开 | 两个浮层并存 | z-index 让 CE 在上；不自动关闭 CE |
| 游戏升级 | `V` 字段变动 | 字段全走安全读取，缺失即隐藏；`GameVersion` 精确锁定 |
| 内部衣物名英文 | 观感不统一 | 不做自造翻译，保留原值并标注 |

---

## 17. 实机复核记录（2026-11-11）

本节只写实测，详细清单见 `验证报告-灯台Lantern-v1.0.0.md`。

| 层 | 结果 |
|---|---|
| `node --test tests\*.test.js` | 39 / 39 PASS（core 14 + dom 13 + contract 12） |
| moli 8 case × 5 页签 | 249 条断言 PASS / 0 FAIL，exit 0；40 张首帧截图 |
| `check_ui_mod.py` | 13 PASS / 1 WARN / 0 FAIL，exit 0；WARN = 未声明 StoneFreeHost（有意可选接入，见验证报告 §2.2） |
| 确定性打包 | 两次 SHA256 一致：`0127346f3b0f3a9b6e6791747673f1e436ec927726cf33c7a4dacf96bed6a5ca`，27,595 B / 5 条目 |
| Edge 隔离 profile 实机 | `#ml-root` 注入；orb 1208,534 56×56；panel 884,16 380×504；z 89900；sheet=0；tab=now；0 未捕获异常 |
| `real_smoke.ps1` | A/B/C PASS；D=23、E=23、G=23；F WARN（CE 未注入，http origin 不覆盖本模组） |

**实机暴露并已修的两件事**：

1. 面板高度原本随内容变化（now 页只有 425），切页会跳；已改为桌面 `height:min(70vh,620px)` 定高、抽屉 `height:auto` 上限 84vh。
2. 首次启动年龄弹窗 `#ui-dialog`（z=100100）按设计压住面板；这不是缺陷，但走查必须先关弹窗再点页签，`tools/game-smoke.js` 已按真实路径处理。

**仍然未验证**：DoLGameUI 真机跟随、Android/iOS/macOS、CE 同开、玩家真实存档下的 passage 切换。

---

## 18. v1.1.0 增补（2026-11-11，性能与精美）

### 18.1 通透度（对齐 DoLGameUI 4.2.0 口径）

- 新设置 `glass`：0–100，5% 步进，默认 **60**；非法值修复，缺省补 60。存储键不变，旧档升级后自动获得 60。
- 只改三件事：**表面遮蔽**（`--ml-surface-alpha`）、**模糊**（`--ml-blur`）、**边缘层次**（`--ml-edge`），并挂 `data-glass`。
- **不改文字与按钮透明度**；恢复语义分项（「通透度回 60」只重置这一项）。
- 公式：
  - `alpha = glass<=60 ? 1-glass*0.001333 : .92-(glass-60)*.005`，夹 `.72~1`
  - `blur = 0 | glass/3 | 20+(glass-60)*.3`
  - `edge = .06+glass*.0005`
- `glass=0` 时 `backdrop-filter: none`，保留数值；再提高时数值原样恢复。

### 18.2 脚本命名（宿主档最严重的一处静默失效）

- 渲染层由 `index.js` 改名 `render.js`。原因：`index.js` 与 DoLGameUI 4.2.0、StoneFreeHost 0.1.5 的脚本同名，四包同装时本包渲染层完全不执行（`core.js` 已执行、`window.MapleLantern` 不存在、`pageerror` 为零）。
- `boot.json` 顺序固定 `["core.js","render.js"]`；**不要改回 `index.js`**。

### 18.3 性能

- `:passageend` → 单飞标记 `passagePending` → 一次 `requestAnimationFrame` 合帧；无 rAF 时 `setTimeout(run,0)` 兜底。
- 只重绘当前页签；滑块拖动只推 CSS 变量，不整页重建。
- `renderActive()` 用 `performance.now()` 计时，写入 `state.lastRenderMs`，诊断字段 `renderMs` 可回读。
- 实机：剧情切换后单次刷新 **0.2–0.4 ms**（纯净档 / 宿主档同口径），冒烟断言上限 16 ms。
- CSS：面板 `contain: layout style`，内容区 `contain: layout paint style` + `-webkit-overflow-scrolling: touch`；抽屉 `84vh` 后追加 `84dvh`。

### 18.4 宿主真机（Windows + Edge 隔离 profile）

- 四包同装：Dynamicest 3.3 + StoneFreeHost 0.1.5 + DoLGameUI 4.2.0 + MapleLantern 1.1.0。
- 15 项 PASS：API v1、8 个 token 名、`layout=desktop`、`visualTier=Fancy`、面板仍 380×504、页面无异常。
- 宿主强调色 `rgb(201,201,205)` 真实转发；球与页签跟随宿主。
- `Start → Start2`：面板场景同步、时间 `23:45 → 07:00`，证明 `:passageend → rAF → 重绘` 链路成立。

### 18.5 仍未验证

- Android / iOS 真机；macOS；与 CE 同开；玩家真实存档下的长时间 passage 连续切换。

## 19. v1.1.1 增补（2026-11-11 · 启动与交互静默优化）

### 19.1 启动

- `mount()` 不再预渲染隐藏面板内容；面板关闭时只更新悬浮球时钟与底部状态，首次 `open()` 才构建当前页签。
- 理由：隐藏内容在首次打开时必定重建一次，预渲染是纯浪费；同时降低启动阶段 DOM 构建与节点数。
- 判据：`tests/dom.test.js` 断言挂载后 `#ml-panel .ml-pane` 为空，`open()` 后存在。

### 19.2 设置页稳定

- 主题 / 密度 / 动效切换改为只写 CSS 属性，不重建设置页（`setSetting(key,value,false)`）；分段控件自身先更新 `aria-checked`，因此视觉与语义不丢。
- `:passageend` 时若当前页签是设置，只更新顶部时钟与底部状态，不重建内容；滑块数值、焦点与滚动位置保留。
- 理由：设置页不依赖存档数值；重建设置页会冲掉正在拖动的滑块与键盘焦点。
- 判据：`tests/dom.test.js` 断言切主题后同一 `.ml-pane` 节点与焦点都保留，`passageend` 后仍保留；`tools/game-smoke.js` 在真实 Edge 下同样断言。

### 19.3 宿主能力适配（性能）

- `caps.backdropFilter === false` → `#ml-root[data-blur="off"]`，CSS 直接 `backdrop-filter: none`，不靠透明度假装模糊。
- 宿主 `visualTier` 收窄模糊上限：`Smooth` 10px / `Balanced` 16px / `Fancy` 保留公式值（`glass=100` 时 32px）。
- 理由：20–32px 的实时背景模糊是面板最贵的 GPU 项；低档位宿主不应被本包强行拉满。
- 判据：`tests/dom.test.js` 覆盖 off / Smooth / Balanced / Fancy 四态；实机纯净档与宿主档读回 `blur(20px) saturate(1.1)`。

### 19.4 本轮产物与证据

- `dist\MapleLantern-1.1.1.mod.zip`，5 条目，SHA256 见 `dist\SHA256.txt`。
- 单测 **46 / 46 PASS**；moli 8 case × 5 页签 **249 条断言 PASS**；`check_ui_mod.py` **13 PASS / 1 WARN / 0 FAIL**（WARN 仍为“未声明 StoneFreeHost”，有意取舍）。
- 纯净档 **14 项 PASS**；宿主档 **18 项 PASS**；两边 `renderMs` 均在 0.2–0.4 ms。
- 设置页实机：`samePane=true`、`focusStayed=true`、`data-blur=on`、`filter=blur(20px) saturate(1.1)`。
