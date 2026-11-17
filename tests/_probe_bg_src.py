"""在真实 64 MB DoL HTML 里定位「场景画面」到底画在哪一层。

只读搜索，不改文件。判据必须来自源码原文，不靠猜。
"""
import pathlib
import re

HTML = pathlib.Path(__file__).resolve().parents[2] / "game" / "Degrees of Lewdity.html"
txt = HTML.read_bytes().decode("utf-8", errors="ignore")
print("file bytes:", len(txt))

PATTERNS = [
    'class=\\"background\\"',
    'class="background"',
    "backgrounds/",
    "backgroundBase",
    'id="images"',
    "img/background",
    "style.backgroundImage",
    "background-image: url",
    "#bg-image",
    ".background {",
    "div.background",
]

for pat in PATTERNS:
    idxs = [m.start() for m in re.finditer(re.escape(pat), txt)]
    print("%-28s hits=%d" % (pat, len(idxs)))
    for i in idxs[:2]:
        seg = txt[max(0, i - 160): i + 240].replace("\n", " ")
        print("    ...", seg[:360])
    print()
