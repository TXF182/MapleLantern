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

test("默认：原生卡片开启，悬浮球关闭，钱/时间/星期与 7 行状态就位", async () => {
  const { w } = createEnv();
  await tick(w);
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "on");
  assert.equal(w.document.documentElement.getAttribute("data-ml-theme"), "cyberpunk");
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
  assert.equal(w.document.getElementById("paincaption").getAttribute("data-ml-readout"), "0/100");
  assert.equal(w.document.getElementById("traumacaption").getAttribute("data-ml-value"), "39.80 · 40%");
  assert.equal(w.document.getElementById("traumacaption").getAttribute("data-ml-readout"), "39.8/5000");
  assert.equal(w.document.getElementById("traumacaption").getAttribute("data-ml-total"), "5000");
  assert.equal(w.document.getElementById("traumacaption").getAttribute("data-ml-stat-key"), "trauma");
});

test("正文空行：起始空行移除，连续 <br> 折叠为一行", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.insertAdjacentHTML("afterbegin", "<br><br>");
  p.insertAdjacentHTML("beforeend", "<br><br><span>after</span>");
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(p.querySelectorAll("br").length, 1, "连续空行没有折叠");
  const first = Array.from(p.childNodes).find((n) => n.nodeType === 3 ? n.nodeValue.trim() : true);
  assert.notEqual(first.nodeName, "BR", "正文起始仍留有空白行");
});

test("状态值：中文全角冒号 title 也能读出当前值/上限", async () => {
  const { w } = createEnv();
  await tick(w);
  const pain = w.document.getElementById("paincaption");
  pain.setAttribute("title", "疼痛：24.5");
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(pain.getAttribute("data-ml-current"), "24.5");
  assert.equal(pain.getAttribute("data-ml-readout"), "24.5/100");
});

test("左轨：7 项按固定顺序挂只读百分比，时间块不挂", async () => {
  const { w } = createEnv({ vars: { pain: 25, money: 1234 } });
  await tick(w);
  const rail = w.document.getElementById("mobileStats");
  const stat = rail.querySelector(".stat:not(.time)");
  assert.equal(stat.getAttribute("data-ml-rail-key"), "pain");
  assert.equal(stat.getAttribute("data-ml-rail-pct"), "25");
  assert.equal(stat.style.getPropertyValue("--ml-rail-pct"), "25%");
  assert.equal(rail.querySelector(".stat.time").getAttribute("data-ml-rail-key"), null);
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

test("图标 + 选项：同一张卡内图标在左、文字在右，并去掉组前空行", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<br><img class="icon" src="wardrobe.png"><br><a class="link-internal macro-link" data-passage="A">(3) Wardrobe</a>' +
    '<br><img class="icon" src="mirror.png"><br><a class="link-internal macro-link" data-passage="B">(4) Mirror</a>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const groups = p.querySelectorAll(".ml-option-group");
  assert.equal(groups.length, 2, "两组图标选项都应打包");
  assert.equal(groups[0].querySelector("img.icon") !== null, true);
  assert.equal(groups[0].querySelector("a.macro-link") !== null, true);
  assert.equal(groups[0].querySelectorAll("img").length + groups[0].querySelectorAll("a").length, 2);
  assert.equal(p.querySelectorAll("br").length, 0, "组前空行应被清掉");
  assert.equal(p.querySelector('.ml-option-group a[data-passage="A"]') !== null, true);
  assert.equal(p.querySelector('.ml-option-group a[data-passage="B"]') !== null, true);
});

test("图标 + 选项：选项被本地化包裹时也能并入同一张卡", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<img class="icon" src="bath.png"><br><span class="option-wrap"><a class="link-internal macro-link" data-passage="B">(4) Bathroom</a></span>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const groups = p.querySelectorAll(".ml-option-group");
  assert.equal(groups.length, 1, "包裹层里的选项也应打包");
  assert.equal(groups[0].querySelector("a.macro-link") !== null, true);
  assert.equal(p.querySelector(".option-wrap"), null, "空包裹层应被移除");
  assert.equal(p.querySelectorAll("br").length, 0, "组前空行应被清掉");
});

test("内层页：裸竖线清理，商店分类图标归入同一张卡", async () => {
  const { w } = createEnv();
  await tick(w);
  const passages = w.document.getElementById("passages");
  passages.innerHTML =
    '<div class="wardrobe-action"><a class="link-internal macro-link">(2) Strip all</a></div>|' +
    '<div class="wardrobe-action"><a class="link-internal macro-link">(3) Wear random</a></div>' +
    '<div id="listoutfits"><label class="no-numberify"><a class="link-internal macro-link">Create new set</a></label>|' +
    '<label>Wear</label>|<label>Delete</label></div>' +
    '<div id="clothingShop-div"><img class="icon" src="x.png"><a class="link-internal macro-link">(4) View Tops</a></div>';
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(passages.textContent.indexOf("|"), -1, "裸竖线应被清掉");
  const cat = passages.querySelector("#clothingShop-div .ml-shop-cat");
  assert.ok(cat, "图标与链接应包进分类卡");
  assert.equal(cat.querySelector("img.icon") !== null, true);
  assert.equal(cat.querySelector("a.macro-link") !== null, true);
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

test("Statistics 折叠体：标签与值拆成两栏行，重复刷新不重复拆", async () => {
  const { w } = createEnv();
  await tick(w);
  const body = w.document.getElementById("customOverlayContent");
  const overlay = w.document.getElementById("customOverlay");
  body.innerHTML = '<div class="foldout"><div class="foldoutBody">Vaginal virginity: <span class="gold">Present</span><br>Total: 0<br><br>You haven\'t gone on any dates!</div></div>';
  overlay.setAttribute("data-overlay", "statistics");
  w.MapleLanternNative.refresh();
  await tick(w);
  const fold = body.querySelector(".foldoutBody");
  assert.equal(fold.getAttribute("data-ml-stat-rows"), "1");
  const rows = fold.querySelectorAll(".ml-stat-row");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector(".ml-stat-label").textContent.trim(), "Vaginal virginity");
  assert.equal(rows[0].querySelector(".ml-stat-value").textContent.trim(), "Present");
  assert.equal(rows[1].querySelector(".ml-stat-label").textContent.trim(), "Total");
  assert.equal(rows[1].querySelector(".ml-stat-value").textContent.trim(), "0");
  assert.match(fold.querySelector(".ml-stat-note").textContent, /haven't gone/);
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(fold.querySelectorAll(".ml-stat-row").length, 2);
});

test("商店工具栏：中文环境下把原版硬编码英文换成中文，已本地化原文保留", async () => {
  const { w } = createEnv();
  await tick(w);
  const passages = w.document.getElementById("passages");
  passages.innerHTML =
    '<div id="clothes-list">' +
    '<button class="filters-button">Filters</button>' +
    '<button class="clothingshop-options-button"></button>' +
    '<button class="shop-legend-button">Legend</button>' +
    '</div>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const labels = Array.from(passages.querySelectorAll(".ml-shop-tool-label")).map((n) => n.textContent);
  assert.deepEqual(labels, ["筛选", "选项", "图例"], "英文硬编码应在中文环境汉化，空按钮回退中文");
});

test("商店工具栏：已经是中文的原文保持不动，不覆盖游戏本地化", async () => {
  const { w } = createEnv();
  await tick(w);
  const passages = w.document.getElementById("passages");
  passages.innerHTML =
    '<div id="clothes-list">' +
    '<button class="filters-button">筛选</button>' +
    '<button class="clothingshop-options-button">选项</button>' +
    '<button class="shop-legend-button">图例</button>' +
    '</div>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const labels = Array.from(passages.querySelectorAll(".ml-shop-tool-label")).map((n) => n.textContent);
  assert.deepEqual(labels, ["筛选", "选项", "图例"], "已本地化原文不应被改写");
});

test("存档空槽：只读标记空槽，保留保存/读取/删除按钮", async () => {
  const { w } = createEnv();
  await tick(w);
  const body = w.document.getElementById("customOverlayContent");
  const overlay = w.document.getElementById("customOverlay");
  body.innerHTML =
    '<div id="saves-list-container">' +
    '<div class="savesListRow"><div class="saveGroup"><div class="saveId">#</div><div class="saveName">ID/名称</div><div class="saveDetails">描述</div></div></div>' +
    '<div class="savesListRow" id="empty-row"><div class="saveGroup"><div class="saveId">1</div><div class="saveName"></div>' +
    '<div class="saveDetails"><span>&nbsp;</span><span class="datestamp">&nbsp;</span></div>' +
    '<div class="saveButton"><button disabled>保存</button><button disabled>读取</button></div></div>' +
    '<button class="deleteButton right" disabled>删除</button></div>' +
    '<div class="savesListRow" id="filled-row"><div class="saveGroup"><div class="saveId">2</div><div class="saveName"></div>' +
    '<div class="saveDetails"><span>学校门口</span><span class="datestamp">2026-11-11</span></div>' +
    '<div class="saveButton"><input type="button" value="保存"><input type="button" value="读取"></div></div>' +
    '<button class="deleteButton right">删除</button></div>' +
    '</div>';
  overlay.setAttribute("data-overlay", "saves");
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(w.document.getElementById("empty-row").getAttribute("data-ml-save-empty"), "1");
  assert.equal(w.document.getElementById("filled-row").getAttribute("data-ml-save-empty"), null);
  assert.equal(w.document.querySelectorAll("#empty-row .saveButton button").length, 2, "空槽按钮不能少");
  assert.equal(w.document.querySelectorAll("#filled-row .saveButton input").length, 2, "存档 input 按钮不能少");
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
