/* ============================================================================
 * 灯台 · MapleLantern — deco-panel.js
 * 布景工作台：设置页入口 + 九层图层面板 + 图库选择器 + 预设 + 滤镜 + 自动地点。
 *
 * 设计边界：
 * - 不改灯台 6 页签；入口注入设置页「恢复默认」之前，与 dossier-panel 同模式。
 * - 原「前景背景模组」实际接入渲染时显示「原模组接管」，本面板只写兼容变量，不抢渲染。
 * - 缩略图优先走 modUtils.getImage → data: URL；CSP 禁止 blob:。
 * ========================================================================== */
(function (root) {
  "use strict";

  var D = root.MapleLanternDeco;
  var C = root.MapleLanternCore;
  if (!D || !C) return;
  if (root.MapleLanternDecoPanel && root.MapleLanternDecoPanel.__ready) return;

  var doc = root.document;
  var MARK = "data-ml-deco-entry";
  var T = {
    zh: {
      title: "布景工作台",
      entry: "布景 / 前景背景",
      entryHint: "九层独立布景；原模组已接入渲染时自动让出渲染权。",
      open: "打开工作台",
      match: "匹配当前地点",
      close: "关闭",
      layers: "九层图层",
      layerBg: "背景",
      layerFg: "前景",
      select: "选择图片",
      clear: "清空",
      visible: "显示",
      z: "Z 序偏移",
      picker: "图库",
      search: "搜索地点 / 图片名",
      none: "无",
      custom: "自定义名称",
      source: "来源文件夹",
      apply: "应用",
      presets: "预设",
      presetName: "预设名称",
      savePreset: "保存当前到新槽位",
      applyPreset: "套用",
      overwrite: "覆盖",
      remove: "删除",
      noPresets: "还没有预设。",
      filter: "地点滤镜",
      autoBg: "自动地点背景",
      autoFilter: "按地点/时间/天气叠色",
      filterLayers: "作用层",
      filterHint: "只对背景层生效；前景不参与。",
      outside: "室外",
      indoors: "室内",
      current: "当前",
      chain: "地点链",
      autoSource: "自动匹配",
      modeNative: "灯台原生",
      modeExternal: "原模组接管",
      modeUnavailable: "未接入",
      unavailable: "宿主 Renderer 尚未就绪；进入游戏后会自动重试。",
      externalHint: "检测到原模组已接入渲染的九层：本面板只写兼容变量，渲染由原模组负责。",
      filterNote: "原模组接管时，滤镜颜色仍会写入；亮度由灯台原生模式消费。",
      empty: "未选择图片",
      saved: "已保存",
      reset: "恢复当前地点",
      unknown: "未知",
      loading: "载入中…",
      failed: "读取失败"
    },
    en: {
      title: "Scenery Workbench",
      entry: "Scenery / Foreground & Background",
      entryHint: "Nine independent layers; yields rendering to the original mod when present.",
      open: "Open workbench",
      match: "Match current location",
      close: "Close",
      layers: "Nine layers",
      layerBg: "Background",
      layerFg: "Foreground",
      select: "Choose image",
      clear: "Clear",
      visible: "Visible",
      z: "Z offset",
      picker: "Gallery",
      search: "Search location / image",
      none: "None",
      custom: "Custom name",
      source: "Source folder",
      apply: "Apply",
      presets: "Presets",
      presetName: "Preset name",
      savePreset: "Save current to new slot",
      applyPreset: "Apply",
      overwrite: "Overwrite",
      remove: "Delete",
      noPresets: "No presets yet.",
      filter: "Location filter",
      autoBg: "Auto location background",
      autoFilter: "Location / time / weather tint",
      filterLayers: "Layers",
      filterHint: "Background layers only; foreground is excluded.",
      outside: "Outdoor",
      indoors: "Indoor",
      current: "Current",
      chain: "Location chain",
      autoSource: "Auto match",
      modeNative: "Lantern native",
      modeExternal: "Original mod active",
      modeUnavailable: "Not connected",
      unavailable: "Host Renderer is not ready; it will retry after the game starts.",
      externalHint: "Original mod layers are attached to a render model: this panel only writes compatible variables; rendering stays with the original mod.",
      filterNote: "With the original mod active, tint colours are still written; brightness is consumed by native mode.",
      empty: "No image selected",
      saved: "Saved",
      reset: "Reset to current location",
      unknown: "Unknown",
      loading: "Loading…",
      failed: "Read failed"
    }
  };

  var state = {
    ui: null,
    modal: null,
    picker: null,
    pickerLayer: null,
    pickerQuery: "",
    pickerSource: "background1",
    observer: null,
    timer: 0,
    timers: [],
    token: 0,
    booted: false,
    bound: false,
    hostJq: null,
    imageCache: {},
    queue: [],
    active: 0
  };

  function later(fn, ms) {
    var id = root.setTimeout(function () {
      for (var i = 0; i < state.timers.length; i++) {
        if (state.timers[i] === id) { state.timers.splice(i, 1); break; }
      }
      fn();
    }, ms);
    state.timers.push(id);
    return id;
  }

  function clearTimers() {
    for (var i = 0; i < state.timers.length; i++) root.clearTimeout(state.timers[i]);
    state.timers = [];
    if (state.timer) { root.clearTimeout(state.timer); state.timer = 0; }
  }

  function lang() {
    var stored = null;
    try { stored = JSON.parse((root.localStorage && root.localStorage.getItem(C.STORAGE_KEY)) || "null"); } catch (e) { stored = null; }
    var safe = C.sanitizeSettings(stored);
    var nav = "";
    try { nav = root.navigator && (root.navigator.language || root.navigator.userLanguage); } catch (e) { nav = ""; }
    return C.pickLang(safe.value.lang, nav || "zh");
  }

  function t(key) {
    var table = T[lang()] || T.zh;
    return table[key] || T.zh[key] || key;
  }

  function vars() {
    var direct = null;
    try { direct = root.State && root.State.variables; } catch (e) { direct = null; }
    if (direct) return direct;
    try { return root.SugarCube && root.SugarCube.State && root.SugarCube.State.variables; } catch (e2) { return null; }
    return null;
  }

  function setup() {
    try { return root.setup; } catch (e) { return null; }
  }

  function el(tag, cls, attrs) {
    var node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (attrs) Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    return node;
  }

  function text(tag, value, cls) {
    var node = el(tag, cls);
    node.textContent = value === undefined || value === null ? "" : String(value);
    return node;
  }

  function button(label, cls, onClick) {
    var b = el("button", cls || "ml-btn", { type: "button" });
    b.textContent = label;
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  function panelOpen() {
    var panel = doc.getElementById("ml-panel");
    if (!panel) return true;
    var shell = doc.getElementById("ml-root");
    return panel.hidden !== true && (shell ? shell.getAttribute("data-open") === "1" : true);
  }

  function mode() {
    return D.mode();
  }

  function modeLabel() {
    var m = mode();
    if (m === D.MODE.native) return t("modeNative");
    if (m === D.MODE.external) return t("modeExternal");
    return t("modeUnavailable");
  }

  function refresh() {
    try { D.refresh(); } catch (e) { /* 不向游戏抛 */ }
    updateEntry();
    if (state.modal && !state.modal.hidden) syncStatus();
  }

  function setImage(layer, name) {
    var v = vars();
    if (!v) return;
    var normalized = D.normalizeName(name);
    v[layer.varKey] = normalized;
    v[layer.showKey] = true;
    if (layer.id === "background1") v.decoAutoBgEnabled = false;
    if (!v.decoImagePath || typeof v.decoImagePath !== "object") v.decoImagePath = {};
    if (normalized !== "none") {
      if (layer.id === "background1") delete v.decoImagePath[layer.id];
      else v.decoImagePath[layer.id] = D.libraryPath(normalized);
    } else {
      delete v.decoImagePath[layer.id];
    }
    refresh();
    if (state.modal && !state.modal.hidden) renderLayers();
  }

  function setVisible(layer, on) {
    var v = vars();
    if (!v) return;
    v[layer.showKey] = !!on;
    refresh();
  }

  function setZ(layer, value, labelNode) {
    var v = vars();
    if (!v) return;
    if (!v.decoImageZ || typeof v.decoImageZ !== "object") v.decoImageZ = {};
    var n = Math.max(-50, Math.min(50, Math.round(Number(value) || 0)));
    v.decoImageZ[layer.zKey] = n;
    if (labelNode) labelNode.textContent = (n > 0 ? "+" : "") + n;
    refresh();
  }

  /* ------------------------------------------------------------------ 图片 */

  function normalizeImageUrl(value) {
    if (typeof value !== "string" || !value) return "";
    if (value.indexOf("data:") === 0) return value;
    if (value.indexOf("blob:") === 0) return "";
    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 64) return "data:image/png;base64," + value;
    return value;
  }

  function imageKey(name, folder) { return folder + "/" + D.normalizeName(name); }

  function resolveImage(name, folder) {
    name = D.normalizeName(name);
    if (name === "none") return Promise.resolve("");
    var key = imageKey(name, folder || "background1");
    if (state.imageCache[key]) return Promise.resolve(state.imageCache[key]);
    var path = typeof D.libraryPath === "function" ? D.libraryPath(name) : "img/decorations/ml/background1/" + name + ".png";
    var modUtils = root.modUtils;
    if (modUtils && typeof modUtils.getImage === "function") {
      return Promise.resolve()
        .then(function () { return modUtils.getImage(path); })
        .then(function (value) {
          var url = normalizeImageUrl(value);
          if (url) state.imageCache[key] = url;
          return url;
        })
        .catch(function () { return path; });
    }
    state.imageCache[key] = path;
    return Promise.resolve(path);
  }

  function enqueueLoad(fn) {
    state.queue.push(fn);
    pump();
  }

  function pump() {
    while (state.active < 4 && state.queue.length) {
      var fn = state.queue.shift();
      state.active++;
      Promise.resolve().then(fn).catch(function () {}).then(function () {
        state.active--;
        pump();
      });
    }
  }

  function loadThumb(imgNode, name, folder, fallbackText) {
    if (!imgNode) return;
    var token = String(name) + "|" + String(folder);
    imgNode.__mlDecoToken = token;
    imgNode.removeAttribute("src");
    imgNode.alt = "";
    if (fallbackText) imgNode.setAttribute("data-empty", fallbackText);
    if (D.normalizeName(name) === "none") {
      imgNode.style.visibility = "hidden";
      return;
    }
    enqueueLoad(function () {
      return resolveImage(name, folder).then(function (url) {
        if (imgNode.__mlDecoToken !== token) return;
        if (!url) { imgNode.style.visibility = "hidden"; return; }
        imgNode.onload = function () { imgNode.style.visibility = "visible"; };
        imgNode.onerror = function () { imgNode.style.visibility = "hidden"; };
        imgNode.src = url;
      });
    });
  }

  /* ------------------------------------------------------------------ 入口 */

  function buildEntry() {
    var group = el("div", "ml-field ml-deco-entry", {});
    group.setAttribute(MARK, "1");
    var head = el("div", "ml-field-head");
    head.appendChild(text("span", t("entry"), "ml-field-label"));
    var badge = text("span", "", "ml-deco-badge");
    head.appendChild(badge);
    group.appendChild(head);
    group.appendChild(text("p", t("entryHint"), "ml-hint"));
    var status = text("p", "", "ml-deco-entry-status");
    group.appendChild(status);
    var actions = el("div", "ml-deco-entry-actions");
    actions.appendChild(button(t("open"), "ml-btn is-primary", function () { openWorkbench(); }));
    actions.appendChild(button(t("match"), "ml-btn", function () {
      var v = vars();
      if (!v) return;
      D.applyAutoBackground(v, setup(), D.CATALOG, true);
      refresh();
    }));
    group.appendChild(actions);
    group.__badge = badge;
    group.__status = status;
    return group;
  }

  function updateEntry() {
    if (!state.ui || !state.ui.group) return;
    var info = D.locationInfo(vars() || {}, setup());
    var badge = modeLabel();
    var status = t("current") + ": " + (info.visual || t("unknown")) + " · " + (info.outside ? t("outside") : t("indoors"));
    /* 只在文案变化时写 DOM：MutationObserver 监听 childList，无条件赋值会自触发 90ms 循环。 */
    if (state.ui.group.__badge.textContent !== badge) state.ui.group.__badge.textContent = badge;
    if (state.ui.group.__status.textContent !== status) state.ui.group.__status.textContent = status;
  }

  function injectEntry() {
    if (!panelOpen()) return;
    var pane = doc.getElementById("ml-pane");
    var tab = doc.getElementById("ml-tab-settings");
    if (!pane || !tab || tab.getAttribute("aria-selected") !== "true") return;
    var existing = pane.querySelector("[" + MARK + "]");
    if (existing && state.ui && state.ui.group === existing && existing.parentNode === pane) {
      updateEntry();
      return;
    }
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var group = buildEntry();
    /* 设置页里可能有第三方注入的同名 .ml-resets（档案面板就在 .md-custom
       内嵌了一层）。只认 pane 的直接子节点，且找不到时退回末尾，绝不把
       非兄弟节点当 insertBefore 的参照，否则 SugarCube 会弹全局错误框。 */
    var anchor = null;
    var resets = pane.querySelectorAll(".ml-resets");
    for (var i = 0; i < resets.length; i++) {
      if (resets[i].parentNode === pane) { anchor = resets[i]; break; }
    }
    try {
      pane.insertBefore(group, anchor || null);
    } catch (e) {
      pane.appendChild(group);
    }
    state.ui = { group: group };
    updateEntry();
  }

  function scheduleInject() {
    if (state.timer) return;
    state.timer = root.setTimeout(function () {
      state.timer = 0;
      injectEntry();
    }, 90);
  }

  /* ------------------------------------------------------------------ 弹层 */

  function ensureModal() {
    if (state.modal) return state.modal;
    var modal = el("div", "ml-deco-modal", { hidden: "", "data-ml-deco-modal": "1" });
    var backdrop = el("div", "ml-deco-backdrop", { "data-ml-deco-close": "1" });
    modal.appendChild(backdrop);
    var sheet = el("div", "ml-deco-sheet", { role: "dialog", "aria-modal": "true", "aria-label": t("title") });
    var head = el("div", "ml-deco-sheet-head");
    head.appendChild(text("h3", t("title"), "ml-deco-title"));
    var close = button("×", "ml-deco-close", function () { closeWorkbench(); });
    close.setAttribute("aria-label", t("close"));
    head.appendChild(close);
    sheet.appendChild(head);
    var body = el("div", "ml-deco-body");
    sheet.appendChild(body);

    var status = el("section", "ml-deco-status");
    body.appendChild(status);

    var layers = el("section", "ml-deco-section");
    layers.appendChild(text("h4", t("layers"), "ml-deco-section-title"));
    var grid = el("div", "ml-deco-grid");
    layers.appendChild(grid);
    body.appendChild(layers);

    var options = el("div", "ml-deco-options");
    var filter = el("section", "ml-deco-section");
    filter.appendChild(text("h4", t("filter"), "ml-deco-section-title"));
    options.appendChild(filter);
    var presets = el("section", "ml-deco-section");
    presets.appendChild(text("h4", t("presets"), "ml-deco-section-title"));
    options.appendChild(presets);
    body.appendChild(options);

    var picker = el("div", "ml-deco-picker", { hidden: "" });
    var pickerHead = el("div", "ml-deco-picker-head");
    pickerHead.appendChild(text("h4", t("picker"), "ml-deco-section-title"));
    pickerHead.appendChild(button("×", "ml-deco-close", function () { closePicker(); }));
    picker.appendChild(pickerHead);
    var pickerTools = el("div", "ml-deco-picker-tools");
    var search = el("input", "ml-deco-search", { type: "search", placeholder: t("search") });
    pickerTools.appendChild(search);
    var source = el("select", "ml-deco-select");
    D.LAYERS.forEach(function (layer) {
      var option = el("option", "", { value: layer.id });
      option.textContent = layer.folder;
      source.appendChild(option);
    });
    source.value = "background1";
    pickerTools.appendChild(source);
    picker.appendChild(pickerTools);
    var pickerGrid = el("div", "ml-deco-picker-grid");
    picker.appendChild(pickerGrid);
    var customRow = el("div", "ml-deco-custom");
    var customInput = el("input", "ml-deco-input", { type: "text", placeholder: t("custom") });
    customRow.appendChild(customInput);
    customRow.appendChild(button(t("apply"), "ml-btn", function () {
      var layer = state.pickerLayer;
      if (!layer) return;
      setImage(layer, customInput.value, state.pickerSource);
      closePicker();
    }));
    picker.appendChild(customRow);
    sheet.appendChild(picker);

    modal.appendChild(sheet);
    modal.__body = body;
    modal.__status = status;
    modal.__grid = grid;
    modal.__filter = filter;
    modal.__presets = presets;
    modal.__picker = picker;
    modal.__pickerGrid = pickerGrid;
    modal.__search = search;
    modal.__source = source;
    modal.__customInput = customInput;

    modal.addEventListener("click", function (e) {
      if (e.target && e.target.getAttribute && e.target.getAttribute("data-ml-deco-close") === "1") closeWorkbench();
    });
    search.addEventListener("input", function () {
      state.pickerQuery = String(search.value || "").trim().toLowerCase();
      renderPickerGrid();
    });
    source.addEventListener("change", function () {
      state.pickerSource = String(source.value || "background1");
      renderPickerGrid();
    });

    var host = doc.getElementById("ml-root") || doc.body;
    host.appendChild(modal);
    state.modal = modal;
    return modal;
  }

  function openWorkbench() {
    var modal = ensureModal();
    modal.hidden = false;
    modal.setAttribute("data-open", "1");
    modal.__picker.hidden = true;
    state.pickerLayer = null;
    renderAll();
    var close = modal.querySelector(".ml-deco-close");
    if (close) close.focus();
  }

  function closeWorkbench() {
    if (!state.modal) return;
    state.modal.hidden = true;
    state.modal.removeAttribute("data-open");
    closePicker();
  }

  function closePicker() {
    if (!state.modal || !state.modal.__picker) return;
    state.modal.__picker.hidden = true;
    state.pickerLayer = null;
  }

  function openPicker(layer) {
    var modal = ensureModal();
    state.pickerLayer = layer;
    state.pickerSource = layer.folder === "background1" ? "background1" : "background1";
    modal.__source.value = state.pickerSource;
    modal.__search.value = "";
    state.pickerQuery = "";
    modal.__picker.hidden = false;
    renderPickerGrid();
    modal.__search.focus();
  }

  function renderPickerGrid() {
    var modal = state.modal;
    if (!modal || modal.__picker.hidden) return;
    var grid = modal.__pickerGrid;
    grid.textContent = "";
    var source = state.pickerSource;
    var q = state.pickerQuery;

    function addItem(name, label) {
      if (q && (String(name) + " " + String(label)).toLowerCase().indexOf(q) < 0) return;
      var item = el("button", "ml-deco-pick", { type: "button" });
      var thumb = el("img", "ml-deco-pick-thumb");
      thumb.alt = "";
      thumb.loading = "lazy";
      item.appendChild(thumb);
      item.appendChild(text("span", label, "ml-deco-pick-label"));
      loadThumb(thumb, name, source, t("empty"));
      item.addEventListener("click", function () {
        var layer = state.pickerLayer;
        if (!layer) return;
        setImage(layer, name, source);
        closePicker();
      });
      grid.appendChild(item);
    }

    addItem("none", t("none"));
    D.CATALOG.forEach(function (name) { addItem(name, name); });
  }

  function renderStatus() {
    var modal = state.modal;
    if (!modal) return;
    var v = vars() || {};
    var info = D.locationInfo(v, setup());
    var status = modal.__status;
    status.textContent = "";
    var line1 = el("div", "ml-deco-status-line");
    line1.appendChild(text("span", modeLabel(), "ml-deco-pill"));
    var where = info.outside ? t("outside") : t("indoors");
    line1.appendChild(text("span", t("current") + ": " + (info.visual || t("unknown")) + " · " + where, "ml-deco-muted"));
    status.appendChild(line1);
    status.appendChild(text("div", t("chain") + ": " + (info.chain.join(" → ") || t("unknown")), "ml-deco-chain"));
    var auto = v.decoAutoBgSource || v.background_image1 || t("none");
    status.appendChild(text("div", t("autoSource") + ": " + auto, "ml-deco-muted"));
    if (D.mode() === D.MODE.external) status.appendChild(text("p", t("externalHint"), "ml-hint is-warn"));
    if (D.mode() === D.MODE.unavailable) status.appendChild(text("p", t("unavailable"), "ml-hint is-warn"));
  }

  function renderLayers() {
    var modal = state.modal;
    if (!modal) return;
    var v = vars() || {};
    var grid = modal.__grid;
    grid.textContent = "";
    D.LAYERS.forEach(function (layer) {
      var card = el("div", "ml-deco-card", { "data-layer": layer.id });
      var head = el("div", "ml-deco-card-head");
      head.appendChild(text("span", (layer.kind === "background" ? t("layerBg") : t("layerFg")) + " " + layer.index, "ml-deco-card-title"));
      var name = text("code", D.normalizeName(v[layer.varKey]) || "none", "ml-deco-name");
      head.appendChild(name);
      card.appendChild(head);

      var thumbWrap = el("div", "ml-deco-thumb");
      var img = el("img", "ml-deco-thumb-img");
      img.alt = "";
      img.loading = "lazy";
      thumbWrap.appendChild(img);
      thumbWrap.appendChild(text("span", t("empty"), "ml-deco-thumb-empty"));
      loadThumb(img, v[layer.varKey], layer.folder, t("empty"));
      card.appendChild(thumbWrap);

      var row = el("div", "ml-deco-card-row");
      row.appendChild(button(t("select"), "ml-btn ml-btn-sm", function () { openPicker(layer); }));
      row.appendChild(button(t("clear"), "ml-btn ml-btn-sm", function () { setImage(layer, "none", layer.folder); }));
      card.appendChild(row);

      var row2 = el("div", "ml-deco-card-row");
      var vis = el("label", "ml-deco-check");
      var checkbox = el("input", "", { type: "checkbox" });
      checkbox.checked = D.layerVisible(layer, v);
      checkbox.addEventListener("change", function () { setVisible(layer, checkbox.checked); });
      vis.appendChild(checkbox);
      vis.appendChild(text("span", t("visible")));
      row2.appendChild(vis);
      card.appendChild(row2);

      var zrow = el("div", "ml-deco-z");
      zrow.appendChild(text("span", t("z"), "ml-deco-z-label"));
      var range = el("input", "ml-deco-range", { type: "range", min: "-50", max: "50", step: "1" });
      range.value = String(v.decoImageZ && v.decoImageZ[layer.zKey] || 0);
      var zval = text("span", (range.value > 0 ? "+" : "") + range.value, "ml-deco-zval");
      range.addEventListener("input", function () { setZ(layer, range.value, zval); });
      zrow.appendChild(range);
      zrow.appendChild(zval);
      card.appendChild(zrow);
      grid.appendChild(card);
    });
  }

  function renderFilter() {
    var modal = state.modal;
    if (!modal) return;
    var v = vars() || {};
    var box = modal.__filter;
    box.textContent = "";
    box.appendChild(text("h4", t("filter"), "ml-deco-section-title"));
    var autoLabel = el("label", "ml-deco-check");
    var auto = el("input", "", { type: "checkbox" });
    auto.checked = v.decoAutoBgEnabled !== false;
    auto.addEventListener("change", function () { v.decoAutoBgEnabled = auto.checked; refresh(); });
    autoLabel.appendChild(auto);
    autoLabel.appendChild(text("span", t("autoBg")));
    box.appendChild(autoLabel);

    var filterLabel = el("label", "ml-deco-check");
    var filter = el("input", "", { type: "checkbox" });
    filter.checked = v.decoAutoBgFilterEnabled !== false;
    filter.addEventListener("change", function () { v.decoAutoBgFilterEnabled = filter.checked; refresh(); });
    filterLabel.appendChild(filter);
    filterLabel.appendChild(text("span", t("autoFilter")));
    box.appendChild(filterLabel);

    box.appendChild(text("div", t("filterLayers"), "ml-deco-subhead"));
    var chips = el("div", "ml-deco-chips");
    var selected = v.decoFilterLayers || ["background1", "background2", "background3", "background4"];
    D.LAYERS.forEach(function (layer) {
      var chip = el("label", "ml-deco-chip");
      var cb = el("input", "", { type: "checkbox" });
      cb.checked = selected.indexOf(layer.id) >= 0;
      cb.addEventListener("change", function () {
        var next = D.LAYERS.filter(function (l) {
          return (l.id === layer.id ? cb.checked : (selected.indexOf(l.id) >= 0));
        }).map(function (l) { return l.id; });
        selected = next;
        v.decoFilterLayers = next;
        refresh();
      });
      chip.appendChild(cb);
      chip.appendChild(text("span", layer.id));
      chips.appendChild(chip);
    });
    box.appendChild(chips);
    box.appendChild(text("p", t("filterHint"), "ml-hint"));
    if (D.mode() === D.MODE.external) box.appendChild(text("p", t("filterNote"), "ml-hint is-warn"));
    box.appendChild(button(t("reset"), "ml-btn ml-btn-sm", function () {
      var info = D.locationInfo(v, setup());
      var found = D.pickAutoLocation(info, D.CATALOG, v.decoAutoBgLocations);
      if (found !== "none") {
        v.background_image1 = found;
        v.show_background1 = true;
        v.decoAutoBgSource = found;
        v.decoAutoBgEnabled = true;
      }
      refresh();
    }));
  }

  function renderPresets() {
    var modal = state.modal;
    if (!modal) return;
    var v = vars() || {};
    var box = modal.__presets;
    box.textContent = "";
    box.appendChild(text("h4", t("presets"), "ml-deco-section-title"));
    var presets = v.decoPresets || {};
    var slots = Object.keys(presets).map(Number).filter(function (n) { return isFinite(n) && n > 0; }).sort(function (a, b) { return a - b; });
    if (!slots.length) box.appendChild(text("p", t("noPresets"), "ml-hint"));
    slots.forEach(function (slot) {
      var preset = presets[slot] || {};
      var row = el("div", "ml-deco-preset");
      row.appendChild(text("span", String(preset.name || ("#" + slot)), "ml-deco-preset-name"));
      row.appendChild(button(t("applyPreset"), "ml-btn ml-btn-sm", function () {
        if (D.applyPreset(v, slot)) refresh();
        renderAll();
      }));
      row.appendChild(button(t("overwrite"), "ml-btn ml-btn-sm", function () {
        D.savePreset(v, slot, preset.name || ("#" + slot));
        renderAll();
      }));
      row.appendChild(button(t("remove"), "ml-btn ml-btn-sm", function () {
        D.deletePreset(v, slot);
        renderAll();
      }));
      box.appendChild(row);
    });
    var saveRow = el("div", "ml-deco-preset-new");
    var input = el("input", "ml-deco-input", { type: "text", placeholder: t("presetName") });
    saveRow.appendChild(input);
    saveRow.appendChild(button(t("savePreset"), "ml-btn ml-btn-sm", function () {
      D.savePreset(v, D.nextPresetSlot(v), String(input.value || "").trim() || undefined);
      renderAll();
    }));
    box.appendChild(saveRow);
  }

  function renderAll() {
    if (!state.modal) return;
    renderStatus();
    renderLayers();
    renderFilter();
    renderPresets();
    updateEntry();
  }

  function syncStatus() {
    if (!state.modal || state.modal.hidden) return;
    renderStatus();
    updateEntry();
  }

  /* ------------------------------------------------------------------ 宿主 */

  function bootHost() {
    try {
      var result = D.registerLayers();
      if (result.mode === D.MODE.native) D.ensureOverlayStep();
      state.booted = true;
    } catch (e) {
      state.booted = false;
    }
    updateEntry();
    if (state.modal && !state.modal.hidden) syncStatus();
  }

  function onPassage() {
    var token = ++state.token;
    /* 原模组可能晚于灯台才把九层接到 main/pet；每个 passage 重查一次，
       发现实际渲染层就撤回灯台自己的图层并让位。char.layers 的声明不算。 */
    try { bootHost(); } catch (e) { /* 不向游戏抛 */ }
    later(function () {
      if (token !== state.token) return;
      try { D.refresh(); } catch (e) { /* 不向游戏抛 */ }
      syncStatus();
    }, 0);
  }

  function onStoryReady() {
    later(bootHost, 600);
  }

  function bindHost() {
    if (state.bound) return;
    state.bound = true;
    var jq = root.jQuery;
    state.hostJq = (jq && typeof jq === "function" && typeof jq(doc).on === "function") ? jq : null;
    if (state.hostJq) {
      state.hostJq(doc).on(":passageend.mlDeco", onPassage);
      state.hostJq(doc).on(":storyready.mlDeco", onStoryReady);
    } else {
      doc.addEventListener("passageend", onPassage);
      doc.addEventListener("storyready", onStoryReady);
    }
  }

  var onDocClick = function () { scheduleInject(); };
  function bindObserver() {
    if (state.observer) return;
    state.observer = new MutationObserver(function () {
      if (!doc.getElementById("ml-pane-host")) return;
      scheduleInject();
    });
    state.observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-selected"] });
    doc.addEventListener("click", onDocClick, true);
  }

  function destroy() {
    if (state.observer) { state.observer.disconnect(); state.observer = null; }
    clearTimers();
    doc.removeEventListener("click", onDocClick, true);
    if (state.hostJq) {
      try { state.hostJq(doc).off(".mlDeco"); } catch (e) { /* jQuery 未就绪时无绑定 */ }
    } else {
      doc.removeEventListener("passageend", onPassage);
      doc.removeEventListener("storyready", onStoryReady);
    }
    state.hostJq = null;
    state.bound = false;
    if (state.modal && state.modal.parentNode) state.modal.parentNode.removeChild(state.modal);
    state.modal = null;
    var groups = doc.querySelectorAll("[" + MARK + "]");
    for (var i = 0; i < groups.length; i++) if (groups[i].parentNode) groups[i].parentNode.removeChild(groups[i]);
    state.ui = null;
    state.picker = null;
    state.pickerLayer = null;
    state.queue = [];
    state.active = 0;
    state.imageCache = {};
    root.MapleLanternDecoPanel = null;
  }

  root.MapleLanternDecoPanel = {
    __ready: true,
    inject: injectEntry,
    open: openWorkbench,
    close: closeWorkbench,
    refresh: refresh,
    render: renderAll,
    destroy: destroy,
    setImage: setImage,
    mode: mode,
    boot: bootHost
  };

  function ready() {
    bindObserver();
    bindHost();
    /* 让原「前景背景模组」的 :storyready 先注册图层；延迟自举只补无原模组的场景。 */
    later(bootHost, 1000);
    scheduleInject();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
