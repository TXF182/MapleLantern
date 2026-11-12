/* 灯台原生层性能基准（逻辑层，不含浏览器真实渲染）
 *
 * 口径借鉴 MapleBirchCE tests/bench_panel_render.js：只测“每次换页做了多少次
 * 全量扫描/重排”，不伪造浏览器帧率。
 *
 * 运行：node tools/bench-native.js
 * 断言：静态页每页 apply <= 8、sweep <= 4；CE 面板未变脏时 refresh 不增加重排。
 */
"use strict";
const assert = require("node:assert/strict");
const { createEnv } = require("../tests/env.js");

function tick(w, ms) {
  return new Promise((resolve) => w.setTimeout(resolve, ms));
}

function pageHtml(count) {
  let html = "<p>孤儿院大厅</p>";
  for (let i = 1; i <= count; i++) {
    html += '<img class="icon" src="p' + i + '.png"><p></p>' +
      '<a class="link-internal macro-link" data-passage="P' + i + '">(' + i + ') 地点 ' + i + '</a><p></p>';
  }
  return html + "<p>尾注</p>";
}

async function staticPassage() {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML = pageHtml(6);
  const before = w.MapleLanternNative.stats();
  const t0 = performance.now();
  w.document.dispatchEvent(new w.Event("passageend"));
  await tick(w, 2600);
  const after = w.MapleLanternNative.stats();
  return {
    label: "静态页 6 选项 / 单次 passageend，观察 2.6s",
    applies: after.applies - before.applies,
    sweeps: after.sweeps - before.sweeps,
    packs: after.packs - before.packs,
    writes: after.writes - before.writes,
    writesSaved: after.writesSaved - before.writesSaved,
    ceNorm: after.ceNorm - before.ceNorm,
    ms: Math.round(performance.now() - t0),
    groups: p.querySelectorAll(".ml-option-group").length,
  };
}

async function longPage() {
  const { w } = createEnv();
  await tick(w);
  const p = w.document.querySelector("#passages .passage");
  p.innerHTML = pageHtml(200);
  w.MapleLanternNative.apply();
  const before = w.MapleLanternNative.stats();
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) { w.MapleLanternNative.apply(); }
  const after = w.MapleLanternNative.stats();
  return {
    label: "200 选项页 / 连续 20 次 apply",
    applies: after.applies - before.applies,
    sweeps: after.sweeps - before.sweeps,
    packs: after.packs - before.packs,
    writes: after.writes - before.writes,
    writesSaved: after.writesSaved - before.writesSaved,
    ms: Math.round(performance.now() - t0),
    groups: p.querySelectorAll(".ml-option-group").length,
  };
}

async function cePanel() {
  const { w } = createEnv();
  await tick(w);
  w.document.getElementById("customOverlay").classList.remove("hidden");
  const content = w.document.getElementById("customOverlayContent");
  content.innerHTML = '<div id="cheat_extended_options"><button>状态</button><button>传送</button></div>' +
    '<div id="CE_settingsDiv"><div class="settingsGrid">' +
    Array.from({ length: 30 }, (_, i) => "<button>项 " + i + "</button>").join("") +
    "</div></div>";
  await tick(w, 700);
  const base = w.MapleLanternNative.stats();
  for (let i = 0; i < 20; i++) {
    w.MapleLanternNative.refresh();
    await tick(w, 60);
  }
  const after = w.MapleLanternNative.stats();
  return {
    label: "CE 面板打开后 / 正文 refresh 20 次",
    applies: after.applies - base.applies,
    packs: after.packs - base.packs,
    writes: after.writes - base.writes,
    writesSaved: after.writesSaved - base.writesSaved,
    ceNorm: after.ceNorm - base.ceNorm,
    ceReady: after.ceReady,
    ceDirty: after.ceDirty,
  };
}

(async () => {
  const rows = [await staticPassage(), await longPage(), await cePanel()];
  for (const r of rows) { console.log(JSON.stringify(r)); }
  const s = rows[0];
  assert.ok(s.applies <= 8, "静态页 apply 应 <= 8，实际 " + s.applies);
  assert.ok(s.sweeps <= 4, "静态页 sweep 应 <= 4，实际 " + s.sweeps);
  assert.ok(s.packs <= 1, "静态页首轮后不应重复 pack，实际 " + s.packs);
  assert.ok(s.writes <= 8, "稳定页只应保留首轮必要写入，实际 " + s.writes);
  assert.ok(s.groups === 6, "6 个选项应成 6 组，实际 " + s.groups);
  assert.equal(rows[2].ceNorm, 0, "CE 未变脏时 refresh 不应重排");
  console.log("BENCH PASS");
})().catch((e) => { console.error(e); process.exit(1); });
