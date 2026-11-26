/* 灯台 MapleLantern — 衣柜衣物行卡片的样式契约
 * 判据来源：2026-11-26 用户实机截图（1080×2354，衣柜 85 件鞋）：
 *  1) 图标停在卡外上方（裸 img.icon 被原版负 margin/绝对定位带出 .ml-option-group）；
 *  2) 衣物行只有半宽：.wardrobe-action 的 50% 宽度被衣物行共用，右边永远空一半。
 * 这里直接锁源码：衣物行必须是整宽 flex 行卡、图标 reset 回普通流、正文包进 .ml-ward-body；
 * 无图标的动作按钮（Strip / Towel）仍保留两列胶囊，不许被一起改宽。
 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const CSS = fs.readFileSync(path.join(SRC, "maplelantern-native.css"), "utf8");

function ruleBodies(sel) {
  const out = [];
  const escaped = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /* 允许选择器出现在逗号分隔的选择器组里：只要求这段选择器后面跟 { 或 ,…{ */
  const re = new RegExp("(?:^|\\n)" + escaped + "[^{}]*\\{([^}]*)\\}", "g");
  let m;
  while ((m = re.exec(CSS))) { out.push(m[1]); }
  return out;
}

test("衣柜衣物行：整宽行卡 + 图标回到普通流 + 正文包裹层", () => {
  const card = ruleBodies('html[data-ml-native="on"] #passages .passage .wardrobeItem[data-ml-ward-item="1"]');
  assert.ok(card.length >= 1, "缺少衣物行卡规则");
  assert.match(card[0], /display:\s*flex/, "衣物行必须是 flex 行卡");
  assert.match(card[0], /width:\s*100%/, "衣物行必须整宽，不能沿用动作按钮的 50%");
  assert.match(card[0], /border-radius:\s*12px/, "衣物行要圆角卡");

  const icon = ruleBodies('html[data-ml-native="on"] #passages .passage .wardrobeItem[data-ml-ward-item="1"] > img.icon');
  assert.ok(icon.length >= 1, "缺少衣物图标 reset 规则");
  assert.match(icon[0], /position:\s*static/, "裸 img.icon 必须回到普通流，否则会停在卡外上方");
  assert.match(icon[0], /margin:\s*0/, "原版负 margin 必须清零");
  assert.match(icon[0], /width:\s*38px/, "图标固定 38px 列宽");

  const body = ruleBodies('html[data-ml-native="on"] #passages .passage .wardrobeItem[data-ml-ward-item="1"] > .ml-ward-body');
  assert.ok(body.length >= 1, "缺少 .ml-ward-body 规则");
  assert.match(body[0], /flex:\s*1 1 auto/, "正文必须占满剩余宽度");
});

test("动作按钮仍是两列，不受衣物行改动影响", () => {
  const action = ruleBodies('html[data-ml-native="on"] #passages .passage .wardrobe-action');
  assert.ok(action.length >= 1, "缺少动作按钮规则");
  assert.match(action[0], /width:\s*calc\(50% - 4px\)/, "无图标的动作按钮保持两列");
});

test("裸 img.icon 进入选项卡时也要归位（不只 .icon-container）", () => {
  const bare = ruleBodies('html[data-ml-native="on"][data-ml-opt-options="1"] #passages .passage .ml-option-group > img.icon');
  assert.ok(bare.length >= 1, "缺少选项卡裸图标规则");
  assert.match(bare[0], /position:\s*(relative|static)/, "裸图标必须脱离原版绝对定位");
  assert.match(bare[0], /top:\s*auto/, "原版 top 偏移必须清零");
});
