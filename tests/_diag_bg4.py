"""诊断：导入真实立绘图后，页面背景到底有没有铺上去、被谁挡住。

python tests/_diag_bg4.py
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
HTML = ROOT / "viewport-host.html"
IMG = ROOT / "fixtures" / "elf-portrait.png"
PROFILE = ROOT / "_edge_profile_diagbg4"
PORT = 9242
W, H, DPR = 390, 844, 2

if PROFILE.exists():
    shutil.rmtree(PROFILE, ignore_errors=True)
url = "file:///" + urllib.parse.quote(str(HTML).replace("\\", "/"))
proc = subprocess.Popen(
    [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
     "--allow-file-access-from-files", "--remote-debugging-port=" + str(PORT),
     "--user-data-dir=" + str(PROFILE), "about:blank"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

target = None
for _ in range(80):
    try:
        with urllib.request.urlopen("http://127.0.0.1:%d/json" % PORT, timeout=1) as r:
            tg = [t for t in json.loads(r.read().decode()) if t.get("type") == "page"]
        if tg:
            target = tg[0]
            break
    except Exception:
        time.sleep(0.4)

ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=30)
n = [0]


def cmd(method, params=None):
    n[0] += 1
    mid = n[0]
    ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == mid:
            if "error" in m:
                raise RuntimeError(m["error"])
            return m.get("result", {})


def ev(expr):
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True,
                                 "allowUnsafeEvalBlockedByCSP": True})
    res = r.get("result", {})
    if res.get("subtype") == "error":
        raise RuntimeError(res.get("description"))
    return res.get("value")


def shot(path):
    r = cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False})
    pathlib.Path(path).write_bytes(base64.b64decode(r["data"]))
    return Image.open(path).convert("RGB")


cmd("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": DPR, "mobile": True})
cmd("Page.navigate", {"url": url})
time.sleep(2.5)
ev("new Promise(r => { if (document.readyState === 'complete') r(1); else addEventListener('load', () => r(1)); })")

before = shot(ROOT / "shots" / "diag4-before.png")

# ---- 走真实入口导入 ----
b64 = base64.b64encode(IMG.read_bytes()).decode()
ok = ev(r"""(async () => {
  const b64 = "%s";
  const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const file = new File([bin], "elf.png", { type: "image/png" });
  const row = document.querySelector('[data-mdd-custom-part="bg-pick"]');
  const btn = row ? (row.querySelector('.md-pick') || row) : null;
  if (!btn) return 'no pick button';
  btn.click();
  await new Promise(r => setTimeout(r, 40));
  const inp = document.querySelector('input[type=file]');
  if (!inp) return 'no input';
  const dt = new DataTransfer();
  dt.items.add(file);
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise(r => setTimeout(r, 400));
  return 'done';
})()""" % b64)

after = shot(ROOT / "shots" / "diag4-after.png")

info = ev(r"""(() => {
  const bg = document.querySelector('#mlc-bg');
  const st = document.querySelector('#mdStage');
  const panel = document.querySelector('#ml-root .ml-panel');
  const cs = bg ? getComputedStyle(bg) : null;
  const root = getComputedStyle(document.documentElement);
  const body = getComputedStyle(document.body);
  const stR = st ? st.getBoundingClientRect() : null;
  const pR = panel ? panel.getBoundingClientRect() : null;
  return {
    importResult: true,
    bgLayer: bg ? {
      exists: true,
      rect: [Math.round(bg.getBoundingClientRect().width), Math.round(bg.getBoundingClientRect().height)],
      opacity: cs.opacity,
      hasUrl: cs.backgroundImage.indexOf('url(') >= 0,
      size: cs.backgroundSize, pos: cs.backgroundPosition, repeat: cs.backgroundRepeat,
      z: cs.zIndex, disp: cs.display, posType: cs.position,
      filter: cs.filter, parent: bg.parentElement.tagName + '.' + bg.parentElement.className
    } : { exists: false },
    htmlBg: root.backgroundImage.slice(0, 120),
    htmlBgAttach: root.backgroundAttachment,
    bodyBg: body.backgroundColor,
    bodyImg: body.backgroundImage.slice(0, 60),
    mlcAttr: document.documentElement.getAttribute('data-mlc'),
    mlcBgAttr: document.documentElement.getAttribute('data-mlc-bg'),
    vars: {
      surfaceAlpha: root.getPropertyValue('--ml-surface-alpha').trim(),
      mlcSurfaceAlpha: root.getPropertyValue('--mlc-surface-alpha').trim(),
      mlcBgOp: root.getPropertyValue('--mlc-bg-op').trim(),
      panelBg: root.getPropertyValue('--ml-panel-bg').trim(),
      mlcBgImg: root.getPropertyValue('--mlc-bg-img').trim().slice(0, 40)
    },
    stage: stR ? { rect: [Math.round(stR.left), Math.round(stR.top), Math.round(stR.width), Math.round(stR.height)],
                   bgAttr: st.getAttribute('data-mlc-bg'),
                   bgKindAttr: st.getAttribute('data-mlc-movable'),
                   bgLayerDisp: (() => { const b = st.querySelector('.md-stage-bg'); const c = b && getComputedStyle(b); return c ? c.backgroundImage.indexOf('url(') >= 0 : null; })() } : null,
    panel: pR ? { rect: [Math.round(pR.left), Math.round(pR.top), Math.round(pR.width), Math.round(pR.height)] } : null,
    note: (document.querySelector('[data-mdd-custom-part="note"]') || {}).textContent,
    pos: (document.querySelector('[data-mdd-custom-part="stage-pos"]') || {}).textContent
  };
})()""")

print("import:", ok)
print(json.dumps(info, ensure_ascii=False, indent=1))

# ---- 像素对比 ----
pts = {"面板外-顶部(20,40)": (20, 40), "面板外-顶部(195,60)": (195, 60), "面板外-左侧(8,300)": (8, 300)}
st = info.get("stage")
if st:
    x, y, w, h = st["rect"]
    pts["舞台中心"] = (x + w // 2, y + h // 2)
    pts["舞台左上"] = (x + 8, y + 8)
print("=== 像素（导入前 -> 导入后）===")
for name, (x, y) in pts.items():
    a = before.getpixel((x * DPR, y * DPR))
    b = after.getpixel((x * DPR, y * DPR))
    print("%-18s %s -> %s  %s" % (name, a, b, "变化" if a != b else "无变化"))

# ---- 刷新后是否还在（真机玩家的真实动作）----
cmd("Page.reload", {"ignoreCache": True})
time.sleep(3.0)
ev("new Promise(r => { if (document.readyState === 'complete') r(1); else addEventListener('load', () => r(1)); })")
time.sleep(1.5)
after2 = shot(ROOT / "shots" / "diag4-reload.png")
info2 = ev(r"""(() => {
  const bg = document.querySelector('#mlc-bg');
  const cs = bg ? getComputedStyle(bg) : null;
  const st = document.querySelector('#mdStage');
  const panel = document.querySelector('#ml-root .ml-panel');
  return {
    mlcBgAttr: document.documentElement.getAttribute('data-mlc-bg'),
    bgUrl: cs ? cs.backgroundImage.indexOf('url(') >= 0 : null,
    bgImgVar: document.documentElement.style.getPropertyValue('--mlc-bg-img').slice(0, 50),
    stageAttr: st ? st.getAttribute('data-mlc-bg') : null,
    stageBgUrl: st && st.querySelector('.md-stage-bg')
      ? getComputedStyle(st.querySelector('.md-stage-bg')).backgroundImage.indexOf('url(') >= 0 : null,
    stageRect: st ? [Math.round(st.getBoundingClientRect().width), Math.round(st.getBoundingClientRect().height)] : null,
    note: (document.querySelector('[data-mdd-custom-part="note"]') || {}).textContent,
    pos: (document.querySelector('[data-mdd-custom-part="stage-pos"]') || {}).textContent,
    pickBtns: Array.from(document.querySelectorAll('[data-mdd-custom-part="bg-pick"] .md-pick')).map(x => x.textContent.trim()),
    panelHere: !!panel
  };
})()""")
print("=== 刷新后 ===")
print(json.dumps(info2, ensure_ascii=False, indent=1))
print("=== 刷新后像素 ===")
for name, (x, y) in pts.items():
    b = after.getpixel((x * DPR, y * DPR))
    c = after2.getpixel((x * DPR, y * DPR))
    print("%-18s 导入后 %s -> 刷新后 %s  %s" % (name, b, c, "保持" if b == c else "变了"))

ws.close()
proc.terminate()
