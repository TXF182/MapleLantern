/* 灯台 MapleLantern — 布景核心单元测试（不依赖 DOM / 游戏宿主） */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/deco-core.js");

function vars(extra) {
  return Object.assign({
    location: "town",
    decoImageZ: {},
    decoPresets: {}
  }, extra || {});
}

test("九层定义：4 背景 + 5 前景，Z 基准与变量名固定", () => {
  assert.equal(D.LAYERS.length, 9);
  assert.deepEqual(D.LAYERS.map(l => l.id), [
    "background1", "background2", "background3", "background4",
    "foreground1", "foreground2", "foreground3", "foreground4", "foreground5"
  ]);
  assert.deepEqual(D.LAYERS.map(l => l.zKey), [
    "deco_bg1", "deco_bg2", "deco_bg3", "deco_bg4",
    "deco_fg1", "deco_fg2", "deco_fg3", "deco_fg4", "deco_fg5"
  ]);
  assert.deepEqual(D.LAYERS.map(l => l.baseZ), [-30, -25, -20, -15, 300, 305, 310, 315, 320]);
  assert.equal(D.LAYERS[0].varKey, "background_image1");
  assert.equal(D.LAYERS[8].varKey, "foreground_image5");
});

test("变量归一：undefined / null / 空串 / none 都视为无图", () => {
  for (const value of [undefined, null, "", "none", " none ", "NONE"]) {
    assert.equal(D.normalizeName(value), "none");
  }
  assert.equal(D.normalizeName("beach.png"), "beach");
  assert.equal(D.normalizeName("  beach  "), "beach");
  assert.equal(D.normalizeName("../evil"), "none");
  assert.equal(D.normalizeName("a/b"), "none");
});

test("图片路径：九层统一走灯台独立图库，override 兼容旧路径并归一到图库", () => {
  const v = vars({ background_image1: "beach" });
  assert.equal(D.imagePath(D.LAYERS[0], v), "img/decorations/ml/background1/beach.png");
  v.foreground_image1 = "beach";
  assert.equal(D.imagePath(D.LAYERS[4], v), "img/decorations/ml/background1/beach.png");
  v.decoImagePath = { foreground1: "img/decorations/background1/beach.png" };
  assert.equal(D.imagePath(D.LAYERS[4], v), "img/decorations/ml/background1/beach.png");
  v.decoImagePath.foreground1 = "img/decorations/foreground1/hero.png";
  assert.equal(D.imagePath(D.LAYERS[4], v), "img/decorations/ml/background1/hero.png");
  v.decoImagePath.foreground1 = "../bad.png";
  assert.equal(D.imagePath(D.LAYERS[4], v), "img/decorations/ml/background1/beach.png");
});

test("显示开关：未声明为显示，显式 false 才隐藏", () => {
  assert.equal(D.layerVisible(D.LAYERS[0], vars()), true);
  assert.equal(D.layerVisible(D.LAYERS[0], vars({ show_background1: true })), true);
  assert.equal(D.layerVisible(D.LAYERS[0], vars({ show_background1: false })), false);
});

test("Z 偏移：基准 + decoImageZ，非数值按 0，范围夹紧", () => {
  assert.equal(D.layerZ(D.LAYERS[0], vars()), -30);
  assert.equal(D.layerZ(D.LAYERS[0], vars({ decoImageZ: { deco_bg1: 12 } })), -18);
  assert.equal(D.layerZ(D.LAYERS[0], vars({ decoImageZ: { deco_bg1: "12" } })), -18);
  assert.equal(D.layerZ(D.LAYERS[0], vars({ decoImageZ: { deco_bg1: 999 } })), 20);
  assert.equal(D.layerZ(D.LAYERS[0], vars({ decoImageZ: { deco_bg1: -999 } })), -80);
});

test("地点链：视觉地点、基础地点、location 别名、父级逐层回退", () => {
  const setup = {
    Locations: { get: () => "tower" },
    locations: {
      world: { parent: undefined, outside: 1 },
      castle: { parent: "world", location: "tower", outside: 1 },
      tower: { parent: "castle", outside: 1 },
      town: { parent: "world", outside: 1 },
      beach: { parent: "town", outside: 1 },
      changingroom: { parent: "beach", outside: 0 }
    }
  };
  const info = D.locationInfo(vars({ location: "changingroom" }), setup);
  assert.equal(info.visual, "tower");
  assert.ok(info.chain.includes("tower"));
  assert.ok(info.chain.includes("changingroom"));
  assert.ok(info.chain.includes("beach"));
  assert.ok(info.chain.includes("town"));
  assert.equal(info.outside, false);

  const castleInfo = D.locationInfo(vars({ location: "castle" }), setup);
  assert.ok(castleInfo.chain.includes("castle"));
  assert.ok(castleInfo.chain.includes("tower"));
});

test("自动地点：严格白名单；当前地点有图优先，否则父级；castle 走 tower", () => {
  const setup = {
    Locations: { get: () => "tower" },
    locations: {
      world: { parent: undefined, outside: 1 },
      castle: { parent: "world", location: "tower", outside: 1 },
      tower: { parent: "castle", outside: 1 },
      town: { parent: "world", outside: 1 },
      beach: { parent: "town", outside: 1 },
      changingroom: { parent: "beach", outside: 0 }
    }
  };
  const catalog = ["castle", "tower", "town", "beach"];
  const castleInfo = D.locationInfo(vars({ location: "castle" }), setup);
  const roomInfo = D.locationInfo(vars({ location: "changingroom" }), setup);
  assert.equal(D.pickAutoLocation(castleInfo, catalog, ["castle", "tower", "town", "beach"]), "tower");
  assert.equal(D.pickAutoLocation(roomInfo, ["town", "beach"], ["beach", "town", "changingroom"]), "beach");
  assert.equal(D.pickAutoLocation(roomInfo, ["town"], ["town", "changingroom"]), "town");
  assert.equal(D.pickAutoLocation(roomInfo, [], ["town", "changingroom"]), "none");
  /* 白名单为空 = 不自动切换；不在名单里的地点即使图库有图也不匹配。 */
  assert.equal(D.pickAutoLocation(castleInfo, catalog, [], []), "none");
  assert.equal(D.pickAutoLocation(roomInfo, catalog, ["beach"], []), "beach");
  assert.equal(D.pickAutoLocation(roomInfo, catalog, ["town"], []), "town");
  assert.equal(D.pickAutoLocation(roomInfo, ["changingroom"], ["changingroom"], []), "changingroom");
  assert.equal(D.pickAutoLocation(roomInfo, catalog, ["beach"], ["beach"]), "none");
});

test("自动地点：停用名单只作为白名单内的额外排除，不再自动写回名单", () => {
  const setup = {
    Locations: { get: () => "home" },
    locations: {
      world: { parent: undefined, outside: 1 },
      town: { parent: "world", outside: 1 },
      home: { parent: "town", outside: 0 }
    }
  };
  const catalog = ["town", "home"];
  const info = D.locationInfo(vars({ location: "home" }), setup);
  assert.equal(D.pickAutoLocation(info, catalog, ["home"], []), "home");
  assert.equal(D.pickAutoLocation(info, catalog, ["home", "town"], ["home"]), "town");
  assert.equal(D.pickAutoLocation(info, catalog, ["home", "town"], ["home", "town"]), "none");
  assert.equal(D.pickAutoLocation(info, catalog, [], []), "none");

  const v = vars({ location: "home", decoAutoBgEnabled: true, decoAutoBgLocations: ["home", "town"], decoAutoBgDisabled: ["home"] });
  assert.equal(D.applyAutoBackground(v, setup, catalog), "home", "旧档隐藏停用名单不得继续拦截已加入白名单的地点");
  assert.equal(v.background_image1, "home");
  assert.equal(v.decoAutoBgSource, "home");
  assert.deepEqual(Array.from(v.decoAutoBgLocations), ["home", "town"], "匹配结果不得反写白名单");
});

test("预设：保存/套用包含九图、Z、路径与显示状态", () => {
  const v = vars({
    background_image1: "town",
    foreground1: "none",
    show_background1: false,
    decoImageZ: { deco_bg1: 7 }
  });
  v.decoImagePath = { foreground1: "img/decorations/ml/background1/beach.png" };
  const slot = D.savePreset(v, 1, "夜景");
  assert.equal(slot, 1);
  assert.equal(v.decoPresets[1].name, "夜景");
  assert.equal(v.decoPresets[1].background1, "town");
  assert.equal(v.decoPresets[1].foreground1, "none");
  assert.equal(v.decoPresets[1].decoImageZ.deco_bg1, 7);
  assert.equal(v.decoPresets[1].decoImagePath.foreground1, "img/decorations/ml/background1/beach.png");
  assert.equal(v.decoPresets[1].showBackground1, false);

  v.background_image1 = "none";
  v.decoImageZ = {};
  v.decoImagePath = {};
  assert.equal(D.applyPreset(v, 1), true);
  assert.equal(v.background_image1, "town");
  assert.equal(v.decoImageZ.deco_bg1, 7);
  assert.equal(v.decoImagePath.foreground1, "img/decorations/ml/background1/beach.png");
  assert.equal(v.show_background1, false);
});

test("滤镜：夜间/雨天输出颜色与亮度；关闭时清空；只作用于声明层", () => {
  const setup = { Locations: { get: () => "beach" }, locations: { beach: { parent: "town", outside: 1 } } };
  const env = {
    setup,
    Weather: { skyState: "night", name: "heavyPrecipitation", bloodMoon: false },
    vars: vars({ background_image1: "beach", background_image2: "town", decoAutoBgFilterEnabled: true }),
    filterLayers: ["background1", "background2"]
  };
  const overlay = D.computeOverlay(env);
  assert.equal(overlay.decoration_background1.alpha, 0.6);
  assert.equal(overlay.decoration_background1.brightness, -0.7);
  assert.equal(overlay.decoration_background2.alpha, 0.6);
  assert.equal(overlay.decoration_foreground1, undefined);

  assert.deepEqual(D.computeOverlay(Object.assign({}, env, { filterLayers: ["foreground1"] })), {});
  const off = D.computeOverlay(Object.assign({}, env, {
    vars: vars({ decoAutoBgFilterEnabled: false, background_image1: "beach" })
  }));
  assert.deepEqual(off, {});
});

test("默认关闭：未声明自动背景时 refresh 不换图、passage 不接管", () => {
  const setup = { Locations: { get: () => "home" }, locations: { world: { parent: undefined, outside: 1 }, home: { parent: "world", outside: 0 } } };
  const v = vars({ location: "home", background_image1: "forest", show_background1: false, decoAutoBgLocations: ["home"] });
  D.refresh({ vars: v, setup });
  assert.equal(v.background_image1, "forest", "refresh 不得隐式应用自动背景");
  assert.equal(v.show_background1, false);
  assert.equal(D.applyAutoOnPassage({ vars: v, setup }), "none");
  assert.equal(v.background_image1, "forest");
});

test("自动背景：开启后 passage 自动收录当前有图地点，移除后不再回流", () => {
  const setup = {
    Locations: { get: () => "bathroom" },
    locations: { world: { parent: undefined, outside: 1 }, home: { parent: "world", outside: 0 }, bathroom: { parent: "home", outside: 0 } }
  };
  const catalog = ["home", "town"];
  const v = vars({ location: "home", background_image1: "forest", decoAutoBgEnabled: true });
  assert.equal(D.ensureAutoLocation(v, setup, catalog), "home", "当前浴室无图时应落到有图的 home");
  assert.deepEqual(Array.from(v.decoAutoBgLocations), ["home"], "开启后 passage 自动写入白名单");
  assert.equal(D.applyAutoOnPassage({ vars: v, setup, catalog }), "home");
  assert.equal(v.background_image1, "home");

  const removed = vars({ location: "home", decoAutoBgEnabled: true, decoAutoBgLocations: ["home", "town"], decoAutoBgExcluded: ["home"] });
  assert.equal(D.ensureAutoLocation(removed, setup, catalog), "none", "显式移除的地点不得被自动收录");
  assert.deepEqual(Array.from(removed.decoAutoBgLocations), ["home", "town"], "自动收录不得清空玩家名单");
  assert.equal(D.applyAutoBackground(removed, setup, catalog), "none", "当前地点被排除时不得拿父级 town 顶替");
});

test("自动背景：备份玩家原图/显示，重复匹配不覆盖备份，关闭后完整恢复", () => {
  const setup = { Locations: { get: () => "home" }, locations: { world: { parent: undefined, outside: 1 }, home: { parent: "world", outside: 0 } } };
  const v = vars({
    location: "home", background_image1: "forest", show_background1: false,
    decoAutoBgEnabled: true, decoAutoBgLocations: ["home"]
  });
  assert.equal(D.applyAutoBackground(v, setup, ["home"]), "home");
  assert.equal(v.background_image1, "home");
  assert.equal(v.show_background1, true);
  assert.equal(v.decoAutoBgActive, true);
  assert.equal(v.decoAutoBgBackup, "forest");
  assert.equal(v.decoAutoBgBackupShow, false);

  D.applyAutoBackground(v, setup, ["home"]);
  assert.equal(v.decoAutoBgBackup, "forest", "第二次匹配不得把自动图当成玩家原图备份");

  assert.equal(D.restoreAutoBackground(v), true);
  assert.equal(v.background_image1, "forest");
  assert.equal(v.show_background1, false);
  assert.equal(v.decoAutoBgActive, false);
  assert.equal(v.decoAutoBgSource, undefined);
  assert.equal(v.decoAutoBgBackup, undefined);
});

test("自动关闭后 passage 立即恢复玩家原图，不把自动图留在背景上", () => {
  const setup = { Locations: { get: () => "home" }, locations: { world: { parent: undefined, outside: 1 }, home: { parent: "world", outside: 0 } } };
  const v = vars({ location: "home", background_image1: "forest", show_background1: false, decoAutoBgEnabled: true, decoAutoBgLocations: ["home"] });
  assert.equal(D.applyAutoOnPassage({ vars: v, setup }), "home");
  assert.equal(v.background_image1, "home");
  v.decoAutoBgEnabled = false;
  assert.equal(D.applyAutoOnPassage({ vars: v, setup }), "none");
  assert.equal(v.background_image1, "forest");
  assert.equal(v.show_background1, false);
  assert.equal(v.decoAutoBgActive, false);
});

test("预设：套用前先恢复玩家原背景并关闭自动，避免立即被地点覆盖", () => {
  const setup = { Locations: { get: () => "home" }, locations: { world: { parent: undefined, outside: 1 }, home: { parent: "world", outside: 0 } } };
  const v = vars({ location: "home", background_image1: "forest", show_background1: false, decoAutoBgEnabled: true, decoAutoBgLocations: ["home"] });
  assert.equal(D.savePreset(v, 1, "森林"), 1);
  assert.equal(D.applyAutoBackground(v, setup, ["home"]), "home");
  assert.equal(v.background_image1, "home");
  assert.equal(D.applyPreset(v, 1), true);
  assert.equal(v.background_image1, "forest");
  assert.equal(v.show_background1, false);
  assert.equal(v.decoAutoBgEnabled, false);
  assert.equal(v.decoAutoBgActive, false);
});

test("叠色应用到图层：写 brightness / decoColorOverlay，并清缓存", () => {
  const layers = {
    decoration_background1: { name: "decoration_background1", cachedProcessing: "old" },
    decoration_background2: { name: "decoration_background2", cachedProcessing: "old" }
  };
  const overlay = {
    decoration_background1: { color: "hsl(210,70%,15%)", alpha: .6, brightness: -.2 },
    decoration_background2: { color: "hsl(210,70%,15%)", alpha: .6, brightness: -.2 }
  };
  const changed = D.applyOverlay(layers, overlay);
  assert.equal(changed, 2);
  assert.equal(layers.decoration_background1.brightness, -.2);
  assert.equal(layers.decoration_background1.cachedProcessing, null);
  assert.equal(layers.decoration_background1.decoColorOverlay.color, "hsl(210,70%,15%)");
});

test("注册图层：无 Renderer 不抛；只看实际渲染模型让位；char.layers 声明不误判；原生模式补 9 层", () => {
  assert.deepEqual(D.registerLayers(null), { mode: "unavailable", added: 0 });

  const external = {
    CanvasModels: { main: { width: 256, height: 256, frames: 2, layers: { decoration_background1: { name: "decoration_background1" } } } }
  };
  assert.deepEqual(D.registerLayers(external), { mode: "external", added: 0 });

  const cacheExternal = {
    CanvasModels: { main: { width: 256, height: 256, frames: 2, layers: {} } },
    CanvasModelCaches: { main: { slot: { layers: { decoration_background1: { name: "decoration_background1" } } } } }
  };
  assert.deepEqual(D.registerLayers(cacheExternal), { mode: "external", added: 0 });

  const template = { width: 256, height: 256, frames: 2, layers: {} };
  const cached = { main: { slot: { layers: {}, layerList: [] } } };
  const native = {
    CanvasModels: { main: template },
    CanvasModelCaches: cached,
    RenderingPipeline: [],
    createCanvas() { return { canvas: {} }; }
  };
  const result = D.registerLayers(native);
  assert.equal(result.mode, "native");
  assert.equal(result.added, 9);
  assert.equal(Object.keys(template.layers).length, 9);
  assert.equal(Object.keys(cached.main.slot.layers).length, 9);
  assert.equal(template.layers.decoration_background1.zfn(), -30);
  assert.equal(template.layers.decoration_background1.showfn(), true);
  assert.equal(template.layers.decoration_background1.srcfn(), undefined);

  /* 同 id 旧版本先注册时，旧 def 会留在配置里；更新后必须被新 def 覆盖。
     旧 def 的 srcfn 固定返回旧字符串，新 def 在无 State 时返回 undefined。 */
  template.layers.decoration_background1 = {
    name: "decoration_background1", __mlDeco: true,
    srcfn() { return "img/decorations/background1/old.png"; }, showfn() { return true; }, zfn() { return -30; }
  };
  D.registerLayers(native);
  assert.equal(template.layers.decoration_background1.srcfn(), undefined);

  /* 原模组经 maplebirch.char.use() 注册时，5.6.2 只把它收进 char.layers，
     main/pet 仍可能为空；仅凭声明让位会让两套都不画。只有侦到实际模型
     上的原模组层才必须撤回灯台的 9 层。 */
  const originalLayers = {};
  for (const layer of D.LAYERS) originalLayers["decoration_" + layer.id] = { name: "decoration_" + layer.id };
  const previous = globalThis.maplebirch;
  try {
    globalThis.maplebirch = { char: { layers: [{ target: "main", layers: originalLayers }] } };
    const declaredOnly = D.registerLayers(native);
    assert.equal(declaredOnly.mode, "native");
    assert.equal(Object.keys(template.layers).length, 9);
    assert.equal(Object.keys(cached.main.slot.layers).length, 9);

    native.CanvasModels.pet = { layers: originalLayers };
    const yielded = D.registerLayers(native);
    assert.equal(yielded.mode, "external");
    assert.equal(Object.keys(template.layers).length, 0);
    assert.equal(Object.keys(cached.main.slot.layers).length, 0);
    assert.equal(Object.keys(native.CanvasModels.pet.layers).length, 9);
    assert.equal(D.mode(), "external");
  } finally {
    if (previous === undefined) delete globalThis.maplebirch;
    else globalThis.maplebirch = previous;
  }
});

test("刷新重绘：优先 redraw 当前 main 模型（重新 compile，含新接入九层），无模型再回落 composeLayersAgain", () => {
  let redraws = 0;
  let composes = 0;
  const template = { width: 256, height: 256, frames: 2, layers: {} };
  const model = { name: "main", canvas: {}, layers: { body: { show: true } }, layerList: [], redraw() { redraws++; } };
  const cached = { main: { slot: model } };
  const renderer = {
    CanvasModels: { main: template },
    CanvasModelCaches: cached,
    RenderingPipeline: [],
    lastModel: model,
    composeLayersAgain() { composes++; },
    createCanvas() { return { canvas: {} }; }
  };
  assert.equal(D.registerLayers(renderer).mode, "native");
  for (const name of Object.keys(model.layers)) {
    if (name.startsWith("decoration_")) model.layers[name].show = true;
  }
  const v = vars({ decoAutoBgEnabled: false });
  const previous = globalThis.Renderer;
  globalThis.Renderer = renderer;
  try {
    D.refresh({ vars: v, setup: {} });
    assert.equal(redraws, 1, "必须重新 compile，而不是只重排旧 specs");
    assert.equal(composes, 0, "有 main 模型时不应只走 composeLayersAgain");
    assert.equal(model.layers.decoration_background1.show, false, "重绘前必须复位 show，showfn 才会重新求值");
    assert.equal(model.layers.body.show, true, "不得动游戏原生图层");

    renderer.lastModel = null;
    model.canvas = null;
    D.refresh({ vars: v, setup: {} });
    assert.equal(composes, 1, "没有可用 main 模型时回落到旧规格重排");
  } finally {
    if (previous === undefined) delete globalThis.Renderer;
    else globalThis.Renderer = previous;
  }
});

test("叠加步：只处理带 decoColorOverlay 的图层，重复注册不重复入管线，并移除原模组 decoOverlay", () => {
  const pipeline = [{ name: "decoOverlay" }, { name: "brightness" }];
  const stamps = [];
  const Renderer = {
    RenderingPipeline: pipeline,
    createCanvas() {
      const canvas = { width: 10, height: 10 };
      return {
        canvas,
        fillRect() {},
        drawImage() {},
        set globalAlpha(v) { stamps.push(["alpha", v]); },
        set globalCompositeOperation(v) { stamps.push(["op", v]); }
      };
    }
  };
  const first = D.ensureOverlayStep(Renderer);
  const second = D.ensureOverlayStep(Renderer);
  assert.equal(first.name, "mlDecoOverlay");
  assert.equal(second, first);
  assert.equal(pipeline.some(s => s.name === "decoOverlay"), false);
  assert.equal(pipeline.filter(s => s.name === "mlDecoOverlay").length, 1);
  const step = first;
  assert.equal(step.condition({ decoColorOverlay: { color: "#000", alpha: .5 } }), true);
  assert.equal(step.condition({}), false);
});
