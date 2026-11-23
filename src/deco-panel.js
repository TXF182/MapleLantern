/* ============================================================================
 * 灯台 · MapleLantern — deco-panel.js
 * 布景页：九层图层 + 图库 + 预设 + 自动地点 + 滤镜，全部直接渲染在页签内。
 *
 * 设计边界：
 * - 不生成独立弹层/工作台；内容由 render.js 的 deco 页签调用 renderPage() 挂载。
 * - 不抢原「前景背景模组」渲染权；检测到原模组实际接入时只写兼容变量。
 * - 缩略图优先走 modUtils.getImage → data: URL；CSP 禁止 blob:。
 * ========================================================================== */
(function (root) {
  "use strict";

  var D = root.MapleLanternDeco;
  var C = root.MapleLanternCore;
  if (!D || !C) return;
  if (root.MapleLanternDecoPanel && root.MapleLanternDecoPanel.__ready) return;

  var doc = root.document;
  var T = {
    zh: {
      title: "布景",
      entryHint: "九层独立布景；原模组已接入渲染时自动让出渲染权。",
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
      savePreset: "储存",
      applyPreset: "套用",
      remove: "删除",
      newPreset: "+ 新增预设",
      blankPreset: "空白预设",
      noPresets: "还没有预设。",
      filter: "地点滤镜",
      autoSection: "自动背景（按地点）",
      autoBg: "启用自动背景切换",
      autoFilter: "启用滤镜效果（实验性功能）",
      disabled: "已停用",
      autoEnabled: "已启用",
      locationEmpty: "（列表为空）",
      disabledEmpty: "还没有停用地点。",
      add: "添加",
      addCurrent: "加入当前地点",
      resetDisabled: "重置",
      match: "匹配当前地点",
      filterLayers: "作用层",
      filterHint: "滤镜独立于自动背景；只作用于背景 1–4。",
      outside: "室外",
      indoors: "室内",
      current: "当前",
      chain: "地点链",
      autoSource: "自动匹配",
      modeNative: "灯台原生",
      modeExternal: "原模组接管",
      modeUnavailable: "未接入",
      unavailable: "宿主 Renderer 尚未就绪；进入游戏后会自动重试。",
      externalHint: "检测到原模组已接入渲染的九层：本页只写兼容变量，渲染由原模组负责。",
      filterNote: "原模组接管时，滤镜颜色仍会写入；亮度由灯台原生模式消费。",
      empty: "未选择图片",
      reset: "恢复当前地点",
      unknown: "未知",
      loading: "载入中…",
      failed: "读取失败",
      missingImage: "图片缺失",
      packReady: "图库已接入",
      packMissing: "图库包未加载：缩略图与自动背景无图可读",
      packPartial: "图库不完整",
      packProbe: "图库检测中…",
      packHint: "请安装与本体同版本的 MapleLantern ImagePack，并确认 GameVersion 0.5.12.13 与 ImageLoaderHook 2.3+，再刷新游戏或点“重新检测”。",
      packPartialHint: "图库包只读到部分图片：请重装与本体同版本的 ImagePack，再点“重新检测”。",
      packRetry: "重新检测",
      noCatalogImage: "图库无此图",
      autoNoImageHint: "名单内这些地点在图中没有对应图，自动背景会跳过：",
      currentBg: "当前背景1",
      lastAuto: "上次自动匹配",
      autoHint: "只有名单内地点会触发自动背景；空名单不会切换。",
      overwrite: "覆盖",
      overwriteConfirm: "覆盖这个预设？",
      deleteConfirm: "确定删除这个预设？",
      presetNamePrompt: "输入预设名称",
      locationPlaceholder: "地点名称（V.location）",
      applyCurrent: "按当前地点套用",
      restorePlayer: "恢复玩家背景",
      autoReset: "关闭自动并清空名单",
      layerGroupBg: "背景 1–4",
      layerGroupFg: "前景 1–5",
      selectedCount: "已选"
    },
    en: {
      title: "Scenery",
      entryHint: "Nine independent layers; yields rendering to the original mod when present.",
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
      savePreset: "Save",
      applyPreset: "Apply",
      remove: "Delete",
      newPreset: "+ New preset",
      blankPreset: "Blank preset",
      noPresets: "No presets yet.",
      filter: "Location filter",
      autoSection: "Auto background (by location)",
      autoBg: "Enable auto background switching",
      autoFilter: "Enable filter effect (experimental)",
      disabled: "Disabled",
      autoEnabled: "Enabled",
      locationEmpty: "(list is empty)",
      disabledEmpty: "No disabled locations yet.",
      add: "Add",
      addCurrent: "Add current location",
      resetDisabled: "Reset",
      match: "Match current location",
      filterLayers: "Layers",
      filterHint: "Filter is independent of auto background; background layers 1–4 only.",
      outside: "Outdoor",
      indoors: "Indoor",
      current: "Current",
      chain: "Location chain",
      autoSource: "Auto match",
      modeNative: "Lantern native",
      modeExternal: "Original mod active",
      modeUnavailable: "Not connected",
      unavailable: "Host Renderer is not ready; it will retry after the game starts.",
      externalHint: "Original mod layers are attached to a render model: this page only writes compatible variables; rendering stays with the original mod.",
      filterNote: "With the original mod active, tint colours are still written; brightness is consumed by native mode.",
      empty: "No image selected",
      reset: "Reset to current location",
      unknown: "Unknown",
      loading: "Loading…",
      failed: "Read failed",
      missingImage: "Image missing",
      packReady: "Gallery connected",
      packMissing: "Image pack not loaded: thumbnails and auto backgrounds are unavailable",
      packPartial: "Gallery incomplete",
      packProbe: "Checking gallery…",
      packHint: "Install the MapleLantern ImagePack that matches this build, confirm GameVersion 0.5.12.13 and ImageLoaderHook 2.3+, then refresh the game or press Retry.",
      packPartialHint: "Only part of the image pack could be read. Reinstall the matching ImagePack, then press Retry.",
      packRetry: "Retry",
      noCatalogImage: "No image in gallery",
      autoNoImageHint: "These whitelisted locations have no gallery image and will be skipped:",
      currentBg: "Current background 1",
      lastAuto: "Last auto match",
      autoHint: "Only whitelisted locations trigger auto background; an empty list does not switch.",
      overwrite: "Overwrite",
      overwriteConfirm: "Overwrite this preset?",
      deleteConfirm: "Delete this preset?",
      presetNamePrompt: "Preset name",
      locationPlaceholder: "Location name (V.location)",
      applyCurrent: "Apply current location",
      restorePlayer: "Restore player background",
      autoReset: "Disable auto and clear list",
      layerGroupBg: "Backgrounds 1–4",
      layerGroupFg: "Foregrounds 1–5",
      selectedCount: "Selected"
    }
  };

  var state = {
    pane: null,
    page: null,
    picker: null,
    pickerLayer: null,
    pickerQuery: "",
    pickerSource: "background1",
    presetSlot: 1,
    timer: 0,
    timers: [],
    token: 0,
    bound: false,
    hostJq: null,
    imageCache: {},
    queue: [],
    active: 0,
    observers: [],
    packStatus: "unknown",
    packPromise: null,
    packCount: 0,
    packTotal: 0,
    openGroups: { background: true, foreground: false }
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
  }

  /* ------------------------------------------------------------------ 图片 */

  function normalizeImageUrl(value) {
    if (typeof value !== "string" || !value) return "";
    if (value.indexOf("data:") === 0) return value;
    if (value.indexOf("blob:") === 0) return "";
    if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 64) return "data:image/png;base64," + value;
    return value;
  }

  function imageKey(name) { return "library/" + D.normalizeName(name); }

  function resolveImage(name, folder) {
    name = D.normalizeName(name);
    if (name === "none") return Promise.resolve("");
    var key = imageKey(name);
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

  function setThumbState(imgNode, kind, fallbackText) {
    var wrap = imgNode && imgNode.parentNode;
    if (!wrap) return;
    wrap.setAttribute("data-thumb-state", kind);
    var label = wrap.querySelector(".ml-deco-thumb-empty");
    if (label) {
      label.hidden = kind === "ready";
      label.textContent = kind === "missing" ? t("missingImage") : (fallbackText || t("empty"));
    }
    var pickLabel = wrap.querySelector(".ml-deco-pick-label");
    if (pickLabel) {
      var base = pickLabel.getAttribute("data-label") || pickLabel.textContent || "";
      pickLabel.textContent = kind === "missing" ? base + " · " + t("missingImage") : base;
    }
    if (kind === "missing") wrap.classList.add("is-missing");
    else wrap.classList.remove("is-missing");
    if (wrap.closest) {
      var item = wrap.closest(".ml-deco-pick");
      if (item) item.disabled = kind === "missing";
    }
  }

  function dropObserver(observer) {
    var idx = state.observers.indexOf(observer);
    if (idx >= 0) state.observers.splice(idx, 1);
  }

  function disconnectObservers() {
    for (var i = 0; i < state.observers.length; i++) {
      try { state.observers[i].disconnect(); } catch (e) { /* 已断开 */ }
    }
    state.observers = [];
  }

  function loadThumb(imgNode, name, folder, fallbackText) {
    if (!imgNode) return;
    var token = String(name) + "|" + String(folder);
    imgNode.__mlDecoToken = token;
    imgNode.removeAttribute("src");
    imgNode.alt = "";
    imgNode.style.visibility = "hidden";
    if (fallbackText) imgNode.setAttribute("data-empty", fallbackText);
    if (D.normalizeName(name) === "none") {
      setThumbState(imgNode, "empty", fallbackText);
      return;
    }
    function load() {
      if (state.packStatus === "missing") {
        setThumbState(imgNode, "missing", fallbackText);
        return;
      }
      enqueueLoad(function () {
        return resolveImage(name, folder).then(function (url) {
          if (imgNode.__mlDecoToken !== token) return;
          if (!url) {
            setThumbState(imgNode, "missing", fallbackText);
            return;
          }
          imgNode.onload = function () {
            imgNode.style.visibility = "visible";
            setThumbState(imgNode, "ready", fallbackText);
          };
          imgNode.onerror = function () {
            imgNode.style.visibility = "hidden";
            setThumbState(imgNode, "missing", fallbackText);
          };
          imgNode.src = url;
        });
      });
    }
    if (typeof root.IntersectionObserver === "function" && state.pane) {
      var observer = new root.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            observer.disconnect();
            dropObserver(observer);
            load();
            return;
          }
        }
      }, { root: state.pane, rootMargin: "240px 0px" });
      try {
        observer.observe(imgNode);
        state.observers.push(observer);
        return;
      } catch (e) {
        dropObserver(observer);
      }
    }
    load();
  }

  /* ------------------------------------------------------------------ 状态读写 */

  function setImage(layer, name, folder) {
    var v = vars();
    if (!v || !layer) return;
    var normalized = D.normalizeName(name);
    if (layer.id === "background1") {
      D.restoreAutoBackground(v);
      v.decoAutoBgEnabled = false;
    }
    v[layer.varKey] = normalized;
    v[layer.showKey] = true;
    if (layer.id === "background1") delete v.decoAutoBgSource;
    if (!v.decoImagePath || typeof v.decoImagePath !== "object") v.decoImagePath = {};
    if (normalized !== "none") {
      if (layer.id === "background1") delete v.decoImagePath[layer.id];
      else v.decoImagePath[layer.id] = D.libraryPath(normalized);
    } else {
      delete v.decoImagePath[layer.id];
    }
    refresh();
    rebuildPage();
  }

  function setVisible(layer, on) {
    var v = vars();
    if (!v || !layer) return;
    v[layer.showKey] = !!on;
    refresh();
  }

  function setZ(layer, value, labelNode) {
    var v = vars();
    if (!v || !layer) return;
    if (!v.decoImageZ || typeof v.decoImageZ !== "object") v.decoImageZ = {};
    var n = Math.max(-50, Math.min(50, Math.round(Number(value) || 0)));
    v.decoImageZ[layer.zKey] = n;
    if (labelNode) labelNode.textContent = (n > 0 ? "+" : "") + n;
    refresh();
  }

  function readList(v, key) {
    return v && Array.isArray(v[key]) ? v[key] : [];
  }

  function ensureList(v, key) {
    if (!Array.isArray(v[key])) v[key] = [];
    return v[key];
  }

  function catalogHas(name) {
    var normalized = D.normalizeName(name);
    if (normalized === "none") return false;
    var list = D.CATALOG || [];
    for (var i = 0; i < list.length; i++) {
      if (D.normalizeName(list[i]) === normalized) return true;
    }
    return false;
  }

  function addLocation(name) {
    var v = vars();
    if (!v) return;
    var normalized = D.normalizeName(name);
    if (normalized === "none") return;
    var list = ensureList(v, "decoAutoBgLocations");
    if (list.indexOf(normalized) < 0) list.push(normalized);
    delete v.decoAutoBgDisabled;
    refresh();
    rebuildPage();
  }

  function removeLocation(name) {
    var v = vars();
    if (!v) return;
    var normalized = D.normalizeName(name);
    var list = readList(v, "decoAutoBgLocations");
    var idx = list.indexOf(normalized);
    if (idx >= 0) list.splice(idx, 1);
    delete v.decoAutoBgDisabled;
    refresh();
    rebuildPage();
  }

  /* ------------------------------------------------------------------ 页骨架 */

  function packText() {
    if (state.packStatus === "ready") return t("packReady") + " · " + D.CATALOG.length;
    if (state.packStatus === "partial") return t("packPartial") + " · " + state.packCount + "/" + state.packTotal;
    if (state.packStatus === "missing") return t("packMissing");
    return t("packProbe");
  }

  /* 只抽查首/中/末三张，避免为了判断图库是否完整而把 83 张图全部读进内存。
     三张全中 = ready；全空 = missing；部分命中 = partial，界面会提示重装图库。 */
  function probeSamples() {
    var list = D.CATALOG || [];
    if (!list.length) return ["home"];
    var idx = [0, Math.floor((list.length - 1) / 2), list.length - 1];
    var out = [];
    for (var i = 0; i < idx.length; i++) {
      var name = list[idx[i]];
      if (name && out.indexOf(name) < 0) out.push(name);
    }
    return out;
  }

  function probeImagePack(force) {
    if (state.packPromise && !force) return state.packPromise;
    var modUtils = root.modUtils;
    var names = probeSamples();
    state.packTotal = names.length;
    if (!modUtils || typeof modUtils.getImage !== "function") {
      state.packStatus = "missing";
      state.packCount = 0;
      state.packPromise = Promise.resolve("missing");
      syncPackStatus();
      return state.packPromise;
    }
    state.packPromise = Promise.all(names.map(function (name) {
      var path = typeof D.libraryPath === "function" ? D.libraryPath(name) : "img/decorations/ml/background1/" + name + ".png";
      return Promise.resolve()
        .then(function () { return Promise.resolve(modUtils.getImage(path)); })
        .then(function (value) { return normalizeImageUrl(value) ? 1 : 0; })
        .catch(function () { return 0; });
    })).then(function (hits) {
      var ok = 0;
      for (var i = 0; i < hits.length; i++) ok += hits[i];
      state.packCount = ok;
      state.packStatus = ok === names.length ? "ready" : (ok === 0 ? "missing" : "partial");
      syncPackStatus();
      return state.packStatus;
    }).catch(function () {
      state.packStatus = "missing";
      state.packCount = 0;
      syncPackStatus();
      return "missing";
    });
    return state.packPromise;
  }

  function retryPack() {
    state.packPromise = null;
    state.packStatus = "unknown";
    state.packCount = 0;
    state.packTotal = 0;
    state.imageCache = {};
    syncPackStatus();
    probeImagePack(true).then(function () {
      if (state.page) rebuildPage();
    });
  }

  function syncPackStatus() {
    if (!state.page) return;
    var node = state.page.querySelector("[data-deco-pack-status]");
    if (node) {
      node.textContent = packText();
      node.className = "ml-deco-pack-state is-" + state.packStatus;
    }
    var hintText = state.packStatus === "partial" ? t("packPartialHint") : t("packHint");
    var showHint = state.packStatus === "missing" || state.packStatus === "partial";
    var hints = state.page.querySelectorAll("[data-deco-pack-hint]");
    for (var i = 0; i < hints.length; i++) {
      hints[i].hidden = !showHint;
      hints[i].textContent = hintText;
    }
    var retry = state.page.querySelector("[data-deco-pack-retry]");
    if (retry) retry.hidden = !showHint;
    var missing = state.packStatus === "missing";
    var auto = state.page.querySelector("[data-deco-auto-toggle]");
    if (auto) auto.disabled = missing;
    var required = state.page.querySelectorAll("[data-deco-pack-required]");
    for (var j = 0; j < required.length; j++) required[j].disabled = missing;
    if (missing) {
      var picks = state.page.querySelectorAll(".ml-deco-pick");
      for (var k = 0; k < picks.length; k++) {
        if (picks[k].getAttribute("data-deco-pick-name") !== "none") picks[k].disabled = true;
      }
    }
  }

  function buildStatus() {
    var v = vars() || {};
    var info = D.locationInfo(v, setup());
    var section = el("section", "ml-deco-status", { "data-ml-deco-status": "1" });
    var line1 = el("div", "ml-deco-status-line");
    line1.appendChild(text("span", modeLabel(), "ml-deco-pill"));
    var where = info.outside ? t("outside") : t("indoors");
    line1.appendChild(text("span", t("current") + ": " + (info.visual || t("unknown")) + " · " + where, "ml-deco-muted"));
    section.appendChild(line1);
    section.appendChild(text("div", t("chain") + ": " + (info.chain.join(" → ") || t("unknown")), "ml-deco-chain"));
    var pack = el("div", "ml-deco-pack-state is-" + state.packStatus, { "data-deco-pack-status": "1" });
    pack.textContent = packText();
    section.appendChild(pack);
    var packHint = text("p", state.packStatus === "partial" ? t("packPartialHint") : t("packHint"), "ml-hint is-warn");
    packHint.setAttribute("data-deco-pack-hint", "1");
    packHint.hidden = state.packStatus !== "missing" && state.packStatus !== "partial";
    section.appendChild(packHint);
    var retry = button(t("packRetry"), "ml-btn ml-btn-sm", retryPack);
    retry.setAttribute("data-deco-pack-retry", "1");
    retry.hidden = state.packStatus !== "missing" && state.packStatus !== "partial";
    section.appendChild(retry);
    var bgName = D.normalizeName(v.background_image1);
    section.appendChild(text("div", t("currentBg") + ": " + (bgName === "none" ? t("none") : bgName), "ml-deco-muted"));
    if (v.decoAutoBgEnabled === true && v.decoAutoBgSource) {
      var sourceName = D.normalizeName(v.decoAutoBgSource);
      section.appendChild(text("div", t("lastAuto") + ": " + (sourceName === "none" ? t("none") : sourceName), "ml-deco-muted"));
    }
    if (mode() === D.MODE.external) section.appendChild(text("p", t("externalHint"), "ml-hint is-warn"));
    if (mode() === D.MODE.unavailable) section.appendChild(text("p", t("unavailable"), "ml-hint is-warn"));
    return section;
  }

  function buildPicker() {
    var picker = el("div", "ml-deco-picker", { hidden: "", "data-deco-picker": "1" });
    var head = el("div", "ml-deco-picker-head");
    head.appendChild(text("h4", t("picker"), "ml-deco-section-title"));
    head.appendChild(button("×", "ml-deco-close", closePicker));
    picker.appendChild(head);

    var tools = el("div", "ml-deco-picker-tools");
    var search = el("input", "ml-deco-search", { type: "search", placeholder: t("search") });
    tools.appendChild(search);
    picker.appendChild(tools);

    var grid = el("div", "ml-deco-picker-grid");
    picker.appendChild(grid);
    var packHint = text("p", state.packStatus === "partial" ? t("packPartialHint") : t("packHint"), "ml-hint is-warn");
    packHint.setAttribute("data-deco-pack-hint", "1");
    packHint.hidden = state.packStatus !== "missing" && state.packStatus !== "partial";
    picker.appendChild(packHint);
    var customRow = el("div", "ml-deco-custom");
    var customInput = el("input", "ml-deco-input", { type: "text", placeholder: t("custom") });
    customRow.appendChild(customInput);
    customRow.appendChild(button(t("apply"), "ml-btn", function () {
      var layer = state.pickerLayer;
      if (!layer) return;
      setImage(layer, customInput.value, state.pickerSource);
    }));
    picker.appendChild(customRow);

    picker.__grid = grid;
    picker.__search = search;
    picker.__customInput = customInput;
    state.picker = picker;

    search.addEventListener("input", function () {
      state.pickerQuery = String(search.value || "").trim().toLowerCase();
      renderPickerGrid();
    });
    return picker;
  }

  function layerCard(layer, v) {
    var card = el("div", "ml-deco-card", { "data-layer": layer.id });
    var head = el("div", "ml-deco-card-head");
    head.appendChild(text("span", (layer.kind === "background" ? t("layerBg") : t("layerFg")) + " " + layer.index, "ml-deco-card-title"));
    head.appendChild(text("code", D.normalizeName(v[layer.varKey]) || "none", "ml-deco-name"));
    card.appendChild(head);

    var thumbWrap = el("div", "ml-deco-thumb");
    var img = el("img", "ml-deco-thumb-img");
    img.alt = "";
    img.loading = "lazy";
    thumbWrap.appendChild(img);
    thumbWrap.appendChild(text("span", t("empty"), "ml-deco-thumb-empty"));
    loadThumb(img, v[layer.varKey], "background1", t("empty"));
    card.appendChild(thumbWrap);

    var row = el("div", "ml-deco-card-row");
    var choose = button(t("select"), "ml-btn ml-btn-sm", function () { openPicker(layer); });
    choose.setAttribute("data-deco-select-image", layer.id);
    row.appendChild(choose);
    row.appendChild(button(t("clear"), "ml-btn ml-btn-sm", function () { setImage(layer, "none", "background1"); }));
    card.appendChild(row);

    var row2 = el("div", "ml-deco-card-row");
    var vis = el("label", "ml-deco-check");
    var checkbox = el("input", "", { type: "checkbox", "data-deco-visible": layer.id });
    checkbox.checked = D.layerVisible(layer, v);
    checkbox.addEventListener("change", function () { setVisible(layer, checkbox.checked); });
    vis.appendChild(checkbox);
    vis.appendChild(text("span", t("visible")));
    row2.appendChild(vis);
    card.appendChild(row2);

    var zrow = el("div", "ml-deco-z");
    zrow.appendChild(text("span", t("z"), "ml-deco-z-label"));
    var range = el("input", "ml-deco-range", { type: "range", min: "-50", max: "50", step: "1", "data-deco-z": layer.id });
    range.value = String(v.decoImageZ && v.decoImageZ[layer.zKey] || 0);
    var zval = text("span", (range.value > 0 ? "+" : "") + range.value, "ml-deco-zval");
    range.addEventListener("input", function () { setZ(layer, range.value, zval); });
    zrow.appendChild(range);
    zrow.appendChild(zval);
    card.appendChild(zrow);

    if (state.picker && state.pickerLayer && state.pickerLayer.id === layer.id) card.appendChild(state.picker);
    return card;
  }

  function layerGroup(kind, title, layers, v) {
    var details = el("details", "ml-deco-group", { "data-deco-group": kind });
    details.open = state.openGroups[kind] !== false;
    details.addEventListener("toggle", function () { state.openGroups[kind] = details.open; });
    var summary = el("summary", "ml-deco-group-head");
    summary.appendChild(text("span", title, "ml-deco-group-title"));
    var selected = layers.filter(function (layer) { return D.normalizeName(v[layer.varKey]) !== "none"; }).length;
    summary.appendChild(text("span", t("selectedCount") + " " + selected + "/" + layers.length, "ml-deco-group-meta"));
    details.appendChild(summary);
    var grid = el("div", "ml-deco-grid");
    layers.forEach(function (layer) { grid.appendChild(layerCard(layer, v)); });
    details.appendChild(grid);
    return details;
  }

  function buildLayers() {
    var v = vars() || {};
    var section = el("section", "ml-deco-section", { "data-deco-layers": "1" });
    section.appendChild(text("h4", t("layers"), "ml-deco-section-title"));
    section.appendChild(text("p", t("layerBg") + " 1–4 / " + t("layerFg") + " 1–5", "ml-hint"));
    section.appendChild(layerGroup("background", t("layerGroupBg"), D.LAYERS.filter(function (layer) { return layer.kind === "background"; }), v));
    section.appendChild(layerGroup("foreground", t("layerGroupFg"), D.LAYERS.filter(function (layer) { return layer.kind === "foreground"; }), v));
    return section;
  }

  function dialogConfirm(message) {
    try {
      if (typeof root.confirm === "function") return root.confirm(message) !== false;
    } catch (e) { /* 宿主无 confirm 时按确认处理 */ }
    return true;
  }

  function askText(message, fallback) {
    try {
      if (typeof root.prompt === "function") {
        var answer = root.prompt(message, fallback);
        if (answer === null) return null;
        if (answer === undefined) return fallback;
        var trimmed = String(answer).trim();
        return trimmed || fallback;
      }
    } catch (e) { /* 宿主无 prompt 时用默认名 */ }
    return fallback;
  }

  function buildPresets() {
    var v = vars() || {};
    var presets = v.decoPresets && typeof v.decoPresets === "object" ? v.decoPresets : {};
    var slots = Object.keys(presets).map(Number).filter(function (n) { return isFinite(n) && n > 0; }).sort(function (a, b) { return a - b; });
    var maxSlot = slots.length ? Math.max.apply(Math, slots) : 1;

    var section = el("section", "ml-deco-section", { "data-deco-presets": "1" });
    section.appendChild(text("h4", t("presets"), "ml-deco-section-title"));

    for (var slot = 1; slot <= maxSlot; slot++) {
      (function (currentSlot) {
        var preset = presets[currentSlot];
        var row = el("div", "ml-deco-preset", { "data-deco-preset": String(currentSlot) });
        row.appendChild(text("span", preset ? String(preset.name || ("#" + currentSlot)) : (t("blankPreset") + " " + currentSlot), "ml-deco-preset-name"));

        var apply = button(t("applyPreset"), "ml-btn ml-btn-sm", function () {
          var current = vars();
          if (!current) return;
          if (D.applyPreset(current, currentSlot)) { refresh(); rebuildPage(); }
        });
        apply.setAttribute("data-deco-preset-apply", String(currentSlot));
        apply.disabled = !preset;
        row.appendChild(apply);

        var save = button(preset ? t("overwrite") : t("savePreset"), "ml-btn ml-btn-sm", function () {
          var current = vars();
          if (!current) return;
          if (preset && !dialogConfirm(t("overwriteConfirm") + " " + String(preset.name || ("#" + currentSlot)))) return;
          var name = askText(t("presetNamePrompt"), preset && preset.name || ("预设 " + currentSlot));
          if (name === null) return;
          D.savePreset(current, currentSlot, name);
          refresh();
          rebuildPage();
        });
        save.setAttribute("data-deco-preset-save", String(currentSlot));
        row.appendChild(save);

        var remove = button(t("remove"), "ml-btn ml-btn-sm", function () {
          var current = vars();
          if (!current) return;
          if (!dialogConfirm(t("deleteConfirm") + " " + String(preset && preset.name || ("#" + currentSlot)))) return;
          D.deletePreset(current, currentSlot);
          refresh();
          rebuildPage();
        });
        remove.setAttribute("data-deco-preset-delete", String(currentSlot));
        remove.disabled = !preset;
        row.appendChild(remove);
        section.appendChild(row);
      })(slot);
    }

    var nameRow = el("div", "ml-deco-preset-new");
    var add = button(t("newPreset"), "ml-btn ml-btn-sm", function () {
      var current = vars();
      if (!current) return;
      var next = D.nextPresetSlot(current);
      var name = askText(t("presetNamePrompt"), "预设 " + next);
      if (name === null) return;
      D.savePreset(current, next, name);
      refresh();
      rebuildPage();
    });
    add.setAttribute("data-deco-preset-new", "1");
    nameRow.appendChild(add);
    section.appendChild(nameRow);

    if (!slots.length) section.appendChild(text("p", t("noPresets"), "ml-hint"));
    return section;
  }

  function buildAuto() {
    var v = vars() || {};
    var info = D.locationInfo(v, setup());
    var section = el("section", "ml-deco-section", { "data-deco-auto": "1" });
    section.appendChild(text("h4", t("autoSection"), "ml-deco-section-title"));

    var autoLabel = el("label", "ml-deco-check");
    var auto = el("input", "", { type: "checkbox", "data-deco-auto-toggle": "1" });
    auto.checked = v.decoAutoBgEnabled === true;
    auto.addEventListener("change", function () {
      var current = vars();
      if (!current) return;
      current.decoAutoBgEnabled = auto.checked;
      if (auto.checked) D.applyAutoBackground(current, setup(), D.CATALOG, false);
      else D.restoreAutoBackground(current);
      refresh();
      rebuildPage();
    });
    autoLabel.appendChild(auto);
    autoLabel.appendChild(text("span", t("autoBg")));
    section.appendChild(autoLabel);

    var filterLabel = el("label", "ml-deco-check");
    var filter = el("input", "", { type: "checkbox", "data-deco-filter-toggle": "1" });
    filter.checked = v.decoAutoBgFilterEnabled === true;
    filter.addEventListener("change", function () {
      var current = vars();
      if (!current) return;
      current.decoAutoBgFilterEnabled = filter.checked;
      refresh();
      syncStatus();
    });
    filterLabel.appendChild(filter);
    filterLabel.appendChild(text("span", t("autoFilter")));
    section.appendChild(filterLabel);

    section.appendChild(text("p", t("autoHint"), "ml-hint"));
    var autoOn = v.decoAutoBgEnabled === true;
    var stateNode = el("div", "ml-deco-auto-state" + (autoOn ? " is-on" : ""), { "data-deco-auto-state": "1" });
    stateNode.textContent = autoOn ? t("autoEnabled") : t("disabled");
    section.appendChild(stateNode);
    var chips = el("div", "ml-deco-chips", { "data-deco-locations": "1" });
    var list = readList(v, "decoAutoBgLocations");
    var noImage = [];
    if (!list.length) {
      chips.appendChild(text("span", t("locationEmpty"), "ml-hint"));
    } else {
      list.forEach(function (name) {
        var missing = !catalogHas(name);
        if (missing) noImage.push(name);
        var chip = el("span", "ml-deco-chip" + (missing ? " is-missing" : ""));
        chip.appendChild(text("span", String(name)));
        if (missing) chip.appendChild(text("span", " · " + t("noCatalogImage"), "ml-deco-chip-note"));
        var x = button("×", "ml-deco-chip-x", function () { removeLocation(name); });
        x.setAttribute("aria-label", t("remove") + " " + name);
        x.setAttribute("data-deco-location-remove", name);
        chip.appendChild(x);
        chips.appendChild(chip);
      });
    }
    section.appendChild(chips);
    if (noImage.length) {
      var noImageHint = text("p", t("autoNoImageHint") + " " + noImage.join("、"), "ml-hint is-warn");
      noImageHint.setAttribute("data-deco-auto-no-image", "1");
      section.appendChild(noImageHint);
    }

    var locRow = el("div", "ml-deco-location-row");
    var loc = el("input", "ml-deco-input", { type: "text", placeholder: t("locationPlaceholder"), "data-deco-location-input": "1" });
    locRow.appendChild(loc);
    var addBtn = button(t("add"), "ml-btn ml-btn-sm", function () { addLocation(loc.value); });
    addBtn.setAttribute("data-deco-location-add", "1");
    locRow.appendChild(addBtn);
    var currentBtn = button(t("addCurrent"), "ml-btn ml-btn-sm", function () {
      addLocation(info.base || info.visual);
    });
    currentBtn.setAttribute("data-deco-location-current", "1");
    locRow.appendChild(currentBtn);
    section.appendChild(locRow);

    var actionRow = el("div", "ml-deco-preset-new");
    var matchBtn = button(t("match"), "ml-btn ml-btn-sm", function () {
      var current = vars();
      if (!current) return;
      var here = D.normalizeName(info.base || info.visual);
      if (here !== "none") {
        var allowed = ensureList(current, "decoAutoBgLocations");
        if (allowed.indexOf(here) < 0) allowed.push(here);
      }
      current.decoAutoBgEnabled = true;
      D.applyAutoBackground(current, setup(), D.CATALOG, true);
      refresh();
      rebuildPage();
    });
    matchBtn.setAttribute("data-deco-pack-required", "1");
    actionRow.appendChild(matchBtn);
    var resetAuto = button(t("autoReset"), "ml-btn ml-btn-sm", function () {
      var current = vars();
      if (!current) return;
      D.restoreAutoBackground(current);
      current.decoAutoBgEnabled = false;
      current.decoAutoBgLocations = [];
      delete current.decoAutoBgDisabled;
      refresh();
      rebuildPage();
    });
    resetAuto.setAttribute("data-deco-location-reset", "1");
    actionRow.appendChild(resetAuto);
    section.appendChild(actionRow);
    return section;
  }

  function buildFilter() {
    var v = vars() || {};
    var section = el("section", "ml-deco-section", { "data-deco-filter": "1" });
    section.appendChild(text("h4", t("filter"), "ml-deco-section-title"));
    section.appendChild(text("div", t("filterLayers"), "ml-deco-subhead"));
    var chips = el("div", "ml-deco-chips");
    var selected = Array.isArray(v.decoFilterLayers) ? v.decoFilterLayers : ["background1", "background2", "background3", "background4"];
    var backgroundLayers = D.LAYERS.filter(function (layer) { return layer.kind === "background"; });
    backgroundLayers.forEach(function (layer) {
      var chip = el("label", "ml-deco-chip");
      var cb = el("input", "", { type: "checkbox", "data-deco-filter-layer": layer.id });
      cb.checked = selected.indexOf(layer.id) >= 0;
      cb.addEventListener("change", function () {
        var next = backgroundLayers.filter(function (l) {
          return (l.id === layer.id ? cb.checked : (selected.indexOf(l.id) >= 0));
        }).map(function (l) { return l.id; });
        selected = next;
        var current = vars();
        if (current) current.decoFilterLayers = next;
        refresh();
      });
      chip.appendChild(cb);
      chip.appendChild(text("span", t("layerBg") + " " + layer.index));
      chips.appendChild(chip);
    });
    section.appendChild(chips);
    section.appendChild(text("p", t("filterHint"), "ml-hint"));
    if (mode() === D.MODE.external) section.appendChild(text("p", t("filterNote"), "ml-hint is-warn"));
    return section;
  }

  function buildReset() {
    var section = el("section", "ml-deco-section", { "data-deco-reset": "1" });
    var applyCurrent = button(t("applyCurrent"), "ml-btn ml-btn-wide", function () {
      var v = vars();
      if (!v) return;
      var info = D.locationInfo(v, setup());
      var here = D.normalizeName(info.base || info.visual);
      if (here !== "none") {
        var list = ensureList(v, "decoAutoBgLocations");
        if (list.indexOf(here) < 0) list.push(here);
      }
      v.decoAutoBgEnabled = true;
      D.applyAutoBackground(v, setup(), D.CATALOG, true);
      refresh();
      rebuildPage();
    });
    applyCurrent.setAttribute("data-deco-pack-required", "1");
    section.appendChild(applyCurrent);
    section.appendChild(button(t("restorePlayer"), "ml-btn ml-btn-wide", function () {
      var v = vars();
      if (!v) return;
      D.restoreAutoBackground(v);
      v.decoAutoBgEnabled = false;
      delete v.decoAutoBgSource;
      refresh();
      rebuildPage();
    }));
    return section;
  }

  function renderPage(pane) {
    if (!pane) return;
    disconnectObservers();
    state.pane = pane;
    state.picker = null;
    state.pickerLayer = null;
    state.pickerSource = "background1";
    pane.textContent = "";
    var page = el("div", "ml-deco-page", { "data-deco-page": "1" });
    state.page = page;
    page.appendChild(buildStatus());
    page.appendChild(buildPicker());
    page.appendChild(buildLayers());
    var options = el("div", "ml-deco-options");
    options.appendChild(buildPresets());
    options.appendChild(buildAuto());
    page.appendChild(options);
    page.appendChild(buildFilter());
    page.appendChild(buildReset());
    pane.appendChild(page);
    refresh();
    probeImagePack();
  }

  function rebuildPage() {
    if (!state.pane) return;
    var host = state.pane.parentNode;
    var top = host ? host.scrollTop : 0;
    renderPage(state.pane);
    if (host) host.scrollTop = top;
  }

  function syncStatus() {
    if (!state.page) return;
    var old = state.page.querySelector("[data-ml-deco-status]");
    var next = buildStatus();
    if (old && old.parentNode) old.parentNode.replaceChild(next, old);
  }

  /* ------------------------------------------------------------------ 图库 */

  function openPicker(layer) {
    var picker = state.picker;
    if (!picker || !state.page || !layer) return;
    state.pickerLayer = layer;
    state.pickerSource = "background1";
    state.pickerQuery = "";
    picker.__search.value = "";
    picker.__customInput.value = "";
    picker.hidden = false;
    var card = state.page.querySelector('[data-layer="' + layer.id + '"]');
    if (card) {
      var group = card.parentNode;
      while (group && group !== state.page && !(group.tagName && String(group.tagName).toLowerCase() === "details")) group = group.parentNode;
      if (group && group !== state.page) group.open = true;
      card.appendChild(picker);
    }
    renderPickerGrid();
    try { picker.scrollIntoView({ block: "nearest" }); } catch (e) { /* 老 WebView 无参数支持 */ }
  }

  function closePicker() {
    var layer = state.pickerLayer;
    if (state.picker) state.picker.hidden = true;
    state.pickerLayer = null;
    if (!layer || !state.page) return;
    var card = state.page.querySelector('[data-layer="' + layer.id + '"]');
    if (card && typeof card.scrollIntoView === "function") {
      try { card.scrollIntoView({ block: "nearest" }); } catch (e) {
        try { card.scrollIntoView(); } catch (e2) { /* 老 WebView 无参数支持 */ }
      }
    }
  }

  function renderPickerGrid() {
    var picker = state.picker;
    if (!picker || picker.hidden) return;
    var grid = picker.__grid;
    grid.textContent = "";
    var source = "background1";
    var q = state.pickerQuery;

    function addItem(name, label) {
      if (q && (String(name) + " " + String(label)).toLowerCase().indexOf(q) < 0) return;
      var item = el("button", "ml-deco-pick", { type: "button" });
      item.setAttribute("data-deco-pick-name", name);
      if (name !== "none" && state.packStatus === "missing") item.disabled = true;
      var thumb = el("img", "ml-deco-pick-thumb");
      thumb.alt = "";
      thumb.loading = "lazy";
      item.appendChild(thumb);
      var labelNode = text("span", label, "ml-deco-pick-label");
      labelNode.setAttribute("data-label", label);
      item.appendChild(labelNode);
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

  /* ------------------------------------------------------------------ 宿主 */

  function bootHost() {
    try {
      var result = D.registerLayers();
      if (result.mode === D.MODE.native) D.ensureOverlayStep();
    } catch (e) {
      /* 宿主未就绪：保持 unavailable，不向游戏抛 */
    }
    syncStatus();
  }

  function onPassage() {
    var token = ++state.token;
    try { bootHost(); } catch (e) { /* 不向游戏抛 */ }
    later(function () {
      if (token !== state.token) return;
      try { D.applyAutoOnPassage({ vars: vars(), setup: setup() }); } catch (e) { /* 不向游戏抛 */ }
      refresh();
      syncStatus();
    }, 0);
  }

  function onStoryReady() {
    later(function () {
      try { bootHost(); } catch (e) { /* 不向游戏抛 */ }
      try { D.applyAutoOnPassage({ vars: vars(), setup: setup() }); } catch (e) { /* 不向游戏抛 */ }
      refresh();
      syncStatus();
    }, 600);
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

  function destroy() {
    clearTimers();
    disconnectObservers();
    if (state.hostJq) {
      try { state.hostJq(doc).off(".mlDeco"); } catch (e) { /* jQuery 未就绪时无绑定 */ }
    } else {
      doc.removeEventListener("passageend", onPassage);
      doc.removeEventListener("storyready", onStoryReady);
    }
    state.hostJq = null;
    state.bound = false;
    if (state.page && state.page.parentNode) state.page.parentNode.removeChild(state.page);
    state.page = null;
    state.pane = null;
    state.picker = null;
    state.pickerLayer = null;
    state.queue = [];
    state.active = 0;
    state.imageCache = {};
    state.packStatus = "unknown";
    state.packPromise = null;
    root.MapleLanternDecoPanel = null;
  }

  root.MapleLanternDecoPanel = {
    __ready: true,
    renderPage: renderPage,
    render: renderPage,
    setImage: setImage,
    mode: mode,
    boot: bootHost,
    destroy: destroy
  };

  function ready() {
    bindHost();
    /* 让原「前景背景模组」的 :storyready 先注册图层；延迟自举只补无原模组的场景。 */
    later(bootHost, 1000);
    var pane = doc.getElementById("ml-pane");
    var tab = doc.getElementById("ml-tab-deco");
    if (pane && tab && tab.getAttribute("aria-selected") === "true") renderPage(pane);
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
