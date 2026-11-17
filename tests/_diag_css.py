"""临时诊断：为什么 custom.css 里的 .md-stage width:100% 没生效。

用法：python tests/_diag_css.py
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
HTML = ROOT / "viewport-host.html"
PROFILE = ROOT / "_edge_profile_diagcss"
PORT = 9241

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
            targets = json.loads(r.read().decode("utf-8"))
        pages = [t for t in targets if t.get("type") == "page"]
        if pages:
            target = pages[0]
            break
    except Exception:
        time.sleep(0.4)

ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=20)
seq = [0]


def ev(expr):
    seq[0] += 1
    mid = seq[0]
    ws.send(json.dumps({"id": mid, "method": "Runtime.evaluate",
                        "params": {"expression": expr, "returnByValue": True, "awaitPromise": True}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == mid:
            return m.get("result", {}).get("result", {}).get("value")


ws.send(json.dumps({"id": 999, "method": "Page.navigate", "params": {"url": url}}))
time.sleep(2.5)

res = ev(r"""(() => {
  const hits = [];
  const walk = (rs, media) => {
    for (const r of rs) {
      if (r.cssRules) { walk(r.cssRules, media + '|' + (r.conditionText || (r.media && r.media.mediaText) || '')); continue; }
      if (r.selectorText && r.selectorText.indexOf('md-stage') >= 0 && r.style && r.style.width) {
        hits.push({ sel: r.selectorText, w: r.style.width, imp: r.style.getPropertyPriority('width'), media: media });
      }
    }
  };
  for (const sh of document.styleSheets) {
    let rs = [];
    try { rs = sh.cssRules; } catch (e) { continue; }
    walk(rs, sh.href ? sh.href.split('/').pop() : '(inline)');
  }
  const st = document.querySelector('.md-custom .md-stage');
  const cs = st ? getComputedStyle(st) : null;
  return { sheets: Array.from(document.styleSheets).map(s => (s.href || '(inline)').split('/').pop()),
           hits: hits,
           stage: st ? { w: cs.width, minW: cs.minWidth, maxW: cs.maxWidth, flexBasis: cs.flexBasis,
                         alignSelf: cs.alignSelf, parentDisp: getComputedStyle(st.parentElement).display,
                         parentAlign: getComputedStyle(st.parentElement).alignItems } : null };
})()""")
print(json.dumps(res, ensure_ascii=False, indent=1))

# 找 custom.css 里 .md-stage 规则的原文
res2 = ev(r"""(() => {
  for (const sh of document.styleSheets) {
    if (!sh.href || sh.href.indexOf('custom.css') < 0) continue;
    let rs = [];
    try { rs = sh.cssRules; } catch (e) { return 'cant-read'; }
    const out = [];
    for (const r of rs) {
      if (r.selectorText && r.selectorText.indexOf('.md-stage') >= 0 && r.selectorText.indexOf('md-stage-') < 0) {
        out.push(r.cssText.slice(0, 400));
      }
    }
    return out;
  }
  return 'no custom.css';
})()""")
print("=== custom.css .md-stage 规则原文 ===")
for x in (res2 if isinstance(res2, list) else [res2]):
    print(x)

ws.close()
proc.terminate()
