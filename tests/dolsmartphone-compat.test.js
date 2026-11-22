/* 灯台 MapleLantern — DolSmartPhone 兼容规则静态契约测试 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cssPath = path.join(__dirname, "..", "src", "maplelantern-native.css");
const css = fs.readFileSync(cssPath, "utf8");

const SCOPE = 'html[data-ml-native="on"] #phone-popup-container .phone-popup > .customOverlayClose';

test("DolSmartPhone 弹窗关闭键命中 24px 作用域覆盖，且排在 44px 通用规则之后", () => {
  const generic = css.indexOf('html[data-ml-native="on"] .customOverlayClose {');
  const scoped = css.indexOf(SCOPE + " {");
  assert.ok(generic >= 0, "缺少灯台通用 .customOverlayClose 规则");
  assert.ok(scoped >= 0, "缺少 DolSmartPhone 弹窗作用域覆盖");
  assert.ok(scoped > generic, "作用域覆盖必须排在通用 44px 规则之后");

  const block = css.slice(scoped, css.indexOf("}", scoped) + 1);
  for (const declaration of [
    "width: 24px;",
    "height: 24px;",
    "right: 12px;",
    "top: 0;",
    "border-radius: 0;",
    "opacity: .5;",
    "background: transparent;"
  ]) {
    assert.ok(block.includes(declaration), "24px 覆盖缺少声明: " + declaration);
  }
});

test("DolSmartPhone 关闭键的 X 线宽/长度回退到宿主原版 3px × 24px", () => {
  const pseudo = css.indexOf(SCOPE + "::before");
  assert.ok(pseudo >= 0, "缺少 ::before 作用域覆盖");
  const afterPseudo = css.indexOf(SCOPE + "::after");
  assert.ok(afterPseudo > pseudo, "缺少 ::after 作用域覆盖");

  const blockStart = css.lastIndexOf("{", pseudo);
  const blockEnd = css.indexOf("}", pseudo);
  const block = css.slice(blockStart, blockEnd + 1);
  for (const declaration of [
    "left: 10px;",
    "top: 0;",
    "width: 3px;",
    "height: 24px;",
    "background: var(--100);"
  ]) {
    assert.ok(block.includes(declaration), "X 线覆盖缺少声明: " + declaration);
  }
});

test("兼容覆盖不越界到灯台自己的遮罩关闭键", () => {
  assert.equal(css.split(SCOPE).length - 1, 4, "应有基础、hover、::before、::after 四组作用域规则");
  assert.ok(!css.includes('#phone-popup-container .customOverlayClose {'), "手机弹窗覆盖必须保留 .phone-popup > 直接子代限定");
});
