/* ============================================================================
 * 灯台 · MapleLantern — maplelantern-native.js（原版 UI 展示投影层）
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
    overlayHome: null,
    packObserver: null,
    overlayObserver: null,
    sweep: null,
    packTimer: null,
    packChanged: false,
    packStable: false,
    packAnchor: null,
    stableTicks: 0,
    ceDirty: true,
    ceReady: false,
    ceSig: "",
    perf: { applies: 0, sweeps: 0, ceNorm: 0, packs: 0, writes: 0, writesSaved: 0 }
  };

  /* 同值写入会触发样式失效/观察记录；先比对再写，稳定页可省掉绝大多数
     attribute 变更（CE 参考的“缓存 + 只做增量”同思路）。 */
  function setAttr(el, name, value) {
    if (!el || !el.getAttribute) { return; }
    var next = value === null || value === undefined ? null : String(value);
    if (el.getAttribute(name) === next) { state.perf.writesSaved++; return; }
    if (next === null) { el.removeAttribute(name); } else { el.setAttribute(name, next); }
    state.perf.writes++;
  }

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
    var top = Math.max(0, Math.round(imgBottom - barTop)) + "px";
    var root = doc.documentElement;
    if (root.style.getPropertyValue("--ml-caption-top") !== top) {
      root.style.setProperty("--ml-caption-top", top);
      state.perf.writes++;
    } else { state.perf.writesSaved++; }
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
      if (kind) { setAttr(node, "data-ml-chip", kind); }
      else { setAttr(node, "data-ml-chip", null); }
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
    setAttr(host, "data-ml-statmeters", "1");
    var cards = host.querySelectorAll('div[id$="caption"]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var key = card.id.replace(/caption$/, "");
      var value = parseStatValue(card);
      var pct = readPercent(card);
      var max = readStatMax(key);
      setAttr(card, "data-ml-stat-card", "1");
      setAttr(card, "data-ml-stat-key", key);
      var current = "";
      var readout = "";
      var display = "";
      var percent = "";
      var total = null;
      if (value) {
        current = compactStatNumber(value) || value;
        if (max) {
          readout = current + "/" + max;
          total = String(max);
        } else if (pct !== null) {
          readout = current + " · " + pct + "%";
        }
        display = pct === null ? value : (value + " · " + pct + "%");
        percent = pct === null ? "" : (pct + "%");
      }
      setAttr(card, "data-ml-value", display || null);
      setAttr(card, "data-ml-current", current || null);
      setAttr(card, "data-ml-percent", value ? percent : null);
      setAttr(card, "data-ml-total", total);
      setAttr(card, "data-ml-readout", readout || null);
    }
  }

  /* 32px 左轨：原版每格只有字母/圆点；补一条只读百分比小条。
     顺序即原版 #mobileStats 的固定 7 项；不写变量、不换标签。 */
  var RAIL_KEYS = ["pain", "arousal", "tiredness", "stress", "trauma", "control", "allure"];

  function markRailMeters() {
    var rail = doc.getElementById("mobileStats");
    if (!rail) { return; }
    var stats = rail.querySelectorAll(".stat");
    var vars = null;
    try { vars = gameVars(); } catch (e) { vars = null; }
    var index = 0;
    for (var i = 0; i < stats.length; i++) {
      var node = stats[i];
      if (node.classList.contains("time")) { continue; }
      var key = RAIL_KEYS[index] || "";
      index++;
      if (!key) {
        setAttr(node, "data-ml-rail-key", null);
        setAttr(node, "data-ml-rail-pct", null);
        if (node.style.getPropertyValue("--ml-rail-pct")) {
          node.style.removeProperty("--ml-rail-pct");
          state.perf.writes++;
        }
        continue;
      }
      var value = Number(vars && vars[key]);
      if (!isFinite(value)) { value = 0; }
      var max = readStatMax(key) || STAT_MAX[key] || 0;
      var pct = max ? Math.max(0, Math.min(100, Math.round(value / max * 100))) : 0;
      setAttr(node, "data-ml-rail-key", key);
      setAttr(node, "data-ml-rail-pct", pct);
      var css = pct + "%";
      if (node.style.getPropertyValue("--ml-rail-pct") !== css) {
        node.style.setProperty("--ml-rail-pct", css);
        state.perf.writes++;
      } else { state.perf.writesSaved++; }
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
     而不是独占一行把选项推远。兼容真实游戏里的多种结构：
     1) 直属兄弟：<img class="icon"><br><a class="macro-link">；
     2) 同一容器内：<div><img class="icon"><br><a class="macro-link"></div>；
     3) 图标容器：<span class="water-outdoor-night"><img class="icon"></span><a>；
     4) 本地化只包链接：<img class="icon"><span><a class="macro-link"></a></span>。
     只在该容器只含这一个链接（和它的图标）时搬家，避免误包内层页。 */
  function packIconOptions(root) {
    function blank(node) {
      return node && node.nodeType === 3 && !(node.nodeValue || "").trim();
    }
    /* 本土化包裹可能插进 <span class="...">（空壳、无图无字）再放链接；
       这类空壳不能挡住“图标就在链接前面”的判断。 */
    function emptyShell(node) {
      if (!node || node.nodeType !== 1) { return false; }
      if (node.classList && (node.classList.contains("icon") || node.classList.contains("icon-container"))) { return false; }
      if (node.tagName === "IMG") { return false; }
      if ((node.textContent || "").trim()) { return false; }
      if (node.querySelector && node.querySelector("img.icon, .icon")) { return false; }
      return true;
    }
    function iconImage(node) {
      if (!node || node.nodeType !== 1) { return null; }
      if (node.tagName === "IMG" && node.classList.contains("icon")) { return node; }
      /* DoL 原生地点图标不一定是 img：常见形态是
         <span class="icon-container"><span class="icon swim"></span></span>，
         背景图挂在内层 .icon 上。必须把整个容器搬进卡，否则外层绝对定位
         会让图标留在卡外上方。 */
      if (node.classList.contains("icon-container")) {
        if ((node.textContent || "").trim()) { return null; }
        if (node.querySelector("img.icon, .icon")) { return node; }
        return null;
      }
      if (node.classList.contains("icon")) {
        if ((node.textContent || "").trim()) { return null; }
        return node;
      }
      /* 地点/场景图标常被包在只含一个 img.icon 的 span 里；
         有文字就不是纯图标容器，不能当图标搬走。 */
      if ((node.textContent || "").trim()) { return null; }
      var imgs = node.querySelectorAll("img.icon");
      if (!imgs.length) { return null; }
      if (imgs.length === 1) { return imgs[0]; }
      /* 真实存档可能叠着「不可见的 icon-container 图标」和「可见的场景底图」；
         不能因为数量 >1 就整组放弃，否则页面会留下卡外图标。优先按实际绘制
         面积选；图片尚未解码、全部 0×0 时按 naturalWidth 与所在装饰壳判断，
         避免把 icon-container 里 0×0 的隐藏图标搬进卡、把真正可见的场景图留在卡外。 */
      var best = imgs[imgs.length - 1];
      var bestScore = -Infinity;
      for (var k = 0; k < imgs.length; k++) {
        var img = imgs[k];
        var r = img.getBoundingClientRect ? img.getBoundingClientRect() : null;
        var rectArea = r && r.width && r.height ? r.width * r.height : 0;
        var natural = (img.naturalWidth || 0) * (img.naturalHeight || 0);
        var hiddenShell = img.closest && img.closest(".icon-container") ? 1 : 0;
        var score = rectArea * 1000 + natural - hiddenShell * 1000000;
        if (score > bestScore) { bestScore = score; best = img; }
      }
      return best;
    }
    function iconBefore(node) {
      var prev = node.previousSibling;
      while (prev && (blank(prev) || (prev.nodeType === 1 && prev.tagName === "BR") ||
             emptyShell(prev))) {
        prev = prev.previousSibling;
      }
      return iconImage(prev);
    }
    function outerIcon(icon, stop) {
      var node = icon;
      while (node.parentNode && node.parentNode !== stop) { node = node.parentNode; }
      return node;
    }
    function onlyLink(holder, link, icon) {
      for (var c = holder.firstChild; c; c = c.nextSibling) {
        if (c === link || c === icon) { continue; }
        if (blank(c) || (c.nodeType === 1 && c.tagName === "BR")) { continue; }
        /* 空图标壳/纯装饰 span 不构成“第二个内容节点”，否则
           <div><span class=icon-container><img></span><a> 会被整组跳过。 */
        if (c.nodeType === 1 && decorativeShell(c)) { continue; }
        return false;
      }
      return true;
    }
    function decorativeShell(node) {
      if (!node || node.nodeType !== 1) { return false; }
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (blank(c) || (c.nodeType === 1 && c.tagName === "BR")) { continue; }
        if (c.nodeType === 1 && decorativeShell(c)) { continue; }
        return false;
      }
      return true;
    }
    /* 本地化/替换型模组可能在 passageend 之后重建链接，且不一定保留
       macro-link 类名；把 link-internal 也纳入候选，才不至于在 Android 上
       只剩图标留在卡外。没有图标的行内链接会在下面因 icon 为空直接跳过。 */
    function optionLinks(passage) {
      return passage.querySelectorAll("a.link-internal.macro-link, a.macro-link, a.link-internal");
    }
    function linkNode(node) {
      if (!node || node.nodeType !== 1) { return null; }
      if (node.tagName === "A" && node.classList &&
          (node.classList.contains("link-internal") || node.classList.contains("macro-link"))) {
        return node;
      }
      return null;
    }
    /* 图标已进组、链接被重建到组外时，把紧随其后的新链接接回该组，
       避免“图标一张空卡、选项一张卡”的 Android 现象。 */
    function repairGroups(passage) {
      var groups = passage.querySelectorAll(".ml-option-group");
      for (var g = 0; g < groups.length; g++) {
        var group = groups[g];
        if (group.querySelector("a.link-internal, a.macro-link")) { continue; }
        var next = group.nextSibling;
        while (next && (blank(next) || (next.nodeType === 1 && next.tagName === "BR"))) {
          next = next.nextSibling;
        }
        var direct = linkNode(next);
        var holder = null;
        var heldLink = null;
        if (!direct && next && next.nodeType === 1) {
          var linksInNext = next.querySelectorAll("a.link-internal, a.macro-link");
          if (linksInNext.length === 1 &&
              (next.textContent || "").trim() === (linksInNext[0].textContent || "").trim()) {
            holder = next;
            heldLink = linksInNext[0];
            direct = heldLink;
          }
        }
        if (!direct) { continue; }
        if (holder && heldLink) {
          group.appendChild(heldLink);
          if (holder.parentNode && !(holder.textContent || "").trim() && !holder.querySelector("img")) {
            holder.parentNode.removeChild(holder);
          }
        } else {
          group.appendChild(direct);
        }
        var after = group.nextSibling;
        while (after && (blank(after) || (after.nodeType === 1 && after.tagName === "BR"))) {
          var dead = after;
          after = after.nextSibling;
          if (dead.parentNode) { dead.parentNode.removeChild(dead); }
        }
      }
    }
    /* 汉化/宿主把图标与链接拆到同一层、但中间多了空壳包裹时，向前回溯会失败。
       这里从图标向后找最近的一个选项链接，把它接进同一张卡；已被别的卡收走
       的链接跳过，避免同一个选项出现两张卡。 */
    function adoptOrphanIcons(passage) {
      var icons = passage.querySelectorAll("img.icon, .icon-container");
      var list = [];
      for (var i = 0; i < icons.length; i++) {
        var n = icons[i];
        if (n.closest && n.closest(".ml-option-group")) { continue; }
        if (n.parentNode && n.parentNode.closest && n.parentNode.closest(".icon-container")) { continue; }
        list.push(n);
      }
      for (var k = 0; k < list.length; k++) {
        var icon = list[k];
        if (icon.closest && icon.closest(".ml-option-group")) { continue; }
        if (!icon.parentNode) { continue; }
        var next = icon.nextSibling;
        var link = null;
        for (var s = 0; next && s < 6; s++) {
          if (next.nodeType === 1 && next.tagName === "A" && linkNode(next)) { link = next; break; }
          if (next.nodeType === 3 && next.nodeValue && next.nodeValue.trim()) { break; }
          if (next.nodeType === 1 && next.tagName !== "BR" && !emptyShell(next)) { break; }
          next = next.nextSibling;
        }
        if (!link) { continue; }
        if (link.closest && link.closest(".ml-option-group")) { continue; }
        var wrap = doc.createElement("div");
        wrap.className = "ml-option-group";
        wrap.setAttribute("data-ml-option-group", "1");
        icon.parentNode.insertBefore(wrap, icon);
        wrap.appendChild(icon);
        wrap.appendChild(link);
        /* 空 <p>/<div> 会把 3px 的组间距重新撑成一大段；但含图标的段落不能删。 */
        var emptyBlock = function (n) {
          return n && n.nodeType === 1 && /^(P|DIV|SPAN)$/.test(n.tagName) &&
            !(n.textContent || "").trim() &&
            !(n.querySelector && n.querySelector("img.icon, .icon-container, a.link-internal, a.macro-link"));
        };
        var before = wrap.previousSibling;
        while (before && (blank(before) || (before.nodeType === 1 && before.tagName === "BR") || emptyBlock(before))) {
          var dead = before;
          before = before.previousSibling;
          if (dead.parentNode) { dead.parentNode.removeChild(dead); }
        }
        var after = wrap.nextSibling;
        while (after && (blank(after) || (after.nodeType === 1 && after.tagName === "BR") || emptyBlock(after))) {
          var deadAfter = after;
          after = after.nextSibling;
          if (deadAfter.parentNode) { deadAfter.parentNode.removeChild(deadAfter); }
        }
      }
    }
    /* 正常分组路径不会经过 adoptOrphanIcons，组旁的空 <p>/<br> 仍会把 3px
       间距撑回一大段。统一在每页收尾时清一遍，含图标的段落不动。 */
    function tidyGroupGaps(passage) {
      var emptyBlock = function (n) {
        return n && n.nodeType === 1 && /^(P|DIV|SPAN)$/.test(n.tagName) &&
          !(n.textContent || "").trim() &&
          !(n.querySelector && n.querySelector("img.icon, .icon-container, a.link-internal, a.macro-link"));
      };
      var groups = passage.querySelectorAll(".ml-option-group");
      for (var i = 0; i < groups.length; i++) {
        var group = groups[i];
        var prev = group.previousSibling;
        while (prev && (blank(prev) || (prev.nodeType === 1 && prev.tagName === "BR") || emptyBlock(prev))) {
          var deadPrev = prev;
          prev = prev.previousSibling;
          if (deadPrev.parentNode) { deadPrev.parentNode.removeChild(deadPrev); }
        }
        var next = group.nextSibling;
        while (next && (blank(next) || (next.nodeType === 1 && next.tagName === "BR") || emptyBlock(next))) {
          var deadNext = next;
          next = next.nextSibling;
          if (deadNext.parentNode) { deadNext.parentNode.removeChild(deadNext); }
        }
      }
    }
    var passages = root.querySelectorAll("#passages .passage");
    for (var i = 0; i < passages.length; i++) {
      var passage = passages[i];
      var links = optionLinks(passage);
      for (var j = 0; j < links.length; j++) {
        var link = links[j];
        try {
        var inGroup = false;
        for (var p = link.parentNode; p && p !== passage; p = p.parentNode) {
          if (p.getAttribute && p.getAttribute("data-ml-option-group")) { inGroup = true; break; }
        }
        if (inGroup) { continue; }

        var holder = link.parentNode;
        var icon = iconBefore(link);
        var iconOuter = null;
        var iconInHolder = false;
        if (icon && holder && holder.contains && holder.contains(icon)) {
          iconInHolder = true;
          iconOuter = outerIcon(icon, holder);
        }
        if (!icon && holder !== passage && holder && holder.nodeType === 1 &&
            onlyLink(holder, link, null)) {
          icon = iconBefore(holder);
          if (icon) {
            var boundary = holder.parentNode || passage;
            iconOuter = outerIcon(icon, boundary);
          }
        }
        if (!icon) { continue; }
        if (holder !== passage &&
            !onlyLink(holder, link, iconInHolder ? iconOuter : null)) { continue; }

        var outer = iconOuter || icon;
        if (!outer.parentNode) { continue; }
        var wrap = doc.createElement("div");
        wrap.className = "ml-option-group";
        wrap.setAttribute("data-ml-option-group", "1");
        outer.parentNode.insertBefore(wrap, outer);
        wrap.appendChild(icon);
        wrap.appendChild(link);
        /* 真实 Lake Shore 会在同一个选项前叠两层：icon-container（选项图标）
           与 water-outdoor-night（场景底图）。已把可见的场景图标搬进卡后，
           紧邻的空 icon-container 只会在原位留一个 0×0 绝对定位壳，摘掉。 */
        var prior = wrap.previousSibling;
        while (prior && (blank(prior) || (prior.nodeType === 1 && prior.tagName === "BR"))) {
          prior = prior.previousSibling;
        }
        if (prior && prior.nodeType === 1 && prior.classList.contains("icon-container") &&
            !(prior.textContent || "").trim() && prior.parentNode) {
          prior.parentNode.removeChild(prior);
        }
        /* 图标原来包在装饰层里时，搬走 img 后只剩空壳（可能还嵌着空 span），
           一并摘掉，避免绝对定位的空容器继续占位或留下虚线框。 */
        if (outer !== icon && outer.parentNode && decorativeShell(outer)) {
          outer.parentNode.removeChild(outer);
        }
        /* 同容器结构：图标和链接移走后，容器只剩 <br>/空白。把卡片提到
           容器原来的位置并摘掉容器，否则外层容器仍会占一行。 */
        if (holder !== passage && holder.parentNode) {
          var holderParent = holder.parentNode;
          holderParent.insertBefore(wrap, holder);
          holderParent.removeChild(holder);
        }
        /* 选项卡片之间、以及卡后奖励行之间的连续空行，全部收掉；
           卡片自带 margin，不再靠 <br> 撑距离。 */
        var after = wrap.nextSibling;
        while (after) {
          if (blank(after)) {
            var blankNode = after;
            after = after.nextSibling;
            if (blankNode.parentNode) { blankNode.parentNode.removeChild(blankNode); }
            continue;
          }
          if (after.nodeType === 1 && after.tagName === "BR") {
            var brNode = after;
            after = after.nextSibling;
            if (brNode.parentNode) { brNode.parentNode.removeChild(brNode); }
            continue;
          }
          break;
        }
        /* 图标前的空行会把整组再推远一行，直接摘掉。 */
        var prev = wrap.previousSibling;
        while (prev) {
          if (prev.nodeType === 3 && !(prev.nodeValue || "").trim()) {
            var spaceNode = prev;
            prev = prev.previousSibling;
            if (spaceNode.parentNode) { spaceNode.parentNode.removeChild(spaceNode); }
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
        } catch (err) { /* 单个选项结构异常时跳过它，不能让整页选项都留在卡外 */ }
      }
      repairGroups(passage);
      adoptOrphanIcons(passage);
      tidyGroupGaps(passage);
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

  /* CheatExtended 的面板不是本包渲染的，class/层级会随 fork 变化，不能靠
     :has() 或固定 class 名做约束（Android WebView 可能整条丢弃 :has()）。
     这里在面板打开时直接写 inline !important：先保证不超视口，再把页签收成
     单行、把两列网格收成一列、把状态条两侧的巨大箭头压回 34px。 */
  /* 只认“面板结构”信号：页签数量、当前选中页、内容控件数。inline 样式写入
     也会触发 attribute 观察，但它不改变这些数，不能算脏。 */
  function ceStructureSig() {
    var tabs = doc.getElementById("cheat_extended_options");
    if (!tabs) { return ""; }
    var content = doc.getElementById("customOverlayContent");
    var selected = findCeSelectedTab(tabs);
    return [
      tabs.childElementCount,
      tabs.querySelectorAll("button").length,
      selected ? (selected.textContent || "").trim() : "",
      content ? content.childElementCount : -1,
      content ? content.querySelectorAll("button, input, select").length : -1,
      content ? (content.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60) : ""
    ].join("|");
  }

  function isCeIconNode(node) {
    if (!node || node.nodeType !== 1) { return false; }
    if (node.tagName === "IMG") { return true; }
    try {
      if (node.classList && node.classList.contains("icon-container")) { return true; }
    } catch (e) { /* classList 异常时按普通节点处理 */ }
    return !!(node.querySelector && node.querySelector("img.icon"));
  }

  function isCeAnchorNode(node) {
    return !!(node && node.nodeType === 1 && node.tagName === "A");
  }

  function findCeSelectedTab(tabs) {
    if (!tabs) { return null; }
    var sel = tabs.querySelector(".CEtabSelected, .CEtabActive, .CEtabSel, .CEtabOn, [aria-selected=\"true\"], [data-selected=\"true\"]");
    if (sel) { return sel; }
    /* 选中态 class 可能挂在页签外层容器而不是按钮上；从 overlay 再找一次，
       但必须仍是 button，避免把内容区标题误当页签。 */
    var overlay = null;
    try { overlay = tabs.closest("#customOverlay"); } catch (e) { overlay = null; }
    if (overlay) {
      var marked = overlay.querySelector(".CEtabSelected, .CEtabActive, .CEtabSel, .CEtabOn");
      if (marked && marked.tagName === "BUTTON") { return marked; }
    }
    return null;
  }

  function normalizeCheatLayout() {
    var tabs = doc.getElementById("cheat_extended_options");
    if (!tabs) { state.ceReady = false; return; }
    /* CE 只在面板结构真的变了才重排：换页签/开关/尺寸变化由 dirty 标记驱动，
       正文换页的十几次 apply 不再重复扫 300 个元素。 */
    if (state.ceReady && !state.ceDirty) { return; }
    state.perf.ceNorm++;
    var overlay = null;
    try { overlay = tabs.closest("#customOverlay"); } catch (e) { overlay = null; }
    if (!overlay) { overlay = doc.getElementById("customOverlay"); }
    var content = doc.getElementById("customOverlayContent");
    var vw = doc.documentElement.clientWidth || window.innerWidth || 390;
    var imp = function (el, prop, val) {
      if (!el || !el.style) { return; }
      try { el.style.setProperty(prop, val, "important"); } catch (e) { /* 旧 WebView 忽略单条即可 */ }
    };
    var themeColor = function (name, fallback) {
      try {
        var v = window.getComputedStyle(doc.documentElement).getPropertyValue(name).trim();
        return v || fallback;
      } catch (e) { return fallback; }
    };
    var tint = function (hex, alpha) {
      var h = String(hex || "").replace(/^#/, "");
      if (h.length === 3) { h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2); }
      if (h.length !== 6) { return "rgba(5, 7, 15, " + alpha + ")"; }
      var r = parseInt(h.slice(0, 2), 16);
      var g = parseInt(h.slice(2, 4), 16);
      var b = parseInt(h.slice(4, 6), 16);
      return "rgba(" + r + ", " + g + ", " + b + ", " + alpha + ")";
    };
    if (vw <= 899) {
      imp(overlay, "width", "auto");
      imp(overlay, "max-width", "calc(100vw - 16px)");
      imp(overlay, "box-sizing", "border-box");
      imp(overlay, "overflow-x", "hidden");
      imp(content, "width", "auto");
      imp(content, "max-width", "100%");
      imp(content, "box-sizing", "border-box");
      imp(content, "overflow-x", "hidden");
      imp(tabs, "width", "100%");
      imp(tabs, "max-width", "100%");
      imp(tabs, "box-sizing", "border-box");
    }
    /* 一部分 Android WebView 不支持 color-mix()，CSS 里的半透明会整条失效；
       这里用主题 --mln-bg / --mln-surface 算成 rgba 直接写 inline。 */
    var bg = themeColor("--mln-bg", "#0B0D10");
    var surface = themeColor("--mln-surface", "#12161B");
    if (overlay) {
      imp(overlay, "background-color", tint(bg, 0.60));
      imp(overlay, "background-image", "var(--mln-page-texture)");
      imp(overlay, "background-size", "cover");
      imp(overlay, "background-repeat", "no-repeat");
      imp(overlay, "background-attachment", "fixed");
    }
    if (content) {
      imp(content, "background-color", tint(surface, 0.64));
      imp(content, "background-image", "var(--mln-page-texture), var(--mln-surface-texture)");
      imp(content, "background-size", "cover");
      imp(content, "background-repeat", "no-repeat");
      imp(content, "background-attachment", "fixed");
    }
    imp(tabs, "flex-wrap", "nowrap");
    imp(tabs, "overflow-x", "auto");
    imp(tabs, "-webkit-overflow-scrolling", "touch");
    var twoLevel = !!(tabs.querySelector(".CE-category-bar, .CE-subtab-bar, .CE-category, .CE-subtab"));
    /* 1.20.4 的七页签改成 grid/固定列后仍会折成 5+2 两行。只设 flex-wrap 对
       grid 无效，必须同时把容器改回 flex；平铺页签用等分，两层页签用横滚。 */
    if (!twoLevel) {
      imp(tabs, "display", "flex");
      imp(tabs, "align-items", "stretch");
      imp(tabs, "gap", "6px");
    }
    var selectedTab = findCeSelectedTab(tabs);
    var selectedLabel = selectedTab ? (selectedTab.textContent || "").trim() : "";
    var isTeleport = selectedLabel.indexOf("传送") >= 0;
    if (overlay) {
      if (isTeleport) {
        overlay.setAttribute("data-mln-ce-page", "teleport");
      } else if (overlay.getAttribute("data-mln-ce-page") === "teleport") {
        overlay.removeAttribute("data-mln-ce-page");
      }
    }
    var tabButtons = tabs.querySelectorAll("button");
    for (var t = 0; t < tabButtons.length; t++) {
      var tb = tabButtons[t];
      tb.setAttribute("data-mln-tab", "1");
      imp(tb, "width", "auto");
      imp(tb, "min-width", "0");
      imp(tb, "max-width", "100%");
      imp(tb, "height", "34px");
      imp(tb, "min-height", "34px");
      imp(tb, "padding", "3px 5px");
      imp(tb, "font-size", "11px");
      imp(tb, "letter-spacing", "0");
      imp(tb, "text-indent", "0");
      imp(tb, "line-height", "1.2");
      imp(tb, "white-space", "nowrap");
      imp(tb, "border-radius", "8px");
      /* 旧版平铺页签等分一行；两层页签保留可横向滚动，不被压成省略号。 */
      imp(tb, "flex", twoLevel ? "0 0 auto" : "1 1 0");
    }
    /* CE 的关闭按钮绝对定位在右边缘，overlay 收窄后会被裁掉半个 ✖。 */
    var closeBtn = (content && content.querySelector(".CE-close-btn")) || tabs.querySelector(".CE-close-btn");
    /* 两层页签的第一行右端会被关闭按钮压住：给容器留出等宽内边距。 */
    var catBar = tabs.querySelector(".CE-category-bar");
    if (catBar) {
      /* padding-right 只加在滚动内容的尾部，不能阻止页签滚到关闭按钮下面。
         直接把分类栏收窄 36px，右侧留出真正的空白缺口。 */
      imp(catBar, "width", "calc(100% - 36px)");
      imp(catBar, "max-width", "calc(100% - 36px)");
      imp(catBar, "box-sizing", "border-box");
    }
    /* 单行页签必然有滚动余量，右边缘直接切断文字像“坏了”。加一层不吃事件的
       渐隐，提示还能横向滑，同时不遮关闭按钮。 */
    var barNodes = tabs.querySelectorAll(".CE-category-bar, .CE-subtab-bar, .CEbuttonBar");
    for (var f = 0; f < barNodes.length; f++) {
      var bar = barNodes[f];
      var oldFade = bar.querySelector(".mln-tab-fade");
      if (oldFade && oldFade.parentNode) { oldFade.parentNode.removeChild(oldFade); }
      if (bar.scrollWidth > bar.clientWidth + 2) {
        imp(bar, "position", "relative");
        var fade = doc.createElement("span");
        fade.className = "mln-tab-fade";
        fade.setAttribute("aria-hidden", "true");
        fade.style.cssText = "position:absolute;top:0;right:0;width:26px;height:100%;pointer-events:none;z-index:2;background:linear-gradient(90deg,rgba(5,8,19,0)," + tint(bg, 0.82) + ")";
        bar.appendChild(fade);
      }
    }
    if (closeBtn) {
      closeBtn.setAttribute("data-mln-close", "1");
      imp(closeBtn, "right", "6px");
      imp(closeBtn, "top", "5px");
      imp(closeBtn, "width", "28px");
      imp(closeBtn, "height", "28px");
      imp(closeBtn, "min-width", "28px");
      imp(closeBtn, "font-size", "14px");
      imp(closeBtn, "line-height", "1");
      imp(closeBtn, "padding", "0");
      imp(closeBtn, "z-index", "20");
    }
    /* 传送页的地点列表在 1.20.4 里是“按行内文本自然换行”的链接组：三项一行，
       行宽由文字长度决定，长地名贴到面板右缘、组间留大洞。这里只在该页把
       含三个以上地点链接的容器收成纵向列表，每个直接子项占满一行；不改
       页面级状态条，也不碰其它页签。 */
    if (isTeleport && content) {
      var locText = (content.textContent || "").replace(/\s+/g, " ");
      if (locText.indexOf("城镇地点") >= 0 || locText.indexOf("城镇街道") >= 0) {
        var locNodes = content.querySelectorAll("*");
        for (var ln = 0; ln < locNodes.length && ln < 300; ln++) {
          var loc = locNodes[ln];
          if (loc.children.length < 2) { continue; }
          if (loc.querySelector("input, select, textarea")) { continue; }
          var links = loc.querySelectorAll("a").length;
          if (links < 3) { continue; }
          /* 只收最内层列表：外层容器交给内层行自己排，避免把整个内容区
             改成 flex 后影响别的块级装饰。 */
          var hasInnerList = false;
          for (var lk = 0; lk < loc.children.length; lk++) {
            var kid = loc.children[lk];
            if (kid.children.length >= 2 && kid.querySelectorAll("a").length >= 3) {
              hasInnerList = true;
              break;
            }
          }
          if (hasInnerList) { continue; }
          /* 1.20.4 的地点是 `<<icon>><<link>>` 交替平铺：如果直接把每个直接
             子项都撑满一行，图标会和地名各占一行。先把相邻的「图标 + 链接」
             包成一行，剩下的标题/纯文本仍按原顺序保留。 */
          var pairKids = Array.prototype.slice.call(loc.children);
          for (var lp = 0; lp + 1 < pairKids.length; lp++) {
            var p1 = pairKids[lp];
            var p2 = pairKids[lp + 1];
            if (p1.parentNode !== loc || p2.parentNode !== loc) { continue; }
            var iconFirst = isCeIconNode(p1) && isCeAnchorNode(p2);
            var linkFirst = isCeAnchorNode(p1) && isCeIconNode(p2);
            if (!iconFirst && !linkFirst) { continue; }
            var row = doc.createElement("div");
            row.className = "mln-ce-loc-row";
            row.setAttribute("data-mln-ce-loc-row", "1");
            loc.insertBefore(row, p1);
            row.appendChild(p1);
            row.appendChild(p2);
            lp++;
          }
          imp(loc, "display", "flex");
          imp(loc, "flex-direction", "column");
          imp(loc, "align-items", "stretch");
          imp(loc, "gap", "6px");
          for (var lc = 0; lc < loc.children.length; lc++) {
            var lchild = loc.children[lc];
            if (isCeIconNode(lchild)) { continue; }
            imp(lchild, "width", "100%");
            imp(lchild, "max-width", "100%");
            imp(lchild, "flex", "0 0 auto");
            imp(lchild, "box-sizing", "border-box");
          }
        }
      }
    }
    var scope = content || overlay;
    if (!scope) { return; }
    var buttons = scope.querySelectorAll("button");
    for (var b = 0; b < buttons.length && b < 320; b++) {
      var btn = buttons[b];
      if (btn.getAttribute("data-mln-tab") || btn.getAttribute("data-mln-close")) { continue; }
      var label = (btn.textContent || "").trim();
      imp(btn, "min-height", "32px");
      imp(btn, "padding", "3px 7px");
      imp(btn, "font-size", "13px");
      imp(btn, "line-height", "1.2");
      /* 状态条的 ◀ ◀ ▶ ▶ 原本继承超大字号，按钮被撑成一整块。 */
      if (/^[<>‹›←→«»▲▼◀▶⏪⏩]+$/.test(label)) {
        imp(btn, "width", "34px");
        imp(btn, "min-width", "34px");
        imp(btn, "max-width", "34px");
        imp(btn, "height", "34px");
        imp(btn, "padding", "0");
        imp(btn, "font-size", "16px");
      }
    }
    /* 只把“页面级分栏”收成一列：格子里直接放两个按钮的是状态条本体，
       把它压成一列会把左右箭头叠到数值上方。 */
    var nodes = scope.querySelectorAll("*");
    for (var n = 0; n < nodes.length && n < 300; n++) {
      var el = nodes[n];
      if (el.tagName === "BUTTON") { continue; }
      /* CE 的内部容器常带固定宽度（实测 teleport 列表 598px，父容器只有
         374px）。不逐层收回 max-width，overlay 会把它裁在右边，箭头和地点
         就会“超出边框”。min-width:0 允许 flex/grid 子项真正压缩。 */
      imp(el, "max-width", "100%");
      imp(el, "min-width", "0");
      imp(el, "box-sizing", "border-box");
      imp(el, "overflow-wrap", "anywhere");
      /* 部分 CE 皮肤把状态条箭头做成 <div>/<span> 而不是 <button>，
         只用按钮规则会漏掉，箭头仍会撑成整格。只认“叶子节点 + 纯箭头文字”，
         带子元素的包裹层（文字同样是 ‹<）不会被误缩。 */
      if (!el.children.length && /^[<>‹›←→«»▲▼◀▶⏪⏩]+$/.test((el.textContent || "").trim())) {
        imp(el, "width", "34px");
        imp(el, "min-width", "34px");
        imp(el, "max-width", "34px");
        imp(el, "height", "34px");
        imp(el, "min-height", "34px");
        imp(el, "padding", "0");
        imp(el, "font-size", "16px");
        imp(el, "line-height", "34px");
        imp(el, "text-align", "center");
        imp(el, "flex", "0 0 auto");
      }
      var cs = null;
      try { cs = window.getComputedStyle(el); } catch (e) { cs = null; }
      if (!cs) { continue; }
      var directButtons = 0;
      for (var c = 0; c < el.children.length; c++) {
        if (el.children[c].tagName === "BUTTON") { directButtons++; }
      }
      /* 状态条也常是 grid/flex：里面一定有 ◀ ▶ 这类纯箭头按钮。
         只有“没有箭头按钮”的容器才是传送地点这类分栏列表，才收成一列；
         否则会把左右箭头叠到数值上方/下方。 */
      var arrowButton = false;
      var bs = el.querySelectorAll("button");
      for (var q = 0; q < bs.length && q < 24; q++) {
        if (/^[<>‹›←→«»▲▼◀▶⏪⏩]+$/.test((bs[q].textContent || "").trim())) { arrowButton = true; break; }
      }
      var display = cs.display || "";
      if (display.indexOf("grid") >= 0 && !arrowButton) {
        var cols = cs.gridTemplateColumns || "";
        if (cols && cols !== "none" && cols.split(" ").length > 1) {
          imp(el, "grid-template-columns", "minmax(0, 1fr)");
        }
      }
      if (parseFloat(cs.columnCount) > 1) { imp(el, "column-count", "1"); }
      /* 传送地点这类 flex-wrap 列表：每项占满一行，避免两列参差。 */
      if (display.indexOf("flex") >= 0 && cs.flexWrap === "wrap" && !arrowButton &&
          el.children.length >= 4 &&
          !el.querySelector("input, select, textarea")) {
        for (var k = 0; k < el.children.length; k++) {
          imp(el.children[k], "flex-basis", "100%");
          imp(el.children[k], "max-width", "100%");
        }
      }
    }
    state.ceReady = true;
    state.ceDirty = false;
    state.ceSig = ceStructureSig();
  }

  /* 补扫收敛判据：只数链接/图标/选项组，不读文本、不碰几何。DOM 没变就说明
     这一拍没有新东西可接，连续两拍稳定即可停止补扫（CE 的分批渲染同思路）。 */
  function packSignature(passages) {
    var nodes = passages.querySelectorAll("a.link-internal, a.macro-link, img.icon, .icon-container");
    var links = 0;
    var icons = 0;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.tagName === "A") { links++; } else { icons++; }
    }
    var groups = passages.querySelectorAll(".ml-option-group").length;
    return links + ":" + icons + ":" + groups;
  }

  function markPassages() {    var passages = doc.getElementById("passages");
    if (!passages) { return; }
    /* 只标记，不替换链接；CSS 依据 .macro-link 区分正文选项与行内链接。 */
    var links = passages.querySelectorAll("a.link-internal.macro-link");
    for (var i = 0; i < links.length; i++) {
      setAttr(links[i], "data-ml-option", "1");
    }
    tidySeparators(passages);
    markShopCats(passages);
    markShopTools(passages);
    tidyShopText(passages);
    markEmptyDetails(passages);
    collapseBreaks(passages);
    /* 本页分组已经稳定且没有新节点：直接跳过整轮 pack（含两次签名扫描、
       repairGroups / adoptOrphanIcons / tidyGroupGaps 三轮全页遍历）。
       任何新增/替换链接都会先经过 MutationObserver，把 packStable 打回 false。
       锚点（首个选项链接）变了也视为新页：直接 innerHTML 替换时 observer 回调
       可能还没跑，不能只信 flags。 */
    if (state.packStable && state.packAnchor && passages.contains(state.packAnchor) &&
        passages.querySelector("a.link-internal.macro-link, a.macro-link, a.link-internal") === state.packAnchor) {
      state.packChanged = false;
      return;
    }
    var before = packSignature(passages);
    state.perf.packs++;
    packIconOptions(passages);
    var after = packSignature(passages);
    state.packChanged = before !== after;
    state.packStable = true;
    state.packAnchor = passages.querySelector("a.link-internal.macro-link, a.macro-link, a.link-internal");
    /* 丢弃 pack 自己搬节点产生的观察记录；否则下一拍会把自己误判成“新节点”，
       再白跑一轮全页遍历。 */
    if (state.packObserver && state.packObserver.takeRecords) { state.packObserver.takeRecords(); }
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
    var text = C.strings(state.lang)["native.entry"];
    var hint = C.strings(state.lang)["native.entryHint"];
    var existing = overlay.querySelector('[data-ml-entry="panel"]');
    if (existing) {
      existing.textContent = text;
      existing.setAttribute("title", hint);
      state.entry = existing;
      return;
    }
    var body = doc.getElementById("customOverlayContent");
    if (!body) { return; }
    var wrap = doc.createElement("div");
    wrap.className = "ml-native-entry-wrap";
    var btn = doc.createElement("button");
    btn.type = "button";
    btn.className = "ml-native-entry";
    btn.setAttribute("data-ml-entry", "panel");
    btn.setAttribute("title", hint);
    btn.textContent = text;
    btn.addEventListener("click", openPanel);
    wrap.appendChild(btn);
    body.insertBefore(wrap, body.firstChild);
    state.entry = btn;
  }

  /* 「灯台」入口属于面板本身，不属于原生卡片层。关闭原生卡片后入口必须留下，
     否则玩家关掉面板就再也进不来。只在销毁时移除。 */
  function removeEntry() {
    var entries = doc.querySelectorAll('[data-ml-entry="panel"]');
    for (var i = 0; i < entries.length; i++) {
      var wrap = entries[i].parentNode;
      if (wrap && wrap.parentNode) { wrap.parentNode.removeChild(wrap); }
    }
    state.entry = null;
  }

  function markEntry() {
    var overlay = doc.getElementById("customOverlay");
    if (!overlay || overlay.classList.contains("hidden")) { return; }
    if (overlayKey(overlay) !== "options") { return; }
    addEntry(overlay);
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
    setAttr(overlay, "data-ml-overlay", key);    if (key === "options") { addEntry(overlay); }
    if (key === "gameFeats") { armFeatsIntro(); }
    if (key === "statistics") { alignStatRows(overlay); }
  }

  function markDialog() {
    var dialog = doc.getElementById("ui-dialog");
    if (dialog) { setAttr(dialog, "data-ml-dialog", "1"); }
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
      /* 已收过字号就不重复写；设置值相同也会让浏览器重新计算样式。 */
      if (b.getAttribute("data-ml-label") === "1" &&
          b.style.getPropertyValue("font-size") === "10px" &&
          b.style.getPropertyValue("letter-spacing") === "-0.02em") {
        state.perf.writesSaved += 2;
        continue;
      }
      if (!b.getAttribute("data-ml-label")) {
        b.setAttribute("data-ml-label", "1");
        b.setAttribute("data-ml-label-size", b.style.fontSize || "");
        b.setAttribute("data-ml-label-spacing", b.style.letterSpacing || "");
      }
      b.style.setProperty("font-size", "10px", "important");
      b.style.setProperty("letter-spacing", "-0.02em", "important");
      state.perf.writes += 2;
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
  }

  function apply() {
    if (state.disposed || !state.mounted) { return; }
    state.perf.applies++;
    state.settings = readSettings();
    state.lang = C.pickLang(state.settings.lang, navigator.language || "zh");
    state.host = hostEnabled();
    /* 独立外观层不能因为检测到 DoLGameUI 就把自己关掉：
       面板里的「原生卡片」开关是玩家对本包的明确指令，宿主的全局按钮/
       字号规则可以被本层选择器覆盖，但“整层不挂”无法由 CSS 挽回。
       1.1.6 及以前在 Android 上正是因此出现“面板是 1.1.6、正文却退回
       宿主原生卡片”的分裂状态。 */
    var on = state.settings.native !== false;
    if (state.nativeOn !== on) { state.ceDirty = true; state.ceReady = false; }
    state.nativeOn = on;
    setRoot(on);
    if (!on) {
      clearMarks();
      state.packStable = false;
      /* 入口是面板入口，不是原生样式的一部分；关原生卡片后仍要从选项进得来。 */
      markEntry();
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
    normalizeCheatLayout();
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

  /* 正文换页后补扫：只保留“立即 + 140ms”两拍，之后由自适应补扫接管
     （600ms 起、700ms 一拍、连续两拍无变化即停）。原来另外固定 480/1200/
     2400ms 三拍与补扫时间点重叠，稳定页会白跑多次全量 apply。 */
  function onPassage() {
    state.stableTicks = 0;
    state.packStable = false;
    schedule();
    setTimeout(schedule, 140);
    if (state.sweep) { clearTimeout(state.sweep); }
    var ticks = 0;
    var sweepOnce = function () {
      state.sweep = null;
      if (state.disposed) { return; }
      state.perf.sweeps++;
      schedule();
      ticks++;
      /* 两次稳定判据：600ms 这一拍先跑完 apply（rAF），下一拍再读 packChanged。
         连续两拍没有新组/新图标就停；有新节点时 observer 会重新排程。 */
      if (state.packChanged) { state.stableTicks = 0; }
      else { state.stableTicks++; }
      if (state.stableTicks < 2 && ticks < 8) { state.sweep = setTimeout(sweepOnce, 700); }
    };
    state.sweep = setTimeout(sweepOnce, 600);
  }

  function watchPassages() {
    if (state.packObserver || typeof window.MutationObserver !== "function") { return; }
    var host = doc.getElementById("passages");
    if (!host) { return; }
    var relevant = function (node) {
      if (!node || node.nodeType !== 1) { return false; }
      try {
        if (node.matches && node.matches("a.link-internal, a.macro-link, img.icon, .icon, .icon-container")) { return true; }
        /* 纯文本包裹没有后代元素，不必为它跑一次 querySelector。 */
        if (!node.firstElementChild) { return false; }
        if (node.querySelector && node.querySelector("a.link-internal, a.macro-link, img.icon, .icon, .icon-container")) { return true; }
      } catch (e) { /* 选择器不支持时按无关处理 */ }
      return false;
    };
    state.packObserver = new window.MutationObserver(function (records) {
      if (state.disposed || !state.nativeOn) { return; }
      var hit = false;
      for (var r = 0; r < records.length && !hit; r++) {
        var rec = records[r];
        var target = rec.target;
        if (target && target.nodeType === 1 && target.closest &&
            target.closest(".ml-option-group")) { continue; }
        var list = [];
        if (rec.addedNodes) { for (var a = 0; a < rec.addedNodes.length; a++) { list.push(rec.addedNodes[a]); } }
        if (rec.removedNodes) { for (var d = 0; d < rec.removedNodes.length; d++) { list.push(rec.removedNodes[d]); } }
        for (var i = 0; i < list.length; i++) {
          if (relevant(list[i])) { hit = true; break; }
        }
      }
      if (!hit) { return; }
      state.packStable = false;
      if (state.packTimer) { clearTimeout(state.packTimer); }
      state.packTimer = setTimeout(schedule, 120);
    });
    state.packObserver.observe(host, { childList: true, subtree: true });
  }

  function onClick(e) {
    var t = e && e.target;
    if (!t) { return; }
    /* 只对可能改变弹层/侧栏/正文的点击做一次合并重扫；不在滚动或输入时跑。 */
    var inBar = !!(t.closest && (t.closest("#overlayButtons") || t.closest("#menu") || t.closest("#customOverlay")));
    /* 只在会异步换 DOM 的内层页点选后补扫；普通正文推进由 passageend 负责。 */
    var inInner = !!(t.closest && t.closest("#clothingShop-div, #clothes-list, #wardrobe"));
    if (inBar || inInner) {
      schedule();
      setTimeout(schedule, 150);
      if (t.closest && t.closest("#overlayButtons")) { armFeatsIntro(); }
    }
  }

  function onReady() { schedule(); }

  /* 尺寸变了 CE 的 100vw / 单列判断必须重算；只在 resize 这一路标脏。 */
  function onResize() {
    state.ceDirty = true;
    schedule();
  }

  /* CE 面板是点开 OPTIONS 之后才异步挂进来的，正文观察器看不到它；
     单独盯 #customOverlay 子树，面板一出现/换页签就重算一次几何。 */
  function watchOverlay() {
    if (state.overlayObserver || typeof window.MutationObserver !== "function") { return; }
    var overlay = doc.getElementById("customOverlay");
    if (!overlay) { return; }
    state.overlayObserver = new window.MutationObserver(function () {
      if (state.disposed || !state.nativeOn) { return; }
      if (!doc.getElementById("cheat_extended_options")) { return; }
      var sig = ceStructureSig();
      if (sig === state.ceSig) { return; }
      state.ceSig = sig;
      state.ceDirty = true;
      if (state.packTimer) { clearTimeout(state.packTimer); }
      state.packTimer = setTimeout(function () {
        try { normalizeCheatLayout(); } catch (e) { /* 面板结构异常时不拖垮主流程 */ }
      }, 120);
    });
    state.overlayObserver.observe(overlay, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "hidden"] });
  }

  function bind() {
    doc.addEventListener("passageend", onPassage);
    doc.addEventListener("dol-ui-runtime-ready", schedule);
    doc.addEventListener("click", onClick, true);
    window.addEventListener("resize", onResize, { passive: true });
    try {
      if (window.jQuery) { window.jQuery(doc).on(":passageend", onPassage); }
    } catch (e) { /* 原生事件兜底 */ }
    watchPassages();
    watchOverlay();
  }

  function unbind() {
    doc.removeEventListener("passageend", onPassage);
    doc.removeEventListener("dol-ui-runtime-ready", schedule);
    doc.removeEventListener("click", onClick, true);
    window.removeEventListener("resize", onResize);
    try {
      if (window.jQuery) { window.jQuery(doc).off(":passageend", onPassage); }
    } catch (e) { /* ignore */ }
    if (state.packTimer) { clearTimeout(state.packTimer); state.packTimer = null; }
    if (state.packObserver) { state.packObserver.disconnect(); state.packObserver = null; }
    if (state.overlayObserver) { state.overlayObserver.disconnect(); state.overlayObserver = null; }
    if (state.sweep) { clearTimeout(state.sweep); state.sweep = null; }
  }

  function destroy() {
    state.disposed = true;
    unbind();
    clearMarks();
    removeEntry();
    restoreOverlay();
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
    destroy: destroy,
    stats: function () {
      return {
        applies: state.perf.applies,
        sweeps: state.perf.sweeps,
        packs: state.perf.packs,
        writes: state.perf.writes,
        writesSaved: state.perf.writesSaved,
        ceNorm: state.perf.ceNorm,
        ceReady: state.ceReady,
        ceDirty: state.ceDirty,
        ceSig: state.ceSig
      };
    }
  };

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", function () { mount(); }, { once: true });
    setTimeout(function () { if (!state.mounted) { mount(); } }, 400);
  } else {
    mount();
  }
})();
