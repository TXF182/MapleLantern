/* 灯台 MapleLantern — 第三方模组联合装载冒烟（隔离 profile，真实游戏 DOM）
 *
 * 目的：验证 MapleLantern 与 Dynamicest 3.3 / 前景背景 5.12 / maplebirch 5.6.2
 * 同时装载时，两个第三方模组的设置入口仍可打开、控件仍可点击，且无未捕获异常。
 *
 * 用法：node tools\compat-smoke.js
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
const ZIP = process.env.ML_ZIP || path.join(ROOT, "dist", "MapleLantern-1.1.20-theme.mod.zip");
const PROFILE = path.join(os.tmpdir(), "lantern-compat-profile-" + Date.now());
const SHOTS = path.join(ROOT, "prototype", "shots");
const PACKS = [
  "C:/Users/27352/Downloads/Dynamicest-v3.3.mod.zip",
  "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/decorations前景背景5.12.zip",
  "C:/Users/27352/Doubao/chats/2026-10-19/new-chat/DoL-Project/game/maplebirch-0.5.12.13-v5.6.2.mod.zip"
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
  for (const p of PACKS) { if (!fs.existsSync(p)) { throw new Error("找不到参照包: " + p); } }

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: EDGE,
    headless: true,
    viewport: { width: 390, height: 844 },
    args: ["--disable-gpu", "--no-first-run", "--allow-file-access-from-files"]
  });
  const pageErrors = [];
  const failedReqs = [];
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => pageErrors.push(e.message));
    p.on("requestfailed", (r) => failedReqs.push(r.url() + " :: " + (r.failure() && r.failure().errorText)));
  });

  try {
    const imp = await ctx.newPage();
    imp.on("pageerror", (e) => pageErrors.push("import: " + e.message));
    await imp.goto(fileUrl(IMPORT), { waitUntil: "load", timeout: 60000 });
    await imp.waitForFunction(() => document.querySelector("#current") &&
      !document.querySelector("#current").textContent.includes("读取中"), null, { timeout: 30000 });
    await imp.setInputFiles("#files", PACKS.concat([ZIP]));
    await imp.click("#btnImport");
    await imp.waitForFunction(() => document.querySelector("#log").textContent.includes("完成。"), null, { timeout: 60000 });
    const importLog = await imp.evaluate(() => document.querySelector("#log").textContent);
    console.log("[1] 导入完成\n" + importLog.split("\n").slice(-6).join("\n"));

    const page = await ctx.newPage();
    page.on("pageerror", (e) => pageErrors.push("game: " + e.message));
    page.on("requestfailed", (r) => failedReqs.push(r.url() + " :: " + (r.failure() && r.failure().errorText)));
    await page.goto(fileUrl(GAME), { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.waitForSelector("#ml-root", { timeout: 180000 });
    console.log("[2] 游戏与 MapleLantern 已启动");
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
    await page.waitForTimeout(350);

    /* 从开场页进入实际游戏：前景背景入口只挂在游戏内主菜单。 */
    for (let i = 0; i < 4; i++) {
      const clicked = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll("button")).find((n) =>
          /start game|开始游戏|进入游戏/i.test((n.textContent || "").trim()) &&
          n.offsetParent && !n.disabled);
        if (!b) { return false; }
        b.click();
        return true;
      });
      if (!clicked) { break; }
      await page.waitForTimeout(700);
      const inGame = await page.evaluate(() => !!document.querySelector("#passages .passage") &&
        !/Start Game!/i.test(document.body.innerText || ""));
      if (inGame) { break; }
    }

    /* 框架首次启动会弹「我已知晓」；先关掉它，才能看到下面真正的第三方设置页。 */
    await page.evaluate(() => {
      const b = Array.from(document.querySelectorAll("button")).find((n) =>
        /我已知晓|I understand|知道了/i.test((n.textContent || "").trim()) && n.offsetParent);
      if (b) { b.click(); }
    });
    await page.waitForTimeout(500);

    const mods = await page.evaluate(() => ({
      mods: window.modDataZipList || [],
      mounted: !!(window.MapleLantern && window.MapleLantern.__mounted),
      maplebirch: !!window.maplebirch,
      dynamicest: !!window.Dynamicest,
      native: document.documentElement.getAttribute("data-ml-native"),
      decoMenu: Array.from(document.querySelectorAll("#ui-bar button, #ui-bar a")).map((n) => (n.textContent || "").trim()).filter((s) => /前景|背景|Deco/i.test(s))
    }));
    console.log("[3] 启动状态: " + JSON.stringify(mods));

    /* 打开 OPTIONS 弹层：优先用游戏真实入口按钮，避免直接操作内部状态。 */
    const openedOptions = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("#overlayButtons button, #menu button, #ui-bar button"));
      const b = candidates.find((n) => /选项|Options/i.test((n.textContent || "").trim()));
      if (!b) { return false; }
      b.click();
      return true;
    });
    await page.waitForFunction(() => {
      const o = document.querySelector("#customOverlay");
      return o && !o.classList.contains("hidden") && o.querySelector("#customOverlayContent");
    }, null, { timeout: 10000 });
    await page.waitForTimeout(300);

    const dynTab = await page.evaluate(() => {
      const tabs = document.querySelector("#customOverlay #overlayTabs");
      const b = tabs && Array.from(tabs.querySelectorAll("button")).find((n) => /极致动态|Dynamicest/i.test(n.textContent || ""));
      if (!b) { return false; }
      b.click();
      return true;
    });
    await page.waitForTimeout(350);
    const dyn = await page.evaluate(() => {
      const content = document.querySelector("#customOverlayContent");
      const overlay = document.querySelector("#customOverlay");
      const buttons = Array.from(content.querySelectorAll("button, input[type=button], input[type=checkbox]"));
      return {
        clicked: !!content.querySelector("img[src*='img/dynamicest'],h3"),
        text: (content.textContent || "").slice(0, 120).replace(/\s+/g, " "),
        data: { overlay: overlay.getAttribute("data-ml-overlay"), third: overlay.getAttribute("data-ml-thirdparty"), contentThird: content.getAttribute("data-ml-thirdparty") },
        controls: buttons.map((b) => ({ tag: b.tagName, type: b.getAttribute("type"), text: (b.textContent || b.getAttribute("value") || "").trim(), disabled: b.disabled, h: Math.round(b.getBoundingClientRect().height) })),
        contentH: content.clientHeight, contentScroll: content.scrollHeight,
        entryCount: content.querySelectorAll('[data-ml-entry="panel"]').length,
        overlay: { h: Math.round(overlay.getBoundingClientRect().height), overflow: getComputedStyle(overlay).overflow }
      };
    });
    console.log("[4] Dynamicest 设置页: " + JSON.stringify({ tab: dynTab, ...dyn }));
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(SHOTS, "compat-dynamicest.png") });

    /* 第二个模组从主菜单入口进：重载页面拿到干净的主菜单，不复用手动隐藏的弹层。 */
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
    await page.waitForFunction(() => {
      const d = document.querySelector("#ui-dialog");
      return d && !d.classList.contains("open");
    }, null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("#overlayButtons button, #menu button, #ui-bar button"));
      const b = candidates.find((n) => /选项|Options/i.test((n.textContent || "").trim()));
      if (b) { b.click(); }
    });
    await page.waitForFunction(() => {
      const o = document.querySelector("#customOverlay");
      return o && !o.classList.contains("hidden") && o.querySelector("#customOverlayContent");
    }, null, { timeout: 10000 });
    await page.waitForTimeout(300);
    const decoButton = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("button, a, [role=button]"));
      const hits = all.filter((n) => /前景背景|DecoMod/i.test((n.textContent || "").trim()));
      const sample = all.map((n) => (n.textContent || "").trim()).filter(Boolean).slice(0, 40);
      const bodyText = (document.body.innerText || "").includes("前景背景");
      const overlayText = (document.querySelector("#customOverlayContent") || {}).innerText || "";
      if (!hits.length) { return { found: false, sample, bodyText, overlayText: overlayText.slice(0, 200) }; }
      const b = hits[0];
      b.click();
      return { found: true, bodyText, hit: { text: (b.textContent || "").trim(), tag: b.tagName, parent: b.parentElement && b.parentElement.className } };
    });
    console.log("[4a] 前景背景入口探查: " + JSON.stringify(decoButton));


    await page.waitForTimeout(500);
    const deco = await page.evaluate(() => {
      const content = document.querySelector("#customOverlayContent");
      const selector = document.querySelector("#decoImageSelector");
      const overlay = document.querySelector("#customOverlay");
      const inputs = selector ? Array.from(selector.querySelectorAll("button, input")) : [];
      return {
        button: null,
        hasSelector: !!selector,
        hasPreset: !!document.querySelector("#decoImagePreset"),
        hasAuto: !!document.querySelector("#decoAutoBgSettings"),
        data: overlay ? { overlay: overlay.getAttribute("data-ml-overlay"), third: overlay.getAttribute("data-ml-thirdparty"), contentThird: content && content.getAttribute("data-ml-thirdparty") } : null,
        controls: inputs.slice(0, 8).map((b) => ({ tag: b.tagName, type: b.getAttribute("type"), text: (b.textContent || b.getAttribute("value") || "").trim(), disabled: b.disabled, h: Math.round(b.getBoundingClientRect().height) })),
        contentH: content ? content.clientHeight : null,
        contentScroll: content ? content.scrollHeight : null,
        entryCount: content ? content.querySelectorAll('[data-ml-entry="panel"]').length : 0
      };
    });
    console.log("[5] 前景背景设置页: " + JSON.stringify({ button: decoButton, ...deco }));
    await page.screenshot({ path: path.join(SHOTS, "compat-decorations.png") });

    const checks = [
      ["两个模组已装载", mods.dynamicest === true && decoButton.found === true],
      ["maplebirch 已就绪", mods.maplebirch === true],
      ["Dynamicest 设置页可由页签打开", dynTab && dyn.clicked],
      ["Dynamicest 被识别为第三方页", dyn.data.third === "dynamicest" && dyn.data.contentThird === "dynamicest"],
      ["Dynamicest 控件可点击（未 disabled）", dyn.controls.length > 0 && dyn.controls.every((c) => !c.disabled)],
      ["Dynamicest 面板未丢失", dyn.contentH > 0],
      ["Dynamicest 页未被塞灯台入口", dyn.entryCount === 0],
      ["前景背景入口存在", decoButton.found === true],
      ["前景背景设置页含三个区块", deco.hasSelector && deco.hasPreset && deco.hasAuto],
      ["前景背景被识别为第三方页", deco.data && deco.data.third === "decorations" && deco.data.contentThird === "decorations"],
      ["前景背景控件可点击（未 disabled）", deco.controls.length > 0 && deco.controls.every((c) => !c.disabled)],
      ["前景背景面板未丢失", deco.contentH > 0],
      ["前景背景页未被塞灯台入口", deco.entryCount === 0],
      ["无未捕获异常", pageErrors.length === 0]
    ];
    let ok = true;
    for (const [name, pass] of checks) {
      console.log((pass ? "  PASS " : "  FAIL ") + name);
      if (!pass) { ok = false; }
    }
    if (pageErrors.length) { console.log("未捕获异常:\n" + pageErrors.join("\n")); }
    if (failedReqs.length) { console.log("失败请求 (" + failedReqs.length + "):\n" + failedReqs.slice(0, 10).join("\n")); }
    console.log(ok ? "COMPAT: PASS" : "COMPAT: FAIL");
    process.exitCode = ok ? 0 : 1;
  } finally {
    await ctx.close();
  }
})().catch((e) => { console.error("COMPAT: ERROR " + e.stack); process.exitCode = 2; });
