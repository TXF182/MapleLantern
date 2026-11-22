# 灯台交付自检清单

> 用途：每次改码/打包/发布前逐项填，不写“全绿”带过。
> 判据以 `tools\verify.ps1` 的实际输出与 `dist\verify.json` 指纹为准；数字不写死在文档里。
> 基线回滚：`pwsh tools\snap.ps1 -Tag before` → `.selfcheck\<时间>-<版本>-before.txt`。

## 1. 改动点补丁清单

| # | 文件 / 功能 / 键 | 改了什么 | 状态 |
|---|---|---|---|
| 1 | `src/core.js` `THEME_META` | 主题元数据单一真源，`THEMES` 由它派生 | ✓ / ✗ |
| 2 | `src/render.js` 主题设置项 | 由 `C.THEME_META.map` 生成，不再手写第二份 | ✓ / ✗ |
| 3 | `src/render.js` `setSetting` | 自定义文字色不再被换主题覆盖为 `auto` | ✓ / ✗ |
| 4 | `src/render.js` `colorControl` | 增加 `.ml-color-note` 暂时回落说明 | ✓ / ✗ |
| 5 | `src/style.css` | `data-inactive` 弱化选中点 + note 间距 | ✓ / ✗ |
| 6 | `tests/theme-matrix.test.js` | 主题矩阵 5 条：唯一性/顺序/文案/对比度/预览/原生块 | ✓ / ✗ |
| 7 | `tests/dom.test.js` | 主题卡数量改元数据驱动；新增“换主题不覆盖自定义色” | ✓ / ✗ |
| 8 | `tests/contract.test.js` | 主题字面量断言改元数据断言 | ✓ / ✗ |
| 9 | `tools/verify.ps1` / `verify-lib.ps1` | 单入口验证 + 源码指纹 | ✓ / ✗ |
| 10 | `pack.ps1` | 先 verify、校验指纹、条目集合精确、独立结构校验 | ✓ / ✗ |
| 11 | `tools/snap.ps1` | 改码前基线快照 | ✓ / ✗ |

## 2. 验证层清单

| 层 | 命令 | 判据 | 状态 |
|---|---|---|---|
| L1 全量单测 | `pwsh tools\verify.ps1` 第 1/4 步 | `# fail 0`，`cancelled 0`，`skipped 0`；数字取实际输出 | ✓ / ✗ |
| L2 宿主装配 | 同上第 2/4 步 | `tools\host-probe.ps1` 返回 `PASS:`，四全局 + 版本双源 + card/bg 键 | ✓ / ✗ |
| L3 源码防漂移 | 同上第 3/4 步 | 验证前后 `sourceHash` 相同 | ✓ / ✗ |
| L4 验证指纹 | 同上第 4/4 步 | `dist\verify.json` 的 `stampId` 写入成功 | ✓ / ✗ |
| P1 打包门禁 | `pwsh pack.ps1` 第 1/4 步 | verify exit 0 且 stamp.sourceHash == 当前源码 | ✓ / ✗ |
| P2 包内清单 | `pack.ps1` 第 2/4 步 | boot 五列表齐全、引用文件存在 | ✓ / ✗ |
| P3 确定性 zip | `pack.ps1` 第 3/4 步 | mtime 1980-01-01 / 正斜杠 / 无 `..` | ✓ / ✗ |
| P4 回读集合 | `pack.ps1` 第 4/4 步 | zip 条目集合与 `src` 完全一致（多一条少一条都 fail） | ✓ / ✗ |
| P5 独立结构校验 | `dol-ui-design/scripts/check_ui_mod.py` | exit 0；WARN 逐条确认，不允许静默通过 | ✓ / ✗ |
| P6 哈希回读 | `pack.ps1` 输出 | `SHA256.txt` 与 zip 实算一致；两次打包同哈希 | ✓ / ✗ |

**已知可接受 WARN（每次仍需复看）**：`maplelantern-native.js` 引用 `window.DoLGameUI` 但 `dependenceInfo` 未声明 `StoneFreeHost`。这是可选宿主探测：缺 `DoLGameUI` 时走原生回退，不能加硬依赖；若未来改成必需宿主，再补依赖并重跑本表。

**禁止**：只跑单测就宣布“全绿”；把旧 `dist\MapleLantern-*.mod.zip` 当成新代码产物；在版本号未变时覆盖已发布产物。

## 3. 玩家路径走查

| # | 入口 / 操作 | 预期 | 证据（窗口+像素/状态） | 状态 |
|---|---|---|---|---|
| 1 | 游戏内打开灯台 → 设置 | 主题卡数量/顺序与 `THEME_META` 一致，选中态正确 | 实机截图或宿主 DOM 快照 | ✓ / ✗ |
| 2 | 设置页选“纸灯” | 主题切换，正文可读，边饰/原生块符合元数据 | 同上 | ✓ / ✗ |
| 3 | 选一个与当前底色不达标的文字色 → 换浅色主题 | 色值保留；正文暂时跟主题；出现“暂时回落”说明 | 同上 | ✓ / ✗ |
| 4 | 再切回兼容主题 | 自定义文字色自动恢复，无需重设 | 同上 | ✓ / ✗ |
| 5 | 刷新游戏 / 重开面板 | 设置与文字色持久化，未回退成 `auto` | localStorage + 画面 | ✓ / ✗ |
| 6 | 移动端 390 / 320 宽 | 主题卡不溢出，note 不遮挡色点 | 视口截图 | ✓ / ✗ |

> 走查前先列“禁点/危险按钮”：无确认即时生效的删除、卸载、重置键不点；结论按窗口 + 像素 + 状态取证，不跨窗口外推。
