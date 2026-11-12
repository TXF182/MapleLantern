/* 灯台 MapleLantern — 隔离 profile 的真实装载冒烟（Edge / file:// origin）
 *
 * 做什么：
 *   1. 用临时 user-data-dir 启动 Edge（不碰玩家真实 IndexedDB）；
 *   2. 打开 game\mce-mod-import.html，把 dist 里的 .mod.zip 导入该 profile 的 IndexedDB；
 *   3. 以 file:// 打开游戏，等 ModLoader 自举后检查 #ml-root 是否真的注入；
 *   4. 打开面板，量真实布局并截图。
 *
 * 用法：node tools\game-smoke.js
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
const ZIP = process.env.ML_ZIP || path.join(ROOT, "dist", "MapleLantern-1.1.3.mod.zip");
const SHOTS = path.join(ROOT, "prototype", "shots");
const HOST_MODE = process.env.HOST === "1";
const PROFILE = path.join(os.tmpdir(), HOST_MODE ? "lantern-host-profile" : "lantern-edge-profile");
const DOWNLOADS = path.join(process.env.USERPROFILE || "C:/Users/27352", "Downloads");
const HOST_PACKS = [
  path.join(DOWNLOADS, "Dynamicest-v3.3.mod.zip"),
  path.join(DOWNLOADS, "StoneFreeHost-0.1.5-experimental.mod (1).zip"),
  path.join(DOWNLOADS, "DoLGameUI-4.2.0.mod.zip")
];

const EDGES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
];
const EDGE = EDGES.find((p) => fs.existsSync(p));

function fileUrl(p) { return "file:///" + p.replace(/\\/g, "/").replace(/#/g, "%23"); }

(async () => {
  if (!EDGE) { throw new Error("找不到 msedge.exe"); }
  if (!fs.existsSync(ZIP)) { throw new Error("找不到包: " + ZIP); }
  if (HOST_MODE) {
    for (const p of HOST_PACKS) { if (!fs.existsSync(p)) { throw new Error("找不到参照包: " + p); } }
  }

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: EDGE,
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: ["--disable-gpu", "--no-first-run", "--allow-file-access-from-files"]
  });
  const errors = [];
  const failedReqs = [];
  const pageErrors = [];
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => { errors.push("pageerror: " + e.message); pageErrors.push(e.message); });
    p.on("requestfailed", (r) => failedReqs.push(r.url() + " :: " + (r.failure() && r.failure().errorText)));
  });

  try {
    const imp = await ctx.newPage();
    imp.on("pageerror", (e) => errors.push("import pageerror: " + e.message));
    await imp.goto(fileUrl(IMPORT), { waitUntil: "load", timeout: 60000 });
    await imp.waitForFunction(() => document.querySelector("#current") &&
      !document.querySelector("#current").textContent.includes("读取中"), null, { timeout: 30000 });
    await imp.setInputFiles("#files", HOST_MODE ? HOST_PACKS.concat([ZIP]) : ZIP);
    await imp.click("#btnImport");
    await imp.waitForFunction(() => document.querySelector("#log").textContent.includes("完成。"), null, { timeout: 30000 });
    const importLog = await imp.evaluate(() => document.querySelector("#log").textContent);
    /* 同一 file:// origin 的 localStorage 会跨轮保留：清掉上一轮选中的页签，保证测的是首次默认态 */
    await imp.evaluate(() => { try { localStorage.removeItem("MapleLantern.settings.v1"); } catch (e) {} });
    console.log("[1] 导入完成\n" + importLog.split("\n").slice(-4).join("\n"));

    const page = await ctx.newPage();
    page.on("pageerror", (e) => { errors.push("game pageerror: " + e.message); pageErrors.push(e.message); });
    page.on("requestfailed", (r) => failedReqs.push(r.url() + " :: " + (r.failure() && r.failure().errorText)));
    page.on("response", (r) => { if (r.status() >= 400) { failedReqs.push(r.url() + " :: HTTP " + r.status()); } });
    await page.goto(fileUrl(GAME), { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector("#ml-root", { timeout: 180000 });
    console.log("[2] ModLoader 自举完成，#ml-root 已注入");

    /* 游戏首次启动会弹年龄确认（#ui-dialog z=100100，按设计压在我们的面板之上）。
       先按真实玩家路径关掉它，再测面板交互。 */
    await page.evaluate(() => {
      const dlg = document.querySelector("#ui-dialog");
      if (!dlg || !dlg.classList.contains("open")) { return; }
      const cb = dlg.querySelector('input[type="checkbox"]');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
      const enter = Array.from(dlg.querySelectorAll("button")).find((b) => /enter|进入/i.test(b.textContent || ""));
      if (enter) { enter.click(); }
    });
    await page.waitForFunction(() => {
      const d = document.querySelector("#ui-dialog");
      return d && !d.classList.contains("open");
    }, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);

    const injected = await page.evaluate(() => ({
      version: window.StartConfig && window.StartConfig.version,
      sugarCube: window.SugarCube && window.SugarCube.Version,
      state: !!(window.State && window.State.variables),
      api: !!(window.MapleLantern && window.MapleLantern.__mounted),
      mods: window.modDataZipList ? window.modDataZipList.length : null,
      host: (function () {
        try {
          var ui = window.DoLGameUI && window.DoLGameUI.ui;
          if (!ui || ui.apiVersion !== 1 || typeof ui.getCapabilities !== "function") { return null; }
          var caps = ui.getCapabilities();
          var theme = ui.getTheme ? ui.getTheme() : null;
          return { apiVersion: ui.apiVersion, enabled: caps.enabled, layout: caps.layout,
            glass: caps.glass, backdropFilter: caps.backdropFilter,
            theme: theme && theme.id, tokens: theme && theme.tokens };
        } catch (e) { return { error: String(e && e.message || e) }; }
      })()
    }));
    console.log("[3] 注入状态: " + JSON.stringify(injected));

    await page.evaluate(() => window.MapleLantern.open());
    await page.waitForFunction(() => {
      const p = document.querySelector("#ml-panel");
      return p && !p.hidden && p.getAttribute("data-open") === "1";
    }, null, { timeout: 10000 });
    await page.waitForTimeout(600);

    const geo = await page.evaluate(() => {
      const orbNode = document.querySelector("#ml-orb");
      const orb = orbNode.getBoundingClientRect();
      const stats = document.querySelector("#stats .centered-elements");
      const statCards = Array.from(document.querySelectorAll("#statmeters > div[id$=\"caption\"]"));
      const opt = document.querySelector("#passages a.link-internal.macro-link");
      const native = document.documentElement.getAttribute("data-ml-native");
      const statsCards = stats ? Array.from(stats.children).map((n) => ({ chip: n.getAttribute("data-ml-chip"), h: Math.round(n.getBoundingClientRect().height), w: Math.round(n.getBoundingClientRect().width) })) : [];
      const panel = document.querySelector("#ml-panel").getBoundingClientRect();
      const root = getComputedStyle(document.querySelector("#ml-root"));
      const body = document.querySelector("#ml-pane-host");
      return {
        orb: { x: Math.round(orb.x), y: Math.round(orb.y), w: Math.round(orb.width), h: Math.round(orb.height), hidden: !!orbNode.hidden },
        panel: { x: Math.round(panel.x), y: Math.round(panel.y), w: Math.round(panel.width), h: Math.round(panel.height) },
        z: root.zIndex,
        sheet: document.querySelector("#ml-root").getAttribute("data-sheet"),
        side: document.querySelector("#ml-root").getAttribute("data-side"),
        theme: document.querySelector("#ml-root").getAttribute("data-theme"),
        body: { client: body.clientHeight, scroll: body.scrollHeight },
        tab: document.querySelector('.ml-tab[aria-selected="true"]').getAttribute("data-tab"),
        accent: getComputedStyle(document.querySelector('.ml-tab[aria-selected="true"]')).color,
        glass: document.querySelector("#ml-root").style.getPropertyValue("--ml-surface-alpha"),
        diag: window.MapleLantern.diagnostics(),
        native: native,
        statsCards: statsCards,
        statCards: statCards.map((n) => ({ key: n.getAttribute("data-ml-stat-key"), value: n.getAttribute("data-ml-value"), current: n.getAttribute("data-ml-current"), total: n.getAttribute("data-ml-total"), readout: n.getAttribute("data-ml-readout"), h: Math.round(n.getBoundingClientRect().height) })),
        option: opt ? { display: getComputedStyle(opt).display, w: Math.round(opt.getBoundingClientRect().width), h: Math.round(opt.getBoundingClientRect().height) } : null
      };
    });
    console.log("[4] 几何: " + JSON.stringify(geo));

    const settingsProbe = await page.evaluate(async () => {
      const root = document.querySelector("#ml-root");
      const panel = document.querySelector("#ml-panel");
      const filter = getComputedStyle(panel).backdropFilter || getComputedStyle(panel).webkitBackdropFilter || "";
      document.querySelector('[data-tab="settings"]').click();
      const jade = document.querySelector('.ml-seg-btn[data-value="jade"]');
      jade.focus();
      jade.click();
      const pane = document.querySelector("#ml-panel .ml-pane");
      window.__mlPane = pane;
      const focusBefore = document.activeElement === jade;
      if (window.jQuery) { window.jQuery(document).trigger(":passageend"); }
      else { document.dispatchEvent(new Event("passageend")); }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 80))));
      const result = {
        samePane: window.__mlPane === document.querySelector("#ml-panel .ml-pane"),
        focusStayed: focusBefore && document.activeElement === jade,
        theme: root.getAttribute("data-theme"),
        blurAttr: root.getAttribute("data-blur"),
        filter: filter
      };
      document.querySelector('.ml-seg-btn[data-value="auto"]').click();
      document.querySelector('[data-tab="now"]').click();
      return result;
    });
    console.log("[4b] 设置页: " + JSON.stringify(settingsProbe));

    fs.mkdirSync(SHOTS, { recursive: true });
    const prefix = HOST_MODE ? "host-real" : "game-real";
    await page.screenshot({ path: path.join(SHOTS, prefix + "-open.png") });
    await page.click('[data-tab="vitals"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, prefix + "-vitals.png") });
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, prefix + "-settings.png") });

    /* 真实 passage 切换：走游戏自己的“Start Game”，验证 :passageend → 面板场景跟随 */
    await page.click('[data-tab="now"]');
    const beforePassage = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".ml-stat"));
      const c = cards.find((x) => /场景|Scene/.test(x.textContent));
      return { passage: window.State && window.State.passage, scene: c ? c.querySelector(".ml-stat-v").textContent : null };
    });
    const started = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("#passages a, #passages button"));
      const target = nodes.find((a) => /Start Game|开始游戏/i.test(a.textContent || ""));
      if (!target) { return false; }
      target.click();
      return true;
    });
    await page.waitForFunction((p) => window.State && window.State.passage !== p, beforePassage.passage, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    const afterPassage = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll(".ml-stat"));
      const c = cards.find((x) => /场景|Scene/.test(x.textContent));
      const stats = document.querySelector("#stats .centered-elements");
      const statCards = Array.from(document.querySelectorAll("#statmeters > div[id$=\"caption\"]"));
      const opt = document.querySelector("#passages a.link-internal.macro-link");
      return { passage: window.State && window.State.passage, scene: c ? c.querySelector(".ml-stat-v").textContent : null,
        diag: window.MapleLantern.diagnostics(),
        native: document.documentElement.getAttribute("data-ml-native"),
        statsCards: stats ? Array.from(stats.children).map((n) => ({ chip: n.getAttribute("data-ml-chip"), h: Math.round(n.getBoundingClientRect().height), w: Math.round(n.getBoundingClientRect().width) })) : [],
        statCards: statCards.map((n) => ({ key: n.getAttribute("data-ml-stat-key"), value: n.getAttribute("data-ml-value"), current: n.getAttribute("data-ml-current"), total: n.getAttribute("data-ml-total"), readout: n.getAttribute("data-ml-readout"), h: Math.round(n.getBoundingClientRect().height) })),
        option: opt ? { display: getComputedStyle(opt).display, w: Math.round(opt.getBoundingClientRect().width), h: Math.round(opt.getBoundingClientRect().height) } : null };
    });
    await page.screenshot({ path: path.join(SHOTS, prefix + "-passage.png") });
    console.log("[5] passage: " + JSON.stringify({ started, before: beforePassage, after: afterPassage }));

    const checks = [
      ["游戏版本 0.5.12.13", injected.version === "0.5.12.13"],
      ["SugarCube State 可用", injected.state === true],
      ["MapleLantern 已挂载", injected.api === true],
      ["面板 380×504", geo.panel.w === 380 && geo.panel.h === 504],
      ["默认悬浮球隐藏", geo.orb.hidden === true],
      ["层叠 89900", geo.z === "89900"],
      ["桌面浮卡（非抽屉）", geo.sheet === "0"],
      ["默认页签 now", geo.tab === "now"],
      ["剧情切换后场景跟随", started && beforePassage.passage !== afterPassage.passage && afterPassage.scene === afterPassage.passage],
      ["设置页不被剧情推进重建", settingsProbe.samePane === true],
      ["设置页焦点保持", settingsProbe.focusStayed === true],
      ["模糊可用时保持 backdrop-filter", settingsProbe.blurAttr === "on" && !/none/i.test(settingsProbe.filter)],
      ["单次刷新 ≤ 16ms", typeof afterPassage.diag.renderMs === "number" && afterPassage.diag.renderMs > 0 && afterPassage.diag.renderMs <= 16],
      ["原生层默认开启", HOST_MODE ? true : afterPassage.native === "on"],
      ["金钱/时间/星期四格齐", HOST_MODE ? afterPassage.statsCards.length === 4 : (afterPassage.statsCards.length === 4 && afterPassage.statsCards.every((c) => c.chip && c.h >= 44))],
      ["状态大卡七行且有当前/上限", HOST_MODE ? afterPassage.statCards.length === 7 : (afterPassage.statCards.length === 7 && afterPassage.statCards.every((c) => c.key && c.readout && c.total && c.h >= 24))],
      ["正文选项为整行卡片", HOST_MODE ? !!afterPassage.option : (!!afterPassage.option && afterPassage.option.display === "flex" && afterPassage.option.w > 240 && afterPassage.option.h >= 44)],
      ["无未捕获异常", pageErrors.length === 0]
    ];
    if (HOST_MODE) {
      checks.push(
        ["宿主下原生层仍按玩家开关挂载", geo.native === "on"],
        ["宿主 DoLGameUI API v1", !!(injected.host && injected.host.apiVersion === 1)],
        ["宿主主题 token 已读", !!(injected.host && injected.host.tokens && injected.host.tokens.ocean)],
        ["宿主下仍为 380×504", geo.panel.w === 380 && geo.panel.h === 504],
        ["宿主下页面无异常", pageErrors.length === 0]
      );
    }
    let ok = true;
    for (const [name, pass] of checks) {
      console.log((pass ? "  PASS " : "  FAIL ") + name);
      if (!pass) { ok = false; }
    }
    if (pageErrors.length) { console.log("未捕获异常:\n" + pageErrors.join("\n")); }
    if (failedReqs.length) { console.log("失败请求 (" + failedReqs.length + "):\n" + failedReqs.join("\n")); }
    console.log(ok ? "SMOKE: PASS" : "SMOKE: FAIL");
    process.exitCode = ok ? 0 : 1;
  } finally {
    await ctx.close();
  }
})().catch((e) => { console.error("SMOKE: ERROR " + e.stack); process.exitCode = 2; });
