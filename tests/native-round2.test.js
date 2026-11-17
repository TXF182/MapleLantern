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
