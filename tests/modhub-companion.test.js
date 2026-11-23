const test = require("node:test");
const assert = require("node:assert/strict");

/* ModHub 的附属资源识别是纯文件名规则（modhub-market.js 的
   COMPANION_ASSET_PATTERN + getAssetSeries）。图库包必须同时满足：
   1) 名称命中 image/photo/resource/asset + pack；
   2) 去掉该词后与本体包同系列；
   3) 版本段与本体一致。
   否则 ModHub 会把它当第二个主包，或完全不扫出来。 */
const COMPANION = /(?:photo|image|resource|asset)[\s._-]*pack|图包|图片包|资源包|素材包/i;

function getAssetVersionParts(name) {
  return (String(name).match(/\d+(?:\.\d+)+/g) || []).filter(v => /^\d+\.\d+/.test(v));
}

function getAssetSeries(name) {
  const stripped = String(name || "").replace(/\.(?:zip|mod|modpack(?:\.crypt)?)$/ig, "")
    .replace(/(^|[\s._-])v(?=(?:alpha|beta|omega)[\s._-]*\d)/ig, "$1")
    .replace(/(?:for[\s._-]*)?dol[\s._-]*v?\d+(?:\.\d+)+[a-z]?(?=[\s._+-]|$)/ig, "")
    .replace(/(?:version|ver|v)?\d+(?:\.\d+)+[a-z]?(?:[._-](?:fix|hotfix)\d*)?(?=[\s._+-]|$)/ig, "")
    .replace(/(?:^|[\s._-])build[\s._-]*\d+/ig, "")
    .toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
  return stripped.replace(/^(?:dol|mod)+/, "").replace(/(?:dol|mod)+$/, "") || stripped;
}

test("ModHub 附件命名：图库包会被识别成灯台本体的附属资源", () => {
  const core = "MapleLantern-1.5.7.mod.zip";
  const pack = "MapleLantern-ImagePack-1.5.7.mod.zip";
  assert.match(pack, COMPANION);
  const coreSeries = getAssetSeries(core);
  const packSeries = getAssetSeries(pack.replace(COMPANION, ""));
  assert.equal(packSeries, coreSeries, "去掉 ImagePack 后必须与本体同系列");
  assert.equal(getAssetVersionParts(pack).join("."), getAssetVersionParts(core).join("."));
});

test("ModHub 附件命名：DecorPack 不会被误扫成附属资源", () => {
  const core = "MapleLantern-1.5.7.mod.zip";
  const old = "MapleLantern-DecorPack-1.5.7.mod.zip";
  assert.doesNotMatch(old, COMPANION);
  assert.notEqual(getAssetSeries(old), getAssetSeries(core));
});
