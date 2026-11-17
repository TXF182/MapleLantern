"""诊断 3：把面板缩成卡片，采样"面板外"的像素，判断背景层是否真的画到了卡片外。

诊断 2 的采样点全落在全屏面板内部，看到的深色其实是面板底色，不能判断背景层。
"""
import base64
import json
pathlib_ok = True
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
PROFILE = ROOT / "_edge_profile_diag3"
OUT = ROOT / "shots"
PORT = 9238
POINTS = ((12, 120), (378, 120), (12, 820), (378, 820), (195, 60), (195, 300))

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
        print("JS ERROR:", str(r["exceptionDetails"].get("exception"))[:160])
        return None
    return r.get("result", {}).get("value")


def grab(ws, name):
    data = send(ws, "Page.captureScreenshot", {"format": "png"})["result"]["data"]
    p = OUT / name
    p.write_bytes(base64.b64decode(data))
    return Image.open(p).convert("RGB")


def px(img):
    return {str(p): img.getpixel(p) for p in POINTS}


CARD = """
(async (css) => {
  const old = document.getElementById('diag-style');
  if (old) old.remove();
  const st = document.createElement('style');
  st.id = 'diag-style';
  st.textContent = "html[data-mlc='on'] #ml-root, #ml-root { width:320px !important; height:420px !important; left:35px !important; top:200px !important; right:auto !important; bottom:auto !important; }" + css;
  document.head.appendChild(st);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150))));
  const root = document.getElementById('ml-root');
  const bg = document.getElementById('mlc-bg');
  return {
    rootRect: root ? [Math.round(root.getBoundingClientRect().width), Math.round(root.getBoundingClientRect().height)] : null,
    rootBg: root ? getComputedStyle(root).backgroundColor : null,
    mlcZ: bg ? getComputedStyle(bg).zIndex : null,
    mlcImg: bg ? getComputedStyle(bg).backgroundImage.slice(0, 24) : null,
    htmlBg: getComputedStyle(document.documentElement).backgroundImage.slice(0, 24),
    bodyBg: getComputedStyle(document.body).backgroundColor
  };
})
"""


def run(ws, tag, css):
    info = evaluate(ws, CARD + "(%s)" % json.dumps(css))
    img = grab(ws, "diag3_%s.png" % tag)
    print("%-16s %s" % (tag, json.dumps(px(img), ensure_ascii=False)))
    print("%-16s %s" % ("", json.dumps(info, ensure_ascii=False)))
    return img


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

        run(ws, "0_card_plain", "")

        evaluate(ws, r"""(() => {
          const c = document.createElement('canvas');
          c.width = 64; c.height = 64;
          const g = c.getContext('2d');
          g.fillStyle = '#33506b'; g.fillRect(0, 0, 64, 64);
          window.MapleLanternDossierTheme.attach('bg', { url: c.toDataURL('image/png'), w: 64, h: 64 });
          window.MapleLanternCustom.setSettings({ bgOn: true, bgOpacity: 90 });
          return true;
        })()""")
        time.sleep(0.7)

        run(ws, "1_card_bgon", "")
        run(ws, "2_card_bgon_htmloff", "html{background-image:none !important;}")
        run(ws, "3_card_bgon_bodyred", "html[data-mlc='on'][data-mlc-bg='on'] body{background-color:#c81e1e !important;}")
    finally:
        try:
            ws.close()
        except Exception:
            pass
        proc.terminate()


if __name__ == "__main__":
    main()
