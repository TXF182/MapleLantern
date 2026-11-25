/* 灯台 MapleLantern — 布景页真实 file:// 双包探针
 *
 * 用法：
 *   node tools\deco-pack-probe.js             # 主包 + 图库包：发现 106 张图、状态“图库已接入”
 *   ML_MODE=missing node tools\deco-pack-probe.js  # 只装主包：状态“未加载”、缩略图提示缺图
 *
 * 产物：%TEMP%\ml_deco_<mode>_*.png + stdout JSON 摘要；失败 exit 1。
 * 说明：使用独立 Edge profile，真实走 mce-mod-import.html → file:// IndexedDB → 游戏，
 *       不读取玩家日常 profile，不写玩家存档。
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/tools/moli-cdp/node_modules/playwright-core");

const ROOT = path.join(__dirname, "..");
const PROJECT = path.join(ROOT, "..");
const GAME = path.join(PROJECT, "game", "Degrees of Lewdity.html");
const IMPORT = path.join(PROJECT, "game", "mce-mod-import.html");
const MODE = process.env.ML_MODE === "missing" ? "missing" : "both";
const MAIN_ZIP = process.env.ML_ZIP || path.join(ROOT, "dist", "MapleLantern-1.5.12.mod.zip");
const IMAGE_ZIP = process.env.ML_IMAGE_ZIP || path.join(ROOT, "dist", "MapleLantern-ImagePack-1.5.12.mod.zip");
const PACKS = MODE === "missing" ? [MAIN_ZIP] : [MAIN_ZIP, IMAGE_ZIP];
const PROFILE = path.join(os.tmpdir(), "lantern-deco-" + MODE + "-" + Date.now());
const TAG = "ml_deco_" + MODE;
const SHOT_DIR = path.join(os.tmpdir(), TAG);
const EDGES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
];
const EDGE = EDGES.find((p) => fs.existsSync(p));

function fileUrl(p) { return "file:///" + p.replace(/\\/g, "/").replace(/#/g, "%23"); }
const checks = [];
function check(name, pass, detail) {
  checks.push({ name: name, pass: !!pass, detail: detail === undefined ? null : detail });
}

async function enterGame(page) {
  await page.evaluate(() => {
    const dlg = document.querySelector("#ui-dialog");
    if (!dlg || !dlg.classList.contains("open")) return;
    const cb = dlg.querySelector('input[type="checkbox"]');
    if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
    const enter = Array.from(dlg.querySelectorAll("button")).find((b) => /enter|进入/i.test(b.textContent || ""));
    if (enter) enter.click();
  });
  await page.waitForFunction(() => {
    const d = document.querySelector("#ui-dialog");
    return d && !d.classList.contains("open");
  }, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(350);

  for (let i = 0; i < 5; i++) {
    const clicked = await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((n) =>
        /start game|开始游戏|进入游戏/i.test((n.textContent || "").trim()) &&
        n.offsetParent && !n.disabled);
      if (!b) return false;
      b.click();
      return true;
    });
    if (!clicked) break;
    await page.waitForTimeout(700);
    const inGame = await page.evaluate(() => {
      const p = document.querySelector("#passages .passage");
      const body = document.body.innerText || "";
      const start = /Start Game!|开始游戏/i.test(body) && !p;
      const menu = !!document.querySelector("#overlayButtons, #menu");
      return !!p && !start && menu;
    });
    if (inGame) break;
  }
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("button")).find((n) =>
      /我已知晓|I understand|知道了/i.test((n.textContent || "").trim()) && n.offsetParent);
    if (b) b.click();
  });
  await page.waitForTimeout(500);
}

async function openLantern(page) {
  const stepped = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("#overlayButtons button, #menu button, #ui-bar button"));
    const b = candidates.find((n) => /选项|Options/i.test((n.textContent || "").trim()) && n.offsetParent);
    if (!b) return { options: false, lantern: false };
    b.click();
    return { options: true, lantern: false };
  });
  if (!stepped.options) return stepped;
  await page.waitForFunction(() => {
    const o = document.querySelector("#customOverlay");
    return o && !o.classList.contains("hidden") && o.querySelector("#customOverlayContent");
  }, null, { timeout: 10000 });
  await page.waitForTimeout(250);
  stepped.lantern = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll("#customOverlayContent button, #customOverlay button")).find((n) =>
      /^(灯台|Lantern)$/i.test((n.textContent || "").trim()) && n.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  });
  await page.waitForFunction(() => {
    const root = document.querySelector("#ml-root");
    return root && root.getAttribute("data-open") === "1";
  }, null, { timeout: 10000 });
  return stepped;
}

(async () => {
  if (!EDGE) throw new Error("找不到 msedge.exe");
  for (const p of PACKS) if (!fs.existsSync(p)) throw new Error("找不到包: " + p);

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: EDGE,
    headless: true,
    viewport: { width: 390, height: 844 },
    args: ["--disable-gpu", "--no-first-run", "--allow-file-access-from-files"]
  });
  const pageErrors = [];
  ctx.on("page", (p) => p.on("pageerror", (e) => pageErrors.push(e.message)));
  fs.mkdirSync(SHOT_DIR, { recursive: true });

  try {
    const imp = await ctx.newPage();
    imp.on("pageerror", (e) => pageErrors.push("import: " + e.message));
    await imp.goto(fileUrl(IMPORT), { waitUntil: "load", timeout: 60000 });
    await imp.waitForFunction(() => document.querySelector("#current") &&
      !document.querySelector("#current").textContent.includes("读取中"), null, { timeout: 30000 });
    await imp.setInputFiles("#files", PACKS);
    await imp.click("#btnImport");
    await imp.waitForFunction(() => document.querySelector("#log").textContent.includes("完成。"), null, { timeout: 60000 });
    const importLog = await imp.evaluate(() => document.querySelector("#log").textContent);
    check("双包导入完成", true, importLog.split("\n").slice(-6).join(" | "));

    const page = await ctx.newPage();
    page.on("pageerror", (e) => pageErrors.push("game: " + e.message));
    await page.goto(fileUrl(GAME), { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector("#ml-root", { timeout: 180000 });
    await enterGame(page);
    const opened = await openLantern(page);
    check("选项页灯台入口可打开面板", opened.options && opened.lantern, opened);

    const tabs = await page.evaluate(() => {
      const root = document.querySelector("#ml-root");
      return {
        open: root && root.getAttribute("data-open"),
        count: document.querySelectorAll("#ml-root .ml-tab").length,
        deco: document.querySelector('#ml-root .ml-tab[data-tab="deco"]') ?
          document.querySelector('#ml-root .ml-tab[data-tab="deco"]').textContent.trim() : null
      };
    });
    check("独立布景页签是第 7 页", tabs.count === 7 && /布景|Scenery/.test(tabs.deco || ""), tabs);

    await page.evaluate(() => {
      const b = document.querySelector('#ml-root .ml-tab[data-tab="deco"]');
      if (b) b.click();
    });
    await page.waitForFunction(() => document.querySelector("#ml-pane [data-deco-pack-status]"), null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const node = document.querySelector("#ml-pane [data-deco-pack-status]");
      return node && (node.classList.contains("is-ready") || node.classList.contains("is-partial") || node.classList.contains("is-missing"));
    }, null, { timeout: 15000 });

    const state = await page.evaluate(async () => {
      const v = window.SugarCube && window.SugarCube.State && window.SugarCube.State.variables;
      const core = window.MapleLanternDeco;
      const status = document.querySelector("#ml-pane [data-deco-pack-status]");
      const hints = Array.from(document.querySelectorAll("#ml-pane [data-deco-pack-hint]")).map((n) => ({ hidden: !!n.hidden, text: (n.textContent || "").trim() }));
      const layers = document.querySelectorAll("#ml-pane .ml-deco-card").length;
      const groups = Array.from(document.querySelectorAll("#ml-pane details[data-deco-group]")).map((n) => ({ group: n.getAttribute("data-deco-group"), open: !!n.open }));
      const thumbs = Array.from(document.querySelectorAll("#ml-pane .ml-deco-thumb")).map((n) => ({
        state: n.getAttribute("data-thumb-state"),
        empty: n.querySelector(".ml-deco-thumb-empty") ? !n.querySelector(".ml-deco-thumb-empty").hidden : null,
        emptyText: n.querySelector(".ml-deco-thumb-empty") ? n.querySelector(".ml-deco-thumb-empty").textContent.trim() : null
      }));
      const path = core && core.libraryPath ? core.libraryPath("home") : "img/decorations/ml/background1/home.png";
      const fgPath = core && core.libraryPath ? core.libraryPath("home", "foreground1") : "img/decorations/ml/foreground1/home.png";
      let image = null;
      let fgImage = null;
      try { image = window.modUtils && window.modUtils.getImage ? await Promise.resolve(window.modUtils.getImage(path)) : null; } catch (e) { image = "ERR:" + e.message; }
      try { fgImage = window.modUtils && window.modUtils.getImage ? await Promise.resolve(window.modUtils.getImage(fgPath)) : null; } catch (e) { fgImage = "ERR:" + e.message; }
      const sampleNames = core && core.CATALOG ? [core.CATALOG[0], core.CATALOG[41], core.CATALOG[82]] : [];
      const samples = await Promise.all(sampleNames.map(async (name) => {
        let value = null;
        try { value = window.modUtils && window.modUtils.getImage ? await Promise.resolve(window.modUtils.getImage(core.libraryPath(name))) : null; } catch (e) { value = "ERR:" + e.message; }
        return { name, kind: typeof value === "string" ? value.slice(0, 22) : value, length: typeof value === "string" ? value.length : 0 };
      }));
      return {
        statusClass: status ? status.className : null,
        statusText: status ? (status.textContent || "").trim() : null,
        retryHidden: document.querySelector("#ml-pane [data-deco-pack-retry]") ? !!document.querySelector("#ml-pane [data-deco-pack-retry]").hidden : null,
        autoDisabled: document.querySelector("#ml-pane [data-deco-auto-toggle]") ? !!document.querySelector("#ml-pane [data-deco-auto-toggle]").disabled : null,
        fgAutoDisabled: document.querySelector("#ml-pane [data-deco-auto-fg-toggle]") ? !!document.querySelector("#ml-pane [data-deco-auto-fg-toggle]").disabled : null,
        hints,
        layers,
        groups,
        thumbs,
        currentLocation: v ? v.location : null,
        catalog: core && core.CATALOG ? core.CATALOG.length : null,
        image: typeof image === "string" ? { kind: image.slice(0, 22), length: image.length } : image,
        fgImage: typeof fgImage === "string" ? { kind: fgImage.slice(0, 22), length: fgImage.length } : fgImage,
        samples,
        tabs: document.querySelectorAll("#ml-root .ml-tab").length
      };
    });
    const ready = MODE === "both";
    check("图库状态与期望一致", ready ? state.statusClass.indexOf("is-ready") >= 0 : state.statusClass.indexOf("is-missing") >= 0, state.statusClass);
    check("图库状态文案", ready ? /图库已接入|Image pack ready/i.test(state.statusText) && /106/.test(state.statusText) : /未加载|not loaded|missing/i.test(state.statusText), state.statusText);
    check("图库重新检测入口", ready ? state.retryHidden === true : state.retryHidden === false, state.retryHidden);
    check("缺包时自动背景开关禁用", ready ? state.autoDisabled === false : state.autoDisabled === true, state.autoDisabled);
    check("缺包时自动前景开关禁用", ready ? state.fgAutoDisabled === false : state.fgAutoDisabled === true, state.fgAutoDisabled);
    check("九层全部渲染", state.layers === 9, state.layers);
    check("背景/前景两个折叠组", state.groups.length === 2 && state.groups[0].open === true && state.groups[1].open === false, state.groups);
    check("缺包提示可见性符合期望", ready ? state.hints.every((h) => h.hidden === true) : state.hints.some((h) => h.hidden === false), state.hints);
    check("图库目录 106 项", state.catalog === 106, state.catalog);
    check("真实 getImage 可读", ready ? (state.image && state.image.kind.indexOf("data:image") === 0 && state.image.length > 10000) : (!state.image || state.image === "null"), state.image);
    check("真实前景 getImage 可读", ready ? (state.fgImage && state.fgImage.kind.indexOf("data:image") === 0 && state.fgImage.length > 10000) : (!state.fgImage || state.fgImage === "null"), state.fgImage);
    check("首/中/末三张图都可读（或缺包时都不可读）", ready ? state.samples.every((s) => s.kind.indexOf("data:image") === 0 && s.length > 10000) : state.samples.every((s) => !s.kind), state.samples);
    check("背景槽与当前存档一致", state.thumbs[0].state === null || ["empty", "none", "ready", "missing"].indexOf(state.thumbs[0].state) >= 0, state.thumbs[0]);

    const picker = await page.evaluate(() => {
      const b = document.querySelector('#ml-pane [data-deco-select-image="background1"]');
      if (!b) return { opened: false, count: 0 };
      b.click();
      const p = document.querySelector("#ml-pane [data-deco-picker]");
      return { opened: !!p && !p.hidden, count: p ? p.querySelectorAll(".ml-deco-pick").length : 0 };
    });
    await page.waitForTimeout(700);
    const pickerState = await page.evaluate(() => {
      const p = document.querySelector("#ml-pane [data-deco-picker]");
      if (!p) return null;
      const picks = Array.from(p.querySelectorAll(".ml-deco-pick"));
      const loaded = Array.from(p.querySelectorAll(".ml-deco-pick img")).filter((n) => n.getAttribute("src") && n.getAttribute("src").indexOf("data:image") === 0);
      return {
        count: picks.length,
        folders: Array.from(new Set(picks.map((n) => n.getAttribute("data-deco-pick-folder")))),
        missing: picks.filter((n) => n.classList.contains("is-missing")).length,
        loaded: loaded.length,
        firstLabel: picks[0] ? (picks[0].querySelector(".ml-deco-pick-label") || {}).textContent : null,
        firstImage: loaded[0] ? loaded[0].getAttribute("src").slice(0, 22) : null,
        labelsWithMissing: picks.slice(0, 5).filter((n) => /图片缺失|Image missing/i.test((n.textContent || ""))).length,
        sourceText: p.querySelector(".ml-deco-picker-source") ? p.querySelector(".ml-deco-picker-source").textContent.trim() : null
      };
    });
    check("图库选择器可打开", picker.opened === true, picker);
    check("图库缩略图 107 项（106 图 + 无）", pickerState && pickerState.count === 107, pickerState && pickerState.count);
    check("缺包时可见缩略图全部缺图", ready || (pickerState && pickerState.missing > 0 && pickerState.loaded === 0), pickerState && { missing: pickerState.missing, loaded: pickerState.loaded });
    check("装包后首屏缩略图真实加载", !ready || (pickerState && pickerState.loaded > 0 && pickerState.firstImage && pickerState.firstImage.indexOf("data:image") === 0), pickerState);
    check("装包后图库项不再误报缺图", !ready || (pickerState && pickerState.labelsWithMissing === 0 && !/图片缺失|Image missing/i.test(pickerState.firstLabel || "")), pickerState);
    check("背景选择器只列 background1", pickerState && pickerState.folders.length === 1 && pickerState.folders[0] === "background1", pickerState && pickerState.folders);
    check("背景选择器头部标明来源", pickerState && /background1/.test(pickerState.sourceText || ""), pickerState && pickerState.sourceText);

    await page.evaluate(() => {
      const p = document.querySelector("#ml-pane [data-deco-picker]");
      const b = p && p.querySelector(".ml-deco-close");
      if (b) b.click();
      const host = document.querySelector("#ml-pane-host");
      const pane = document.querySelector("#ml-pane");
      if (host) host.scrollTop = 0;
      if (pane) pane.scrollTop = 0;
    });
    await page.waitForTimeout(200);

    const fgPicker = await page.evaluate(() => {
      const b = document.querySelector('#ml-pane [data-deco-select-image="foreground1"]');
      if (!b) return { opened: false, count: 0 };
      b.click();
      const p = document.querySelector("#ml-pane [data-deco-picker]");
      return { opened: !!p && !p.hidden, count: p ? p.querySelectorAll(".ml-deco-pick").length : 0 };
    });
    await page.waitForTimeout(700);
    const fgPickerState = await page.evaluate(() => {
      const p = document.querySelector("#ml-pane [data-deco-picker]");
      if (!p) return null;
      const picks = Array.from(p.querySelectorAll(".ml-deco-pick"));
      const loaded = Array.from(p.querySelectorAll(".ml-deco-pick img")).filter((n) => n.getAttribute("src") && n.getAttribute("src").indexOf("data:image") === 0);
      return {
        count: picks.length,
        folders: Array.from(new Set(picks.map((n) => n.getAttribute("data-deco-pick-folder")))),
        loaded: loaded.length,
        firstImage: loaded[0] ? loaded[0].getAttribute("src").slice(0, 22) : null,
        sourceText: p.querySelector(".ml-deco-picker-source") ? p.querySelector(".ml-deco-picker-source").textContent.trim() : null
      };
    });
    check("前景图库选择器可打开", fgPicker.opened === true, fgPicker);
    check("前景图库缩略图 107 项（106 图 + 无）", fgPickerState && fgPickerState.count === 107, fgPickerState && fgPickerState.count);
    check("前景选择器只列 foreground1", fgPickerState && fgPickerState.folders.length === 1 && fgPickerState.folders[0] === "foreground1", fgPickerState && fgPickerState.folders);
    check("前景选择器头部标明来源", fgPickerState && /foreground1/.test(fgPickerState.sourceText || ""), fgPickerState && fgPickerState.sourceText);
    check("前景缩略图真实加载", !ready || (fgPickerState && fgPickerState.loaded > 0 && fgPickerState.firstImage && fgPickerState.firstImage.indexOf("data:image") === 0), fgPickerState);

    await page.evaluate(() => {
      const p = document.querySelector("#ml-pane [data-deco-picker]");
      const b = p && p.querySelector(".ml-deco-close");
      if (b) b.click();
    });
    await page.waitForTimeout(200);

    /* 图库「只看本地点可用」：勾选后只保留当前地点链上的图库键 */
    const localFilter = await page.evaluate(() => {
      const D = window.MapleLanternDeco;
      const v = window.SugarCube.State.variables;
      const info = D.locationInfo(v, window.setup, window.SugarCube.State.passage);
      const btn = document.querySelector('#ml-pane [data-deco-select-image="background1"]');
      if (!btn) return { opened: false };
      btn.click();
      const p = document.querySelector("#ml-pane [data-deco-picker]");
      const only = p.querySelector("[data-deco-only-local]");
      if (!only) return { opened: true, onlyLocal: false, chain: info.chain };
      only.checked = true;
      only.dispatchEvent(new Event("change", { bubbles: true }));
      const picks = Array.from(p.querySelectorAll(".ml-deco-pick"));
      const names = picks.map((n) => n.getAttribute("data-deco-pick-name"));
      return { opened: true, onlyLocal: true, chain: info.chain, names: names, count: names.length };
    });
    check("图库「只看本地点可用」按地点链过滤",
      localFilter && localFilter.onlyLocal === true && localFilter.count >= 2 &&
      localFilter.names.indexOf("none") >= 0 &&
      localFilter.names.every((n) => n === "none" || localFilter.chain.indexOf(n) >= 0), localFilter);

    /* 最近使用：选中后重开图库，最近行应出现该项并置顶，变量同步写入 */
    const recent = await page.evaluate(() => {
      const p = document.querySelector("#ml-pane [data-deco-picker]");
      const pick = Array.from(p.querySelectorAll(".ml-deco-pick")).find((n) => n.getAttribute("data-deco-pick-name") !== "none");
      if (!pick) return { picked: null };
      const name = pick.getAttribute("data-deco-pick-name");
      pick.click();
      const v = window.SugarCube.State.variables;
      const btn = document.querySelector('#ml-pane [data-deco-select-image="background1"]');
      btn.click();
      const p2 = document.querySelector("#ml-pane [data-deco-picker]");
      const row = p2.querySelector("[data-deco-recent]");
      const chips = row ? Array.from(row.querySelectorAll("[data-deco-recent-name]")).map((n) => n.getAttribute("data-deco-recent-name")) : [];
      return { picked: name, rowHidden: !row || row.hidden, chips: chips, varName: v.background_image1 };
    });
    check("图库最近使用：选中项置顶并在重开后可见",
      !ready || (recent && recent.picked && recent.varName === recent.picked && recent.rowHidden === false && recent.chips.indexOf(recent.picked) >= 0), recent);

    /* 配置导出 / 导入：九层 JSON 往返恢复；坏数据整体拒收 */
    const exchange = await page.evaluate(() => {
      const D = window.MapleLanternDeco;
      const v = window.SugarCube.State.variables;
      const before = D.normalizeName(v.background_image1);
      const area = document.querySelector("#ml-pane [data-deco-exchange]");
      const exp = document.querySelector("#ml-pane [data-deco-export]");
      const imp = document.querySelector("#ml-pane [data-deco-import]");
      if (!area || !exp || !imp) return { present: false };
      exp.click();
      const text = area.value;
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
      const layerCount = parsed && parsed.layers ? Object.keys(parsed.layers).length : 0;
      v.background_image1 = "none";
      area.value = text;
      imp.click();
      const status = document.querySelector("#ml-pane [data-deco-exchange-status]");
      const after = D.normalizeName(v.background_image1);
      const area2 = document.querySelector("#ml-pane [data-deco-exchange]");
      area2.value = "{\"hello\":1}";
      document.querySelector("#ml-pane [data-deco-import]").click();
      const status2 = document.querySelector("#ml-pane [data-deco-exchange-status]");
      const after2 = D.normalizeName(v.background_image1);
      return {
        present: true, hasText: text.length > 0, layerCount: layerCount, before: before, after: after, ok: before === after,
        status: status ? status.textContent : null, after2: after2,
        rejected: after2 === after && /失败|failed/i.test(status2 ? status2.textContent : "")
      };
    });
    check("配置导出/导入：九层 JSON 往返且坏数据拒收",
      exchange && exchange.present === true && exchange.hasText === true && exchange.layerCount === 9 &&
      exchange.ok === true && exchange.rejected === true, exchange);

    const autoFg = await page.evaluate(async () => {
      const t = document.querySelector("#ml-pane [data-deco-auto-fg-toggle]");
      if (!t) return null;
      t.click();
      await new Promise((r) => setTimeout(r, 350));
      const v = window.SugarCube.State.variables;
      const core = window.MapleLanternDeco;
      const layer = core.LAYERS.find((l) => l.id === "foreground1");
      return { enabled: v.decoAutoFgEnabled, active: v.decoAutoFgActive, name: v.foreground_image1, path: core.imagePath(layer, v), source: v.decoAutoFgSource };
    });
    check("真实自动前景按地点命中", !ready || (autoFg && autoFg.enabled === true && autoFg.active === true && autoFg.name === "home" && /foreground1\/home\.png$/.test(autoFg.path || "") && autoFg.source === "home"), autoFg);

    const autoFgOff = await page.evaluate(async () => {
      const t = document.querySelector("#ml-pane [data-deco-auto-fg-toggle]");
      if (!t) return null;
      t.click();
      await new Promise((r) => setTimeout(r, 350));
      const v = window.SugarCube.State.variables;
      return { enabled: v.decoAutoFgEnabled, active: v.decoAutoFgActive, name: v.foreground_image1, path: v.decoImagePath && v.decoImagePath.foreground1 };
    });
    check("真实关闭自动前景后恢复玩家原图", !ready || (autoFgOff && autoFgOff.enabled === false && autoFgOff.active !== true && autoFgOff.name === "none"), autoFgOff);

    const coreLocations = await page.evaluate(() => {
      const D = window.MapleLanternDeco;
      const setup = window.setup;
      const baseVars = window.SugarCube.State.variables;
      const catalog = D.CATALOG;
      return ["landfill", "orphanage", "cliff_dock", "mer_pier", "lake_rock"].map((loc) => {
        const vars = Object.assign({}, baseVars, { location: loc, outside: 1 });
        const info = D.locationInfo(vars, setup);
        return {
          loc: loc,
          visual: info.visual,
          base: info.base,
          chain: info.chain,
          picked: D.pickAutoLocation(info, catalog, catalog, [])
        };
      });
    });
    check("真实地点链匹配 Core4", coreLocations.every((x) => x.picked === x.loc), coreLocations);

    /* 街道总线：原版街道页 $location="town" + $outside=1，仅 $bus 区分。
       这里直接在真机 State.variables 上模拟街道页状态，验证 bus 优先命中、室内不误插。 */
    const streetBus = await page.evaluate(() => {
      const D = window.MapleLanternDeco;
      const setup = window.setup;
      const baseVars = window.SugarCube.State.variables;
      const catalog = D.CATALOG;
      const mk = (bus, outside, location) => Object.assign({}, baseVars, { location: location || "town", outside: outside, bus: bus });
      const wolf = D.locationInfo(mk("wolf", 1), setup);
      const indoor = D.locationInfo(mk("bus", 0), setup);
      const noBus = D.locationInfo(mk(undefined, 1), setup);
      const hotel = D.locationInfo(mk(undefined, 0, "hotel"), setup);
      const alleyCom = D.locationInfo(mk("commercial", 1, "alley"), setup);
      const alleyInd = D.locationInfo(mk("industrial", 1, "alley"), setup);
      const alleyRes = D.locationInfo(mk("residential", 1, "alley"), setup);
      const industrial = D.locationInfo(mk("industrial", 1, "industrial"), setup);
      return {
        wolfChain: wolf.chain,
        wolfPicked: D.pickAutoLocation(wolf, catalog, catalog, []),
        indoorChain: indoor.chain,
        indoorPicked: D.pickAutoLocation(indoor, catalog, catalog, []),
        noBusChain: noBus.chain,
        hotelChain: hotel.chain,
        hotelPicked: D.pickAutoLocation(hotel, catalog, catalog, []),
        alleyCom: alleyCom.chain[0],
        alleyInd: alleyInd.chain[0],
        alleyRes: alleyRes.chain[0],
        alleyPicked: D.pickAutoLocation(alleyCom, catalog, catalog, []),
        industrialChain0: industrial.chain[0],
        catalogCount: catalog.length
      };
    });
    check("街道总线：wolf 链首命中且室内不插 bus", streetBus && streetBus.wolfChain[0] === "wolf" && streetBus.wolfPicked === "wolf" && streetBus.indoorChain.indexOf("bus") < 0 && streetBus.indoorPicked === "town" && streetBus.noBusChain[0] === "town", streetBus);
    check("街道档位：alley/industrial 命中三张街区暗巷图", streetBus && streetBus.alleyCom === "com_alley" && streetBus.alleyInd === "ind_alley" && streetBus.alleyRes === "res_alley" && streetBus.alleyPicked === "com_alley" && streetBus.industrialChain0 === "ind_alley", streetBus);
    check("Avery Hotel：链首命中 hotel 且自动选中", streetBus && streetBus.hotelChain[0] === "hotel" && streetBus.hotelPicked === "hotel", streetBus && { chain: streetBus.hotelChain, picked: streetBus.hotelPicked });
    check("街道总线：CATALOG 已含 106 项", streetBus && streetBus.catalogCount === 106, streetBus && streetBus.catalogCount);

    /* 室内借用页：原版三页没有 $bus，只能按 passage 名命中；缺图回退各自共用图。
       真机 State.variables 模拟各页状态，传真实 passage 名验证链首与自动选中。 */
    const indoor3 = await page.evaluate(() => {
      const D = window.MapleLanternDeco;
      const setup = window.setup;
      const baseVars = window.SugarCube.State.variables;
      const catalog = D.CATALOG;
      const mk = (location, outside, bus) => Object.assign({}, baseVars, { location: location, outside: outside, bus: bus });
      const info = (vars, passage) => { const i = D.locationInfo(vars, setup, passage); return { chain: i.chain, picked: D.pickAutoLocation(i, catalog, catalog, []) }; };
      return {
        busStation: info(mk("town", 0), "Bus Station"),
        soupKitchen: info(mk("temple", 0), "Soup Kitchen"),
        soupKitchenClosed: info(mk("temple", 0), "Soup Kitchen Closed"),
        policeBackOffice: info(mk("police_station", 0), "Police Back Office"),
        unrelatedIndoor: info(mk("town", 0), "Domus Street"),
        noPassage: info(mk("town", 0), undefined),
        catalogCount: catalog.length
      };
    });
    check("室内借用页：四个 passage 名都命中各自新图",
      indoor3 && indoor3.busStation.chain[0] === "bus_station" && indoor3.busStation.picked === "bus_station" &&
      indoor3.soupKitchen.chain[0] === "soup_kitchen" && indoor3.soupKitchen.picked === "soup_kitchen" &&
      indoor3.soupKitchenClosed.chain[0] === "soup_kitchen" && indoor3.soupKitchenClosed.picked === "soup_kitchen" &&
      indoor3.policeBackOffice.chain[0] === "police_back_office" && indoor3.policeBackOffice.picked === "police_back_office", indoor3);
    check("室内借用页：无关室内页不插新图、无 passage 现状一致",
      indoor3 && indoor3.unrelatedIndoor.chain.indexOf("bus_station") < 0 && indoor3.unrelatedIndoor.chain.indexOf("soup_kitchen") < 0 &&
      indoor3.unrelatedIndoor.chain.indexOf("police_back_office") < 0 && indoor3.unrelatedIndoor.picked === "town" &&
      indoor3.noPassage.chain[0] === "town", indoor3 && { unrelatedIndoor: indoor3.unrelatedIndoor, noPassage: indoor3.noPassage });

    await page.screenshot({ path: path.join(SHOT_DIR, "390-top.png") });

    await page.evaluate(() => {
      const sec = document.querySelector("#ml-pane [data-deco-auto]");
      if (sec) sec.scrollIntoView({ block: "start" });
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOT_DIR, "390-auto.png") });

    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const host = document.querySelector("#ml-pane-host");
      if (host) host.scrollTop = 0;
    });
    await page.waitForTimeout(100);
    const narrow = await page.evaluate(() => {
      const root = document.querySelector("#ml-root");
      const panel = document.querySelector("#ml-panel, #ml-root .ml-panel");
      const box = panel ? panel.getBoundingClientRect() : null;
      return {
        viewport: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        panel: box ? { w: Math.round(box.width), h: Math.round(box.height) } : null,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    check("320 宽无横向溢出", narrow.overflowX === false && (!narrow.panel || narrow.panel.w <= 320), narrow);
    await page.screenshot({ path: path.join(SHOT_DIR, "320.png") });

    check("全程无未捕获异常", pageErrors.length === 0, pageErrors.slice(0, 8));

    const report = {
      mode: MODE,
      packages: PACKS.map((p) => path.basename(p)),
      profile: PROFILE,
      shots: SHOT_DIR,
      state: state,
      picker: pickerState,
      narrow: narrow,
      pageErrors: pageErrors.slice(0, 8),
      checks: checks
    };
    console.log(JSON.stringify(report, null, 2));
    const bad = checks.filter((c) => !c.pass);
    console.log(bad.length ? "DECO_PROBE: FAIL (" + bad.length + ")" : "DECO_PROBE: PASS");
    process.exitCode = bad.length ? 1 : 0;
  } finally {
    await ctx.close();
  }
})().catch((e) => { console.error("DECO_PROBE: ERROR " + e.stack); process.exitCode = 2; });
