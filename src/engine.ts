/** Opponent. Stockfish (WASM, in a Worker) with a built-in fallback so the
 *  game is always playable even if the engine fails to load.
 *
 *  It is deliberately started the moment a move is applied, so the engine
 *  thinks WHILE the piece is still walking. */

import { Chess } from 'chess.js';

export type Tier = 'squire' | 'knight' | 'crusader' | 'grandmaster';

export const TIERS: Record<Tier, { label: string; skill: number; movetime: number; blurb: string }> = {
  squire:      { label: 'Squire',      skill: 1,  movetime: 150,  blurb: 'learning the ropes' },
  knight:      { label: 'Knight',      skill: 5,  movetime: 300,  blurb: 'a fair fight' },
  crusader:    { label: 'Crusader',    skill: 12, movetime: 700,  blurb: 'a hard fight' },
  grandmaster: { label: 'Grandmaster', skill: 20, movetime: 1500, blurb: 'you will lose' },
};

type Pending = { fen: string; resolve: (uci: string | null) => void };

export class Engine {
  private worker: Worker | null = null;
  private ready = false;
  private pending: Pending | null = null;
  private tier: Tier = 'knight';
  /** true once we've given up on stockfish and fall back to the simple AI */
  public degraded = false;

  async init(): Promise<void> {
    try {
      this.worker = new Worker('/engine/stockfish.js');
      this.worker.onmessage = (e) => this.onLine(typeof e.data === 'string' ? e.data : String(e.data));
      this.worker.onerror = () => this.degrade('worker error');
      this.send('uci');
      await this.waitFor(() => this.ready, 10000);
    } catch {
      this.degrade('worker could not start');
    }
  }

  private degrade(_why: string) {
    this.degraded = true;
    this.ready = false;
    try { this.worker?.terminate(); } catch { /* ignore */ }
    this.worker = null;
    // any in-flight request is answered by the fallback
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      p.resolve(this.fallbackMove(p.fen));
    }
  }

  private send(cmd: string) { this.worker?.postMessage(cmd); }

  private onLine(line: string) {
    if (line.startsWith('uciok')) {
      this.ready = true;
      this.applyTier();
      this.send('isready');
      return;
    }
    if (line.startsWith('bestmove')) {
      const uci = line.split(/\s+/)[1];
      const p = this.pending;
      this.pending = null;
      if (p) p.resolve(uci && uci !== '(none)' ? uci : null);
    }
  }

  private applyTier() {
    const t = TIERS[this.tier];
    this.send(`setoption name Skill Level value ${t.skill}`);
    // keep the lite build honest about its own strength at low tiers
    this.send(`setoption name UCI_LimitStrength value ${t.skill < 20 ? 'true' : 'false'}`);
    if (t.skill < 20) {
      const elo = Math.round(1320 + (t.skill / 20) * (2850 - 1320));
      this.send(`setoption name UCI_Elo value ${elo}`);
    }
  }

  setTier(t: Tier) {
    this.tier = t;
    if (this.ready) this.applyTier();
  }

  getTier() { return this.tier; }

  /** Ask for a move. Resolves with UCI ("e2e4", "e7e8q") or null. */
  bestMove(fen: string): Promise<string | null> {
    if (!this.ready || !this.worker) return Promise.resolve(this.fallbackMove(fen));
    return new Promise((resolve) => {
      this.pending = { fen, resolve };
      this.send('position fen ' + fen);
      this.send(`go movetime ${TIERS[this.tier].movetime}`);
      // never let a hung engine freeze the game
      setTimeout(() => {
        if (this.pending && this.pending.fen === fen) {
          const p = this.pending;
          this.pending = null;
          p.resolve(this.fallbackMove(fen));
        }
      }, TIERS[this.tier].movetime + 4000);
    });
  }

  /** Fallback: greedy material search with a shallow reply check. Weak but legal. */
  private fallbackMove(fen: string): string | null {
    const game = new Chess(fen);
    const moves = game.moves({ verbose: true }) as any[];
    if (!moves.length) return null;
    const VAL: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    let best: any = null;
    let bestScore = -Infinity;
    for (const m of moves) {
      let score = m.captured ? VAL[m.captured] : 0;
      if (m.promotion) score += VAL[m.promotion] ?? 0;
      game.move(m);
      if (game.isCheckmate()) score += 100000;
      else {
        // punish moves that hang material to an immediate recapture
        let worst = 0;
        for (const r of game.moves({ verbose: true }) as any[])
          if (r.captured) worst = Math.max(worst, VAL[r.captured]);
        score -= worst;
        if (game.inCheck()) score += 30;
      }
      game.undo();
      score += Math.random() * 12; // break ties so it isn't robotic
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best ? best.from + best.to + (best.promotion ?? '') : null;
  }

  private waitFor(cond: () => boolean, ms: number) {
    return new Promise<void>((resolve, reject) => {
      const t0 = Date.now();
      const tick = () => {
        if (cond()) return resolve();
        if (Date.now() - t0 > ms) return reject(new Error('timeout'));
        setTimeout(tick, 50);
      };
      tick();
    });
  }
}
