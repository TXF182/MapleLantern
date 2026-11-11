/* 灯台 MapleLantern — 原生 UI 展示投影测试 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createEnv } = require("./env.js");

function tick(w, ms) {
  return new Promise((resolve) => w.setTimeout(resolve, ms || 30));
}

function openOptions(w) {
  const container = w.document.getElementById("customOverlayContainer");
  const overlay = w.document.getElementById("customOverlay");
  container.classList.remove("hidden");
  overlay.classList.remove("hidden");
  w.MapleLanternNative.refresh();
}

test("默认：原生卡片开启，悬浮球关闭，钱/时间/星期与 7 张状态卡就位", async () => {
  const { w } = createEnv();
  await tick(w);
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "on");
  assert.equal(w.document.documentElement.getAttribute("data-ml-theme"), "amber");
  assert.equal(w.document.getElementById("ml-orb").hidden, true, "默认不常驻悬浮球");

  const chips = w.document.querySelectorAll("#stats .centered-elements > div[data-ml-chip]");
  assert.equal(chips.length, 4);
  const kinds = Array.from(chips).map((n) => n.getAttribute("data-ml-chip")).sort();
  assert.deepEqual(kinds, ["day", "money", "time", "toggle"]);
  assert.equal(w.document.querySelector('#stats [data-ml-chip="money"]').textContent.trim(), "£9,998.99");

  const cards = w.document.querySelectorAll("#statmeters > div[data-ml-stat-card]");
  assert.equal(cards.length, 7);
  assert.equal(w.document.getElementById("paincaption").getAttribute("data-ml-value"), "0.00 · 0%");
  assert.equal(w.document.getElementById("paincaption").getAttribute("data-ml-current"), "0");
  assert.equal(w.document.getElementById("paincaption").getAttribute("data-ml-percent"), "0%");
  assert.equal(w.document.getElementById("traumacaption").getAttribute("data-ml-value"), "39.80 · 40%");
  assert.equal(w.document.getElementById("traumacaption").getAttribute("data-ml-stat-key"), "trauma");
});

test("幂等：重复 refresh 不会重复卡片、入口或徽标", async () => {
  const { w } = createEnv();
  await tick(w);
  w.MapleLanternNative.refresh();
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(w.document.querySelectorAll("#statmeters > div[data-ml-stat-card]").length, 7);
  assert.equal(w.document.querySelectorAll("#stats .centered-elements > div[data-ml-chip]").length, 4);
});

test("正文选项：只标记 macro-link，行内链接与 data-passage 原样保留", async () => {
  const { w } = createEnv();
  await tick(w);
  const options = w.document.querySelectorAll("#passages a.link-internal.macro-link");
  assert.equal(options.length, 1);
  assert.equal(options[0].getAttribute("data-ml-option"), "1");
  assert.equal(options[0].getAttribute("data-passage"), "Garden");
  const inline = w.document.querySelector("#passages a.link-internal:not(.macro-link)");
  assert.equal(inline.getAttribute("data-ml-option"), null);
  assert.equal(inline.getAttribute("data-passage"), "Inline");
});

test("OPTIONS 弹层：入口幂等注入，点击打开灯台面板", async () => {
  const { w } = createEnv();
  await tick(w);
  openOptions(w);
  await tick(w);
  const entries = w.document.querySelectorAll('#customOverlay [data-ml-entry="panel"]');
  assert.equal(entries.length, 1, "入口只能有一个");
  assert.match(entries[0].textContent, /灯台|Lantern/);

  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(w.document.querySelectorAll('#customOverlay [data-ml-entry="panel"]').length, 1);

  entries[0].click();
  assert.equal(w.document.getElementById("ml-panel").hidden, false);
});

test("宿主启用：原生层自动让位，不挂原生标记", async () => {
  const { w } = createEnv({ host: true });
  await tick(w);
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "off");
  assert.equal(w.document.querySelectorAll("#statmeters > div[data-ml-stat-card]").length, 0);
  assert.equal(w.document.querySelectorAll('#customOverlay [data-ml-entry="panel"]').length, 0);
});

test("原生开关关闭：不加标记、不留入口", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false, native: false } });
  await tick(w);
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "off");
  assert.equal(w.document.querySelectorAll("#statmeters > div[data-ml-stat-card]").length, 0);
  assert.equal(w.document.querySelectorAll('#customOverlay [data-ml-entry="panel"]').length, 0);
});

test("解析失败：条目保留、卡片标记仍在、不写假数值", async () => {
  const { w } = createEnv();
  await tick(w);
  const card = w.document.getElementById("allurecaption");
  card.setAttribute("title", "Allure: 读不到");
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(card.getAttribute("data-ml-stat-card"), "1");
  assert.equal(card.getAttribute("data-ml-value"), null);
});

test("FEATS 弹层：顶部说明包成说明卡，筛选控件留在卡外", async () => {
  const { w } = createEnv();
  await tick(w);
  const body = w.document.getElementById("customOverlayContent");
  const overlay = w.document.getElementById("customOverlay");
  body.innerHTML = '<br> As you play, obtain <span class="gold">feats</span>.<br><br>Filter by: <select id="featTypes"></select><div id="featsList"></div>';
  overlay.setAttribute("data-overlay", "gameFeats");
  w.MapleLanternNative.refresh();
  await tick(w);
  const intro = body.querySelector("[data-ml-feats-intro]");
  assert.ok(intro, "说明卡未生成");
  assert.match(intro.textContent, /As you play/);
  assert.equal(body.querySelector("#featTypes").closest("[data-ml-feats-intro]"), null, "筛选控件被误包进说明卡");
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(body.querySelectorAll("[data-ml-feats-intro]").length, 1, "说明卡重复生成");
});

test("只读：原生层全程不写 State.variables", async () => {
  const { w, getWrites } = createEnv();
  await tick(w);
  openOptions(w);
  await tick(w);
  w.document.querySelector('#customOverlay [data-ml-entry="panel"]').click();
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(getWrites(), 0, "出现了 State.variables 写入");
});
