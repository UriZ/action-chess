/** Action Chess — wiring.
 *
 *  Logic (chess.js) is authoritative and instant. The board view is a replay
 *  queue. The engine starts thinking the moment a move is applied, so it is
 *  usually ready before the walk animation finishes. */

import './style.css';
import { Chess } from 'chess.js';
import { BoardView, type MoveEvent, type Speed } from './board';
import { Engine, TIERS, type Tier } from './engine';
import { preloadAll, type PieceKey, type Side } from './pieces';
import { sfx } from './sfx';

type Mode = 'ai' | 'hotseat';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar">
    <h1>Action Chess <b>✠</b></h1>
    <div class="controls">
      <label>Opponent
        <select id="mode">
          <option value="ai">Stockfish</option>
          <option value="hotseat">Hot-seat</option>
        </select>
      </label>
      <label id="tierWrap">Difficulty
        <select id="tier">
          ${Object.entries(TIERS).map(([k, v]) => `<option value="${k}">${v.label} — ${v.blurb}</option>`).join('')}
        </select>
      </label>
      <label>Speed
        <select id="speed">
          <option value="normal">Normal</option>
          <option value="fast">Fast</option>
          <option value="instant">Instant</option>
        </select>
      </label>
      <label>Play as
        <select id="side">
          <option value="w">White</option>
          <option value="b">Black</option>
        </select>
      </label>
      <label>Fight cam
        <select id="fightcam">
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
      </label>
      <button id="flip" title="Flip the board">Flip</button>
      <button id="mute" title="Mute sound">Sound: on</button>
      <button id="newgame">New game</button>
    </div>
  </header>
  <main id="stage"></main>
  <footer class="statusbar">
    <span id="status">White to move</span>
    <span id="enginenote"></span>
  </footer>
`;

const stage = document.querySelector<HTMLDivElement>('#stage')!;
const statusEl = document.querySelector<HTMLSpanElement>('#status')!;
const engineNote = document.querySelector<HTMLSpanElement>('#enginenote')!;

const game = new Chess();
const view = new BoardView(stage);
const engine = new Engine();

let mode: Mode = 'ai';
let humanSide: Side = 'w';
let selected: string | null = null;
let animating = false;
/** engine's reply is computed during the player's animation */
let pendingEngine: Promise<string | null> | null = null;

preloadAll();

/* ----------------------------------------------------------------- render */

function syncBoard() {
  view.setPosition(game.board() as any);
  refreshMarks();
}

function refreshMarks() {
  view.clearMarks();
  const h = game.history({ verbose: true }) as any[];
  const last = h[h.length - 1];
  if (last) view.markLast(last.from, last.to);
  if (game.inCheck()) {
    const turn = game.turn();
    for (const row of game.board())
      for (const cell of row)
        if (cell && cell.type === 'k' && cell.color === turn) view.markCheck(cell.square);
  }
  if (selected) {
    view.markSelected(selected);
    const moves = game.moves({ square: selected as any, verbose: true }) as any[];
    view.markLegal(moves.map(m => ({ to: m.to, capture: !!m.captured })));
  }
}

function setStatus(text: string) { statusEl.textContent = text; }

/** Explain a refusal for a moment, then fall back to the normal status.
 *  Silently ignoring an illegal click leaves the player guessing why. */
let hintTimer = 0;
function hint(text: string) {
  setStatus(text);
  statusEl.classList.add('hint');
  window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    statusEl.classList.remove('hint');
    setStatus(describeTurn());
  }, 2600);
}

function describeTurn() {
  if (game.isCheckmate()) return `Checkmate — ${game.turn() === 'w' ? 'Black' : 'White'} wins`;
  if (game.isStalemate()) return 'Stalemate — a draw';
  if (game.isInsufficientMaterial()) return 'Draw — insufficient material';
  if (game.isThreefoldRepetition()) return 'Draw — threefold repetition';
  if (game.isDraw()) return 'Draw';
  const who = game.turn() === 'w' ? 'White' : 'Black';
  const suffix = game.inCheck() ? ' — check!' : '';
  if (mode === 'hotseat') return `${who} to move${suffix}`;
  return (game.turn() === humanSide ? `Your move${suffix}` : `${who} is thinking…${suffix}`);
}

/* ------------------------------------------------------------- move event */

function toEvent(m: any): MoveEvent {
  const ev: MoveEvent = {
    from: m.from,
    to: m.to,
    piece: m.piece as PieceKey,
    color: m.color as Side,
    check: game.inCheck(),
    mate: game.isCheckmate(),
  };
  if (m.captured) {
    ev.captured = m.captured as PieceKey;
    // en passant: the victim stands on the mover's own rank, not on `to`
    ev.capturedSquare = m.flags.includes('e')
      ? m.to[0] + (m.color === 'w' ? Number(m.to[1]) - 1 : Number(m.to[1]) + 1)
      : m.to;
  }
  if (m.flags.includes('k') || m.flags.includes('q')) {
    const rank = m.color === 'w' ? '1' : '8';
    ev.castleRook = m.flags.includes('k')
      ? { from: 'h' + rank, to: 'f' + rank }
      : { from: 'a' + rank, to: 'd' + rank };
  }
  if (m.promotion) ev.promotion = m.promotion as PieceKey;
  return ev;
}

/* ------------------------------------------------------------ move driver */

async function applyAndAnimate(moveSpec: any): Promise<boolean> {
  let m: any;
  try {
    m = game.move(moveSpec);
  } catch {
    return false;
  }
  if (!m) return false;

  const ev = toEvent(m);

  // engine thinks WHILE we animate
  if (mode === 'ai' && game.turn() !== humanSide && !game.isGameOver()) {
    pendingEngine = engine.bestMove(game.fen());
  }

  selected = null;
  animating = true;
  setStatus(describeTurn());
  try {
    await view.play(ev);
  } catch (err) {
    // A failed animation must never strand the game: without this the
    // `animating` latch stays set and every later click is ignored, which
    // looks exactly like "I can't select or move anything".
    console.error('animation failed, recovering', err);
    view.hardReset();
  } finally {
    animating = false;
  }

  // keep view and logic in exact agreement after every move
  syncBoard();
  setStatus(describeTurn());

  if (game.isGameOver()) {
    showGameOver();
    return true;
  }

  if (mode === 'ai' && game.turn() !== humanSide) await takeEngineTurn();
  return true;
}

async function takeEngineTurn() {
  const promise = pendingEngine ?? engine.bestMove(game.fen());
  pendingEngine = null;
  setStatus(describeTurn());
  const uci = await promise;
  if (!uci) { setStatus(describeTurn()); return; }
  const spec = {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci[4] : 'q',
  };
  await applyAndAnimate(spec);
}

function showGameOver() {
  let main = 'Draw', sub = '';
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'Black' : 'White';
    main = `${winner} wins`;
    sub = 'Checkmate';
  } else if (game.isStalemate()) { main = 'Stalemate'; sub = 'No legal moves'; }
  else if (game.isInsufficientMaterial()) { main = 'Draw'; sub = 'Insufficient material'; }
  else if (game.isThreefoldRepetition()) { main = 'Draw'; sub = 'Threefold repetition'; }
  view.banner(main, sub);
}

/* ------------------------------------------------------------------ input */

view.onSquareClick = (square) => {
  sfx.prime();
  if (animating || game.isGameOver()) return;
  if (mode === 'ai' && game.turn() !== humanSide) return;

  const piece = game.get(square as any);

  if (selected) {
    if (square === selected) { selected = null; refreshMarks(); return; }
    const legal = (game.moves({ square: selected as any, verbose: true }) as any[])
      .find(m => m.to === square);
    if (legal) {
      void applyAndAnimate({ from: selected, to: square, promotion: 'q' });  // auto-queen
      return;
    }
    // clicking another of your own pieces re-selects
    if (piece && piece.color === game.turn()) { selected = square; sfx.select(); refreshMarks(); return; }
    // an illegal destination — say why
    if (piece) {
      hint(game.inCheck()
        ? 'Cannot take that — your king is in check'
        : 'That piece is defended, or the move would expose your king');
    } else {
      hint(game.inCheck() ? 'You are in check — you must answer it' : 'Not a legal move');
    }
    selected = null;
    refreshMarks();
    return;
  }

  if (piece && piece.color === game.turn()) {
    selected = square;
    sfx.select();
    refreshMarks();
    if ((game.moves({ square: square as any }) as string[]).length === 0) {
      hint(game.inCheck()
        ? 'That piece cannot move — your king is in check'
        : 'That piece has no legal moves');
    }
  } else if (piece) {
    hint("That is your opponent's piece");
  }
};

/* ---------------------------------------------------------------- controls */

const modeSel = document.querySelector<HTMLSelectElement>('#mode')!;
const tierSel = document.querySelector<HTMLSelectElement>('#tier')!;
const speedSel = document.querySelector<HTMLSelectElement>('#speed')!;
const sideSel = document.querySelector<HTMLSelectElement>('#side')!;
const tierWrap = document.querySelector<HTMLLabelElement>('#tierWrap')!;

modeSel.value = mode;
tierSel.value = engine.getTier();

modeSel.onchange = () => {
  mode = modeSel.value as Mode;
  tierWrap.style.display = mode === 'ai' ? '' : 'none';
  newGame();
};
tierSel.onchange = () => engine.setTier(tierSel.value as Tier);
speedSel.onchange = () => { view.speed = speedSel.value as Speed; };
const fightSel = document.querySelector<HTMLSelectElement>('#fightcam')!;
fightSel.value = view.fightCam ? 'on' : 'off';
fightSel.onchange = () => {
  view.fightCam = fightSel.value === 'on';
  localStorage.setItem('fightCam', fightSel.value);
};
// remember the choice between sessions
const savedFight = localStorage.getItem('fightCam');
if (savedFight) { view.fightCam = savedFight === 'on'; fightSel.value = savedFight; }
sideSel.onchange = () => { humanSide = sideSel.value as Side; newGame(); };

document.querySelector<HTMLButtonElement>('#flip')!.onclick = () => {
  view.setFlipped(!view.flipped);
  refreshMarks();
};
const muteBtn = document.querySelector<HTMLButtonElement>('#mute')!;
muteBtn.onclick = () => {
  sfx.setMuted(!sfx.isMuted());
  muteBtn.textContent = 'Sound: ' + (sfx.isMuted() ? 'off' : 'on');
};
document.querySelector<HTMLButtonElement>('#newgame')!.onclick = () => newGame();

function newGame() {
  game.reset();
  selected = null;
  pendingEngine = null;
  animating = false;
  view.clearBanner();
  // in hot-seat keep white at the bottom; vs AI your own colour faces you
  view.setFlipped(mode === 'ai' && humanSide === 'b');
  syncBoard();
  setStatus(describeTurn());
  if (mode === 'ai' && game.turn() !== humanSide) void takeEngineTurn();
}

addEventListener('resize', () => view.relayout());

/* ------------------------------------------------------------------- boot */

syncBoard();
setStatus('Loading engine…');
void engine.init().then(() => {
  engineNote.textContent = engine.degraded
    ? 'Stockfish unavailable — using the built-in fallback opponent'
    : '';
  engine.setTier(tierSel.value as Tier);
  setStatus(describeTurn());
  if (mode === 'ai' && game.turn() !== humanSide) void takeEngineTurn();
});

// expose for quick console poking during development
(window as any).__chess = { game, view, engine };
