/** Piece art contract and display-scale ratios.
 *  Ratios come from .claude/skills/piece-forge/SKILL.md § Display-scale contract.
 *  Scale is presentation only — the art itself is uniformly normalised. */

export type PieceKey = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type Side = 'w' | 'b';

const NAME: Record<PieceKey, string> = {
  p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king',
};

export type PieceScale = { h: number; aspect: number; heavy: boolean };

/** One art set: where its files live, what the two armies are called, and how
 *  big each piece draws.
 *
 *  `aspect` must match the canvas the art was cut on (see --canvas in
 *  slice-sheet.py) or the sprite is stretched. The sets differ: the Templars
 *  are upright humanoids on a 760x1000 canvas, while the Martians needed
 *  1140x1000 to fit a braced cannon and a saucer mount without shrinking the
 *  figure. `h` stays a fraction of the tile's piece-height budget either way,
 *  so the relative sizes of the six roles survive the change of set. */
export type PieceSet = {
  id: string;
  label: string;
  dir: string;                       // under public/pieces/
  sides: Record<Side, string>;       // folder-name prefix per army
  scene: 'templar' | 'martian';      // which background the board stands in
  emblem: string;                    // shown beside the title in the header
  scale: Record<PieceKey, PieceScale>;
};

const TEMPLAR_AR = 760 / 1000;
const MARTIAN_AR = 1140 / 1000;

export const SETS: Record<string, PieceSet> = {
  templar: {
    id: 'templar',
    label: 'Templars',
    dir: '',
    sides: { w: 'white', b: 'black' },
    scene: 'templar',
    emblem: '✠',
    scale: {
      p: { h: 0.85,  aspect: 240 / 340, heavy: false },
      r: { h: 0.90,  aspect: 265 / 360, heavy: true },
      n: { h: 1.00,  aspect: 350 / 400, heavy: true },
      b: { h: 0.925, aspect: 255 / 370, heavy: false },
      q: { h: 0.96,  aspect: 265 / 385, heavy: false },
      k: { h: 1.00,  aspect: 285 / 400, heavy: true },
    },
  },
  martian: {
    id: 'martian',
    label: 'Martians',
    dir: 'martian/',
    sides: { w: 'green', b: 'purple' },
    scene: 'martian',
    emblem: '🛸',
    // Every martian frame is normalised to the same figure height on one wide
    // canvas, so the aspect is just the canvas aspect — no per-piece squeeze.
    //
    // The spread is wider than the Templars' on purpose. These are chibi
    // figures whose heads are half their height, so a pawn's bubble helmet
    // reads as mass no matter how short the piece is: at the Templar ratios
    // (pawn 0.85, king 1.00) the king came out 4% taller on screen and the
    // pawns looked like the biggest thing on the board. Pulling the pawn down
    // and holding the king up restores the rank order by eye. Everything is
    // also scaled down ~8%, because a wide stance on a 1.14 canvas crowds its
    // neighbours at the Templars' sizes.
    scale: {
      p: { h: 0.52, aspect: MARTIAN_AR, heavy: false },
      r: { h: 0.74, aspect: MARTIAN_AR, heavy: true },
      n: { h: 0.82, aspect: MARTIAN_AR, heavy: true },
      b: { h: 0.80, aspect: MARTIAN_AR, heavy: false },
      q: { h: 0.86, aspect: MARTIAN_AR, heavy: false },
      k: { h: 0.93, aspect: MARTIAN_AR, heavy: true },
    },
  },
};

void TEMPLAR_AR;

let current: PieceSet = SETS.templar;

export const activeSet = () => current;
export function setPieceSet(id: string) {
  current = SETS[id] ?? SETS.templar;
}

/** height as a fraction of one tile's "piece height" budget, plus aspect */
export const SCALE = new Proxy({} as Record<PieceKey, PieceScale>, {
  get: (_t, k: string) => current.scale[k as PieceKey],
});

export const pieceName = (k: PieceKey) => NAME[k];
export const sideName = (s: Side) => current.sides[s];

/** Assets must be addressed relative to the deploy base: a GitHub project
 *  page is served from /<repo>/, where a leading-slash path would 404. */
const BASE = import.meta.env.BASE_URL;

export const idleSrc = (s: Side, k: PieceKey) =>
  `${BASE}pieces/${current.dir}${sideName(s)}-${NAME[k]}.webp`;

export const frameSrc = (s: Side, k: PieceKey, action: 'walk' | 'attack' | 'death', n: number) =>
  `${BASE}pieces/${current.dir}${sideName(s)}-${NAME[k]}-${action}-${n}.webp`;

export const allFrames = (s: Side, k: PieceKey) => {
  const out = [idleSrc(s, k)];
  for (const a of ['walk', 'attack', 'death'] as const)
    for (let n = 0; n < 4; n++) out.push(frameSrc(s, k, a, n));
  return out;
};

/** warm the browser cache so the first move never stutters */
export function preloadAll() {
  const sides: Side[] = ['w', 'b'];
  const keys: PieceKey[] = ['p', 'r', 'n', 'b', 'q', 'k'];
  for (const s of sides)
    for (const k of keys)
      for (const src of allFrames(s, k)) {
        const im = new Image();
        im.src = src;
      }
}
