# 灯台 Lantern v1.0.0 — 验证报告

> 本报告只记录**本轮实测**，不写「应该没问题」。每条结论都附命令或证据路径，可复跑。
> 环境：Windows（LAPTOP-LV14L6PB）/ Node v22.23.2 / PowerShell 7.6.4 / moli 1.1.22 / Edge（Chromium）。
> 游戏：`DoL-Project\game\Degrees of Lewdity.html`（0.5.12.13 / SugarCube 2.36.1）。

## 0. 方法与工具（可复查）

| 层 | 工具 | 命令 / 位置 |
|---|---|---|
| 纯逻辑 | `node --test` | `node --test tests\core.test.js` |
| DOM/ARIA/只读 | jsdom（复用 MapleBirchCE 30.x） | `node --test tests\dom.test.js` |
| 样式合同 / boot | 自写结构断言 | `node --test tests\contract.test.js` |
| 真实布局 | moli `--layout --image` + CDP | `moli serve -p 9333 --layout --image`；`node tools\lantern-probe.js --port 9333` |
| 包结构 | 技能自带脚本 | `python <skills>\dol-ui-design\scripts\check_ui_mod.py dist\MapleLantern-1.0.0.mod.zip` |
| 游戏内注入 | Edge 隔离 profile + Playwright CDP | `node tools\game-smoke.js` |
| 游戏基座 | 项目冒烟 | `.\real_smoke.ps1` |

moli 的关键限制（已在 probe 内固化）：`--layout` 必须与 `--image` 同给；`Emulation.setDeviceMetricsOverride` 只能 `mobile:false`；只能走 `http://`；**脚本改 DOM 不会重排**，因此每个 case×页签都重新 `goto` 一次，靠 `?tab=` + `?open=1` 把目标态写进首帧。

## 1. 改动点补丁清单

| # | 文件 | 做了什么 | 状态 |
|---|---|---|---|
| 1 | `src/core.js` | 纯逻辑 UMD：设置修复、i18n、格式化、只读 `readModel`、对比度、诊断 | ✓ |
| 2 | `src/index.js` | 渲染层：orb/面板/5 页签/焦点陷阱/自绘滑块/宿主转发/安全区/销毁 | ✓ |
| 3 | `src/style.css` | 4 主题、玻璃材质、43 条 `#ml-root` 作用域规则、7 条双 ID 反制、3 条动效关断、细滚动条 | ✓ |
| 4 | `src/boot.json` | 身份 1.0.0；`GameVersion =0.5.12.13`；四列表齐全；`README.md` 附加 | ✓ |
| 5 | `src/README.md` | 安装、入口、设置、边界、降级、验证、限制 | ✓ |
| 6 | `prototype/index.html` | DoL 外壳模拟；`?tab/?open/?host/?scale/?lang/?theme/?hud` | ✓ |
| 7 | `tools/lantern-probe.js` | 每 case×页签独立加载；40 张截图 + 249 条断言 | ✓ |
| 8 | `tools/game-smoke.js` | 隔离 Edge profile 导入 zip → `file://` 进游戏 → 几何/截图 | ✓ |
| 9 | `tests/env.js` | jsdom 环境、`Proxy` 三陷阱零写入、`offsetParent` 覆写 | ✓ |
| 10 | `tests/core.test.js` | 14 项 | ✓ |
| 11 | `tests/dom.test.js` | 13 项 | ✓ |
| 12 | `tests/contract.test.js` | 12 项 | ✓ |
| 13 | `pack.ps1` | 确定性 zip（固定 mtime、正斜杠、回读校验、SHA256） | ✓ |
| 14 | `dist/MapleLantern-1.0.0.mod.zip` | 5 条目 / 27,595 B / SHA256 `0127346f…a5ca` | ✓ |

## 2. 验证层清单

| 层 | 结果 | 证据 |
|---|---|---|
| 纯逻辑单测 | **14 / 14 PASS** | `tests\core.test.js` |
| DOM/ARIA/持久化/宿主/零写入/销毁 | **13 / 13 PASS** | `tests\dom.test.js` |
| 样式合同 / boot 结构 | **12 / 12 PASS** | `tests\contract.test.js` |
| 合计 | **39 / 39 PASS，0 FAIL** | `node --test tests\*.test.js` |
| 真实布局量测 | **249 PASS / 0 FAIL，exit 0**；8 case × 5 页签 = 40 张首帧截图 | `%TEMP%\lantern-probe.log`；`prototype\shots\` |
| 包结构校验 | **13 PASS / 1 WARN / 0 FAIL，exit 0** | 见 §2.2 |
| 打包确定性 | 连打两次 SHA256 相同：`0127346F…A5CA` | `dist\SHA256.txt` |
| 游戏内注入 | **SMOKE PASS**：`#ml-root` 存在、API 挂载、380×504、orb 56、z 89900、0 未捕获异常 | `tools\game-smoke.js`；`game-real-*.png` |
| 游戏基座冒烟 | A/B/C PASS；D=23、E=23、G=23；F WARN（CE 未注入，http origin 不覆盖） | `.\real_smoke.ps1` 输出 |
| 移动端真机 | **未验证** | 只有 320/390/844 视口模拟 |
| macOS / Android | **未验证** | 本轮只有 Windows |

### 2.1 单测覆盖到的「真事实」

- `weekDay` 是 **1–7 = Sun–Sat**（游戏源码 `getFirstWeekdayOfMonth` 注释），因此 7 = 周六、1 = 周日；测试按此断言。
- `SLOT_LABELS` 是 `{zh, en}` 双层结构，不是平铺；14 个槽位两种语言都齐全。
- `dayProgress(8,20)` 是浮点值 `34.72222222222222`，用 `<0.001` 容差断言，不做字符串相等。
- 坏 JSON 与「存储不可用」分开：坏内容 → 逐字段修复并提示「已修复」；只有 `getItem/setItem` 抛错才提示「仅本次生效」。

### 2.2 包校验的唯一 WARN（已确认，不修）

```
[WARN] index.js 引用了 window.DoLGameUI —— 属 UI 消费者，必须保留 apiVersion!==1 时的原生回退；
       但未声明 StoneFreeHost 依赖
```

**结论：接受。** 理由与证据：

1. 本模组是路径 C 独立包，`boot.json` 只依赖 `ModLoader >=2.100.0` 与 `GameVersion =0.5.12.13`；**不硬依赖宿主**。
2. 若把 `StoneFreeHost` 写进 `dependenceInfo`，没装宿主的玩家会被直接阻断加载——这与「未装主 UI 也能完整使用」的契约相反。
3. 代码有版本守卫：`index.js` 中 `apiVersion !== 1` 时 `readHost()` 返回 `null`，面板退回自有四主题；单测「宿主 apiVersion=2 仍能打开」已覆盖。
4. 校验脚本的同段判据本身把「未声明宿主」标 WARN（不是 FAIL），与设计意图一致。

## 3. 玩家路径走查

| 路径 | 怎么走 | 结果 |
|---|---|---|
| 安装 | `Alt+M` → 添加旁加载 Mod → 选 `MapleLantern-1.0.0.mod.zip` → 刷新 | 隔离 profile 实测导入 5 条目成功，游戏自举后 `#ml-root` 注入 |
| 首次启动 | 年龄确认弹窗（`#ui-dialog` z=100100）压在面板上 | 符合设计：游戏原生弹窗优先；关闭后即可操作面板 |
| 悬浮球 | 单击开合；拖动 >6px 只移动 | 单测 + 实机截图均可见 56×56，位于右下 |
| 快捷键 | `Alt+L`；输入框内不抢键 | 单测 13 项覆盖开、关、输入框跳过 |
| 页签 | 点击 / `←→` / `Home` / `End`；roving tabindex 以「选中项」为基准 | 单测覆盖 now→vitals→worn 递进 |
| 关闭 | `Esc` / 外部点击 / 抽屉下滑 >64px | 单测断言 `data-open=0` 且 `motion=off` 时立即 `hidden` |
| 设置 | 主题 / 字号 / 密度 / 动效 / 语言 / 位置；刷新后保留 | 单测写读 `localStorage["MapleLantern.settings.v1"]`，重建环境后主题仍为 jade |
| 坏设置 | 手写坏 JSON | 面板正常挂载、主题回 auto、toast 提示「修复」 |
| 存储不可用 | `getItem` 抛错 | 设置本次生效、提示一次，不阻断 |
| 移动端 | 390×844 / 320×568 / 844×390 | 抽屉模式、orb 让位（opacity 0）、内容区 318/318 不溢出 |
| 极端字号 | 320 + 140% + en + jade | 页签条横向滚动（设计允许）；内容区无溢出；orb 51.52×51.52 ≥44 |
| 宿主在场 | `?host=1` 模拟 4.2.0 token | 按钮全 44、页签字号 16.1875px、accent 转发为 `rgb(127,178,255)` |
| 宿主缺失 | 真实游戏（本机无 DoLGameUI） | 自有主题正常；footer 显示「未检测到（自有外观）」 |
| 诊断 | `window.MapleLantern.diagnostics()` | 返回 mod/version/game/viewport/breakpoint/storage/lang/stateReadable |
| 销毁 | `window.MapleLantern.destroy()` | `#ml-root` 移除，重复 open/destroy 不抛错 |

## 4. 游戏内实测数据（Edge 隔离 profile）

```
导入：MapleLantern-1.0.0.mod.zip (27,595 B) → modDataIndexDBZip:MapleLantern-1.0.0.mod.zip
注入：version 0.5.12.13 / State 可用 / MapleLantern.__mounted true
几何：orb  x=1208 y=534 56×56
      panel x=884 y=16 380×504
      data-sheet=0  data-side=right  data-theme=auto
      z-index=89900
      .ml-body client=360 scroll=360（now 页无需滚动）
```

截图：`prototype\shots\game-real-open.png`（面板打开）、`game-real-vitals.png`、`game-real-settings.png`（设置页需滚动，`.ml-body` scrollHeight=683）。

**基线噪声（不属于本包）**：隔离 profile 首启有 10 条失败请求，全部指向游戏根目录的外部可选文件：`modList.json`、`style.css`、`usettings.js`、`img/ui/wolfharmony.png`、`img/misc/banner.png`。本包只有 5 个条目（`boot.json` / `core.js` / `index.js` / `style.css` / `README.md`），无任何外部引用；`pageerror` 为 0。

## 5. 判定与残留风险

**本轮可判 PASS 的**：Windows 桌面 Electron/Chromium 类环境下的安装、注入、开合、五页签、设置持久化、只读、包结构、确定性打包、桌面/平板/手机视口布局。

**不能判 PASS 的（如实标注）**：

| 项 | 原因 | 需要什么才能关 |
|---|---|---|
| DoLGameUI 真机跟随 | 本机未安装 4.2.0 | 拿到 `DoLGameUI-4.2.0.mod.zip` 后同 profile 装入，重跑 `?host` 与游戏内断言 |
| Android / iOS | 无设备 | 真机或 APK 内 WebView 实测 |
| macOS | 无设备 | macOS 浏览器实测 |
| CE 同开 | 本轮未装 CE | 装 CE 后确认 `#mce-root` 仍在上层 |
| 真实玩家档 | 隔离 profile 是新档，只有初始 passage | 用玩家存档走一遍「进入剧情后切页」 |

## 6. 复跑命令

```powershell
cd lantern
node --test tests\*.test.js
pwsh -NoProfile -File .\pack.ps1
python C:\Users\27352\Doubao\skills\dol-ui-design\scripts\check_ui_mod.py .\dist\MapleLantern-1.0.0.mod.zip
node tools\game-smoke.js
```

布局量测（40 张截图）：

```powershell
moli serve -p 9333 --layout --image
python -m http.server 8766 --bind 127.0.0.1 -d .
node tools\lantern-probe.js --port 9333
```

---

# v1.1.0 验证报告（2026-11-11）

## A. 改动点补丁清单

| # | 文件 / 功能 | 状态 |
|---|---|---|
| 1 | `core.js` VERSION `1.0.0 → 1.1.0`；`DEFAULTS.glass=60`；`sanitizeSettings` glass 分支；三处文案；`buildDiagnostics.renderMs` | ✓ |
| 2 | `render.js`（原 `index.js`）通透度变量与 `data-glass`；`rangeControl()` 复用；`passageend` rAF 单飞；`renderActive()` 计时 | ✓ |
| 3 | `style.css` 玻璃三变量、`contain`、`84dvh`、`data-glass="0"` 关模糊 | ✓ |
| 4 | `boot.json` 版本 1.1.0，脚本列表 `core.js` + `render.js` | ✓ |
| 5 | 渲染层改名 `render.js`，消除与 DoLGameUI / StoneFreeHost 的 `index.js` 撞名 | ✓ |
| 6 | 测试 42 项（core 19 / dom 15 / contract 13，含 glass 与性能合同） | ✓ |
| 7 | `tools/game-smoke.js` 增 `[5] passage`、`renderMs` 断言、宿主四包导入 | ✓ |
| 8 | `tools/passage-probe.js` 独立复现剧情链路 | ✓ |
| 9 | README / 设计规格 §18 / 本报告 | ✓ |

## B. 验证层清单

| 层 | 结果 |
|---|---|
| `node --check src/core.js` / `src/render.js` / `tools/game-smoke.js` | 0 语法错误 |
| `node --test tests\*.test.js` | **42 / 42 PASS** |
| moli `8 case × 5 页签` | **249 PASS / 0 FAIL**，40 张截图；`320-scale140-en/settings` 23 个按钮 ≥44px |
| `check_ui_mod.py` | **13 PASS / 1 WARN / 0 FAIL**（WARN = 未声明 StoneFreeHost，有意可选接入） |
| 打包 | 30,219 B / 5 条目 / SHA256 `5701871a54c463885e58075f122b79a1bf16e3269c8f97033ef07999a4d75b08`；正斜杠、固定 mtime |
| 纯净档冒烟（Edge 隔离 profile + `file://`） | **11 项 PASS**，0 未捕获异常 |
| 宿主档冒烟（Dynamicest 3.3 + StoneFreeHost 0.1.5 + DoLGameUI 4.2.0 + 本包） | **15 项 PASS** |
| 性能 | 剧情切换后 `renderMs = 0.2–0.4`（纯净档 / 宿主档一致），断言上限 16 ms |
| 剧情链路 | `Start → Start2`；面板场景 `Start → Start2`；时间 `23:45 → 07:00` |

## C. 玩家路径走查

| 入口 / 路径 | 结果 |
|---|---|
| 首次启动年龄弹窗 → 关闭 → 打开面板 | 通过（`#ui-dialog` 正常拦截与恢复） |
| 右下悬浮球点击 | 通过（orb 56×56，开合正常） |
| 五页签逐一点击 | 通过（`now / vitals / worn / system / settings` 均渲染） |
| 设置页主题、字号、通透度、密度、动效、语言 | 通过（通透度默认 60；键盘 5% 步进；0/100 端点 CSS 变量正确） |
| 游戏 `Start Game` 触发 passage | 通过（面板场景跟随 `Start2`） |
| 宿主四包同装后再走同一路径 | 通过（面板仍 380×504，主题跟随宿主） |
| 移动端 390 / 320 / 844×390 | 通过（视口模拟，非真机） |

## D. 残留风险

- 未验证 Android / iOS 真机、macOS、与 CE 同开、玩家真实存档下的长时间 passage 连续切换。
- 身心页仍 5 项；`pain` / `hygiene` / `oxygen` 未纳入。
- 「系统」页保留模组诊断信息（版本 / 宿主观测 / 存储状态），便于排障。
- 32 位系统字体缓存与 GPU 差异可能让 `backdrop-filter` 观感不同，但数值合同已锁定。

## E. 复跑命令（v1.1.1）

```powershell
cd MapleLantern
node --test tests\*.test.js
pwsh -NoProfile -File .\pack.ps1
python C:\Users\27352\Doubao\skills\dol-ui-design\scripts\check_ui_mod.py .\dist\MapleLantern-1.1.1.mod.zip
node tools\game-smoke.js
$env:HOST='1'; node tools\game-smoke.js
```

## F. v1.1.1 验证（2026-11-11 · 启动与交互静默优化）

### F.1 改动点补丁清单

| 改动 | 文件 | 状态 |
|---|---|---|
| 挂载不再预渲染隐藏面板，首次打开才构建 | `src/render.js` `mount()` | ✓ 已核 |
| 主题 / 密度 / 动效切换不重建设置页 | `src/render.js` `setSetting()` 三处调用 | ✓ 已核 |
| 剧情推进时设置页只更新时钟/底栏，不重建 | `src/render.js` `applyPassage()` | ✓ 已核 |
| 宿主 `backdropFilter=false` 关闭模糊 | `src/render.js` `applySettings()` + `src/style.css` | ✓ 已核 |
| 宿主 `visualTier` 收窄模糊上限（10/16/32px） | `src/render.js` `applySettings()` | ✓ 已核 |
| 版本双源 1.1.1 | `src/core.js` / `src/boot.json` | ✓ 已核 |
| 新增 4 条 DOM 断言 + 3 条合同断言 | `tests/dom.test.js` / `tests/contract.test.js` | ✓ 已核 |
| 实机冒烟新增设置页稳定性与模糊断言 | `tools/game-smoke.js` | ✓ 已核 |

### F.2 验证层清单

| 层 | 结果 |
|---|---|
| 单测 | **46 / 46 PASS**（core 14 / contract 13 / dom 19） |
| moli 8 case × 5 页签 | **249 条断言 PASS / 0 FAIL**，40 张截图刷新 |
| 包校验 `check_ui_mod.py` | **13 PASS / 1 WARN / 0 FAIL**（WARN 为有意不声明 StoneFreeHost） |
| 纯净档实机 | **14 项 PASS**；`renderMs=0.3`；`samePane=true`；`focusStayed=true`；`filter=blur(20px) saturate(1.1)` |
| 宿主档实机 | **18 项 PASS**；`renderMs=0.2`；API v1、8 token、`visualTier=Fancy`、380×504 |
| 打包 | **30,626 B / 5 条目 / SHA256 `9e3a7b89a63cfce1378b9e1b635921ba3c45789ad16c0f0d777d3a7c8bde17a5`** |

### F.3 玩家路径走查

| 路径 | 结果 |
|---|---|
| 冷启动后点悬浮球首次打开 | 通过（首次才构建当前页签，默认「此刻」正常） |
| 设置页连点主题键 | 通过（同一 `.ml-pane`、焦点留在键上、主题即时变） |
| 设置页打开时剧情推进 | 通过（设置页不重建，焦点与滑块保留） |
| 宿主四包同装后走同一路径 | 通过（14+4 项全 PASS，宿主档设置页同样稳定） |
| 移动端 390 / 320 / 844×390 | 通过（视口模拟，面板不越界、操作区 ≥44px） |

### F.4 残留风险

- 未验证 Android / iOS 真机、macOS、与 CE 同开、玩家真实存档下的长时间 passage 连续切换。
- `Smooth` / `Balanced` 的模糊收窄只做了 jsdom 变量断言；未在真实低档位宿主设备上肉眼复核。
- 「系统」页仍保留模组诊断信息，尚未改成纯游戏状态页。
- 身心页仍 5 项；`pain` / `hygiene` / `oxygen` 未纳入。
