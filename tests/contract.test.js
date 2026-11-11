/* 灯台 MapleLantern — 合同测试：CSS 反制 / 动效判据 / 触控下限 / boot.json / 打包前置 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const css = fs.readFileSync(path.join(SRC, "style.css"), "utf8");
const index = fs.readFileSync(path.join(SRC, "render.js"), "utf8");
const native = fs.readFileSync(path.join(SRC, "native.js"), "utf8");
const nativeCss = fs.readFileSync(path.join(SRC, "native.css"), "utf8");
const core = fs.readFileSync(path.join(SRC, "core.js"), "utf8");
const boot = JSON.parse(fs.readFileSync(path.join(SRC, "boot.json"), "utf8"));
const html = fs.readFileSync(path.join(__dirname, "..", "prototype", "index.html"), "utf8");

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "");

test("boot.json：身份、版本、四个必填列表与文件存在性", () => {
  assert.equal(boot.name, "MapleLantern");
  assert.equal(boot.version, "1.1.2");
  assert.match(boot.nickName, /灯台/);
  for (const key of ["scriptFileList", "styleFileList", "tweeFileList", "imgFileList"]) {
    assert.ok(Array.isArray(boot[key]), key + " 必须是数组");
  }
  assert.deepEqual(boot.scriptFileList, ["core.js", "native.js", "render.js"], "core 必须先于 native/render");
  assert.deepEqual(boot.styleFileList, ["style.css", "native.css"]);
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

test("native.css：左轨保持 32px，字号提升且每格有左侧色条", () => {
  assert.match(nativeCss, /#mobileStats\s*\{[^}]*width:\s*32px[^}]*box-sizing:\s*border-box/s);
  assert.match(nativeCss, /#mobileStats \.stat\s*\{[^}]*border-left:\s*2px solid currentColor/s);
  assert.match(nativeCss, /#mobileStats \.stat\s*\{[^}]*font-size:\s*12\.5px/s);
  assert.match(nativeCss, /#mobileStats \.stat\.time\s*\{[^}]*min-height:\s*60px/s);
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
  for (const f of ["core.js", "native.js", "render.js", "style.css", "native.css", "boot.json"]) {
    const size = fs.statSync(path.join(SRC, f)).size;
    assert.ok(size < 200 * 1024, f + " 过大: " + size);
  }
  assert.ok(core.length > 1000 && index.length > 1000 && native.length > 1000);
});


test("native.css：所有规则都以原生开启属性为前导，且不动 #ml-root", () => {
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

test("native.js：只读标记、无轮询、宿主让位与幂等入口", () => {
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
