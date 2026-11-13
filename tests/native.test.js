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

test("图标 + 选项：图标与链接同在一个容器内时也能进同一张卡", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<div class="option-line"><img class="icon" src="popcorn.png"><br><a class="link-internal macro-link" data-passage="Cinema">(2) Cinema</a></div>' +
    '<div class="option-line"><img class="icon" src="gamepad.png"><br><a class="link-internal macro-link" data-passage="Arcade">(3) Arcade</a></div>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const groups = p.querySelectorAll(".ml-option-group");
  assert.equal(groups.length, 2, "同容器内的图标与链接都应打包");
  for (const group of groups) {
    assert.equal(group.querySelector("img.icon") !== null, true);
    assert.equal(group.querySelector("a.macro-link") !== null, true);
    assert.equal(group.children.length, 2, "卡片内只应保留图标与链接");
  }
  assert.equal(p.querySelector(".option-line"), null, "空容器应被移除");
  assert.equal(p.querySelectorAll("br").length, 0, "容器内的换行不应留下空行");
});

test("正文选项：场景图标包在装饰层里时也能进同一张卡", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<span class="icon-container icon infront"><span><img class="icon" src="pond-grass.png"></span></span>' +
    '<span class="water-outdoor-night"><img class="icon" src="pond-base.gif"></span>' +
    '<a class="link-internal macro-link" data-passage="A">(1) Check your reflection</a>' +
    '<div class="ml-option-group" data-ml-option-group="1"><img class="icon" src="swim.png"><a class="link-internal macro-link" data-passage="B">(2) Swim</a></div>' +
    '<span class="icon-container icon infront"><span><img class="icon" src="waterfall-rock.png"></span></span>' +
    '<span class="water-outdoor-night"><img class="icon" src="waterfall-base.gif"></span>' +
    '<a class="link-internal macro-link" data-passage="C">(3) South to waterfall</a>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const groups = p.querySelectorAll(".ml-option-group");
  assert.equal(groups.length, 3, "场景装饰层里的图标也应打包");
  for (const group of groups) {
    assert.equal(group.querySelector("img.icon") !== null, true);
    assert.equal(group.querySelector("a.macro-link") !== null, true);
    assert.equal(group.children.length, 2, "卡片内只应保留一个图标与一个链接");
  }
  assert.equal(p.querySelectorAll("span.water-outdoor-night").length, 0, "搬走图标后的空装饰层应被移除");
  assert.equal(p.querySelectorAll(".icon-container").length, 0, "空图标容器不应继续占位");
  assert.equal(p.querySelector('.ml-option-group a[data-passage="A"]') !== null, true);
  assert.equal(p.querySelector('.ml-option-group a[data-passage="C"]') !== null, true);
});

test("正文选项：同一装饰层里叠两个图标时，优先把可见场景图搬进卡", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<span class="scene">' +
    '<span class="icon-container icon infront"><img class="icon" src="hidden.png"></span>' +
    '<img class="icon" src="scene.png">' +
    '</span>' +
    '<a class="link-internal macro-link" data-passage="A">(1) Check your reflection</a>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const group = p.querySelector(".ml-option-group");
  assert.equal(group !== null, true);
  assert.equal(group.querySelector('img.icon').getAttribute("src"), "scene.png", "不应选中 icon-container 里的隐藏图标");
  assert.equal(group.querySelector('a[data-passage="A"]') !== null, true);
});

test("正文选项：span.icon-container 图标也能整组搬进卡", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<span class="icon-container"><span class="icon swim"></span></span>' +
    '<a class="link-internal macro-link" data-passage="A">(3) 游泳</a>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const group = p.querySelector(".ml-option-group");
  assert.equal(group !== null, true);
  assert.equal(group.querySelector(".icon-container") !== null, true, "图标容器应搬进卡内");
  assert.equal(group.querySelector(".icon") !== null, true);
  assert.equal(p.querySelectorAll(".icon-container").length, 1, "卡外不应再留图标容器");
  assert.equal(group.querySelector('a[data-passage="A"]') !== null, true);
});

test("正文选项：pointerdown 生成原生主题环并进入按压态", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: true } });
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<div class="option-line"><img class="icon" src="forest.png"><br><a class="link-internal macro-link" data-passage="Forest">(1) Forest</a></div>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const group = p.querySelector(".ml-option-group");
  assert.ok(group, "选项卡片应已生成");
  group.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 44, right: 300, bottom: 44 });
  group.querySelector("a.macro-link").dispatchEvent(
    new w.MouseEvent("pointerdown", { bubbles: true, clientX: 40, clientY: 22, button: 0 })
  );
  assert.equal(group.classList.contains("mln-is-pressed"), true);
  assert.equal(group.querySelectorAll(".mln-press-ring").length, 1);
  assert.equal(group.querySelector(".mln-press-ring").getAttribute("style").includes("left: 40px"), true);
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

test("宿主启用：独立外观层仍按玩家开关挂载，不因宿主存在而整层让位", async () => {
  const { w } = createEnv({ host: true });
  await tick(w);
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "on");
  assert.equal(w.document.querySelectorAll("#statmeters > div[data-ml-stat-card]").length > 0, true);
  openOptions(w);
  await tick(w);
  assert.equal(w.document.querySelectorAll('#customOverlay [data-ml-entry="panel"]').length, 1);
});

test("原生开关关闭：不加原生标记，但选项里的灯台入口仍保留", async () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false, native: false } });
  await tick(w);
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "off");
  assert.equal(w.document.querySelectorAll("#statmeters > div[data-ml-stat-card]").length, 0);
  openOptions(w);
  await tick(w);
  assert.equal(w.document.querySelectorAll('#customOverlay [data-ml-entry="panel"]').length, 1,
    "关闭原生卡片后，玩家仍需要从选项进入灯台面板");
});

test("原生卡片关→开：选项弹层不关闭，入口不丢，页签容器不被重排", async () => {
  const { w } = createEnv();
  await tick(w);
  openOptions(w);
  await tick(w);
  const overlay = w.document.getElementById("customOverlay");
  const container = w.document.getElementById("customOverlayContainer");
  const content = w.document.getElementById("customOverlayContent");
  const tabs = w.document.createElement("div");
  tabs.id = "overlayTabs";
  tabs.innerHTML = '<button type="button">General</button><button type="button">Theme</button>';
  w.document.getElementById("customOverlayTitle").appendChild(tabs);
  const tabToggle = { on: false, toggle() { this.on = !this.on; } };
  w.T = { tab: tabToggle };
  assert.equal(overlay.classList.contains("hidden"), false);

  w.localStorage.setItem("MapleLantern.settings.v1", JSON.stringify({ v: 1, lang: "zh", motion: false, native: false }));
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "off");
  assert.equal(overlay.classList.contains("hidden"), false, "关原生卡片不应把选项弹层关掉");
  assert.equal(container.parentNode, w.document.body, "弹层容器不应被搬回正文层");
  assert.equal(overlay.querySelectorAll('[data-ml-entry="panel"]').length, 1, "入口不应随原生卡片关闭被删");
  assert.equal(content.firstElementChild && content.firstElementChild.className, "ml-native-entry-wrap");
  const offEntry = overlay.querySelector('[data-ml-entry="panel"]');
  offEntry.click();
  assert.equal(w.document.getElementById("ml-panel").hidden, false, "关闭原生卡片后入口仍能打开面板");
  w.MapleLantern.close();

  w.localStorage.setItem("MapleLantern.settings.v1", JSON.stringify({ v: 1, lang: "zh", motion: false, native: true }));
  w.MapleLanternNative.refresh();
  await tick(w);
  assert.equal(w.document.documentElement.getAttribute("data-ml-native"), "on");
  assert.equal(overlay.classList.contains("hidden"), false, "重新开启原生卡片不应关掉选项弹层");
  assert.equal(overlay.querySelectorAll('[data-ml-entry="panel"]').length, 1, "重新开启后入口仍在");
  assert.equal(w.document.getElementById("overlayTabs"), tabs, "页签容器不应被重建");
  assert.equal(w.T.tab, tabToggle, "T.tab 不应被本模组清掉");

  tabs.querySelector("button").addEventListener("click", () => tabToggle.toggle());
  tabs.querySelector("button").click();
  assert.equal(tabToggle.on, true, "页签按钮仍能调用原版 T.tab.toggle()");
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

test("CE 平铺页签：七颗胶囊同一行等分，不被 1.20.4 的 grid 撑成两行", async () => {
  const { w } = createEnv();
  await tick(w);
  openOptions(w);
  const content = w.document.getElementById("customOverlayContent");
  content.innerHTML =
    '<div id="cheat_extended_options">' +
    ['状态', '外观', 'NPC', '传送', '其它', '模组作弊', '生育扩展作弊'].map((t) => '<button>' + t + '</button>').join('') +
    '</div>';
  await tick(w, 320);
  const tabs = content.querySelector("#cheat_extended_options");
  assert.ok(tabs, "CE 面板应存在");
  assert.equal(tabs.style.getPropertyValue("display"), "flex", "页签容器必须从 grid 改回 flex");
  assert.equal(tabs.style.getPropertyValue("flex-wrap"), "nowrap", "页签必须单行");
  const buttons = tabs.querySelectorAll("button");
  assert.equal(buttons.length, 7);
  for (const b of buttons) {
    assert.equal(b.getAttribute("data-mln-tab"), "1", "页签应被标记，避免被内容按钮规则二次改写");
    assert.equal(b.style.getPropertyValue("width"), "auto", "固定 100px 必须被解除");
    assert.equal(b.style.getPropertyValue("font-size"), "11px");
    assert.match(b.style.getPropertyValue("flex"), /^1 1 0(px)?$/, "平铺页签应等分一行");
  }
});

test("CE 传送页：地点行内列表收成纵向行，长地名不再越出右缘", async () => {
  const { w } = createEnv();
  await tick(w);
  openOptions(w);
  const content = w.document.getElementById("customOverlayContent");
  content.innerHTML =
    '<div id="cheat_extended_options">' +
    ['状态', '外观', 'NPC', '传送', '其它', '模组作弊', '生育扩展作弊']
      .map((t) => '<button class="' + (t === "传送" ? "CEtabSelected" : "") + '">' + t + '</button>').join('') +
    '</div>' +
    '<div id="loc-list">' +
    ['城镇地点', '孤儿院', '出租屋', '购物中心', '舞蹈室', '康努达塔斯街'].map((t) => '<a href="#">' + t + '</a>').join('') +
    '</div>';
  await tick(w, 320);
  const overlay = w.document.getElementById("customOverlay");
  const list = content.querySelector("#loc-list");
  assert.equal(overlay.getAttribute("data-mln-ce-page"), "teleport", "传送页应打上页面标记");
  assert.equal(list.style.getPropertyValue("display"), "flex");
  assert.equal(list.style.getPropertyValue("flex-direction"), "column", "地点列表应收成纵向");
  assert.equal(list.children[0].style.getPropertyValue("width"), "100%", "每个地点占满一行");
});

test("CE 传送页：图标与链接交替平铺时按对子收成一行", async () => {
  const { w } = createEnv();
  await tick(w);
  openOptions(w);
  const content = w.document.getElementById("customOverlayContent");
  content.innerHTML =
    '<div id="cheat_extended_options">' +
    '<button>状态</button><button class="CEtabSelected">传送</button>' +
    '</div>' +
    '<div id="loc-list">' +
    '<b>城镇地点</b>' +
    '<span class="icon-container"><img class="icon" src="orphan.png"></span><a href="#">孤儿院</a>' +
    '<span class="icon-container"><img class="icon" src="rent.png"></span><a href="#">出租屋</a>' +
    '<span class="icon-container"><img class="icon" src="mall.png"></span><a href="#">购物中心</a>' +
    '</div>';
  await tick(w, 320);
  const list = content.querySelector("#loc-list");
  const rows = list.querySelectorAll('[data-mln-ce-loc-row="1"]');
  assert.equal(rows.length, 3, "三组图标+链接应包成三行");
  assert.ok(list.querySelector("b"), "分组标题必须保留在列表里");
  for (const row of rows) {
    assert.ok(row.querySelector("img.icon"), "每行必须保留图标");
    assert.ok(row.querySelector("a"), "每行必须保留链接");
  }
  assert.equal(list.style.getPropertyValue("flex-direction"), "column");
  const looseIcons = Array.from(list.children).filter((n) => !n.matches('[data-mln-ce-loc-row="1"]') && n.tagName === "IMG");
  assert.equal(looseIcons.length, 0, "图标不得再作为列表的独立行");
});

test("CE 传送页标记：选中态不是 .CEtabSelected 时仍能识别", async () => {
  const { w } = createEnv();
  await tick(w);
  openOptions(w);
  const content = w.document.getElementById("customOverlayContent");
  content.innerHTML =
    '<div id="cheat_extended_options">' +
    '<button>状态</button><button aria-selected="true">传送</button>' +
    '</div><div id="loc-list"><a>城镇地点</a><a>孤儿院</a><a>出租屋</a></div>';
  await tick(w, 320);
  assert.equal(w.document.getElementById("customOverlay").getAttribute("data-mln-ce-page"), "teleport");
});

test("CE 传送页标记：切到非传送页签后必须摘掉，避免误伤其它页", async () => {
  const { w } = createEnv();
  await tick(w);
  openOptions(w);
  const content = w.document.getElementById("customOverlayContent");
  content.innerHTML =
    '<div id="cheat_extended_options">' +
    '<button>状态</button><button class="CEtabSelected">传送</button>' +
    '</div><div id="loc-list"><a>城镇地点</a><a>孤儿院</a><a>出租屋</a></div>';
  await tick(w, 320);
  const overlay = w.document.getElementById("customOverlay");
  assert.equal(overlay.getAttribute("data-mln-ce-page"), "teleport");
  content.innerHTML =
    '<div id="cheat_extended_options">' +
    '<button class="CEtabSelected">状态</button><button>传送</button>' +
    '</div><p>状态页</p>';
  await tick(w, 320);
  assert.equal(overlay.hasAttribute("data-mln-ce-page"), false, "离开传送页应移除标记");
});
test("性能：补扫停止后晚到 2 秒的链接仍由 MutationObserver 接回卡片", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML = '<p>旧页</p><img class="icon" src="a.png"><a class="link-internal macro-link" data-passage="A">A</a>';
  w.document.dispatchEvent(new w.Event("passageend"));
  await tick(w, 2000);
  assert.ok(w.MapleLanternNative.stats().sweeps <= 4, "补扫应已停止");
  p.innerHTML = '<p>新页</p>' +
    '<img class="icon" src="b.png"><a class="link-internal macro-link" data-passage="B">B</a>' +
    '<img class="icon" src="c.png"><a class="link-internal macro-link" data-passage="C">C</a>';
  await tick(w, 400);
  const groups = p.querySelectorAll(".ml-option-group");
  assert.equal(groups.length, 2, "晚到选项应重新成组");
  for (const g of groups) {
    assert.ok(g.querySelector("img.icon") && g.querySelector("a.macro-link"), "图标与链接必须在同一张卡");
  }
});

test("性能：分组稳定后重复 apply 不再重跑 pack 全页遍历", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML = '<p>测试页</p>' +
    '<img class="icon" src="a.png"><a class="link-internal macro-link" data-passage="A">A</a>' +
    '<img class="icon" src="b.png"><a class="link-internal macro-link" data-passage="B">B</a>';
  w.MapleLanternNative.refresh();
  await tick(w, 50);
  const base = w.MapleLanternNative.stats();
  for (let i = 0; i < 20; i++) { w.MapleLanternNative.apply(); }
  const after = w.MapleLanternNative.stats();
  assert.ok(after.packs - base.packs <= 1, "稳定页最多再 pack 1 次，实际 " + (after.packs - base.packs));
});

test("性能：静态页补扫连续两拍无变化即停，不再固定空跑 6 秒", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML = '<p>测试页</p><a class="link-internal macro-link" data-passage="Next">继续</a>';
  const before = w.MapleLanternNative.stats();
  w.document.dispatchEvent(new w.Event("passageend"));
  await tick(w, 2600);
  const after = w.MapleLanternNative.stats();
  assert.ok(after.sweeps - before.sweeps <= 4, "稳定页最多 4 拍补扫，实际 " + (after.sweeps - before.sweeps));
  assert.ok(after.applies - before.applies <= 8, "稳定页 apply 次数应受控，实际 " + (after.applies - before.applies));
});

test("性能：CE 面板未变脏时，正文 refresh 不再重复重排", async () => {
  const { w } = createEnv();
  await tick(w);
  openOptions(w);
  const content = w.document.getElementById("customOverlayContent");
  content.innerHTML = '<div id="cheat_extended_options"><button>状态</button><button>传送</button></div>';
  await tick(w, 700);
  const base = w.MapleLanternNative.stats();
  assert.ok(base.ceNorm >= 1, "面板出现时应重排一次");
  for (let i = 0; i < 3; i++) {
    w.MapleLanternNative.refresh();
    await tick(w, 120);
  }
  const after = w.MapleLanternNative.stats();
  assert.equal(after.ceNorm, base.ceNorm, "未变脏时不应重复重排");
  content.innerHTML = '<div id="cheat_extended_options"><button>状态</button><button>传送</button></div><p>另一个页签</p><button>新按钮</button>';
  await tick(w, 300);
  assert.equal(w.MapleLanternNative.stats().ceNorm, base.ceNorm + 1, "页签内容变化应只重排一次");
});
test("选项分组：组前后空 <p> 不残留，避免把 3px 间距重新撑大", async () => {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML =
    '<p>孤儿院大厅</p>' +
    '<img class="icon" src="garden.png"><p></p><a class="link-internal macro-link" data-passage="Garden">(1) 花园</a><p></p>' +
    '<img class="icon" src="office.png"><p></p><a class="link-internal macro-link" data-passage="Office">(2) 办公室</a><p></p>' +
    '<p>尾注</p>';
  w.MapleLanternNative.refresh();
  await tick(w);
  const groups = p.querySelectorAll(".ml-option-group");
  assert.equal(groups.length, 2);
  for (const g of groups) {
    assert.ok(g.querySelector("img.icon"), "每组都要有图标");
    assert.ok(g.querySelector("a.macro-link"), "每组都要有链接");
  }
  const emptyP = Array.from(p.querySelectorAll("p")).filter((n) => !(n.textContent || "").trim());
  assert.equal(emptyP.length, 0, "空 <p> 应被清掉");
  assert.equal(p.querySelectorAll("p").length, 2, "正文首尾段落应保留");
});

test("性能：状态卡同值不重复写，数值变化仍更新", async () => {
  const { w } = createEnv();
  await tick(w);
  const card = w.document.getElementById("paincaption");
  assert.equal(card.getAttribute("data-ml-value"), "0.00 · 0%", "首轮应写入显示值");
  const base = w.MapleLanternNative.stats();
  for (let i = 0; i < 10; i++) { w.MapleLanternNative.apply(); }
  const steady = w.MapleLanternNative.stats();
  assert.equal(steady.writes - base.writes, 0, "同值重复 apply 不应产生属性写入");
  assert.ok(steady.writesSaved - base.writesSaved > 0, "应累计跳过同值写入");
  card.setAttribute("title", "Pain: 12.00");
  w.MapleLanternNative.apply();
  assert.equal(card.getAttribute("data-ml-current"), "12", "数值变化必须写回");
  assert.equal(card.getAttribute("data-ml-readout"), "12/100", "上限拼接必须保持");
  assert.equal(w.MapleLanternNative.stats().writes > steady.writes, true, "变化时应产生写入");
});

test("1.1.18：CE 关闭后 #customOverlay 的内联宽度必须还原", async () => {
  const { w } = createEnv();
  await tick(w);
  w.innerWidth = 390;
  openOptions(w);
  const overlay = w.document.getElementById("customOverlay");
  const content = w.document.getElementById("customOverlayContent");
  const originalOverlay = overlay.getAttribute("style");
  const originalContent = content.getAttribute("style");

  const tabs = w.document.createElement("div");
  tabs.id = "cheat_extended_options";
  tabs.innerHTML = "<button class=\"CEtabSelected\">状态</button><button>模组作弊</button>";
  content.appendChild(tabs);
  w.MapleLanternNative.refresh();
  await tick(w, 200);
  assert.ok(overlay.getAttribute("style").includes("width"),
    "CE 打开时应写入宽度约束");

  tabs.remove();
  w.MapleLanternNative.refresh();
  await tick(w, 200);
  assert.equal(overlay.getAttribute("style"), originalOverlay,
    "CE 关闭后 overlay 必须回到打开前的 inline style");
  assert.equal(content.getAttribute("style"), originalContent,
    "CE 关闭后 content 必须回到打开前的 inline style");
});
