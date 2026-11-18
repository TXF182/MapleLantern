# 灯台 · MapleLantern

Degrees of Lewdity `0.5.12.13` 的只读信息台 + 原生 UI 替换层。只改呈现，不碰游戏数值与存档写入。

当前版本：**1.3.8**（孩子详情恢复原版正文色，不再继承主题青蓝；保留 1.3.7 手机滚动期摘模糊。）

## 1.3.8 重点

- **孩子详情配色回归原版**：`src\maplelantern-native.css` 新增 `html[data-ml-native="on"] #passages .passage .childDetails { color: var(--100, #eee); }`。此前主题正文色 `var(--mln-text)` 会透过 `#passages .passage` 继承到孩子详情，`类型：雌性哈比` 的值被染成 `#E6F7FF`；现在 `.childDetails` 内的类型值与活动描述恢复原版 `#eee`，`Type:` 的金色标签、姓名输入框与图标配色不变。
- **测试**：新增 `1.3.8：孩子详情沿用原版正文色，不再继承主题的青蓝`，断言恢复 `--100` 且不再出现 `--mln-text`；全量 **131 / 131 PASS**。

## 1.3.7 重点

- **手机面板滚动期关闭模糊**：≤899px 时，面板滚动窗口内加 `data-scrolling="1"`，`backdrop-filter: none !important`；`render.js` 在 `body` 与 `window` 上各挂一个 `{ passive: true }` 滚动监听，停止滚动 160ms 后摘标记恢复完整玻璃。桌面断点不启用，静止时材质不变。
- **实测**（Edge 无头 390×844 DPR2、`--disable-gpu`、CPU 4x、`--disable-frame-rate-limit`；真实 1.3.7 包，5 轮）：面板滚动 **3.07–3.77ms，均值约 3.40ms**（1.3.6 同环境 3.63–5.18ms）；单变量 A/B（注入规则）基线 `3.69 / 3.38 / 4.97ms` → 滚动期关模糊 `3.15 / 2.92 / 2.40ms`，约省 **20–35%**。页面滚动 1.32–2.04ms（首轮冷启 7.25ms），与 1.3.6 的 1.19–1.93ms 同区间，无回退。
- **实时状态已验**：滚动中 `data-scrolling="1"` 且 `backdropFilter: none`；停止 260ms 后属性被摘除、恢复 `blur(12px) saturate(1.1)`。
- **否决项**：把 `html` 固定背景改到 `body::before` 固定底层（`z-index:-1` + `will-change:transform`）实测 TaskDuration `250.3 / 187.8 / 122.8ms`，全面高于基线 `188.1 / 154.6 / 115.2ms`，不采用；`background-attachment: fixed` 保持原样。

## 1.3.6 重点

- **手机端环境层二次瘦身**：≤600px 在 1.3.5 的“整体静态”基础上，再隐藏 `.ml-ambient__veil` 和 `.ml-ambient::before` / `::after` 两条主题光带，粒子 `nth-child(n + 4)` → `nth-child(n + 3)`，只留 2 颗。剩余绘制为静态天空层 + 2 颗静态粒子；桌面/平板动画与光带不变。
- **实测**（Edge 无头 390×844 DPR2、`--disable-gpu`、CPU 4x、`--disable-frame-rate-limit`，5 轮；去冷启首轮）：页面滚动 **5.54–8.78ms，均值 6.66ms**（1.3.5 约 13.05ms）；强制可滚动面板 **12.26–15.16ms，均值 13.16ms**（1.3.5 约 14.54ms）。关 ambient 约 5.4–7.5ms，页面已基本贴住这个下限。
- **保留项**：星空/auto 夜晚的静态星场、天光、2 颗粒子仍可见；面板打开时 ambient 仍整层不绘制；桌面/平板不启用这套手机端降载。

## 1.3.5 重点

- **星空页底瘦身**：`--mln-page-texture` 从 84 个渐变（87 层含 3 个 `html` 底色层）压到 6 个基础渐变，`html` 总层数 9；星点交给天空层 `--ml-sky-dust` 的 2 条平铺星尘（220/280px 重复），星空主题与 `auto` 夜间启用。渲染层数降一个数量级，星场仍覆盖全屏。
- **手机端环境层降载**：≤600px 粒子 5→3；环境层整体 `animation:none` + `will-change:auto`，`inset:-6vmax` 收到 `0`；面板打开时 `#ml-root[data-open="1"] .ml-ambient` 直接 `display:none`，滚面板不再为背景层付费。桌面与平板保持原动画。
- **面板与 CE 模糊下调**：≤899px 面板模糊由 JS 封顶 `12px`（`--ml-blur` 是 inline 写入，CSS 覆盖无效，必须在 `applySettings()` 压）；`resize` 后重算，旋转不会停在旧断点。CE `.dol-shadow` 从 `blur(10px)` 收到 `blur(6px)`。
- **实测**（Edge 无头 390×844 DPR2、`--disable-gpu`、CPU 4x、`--disable-frame-rate-limit`，3 轮）：页面滚动 1.3.4 基线 18.5–24.3ms → 1.3.5 中位 13.05ms（区间 12.56–21.83ms）；强制可滚动面板 1.3.4 基线 21–24ms → 1.3.5 中位 14.54ms（区间 13.58–18.22ms）；关 ambient 仍为 5.4–7.7ms，说明剩余成本是静态大层而非动画。无头软件渲染只作同向对比，不代表真机绝对值。

## 1.3.4 重点

- **新增天空层**：`div.ml-ambient__sky[data-layer="sky"]` 作为环境层第 10 个节点，放在 8 颗粒子与慢流之后；顶部天光底负责整幅天色与星场，下缘地平光负责空白区的“天”形，斜向极光带保持 104° 慢流。全部只动 `transform/opacity`，不新增 JS 计算。
- **星空主题**：星点从 12 颗增至 14 颗并整体提亮，390×844 截图已有明显星场；`auto` 夜间另补 6 颗，白天不出现星点。
- **四时段天光**：`auto` 的 `dawn/day/dusk/night` 各补 `--ml-sky-a/b/c/c2`，黎明暖橙、白天蓝白、黄昏橙粉、夜晚蓝青；天空层 `--ml-sky-opacity` 为 `.62`，九主题独立（赛博 `.58`、琥珀 `.56`、青瓷 `.48`、石墨 `.36`、星空 `.68`、雾港 `.70`、旧校舍 `.40`、纸灯 `.36`）。旧地平光与 108° 天光带也改吃同一组变量，夜里不会留一条固定暖橙。
- **动效与关断**：新增 `ml-sky-glow` / `ml-sky-ribbon` 两条 keyframes，30–44s 低速往返；`data-motion="off"`、`html[data-ml-motion="off"]`、`prefers-reduced-motion: reduce` 仍整层 `display:none`。面板打开时环境层照旧降 55%，天空层随父层一起降。

## 1.3.3 重点

- **顶栏两行网格**：不再用四列定宽硬塞。`28px / minmax(0,1fr) / 64px` 三列，开关跨两行并竖直居中；第一行金额 + 时间（时钟图标与 `09:06` 同排），第二行日期整行。280 宽下日期格从 44px 扩到 233px，216 宽下仍有 169px，`星期日 9月4日` 与 `£9,474.99` 均不裁切。
- **日期识别兜底**：翻译包改写日期图标路径时，`markStats()` 仍能按 `ml-src` / `ml-replaced-src` 或中文星期文本标记 `data-ml-chip="day"`，不再漏掉日期格导致 flex 回退、开关单独换行。

## 1.3.2 重点

- **模组作弊层全宽**：原版 `@media (max-width:870px) .customOverlay { left:-17.6em }` 在灯台把 `#customOverlayContainer` 改成全视口 fixed 后，会把 CE 层整体左移 281.6px。`<=899px` 把 `#customOverlay` 的 `left/right` 归零，540 视口下 CE 层从 `x=-281.6 / right=242.4` 恢复到 `x=0 / right=524`，360 视口 `x=0 / right=344`；内容不再只占左半屏。
- **侧栏展开时弹层不被一起隐藏**：`#customOverlayContainer` 由 PassageFooter 渲染，可能落在 `#passages` 子树内。`<=560px` 侧栏展开时给容器补 `visibility:visible` / `pointer-events:auto`，避免 `#story` 的抽屉隐藏把作弊层一起吞掉。

## 1.3.1 重点

- **1.3.1 手机尺寸适配**：侧栏抽屉阈值 430→560，540 级视口展开侧栏也隐藏正文；面板左右 `max(safe-area, 8px)`、320 级 6px，844×390 横屏抽屉限宽 560px 居中；≤360 圆环 88px、正文 12px 内边距。320/360/390/430/540/844×390 六档均不越界、页签 44px、无横向溢出。
- **1.3.1 特效增强**：九主题环境层提亮 + 整幅 `veil` 慢流（34–46s，仅 transform）；`auto` 按 `data-phase` 黎明/白天/黄昏/夜晚换环境色，并加 `ml-sky-band 26s` 斜向天光带；雾港环境层 `1.0` / veil `.44`。手机 ≤600px 仍 5 颗粒子 + veil，面板打开降 55%，三路关断与系统减少动态不变。

## 主要特性

- **默认赛博朋克主题**：深蓝黑底、青蓝主光、洋红副光、静态网格与霓虹描边；设置内可切回琥珀 / 青瓷 / 石墨 / 星空 / 雾港 / 旧校舍 / 纸灯。
- **新增三套主题（1.3.0）**：雾港为冷青雾面 + 暖金雾灯，旧校舍为旧木褐 + 粉笔金，纸灯为暖纸亮色 + 朱红；三套同时覆盖面板、原生顶栏、弹层、状态卡与正文。纸灯另为亮底重算正文/开始页/侧栏/菜单/版本号/OPTIONS/存档弹层语义色，雾港/旧校舍补历史按钮与红色语义，三套 540×1170 原生页与 OPTIONS/SAVES 弹层扫描均为 **0 项低于 4.5:1**。
- **主题纹理层**：琥珀纸纤维、赛博霓虹网格、青瓷斜丝/釉光带、石墨碳纤/金属光带、星空星云/银河带、雾港海雾横纹、旧校舍粉笔格与木纹、纸灯宣纸纤维；面板/正文/卡片三层落点，原生顶栏、弹层、状态卡与正文同步。
- **点击/按压反馈**：按钮、页签、分段控件、图标、开关按下时下沉提亮，面板内生成 20px→3.4 倍双层主题亮环；正文选项卡片同样有 20px→3.1 倍主题色空心环，系统减少动态或设置关闭动效时不播放。
- **主题环境层（1.3.0）**：九套主题各有边缘粒子与专属伪层（雾港双层雾带 + 8 颗随机相位粒子、旧校舍粉笔灰、纸灯纸纤维/朱红墨屑、星空 14 星点 + 天空层、青瓷墨涟漪等），统一 `#ml-root .ml-ambient` 固定底层，`pointer-events:none`、`contain:layout paint style`，中央正文留空；≤600px 只留 5 颗，动效关闭或系统减少动态时整层 `display:none`。粒子只动 `transform/opacity`，不开 `filter: blur()`。面板打开时环境层降到 55%（220ms），标题栏同时一次 420ms 细光扫过；关回后恢复；星空每 15s 一颗右上流星，雾港第二层雾带再叠第三团下缘远景雾。
- **动效层（1.3.0）**：三套主题面板 `::after` 环境光 26/31/22s 往返漂移，`::before` 发丝线 7s 呼吸；原生侧栏 28/32/24s 光带漂移，并保留原 `--mln-bar-texture` 三层纹理；页签 200ms 淡入、表盘 5.6s 呼吸；按钮/分段/卡片 hover 上浮 1–2px、active 回落。`data-motion="off"`、`data-ml-motion="off"` 与 `prefers-reduced-motion: reduce` 三路关断后动画均为 `none`，操作不受影响。320/390 窄屏 5 个页签等分，不横向裁页。动效 token、24 个 keyframes 与工具类已抽到 `src/effects.css`，组件 CSS 只保留选择器。
- **原生弹层不被正文控件规则接管**：`#customOverlayContainer` 实际在 `#passages` 的 PassageFooter 里；正文按钮规则排除整个弹层子树，枯木逢春/原版作弊页的紧凑 `settingsGrid` 恢复 32px 原始几何，密集按钮不再互相覆盖或出现“看得见、点不到”。
- **原生 UI 卡片化**：顶栏金钱/时间/星期四格、七行状态数值一张大卡、正文选项整行卡片（地点图标与文字同卡，卡片间距收紧），侧栏入口与弹层统一卡片语言。
- **星空主题**：固定深空星场铺满整页背景，星点不随长 passage 滚动拉伸；卡片/面板保留银河带与星点纹理。
- **存档弹层修正**：空存档槽压缩为 46px 单行；非空行保留两行详情；底部 `saveMenuButton` 与行内保存/读取按钮跨主题统一；「全部删除」保留红色危险语义。
- **左轨可读性**：32px 侧边栏保留，状态标签下方补 24×5 数值条，0 值也保留轨道。
- **中英文文案**：面板文案与商店工具栏跟随语言；中文环境把原版硬编码 `Filters` / `Opt.` / `Legend` 换成「筛选 / 选项 / 图例」，已本地化的原文不覆盖。
- **第三方只读联动**：识别 Dynamicest 与前景背景时，「此刻」页显示其公开状态摘要（动态提醒/时段条/透明度、前景/背景/自动背景），并提供「打开设置」跳转到原模组页面；灯台不写第三方状态，未装时整块隐藏。
- **只读、可降级**：不写 `State.variables`、不接管第三方业务；检测到 DoLGameUI 4.x 宿主时仍按玩家「原生卡片」开关决定是否挂载本包外观层，不自动让位；设置损坏时逐字段回退。

## 安装

1. 打开游戏，按 `Alt+M` 呼出 ModLoader。
2. 「添加旁加载 Mod」选择 `MapleLantern-1.3.8.mod.zip`（已装 1.1.4/1.1.5/1.1.6/1.1.7/1.1.8/1.1.9/1.1.10/1.1.11/1.1.12/1.1.13/1.1.14/1.1.15/1.1.17/1.1.18/1.1.19/1.1.20/1.1.21/1.1.22/1.1.23/1.1.24/1.1.25/1.1.26/1.1.27/1.1.28/1.1.29/1.2.0/1.3.0/1.3.1/1.3.2/1.3.3/1.3.4/1.3.5/1.3.6/1.3.7 旧包时先停用旧包，再导入新包）。
3. 刷新页面，无需重启游戏。

> 把 zip 复制进 `game\` 目录不等于安装：ModLoader 从 `file://` origin 的 IndexedDB 读取模组。

## 入口

| 入口 | 行为 |
|---|---|
| `OPTIONS` 弹层顶部「灯台」行 | 打开灯台面板 |
| 右下悬浮球 | 仅在设置中开启「悬浮灯台」后显示 |
| `Alt+L` | 开合灯台面板 |

## 开发

```powershell
node --test tests\core.test.js tests\native.test.js tests\contract.test.js tests\dom.test.js tests\custom.test.js tests\native-round2.test.js tests\custom-card.test.js
pwsh -NoProfile -File .\pack.ps1
pwsh -NoProfile -File tools\host-probe.ps1
```

`pack.ps1` 产物在 `dist\`，并写入 `dist\SHA256.txt`。UI 包结构校验使用 `dol-ui-design` 技能内的 `check_ui_mod.py`。
`host-probe.ps1` 从工程根起 HTTP 服务跑 `tests\custom-host.html`，断言四个全局装配、版本双源与卡片默认键（服务根写错会全 false，见 `.learnings\ERRORS.md#ERR-20261118-009`）。发布流程与便携版 git 的调用方式见 `C:\Users\27352\Doubao\skills\dol-lantern\SKILL.md`。

1.3.8 产物：`dist\MapleLantern-1.3.8.mod.zip`，**115,287 B / 8 条目 / SHA256 `6b240707ed49ed385578c2ac1762814195b0ba47cdd6ea1364e860a542d62d05`**。
1.3.7 产物：`dist\MapleLantern-1.3.7.mod.zip`，**115,043 B / 8 条目 / SHA256 `07b604d31c73faa4985a75432b8f946c35aece1bebff7f00c425728d47f050b7`**。
1.3.6 产物：`dist\MapleLantern-1.3.6.mod.zip`，**114,385 B / 8 条目 / SHA256 `c4289d417f91d2ce8855e9e7107bf4d7adf03d60416bbde819fb5e5d5aa2523b`**。
1.3.5 产物：`dist\MapleLantern-1.3.5.mod.zip`，**114,201 B / 8 条目 / SHA256 `5d0fa36284d57a917ac2636307781a5825471ac06f19354b80f93ae3d421a57e`**。

发布包下载见 GitHub Releases。

## 维护

- 当前几何基线、缩放判据、O0O 共存结论、错误台账：`docs/KNOWLEDGE.md`
- 历史设计稿 / 验证报告：`docs/archive/`（只作追溯，不代表当前行为）
