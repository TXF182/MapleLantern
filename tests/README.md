# tests — 灯台测试与取证脚本索引

改灯台任何一层，先看这张表选对应判据；静态层跑 `pwsh tools\verify.ps1`（单测 + 宿主装配），视口与真机另跑，四层都过才算改完。

## 1. 正式断言（进交付门槛）

| 脚本 | 判据 | 期望 | 产物（可再生） |
|---|---|---|---|
| `pwsh tools\verify.ps1` | 契约 / 原生层 / 自定义核心 / DOM / 生命周期 / 主题矩阵，全量一次跑 | **以 `[1/4] PASS` 的实际输出为准**（fail 0 / cancelled 0 / skipped 0） | `dist\verify.json` |
| `tests\theme-matrix.test.js` | 主题元数据唯一性/顺序、zh/en 文案、4.5:1 对比度、预览、面板块/原生块/边饰 | 按实际输出 | — |
| `tests\dolsmartphone-compat.test.js` | DolSmartPhone 手机壳：通用按钮/链接/标题/段落/列表/分隔线/亮底语义色不得进入 `#phone-wrapper`，手机弹窗 X 24px，通用 img 不写 height、保留 max-width | 按实际输出 | — |
| `tests\sexdiagram_probe.py` | 属性页真机几何 + 5 个平铺属性列表：原生 flex 换行、卡片不越界/不互压、左右 50% 双列、旧 grid 可复现、开关回原版 | **73 / 0** | `_edge_profile_sexdiagram\`、`shots\sexdiagram_*.png` |
| `tests\ce_settings_probe.py` | CE 1.20.4 设置页：桌面双列、同行等高、不越界/不互压/不裁切，原生 Options 不被外溢；手机单列 | **24 / 0** | `_edge_profile_ce_settings\`、`shots\ce_settings_*.png` |
| `tests\custom_host.py` | 真实 DOM 宿主：导入、应用、像素取色、载体必须是 `data:` | **58 / 0** | `_edge_profile_customhost\`、`shots\custom-*.png` |
| `tests\custom_viewports.py` | 六档视口：320 / 360 / 390 / 430 / 540 / 844×390，44px 触达、滚到可点、面板外透出背景 | **49 / 0** | `_edge_profile_viewports\`、`shots\vp-*.png` |
| `tests\custom_formats.py` | 图片格式矩阵（Edge/Chromium 实吃哪些格式） | 15 可用 / TIFF 友好拒绝 | `fmt\`（脚本自建）、`_edge_profile_fmt\` |

单档调试：`$env:VP_ONLY_FIRST="1"; python tests\custom_viewports.py`。

### DolSmartPhone 0.3.91.1 覆盖矩阵（2026-11-22）

隔离判据是**整机子树**，不是类名白名单：`#phone-wrapper` 是 `.passage` 直接子级，11 个内置 APP 的 DOM 都在 `#phone-content` 内；规则写成 `#passages .passage > :not(#phone-wrapper) ...`，新增 APP 自动落在岛内，不需要逐类补排除。

| 区域 | 关键选择器 | 核验口径 |
|---|---|---|
| 手机壳 / 屏幕 / 内容滚动 | `.phone-main.phone-open`、`.phone-content`、`.phone-screen-on` | 选择器不进入手机子树；`overflow-x:hidden` 与 `#1a1a1a` 底色保持 |
| 手机根继承复位 | #passages .passage > #phone-wrapper | 只恢复 .passage 传下来的字体/16px/行高 normal/断行 wrap；手机纯文本行高与标题高度回到原版，不写任何手机内部控件样式 |
| 状态栏 / 电池 / 桌面 / 工具栏 | `.phone-status-bar`、`#battery`、`.phone-app-icon`、`.toolbar-icon` | 图标 30×30、图标盒 60×60；灯台只保留 `img{max-width:100%}` |
| Yenote | `.yenote-title`、`.yenote-add`、`.yenote-avatar`、`.yenote-back`、`.yenote-delete`、`.comment-btn`、`.memo-btn` | on/off 几何探针：尺寸、padding、border、background、font-size 0 差异 |
| 日志内手机条目 | `ul.journal.carry #phone-journal`（`scripts/smartphone-main.js:1355-1371`） | 手机模组把「持有的手机」插进原生日志 `ul.journal.carry`；灯台卡片仍保留 40px 悬挂缩进，30px 图标落在卡片左内边 +6px，未出现负偏移；条目链接保持在卡片宽度内 |
| 相机 | `.camera-side`、`.camera-blur`、`.camera-filter-item`、`.photo-image` | 侧键/虚化 0 差异；图片靠模组自身 width/height/object-fit |
| 应用商店 tab / 普通手机按钮 | `.app-tab`、`.phone-btn` | 0 差异（25px 紧凑高度不被 44px 通用规则接管） |
| 手机弹窗 | `#phone-popup-container`、`.phone-popup`、`.customOverlayClose` | X 保持 24×24，3px 线宽；不越界到灯台遮罩关闭键 |
| 手机对话框 | `#phone-dialog`、`.dialog-btn` | 确定/取消 0 差异 |
| 11 个 APP | 闹钟、备忘录、淘桃网购、摄像、相册、小黄书、通讯录、游戏、设置、DD打车、美食屋 | 全部共享同一 `#phone-wrapper` 子树；实物探针覆盖壳层、Yenote、相机、tab、弹窗、对话框，其余按结构覆盖，未逐屏截图 |
| 手机外正文 / MEE | `.passage` 直接按钮、`#customOverlay` | 直接/嵌套按钮仍 44px；MEE 容器不在 `.passage` 子树，S5/S8/S10 定向 16/16 PASS |

旧 CSS（`git show HEAD:src\maplelantern-native.css`）跑同一组测试为 `4 pass / 5 fail`；当前 9/9 PASS。手机根继承复位后纯文本行高 20.4px→normal、段落高 40.8→34px、h2 高 30.6→26px，与关闭灯台一致。通用 `img` 仍作用于手机，是刻意保留的共享规则：真实图片尺寸已核对（APP 图标 30×30、`yenote-text-full.png` 1554×558 由 `.yenote-title` 15px 高度收住），未来若出现“故意超宽溢出”的手机图片需重新评估。

1.4.12 增补断言：CE 设置页 `settingsGrid` 回到 48.5% 双列且 `align-items:stretch`，规则不得再挂 `#customOverlayContent`；几何探针 24/0（1280/900/390）。
1.4.11 增补断言：通用 `.characteristic-box-list` 禁止 grid、5 个平铺属性列表保持 flex/wrap 且不越界不互压、`.relation-box-list` 不覆盖原生列数、`#global-recognition` 保留 flex-wrap；真机几何探针 73/0。
1.4.10 增补断言：`#sex-diagram` 恢复左右 50% 双列、属性卡皮肤全部挂 `optOverlay`、窄屏回 100% 单列；全量 **201 / 0**。
1.4.9 增补断言：新增「开关」页 9 个原生模块独立开关、6 页签集合、游戏缩放 120%/85% 与金额/状态/左轨单模块还原；全量 **200 / 0**。
1.4.8 增补断言：第三方美化页仍插入灯台入口、默认不套原生层、设置页有「美化页启用灯台 UI」，以及未检测到第三方时开关关闭也立即套原生层；全量 **193 / 0**。
1.4.7 增补断言：着装页优先读 ModI18N 的 `cn_name_cap / cn_name`（14 槽、空白中文名回落、中文/英文双向渲染），页签单一 `.ml-tab-glint` 按真实 offset 滑动；全量 **188 / 0**。

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
| `sexdiagram_probe.py` | 属性页属性卡与中央立绘重叠取证：先复现旧 grid，再验修复后与关闭开关后的原版布局 |

**这些脚本都会自己建浏览器 profile 目录**（`_edge_profile_<名字>\`），首次跑要几十秒，之后复用。

## 3. 可再生 / 不入库

`_edge_profile_*`（每个约 12–53 MB）、`shots\`（约 20 MB）、`fmt\`（约 1 MB）、`fixtures\`（玩家素材副本）都在 `.gitignore` 里。删掉不影响仓库，重跑对应脚本会重建。

## 4. 三条铁律

1. **宿主页必须复刻真机 CSP**：`custom-host.html` 与真机差异最大的地方就是 CSP——不复刻就会把「被 CSP 拦」验成绿（ERR-20261117-010 / LRN-20261117-011）。
2 **computed style 有 url ≠ 像素画出来**：可见性一律以截图取色为准，颜色判据用纯红/纯绿，不靠肉眼。
3. **宿主页必须从工程根起服务**：脚本是 `../src/*.js`，以 `tests\` 为根会 404、探针全 false（ERR-20261118-009）。直接跑 `pwsh -NoProfile -File tools\host-probe.ps1`，它负责起服务、跑探针并收尾。

