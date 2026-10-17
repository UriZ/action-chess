#!/usr/bin/env python3
"""Slice a Gemini-generated sprite sheet / portrait (fake-checkerboard JPEG)
into transparent, normalized PNG frames.

Usage:
  python3 tools/slice-sheet.py <sheet.jpg> <out_prefix>     # 2x2 sheet -> <out_prefix>-0..3.png
  python3 tools/slice-sheet.py --single <img.jpg> <name>    # one portrait -> <name>.png

Background removal:
  - border-connected checker-colored regions are always removed
  - ENCLOSED regions are removed only if their pixels match the actual
    checkerboard GRID (period + phase fitted from the image corners), so
    smoothly-shaded white cloth is never mistaken for background
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

CHECKER = [np.array([240, 240, 240]), np.array([208, 208, 208])]
CANVAS = (760, 1000)
FIG_H, BOTTOM_PAD = 940, 20

def classify(arr, tol=16):
    """0 = light checker tone, 1 = dark checker tone, -1 = neither."""
    cls = np.full(arr.shape[:2], -1, np.int8)
    cls[np.abs(arr - CHECKER[0]).max(axis=2) <= tol] = 0
    cls[np.abs(arr - CHECKER[1]).max(axis=2) <= tol] = 1
    return cls

def fit_grid(cls):
    """Estimate checker square period and phase from the corner regions."""
    h, w = cls.shape
    def runs_along(line):
        out, px, run = [], None, 0
        for v in line:
            if v < 0:
                if run: out.append((px, run)); run = 0
                px = None
                continue
            if v == px: run += 1
            else:
                if run: out.append((px, run))
                px, run = v, 1
        if run: out.append((px, run))
        return out
    # collect run lengths from corner strips
    lens = []
    for y in list(range(0, min(100, h))) [::7]:
        lens += [r for _, r in runs_along(cls[y, :min(200, w)])[1:-1]]
    for x in list(range(0, min(100, w)))[::7]:
        lens += [r for _, r in runs_along(cls[:min(200, h), x])[1:-1]]
    lens = [l for l in lens if l >= 6]
    if not lens:
        return None
    P = int(np.median(lens))
    # phase: first transition along row 2 / col 2
    def first_trans(line):
        for i in range(1, len(line)):
            if line[i] >= 0 and line[i-1] >= 0 and line[i] != line[i-1]:
                return i
        return 0
    tx, ty = first_trans(cls[2, :]), first_trans(cls[:, 2])
    bx, by = min(tx + 2, w - 1), min(ty + 2, h - 1)
    base = cls[2, bx]
    if base < 0: base = 0
    def expected(y, x):
        kx = (x - tx) // P
        ky = (y - ty) // P
        return int(base) ^ (kx & 1) ^ (ky & 1)
    # calibrate against a known corner pixel vertically
    if cls[by, 2] >= 0 and expected(by, 2) != cls[by, 2]:
        b = base ^ 1
        def expected(y, x, _b=b):
            return _b ^ (((x - tx) // P) & 1) ^ (((y - ty) // P) & 1)
    return expected, P

AGGRESSIVE = False  # kill ALL enclosed checker-colored blobs (safe for dark figures)

def checker_alpha(fa, grid, oy, ox, tol=26, min_blob=300):
    expected, P = grid if grid else (None, 24)
    """fa: frame array; expected(y,x) in FULL-image coords; (oy,ox) frame origin."""
    h, w, _ = fa.shape
    near = np.zeros((h, w), bool)
    for c in CHECKER:
        near |= (np.abs(fa - c).max(axis=2) <= tol)
    cls = classify(fa)
    alpha = np.full((h, w), 255, np.uint8)
    seen = np.zeros((h, w), bool)
    for sy in range(h):
        for sx in range(w):
            if near[sy, sx] and not seen[sy, sx]:
                comp = [(sy, sx)]; seen[sy, sx] = True
                dq = deque(comp); touches = False
                while dq:
                    y, x = dq.popleft()
                    if y in (0, h-1) or x in (0, w-1): touches = True
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = y+dy, x+dx
                        if 0 <= ny < h and 0 <= nx < w and near[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; comp.append((ny, nx)); dq.append((ny, nx))
                kill = touches
                if not kill and AGGRESSIVE and len(comp) >= min_blob:
                    kill = True
                if not kill and len(comp) >= min_blob and expected is not None:
                    pts = [(y, x, cls[y, x]) for y, x in comp if cls[y, x] >= 0]
                    classified = len(pts)
                    if classified / len(comp) >= 0.35 and classified >= 100:
                        # global-grid match (checker in phase with the corners)
                        matched = sum(1 for y, x, c in pts if c == expected(y + oy, x + ox))
                        grid_ok = matched / classified >= 0.65
                        # local phase fit: a REAL checker matches a square grid at
                        # some phase almost perfectly; gradients and cloth don't
                        local_ok = False
                        if not grid_ok:
                            sample = pts[::max(1, len(pts) // 500)]
                            step = max(3, P // 6)
                            best = 0.0
                            for dy in range(0, P, step):
                                for dx in range(0, P, step):
                                    m = sum(1 for y, x, c in sample
                                            if c == (((x + dx) // P) & 1) ^ (((y + dy) // P) & 1))
                                    best = max(best, m / len(sample), 1 - m / len(sample))
                            local_ok = best >= 0.85
                        kill = grid_ok or local_ok
                if kill:
                    for y, x in comp: alpha[y, x] = 0
    return alpha

def prune_strays(img, min_frac=0.06, pad=36):
    """Remove small disconnected islands far from the main figure — typically a
    weapon tip that bled across a sheet cell border from the neighboring frame.
    A dropped weapon lying NEXT to a fallen body survives (its bbox is near the
    main component's)."""
    a = np.asarray(img.getchannel('A')).copy()
    mask = a > 20
    h, w = mask.shape
    lbl = np.zeros((h, w), np.int32)
    comps = []  # (size, (y0,x0,y1,x1))
    cur = 0
    for sy in range(h):
        for sx in range(w):
            if mask[sy, sx] and lbl[sy, sx] == 0:
                cur += 1
                dq = deque([(sy, sx)])
                lbl[sy, sx] = cur
                n = 0; y0 = y1 = sy; x0 = x1 = sx
                while dq:
                    y, x = dq.popleft()
                    n += 1
                    y0 = min(y0, y); y1 = max(y1, y); x0 = min(x0, x); x1 = max(x1, x)
                    for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
                        ny, nx = y+dy, x+dx
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and lbl[ny, nx] == 0:
                            lbl[ny, nx] = cur
                            dq.append((ny, nx))
                comps.append((n, (y0, x0, y1, x1)))
    if not comps:
        return img
    main_i = max(range(len(comps)), key=lambda i: comps[i][0])
    # dilate the main component; a small component survives only if it comes
    # within `pad` px of the figure itself (not just its bounding box)
    main_mask = Image.fromarray(np.where(lbl == main_i + 1, 255, 0).astype(np.uint8))
    k = pad * 2 + 1
    dilated = np.asarray(main_mask.filter(ImageFilter.MaxFilter(k))) > 0
    for i, (n, _) in enumerate(comps):
        if i == main_i:
            continue
        if n < comps[main_i][0] * min_frac:
            sel = lbl == i + 1
            if not (dilated & sel).any():
                a[sel] = 0
    img.putalpha(Image.fromarray(a))
    return img

def finish(img, out_name, wide_by_width=True):
    a = img.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    img.putalpha(a)
    img = prune_strays(img)
    bb = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    crop = img.crop(bb)
    ar = crop.width / crop.height
    if wide_by_width and ar > 1.2:
        s = (CANVAS[0] * 0.95) / crop.width
    else:
        s = FIG_H / crop.height
    crop = crop.resize((int(crop.width*s), int(crop.height*s)), Image.LANCZOS)
    if crop.width > CANVAS[0]:
        s2 = CANVAS[0] / crop.width
        crop = crop.resize((CANVAS[0], int(crop.height*s2)), Image.LANCZOS)
    cv = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    cv.paste(crop, ((CANVAS[0]-crop.width)//2, CANVAS[1]-BOTTOM_PAD-crop.height))
    out = f'public/pieces/{out_name}.png'
    cv.save(out)
    print('saved', out)

def main(src, prefix):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    arr = np.asarray(im).astype(np.int16)
    grid = fit_grid(classify(arr))
    fw, fh = W // 2, H // 2
    idx = 0
    for r in range(2):
        for c in range(2):
            fa = arr[r*fh:(r+1)*fh, c*fw:(c+1)*fw]
            alpha = checker_alpha(fa, grid, r*fh, c*fw)
            finish(Image.fromarray(np.dstack([fa.astype(np.uint8), alpha]), 'RGBA'), f'{prefix}-{idx}')
            idx += 1

def single(src, name):
    im = Image.open(src).convert('RGB')
    arr = np.asarray(im).astype(np.int16)
    grid = fit_grid(classify(arr))
    alpha = checker_alpha(arr, grid, 0, 0)
    finish(Image.fromarray(np.dstack([arr.astype(np.uint8), alpha]), 'RGBA'), name)

def green_alpha(arr):
    """Chroma-key: the art is grayscale+red, so anything green is background."""
    r = arr[:, :, 0].astype(np.int32)
    g = arr[:, :, 1].astype(np.int32)
    b = arr[:, :, 2].astype(np.int32)
    greenish = (g > 90) & (g > r + 30) & (g > b + 30)
    alpha = np.where(greenish, 0, 255).astype(np.uint8)
    # despill: clamp green on remaining pixels so edges have no green fringe
    spill = (~greenish) & (g > r + 12) & (g > b + 12)
    arr[:, :, 1] = np.where(spill, (r + b) // 2, arr[:, :, 1])
    return alpha

def main_green(src, prefix, inset=14):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    arr = np.asarray(im).astype(np.int16).copy()
    fw, fh = W // 2, H // 2
    idx = 0
    for r in range(2):
        for c in range(2):
            fa = arr[r*fh+inset:(r+1)*fh-inset, c*fw+inset:(c+1)*fw-inset].copy()
            alpha = green_alpha(fa)
            finish(Image.fromarray(np.dstack([fa.astype(np.uint8), alpha]), 'RGBA'), f'{prefix}-{idx}')
            idx += 1

def single_green(src, name):
    arr = np.asarray(Image.open(src).convert('RGB')).astype(np.int16).copy()
    alpha = green_alpha(arr)
    finish(Image.fromarray(np.dstack([arr.astype(np.uint8), alpha]), 'RGBA'), name)

if __name__ == '__main__':
    if '--aggressive' in sys.argv:
        AGGRESSIVE = True
        sys.argv.remove('--aggressive')
    if sys.argv[1] == '--single':
        single(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == '--green-single':
        single_green(sys.argv[2], sys.argv[3])
    elif sys.argv[1] == '--green':
        main_green(sys.argv[2], sys.argv[3])
    else:
        main(sys.argv[1], sys.argv[2])
