/* 灯台 · 地图（布景地点）覆盖清单
 * 用法：node tools\location-coverage.js [--write]
 * 数据来源（全部一手材料，不经过二手转述）：
 *   1) game\Degrees of Lewdity.html 的 `setup.addlocation("x")` 全表（权威地点清单，
 *      含 parent / location 别名 / bus / inside / outside 标记）；
 *   2) 同一文件的 `<<location "x">>` 宏与 `$location to "x"` 字面量（只用来统计出现频次，
 *      宏里除了地点还有衣物/身体分区，凡不在 addlocation 表的一律按噪声剔除）；
 *   3) `$bus to "x"` 的全部取值（街区档位 + 街道名，街道图靠它命中）；
 *   4) imagepack\img\decorations\ml\background1\*.png 文件名（= 布景键）；
 *   5) src\deco-core.js 的 PASSAGE_MAP / BUS_ALIAS / CATALOG。
 * 口径：是否「有图」按灯台真实图链判定——visual 派生 → 同名 → 父链继承；
 *       visual 派生表逐条来自原版 `setup.Locations` 的 visual 函数（见 VISUAL 注释）。
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PROJECT = path.join(ROOT, "..");
const GAME = path.join(PROJECT, "game", "Degrees of Lewdity.html");
const BG = path.join(ROOT, "imagepack", "img", "decorations", "ml", "background1");
const FG = path.join(ROOT, "imagepack", "img", "decorations", "ml", "foreground1");
const CORE = path.join(ROOT, "src", "deco-core.js");
const OUT = path.join(ROOT, "docs", "COVERAGE.md");

const norm = (v) => String(v).trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
const pngKeys = (dir) => new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => f.replace(/\.png$/, "")));

const game = fs.readFileSync(GAME, "utf8");
const bgKeys = pngKeys(BG);
const fgKeys = pngKeys(FG);
const core = fs.readFileSync(CORE, "utf8");

/* 1) 权威地点表：setup.addlocation("x").parent("y").location("z").bus()/inside()/outside() */
const places = [];
for (const m of game.matchAll(/setup\.addlocation\(\s*["']([^"']+)["']\s*\)([^;]{0,260});/g)) {
  const name = norm(m[1]);
  const chain = m[2];
  const alias = chain.match(/\.location\(\s*["']([^"']+)["']\s*\)/);
  const parent = chain.match(/\.parent\(\s*["']([^"']+)["']\s*\)/);
  places.push({
    name: name,
    alias: alias ? norm(alias[1]) : "",
    parent: parent ? norm(parent[1]) : "",
    bus: /\.bus\(\)/.test(chain),
    inside: /\.inside\(\)/.test(chain),
    outside: /\.outside\(\)/.test(chain)
  });
}
const byName = new Map(places.map((p) => [p.name, p]));

/* 2) 赋值频次：$location 字面量 / <<location>> 宏 / $bus */
const count = (re) => {
  const map = new Map();
  for (const m of game.matchAll(re)) {
    const k = norm(m[1]);
    if (!k || k.length > 40) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
};
const setTimes = count(/\$location\s+to\s+["']([^"']+)["']/g);
const macroTimes = count(/&lt;&lt;location\s+["']([^"']+)["']\s*&gt;&gt;/g);
const busVals = new Set([...count(/\$bus\s+to\s+["']([^"']+)["']/g).keys()]);

/* 3) PASSAGE_MAP / BUS_ALIAS（滑动窗口截取，避免跨段误读） */
function objEntries(marker) {
  const start = core.indexOf(marker);
  if (start < 0) return [];
  const end = core.indexOf("};", start);
  const body = core.slice(start, end);
  return [...body.matchAll(/(?:"([^"]+)"|(\w+))\s*:\s*"([^"]+)"/g)].map((m) => [m[1] || m[2], m[3]]);
}
const passageMap = objEntries("var PASSAGE_MAP = {");
const busAlias = objEntries("var BUS_ALIAS = {");
const aliasValues = new Set(busAlias.map((x) => x[1]));

/* 4) visual 派生表（原版 setup.Locations 的 visual 函数，逐条核读） */
const VISUAL = {
  cafe: { keys: ["cafe_renovated", "cafe_construction", "cafe"], src: "Locations.cafe：chef_state >= 9 → cafe_renovated，>= 7 → cafe_construction" },
  coastpath: { keys: ["cliff_dock", "coastpath"], src: "Locations.coastpath：$bus 为 fishingCoastPath* → cliff-dock（灯台 normalizeName 把 - 归一为 _）" },
  farm: { keys: ["underground_farm", "farm"], src: "Locations.farm：$bus 非 farmroad6/farm → underground_farm" },
  alex_farm: { keys: ["fields", "forest", "alex_farm"], src: "Locations.alex_farm：$bus=woodland → forest，=farm_fields → fields" },
  alley: { keys: ["com_alley", "ind_alley", "res_alley"], src: "Locations.alley：$bus=industrial/commercial → ind_alley/com_alley（票数档位与 BUS_ALIAS 同义）" },
  hotel: { keys: ["hotel", "town"], src: "Locations.hotel：原版固定回退 town；灯台 2026-11-25 补 hotel 专属图" },
  castle: { keys: ["tower"], src: "Locations.castle：固定 tower" },
  lake: { keys: ["lake_rock", "lake"], src: "Locations.lake：$bus 为 fishingForestLake / lakefishingrock → lake-rock（归一为 lake_rock）" }
};

/* 5) 按灯台真实图链顺序判定：visual → 同名 → location 别名 → 父链 */
function resolve(name, depth) {
  if (depth > 24) return { key: null, how: "none" };
  if (VISUAL[name]) {
    for (const k of VISUAL[name].keys) if (bgKeys.has(k)) return { key: k, how: "visual" };
  }
  if (bgKeys.has(name)) return { key: name, how: "direct" };
  const p = byName.get(name);
  if (p) {
    if (p.alias && bgKeys.has(p.alias)) return { key: p.alias, how: "parent" };
    if (p.parent && byName.has(p.parent)) {
      const hit = resolve(p.parent, depth + 1);
      return { key: hit.key, how: hit.key ? "parent" : "none" };
    }
  }
  return { key: null, how: "none" };
}

const rows = places.map((p) => Object.assign({}, p, { hit: resolve(p.name, 0) }));
const totals = { direct: 0, visual: 0, parent: 0, none: 0 };
rows.forEach((r) => { totals[r.hit.how] = (totals[r.hit.how] || 0) + 1; });

/* 赋值频次合并表：$location 字面量 + <<location>> 宏 */
const totalTimes = new Map();
[...setTimes.entries()].forEach(([k, v]) => totalTimes.set(k, v));
[...macroTimes.entries()].forEach(([k, v]) => totalTimes.set(k, (totalTimes.get(k) || 0) + v));

/* 无图要分两类：原版注册但任何 passage 都没用过（不可达，补图没意义），
   与真的能走到、需要补图或借用的地点。 */
const unreachable = rows.filter((r) => !r.hit.key && !(totalTimes.get(r.name) > 0));
const missing = rows.filter((r) => !r.hit.key && totalTimes.get(r.name) > 0);

/* 6) 图库独有键：把上面所有「能指到」的来源合并，剩下的是没人引用的 */
const referenced = new Set();
rows.forEach((r) => {
  referenced.add(r.name);
  if (r.alias) referenced.add(r.alias);
});
setTimes.forEach((_, k) => referenced.add(k));
macroTimes.forEach((_, k) => referenced.add(k));
busVals.forEach((k) => referenced.add(k));
passageMap.forEach((x) => referenced.add(x[1]));
aliasValues.forEach((k) => referenced.add(k));
Object.keys(VISUAL).forEach((k) => VISUAL[k].keys.forEach((v) => referenced.add(v)));
const extra = [...bgKeys].filter((k) => !referenced.has(k)).sort();

function howExtra(k) {
  if (passageMap.some((x) => x[1] === k)) return "passage 借用（PASSAGE_MAP）";
  if (aliasValues.has(k)) return "$bus 街区别名（BUS_ALIAS）";
  const owner = Object.keys(VISUAL).find((n) => VISUAL[n].keys.indexOf(k) >= 0);
  if (owner) return "visual 派生（" + owner + "）";
  if (busVals.has(k)) return "$bus 取值（街道名）";
  if (bgKeys.has(k) && byName.has(k)) return "addlocation 同名";
  return "未接线（灯台专属或预留）";
}

const noiseMacro = [...macroTimes.entries()].filter(([k]) => !byName.has(k) && !bgKeys.has(k));
const sceneCovered = rows.filter((r) => bgKeys.has(r.name)).length;
const withTimes = rows.filter((r) => totalTimes.get(r.name)).length;

console.log(JSON.stringify({
  addLocations: places.length,
  bgKeys: bgKeys.size,
  fgKeys: fgKeys.size,
  direct: totals.direct,
  visual: totals.visual,
  parent: totals.parent,
  noImageReachable: missing.length,
  noImageUnused: unreachable.length,
  galleryOnlyKeys: extra.length,
  passageMap: passageMap.length,
  busAlias: busAlias.length,
  busValues: busVals.size,
  macroValues: macroTimes.size,
  macroNoise: noiseMacro.length,
  locationsWithAssignments: withTimes
}, null, 2));
console.log("\n真无图（可达且自身 / visual / 父链都没有图）:");
for (const r of missing) console.log(`  ${r.name}  (parent=${r.parent || "-"}${r.alias ? ", alias=" + r.alias : ""})`);
console.log("\n未使用（原版 addlocation 注册，但没有任何 passage 赋值）:");
for (const r of unreachable) console.log(`  ${r.name}  (parent=${r.parent || "-"})`);

if (process.argv.includes("--write")) {
  const lines = [];
  lines.push("# 灯台 · 地图（布景地点）覆盖清单");
  lines.push("");
  lines.push("> 自动生成：`node tools\\location-coverage.js --write`");
  lines.push("> 数据源（一手）：`game\\Degrees of Lewdity.html` 中 ① `setup.addlocation(\"x\")` 全表（权威地点清单，含 parent / location 别名 / bus / inside / outside）② `<<location \"x\">>` 宏与 `$location to \"x\"` 字面量（只用于统计出现频次）③ `$bus to \"x\"` 全部取值 ④ 图库文件名 ⑤ `src\\deco-core.js` 的 PASSAGE_MAP / BUS_ALIAS / CATALOG。");
  lines.push("> 口径：地点清单以 `setup.addlocation` 为权威；`<<location>>` 宏里除地点外还有衣物/身体分区，凡不在 addlocation 表的一律按噪声剔除。是否有图按灯台真实图链判定：visual 派生 → 同名 → location 别名 → 父链继承。");
  lines.push("");
  lines.push("## 总览");
  lines.push("");
  lines.push(`- 原版地点（\`setup.addlocation\`）：**${places.length}** 个`);
  lines.push(`- 图库：背景 **${bgKeys.size}** 键 / 前景 **${fgKeys.size}** 键`);
  lines.push(`- 同名直接命中：**${totals.direct}** 个；visual 派生命中：**${totals.visual}** 个；父链继承命中：**${totals.parent}** 个`);
  lines.push(`- **可达但无图**（自身、visual、父链都无图，且 passage 里确有赋值）：**${missing.length}** 个`);
  lines.push(`- **未使用地点**（原版 \`setup.addlocation\` 注册，但没有任何 passage 赋值，补图无意义）：**${unreachable.length}** 个`);
  lines.push(`- 有赋值记录的地点：**${withTimes}** 个（\`$location\` 字面量 ${setTimes.size} 个取值 + \`<<location>>\` 宏 ${macroTimes.size} 个取值，去重合并）`);
  lines.push(`- \`$bus\` 取值：**${busVals.size}** 个（街区档位 3 个 + 街道名/钓鱼点等；街道图靠它命中）`);
  lines.push(`- PASSAGE_MAP：**${passageMap.length}** 条 → ${[...new Set(passageMap.map((x) => `\`${x[1]}\``))].join(" / ")}`);
  lines.push(`- BUS_ALIAS：**${busAlias.length}** 条 → ${busAlias.map((x) => `\`${x[0]}→${x[1]}\``).join("、")}`);
  lines.push("");
  lines.push("## 可达但无图的地点（连父链都没有可用图）");
  lines.push("");
  if (!missing.length) {
    lines.push("无。所有可达地点都能沿 visual / 同名 / 父链拿到图。");
  } else {
    lines.push("| # | location | 父级 | 出现次数 | 建议 |");
    lines.push("|---|---|---|---|---|");
    missing.forEach((r, i) => {
      const times = totalTimes.get(r.name) || 0;
      lines.push(`| ${i + 1} | \`${r.name}\` | \`${r.parent || "-"}\` | ${times} | 按语义补图，或加 PASSAGE_MAP 借用 |`);
    });
  }
  lines.push("");
  lines.push("## 未使用地点（原版注册但无 passage 赋值）");
  lines.push("");
  if (!unreachable.length) {
    lines.push("无。");
  } else {
    lines.push("| # | location | 父级 | 说明 |");
    lines.push("|---|---|---|---|");
    unreachable.forEach((r, i) => {
      lines.push(`| ${i + 1} | \`${r.name}\` | \`${r.parent || "-"}\` | 仅在 \`setup.addlocation\` 里注册，全文没有 \`<<location>>\` 或 \`$location to\` 引用，玩家走不到，不建议补图 |`);
    });
  }
  lines.push("");
  lines.push("## 图库独有键（有图但没有原版地点同名对应）");
  lines.push("");
  lines.push(`共 **${extra.length}** 个。每个键都标注了接线方式；“未接线”表示图库先备着、当前链上取不到。`);
  lines.push("");
  if (!extra.length) {
    lines.push("无。**106 张图全部能指到来源**：地点同名 / visual 派生 / `$bus` 取值 / passage 借用 / 街区别名 / 灯台专属（hotel）。");
  } else {
    lines.push("| # | 图库键 | 接线方式 |");
    lines.push("|---|---|---|");
    extra.forEach((k, i) => lines.push(`| ${i + 1} | \`${k}\` | ${howExtra(k)} |`));
  }
  lines.push("");
  lines.push("## visual 派生表（原版 `setup.Locations` 的 visual 函数）");
  lines.push("");
  lines.push("| 地点 | 派生到 | 依据 |");
  lines.push("|---|---|---|");
  Object.keys(VISUAL).forEach((k) => lines.push(`| \`${k}\` | ${VISUAL[k].keys.map((v) => `\`${v}\``).join(" / ")} | ${VISUAL[k].src} |`));
  lines.push("");
  lines.push("## 赋值频次 Top 40（`$location` 字面量 + `<<location>>` 宏）");
  lines.push("");
  lines.push("| # | location | 次数 | 是否有图 | 命中键 |");
  lines.push("|---|---|---|---|---|");
  [...totalTimes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, c], i) => {
    const row = byName.get(k);
    const hit = row ? resolve(k, 0) : { key: bgKeys.has(k) ? k : null, how: "direct" };
    lines.push(`| ${i + 1} | \`${k}\` | ${c} | ${hit.key ? "有" : "无"} | ${hit.key ? `\`${hit.key}\`` : "-"} |`);
  });
  lines.push("");
  lines.push(`> 宏噪声（不在 addlocation 表、也不是图库键）：${noiseMacro.length} 个取值，属衣物/身体/室内分区，不计入地点覆盖。`);
  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf8");
  console.log(`\n已写入 ${path.relative(PROJECT, OUT)}`);
}
