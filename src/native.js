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
    doc.documentElement.setAttribute("data-ml-theme", theme === "auto" ? "cyberpunk" : theme);
  }

  /* --------------------------------------------------------- #stats 四格 */

  function markCaptionAnchor() {
    var bar = doc.getElementById("ui-bar");
    var img = doc.getElementById("img");
    var caption = doc.getElementById("storyCaptionDiv");
    if (!bar || !img || !caption || !doc.body || !doc.body.classList.contains("has-images")) {
      return;
    }
    var barTop = bar.getBoundingClientRect().top;
    var imgBottom = img.getBoundingClientRect().bottom;
    if (!isFinite(barTop) || !isFinite(imgBottom) || imgBottom <= barTop) { return; }
    var top = Math.round(imgBottom - barTop);
    doc.documentElement.style.setProperty("--ml-caption-top", Math.max(0, top) + "px");
  }

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
    var source = (card.getAttribute("title") || "").trim();
    if (!source) { return ""; }
    /* 原版英文 title 是 "Pain: 0.00"；中文/本地化版本可能是「疼痛：0.00」。
       只认冒号后的数字，避免把整段说明当作值。 */
    var match = source.match(/[:：]\s*(-?\d+(?:\.\d+)?)/);
    if (!match) { match = source.match(/(-?\d+(?:\.\d+)?)/); }
    return match ? match[1] : "";
  }

  function compactStatNumber(raw) {
    var n = Number(raw);
    if (!isFinite(n)) { return ""; }
    return String(Math.round(n * 100) / 100);
  }

  /* 原版 title 只有当前值；上限从 State.variables 的 *max 读取（只读）。
     pain 固定 100，tiredness 固定 2000，allure 由游戏 clamp 到 8000。 */
  var STAT_MAX = {
    pain: 100,
    arousal: 10000,
    tiredness: 2000,
    stress: 10000,
    trauma: 5000,
    control: 1000,
    willpower: 1000,
    allure: 8000
  };

  function readStatMax(key) {
    var fallback = STAT_MAX[key] || 0;
    try {
      var vars = gameVars();
      if (!vars) { return fallback; }
      if (key === "arousal") { return Number(vars.arousalmax) || fallback; }
      if (key === "stress") { return Number(vars.stressmax) || fallback; }
      if (key === "trauma") { return Number(vars.traumamax) || fallback; }
      if (key === "control") { return Number(vars.controlmax) || fallback; }
      if (key === "willpower") { return Number(vars.willpowermax) || fallback; }
    } catch (e) {}
    return fallback;
  }

  function gameVars() {
    var state = window.State ||
      (window.SugarCube && window.SugarCube.State) || null;
    return state && state.variables;
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
      var max = readStatMax(key);
      card.setAttribute("data-ml-stat-card", "1");
      card.setAttribute("data-ml-stat-key", key);
      card.removeAttribute("data-ml-value");
      card.removeAttribute("data-ml-current");
      card.removeAttribute("data-ml-percent");
      card.removeAttribute("data-ml-total");
      card.removeAttribute("data-ml-readout");
      if (value) {
        var current = compactStatNumber(value) || value;
        var readout = "";
        if (max) {
          readout = current + "/" + max;
          card.setAttribute("data-ml-total", String(max));
        } else if (pct !== null) {
          readout = current + " · " + pct + "%";
        }
        card.setAttribute("data-ml-value", pct === null ? value : (value + " · " + pct + "%"));
        card.setAttribute("data-ml-current", current);
        card.setAttribute("data-ml-percent", pct === null ? "" : (pct + "%"));
        if (readout) { card.setAttribute("data-ml-readout", readout); }
      }
    }
  }

  /* 32px 左轨：原版每格只有字母/圆点；补一条只读百分比小条。
     顺序即原版 #mobileStats 的固定 7 项；不写变量、不换标签。 */
  var RAIL_KEYS = ["pain", "arousal", "tiredness", "stress", "trauma", "control", "allure"];

  function markRailMeters() {
    var rail = doc.getElementById("mobileStats");
    if (!rail) { return; }
    var stats = rail.querySelectorAll(".stat");
    var index = 0;
    for (var i = 0; i < stats.length; i++) {
      var node = stats[i];
      if (node.classList.contains("time")) { continue; }
      var key = RAIL_KEYS[index] || "";
      index++;
      node.removeAttribute("data-ml-rail-key");
      node.removeAttribute("data-ml-rail-pct");
      node.style.removeProperty("--ml-rail-pct");
      if (!key) { continue; }
      var value = 0;
      try {
        var vars = gameVars();
        value = Number(vars && vars[key]);
        if (!isFinite(value)) { value = 0; }
      } catch (e) { value = 0; }
      var max = readStatMax(key) || STAT_MAX[key] || 0;
      var pct = max ? Math.max(0, Math.min(100, Math.round(value / max * 100))) : 0;
      node.setAttribute("data-ml-rail-key", key);
      node.setAttribute("data-ml-rail-pct", String(pct));
      node.style.setProperty("--ml-rail-pct", pct + "%");
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
    var toolKeys = {
      "filters-button": "shop.filters",
      "clothingshop-options-button": "shop.options",
      "shop-legend-button": "shop.legend"
    };
    for (var i = 0; i < tools.length; i++) {
      var cls = tools[i].className || "";
      var key = Object.keys(toolKeys).filter(function (k) { return cls.indexOf(k) !== -1; })[0];
      var original = (tools[i].textContent || "").trim();
      var fallback = key ? (C.strings(state.lang)[toolKeys[key]] || "") : "";
      var labelText = original || fallback;
      /* 中文环境下，原版这三个按钮仍写死英文（Filters / Opt. / Legend）；只换这三个已知词，已本地化的原文保持不动。 */
      if (state.lang === "zh" && /^(filters?|opt\.?|options?|legend)$/i.test(original)) { labelText = fallback; }
      tools[i].setAttribute("data-ml-tool", key || "");
      tools[i].classList.add("ml-shop-tool");
      tools[i].textContent = "";
      var span = doc.createElement("span");
      span.className = "ml-shop-tool-label";
      span.textContent = labelText;
      tools[i].appendChild(span);
      bar.appendChild(tools[i]);
    }
  }

  /* 原版正文用连续 <br> 做空行；选项之间因此出现大段空白。只折叠连续空行，
     并去掉正文起始的空行，保留段落之间的一行间距。 */
  function collapseBreaks(root) {
    var passages = root.querySelectorAll("#passages .passage");
    for (var i = 0; i < passages.length; i++) {
      var passage = passages[i];
      var first = passage.firstChild;
      while (first) {
        if (first.nodeType === 3 && !(first.nodeValue || "").trim()) {
          first = first.nextSibling;
          continue;
        }
        if (first.nodeType === 1 && first.tagName === "BR") {
          var next = first.nextSibling;
          passage.removeChild(first);
          first = next;
          continue;
        }
        break;
      }
      var brs = passage.querySelectorAll("br");
      for (var j = brs.length - 1; j >= 0; j--) {
        var br = brs[j];
        var prev = br.previousSibling;
        while (prev && prev.nodeType === 3 && !(prev.nodeValue || "").trim()) {
          prev = prev.previousSibling;
        }
        var next = br.nextSibling;
        while (next && next.nodeType === 3 && !(next.nodeValue || "").trim()) {
          next = next.nextSibling;
        }
        if (prev && prev.nodeType === 1 && prev.tagName === "BR") {
          br.parentNode.removeChild(br);
          continue;
        }
        /* 选项前那一行空 br 会把卡片推得太远；选项自身已有 5px 间距。 */
        if (next && next.nodeType === 1 && next.tagName === "A" &&
            (next.classList.contains("macro-link") || next.classList.contains("link-internal"))) {
          br.parentNode.removeChild(br);
        }
      }
    }
  }

  /* 图标与选项在原版里是相邻节点；包成一组后，图标才能进入同一张卡左侧，
     而不是独占一行把选项推远。除直接兄弟外，兼容「<span>包裹选项」的本地化
     结构：只在该包裹层仅含这一个链接时搬家，避免误包内层页。 */
  function packIconOptions(root) {
    function blank(node) {
      return node && node.nodeType === 3 && !(node.nodeValue || "").trim();
    }
    function iconBefore(node) {
      var prev = node.previousSibling;
      while (prev && (blank(prev) || (prev.nodeType === 1 && prev.tagName === "BR"))) {
        prev = prev.previousSibling;
      }
      return prev && prev.nodeType === 1 && prev.tagName === "IMG" &&
        prev.classList.contains("icon") ? prev : null;
    }
    function onlyLink(holder, link) {
      for (var c = holder.firstChild; c; c = c.nextSibling) {
        if (c === link) { continue; }
        if (blank(c) || (c.nodeType === 1 && c.tagName === "BR")) { continue; }
        return false;
      }
      return true;
    }
    var passages = root.querySelectorAll("#passages .passage");
    for (var i = 0; i < passages.length; i++) {
      var passage = passages[i];
      var links = passage.querySelectorAll("a.link-internal.macro-link, a.macro-link");
      for (var j = 0; j < links.length; j++) {
        var link = links[j];
        var inGroup = false;
        for (var p = link.parentNode; p && p !== passage; p = p.parentNode) {
          if (p.getAttribute && p.getAttribute("data-ml-option-group")) { inGroup = true; break; }
        }
        if (inGroup) { continue; }

        var holder = link.parentNode;
        var icon = null;
        var moveHolder = false;
        if (holder === passage) {
          icon = iconBefore(link);
        } else if (holder && holder.nodeType === 1 && onlyLink(holder, link)) {
          icon = iconBefore(holder);
          if (icon) { moveHolder = true; }
        }
        if (!icon) { continue; }

        var wrap = doc.createElement("div");
        wrap.className = "ml-option-group";
        wrap.setAttribute("data-ml-option-group", "1");
        icon.parentNode.insertBefore(wrap, icon);
        wrap.appendChild(icon);
        wrap.appendChild(link);
        if (moveHolder && holder.parentNode && !(holder.textContent || "").trim()) {
          holder.parentNode.removeChild(holder);
        }
        /* 图标与选项之间原来的换行若因包裹层留下，会变成卡片后的空行。 */
        var after = wrap.nextSibling;
        while (after && blank(after)) { after = after.nextSibling; }
        if (after && after.nodeType === 1 && after.tagName === "BR") {
          after.parentNode.removeChild(after);
        }
        /* 图标前的空行会把整组再推远一行，直接摘掉。 */
        var prev = wrap.previousSibling;
        while (prev) {
          if (prev.nodeType === 3 && !(prev.nodeValue || "").trim()) {
            prev = prev.previousSibling;
            continue;
          }
          if (prev.nodeType === 1 && prev.tagName === "BR") {
            var gone = prev;
            prev = prev.previousSibling;
            gone.parentNode.removeChild(gone);
            continue;
          }
          break;
        }
      }
    }
  }

  function unpackOptions() {
    var groups = doc.querySelectorAll("[data-ml-option-group]");
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      var parent = group.parentNode;
      if (!parent) { continue; }
      while (group.firstChild) { parent.insertBefore(group.firstChild, group); }
      parent.removeChild(group);
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
    collapseBreaks(passages);
    packIconOptions(passages);
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

  /* 空存档槽在原版里仍保留两个 &nbsp; 详情行和一行按钮，卡片化后会留下
     一整块空白。只读地标出空槽，由 CSS 压成单行；不碰任何按钮与存档数据。 */
  function markSaveRows() {
    var rows = doc.querySelectorAll("#saves-list-container .savesListRow, #savesListContainer .savesListRow");
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var nameNode = row.querySelector(".saveName");
      var detailNode = row.querySelector(".saveDetails");
      var name = nameNode ? (nameNode.textContent || "").replace(/\u00a0/g, " ").trim() : "";
      var details = detailNode ? (detailNode.textContent || "").replace(/\u00a0/g, " ").trim() : "";
      if (!name && !details) { row.setAttribute("data-ml-save-empty", "1"); }
      else { row.removeAttribute("data-ml-save-empty"); }
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
      b.style.setProperty("font-size", "10px", "important");
      b.style.setProperty("letter-spacing", "-0.02em", "important");
    }
  }

  function clearMarks() {
    restoreFeatsIntro();
    unpackOptions();
    doc.documentElement.style.removeProperty("--ml-caption-top");
    var marked = doc.querySelectorAll("[data-ml-chip], [data-ml-stat-card], [data-ml-option], [data-ml-statmeters], [data-ml-dialog], [data-ml-overlay], [data-ml-save-empty]");
    for (var i = 0; i < marked.length; i++) {
      marked[i].removeAttribute("data-ml-chip");
      marked[i].removeAttribute("data-ml-stat-card");
      marked[i].removeAttribute("data-ml-stat-key");
      marked[i].removeAttribute("data-ml-value");
      marked[i].removeAttribute("data-ml-current");
      marked[i].removeAttribute("data-ml-percent");
      marked[i].removeAttribute("data-ml-total");
      marked[i].removeAttribute("data-ml-readout");
      marked[i].removeAttribute("data-ml-option");
      marked[i].removeAttribute("data-ml-statmeters");
      marked[i].removeAttribute("data-ml-dialog");
      marked[i].removeAttribute("data-ml-overlay");
      marked[i].removeAttribute("data-ml-save-empty");
    }
    var railStats = doc.querySelectorAll("#mobileStats .stat");
    for (var r = 0; r < railStats.length; r++) {
      railStats[r].removeAttribute("data-ml-rail-key");
      railStats[r].removeAttribute("data-ml-rail-pct");
      railStats[r].style.removeProperty("--ml-rail-pct");
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
    markCaptionAnchor();
    markStats();
    markStatmeters();
    markRailMeters();
    markPassages();
    markOverlay();
    markSaveRows();
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
