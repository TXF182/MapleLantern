/* 灯台 MapleLantern — 原版侧栏 8 个入口的实机走查（Edge / file://，390×844） */
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
const PROFILE = path.join(os.tmpdir(), "lantern-pages-profile");
const SHOTS = path.join(ROOT, "prototype", "shots");
const EDGES = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"
];
const EDGE = EDGES.find((p) => fs.existsSync(p));
const fileUrl = (p) => "file:///" + p.replace(/\\/g, "/").replace(/#/g, "%23");

(async () => {
  if (!EDGE) { throw new Error("找不到 msedge.exe"); }
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
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const target = Array.from(document.querySelectorAll("#passages a, #passages button")).find((a) => /Start Game|开始游戏/i.test(a.textContent || ""));
      if (target) { target.click(); }
    });
    await page.waitForFunction(() => window.State && window.State.passage === "Start2", null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(() => { const t = document.querySelector("#ui-bar-toggle"); if (t) { t.click(); } });
    await page.waitForTimeout(400);

    const names = ["CHARACTERISTICS", "SOCIAL", "TRAITS", "JOURNAL", "STATS", "FEATS", "OPTIONS", "SAVES"];
    const results = [];
    for (const name of names) {
      const clicked = await page.evaluate((label) => {
        const b = Array.from(document.querySelectorAll("#overlayButtons button")).find((x) => (x.textContent || "").trim() === label);
        if (!b) { return false; }
        b.click();
        return true;
      }, name);
      await page.waitForTimeout(350);
      const data = await page.evaluate(() => {
        const overlay = document.querySelector("#customOverlay");
        const dialog = document.querySelector("#ui-dialog");
        const content = document.querySelector("#customOverlayContent");
        return {
          overlayHidden: !overlay || overlay.classList.contains("hidden"),
          key: overlay ? overlay.getAttribute("data-ml-overlay") : null,
          title: (document.querySelector("#customOverlayTitle") && document.querySelector("#customOverlayTitle").textContent || "").trim(),
          overlay: overlay ? { x: Math.round(overlay.getBoundingClientRect().x), y: Math.round(overlay.getBoundingClientRect().y), w: Math.round(overlay.getBoundingClientRect().width), h: Math.round(overlay.getBoundingClientRect().height) } : null,
          content: content ? { w: Math.round(content.getBoundingClientRect().width), h: Math.round(content.getBoundingClientRect().height), scroll: content.scrollHeight } : null,
          entry: !!document.querySelector('#customOverlay [data-ml-entry="panel"]'),
          close: (() => { const c = document.querySelector(".customOverlayClose"); return c ? { w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) } : null; })(),
          dialogOpen: !!(dialog && dialog.classList.contains("open")),
          z: (() => {
            const pick = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).zIndex : null; };
            return { overlay: overlay ? getComputedStyle(overlay).zIndex : null, container: pick("#customOverlayContainer"), bar: pick("#ui-bar"), statmeters: pick("#statmeters"), card: pick("#statmeters > div[id$=caption]") };
          })(),
          bodyW: document.documentElement.scrollWidth
        };
      });
      await page.screenshot({ path: path.join(SHOTS, "native-page-" + name.toLowerCase() + ".png") });
      await page.evaluate(() => {
        if (typeof window.closeOverlay === "function") { window.closeOverlay(); return; }
        const c = document.querySelector(".customOverlayClose");
        if (c) { c.click(); }
      });
      await page.waitForTimeout(200);
      results.push({ name, clicked, ...data });
    }
    fs.writeFileSync(path.join(os.tmpdir(), "native-pages.json"), JSON.stringify({ results, errors }, null, 2), "utf8");
    console.log(JSON.stringify({ results, errors }, null, 2));
    if (errors.length) { process.exitCode = 1; }
  } finally {
    await ctx.close();
  }
})();
