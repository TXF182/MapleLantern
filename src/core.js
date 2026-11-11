/* ============================================================================
 * 灯台 · MapleLantern — core.js
 * 纯逻辑层：不做 DOM、不读全局、不写状态。可被浏览器（window.MapleLanternCore）
 * 与 node 测试（module.exports）同时加载。
 * 纪律：所有对外读取都是防御式的；任何异常都返回 null，不抛给游戏。
 * ========================================================================== */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) { module.exports = api; }
  if (root) { root.MapleLanternCore = api; }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var VERSION = "1.1.2";
  var STORAGE_KEY = "MapleLantern.settings.v1";
  var TAB_KEYS = ["now", "vitals", "worn", "system", "settings"];
  var THEMES = ["auto", "amber", "jade", "graphite", "star"];
  var DENSITIES = ["cozy", "compact"];
  var LANGS = ["auto", "zh", "en"];

  /* 服饰槽位：只展示服饰层，明确排除 butt_plug / genitals（成人内容最小化）。 */
  var WORN_SLOTS = [
    "over_head", "head", "face", "neck",
    "over_upper", "upper", "under_upper", "hands", "handheld",
    "over_lower", "lower", "under_lower", "legs", "feet"
  ];

  /* 主题色板：用于对比度计算与「非 auto」时的字面色。 */
  var PALETTES = {
    amber: {
      bg: "#0B0D10", bgSoft: "#12151A", bgRaise: "#1A1E25",
      text: "#E9E3D6", muted: "#9A9388", faint: "#6E685F",
      accent: "#E3B25F", accentInk: "#1A1206", line: "rgba(255,255,255,.09)",
      jade: "#5FBFAC", rose: "#D2737B", danger: "#C65449"
    },
    jade: {
      bg: "#0A1110", bgSoft: "#111A18", bgRaise: "#182421",
      text: "#E6EEE9", muted: "#93A79F", faint: "#667B72",
      accent: "#5FBFAC", accentInk: "#06130F", line: "rgba(255,255,255,.09)",
      jade: "#7FD6C5", rose: "#D2737B", danger: "#C65449"
    },
    graphite: {
      bg: "#0C0D0F", bgSoft: "#15171B", bgRaise: "#1D2026",
      text: "#E7E8EA", muted: "#9A9DA4", faint: "#6B6E75",
      accent: "#C9CDD4", accentInk: "#101216", line: "rgba(255,255,255,.10)",
      jade: "#8FD3C4", rose: "#CE7C84", danger: "#C65449"
    },
    star: {
      bg: "#070A14", bgSoft: "#0D1222", bgRaise: "#151B31",
      text: "#E5EAF8", muted: "#909BBA", faint: "#626E8E",
      accent: "#8FA6FF", accentInk: "#080C1A", line: "rgba(143,166,255,.14)",
      jade: "#6FE0D2", rose: "#D98CCB", danger: "#E06B6B"
    }
  };

  var STRINGS = {
    zh: {
      "app.name": "灯台", "app.sub": "LANTERN", "app.readonly": "只读 · 不写入存档",
      "orb.label": "灯台：{date} {clock}，点击打开",
      "tab.now": "此刻", "tab.vitals": "身心", "tab.worn": "着装",
      "tab.system": "系统", "tab.settings": "设置",
      "now.progress": "今日已过", "now.money": "金钱", "now.scene": "场景", "now.phase": "时段",
      "now.quick": "身心速览",
      "now.clockHint": "本地日程", "now.noTime": "读不到时间",
      "phase.night": "深夜", "phase.dawn": "清晨", "phase.day": "白昼", "phase.dusk": "黄昏",
      "phase.unknown": "未知",
      "vital.willpower": "意志", "vital.stress": "压力", "vital.trauma": "创伤",
      "vital.arousal": "兴奋", "vital.tiredness": "疲惫",
      "vital.missing": "本存档缺少 {n} 项可读字段",
      "vital.none": "读不到状态字段，面板只保留时间与场景",
      "worn.title": "着装", "worn.count": "已记录 {n} / {total} 个槽位",
      "worn.empty": "无", "worn.note": "服饰名保留游戏内原值，不做二次翻译",
      "system.title": "系统", "system.copy": "复制诊断", "system.copied": "已复制到剪贴板",
      "system.copyFail": "复制失败，请手动选择文本",
      "sys.version": "模组版本", "sys.game": "游戏版本", "sys.host": "主 UI",
      "sys.layout": "视口", "sys.storage": "设置存储", "sys.motion": "动效",
      "sys.mode": "外观来源", "sys.sugar": "SugarCube",
      "host.none": "独立外观", "host.on": "已连接 v{ver}",
      "storage.ok": "可用", "storage.no": "不可用（本次生效）",
      "motion.system": "跟随系统", "motion.off": "已关闭",
      "mode.auto": "自动 / 跟随宿主", "mode.manual": "手动主题",
      "settings.title": "设置", "settings.theme": "主题", "settings.scale": "字号",
      "settings.glass": "通透度", "settings.density": "密度", "settings.motion": "动效", "settings.lang": "语言",
      "settings.position": "悬浮球位置",
      "settings.native": "原生卡片",
      "settings.panel": "悬浮灯台",
      "settings.nativeHint": "把原版侧栏、状态、正文选项和弹层统一换成卡片；关闭后恢复原版外观",
      "settings.panelHint": "关闭后不常驻悬浮球；仍可从选项里的「灯台」入口打开",
      "settings.glassHint": "0 更沉稳 / 100 更通透；只改表面与模糊，不改文字和按钮",
      "settings.motionHint": "关闭后不播任何过渡与动画，操作仍完整",
      "native.entry": "灯台",
      "native.entryHint": "打开灯台面板",
      "theme.auto": "自动", "theme.amber": "琥珀", "theme.jade": "青瓷", "theme.graphite": "石墨",
      "theme.star": "星空",
      "density.cozy": "舒适", "density.compact": "紧凑",
      "lang.auto": "自动", "lang.zh": "中文", "lang.en": "English",
      "pos.left": "左下", "pos.right": "右下",
      "reset.scale": "字号回 100%", "reset.glass": "通透度回 60", "reset.density": "密度回舒适",
      "reset.theme": "主题回自动", "reset.pos": "复位位置",
      "misc.close": "关闭", "misc.untitled": "未知场景", "misc.degraded": "读取降级",
      "toast.storage": "设置只在本次生效（存储不可用）",
      "toast.repaired": "检测到旧设置，已逐项修复",
      "a11y.panel": "灯台信息面板"
    },
    en: {
      "app.name": "Lantern", "app.sub": "MAPLELANTERN", "app.readonly": "Read-only · never writes saves",
      "orb.label": "Lantern: {date} {clock}, click to open",
      "tab.now": "Now", "tab.vitals": "Vitals", "tab.worn": "Worn",
      "tab.system": "System", "tab.settings": "Settings",
      "now.progress": "Day elapsed", "now.money": "Money", "now.scene": "Scene", "now.phase": "Phase",
      "now.quick": "Vitals",
      "now.clockHint": "Local schedule", "now.noTime": "Time unavailable",
      "phase.night": "Night", "phase.dawn": "Dawn", "phase.day": "Day", "phase.dusk": "Dusk",
      "phase.unknown": "Unknown",
      "vital.willpower": "Willpower", "vital.stress": "Stress", "vital.trauma": "Trauma",
      "vital.arousal": "Arousal", "vital.tiredness": "Tiredness",
      "vital.missing": "{n} readable field(s) missing",
      "vital.none": "No state fields readable; only time and scene are shown",
      "worn.title": "Worn", "worn.count": "{n} / {total} slots recorded",
      "worn.empty": "None", "worn.note": "Item names stay in the game's original wording",
      "system.title": "System", "system.copy": "Copy diagnostics", "system.copied": "Copied to clipboard",
      "system.copyFail": "Copy failed; select the text manually",
      "sys.version": "Mod version", "sys.game": "Game version", "sys.host": "Main UI",
      "sys.layout": "Viewport", "sys.storage": "Settings storage", "sys.motion": "Motion",
      "sys.mode": "Appearance source", "sys.sugar": "SugarCube",
      "host.none": "Standalone look", "host.on": "Connected v{ver}",
      "storage.ok": "Available", "storage.no": "Unavailable (session only)",
      "motion.system": "Follow system", "motion.off": "Off",
      "mode.auto": "Auto / follow host", "mode.manual": "Manual theme",
      "settings.title": "Settings", "settings.theme": "Theme", "settings.scale": "Text size",
      "settings.glass": "Clarity", "settings.density": "Density", "settings.motion": "Motion", "settings.lang": "Language",
      "settings.position": "Orb position",
      "settings.native": "Native cards",
      "settings.panel": "Floating Lantern",
      "settings.nativeHint": "Cards for the vanilla sidebar, status, passage options and overlays; off restores the original look",
      "settings.panelHint": "When off, no persistent orb; open it from the Lantern entry in Options",
      "settings.glassHint": "0 calmer / 100 clearer; surface and blur only, text and buttons unchanged",
      "settings.motionHint": "When off, no transitions play; every action still works",
      "native.entry": "Lantern",
      "native.entryHint": "Open the Lantern panel",
      "theme.auto": "Auto", "theme.amber": "Amber", "theme.jade": "Jade", "theme.graphite": "Graphite",
      "theme.star": "Starfield",
      "density.cozy": "Cozy", "density.compact": "Compact",
      "lang.auto": "Auto", "lang.zh": "中文", "lang.en": "English",
      "pos.left": "Bottom left", "pos.right": "Bottom right",
      "reset.scale": "Text back to 100%", "reset.glass": "Clarity back to 60", "reset.density": "Density back to cozy",
      "reset.theme": "Theme back to auto", "reset.pos": "Reset position",
      "misc.close": "Close", "misc.untitled": "Unknown scene", "misc.degraded": "Degraded",
      "toast.storage": "Settings apply to this session only (storage unavailable)",
      "toast.repaired": "Older settings found and repaired field by field",
      "a11y.panel": "Lantern information panel"
    }
  };

  var SLOT_LABELS = {
    zh: {
      over_head: "头饰", head: "头部", face: "面部", neck: "颈部",
      over_upper: "外套", upper: "上衣", under_upper: "内搭",
      hands: "手部", handheld: "手持",
      over_lower: "外下装", lower: "下装", under_lower: "内下装",
      legs: "腿部", feet: "足部"
    },
    en: {
      over_head: "Over head", head: "Head", face: "Face", neck: "Neck",
      over_upper: "Outer top", upper: "Top", under_upper: "Under top",
      hands: "Hands", handheld: "Held",
      over_lower: "Outer bottom", lower: "Bottom", under_lower: "Under bottom",
      legs: "Legs", feet: "Feet"
    }
  };

  var DEFAULTS = Object.freeze({
    v: 1,
    theme: "auto",
    scale: 100,
    glass: 60,
    density: "cozy",
    motion: true,
    lang: "auto",
    tab: "now",
    side: "right",
    y: 0.78,
    seen: false,
    native: true,
    panel: false
  });

  function isObj(x) { return !!x && typeof x === "object"; }
  function num(x) { return (typeof x === "number" && isFinite(x)) ? x : null; }
  function str(x) { return (typeof x === "string" && x !== "") ? x : null; }
  function clamp(n, lo, hi) { return n < lo ? lo : (n > hi ? hi : n); }
  function oneOf(value, list, fallback) { return list.indexOf(value) >= 0 ? value : fallback; }

  /* 设置修复：逐字段，不整包丢弃；返回 repaired 供诊断与一次性提示。 */
  function sanitizeSettings(raw) {
    var out = {
      v: 1, theme: DEFAULTS.theme, scale: DEFAULTS.scale, glass: DEFAULTS.glass,
      density: DEFAULTS.density,
      motion: DEFAULTS.motion, lang: DEFAULTS.lang, tab: DEFAULTS.tab,
      side: DEFAULTS.side, y: DEFAULTS.y, seen: DEFAULTS.seen,
      native: DEFAULTS.native, panel: DEFAULTS.panel
    };
    var repaired = false;
    if (!isObj(raw)) { return { value: out, repaired: true, migrated: false, empty: true }; }

    if (raw.theme !== undefined) {
      if (THEMES.indexOf(raw.theme) >= 0) { out.theme = raw.theme; } else { repaired = true; }
    }
    if (raw.scale !== undefined) {
      var s = num(raw.scale);
      if (s === null) { repaired = true; }
      else {
        var snapped = Math.round(clamp(s, 80, 140) / 5) * 5;
        if (snapped !== s) { repaired = true; }
        out.scale = snapped;
      }
    }
    if (raw.glass !== undefined) {
      var gl = num(raw.glass);
      if (gl === null) { repaired = true; }
      else {
        var gs = Math.round(clamp(gl, 0, 100) / 5) * 5;
        if (gs !== gl) { repaired = true; }
        out.glass = gs;
      }
    }
    if (raw.density !== undefined) {
      if (DENSITIES.indexOf(raw.density) >= 0) { out.density = raw.density; } else { repaired = true; }
    }
    if (raw.motion !== undefined) {
      out.motion = raw.motion !== false;
      if (typeof raw.motion !== "boolean") { repaired = true; }
    }
    if (raw.lang !== undefined) {
      if (LANGS.indexOf(raw.lang) >= 0) { out.lang = raw.lang; } else { repaired = true; }
    }
    if (raw.tab !== undefined) {
      if (TAB_KEYS.indexOf(raw.tab) >= 0) { out.tab = raw.tab; } else { repaired = true; }
    }
    if (raw.side !== undefined) {
      if (raw.side === "left" || raw.side === "right") { out.side = raw.side; } else { repaired = true; }
    }
    if (raw.y !== undefined) {
      var y = num(raw.y);
      if (y === null) { repaired = true; }
      else { out.y = clamp(Math.round(y * 1000) / 1000, 0.12, 0.92); }
    }
    if (raw.seen !== undefined) { out.seen = raw.seen === true; }
    if (raw.native !== undefined) {
      out.native = raw.native !== false;
      if (typeof raw.native !== "boolean") { repaired = true; }
    }
    if (raw.panel !== undefined) {
      out.panel = raw.panel === true;
      if (typeof raw.panel !== "boolean") { repaired = true; }
    }

    return { value: out, repaired: repaired, migrated: raw.v !== 1, empty: false };
  }

  function pickLang(setting, navLang) {
    if (setting === "zh" || setting === "en") { return setting; }
    var tag = (navLang || "zh").toLowerCase();
    return tag.indexOf("zh") === 0 ? "zh" : "en";
  }

  function strings(lang) { return STRINGS[lang] || STRINGS.zh; }

  function fmt(template, map) {
    return String(template).replace(/\{(\w+)\}/g, function (m, k) {
      return (map && map[k] !== undefined) ? String(map[k]) : m;
    });
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function formatClock(hour, minute) {
    var h = num(hour); var m = num(minute);
    if (h === null) { return "--:--"; }
    return pad2(clamp(Math.floor(h), 0, 23)) + ":" + pad2(clamp(Math.floor(m === null ? 0 : m), 0, 59));
  }

  var MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function formatDate(month, day, lang) {
    var mo = num(month); var d = num(day);
    if (mo === null || d === null) { return "—"; }
    mo = clamp(Math.floor(mo), 1, 12); d = clamp(Math.floor(d), 1, 31);
    return lang === "en" ? (MONTHS_EN[mo - 1] + " " + d) : (mo + "月" + d + "日");
  }

  var WEEKDAY_ZH = ["日", "一", "二", "三", "四", "五", "六"];
  function formatWeekday(weekDay, lang) {
    var w = num(weekDay);
    if (w === null || w < 1 || w > 7) { return ""; }
    return lang === "en" ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w - 1] : ("周" + WEEKDAY_ZH[w - 1]);
  }

  function formatMoney(value) {
    var v = num(value);
    if (v === null) { return "—"; }
    /* DoL 内部金额单位是便士：999899 -> £9,998.99；不能按整数英镑显示。 */
    var pence = Math.round(v);
    var sign = pence < 0 ? "-" : "";
    var abs = Math.abs(pence);
    var pounds = Math.floor(abs / 100);
    var cents = abs % 100;
    return sign + "£" + pounds.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + pad2(cents);
  }

  function phaseKey(state) {
    if (state === "night" || state === "dawn" || state === "day" || state === "dusk") { return state; }
    return "unknown";
  }

  function dayProgress(hour, minute) {
    var h = num(hour); var m = num(minute);
    if (h === null) { return null; }
    return clamp(((clamp(h, 0, 23) * 60) + clamp(m === null ? 0 : m, 0, 59)) / 1440 * 100, 0, 100);
  }

  function ratio(value, max) {
    var v = num(value); var mx = num(max);
    if (v === null) { return null; }
    if (mx === null || mx <= 0) { return { pct: 0, over: false }; }
    var pct = clamp(v / mx * 100, 0, 100);
    return { pct: pct, over: v > mx };
  }

  /* 只读状态桥。env 由调用方从游戏里取，core 自己不去碰全局。 */
  function readModel(env) {
    env = isObj(env) ? env : {};
    var vars = isObj(env.vars) ? env.vars : null;
    var time = isObj(env.time) ? env.time : null;
    var constants = isObj(env.constants) ? env.constants : null;

    var clock = null;
    if (time && num(time.hour) !== null) {
      clock = {
        hour: time.hour,
        minute: num(time.minute) === null ? 0 : time.minute,
        date: formatDate(time.month, time.monthDay, env.lang === "en" ? "en" : "zh"),
        weekday: formatWeekday(time.weekDay, env.lang === "en" ? "en" : "zh"),
        phase: phaseKey(time.dayState),
        progress: dayProgress(time.hour, time.minute)
      };
    }

    var vitalDefs = [
      { key: "willpower", value: "willpower", max: "willpowermax" },
      { key: "stress", value: "stress", max: "stressmax" },
      { key: "trauma", value: "trauma", max: "traumamax" },
      { key: "arousal", value: "arousal", max: "arousalmax" },
      { key: "tiredness", value: "tiredness", max: null }
    ];
    var tiredMax = (constants && constants.tiredness && num(constants.tiredness.max)) || 2000;
    var vitals = [];
    var missing = 0;
    for (var i = 0; i < vitalDefs.length; i++) {
      var d = vitalDefs[i];
      var value = vars ? num(vars[d.value]) : null;
      var max = d.max && vars ? num(vars[d.max]) : null;
      if (d.key === "tiredness") { max = tiredMax; }
      if (value === null) { missing++; continue; }
      var r = ratio(value, max);
      vitals.push({ key: d.key, value: value, max: max, pct: r.pct, over: r.over });
    }

    var worn = [];
    var wornCount = 0;
    for (var j = 0; j < WORN_SLOTS.length; j++) {
      var slot = WORN_SLOTS[j];
      var item = vars && isObj(vars.worn) ? vars.worn[slot] : null;
      var name = item && typeof item.name === "string" ? item.name : null;
      if (name) { wornCount++; }
      worn.push({ slot: slot, name: name });
    }

    return {
      clock: clock,
      money: vars ? num(vars.money) : null,
      scene: str(env.passage),
      vitals: vitals,
      missingVitals: missing,
      worn: worn,
      wornCount: wornCount,
      degraded: !vars || missing > 0 || !clock
    };
  }

  function hexToRgb(hex) {
    if (typeof hex !== "string") { return null; }
    var h = hex.trim().replace(/^#/, "");
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) { return null; }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function luminance(hex) {
    var rgb = hexToRgb(hex);
    if (!rgb) { return null; }
    var ch = rgb.map(function (v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }

  function contrast(a, b) {
    var la = luminance(a); var lb = luminance(b);
    if (la === null || lb === null) { return null; }
    var hi = Math.max(la, lb); var lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  function paletteFor(theme) { return PALETTES[theme] || PALETTES.amber; }

  function buildDiagnostics(info) {
    info = isObj(info) ? info : {};
    return {
      mod: "MapleLantern",
      version: VERSION,
      game: info.game || null,
      sugarCube: info.sugarCube || null,
      host: info.host ? { present: true, apiVersion: info.host.apiVersion || null, layout: info.host.layout || null, visualTier: info.host.visualTier || null } : { present: false },
      viewport: info.viewport || null,
      breakpoint: info.breakpoint || null,
      storage: info.storage === true,
      reducedMotion: info.reducedMotion === true,
      themeMode: info.theme || null,
      lang: info.lang || null,
      settingsRepaired: info.repaired === true,
      stateReadable: info.stateReadable === true,
      renderMs: typeof info.renderMs === "number" ? info.renderMs : null,
      at: info.at || null
    };
  }

  return Object.freeze({
    VERSION: VERSION,
    STORAGE_KEY: STORAGE_KEY,
    TAB_KEYS: TAB_KEYS,
    THEMES: THEMES,
    DENSITIES: DENSITIES,
    LANGS: LANGS,
    WORN_SLOTS: WORN_SLOTS,
    STRINGS: STRINGS,
    SLOT_LABELS: SLOT_LABELS,
    PALETTES: PALETTES,
    DEFAULTS: DEFAULTS,
    sanitizeSettings: sanitizeSettings,
    pickLang: pickLang,
    strings: strings,
    fmt: fmt,
    formatClock: formatClock,
    formatDate: formatDate,
    formatWeekday: formatWeekday,
    formatMoney: formatMoney,
    phaseKey: phaseKey,
    dayProgress: dayProgress,
    ratio: ratio,
    readModel: readModel,
    contrast: contrast,
    luminance: luminance,
    paletteFor: paletteFor,
    buildDiagnostics: buildDiagnostics
  });
});
