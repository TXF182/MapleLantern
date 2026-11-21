/* ============================================================================
 * 灯台 · 外观 / MapleLanternDossier — theme.js
 * 把玩家自定义的变量落到页面上：本包自己的 --mlc-*（只影响灯台自定义层），
 * 以及可选的 --mln-* 同步（影响整个灯台主题）。
 *
 * 硬规矩（“不改 MapleLantern”这条线的执行方式）：
 *   1. 只往 documentElement 写内联变量，不碰它的任何文件、不覆盖它的对象；
 *   2. 写 --mln-* 之前先记快照，撤的时候逐项 removeProperty —— 不做
 *      “整段 style 覆盖”，否则关掉本包会留下改不回去的颜色；
 *   3. 图片以 data: URL 承载（DoL CSP 只允许 img-src 'self' data:），替换/删除/卸载时由 Assets 释放缓存。
 * ========================================================================== */
(function (root) {
  "use strict";

  var Core = root.MapleLanternDossierCore;
  if (!Core) return;
  if (root.MapleLanternDossierTheme && root.MapleLanternDossierTheme.__ready) return;

  var doc = root.document;
  var ML_VARS = [
    "--mln-accent", "--mln-surface", "--mln-surface-2", "--mln-surface-3",
    "--mln-text", "--mln-muted", "--mln-faint", "--mln-border", "--mln-border-strong"
  ];

  var state = {
    settings: null,
    bg: null,     // { url, w, h }
    btn: null,    // { url, w, h }
    card: null,   // { url, w, h } —— 游戏原生浮窗/弹窗底图
    mlSnapshot: {},
    applied: [],
    resizeBound: false,
    timer: 0
  };

  function el() {
    return doc && doc.documentElement;
  }

  function setVar(name, value) {
    var e = el();
    if (!e || !e.style) return;
    e.style.setProperty(name, value);
    if (state.applied.indexOf(name) < 0) state.applied.push(name);
  }

  function dropVar(name) {
    var e = el();
    if (!e || !e.style) return;
    e.style.removeProperty(name);
    var i = state.applied.indexOf(name);
    if (i >= 0) state.applied.splice(i, 1);
  }

  function snapshotMl() {
    var e = el();
    if (!e || !e.style) return;
    var snap = {};
    for (var i = 0; i < ML_VARS.length; i++) {
      var v = ML_VARS[i];
      snap[v] = e.style.getPropertyValue(v) || "";
    }
    state.mlSnapshot = snap;
  }

  function restoreMl() {
    var e = el();
    if (!e || !e.style) return;
    for (var i = 0; i < ML_VARS.length; i++) {
      var v = ML_VARS[i];
      e.style.removeProperty(v);
      if (v in state.mlSnapshot && state.mlSnapshot[v]) e.style.setProperty(v, state.mlSnapshot[v]);
    }
    state.mlSnapshot = {};
  }

  /* -------------------------------------------------------------------------
   * 背景尺寸：真页面与预览共用 Core.computeBackgroundSize
   * ---------------------------------------------------------------------- */

  function bgBox() {
    var e = doc.getElementById("mlc-bg");
    if (e) {
      var r = e.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return { w: r.width, h: r.height };
    }
    return {
      w: root.innerWidth || (el() ? el().clientWidth : 0),
      h: root.innerHeight || (el() ? el().clientHeight : 0)
    };
  }

  function applyBackgroundGeometry() {
    var s = state.settings && state.settings.custom;
    if (!s) return;
    var box = bgBox();
    var size;
    if (state.bg && state.bg.w > 0) {
      size = Core.computeBackgroundSize(state.bg.w, state.bg.h, box.w, box.h, s.bgFit, s.bgZoom);
    } else {
      size = { w: box.w, h: box.h };
    }
    setVar("--mlc-bg-size", (size.w > 0 ? size.w + "px " + size.h + "px" : "cover"));
    setVar("--mlc-bg-pos", s.bgX + "% " + s.bgY + "%");
  }

  function scheduleGeometry() {
    if (state.timer) return;
    state.timer = root.setTimeout(function () {
      state.timer = 0;
      applyBackgroundGeometry();
    }, 150);
  }

  function bindResize() {
    if (state.resizeBound) return;
    state.resizeBound = true;
    root.addEventListener("resize", scheduleGeometry, { passive: true });
  }

  /* -------------------------------------------------------------------------
   * 对外
   * ---------------------------------------------------------------------- */

  function ensureLayer() {
    var e = doc.getElementById("mlc-bg");
    if (e) return e;
    if (!doc.body) return null;
    var d = doc.createElement("div");
    d.id = "mlc-bg";
    d.setAttribute("aria-hidden", "true");
    doc.body.insertBefore(d, doc.body.firstChild);
    return d;
  }

  function apply(settings) {
    var s = Core.sanitize(settings);
    state.settings = s;
    ensureLayer();
    var plan = Core.planVars(s.custom);

    Object.keys(plan.md).forEach(function (k) { setVar(k, plan.md[k]); });
    plan.remove.forEach(dropVar);

    if (plan.ml && Object.keys(plan.ml).length) {
      if (!Object.keys(state.mlSnapshot).length) snapshotMl();
      Object.keys(plan.ml).forEach(function (k) { setVar(k, plan.ml[k]); });
    } else if (Object.keys(state.mlSnapshot).length) {
      restoreMl();
    }

    var e = el();
    if (e) {
      // 模块本身常驻启用：设置页的舞台/控件与变量块都挂在这一个属性上。
      // 图层是否真的铺，另由 data-mlc-bg / data-mlc-btn 表示（都要“开关 + 有图”才成立）。
      e.setAttribute("data-mlc", "on");
      e.setAttribute("data-mlc-bg", s.custom.bgOn && state.bg ? "on" : "off");
      e.setAttribute("data-mlc-btn", s.custom.btnOn && state.btn ? "on" : "off");
      e.setAttribute("data-mlc-card", s.custom.cardOn && state.card ? "on" : "off");
    }

    if (state.bg && s.custom.bgOn) setVar("--mlc-bg-img", 'url("' + state.bg.url + '")');
    else { dropVar("--mlc-bg-img"); }
    if (state.btn && s.custom.btnOn && state.btn) {
      setVar("--mlc-btn-img", 'url("' + state.btn.url + '")');
      setVar("--mlc-btn-size", s.custom.btnFit === "fill"
        ? s.custom.btnZoom + "% 100%"
        : s.custom.btnZoom + "% auto");
      setVar("--mlc-btn-pos", s.custom.btnX + "% " + s.custom.btnY + "%");
    } else {
      dropVar("--mlc-btn-img");
      dropVar("--mlc-btn-size");
      dropVar("--mlc-btn-pos");
    }

    /* 浮窗卡片：与按钮底纹同一套尺寸口径（不依赖卡片盒子的实时尺寸，
       原生弹窗宽度随内容跳变，按盒子算会在每次开合时抖）。 */
    if (state.card && s.custom.cardOn) {
      setVar("--mlc-card-img", 'url("' + state.card.url + '")');
      setVar("--mlc-card-size", s.custom.cardFit === "fill"
        ? s.custom.cardZoom + "% 100%"
        : s.custom.cardZoom + "% auto");
      setVar("--mlc-card-pos", s.custom.cardX + "% " + s.custom.cardY + "%");
    } else {
      dropVar("--mlc-card-img");
      dropVar("--mlc-card-size");
      dropVar("--mlc-card-pos");
    }

    applyBackgroundGeometry();
    bindResize();
  }

  function hasColors(custom) {
    var c = custom && custom.colors;
    if (!c) return false;
    return !!(c.accent || c.surface || c.text || c.line);
  }

  /** kind: "bg" | "btn" | "card"; img: { url, w, h } | null */
  function attach(kind, img) {
    if (kind === "bg") state.bg = img || null;
    else if (kind === "card") state.card = img || null;
    else state.btn = img || null;
    if (state.settings) apply(state.settings);
  }

  function destroy() {
    state.applied.slice().forEach(dropVar);
    restoreMl();
    if (state.timer) { root.clearTimeout(state.timer); state.timer = 0; }
    if (state.resizeBound) {
      root.removeEventListener("resize", scheduleGeometry);
      state.resizeBound = false;
    }
    var e = el();
    if (e) {
      e.removeAttribute("data-mlc");
      e.removeAttribute("data-mlc-bg");
      e.removeAttribute("data-mlc-btn");
      e.removeAttribute("data-mlc-card");
    }
    var layer = doc.getElementById("mlc-bg");
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    state.settings = null;
    state.bg = null;
    state.btn = null;
    state.card = null;
  }

  root.MapleLanternDossierTheme = {
    __ready: true,
    ML_VARS: ML_VARS,
    apply: apply,
    attach: attach,
    destroy: destroy,
    bgBox: bgBox,
    applyBackgroundGeometry: applyBackgroundGeometry,
    state: state
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
