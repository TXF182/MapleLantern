/* 灯台 MapleLantern — 合同测试：CSS 反制 / 动效判据 / 触控下限 / boot.json / 打包前置 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const css = fs.readFileSync(path.join(SRC, "style.css"), "utf8");
const index = fs.readFileSync(path.join(SRC, "render.js"), "utf8");
const native = fs.readFileSync(path.join(SRC, "maplelantern-native.js"), "utf8");
const nativeCss = fs.readFileSync(path.join(SRC, "maplelantern-native.css"), "utf8");
const core = fs.readFileSync(path.join(SRC, "core.js"), "utf8");
const boot = JSON.parse(fs.readFileSync(path.join(SRC, "boot.json"), "utf8"));
const html = fs.readFileSync(path.join(__dirname, "..", "prototype", "index.html"), "utf8");

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");
/* 第三方 cheat overlay 的排除前导：CheatExtended 落在 #customOverlayContent 内，
   带 #cheat_extended_options / #CE_settingsDiv / .CEtab；MapleBirchCE 则是 #mce-root。 */
const FOREIGN_GUARD = ":not\\(:has\\(#cheat_extended_options,#CE_settingsDiv,.CEtab,.CEbuttonBar,.CEDISPLAY,#mce-root\\)\\)";

test("boot.json：身份、版本、四个必填列表与文件存在性", () => {
  assert.equal(boot.name, "MapleLantern");
  assert.equal(boot.version, "1.1.20");
  assert.match(boot.nickName, /灯台/);
  for (const key of ["scriptFileList", "styleFileList", "tweeFileList", "imgFileList"]) {
    assert.ok(Array.isArray(boot[key]), key + " 必须是数组");
  }
  assert.deepEqual(boot.scriptFileList, ["core.js", "maplelantern-native.js", "render.js"], "core 必须先于 native/render");
  assert.deepEqual(boot.styleFileList, ["style.css", "maplelantern-native.css"]);
  for (const list of [boot.scriptFileList, boot.styleFileList, boot.additionFile || []]) {
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

test("主题纹理：6 套主题都有独立背景变量，面板/正文/卡片三层落点", () => {
  for (const theme of ["amber", "cyberpunk", "jade", "graphite", "star"]) {
    assert.match(css, new RegExp('data-theme="' + theme + '"'), "缺少主题块: " + theme);
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
  assert.match(css, /@keyframes ml-press-ripple\s*\{[\s\S]*?scale\(3\.4\)/);
  assert.match(css, /@keyframes ml-press-ripple/);
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

test("原生样式：顶栏四列强制 grid、金额不省略、侧栏按实际立绘底边起排", () => {
  assert.match(nativeCss, /#stats#stats \.centered-elements\s*\{[^}]*grid-template-columns:\s*32px minmax\(0, 1\.32fr\)/s);
  assert.match(nativeCss, /data-ml-chip="money"\] \.true\s*\{[^}]*white-space:\s*normal[^}]*text-overflow:\s*clip/s);
  assert.match(nativeCss, /body\.has-images #storyCaptionDiv\s*\{[^}]*top:\s*var\(--ml-caption-top, 192px\)/s);
  assert.match(nativeCss, /#saves-list-container \.savesListRow\s*\{[^}]*max-height:\s*none !important/s);
  assert.match(nativeCss, /:is\(#saves-list-container,#savesListContainer\) \.savesListRow\[data-ml-save-empty="1"\]\s*\{[^}]*padding:/s);
  assert.match(nativeCss, new RegExp("#customOverlayContent" + FOREIGN_GUARD + " \\.saveMenuButton\\s*\\{[^}]*background:\\s*var\\(--mln-surface-2\\) !important", "s"));
  assert.match(nativeCss, new RegExp("#customOverlayContent" + FOREIGN_GUARD + " \\.saveMenuButton\\s*\\{[^}]*background:\\s*var\\(--mln-surface-2\\) !important", "s"));
  assert.match(nativeCss, new RegExp("#customOverlayContent" + FOREIGN_GUARD + " \\.saveButton input,[\\s\\S]{0,400}?background:\\s*var\\(--mln-surface-2\\) !important", "s"));
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

test("1.1.14/1.1.17：CE 状态页两列选项不得横向压叠", () => {
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv,#customOverlayContent\) \.settingsGrid[\s\S]{0,500}grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*520px\),\s*1fr\)\) !important/s,
    "桌面格子必须按可容纳 520px 的宽度自适应，窄桌面自动降为单列");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv,#customOverlayContent\) \.numberStepperContainer[\s\S]{0,260}max-width:\s*100% !important[\s\S]{0,260}flex-wrap:\s*wrap !important/s,
    "stepper 容器必须收回格子宽度，并允许箭头组换行而不是横向压到邻格");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv,#customOverlayContent\) \.numberStepper[\s\S]{0,300}flex:\s*0 0 28px !important[\s\S]{0,220}margin:\s*0 !important[\s\S]{0,120}padding:\s*0 !important/s,
    "六枚箭头必须固定 28px 且不吃外距，否则会撑破半宽格子");
  const stepper28 = nativeCss.indexOf("flex: 0 0 28px !important");
  const desktopGate = nativeCss.lastIndexOf("@media (min-width: 900px)", stepper28);
  assert.ok(stepper28 > -1 && desktopGate > -1 && stepper28 - desktopGate < 1200,
    "28px 紧凑箭头必须收进桌面媒体查询，手机端保留 34px 触控区");
  assert.ok(nativeCss.indexOf("@media (max-width: 899px)") > stepper28,
    "28px 规则不得落进手机媒体块");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv,#customOverlayContent\) \.settingsGrid > \*[\s\S]{0,200}overflow:\s*hidden !important/s,
    "格子内每个选项卡必须被裁在自己的格子里");
  assert.match(nativeCss,
    /:is\(#customOverlay #cheat_extended_options ~ \*,#customOverlay #CE_settingsDiv,#customOverlayContent\) \.titlePercentage[\s\S]{0,200}flex:\s*1 1 60px !important/s,
    "中央数值区必须允许收缩并省略长数值，不得把两侧箭头挤出去");
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
  const c = html.indexOf("../src/core.js");
  const i = html.indexOf("../src/render.js");
  assert.ok(link > 0 && c > link && i > c, "加载顺序必须是 css -> core -> render");
});

test("体积预算：UI 包源码应远小于 1MB", () => {
  for (const f of ["core.js", "maplelantern-native.js", "render.js", "style.css", "maplelantern-native.css", "boot.json"]) {
    const size = fs.statSync(path.join(SRC, f)).size;
    assert.ok(size < 200 * 1024, f + " 过大: " + size);
  }
  assert.ok(core.length > 1000 && index.length > 1000 && native.length > 1000);
});


test("原生样式：所有规则都以原生开启属性为前导，且不动 #ml-root", () => {
  const selectors = strip(nativeCss).match(/[^{}]+(?=\{)/g) || [];
  for (const raw of selectors) {
    const sel = raw.trim();
    if (!sel || sel.startsWith("@") || /^\d+%$/.test(sel) || /^(from|to)$/.test(sel)) { continue; }
    assert.ok(sel.startsWith('html[data-ml-native="on"]'), "未作用域的原生选择器: " + sel);
    assert.ok(!sel.includes("#ml-root"), "原生层不应命中浮卡: " + sel);
  }
  assert.match(nativeCss, /#statmeters > div\[id\$="caption"\]::after/);
  assert.match(nativeCss, /content: attr\(data-ml-readout\)/);
  assert.match(nativeCss, /a\.link-internal\.macro-link/);
  assert.match(nativeCss, /\.settingsToggleItem/);
  assert.match(nativeCss, /appearance: none !important/);
  assert.match(nativeCss, /@media \(prefers-reduced-motion: reduce\)/);
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
  assert.match(nativeCss, /@keyframes mln-press-ripple/);
  assert.match(nativeCss, /html\[data-ml-native="on"\] body\s*\{[\s\S]*?background-color: transparent !important/);
  assert.match(nativeCss, /html\[data-ml-native="on"\]\s*\{[\s\S]*?background-image:\s*radial-gradient\(132% 92% at 50% -14%[\s\S]*?var\(--mln-page-texture\) !important/);
  assert.match(nativeCss, /background-attachment: fixed/);
  assert.match(nativeCss, /radial-gradient\(3\.2px 3\.2px at 33% 15%/);
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
