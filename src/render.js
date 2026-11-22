/* ============================================================================
 * 灯台 · MapleLantern — index.js（游戏内渲染层）
 * 依赖 core.js（同包内先加载）。挂载到 body 直属作用域 #ml-root。
 * 只读：不写 window.State.variables 的任何字段。
 * ========================================================================== */
(function () {
  "use strict";

  var C = window.MapleLanternCore;
  if (!C || typeof document === "undefined") { return; }
  if (window.MapleLantern && window.MapleLantern.__mounted) { return; }

  var doc = document;
  var D = C.DEFAULTS;

  var state = {
    mounted: false,
    open: false,
    sheet: false,
    tab: D.tab,
    lang: "zh",
    settings: null,
    repaired: false,
    storageOK: true,
    host: null,
    lastFocus: null,
    lastRenderMs: 0,
    closeTimer: 0,
    scrollTimer: 0,
    drag: null,
    orbDrag: null,
    orbPointer: null,
    zoomObserver: null,
    disposed: false,
    failed: false
  };

  var els = {};
  var moveTimer = 0;
  var toastTimer = 0;

  var ICONS = {
    now: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6M5.1 5.1l1.9 1.9M17 17l1.9 1.9M18.9 5.1L17 7M7 17l-1.9 1.9"/></svg>',
    vitals: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.5 12.4h4.2l2.1-5.6 3.2 11 2.3-6.6 1.7 3.4h5.5"/></svg>',
    worn: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.2l7.4 4.1v9.5h-2.2v-7l-5.2-2.9-5.2 2.9v7H4.6V7.3z"/><path d="M10 20.2v-4.8h4v4.8"/></svg>',
    system: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4M5.4 5.4l1.7 1.7M16.9 16.9l1.7 1.7M18.6 5.4l-1.7 1.7M7.1 16.9L5.4 18.6"/></svg>',
    switches: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2.2"/><circle cx="15" cy="12" r="2.2"/><circle cx="9" cy="18" r="2.2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6l-12 12"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="8.5" y="3.5" width="12" height="13" rx="2"/><path d="M15.5 20.5h-9a2 2 0 0 1-2-2v-10"/></svg>',
    reset: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4.2 12a7.8 7.8 0 1 0 2.4-5.6"/><path d="M4.2 4.2v4.4h4.4"/></svg>'
  };

  function svg(name) {
    var span = doc.createElement("span");
    span.className = "ml-ico";
    span.innerHTML = ICONS[name] || "";
    return span;
  }

  function el(tag, cls, attrs) {
    var node = doc.createElement(tag);
    if (cls) { node.className = cls; }
    if (attrs) { Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); }); }
    return node;
  }

  /* 每次挂载给 8 颗环境粒子做一次轻量随机抖动：位置仍在边缘安全区，
     只改 CSS 变量、不进每帧循环，避免雾团每次都长在同一个点上。 */
  var AMBIENT_SLOTS = [[-6, 6], [68, -5], [5, 58], [72, 62], [34, -10], [52, 82], [84, 30], [-12, 36]];
  function jitterAmbient(ambient) {
    var list = ambient.children;
    for (var i = 0; i < list.length; i += 1) {
      var slot = AMBIENT_SLOTS[i];
      var scale = .72 + Math.random() * .55;
      var delay = -Math.round(Math.random() * 32);
      list[i].style.setProperty("--ml-wisp-x", (slot[0] + Math.random() * 6 - 3).toFixed(1) + "%");
      list[i].style.setProperty("--ml-wisp-y", (slot[1] + Math.random() * 6 - 3).toFixed(1) + "%");
      list[i].style.setProperty("--ml-wisp-s", scale.toFixed(2));
      list[i].style.setProperty("--ml-wisp-delay", delay + "s");
    }
  }

  function text(key, map) { return C.fmt(C.strings(state.lang)[key] || key, map); }

  /* ---------------------------------------------------------------- 数据桥 */

  function getVars() {
    try {
      var sc = window.SugarCube;
      if (sc && sc.State && sc.State.variables && typeof sc.State.variables === "object") { return sc.State.variables; }
    } catch (e) { /* 只读失败，继续降级 */ }
    try {
      if (window.State && window.State.variables && typeof window.State.variables === "object") { return window.State.variables; }
    } catch (e2) { /* 同上 */ }
    return null;
  }

  function getPassage() {
    try { return (window.SugarCube && window.SugarCube.State && window.SugarCube.State.passage) || (window.State && window.State.passage) || null; } catch (e) { return null; }
  }

  function getGameVersion() {
    try { return (window.StartConfig && window.StartConfig.version) || null; } catch (e) { return null; }
  }

  function getSugarVersion() {
    try {
      var v = window.SugarCube && window.SugarCube.Version;
      if (!v) { return null; }
      if (typeof v === "string") { return v; }
      if (v.major !== undefined) { return "v" + v.major + "." + v.minor + "." + v.patch; }
      if (v.version && typeof v.version === "string") { return v.version; }
    } catch (e) { /* ignore */ }
    return null;
  }

  function readModel() {
    var model = C.readModel({
      vars: getVars(),
      time: (typeof window.Time === "object" && window.Time) || null,
      constants: (typeof window.Constants === "object" && window.Constants) || null,
      passage: getPassage(),
      lang: state.lang
    });
    try {
      var bridge = model.thirdParty || {};
      if (typeof window.Dynamicest === "object" && window.Dynamicest) {
        bridge.dynamicest = bridge.dynamicest || { installed: true, initialized: false, flash: null, timebar: null, opacity: null };
        bridge.dynamicest.installed = true;
      }
      if (typeof window.decoZ === "function" || typeof window.decoFillDefaults === "function") {
        bridge.decorations = bridge.decorations || { installed: true, initialized: false, foreground: null, background: null, autoBackground: false };
        bridge.decorations.installed = true;
      }
      model.thirdParty = (bridge.dynamicest || bridge.decorations) ? bridge : null;
    } catch (e) { model.thirdParty = null; }
    return model;
  }

  function readHost() {
    try {
      var ui = window.DoLGameUI && window.DoLGameUI.ui;
      if (!ui || ui.apiVersion !== 1 || typeof ui.getCapabilities !== "function") { return null; }
      var caps = ui.getCapabilities();
      var theme = typeof ui.getTheme === "function" ? ui.getTheme() : null;
      return {
        apiVersion: ui.apiVersion,
        caps: caps || null,
        tokens: (theme && theme.tokens) || null,
        visualTier: (caps && caps.visualTier) || null,
        layout: (caps && caps.layout) || null
      };
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- 设置 */

  function loadSettings() {
    var result = { value: Object.assign({}, D), repaired: false, empty: true };
    var raw = null;
    try {
      raw = window.localStorage.getItem(C.STORAGE_KEY);
    } catch (e) {
      state.storageOK = false;
    }
    if (raw) {
      try {
        result = C.sanitizeSettings(JSON.parse(raw));
      } catch (e2) {
        /* 存储可读但内容坏了：按字段修复，属于“修复”而不是“存储不可用” */
        result = C.sanitizeSettings(null);
        result.repaired = true;
        result.empty = false;
      }
    }
    state.settings = result.value;
    state.repaired = !result.empty && (result.repaired || result.migrated);
    state.tab = state.settings.tab;
    state.lang = C.pickLang(state.settings.lang, navigator.language || "zh");
  }

  function saveSettings() {
    if (!state.storageOK) { return false; }
    try {
      window.localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state.settings));
      return true;
    } catch (e) {
      state.storageOK = false;
      toast(text("toast.storage"));
      return false;
    }
  }

  function setSetting(key, value, rerender) {
    if (!state.settings) { return; }
    var fromTheme = state.settings.theme;
    state.settings[key] = value;
    if (key === "tab") { state.tab = value; }
    if (key === "lang") { state.lang = C.pickLang(value, navigator.language || "zh"); }
    /* 换主题时自定义正文色可能在新底色上不达标：直接回落跟随主题，
       避免留下一个“设置里还亮着、正文却没生效”的悬挂值。 */
    if (key === "theme" && state.settings.textColor !== "auto" &&
        !C.textColorFor(state.settings.textColor, value)) {
      state.settings.textColor = "auto";
      toast(text("toast.colorContrast"));
    }
    applySettings();
    if (key === "theme" && fromTheme !== value) { pulseTheme(); }
    saveSettings();
    syncNative();
    if (rerender === false) { return; }
    renderChrome();
    renderActive();
  }

  /* 换主题时的一层短促强调光：只染面板底色，不压字、不新增布局。
     动效关闭时不挂 class，CSS 侧还有 reduced-motion 兜底。 */
  function pulseTheme() {
    if (!els.wash || !state.settings || state.settings.motion === false) { return; }
    els.wash.classList.remove("is-on");
    /* 读一次布局，连续切换时也能重新触发同一段动画。 */
    if (doc.body) { void els.wash.offsetWidth; }
    els.wash.classList.add("is-on");
  }

  function syncNative() {
    try {
      if (window.MapleLanternNative && typeof window.MapleLanternNative.refresh === "function") {
        window.MapleLanternNative.refresh();
      }
    } catch (e) { /* 原生层不可用时不影响浮卡 */ }
  }

  function applySettings() {
    if (!els.root) { return; }
    els.root.setAttribute("data-theme", state.settings.theme);
    els.root.setAttribute("data-density", state.settings.density);
    els.root.setAttribute("data-motion", state.settings.motion ? "on" : "off");
    els.root.setAttribute("data-panel", state.settings.panel ? "on" : "off");
    if (els.orb) { els.orb.hidden = !state.settings.panel; }
    if (els.ambient) { els.ambient.hidden = !state.settings.motion; }
    try {
      doc.documentElement.setAttribute("data-ml-motion", state.settings.motion ? "on" : "off");
      doc.documentElement.setAttribute("data-ml-lang", state.lang);
      doc.documentElement.setAttribute("data-ml-orn", state.settings.ornament ? "1" : "0");
      var optAttrs = {
        optStats: "data-ml-opt-stats", optMoney: "data-ml-opt-money",
        optRailSkin: "data-ml-opt-rail-skin", optRailPct: "data-ml-opt-rail-pct",
        optMeterSkin: "data-ml-opt-meter-skin", optMeterValue: "data-ml-opt-meter-value",
        optOptions: "data-ml-opt-options", optSidebar: "data-ml-opt-sidebar",
        optOverlay: "data-ml-opt-overlay"
      };
      Object.keys(optAttrs).forEach(function (key) {
        if (state.settings[key] === false) { doc.documentElement.removeAttribute(optAttrs[key]); }
        else { doc.documentElement.setAttribute(optAttrs[key], "1"); }
      });
    } catch (e) { /* documentElement 不可写时忽略 */ }
    els.root.style.setProperty("--ml-scale", String(state.settings.scale / 100));
    var glass = Math.max(0, Math.min(100, Number(state.settings.glass)));
    if (!isFinite(glass)) { glass = 60; }
    var alpha = glass <= 60 ? 1 - glass * 0.001333 : .92 - (glass - 60) * .005;
    var blur = glass <= 0 ? 0 : (glass <= 60 ? glass / 3 : 20 + (glass - 60) * .3);
    var tier = state.host && state.host.visualTier;
    if (tier === "Smooth") { blur = Math.min(blur, 10); }
    else if (tier === "Balanced") { blur = Math.min(blur, 16); }
    if (window.innerWidth > 0 && window.innerWidth <= 899) { blur = Math.min(blur, 12); }
    els.root.style.setProperty("--ml-surface-alpha", String(Math.max(.72, Math.min(1, alpha)).toFixed(3)));
    els.root.style.setProperty("--ml-blur", String(Math.round(blur)) + "px");
    els.root.style.setProperty("--ml-edge", String(.06 + glass * .0005));
    els.root.setAttribute("data-glass", glass <= 0 ? "0" : "1");
    var caps = state.host && state.host.caps;
    els.root.setAttribute("data-blur", caps && caps.backdropFilter === false ? "off" : "on");
    els.root.style.removeProperty("--ml-accent");
    els.root.style.removeProperty("--ml-accent-soft");
    els.root.style.removeProperty("--ml-radius");
    els.root.style.removeProperty("--ml-card-radius");

    var tokens = state.host && state.host.tokens;
    if (state.settings.theme === "auto" && tokens) {
      if (typeof tokens.ocean === "string" && tokens.ocean.indexOf("--") === 0) {
        els.root.style.setProperty("--ml-accent", "var(" + tokens.ocean + ", #E3B25F)");
        if (window.CSS && typeof window.CSS.supports === "function" &&
            window.CSS.supports("color", "color-mix(in srgb, #fff 10%, transparent)")) {
          els.root.style.setProperty("--ml-accent-soft", "color-mix(in srgb, var(" + tokens.ocean + ") 16%, transparent)");
        }
      }
      if (typeof tokens.radius === "string" && tokens.radius.indexOf("--") === 0) {
        els.root.style.setProperty("--ml-radius", "var(" + tokens.radius + ", 12px)");
      }
      if (typeof tokens.cardRadius === "string" && tokens.cardRadius.indexOf("--") === 0) {
        els.root.style.setProperty("--ml-card-radius", "var(" + tokens.cardRadius + ", 16px)");
      }
    }
  }

  /* ---------------------------------------------------------------- 布局 */

  /* body.style.zoom 会把固定层的 px 再乘一次；所有落位计算统一走本地视口，
     并把 --ml-vw / --ml-vh 写给 CSS，让 120% 以上也能收住宽高。 */
  function viewport() {
    return C.viewportSize ? C.viewportSize(doc) : {
      zoom: 1,
      width: window.innerWidth || 1024,
      height: window.innerHeight || 768
    };
  }

  function publishViewport(vp) {
    var root = doc.documentElement;
    if (!root) { return; }
    root.style.setProperty("--ml-vw", Math.round(vp.width) + "px");
    root.style.setProperty("--ml-vh", Math.round(vp.height) + "px");
    root.style.setProperty("--ml-zoom", String(vp.zoom));
  }

  function computeSheet() {
    var w = window.innerWidth || 1024;
    var h = window.innerHeight || 768;
    var hostMobile = !!(state.host && state.host.layout === "mobile");
    return w <= 560 || h <= 520 || (hostMobile && w <= 600);
  }

  function applyLayout() {
    if (!els.root) { return; }
    state.sheet = computeSheet();
    els.root.setAttribute("data-sheet", state.sheet ? "1" : "0");
    els.root.setAttribute("data-orb-zone", state.settings.y < 0.5 ? "top" : "bottom");
    placeOrb();
  }

  function safeInset(side) {
    try {
      var raw = window.getComputedStyle(els.root).getPropertyValue("--ml-safe-" + side);
      var v = parseFloat(raw);
      return v > 0 ? v : 0;
    } catch (e) { return 0; }
  }

  function leftSafe() {
    var bar = doc.getElementById("ui-bar");
    var physical = window.innerWidth || 1024;
    var vp = viewport();
    var base = physical <= 560 ? 12 : 16;
    if (bar) {
      try {
        var cs = window.getComputedStyle(bar);
        if (cs.display !== "none" && cs.visibility !== "hidden") {
          var w = bar.getBoundingClientRect().width / vp.zoom;
          if (w > 0 && physical > 900) { base = Math.round(w + 10); }
        }
      } catch (e) { /* 侧栏读不到就用默认边距 */ }
    }
    return base + safeInset("l");
  }

  function placeOrb() {
    if (!els.orb) { return; }
    var vp = viewport();
    var w = vp.width;
    var h = vp.height;
    publishViewport(vp);
    var size = els.orb.offsetWidth || 56;
    var margin = ((window.innerWidth || 1024) <= 560 ? 12 : 16) +
      (state.settings.side === "right" ? safeInset("r") : 0);
    var y = state.settings.y;
    var top = Math.round(y * h - size / 2);
    top = Math.max(64, Math.min(h - size - 20, top));
    var left = state.settings.side === "left" ? leftSafe() : (w - size - margin);
    els.root.style.setProperty("--ml-left-safe", leftSafe() + "px");
    els.orb.style.left = left + "px";
    els.orb.style.top = top + "px";
    els.orb.style.right = "auto";
    els.orb.style.bottom = "auto";
    els.root.setAttribute("data-side", state.settings.side);
  }

  function syncHost() {
    var host = readHost();
    if (host) { state.host = { apiVersion: host.apiVersion, layout: host.layout, tokens: host.tokens, visualTier: host.visualTier, caps: host.caps }; }
    else { state.host = null; }
    applySettings();
    applyLayout();
    if (state.open) { renderActive(); }
  }

  /* ---------------------------------------------------------------- 构建 */

  function buildRoot() {
    var root = el("div", "ml-root", { id: "ml-root", "data-theme": "auto", "data-density": "cozy", "data-motion": "on" });
    root.style.setProperty("--ml-scale", String(state.settings.scale / 100));

    var scrim = el("div", "ml-scrim", { hidden: "" });
    scrim.addEventListener("pointerdown", function () { closePanel("scrim"); });

    /* 主题环境层：单容器 + 8 颗粒子；只动 transform/opacity，中央留空。
       动效关闭时整层 hidden，不进入渲染树（见 applySettings）。 */
    var ambient = el("div", "ml-ambient", { "aria-hidden": "true" });
    for (var wi = 1; wi <= 8; wi += 1) {
      ambient.appendChild(el("span", "ml-ambient__wisp", { "data-wisp": String(wi) }));
    }
    jitterAmbient(ambient);
    /* 第 9 个节点是整幅慢流层，不参与粒子随机；只做一条 CSS transform 动画。 */
    ambient.appendChild(el("span", "ml-ambient__veil", { "data-layer": "veil" }));
    /* 第 10 个节点是天光底：放在 veil 之后，不改变 1~8 号粒子与 veil 的顺序；
       只加一个 CSS 层，星点/极光全部由伪元素承担，移动端不增加 JS 计算。 */
    ambient.appendChild(el("div", "ml-ambient__sky", { "data-layer": "sky", "aria-hidden": "true" }));

    var orb = el("button", "ml-orb", {
      type: "button",
      id: "ml-orb",
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
      title: "灯台"
    });
    var ring = el("span", "ml-orb-ring", { "aria-hidden": "true" });
    var flame = el("span", "ml-orb-flame", { "aria-hidden": "true" });
    var dot = el("span", "ml-orb-dot", { "aria-hidden": "true" });
    orb.appendChild(ring); orb.appendChild(flame); orb.appendChild(dot);

    var panel = el("section", "ml-panel", {
      id: "ml-panel",
      role: "dialog",
      "aria-modal": "true",
      hidden: ""
    });
    var grip = el("div", "ml-grip", { "aria-hidden": "true" });

    var head = el("header", "ml-head");
    var brand = el("div", "ml-brand");
    var mark = el("span", "ml-mark", { "aria-hidden": "true" });
    var brandText = el("div", "ml-brand-text");
    var name = el("span", "ml-name");
    var sub = el("span", "ml-sub");
    brandText.appendChild(name); brandText.appendChild(sub);
    brand.appendChild(mark); brand.appendChild(brandText);

    var headRight = el("div", "ml-head-right");
    var miniClock = el("span", "ml-mini-clock", { "aria-hidden": "true" });
    var closeBtn = el("button", "ml-icon ml-close", { type: "button", "aria-label": "关闭" });
    closeBtn.appendChild(svg("close"));
    headRight.appendChild(miniClock); headRight.appendChild(closeBtn);
    head.appendChild(brand); head.appendChild(headRight);

    var tabs = el("div", "ml-tabs", { role: "tablist", "aria-label": "灯台分类" });

    var body = el("div", "ml-body", { id: "ml-pane-host" });

    var foot = el("footer", "ml-foot");
    var note = el("span", "ml-foot-note");
    var status = el("span", "ml-foot-status");
    var ver = el("span", "ml-ver");
    foot.appendChild(note); foot.appendChild(status); foot.appendChild(ver);

    var wash = el("span", "ml-theme-wash", { "aria-hidden": "true" });

    var toast = el("div", "ml-toast", { role: "status", "aria-live": "polite", hidden: "" });
    var sr = el("div", "ml-sr", { "aria-live": "polite" });

    panel.appendChild(grip); panel.appendChild(head); panel.appendChild(tabs);
    panel.appendChild(body); panel.appendChild(foot); panel.appendChild(wash);

    root.appendChild(ambient); root.appendChild(scrim); root.appendChild(orb); root.appendChild(panel);
    root.appendChild(toast); root.appendChild(sr);
    doc.body.appendChild(root);

    els.root = root; els.ambient = ambient; els.scrim = scrim; els.orb = orb; els.orbRing = ring; els.orbDot = dot;
    els.panel = panel; els.grip = grip; els.head = head; els.tabs = tabs; els.body = body;
    els.miniClock = miniClock; els.closeBtn = closeBtn;
    els.nameNode = name; els.subNode = sub;
    els.footNote = note; els.footStatus = status; els.footVer = ver;
    els.wash = wash;
    els.toast = toast; els.sr = sr;

    closeBtn.addEventListener("click", function () { closePanel("button"); });
    orb.addEventListener("pointerdown", onOrbDown);
    orb.addEventListener("click", function (e) {
      if (state.orbDrag === "moved") { state.orbDrag = null; return; }
      togglePanel();
    });
    panel.addEventListener("keydown", onPanelKey);
    grip.addEventListener("pointerdown", onGripDown);
    body.addEventListener("scroll", markPanelScrolling, { passive: true });
    window.addEventListener("scroll", markPanelScrolling, { passive: true });
    bindSheen();
  }

  function renderChrome() {
    if (!els.root) { return; }
    var s = C.strings(state.lang);
    els.root.setAttribute("aria-label", s["a11y.panel"]);
    els.panel.setAttribute("aria-label", s["a11y.panel"]);
    els.miniClock.textContent = "";
    if (els.nameNode) { els.nameNode.textContent = s["app.name"]; }
    if (els.subNode) { els.subNode.textContent = s["app.sub"]; }
    els.closeBtn.setAttribute("aria-label", s["misc.close"]);
    els.tabs.setAttribute("aria-label", s["a11y.tabs"]);
    els.footNote.textContent = s["app.readonly"];
    els.footVer.textContent = "v" + C.VERSION;

    renderTabs();
    renderFooterStatus();
  }

  function renderTabs() {
    if (!els.tabs) { return; }
    var s = C.strings(state.lang);
    els.tabs.textContent = "";
    var keys = C.TAB_KEYS;
    keys.forEach(function (key) {
      var btn = el("button", "ml-tab", {
        type: "button", role: "tab", id: "ml-tab-" + key,
        "aria-controls": "ml-pane", "aria-selected": state.tab === key ? "true" : "false",
        "data-tab": key, tabindex: state.tab === key ? "0" : "-1"
      });
      var icon = svg(key);
      var label = el("span", "ml-tab-label");
      label.textContent = s["tab." + key];
      btn.appendChild(icon); btn.appendChild(label);
      btn.addEventListener("click", function () { activateTab(key, true); });
      btn.addEventListener("keydown", onTabKey);
      els.tabs.appendChild(btn);
    });
    var glint = el("span", "ml-tab-glint", { "aria-hidden": "true" });
    els.tabs.appendChild(glint);
    syncTabGlint();
  }

  /* 光线指示器跟当前页签走：用 offsetLeft/offsetWidth（不含滚动与变换），
     左右各内缩 8px，与旧的 ::after 下划线视觉宽度一致。 */
  function syncTabGlint() {
    if (!els.tabs) { return; }
    var glint = els.tabs.querySelector(".ml-tab-glint");
    var active = els.tabs.querySelector('.ml-tab[aria-selected="true"]');
    if (!glint || !active) { return; }
    glint.style.width = Math.max(0, active.offsetWidth - 16) + "px";
    glint.style.transform = "translateX(" + (active.offsetLeft + 8) + "px)";
    glint.style.opacity = "1";
  }

  function renderFooterStatus() {
    if (!els.footStatus) { return; }
    var s = C.strings(state.lang);
    var cls = "ml-foot-status";
    var label = "";
    if (!state.storageOK) { label = s["storage.no"]; cls += " is-warn"; }
    else if (state.host) { label = s["host.on"].replace("{ver}", String(state.host.apiVersion)); cls += " is-ok"; }
    else { label = s["host.none"]; }
    els.footStatus.className = cls;
    els.footStatus.textContent = label;
  }

  function activateTab(key, focus) {
    if (C.TAB_KEYS.indexOf(key) < 0) { return; }
    state.tab = key;
    state.settings.tab = key;
    saveSettings();
    if (els.tabs) {
      Array.prototype.forEach.call(els.tabs.children, function (btn) {
        if (!btn.classList || !btn.classList.contains("ml-tab")) { return; }
        var on = btn.getAttribute("data-tab") === key;
        btn.setAttribute("aria-selected", on ? "true" : "false");
        btn.setAttribute("tabindex", on ? "0" : "-1");
      });
    }
    syncTabGlint();
    if (focus) {
      var btn = els.tabs && els.tabs.querySelector('[data-tab="' + key + '"]');
      if (btn) { btn.focus(); }
    }
    try {
      var active = els.tabs && els.tabs.querySelector('[data-tab="' + key + '"]');
      if (active && active.scrollIntoView) { active.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    } catch (e) { /* 滚动失败不影响切换 */ }
    renderActive();
    if (els.sr) { els.sr.textContent = C.strings(state.lang)["tab." + key]; }
  }

  function onTabKey(e) {
    var idx = C.TAB_KEYS.indexOf(state.tab);
    var next = null;
    if (e.key === "ArrowRight") { next = C.TAB_KEYS[(idx + 1) % C.TAB_KEYS.length]; }
    else if (e.key === "ArrowLeft") { next = C.TAB_KEYS[(idx - 1 + C.TAB_KEYS.length) % C.TAB_KEYS.length]; }
    else if (e.key === "Home") { next = C.TAB_KEYS[0]; }
    else if (e.key === "End") { next = C.TAB_KEYS[C.TAB_KEYS.length - 1]; }
    if (next) { e.preventDefault(); activateTab(next, true); }
  }

  /* ---------------------------------------------------------------- 渲染 */

  function renderActive() {
    if (!els.body) { return; }
    var t0 = (window.performance && typeof window.performance.now === "function") ? window.performance.now() : 0;
    var model = readModel();
    var modelSafe = model || {};
    state.modelDegraded = !!modelSafe.degraded;
    els.body.textContent = "";
    var pane = el("div", "ml-pane", { id: "ml-pane", role: "tabpanel", "aria-labelledby": "ml-tab-" + state.tab, tabindex: "0" });
    if (state.tab === "now") { renderNow(pane, modelSafe); }
    else if (state.tab === "vitals") { renderVitals(pane, modelSafe); }
    else if (state.tab === "worn") { renderWorn(pane, modelSafe); }
    else if (state.tab === "system") { renderSystem(pane); }
    else if (state.tab === "switches") { renderSwitches(pane); }
    else { renderSettings(pane); }
    els.body.appendChild(pane);

    var clock = modelSafe.clock;
    if (els.miniClock) { els.miniClock.textContent = clock ? C.formatClock(clock.hour, clock.minute) : ""; }
    updateOrb(clock);
    renderFooterStatus();
    if (t0) { state.lastRenderMs = Math.round((window.performance.now() - t0) * 100) / 100; }
  }

  function updateOrb(clock) {
    if (!els.orb) { return; }
    var s = C.strings(state.lang);
    var phase = clock && clock.phase ? clock.phase : "unknown";
    els.root.setAttribute("data-phase", phase);
    if (!clock) {
      els.root.style.setProperty("--ml-day-pct", "0%");
      els.orb.setAttribute("data-degraded", "1");
      els.orb.setAttribute("aria-label", s["app.name"]);
      els.orb.setAttribute("title", s["app.name"]);
      return;
    }
    var pct = clock.progress === null ? 0 : clock.progress;
    els.root.style.setProperty("--ml-day-pct", pct.toFixed(1) + "%");
    els.orb.setAttribute("data-phase", clock.phase);
    els.orb.setAttribute("data-degraded", state.modelDegraded ? "1" : "0");
    els.orb.setAttribute("aria-label", C.fmt(s["orb.label"], { date: clock.date, clock: C.formatClock(clock.hour, clock.minute) }));
    els.orb.setAttribute("title", C.formatClock(clock.hour, clock.minute) + " · " + s["phase." + clock.phase]);
  }

  function statCard(label, value, tone) {
    var card = el("div", "ml-stat" + (tone ? " is-" + tone : ""));
    var k = el("span", "ml-stat-k"); k.textContent = label;
    var v = el("strong", "ml-stat-v"); v.textContent = value;
    card.appendChild(k); card.appendChild(v);
    return card;
  }

  function renderNow(pane, model) {
    var s = C.strings(state.lang);
    var clock = model.clock;

    var hero = el("div", "ml-hero");
    var ring = el("div", "ml-ring");
    var pct = clock && clock.progress !== null ? clock.progress : 0;
    ring.style.setProperty("--ml-pct", Math.max(0.2, pct).toFixed(1) + "%");
    var core = el("div", "ml-ring-core");
    var timeNode = el("div", "ml-ring-time");
    timeNode.textContent = clock ? C.formatClock(clock.hour, clock.minute) : "--:--";
    var cap = el("div", "ml-ring-cap");
    cap.textContent = clock ? s["now.progress"] + " " + Math.round(pct) + "%" : s["now.noTime"];
    core.appendChild(timeNode); core.appendChild(cap);
    ring.appendChild(core);
    hero.appendChild(ring);

    var meta = el("div", "ml-hero-meta");
    var date = el("div", "ml-date");
    date.textContent = clock ? (clock.date + (clock.weekday ? " · " + clock.weekday : "")) : "—";
    var chip = el("div", "ml-chip");
    chip.textContent = clock ? s["phase." + clock.phase] : s["phase.unknown"];
    chip.setAttribute("data-phase", clock ? clock.phase : "unknown");
    var hint = el("div", "ml-hint");
    hint.textContent = s["now.clockHint"];
    meta.appendChild(date); meta.appendChild(chip); meta.appendChild(hint);
    hero.appendChild(meta);
    pane.appendChild(hero);

    var cards = el("div", "ml-cards");
    cards.appendChild(statCard(s["now.money"], C.formatMoney(model.money), "accent"));
    var sceneCard = statCard(s["now.scene"], model.scene || s["misc.untitled"], "");
    var sceneVal = sceneCard.querySelector(".ml-stat-v");
    if (sceneVal && model.scene) { sceneVal.setAttribute("title", model.scene); }
    cards.appendChild(sceneCard);
    cards.appendChild(statCard(s["now.phase"], clock ? s["phase." + clock.phase] : s["phase.unknown"], ""));
    pane.appendChild(cards);

    /* 身心速览：只抽三项，填满此刻页留白，同时避免与“身心”页重复全量信息 */
    var quickKeys = ["willpower", "stress", "trauma"];
    var quickVitals = (model.vitals || []).filter(function (v) { return quickKeys.indexOf(v.key) >= 0; });
    if (quickVitals.length) {
      var quick = el("div", "ml-quick");
      var quickHead = el("div", "ml-quick-h");
      quickHead.textContent = s["now.quick"];
      quick.appendChild(quickHead);
      var quickGrid = el("div", "ml-quick-grid");
      quickVitals.forEach(function (v) {
        var cell = el("div", "ml-quick-i");
        var top = el("div", "ml-quick-top");
        var dot = el("i", "ml-quick-dot " + barTone(v.key));
        var name = el("span", "ml-quick-k");
        name.textContent = s["vital." + v.key];
        var val = el("span", "ml-quick-v");
        val.textContent = String(v.value);
        top.appendChild(dot); top.appendChild(name); top.appendChild(val);
        var track = el("span", "ml-quick-track");
        var fill = el("i", "ml-bar-fill " + barTone(v.key));
        fill.style.width = String(Math.max(0, Math.min(100, v.pct))) + "%";
        track.appendChild(fill);
        cell.appendChild(top); cell.appendChild(track);
        quickGrid.appendChild(cell);
      });
      quick.appendChild(quickGrid);
      pane.appendChild(quick);
    }

    renderBridge(pane, model.thirdParty);

    if (model.degraded) {
      var warn = el("p", "ml-note is-warn");
      warn.textContent = s["misc.degraded"];
      pane.appendChild(warn);
    }
  }

  function renderBridge(pane, bridge) {
    if (!bridge) { return; }
    var s = C.strings(state.lang);
    var rows = [];
    var dyn = bridge.dynamicest;
    var deco = bridge.decorations;
    if (dyn && dyn.installed) {
      var dynMeta = dyn.initialized
        ? C.fmt(s["bridge.dynMeta"], {
            flash: onOff(dyn.flash), bar: onOff(dyn.timebar),
            opacity: dyn.opacity === null || dyn.opacity === undefined ? "?" : Math.round(Math.max(0, Math.min(1, dyn.opacity)) * 100)
          })
        : s["bridge.uninit"];
      rows.push(bridgeRow("dynamicest", s["bridge.dyn"], dynMeta, s));
    }
    if (deco && deco.installed) {
      var decoMeta = deco.initialized
        ? C.fmt(s["bridge.decoMeta"], {
            fg: deco.foreground || s["bridge.none"],
            bg: deco.background || s["bridge.none"],
            auto: onOff(deco.autoBackground)
          })
        : s["bridge.uninit"];
      rows.push(bridgeRow("decorations", s["bridge.deco"], decoMeta, s));
    }
    if (!rows.length) { return; }

    var wrap = el("div", "ml-bridge", { "aria-label": s["bridge.title"] });
    var head = el("div", "ml-bridge-h");
    var title = el("span", "ml-bridge-title"); title.textContent = s["bridge.title"];
    var note = el("span", "ml-bridge-note"); note.textContent = s["bridge.note"];
    head.appendChild(title); head.appendChild(note); wrap.appendChild(head);
    rows.forEach(function (row) { wrap.appendChild(row); });
    pane.appendChild(wrap);
    pane.addEventListener("click", function (ev) {
      var node = ev.target;
      while (node && node !== pane) {
        var kind = node.getAttribute && node.getAttribute("data-ml-bridge");
        if (kind) { ev.preventDefault(); openThirdParty(kind); return; }
        node = node.parentNode;
      }
    });
  }

  function bridgeRow(kind, name, meta, s) {
    var row = el("div", "ml-bridge-row");
    var main = el("div", "ml-bridge-main");
    var k = el("span", "ml-bridge-name"); k.textContent = name;
    var v = el("span", "ml-bridge-meta"); v.textContent = meta;
    main.appendChild(k); main.appendChild(v);
    var btn = el("button", "ml-btn ml-bridge-open", { type: "button", "data-ml-bridge": kind });
    btn.textContent = s["bridge.open"];
    row.appendChild(main); row.appendChild(btn);
    return row;
  }

  function onOff(value) {
    if (value === null || value === undefined) { return "?"; }
    return value ? C.strings(state.lang)["bridge.on"] : C.strings(state.lang)["bridge.off"];
  }

  function controlVisible(n) {
    if (!n || n.disabled) { return false; }
    if (doc.documentElement.contains && !doc.documentElement.contains(n)) { return false; }
    /* 灯台自己的浮卡也在这个文档里；不能把卡里的同名按钮当成第三方入口。 */
    if (n.closest && n.closest("#ml-root")) { return false; }
    try {
      var cs = window.getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) { return false; }
    } catch (e) { /* ignore */ }
    if (n.offsetParent !== null) { return true; }
    /* position:fixed 的控件 offsetParent 可能为 null，退回真实几何。 */
    try {
      var r = n.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    } catch (e2) { return false; }
  }

  function findButton(root, rx, allowAnchor) {
    if (!root) { return null; }
    var nodes = root.querySelectorAll("button,input[type=button],a");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      /* 原生 Options 只认按钮；第三方入口可能是 <a>，由 allowAnchor 放行。 */
      if (!allowAnchor && n.tagName === "A") { continue; }
      var label = n.tagName === "INPUT" ? n.value : (n.textContent || "");
      if (rx.test(label.trim()) && controlVisible(n)) { return n; }
    }
    return null;
  }

  function findOptionsButton() {
    /* 原生 Options 是按钮；不要扩大到全文档 <a>，否则正文里恰好叫“选项”的链接会被误认。 */
    return findButton(doc, /^(选项|Options)$/i, false);
  }

  function findOverlayButton(kind) {
    var rx = kind === "dynamicest" ? /极致动态|Dynamicest/i : /前景背景|DecoMod/i;
    /* decorations 的入口由 MapleBirch 的 MenuSmall 注入在侧栏
       #overlayButtons（FEATS 旁），并不在 #customOverlay 里；先查弹层，
       再查侧栏和菜单。 */
    var roots = [
      doc.getElementById("customOverlay"),
      doc.getElementById("overlayButtons"),
      doc.getElementById("ui-bar"),
      doc.getElementById("menu")
    ];
    for (var i = 0; i < roots.length; i++) {
      var hit = findButton(roots[i], rx, true);
      if (hit) { return hit; }
    }
    return null;
  }

  function openThirdParty(kind) {
    var existing = findOverlayButton(kind);
    if (existing) {
      closePanel("bridge");
      setTimeout(function () { existing.click(); }, 260);
      return;
    }
    var options = findOptionsButton();
    if (!options) { toast(text("bridge.openFail")); return; }
    closePanel("bridge");
    try { options.click(); } catch (e) { toast(text("bridge.openFail")); return; }
    setTimeout(function () {
      var target = findOverlayButton(kind);
      if (target) { target.click(); }
      else { toast(text("bridge.openFail")); }
    }, 450);
  }

  function barTone(key) {
    if (key === "willpower") { return "is-jade"; }
    if (key === "stress") { return "is-amber"; }
    if (key === "trauma") { return "is-danger"; }
    if (key === "arousal") { return "is-rose"; }
    return "is-cool";
  }

  function renderVitals(pane, model) {
    var s = C.strings(state.lang);
    var list = el("div", "ml-vitals");
    var shown = 0;
    (model.vitals || []).forEach(function (v) {
      shown++;
      var row = el("div", "ml-vrow");
      var k = el("span", "ml-vrow-k");
      k.textContent = s["vital." + v.key];
      var bar = el("span", "ml-bar");
      var fill = el("i", "ml-bar-fill " + barTone(v.key));
      fill.style.width = String(Math.max(0, Math.min(100, v.pct))) + "%";
      bar.appendChild(fill);
      var val = el("span", "ml-vrow-v");
      val.textContent = String(Math.round(v.value));
      if (v.max !== null && v.max !== undefined) {
        var small = el("small");
        small.textContent = "/" + Math.round(v.max) + (v.over ? " ↑" : "");
        val.appendChild(small);
      }
      row.appendChild(k); row.appendChild(bar); row.appendChild(val);
      list.appendChild(row);
    });
    if (!shown) {
      var none = el("p", "ml-note");
      none.textContent = s["vital.none"];
      pane.appendChild(none);
    } else {
      pane.appendChild(list);
      if (model.missingVitals) {
        var miss = el("p", "ml-note is-warn");
        miss.textContent = C.fmt(s["vital.missing"], { n: model.missingVitals });
        pane.appendChild(miss);
      }
    }
  }

  function renderWorn(pane, model) {
    var s = C.strings(state.lang);
    var labels = C.SLOT_LABELS[state.lang] || C.SLOT_LABELS.zh;
    var head = el("p", "ml-note");
    head.textContent = C.fmt(s["worn.count"], { n: model.wornCount || 0, total: (model.worn || []).length });
    pane.appendChild(head);

    var grid = el("div", "ml-worn");
    (model.worn || []).forEach(function (w) {
      var cell = el("div", "ml-slot");
      var sk = el("span", "ml-slot-k");
      sk.textContent = labels[w.slot] || w.slot;
      var shown = state.lang === "zh" && w.cn ? w.cn : w.name;
      var sv = el("span", "ml-slot-v" + (shown ? "" : " is-empty"));
      sv.textContent = shown || s["worn.empty"];
      if (shown) { sv.setAttribute("title", w.cn && w.name ? w.cn + " · " + w.name : shown); }
      cell.appendChild(sk); cell.appendChild(sv);
      grid.appendChild(cell);
    });
    pane.appendChild(grid);

    var note = el("p", "ml-note is-faint");
    note.textContent = s["worn.note"];
    pane.appendChild(note);
  }

  function dlRow(key, value) {
    var row = el("div", "ml-dl-row");
    var dt = el("dt"); dt.textContent = key;
    var dd = el("dd"); dd.textContent = value;
    row.appendChild(dt); row.appendChild(dd);
    return row;
  }

  function viewportLabel() {
    var w = window.innerWidth || 0;
    var h = window.innerHeight || 0;
    return w + " × " + h;
  }

  function renderSystem(pane) {
    var s = C.strings(state.lang);
    var dl = el("dl", "ml-dl");

    dl.appendChild(dlRow(s["sys.version"], "v" + C.VERSION));
    dl.appendChild(dlRow(s["sys.game"], getGameVersion() || "—"));
    dl.appendChild(dlRow(s["sys.sugar"], getSugarVersion() || "—"));
    dl.appendChild(dlRow(s["sys.host"], state.host ? s["host.on"].replace("{ver}", String(state.host.apiVersion)) : s["host.none"]));
    dl.appendChild(dlRow(s["sys.layout"], viewportLabel() + (state.sheet ? " · sheet" : " · float")));
    dl.appendChild(dlRow(s["sys.storage"], state.storageOK ? s["storage.ok"] : s["storage.no"]));
    dl.appendChild(dlRow(s["sys.motion"], state.settings.motion ? s["motion.system"] : s["motion.off"]));
    dl.appendChild(dlRow(s["sys.mode"], state.settings.theme === "auto" ? s["mode.auto"] : s["mode.manual"]));
    pane.appendChild(dl);

    var copy = el("button", "ml-btn ml-btn-wide", { type: "button" });
    copy.appendChild(svg("copy"));
    var span = el("span"); span.textContent = s["system.copy"];
    copy.appendChild(span);
    copy.addEventListener("click", function () {
      var payload = JSON.stringify(C.buildDiagnostics({
        game: getGameVersion(),
        sugarCube: getSugarVersion(),
        host: state.host,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        breakpoint: state.sheet ? "sheet" : "float",
        storage: state.storageOK,
        reducedMotion: !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches),
        theme: state.settings.theme,
        lang: state.lang,
        repaired: state.repaired,
        stateReadable: !!getVars(),
        at: new Date().toISOString()
      }), null, 2);
      copyText(payload).then(function (ok) { toast(ok ? s["system.copied"] : s["system.copyFail"]); });
    });
    pane.appendChild(copy);
  }

  function copyText(value) {
    return new Promise(function (resolve) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(function () { resolve(true); }, function () { resolve(false); });
          return;
        }
      } catch (e) { /* fall through */ }
      try {
        var ta = doc.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        doc.body.appendChild(ta);
        ta.select();
        var ok = doc.execCommand && doc.execCommand("copy");
        doc.body.removeChild(ta);
        resolve(!!ok);
      } catch (e2) { resolve(false); }
    });
  }

  /* 原生模块开关：只控制原版 UI 的替换层，不控制灯台浮窗自己的页签/页脚。 */
  function renderSwitches(pane) {
    var s = C.strings(state.lang);
    var note = el("p", "ml-note");
    note.textContent = s["switches.note"];
    pane.appendChild(note);

    var items = [
      { key: "optStats", label: s["opt.stats"], hint: s["opt.statsHint"] },
      { key: "optMoney", label: s["opt.money"], hint: s["opt.moneyHint"] },
      { key: "optRailSkin", label: s["opt.railSkin"], hint: s["opt.railSkinHint"] },
      { key: "optRailPct", label: s["opt.railPct"], hint: s["opt.railPctHint"] },
      { key: "optMeterSkin", label: s["opt.meterSkin"], hint: s["opt.meterSkinHint"] },
      { key: "optMeterValue", label: s["opt.meterValue"], hint: s["opt.meterValueHint"] },
      { key: "optOptions", label: s["opt.options"], hint: s["opt.optionsHint"] },
      { key: "optSidebar", label: s["opt.sidebar"], hint: s["opt.sidebarHint"] },
      { key: "optOverlay", label: s["opt.overlay"], hint: s["opt.overlayHint"] }
    ];

    items.forEach(function (item) {
      var box = el("div", "ml-field ml-field--opt", { "data-opt-key": item.key });
      var k = el("div", "ml-field-k");
      var label = el("span", "ml-field-label");
      label.textContent = item.label;
      k.appendChild(label);
      var hint = el("p", "ml-note is-faint");
      hint.textContent = item.hint;
      k.appendChild(hint);
      var wrap = el("div", "ml-switch-wrap");
      var sw = el("button", "ml-switch", {
        type: "button", role: "switch",
        "aria-checked": state.settings[item.key] === false ? "false" : "true",
        "aria-label": item.label
      });
      sw.appendChild(el("span", "ml-knob", { "aria-hidden": "true" }));
      sw.addEventListener("click", function () {
        var next = state.settings[item.key] === false;
        state.settings[item.key] = next;
        sw.setAttribute("aria-checked", next ? "true" : "false");
        setSetting(item.key, next, false);
      });
      wrap.appendChild(sw);
      box.appendChild(k); box.appendChild(wrap);
      pane.appendChild(box);
    });
  }

  function renderSettings(pane) {
    var s = C.strings(state.lang);

    function field(title, control) {
      var box = el("div", "ml-field");
      var k = el("div", "ml-field-k");
      k.textContent = title;
      box.appendChild(k); box.appendChild(control);
      return box;
    }

    function segmented(options, current, onPick, modifier) {
      var group = el("div", modifier ? "ml-seg " + modifier : "ml-seg", { role: "radiogroup" });
      options.forEach(function (opt) {
        var btn = el("button", opt.preview ? "ml-seg-btn ml-theme-tile" : "ml-seg-btn", {
          type: "button", role: "radio",
          "aria-checked": current === opt.value ? "true" : "false",
          "data-value": opt.value
        });
        if (opt.preview) {
          /* 设置页里的主题卡只读该主题调色板：卡内场景走 --ml-pv-*，
             卡片自身仍是当前已生效主题的控件，不整体切主题造成闪烁。 */
          var palette = C.paletteFor(opt.value);
          var pv = {
            "--ml-pv-bg": palette.bg,
            "--ml-pv-soft": palette.bgSoft,
            "--ml-pv-raise": palette.bgRaise,
            "--ml-pv-text": palette.text,
            "--ml-pv-muted": palette.muted,
            "--ml-pv-line": palette.line,
            "--ml-pv-accent": palette.accent,
            "--ml-pv-accent-ink": palette.accentInk,
            "--ml-pv-jade": palette.jade,
            "--ml-pv-rose": palette.rose
          };
          Object.keys(pv).forEach(function (k) { btn.style.setProperty(k, pv[k]); });
          btn.setAttribute("data-theme-preview", opt.value);
          btn.title = opt.label;
          var scene = el("span", "ml-theme-scene", { "aria-hidden": "true" });
          var name = el("span", "ml-theme-name");
          name.textContent = opt.label;
          btn.appendChild(scene); btn.appendChild(name);
        } else {
          btn.textContent = opt.label;
        }
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

    switchControl("native", s["settings.native"], s["settings.nativeHint"]);
    switchControl("panel", s["settings.panel"], s["settings.panelHint"]);
    switchControl("thirdPartyNative", s["settings.thirdPartyNative"], s["settings.thirdPartyNativeHint"]);

    pane.appendChild(field(s["settings.theme"], segmented([
      { value: "auto", label: s["theme.auto"], preview: "auto" },
      { value: "cyberpunk", label: s["theme.cyberpunk"], preview: "cyberpunk" },
      { value: "amber", label: s["theme.amber"], preview: "amber" },
      { value: "jade", label: s["theme.jade"], preview: "jade" },
      { value: "star", label: s["theme.star"], preview: "star" },
      { value: "fog", label: s["theme.fog"], preview: "fog" },
      { value: "school", label: s["theme.school"], preview: "school" },
      { value: "paper", label: s["theme.paper"], preview: "paper" },
      { value: "grass", label: s["theme.grass"], preview: "grass" }
    ], state.settings.theme, function (v) {
      setSetting("theme", v, false);
      if (colorCtl) { colorCtl.refresh(); }
    }, "ml-seg--themes")));

    switchControl("ornament", s["settings.ornament"], s["settings.ornamentHint"]);

    /* 正文文字色：预设直接取自当前主题调色板（都过 4.5:1），
       自定义走原生取色器并当场校验，不合格就不落值。
       换主题只重画这一行色点，不重建整页（焦点与滚动位置都保留）。 */
    function colorControl() {
      var wrap = el("div", "ml-color", { role: "radiogroup", "aria-label": s["settings.textColor"] });

      function paint() {
        while (wrap.firstChild) { wrap.removeChild(wrap.firstChild); }
        var theme = state.settings.theme;
        var current = state.settings.textColor;
        var choices = C.textColorChoices(theme);
        var known = choices.some(function (c) { return c.value === current; });

        choices.forEach(function (choice) {
          var isAuto = choice.value === "auto";
          var label = isAuto ? s["textColor.auto"] : choice.value;
          var dot = el("button", isAuto ? "ml-color-dot is-auto" : "ml-color-dot", {
            type: "button", role: "radio",
            "aria-checked": current === choice.value ? "true" : "false",
            "aria-label": label, title: label
          });
          dot.style.setProperty("--ml-dot", choice.swatch);
          dot.addEventListener("click", function () {
            setSetting("textColor", choice.value, true);
          });
          wrap.appendChild(dot);
        });

        var custom = el("button", "ml-color-dot is-custom", {
          type: "button", role: "radio",
          "aria-checked": (current !== "auto" && !known) ? "true" : "false",
          "aria-label": s["textColor.custom"], title: s["textColor.custom"]
        });
        var input = doc.createElement("input");
        input.type = "color";
        input.setAttribute("aria-label", s["textColor.custom"]);
        input.value = C.normalizeHex(current) || C.paletteFor(theme).text;
        input.addEventListener("change", function () {
          var hex = C.normalizeHex(input.value);
          if (!hex || !C.textColorFor(hex, theme)) {
            toast(text("toast.colorContrast"));
            input.value = C.normalizeHex(state.settings.textColor) || C.paletteFor(theme).text;
            return;
          }
          setSetting("textColor", hex, true);
        });
        custom.appendChild(input);
        wrap.appendChild(custom);
      }

      paint();
      return { node: wrap, refresh: paint };
    }

    var colorCtl = colorControl();
    pane.appendChild(field(s["settings.textColor"], colorCtl.node));
    var colorHint = el("p", "ml-note is-faint");
    colorHint.textContent = s["settings.textColorHint"];
    pane.appendChild(colorHint);

    function rangeControl(key, min, max, step, label, format) {
      var wrap = el("div", "ml-scale");
      var slider = el("div", "ml-slider", {
        role: "slider", tabindex: "0", "data-key": key,
        "aria-valuemin": String(min), "aria-valuemax": String(max),
        "aria-valuenow": String(state.settings[key]),
        "aria-valuetext": format(state.settings[key]),
        "aria-label": label
      });
      var track = el("div", "ml-track");
      var fill = el("div", "ml-fill");
      var thumb = el("div", "ml-thumb");
      track.appendChild(fill);
      track.appendChild(thumb);
      slider.appendChild(track);
      var out = el("output", "ml-range-out");
      out.textContent = format(state.settings[key]);

      function paint() {
        var v = state.settings[key];
        var pct = (v - min) / (max - min) * 100;
        fill.style.width = pct + "%";
        thumb.style.left = pct + "%";
        slider.setAttribute("aria-valuenow", String(v));
        slider.setAttribute("aria-valuetext", format(v));
        out.textContent = format(v);
      }

      function setValue(v, persist) {
        var next = Math.max(min, Math.min(max, Math.round(v / step) * step));
        if (next === state.settings[key]) { paint(); return; }
        state.settings[key] = next;
        paint();
        applySettings();
        if (persist) { saveSettings(); }
      }

      function valueFromX(clientX) {
        var r = track.getBoundingClientRect();
        var p = r.width ? (clientX - r.left) / r.width : 0;
        return min + Math.max(0, Math.min(1, p)) * (max - min);
      }

      slider.addEventListener("pointerdown", function (ev) {
        ev.preventDefault();
        slider.focus();
        setValue(valueFromX(ev.clientX), false);
        var move = function (e) { setValue(valueFromX(e.clientX), false); };
        var end = function () {
          doc.removeEventListener("pointermove", move);
          doc.removeEventListener("pointerup", end);
          doc.removeEventListener("pointercancel", end);
          saveSettings();
        };
        doc.addEventListener("pointermove", move);
        doc.addEventListener("pointerup", end);
        doc.addEventListener("pointercancel", end);
      });

      slider.addEventListener("keydown", function (ev) {
        var kstep = ev.shiftKey ? Math.max(step, 10) : step;
        if (ev.key === "ArrowRight" || ev.key === "ArrowUp") { setValue(state.settings[key] + kstep, true); ev.preventDefault(); }
        else if (ev.key === "ArrowLeft" || ev.key === "ArrowDown") { setValue(state.settings[key] - kstep, true); ev.preventDefault(); }
        else if (ev.key === "Home") { setValue(min, true); ev.preventDefault(); }
        else if (ev.key === "End") { setValue(max, true); ev.preventDefault(); }
      });

      paint();
      wrap.appendChild(slider);
      wrap.appendChild(out);
      pane.appendChild(field(label, wrap));

      return {
        set: function (v) { setValue(v, true); },
        refresh: paint
      };
    }

    var scaleCtl = rangeControl("scale", 80, 140, 5, s["settings.scale"], function (v) { return v + "%"; });
    var glassCtl = rangeControl("glass", 0, 100, 5, s["settings.glass"], function (v) { return v + "%"; });
    var glassHint = el("p", "ml-note is-faint");
    glassHint.textContent = s["settings.glassHint"];
    pane.appendChild(glassHint);

    pane.appendChild(field(s["settings.density"], segmented([
      { value: "cozy", label: s["density.cozy"] },
      { value: "compact", label: s["density.compact"] }
    ], state.settings.density, function (v) { setSetting("density", v, false); })));

    function switchControl(key, label, hintText) {
      var wrap = el("div", "ml-switch-wrap");
      var sw = el("button", "ml-switch", {
        type: "button", role: "switch",
        "aria-checked": state.settings[key] ? "true" : "false",
        "aria-label": label
      });
      var knob = el("span", "ml-knob", { "aria-hidden": "true" });
      sw.appendChild(knob);
      sw.addEventListener("click", function () {
        var next = !state.settings[key];
        sw.setAttribute("aria-checked", next ? "true" : "false");
        setSetting(key, next, false);
      });
      wrap.appendChild(sw);
      pane.appendChild(field(label, wrap));
      if (hintText) {
        var hintNode = el("p", "ml-note is-faint");
        hintNode.textContent = hintText;
        pane.appendChild(hintNode);
      }
      return sw;
    }

    switchControl("motion", s["settings.motion"], s["settings.motionHint"]);

    pane.appendChild(field(s["settings.lang"], segmented([
      { value: "auto", label: s["lang.auto"] },
      { value: "zh", label: s["lang.zh"] },
      { value: "en", label: s["lang.en"] }
    ], state.settings.lang, function (v) { setSetting("lang", v); })));

    pane.appendChild(field(s["settings.position"], segmented([
      { value: "left", label: s["pos.left"] },
      { value: "right", label: s["pos.right"] }
    ], state.settings.side, function (v) {
      state.settings.side = v;
      saveSettings();
      placeOrb();
      renderSettingsPaneRefresh();
    })));

    var resets = el("div", "ml-resets");
    function resetBtn(label, fn) {
      var b = el("button", "ml-btn ml-btn-quiet", { type: "button" });
      b.appendChild(svg("reset"));
      var sp = el("span"); sp.textContent = label;
      b.appendChild(sp);
      b.addEventListener("click", fn);
      return b;
    }
    resets.appendChild(resetBtn(s["reset.scale"], function () { scaleCtl.set(100); }));
    resets.appendChild(resetBtn(s["reset.glass"], function () { glassCtl.set(60); }));
    resets.appendChild(resetBtn(s["reset.density"], function () { setSetting("density", "cozy"); }));
    resets.appendChild(resetBtn(s["reset.theme"], function () { setSetting("theme", "auto"); }));
    resets.appendChild(resetBtn(s["reset.textColor"], function () { setSetting("textColor", "auto", true); }));
    resets.appendChild(resetBtn(s["reset.pos"], function () {
      state.settings.side = D.side; state.settings.y = D.y;
      saveSettings(); placeOrb(); renderSettingsPaneRefresh();
    }));
    pane.appendChild(resets);
  }

  function renderSettingsPaneRefresh() {
    if (state.tab === "settings") { renderActive(); }
  }

  /* ---------------------------------------------------------------- 开关面板 */

  function focusables() {
    if (!els.panel) { return []; }
    return Array.prototype.filter.call(
      els.panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (node) { return !node.disabled && node.offsetParent !== null; }
    );
  }

  function markPanelScrolling() {
    if (!state.open || !els.panel) { return; }
    els.panel.setAttribute("data-scrolling", "1");
    clearTimeout(state.scrollTimer);
    state.scrollTimer = window.setTimeout(function () {
      if (els.panel) { els.panel.removeAttribute("data-scrolling"); }
    }, 160);
  }

  function openPanel() {
    if (!els.panel || state.open) { return; }
    state.open = true;
    state.lastFocus = doc.activeElement;
    clearTimeout(state.closeTimer);
    els.panel.hidden = false;
    els.panel.setAttribute("data-open", "0");
    els.root.setAttribute("data-open", "1");
    els.orb.setAttribute("aria-expanded", "true");
    if (state.sheet) {
      els.scrim.hidden = false;
      els.scrim.setAttribute("data-on", "1");
      els.orb.setAttribute("aria-hidden", "true");
    }

    renderActive();
    syncPanelOrigin();
    syncTabGlint();
    var first = els.tabs && els.tabs.querySelector('[data-tab="' + state.tab + '"]');
    if (first) {
      first.focus();
      try { first.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) { /* ignore */ }
    }
    requestAnimationFrame(function () {
      if (els.panel && state.open) { els.panel.setAttribute("data-open", "1"); }
    });
    doc.addEventListener("pointerdown", onDocPointer, true);
  }

  /* 面板从球心长出来：把球心换算成面板内坐标，写进 transform-origin 变量。
     量不到尺寸（隐藏/旧档/jsdom）时 core 会退回 50% 100%，不会写 NaN。 */
  function syncPanelOrigin() {
    if (!els.panel || !els.orb) { return; }
    /* 用布局坐标而不是 getBoundingClientRect：面板此刻还带着 translateY(10px) scale(.98)，
       量 rect 会把过渡中的形变一起算进去，原点会偏。offset 系列不含 transform。 */
    var box = {
      left: els.panel.offsetLeft,
      top: els.panel.offsetTop,
      width: els.panel.offsetWidth,
      height: els.panel.offsetHeight
    };
    /* 球 rect 已乘过 body zoom，面板 offset 没有；先除以 zoom 再进同一坐标系。 */
    var vp = viewport();
    var rect = els.orb.getBoundingClientRect();
    var orb = {
      left: rect.left / vp.zoom,
      top: rect.top / vp.zoom,
      width: rect.width / vp.zoom,
      height: rect.height / vp.zoom
    };
    var o = C.panelOrigin(box, orb);
    els.panel.style.setProperty("--ml-origin-x", o.x);
    els.panel.style.setProperty("--ml-origin-y", o.y);
  }

  function closePanel(reason) {
    if (!els.panel || !state.open) { return; }
    state.open = false;
    /* 关闭前重算一次：切页签会改面板高度，上次打开算的原点已经过期。 */
    syncPanelOrigin();
    if (els.panel) { els.panel.removeAttribute("data-light"); }
    clearTimeout(state.scrollTimer);
    els.panel.removeAttribute("data-scrolling");
    els.panel.setAttribute("data-open", "0");
    els.root.setAttribute("data-open", "0");
    els.orb.setAttribute("aria-expanded", "false");
    els.orb.removeAttribute("aria-hidden");
    els.scrim.hidden = true;
    els.scrim.removeAttribute("data-on");
    doc.removeEventListener("pointerdown", onDocPointer, true);

    var delay = prefersReduced() || !state.settings.motion ? 0 : 160;
    clearTimeout(state.closeTimer);
    state.closeTimer = setTimeout(function () {
      if (!state.open && els.panel) { els.panel.hidden = true; }
    }, delay);

    if (state.sheet) {
      var story = doc.getElementById("passages") || doc.getElementById("story");
      if (story) {
        try {
          story.setAttribute("tabindex", "-1");
          story.focus();
          story.removeAttribute("tabindex");
        } catch (e) { /* 焦点交还给游戏正文，失败则留在原地 */ }
      }
    } else if (state.lastFocus && state.lastFocus.focus) {
      try { state.lastFocus.focus(); } catch (e) { /* ignore */ }
    }
    if (els.grip) { els.grip.style.transform = ""; }
  }

  function togglePanel() {
    if (state.open) { closePanel("toggle"); } else { openPanel(); }
  }

  function onDocPointer(e) {
    if (!state.open) { return; }
    var t = e.target;
    if (els.panel && els.panel.contains(t)) { return; }
    if (els.orb && els.orb.contains(t)) { return; }
    if (state.sheet) { return; }
    closePanel("outside");
  }

  function onPanelKey(e) {
    if (e.key === "Escape") { e.stopPropagation(); closePanel("escape"); return; }
    if (e.key !== "Tab") { return; }
    var list = focusables();
    if (!list.length) { return; }
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function prefersReduced() {
    try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); }
    catch (e) { return false; }
  }

  /* 凝光：只在精确指针（鼠标/触控笔）下启用，触摸端退回主题固定光源。
     每帧只写两个 CSS 变量，面板背景层跟着重绘，不新建节点、不改布局。 */
  function sheenAllowed() {
    if (!state.settings.motion || prefersReduced()) { return false; }
    try {
      if (window.matchMedia && !window.matchMedia("(pointer: fine)").matches) { return false; }
    } catch (e) { return false; }
    return true;
  }

  var sheenRaf = 0;

  function bindSheen() {
    if (!els.panel) { return; }
    els.panel.addEventListener("pointermove", function (ev) {
      if (!state.open || ev.pointerType === "touch" || !sheenAllowed()) { return; }
      if (sheenRaf) { return; }
      var x = ev.clientX;
      var y = ev.clientY;
      sheenRaf = window.requestAnimationFrame(function () {
        sheenRaf = 0;
        if (!els.panel || !state.open) { return; }
        var r = els.panel.getBoundingClientRect();
        if (!r.width || !r.height) { return; }
        var px = Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100));
        var py = Math.max(-10, Math.min(110, ((y - r.top) / r.height) * 100));
        els.panel.style.setProperty("--ml-light-x", px.toFixed(1) + "%");
        els.panel.style.setProperty("--ml-light-y", py.toFixed(1) + "%");
        els.panel.setAttribute("data-light", "1");
      });
    }, { passive: true });
    els.panel.addEventListener("pointerleave", function () {
      if (els.panel) { els.panel.removeAttribute("data-light"); }
    });
  }

  /* 后台暂停：只暂停动画播放，不改状态；回到前台自动续播。 */
  function onVisibility() {
    if (!els.root) { return; }
    els.root.setAttribute("data-paused", doc.hidden ? "1" : "0");
  }

  /* ---------------------------------------------------------------- 拖动 */

  function onOrbDown(e) {
    if (e.button !== undefined && e.button !== 0) { return; }
    /* 第二根手指不接管：同一时间只允许一个指针按住球。
       注意不能拿 orbDrag 当锁：它要留 220ms 吞掉拖拽尾随的 click。 */
    if (state.orbPointer !== null) { return; }
    var id = e.pointerId;
    state.orbPointer = id;
    var startClientX = e.clientX, startClientY = e.clientY;
    var startX = startClientX / viewport().zoom;
    var startY = startClientY / viewport().zoom;
    var moved = false;
    state.orbDrag = "pending";
    var size = els.orb.offsetWidth || 56;
    var baseLeft = parseFloat(els.orb.style.left) || 0;
    var baseTop = parseFloat(els.orb.style.top) || 0;
    var last = { left: baseLeft, top: baseTop };
    try { els.orb.setPointerCapture(id); } catch (err) { /* ignore */ }

    /* 边缘橡皮筋：拖出可视区只跟 35%，最多 18px，松手弹回。 */
    function rubber(value, min, max) {
      if (value < min) { return min - Math.min(18, (min - value) * .35); }
      if (value > max) { return max + Math.min(18, (value - max) * .35); }
      return value;
    }

    function onMove(ev) {
      var vp = viewport();
      var dx = (ev.clientX - startClientX) / vp.zoom;
      var dy = (ev.clientY - startClientY) / vp.zoom;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 6) {
        moved = true;
        state.orbDrag = "moved";
        els.root.setAttribute("data-dragging", "1");
      }
      if (!moved) { return; }
      size = els.orb.offsetWidth || size;
      var minLeft = 8, maxLeft = Math.max(8, vp.width - size - 8);
      var minTop = 56, maxTop = Math.max(56, vp.height - size - 12);
      var rawLeft = startX + dx - size / 2;
      var rawTop = startY + dy - size / 2;
      last.left = Math.max(minLeft, Math.min(maxLeft, rawLeft));
      last.top = Math.max(minTop, Math.min(maxTop, rawTop));
      els.orb.style.transform = "translate3d(" +
        Math.round(rubber(rawLeft, minLeft, maxLeft) - baseLeft) + "px," +
        Math.round(rubber(rawTop, minTop, maxTop) - baseTop) + "px,0) scale(1.04)";
    }

    function onUp() {
      state.orbPointer = null;
      els.orb.removeEventListener("pointermove", onMove);
      els.orb.removeEventListener("pointerup", onUp);
      els.orb.removeEventListener("pointercancel", onUp);
      els.orb.removeEventListener("lostpointercapture", onUp);
      if (!moved) {
        state.orbDrag = null;
        els.root.removeAttribute("data-dragging");
        return;
      }
      /* 位移先落到 left/top，transform 只留 scale：同一帧完成，不产生跳变；下一帧回弹到 1。 */
      els.orb.style.left = Math.round(last.left) + "px";
      els.orb.style.top = Math.round(last.top) + "px";
      els.orb.style.transform = "scale(1.04)";
      els.root.removeAttribute("data-dragging");
      window.requestAnimationFrame(function () {
        if (els.orb) { els.orb.style.transform = ""; }
      });
      var vp = viewport();
      state.settings.side = (last.left + size / 2) < vp.width / 2 ? "left" : "right";
      state.settings.y = Math.max(0.12, Math.min(0.92, (last.top + size / 2) / (vp.height || 1)));
      saveSettings();
      placeOrb();
      setTimeout(function () { state.orbDrag = null; }, 220);
    }

    els.orb.addEventListener("pointermove", onMove);
    els.orb.addEventListener("pointerup", onUp);
    els.orb.addEventListener("pointercancel", onUp);
    els.orb.addEventListener("lostpointercapture", onUp);
  }

  function onGripDown(e) {
    if (!state.sheet || !state.settings.motion) { return; }
    var startY = e.clientY;
    var active = true;
    var id = e.pointerId;
    var lastY = startY, lastT = e.timeStamp || Date.now(), vel = 0;
    try { els.grip.setPointerCapture(id); } catch (err) { /* ignore */ }

    function onMove(ev) {
      if (!active) { return; }
      var now = ev.timeStamp || Date.now();
      if (now > lastT) { vel = (ev.clientY - lastY) / (now - lastT); }
      lastY = ev.clientY; lastT = now;
      var dy = Math.max(0, ev.clientY - startY);
      els.panel.style.setProperty("--ml-sheet-drag", dy + "px");
      els.grip.style.transform = "translateY(" + dy + "px)";
    }
    function finish(ev, cancelled) {
      if (!active) { return; }
      active = false;
      els.grip.removeEventListener("pointermove", onMove);
      els.grip.removeEventListener("pointerup", onUp);
      els.grip.removeEventListener("pointercancel", onCancel);
      els.grip.removeEventListener("lostpointercapture", onCancel);
      els.panel.style.removeProperty("--ml-sheet-drag");
      els.grip.style.transform = "";
      if (cancelled) {
        /* 手势被系统取消（滚动接管/来电等）时只复位，不按取消时的坐标判关闭。 */
        return;
      }
      /* 动效按手势速度给时序：快甩 90ms 收住，慢拖 220ms 回弹。 */
      var ms = Math.abs(vel) > 1.2 ? 90 : Math.abs(vel) > .5 ? 150 : 220;
      els.panel.style.setProperty("--ml-sheet-dur", ms + "ms");
      if (ev.clientY - startY > 64) { closePanel("swipe"); }
      setTimeout(function () { if (els.panel) { els.panel.style.removeProperty("--ml-sheet-dur"); } }, ms + 60);
    }
    function onUp(ev) { finish(ev, false); }
    function onCancel(ev) { finish(ev, true); }
    els.grip.addEventListener("pointermove", onMove);
    els.grip.addEventListener("pointerup", onUp);
    els.grip.addEventListener("pointercancel", onCancel);
    els.grip.addEventListener("lostpointercapture", onCancel);
  }

  /* ---------------------------------------------------------------- 提示 */

  function toast(message) {
    if (!els.toast || !message) { return; }
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.setAttribute("data-on", "1");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (!els.toast) { return; }
      els.toast.removeAttribute("data-on");
      setTimeout(function () { if (els.toast) { els.toast.hidden = true; } }, 200);
    }, 2600);
  }

  /* ---------------------------------------------------------------- 事件 */

  var passagePending = false;

  function applyPassage() {
    if (state.disposed || state.failed) { return; }
    try {
      var clock = C.readModel({
        vars: getVars(), time: window.Time, constants: window.Constants,
        passage: getPassage(), lang: state.lang
      }).clock;
      updateOrb(clock);
      if (els.miniClock && clock) { els.miniClock.textContent = C.formatClock(clock.hour, clock.minute); }
      if (state.open && state.tab !== "settings") { renderActive(); }
      else { renderFooterStatus(); }
    } catch (e) { fail(e); }
  }

  function onPassage() {
    if (state.disposed || state.failed || passagePending) { return; }
    passagePending = true;
    var run = function () { passagePending = false; applyPassage(); };
    if (typeof window.requestAnimationFrame === "function") { window.requestAnimationFrame(run); }
    else { setTimeout(run, 0); }
  }

  function onResize() {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(function () {
      if (state.disposed) { return; }
      applySettings();
      applyLayout();
      if (state.open) {
        renderActive();
        syncPanelOrigin();
        syncTabGlint();
      }
    }, 150);
  }

  /* body.zoom 变化不派发 resize；观察 body[style]，有效缩放变了才重排。 */
  function watchZoom() {
    if (state.zoomObserver || typeof window.MutationObserver !== "function" || !doc.body) { return; }
    var last = viewport().zoom;
    state.zoomObserver = new window.MutationObserver(function () {
      if (state.disposed) { return; }
      var next = viewport().zoom;
      if (!isFinite(next) || Math.abs(next - last) < 0.005) { return; }
      last = next;
      onResize();
    });
    state.zoomObserver.observe(doc.body, { attributes: true, attributeFilter: ["style"] });
  }

  function onKeyDown(e) {
    if (state.disposed) { return; }
    var t = e.target;
    var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    if (typing) { return; }
    if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "l" || e.key === "L")) {
      e.preventDefault();
      togglePanel();
    } else if (e.key === "Escape" && state.open) {
      closePanel("escape");
    }
  }

  function fail(err) {
    state.failed = true;
    try {
      if (window.console && console.warn) { console.warn("[MapleLantern] disabled after error:", err && err.message ? err.message : err); }
    } catch (e) { /* ignore */ }
    try { destroy(); } catch (e2) { /* ignore */ }
  }

  function destroy() {
    if (state.disposed) { return; }
    state.disposed = true;
    state.open = false;
    clearTimeout(state.closeTimer);
    clearTimeout(state.scrollTimer);
    clearTimeout(toastTimer);
    clearTimeout(moveTimer);
    clearPressTimers();
    try {
      if (window.jQuery) { window.jQuery(doc).off(":passageend", onPassage); }
      doc.removeEventListener("passageend", onPassage);
      doc.removeEventListener("dol-ui-runtime-ready", syncHost);
      doc.removeEventListener("keydown", onKeyDown);
      doc.removeEventListener("pointerdown", onDocPointer, true);
      doc.removeEventListener("pointerdown", onPressFx, true);
      doc.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
      if (doc.body) { doc.body.removeEventListener("scroll", markPanelScrolling); }
      window.removeEventListener("scroll", markPanelScrolling);
    } catch (e) { /* ignore */ }
    if (state.zoomObserver) { state.zoomObserver.disconnect(); state.zoomObserver = null; }
    /* 子层各自持有 DOM / 观察器 / 全局监听；只拆渲染层会留下悬挂引用。 */
    [
      window.MapleLanternNative,
      window.MapleLanternDossierTheme,
      window.MapleLanternDossierPanel
    ].forEach(function (api) {
      if (!api || typeof api.destroy !== "function") { return; }
      try { api.destroy(); } catch (e2) { /* 任一子层失败不得阻断其余层 */ }
    });
    if (els.root && els.root.parentNode) { els.root.parentNode.removeChild(els.root); }
    els = {};
  }

  /* ---------------------------------------------------------------- 挂载 */

  var PRESS_SELECTOR = ".ml-btn,.ml-tab,.ml-seg-btn,.ml-icon,.ml-switch,.ml-quick,.ml-native-entry,.ml-option-group,a.link-internal.macro-link[data-ml-option=\"1\"]";
  var pressTimers = [];

  function clearPressTimers() {
    while (pressTimers.length) { clearTimeout(pressTimers.pop()); }
  }

  function onPressFx(e) {
    if (!els.root || prefersReduced() || !state.settings.motion) { return; }
    if (typeof e.button === "number" && e.button !== 0) { return; }
    var target = e.target;
    if (!target || typeof target.closest !== "function") { return; }
    var node = target.closest(".ml-option-group");
    if (!node) { node = target.closest(PRESS_SELECTOR); }
    if (!node) { return; }
    var inRoot = els.root.contains(node);
    var isEntry = node.classList.contains("ml-native-entry");
    var isOption = node.classList.contains("ml-option-group") ||
      (node.getAttribute && node.getAttribute("data-ml-option") === "1");
    if (!inRoot && !isEntry && !isOption) { return; }
    var pressedClass = inRoot ? "ml-is-pressed" : "mln-is-pressed";
    var hostClass = inRoot ? "ml-press-host" : "mln-press-host";
    var ringClass = inRoot ? "ml-press-ring" : "mln-press-ring";

    node.classList.add(pressedClass);
    var timer = setTimeout(function () {
      node.classList.remove(pressedClass);
      var idx = pressTimers.indexOf(timer);
      if (idx >= 0) { pressTimers.splice(idx, 1); }
    }, 160);
    pressTimers.push(timer);

    if (typeof e.clientX !== "number" || typeof e.clientY !== "number") { return; }
    var rect = node.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    if (!rect.width || !rect.height) { return; }
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
      x = rect.width / 2;
      y = rect.height / 2;
    }
    if (!node.classList.contains(hostClass)) { node.classList.add(hostClass); }
    var old = node.querySelectorAll("." + ringClass);
    Array.prototype.forEach.call(old, function (n) { if (n.parentNode) { n.parentNode.removeChild(n); } });
    var ring = el("span", ringClass, { "aria-hidden": "true" });
    ring.style.left = x + "px";
    ring.style.top = y + "px";
    node.appendChild(ring);
    setTimeout(function () { if (ring.parentNode) { ring.parentNode.removeChild(ring); } }, 520);
  }

  function bind() {
    var boundJq = false;
    try {
      if (window.jQuery) { window.jQuery(doc).on(":passageend", onPassage); boundJq = true; }
    } catch (e) { /* jQuery 异常时走原生兜底 */ }
    if (!boundJq) { doc.addEventListener("passageend", onPassage); }
    doc.addEventListener("dol-ui-runtime-ready", syncHost);
    doc.addEventListener("keydown", onKeyDown);
    doc.addEventListener("pointerdown", onPressFx, true);
    doc.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    window.addEventListener("resize", onResize, { passive: true });
    watchZoom();
  }

  function mount() {
    if (state.mounted) { return; }
    if (!doc.body) { setTimeout(mount, 30); return; }
    loadSettings();
    buildRoot();
    renderChrome();
    applySettings();
    syncHost();
    applyLayout();
    applyPassage();
    bind();
    syncNative();
    state.mounted = true;

    if (state.repaired) { toast(text("toast.repaired")); }
    else if (!state.storageOK) { toast(text("toast.storage")); }
  }

  function boot() {
    if (state.mounted || state.failed) { return; }
    try {
      if (doc.readyState === "loading") {
        doc.addEventListener("DOMContentLoaded", mount, { once: true });
        setTimeout(function () { if (!state.mounted) { mount(); } }, 400);
      } else {
        mount();
      }
    } catch (e) { fail(e); }
  }

  window.MapleLantern = {
    __mounted: true,
    version: C.VERSION,
    open: openPanel,
    close: function () { closePanel("api"); },
    toggle: togglePanel,
    destroy: destroy,
    reset: function () {
      try { window.localStorage.removeItem(C.STORAGE_KEY); } catch (e) { /* ignore */ }
      state.storageOK = true;
      state.settings = Object.assign({}, D);
      state.lang = C.pickLang(D.lang, navigator.language || "zh");
      applySettings(); renderChrome(); renderActive(); placeOrb(); syncNative();
    },
    diagnostics: function () {
      return C.buildDiagnostics({
        game: getGameVersion(), sugarCube: getSugarVersion(), host: state.host,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        breakpoint: state.sheet ? "sheet" : "float", storage: state.storageOK,
        reducedMotion: prefersReduced(), theme: state.settings && state.settings.theme,
        lang: state.lang, repaired: state.repaired, stateReadable: !!getVars(),
        renderMs: state.lastRenderMs,
        at: new Date().toISOString()
      });
    }
  };

  boot();
})();
