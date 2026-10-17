# Art Prompt Kit — Templar Chess

Generation kit for the 12 piece paintings (6 piece types × 2 factions).
Target look: the grayscale painterly/ink Templar references — grim, moonlit,
near-monochrome with the cross as the only strong color. The in-repo mockup
(`public/art-preview.html`) shows the composition, palette, and proportions
every generated piece must match.

## How to use

1. Generate with any strong image model (Midjourney, DALL-E, Imagen, SDXL).
2. Always paste the **style block** + one **piece prompt** + the **negative block**.
3. Generate 4+ candidates per piece; pick for silhouette readability first, beauty second.
4. Run the post-processing checklist at the bottom before dropping files into `public/pieces/`.

---

## Global style block (append to every prompt)

> full-body medieval crusader character, front-facing symmetrical stance,
> dark fantasy ink and wash illustration with painterly grayscale shading,
> near-monochrome palette of steel gray, bone white and deep shadow,
> heavy battle-worn armor with scratches and grime, tattered cloth edges,
> dramatic moonlit rim lighting from behind, high contrast chiaroscuro,
> the only saturated color is the heraldic cross on the surcoat,
> solid flat dark background, character fully visible head to feet,
> feet planted on the ground at the bottom of the frame

## Negative block

> no photorealism, no anime, no bright colors, no busy background,
> no cropped limbs, no three-quarter view, no cartoonish proportions,
> no text, no watermark, no frame

## Faction variants

- **White army**: "pristine white surcoat with a BLOOD-RED cross, silver-steel armor"
- **Black army**: "ash-gray tattered surcoat with a BLACK cross outlined in red, blackened dark steel armor"

Same prompt otherwise — the armies must read as one order, split by palette.

---

## The 12 pieces — casting and prompts

Silhouette is king: a chess player must identify the piece at a glance.
Each piece gets one distinguishing shape feature, listed in CAPS.

### Pawn — footman
> young crusader footsoldier, SIMPLE ROUNDED KETTLE HELM with wide brim,
> short surcoat over chainmail, SPEAR held vertically in one hand and a small
> round buckler in the other, slightly smaller and leaner than a knight

### Rook — tower guardian
> colossal heavily-armored crusader juggernaut, MASSIVE TOWER SHIELD covering
> half his body held front and center, squat wide stance, helm with flat
> crenellated top like a castle tower, broad as a wall, heaviest armor of all

### Knight — rider
> crusader knight on an ARMORED WARHORSE rearing slightly, horse wearing
> heraldic cloth barding with the cross, rider holding a lance angled upward,
> the only mounted figure in the set

### Bishop — warrior-monk
> gaunt crusader warrior-monk, HOODED COWL over a faceless shadow instead of
> a helm, long robes over mail, holding a tall CROZIER STAFF topped with a
> cross, censer chain at his belt, taller and thinner than the knights

### Queen — battle maiden
> regal armored queen, SLENDER CROWN over a mail coif, long flowing cloak,
> wielding a pair of elegant curved swords OR one great flaming sword raised,
> the most elegant and lethal silhouette of the set, tall and commanding

### King — the lord
> ancient crusader king, CROWN RING mounted on his great helm, both gauntlets
> resting on the pommel of a massive GREATSWORD PLANTED point-down before him,
> immense fur-trimmed cloak, the full moon directly behind his head like a halo,
> immovable and monumental

---

## Technical spec (hard requirements)

| Property | Value |
|---|---|
| Aspect | 2:3 portrait (e.g. 1024×1536) |
| Framing | full body, ~8% margin above head, feet near bottom edge |
| Background | solid flat dark — removable; no gradients touching the figure |
| Pose | front-facing, symmetric or near-symmetric, weight on both feet |
| Light | single key light from above/behind (the moon), consistent across ALL 12 |

## Post-processing checklist (per image)

1. Remove background → transparent PNG.
   (Proven shortcut: ChatGPT's image model outputs real alpha if you follow up with
   "same character, fully transparent background" — the white King was made this way.)
2. Trim to content + 10px padding.
3. Scale so the figure (feet→crown) is **820px tall** on a 640×1000 canvas —
   except Pawn at **700px** and King/Queen at **880px** (size hierarchy).
4. Bottom-center the feet at y=960 (the rig's ground line).
5. Name: `white-pawn.png`, `black-knight.png`, … → `public/pieces/`.
6. Side-by-side check: line all 12 up — same light direction, same ink density,
   silhouettes distinguishable in pure black. Any piece that fails gets regenerated,
   not photoshopped.

## Consistency tricks

- Generate all 12 in ONE session/model version; seeds drift across versions.
- Midjourney: generate the King first, then use it as a style reference
  (`--sref <king url>`) for the other 11.
- If a model fights the monochrome, add "limited palette, duotone ink drawing,
  selective color" and raise stylization weight.
- The cross must appear on EVERY piece somewhere (chest, shield, banner, staff) —
  it is the faction mark.
- Frame sheets per piece: generate in Gemini (attach base PNG, ask for 4-frame 2x2 sheet, side view), download, then: python3 tools/slice-sheet.py <sheet.jpg> <piece>-walk
