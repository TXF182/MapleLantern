/* 灯台 MapleLantern — 布景工作台 jsdom 契约测试 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createEnv } = require("./env.js");

function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms || 0)); }

function fakeRenderer(extraLayer) {
  const template = { width: 256, height: 256, frames: 2, layers: {} };
  if (extraLayer) template.layers.decoration_background1 = { name: "decoration_background1", animation: "idle", srcfn: () => "img/decorations/background1/town.png", showfn: () => true, zfn: () => -30 };
  return {
    CanvasModels: { main: template },
    CanvasModelCaches: { main: { slot: { layers: {}, layerList: [] } } },
    RenderingPipeline: [],
    createCanvas() { return { canvas: {}, fillRect() {}, drawImage() {} }; }
  };
}

async function openSettings(opts) {
  const dataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  opts = Object.assign({}, opts, { modUtils: opts.modUtils || { getImage: () => dataUrl } });
  const env = createEnv(opts);
  env.w.MapleLantern.open();
  env.w.document.querySelector('[data-tab="settings"]').click();
  await wait(140);
  if (env.w.MapleLanternDecoPanel && typeof env.w.MapleLanternDecoPanel.boot === "function") {
    env.w.MapleLanternDecoPanel.boot();
  }
  await wait(5);
  return env;
}

test("设置页入口：注入在恢复默认之前，不新增第 7 页签", async () => {
  const { w } = await openSettings({ mutable: true, seed: { v: 1, lang: "zh", motion: false } });
  const entry = w.document.querySelector("[data-ml-deco-entry]");
  assert.ok(entry, "布景入口应出现");
  const resets = w.document.querySelector("#ml-pane .ml-resets");
  assert.ok(resets, "设置页应有恢复默认");
  assert.equal(entry.nextElementSibling, resets, "入口必须在恢复默认之前");
  assert.equal(w.document.querySelectorAll(".ml-tabs .ml-tab").length, 6, "不得新增第 7 页签");
  assert.match(entry.textContent, /灯台原生|布景/);
});

test("工作台：打开后有 9 张图层卡、图库和预设入口", async () => {
  const renderer = fakeRenderer();
  const { w } = await openSettings({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: { Locations: { get: () => "town" }, locations: { town: { parent: "world", outside: 1 } } },
    renderer
  });
  const entry = w.document.querySelector("[data-ml-deco-entry]");
  entry.querySelector("button").click();
  await wait(5);
  const modal = w.document.querySelector("[data-ml-deco-modal]");
  assert.ok(modal);
  assert.equal(modal.hidden, false);
  assert.equal(modal.querySelectorAll(".ml-deco-card").length, 9, "九层卡片");
  assert.equal(modal.querySelectorAll(".ml-deco-pick").length, 0, "选择器初始关闭");
  assert.match(modal.textContent, /九层图层/);
  assert.equal(w.MapleLanternDeco.mode(), "native");
  assert.equal(w.MapleLanternDeco.collectLayers(renderer).decoration_background1.__mlDeco, true);
});

test("选图：从背景1图库选中后写入兼容变量并关闭图库", async () => {
  const { w } = await openSettings({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: { Locations: { get: () => "town" }, locations: { town: { parent: "world", outside: 1 } } },
    renderer: fakeRenderer()
  });
  const modal = w.document.querySelector("[data-ml-deco-modal]");
  if (!modal) {
    w.document.querySelector("[data-ml-deco-entry] button").click();
    await wait(5);
  }
  const m = w.document.querySelector("[data-ml-deco-modal]");
  const bg1 = Array.from(m.querySelectorAll(".ml-deco-card")).find((card) => card.getAttribute("data-layer") === "background1");
  assert.ok(bg1);
  bg1.querySelector(".ml-btn.ml-btn-sm").click();
  await wait(2);
  const picker = m.querySelector(".ml-deco-picker");
  assert.equal(picker.hidden, false, "图库应打开");
  const beach = Array.from(picker.querySelectorAll(".ml-deco-pick")).find((item) => /beach/.test(item.textContent));
  assert.ok(beach);
  beach.click();
  await wait(2);
  const v = w.SugarCube.State.variables;
  assert.equal(v.background_image1, "beach");
  assert.equal(v.show_background1, true);
  assert.equal(v.decoAutoBgEnabled, false, "手动选图应关闭自动覆盖");
  assert.equal(picker.hidden, true, "选完应关闭图库");
});

test("预设：保存当前九层并从槽位恢复", async () => {
  const { w } = await openSettings({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: { Locations: { get: () => "town" }, locations: { town: { parent: "world", outside: 1 } } },
    renderer: fakeRenderer()
  });
  const m = w.document.querySelector("[data-ml-deco-modal]");
  if (!m) { w.document.querySelector("[data-ml-deco-entry] button").click(); await wait(5); }
  const modal = w.document.querySelector("[data-ml-deco-modal]");
  const bg1 = Array.from(modal.querySelectorAll(".ml-deco-card")).find((card) => card.getAttribute("data-layer") === "background1");
  bg1.querySelectorAll(".ml-btn.ml-btn-sm")[1].click(); // clear
  w.MapleLanternDecoPanel.setImage(w.MapleLanternDeco.LAYERS[0], "beach", "background1");
  const input = modal.querySelector(".ml-deco-preset-new .ml-deco-input");
  input.value = "海边";
  modal.querySelector(".ml-deco-preset-new .ml-btn").click();
  await wait(2);
  const preset = w.SugarCube.State.variables.decoPresets[1];
  assert.ok(preset);
  assert.equal(preset.name, "海边");
  assert.equal(preset.background1, "beach");
  assert.equal(modal.querySelectorAll(".ml-deco-preset").length, 1);
});

test("原模组存在时让位：入口与工作台显示原模组接管，不重复注册", async () => {
  const renderer = fakeRenderer(true);
  const { w } = await openSettings({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: { Locations: { get: () => "town" }, locations: { town: { parent: "world", outside: 1 } } },
    renderer
  });
  assert.equal(w.MapleLanternDeco.mode(), "external");
  const entry = w.document.querySelector("[data-ml-deco-entry]");
  assert.match(entry.textContent, /原模组接管/);
  entry.querySelector("button").click();
  await wait(2);
  assert.match(w.document.querySelector("[data-ml-deco-modal]").textContent, /只写兼容变量/);
});

test("入口锚点：嵌套 .ml-resets 不会劫持 insertBefore", async () => {
  const { w } = await openSettings({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: { Locations: { get: () => "town" }, locations: { town: { parent: "world", outside: 1 } } },
    renderer: fakeRenderer()
  });
  const doc = w.document;
  const pane = doc.getElementById("ml-pane");
  const old = pane.querySelector("[data-ml-deco-entry]");
  if (old) old.remove();
  const custom = doc.createElement("div");
  custom.className = "md-custom";
  const nested = doc.createElement("div");
  nested.className = "ml-resets md-resets";
  custom.appendChild(nested);
  const direct = Array.from(pane.children).find((node) => node.classList.contains("ml-resets"));
  assert.ok(direct, "设置页应有直接的恢复默认容器");
  pane.insertBefore(custom, direct);
  assert.doesNotThrow(() => w.MapleLanternDecoPanel.inject());
  const entry = pane.querySelector("[data-ml-deco-entry]");
  assert.ok(entry, "嵌套同名容器存在时入口仍应注入");
  assert.equal(entry.nextElementSibling, direct, "入口必须紧跟直接恢复默认容器，而非嵌套容器");
});

test("销毁：移除入口与弹层，清空 API 与延迟自举", async () => {
  const { w } = await openSettings({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: { Locations: { get: () => "town" }, locations: { town: { parent: "world", outside: 1 } } },
    renderer: fakeRenderer()
  });
  w.document.querySelector("[data-ml-deco-entry] button").click();
  await wait(2);
  assert.ok(w.document.querySelector("[data-ml-deco-modal]"));
  const api = w.MapleLanternDecoPanel;
  api.destroy();
  assert.equal(w.MapleLanternDecoPanel, null);
  assert.equal(w.document.querySelector("[data-ml-deco-entry]"), null);
  assert.equal(w.document.querySelector("[data-ml-deco-modal]"), null);
});
