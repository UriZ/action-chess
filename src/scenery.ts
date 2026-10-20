/** Background mood, one scene per piece set.
 *  Pure SVG + CSS, sits behind the board and never takes pointer events.
 *
 *  Every scene shares the same stage geometry so it composes with the board
 *  identically: the horizon sits at y=348 in a 1600x1000 viewBox, the ground
 *  runs from there to the bottom, and the big celestial body hangs high and
 *  to the right where the board cannot reach it. Anything rooted much below
 *  the horizon is hidden behind the board plane, so the silhouette that
 *  frames the lower screen has to be rooted at y=1000 on the left and right
 *  edges instead. Keep those invariants when adding a scene. */

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

/** A field of stars, denser near the top and thinning toward the horizon. */
function starfield(count: number, seed: number): string {
  let t = seed, out = '';
  const rnd = () => (t = (t * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < count; i++) {
    const x = rnd() * 1600;
    // bias upward: stars crowd the top of the sky, not the horizon haze
    const y = Math.pow(rnd(), 1.7) * 340;
    const r = 0.6 + rnd() * rnd() * 2.4;
    const o = 0.25 + rnd() * 0.7;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" opacity="${o.toFixed(2)}"/>`;
  }
  return out;
}

/** A wind-carved martian rock spire — the Mars scene's answer to a dead tree:
 *  it has to read as a silhouette at the frame edge, so it is a single
 *  tapering column with a few stepped ledges rather than a smooth cone. */
function spire(opts: { x: number; groundY: number; height: number; width: number; lean?: number; seed?: number }): string {
  const { x, groundY, height, width } = opts;
  const lean = opts.lean ?? 0;
  let t = (opts.seed ?? 1) * 2654435761 % 2147483647;
  const rnd = () => (t = (t * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const tip = x + lean;
  const left: string[] = [];
  const right: string[] = [];
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;                       // 0 at the base, 1 at the tip
    const y = groundY - height * f;
    const w = (width / 2) * (1 - f * 0.86) * (0.82 + rnd() * 0.36);
    const cx = x + lean * f;
    left.push(`${(cx - w).toFixed(1)},${y.toFixed(1)}`);
    right.unshift(`${(cx + w).toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${left.join(' L')} L${tip.toFixed(1)},${(groundY - height).toFixed(1)} L${right.join(' L')} Z`;
}

export type SceneId = 'templar' | 'martian';

export function buildScenery(scene: SceneId = 'templar'): HTMLDivElement {
  if (scene === 'martian') return buildMartianScenery();
  return buildTemplarScenery();
}

function buildTemplarScenery(): HTMLDivElement {
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

/** Mars hanging over a dust plain, for the martian army.
 *
 *  Same stage geometry as the templar scene: horizon at 348, big body high
 *  and right, silhouette carried down the left and right edges. The moon
 *  becomes Mars, the dead trees become rock spires, the ground fog becomes
 *  low dust haze, and the bats and eagles are replaced by comets in the
 *  markup below. */
function buildMartianScenery(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'scenery';
  el.innerHTML = `
    <svg class="sky" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="spaceG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#05060f"/>
          <stop offset="0.55" stop-color="#0b0a1a"/>
          <stop offset="1" stop-color="#1a0f1c"/>
        </linearGradient>
        <radialGradient id="nebulaG" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="rgba(120,60,150,0.30)"/>
          <stop offset="0.5" stop-color="rgba(90,45,120,0.12)"/>
          <stop offset="1" stop-color="rgba(90,45,120,0)"/>
        </radialGradient>
        <radialGradient id="nebulaT" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="rgba(40,110,150,0.22)"/>
          <stop offset="1" stop-color="rgba(40,110,150,0)"/>
        </radialGradient>
        <!-- Mars: lit from the upper left, so the gradient centre sits there
             and the limb darkens to a rust shadow on the lower right -->
        <radialGradient id="marsG" cx="34%" cy="30%" r="76%">
          <stop offset="0" stop-color="#e8865a"/>
          <stop offset="0.45" stop-color="#c7643a"/>
          <stop offset="0.78" stop-color="#8f3f23"/>
          <stop offset="1" stop-color="#4a1d12"/>
        </radialGradient>
        <radialGradient id="marsHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0" stop-color="rgba(226,124,82,0.22)"/>
          <stop offset="0.45" stop-color="rgba(226,124,82,0.08)"/>
          <stop offset="1" stop-color="rgba(226,124,82,0)"/>
        </radialGradient>
        <linearGradient id="dustG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2a1410"/>
          <stop offset="0.45" stop-color="#23110e"/>
          <stop offset="1" stop-color="#2e1813"/>
        </linearGradient>
        <!-- fades to transparent at BOTH ends: ending opaque leaves a hard
             horizontal cut where the rect stops -->
        <linearGradient id="hazeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(196,112,72,0)"/>
          <stop offset="0.45" stop-color="rgba(196,112,72,0.18)"/>
          <stop offset="0.75" stop-color="rgba(196,112,72,0.10)"/>
          <stop offset="1" stop-color="rgba(196,112,72,0)"/>
        </linearGradient>
        <clipPath id="marsClip"><circle cx="1268" cy="140" r="104"/></clipPath>
        <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
        <filter id="softer"><feGaussianBlur stdDeviation="20"/></filter>
      </defs>

      <rect x="0" y="0" width="1600" height="1000" fill="url(#spaceG)"/>

      <!-- nebula wash, well away from the board's bright centre -->
      <ellipse cx="300" cy="150" rx="520" ry="230" fill="url(#nebulaG)"/>
      <ellipse cx="1120" cy="300" rx="460" ry="180" fill="url(#nebulaT)"/>

      <g fill="#e9eefc">${starfield(220, 20260419)}</g>
      <g fill="#ffd9b0" opacity="0.75">${starfield(26, 777)}</g>

      <!-- MARS -->
      <circle cx="1268" cy="140" r="300" fill="url(#marsHalo)"/>
      <circle cx="1268" cy="140" r="104" fill="url(#marsG)"/>
      <g clip-path="url(#marsClip)">
        <!-- darker maria -->
        <g fill="#6d2f1b" opacity="0.5">
          <ellipse cx="1232" cy="118" rx="44" ry="26" transform="rotate(-18 1232 118)"/>
          <ellipse cx="1306" cy="176" rx="52" ry="22" transform="rotate(12 1306 176)"/>
          <ellipse cx="1256" cy="196" rx="26" ry="14"/>
        </g>
        <!-- polar cap -->
        <ellipse cx="1262" cy="54" rx="42" ry="16" fill="#f0e4dc" opacity="0.72"/>
        <!-- terminator, shading the lower-right limb -->
        <circle cx="1310" cy="188" r="104" fill="#1a0a07" opacity="0.38" filter="url(#soft)"/>
      </g>

      <!-- Phobos and Deimos, small and dim so Mars stays the subject -->
      <circle cx="1052" cy="268" r="11" fill="#8d8378" opacity="0.8"/>
      <circle cx="1049" cy="265" r="11" fill="#2a2420" opacity="0.45"/>
      <circle cx="1462" cy="330" r="6" fill="#7d7469" opacity="0.7"/>

      <!-- the dust plain -->
      <rect x="0" y="348" width="1600" height="652" fill="url(#dustG)"/>

      <!-- distant crater rim on the horizon -->
      <path d="M0,352 L150,322 L300,348 L430,310 L580,340 L720,316 L880,346
               L1030,320 L1200,348 L1350,322 L1510,346 L1600,330 L1600,520 L0,520 Z"
            fill="#190c0a" opacity="0.95"/>

      <!-- far spires -->
      <g fill="#20100d" opacity="0.6">
        <path d="${spire({ x: 500, groundY: 352, height: 96, width: 46, lean: 6, seed: 3 })}"/>
        <path d="${spire({ x: 940, groundY: 350, height: 78, width: 38, lean: -5, seed: 11 })}"/>
      </g>

      <!-- mid-distance spires on the horizon -->
      <g fill="#140907" opacity="0.85">
        <path d="${spire({ x: 250, groundY: 420, height: 206, width: 84, lean: -16, seed: 7 })}"/>
        <path d="${spire({ x: 1400, groundY: 424, height: 172, width: 72, lean: 14, seed: 29 })}"/>
      </g>

      <!-- FOREGROUND spires rooted at the bottom of the frame, carrying the
           silhouette down both edges -->
      <g fill="#070303">
        <path d="${spire({ x: 70, groundY: 1000, height: 700, width: 240, lean: -40, seed: 101 })}"/>
      </g>
      <g fill="#070303" opacity="0.96">
        <path d="${spire({ x: 1540, groundY: 1000, height: 640, width: 210, lean: 34, seed: 202 })}"/>
      </g>

      <!-- foreground boulders framing the bottom corners -->
      <g fill="#0b0505">
        <path d="M0,1000 L0,910 C48,904 92,920 128,940 C158,956 190,966 222,972
                 C254,978 276,986 290,1000 Z"/>
        <path d="M1600,1000 L1600,896 C1546,892 1498,912 1458,936
                 C1426,956 1394,968 1362,976 C1336,982 1316,988 1306,1000 Z"/>
      </g>

      <!-- low dust haze along the horizon and drifting through the near field -->
      <rect x="0" y="330" width="1600" height="220" fill="url(#hazeG)"/>
      <g filter="url(#softer)" opacity="0.55">
        <ellipse cx="320" cy="398" rx="430" ry="26" fill="#9c5433" opacity="0.30"/>
        <ellipse cx="1180" cy="416" rx="500" ry="30" fill="#9c5433" opacity="0.26"/>
      </g>
      <!-- Near-field haze stays faint: the warm dust colour washes the
           foreground mesas out to a flat brown if it is as strong as the
           templar scene's cold fog. -->
      <g filter="url(#softer)" opacity="0.34">
        <ellipse cx="240" cy="612" rx="470" ry="40" fill="#a65c38" opacity="0.16"/>
        <ellipse cx="1340" cy="668" rx="520" ry="46" fill="#a65c38" opacity="0.14"/>
        <ellipse cx="700" cy="812" rx="620" ry="54" fill="#b06540" opacity="0.11"/>
        <ellipse cx="1100" cy="930" rx="680" ry="60" fill="#b06540" opacity="0.10"/>
      </g>
    </svg>

    <div class="bats" aria-hidden="true">
      ${[0, 1, 2, 3].map(i => `
        <svg class="comet c${i}" viewBox="0 0 220 40">
          <defs>
            <linearGradient id="tail${i}" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stop-color="rgba(190,230,255,0.85)"/>
              <stop offset="0.45" stop-color="rgba(140,190,255,0.30)"/>
              <stop offset="1" stop-color="rgba(140,190,255,0)"/>
            </linearGradient>
          </defs>
          <path d="M206,20 L36,13 L8,20 L36,27 Z" fill="url(#tail${i})"/>
          <circle cx="206" cy="20" r="7" fill="#eaf6ff"/>
          <circle cx="206" cy="20" r="13" fill="rgba(190,230,255,0.28)"/>
        </svg>`).join('')}
    </div>
  `;
  return el;
}
