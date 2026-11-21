/* ============================================================================
 * 灯台 · 外观 / MapleLanternDossier — assets.js
 * 玩家导入图片的存放与预处理。
 *
 * 为什么不用 localStorage：DoL 的存档就在 localStorage（file:// 源），一张 1 MB
 * 的图 base64 后约 1.3 MB，很容易把存档一起顶到配额上限。图片一律进
 * IndexedDB（独立库），localStorage 只放几百字节的设置。
 *
 * 失败语义：IndexedDB 不可用（隐私模式 / 旧 WebView）时退到内存，本次会话有效，
 * 刷新即失——由调用方把这句话显示给玩家，不许静默。
 * ========================================================================== */
(function (root) {
  "use strict";

  var Core = root.MapleLanternDossierCore;
  if (!Core) return;
  if (root.MapleLanternDossierAssets && root.MapleLanternDossierAssets.__ready) return;

  var DB_NAME = "MapleLanternDossier.assets.v1";
  var STORE = "images";
  var MAX_FILE = 15 * 1024 * 1024;

  var dbPromise = null;
  var dbBroken = false;
  var memory = {};          // key -> { blob, meta }

  function hasIDB() {
    try { return !!root.indexedDB; } catch (e) { return false; }
  }

  function openDb() {
    if (!hasIDB()) return Promise.reject(new Error("no-idb"));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req;
      try { req = root.indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("idb-open-failed")); };
      req.onblocked = function () { reject(new Error("idb-blocked")); };
    });
    dbPromise.catch(function () { dbBroken = true; });
    return dbPromise;
  }

  function tx(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t;
        try { t = db.transaction(STORE, mode); } catch (e) { reject(e); return; }
        var store = t.objectStore(STORE);
        var out;
        try {
          out = fn(store);
        } catch (e) {
          reject(e);
          return;
        }
        t.oncomplete = function () { resolve(out && "result" in out ? out.result : undefined); };
        t.onerror = function () { reject(t.error || new Error("idb-tx-failed")); };
        t.onabort = function () { reject(t.error || new Error("idb-aborted")); };
      });
    });
  }

  function load(key) {
    if (memory[key]) return Promise.resolve(memory[key]);
    return tx("readonly", function (store) { return store.get(key); })
      .then(function (v) { return v || null; })
      .catch(function () { return memory[key] || null; });
  }

  function save(key, blob, meta) {
    var rec = { blob: blob, meta: meta || {}, updatedAt: Date.now() };
    return tx("readwrite", function (store) { store.put(rec, key); })
      .then(function () { return true; })
      .catch(function () {
        // 存不进去也要能用：退化到内存
        memory[key] = rec;
        return false;
      });
  }

  function drop(key) {
    if (memory[key]) delete memory[key];
    return tx("readwrite", function (store) { store.delete(key); })
      .then(function () { return true; })
      .catch(function () { return false; });
  }

  /* -------------------------------------------------------------------------
   * 图片预处理
   * ---------------------------------------------------------------------- */

  function limits() {
    var mobile = (root.innerWidth || 0) > 0 && root.innerWidth <= 600;
    return mobile
      ? { maxEdge: 1200, maxArea: 1600 * 1600 }
      : { maxEdge: 1600, maxArea: 2200 * 1600 };
  }

  function decode(file) {
    // createImageBitmap 直接 resolve 的是 ImageBitmap 本体，必须包成 {source,width,height,release}，
    // 否则 process 里的 dec.source 是 undefined，drawImage 会抛「provided value is not of type …」。
    if (root.createImageBitmap) {
      return root.createImageBitmap(file).then(function (bmp) {
        return {
          source: bmp,
          width: bmp.width,
          height: bmp.height,
          release: function () { if (bmp.close) bmp.close(); }
        };
      }).catch(function () { return decodeViaImg(file); });
    }
    return decodeViaImg(file);
  }

  function decodeViaImg(file) {
    return new Promise(function (resolve, reject) {
      /* DoL 的 CSP 只允许 img-src 'self' data:，blob: 会被拦掉；这里必须走 data URL。 */
      var fr;
      try { fr = new root.FileReader(); } catch (e) { reject(new Error("decode-failed")); return; }
      fr.onload = function () {
        var img = new root.Image();
        img.onload = function () {
          resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, release: function () {} });
        };
        img.onerror = function () { reject(new Error("decode-failed")); };
        img.src = String(fr.result || "");
      };
      fr.onerror = function () { reject((fr && fr.error) || new Error("decode-failed")); };
      fr.readAsDataURL(file);
    });
  }

  function canvasOf(w, h) {
    var c = root.document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  var webpOk = null;
  function supportsWebp() {
    if (webpOk !== null) return webpOk;
    try {
      var c = canvasOf(1, 1);
      webpOk = c.toDataURL("image/webp").indexOf("data:image/webp") === 0;
    } catch (e) {
      webpOk = false;
    }
    return webpOk;
  }

  function toBlob(canvas) {
    return new Promise(function (resolve) {
      if (!canvas.toBlob) {
        try {
          var data = canvas.toDataURL("image/jpeg", 0.85);
          var bin = atob(data.split(",")[1]);
          var arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          resolve(new Blob([arr], { type: "image/jpeg" }));
        } catch (e) {
          resolve(null);
        }
        return;
      }
      var settled = false;
      function done(b) {
        if (settled) return;
        if (!b) return;
        settled = true;
        resolve(b);
      }
      try {
        if (supportsWebp()) canvas.toBlob(done, "image/webp", 0.82);
        else canvas.toBlob(done, "image/jpeg", 0.85);
      } catch (e2) {
        try { canvas.toBlob(done, "image/jpeg", 0.85); } catch (e3) { resolve(null); return; }
      }
      // 某些 WebView 的 toBlob 回调不触发，给一次兜底
      setTimeout(function () {
        if (settled) return;
        try { canvas.toBlob(done, "image/jpeg", 0.8); } catch (e4) { /* ignore */ }
        setTimeout(function () { if (!settled) { settled = true; resolve(null); } }, 400);
      }, 1200);
    });
  }

  /**
   * file → { blob, w, h, bytes, type }；超限/非图片给出 code 供 UI 提示。
   */
  function process(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject({ code: "no-file", message: "没有拿到文件" }); return; }
      if (file.type && file.type.indexOf("image/") !== 0) {
        reject({ code: "not-image", message: "这不是图片文件" });
        return;
      }
      if (file.size > MAX_FILE) {
        reject({ code: "too-large", message: "图片超过 15 MB，换一张小点的" });
        return;
      }
      decode(file).then(function (dec) {
        var lim = limits();
        var target = Core.fitWithin(dec.width, dec.height, lim.maxEdge, lim.maxArea);
        try {
          var c = canvasOf(target.w, target.h);
          var ctx = c.getContext("2d");
          if (!ctx) {
            reject({ code: "canvas-unavailable", message: "浏览器没有提供 2D 画布，换一个浏览器或关闭省电模式再试" });
            return;
          }
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(dec.source, 0, 0, target.w, target.h);
        } catch (drawErr) {
          reject({ code: "decode-failed", message: "这张图打不开，换一张试试（" + shortErr(drawErr) + "）" });
          return;
        } finally {
          if (dec.release) dec.release();
        }
        toBlob(c).then(function (blob) {
          if (!blob) { reject({ code: "encode-failed", message: "这张图压不出来，换一张试试" }); return; }
          resolve({
            blob: blob,
            w: target.w,
            h: target.h,
            srcW: dec.width,
            srcH: dec.height,
            bytes: blob.size,
            type: blob.type || "image/jpeg"
          });
        });
      }).catch(function (e) {
        reject({ code: (e && e.code) || "decode-failed", message: "这张图打不开，换一张试试（" + shortErr(e) + "）" });
      });
    });
  }

  /** 把浏览器长串异常压成一句人话，别把 drawImage 的英文原文甩给玩家 */
  function shortErr(e) {
    var m = String((e && e.message) || e || "");
    if (/drawImage|not of type/i.test(m)) return "图像类型不支持";
    if (/decode|encoding|corrupt|损坏/i.test(m)) return "格式不支持或文件已损坏";
    if (/size|too-large/i.test(m)) return "文件过大";
    return "解码失败";
  }

  /* -------------------------------------------------------------------------
   * 图片 URL 载体（CSP 决定，不是风格选择）
   *
   * 真实 DoL 在 <head> 里有：
   *   <meta http-equiv="Content-Security-Policy"
   *         content="... img-src 'self' data:; font-src 'self' data:">
   * → img-src 只放 self 与 data:，blob: 会被 CSP 拦掉（真机实测违规指令 `img-src blob`，
   *   表现为 --mlc-bg-img 有值、background-image 有值、像素却一个都不画）。
   * 宿主自建页没有这条 CSP，所以在宿主要是全绿、在游戏里全白 —— 载体必须是 data: URL。
   * 大图用 data: 会占内存，但图已在 process 阶段压到 ≤1600 边 / WebP 0.82，
   * 两个槽位合计通常在 400 KB 以内，可接受；换图按 blob 复用同一串，不重复编码。
   * ---------------------------------------------------------------------- */

  var dataUrls = {};        // key -> { blob, url }

  function toDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      if (!blob) { resolve(""); return; }
      try {
        var fr = new root.FileReader();
        fr.onload = function () { resolve(String(fr.result || "")); };
        fr.onerror = function () { reject((fr && fr.error) || new Error("读取图片失败")); };
        fr.readAsDataURL(blob);
      } catch (e) {
        reject(e);
      }
    });
  }

  /** 把图库里的 blob 变成可以写进 CSS 的 data: URL（同一个 blob 只编码一次） */
  function dataUrlFor(key, blob) {
    if (!blob) return Promise.resolve("");
    var cur = dataUrls[key];
    if (cur && cur.blob === blob) return Promise.resolve(cur.url);
    return toDataUrl(blob).then(function (url) {
      dataUrls[key] = { blob: blob, url: url };
      return url;
    });
  }

  /** 兼容旧调用：同步取已编码好的 data: URL（没编码过就返回空串，提示走 dataUrlFor） */
  function urlFor(key, blob) {
    var cur = dataUrls[key];
    if (cur && cur.blob === blob) return cur.url;
    return "";
  }

  function release(key) {
    delete dataUrls[key];
  }

  function releaseAll() {
    Object.keys(dataUrls).forEach(release);
  }

  var api = {
    __ready: true,
    DB_NAME: DB_NAME,
    STORE: STORE,
    MAX_FILE: MAX_FILE,
    available: function () { return hasIDB() && !dbBroken; },
    load: load,
    save: save,
    drop: drop,
    process: process,
    dataUrlFor: dataUrlFor,
    urlFor: urlFor,
    release: release,
    releaseAll: releaseAll,
    limits: limits
  };
  root.MapleLanternDossierAssets = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
