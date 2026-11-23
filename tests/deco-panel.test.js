/* 灯台 MapleLantern — 独立布景页 jsdom 契约测试 */
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

async function openDeco(opts) {
  const dataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  opts = Object.assign({}, opts, { modUtils: opts.modUtils || { getImage: () => dataUrl } });
  const env = createEnv(opts);
  env.w.MapleLantern.open();
  env.w.document.querySelector('[data-tab="deco"]').click();
  await wait(5);
  if (env.w.MapleLanternDecoPanel && typeof env.w.MapleLanternDecoPanel.boot === "function") {
    env.w.MapleLanternDecoPanel.boot();
  }
  await wait(5);
  return env;
}

function setupTown() {
  return { Locations: { get: () => "town" }, locations: { world: { parent: undefined, outside: 1 }, town: { parent: "world", outside: 1 } } };
}

test("独立布景页：第 7 个页签，入口不再嵌在设置页，也不再生成工作台弹层", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer()
  });
  const doc = w.document;
  assert.equal(doc.querySelectorAll(".ml-tabs .ml-tab").length, 7, "布景必须是独立第 7 页签");
  assert.equal(doc.querySelector('[data-tab="deco"]').getAttribute("aria-selected"), "true");
  assert.equal(doc.getElementById("ml-pane").getAttribute("aria-labelledby"), "ml-tab-deco");
  assert.ok(doc.querySelector("#ml-pane [data-deco-page]"), "布景内容必须直接渲染在页签内");
  assert.equal(doc.querySelector("[data-ml-deco-entry]"), null, "设置页不得再出现布景入口");
  assert.equal(doc.querySelector("[data-ml-deco-modal]"), null, "不得再生成独立工作台弹层");
  assert.equal(doc.querySelectorAll("[data-deco-page] .ml-deco-card").length, 9, "九层卡片");
  const page = doc.querySelector("[data-deco-page]");
  assert.match(page.textContent, /九层图层/);
  assert.match(page.textContent, /预设/);
  assert.match(page.textContent, /自动背景/);
  assert.match(page.textContent, /已停用/);
  assert.match(page.textContent, /图库已接入/);
  assert.equal(Number(page.querySelector("[data-deco-pack-status]").textContent.match(/83/)[0]), 83);
  ["套用", "储存", "删除", "+ 新增预设", "添加", "加入当前地点", "一键添加所有地点", "关闭自动并清空名单", "恢复玩家背景"].forEach((label) => {
    assert.match(page.textContent, new RegExp(label.replace("+", "\\+")));
  });
  assert.equal(page.querySelectorAll("details[data-deco-group]").length, 2, "背景/前景两个折叠组");
  assert.match(page.querySelector('[data-deco-group="background"] summary').textContent, /背景 1–4/);
  assert.match(page.querySelector('[data-deco-group="foreground"] summary').textContent, /前景 1–5/);
  assert.equal(page.querySelector('[data-deco-picker] select'), null, "来源文件夹下拉框已删除");
  assert.equal(page.querySelectorAll("[data-deco-filter-layer]").length, 4, "滤镜只列 4 个背景层");
  assert.ok(page.querySelector('[data-deco-filter-layer="background4"]'));
  assert.equal(page.querySelector('[data-deco-filter-layer="foreground1"]'), null);
  assert.equal(w.MapleLanternDeco.mode(), "native");
  assert.equal(w.MapleLanternDeco.collectLayers(w.Renderer).decoration_background1.__mlDeco, true);
});

test("选图：页内图库直接选中，写入兼容变量并自动收起", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer()
  });
  const page = w.document.querySelector("[data-deco-page]");
  const bg1 = Array.from(page.querySelectorAll(".ml-deco-card")).find((card) => card.getAttribute("data-layer") === "background1");
  assert.ok(bg1);
  bg1.querySelector("[data-deco-select-image]").click();
  await wait(2);
  const picker = page.querySelector(".ml-deco-picker");
  assert.equal(picker.hidden, false, "图库应展开在页内");
  const beach = Array.from(picker.querySelectorAll(".ml-deco-pick")).find((item) => /beach/.test(item.textContent));
  assert.ok(beach);
  beach.click();
  await wait(2);
  const v = w.SugarCube.State.variables;
  assert.equal(v.background_image1, "beach");
  assert.equal(v.show_background1, true);
  assert.equal(v.decoAutoBgEnabled, false, "手动选图应关闭自动覆盖");
  assert.equal(w.document.querySelector("[data-deco-page] .ml-deco-picker").hidden, true, "选完应自动收起");
});

test("关闭图库后回到发起选图的图层卡，不把页面留在下层", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer()
  });
  const page = w.document.querySelector("[data-deco-page]");
  const bg1 = Array.from(page.querySelectorAll(".ml-deco-card")).find((card) => card.getAttribute("data-layer") === "background1");
  assert.ok(bg1);
  const proto = w.HTMLElement.prototype;
  const had = "scrollIntoView" in proto;
  const old = proto.scrollIntoView;
  const seen = [];
  proto.scrollIntoView = function () {
    var layer = this.getAttribute && this.getAttribute("data-layer");
    if (layer) seen.push(layer);
  };
  try {
    bg1.querySelector("[data-deco-select-image]").click();
    await wait(2);
    page.querySelector(".ml-deco-picker .ml-deco-close").click();
    await wait(2);
    assert.equal(w.document.querySelector("[data-deco-page] .ml-deco-picker").hidden, true);
    assert.equal(seen[seen.length - 1], "background1", "关闭图库应回到 background1 卡片");
  } finally {
    if (had) proto.scrollIntoView = old;
    else delete proto.scrollIntoView;
  }
});

test("预设：新增 / 储存 / 套用 / 删除都在布景页内完成", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer()
  });
  const v = w.SugarCube.State.variables;
  w.prompt = () => "海边";
  w.confirm = () => true;
  w.MapleLanternDecoPanel.setImage(w.MapleLanternDeco.LAYERS[0], "beach", "background1");
  await wait(2);
  let page = w.document.querySelector("[data-deco-page]");
  page.querySelector("[data-deco-preset-new]").click();
  await wait(2);
  assert.ok(v.decoPresets[1]);
  assert.equal(v.decoPresets[1].background1, "beach");
  assert.equal(v.decoPresets[1].name, "海边");

  w.prompt = () => "海边改名";
  page = w.document.querySelector("[data-deco-page]");
  page.querySelector("[data-deco-preset-save]").click();
  await wait(2);
  assert.equal(v.decoPresets[1].name, "海边改名");

  w.MapleLanternDecoPanel.setImage(w.MapleLanternDeco.LAYERS[0], "none", "background1");
  await wait(2);
  page = w.document.querySelector("[data-deco-page]");
  page.querySelector("[data-deco-preset-apply]").click();
  await wait(2);
  assert.equal(v.background_image1, "beach");

  page = w.document.querySelector("[data-deco-page]");
  page.querySelector("[data-deco-preset-delete]").click();
  await wait(2);
  assert.equal(v.decoPresets[1], undefined);
});

test("自动背景：默认关闭、严格名单增删与重置", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: { Locations: { get: () => "home" }, locations: { world: { parent: undefined, outside: 1 }, home: { parent: "world", outside: 0 } } },
    renderer: fakeRenderer()
  });
  const page = w.document.querySelector("[data-deco-page]");
  const v = w.SugarCube.State.variables;
  const auto = page.querySelector("[data-deco-auto-toggle]");
  assert.equal(auto.checked, false, "自动背景默认必须关闭");
  assert.match(page.querySelector("[data-deco-auto-state]").textContent, /已停用/);
  assert.match(page.querySelector("[data-deco-locations]").textContent, /列表为空/);
  auto.click();
  await wait(2);
  assert.equal(v.decoAutoBgEnabled, true);
  assert.ok(v.decoAutoBgLocations.includes("home"), "开启自动背景必须自动收录当前地点");
  assert.match(w.document.querySelector("[data-deco-locations]").textContent, /home/);
  assert.equal(v.background_image1, "home");
  assert.match(w.document.querySelector("[data-deco-auto-state]").textContent, /已启用/);
  w.document.querySelector("[data-deco-auto-toggle]").click();
  await wait(2);
  assert.equal(v.decoAutoBgEnabled, false);
  assert.match(w.document.querySelector("[data-deco-auto-state]").textContent, /已停用/);

  const input = w.document.querySelector("[data-deco-location-input]");
  input.value = "home";
  w.document.querySelector("[data-deco-location-add]").click();
  await wait(2);
  assert.deepEqual(Array.from(v.decoAutoBgLocations), ["home"]);
  assert.match(w.document.querySelector("[data-deco-locations]").textContent, /home/);

  w.document.querySelector("[data-deco-location-remove='home']").click();
  await wait(2);
  assert.equal(v.decoAutoBgLocations.length, 0);
  assert.equal(v.decoAutoBgDisabled, undefined, "删除地点不再写入隐藏停用名单");
  assert.ok(v.decoAutoBgExcluded.includes("home"), "删除地点必须记为手动排除，避免自动回流");

  w.document.querySelector("[data-deco-location-current]").click();
  await wait(2);
  assert.ok(v.decoAutoBgLocations.includes("home"));
  assert.ok(!v.decoAutoBgExcluded.includes("home"), "手动加入当前地点必须解除排除");

  w.document.querySelector("[data-deco-location-reset]").click();
  await wait(2);
  assert.equal(v.decoAutoBgEnabled, false);
  assert.equal(v.decoAutoBgFilterEnabled, undefined, "重置自动背景不误关独立滤镜");
  assert.equal(v.decoAutoBgLocations.length, 0);
  assert.equal(v.decoAutoBgDisabled, undefined);
  assert.equal(v.decoAutoBgExcluded, undefined, "重置自动背景必须清空排除名单");
  assert.match(w.document.querySelector("[data-deco-auto-state]").textContent, /已停用/);
});

test("自动背景：一键添加所有图库地点并解除排除", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer()
  });
  const page = w.document.querySelector("[data-deco-page]");
  const v = w.SugarCube.State.variables;
  v.decoAutoBgExcluded = ["home"];
  page.querySelector("[data-deco-location-add-all]").click();
  await wait(2);
  assert.equal(v.decoAutoBgLocations.length, w.MapleLanternDeco.CATALOG.length, "一键添加应覆盖全部图库地点");
  assert.equal(v.decoAutoBgExcluded, undefined, "一键添加所有地点必须解除全部排除");
  assert.equal(w.document.querySelectorAll("[data-deco-location-remove]").length, w.MapleLanternDeco.CATALOG.length);
});

test("缩略图：有 IntersectionObserver 时不预拉全部图库", async () => {
  const dataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  let loads = 0;
  const observers = [];
  class FakeObserver {
    constructor(callback) { this.callback = callback; this.nodes = []; observers.push(this); }
    observe(node) { this.nodes.push(node); }
    disconnect() { this.disconnected = true; }
    trigger() { this.callback(this.nodes.map((node) => ({ isIntersecting: true, target: node }))); }
  }
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer(),
    IntersectionObserver: FakeObserver,
    modUtils: { getImage: () => { loads++; return dataUrl; } }
  });
  await wait(15);
  assert.equal(loads, 3, "进入页面只探测三个图库哨兵，不批量拉图");
  const page = w.document.querySelector("[data-deco-page]");
  const bg1 = Array.from(page.querySelectorAll(".ml-deco-card")).find((card) => card.getAttribute("data-layer") === "background1");
  bg1.querySelector("[data-deco-select-image]").click();
  await wait(5);
  assert.equal(loads, 3, "打开图库也只登记观察，不加载全部 83 张");
  const pickerObserver = observers.filter((observer) => observer.nodes.some((node) => node.classList && node.classList.contains("ml-deco-pick-thumb"))).pop();
  assert.ok(pickerObserver);
  pickerObserver.trigger();
  await wait(5);
  assert.equal(loads, 4, "进入视口的那一张才真正读取");
});

test("图库缺包：状态提示与图片缺失文案", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer(),
    modUtils: { getImage: () => undefined }
  });
  await wait(15);
  let page = w.document.querySelector("[data-deco-page]");
  assert.match(page.querySelector("[data-deco-pack-status]").textContent, /图库包未加载/);
  assert.ok(page.querySelector("[data-deco-pack-status]").classList.contains("is-missing"));
  assert.equal(page.querySelector("[data-deco-auto-toggle]").disabled, true, "缺包时不得开启自动背景");
  assert.equal(page.querySelector("[data-deco-location-add-all]").disabled, true, "缺包时不得一键添加所有地点");
  assert.equal(page.querySelector("[data-deco-pack-retry]").hidden, false, "缺包时应给重新检测入口");
  assert.equal(w.MapleLanternDecoPanel.mode(), "native");

  const bg1 = Array.from(page.querySelectorAll(".ml-deco-card")).find((node) => node.getAttribute("data-layer") === "background1");
  bg1.querySelector("[data-deco-select-image]").click();
  await wait(2);
  const picker = page.querySelector(".ml-deco-picker");
  const beach = Array.from(picker.querySelectorAll(".ml-deco-pick")).find((item) => /beach/.test(item.textContent));
  const none = Array.from(picker.querySelectorAll(".ml-deco-pick")).find((item) => /^无/.test(item.textContent.trim()));
  assert.equal(beach.disabled, true, "缺包时不得从图库选中不存在的图");
  assert.equal(none.disabled, false, "缺包时仍应允许清除背景");

  w.MapleLanternDecoPanel.setImage(w.MapleLanternDeco.LAYERS[0], "beach", "background1");
  await wait(2);
  page = w.document.querySelector("[data-deco-page]");
  const card = Array.from(page.querySelectorAll(".ml-deco-card")).find((node) => node.getAttribute("data-layer") === "background1");
  assert.equal(card.querySelector(".ml-deco-thumb-empty").textContent, "图片缺失");
  assert.equal(card.querySelector(".ml-deco-thumb").getAttribute("data-thumb-state"), "missing");
});

test("图库抽查：部分缺图显示不完整，重新检测后恢复", async () => {
  const dataUrl = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  let ready = false;
  const calls = [];
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer(),
    modUtils: {
      getImage: () => {
        calls.push(1);
        return (ready || calls.length === 1) ? dataUrl : undefined;
      }
    }
  });
  await wait(15);
  let page = w.document.querySelector("[data-deco-page]");
  assert.match(page.querySelector("[data-deco-pack-status]").textContent, /图库不完整/);
  assert.ok(page.querySelector("[data-deco-pack-status]").classList.contains("is-partial"));
  assert.equal(page.querySelector("[data-deco-pack-hint]").hidden, false);
  assert.equal(page.querySelector("[data-deco-pack-retry]").hidden, false);
  assert.ok(calls.length >= 3, "应抽查多个哨兵");

  ready = true;
  page.querySelector("[data-deco-pack-retry]").click();
  await wait(20);
  page = w.document.querySelector("[data-deco-page]");
  assert.match(page.querySelector("[data-deco-pack-status]").textContent, /图库已接入/);
  assert.ok(page.querySelector("[data-deco-pack-status]").classList.contains("is-ready"));
  assert.equal(page.querySelector("[data-deco-pack-hint]").hidden, true);
  assert.equal(page.querySelector("[data-deco-pack-retry]").hidden, true);
  assert.ok(calls.length > 3, "重新检测必须重新读取哨兵");
});

test("自动名单：图库无图的地点明确标记并警告", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer()
  });
  const page = w.document.querySelector("[data-deco-page]");
  const input = page.querySelector("[data-deco-location-input]");
  input.value = "world";
  page.querySelector("[data-deco-location-add]").click();
  await wait(2);
  const v = w.SugarCube.State.variables;
  assert.deepEqual(Array.from(v.decoAutoBgLocations), ["world"]);
  const fresh = w.document.querySelector("[data-deco-page]");
  const remove = fresh.querySelector("[data-deco-location-remove='world']");
  assert.ok(remove);
  const chip = remove.parentNode;
  assert.ok(chip.classList.contains("is-missing"), "无图地点应有缺失标记");
  assert.match(chip.textContent, /图库无此图/);
  assert.match(fresh.querySelector("[data-deco-auto-no-image]").textContent, /world/);
});

test("原模组存在时让位：布景页显示原模组接管，不重复注册", async () => {
  const renderer = fakeRenderer(true);
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer
  });
  assert.equal(w.MapleLanternDeco.mode(), "external");
  assert.match(w.document.querySelector("[data-deco-page]").textContent, /原模组接管/);
  assert.match(w.document.querySelector("[data-deco-page]").textContent, /只写兼容变量/);
});

test("销毁：移除布景页并清空 API", async () => {
  const { w } = await openDeco({
    mutable: true,
    seed: { v: 1, lang: "zh", motion: false },
    setup: setupTown(),
    renderer: fakeRenderer()
  });
  assert.ok(w.document.querySelector("[data-deco-page]"));
  const api = w.MapleLanternDecoPanel;
  api.destroy();
  assert.equal(w.MapleLanternDecoPanel, null);
  assert.equal(w.document.querySelector("[data-deco-page]"), null);
});
