/* 灯台 MapleLantern — 原生 UI 手机态量测（Edge / file://，390×844） */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/tools/moli-cdp/node_modules/playwright-core");

const ROOT = path.join(__dirname, "..");
const PROJECT = path.join(ROOT, "..");
const GAME = path.join(PROJECT, "game", "Degrees of Lewdity.html");
const IMPORT = path.join(PROJECT, "game", "mce-mod-import.html");
const ZIP = path.join(ROOT, "dist", "MapleLantern-1.1.3.mod.zip");
const PROFILE = path.join(os.tmpdir(), "lantern-native-profile");
const SHOTS = path.join(ROOT, "prototype", "shots");

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
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
    args: ["--disable-gpu", "--no-first-run", "--allow-file-access-from-files"]
  });
  const errors = [];
  ctx.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));

  try {
    const imp = await ctx.newPage();
    await imp.goto(fileUrl(IMPORT), { waitUntil: "load", timeout: 60000 });
    await imp.waitForFunction(() => document.querySelector("#current") && !document.querySelector("#current").textContent.includes("读取中"), null, { timeout: 30000 });
    await imp.setInputFiles("#files", ZIP);
    await imp.click("#btnImport");
    await imp.waitForFunction(() => document.querySelector("#log").textContent.includes("完成。"), null, { timeout: 30000 });
    await imp.evaluate(() => { try { localStorage.removeItem("MapleLantern.settings.v1"); } catch (e) {} });

    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(fileUrl(GAME), { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector("#ml-root", { timeout: 180000 });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const dlg = document.querySelector("#ui-dialog");
      if (!dlg || !dlg.classList.contains("open")) { return; }
      const cb = dlg.querySelector('input[type="checkbox"]');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
      const enter = Array.from(dlg.querySelectorAll("button")).find((b) => /enter|进入/i.test(b.textContent || ""));
      if (enter) { enter.click(); }
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("#passages a, #passages button"));
      const target = nodes.find((a) => /Start Game|开始游戏/i.test(a.textContent || ""));
      if (target) { target.click(); }
    });
    await page.waitForFunction(() => window.State && window.State.passage === "Start2", null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);

    const collapsed = await page.evaluate(() => {
      const rail = document.querySelector("#mobileStats");
      const stats = document.querySelector("#stats .centered-elements");
      const statCards = Array.from(document.querySelectorAll("#statmeters > div[id$=\"caption\"]"));
      const opt = document.querySelector("#passages a.link-internal.macro-link");
      return {
        viewport: { w: innerWidth, h: innerHeight },
        native: document.documentElement.getAttribute("data-ml-native"),
        bodyScroll: { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight },
        rail: rail ? { w: Math.round(rail.getBoundingClientRect().width), h: Math.round(rail.getBoundingClientRect().height), mode: getComputedStyle(rail).writingMode } : null,
        statCards: statCards.map((n) => ({ key: n.getAttribute("data-ml-stat-key"), value: n.getAttribute("data-ml-value"), w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) })),
        option: opt ? { w: Math.round(opt.getBoundingClientRect().width), h: Math.round(opt.getBoundingClientRect().height), display: getComputedStyle(opt).display, left: Math.round(opt.getBoundingClientRect().left), right: Math.round(opt.getBoundingClientRect().right) } : null,
        stats: stats ? Array.from(stats.children).map((n) => ({ chip: n.getAttribute("data-ml-chip"), w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) })) : [],
        statsHtml: stats ? stats.outerHTML : null,
        card0Html: statCards[0] ? statCards[0].outerHTML : null,
        sidebarHidden: !!(document.querySelector("#ui-bar") && getComputedStyle(document.querySelector("#ui-bar")).visibility === "hidden")
      };
    });
    await page.screenshot({ path: path.join(SHOTS, "native-mobile-collapsed.png") });

    /* 展开侧栏，量 #stats / #statmeters / 按钮的真实几何 */
    await page.evaluate(() => {
      const t = document.querySelector("#ui-bar-toggle");
      if (t) { t.click(); }
    });
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => {
      const stats = document.querySelector("#stats .centered-elements");
      const statCards = Array.from(document.querySelectorAll("#statmeters > div[id$=\"caption\"]"));
      const buttons = Array.from(document.querySelectorAll("#overlayButtons button"));
      const close = document.querySelector(".customOverlayClose");
      return {
        sidebar: (() => { const b = document.querySelector("#ui-bar"); return b ? { w: Math.round(b.getBoundingClientRect().width), visibility: getComputedStyle(b).visibility } : null; })(),
        stats: stats ? Array.from(stats.children).map((n) => ({ chip: n.getAttribute("data-ml-chip"), w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) })) : [],
        statsHtml: stats ? stats.outerHTML : null,
        card0Html: statCards[0] ? statCards[0].outerHTML : null,
        statCards: statCards.map((n) => ({ key: n.getAttribute("data-ml-stat-key"), value: n.getAttribute("data-ml-value"), w: Math.round(n.getBoundingClientRect().width), h: Math.round(n.getBoundingClientRect().height) })),
        buttons: buttons.map((b) => ({ t: (b.textContent || "").trim(), h: Math.round(b.getBoundingClientRect().height) })),
        close: close ? { w: Math.round(close.getBoundingClientRect().width), h: Math.round(close.getBoundingClientRect().height) } : null
      };
    });
    await page.screenshot({ path: path.join(SHOTS, "native-mobile-open.png") });

    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("#overlayButtons button"));
      const opt = buttons.find((b) => /OPTIONS|选项/i.test(b.textContent || ""));
      if (opt) { opt.click(); }
    });
    await page.waitForTimeout(500);
    const options = await page.evaluate(() => {
      const overlay = document.querySelector("#customOverlay");
      const content = document.querySelector("#customOverlayContent");
      const entry = document.querySelector('#customOverlay [data-ml-entry="panel"]');
      const close = document.querySelector(".customOverlayClose");
      return {
        hidden: !overlay || overlay.classList.contains("hidden"),
        key: overlay ? overlay.getAttribute("data-ml-overlay") : null,
        overlay: overlay ? { x: Math.round(overlay.getBoundingClientRect().x), y: Math.round(overlay.getBoundingClientRect().y), w: Math.round(overlay.getBoundingClientRect().width), h: Math.round(overlay.getBoundingClientRect().height) } : null,
        style: overlay ? { position: getComputedStyle(overlay).position, left: getComputedStyle(overlay).left, right: getComputedStyle(overlay).right, transform: getComputedStyle(overlay).transform, parent: overlay.parentElement ? overlay.parentElement.id || overlay.parentElement.className : null } : null,
        content: content ? { w: Math.round(content.getBoundingClientRect().width), h: Math.round(content.getBoundingClientRect().height), scroll: content.scrollHeight } : null,
        entry: entry ? { w: Math.round(entry.getBoundingClientRect().width), h: Math.round(entry.getBoundingClientRect().height), text: entry.textContent } : null,
        close: close ? { w: Math.round(close.getBoundingClientRect().width), h: Math.round(close.getBoundingClientRect().height) } : null
      };
    });
    await page.screenshot({ path: path.join(SHOTS, "native-mobile-options.png") });

    const out = { collapsed, opened, options, errors };
    fs.writeFileSync(path.join(os.tmpdir(), "native-probe.json"), JSON.stringify(out, null, 2), "utf8");
    console.log(JSON.stringify(out, null, 2));
    if (errors.length) { process.exitCode = 1; }
  } finally {
    await ctx.close();
  }
})();
