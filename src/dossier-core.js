/* ============================================================================
 * 灯台 · 外观 / MapleLanternDossier — core.js
 * 纯逻辑层：设置归一化、标签映射、编号格式化、自定义外观的数学。
 * 无 DOM、无副作用，可单测。
 *
 * 与 MapleLantern 的关系：只读它挂出的变量名与 data-ml-native / data-ml-theme，
 * 不修改它的任何文件、不覆盖它的全局对象。
 * ========================================================================== */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MapleLanternDossierCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = "1.4.13";
  var SETTINGS_KEY = "MapleLanternDossier.settings.v1";

  var FITS = ["cover", "contain", "fill"];

  /** 自定义外观（玩家自己调）。颜色为空串表示“跟随灯台主题”。 */
  var CUSTOM_DEFAULTS = {
    bgOn: false,
    bgOpacity: 100,
    bgFit: "cover",
    bgZoom: 100,
    bgX: 50,
    bgY: 50,
    bgSoft: 0,
    btnOn: false,
    btnOpacity: 70,
    btnFit: "cover",
    btnZoom: 100,
    btnX: 50,
    btnY: 50,
    cardOn: false,
    cardOpacity: 70,
    cardFit: "cover",
    cardZoom: 100,
    cardX: 50,
    cardY: 50,
    fontScale: 100,
    surfaceAlpha: 90,
    syncMl: true,
    colors: { accent: "", surface: "", text: "", line: "" }
  };

  var DEFAULTS = {
    custom: CUSTOM_DEFAULTS
  };

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function clone(o) {
    var out = {};
    for (var k in o) {
      if (Object.prototype.hasOwnProperty.call(o, k)) {
        var v = o[k];
        out[k] = isPlainObject(v) ? clone(v) : v;
      }
    }
    return out;
  }

  function has(o, k) {
    return Object.prototype.hasOwnProperty.call(o, k);
  }

  /* -------------------------------------------------------------------------
   * 数值夹取
   * ---------------------------------------------------------------------- */

  function clampNum(v, min, max, fallback) {
    var n = Number(v);
    if (!isFinite(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
  }

  /** 夹到 [min,max] 并落到 step 的整数格上（滑杆用）。 */
  function clampStep(v, min, max, step, fallback) {
    var n = clampNum(v, min, max, typeof fallback === "number" ? fallback : min);
    var s = step > 0 ? step : 1;
    n = Math.round(n / s) * s;
    if (n < min) n = min;
    if (n > max) n = max;
    return s === 1 ? Math.round(n) : Number(n.toFixed(4));
  }

  /* -------------------------------------------------------------------------
   * 颜色
   * ---------------------------------------------------------------------- */

  var HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

  function isHexColor(v) {
    return typeof v === "string" && HEX_RE.test(v.trim());
  }

  /** 统一成 #rrggbb 小写；非法输入返回 ""（表示跟随主题）。 */
  function normalizeHex(v) {
    if (!isHexColor(v)) return "";
    var h = String(v).trim().toLowerCase();
    if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    return h;
  }

  function hexToRgb(hex) {
    var h = normalizeHex(hex);
    if (!h) return null;
    return {
      r: parseInt(h.slice(1, 3), 16),
      g: parseInt(h.slice(3, 5), 16),
      b: parseInt(h.slice(5, 7), 16)
    };
  }

  function relLuminance(rgb) {
    function ch(c) {
      var s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * ch(rgb.r) + 0.7152 * ch(rgb.g) + 0.0722 * ch(rgb.b);
  }

  /** WCAG 对比度；任一侧不是合法 hex 时返回 null（表示算不了，不提示）。 */
  function contrastRatio(fg, bg) {
    var a = hexToRgb(fg);
    var b = hexToRgb(bg);
    if (!a || !b) return null;
    var la = relLuminance(a);
    var lb = relLuminance(b);
    var hi = Math.max(la, lb);
    var lo = Math.min(la, lb);
    return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
  }

  /**
   * 由四个基色派生整套 token（只派生有依据的，其余返回 null 交给 CSS 回落）。
   * 派生用 color-mix 字符串，与灯台/本包现有写法一致。
   */
  function derivePalette(colors) {
    var c = isPlainObject(colors) ? colors : {};
    var accent = normalizeHex(c.accent);
    var surface = normalizeHex(c.surface);
    var text = normalizeHex(c.text);
    var line = normalizeHex(c.line);
    var out = {
      accent: accent || null,
      surface: surface || null,
      text: text || null,
      line: line || null,
      surface2: null,
      surface3: null,
      muted: null,
      faint: null,
      borderStrong: null
    };
    if (surface && text) {
      out.surface2 = "color-mix(in srgb, " + surface + " 88%, " + text + " 12%)";
      out.surface3 = "color-mix(in srgb, " + surface + " 80%, " + text + " 20%)";
      out.muted = "color-mix(in srgb, " + text + " 56%, " + surface + " 44%)";
      out.faint = "color-mix(in srgb, " + text + " 36%, " + surface + " 64%)";
    }
    if (line && text) out.borderStrong = "color-mix(in srgb, " + line + " 78%, " + text + " 22%)";
    return out;
  }

  /* -------------------------------------------------------------------------
   * 自定义外观：归一化
   * ---------------------------------------------------------------------- */

  function sanitizeCustom(raw) {
    var out = clone(CUSTOM_DEFAULTS);
    if (!isPlainObject(raw)) return out;

    if (typeof raw.bgOn === "boolean") out.bgOn = raw.bgOn;
    out.bgOpacity = clampStep(raw.bgOpacity, 0, 100, 5, out.bgOpacity);
    if (FITS.indexOf(raw.bgFit) >= 0) out.bgFit = raw.bgFit;
    out.bgZoom = clampStep(raw.bgZoom, 50, 200, 5, out.bgZoom);
    out.bgX = clampStep(raw.bgX, 0, 100, 1, out.bgX);
    out.bgY = clampStep(raw.bgY, 0, 100, 1, out.bgY);
    out.bgSoft = clampStep(raw.bgSoft, 0, 8, 1, out.bgSoft);

    if (typeof raw.btnOn === "boolean") out.btnOn = raw.btnOn;
    out.btnOpacity = clampStep(raw.btnOpacity, 0, 100, 5, out.btnOpacity);
    if (FITS.indexOf(raw.btnFit) >= 0) out.btnFit = raw.btnFit;
    out.btnZoom = clampStep(raw.btnZoom, 50, 200, 5, out.btnZoom);
    out.btnX = clampStep(raw.btnX, 0, 100, 1, out.btnX);
    out.btnY = clampStep(raw.btnY, 0, 100, 1, out.btnY);

    /* 浮窗卡片：游戏原生弹窗（#customOverlayContent / #ui-dialog-body）的底图 */
    if (typeof raw.cardOn === "boolean") out.cardOn = raw.cardOn;
    out.cardOpacity = clampStep(raw.cardOpacity, 0, 100, 5, out.cardOpacity);
    if (FITS.indexOf(raw.cardFit) >= 0) out.cardFit = raw.cardFit;
    out.cardZoom = clampStep(raw.cardZoom, 50, 200, 5, out.cardZoom);
    out.cardX = clampStep(raw.cardX, 0, 100, 1, out.cardX);
    out.cardY = clampStep(raw.cardY, 0, 100, 1, out.cardY);

    out.fontScale = clampStep(raw.fontScale, 80, 140, 5, out.fontScale);
    out.surfaceAlpha = clampStep(raw.surfaceAlpha, 0, 100, 5, out.surfaceAlpha);
    if (typeof raw.syncMl === "boolean") out.syncMl = raw.syncMl;

    if (isPlainObject(raw.colors)) {
      out.colors = {
        accent: normalizeHex(raw.colors.accent),
        surface: normalizeHex(raw.colors.surface),
        text: normalizeHex(raw.colors.text),
        line: normalizeHex(raw.colors.line)
      };
    }
    return out;
  }

  function sanitize(raw) {
    var out = clone(DEFAULTS);
    out.custom = sanitizeCustom(null);
    if (!isPlainObject(raw)) return out;
    if (isPlainObject(raw.custom)) out.custom = sanitizeCustom(raw.custom);
    return out;
  }

  /**
   * 合并补丁。custom 是嵌套对象：逐键校验，非法值保留 base（不回落默认）。
   * custom.colors 里的空字符串是合法值（= 跟随主题）。
   */
  function merge(base, patch) {
    var out = sanitize(base);
    if (!isPlainObject(patch)) return out;
    // 补丁既接受扁平写法（{bgOn:true}），也接受嵌套写法（{custom:{bgOn:true}}）
    var p = {};
    Object.keys(patch).forEach(function (k) { p[k] = patch[k]; });
    if (isPlainObject(patch.custom)) {
      Object.keys(patch.custom).forEach(function (k) {
        if (k === "colors" || !has(p, k)) p[k] = patch.custom[k];
      });
    }

    function pickBool(key, target) {
      if (has(p, key) && typeof p[key] === "boolean") target[key] = p[key];
    }

    function pickFit(key) {
      if (has(p, key) && FITS.indexOf(p[key]) >= 0) out.custom[key] = p[key];
    }

    function pickNum(key, min, max, step) {
      if (has(p, key)) out.custom[key] = clampStep(p[key], min, max, step, out.custom[key]);
    }


    pickBool("bgOn", out.custom);
    pickNum("bgOpacity", 0, 100, 5);
    pickFit("bgFit");
    pickNum("bgZoom", 50, 200, 5);
    pickNum("bgX", 0, 100, 1);
    pickNum("bgY", 0, 100, 1);
    pickNum("bgSoft", 0, 8, 1);

    pickBool("btnOn", out.custom);
    pickNum("btnOpacity", 0, 100, 5);
    pickFit("btnFit");
    pickNum("btnZoom", 50, 200, 5);
    pickNum("btnX", 0, 100, 1);
    pickNum("btnY", 0, 100, 1);

    pickBool("cardOn", out.custom);
    pickNum("cardOpacity", 0, 100, 5);
    pickFit("cardFit");
    pickNum("cardZoom", 50, 200, 5);
    pickNum("cardX", 0, 100, 1);
    pickNum("cardY", 0, 100, 1);

    pickNum("fontScale", 80, 140, 5);
    pickNum("surfaceAlpha", 0, 100, 5);
    pickBool("syncMl", out.custom);

    if (isPlainObject(p.colors)) {
      ["accent", "surface", "text", "line"].forEach(function (k) {
        if (!has(p.colors, k)) return;
        var v = p.colors[k];
        if (typeof v !== "string") return;
        var n = normalizeHex(v);
        // 空串是明确的“回到跟随主题”；非法彩色字符串按“没写”处理，保留 base
        if (n === "" && v.trim() === "") out.custom.colors[k] = "";
        else if (n !== "") out.custom.colors[k] = n;
      });
    }
    return out;
  }

  /* -------------------------------------------------------------------------
   * 自定义外观：分项复位
   * ---------------------------------------------------------------------- */

  var RESET_GROUPS = {
    bg: ["bgOn", "bgOpacity", "bgFit", "bgZoom", "bgX", "bgY", "bgSoft"],
    btn: ["btnOn", "btnOpacity", "btnFit", "btnZoom", "btnX", "btnY"],
    card: ["cardOn", "cardOpacity", "cardFit", "cardZoom", "cardX", "cardY"],
    colors: ["colors"],
    type: ["fontScale", "surfaceAlpha"],
    veil: ["surfaceAlpha"],
    all: ["bgOn", "bgOpacity", "bgFit", "bgZoom", "bgX", "bgY", "bgSoft",
      "btnOn", "btnOpacity", "btnFit", "btnZoom", "btnX", "btnY",
      "cardOn", "cardOpacity", "cardFit", "cardZoom", "cardX", "cardY",
      "fontScale", "surfaceAlpha", "syncMl", "colors"]
  };

  function resetCustom(settings, group) {
    var s = sanitize(settings);
    var keys = RESET_GROUPS[group];
    if (!keys) return s;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === "colors") s.custom.colors = clone(CUSTOM_DEFAULTS.colors);
      else s.custom[k] = CUSTOM_DEFAULTS[k];
    }
    return s;
  }

  /* -------------------------------------------------------------------------
   * 自定义外观：开背景图时的一次性对齐
   *
   * 灯台面板底板默认 92% 不透明（--ml-panel-bg 用 --ml-surface-alpha）。图铺在
   * 下面、屏幕却几乎没变化 —— 玩家第一反应就是"导入了但没生效"。所以第一次
   * 开背景时把遮蔽降到能看见的程度；玩家随后可以自己再调。
   * 返回要并进设置的补丁（不需要动就是空对象）。
   * ---------------------------------------------------------------------- */

  var BG_ALIGN_ALPHA = 45;
  var BG_ALIGN_TRIGGER = 80;

  function alignForBackground(custom) {
    var c = sanitizeCustom(custom);
    var out = {};
    if (c.surfaceAlpha >= BG_ALIGN_TRIGGER) out.surfaceAlpha = BG_ALIGN_ALPHA;
    /* 背景不透明度低于 80 时暗色图会被同色遮罩洗没，看起来就像「导入了没反应」。
       这是玩家自己拖低的档位，不强制改；但开背景/应用背景时给一次修正，回执里写明。 */
    if (typeof c.bgOpacity === "number" && c.bgOpacity < BG_ALIGN_TRIGGER) out.bgOpacity = 100;
    return out;
  }

  /* -------------------------------------------------------------------------
   * 自定义外观：「应用背景」的一次性重放
   *
   * 玩家导入图之后点一下，把图库里现有的两张图重新挂上、整份设置重新应用、
   * 并强制一次同步重排。返回状态 + 一句可读的回执（面板直接显示）。
   * ---------------------------------------------------------------------- */

  function appliedSummary(custom, hasBg, hasBtn, hasCard) {
    var c = sanitizeCustom(custom);
    var bg = !!(c.bgOn && hasBg);
    var btn = !!(c.btnOn && hasBtn);
    var card = !!(c.cardOn && hasCard);
    var parts = [
      "背景 " + (bg ? c.bgOpacity + "%" : (hasBg ? "已关闭" : "还没有图")),
      "按钮底纹 " + (btn ? c.btnOpacity + "%" : (hasBtn ? "已关闭" : "还没有图")),
      "浮窗卡片 " + (card ? c.cardOpacity + "%" : (hasCard ? "已关闭" : "还没有图")),
      "面板遮蔽 " + c.surfaceAlpha + "%"
    ];
    return { bg: bg, btn: btn, card: card, note: "已应用 · " + parts.join(" · ") };
  }

  /* -------------------------------------------------------------------------
   * 自定义外观：变量清单
   *
   * 返回 { md: {变量:值}, ml: {变量:值}, remove: [变量], palette }
   *  - md 只作用于本包；ml 同步给灯台；remove 是此刻不能留内联值的变量
   *    （留着会盖掉主题/默认，关模组时必须逐项撤掉）
   * ---------------------------------------------------------------------- */

  var ML_MAP = [
    ["accent", "--mln-accent"],
    ["surface", "--mln-surface"],
    ["surface2", "--mln-surface-2"],
    ["surface3", "--mln-surface-3"],
    ["text", "--mln-text"],
    ["muted", "--mln-muted"],
    ["faint", "--mln-faint"],
    ["line", "--mln-border"],
    ["borderStrong", "--mln-border-strong"]
  ];

  function planVars(custom) {
    var c = sanitizeCustom(custom);
    var palette = derivePalette(c.colors);
    var md = {};
    var ml = {};
    var remove = [];

    md["--mlc-bg-op"] = String(Number((c.bgOpacity / 100).toFixed(2)));
    // 页面背景改由 body 承载（负层 #mlc-bg 在 DoL 的 #story 层叠上下文下会被吃掉），
    // background-image 的 url 不能单独降 alpha，同按钮底纹一样用同色遮罩压出透明度。
    var bgVeilPct = Math.max(0, Math.min(100, 100 - c.bgOpacity));
    md["--mlc-bg-veil"] = bgVeilPct <= 0
      ? "transparent"
      : "color-mix(in srgb, var(--mlc-surface) " + bgVeilPct + "%, transparent)";
    md["--mlc-bg-soft"] = c.bgSoft + "px";
    md["--mlc-btn-op"] = String(Number((c.btnOpacity / 100).toFixed(2)));
    md["--mlc-font-scale"] = String(Number((c.fontScale / 100).toFixed(2)));
    md["--mlc-surface-alpha"] = String(Number((c.surfaceAlpha / 100).toFixed(2)));
    // 纸面遮蔽：档案层的底不再写死 var(--mlc-surface)，而是按这个比例掺透明
    md["--mlc-surface-a"] = "color-mix(in srgb, var(--mlc-surface) " + c.surfaceAlpha + "%, transparent)";
    // 按钮底图靠“纸面遮罩”调透明度：图片本身没法单独降 alpha
    var veilPct = Math.max(0, Math.min(100, 100 - c.btnOpacity));
    md["--mlc-btn-veil"] = veilPct <= 0
      ? "transparent"
      : "color-mix(in srgb, var(--mlc-surface) " + veilPct + "%, transparent)";

    /* 浮窗卡片底图：同样靠同色遮罩降 alpha（图片本身不能单独降） */
    md["--mlc-card-op"] = String(Number((c.cardOpacity / 100).toFixed(2)));
    var cardVeilPct = Math.max(0, Math.min(100, 100 - c.cardOpacity));
    md["--mlc-card-veil"] = cardVeilPct <= 0
      ? "transparent"
      : "color-mix(in srgb, var(--mlc-surface) " + cardVeilPct + "%, transparent)";

    var mdColors = [
      ["accent", "--mlc-accent"],
      ["surface", "--mlc-surface"],
      ["text", "--mlc-text"],
      ["line", "--mlc-line"]
    ];
    mdColors.forEach(function (pair) {
      var v = palette[pair[0]];
      if (v) md[pair[1]] = v;
      else remove.push(pair[1]);
    });

    if (c.syncMl) {
      ML_MAP.forEach(function (pair) {
        var v = palette[pair[0]];
        if (v) ml[pair[1]] = v;
        else remove.push(pair[1]);
      });
    } else {
      ML_MAP.forEach(function (pair) { remove.push(pair[1]); });
    }

    return { md: md, ml: ml, remove: remove, palette: palette };
  }

  /* -------------------------------------------------------------------------
   * 自定义外观：背景 / 按钮底图的定位算法（预览与真页面共用）
   * ---------------------------------------------------------------------- */

  /**
   * fit=cover 以“铺满盒”为 100%，contain 以“完整装下”为 100%，fill 直接拉满盒；
   * zoom 在各自的 100% 之上再乘。
   */
  function computeBackgroundSize(imgW, imgH, boxW, boxH, fit, zoom) {
    var iw = Number(imgW);
    var ih = Number(imgH);
    var bw = Number(boxW);
    var bh = Number(boxH);
    if (!(iw > 0 && ih > 0 && bw > 0 && bh > 0)) return { w: 0, h: 0 };
    var z = clampStep(zoom, 50, 200, 1, 100) / 100;
    if (fit === "fill") {
      return { w: Math.round(bw * z), h: Math.round(bh * z) };
    }
    var s = fit === "contain"
      ? Math.min(bw / iw, bh / ih)
      : Math.max(bw / iw, bh / ih);
    return { w: Math.round(iw * s * z), h: Math.round(ih * s * z) };
  }

  /**
   * 在预览里拖图 → 新的 X/Y 百分比。
   * CSS 的 background-position 百分比是「对齐 p% 点」，所以往右拖图要让 p 减小。
   */
  function dragToPosition(opts) {
    var o = opts || {};
    var bw = Number(o.boxW);
    var bh = Number(o.boxH);
    var gw = Number(o.bgW);
    var gh = Number(o.bgH);
    var x = clampNum(o.x, 0, 100, 50);
    var y = clampNum(o.y, 0, 100, 50);
    var dx = Number(o.dx) || 0;
    var dy = Number(o.dy) || 0;
    var travelX = gw - bw;
    var travelY = gh - bh;
    if (travelX > 0) x = x - (dx / travelX) * 100;
    if (travelY > 0) y = y - (dy / travelY) * 100;
    return { x: Math.round(clampNum(x, 0, 100, 50)), y: Math.round(clampNum(y, 0, 100, 50)) };
  }

  /** 等比缩到「长边 ≤ maxEdge 且像素 ≤ maxArea」，导入前降采样用。 */
  function fitWithin(w, h, maxEdge, maxArea) {
    var iw = Number(w);
    var ih = Number(h);
    if (!(iw > 0 && ih > 0)) return { w: 0, h: 0 };
    var s = 1;
    var edge = Math.max(iw, ih);
    if (maxEdge > 0 && edge > maxEdge) s = maxEdge / edge;
    var area = (iw * s) * (ih * s);
    if (maxArea > 0 && area > maxArea) s *= Math.sqrt(maxArea / area);
    return { w: Math.max(1, Math.round(iw * s)), h: Math.max(1, Math.round(ih * s)) };
  }

  function formatBytes(n) {
    var v = Number(n);
    if (!isFinite(v) || v <= 0) return "0 KB";
    if (v < 1024) return v + " B";
    if (v < 1024 * 1024) return Math.round(v / 1024) + " KB";
    return (v / (1024 * 1024)).toFixed(1) + " MB";
  }

  /* -------------------------------------------------------------------------
   * 原有能力
   * ---------------------------------------------------------------------- */

  /** 只允许纯数字的 childId 进入选择器，避免把外部文本拼进 querySelector。 */
  function isSafeId(id) {
    return /^[0-9]+$/.test(String(id == null ? "" : id));
  }

  function readSettings(storage) {
    try {
      var raw = storage && storage.getItem(SETTINGS_KEY);
      if (!raw) return sanitize(null);
      return sanitize(JSON.parse(raw));
    } catch (e) {
      return sanitize(null);
    }
  }

  function writeSettings(storage, settings) {
    try {
      storage.setItem(SETTINGS_KEY, JSON.stringify(sanitize(settings)));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    VERSION: VERSION,
    SETTINGS_KEY: SETTINGS_KEY,
    DEFAULTS: DEFAULTS,
    FITS: FITS,
    CUSTOM_DEFAULTS: CUSTOM_DEFAULTS,
    RESET_GROUPS: RESET_GROUPS,
    clone: clone,
    sanitize: sanitize,
    sanitizeCustom: sanitizeCustom,
    merge: merge,
    isSafeId: isSafeId,
    isHexColor: isHexColor,
    normalizeHex: normalizeHex,
    hexToRgb: hexToRgb,
    contrastRatio: contrastRatio,
    derivePalette: derivePalette,
    planVars: planVars,
    computeBackgroundSize: computeBackgroundSize,    dragToPosition: dragToPosition,
    fitWithin: fitWithin,
    clampStep: clampStep,
    resetCustom: resetCustom,
    alignForBackground: alignForBackground,
    appliedSummary: appliedSummary,
    formatBytes: formatBytes,
    readSettings: readSettings,
    writeSettings: writeSettings
  };
});
