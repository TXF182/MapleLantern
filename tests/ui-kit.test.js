/* 灯台 MapleLantern — UI kit 契约
 * 本轮在 1.6.0 上先抽四类原语（row / card / section / segmented），
 * 统一 normal / hover / active / selected / disabled / danger / empty / loading 状态，
 * 迁移此刻、身心、着装、设置四个高频面，并补布景与原生衣柜语义；
 * 本轮不动 7 页签与 native 2,395 行拆分。
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createEnv } = require("./env.js");

const SRC = path.join(__dirname, "..", "src");
const UI_JS = path.join(SRC, "ui-kit.js");
const UI_CSS = path.join(SRC, "ui-kit.css");

test("UI kit 文件在包内，四类原语与状态标记可用", () => {
  assert.ok(fs.existsSync(UI_JS), "缺少 src/ui-kit.js");
  assert.ok(fs.existsSync(UI_CSS), "缺少 src/ui-kit.css");
  const { w } = createEnv();
  const UI = w.MapleLanternUI;
  assert.ok(UI, "未导出 window.MapleLanternUI");
  for (const key of ["row", "card", "section", "segmented", "mark"]) {
    assert.equal(typeof UI[key], "function", "缺少原语 " + key);
  }

  const row = UI.row({ className: "ml-vrow", state: "danger" });
  assert.equal(row.getAttribute("data-ui"), "row");
  assert.equal(row.getAttribute("data-ui-state"), "danger");

  const card = UI.card({ className: "ml-stat", label: "压力", value: "20", valueClass: "ml-stat-v" });
  assert.equal(card.getAttribute("data-ui"), "card");
  assert.equal(card.querySelector(".ml-stat-v").textContent, "20");

  const body = w.document.createElement("div");
  const section = UI.section({ title: "此刻", hint: "只读", body });
  assert.equal(section.getAttribute("data-ui"), "section");
  assert.equal(section.querySelector(".ml-ui-section-title").textContent, "此刻");
  assert.equal(section.querySelector(".ml-ui-section-body").firstChild, body);

  const picked = [];
  const seg = UI.segmented({
    current: "zh",
    options: [{ value: "auto", label: "自动" }, { value: "zh", label: "中文" }, { value: "en", label: "English" }],
    onPick: (v) => picked.push(v)
  });
  assert.equal(seg.getAttribute("data-ui"), "segmented");
  assert.equal(seg.getAttribute("role"), "radiogroup");
  const selected = seg.querySelector('[data-value="zh"]');
  assert.equal(selected.getAttribute("aria-checked"), "true");
  assert.equal(selected.getAttribute("data-ui-state"), "selected");
  seg.querySelector('[data-value="en"]').click();
  assert.deepEqual(picked, ["en"]);
  assert.equal(seg.querySelector('[data-value="en"]').getAttribute("aria-checked"), "true");
});

test("segmented 的 disabled 状态不被选中同步覆盖，键盘跳过禁用项", () => {
  const { w } = createEnv();
  const UI = w.MapleLanternUI;
  const picked = [];
  const seg = UI.segmented({
    current: "a",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B", disabled: true },
      { value: "c", label: "C" }
    ],
    onPick: (v) => picked.push(v)
  });
  w.document.body.appendChild(seg);
  const a = seg.querySelector('[data-value="a"]');
  const b = seg.querySelector('[data-value="b"]');
  const c = seg.querySelector('[data-value="c"]');

  assert.equal(b.getAttribute("data-ui-state"), "disabled");
  assert.equal(b.getAttribute("aria-disabled"), "true");
  assert.equal(b.disabled, true);

  c.click();
  assert.deepEqual(picked, ["c"]);
  assert.equal(b.getAttribute("aria-checked"), "false");
  assert.equal(b.getAttribute("data-ui-state"), "disabled", "disabled 被选中同步覆盖");
  assert.equal(b.getAttribute("aria-disabled"), "true");

  b.click();
  assert.deepEqual(picked, ["c"], "disabled 项不应触发 onPick");

  c.focus();
  c.dispatchEvent(new w.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
  assert.equal(w.document.activeElement, a, "方向键应跳过 disabled 项");

  a.focus();
  a.dispatchEvent(new w.KeyboardEvent("keydown", { key: "End", bubbles: true, cancelable: true }));
  assert.equal(w.document.activeElement, c, "End 应跳过 disabled 项");
  c.focus();
  c.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Home", bubbles: true, cancelable: true }));
  assert.equal(w.document.activeElement, a, "Home 应跳过 disabled 项");
  assert.deepEqual(picked, ["c", "a", "c", "a"]);
});

test("UI kit 样式矩阵：令牌、状态、触屏纪律与断点", () => {
  const css = fs.readFileSync(UI_CSS, "utf8");
  assert.match(css, /--ml-ui-touch:\s*44px/, "缺少 44px 触控令牌");
  assert.match(css, /--ml-ui-gap-1:/, "缺少间距令牌");
  for (const state of ["selected", "disabled", "danger", "empty", "loading"]) {
    assert.match(css, new RegExp('[data-ui-state="' + state + '"]'), "缺少 " + state + " 状态");
  }
  assert.match(css, /@media \(hover:\s*hover\) and \(pointer:\s*fine\)/, "hover 只能在细指针设备播放");
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/, "缺少减少动效覆盖");
  assert.match(css, /\[data-motion="off"\]/, "缺少 motion=off 覆盖");
  assert.match(css, /@media \(max-width:\s*600px\)/, "缺少 600 断点");
  assert.match(css, /@media \(max-width:\s*899px\)/, "缺少 899 断点");
  assert.doesNotMatch(css, /:active[^{}]*\{[^}]*translateY\(/s, "按压不得下沉");
  assert.match(css, /\.ml-ui-section-hint[^}]*color:\s*var\(--ml-ui-muted\)/s, "section hint 必须用可读性达标的 muted，不得用 faint");
  assert.match(css, /\[data-ui-state="empty"\][^}]*color:\s*var\(--ml-ui-muted\)/s, "empty 状态文字必须用 muted，不得用 faint");
});

test("此刻 / 身心 / 着装 / 设置已带 UI kit 语义", () => {
  const { w } = createEnv();
  w.MapleLantern.open();

  w.document.querySelector('[data-tab="now"]').click();
  assert.ok(w.document.querySelector(".ml-stat[data-ui='card']"), "此刻状态卡未标记 card");
  assert.ok(w.document.querySelector(".ml-quick[data-ui='section']"), "此刻速览未标记 section");

  w.document.querySelector('[data-tab="vitals"]').click();
  const rows = w.document.querySelectorAll(".ml-vrow[data-ui='row']");
  assert.ok(rows.length >= 3, "身心行未标记 row");
  assert.equal(rows[0].getAttribute("data-ui-state"), "normal");

  w.document.querySelector('[data-tab="worn"]').click();
  const slots = w.document.querySelectorAll(".ml-slot[data-ui='card']");
  assert.ok(slots.length >= 4, "着装格未标记 card");
  assert.ok(Array.from(slots).some((s) => s.getAttribute("data-ui-state") === "empty"), "空槽必须有 empty 状态");

  w.document.querySelector('[data-tab="settings"]').click();
  assert.ok(w.document.querySelector(".ml-seg[data-ui='segmented']"), "分段控件未标记 segmented");
  assert.ok(w.document.querySelector(".ml-field[data-ui='section']"), "设置字段未标记 section");
  assert.ok(w.document.querySelector(".ml-theme-tile[data-ui='card']"), "主题预览卡未标记 card");
});

test("布景页与原生衣柜行带 UI kit 语义", async () => {
  const { w } = createEnv();
  await new Promise((r) => w.setTimeout(r, 20));
  w.MapleLantern.open();
  w.document.querySelector('[data-tab="deco"]').click();
  assert.ok(w.document.querySelector(".ml-deco-status[data-ui='section']"), "布景状态未标记 section");
  assert.equal(w.document.querySelector(".ml-deco-status").getAttribute("data-ui-state"), "danger",
    "无图库包时布景状态必须标 danger，不能停在 normal");
  const presetSection = w.document.querySelector(".ml-deco-section");
  assert.ok(presetSection, "缺少布景区块");
  assert.equal(presetSection.getAttribute("data-ui-state"), "normal",
    "预设/自动等仍可用区块不应被缺包告警连带标 danger");
  assert.ok(w.document.querySelector(".ml-deco-card[data-ui='card']"), "布景图层卡未标记 card");

  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<div id="wardrobewear"><div class="wardrobeItem wardrobe-action no-numberify">' +
    '<img class="icon" src="shoe.png"><a class="link-internal macro-link">鞋罩短靴</a><span class="pink">♀</span></div></div>';
  w.MapleLanternNative.refresh();
  await new Promise((r) => w.setTimeout(r, 120));
  const row = p.querySelector("#wardrobewear .wardrobeItem");
  assert.equal(row.getAttribute("data-ui"), "row", "原生衣柜行未标记 row");
  assert.equal(row.getAttribute("data-ui-state"), "filled");
});
