/* 灯台 MapleLantern — 主题矩阵：元数据、色板、CSS 落点、DOM 卡片由同一份 THEME_META 驱动 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const C = require("../src/core.js");
const { createEnv } = require("./env.js");

const SRC = path.join(__dirname, "..", "src");
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "");
const CSS = strip(fs.readFileSync(path.join(SRC, "style.css"), "utf8"));
const NATIVE_CSS = strip(fs.readFileSync(path.join(SRC, "maplelantern-native.css"), "utf8"));
const ORNAMENTS_CSS = strip(fs.readFileSync(path.join(SRC, "ornaments.css"), "utf8"));

test("主题元数据：id 唯一、顺序稳定、THEMES 由同一份数据生成", () => {
  assert.ok(Array.isArray(C.THEME_META) && C.THEME_META.length > 0, "缺 THEME_META");
  const ids = C.THEME_META.map((m) => m.id);
  assert.deepEqual(new Set(ids).size, ids.length, "主题 id 不得重复");
  assert.deepEqual(C.THEMES, ids, "THEMES 必须与 THEME_META 同序");
  assert.ok(ids.includes(C.DEFAULTS.theme), "默认主题必须存在");
  for (const meta of C.THEME_META) {
    assert.equal(C.themeMeta(meta.id), meta, meta.id + " 反查失败");
  }
  assert.equal(C.themeMeta("not-a-theme"), null, "未知主题必须返回 null，不能静默回落到某套主题");
});

test("主题文案：每套主题的 labelKey 在 zh/en 都存在且非空", () => {
  for (const meta of C.THEME_META) {
    assert.ok(meta.labelKey, meta.id + " 缺 labelKey");
    for (const lang of ["zh", "en"]) {
      const label = C.strings(lang)[meta.labelKey];
      assert.equal(typeof label, "string", meta.id + " 缺 " + lang + " 文案");
      assert.ok(label.trim().length > 0, meta.id + " 的 " + lang + " 文案为空");
    }
  }
});

test("主题色板：每套元数据都指向存在的 palette，正文对比度过 4.5:1", () => {
  for (const meta of C.THEME_META) {
    const palette = C.PALETTES[meta.palette];
    assert.ok(palette, meta.id + " 指向不存在的 palette: " + meta.palette);
    assert.deepEqual(C.paletteFor(meta.id), palette, meta.id + " 取色板不一致");
    const ratio = C.contrast(palette.text, palette.bg);
    assert.ok(ratio !== null && ratio >= 4.5, meta.id + " 正文对比度不足: " + ratio);
  }
});

test("主题 CSS 落点：预览场景必须存在；面板块 / 原生块 / 边饰按元数据判定", () => {
  for (const meta of C.THEME_META) {
    assert.match(CSS, new RegExp('data-theme-preview="' + meta.preview + '"'),
      meta.id + " 缺预览场景");
    if (meta.panelBlock) {
      assert.match(CSS, new RegExp('#ml-root\\[data-theme="' + meta.id + '"\\]'),
        meta.id + " 缺面板主题块");
    }
    const nativeTheme = meta.nativeTheme === "self" ? meta.id : meta.nativeTheme;
    if (nativeTheme === "root") {
      assert.match(NATIVE_CSS, /html\[data-ml-native="on"\]\s*\{/,
        meta.id + " 应使用原生根变量，但根块缺失");
    } else {
      assert.match(NATIVE_CSS, new RegExp('data-ml-theme="' + nativeTheme + '"'),
        meta.id + " 缺原生主题块: " + nativeTheme);
    }
    if (meta.ornament) {
      assert.match(ORNAMENTS_CSS, new RegExp('data-ml-theme="' + meta.id + '"'),
        meta.id + " 缺主题边饰");
    } else {
      assert.doesNotMatch(ORNAMENTS_CSS, new RegExp('data-ml-theme="' + meta.id + '"'),
        meta.id + " 不应有边饰块");
    }
  }
});

test("主题 DOM 矩阵：设置页卡片数量、id、标签、选中态都由 THEME_META 对齐", () => {
  const { w } = createEnv();
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="settings"]').click();
  const tiles = Array.from(w.document.querySelectorAll(".ml-theme-tile"));
  assert.equal(tiles.length, C.THEME_META.length, "主题卡数量必须等于 THEME_META");
  for (const meta of C.THEME_META) {
    const tile = tiles.find((node) => node.getAttribute("data-theme-preview") === meta.preview);
    assert.ok(tile, meta.id + " 缺预览卡");
    const label = tile.querySelector(".ml-theme-name");
    assert.ok(label && label.textContent.trim().length > 0, meta.id + " 缺可见主题名");
    assert.ok(tile.querySelector(".ml-theme-scene"), meta.id + " 缺场景层");
  }
  assert.equal(tiles.filter((tile) => tile.getAttribute("aria-checked") === "true").length, 1,
    "必须有且只有一个选中主题");
});
