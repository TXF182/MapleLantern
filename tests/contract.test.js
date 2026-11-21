/* 灯台 MapleLantern — 合同测试：CSS 反制 / 动效判据 / 触控下限 / boot.json / 打包前置 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const css = fs.readFileSync(path.join(SRC, "style.css"), "utf8");
const fx = fs.readFileSync(path.join(SRC, "effects.css"), "utf8");
const index = fs.readFileSync(path.join(SRC, "render.js"), "utf8");
const native = fs.readFileSync(path.join(SRC, "maplelantern-native.js"), "utf8");
const nativeCss = fs.readFileSync(path.join(SRC, "maplelantern-native.css"), "utf8");
const core = fs.readFileSync(path.join(SRC, "core.js"), "utf8");
const boot = JSON.parse(fs.readFileSync(path.join(SRC, "boot.json"), "utf8"));
const dossierCore = fs.readFileSync(path.join(SRC, "dossier-core.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "prototype", "index.html"), "utf8");

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
/* 第三方 cheat overlay 的排除前导：CheatExtended 落在 #customOverlayContent 内，
   带 #cheat_extended_options / #CE_settingsDiv / .CEtab；MapleBirchCE 则是 #mce-root。 */
const FOREIGN_GUARD = ":not\\(:has\\(#cheat_extended_options,#CE_settingsDiv,.CEtab,.CEbuttonBar,.CEDISPLAY,#mce-root\\)\\)";

test("boot.json：身份、版本、四个必填列表与文件存在性", () => {
  assert.equal(boot.name, "MapleLantern");
  assert.equal(boot.version, "1.4.22");
  /* 版本双源必须一致：boot.json 与 dossier-core.js 的 VERSION 任一漏改，
     玩家侧看到的就是「包是新的、行为是旧的」 */
  assert.equal(dossierCore.match(/var VERSION = "([^"]+)"/)[1], boot.version);  assert.match(boot.nickName, /灯台/);
  for (const key of ["scriptFileList", "styleFileList", "tweeFileList", "imgFileList"]) {
    assert.ok(Array.isArray(boot[key]), key + " 必须是数组");
  }
  assert.deepEqual(boot.scriptFileList,
    ["core.js", "maplelantern-native.js", "render.js",
     "dossier-core.js", "dossier-assets.js", "dossier-theme.js", "dossier-panel.js", "custom.js"],
    "core 必须先于 native/render；自定义按 core→assets→theme→panel→custom（启动装配）顺序跟在后面");
  assert.deepEqual(boot.scriptFileList_inject_early, ["compat-preload.js"],
    "MEE 兼容层必须在所有普通脚本之前注入");
  assert.deepEqual(boot.styleFileList, ["style.css", "maplelantern-native.css", "effects.css", "custom.css"], "effects 必须最后加载，keyframes 才能覆盖两套样式；custom.css 收尾");
  for (const list of [boot.scriptFileList, boot.scriptFileList_inject_early, boot.styleFileList, boot.additionFile || []]) {
    for (const f of list) {
      assert.ok(fs.existsSync(path.join(SRC, f)), f + " 不在包内");
    }
  }
});

test("boot.json：GameVersion 精确锁、Host 区间、不硬依赖 DoLGameUI", () => {
  const deps = boot.dependenceInfo;
  const gv = deps.find((d) => d.modName === "GameVersion");
  assert.equal(gv.version, "=0.5.12.13");
  const host = deps.find((d) => d.modName === "StoneFreeHost");
  assert.equal(host, undefined, "独立界面不应硬依赖宿主");
  assert.equal(deps.find((d) => d.modName === "DoLGameUI"), undefined);
  assert.ok(deps.find((d) => d.modName === "ModLoader"));
});

test("宿主反制：七类按钮逐条封回，且都是双 ID + 条件前导", () => {
  const rules = strip(css).match(/html\[data-dgu-buttons-scaled\]\s+#ml-root#ml-root\s+\.ml-[a-z-]+/g) || [];
  assert.equal(rules.length, 7, "应为 orb/icon/tab/seg/btn/switch/slider 七条");
  for (const cls of ["orb", "icon", "tab", "seg-btn", "btn", "switch", "slider"]) {
    assert.ok(rules.some((r) => r.endsWith(".ml-" + cls)), "缺少 .ml-" + cls);
  }
  assert.match(css, /#ml-root#ml-root .ml-tab \{[^}]*padding/m);
  assert.match(css, /#ml-root#ml-root .ml-orb \{[^}]*min-height: 56px/m);
  /* 未装主 UI 时零匹配：每条都必须有 html[data-*] 前导 */
  assert.ok(!/#ml-root#ml-root/.test(css.replace(/html\[data-dgu-buttons-scaled\] #ml-root#ml-root/g, "")));
});

test("动效：三条零 JS 判据同时存在（系统 / 宿主午夜 / 自有开关）", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /html\[data-dol-midnight\]:not\(\[data-dgu-visualMotion\]\) #ml-root/);
  assert.match(css, /#ml-root\[data-motion="off"\]/);
  assert.match(css, /animation: none !important/);
  assert.match(css, /transition: none !important/);
});

test("触控：七类主要操作区都有 44px 下限", () => {
  const floor = strip(css).match(/#ml-root (\.ml-(?:orb|tab|btn|seg-btn|icon|switch|slider)),?/g) || [];
  for (const cls of ["orb", "tab", "btn", "seg-btn", "icon", "switch", "slider"]) {
    assert.ok(floor.some((s) => s.includes(".ml-" + cls)), "触控下限块缺少 .ml-" + cls);
  }
  assert.match(css.slice(css.indexOf("触控下限")), /min-height: 44px/);
});

test("样式作用域：所有 .ml-* 选择器都在 #ml-root 之下", () => {
  const selectors = strip(css).match(/[^{}]+(?=\{)/g) || [];
  for (const raw of selectors) {
    const sel = raw.trim();
    if (!sel || sel.startsWith("@") || /^\d+%$/.test(sel) || /^(from|to)$/.test(sel)) { continue; }
    /* 原生选项入口挂在 #customOverlayContent 内，天生不在 #ml-root 之下；
       只允许这一组前缀例外。 */
    if (sel.startsWith(".ml-native-entry")) { continue; }
    if (sel.includes(".ml-") && !sel.includes("#ml-root")) {
      assert.fail("未作用域的选择器: " + sel);
    }
  }
});

test("字号全部走 calc(px * --dgu-font-scale * --ml-scale)", () => {
  for (const line of strip(css).split("\n")) {
    if (line.includes("font-size:") && !line.includes("var(--ml-scale")) {
      assert.fail("未跟随字号的声明: " + line.trim());
    }
  }
});

test("主题纹理：9 套主题都有独立背景变量，面板/正文/卡片三层落点", () => {
  for (const theme of ["amber", "cyberpunk", "jade", "graphite", "star", "fog", "school", "paper"]) {
    assert.match(css, new RegExp('data-theme="' + theme + '"'), "缺少面板主题块: " + theme);
    /* 琥珀是原生层默认根变量，不另写 [data-ml-theme="amber"] 块。 */
    assert.match(nativeCss, theme === "amber"
      ? /html\[data-ml-native="on"\]\s*\{/
      : new RegExp('data-ml-theme="' + theme + '"'), "缺少原生主题块: " + theme);
  }
  assert.match(css, /--ml-tex-panel:/);
  assert.match(css, /--ml-tex-body:/);
  assert.match(css, /--ml-tex-card:/);
  assert.match(css, /background-image: var\(--ml-tex-panel\)/);
  assert.match(css, /#ml-root \.ml-body\s*\{[^}]*background-image:\s*var\(--ml-tex-body\)/s);
  assert.match(css, /#ml-root \.ml-stat,[\s\S]*?\.ml-slot,[\s\S]*?\.ml-quick\s*\{[^}]*background-image:\s*var\(--ml-tex-card\)/s);
  assert.match(css, /#ml-root\[data-theme="star"\] \.ml-mark/);
  assert.match(css, /#ml-root\[data-theme="star"\] \.ml-panel\s*\{[^}]*inset 0 0 40px/s);
  assert.match(nativeCss, /#customOverlayTitle/);
  assert.match(nativeCss, /#ui-dialog-titlebar/);
});

test("按压反馈：CSS 按压/涟漪 + JS 指针入口 + 减少动效兜底", () => {
  assert.match(css, /\.ml-press-ring\s*\{[^}]*z-index:\s*1/s);
  assert.match(fx, /@keyframes ml-press-ripple\s*\{[\s\S]*?scale\(3\.4\)/);
  assert.match(fx, /@keyframes ml-press-ripple/);
  assert.match(css, /:active,[\s\S]*?\.ml-is-pressed/s);
  assert.match(css, /prefers-reduced-motion: reduce\)[\s\S]*?\.ml-press-ring\s*\{\s*animation:\s*none/s);
  assert.match(index, /PRESS_SELECTOR/);
  assert.match(index, /onPressFx/);
  assert.match(index, /ml-press-ring/);
  assert.match(index, /doc\.addEventListener\("pointerdown", onPressFx, true\)/);
  assert.match(index, /doc\.removeEventListener\("pointerdown", onPressFx, true\)/);
  assert.match(nativeCss, /--mln-overlay-texture:/);
  assert.match(nativeCss, /--mln-bar-texture:/);
  assert.match(nativeCss, /background-image:\s*var\(--mln-overlay-texture\)/);
});

test("增强：卡片内缘光、表盘外环、双层涟漪与更长清理窗口", () => {
  assert.match(css, /\.ml-stat\.is-accent\s*\{[^}]*inset 0 0 26px -8px/s);
  assert.match(css, /#ml-root \.ml-ring::after/);
  assert.match(css, /0 0 0 1px var\(--ml-press-ripple\),[\s\S]*?0 0 26px var\(--ml-press-glow\)/);
  assert.match(css, /\.ml-head\s*\{[^}]*background-image:/s);
  assert.match(index, /520\);/);
  assert.match(nativeCss, /scale\(\.972\)/);
  assert.match(nativeCss, /rgb\(190 255 240 \/ 6%\)/);
  assert.match(nativeCss, /#customOverlayTitle,[\s\S]*?background-image:\s*linear-gradient\(180deg,\s*var\(--mln-glow\)/s);
});

test("三套主题动效：环境光、侧栏光带、页签淡入、环形呼吸与三层关断", () => {
  for (const theme of ["fog", "school", "paper"]) {
    assert.match(css, new RegExp('#ml-root\\[data-theme="' + theme + '"\\][\\s\\S]{0,320}--ml-ambient-a'), "缺少面板环境光变量: " + theme);
    assert.match(nativeCss, new RegExp('data-ml-theme="' + theme + '"\\][\\s\\S]{0,420}--mln-bar-ambient'), "缺少原生侧栏光带变量: " + theme);
  }
  assert.match(fx, /@keyframes ml-panel-ambient\s*\{/);
  assert.match(css, /#ml-root\[data-theme="fog"\] \.ml-panel::after,[\s\S]*?animation:\s*ml-panel-ambient/s);
  assert.match(fx, /@keyframes ml-pane-in\s*\{/);
  assert.match(css, /#ml-root \.ml-pane\s*\{[^}]*animation:\s*ml-pane-in/s);
  assert.match(fx, /@keyframes ml-ring-breathe\s*\{/);
  assert.match(fx, /@keyframes mln-bar-drift\s*\{/);
  assert.match(nativeCss, /background-image:\s*var\(--mln-bar-ambient\),\s*var\(--mln-bar-texture\) !important/);
  assert.match(nativeCss, /background-size:\s*230% 100%,\s*230% 100%,\s*100% 100%,\s*100% 100%,\s*100% 100% !important/);
  assert.match(nativeCss, /\[data-ml-theme="fog"\] #ui-bar#ui-bar,[\s\S]*?animation:\s*mln-bar-drift/s);
  assert.match(nativeCss, /\[data-ml-motion="off"\] #ui-bar#ui-bar,[\s\S]*?animation:\s*none !important/s);
  assert.match(nativeCss, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#ui-bar#ui-bar,[\s\S]*?animation:\s*none !important/s);
});

test("320/390 窄屏：6 个页签等分，不得把最后一页裁出面板", () => {
  assert.match(css, /@media \(max-width:\s*430px\)[\s\S]*?\.ml-tab\s*\{[^}]*flex:\s*1 1 0[^}]*min-width:\s*0/s);
  assert.match(css, /@media \(max-width:\s*430px\)[\s\S]*?\.ml-tabs\s*\{[^}]*gap:\s*0[^}]*padding:\s*0 6px/s);
  assert.match(css, /@media \(max-width:\s*430px\)[\s\S]*?\.ml-tab-label\s*\{[^}]*font-size:\s*calc\(11px/s);
  assert.match(css, /#ml-root \.ml-tab-glint\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/s);
  assert.ok(!/#ml-root \.ml-tab\[aria-selected="true"\]::after/.test(css), "旧的分段下划线应已移除");
});

test("v1.1 性能/精美：通透度变量、dvh、滚动containment、passage 单飞", () => {
  assert.match(css, /--ml-surface-alpha:/);
  assert.match(css, /--ml-blur:/);
  assert.match(css, /backdrop-filter: blur\(var\(--ml-blur\)\)/);
  assert.match(css, /\[data-glass="0"\][\s\S]*?backdrop-filter: none/);
  assert.match(css, /84dvh/);
  assert.match(css, /contain: layout paint style/);
  assert.match(css, /contain: layout style/);
  assert.match(index, /passagePending/);
  assert.match(index, /requestAnimationFrame\(run\)/);
  assert.match(core, /glass: 60/);
  assert.match(css, /data-blur="off"/);
  assert.match(index, /state\.tab !== "settings"/);
  assert.match(index, /setSetting\("theme", v, false\)/);
});

test("原生样式：左轨保持 32px，字号提升且每格有左侧色条", () => {
  assert.match(nativeCss, /#mobileStats\s*\{[^}]*width:\s*32px[^}]*box-sizing:\s*border-box/s);
  assert.match(nativeCss, /#mobileStats \.stat\s*\{[^}]*border-left:\s*2px solid currentColor/s);
  assert.match(nativeCss, /#mobileStats \.stat\s*\{[^}]*font-size:\s*12\.5px/s);
  assert.match(nativeCss, /#mobileStats \.stat\.time\s*\{[^}]*min-height:\s*60px/s);
  assert.match(nativeCss, /#mobileStats \.stat::before\s*\{[^}]*linear-gradient\(90deg/s);
});

test("原生样式：顶栏两行网格，开关跨行、金额/时间在上、日期整行在下", () => {
  assert.match(nativeCss,
    /#stats#stats \.centered-elements\s*\{[^}]*grid-template-columns:\s*32px minmax\(0, 1fr\) 64px !important/s,
    "顶栏必须是 开关 / 金额 / 时间 三列，日期用整行");
  assert.match(nativeCss,
    /#stats#stats \.centered-elements\s*\{[^}]*grid-template-rows:\s*32px 32px !important/s);
  assert.match(nativeCss,
    /#stats#stats \.centered-elements\s*\{[^}]*grid-template-areas:\s*"toggle money time"\s*"toggle day day" !important/s,
    "原版式阅读顺序：开关跨两行，金额+时间在上，日期在下");
  assert.match(nativeCss,
    /@media \(max-width:\s*632px\)[\s\S]{0,500}#stats#stats \.centered-elements\s*\{[^}]*grid-template-columns:\s*28px minmax\(0, 1fr\) 58px !important/s,
    "632px 窄屏只保留三列，第 4 列 44px 会留下无法解释的空白");
  assert.match(nativeCss,
    /data-ml-chip="money"\] \.true\s*\{[^}]*white-space:\s*nowrap[^}]*overflow-wrap:\s*normal[^}]*word-break:\s*keep-all/s,
    "金额必须单行；overflow-wrap:anywhere 会把 £9,474.99 拆成多行");
  assert.match(nativeCss,
    /data-ml-chip="day"\]\s*\{[^}]*flex-direction:\s*row[^}]*white-space:\s*nowrap/s,
    "日期格必须横排单行，原 flex-column 会把图标与星期日压成两行");
  assert.match(nativeCss,
    /data-ml-chip="time"\]\s*\{[^}]*flex-direction:\s*row[^}]*align-items:\s*center[^}]*justify-content:\s*center/s,
    "时间格图标与 09:06 必须同排居中，原版就是时钟在左、时间在右");
  assert.match(nativeCss,
    /@media \(max-width:\s*632px\)[\s\S]{0,3600}data-ml-chip="day"\] img\s*\{[^}]*display:\s*block !important[^}]*width:\s*12px/s,
    "日期整行有 169px，日历图标应保留而不是让位");
  assert.match(nativeCss,
    /@media \(max-width:\s*632px\)[\s\S]{0,3600}data-ml-chip="time"\] \.clockContainer img\s*\{[^}]*display:\s*block !important[^}]*width:\s*13px/s,
    "58px 时间格足够放 13px 时钟图标，不应再隐藏");
  assert.match(nativeCss, /body\.has-images #storyCaptionDiv\s*\{[^}]*top:\s*var\(--ml-caption-top, 192px\)/s);
  assert.match(nativeCss, /body\.has-images #storyCaptionDiv\s*\{[^}]*left:\s*0 !important[^}]*width:\s*100% !important/s,
    "侧栏内层必须 left:0 + 100% 宽，left:24 会让 #ui-bar scrollWidth 超出 24px");
  assert.match(nativeCss, /#saves-list-container \.savesListRow\s*\{[^}]*max-height:\s*none !important/s);
  assert.match(nativeCss, /:is\(#saves-list-container,#savesListContainer\) \.savesListRow\[data-ml-save-empty="1"\]\s*\{[^}]*padding:/s);
  assert.match(nativeCss, new RegExp("#customOverlayContent" + FOREIGN_GUARD + " \\.saveMenuButton\\s*\\{[^}]*background:\\s*var\\(--mln-surface-2\\) !important", "s"));
  assert.match(nativeCss, new RegExp("#customOverlayContent" + FOREIGN_GUARD + " \\.saveMenuButton\\s*\\{[^}]*background:\\s*var\\(--mln-surface-2\\) !important", "s"));
  assert.match(nativeCss, new RegExp("#customOverlayContent" + FOREIGN_GUARD + " \\.saveButton input,[\\s\\S]{0,400}?background:\\s*var\\(--mln-surface-2\\) !important", "s"));
});

test("1.1.27 窄屏数值：状态条轨道回宽、时间/星期不换行、选项文字不再两字一行", () => {
  assert.match(nativeCss,
    /@media \(max-width:\s*632px\)[\s\S]{0,3600}#statmeters\s*\{[^}]*width:\s*100% !important[^}]*max-width:\s*100% !important/s,
    "632px 窄屏下状态卡必须占满 #stats 内容宽，不能停在 184px");
  assert.match(nativeCss,
    /@media \(max-width:\s*632px\)[\s\S]{0,3600}#statmeters > div\[id\$="caption"\]\s*\{[^}]*grid-template-columns:\s*46px minmax\(0, 1fr\) !important[^}]*padding:\s*7px 70px 7px 0 !important/s,
    "标签列 46px + 右留白 70px 才能把七行进度条留到 64px，原 54/68 会压到 32px");
  assert.match(nativeCss,
    /@media \(max-width:\s*632px\)[\s\S]{0,3600}data-ml-chip="time"\] \.clockContainer img\s*\{[^}]*display:\s*block !important[^}]*width:\s*13px/s,
    "58px 时间格容得下 13px 图标 + 09:06，图标应保留");
  assert.match(nativeCss,
    /@media screen and \(max-width:\s*632px\)[\s\S]{0,3600}\.ml-option-group\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*gap:\s*5px[^}]*padding:\s*0 8px/s,
    "窄屏默认单列：:has 不可用时链接仍占满整行");
  assert.match(nativeCss,
    /\.ml-option-group:has\(> img\.icon, > \.icon-container, > \.icon\)\s*\{[^}]*grid-template-columns:\s*20px minmax\(0, 1fr\)/s,
    "只有组内确实有图标时才分出 20px 图标列");
  assert.match(nativeCss,
    /\.ml-option-group > \.icon-container,[\s\S]{0,260}width:\s*20px !important[\s\S]{0,160}min-width:\s*20px !important/s,
    "icon-container 包装层必须一起收窄，否则 28px 会压进文字列");
  assert.doesNotMatch(strip(native.slice(native.indexOf("function markCaptionAnchor"), native.indexOf("function markStats"))),
    /getBoundingClientRect/,
    "正文锚点不能再用视觉坐标 ÷ zoom 反推，必须直接吃 #img 布局高");
});

test("1.2.0：立绘与侧栏保持 1.1.22 游戏原生几何，不再重写画布", () => {
  const clean = strip(nativeCss);
  assert.doesNotMatch(clean, /body\.has-images #img\s*\{/,
    "不得覆盖 #img 的 left/width/height：原生 216×192、left:64 是 1.1.22 的正常画布");
  assert.doesNotMatch(clean, /#img > canvas\s*\{/,
    "不得覆盖 #img canvas：原生 256×256、left:-32，缩放会让人物与背景错位");
  assert.doesNotMatch(clean, /#ui-bar#ui-bar\s*\{[^}]*\bwidth\s*:/s,
    "不得改 #ui-bar 宽度：原生 17.5em=280，压到 216 会把画布挤进窄栏");
  assert.match(clean, /#stats\s*\{[^}]*width:\s*100% !important/s,
    "金额卡必须填满原生 280 侧栏，不能停在 248");
});

test("1.3.1：窄屏展开侧栏不再把 #story 挤成两字列", () => {
  const clean = strip(nativeCss);
  assert.doesNotMatch(clean,
    /@media[^{]*max-width:\s*632px[^{]*\{[\s\S]*?#ui-bar:not\(\.stowed\) ~ #story[\s\S]*?margin-left:\s*17\.5em/s,
    "不得在窄屏把 #story 左边距改成 17.5em：360 级视口只剩两个字宽");
  assert.match(clean,
    /@media[^{]*max-width:\s*560px[^{]*\{[\s\S]*?html\[data-ml-native="on"\]\[data-ml-sidebar-open="1"\] #story\s*\{[^}]*visibility:\s*hidden !important/s,
    "560px 以下（与面板抽屉同阈值）侧栏实际展开时必须走抽屉语义，隐藏正文而不是压窄正文");
  assert.match(clean,
    /html\[data-ml-native="on"\]\[data-ml-sidebar-open="1"\] #story\s*\{[^}]*pointer-events:\s*none !important/s,
    "抽屉状态下隐藏正文需同时断掉指针事件");
  assert.match(clean,
    /html\[data-ml-native="on"\]\[data-ml-sidebar-open="1"\] #customOverlayContainer\s*\{[^}]*visibility:\s*visible !important[^}]*pointer-events:\s*auto !important/s,
    "侧栏展开时若原生弹层容器落在 #story 子树内，必须显式恢复可见与可点，不能把作弊层一起隐藏");
  assert.match(clean,
    /@media\s*\(max-width:\s*899px\)\s*\{[\s\S]{0,900}html\[data-ml-native="on"\] #customOverlay\s*\{[^}]*left:\s*0 !important[^}]*right:\s*0 !important/s,
    "容器已全视口，<=899px 必须把原版 -17.6em 的弹性层左移封回 0，否则 CE 层会跑到屏幕左外、右半屏空白");
  assert.match(native, /function syncSidebar\(\)[\s\S]{0,260}getBoundingClientRect\(\)/,
    "侧栏开合必须读真实几何，不能只按 .stowed class 判断");
  assert.match(native, /setAttribute\("data-ml-sidebar-open"/,
    "侧栏实际可见时才挂 data-ml-sidebar-open");
  assert.doesNotMatch(native, /closest\("#ui-bar-toggle, #ui-bar-history, #ui-bar"\)/,
    "侧栏内部普通点击不得触发抽屉状态重算，否则点金额/时间条会把正文隐藏");
  assert.match(native, /if \(t\.closest && t\.closest\("#ui-bar-toggle"\)\)/,
    "只有真实开合按钮可以触发抽屉状态同步");
});

test("1.3.1：手机抽屉安全边、横屏宽度与 320 紧凑尺寸", () => {
  assert.match(css,
    /#ml-root\[data-sheet="1"\] \.ml-panel \{[\s\S]{0,200}left:\s*max\(var\(--ml-safe-l\),\s*8px\)[\s\S]{0,120}right:\s*max\(var\(--ml-safe-r\),\s*8px\)/s,
    "抽屉必须留 8px 安全边，不能压到刘海/圆角边缘");
  assert.match(css,
    /@media \(orientation:\s*landscape\) and \(max-height:\s*520px\)[\s\S]{0,500}#ml-root\[data-sheet="1"\] \.ml-panel \{[\s\S]{0,260}width:\s*min\(560px,\s*calc\(100vw - 16px\)\)/s,
    "844×390 横屏抽屉应收成居中 560px，不能拉成整屏横条");
  assert.match(css,
    /@media \(max-width:\s*360px\)[\s\S]{0,1800}#ml-root\[data-sheet="1"\] \.ml-ring \{[\s\S]{0,80}width:\s*88px; height:\s*88px/s,
    "320 级小屏圆环收到 88px，给金额卡/状态卡让出高度");
  assert.match(css,
    /@media \(max-width:\s*360px\)[\s\S]{0,1200}#ml-root\[data-sheet="1"\] \.ml-body \{[\s\S]{0,60}padding:\s*12px 12px 16px/s,
    "320 级小屏正文内边距收到 12px");
});

test("1.3.1：原生菜单打开时灯台浮卡必须退场", () => {
  assert.match(native, /function nativeLayerVisible\(overlay\)[\s\S]*?classList\.contains\("hidden"\)[\s\S]*?getBoundingClientRect/s,
    "原生层可见性必须同时看 hidden/display/几何，不能只看 class");
  assert.match(native,
    /if \(visible && !state\.overlayVisible\)[\s\S]{0,300}MapleLantern\.close\(\)/s,
    "原生层由隐藏变可见时必须关闭灯台浮卡，避免叠加");
  assert.match(native, /state\.overlayVisible = nativeLayerVisible\(overlay\)/,
    "观察器初始化必须记录当前可见态，不能把首次可见误判成跳变");
  assert.match(native,
    /function ensureOverlayFinder\(\)[\s\S]{0,600}observe\(doc\.documentElement,\s*\{\s*childList:\s*true,\s*subtree:\s*true\s*\}\)/s,
    "SugarCube 替换 #customOverlay 后必须按当前节点重挂，观察器要挂在稳定的 documentElement 上");
  assert.match(native,
    /data-ml-entry[\s\S]{0,400}nativeLayerVisible\(ov\)[\s\S]{0,200}MapleLantern\.close\(\)/s,
    "点击打开原生菜单时必须按实际几何补关一次；从灯台入口反开浮卡时跳过");
});

test("第三方 cheat overlay：customOverlayContent 排除 CE，CE 面板保留主题材质", () => {
  assert.match(nativeCss, new RegExp("#customOverlayContent" + FOREIGN_GUARD + " \\{", "s"));
  assert.match(nativeCss, /#customOverlay #cheat_extended_options[\s\S]{0,500}background-color:\s*rgba\(23, 28, 34, \.76\) !important/s);
  assert.match(nativeCss, /#customOverlay #cheat_extended_options[\s\S]{0,500}background-image:\s*var\(--mln-overlay-texture\) !important/s);
  assert.match(nativeCss, /#customOverlay \.dol-shadow[\s\S]{0,300}background-color:\s*rgba\(18, 22, 27, \.58\) !important/s);
  assert.match(nativeCss, /#customOverlay \.dol-shadow[\s\S]{0,300}background-image:\s*var\(--mln-overlay-texture\) !important/s);
  assert.match(nativeCss, /#cheat_extended_options ~ \* \.settingsGrid[\s\S]{0,300}grid-template-columns:\s*minmax\(0,\s*1fr\) !important/s);
  assert.match(nativeCss, /#customOverlay \.CEtab[\s\S]{0,300}flex-wrap:\s*nowrap !important/s);
  assert.match(nativeCss, /#customOverlay #cheat_extended_options\s*\{[\s\S]{0,200}display:\s*flex !important/s,
    "1.20.4 的 grid 页签必须改回 flex 才能单行");
  assert.match(nativeCss, /data-mln-ce-page="teleport"/, "传送页需要独立标记，不能误伤其它页");
  assert.doesNotMatch(nativeCss, /#customOverlay:has\(#cheat_extended_options/,
    "CE 关键规则不得依赖 :has()");
});

test("1.4.11：属性卡只换皮不改原生排版，所有 characteristic 列表不得被 grid 覆盖", () => {
  const charStart = nativeCss.indexOf(".characteristic-box-list {");
  const relationStart = nativeCss.indexOf(".relation-box-list {", charStart);
  assert.ok(charStart > -1 && relationStart > charStart, "属性卡规则区必须存在");
  const relationPrefix = nativeCss.lastIndexOf("html[data-ml-native", relationStart);
  const charBlock = nativeCss.slice(nativeCss.lastIndexOf("html[data-ml-native", charStart), relationPrefix);
  assert.equal((charBlock.match(/html\[data-ml-native="on"\] #customOverlayContent/g) || []).length, 0,
    "属性卡皮肤必须全部挂在 data-ml-opt-overlay 上，关闭开关才能回原版卡片");
  assert.match(nativeCss, /\[data-ml-opt-overlay="1"\][^{]*\.characteristic-box-list[\s\S]{0,180}display:\s*flex[\s\S]{0,120}flex-wrap:\s*wrap/s,
    "通用属性卡列表必须保留原生 flex 换行，皮肤不得改布局");
  assert.doesNotMatch(charBlock, /grid-template-columns|display:\s*grid/,
    "属性卡规则区不得再出现 grid，否则属性/技能/成绩页会被同一套覆盖改坏");
  assert.match(nativeCss, /#sex-diagram \.characteristic-box-list \{[\s\S]{0,260}display:\s*flex[\s\S]{0,260}flex-flow:\s*column nowrap[\s\S]{0,120}width:\s*50%/s,
    "#sex-diagram 必须还原原版左右 50% 双列，不能继承通用列表布局");
  assert.match(nativeCss, /#sex-diagram \.characteristic-box-list > \.sex-diagram-box \{[\s\S]{0,160}display:\s*flex[\s\S]{0,120}width:\s*100%/s,
    "左右列的每个 sex-diagram-box 必须撑满列宽");
  assert.match(nativeCss, /@media \(max-width: 450px\)[\s\S]{0,320}#sex-diagram \.characteristic-box-list[\s\S]{0,80}width:\s*100%/s,
    "窄屏必须回到原版单列双卡布局，不能留 50% 半宽列");
  const relationRule = nativeCss.slice(relationStart, nativeCss.indexOf("}", relationStart));
  assert.doesNotMatch(relationRule, /display:|grid-template-columns|flex-direction/,
    "社交页 .relation-box-list 也必须保留原生 grid/flex 列数，皮肤不得压成单列");
  assert.doesNotMatch(nativeCss, /#global-recognition[\s\S]{0,100}display:\s*grid/,
    "#global-recognition 必须保留原版 flex-wrap，不能再写死两列");
});

test("1.4.12：CE 设置页恢复桌面双列，且不得外溢到原生 Options", () => {
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv\) \.settingsGrid[\s\S]{0,500}grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(48\.5%,\s*1fr\)\) !important/s,
    "CE 桌面格子必须回到原版 48.5% 双列，不能再按 520px 退成手机单列");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv\) \.settingsGrid[\s\S]{0,500}align-items:\s*stretch !important/s,
    "同一行选项卡必须等高拉伸，不能按内容高度各自起排造成错位");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv\) \.numberStepperContainer[\s\S]{0,260}max-width:\s*100% !important[\s\S]{0,260}flex-wrap:\s*wrap !important/s,
    "stepper 容器必须收回格子宽度，并允许箭头组换行而不是横向压到邻格");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv\) \.numberStepper[\s\S]{0,300}flex:\s*0 0 28px !important[\s\S]{0,220}margin:\s*0 !important[\s\S]{0,120}padding:\s*0 !important/s,
    "六枚箭头必须固定 28px 且不吃外距，否则会撑破半宽格子");
  const stepper28 = nativeCss.indexOf("flex: 0 0 28px !important");
  const desktopGate = nativeCss.lastIndexOf("@media (min-width: 900px)", stepper28);
  assert.ok(stepper28 > -1 && desktopGate > -1 && stepper28 - desktopGate < 1200,
    "28px 紧凑箭头必须收进桌面媒体查询，手机端保留 34px 触控区");
  assert.ok(nativeCss.indexOf("@media (max-width: 899px)") > stepper28,
    "28px 规则不得落进手机媒体块");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv\) \.settingsGrid > \*[\s\S]{0,220}overflow:\s*visible !important/s,
    "选项卡不能再被 overflow:hidden 裁掉 tooltip/焦点框");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv\) \.titlePercentage[\s\S]{0,200}flex:\s*1 1 60px !important/s,
    "中央数值区必须允许收缩并省略长数值，不得把两侧箭头挤出去");
  const settingsSelectorStart = nativeCss.indexOf(":is(#customOverlay #cheat_extended_options ~ *,#customOverlay #CE_settingsDiv) .settingsGrid");
  assert.ok(settingsSelectorStart > -1, "必须能定位 CE settingsGrid 规则");
  assert.doesNotMatch(nativeCss.slice(settingsSelectorStart, settingsSelectorStart + 900), /#customOverlayContent/,
    "CE settingsGrid 规则不得再挂 #customOverlayContent，否则原生 Options 也被压成单列");
});

test("1.1.18：CE 关闭后必须还原 #customOverlay 内联样式", () => {
  assert.match(native, /function rememberCeStyle/,
    "打开 CE 前必须记录 #customOverlay / #customOverlayContent 的原始 inline style");
  assert.match(native, /function restoreCeStyle/,
    "CE 关闭、隐藏或被主菜单复用时必须整体还原");
  assert.match(native, /removeAttribute\("style"\)/,
    "原始没有 style 的宿主要移除整个 style 属性，不能留空壳");
  assert.match(native, /removeProperty\(CE_LAYOUT_PROPS\[p\]\)/,
    "即使 CE 自己写过 width:auto，关闭时也要清掉布局属性");
  assert.match(native, /function isCePanelActive/,
    "必须同时判断页签存在与 overlay 是否 hidden");
  assert.match(native, /if \(!active\)[\s\S]{0,140}restoreCeStyle/,
    "watchOverlay 发现 CE 不活跃时要立刻还原，不能直接 return");
  assert.match(native, /imp\(overlay, "width", "calc\(100vw - 16px\)"\)/,
    "手机端宽度必须是明确视口宽度，不能用 width:auto 收缩到左侧");
  assert.doesNotMatch(native, /imp\(overlay, "width", "auto"\)/,
    "width:auto 会在主菜单复用 overlay 时留下收缩态");
});

test("1.1.15：正文图标按钮不得被 background 简写清空图标", () => {
  const base = nativeCss.match(/html\[data-ml-native="on"\] #passages \.passage button\s*\{([^}]*)\}/);
  assert.ok(base, "必须能定位正文按钮基础规则");
  assert.match(base[1], /background-color:\s*var\(--mln-surface-2\)/,
    "正文按钮必须用 background-color 设底色");
  assert.doesNotMatch(base[1], /background\s*:\s*var/,
    "background 简写会同时清掉 background-image/size/position，图标按钮会变成空框");
  const hover = nativeCss.match(/html\[data-ml-native="on"\] #passages \.passage button:hover\s*\{([^}]*)\}/);
  assert.ok(hover, "必须能定位正文按钮 hover 规则");
  assert.match(hover[1], /background-color:\s*var\(--mln-surface-3\)/);
  assert.doesNotMatch(hover[1], /background\s*:\s*var/,
    "hover 也不能用简写，否则按下/悬停时图标再次消失");
});

test("1.1.16/1.1.17：正文按钮规则不得接管原生弹层，紧凑 settingsGrid 恢复原版几何", () => {
  const scoped = (nativeCss.match(/#passages \.passage button/g) || []).length;
  assert.equal(scoped, 6, "基础/hover/active/focus-visible 与赛博朋克两条都必须收在 .passage 内");
  assert.doesNotMatch(nativeCss, /#passages button\s*\{/,
    "不能再有裸 #passages button 规则：customOverlayContainer 就在 PassageFooter 里；正文规则必须收在 .passage");
  assert.match(nativeCss,
    /\.settingsGrid button[\s\S]{0,220}min-height:\s*32px !important/s,
    "枯木逢春/原版作弊页的紧凑按钮不能被 44px 触控规则撑高");
  assert.match(nativeCss,
    /\.settingsGrid \.numberStepper[\s\S]{0,320}padding:\s*0 !important/s,
    "numberStepper 箭头必须恢复原版 32px 紧凑内边距");
  assert.match(nativeCss,
    /\.settingsGrid \.numberStepper[\s\S]{0,320}width:\s*32px !important/s,
    "numberStepper 箭头宽度必须封回 32px");
  assert.match(nativeCss,
    /#customOverlayContainer button:active\s*\{[\s\S]{0,160}transform:\s*none !important/s,
    "弹层按钮按下不得缩放：触摸边缘点击会因缩小被判为移出而丢 click");
});

test("1.1.12：移动端背景锚定视口，长页底部不再露出渐变截止段", () => {
  assert.match(nativeCss,
    /@media \(max-width: 899px\)[\s\S]*?html\[data-ml-native="on"\]\s*\{[\s\S]*?background-attachment:\s*fixed !important/s,
    "根背景必须 fixed，否则滚动到长页末尾会只剩纯色");
  assert.doesNotMatch(nativeCss, /background-attachment:\s*scroll !important/,
    "scroll 会让根元素绘制区止于视口，产生截断");
  assert.match(nativeCss, /background-color:\s*var\(--mln-bg\) !important/s,
    "fixed 被旧 WebView 忽略时仍要有底色兜底");
  assert.match(native, /selectedLabel\.indexOf\("传送"\) >= 0/);
  assert.match(native, /setAttribute\("data-mln-ce-page", "teleport"\)/);
  assert.match(native, /data-mln-ce-loc-row/);
  assert.match(native, /function findCeSelectedTab/);
  assert.match(nativeCss, /data-mln-ce-loc-row="1"/);
  assert.match(native, /flex-direction", "column"/);
});

test("普通弹层：主题页纹理与半透明材质透出，不只是纯色底", () => {
  assert.match(nativeCss, /background-color:\s*color-mix\(in srgb,\s*var\(--mln-bg\) 58%,\s*transparent\)/);
  assert.match(nativeCss, /background-image:\s*var\(--mln-overlay-texture\),\s*var\(--mln-page-texture\)/);
  assert.match(nativeCss, /background-color:\s*color-mix\(in srgb,\s*var\(--mln-surface\) 62%,\s*transparent\)/);
  assert.match(nativeCss, /#customOverlayContent[\s\S]{0,300}background-image:\s*var\(--mln-page-texture\),\s*var\(--mln-surface-texture\)/);
  /* 旧 WebView 不支持 :has()/color-mix() 时的 rgba + 页纹理兜底。 */
  assert.match(nativeCss, /#customOverlay:not\(\[data-overlay="modloader"\]\)\s*\{[\s\S]{0,200}background-color:\s*rgba\(11, 13, 16, \.58\)/);
});

test("赛博朋克主题：默认调色板、双 CSS 入口与设置项齐全，旧主题仍保留", () => {
  assert.match(core, /theme: "cyberpunk"/);
  assert.match(core, /cyberpunk:\s*\{/);
  assert.match(index, /value: "cyberpunk", label: s\["theme\.cyberpunk"\]/);
  assert.match(css, /#ml-root\[data-theme="cyberpunk"\][\s\S]*--ml-accent:\s*#00E5FF/);
  assert.match(css, /赛博朋克主题装饰/);
  assert.match(nativeCss, /data-ml-theme="cyberpunk"\]\s*\{[\s\S]*--mln-accent:\s*#00E5FF/);
  assert.match(nativeCss, /赛博朋克主题装饰/);
  assert.match(nativeCss, /data-ml-theme="cyberpunk"\] #customOverlay:not\(:has\(#cheat_extended_options[\s\S]{0,400}background-color:\s*color-mix\(in srgb,\s*#05070F 58%,\s*transparent\)/s);
  assert.match(nativeCss, /data-ml-theme="cyberpunk"\] #customOverlayContent:not\(:has\(#cheat_extended_options[\s\S]{0,400}background-color:\s*color-mix\(in srgb,\s*#080D19 62%,\s*transparent\)/s);
  for (const old of ["amber", "jade", "graphite", "star"]) {
    assert.ok(core.includes("theme." + old), "旧主题 " + old + " 不应被删除");
  }
});

test("新增主题：雾港/旧校舍/纸灯 的调色板、双语文案、设置项与双 CSS 入口齐全", () => {
  for (const name of ["fog", "school", "paper"]) {
    assert.match(core, new RegExp(name + ":\\s*\\{"), "缺少调色板: " + name);
    assert.match(core, new RegExp('"theme\\.' + name + '"'), "缺少中文主题名: " + name);
    assert.match(index, new RegExp('value: "' + name + '", label: s\\["theme\\.' + name + '"\\]'), "缺少设置项: " + name);
    assert.match(css, new RegExp('#ml-root\\[data-theme="' + name + '"\\]'), "缺少面板主题块: " + name);
    assert.match(nativeCss, new RegExp('data-ml-theme="' + name + '"\\]\\s*\\{'), "缺少原生主题块: " + name);
  }
  assert.equal((core.match(/theme\.fog/g) || []).length >= 2, true, "中英文都要有雾港");
  assert.equal((core.match(/theme\.school/g) || []).length >= 2, true, "中英文都要有旧校舍");
  assert.equal((core.match(/theme\.paper/g) || []).length >= 2, true, "中英文都要有纸灯");
  assert.match(nativeCss, /data-ml-theme="paper"\] #mobileStats \.stat\.red\s*\{[^}]*#9E2F25/s);
  assert.match(nativeCss, /data-ml-theme="paper"\] #passages \.passage \.gold\s*\{[^}]*#6F5210/s);
  assert.match(css, /data-ml-theme="paper"\] #passages \.passage \.ConveniencestoreGoodsClass > div\s*\{[^}]*color:\s*#E8DFD2/s,
    "纸灯浅色主题下，原版优化便利店的深底商品卡必须恢复浅字，不能继承深墨正文色");
  assert.doesNotMatch(css, /data-ml-theme="paper"\] #passages \.passage :is\([^)]*traitList \.trait/s,
    "纸灯下不得把 .traitList .trait 统一写浅字：基础游戏特质卡只有边框没有背景，浅底浅字会看不清");
  assert.match(css, /data-ml-theme="paper"\] #passages \.passage \.ConveniencestoreGoodsClass > div \.black\s*\{[^}]*#E8DFD2/s,
    "便利店深色卡内的 .black 说明文字也必须回到浅字");
  assert.match(css, /:not\(\[data-ml-theme="paper"\]\) #customOverlayContent \.black\s*\{[^}]*var\(--mln-text\)/s,
    "非纸灯主题下，第三方浮窗里的 .black 说明文字必须改成当前主题正文色，避免黑底黑字");
  assert.match(css, /data-ml-theme="paper"\] #passages \.passage \.ConveniencestoreGoodsClass > div \.gold\s*\{[^}]*var\(--gold/s,
    "深色卡片内的 .gold 语义色必须回到原生亮色，不能被纸灯深金覆盖");
  assert.match(nativeCss, /data-ml-theme="paper"\] #passages \.passage \.teal\s*\{[^}]*#0E5F5F/s);
  assert.match(nativeCss, /data-ml-theme="paper"\] #startCaption \.gold\s*\{[^}]*#6F5210/s);
  assert.match(nativeCss, /data-ml-theme="paper"\] #startCaption \.link-external\s*\{[^}]*#2C4F85/s);
  assert.match(nativeCss, /data-ml-theme="paper"\] #ui-bar a\.link-external\s*\{[^}]*#2C4F85/s);
  assert.match(nativeCss, /data-ml-theme="paper"\] #menu a\s*\{[^}]*var\(--mln-text\)/s);
  assert.match(nativeCss, /data-ml-theme="paper"\] #ui-bar \.macro-button\s*\{[^}]*background:\s*var\(--mln-surface-2\)/s);
  assert.ok(nativeCss.includes('.gold { color: #6F5210; }'));
  assert.ok(nativeCss.includes('.linkBlue { color: #2C4F85; }'));
  assert.ok(nativeCss.includes('a.link-external { color: #2C4F85; }'));
  assert.ok(nativeCss.includes('#customOverlay:not([data-overlay="modloader"]):not(:has('));
  assert.match(nativeCss, /data-ml-theme="fog"\] #history-backward/);
  assert.match(nativeCss, /data-ml-theme="school"\] #history-backward/);
  assert.match(nativeCss, /data-ml-theme="fog"\] #passages \.passage \.red\s*\{[^}]*#E58C7F/s);
  assert.match(nativeCss, /data-ml-theme="school"\] #passages \.passage \.red\s*\{[^}]*#E08373/s);
  assert.match(nativeCss, /data-ml-theme="fog"\] #gameVersionDisplay/);
  assert.match(nativeCss, /data-ml-theme="school"\] #gameVersionDisplay/);
  assert.match(nativeCss, /data-ml-theme="paper"\] #gameVersionDisplay/);
  assert.match(index, /"ml-seg--themes"/);
  assert.match(css, /\.ml-seg--themes\s*\{[^}]*grid-template-columns:\s*repeat\(3/s);
});

test("render.js：apiVersion 守卫、无定时轮询、销毁解绑齐全", () => {
  assert.match(index, /apiVersion !== 1/);
  assert.ok(!/setInterval/.test(index), "不允许常驻轮询");
  for (const ev of ["passageend", "resize", "keydown", "pointerdown"]) {
    assert.ok(index.includes(ev), "缺少 " + ev + " 监听");
  }
  assert.ok(/removeEventListener/.test(index));
  assert.ok(/removeChild/.test(index));
  assert.equal((index.match(/window\.MapleLantern = \{/g) || []).length, 1);
});

test("只读：代码里没有对 State.variables 的赋值表达式", () => {
  const bad = /State\.variables\s*[\.\[]\s*[A-Za-z_$][\w$]*\s*[+\-*/]?=([^=]|$)/g;
  assert.equal((index.match(bad) || []).length, 0, "出现 State.variables 写入");
  assert.ok(!/State\.variables\s*=(?!=)/.test(index));
});

test("层叠：z-index 89900 低于 SugarCube 浮层（100000）", () => {
  assert.match(css, /z-index: 89900/);
  assert.ok(89900 < 100000 && 89900 > 10000);
});

test("原型：先 CSS 后脚本，core 先于 render", () => {
  const link = html.indexOf("../src/style.css");
  const fxLink = html.indexOf("../src/effects.css");
  const c = html.indexOf("../src/core.js");
  const i = html.indexOf("../src/render.js");
  assert.ok(link > 0 && fxLink > link && c > fxLink && i > c, "加载顺序必须是 css -> effects -> core -> render");
});

test("体积预算：UI 包源码应远小于 1MB", () => {
  for (const f of ["core.js", "maplelantern-native.js", "render.js", "style.css", "maplelantern-native.css", "effects.css", "boot.json"]) {
    const size = fs.statSync(path.join(SRC, f)).size;
    /* 1.4.20：原生层新增手机窄屏安全网格与 numberStepper 还原，CSS 从约 204KB
       增至约 207KB；上限随实现上调到 220KB，仍远低于 1MB。 */
    assert.ok(size < 220 * 1024, f + " 过大: " + size);
  }
  assert.ok(core.length > 1000 && index.length > 1000 && native.length > 1000);
});


test("1.1.22：第三方联动只读摘要 + 独立设置入口", () => {
  assert.match(index, /function renderBridge\(/);
  assert.match(index, /data-ml-bridge/);
  assert.match(index, /function openThirdParty\(/);
  assert.match(css, /#ml-root \.ml-btn\.ml-bridge-open \{/);
  assert.match(css, /min-height: 44px;/);
  assert.doesNotMatch(index, /State\.variables\s*\.\s*Dynamicest|State\.variables\s*\.\s*foreground_image1\s*=/, "只能读第三方状态，不能写");
});

test("1.1.21：弹层容器的层级必须低于 Dynamicest 浮动提醒", () => {
  const block = nativeCss.match(/html\[data-ml-native="on"\] #customOverlayContainer\s*\{[^}]*\}/);
  assert.ok(block, "必须存在 #customOverlayContainer 规则");
  assert.match(block[0], /z-index:\s*1000\b/,
    "弹层容器不能高于 Dynamicest 的 #display-dynamicest（1001），否则提醒会被全屏遮罩盖住");
  assert.doesNotMatch(block[0], /z-index:\s*1200\b/);
  assert.match(nativeCss, /z-index:\s*1201/,
    "弹层内容自身仍要在容器内保持在遮罩之上");
});

test("原生样式：所有规则都以原生开启/让位属性为前导，且不动 #ml-root", () => {
  const selectors = strip(nativeCss).match(/[^{}]+(?=\{)/g) || [];
  for (const raw of selectors) {
    const sel = raw.trim();
    if (!sel || sel.startsWith("@") || /^\d+%$/.test(sel) || /^(from|to)$/.test(sel)) { continue; }
    assert.ok(/^html\[data-ml-native="(on|off)"\]/.test(sel), "未作用域的原生选择器: " + sel);
    assert.ok(!sel.includes("#ml-root"), "原生层不应命中浮卡: " + sel);
  }
  assert.match(nativeCss, /#statmeters > div\[id\$="caption"\]::after/);
  assert.match(nativeCss, /content: attr\(data-ml-readout\)/);
  assert.match(nativeCss, /a\.link-internal\.macro-link/);
  assert.match(nativeCss, /\.settingsToggleItem/);
  assert.match(nativeCss, /appearance: none !important/);
  assert.match(nativeCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("第三方美化页：入口不再被跳过，默认不套原生层，设置页有启用开关", () => {
  assert.ok(!native.includes("if (thirdPartyOverlay(overlay)) { return; }"),
    "入口插入不得再被第三方检测直接拦住");
  assert.match(native, /thirdPartyNative/);
  assert.match(native, /data-ml-thirdparty/);
  assert.match(nativeCss, /html\[data-ml-native="off"\] \.ml-native-entry/,
    "原生层关闭时入口必须有可用的基础样式");
  assert.match(core, /thirdPartyNative: false/);
  assert.match(core, /"settings\.thirdPartyNative"/);
  assert.match(index, /switchControl\("thirdPartyNative"/);
});

test("原生脚本：只读标记、无轮询、恒按开关挂载与幂等入口", () => {
  assert.match(native, /data-ml-native/);
  assert.match(native, /data-ml-stat-card/);
  assert.match(native, /data-ml-value/);
  assert.match(native, /data-ml-entry/);
  assert.match(native, /fitSidebarLabels/);
  assert.match(native, /data-ml-label/);
  assert.match(native, /apiVersion !== 1/);
  assert.ok(!/setInterval/.test(native), "原生层不允许常驻轮询");
  assert.match(native, /requestAnimationFrame/);
  assert.match(native, /passageend/);
  assert.ok(native.includes('data-ml-entry="panel"'));
  assert.ok(native.includes("querySelector"));
  assert.ok(!/State\.variables\s*[.\[]\s*[A-Za-z_$][\w$]*\s*[+\-*/]?=([^=]|$)/g.test(native));
});

test("1.1.8：正文选项按压、图标同卡、六主题整页背景与宿主不再关层", () => {  assert.ok(index.includes('.ml-option-group,a.link-internal.macro-link[data-ml-option=\\"1\\"]'),
    "正文选项必须进入 PRESS_SELECTOR");
  assert.match(index, /mln-press-ring/);
  assert.match(index, /mln-is-pressed/);
  assert.match(nativeCss, /\.ml-option-group > img\.icon/);
  assert.match(nativeCss, /grid-template-columns: 28px minmax\(0, 1fr\)/);
  assert.match(nativeCss, /\.mln-press-ring/);
  assert.match(fx, /@keyframes mln-press-ripple/);
  assert.match(nativeCss, /html\[data-ml-native="on"\] body\s*\{[\s\S]*?background-color: transparent !important/);
  assert.match(nativeCss, /html\[data-ml-native="on"\]\s*\{[\s\S]*?background-image:\s*radial-gradient\(132% 92% at 50% -14%[\s\S]*?var\(--mln-page-texture\) !important/);
  assert.match(nativeCss, /background-attachment: fixed/);
  /* 1.3.5：星空页底从 87 层压到 ≤9 层，逐点星层交给天空层的平铺星尘。 */
  const starBlock = nativeCss.match(/html\[data-ml-native="on"\]\[data-ml-theme="star"\]\s*\{([\s\S]*?)\n\}/);
  assert.ok(starBlock, "星空主题变量块缺失");
  const pageStart = starBlock[1].indexOf("--mln-page-texture:");
  assert.ok(pageStart >= 0, "星空主题必须有 page texture");
  const pageTexture = starBlock[1].slice(pageStart);
  assert.ok((pageTexture.match(/gradient\(/g) || []).length <= 9,
    "星空 page texture 必须压到 9 层以内");
  assert.ok(!/radial-gradient\(3\.2px 3\.2px at 33% 15%/.test(pageTexture),
    "旧的 78 颗逐点星层必须移除");
  assert.match(nativeCss, /br:has\(\+ a\.macro-link\)/);
  assert.ok(native.includes("var on = state.settings.native !== false;"),
    "检测到 DoLGameUI 不能把本包原生层整层关掉");
  assert.ok(!native.includes("state.settings.native !== false && !state.host"));
});

test("1.1.9：Android 真实 DOM 兜底——晚替换链接重组、CE 不超视口、无 :has/color-mix 也能生效", () => {
  /* 选项：链接类名不保真、链接晚于图标重建时仍要回到同一张卡。 */
  assert.match(native, /a\.link-internal\.macro-link, a\.macro-link, a\.link-internal/);
  assert.match(native, /function repairGroups\(/);
  assert.match(native, /MutationObserver/);
  /* 1.1.11：补扫由固定 10 拍改为“连续两拍无变化即停”，晚到节点由 observer 兜底。 */
  assert.match(native, /function packSignature\(/);
  assert.match(native, /state\.stableTicks < 2/);
  assert.match(native, /a\.link-internal, a\.macro-link, img\.icon, \.icon-container/);
  /* CE：不依赖 :has() 的实体规则 + 视口硬约束 + 箭头回缩。 */
  assert.match(nativeCss, /#customOverlay #cheat_extended_options/);
  assert.doesNotMatch(nativeCss, /#customOverlay:has\(#cheat_extended_options/,
    "CE 关键规则不得再依赖 :has()（Android WebView 可能整条丢弃）");
  assert.match(nativeCss, /max-width: calc\(100vw - 16px\) !important/);
  assert.match(nativeCss, /grid-template-columns: minmax\(0, 1fr\) !important/);
  assert.match(nativeCss, /#cheat_extended_options:not\(\.CE-two-level-tabs\) > button/);
  assert.match(native, /normalizeCheatLayout/);
  assert.match(native, /\[<>‹›←→«»▲▼◀▶⏪⏩\]/);
  /* CE 面板是点开 OPTIONS 后异步挂载的，必须单独观察 #customOverlay；否则
     inline 约束根本不会在真实面板上执行，1.1.8 的溢出就是这样漏掉的。 */
  assert.match(native, /function watchOverlay\(/);
  assert.match(native, /overlayObserver/);
  assert.match(native, /CE-close-btn/);
  /* 图标与链接被拆散时，还要能从图标向后接回最近链接，并持续补扫数秒。 */
  assert.match(native, /function adoptOrphanIcons\(/);
  assert.match(native, /state\.sweep/);
  /* 状态条与传送列表都可能是 grid：靠“纯箭头按钮”区分，避免把状态条压成一列。 */
  assert.match(native, /arrowButton/);
  /* 选项卡片间距收紧到 3px，避免“图标卡外 + 空行”撑出的大段间隔。 */
  assert.match(nativeCss, /margin: 3px 0 !important/);
  /* color-mix 前必须有 rgba 兜底，旧 WebView 才不是一整块实色。 */
  assert.match(nativeCss, /background-color: rgba\(18, 22, 27, \.62\);\s*\n\s*background-color: color-mix/);
  assert.match(nativeCss, /--mln-halo: rgba\(227, 178, 95, \.28\)/);
});

test("CE 页签不被内容按钮通扫覆盖，关闭按钮不被二次改尺寸", () => {
  /* 实测回归：页签先设 11px / padding 3px 5px，随后“所有 button”循环
     又把它改回 13px / 3px 7px，宽度从 65 撑到 81。必须加标记并跳过。 */
  assert.match(native, /setAttribute\("data-mln-tab", "1"\)/);
  assert.match(native, /setAttribute\("data-mln-close", "1"\)/);
  assert.match(native, /getAttribute\("data-mln-tab"\) \|\| btn\.getAttribute\("data-mln-close"\)/);
  /* 箭头可能是 <div>/<span> 叶子，不能只处理 button。 */
  assert.match(native, /!el\.children\.length && \/\^\[<>‹›←→«»▲▼◀▶⏪⏩\]/);
  /* 组前后空 <p> 会把 3px 间距重新撑大；必须双向清理且不得删掉含图标的段落。 */
  assert.match(native, /var after = wrap\.nextSibling/);
  assert.match(native, /querySelector\("img\.icon, \.icon-container, a\.link-internal, a\.macro-link"\)/);
});

test("1.3.8：孩子详情沿用原版正文色，不再继承主题的青蓝", () => {
  assert.match(
    nativeCss,
    /html\[data-ml-native="on"\] #passages \.passage \.childDetails\s*\{[^}]*color:\s*var\(--100,\s*#eee\)/,
    "childDetails 必须恢复原版 --100 正文色"
  );
  assert.doesNotMatch(
    nativeCss,
    /html\[data-ml-native="on"\] #passages \.passage \.childDetails\s*\{[^}]*var\(--mln-text\)/,
    "childDetails 不得再被主题正文色接管"
  );
});

test("1.3.7：手机面板滚动期间摘掉 backdrop-filter，停止 160ms 后恢复", () => {
  assert.match(css, /@media \(max-width: 899px\)\s*\{[\s\S]{0,900}?#ml-root \.ml-panel\[data-scrolling="1"\][\s\S]{0,400}?backdrop-filter:\s*none !important/,
    "手机端必须有滚动期间关闭面板模糊的规则");
  assert.match(index, /function markPanelScrolling\(\)/,
    "render.js 必须集中处理面板滚动状态");
  assert.match(index, /addEventListener\("scroll", markPanelScrolling, \{ passive: true \}\)/,
    "面板与页面滚动监听必须 passive");
  assert.match(index, /data-scrolling/);
  assert.match(index, /setTimeout\(function \(\) \{[\s\S]{0,140}?removeAttribute\("data-scrolling"\)/,
    "停止滚动后必须恢复模糊");
  assert.match(index, /doc\.body\.removeEventListener\("scroll", markPanelScrolling\)/,
    "销毁时必须解绑 body 滚动监听");
  assert.match(index, /window\.removeEventListener\("scroll", markPanelScrolling\)/,
    "销毁时必须解绑 window 滚动监听");
});

test("effects.css：动效令牌/keyframes/工具类独立分区，组件文件不再内联 keyframes", () => {
  for (const name of ["ml-breathe", "ml-tabline", "ml-hairline", "ml-panel-ambient",
    "ml-pane-in", "ml-ring-breathe", "ml-press-ripple", "mln-bar-drift",
    "mln-passage-in", "mln-overlay-in", "mln-stat-row-in", "mln-press-ripple",
    "ml-ambient-drift", "ml-dust-drift", "ml-scan-sweep", "ml-star-twinkle",
    "ml-fog-band", "ml-paper-fiber", "ml-ink-ripple", "ml-static-flicker", "ml-ember-pulse", "ml-fog-breathe", "ml-star-meteor", "ml-head-sweep"]) {
    assert.match(fx, new RegExp("@keyframes " + name + "\\s*\\{"), name + " 必须在 effects.css");
  }
  assert.doesNotMatch(css, /@keyframes\s+(ml|mln)-/, "style.css 不应再内联动效 keyframes");
  assert.doesNotMatch(nativeCss, /@keyframes\s+(ml|mln)-/, "native.css 不应再内联动效 keyframes");
  assert.match(fx, /--ml-fx-dur-pane:/);
  assert.match(fx, /--ml-fx-dur-ripple:/);
  assert.match(fx, /--ml-fx-ease-out:/);
  for (const cls of ["ml-fx-pane", "ml-fx-hairline", "ml-fx-breathe", "ml-fx-drift"]) {
    assert.match(fx, new RegExp("#ml-root \\." + cls), cls + " 必须作为可复用工具类存在");
  }
});

test("主题环境层：9 主题独立粒子参数、8 颗粒子、天空层、中央留空与三层关断", () => {
  for (const theme of ["auto", "cyberpunk", "amber", "jade", "graphite", "star", "fog", "school", "paper"]) {
    assert.match(fx, new RegExp('#ml-root\\[data-theme="' + theme + '"\\][\\s\\S]{0,180}--ml-fx-ambient-a'),
      "缺少环境粒子变量: " + theme);
  }
  assert.match(fx, /#ml-root \.ml-ambient\s*\{[^}]*z-index:\s*0[^}]*pointer-events:\s*none[^}]*contain:\s*layout paint style/s,
    "环境层必须在 root 底层、不可点击且开启 containment");
  assert.match(fx, /#ml-root \.ml-ambient__wisp:nth-child\(8\)/,
    "桌面必须保留 8 颗粒子锚点");
  assert.match(fx, /#ml-root \.ml-ambient__veil\s*\{[^}]*pointer-events:\s*none[^}]*animation:\s*ml-veil-flow/s,
    "整幅慢流层必须存在、不可点击且只跑 transform 动画");
  assert.match(fx, /@keyframes ml-veil-flow\s*\{/, "慢流层必须有 keyframes");
  assert.match(fx, /#ml-root \.ml-ambient__sky\s*\{[^}]*z-index:\s*0[^}]*pointer-events:\s*none[^}]*opacity:\s*var\(--ml-sky-opacity/s,
    "天空层必须在 root 底层、不可点击且可独立调亮");
  assert.match(fx, /#ml-root \.ml-ambient__sky::before[\s\S]*?animation:\s*ml-sky-glow/s,
    "天空层必须有会漂移的天光底");
  assert.match(fx, /#ml-root \.ml-ambient__sky::after[\s\S]*?animation:\s*ml-sky-ribbon/s,
    "天空层必须有第二条极光/光带，不能只靠静态渐变");
  assert.match(fx, /@keyframes ml-sky-glow\s*\{/, "天光底必须有 keyframes");
  assert.match(fx, /@keyframes ml-sky-ribbon\s*\{/, "极光带必须有 keyframes");
  for (const theme of ["auto", "cyberpunk", "amber", "jade", "graphite", "star", "fog", "school", "paper"]) {
    assert.match(fx, new RegExp('#ml-root\\[data-theme="' + theme + '"\\][\\s\\S]{0,620}--ml-sky-a'),
      "缺少主题天空变量: " + theme);
  }
  const starVar = fx.match(/--ml-sky-stars:\s*([\s\S]*?);/);
  assert.ok(starVar && (starVar[1].match(/radial-gradient/g) || []).length >= 10,
    "星空主题必须有一层独立星点，且不少于 10 颗");
  for (const phase of ["dawn", "day", "dusk", "night"]) {
    assert.match(fx, new RegExp('#ml-root\\[data-theme="auto"\\]\\[data-phase="' + phase + '"\\][\\s\\S]{0,260}--ml-sky-a'),
      "auto 的天空色必须跟随游戏时段: " + phase);
  }
  for (const theme of ["auto", "cyberpunk", "amber", "jade", "graphite", "star", "fog", "school", "paper"]) {
    assert.match(fx, new RegExp('#ml-root\\[data-theme="' + theme + '"\\][\\s\\S]{0,520}--ml-veil-a'),
      "缺少主题慢流变量: " + theme);
  }
  assert.match(fx, /#ml-root\[data-theme="auto"\][\s\S]{0,600}--ml-fx-ambient-opacity:\s*\.(?:7|8|9)/,
    "auto 主题必须提亮到 0.7 以上，默认主题不能看不见");
  assert.match(fx, /#ml-root\[data-theme="fog"\][\s\S]{0,600}--ml-fx-ambient-opacity:\s*1;/,
    "雾港必须是最强的 1.0 环境层");
  for (const phase of ["dawn", "day", "dusk", "night"]) {
    assert.match(fx, new RegExp('#ml-root\\[data-theme="auto"\\]\\[data-phase="' + phase + '"\\]'),
      "auto 必须按游戏时段换环境色: " + phase);
  }
  assert.match(fx, /#ml-root\[data-theme="auto"\] \.ml-ambient::after/,
    "auto 必须有一条会移动的天光带，不能只靠静态渐变");
  assert.match(fx, /#ml-root\[data-theme="auto"\] \.ml-ambient::before[\s\S]{0,520}var\(--ml-sky-a/,
    "auto 地平光必须吃 data-phase 天空变量，夜里不能留固定暖橙");
  assert.match(fx, /#ml-root\[data-theme="auto"\] \.ml-ambient::after[\s\S]{0,900}var\(--ml-sky-c/,
    "auto 天光带必须吃 data-phase 天空变量，白天/夜晚要换色");
  assert.match(fx, /@keyframes ml-sky-band\s*\{/, "天光带必须有 keyframes");
  assert.match(index, /els\.root\.setAttribute\("data-phase", phase\)/,
    "render 必须把游戏时段挂到根节点，否则 CSS 分时段配色永远不生效");
  assert.match(fx, /animation:\s*ml-star-meteor 12s/, "流星频率必须提升到 12s 一级");
  assert.match(fx, /@media \(max-width:\s*600px\)[\s\S]*?\.ml-ambient__wisp:nth-child\(n \+ 3\)\s*\{[^}]*display:\s*none/s,
    "≤600px 必须减到 2 颗，避免手机 GPU 过载");
  assert.match(fx, /#ml-root\[data-motion="off"\] \.ml-ambient[\s\S]*?display:\s*none !important/s,
    "玩家关动效时环境层必须整层隐藏，不能留下静态雾团");
  assert.match(fx, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.ml-ambient\s*\{[^}]*display:\s*none !important/s,
    "系统减少动态时环境层必须整层隐藏");
  assert.match(fx, /html\[data-dol-midnight\]:not\(\[data-dgu-visualMotion\]\) #ml-root \.ml-ambient/,
    "宿主关闭动效时环境层必须跟随关断");
  assert.match(fx, /#ml-root\[data-open="1"\] \.ml-ambient\s*\{[^}]*calc\(var\(--ml-fx-ambient-opacity[^}]*\.55\)/s,
    "面板打开时环境层必须降亮到 55%，把注意力收回面板");
  assert.match(fx, /#ml-root\[data-theme="star"\] \.ml-ambient::after/, "星空必须有低频流星层");
  assert.match(fx, /@keyframes ml-star-meteor/, "流星必须有 keyframes");
  assert.match(fx, /#ml-root \.ml-head::after/, "面板标题栏必须有一次性扫光层");
  assert.match(fx, /@keyframes ml-head-sweep/, "面板扫光必须有 keyframes");
  assert.match(css, /#ml-root\[data-open="1"\] \.ml-head::after[\s\S]*?animation:\s*ml-head-sweep/s,
    "面板打开时必须触发一次性扫光");
  assert.match(fx, /html\[data-ml-motion="off"\] #ml-root \.ml-head::after[\s\S]*?animation:\s*none !important/s,
    "宿主关闭动效时扫光必须关断");
  assert.match(fx, /#ml-root\[data-theme="fog"\] \.ml-ambient::after/, "雾港必须有第二层呼吸雾带");
  assert.match(fx, /@keyframes ml-fog-breathe/, "雾港呼吸雾带必须有 keyframes");
  assert.match(index, /"ml-ambient"/);
  assert.match(index, /"ml-ambient__wisp"/);
  assert.match(index, /"ml-ambient__veil"/);
  assert.match(index, /jitterAmbient\(ambient\)[\s\S]{0,180}"ml-ambient__veil"/,
    "慢流层必须在粒子抖动之后追加，不能改变 1~8 号粒子的锚点");
  assert.match(index, /jitterAmbient\(ambient\)[\s\S]{0,320}"ml-ambient__veil"[\s\S]{0,240}"ml-ambient__sky"/,
    "天空层必须在慢流层之后追加，不能改变 1~8 号粒子与 veil 的顺序");
  assert.match(index, /jitterAmbient\(ambient\)/, "每次挂载必须做一次边缘随机抖动，避免雾团固定不动");
  assert.match(index, /--ml-wisp-delay/, "随机抖动必须写入粒子相位变量");
  assert.match(index, /els\.ambient\.hidden = !state\.settings\.motion/,
    "动效关闭时环境层必须从渲染树移除");
});

test("1.3.5：手机端降载、星空页底瘦身与 CE 模糊下调", () => {
  assert.match(fx, /--ml-sky-dust:[\s\S]{0,320}repeat/s,
    "星空星尘必须走平铺层，不能逐颗铺几十层");
  assert.match(fx, /#ml-root \.ml-ambient__sky\s*\{[^}]*background:\s*var\(--ml-sky-dust, none\)/s,
    "天空层必须消费平铺星尘变量");
  assert.match(fx, /@media \(max-width:\s*600px\)[\s\S]*?#ml-root \.ml-ambient,\s*\n?\s*#ml-root \.ml-ambient \*[\s\S]{0,180}animation:\s*none/s,
    "手机端环境层必须整体静态，不能留持续重绘");
  assert.match(fx, /@media \(max-width:\s*600px\)[\s\S]*?data-open="1"\] \.ml-ambient\s*\{[^}]*display:\s*none/s,
    "手机端面板打开时必须停止绘制环境层");
  assert.match(fx, /@media \(max-width:\s*600px\)[\s\S]*?\.ml-ambient__wisp:nth-child\(n \+ 3\)/s,
    "手机端只留 2 颗粒子");
  assert.match(fx, /@media \(max-width:\s*600px\)[\s\S]*?\.ml-ambient__veil\s*\{[^}]*display:\s*none/s,
    "手机端必须隐藏整幅 veil 层，天空层保留静态星场");
  assert.match(fx, /@media \(max-width:\s*600px\)[\s\S]*?\.ml-ambient::before[\s\S]{0,80}?\.ml-ambient::after\s*\{[^}]*display:\s*none/s,
    "手机端必须隐藏环境层两条主题光带伪元素");
  assert.match(nativeCss, /#customOverlay \.dol-shadow[\s\S]{0,400}backdrop-filter:\s*blur\(6px\)/,
    "CE 面板模糊必须从 10px 收到 6px");
  assert.match(index, /innerWidth\s*<=\s*899[\s\S]{0,120}Math\.min\(blur,\s*12\)/,
    "手机/平板端面板模糊必须封顶 12px");
});

test("effects.css：组件引用的 keyframes/token 全部有定义，且原生 CSS 仍在原型加载链中", () => {
  const cleanFx = strip(fx);
  const keyframes = new Set(Array.from(cleanFx.matchAll(/@keyframes\s+([\w-]+)/g), (m) => m[1]));
  const tokens = new Set(Array.from(cleanFx.matchAll(/(--ml-fx-[\w-]+)\s*:/g), (m) => m[1]));
  for (const file of [strip(css), strip(nativeCss)]) {
    for (const m of file.matchAll(/animation:\s*([\w-]+)/g)) {
      if (m[1] === "none" || m[1] === "var") continue;
      assert.ok(keyframes.has(m[1]), "组件引用了未定义的 keyframe: " + m[1]);
    }
    for (const m of file.matchAll(/var\((--ml-fx-[\w-]+)/g)) {
      assert.ok(tokens.has(m[1]), "组件引用了未定义的动效 token: " + m[1]);
    }
  }
  const nativeLink = html.indexOf("../src/maplelantern-native.css");
  const fxLink = html.indexOf("../src/effects.css");
  assert.ok(nativeLink > 0 && fxLink > nativeLink, "原生 CSS 必须先于 effects.css 加载");
});

test("游戏缩放：原生全屏与面板宽高都消费本地视口变量", () => {
  assert.match(nativeCss, /#customOverlayContainer \{[\s\S]{0,400}width:\s*100%\s*!important/s,
    "fixed 弹层容器只吃包含块宽度；100vw 在被缩放祖先里会横向溢出，桌面实测右缘多 320px");
  assert.doesNotMatch(nativeCss, /#customOverlayContainer \{[\s\S]{0,400}width:\s*100vw\s*!important/s,
    "容器不得再用 100vw：包含块是 #story 而不是视口");
  assert.match(nativeCss, /#customOverlayContainer \{[\s\S]{0,450}height:\s*var\(--ml-vh,\s*100vh\)\s*!important/s,
    "容器高度同理，不能只用 100dvh");
  assert.match(nativeCss, /height:\s*calc\(var\(--ml-vh,\s*100vh\) - 96px\)\s*!important/,
    "原生弹层面板必须按本地视口显式算高，不能用 top+bottom 让缩放祖先把它拉出屏幕");
  assert.match(nativeCss, /bottom:\s*auto\s*!important/,
    "弹层面板底边不得参与定位，否则包含块被内容撑高时会整体下坠");
  assert.ok(nativeCss.includes("calc(var(--ml-vw, 100vw) - 48px)"),
    "原生弹层宽度必须按本地视口收口");
  assert.match(css, /#ml-root \.ml-panel \{[\s\S]{0,260}max-width:\s*calc\(var\(--ml-vw,\s*100vw\) - 32px\)/s,
    "浮动面板在 120% 以上必须收住宽度");
  assert.match(css, /#ml-root \.ml-panel \{[\s\S]{0,300}height:\s*min\(620px,\s*calc\(var\(--ml-vh,\s*100vh\) \* \.7\)\)/s,
    "面板高度按本地视口取 70%，低缩放档不会只剩半屏");
  assert.match(css, /#ml-root\[data-sheet="1"\] \.ml-panel \{[\s\S]{0,220}max-height:\s*calc\(var\(--ml-vh,\s*100vh\) \* \.84\)/s,
    "手机抽屉按本地视口取 84%");
});

test("流体动效：球心原点 / 回弹令牌 / 凝光层 / 后台暂停 / 速度自适应都在链上", () => {
  /* 空间连续：scale 原点是变量，默认仍回到底部中心 */
  assert.match(css, /transform-origin:\s*var\(--ml-origin-x,\s*50%\)\s*var\(--ml-origin-y,\s*100%\)/,
    "面板 transform-origin 必须消费球心变量");
  assert.match(index, /syncPanelOrigin\(\);/, "打开面板必须换算一次原点");
  assert.match(index, /C\.panelOrigin\(box, orb\)/, "原点换算必须走 core 纯函数");
  /* 柔性反馈：按压释放走弹簧曲线，按下单独用短时长 */
  assert.match(fx, /--ml-fx-ease-spring:\s*cubic-bezier\(\.34,\s*1\.56,\s*\.64,\s*1\)/,
    "必须定义过冲回弹曲线");
  assert.match(css, /transition:\s*transform\s+var\(--ml-fx-dur-press[\s\S]{0,80}var\(--ml-fx-ease-spring/s,
    "按钮释放必须使用回弹曲线");
  assert.match(css, /:active,[\s\S]{0,120}\.ml-is-pressed[\s\S]{0,120}transition-duration:\s*\.09s/s,
    "按下必须用更短的时长，不能回弹到按下状态");
  /* 凝光：只换背景附加层，且坐标来自指针变量 */
  assert.match(css, /#ml-root \.ml-panel\[data-light="1"\][\s\S]{0,220}radial-gradient[\s\S]{0,160}var\(--ml-light-x/s,
    "凝光必须是面板背景的附加层");
  assert.match(index, /setAttribute\("data-light", "1"\)/, "指针移动必须点亮凝光");
  assert.match(index, /pointerType === "touch"[\s\S]{0,40}return;/, "触摸端不得启用凝光");
  /* 后台预算 */
  assert.match(css, /#ml-root\[data-paused="1"\][\s\S]{0,200}animation-play-state:\s*paused/s,
    "后台必须暂停动画");
  assert.match(index, /visibilitychange/, "必须监听页面可见性");
  /* 速度自适应与球拖拽 */
  assert.match(css, /transition:\s*opacity \.2s ease, transform var\(--ml-sheet-dur/s,
    "面板位移必须可被 sheet 时长覆盖");
  assert.match(index, /--ml-sheet-dur/, "sheet 释放必须写入速度时长");
  assert.match(index, /function rubber\(/, "球拖拽必须有边缘橡皮筋");
  assert.match(index, /translate3d\(/, "球拖拽必须用 transform 跟手，不逐帧写 left/top");
  assert.match(index, /function closePanel\(reason\)[\s\S]{0,400}syncPanelOrigin\(\)/,
    "关闭前必须按当前高度重算原点");
  assert.match(index, /if \(state\.open\) \{[\s\S]{0,80}syncPanelOrigin\(\)/,
    "resize 后必须重算原点");
  assert.match(css, /#ml-root \.ml-orb \{[\s\S]{0,400}touch-action:\s*none/s,
    "球必须 touch-action:none，否则触摸拖拽被页面滚动掐断");
  assert.match(css, /#ml-root\[data-dragging="1"\] \.ml-orb \{[\s\S]{0,120}will-change:\s*transform/s,
    "拖拽期必须提升为合成层");
});

test("作弊页 numberStepper：原版 32×32 几何不得被通用按钮规则撑开", () => {
  /* 原版核心属性行是两个 .fa-icon 叠出来的 |< … >|；通用 44px/9px 内边距会把
     32px 按钮挤到只剩 4px 内容区，箭头就跑到格子外。JS 入口必须先跳过。 */
  assert.match(native, /classList\.contains\("numberStepper"\)/,
    "CE overlay 增强必须在按钮入口跳过 numberStepper");
  assert.match(native, /numberStepperGroup/,
    "子按钮兜底也必须认 numberStepperGroup");
  /* CSS 兜底：非 CE overlay 的所有 numberStepper，而不只是 .settingsGrid。 */
  assert.match(nativeCss, /#customOverlayContent[^}]{0,260}\.numberStepper,\s*[\r\n]+html\[data-ml-native="on"\][^}]{0,260}\.numberStepper:disabled/s,
    "numberStepper 几何规则必须覆盖非 settingsGrid 路径");
  const stepper = nativeCss.match(/\.numberStepper,\r?\n[\s\S]{0,900}?height:\s*32px\s*!important/);
  assert.ok(stepper, "numberStepper 规则块必须存在，且含 32px 高度");
  assert.match(nativeCss, /\.numberStepper,\r?\n[\s\S]{0,900}?padding:\s*0\s*!important/);
  assert.match(nativeCss, /\.numberStepper,\r?\n[\s\S]{0,900}?background-color:\s*transparent\s*!important/);
  assert.match(nativeCss, /\.numberStepper,\r?\n[\s\S]{0,900}?border:\s*none\s*!important/);
  assert.match(nativeCss, /\.numberStepper:hover \{[\s\S]{0,120}background-color:\s*transparent/s,
    "hover 不得把箭头按钮涂回卡片底色");
});

test("纸灯：左轨时间数字与顶部时钟统一为墨色", () => {
  assert.ok(!/\[data-ml-opt-rail-skin="1"\]\[data-ml-theme="paper"\] #mobileStats \.stat\.time/.test(nativeCss),
    "纸灯时间墨色不得依赖左轨皮肤开关（默认为关，会导致仍用原版浅字）");
  assert.match(nativeCss,
    /\[data-ml-theme="paper"\] #mobileStats \.stat\.time,[\s\S]{0,180}\.stat\.time \.vertical \{[\s\S]{0,180}color:\s*#2A2118\s*!important/s,
    "纸灯左轨时间块必须用深墨色");
  assert.match(nativeCss,
    /\[data-ml-theme="paper"\] #mobileStats \.stat\.time \.vertical \{[\s\S]{0,80}color:\s*#1F1912/s,
    "纸灯竖排日期必须比正文更深");
  assert.match(nativeCss,
    /\[data-ml-theme="paper"\] #stats \.clockContainer \{[\s\S]{0,120}color:\s*#1F1912\s*!important/s,
    "纸灯顶部时钟必须用墨色");
});

test("关闭顶部四格时：手机窄屏仍把金额/时间/日期排进 3×2 网格", () => {
  assert.match(nativeCss,
    /:not\(\[data-ml-opt-stats="1"\]\) #stats#stats \.centered-elements \{[\s\S]{0,360}grid-template-areas:\s*"toggle money time" "toggle day day"/s,
    "关闭四格时也必须给窄屏安全网格");
  assert.match(nativeCss,
    /:not\(\[data-ml-opt-stats="1"\]\) #stats#stats \.clockContainer \{[\s\S]{0,200}transform:\s*none\s*!important/s,
    "时间胶囊必须取消 scale(1.3)，否则会盖到金额上");
  assert.match(nativeCss,
    /:not\(\[data-ml-opt-stats="1"\]\) #stats#stats \.centered-elements > div\[data-ml-chip="money"\]/s,
    "金额格必须显式落在 money 区域");
});

test("商店：分类格不被选项卡片打包，分页链接不继承整宽卡片", () => {
  assert.match(native, /link\.closest\([^)]*#shopCategories[^)]*\)[\s\S]{0,40}continue/,
    "商店分类链接必须跳过正文选项打包，否则 category-tab 会被搬空");
  assert.match(native, /closest\([^)]*#shopCategories[^)]*\)[\s\S]{0,40}continue/,
    "孤儿图标收养也必须跳过商店分类栏");
  const catImg = nativeCss.match(/#shopCategories \.category-tab > img \{[\s\S]{0,260}?transform:\s*none\s*!important/);
  assert.ok(catImg, "分类图标必须复位原版 skewX，否则图标仍是斜的");
  const pag = nativeCss.match(/#shop-pagination a\.macro-link \{[\s\S]{0,320}?min-height:\s*0\s*!important[\s\S]{0,180}?border:\s*0\s*!important/);
  assert.ok(pag, "分页链接必须清掉 44px 整宽卡片外观");
  assert.match(nativeCss, /#shop-pagination \.page > a \{[\s\S]{0,120}width:\s*100%\s*!important/s,
    "圆点内链接必须填满 .page，不能撑成 27×44");
  assert.match(nativeCss, /@media screen and \(max-width: 577px\) \{[\s\S]{0,200}#shop-pagination \.btn-pagination > a \{[\s\S]{0,60}display:\s*none\s*!important/s,
    "窄屏必须保留原版“隐藏 Previous/Next 文字、只显示箭头”的行为");
});

