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
  var UI = root.MapleLanternUI;
  function ui(node, kind, state) {
    if (UI && typeof UI.mark === "function") { UI.mark(node, kind, state); }
    return node;
  }
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
      onlyLocal: "只看本地点可用",
      recent: "最近使用",
      recentClear: "清除",
      onlyLocalEmpty: "当前地点没有可识别的图库键（仍可选“无”）",
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
      exchange: "配置备份",
      exchangeHint: "复制这段 JSON 可备份九层图、层级偏移、自动名单与预设；粘贴后点“导入”即可恢复。",
      exportConfig: "导出配置",
      importConfig: "导入配置",
      exportDone: "已导出，可复制保存",
      importDone: "已导入",
      importBad: "导入失败：不是灯台配置或格式不对",
      importEmpty: "没有可导入的文本",
      filter: "地点滤镜",
      autoSection: "自动布景（按地点）",
      autoBg: "启用背景",
      autoFg: "启用前景",
      autoFilter: "启用滤镜效果（实验性功能）",
      disabled: "已停用",
      autoEnabled: "已启用",
      autoBgOn: "背景：已启用",
      autoBgOff: "背景：已停用",
      autoFgOn: "前景：已启用",
      autoFgOff: "前景：已停用",
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
      packMissing: "图库包未加载：背景与前景都无图可读",
      packPartial: "图库不完整",
      packProbe: "图库检测中…",
      packHint: "请安装与本体同版本的 MapleLantern ImagePack，并确认 GameVersion 0.5.12.13 与 ImageLoaderHook 2.3+，再刷新游戏或点“重新检测”。",
      packPartialHint: "背景/前景只读到一侧或部分图片：请重装与本体同版本的 ImagePack，再点“重新检测”。",
      packFolderMissing: "该图库文件夹未加载",
      packRetry: "重新检测",
      noCatalogImage: "图库无此图",
      autoNoImageHint: "名单内这些地点在图中没有对应图，自动背景/前景会跳过：",
      currentBg: "当前背景1",
      currentFg: "当前前景1",
      lastAutoBg: "上次自动背景",
      lastAutoFg: "上次自动前景",
      autoHint: "背景与前景共用同一份地点名单；开启后自动收录当前地点，每到一个新地点也会自动收录。手动移除的地点不会自动回流。",
      addAll: "一键添加所有地点",
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
      onlyLocal: "Only images usable here",
      recent: "Recent",
      recentClear: "Clear",
      onlyLocalEmpty: "No gallery key maps to this location (None is still available).",
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
      exchange: "Config backup",
      exchangeHint: "Copy this JSON to back up the nine layers, offsets, auto list and presets; paste and press Import to restore.",
      exportConfig: "Export",
      importConfig: "Import",
      exportDone: "Exported — copy and keep it",
      importDone: "Imported",
      importBad: "Import failed: not a Lantern config or malformed",
      importEmpty: "Nothing to import",
      filter: "Location filter",
      autoSection: "Auto scenery (by location)",
      autoBg: "Enable background",
      autoFg: "Enable foreground",
      autoFilter: "Enable filter effect (experimental)",
      disabled: "Disabled",
      autoEnabled: "Enabled",
      autoBgOn: "Background: on",
      autoBgOff: "Background: off",
      autoFgOn: "Foreground: on",
      autoFgOff: "Foreground: off",
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
      packMissing: "Image pack not loaded: both background and foreground are unavailable",
      packPartial: "Gallery incomplete",
      packProbe: "Checking gallery…",
      packHint: "Install the MapleLantern ImagePack that matches this build, confirm GameVersion 0.5.12.13 and ImageLoaderHook 2.3+, then refresh the game or press Retry.",
      packPartialHint: "Only one side or part of the image pack could be read. Reinstall the matching ImagePack, then press Retry.",
      packFolderMissing: "This gallery folder is not loaded",
      packRetry: "Retry",
      noCatalogImage: "No image in gallery",
      autoNoImageHint: "These whitelisted locations have no gallery image and will be skipped by auto background/foreground:",
      currentBg: "Current background 1",
      currentFg: "Current foreground 1",
      lastAutoBg: "Last auto background",
      lastAutoFg: "Last auto foreground",
      autoHint: "Background and foreground share one location list. When enabled, the current location is added automatically and new locations are added as you arrive. Locations you remove are not added back automatically.",
      addAll: "Add all locations",
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
    pickerOnlyLocal: false,
    exchangeText: "",
    exchangeStatus: "",
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
    bgStatus: "unknown",
    fgStatus: "unknown",
    bgCount: 0,
    bgTotal: 0,
    fgCount: 0,
    fgTotal: 0,
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

  function passage() {
    try {
      if (root.SugarCube && root.SugarCube.State && root.SugarCube.State.passage) return root.SugarCube.State.passage;
      if (root.State && root.State.passage) return root.State.passage;
    } catch (e) { /* 宿主未就绪 */ }
    return null;
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

  function folderOf(layer) {
    if (D && typeof D.layerFolder === "function") return D.layerFolder(layer);
    return layer && layer.kind === "foreground" ? "foreground1" : "background1";
  }

  function isForegroundFolder(folder) {
    return String(folder || "").toLowerCase().indexOf("foreground") === 0;
  }

  function folderReady(folder) {
    return isForegroundFolder(folder) ? state.fgStatus === "ready" : state.bgStatus === "ready";
  }

  function folderStatus(folder) {
    return isForegroundFolder(folder) ? state.fgStatus : state.bgStatus;
  }

  function imageKey(name, folder) { return "library/" + String(folder || "background1") + "/" + D.normalizeName(name); }

  function resolveImage(name, folder) {
    name = D.normalizeName(name);
    folder = folder || "background1";
    if (name === "none") return Promise.resolve("");
    var key = imageKey(name, folder);
    if (state.imageCache[key]) return Promise.resolve(state.imageCache[key]);
    var path = typeof D.libraryPath === "function" ? D.libraryPath(name, folder) : "img/decorations/ml/" + String(folder) + "/" + name + ".png";
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
      if (folderStatus(folder) === "missing") {
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
    folder = folder || folderOf(layer);
    var normalized = D.normalizeName(name);
    if (layer.id === "background1") {
      D.restoreAutoBackground(v);
      v.decoAutoBgEnabled = false;
    }
    if (layer.id === "foreground1") {
      D.restoreAutoForeground(v);
      v.decoAutoFgEnabled = false;
    }
    v[layer.varKey] = normalized;
    v[layer.showKey] = true;
    if (layer.id === "background1") delete v.decoAutoBgSource;
    if (layer.id === "foreground1") delete v.decoAutoFgSource;
    if (!v.decoImagePath || typeof v.decoImagePath !== "object") v.decoImagePath = {};
    if (normalized !== "none") {
      if (layer.id === "background1") delete v.decoImagePath[layer.id];
      else v.decoImagePath[layer.id] = D.libraryPath(normalized, folder);
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

  function unexcludeLocation(v, name) {
    var normalized = D.normalizeName(name);
    if (normalized === "none" || !Array.isArray(v.decoAutoBgExcluded)) return;
    var idx = v.decoAutoBgExcluded.indexOf(normalized);
    if (idx >= 0) v.decoAutoBgExcluded.splice(idx, 1);
  }

  /* 当前地点首选键：passage 命中（车站/施粥所/办公室）或街道总线命中的链首，
     否则退回 base/visual。保证「加入当前地点」等按钮收录的是真实生效的那张图。 */
  function hereOf(info) {
    var first = info && info.chain && info.chain[0];
    return D.normalizeName(first ? first : (info && (info.base || info.visual)));
  }

  function addLocation(name) {    var v = vars();
    if (!v) return;
    var normalized = D.normalizeName(name);
    if (normalized === "none") return;
    var list = ensureList(v, "decoAutoBgLocations");
    if (list.indexOf(normalized) < 0) list.push(normalized);
    unexcludeLocation(v, normalized);
    delete v.decoAutoBgDisabled;
    refresh();
    rebuildPage();
  }

  function addAllLocations() {
    var v = vars();
    if (!v) return;
    var list = ensureList(v, "decoAutoBgLocations");
    var seen = {};
    for (var i = 0; i < list.length; i++) seen[D.normalizeName(list[i])] = true;
    var all = D.CATALOG || [];
    for (var j = 0; j < all.length; j++) {
      var normalized = D.normalizeName(all[j]);
      if (normalized !== "none" && !seen[normalized]) {
        seen[normalized] = true;
        list.push(normalized);
      }
    }
    delete v.decoAutoBgDisabled;
    delete v.decoAutoBgExcluded;
    if (v.decoAutoBgEnabled === true) D.applyAutoBackground(v, setup(), D.CATALOG, false, passage());
    if (v.decoAutoFgEnabled === true) D.applyAutoForeground(v, setup(), D.CATALOG, false, passage());
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
    var excluded = ensureList(v, "decoAutoBgExcluded");
    if (excluded.indexOf(normalized) < 0) excluded.push(normalized);
    delete v.decoAutoBgDisabled;
    if (v.decoAutoBgEnabled === true) D.applyAutoBackground(v, setup(), D.CATALOG, false, passage());
    if (v.decoAutoFgEnabled === true) D.applyAutoForeground(v, setup(), D.CATALOG, false, passage());
    refresh();
    rebuildPage();
  }

  /* ------------------------------------------------------------------ 页骨架 */

  function packText() {
    if (state.packStatus === "ready") return t("packReady") + " · " + t("layerBg") + " " + D.CATALOG.length + " / " + t("layerFg") + " " + D.CATALOG.length;
    if (state.packStatus === "partial") return t("packPartial") + " · " + t("layerBg") + " " + state.bgCount + "/" + state.bgTotal + " · " + t("layerFg") + " " + state.fgCount + "/" + state.fgTotal;
    if (state.packStatus === "missing") return t("packMissing");
    return t("packProbe");
  }

  /* 只抽查首/中/末三张背景 + 同一组三张前景，避免为了判断图库是否完整
     而把 166 张图全部读进内存。两侧各自统计：背景命中 3/3、前景命中 3/3
     才算 ready；单侧全空算该侧 missing，整体至少一侧可用为 partial。 */
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
    state.bgTotal = names.length;
    state.fgTotal = names.length;
    if (!modUtils || typeof modUtils.getImage !== "function") {
      state.packStatus = "missing";
      state.bgStatus = "missing";
      state.fgStatus = "missing";
      state.packCount = 0;
      state.bgCount = 0;
      state.fgCount = 0;
      state.packPromise = Promise.resolve("missing");
      syncPackStatus();
      return state.packPromise;
    }
    function probe(folder) {
      return names.map(function (name) {
        var path = typeof D.libraryPath === "function" ? D.libraryPath(name, folder) : "img/decorations/ml/" + folder + "/" + name + ".png";
        return Promise.resolve()
          .then(function () { return Promise.resolve(modUtils.getImage(path)); })
          .then(function (value) { return normalizeImageUrl(value) ? 1 : 0; })
          .catch(function () { return 0; });
      });
    }
    state.packPromise = Promise.all(probe("background1").concat(probe("foreground1"))).then(function (hits) {
      var bgOk = 0;
      var fgOk = 0;
      for (var i = 0; i < names.length; i++) {
        bgOk += hits[i];
        fgOk += hits[names.length + i];
      }
      state.bgCount = bgOk;
      state.fgCount = fgOk;
      state.packCount = bgOk + fgOk;
      state.packTotal = names.length * 2;
      state.bgStatus = bgOk === names.length ? "ready" : (bgOk === 0 ? "missing" : "partial");
      state.fgStatus = fgOk === names.length ? "ready" : (fgOk === 0 ? "missing" : "partial");
      state.packStatus = state.bgStatus === "ready" && state.fgStatus === "ready" ? "ready"
        : (state.bgStatus === "missing" && state.fgStatus === "missing" ? "missing" : "partial");
      syncPackStatus();
      return state.packStatus;
    }).catch(function () {
      state.packStatus = "missing";
      state.bgStatus = "missing";
      state.fgStatus = "missing";
      state.packCount = 0;
      state.bgCount = 0;
      state.fgCount = 0;
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
    state.bgStatus = "unknown";
    state.fgStatus = "unknown";
    state.bgCount = 0;
    state.bgTotal = 0;
    state.fgCount = 0;
    state.fgTotal = 0;
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
    var autoBg = state.page.querySelector("[data-deco-auto-toggle]");
    if (autoBg) autoBg.disabled = state.bgStatus !== "ready";
    var autoFg = state.page.querySelector("[data-deco-auto-fg-toggle]");
    if (autoFg) autoFg.disabled = state.fgStatus !== "ready";
    var required = state.page.querySelectorAll("[data-deco-pack-required]");
    for (var j = 0; j < required.length; j++) required[j].disabled = missing;
    var bgRequired = state.page.querySelectorAll("[data-deco-pack-bg-required]");
    for (var b = 0; b < bgRequired.length; b++) bgRequired[b].disabled = state.bgStatus !== "ready";
    var fgRequired = state.page.querySelectorAll("[data-deco-pack-fg-required]");
    for (var f = 0; f < fgRequired.length; f++) fgRequired[f].disabled = state.fgStatus !== "ready";
    if (missing) {
      var picks = state.page.querySelectorAll(".ml-deco-pick");
      for (var k = 0; k < picks.length; k++) {
        if (picks[k].getAttribute("data-deco-pick-name") !== "none") picks[k].disabled = true;
      }
    }
    markDeco(state.page);
  }

  function buildStatus() {
    var v = vars() || {};
    var info = D.locationInfo(v, setup(), passage());
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
    var fgName = D.normalizeName(v.foreground_image1);
    section.appendChild(text("div", t("currentFg") + ": " + (fgName === "none" ? t("none") : fgName), "ml-deco-muted"));
    if (v.decoAutoBgEnabled === true && v.decoAutoBgSource) {
      var sourceName = D.normalizeName(v.decoAutoBgSource);
      section.appendChild(text("div", t("lastAutoBg") + ": " + (sourceName === "none" ? t("none") : sourceName), "ml-deco-muted"));
    }
    if (v.decoAutoFgEnabled === true && v.decoAutoFgSource) {
      var fgSourceName = D.normalizeName(v.decoAutoFgSource);
      section.appendChild(text("div", t("lastAutoFg") + ": " + (fgSourceName === "none" ? t("none") : fgSourceName), "ml-deco-muted"));
    }
    if (mode() === D.MODE.external) section.appendChild(text("p", t("externalHint"), "ml-hint is-warn"));
    if (mode() === D.MODE.unavailable) section.appendChild(text("p", t("unavailable"), "ml-hint is-warn"));
    return section;
  }

  function buildPicker() {
    var picker = el("div", "ml-deco-picker", { hidden: "", "data-deco-picker": "1" });
    var head = el("div", "ml-deco-picker-head");
    head.appendChild(text("h4", t("picker"), "ml-deco-section-title"));
    var sourceNode = text("span", "", "ml-deco-picker-source");
    sourceNode.setAttribute("data-deco-picker-source", "1");
    head.appendChild(sourceNode);
    head.appendChild(button("×", "ml-deco-close", closePicker));
    picker.appendChild(head);

    var tools = el("div", "ml-deco-picker-tools");
    var search = el("input", "ml-deco-search", { type: "search", placeholder: t("search") });
    tools.appendChild(search);
    var onlyLabel = el("label", "ml-deco-check ml-deco-only-local");
    var onlyInput = el("input", "", { type: "checkbox", "data-deco-only-local": "1" });
    onlyInput.checked = state.pickerOnlyLocal === true;
    onlyLabel.appendChild(onlyInput);
    onlyLabel.appendChild(text("span", t("onlyLocal")));
    tools.appendChild(onlyLabel);
    picker.appendChild(tools);

    var recentRow = el("div", "ml-deco-recent", { "data-deco-recent": "1", hidden: "" });
    picker.appendChild(recentRow);
    var emptyHint = text("p", t("onlyLocalEmpty"), "ml-hint");
    emptyHint.setAttribute("data-deco-only-empty", "1");
    emptyHint.hidden = true;
    picker.appendChild(emptyHint);

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
    picker.__recent = recentRow;
    picker.__emptyHint = emptyHint;
    picker.__search = search;
    picker.__customInput = customInput;
    picker.__source = sourceNode;
    state.picker = picker;

    /* 107 项重建 + 缩略图入队较重：输入去抖 150ms，中文输入法组合期不重建 */
    var searchTimer = 0;
    var composing = false;
    function scheduleGrid() {
      if (searchTimer) root.clearTimeout(searchTimer);
      searchTimer = root.setTimeout(function () { searchTimer = 0; renderPickerGrid(); }, 150);
    }
    search.addEventListener("input", function () {
      state.pickerQuery = String(search.value || "").trim().toLowerCase();
      if (!composing) scheduleGrid();
    });
    search.addEventListener("compositionstart", function () { composing = true; });
    search.addEventListener("compositionend", function () { composing = false; scheduleGrid(); });
    onlyInput.addEventListener("change", function () {
      state.pickerOnlyLocal = onlyInput.checked === true;
      renderPickerGrid();
    });
    return picker;
  }

  function layerCard(layer, v) {
    var card = el("div", "ml-deco-card", { "data-layer": layer.id, "data-deco-folder": folderOf(layer) });
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
    loadThumb(img, v[layer.varKey], folderOf(layer), t("empty"));
    card.appendChild(thumbWrap);

    var row = el("div", "ml-deco-card-row");
    var choose = button(t("select"), "ml-btn ml-btn-sm", function () { openPicker(layer); });
    choose.setAttribute("data-deco-select-image", layer.id);
    row.appendChild(choose);
    row.appendChild(button(t("clear"), "ml-btn ml-btn-sm", function () { setImage(layer, "none", folderOf(layer)); }));
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

  function buildExchange() {
    var section = el("section", "ml-deco-section", { "data-deco-exchange-section": "1" });
    section.appendChild(text("h4", t("exchange"), "ml-deco-section-title"));
    section.appendChild(text("p", t("exchangeHint"), "ml-hint"));
    var area = el("textarea", "ml-deco-exchange", { rows: "4", "data-deco-exchange": "1" });
    area.value = state.exchangeText || "";
    section.appendChild(area);

    var status = text("p", state.exchangeStatus || "", "ml-hint");
    status.setAttribute("data-deco-exchange-status", "1");
    status.hidden = !state.exchangeStatus;
    section.appendChild(status);

    var row = el("div", "ml-deco-exchange-actions");
    var exportBtn = button(t("exportConfig"), "ml-btn ml-btn-sm", function () {
      var v = vars();
      if (!v) return;
      var dump = D.exportDeco(v);
      if (!dump) return;
      state.exchangeText = JSON.stringify(dump, null, 2);
      area.value = state.exchangeText;
      state.exchangeStatus = t("exportDone");
      status.textContent = state.exchangeStatus;
      status.hidden = false;
      try { area.focus(); area.select(); } catch (e) { /* 老 WebView 不支持 select */ }
    });
    exportBtn.setAttribute("data-deco-export", "1");
    row.appendChild(exportBtn);

    var importBtn = button(t("importConfig"), "ml-btn ml-btn-sm", function () {
      var v = vars();
      if (!v) return;
      var raw = String(area.value || "").trim();
      if (!raw) {
        state.exchangeStatus = t("importEmpty");
        status.textContent = state.exchangeStatus;
        status.hidden = false;
        return;
      }
      var data = null;
      try { data = JSON.parse(raw); } catch (e) { data = null; }
      var res = D.importDeco(v, data);
      if (!res.ok) {
        state.exchangeStatus = t("importBad");
        status.textContent = state.exchangeStatus;
        status.hidden = false;
        return;
      }
      state.exchangeText = raw;
      state.exchangeStatus = t("importDone") + " · " + res.applied + " / " + res.presets;
      refresh();
      rebuildPage();
    });
    importBtn.setAttribute("data-deco-import", "1");
    row.appendChild(importBtn);
    section.appendChild(row);
    return section;
  }

  function buildAuto() {
    var v = vars() || {};
    var info = D.locationInfo(v, setup(), passage());
    var section = el("section", "ml-deco-section", { "data-deco-auto": "1" });
    section.appendChild(text("h4", t("autoSection"), "ml-deco-section-title"));

    var toggles = el("div", "ml-deco-auto-toggles");
    var autoLabel = el("label", "ml-deco-check");
    var auto = el("input", "", { type: "checkbox", "data-deco-auto-toggle": "1" });
    auto.checked = v.decoAutoBgEnabled === true;
    auto.addEventListener("change", function () {
      var current = vars();
      if (!current) return;
      current.decoAutoBgEnabled = auto.checked;
      if (auto.checked) {
        D.ensureAutoLocation(current, setup(), D.CATALOG, passage());
        D.applyAutoBackground(current, setup(), D.CATALOG, false, passage());
      } else D.restoreAutoBackground(current);
      refresh();
      rebuildPage();
    });
    autoLabel.appendChild(auto);
    autoLabel.appendChild(text("span", t("autoBg")));
    toggles.appendChild(autoLabel);

    var fgAutoLabel = el("label", "ml-deco-check");
    var fgAuto = el("input", "", { type: "checkbox", "data-deco-auto-fg-toggle": "1" });
    fgAuto.checked = v.decoAutoFgEnabled === true;
    fgAuto.addEventListener("change", function () {
      var current = vars();
      if (!current) return;
      current.decoAutoFgEnabled = fgAuto.checked;
      if (fgAuto.checked) {
        D.ensureAutoLocation(current, setup(), D.CATALOG, passage());
        D.applyAutoForeground(current, setup(), D.CATALOG, false, passage());
      } else D.restoreAutoForeground(current);
      refresh();
      rebuildPage();
    });
    fgAutoLabel.appendChild(fgAuto);
    fgAutoLabel.appendChild(text("span", t("autoFg")));
    toggles.appendChild(fgAutoLabel);
    section.appendChild(toggles);

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
    var bgOn = v.decoAutoBgEnabled === true;
    var fgOn = v.decoAutoFgEnabled === true;
    var stateNode = el("div", "ml-deco-auto-state" + ((bgOn || fgOn) ? " is-on" : ""), { "data-deco-auto-state": "1" });
    stateNode.textContent = (bgOn ? t("autoBgOn") : t("autoBgOff")) + " · " + (fgOn ? t("autoFgOn") : t("autoFgOff"));
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
      addLocation(hereOf(D.locationInfo(vars(), setup(), passage())));
    });
    currentBtn.setAttribute("data-deco-location-current", "1");
    locRow.appendChild(currentBtn);
    section.appendChild(locRow);

    var actionRow = el("div", "ml-deco-preset-new");
    var addAllBtn = button(t("addAll"), "ml-btn ml-btn-sm", addAllLocations);
    addAllBtn.setAttribute("data-deco-location-add-all", "1");
    addAllBtn.setAttribute("data-deco-pack-required", "1");
    actionRow.appendChild(addAllBtn);
    var matchBtn = button(t("match"), "ml-btn ml-btn-sm", function () {
      var current = vars();
      if (!current) return;
      var here = hereOf(D.locationInfo(current, setup(), passage()));
      if (here !== "none") {
        var allowed = ensureList(current, "decoAutoBgLocations");
        if (allowed.indexOf(here) < 0) allowed.push(here);
        unexcludeLocation(current, here);
      }
      var bgOn = current.decoAutoBgEnabled === true;
      var fgOn = current.decoAutoFgEnabled === true;
      if (!bgOn && !fgOn) {
        current.decoAutoBgEnabled = true;
        bgOn = true;
      }
      if (bgOn) D.applyAutoBackground(current, setup(), D.CATALOG, true, passage());
      if (fgOn) D.applyAutoForeground(current, setup(), D.CATALOG, true, passage());
      refresh();
      rebuildPage();
    });
    matchBtn.setAttribute("data-deco-pack-required", "1");
    actionRow.appendChild(matchBtn);
    var resetAuto = button(t("autoReset"), "ml-btn ml-btn-sm", function () {
      var current = vars();
      if (!current) return;
      D.restoreAutoBackground(current);
      D.restoreAutoForeground(current);
      current.decoAutoBgEnabled = false;
      current.decoAutoFgEnabled = false;
      current.decoAutoBgLocations = [];
      delete current.decoAutoBgDisabled;
      delete current.decoAutoBgExcluded;
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
      var info = D.locationInfo(v, setup(), passage());
      var here = hereOf(info);
      if (here !== "none") {
        var list = ensureList(v, "decoAutoBgLocations");
        if (list.indexOf(here) < 0) list.push(here);
      }
      v.decoAutoBgEnabled = true;
      D.applyAutoBackground(v, setup(), D.CATALOG, true, passage());
      if (v.decoAutoFgEnabled === true) D.applyAutoForeground(v, setup(), D.CATALOG, true, passage());
      refresh();
      rebuildPage();
    });
    applyCurrent.setAttribute("data-deco-pack-required", "1");
    section.appendChild(applyCurrent);
    section.appendChild(button(t("restorePlayer"), "ml-btn ml-btn-wide", function () {
      var v = vars();
      if (!v) return;
      D.restoreAutoBackground(v);
      D.restoreAutoForeground(v);
      v.decoAutoBgEnabled = false;
      v.decoAutoFgEnabled = false;
      delete v.decoAutoBgSource;
      delete v.decoAutoFgSource;
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
    options.appendChild(buildExchange());
    options.appendChild(buildAuto());
    page.appendChild(options);
    page.appendChild(buildFilter());
    page.appendChild(buildReset());
    markDeco(page);
    pane.appendChild(page);
    refresh();
    probeImagePack();
  }

  /* 布景页由多个 builder 拼成；统一在挂载前补 UI kit 语义，避免每个
     builder 各写一套 data-ui。空图层卡走 empty，已选图层走 filled。 */
  function markDeco(scope) {
    if (!scope || typeof scope.querySelectorAll !== "function") return;
    var packStatus = state.packStatus;
    var danger = packStatus === "partial" || packStatus === "missing";
    /* 只有状态条承载「图库缺包」的告警；预设、自动、地点等区块仍可用，
       不跟着整页变红。 */
    var statuses = scope.querySelectorAll(".ml-deco-status");
    for (var i = 0; i < statuses.length; i++) {
      ui(statuses[i], "section", danger ? "danger" : "normal");
    }
    var sections = scope.querySelectorAll(".ml-deco-section, .ml-deco-group");
    for (var s = 0; s < sections.length; s++) {
      ui(sections[s], "section", "normal");
    }
    var cards = scope.querySelectorAll(".ml-deco-card");
    for (var j = 0; j < cards.length; j++) {
      var nameNode = cards[j].querySelector(".ml-deco-name");
      var name = nameNode ? String(nameNode.textContent || "").trim() : "";
      ui(cards[j], "card", name && name !== "none" ? "filled" : "empty");
    }
    var picker = scope.querySelector(".ml-deco-picker");
    if (picker) ui(picker, "card", "normal");
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
    state.pickerSource = folderOf(layer);
    state.pickerQuery = "";
    picker.__search.value = "";
    picker.__customInput.value = "";
    picker.__customInput.placeholder = t("custom") + " · " + state.pickerSource;
    if (picker.__source) {
      picker.__source.textContent = (layer.kind === "foreground" ? t("layerFg") : t("layerBg")) + " " + layer.index + " · " + state.pickerSource;
    }
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

  function renderRecentRow(picker, source) {
    var row = picker.__recent;
    if (!row) return;
    row.textContent = "";
    var keys = [];
    try { keys = D.decoRecent(vars() || {}); } catch (e) { keys = []; }
    if (!keys.length) { row.hidden = true; return; }
    row.hidden = false;
    row.appendChild(text("span", t("recent"), "ml-deco-recent-label"));
    keys.forEach(function (name) {
      var chip = button(name, "ml-deco-chip", function () {
        var layer = state.pickerLayer;
        if (!layer) return;
        try { D.decoRemember(vars() || {}, name); } catch (e) { /* 不向游戏抛 */ }
        setImage(layer, name, source);
        closePicker();
      });
      chip.setAttribute("data-deco-recent-name", name);
      chip.title = name;
      row.appendChild(chip);
    });
    var clear = button(t("recentClear"), "ml-deco-chip ml-deco-chip-clear", function () {
      var v = vars();
      if (!v) return;
      v.decoRecent = [];
      renderRecentRow(state.picker, state.pickerSource);
    });
    clear.setAttribute("data-deco-recent-clear", "1");
    row.appendChild(clear);
  }

  function renderPickerGrid() {
    var picker = state.picker;
    if (!picker || picker.hidden) return;
    var grid = picker.__grid;
    grid.textContent = "";
    var source = state.pickerSource;
    var sourceStatus = folderStatus(source);
    var q = state.pickerQuery;
    var hint = picker.querySelector("[data-deco-pack-hint]");
    if (hint) {
      hint.hidden = sourceStatus === "ready";
      hint.textContent = sourceStatus === "missing" ? (t("packFolderMissing") + " · " + source)
        : (sourceStatus === "partial" ? t("packPartialHint") : t("packHint"));
    }

    /* 「只看本地点可用」：按灯台真实图链顺序取当前地点可命中的图库键 */
    var onlyLocal = state.pickerOnlyLocal === true;
    var chain = [];
    if (onlyLocal) {
      var info = null;
      try { info = D.locationInfo(vars() || {}, setup(), passage()); } catch (e) { info = null; }
      if (info && info.chain) {
        for (var ci = 0; ci < info.chain.length; ci++) {
          var ck = D.normalizeName(info.chain[ci]);
          if (ck !== "none" && chain.indexOf(ck) < 0) chain.push(ck);
        }
      }
    }

    var emptyHint = picker.__emptyHint;
    if (emptyHint) emptyHint.hidden = !(onlyLocal && !chain.length);

    function remember(name) {
      try { D.decoRemember(vars() || {}, name); } catch (e) { /* 不向游戏抛 */ }
    }

    function addItem(name, label) {
      if (q && (String(name) + " " + String(label)).toLowerCase().indexOf(q) < 0) return;
      if (onlyLocal && name !== "none" && chain.indexOf(name) < 0) return;
      var item = el("button", "ml-deco-pick", { type: "button" });
      item.setAttribute("data-deco-pick-name", name);
      item.setAttribute("data-deco-pick-folder", source);
      if (name !== "none" && sourceStatus === "missing") item.disabled = true;
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
        remember(name);
        setImage(layer, name, source);
        closePicker();
      });
      grid.appendChild(item);
    }

    addItem("none", t("none"));
    D.CATALOG.forEach(function (name) { addItem(name, name); });
    renderRecentRow(picker, source);
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
      try { D.applyAutoOnPassage({ vars: vars(), setup: setup(), passage: passage() }); } catch (e) { /* 不向游戏抛 */ }
      refresh();
      syncStatus();
    }, 0);
  }

  function onStoryReady() {
    later(function () {
      try { bootHost(); } catch (e) { /* 不向游戏抛 */ }
      try { D.applyAutoOnPassage({ vars: vars(), setup: setup(), passage: passage() }); } catch (e) { /* 不向游戏抛 */ }
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
