/* 灯台 MapleLantern — UI kit 原语
 * 只做语义与状态标记，不接管既有 .ml-* 布局；样式在 ui-kit.css。
 * 兼容旧 WebView：ES5 语法，无 :scope / 模板字符串 / 可选链。
 */
(function (root) {
  "use strict";
  if (root.MapleLanternUI) { return; }
  var doc = root.document;

  function el(tag, cls, attrs) {
    var node = doc.createElement(tag);
    if (cls) { node.className = cls; }
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) { return; }
        node.setAttribute(key, value === true ? "" : String(value));
      });
    }
    return node;
  }

  /* 给既有 DOM 打语义标记；新增节点也能复用。 */
  function mark(node, kind, state) {
    if (!node || !node.setAttribute) { return node; }
    node.setAttribute("data-ui", kind);
    var cls = "ml-ui-" + kind;
    if (node.classList) {
      node.classList.add(cls);
    } else if ((" " + node.className + " ").indexOf(" " + cls + " ") < 0) {
      node.className = (node.className ? node.className + " " : "") + cls;
    }
    if (state) { node.setAttribute("data-ui-state", state); }
    else if (state === null) { node.removeAttribute("data-ui-state"); }
    return node;
  }

  function row(opts) {
    opts = opts || {};
    var node = opts.node || el(opts.tag || "div", opts.className || "");
    return mark(node, "row", opts.state || "normal");
  }

  function card(opts) {
    opts = opts || {};
    var node = opts.node || el(opts.tag || "div", opts.className || "");
    mark(node, "card", opts.state || "normal");
    if (opts.label !== undefined && opts.label !== null) {
      var label = el(opts.labelTag || "span", opts.labelClass || "ml-ui-card-k");
      label.textContent = opts.label;
      node.appendChild(label);
    }
    if (opts.value !== undefined && opts.value !== null) {
      var value = el(opts.valueTag || "strong", opts.valueClass || "ml-ui-card-v");
      value.textContent = opts.value;
      node.appendChild(value);
      node.__value = value;
    }
    return node;
  }

  function section(opts) {
    opts = opts || {};
    var node = opts.node || el(opts.tag || "section", opts.className || "");
    mark(node, "section", opts.state || "normal");
    if (opts.node) { return node; }

    if (opts.title || opts.hint) {
      var head = el("div", "ml-ui-section-h" + (opts.headClass ? " " + opts.headClass : ""));
      if (opts.title) {
        var title = el(opts.titleTag || "span", "ml-ui-section-title");
        title.textContent = opts.title;
        head.appendChild(title);
      }
      if (opts.hint) {
        var hint = el("p", "ml-ui-section-hint");
        hint.textContent = opts.hint;
        head.appendChild(hint);
      }
      node.appendChild(head);
    }

    var body = el("div", "ml-ui-section-body" + (opts.bodyClass ? " " + opts.bodyClass : ""));
    if (opts.body) {
      if (Object.prototype.toString.call(opts.body) === "[object Array]") {
        opts.body.forEach(function (child) { if (child) { body.appendChild(child); } });
      } else {
        body.appendChild(opts.body);
      }
    }
    node.appendChild(body);
    return node;
  }

  function segmented(opts) {
    opts = opts || {};
    var group = el("div", opts.className || "", { role: "radiogroup" });
    mark(group, "segmented", "normal");
    if (opts.label) { group.setAttribute("aria-label", opts.label); }

    var buttons = [];
    function syncOption(node, on) {
      node.setAttribute("aria-checked", on ? "true" : "false");
      var disabled = node.disabled || node.getAttribute("aria-disabled") === "true";
      node.setAttribute("data-ui-state", disabled ? "disabled" : (on ? "selected" : "normal"));
    }
    (opts.options || []).forEach(function (opt) {
      var selected = opts.current === opt.value;
      var btnClass = opts.buttonClass ? opts.buttonClass(opt) : "ml-ui-seg-btn";
      var btn = el("button", btnClass, {
        type: "button", role: "radio",
        "aria-checked": selected ? "true" : "false",
        "data-value": opt.value, "data-ui-option": "1"
      });
      mark(btn, "option", selected ? "selected" : "normal");
      if (opt.disabled) {
        btn.disabled = true;
        mark(btn, "option", "disabled");
        btn.setAttribute("aria-disabled", "true");
      }
      if (opts.decorate) { opts.decorate(btn, opt); }
      btn.addEventListener("click", function () {
        if (btn.disabled) { return; }
        Array.prototype.forEach.call(group.querySelectorAll("[data-value]"), function (node) {
          syncOption(node, node.getAttribute("data-value") === String(opt.value));
        });
        if (opts.onPick) { opts.onPick(opt.value); }
      });
      buttons.push(btn);
      group.appendChild(btn);
    });

    group.addEventListener("keydown", function (ev) {
      if (!buttons.length) { return; }
      var dir = (ev.key === "ArrowRight" || ev.key === "ArrowDown") ? 1
        : (ev.key === "ArrowLeft" || ev.key === "ArrowUp") ? -1 : 0;
      var next = null;
      if (ev.key === "Home" || ev.key === "End") {
        var scan = ev.key === "Home" ? buttons : buttons.slice().reverse();
        for (var h = 0; h < scan.length; h++) {
          if (!scan[h].disabled && scan[h].getAttribute("aria-disabled") !== "true") { next = scan[h]; break; }
        }
      } else if (dir) {
        var current = doc.activeElement;
        var index = buttons.indexOf(current);
        var start = index >= 0 ? index : (dir > 0 ? -1 : 0);
        for (var i = 1; i <= buttons.length; i++) {
          var candidate = buttons[(start + dir * i + buttons.length) % buttons.length];
          if (!candidate.disabled && candidate.getAttribute("aria-disabled") !== "true") { next = candidate; break; }
        }
      }
      if (!next) { return; }
      ev.preventDefault();
      next.focus();
      next.click();
    });

    return group;
  }

  root.MapleLanternUI = {
    el: el,
    mark: mark,
    row: row,
    card: card,
    section: section,
    segmented: segmented
  };
})(window);
