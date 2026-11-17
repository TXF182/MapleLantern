"""MapleLantern 1.4.3 自定义外观宿主断言：真实 style.css / maplelantern-native.css / custom.css。

用法：python tests/custom_host.py
依赖：Edge（headless）+ websocket-client
判据：exit 0 且 [FAIL] 为 0；截图落 tests/shots/custom-*.png。
覆盖：启动装配、变量落地、设置页注入（舞台/读数/复位）、选项底纹、配色同步、分项复位、持久化、视口重排。
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
PROFILE = ROOT / "_edge_profile_customhost"
SHOTS = ROOT / "shots"
PORT = 9234

results = []
exceptions = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("[PASS] " if ok else "[FAIL] ") + name + ((" | " + str(detail)) if detail else ""))


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


def shot(ws, name):
    data = send(ws, "Page.captureScreenshot", {"format": "png"})["result"]["data"]
    p = SHOTS / name
    p.write_bytes(base64.b64decode(data))
    print("shot:", name, p.stat().st_size)


def viewport(ws, w, h, mobile):
    send(ws, "Emulation.setDeviceMetricsOverride",
         {"width": w, "height": h, "deviceScaleFactor": 2, "mobile": mobile})
    time.sleep(0.5)


def pixels(ws, points, name):
    """截图并按 CSS px 取点（截图是 dpr 2，内部乘 2）。返回 {x,y: (r,g,b)} 与图尺寸。"""
    data = send(ws, "Page.captureScreenshot", {"format": "png"})["result"]["data"]
    p = SHOTS / name
    p.write_bytes(base64.b64decode(data))
    im = Image.open(p).convert("RGB")
    out = {}
    for x, y in points:
        out["%d,%d" % (x, y)] = im.getpixel((int(x * 2), int(y * 2)))
    print("shot:", name, p.stat().st_size, im.size)
    return out, im.size


SNAP = r"""
(() => {
  const q = (s, r) => (r || document).querySelector(s);
  const all = (s, r) => Array.from((r || document).querySelectorAll(s));
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const box = el => { if (!el) return null; const r = el.getBoundingClientRect();
    return {w: +r.width.toFixed(1), h: +r.height.toFixed(1)}; };
  const stage = q('#mdStage');
  const opt = q('#passages .passage a.link-internal:not(.macro-link)');
  return {
    attr: document.documentElement.getAttribute('data-mlc'),
    bgAttr: document.documentElement.getAttribute('data-mlc-btn'),
    hasCore: !!window.MapleLanternDossierCore,
    hasCustom: !!(window.MapleLanternCustom && window.MapleLanternCustom.__ready),
    hasPanel: !!(window.MapleLanternDossierPanel && window.MapleLanternDossierPanel.__ready),
    version: window.MapleLanternCustom && window.MapleLanternCustom.version,
    bgOp: cssVar('--mlc-bg-op'),
    bgSoft: cssVar('--mlc-bg-soft'),
    fontScale: cssVar('--mlc-font-scale'),
    surfaceAlpha: cssVar('--mlc-surface-alpha'),
    mlnAccent: document.documentElement.style.getPropertyValue('--mln-accent'),
    layer: (() => { const l = q('#mlc-bg'); return l ? {pos: getComputedStyle(l).position,
      op: getComputedStyle(l).opacity, img: getComputedStyle(l).backgroundImage} : null; })(),
    group: !!q('.md-custom'),
    stage: box(stage),
    stageRaw: stage ? {w: +stage.getBoundingClientRect().width.toFixed(1),
      h: +stage.getBoundingClientRect().height.toFixed(1)} : null,
    stageOpts: all('#mdStage [data-mlc-stage-opt]').length,
    posText: q('.md-stage-pos') ? q('.md-stage-pos').textContent.trim() : null,
    resets: all('.md-custom .md-resets button').map(b => b.textContent.trim()),
    optBg: opt ? getComputedStyle(opt).backgroundImage : null,
    optFont: opt ? getComputedStyle(opt).fontSize : null,
    optCount: all('#passages .passage a.link-internal:not(.macro-link)').length,
    stored: localStorage.getItem('MapleLanternDossier.settings.v1'),
  };
})()
"""


def main():
    proc, ws, url = start()
    try:
        send(ws, "Page.enable")
        send(ws, "Runtime.enable")
        viewport(ws, 390, 844, True)
        send(ws, "Page.navigate", {"url": url})
        time.sleep(2.4)

        s = evaluate(ws, SNAP)
        if not s:
            check("页面可求值", False, "SNAP 返回 None")
            return finish(proc, ws)

        # —— 启动装配 ——
        check("html data-mlc=on（自定义已启用）", s["attr"] == "on", s["attr"])
        check("core 暴露", s["hasCore"], s["hasCore"])
        check("custom 启动层暴露", s["hasCustom"], s["hasCustom"])
        check("panel 暴露", s["hasPanel"], s["hasPanel"])

        # —— 变量落地（未导入图时的默认） ——
        check("默认背景不透明度 1（100%，暗色图才看得见）", s["bgOp"] == "1", s["bgOp"])
        check("默认背景模糊 0px", s["bgSoft"] == "0px", s["bgSoft"])

        check("默认字号 1", s["fontScale"] == "1", s["fontScale"])
        check("默认底纹遮盖 0.9", s["surfaceAlpha"] == "0.9", s["surfaceAlpha"])
        check("#mlc-bg 层已建，fixed + 1", bool(s["layer"]) and s["layer"]["pos"] == "fixed"
              and s["layer"]["op"] == "1", str(s["layer"]))

        # —— 设置页注入 ——
        check("设置页注入灯台外观分组", s["group"], s["group"])
        check("预览舞台按视口比例铺（390×844 → 高 ≤ 420）",
              bool(s["stage"]) and s["stage"]["h"] <= 421 and s["stage"]["h"] >= 330
              and abs(s["stage"]["w"] / s["stage"]["h"] - 390 / 844) < 0.06, str(s["stage"]))
        check("舞台内 2 条样例选项", s["stageOpts"] == 2, s["stageOpts"])
        check("读数行是位置文案", bool(s["posText"]) and "位置" in s["posText"], s["posText"])
        check("分项复位 5 项齐全", len(s["resets"]) == 5 and any("背景" in x for x in s["resets"])
              and any("恢复出厂" in x for x in s["resets"]), str(s["resets"]))
        check("宿主选项 4 条（3 条平铺 + 1 条在 .ml-option-group 里；macro-link 不算）",
              s["optCount"] == 4, s["optCount"])

        # —— 设置生效：不透明度 / 字号 ——
        evaluate(ws, "window.MapleLanternCustom.setSettings({bgOpacity: 30, fontScale: 130})")
        time.sleep(0.4)
        s2 = evaluate(ws, SNAP)
        check("背景不透明度落到 0.3", s2["bgOp"] == "0.3", s2["bgOp"])
        check("背景层跟着降不透明度", s2["layer"] and s2["layer"]["op"] == "0.3", str(s2["layer"]))
        check("字号落到 1.3", s2["fontScale"] == "1.3", s2["fontScale"])
        check("选项字号真的变大（> 默认）", float(s2["optFont"].replace("px", "")) >
              float(s["optFont"].replace("px", "")), s["optFont"] + " -> " + s2["optFont"])

        # —— 真实导入链：File → Assets.process（覆盖 createImageBitmap 分支与解码失败路径）——
        IMPORTS = r"""(() => {
          const mkCanvas = (w, h, color) => {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d');
            g.fillStyle = color; g.fillRect(0, 0, w, h);
            g.fillStyle = '#e3b25f'; g.fillRect(0, 0, w, 8);
            return c;
          };
          const toFile = (c) => new Promise(res => c.toBlob(b => res(new File([b], 'probe.webp', { type: 'image/webp' })), 'image/webp', 0.9));
          const A = window.MapleLanternDossierAssets;
          return (async () => {
            const okFile = await toFile(mkCanvas(600, 900, '#204a3c'));
            const okRes = await A.process(okFile)
              .then(r => ({ ok: true, w: r.w, h: r.h, bytes: r.bytes, type: r.type }))
              .catch(e => ({ ok: false, code: e.code, message: e.message }));
            const txt = await A.process(new File(['x'], 'a.txt', { type: 'text/plain' }))
              .then(() => ({ ok: true })).catch(e => ({ ok: false, code: e.code }));
            const big = await A.process(new File([new ArrayBuffer(16 * 1024 * 1024)], 'big.png', { type: 'image/png' }))
              .then(() => ({ ok: true })).catch(e => ({ ok: false, code: e.code }));
            const broken = await A.process(new File(['not really a png'], 'broken.png', { type: 'image/png' }))
              .then(() => ({ ok: true })).catch(e => ({ ok: false, code: e.code, message: e.message }));
            return { ok: okRes, txt: txt, big: big, broken: broken };
          })();
        })()"""
        imp = evaluate(ws, IMPORTS)
        check("真实导入：600×900 WebP 解出正确尺寸",
              imp["ok"].get("ok") and imp["ok"].get("w") == 600 and imp["ok"].get("h") == 900, str(imp["ok"]))
        check("真实导入：产出转成 WebP 且体积可控",
              imp["ok"].get("type") == "image/webp" and imp["ok"].get("bytes", 0) > 0,
              str(imp["ok"].get("type")) + " / " + str(imp["ok"].get("bytes")))
        check("非图片被拒（not-image）", imp["txt"].get("code") == "not-image", str(imp["txt"]))
        check("超过 15 MB 被拒（too-large）", imp["big"].get("code") == "too-large", str(imp["big"]))
        check("坏图给出友好提示（不含浏览器英文原文）",
              imp["broken"].get("code") == "decode-failed"
              and "drawImage" not in (imp["broken"].get("message") or "")
              and "not of type" not in (imp["broken"].get("message") or ""),
              str(imp["broken"]))

        # —— 导入图后的真实路径：attach 一张 64×64 图，再开背景/按钮开关 ——
        ATTACH = r"""(() => {
          const c = document.createElement('canvas');
          c.width = 64; c.height = 64;
          const g = c.getContext('2d');
          g.fillStyle = '#33506b'; g.fillRect(0, 0, 64, 64);
          g.fillStyle = '#e3b25f'; g.fillRect(0, 0, 64, 8);
          const url = c.toDataURL('image/png');
          window.__mlTestUrl = url;
          window.MapleLanternDossierTheme.attach('bg', { url: url, w: 64, h: 64 });
          window.MapleLanternDossierTheme.attach('btn', { url: url, w: 64, h: 64 });
          window.MapleLanternCustom.setSettings({ bgOn: true, btnOn: true, btnOpacity: 40 });
          return true;
        })()"""
        evaluate(ws, ATTACH)
        time.sleep(0.5)
        s2b = evaluate(ws, """(() => {
          const e = document.documentElement;
          const l = document.getElementById('mlc-bg');
          const opt = document.querySelector('#passages .passage a.link-internal:not(.macro-link)');
          return {
            bgAttr: e.getAttribute('data-mlc-bg'),
            btnAttr: e.getAttribute('data-mlc-btn'),
            layerImg: l ? getComputedStyle(l).backgroundImage : null,
            bodyBg: getComputedStyle(document.body).backgroundImage,
            bodyBgColor: getComputedStyle(document.body).backgroundColor,
            optBg: opt ? getComputedStyle(opt).backgroundImage : null,
            bgImgVar: e.style.getPropertyValue('--mlc-bg-img')
          };
        })()""")
        check("导入背景图后 data-mlc-bg=on", s2b["bgAttr"] == "on", s2b["bgAttr"])
        check("#mlc-bg 真的铺上图", bool(s2b["layerImg"]) and "url(" in s2b["layerImg"], s2b["layerImg"])
        check("背景图开时 body 底色让位（不盖住背景层）",
              s2b["bodyBg"] == "none" and s2b["bodyBgColor"] in ("rgba(0, 0, 0, 0)", "transparent"),
              s2b["bodyBg"] + " / " + s2b["bodyBgColor"])
        check("导入底纹后 data-mlc-btn=on", s2b["btnAttr"] == "on", s2b["btnAttr"])
        check("选项层出现底纹（veil + 图，不是 none）",
              bool(s2b["optBg"]) and s2b["optBg"] != "none", s2b["optBg"])

        # —— 按钮底纹同样要过像素：面板关掉（选项本来就在面板外），换一张纯红图，
        #    90% 不透明度下选项中心必须真的泛红，否则就是"样式写了但没画出来" ——
        red = evaluate(ws, """(() => {
          const c = document.createElement('canvas');
          c.width = 64; c.height = 64;
          const g = c.getContext('2d');
          g.fillStyle = '#c0392b'; g.fillRect(0, 0, 64, 64);
          document.getElementById('ml-root').style.display = 'none';
          window.MapleLanternCustom.setSettings({ bgOn: false, btnOn: false });
          return c.toDataURL('image/png');
        })()""")
        time.sleep(0.5)
        opt = evaluate(ws, """(() => {
          const a = document.querySelectorAll('#passages .passage a.link-internal:not(.macro-link)')[0];
          const r = a.getBoundingClientRect();
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                   w: Math.round(r.width), h: Math.round(r.height) };
        })()""")
        off_pts, _ = pixels(ws, [(opt["x"], opt["y"])], "custom-btn-off.png")
        off_px = off_pts["%d,%d" % (opt["x"], opt["y"])]
        on = evaluate(ws, """(() => {
          window.MapleLanternDossierTheme.attach('btn', { url: arguments[0], w: 64, h: 64 });
          window.MapleLanternCustom.setSettings({ btnOn: true, btnOpacity: 90 });
          const a = document.querySelectorAll('#passages .passage a.link-internal:not(.macro-link)')[0];
          if (!a) return null;
          const r = a.getBoundingClientRect();
          return { bg: getComputedStyle(a).backgroundImage,
                   x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
                   w: Math.round(r.width), h: Math.round(r.height) };
        })()""".replace("arguments[0]", json.dumps(red)))
        on_pts, _ = pixels(ws, [(on["x"], on["y"])], "custom-btn-on.png")
        on_px = on_pts["%d,%d" % (on["x"], on["y"])]
        check("按钮底纹真的画出来了（选项中心明显泛红）",
              on_px[0] - off_px[0] >= 40 and on_px[0] - on_px[2] >= 40,
              "off=%s on=%s" % (str(off_px), str(on_px)))
        check("开底纹后选项立成整行按钮盒（不再是文字宽度的一条）",
              on["w"] >= 300 and on["h"] >= 44,
              "off=%dx%d on=%dx%d" % (opt["w"], opt["h"], on["w"], on["h"]))
        grp = evaluate(ws, """(() => {
          const g = document.querySelector('#passages .passage .ml-option-group');
          const a = g && g.querySelector('a.link-internal');
          if (!g || !a) return null;
          const gr = g.getBoundingClientRect();
          const r = a.getBoundingClientRect();
          const cs = getComputedStyle(a);
          const gcs = getComputedStyle(g);
          const pas = g.closest('.passage');
          const pcs = getComputedStyle(pas);
          const pasW = pas.getBoundingClientRect().width
            - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0);
          return { gw: Math.round(gr.width), gh: Math.round(gr.height), pasW: Math.round(pasW),
                   gBg: gcs.backgroundImage.indexOf('url(') >= 0,
                   w: Math.round(r.width), h: Math.round(r.height),
                   padL: parseFloat(cs.paddingLeft) || 0, padT: parseFloat(cs.paddingTop) || 0,
                   margL: parseFloat(cs.marginLeft) || 0 };
        })()""")
        check("选项分组：底纹铺在卡片本体上，宽度等于正文宽",
              bool(grp) and grp["gw"] >= 300 and abs(grp["gw"] - grp["pasW"]) <= 2
              and grp["gBg"],
              str(grp) if grp else "缺失")
        check("选项分组里的 <a> 立在内容列里（压过 padding:0 !important）",
              bool(grp) and grp["w"] >= 250 and grp["h"] >= 44
              and grp["padL"] >= 8 and grp["padT"] >= 8,
              str(grp) if grp else "缺失")
        evaluate(ws, """(() => {
          document.getElementById('ml-root').style.display = '';
          window.MapleLanternDossierTheme.attach('btn',
            { url: window.__mlTestUrl, w: 64, h: 64 });
          window.MapleLanternCustom.setSettings({ bgOn: true, btnOn: true, btnOpacity: 40 });
          return true;
        })()""")
        time.sleep(0.4)

        # —— 面板遮蔽必须真的接到灯台面板：不接，背景图会被面板底色整块遮死 ——
        evaluate(ws, "window.MapleLanternCustom.setSettings({surfaceAlpha: 30})")
        time.sleep(0.5)
        panel = evaluate(ws, """(() => {
          const root = document.getElementById('ml-root');
          const cs = getComputedStyle(root);
          return { alpha: cs.getPropertyValue('--ml-surface-alpha').trim(),
                   panelBg: cs.backgroundColor };
        })()""")
        check("「面板遮蔽」接到 #ml-root（--ml-surface-alpha = 0.3）",
              panel["alpha"] in ("0.3", ".3"), str(panel))
        evaluate(ws, "window.MapleLanternCustom.setSettings({surfaceAlpha: 10})")
        time.sleep(0.5)
        grid = [(x, y) for y in (120, 300, 500, 700, 800) for x in (20, 195, 370)]
        pts, size = pixels(ws, grid, "custom-bg-visible.png")
        blue = {k: v for k, v in pts.items() if v[2] - v[0] >= 25}
        check("面板内真的能看见导入的背景（多点点亮，不是单点巧合）",
              len(blue) >= 3,
              "%d/%d 点透出发蓝 · 样本 %s" % (len(blue), len(grid), str(list(blue.items())[:4])))

        # —— 「应用背景」按钮：导入图后手动重放一次 ——
        apply_bg = evaluate(ws, """(async () => {
          const c = document.createElement('canvas');
          c.width = 64; c.height = 64;
          const g = c.getContext('2d');
          g.fillStyle = '#2f6f4f'; g.fillRect(0, 0, 64, 64);
          const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
          const saved = await window.MapleLanternDossierAssets.save('bg', blob,
            { w: 64, h: 64, bytes: blob.size, type: 'image/png' });
          // 模拟"图库里有图，但界面还没应用"：先把图层与变量一起撤掉
          window.MapleLanternDossierTheme.attach('bg', null);
          document.documentElement.style.removeProperty('--mlc-bg-img');
          const btn = document.querySelector('.md-custom [data-mdd-custom-part="apply-bg"]');
          return { saved: !!saved, has: !!btn, label: btn ? btn.textContent : null,
                   before: document.documentElement.style.getPropertyValue('--mlc-bg-img') };
        })()""")
        check("「灯台外观」里有「应用背景」按钮",
              apply_bg["has"] and apply_bg["label"] == "应用背景", str(apply_bg))
        check("应用前背景变量确实已撤掉（模拟没生效）", apply_bg["before"].strip() == "",
              apply_bg["before"])
        evaluate(ws, """(() => {
          document.querySelector('.md-custom [data-mdd-custom-part="apply-bg"]').click();
          return true;
        })()""")
        time.sleep(0.8)
        after = evaluate(ws, """(() => {
          const e = document.documentElement;
          const n = document.querySelector('.md-custom [data-mdd-custom-part="note"]');
          const l = document.getElementById('mlc-bg');
          const p = document.querySelector('.md-custom [data-mdd-custom-part="stage-pos"]');
          return { img: e.style.getPropertyValue('--mlc-bg-img').trim(),
                   attr: e.getAttribute('data-mlc-bg'),
                   note: n ? n.textContent : '',
                   pos: p ? p.textContent : '',
                   layer: l ? getComputedStyle(l).backgroundImage : '' };
        })()""")
        check("点「应用背景」后变量重新挂上", "url(" in after["img"], after["img"][:60])
        check("点「应用背景」后背景层真的铺上",
              after["attr"] == "on" and "url(" in (after["layer"] or ""),
              after["attr"] + " / " + (after["layer"] or "")[:40])
        # 真实 DoL 的 <meta http-equiv="Content-Security-Policy"> 写的是 img-src 'self' data:
        # → blob: 一律被拦（CSP 违规 img-src blob），图静默不显示。这里锁死载体必须是 data:。
        check("背景图载体必须是 data: URL（blob: 会被 DoL 的 CSP 拦掉）",
              "data:image/" in (after["img"] or "") and "blob:" not in (after["img"] or ""),
              (after["img"] or "")[:70])
        check("点「应用背景」后提示行如实回执",
              "已应用" in (after["note"] or ""), (after["note"] or "")[:100])
        check("点「应用背景」后读数行跟着更新（不再显示未启用）",
              "背景 " in (after["pos"] or "") and "未启用" not in (after["pos"] or "").split("按钮")[0],
              (after["pos"] or "")[:80])

        # —— 配色 + 同步灯台 ——
        evaluate(ws, "window.MapleLanternCustom.setSettings({colors: {accent: '#AA3300'}, syncMl: true})")
        time.sleep(0.3)
        s3 = evaluate(ws, SNAP)
        check("强调色同步到 --mln-accent", s3["mlnAccent"].lower().strip() == "#aa3300", s3["mlnAccent"])

        # —— 分项复位：字号与遮蔽只回这两项 ——
        evaluate(ws, "window.MapleLanternDossierPanel && (()=>{const b=Array.from(document.querySelectorAll('.md-custom .md-resets button')).find(x=>x.textContent.indexOf('字号')>=0); b && b.click(); return true;})()")
        time.sleep(0.3)
        s4 = evaluate(ws, SNAP)
        check("复位字号与遮蔽：字号回 1", s4["fontScale"] == "1", s4["fontScale"])
        # 「应用背景」会把 <80 的不透明度补到 100（暗色图否则被遮罩洗没），所以这里应停在 1
        check("复位字号与遮蔽：背景不透明度停在应用背景纠过的 1", s4["bgOp"] == "1", s4["bgOp"])

        # —— 恢复出厂 ——
        evaluate(ws, "(()=>{const b=Array.from(document.querySelectorAll('.md-custom .md-resets button')).find(x=>x.textContent.indexOf('恢复出厂')>=0); b && b.click(); return true;})()")
        time.sleep(0.3)
        s5 = evaluate(ws, SNAP)
        check("恢复出厂：不透明度回 1", s5["bgOp"] == "1", s5["bgOp"])
        check("恢复出厂：字号回 1", s5["fontScale"] == "1", s5["fontScale"])
        check("恢复出厂：配色回跟随主题（--mln-accent 撤除）",
              s5["mlnAccent"].strip() == "", s5["mlnAccent"])
        check("恢复出厂：底纹开关关闭", s5["bgAttr"] in (None, "off"), s5["bgAttr"])

        # —— 持久化 ——
        check("设置已落 localStorage", bool(s5["stored"]) and "bgOpacity" in s5["stored"], (s5["stored"] or "")[:60])

        # —— 关掉背景/按钮开关 → 属性归 off，不残留内联值 ——
        evaluate(ws, "window.MapleLanternCustom.setSettings({bgOn: false, btnOn: false})")
        time.sleep(0.3)
        s6 = evaluate(ws, """(() => {
          const e = document.documentElement;
          return { bg: e.getAttribute('data-mlc-bg'), btn: e.getAttribute('data-mlc-btn'),
                   bgImg: e.style.getPropertyValue('--mlc-bg-img'),
                   btnImg: e.style.getPropertyValue('--mlc-btn-img') };
        })()""")
        check("关背景 → data-mlc-bg=off", s6["bg"] in ("off", None), s6["bg"])
        check("关按钮 → data-mlc-btn=off", s6["btn"] in ("off", None), s6["btn"])
        check("关背景不残留 --mlc-bg-img", s6["bgImg"] == "", repr(s6["bgImg"]))
        check("关按钮不残留 --mlc-btn-img", s6["btnImg"] == "", repr(s6["btnImg"]))

        # —— 视口重排 ——
        viewport(ws, 1280, 720, False)
        time.sleep(0.8)
        s7 = evaluate(ws, SNAP)
        check("桌面视口下舞台重新计算（宽高都变）",
              bool(s7["stage"]) and s7["stage"]["w"] != s5["stage"]["w"]
              and s7["stage"]["h"] != s5["stage"]["h"], str(s5["stage"]) + " -> " + str(s7["stage"]))

        shot(ws, "custom-desktop.png")
        viewport(ws, 390, 844, True)
        time.sleep(0.6)
        shot(ws, "custom-mobile.png")


        # —— 旧档迁移：开过背景但 bgOpacity<80 的玩家，刷新后应自动补到 100 ——
        evaluate(ws, "localStorage.setItem('MapleLanternDossier.settings.v1', JSON.stringify({custom:{bgOn:true,bgOpacity:45}}))")
        evaluate(ws, "location.reload()")
        time.sleep(2.0)
        s_mig = evaluate(ws, SNAP)
        check("旧档 bgOpacity 45 → 刷新后迁移到 1", s_mig["bgOp"] == "1", s_mig["bgOp"])
        check("迁移结果已落 localStorage", "\"bgOpacity\":100" in (evaluate(ws, "localStorage.getItem('MapleLanternDossier.settings.v1')") or ""),
              (evaluate(ws, "localStorage.getItem('MapleLanternDossier.settings.v1')") or "")[:80])
        check("全程零 JS 异常", len(exceptions) == 0, exceptions[:3])
        return finish(proc, ws)
    finally:
        try:
            ws.close()
        except Exception:
            pass
        proc.terminate()


def finish(proc, ws):
    total = len(results)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = total - passed
    print("\n--- 结果 ---")
    print("合计: %d PASS / %d FAIL" % (passed, failed))
    for name, ok, d in results:
        if not ok:
            print("[FAIL] " + name + " | " + str(d))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    try:
        import sys
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as exc:
        print("[ERROR] " + repr(exc))
        raise SystemExit(2)
