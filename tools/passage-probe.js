/* 剧情刷新实机探针：点击真实入口，确认面板场景随 :passageend 更新 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/tools/moli-cdp/node_modules/playwright-core");
const ROOT = path.join(__dirname, "..");
const GAME = path.join(ROOT, "..", "game", "Degrees of Lewdity.html");
const PROFILE = path.join(os.tmpdir(), "lantern-edge-profile");
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));
function fileUrl(p) { return "file:///" + p.replace(/\\/g, "/").replace(/#/g, "%23"); }

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: EDGE, headless: true, viewport: { width: 1280, height: 720 },
    args: ["--disable-gpu", "--no-first-run", "--allow-file-access-from-files"]
  });
  try {
    const page = await ctx.newPage();
    await page.goto(fileUrl(GAME), { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector("#ml-root", { timeout: 180000 });
    await page.evaluate(() => {
      const dlg = document.querySelector("#ui-dialog");
      if (!dlg || !dlg.classList.contains("open")) { return; }
      const cb = dlg.querySelector('input[type="checkbox"]');
      if (cb) { cb.checked = true; cb.dispatchEvent(new Event("change", { bubbles: true })); }
      const enter = Array.from(dlg.querySelectorAll("button")).find((b) => /enter|进入/i.test(b.textContent || ""));
      if (enter) { enter.click(); }
    });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.MapleLantern.open());
    await page.waitForTimeout(300);
    await page.click('[data-tab="now"]');
    const story = await page.evaluate(() => {
      const sc = window.SugarCube;
      const st = sc && sc.Story;
      return {
        keys: st ? Object.keys(st).slice(0, 20) : null,
        count: st && st.passages ? st.passages.length : null,
        candidates: ["Start", "Options", "Saves", "School Hallway", "Intro", "Character Creation"].map((n) => [n, !!(st && st.has && st.has(n))])
      };
    });
    console.log("STORY " + JSON.stringify(story));
    const before = await page.evaluate(() => ({
      passage: window.State && window.State.passage,
      scene: (function () {
        const cards = Array.from(document.querySelectorAll(".ml-stat"));
        const c = cards.find((x) => /场景|Scene/.test(x.textContent));
        return c ? c.querySelector(".ml-stat-v").textContent : null;
      })(),
      links: Array.from(document.querySelectorAll("#passages a, #passages button")).map((a) => (a.textContent || "").trim()).filter(Boolean).slice(0, 15)
    }));
    console.log("BEFORE " + JSON.stringify(before));
    const click = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("#passages a, #passages button"));
      const target = nodes.find((a) => /Start Game|开始游戏/i.test(a.textContent || ""));
      if (!target) { return false; }
      target.click();
      return true;
    });
    console.log("CLICK " + click);
    await page.waitForFunction((p) => window.State && window.State.passage !== p, before.passage, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({
      passage: window.State && window.State.passage,
      scene: (function () {
        const cards = Array.from(document.querySelectorAll(".ml-stat"));
        const c = cards.find((x) => /场景|Scene/.test(x.textContent));
        return c ? c.querySelector(".ml-stat-v").textContent : null;
      })(),
      pane: document.querySelector("#ml-pane-host").textContent.slice(0, 120)
    }));
    console.log("AFTER " + JSON.stringify(after));
  } finally { await ctx.close(); }
})().catch((e) => { console.error(e.stack); process.exitCode = 2; });
