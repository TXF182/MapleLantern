"""MapleLantern 1.4.3 多视口适配矩阵：手机竖屏 / 横屏 / 平板 / 笔记本 / 桌面。

用法：python tests/custom_viewports.py
依赖：Edge（headless）+ websocket-client + Pillow
判据：exit 0 且 [FAIL] 为 0。

测的是**真机几何**：页面用 style.css 自己的 .ml-panel（380 dock / data-sheet 全宽 / 横屏 560 居中），
不在测试页里自造 #ml-root 尺寸。每档断言：
  A 无横向溢出          B 面板四边都在屏内        C 「应用背景」≥44 高、不截断
  D 选项按钮盒整行、≥44  E 舞台在面板内、≥120 高  F 背景层覆盖整视口
  G 面板外真的透出背景  H 矮屏滚动到底能摸到「应用背景」
"""
import base64
import json
import os
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
PROFILE = ROOT / "_edge_profile_viewports"
SHOTS = ROOT / "shots"
PORT = 9239

VIEWPORTS = [
    ("320x568", 320, 568, True, "1"),    # 小屏手机：≤360 规则，左右 6px
    ("390x844", 390, 844, True, "1"),    # 主流手机：sheet 全宽
    ("844x390", 844, 390, True, "1"),    # 横屏手机：landscape+矮屏 → 居中 560
    ("768x1024", 768, 1024, True, "0"),  # 平板竖屏：dock 380
    ("1280x720", 1280, 720, False, "0"), # 笔记本
    ("1920x1080", 1920, 1080, False, "0"),  # 桌面
]

results = []
exceptions = []


def check(scope, name, ok, detail=""):
    results.append((scope, name, bool(ok), detail))
    print(("[PASS] " if ok else "[FAIL] ") + "[%s] " % scope + name + ((" | " + str(detail)) if detail else ""))


def start():
    if PROFILE.exists():
        shutil.rmtree(PROFILE, ignore_errors=True)
    SHOTS.mkdir(exist_ok=True)
    url = "file:///" + urllib.parse.quote(str(HTML).replace("\\", "/"))
    proc = subprocess.Popen(
        [EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
         "--allow-file-access-from-files",
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
        if msg.get("method") == "Runtime.exceptionThrown":
            exceptions.append(msg["params"]["exceptionDetails"].get("text", "?"))
        if msg.get("id") == mid:
            return msg


def evaluate(ws, expr):
    res = send(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    r = res.get("result", {})
    if "exceptionDetails" in r:
        exceptions.append(str(r["exceptionDetails"].get("text")))
        return None
    return r.get("result", {}).get("value")


def shot_pixels(ws, name, points):
    data = send(ws, "Page.captureScreenshot", {"format": "png"})["result"]["data"]
    p = SHOTS / name
    p.write_bytes(base64.b64decode(data))
    im = Image.open(p).convert("RGB")
    out = {}
    for k in points:
        x, y = [int(v) for v in k.split(",")]
        px = min(x * 2, im.size[0] - 1)
        py = min(y * 2, im.size[1] - 1)
        out[k] = im.getpixel((px, py))
    print("shot:", name, p.stat().st_size, im.size)
    return out


SNAP = r"""(() => {
  const iw = innerWidth, ih = innerHeight;
  const r = (el) => { const b = el.getBoundingClientRect();
    return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const panel = document.querySelector('#ml-root .ml-panel');
  const body = document.querySelector('#ml-root .ml-body');
  const apply = document.querySelector('.md-custom [data-mdd-custom-part="apply-bg"]');
  const stage = document.querySelector('.md-custom .md-stage');
  const opt = document.querySelector('#passages .passage a.link-internal:not(.macro-link)');
  const grp = document.querySelector('#passages .passage .ml-option-group');
  const pas = document.getElementById('passages');
  const bg = document.getElementById('mlc-bg');
  const pcs = getComputedStyle(pas);
  const pIn = parseFloat(pcs.paddingLeft) || 0;
  const pasW = pas.getBoundingClientRect().width - (pIn * 2);
  // 基准要用「选项所在 passage 的内容宽」：native.css 给 .passage 加了 18px 16px 28px
  const passage = opt ? opt.closest('.passage') : null;
  const passW = passage
    ? passage.getBoundingClientRect().width
      - (parseFloat(getComputedStyle(passage).paddingLeft) || 0)
      - (parseFloat(getComputedStyle(passage).paddingRight) || 0)
    : 0;
  const custom = document.querySelector('.md-custom');
  const stcs = stage ? getComputedStyle(stage) : null;
  return {
    iw: iw, ih: ih,
    scrollW: document.documentElement.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    panel: panel ? r(panel) : null,
    bodyScroll: body ? { sh: body.scrollHeight, ch: body.clientHeight,
                          ov: getComputedStyle(body).overflowY } : null,
    apply: apply ? Object.assign(r(apply), { sw: apply.scrollWidth, cw: apply.clientWidth }) : null,
    stage: stage ? r(stage) : null,
    opt: opt ? Object.assign(r(opt), { padL: parseFloat(getComputedStyle(opt).paddingLeft) || 0 }) : null,
    grp: grp ? r(grp) : null,
    grpA: (function () {
      const a = document.querySelector('#passages .passage .ml-option-group > a.link-internal');
      return a ? r(a) : null;
    })(),
    passW: passW,
    customW: custom ? custom.getBoundingClientRect().width : 0,
    stageCss: stcs ? { w: stcs.width, maxW: stcs.maxWidth, disp: stcs.display, flex: stcs.flex,
                       ar: stcs.aspectRatio, par: stage.parentElement.className,
                       bw: stcs.borderLeftWidth, pos: stcs.position,
                       tr: stcs.transform, offW: stage.offsetWidth, rectW: Math.round(stage.getBoundingClientRect().width),
                       probe: (function () {
                         if (!stage) return null;
                         const before = stage.getBoundingClientRect().width;
                         stage.style.width = '100%';
                         const after = stage.getBoundingClientRect().width;
                         stage.style.width = '';
                         const cw = stage.parentElement.clientWidth;
                         return { before: Math.round(before), after: Math.round(after), parentClient: cw };
                       })() } : null,
    mlcAttr: document.documentElement.getAttribute('data-mlc'),
    grpCss: (function () {
      const g = document.querySelector('#passages .passage .ml-option-group');
      if (!g) return null;
      const cs = getComputedStyle(g);
      return { disp: cs.display, w: cs.width, minW: cs.minWidth, float: cs.float,
               offW: g.offsetWidth, rectW: Math.round(g.getBoundingClientRect().width),
               tr: cs.transform, pad: cs.padding, bw: cs.boxSizing, par: g.parentElement.className };
    })(),
    bg: bg ? r(bg) : null,
    bgAttr: document.documentElement.getAttribute('data-mlc-bg'),
    optAttr: document.documentElement.getAttribute('data-mlc-btn'),
  };
})()"""

RED = """(() => {
  const c = document.createElement('canvas'); c.width = 320; c.height = 640;
  const g = c.getContext('2d'); g.fillStyle = '#1e5fff'; g.fillRect(0, 0, 320, 640);
  window.__vpRed = c.toDataURL('image/png');
  const c2 = document.createElement('canvas'); c2.width = 200; c2.height = 64;
  const g2 = c2.getContext('2d'); g2.fillStyle = '#c0392b'; g2.fillRect(0, 0, 200, 64);
  window.__vpBtn = c2.toDataURL('image/png');
  return true;
})()"""


def main():
    vps = VIEWPORTS[:1] if os.environ.get("VP_ONLY_FIRST") else VIEWPORTS
    proc, ws, url = start()
    try:
        send(ws, "Page.enable")
        send(ws, "Runtime.enable")
        try:
            send(ws, "Page.setInterceptFileChooserDialog", {"enabled": True})
        except Exception:
            pass
        send(ws, "Page.navigate", {"url": url})
        time.sleep(2.2)
        evaluate(ws, RED)

        # 只做一次：走面板真实入口导入两张图（背景=蓝、按钮=红），之后每档只切视口
        prep = evaluate(ws, r"""(async () => {
          const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
          const toFile = (data, name) => {
            const bin = atob(data.split(',')[1]);
            const arr = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
            return new File([arr], name, { type: 'image/png' });
          };
          // 点「导入背景图 / 导入按钮底纹」→ 面板会在 body 挂隐藏 input → 塞 File → change
          async function importVia(kind, file) {
            const row = document.querySelector('.md-custom [data-mdd-custom-part="' + kind + '-pick"]');
            const pick = row && row.querySelector('.md-pick');
            if (!pick) throw new Error('no pick button for ' + kind);
            pick.click();
            await sleep(60);
            const input = document.querySelector('input[type="file"]');
            if (!input) throw new Error('no file input after click: ' + kind);
            const dt = new DataTransfer();
            dt.items.add(file);
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            const varName = kind === 'bg' ? '--mlc-bg-img' : '--mlc-btn-img';
            for (let i = 0; i < 40; i++) {
              await sleep(150);
              if (document.documentElement.style.getPropertyValue(varName)) return true;
            }
            return false;
          }
          const bgOk = await importVia('bg', toFile(window.__vpRed, 'vp-bg.png'));
          const btnOk = await importVia('btn', toFile(window.__vpBtn, 'vp-btn.png'));
          window.MapleLanternCustom.setSettings({ bgOn: true, btnOn: true, bgOpacity: 85,
                                                  btnOpacity: 90, bgFit: 'cover', btnFit: 'cover' });
          await sleep(200);
          return { importBg: bgOk, importBtn: btnOk,
                   bg: document.documentElement.getAttribute('data-mlc-bg'),
                   btn: document.documentElement.getAttribute('data-mlc-btn'),
                   bgImg: !!document.documentElement.style.getPropertyValue('--mlc-bg-img'),
                   btnImg: !!document.documentElement.style.getPropertyValue('--mlc-btn-img') };
        })()""")
        print("prep:", prep)
        check("准备", "两张图导入并开启开关",
              bool(prep) and prep.get("importBg") and prep.get("importBtn")
              and prep.get("bg") == "on" and prep.get("btn") == "on", prep)
        print("prep:", evaluate(ws, """(() => ({ bg: document.documentElement.getAttribute('data-mlc-bg'),
                                              btn: document.documentElement.getAttribute('data-mlc-btn'),
                                              img: !!document.documentElement.style.getPropertyValue('--mlc-bg-img') }))()"""))

        for name, w, h, mobile, sheet in vps:
            send(ws, "Emulation.setDeviceMetricsOverride",
                 {"width": w, "height": h, "deviceScaleFactor": 2, "mobile": mobile})
            time.sleep(0.6)
            evaluate(ws, "(() => { const r = document.getElementById('ml-root');"
                          " r.setAttribute('data-sheet', '%s'); r.setAttribute('data-sheet', '%s');"
                          " return r.getAttribute('data-sheet'); })()" % (sheet, sheet))
            time.sleep(0.4)
            evaluate(ws, """(() => { const b = document.querySelector('#ml-root .ml-body');
                                    if (b) b.scrollTop = 0; document.documentElement.scrollTop = 0; })()""")
            s = evaluate(ws, SNAP)
            if not s:
                check(name, "快照可取", False, "evaluate 返回 None")
                continue

            # A 无横向溢出
            check(name, "A 无横向溢出",
                  s["scrollW"] <= s["iw"] + 1 and s["bodyScrollW"] <= s["iw"] + 1,
                  "scrollW=%s?%s body=%s" % (s["scrollW"], s["iw"], s["bodyScrollW"]))

            # B 面板四边在屏内
            p = s["panel"] or {}
            inside = (p.get("l", -99) >= -0.5 and p.get("r", 9999) <= s["iw"] + 0.5
                      and p.get("t", -99) >= -0.5 and p.get("b", 9999) <= s["ih"] + 0.5)
            check(name, "B 面板四边都在屏内", inside,
                  "l=%.0f r=%.0f t=%.0f b=%.0f / 屏 %dx%d" % (p.get("l", -1), p.get("r", -1),
                                                              p.get("t", -1), p.get("b", -1),
                                                              s["iw"], s["ih"]))

            # C「应用背景」尺寸与截断
            a = s["apply"]
            check(name, "C「应用背景」按钮 ≥44 高且文字不截断",
                  bool(a) and a["h"] >= 44 and a["w"] >= 180 and a["sw"] <= a["cw"] + 1,
                  "%s" % ({k: round(v) if isinstance(v, (int, float)) else v
                           for k, v in a.items()} if a else "缺失"))

            # D 选项按钮盒整行（分组是灯台自己的卡片，底纹也铺在卡片本体上）
            o = s["opt"]
            g = s["grp"] or {}
            ga = s["grpA"] or {}
            full = (bool(o) and o["h"] >= 44 and abs(o["w"] - s["passW"]) <= 2
                    and abs(g.get("w", -1) - s["passW"]) <= 2
                    and ga.get("w", 0) >= s["passW"] * 0.7)
            check(name, "D 选项按钮盒整行（贴满 passage 内容宽）且 ≥44 高",
                  full, "opt=%.0fx%.0f 分组卡片=%.0f 组内a=%.0f passage内容宽=%.0f %s" %
                  (o["w"] if o else -1, o["h"] if o else -1, g.get("w", -1), ga.get("w", -1),
                   s["passW"], s["grpCss"]))

            # E 舞台在面板内，且宽高比必须与当前屏幕一致（比例错了，玩家拖出来的位置到真机就偏）
            st = s["stage"] or {}
            arOk = (st.get("h", 0) > 0
                    and abs(st.get("w", 0) / st["h"] - float(s["iw"]) / s["ih"]) <= 0.03)
            inPanel = (bool(st) and st.get("w", 0) >= 140 and st.get("h", 0) >= 140
                       and arOk
                       and st.get("l", -99) >= p.get("l", -999) - 0.5
                       and st.get("r", 9999) <= p.get("r", 99999) + 0.5)
            check(name, "E 预览舞台在面板内、尺寸够用且宽高比等于屏幕", inPanel,
                  "stage=%.0fx%.0f (比 %.3f / 屏 %.3f) 卡片宽=%.0f" %
                  (st.get("w", -1), st.get("h", -1),
                   (st.get("w", 0) / st["h"]) if st.get("h") else 0,
                   float(s["iw"]) / s["ih"], s["customW"]))

            # F 背景层覆盖整视口
            bg = s["bg"] or {}
            covers = (bool(bg) and abs(bg["w"] - s["iw"]) <= 1 and abs(bg["h"] - s["ih"]) <= 1
                      and abs(bg["l"]) <= 1 and abs(bg["t"]) <= 1)
            check(name, "F 背景层覆盖整视口", covers,
                  "%.0fx%.0f @(%d,%d)" % (bg.get("w", -1), bg.get("h", -1), bg.get("l", -99), bg.get("t", -99)))

            # G 面板外透出背景（角落取色）
            pts = ["6,6", "%d,%d" % (s["iw"] - 6, s["ih"] - 6)]
            px = shot_pixels(ws, "vp-%s.png" % name, pts)
            visible = any(v[2] - v[0] >= 25 for v in px.values())
            check(name, "G 面板外真的透出背景（角落蓝分量）", visible, str(px))

            # H 可达性：把「应用背景」滚进视口中心，检查完整可见（矮屏也能摸到）
            reach = evaluate(ws, """(() => {
              const b = document.querySelector('#ml-root .ml-body');
              const a = document.querySelector('.md-custom [data-mdd-custom-part="apply-bg"]');
              if (!b || !a) return null;
              a.scrollIntoView({ block: 'center', inline: 'nearest' });
              const r = a.getBoundingClientRect();
              const br = b.getBoundingClientRect();
              return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
                       ih: innerHeight, bodyTop: Math.round(br.top), bodyBottom: Math.round(br.bottom),
                       sh: b.scrollHeight, ch: b.clientHeight, ov: getComputedStyle(b).overflowY };
            })()""")
            okReach = (bool(reach) and reach["h"] >= 44
                       and reach["top"] >= reach["bodyTop"] - 1
                       and reach["bottom"] <= min(reach["bodyBottom"], reach["ih"]) + 1)
            check(name, "H 「应用背景」滚进视野后完整可见可点", okReach, str(reach))

    finally:
        try:
            ws.close()
        except Exception:
            pass
        proc.terminate()

    print("\n--- 摘要 ---")
    fails = [x for x in results if not x[2]]
    print("合计: %d PASS / %d FAIL" % (len(results) - len(fails), len(fails)))
    if exceptions:
        print("运行时异常 %d 条: %s" % (len(exceptions), exceptions[:3]))
    for sc, nm, ok, dt in fails:
        print("  FAIL [%s] %s | %s" % (sc, nm, dt))
    raise SystemExit(0 if not fails and not exceptions else 1)


if __name__ == "__main__":
    main()
