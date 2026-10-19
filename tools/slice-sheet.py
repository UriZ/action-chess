#!/usr/bin/env python3
"""Slice a Gemini-generated sprite sheet / portrait (fake-checkerboard JPEG)
into transparent, normalized PNG frames.

Usage:
  python3 tools/slice-sheet.py <sheet.jpg> <out_prefix>     # 2x2 sheet -> <out_prefix>-0..3.png
  python3 tools/slice-sheet.py --single <img.jpg> <name>    # one portrait -> <name>.png

  --green / --green-single   chroma-key a solid green background instead
  --set <name>               write into public/pieces/<name>/ (a second piece set)

Background removal:
  - border-connected checker-colored regions are always removed
  - ENCLOSED regions are removed only if their pixels match the actual
    checkerboard GRID (period + phase fitted from the image corners), so
    smoothly-shaded white cloth is never mistaken for background
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter
from collections import deque

OUT_DIR = 'public/pieces'          # overridden by --set

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

def tighten(img):
    """Clean the keyed alpha and crop to the figure. Returns the cropped RGBA."""
    a = img.getchannel('A').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.7))
    img.putalpha(a)
    img = prune_strays(img)
    bb = img.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    return img.crop(bb)

def fit_scale(crops):
    """One scale for a whole sheet.

    Scaling each frame to a fixed figure height independently makes the
    character PULSE between frames: a crouched or lunging pose is shorter, so
    it gets blown up to match. Deriving a single scale from the extents of all
    frames keeps the character one size across the animation, and the width
    term stops a wide pose (a lunge, a braced cannon, a fallen body) from
    overflowing the canvas."""
    return min(FIG_H / max(c.height for c in crops),
               CANVAS[0] * 0.98 / max(c.width for c in crops))

def place(crop, s, out_name):
    """Scale by s, bottom-align on the shared canvas, write the PNG.

    MIRROR flips the art horizontally. The renderer mirrors a sprite by travel
    direction and therefore requires every piece to be drawn facing RIGHT; the
    generator does not reliably honour that, and a piece drawn facing left
    fires its weapon backwards out of the frame."""
    if MIRROR:
        crop = crop.transpose(Image.FLIP_LEFT_RIGHT)
    crop = crop.resize((max(1, round(crop.width*s)), max(1, round(crop.height*s))), Image.LANCZOS)
    cv = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    cv.paste(crop, ((CANVAS[0]-crop.width)//2, CANVAS[1]-BOTTOM_PAD-crop.height))
    os.makedirs(OUT_DIR, exist_ok=True)
    out = f'{OUT_DIR}/{out_name}.png'
    cv.save(out)
    print(f'saved {out}  figure {crop.width}x{crop.height}')
    return crop.height

def check_against_idle(out_name, fig_h):
    """Warn when a sheet's figure is a different size from the piece's idle.

    The renderer stretches the whole canvas into a fixed box, so figure height
    inside the canvas IS on-screen size: a sheet normalized smaller than its
    idle makes the piece visibly shrink the moment it starts moving. A wide
    pose trips this, because fit_scale has to shrink the figure to keep the
    pose inside the canvas width -- widen CANVAS for the set, or reshoot the
    pose narrower.

    Death is exempt: its last beats are a body lying flat, which is genuinely
    short and wide."""
    if '-death-' in out_name:
        return
    idle = f'{OUT_DIR}/{out_name.rsplit("-", 2)[0]}.png'
    if not os.path.exists(idle):
        return
    bb = Image.open(idle).convert('RGBA').getchannel('A').getbbox()
    ih = bb[3] - bb[1]
    off = abs(fig_h - ih) / ih
    if off > 0.12:
        print(f'  WARNING: figure is {fig_h}px but {os.path.basename(idle)} is {ih}px '
              f'({off*100:.0f}% off) -- the piece will change size on screen. '
              f'Reshoot the pose narrower so it does not hit the canvas width.')

def finish(img, out_name):
    crop = tighten(img)
    place(crop, fit_scale([crop]), out_name)

def main(src, prefix):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    arr = np.asarray(im).astype(np.int16)
    grid = fit_grid(classify(arr))
    fw, fh = W // 2, H // 2
    crops = []
    for r in range(2):
        for c in range(2):
            fa = arr[r*fh:(r+1)*fh, c*fw:(c+1)*fw]
            alpha = checker_alpha(fa, grid, r*fh, c*fw)
            crops.append(tighten(Image.fromarray(np.dstack([fa.astype(np.uint8), alpha]), 'RGBA')))
    s = fit_scale(crops)
    for idx, crop in enumerate(crops):
        check_against_idle(f'{prefix}-{idx}', place(crop, s, f'{prefix}-{idx}'))

def single(src, name):
    im = Image.open(src).convert('RGB')
    arr = np.asarray(im).astype(np.int16)
    grid = fit_grid(classify(arr))
    alpha = checker_alpha(arr, grid, 0, 0)
    finish(Image.fromarray(np.dstack([arr.astype(np.uint8), alpha]), 'RGBA'), name)

KEY = 'green'      # kept for CLI compatibility; the key is now measured per image
KEY_TOL = 30       # max off-axis deviation (relative) still counted as backdrop
# How far bleed() grows the key past certain backdrop, as a multiple of
# KEY_TOL. Keep this SMALL by default: it exists to clear glow-lit backdrop
# around a muzzle flash, and a wide setting happily walks into pale, neutral
# parts of the subject itself -- white plastic and grey studs sit about as far
# off the backdrop axis as lit backdrop does. The martian set needed 5.0 for
# its plasma coronas and has no pale areas; art with white or grey in it wants
# the default. Tune with --bleed and check the cutout.
WEAK = 2.0
MIRROR = False     # --mirror: flip art that came back facing left

def bleed(strong, weak):
    """Grow the key outward from certain backdrop into merely backdrop-ish pixels.

    A muzzle flash or any bright glow lights the backdrop around it, lifting
    those pixels off the backdrop colour enough to survive the key -- leaving a
    hot magenta cloud with a torn edge around the effect. Those pixels are
    always CONNECTED to real backdrop, so growing the mask through them clears
    the cloud. This style outlines every shape in dark navy, which is nowhere
    near the backdrop colour, so the growth stops at the character's own edge
    and the purple cape behind it is never reached."""
    out = strong.copy()
    frontier = strong
    while True:
        nxt = np.zeros_like(out)
        nxt[1:, :] |= frontier[:-1, :]
        nxt[:-1, :] |= frontier[1:, :]
        nxt[:, 1:] |= frontier[:, :-1]
        nxt[:, :-1] |= frontier[:, 1:]
        frontier = nxt & weak & ~out
        if not frontier.any():
            return out
        out |= frontier

def green_alpha(arr):
    """Chroma-key the backdrop.

    The key colour MUST NOT dominate the character: a green alien on a green
    screen loses ~74% of its own body. Green art is therefore shot against
    magenta, and magenta/purple art against green.

    An accent can still collide with the key even when the body does not -- the
    green king wears a PURPLE cape, and a fixed "is it pinkish" threshold eats
    60% of it. So the backdrop colour is measured from this image's own border
    and every pixel is tested against THAT colour: project the pixel onto the
    backdrop colour and measure how far off the line it lands. Cape purple is
    not a dimmed magenta -- it carries green the backdrop has none of -- so it
    sits well off the line. The residual is divided by the projection because a
    dark pixel's deviation is proportionally small; without that, shadowed cape
    reads as distant backdrop. Measuring per image also absorbs the vignetted,
    dimmer backdrops some generations come back with."""
    a = arr[:, :, :3].astype(np.float64)
    border = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
                             a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    bgc = np.median(border, axis=0)
    k = (a * bgc).sum(axis=2) / max((bgc * bgc).sum(), 1e-6)
    kc = np.clip(k, 0.05, None)
    rel = np.linalg.norm(a - kc[..., None] * bgc, axis=2) / kc
    bg = (rel < KEY_TOL) & (k > 0.30) & (k < 1.45)
    # Glow-lit backdrop is BRIGHT (k near 1, it is the backdrop plus light); the
    # purple cape is dark (k well under 0.8). Restricting the bleed to bright
    # pixels clears the corona without reaching the cape behind the figure.
    bg = bleed(bg, (rel < KEY_TOL * WEAK) & (k > 0.82))
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    # despill: pull the backdrop's own hue out of surviving fringe pixels
    spill = (~bg) & (rel < KEY_TOL * 2.2) & (k > 0.30)
    mix = np.clip((KEY_TOL * 2.2 - rel) / (KEY_TOL * 1.2), 0, 1)[..., None]
    neutral = a.mean(axis=2, keepdims=True)
    arr[:, :, :3] = np.where(spill[..., None],
                             (a * (1 - mix * 0.65) + neutral * (mix * 0.65)),
                             a).astype(arr.dtype)
    return alpha

def main_green(src, prefix, inset=14):
    im = Image.open(src).convert('RGB')
    W, H = im.size
    arr = np.asarray(im).astype(np.int16).copy()
    fw, fh = W // 2, H // 2
    crops = []
    for r in range(2):
        for c in range(2):
            fa = arr[r*fh+inset:(r+1)*fh-inset, c*fw+inset:(c+1)*fw-inset].copy()
            alpha = green_alpha(fa)
            crops.append(tighten(Image.fromarray(np.dstack([fa.astype(np.uint8), alpha]), 'RGBA')))
    s = fit_scale(crops)
    for idx, crop in enumerate(crops):
        check_against_idle(f'{prefix}-{idx}', place(crop, s, f'{prefix}-{idx}'))

def single_green(src, name):
    arr = np.asarray(Image.open(src).convert('RGB')).astype(np.int16).copy()
    alpha = green_alpha(arr)
    finish(Image.fromarray(np.dstack([arr.astype(np.uint8), alpha]), 'RGBA'), name)

if __name__ == '__main__':
    if '--key' in sys.argv:
        i = sys.argv.index('--key')
        KEY = sys.argv[i + 1]
        del sys.argv[i:i + 2]
    if '--set' in sys.argv:
        i = sys.argv.index('--set')
        OUT_DIR = f'public/pieces/{sys.argv[i + 1]}'
        del sys.argv[i:i + 2]
    if '--canvas' in sys.argv:
        # A set whose poses are wide (a shouldered cannon, a lance, a mount)
        # needs a wider canvas, or fit_scale shrinks the figure to fit and the
        # piece changes size between idle and animation.
        i = sys.argv.index('--canvas')
        CANVAS = tuple(int(v) for v in sys.argv[i + 1].lower().split('x'))
        del sys.argv[i:i + 2]
    if '--bleed' in sys.argv:
        i = sys.argv.index('--bleed')
        WEAK = float(sys.argv[i + 1])
        del sys.argv[i:i + 2]
    if '--mirror' in sys.argv:
        MIRROR = True
        sys.argv.remove('--mirror')
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
