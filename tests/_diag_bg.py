"""诊断：开背景图后屏幕像素有没有真的变（不是只看 computed style）。

用法：python tests/_diag_bg.py
输出：截图前后差异比例、中心像素、层级栈、关键计算值。
"""
import base64
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
PROFILE = ROOT / "_edge_profile_diag"
OUT = ROOT / "shots"
PORT = 9236

seq = 0


def send(ws, method, params=None):
    global seq
    seq += 1
    mid = seq
    ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == mid:
            return msg


def evaluate(ws, expr):
    res = send(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    r = res.get("result", {})
    if "exceptionDetails" in r:
        print("JS ERROR:", r["exceptionDetails"].get("text"), str(r["exceptionDetails"].get("exception"))[:200])
        return None
    return r.get("result", {}).get("value")


def grab(ws, name):
    data = send(ws, "Page.captureScreenshot", {"format": "png"})["result"]["data"]
    p = OUT / name
    p.write_bytes(base64.b64decode(data))
    return p


def main():
    if PROFILE.exists():
        shutil.rmtree(PROFILE, ignore_errors=True)
    OUT.mkdir(exist_ok=True)
    url = "file:///" + urllib.parse.quote(str(HTML).replace("\\", "/"))
    proc = subprocess.Popen(
        [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
         "--allow-file-access-from-files",
         "--remote-debugging-port=" + str(PORT), "--user-data-dir=" + str(PROFILE), "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    target = None
    for _ in range(80):
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/json" % PORT, timeout=1) as r:
                ts = json.loads(r.read().decode("utf-8"))
            pages = [t for t in ts if t.get("type") == "page"]
            if pages:
                target = pages[0]
                break
        except Exception:
            time.sleep(0.4)
    ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=20)
    try:
        send(ws, "Page.enable")
        send(ws, "Runtime.enable")
        send(ws, "Emulation.setDeviceMetricsOverride",
             {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        send(ws, "Page.navigate", {"url": url})
        time.sleep(2.2)

        a = grab(ws, "diag_before.png")

        evaluate(ws, r"""(() => {
          const c = document.createElement('canvas');
          c.width = 64; c.height = 64;
          const g = c.getContext('2d');
          g.fillStyle = '#33506b'; g.fillRect(0, 0, 64, 64);
          const url = c.toDataURL('image/png');
          window.MapleLanternDossierTheme.attach('bg', { url: url, w: 64, h: 64 });
          window.MapleLanternCustom.setSettings({ bgOn: true, bgOpacity: 90 });
          return true;
        })()""")
        time.sleep(0.6)
        b = grab(ws, "diag_after.png")

        info = evaluate(ws, r"""(() => {
          const e = document.getElementById('mlc-bg');
          const r = e ? e.getBoundingClientRect() : null;
          const cs = e ? getComputedStyle(e) : null;
          const stack = (document.elementsFromPoint(195, 300) || []).map(x => x.id || String(x.className) || x.tagName).slice(0, 6);
          const story = document.getElementById('story');
          return {
            attrBg: document.documentElement.getAttribute('data-mlc-bg'),
            attrMlc: document.documentElement.getAttribute('data-mlc'),
            rect: r ? [Math.round(r.width), Math.round(r.height)] : null,
            img: cs ? cs.backgroundImage.slice(0, 40) : null,
            op: cs ? cs.opacity : null,
            z: cs ? cs.zIndex : null,
            pos: cs ? cs.position : null,
            attach: cs ? cs.backgroundAttachment : null,
            filter: cs ? cs.filter : null,
            bodyBg: getComputedStyle(document.body).backgroundColor,
            bodyImg: getComputedStyle(document.body).backgroundImage.slice(0, 40),
            htmlBg: getComputedStyle(document.documentElement).backgroundImage.slice(0, 40),
            storyBg: story ? getComputedStyle(story).backgroundColor : 'no #story',
            stack: stack,
            varImg: document.documentElement.style.getPropertyValue('--mlc-bg-img').slice(0, 30)
          };
        })()""")
        print(json.dumps(info, ensure_ascii=False, indent=2))

        # 假设验证：background-attachment:fixed 与 filter 会让 fixed 背景层不绘制
        evaluate(ws, r"""(() => {
          const st = document.createElement('style');
          st.id = 'diag-patch';
          st.textContent = 'html[data-mlc="on"] #mlc-bg{background-attachment:scroll !important;filter:none !important;}';
          document.head.appendChild(st);
          return true;
        })()""")
        time.sleep(0.5)
        c = grab(ws, "diag_patched.png")

        detail = evaluate(ws, r"""(() => {
          const e = document.getElementById('mlc-bg');
          const cs = getComputedStyle(e);
          const keys = ['display','visibility','zIndex','position','inset','width','height','opacity','filter',
                        'backgroundAttachment','backgroundColor','backgroundImage','transform','contain','clipPath'];
          const out = {};
          keys.forEach(k => out[k] = cs[k]);
          out.parent = e.parentElement.tagName;
          out.bodyHasTransform = getComputedStyle(document.body).transform !== 'none';
          out.bodyOverflow = getComputedStyle(document.body).overflow;
          out.bodyPosition = getComputedStyle(document.body).position;
          return out;
        })()""")
        print(json.dumps(detail, ensure_ascii=False, indent=2))

        # 变体 1：z-index 抬到 0
        evaluate(ws, """(() => { const st=document.createElement('style'); st.textContent='html[data-mlc="on"] #mlc-bg{z-index:0 !important;}'; document.head.appendChild(st); return 1; })()""")
        time.sleep(0.4)
        d1 = grab(ws, "diag_z0.png")
        evaluate(ws, """(() => { document.querySelectorAll('style').forEach(s=>{ if(s.textContent.includes('z-index:0 !important')) s.remove(); }); return 1; })()""")

        # 变体 2：直接把同样的图挂到 body 上（验证图与可见性）
        evaluate(ws, """(() => { const st=document.createElement('style'); st.textContent='body{background-image:var(--mlc-bg-img) !important;background-size:cover !important;background-attachment:scroll !important;}'; document.head.appendChild(st); return 1; })()""")
        time.sleep(0.4)
        d2 = grab(ws, "diag_bodybg.png")

        A = Image.open(a).convert("RGB")
        B = Image.open(b).convert("RGB")
        C = Image.open(c).convert("RGB")
        D1 = Image.open(d1).convert("RGB")
        D2 = Image.open(d2).convert("RGB")

        def ratio(X, Y):
            w, h = X.size
            px = diff = 0
            for y in range(0, h, 10):
                for x in range(0, w, 10):
                    pa, pb = X.getpixel((x, y)), Y.getpixel((x, y))
                    px += 1
                    if sum(abs(pa[i] - pb[i]) for i in range(3)) > 12:
                        diff += 1
            return px, diff, round(diff / px, 3)

        print("before->after(bg on)  ", ratio(A, B))
        print("before->after(patched)", ratio(A, C))
        print("before->after(z=0)    ", ratio(A, D1))
        print("before->after(bodybg) ", ratio(A, D2))
        for xy in ((195, 300), (195, 420), (100, 700), (330, 200)):
            print("sample", xy, "before", A.getpixel(xy), "bg-on", B.getpixel(xy),
                  "z0", D1.getpixel(xy), "bodybg", D2.getpixel(xy))
    finally:
        try:
            ws.close()
        except Exception:
            pass
        proc.terminate()


if __name__ == "__main__":
    main()
