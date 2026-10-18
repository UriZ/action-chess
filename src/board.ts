/** Presentation layer.
 *
 *  Consumes move events and performs them. It NEVER feeds anything back into
 *  the chess logic — the position is already final before an animation starts,
 *  which is what lets us skip, speed up, or disable the show entirely. */

import { sfx } from './sfx';
import { SCALE, idleSrc, frameSrc, pieceName, sideName, type PieceKey, type Side } from './pieces';

export type Speed = 'normal' | 'fast' | 'instant';

export interface MoveEvent {
  from: string;
  to: string;
  piece: PieceKey;
  color: Side;
  captured?: PieceKey;        // piece type taken
  capturedSquare?: string;    // differs from `to` on en passant
  castleRook?: { from: string; to: string };
  promotion?: PieceKey;
  check: boolean;
  mate: boolean;
}

const FILES = 'abcdefgh';
const sq = (f: number, r: number) => FILES[f] + (r + 1);
const fileOf = (s: string) => FILES.indexOf(s[0]);
const rankOf = (s: string) => parseInt(s[1], 10) - 1;

interface Sprite {
  el: HTMLDivElement;
  root: HTMLDivElement;
  img: HTMLImageElement;
  color: Side;
  kind: PieceKey;
  square: string;
}

export class BoardView {
  readonly root: HTMLDivElement;
  private tilesEl: HTMLDivElement;
  private piecesEl: HTMLDivElement;
  private fxEl: HTMLDivElement;
  private overlayEl: HTMLDivElement;
  private cameraEl: HTMLDivElement;
  private shakerEl: HTMLDivElement;
  private vignetteEl: HTMLDivElement;

  private sprites = new Map<string, Sprite>();   // keyed by current square
  private tiles = new Map<string, HTMLDivElement>();

  /** white at the bottom unless flipped */
  flipped = false;
  speed: Speed = 'normal';

  /** resolved when the user clicks to fast-forward */
  private skipFlag = false;

  onSquareClick: ((square: string) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'board-root';

    this.shakerEl = document.createElement('div');
    this.shakerEl.className = 'shaker';
    this.cameraEl = document.createElement('div');
    this.cameraEl.className = 'camera';
    this.tilesEl = document.createElement('div');
    this.tilesEl.className = 'tiles';
    this.piecesEl = document.createElement('div');
    this.piecesEl.className = 'pieces';
    this.fxEl = document.createElement('div');
    this.fxEl.className = 'fx';
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'overlay';
    this.vignetteEl = document.createElement('div');
    this.vignetteEl.className = 'vignette';

    this.cameraEl.append(this.tilesEl, this.piecesEl, this.fxEl);
    this.shakerEl.append(this.cameraEl, this.vignetteEl);
    this.root.append(this.shakerEl, this.overlayEl);
    parent.appendChild(this.root);

    this.buildTiles();

    // click anywhere fast-forwards the current animation
    this.root.addEventListener('click', () => { this.skipFlag = true; });
  }

  /* ------------------------------------------------------------ geometry
   *
   * Everything is computed in PIXELS against the board box, once per resize.
   * Rows are laid out back-to-front with a perspective factor, so the far
   * rank is both narrower and shallower than the near rank.
   *
   * vr = view rank: 0 is the near (bottom) row, 7 is the far (top) row.
   */

  private layout = {
    rowY: [] as number[],      // bottom edge of each row, px (index = vr)
    rowH: [] as number[],      // height of each row, px
    halfW: [] as number[],     // half the row's total width, px
    cx: 0,
  };

  /** how much of the board's height the squares occupy */
  private static BOARD_H = 0.70;
  /** piece height in row-heights. Tuned so a king is just under one tile
   *  wide — any taller and the back ranks become an unreadable thicket. */
  private static PIECE_ROWS = 1.85;

  private computeLayout() {
    const W = this.root.clientWidth || 1;
    const H = this.root.clientHeight || 1;
    // vr 0 is the NEAR row, so it must be the largest
    const persp = (vr: number) => 1 / (1 + (vr / 7) * 1.15);         // 1.0 near → ~0.47 far
    const pSum = Array.from({ length: 8 }, (_, vr) => persp(vr)).reduce((a, b) => a + b, 0);

    // Row DEPTH follows tile WIDTH, not the box height — otherwise a tall
    // narrow viewport produces giant rows and pieces far wider than a square.
    let halfW = W * 0.47;
    let rowHNear = ((halfW * 2) / 8) * 0.78;

    // everything that must fit vertically: the squares plus the tallest
    // piece standing on the near row
    const contentH = () => rowHNear * pSum + rowHNear * BoardView.PIECE_ROWS * 0.62;
    const budget = H * BoardView.BOARD_H + H * 0.22;
    if (contentH() > budget) {
      const k = budget / contentH();
      halfW *= k;
      rowHNear *= k;
    }

    const boardH = rowHNear * pSum;
    const headroom = rowHNear * BoardView.PIECE_ROWS * 0.62;
    // centre the whole composition, then nudge down so the near rank has air
    let nearBottom = (H + boardH + headroom) / 2;
    nearBottom = Math.min(nearBottom, H * 0.96);
    nearBottom = Math.max(nearBottom, boardH + headroom * 0.4);

    const rowH: number[] = [], rowY: number[] = [], halfWs: number[] = [];
    let y = nearBottom;
    for (let vr = 0; vr < 8; vr++) {
      const p = persp(vr);
      rowH[vr] = rowHNear * p;
      rowY[vr] = y;
      halfWs[vr] = halfW * p;
      y -= rowH[vr];
    }
    this.layout = { rowY, rowH, halfW: halfWs, cx: W / 2 };
  }

  /** tile rect in px for a real board square */
  private tileRect(square: string) {
    const file = fileOf(square), rank = rankOf(square);
    const vf = this.flipped ? 7 - file : file;
    const vr = this.flipped ? 7 - rank : rank;
    const L = this.layout;
    const halfW = L.halfW[vr];
    const w = (halfW * 2) / 8;
    const cx = L.cx + (vf - 3.5) * w;
    const h = L.rowH[vr];
    const bottom = L.rowY[vr];
    return { cx, w, h, top: bottom - h, bottom, vr, depth: vr / 7 };
  }

  private buildTiles() {
    this.computeLayout();
    this.tilesEl.innerHTML = '';
    this.tiles.clear();
    // far rows first, so nearer rows paint over them
    for (let vr = 7; vr >= 0; vr--) {
      for (let vf = 0; vf < 8; vf++) {
        const file = this.flipped ? 7 - vf : vf;
        const rank = this.flipped ? 7 - vr : vr;
        const name = sq(file, rank);
        const r = this.tileRect(name);
        const t = document.createElement('div');
        t.className = 'tile ' + ((file + rank) % 2 === 0 ? 'dark' : 'light');
        t.style.left = (r.cx - r.w / 2) + 'px';
        t.style.top = r.top + 'px';
        t.style.width = r.w + 'px';
        t.style.height = r.h + 'px';
        t.style.filter = `brightness(${(0.68 + 0.32 * (1 - r.depth)).toFixed(3)})`;
        t.dataset.square = name;
        t.addEventListener('click', (e) => { e.stopPropagation(); this.skipFlag = true; this.onSquareClick?.(name); });
        this.tilesEl.appendChild(t);
        this.tiles.set(name, t);
      }
    }
  }

  /** where a piece's feet sit, in px */
  private anchor(square: string) {
    const r = this.tileRect(square);
    return { x: r.cx, y: r.bottom - r.h * 0.18, depth: r.depth, vr: r.vr, rowH: r.h };
  }

  private sizeFor(kind: PieceKey, square: string) {
    const r = this.tileRect(square);
    const h = r.h * BoardView.PIECE_ROWS * SCALE[kind].h;
    return { h, w: h * SCALE[kind].aspect };
  }

  private placeSprite(s: Sprite, square: string) {
    const a = this.anchor(square);
    const size = this.sizeFor(s.kind, square);
    s.el.style.left = a.x + 'px';
    s.el.style.top = a.y + 'px';
    s.el.style.height = size.h + 'px';
    s.el.style.width = size.w + 'px';
    // nearer rows draw in front
    s.el.style.zIndex = String(10 + (7 - a.vr) * 2);
  }

  /* -------------------------------------------------------------- sprites */

  setPosition(board: ({ type: PieceKey; color: Side } | null)[][]) {
    this.piecesEl.innerHTML = '';
    this.sprites.clear();
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const cell = board[7 - r][f];               // chess.js board() is rank 8 first
        if (!cell) continue;
        this.addSprite(sq(f, r), cell.type, cell.color);
      }
    }
  }

  private addSprite(square: string, kind: PieceKey, color: Side): Sprite {
    const el = document.createElement('div');
    el.className = 'piece idling';
    const root = document.createElement('div');
    root.className = 'proot';
    const img = document.createElement('img');
    img.src = idleSrc(color, kind);
    img.draggable = false;
    img.alt = `${sideName(color)} ${pieceName(kind)}`;
    root.appendChild(img);
    el.appendChild(root);
    // stagger the breathing so the armies don't pulse in lockstep
    root.style.animationDelay = (-Math.random() * 3.4).toFixed(2) + 's';
    el.addEventListener('click', (e) => { e.stopPropagation(); this.skipFlag = true; this.onSquareClick?.(sprite.square); });
    this.piecesEl.appendChild(el);
    const sprite: Sprite = { el, root, img, color, kind, square };
    this.placeSprite(sprite, square);
    this.sprites.set(square, sprite);
    return sprite;
  }

  relayout() {
    this.buildTiles();
    for (const [square, s] of this.sprites) this.placeSprite(s, square);
  }

  setFlipped(f: boolean) {
    this.flipped = f;
    this.relayout();
  }

  /* ------------------------------------------------------------ highlights */

  clearMarks() {
    for (const t of this.tiles.values()) t.classList.remove('sel', 'legal', 'capture', 'check', 'last');
    for (const s of this.sprites.values()) s.el.classList.remove('sel');
  }

  markSelected(square: string) {
    this.tiles.get(square)?.classList.add('sel');
    this.sprites.get(square)?.el.classList.add('sel');
  }

  markLegal(squares: { to: string; capture: boolean }[]) {
    for (const m of squares) this.tiles.get(m.to)?.classList.add(m.capture ? 'capture' : 'legal');
  }

  markCheck(square: string | null) {
    if (square) this.tiles.get(square)?.classList.add('check');
  }

  markLast(from: string, to: string) {
    this.tiles.get(from)?.classList.add('last');
    this.tiles.get(to)?.classList.add('last');
  }

  /* ----------------------------------------------------------------- timing */

  private scale(ms: number) {
    if (this.speed === 'instant') return 0;
    return this.speed === 'fast' ? ms * 0.55 : ms;
  }

  /** Sleep that resolves early when the user clicks to skip.
   *
   *  Timing is driven by setTimeout, never by requestAnimationFrame: rAF is
   *  paused entirely in a background tab, which would hang a move forever if
   *  the player switched away mid-animation. rAF is used only to notice a
   *  skip click promptly while the tab is visible. */
  private wait(ms: number): Promise<void> {
    const d = this.scale(ms);
    if (d <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; window.clearTimeout(timer); resolve(); } };
      const timer = window.setTimeout(finish, d);
      const tick = () => {
        if (done) return;
        if (this.skipFlag) return finish();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /** Start a visual animation and wait out its duration.
   *
   *  We deliberately do NOT await `Animation.finished`: a hidden or heavily
   *  throttled tab never runs animations, so that promise can hang forever
   *  and freeze the whole game loop. `fill: 'forwards'` keeps the end state,
   *  and our own timer owns the control flow. */
  private anim(el: HTMLElement, frames: Keyframe[], ms: number, easing = 'ease-in-out') {
    const d = this.scale(ms);
    if (d <= 0) {
      const last = frames[frames.length - 1] as any;
      if (last?.transform) el.style.transform = last.transform;
      return Promise.resolve();
    }
    el.animate(frames, { duration: d, easing, fill: 'forwards' });
    return this.wait(ms);
  }

  /* --------------------------------------------------------------- effects */

  private pxOf(square: string) {
    const a = this.anchor(square);
    return { x: a.x, y: a.y };
  }

  private dustAt(square: string, n = 5) {
    if (this.speed === 'instant') return;
    const p = this.pxOf(square);
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div');
      d.className = 'dust';
      d.style.left = (p.x + (Math.random() * 44 - 22)) + 'px';
      d.style.top = (p.y - 4 + Math.random() * 6) + 'px';
      this.fxEl.appendChild(d);
      d.animate([
        { transform: 'translate(-50%,-50%) scale(0.5)', opacity: 0.7 },
        { transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 46}px), calc(-50% - ${14 + Math.random() * 18}px)) scale(${1.3 + Math.random()})`, opacity: 0 },
      ], { duration: 420 + Math.random() * 260, easing: 'ease-out' }).onfinish = () => d.remove();
    }
  }

  private embersAt(square: string, n = 20) {
    if (this.speed === 'instant') return;
    const p = this.pxOf(square);
    for (let i = 0; i < n; i++) {
      const e = document.createElement('div');
      e.className = 'ember';
      e.style.left = (p.x + (Math.random() * 46 - 23)) + 'px';
      e.style.top = (p.y - Math.random() * 40) + 'px';
      this.fxEl.appendChild(e);
      e.animate([
        { transform: 'translate(-50%,-50%)', opacity: 1 },
        { transform: `translate(calc(-50% + ${(Math.random() - 0.5) * 40}px), calc(-50% - ${50 + Math.random() * 90}px))`, opacity: 0 },
      ], { duration: 850 + Math.random() * 800, easing: 'ease-out', delay: Math.random() * 350 }).onfinish = () => e.remove();
    }
  }

  private shake(intensity = 8, ms = 280) {
    if (this.speed === 'instant') return;
    const frames: Keyframe[] = [];
    for (let i = 0; i < 8; i++) {
      const k = 1 - i / 8;
      frames.push({ transform: `translate(${(Math.random() - 0.5) * 2 * intensity * k}px, ${(Math.random() - 0.5) * 2 * intensity * k}px)` });
    }
    frames.push({ transform: 'translate(0,0)' });
    this.shakerEl.animate(frames, { duration: this.scale(ms), easing: 'linear' });
  }

  private cameraPush(square: string, ms: number) {
    if (this.speed === 'instant') return;
    const a = this.anchor(square);
    this.cameraEl.style.transformOrigin = `${a.x}px ${a.y}px`;
    const d = this.scale(ms);
    this.cameraEl.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.07)', offset: 0.3 },
      { transform: 'scale(1.07)', offset: 0.7 },
      { transform: 'scale(1)' },
    ], { duration: d, easing: 'cubic-bezier(.2,.9,.3,1)' });
    this.vignetteEl.animate([
      { opacity: 0 }, { opacity: 0.5, offset: 0.3 }, { opacity: 0.45, offset: 0.7 }, { opacity: 0 },
    ], { duration: d, easing: 'ease-out' });
  }

  /* ------------------------------------------------------------- movement */

  /** direction a piece should face to travel from -> to, in screen terms */
  private facing(from: string, to: string): 1 | -1 {
    const a = this.anchor(from), b = this.anchor(to);
    if (Math.abs(b.x - a.x) < 0.4) return 1;
    return b.x > a.x ? 1 : -1;
  }

  private async walk(s: Sprite, to: string, opts: { quiet?: boolean } = {}) {
    const from = s.square;
    if (this.speed === 'instant') { this.teleport(s, to); return; }

    const dir = this.facing(from, to);
    const a = this.anchor(from), b = this.anchor(to);
    const dist = Math.hypot(b.x - a.x, (b.y - a.y) * 0.8);
    const heavy = SCALE[s.kind].heavy;
    const frameMs = heavy ? 150 : 120;
    // quiet-move budget: <= 1s, scaled by how far the piece actually travels
    const across = Math.max(1, this.layout.halfW[0] * 2);
    const dur = Math.min(1000, Math.max(360, (dist / across) * 1750));

    s.el.classList.remove('idling');
    s.img.style.transform = dir === 1 ? '' : 'scaleX(-1)';

    let fi = 0;
    s.img.src = frameSrc(s.color, s.kind, 'walk', 0);
    if (!opts.quiet) sfx.step(heavy);
    const stepper = window.setInterval(() => {
      fi = (fi + 1) % 4;
      s.img.src = frameSrc(s.color, s.kind, 'walk', fi);
      if ((fi === 0 || fi === 2) && !opts.quiet) sfx.step(heavy);
    }, frameMs);

    // size interpolates with depth so the piece shrinks as it walks away
    const sizeA = this.sizeFor(s.kind, from), sizeB = this.sizeFor(s.kind, to);
    const anim = s.el.animate([
      { left: a.x + 'px', top: a.y + 'px', height: sizeA.h + 'px', width: sizeA.w + 'px' },
      { left: b.x + 'px', top: b.y + 'px', height: sizeB.h + 'px', width: sizeB.w + 'px' },
    ], { duration: this.scale(dur), easing: 'cubic-bezier(.25,.05,.75,.95)', fill: 'forwards' });

    s.root.animate([
      { transform: 'translateY(0)' }, { transform: 'translateY(-2.5%)' }, { transform: 'translateY(0)' },
    ], { duration: this.scale(frameMs * 2), iterations: Math.ceil(dur / (frameMs * 2)), easing: 'ease-in-out' });

    // the wait owns the timing; the WAAPI animation is purely visual, so a
    // throttled or cancelled animation can never stall the game loop
    await this.wait(dur);
    try { anim.cancel(); } catch { /* ignore */ }
    window.clearInterval(stepper);

    this.teleport(s, to);
    s.img.style.transform = '';
    if (!opts.quiet) { sfx.thud(); this.dustAt(to, 4); }
    await this.anim(s.root, [{ transform: 'scaleY(0.95) scaleX(1.03)' }, { transform: 'none' }], 170, 'ease-out');
    s.root.getAnimations().forEach(x => x.cancel());
    s.root.style.transform = '';
    s.el.classList.add('idling');
  }

  private teleport(s: Sprite, to: string) {
    this.sprites.delete(s.square);
    s.square = to;
    s.img.src = idleSrc(s.color, s.kind);
    s.el.getAnimations().forEach(a => a.cancel());
    this.placeSprite(s, to);
    this.sprites.set(to, s);
  }

  private async playDeath(s: Sprite) {
    const square = s.square;
    s.el.classList.remove('idling');
    s.el.style.zIndex = '60';
    if (this.speed === 'instant') { this.removeSprite(s); return; }

    s.img.src = frameSrc(s.color, s.kind, 'death', 0);
    s.root.animate([
      { filter: 'brightness(1)' }, { filter: 'brightness(2.3) contrast(1.2)' }, { filter: 'brightness(1)' },
    ], { duration: this.scale(180), easing: 'ease-out' });
    await this.wait(300);
    s.img.src = frameSrc(s.color, s.kind, 'death', 1);
    await this.wait(300);
    s.img.src = frameSrc(s.color, s.kind, 'death', 2);
    await this.wait(200);
    s.img.src = frameSrc(s.color, s.kind, 'death', 3);
    sfx.bodyfall();
    this.shake(7, 230);
    this.dustAt(square, 8);
    await this.wait(420);
    this.embersAt(square);
    await this.anim(s.root, [
      { opacity: 1, filter: 'brightness(0.95)' },
      { opacity: 0, filter: 'brightness(0.55)' },
    ], 700, 'ease-in');
    this.removeSprite(s);
  }

  private removeSprite(s: Sprite) {
    if (this.sprites.get(s.square) === s) this.sprites.delete(s.square);
    s.el.remove();
  }

  /* ------------------------------------------------------------ the show */

  /** Perform one move. The logic layer has ALREADY applied it. */
  async play(ev: MoveEvent): Promise<void> {
    this.skipFlag = false;
    this.clearMarks();

    const mover = this.sprites.get(ev.from);
    if (!mover) { return; }                          // defensive: nothing to animate

    if (ev.captured && ev.capturedSquare) {
      await this.playCapture(ev, mover);
    } else if (ev.castleRook) {
      const rook = this.sprites.get(ev.castleRook.from);
      // king and rook walk together
      await Promise.all([
        this.walk(mover, ev.to),
        rook ? this.walk(rook, ev.castleRook.to, { quiet: true }) : Promise.resolve(),
      ]);
    } else {
      await this.walk(mover, ev.to);
    }

    if (ev.promotion) await this.playPromotion(mover, ev.promotion);

    this.markLast(ev.from, ev.to);

    if (ev.mate) {
      sfx.victory();
      this.root.classList.add('mate');
    } else if (ev.check) {
      sfx.check();
    }
  }

  private async playCapture(ev: MoveEvent, mover: Sprite) {
    const victim = this.sprites.get(ev.capturedSquare!);
    const dir = this.facing(ev.from, ev.to);

    // 1. march to the victim's square
    await this.walk(mover, ev.to === ev.capturedSquare ? ev.to : ev.to, { quiet: false });
    // for en passant the victim stands on a different square than `to`
    if (!victim) return;

    if (this.speed === 'instant') { this.removeSprite(victim); return; }

    mover.el.classList.remove('idling');
    mover.el.style.zIndex = '70';
    mover.img.style.transform = dir === 1 ? '' : 'scaleX(-1)';

    // 2. ready + wind-up
    mover.img.src = frameSrc(mover.color, mover.kind, 'attack', 0);
    sfx.whoosh(0.18, 0.1);
    await this.wait(170);
    mover.img.src = frameSrc(mover.color, mover.kind, 'attack', 1);
    sfx.whoosh(0.3, 0.14);
    await this.wait(300);

    // 3. strike
    mover.img.src = frameSrc(mover.color, mover.kind, 'attack', 2);
    sfx.whoosh(0.15, 0.3);
    this.cameraPush(ev.capturedSquare!, 820);
    window.setTimeout(() => {
      sfx.clang(); sfx.thud();
      this.shake(12, 300);
      this.dustAt(ev.capturedSquare!, 8);
    }, this.scale(100));
    await this.wait(190);

    // 4. follow-through held while the victim crumples
    mover.img.src = frameSrc(mover.color, mover.kind, 'attack', 3);
    sfx.death();
    const dying = this.playDeath(victim);
    await this.wait(260);
    mover.img.src = idleSrc(mover.color, mover.kind);
    mover.img.style.transform = '';
    mover.el.style.zIndex = '';
    mover.el.classList.add('idling');
    await dying;
  }

  private async playPromotion(s: Sprite, to: PieceKey) {
    sfx.promote();
    if (this.speed !== 'instant') {
      await this.anim(s.root, [
        { filter: 'brightness(1)', transform: 'scale(1)' },
        { filter: 'brightness(3.4) saturate(0.2)', transform: 'scale(1.1)', offset: 0.5 },
        { filter: 'brightness(1)', transform: 'scale(1)' },
      ], 520, 'ease-out');
    }
    s.kind = to;
    s.img.src = idleSrc(s.color, to);
    s.img.alt = `${sideName(s.color)} ${pieceName(to)}`;
    this.placeSprite(s, s.square);
    this.embersAt(s.square, 10);
  }

  /* --------------------------------------------------------------- banner */

  banner(text: string, sub = '') {
    this.overlayEl.innerHTML = '';
    const b = document.createElement('div');
    b.className = 'banner';
    b.innerHTML = `<div class="banner-main">${text}</div>${sub ? `<div class="banner-sub">${sub}</div>` : ''}`;
    this.overlayEl.appendChild(b);
  }

  clearBanner() { this.overlayEl.innerHTML = ''; this.root.classList.remove('mate'); }
}
