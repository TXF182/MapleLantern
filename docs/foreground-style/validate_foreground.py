#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Validate MapleLantern foreground assets.

Canonical pack asset: 512x256 RGBA, two 256x256 frames, static duplicate frames.
Per-frame character safe zone: x=86..237, full height, alpha must be exactly 0.
Only the left band (0..85) and right band (238..255) may carry pixels.
The 152px center is the common denominator of the shipped edge-frame pack
(left band 32..85, right band 238..247) and the generated sample sheets.

Usage:
  python validate_foreground.py samples/*_sheet_512x256.png
  python validate_foreground.py --json samples/*_sheet_512x256.png
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import sys
from dataclasses import dataclass, field
from typing import Iterable, List

import numpy as np
from PIL import Image

FRAME_W = 256
FRAME_H = 256
SAFE_X0 = 86
SAFE_X1 = 238  # exclusive
MAX_OPAQUE_RATIO = 0.30


@dataclass
class Result:
    path: str
    ok: bool = True
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    meta: dict = field(default_factory=dict)

    def fail(self, msg: str) -> None:
        self.ok = False
        self.errors.append(msg)


def _check_frame(a: np.ndarray, offset: int, r: Result, label: str) -> None:
    frame_alpha = a[:, offset : offset + FRAME_W, 3]
    safe = frame_alpha[:, SAFE_X0:SAFE_X1]
    if int(safe.max()) != 0:
        bad = int((safe > 0).sum())
        r.fail(f"{label}: character safe zone x={SAFE_X0}..{SAFE_X1 - 1} has {bad} non-transparent px (max alpha {int(safe.max())})")

    # RGB under alpha=0 must be zero, otherwise some engines can show a white matte.
    frame_rgba = a[:, offset : offset + FRAME_W, :]
    transparent = frame_rgba[:, :, 3] == 0
    if transparent.any() and np.any(frame_rgba[:, :, :3][transparent] != 0):
        r.fail(f"{label}: transparent px carry non-zero RGB (white matte risk)")

    opaque_ratio = float((frame_alpha == 255).sum()) / float(FRAME_W * FRAME_H)
    r.meta[f"{label}_opaque_ratio"] = round(opaque_ratio, 4)
    if opaque_ratio > MAX_OPAQUE_RATIO:
        r.fail(f"{label}: opaque ratio {opaque_ratio:.1%} > {MAX_OPAQUE_RATIO:.0%}")


def validate(path: str) -> Result:
    r = Result(path=path)
    try:
        with Image.open(path) as src:
            im = src.convert("RGBA")
            size = im.size
            mode = src.mode
    except Exception as exc:  # noqa: BLE001
        r.fail(f"cannot open image: {exc}")
        return r

    r.meta["size"] = list(size)
    r.meta["mode"] = mode
    if mode != "RGBA":
        r.fail(f"mode is {mode}, expected RGBA")
    if size not in ((512, 256), (256, 256)):
        r.fail(f"size is {size}, expected (512, 256) sheet or (256, 256) frame")
        return r
    if size == (256, 256):
        r.warnings.append("single 256x256 frame: preview only, not a pack-ready 2-frame sheet")

    a = np.array(im)
    alpha = a[:, :, 3]
    r.meta["alpha_min"] = int(alpha.min())
    r.meta["alpha_max"] = int(alpha.max())
    if int(alpha.min()) != 0:
        r.fail("alpha minimum is not 0 (image may be fully opaque)")
    if int(alpha.max()) != 255:
        r.fail("alpha maximum is not 255 (no fully opaque pixels)")

    _check_frame(a, 0, r, "frame0")
    if im.size[0] == 512:
        _check_frame(a, 256, r, "frame1")
        if not np.array_equal(a[:, :256, :], a[:, 256:, :]):
            r.fail("frame0 and frame1 differ; static foreground must be duplicate frames")
        else:
            r.meta["frames_equal"] = True
    return r


def expand(paths: Iterable[str]) -> List[str]:
    out: List[str] = []
    for p in paths:
        if any(ch in p for ch in "*?["):
            out.extend(sorted(glob.glob(p)))
        else:
            out.append(p)
    return out


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate MapleLantern foreground PNG assets")
    parser.add_argument("paths", nargs="+", help="PNG paths or glob patterns")
    parser.add_argument("--json", action="store_true", help="print machine-readable JSON")
    args = parser.parse_args(argv)

    files = expand(args.paths)
    if not files:
        print("no input files", file=sys.stderr)
        return 2

    results = [validate(p) for p in files]
    if args.json:
        print(json.dumps([r.__dict__ for r in results], ensure_ascii=False, indent=2))
    else:
        for r in results:
            status = "PASS" if r.ok else "FAIL"
            print(f"[{status}] {os.path.basename(r.path)}")
            print(f"       size={r.meta.get('size')} mode={r.meta.get('mode')} "
                  f"alpha={r.meta.get('alpha_min')}..{r.meta.get('alpha_max')} "
                  f"opaque={r.meta.get('frame0_opaque_ratio')}")
            for w in r.warnings:
                print(f"       WARN {w}")
            for e in r.errors:
                print(f"       ERR  {e}")

    passed = sum(1 for r in results if r.ok)
    print(f"\nSUMMARY: {passed}/{len(results)} PASS")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
