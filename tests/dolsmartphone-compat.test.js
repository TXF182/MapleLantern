/* 灯台 MapleLantern — DolSmartPhone 兼容规则静态契约测试 */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const cssPath = process.env.ML_CSS_PATH || path.join(__dirname, "..", "src", "maplelantern-native.css");
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

test("通用 passage img 规则不得写死 height，避免压过 DolSmartPhone 图片类高度", () => {
  const selector = 'html[data-ml-native="on"] #passages .passage img {';
  const start = css.indexOf(selector);
  assert.ok(start >= 0, "缺少通用 passage img 规则");
  const end = css.indexOf("}", start);
  const block = css.slice(start, end + 1);
  assert.ok(block.includes("max-width: 100%;"), "通用规则仍应保留 max-width: 100%");
  assert.equal(block.includes("height"), false,
    "不得声明 height；height:auto 会以高特异性压过 .yenote-title 等手机模组自带的类高度");
});

test("手机壳内的按钮不再被灯台 44px 通用规则接管", () => {
  const bare = 'html[data-ml-native="on"] #passages .passage button';
  assert.equal(css.includes(bare), false,
    "不得保留裸 #passages .passage button：它会把 #phone-wrapper 里的 25px 按钮改成 44px");

  for (const state of ["", ":hover", ":active", ":focus-visible"]) {
    const scoped = 'html[data-ml-native="on"] #passages .passage > :not(#phone-wrapper) button' + state;
    assert.ok(css.includes(scoped), "缺少手机壳排除后的按钮规则: " + state);
  }

  assert.ok(css.includes('html[data-ml-native="on"] #passages .passage > button'),
    "正文直接子级按钮仍应保留灯台样式，排除范围不能扩大到整段正文");
});

test("通用正文标题/段落/列表/引用/分隔线绕开手机壳", () => {
  const groups = [
    ["h1", "标题"],
    ["h2", "标题"],
    ["p", "段落"],
    ["ul", "列表"],
    ["ol", "列表"],
    ["blockquote", "引用"],
    ["hr", "分隔线"]
  ];
  for (const [tag, label] of groups) {
    assert.equal(css.includes('html[data-ml-native="on"] #passages .passage ' + tag + ' {'), false,
      "裸 " + label + " 规则不得进入手机壳: " + tag);
    assert.ok(css.includes('#passages .passage > :not(#phone-wrapper) ' + tag),
      "缺少手机壳排除后的" + label + "规则: " + tag);
  }

  assert.equal(css.includes('[data-ml-text="custom"] #passages .passage h1,'), false,
    "自定义文字色不得直接命中手机标题");
  assert.ok(css.includes(
    '[data-ml-text="custom"] #passages .passage > :not(#phone-wrapper) h1'
  ), "缺少自定义文字色对手机标题的排除");
});

test("亮底主题的语义色不染进手机深色底", () => {
  for (const theme of ["paper", "grass"]) {
    for (const cls of ["gold", "teal", "red", "green", "blue", "lblue", "pink", "purple", "orange"]) {
      const bare = 'html[data-ml-native="on"][data-ml-theme="' + theme + '"] #passages .passage .' + cls + ' {';
      assert.equal(css.includes(bare), false,
        theme + " 主题的 ." + cls + " 仍会染进 #phone-wrapper");
      const scoped = '#passages .passage > :not(#phone-wrapper) .' + cls;
      assert.ok(css.includes(scoped), theme + " 主题缺少 ." + cls + " 的手机壳排除规则");
    }
  }
});

test("赛博朋克链接下划线只作用于非手机子树", () => {
  const bare = 'html[data-ml-native="on"][data-ml-theme="cyberpunk"] #passages .passage a.link-internal:not(.macro-link) {';
  assert.equal(css.includes(bare), false, "赛博朋克链接规则仍会进入手机壳");
  assert.ok(css.includes(
    'html[data-ml-native="on"][data-ml-theme="cyberpunk"] #passages .passage > :not(#phone-wrapper) a.link-internal:not(.macro-link)'
  ), "缺少手机壳排除后的赛博朋克链接规则");
});

test("灯台不反向覆盖手机自身的按钮尺寸/颜色", () => {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rootReset = 'html[data-ml-native="on"] #passages .passage > #phone-wrapper {';
  const rootBlockStart = withoutComments.indexOf(rootReset);
  assert.ok(rootBlockStart >= 0, "缺少手机根节点的继承复位规则");
  const rootBlockEnd = withoutComments.indexOf("}", rootBlockStart);
  const rootBlock = withoutComments.slice(rootBlockStart, rootBlockEnd + 1);
  for (const declaration of ["font-family:", "font-size:", "line-height: normal;", "text-wrap: wrap;", "overflow-wrap: normal;"]) {
    assert.ok(rootBlock.includes(declaration), "手机根复位缺少声明: " + declaration);
  }
  assert.equal(/button|\.yenote-|\.camera-|\.phone-|#phone-popup/.test(rootBlock), false,
    "手机根复位只能恢复继承属性，不能写手机内部控件样式");

  const withoutRoot = withoutComments.replace(rootBlock, "");
  const occurrences = withoutRoot.split("#phone-wrapper").length - 1;
  const exclusions = withoutRoot.split(":not(#phone-wrapper)").length - 1;
  assert.equal(occurrences, exclusions,
    "除手机根复位外，每条 #phone-wrapper 引用都必须是排除条件，不能直接命中手机壳");
  assert.equal(withoutComments.includes("#phone-wrapper button"), false,
    "不得写 #phone-wrapper 内的按钮覆盖规则");
});

