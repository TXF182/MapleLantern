# 灯台 1.5.1 计划书：绿茵主题 + 主题边饰（含删除石墨）

- 版本目标：**1.5.1**（三源同步：`src\boot.json` / `src\core.js` / `src\dossier-core.js`）
- 基线：1.5.0（包 183,503 B / 15 条目 / SHA256 `b9c8eaff…e28109`；测试 9 文件 237 断言；`check_ui_mod.py` 14 PASS / 1 WARN）
- 本文只写方案与判据，不写实现细节以外的承诺；所有数字实施时以实际输出复核。

---

## 0. 决策摘要

| 项 | 决定 |
|---|---|
| 新功能一 | **主题边饰**：正文区四边装饰层（A 档），每套主题一种符号语言，随主题切换，可总开关 |
| 新功能二 | **绿茵主题**（`grass`）：阳光草场浅色档，割草条纹 + 斑驳阳光 + 球场白线；组件边缘青色描边 |
| 删除 | **石墨主题**（`graphite`）：全链移除，旧设置值回退到默认主题并打 `repaired` 标记 |
| 不做 | 改字体文件 / 内嵌字体 / 换字体栈；边饰动画；`auto` 档专属边饰 |
| 交付形态 | 仍为单包 `.mod.zip`，体积增量预算 ≤ 25 KB（不含发布/装机动作，发布需当轮明确指令） |

---

## 1. 绿茵主题规格

### 1.1 色板（core.js `PALETTES.grass`，13 token）

| token | 值 | 用途 |
|---|---|---|
| bg | `#E6F0D4` | 阳光草底 |
| bgSoft | `#DDE8C6` | 面板底 |
| bgRaise | `#F4F9E9` | 卡片/浮层 |
| text | `#20301A` | 正文（深橄榄墨） |
| muted | `#5A6A47` | 次要文字 |
| faint | `#7D8C6B` | 弱提示 |
| accent | `#2F6B2B` | 主按钮/高亮 |
| accentInk | `#F6FBEE` | accent 上的字 |
| line | `rgba(32,48,26,.18)` | 常规分隔 |
| jade | `#3F8F5B` | 正向 |
| rose | `#B8603A` | 警示暖调 |
| danger | `#AE3A28` | 危险 |
| **edge** | `rgba(27,122,110,.34)` | **新增 token**：组件默认描边（青绿） |
| **edgeStrong** | `rgba(20,138,124,.62)` | **新增 token**：hover/聚焦/按下描边 |

> `edge` / `edgeStrong` 为全局新增 token，其余主题不定义，默认回落 `--mln-border` / `--mln-border-strong`（CSS 里写成 `var(--ml-edge, var(--mln-border))`），保证不破坏旧主题。

### 1.2 三处质感（全部纯 CSS，零图片）

1. **割草条纹**：横向 `repeating-linear-gradient`，明条 `#F0F7E1` / 暗条 `#DFEACA`，周期 56px，明暗差 4–5%；只铺页面/正文底，不铺卡片。
2. **斑驳阳光**：右上角 `radial-gradient(#FFE9A8 @ .10 → transparent)` 一层，只挂面板与页面层，不压正文文字对比度。
3. **球场白线**：边饰语言（见 §2）；组件不再用白线。

### 1.3 组件边缘（青绿规则）

- 卡片/浮层：`1px edge` 描边 + 青调阴影 `0 6px 18px rgba(18,80,72,.10)`（不用灰阴影）。
- 按钮：默认 `edge`，hover/聚焦 `edgeStrong` + 1px 内发光；按下只 `scale`（沿用既有纪律，禁止 translateY）。
- 输入框、开关轨道、页签选中态：同一条 `edge` 规则。
- 主按钮仍是 accent 草绿底，外圈补 `edgeStrong` 钩边。

### 1.4 落位文件

| 文件 | 内容 |
|---|---|
| `core.js` | `THEMES` 追加 `grass`；`PALETTES.grass`；zh/en 文案 `theme.grass`（绿茵 / Meadow） |
| `render.js` | 设置页主题分段按钮追加 `{ value:"grass", label:s["theme.grass"] }` |
| `style.css` | `#ml-root[data-theme="grass"]` 面板 token 块（含 `--ml-edge*`、`--ml-tex-panel/body/card`、按压辉光） |
| `effects.css` | `#ml-root[data-theme="grass"]` 环境层变量块（ambient/veil 两组，色取草绿+青） |
| `maplelantern-native.css` | `html[data-ml-native="on"][data-ml-theme="grass"]` 原生 token 块 + 各层 texture + 割草条纹/阳光光晕 |

---

## 2. 主题边饰规格（A 档：正文边缘）

### 2.1 架构（须先过可行性探针）

- **不能挂在 `#passages` / `#passages .passage` 的 background**：`maplelantern-native.css:4578` 对二者有 `background: transparent !important` 清空规则。
- 采用**伪元素边框层**：`#passages{position:relative}` + `#passages::before` 绝对定位 `inset:0`、`border:12px solid transparent`、`border-image: url(data:image/svg+xml,…) <slice> repeat`、`pointer-events:none`、`opacity: var(--mln-orn-a)`。
- 标题枝：`#passages .passage h1::after` 横向 SVG（`background-size:100% 14px`，底对齐）；无标题 passage 不出枝。
- **不得**新增 DOM 节点（SugarCube 每次换 passage 会替换 `#passages` 子节点）；CSS-only 为主。
- 防压字：边饰开启时给 `.passage` 加 `padding-inline: 10px`（唯一布局变化，需实测文本宽度与 `scrollWidth`）。
- 小屏（≤600px）：左右竖边收窄到 8px、上下端花压缩到 16px；≤420px 只留标题枝（防压字）。
- 装饰层 `z-index:0`，不覆盖交互元素；选项/按钮点击实测不受影响。
- 无动画、无 filter、无 `background-attachment:fixed`。

### 2.2 每主题一套语言（只换图案与色，骨架一致）

| 主题 | 语言 | 用色 token | SVG 要点 |
|---|---|---|---|
| cyberpunk | 电路走线 + 数据断点 | accent `#00E5FF` + rose 节点 | 折线、无叶、节点小圆 |
| amber | 古籍角花 + 金线卷草（只做四角） | accent `#E3B25F` | 角花 + 短卷草，中段留空 |
| jade | 青花缠枝莲（唯一保留的藤） | jade `#7FD6C5` | 圆润白描、大间距 |
| star | 星座连线 + 四角星 | 线 muted，星 accent `#8FA6FF` | 细连线 + 星点 |
| fog | 铁艺浪花 + 缆绳结 | jade `#79C9BE` + accent 钩 | 曲线、卷浪 |
| school | 横格本线 + 便签胶带角 | jade 线 + accent 胶带 | 平行横线 + 斜胶带 |
| paper | 毛笔飞白 + 卷轴锦边 + 朱印点 | jade 墨绿 + accent 朱红 | 断续笔触 + 印点 |
| grass | 球场白线 + 三笔草穗 | 白线 `#FFFFFF` + 深绿内描 `rgba(32,48,26,.35)`；草穗 jade | 边线 + 罚球弧 + 草穗 |
| auto | **随 cyberpunk**（1.5.1 实测修正：`maplelantern-native.js:100` 把 auto 解析为 cyberpunk 色板，不存在“auto 专属变量”；原计划的“不挂”无法实现且与色板不一致） | cyberpunk 同 | — |

### 2.3 总开关

- `state.settings.ornament`（默认 `true`），写入现有 `MapleLantern.settings.v1`，坏值逐字段修复。
- 关闭时 `html[data-ml-orn="0"]`，边饰层 `display:none`，`.passage` 的 `padding-inline` 一并回零（不得留 10px 空档）。
- 设置页位置：主题选择下方一行开关。

### 2.4 体积与性能预算

- 单主题 SVG ≤ 1.5 KB（minify、`utf8` data URL），8 套 ≤ 12 KB。
- 新增 CSS 文件 `src\ornaments.css`（≤ 4 KB），加入 `boot.json.styleFileList`（`styleFileList` 5 条）。
- 长 passage 滚动（≥ 3000px 内容）在 390×844 视口无掉帧级卡顿（静态背景，无 will-change）。

---

## 3. 删除石墨（`graphite`）

### 3.1 代码改动点（已 grep 全量，共 7 文件 16 处）

| 文件 | 位置 |
|---|---|
| `core.js` | `THEMES`(:19)、`PALETTES.graphite`(:50)、zh 文案(:141)、en 文案(:211) |
| `render.js` | 设置页选项(:1060) |
| `style.css` | 主题块(:152)、`.ml-panel`(:1657)、`.ml-mark`(:1679) |
| `effects.css` | 主题变量块(:321 / :430)、`.ml-ambient::before`(:621) |
| `maplelantern-native.css` | 原生 token 块(:143) |
| `tests\contract.test.js` | :111 / :496 / :772 / :791 / :802 |
| `tests\core.test.js` | :244 |
| `tests\dom.test.js` | :388（点击 graphite 按钮，改为 grass） |

### 3.2 迁移语义

- 旧 `localStorage` 值 `theme:"graphite"` 不在新 `THEMES` 内 → 现有 `parseSettings` 走 `repaired=true` 并回落 `DEFAULTS.theme`（`cyberpunk`）。**必须有专门测试**：写入 graphite → 读回 cyberpunk + `repaired`。
- 原生层 `data-ml-theme` 随 state 写，旧值不会残留。
- 不做"迁移到最相近主题"的猜测（石墨 ≠ 别的主题）。

### 3.3 文档

- 根 `README.md:111`、`src\README.md` 的当前特性清单、矩阵表（:125）、对照段（:181）删石墨，主题数改「八套」→ 加绿茵后仍为**八套**（赛博/琥珀/青瓷/星空/雾港/旧校舍/纸灯/绿茵）。
- `src\README.md` 历史版本章节（:54 / :72 / :96 / :98）里的"石墨"属历史事实，**保留不改**。
- `docs\FUNCTION-MATRIX.md` / `docs\KNOWLEDGE-GRAPH.md` 同步主题条目。

---

## 4. TDD 顺序（红 → 绿）

1. **红**：`tests\contract.test.js`
   - 主题表 = `["auto","cyberpunk","amber","jade","star","fog","school","paper","grass"]`，且不含 `graphite`。
   - `PALETTES` 每个主题 11 基色齐全；`grass` 存在且值等于计划书表。
   - `theme.grass` zh/en 文案存在。
   - 边饰注册表：8 条目（不含 auto），每条含 `edge` / `title` 两个 data URL、`opacity` ∈ (0,.6]、不含 `:has`、不含 `@keyframes`。
   - `#passages::before` 边框层规则存在、`pointer-events:none`、无 `translateY`。
   - `html[data-ml-orn="0"]` 关闭规则存在且 `display:none`。
   - 小屏断点规则存在（≤600 / ≤420）。
2. **红**：`tests\core.test.js` 石墨迁移用例；`tests\dom.test.js` 点绿茵按钮生效 + 开关切边饰。
3. **绿**：按 §1.4 / §2 改 `core.js`、`render.js`、`style.css`、`effects.css`、`maplelantern-native.css`，新增 `ornaments.css`，改 `boot.json`。
4. **红→绿**：全量 `node --test tests\*.test.js`，允许临时并行分组（4 组），覆盖率/断言数不得减少。

---

## 5. 验收矩阵

| 层 | 命令/方法 | 通过标准 |
|---|---|---|
| 单元+契约 | `node --test tests\*.test.js` | 9 文件全绿，断言数 ≥ 237 且新增用例全绿 |
| 包结构 | `python …\dol-ui-design\scripts\check_ui_mod.py dist\<新包>.zip` | exit 0；PASS 数不低于 14，WARN 逐条解释（预期仍为 `DoLGameUI` 消费者 1 条） |
| 打包 | `pwsh -NoProfile -File .\pack.ps1` | 确定性 zip（mtime 1980 / 正斜杠）、`dist\SHA256.txt` 与包一致 |
| 宿主装配 | `pwsh -NoProfile -File tools\host-probe.ps1` | 四个全局存在、版本对齐 boot、card 六键 + bg 键存在 |
| 实机安装 | playwright-core 探针走 `mce-mod-import.html` → file:// IDB → 游戏 | 版本双源、`data-ml-native="on"`、`data-ml-orn` 默认 1、pageerror 0 |
| 视觉-桌面 | 1280×800 截图 | 八主题各一张：正文可读、边饰不压字、无横向溢出 |
| 视觉-移动 | 390×844 触摸探针 | `scrollWidth == 390`；选项按钮命中区 ≥ 44px；边饰层不拦截点击；面板 / 四格无溢出 |
| 对比度 | 脚本读 computed 色值算 WCAG | 正文 ≥ 7:1，次要文字 ≥ 4.5:1；装饰线不承载文字（不参与判定） |
| 滚动性能 | 3000px+ passage 滚动采样 | 无长任务 > 100ms，无掉帧级卡顿（静态 SVG） |
| 玩家路径 | 侧栏「灯台」入口 / 悬浮球 / 选项页 | 逐条标注实测结果，不写"应该没问题" |

---

## 6. 风险与处置

| 风险 | 处置 |
|---|---|
| 伪元素边框层压字或改变行宽 | `.passage` padding-inline 10px + 实测段落宽度；超限改用「只在 gutter 显示、中段断开」 |
| `#passages` 已有绝对定位子元素，加 `position:relative` 引发错位 | 先做 5 分钟可行性探针（临时 CSS 注入实机页，量 3 类 passage），确认再全量落 |
| 旧 WebView 不支持 `border-image` 的某些写法 | 只用 `border-image-source/slice/repeat` 基础形态；不支持时装饰缺席、正文不受影响（退化即关闭） |
| 浅底绿茵边饰抢正文 | 白线用「白 + 深绿内描」双线，opacity 上限 .42；正文对比度脚本复验 |
| 石墨用户切主题后困惑 | 设置页不再出现石墨；回落默认主题，不弹提示（避免打扰） |
| 边饰跟随 auto 时段闪烁 | 不成立：auto 的 `data-ml-theme` 恒为 cyberpunk（native.js:100），边饰颜色静态、不随时段变化；文案已改 |
| 包体积膨胀 | SVG ≤1.5KB/套、CSS ≤4KB；打包后体积增量 ≤ 25KB，超预算先减套数再看 |

---

## 7. 里程碑（标注并行点）

| # | 内容 | 并行？ |
|---|---|---|
| M0 | 基线快照：`git status` + 涉及文件 SHA256 存 `%TEMP%` | 串行前置 |
| M1 | 可行性探针：实机注入临时 CSS，验证 `#passages` 伪元素边框层不与交互/定位冲突 | 与 M2 并行 |
| M2 | 契约红测试（主题表 / 色板 / 边饰注册表 / 迁移） | 与 M1 并行 |
| M3 | 绿茵主题落位（5 文件） | 与 M4 并行 |
| M4 | 边饰 SVG ×8 生成 + `ornaments.css` + 开关 | 与 M3 并行（共用契约同样例） |
| M5 | 删除石墨（代码 7 文件 + 测试 3 文件 + 文档） | 与 M3/M4 可并行，但须最后跑全量 |
| M6 | 全量测试 → host-probe → 打包 → check_ui_mod | **串行**（依赖产物） |
| M7 | 实机安装探针 + 桌面/移动截图 + 对比度脚本 | 串行（依赖新包） |
| M8 | 文档同步（README / 矩阵 / 知识图谱 / src\README） | 可与 M7 并行 |
| M9 | 交付（三份清单）；**发布需当轮明确指令** | 串行 |

---

## 8. 交付时必附三份清单（项目纪律）

1. **改动点补丁清单**：文件 / 功能 / 键逐项 + ✓/✗。
2. **验证层清单**：单元、契约、包结构、打包、宿主、实机、视觉、移动、对比度、性能逐层状态，禁止一句"全绿"。
3. **玩家路径走查**：侧栏入口、悬浮球、选项页、主题切换、边饰开关逐条实测结果。

---

## 附：常用命令

```powershell
# 全量测试
node --test tests\*.test.js
# 包结构
python "C:\Users\27352\Doubao\skills\dol-ui-design\scripts\check_ui_mod.py" "dist\MapleLantern-1.5.1.mod.zip"
# 打包
pwsh -NoProfile -File .\pack.ps1
# 宿主装配
pwsh -NoProfile -File tools\host-probe.ps1
# 游戏级冒烟（在 DoL-Project 根）
.\real_smoke.ps1
```

> 注：`#passages` 的 `background: transparent !important`（native.css:4578）、SugarCube 换 passage 替换子节点、`data-ml-theme` 挂在 `html` 三条是实现边饰时必须遵守的既有事实；任何一条变化都要回来改本节。

---

## 9. 追加：正文文字色（同版本 1.5.1）

**范围**：只改故事正文与标题；选项按钮、状态读数、侧栏、面板不参与。
**数据**：`textColor` = `auto` | `#rrggbb`；默认 `auto`；非法值净化回 `auto` 并 `repaired=true`。
**预设**：不写死色表，按当前主题从 accent / jade / rose / danger 里筛，逐色对主题 `bg` 算 WCAG，≥4.5:1 才成为色点；绿茵的 jade 3.36:1 因此被自动剔除。
**自定义**：原生取色器，落值前校验；不合格提示且不写。换主题时旧色若新底色不达标，回落 `auto` 并提示，不留悬挂值。
**落值**：`--mln-text-custom` + `html[data-ml-text="custom"]`，仅 `#passages` / `.passage` 使用；不覆盖 `--mln-text`，避免染到按钮与读数。
**验收**：八主题预设全部 ≥4.5:1；绿茵白字被拒；自定义 `#2f6b2b` 生效；换主题回退；实机 3 项（落正文、不波及选项、可撤回）。测试 246/246。
