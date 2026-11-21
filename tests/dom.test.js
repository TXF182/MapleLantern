/* 灯台 MapleLantern — jsdom 测试：挂载 / 面板 / 页签 / 焦点 / 持久化 / 宿主 / 零写入 / 销毁 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
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

test("打开：transform-origin 从球心换算；量不到尺寸时回退百分比", () => {
  const { w } = createEnv();
  const panel = w.document.getElementById("ml-panel");
  const orb = w.document.getElementById("ml-orb");
  Object.defineProperties(panel, {
    offsetLeft: { configurable: true, value: 100 },
    offsetTop: { configurable: true, value: 100 },
    offsetWidth: { configurable: true, value: 380 },
    offsetHeight: { configurable: true, value: 600 }
  });
  orb.getBoundingClientRect = () => ({ left: 340, top: 680, width: 56, height: 56, right: 396, bottom: 736 });
  w.MapleLantern.open();
  assert.equal(panel.style.getPropertyValue("--ml-origin-x"), "268px");
  assert.equal(panel.style.getPropertyValue("--ml-origin-y"), "592px");
});

test("游戏缩放 120%：悬浮球按本地视口落位，不越出屏幕（动效开启）", async () => {
  const { w } = createEnv({ width: 390, height: 844, seed: { v: 1, lang: "zh", motion: true } });
  /* 实机 DoL 用 #img 的视觉高度/布局高度求缩放；jsdom 不认 inline zoom，用同一判据模拟。 */
  const img = w.document.createElement("div");
  img.id = "img";
  Object.defineProperty(img, "offsetHeight", { configurable: true, value: 844 });
  img.getBoundingClientRect = () => ({ top: 0, bottom: 1012.8, height: 1012.8, width: 468 });
  w.document.body.appendChild(img);
  const orb = w.document.getElementById("ml-orb");
  w.document.body.style.zoom = "1.2";
  w.dispatchEvent(new w.Event("resize"));
  await new Promise((r) => w.setTimeout(r, 180));
  assert.equal(w.document.documentElement.style.getPropertyValue("--ml-vw"), "325px");
  assert.equal(w.document.documentElement.style.getPropertyValue("--ml-vh"), "703px");
  assert.equal(orb.style.left, "257px", "390 / 1.2 - 56 - 12");
  assert.ok(parseFloat(orb.style.left) + 56 <= 325, "球右缘必须在本地视口内");
});

test("游戏缩放 85%：拖拽位移按本地坐标换算，跟手不缩水", async () => {
  const { w } = createEnv({ width: 390, height: 844, seed: { v: 1, lang: "zh", motion: false } });
  const img = w.document.createElement("div");
  img.id = "img";
  Object.defineProperty(img, "offsetHeight", { configurable: true, value: 844 });
  img.getBoundingClientRect = () => ({ top: 0, bottom: 717.4, height: 717.4, width: 331.5 });
  w.document.body.appendChild(img);
  w.dispatchEvent(new w.Event("resize"));
  await new Promise((r) => w.setTimeout(r, 180));
  const orb = w.document.getElementById("ml-orb");
  const root = w.document.getElementById("ml-root");
  const left0 = parseFloat(orb.style.left);
  const top0 = parseFloat(orb.style.top);
  const cx = (left0 + 28) * 0.85;
  const cy = (top0 + 28) * 0.85;
  orb.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
  orb.dispatchEvent(new w.MouseEvent("pointermove", { bubbles: true, clientX: cx - 85, clientY: cy }));
  assert.equal(root.getAttribute("data-dragging"), "1");
  assert.match(orb.style.transform, /translate3d\(-100px,0px,0\) scale\(1\.04\)/,
    "视觉位移 85px 在 85% 缩放里等于本地 100px，不能直接当 85px");
  assert.equal(orb.style.left, left0 + "px", "拖动中不得写 left");
});

test("游戏缩放 85%：面板原点先把球的视觉 rect 归一回本地坐标", () => {
  const { w } = createEnv({ width: 390, height: 844, seed: { v: 1, lang: "zh", motion: false } });
  const img = w.document.createElement("div");
  img.id = "img";
  Object.defineProperty(img, "offsetHeight", { configurable: true, value: 844 });
  img.getBoundingClientRect = () => ({ top: 0, bottom: 717.4, height: 717.4, width: 331.5 });
  w.document.body.appendChild(img);
  const panel = w.document.getElementById("ml-panel");
  const orb = w.document.getElementById("ml-orb");
  Object.defineProperties(panel, {
    offsetLeft: { configurable: true, value: 100 },
    offsetTop: { configurable: true, value: 100 },
    offsetWidth: { configurable: true, value: 380 },
    offsetHeight: { configurable: true, value: 700 }
  });
  /* 球本地 340,680 / 56；85% 下视觉 rect 是 289,578 / 47.6 */
  orb.getBoundingClientRect = () => ({ left: 289, top: 578, width: 47.6, height: 47.6, right: 336.6, bottom: 625.6 });
  w.document.body.style.zoom = "0.85";
  w.MapleLantern.open();
  assert.equal(panel.style.getPropertyValue("--ml-origin-x"), "268px");
  assert.equal(panel.style.getPropertyValue("--ml-origin-y"), "608px");
});

test("凝光：鼠标在面板内移动才点亮，坐标写成百分比变量", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: true } });
  const panel = w.document.getElementById("ml-panel");
  panel.getBoundingClientRect = () => ({ left: 0, top: 0, width: 380, height: 600, right: 380, bottom: 600 });
  w.MapleLantern.open();
  const ev = new w.MouseEvent("pointermove", { bubbles: true, clientX: 190, clientY: 300 });
  Object.defineProperty(ev, "pointerType", { value: "mouse" });
  panel.dispatchEvent(ev);
  await new Promise((r) => w.requestAnimationFrame(r));
  assert.equal(panel.getAttribute("data-light"), "1");
  assert.equal(panel.style.getPropertyValue("--ml-light-x"), "50.0%");
  assert.equal(panel.style.getPropertyValue("--ml-light-y"), "50.0%");
  w.MapleLantern.close();
  assert.equal(panel.hasAttribute("data-light"), false, "关闭后必须收掉凝光");
});

test("悬浮球拖拽：跟手阶段只写 transform，松手才落 left/top", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const orb = w.document.getElementById("ml-orb");
  const root = w.document.getElementById("ml-root");
  const left0 = orb.style.left;
  orb.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: 900, clientY: 400, button: 0 }));
  orb.dispatchEvent(new w.MouseEvent("pointermove", { bubbles: true, clientX: 760, clientY: 440 }));
  assert.equal(root.getAttribute("data-dragging"), "1");
  assert.match(orb.style.transform, /translate3d\(-?\d+px,-?\d+px,0\) scale\(1\.04\)/);
  assert.equal(orb.style.left, left0, "拖动中不得逐帧写 left/top");
  orb.dispatchEvent(new w.MouseEvent("pointerup", { bubbles: true, clientX: 760, clientY: 440 }));
  assert.equal(root.hasAttribute("data-dragging"), false);
  assert.match(orb.style.transform, /scale\(1\.04\)/, "松手后先留 scale 回弹，下一帧再清");
});

test("松手后立刻再按还能拖：click 抑制不会锁死下一次手势", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const orb = w.document.getElementById("ml-orb");
  const root = w.document.getElementById("ml-root");
  orb.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: 900, clientY: 400, button: 0 }));
  orb.dispatchEvent(new w.MouseEvent("pointermove", { bubbles: true, clientX: 820, clientY: 430 }));
  orb.dispatchEvent(new w.MouseEvent("pointerup", { bubbles: true, clientX: 820, clientY: 430 }));
  orb.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: 700, clientY: 400, button: 0 }));
  orb.dispatchEvent(new w.MouseEvent("pointermove", { bubbles: true, clientX: 650, clientY: 420 }));
  assert.equal(root.getAttribute("data-dragging"), "1", "第二次手势必须能重新接管");
});

test("拖拽中丢失指针捕获也会收尾，不会卡在 pending", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const orb = w.document.getElementById("ml-orb");
  const root = w.document.getElementById("ml-root");
  orb.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: 900, clientY: 400, button: 0 }));
  orb.dispatchEvent(new w.MouseEvent("pointermove", { bubbles: true, clientX: 780, clientY: 430 }));
  assert.equal(root.getAttribute("data-dragging"), "1");
  orb.dispatchEvent(new w.Event("lostpointercapture"));
  assert.equal(root.hasAttribute("data-dragging"), false, "丢失捕获必须结束拖拽态");
});

test("点按（无位移）仍能打开：pending 不能吃掉 click", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const orb = w.document.getElementById("ml-orb");
  orb.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: 900, clientY: 400, button: 0 }));
  orb.dispatchEvent(new w.MouseEvent("pointerup", { bubbles: true, clientX: 900, clientY: 400, button: 0 }));
  orb.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => w.requestAnimationFrame(r));
  assert.equal(w.document.getElementById("ml-panel").getAttribute("data-open"), "1");
});

test("拖拽结束后紧跟的 click 被吞掉，不会误开面板", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const orb = w.document.getElementById("ml-orb");
  orb.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: 900, clientY: 400, button: 0 }));
  orb.dispatchEvent(new w.MouseEvent("pointermove", { bubbles: true, clientX: 820, clientY: 430 }));
  orb.dispatchEvent(new w.MouseEvent("pointerup", { bubbles: true, clientX: 820, clientY: 430 }));
  orb.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 60));
  assert.notEqual(w.document.getElementById("ml-panel").getAttribute("data-open"), "1", "拖完不能顺手把面板打开");
});

test("右键不启动拖拽", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const orb = w.document.getElementById("ml-orb");
  orb.dispatchEvent(new w.MouseEvent("pointerdown", { bubbles: true, clientX: 900, clientY: 400, button: 2 }));
  orb.dispatchEvent(new w.MouseEvent("pointermove", { bubbles: true, clientX: 800, clientY: 400 }));
  assert.equal(w.document.getElementById("ml-root").hasAttribute("data-dragging"), false);
});

test("关闭前按当前高度重算原点：切页签长高后不会缩向旧球心", () => {
  const { w } = createEnv();
  const panel = w.document.getElementById("ml-panel");
  const orb = w.document.getElementById("ml-orb");
  const box = { left: 100, top: 100, width: 380, height: 600 };
  Object.defineProperties(panel, {
    offsetLeft: { configurable: true, get: () => box.left },
    offsetTop: { configurable: true, get: () => box.top },
    offsetWidth: { configurable: true, get: () => box.width },
    offsetHeight: { configurable: true, get: () => box.height }
  });
  orb.getBoundingClientRect = () => ({ left: 340, top: 680, width: 56, height: 56, right: 396, bottom: 736 });
  w.MapleLantern.open();
  assert.equal(panel.style.getPropertyValue("--ml-origin-y"), "592px");
  /* 切到更高的页签：面板上移、变高 */
  box.top = 40; box.height = 700;
  orb.getBoundingClientRect = () => ({ left: 340, top: 740, width: 56, height: 56, right: 396, bottom: 764 });
  w.MapleLantern.close();
  assert.equal(panel.style.getPropertyValue("--ml-origin-y"), "692px");
});

test("窗口 resize 后面板仍开着，原点按新布局重算", async () => {
  const { w } = createEnv();
  const panel = w.document.getElementById("ml-panel");
  const orb = w.document.getElementById("ml-orb");
  Object.defineProperties(panel, {
    offsetLeft: { configurable: true, value: 100 },
    offsetTop: { configurable: true, value: 100 },
    offsetWidth: { configurable: true, value: 380 },
    offsetHeight: { configurable: true, value: 600 }
  });
  orb.getBoundingClientRect = () => ({ left: 340, top: 680, width: 56, height: 56, right: 396, bottom: 736 });
  w.MapleLantern.open();
  orb.getBoundingClientRect = () => ({ left: 60, top: 200, width: 56, height: 56, right: 116, bottom: 256 });
  w.dispatchEvent(new w.Event("resize"));
  await new Promise((r) => setTimeout(r, 220));
  assert.equal(panel.style.getPropertyValue("--ml-origin-x"), "8px");
  assert.equal(panel.style.getPropertyValue("--ml-origin-y"), "128px");
});

test("环境层：8 颗粒子 + 天空层 + 1 层慢流，动效关闭时整层 hidden", () => {
  const on = createEnv({ seed: { v: 1, lang: "zh", motion: true } });
  const ambient = on.w.document.querySelector("#ml-root .ml-ambient");
  assert.ok(ambient, "缺主题环境层");
  assert.equal(ambient.getAttribute("aria-hidden"), "true");
  assert.equal(ambient.querySelectorAll(".ml-ambient__wisp").length, 8, "桌面固定 8 颗粒子");
  assert.ok(ambient.querySelector(".ml-ambient__veil"), "必须有一层整幅慢流");
  assert.ok(ambient.querySelector('.ml-ambient__sky[data-layer="sky"]'), "必须有一层天空底");
  assert.equal(ambient.children.length, 10, "8 颗粒子 + 1 层慢流 + 1 层天空底，不重复建层");
  assert.equal(ambient.lastElementChild.className, "ml-ambient__sky", "天空层最后追加，不改变 1~8 号粒子锚点");
  assert.equal(ambient.hidden, false, "动效开启时应参与渲染");

  const off = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const hiddenAmbient = off.w.document.querySelector("#ml-root .ml-ambient");
  assert.ok(hiddenAmbient, "动效关闭也应保留节点，便于设置切换后恢复");
  assert.equal(hiddenAmbient.hidden, true, "动效关闭必须整层移出渲染树");
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
  assert.equal(tabs.length, 6);

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

test("1.3.5 手机端：玻璃 100% 时模糊封顶 12px，桌面保留 32px", () => {
  const seed = { v: 1, lang: "zh", motion: false, glass: 100 };
  const { w: phone } = createEnv({ seed, width: 390, height: 844 });
  assert.equal(phone.document.getElementById("ml-root").style.getPropertyValue("--ml-blur"), "12px");
  const { w: desktop } = createEnv({ seed, width: 1024, height: 768 });
  assert.equal(desktop.document.getElementById("ml-root").style.getPropertyValue("--ml-blur"), "32px");
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

test("着装页：中文界面优先游戏汉化名，英文界面保留游戏原名", () => {
  const vars = { worn: {
    upper: { name: "Sundress", cn_name_cap: "夏日连衣裙" },
    feet: { name: "School shoes", cn_name_cap: "校服鞋" }
  } };
  const { w } = createEnv({ vars });
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="worn"]').click();
  const text = pane(w).textContent;
  assert.match(text, /夏日连衣裙/);
  assert.match(text, /校服鞋/);
  assert.ok(!text.includes("Sundress"));
  assert.ok(!text.includes("School shoes"));
  const upper = Array.from(w.document.querySelectorAll(".ml-slot-v"))
    .find((node) => node.textContent === "夏日连衣裙");
  assert.equal(upper.getAttribute("title"), "夏日连衣裙 · Sundress");
  assert.match(text, /游戏汉化包/);

  const { w: en } = createEnv({ vars, seed: { v: 1, lang: "en", motion: false } });
  en.MapleLantern.open();
  en.document.querySelector('[data-tab="worn"]').click();
  const enText = pane(en).textContent;
  assert.match(enText, /Sundress/);
  assert.match(enText, /School shoes/);
  assert.ok(!enText.includes("夏日连衣裙"));
});

test("页签光线：单一指示器跟随选中页签，切换时滑到新位置", () => {
  const { w } = createEnv();
  const tabs = w.document.querySelectorAll("#ml-panel .ml-tab");
  [12, 68, 124, 180, 236].forEach((left, i) => {
    Object.defineProperties(tabs[i], {
      offsetLeft: { configurable: true, value: left },
      offsetWidth: { configurable: true, value: 54 }
    });
  });
  w.MapleLantern.open();
  const glint = w.document.querySelector(".ml-tab-glint");
  assert.ok(glint, "缺页签光线指示器");
  assert.equal(glint.getAttribute("aria-hidden"), "true");
  assert.equal(glint.style.width, "38px");
  assert.equal(glint.style.transform, "translateX(20px)");
  assert.equal(glint.style.opacity, "1");

  w.document.querySelector('[data-tab="worn"]').click();
  assert.equal(glint.style.transform, "translateX(132px)");
  assert.equal(glint.style.width, "38px");
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

test("设置：通透度滑块 pointercancel 后立即结束拖动，不被后续 move 改值", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="settings"]').click();
  const slider = w.document.querySelector('.ml-slider[data-key="glass"]');
  const pointer = (type, x) => {
    const ev = new w.MouseEvent(type, { bubbles: true, clientX: x });
    ev.pointerId = 1;
    slider.dispatchEvent(ev);
  };
  pointer("pointerdown", 10);
  const afterDown = slider.getAttribute("aria-valuenow");
  pointer("pointercancel", 10);
  pointer("pointermove", 100);
  assert.equal(slider.getAttribute("aria-valuenow"), afterDown, "pointercancel 后不得继续跟随 move");
});

test("销毁：移除 DOM、解绑键盘，再调用不抛错", () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  w.MapleLantern.destroy();
  assert.equal(w.document.getElementById("ml-root"), null);
  assert.doesNotThrow(() => w.MapleLantern.open());
  assert.doesNotThrow(() => w.MapleLantern.destroy());
});

test("销毁：级联调用原生 / 外观 / 面板 destroy，且与渲染层一致幂等", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const SRC = path.join(__dirname, "..", "src");
  for (const file of ["dossier-core.js", "dossier-assets.js", "dossier-theme.js", "dossier-panel.js"]) {
    w.eval(fs.readFileSync(path.join(SRC, file), "utf8"));
  }
  const calls = [];
  for (const [name, api] of [["native", w.MapleLanternNative], ["theme", w.MapleLanternDossierTheme], ["panel", w.MapleLanternDossierPanel]]) {
    assert.ok(api && typeof api.destroy === "function", name + " 必须提供 destroy");
    const original = api.destroy;
    api.destroy = function () { calls.push(name); return original.apply(this, arguments); };
  }
  w.MapleLantern.destroy();
  assert.deepEqual(calls, ["native", "theme", "panel"], "渲染层销毁必须级联子层");
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

test("设置页：第三方美化页开关默认关闭，点击后持久化", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="settings"]').click();
  const sw = w.document.querySelector('button.ml-switch[aria-label="美化页启用灯台 UI"]');
  assert.ok(sw, "设置页必须有第三方美化页启用开关");
  assert.equal(sw.getAttribute("aria-checked"), "false", "默认不启用");
  sw.click();
  assert.equal(sw.getAttribute("aria-checked"), "true");
  await new Promise((r) => setTimeout(r, 50));
  const saved = JSON.parse(w.localStorage.getItem("MapleLantern.settings.v1"));
  assert.equal(saved.thirdPartyNative, true);
});

test("设置页：原生卡片、悬浮灯台与美化页三个总开关", async () => {
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

test("「开关」页：9 个原生模块独立开关，点一项只撤对应根属性", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  const money = w.document.querySelector("#stats .true");
  money.textContent = "£1,234";
  w.MapleLanternNative.refresh();
  await new Promise((r) => w.setTimeout(r, 30));
  assert.equal(money.textContent, "£1,234.00");

  w.MapleLantern.open();
  w.document.querySelector('[data-tab="switches"]').click();
  assert.equal(w.document.querySelector('[data-tab="switches"] .ml-tab-label').textContent, "开关");
  assert.equal(w.document.querySelectorAll("#ml-panel .ml-field--opt").length, 9);

  const row = w.document.querySelector('[data-opt-key="optMoney"] .ml-switch');
  row.click();
  await new Promise((r) => w.setTimeout(r, 30));
  const root = w.document.documentElement;
  assert.equal(root.getAttribute("data-ml-opt-money"), null);
  assert.equal(root.getAttribute("data-ml-opt-stats"), "1", "只关金额，不能把顶部四格一起关掉");
  assert.equal(row.getAttribute("aria-checked"), "false");
  assert.equal(money.textContent, "£1,234");
  const saved = JSON.parse(w.localStorage.getItem("MapleLantern.settings.v1"));
  assert.equal(saved.optMoney, false);
});

test("A1 前景背景桥接：优先命中侧栏入口，不误点灯台自己的按钮", async () => {
  const vars = {
    willpower: 40, willpowermax: 1000,
    stress: 0, stressmax: 10000,
    trauma: 200, traumamax: 5000,
    arousal: 800, arousalmax: 10000,
    tiredness: 600, pain: 0,
    control: 500, controlmax: 1000,
    allure: 800,
    foreground_image1: "1"
  };
  const { w } = createEnv({ vars, seed: { v: 1, lang: "zh", motion: false } });
  const doc = w.document;
  const bar = doc.getElementById("ui-bar");
  const buttons = doc.createElement("div");
  buttons.id = "overlayButtons";
  const sidebarButton = doc.createElement("button");
  sidebarButton.type = "button";
  sidebarButton.textContent = "前景背景";
  sidebarButton.addEventListener("click", () => { sidebarButton.__hit = (sidebarButton.__hit || 0) + 1; });
  buttons.appendChild(sidebarButton);
  bar.appendChild(buttons);

  const root = doc.getElementById("ml-root");
  const decoy = doc.createElement("button");
  decoy.type = "button";
  decoy.textContent = "前景背景";
  decoy.addEventListener("click", () => { decoy.__hit = (decoy.__hit || 0) + 1; });
  root.appendChild(decoy);

  w.MapleLantern.open();
  const bridge = doc.querySelector('[data-ml-bridge="decorations"]');
  assert.ok(bridge, "装了 decorations 时必须出现前景背景桥接行");
  bridge.click();
  await new Promise((r) => w.setTimeout(r, 360));

  assert.equal(sidebarButton.__hit, 1, "桥接打开必须点击侧栏的前景背景入口");
  assert.equal(decoy.__hit || 0, 0, "不得误点 #ml-root 内的同名按钮");
});
