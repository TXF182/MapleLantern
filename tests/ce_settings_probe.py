"""灯台 1.4.12 CE 设置页几何探针：复刻 CheatExtended 1.20.4 的 settingsGrid。

用法：python tests/ce_settings_probe.py
判据：exit 0；桌面 CE 设置页两列、同行等高、卡片不越界/不互压/不被裁切；
同一 overlay 内的原生 Options 仍是两列（CE 规则不得外溢）；手机 390 宽单列。
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
HTML = ROOT / "ce-settings-host.html"
PROFILE = ROOT / "_edge_profile_ce_settings"
SHOTS = ROOT / "shots"
PORT = 9242

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), str(detail)))
    print(("[PASS] " if ok else "[FAIL] ") + name + ((" | " + str(detail)) if detail else ""))


def start(width, height):
    if PROFILE.exists():
        shutil.rmtree(PROFILE, ignore_errors=True)
    SHOTS.mkdir(exist_ok=True)
    url = "file:///" + urllib.parse.quote(str(HTML).replace("\\", "/"))
    proc = subprocess.Popen(
        [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
         "--allow-file-access-from-files", "--window-size=%d,%d" % (width, height),
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
        proc.kill()
        raise SystemExit("无法启动 Edge / 无调试目标")
    ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=15)
    return proc, ws, url


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
        raise SystemExit("JS 异常: " + str(r["exceptionDetails"]))
    return r.get("result", {}).get("value")


def shot(ws, name):
    data = send(ws, "Page.captureScreenshot", {"format": "png"})["result"]["data"]
    p = SHOTS / name
    p.write_bytes(base64.b64decode(data))
    im = Image.open(p)
    print("shot:", p, p.stat().st_size, im.size)
    return p


MEASURE = r'''(() => {
  const box = el => { const r = el.getBoundingClientRect(); return {
    l:r.left, t:r.top, r:r.right, b:r.bottom, w:r.width, h:r.height
  }; };
  const cols = el => getComputedStyle(el).gridTemplateColumns.split(/\s+/).filter(v => /px|fr|%/.test(v)).length;
  const grid = document.querySelector('[data-probe-ce-grid]');
  const outer = document.querySelector('[data-probe-outer]');
  const nativeGrid = document.querySelector('[data-probe-native-grid]');
  const items = [...grid.children];
  const g = box(grid);
  const gs = getComputedStyle(grid);
  const boxes = items.map(box);
  const out = boxes.filter(b => b.l < g.l - 1 || b.r > g.r + 1).length;
  let overlaps = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const x = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
    const y = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    if (x * y > 1) overlaps++;
  }
  const rows = new Map();
  boxes.forEach(b => {
    const key = Math.round(b.t);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(Math.round(b.h));
  });
  const rowHeights = [...rows.values()].map(hs => ({ n: hs.length, min: Math.min(...hs), max: Math.max(...hs) }));
  const scrollMax = Math.max(0, ...items.map(el => el.scrollWidth - el.clientWidth));
  const itemStyle = getComputedStyle(items[0]);
  const save = outer.lastElementChild ? box(outer.lastElementChild) : null;
  const outerBox = box(outer);
  return {
    ceCols: cols(grid),
    nativeCols: cols(nativeGrid),
    ceW: Math.round(g.w),
    itemW: Math.round(boxes[0].w),
    items: boxes.length,
    out, overlaps, rowHeights, scrollMax,
    alignItems: gs.alignItems,
    gridGap: gs.gap,
    itemOverflow: itemStyle.overflow,
    outerW: Math.round(outerBox.w),
    saveW: save ? Math.round(save.w) : 0,
    nativeW: Math.round(box(nativeGrid).w)
  };
})()'''


def run(width, height, label):
    proc, ws, url = start(width, height)
    try:
        send(ws, "Page.enable")
        send(ws, "Runtime.enable")
        send(ws, "Emulation.setDeviceMetricsOverride",
             {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False})
        send(ws, "Page.navigate", {"url": url})
        time.sleep(2.0)
        data = evaluate(ws, MEASURE)
        print(label, ":", json.dumps(data, ensure_ascii=False))

        if width >= 900:
            check(label + " CE 设置页为桌面双列", data["ceCols"] == 2, "ceCols=%d ceW=%d itemW=%d" % (data["ceCols"], data["ceW"], data["itemW"]))
            check(label + " 原生 Options 仍保持双列，CE 规则未外溢", data["nativeCols"] == 2, "nativeCols=%d nativeW=%d" % (data["nativeCols"], data["nativeW"]))
            check(label + " 同一行选项卡等高", all(r["max"] - r["min"] <= 1 for r in data["rowHeights"]), json.dumps(data["rowHeights"]))
            check(label + " 保存按钮独占整行", data["outerW"] - data["saveW"] <= 22, "outer=%d save=%d" % (data["outerW"], data["saveW"]))
        else:
            check(label + " 手机宽单列", data["ceCols"] == 1, "ceCols=%d w=%d" % (data["ceCols"], data["ceW"]))

        check(label + " 卡片不得越出格子", data["out"] == 0, "out=%d" % data["out"])
        check(label + " 卡片之间不得互压", data["overlaps"] == 0, "overlaps=%d" % data["overlaps"])
        check(label + " 卡片内容不得横向溢出", data["scrollMax"] <= 1, "scrollMax=%d" % data["scrollMax"])
        check(label + " 选项卡不得裁切 tooltip/焦点框", data["itemOverflow"] == "visible", data["itemOverflow"])
        check(label + " 同行卡片必须等高拉伸", data["alignItems"] == "stretch", data["alignItems"])
        shot(ws, "ce_settings_%s.png" % label)
    finally:
        try:
            ws.close()
        finally:
            proc.kill()


run(1280, 900, "desktop")
run(900, 800, "narrow-desktop")
run(390, 844, "phone")

fails = [r for r in results if not r[1]]
print("\n[SUMMARY] %d PASS / %d FAIL" % (len(results) - len(fails), len(fails)))
for name, _, detail in fails:
    print("[FAILED]", name, detail)
raise SystemExit(0 if not fails else 1)
