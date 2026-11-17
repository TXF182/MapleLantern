"""诊断：把本包的背景层注入到**真实 64 MB 游戏页面**，验 `--mlc-bg-img` 与 `#mlc-bg` 到底有没有画出来。

python tests/_diag_realinject.py

为什么必须有这一层：宿主 `tests/custom-host.html` 是自己写的 DOM，body 底色、#story 层叠上下文都由自己决定，
永远复现不出真机。玩家报「导入后背景仍然没有」，必须回到真实页面取数。
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

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT.parent / "src"
GAME = ROOT.parent.parent / "game" / "Degrees of Lewdity.html"
PROFILE = ROOT / "_edge_profile_realinject"
PORT = 9244

CSS_FILES = ["custom.css"]
JS_FILES = ["dossier-core.js", "dossier-assets.js", "dossier-theme.js", "custom.js"]

# ---- 造一张判据图：200×400，左半纯红、右半纯绿，铺上就一定能采到 ----
from PIL import Image  # noqa: E402

buf = io.BytesIO()
img = Image.new("RGB", (200, 400), (220, 30, 30))
for x in range(100, 200):
    for y in range(400):
        img.putpixel((x, y), (30, 200, 60))
img.save(buf, format="PNG")
PNG_B64 = base64.b64encode(buf.getvalue()).decode()
print("probe png base64 len:", len(PNG_B64))

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
cid = [0]


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
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True,
                                 "awaitPromise": True}, timeout=timeout)
    res = r.get("result", {})
    if res.get("subtype") == "error":
        return "ERR: " + str(res.get("description"))[:200]
    return res.get("value")


def shot(path):
    r = cmd("Page.captureScreenshot", {"format": "png"})
    (ROOT / "shots" / path).write_bytes(base64.b64decode(r["data"]))
    print("shot:", path)


cmd("Emulation.setDeviceMetricsOverride",
    {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})
cmd("Page.enable")
print("loading 64MB game page ...")
cmd("Page.navigate", {"url": url}, timeout=120)
for i in range(90):
    time.sleep(1)
    if ev("document.readyState") == "complete" and ev("!!document.querySelector('#passages')"):
        print("loaded after %ds" % (i + 1))
        break
time.sleep(2)

shot("realinject-before.png")
before = ev("""(() => {
  const pts = [[20,40],[195,60],[8,300],[300,700]];
  return pts.map(([x,y]) => {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    return null;
  });
})()""")
px_before = ev("""(() => {
  const probe = (x,y) => {
    const el = document.elementFromPoint(x,y);
    return el ? (el.id || el.tagName.toLowerCase()) : 'none';
  };
  return { p1: probe(20,40), p2: probe(195,60), p3: probe(8,300), p4: probe(300,700),
           htmlAttr: document.documentElement.getAttribute('data-mlc'),
           bgAttr: document.documentElement.getAttribute('data-mlc-bg'),
           bgImgVar: getComputedStyle(document.documentElement).getPropertyValue('--mlc-bg-img').slice(0,40),
           hasLayer: !!document.getElementById('mlc-bg') };
})()""")
print("=== before inject ===")
print(json.dumps(px_before, ensure_ascii=False, indent=1))

# ---- 注入 CSS + JS（按 boot.json 的顺序） ----
css = "\n".join((SRC / f).read_text(encoding="utf-8") for f in CSS_FILES)
ev("(() => { const s = document.createElement('style'); s.id = 'mlc-diag-style'; s.textContent = "
   + json.dumps(css) + "; document.head.appendChild(s); return 1; })()")
print("css injected:", ev("!!document.getElementById('mlc-diag-style')"))

for f in JS_FILES:
    code = (SRC / f).read_text(encoding="utf-8")
    r = ev(code, timeout=90)
    print("js %-20s -> %s" % (f, "ok" if r is None or r == 1 else str(r)[:120]))

print("globals:", ev("!!(window.MapleLanternCustom && window.MapleLanternDossierCore && window.MapleLanternDossierTheme && window.MapleLanternDossierAssets)"))

# ---- 走真实路径导入 ----
print("process probe png ...")
r = ev("""(async () => {
  try {
    const b64 = __PNG__;
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const file = new File([bytes], 'probe.png', { type: 'image/png' });
    const Assets = window.MapleLanternDossierAssets;
    const Theme = window.MapleLanternDossierTheme;
    const rec = await Assets.process(file);
    const okSave = await Assets.save('bg', rec.blob, { w: rec.w, h: rec.h, bytes: rec.bytes, type: rec.type, at: Date.now() });
    const url = await Assets.dataUrlFor('bg', rec.blob);
    Theme.attach('bg', { url: url, w: rec.w, h: rec.h });
    Theme.apply({ custom: { bgOn: true, bgOpacity: 100 } });
    return { w: rec.w, h: rec.h, bytes: rec.bytes, okSave: okSave, url: url.slice(0, 30) };
  } catch (e) { return { err: String(e && e.message || e).slice(0, 200) }; }
})()""".replace("__PNG__", json.dumps(PNG_B64)), timeout=120)
print(json.dumps(r, ensure_ascii=False, indent=1))

# 模拟「游戏内」：SugarCube 只在弹窗时把 #ui-overlay 开成 .open，进游戏后它是关的。
# 先把它关掉，才能测到 #mlc-bg 在真实内容之上到底可不可见。
ev("(() => { const o = document.getElementById('ui-overlay'); if (o) { o.style.display = 'none'; } return !!o; })()")
time.sleep(0.4)
shot("realinject-inplay.png")
print("inplay page hit:", ev("(() => { const e = document.elementFromPoint(20,40); return e ? (e.id || e.className || e.tagName) : 'none'; })()"))

time.sleep(1.2)
after = ev("""(() => {
  const layer = document.getElementById('mlc-bg');
  const cs = layer ? getComputedStyle(layer) : null;
  const r = layer ? layer.getBoundingClientRect() : null;
  return {
    htmlAttr: document.documentElement.getAttribute('data-mlc'),
    bgAttr: document.documentElement.getAttribute('data-mlc-bg'),
    bgImgVar: getComputedStyle(document.documentElement).getPropertyValue('--mlc-bg-img').slice(0, 46),
    bgOpVar: getComputedStyle(document.documentElement).getPropertyValue('--mlc-bg-op'),
    bgSizeVar: getComputedStyle(document.documentElement).getPropertyValue('--mlc-bg-size'),
    layer: layer ? {
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      pos: cs.position, z: cs.zIndex, op: cs.opacity,
      bgi: cs.backgroundImage.slice(0, 46), bgs: cs.backgroundSize,
      parent: layer.parentElement ? layer.parentElement.tagName.toLowerCase() : null
    } : null,
    hitAt: [document.elementFromPoint(20,40) && document.elementFromPoint(20,40).id,
            document.elementFromPoint(195,60) && document.elementFromPoint(195,60).id],
    bodyBgc: getComputedStyle(document.body).backgroundColor,
    bodyBgi: getComputedStyle(document.body).backgroundImage.slice(0, 40)
  };
})()""")
print("=== after inject + attach ===")
print(json.dumps(after, ensure_ascii=False, indent=1))

shot("realinject-after.png")

# ---- 采样点必须落在「背景层」，不能落在游戏 UI 上 ----
# 教训（LRN-20261117-009）：采样点先确认落在它以为的那一层，否则测的是别的元素。
print("=== 扫描空白点（elementFromPoint 命中 body/html 才算） ===")
blank = ev("""(() => {
  const pts = [];
  for (let y = 40; y < 820; y += 40) {
    for (let x = 20; x < 380; x += 30) {
      const e = document.elementFromPoint(x, y);
      const isBlank = !e || e === document.body || e === document.documentElement;
      if (isBlank) pts.push([x, y]);
    }
  }
  return pts.slice(0, 40);
})()""")
print("blank points:", len(blank or []), (blank or [])[:12])


def sample(path, pts):
    im = Image.open(ROOT / "shots" / path).convert("RGB")
    w, h = im.size
    out = {}
    for (x, y) in pts:
        out["%d,%d" % (x, y)] = im.getpixel((min(x * 2, w - 1), min(y * 2, h - 1)))
    return out


if blank:
    pts = blank
else:
    # 真机上没有任何一点是「空白 body」——UI 元素铺满整个视口。
    # 那就用固定网格做「有图 / 无图」对照，看图到底在哪片区域真的绘制出来了。
    pts = [(x, y) for y in range(30, 830, 80) for x in range(20, 380, 60)]
print("采样点:", len(pts))

b = sample("realinject-before.png", pts)
a = sample("realinject-after.png", pts)
# 无图对照：撤掉图再截一张，差值才是「图本身」的效果
ev("""(() => { const T = window.MapleLanternDossierTheme;
  T.attach('bg', null); T.apply({ custom: { bgOn: false, bgOpacity: 100 } }); return 1; })()""")
time.sleep(0.6)
shot("realinject-nobg.png")
nb = sample("realinject-nobg.png", pts)
print("=== 像素（无图 -> 有图） ===")
red = 0
for k in b:
    d = max(abs(a[k][i] - nb[k][i]) for i in range(3))
    if d >= 12:
        red += 1
        print("  %-10s 无图 %-16s -> 有图 %-16s  Δ=%d" % (k, nb[k], a[k], d))
print("有图后发生变化的点: %d / %d" % (red, len(b)))

# ---- 谁在盖住背景层：逐点 dump 命中元素的不透明度 ----
print("=== 逐点命中元素（谁挡在 #mlc-bg 前面） ===")
hits = ev("""(() => {
  const pts = __PTS__;
  const desc = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(), id: el.id || '',
      cls: (el.className || '').toString().slice(0, 40),
      pos: cs.position, z: cs.zIndex, op: cs.opacity,
      bgc: cs.backgroundColor, bgi: cs.backgroundImage === 'none' ? 'none' : 'url',
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]
    };
  };
  return pts.map(([x, y]) => [x, y, desc(document.elementFromPoint(x, y))]);
})()""".replace("__PTS__", json.dumps(pts)))
for row in (hits or []):
    x, y, d = row
    if not d:
        print("  (%d,%d) -> null" % (x, y))
    else:
        print("  (%3d,%3d) -> %-8s#%-18s z=%-8s op=%-4s bgc=%-24s bgi=%s rect=%s" % (
            x, y, d["tag"], d["id"] or d["cls"], d["z"], d["op"], d["bgc"], d["bgi"], d["rect"]))

# ---- 模拟「真正在游戏里」：弹窗也关掉，只留 #story ----
print("=== 关掉 #ui-overlay 与 #ui-dialog（模拟进游戏后的常态）===")
ev("""(() => {
  ['ui-overlay','ui-dialog'].forEach(id => {
    const e = document.getElementById(id);
    if (e) { e.style.display = 'none'; e.classList.remove('open'); }
  });
  return 1;
})()""")
time.sleep(0.5)
# 重新挂图（上一次被撤掉了）
ev("""(async () => {
  const Assets = window.MapleLanternDossierAssets;
  const Theme = window.MapleLanternDossierTheme;
  const rec = await Assets.load('bg');
  if (!rec) return 'no-rec';
  Theme.attach('bg', { url: await Assets.dataUrlFor('bg', rec.blob), w: rec.w, h: rec.h });
  Theme.apply({ custom: { bgOn: true, bgOpacity: 100 } });
  return 'ok';
})()""")
time.sleep(0.8)
shot("realinject-play-nodialog.png")

print("=== 此时谁在盖（抽样 12 点） ===")
hits2 = ev("""(() => {
  const pts = [[20,120],[195,200],[195,400],[195,620],[195,780],[370,400],[10,400],[195,60],[195,830],[40,300],[350,300],[195,900]];
  const desc = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), id: el.id || '',
      cls: (el.className || '').toString().slice(0, 30),
      pos: cs.position, z: cs.zIndex, op: cs.opacity,
      bgc: cs.backgroundColor, bgi: cs.backgroundImage === 'none' ? 'none' : 'url',
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
  };
  return pts.map(([x,y]) => [x,y,desc(document.elementFromPoint(x,y))]);
})()""")
for row in (hits2 or []):
    x, y, d = row
    print("  (%3d,%4d) -> %s" % (x, y, "null" if not d else "%-8s#%-16s z=%-6s bgc=%-22s rect=%s" % (
        d["tag"], d["id"] or d["cls"], d["z"], d["bgc"], d["rect"])))

# 像素：关掉弹窗后，图到底有没有铺出来
im = Image.open(ROOT / "shots" / "realinject-play-nodialog.png").convert("RGB")
w, h = im.size
pts3 = [(20, 120), (195, 200), (195, 400), (195, 620), (195, 780), (40, 300), (350, 300)]
print("=== 关弹窗后的实际像素（判据图左红右绿，出现红/绿即铺上了） ===")
for (x, y) in pts3:
    print("  (%3d,%4d) -> %s" % (x, y, im.getpixel((min(x * 2, w - 1), min(y * 2, h - 1)))))

# ---- 在真实页面上搭一个 .md-stage，验「舞台里能不能画出图」----
print("=== 真实页面上搭 .md-stage 验舞台 ===")
stage = ev("""(async () => {
  const T = window.MapleLanternDossierTheme;
  const A = window.MapleLanternDossierAssets;
  const rec = await A.load('bg');
  if (!rec) return { err: 'no rec' };
  const host = document.createElement('div');
  host.id = 'mlc-diag-stage-host';
  host.style.cssText = 'position:fixed;left:10px;top:10px;width:300px;height:400px;z-index:999999;background:#000;';
  const st = document.createElement('div');
  st.className = 'md-stage';
  st.setAttribute('data-mlc-bg', '1');
  st.style.cssText = 'position:relative;width:300px;height:400px;';
  const bg = document.createElement('div');
  bg.className = 'md-stage-bg';
  bg.style.cssText = 'position:absolute;inset:0;';
  const body = document.createElement('div');
  body.className = 'md-stage-body';
  body.textContent = 'stage body';
  body.style.cssText = 'position:relative;padding:8px;color:#fff;';
  st.appendChild(bg); st.appendChild(body);
  host.appendChild(st);
  document.body.appendChild(host);
  const cs = getComputedStyle(bg);
  return {
    bgi: cs.backgroundImage.slice(0, 46),
    bgs: cs.backgroundSize, pos: cs.backgroundPosition, op: cs.opacity,
    rect: [Math.round(bg.getBoundingClientRect().width), Math.round(bg.getBoundingClientRect().height)]
  };
})()""")
print(json.dumps(stage, ensure_ascii=False, indent=1))
time.sleep(0.8)
shot("realinject-stage.png")
im2 = Image.open(ROOT / "shots" / "realinject-stage.png").convert("RGB")
print("舞台内像素 (30,60) ->", im2.getpixel((60, 120)), " (200,60) ->", im2.getpixel((400, 120)),
      " (200,300) ->", im2.getpixel((400, 600)))



ws.close()
proc.terminate()

