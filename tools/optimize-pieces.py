#!/usr/bin/env python3
"""Turn the full-size piece PNGs into web-sized WebP.

The slicer emits 760x1000 PNGs (~535 KB each). The game preloads every frame,
so shipping 156 of those is ~85 MB on first load — fine locally, hopeless for
a hosted site. Pieces never render wider than ~300 CSS px, so 0.62 scale still
leaves retina headroom, and WebP with alpha is ~12x smaller than PNG.

Usage: python3 tools/optimize-pieces.py [--replace]
       --replace deletes the source PNGs once the WebP is written
       (they stay re-derivable from art/generated/ via slice-sheet.py)
"""
import glob
import os
import sys
from PIL import Image

SCALE = 0.62
QUALITY = 86

def main(replace: bool):
    pngs = sorted(glob.glob('public/pieces/*.png'))
    before = after = 0
    for src in pngs:
        dst = src[:-4] + '.webp'
        im = Image.open(src).convert('RGBA')
        im = im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.LANCZOS)
        im.save(dst, 'WEBP', quality=QUALITY, method=6)
        before += os.path.getsize(src)
        after += os.path.getsize(dst)
        if replace:
            os.remove(src)
    n = len(pngs)
    print(f'{n} files: {before/1048576:.1f} MB -> {after/1048576:.1f} MB '
          f'({before/max(after,1):.1f}x smaller)')

if __name__ == '__main__':
    main('--replace' in sys.argv)
