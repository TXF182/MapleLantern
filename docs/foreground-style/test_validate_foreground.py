#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Unit tests for validate_foreground.py (no external assets required)."""

from __future__ import annotations

import os
import tempfile
import unittest

import numpy as np
from PIL import Image

from validate_foreground import validate


def make_sheet(center_px: bool = False, frame_diff: bool = False) -> Image.Image:
    a = np.zeros((256, 512, 4), dtype=np.uint8)
    # left and right bands, both frames
    for offset in (0, 256):
        a[:, offset + 0 : offset + 64, :] = (80, 60, 40, 255)
        a[:, offset + 244 : offset + 256, :] = (40, 60, 50, 255)
    if center_px:
        a[100, 100, :] = (255, 0, 0, 255)
    if frame_diff:
        a[10, 256 + 10, :] = (255, 255, 255, 255)
    return Image.fromarray(a, "RGBA")


def make_animated_sheet(delta: int = 6, center: bool = False, alpha_change: bool = False) -> Image.Image:
    a = np.zeros((256, 512, 4), dtype=np.uint8)
    for offset in (0, 256):
        a[:, offset + 0 : offset + 64, :] = (80, 60, 40, 255)
        a[:, offset + 244 : offset + 256, :] = (40, 60, 50, 255)
    base = a[:, :256, :].copy()
    f1 = base.copy()
    for x0, x1 in ((0, 86), (238, 256)):
        band = base[:, x0:x1, :]
        rgb = np.clip(band[:, :, :3].astype(np.int16) + delta, 0, 255).astype(np.uint8)
        lit = band[:, :, 3] > 0
        f1[:, x0:x1, :3] = np.where(lit[:, :, None], rgb, 0)
    if center:
        f1[100, 100, :] = (255, 0, 0, 255)
    if alpha_change:
        f1[10, 250, :] = (0, 0, 0, 0)
    a[:, 256:, :] = f1
    return Image.fromarray(a, "RGBA")


class ValidateForegroundTests(unittest.TestCase):
    def _write(self, im: Image.Image) -> str:
        fd, path = tempfile.mkstemp(suffix=".png", dir=tempfile.gettempdir())
        os.close(fd)
        im.save(path, "PNG")
        return path

    def test_valid_sheet_passes(self):
        path = self._write(make_sheet())
        try:
            r = validate(path)
            self.assertTrue(r.ok, r.errors)
            self.assertTrue(r.meta.get("frames_equal"))
        finally:
            os.remove(path)

    def test_center_pixel_fails(self):
        path = self._write(make_sheet(center_px=True))
        try:
            r = validate(path)
            self.assertFalse(r.ok)
            self.assertTrue(any("safe zone" in e for e in r.errors))
        finally:
            os.remove(path)

    def test_frames_must_match(self):
        path = self._write(make_sheet(frame_diff=True))
        try:
            r = validate(path)
            self.assertFalse(r.ok)
            self.assertTrue(any("differ" in e for e in r.errors))
        finally:
            os.remove(path)

    def test_animated_micro_diff_passes_when_allowed(self):
        path = self._write(make_animated_sheet(delta=6))
        try:
            r = validate(path, allow_animated=True)
            self.assertTrue(r.ok, r.errors)
            self.assertFalse(r.meta.get("frames_equal"))
            self.assertEqual(r.meta.get("diff_max_delta"), 6)
            # 默认口径仍视作“静态帧不一致”拒收
            self.assertFalse(validate(path).ok)
        finally:
            os.remove(path)

    def test_animated_center_diff_rejected(self):
        path = self._write(make_animated_sheet(center=True))
        try:
            r = validate(path, allow_animated=True)
            self.assertFalse(r.ok)
            self.assertTrue(any("safe zone" in e for e in r.errors))
        finally:
            os.remove(path)

    def test_animated_alpha_change_rejected(self):
        path = self._write(make_animated_sheet(alpha_change=True))
        try:
            r = validate(path, allow_animated=True)
            self.assertFalse(r.ok)
            self.assertTrue(any("change alpha" in e for e in r.errors))
        finally:
            os.remove(path)

    def test_animated_delta_cap_enforced(self):
        path = self._write(make_animated_sheet(delta=40))
        try:
            r = validate(path, allow_animated=True)
            self.assertFalse(r.ok)
            self.assertTrue(any("delta 40" in e and "24" in e for e in r.errors))
        finally:
            os.remove(path)

    def test_wrong_size_fails(self):
        im = Image.new("RGBA", (256, 128), (0, 0, 0, 0))
        path = self._write(im)
        try:
            r = validate(path)
            self.assertFalse(r.ok)
            self.assertTrue(any("size" in e for e in r.errors))
        finally:
            os.remove(path)

    def test_white_matte_fails(self):
        a = np.zeros((256, 512, 4), dtype=np.uint8)
        for offset in (0, 256):
            a[:, offset + 0 : offset + 64, :] = (80, 60, 40, 255)
            a[:, offset + 244 : offset + 256, :] = (40, 60, 50, 255)
        a[10, 250] = (255, 255, 255, 0)  # transparent hole in right band, white RGB
        path = self._write(Image.fromarray(a, "RGBA"))
        try:
            r = validate(path)
            self.assertFalse(r.ok)
            self.assertTrue(any("white matte" in e for e in r.errors))
        finally:
            os.remove(path)

    def test_opaque_ratio_cap(self):
        a = np.zeros((256, 512, 4), dtype=np.uint8)
        for offset in (0, 256):
            a[:, offset + 0 : offset + 100, :] = (80, 60, 40, 255)  # intrudes safe zone + >30%
        path = self._write(Image.fromarray(a, "RGBA"))
        try:
            r = validate(path)
            self.assertFalse(r.ok)
            self.assertTrue(any("opaque ratio" in e for e in r.errors))
        finally:
            os.remove(path)


if __name__ == "__main__":
    unittest.main()
