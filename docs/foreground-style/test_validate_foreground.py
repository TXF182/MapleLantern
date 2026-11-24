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
