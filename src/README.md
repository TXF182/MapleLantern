# 灯台 · Lantern（MapleLantern 1.1.7）

Degrees of Lewdity `0.5.12.13` / SugarCube `2.36.1` 的**只读信息台 + 原生 UI 替换层** UI 模组。

- **默认直接替换原版呈现**：顶栏金钱/时间/星期改四格卡片，七行状态数值收进一张状态大卡，正文选项改整行卡片，侧栏按钮、弹层、对话框统一卡片语言。只改呈现，不碰业务数值与存档。
- 原生卡片开关默认**开**；悬浮灯台默认**关**，入口在 `OPTIONS` 弹层顶部「灯台」行，也可用 `Alt+L` 唤起。
- 此刻 / 身心 / 着装 / 系统 / 设置 五个页签；「此刻」页保留时间、金钱、场景与身心速览。
- 自动跟随 DoLGameUI 4.x 的强调色与圆角；**检测到主 UI 时不再关闭本包原生层**（1.1.6 及以前会整层让位，导致 Android 上面板已更新、正文却退回宿主卡片）。
- **默认主题为赛博朋克**：深蓝黑底、青蓝主光、洋红副光、静态网格与霓虹描边；琥珀 / 青瓷 / 石墨 / 星空仍可在设置里切回。
- **主题纹理层**：琥珀为暖金纸纤维 + 斜细纹，赛博为霓虹网格 + 斜线，青瓷为斜丝 + 织纹 + 釉光带，石墨为碳纤交叉纹 + 金属光带，星空为紫蓝星云 + 星点 + 银河带；面板、正文、卡片三层分别落点，原生顶栏 / 弹层 / 状态卡 / 正文同步换纹理。
- **点击/按压反馈**：按钮、页签、分段控件、图标、开关与快捷项按下时轻微下沉提亮；面板内生成短涟漪，松手后自动移除。系统「减少动态效果」或设置关闭动效时不播放，操作仍完整。
- **不写存档、不改数值、不接管任何第三方业务。**
- **1.1.3 热修**：关掉「原生卡片」再开回来时，`OPTIONS` 弹层不再被游戏 `closeOverlay()` 收掉，「灯台」入口保留，页签 `T.tab` 不被清空。
- **1.1.4 主题迭代**：降低琥珀纸纹与石墨碳纤的细线密度，补青瓷开片斜纹、石墨拉丝与星空底部星云；六套主题面板补内缘高光/主题阴影；按压涟漪改为贴合控件的亮环，原生标题栏同步铺纹理。二次增强再补青瓷釉光、石墨金属光带、星空银河带、卡片内缘光与 20px→3.4 倍双层涟漪。
- **整页主题背景**：`html` 承担固定整页纹理，`body` / `#passages` / `.passage` 全部透明；六主题不再只是面板换色。
- **1.1.7 体验收口**：移除“检测到宿主即关闭原生层”的让位逻辑；`native.js` / `native.css` 改为唯一文件名 `maplelantern-native.js` / `maplelantern-native.css`，避免多包同装时通用脚本名被静默跳过；六主题重写高对比度页面纹理（琥珀纸纤维、赛博霓虹网格、青瓷釉面冰裂、石墨拉丝、星空约 70 星点+银河带+十字星芒）；正文选项按压加入下沉、描边与主题辉光。

## 安装

1. 打开游戏，`Alt+M` 呼出 ModLoader。
2. 「添加旁加载 Mod」选择 `MapleLantern-1.1.7-theme.mod.zip`；已装 1.1.4/1.1.5/1.1.6 旧包时直接覆盖同名技术身份。
3. 刷新页面。安装后无需重启游戏。

> 直接把 zip 复制进 `game\` 目录**不等于安装**：玩家侧 Mod 来自 `file://` origin 的 IndexedDB。

## 入口

| 入口 | 行为 |
|---|---|
| `OPTIONS` 弹层顶部「灯台」行 | **默认形态**下打开悬浮灯台面板；不改变游戏设置 |
| 右下悬浮球 | 仅在设置里打开「悬浮灯台」后显示；单击开合；拖动超过 6px 视为移动，不触发开合 |
| `Alt+L` | 开合灯台面板（输入框内不抢键） |
| `Esc` / 外部点击 / 抽屉下滑 >64px | 关闭 |

移动端（`≤560px` 或高度 `≤520px`）自动改为底部抽屉，打开时悬浮球让位，关闭后焦点交还游戏正文。

## 设置

| 项 | 范围 | 默认 |
|---|---|---|
| 原生卡片 | 开 / 关 | **开** |
| 悬浮灯台 | 开 / 关 | **关** |
| 主题 | 自动 / 赛博朋克 / 琥珀 / 青瓷 / 石墨 / 星空 | 赛博朋克 |
| 字号 | 80–140%，5% 步进 | 100% |
| 通透度 | 0–100，5% 步进 | 60 |
| 密度 | 舒适 / 紧凑 | 舒适 |
| 动效 | 开 / 关 | 开 |
| 语言 | 自动 / 中文 / English | 自动 |
| 悬浮球位置 | 左下 / 右下 | 右下 |

设置存 `localStorage["MapleLantern.settings.v1"]`；逐字段修复，坏一个字段不会整包丢弃。

通透度只改**表面遮蔽 / 模糊 / 边缘层次**三项，不改文字与按钮透明度；0 更沉稳、100 更通透。关掉玻璃模糊后再开，数值保留；「通透度回 60」只重置这一项。

## 原生 UI 替换层（1.1.7）

只挂标记与属性，不重建原版节点、不改原版事件，因此游戏推进/读档/换装时不会与 SugarCube 抢同一段内容。

| 原版位置 | 标记 | 呈现 |
|---|---|---|
| `#stats .centered-elements` 四块 | `data-ml-chip=toggle/money/time/day` | 四格：开合 / 金钱 / 时间 / 星期；金额整数补 `.00`，数字用等宽数字 |
| `#mobileStats` 左轨 | 无标记，CSS | 32px 宽度不变；28×36 胶囊，每格 2px 左侧状态色条，标签下方再加 24×5 数值条（深青轨道 + 当前值填充），字号 12.5 / 字重 700 / 文字描边提升暗底可读性；时间块 60px 高并带金棕强调 |
| `#statmeters` 七行 | `data-ml-stat-card` + `data-ml-stat-key` + `data-ml-value/current/percent/total/readout` | **一张状态大卡**：7 行「标签 + 长条 + 右侧 当前/上限」，上限读 `State.variables.*max`，缺失才回退常量；整卡随侧栏滚动 |
| `#passages a.link-internal.macro-link` | `data-ml-option="1"`；有前置 `img.icon` 时加 `data-ml-option-group="1"` | 整行卡片，序号与时耗保持原文本，不重写 passage；「图标 + 选项」收进同一张 `ml-option-group` 卡，图标 30px 在左、文字在右，并摘掉组前空行；无图标选项保持整行卡 |
| `#overlayButtons` / `#menu` 按钮 | 双 ID 反制 + `data-ml-label` | 两列卡片按钮，≥44px；`sidebarButtonSplit` 拆平为 `display:contents`，清掉原版占格 `<br>`，8 个入口四行对齐，`JOURNAL` / `OPTIONS` 不再退省略号 |
| `#customOverlay` / `#ui-dialog` | `data-ml-overlay` / `data-ml-dialog` | 圆角外壳、固定 48px 上下留白、单轴滚动、44×44 关闭按钮 |
| `#customOverlayTitle` / `#overlayTabs` | 无标记，纯选择器 | 标题栏按页签自动增高，5 个页签换行不裁切；`OPTIONS` 的 Date Format 三段等宽胶囊、分隔符不占宽 |
| `#customOverlayContent` 内层 | 无标记，纯选择器 | `settingsGrid` 分节卡片、`settingsToggleItem` 行、自绘 checkbox/radio、`select` 与段落/表格统一配色；`statistics` 下 11 个 `.foldout` 改折叠卡，展开体按「标签 : 值」拆成两栏行并带 160ms 逐行淡入；`gameFeats` 顶部科普包成 `data-ml-feats-intro` 说明卡 |
| `#ui-bar` 320px 极窄档 | 无标记，`@media (max-width:340px)` | 抽屉宽 248px、收起位移 -216px，箭头回到屏内；金钱/时间/星期不截断 |
| 衣柜内层（`Wardrobe`） | `data-ml-option` + `tidySeparators` | warmth 50px 条压成 16px 圆角条，温度说明独立卡；`Close wardrobe` / `Strip all` 等动作两列，裸 `\|` 全清；`#listoutfits` 双列、四张 outfit 卡左对齐等宽 |
| 商店目录（`Clothing Shop`） | `markShopCats` | 15 组「图标 + 文字」收进两列胶囊卡，去掉原版 `<br><br>` 撑出的断行；warmth / 说明卡与衣柜同材质 |
| 商店列表（`View All` 等） | `markShopCats` + `markEmptyDetails` + `tidyShopText` + `markShopTools` | `Back to shop` 取消原版绝对定位与气泡描边，回到正常流；分类图标去斜切、44×44 方卡；商品行成网格卡：48×48 图标 + 名称 + 右上价签胶囊 + 三行 stats-ball；空 `.clothing-details` 隐去；中文环境把原版硬编码 `Filters` / `Opt.` / `Legend` 换成「筛选 / 选项 / 图例」，已本地化的原文保持不动 |
| `SAVES` 弹层 | `markSaveRows` | 去掉 `&nbsp;` 后判定空槽：隐藏名称/详情，槽位号与保存/读取/删除同排，行高 46px；非空行保留两行详情。底部 `saveMenuButton` 与行内保存/读取按钮跨主题统一，`全部删除` 保留红色危险语义 |

- 让位：`window.DoLGameUI.ui.apiVersion === 1 && getCapabilities().enabled` 时不挂 `data-ml-native`，并清掉全部标记/入口，恢复原版。
- 零轮询：无 `setInterval`、无 MutationObserver；只在 `:passageend`、`#overlayButtons` / `#menu` / `#customOverlay` / `#passages` 的点击捕获和设置切换时重扫，单飞 rAF，点击后 0 / 150ms 各补扫一次（等游戏异步换 DOM）。
- 动效：仅 `transition` / 入场 `opacity + translateY`，尊重 `prefers-reduced-motion`、宿主 `data-dol-midnight:not([data-dgu-visualMotion])` 与本包 `data-ml-motion="off"`。

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

- **未装 DoLGameUI**：用自带六主题（赛博朋克 / 琥珀 / 青瓷 / 石墨 / 星空），功能完整；`html[data-dgu-*]` 反制规则零匹配。
- **装了 DoLGameUI**：只转发 `--dgu-accent` / `--dgu-radius` / `--dgu-card-radius`，并逐类封回被全局按钮规则改写的 padding / min-height。
- **读不到存档字段**：面板仍可打开，显示「读取降级」，不抛错。
- **存储不可用**：设置只在本次会话生效，并提示一次。

## 无障碍

- 面板 `role="dialog" aria-modal="true"`，页签 `role="tablist"` + 左右键 / Home / End，焦点陷阱，`Esc` 关闭。
- 全部主操作区 ≥44px；字号走 `calc(px × --dgu-font-scale × --ml-scale)`。
- 三条零 JS 动效关断：`prefers-reduced-motion`、`html[data-dol-midnight]:not([data-dgu-visualMotion])`、自有 `data-motion="off"`。

## 验证

本轮（2026-11-12，Windows）实测：

- `node --test tests\*.test.js`：**83 / 83 PASS**（含主题纹理三层落点、按压涟漪、双主题入口、宿主存在仍挂载原生层、1.1.7 整页背景/星场/按压契约、同层双图标优先可见场景图）
- 真实 `Lake Shore`（390×844，Edge 隔离 profile，宿主 DoLGameUI 4.2.0 启用，1.1.7 包）：**4 个选项全部为 `.ml-option-group`**，卡片高 44px、组间距 48px；两个 `img.icon` 装饰层均已进入卡内；`html` 背景 `rgb(5,8,19)` + 82 层星场、`backgroundAttachment=fixed`，`body` 与 `#passages` 均透明
- 真实正文按压：`pointerdown` 后 `pressed:true` / `ring:true`，`mln-press-ring` 出现在卡片内
- 8 个侧栏入口逐页走查：**CHARACTERISTICS / SOCIAL / TRAITS / JOURNAL / STATS / FEATS / OPTIONS / SAVES**，8/8 `clicked:true`、`overlayHidden:false`、`errors:[]`；OPTIONS 页灯台入口保留
- `check_ui_mod.py`：**13 PASS / 1 WARN / 0 FAIL**（WARN 为「未声明 StoneFreeHost」，属可选接入）
- Edge 隔离 profile 纯净档：`#ml-root` 注入、面板 380×504、z 89900、0 未捕获异常，**18 项 PASS**
- 宿主档（DoLGameUI 4.2.0 启用）：**23 项 PASS**，含「宿主下原生层仍按玩家开关挂载」、宿主 token 已读、面板仍 380×504
- 原生按钮关→开回归：`NATIVE_OFF` / `NATIVE_ON` 均 `overlayHidden:false`、`entryCount:1`、`ttab:true`，随后点 Theme 页签无 `<<toggleTab>>` 报错
- 1.1.4 阶段留存的六主题原型截图：6/6 面板 380×620；按压涟漪实测 `ring:true`、空心主题色亮环不遮字
- 设置页实测：切主题不重建、剧情推进不冲掉焦点；`backdrop-filter: blur(20px) saturate(1.1)` 在纯净档与宿主档一致
- 剧情切换实战：`Start → Start2`，面板场景同步 `Start2`
- 包内 7 个条目，确定性命中（固定 mtime、正斜杠）；`70 KB` 量级，SHA256 见 `dist\SHA256-1.1.7-theme.txt`

```powershell
node --test tests\*.test.js
pwsh -NoProfile -File .\pack.ps1
python <dol-ui-design>\scripts\check_ui_mod.py dist\MapleLantern-1.1.7-theme.mod.zip
node tools\game-smoke.js
$env:HOST='1'; node tools\game-smoke.js
```

## 已知限制

- 未在 Android / iOS 真机验证；移动端结论来自 390 / 320 / 844×390 视口模拟与 Edge 桌面渲染。
- 页签条在 `320px + 140% 字号` 下需要横向滚动（内容区不溢出；选中页签会自动滚入视野）。
- 宿主视觉证据来自 Windows + Edge 隔离 profile（Dynamicest + StoneFreeHost + DoLGameUI 四包同装），未覆盖 macOS / Android。
- 身心页仍只展示 5 项（意志 / 压力 / 创伤 / 兴奋 / 疲惫），不纳入 `pain` / `hygiene` / `oxygen`。
