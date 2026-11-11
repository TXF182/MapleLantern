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
const ZIP = path.join(ROOT, "dist", "MapleLantern-1.0.0.mod.zip");
const SHOTS = path.join(ROOT, "prototype", "shots");
const PROFILE = path.join(os.tmpdir(), "lantern-edge-profile");

const EDGES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
];
const EDGE = EDGES.find((p) => fs.existsSync(p));

function fileUrl(p) { return "file:///" + p.replace(/\\/g, "/").replace(/#/g, "%23"); }

(async () => {
  if (!EDGE) { throw new Error("找不到 msedge.exe"); }
  if (!fs.existsSync(ZIP)) { throw new Error("找不到包: " + ZIP); }

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
    await imp.setInputFiles("#files", ZIP);
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
      mods: window.modDataZipList ? window.modDataZipList.length : null
    }));
    console.log("[3] 注入状态: " + JSON.stringify(injected));

    await page.evaluate(() => window.MapleLantern.open());
    await page.waitForFunction(() => {
      const p = document.querySelector("#ml-panel");
      return p && !p.hidden && p.getAttribute("data-open") === "1";
    }, null, { timeout: 10000 });
    await page.waitForTimeout(600);

    const geo = await page.evaluate(() => {
      const orb = document.querySelector("#ml-orb").getBoundingClientRect();
      const panel = document.querySelector("#ml-panel").getBoundingClientRect();
      const root = getComputedStyle(document.querySelector("#ml-root"));
      const body = document.querySelector("#ml-pane-host");
      return {
        orb: { x: Math.round(orb.x), y: Math.round(orb.y), w: Math.round(orb.width), h: Math.round(orb.height) },
        panel: { x: Math.round(panel.x), y: Math.round(panel.y), w: Math.round(panel.width), h: Math.round(panel.height) },
        z: root.zIndex,
        sheet: document.querySelector("#ml-root").getAttribute("data-sheet"),
        side: document.querySelector("#ml-root").getAttribute("data-side"),
        theme: document.querySelector("#ml-root").getAttribute("data-theme"),
        body: { client: body.clientHeight, scroll: body.scrollHeight },
        tab: document.querySelector('.ml-tab[aria-selected="true"]').getAttribute("data-tab"),
        diag: window.MapleLantern.diagnostics()
      };
    });
    console.log("[4] 几何: " + JSON.stringify(geo));

    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "game-real-open.png") });
    await page.click('[data-tab="vitals"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, "game-real-vitals.png") });
    await page.click('[data-tab="settings"]');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, "game-real-settings.png") });

    const checks = [
      ["游戏版本 0.5.12.13", injected.version === "0.5.12.13"],
      ["SugarCube State 可用", injected.state === true],
      ["MapleLantern 已挂载", injected.api === true],
      ["面板 380×504", geo.panel.w === 380 && geo.panel.h === 504],
      ["悬浮球 56×56", geo.orb.w === 56 && geo.orb.h === 56],
      ["层叠 89900", geo.z === "89900"],
      ["桌面浮卡（非抽屉）", geo.sheet === "0"],
      ["默认页签 now", geo.tab === "now"],
      ["无未捕获异常", pageErrors.length === 0]
    ];
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
