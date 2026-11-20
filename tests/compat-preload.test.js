/* 1.4.17 兼容前置层回归 — MEE 1.0.4 的 V.daily 裸读不得中断注入链 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { JSDOM_PATH } = require("./env.js");
const { JSDOM } = require(JSDOM_PATH);

const PRELOAD = fs.readFileSync(path.join(__dirname, "..", "src", "compat-preload.js"), "utf8");

function makeWindow() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    runScripts: "outside-only",
    url: "http://localhost/"
  });
  const w = dom.window;
  w.State = { variables: {} };
  w.V = w.State.variables;
  w.Time = { dayState: "dawn" };
  w.eval(PRELOAD);
  return w;
}

function installMee(w) {
  w.eval(`
    window.mee = {};
    mee.getexcretes = function () {
      if (V.daily.excretes) { return V.daily.excretes.includes(Time.dayState); }
      return false;
    };
    mee.excrete = function () {
      if (!V.daily.excretes) { V.daily.excretes = []; }
      V.daily.excretes.push(Time.dayState);
    };
  `);
}

test("MEE 裸读 V.daily 时不再抛异常，且不伪造 daily", () => {
  const w = makeWindow();
  installMee(w);
  assert.equal(w.mee.getexcretes(), false, "daily 缺失应安全返回 false");
  assert.doesNotThrow(() => w.mee.excrete(), "daily 缺失时 excrete 必须 no-op");
  assert.equal(w.State.variables.daily, undefined, "兼容层不得写入假 daily");
});

test("daily 正常存在时保持 MEE 原行为", () => {
  const w = makeWindow();
  installMee(w);
  w.State.variables.daily = { excretes: [] };
  w.V = w.State.variables;
  w.mee.excrete();
  assert.deepEqual(w.State.variables.daily.excretes, ["dawn"]);
  assert.equal(w.mee.getexcretes(), true, "已排泄时段应返回 true");
  w.Time.dayState = "night";
  assert.equal(w.mee.getexcretes(), false, "未排泄时段应返回 false");
  w.mee.excrete();
  assert.deepEqual(w.State.variables.daily.excretes, ["dawn", "night"]);
});

test(":passageinit 时仅对缺失 daily 调用游戏自带 dailyConvert", () => {
  const w = makeWindow();
  let calls = 0;
  w.dailyConvert = function () {
    calls++;
    w.State.variables.daily = { migrated: true };
  };
  w.document.dispatchEvent(new w.Event(":passageinit"));
  assert.equal(calls, 1, "daily 缺失时应调用 dailyConvert");
  assert.equal(w.State.variables.daily.migrated, true);

  w.State.variables.daily = { already: true };
  w.document.dispatchEvent(new w.Event(":passageinit"));
  assert.equal(calls, 1, "daily 已存在时不得重复迁移");
});

test("core.js 前置分号切断与上一段缺分号脚本的 ASI 连接", () => {
  const w = makeWindow();
  const core = fs.readFileSync(path.join(__dirname, "..", "src", "core.js"), "utf8");
  /* 模拟 MEE 的 mee.excrete = function(){} 末尾缺分号，紧接 core.js 的 (function...)()。 */
  const prev = "window.asiPrev = function () { return \"prev\"; }; window.asiPrevLeak = function () {}";
  assert.doesNotThrow(() => w.eval(prev + "\n" + core), "core.js 必须自己断开 ASI 连接");
  assert.equal(typeof w.MapleLanternCore, "object", "core.js 必须正常装载");
});
