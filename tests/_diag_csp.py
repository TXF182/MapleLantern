"""A/B 定证：同一张 PNG，用 blob: URL 与 data: URL 分别当 background-image，
在真实 DoL 页面（带 CSP img-src 'self' data:）里看像素有没有画出来。

python tests/_diag_csp.py
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
GAME = ROOT.parent.parent / "game" / "Degrees of Lewdity.html"
PROFILE = ROOT / "_edge_profile_csp"
PORT = 9245

buf = io.BytesIO()
im = Image.new("RGB", (200, 400), (220, 30, 30))
for x in range(100, 200):
    for y in range(400):
        im.putpixel((x, y), (30, 200, 60))
im.save(buf, format="PNG")
PNG_B64 = base64.b64encode(buf.getvalue()).decode()

if PROFILE.exists():
    shutil.rmtree(PROFILE, ignore_errors=True)
url = "file:///" + urllib.parse.quote(str(GAME).replace("\\", "/"))
proc = subprocess.Popen(
    [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
     "--allow-file-access-from-files", "--remote-debugging-port=" + str(PORT),
     "--user-data-dir=" + str(PROFILE), "about:blank"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

target = None
for _ in range(100):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/json" % PORT, timeout=1) as r:
            tg = [t for t in json.loads(r.read().decode()) if t.get("type") == "page"]
        if tg:
            target = tg[0]
            break
    except Exception:
        time.sleep(0.4)

ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=120)
n = [0]


def cmd(method, params=None, timeout=120):
    n[0] += 1
    mid = n[0]
    ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
    end = time.time() + timeout
    while time.time() < end:
        m = json.loads(ws.recv())
        if m.get("id") == mid:
            return m.get("result", {})
    raise TimeoutError(method)


def ev(expr, timeout=120):
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}, timeout=timeout)
    return r.get("result", {}).get("value")


def shot(path):
    r = cmd("Page.captureScreenshot", {"format": "png"})
    (ROOT / "shots" / path).write_bytes(base64.b64decode(r["data"]))


cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})
cmd("Page.enable")
print("loading ...")
cmd("Page.navigate", {"url": url}, timeout=120)
for i in range(90):
    time.sleep(1)
    if ev("document.readyState") == "complete" and ev("!!document.querySelector('#passages')"):
        print("loaded after %ds" % (i + 1))
        break
time.sleep(1.5)

# 先在页面上直接测 CSP 会不会拦：造两个 100×100 的格子
ev("""(() => {
  const mk = (id, bg) => {
    const d = document.createElement('div');
    d.id = id;
    d.style.cssText = 'position:fixed;left:0;top:0;width:100px;height:100px;z-index:2147483647;background-image:' + bg + ';background-size:cover;';
    document.body.appendChild(d);
    return d;
  };
  window.__b = new Blob([Uint8Array.from(atob('__B64__'), c => c.charCodeAt(0))], {type:'image/png'});
  mk('csp-blob', 'url(' + URL.createObjectURL(window.__b) + ')');
  mk('csp-data', 'url("data:image/png;base64,__B64__")');
  return [document.getElementById('csp-blob').style.backgroundImage.slice(0,20),
          document.getElementById('csp-data').style.backgroundImage.slice(0,20)];
})()""".replace("__B64__", PNG_B64))

# 听 CSP 违规
print("violations:", ev("""(() => {
  return new Promise(res => {
    const out = [];
    document.addEventListener('securitypolicyviolation', e => out.push(e.violatedDirective + ' ' + (e.blockedURI||'').slice(0,24)), { once: false });
    setTimeout(() => res(out), 800);
    // 触发一次：重新赋同一个 blob 图
    const d = document.getElementById('csp-blob');
    d.style.backgroundImage = 'none';
    void d.offsetWidth;
    d.style.backgroundImage = 'url(' + URL.createObjectURL(window.__b) + ')';
  });
})()""", timeout=30))

time.sleep(1.2)
shot("csp-ab.png")
p = Image.open(ROOT / "shots" / "csp-ab.png").convert("RGB")
print("blob 块 (50,50)  ->", p.getpixel((100, 100)))
print("data 块 (50,50)  ->", p.getpixel((100, 100)))
# 两个块重叠了，改成错开位置再测
ev("""(() => {
  document.getElementById('csp-blob').style.left = '0px';
  document.getElementById('csp-data').style.left = '120px';
  return 1;
})()""")
time.sleep(1)
shot("csp-ab2.png")
p2 = Image.open(ROOT / "shots" / "csp-ab2.png").convert("RGB")
print("blob 块中心 ->", p2.getpixel((100, 100)), " (期望红 220,30,30)")
print("data 块中心 ->", p2.getpixel((120 * 2 + 100, 100)), " (期望红 220,30,30)")

ws.close()
proc.terminate()
