/* 灯台 MapleLantern — 布景页真实 file:// 双包探针
 *
 * 用法：
 *   node tools\deco-pack-probe.js             # 主包 + 图库包：发现 83 张图、状态“图库已接入”
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
const MAIN_ZIP = process.env.ML_ZIP || path.join(ROOT, ".selfcheck", "pack-1.5.8-deco-audit", "MapleLantern-1.5.8.mod.zip");
const IMAGE_ZIP = process.env.ML_IMAGE_ZIP || path.join(ROOT, "dist", "MapleLantern-ImagePack-1.5.8.mod.zip");
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
      let image = null;
      try { image = window.modUtils && window.modUtils.getImage ? await Promise.resolve(window.modUtils.getImage(path)) : null; } catch (e) { image = "ERR:" + e.message; }
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
        hints,
        layers,
        groups,
        thumbs,
        currentLocation: v ? v.location : null,
        catalog: core && core.CATALOG ? core.CATALOG.length : null,
        image: typeof image === "string" ? { kind: image.slice(0, 22), length: image.length } : image,
        samples,
        tabs: document.querySelectorAll("#ml-root .ml-tab").length
      };
    });
    const ready = MODE === "both";
    check("图库状态与期望一致", ready ? state.statusClass.indexOf("is-ready") >= 0 : state.statusClass.indexOf("is-missing") >= 0, state.statusClass);
    check("图库状态文案", ready ? /图库已接入|Image pack ready/i.test(state.statusText) && /83/.test(state.statusText) : /未加载|not loaded|missing/i.test(state.statusText), state.statusText);
    check("图库重新检测入口", ready ? state.retryHidden === true : state.retryHidden === false, state.retryHidden);
    check("缺包时自动背景开关禁用", ready ? state.autoDisabled === false : state.autoDisabled === true, state.autoDisabled);
    check("九层全部渲染", state.layers === 9, state.layers);
    check("背景/前景两个折叠组", state.groups.length === 2 && state.groups[0].open === true && state.groups[1].open === false, state.groups);
    check("缺包提示可见性符合期望", ready ? state.hints.every((h) => h.hidden === true) : state.hints.some((h) => h.hidden === false), state.hints);
    check("图库目录 83 项", state.catalog === 83, state.catalog);
    check("真实 getImage 可读", ready ? (state.image && state.image.kind.indexOf("data:image") === 0 && state.image.length > 10000) : (!state.image || state.image === "null"), state.image);
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
        missing: picks.filter((n) => n.classList.contains("is-missing")).length,
        loaded: loaded.length,
        firstLabel: picks[0] ? (picks[0].querySelector(".ml-deco-pick-label") || {}).textContent : null,
        firstImage: loaded[0] ? loaded[0].getAttribute("src").slice(0, 22) : null,
        labelsWithMissing: picks.slice(0, 5).filter((n) => /图片缺失|Image missing/i.test((n.textContent || ""))).length
      };
    });
    check("图库选择器可打开", picker.opened === true, picker);
    check("图库缩略图 84 项（83 图 + 无）", pickerState && pickerState.count === 84, pickerState && pickerState.count);
    check("缺包时可见缩略图全部缺图", ready || (pickerState && pickerState.missing > 0 && pickerState.loaded === 0), pickerState && { missing: pickerState.missing, loaded: pickerState.loaded });
    check("装包后首屏缩略图真实加载", !ready || (pickerState && pickerState.loaded > 0 && pickerState.firstImage && pickerState.firstImage.indexOf("data:image") === 0), pickerState);
    check("装包后图库项不再误报缺图", !ready || (pickerState && pickerState.labelsWithMissing === 0 && !/图片缺失|Image missing/i.test(pickerState.firstLabel || "")), pickerState);

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
