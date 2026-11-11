/* 只读：抓原版（无 Mod）真实 DOM，供“直接替换原版 UI”计划取证 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/tools/moli-cdp/node_modules/playwright-core");

const ROOT = path.join(__dirname, "..");
const GAME = path.join(ROOT, "..", "game", "Degrees of Lewdity.html");
const PROFILE = path.join(os.tmpdir(), "lantern-vanilla-profile");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

(async () => {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: EDGE, headless: true,
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 1
  });
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto("file:///" + GAME.replace(/\\/g, "/"), { waitUntil: "load", timeout: 120000 });
    await page.waitForTimeout(12000);
    await page.evaluate(() => {
      const cb = document.querySelector('#ui-dialog input[type="checkbox"]');
      if (cb) { cb.click(); }
      const btn = Array.from(document.querySelectorAll("#ui-dialog button")).find((b) => /Enter|进入|确认/i.test(b.textContent || ""));
      if (btn) { btn.click(); }
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const a = Array.from(document.querySelectorAll("#passages a, #passages button"))
        .find((x) => /Start Game|开始游戏/i.test(x.textContent || ""));
      if (a) { a.click(); }
    });
    await page.waitForTimeout(4000);
    for (let i = 0; i < 3; i++) {
      const cur = await page.evaluate(() => window.State && window.State.passage);
      if (cur !== "Start2") { break; }
      await page.evaluate(() => {
        const a = Array.from(document.querySelectorAll("#passages a"))
          .find((x) => /Next|(1)|继续|下一个/i.test(x.textContent || ""));
        if (a) { a.click(); }
      });
      await page.waitForTimeout(2500);
    }
    const data = await page.evaluate(() => {
      const sig = (el) => {
        if (!el) { return null; }
        const p = el.parentElement;
        return {
          tag: el.tagName.toLowerCase(), id: el.id || null, cls: el.className || null,
          text: (el.textContent || "").trim().slice(0, 90),
          parent: p ? { tag: p.tagName.toLowerCase(), id: p.id || null, cls: p.className || null } : null
        };
      };
      const leafMatch = (re) => Array.from(document.querySelectorAll("body *"))
        .filter((e) => e.children.length === 0 && re.test((e.textContent || "").trim()))
        .slice(0, 12).map(sig);
      const list = (sel) => Array.from(document.querySelectorAll(sel)).slice(0, 12).map(sig);
      const box = (el) => el ? {
        rect: el.getBoundingClientRect().toJSON(),
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        position: getComputedStyle(el).position,
        z: getComputedStyle(el).zIndex,
        overflow: getComputedStyle(el).overflow
      } : null;
      return {
        passage: window.State && window.State.passage,
        boxes: {
          uiBar: box(document.querySelector("#ui-bar")),
          stats: box(document.querySelector("#stats")),
          statmeters: box(document.querySelector("#statmeters")),
          mobileStats: box(document.querySelector("#mobileStats")),
          sidebarCaption: box(document.querySelector("#story-caption")),
          passage: box(document.querySelector("#passages"))
        },
        mobileStatsHtml: document.querySelector("#mobileStats") ? document.querySelector("#mobileStats").outerHTML.slice(0, 6000) : null,
        statmetersHtml: document.querySelector("#statmeters") ? document.querySelector("#statmeters").outerHTML.slice(0, 6000) : null,

        storyCaption: document.querySelector("#story-caption") ? document.querySelector("#story-caption").outerHTML : null,
        statsNode: document.querySelector("#stats") ? { html: document.querySelector("#stats").outerHTML, rect: document.querySelector("#stats").getBoundingClientRect().toJSON() } : null,
        uiBar: document.querySelector("#ui-bar") ? document.querySelector("#ui-bar").outerHTML : null,
        passages: document.querySelector("#passages") ? document.querySelector("#passages").outerHTML.slice(0, 12000) : null,
        moneyLeaves: leafMatch(/£|\\$|\\d+\\.\\d{2}/),
        timeLeaves: leafMatch(/^\\d{1,2}:\\d{2}$/),
        statEls: list(".stat, .meter, .meter > *, .statbar, .statbar *"),
        optionEls: Array.from(document.querySelectorAll("#passages a")).slice(0, 20).map((a) => ({
          text: (a.textContent || "").trim().slice(0, 80), cls: a.className,
          parent: a.parentElement && a.parentElement.className
        }))
      };
    });
    console.log(JSON.stringify(data, null, 2).slice(0, 30000));
    await page.evaluate(() => document.querySelector("#ui-bar-toggle")?.click());
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(ROOT, "prototype", "shots", "vanilla-sidebar-open.png") });
    await page.screenshot({ path: path.join(ROOT, "prototype", "shots", "vanilla-survey.png") });
  } finally {
    await ctx.close();
  }
})().catch((e) => { console.error(e.stack); process.exitCode = 2; });
