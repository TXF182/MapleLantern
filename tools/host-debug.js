/* 宿主组合装载排障：只读打开游戏，收集 ModLoader 日志与控制台异常 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { chromium } = require("C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/tools/moli-cdp/node_modules/playwright-core");

const ROOT = path.join(__dirname, "..");
const PROJECT = path.join(ROOT, "..");
const GAME = path.join(PROJECT, "game", "Degrees of Lewdity.html");
const PROFILE = path.join(os.tmpdir(), "lantern-host-profile");
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find((p) => fs.existsSync(p));

function fileUrl(p) { return "file:///" + p.replace(/\\/g, "/").replace(/#/g, "%23"); }

(async () => {
  if (!EDGE) { throw new Error("找不到 msedge.exe"); }
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: EDGE,
    headless: true,
    viewport: { width: 1280, height: 720 },
    args: ["--disable-gpu", "--no-first-run", "--allow-file-access-from-files"]
  });
  const logs = [];
  const errors = [];
  ctx.on("page", (p) => {
    p.on("console", (m) => logs.push("[" + m.type() + "] " + m.text()));
    p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  });
  try {
    const page = await ctx.newPage();
    page.on("console", (m) => logs.push("[" + m.type() + "] " + m.text()));
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    await page.goto(fileUrl(GAME), { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForTimeout(25000);
    const state = await page.evaluate(() => ({
      title: document.title,
      passage: window.State && window.State.passage,
      mods: window.modDataZipList || null,
      values: window.modDataValueZipList ? window.modDataValueZipList.length : null,
      ml: !!(window.MapleLantern && window.MapleLantern.__mounted),
      core: !!window.MapleLanternCore,
      mlRoot: !!document.querySelector("#ml-root"),
      mlNodes: document.querySelectorAll("[id^='ml-']").length,
      scripts: Array.prototype.map.call(document.scripts, function (s) { return s.src; })
        .filter(function (s) { return /MapleLantern|\.mod|blob/i.test(s); }).slice(-20),
      body: document.body ? document.body.children.length : -1,
      dgu: !!(window.DoLGameUI && window.DoLGameUI.ui),
      host: !!(window.DoLGameUI && window.DoLGameUI.ui && window.DoLGameUI.ui.apiVersion === 1),
      types: window.modDataValueZipList ? window.modDataValueZipList.map((x) => typeof x) : null,
      initEnd: window.initEnd || null
    }));
    console.log("STATE " + JSON.stringify(state, null, 2));
    console.log("ERRORS\n" + errors.join("\n"));
    console.log("LOGS (tail)\n" + logs.slice(-80).join("\n"));
    await page.screenshot({ path: path.join(ROOT, "prototype", "shots", "host-debug.png") });
  } finally {
    await ctx.close();
  }
})().catch((e) => { console.error(e.stack); process.exitCode = 2; });
