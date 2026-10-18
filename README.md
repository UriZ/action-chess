# Action Chess

**Real chess. Every move is a performance.**

Normal chess rules — but the pieces are painted crusader warriors who *walk* to
their square, and captures are fights: the attacker marches over, strikes, and
the loser plays a four-frame death before dissolving into embers.

![Both armies](docs/images/armies.jpg)

Every piece has a real four-frame walk — these are animation frames, not a
picture being slid across the board:

![Walk cycle](docs/images/walk-cycle.jpg)

Attacks land with a wind-up, a strike, and a follow-through:

![Attack sequence](docs/images/attack-sequence.jpg)

…and the loser actually dies:

![Death sequence](docs/images/death-sequence.jpg)

---

## Status

| Part | State |
|---|---|
| Art pipeline (AI generation → game-ready PNGs) | ✅ done, reusable |
| White army — 6 pieces × (idle + walk/attack/death) | ✅ done |
| Black army | 🟡 5 of 6 pieces (knight + king frames pending) |
| Interaction demos | ✅ done |
| The actual chess game | ⬜ designed, not built |

Nothing here is a mockup: open any demo and the pieces really animate.

## Try it

```bash
npm install
npx vite --port 5179
```

| Page | What it shows |
|---|---|
| `/army-demo.html` | The whole white army on one stage — click a piece, then Walk / Attack / Death / March All |
| `/duel-demo.html` | Two pieces fighting: "X takes Y" plays the full capture choreography |
| `/king-demo.html` | One piece, every animation, isolated |
| `/art-preview.html` | The art-direction target |

## How the art is made

The pieces are AI-generated, but the *pipeline* is the real asset — and it is
**style-agnostic**. Ask for a Transformers army or a manga army and the same
machinery produces a complete, coherent set.

```
Gemini (style-anchored chat)          tools/slice-sheet.py           public/pieces/
┌──────────────────────────┐         ┌──────────────────┐          ┌──────────────┐
│ idle portrait            │  green  │ chroma-key green │  trans-  │ <color>-     │
│ walk  sheet (2x2, 4 fr)  │ ──────► │ inset cell edges │ ──────►  │ <piece>-     │
│ attack sheet             │  screen │ prune bleed      │  parent  │ <action>-N   │
│ death sheet              │         │ normalize+anchor │   PNGs   │ .png         │
└──────────────────────────┘         └──────────────────┘          └──────────────┘
```

Two hard-won rules are baked in:

1. **Never ask the model for a transparent background.** It paints a *fake*
   checkerboard that no detector can cleanly separate from white cloth. Ask for
   a solid green screen and chroma-key it — flawless every time.
2. **Demand "fully inside its cell."** Otherwise weapons cross cell borders and
   get sliced in half, or bleed a severed tip into the neighbouring frame.

`tools/faction-tint.py` then pushes the black army to a near-black palette while
keeping the red cross glowing, so the two sides are unmistakable on the board
(black army median luminance 22–29 vs white's 112–129).

### Regenerating / restyling

```bash
# the skill drives the whole flow, style is injected
/piece-forge Transformers-style boxy robots, glowing faction insignia
```

See `.claude/skills/piece-forge/` — the casting table is **role-based**
(rook = widest unit with a massive defensive feature; knight = the only mounted
unit; …), so any theme maps onto it without losing chess readability.

## The game

Designed in [`docs/game-design.md`](docs/game-design.md) — read the TL;DR and
the move-flow diagram there. Core decisions:

- **chess.js is authoritative and instant**; animation is a replay queue that can
  be skipped, sped up, or turned off. The game never waits for the show.
- **Stockfish** (free, runs in-browser via WebAssembly) in a Web Worker — it
  thinks *while* your piece is still walking.
- **Plain DOM + Web Animations**, no game engine. The demos prove the feel.
- **Hard pacing budgets**: quiet move ≤ 1s, capture ≤ 2.5s.

## Layout

```
public/pieces/     game-ready transparent PNGs (the asset contract)
public/*.html      live demos
tools/             slice-sheet.py (extraction), faction-tint.py (palette)
art/generated/     raw AI output, kept so everything is re-derivable
docs/              game design
.claude/skills/    piece-forge — the reusable art pipeline
```

## Credits

Art generated with Google Gemini; pipeline, tooling, animation and design built
with [Claude Code](https://claude.com/claude-code).
