"use strict";
/* 浮窗卡片（第三张自定义图）：作用于游戏原生浮窗/弹窗的卡片底。
 * 契约来源：玩家 2026-11-18 明确「游戏原生浮窗/弹窗」+「单独导入第三张图」。 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require(require("./env").JSDOM_PATH);

const SRC = path.join(__dirname, "..", "src");
const Core = require(path.join(SRC, "dossier-core.js"));
const CSS = fs.readFileSync(path.join(SRC, "custom.css"), "utf8");

const CARD_DEFAULT = {
  cardOn: false, cardOpacity: 70, cardFit: "cover",
  cardZoom: 100, cardX: 50, cardY: 50
};

function themeEnv() {
  const dom = new JSDOM(
    "<!doctype html><html><body>" +
    "<div id='customOverlayContent'></div><div id='ui-dialog-body'></div>" +
    "</body></html>",
    { runScripts: "dangerously", url: "http://localhost/" }
  );
  const w = dom.window;
  w.eval(fs.readFileSync(path.join(SRC, "dossier-core.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(SRC, "dossier-theme.js"), "utf8"));
  return w;
}

test("默认设置新增浮窗卡片槽位", () => {
  const d = Core.sanitize(null);
  Object.keys(CARD_DEFAULT).forEach((k) => {
    assert.strictEqual(d.custom[k], CARD_DEFAULT[k], k);
  });
});

test("sanitizeCustom：卡片组逐项夹取并落到步进", () => {
  const c = Core.sanitizeCustom({
    cardOpacity: 120, cardZoom: 10, cardX: -5, cardY: 150, cardFit: "nope"
  });
  assert.strictEqual(c.cardOpacity, 100);
  assert.strictEqual(c.cardZoom, 50);
  assert.strictEqual(c.cardX, 0);
  assert.strictEqual(c.cardY, 100);
  assert.strictEqual(c.cardFit, "cover");
  assert.strictEqual(Core.sanitizeCustom({ cardFit: "fill" }).cardFit, "fill");
});

test("merge：卡片键可以写入，非法值保留原值", () => {
  const base = Core.merge(Core.sanitize(null), { cardOn: true, cardOpacity: 40 });
  assert.strictEqual(base.custom.cardOn, true);
  assert.strictEqual(base.custom.cardOpacity, 40);
  assert.strictEqual(Core.merge(base, { cardOpacity: "x" }).custom.cardOpacity, 40);
  assert.strictEqual(Core.merge(base, { cardOn: "yes" }).custom.cardOn, true);
  // 嵌套写法同样可用
  assert.strictEqual(Core.merge(base, { custom: { cardOpacity: 85 } }).custom.cardOpacity, 85);
});

test("resetCustom：卡片组只复位自己的六项", () => {
  const base = Core.merge(Core.sanitize(null), {
    bgOn: true, bgOpacity: 20, btnOn: true, btnOpacity: 90,
    cardOn: true, cardOpacity: 30, cardZoom: 160, cardX: 10, cardY: 20
  });
  const card = Core.resetCustom(base, "card");
  Object.keys(CARD_DEFAULT).forEach((k) => {
    assert.strictEqual(card.custom[k], CARD_DEFAULT[k], k);
  });
  assert.strictEqual(card.custom.bgOn, true, "背景不归卡片组");
  assert.strictEqual(card.custom.btnOn, true, "按钮不归卡片组");
  const btn = Core.resetCustom(base, "btn");
  assert.strictEqual(btn.custom.cardOn, true, "卡片不归按钮组");
  const all = Core.resetCustom(base, "all");
  assert.strictEqual(all.custom.cardOn, false);
});

test("planVars：卡片不透明度与遮罩都要给出，100% 时不铺遮罩", () => {
  const p = Core.planVars({ cardOpacity: 60 });
  assert.strictEqual(p.md["--mlc-card-op"], "0.6");
  assert.strictEqual(
    p.md["--mlc-card-veil"],
    "color-mix(in srgb, var(--mlc-surface) 40%, transparent)"
  );
  const full = Core.planVars({ cardOpacity: 100 });
  assert.strictEqual(full.md["--mlc-card-veil"], "transparent");
  // 默认值也要在变量表里，关掉卡片时靠 remove 撤掉
  assert.strictEqual(Core.planVars(Core.CUSTOM_DEFAULTS).md["--mlc-card-op"], "0.7");
});

test("appliedSummary：回执如实说出浮窗卡片有没有铺上", () => {
  const on = Core.appliedSummary({ cardOn: true, cardOpacity: 55 }, false, false, true);
  assert.strictEqual(on.card, true);
  assert.ok(on.note.indexOf("浮窗卡片 55%") >= 0, on.note);
  const off = Core.appliedSummary({ cardOn: false }, false, false, true);
  assert.strictEqual(off.card, false);
  assert.ok(off.note.indexOf("已关闭") >= 0, off.note);
  const empty = Core.appliedSummary({ cardOn: true }, false, false, false);
  assert.ok(empty.note.indexOf("还没有图") >= 0, empty.note);
});

test("custom.css：卡片图铺在游戏浮窗上，且不吃掉原有底色", () => {
  // 覆盖 #customOverlayContent 与 #ui-dialog-body 两个真实卡片容器（双 ID 写法）
  assert.match(CSS, /#customOverlayContent#customOverlayContent:not\(:has\(/);
  assert.match(CSS, /#ui-dialog-body#ui-dialog-body:not\(:has\(/);
  // 不抢第三方皮肤：ModLoader GUI 与 CE 面板整条排除（名单沿用 native.css）
  assert.match(CSS, /#customOverlay:not\(\[data-overlay="modloader"\]\)/);
  ["#cheat_extended_options", "#CE_settingsDiv", ".CEtab", ".CEbuttonBar", ".CEDISPLAY", "#mce-root"].forEach((t) => {
    assert.ok(CSS.indexOf(t) >= 0, "CE 排除名单应含 " + t);
  });
  // 图与遮罩层，不写死色值
  assert.match(CSS, /--mlc-card-img/);
  assert.match(CSS, /--mlc-card-veil/);
  assert.match(CSS, /--mlc-card-size/);
  assert.match(CSS, /--mlc-card-pos/);
  /* 原生层给这两个容器写了 background-attachment: fixed；卡片尺寸随弹窗变，
     不改成 scroll 图会按视口固定、位置全偏。手机端原生就是 fixed !important，
     所以这条必须带 !important 才压得住（见 native.css 4262-4268）。 */
  assert.match(CSS, /background-attachment:\s*scroll[,\s]*scroll\s*!important/);
  // 舞台里的样例卡片也要跟着卡片图，预览与真机一致
  assert.match(CSS, /\[data-mlc-stage-card="1"\]\s*\.md-stage-card/);
  assert.match(CSS, /--mlc-stage-card-pos/);
});

test("theme.apply：开关+图都成立才挂 data-mlc-card，关闭后变量撤掉", () => {
  const w = themeEnv();
  const T = w.MapleLanternDossierTheme;
  const img = { url: "data:image/png;base64,AAA", w: 100, h: 60 };

  T.apply({ custom: { cardOn: true, cardOpacity: 60, cardFit: "cover", cardZoom: 120, cardX: 30, cardY: 80 } });
  assert.strictEqual(w.document.documentElement.getAttribute("data-mlc-card"), "off", "有开关没图不能算开");

  T.attach("card", img);
  const root = w.document.documentElement;
  assert.strictEqual(root.getAttribute("data-mlc-card"), "on");
  assert.ok(root.style.getPropertyValue("--mlc-card-img").indexOf(img.url) >= 0);
  assert.strictEqual(root.style.getPropertyValue("--mlc-card-size"), "120% auto");
  assert.strictEqual(root.style.getPropertyValue("--mlc-card-pos"), "30% 80%");

  T.attach("card", img);
  T.apply({ custom: { cardOn: false, cardOpacity: 60 } });
  assert.strictEqual(root.getAttribute("data-mlc-card"), "off");
  assert.strictEqual(root.style.getPropertyValue("--mlc-card-img"), "");
  assert.strictEqual(root.style.getPropertyValue("--mlc-card-size"), "");
  assert.strictEqual(root.style.getPropertyValue("--mlc-card-pos"), "");

  // 拉伸模式用 100% 高，与按钮底纹同一口径
  T.attach("card", img);
  T.apply({ custom: { cardOn: true, cardFit: "fill", cardZoom: 100 } });
  assert.strictEqual(root.style.getPropertyValue("--mlc-card-size"), "100% 100%");
  w.close();
});

test("panel：设置页出现浮窗卡片导入行、两条滑杆与复位按钮", () => {
  const dom = new JSDOM(
    "<!doctype html><html><body>" +
    "<div id='ml-pane-host'><div id='ml-pane'><div class='ml-resets'></div></div></div>" +
    "<div id='ml-tab-settings' aria-selected='true'></div>" +
    "</body></html>",
    { runScripts: "dangerously", url: "http://localhost/" }
  );
  const w = dom.window;
  ["dossier-core.js", "dossier-theme.js", "dossier-assets.js", "dossier-panel.js", "custom.js"].forEach((f) => {
    w.eval(fs.readFileSync(path.join(SRC, f), "utf8"));
  });
  w.MapleLanternDossierPanel.inject();

  const group = w.document.querySelector("[data-mdd-custom='1']");
  assert.ok(group, "设置组应注入");

  const pickRow = group.querySelector("[data-mdd-custom-part='card-buttons']");
  assert.ok(pickRow, "应有浮窗卡片导入/移除行");
  assert.ok(pickRow.textContent.indexOf("浮窗卡片") >= 0, pickRow.textContent);

  const op = group.querySelector('[data-mlc-key="cardOpacity"]');
  const zm = group.querySelector('[data-mlc-key="cardZoom"]');
  assert.ok(op, "卡片不透明度滑杆");
  assert.ok(zm, "卡片缩放滑杆");

  const resets = group.querySelector("[data-mdd-custom-part='resets']");
  assert.ok(resets.textContent.indexOf("浮窗卡片") >= 0, resets.textContent);

  const stage = group.querySelector("#mdStage");
  assert.ok(stage.querySelector(".md-stage-card"), "舞台应有样例卡片");
  assert.strictEqual(stage.getAttribute("data-mlc-stage-card"), "0", "没图时舞台卡片关闭");

  // 拖样例卡片改的是卡片位置，不是按钮位置
  w.MapleLanternDossierPanel.setImage("card", { url: "data:image/png;base64,AAA", w: 200, h: 100 });
  w.MapleLanternCustom.setSettings({ cardOn: true });
  w.MapleLanternDossierPanel.sync();
  assert.strictEqual(stage.getAttribute("data-mlc-stage-card"), "1");
  w.close();
});

/* 手机端级联实证：原生层 ≤899px 用「!important + 双 ID」压 fixed/cover/no-repeat
   （native.css:4262-4268）。卡片规则要赢它，必须自己也是 !important + 双 ID，
   且特异性严格更高。特异性按 Selectors Level 4 算（:not/:has/:is 取内层最大值、
   :where 记 0，属性/类各记 1，id 记 100 位），用两份真实 CSS 的选择器现算。 */
test("移动端对抗：卡片规则的特异性严格高于原生 fixed!important 规则", () => {
  const NATIVE = fs.readFileSync(path.join(SRC, "maplelantern-native.css"), "utf8");

  function splitTop(s) {
    const out = [];
    let depth = 0;
    let cur = "";
    for (const ch of s) {
      if (ch === "(" || ch === "[") depth++;
      if (ch === ")" || ch === "]") depth--;
      if (ch === "," && depth === 0) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function cmp(a, b) {
    for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
    return 0;
  }
  function maxSpec(list) {
    return list.map(spec).reduce((m, x) => (cmp(x, m) > 0 ? x : m), [0, 0, 0]);
  }
  function spec(sel) {
    let res = [0, 0, 0];
    for (let i = 0; i < sel.length; i++) {
      const ch = sel[i];
      if (ch === ":" && /[a-z-]/i.test(sel[i + 1] || "")) {
        let j = i + 1;
        let name = "";
        while (j < sel.length && /[a-z-]/i.test(sel[j])) { name += sel[j]; j++; }
        if (sel[j] === "(") {
          let depth = 0;
          let k = j;
          for (; k < sel.length; k++) {
            if (sel[k] === "(") depth++;
            else if (sel[k] === ")") { depth--; if (depth === 0) break; }
          }
          const inner = sel.slice(j + 1, k);
          if (name === "not" || name === "has" || name === "is") {
            res = add(res, maxSpec(splitTop(inner)));
          } else if (name !== "where") {
            res = add(res, [0, 1, 0]);
          }
          i = k;
          continue;
        }
        res = add(res, [0, 1, 0]);
        i = j - 1;
        continue;
      }
      if (ch === "[") {
        let k = sel.indexOf("]", i);
        if (k < 0) k = sel.length - 1;
        res = add(res, [0, 1, 0]);
        i = k;
        continue;
      }
      if (ch === "#") { res[0]++; continue; }
      if (ch === ".") { res[1]++; continue; }
      if (/[a-z]/i.test(ch) && (i === 0 || /[\s>+~]/.test(sel[i - 1]))) {
        let j = i;
        while (j < sel.length && /[\w-]/.test(sel[j])) j++;
        res[2]++;
        i = j - 1;
      }
    }
    return res;
  }

  const OUR_CONTENT = CSS.match(/html\[data-mlc="on"\]\[data-mlc-card="on"\] #customOverlay:not\(\[data-overlay="modloader"\]\) #customOverlayContent#customOverlayContent:not\(:has\([^)]*\)\)/);
  const OUR_DIALOG = CSS.match(/html\[data-mlc="on"\]\[data-mlc-card="on"\] #ui-dialog-body#ui-dialog-body:not\(:has\([^)]*\)\)/);
  assert.ok(OUR_CONTENT, "应能取到浮窗内容规则");
  assert.ok(OUR_DIALOG, "应能取到对话弹窗规则");

  [["#customOverlayContent", OUR_CONTENT[0]], ["#ui-dialog-body", OUR_DIALOG[0]]].forEach(([id, ours]) => {
    const nativeSel = 'html[data-ml-native="on"] ' + id + id;
    assert.ok(NATIVE.indexOf(nativeSel) >= 0, "原生双 ID 规则应存在：" + nativeSel);
    assert.ok(cmp(spec(ours), spec(nativeSel)) > 0,
      "卡片规则特异性必须更高：" + JSON.stringify(spec(ours)) + " vs " + JSON.stringify(spec(nativeSel)) + "（" + ours + "）");
  });

  // 原生手机端确实用 !important 锁死这三条（基线变化就要重核本条）
  const nativeBlock = NATIVE.match(/@media \(max-width: 899px\)[\s\S]*?#ui-dialog-body#ui-dialog-body \{[\s\S]*?\}/);
  assert.ok(nativeBlock, "应能取到原生手机端块");
  assert.match(nativeBlock[0], /background-attachment:\s*fixed\s*!important/);

  // 卡片规则里这几条同样带 !important，否则同特异性下会输给原生基线块
  const blocks = CSS.match(/html\[data-mlc="on"\]\[data-mlc-card="on"\][^{]*\{[\s\S]*?\}/g) || [];
  assert.strictEqual(blocks.length, 2, "应与两条容器规则各占一块");
  blocks.forEach((body) => {
    ["background-size", "background-position", "background-repeat", "background-attachment"].forEach((prop) => {
      const re = new RegExp(prop + ":\\s*[^;]*!important");
      assert.match(body, re, prop + " 需 !important");
    });
  });
});
