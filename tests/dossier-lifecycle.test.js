/* 1.5.0 审计修复回归（1.4.22 落修） — 外观面板生命周期 / 全局监听 / 可重建 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { createEnv } = require("./env.js");

const SRC = path.join(__dirname, "..", "src");
const load = (w, file) => w.eval(fs.readFileSync(path.join(SRC, file), "utf8"));

test("dossier-panel destroy 摘除全局 click / resize 监听，并允许 destroy 后再注入", () => {
  const { w } = createEnv({ seed: { v: 1, lang: "zh", motion: false } });
  load(w, "dossier-core.js");
  load(w, "dossier-assets.js");
  load(w, "dossier-theme.js");

  const docAdd = w.document.addEventListener.bind(w.document);
  const docRemove = w.document.removeEventListener.bind(w.document);
  const winAdd = w.addEventListener.bind(w);
  const winRemove = w.removeEventListener.bind(w);
  const counts = { clickAdd: 0, clickRemove: 0, resizeAdd: 0, resizeRemove: 0 };

  w.document.addEventListener = function (type, fn, opts) {
    if (type === "click") counts.clickAdd++;
    return docAdd(type, fn, opts);
  };
  w.document.removeEventListener = function (type, fn, opts) {
    if (type === "click") counts.clickRemove++;
    return docRemove(type, fn, opts);
  };
  w.addEventListener = function (type, fn, opts) {
    if (type === "resize") counts.resizeAdd++;
    return winAdd(type, fn, opts);
  };
  w.removeEventListener = function (type, fn, opts) {
    if (type === "resize") counts.resizeRemove++;
    return winRemove(type, fn, opts);
  };

  load(w, "dossier-panel.js");
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  assert.ok(w.MapleLanternDossierPanel, "面板必须注册");
  assert.equal(counts.clickAdd, 1, "bind 必须挂一次 click");
  assert.equal(counts.resizeAdd, 1, "bind 必须挂一次 resize");

  w.MapleLanternDossierPanel.destroy();
  assert.equal(counts.clickRemove, 1, "destroy 必须摘 click");
  assert.equal(counts.resizeRemove, 1, "destroy 必须摘 resize");

  load(w, "dossier-panel.js");
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  assert.equal(counts.clickAdd, 2, "destroy 后重新注入必须能再次绑定");
  w.MapleLanternDossierPanel.destroy();
});
