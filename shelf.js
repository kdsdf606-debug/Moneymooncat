/* Moon's bookshelf — a close-up of the bookcase, reached from the room by a slow camera push-in.
   The scene is its own small pixel canvas (120 wide, same pixel size as the room). Moon is a side-view cat built from
   bones (two-bone legs with IK, a spring-driven head and a chain tail), so feet stay planted when he walks and every
   change of pose is a smooth blend instead of a swap of frames.

   Shelf.attach({cv, room, box, cap, back, vig, books(), say(text, {x,y}), words(key), mood() -> 'good'|'normal'|'sad'|'sleepy', lampMix(), candle(), geom(), hold(on), readShow(title, colour, 'top'|'bot'), readText(typed, rest, done), readHide(), onClose()})
   Shelf.open() / Shelf.close()
*/
(function () {
  'use strict';
  const W = 120, FPS = 30; // FPS is the default; the loop drops to 20 / 15 on slow phones and while Moon sleeps
  let H = 200;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const C = {};
  Object.entries({
    wall: '#141a3c', wall2: '#171f46', wallDot: '#1c2550', gap: '#120f26',
    wood: '#2c2344', woodD: '#1c162f', woodL: '#3a2f58', woodH: '#54467d', back: '#161127', back2: '#1a1430',
    brass: '#a8823a', brassL: '#ffd36a', brassD: '#5a4a2a',
    page: '#e6f0ff', page2: '#c4e6fb', ink: '#0c1430',
    bk1: '#c4e6fb', bk2: '#ffd36a', bk3: '#ff9fb5', bk4: '#8fd9c4', bk5: '#8f8cf0', bk6: '#5d6a9a', bk7: '#a8823a',
    leaf: '#3f7a5a', leafL: '#5fa37a', leafD: '#2a5240', pot: '#6b3f2a', potL: '#8a5236',
    shadeOn: '#ffe7a8', shadeOn2: '#ffd36a', moon0: '#e6f6ff', star: '#ffffff', starB: '#9ad8ff', starG: '#ffe39a',
    sky1: '#0c1430', frame: '#2f4183', cover: '#ff9fb5', coverD: '#b05a7a', blush: '#7a3a5c',
    // the cat
    cat: '#0b0b16', catFar: '#070710', catHi: '#13132c', catHi2: '#1b1b3b', catR: '#34337a', catRL: '#6563c4', catRd: '#1f1e4c', catFarR: '#1d1c46', inner: '#1d1d38',
    earIn: '#3a2a5c', eye: '#7fd4ff', eyeL: '#d4f3ff', eyeD: '#3b9bd9', pupil: '#0a1030', glint: '#ffffff', gold: '#ffd36a', gold2: '#ffb347',
    collar: '#3b3a78', collarL: '#5a59b0', nose: '#c97aa8'
  }).forEach(([k, v]) => (C[k] = hex(v)));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const sstep = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const eio = k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const mulc = (c, k) => [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
  const mixc = (a, b, k) => [Math.round(lerp(a[0], b[0], k)), Math.round(lerp(a[1], b[1], k)), Math.round(lerp(a[2], b[2], k))];
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const bay = (x, y) => BAY[y & 3][x & 3] / 16;
  const now = () => Date.now();
  const gust = t => Math.max(0, Math.sin(t * .11 + 1) * Math.sin(t * .29 + .5)); // same soft breeze as the room (room.js), so both sway together
  const breeze = t => .55 + .9 * gust(t);

  /* ---------------- raster helpers ---------------- */
  const buf = () => new Uint8ClampedArray(W * H * 4);
  function set(b, x, y, c, a = 255) {
    x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H || !c) return;
    const i = (y * W + x) * 4;
    if (a >= 255) { b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = 255; }
    else { const k = a / 255; b[i] = b[i] * (1 - k) + c[0] * k; b[i + 1] = b[i + 1] * (1 - k) + c[1] * k; b[i + 2] = b[i + 2] * (1 - k) + c[2] * k; b[i + 3] = 255; }
  }
  const rect = (b, x, y, w, h, c, a) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(b, x + i, y + j, c, a); };
  const ell = (b, cx, cy, rx, ry, c, a) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) set(b, x, y, c, a); };

  /* ---------------- the twelve books: one per thing Moon can tell you ---------------- */
  const ICON = {
    week: ['#####', '#####', '#.#.#', '#####', '#.#.#'],
    cat: ['..#..', '.###.', '#####', '.###.', '..#..'],
    day: ['#.#.#', '.###.', '#####', '.###.', '#.#.#'],
    pace: ['....#', '...##', '..###', '.####', '#####'],
    flow: ['.###.', '#....', '.###.', '....#', '.###.'],
    big: ['..#..', '#####', '.###.', '.#.#.', '#...#'],
    streak: ['..#..', '.##..', '.###.', '#####', '.###.'],
    goal: ['#####', '#...#', '#.#.#', '#...#', '#####'],
    remind: ['..#..', '.###.', '.###.', '#####', '..#..'],
    hist: ['....#', '.#..#', '.#.##', '##.##', '#####'],
    tip: ['..#..', '..#..', '#####', '.###.', '..#..'],
    quiet: ['.###.', '#...#', '#...#', '#...#', '.###.']
  };
  const TOPICS = [
    {id: 'week', title: 'this week', col: '#5fb8e8', row: 0},
    {id: 'cat', title: 'top category', col: '#e5799a', row: 0},
    {id: 'day', title: 'priciest day', col: '#e8b84a', row: 0},
    {id: 'pace', title: 'month ahead', col: '#6cc4a8', row: 1},
    {id: 'flow', title: 'in & out', col: '#7a76e0', row: 1},
    {id: 'big', title: 'biggest buy', col: '#e88f3a', row: 1},
    {id: 'streak', title: 'streak', col: '#9fc8ec', row: 2},
    {id: 'goal', title: 'your goal', col: '#a8d070', row: 2},
    {id: 'remind', title: 'coming up', col: '#d65f6f', row: 2},
    {id: 'hist', title: 'month by month', col: '#8aa0c8', row: 0},
    {id: 'tip', title: 'where to trim', col: '#c9b27a', row: 1},
    {id: 'quiet', title: 'quiet days', col: '#78a392', row: 2}
  ];
  const SLOT_X = [30, 48, 66, 84];

  /* ---------------- layout (depends on the height the screen gives us) ---------------- */
  const L = {x0: 5, x1: 115, ix0: 9, ix1: 111, top: 10, cab: 30, rowH: 50, ly: [], tp: []};
  const S = {
    cv: null, ctx: null, api: null, base: null, out: null, LFon: null, LFoff: null, LAon: null, LAoff: null,
    state: 'closed', fps: 30, curFps: 30, cost: 0, nF: 0, t0: 0, books: [], sel: null, raf: 0, lastF: -1, parts: [], flame: null, cabY: 0, built: false
  };
  const FOOT = 3; // feet stand this many rows below the plank's back edge (cat is in front of the books)

  function layout() {
    L.rowH = Math.floor((H - L.top - L.cab) / 3);
    for (let r = 0; r < 3; r++) { L.tp[r] = L.top + r * L.rowH; L.ly[r] = L.tp[r] + L.rowH - 7; }
    S.cabY = L.ly[2] + 7;
  }
  const feetY = r => L.ly[r] + FOOT;

  /* ---------------- static scene ---------------- */
  function bookBlock(b, x, w, h, yb, col, o = {}) {
    const y0 = yb - h, light = mulc(col, 1.28), dark = mulc(col, .72), darker = mulc(col, .55);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let c = col;
      if (i === 0) c = light; else if (i === w - 1) c = darker; else if (i === w - 2 && w > 4) c = dark;
      set(b, x + i, y0 + j, c);
    }
    for (let i = 0; i < w; i++) set(b, x + i, y0, mulc(col, 1.45));
    if (o.band !== false) {
      const k = (o.seed | 0) % 3;
      if (k !== 1) for (let i = 1; i < w - 1; i++) set(b, x + i, y0 + 3, dark);
      if (k !== 2) for (let i = 1; i < w - 1; i++) set(b, x + i, yb - 4, dark);
      if (k === 0 && w > 3) { rect(b, x + 1, y0 + 6, w - 2, 3, C.page2); rect(b, x + 1, y0 + 7, w - 2, 1, dark); }
    }
  }
  function drawScene(b) {
    // the wall behind the case
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let c = (x + (y >> 3)) % 12 < 6 ? C.wall : C.wall2;
      if ((x % 12 === 6 && y % 8 === 4) || (x % 12 === 0 && y % 8 === 0)) c = C.wallDot;
      set(b, x, y, c);
    }
    const {x0, x1, ix0, ix1, top} = L;
    // inside of the case: back panel with soft board lines
    for (let y = top; y < H; y++) for (let x = ix0; x < ix1; x++) set(b, x, y, ((x - ix0) % 17 === 0) ? C.back2 : C.back);
    // side posts
    for (const [px, pw, lightLeft] of [[x0, ix0 - x0, true], [ix1, x1 - ix1, true]]) {
      rect(b, px, 3, pw, H - 3, C.wood); rect(b, px, 3, 1, H - 3, C.woodH); rect(b, px + pw - 1, 3, 1, H - 3, C.woodD);
    }
    // crown
    rect(b, x0 - 2, 2, x1 - x0 + 4, 2, C.woodH); rect(b, x0 - 2, 4, x1 - x0 + 4, 3, C.wood); rect(b, x0 - 2, 7, x1 - x0 + 4, 1, C.woodD); rect(b, x0, 8, x1 - x0, 2, C.gap);
    // rows
    S.books = []; S.deco = {};
    let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let r = 0; r < 3; r++) {
      const ly = L.ly[r], avail = ly - L.tp[r] - 3;
      // ambient shade under the plank above
      if (r > 0) for (let k = 0; k < 6; k++) rect(b, ix0, L.tp[r], ix1 - ix0, 1, C.gap, 0), rect(b, ix0, L.tp[r] + k, ix1 - ix0, 1, C.gap, 120 - k * 20);
      // plank: back edge, top surface, front face
      rect(b, ix0, ly, ix1 - ix0, 1, C.woodL); rect(b, ix0, ly + 1, ix1 - ix0, 2, C.wood); rect(b, ix0, ly + 3, ix1 - ix0, 1, C.woodD);
      rect(b, ix0, ly + 4, ix1 - ix0, 1, C.woodH); rect(b, ix0, ly + 5, ix1 - ix0, 1, C.wood); rect(b, ix0, ly + 6, ix1 - ix0, 1, C.woodD);
      for (let x = ix0; x < ix1; x++) if (bay(x, ly) > .8) set(b, x, ly + 1, C.woodL);
      // books: four topic books per row, the rest are quiet fillers
      const topics = TOPICS.filter(tp => tp.row === r);
      const hTop = Math.round(avail * .86);
      topics.forEach((tp, i) => {
        const w = 8, cx = SLOT_X[i] + ((i * 3 + r) % 3) - 1, h = hTop - ((i + r) % 3) * 2;
        S.books.push({id: tp.id, title: tp.title, col: hex(tp.col), row: r, x: cx - 4, w, h, yb: ly, cx, icon: ICON[tp.id], lift: 0, glow: 0, line: null});
      });
      const fill = (xa, xb) => { // fill [xa, xb) with fillers
        let x = xa;
        while (x < xb) {
          let w = 3 + ((rnd() * 3) | 0); if (xb - x - w < 3) w = xb - x;
          if (w < 2) break;
          const h = Math.round(avail * (.4 + rnd() * .3)), c = mulc(mixc([C.bk1, C.bk2, C.bk3, C.bk4, C.bk5, C.bk6, C.bk7][(rnd() * 7) | 0], [90, 84, 120], .35), .4 + rnd() * .1);
          bookBlock(b, x, w, h, ly, c, {seed: (rnd() * 9) | 0});
          x += w + (rnd() < .2 ? 1 : 0);
        }
      };
      fill(ix0 + 14, SLOT_X[0] - 5); for (let q = 0; q < SLOT_X.length - 1; q++) fill(SLOT_X[q] + 4, SLOT_X[q + 1] - 5); fill(SLOT_X[SLOT_X.length - 1] + 4, ix1 - 14);
      // keepsakes at both ends of each row
      if (r === 0) { // a little globe on a brass stand, and a fern
        ell(b, 18, ly - 11, 5.2, 5.2, C.sky1); ell(b, 18, ly - 11, 4.4, 4.4, [34, 72, 120]);
        S.deco.globe = {x: 18, y: ly - 11}; // its continents are drawn live (the globe turns very slowly)
        for (let a = 0; a < 30; a++) { const q = a / 30 * Math.PI * 2; set(b, 18 + Math.cos(q) * 5.8, ly - 11 + Math.sin(q) * 5.8, C.brass); }
        rect(b, 17, ly - 5, 2, 4, C.brassD); rect(b, 14, ly - 1, 8, 1, C.brass); rect(b, 14, ly, 8, 1, C.brassD);
        set(b, 15, ly - 14, C.page, 160); set(b, 16, ly - 15, C.page, 120);
        rect(b, ix1 - 14, ly - 7, 9, 7, C.pot); rect(b, ix1 - 14, ly - 7, 9, 1, C.potL); rect(b, ix1 - 13, ly, 7, 1, C.woodD);
        S.deco.fern = {x: ix1, y: ly}; // the leaves are drawn live
        set(b, ix1 - 9, ly - 8, C.leafD);
      } else if (r === 1) { // a leaning picture, a candle and a mug
        rect(b, 12, ly - 13, 11, 13, C.woodD); rect(b, 13, ly - 12, 9, 11, C.frame); rect(b, 14, ly - 11, 7, 9, C.sky1);
        ell(b, 18, ly - 7, 2.6, 2.6, C.brassL); ell(b, 19.4, ly - 7.6, 2.2, 2.2, C.sky1); set(b, 15, ly - 10, C.star); set(b, 20, ly - 4, C.starB);
        rect(b, 102, ly - 3, 8, 3, C.brass); rect(b, 102, ly - 3, 8, 1, C.brassL); rect(b, 103, ly - 1, 6, 1, C.brassD);
        rect(b, 105, ly - 11, 3, 8, C.page); rect(b, 105, ly - 11, 1, 8, C.page2); set(b, 106, ly - 12, C.ink);
        S.flame = {x: 106, y: ly - 14};
        S.deco.mug = {x: ix1 - 18, y: ly - 6}; S.deco.pic = {y: ly};
        rect(b, ix1 - 20, ly - 5, 4, 5, C.bk1); set(b, ix1 - 16, ly - 4, C.bk1); set(b, ix1 - 16, ly - 3, C.bk1); rect(b, ix1 - 20, ly - 5, 4, 1, C.page);
      } else { // a lying stack and a tiny cactus
        [[11, 15, C.bk5], [12, 13, C.bk3], [11, 14, C.bk2]].forEach(([sx, sw, c], k) => { rect(b, sx, ly - 3 * (k + 1), sw, 3, mulc(c, .85)); rect(b, sx, ly - 3 * (k + 1), sw, 1, mulc(c, 1.2)); rect(b, sx + sw - 2, ly - 3 * (k + 1) + 1, 2, 1, C.page); });
        rect(b, ix1 - 12, ly - 5, 7, 5, C.pot); rect(b, ix1 - 12, ly - 5, 7, 1, C.potL);
        rect(b, ix1 - 10, ly - 12, 3, 7, C.leaf); rect(b, ix1 - 10, ly - 12, 1, 7, C.leafL); rect(b, ix1 - 13, ly - 10, 3, 2, C.leaf); rect(b, ix1 - 13, ly - 12, 2, 3, C.leaf); set(b, ix1 - 9, ly - 8, C.brassL);
      }
    }
    // cabinet under the last row
    const cy = S.cabY;
    rect(b, ix0, cy, ix1 - ix0, H - cy, C.woodD);
    for (const dx of [0, 1]) {
      const x = ix0 + 2 + dx * 49, w = 47, h = H - cy - 8;
      rect(b, x, cy + 3, w, h, C.wood); rect(b, x, cy + 3, w, 1, C.woodH); rect(b, x, cy + 3, 1, h, C.woodL); rect(b, x + w - 1, cy + 3, 1, h, C.woodD); rect(b, x, cy + 3 + h - 1, w, 1, C.woodD);
      rect(b, x + 4, cy + 7, w - 8, h - 9, C.woodD); rect(b, x + 5, cy + 8, w - 10, h - 11, C.wood); rect(b, x + 5, cy + 8, w - 10, 1, C.woodL);
      const kx = dx ? x + 4 : x + w - 6; rect(b, kx, cy + 3 + (h >> 1) - 1, 2, 3, C.brassL); set(b, kx, cy + 3 + (h >> 1) + 2, C.brassD);
    }
    rect(b, ix0, H - 5, ix1 - ix0, 5, C.woodD); rect(b, ix0, H - 5, ix1 - ix0, 1, C.woodL);
  }

  /* ---------------- light: warm lamp from the left, or cool moonlight when the lamp is off ---------------- */
  function bakeLight() {
    const n = W * H; S.LFon = new Float32Array(n); S.LFoff = new Float32Array(n); S.LAon = new Float32Array(n * 3); S.LAoff = new Float32Array(n * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, vig = Math.max(.5, 1 - .55 * (((x - 62) / 78) ** 2 + ((y - H * .5) / (H * .66)) ** 2));
      const d = Math.hypot(x + 36, (y - H * .32) * .8), warm = Math.max(0, 1 - d / 170) ** 1.3;
      S.LFon[i] = (.95 + .5 * warm) * vig; S.LAon[i * 3] = 28 * warm; S.LAon[i * 3 + 1] = 15 * warm; S.LAon[i * 3 + 2] = 0;
      const mo = Math.max(0, 1 - x / 150);
      S.LFoff[i] = (.5 + .16 * mo) * vig; S.LAoff[i * 3] = 0; S.LAoff[i * 3 + 1] = 6 * mo; S.LAoff[i * 3 + 2] = 18 * mo;
    }
  }
  function applyLight(src, dst, mix) {
    const n = W * H, on = S.LFon, off = S.LFoff, ao = S.LAon, af = S.LAoff;
    for (let p = 0; p < n; p++) {
      const f = off[p] + (on[p] - off[p]) * mix, i = p * 4, q = p * 3;
      dst[i] = Math.min(255, src[i] * f + af[q] + (ao[q] - af[q]) * mix);
      dst[i + 1] = Math.min(255, src[i + 1] * f + af[q + 1] + (ao[q + 1] - af[q + 1]) * mix);
      dst[i + 2] = Math.min(255, src[i + 2] * f + af[q + 2] + (ao[q + 2] - af[q + 2]) * mix);
      dst[i + 3] = 255;
    }
  }

  /* ---------------- the topic books, drawn live (they lift when chosen) ---------------- */
  function drawBook(b, bk, t, o) {
    const plain = !!(o && o.plain), empty = !bk.line, col = empty ? mulc(mixc(bk.col, [70, 76, 112], .62), .8) : bk.col;
    const lift = plain ? 0 : Math.round(bk.lift * 3), y1 = bk.yb - lift, y0 = y1 - bk.h, x = bk.x, w = bk.w;
    const light = mulc(col, 1.3), dark = mulc(col, .74), darker = mulc(col, .56), gold = empty ? mulc(C.brass, .6) : C.brassL;
    for (let j = 0; j < bk.h; j++) for (let i = 0; i < w; i++) {
      let c = col; if (i === 0) c = light; else if (i === w - 1) c = darker; else if (i === w - 2) c = dark; else if (i === 1 && bay(i + x, j + y0) > .55) c = mulc(col, 1.1);
      set(b, x + i, y0 + j, c);
    }
    for (let i = 0; i < w; i++) set(b, x + i, y0, mulc(col, 1.5));
    for (const yy of [y0 + 3, y0 + 4, y1 - 5, y1 - 4]) for (let i = 1; i < w - 1; i++) set(b, x + i, yy, (yy === y0 + 3 || yy === y1 - 5) ? gold : mulc(gold, .62));
    const ic = bk.icon, iy = y0 + 7 + Math.round((bk.h - 22) * .4);
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) if (ic[j][i] === '#') set(b, x + 1 + i - (i > 3 ? 0 : 0), iy + j, empty ? mulc(C.ink, 1.6) : C.ink, empty ? 150 : 235);
    if (!empty) { rect(b, x + 3, y1 - 3, 2, 3, C.coverD); set(b, x + 3, y1 - 3, C.cover); } // ribbon
    if (!plain && bk.glow > .02) { // a soft outline while chosen
      const a = 200 * bk.glow * (.75 + .25 * Math.sin(t * 5));
      for (let i = -1; i <= w; i++) { set(b, x + i, y0 - 1, C.brassL, a); }
      for (let j = -1; j <= bk.h; j++) { set(b, x - 1, y0 + j, C.brassL, a * .8); set(b, x + w, y0 + j, C.brassL, a * .8); }
    }
  }

  /* ---------------- Moon: a side-view cat on bones ---------------- */
  const SW = 72, SH = 54, SX = 38, SY = 48; // sprite size and the feet-line origin inside it
  const LB = new Uint8Array(SW * SH), SP = new Uint8ClampedArray(SW * SH * 4);
  let D = 1, XS = 1; // D: facing (+1/-1); XS: horizontal squash used while turning around
  const ID = {tail: 1, fHind: 2, fFront: 3, fEar: 4, body: 5, nHind: 6, nFront: 7, neck: 8, collar: 9, head: 10, ear: 11, ear2: 12};
  const FAR = {2: 1, 3: 1, 4: 1};
  // every shape remembers its bounding box (local coords, y up) so paint() only visits the pixels it can touch
  const bnd = (f, x0, y0, x1, y1) => (f.b = [x0, y0, x1, y1], f);
  const capT = (ax, ay, bx, by, ra, rb) => { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, m = Math.max(ra, rb); return bnd((x, y) => { let u = ((x - ax) * dx + (y - ay) * dy) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u; const cx = ax + dx * u, cy = ay + dy * u, r = ra + (rb - ra) * u; return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r; }, Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m); };
  const ellT = (cx, cy, rx, ry, ang = 0) => { const c = Math.cos(ang), s = Math.sin(ang), m = Math.max(rx, ry); return bnd((x, y) => { const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c; return (u / rx) ** 2 + (v / ry) ** 2 <= 1; }, cx - m, cy - m, cx + m, cy + m); };
  const triT = (a, b2, c) => bnd((x, y) => { const s = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]); const d1 = s(a, b2), d2 = s(b2, c), d3 = s(c, a); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); }, Math.min(a[0], b2[0], c[0]), Math.min(a[1], b2[1], c[1]), Math.max(a[0], b2[0], c[0]), Math.max(a[1], b2[1], c[1]));
  function paint(id, test) {
    let i0 = 0, i1 = SW, j0 = 0, j1 = SH; const bb = test.b;
    if (bb) { // local x -> pixel i = SX + lx * D * XS ; local y -> pixel j = SY - ly
      const xa = SX + bb[0] * D * XS, xb = SX + bb[2] * D * XS;
      i0 = clamp(Math.floor(Math.min(xa, xb)) - 1, 0, SW); i1 = clamp(Math.ceil(Math.max(xa, xb)) + 1, 0, SW);
      j0 = clamp(Math.floor(SY - bb[3]) - 1, 0, SH); j1 = clamp(Math.ceil(SY - bb[1]) + 1, 0, SH);
    }
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const lx = (i + .5 - SX) * D / XS, ly = SY - (j + .5); if (test(lx, ly)) LB[j * SW + i] = id; }
  }
  // two-bone IK: returns the middle joint. bend>0: the joint pushes toward +x (knee), bend<0: toward -x (elbow)
  function ik(hx, hy, fx, fy, l1, l2, bend) {
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy); const maxd = l1 + l2 - .05; if (d > maxd) { dx *= maxd / d; dy *= maxd / d; d = maxd; fx = hx + dx; fy = hy + dy; }
    if (d < .5) d = .5;
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)), mx = hx + dx / d * a, my = hy + dy / d * a;
    const c1 = [mx - dy / d * h, my + dx / d * h], c2 = [mx + dy / d * h, my - dx / d * h];
    const m = (c1[0] - c2[0]) * bend > 0 ? c1 : c2;
    return {m, f: [fx, fy]};
  }
  const POSE = {
    stand: {px: -6, ph: 11.2, ta: .05, tl: 12.4, na: .95, nl: 5.6, hp: .04, nf: [6.2, 0], ff: [8.8, 0], nh: [-7.4, 0], fh: [-4.4, 0], tb: 166, tc: 80},
    sit: {px: -5.6, ph: 5.0, ta: .95, tl: 11.2, na: 1.3, nl: 5.8, hp: .08, nf: [3.2, 0], ff: [5.4, 0], nh: [1.2, 0], fh: [3.4, 0], tb: 204, tc: 120},
    crouch: {px: -5.6, ph: 6.6, ta: -.1, tl: 13, na: .55, nl: 5.4, hp: .45, nf: [8.4, 0], ff: [10.4, 0], nh: [-6.4, 0], fh: [-4.2, 0], tb: 186, tc: 20},
    launch: {px: -7, ph: 9.6, ta: .95, tl: 13.6, na: 1.1, nl: 6, hp: .5, nf: [10.4, 11.5], ff: [12.4, 13.5], nh: [-9, 1.8], fh: [-7, 3.2], tb: 200, tc: 18},
    tuck: {px: -6, ph: 11, ta: .55, tl: 11.6, na: 1.0, nl: 5.6, hp: .35, nf: [5.6, 7.5], ff: [7.8, 8.6], nh: [-4, 4], fh: [-2, 5], tb: 190, tc: 40},
    reach: {px: -6.6, ph: 11.8, ta: .22, tl: 12.6, na: .8, nl: 5.6, hp: .15, nf: [10, 3.6], ff: [11.6, 4.6], nh: [-7.4, .8], fh: [-5, 1.8], tb: 176, tc: 60},
    up: {px: -5.2, ph: 6.4, ta: 1.3, tl: 12.4, na: 1.3, nl: 5.4, hp: .3, nf: [9, 20], ff: [7, 18], nh: [-6.6, 0], fh: [-3.4, 0], tb: 186, tc: 50},
    nap: {px: -5.6, ph: 4.2, ta: .7, tl: 10.4, na: .95, nl: 5.6, hp: -.2, nf: [3.8, 0], ff: [5.8, 0], nh: [1.2, 0], fh: [3.4, 0], tb: 220, tc: 150},
    land: {px: -6, ph: 7, ta: .1, tl: 12, na: .8, nl: 5.2, hp: .1, nf: [7.4, 0], ff: [9.2, 0], nh: [-7.4, 0], fh: [-4.6, 0], tb: 178, tc: 50}
  };
  function mixPose(a, b, k) {
    if (k <= 0) return a; if (k >= 1) return b; const o = {};
    for (const key in a) o[key] = Array.isArray(a[key]) ? [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k)] : lerp(a[key], b[key], k);
    return o;
  }

  const K = { // the cat's state
    x: 60, row: 2, dir: 1, hdir: 1, v: 0, mode: 'idle', gait: 0, sit: 1, crouch: 0, queue: [], at: null, want: null, mt: 0, air: null, turnT: 0,
    hp: 0, hpv: 0, headY: 0, tailLag: 0, tailV: 0, blinkAt: 2, blinkT: -1, ear1: 0, ear2: 0, earAt: 4, happyUntil: 0, lift: 0, airY: 0, landK: 0, lookX: 0, lookY: 0, gaze: null, hs: 1, bob: 0, squash: 0, xs: 1, turnD: .3, pendDir: 1, flipped: true, up: 0, reach: 0, pawNF: null, pawFF: null,
    idleT: 0, actAt: 6, act: null, actT: 0, yawn: 0, lick: 0, tongue: false, slp: 0, sleeping: false, zAt: 1.5, talkAt: 20, stareGaze: false,
    fr: {fg: 0, hy: -1.4, want: 0, timer: 1.2, lookX: 0} // the front-view reading cat: fg = looking at the viewer (1) or the page (0)
  };
  function poseNow(t) {
    let p = mixPose(POSE.stand, POSE.sit, K.sit);
    if (K.crouch > 0) p = mixPose(p, POSE.crouch, K.crouch);
    if (K.air) {
      const u = K.air.u; let q;
      if (u < .3) q = mixPose(POSE.launch, POSE.tuck, sstep(u / .3)); else if (u < .62) q = mixPose(POSE.tuck, POSE.reach, sstep((u - .3) / .32)); else q = POSE.reach;
      p = mixPose(p, q, sstep(K.air.blend));
    }
    if (K.slp > 0) p = mixPose(p, POSE.nap, K.slp);
    if (K.up > 0) p = mixPose(p, POSE.up, K.up);
    if (K.reach > 0 && K.pawNF) { p = mixPose(p, p, .5); p.nf = [lerp(p.nf[0], K.pawNF[0], K.reach), lerp(p.nf[1], K.pawNF[1], K.reach)]; p.ff = [lerp(p.ff[0], K.pawFF[0], K.reach), lerp(p.ff[1], K.pawFF[1], K.reach)]; }
    if (K.landK > 0) p = mixPose(p, POSE.land, K.landK);
    return p;
  }
  const GAIT = {stride: 7, lift: 2.8, stance: .62, ph: {nh: 0, nf: .25, fh: .5, ff: .75}, nx: {nf: 6.6, ff: 6.6, nh: -7.0, fh: -7.0}};
  function gaitFoot(key) {
    const p = (((K.gait + GAIT.ph[key]) % 1) + 1) % 1, nx = GAIT.nx[key], s = GAIT.stride;
    if (p < GAIT.stance) return [nx + s * (.5 - p / GAIT.stance), 0];
    const k = (p - GAIT.stance) / (1 - GAIT.stance); return [nx + s * (-.5 + sstep(k)), GAIT.lift * Math.sin(Math.PI * k)];
  }

  function shade(dim) { // label buffer (LB) -> coloured sprite (SP): rim light on top edges, soft dither, contour where a front part overlaps another
    SP.fill(0);
    const at = (i, j) => (i < 0 || j < 0 || i >= SW || j >= SH) ? 0 : LB[j * SW + i];
    for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
      const id = LB[j * SW + i]; if (!id) continue;
      const far = FAR[id], up = at(i, j - 1), dn = at(i, j + 1), lf = at(i - 1, j), rt = at(i + 1, j);
      let c = far ? C.catFar : C.cat, run = 0; while (run < 4 && at(i, j - 1 - run) === id) run++;
      const topEdge = !up, sideEdge = !lf || !rt, botEdge = !dn;
      if (topEdge) c = far ? C.catFarR : C.catRL;
      else if (sideEdge || botEdge) c = far ? C.catFarR : (botEdge && !sideEdge ? C.catRd : C.catR);
      else if ((up && up < id) || (lf && lf < id) || (rt && rt < id) || (dn && dn < id)) c = far ? C.catFar : (id === ID.collar ? C.collar : C.inner);
      else if (!far && id !== ID.collar) { if (run === 1) c = bay(i, j) > .35 ? C.catHi2 : C.catHi; else if (run === 2 && bay(i, j) > .45) c = C.catHi; else if (run === 3 && bay(i, j) > .8) c = C.catHi; }
      if (id === ID.collar && !topEdge) c = (up !== id) ? C.collarL : C.collar;
      if (id === ID.collar && topEdge) c = C.collarL;
      const k = (i + j * SW) * 4; SP[k] = c[0] * dim; SP[k + 1] = c[1] * dim; SP[k + 2] = c[2] * dim; SP[k + 3] = 255;
    }
  }
  function put(lx, ly, c, a = 255) { const i = Math.round(SX + lx * D * XS), j = Math.round(SY - ly); if (i < 0 || j < 0 || i >= SW || j >= SH) return; const k = (j * SW + i) * 4; if (a >= 255) { SP[k] = c[0]; SP[k + 1] = c[1]; SP[k + 2] = c[2]; SP[k + 3] = 255; } else { const f = a / 255; SP[k] = SP[k + 3] ? SP[k] * (1 - f) + c[0] * f : c[0]; SP[k + 1] = SP[k + 3] ? SP[k + 1] * (1 - f) + c[1] * f : c[1]; SP[k + 2] = SP[k + 3] ? SP[k + 2] * (1 - f) + c[2] * f : c[2]; SP[k + 3] = Math.max(SP[k + 3], a); } }

  function renderCat(t, dim) { // draws into SP (sprite) using the current state K; returns nothing. D = body facing.
    LB.fill(0); D = K.dir; XS = clamp(K.xs, .3, 1);
    let p = poseNow(t);
    const walk = clamp(K.v / 26, 0, 1) * (1 - K.sit * .6);
    const breath = Math.sin(t * (1.5 - .7 * K.slp)) * (.25 + K.sit * .2 + K.slp * .22);
    // walking bob + sway
    const bob = walk * (.45 * Math.sin(K.gait * Math.PI * 4 + .6)), sway = walk * .035 * Math.sin(K.gait * Math.PI * 2);
    const feet = {};
    for (const k of ['nf', 'ff', 'nh', 'fh']) { const g = gaitFoot(k); feet[k] = [lerp(p[k][0], g[0], walk), lerp(p[k][1], g[1], walk)]; }
    const px = p.px, py = p.ph + bob + K.squash * -1, ta = p.ta + sway + breath * .01;
    const sx = px + p.tl * Math.cos(ta), sy = py + p.tl * Math.sin(ta) + breath * .5;
    // the head follows the body with a little lag (spring state K.headY)
    const nAng = p.na + K.headY * .04, hcx = sx + p.nl * Math.cos(nAng), hcy = sy + p.nl * Math.sin(nAng) - K.headY * .35;
    const hp = p.hp + K.hp, hs = K.hs;
    const fx = hs * Math.cos(hp), fy = Math.sin(hp), ux = -hs * Math.sin(hp), uy = Math.cos(hp); // head axes
    const HP = (u, v) => [hcx + u * fx + v * ux, hcy + u * fy + v * uy], hAng = Math.atan2(fy, fx);

    // tail (behind everything)
    const tb = p.tb * Math.PI / 180, tc = p.tc * Math.PI / 180, N = 13, seg = 1.5; let tx = px - 4.2, ty = py + .8, prev = null;
    const swayAmp = lerp(.16, .09, K.sit) + walk * .08 + (K.happyUntil > now() ? .22 : 0), swayF = 1.7 + walk * 1.4 + (K.happyUntil > now() ? 2.2 : 0);
    const tailPts = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), th = tb - tc * Math.pow(u, 1.25) + Math.sin(t * swayF - i * .42) * swayAmp * (.25 + u) + K.tailLag * u * u;
      tx += Math.cos(th) * seg; ty += Math.sin(th) * seg; const r = lerp(2.5, 1.5, u);
      if (ty < r + .4) ty = r + .4; // rests on the ground, never under it
      tailPts.push([tx, ty, r]);
    }
    for (let i = 1; i < tailPts.length; i++) { const a = tailPts[i - 1], c = tailPts[i]; paint(ID.tail, capT(a[0], a[1], c[0], c[1], a[2], c[2])); }

    // legs
    const hipJ = [px - .4, py - 1.3], shJ = [sx + .5, sy - 1.3];
    const leg = (key, far, front) => {
      const j0 = front ? shJ : hipJ, F = feet[key], l1 = front ? 6.0 : 6.1, l2 = front ? 5.7 : 5.8, r = far ? -.25 : 0;
      const fxx = F[0], fyy = F[1] + .2, I = ik(j0[0], j0[1], fxx, fyy, l1, l2, front ? -1 : 1), id = far ? (front ? ID.fFront : ID.fHind) : (front ? ID.nFront : ID.nHind);
      if (front) { paint(id, capT(j0[0], j0[1], I.m[0], I.m[1], 3.0 + r, 2.4 + r)); paint(id, capT(I.m[0], I.m[1], I.f[0], I.f[1], 2.4 + r, 1.95 + r)); }
      else { paint(id, capT(j0[0], j0[1], I.m[0], I.m[1], 4.5 + r, 2.9 + r)); paint(id, capT(I.m[0], I.m[1], I.f[0], I.f[1], 2.5 + r, 1.9 + r)); }
      paint(id, ellT(I.f[0] + 1.1, I.f[1] + 1.0, 2.9, 1.6));
    };
    leg('fh', true, false); leg('ff', true, true);
    // far ear (peeks out behind the head)
    const earRot1 = K.ear1, earRot2 = K.ear2, attentive = K.attent || 0;
    const ear = (bu, bv, tu, tv, rot, id) => { // head-local base centre + tip, rotated about the base
      const c = Math.cos(rot), s = Math.sin(rot), tx2 = tu - bu, ty2 = tv - bv, ru = bu + tx2 * c - ty2 * s, rv = bv + tx2 * s + ty2 * c;
      const a = HP(bu - 2.9, bv - .3), b2 = HP(bu + 2.9, bv + .3), c2 = HP(ru, rv);
      paint(id, triT(a, b2, c2)); return [a, b2, c2, ru, rv];
    };
    ear(1.9, 3.6, 2.9, 10.8, -.12 + earRot2 - attentive * .22 + K.slp * .3, ID.fEar);
    // body: torso capsule, chest, rump
    paint(ID.body, capT(px, py, sx, sy, 5.0 + breath * .15, 5.4 + breath * .2));
    paint(ID.body, ellT(px - .6, py + .3, lerp(5.8, 6.4, K.sit), lerp(5.2, 5.8, K.sit), ta * .5));
    paint(ID.body, ellT(sx + .6, sy - .2, 5.4, 5.2));
    leg('nh', false, false);
    leg('nf', false, true);
    // neck + collar + head
    paint(ID.neck, capT(sx, sy, hcx, hcy - .6, 4.6, 4.2));
    const ncx = lerp(sx, hcx, .55), ncy = lerp(sy, hcy, .55);
    paint(ID.collar, ellT(ncx - .4, ncy - .4, 1.5, 4.1, nAng - Math.PI / 2 + .35));
    paint(ID.head, ellT(HP(0, 0)[0], HP(0, 0)[1], 6.8, 5.8, hAng));
    paint(ID.head, ellT(HP(5.2, -1.9)[0], HP(5.2, -1.9)[1], 3.3, 2.7, hAng));
    paint(ID.head, ellT(HP(-2.2, -3.4)[0], HP(-2.2, -3.4)[1], 4.4, 2.6, hAng + .1));
    const nearEar = ear(-2.9, 3.7, -4.0, 11.6, .08 + earRot1 + attentive * .1 + K.slp * .3, ID.ear);

    shade(dim);
    // charm on the collar
    put(ncx + 1.6, ncy - 4.4, C.gold); put(ncx + 1.6, ncy - 5.4, C.gold2); put(ncx + .6, ncy - 4.4, C.glint, 190);
    // gold crescent on the forehead
    { const c1 = HP(-.4, 4.0), c2 = HP(.9, 4.4), c3 = HP(-1.4, 3.1); put(c1[0], c1[1], C.gold); put(c2[0], c2[1], C.gold2); put(c3[0], c3[1], C.gold2); }
    // inner ear: a small lilac wedge up the middle of the near ear (hidden while the ears are pinned forward)
    if (!K.attent || K.attent < 2) {
      const [ea, eb, ec] = nearEar, bx = (ea[0] + eb[0]) / 2, by = (ea[1] + eb[1]) / 2;
      for (let k = 0; k < 4; k++) { const u = .22 + k * .17, w = (1 - u) * 1.1; for (let o = -1; o <= 1; o++) { if (Math.abs(o) > w) continue; put(lerp(bx, ec[0], u) + o * .8, lerp(by, ec[1], u), C.earIn, o === 0 ? 255 : 200); } }
    }
    // eye
    { const E = HP(2.6, .6);
      const blink = K.blinkT >= 0 || K.yawn > .35 || K.slp > .55, happy = K.happyUntil > now() && K.slp < .3;
      const px2 = (c, r, color, a = 255) => put(E[0] + (c - 1.5) * hs, E[1] + (1 - r) * 1, color, a);
      if (happy) { px2(1, 0, C.eyeL); px2(2, 0, C.eyeL); px2(0, 1, C.eyeL); px2(3, 1, C.eyeL); }
      else if (blink) { for (let c = 0; c < 4; c++) px2(c, 1, C.eyeD); }
      else {
        const rows = ['.##.', '####', '.##.'], tone = [C.eyeL, C.eye, C.eyeD];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if (rows[r][c] === '#') { if (K.sleepy && r === 0) continue; px2(c, r, tone[r]); }
        const pc = clamp(2 + K.lookX, 1, 3), pr = K.lookY > 0 ? 0 : K.lookY < 0 ? 1 : 0; px2(pc, pr, C.pupil); px2(pc, pr + 1, C.pupil); px2(1, 0, C.glint);
      }
    }
    // whiskers
    const wh = HP(5.6, -1.4); for (const [ang, len] of [[.18, 6], [-.12, 6.5], [-.42, 5]]) { const a = ang + Math.sin(t * 1.3 + ang * 7) * .03; for (let s = 1; s <= len; s++) { const wx = wh[0] + hs * Math.cos(a) * s, wy = wh[1] + Math.sin(a) * s + (hp * s * .35); const i = Math.round(SX + wx * D * XS), j = Math.round(SY - wy); if (i >= 0 && j >= 0 && i < SW && j < SH && !LB[j * SW + i]) put(wx, wy, C.catR, 150 - s * 14); } }
    // muzzle tip highlight (no nose, just a gleam)
    const mz = HP(7.1, -1.2); put(mz[0], mz[1], C.catRL, 210); const ns = HP(6.4, -.1); put(ns[0], ns[1], C.nose, 235);
    // a yawn: the mouth opens under the muzzle; a lick: a small pink tongue
    if (K.yawn > .35) { [[5.4, -2.5, C.blush], [6.3, -2.5, C.blush], [5.2, -3.4, C.nose], [6.1, -3.4, C.blush], [5.6, -4.3, C.blush]].forEach(([u, v, c]) => { const q = HP(u, v); put(q[0], q[1], c); }); }
    if (K.tongue) { const q = HP(6.9, -2.7), q2 = HP(7.5, -3.3); put(q[0], q[1], C.cover); put(q2[0], q2[1], C.cover, 200); }
    K.headC = [K.x + hcx * D, feetY(K.row) + K.airY - hcy];
  }

  /* ---------------- Moon reading: a front view, sitting behind an open book ---------------- */
  function renderFront(t, dim) {
    LB.fill(0); D = 1; XS = 1;
    const T = S.take, rd = T && T.rd, f = K.fr, hy = f.hy, br = Math.sin(t * 1.5) * .3, happy = K.happyUntil > now();
    // tail: leaves the right haunch, curls up and over
    const N = 15, seg = 1.5; let tx = 8.8, ty = 2.4; const sw = happy ? .3 : .15, sf = happy ? 4.2 : 1.9;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), th = lerp(.02, 2.7, Math.pow(u, 1.15)) + Math.sin(t * sf - i * .4) * sw * (.15 + u);
      const nx = tx + Math.cos(th) * seg, ny = Math.max(ty + Math.sin(th) * seg, 1.7), r = lerp(2.4, 1.4, u);
      paint(ID.tail, capT(tx, ty, nx, ny, r, lerp(2.4, 1.4, (i + 1) / (N - 1)))); tx = nx; ty = ny;
    }
    // far ears first (the head overlaps their bases), then haunches, body, arms, collar, head
    const earL = K.ear1 * 5, earR = K.ear2 * 5;
    const ear = (s, tw) => paint(ID.ear2, triT([s * 8.5, 22.2 + hy], [s * 2.4, 26.8 + hy], [s * 7.6 + tw, 33.4 + hy]));
    ear(-1, earL); ear(1, earR);
    paint(ID.body, ellT(-6.8, 4.2, 5.2, 4.4)); paint(ID.body, ellT(6.8, 4.2, 5.2, 4.4));
    paint(ID.body, ellT(0, 8.5 + br * .3, 7.8, 8.8)); paint(ID.body, ellT(0, 11.5 + br * .3, 6.4, 6.4));
    for (const sd of [-1, 1]) paint(ID.nFront, capT(sd * 5, 14.2 + br * .2, sd * 10.4, 11.9, 2.6, 2.3));
    paint(ID.collar, ellT(0, 14.8 + br * .2 + hy * .3, 5.4, 1.6));
    paint(ID.head, ellT(0, 21.6 + hy, 8.3, 6.6)); paint(ID.head, ellT(-5.4, 19.6 + hy, 4.4, 3.4)); paint(ID.head, ellT(5.4, 19.6 + hy, 4.4, 3.4));
    shade(dim);
    // inner ears
    for (const sd of [-1, 1]) { const bx = sd * 5.4, by = 24.6 + hy, tip = [sd * 7.6 + (sd < 0 ? earL : earR), 33.4 + hy]; for (let k = 0; k < 4; k++) { const u = .2 + k * .17, w = (1 - u) * 1.3; for (let o = -1; o <= 1; o++) { if (Math.abs(o) > w) continue; put(lerp(bx, tip[0], u) + o * .8, lerp(by, tip[1], u), C.earIn, o === 0 ? 255 : 200); } } }
    // eyes: 4x3, pupils 2x2 (they slide down to the page and along the line while he reads)
    const blink = K.blinkT >= 0, tone = [C.eyeL, C.eye, C.eyeD], pr = f.fg > .5 ? 0 : 1, pc = clamp(1 + (f.fg > .5 ? 0 : f.lookX), 0, 2);
    for (const sd of [-1, 1]) {
      const ox = sd * 3.7 - 1.5, oy = 22.4 + hy, px2 = (c, r, col, a = 255) => put(ox + c, oy + (1 - r), col, a);
      if (happy) { px2(1, 0, C.eyeL); px2(2, 0, C.eyeL); px2(0, 1, C.eyeL); px2(3, 1, C.eyeL); }
      else if (blink) { for (let c = 0; c < 4; c++) px2(c, 1, C.eyeD); }
      else {
        const rows = ['.##.', '####', '.##.']; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) if (rows[r][c] === '#') px2(c, r, tone[r]);
        for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) px2(pc + c, pr + r, C.pupil); px2(pc, pr, C.glint);
      }
    }
    put(0, 18.7 + hy, C.nose); put(-1, 17.3 + hy, C.catR, 210); put(1, 17.3 + hy, C.catR, 210); put(0, 17.1 + hy, C.catR, 120);
    put(0, 25.7 + hy, C.gold); put(-1.2, 24.9 + hy, C.gold2); put(1.2, 24.9 + hy, C.gold2); // forehead crescent
    put(0, 14.2 + br * .2, C.gold); put(0, 13.2 + br * .2, C.gold2); put(-.9, 14.2 + br * .2, C.glint, 190); // collar charm
    for (const sd of [-1, 1]) for (const [ang, len] of [[.12, 6], [-.1, 6.5], [-.34, 5]]) for (let q = 1; q <= len; q++) { // whiskers
      const wx = sd * (7.2 + Math.cos(ang) * q), wy = 18.8 + hy + Math.sin(ang) * q * sd * sd * .9 - q * .06, i = Math.round(SX + wx), j = Math.round(SY - wy);
      if (i >= 0 && j >= 0 && i < SW && j < SH && !LB[j * SW + i]) put(wx, wy, C.catR, 150 - q * 14);
    }
    // the open book in front of him, seen from above and a little from the front: two cream pages, cover colour around them
    const bk = T && T.bk, cov = bk ? (bk.line ? bk.col : mulc(mixc(bk.col, [70, 76, 112], .62), .8)) : C.bk3, covD = mulc(cov, .62), covL = mulc(cov, 1.25);
    const prog = rd ? clamp(rd.chars / Math.max(1, rd.len), 0, 1) : 0;
    for (let y = 0; y <= 11; y++) {
      const hw = lerp(16, 13.4, y / 11), hwI = hw - 1.6;
      for (let x = -Math.ceil(hw); x <= Math.ceil(hw); x++) {
        const ax = Math.abs(x); if (ax > hw) continue;
        let c;
        if (y <= 1) c = y === 0 ? covD : cov;                                  // front cover edge
        else if (ax > hwI) c = ax > hw - .8 ? covL : cov;                      // side covers
        else if (y === 11) c = C.page2;                                        // far edge of the pages
        else if (ax < 1) c = x < 0 ? C.page2 : mulc(C.page2, .9);              // gutter shadow around the spine
        else c = (ax > hwI - 1.2 || y === 2) ? C.page2 : C.page;
        put(x, y + .5, c);
      }
    }
    for (let y = 3; y <= 10; y++) put(0, y + .5, mulc(C.page2, .72));         // the spine
    // the text lines appear as he "reads" (10 lines, left page then right)
    for (let ln = 0; ln < 10; ln++) {
      const fill = clamp(prog * 10 - ln, 0, 1); if (fill <= 0) continue;
      const pg = ln < 5 ? -1 : 1, y = 3 + (ln % 5) * 1.6 + 1, hwL = lerp(16, 13.4, (y - .5) / 11) - 3.4, x0 = pg * 1.8, len = Math.round((hwL - 1.8) * fill);
      for (let k = 0; k < len; k++) if (k % 4 !== 3) put(x0 + pg * k, y, C.ink, 150);
    }
    // paws on the top corners of the book
    for (const sd of [-1, 1]) { const px0 = sd * 10.6; for (let j = -1; j <= 1; j++) for (let i = -3; i <= 3; i++) if ((i / 3.1) ** 2 + (j / 1.9) ** 2 <= 1) put(px0 + i, 11.9 + j, j === 1 ? C.catRL : C.cat); put(px0 - 1, 11.5, C.inner); put(px0 + 1, 11.5, C.inner); }
    K.headC = [K.x, feetY(K.row) - (21.6 + hy)];
  }
  function drawCat(b, alpha = 1) {
    const ox = Math.round(K.x) - SX * 1, oy = Math.round(feetY(K.row) + K.airY) - SY;
    // sprite x is mirrored in renderCat via D, so the origin is always the body centre
    for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) { const k = (j * SW + i) * 4; if (SP[k + 3] && (alpha >= 1 || bay(ox + i, oy + j) < alpha)) set(b, ox + i, oy + j, [SP[k], SP[k + 1], SP[k + 2]]); }
  }

  /* ---------------- cat brain: walk, hop between rows, sit, look ---------------- */
  const VMAX = 30;
  function bookBy(id) { return S.books.find(b => b.id === id); }
  function plan(bk) {
    const steps = [];
    const side = K.x < bk.cx ? -1 : 1; let sx = bk.cx + side * 12, dirT = -side;
    if (sx < 20 || sx > 100) { sx = bk.cx - side * 12; dirT = side; }
    sx = clamp(sx, 20, 100);
    steps.push({t: 'walk', x: sx});
    let r = K.row; const dr = bk.row - r;
    for (let k = 0; k < Math.abs(dr); k++) { r += Math.sign(dr); steps.push({t: 'jump', row: r}); }
    steps.push({t: 'face', dir: dirT}); steps.push({t: 'arrive', id: bk.id});
    K.queue = steps; K.at = null;
  }
  function turnTo(d) { if (K.dir === d && K.pendDir === d) return false; K.hdir = d; K.turnT = K.turnD = .3; K.pendDir = d; K.flipped = false; return true; }
  function nextStep() {
    const st = K.queue.shift(); if (!st) return;
    if (st.t === 'walk') { K.goal = st.x; if (Math.abs(st.x - K.x) < 1) return; const d = st.x > K.x ? 1 : -1; if (turnTo(d)) { K.queue.unshift(st); K.mode = 'turn'; return; } K.mode = 'walk'; }
    else if (st.t === 'jump') { K.jump = st; K.mode = 'crouch'; K.mt = 0; K.gaze = [K.x + K.dir * 6, feetY(st.row) - 20]; }
    else if (st.t === 'face') { if (turnTo(st.dir)) { K.mode = 'turn'; } }
    else if (st.t === 'arrive') { K.at = st.id; K.mode = 'idle'; const bk = bookBy(st.id), w = bk && lineFor(bk); if (w) setTimeout(() => S.sel === st.id && S.api.say(w, {x: clamp(K.x, 22, 98) / W, y: ((K.headC ? K.headC[1] : 60) - 14) / H}), 500); }
  }
  function lineFor(bk) { // a line for this book; now and then it carries Moon's mood instead
    const api = S.api, m = api.mood ? api.mood() : 'normal';
    if (!bk.line) return api.words('shelf_empty');
    if (m !== 'normal' && Math.random() < .45) { const w = api.words('shelf_pick_' + m); if (w) return w; }
    return api.words('shelf_pick_' + bk.id) || api.words('shelf_pick');
  }
  function speak(key, p) { const w = S.api.words(key); if (w && K.headC) S.api.say(w, {x: clamp(K.x, 22, 98) / W, y: (K.headC[1] - (p || 14)) / H}); }

  /* ---------------- idle life: when nothing is asked of him Moon licks a paw, yawns, stares at a high shelf, and in the end falls asleep ---------------- */
  const ACT = {lick: 3.8, yawn: 2.3, stare: 3.4};
  function poke() { // any tap: the idle clock starts over, whatever he was doing stops
    K.idleT = 0; K.actAt = 6 + Math.random() * 6; K.sleeping = false;
    if (K.act) { K.act = null; if (K.stareGaze) { K.gaze = null; K.stareGaze = false; } }
  }
  function startAct() {
    const calmSel = !!S.sel, canLick = K.hdir === K.dir && K.xs > .99, bag = [];
    if (canLick) bag.push('lick', 'lick', 'lick'); bag.push('yawn', 'yawn');
    if (!calmSel) bag.push('stare', 'stare');
    const kind = bag[(Math.random() * bag.length) | 0];
    K.act = {kind, t: 0, dur: ACT[kind]};
    if (kind === 'stare') { // look at a book on another shelf (or the same one, far away)
      const others = S.books.filter(b => b.row !== K.row || Math.abs(b.cx - K.x) > 24), bk = others[(Math.random() * others.length) | 0];
      if (bk) { K.gaze = [bk.cx, L.ly[bk.row] - bk.h * .7]; K.stareGaze = true; }
    }
    if (kind === 'yawn' && Math.random() < .5) setTimeout(() => S.state === 'open' && K.act && speak('shelf_yawn'), 700);
    if (kind === 'stare' && Math.random() < .35) setTimeout(() => S.state === 'open' && K.act && speak('shelf_stare'), 900);
  }
  function idleBrain(dt, t) {
    const calm = S.state === 'open' && K.mode === 'idle' && !K.queue.length && !S.take;
    if (!calm) { if (K.act || K.sleeping) poke(); K.idleT = 0; }
    else {
      K.idleT += dt;
      const after = (S.api.mood && S.api.mood() === 'sleepy') ? 14 : 30;
      if (!K.sleeping && !K.act && K.idleT > after && K.sit > .9) { K.sleeping = true; K.zAt = 1.2; K.talkAt = 14 + Math.random() * 10; }
      if (!K.sleeping && !K.act && (K.actAt -= dt) <= 0 && K.sit > .9 && K.idleT > (S.sel ? 8 : 3)) startAct();
    }
    // the act's envelope
    let yT = 0, lT = 0;
    if (K.act) {
      const a = K.act; a.t += dt; K.actT = a.t; const u = a.t / a.dur;
      const env = u < .18 ? u / .18 : u < .7 ? 1 : 1 - (u - .7) / .3;
      if (a.kind === 'yawn') yT = Math.max(0, env); else if (a.kind === 'lick') lT = Math.max(0, env);
      if (a.t >= a.dur) { K.act = null; K.actAt = 6 + Math.random() * 7; if (K.stareGaze) { K.gaze = null; K.stareGaze = false; } }
    }
    const ease = (v, to, r) => v + (to - v) * (1 - Math.exp(-dt * r));
    K.yawn = ease(K.yawn, yT, 12); K.lick = ease(K.lick, lT, 8); K.slp = ease(K.slp, K.sleeping ? 1 : 0, K.sleeping ? 1.6 : 4);
    if (K.yawn < .01) K.yawn = 0; if (K.lick < .01) K.lick = 0; if (K.slp < .01) K.slp = 0;
    K.tongue = K.lick > .75 && Math.sin(t * 11) > .45;
    // the paw goes up to the mouth while he licks
    if (K.lick > 0 && K.headC && !S.take && K.mode !== 'take') {
      const hx = (K.headC[0] - K.x) * K.dir, hy = feetY(K.row) + K.airY - K.headC[1];
      K.pawNF = [hx + 3.4, hy - 5.4 + Math.sin(t * 11) * .5]; K.pawFF = [5.4, 0]; K.reach = K.lick;
    } else if (K.reach > 0 && !S.take && K.mode !== 'take') {
      K.reach = Math.max(0, K.reach - dt * 5); if (K.reach <= 0) { K.pawNF = null; K.pawFF = null; }
    }
    // little z's, and now and then a murmur
    if (K.slp > .9) {
      if ((K.zAt -= dt) <= 0 && K.headC) { K.zAt = 1.9; S.parts.push({x: K.headC[0] + K.dir * 5, y: K.headC[1] - 9, vx: K.dir * 2.5, vy: -5.5, life: 2.6, t: 0, c: C.page2, kind: 'z'}); }
      if ((K.talkAt -= dt) <= 0) { K.talkAt = 20 + Math.random() * 14; speak('shelf_sleeptalk'); }
    }
  }
  function updateCat(dt, t) {
    const n = now();
    idleBrain(dt, t);
    // gaze target: the chosen book, or ahead
    let gz = K.gaze;
    if (S.take) gz = [S.take.xf.cx, S.take.xf.cy];
    else if (S.sel && K.mode === 'idle') { const bk = bookBy(S.sel); if (bk) gz = [bk.cx, L.ly[bk.row] - bk.h * .7]; }
    K.attent = (S.sel && ((K.mode === 'idle' && K.at === S.sel) || K.mode === 'take')) ? 1 : 0;
    // modes
    if (K.mode === 'idle') {
      if (K.queue.length) { K.sitT = 0; nextStep(); }
      K.v += (0 - K.v) * Math.min(1, dt * 10);
    } else if (K.mode === 'turn') {
      K.turnT -= dt; K.v += (0 - K.v) * Math.min(1, dt * 12);
      // the head leads (hdir already points the new way); the body narrows to a sliver, swaps sides at the midpoint, then widens again
      const u = clamp(1 - K.turnT / K.turnD, 0, 1);
      K.xs = 1 - .66 * Math.sin(Math.PI * u);
      if (u >= .5 && !K.flipped) { K.dir = K.pendDir; K.flipped = true; }
      if (K.turnT <= 0) { K.dir = K.pendDir; K.xs = 1; K.mode = 'idle'; }
    } else if (K.mode === 'walk') {
      const dx = K.goal - K.x, dist = Math.abs(dx), d = Math.sign(dx) || 1;
      const vt = Math.min(VMAX, 4 + dist * 2.6); K.v += (vt - K.v) * Math.min(1, dt * 7);
      K.x += d * K.v * dt; K.gait += K.v * dt * GAIT.stance / GAIT.stride;
      if ((K.goal - K.x) * d <= .25) { K.x = K.goal; K.mode = 'idle'; }
    } else if (K.mode === 'crouch') {
      K.mt += dt; K.v += (0 - K.v) * Math.min(1, dt * 10); K.crouch = eio(Math.min(1, K.mt / .34));
      if (K.mt >= .34) { const to = K.jump.row; K.air = {u: 0, blend: 0, from: K.row, to, T: .52 + .0042 * Math.abs(feetY(to) - feetY(K.row)), x0: K.x, dx: K.dir * 6}; K.mode = 'air'; K.rowAnim = K.row; }
    } else if (K.mode === 'air') {
      const A = K.air; A.u = Math.min(1, A.u + dt / A.T); A.blend = Math.min(1, A.blend + dt * 9);
      K.crouch = Math.max(0, K.crouch - dt * 6);
      const rise = feetY(A.to) - feetY(A.from), u = A.u;
      K.airY = lerp(0, rise, 1 - Math.pow(1 - u, rise < 0 ? 2.1 : 1.6)) - Math.sin(Math.PI * u) * (rise < 0 ? 9 : 4); // y offset from the start row (down is positive)
      K.x = A.x0 + A.dx * sstep(u);
      if (u >= 1) { K.row = A.to; K.airY = 0; K.air = null; K.mode = 'land'; K.mt = 0; K.hop = true; sparkleDust(K.x, feetY(K.row)); }
    } else if (K.mode === 'take') {
      stepTake(dt);
    } else if (K.mode === 'land') {
      K.mt += dt; const k = K.mt / .32; K.landK = Math.sin(Math.min(1, k) * Math.PI) * .95; K.v *= .9;
      if (K.mt >= .32) { K.landK = 0; K.mode = 'idle'; }
    }
    // posture: sits when nothing to do
    const wantSit = (K.mode === 'idle' && !K.queue.length) || K.mode === 'take';
    K.sit += ((wantSit ? 1 : 0) - K.sit) * (1 - Math.exp(-dt * (wantSit ? 4.5 : 9)));
    if (K.mode === 'walk' || K.mode === 'turn' && K.queue.length) K.sit += (0 - K.sit) * (1 - Math.exp(-dt * 10));
    // head: spring toward the look target
    let tp = .04, hsT = K.dir * 1;
    if (gz) {
      const hdx = gz[0] - (K.headC ? K.headC[0] : K.x), hdy = (K.headC ? K.headC[1] : feetY(K.row) - 20) - gz[1];
      const dirW = Math.abs(hdx) > 5 ? Math.sign(hdx) : K.hdir;
      tp = clamp(Math.atan2(hdy, Math.abs(hdx) + 5), -.3, .75);
      if (K.mode === 'idle' && K.at !== null && K.at === S.sel) { K.hdir = dirW; }
      K.lookX = Math.abs(hdx) > 4 ? 1 : 0; K.lookY = hdy > 9 ? 1 : hdy < -9 ? -1 : 0;
    } else { K.lookX = 0; K.lookY = 0; if (K.mode === 'idle') K.hdir = K.dir; }
    if (K.mode === 'walk' && !gz) K.hdir = K.dir;
    if (K.mode === 'walk') { tp = -.02; K.hdir = K.dir; }
    if (K.yawn > 0) tp = lerp(tp, .8, K.yawn);
    if (K.lick > 0) tp = lerp(tp, -.5 + Math.sin(t * 11) * .07, K.lick);
    if (K.slp > 0) tp = lerp(tp, -.4, K.slp);
    K.hs = K.hdir * K.dir;
    // springs (head pitch, head lag, tail lag)
    const kk = 70, cd = 11;
    K.hpv += ((tp - K.hp) * kk - K.hpv * cd) * dt; K.hp += K.hpv * dt;
    const bobT = K.mode === 'walk' ? Math.sin(K.gait * Math.PI * 4 + .6) * .8 : 0;
    K.headV = (K.headV || 0) + ((bobT - K.headY) * 90 - (K.headV || 0) * 9) * dt; K.headY += K.headV * dt;
    const airKick = K.mode === 'air' ? -.5 : K.mode === 'crouch' ? .25 : 0;
    K.tailV += ((airKick - K.tailLag) * 36 - K.tailV * 5.5) * dt; K.tailLag += K.tailV * dt;
    // blinking + ears
    K.blinkAt -= dt; if (K.blinkAt <= 0 && K.blinkT < 0) { K.blinkT = 0; } if (K.blinkT >= 0) { K.blinkT += dt; if (K.blinkT > .13) { K.blinkT = -1; K.blinkAt = 2.2 + Math.random() * 3.6; if (Math.random() < .2) K.blinkAt = .25; } }
    K.earAt -= dt; if (K.earAt <= 0) { K.earAt = 3 + Math.random() * 5; (Math.random() < .5 ? (K.e1v = -9) : (K.e2v = -9)); }
    K.e1v = (K.e1v || 0); K.e2v = (K.e2v || 0);
    K.e1v += ((0 - K.ear1) * 220 - K.e1v * 14) * dt; K.ear1 += K.e1v * dt; K.e2v += ((0 - K.ear2) * 220 - K.e2v * 14) * dt; K.ear2 += K.e2v * dt;
    K.sleepy = false;
  }
  function sparkleDust(x, y) { for (let i = 0; i < 6; i++) S.parts.push({x: x + (Math.random() - .5) * 14, y: y, vx: (Math.random() - .5) * 14, vy: -3 - Math.random() * 6, life: .5 + Math.random() * .3, t: 0, c: C.page2, kind: 'dust'}); }
  function hearts() { for (let i = 0; i < 3; i++) S.parts.push({x: (K.headC ? K.headC[0] : K.x) - 4 + i * 4, y: (K.headC ? K.headC[1] : 60) - 12, vx: (i - 1) * 3, vy: -12, life: 1.3, t: -i * .14, c: C.cover, kind: 'heart'}); }


  /* ---------------- taking a book: stand up, hook the spine, tip it out, toss it into the lap ----------------
     The whole thing is a function of one clock (T.tau, seconds), so "put it back" is just the same clock run backwards. */
  const TT = 1.95;
  function bookXf(T, tau) { // where the book is at time tau: centre (cx, cy), rotation, scale, and whether it is drawn in front of the cat
    const bk = T.bk, ctr = [bk.cx, bk.yb - bk.h / 2], P = [bk.cx, bk.yb], td = T.tdir;
    const tipU = sstep((tau - .85) / .35), flyU = clamp((tau - 1.2) / .48, 0, 1), fe = sstep(flyU), lift3 = Math.round(bk.lift * 3);
    const th0 = td * .28 * tipU, sc0 = 1 + .12 * tipU, ca = Math.cos(th0), sa = Math.sin(th0), vx = ctr[0] - P[0], vy = ctr[1] - P[1];
    let cx = P[0] + sc0 * (vx * ca - vy * sa), cy = P[1] + sc0 * (vx * sa + vy * ca) + 1.5 * tipU - lift3 * (1 - fe), rot = th0, sc = sc0;
    if (flyU > 0) {
      const c1x = T.x1 + T.dir0 * 1.5, c1y = feetY(T.row) - 9;
      cx = lerp(cx, c1x, fe); cy = lerp(cy, c1y, fe) - Math.sin(Math.PI * flyU) * 11;
      rot = lerp(th0, td * Math.PI / 2, fe); sc = lerp(sc0, .62, fe);
      cy -= Math.sin(Math.PI * clamp((tau - 1.68) / .27, 0, 1)) * 1.4; // little bounce when it lands
    }
    return {cx, cy, rot, sc, front: tau >= 1.2};
  }
  function xfPoint(xf, bk, qx, qy) { // a point on the (upright) book -> where it is now
    const dx = (qx - bk.cx) * xf.sc, dy = (qy - (bk.yb - bk.h / 2)) * xf.sc, c = Math.cos(xf.rot), s = Math.sin(xf.rot);
    return [xf.cx + dx * c - dy * s, xf.cy + dx * s + dy * c];
  }
  function take(bk) {
    S.api.cap.hidden = true;
    const dir0 = K.dir, T = {bk, tau: 0, dir: 1, held: false, x0: K.x, x1: bk.cx - dir0 * 10.5, dir0, row: K.row, tdir: -dir0, after: null, fx: {tip: false, land: false}, xf: null};
    T.xf = bookXf(T, 0); S.take = T; K.mode = 'take'; K.queue = [];
  }
  function putBack() { const T = S.take; if (!T || T.dir < 0) return; T.dir = -1; T.held = false; T.rd = null; S.cv.style.transform = 'none'; S.api.readHide && S.api.readHide(); }
  function stepTake(dt) {
    const T = S.take, bk = T.bk; K.v *= .8;
    T.tau = clamp(T.tau + T.dir * dt * (T.dir > 0 ? 1 : 1.8), 0, TT);
    const tau = T.tau;
    K.x = lerp(T.x0, T.x1, sstep(tau / .5));
    K.up = tau < 1.55 ? sstep(tau / .5) : 1 - sstep((tau - 1.55) / .4);
    K.reach = sstep((tau - .35) / .5);
    const xf = T.xf = bookXf(T, tau);
    const hh = clamp(bk.h * .5, 9, 19), w = xfPoint(xf, bk, bk.cx + T.tdir * 3.5, bk.yb - hh); // the paw holds the near edge of the spine
    const lx = (w[0] - K.x) * K.dir, ly = feetY(T.row) - w[1];
    K.pawNF = [lx, ly]; K.pawFF = [lx - 2.2, ly - 3];
    if (T.dir > 0) {
      if (!T.fx.tip && tau >= .9) { T.fx.tip = true; sparkleDust(bk.cx, bk.yb - bk.h + 3); }
      if (!T.fx.land && tau >= 1.68) { T.fx.land = true; sparkleDust(K.x, feetY(T.row) - 8); }
      if (tau >= TT && !T.held) { T.held = true; startRead(T); }
      if (T.rd) stepRead(T, dt);
    } else if (tau <= 0) endTake();
  }

  /* ---------------- reading: camera pushes in, the cat turns to face us behind the open book, the note is typed out ---------------- */
  const READ_ZOOM = .2, CPS = 30;
  function startRead(T) {
    const text = T.bk.line || 'nothing written here yet.', f = K.fr;
    f.fg = 0; f.hy = -1.4; f.want = 0; f.timer = 2.4; f.lookX = -1;
    T.rd = {p: 0, closing: false, text, len: text.length, chars: 0, shown: -1};
    const cw = S.cv.clientWidth, ch = S.cv.clientHeight, oy = (feetY(T.row) - 12) / H * ch;
    S.api.readShow && S.api.readShow(T.bk.title, '#' + T.bk.col.map(v => v.toString(16).padStart(2, '0')).join(''), oy / ch > .5 ? 'top' : 'bot');
    pushRead(T.rd);
  }
  function pushRead(rd) { // sends the typed part (and the rest, invisible, so the card keeps its size) to the card
    const n = Math.floor(rd.chars); if (n === rd.shown) return; rd.shown = n;
    S.api.readText && S.api.readText(rd.text.slice(0, n), rd.text.slice(n), n >= rd.len);
  }
  function stepRead(T, dt) {
    const rd = T.rd, f = K.fr;
    rd.p = rd.closing ? Math.max(0, rd.p - dt / .45) : Math.min(1, rd.p + dt / .7);
    const e = sstep(rd.p), cw = S.cv.clientWidth, ch = S.cv.clientHeight;
    S.cv.style.transformOrigin = (K.x / W * cw).toFixed(1) + 'px ' + ((feetY(T.row) - 12) / H * ch).toFixed(1) + 'px';
    S.cv.style.transform = e > 0 ? 'scale(' + (1 + READ_ZOOM * e).toFixed(4) + ')' : 'none';
    if (!rd.closing && rd.p >= .8 && rd.chars < rd.len) { const c = rd.text[Math.floor(rd.chars)]; rd.chars = Math.min(rd.len, rd.chars + dt * CPS * (c === ',' || c === '.' ? .35 : 1)); pushRead(rd); }
    // where he looks: mostly at the page while the text is coming, mostly at us once it is done, with a glance either way now and then
    const typing = rd.chars < rd.len;
    f.timer -= dt;
    if (f.timer <= 0) { f.want = f.want ? 0 : 1; f.timer = f.want ? (typing ? .5 + Math.random() * .5 : 2.4 + Math.random() * 2.4) : (typing ? 2.2 + Math.random() * 1.8 : .7 + Math.random() * .6); }
    if (!typing && rd.chars >= rd.len && !rd.doneSeen) { rd.doneSeen = true; f.want = 1; f.timer = 3; }
    f.fg += (f.want - f.fg) * (1 - Math.exp(-dt * 9)); f.hy = lerp(-1.4, 0, f.fg);
    f.lookX = Math.floor((rd.chars / 12) % 3) - 1;
    if (rd.closing && rd.p <= 0) { rd.closing = false; putBack(); }
  }
  function closeRead() { const T = S.take; if (!T || !T.rd || T.rd.closing) return; T.rd.closing = true; S.api.readHide && S.api.readHide(); }
  function endTake() {
    const A = S.take && S.take.after; if (!A && Math.random() < .5) setTimeout(() => S.state === 'open' && !S.take && speak('shelf_close', 16), 500); S.take = null; K.mode = 'idle'; K.up = 0; K.reach = 0; K.pawNF = null; K.pawFF = null;
    if (A) { S.sel = A.id; plan(A); }
    showCap();
  }
  // draw the book through its transform (nearest-neighbour inverse mapping); lm = lamp mix when drawn after the lighting pass
  function blitBook(dst, bk, t, xf, lm, alpha = 1) {
    if (!S.tmp || S.tmp.length !== W * H * 4) S.tmp = new Uint8ClampedArray(W * H * 4);
    const T = S.tmp, x0 = Math.max(0, bk.x - 1), x1 = Math.min(W, bk.x + bk.w + 1), y0 = Math.max(0, bk.yb - bk.h - 1), y1 = Math.min(H, bk.yb + 1);
    for (let j = y0; j < y1; j++) T.fill(0, (j * W + x0) * 4, (j * W + x1) * 4);
    drawBook(T, bk, t, {plain: true});
    const sx0 = bk.cx, sy0 = bk.yb - bk.h / 2, ca = Math.cos(xf.rot), sa = Math.sin(xf.rot), r = Math.hypot(bk.w, bk.h) / 2 * xf.sc + 2;
    const on = S.LFon, off = S.LFoff, ao = S.LAon, af = S.LAoff;
    for (let Y = Math.max(0, Math.floor(xf.cy - r)); Y < Math.min(H, Math.ceil(xf.cy + r)); Y++) for (let X = Math.max(0, Math.floor(xf.cx - r)); X < Math.min(W, Math.ceil(xf.cx + r)); X++) {
      const dx = X + .5 - xf.cx, dy = Y + .5 - xf.cy, ix = Math.floor(sx0 + (dx * ca + dy * sa) / xf.sc), iy = Math.floor(sy0 + (-dx * sa + dy * ca) / xf.sc);
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      const k = (iy * W + ix) * 4; if (!T[k + 3] || (alpha < 1 && bay(X, Y) >= alpha)) continue;
      let c0 = T[k], c1 = T[k + 1], c2 = T[k + 2];
      if (lm != null) { const p = Y * W + X, q = p * 3, f = off[p] + (on[p] - off[p]) * lm; c0 = c0 * f + af[q] + (ao[q] - af[q]) * lm; c1 = c1 * f + af[q + 1] + (ao[q + 1] - af[q + 1]) * lm; c2 = c2 * f + af[q + 2] + (ao[q + 2] - af[q + 2]) * lm; }
      const o = (Y * W + X) * 4; dst[o] = c0; dst[o + 1] = c1; dst[o + 2] = c2; dst[o + 3] = 255;
    }
  }

  /* ---------------- frame ---------------- */
  function dimRoom(lit, e) { // the room falls back while Moon reads; a warm pool of light stays on him and the book
    const cx = K.x, cy = feetY(K.row) - 14, k = 1 - .5 * e, kb = k * (1 - .06 * e);
    for (let y = 0; y < H; y++) { const dy = y - cy, dy2 = dy * dy; for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, dx = (x - cx) * .8, d2 = dx * dx + dy2;
      if (d2 >= 1156) { lit[i] *= k; lit[i + 1] *= k; lit[i + 2] *= kb; continue; } // outside the pool of light (34 px): plain dimming
      const g = (1 - Math.sqrt(d2) / 34) * e, f = k + g * .42;
      lit[i] = Math.min(255, lit[i] * f + 26 * g * g); lit[i + 1] = Math.min(255, lit[i + 1] * f + 15 * g * g); lit[i + 2] = Math.min(255, lit[i + 2] * f * (1 - .06 * e));
    } }
  }
  /* ---------------- gentle things that move in the scene: globe, ferns, vines, steam, twinkling picture ---------------- */
  function vineS(b, x0, y0, len, ph, dir, t, br) {
    let x = x0;
    for (let k = 0; k <= len; k++) {
      x = x0 + dir * 1.1 * Math.sin(k * .3 + ph) + br * 1.1 * Math.pow(k / len, 1.2) * Math.sin(t * .8 + ph + k * .08);
      set(b, Math.round(x), y0 + k, C.leafD);
      if (k >= 2 && (k - 2) % 3 === 0) { const sd = (((k - 2) / 3) & 1) ? 1 : -1; ell(b, x + sd * 1.9, y0 + k, 1.7, 1.1, ((k >> 1) & 1) ? C.leafL : C.leaf); }
    }
    ell(b, x, y0 + len + 1, 1.3, 1.5, C.leaf);
  }
  function drawLiveScene(b, t) {
    const d = S.deco, br = breeze(t); if (!d) return;
    if (d.globe) { // continents slide across the ball, narrowing toward the edge; a glass highlight and a shaded side
      const {x: cx, y: cy} = d.globe, rot = t * .09, R2 = 4.3 * 4.3;
      [[0, -1.6, 2.4, 1.6], [1.6, 1.4, 2, 1.3], [3.2, -.6, 2.3, 1.7], [4.6, 1.8, 1.6, 1.1], [5.5, -2, 1.5, 1]].forEach(([lon, lat, rx, ry]) => {
        const ang = lon + rot, c = Math.cos(ang); if (c < .12) return;
        const bx = cx + 4 * Math.sin(ang), erx = rx * c + .3;
        for (let y = Math.floor(cy + lat - ry); y <= cy + lat + ry; y++) for (let x = Math.floor(bx - erx); x <= bx + erx; x++)
          if (((x + .5 - bx) / erx) ** 2 + ((y + .5 - cy - lat) / ry) ** 2 <= 1 && (x + .5 - cx) ** 2 + (y + .5 - cy) ** 2 <= R2) set(b, x, y, c > .55 ? C.leaf : C.leafD);
      });
      for (let y = Math.floor(cy - 4.4); y <= cy + 4.4; y++) for (let x = Math.floor(cx - 4.4); x <= cx + 4.4; x++) { const dx = x + .5 - cx, dy = y + .5 - cy; if (dx * dx + dy * dy <= R2 && dx > 1.2) set(b, x, y, C.sky1, 130 * Math.min(1, (dx - 1.2) / 3)); }
      set(b, cx - 2, cy - 3, C.page, 170); set(b, cx - 3, cy - 2, C.page, 120); set(b, cx - 1, cy - 3, C.page, 90);
    }
    if (d.fern) { // the pot's fern: leaves sway a little, the tall ones most
      const F = d.fern;
      [[-12, -12, 2.4, 1.5, 0], [-9, -15, 2.2, 1.4, 1], [-6, -12, 2.4, 1.5, 0], [-14, -9, 2, 1.2, 1], [-4, -9.5, 2, 1.2, 1], [-9, -10, 2.4, 1.4, 0], [-11, -13.8, 1.9, 1.2, 1], [-7, -14.2, 1.8, 1.2, 0], [-13, -11.2, 1.8, 1.1, 0]].forEach(([dx, dy, rx, ry, l], i) => {
        const s2 = Math.sin(t * .9 + i * 1.7) * .55 * br * clamp((-dy - 8) / 8, 0, 1);
        ell(b, F.x + dx + s2, F.y + dy + Math.sin(t * .7 + i) * .12, rx, ry, l ? C.leafL : C.leaf);
      });
    }
    { // the plant on top of the case: only its leaves and vines show, spilling over the crown
      const x1 = L.ix1;
      [[98, 1.2], [101, .6], [104, 1.4], [107, .8], [110, 1.6], [113, 1]].forEach(([x, y], i) => ell(b, x + Math.sin(t * .9 + i * 1.6) * .5 * br, y + Math.sin(t * .7 + i) * .15, 2.4, 1.5, i % 2 ? C.leafL : C.leaf));
      vineS(b, x1 - 6, 2, 15, .5, 1, t, br); vineS(b, x1 - 12, 3, 9, 2.1, -1, t, br); vineS(b, x1 - 1, 3, 12, 3.7, 1, t, br);
    }
    if (d.mug) for (let k = 0; k < 3; k++) { const u = (t * .2 + k / 3) % 1; set(b, d.mug.x + 1 + Math.sin(t * 1.1 + k * 2 + u * 5) * 1.1, d.mug.y - u * 9, C.page, 130 * Math.sin(u * Math.PI)); }
    if (d.pic) { // the little stars in the picture twinkle
      const ly = d.pic.y; set(b, 15, ly - 10, C.sky1); set(b, 20, ly - 4, C.sky1);
      set(b, 15, ly - 10, C.star, 255 * (.45 + .55 * Math.max(0, Math.sin(t * 1.7)))); set(b, 20, ly - 4, C.starB, 255 * (.45 + .55 * Math.max(0, Math.sin(t * 1.3 + 2))));
    }
  }
  function drawFrame(t, dt) {
    dt = dt || 1 / FPS; const b = S.out0; b.set(S.base);
    drawLiveScene(b, t);
    for (const bk of S.books) {
      const sel = S.sel === bk.id, k = 1 - Math.exp(-dt * 11);
      bk.lift += ((sel ? 1 : 0) - bk.lift) * k; bk.glow += ((sel ? 1 : 0) - bk.glow) * k;
      if (S.take && S.take.bk === bk) continue;
      drawBook(b, bk, t);
    }
    const lm = S.api.lampMix ? S.api.lampMix() : 1;
    if (S.take && !S.take.xf.front) blitBook(b, S.take.bk, t, S.take.xf, null);
    const lit = S.out; applyLight(b, lit, lm);
    // candle flame + glow (on top of the light)
    if (S.flame && S.api.candle && S.api.candle()) {
      const {x, y} = S.flame, f = Math.sin(t * 13) > 0;
      for (let j = -9; j <= 8; j++) for (let i = -9; i <= 9; i++) { const a = Math.max(0, 1 - Math.hypot(i, j * 1.1) / 10) * 70; if (a > 3) set(lit, x + i, y + j, C.shadeOn2, a); }
      set(lit, x, y + 1, C.shadeOn2); set(lit, x, y, f ? C.shadeOn : C.brassL); set(lit, x, y - 1, f ? C.shadeOn : C.shadeOn2); if (f) set(lit, x + (Math.sin(t * 7) > 0 ? 1 : -1), y - 2, C.shadeOn, 150);
    }
    // dust floating through the light
    for (let k = 0; k < 9; k++) { const u = (t * .045 + k / 9) % 1, x = 10 + ((k * 37) % 100) + Math.sin(t * .6 + k) * 3, y = H - 20 - u * (H - 40); set(lit, x, y, C.shadeOn, 80 * Math.sin(u * Math.PI)); }
    // the cat
    const dim = .8 + .2 * (S.api.lampMix ? S.api.lampMix() : 1), rdT = S.take && S.take.rd, e = rdT ? sstep(rdT.p) : 0;
    if (e > 0) dimRoom(lit, e);
    if (e < 1) { renderCat(t, dim); drawCat(lit, 1 - e); if (S.take && S.take.xf.front) blitBook(lit, S.take.bk, t, S.take.xf, lm, 1 - e); }
    if (e > 0) { renderFront(t, dim); drawCat(lit, e); }
    // particles
    S.parts = S.parts.filter(q => (q.t += dt) < q.life);
    for (const q of S.parts) {
      if (q.t < 0) continue; q.x += q.vx * dt; q.y += q.vy * dt; const a = 255 * (1 - q.t / q.life);
      if (q.kind === 'z') { const zx = q.x + Math.sin(q.t * 2.4) * 1.4, big = q.t > 1; [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]].forEach(([i, j]) => { set(lit, zx + i, q.y + j, q.c, a * .85); if (big) set(lit, zx + i + 1, q.y + j, q.c, a * .3); }); }
      else if (q.kind === 'heart') [[0, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [1, 3]].forEach(([i, j]) => set(lit, q.x + i, q.y + j, q.c, a));
      else set(lit, q.x, q.y, q.c, a * .8);
    }
    S.ctx.putImageData(new ImageData(lit, W, H), 0, 0);
  }

  /* ---------------- camera: a slow push-in from the room, and back out ---------------- */
  function applyCam(e) { // e: 0 = the room, 1 = the shelf
    const g = S.api.geom(), cw = S.cv.clientWidth, ch = S.cv.clientHeight; if (!cw) return;
    const px = g.shelf.x / g.W * cw, py = (g.shelf.y + g.OY) / g.H * ch; // the shelf in the room (screen px)
    const Z = 4.3, s = Math.exp(Math.log(Z) * e), cx = cw / 2, cy = ch * .47;
    const tx = lerp(px, cx, e) - s * px, ty = lerp(py, cy, e) - s * py;
    S.api.room.style.transformOrigin = '0 0'; S.api.room.style.transform = `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
    const k = s / Z, sx2 = lerp(px - cw / 2, 0, e), sy2 = lerp(py - ch / 2, 0, e);
    const fadeIn = sstep((e - .5) / .38), fadeOut = 1 - sstep((e - .55) / .3);
    S.cv.style.opacity = fadeIn.toFixed(3); S.cv.style.transformOrigin = '50% 50%'; S.cv.style.transform = `translate(${sx2.toFixed(1)}px,${sy2.toFixed(1)}px) scale(${(lerp(.5, 1, e) * 1).toFixed(4)})`;
    S.api.room.style.opacity = e < .55 ? 1 : fadeOut.toFixed(3);
    if (S.api.vig) S.api.vig.style.opacity = (Math.sin(Math.min(1, e) * Math.PI) * .85).toFixed(3);
  }
  function loop() {
    if (S.state === 'closed') { S.raf = 0; return; }
    S.raf = requestAnimationFrame(loop);
    const n = now(), t = n / 1000;
    if (S.state === 'opening' || S.state === 'closing') {
      const dur = S.state === 'opening' ? 1000 : 760, u = clamp((n - S.t0) / dur, 0, 1), e = eio(S.state === 'opening' ? u : 1 - u);
      applyCam(e);
      if (u >= 1) { if (S.state === 'opening') { S.state = 'open'; ready(); } else finishClose(); }
      if (S.state === 'closing' || S.state === 'closed') return;
    }
    // frame pacing: 30 fps normally; 15 while he sleeps; 20 or 15 for good if this phone keeps taking too long per frame (saves battery too)
    const fps = Math.min(S.fps, K.slp > .95 && !S.take ? 15 : 30);
    if (fps !== S.curFps) { S.curFps = fps; S.lastF = -1; }
    const fi = Math.floor(t * fps); if (fi === S.lastF) return;
    const dt = S.lastF < 0 ? 1 / fps : Math.min(.075, (fi - S.lastF) / fps); S.lastF = fi;
    const c0 = typeof performance !== 'undefined' ? performance.now() : 0;
    updateCat(dt, t); drawFrame(t, dt);
    if (c0) {
      S.cost = S.cost ? S.cost * .92 + (performance.now() - c0) * .08 : performance.now() - c0;
      if (++S.nF % 40 === 0 && S.curFps === S.fps) { if (S.cost > 28 && S.fps > 15) { S.fps = 15; S.lastF = -1; } else if (S.cost > 17 && S.fps > 20) { S.fps = 20; S.lastF = -1; } }
    }
  }
  function ready() {
    S.cv.style.opacity = 1; S.cv.style.transform = 'none'; S.api.room.style.opacity = 0; S.api.vig && (S.api.vig.style.opacity = 0);
    S.api.back.hidden = false; showCap();
  }
  function showCap() {
    const bk = S.sel && bookBy(S.sel), cap = S.api.cap; cap.hidden = false;
    cap.querySelector('b').textContent = bk ? bk.title : 'the bookshelf';
    cap.querySelector('b').style.color = bk ? '#' + bk.col.map(v => v.toString(16).padStart(2, '0')).join('') : '';
    cap.querySelector('span').textContent = bk ? (bk.line ? 'tap again to take it' : 'nothing written here yet') : 'tap a book';
  }

  /* ---------------- input ---------------- */
  function bookAt(px, py) {
    let row = -1; for (let r = 2; r >= 0; r--) if (py >= L.tp[r] - 2) { row = r; break; }
    if (py >= S.cabY || py < L.tp[0] - 2 || row < 0 || px < L.ix0 || px > L.ix1) return null;
    const bk = S.books.filter(b => b.row === row).sort((a, b) => Math.abs(a.cx - px) - Math.abs(b.cx - px))[0];
    return bk && Math.abs(bk.cx - px) <= 14 ? bk : null;
  }
  function tapAt(px, py) {
    const wasAsleep = K.slp > .5; poke();
    const T = S.take;
    if (T) { // a book is out: taps are locked while it moves; once he reads, a tap finishes the typing, then closes the book
      const other = bookAt(px, py), rd = T.rd, pick = other && other.id !== T.bk.id;
      if (pick) T.after = other;
      if (rd && !rd.closing) {
        if (pick) { closeRead(); return; }
        const hc = K.headC; if (hc && Math.abs(px - K.x) < 11 && py > hc[1] - 12 && py < hc[1] + 7) { K.happyUntil = now() + 1500; hearts(); const w = S.api.words('shelf_pet'); if (w) S.api.say(w, {x: K.x / W, y: (hc[1] - 14) / H}); return; }
        if (rd.chars < rd.len) { rd.chars = rd.len; pushRead(rd); return; }
        closeRead(); return;
      }
      if (!rd && T.dir > 0 && pick) putBack();
      return;
    }
    const hc = K.headC, selBk = S.sel && bookBy(S.sel), onBook = !wasAsleep && selBk && K.mode === 'idle' && K.at === S.sel && Math.abs(px - selBk.cx) <= 9 && py < feetY(K.row) - 3;
    const hit = !onBook && K.mode !== 'air' && hc && Math.abs(px - K.x) < 10 && py > hc[1] - 14 && py < feetY(K.row) + 4;
    if (hit) { K.happyUntil = now() + 1500; hearts(); const w = S.api.words(wasAsleep ? 'shelf_wake' : 'shelf_pet'); if (w) S.api.say(w, {x: K.x / W, y: (hc[1] - 11) / H}); return; }
    const bk = bookAt(px, py); if (!bk) return;
    if (S.sel === bk.id) { if (K.mode === 'idle' && K.at === bk.id) take(bk); return; }
    S.sel = bk.id; plan(bk); showCap();
  }
  function onClick(e) { const r = S.cv.getBoundingClientRect(); tapAt((e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H); }

  /* ---------------- build / open / close ---------------- */
  function build() {
    const box = S.api.box, w = box.clientWidth, h = box.clientHeight;
    const nh = w && h ? clamp(Math.round(W * h / w), 168, 270) : 200;
    if (S.built && nh === H) return;
    H = nh; S.cv.width = W; S.cv.height = H; layout();
    S.base = buf(); drawScene(S.base); S.out0 = buf(); S.out = buf(); bakeLight(); S.built = true;
    K.x = clamp(K.x, 20, 100);
  }
  function refreshBooks() {
    const list = S.api.books(); S.books.forEach(bk => { const l = list.find(x => x.id === bk.id); bk.line = l && l.t ? l.t : null; bk.acc = l ? l.c : null; bk.text = bk.line; });
  }
  function open() {
    if (S.state !== 'closed') return;
    build(); refreshBooks();
    S.state = 'opening'; S.t0 = now(); S.lastF = -1; S.sel = null; K.at = null; K.queue = []; K.mode = 'idle'; K.row = 2; K.airY = 0; K.air = null; K.x = 64; K.dir = 1; K.hdir = 1; K.pendDir = 1; K.xs = 1; K.up = 0; K.reach = 0; K.pawNF = null; K.pawFF = null; S.take = null; S.api.readHide && S.api.readHide(); K.sit = 1; K.landK = 0; K.crouch = 0; K.v = 0; K.gaze = null; K.idleT = 0; K.act = null; K.actAt = 6; K.sleeping = false; K.slp = 0; K.yawn = 0; K.lick = 0; K.tongue = false; K.stareGaze = false; S.parts = []; S.cost = 0;
    S.api.hold(true); S.cv.hidden = false; S.cv.style.opacity = 0; S.api.back.hidden = true; S.api.cap.hidden = true;
    applyCam(0);
    const w = S.api.words('shelf_in'); if (w) setTimeout(() => S.state === 'open' && S.api.say(w, {x: K.x / W, y: ((K.headC ? K.headC[1] : 60) - 14) / H}), 1300);
    if (!S.raf) S.raf = requestAnimationFrame(loop);
  }
  function close(instant) {
    if (S.state === 'closed' || S.state === 'closing') return;
    S.api.back.hidden = true; S.api.cap.hidden = true;
    if (instant) { finishClose(true); return; }
    S.state = 'closing'; S.t0 = now(); S.cv.style.transform = 'none';
  }
  function finishClose(instant) {
    S.take = null; K.mode = 'idle'; K.queue = []; K.air = null; K.up = 0; K.reach = 0; K.pawNF = null; S.api.readHide && S.api.readHide(); S.cv.style.transformOrigin = '';
    S.state = 'closed'; S.cv.hidden = true; S.cv.style.opacity = 0; S.cv.style.transform = '';
    S.api.room.style.transform = ''; S.api.room.style.opacity = ''; S.api.room.style.transformOrigin = ''; S.api.vig && (S.api.vig.style.opacity = 0);
    S.api.hold(false); S.api.onClose && S.api.onClose();
  }
  window.Shelf = {
    attach(api) {
      S.api = api; S.cv = api.cv; S.ctx = S.cv.getContext('2d'); S.cv.hidden = true;
      S.cv.addEventListener('click', onClick); api.back.addEventListener('click', () => close());
    },
    open, close, isOpen: () => S.state !== 'closed', refresh: refreshBooks,
    _sim: {build, refresh: refreshBooks, step(dt, t) { updateCat(dt, t); drawFrame(t, dt); }, tap: tapAt, out: () => S.ctx._last, init() { S.state = 'open'; S.built = false; build(); refreshBooks(); }},
    _S: S, _K: K, _render(t, dim) { renderCat(t, dim == null ? 1 : dim); return SP; }, _front(t, dim) { renderFront(t, dim == null ? 1 : dim); return SP; }, _dims: () => ({SW, SH, SX, SY}), _poses: POSE
  };
})();
