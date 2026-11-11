/* 灯台 MapleLantern — 单元测试：纯逻辑层（格式化 / 降级 / 设置修复 / i18n / 对比度） */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/core.js");

test("VERSION / STORAGE_KEY / 页签集合稳定", () => {
  assert.equal(C.VERSION, "1.1.2");
  assert.equal(C.STORAGE_KEY, "MapleLantern.settings.v1");
  assert.deepEqual(C.TAB_KEYS, ["now", "vitals", "worn", "system", "settings"]);
  assert.equal(C.THEMES.length, 5);
  assert.ok(C.THEMES.includes("star"));
  assert.equal(C.WORN_SLOTS.length, 14);
});

test("服装槽位不包含私密槽（butt_plug / genitals）", () => {
  assert.ok(!C.WORN_SLOTS.includes("butt_plug"));
  assert.ok(!C.WORN_SLOTS.includes("genitals"));
  for (const slot of C.WORN_SLOTS) {
    assert.equal(typeof C.SLOT_LABELS.zh[slot], "string", slot + " 缺少中文显示名");
    assert.equal(typeof C.SLOT_LABELS.en[slot], "string", slot + " 缺少英文显示名");
    assert.ok(C.SLOT_LABELS.zh[slot].length > 0);
    assert.deepEqual(Object.keys(C.SLOT_LABELS.zh), Object.keys(C.SLOT_LABELS.en));
  }
});

test("zh / en 文案键完全对齐，且没有空值", () => {
  const zh = Object.keys(C.STRINGS.zh).sort();
  const en = Object.keys(C.STRINGS.en).sort();
  assert.deepEqual(zh, en);
  for (const k of zh) {
    assert.ok(String(C.STRINGS.zh[k]).trim().length > 0, "zh:" + k);
    assert.ok(String(C.STRINGS.en[k]).trim().length > 0, "en:" + k);
  }
});

test("设置修复：逐字段回退而不是整包丢弃", () => {
  const bad = C.sanitizeSettings({
    v: 2, theme: "neon", scale: 133, density: "loose", motion: "no",
    lang: "fr", tab: "nope", side: "middle", y: 9
  });
  assert.equal(bad.repaired, true);
  assert.equal(bad.migrated, true);
  assert.equal(bad.value.theme, "auto");
  assert.equal(bad.value.scale, 135);      // 吸附到 5% 步进
  assert.equal(bad.value.density, "cozy");
  assert.equal(bad.value.motion, true);
  assert.equal(bad.value.lang, "auto");
  assert.equal(bad.value.tab, "now");
  assert.equal(bad.value.side, "right");   // 默认右下，避开游戏左侧栏
  assert.equal(bad.value.y, 0.92);
});

test("设置修复：越界夹紧与非法类型", () => {
  assert.equal(C.sanitizeSettings({ scale: 10 }).value.scale, 80);
  assert.equal(C.sanitizeSettings({ scale: 999 }).value.scale, 140);
  assert.equal(C.sanitizeSettings({ scale: "big" }).repaired, true);
  assert.equal(C.sanitizeSettings({ glass: 10 }).value.glass, 10);
  assert.equal(C.sanitizeSettings({ glass: 999 }).value.glass, 100);
  assert.equal(C.sanitizeSettings({ glass: 63 }).value.glass, 65);
  assert.equal(C.sanitizeSettings({ glass: "clear" }).repaired, true);
  assert.equal(C.sanitizeSettings({}).value.glass, 60);
  assert.equal(C.sanitizeSettings({ y: -3 }).value.y, 0.12);
  assert.equal(C.sanitizeSettings({ y: "x" }).repaired, true);
  assert.equal(C.sanitizeSettings(null).empty, true);
  assert.equal(C.sanitizeSettings({}).repaired, false);
});

test("语言判定：显式设置优先，auto 跟随 navigator", () => {
  assert.equal(C.pickLang("zh", "en-US"), "zh");
  assert.equal(C.pickLang("en", "zh-CN"), "en");
  assert.equal(C.pickLang("auto", "zh-CN"), "zh");
  assert.equal(C.pickLang("auto", "en-GB"), "en");
  assert.equal(C.pickLang(undefined, undefined), "zh");
});

test("格式化：时钟 / 日期 / 星期 / 金钱", () => {
  assert.equal(C.formatClock(8, 5), "08:05");
  assert.equal(C.formatClock(23, 59), "23:59");
  assert.equal(C.formatClock(null, 12), "--:--");
  assert.equal(C.formatClock(25, 70), "23:59");
  assert.equal(C.formatDate(3, 14, "zh"), "3月14日");
  assert.equal(C.formatDate(3, 14, "en"), "Mar 14");
  assert.equal(C.formatDate(null, 14, "zh"), "—");
  assert.equal(C.formatWeekday(1, "zh"), "周日");   // DoL weekDay 1-7 = Sun-Sat（游戏源码 getFirstWeekdayOfMonth 注释）
  assert.equal(C.formatWeekday(7, "zh"), "周六");
  assert.equal(C.formatWeekday(7, "en"), "Sat");
  assert.equal(C.formatWeekday(1, "en"), "Sun");
  assert.equal(C.formatWeekday(0, "zh"), "");
  assert.equal(C.formatMoney(1234), "£12.34");
  assert.equal(C.formatMoney(-5), "-£0.05");
  assert.equal(C.formatMoney(0), "£0.00");
  assert.equal(C.formatMoney(999899), "£9,998.99");
  assert.equal(C.formatMoney("x"), "—");
  assert.equal(C.fmt("{a}/{b}", { a: 1 }), "1/{b}");
});

test("dayState 边界：<6 night / <9 dawn / <18 day / <21 dusk / else night", () => {
  assert.equal(C.phaseKey("night"), "night");
  assert.equal(C.phaseKey("weird"), "unknown");
  assert.equal(C.phaseKey(undefined), "unknown");
  assert.equal(C.dayProgress(0, 0), 0);
  assert.equal(C.dayProgress(12, 0), 50);
  assert.equal(C.dayProgress(23, 59) > 99.9, true);
  assert.equal(C.dayProgress(null, 0), null);
});

test("ratio：0 上限不除零、越界被夹紧但标记 over", () => {
  assert.deepEqual(C.ratio(50, 100), { pct: 50, over: false });
  assert.deepEqual(C.ratio(150, 100), { pct: 100, over: true });
  assert.deepEqual(C.ratio(50, 0), { pct: 0, over: false });
  assert.equal(C.ratio(null, 100), null);
});

test("readModel：完全读不到时降级但不抛", () => {
  const m = C.readModel({});
  assert.equal(m.clock, null);
  assert.equal(m.money, null);
  assert.equal(m.scene, null);
  assert.equal(m.vitals.length, 0);
  assert.equal(m.worn.length, 14);
  assert.equal(m.wornCount, 0);
  assert.equal(m.degraded, true);
  assert.equal(C.readModel(null).degraded, true);
});

test("readModel：完整存档读通，tiredness 上限走 Constants", () => {
  const vars = {
    willpower: 40, willpowermax: 100,
    stress: 20, stressmax: 100,
    trauma: 10, traumamax: 100,
    arousal: 30, arousalmax: 100,
    tiredness: 600, money: 1234.7,
    worn: { upper: { name: "Shirt" }, lower: { name: "Skirt" }, butt_plug: { name: "不该出现" }, genitals: { name: "也不该" } }
  };
  const time = { hour: 8, minute: 20, month: 3, monthDay: 14, weekDay: 7, dayState: "dawn" };
  const m = C.readModel({ vars, time, constants: { tiredness: { max: 800 } }, passage: "School Hallway", lang: "zh" });
  assert.equal(m.clock.phase, "dawn");
  assert.equal(m.clock.weekday, "周六");   // weekDay 7 = Sat
  assert.ok(Math.abs(m.clock.progress - (8 * 60 + 20) / 1440 * 100) < 0.001);
  assert.equal(m.clock.date, "3月14日");
  assert.equal(m.money, 1234.7);
  assert.equal(m.scene, "School Hallway");
  assert.equal(m.vitals.length, 5);
  assert.equal(m.vitals.find((v) => v.key === "tiredness").max, 800);
  assert.equal(m.wornCount, 2);
  assert.ok(!m.worn.some((w) => w.slot === "butt_plug" || w.slot === "genitals"));
  assert.equal(m.degraded, false);
});

test("readModel：worn 不预置时判空，不抛异常", () => {
  const m = C.readModel({ vars: { willpower: 1, willpowermax: 2 }, time: { hour: 3 } });
  assert.equal(m.worn.length, 14);
  assert.equal(m.wornCount, 0);
  assert.equal(m.missingVitals, 4);
});

test("对比度：正文/次要文字/强调色达到 WCAG AA（4.5:1）", () => {
  for (const name of ["amber", "jade", "graphite"]) {
    const p = C.paletteFor(name);
    assert.ok(C.contrast(p.text, p.bg) >= 4.5, name + " text " + C.contrast(p.text, p.bg));
    assert.ok(C.contrast(p.muted, p.bg) >= 4.5, name + " muted " + C.contrast(p.muted, p.bg));
    assert.ok(C.contrast(p.accent, p.bg) >= 4.5, name + " accent " + C.contrast(p.accent, p.bg));
  }
});

test("诊断结构：未连宿主时 present=false，不伪造能力", () => {
  const d = C.buildDiagnostics({ game: "0.5.12.13", host: null, storage: false });
  assert.equal(d.mod, "MapleLantern");
  assert.equal(d.version, "1.1.2");
  assert.deepEqual(d.host, { present: false });
  assert.equal(d.storage, false);
  assert.equal(d.stateReadable, false);
  const d2 = C.buildDiagnostics({ host: { apiVersion: 1, layout: "desktop" }, storage: true });
  assert.equal(d2.host.present, true);
  assert.equal(d2.host.layout, "desktop");
});
