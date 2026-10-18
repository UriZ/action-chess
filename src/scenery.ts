/** Background mood: moon, barren trees, drifting bats, ground fog.
 *  Pure SVG + CSS, sits behind the board and never takes pointer events.
 *
 *  Coordinates are tuned so the ridge and tree roots land just above the
 *  board's far edge (the horizon), with the canopies rising into the sky —
 *  anything rooted lower is simply hidden behind the board plane. */

/** A gnarled dead tree, drawn procedurally so each one differs.
 *  Branches taper and fork, which is what sells "dead tree" over "blob". */
function tree(opts: {
  x: number; groundY: number; height: number;
  lean: number; seed: number; scale?: number;
}): string {
  const { x, groundY, height, lean, seed } = opts;
  const s = opts.scale ?? 1;
  let n = seed;
  const rnd = () => ((n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  const parts: string[] = [];

  // trunk: a tapering spine with a root flare at the base
  const topY = groundY - height;
  const topX = x + lean;
  const baseW = 15 * s;
  parts.push(`M${x - baseW},${groundY}
    C${x - baseW * 0.55},${groundY - height * 0.22} ${topX - 5.5 * s},${groundY - height * 0.62} ${topX - 3 * s},${topY}
    L${topX + 3 * s},${topY}
    C${topX + 5.5 * s},${groundY - height * 0.62} ${x + baseW * 0.55},${groundY - height * 0.22} ${x + baseW},${groundY}
    C${x + baseW * 0.5},${groundY - 5 * s} ${x - baseW * 0.5},${groundY - 5 * s} ${x - baseW},${groundY} Z`);

  // roots spreading at the base
  for (const dir of [-1, 1]) {
    const len = (22 + rnd() * 16) * s * dir;
    parts.push(`M${x + dir * baseW * 0.7},${groundY}
      C${x + len * 0.6},${groundY - 5 * s} ${x + len},${groundY - 2 * s} ${x + len * 1.35},${groundY}
      C${x + len * 0.9},${groundY - 1 * s} ${x + len * 0.4},${groundY + 1 * s} ${x + dir * baseW * 0.7},${groundY} Z`);
  }

  // branches: fork off the trunk, thinning and splitting as they rise
  const branch = (bx: number, by: number, ang: number, len: number, w: number, depth: number) => {
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    // slight S-curve so limbs look grown, not drawn with a ruler
    const c1x = bx + Math.cos(ang - 0.3) * len * 0.45;
    const c1y = by + Math.sin(ang - 0.3) * len * 0.45;
    const c2x = bx + Math.cos(ang + 0.2) * len * 0.78;
    const c2y = by + Math.sin(ang + 0.2) * len * 0.78;
    const nx = -Math.sin(ang) * w, ny = Math.cos(ang) * w;
    parts.push(`M${bx + nx},${by + ny}
      C${c1x + nx * 0.6},${c1y + ny * 0.6} ${c2x + nx * 0.3},${c2y + ny * 0.3} ${ex},${ey}
      C${c2x - nx * 0.3},${c2y - ny * 0.3} ${c1x - nx * 0.6},${c1y - ny * 0.6} ${bx - nx},${by - ny} Z`);
    if (depth > 0) {
      const spread = 0.42 + rnd() * 0.34;
      branch(ex, ey, ang - spread, len * (0.56 + rnd() * 0.16), w * 0.55, depth - 1);
      branch(ex, ey, ang + spread * (0.6 + rnd() * 0.7), len * (0.5 + rnd() * 0.2), w * 0.5, depth - 1);
    }
  };

  const limbs = 5;
  for (let i = 0; i < limbs; i++) {
    const t = 0.34 + (i / (limbs - 1)) * 0.6;                 // how far up the trunk
    const by = groundY - height * t;
    const bx = x + lean * t;
    const dir = i % 2 === 0 ? -1 : 1;
    const ang = -Math.PI / 2 + dir * (0.55 + rnd() * 0.5);
    branch(bx, by, ang, height * (0.3 - t * 0.12) * (0.85 + rnd() * 0.4), (5.5 - i * 0.7) * s, 2);
  }
  // crown
  branch(topX, topY, -Math.PI / 2 + (rnd() - 0.5) * 0.3, height * 0.17, 3.2 * s, 2);

  return parts.join(' ');
}

export function buildScenery(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'scenery';
  el.innerHTML = `
    <svg class="sky" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <radialGradient id="moonG" cx="40%" cy="36%" r="68%">
          <stop offset="0" stop-color="#f6f3e7"/>
          <stop offset="0.55" stop-color="#ded8c6"/>
          <stop offset="0.85" stop-color="#b6b1a1"/>
          <stop offset="1" stop-color="#9a9586"/>
        </radialGradient>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="rgba(233,228,213,0.26)"/>
          <stop offset="0.45" stop-color="rgba(233,228,213,0.09)"/>
          <stop offset="1" stop-color="rgba(233,228,213,0)"/>
        </radialGradient>
        <linearGradient id="fogG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(120,132,160,0)"/>
          <stop offset="1" stop-color="rgba(120,132,160,0.20)"/>
        </linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="softer"><feGaussianBlur stdDeviation="20"/></filter>
      </defs>

      <!-- moon, high and to the right so it clears the board -->
      <circle cx="1268" cy="150" r="250" fill="url(#halo)"/>
      <circle cx="1268" cy="150" r="92" fill="url(#moonG)"/>
      <g opacity="0.1" fill="#6c6758">
        <circle cx="1296" cy="120" r="15"/>
        <circle cx="1240" cy="176" r="22"/>
        <circle cx="1288" cy="192" r="10"/>
        <circle cx="1226" cy="118" r="8"/>
      </g>
      <g fill="#0a0c14" opacity="0.40" filter="url(#soft)">
        <ellipse cx="1256" cy="112" rx="230" ry="7"/>
        <ellipse cx="1300" cy="200" rx="265" ry="9"/>
      </g>

      <!-- distant ridge on the horizon -->
      <path d="M0,352 L140,318 L280,344 L420,306 L560,338 L700,312 L860,342
               L1010,316 L1180,346 L1340,318 L1500,344 L1600,328 L1600,520 L0,520 Z"
            fill="#080a11" opacity="0.95"/>

      <!-- far, faint treeline for depth -->
      <g fill="#0a0d16" opacity="0.55">
        <path d="${tree({ x: 470, groundY: 352, height: 120, lean: 8, seed: 91, scale: 0.42 })}"/>
        <path d="${tree({ x: 980, groundY: 350, height: 100, lean: -6, seed: 23, scale: 0.38 })}"/>
      </g>

      <!-- the two big barren trees framing the scene -->
      <g fill="#04050a">
        <path d="${tree({ x: 128, groundY: 466, height: 330, lean: -26, seed: 7 })}"/>
      </g>
      <g fill="#04050a" opacity="0.92">
        <path d="${tree({ x: 1494, groundY: 470, height: 262, lean: 20, seed: 1337, scale: 0.86 })}"/>
      </g>

      <!-- ground fog along the horizon -->
      <rect x="0" y="330" width="1600" height="220" fill="url(#fogG)"/>
      <g filter="url(#softer)" opacity="0.55">
        <ellipse cx="300" cy="396" rx="430" ry="26" fill="#4b5470" opacity="0.34"/>
        <ellipse cx="1200" cy="414" rx="500" ry="30" fill="#4b5470" opacity="0.28"/>
      </g>
    </svg>

    <div class="bats" aria-hidden="true">
      ${[0, 1, 2, 3].map(i => `
        <svg class="bat b${i}" viewBox="0 0 40 16">
          <path d="M20,9 C17,3 12,1 6,3 C9,4 10,6 9,9 C12,7 16,7 20,9
                   C24,7 28,7 31,9 C30,6 31,4 34,3 C28,1 23,3 20,9 Z" fill="#04050a"/>
        </svg>`).join('')}
    </div>
  `;
  return el;
}
