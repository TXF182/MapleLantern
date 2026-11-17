/* ============================================================================
 * 灯台 · 自定义外观 / MapleLantern 1.4.3 — panel.js
 * 把「灯台外观」整组控件注入灯台设置页（#ml-pane），含实时预览舞台。
 *
 * 设计要点：
 *   1. 全部复用灯台自己的类（.ml-field / .ml-seg / .ml-slider / .ml-switch /
 *      .ml-btn），所以它跟着灯台当前主题上色，本包不额外画一套视觉语言。
 *   2. 预览与真页面共用 Core.computeBackgroundSize / Core.dragToPosition，
 *      不是“大概像”，是同一套算式换了个盒子尺寸。
 *   3. 灯台每次切页签会重建 #ml-pane，所以控件是“发现没有就重建”，
 *      不缓存 DOM 引用（旧引用一定失效）。
 * ========================================================================== */
(function (root) {
  "use strict";

  var Core = root.MapleLanternDossierCore;
  var Theme = root.MapleLanternDossierTheme;
  var Assets = root.MapleLanternDossierAssets;
  if (!Core || !Theme || !Assets) return;
  if (root.MapleLanternDossierPanel && root.MapleLanternDossierPanel.__ready) return;

  var doc = root.document;
  var MARK = "data-mdd-custom";
  var MARK_ATTR = "data-mdd-custom-part";

  var observer = null;
  var timer = 0;
  var ui = null;              // 当前注入的控件组
  var img = { bg: null, btn: null, card: null };  // { url, w, h, bytes, type }
  /* 三种可导入的图：显示名 + 对应的开关键。加新槽位只改这两张表，
     剩下分支一律走这里，避免再散落一串 kind==="bg" ? ... : ... */
  var KINDS = ["bg", "btn", "card"];
  var KIND_LABEL = { bg: "背景", btn: "按钮底纹", card: "浮窗卡片" };
  var KIND_ON = { bg: "bgOn", btn: "btnOn", card: "cardOn" };
  var draft = null;           // 拖动 / 滑杆过程中的临时设置
  var pending = null;         // 待提交的补丁
  var drag = null;
  var loadingNote = "";
  var HINT_DEFAULT = "拖动画面里的图可调位置 · 双击可居中";
  var hintTimer = 0;

  /** 舞台底部那行提示：临时换成操作反馈，2.6 s 后自己回默认文案。 */
  function flashHint(text) {
    var h = ui && ui.stage && ui.stage.__hint;
    if (!h) return;
    h.textContent = text;
    h.classList.add("is-warn");
    if (hintTimer) root.clearTimeout(hintTimer);
    hintTimer = root.setTimeout(function () {
      hintTimer = 0;
      if (!h.parentNode) return;
      h.textContent = HINT_DEFAULT;
      h.classList.remove("is-warn");
    }, 2600);
  }

  function safeStorage() {
    try { return root.localStorage; } catch (e) { return null; }
  }

  function api() { return root.MapleLanternCustom; }

  function current() {
    var a = api();
    if (a && typeof a.getSettings === "function") return a.getSettings();
    return Core.readSettings(safeStorage());
  }

  /* -------------------------------------------------------------------------
   * 应用 / 提交
   * ---------------------------------------------------------------------- */

  function merged(patch) {
    return Core.merge(draft || current(), patch);
  }

  /** 拖动、滑杆过程中只改内存：立刻生效，但不写 localStorage、不重建控件。 */
  function live(patch) {
    draft = merged(patch);
    pending = pending || {};
    Object.keys(patch).forEach(function (k) { pending[k] = patch[k]; });
    Theme.apply(draft);
    paintStage();
    paintReadouts();
    paintPos();
  }

  /** 松手 / 键盘步进 / 点选：一次落到设置里（会持久化并触发全量重绘）。 */
  function commit(patch) {
    var p = patch || pending || {};
    draft = null;
    pending = null;
    var a = api();
    if (a && typeof a.setSettings === "function") {
      a.setSettings(p);
    } else {
      var s = Core.merge(Core.readSettings(safeStorage()), p);
      Core.writeSettings(safeStorage(), s);
      Theme.apply(s);
    }
    sync();
  }

  /* -------------------------------------------------------------------------
   * 控件构件（沿用灯台类名）
   * ---------------------------------------------------------------------- */

  function el(tag, cls, attrs) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  function field(title, control, part) {
    var box = el("div", "ml-field");
    if (part) box.setAttribute(MARK_ATTR, part);
    var k = el("div", "ml-field-k");
    k.textContent = title;
    box.appendChild(k);
    box.appendChild(control);
    return box;
  }

  function note(text, part) {
    var p = el("p", "ml-note is-faint");
    if (part) p.setAttribute(MARK_ATTR, part);
    p.textContent = text;
    return p;
  }

  function seg(options, value, onPick, part) {
    var group = el("div", "ml-seg", { role: "radiogroup" });
    group.setAttribute(MARK_ATTR, part || "seg");
    options.forEach(function (opt) {
      var btn = el("button", "ml-seg-btn", { type: "button", role: "radio", "data-value": opt.value });
      btn.textContent = opt.label;
      btn.setAttribute("aria-checked", value === opt.value ? "true" : "false");
      btn.addEventListener("click", function () {
        Array.prototype.forEach.call(group.children, function (b) {
          b.setAttribute("aria-checked", b.getAttribute("data-value") === opt.value ? "true" : "false");
        });
        onPick(opt.value);
      });
      group.appendChild(btn);
    });
    return group;
  }

  /** 与灯台 .ml-slider 同构；差别只在松手才写盘。 */
  function slider(key, min, max, step, label, format) {
    var wrap = el("div", "ml-scale");
    var track = el("div", "ml-track");
    var fill = el("div", "ml-fill");
    var thumb = el("div", "ml-thumb");
    track.appendChild(fill);
    track.appendChild(thumb);
    var bar = el("div", "ml-slider", {
      role: "slider", tabindex: "0",
      "aria-valuemin": String(min), "aria-valuemax": String(max),
      "aria-label": label
    });
    bar.setAttribute("data-mlc-key", key);
    bar.appendChild(track);
    var out = el("output", "ml-range-out");
    wrap.appendChild(bar);
    wrap.appendChild(out);

    function value() {
      var s = draft || current();
      return s.custom[key];
    }

    function paint() {
      var v = value();
      var pct = (v - min) / (max - min) * 100;
      fill.style.width = pct + "%";
      thumb.style.left = pct + "%";
      bar.setAttribute("aria-valuenow", String(v));
      bar.setAttribute("aria-valuetext", format(v));
      out.textContent = format(v);
    }

    function fromX(clientX) {
      var r = track.getBoundingClientRect();
      var p = r.width ? (clientX - r.left) / r.width : 0;
      return Core.clampStep(min + Math.max(0, Math.min(1, p)) * (max - min), min, max, step, value());
    }

    var patch = {};
    patch[key] = 0;

    function set(v, persist) {
      var next = Core.clampStep(v, min, max, step, value());
      patch[key] = next;
      if (persist) commit(patch);
      else live(patch);
      paint();
    }

    bar.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      try { bar.focus(); } catch (e) { /* ignore */ }
      set(fromX(ev.clientX), false);
      var move = function (e) { set(fromX(e.clientX), false); };
      var up = function () {
        doc.removeEventListener("pointermove", move);
        doc.removeEventListener("pointerup", up);
        commit(patch);
      };
      doc.addEventListener("pointermove", move);
      doc.addEventListener("pointerup", up);
    });

    bar.addEventListener("keydown", function (ev) {
      var stp = ev.shiftKey ? Math.max(step, 10) : step;
      if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { set(value() + stp, true); ev.preventDefault(); }
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { set(value() - stp, true); ev.preventDefault(); }
      else if (ev.key === "Home") { set(min, true); ev.preventDefault(); }
      else if (ev.key === "End") { set(max, true); ev.preventDefault(); }
    });

    paint();
    return { node: field(label, wrap, "slider-" + key), paint: paint };
  }

  function switchControl(key, label, hintText) {
    var wrap = el("div", "ml-switch-wrap");
    var sw = el("button", "ml-switch", { type: "button", role: "switch", "aria-label": label });
    var knob = el("span", "ml-knob", { "aria-hidden": "true" });
    sw.appendChild(knob);
    var s = current();
    sw.setAttribute("aria-checked", s.custom[key] ? "true" : "false");
    sw.addEventListener("click", function () {
      var next = !current().custom[key];
      sw.setAttribute("aria-checked", next ? "true" : "false");
      commit(one(key, next));
    });
    wrap.appendChild(sw);
    var box = field(label, wrap, "switch-" + key);
    return { node: box, hint: hintText ? note(hintText) : null, paint: function () {
      sw.setAttribute("aria-checked", current().custom[key] ? "true" : "false");
    } };
  }

  function one(key, value) {
    var p = {};
    p[key] = value;
    return p;
  }

  /* -------------------------------------------------------------------------
   * 预览舞台
   * ---------------------------------------------------------------------- */

  function buildStage() {
    var stage = el("div", "md-stage", { id: "mdStage", "aria-label": "灯台外观预览" });
    stage.setAttribute(MARK_ATTR, "stage");
    var bg = el("div", "md-stage-bg");
    bg.setAttribute("aria-hidden", "true");
    stage.appendChild(bg);

    var body = el("div", "md-stage-body");
    var title = el("div", "md-stage-title");
    title.textContent = "预览 · 与游戏内同比例";
    body.appendChild(title);

    ["你站在家门口，屋里传来孩子的动静。门缝里透出一点灯光，厨房的水声还在响。",
     "街上安静得反常，只有远处传来收摊的铁器声。"].forEach(function (line) {
      var para = el("p", "md-stage-p");
      para.textContent = line;
      body.appendChild(para);
    });

    ["01 走进浴室", "02 翻开日记"].forEach(function (label, i) {
      var opt = el("div", "md-stage-opt", { "data-mlc-stage-opt": String(i) });
      var no = el("span", "md-stage-no");
      no.textContent = label.slice(0, 2);
      var tx = el("span", "md-stage-tx");
      tx.textContent = label.slice(3);
      opt.appendChild(no);
      opt.appendChild(tx);
      body.appendChild(opt);
    });

    var card = el("div", "md-stage-card");
    var rail = el("div", "md-stage-rail");
    var no2 = el("span", "md-stage-no");
    no2.textContent = "CH-01";
    rail.appendChild(no2);
    var cbody = el("div", "md-stage-cbody");
    var name = el("div", "md-stage-name");
    name.textContent = "样例页面";
    var meta = el("div", "md-stage-meta");
    meta.textContent = "体型 · 发色 · 互动次数";
    cbody.appendChild(name);
    cbody.appendChild(meta);
    card.appendChild(rail);
    card.appendChild(cbody);
    body.appendChild(card);

    var hint = el("div", "md-stage-hint");
    hint.textContent = HINT_DEFAULT;
    body.appendChild(hint);
    stage.appendChild(body);
    stage.__hint = hint;

    stage.addEventListener("pointerdown", onStageDown);
    stage.addEventListener("dblclick", function (ev) {
      var opt = ev.target && ev.target.closest && ev.target.closest("[data-mlc-stage-opt]");
      var cardHit = ev.target && ev.target.closest && ev.target.closest(".md-stage-card");
      var kind = opt ? "btn" : (cardHit ? "card" : "bg");
      if (!stageAllowed(kind)) return;
      var p = {};
      var key = kind === "bg" ? "bg" : (kind === "card" ? "card" : "btn");
      p[key + "X"] = 50; p[key + "Y"] = 50;
      commit(p);
      flashHint(KIND_LABEL[kind] + "已居中 50% / 50%");
    });
    return stage;
  }

  function stageInfo(kind) {
    var s = draft || current();
    var c = s.custom;
    if (kind === "bg") {
      if (!img.bg) return null;
      var st = ui && ui.stage;
      if (!st) return null;
      var r = st.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      var size = Core.computeBackgroundSize(img.bg.w, img.bg.h, r.width, r.height, c.bgFit, c.bgZoom);
      return {
        boxW: r.width, boxH: r.height, bgW: size.w, bgH: size.h,
        x: c.bgX, y: c.bgY,
        patch: function (o) { return { bgX: o.x, bgY: o.y }; }
      };
    }
    if (kind === "card") {
      if (!img.card) return null;
      var cb = ui && ui.stage ? ui.stage.querySelector(".md-stage-card") : null;
      if (!cb) return null;
      var cr = cb.getBoundingClientRect();
      if (!cr.width || !cr.height) return null;
      /* 历史档里 meta 可能缺 w/h（旧图库/手工塞图）：缺就按 3:2 估，
         别让 h/w 除出 Infinity 把拖动余量算成无穷大、位置写成 NaN。 */
      var car = (img.card.w > 0 && img.card.h > 0) ? img.card.h / img.card.w : 0.6;
      var csw = cr.width * c.cardZoom / 100;
      var csh = c.cardFit === "fill"
        ? cr.height * c.cardZoom / 100
        : csw * car;
      return {
        boxW: cr.width, boxH: cr.height, bgW: csw, bgH: csh,
        x: c.cardX, y: c.cardY,
        patch: function (o) { return { cardX: o.x, cardY: o.y }; }
      };
    }
    if (!img.btn) return null;
    var opt = ui && ui.stage ? ui.stage.querySelector("[data-mlc-stage-opt='0']") : null;
    if (!opt) return null;
    var or = opt.getBoundingClientRect();
    if (!or.width || !or.height) return null;
    var sw = or.width * c.btnZoom / 100;
    var bar = (img.btn.w > 0 && img.btn.h > 0) ? img.btn.h / img.btn.w : 0.6;
    var sh = c.btnFit === "fill"
      ? or.height * c.btnZoom / 100
      : sw * bar;
    return {
      boxW: or.width, boxH: or.height, bgW: sw, bgH: sh,
      x: c.btnX, y: c.btnY,
      patch: function (o) { return { btnX: o.x, btnY: o.y }; }
    };
  }

  function stageAllowed(kind) {
    var s = draft || current();
    if (kind === "bg") return !!(s.custom.bgOn && img.bg);
    if (kind === "card") return !!(s.custom.cardOn && img.card);
    return !!(s.custom.btnOn && img.btn);
  }

  function onStageDown(ev) {
    var stage = ui && ui.stage;
    if (!stage) return;
    var target = ev.target;
    /* 舞台里样例选项只调按钮底纹、样例卡片只调浮窗卡片位置；拖其余位置调背景。 */
    var optHit = target && target.closest && target.closest("[data-mlc-stage-opt]");
    var cardHit = target && target.closest && target.closest(".md-stage-card");
    var kind = optHit ? "btn" : (cardHit ? "card" : "bg");
    if (!stageAllowed(kind)) {
      flashHint(kind === "bg"
        ? "先在下面导入背景图（或把背景开关打开）再拖"
        : "先在下面导入「" + KIND_LABEL[kind] + "」（或把开关打开）再拖");
      return;
    }
    var info = stageInfo(kind);
    if (!info) return;
    /* 图比盒子还小 → 任何一个方向都没有可移动余量，拖了也不会动；
     * 这时给一句能直接照做的提示，别让玩家对着死界面反复拖。 */
    if (info.bgW <= info.boxW + 1 && info.bgH <= info.boxH + 1) {
      flashHint(kind === "bg"
        ? "图已经装得比画面小，没有可移动余量：先把「背景缩放」调大"
        : KIND_LABEL[kind] + "底纹比盒子还小，先把缩放调大");
      return;
    }
    drag = {
      kind: kind,
      info: info,
      x0: ev.clientX,
      y0: ev.clientY,
      x: info.x,
      y: info.y
    };
    if (stage.setPointerCapture) {
      try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    }
    stage.setAttribute("data-mlc-drag", kind);
    ev.preventDefault();
    doc.addEventListener("pointermove", onStageMove);
    doc.addEventListener("pointerup", onStageUp);
    doc.addEventListener("pointercancel", onStageUp);
  }

  function onStageMove(ev) {
    if (!drag) return;
    var o = Core.dragToPosition({
      dx: ev.clientX - drag.x0,
      dy: ev.clientY - drag.y0,
      boxW: drag.info.boxW,
      boxH: drag.info.boxH,
      bgW: drag.info.bgW,
      bgH: drag.info.bgH,
      x: drag.x,
      y: drag.y
    });
    drag.last = o;
    live(drag.info.patch(o));
  }

  function onStageUp() {
    if (!drag) return;
    doc.removeEventListener("pointermove", onStageMove);
    doc.removeEventListener("pointerup", onStageUp);
    doc.removeEventListener("pointercancel", onStageUp);
    if (ui && ui.stage) ui.stage.removeAttribute("data-mlc-drag");
    var last = drag.last;
    drag = null;
    if (last) commit(pending || {});
    else { draft = null; pending = null; sync(); }
  }

  function paintStage() {
    var st = ui && ui.stage;
    if (!st) return;
    var s = draft || current();
    var c = s.custom;
    var vw = root.innerWidth || 390;
    var vh = root.innerHeight || 844;
    /* 舞台按“当前视口比例”摆，但高度受面板与视口双重约束：
     * 先按可用宽度反推高度，再压到 46% 视口高、最低 240 最高 420，最后按比例回算宽度。
     * 比例必须与真机一致：预览框如果和自己的屏幕比例不同，玩家拖出来的位置到游戏里就是偏的。
     * 代价是窄屏上舞台必然偏窄（320 屏 = 147×261），命中区靠下面的缩放/位置滑杆补精度。 */
    var host = st.parentNode;
    var cw = (host && host.clientWidth) || 340;
    var cs = root.getComputedStyle ? root.getComputedStyle(host) : null;
    if (cs) cw -= (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    cw = Math.max(150, cw);
    var cap = Math.min(Math.max(240, vh * 0.46), 420);
    var h = Math.min(cap, cw * vh / vw);
    var w = h * vw / vh;
    if (w > cw) { w = cw; h = w * vh / vw; }
    st.style.width = Math.round(w) + "px";
    st.style.height = Math.round(h) + "px";
    st.style.setProperty("--mlc-stage-ar", vw + " / " + vh);
    st.setAttribute("data-mlc-bg", c.bgOn && img.bg ? "1" : "0");
    st.setAttribute("data-mlc-btn", c.btnOn && img.btn ? "1" : "0");
    st.setAttribute("data-mlc-stage-card", c.cardOn && img.card ? "1" : "0");
    st.style.setProperty("--mlc-stage-pos", c.bgX + "% " + c.bgY + "%");
    st.style.setProperty("--mlc-stage-btn-pos", c.btnX + "% " + c.btnY + "%");
    st.style.setProperty("--mlc-stage-btn-size", c.btnFit === "fill"
      ? c.btnZoom + "% 100%"
      : c.btnZoom + "% auto");
    st.style.setProperty("--mlc-stage-card-pos", c.cardX + "% " + c.cardY + "%");
    st.style.setProperty("--mlc-stage-card-size", c.cardFit === "fill"
      ? c.cardZoom + "% 100%"
      : c.cardZoom + "% auto");

    var r = st.getBoundingClientRect();
    if (img.bg && r.width && r.height) {
      var size = Core.computeBackgroundSize(img.bg.w, img.bg.h, r.width, r.height, c.bgFit, c.bgZoom);
      st.style.setProperty("--mlc-stage-size", size.w + "px " + size.h + "px");
      st.setAttribute("data-mlc-movable", (size.w > r.width + 1 || size.h > r.height + 1) ? "1" : "0");
    } else {
      st.style.removeProperty("--mlc-stage-size");
      st.setAttribute("data-mlc-movable", "0");
    }
  }

  /* -------------------------------------------------------------------------
   * 导入 / 移除
   * ---------------------------------------------------------------------- */

  function pickFile(kind) {
    var input = el("input", "", { type: "file", accept: "image/*" });
    input.style.position = "fixed";
    input.style.left = "-9999px";
    doc.body.appendChild(input);
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (input.parentNode) input.parentNode.removeChild(input);
      if (file) ingest(kind, file);
    });
    try { input.click(); } catch (e) {
      loadingNote = "这个浏览器不让脚本点开文件框，请用下面的“选择图片”按钮";
      sync();
    }
  }

  function setNote(text) {
    loadingNote = text;
    if (ui && ui.note[0]) ui.note[0].textContent = text;
  }

  /** 记下图（来源可以是导入、IDB 回读，或外部直接塞进来的预览图） */
  function setImage(kind, info) {
    /* 换图时不在这里 release：Assets 内部按 blob 缓存 data: URL 编码结果，
     * 面板侧再 release 一次会把刚编码好的串丢掉，下一帧只能重新编码。 */
    img[kind] = info
      ? { url: info.url, w: info.w || 0, h: info.h || 0, bytes: info.bytes || 0, type: info.type || "" }
      : null;
    if (!info) Assets.release(kind);
    Theme.attach(kind, img[kind]);
    paintStage();
    paintPicks();
    paintPos();
  }

  function ingest(kind, file) {
    setNote("正在处理图片…");
    Assets.process(file).then(function (rec) {
      return Assets.save(kind, rec.blob, {
        w: rec.w, h: rec.h, bytes: rec.bytes, type: rec.type, at: Date.now()
      }).then(function (ok) { return { rec: rec, ok: ok }; });
    }).then(function (res) {
      var rec = res.rec;
      return Assets.dataUrlFor(kind, rec.blob).then(function (url) {
      setImage(kind, {
        url: url,
        w: rec.w,
        h: rec.h,
        bytes: rec.bytes,
        type: rec.type
      });
      setNote(KIND_LABEL[kind] + "已更新 · " + rec.w + "×" + rec.h + " · " + Core.formatBytes(rec.bytes) +
        (res.ok ? "" : "（浏览器不让存，本次会话有效）") + warnHint(rec, kind));
      var p = {};
      p[KIND_ON[kind]] = true;
      var extraNote = "";
      if (kind === "bg") {
        /* 灯台面板底板默认 92% 不透明：图铺在下面，屏幕上却几乎没变化。
         * 开背景时把面板一起调透，玩家第一眼就能看见自己的图，滑杆再自行微调。
         * 背景不透明度低于 80 同理（暗色图会被同色遮罩洗没），一起交给 alignForBackground。 */
        var cur = current();
        var fix = Core.alignForBackground(cur && cur.custom ? cur.custom : {});
        if (typeof fix.surfaceAlpha === "number") {
          p.surfaceAlpha = fix.surfaceAlpha;
          extraNote += " · 面板遮蔽已顺带调到 " + fix.surfaceAlpha + "%，不然背景透不出来";
        }
        if (typeof fix.bgOpacity === "number") {
          p.bgOpacity = fix.bgOpacity;
          extraNote += " · 背景不透明度已调到 " + fix.bgOpacity + "%";
        }
      }
      commit(p);
      if (extraNote) setNote(KIND_LABEL[kind] + "已更新 · " + rec.w + "×" + rec.h +
        " · " + Core.formatBytes(rec.bytes) + (res.ok ? "" : "（浏览器不让存，本次会话有效）") +
        warnHint(rec, kind) + extraNote);
      });
    }).catch(function (e) {
      setNote((e && e.message) || "导入失败");
    });
  }

  /**
   * 导入后的软提示（不拒绝，只提醒）：原图太小会糊、比例太极端铺满会裁掉大半。
   * 依据实测矩阵：1×1 PNG 与 4000×3000 都能导入，拦下来反而是坏体验。
   */
  function warnHint(rec, kind) {
    var srcLong = Math.max(rec.srcW || rec.w || 0, rec.srcH || rec.h || 0);
    if (srcLong && srcLong < 200) return " · 原图只有 " + srcLong + " px，铺满会糊，建议换 ≥1200 px 的";
    var w = rec.w || 0;
    var h = rec.h || 0;
    if (w && h && (h / w > 3 || w / h > 3)) {
      return kind === "bg"
        ? " · 比例很极端，铺满会裁掉大半，建议选“完整”"
        : (kind === "card" ? " · 比例很极端，卡片底图会被压扁" : " · 比例很极端，底纹会被压扁");
    }
    return "";
  }

  function removeImage(kind) {
    setImage(kind, null);
    Assets.drop(kind);
    setNote(KIND_LABEL[kind] + "已移除");
    var p = {};
    p[KIND_ON[kind]] = false;
    commit(p);
  }

  /* -------------------------------------------------------------------------
   * 「应用背景」
   *
   * 导入只是把图存进图库并挂变量；玩家有时会看不到变化（面板还挡着、或图层没重绘）。
   * 这个按钮做三件事：从图库把两张图重新取出来重建 objectURL、整份设置重放、
   * 读一次 body 布局强制同步重排，然后把实际状态写进提示行。
   * ---------------------------------------------------------------------- */

  function applyBackground() {
    setNote("正在应用背景…");
    var jobs = KINDS.map(function (kind) {
      return Assets.load(kind).then(function (rec) {
        if (!rec || !rec.blob) return false;
        return Assets.dataUrlFor(kind, rec.blob).then(function (url) {
          setImage(kind, {
            url: url,
            w: (rec.meta && rec.meta.w) || 0,
            h: (rec.meta && rec.meta.h) || 0,
            bytes: (rec.meta && rec.meta.bytes) || rec.blob.size,
            type: (rec.meta && rec.meta.type) || ""
          });
          return true;
        });
      }, function () { return false; });
    });
    Promise.all(jobs).then(function () {
      /* 「应用背景」也走一次 alignForBackground：玩家可能之前把不透明度拖到 45 就关了面板，
         再点应用时如果不纠，图还是被遮罩洗掉，等于没应用。 */
      var pre = current();
      var fix = Core.alignForBackground(pre && pre.custom ? pre.custom : {});
      if (Object.keys(fix).length) commit(fix);
      var s = current();
      Theme.apply(s);
      /* 切过标签页或面板滚出视口后，fixed 图层可能不重绘；读一次布局逼它同步重排 */
      if (doc.body) void doc.body.offsetHeight;
      var sum = Core.appliedSummary(s.custom, !!img.bg, !!img.btn, !!img.card);
      setNote(sum.note);
      paintStage();
      paintPicks();
      paintPos();
    }).then(null, function (e) {
      setNote((e && e.message) || "应用失败");
    });
  }

  var loaded = { bg: false, btn: false, card: false };

  function loadImages() {
    KINDS.forEach(function (kind) {
      if (loaded[kind]) return;
      loaded[kind] = true;
      Assets.load(kind).then(function (rec) {
        if (!rec || !rec.blob) return;
        Assets.dataUrlFor(kind, rec.blob).then(function (url) {
          setImage(kind, {
            url: url,
            w: (rec.meta && rec.meta.w) || 0,
            h: (rec.meta && rec.meta.h) || 0,
            bytes: (rec.meta && rec.meta.bytes) || rec.blob.size,
            type: (rec.meta && rec.meta.type) || ""
          });
        }, function () { /* 编码失败就保持原样，不清空已有图 */ });
      });
    });
  }

  /* -------------------------------------------------------------------------
   * 颜色
   * ---------------------------------------------------------------------- */

  var COLOR_ROWS = [
    { key: "accent", label: "强调色", css: "--mlc-accent" },
    { key: "surface", label: "面板", css: "--mlc-surface" },
    { key: "text", label: "正文", css: "--mlc-text" },
    { key: "line", label: "描边", css: "--mlc-line" }
  ];

  function cssColorToHex(v) {
    var s = String(v || "").trim();
    if (Core.isHexColor(s)) return Core.normalizeHex(s);
    var m = s.match(/^rgb\((\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/i) ||
      s.match(/^rgba\((\d+)\s*,?\s*(\d+)\s*,?\s*(\d+)/i);
    if (!m) return "";
    var hex = "#" + [1, 2, 3].map(function (i) {
      return ("0" + Number(m[i]).toString(16)).slice(-2);
    }).join("");
    return hex;
  }

  function fallbackHex(cssVar) {
    var e = doc.documentElement;
    var v = "";
    try { v = getComputedStyle(e).getPropertyValue(cssVar); } catch (err) { /* ignore */ }
    return cssColorToHex(v) || "#888888";
  }

  function contrastHint(colors) {
    var text = colors.text || fallbackHex("--mlc-text");
    var surface = colors.surface || fallbackHex("--mlc-surface");
    var ratio = Core.contrastRatio(text, surface);
    if (ratio == null) return "";
    if (ratio < 4.5) return "正文与纸面只有 " + ratio + ":1，字会不好认（建议 ≥ 4.5）";
    return "正文 / 纸面对比度 " + ratio + ":1";
  }

  function buildColorRow(spec, paintAll) {
    var row = el("div", "md-color-row");
    row.setAttribute(MARK_ATTR, "color-" + spec.key);
    var lab = el("span", "md-color-k");
    lab.textContent = spec.label;

    var input = el("input", "md-color-input", { type: "color", "aria-label": spec.label });
    input.value = current().custom.colors[spec.key] || fallbackHex(spec.css);

    var follow = el("button", "md-mini", { type: "button" });
    follow.textContent = "跟随主题";

    function paint() {
      var c = current().custom.colors[spec.key];
      input.value = c || fallbackHex(spec.css);
      row.setAttribute("data-mlc-follow", c ? "0" : "1");
      follow.setAttribute("aria-pressed", c ? "false" : "true");
      follow.textContent = c ? "跟随主题" : "跟随中";
    }

    input.addEventListener("input", function () {
      var p = { colors: {} };
      p.colors[spec.key] = input.value;
      live(p);
      paintAll();
    });
    input.addEventListener("change", function () {
      var p = { colors: {} };
      p.colors[spec.key] = input.value;
      commit(p);
    });
    follow.addEventListener("click", function () {
      var p = { colors: {} };
      p.colors[spec.key] = "";
      commit(p);
    });

    row.appendChild(lab);
    row.appendChild(input);
    row.appendChild(follow);
    paint();
    row.__paint = paint;
    return row;
  }

  /* -------------------------------------------------------------------------
   * 组装
   * ---------------------------------------------------------------------- */

  function buildGroup() {
    var group = el("section", "md-custom");
    group.setAttribute(MARK, "1");
    group.setAttribute("aria-label", "灯台外观");

    var head = el("div", "md-custom-head");
    var h = el("div", "md-custom-h");
    h.textContent = "灯台外观";
    var tag = el("span", "md-custom-tag");
    tag.textContent = "v" + Core.VERSION;
    head.appendChild(h);
    head.appendChild(tag);
    group.appendChild(head);
    group.appendChild(note("这些设置只改灯台外观，不写入存档；关掉对应开关即回到原版"));

    group.appendChild(buildStage());
    var posLine = el("p", "md-stage-pos");
    posLine.setAttribute(MARK_ATTR, "stage-pos");
    group.appendChild(posLine);

    /* —— 背景 —— */
    var bgRow = el("div", "md-pick-row");
    bgRow.setAttribute(MARK_ATTR, "bg-pick");
    var bgPick = el("button", "ml-btn ml-btn-quiet md-pick", { type: "button" });
    bgPick.textContent = "导入背景图";
    var bgDel = el("button", "ml-btn ml-btn-quiet md-pick", { type: "button" });
    bgDel.textContent = "移除";
    bgRow.appendChild(bgPick);
    bgRow.appendChild(bgDel);
    group.appendChild(field("页面背景", bgRow, "bg-buttons"));

    /* 「应用背景」：导入完图点一下，重新挂图 + 整份设置重放一次。
       导入不生效、或改了图想立刻看到时用，不必退出设置页或刷新游戏。 */
    var applyBtn = el("button", "ml-btn md-apply", { type: "button" });
    applyBtn.textContent = "应用背景";
    applyBtn.setAttribute(MARK_ATTR, "apply-bg");
    group.appendChild(applyBtn);

    var bgFit = seg([
      { value: "cover", label: "铺满" },
      { value: "contain", label: "完整" },
      { value: "fill", label: "拉伸" }
    ], current().custom.bgFit, function (v) { commit(one("bgFit", v)); }, "seg-bg-fit");
    group.appendChild(field("适配方式", bgFit, "bg-fit"));

    var op = slider("bgOpacity", 0, 100, 5, "背景不透明度", function (v) { return v + "%"; });
    var zm = slider("bgZoom", 50, 200, 5, "背景缩放", function (v) { return v + "%"; });
    var sf = slider("bgSoft", 0, 8, 1, "背景模糊", function (v) { return v + " px"; });
    group.appendChild(op.node);
    group.appendChild(zm.node);
    group.appendChild(sf.node);

    /* —— 按钮底纹 —— */
    var btnRow = el("div", "md-pick-row");
    btnRow.setAttribute(MARK_ATTR, "btn-pick");
    var btnPick = el("button", "ml-btn ml-btn-quiet md-pick", { type: "button" });
    btnPick.textContent = "导入按钮底纹";
    var btnDel = el("button", "ml-btn ml-btn-quiet md-pick", { type: "button" });
    btnDel.textContent = "移除";
    btnRow.appendChild(btnPick);
    btnRow.appendChild(btnDel);
    group.appendChild(field("按钮底纹", btnRow, "btn-buttons"));

    var btnFit = seg([
      { value: "cover", label: "等比" },
      { value: "fill", label: "拉伸" }
    ], current().custom.btnFit === "fill" ? "fill" : "cover", function (v) { commit(one("btnFit", v)); }, "seg-btn-fit");
    group.appendChild(field("按钮底纹适配", btnFit, "btn-fit"));

    var bop = slider("btnOpacity", 0, 100, 5, "按钮底纹不透明度", function (v) { return v + "%"; });
    var bzm = slider("btnZoom", 50, 200, 5, "按钮底纹缩放", function (v) { return v + "%"; });
    group.appendChild(bop.node);
    group.appendChild(bzm.node);

    /* —— 浮窗卡片（游戏原生弹窗）—— */
    var cardRow = el("div", "md-pick-row");
    cardRow.setAttribute(MARK_ATTR, "card-buttons");
    var cardPick = el("button", "ml-btn ml-btn-quiet md-pick", { type: "button" });
    cardPick.textContent = "导入浮窗卡片";
    var cardDel = el("button", "ml-btn ml-btn-quiet md-pick", { type: "button" });
    cardDel.textContent = "移除";
    cardRow.appendChild(cardPick);
    cardRow.appendChild(cardDel);
    group.appendChild(field("浮窗卡片", cardRow, "card-buttons"));

    var cardFit = seg([
      { value: "cover", label: "等比" },
      { value: "fill", label: "拉伸" }
    ], current().custom.cardFit === "fill" ? "fill" : "cover", function (v) { commit(one("cardFit", v)); }, "seg-card-fit");
    group.appendChild(field("浮窗卡片适配", cardFit, "card-fit"));

    var cop = slider("cardOpacity", 0, 100, 5, "浮窗卡片不透明度", function (v) { return v + "%"; });
    var czm = slider("cardZoom", 50, 200, 5, "浮窗卡片缩放", function (v) { return v + "%"; });
    group.appendChild(cop.node);
    group.appendChild(czm.node);
    var cardHint = note("只改游戏自己的浮窗/弹窗（选项弹窗、存档与设置对话框）的卡片底图；预览里拖那张样例卡片就是调它的位置");
    group.appendChild(cardHint);

    var dragHint = note("背景 / 按钮底纹 / 浮窗卡片都可以直接在预览里拖：按住对应区域拖动即可改位置；缩到比盒子还小时拖不动，先把缩放调大");
    group.appendChild(dragHint);

    /* —— 字号 / 纸面 —— */
    var fs = slider("fontScale", 80, 140, 5, "正文选项字号", function (v) { return v + "%"; });
    var sa = slider("surfaceAlpha", 0, 100, 5, "面板遮蔽", function (v) { return v + "%"; });
    var saHint = note("面板遮蔽越低，自己导入的背景图越透出来；100% 就是纯色面板、看不到背景");
    group.appendChild(fs.node);
    group.appendChild(sa.node);
    group.appendChild(saHint);

    /* —— 颜色 —— */
    var colorsBox = el("div", "md-colors");
    colorsBox.setAttribute(MARK_ATTR, "colors");
    var hint = el("p", "md-color-hint");
    var paintHint = function () {
      hint.textContent = contrastHint((draft || current()).custom.colors);
    };
    COLOR_ROWS.forEach(function (spec) {
      colorsBox.appendChild(buildColorRow(spec, function () { paintHint(); }));
    });
    colorsBox.appendChild(hint);
    group.appendChild(field("配色", colorsBox, "colors-field"));

    var syncSw = switchControl("syncMl", "同步给灯台", "打开时这四色同时写进灯台的 --mln-*，整页一起变；关掉只动本模组自己的落点");
    group.appendChild(syncSw.node);
    if (syncSw.hint) group.appendChild(syncSw.hint);

    /* —— 复位 —— */
    var resets = el("div", "ml-resets md-resets");
    resets.setAttribute(MARK_ATTR, "resets");
    [
      ["背景", "bg"],
      ["按钮底纹", "btn"],
      ["浮窗卡片", "card"],
      ["颜色", "colors"],
      ["字号与遮蔽", "type"],
      ["恢复出厂", "all"]
    ].forEach(function (pair) {
      var b = el("button", "ml-btn ml-btn-quiet", { type: "button" });
      b.textContent = "复位 · " + pair[0];
      b.addEventListener("click", function () { resetGroup(pair[1]); });
      resets.appendChild(b);
    });
    group.appendChild(resets);

    bgPick.addEventListener("click", function () { pickFile("bg"); });
    bgDel.addEventListener("click", function () { removeImage("bg"); });
    btnPick.addEventListener("click", function () { pickFile("btn"); });
    btnDel.addEventListener("click", function () { removeImage("btn"); });
    cardPick.addEventListener("click", function () { pickFile("card"); });
    cardDel.addEventListener("click", function () { removeImage("card"); });
    applyBtn.addEventListener("click", applyBackground);

    var note0 = note(loadingNote || "背景建议长边 ≥ 1200 px；导入时窄屏压到 1200 px、宽屏压到 1600 px 再存，单张上限 15 MB");
    note0.setAttribute(MARK_ATTR, "note");

    // note 放在舞台下面更好读：挪一次位置
    group.insertBefore(note0, group.querySelector("[data-mdd-custom-part='bg-buttons']"));

    ui = {
      group: group,
      stage: group.querySelector("#mdStage"),
      note: [note0],
      posLine: posLine,
      bgDel: bgDel,
      btnDel: btnDel,
      cardDel: cardDel,
      op: op, zm: zm, sf: sf, bop: bop, bzm: bzm, cop: cop, czm: czm, fs: fs, sa: sa,
      bgFit: bgFit, btnFit: btnFit, cardFit: cardFit, syncSw: syncSw,
      colorRows: colorsBox.querySelectorAll(".md-color-row"),
      paintHint: paintHint
    };
    paintHint();
    paintStage();
    paintPicks();
    paintPos();
    return group;
  }

  function resetGroup(group) {
    var s = Core.resetCustom(current(), group);
    var keys = Core.RESET_GROUPS[group] || [];
    var patch = {};
    keys.forEach(function (k) {
      patch[k] = k === "colors" ? Core.clone(s.custom.colors) : s.custom[k];
    });
    if (group === "bg") { Assets.release("bg"); img.bg = null; Theme.attach("bg", null); Assets.drop("bg"); }
    if (group === "btn") { Assets.release("btn"); img.btn = null; Theme.attach("btn", null); Assets.drop("btn"); }
    if (group === "card") { Assets.release("card"); img.card = null; Theme.attach("card", null); Assets.drop("card"); }
    if (group === "all") {
      KINDS.forEach(function (k) {
        Assets.release(k);
        img[k] = null;
        Theme.attach(k, null);
        Assets.drop(k);
      });
    }
    commit(patch);
  }

  /* -------------------------------------------------------------------------
   * 重绘
   * ---------------------------------------------------------------------- */

  function paintReadouts() {
    if (!ui) return;
    ui.op.paint();
    ui.zm.paint();
    ui.sf.paint();
    ui.bop.paint();
    ui.bzm.paint();
    ui.cop.paint();
    ui.czm.paint();
    ui.fs.paint();
    ui.sa.paint();
  }

  /** 位置读数：把 bgX/Y、btnX/Y 摆到明面上，玩家不用猜"我刚才拖到哪了"。 */
  function paintPos() {
    if (!ui || !ui.posLine) return;
    var c = (draft || current()).custom;
    var bg = (img.bg && c.bgOn) ? "背景 " + c.bgX + "% / " + c.bgY + "%" : "背景 未启用";
    var bt = (img.btn && c.btnOn) ? "按钮 " + c.btnX + "% / " + c.btnY + "%" : "按钮 未启用";
    var cd = (img.card && c.cardOn) ? "卡片 " + c.cardX + "% / " + c.cardY + "%" : "卡片 未启用";
    ui.posLine.textContent = "位置 · " + bg + " ｜ " + bt + " ｜ " + cd;
  }

  /** 没图时「移除」按钮禁用：避免点了没反应，也避免误触丢图。 */
  function paintPicks() {
    if (!ui) return;
    [[ui.bgDel, !!img.bg], [ui.btnDel, !!img.btn], [ui.cardDel, !!img.card]].forEach(function (pair) {
      var b = pair[0];
      if (!b) return;
      var has = pair[1];
      b.disabled = !has;
      b.setAttribute("aria-disabled", has ? "false" : "true");
      if (has) b.classList.remove("is-off");
      else b.classList.add("is-off");
    });
  }

  function paintSegments() {
    if (!ui) return;
    var c = current().custom;
    [[ui.bgFit, c.bgFit],
     [ui.btnFit, c.btnFit === "fill" ? "fill" : "cover"],
     [ui.cardFit, c.cardFit === "fill" ? "fill" : "cover"]].forEach(function (spec) {
      var group = spec[0];
      var val = spec[1];
      Array.prototype.forEach.call(group.children, function (b) {
        b.setAttribute("aria-checked", b.getAttribute("data-value") === val ? "true" : "false");
      });
    });
    ui.syncSw.paint();
    Array.prototype.forEach.call(ui.colorRows, function (row) { if (row.__paint) row.__paint(); });
  }

  function sync() {
    if (!ui || !ui.group) return;
    paintSegments();
    paintReadouts();
    paintStage();
    paintPicks();
    paintPos();
    if (ui.paintHint) ui.paintHint();
  }

  /* -------------------------------------------------------------------------
   * 注入 / 卸载
   * ---------------------------------------------------------------------- */

  function inject() {
    var pane = doc.getElementById("ml-pane");
    var tab = doc.getElementById("ml-tab-settings");
    if (!pane || !tab || tab.getAttribute("aria-selected") !== "true") return;

    var existing = pane.querySelector("[" + MARK + "]");
    if (existing && ui && ui.group === existing && existing.parentNode === pane) {
      sync();
      return;
    }
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    ui = null;

    var group = buildGroup();
    var anchor = pane.querySelector(".ml-resets");
    // 落点：设置页底部「恢复默认」之前，避免夹在灯台原有滑杆中间打断节奏
    pane.insertBefore(group, anchor || null);
    loadImages();
    sync();
  }

  function schedule() {
    if (timer) return;
    timer = root.setTimeout(function () {
      timer = 0;
      /* 拖动中不重挂：重挂会按已落盘的旧值重画滑杆，手还没松就跳回去 */
      if (drag) return;
      inject();
    }, 90);
  }

  function bind() {
    if (observer) return;
    observer = new MutationObserver(function () {
      if (!doc.getElementById("ml-pane-host")) return;
      schedule();
    });
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    /* 灯台切页签只改 aria-selected / display，不重建 DOM；光靠 MutationObserver
     * 的 childList 会漏掉这条路径，所以点一下也补一次（90ms 节流，不会重入）。 */
    doc.addEventListener("click", function () { schedule(); }, true);
    root.addEventListener("resize", function () { paintStage(); }, { passive: true });
  }

  function destroy() {
    if (observer) { observer.disconnect(); observer = null; }
    if (timer) { root.clearTimeout(timer); timer = 0; }
    var groups = doc.querySelectorAll("[" + MARK + "]");
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].parentNode) groups[i].parentNode.removeChild(groups[i]);
    }
    ui = null;
    draft = null;
    pending = null;
    loaded = { bg: false, btn: false, card: false };
  }

  root.MapleLanternDossierPanel = {
    __ready: true,
    inject: inject,
    sync: sync,
    destroy: destroy,
    setImage: setImage,
    images: function () { return { bg: img.bg, btn: img.btn, card: img.card }; },
    stage: function () { return ui ? ui.stage : null; }
  };

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", function () { bind(); schedule(); }, { once: true });
  } else {
    bind();
    schedule();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
