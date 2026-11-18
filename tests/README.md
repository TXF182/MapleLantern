# tests — 灯台测试与取证脚本索引

改灯台任何一层，先看这张表选对应判据；四层都过的才算改完（顺序：单测 → 宿主 → 视口 → 真机）。

## 1. 正式断言（进交付门槛）

| 脚本 | 判据 | 期望 | 产物（可再生） |
|---|---|---|---|
| `node --test tests\*.test.js` | 契约 / 原生层 / 自定义核心 / DOM | **173 / 0** | — |
| `tests\custom_host.py` | 真实 DOM 宿主：导入、应用、像素取色、载体必须是 `data:` | **58 / 0** | `_edge_profile_customhost\`、`shots\custom-*.png` |
| `tests\custom_viewports.py` | 六档视口：320 / 360 / 390 / 430 / 540 / 844×390，44px 触达、滚到可点、面板外透出背景 | **49 / 0** | `_edge_profile_viewports\`、`shots\vp-*.png` |
| `tests\custom_formats.py` | 图片格式矩阵（Edge/Chromium 实吃哪些格式） | 15 可用 / TIFF 友好拒绝 | `fmt\`（脚本自建）、`_edge_profile_fmt\` |

单档调试：`$env:VP_ONLY_FIRST="1"; python tests\custom_viewports.py`。

## 2. 取证脚本（不进门槛，改这块时才跑）

| 脚本 | 回答什么问题 |
|---|---|
| `_diag_realinject.py` | 把本包真实源码注入**真实 64 MB 游戏页**，走 `Assets.process → save → attach → apply` 全链，读变量与 `#mlc-bg`，截图取像素 |
| `_diag_csp.py` | 同图双载体 A/B：`blob:` 被 CSP 拦、`data:` 出图，附 `securitypolicyviolation` 监听 |
| `_diag_realdom.py` | 真实页面层级 dump（`html/body/#story/#passages` 与六个 fixed 浮层的 position/z-index/背景） |
| `_diag_bg4.py` | 面板与面板外逐点取色，判「图到底画没画」 |
| `_diag_css.py` / `_diag_bg.py` / `_diag_bg2.py` / `_diag_bg3.py` | 1.4.x 前几轮的 CSS 变量与层级取证（保留作来路） |
| `_probe_bg_src.py` | 只读搜索 64 MB HTML（确认 DoL 本体没有 `#background` / `backgrounds\`） |
| `_audit_probe.js` | 原生层几何批量检查 |

**这些脚本都会自己建浏览器 profile 目录**（`_edge_profile_<名字>\`），首次跑要几十秒，之后复用。

## 3. 可再生 / 不入库

`_edge_profile_*`（每个约 12–53 MB）、`shots\`（约 20 MB）、`fmt\`（约 1 MB）、`fixtures\`（玩家素材副本）都在 `.gitignore` 里。删掉不影响仓库，重跑对应脚本会重建。

## 4. 三条铁律

1. **宿主页必须复刻真机 CSP**：`custom-host.html` 与真机差异最大的地方就是 CSP——不复刻就会把「被 CSP 拦」验成绿（ERR-20261117-010 / LRN-20261117-011）。
2 **computed style 有 url ≠ 像素画出来**：可见性一律以截图取色为准，颜色判据用纯红/纯绿，不靠肉眼。
3. **宿主页必须从工程根起服务**：脚本是 `../src/*.js`，以 `tests\` 为根会 404、探针全 false（ERR-20261118-009）。直接跑 `pwsh -NoProfile -File tools\host-probe.ps1`，它负责起服务、跑探针并收尾。
