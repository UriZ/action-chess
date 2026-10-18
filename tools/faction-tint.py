#!/usr/bin/env python3
"""Push a faction's pieces to a decisively darker palette.

The generated "black" army still reads as mid-gray steel next to the white
army. On a chess board the two sides must be distinguishable at a glance, so
this crushes the grayscale (armor, cloth) toward near-black while PRESERVING
the red faction cross, which then glows against the dark.

Usage:
  python3 tools/faction-tint.py public/pieces/black-*.png      # in place
  python3 tools/faction-tint.py --preview <file> <out.jpg>     # single check

Source art stays untouched in art/generated/, so this is always re-runnable
from scratch.
"""
import sys
import numpy as np
from PIL import Image

# How far down the grayscale goes (0 = black, 1 = unchanged).
# Pushed too far and the army is black-on-black against a dark board; the
# renderer adds a rim light, so the art only needs to read as 'dark steel'.
GAIN = 0.42
# lift so the darkest ink doesn't become a flat silhouette
FLOOR = 16
# contrast around the new midpoint, keeps armor edges readable
CONTRAST = 1.18

# Luminance alone does NOT separate the two armies — side by side they still
# read as one side. The dark faction also gets a cold blue-iron cast so it
# differs in HUE as well as value, against the warm bone of the white army.
COLD = (0.78, 0.92, 1.26)   # per-channel multipliers
# their heraldry is deep crimson rather than the white army's bright red
RED_MIX = (0.80, 0.20, 0.24)

def tint(path, out=None):
    im = Image.open(path).convert('RGBA')
    arr = np.asarray(im).astype(np.float32)
    r, g, b, a = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]

    # Redness must be RATIO-based, not absolute: skin tones have a large
    # absolute r-g gap but a small relative one, and an absolute test turns
    # every face into a glowing red lamp. The heraldic cross is deeply
    # saturated, faces are not.
    gray = (r + g + b) / 3.0
    ratio = (r - np.maximum(g, b)) / np.maximum(r, 1.0)
    redness = np.clip((ratio - 0.38) / 0.22, 0.0, 1.0)

    # darken the grayscale body
    dark = np.clip((gray - 128.0) * CONTRAST + 128.0, 0, 255) * GAIN + FLOOR
    dark = np.clip(dark, 0, 255)

    # deep crimson heraldry, still bright enough to find on dark armor
    red_r = np.clip(r * RED_MIX[0] + 24, 0, 255)
    red_g = np.clip(g * RED_MIX[1], 0, 255)
    red_b = np.clip(b * RED_MIX[2], 0, 255)

    w = redness[..., None]
    # cold blue-iron body
    body = np.dstack([
        np.clip(dark * COLD[0], 0, 255),
        np.clip(dark * COLD[1], 0, 255),
        np.clip(dark * COLD[2], 0, 255),
    ])
    red = np.dstack([red_r, red_g, red_b])
    rgb = body * (1 - w) + red * w

    out_arr = np.dstack([rgb, a]).astype(np.uint8)
    res = Image.fromarray(out_arr, 'RGBA')
    res.save(out or path)
    return res

if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--preview':
        im = tint(args[1], None if len(args) < 3 else '/dev/null')
        bg = Image.new('RGBA', im.size, (20, 22, 30, 255))
        Image.alpha_composite(bg, im).convert('RGB').save(args[2])
        print('preview', args[2])
    else:
        for p in args:
            tint(p)
            print('tinted', p)
