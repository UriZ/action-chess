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
        <linearGradient id="groundG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0c0f18"/>
          <stop offset="0.45" stop-color="#0a0d16"/>
          <stop offset="1" stop-color="#121728"/>
        </linearGradient>
        <!-- Must fade to transparent at BOTH ends. Ending at full opacity
             puts a hard horizontal cut where the rect stops, which reads as
             a pale rectangle floating over the scene. -->
        <linearGradient id="fogG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(120,132,160,0)"/>
          <stop offset="0.45" stop-color="rgba(120,132,160,0.16)"/>
          <stop offset="0.75" stop-color="rgba(120,132,160,0.09)"/>
          <stop offset="1" stop-color="rgba(120,132,160,0)"/>
        </linearGradient>
        <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="softer"><feGaussianBlur stdDeviation="20"/></filter>
      </defs>

      <!-- moon, high and to the right so it clears the board -->
      <circle cx="1268" cy="124" r="250" fill="url(#halo)"/>
      <circle cx="1268" cy="124" r="92" fill="url(#moonG)"/>
      <g opacity="0.1" fill="#6c6758">
        <circle cx="1296" cy="94" r="15"/>
        <circle cx="1240" cy="150" r="22"/>
        <circle cx="1288" cy="166" r="10"/>
        <circle cx="1226" cy="92" r="8"/>
      </g>
      <g fill="#0a0c14" opacity="0.40" filter="url(#soft)">
        <ellipse cx="1256" cy="86" rx="230" ry="7"/>
        <ellipse cx="1300" cy="174" rx="265" ry="9"/>
      </g>

      <!-- the ground, running all the way to the bottom of the frame -->
      <rect x="0" y="348" width="1600" height="652" fill="url(#groundG)"/>

      <!-- distant ridge on the horizon -->
      <path d="M0,352 L140,318 L280,344 L420,306 L560,338 L700,312 L860,342
               L1010,316 L1180,346 L1340,318 L1500,344 L1600,328 L1600,520 L0,520 Z"
            fill="#080a11" opacity="0.95"/>

      <!-- far, faint treeline for depth -->
      <g fill="#0a0d16" opacity="0.55">
        <path d="${tree({ x: 470, groundY: 352, height: 120, lean: 8, seed: 91, scale: 0.42 })}"/>
        <path d="${tree({ x: 980, groundY: 350, height: 100, lean: -6, seed: 23, scale: 0.38 })}"/>
      </g>

      <!-- mid-distance trees standing on the horizon -->
      <g fill="#060810" opacity="0.8">
        <path d="${tree({ x: 232, groundY: 420, height: 230, lean: -14, seed: 7, scale: 0.7 })}"/>
        <path d="${tree({ x: 1412, groundY: 424, height: 196, lean: 12, seed: 1337, scale: 0.62 })}"/>
      </g>

      <!-- FOREGROUND trees rooted at the bottom of the frame: these carry the
           silhouette down the left and right edges instead of leaving the
           lower half of the screen empty -->
      <g fill="#030408">
        <path d="${tree({ x: 54, groundY: 1000, height: 790, lean: -34, seed: 404, scale: 1.9 })}"/>
      </g>
      <g fill="#030408" opacity="0.96">
        <path d="${tree({ x: 1556, groundY: 1000, height: 720, lean: 30, seed: 909, scale: 1.7 })}"/>
      </g>

      <!-- foreground rocks and dead grass, framing the bottom corners -->
      <g fill="#04050a">
        <path d="M0,1000 L0,905 C44,900 86,916 120,936 C150,952 182,962 214,968
                 C246,974 268,984 282,1000 Z"/>
        <path d="M1600,1000 L1600,890 C1548,886 1500,906 1462,930
                 C1430,950 1398,962 1366,970 C1340,976 1320,986 1310,1000 Z"/>
        <g stroke="#04050a" stroke-width="4" fill="none" stroke-linecap="round">
          <path d="M196,1000 C190,962 178,938 160,918"/>
          <path d="M214,1000 C214,966 220,940 232,916"/>
          <path d="M236,1000 C244,968 258,948 276,932"/>
          <path d="M1372,1000 C1378,964 1392,940 1410,920"/>
          <path d="M1348,1000 C1346,966 1338,942 1324,922"/>
        </g>
      </g>

      <!-- fog: banked along the horizon AND drifting through the near field -->
      <rect x="0" y="330" width="1600" height="220" fill="url(#fogG)"/>
      <g filter="url(#softer)" opacity="0.55">
        <ellipse cx="300" cy="396" rx="430" ry="26" fill="#4b5470" opacity="0.34"/>
        <ellipse cx="1200" cy="414" rx="500" ry="30" fill="#4b5470" opacity="0.28"/>
      </g>
      <g filter="url(#softer)" opacity="0.5">
        <ellipse cx="240" cy="612" rx="470" ry="40" fill="#525c7a" opacity="0.26"/>
        <ellipse cx="1340" cy="668" rx="520" ry="46" fill="#525c7a" opacity="0.24"/>
        <ellipse cx="700" cy="812" rx="620" ry="54" fill="#5a6584" opacity="0.2"/>
        <ellipse cx="1100" cy="930" rx="680" ry="60" fill="#5a6584" opacity="0.18"/>
      </g>
    </svg>

    <div class="bats" aria-hidden="true">
      ${[0, 1, 2].map(i => `
        <svg class="bat b${i}" viewBox="0 0 40 16">
          <path d="M20,9 C17,3 12,1 6,3 C9,4 10,6 9,9 C12,7 16,7 20,9
                   C24,7 28,7 31,9 C30,6 31,4 34,3 C28,1 23,3 20,9 Z" fill="#04050a"/>
        </svg>`).join('')}
      ${[0, 1, 2].map(i => `
        <svg class="eagle e${i}" viewBox="0 0 120 44">
          <path d="M60,26
                   C52,18 42,11 28,8 C18,6 10,7 2,11 C12,11 20,14 27,19
                   C33,23 40,26 48,27 C52,28 56,29 60,32
                   C64,29 68,28 72,27 C80,26 87,23 93,19
                   C100,14 108,11 118,11 C110,7 102,6 92,8
                   C78,11 68,18 60,26 Z" fill="#05060b"/>
          <path d="M57,30 C57,36 58,40 60,43 C62,40 63,36 63,30 Z" fill="#05060b"/>
        </svg>`).join('')}
    </div>
  `;
  return el;
}
