/** Piece art contract and display-scale ratios.
 *  Ratios come from .claude/skills/piece-forge/SKILL.md § Display-scale contract.
 *  Scale is presentation only — the art itself is uniformly normalised. */

export type PieceKey = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export type Side = 'w' | 'b';

const NAME: Record<PieceKey, string> = {
  p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king',
};

/** height as a fraction of one tile's "piece height" budget, plus aspect */
export const SCALE: Record<PieceKey, { h: number; aspect: number; heavy: boolean }> = {
  p: { h: 0.85, aspect: 240 / 340, heavy: false },
  r: { h: 0.90, aspect: 265 / 360, heavy: true },
  n: { h: 1.00, aspect: 350 / 400, heavy: true },
  b: { h: 0.925, aspect: 255 / 370, heavy: false },
  q: { h: 0.96, aspect: 265 / 385, heavy: false },
  k: { h: 1.00, aspect: 285 / 400, heavy: true },
};

export const pieceName = (k: PieceKey) => NAME[k];
export const sideName = (s: Side) => (s === 'w' ? 'white' : 'black');

/** Assets must be addressed relative to the deploy base: a GitHub project
 *  page is served from /<repo>/, where a leading-slash path would 404. */
const BASE = import.meta.env.BASE_URL;

export const idleSrc = (s: Side, k: PieceKey) =>
  `${BASE}pieces/${sideName(s)}-${NAME[k]}.webp`;

export const frameSrc = (s: Side, k: PieceKey, action: 'walk' | 'attack' | 'death', n: number) =>
  `${BASE}pieces/${sideName(s)}-${NAME[k]}-${action}-${n}.webp`;

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
