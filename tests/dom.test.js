/* 灯台 MapleLantern — jsdom 测试：挂载 / 面板 / 页签 / 焦点 / 持久化 / 宿主 / 零写入 / 销毁 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createEnv } = require("./env.js");

function pane(w) { return w.document.querySelector("#ml-panel .ml-pane"); }

test("挂载：悬浮球与隐藏面板就位，默认不打扰游戏", () => {
  const { w } = createEnv();
  const root = w.document.getElementById("ml-root");
  assert.ok(root, "缺 #ml-root");
  assert.ok(w.document.getElementById("ml-orb"), "缺 #ml-orb");
  const panel = w.document.getElementById("ml-panel");
  assert.equal(panel.hidden, true);
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-modal"), "true");
  assert.equal(root.getAttribute("data-sheet"), "0");
  assert.equal(root.getAttribute("data-side"), "right");
  assert.match(w.document.getElementById("ml-orb").getAttribute("aria-label"), /灯台/);
  assert.equal(w.document.querySelector("#ml-panel .ml-tabs").getAttribute("aria-label"), "灯台分类");
});

test("文案：切到英文时页签分类与关闭按钮的无障碍标签同步换语", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "en", motion: false } });
  assert.equal(w.document.querySelector("#ml-panel .ml-tabs").getAttribute("aria-label"), "Lantern sections");
  assert.equal(w.document.querySelector("#ml-panel .ml-close").getAttribute("aria-label"), "Close");
});

test("启动：面板关闭时不预渲染内容，首次打开才构建", () => {
  const { w } = createEnv();
  assert.equal(w.document.querySelector("#ml-panel .ml-pane"), null);
  w.MapleLantern.open();
  assert.ok(pane(w), "首次打开应构建当前页签");
});

test("打开：面板可见、焦点落在当前页签、Esc 关闭并收起", async () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  const panel = w.document.getElementById("ml-panel");
  assert.equal(panel.hidden, false);
  assert.equal(w.document.getElementById("ml-root").getAttribute("data-open"), "1");
  assert.equal(w.document.activeElement.getAttribute("data-tab"), "now");

  w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(panel.getAttribute("data-open"), "0");
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(panel.hidden, true, "动效关闭时应当立即隐藏");
});

test("页签：点击与键盘左右键都能切换，内容随之重绘", () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  const tabs = w.document.querySelectorAll("#ml-panel [role=tab]");
  assert.equal(tabs.length, 5);

  w.document.querySelector('[data-tab="vitals"]').click();
  assert.equal(pane(w).getAttribute("aria-labelledby"), "ml-tab-vitals");
  assert.match(pane(w).textContent, /意志|Willpower/);

  w.document.querySelector('[data-tab="now"]').click();
  w.document.querySelector('[data-tab="now"]').dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  assert.equal(w.document.querySelector('[data-tab="now"]').getAttribute("aria-selected"), "false");
  assert.equal(w.document.querySelector('[data-tab="vitals"]').getAttribute("aria-selected"), "true");

  /* roving tabindex：左右键以“当前选中页签”为基准，而不是以被聚焦的元素为基准 */
  w.document.querySelector('[data-tab="vitals"]').dispatchEvent(
    new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  assert.equal(w.document.querySelector('[data-tab="worn"]').getAttribute("aria-selected"), "true");

  w.document.querySelector('[data-tab="settings"]').click();
  assert.equal(pane(w).getAttribute("aria-labelledby"), "ml-tab-settings");
});

test("焦点陷阱：面板内 Tab 循环，不会逃到游戏正文", () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  const panel = w.document.getElementById("ml-panel");
  const nodes = Array.prototype.filter.call(
    panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    (n) => !n.disabled
  );
  const last = nodes[nodes.length - 1];
  last.focus();
  panel.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  assert.equal(w.document.activeElement, nodes[0], "末尾 Tab 应回到第一个可聚焦元素");
});

test("持久化：设置写入 localStorage，刷新后沿用", () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="settings"]').click();
  w.document.querySelector('.ml-seg-btn[data-value="jade"]').click();
  const saved = JSON.parse(w.localStorage.getItem("MapleLantern.settings.v1"));
  assert.equal(saved.theme, "jade");
  assert.equal(saved.tab, "settings");

  const next = createEnv({ seed: saved });
  next.w.MapleLantern.open();
  assert.equal(next.w.document.querySelector("#ml-root").getAttribute("data-theme"), "jade");
});

test("设置页稳定：切换主题不重建，剧情推进不冲掉焦点", async () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="settings"]').click();
  const jade = w.document.querySelector('.ml-seg-btn[data-value="jade"]');
  jade.focus();
  const beforePane = pane(w);
  jade.click();
  assert.equal(jade.getAttribute("aria-checked"), "true");
  assert.equal(w.document.activeElement, jade);
  assert.equal(w.document.querySelector("#ml-root").getAttribute("data-theme"), "jade");
  w.document.dispatchEvent(new w.Event("passageend"));
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(pane(w), beforePane, "剧情推进不应重建设置页");
  assert.equal(w.document.activeElement, jade, "焦点不应丢失");
});

test("宿主不支持模糊时关闭 backdrop-filter", () => {
  const { w: off } = createEnv({ host: true, hostCaps: { backdropFilter: false } });
  assert.equal(off.document.getElementById("ml-root").getAttribute("data-blur"), "off");
  const { w: on } = createEnv({ host: true });
  assert.equal(on.document.getElementById("ml-root").getAttribute("data-blur"), "on");
  const { w: plain } = createEnv();
  assert.equal(plain.document.getElementById("ml-root").getAttribute("data-blur"), "on");
});

test("宿主视觉档位：Smooth / Balanced 收窄模糊，Fancy 保留完整", () => {
  const seed = { v: 1, lang: "zh", motion: false, glass: 100 };
  const { w: smooth } = createEnv({ seed, host: true, hostCaps: { visualTier: "Smooth" } });
  assert.equal(smooth.document.getElementById("ml-root").style.getPropertyValue("--ml-blur"), "10px");
  const { w: balanced } = createEnv({ seed, host: true, hostCaps: { visualTier: "Balanced" } });
  assert.equal(balanced.document.getElementById("ml-root").style.getPropertyValue("--ml-blur"), "16px");
  const { w: fancy } = createEnv({ seed, host: true, hostCaps: { visualTier: "Fancy" } });
  assert.equal(fancy.document.getElementById("ml-root").style.getPropertyValue("--ml-blur"), "32px");
});

test("损坏的设置：逐字段修复并提示一次，不阻断挂载", () => {
  const { w } = createEnv({ seed: "{not json" });
  assert.ok(w.document.getElementById("ml-root"));
  assert.equal(w.document.querySelector("#ml-root").getAttribute("data-theme"), "cyberpunk");
  const toast = w.document.querySelector(".ml-toast");
  assert.equal(toast.hidden, false);
  assert.match(toast.textContent, /修复|repaired/i);
});

test("只读红线：打开、切页、改设置、取诊断全程零写入 State.variables", () => {
  const { w, getWrites } = createEnv();
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="vitals"]').click();
  w.document.querySelector('[data-tab="worn"]').click();
  w.document.querySelector('[data-tab="settings"]').click();
  w.document.querySelector('.ml-seg-btn[data-value="graphite"]').click();
  const slider = w.document.querySelector(".ml-slider");
  slider.dispatchEvent(new w.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  w.MapleLantern.diagnostics();
  w.MapleLantern.close();
  assert.equal(getWrites(), 0, "出现了 State.variables 写入");
});

test("设置：通透度滑块默认 60，键盘可调并写入 --ml-surface-alpha / 存储", () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="settings"]').click();
  const glass = w.document.querySelector('.ml-slider[data-key="glass"]');
  assert.ok(glass, "缺少通透度滑块");
  assert.equal(glass.getAttribute("aria-valuenow"), "60");
  assert.equal(glass.getAttribute("aria-valuemin"), "0");
  assert.equal(glass.getAttribute("aria-valuemax"), "100");
  glass.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  assert.equal(glass.getAttribute("aria-valuenow"), "55");
  const root = w.document.getElementById("ml-root");
  assert.match(root.style.getPropertyValue("--ml-surface-alpha"), /\.92|\.93/);
  const saved = JSON.parse(w.localStorage.getItem("MapleLantern.settings.v1"));
  assert.equal(saved.glass, 55);
});

test("设置：通透度 0 关掉玻璃模糊，100 时表面更透", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false, glass: 0 } });
  const root = w.document.getElementById("ml-root");
  assert.equal(root.getAttribute("data-glass"), "0");
  assert.equal(root.style.getPropertyValue("--ml-blur"), "0px");
  assert.equal(root.style.getPropertyValue("--ml-surface-alpha"), "1.000");

  const { w: w100 } = createEnv({ seed: { v: 1, lang: "zh", motion: false, glass: 100 } });
  const root100 = w100.document.getElementById("ml-root");
  assert.equal(root100.getAttribute("data-glass"), "1");
  assert.equal(root100.style.getPropertyValue("--ml-blur"), "32px");
  assert.equal(root100.style.getPropertyValue("--ml-surface-alpha"), "0.720");
});
test("私密槽位：不渲染 butt_plug / genitals 的物品名", () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="worn"]').click();
  const text = pane(w).textContent;
  assert.ok(!text.includes("SECRET-PLUG"));
  assert.ok(!text.includes("SECRET-GENITAL"));
  assert.match(text, /Shirt/);
});

test("宿主接入：auto 时转发 accent/radius，不规则宿主不抛错", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false, theme: "auto" }, host: true });
  const root = w.document.getElementById("ml-root");
  assert.match(root.style.getPropertyValue("--ml-accent"), /var\(--dgu-accent/);
  assert.match(root.style.getPropertyValue("--ml-radius"), /var\(--dgu-radius/);
  assert.match(w.document.querySelector(".ml-foot-status").textContent, /已连接/);

  const broken = createEnv({ host: true });
  broken.w.DoLGameUI.ui.apiVersion = 2;
  broken.w.MapleLantern.open();
  assert.ok(broken.w.document.getElementById("ml-panel").hidden === false, "apiVersion 不匹配时应退回自有外观");
});

test("i18n：语言设置立即切换整块界面", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "en", motion: false } });
  assert.equal(w.document.querySelector(".ml-name").textContent, "Lantern");
  assert.equal(w.document.querySelector('[data-tab="now"] .ml-tab-label').textContent, "Now");
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="settings"]').click();
  w.document.querySelector('.ml-seg-btn[data-value="zh"]').click();
  assert.equal(w.document.querySelector(".ml-name").textContent, "灯台");
});

test("诊断：字段齐全，能反映游戏版本与未连宿主", () => {
  const { w } = createEnv();
  const d = w.MapleLantern.diagnostics();
  assert.equal(d.mod, "MapleLantern");
  assert.equal(d.game, "0.5.12.13");
  assert.equal(d.host.present, false);
  assert.equal(d.sugarCube, "v2.36.1");
  assert.equal(d.stateReadable, true);
});

test("销毁：移除 DOM、解绑键盘，再调用不抛错", () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  w.MapleLantern.destroy();
  assert.equal(w.document.getElementById("ml-root"), null);
  assert.doesNotThrow(() => w.MapleLantern.open());
  assert.doesNotThrow(() => w.MapleLantern.destroy());
});

test("快捷键：Alt+L 开合，输入框内不抢键", () => {
  const { w } = createEnv();
  const ev = (target) => target.dispatchEvent(new w.KeyboardEvent("keydown", { key: "l", altKey: true, bubbles: true }));
  ev(w.document);
  assert.equal(w.document.getElementById("ml-panel").hidden, false);
  ev(w.document);
  assert.equal(w.document.getElementById("ml-panel").getAttribute("data-open"), "0");

  const input = w.document.createElement("input");
  w.document.body.appendChild(input);
  input.focus();
  ev(input);
  assert.equal(w.document.getElementById("ml-panel").getAttribute("data-open"), "0");
});

test("设置页：原生卡片与悬浮灯台两个总开关", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="settings"]').click();
  const nativeSw = w.document.querySelector('button.ml-switch[aria-label="原生卡片"]');
  const panelSw = w.document.querySelector('button.ml-switch[aria-label="悬浮灯台"]');
  assert.ok(nativeSw && panelSw, "设置页应有两个新开关");
  assert.equal(nativeSw.getAttribute("aria-checked"), "true");
  assert.equal(panelSw.getAttribute("aria-checked"), "false");

  nativeSw.click();
  assert.equal(nativeSw.getAttribute("aria-checked"), "false");
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "off");

  panelSw.click();
  assert.equal(panelSw.getAttribute("aria-checked"), "true");
  assert.equal(w.document.getElementById("ml-orb").hidden, false, "开启悬浮灯台后球可见");
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(w.document.querySelector("#stats [data-ml-chip]"), null, "关闭原生卡片后不残留标记");
});

test("按压：pointerdown 在按钮上生成短涟漪并临时标记按压态", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: true } });
  w.MapleLantern.open();
  const btn = w.document.querySelector("#ml-panel .ml-tab");
  btn.getBoundingClientRect = () => ({ left: 0, top: 0, width: 120, height: 44, right: 120, bottom: 44 });
  btn.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: 30, clientY: 20, button: 0 }));
  assert.equal(btn.classList.contains("ml-is-pressed"), true);
  assert.equal(btn.querySelectorAll(".ml-press-ring").length, 1);
  assert.equal(btn.querySelector(".ml-press-ring").getAttribute("style").includes("left: 30px"), true);
});
