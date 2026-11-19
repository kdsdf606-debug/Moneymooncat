/* MoonCat — 64x64 pixel-art renderer (port of the 60 s loop), plus reactions. */
(function () {
  const G = 64, LOOP = 60, FPS = 12;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const P = {};
  Object.entries({
    sky0: '#070b1e', sky1: '#0c1430', sky2: '#13204a', sky3: '#1c2f63', halo: '#2b4a86',
    moon0: '#e6f6ff', moon1: '#c4e6fb', moon2: '#9fd0f0', crater: '#b2dbf5', cloudm: '#8fc0e6', clouds: '#35568f',
    cat0: '#0b0b16', cat2: '#1d1d38', rim1: '#3b3a78', rim2: '#6f6ccc', rim3: '#a9b8ff',
    eye0: '#7fd4ff', eye1: '#d4f3ff', eye2: '#3b9bd9', pupil: '#0a1030', glint: '#ffffff',
    gold: '#ffd36a', gold2: '#ffb347', nose: '#c97aa8', star: '#ffffff', starb: '#9ad8ff', starg: '#ffe39a',
    c_in: '#fff1b8', c_out: '#a8823a', c_dg: '#5a4a2a', goldd: '#3a2f22',
    mdark: '#22355f', mdark2: '#283d6b'
  }).forEach(([k, v]) => (P[k] = hex(v)));

  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const MX = 32, MY = 26, MR = 23.5, N = G * G;
  const B = new Float32Array(N), DM = new Float32Array(N), GLOW = new Float32Array(N), MOON = new Uint8Array(N);
  const MOONCOL = new Array(N);
  const XX = i => (i % G) + 0.5, YY = i => ((i / G) | 0) + 0.5;
  for (let i = 0; i < N; i++) {
    const x = XX(i), y = YY(i);
    B[i] = BAY[(y | 0) % 4][(x | 0) % 4] / 16;
    DM[i] = Math.hypot(x - MX, y - MY);
    GLOW[i] = Math.pow(Math.min(1, Math.max(0, 1 - (DM[i] - MR) / 26)), 1.3);
    MOON[i] = DM[i] <= MR ? 1 : 0;
    if (MOON[i]) {
      let c = P.moon1;
      const sh = ((x - MX) * 0.55 + (y - MY) * 0.85) / MR;
      if (sh + 0.18 * (B[i] - 0.5) < -0.3) c = P.moon0;
      if (sh + 0.18 * (B[i] - 0.5) > 0.6) c = P.moon2;
      if (DM[i] > MR - 1.2) c = P.moon2;
      for (const [cx, cy, r] of [[15, 18, 2.6], [21, 11, 1.8], [46, 14, 2.2], [50, 23, 1.5], [13, 28, 1.6], [41, 7, 1.2]]) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) {
          c = P.crater;
          if (d > r - 1 && y - cy > 0.3) c = P.moon0;
          if (d > r - 1 && y - cy < -0.6) c = P.moon2;
        }
      }
      MOONCOL[i] = c;
    }
  }

  const BLINKS = [4.0, 11.5, 19.0, 19.5, 27.0, 36.5, 44.0, 52.0, 52.5, 57.0];
  const LOOKS = [[7.0, 2.5, -1, 0], [22.0, 2.0, 1, 0], [32.5, 2.0, 0, -1], [46.5, 1.5, -1, 0], [48.0, 1.5, 1, 0]];
  const EAR_R = [13.0, 30.5, 31.0, 55.0], EAR_L = [24.5, 41.0, 41.5];
  const SHOOT = [[16.0, [1, 1], [22, 12]], [42.5, [63, 3], [45, 14]], [29.0, [2, 40], [14, 50]]];
  const CLOUDS = [[9, 16, 1, 0.0], [20, 22, 1, 0.55], [33, 13, 2, 0.3]];
  const SMALL = [[5, 22, 'star', 3, 0], [59, 28, 'starb', 4, 1], [12, 4, 'starb', 5, 2], [50, 3, 'star', 2, 0.5],
    [3, 36, 'starb', 6, 3], [60, 55, 'star', 3, 1.5], [54, 33, 'starg', 4, 2.5], [9, 58, 'starb', 5, 0],
    [44, 61, 'star', 2, 1], [20, 60, 'starb', 6, 4], [30, 1, 'starb', 4, 0.5], [61, 17, 'star', 5, 3.5],
    [2, 12, 'starg', 6, 1], [16, 54, 'star', 3, 2]];
  const SPARK = [[8, 9, 'starb', 5, 0], [58, 41, 'starb', 4, 1], [57, 8, 'starg', 6, 2], [7, 49, 'starg', 3, 0.5]];
  const MOTES = [[6, 10, 0], [58, 12, 3], [11, 15, 7], [53, 20, 11], [3, 12, 6.5]];

  const within = (t, t0, d) => t0 <= t && t < t0 + d - 1e-9;
  const id = (x, y) => y * G + x;
  function tri(x, y, a, b, c) {
    const s = (p1, p2) => (x - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (y - p2[1]);
    const d1 = s(a, b), d2 = s(b, c), d3 = s(c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  function nbr(m) {
    const o = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % G, y = (i / G) | 0;
      o[i] = m[id((x + 63) % G, y)] | m[id((x + 1) % G, y)] | m[id(x, (y + 63) % G)] | m[id(x, (y + 1) % G)];
    }
    return o;
  }

  const col = new Array(N);
  const state = {
    mood: 'normal', happyUntil: 0, happyStart: 0,
    lastInput: 0,          // for dozing off when left alone
    pokeAt: -1e9, pokes: [], annoyedUntil: 0,
    gaze: null,            // {x, y, until} in canvas pixels
    loggedAt: -1e9,        // charm ring after saving a record
    sbAt: -1e9,            // slow blink triggered by an event
    bigAt: -1e9,           // a big expense: ears back + side-eye
    rainAt: -1e9,          // level up: star rain
    ripple: null, shots: []
  };
  // what the app tells us about the world: budget health (1 = on track, 0 = broke) and moon age (0..1, 0 = new, .5 = full)
  const scene = { health: 1, phase: 0.5 };
  let lastCat = null;
  const CLOUDS_X = [[27, 26, 1, 0.15], [17, 30, 1, 0.75], [38, 24, 2, 0.55]]; // extra clouds when money is tight
  const SKY = [P.sky0, P.sky1, P.sky2, P.sky3, P.halo]; // always night
  let litCache = [null, null];
  function litMask(p) { // 1 = sunlit, 2 = terminator edge, 0 = in shadow
    const key = Math.round(p * 100);
    if (litCache[0] === key) return litCache[1];
    const m = new Uint8Array(N), k = Math.cos(2 * Math.PI * p), wax = p < 0.5;
    for (let i = 0; i < N; i++) {
      if (!MOON[i]) continue;
      const dx = (XX(i) - MX) / MR, dy = (YY(i) - MY) / MR;
      const xs = dx / Math.sqrt(Math.max(1e-4, 1 - dy * dy));
      const v = wax ? xs - k : -k - xs;
      m[i] = v > 0.06 ? 1 : v > -0.06 ? 2 : 0;
    }
    litCache = [key, m];
    return m;
  }
  const DOZE_MS = 60000;
  const SLOW_BLINKS = [15.0, 38.0];          // idle "I trust you" slow blinks (loop seconds)
  const FIREFLY = [[20.5, 7], [47.0, 6]];    // [start, duration] — a light drifts past
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // 0 → 5 → 0 lid drop over `dur` seconds
  const slowBlink = (e, dur = 2.4) => (e < 0 || e > dur ? 0 : 5 * Math.min(1, (e / dur) / 0.4, (1 - e / dur) / 0.4));

  function render(t, now) {
    t = ((t % LOOP) + LOOP) % LOOP;
    const happy = now < state.happyUntil;
    const dozing = now - state.lastInput > DOZE_MS;
    const annoyed = now < state.annoyedUntil;
    const sincePoke = now - state.pokeAt;
    const flick = sincePoke < 700, purr = !annoyed && sincePoke > 400 && sincePoke < 3200;
    let ff = null;
    for (const [t0, d] of FIREFLY) if (!dozing && within(t, t0, d)) {
      const u = (t - t0) / d;
      ff = { x: -2 + 68 * u, y: 18 + 9 * u + 7 * Math.sin(2 * Math.PI * u * 1.5), u };
    }
    // night sky — cloudier and darker when the budget runs thin
    const cloud = clamp((1 - scene.health) / 0.8, 0, 1);
    const br = 0.22 * Math.sin(2 * Math.PI * t / 6) - 0.35 * cloud;
    const lit = litMask(scene.phase);
    for (let i = 0; i < N; i++) {
      if (MOON[i]) { col[i] = lit[i] === 1 ? MOONCOL[i] : lit[i] === 2 ? P.moon2 : B[i] > 0.5 ? P.mdark : P.mdark2; continue; }
      let v = GLOW[i] * 4 + br + B[i] - 0.5;
      v = Math.round(Math.min(4, Math.max(0, v)));
      col[i] = SKY[v];
    }
    const starVis = 0.3 + 0.7 * (1 - cloud);
    SMALL.forEach(([x, y, c, per, ph], k) => {
      if ((k + 0.5) / SMALL.length > starVis) return;
      const s = ((t + ph) % per) / per;
      if (s < 0.55) col[id(x, y)] = P[c];
      else if (s < 0.7 || s > 0.9) col[id(x, y)] = SKY[4];
    });
    for (const [t0, a, b] of SHOOT) {
      if (!within(t, t0, 0.92)) continue;
      const u = (t - t0) / 0.92;
      ['star', 'star', 'starb', 'starb', 'halo', 'halo', 'sky3'].forEach((c, k) => {
        const uu = u * 1.25 - k * 0.045;
        if (uu < 0 || uu > 1) return;
        const x = Math.round(a[0] + (b[0] - a[0]) * uu), y = Math.round(a[1] + (b[1] - a[1]) * uu);
        if (x >= 0 && x < G && y >= 0 && y < G && !MOON[id(x, y)]) col[id(x, y)] = P[c];
      });
    }
    // shooting stars you made by tapping the sky
    state.shots = state.shots.filter(s => now - s.at < 900);
    for (const s of state.shots) {
      const u = (now - s.at) / 900;
      ['star', 'star', 'starb', 'starb', 'halo', 'halo'].forEach((c, k) => {
        const uu = u * 1.25 - k * 0.05;
        if (uu < 0 || uu > 1) return;
        const x = Math.round(s.x - 16 * uu), y = Math.round(s.y + 11 * uu);
        if (x >= 0 && x < G && y >= 0 && y < G && !MOON[id(x, y)]) col[id(x, y)] = P[c];
      });
    }
    const dense = cloud > 0.6;
    const clouds = CLOUDS.concat(CLOUDS_X.filter((_, k) => cloud > 0.15 + k * 0.28));
    for (const [cy, L, laps, ph] of clouds) {
      const Wd = G + L + 8, x0 = -L + ((ph + t * laps / LOOP) % 1) * Wd;
      [[3, L - 7], [0, L], [2, L - 4]].forEach(([off, ln], row) => {
        const y = cy + row;
        for (let x = Math.floor(x0 + off); x < Math.floor(x0 + off + ln); x++) {
          if (x < 0 || x >= G) continue;
          const i = id(x, y);
          if (MOON[i]) { if (dense || row === 1 || B[i] > 0.3) col[i] = row ? P.cloudm : P.moon2; }
          else if (GLOW[i] > 0.3 && (dense || B[i] > 0.45)) col[i] = P.clouds;
        }
      });
    }

    // tapped the moon: soft ripples spread across its surface
    const re = state.ripple ? (now - state.ripple.at) / 1300 : 2;
    if (re < 1) for (let i = 0; i < N; i++) {
      if (!MOON[i]) continue;
      const d = Math.hypot(XX(i) - state.ripple.x, YY(i) - state.ripple.y);
      for (const r of [22 * re, 22 * re - 5]) {
        if (r <= 0 || B[i] < re * 0.7) continue;
        if (Math.abs(d - r) < 0.7) col[i] = lit[i] === 1 ? P.clouds : P.halo;          // dark crest
        else if (Math.abs(d - r + 1.2) < 0.6) col[i] = lit[i] === 1 ? P.glint : P.cloudm; // bright trough
      }
    }

    // ---- cat
    const tw = ts => ts.some(a => within(t, a, 0.17));
    const hp = happy && now - state.happyStart < 170;
    const ffNear = side => ff && Math.abs(ff.x - (32 + side * 17)) < 9 && Math.floor(t * 4) % 3 === 0;
    const eR = tw(EAR_R) || hp || ffNear(1), eL = tw(EAR_L) || hp || ffNear(-1);
    const flat = annoyed || sincePoke < 450 || now - state.bigAt < 1500; // ears pressed back
    const tipL = flat ? [11.5, 14] : eL ? [14.5, 11] : [13.5, 10];
    const tipR = flat ? [52.5, 14] : eR ? [49.5, 11] : [50.5, 10];
    const breath = (t % (dozing ? 6 : 4)) < (dozing ? 3 : 2) ? 1 : 0;
    const sway = annoyed ? 1.6 * Math.sin(2 * Math.PI * t / 0.45)
      : flick ? 1.3 * Math.sin(2 * Math.PI * sincePoke / 700)
      : Math.sin(2 * Math.PI * t / (happy ? 1.2 : dozing ? 9 : 5));
    const cat = new Uint8Array(N), tail = new Uint8Array(N), body = new Uint8Array(N), inner = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = XX(i), y = YY(i);
      const head = ((x - 32) / 15) ** 2 + ((y - 38) / 11) ** 2 <= 1;
      const cheek = ((Math.abs(x - 32) - 8.5) / 8.4) ** 2 + ((y - 43.5) / 5.2) ** 2 <= 1;
      const ears = tri(x, y, [20, 33], tipL, [31, 27]) || tri(x, y, [44, 33], tipR, [33, 27]);
      const bd = y >= 47 && Math.abs(x - 32) <= 8 + Math.max(0, y - (51 - breath)) * 1.5;
      body[i] = bd ? 1 : 0;
      cat[i] = head || cheek || ears || bd ? 1 : 0;
      inner[i] = tri(x, y, [21.5, 28], [tipL[0] + 3.5, tipL[1] + 5.5], [26.5, 26]) || tri(x, y, [42.5, 28], [tipR[0] - 3.5, tipR[1] + 5.5], [37.5, 26]) ? 1 : 0;
    }
    for (let k = 0; k < 40; k++) {
      const u = k / 39;
      const tx = 45 + 9.5 * u + sway * 2.6 * u * u + 1.5 * Math.sin(Math.PI * u);
      const ty = 64 - 17 * u + 1.5 * sway * u ** 3, r = 2.5 - 0.9 * u;
      for (let y = Math.floor(ty - r - 1); y <= Math.ceil(ty + r); y++)
        for (let x = Math.floor(tx - r - 1); x <= Math.ceil(tx + r); x++)
          if (x >= 0 && x < G && y >= 0 && y < G && Math.hypot(x + 0.5 - tx, y + 0.5 - ty) <= r) { tail[id(x, y)] = 1; cat[id(x, y)] = 1; }
    }
    for (const [fx, fy] of [[16, 42.5], [48, 42.5], [17, 46], [47, 46]])
      for (let i = 0; i < N; i++) if (Math.abs(XX(i) - fx) < 1 && Math.abs(YY(i) - fy) < 1) cat[i] = 1;
    lastCat = cat;
    for (let i = 0; i < N; i++) if (cat[i]) col[i] = inner[i] ? P.cat2 : P.cat0;
    const vis = new Uint8Array(N), open = new Uint8Array(N);
    for (let i = 0; i < N; i++) { vis[i] = MOON[i] && !cat[i] ? 1 : 0; open[i] = !cat[i] && !MOON[i] ? 1 : 0; }
    const nv = nbr(vis), edge1 = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (cat[i] && nv[i]) { edge1[i] = 1; col[i] = YY(i) < 22 ? P.rim3 : P.rim2; }
    const ne = nbr(edge1), no = nbr(open);
    for (let i = 0; i < N; i++) {
      if (!cat[i] || edge1[i]) continue;
      if (ne[i] && YY(i) < 40) col[i] = P.rim1;
      if (no[i] && GLOW[i] > 0.25 && (YY(i) < 50 || tail[i])) col[i] = P.rim1;
    }

    // ---- eyes
    let op = 2;
    for (const b of BLINKS) if (within(t, b, 4 / FPS)) op = [1, 0, 0, 1][Math.floor((t - b) * FPS + 1e-6)];
    // how far the upper lid has dropped (0 open … 4+ shut)
    let drop = state.mood === 'sleepy' ? 2 : state.mood === 'sad' ? 1 : 0;
    if (op === 1) drop = Math.max(drop, 1);
    if (op === 0) drop = 5;
    for (const s of SLOW_BLINKS) drop = Math.max(drop, slowBlink(t - s));
    drop = Math.max(drop, slowBlink((now - state.sbAt) / 1000));
    if (purr) drop = Math.max(drop, 2.5);
    if (annoyed) drop = Math.max(1.5, op === 0 ? 5 : 1.5);
    if (dozing) drop = 5;
    // where the slit pupils look: firefly > tap point > scripted glances
    let gx = null;
    if (ff) gx = ff.x;
    else if (state.gaze && now < state.gaze.until) gx = state.gaze.x;
    let px = 0;
    for (const [t0, d, dx] of LOOKS) if (within(t, t0, d)) px = dx;
    if (annoyed) px = 0;
    // half-moon eyes: flat heavy upper lid, round glowing bottom, thin slit pupil.
    // Always calm and flat — no happy face.
    const eyes = new Uint8Array(N), LID = 36, RX = 4.4, RY = 4.8;
    for (const [cx] of [[24.5], [39.5]]) {
      const c0 = Math.round(cx - 0.5);
      if (drop >= 4) { // shut: a soft downward curve
        for (let k = -4; k <= 4; k++) col[id(c0 + k, Math.abs(k) >= 4 ? LID + 1 : LID + 2)] = P.eye2;
        continue;
      }
      const lid = LID + Math.round(drop);
      for (let i = 0; i < N; i++) {
        const x = XX(i), y = YY(i);
        if (y < lid || ((x - cx) / RX) ** 2 + ((y - LID) / RY) ** 2 > 1) continue;
        eyes[i] = 1;
        col[i] = y < lid + 1 ? P.eye2 : y > LID + 2.5 ? P.eye1 : P.eye0;
      }
      const sx = c0 + (gx === null ? px : clamp(Math.round((gx - cx) / 7), -2, 2));
      for (let i = 0; i < N; i++) if (eyes[i] && (i % G) === sx) col[i] = P.pupil;
      if (drop < 1) col[id(c0 - 2, LID + 1)] = P.eye1;
    }
    const nEye = nbr(eyes), thr = 0.5 + 0.3 * Math.sin(2 * Math.PI * t / 4);
    for (let i = 0; i < N; i++) if (nEye[i] && cat[i] && !eyes[i] && B[i] > thr) col[i] = P.rim1;

    // no nose; a tiny flat mouth, barely there
    col[id(31, 45)] = P.rim1; col[id(32, 45)] = P.rim1;
    const wsh = eR || eL || (purr && (Math.floor(now / 90) & 1)) ? 1 : 0; // purr = whisker tremble
    for (const [y0, dy] of [[44, -0.15], [46, 0.18]])
      for (const side of [-1, 1]) {
        let out = 0;
        for (let k = 0; k < 20; k++) {
          const x = Math.round(32 + side * (6 + k));
          const y = Math.round(y0 + dy * k) - (dy < 0 ? wsh : -wsh) * (out >= 2 ? 1 : 0);
          if (x >= 0 && x < G && !cat[id(x, y)]) { out++; if (out <= 4) col[id(x, y)] = P.rim2; }
        }
      }

    // forehead crescent + shimmer, with a slow breathing glow around it
    const s5 = t % 5, glow = 0.5 + 0.5 * Math.sin(2 * Math.PI * t / 6);
    for (let i = 0; i < N; i++) {
      const x = XX(i), y = YY(i), dc = Math.hypot(x - 32, y - 29.5);
      if (cat[i] && !eyes[i] && dc > 2.4 && dc < 2.4 + 2.2 * glow && B[i] < 0.55 * glow) col[i] = P.goldd;
      if (Math.hypot(x - 32, y - 29.5) <= 2.4 && !(Math.hypot(x - 33.2, y - 28.7) <= 2.0)) {
        col[i] = x < 31 && y > 29 ? P.gold2 : P.gold;
        if (s5 < 0.5 && ((i / G) | 0) === 27 + Math.floor(s5 / 0.5 * 5)) col[i] = P.glint;
      }
      if (body[i] && y >= 50 && y <= 51 && Math.abs(x - 32) <= 12) col[i] = P.rim1;
    }

    // star charm
    const s3 = (t % 3) / 3;
    let stage = s3 < 0.5 ? 0 : s3 < 0.62 ? 1 : s3 < 0.76 ? 2 : s3 < 0.88 ? 1 : 0;
    if (happy || now - state.loggedAt < 1200 || now - state.rainAt < 2500) stage = 2;
    const pts = new Map();
    const ray = (d, c) => [[-1 - d, 0], [-1 - d, -1], [d, 0], [d, -1], [0, -1 - d], [-1, -1 - d], [0, d], [-1, d]].forEach(p => pts.set(p + '', c));
    ray(1, 'c_in'); ray(2, 'c_out');
    const diag = (o, c) => [[-o, -o], [-o, o - 1], [o - 1, -o], [o - 1, o - 1]].forEach(p => pts.set(p + '', c));
    diag(2, 'c_dg');
    if (stage >= 1) { ray(2, 'gold'); ray(3, 'c_out'); diag(2, 'c_out'); }
    if (stage === 2) { ray(2, 'c_in'); ray(3, 'gold'); ray(4, 'c_out'); diag(3, 'c_dg'); }
    [[0, 0], [0, -1], [-1, 0], [-1, -1]].forEach(p => pts.set(p + '', 'star'));
    for (const [k, c] of pts) { const [dy, dx] = k.split(',').map(Number); col[id(32 + dx, 54 + dy)] = P[c]; }

    // sparkles + motes
    for (const [x, y, c, per, ph] of SPARK) {
      if (starVis < 0.6) continue;
      const s = ((t + ph) % per) / per;
      const size = s < 0.25 ? 0 : s < 0.45 ? 1 : s < 0.65 ? 2 : s < 0.85 ? 1 : 0;
      if (cat[id(x, y)]) continue;
      col[id(x, y)] = size ? P.star : P[c];
      for (let r = 1; r <= size; r++)
        for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
          const X = x + dx, Y = y + dy;
          if (X >= 0 && X < G && Y >= 0 && Y < G && !cat[id(X, Y)]) col[id(X, Y)] = P[c];
        }
    }
    for (const [x0, per, ph] of MOTES) {
      const u = ((t + ph) % per) / per, y = Math.floor(63 - u * 40), x = Math.round(x0 + 2 * Math.sin(4 * Math.PI * u));
      if (x >= 0 && x < G && !cat[id(x, y)] && !MOON[id(x, y)] && u > 0.08 && u < 0.92)
        col[id(x, y)] = (Math.floor(t * 3) + x0) % 3 ? P.starb : P.halo;
    }
    if (happy) {
      const e = (now - state.happyStart) / 1400;
      for (let k = 0; k < 5; k++) {
        const u = Math.min(1, e * 1.2 - k * 0.12);
        if (u <= 0 || u >= 1) continue;
        const x = Math.round(18 + k * 7 + 2 * Math.sin(u * 6 + k)), y = Math.round(26 - u * 22);
        if (y >= 0 && x >= 0 && x < G && !cat[id(x, y)]) {
          col[id(x, y)] = u < 0.6 ? P.star : P.gold;
          if (u < 0.5) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!cat[id(x + dx, y + dy)]) col[id(x + dx, y + dy)] = P.gold;
        }
      }
    }

    // saved a record: a ring of light spreads from the star charm
    const le = (now - state.loggedAt) / 1000;
    if (le >= 0 && le < 1) {
      const r = 2 + 18 * le;
      for (let i = 0; i < N; i++) {
        if (eyes[i]) continue;
        const d = Math.hypot(XX(i) - 32, YY(i) - 54);
        if (Math.abs(d - r) < 0.8 && B[i] > le * 0.9) col[i] = le < 0.45 ? P.gold : cat[i] ? P.c_dg : P.c_out;
      }
    }

    // level up: a short shower of falling stars
    const ra = (now - state.rainAt) / 2600;
    if (ra >= 0 && ra < 1) for (let k = 0; k < 18; k++) {
      const x = (k * 37 + 5) % G, u = ra * 1.7 - (k % 6) * 0.11;
      if (u <= 0 || u >= 1) continue;
      const y = Math.round(-3 + u * 60 + (k % 3) * 4);
      for (const [dy, c] of [[0, 'star'], [-1, 'starg'], [-2, 'c_dg']]) {
        const Y = y + dy;
        if (Y >= 0 && Y < G && !cat[id(x, Y)]) col[id(x, Y)] = P[c];
      }
    }

    // firefly drifting past (the cat watches it)
    if (ff && ff.u > 0.02 && ff.u < 0.98) {
      const x = Math.round(ff.x), y = Math.round(ff.y), bright = Math.floor(t * 2.5) % 3 !== 0;
      const put = (X, Y, c) => { if (X >= 0 && X < G && Y >= 0 && Y < G) col[id(X, Y)] = c; };
      put(x, y, bright ? P.c_in : P.gold);
      if (bright) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!MOON[id(clamp(x + dx, 0, 63), clamp(y + dy, 0, 63))]) put(x + dx, y + dy, P.gold2);
      const tx = Math.round(ff.x - 3 * Math.cos(ff.u * 9)), ty = Math.round(ff.y + 1); // faint trail
      if (!MOON[id(clamp(tx, 0, 63), clamp(ty, 0, 63))]) put(tx, ty, P.c_dg);
    }

    // left alone too long: dozing, little z's float up
    if (dozing) {
      for (let k = 0; k < 2; k++) {
        const u = ((now / 1000 + k * 1.6) % 3.2) / 3.2;
        const zx = Math.round(47 + 9 * u + k), zy = Math.round(24 - 16 * u), big = u > 0.45;
        const glyph = big ? ['xxx', '..x', '.x.', 'x..', 'xxx'] : ['xx', '.x', 'xx'];
        if (u > 0.9) continue;
        glyph.forEach((row, gy) => [...row].forEach((ch, gx2) => {
          const X = zx + gx2, Y = zy + gy;
          if (ch === 'x' && X < G && Y >= 0 && !cat[id(X, Y)]) col[id(X, Y)] = u < 0.7 ? P.starb : P.halo;
        }));
      }
    }
  }

  const canvases = new Set();
  const img = new ImageData(G, G);
  let lastFrame = -1;
  function frame(nowMs) {
    const t = nowMs / 1000;
    const f = Math.floor(t * FPS);
    if (f !== lastFrame) {
      lastFrame = f;
      render(f / FPS, nowMs);
      const d = img.data;
      for (let i = 0; i < N; i++) { const c = col[i]; d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; }
      for (const cv of canvases) if (cv.isConnected && cv.offsetParent !== null) cv.getContext('2d').putImageData(img, 0, 0);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.MoonCat = {
    attach(cv) { cv.width = G; cv.height = G; canvases.add(cv); },
    happy(ms = 1400) { const n = performance.now(); state.lastInput = n; state.happyStart = n; state.happyUntil = n + ms; },
    setMood(m) { state.mood = m; },
    // Tap on the cat. fx, fy = tap position as 0..1 of the canvas. Returns 'wake' | 'annoyed' | 'purr'.
    poke(fx = 0.5, fy = 0.5) {
      const n = performance.now(), wasAsleep = n - state.lastInput > DOZE_MS;
      state.lastInput = n;
      state.gaze = { x: fx * G, y: fy * G, until: n + 1500 };
      if (wasAsleep) { state.pokes = []; return 'wake'; }
      const X = clamp(Math.floor(fx * G), 0, G - 1), Y = clamp(Math.floor(fy * G), 0, G - 1), i = id(X, Y);
      if (lastCat && !lastCat[i]) { // tapped the background, not the cat
        if (MOON[i]) { state.ripple = { x: X + 0.5, y: Y + 0.5, at: n }; return 'moon'; }
        state.shots.push({ x: X, y: Y, at: n }); return 'star';
      }
      state.pokes = state.pokes.filter(p => n - p < 2500).concat(n);
      if (state.pokes.length >= 4 || n < state.annoyedUntil) {
        state.annoyedUntil = n + 2500; state.pokes = [];
        return 'annoyed';
      }
      state.pokeAt = n;
      return 'purr';
    },
    // A record was saved: charm ring + an acknowledging slow blink.
    // big: the amount was more than today's safe allowance → ears back, a long side-eye first.
    // levelUp: star shower.
    logged({ big = false, levelUp = false } = {}) {
      const n = performance.now();
      state.lastInput = n; state.loggedAt = n;
      if (big) {
        state.bigAt = n; state.sbAt = n + 1700;
        state.gaze = { x: 70, y: 36, until: n + 1500 };
      } else {
        state.sbAt = n + 500;
        state.gaze = { x: 32, y: 54, until: n + 500 }; // glance down at the charm
      }
      if (levelUp) state.rainAt = n + 300;
    },
    // health: 1 = budget on track … 0 = nothing left; phase: moon age 0..1 (0 new, 0.5 full)
    setScene({ health, phase } = {}) {
      if (Number.isFinite(health)) scene.health = clamp(health, 0, 1);
      if (Number.isFinite(phase)) scene.phase = ((phase % 1) + 1) % 1;
    },
    wake() { state.lastInput = performance.now(); }
  };
  state.lastInput = performance.now();
})();
