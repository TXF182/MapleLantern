"""图片形式矩阵：真实 File → Assets.process，逐格式取证（Edge headless + CDP）。

用法：python tests/custom_formats.py
判据：exit 0 且 [FAIL] 为 0。矩阵落在 tests/shots/formats.txt。
覆盖：JPEG(含 CMYK/EXIF 旋转) / PNG(透明/4000×3000 大图/1×1) / WebP(静态/动图) /
      GIF 动图 / BMP / ICO / AVIF / TIFF / SVG / 无 MIME。
"""
import base64
import io
import json
import pathlib
import shutil
import subprocess
import time
import urllib.parse
import urllib.request

import websocket
from PIL import Image

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ROOT = pathlib.Path(__file__).resolve().parent
HTML = ROOT / "custom-host.html"
FIX = ROOT / "fmt"
PROFILE = ROOT / "_edge_profile_fmt"
SHOTS = ROOT / "shots"
PORT = 9235

results = []
exceptions = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("[PASS] " if ok else "[FAIL] ") + name + ((" | " + str(detail)) if detail else ""))


def gen():
    if FIX.exists():
        shutil.rmtree(FIX, ignore_errors=True)
    FIX.mkdir(parents=True)

    def save(im, name, **kw):
        im.save(FIX / name, **kw)

    save(Image.new("RGB", (800, 1200), (32, 70, 96)), "a.jpg", quality=88)
    cmyk = Image.new("CMYK", (600, 800), (10, 20, 30, 5))
    save(cmyk, "cmyk.jpg", quality=88)

    # EXIF Orientation=6：拍摄时横置，显示应旋转 90°（400×200 → 200×400）
    exif = Image.Exif()
    exif[274] = 6
    save(Image.new("RGB", (400, 200), (120, 90, 40)), "exif6.jpg", quality=88, exif=exif)

    alpha = Image.new("RGBA", (600, 400), (0, 0, 0, 0))
    for x in range(600):
        for y in range(200):
            alpha.putpixel((x, y), (200, 60, 40, 255))
    save(alpha, "alpha.png")

    save(Image.new("RGB", (4000, 3000), (18, 40, 60)), "big.png")
    save(Image.new("RGBA", (1, 1), (255, 255, 255, 255)), "tiny.png")

    save(Image.new("RGB", (900, 600), (60, 110, 80)), "s.webp", quality=85)

    f1 = Image.new("P", (320, 240), 0)
    f2 = Image.new("P", (320, 240), 1)
    f1.putpalette([10, 20, 30, 200, 60, 40] + [0] * 762)
    f2.putpalette([200, 60, 40, 10, 20, 30] + [0] * 762)
    f1.save(FIX / "anim.webp", save_all=True, append_images=[f2], duration=200, loop=0)
    f1.save(FIX / "anim.gif", save_all=True, append_images=[f2], duration=200, loop=0)

    save(Image.new("RGB", (640, 480), (40, 60, 90)), "b.bmp")
    save(Image.new("RGBA", (256, 256), (30, 120, 90, 255)), "i.ico", sizes=[(256, 256)])
    save(Image.new("RGB", (700, 500), (90, 40, 60)), "t.tiff", compression="tiff_lzw")
    save(Image.new("RGB", (640, 480), (70, 40, 90)), "v.avif", quality=60)

    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200">'
           '<rect width="300" height="200" fill="#1f3b56"/>'
           '<circle cx="150" cy="100" r="60" fill="#c9a227"/></svg>')
    (FIX / "svg.svg").write_text(svg, "utf-8")

    # 无 MIME：直接给 extension 但 type 留空，走内容嗅探
    (FIX / "nomime.bin").write_bytes((FIX / "a.jpg").read_bytes())
    print("fixtures:", len(list(FIX.iterdir())))


def start():
    if PROFILE.exists():
        shutil.rmtree(PROFILE, ignore_errors=True)
    SHOTS.mkdir(exist_ok=True)
    url = "file:///" + urllib.parse.quote(str(HTML).replace("\\", "/"))
    proc = subprocess.Popen(
        [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
         "--allow-file-access-from-files",
         "--remote-debugging-port=" + str(PORT), "--user-data-dir=" + str(PROFILE), "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    target = None
    for _ in range(80):
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/json" % PORT, timeout=1) as r:
                targets = json.loads(r.read().decode("utf-8"))
            pages = [t for t in targets if t.get("type") == "page"]
            if pages:
                target = pages[0]
                break
        except Exception:
            time.sleep(0.4)
    if not target:
        raise SystemExit("无法启动 Edge / 无调试目标")
    ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=20)
    return proc, ws, url


seq = 0


def send(ws, method, params=None):
    global seq
    seq += 1
    mid = seq
    ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("method") == "Runtime.exceptionThrown":
            exceptions.append(msg["params"]["exceptionDetails"].get("text", "?"))
        if msg.get("id") == mid:
            return msg


def evaluate(ws, expr):
    res = send(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    r = res.get("result", {})
    if "exceptionDetails" in r:
        exceptions.append(str(r["exceptionDetails"].get("text")))
        return None
    return r.get("result", {}).get("value")


RUN = r"""(() => {
  const A = window.MapleLanternDossierAssets;
  window.__fmtRun = async (file, label) => {
    const t0 = performance.now();
    try {
      const r = await A.process(file);
      // 产物再解一次，看真实宽高与是否保透明
      const out = await createImageBitmap(r.blob).catch(() => null);
      const probe = document.createElement('canvas');
      probe.width = r.w; probe.height = r.h;
      let alpha = false;
      if (out) {
        const g = probe.getContext('2d');
        g.clearRect(0, 0, r.w, r.h);
        g.drawImage(out, 0, 0);
        const px = g.getImageData(Math.floor(r.w / 2), Math.floor(r.h / 2), 1, 1).data;
        alpha = px[3] < 255;
        if (out.close) out.close();
      }
      return { ok: true, lbl: label, w: r.w, h: r.h, srcW: r.srcW, srcH: r.srcH,
               bytes: r.bytes, type: r.type, blobType: r.blob.type,
               transparent: alpha, ms: Math.round(performance.now() - t0) };
    } catch (e) {
      return { ok: false, lbl: label, code: e && e.code, message: e && e.message,
               ms: Math.round(performance.now() - t0) };
    }
  };
  return true;
})()"""

PICK = r"""(() => {
  const f = window.__fmtFile;
  return window.__fmtRun(f.file, f.label);
})()"""


def mk_file(ws, name, mime, label):
    """把 tests/fmt/<name> 读成 File 放进页面：走 fetch(file://) → File，等价于玩家选文件。"""
    expr = r"""(async () => {
      const r = await fetch('fmt/%s', { cache: 'no-store' });
      const b = await r.blob();
      window.__fmtFile = { file: new File([b], '%s', { type: '%s' }), label: '%s', fetched: b.size, blobType: b.type };
      return window.__fmtFile.fetched;
    })()""" % (name, name, mime, label)
    return evaluate(ws, expr)


CASES = [
    ("a.jpg", "image/jpeg", "JPEG 800×1200"),
    ("cmyk.jpg", "image/jpeg", "JPEG CMYK"),
    ("exif6.jpg", "image/jpeg", "JPEG EXIF 旋转 6"),
    ("alpha.png", "image/png", "PNG 透明"),
    ("big.png", "image/png", "PNG 4000×3000"),
    ("tiny.png", "image/png", "PNG 1×1"),
    ("s.webp", "image/webp", "WebP 静态"),
    ("anim.webp", "image/webp", "WebP 动图"),
    ("anim.gif", "image/gif", "GIF 动图"),
    ("b.bmp", "image/bmp", "BMP"),
    ("i.ico", "image/x-icon", "ICO 256"),
    ("t.tiff", "image/tiff", "TIFF"),
    ("v.avif", "image/avif", "AVIF"),
    ("svg.svg", "image/svg+xml", "SVG"),
    ("nomime.bin", "", "无 MIME"),
]

HARD_FAIL = ("drawImage", "not of type", "Failed to execute")


def main():
    gen()
    proc, ws, url = start()
    try:
        send(ws, "Page.enable")
        send(ws, "Runtime.enable")
        send(ws, "Emulation.setDeviceMetricsOverride",
             {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})
        send(ws, "Page.navigate", {"url": url})
        time.sleep(2.5)

        ready = evaluate(ws, "!!(window.MapleLanternDossierAssets && window.MapleLanternDossierAssets.process)")
        check("Assets.process 可用", ready, str(ready))
        evaluate(ws, RUN)

        rows = []
        for name, mime, label in CASES:
            n = mk_file(ws, name, mime, label)
            if not n:
                check("fixture 可读 " + name, False, "fetch 失败")
                continue
            r = evaluate(ws, PICK) or {}
            rows.append((label, r))

        def get(label):
            for lb, rr in rows:
                if lb == label:
                    return rr
            return {}

        # —— 必须成功、且形状正确 ——
        j = get("JPEG 800×1200")
        check("JPEG 导入成功且尺寸不变", j.get("ok") and (j.get("w"), j.get("h")) == (800, 1200), str(j))
        a = get("PNG 透明")
        check("PNG 透明：产物仍是 WebP 且保留 alpha",
              a.get("ok") and a.get("type") == "image/webp" and a.get("transparent") is True, str(a))
        bg = get("PNG 4000×3000")
        check("PNG 4000×3000 降到长边 1200（1200×900）",
              bg.get("ok") and max(bg.get("w", 0), bg.get("h", 0)) == 1200
              and (bg.get("w"), bg.get("h")) == (1200, 900), str(bg))
        cm = get("JPEG CMYK")
        check("JPEG CMYK 导入成功", cm.get("ok") and cm.get("w") == 600, str(cm))
        ti = get("PNG 1×1")
        check("PNG 1×1 不崩（成功或友好拒绝）", ti.get("ok") or ti.get("code"), str(ti))
        w = get("WebP 静态")
        check("WebP 静态导入成功", w.get("ok") and w.get("w") == 900, str(w))
        wa = get("WebP 动图")
        check("WebP 动图取首帧（静态产物，尺寸对）", wa.get("ok") and wa.get("w") == 320, str(wa))
        g = get("GIF 动图")
        check("GIF 动图取首帧（静态产物，尺寸对）", g.get("ok") and g.get("w") == 320, str(g))
        b = get("BMP")
        check("BMP 导入成功", b.get("ok") and b.get("w") == 640, str(b))

        # —— EXIF：方向必须被应用；未应用则是真缺陷（玩家竖拍照片会躺倒）——
        e = get("JPEG EXIF 旋转 6")
        check("JPEG EXIF Orientation=6 已应用（400×200 → 200×400）",
              e.get("ok") and (e.get("w"), e.get("h")) == (200, 400), str(e))

        # —— 允许不支持，但必须是友好提示，不能是英文原文 ——
        for lb in ("TIFF", "AVIF", "ICO 256", "SVG", "无 MIME"):
            rr = get(lb)
            ok_shape = bool(rr)
            friendly = not any(s in str(rr.get("message", "")) for s in HARD_FAIL)
            check(f"{lb}：结果明确且提示友好", ok_shape and friendly,
                  ("ok " + str(rr.get("w")) + "×" + str(rr.get("h"))) if rr.get("ok") else (str(rr.get("code")) + " / " + str(rr.get("message"))))

        # —— 全矩阵不得出现未捕获异常 / 英文原文 ——
        bad = [rr for _, rr in rows if any(s in str(rr.get("message", "")) for s in HARD_FAIL)]
        check("矩阵内零英文原文报错", not bad, str([x.get("lbl") for x in bad]))
        check("矩阵内零未捕获异常", not exceptions, str(exceptions[:3]))

        out = SHOTS / "formats.txt"
        lines = ["格式矩阵（Edge headless 390×844 dpr2，真实 File→Assets.process）", ""]
        lines.append("label | ok | w×h | src | bytes | type | alpha | ms | code | message")
        for lb, rr in rows:
            lines.append(" | ".join([
                lb, str(rr.get("ok")),
                f"{rr.get('w')}×{rr.get('h')}" if rr.get("ok") else "-",
                f"{rr.get('srcW')}×{rr.get('srcH')}" if rr.get("ok") else "-",
                str(rr.get("bytes", "-")), str(rr.get("type", "-")),
                str(rr.get("transparent", "-")), str(rr.get("ms", "-")),
                str(rr.get("code", "-")), str(rr.get("message", "-"))[:60],
            ]))
        out.write_text("\n".join(lines) + "\n", "utf-8")
        print("matrix:", out)
    finally:
        try:
            ws.close()
        except Exception:
            pass
        proc.terminate()

    ok = all(r[1] for r in results)
    print("\n--- 结果 ---")
    print("合计: %d PASS / %d FAIL" % (sum(1 for r in results if r[1]), sum(1 for r in results if not r[1])))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
