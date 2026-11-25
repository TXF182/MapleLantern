/* ============================================================================
 * 灯台 · MapleLantern — deco-core.js
 * 前景 / 背景九层布景的纯逻辑与宿主桥接。
 *
 * 设计边界：
 * - 原「前景背景模组」的九层实际接入渲染时只读兼容、让出渲染权，不与其抢 CanvasModel。
 * - 原模组只声明 char.layers 但未接入渲染时，灯台接管，避免两套都不画。
 * - 原模组不存在时由灯台直接注册 4 背景 + 5 前景层，变量名与图片路径保持兼容。
 * - 本文件不依赖 maplebirch；任何 Renderer 缺失 / 宿主异常都不向游戏抛出。
 * ========================================================================== */
;(function (root, factory) {
  "use strict";
  var api = factory(root);
  if (typeof module === "object" && module.exports) { module.exports = api; }
  if (root) { root.MapleLanternDeco = api; }
})(typeof window !== "undefined" ? window : globalThis, function (root) {
  "use strict";

  var LAYERS = [
    { id: "background1", kind: "background", index: 1, varKey: "background_image1", showKey: "show_background1", folder: "background1", zKey: "deco_bg1", baseZ: -30 },
    { id: "background2", kind: "background", index: 2, varKey: "background_image2", showKey: "show_background2", folder: "background1", zKey: "deco_bg2", baseZ: -25 },
    { id: "background3", kind: "background", index: 3, varKey: "background_image3", showKey: "show_background3", folder: "background1", zKey: "deco_bg3", baseZ: -20 },
    { id: "background4", kind: "background", index: 4, varKey: "background_image4", showKey: "show_background4", folder: "background1", zKey: "deco_bg4", baseZ: -15 },
    { id: "foreground1", kind: "foreground", index: 1, varKey: "foreground_image1", showKey: "show_foreground1", folder: "foreground1", zKey: "deco_fg1", baseZ: 300 },
    { id: "foreground2", kind: "foreground", index: 2, varKey: "foreground_image2", showKey: "show_foreground2", folder: "foreground1", zKey: "deco_fg2", baseZ: 305 },
    { id: "foreground3", kind: "foreground", index: 3, varKey: "foreground_image3", showKey: "show_foreground3", folder: "foreground1", zKey: "deco_fg3", baseZ: 310 },
    { id: "foreground4", kind: "foreground", index: 4, varKey: "foreground_image4", showKey: "show_foreground4", folder: "foreground1", zKey: "deco_fg4", baseZ: 315 },
    { id: "foreground5", kind: "foreground", index: 5, varKey: "foreground_image5", showKey: "show_foreground5", folder: "foreground1", zKey: "deco_fg5", baseZ: 320 }
  ];

  /* 新图包 5.12 重绘的 88 个地点图名（background1 图库；顺序仅影响选择器展示）。
     Core4 补图 2026-11-24：mer_pier / orphanage / cliff_dock / lake_rock；
     同轮收入图库附带的 underground_dance。
     街道总线补图 2026-11-24：13 条城镇街道 + 农场路1（页面均 $location="town"
     且 $outside=1，仅 $bus 区分），回退均为 town。
     室内借用页补图 2026-11-24：车站（Bus Station）、施粥所（Soup Kitchen /
     Soup Kitchen Closed）、警察局办公室（Police Back Office）没有 $bus，
     $location 分别是 town/temple/police_station，同 location 的室内 passage 有
     几十到几百个，只能按 passage 名精确命中（见 PASSAGE_MAP），回退各自共用图。 */
  var CATALOG = [
    "adult_shop", "alex_cottage", "alex_farm", "arcade", "asylum", "avery_mansion", "avery_skyscraper",
    "beach", "blitz", "bog", "brothel", "cabin", "cafe_construction", "cafe_renovated", "cafe", "canal",
    "castle", "chalets", "churchyard", "coastpath", "com_alley", "compound", "dance_studio", "dilapidated_shop",
    "docks", "drain", "estate_cottage", "estate", "factory", "farm_manors", "farm", "fields", "flats", "forest_shop_garden",
    "forest_shop", "forest", "home", "hospital", "ind_alley", "island", "kylar_manor", "kylarmanor_grounds",
    "lake_office", "lake_ruin", "lake", "landfill", "market", "meadow", "mines", "moor", "museum", "night_monster_lair",
    "oak", "office", "old_temple", "park", "pirate_ship", "police_station", "pool", "pound", "prison", "promenade",
    "pub", "res_alley", "riding_school", "school_rear_courtyard", "school", "sea", "sepulchre", "sewers",
    "shopping_centre_roof", "shopping_centre", "spa", "strip_club", "studio", "temple", "tentworld", "tower", "town",
    "townhall", "underground_farm", "underground", "underground_dance", "wolf_cave",
    "mer_pier", "orphanage", "cliff_dock", "lake_rock",
    "barb", "cliff", "connudatus", "danube", "domus", "elk", "farmroad1",
    "harvest", "high", "mer", "nightingale", "oxford", "starfish", "wolf",
    "bus_station", "soup_kitchen", "police_back_office",
    "hotel"
  ];

  /* 室内借用页的 passage 名 → 图库键；键名已是 normalizeName 后的形态
     （小写、连字符转下划线，空格保留）。passage 判据比 $bus 更精确，
     命中后插到链最前。 */
  var PASSAGE_MAP = {
    "bus station": "bus_station",
    "soup kitchen": "soup_kitchen",
    "soup kitchen closed": "soup_kitchen",
    "police back office": "police_back_office",
    /* 2026-11-25 取证：原版 passage 名 `Underground Dance` / `Underground Dance Intro`
       是地下舞蹈场（$location="underground"，同地点其他室内页很多），图库有
       underground_dance 专属图，按 passage 名精确命中。 */
    "underground dance": "underground_dance",
    "underground dance intro": "underground_dance"
  };

  /* $bus 的街区档位在 DoL 里叫 commercial / industrial / residential，图库键却是
     com_alley / ind_alley / res_alley；其余 $bus 值与图库键同名（domus / danube /
     cliff / park …），直接命中即可。2026-11-25 复核：此前直接 add(bus)，三张
     街区暗巷图在链上永远拿不到（图库没有 commercial/industrial/residential 键）。 */
  var BUS_ALIAS = { commercial: "com_alley", industrial: "ind_alley", residential: "res_alley" };

  var MODE = { external: "external", native: "native", unavailable: "unavailable" };
  /* 灯台自带 106 张背景 + 106 张前景，分别放在独立目录，避免与原「地點圖包」
     的 img/decorations/background1/<name>.png 同名；图片钩子按路径精确查表，
     同路径时实际会命中先注册的原图包。 */
  var LIBRARY_DIR = "img/decorations/ml/background1";
  var FOREGROUND_DIR = "img/decorations/ml/foreground1";
  var state = { mode: MODE.unavailable, registered: false, overlayStep: null };

  function folderDir(folder) {
    return String(folder || "").toLowerCase().indexOf("foreground") === 0 ? FOREGROUND_DIR : LIBRARY_DIR;
  }

  function layerFolder(layer) {
    return layer && layer.kind === "foreground" ? "foreground1" : "background1";
  }

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { return fallback; }
  }

  function getVars(vars) {
    if (vars && typeof vars === "object") return vars;
    return safe(function () { return root.State.variables; }, null) ||
      safe(function () { return root.SugarCube.State.variables; }, null) || null;
  }

  function getSetup(setup) {
    return setup || safe(function () { return root.setup; }, null) || null;
  }

  function has(obj, key) {
    return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
  }

  /* 原版地点名与图库名不一致的少量特例：连字符统一换下划线后仍对不上。 */
  var LOCATION_ALIASES = {
    "coastal_path": "coastpath",
    "kylar_manor_grounds": "kylarmanor_grounds",
    "tent_world": "tentworld",
    "town_hall": "townhall"
  };

  function normalizeName(value) {
    if (value === undefined || value === null) return "none";
    var name = String(value).trim();
    if (!name || name.toLowerCase() === "none") return "none";
    name = name.replace(/\.png$/i, "").replace(/-/g, "_").toLowerCase();
    if (!name || name === "." || name === "..") return "none";
    if (/[\\/]/.test(name) || /\.\./.test(name)) return "none";
    return LOCATION_ALIASES[name] || name;
  }

  function layerById(id) {
    for (var i = 0; i < LAYERS.length; i++) if (LAYERS[i].id === id) return LAYERS[i];
    return null;
  }

  function libraryPath(name, folder) {
    return folderDir(folder) + "/" + normalizeName(name) + ".png";
  }

  function safeImagePath(value, layer) {
    if (typeof value !== "string") return "";
    var path = value.trim().replace(/\\/g, "/");
    if (!path || path.indexOf("..") >= 0) return "";
    var dir = folderDir(layerFolder(layer));
    var target = new RegExp("^" + dir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/[^/]+\\.png$", "i");
    if (target.test(path)) return path;
    /* 旧存档/旧预览写入的是原模组目录；只接受同类型目录，背景图不得写进
       前景槽，前景图也不得写进背景槽，统一改写到灯台自己的对应图库目录。 */
    var legacy = /^img\/decorations\/(background[1-4]|foreground[1-5])\/([^/]+\.png)$/i.exec(path);
    if (legacy) {
      var sourceKind = legacy[1].toLowerCase().indexOf("foreground") === 0 ? "foreground" : "background";
      var targetKind = layer && layer.kind === "foreground" ? "foreground" : "background";
      if (sourceKind === targetKind) return dir + "/" + legacy[2];
    }
    return "";
  }

  function imagePath(layer, vars) {
    vars = getVars(vars) || {};
    var name = normalizeName(vars[layer.varKey]);
    var override = "";
    if (vars.decoImagePath && typeof vars.decoImagePath === "object") {
      override = safeImagePath(vars.decoImagePath[layer.id], layer);
    }
    if (override) return /\.png$/i.test(override) ? override : override + ".png";
    /* 背景层统一走 background1，前景层统一走 foreground1；两条目录互不混用。 */
    return libraryPath(name, layer.folder);
  }

  function layerVisible(layer, vars) {
    vars = getVars(vars) || {};
    return vars[layer.showKey] !== false;
  }

  function layerZ(layer, vars) {
    vars = getVars(vars) || {};
    var raw = vars.decoImageZ && vars.decoImageZ[layer.zKey];
    var offset = Number(raw);
    if (!isFinite(offset)) offset = 0;
    offset = Math.max(-50, Math.min(50, Math.round(offset)));
    return layer.baseZ + offset;
  }

  function locationInfo(vars, setup, passage) {
    vars = getVars(vars) || {};
    setup = getSetup(setup) || {};
    var visual = safe(function () { return setup.Locations.get(); }, null) || vars.location || "";
    var base = vars.location || visual;
    var chain = [];
    var seen = {};
    function add(name) {
      if (typeof name !== "string" || !name) return;
      if (seen[name]) return;
      seen[name] = true;
      chain.push(name);
    }
    /* 室内借用页：车站/施粥所/警察局办公室没有 $bus，$location 与几十上百个
       同地点的室内 passage 相同，只能按 passage 名精确命中；映射键插到链最前，
       缺图时继续回退各自共用图（town/temple/police_station）。 */
    var passageKey = normalizeName(passage);
    var mapped = passageKey !== "none" && PASSAGE_MAP[passageKey] ? PASSAGE_MAP[passageKey] : "";
    if (mapped && mapped !== normalizeName(base)) add(mapped);
    /* 原版 setup.Locations.get() 对未映射地点回退返回 home。若仍按视觉地点优先，
       landfill / cliff-dock 这类具体地点会被 home 抢在图链第一位。此时先走基础地点
       与父级链，把 home 移到链尾，只作最后兜底；其余情况保持原先 visual 优先。 */
    var homeFallback = normalizeName(visual) === "home" && normalizeName(base) !== "home";
    var meta = setup.locations && setup.locations[base] ? setup.locations[base] : null;
    var outsideMeta = meta || (setup.locations && setup.locations[visual] ? setup.locations[visual] : null);
    var outside = vars.outside !== undefined ? !!vars.outside : (outsideMeta && outsideMeta.outside !== undefined ? !!outsideMeta.outside : false);
    /* 街道总线：原版城镇街道页（宅邸街/多瑙河街/…/峭壁街）与农场路1 全部写死
       $location="town" + $outside=1，只有 $bus 区分；setup.Locations.get() 不读 $bus。
       暗巷两个场景同构：$location="alley" + $bus=commercial/industrial/residential，
       工业区暴露页 $location="industrial" + $bus=industrial（2026-11-25 复核：
       这三类此前都只能回退 town，而 com_alley/ind_alley/res_alley 三张图在库）。
       此时把 $bus 映射后的街区键插到图链最前：图库有图就命中，缺图继续回退。
       室内不插（如 Bus Station 是 $outside=0），避免共用地点误用街图。 */
    var bus = normalizeName(vars.bus);
    var busKey = BUS_ALIAS[bus] || bus;
    var streetBase = base === "town" || base === "alley" || base === "industrial";
    var streetBus = streetBase && outside && bus !== "none" && busKey !== normalizeName(base) && busKey !== normalizeName(visual);
    if (streetBus) add(busKey);
    if (!homeFallback) add(visual);
    add(base);
    if (meta) {
      add(meta.location);
      var current = base;
      var info = meta;
      for (var i = 0; i < 24 && info; i++) {
        var parent = info.parent;
        if (typeof parent === "string" && parent) {
          add(parent);
          current = parent;
          info = setup.locations && setup.locations[parent] ? setup.locations[parent] : null;
          if (info && info.location) add(info.location);
        } else {
          break;
        }
      }
    }
    if (homeFallback) {
      for (var h = chain.length - 1; h >= 0; h--) {
        if (normalizeName(chain[h]) === "home") {
          delete seen[chain[h]];
          chain.splice(h, 1);
        }
      }
      delete seen[visual];
      add(visual);
    }
    return { visual: visual, base: base, chain: chain, outside: outside, meta: meta };
  }

  /* 自动地点是白名单，但开启自动背景或自动前景后当前地点会被自动写入名单：
     每个 passage 调 ensureAutoLocation，把链上第一个有图地点补进去。
     玩家显式移除的地点写入 decoAutoBgExcluded，不再自动回流。 */
  function pickAutoLocation(info, catalog, known, disabled, excluded) {
    var list = catalog || CATALOG;
    var images = {};
    var allowed = {};
    var blocked = {};
    var hard = {};
    for (var i = 0; i < list.length; i++) images[normalizeName(list[i])] = true;
    if (known && typeof known === "object") {
      var keys = Array.isArray(known) ? known : Object.keys(known);
      for (var k = 0; k < keys.length; k++) {
        var key = normalizeName(keys[k]);
        if (key !== "none") allowed[key] = true;
      }
    }
    if (Array.isArray(disabled)) {
      for (var d = 0; d < disabled.length; d++) blocked[normalizeName(disabled[d])] = true;
    }
    if (Array.isArray(excluded)) {
      for (var e = 0; e < excluded.length; e++) {
        var ex = normalizeName(excluded[e]);
        blocked[ex] = true;
        hard[ex] = true;
      }
    }
    if (!Object.keys(allowed).length) return "none";
    var firstImage = "none";
    for (var f = 0; f < info.chain.length; f++) {
      var first = normalizeName(info.chain[f]);
      if (first !== "none" && images[first]) { firstImage = first; break; }
    }
    /* 当前地点/房间在玩家排除名单里时直接停用，不拿父级地点顶替；
       否则在 home 里移除 home 会突然套上 town 的图。 */
    if (firstImage !== "none" && hard[firstImage]) return "none";
    for (var c = 0; c < info.chain.length; c++) {
      var name = normalizeName(info.chain[c]);
      if (name !== "none" && allowed[name] && images[name] && !blocked[name]) return name;
    }
    return "none";
  }

  function autoCatalogName(info, catalog, excluded) {
    var list = catalog || CATALOG;
    var images = {};
    var blocked = {};
    for (var i = 0; i < list.length; i++) images[normalizeName(list[i])] = true;
    if (Array.isArray(excluded)) {
      for (var e = 0; e < excluded.length; e++) blocked[normalizeName(excluded[e])] = true;
    }
    for (var c = 0; c < info.chain.length; c++) {
      var name = normalizeName(info.chain[c]);
      if (name !== "none" && images[name] && !blocked[name]) return name;
    }
    return "none";
  }

  function ensureAutoLocation(vars, setup, catalog, passage) {
    vars = getVars(vars) || {};
    if (vars.decoAutoBgEnabled !== true && vars.decoAutoFgEnabled !== true) return "none";
    var info = locationInfo(vars, setup, passage);
    var found = autoCatalogName(info, catalog || CATALOG, vars.decoAutoBgExcluded);
    if (found === "none") return "none";
    if (!Array.isArray(vars.decoAutoBgLocations)) vars.decoAutoBgLocations = [];
    var exists = false;
    for (var i = 0; i < vars.decoAutoBgLocations.length; i++) {
      if (normalizeName(vars.decoAutoBgLocations[i]) === found) { exists = true; break; }
    }
    if (!exists) vars.decoAutoBgLocations.push(found);
    return found;
  }

  function capKey(id) {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  function cloneObject(value) {
    if (!value || typeof value !== "object") return {};
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return Object.assign({}, value); }
  }

  function savePreset(vars, slot, name) {
    vars = getVars(vars);
    if (!vars) return 0;
    if (!vars.decoPresets || typeof vars.decoPresets !== "object") vars.decoPresets = {};
    var n = Number(slot);
    if (!isFinite(n) || n <= 0) n = nextPresetSlot(vars);
    var preset = {
      name: String(name || ("预设 " + n)),
      decoImageZ: cloneObject(vars.decoImageZ),
      decoImagePath: cloneObject(vars.decoImagePath),
      shows: {},
      savedAt: Date.now()
    };
    for (var i = 0; i < LAYERS.length; i++) {
      var layer = LAYERS[i];
      preset[layer.id] = normalizeName(vars[layer.varKey]);
      preset.shows[layer.showKey] = layerVisible(layer, vars);
      preset["show" + capKey(layer.id)] = layerVisible(layer, vars);
    }
    vars.decoPresets[n] = preset;
    return n;
  }

  function applyPreset(vars, slot) {
    vars = getVars(vars);
    if (!vars || !vars.decoPresets) return false;
    var preset = vars.decoPresets[slot];
    if (!preset) return false;
    /* 预设是玩家显式选择，不能被自动地点在同一个 refresh 里立刻覆盖。 */
    if (vars.decoAutoBgActive === true) restoreAutoBackground(vars);
    else delete vars.decoAutoBgSource;
    if (vars.decoAutoFgActive === true) restoreAutoForeground(vars);
    else delete vars.decoAutoFgSource;
    vars.decoAutoBgEnabled = false;
    vars.decoAutoFgEnabled = false;
    for (var i = 0; i < LAYERS.length; i++) {
      var layer = LAYERS[i];
      vars[layer.varKey] = normalizeName(preset[layer.id]);
      if (preset.shows && has(preset.shows, layer.showKey)) vars[layer.showKey] = preset.shows[layer.showKey] !== false;
      else if (has(preset, "show" + capKey(layer.id))) vars[layer.showKey] = preset["show" + capKey(layer.id)] !== false;
      else vars[layer.showKey] = true;
    }
    vars.decoImageZ = cloneObject(preset.decoImageZ);
    vars.decoImagePath = cloneObject(preset.decoImagePath);
    return true;
  }

  function deletePreset(vars, slot) {
    vars = getVars(vars);
    if (!vars || !vars.decoPresets || !vars.decoPresets[slot]) return false;
    delete vars.decoPresets[slot];
    return true;
  }

  function nextPresetSlot(vars) {
    vars = getVars(vars) || {};
    var presets = vars.decoPresets || {};
    var slots = Object.keys(presets).map(Number).filter(function (n) { return isFinite(n) && n > 0; });
    return slots.length ? Math.max.apply(null, slots) + 1 : 1;
  }

  /* ---- 图库最近使用（存档内，最多 8 个，最近的在前） ---- */
  var RECENT_MAX = 8;

  function decoRecent(vars) {
    vars = getVars(vars) || {};
    var list = Array.isArray(vars.decoRecent) ? vars.decoRecent : [];
    var out = [];
    var seen = {};
    for (var i = 0; i < list.length && out.length < RECENT_MAX; i++) {
      var key = normalizeName(list[i]);
      if (!key || key === "none" || seen[key]) continue;
      seen[key] = true;
      out.push(key);
    }
    return out;
  }

  function decoRemember(vars, key) {
    vars = getVars(vars);
    if (!vars) return [];
    key = normalizeName(key);
    if (!key || key === "none") return decoRecent(vars);
    var list = decoRecent(vars).filter(function (x) { return x !== key; });
    list.unshift(key);
    vars.decoRecent = list.slice(0, RECENT_MAX);
    return vars.decoRecent;
  }

  /* ---- 配置导出 / 导入：只覆盖布景相关键，逐项白名单校验，坏数据整段丢弃 ---- */
  function clampZ(value) {
    var n = Number(value);
    if (!isFinite(n)) return 0;
    return Math.max(-50, Math.min(50, Math.round(n)));
  }

  function sanitizeImageMap(raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (k) {
      if (!/^[a-z0-9_]{1,40}$/.test(String(k))) return;
      var v = raw[k];
      if (typeof v !== "string") return;
      var s = v.trim();
      if (!s || s.length > 120 || s.indexOf("..") >= 0) return;
      out[k] = s;
    });
    return out;
  }

  function sanitizeZMap(raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach(function (k) {
      if (!/^[a-z0-9_]{1,40}$/.test(String(k))) return;
      out[k] = clampZ(raw[k]);
    });
    return out;
  }

  function sanitizeLocations(raw) {
    var allowed = {};
    for (var i = 0; i < CATALOG.length; i++) allowed[CATALOG[i]] = true;
    var out = [];
    if (!Array.isArray(raw)) return out;
    for (var j = 0; j < raw.length && out.length < CATALOG.length; j++) {
      var k = normalizeName(raw[j]);
      if (k && allowed[k] && out.indexOf(k) < 0) out.push(k);
    }
    return out;
  }

  function sanitizePreset(raw) {
    if (!raw || typeof raw !== "object") return null;
    var preset = {
      name: String(raw.name || "").slice(0, 40),
      savedAt: Number(raw.savedAt) || 0,
      decoImageZ: sanitizeZMap(raw.decoImageZ),
      decoImagePath: sanitizeImageMap(raw.decoImagePath),
      shows: {}
    };
    for (var i = 0; i < LAYERS.length; i++) {
      var layer = LAYERS[i];
      preset[layer.id] = normalizeName(raw[layer.id]);
      if (raw.shows && has(raw.shows, layer.showKey)) preset.shows[layer.showKey] = raw.shows[layer.showKey] !== false;
      else if (has(raw, "show" + capKey(layer.id))) preset.shows[layer.showKey] = raw["show" + capKey(layer.id)] !== false;
      else preset.shows[layer.showKey] = true;
    }
    return preset;
  }

  function exportDeco(vars) {
    vars = getVars(vars);
    if (!vars) return null;
    var out = {
      maplelanternDeco: 1,
      version: typeof VERSION === "string" ? VERSION : "",
      exportedAt: Date.now(),
      layers: {},
      shows: {},
      imageZ: cloneObject(vars.decoImageZ),
      imagePath: cloneObject(vars.decoImagePath),
      auto: {
        bg: vars.decoAutoBgEnabled === true,
        fg: vars.decoAutoFgEnabled === true,
        bgList: sanitizeLocations(vars.decoAutoBgLocations),
        fgList: sanitizeLocations(vars.decoAutoFgLocations),
        bgOff: sanitizeLocations(vars.decoAutoBgDisabled),
        fgOff: sanitizeLocations(vars.decoAutoFgDisabled)
      },
      presets: {}
    };
    for (var i = 0; i < LAYERS.length; i++) {
      var layer = LAYERS[i];
      out.layers[layer.varKey] = normalizeName(vars[layer.varKey]);
      out.shows[layer.showKey] = layerVisible(layer, vars);
    }
    Object.keys(vars.decoPresets || {}).forEach(function (slot) {
      var n = Number(slot);
      if (!isFinite(n) || n <= 0 || n > 99) return;
      var preset = sanitizePreset(vars.decoPresets[slot]);
      if (preset) out.presets[String(Math.round(n))] = preset;
    });
    return out;
  }

  function importDeco(vars, raw) {
    vars = getVars(vars);
    if (!vars) return { ok: false, reason: "no-vars" };
    if (!raw || typeof raw !== "object") return { ok: false, reason: "bad-data" };
    if (Number(raw.maplelanternDeco) !== 1) return { ok: false, reason: "bad-format" };
    /* 导入等同玩家显式选择：先撤自动接管，避免下一帧被自动地点覆盖。 */
    if (vars.decoAutoBgActive === true) restoreAutoBackground(vars);
    if (vars.decoAutoFgActive === true) restoreAutoForeground(vars);
    var applied = 0;
    if (raw.layers && typeof raw.layers === "object") {
      for (var i = 0; i < LAYERS.length; i++) {
        var layer = LAYERS[i];
        if (typeof raw.layers[layer.varKey] === "string") {
          vars[layer.varKey] = normalizeName(raw.layers[layer.varKey]);
          applied++;
        }
        if (raw.shows && has(raw.shows, layer.showKey)) {
          vars[layer.showKey] = raw.shows[layer.showKey] !== false;
        }
      }
    }
    if (raw.imageZ) vars.decoImageZ = sanitizeZMap(raw.imageZ);
    if (raw.imagePath) vars.decoImagePath = sanitizeImageMap(raw.imagePath);
    if (raw.auto && typeof raw.auto === "object") {
      vars.decoAutoBgEnabled = raw.auto.bg === true;
      vars.decoAutoFgEnabled = raw.auto.fg === true;
      if (Array.isArray(raw.auto.bgList)) vars.decoAutoBgLocations = sanitizeLocations(raw.auto.bgList);
      if (Array.isArray(raw.auto.fgList)) vars.decoAutoFgLocations = sanitizeLocations(raw.auto.fgList);
      if (Array.isArray(raw.auto.bgOff)) vars.decoAutoBgDisabled = sanitizeLocations(raw.auto.bgOff);
      if (Array.isArray(raw.auto.fgOff)) vars.decoAutoFgDisabled = sanitizeLocations(raw.auto.fgOff);
    }
    var count = 0;
    if (raw.presets && typeof raw.presets === "object") {
      if (!vars.decoPresets || typeof vars.decoPresets !== "object") vars.decoPresets = {};
      Object.keys(raw.presets).forEach(function (slot) {
        var n = Number(slot);
        if (!isFinite(n) || n <= 0 || n > 99) return;
        var preset = sanitizePreset(raw.presets[slot]);
        if (!preset) return;
        if (!preset.name) preset.name = "预设 " + Math.round(n);
        vars.decoPresets[String(Math.round(n))] = preset;
        count++;
      });
    }
    return { ok: true, applied: applied, presets: count };
  }

  function computeOverlay(env) {
    env = env || {};
    var vars = getVars(env.vars) || {};
    var setup = getSetup(env.setup) || {};
    var weather = env.Weather || safe(function () { return root.Weather; }, null) || {};
    if (vars.decoAutoBgFilterEnabled !== true) return {};
    var info = locationInfo(vars, setup, env.passage);
    if (!info.outside) return {};
    var layerIds = env.filterLayers || vars.decoFilterLayers || ["background1", "background2", "background3", "background4"];
    var result = {};
    var baseBrightness = 0;
    if (weather.skyState === "night") baseBrightness -= 0.2;
    if (weather.name === "lightClouds") baseBrightness += -0.05;
    else if (weather.name === "heavyClouds") baseBrightness += -0.2;
    else if (weather.name === "lightPrecipitation") baseBrightness += -0.2;
    else if (weather.name === "heavyPrecipitation" || weather.name === "thunderStorm") baseBrightness += -0.5;
    var h = 0, s = 0, l = 100, alpha = 1;
    var badWeather = ["heavyPrecipitation", "thunderStorm"];
    if (weather.bloodMoon) {
      h = 0; s = 80; l = 50; alpha = 0.6;
    } else if (weather.skyState === "night") {
      h = 210; s = 70; l = 15; alpha = 0.6;
    } else if (weather.skyState === "dusk") {
      if (badWeather.indexOf(weather.name) >= 0) { h = 0; s = 0; l = 65; alpha = 0.6; }
      else { h = 30; s = 80; l = 65; alpha = 0.6; }
    } else if (weather.skyState === "dawn") {
      if (badWeather.indexOf(weather.name) >= 0) { h = 0; s = 0; l = 65; alpha = 0.6; }
      else { h = 210; s = 60; l = 75; alpha = 0.6; }
    }
    for (var i = 0; i < layerIds.length; i++) {
      var layer = layerById(layerIds[i]);
      if (!layer || layer.kind !== "background") continue;
      var name = normalizeName(vars[layer.varKey]);
      if (name === "none") continue;
      result["decoration_" + layer.id] = {
        color: "hsl(" + h + ", " + s + "%, " + l + "%)",
        alpha: alpha,
        brightness: baseBrightness
      };
    }
    return result;
  }

  function overlayKey(value) {
    try { return JSON.stringify(value || {}); } catch (e) { return String(value); }
  }

  /* 自动背景第一次接管前，把玩家原本的背景与显示状态存进存档变量；
     之后重复匹配不再覆盖备份。关闭自动或地点不在白名单时按备份恢复。 */
  function backupPlayerBackground(vars) {
    vars = getVars(vars);
    if (!vars || vars.decoAutoBgActive === true) return false;
    vars.decoAutoBgBackup = has(vars, "background_image1") ? vars.background_image1 : "none";
    vars.decoAutoBgBackupShow = has(vars, "show_background1") ? vars.show_background1 !== false : true;
    vars.decoAutoBgActive = true;
    return true;
  }

  function restoreAutoBackground(vars) {
    vars = getVars(vars);
    if (!vars) return false;
    var active = vars.decoAutoBgActive === true;
    if (active) {
      vars.background_image1 = has(vars, "decoAutoBgBackup") ? vars.decoAutoBgBackup : "none";
      vars.show_background1 = has(vars, "decoAutoBgBackupShow") ? vars.decoAutoBgBackupShow !== false : true;
      delete vars.decoAutoBgBackup;
      delete vars.decoAutoBgBackupShow;
    }
    vars.decoAutoBgActive = false;
    delete vars.decoAutoBgSource;
    return active;
  }

  function applyAutoBackground(vars, setup, catalog, force, passage) {
    vars = getVars(vars) || {};
    setup = getSetup(setup) || {};
    if (vars.decoAutoBgEnabled !== true && !force) {
      if (vars.decoAutoBgActive === true) restoreAutoBackground(vars);
      return "none";
    }
    var info = locationInfo(vars, setup, passage);
    var found = pickAutoLocation(info, catalog || CATALOG, vars.decoAutoBgLocations, null, vars.decoAutoBgExcluded);
    if (found === "none") {
      if (vars.decoAutoBgActive === true) restoreAutoBackground(vars);
      return "none";
    }
    backupPlayerBackground(vars);
    vars.background_image1 = found;
    vars.show_background1 = true;
    vars.decoAutoBgSource = found;
    return found;
  }

  /* 自动前景只接管 foreground1；foreground2–5 留给玩家做叠加。
     地点白名单、排除名单、地点链与自动背景共用。 */
  function backupPlayerForeground(vars) {
    vars = getVars(vars);
    if (!vars || vars.decoAutoFgActive === true) return false;
    vars.decoAutoFgBackup = has(vars, "foreground_image1") ? vars.foreground_image1 : "none";
    vars.decoAutoFgBackupShow = has(vars, "show_foreground1") ? vars.show_foreground1 !== false : true;
    vars.decoAutoFgActive = true;
    return true;
  }

  function restoreAutoForeground(vars) {
    vars = getVars(vars);
    if (!vars) return false;
    var active = vars.decoAutoFgActive === true;
    if (active) {
      vars.foreground_image1 = has(vars, "decoAutoFgBackup") ? vars.decoAutoFgBackup : "none";
      vars.show_foreground1 = has(vars, "decoAutoFgBackupShow") ? vars.decoAutoFgBackupShow !== false : true;
      delete vars.decoAutoFgBackup;
      delete vars.decoAutoFgBackupShow;
    }
    vars.decoAutoFgActive = false;
    delete vars.decoAutoFgSource;
    return active;
  }

  function applyAutoForeground(vars, setup, catalog, force, passage) {
    vars = getVars(vars) || {};
    setup = getSetup(setup) || {};
    if (vars.decoAutoFgEnabled !== true && !force) {
      if (vars.decoAutoFgActive === true) restoreAutoForeground(vars);
      return "none";
    }
    var info = locationInfo(vars, setup, passage);
    var found = pickAutoLocation(info, catalog || CATALOG, vars.decoAutoBgLocations, null, vars.decoAutoBgExcluded);
    if (found === "none") {
      if (vars.decoAutoFgActive === true) restoreAutoForeground(vars);
      return "none";
    }
    backupPlayerForeground(vars);
    vars.foreground_image1 = found;
    vars.show_foreground1 = true;
    vars.decoAutoFgSource = found;
    return found;
  }

  /* 只在 passageend 或玩家显式“匹配当前地点”时调用；页面重绘、显示开关、
     Z 序和滤镜操作不得触发这里。 */
  function applyAutoOnPassage(env) {
    env = env || {};
    if (state.mode === MODE.external) return "external";
    var vars = getVars(env.vars) || {};
    var bgOn = vars.decoAutoBgEnabled === true;
    var fgOn = vars.decoAutoFgEnabled === true;
    if (!bgOn && !fgOn) {
      if (vars.decoAutoBgActive === true) restoreAutoBackground(vars);
      else delete vars.decoAutoBgSource;
      if (vars.decoAutoFgActive === true) restoreAutoForeground(vars);
      else delete vars.decoAutoFgSource;
      return "none";
    }
    ensureAutoLocation(vars, env.setup, env.catalog || CATALOG, env.passage);
    var bg = "none";
    var fg = "none";
    if (bgOn) bg = applyAutoBackground(vars, env.setup, env.catalog || CATALOG, false, env.passage);
    else if (vars.decoAutoBgActive === true) restoreAutoBackground(vars);
    else delete vars.decoAutoBgSource;
    if (fgOn) fg = applyAutoForeground(vars, env.setup, env.catalog || CATALOG, false, env.passage);
    else if (vars.decoAutoFgActive === true) restoreAutoForeground(vars);
    else delete vars.decoAutoFgSource;
    return bg !== "none" ? bg : fg;
  }

  function collectLayers(RendererArg) {
    var Renderer = RendererArg || safe(function () { return root.Renderer; }, null);
    var out = {};
    if (!Renderer || !Renderer.CanvasModels || !Renderer.CanvasModels.main) return out;
    var template = Renderer.CanvasModels.main;
    if (template.layers) {
      for (var key in template.layers) if (has(template.layers, key)) out[key] = template.layers[key];
    }
    var cache = Renderer.CanvasModelCaches && Renderer.CanvasModelCaches.main;
    if (cache) {
      Object.keys(cache).forEach(function (slot) {
        var model = cache[slot];
        if (!model || !model.layers) return;
        for (var name in model.layers) if (has(model.layers, name)) out[name] = model.layers[name];
      });
    }
    return out;
  }

  /* CanvasModel.compile 只在 layer.show 为 false 时才重新求值 showfn；
     显示开关是动态变量，重绘前必须把灯台层复位成 false，否则关掉后仍会画。 */
  function resetOwnShow(Renderer) {
    if (!Renderer) return 0;
    var models = [];
    if (Renderer.CanvasModels) {
      models.push(Renderer.CanvasModels.main);
      models.push(Renderer.CanvasModels.pet);
    }
    var cache = Renderer.CanvasModelCaches;
    if (cache) Object.keys(cache).forEach(function (modelName) {
      var slots = cache[modelName];
      if (slots) Object.keys(slots).forEach(function (slot) { models.push(slots[slot]); });
    });
    var changed = 0;
    models.forEach(function (model) {
      if (!model || !model.layers) return;
      Object.keys(model.layers).forEach(function (name) {
        var layer = model.layers[name];
        if (name.indexOf("decoration_") !== 0 || !layer || !layer.__mlDeco) return;
        if (layer.show !== false) { layer.show = false; changed++; }
      });
    });
    return changed;
  }

  function redraw() {
    var Renderer = safe(function () { return root.Renderer; }, null);
    if (Renderer) {
      resetOwnShow(Renderer);
      /* composeLayersAgain 复用上一次的 layerSpecs；如果九层是在上次渲染之后
         才接进 model，旧 specs 里没有它们，只重排不会把新层画出来。
         优先对当前 main 模型 redraw()（会重新 compile + compose）。 */
      var model = Renderer.lastModel;
      if (!(model && model.name === "main" && model.canvas && typeof model.redraw === "function")) {
        var cache = Renderer.CanvasModelCaches && Renderer.CanvasModelCaches.main;
        model = null;
        if (cache) Object.keys(cache).forEach(function (slot) {
          var m = cache[slot];
          if (!model && m && m.name === "main" && m.canvas) model = m;
        });
      }
      if (model && typeof model.redraw === "function") {
        safe(function () { model.redraw(); }, null);
      } else if (typeof Renderer.composeLayersAgain === "function") {
        safe(function () { Renderer.composeLayersAgain(); }, null);
      }
    }
    var Wikifier = safe(function () { return root.Wikifier; }, null);
    if (Wikifier && typeof Wikifier.wikifyEval === "function") {
      safe(function () { Wikifier.wikifyEval("<<updatesidebarimg true>>"); }, null);
    }
  }

  function refresh(env) {
    env = env || {};
    var vars = getVars(env.vars) || {};
    var setup = getSetup(env.setup) || {};
    if (state.mode === MODE.native) {
      var overlay = computeOverlay({ vars: vars, setup: setup, Weather: env.Weather || safe(function () { return root.Weather; }, null), filterLayers: env.filterLayers || vars.decoFilterLayers });
      applyOverlay(collectLayers(), overlay);
    }
    redraw();
    return { mode: state.mode, auto: vars.decoAutoBgSource || vars.decoAutoFgSource || "none" };
  }

  function applyOverlay(layers, overlay) {
    if (!layers || typeof layers !== "object") return 0;
    overlay = overlay || {};
    var changed = 0;
    var keys = Object.keys(layers);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      if (key.indexOf("decoration_") !== 0) continue;
      var layer = layers[key];
      if (!layer) continue;
      var next = overlay[key] || null;
      var prev = layer.decoColorOverlay || null;
      var nextBrightness = next && typeof next.brightness === "number" ? next.brightness : 0;
      if (overlayKey(prev) === overlayKey(next) && (layer.brightness || 0) === nextBrightness) continue;
      layer.decoColorOverlay = next;
      layer.brightness = nextBrightness;
      if (layer.defaultOptions && typeof layer.defaultOptions === "object") {
        layer.defaultOptions.brightness = nextBrightness;
      }
      layer.cachedProcessing = null;
      changed++;
    }
    return changed;
  }

  function makeLayerDef(layer) {
    return {
      name: "decoration_" + layer.id,
      __mlDeco: true,
      animation: "idle",
      srcfn: function () {
        var vars = getVars();
        if (!vars) return undefined;
        return normalizeName(vars[layer.varKey]) === "none" ? undefined : imagePath(layer, vars);
      },
      showfn: function () {
        var vars = getVars();
        return vars ? layerVisible(layer, vars) : true;
      },
      zfn: function () {
        var vars = getVars();
        return vars ? layerZ(layer, vars) : layer.baseZ;
      }
    };
  }

  function cloneLayer(def) {
    var out = {};
    for (var key in def) if (Object.prototype.hasOwnProperty.call(def, key)) out[key] = def[key];
    out.show = false;
    out.brightness = 0;
    out.contrast = 1;
    out.blend = "";
    out.blendMode = "";
    out.maskBlendMode = "destination-in";
    out.alpha = 1;
    out.desaturate = false;
    out.defaultOptions = {};
    for (var k in out) if (Object.prototype.hasOwnProperty.call(out, k) && k !== "defaultOptions") out.defaultOptions[k] = out[k];
    return out;
  }

  function externalInLayerMap(layers) {
    if (!layers || typeof layers !== "object") return false;
    for (var i = 0; i < LAYERS.length; i++) {
      var key = "decoration_" + LAYERS[i].id;
      if (!has(layers, key)) continue;
      var layer = layers[key];
      if (layer && !layer.__mlDeco) return true;
    }
    return false;
  }

  /* 只看“已经接到渲染模型上”的原模组图层。maplebirch.char.use() 的声明本身
     不代表会绘制：在 5.6.2 上原模组常常只把 9 层收进 char.layers，main/pet
     仍为空。若仅凭 char.layers 就让位，灯台会误判成 external，结果是两套都
     不画。故 char.layers 只作为“已安装”的线索，判定必须落到实际模型。 */
  function externalInCanvasModels(Renderer) {
    var models = Renderer && Renderer.CanvasModels;
    if (!models || typeof models !== "object") return false;
    var keys = Object.keys(models);
    for (var i = 0; i < keys.length; i++) {
      var model = models[keys[i]];
      if (externalInLayerMap(model && model.layers)) return true;
    }
    return false;
  }

  function externalInCaches(Renderer) {
    var caches = Renderer && Renderer.CanvasModelCaches;
    if (!caches || typeof caches !== "object") return false;
    var cacheKeys = Object.keys(caches);
    for (var i = 0; i < cacheKeys.length; i++) {
      var slots = caches[cacheKeys[i]];
      if (!slots || typeof slots !== "object") continue;
      var slotKeys = Object.keys(slots);
      for (var j = 0; j < slotKeys.length; j++) {
        var model = slots[slotKeys[j]];
        if (externalInLayerMap(model && model.layers)) return true;
      }
    }
    return false;
  }

  function detectExternal(Renderer) {
    if (!Renderer || !Renderer.CanvasModels) return false;
    if (externalInCanvasModels(Renderer)) return true;
    return externalInCaches(Renderer);
  }

  function scrubOwnModel(model) {
    if (!model || !model.layers || typeof model.layers !== "object") return 0;
    var removed = 0;
    var keys = Object.keys(model.layers);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var layer = model.layers[key];
      if (key.indexOf("decoration_") !== 0 || !layer || !layer.__mlDeco) continue;
      try {
        delete model.layers[key];
        if (!has(model.layers, key)) removed++;
      } catch (e) { /* 冻结图层表不强行删除 */ }
    }
    if (removed && Array.isArray(model.layerList)) {
      model.layerList = Object.keys(model.layers).map(function (name) { return model.layers[name]; });
    }
    return removed;
  }

  /* 原模组在灯台之后才完成 char.use() 时，早先注册的 __mlDeco 层必须撤回，
     否则 main 与 maplebirch 两套九层同时绘制。 */
  function removeOwnLayers(Renderer) {
    var removed = 0;
    if (Renderer && Renderer.CanvasModels) {
      removed += scrubOwnModel(Renderer.CanvasModels.main);
      removed += scrubOwnModel(Renderer.CanvasModels.pet);
    }
    var cache = Renderer && Renderer.CanvasModelCaches && Renderer.CanvasModelCaches.main;
    if (cache) Object.keys(cache).forEach(function (slot) { removed += scrubOwnModel(cache[slot]); });
    if (state.overlayStep) {
      var pipeline = Renderer && Renderer.RenderingPipeline;
      if (Array.isArray(pipeline)) {
        for (var i = pipeline.length - 1; i >= 0; i--) {
          if (pipeline[i] === state.overlayStep) pipeline.splice(i, 1);
        }
      }
      state.overlayStep = null;
    }
    state.registered = false;
    return removed;
  }

  function registerLayers(RendererArg) {
    var Renderer = RendererArg || safe(function () { return root.Renderer; }, null);
    if (!Renderer || !Renderer.CanvasModels || !Renderer.CanvasModels.main) {
      state.mode = MODE.unavailable;
      return { mode: MODE.unavailable, added: 0 };
    }
    if (detectExternal(Renderer)) {
      removeOwnLayers(Renderer);
      state.mode = MODE.external;
      state.registered = false;
      return { mode: MODE.external, added: 0 };
    }
    var template = Renderer.CanvasModels.main;
    if (!template.layers || typeof template.layers !== "object") template.layers = {};
    var defs = {};
    var added = 0;
    for (var i = 0; i < LAYERS.length; i++) {
      var def = makeLayerDef(LAYERS[i]);
      defs[def.name] = def;
      /* 同一个 mod id 被旧版本先注册时，旧 def（可能还是 undefined.png / 旧目录）
         会留在配置里；更新后必须整体替换，不能因为同名就跳过。 */
      if (!has(template.layers, def.name)) added++;
      template.layers[def.name] = def;
    }
    var cache = Renderer.CanvasModelCaches && Renderer.CanvasModelCaches.main;
    if (cache) {
      Object.keys(cache).forEach(function (slot) {
        var model = cache[slot];
        if (!model || !model.layers) return;
        for (var name in defs) {
          var cloned = cloneLayer(defs[name]);
          cloned.name = name;
          model.layers[name] = cloned;
        }
        model.layerList = Object.keys(model.layers).map(function (n) { return model.layers[n]; });
      });
    }
    state.mode = MODE.native;
    state.registered = true;
    return { mode: MODE.native, added: added };
  }

  function ensureOverlayStep(RendererArg) {
    var Renderer = RendererArg || safe(function () { return root.Renderer; }, null);
    if (!Renderer) return null;
    var pipeline = Renderer.RenderingPipeline;
    if (!Array.isArray(pipeline)) return null;
    /* 原模组 5.12 的 decoOverlay 读 State.variables.decoColorOverlay，
       灯台的 mlDecoOverlay 读 layer.decoColorOverlay；两套同时存在会双重叠色。
       原生模式下只保留灯台这一套。 */
    for (var j = pipeline.length - 1; j >= 0; j--) {
      if (pipeline[j] && pipeline[j].name === "decoOverlay") pipeline.splice(j, 1);
    }
    if (state.overlayStep) return state.overlayStep;
    for (var i = 0; i < pipeline.length; i++) {
      if (pipeline[i] && pipeline[i].name === "mlDecoOverlay") {
        state.overlayStep = pipeline[i];
        return state.overlayStep;
      }
    }
    var step = {
      name: "mlDecoOverlay",
      condition: function (layer) {
        return !!(layer && layer.decoColorOverlay && Number(layer.decoColorOverlay.alpha) > 0);
      },
      render: function (image, layer) {
        var overlay = layer.decoColorOverlay;
        if (!overlay || !image) return image;
        try {
          var width = image.width;
          var height = image.height;
          var tint = Renderer.createCanvas(width, height);
          tint.fillStyle = overlay.color || "#fff";
          tint.fillRect(0, 0, width, height);
          var out = Renderer.createCanvas(width, height);
          out.drawImage(image, 0, 0);
          out.globalCompositeOperation = "multiply";
          out.globalAlpha = Math.max(0, Math.min(1, Number(overlay.alpha) || 0));
          out.drawImage(tint.canvas, 0, 0);
          out.globalAlpha = 1;
          out.globalCompositeOperation = "source-over";
          return out.canvas;
        } catch (e) {
          return image;
        }
      }
    };
    pipeline.push(step);
    state.overlayStep = step;
    return step;
  }

  function mode() {
    return state.mode;
  }

  return Object.freeze({
    VERSION: "1.5.12",
    LAYERS: LAYERS,
    CATALOG: CATALOG,
    LIBRARY_DIR: LIBRARY_DIR,
    FOREGROUND_DIR: FOREGROUND_DIR,
    MODE: MODE,
    Z_BASE: { deco_bg1: -30, deco_bg2: -25, deco_bg3: -20, deco_bg4: -15, deco_fg1: 300, deco_fg2: 305, deco_fg3: 310, deco_fg4: 315, deco_fg5: 320 },
    normalizeName: normalizeName,
    folderDir: folderDir,
    layerFolder: layerFolder,
    libraryPath: libraryPath,
    imagePath: imagePath,
    layerVisible: layerVisible,
    layerZ: layerZ,
    locationInfo: locationInfo,
    pickAutoLocation: pickAutoLocation,
    ensureAutoLocation: ensureAutoLocation,
    savePreset: savePreset,
    applyPreset: applyPreset,
    deletePreset: deletePreset,
    nextPresetSlot: nextPresetSlot,
    decoRecent: decoRecent,
    decoRemember: decoRemember,
    exportDeco: exportDeco,
    importDeco: importDeco,
    computeOverlay: computeOverlay,
    applyOverlay: applyOverlay,
    applyAutoBackground: applyAutoBackground,
    applyAutoForeground: applyAutoForeground,
    applyAutoOnPassage: applyAutoOnPassage,
    backupPlayerBackground: backupPlayerBackground,
    backupPlayerForeground: backupPlayerForeground,
    restoreAutoBackground: restoreAutoBackground,
    restoreAutoForeground: restoreAutoForeground,
    collectLayers: collectLayers,
    redraw: redraw,
    refresh: refresh,
    registerLayers: registerLayers,
    ensureOverlayStep: ensureOverlayStep,
    detectMode: function () { return state.mode; },
    mode: mode
  });
});
