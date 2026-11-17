"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const Core = require(path.join(__dirname, "..", "src", "dossier-core.js"));

const CUSTOM_DEFAULT = {
  bgOn: false,
  bgOpacity: 100,
  bgFit: "cover",
  bgZoom: 100,
  bgX: 50,
  bgY: 50,
  bgSoft: 0,
  btnOn: false,
  btnOpacity: 70,
  btnFit: "cover",
  btnZoom: 100,
  btnX: 50,
  btnY: 50,
  cardOn: false,
  cardOpacity: 70,
  cardFit: "cover",
  cardZoom: 100,
  cardX: 50,
  cardY: 50,
  fontScale: 100,
  surfaceAlpha: 90,
  syncMl: true,
  colors: { accent: "", surface: "", text: "", line: "" }
};

test("默认设置只有 custom（档案字段已移除）", () => {
  const d = Core.sanitize(null);
  assert.deepStrictEqual(d, { custom: CUSTOM_DEFAULT });
  assert.strictEqual("enabled" in d, false);
  assert.strictEqual("skin" in d, false);
});

test("默认对象不被调用方改坏（custom 是深拷贝）", () => {
  const a = Core.sanitize(null);
  a.custom.bgOpacity = 5;
  a.custom.colors.accent = "#000000";
  const b = Core.sanitize(null);
  assert.strictEqual(b.custom.bgOpacity, 100);
  assert.strictEqual(b.custom.colors.accent, "");
});


test("未知键丢弃，custom 非法值回落默认", () => {
  const d = Core.sanitize({ junk: 1, custom: { bgOpacity: "nope" } });
  assert.strictEqual("junk" in d, false);
  assert.strictEqual(d.custom.bgOpacity, 100);
});


test("merge 不修改入参，且结果是合法形状", () => {
  const base = Core.sanitize({ custom: { bgOpacity: 20 } });
  const snapshot = JSON.stringify(base);
  const next = Core.merge(base, { bgOpacity: 60 });
  assert.strictEqual(JSON.stringify(base), snapshot);
  assert.strictEqual(next.custom.bgOpacity, 60);
  const bad = Core.merge(base, { bgOpacity: 900 });
  assert.strictEqual(bad.custom.bgOpacity, 100, "超界补丁夹到上限");
});

test("clone 是浅拷贝且不共享对象", () => {
  const base = Core.sanitize({ custom: { bgOpacity: 20 } });
  const copy = Core.clone(base);
  copy.custom = { ...copy.custom, bgOpacity: 60 };
  assert.strictEqual(base.custom.bgOpacity, 20);
});


test("isSafeId 只放行纯数字", () => {
  assert.strictEqual(Core.isSafeId("12"), true);
  assert.strictEqual(Core.isSafeId(12), true);
  assert.strictEqual(Core.isSafeId("1a"), false);
  assert.strictEqual(Core.isSafeId("../1"), false);
  assert.strictEqual(Core.isSafeId(""), false);
  assert.strictEqual(Core.isSafeId(null), false);
});

test("读写设置：坏 JSON 回落默认；写入失败返回 false", () => {
  const store = new Map();
  const storage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v))
  };
  assert.strictEqual(Core.readSettings(storage).custom.bgOpacity, 100);
  assert.strictEqual(Core.writeSettings(storage, { custom: { bgOpacity: 30 } }), true);
  assert.strictEqual(Core.readSettings(storage).custom.bgOpacity, 30);

  store.set(Core.SETTINGS_KEY, "{broken");
  assert.strictEqual(Core.readSettings(storage).custom.bgOpacity, 100);

  const dead = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  assert.strictEqual(Core.writeSettings(dead, { custom: { bgOpacity: 30 } }), false);
  assert.strictEqual(Core.readSettings(dead).custom.bgOpacity, 100);
});

test("设置键名与本包版本固定", () => {
  assert.strictEqual(Core.SETTINGS_KEY, "MapleLanternDossier.settings.v1");
  assert.strictEqual(Core.VERSION, "1.4.6");
});

/* ---------------------------------------------------------------------------
 * v1.4.0 自定义外观
 * ------------------------------------------------------------------------ */

test("sanitizeCustom：逐项夹取并落到步进", () => {
  const c = Core.sanitizeCustom({
    bgOpacity: 200, bgZoom: 10, bgX: 150, bgY: -5, bgSoft: 99,
    btnOpacity: -3, btnZoom: 1000, btnX: 33.4, btnY: 66.6,
    fontScale: 70, surfaceAlpha: 0,
    bgFit: "nope", btnFit: "fill"
  });
  assert.strictEqual(c.bgOpacity, 100);
  assert.strictEqual(c.bgZoom, 50);
  assert.strictEqual(c.bgX, 100);
  assert.strictEqual(c.bgY, 0);
  assert.strictEqual(c.bgSoft, 8);
  assert.strictEqual(c.btnOpacity, 0);
  assert.strictEqual(c.btnZoom, 200);
  assert.strictEqual(c.btnFit, "fill");
  assert.strictEqual(c.fontScale, 80);
  assert.strictEqual(c.surfaceAlpha, 0);
  assert.strictEqual(c.bgFit, "cover");
});

test("sanitizeCustom：颜色非法一律回空（= 跟随主题），短 hex 展开", () => {
  assert.deepStrictEqual(Core.sanitizeCustom({ colors: { accent: "#ABC", surface: "red" } }).colors,
    { accent: "#aabbcc", surface: "", text: "", line: "" });
  assert.strictEqual(Core.sanitizeCustom({ colors: { text: "#01f" } }).colors.text, "#0011ff");
  assert.strictEqual(Core.normalizeHex("  #AABBCC "), "#aabbcc");
  assert.strictEqual(Core.normalizeHex("#abcd"), "");
  assert.strictEqual(Core.isHexColor("#12g"), false);
});

test("hexToRgb 与 WCAG 对比度", () => {
  assert.deepStrictEqual(Core.hexToRgb("#0f0"), { r: 0, g: 255, b: 0 });
  assert.strictEqual(Core.hexToRgb("nope"), null);
  assert.strictEqual(Core.contrastRatio("#ffffff", "#000000"), 21);
  assert.strictEqual(Core.contrastRatio("#777777", "#777777"), 1);
  assert.strictEqual(Core.contrastRatio("#fff", "red"), null);
  const r = Core.contrastRatio("#e9e3d6", "#12161b");
  assert.ok(r > 10 && r < 15, "深底浅字应给出高对比度，实际 " + r);
});

test("merge：扁平与嵌套两种补丁写法等价", () => {
  const base = Core.sanitize(null);
  const flat = Core.merge(base, { bgOpacity: 30, fontScale: 120 });
  const nested = Core.merge(base, { custom: { bgOpacity: 30, fontScale: 120 } });
  assert.strictEqual(flat.custom.bgOpacity, 30);
  assert.strictEqual(nested.custom.bgOpacity, 30);
  assert.strictEqual(flat.custom.fontScale, 120);
  assert.strictEqual(nested.custom.fontScale, 120);
});

test("merge：非法补丁值保留 base，而非法颜色不回滚合法色", () => {
  const base = Core.merge(Core.sanitize(null), { bgOpacity: 35, colors: { accent: "#112233" } });
  assert.strictEqual(Core.merge(base, { bgOpacity: "x" }).custom.bgOpacity, 35);
  assert.strictEqual(Core.merge(base, { bgFit: "wat" }).custom.bgFit, "cover");
  const kept = Core.merge(base, { colors: { accent: "not-a-color" } });
  assert.strictEqual(kept.custom.colors.accent, "#112233");
  const cleared = Core.merge(base, { colors: { accent: "" } });
  assert.strictEqual(cleared.custom.colors.accent, "");
});

test("planVars：无色时只给数值变量，且要撤掉颜色变量", () => {
  const p = Core.planVars(Core.CUSTOM_DEFAULTS);
  assert.strictEqual(p.md["--mlc-bg-op"], "1");
  assert.strictEqual(p.md["--mlc-bg-soft"], "0px");
  // 不透明度 100 时不铺同色遮罩（否则暗色图还是被洗掉）
  assert.strictEqual(p.md["--mlc-bg-veil"], "transparent");
  assert.strictEqual(p.md["--mlc-btn-op"], "0.7");
  assert.strictEqual(p.md["--mlc-font-scale"], "1");
  assert.strictEqual(p.md["--mlc-surface-alpha"], "0.9");
  assert.strictEqual(p.md["--mlc-btn-veil"], "color-mix(in srgb, var(--mlc-surface) 30%, transparent)");
  assert.strictEqual(p.md["--mlc-surface-a"].indexOf("90%") > 0, true);
  assert.deepStrictEqual(Object.keys(p.ml), []);
  ["--mlc-accent", "--mlc-surface", "--mlc-text", "--mlc-line"].forEach((k) => {
    assert.ok(p.remove.indexOf(k) >= 0, k + " 应撤掉");
    assert.strictEqual(k in p.md, false);
  });
  ["--mln-accent", "--mln-surface", "--mln-text", "--mln-border"].forEach((k) => {
    assert.ok(p.remove.indexOf(k) >= 0, k + " 应撤掉");
  });
});

test("planVars：按钮不透明度 100 时不需遮罩", () => {
  const p = Core.planVars({ btnOpacity: 100 });
  assert.strictEqual(p.md["--mlc-btn-veil"], "transparent");
});

test("planVars：有色 + 同步灯台 → 9 项 --mln-* 全给（含派生）", () => {
  const p = Core.planVars({
    colors: { accent: "#AA3300", surface: "#101010", text: "#FAFAFA", line: "#333333" },
    syncMl: true
  });
  assert.strictEqual(p.md["--mlc-accent"], "#aa3300");
  assert.strictEqual(p.ml["--mln-accent"], "#aa3300");
  assert.strictEqual(p.ml["--mln-surface"], "#101010");
  assert.strictEqual(p.ml["--mln-text"], "#fafafa");
  assert.strictEqual(p.ml["--mln-border"], "#333333");
  assert.ok(p.ml["--mln-surface-2"].indexOf("color-mix") === 0);
  assert.ok(p.ml["--mln-muted"].indexOf("color-mix") === 0);
  assert.ok(p.ml["--mln-border-strong"].indexOf("color-mix") === 0);
  assert.strictEqual(Object.keys(p.ml).length, 9);
  assert.strictEqual(p.remove.indexOf("--mln-accent"), -1);
});

test("planVars：关掉同步时绝不留 --mln-*", () => {
  const p = Core.planVars({
    colors: { accent: "#AA3300", surface: "#101010", text: "#FAFAFA", line: "#333333" },
    syncMl: false
  });
  assert.deepStrictEqual(Object.keys(p.ml), []);
  ["--mln-accent", "--mln-surface", "--mln-text", "--mln-border"].forEach((k) => {
    assert.ok(p.remove.indexOf(k) >= 0);
  });
});

test("computeBackgroundSize：cover / contain / fill 与 zoom", () => {
  const cover = Core.computeBackgroundSize(4000, 2000, 390, 844, "cover", 100);
  assert.strictEqual(cover.h, 844);
  assert.strictEqual(cover.w, Math.round(4000 * (844 / 2000)));

  const contain = Core.computeBackgroundSize(4000, 2000, 390, 844, "contain", 100);
  assert.strictEqual(contain.w, 390);
  assert.strictEqual(contain.h, Math.round(2000 * (390 / 4000)));

  const fill = Core.computeBackgroundSize(4000, 2000, 390, 844, "fill", 100);
  assert.deepStrictEqual(fill, { w: 390, h: 844 });

  const zoom2 = Core.computeBackgroundSize(4000, 2000, 390, 844, "cover", 200);
  assert.strictEqual(zoom2.w, cover.w * 2);
  assert.strictEqual(zoom2.h, 844 * 2);

  assert.deepStrictEqual(Core.computeBackgroundSize(0, 0, 390, 844, "cover", 100), { w: 0, h: 0 });
});

test("dragToPosition：往右拖让百分比变小，且不越界", () => {
  const base = { boxW: 390, boxH: 844, bgW: 780, bgH: 1688, x: 50, y: 50 };
  const right = Core.dragToPosition(Object.assign({ dx: 39, dy: 0 }, base));
  assert.strictEqual(right.x, 40, "移动 39px / 可行程 390px = 10%");
  assert.strictEqual(right.y, 50);
  const down = Core.dragToPosition(Object.assign({ dx: 0, dy: 84.4 }, base));
  assert.strictEqual(down.y, 40);
  const huge = Core.dragToPosition(Object.assign({ dx: 100000, dy: -100000 }, base));
  assert.deepStrictEqual(huge, { x: 0, y: 100 });
  const noTravel = Core.dragToPosition({ boxW: 390, boxH: 844, bgW: 390, bgH: 844, x: 30, y: 70, dx: 50, dy: 50 });
  assert.deepStrictEqual(noTravel, { x: 30, y: 70 }, "图比盒子小就没有可行程");
});

test("fitWithin：长边与总像素双约束取更小者", () => {
  assert.deepStrictEqual(Core.fitWithin(4000, 3000, 1600, 2200 * 1600), { w: 1600, h: 1200 });
  assert.deepStrictEqual(Core.fitWithin(800, 600, 1600, 2200 * 1600), { w: 800, h: 600 });
  const big = Core.fitWithin(6000, 6000, 1600, 2200 * 1600);
  assert.strictEqual(Math.max(big.w, big.h), 1600);
  assert.ok(big.w * big.h <= 2200 * 1600);
  assert.deepStrictEqual(Core.fitWithin(0, 0, 1600, 1600), { w: 0, h: 0 });
});

test("resetCustom：分项复位只动该组，恢复出厂清空整个 custom", () => {
  const base = Core.merge(Core.sanitize(null), {
    bgOn: true, bgOpacity: 20, bgZoom: 160, btnOn: true, btnOpacity: 90,
    fontScale: 130, surfaceAlpha: 30, syncMl: false,
    colors: { accent: "#112233", text: "#445566" }
  });

  const bg = Core.resetCustom(base, "bg");
  assert.strictEqual(bg.custom.bgOn, false);
  assert.strictEqual(bg.custom.bgOpacity, 100);
  assert.strictEqual(bg.custom.bgZoom, 100);
  assert.strictEqual(bg.custom.btnOn, true, "按钮不归 bg 组");
  assert.strictEqual(bg.custom.colors.accent, "#112233");

  const btn = Core.resetCustom(base, "btn");
  assert.strictEqual(btn.custom.btnOn, false);
  assert.strictEqual(btn.custom.btnOpacity, 70);
  assert.strictEqual(btn.custom.bgOn, true);

  const colors = Core.resetCustom(base, "colors");
  assert.strictEqual(colors.custom.colors.accent, "");
  assert.strictEqual(colors.custom.bgOn, true);

  const type = Core.resetCustom(base, "type");
  assert.strictEqual(type.custom.fontScale, 100);
  assert.strictEqual(type.custom.surfaceAlpha, CUSTOM_DEFAULT.surfaceAlpha, "字号与底纹遮盖两样都得回默认");

  const all = Core.resetCustom(base, "all");
  assert.deepStrictEqual(all.custom, CUSTOM_DEFAULT);
  assert.deepStrictEqual(Object.keys(all), ["custom"], "出厂复位只回自定义，不留档案字段");

  assert.deepStrictEqual(Core.resetCustom(base, "nope").custom, base.custom);
});

test("alignForBackground：遮蔽 ≥80 时开背景顺带调透，已经很透就不动", () => {
  // 默认 90：面板 92% 不透明，图铺在下面却看不见 —— 必须顺带调透
  assert.deepStrictEqual(Core.alignForBackground({}), { surfaceAlpha: 45 });
  assert.deepStrictEqual(Core.alignForBackground({ surfaceAlpha: 90 }), { surfaceAlpha: 45 });
  // 边界：80 触发；75 不触发（滑杆步长 5，79 会被吸附成 80，不能用 79 当反例）
  assert.deepStrictEqual(Core.alignForBackground({ surfaceAlpha: 80 }), { surfaceAlpha: 45 });
  assert.deepStrictEqual(Core.alignForBackground({ surfaceAlpha: 75 }), {});
  // 玩家自己调得很透了，不要再改他的设置
  assert.deepStrictEqual(Core.alignForBackground({ surfaceAlpha: 30 }), {});
  assert.deepStrictEqual(Core.alignForBackground({ surfaceAlpha: 0 }), {});
});

test("alignForBackground：背景不透明度 <80 时补到 100，否则不动", () => {
  // 默认 100，不动
  assert.deepStrictEqual(Core.alignForBackground({ bgOpacity: 100, surfaceAlpha: 30 }), {});
  // 旧档 45（玩家截图里的状态）：暗色图被同色遮罩洗掉，比对齐遮蔽更致命，必须一起补
  assert.deepStrictEqual(Core.alignForBackground({ bgOpacity: 45, surfaceAlpha: 30 }), { bgOpacity: 100 });
  // 两组一起触发：两个键都要给
  assert.deepStrictEqual(Core.alignForBackground({ surfaceAlpha: 90, bgOpacity: 45 }), { surfaceAlpha: 45, bgOpacity: 100 });
  // 边界 80 不触发（>80 才安全）
  assert.deepStrictEqual(Core.alignForBackground({ bgOpacity: 80, surfaceAlpha: 30 }), {});
  assert.deepStrictEqual(Core.alignForBackground({ bgOpacity: 85, surfaceAlpha: 30 }), {});
});

test("appliedSummary：「应用背景」回执要如实说出背景/按钮到底有没有铺上", () => {
  const on = Core.appliedSummary({ bgOn: true, bgOpacity: 90, btnOn: true, btnOpacity: 70 }, true, true);
  assert.strictEqual(on.bg, true);
  assert.strictEqual(on.btn, true);
  assert.ok(on.note.indexOf("背景 90%") >= 0, on.note);
  assert.ok(on.note.indexOf("按钮底纹 70%") >= 0, on.note);

  // 有图但开关关着 → 不能报"已应用"，要如实说已关闭
  const off = Core.appliedSummary({ bgOn: false, btnOn: false }, true, true);
  assert.strictEqual(off.bg, false);
  assert.ok(off.note.indexOf("已关闭") >= 0, off.note);

  // 开关开着但图库里没有图 → 说明还没有图，而不是假装生效
  const empty = Core.appliedSummary({ bgOn: true, btnOn: true }, false, false);
  assert.strictEqual(empty.bg, false);
  assert.strictEqual(empty.btn, false);
  assert.ok(empty.note.indexOf("还没有图") >= 0, empty.note);
});

test("clampStep 的浮点安全", () => {
  assert.strictEqual(Core.clampStep(33.4, 0, 100, 1, 50), 33);
  assert.strictEqual(Core.clampStep(33.6, 0, 100, 1, 50), 34);
  assert.strictEqual(Core.clampStep(97, 0, 100, 5, 50), 95);
  assert.strictEqual(Core.clampStep("x", 80, 140, 5, 100), 100);
});

test("formatBytes 人话单位", () => {
  assert.strictEqual(Core.formatBytes(0), "0 KB");
  assert.strictEqual(Core.formatBytes(500), "500 B");
  assert.strictEqual(Core.formatBytes(2048), "2 KB");
  assert.strictEqual(Core.formatBytes(3 * 1024 * 1024), "3.0 MB");
});
