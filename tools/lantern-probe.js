/* ============================================================================
 * lantern-probe.js — 真实布局量测（moli serve + CDP + playwright-core）
 *
 * 为什么每页签都要重新加载：moli 的布局是 on-demand 的，一次页面加载只刷新一次；
 * 脚本改 DOM 之后几何不会重算（官方说明 "Script mutations do not refresh it"）。
 * 因此「点页签再量」量到的是旧排版——必须用 seed 参数重开页面。
 *
 * 判据：面板不越界、五页签内容区不横向溢出、主操作区 ≥44、z 序低于原生 overlay。
 * 用法：moli serve -p 9333 --layout --image（后台）
 *       node lantern-probe.js [--port 9333] [--out <dir>]
 * ========================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "..", "tools", "moli-cdp", "node_modules", "playwright-core"));

const args = process.argv.slice(2);
const PORT = args.includes("--port") ? args[args.indexOf("--port") + 1] : "9333";
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "http://127.0.0.1:8766";
const OUT = args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join(__dirname, "..", "prototype", "shots");
const PAGE = BASE + "/prototype/index.html";
const TABS = ["now", "vitals", "worn", "system", "settings"];

const CASES = [
  { name: "390-mobile", w: 390, h: 844, qs: "?hud=0" },
  { name: "320-mobile", w: 320, h: 568, qs: "?hud=0" },
  { name: "844-landscape", w: 844, h: 390, qs: "?hud=0" },
  { name: "1280-desktop", w: 1280, h: 720, qs: "?hud=0" },
  { name: "1280-zh", w: 1280, h: 720, qs: "?hud=0&lang=zh" },
  { name: "1920-desktop", w: 1920, h: 1080, qs: "?hud=0" },
  { name: "1280-host", w: 1280, h: 720, qs: "?hud=0&host=1" },
  { name: "320-scale140-en", w: 320, h: 568, qs: "?hud=0&scale=140&lang=en&theme=jade" }
];

let fails = 0;
const rows = [];

function check(label, ok, detail) {
  if (!ok) { fails++; }
  console.log((ok ? "[PASS] " : "[FAIL] ") + label + (detail ? " — " + detail : ""));
}
const r2 = (n) => Math.round(n * 100) / 100;
const withQs = (base, extra) => base + (base.indexOf("?") >= 0 ? "&" : "?") + extra;

async function measure(page) {
  return page.evaluate(() => {
    const root = document.getElementById("ml-root");
    const panel = document.getElementById("ml-panel");
    const orb = document.getElementById("ml-orb");
    const body = panel.querySelector(".ml-body");
    const pane = panel.querySelector(".ml-pane");
    const rect = (n) => {
      const r = n.getBoundingClientRect();
      return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
    };
    const visible = (n) => n.offsetWidth > 0 && n.offsetHeight > 0;
    const buttons = Array.prototype.slice
      .call(panel.querySelectorAll("button"))
      .filter(visible)
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { cls: b.className, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, min: Math.round(Math.min(r.width, r.height) * 10) / 10 };
      });
    return {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      sheet: root.getAttribute("data-sheet") === "1",
      zone: root.getAttribute("data-orb-zone"),
      panel: rect(panel),
      orb: rect(orb),
      orbOpacity: getComputedStyle(orb).opacity,
      panelScroll: { sw: panel.scrollWidth, cw: panel.clientWidth },
      bodyScroll: { sh: body.scrollHeight, ch: body.clientHeight },
      bodyWidth: { sw: body.scrollWidth, cw: body.clientWidth },
      doc: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
      buttons: buttons,
      z: getComputedStyle(root).zIndex,
      accent: getComputedStyle(root).getPropertyValue("--ml-accent").trim(),
      tabFont: getComputedStyle(panel.querySelector(".ml-tab-label")).fontSize,
      paneLabel: pane ? pane.getAttribute("aria-labelledby") : null,
      paneText: pane ? (pane.textContent || "").slice(0, 24) : null,
      nodes: root.querySelectorAll("*").length,
      orbLabel: orb.getAttribute("aria-label"),
      panelLabel: panel.getAttribute("aria-label")
    };
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.connectOverCDP("http://127.0.0.1:" + PORT);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] || await ctx.newPage();
  const client = await ctx.newCDPSession(page);

  for (const c of CASES) {
    await client.send("Emulation.setDeviceMetricsOverride", { width: c.w, height: c.h, deviceScaleFactor: 1, mobile: false });
    const caseRows = [];

    for (const tab of TABS) {
      const url = withQs(PAGE + c.qs, "tab=" + tab);
      await page.goto(url, { waitUntil: "load", timeout: 60000 });
      await page.waitForFunction(() => window.MapleLantern && document.getElementById("ml-orb"), null, { timeout: 30000 });
      await page.evaluate(() => window.MapleLantern.open());
      await page.waitForTimeout(260);

      /* 这次截图触发本页第一次也是唯一一次真实排版 */
      const shot = path.join(OUT, c.name + "--" + tab + ".png");
      await page.screenshot({ path: shot });
      const magic = fs.readFileSync(shot).subarray(0, 4).toString("hex");
      check(c.name + "/" + tab + " 截图 PNG 魔数", magic === "89504e47", shot);

      const m = await measure(page);
      const tag = c.name + "/" + tab;
      check(tag + " 正确页签渲染", m.paneLabel === "ml-tab-" + tab, m.paneLabel || "null");

      const insideX = m.panel.l >= -0.5 && m.panel.r <= m.viewport.w + 0.5;
      const insideY = m.panel.t >= -0.5 && m.panel.b <= m.viewport.h + 0.5;
      check(tag + " 面板不越界", insideX && insideY,
        `x=${r2(m.panel.l)}..${r2(m.panel.r)}/${m.viewport.w} y=${r2(m.panel.t)}..${r2(m.panel.b)}/${m.viewport.h}`);
      check(tag + " 内容区无横向溢出", m.bodyWidth.sw <= m.bodyWidth.cw + 1, `${m.bodyWidth.sw}/${m.bodyWidth.cw}`);

      const bad = m.buttons.filter((b) => b.min < 43.5);
      check(tag + " 操作区 ≥44px", bad.length === 0, bad.length ? JSON.stringify(bad.slice(0, 3)) : `${m.buttons.length} 个按钮`);

      if (tab === "now") {
        check(tag + " 页面无横向滚动", m.doc.sw <= m.doc.cw + 1, `${m.doc.sw}/${m.doc.cw}`);
        check(tag + " orb 尺寸 ≥44", Math.min(m.orb.w, m.orb.h) >= 44, `${r2(m.orb.w)}×${r2(m.orb.h)}`);
        check(tag + " orb 在视口内", m.orb.l >= 0 && m.orb.t >= 0 && m.orb.r <= m.viewport.w && m.orb.b <= m.viewport.h, `${r2(m.orb.l)},${r2(m.orb.t)}`);
        check(tag + " 面板与 orb 不重叠（抽屉下球让位）",
          m.sheet ? parseFloat(m.orbOpacity) < 0.1
                  : (m.panel.b <= m.orb.t + 0.5 || m.panel.t >= m.orb.b - 0.5 || m.panel.r <= m.orb.l || m.panel.l >= m.orb.r),
          `sheet=${m.sheet} opacity=${m.orbOpacity} panel=${r2(m.panel.t)}..${r2(m.panel.b)} orb=${r2(m.orb.t)}..${r2(m.orb.b)}`);
        check(tag + " aria 标签齐全", !!m.orbLabel && !!m.panelLabel, `${m.orbLabel || "-"} / ${m.panelLabel || "-"}`);
      }

      if (c.name === "1280-host" && tab === "now") {
        check("host 按钮反制（min-height 44 而非 66）", m.buttons.every((b) => b.h === 44), JSON.stringify(m.buttons.map((b) => b.cls + ":" + b.h)));
        check("host 字号跟随（12 * 1.35 = 16.2）", Math.abs(parseFloat(m.tabFont) - 16.2) < 0.6, m.tabFont);
        check("host accent 转发（#7FB2FF）", /127, 178, 255/i.test(m.accent) || /#7fb2ff/i.test(m.accent), m.accent);
      }
      if (c.name === "1280-desktop" && tab === "now") {
        check("桌面浮卡宽度 380", Math.abs(m.panel.w - 380) < 0.8, r2(m.panel.w));
        check("层叠 z=89900（低于 SugarCube overlay 100000）", m.z === "89900", m.z);
      }
      if ((c.name === "390-mobile" || c.name === "320-mobile" || c.name === "844-landscape") && tab === "now") {
        check(c.name + " 使用抽屉模式", m.sheet === true, String(m.sheet));
      }
      if (c.name === "320-scale140-en" && tab === "now") {
        check("140% 字号内容区不溢出", m.bodyWidth.sw <= m.bodyWidth.cw + 1, `${m.bodyWidth.sw}/${m.bodyWidth.cw}`);
      }

      caseRows.push({
        tab, bodyWidth: m.bodyWidth, bodyScroll: m.bodyScroll, minButton: Math.min.apply(null, m.buttons.map((b) => b.min)),
        nodes: m.nodes, panel: { x: Math.round(m.panel.l), y: Math.round(m.panel.t), w: Math.round(m.panel.w), h: Math.round(m.panel.h) }
      });
    }

    rows.push({ case: c.name, viewport: { w: c.w, h: c.h }, tabs: caseRows });
  }

  await client.send("Emulation.clearDeviceMetricsOverride").catch(() => {});
  await browser.close();
  fs.writeFileSync(path.join(OUT, "measure.json"), JSON.stringify(rows, null, 2), "utf8");
  console.log("\n== 结果: " + (fails === 0 ? "全部通过" : fails + " 项失败"));
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error("FAIL: " + e.stack); process.exit(1); });
