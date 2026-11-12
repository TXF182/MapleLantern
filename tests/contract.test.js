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

test("boot.json：身份、版本、四个必填列表与文件存在性", () => {
  assert.equal(boot.name, "MapleLantern");
  assert.equal(boot.version, "1.1.7");
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
  assert.match(nativeCss, /#customOverlayContent \.saveMenuButton\s*\{[^}]*background:\s*var\(--mln-surface-2\) !important/s);
  assert.match(nativeCss, /#customOverlayContent \.saveMenuButton\s*\{[^}]*background:\s*var\(--mln-surface-2\) !important/s);
  assert.match(nativeCss, /#customOverlayContent \.saveButton input,[\s\S]{0,400}?background:\s*var\(--mln-surface-2\) !important/s);
});

test("赛博朋克主题：默认调色板、双 CSS 入口与设置项齐全，旧主题仍保留", () => {
  assert.match(core, /theme: "cyberpunk"/);
  assert.match(core, /cyberpunk:\s*\{/);
  assert.match(index, /value: "cyberpunk", label: s\["theme\.cyberpunk"\]/);
  assert.match(css, /#ml-root\[data-theme="cyberpunk"\][\s\S]*--ml-accent:\s*#00E5FF/);
  assert.match(css, /赛博朋克主题装饰/);
  assert.match(nativeCss, /data-ml-theme="cyberpunk"\]\s*\{[\s\S]*--mln-accent:\s*#00E5FF/);
  assert.match(nativeCss, /赛博朋克主题装饰/);
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

test("1.1.7：正文选项按压、图标同卡、六主题整页背景与宿主不再关层", () => {
  assert.ok(index.includes('.ml-option-group,a.link-internal.macro-link[data-ml-option=\\"1\\"]'),
    "正文选项必须进入 PRESS_SELECTOR");
  assert.match(index, /mln-press-ring/);
  assert.match(index, /mln-is-pressed/);
  assert.match(nativeCss, /\.ml-option-group > img\.icon/);
  assert.match(nativeCss, /grid-template-columns: 28px minmax\(0, 1fr\)/);
  assert.match(nativeCss, /\.mln-press-ring/);
  assert.match(nativeCss, /@keyframes mln-press-ripple/);
  assert.match(nativeCss, /html\[data-ml-native="on"\] body\s*\{[\s\S]*?background-color: transparent !important/);
  assert.match(nativeCss, /html\[data-ml-native="on"\]\s*\{[\s\S]*?background-image: var\(--mln-page-texture\) !important/);
  assert.match(nativeCss, /background-attachment: fixed/);
  assert.match(nativeCss, /radial-gradient\(3\.2px 3\.2px at 33% 15%/);
  assert.match(nativeCss, /br:has\(\+ a\.macro-link\)/);
  assert.ok(native.includes("var on = state.settings.native !== false;"),
    "检测到 DoLGameUI 不能把本包原生层整层关掉");
  assert.ok(!native.includes("state.settings.native !== false && !state.host"));
});
