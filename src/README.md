# 灯台 · Lantern（MapleLantern 1.1.1）

Degrees of Lewdity `0.5.12.13` / SugarCube `2.36.1` 的**只读信息台** UI 模组。

- 右下悬浮球（时间环 + 时段火苗），点击或 `Alt+L` 打开五页签面板。
- 此刻 / 身心 / 着装 / 系统 / 设置 五个页签。
- 「此刻」页在时间、金钱、场景之后附一行**身心速览**（意志 / 压力 / 创伤三格），完整五项仍在「身心」页。
- 自动跟随 DoLGameUI 4.x 的强调色与圆角（检测到才跟随，没有就用自己的外观）。
- **不写存档、不改数值、不接管任何第三方业务。**

## 安装

1. 打开游戏，`Alt+M` 呼出 ModLoader。
2. 「添加旁加载 Mod」选择 `MapleLantern-1.1.1.mod.zip`。
3. 刷新页面。安装后无需重启游戏。

> 直接把 zip 复制进 `game\` 目录**不等于安装**：玩家侧 Mod 来自 `file://` origin 的 IndexedDB。

## 入口

| 入口 | 行为 |
|---|---|
| 右下悬浮球 | 单击开合；拖动超过 6px 视为移动，不触发开合 |
| `Alt+L` | 开合面板（输入框内不抢键） |
| `Esc` / 外部点击 / 抽屉下滑 >64px | 关闭 |

移动端（`≤560px` 或高度 `≤520px`）自动改为底部抽屉，打开时悬浮球让位，关闭后焦点交还游戏正文。

## 设置

| 项 | 范围 | 默认 |
|---|---|---|
| 主题 | 自动 / 琥珀 / 青瓷 / 石墨 | 自动 |
| 字号 | 80–140%，5% 步进 | 100% |
| 通透度 | 0–100，5% 步进 | 60 |
| 密度 | 舒适 / 紧凑 | 舒适 |
| 动效 | 开 / 关 | 开 |
| 语言 | 自动 / 中文 / English | 自动 |
| 悬浮球位置 | 左下 / 右下 | 右下 |

设置存 `localStorage["MapleLantern.settings.v1"]`；逐字段修复，坏一个字段不会整包丢弃。

通透度只改**表面遮蔽 / 模糊 / 边缘层次**三项，不改文字与按钮透明度；0 更沉稳、100 更通透。关掉玻璃模糊后再开，数值保留；「通透度回 60」只重置这一项。

## 性能

- `:passageend` 只做一次 `requestAnimationFrame` 合帧：同一帧内连续事件合并，面板只重绘一次。
- 面板关闭时不再预渲染内容，首次打开才构建当前页签；启动只更新悬浮球时钟。
- 只重绘当前页签；设置里的滑块拖动只推 CSS 变量，不整页重建。
- 主题 / 密度 / 动效切换只改 CSS 属性，不重建设置页；剧情推进时也不重建该页，保留焦点与滚动位置。
- 宿主 `visualTier` 为 `Smooth` / `Balanced` 时自动把模糊收窄到 10px / 16px；`backdropFilter` 为 false 时直接关闭模糊。
- 面板 `contain: layout style`、内容区 `contain: layout paint style`，把重排/重绘限制在面板内。
- 移动端高度优先 `dvh`（`vh` 兜底），避免地址栏伸缩时抽屉跳动。
- 实机实测：剧情切换后面板单次刷新 **0.2–0.4 ms**（纯净档与宿主档同口径，断言上限 16 ms）。

> 脚本文件名不要用 `index.js`：它与 DoLGameUI / StoneFreeHost 的 `index.js` 撞名时，本包渲染层会被整段跳过（`core.js` 能跑、`window.MapleLantern` 不存在、无报错）。本包固定为 `core.js` + `render.js`。

- 只读 `window.SugarCube.State.variables`（或 `window.State.variables`）、`window.Time`、`window.Constants`、`Window.StartConfig.version`。
- 不展示 `butt_plug` / `genitals` 两个私密槽位。
- 不提供传送、推进时间、交易、穿戴、战斗操作。
- 单测用 `Proxy` 的 `set` 陷阱证明：开面板、切页签、改设置、取诊断，全程零写入。

## 兼容与降级

- **未装 DoLGameUI**：用自带四主题，功能完整；`html[data-dgu-*]` 反制规则零匹配。
- **装了 DoLGameUI**：只转发 `--dgu-accent` / `--dgu-radius` / `--dgu-card-radius`，并逐类封回被全局按钮规则改写的 padding / min-height。
- **读不到存档字段**：面板仍可打开，显示「读取降级」，不抛错。
- **存储不可用**：设置只在本次会话生效，并提示一次。

## 无障碍

- 面板 `role="dialog" aria-modal="true"`，页签 `role="tablist"` + 左右键 / Home / End，焦点陷阱，`Esc` 关闭。
- 全部主操作区 ≥44px；字号走 `calc(px × --dgu-font-scale × --ml-scale)`。
- 三条零 JS 动效关断：`prefers-reduced-motion`、`html[data-dol-midnight]:not([data-dgu-visualMotion])`、自有 `data-motion="off"`。

## 验证

本轮（2026-11-11，Windows）实测：

- `node --test tests\*.test.js`：**46 / 46 PASS**
- moli 8 case × 5 页签：**249 条断言 PASS / 0 FAIL**，40 张首帧截图
- `check_ui_mod.py`：**13 PASS / 1 WARN / 0 FAIL**（WARN 为「未声明 StoneFreeHost」，属可选接入）
- Edge 隔离 profile 纯净档：`#ml-root` 注入、面板 380×504、orb 56×56、z 89900、0 未捕获异常，**14 项 PASS**
- Edge 隔离 profile 宿主档（Dynamicest 3.3 + StoneFreeHost 0.1.5 + DoLGameUI 4.2.0 + 本包）：**18 项 PASS**，API v1 与 8 个 token 名读取，主题色跟随宿主
- 设置页实测：切主题不重建、剧情推进不冲掉焦点；`backdrop-filter: blur(20px) saturate(1.1)` 在纯净档与宿主档一致
- 剧情切换实战：`Start → Start2`，面板场景同步 `Start2`，单次刷新 0.2–0.4 ms
- 包内 5 个条目，确定性命中（固定 mtime、正斜杠）；SHA256 见 `dist\SHA256.txt`

```powershell
node --test tests\*.test.js
pwsh -NoProfile -File .\pack.ps1
python <dol-ui-design>\scripts\check_ui_mod.py dist\MapleLantern-1.1.1.mod.zip
node tools\game-smoke.js
$env:HOST='1'; node tools\game-smoke.js
```

## 已知限制

- 未在 Android / iOS 真机验证；移动端结论来自 390 / 320 / 844×390 视口模拟与 Edge 桌面渲染。
- 页签条在 `320px + 140% 字号` 下需要横向滚动（内容区不溢出；选中页签会自动滚入视野）。
- 宿主视觉证据来自 Windows + Edge 隔离 profile（Dynamicest + StoneFreeHost + DoLGameUI 四包同装），未覆盖 macOS / Android。
- 身心页仍只展示 5 项（意志 / 压力 / 创伤 / 兴奋 / 疲惫），不纳入 `pain` / `hygiene` / `oxygen`。
