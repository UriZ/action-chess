#!/usr/bin/env python3
"""Recolour one army's art into the opposing faction's palette.

A second army is the same order in a different livery, so the honest way to
make one is to generate it. This is the stand-in for when that art does not
exist yet (or as a base to check contrast before committing to ~78 more
generations).

Only the SKIN/ARMOUR hue band is rotated. Rotating every pixel would also spin
the shared accents -- the orange trim and the cyan energy read as faction-
neutral "technology" across both armies, and turning cyan plasma orange would
make the two sides look like different games rather than different teams.

Usage:
  python3 tools/recolour-faction.py --set martian --from green --to purple
"""
import colorsys
import glob
import os
import sys
import numpy as np
from PIL import Image

# hue in degrees; the green band covers leaf green through yellow-green
# A band may WRAP through 0 (red does), in which case lo > hi.
BANDS = {
    'green': (62.0, 185.0),
    'red': (335.0, 22.0),
}
TARGETS = {
    'blue': {'hue': 214.0, 'sat': 1.02, 'val': 1.0},
    # target hue, plus a saturation/value nudge so the recoloured army reads as
    # a distinct faction rather than the same figure under a coloured light
    'purple': {'hue': 287.0, 'sat': 1.08, 'val': 0.94},
}

def recolour(path, lo, hi, tgt):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255.0
    rgb, alpha = a[:, :, :3], a[:, :, 3]
    mx = rgb.max(axis=2); mn = rgb.min(axis=2)
    d = mx - mn
    # hue, the cheap vectorised way
    h = np.zeros_like(mx)
    nz = d > 1e-6
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    im_r = nz & (mx == r); im_g = nz & (mx == g); im_b = nz & (mx == b)
    h[im_r] = ((g - b)[im_r] / d[im_r]) % 6
    h[im_g] = ((b - r)[im_g] / d[im_g]) + 2
    h[im_b] = ((r - g)[im_b] / d[im_b]) + 4
    h = h * 60.0
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0.0)
    v = mx

    inband = (h >= lo) & (h <= hi) if lo <= hi else ((h >= lo) | (h <= hi))
    # s > 0.10 keeps the greys and whites out: moulded grey armour, a white
    # horse and the silver weapons are faction-neutral hardware, and the
    # yellow heads and hands sit outside every band on purpose
    sel = inband & (alpha > 0.05) & (s > 0.10)
    if not sel.any():
        return 0
    # keep each pixel's position WITHIN the band so shading and the darker
    # outline tones stay distinct instead of flattening to one colour
    span = (hi - lo) if lo <= hi else (360.0 - lo + hi)
    span = max(span, 1e-6)
    rel = (h[sel] - lo) % 360.0
    pos = rel / span
    h2 = (tgt['hue'] - 38.0) + pos * 76.0
    s2 = np.clip(s[sel] * tgt['sat'], 0, 1)
    v2 = np.clip(v[sel] * tgt['val'], 0, 1)

    out = rgb.copy()
    conv = np.array([colorsys.hsv_to_rgb((hh % 360) / 360.0, ss, vv)
                     for hh, ss, vv in zip(h2, s2, v2)], dtype=np.float32)
    out[sel] = conv
    res = np.dstack([out, alpha])
    Image.fromarray((res * 255).round().astype(np.uint8), 'RGBA').save(path)
    return int(sel.sum())

def main():
    args = sys.argv[1:]
    def opt(name, default=None):
        return args[args.index(name) + 1] if name in args else default
    sset = opt('--set'); src = opt('--from', 'green'); dst = opt('--to', 'purple')
    lo, hi = BANDS[src]; tgt = TARGETS[dst]
    where = f'public/pieces/{sset}' if sset else 'public/pieces'
    n = 0
    for f in sorted(glob.glob(f'{where}/{src}-*.webp')) + sorted(glob.glob(f'{where}/{src}-*.png')):
        out = f.replace(f'{src}-', f'{dst}-', 1)
        Image.open(f).save(out)
        px = recolour(out, lo, hi, tgt)
        n += 1
        if n % 20 == 0:
            print(f'  {n} files...', flush=True)
    print(f'{n} files recoloured {src} -> {dst} in {where}')

if __name__ == '__main__':
    main()
