/* ============================================================================
 * 灯台 · MapleLantern — native.js（原版 UI 展示投影层）
 * 只给原版节点打展示标记，不改文本、不改 data-passage、不改点击事件、不写存档。
 * 由 CSS 承担布局与视觉；本文件只解决 CSS 无法可靠推断的结构语义。
 * ========================================================================== */
(function () {
  "use strict";

  var C = window.MapleLanternCore;
  if (!C || typeof document === "undefined") { return; }
  if (window.MapleLanternNative && window.MapleLanternNative.__mounted) { return; }

  var doc = document;
  var D = C.DEFAULTS;
  var ATTR = "data-ml-native";

  var state = {
    mounted: false,
    settings: null,
    host: false,
    nativeOn: false,
    lang: "zh",
    pending: false,
    disposed: false,
    entry: null,
    overlayHome: null
  };

  function readSettings() {
    var result = { value: Object.assign({}, D) };
    try {
      var raw = window.localStorage.getItem(C.STORAGE_KEY);
      if (raw) { result = C.sanitizeSettings(JSON.parse(raw)); }
    } catch (e) { /* 存储不可用时用默认值；原生层不依赖设置 */ }
    return result.value;
  }

  function hostEnabled() {
    try {
      var ui = window.DoLGameUI && window.DoLGameUI.ui;
      if (!ui || ui.apiVersion !== 1 || typeof ui.getCapabilities !== "function") { return false; }
      var caps = ui.getCapabilities();
      return !!(caps && caps.enabled === true);
    } catch (e) { return false; }
  }

  function setRoot(on) {
    doc.documentElement.setAttribute(ATTR, on ? "on" : "off");
    doc.documentElement.setAttribute("data-ml-motion", state.settings.motion ? "on" : "off");
    doc.documentElement.setAttribute("data-ml-lang", state.lang);
    var theme = state.settings.theme;
    doc.documentElement.setAttribute("data-ml-theme", theme === "auto" ? "amber" : theme);
  }

  /* --------------------------------------------------------- #stats 四格 */

  function markStats() {
    var wrap = doc.querySelector("#stats .centered-elements");
    if (!wrap) { return; }
    var kids = wrap.children || [];
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (!node || node.nodeType !== 1) { continue; }
      var kind = "";
      if (node.querySelector(".true")) { kind = "money"; }
      else if (node.querySelector(".clockContainer")) { kind = "time"; }
      else if (node.querySelector('img[src*="sidebar-day"]')) { kind = "day"; }
      else if (node.querySelector('img[src*="sidebar-open"], img[src*="sidebar-closed"]')) { kind = "toggle"; }
      if (kind) { node.setAttribute("data-ml-chip", kind); }
      else { node.removeAttribute("data-ml-chip"); }
      if (kind === "money") {
        var money = node.querySelector(".true .true") || node.querySelector(".true");
        if (money) {
          var amount = (money.textContent || "").trim();
          if (/^£[0-9,]+$/.test(amount)) { money.textContent = amount + ".00"; }
        }
      }
    }
  }

  /* --------------------------------------------------------- #statmeters */

  function readPercent(card) {
    try {
      var meter = card.querySelector(".meter");
      if (!meter) { return null; }
      var fill = meter.querySelector("div");
      if (!fill) { return 0; }
      var raw = (fill.style && fill.style.width) || "";
      var n = parseFloat(raw);
      if (!isFinite(n)) { return 0; }
      return Math.max(0, Math.min(100, Math.round(n)));
    } catch (e) { return null; }
  }

  function parseStatValue(card) {
    var title = (card.getAttribute("title") || "").trim();
    if (!title) { return ""; }
    var idx = title.lastIndexOf(":");
    var value = (idx >= 0 ? title.slice(idx + 1) : title).trim();
    return /^-?\d+(?:\.\d+)?$/.test(value) ? value : "";
  }

  function compactStatNumber(raw) {
    var n = Number(raw);
    if (!isFinite(n)) { return ""; }
    return String(Math.round(n * 100) / 100);
  }

  function markStatmeters() {
    var host = doc.getElementById("statmeters");
    if (!host) { return; }
    host.setAttribute("data-ml-statmeters", "1");
    var cards = host.querySelectorAll('div[id$="caption"]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var key = card.id.replace(/caption$/, "");
      var value = parseStatValue(card);
      var pct = readPercent(card);
      card.setAttribute("data-ml-stat-card", "1");
      card.setAttribute("data-ml-stat-key", key);
      card.removeAttribute("data-ml-value");
      card.removeAttribute("data-ml-current");
      card.removeAttribute("data-ml-percent");
      if (value) {
        card.setAttribute("data-ml-value", pct === null ? value : (value + " · " + pct + "%"));
        card.setAttribute("data-ml-current", compactStatNumber(value) || value);
        card.setAttribute("data-ml-percent", pct === null ? "" : (pct + "%"));
      }
    }
  }

  /* --------------------------------------------------------- 选项 / 弹层 */

  function dropPipe(node) {
    if (!node || node.nodeType !== 3) { return; }
    if ((node.textContent || "").trim() !== "|") { return; }
    node.parentNode.removeChild(node);
  }

  function dropPipeNear(node, step) {
    while (node && node.nodeType === 3 && !(node.textContent || "").trim()) {
      node = node[step];
    }
    dropPipe(node);
  }

  /* 衣柜动作与服装套之间用裸 "|" 分隔；卡片化后这些竖线会变成孤立色块。 */
  function tidySeparators(root) {
    var actions = root.querySelectorAll(".wardrobe-action");
    for (var i = 0; i < actions.length; i++) {
      dropPipeNear(actions[i].previousSibling, "previousSibling");
      dropPipeNear(actions[i].nextSibling, "nextSibling");
    }
    var outfits = root.querySelector("#listoutfits");
    if (!outfits) { return; }
    var walker = doc.createTreeWalker(outfits, 4, null);
    var texts = [];
    while (walker.nextNode()) { texts.push(walker.currentNode); }
    for (var j = 0; j < texts.length; j++) {
      dropPipe(texts[j]);
    }
  }

  /* 商店分类是「img.icon + a」两个兄弟节点；包成一层，图标才能和卡片同排。 */
  function markShopCats(root) {
    var shop = root.querySelector("#clothingShop-div");
    if (!shop) { return; }
    var imgs = shop.querySelectorAll("img.icon");
    var pairs = [];
    for (var i = 0; i < imgs.length; i++) {
      if (imgs[i].parentNode !== shop) { continue; }
      if (imgs[i].parentNode && imgs[i].parentNode.classList.contains("ml-shop-cat")) { continue; }
      var next = imgs[i].nextElementSibling;
      if (!next || next.tagName !== "A") { continue; }
      if (!next.classList || !next.classList.contains("macro-link")) { continue; }
      pairs.push({ img: imgs[i], link: next });
    }
    if (!pairs.length) { return; }
    var list = doc.createElement("div");
    list.className = "ml-shop-cat-list";
    list.setAttribute("data-ml-shop-cat-list", "1");
    pairs[0].img.parentNode.insertBefore(list, pairs[0].img);
    for (var j = 0; j < pairs.length; j++) {
      var wrap = doc.createElement("div");
      wrap.className = "ml-shop-cat";
      wrap.setAttribute("data-ml-shop-cat", "1");
      pairs[j].img.parentNode.insertBefore(wrap, pairs[j].img);
      wrap.appendChild(pairs[j].img);
      wrap.appendChild(pairs[j].link);
      var sib = wrap.nextSibling;
      while (sib) {
        if (sib.nodeType === 3 && !(sib.textContent || "").trim()) {
          sib = sib.nextSibling;
          continue;
        }
        if (sib.nodeType === 1 && sib.tagName === "BR") {
          var gone = sib;
          sib = sib.nextSibling;
          gone.parentNode.removeChild(gone);
          continue;
        }
        break;
      }
      list.appendChild(wrap);
    }
  }

  /* 商品名后的「| Owned: 1」是分隔符，卡片化后去掉竖线。 */
  function tidyShopText(root) {
    var names = root.querySelectorAll(".clothing-name");
    for (var i = 0; i < names.length; i++) {
      var walker = doc.createTreeWalker(names[i], 4, null);
      while (walker.nextNode()) {
        var node = walker.currentNode;
        node.nodeValue = (node.nodeValue || "").replace(/\s*\|\s*(?=Owned)/i, " ");
        node.nodeValue = (node.nodeValue || "").replace(/\|/g, "");
      }
    }
  }

  /* 商品详情容器在空态会留下一个白描边气泡，先标成空态隐藏。 */
  function markEmptyDetails(root) {
    var details = root.querySelectorAll(".clothing-details");
    for (var i = 0; i < details.length; i++) {
      var empty = !(details[i].textContent || "").trim() && details[i].children.length === 0;
      if (empty) { details[i].setAttribute("data-ml-empty", "1"); }
      else { details[i].removeAttribute("data-ml-empty"); }
    }
  }

  /* 商店列表右上三颗绝对定位小按钮会压住版本号，收进一条工具栏。 */
  function markShopTools(root) {
    var list = root.querySelector("#clothes-list");
    if (!list || list.querySelector(".ml-shop-tools")) { return; }
    var tools = list.querySelectorAll(".filters-button, .clothingshop-options-button, .shop-legend-button");
    if (!tools.length) { return; }
    var bar = doc.createElement("div");
    bar.className = "ml-shop-tools";
    var ref = list.querySelector(".button-back-to-shop");
    if (ref && ref.parentNode === list) { list.insertBefore(bar, ref.nextSibling); }
    else { list.appendChild(bar); }
    var labels = { "filters-button": "Filters", "clothingshop-options-button": "Options", "shop-legend-button": "Legend" };
    for (var i = 0; i < tools.length; i++) {
      var cls = tools[i].className || "";
      var key = Object.keys(labels).filter(function (k) { return cls.indexOf(k) !== -1; })[0];
      tools[i].setAttribute("data-ml-tool", labels[key] || "");
      tools[i].classList.add("ml-shop-tool");
      tools[i].textContent = "";
      var span = doc.createElement("span");
      span.className = "ml-shop-tool-label";
      span.textContent = labels[key] || "";
      tools[i].appendChild(span);
      bar.appendChild(tools[i]);
    }
  }

  function markPassages() {
    var passages = doc.getElementById("passages");
    if (!passages) { return; }
    /* 只标记，不替换链接；CSS 依据 .macro-link 区分正文选项与行内链接。 */
    var links = passages.querySelectorAll("a.link-internal.macro-link");
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute("data-ml-option", "1");
    }
    tidySeparators(passages);
    markShopCats(passages);
    markShopTools(passages);
    tidyShopText(passages);
    markEmptyDetails(passages);
  }

  function overlayKey(overlay) {
    var key = (overlay.getAttribute("data-overlay") || "").trim();
    if (key) { return key; }
    var title = doc.getElementById("customOverlayTitle");
    var text = title ? (title.textContent || "").trim() : "";
    if (!text) { return "unknown"; }
    if (/options|选项|设置/i.test(text)) { return "options"; }
    if (/saves|存档|读档/i.test(text)) { return "saves"; }
    return "unknown";
  }

  function openPanel() {
    try {
      if (window.MapleLantern && typeof window.MapleLantern.open === "function") {
        window.MapleLantern.open();
      }
    } catch (e) { /* 面板未就绪时保持原界面 */ }
  }

  function addEntry(overlay) {
    if (!overlay || overlay.classList.contains("hidden")) { return; }
    if (overlay.querySelector('[data-ml-entry="panel"]')) { return; }
    var body = doc.getElementById("customOverlayContent");
    if (!body) { return; }
    var wrap = doc.createElement("div");
    wrap.className = "ml-native-entry-wrap";
    var btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "ml-native-entry";
    btn.setAttribute("data-ml-entry", "panel");
    btn.setAttribute("title", C.strings(state.lang)["native.entryHint"]);
    btn.textContent = C.strings(state.lang)["native.entry"];
    btn.addEventListener("click", openPanel);
    wrap.appendChild(btn);
    body.insertBefore(wrap, body.firstChild);
    state.entry = btn;
  }

  function markFeatsIntro() {
    var body = doc.getElementById("customOverlayContent");
    if (!body || !body.querySelector("#featTypes")) { return false; }
    if (body.querySelector("[data-ml-feats-intro]")) { return true; }
    var stop = body.querySelector("#featTypes");
    var node = body.firstChild;
    var found = null;
    while (node) {
      if (node.nodeType === 1 && node.id === "featTypes") { found = node; break; }
      if (node.nodeType === 3 && /Filter by/i.test(node.nodeValue || "")) { found = node; break; }
      node = node.nextSibling;
    }
    if (!found) { found = stop; }
    var wrap = doc.createElement("div");
    wrap.className = "ml-native-feats-intro";
    wrap.setAttribute("data-ml-feats-intro", "1");
    var first = body.firstChild;
    while (first && first !== found) {
      var next = first.nextSibling;
      wrap.appendChild(first);
      first = next;
    }
    if (!wrap.firstChild) { return false; }
    body.insertBefore(wrap, found);
    return true;
  }

  function armFeatsIntro() {
    var tries = 0;
    var run = function () {
      if (state.nativeOn && markFeatsIntro()) { return; }
      tries++;
      if (tries < 15) { setTimeout(run, 150); }
    };
    run();
  }

  function restoreFeatsIntro() {
    var wrap = doc.querySelector("[data-ml-feats-intro]");
    if (!wrap || !wrap.parentNode) { return; }
    while (wrap.firstChild) { wrap.parentNode.insertBefore(wrap.firstChild, wrap); }
    wrap.parentNode.removeChild(wrap);
  }

  /* Statistics 的折叠体是「标签: 值 <br>」纯文本流，拆成两栏行便于扫读。 */
  function alignStatRows(root) {
    var bodies = root.querySelectorAll("#customOverlayContent .foldoutBody");
    for (var b = 0; b < bodies.length; b++) {
      var body = bodies[b];
      if (body.getAttribute("data-ml-stat-rows") === "1") { continue; }
      var nodes = Array.prototype.slice.call(body.childNodes);
      var lines = [];
      var line = [];
      for (var n = 0; n < nodes.length; n++) {
        var node = nodes[n];
        if (node.nodeType === 1 && node.tagName === "BR") {
          if (line.length) { lines.push(line); line = []; }
          continue;
        }
        line.push(node);
      }
      if (line.length) { lines.push(line); }

      var rows = doc.createElement("div");
      rows.className = "ml-stat-rows";
      for (var l = 0; l < lines.length; l++) {
        var parts = lines[l];
        var textNode = null;
        var colon = -1;
        for (var p = 0; p < parts.length; p++) {
          if (parts[p].nodeType === 3) {
            var idx = (parts[p].nodeValue || "").indexOf(":");
            if (idx > 0) { textNode = parts[p]; colon = idx; break; }
          }
        }
        var row = doc.createElement("div");
        if (!textNode) {
          if (!parts.some(function (x) { return (x.textContent || "").trim(); })) { continue; }
          row.className = "ml-stat-note";
          for (var q = 0; q < parts.length; q++) { row.appendChild(parts[q]); }
          rows.appendChild(row);
          continue;
        }
        var label = doc.createElement("span");
        label.className = "ml-stat-label";
        label.textContent = textNode.nodeValue.slice(0, colon).trim();
        var value = doc.createElement("span");
        value.className = "ml-stat-value";
        for (var r = 0; r < parts.length; r++) {
          if (parts[r] === textNode) {
            var rest = textNode.nodeValue.slice(colon + 1).replace(/^\s+/, "");
            if (rest) { value.appendChild(doc.createTextNode(rest)); }
          } else {
            value.appendChild(parts[r]);
          }
        }
        row.className = "ml-stat-row";
        row.appendChild(label);
        row.appendChild(value);
        rows.appendChild(row);
      }
      while (body.firstChild) { body.removeChild(body.firstChild); }
      body.appendChild(rows);
      body.setAttribute("data-ml-stat-rows", "1");
    }
  }

  function markOverlay() {
    var overlay = doc.getElementById("customOverlay");
    if (!overlay) { return; }
    var key = overlayKey(overlay);
    overlay.setAttribute("data-ml-overlay", key);
    if (key === "options") { addEntry(overlay); }
    if (key === "gameFeats") { armFeatsIntro(); }
    if (key === "statistics") { alignStatRows(overlay); }
  }

  function markDialog() {
    var dialog = doc.getElementById("ui-dialog");
    if (dialog) { dialog.setAttribute("data-ml-dialog", "1"); }
  }

  /* --------------------------------------------------------- 应用 / 调度 */

  function liftOverlay() {
    var container = doc.getElementById("customOverlayContainer");
    if (!container || container.parentNode === doc.body) { return; }
    state.overlayHome = { parent: container.parentNode, next: container.nextSibling };
    doc.body.appendChild(container);
  }

  function restoreOverlay() {
    var container = doc.getElementById("customOverlayContainer");
    if (!container || !state.overlayHome) { return; }
    var home = state.overlayHome;
    state.overlayHome = null;
    if (home.parent) { home.parent.insertBefore(container, home.next || null); }
  }

  function fitSidebarLabels() {
    /* 原版把 8 个入口拆成「整行 2 个 + 每组 2 个半宽」；半宽档只有 59px，
       JOURNAL / OPTIONS 会退成省略号。这里按实测宽度把字号收到 9.5px。 */
    var list = doc.querySelectorAll("#overlayButtons button");
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (!b.getAttribute("data-ml-label")) {
        b.setAttribute("data-ml-label", "1");
        b.setAttribute("data-ml-label-size", b.style.fontSize || "");
        b.setAttribute("data-ml-label-spacing", b.style.letterSpacing || "");
      }
      b.style.setProperty("font-size", "9.5px", "important");
      b.style.setProperty("letter-spacing", "-0.04em", "important");
    }
  }

  function clearMarks() {
    restoreFeatsIntro();
    var marked = doc.querySelectorAll("[data-ml-chip], [data-ml-stat-card], [data-ml-option], [data-ml-statmeters], [data-ml-dialog], [data-ml-overlay]");
    for (var i = 0; i < marked.length; i++) {
      marked[i].removeAttribute("data-ml-chip");
      marked[i].removeAttribute("data-ml-stat-card");
      marked[i].removeAttribute("data-ml-stat-key");
      marked[i].removeAttribute("data-ml-value");
      marked[i].removeAttribute("data-ml-option");
      marked[i].removeAttribute("data-ml-statmeters");
      marked[i].removeAttribute("data-ml-dialog");
      marked[i].removeAttribute("data-ml-overlay");
    }
    var entries = doc.querySelectorAll('[data-ml-entry="panel"]');
    for (var j = 0; j < entries.length; j++) {
      var wrap = entries[j].parentNode;
      if (wrap && wrap.parentNode) { wrap.parentNode.removeChild(wrap); }
    }
    var labels = doc.querySelectorAll("[data-ml-label]");
    for (var k = 0; k < labels.length; k++) {
      labels[k].removeAttribute("data-ml-label");
      if (labels[k].getAttribute("data-ml-label-size")) { labels[k].style.fontSize = labels[k].getAttribute("data-ml-label-size"); }
      else { labels[k].style.removeProperty("font-size"); }
      if (labels[k].getAttribute("data-ml-label-spacing")) { labels[k].style.letterSpacing = labels[k].getAttribute("data-ml-label-spacing"); }
      else { labels[k].style.removeProperty("letter-spacing"); }
      labels[k].removeAttribute("data-ml-label-size");
      labels[k].removeAttribute("data-ml-label-spacing");
    }
    state.entry = null;
  }

  function apply() {
    if (state.disposed || !state.mounted) { return; }
    state.settings = readSettings();
    state.lang = C.pickLang(state.settings.lang, navigator.language || "zh");
    state.host = hostEnabled();
    var on = state.settings.native !== false && !state.host;
    state.nativeOn = on;
    setRoot(on);
    if (!on) {
      clearMarks();
      restoreOverlay();
      if (state.entry && state.entry.parentNode) { state.entry.parentNode.removeChild(state.entry); }
      state.entry = null;
      return;
    }
    liftOverlay();
    markStats();
    markStatmeters();
    markPassages();
    markOverlay();
    fitSidebarLabels();
    markDialog();
  }

  function schedule() {
    if (state.disposed || state.pending) { return; }
    state.pending = true;
    var run = function () {
      state.pending = false;
      apply();
    };
    if (typeof window.requestAnimationFrame === "function") { window.requestAnimationFrame(run); }
    else { setTimeout(run, 0); }
  }

  function onPassage() { schedule(); }

  function onClick(e) {
    var t = e && e.target;
    if (!t) { return; }
    /* 只对可能改变弹层/侧栏/正文的点击做一次合并重扫；不在滚动或输入时跑。 */
    var inBar = !!(t.closest && (t.closest("#overlayButtons") || t.closest("#menu") || t.closest("#customOverlay")));
    /* 只在会异步换 DOM 的内层页点选后补扫；普通正文推进由 passageend 负责。 */
    var inInner = !!(t.closest && t.closest("#clothingShop-div, #clothes-list, #wardrobe"));
    if (inBar || inInner) {
      schedule();
      setTimeout(schedule, 0);
      setTimeout(schedule, 150);
      if (t.closest && t.closest("#overlayButtons")) { armFeatsIntro(); }
    }
  }

  function onReady() { schedule(); }

  function bind() {
    doc.addEventListener("passageend", onPassage);
    doc.addEventListener("dol-ui-runtime-ready", schedule);
    doc.addEventListener("click", onClick, true);
    window.addEventListener("resize", schedule, { passive: true });
    try {
      if (window.jQuery) { window.jQuery(doc).on(":passageend", onPassage); }
    } catch (e) { /* 原生事件兜底 */ }
  }

  function unbind() {
    doc.removeEventListener("passageend", onPassage);
    doc.removeEventListener("dol-ui-runtime-ready", schedule);
    doc.removeEventListener("click", onClick, true);
    window.removeEventListener("resize", schedule);
    try {
      if (window.jQuery) { window.jQuery(doc).off(":passageend", onPassage); }
    } catch (e) { /* ignore */ }
  }

  function destroy() {
    state.disposed = true;
    unbind();
    clearMarks();
    restoreOverlay();
    if (state.entry && state.entry.parentNode) { state.entry.parentNode.removeChild(state.entry); }
    doc.documentElement.setAttribute(ATTR, "off");
  }

  function mount() {
    if (state.mounted) { return; }
    state.settings = readSettings();
    state.lang = C.pickLang(state.settings.lang, navigator.language || "zh");
    state.mounted = true;
    bind();
    apply();
  }

  window.MapleLanternNative = {
    __mounted: true,
    version: C.VERSION,
    refresh: schedule,
    apply: apply,
    destroy: destroy
  };

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", function () { mount(); }, { once: true });
    setTimeout(function () { if (!state.mounted) { mount(); } }, 400);
  } else {
    mount();
  }
})();
