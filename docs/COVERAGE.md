# 灯台 · 地图（布景地点）覆盖清单

> 自动生成：`node tools\location-coverage.js --write`
> 数据源（一手）：`game\Degrees of Lewdity.html` 中 ① `setup.addlocation("x")` 全表（权威地点清单，含 parent / location 别名 / bus / inside / outside）② `<<location "x">>` 宏与 `$location to "x"` 字面量（只用于统计出现频次）③ `$bus to "x"` 全部取值 ④ 图库文件名 ⑤ `src\deco-core.js` 的 PASSAGE_MAP / BUS_ALIAS / CATALOG。
> 口径：地点清单以 `setup.addlocation` 为权威；`<<location>>` 宏里除地点外还有衣物/身体分区，凡不在 addlocation 表的一律按噪声剔除。是否有图按灯台真实图链判定：visual 派生 → 同名 → location 别名 → 父链继承。

## 总览

- 原版地点（`setup.addlocation`）：**107** 个
- 图库：背景 **106** 键 / 前景 **106** 键
- 同名直接命中：**67** 个；visual 派生命中：**7** 个；父链继承命中：**32** 个
- **可达但无图**（自身、visual、父链都无图，且 passage 里确有赋值）：**0** 个
- **未使用地点**（原版 `setup.addlocation` 注册，但没有任何 passage 赋值，补图无意义）：**1** 个
- 有赋值记录的地点：**70** 个（`$location` 字面量 70 个取值 + `<<location>>` 宏 42 个取值，去重合并）
- `$bus` 取值：**168** 个（街区档位 3 个 + 街道名/钓鱼点等；街道图靠它命中）
- PASSAGE_MAP：**6** 条 → `bus_station` / `soup_kitchen` / `police_back_office` / `underground_dance`
- BUS_ALIAS：**3** 条 → `commercial→com_alley`、`industrial→ind_alley`、`residential→res_alley`

## 可达但无图的地点（连父链都没有可用图）

无。所有可达地点都能沿 visual / 同名 / 父链拿到图。

## 未使用地点（原版注册但无 passage 赋值）

| # | location | 父级 | 说明 |
|---|---|---|---|
| 1 | `plains` | `world` | 仅在 `setup.addlocation` 里注册，全文没有 `<<location>>` 或 `$location to` 引用，玩家走不到，不建议补图 |

## 图库独有键（有图但没有原版地点同名对应）

共 **0** 个。每个键都标注了接线方式；“未接线”表示图库先备着、当前链上取不到。

无。**106 张图全部能指到来源**：地点同名 / visual 派生 / `$bus` 取值 / passage 借用 / 街区别名 / 灯台专属（hotel）。

## visual 派生表（原版 `setup.Locations` 的 visual 函数）

| 地点 | 派生到 | 依据 |
|---|---|---|
| `cafe` | `cafe_renovated` / `cafe_construction` / `cafe` | Locations.cafe：chef_state >= 9 → cafe_renovated，>= 7 → cafe_construction |
| `coastpath` | `cliff_dock` / `coastpath` | Locations.coastpath：$bus 为 fishingCoastPath* → cliff-dock（灯台 normalizeName 把 - 归一为 _） |
| `farm` | `underground_farm` / `farm` | Locations.farm：$bus 非 farmroad6/farm → underground_farm |
| `alex_farm` | `fields` / `forest` / `alex_farm` | Locations.alex_farm：$bus=woodland → forest，=farm_fields → fields |
| `alley` | `com_alley` / `ind_alley` / `res_alley` | Locations.alley：$bus=industrial/commercial → ind_alley/com_alley（票数档位与 BUS_ALIAS 同义） |
| `hotel` | `hotel` / `town` | Locations.hotel：原版固定回退 town；灯台 2026-11-25 补 hotel 专属图 |
| `castle` | `tower` | Locations.castle：固定 tower |
| `lake` | `lake_rock` / `lake` | Locations.lake：$bus 为 fishingForestLake / lakefishingrock → lake-rock（归一为 lake_rock） |

## 赋值频次 Top 40（`$location` 字面量 + `<<location>>` 宏）

| # | location | 次数 | 是否有图 | 命中键 |
|---|---|---|---|---|
| 1 | `town` | 551 | 有 | `town` |
| 2 | `school` | 445 | 有 | `school` |
| 3 | `home` | 200 | 有 | `home` |
| 4 | `forest` | 178 | 有 | `forest` |
| 5 | `temple` | 158 | 有 | `temple` |
| 6 | `cabin` | 121 | 有 | `cabin` |
| 7 | `beach` | 111 | 有 | `beach` |
| 8 | `asylum` | 108 | 有 | `asylum` |
| 9 | `cafe` | 106 | 有 | `cafe_renovated` |
| 10 | `sewers` | 93 | 有 | `sewers` |
| 11 | `adult_shop` | 60 | 有 | `adult_shop` |
| 12 | `hospital` | 59 | 有 | `hospital` |
| 13 | `park` | 58 | 有 | `park` |
| 14 | `lake` | 56 | 有 | `lake_rock` |
| 15 | `wolf_cave` | 52 | 有 | `wolf_cave` |
| 16 | `pub` | 48 | 有 | `pub` |
| 17 | `strip_club` | 48 | 有 | `strip_club` |
| 18 | `brothel` | 45 | 有 | `brothel` |
| 19 | `underground` | 41 | 有 | `underground` |
| 20 | `pool` | 40 | 有 | `pool` |
| 21 | `moor` | 39 | 有 | `moor` |
| 22 | `landfill` | 33 | 有 | `landfill` |
| 23 | `forest_shop` | 32 | 有 | `forest_shop` |
| 24 | `lake_ruin` | 28 | 有 | `lake_ruin` |
| 25 | `museum` | 28 | 有 | `museum` |
| 26 | `arcade` | 26 | 有 | `arcade` |
| 27 | `alley` | 25 | 有 | `com_alley` |
| 28 | `compound` | 25 | 有 | `compound` |
| 29 | `tentworld` | 23 | 有 | `tentworld` |
| 30 | `shopping_centre` | 22 | 有 | `shopping_centre` |
| 31 | `avery_mansion` | 22 | 有 | `avery_mansion` |
| 32 | `tower` | 21 | 有 | `tower` |
| 33 | `flats` | 21 | 有 | `flats` |
| 34 | `avery_skyscraper` | 20 | 有 | `avery_skyscraper` |
| 35 | `forest_shop_garden` | 16 | 有 | `forest_shop_garden` |
| 36 | `old_temple` | 14 | 有 | `old_temple` |
| 37 | `prison` | 14 | 有 | `prison` |
| 38 | `police_station` | 14 | 有 | `police_station` |
| 39 | `office` | 14 | 有 | `office` |
| 40 | `farm` | 13 | 有 | `underground_farm` |

> 宏噪声（不在 addlocation 表、也不是图库键）：3 个取值，属衣物/身体/室内分区，不计入地点覆盖。
