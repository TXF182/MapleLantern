/* 灯台 MapleLantern — 触屏 hover 守卫 / 面板正文留白 / 滚动惯性
 * 判据来源：2026-11-26 真机审计（Edge headless + CDP，390×844@2x）
 *  1) 悬停位移动效必须只对真悬停设备生效：触屏点完手指抬起后 :hover 残留，
 *     按钮会保持 translateY(-1px)/scale 位移态"漂着"，直到点别处才回位。
 *  2) sheet 面板正文 padding-bottom:16px 让着装页多出 5px 滚动（scrollHeight 421 / clientHeight 416）。
 *  3) .ml-body 必须保持唯一滚动容器语义：overscroll 隔离 + iOS 惯性。
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const CSS_FILES = ["style.css", "maplelantern-native.css", "effects.css", "custom.css", "deco.css", "ornaments.css"];

/* 粗粒度块扫描：返回每条普通规则的 { prelude, body, at[] }，at 记录外层 @media/@supports 前导。
   注释先剥掉，避免注释里的 :hover 或 transform 误伤。 */
function blocks(src) {
  const s = String(src).replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  const stack = [];
  let buf = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{") {
      const pre = buf.trim();
      buf = "";
      if (pre.startsWith("@")) {
        stack.push({ kind: "at", prelude: pre });
      } else {
        stack.push({
          kind: "rule",
          prelude: pre,
          body: "",
          at: stack.filter((f) => f.kind === "at").map((f) => f.prelude)
        });
      }
      continue;
    }
    if (ch === "}") {
      const top = stack.pop();
      if (top && top.kind === "rule") { out.push(top); }
      buf = "";
      continue;
    }
    if (stack.length && stack[stack.length - 1].kind === "rule") {
      stack[stack.length - 1].body += ch;
    } else {
      buf += ch;
    }
  }
  return out;
}

const READ = {};
for (const f of CSS_FILES) { READ[f] = fs.readFileSync(path.join(SRC, f), "utf8"); }

test("悬停位移动效：只允许出现在 @media (hover: hover) 内", () => {
  const offenders = [];
  for (const f of CSS_FILES) {
    for (const r of blocks(READ[f])) {
      if (!/:hover/.test(r.prelude)) { continue; }
      if (!/(?:^|;)\s*transform\s*:/.test(r.body)) { continue; }
      if (/transform\s*:\s*none/.test(r.body)) { continue; }
      const guarded = r.at.some((q) => /@media[^{]*\(hover:\s*hover\)/.test(q));
      if (!guarded) {
        offenders.push(f + " :: " + r.prelude.replace(/\s+/g, " "));
      }
    }
  }
  assert.deepEqual(offenders, [], "触屏会残留 hover 位移，以下规则必须包进 @media (hover: hover)：\n" + offenders.join("\n"));
});

test("悬停位移规则没有被整体删掉：桌面端仍保留至少 6 条", () => {
  let movers = 0;
  for (const f of CSS_FILES) {
    for (const r of blocks(READ[f])) {
      if (/:hover/.test(r.prelude) && /(?:^|;)\s*transform\s*:/.test(r.body) && !/transform\s*:\s*none/.test(r.body)) {
        if (r.at.some((q) => /@media[^{]*\(hover:\s*hover\)/.test(q))) { movers++; }
      }
    }
  }
  assert.ok(movers >= 6, "守卫不能靠删动效实现，实测桌面可悬停的位移动效有 10 条，现存 " + movers);
});

test("sheet 面板正文：底部留白回收到 10px，着装页 5px 溢出消除", () => {
  assert.match(
    READ["style.css"],
    /#ml-root\[data-sheet="1"\] \.ml-body \{\s*padding-bottom:\s*calc\(10px \+ var\(--ml-safe-b\)\)/,
    "sheet 正文底部 padding 必须为 calc(10px + safe-b)：16px 时着装页 scrollHeight 421 > clientHeight 416"
  );
});

test("面板正文滚动：overscroll 隔离与 iOS 惯性仍在唯一滚动容器上", () => {
  const rule = blocks(READ["style.css"]).find((r) => r.prelude.trim() === "#ml-root .ml-body");
  assert.ok(rule, "#ml-root .ml-body 规则必须存在");
  assert.match(rule.body, /overflow-y:\s*auto/);
  assert.match(rule.body, /overscroll-behavior:\s*contain/, "滚动链必须隔离，否则滚到底会带动整页");
  assert.match(rule.body, /-webkit-overflow-scrolling:\s*touch/, "老 iOS 需要惯性滚动");
});
