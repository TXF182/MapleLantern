"""诊断 2：逐变体定位"背景层为何不显示"。

每个变体单独截图（390×844 dpr1），比较固定采样点像素；每步用 computed style
确认 patch 真的生效，避免把"样式没生效"误判成"渲染不出来"。
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
PROFILE = ROOT / "_edge_profile_diag2"
OUT = ROOT / "shots"
PORT = 9237
POINTS = ((195, 300), (195, 420), (100, 700), (330, 200))

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
    return [img.getpixel(p) for p in POINTS]


TPL = r"""
(async (css, withProbe) => {
  document.querySelectorAll('#diag-style').forEach(n => n.remove());
  const old = document.getElementById('diag-probe');
  if (old) old.remove();
  if (css) {
    const st = document.createElement('style');
    st.id = 'diag-style';
    st.textContent = css;
    document.head.appendChild(st);
  }
  if (withProbe) {
    const p = document.createElement('div');
    p.id = 'diag-probe';
    p.style.cssText = 'position:fixed;inset:0;background:#c81e1e;z-index:0;pointer-events:none;';
    document.body.appendChild(p);
  }
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 150))));
  const bg = document.getElementById('mlc-bg');
  const cs = bg ? getComputedStyle(bg) : null;
  const probe = document.getElementById('diag-probe');
  return {
    mlcZ: cs ? cs.zIndex : null,
    mlcOp: cs ? cs.opacity : null,
    mlcImg: cs ? cs.backgroundImage.slice(0, 26) : null,
    probeZ: probe ? getComputedStyle(probe).zIndex : null,
    htmlBg: getComputedStyle(document.documentElement).backgroundImage.slice(0, 26),
    bodyBg: getComputedStyle(document.body).backgroundColor
  };
})
"""


def run_variant(ws, tag, css, with_probe):
    info = evaluate(ws, TPL + "(%s, %s)" % (json.dumps(css), "true" if with_probe else "false"))
    img = grab(ws, "diag2_%s.png" % tag)
    print("%-22s px=%s" % (tag, px(img)))
    print("%-22s info=%s" % ("", json.dumps(info, ensure_ascii=False)))
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

        run_variant(ws, "0_plain", "", False)

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

        run_variant(ws, "1_bg_on", "", False)
        run_variant(ws, "2_probe_z0", "", True)
        run_variant(ws, "3_probe_zm1", "#diag-probe{z-index:-1 !important;}", True)
        run_variant(ws, "4_html_off", "html{background-image:none !important;}", False)
        run_variant(ws, "5_body_off", "html{background-image:none !important;}"
                                     "html[data-mlc='on'][data-mlc-bg='on'] body{background-color:#c81e1e !important;}", False)
    finally:
        try:
            ws.close()
        except Exception:
            pass
        proc.terminate()


if __name__ == "__main__":
    main()
