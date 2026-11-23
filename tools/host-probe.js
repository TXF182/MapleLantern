/* 灯台宿主页探针（在 tests/custom-host.html 里执行）
 * 只回答「脚本是否真的装配成功、版本与默认项是否对」，不碰面板 DOM
 * （宿主页不会自动展开设置面板，面板控件由 tests/custom.test.js 覆盖）。
 */
(() => {
  const core = window.MapleLanternDossierCore;
  const custom = window.MapleLanternCustom;
  const theme = window.MapleLanternDossierTheme;
  const panel = window.MapleLanternDossierPanel;
  const deco = window.MapleLanternDeco;
  const decoPanel = window.MapleLanternDecoPanel;
  const s = custom && typeof custom.getSettings === "function" ? custom.getSettings() : null;
  const cardKeys = ["cardOn", "cardOpacity", "cardFit", "cardZoom", "cardX", "cardY"];
  return {
    ready: document.readyState,
    scripts: Array.from(document.scripts).length,
    core: !!core,
    custom: !!custom && custom.__ready === true,
    theme: !!theme,
    panel: !!panel,
    deco: !!deco && deco.LAYERS.length === 9,
    decoPanel: !!decoPanel && decoPanel.__ready === true,
    decoCatalog: !!(deco && deco.CATALOG && deco.CATALOG.length === 83),
    version: core ? core.VERSION : null,
    cardKeys: !!(s && s.custom && cardKeys.every((k) => k in s.custom)),
    bgKeys: !!(s && s.custom && "bgOn" in s.custom),
    localScripts: Array.from(document.scripts)
      .map((x) => x.src.split("/").slice(-2).join("/"))
      .filter((x) => x.indexOf("src/") === 0)
  };
})()
