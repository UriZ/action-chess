---
name: piece-forge
description: Generate or restyle the full animated chess piece art set (idle + walk/attack/death frames for all 6 pieces) in ANY injected visual style via the user's logged-in Gemini + the green-screen slicing pipeline. Use when asked to "generate chess piece art", "restyle the pieces", "build a new piece set", "make a <style> themed army", or to regenerate/fix a single piece or action sheet.
---

# piece-forge — style-agnostic chess piece art pipeline

Produces game-ready transparent PNGs in `public/pieces/`: one idle portrait per piece
plus 4-frame walk / attack / death sheets, all in ONE consistent art style that is
**injected as an argument**, e.g.:

- `/piece-forge grayscale ink-and-wash painterly crusaders, red cross as the only color` (the original set)
- `/piece-forge Transformers-style boxy robots, glowing blue optics, faction insignia accent`
- `/piece-forge manga heroes, clean screentone shading, one accent color`

The STYLE changes; the ROLES, the workflow, the technical constraints, and the file
contract below never do.

## Inputs

1. **STYLE_BLOCK** (required, from the user's words): 1–3 sentences describing the
   rendering style + the single accent color/marking. Used verbatim in every prompt.
2. **FACTION** (default: the "white" army): palette/marking variant. Two armies must
   read as one order split by palette, e.g. `white = pristine {accent} marking`,
   `black = blackened/ash variant, inverted marking`. Ask the user only if they want
   both armies now and haven't said how to split them.
3. Scope (default: all 6 pieces × 4 assets): may be a single piece or single sheet
   (e.g. "regenerate the rook attack").

## Role-based casting (invariant across styles)

Chess readability rules: every piece must be identifiable by SILHOUETTE alone.
Cast each role *within* the injected style — never carry over medieval theming:

| Piece  | Size rank | Silhouette invariant (must survive any style)         | Tool/weapon slot      | Personality   |
|--------|-----------|-------------------------------------------------------|-----------------------|---------------|
| Pawn   | smallest  | simple rounded headgear, light frame, legs visible    | polearm + small shield| young, plain  |
| Rook   | widest    | massive defensive feature covering half the body; flat crenellated/tower-like top | heavy blunt weapon | immovable wall|
| Knight | only MOUNTED/vehicle unit | rider + steed (or bike/mech-steed in non-medieval styles) | lance/ranged spike | swift, dynamic|
| Bishop | tallest-thin | hooded/faceless or masked head, long robes/coat     | tall staff with emblem| ominous mystic|
| Queen  | 2nd tallest | crown/crest over an elegant lethal frame, flowing cloak | one elegant blade   | regal, fast   |
| King   | tallest/bulkiest | crown/crest on heavy head, both hands resting on a planted greatsword-analog, immense cloak | planted two-hander | monumental    |

The accent marking (cross/insignia/logo per STYLE_BLOCK) must appear on EVERY piece.

## Proven workflow (execute in this order)

Full prompt templates with `{STYLE_BLOCK}` / `{FACTION}` / per-piece slots:
see [prompts.md](prompts.md) in this directory. Key mechanics:

1. **Driver**: the user's logged-in Gemini at gemini.google.com in Chrome, via the
   claude-in-chrome tools (load them via ToolSearch in ONE call). Note: Gemini Apps
   Activity may be off — chats are LOST on navigation, so finish a piece's 4 assets
   before leaving the chat, and re-anchor with an uploaded image if the chat is lost.
2. **Anchor first**: in a new chat, generate the KING idle from `prompts.md` §King —
   or, when restyling, upload the existing anchor (`public/pieces/white-king.png`)
   via the hidden `<input type=file>`: click "Upload & tools" (+) in the composer,
   `read_page filter=all` to find `button ... type="file"` refs, then `file_upload`
   with that ref. NEVER click "Upload files" itself — it opens a native picker that
   wedges the session. All later prompts in the chat inherit the style.
3. **Green screen, always**: every prompt demands a SOLID FLAT PURE GREEN (#00FF00)
   background. Never ask for "transparent" — the model paints a fake checkerboard
   that cannot be removed reliably (we lost hours to this).
4. **Per piece, 4 generations** (idle → walk → attack → death). Idle is front-facing
   full body for humanoids; side view for the mounted/vehicle knight. Each action
   sheet: "exactly 4 frames arranged 2x2, equal cells, SIDE VIEW facing right,
   whole character fully inside each cell (nothing touching cell borders or image
   edges), consistent scale, one ground line, solid green background, no text."
   Beats: walk = contact/down/passing/up; attack = ready / wind-up / strike /
   follow-through; death = struck / stagger / collapse / lying flat with weapon
   fallen beside. Download each image via the hover download icon at the image's
   top-right (hover first; icon ≈ (1223, y) at 1512px viewport).
5. **Process** (from repo root; downloads land in `~/Downloads/Gemini_Generated_Image_*.jpeg`):
   ```bash
   cp "$(ls -t ~/Downloads/Gemini_Generated_Image_* | head -1)" art/generated/<piece>-<what>.jpg
   python3 tools/slice-sheet.py --green-single art/generated/<piece>-idle.jpg <color>-<piece>   # portraits
   python3 tools/slice-sheet.py --green art/generated/<piece>-<action>-sheet.jpg <piece>-<action> # sheets
   ```
   The tool chroma-keys green (+despill on edges), inset-crops each 2x2 cell by 14px
   (kills drawn divider lines), prunes stray components (bleed from neighboring
   cells) while KEEPING detached art near the figure (dropped weapons beside a
   corpse, motion smears), normalizes every frame onto a 760x1000 canvas with a
   common bottom ground line, and fits wide "lying" frames by width instead of height.
6. **QA every batch** — composite frames onto a dark background and LOOK at them:
   no holes in the figure, no green/checker remnants, no severed weapon fragments
   from neighbor cells, full weapons in frame, consistent character identity.
   Fixes: art clipped at a cell edge → regenerate that sheet with the "fully inside
   its cell, make the figure smaller if needed" line; a stray fragment the pruner
   kept (too near the figure) → one-off removal of that component from the PNG.

## File contract

- Idles: `public/pieces/<color>-<piece>.png` (e.g. `white-rook.png`)
- Frames: `public/pieces/<piece>-<action>-<0..3>.png` — **current, single-army layout**.
  ⚠ When the second army is generated, frames MUST become color-prefixed
  (`<color>-<piece>-<action>-<n>.png`) and `public/duel-demo.html`,
  `public/king-demo.html`, and the game's piece loader updated to match.
- Keep raw downloads in `art/generated/` for reprocessing.

## Fallback generator

ChatGPT (chatgpt.com, user's session) produces REAL alpha: generate, then follow up
"same character, fully transparent background". Free tier has a small daily image
quota — use for one-off portraits, not 24-asset runs.
