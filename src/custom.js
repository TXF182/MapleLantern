/* ============================================================================
 * 灯台 · 自定义外观 — custom.js
 * 只做启动装配：读设置 → 落到页面变量 → 载入图库并挂到背景/按钮层。
 * 不接管任何游戏原生结构，只在自己新增的图层与设置分组上生效。
 * ========================================================================== */
(function (root) {
  "use strict";
  var Core = root.MapleLanternDossierCore;
  var Theme = root.MapleLanternDossierTheme;
  var Assets = root.MapleLanternDossierAssets;
  if (!Core || !Theme || !Assets) return;
  if (root.MapleLanternCustom && root.MapleLanternCustom.__ready) return;

  function storage() {
    try { return root.localStorage; } catch (e) { return null; }
  }

  /* 图库里的 blob 必须转成 data: URL 再挂：DoL 的 CSP 是 img-src 'self' data:，
     用 createObjectURL 出来的 blob: 会被拦，变量有值但一个像素都不画。 */
  function attach(kind, rec) {
    if (!rec || !rec.blob) return;
    Assets.dataUrlFor(kind, rec.blob).then(function (url) {
      if (!url) { Theme.attach(kind, null); return; }
      var probe = new root.Image();
      probe.onload = function () {
        Theme.attach(kind, { url: url, w: probe.naturalWidth, h: probe.naturalHeight });
      };
      probe.onerror = function () { Theme.attach(kind, null); };
      probe.src = url;
    }, function () { Theme.attach(kind, null); });
  }

  /* 1.4.3 及更早默认 60（玩家常停在 45）：暗色图会被同色遮罩洗没，看起来像「导入了没反应」。
     1.4.4 起默认 100。开过背景但档位 <80 的旧档在这里一次性提上来，
     老玩家装上新包刷新一次就能看见自己的图，不必再点导入或应用背景。 */
  function migrate(settings) {
    var c = settings && settings.custom;
    if (!c || !c.bgOn) return settings;
    if (typeof c.bgOpacity !== "number" || c.bgOpacity >= 80) return settings;
    var next = Core.merge(settings, { bgOpacity: 100 });
    Core.writeSettings(storage(), next);
    return next;
  }

  function boot() {
    var settings = migrate(Core.readSettings(storage()));
    Theme.apply(settings);
    ["bg", "btn", "card"].forEach(function (kind) {
      Promise.resolve(Assets.load(kind)).then(function (rec) { attach(kind, rec); });
    });
  }

  var api = {
    __ready: true,
    boot: boot,
    getSettings: function () { return Core.readSettings(storage()); },
    setSettings: function (patch) {
      var s = Core.merge(Core.readSettings(storage()), patch);
      Core.writeSettings(storage(), s);
      Theme.apply(s);
      return Core.clone(s);
    }
  };
  root.MapleLanternCustom = api;

  if (root.document && root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
