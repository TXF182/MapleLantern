"""灯台 1.4.11 属性页几何探针：真机 Edge 量卡片、平铺属性列表与中央立绘。

用法：python tests/sexdiagram_probe.py
判据：exit 0；5 个平铺属性列表保持原生 flex/wrap、卡片不越界/不互压；固定皮肤与关闭皮肤两种状态都无卡片-立绘重叠，左右列各占 50%，窄屏 390 宽回到 100% 单列。
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
HTML = ROOT / "sexdiagram-host.html"
PROFILE = ROOT / "_edge_profile_sexdiagram"
SHOTS = ROOT / "shots"
PORT = 9241

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
  const root = document.documentElement;
  const sex = document.querySelector('#sex-diagram');
  const left = document.querySelector('#sex-diagram .left-column');
  const right = document.querySelector('#sex-diagram .right-column');
  const body = document.querySelector('#player-body');
  const cards = [...document.querySelectorAll('#sex-diagram .characteristic-box')];
  const box = el => { const r = el.getBoundingClientRect(); return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}; };
  const bodyR = box(body);
  const overlaps = cards.map((c, i) => {
    const r = box(c);
    const x = Math.max(0, Math.min(r.r, bodyR.r) - Math.max(r.l, bodyR.l));
    const y = Math.max(0, Math.min(r.b, bodyR.b) - Math.max(r.t, bodyR.t));
    return { i, area: Math.round(x * y), w: Math.round(r.w), h: Math.round(r.h), l: Math.round(r.l), t: Math.round(r.t) };
  });
  const list = box(left);
  const flat = [...document.querySelectorAll('[data-probe-list]')].map(listEl => {
    const lr = box(listEl);
    const cardsIn = [...listEl.querySelectorAll('.characteristic-box')];
    const style = getComputedStyle(listEl);
    const out = cardsIn.filter(c => { const r = box(c); return r.r > lr.r + 1 || r.l < lr.l - 1; }).length;
    let overlaps = 0;
    for (let i = 0; i < cardsIn.length; i++) for (let j = i + 1; j < cardsIn.length; j++) {
      const a = box(cardsIn[i]), b = box(cardsIn[j]);
      const x = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l));
      const y = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
      if (x * y > 1) overlaps++;
    }
    return { id: listEl.id, display: style.display, wrap: style.flexWrap, w: Math.round(lr.w),
      cards: cardsIn.length, cardW: cardsIn.length ? Math.round(box(cardsIn[0]).w) : 0, out, overlaps };
  });
  return {
    overlay: root.getAttribute('data-ml-opt-overlay'),
    sexW: Math.round(box(sex).w),
    leftW: Math.round(list.w),
    rightW: Math.round(box(right).w),
    leftDisplay: getComputedStyle(left).display,
    leftFlow: getComputedStyle(left).flexFlow,
    cardBg: getComputedStyle(cards[0]).backgroundColor,
    cardBorder: getComputedStyle(cards[0]).borderTopColor,
    body: { w: Math.round(bodyR.w), h: Math.round(bodyR.h), l: Math.round(bodyR.l), r: Math.round(bodyR.r) },
    overlaps,
    hit: overlaps.filter(o => o.area > 0).length,
    totalArea: overlaps.reduce((s, o) => s + o.area, 0),
    flat
  };
})()'''


def check_flat(label, data, phase):
    for item in data.get("flat", []):
        tag = "%s %s [%s]" % (label, phase, item["id"])
        check(tag + " 保持原生 flex 换行，不被 grid 覆盖",
              item["display"] == "flex" and item["wrap"] == "wrap",
              "%s / %s cards=%d" % (item["display"], item["wrap"], item["cards"]))
        check(tag + " 卡片不得越出列表边界", item["out"] == 0,
              "out=%d w=%d cardW=%d" % (item["out"], item["w"], item["cardW"]))
        check(tag + " 卡片之间不得互相压叠", item["overlaps"] == 0, "overlaps=%d" % item["overlaps"])


def run(width, height, label):
    proc, ws, url = start(width, height)
    try:
        send(ws, "Page.enable")
        send(ws, "Runtime.enable")
        send(ws, "Emulation.setDeviceMetricsOverride",
             {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False})
        send(ws, "Page.navigate", {"url": url})
        time.sleep(2.0)
        fixed = evaluate(ws, MEASURE)
        print(label, "fixed:", json.dumps(fixed, ensure_ascii=False))
        if width <= 450:
            check(label + " 窄屏固定皮肤：列宽回 100% 单列", abs(fixed["leftW"] - fixed["sexW"]) <= 6,
                  "sex=%d left=%d" % (fixed["sexW"], fixed["leftW"]))
        else:
            check(label + " 固定皮肤：左右列各占 50%", abs(fixed["leftW"] - fixed["sexW"] * 0.5) <= 2 and abs(fixed["rightW"] - fixed["sexW"] * 0.5) <= 2,
                  "sex=%d left=%d right=%d" % (fixed["sexW"], fixed["leftW"], fixed["rightW"]))
        check(label + " 固定皮肤：卡片不得压住中央立绘", fixed["hit"] == 0, "hit=%d area=%d" % (fixed["hit"], fixed["totalArea"]))
        check(label + " 固定皮肤：列必须是 flex 纵排", fixed["leftDisplay"] == "flex" and "column" in fixed["leftFlow"],
              "%s / %s" % (fixed["leftDisplay"], fixed["leftFlow"]))
        check_flat(label, fixed, "固定皮肤")
        shot(ws, "sexdiagram_%s_fixed.png" % label)

        if width >= 900:
            evaluate(ws, r'''(() => {
              const st = document.createElement('style'); st.id = 'probe-old-grid';
              st.textContent = '#sex-diagram .characteristic-box-list{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))!important;gap:7px!important;margin:6px 0!important;}';
              document.head.appendChild(st);
            })()''')
            time.sleep(0.4)
            old = evaluate(ws, MEASURE)
            check("旧 grid 可复现：卡片压住中央立绘", old["hit"] > 0, "hit=%d area=%d" % (old["hit"], old["totalArea"]))
            shot(ws, "sexdiagram_%s_oldgrid.png" % label)
            evaluate(ws, "document.getElementById('probe-old-grid').remove()")
            time.sleep(0.4)

        evaluate(ws, "document.documentElement.removeAttribute('data-ml-opt-overlay')")
        time.sleep(0.5)
        native = evaluate(ws, MEASURE)
        print(label, "native:", json.dumps(native, ensure_ascii=False))
        check(label + " 关闭开关：回原版卡片外观", native["cardBg"] != fixed["cardBg"] or native["cardBorder"] != fixed["cardBorder"],
              "fixed=%s/%s native=%s/%s" % (fixed["cardBg"], fixed["cardBorder"], native["cardBg"], native["cardBorder"]))
        check(label + " 关闭开关：仍是原版左右列", native["leftDisplay"] == "flex" and "column" in native["leftFlow"],
              "%s / %s" % (native["leftDisplay"], native["leftFlow"]))
        check(label + " 关闭开关：卡片不压立绘", native["hit"] == 0, "hit=%d" % native["hit"])
        check_flat(label, native, "关闭开关")
        shot(ws, "sexdiagram_%s_native.png" % label)
    finally:
        try:
            ws.close()
        finally:
            proc.kill()


run(1280, 900, "desktop")
run(390, 844, "phone")

fails = [r for r in results if not r[1]]
print("\n[SUMMARY] %d PASS / %d FAIL" % (len(results) - len(fails), len(fails)))
for name, _, detail in fails:
    print("[FAILED]", name, detail)
raise SystemExit(0 if not fails else 1)
