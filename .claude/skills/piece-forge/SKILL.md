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
3. **Chroma screen, always**: every prompt demands a SOLID FLAT background in a key
   colour. Never ask for "transparent" — the model paints a fake checkerboard that
   cannot be removed reliably (we lost hours to this).
   **Pick the key against the palette, including accents.** The key must not appear
   anywhere on the character: a green alien on green loses 74% of its body, and a
   green king's PURPLE CAPE on magenta loses 60% of the cape. Green art → magenta
   screen (`--key magenta`); magenta/purple art → green. If one army needs both,
   change the accent (cape, trim) rather than fighting it in post.
   Also demand the backdrop be **flat and UNLIT**: "glows, muzzle flashes and energy
   effects must not spill, bloom or cast light onto the background; keep effects
   tight inside crisp outlines, cyan and white only." A blast lights the backdrop
   around it and leaves a coloured corona the key cannot cleanly separate.
4. **Per piece, 4 generations** (idle → walk → attack → death). Idle is front-facing
   full body for humanoids; side view for the mounted/vehicle knight.
   Phrase the grid as QUADRANTS, not "a 2x2 sheet" — "a SQUARE image divided into
   EXACTLY 4 equal quadrants: top-left, top-right, bottom-left, bottom-right, with
   EXACTLY ONE <piece> per quadrant, four total." Asking for "4 frames in a 2x2
   grid" reliably produces 3 across the top and 2 figures per bottom cell.
   Then: "SIDE VIEW facing RIGHT, whole character fully inside its own quadrant with
   margin, same character size in all four, same ground line, no text."
   Beats: walk = contact/down/passing/up; attack = ready / wind-up / strike /
   follow-through; death = struck / stagger / collapse / lying flat with weapon
   fallen beside. Spell out the leg position per beat, and add "the LEGS MUST
   ACTUALLY CHANGE POSITION between quadrants" or you get one pose four times.
   **Facing**: the renderer mirrors a sprite by travel direction, so every asset
   must face RIGHT. The generator ignores this about half the time and will even
   draw a piece's idle and its walk facing opposite ways. Check each sheet against
   that piece's idle and pass `--mirror` to whichever disagrees — a weapon on the
   wrong side fires backwards out of the frame.
   Download each image via the hover download icon at the image's top-right (hover
   first; icon ≈ (1223, y) at 1512px viewport). Verify the file is actually new —
   clicking a stale position silently opens Gemini's image editor instead, and
   `ls -t | head -1` then re-copies the PREVIOUS download.
5. **Process** (from repo root; downloads land in `~/Downloads/Gemini_Generated_Image_*.jpeg`):
   ```bash
   cp "$(ls -t ~/Downloads/Gemini_Generated_Image_* | head -1)" art/<set>/<piece>-<what>.jpg
   python3 tools/slice-sheet.py --set <set> --canvas <WxH> [--mirror] \
     --green-single art/<set>/<piece>-idle.jpg <color>-<piece>              # portraits
   python3 tools/slice-sheet.py --set <set> --canvas <WxH> [--mirror] \
     --green art/<set>/<piece>-<action>-sheet.jpg <color>-<piece>-<action>  # sheets
   ```
   The tool measures the backdrop colour from each image's own border and keys
   against that (so an accent that merely resembles the key survives, and vignetted
   backdrops still key), grows the key outward through BRIGHT backdrop-hued pixels
   to clear glow coronas, despills edges, inset-crops each quadrant by 14px (kills
   drawn divider lines), prunes stray components (bleed from neighbouring cells)
   while KEEPING detached art near the figure (dropped weapons beside a corpse,
   motion smears), and normalizes onto a shared canvas with a common ground line.
   **One scale per sheet**: all four frames share a scale derived from their
   combined extents, so the character does not pulse between frames. It also warns
   when a sheet's figure height drifts >12% from that piece's idle — the piece
   would visibly change size the moment it starts moving.
   **Canvas is per set** (`--canvas`). 760x1000 suits upright humanoids; poses that
   are much wider (a braced cannon, a lance, a mount) need more width or the figure
   gets shrunk to fit and ends up shorter than smaller pieces. This set uses
   1140x1000. A piece's display `aspect` in `src/pieces.ts` must match the canvas
   it was cut on, or the art is squeezed.
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

## Display-scale contract (presentation, not art)

Every frame is normalized to the same 760x1000 canvas, so ON-SCREEN size is set
purely by the renderer's piece table — never by regenerating art. The tuned
ratios (user-approved; keep for every style and both armies; source of truth is
`DEFS` in `public/army-demo.html`):

| Piece  | w x h (px @ demo scale) | height vs king |
|--------|-------------------------|----------------|
| Pawn   | 240 x 340               | 0.85           |
| Rook   | 265 x 360               | 0.90           |
| Knight | 350 x 400               | 1.00 (widest — mount needs the width) |
| Bishop | 255 x 370               | 0.925          |
| Queen  | 265 x 385               | 0.96           |
| King   | 285 x 400               | 1.00           |

Scale the whole table together for different boards/viewports; only the RATIOS
are the contract. If a piece looks off-scale, fix it here (one line), not in art.

## Fallback generator

ChatGPT (chatgpt.com, user's session) produces REAL alpha: generate, then follow up
"same character, fully transparent background". Free tier has a small daily image
quota — use for one-off portraits, not 24-asset runs.
