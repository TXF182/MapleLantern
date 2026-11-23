/* 灯台 MapleLantern — 单元测试：纯逻辑层（格式化 / 降级 / 设置修复 / i18n / 对比度） */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../src/core.js");

test("VERSION / STORAGE_KEY / 页签集合稳定", () => {
  assert.equal(C.VERSION, "1.5.7");
  assert.equal(C.STORAGE_KEY, "MapleLantern.settings.v1");
  assert.deepEqual(C.TAB_KEYS, ["now", "vitals", "worn", "system", "switches", "settings"]);
  assert.equal(C.THEMES.length, 9);
  assert.ok(C.THEMES.includes("cyberpunk"));
  assert.ok(C.THEMES.includes("star"));
  assert.ok(C.THEMES.includes("fog"));
  assert.ok(C.THEMES.includes("school"));
  assert.ok(C.THEMES.includes("paper"));
  assert.equal(C.WORN_SLOTS.length, 14);
});

test("默认主题为 cyberpunk，auto 回退色板也是 cyberpunk", () => {
  assert.equal(C.DEFAULTS.theme, "cyberpunk");
  assert.equal(C.sanitizeSettings({}).value.theme, "cyberpunk");
  assert.equal(C.paletteFor("cyberpunk"), C.PALETTES.cyberpunk);
  assert.equal(C.paletteFor("auto"), C.PALETTES.cyberpunk);
  assert.equal(C.paletteFor("not-a-theme"), C.PALETTES.cyberpunk);
  assert.equal(C.PALETTES.cyberpunk.accent, "#00E5FF");
  assert.equal(C.PALETTES.cyberpunk.rose, "#FF3D9A");
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

test("第三方美化页：默认不套原生层，开关只接受布尔值", () => {
  assert.equal(C.DEFAULTS.thirdPartyNative, false, "默认必须在第三方美化页只插入口，不立即改 UI");
  assert.equal(C.sanitizeSettings({}).value.thirdPartyNative, false);
  assert.equal(C.sanitizeSettings({ thirdPartyNative: true }).value.thirdPartyNative, true);
  const bad = C.sanitizeSettings({ thirdPartyNative: "yes" });
  assert.equal(bad.value.thirdPartyNative, false, "非布尔值不能被当真值");
  for (const key of ["optStats", "optMoney", "optRailSkin", "optRailPct", "optMeterSkin",
    "optMeterValue", "optOptions", "optSidebar", "optOverlay"]) {
    assert.equal(C.DEFAULTS[key], true, key + " 默认必须开启，升级不能改变现有外观");
    assert.equal(C.sanitizeSettings({ [key]: false }).value[key], false);
    assert.equal(C.sanitizeSettings({ [key]: "yes" }).value[key], true, key + " 非布尔值必须回默认");
  }
  assert.equal(bad.repaired, true, "非布尔值必须让 repaired 可见");
});

test("设置修复：逐字段回退而不是整包丢弃", () => {
  const bad = C.sanitizeSettings({
    v: 2, theme: "neon", scale: 133, density: "loose", motion: "no",
    lang: "fr", tab: "nope", side: "middle", y: 9
  });
  assert.equal(bad.repaired, true);
  assert.equal(bad.migrated, true);
  assert.equal(bad.value.theme, "cyberpunk");
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

test("readModel：tiredness max=0 时保留 0，不回退 2000", () => {
  const m = C.readModel({ vars: { tiredness: 12 }, constants: { tiredness: { max: 0 } } });
  const v = m.vitals.find((x) => x.key === "tiredness");
  assert.ok(v, "tiredness 必须在 vitals 中");
  assert.equal(v.max, 0);
  assert.equal(v.pct, 0);
});

test("readModel：worn 优先取游戏汉化字段 cn_name_cap / cn_name，缺失回落原名", () => {
  const vars = {
    worn: {
      upper: { name: "Sundress", cn_name_cap: "夏日连衣裙" },
      lower: { name: "Plain panties", cn_name: "普通内裤" },
      head: { name: "Hairpin", cn_name_cap: " 发卡 " },
      feet: { name: "School shoes", cn_name_cap: "   " }
    }
  };
  const m = C.readModel({ vars, lang: "zh" });
  const bySlot = (slot) => m.worn.find((w) => w.slot === slot);
  assert.equal(bySlot("upper").name, "Sundress");
  assert.equal(bySlot("upper").cn, "夏日连衣裙");
  assert.equal(bySlot("lower").cn, "普通内裤");
  assert.equal(bySlot("head").cn, "发卡");       // 首尾空白被裁掉
  assert.equal(bySlot("feet").cn, null);          // 空白中文名视为缺失
  assert.equal(m.wornCount, 4);                   // 计数仍按游戏原名，不因缺中文丢槽
});

test("readModel：worn 不预置时判空，不抛异常", () => {
  const m = C.readModel({ vars: { willpower: 1, willpowermax: 2 }, time: { hour: 3 } });
  assert.equal(m.worn.length, 14);
  assert.equal(m.wornCount, 0);
  assert.equal(m.missingVitals, 4);
});

test("readThirdParty：只读 Dynamicest / 前景背景公开字段，不伪造缺失状态", () => {
  const vars = {
    Dynamicest: { Settings: { DynamicestFlash: false, DynamicestTimeBar: true, DynamicestDisplayOpacity: 0.6 } },
    foreground_image1: 1, background_image1: "none",
    show_foreground1: true, decoAutoBgEnabled: true, decoAutoBgActive: false
  };
  const tp = C.readThirdParty(vars);
  assert.equal(tp.dynamicest.installed, true);
  assert.equal(tp.dynamicest.initialized, true);
  assert.equal(tp.dynamicest.flash, false);
  assert.equal(tp.dynamicest.timebar, true);
  assert.equal(tp.dynamicest.opacity, 0.6);
  assert.equal(tp.decorations.foreground, "1");
  assert.equal(tp.decorations.background, null);
  assert.equal(tp.decorations.showForeground, true);
  assert.equal(tp.decorations.autoBackground, true);
  assert.equal(tp.decorations.autoActive, false);

  const m = C.readModel({ vars, passage: "School Hallway" });
  assert.equal(m.thirdParty.dynamicest.opacity, 0.6);
  assert.equal(m.thirdParty.decorations.foreground, "1");
});

test("readThirdParty：两个第三方都缺失时返回 null，不增加空面板", () => {
  assert.equal(C.readThirdParty(null), null);
  assert.equal(C.readThirdParty({ money: 1 }), null);
  assert.equal(C.readModel({ vars: { money: 1 } }).thirdParty, null);
});

test("对比度：正文/次要文字/强调色达到 WCAG AA（4.5:1）", () => {
  for (const name of ["cyberpunk", "amber", "jade", "star", "fog", "school", "paper", "grass"]) {
    const p = C.paletteFor(name);
    assert.ok(C.contrast(p.text, p.bg) >= 4.5, name + " text " + C.contrast(p.text, p.bg));
    assert.ok(C.contrast(p.muted, p.bg) >= 4.5, name + " muted " + C.contrast(p.muted, p.bg));
    assert.ok(C.contrast(p.accent, p.bg) >= 4.5, name + " accent " + C.contrast(p.accent, p.bg));
  }
});

test("绿茵：调色板落值、主题清单、浅底强调色仍过 AA", () => {
  assert.deepEqual(C.THEMES, ["auto", "cyberpunk", "amber", "jade", "star", "fog", "school", "paper", "grass"]);
  const p = C.paletteFor("grass");
  assert.equal(p.bg, "#E6F0D4");
  assert.equal(p.text, "#20301A");
  assert.equal(p.accent, "#2F6B2B");
  assert.equal(p.line, "rgba(32,48,26,.18)");
  /* 浅底上玫瑰/危险色也必须可读，不能直接沿用深色主题取值 */
  assert.ok(C.contrast(p.rose, p.bg) >= 4.5, "grass rose " + C.contrast(p.rose, p.bg));
  assert.ok(C.contrast(p.danger, p.bg) >= 4.5, "grass danger " + C.contrast(p.danger, p.bg));
  assert.equal(C.strings("zh")["theme.grass"], "绿茵");
  assert.equal(C.strings("en")["theme.grass"], "Meadow");
});

test("旧档迁移：石墨被删后主题回落默认，且边饰字段有默认值", () => {
  const old = C.sanitizeSettings({ v: 1, theme: "graphite" });
  assert.equal(old.value.theme, "cyberpunk", "graphite 不在 THEMES 里，必须回落 DEFAULTS.theme");
  assert.equal(old.repaired, true, "回落必须留 repaired 供一次性提示");
  assert.equal(C.DEFAULTS.ornament, true, "边饰默认开");
  const cleaned = C.sanitizeSettings({ v: 1, theme: "grass", ornament: false });
  assert.equal(cleaned.value.theme, "grass");
  assert.equal(cleaned.value.ornament, false);
  const broken = C.sanitizeSettings({ v: 1, ornament: "yes" });
  assert.equal(broken.value.ornament, true, "非布尔按默认开处理");
  assert.equal(broken.repaired, true);
});

test("panelOrigin：球心换算成面板内坐标，越界夹到 8px，量不到尺寸回退百分比", () => {
  const box = { left: 100, top: 100, width: 380, height: 600 };
  assert.deepEqual(C.panelOrigin(box, { left: 340, top: 680, width: 56, height: 56 }),
    { x: "268px", y: "592px" });
  /* 球在面板外：必须夹在面板内 8px，不能把 scale 原点甩到屏幕外 */
  assert.deepEqual(C.panelOrigin(box, { left: -200, top: -200, width: 56, height: 56 }),
    { x: "8px", y: "8px" });
  /* jsdom / 隐藏 / 0 尺寸：退回底部中心，绝不写 NaN */
  assert.deepEqual(C.panelOrigin({ left: 0, top: 0, width: 0, height: 0 }, { left: 1, top: 1, width: 1, height: 1 }),
    { x: "50%", y: "100%" });
  assert.deepEqual(C.panelOrigin(null, null), { x: "50%", y: "100%" });
});

test("诊断结构：未连宿主时 present=false，不伪造能力", () => {
  const d = C.buildDiagnostics({ game: "0.5.12.13", host: null, storage: false });
  assert.equal(d.mod, "MapleLantern");
  assert.equal(d.version, "1.5.7");
  assert.deepEqual(d.host, { present: false });
  assert.equal(d.storage, false);
  assert.equal(d.stateReadable, false);
  const d2 = C.buildDiagnostics({ host: { apiVersion: 1, layout: "desktop" }, storage: true });
  assert.equal(d2.host.present, true);
  assert.equal(d2.host.layout, "desktop");
});

test("正文文字色：预设逐色过 4.5:1，自定义按主题底校验，非法值修复", () => {
  assert.equal(C.DEFAULTS.textColor, "auto");
  for (const theme of C.THEMES) {
    const choices = C.textColorChoices(theme);
    assert.ok(choices.length >= 2, theme + " 至少要给自动 + 1 个可用预设");
    assert.equal(choices[0].value, "auto");
    for (const choice of choices) {
      if (choice.value === "auto") { continue; }
      const ratio = C.contrast(choice.value, C.paletteFor(theme).bg);
      assert.ok(ratio >= 4.5, theme + " 的预设 " + choice.value + " 只有 " + ratio.toFixed(2) + ":1");
    }
  }
  assert.equal(C.textColorFor("auto", "grass"), null, "自动不落自定义值");
  assert.equal(C.textColorFor("#20301A", "grass"), "#20301a", "合法色统一小写");
  assert.equal(C.textColorFor("#FFFFFF", "grass"), null, "浅底白字必须判不合格");
  assert.equal(C.textColorFor("not-a-color", "grass"), null);
  const ok = C.sanitizeSettings({ textColor: "#2F6B2B" });
  assert.equal(ok.value.textColor, "#2f6b2b");
  assert.equal(ok.repaired, false);
  const bad = C.sanitizeSettings({ textColor: "很深的蓝" });
  assert.equal(bad.value.textColor, "auto");
  assert.equal(bad.repaired, true);
  assert.equal(C.sanitizeSettings({ v: 1 }).value.textColor, "auto", "旧档默认跟随主题");
});
