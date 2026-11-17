"""诊断：真实 DoL 页面里，场景背景到底挂在哪一层、层级多高。

python tests/_diag_realdom.py
"""
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
GAME = ROOT.parent.parent / "game" / "Degrees of Lewdity.html"
PROFILE = ROOT / "_edge_profile_realdom"
PORT = 9243

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

ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=60)
n = [0]


def cmd(method, params=None, timeout=60):
    n[0] += 1
    mid = n[0]
    ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
    end = time.time() + timeout
    while time.time() < end:
        m = json.loads(ws.recv())
        if m.get("id") == mid:
            return m.get("result", {})
    raise TimeoutError(method)


def ev(expr):
    r = cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    res = r.get("result", {})
    return res.get("value")


cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})
cmd("Page.enable")
print("loading 64MB game page ...")
cmd("Page.navigate", {"url": url}, timeout=90)

for i in range(60):
    time.sleep(1)
    ready = ev("document.readyState")
    has = ev("!!document.querySelector('#passages')")
    if ready == "complete" and has:
        print("loaded after %ds" % (i + 1))
        break

time.sleep(2)
print("title:", ev("document.title"))
print("buttons:", ev("Array.from(document.querySelectorAll('a,button')).slice(0,8).map(x=>x.textContent.trim()).filter(Boolean).join(' | ')"))

# 试着进游戏
started = ev(r"""(() => {
  const cands = ['#menu-item-start','a#start','[data-passage="Start"]'];
  for (const s of cands) { const e = document.querySelector(s); if (e) { e.click(); return s; } }
  const b = Array.from(document.querySelectorAll('a,button')).find(x => /start|开始|新游戏/i.test(x.textContent));
  if (b) { b.click(); return 'text:' + b.textContent.trim(); }
  return 'none';
})()""")
print("start:", started)
time.sleep(3)

dom = ev(r"""(() => {
  const desc = (el) => {
    if (!el || el.nodeType !== 1) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || '',
      cls: (el.className || '').toString().slice(0, 60),
      pos: cs.position,
      z: cs.zIndex,
      disp: cs.display,
      bgc: cs.backgroundColor,
      bgi: cs.backgroundImage === 'none' ? 'none' : cs.backgroundImage.slice(0, 70),
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      opacity: cs.opacity
    };
  };
  const bodyKids = Array.from(document.body.children).map(desc);
  const story = document.querySelector('#story');
  const passages = document.querySelector('#passages');
  return {
    html: { bgi: getComputedStyle(document.documentElement).backgroundImage.slice(0, 90),
            bgc: getComputedStyle(document.documentElement).backgroundColor },
    body: { bgi: getComputedStyle(document.body).backgroundImage.slice(0, 90),
            bgc: getComputedStyle(document.body).backgroundColor },
    bodyKids: bodyKids,
    story: desc(story),
    passages: desc(passages),
    passageKids: passages ? Array.from(passages.children).map(desc) : [],
    firstPassageHtml: passages && passages.firstElementChild
      ? passages.firstElementChild.outerHTML.slice(0, 600) : null,
    imgs: Array.from(document.querySelectorAll('img')).slice(0, 6).map(desc)
  };
})()""")
print(json.dumps(dom, ensure_ascii=False, indent=1))

ws.close()
proc.terminate()
