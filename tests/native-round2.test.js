/* 灯台 1.4.5 审计修复轮 — 红测先行
   覆盖：condensed 状态文本 / allure 上限 / innocence 口径 / oxygen 数值 /
        网格页保护 / 关闭原生后的结构还原 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createEnv } = require("./env.js");

const CSS = fs.readFileSync(path.join(__dirname, "..", "src", "maplelantern-native.css"), "utf8");

function tick(w, ms) {
  return new Promise((resolve) => w.setTimeout(resolve, ms || 30));
}

const HEAD = "<div id='ui-bar'><a>状态</a></div><div id='story'><div id='passages'><div class='passage'>__PASSAGE__</div></div></div>" +
  "<div id='stats'><div class='content'><div class='first-row'><div class='centered-elements'>" +
  "<div><img src='sidebar-open.png'></div><div><span class='true'>£1,000.00</span></div>" +
  "<div><span class='clockContainer'>07:48</span></div><div><img src='sidebar-day.png'><span>Sun</span></div>" +
  "</div></div></div></div>";

function card(opts) {
  const barClass = opts.rightMeter ? "rightMeter" : "meter";
  const headClass = opts.rightMeter ? "rightMeterText" : "";
  return `<div id="${opts.id}caption"${opts.title ? ` title="${opts.title}"` : ""}>` +
    `<div class="${headClass}">${opts.label || "标签"}</div>` +
    `<span>状态句</span>` +
    `<div class="${barClass}"><div class="${opts.colour || "greenbar"}" style="width:${opts.pct}%"></div></div></div>`;
}

function statmeters(cards, condensed) {
  return `<div id="statmeters"${condensed ? " class=\"condensed\"" : ""}>` + cards.join("") + "</div>";
}

function page(passage, cardsHtml) {
  return HEAD.replace("__PASSAGE__", passage) + cardsHtml +
    "<div id='mobileStats'><div class='stat time'><span>07</span></div><div class='stat green'>P</div></div>" +
    "<div id='overlayButtons'><button>CHARACTERISTICS</button></div>";
}

const BASE_VARS = () => ({
  willpower: 40, willpowermax: 1000,
  stress: 0, stressmax: 10000,
  trauma: 200, traumamax: 5000,
  arousal: 800, arousalmax: 10000,
  tiredness: 600, pain: 0,
  control: 500, controlmax: 1000,
  allure: 800
});

function varsWith(extra) {
  return Object.assign(BASE_VARS(), extra);
}

function make(html, vars) {
  return createEnv({ html, vars: vars || BASE_VARS(), seed: { v: 1, lang: "zh", motion: false } }).w;
}

test("S1 关闭状态文本：百分比与读数仍可用，CSS 覆盖 .rightMeter", async () => {
  const html = page("走廊", statmeters([
    card({ id: "pain", title: "Pain: 0.00", pct: 0 }),
    card({ id: "allure", title: "Allure: 800.00", pct: 10, rightMeter: true })
  ], true));
  const w = make(html, varsWith({ pain: 0, allure: 800 }));
  await tick(w);
  const allure = w.document.getElementById("allurecaption");
  assert.equal(allure.getAttribute("data-ml-percent"), "10%", "condensed 下百分比应能读到条宽");
  assert.equal(allure.getAttribute("data-ml-readout"), "800/8000");
  assert.match(CSS, /#statmeters\s+(?:\.meter|:is\(\.meter,\s*\.rightMeter\))[^\n]*\{/);
  assert.match(CSS, /\.rightMeter/, "CSS 必须给 .rightMeter 补条形容器规则");
});

test("S2 诱惑上限跟随 allureModifier", async () => {
  const html = page("走廊", statmeters([
    card({ id: "allure", title: "Allure: 800.00", pct: 50 })
  ]));
  const w = make(html, varsWith({ allure: 800, settings: { allureModifier: 0.2 } }));
  await tick(w);
  const allure = w.document.getElementById("allurecaption");
  assert.equal(allure.getAttribute("data-ml-total"), "1600");
  assert.equal(allure.getAttribute("data-ml-readout"), "800/1600");
});

test("S3 天真：按 200 上限与反向条换算", async () => {
  const html = page("走廊", statmeters([
    card({ id: "innocence", title: "Innocence: 60.00", pct: 70, colour: "lbluebar" })
  ]));
  const w = make(html, varsWith({ awareness: -60 }));
  await tick(w);
  const inn = w.document.getElementById("innocencecaption");
  assert.equal(inn.getAttribute("data-ml-total"), "200");
  assert.equal(inn.getAttribute("data-ml-readout"), "60/200");
  assert.equal(inn.getAttribute("data-ml-percent"), "30%", "反向条：条宽 70% 对应进度 30%");
});

test("S4 氧气：无 title 时从变量取当前值、从 oxygenmax 取上限", async () => {
  const html = page("走廊", statmeters([
    card({ id: "oxygen", title: "", pct: 55, colour: "bluebar" })
  ]));
  const w = make(html, varsWith({ oxygen: 45, oxygenmax: 100 }));
  await tick(w);
  const oxy = w.document.getElementById("oxygencaption");
  assert.equal(oxy.getAttribute("data-ml-current"), "45");
  assert.equal(oxy.getAttribute("data-ml-total"), "100");
  assert.equal(oxy.getAttribute("data-ml-readout"), "45/100");
});

test("S5 露出拓展（MyExhibitionism）：四条状态读数是当前/1000，不降级成百分比", async () => {
  const html = page("走廊", statmeters([
    card({ id: "courage", title: "勇气: 307.20 | 高勇气值可以帮助突破淫乱、暴露、异种的数值判定", pct: 30, rightMeter: true }),
    card({ id: "calm", title: "镇静: 292.80 | 高镇静时疼痛、性奋、压力提升速度减慢", pct: 29, rightMeter: true }),
    card({ id: "desire", title: "欲望: 512.00 | 高欲望时勇气增加、镇静减少，低欲望时反之", pct: 51 }),
    card({ id: "satisfaction", title: "满足: 300.00 | 满足感值为勇气和镇静的基础值", pct: 30, rightMeter: true })
  ], true));
  const w = make(html);
  await tick(w);
  const expected = { courage: "307.2/1000", calm: "292.8/1000", desire: "512/1000", satisfaction: "300/1000" };
  for (const [key, value] of Object.entries(expected)) {
    const el = w.document.getElementById(key + "caption");
    assert.equal(el.getAttribute("data-ml-total"), "1000", key + " 上限必须是 1000");
    assert.equal(el.getAttribute("data-ml-readout"), value, key + " 读数必须与宿主上限同格式");
    assert.equal(el.getAttribute("data-ml-percent"), parseInt(el.querySelector(".meter > div,.rightMeter > div").style.width, 10) + "%");
  }
});

test("S6 基本需求（BasicNeeds）：背包详情盒在灯台面板内，不贴 left:100% 被裁", async () => {
  const html = page("走廊", statmeters([card({ id: "pain", title: "Pain: 0.00", pct: 0 })])) +
    "<div id='customOverlay' class='customOverlay'><div id='customOverlayTitle'></div>" +
    "<div id='customOverlayContent'><div class='bn-bp'><div class='bn-bp-grid'>" +
    "<div class='bn-bp-item' data-bnbp='apple'>苹果</div></div></div></div>" +
    "<div id='bn-bp-detailbox'><span class='bn-bp-use' data-bnuse='apple'>吃掉一份</span></div></div>";
  const w = make(html);
  await tick(w);
  assert.match(CSS, /#customOverlay:has\(\.bn-bp\)\s+#bn-bp-detailbox/);
  assert.match(CSS, /#customOverlay:has\(#bn-bp-detailbox\)\s+#customOverlayContent/);
  assert.match(CSS, /#bn-bp-detailbox[^{]*\{[^}]*left:\s*auto !important[^}]*right:\s*12px !important/s);
  assert.match(CSS, /@media \(max-width: 760px\)[\s\S]*#bn-bp-detailbox[^{]*\{[^}]*bottom:\s*8px !important/s);
});

test("S7 自控 / 氧气条宽是 current/max，不再二次反向", async () => {
  const html = page("走廊", statmeters([
    card({ id: "control", title: "Control: 1000.00", pct: 100, rightMeter: true }),
    card({ id: "oxygen", title: "", pct: 45, colour: "bluebar" })
  ]));
  const w = make(html, varsWith({ control: 1000, controlmax: 1000, oxygen: 45, oxygenmax: 100 }));
  await tick(w);
  assert.equal(w.document.getElementById("controlcaption").getAttribute("data-ml-percent"), "100%");
  assert.equal(w.document.getElementById("oxygencaption").getAttribute("data-ml-percent"), "45%");
});

test("S8 露出拓展「随身衣物」页：灯台把 MEE 的负 left / 40% 高拉回居中全高", async () => {
  assert.match(CSS, /#customOverlay:has\(#titleCarriedclothes\)\s*\{[^}]*left:\s*0 !important[^}]*right:\s*0 !important[^}]*height:\s*calc\(var\(--ml-vh,\s*100vh\) - 96px\) !important/s);
});

test("S9 桌面版恢复非 CE 条目的块级排版，并识别随身衣物叠层", async () => {
  assert.match(CSS, /\.settingsToggleItem,[\s\S]*?\.settingsToggleItemWide\s*\{[^}]*display:\s*block;/);
  assert.match(CSS, /html\[data-ml-native="on"\] #bn-panel \.bn-text[^{]*\{[^}]*white-space:\s*normal !important/s);
  assert.match(CSS, /html\[data-ml-native="on"\] #bn-panel \.meter[^{]*\{[^}]*height:\s*7px !important/s);
  assert.doesNotMatch(CSS, /\[data-ml-opt-meter-skin="1"\] #bn-panel \.bn-text/);
  assert.match(CSS, /html\[data-ml-native="on"\] #mobileStats\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(CSS, /@media \(min-width: 701px\)[\s\S]*#passages \.passage[^{]*\{[^}]*max-width:\s*min\(100%,\s*1100px\)/s);

  const html = page("走廊", statmeters([card({ id: "pain", title: "Pain: 0.00", pct: 0 })])) +
    "<div id='customOverlayContainer'><div id='customOverlay' class='customOverlay'>" +
    "<div id='customOverlayTitle'><div id='titleCarriedclothes'></div></div>" +
    "<div id='customOverlayContent'><div class='clothing-takeback-button-container'>" +
    "<div class='clothing-caption-button'></div><div class='clothing-caption-button'></div>" +
    "</div></div></div></div>";
  const w = make(html);
  w.T = {};
  await tick(w);
  w.MapleLanternNative.apply();
  const overlay = w.document.getElementById("customOverlay");
  assert.equal(overlay.getAttribute("data-ml-overlay"), "carriedclothes");
  assert.equal(w.T.currentOverlay, "carriedclothes", "MEE 的随身按钮靠这个临时值决定放进/脱下");
  // 从随身衣物页换到其他页时，补写的临时值必须清掉，否则后续叠层会继续误判。
  w.document.getElementById("titleCarriedclothes").remove();
  overlay.querySelector("#customOverlayContent").innerHTML = "<div class='journal-page'>日志</div>";
  w.MapleLanternNative.apply();
  assert.equal(w.T.currentOverlay, undefined, "离开随身衣物页后不得残留 carriedclothes");
});

test("S10 MEE 随身衣物页：全屏容器不得挡住左侧衣物图标的点击", async () => {
  assert.match(CSS,
    /@media \(min-width: 701px\)[\s\S]*#customOverlayContainer\[data-ml-overlay-host="carriedclothes"\][^{]*\{[^}]*pointer-events:\s*none !important/s,
    "桌面并排侧栏时，随身衣物页的全屏容器必须放过左侧点击");
  assert.match(CSS,
    /@media \(min-width: 701px\)[\s\S]*#customOverlay\[data-ml-overlay="carriedclothes"\][^{]*\{[^}]*pointer-events:\s*auto !important/s,
    "容器放行后，弹层需自己恢复接收点击");
  assert.match(CSS,
    /#customOverlayContainer\[data-ml-overlay-host="carriedclothes"\][^{]*\{[^}]*background:\s*transparent !important/s,
    "随身衣物页不应把左侧衣柜盖上一层暗色遮罩");

  let html = page("走廊", statmeters([card({ id: "pain", title: "Pain: 0.00", pct: 0 })])) +
    "<div id='customOverlayContainer'><div id='customOverlay' class='customOverlay'>" +
    "<div id='customOverlayTitle'><div id='titleCarriedclothes'></div></div>" +
    "<div id='customOverlayContent'><div class='clothing-takeback-button-container'>" +
    "<div class='clothing-caption-button'></div></div></div></div></div>";
  const w = make(html);
  w.T = {};
  await tick(w);
  w.MapleLanternNative.apply();
  const host = w.document.getElementById("customOverlayContainer");
  assert.equal(host.getAttribute("data-ml-overlay-host"), "carriedclothes");

  const overlay = w.document.getElementById("customOverlay");
  w.document.getElementById("titleCarriedclothes").remove();
  overlay.querySelector("#customOverlayContent").innerHTML = "<div class='journal-page'>日志</div>";
  w.MapleLanternNative.apply();
  assert.notEqual(host.getAttribute("data-ml-overlay-host"), "carriedclothes",
    "离开随身衣物页后容器标记必须清掉，不能继续放行点击");
});

test("S11 成就页：74px 金币图必须缩进 30px 图标列，不能溢出压住标题", async () => {
  assert.match(CSS,
    /#featsList \.featImage\s*\{[^}]*box-sizing:\s*border-box/s,
    "图标列必须按 border-box 计算 30px，含内边距不能超列宽");
  assert.match(CSS,
    /#featsList \.featImage img\s*\{[^}]*width:\s*22px[^}]*height:\s*22px[^}]*object-fit:\s*contain/s,
    "已解锁金币图（原图 74px）与未解锁圆点都必须缩到图标列内并保持比例");

  const feats = "<div id='featsList'>" +
    "<div class='feat'><div class='featImage'><img class='featCoin' src='coin-gold.png'></div>" +
    "<div class='featText'><span class='title'>一桶金</span><span class='text'>Earned on: 05/05/2026</span></div></div>" +
    "<div class='feat'><div class='featImage'><img class='dot'></div>" +
    "<div class='featText'><span class='title'>?????</span><span class='text'>未解锁</span></div></div></div>";
  let html = page("成就", statmeters([card({ id: "pain", title: "Pain: 0.00", pct: 0 })])) +
    "<div id='customOverlayContainer'><div id='customOverlay' class='customOverlay' data-ml-overlay='gameFeats'>" +
    "<div id='customOverlayContent'>" + feats + "</div></div></div>";
  const w = make(html);
  await tick(w);
  w.MapleLanternNative.apply();
  assert.equal(w.document.querySelectorAll("#featsList .feat").length, 2, "成就行结构不能被改动");
  assert.ok(w.document.querySelector("#featsList .featImage img.featCoin"), "金币图必须留在图标列内");
});

test("O1 网格页：不搬节点、不删单元格", async () => {
  const grid = "<div class='pc-grid' style='display:grid;grid-template-columns:1fr 1fr'>" +
    "<div class='cell' id='cellA'><img class='icon' src='a.png'><a class='link-internal macro-link' data-passage='X'>选项 A</a></div>" +
    "<div class='cell' id='cellB'><img class='icon' src='b.png'><a class='link-internal macro-link' data-passage='Y'>选项 B</a></div>" +
    "</div>";
  const w = make(page(grid, statmeters([card({ id: "pain", title: "Pain: 0.00", pct: 0 })])));
  await tick(w);
  const a = w.document.getElementById("cellA");
  const b = w.document.getElementById("cellB");
  assert.ok(a && b, "网格单元格不能被删");
  assert.ok(a.querySelector("a.link-internal"), "选项必须留在原单元格");
  assert.equal(w.document.querySelectorAll(".ml-option-group").length, 0, "网格页不得生成图标组合卡");
});

test("O2 关闭原生卡片：结构可还原", async () => {
  const passage = "<div class='holder' id='h1'><img class='icon' src='x.png'><a class='link-internal macro-link' data-passage='X'>选项</a></div>";
  const w = make(page(passage, statmeters([card({ id: "pain", title: "Pain: 0.00", pct: 0 })])));
  await tick(w);
  const holder = w.document.getElementById("h1");
  assert.ok(holder, "宿主容器不应被删除");
  assert.equal(w.document.querySelectorAll(".ml-option-group").length, 1, "普通段落仍应出组合卡");

  w.localStorage.setItem("MapleLantern.settings.v1", JSON.stringify({ v: 1, lang: "zh", motion: false, native: false }));
  w.MapleLanternNative.apply();
  assert.equal(w.document.querySelectorAll(".ml-option-group").length, 0, "关闭后组合卡应拆掉");
  const restored = w.document.getElementById("h1");
  assert.ok(restored, "关闭后宿主容器必须还在");
  assert.ok(restored.querySelector("img.icon"), "图标应回到宿主容器");
  assert.ok(restored.querySelector("a.link-internal"), "链接应回到宿主容器");
  assert.equal(restored.hasAttribute("data-ml-empty-holder"), false, "隐藏标记应被清掉");
});

test("S13 展开态合并后：空 second-row 隐藏，开关恢复 1 倍缩放", () => {
  assert.match(CSS, /#stats\[data-ml-stats-merged="1"\]\s+\.second-row\s*\{[^}]*display:\s*none/s);
  assert.match(CSS, /#stats \.centered-elements > div\[data-ml-chip="toggle"\]\s*\{[^}]*scale:\s*1\s*!important/s);
});

test("S12 侧栏内部普通点击不得把正文切成抽屉隐藏态", async () => {
  const w = make(page("<p>正文</p>", ""));
  const doc = w.document;
  const bar = doc.getElementById("ui-bar");
  bar.insertAdjacentHTML("beforeend", "<a id='ml-money'>£1,000</a><button id='ui-bar-toggle'>☰</button>");
  bar.getBoundingClientRect = () => ({ width: 281, height: 844, top: 0, left: 0, right: 281, bottom: 844, x: 0, y: 0 });
  await tick(w);
  doc.documentElement.removeAttribute("data-ml-sidebar-open");

  doc.getElementById("ml-money").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick(w, 200);
  assert.equal(doc.documentElement.getAttribute("data-ml-sidebar-open"), null,
    "点击金额/时间等侧栏内部区域不应挂上抽屉隐藏标记");

  doc.getElementById("ui-bar-toggle").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
  await tick(w, 200);
  assert.equal(doc.documentElement.getAttribute("data-ml-sidebar-open"), "1",
    "真实开合按钮仍必须能挂上抽屉标记");
});

test("S12b #ui-bar 自身收起/展开必须立即同步，正文不再残留抽屉标记", async () => {
  const w = make(page("<p>正文</p>", ""));
  const doc = w.document;
  const bar = doc.getElementById("ui-bar");
  bar.getBoundingClientRect = () => ({ width: 281, height: 844, top: 0, left: 0, right: 281, bottom: 844, x: 0, y: 0 });
  await tick(w);
  assert.equal(doc.documentElement.getAttribute("data-ml-sidebar-open"), "1",
    "侧栏可见时必须挂抽屉标记");

  bar.classList.add("stowed");
  await tick(w, 40);
  assert.equal(doc.documentElement.getAttribute("data-ml-sidebar-open"), null,
    "侧栏通过左滑/宿主收起时，标记必须立即清掉");

  bar.classList.remove("stowed");
  await tick(w, 40);
  assert.equal(doc.documentElement.getAttribute("data-ml-sidebar-open"), "1",
    "侧栏重新展开时必须重新挂标记");

  bar.style.display = "none";
  await tick(w, 40);
  assert.equal(doc.documentElement.getAttribute("data-ml-sidebar-open"), null,
    "宿主用 display:none 收起侧栏时也必须清标记");
});
