/* MapleLantern — inject-early 兼容层（运行期兜底）
 *
 * 启动崩溃的根因不在本文件：MEE 的 mee.excrete = function(){} 末尾缺分号，
 * 紧随其后的 core.js 以 (function...)() 开头，ASI 把 excrete 当成被调用者，
 * 以 V.daily 缺失时直接抛异常；core.js 前置分号已切断这条连接。
 *
 * 本文件只处理运行期兜底：MEE 的 getexcretes()/excrete() 直接读取 V.daily.excretes，
 * 若 daily 在旧存档/迁移顺序异常时仍缺失，访问器接管后 getexcretes 返回 false、
 * excrete 安全 no-op；daily 正常存在时仍调用 MEE 原实现。不伪造 V.daily。
 * 另在 :passageinit 时调用游戏自带的 dailyConvert() 做官方迁移（只在 daily 缺失时）。
 */
(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : null;
  if (!root || root.__mlMeeDailyGuard) { return; }
  root.__mlMeeDailyGuard = true;

  var DEFAULTS = { getexcretes: false, excrete: undefined };

  function variables() {
    try {
      if (root.State && root.State.variables && typeof root.State.variables === "object") {
        return root.State.variables;
      }
      if (root.SugarCube && root.SugarCube.State && root.SugarCube.State.variables) {
        return root.SugarCube.State.variables;
      }
      if (root.V && typeof root.V === "object") { return root.V; }
    } catch (ignore) { /* 状态尚未建立 */ }
    return null;
  }

  function hasDaily() {
    var V = variables();
    return !!(V && V.daily);
  }

  function guard(name, getReal) {
    return function () {
      if (!hasDaily()) { return DEFAULTS[name]; }
      var real = getReal();
      return real ? real.apply(this, arguments) : DEFAULTS[name];
    };
  }

  function makeProxy(value) {
    var target = value && (typeof value === "object" || typeof value === "function") ? value : {};
    Object.keys(DEFAULTS).forEach(function (name) {
      var real = typeof target[name] === "function" ? target[name] : null;
      var safe = guard(name, function () { return real; });
      safe.__mlDailyWrapped = true;
      try {
        Object.defineProperty(target, name, {
          configurable: true,
          enumerable: true,
          get: function () { return safe; },
          set: function (next) {
            if (typeof next === "function") { real = next; }
          }
        });
      } catch (ignore) {
        target[name] = safe;
      }
    });
    return new Proxy(target, {
      get: function (obj, key) {
        if (key === "__mlDailyGuard") { return true; }
        return obj[key];
      },
      set: function (obj, key, next) {
        if (key === "getexcretes" || key === "excrete") {
          var desc = Object.getOwnPropertyDescriptor(obj, key);
          if (desc && typeof desc.set === "function") { desc.set(next); }
          return true;
        }
        obj[key] = next;
        return true;
      }
    });
  }

  var current = makeProxy(root.mee);
  try {
    Object.defineProperty(root, "mee", {
      configurable: true,
      enumerable: true,
      get: function () { return current; },
      set: function (next) { current = makeProxy(next); }
    });
  } catch (ignore) {
    /* 宿主已锁定 mee 时保留现有对象上的访问器 */
  }

  function ensureDaily() {
    var V = variables();
    if (!V || V.daily) { return; }
    try {
      if (typeof root.dailyConvert === "function") { root.dailyConvert(); }
    } catch (ignore) { /* 迁移函数不可用时不阻断渲染 */ }
  }

  if (root.document && typeof root.document.addEventListener === "function") {
    root.document.addEventListener(":passageinit", ensureDaily, true);
  }
})();
