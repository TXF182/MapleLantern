# 灯台 · Lantern（MapleLantern 1.0.0）

Degrees of Lewdity `0.5.12.13` / SugarCube `2.36.1` 的**只读信息台** UI 模组。

- 右下悬浮球（时间环 + 时段火苗），点击或 `Alt+L` 打开五页签面板。
- 此刻 / 身心 / 着装 / 系统 / 设置 五个页签。
- 自动跟随 DoLGameUI 4.x 的强调色与圆角（检测到才跟随，没有就用自己的外观）。
- **不写存档、不改数值、不接管任何第三方业务。**

## 安装

1. 打开游戏，`Alt+M` 呼出 ModLoader。
2. 「添加旁加载 Mod」选择 `MapleLantern-1.0.0.mod.zip`。
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
| 密度 | 舒适 / 紧凑 | 舒适 |
| 动效 | 开 / 关 | 开 |
| 语言 | 自动 / 中文 / English | 自动 |
| 悬浮球位置 | 左下 / 右下 | 右下 |

设置存 `localStorage["MapleLantern.settings.v1"]`；逐字段修复，坏一个字段不会整包丢弃。

## 只读边界

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

- `node --test tests\*.test.js`：**39 / 39 PASS**
- moli 8 case × 5 页签：**249 条断言 PASS / 0 FAIL**，40 张首帧截图
- `check_ui_mod.py`：**13 PASS / 1 WARN / 0 FAIL**（WARN 为「未声明 StoneFreeHost」，属可选接入）
- Edge 隔离 profile 实机：`#ml-root` 注入、面板 380×504、orb 56×56、z 89900、0 未捕获异常
- 包内 5 个条目，确定性命中（固定 mtime、正斜杠）；SHA256 见 `dist\SHA256.txt`

```powershell
node --test tests\*.test.js
pwsh -NoProfile -File .\pack.ps1
python <dol-ui-design>\scripts\check_ui_mod.py dist\MapleLantern-1.0.0.mod.zip
node tools\game-smoke.js
```

## 已知限制

- 未在 Android / iOS 真机验证；移动端结论来自 390 / 320 / 844×390 视口模拟与 Edge 桌面渲染。
- 页签条在 `320px + 140% 字号` 下需要横向滚动（内容区不溢出；选中页签会自动滚入视野）。
- 本机未安装 DoLGameUI，宿主分支只做了契约级模拟（`?host=1`），没有真机视觉证据。
