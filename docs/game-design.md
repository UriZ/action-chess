# Action Chess — Game Design

Battle-Chess-style web chess: real chess underneath, painted animated Templars on top.
This document is opinionated on purpose — every section ends in a recommendation.
The duel demo (`public/duel-demo.html`) is the proof-of-feel this design scales up.

---

## 1. Architecture: logic and theater never mix

Two layers, one rule: **the game is always ahead of the animation.**

```
┌────────────────────────────────────────────────────────┐
│ LOGIC (authoritative, instant)                         │
│  chess.js — legal moves, check, mate, FEN              │
│  stockfish.wasm — in a Web Worker, never on UI thread  │
│  Applies moves IMMEDIATELY. Emits MoveEvents.          │
└──────────────┬─────────────────────────────────────────┘
               │  queue of MoveEvents
               │  {move, captured?, special?, check?}
┌──────────────▼─────────────────────────────────────────┐
│ PRESENTATION (theater, replayable, skippable)          │
│  Consumes events one at a time, plays them as scenes.  │
│  Owns sprites, frames, sfx, camera, particles.         │
└────────────────────────────────────────────────────────┘
```

Consequences, all deliberate:

- **Input is never blocked.** The board state is already final when the
  animation starts, so the player can select their next piece, see legal
  squares, even queue their reply while the theater plays. A tap fast-forwards
  the current scene. "Instant" mode just drains the queue with no scenes.
- **Stockfish thinks during the player's animation.** The engine gets the new
  FEN the moment the player's move is applied — by the time the player's piece
  finishes walking, the AI reply is usually already queued. Perceived AI
  latency ≈ zero.
- **Replays and skips are free.** The queue is just data; play it at any speed.

`duel-demo.html` transplants almost verbatim: `makePiece()` becomes the piece
sprite factory (idle/walk/attack/death frame sets, facing, breathing class),
`capture()` becomes the capture scene, `walkBy()` the quiet-move scene. The
demo's synth sfx module, dust/ember particles, camera push-in, and shake move
over unchanged. What's new is only the **scene scheduler** that feeds them from
the MoveEvent queue and a **board coordinate system** replacing free x-positions.

## 2. Board presentation: 3/4 top-down, side-view actors

Straight side view (like the demos) cannot show an 8×8 grid — ranks hide each
other completely. Recommendation: **the classic Battle Chess stage** —

- Board drawn in a mild 3/4 top-down perspective: each rank is a row of
  slightly flattened tiles, back ranks higher on screen and ~12% smaller
  (subtle scale gradient sells depth without real 3D math).
- Pieces are **bottom-anchored billboards** standing on their tiles: idle =
  front-facing portrait, moving/attacking = the side-view frames, flipped by
  horizontal direction. Vertical and diagonal moves also use the side-view walk
  along the actual path — a stylization Battle Chess used; nobody blinks.
- **Y-sorting by rank** (then by animation state so an active piece draws over
  idle neighbors). Pieces are taller than tiles and overlap the row behind —
  that overlap is what makes the army look dense and alive; y-sorting keeps it
  readable.

Sizing (design canvas, then scaled):

- Tile: 110×78 px (flattened). Board ≈ 880×624 plus margins.
- Piece heights on the size hierarchy: pawn ~150 px, rook/bishop/knight ~175,
  queen/king ~195 (≈2.2 tiles tall — dramatic but tested in the duel demo).
- Desktop landscape: board centered, ~75vh, side panel for captured pieces,
  move list, controls.
- Mobile portrait: board is full width (tile ≈ 12vw), controls below, captured
  pieces as a compact strip. Tap targets = whole tile, minimum 44 px. No hover
  dependence anywhere; selection is tap-tap (drag optional later).

## 3. Chess actions → scenes

| Chess event | Scene |
|---|---|
| Quiet move | Piece turns (flip), walk frames along the real path (knight walks its L), footsteps + dust per contact frame, settle, return to idle portrait |
| Capture | Attacker walks to striking range on the victim's tile, ready→wind-up (held beat)→strike with clang/shake/camera push→victim plays its 4 death frames, lies a beat, dissolves to embers → attacker steps onto the square |
| Castling | King and rook walk **simultaneously**, crossing paths — a tiny parade moment |
| En passant | Capture scene, but the victim pawn dies on its own square while the attacker lands behind it — the "wait, what?" teaching moment, worth a slight pause |
| Promotion | Pawn reaches last rank → picker overlay (auto-queen toggle in settings) → white flash + ember burst, pawn idle swaps to the chosen piece's idle, scale-pop |
| Check | The threatened king's root flashes, small recoil shake + a low horn sting; attacker's square glows briefly |
| Checkmate / stalemate | Short finale: camera pushes to the losing king, vignette closes, king plays death frames (mate) or bows (stalemate), victory banner in the ink style |

## 4. Pacing — hard budgets, not vibes

Battle Chess died of slowness by move 15. These are constraints, not wishes:

- Quiet move ≤ **1.0 s** (walk speed scales with distance; a queen crossing the
  board takes barely longer than a pawn step).
- Capture ≤ **2.5 s** end to end (the duel demo's capture, tightened).
- Specials ≤ 3 s; checkmate finale ≤ 5 s, skippable.
- **Speed setting**: Normal (above) / Fast (~55% durations, held beats cut
  hardest) / Instant (no scenes, pieces teleport, sfx only).
- **Tap-to-skip** the current scene at any time; skipping never desyncs because
  the logic layer already moved.

## 5. Tech decisions

**Drop Phaser. Ship DOM + WAAPI.** Honest assessment: both demos are
DOM + Web Animations API and they already deliver the exact feel we want —
frame animation, particles, camera push, shake, hit-stop — at 60fps with ~40
elements. An 8×8 board with 32 image sprites is trivially within DOM budget.
Phaser would add ~1.2 MB, its own loader/scene/input idioms, and force porting
the proven duel code for zero visible gain. The engine earns its keep at
hundreds of sprites or shader effects; we're not there, and we can revisit if a
feature demands it. (Phaser stays in package.json until the board works, then
gets removed.)

- **Loader contract**: `public/pieces/<color>-<piece>.png` (idle) and
  `<color>-<piece>-<action>-<n>.png` (n = 0..3; action = walk|attack|death).
  The existing white frames are unprefixed (`pawn-walk-0.png`) — rename to
  `white-…` when the black army lands; one loader map, preloaded at boot with
  a tiny loading screen (78 × 2 files ≈ 20 MB — show progress, cache hard).
- **Audio**: extend the WebAudio synth module (footsteps per piece weight,
  clang/thud, horn stings for check/mate, ambient wind). No audio files.
- **State/UI**: vanilla TypeScript modules + the existing Vite setup. No
  framework — the UI is a board, a side panel, and a settings sheet. A
  reactive lib buys nothing at this scope.
- **Engine**: `chess.js` (installed) + `stockfish` WASM worker with a skill
  slider (Skill Level 0–20 → "Squire / Knight / Crusader / Grandmaster").

## 6. Milestones to playable v1

1. **M1 — Real chess, instant pieces.** Board render, tap-move with legal
   highlights, chess.js rules, idle portraits only (no scenes). Playable
   hot-seat in an evening.
2. **M2 — The theater.** Scene scheduler + walk/capture scenes transplanted
   from the duel demo, sfx, speed settings, tap-to-skip.
3. **M3 — The opponent.** Stockfish worker, difficulty slider, AI move pacing
   (thinks during your animation).
4. **M4 — Specials & drama.** Castling, en passant, promotion picker, check
   reaction, checkmate finale.
5. **M5 — Polish.** Mobile portrait pass (run the mobile-web-test skill),
   loading screen, captured-pieces panel, menus in the ink style, black-army
   file rename.

Each milestone is independently playable; animation (the risk) never blocks
chess (the game).

## Open questions for Uri

1. **Capture staging**: keep the fight ON the board tiles (zoom-in like the
   duel demo), or cut away to a full-screen duel panel, Battle Chess style?
   On-board is cheaper and keeps context; cut-away is more cinematic.
2. **First target**: desktop-landscape first with a mobile pass at M5, or
   mobile-portrait first? (Affects tile/piece sizing defaults.)
3. **v1 opponent**: Stockfish only, or also a local 2-player hot-seat toggle
   (nearly free at M1)?
4. **Promotion default**: auto-queen with a settings opt-in for the picker, or
   always show the picker?
5. **Sound**: keep the synthesized sfx aesthetic for v1, or budget for real
   recorded medieval sfx/music later?
