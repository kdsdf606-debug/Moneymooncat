/* Moon's room — a cozy pixel room for the cat. 120×132 grid, drawn into a canvas scaled with pixelated CSS.
   Room.attach(canvas, api)  api = { state(): S.room, save(), insights(): [lines], say(text, x, y), onRead(lines), words(key) }
*/
(function () {
  const W = 120, FPS = 24;
  let H = 132, OY = 0, GY = 4; // the canvas grows taller to fill the screen: OY extra rows of wall above, the rest is floor below
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const C = {};
  Object.entries({
    wall: '#141a3c', wall2: '#171f46', wallDot: '#1c2550', trim: '#2f4183', trimD: '#1b2752', trimL: '#3e52a0',
    floor: '#1d1a3a', floor2: '#221f45', gap: '#120f26', floorL: '#2a2652',
    rugA: '#272938', rugB: '#323548', rugC: '#3e4259', rugAcc: '#4a4772', rugHi: '#5a5f7e', pil: '#8f8cf0', pilL: '#b6b3ff', pilD: '#5d5ab4', pink: '#ff9fb5', pinkL: '#ffc4d2', pinkD: '#b05a7a', fur: '#5a4d92',
    rug: '#2c2e3c', rug2: '#353849', rugRing: '#3f4357', rugEdge: '#22232e', rugDot: '#474b62',
    frame: '#2f4183', frameL: '#4a5db0', sky0: '#070b1e', sky1: '#0c1430', moon0: '#e6f6ff', moon1: '#c4e6fb', moon2: '#9fd0f0', moonDark: '#1a2550',
    sill: '#3b4c95', curt: '#3a2a5c', curtD: '#291e44', curtL: '#4b3a73', rod: '#a8823a',
    wood: '#2c2344', woodD: '#1c162f', woodL: '#3a2f58', woodH: '#54467d', bk1: '#c4e6fb', bk2: '#ffd36a', bk3: '#ff9fb5', bk4: '#8fd9c4', bk5: '#8f8cf0', bk6: '#5d6a9a', bk7: '#a8823a',
    brass: '#a8823a', brassL: '#ffd36a', brassD: '#5a4a2a', shadeOn: '#ffe7a8', shadeOn2: '#ffd36a', shadeOff: '#4a3d2c', shadeOff2: '#3a2f22',
    bed: '#4a3f7a', bedL: '#6a5ca8', bedD: '#2f2752', cush: '#262048', cushL: '#322a5e', blanket: '#a8823a', blanketL: '#d6a94a', blanketD: '#6e5326', plB: '#454e82', plBd: '#333b68', plR: '#833f55', plRd: '#612e41', plL: '#b9ac8f', plLd: '#8f846c',
    bowl: '#3b4c95', bowlL: '#6f6ccc', bowlD: '#25306a', mat: '#3a2a5c', matD: '#2a1f45', food: '#d08a4a', foodL: '#f0b070', fish: '#c4e6fb',
    pot: '#6b3f2a', potL: '#8a5236', leaf: '#3f7a5a', leafL: '#5fa37a', leafD: '#2a5240',
    pic: '#0c1430', picM: '#ffd36a', star: '#ffffff', starB: '#9ad8ff', starG: '#ffe39a', garl: '#2a2f55',
    cat: '#0b0b16', catR: '#34337a', catRL: '#5755b0', inner: '#1d1d38', eye: '#7fd4ff', eyeL: '#d4f3ff', eyeD: '#3b9bd9', pupil: '#0a1030',
    gold: '#ffd36a', gold2: '#ffb347', nose: '#c97aa8', mouth: '#1d1d38', collar: '#3b3a78', glint: '#ffffff', blush: '#7a3a5c',
    eyeGlow: '#7fd4ff', rainSky0: '#171d33', rainSky1: '#1d2540', cloud: '#2a3150', cloudL: '#384063', rain: '#9fb8e6', rainF: '#6f86b8', drop: '#c4e6fb', catHi: '#13132c', star: '#ffffff', page: '#e6f0ff', page2: '#c4e6fb', cover: '#ff9fb5', coverD: '#b05a7a'
  }).forEach(([k, v]) => (C[k] = hex(v)));

  /* ---------------- tiny raster helpers ---------------- */
  function buf() { return new Uint8ClampedArray(W * H * 4); }
  function set(b, x, y, c, a = 255) {
    x |= 0; y = (y | 0) + OY; if (x < 0 || y < 0 || x >= W || y >= H || !c) return;
    const i = (y * W + x) * 4;
    if (a >= 255) { b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = 255; }
    else { const k = a / 255; b[i] = b[i] * (1 - k) + c[0] * k; b[i + 1] = b[i + 1] * (1 - k) + c[1] * k; b[i + 2] = b[i + 2] * (1 - k) + c[2] * k; b[i + 3] = 255; }
  }
  const rect = (b, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(b, x + i, y + j, c); };
  const ell = (b, cx, cy, rx, ry, c) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) set(b, x, y, c); };
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const bay = (x, y) => BAY[y & 3][x & 3] / 16;
  const mulc = (c, k) => [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
  const mixc = (a, b, k) => [Math.round(a[0] + (b[0] - a[0]) * k), Math.round(a[1] + (b[1] - a[1]) * k), Math.round(a[2] + (b[2] - a[2]) * k)];
  // a very soft breeze that comes and goes (the close-up in shelf.js uses the same clock, so both rooms sway together)
  const gust = t => Math.max(0, Math.sin(t * .11 + 1) * Math.sin(t * .29 + .5));
  const breeze = t => .55 + .9 * gust(t) + .45 * R.wind;

  /* ---------------- the room (static part) ---------------- */
  const WIN = {x: 44, y: 9, w: 33, h: 36, bar: 17}; // grows upward in tall rooms (see build)
  let DECO = {};
  let NOD = false; // true: bake the room without the blanket hanging over the bed rim (it is on Moon instead)
  function drawRoom(b) {
    DECO = {};
    // wall with a soft diamond wallpaper
    for (let y = -OY; y < 70; y++) for (let x = 0; x < W; x++) {
      let c = (x + (y >> 3)) % 12 < 6 ? C.wall : C.wall2;
      if ((x % 12 === 6 && y % 8 === 4) || (x % 12 === 0 && y % 8 === 0)) c = C.wallDot;
      set(b, x, y, c);
    }
    // wainscot + baseboard
    rect(b, 0, 58, W, 1, C.trimL); rect(b, 0, 59, W, 11, C.wall2);
    for (let x = 4; x < W; x += 15) { rect(b, x, 61, 11, 1, C.trimD); rect(b, x, 61, 1, 7, C.trimD); rect(b, x, 67, 11, 1, C.wall); rect(b, x + 10, 61, 1, 7, C.wall); }
    rect(b, 0, 70, W, 2, C.trim); rect(b, 0, 72, W, 1, C.trimD);
    // floor: planks
    for (let y = 73; y < H - OY; y++) for (let x = 0; x < W; x++) {
      const row = Math.floor((y - 73) / 6), off = (row * 17) % 40;
      let c = row % 2 ? C.floor : C.floor2;
      if ((y - 73) % 6 === 0) c = C.gap;
      else if ((x + off) % 40 === 0) c = C.gap;
      else if ((y - 73) % 6 === 1 && bay(x, y) > .7) c = C.floorL;
      set(b, x, y, c);
    }
    // ceiling molding
    if (OY > 0) { rect(b, 0, -OY, W, 2, C.trimD); rect(b, 0, -OY + 2, W, 1, C.trim); rect(b, 0, -OY + 3, W, 1, C.wall2); }
    const k = OY / 100;
    // left wall: hanging plant from the ceiling (the leaves are drawn live so they sway) + a small floating shelf
    { const hx = 24, bot = Math.round(14 - 70 * k); DECO.plant = [hx - 7, bot - 6, hx + 7, bot + 19]; DECO.hang = {hx, bot};
      if (OY > 12) for (let y = -OY + 4; y < bot - 10; y++) set(b, hx, y, C.brassD);
      set(b, hx, bot - 10, C.brassL); set(b, hx - 1, bot - 10, C.brass); set(b, hx + 1, bot - 10, C.brass); // ring
      for (let i = 1; i <= 4; i++) { set(b, hx - i, bot - 10 + i, C.brassD); set(b, hx + i, bot - 10 + i, C.brassD); } // macrame strings
      for (let y = bot - 9; y < bot - 5; y++) set(b, hx, y, C.brassD);
      rect(b, hx - 4, bot - 5, 9, 5, C.pot); rect(b, hx - 4, bot - 5, 9, 1, C.potL); rect(b, hx - 3, bot, 7, 1, C.pot);
      for (let x = hx - 3; x <= hx + 3; x += 2) set(b, x, bot - 3, C.potL); }
    { const sy = Math.round(20 - 6 * k);
      rect(b, 3, sy, 20, 2, C.woodL); rect(b, 3, sy + 2, 20, 1, C.woodD); rect(b, 5, sy + 3, 1, 3, C.woodD); rect(b, 20, sy + 3, 1, 3, C.woodD);
      rect(b, 5, sy - 5, 3, 5, C.page); set(b, 6, sy - 6, C.brassD); // candle (its flame is drawn live)
      DECO.candle = [3, sy - 10, 8, sy]; DECO.flame = [6, sy - 7]; DECO.jar = [9, sy - 7, 14, sy]; DECO.box = [15, sy - 5, 21, sy];
      rect(b, 10, sy - 6, 4, 6, C.bk1); rect(b, 10, sy - 6, 4, 1, C.page2); set(b, 11, sy - 3, C.bk6); set(b, 12, sy - 4, C.bk6); // jar
      rect(b, 16, sy - 4, 5, 4, C.bk3); rect(b, 16, sy - 4, 5, 1, C.page); // small box
    }
    // right wall: framed crescent above the bookshelf + a round clock above that
    { const py = Math.round(2 - 30 * k); DECO.picture = [95, py - 1, 113, py + 14];
      rect(b, 96, py, 16, 13, C.frame); rect(b, 97, py + 1, 14, 11, C.pic); rect(b, 96, py, 16, 1, C.frameL);
      ell(b, 103.5, py + 6.5, 4, 4, C.picM); ell(b, 105.5, py + 5, 3.6, 3.6, C.pic); set(b, 99, py + 3, C.starB); set(b, 108, py + 9, C.star);
      if (OY > 50) { const cy = Math.round(py - 22 * k - 8), cx = 104;
        DECO.clock = [cx - 7, cy - 7, cx + 7, cy + 7];
        ell(b, cx, cy, 6.5, 6.5, C.frame); ell(b, cx, cy, 5.3, 5.3, C.page2); set(b, cx, cy - 4, C.trimD); set(b, cx + 4, cy, C.trimD); set(b, cx, cy + 4, C.trimD); set(b, cx - 4, cy, C.trimD);
      }
    }
    // star garland across the top
    for (let x = 2; x < W - 2; x++) { const y = GY + Math.round(3 * Math.sin((x - 2) / (W - 4) * Math.PI)); set(b, x, y, C.garl); }
    // window frame (the sky is drawn live)
    rect(b, WIN.x - 2, WIN.y - 2, WIN.w + 4, WIN.h + 4, C.frame); rect(b, WIN.x - 2, WIN.y - 2, WIN.w + 4, 1, C.frameL);
    rect(b, WIN.x, WIN.y, WIN.w, WIN.h, C.sky0);
    rect(b, WIN.x - 4, WIN.y + WIN.h + 1, WIN.w + 8, 3, C.sill); rect(b, WIN.x - 4, WIN.y + WIN.h + 1, WIN.w + 8, 1, C.bowlL);
    // curtains + rod
    rect(b, WIN.x - 9, WIN.y - 5, WIN.w + 18, 2, C.rod); set(b, WIN.x - 10, WIN.y - 5, C.brassL); set(b, WIN.x + WIN.w + 9, WIN.y - 5, C.brassL);
    // (the curtains and their tie-backs are drawn live: see drawCurtains)
    // bookshelf (right): a crown, three rows (four bright "topic" spines per row among quiet ones, like the close-up in shelf.js) and a cabinet
    const S = {x: 92, y: 26, w: 25, h: 56};
    rect(b, S.x, S.y, S.w, S.h, C.wood); rect(b, S.x - 1, S.y - 1, S.w + 2, 1, C.woodH); rect(b, S.x - 1, S.y, S.w + 2, 2, C.woodL);
    set(b, S.x - 1, S.y + 2, C.woodD); set(b, S.x + S.w, S.y + 2, C.woodD);
    rect(b, S.x, S.y + 2, 1, S.h - 2, C.woodL); rect(b, S.x + S.w - 1, S.y + 2, 1, S.h - 2, C.woodD);
    const BK = [C.bk1, C.bk2, C.bk3, C.bk4, C.bk5, C.bk6, C.bk7];
    const TOP = [['#5fb8e8', '#e5799a', '#e8b84a', '#8aa0c8'], ['#6cc4a8', '#7a76e0', '#e88f3a', '#c9b27a'], ['#9fc8ec', '#a8d070', '#d65f6f', '#78a392']].map(r => r.map(hex));
    const PLAN = [['f1', 'T', 'f1', 'T', 'f1', 'T', 'T'], ['T', 'f1', 'T', 'f1', 'T', 'f1', 'T'], ['f1', 'T', 'T', 'f1', 'T', 'T']], AX = [100, 100, 101];
    let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let r = 0; r < 3; r++) {
      const top = S.y + 2 + r * 14, base = top + 12;
      rect(b, S.x + 2, top, S.w - 4, 12, C.woodD);
      if (r > 0) rect(b, S.x + 2, top, S.w - 4, 1, C.gap); // shade under the plank above
      let x = AX[r], ti = 0;
      for (const p of PLAN[r]) {
        if (p === 'T') {
          const h = 9 + ((r + ti) % 2), c = TOP[r][ti++];
          rect(b, x, base - h, 1, h, mulc(c, 1.2)); rect(b, x + 1, base - h, 1, h, mulc(c, .8)); set(b, x, base - h, mulc(c, 1.5)); set(b, x + 1, base - h, c);
          rect(b, x, base - h + 2, 2, 1, C.brassL); rect(b, x, base - 3, 2, 1, C.brassD);
          x += 2;
        } else {
          const w = p === 'f1' ? 1 : 2, h = 6 + ((rnd() * 4) | 0), c = mulc(mixc(BK[(rnd() * BK.length) | 0], [90, 84, 120], .35), .45 + rnd() * .1);
          rect(b, x, base - h, w, h, c); set(b, x, base - h, mulc(c, 1.6)); if (w > 1) rect(b, x + 1, base - h + 1, 1, h - 1, mulc(c, .78));
          x += w;
        }
      }
      rect(b, S.x + 1, base, S.w - 2, 1, C.woodL); rect(b, S.x + 1, base + 1, S.w - 2, 1, C.wood);
      if (r === 0) { // a little globe on a brass stand, and a fern
        ell(b, 97.5, base - 6.5, 3.2, 3.2, C.sky1); ell(b, 97.5, base - 6.5, 2.6, 2.6, [34, 72, 120]);
        set(b, 96, base - 7, C.leaf); set(b, 97, base - 7, C.leaf); set(b, 98, base - 6, C.leaf); set(b, 97, base - 5, C.leaf);
        for (let a2 = 0; a2 < 18; a2++) { const q = a2 / 18 * Math.PI * 2; set(b, 97.5 + Math.cos(q) * 3.9, base - 6.5 + Math.sin(q) * 3.9, C.brass); }
        rect(b, 97, base - 3, 2, 2, C.brassD); rect(b, 95, base - 1, 6, 1, C.brass);
        rect(b, 111, base - 3, 4, 3, C.pot); rect(b, 111, base - 3, 4, 1, C.potL);
        [[111.5, -5.5, 1.7, 1.2, 0], [114, -5.5, 1.6, 1.2, 1], [112.8, -7.6, 1.5, 1.5, 1], [110.8, -4.2, 1.2, 1, 0]].forEach(([lx, ly2, rx, ry, l]) => ell(b, lx, base + ly2, rx, ry, l ? C.leafL : C.leaf));
      } else if (r === 1) { // a leaning picture, a candle (its flame is drawn live)
        rect(b, 95, base - 8, 5, 8, C.woodD); rect(b, 96, base - 7, 3, 6, C.sky1); set(b, 97, base - 5, C.picM); set(b, 97, base - 4, C.picM); set(b, 98, base - 4, C.picM); set(b, 98, base - 6, C.star);
        rect(b, 111, base - 2, 5, 2, C.brass); rect(b, 111, base - 2, 5, 1, C.brassL);
        rect(b, 112, base - 8, 3, 6, C.page); rect(b, 112, base - 8, 1, 6, C.page2); set(b, 113, base - 9, C.pic);
        DECO.sflame = [113, base - 10];
      } else { // a lying stack and a tiny cactus
        [[94, 6, C.bk5], [95, 5, C.bk3], [94, 6, C.bk2]].forEach(([sx, sw, c], i) => { const cc = mulc(c, .85); rect(b, sx, base - 2 * (i + 1), sw, 2, cc); rect(b, sx, base - 2 * (i + 1), sw, 1, mulc(c, 1.2)); set(b, sx + sw - 1, base - 2 * (i + 1) + 1, C.page); });
        rect(b, 112, base - 3, 3, 3, C.pot); rect(b, 112, base - 3, 3, 1, C.potL);
        rect(b, 113, base - 8, 2, 5, C.leaf); rect(b, 113, base - 8, 1, 5, C.leafL); set(b, 112, base - 6, C.leaf); set(b, 112, base - 7, C.leaf); set(b, 114, base - 9, C.pinkL);
      }
    }
    rect(b, S.x + 2, S.y + 44, S.w - 4, 10, C.woodD); // bottom cabinet
    rect(b, S.x + 3, S.y + 45, 9, 8, C.wood); rect(b, S.x + 13, S.y + 45, 9, 8, C.wood); set(b, S.x + 11, S.y + 49, C.brassL); set(b, S.x + 13, S.y + 49, C.brassL);
    rect(b, S.x + 3, S.y + 45, 9, 1, C.woodL); rect(b, S.x + 13, S.y + 45, 9, 1, C.woodL);
    // pot on top of the shelf (its leaves are drawn live)
    rect(b, S.x + 15, S.y - 7, 7, 6, C.pot); rect(b, S.x + 15, S.y - 7, 7, 1, C.potL); set(b, S.x + 17, S.y - 4, C.potL); set(b, S.x + 19, S.y - 4, C.potL);
    DECO.sp = {x: S.x, y: S.y}; DECO.shelfPlant = [S.x + 10, S.y - 17, S.x + 25, S.y + 12];
    // floor lamp (left) — pole + base; the shade is drawn live
    rect(b, 13, 38, 2, 46, C.brassD); rect(b, 13, 38, 1, 46, C.brass);
    ell(b, 14, 85, 6, 2, C.brassD); rect(b, 9, 84, 11, 1, C.brass);
    // vintage gramophone on a low record cabinet (the record + tone arm are drawn live)
    { const cx = 20, top = 76;
      rect(b, cx, top, 24, 2, C.woodL); rect(b, cx, top + 2, 24, 1, C.woodD); rect(b, cx + 1, top + 3, 22, 9, C.wood);
      rect(b, cx + 1, top + 3, 1, 9, C.woodL); rect(b, cx + 22, top + 3, 1, 9, C.woodD);
      // left nook: a row of record sleeves
      rect(b, cx + 3, top + 4, 9, 7, C.woodD);
      [C.bk2, C.bk5, C.bk1, C.bk3, C.bk6, C.bk4, C.bk7].forEach((c, i) => { rect(b, cx + 4 + i, top + 5 + (i % 3 === 1 ? 1 : 0), 1, 6 - (i % 3 === 1 ? 1 : 0), c); });
      set(b, cx + 9, top + 6, C.page2); // one sleeve pulled a little out
      // right: small door with a brass knob
      rect(b, cx + 13, top + 4, 8, 7, C.woodD); rect(b, cx + 14, top + 5, 6, 5, C.wood); rect(b, cx + 14, top + 5, 6, 1, C.woodL); set(b, cx + 15, top + 7, C.brassL);
      rect(b, cx + 2, top + 12, 2, 2, C.woodD); rect(b, cx + 20, top + 12, 2, 2, C.woodD);
      for (let x = cx; x < cx + 24; x++) set(b, x, top + 14, C.gap);
      // gramophone box
      rect(b, 25, 70, 13, 6, C.woodD); rect(b, 25, 70, 13, 1, C.woodL); rect(b, 26, 71, 11, 4, C.wood);
      rect(b, 26, 73, 11, 1, C.brass); set(b, 31, 73, C.brassL); set(b, 25, 75, C.brassD); set(b, 37, 75, C.brassD);
      // crank on the right side
      set(b, 38, 72, C.brassD); set(b, 39, 72, C.brassD); set(b, 40, 71, C.brassD); set(b, 40, 70, C.brass); set(b, 41, 70, C.brassL);
      // the brass horn: a slim neck rising from the box, then a cone that opens up and to the left
      rect(b, 30, 66, 2, 4, C.brassD); set(b, 30, 66, C.brass); set(b, 30, 67, C.brass);
      const p0 = [31, 66], p1 = [20.5, 54.5], L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const d = [(p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L], nn = [-d[1], d[0]], rad = u => .9 + 6 * u ** 2.1;
      for (let y = 44; y <= 68; y++) for (let x = 12; x <= 34; x++) {
        const qx = x + .5 - p0[0], qy = y + .5 - p0[1], u = (qx * d[0] + qy * d[1]) / L, v = qx * nn[0] + qy * nn[1];
        if (u < 0 || u > 1) continue; const r = rad(u); if (Math.abs(v) > r) continue;
        const k = v / r; let c = C.brass;
        if (k < -.72 || k > .7) c = C.brassD; else if (k > -.5 && k < -.12) c = C.brassL;
        if (r > 2.5 && Math.abs(Math.abs(k) - .42) < .09) c = C.brassD; // panel seams
        set(b, x, y, c);
      }
      const mx = p1[0], my = p1[1], R1 = rad(1) + .6;
      const oval = (rx, ry, c) => { for (let y = Math.floor(my - R1 - 1); y <= my + R1 + 1; y++) for (let x = Math.floor(mx - R1 - 1); x <= mx + R1 + 1; x++) {
        const qx = x + .5 - mx, qy = y + .5 - my, aa = qx * nn[0] + qy * nn[1], cc = qx * d[0] + qy * d[1];
        if ((aa / rx) ** 2 + (cc / ry) ** 2 <= 1) set(b, x, y, c); } };
      oval(R1, R1 * .5, C.brassL); oval(R1 - .9, R1 * .5 - .7, C.brassD); oval(R1 - 1.8, R1 * .5 - 1.1, C.woodD); oval(R1 - 3.6, R1 * .5 - 1.6, C.gap);
      DECO.horn = [mx, my]; DECO.phono = [15, my - 5, 42, 90];
      // a mug on the cabinet, next to the gramophone
      rect(b, 40, 73, 3, 3, C.bk1); set(b, 43, 74, C.bk1); set(b, 40, 73, C.page2);
      DECO.mug = [39, 67, 44, 76]; DECO.steam = [41.5, 72];
    }
    // round braided carpet (center): soft dark-grey coils with a lilac stitch ring and tiny stars
    { const cx = 61, cy = 105, rx = 30, ry = 12;
      ell(b, cx, cy + 1.5, rx + .5, ry, C.gap); // soft shadow on the floor
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, r = Math.hypot(dx, dy);
        // scalloped outer edge
        const ang = Math.atan2(dy, dx), edge = 1 - .025 * (1 + Math.cos(ang * 22));
        if (r > edge) continue;
        const band = Math.floor(r * 8), f = r * 8 - band;
        const BAND = [C.rugB, C.rugC, C.rugB, C.rugA, C.rugAcc, C.rugB, C.rugC, C.rugA];
        let c = BAND[Math.min(7, band)];
        // braid: little slanted stitches running around each coil
        const k = Math.floor((ang + Math.PI) / (Math.PI * 2) * (40 + band * 14) + f * 2.2);
        if (f < .2 || f > .86) c = C.rugA; else if ((k & 1) && f > .35 && f < .7) c = band === 4 ? C.rugHi : c === C.rugA ? C.rugB : C.rugC;
        if (r > edge - .05) c = C.rugEdge;
        set(b, x, y, c);
      }
      // tiny stitched stars on the lilac ring
      for (let i = 0; i < 10; i++) { const t = i / 10 * Math.PI * 2 + .3, x = Math.round(cx + Math.cos(t) * rx * .565), y = Math.round(cy + Math.sin(t) * ry * .565);
        set(b, x, y, C.starG); set(b, x - 1, y, C.rugHi); set(b, x + 1, y, C.rugHi); set(b, x, y - 1, C.rugHi); set(b, x, y + 1, C.rugHi); }
    }
    // cat bed (bottom left): a big plush donut bed, a pile of pillows and a dark plaid wool blanket over the rim
    { const cx = 25, cy = 111;
      ell(b, cx + 1, cy + 6.5, 22, 4, C.gap); // shadow
      // back of the bolster rim
      ell(b, cx, cy, 22, 8.6, C.bedD); ell(b, cx, cy - .8, 21.2, 7.8, C.bed);
      for (let x = cx - 20; x <= cx + 20; x++) { const y = Math.round(cy - .8 - 7.6 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 21) ** 2))); set(b, x, y, C.bedL); if (bay(x, y) > .5) set(b, x, y + 1, C.bedL); }
      // pillows leaning on the back rim
      const pillow = (x0, y0, w, h, c, cl, cd) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const ex = (i + .5 - w / 2) / (w / 2), ey = (j + .5 - h / 2) / (h / 2); if (Math.abs(ex) ** 2.6 + Math.abs(ey) ** 2.6 > 1) continue;
          set(b, x0 + i, y0 + j, ey < -.45 || (ex < -.4 && ey < .2) ? cl : ey > .55 || ex > .7 ? cd : c); }
        set(b, x0 + (w >> 1), y0 + (h >> 1), cd); };
      pillow(5, 96, 15, 10, C.pil, C.pilL, C.pilD);           // big lilac pillow
      pillow(29, 97, 13, 9, C.page2, C.page, C.bk6);           // soft blue pillow
      // little crescent moon pillow
      ell(b, 21, 101.5, 4.6, 4.2, C.gold2); ell(b, 21, 101, 4, 3.6, C.gold); ell(b, 23.4, 99.6, 3.3, 3.1, C.bed); set(b, 18, 100, C.page);
      // round pink pillow with a star button
      ell(b, 37, 103, 4.2, 3.4, C.pinkD); ell(b, 36.6, 102.6, 3.7, 2.9, C.pink); ell(b, 35.8, 101.8, 1.8, 1.1, C.pinkL); set(b, 37, 103, C.starG);
      // the soft inner cushion where Moon sleeps (quilted)
      ell(b, cx, cy + 1, 16, 5.2, C.cush); ell(b, cx - 1, cy + .5, 14, 4.2, C.cushL);
      for (const [qx, qy] of [[-9, 0], [-3, -1], [3, 0], [9, 1], [-6, 3], [0, 3], [6, 3]]) set(b, cx + qx, cy + 1 + qy, C.cush);
      // front of the bolster rim: thick, fluffy
      for (let x = cx - 21; x <= cx + 21; x++) {
        const s0 = Math.sqrt(Math.max(0, 1 - ((x - cx) / 21.5) ** 2)), top = Math.round(cy + 4.6 * s0), bot = Math.round(cy + 8.4 * s0);
        for (let y = top; y <= bot; y++) set(b, x, y, y === top ? C.pilL : y === top + 1 ? C.bedL : y >= bot - 1 ? C.bedD : (bay(x, y) > .82 ? C.fur : C.bed));
      }
      // knitted blanket draped over the front-right of the rim (cream with pink stripes), wavy hem
      if (!NOD) for (let x = 30; x <= 43; x++) {
        const s0 = Math.sqrt(Math.max(0, 1 - ((x - cx) / 21.5) ** 2)), top = Math.round(cy + 4.6 * s0) - 1;
        const hem = Math.round(cy + 8.4 * s0) + 2 + ((x & 3) === 1 ? 1 : 0);
        for (let y = top; y <= hem; y++) {
          const row = y - top, knit = (x + row) & 1; // dark wool plaid (same tartan as the close-up, at the room's scale)
          const band = f => { f = ((Math.floor(f) % 10) + 10) % 10; return f < 3 ? 2 : f === 4 ? 3 : f === 6 ? 1 : 0; }, A = band(row), B = band(x - 30);
          let c = A === 3 || B === 3 ? (A === 3 && B === 3 ? C.plL : C.plLd) : A === 2 && B === 2 ? C.plRd : A === 2 || B === 2 ? C.plR : A === 1 || B === 1 ? C.plBd : C.plB;
          if (knit) c = c.map(v => Math.round(v * .95));
          if (x === 30 || y === hem) c = C.plBd;
          set(b, x, y, c);
        }
      }
      if (!NOD) for (let x = 31; x <= 43; x++) set(b, x, Math.round(cy + 8.4 * Math.sqrt(Math.max(0, 1 - ((x - cx) / 21.5) ** 2))) + 4, x & 1 ? C.plLd : C.plL); // short thread fringe
    }
    // food mat + bowl (bottom right)
    rect(b, 84, 109, 24, 7, C.mat); rect(b, 84, 109, 24, 1, C.curtL); for (let x = 85; x < 108; x += 3) set(b, x, 115, C.matD);
    drawBowl(b);
    // small things on the floor in front (only when there is room for them)
    if (H - OY > 140) {
      const fy = Math.min(H - OY - 8, 128); DECO.yarn = [72, fy - 7, 90, fy + 2]; DECO.books = [34, fy - 6, 47, fy + 2]; SPOT.yarn = {x: 64, y: fy + 1}; DECO.fy = fy;
      ell(b, 78, fy + 1, 4, 1.5, C.gap); // the yarn ball itself is drawn live (it rolls when Moon plays)
      rect(b, 36, fy - 1, 9, 3, C.bk5); rect(b, 36, fy - 2, 9, 1, C.page); rect(b, 37, fy - 4, 7, 2, C.bk2); rect(b, 37, fy - 4, 7, 1, C.page); // two books on the floor
    }
    // a few floor shadows under furniture
    for (let x = 92; x < 117; x++) set(b, x, 82, C.gap);
  }
  function drawBowl(b) {
    ell(b, 96, 111.5, 8, 3, C.bowlD); rect(b, 88, 107, 17, 4, C.bowl); ell(b, 96, 107, 8.5, 2.2, C.bowlL); ell(b, 96, 107, 7, 1.6, C.bowlD);
    set(b, 99, 109, C.fish); set(b, 100, 109, C.fish); set(b, 101, 109, C.fish); set(b, 102, 108, C.fish); set(b, 102, 110, C.fish);
  }

  /* ---------------- lighting ---------------- */
  const LAMP = {x: 14, y: 33};
  function inBeam(x, y) { // moonlight from the window onto the floor
    if (y < 72 || y > 122) return 0;
    const t = (y - 72) / 50, l = 50 + t * 16, r = 74 + t * 20;
    return x >= l && x <= r ? 1 - t * .5 : 0;
  }
  function lcalc(x, y, on, o) { // the room's light at (x, y): o = [brightness factor, add r, add g, add b]
    const vig = Math.max(.55, 1 - .5 * (((x - 60) / 70) ** 2 + ((y - 72) / 80) ** 2));
    if (on) {
      const d = Math.hypot(x - LAMP.x, (y - LAMP.y) * .85), warm = Math.max(0, 1 - d / 78) ** 1.5;
      const wd = Math.max(0, 1 - Math.hypot(x - 60, y - 27) / 30);
      o[0] = (.76 + .6 * warm) * vig + .08 * wd; o[1] = 34 * warm; o[2] = 20 * warm; o[3] = 0;
    } else {
      const wd = Math.max(0, 1 - Math.hypot(x - 60, y - 27) / 42), beam = inBeam(x, y);
      o[0] = (.52 + .3 * wd + .38 * beam * (bay(x, y) > .15 ? 1 : .8)) * vig; o[1] = 0; o[2] = 8 * (wd + beam); o[3] = 22 * (wd + beam);
    }
  }
  function light(src, on) {
    const out = new Uint8ClampedArray(src), o = [0, 0, 0, 0];
    for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) {
      const i = (yy * W + x) * 4; lcalc(x, yy - OY, on, o);
      out[i] = Math.min(255, src[i] * o[0] + o[1]); out[i + 1] = Math.min(255, src[i + 1] * o[0] + o[2]); out[i + 2] = Math.min(255, src[i + 2] * o[0] + o[3]);
    }
    return out;
  }
  function bakeL() { // the same light as a lookup table, so things drawn live (curtains, leaves) are lit just like the baked room
    const n = W * H * 4; R.LF = [new Float32Array(n), new Float32Array(n)]; const o = [0, 0, 0, 0];
    for (let k = 0; k < 2; k++) for (let yy = 0; yy < H; yy++) for (let x = 0; x < W; x++) { lcalc(x, yy - OY, k === 0, o); R.LF[k].set(o, (yy * W + x) * 4); }
  }
  function setLit(b, x, y, c, a = 255) { // like set(), but the colour is lit by the lamp / moonlight first
    x |= 0; const yy = (y | 0) + OY; if (x < 0 || yy < 0 || x >= W || yy >= H || !c) return;
    const p = (yy * W + x) * 4, A = R.LF[0], B = R.LF[1], m = R.mix, f = B[p] + (A[p] - B[p]) * m;
    const r = Math.min(255, c[0] * f + B[p + 1] + (A[p + 1] - B[p + 1]) * m), g = Math.min(255, c[1] * f + B[p + 2] + (A[p + 2] - B[p + 2]) * m), bl = Math.min(255, c[2] * f + B[p + 3] + (A[p + 3] - B[p + 3]) * m);
    if (a >= 255) { b[p] = r; b[p + 1] = g; b[p + 2] = bl; b[p + 3] = 255; }
    else { const k = a / 255; b[p] = b[p] * (1 - k) + r * k; b[p + 1] = b[p + 1] * (1 - k) + g * k; b[p + 2] = b[p + 2] * (1 - k) + bl * k; b[p + 3] = 255; }
  }
  const ellL = (b, cx, cy, rx, ry, c, a) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) setLit(b, x, y, c, a); };

  /* ---------------- the cat: full body sprites ---------------- */
  /* ---------------- state ---------------- */
  const SPOT = {rug: {x: 60, y: 106}, bed: {x: 22, y: 112}, bowl: {x: 96, y: 106}, shelf: {x: 103, y: 99}};
  const R = {
    cv: null, ctx: null, api: null, bgOn: null, bgOff: null, mix: 1, lampOn: true,
    spot: 'rug', pose: 'sit', poseUntil: 0, lastTouch: Date.now(), tp: null, parts: [], taps: [],
    lookUntil: 0, look: [0, 0], happyUntil: 0, squintUntil: 0, eatUntil: 0, readUntil: 0, idleSayAt: 0, shootAt: 0,
    angryUntil: 0, sulkUntil: 0, earsUntil: 0, tiltUntil: 0, pawUntil: 0, paw: null, wideUntil: 0, flickUntil: 0, playUntil: 0, act: null, actUntil: 0, nextIdle: Date.now() + 15000,
    wind: 0, LF: null, rain: false, rainMix: 0, flashAt: 0, windowUntil: 0, turnUntil: 0, watchSayAt: 0, active: false
  };
  const now = () => Date.now();
  const st = () => R.api.state();
  function fullness() {
    const s = st(); const v = (s.full ?? 70) - (now() - (s.fullAt || now())) / 36e5 * (100 / 24);
    return Math.max(0, Math.min(100, v));
  }
  function say(key, vars) { const line = R.api.words(key, vars); if (line) R.api.say(line, spotXY()); return line; }
  function spotXY() { const p = SPOT[R.spot]; return {x: p.x / W, y: (p.y - (R.pose === 'sleep' ? 22 : 34) + OY) / H}; }

  function teleport(to, pose, after) {
    if (R.tp) return;
    if (R.spot === to) { R.pose = pose; after && after(); return; }
    R.tp = {from: R.spot, to, pose, t0: now(), after};
    sparkle(SPOT[R.spot], 10);
  }
  function sparkle(p, n, col) {
    for (let i = 0; i < n; i++) R.parts.push({x: p.x + (Math.random() - .5) * 16, y: p.y - Math.random() * 22, vx: (Math.random() - .5) * 6, vy: -8 - Math.random() * 14, life: .7 + Math.random() * .5, t: 0, c: col || (Math.random() < .5 ? 'starG' : 'starB'), kind: 'spark'});
  }
  function goWindow(auto) {
    if (R.tp || R.spot === 'window' || R.pose === 'eat' || R.pose === 'read') return;
    if (R.pose === 'sleep') R.pose = 'sit';
    teleport('window', 'sit', () => {
      R.windowUntil = now() + (auto ? 20000 : 26000) + Math.random() * 12000; R.watchSayAt = now() + 6000; R.turnUntil = 0;
      if (!auto || Math.random() < .6) say(R.rain ? 'room_window_rain' : 'room_window_go');
    });
  }
  function leaveWindow(quiet) { if (R.spot !== 'window' || R.tp) return; if (!quiet && Math.random() < .5) say('room_window_leave'); teleport('rug', 'sit'); }
  function goSleep() { teleport('bed', 'sleep', () => { say('room_sleep'); }); }
  function wake(key) { R.covered = false; R.lastTouch = now(); R.pose = 'sit'; R.squintUntil = now() + 1600; if (key) say(key); setTimeout(() => { if (R.spot === 'bed' && R.pose === 'sit') teleport('rug', 'sit'); }, 1400); }
  function feedBowl(n = 1) { const s = st(); s.food = Math.min(5, (s.food || 0) + n); R.api.save(); }
  function eat(auto) {
    const s = st();
    if (!s.food) { teleport('bowl', 'sit', () => { R.look = [0, 1]; R.lookUntil = now() + 2500; say('room_bowl_empty'); setTimeout(() => R.spot === 'bowl' && R.pose === 'sit' && teleport('rug', 'sit'), 3500); }); return; }
    if (!auto && fullness() > 92) { say('room_not_hungry'); return; }
    teleport('bowl', 'eat', () => {
      R.eatUntil = now() + 3600; say('room_eat');
      setTimeout(() => {
        const s2 = st(); s2.food = Math.max(0, (s2.food || 0) - 1); s2.full = Math.min(100, fullness() + 45); s2.fullAt = now(); R.api.save();
        R.pose = 'sit'; R.happyUntil = now() + 1600; heart(SPOT.bowl);
        setTimeout(() => R.spot === 'bowl' && R.pose === 'sit' && teleport('rug', 'sit'), 2200);
      }, 3600);
    });
  }
  function heart(p) { for (let i = 0; i < 3; i++) R.parts.push({x: p.x - 4 + i * 4, y: p.y - 24, vx: (i - 1) * 2, vy: -10, life: 1.4, t: -i * .15, c: 'cover', kind: 'heart'}); }
  function read() {
    teleport('shelf', 'read', () => {
      R.readUntil = now() + 7000; say('room_read');
      const lines = R.api.insights();
      setTimeout(() => R.api.onRead(lines), 1100);
      setTimeout(() => { if (R.pose === 'read') { R.pose = 'sit'; setTimeout(() => R.spot === 'shelf' && R.pose === 'sit' && teleport('rug', 'sit'), 6000); } }, 7000);
    });
  }
  function toggleLamp() {
    R.lampOn = !R.lampOn; const s = st(); s.lamp = R.lampOn; R.api.save();
    if (R.pose === 'sleep') { if (R.lampOn) { wake('room_lamp_wake'); } return; }
    R.look = [-1, -1]; R.lookUntil = now() + 1800;
    if (R.lampOn) { R.squintUntil = now() + 1500; say('room_lamp_on'); } else say('room_lamp_off');
  }

  const inBox = (bx, px, py) => bx && px >= bx[0] && px <= bx[2] && py >= bx[1] && py <= bx[3];
  function hit(px, py) {
    const p = SPOT[R.spot], sw = CW - 4, sh = R.pose === 'sleep' ? 21 : CH;
    if (!R.tp && px >= p.x - sw / 2 - 2 && px <= p.x + sw / 2 + 2 && py >= p.y - sh - 2 && py <= p.y + 1) return 'cat';
    for (const k of ['flame', 'candle', 'jar', 'box', 'plant', 'picture', 'clock', 'shelfPlant', 'mug', 'phono', 'yarn', 'books']) if (k !== 'flame' && inBox(DECO[k], px, py)) return k;
    if (px >= 4 && px <= 24 && py >= 24 && py <= 87) return 'lamp';
    if (px >= 90 && px <= 118 && py >= 18 && py <= 83) return 'shelf';
    if (px >= 84 && px <= 108 && py >= 102 && py <= 116) return 'bowl';
    if (px >= 3 && px <= 47 && py >= 95 && py <= 121) return 'bed';
    if (px >= WIN.x && px <= WIN.x + WIN.w && py >= WIN.y && py <= WIN.y + WIN.h) return 'window';
    return null;
  }
  // which part of the sitting cat was touched
  function zone(px, py) {
    const p = SPOT[R.spot], x = px - (p.x - CW / 2), y = py - (p.y - CH);
    if (y < 4.5 && (x < 11 || x > 19)) return 'ears';
    if (x >= 22 && y >= 17) return 'tail';
    if (y >= 29) return 'paw';
    if (Math.abs(x - 15) <= 2.5 && y >= 17.5 && y <= 22) return 'charm';
    if (y < 9) return 'head';
    if (y < 17) return 'chin';
    return 'belly';
  }
  function leaves(bx) { for (let i = 0; i < 3; i++) R.parts.push({x: (bx[0] + bx[2]) / 2 + (Math.random() - .5) * 8, y: bx[1] + 6 + Math.random() * 6, vx: (Math.random() - .5) * 6, vy: 6 + Math.random() * 4, life: 1.6, t: -i * .2, c: i % 2 ? 'leaf' : 'leafL', kind: 'spark'}); }
  function touchCat(px, py) {
    const n = now(), z = zone(px, py);
    if (n < R.sulkUntil) { R.look = [0, 0]; return say('room_sulk'); }
    R.taps = R.taps.filter(t => n - t < 2600).concat(n);
    if (R.spot === 'window' && n >= R.turnUntil && n >= R.angryUntil) { R.turnUntil = n + 2600; R.look = [0, 1]; R.lookUntil = n + 2600; R.windowUntil = Math.max(R.windowUntil, n + 8000); return say(R.rain ? 'room_window_pet_rain' : 'room_window_pet'); }
    if (R.spot === 'window') R.turnUntil = n + 2600;
    if (z === 'belly') R.taps.push(n); // the belly counts double
    if (n < R.angryUntil) { // still cross and touched again: Moon leaves
      R.angryUntil = 0; R.taps = []; R.sulkUntil = n + 7000; say('room_flee');
      const to = R.spot === 'shelf' ? 'bowl' : 'shelf';
      teleport(to, 'sit', () => setTimeout(() => { if (R.spot === to && R.pose === 'sit' && now() >= R.sulkUntil - 200) teleport('rug', 'sit'); }, 7000));
      return;
    }
    if (R.taps.length >= 5) { R.taps = []; R.angryUntil = n + 2800; R.happyUntil = 0; say('room_angry'); return; }
    if (R.taps.length === 4) { R.squintUntil = n + 1500; say('annoyed'); return; }
    R.happyUntil = 0;
    switch (z) {
      case 'ears': R.earsUntil = n + 1300; say('room_ears'); break;
      case 'head': R.happyUntil = n + 1500; heart(SPOT[R.spot]); say('purr'); break;
      case 'chin': R.happyUntil = n + 1800; R.tiltUntil = n + 1800; heart(SPOT[R.spot]); say('room_chin'); break;
      case 'charm': R.charmUntil = n + 1200; R.look = [0, 1]; R.lookUntil = n + 1200; sparkle({x: SPOT[R.spot].x, y: SPOT[R.spot].y - 12}, 8, 'starG'); say('room_charm'); break;
      case 'belly': R.paw = 'both'; R.pawUntil = n + 900; R.wideUntil = n + 1200; say('room_belly'); break;
      case 'tail': R.flickUntil = n + 1400; R.look = [1, 0]; R.lookUntil = n + 1400; say('room_tail'); break;
      case 'paw': R.paw = 'wave'; R.pawUntil = n + 1300; say('room_paw'); break;
    }
  }
  function mumble() {
    const n = now(); R.sleepTaps = (R.sleepTaps || []).filter(t => n - t < 8000).concat(n);
    if (R.sleepTaps.length >= 6) { R.sleepTaps = []; R.earsUntil = n + 900; return say('room_sleep_grumble'); } // too much noise: a grumpy half-wake
    if (Math.random() < .4 && n - (R.mumbleAt || 0) > 2500) { R.mumbleAt = n; return say('room_sleeptalk'); }
    return null;
  }
  function tap(e) {
    const r = R.cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H - OY;
    const what = hit(px, py), n = now(); R.lastTouch = n;
    if (R.tp) return;
    if (what === 'cat') {
      if (R.pose === 'sleep') { if (R.spot === 'bed' && R.api.openBed) { R.api.openBed(); return; } return wake('wake'); } // tapping him asleep in his bed opens the close-up (he stays asleep)
      if (R.pose === 'eat') return say('room_eating');
      if (R.pose === 'read') return say('room_reading');
      if (n - (R.lastCatTap || 0) < 320 && n >= R.angryUntil && n >= R.sulkUntil) { R.hopAt = n; R.lastCatTap = 0; sparkle(SPOT[R.spot], 6); return say('room_hop'); }
      R.lastCatTap = n;
      return touchCat(px, py);
    }
    // things that do not need Moon
    const s = st(), asleep = R.pose === 'sleep';
    // while Moon sleeps the room still works, but she does not chat about it: only a sleepy mumble now and then
    const talk = (k, v) => asleep ? mumble() : say(k, v);
    if (what === 'candle' || what === 'jar' || what === 'box') {
      if (what === 'candle') { s.candle = !s.candle; R.api.save(); return talk(s.candle ? 'room_candle_on' : 'room_candle_off'); }
      return talk(what === 'jar' ? 'room_jar' : 'room_box');
    }
    if (what === 'plant' || what === 'shelfPlant') { leaves(DECO[what]); return talk('room_plant'); }
    if (what === 'picture') return talk('room_picture');
    if (what === 'clock') { const d = new Date(); return talk('room_clock', {time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')}); }
    if (what === 'mug') { for (let i = 0; i < 4; i++) R.parts.push({x: 41 + (Math.random() - .5) * 2, y: 71, vx: (Math.random() - .5) * 2, vy: -6, life: 1.4, t: -i * .25, c: 'page2', kind: 'spark'}); return talk('room_mug'); }
    if (what === 'books') return talk('room_books');
    if (what === 'phono') {
      const on = R.api.toggleMusic && R.api.toggleMusic(); R.armAt = n;
      if (R.pose !== 'sleep') { R.look = [-1, -1]; R.lookUntil = n + 1600; if (on) R.happyUntil = n + 1600; else R.earsUntil = n + 900; }
      return talk(on ? 'room_music_on' : 'room_music_off');
    }
    if (what === 'window') {
      if (!R.rain) R.shootAt = n;
      if (asleep) return talk('star');
      if (R.spot !== 'window' && R.pose === 'sit' && n >= R.sulkUntil) { goWindow(false); return; }
      if (R.spot === 'window') { R.windowUntil = Math.max(R.windowUntil, n + 10000); return say(R.rain ? 'room_window_tap_rain' : 'star'); }
      R.look = [1, -1]; R.lookUntil = n + 1600; return say(R.rain ? 'room_rain_idle' : 'star');
    }
    if (what === 'lamp') return toggleLamp();
    if (R.pose === 'eat' || R.pose === 'read') return;
    if (n < R.sulkUntil) return say('room_sulk');
    if (what === 'yarn') { if (R.pose === 'sleep') wake(); return teleport('yarn', 'sit', () => { R.playUntil = n + 4200; say('room_yarn'); setTimeout(() => { R.happyUntil = now() + 1200; setTimeout(() => R.spot === 'yarn' && R.pose === 'sit' && teleport('rug', 'sit'), 2500); }, 4300); }); }
    if (what === 'bed') { if (R.api.openBed) { R.lastTouch = n; R.api.openBed(); return; } if (R.pose === 'sleep') return wake('wake'); return goSleep(); }
    if (what === 'shelf') { if (R.api.openShelf) { R.lastTouch = n; R.api.openShelf(); return; } if (R.pose === 'sleep') wake(); return setTimeout(read, R.pose === 'sleep' ? 600 : 0); }
    if (what === 'bowl') { if (R.pose === 'sleep') wake(); return eat(false); }
    if (R.pose === 'sleep') return;
    // empty floor or wall: Moon looks that way, or comes back to the carpet
    const p = SPOT[R.spot];
    R.look = [px < p.x - 6 ? -1 : px > p.x + 6 ? 1 : 0, py < p.y - 30 ? -1 : 0]; R.lookUntil = n + 1500;
    if (R.spot !== 'rug') teleport('rug', 'sit'); else if (Math.random() < .3) say('room_floor');
  }

  /* ---------------- per-frame drawing ---------------- */
  function drawSky(b, t) {
    const {x, y, w, h} = WIN;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(b, x + i, y + j, j < h * .5 ? C.sky0 : C.sky1);
    const stars = [[3, 4], [9, 15], [27, 6], [14, 28], [30, 22], [6, 31], [22, 13], [18, 3], [29, 32], [2, 20]].map(([sx, sy]) => [sx, Math.round(sy * h / 36)]).concat(h > 50 ? [[11, Math.round(h * .62)], [25, Math.round(h * .7)], [5, Math.round(h * .5)], [20, Math.round(h * .38)]] : []);
    R.rainMix += ((R.rain ? 1 : 0) - R.rainMix) * .025; if (R.rainMix < .005) R.rainMix = 0;
    const rm = R.rainMix;
    if (rm > 0) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(b, x + i, y + j, j < h * .5 ? C.rainSky0 : C.rainSky1, 230 * rm);
    stars.forEach(([sx, sy], k) => { const tw = Math.sin(t * 1.7 + k * 1.9); if (tw > -.3) set(b, x + sx, y + sy, tw > .6 ? C.star : C.starB, 255 * (1 - rm)); });
    // the real moon phase
    const age = (((now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588853 + 29.530588853) % 29.530588853, ph = age / 29.530588853;
    const mx = x + 22, my = y + Math.round(11 * Math.max(1, h / 48)), mr = 6.5;
    for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) {
      const dx = i + .5, dy = j + .5; if (dx * dx + dy * dy > mr * mr) continue;
      const k = Math.cos(ph * 2 * Math.PI), xr = Math.sqrt(mr * mr - dy * dy);
      const lit = ph < .5 ? dx > -k * xr : dx < k * xr;
      set(b, mx + i, my + j, lit ? (dx + dy < -3 ? C.moon0 : (dx * dx + dy * dy > mr * mr * .7 ? C.moon2 : C.moon1)) : C.moonDark, 255 * (1 - .8 * rm));
    }
    if (rm > 0) drawRain(b, t, rm);
    // window cross bars
    for (let j = 0; j < h; j++) set(b, x + 16, y + j, C.frame);
    for (let i = 0; i < w; i++) set(b, x + i, y + WIN.bar, C.frame);
    // shooting star (every ~40 s, or when the window is tapped)
    const s = (now() - R.shootAt) / 900;
    if (s >= 0 && s < 1 && rm < .5) for (let k = 0; k < 5; k++) { const u = s - k * .05; if (u > 0) set(b, x + 2 + u * 26, y + 2 + u * Math.min(h - 4, 20), k < 2 ? C.star : C.starB); }
    if ((t | 0) % 41 === 0 && now() - R.shootAt > 5000) R.shootAt = now();
  }
  function drawRain(b, t, rm) {
    const {x, y, w, h} = WIN, inWin = (px, py) => px >= x && px < x + w && py >= y && py < y + h;
    const ws = (px, py, c, a) => { px = Math.round(px); py = Math.round(py); if (inWin(px, py)) set(b, px, py, c, a); };
    // slow drifting clouds
    for (let k = 0; k < 4; k++) {
      const cx = x - 14 + ((t * (1.2 + k * .35) + k * 19) % (w + 28)), cy = y + 3 + k * 5 + Math.sin(t * .2 + k) * 1.5;
      for (let j = -4; j <= 4; j++) for (let i = -12; i <= 12; i++) {
        const d = (i / 12) ** 2 + (j / (4 - Math.abs(i) * .12)) ** 2; if (d > 1) continue;
        ws(cx + i, cy + j, j < -1 ? C.cloudL : C.cloud, 150 * rm * (1 - d * .5));
      }
    }
    // falling rain: thin slanted streaks, two layers for depth
    for (let k = 0; k < 34; k++) {
      const far = k % 3 === 0, sp = far ? 34 : 58, len = far ? 2 : 4;
      const ph = (t * sp + k * 23.7) % (h + 10), x0 = x + ((k * 13.37) % (w + 8)) - 2 + ph * .28;
      for (let q = 0; q < len; q++) ws(x0 - q * .28, y - 5 + ph - q, far ? C.rainF : C.rain, (far ? 90 : 170) * rm * (1 - q / (len + 1)));
    }
    // drops sliding down the glass
    for (let k = 0; k < 7; k++) {
      const gx = x + 2 + ((k * 9.7) % (w - 4)), gy = y + ((t * (2.2 + k % 3) + k * 11) % (h + 4)) - 2;
      ws(gx, gy, C.drop, 210 * rm); ws(gx, gy - 1, C.drop, 90 * rm); ws(gx, gy - 2, C.drop, 40 * rm);
    }
    // tiny splashes on the sill
    for (let k = 0; k < 4; k++) { const sx = x - 2 + ((k * 11 + Math.floor(t * 6) * 7) % (w + 4)), on = (Math.floor(t * 9) + k) % 3 === 0; if (on) set(b, sx, y + h + 1, C.drop, 160 * rm); }
    // rare, soft lightning
    if (rm > .95 && Math.random() < 1 / (FPS * 35)) R.flashAt = now();
    const fl = (now() - R.flashAt) / 500;
    if (fl >= 0 && fl < 1) { const a = 170 * (1 - fl) * (fl < .15 || fl > .3 ? 1 : .4); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(b, x + i, y + j, C.moon0, a); }
  }
  function drawGarland(b, t) {
    for (let k = 0; k < 9; k++) {
      const x = 8 + k * 13, y = GY + 1 + Math.round(3 * Math.sin((x - 2) / (W - 4) * Math.PI));
      const c = [C.starG, C.starB, C.bk3][k % 3], on = R.lampOn ? .55 + .45 * Math.sin(t * 2 + k) : .25 + .2 * Math.sin(t + k);
      set(b, x - 2, y + 2, c, 45 * on); set(b, x + 2, y + 2, c, 45 * on); set(b, x, y + 4, c, 45 * on); set(b, x, y + 1, c, 255 * on); set(b, x - 1, y + 2, c, 140 * on); set(b, x + 1, y + 2, c, 140 * on); set(b, x, y + 2, C.star, 255 * on); set(b, x, y + 3, c, 140 * on);
    }
  }
  function drawLamp(b, t) {
    const on = R.lampOn;
    for (let j = 0; j < 10; j++) { const half = 4 + j * .55; for (let i = -Math.round(half); i <= Math.round(half); i++) set(b, 14 + i, 27 + j, on ? (j > 7 ? C.shadeOn2 : (i + j) % 5 === 0 ? C.shadeOn2 : C.shadeOn) : (j > 7 ? C.shadeOff2 : C.shadeOff)); }
    for (let i = -4; i <= 4; i++) set(b, 14 + i, 26, on ? C.brassL : C.brassD);
    if (on) { // glow under the shade + warm halo
      for (let i = -8; i <= 8; i++) set(b, 14 + i, 37, C.shadeOn2, 120);
      for (let j = 0; j < 16; j++) for (let i = -12; i <= 12; i++) { const a = Math.max(0, 1 - Math.hypot(i, j * 1.6) / 14) * 70; if (a > 2) set(b, 14 + i, 38 + j, C.shadeOn2, a * (.9 + .1 * Math.sin(t * 3))); }
    }
  }
  function drawFood(b) {
    const n = st().food || 0; if (!n) return;
    const rx = Math.min(6.5, 2.5 + n), h = Math.min(3, 1 + n * .5);
    for (let y = 0; y < 4; y++) for (let x = -7; x <= 7; x++) {
      const top = 107 - h * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
      const yy = 107 - y; if (Math.abs(x) <= rx && yy >= Math.round(top)) set(b, 96 + x, yy, ((x * 3 + yy) & 3) ? C.food : C.foodL);
    }
    if (n >= 3) { set(b, 94, 104, C.fish); set(b, 95, 104, C.fish); set(b, 96, 104, C.fish); set(b, 97, 103, C.fish); set(b, 97, 105, C.fish); set(b, 93, 104, C.bk6); }
  }
  /* The full-body Moon, drawn from shapes each frame (30×33 box, bottom-centre at the spot).
     Face follows the home-screen MoonCat: almond eyes with a crescent pupil and a glint, gold crescent on the forehead,
     whiskers, no nose, no mouth. */
  const CW = 30, CH = 33;
  function inTri(x, y, a, b2, c) {
    const s = (p1, p2) => (x - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (y - p2[1]);
    const d1 = s(a, b2), d2 = s(b2, c), d3 = s(c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }
  function catSit(o) { // returns a CW×CH grid of colour keys. o.loaf = lying down (sleep)
    const g = Array.from({length: CH}, () => new Array(CW).fill(null));
    const loaf = !!o.loaf, hd = (o.headDy || 0) + (loaf ? 12 : 0), hx = o.headDx || 0, earL = o.earTwitch ? 1 : 0, br = o.breath ? .6 : 0;
    const back = o.earsBack, bv = !!o.backView;
    const body = loaf
      ? (x, y) => ((x - 15) / 13.6) ** 2 + ((y - 27.6 + br) / (5.4 + br)) ** 2 <= 1 && y <= 32
      : (x, y) => (((x - 15) / 9.8) ** 2 + ((y - 25.2) / 7.4) ** 2 <= 1 && y <= 31.5) || (((x - 15) / 6.4) ** 2 + ((y - 19.5) / 4.6) ** 2 <= 1);
    const earsL = back ? [[4.6, 8], [1, 4.6], [11.4, 4.8]] : [[4.6, 8], [3.6 - earL, -1.2 + earL], [12, 3.6]];
    const earsR = back ? [[25.4, 8], [29, 4.6], [18.6, 4.8]] : [[25.4, 8], [26.4, -1.2], [18, 3.6]];
    const head = (x, y) => { y -= hd; x -= hx; return ((x - 15) / 11.6) ** 2 + ((y - 10.5) / 7.6) ** 2 <= 1 || ((Math.abs(x - 15) - 7.6) / 4.4) ** 2 + ((y - 13.4) / 3.2) ** 2 <= 1
      || inTri(x, y, ...earsL) || inTri(x, y, ...earsR); };
    const innerEar = (x, y) => { y -= hd; x -= hx; if (back || bv) return false; return inTri(x, y, [6.2, 6.2], [5 - earL, 1 + earL], [10, 4]) || inTri(x, y, [23.8, 6.2], [25, 1], [20, 4]); };
    const pawAt = (cx, cy) => (x, y) => ((x - cx) / 2.6) ** 2 + ((y - cy) / 1.9) ** 2 <= 1;
    const pawsDown = loaf ? [pawAt(9.5, 31.4), pawAt(20.5, 31.4)] : [pawAt(10.6, 31), pawAt(19.4, 31)];
    const raised = [];
    if (o.paw === 'wave') { pawsDown[0] = () => false; raised.push(pawAt(9.6, 21.5)); }
    if (o.paw === 'groom') { pawsDown[0] = () => false; raised.push(pawAt(11 + hx, 15.6 + hd)); }
    if (o.paw === 'both') { pawsDown[0] = pawsDown[1] = () => false; raised.push(pawAt(10, 21), pawAt(20, 21)); }
    // tail: sitting = rises at the back-right, curls out and rests in front of the right paw; loaf = lies along the front
    const tail = [], puff = o.puff ? .9 : 0;
    for (let k = 0; k <= (bv ? -1 : 26); k++) {
      const u = k / 26, fast = o.swish || o.puff, sw = Math.sin(o.t * (fast ? 7 : 1.8)) * (fast ? 1.8 : .7) * u * u;
      if (loaf) tail.push([26 - 20 * u, 31.2 - 1.4 * Math.sin(u * Math.PI) + sw * .4, 1.5 - .3 * u]);
      else if (o.puff) tail.push([24 + 3 * Math.sin(u * 1.4) + sw, 27 - 18 * u, 1.8 + puff - .3 * u]); // straight up, bristling
      else tail.push([23 + 5 * Math.sin(u * 2.9) + sw * (1 - u), 29 - 9 * Math.sin(u * 2.2) + 4 * u, 1.75 - .45 * u]);
    }
    const inTail = (x, y) => tail.some(([tx, ty, r]) => (x - tx) ** 2 + (y - ty) ** 2 <= r * r);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const X = x + .5, Y = y + .5;
      if (body(X, Y) || head(X, Y) || pawsDown.some(f => f(X, Y)) || inTail(X, Y)) g[y][x] = 'cat';
      if (innerEar(X, Y)) g[y][x] = 'inner';
    }
    // soft form shading
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (g[y][x] === 'cat') {
      const X = x + .5 - hx, Y = y + .5 - hd;
      if (((X - 11.5) / 7) ** 2 + ((Y - 8.5) / 4.2) ** 2 <= 1 || (!loaf && ((x + .5 - 12) / 5) ** 2 + ((y + .5 - 25) / 4.5) ** 2 <= 1)) g[y][x] = 'catHi';
    }
    const rimPass = () => {
      const solid = (x, y) => y >= 0 && y < CH && x >= 0 && x < CW && g[y][x];
      const rim = [];
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if ((g[y][x] === 'cat' || g[y][x] === 'catHi') && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1)))
        rim.push([x, y, !solid(x, y - 1) && y < 14 + hd ? 'catRL' : 'catR']);
      rim.forEach(([x, y, c]) => g[y][x] = c);
    };
    rimPass();
    for (let k = 1; k < tail.length; k++) { const [tx, ty, r] = tail[k]; const x = Math.round(tx), y = Math.round(ty - r - .2);
      if (y >= 0 && y < CH && x >= 0 && x < CW && (g[y][x] === 'cat' || g[y][x] === 'catHi') && !inTail(x + .5, y + .5)) g[y][x] = 'catR'; }
    if (o.puff) tail.forEach(([tx, ty, r], k) => { if (k % 3 === 0) for (const side of [-1, 1]) { const x = Math.round(tx + side * (r + .8)), y = Math.round(ty); if (g[y] && x >= 0 && x < CW && !g[y][x]) g[y][x] = 'catR'; } });
    if (!loaf) for (let x = 9; x <= 21; x++) { if (g[18][x] === 'cat' || g[18][x] === 'catHi') g[18][x] = 'collar'; }
    if (bv) { // back view: a soft spine highlight instead of a face
      for (let y = 20; y <= 29; y++) if (g[y][15] === 'cat' || g[y][15] === 'catHi') g[y][15] = 'catHi';
      return g;
    }
    if (!loaf) [[15, 19, 'gold'], [14, 20, 'gold'], [15, 20, o.charm ? 'star' : 'glint'], [16, 20, 'gold'], [15, 21, 'gold']].forEach(([x, y, c]) => g[y][x] = c);
    for (const px of loaf ? [9, 10, 20, 21] : [10, 19]) { const y = loaf ? 32 : 31; if (g[y] && g[y][px] === 'cat') g[y][px] = 'catR'; }
    // raised paws go on top with their own outline
    if (raised.length) for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const X = x + .5, Y = y + .5, inP = raised.some(f => f(X, Y));
      if (inP) { const edge = !raised.some(f => f(X - 1, Y)) || !raised.some(f => f(X + 1, Y)) || !raised.some(f => f(X, Y - 1)) || !raised.some(f => f(X, Y + 1)); g[y][x] = edge ? 'catRL' : 'cat'; }
    }
    // face
    [[15, 4], [14, 5], [14, 6], [15, 7]].forEach(([x, y]) => { if (g[y + hd]) g[y + hd][x + hx] = 'gold'; });
    if (g[4 + hd]) g[4 + hd][16 + hx] = 'gold2';
    eyes(g, o, hd, hx);
    // whiskers (outside the face only; they droop when Moon is cross)
    for (const side of [-1, 1]) for (const [y0, dy] of [[13, o.eyes === 'angry' ? .1 : -.3], [14.5, .3]]) {
      let out = 0;
      for (let k = 0; k < 9; k++) { const x = Math.round(15 + hx + side * (9 + k)), y = Math.round(y0 + hd + dy * k); if (x < 0 || x >= CW || y < 0 || y >= CH) continue;
        if (!g[y][x]) { if (++out <= 2) g[y][x] = 'catR'; } }
    }
    return g;
  }
  function eyes(g, o, hd, hx) {
    for (const [cx0, side] of [[9.6, -1], [20.4, 1]]) {
      const cx = cx0 + hx, cy = 10.6 + hd, c0 = Math.round(cx - .5);
      const shape = (x, y) => ((x - cx) / 2.9) ** 2 + ((y - cy) / 2.2) ** 2 <= 1 && !(y < cy - .8 && (x - cx) * side > 1.2);
      if (o.eyes === 'closed' || o.eyes === 'happy') {
        const ys = o.eyes === 'happy' ? [[-2, 1], [-1, 0], [0, -1], [1, 0], [2, 1]] : [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]];
        ys.forEach(([dx, dy]) => { const y = Math.round(cy + dy); if (g[y]) g[y][c0 + dx] = o.eyes === 'happy' ? 'eyeL' : 'eyeD'; });
        if (o.blush) { const y = Math.round(cy + 2.4); if (g[y] && (g[y][c0 - side] === 'cat' || g[y][c0 - side] === 'catHi')) { g[y][c0 - side] = 'blush'; g[y][c0] = 'blush'; } }
        continue;
      }
      const cells = [];
      for (let y = Math.floor(cy - 3); y <= Math.ceil(cy + 3); y++) for (let x = c0 - 4; x <= c0 + 4; x++) {
        if (!shape(x + .5, y + .5)) continue;
        if (o.eyes === 'half' && y + .5 < cy - .2) continue;
        if (o.eyes === 'angry' && y + .5 < cy - .3 + (x + .5 - cx) * -side * .6) continue; // lids slope down toward the nose
        cells.push([x, y]); g[y][x] = y + .5 < cy - .6 ? 'eyeL' : y + .5 > cy + 1.1 ? 'eyeD' : 'eye';
      }
      const has = (x, y) => cells.some(([a, b2]) => a === x && b2 === y);
      const px = c0 + (o.lx || 0), py = (o.ly || 0);
      for (let dy = -2; dy <= 1; dy++) if (has(px, Math.round(cy) + dy + py)) g[Math.round(cy) + dy + py][px] = 'pupil';
      if (o.eyes !== 'angry') for (let dy = -1; dy <= 0; dy++) if (has(px - side, Math.round(cy) + dy + py)) g[Math.round(cy) + dy + py][px - side] = 'pupil';
      if (o.wide) for (let dy = -2; dy <= 1; dy++) for (const dx of [-1, 1]) if (has(px + dx, Math.round(cy) + dy)) g[Math.round(cy) + dy][px + dx] = 'pupil';
      if ((o.eyes === 'open') && has(c0 + side, Math.round(cy) - 2)) g[Math.round(cy) - 2][c0 + side] = 'glint';
      if (o.glow) cells.forEach(([x, y]) => { for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const X = x + dx, Y = y + dy; if (g[Y] && (g[Y][X] === 'cat' || g[Y][X] === 'catHi')) g[Y][X] = 'eyeGlow'; } });
    }
  }
  function blit(b, g, ox, oy, dim, alpha = 255) {
    for (let y = 0; y < g.length; y++) for (let x = 0; x < g[y].length; x++) {
      const k = g[y][x]; if (!k) continue;
      let c = k === 'eyeGlow' ? C.eye : C[k]; if (!c) continue;
      if (dim < 1 && (k === 'catR' || k === 'catRL')) c = c.map(v => v * dim);
      set(b, ox + x, oy + y, c, k === 'eyeGlow' ? 60 : alpha);
    }
  }
  function drawHangTail(b, sx, sy, t, dim) {
    // the tail slides out from behind Moon, bends over the front edge of the sill and hangs down;
    // the hanging part sways like a pendulum and the tip curls, more at the end than at the root
    const ss = (e0, e1, x) => { const k = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return k * k * (3 - 2 * k); };
    const swing = Math.sin(t * 1.9) * .32 + Math.sin(t * .63) * .12, curl = .55 + .35 * Math.sin(t * .9 + 1);
    const pts = []; let x = sx, y = sy;
    for (let k = 0; k <= 28; k++) {
      const u = k / 28;
      const ang = Math.PI / 2 * ss(0, .32, u) + swing * ss(.25, 1, u) * u - curl * 2.3 * ss(.7, 1, u);
      pts.push([x, y, 2.25 - .85 * u]);
      x += Math.cos(ang) * .46; y += Math.sin(ang) * .46;
    }
    const inT = (px, py) => pts.some(([qx, qy, r]) => (px - qx) ** 2 + (py - qy) ** 2 <= r * r);
    const rim = dim < 1 ? C.catR.map(v => v * dim) : C.catR, rimL = dim < 1 ? C.catRL.map(v => v * dim) : C.catRL;
    for (let py = Math.floor(sy) - 3; py <= sy + 16; py++) for (let px = Math.floor(sx) - 6; px <= sx + 10; px++) {
      if (!inT(px + .5, py + .5)) continue;
      const L = !inT(px - .5, py + .5), Rr = !inT(px + 1.5, py + .5), U = !inT(px + .5, py - .5), D = !inT(px + .5, py + 1.5);
      set(b, px, py, (U && py < sy + 2) || L ? rimL : (Rr || D || U) ? rim : C.cat);
    }
  }
  /* the dark plaid blanket pulled up over Moon while he sleeps in the bed: it covers his back and sides up to under the chin (his face stays free), tucks down to the rim and leaves a short tab at the front-right of the rim */
  function drawCatBlanket(b, ox, oy, dim, lift) {
    dim *= .7; // the room's light is dimmer than the plain colours (the baked drape is lit the same way)
    const cx = 25, cy = 111, top0 = oy + 29 - lift; // the edge starts under his chin (y 29), so his face stays free
    const col = (a, c2) => { const band = f => { f = ((Math.floor(f) % 10) + 10) % 10; return f < 3 ? 2 : f === 4 ? 3 : f === 6 ? 1 : 0; }, A = band(a), B = band(c2);
      return A === 3 || B === 3 ? (A === 3 && B === 3 ? C.plL : C.plLd) : A === 2 && B === 2 ? C.plRd : A === 2 || B === 2 ? C.plR : A === 1 || B === 1 ? C.plBd : C.plB; };
    for (let x = ox + 1; x <= ox + CW - 2; x++) {
      const s0 = Math.sqrt(Math.max(0, 1 - ((x - cx) / 21.5) ** 2)), rimTop = Math.round(cy + 4.6 * s0) - 1;
      const side = Math.abs(x - (ox + CW / 2)) / (CW / 2), t0 = Math.round(top0 - 3.5 * Math.max(0, Math.min(1, (side - .72) / .28)) + Math.sin(x * .7) * .6); // only his back is covered: the cloth stays below the face and rises over the shoulders at both sides
      for (let y = t0; y <= rimTop; y++) {
        const row = y - t0, knit = (x + row) & 1;
        let c = col(row, x - ox), k = (dim < 1 ? dim : 1) * (1 - Math.min(.22, row * .02)) * (knit ? .94 : 1);
        if (row === 0) { c = C.plL; k = dim; } else if (row === 1) { c = C.plLd; k = dim * .95; }
        else if (y === rimTop) c = C.plBd;
        set(b, x, y, c.map(v => Math.min(255, Math.round(v * k))));
      }
    }
    for (let x = 30; x <= 43; x++) { // the short tab left hanging at the front-right of the rim
      const s0 = Math.sqrt(Math.max(0, 1 - ((x - cx) / 21.5) ** 2)), top = Math.round(cy + 4.6 * s0) - 1, hem = top + 3 + ((x & 3) === 1 ? 1 : 0);
      for (let y = top; y <= hem; y++) { const row = y - top, c = y === hem || x === 30 ? C.plBd : col(row, x - 30); set(b, x, y, c.map(v => Math.round(v * (dim < 1 ? dim : 1) * ((x + row) & 1 ? .95 : 1)))); }
      set(b, x, hem + 1, (x & 1 ? C.plLd : C.plL).map(v => Math.round(v * (dim < 1 ? dim : 1))));
    }
  }
  function drawCat(b, t) {
    const p = SPOT[R.spot], n = now(), dim = R.lampOn ? 1 : .8;
    if (R.pose === 'sleep') {
      const g = catSit({t, loaf: true, eyes: 'closed', breath: Math.sin(t * 1.6) > 0});
      const ox = Math.round(p.x - CW / 2), oy = Math.round(p.y - CH); blit(b, g, ox, oy, dim);
      if (R.covered && !R.tp && !R.away) drawCatBlanket(b, ox, oy, dim, Math.sin(t * 1.6) > 0 ? 1 : 0); return;
    }
    const hop = n - (R.hopAt || 0) < 450 ? Math.round(5 * Math.sin((n - R.hopAt) / 450 * Math.PI)) : 0;
    const ox = Math.round(p.x - CW / 2), oy = Math.round(p.y - CH) - hop;
    const eating = R.pose === 'eat', reading = R.pose === 'read', angry = n < R.angryUntil, sulk = n < R.sulkUntil;
    const act = n < R.actUntil ? R.act : null;
    const blink = (t % 4.3) < .15, hungry = fullness() <= 0 && !eating;
    let lx = 0, ly = 0;
    if (n < R.lookUntil) [lx, ly] = R.look;
    else if (reading) { lx = Math.round(Math.sin(t * 1.4)); ly = 1; }
    else if (act === 'gaze') { lx = 1; ly = -1; }
    else if (act === 'around') { lx = Math.sin((n - R.actUntil) / 600) > 0 ? -1 : 1; }
    else if (n < R.playUntil) { lx = 1; ly = 1; }
    let eyesK = 'open';
    if (angry) eyesK = 'angry';
    else if (n < R.happyUntil || act === 'groom' || act === 'listen') eyesK = act === 'groom' ? 'closed' : 'happy';
    else if (eating || blink) eyesK = 'closed';
    else if (sulk || n < R.squintUntil || n < R.earsUntil || n < R.flickUntil || hungry) eyesK = 'half';
    const paw = act === 'groom' ? (Math.sin(t * 9) > -.3 ? 'groom' : null) : n < R.pawUntil ? R.paw : n < R.playUntil ? (Math.sin(t * 8) > 0 ? 'wave' : null) : null;
    const backView = R.spot === 'window' && !eating && !reading && n >= R.turnUntil && !angry;
    if (backView) {
      const hx = Math.max(-1, Math.min(1, Math.round(Math.sin(t * .45) * 1.3)));
      const gb = catSit({t, backView: true, headDx: hx, earTwitch: (t % (R.rain ? 3.1 : 6.3)) < .18, breath: Math.sin(t * 1.4) > 0, earsBack: n < R.earsUntil});
      blit(b, gb, ox, oy, dim); drawHangTail(b, ox + 21, oy + CH - 3, t, dim); return;
    }
    const g = catSit({t, swish: n < R.happyUntil || n < R.flickUntil || n < R.playUntil || act === 'tail', puff: angry, earsBack: angry || sulk || n < R.earsUntil,
      headDy: eating ? (Math.sin(t * 10) > 0 ? 3 : 2) : 0, headDx: n < R.tiltUntil ? 1 : act === 'listen' ? (Math.sin(t * 2.2) > 0 ? 1 : 0) : 0, eyes: eyesK, lx, ly, wide: n < R.wideUntil,
      glow: !R.lampOn && eyesK === 'open', blush: eyesK === 'happy', earTwitch: (t % 7) < .2, paw, charm: n < (R.charmUntil || 0)});
    blit(b, g, ox, oy, dim);
    if (angry) { // the little anger mark
      const ax = ox + 25, ay = oy + 1, a = 200 + 55 * Math.sin(t * 12);
      [[0, 1], [1, 0], [3, 0], [4, 1], [0, 3], [1, 4], [3, 4], [4, 3]].forEach(([i, j]) => set(b, ax + i, ay + j, C.bk3, a));
    }
    if (reading) { // a little open book held up in the paws
      const bx = ox + 8, by = oy + 16;
      for (let i = 0; i < 14; i++) for (let j = 0; j < 7; j++) set(b, bx + i, by + j, j === 6 ? C.coverD : (i === 0 || i === 13) ? C.cover : (i === 6 || i === 7) ? C.page2 : C.page);
      for (let i = 2; i < 12; i++) if (i !== 6 && i !== 7 && (i + (t * 2 | 0)) % 3) set(b, bx + i, by + 2 + (i % 2) * 2, C.bk6);
      for (const [x, y] of [[bx - 1, by + 3], [bx - 1, by + 4], [bx + 14, by + 3], [bx + 14, by + 4]]) set(b, x, y, C.cat);
      set(b, bx - 2, by + 3, C.catR); set(b, bx + 15, by + 3, C.catR);
    }
  }
  function drawGramophone(b, t) {
    const on = !!(R.api.music && R.api.music()), cx = 31.5, cy = 69;
    // spin speed eases in and out like a real platter
    R.spin = (R.spin || 0) + ((on ? 1 : 0) - (R.spin || 0)) * .06; R.ang = (R.ang || 0) + R.spin * .55;
    ell(b, cx, cy, 6.6, 1.9, C.pupil); ell(b, cx, cy, 5.6, 1.5, C.cat);
    for (let a = 0; a < 40; a++) { const q = a / 40 * Math.PI * 2; set(b, cx + Math.cos(q) * 4.2, cy + Math.sin(q) * 1.1, C.catR, 120); } // grooves
    const A = R.ang;
    for (const [d, al] of [[0, 230], [.25, 140], [.5, 70]]) { const q = A - d; set(b, cx + Math.cos(q) * 5, cy + Math.sin(q) * 1.35, C.catRL, al); set(b, cx + Math.cos(q + Math.PI) * 3.4, cy + Math.sin(q + Math.PI) * .9, C.catR, al * .7); }
    ell(b, cx, cy, 1.9, .9, C.cover); set(b, cx + Math.cos(A) * 1.2, cy + Math.sin(A) * .5, C.coverD); set(b, cx, cy - .5, C.gold);
    // tone arm: rests aside when quiet, sits on the record while playing
    const piv = [37, 67]; set(b, 37, 67, C.brassL); set(b, 37, 68, C.brassD);
    const arm = on ? [[36, 67], [35, 67], [34, 68], [33, 68]] : [[37, 66], [37, 65], [36, 64], [36, 63]];
    arm.forEach(([x, y], i) => set(b, x, y, i === arm.length - 1 ? C.page2 : C.brass));
    // soft notes drifting out of the horn
    if (on && DECO.horn && (!R.noteAt || now() - R.noteAt > 1700)) {
      R.noteAt = now(); const [hx, hy] = DECO.horn;
      R.parts.push({x: hx - 1 + (Math.random() - .5) * 4, y: hy - 3, vx: -1.5 - Math.random() * 2, vy: -4 - Math.random() * 2, life: 3.2, t: 0, c: Math.random() < .5 ? 'page2' : 'starG', kind: 'note', w: Math.random() * 6});
    }
  }
  function drawLive(b, t) { // small live things in the room: candle flame, yarn while playing
    const s = st();
    drawGramophone(b, t);
    if (s.candle && DECO.flame) {
      const [fx, fy] = DECO.flame, f = Math.sin(t * 13) > 0;
      set(b, fx, fy, C.shadeOn2); set(b, fx, fy - 1, f ? C.shadeOn : C.brassL); if (f) set(b, fx + (Math.sin(t * 7) > 0 ? 1 : -1), fy - 2, C.shadeOn, 160);
      for (let j = -5; j <= 4; j++) for (let i = -5; i <= 5; i++) { const a = Math.max(0, 1 - Math.hypot(i, j) / 6) * 55; if (a > 3) set(b, fx + i, fy + j, C.shadeOn2, a); }
    }
    if (s.candle && DECO.sflame) { // the little candle on the bookshelf burns too
      const [fx, fy] = DECO.sflame, f = Math.sin(t * 13 + 1) > 0;
      set(b, fx, fy + 1, C.shadeOn2); set(b, fx, fy, f ? C.shadeOn : C.brassL); if (f) set(b, fx + (Math.sin(t * 7) > 0 ? 1 : -1), fy - 1, C.shadeOn, 150);
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const a = Math.max(0, 1 - Math.hypot(i, j) / 5) * 45; if (a > 3) set(b, fx + i, fy + j, C.shadeOn2, a); }
    }
    if (DECO.yarn) {
      const fy = DECO.fy, play = now() < R.playUntil, dx = play ? Math.round(2 * Math.sin(t * 8)) : 0, r = play && Math.sin(t * 8) > 0;
      ell(b, 78 + dx, fy - 2, 3.6, 3.6, C.bk3);
      [[76, -4, 'cover'], [79, -1, 'coverD'], [77, -2, 'coverD'], [80, -3, 'cover']].forEach(([x, y, c]) => set(b, (r ? 156 - x : x) + dx, fy + y, C[c]));
      for (let i = 0; i < 6; i++) set(b, 82 + dx + i, fy + ((i + (play ? (t * 6 | 0) : 0)) % 2), C.bk3);
    }
  }
  /* ---------------- gentle things that move: curtains, plants, clock, steam ---------------- */
  function drawCurtains(b, t) { // the hems drift by less than a pixel (edges are dithered, so it reads as sub-pixel motion); a touch more when Moon sits at the window
    const br = breeze(t), top = WIN.y - 3, hh = WIN.h + 9;
    for (const side of [-1, 1]) {
      const ox = side < 0 ? WIN.x - 8 : WIN.x + WIN.w + 8;
      for (let y = top; y < WIN.y + WIN.h + 6; y++) {
        const u = (y - top) / hh, amp = Math.pow(u, 1.5);
        let wd = 7 + 2 * Math.sin(u * Math.PI) + (u > .55 ? -(u - .55) * 8 : 0);
        wd += amp * br * (.5 * Math.sin(t * .75 + y * .06 + side * 1.4) + .35 * Math.sin(t * 1.3 + y * .11 - side));
        wd = Math.max(3, wd);
        const full = Math.floor(wd), fr = wd - full, shift = Math.round(1.1 * Math.sin(t * .4 + y * .08 + side * 2) * (.3 + u));
        for (let i = 0; i <= full; i++) {
          const x = ox - side * i;
          if (i === full && !(fr > bay(x, y))) break;
          const fold = ((i + (y >> 2) + shift) % 4 + 4) % 4;
          setLit(b, x, y, fold === 0 ? C.curtD : fold === 2 ? C.curtL : C.curt);
        }
      }
      const ty = WIN.y + 22, tx = side < 0 ? WIN.x - 7 : WIN.x + WIN.w + 2; // tie-back with a little tassel
      for (let i = 0; i < 6; i++) setLit(b, tx + i, ty, C.brass);
      const kx = side < 0 ? tx + 5 : tx; setLit(b, kx, ty + 1, C.brassL); setLit(b, kx, ty + 2, C.brass);
    }
  }
  function drawBeamShadow(b, t) { // while the lamp is off: the curtains and window bars cast soft, slowly swaying shadows into the moonbeam
    const a = 1 - R.mix; if (a < .02) return; const br = breeze(t);
    for (let y = 74; y < 122; y++) {
      const u = (y - 72) / 50, l = 50 + u * 16, r = 74 + u * 20, sw = br * .7 * Math.sin(t * .75 + y * .06);
      const wl = 3 + u * 2 + sw, wr = 3 + u * 2 - sw * .8;
      for (let x = Math.floor(l); x < l + wl + 1; x++) if (Math.max(0, Math.min(1, l + wl - x)) > bay(x, y)) set(b, x, y, C.gap, 95 * a);
      for (let x = Math.floor(r - wr); x <= r; x++) if (Math.max(0, Math.min(1, x + 1 - (r - wr))) > bay(x, y)) set(b, x, y, C.gap, 95 * a);
      set(b, Math.round((l + r) / 2 + 1 + sw * .4), y, C.gap, 70 * a * (1 - u * .4)); // the window's centre bar
      if (y === 92 || y === 93) for (let x = Math.ceil(l + wl); x < r - wr; x++) set(b, x, y, C.gap, 55 * a); // the crossbar
    }
  }
  function vineL(b, x0, y0, len, ph, dir, t, br) { // a trailing vine: stem + leaf pairs, swaying more toward the tip
    let x = x0;
    for (let k = 0; k <= len; k++) {
      x = x0 + dir * 1.1 * Math.sin(k * .3 + ph) + br * 1.1 * Math.pow(k / len, 1.2) * Math.sin(t * .8 + ph + k * .08);
      setLit(b, Math.round(x), y0 + k, C.leafD);
      if (k >= 2 && (k - 2) % 3 === 0) { const sd = (((k - 2) / 3) & 1) ? 1 : -1; ellL(b, x + sd * 1.9, y0 + k, 1.7, 1.1, ((k >> 1) & 1) ? C.leafL : C.leaf); }
    }
    ellL(b, x, y0 + len + 1, 1.3, 1.5, C.leaf); return x;
  }
  function drawHang(b, t) {
    const H0 = DECO.hang; if (!H0) return; const {hx, bot} = H0, br = breeze(t);
    // bushy top: leaves rising over the rim, each with its own little sway
    [[-6, -2.4, 0], [-4.5, -4, 1], [-2.5, -5.5, 0], [0, -6.5, 1], [2.5, -5.5, 0], [4.5, -4, 1], [6, -2.4, 0], [-1, -3.4, 1], [1.5, -3.6, 0]].forEach(([dx, dy, l], i) => {
      const s2 = Math.sin(t * .9 + i * 1.7) * .55 * br * Math.min(1, -dy / 5);
      ellL(b, hx + dx + s2, bot - 5 + dy + Math.sin(t * .7 + i) * .12, 2.2, 1.4, l ? C.leafL : C.leaf);
    });
    // trailing vines: three sides of the pot, different lengths
    vineL(b, hx - 6, bot - 4, 15, .2, -1, t, br); vineL(b, hx - 5, bot - 3, 9, 1.9, -1, t, br); vineL(b, hx + 6, bot - 4, 18, 3.3, 1, t, br);
    vineL(b, hx + 5, bot - 3, 11, 4.6, 1, t, br); vineL(b, hx - 2, bot + 1, 12, 2.5, -1, t, br);
    const fx = vineL(b, hx + 2, bot + 1, 17, 5.2, 1, t, br);
    // two tiny flowers: one among the leaves, one at the end of the longest vine
    const fl = (x, y) => { setLit(b, x, y, C.gold); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([i, j]) => setLit(b, x + i, y + j, C.pink)); };
    fl(Math.round(hx - 1 + Math.sin(t * .9) * .4), bot - 11); fl(Math.round(fx), bot + 20);
  }
  function drawShelfPlant(b, t) {
    const P = DECO.sp; if (!P) return; const br = breeze(t), sx = P.x, sy = P.y;
    [[18, -16], [16, -13], [21, -14], [14.5, -10.5], [23, -10.5], [19, -12], [17, -10], [20, -10.5], [15.5, -15], [22, -16], [17.5, -8.8], [20.5, -8.8]].forEach(([dx, dy, ], i) => {
      const s2 = Math.sin(t * .9 + i * 1.3) * .6 * br * Math.max(0, Math.min(1, (-dy - 6) / 9)), tw = Math.sin(t * .7 + i * 2.1) * .15;
      ellL(b, sx + dx + s2, sy + dy + tw, 2.1, 1.4, i % 3 ? C.leaf : C.leafL);
    });
        vineL(b, sx + 14, sy - 6, 7, .4, -1, t, br); vineL(b, sx + 22.5, sy - 5, 6, 2.2, 1, t, br);
  }
  function drawClock(b, t) { // the real time: hour and minute hand, and a tiny second marker that ticks
    const K = DECO.clock; if (!K) return; const cx = (K[0] + K[2]) / 2, cy = (K[1] + K[3]) / 2, d = new Date(now());
    const mi = d.getMinutes() + d.getSeconds() / 60, hr = (d.getHours() % 12) + mi / 60, TAU = Math.PI * 2;
    const hand = (ang, len, c) => { for (let r = 0; r <= len; r += .5) setLit(b, Math.round(cx + Math.sin(ang) * r), Math.round(cy - Math.cos(ang) * r), c); };
    hand(hr / 12 * TAU, 2.4, C.trimD); hand(mi / 60 * TAU, 3.8, C.trimD); setLit(b, cx, cy, C.trimD);
    const sa = d.getSeconds() / 60 * TAU; setLit(b, Math.round(cx + Math.sin(sa) * 4.3), Math.round(cy - Math.cos(sa) * 4.3), C.pinkD);
  }
  function drawSteam(b, t) { // a thin wisp rising from the mug on the cabinet
    const S0 = DECO.steam; if (!S0) return;
    for (let k = 0; k < 3; k++) { const u = (t * .2 + k / 3) % 1; setLit(b, S0[0] + 1.2 + Math.sin(t * 1.1 + k * 2 + u * 5) * 1.1, S0[1] - u * 9, C.page, 130 * Math.sin(u * Math.PI)); }
  }
  function frame() {
    if (!R.cv || !R.cv.isConnected) { R.raf = 0; return; }
    R.raf = requestAnimationFrame(frame);
    if (R.cv.offsetParent === null) return; // page hidden
    const n = now(), t = n / 1000, fi = Math.floor(t * FPS);
    if (fi === R.lastF) return; R.lastF = fi;
    // the cat's own life
    const idle = n - R.lastTouch, s = st();
    if (!R.tp && !R.away) {
      if (fullness() <= 0 && (s.food || 0) > 0 && R.pose !== 'eat') { if (R.pose === 'sleep') { R.pose = 'sit'; } eat(true); }
      else if (R.pose !== 'sleep' && R.pose !== 'eat' && R.pose !== 'read' && idle > (R.lampOn ? 60000 : 30000)) goSleep();
      if (fullness() <= 0 && !(s.food) && R.pose === 'sit' && n - R.idleSayAt > 30000) { R.idleSayAt = n; say('room_hungry'); }
      // little habits while left alone on the carpet
      if (R.spot === 'window' && R.pose === 'sit') {
        if (n > R.windowUntil && n > R.turnUntil) leaveWindow();
        else if (n > R.watchSayAt) { R.watchSayAt = n + 9000 + Math.random() * 8000; if (Math.random() < .4) say(R.rain ? 'room_window_rain' : 'room_window_watch'); }
      }
      if (R.pose === 'sit' && R.spot === 'rug' && n > R.nextIdle && idle > 8000 && n > R.angryUntil && n > R.sulkUntil && Math.random() < (R.rain ? .4 : .15)) { R.nextIdle = n + 14000 + Math.random() * 12000; goWindow(true); }
      else if (R.pose === 'sit' && R.spot === 'rug' && n > R.nextIdle && idle > 8000 && n > R.angryUntil && n > R.sulkUntil) {
        const acts = ['groom', 'gaze', 'around', 'tail', 'groom'].concat(R.api.music && R.api.music() ? ['listen', 'listen'] : []), a = acts[(Math.random() * acts.length) | 0];
        R.act = a; R.actUntil = n + (a === 'groom' ? 3600 : a === 'listen' ? 5200 : a === 'around' ? 2600 : 2200); R.nextIdle = n + 12000 + Math.random() * 14000;
        if (a !== 'tail' && Math.random() < .35) say(R.rain && Math.random() < .5 ? 'room_rain_idle' : 'room_' + a);
      }
    }
    // background, lit
    R.mix += ((R.lampOn ? 1 : 0) - R.mix) * .35; if (Math.abs(R.mix - (R.lampOn ? 1 : 0)) < .02) R.mix = R.lampOn ? 1 : 0;
    if (R.covered && (R.pose !== 'sleep' || R.spot !== 'bed')) R.covered = false; // the blanket stays on him only while he sleeps in the bed
    const cov = !!R.covered && !R.tp && !R.away, gOn = cov ? R.bgOn2 : R.bgOn, gOff = cov ? R.bgOff2 : R.bgOff;
    const b = new Uint8ClampedArray(R.mix >= 1 ? gOn : R.mix <= 0 ? gOff : gOn.map((v, i) => v * R.mix + gOff[i] * (1 - R.mix)));
    drawSky(b, t); drawGarland(b, t); drawLamp(b, t);
    R.wind += (((R.spot === 'window' && !R.tp && !R.away) ? 1 : 0) - R.wind) * .03;
    drawBeamShadow(b, t); drawCurtains(b, t); drawHang(b, t); drawShelfPlant(b, t); drawClock(b, t); drawSteam(b, t);
    if (DECO.hang && Math.random() < 1 / (FPS * 45)) { const {hx, bot} = DECO.hang; R.parts.push({x: hx + (Math.random() - .5) * 10, y: bot + 6 + Math.random() * 8, vx: 0, vy: 5, life: 3.6, t: 0, c: Math.random() < .5 ? 'leaf' : 'leafL', kind: 'spark'}); } // now and then a leaf lets go
    // dust motes floating in the lamp light / moonbeam
    for (let k = 0; k < 7; k++) {
      const u = ((t * .05 + k / 7) % 1), x = R.lampOn ? 8 + k * 4 + Math.sin(t * .7 + k) * 3 : 56 + k * 4 + Math.sin(t * .6 + k) * 3, y = R.lampOn ? 80 - u * 40 : 110 - u * 34;
      set(b, x, y, R.lampOn ? C.shadeOn : C.moon1, 90 * Math.sin(u * Math.PI));
    }
    // cat (+ teleport)
    if (R.away) { /* Moon is up at the bookshelf */ }
    else if (R.tp) {
      const p = (n - R.tp.t0) / 380;
      if (p < 1) { drawStreak(b, SPOT[R.tp.from], 1 - p); }
      else if (p < 2) { if (R.spot !== R.tp.to) { R.spot = R.tp.to; R.pose = R.tp.pose; sparkle(SPOT[R.spot], 12); } drawStreak(b, SPOT[R.spot], p - 1); }
      else { const a = R.tp.after; R.tp = null; drawCat(b, t); a && a(); }
    } else drawCat(b, t);
    drawLive(b, t); drawFood(b); if (R.spot === 'bowl') drawBowlFront(b);
    // particles
    R.parts = R.parts.filter(q => (q.t += 1 / FPS) < q.life);
    for (const q of R.parts) {
      if (q.t < 0) continue;
      q.x += q.vx / FPS; q.y += q.vy / FPS; const a = 255 * (1 - q.t / q.life);
      if (q.kind === 'note') { const a2 = a * .8 * Math.min(1, q.t * 3), xx = q.x + Math.sin(q.t * 2 + q.w) * 1.5; [[0, 2], [1, 2], [0, 3], [1, 3], [2, 0], [2, 1], [2, 2], [3, 0]].forEach(([i, j]) => set(b, xx + i, q.y + j, C[q.c], a2)); continue; }
      if (q.kind === 'heart') { [[0, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [1, 3]].forEach(([i, j]) => set(b, q.x + i, q.y + j, C[q.c], a)); }
      else { if (q.c === 'leaf' || q.c === 'leafL') q.vx = Math.sin(q.t * 5) * 6; set(b, q.x, q.y, C[q.c], a); if (q.t < .3) { set(b, q.x + 1, q.y, C[q.c], a * .5); set(b, q.x - 1, q.y, C[q.c], a * .5); } }
    }
    if (R.pose === 'sleep' && !R.tp && !R.away) { // z z z
      const zs = [[0, 'Z'], [.33, 'z'], [.66, 'z']];
      zs.forEach(([o]) => { const u = (t * .35 + o) % 1, x = SPOT.bed.x + 8 + u * 10, y = SPOT.bed.y - 12 - u * 18; zGlyph(b, x, y, u < .5 ? 3 : 2, C.moon1, 255 * Math.sin(u * Math.PI)); });
    }
    R.ctx.putImageData(new ImageData(b, W, H), 0, 0);
  }
  function drawBowlFront(b) { // the bowl's front covers the cat's chin while eating
    ell(b, 96, 111.5, 8, 3, C.bowlD); rect(b, 88, 108, 17, 3, C.bowl); rect(b, 88, 108, 17, 1, C.bowlL);
    set(b, 99, 109, C.fish); set(b, 100, 109, C.fish); set(b, 101, 109, C.fish); set(b, 102, 108, C.fish); set(b, 102, 110, C.fish);
  }
  function drawStreak(b, p, k) { // k: 1 = full cat, 0 = gone
    const h = 31 * k, cx = p.x;
    for (let y = 0; y < h; y++) { const w = Math.max(1, Math.round(10 * k * (1 - Math.abs(y / Math.max(1, h) - .5)))); for (let x = -w; x <= w; x++) set(b, cx + x, p.y - y, Math.abs(x) === w ? C.starB : C.cat, 255 * Math.min(1, k * 1.5)); }
    for (let y = -30; y < 4; y++) set(b, cx, p.y + y, C.star, 120 * (1 - k));
    for (let a = 0; a < 8; a++) { const r = 4 + (1 - k) * 8, tt = a / 8 * Math.PI * 2; set(b, cx + Math.cos(tt) * r, p.y - 12 + Math.sin(tt) * r * .6, a % 2 ? C.starG : C.starB, 220 * (1 - k * .6)); }
  }
  function zGlyph(b, x, y, s, c, a) {
    for (let i = 0; i < s; i++) { set(b, x + i, y, c, a); set(b, x + i, y + s - 1, c, a); set(b, x + s - 1 - i, y + i, c, a); }
  }

  function build() { // size the room to the space it gets on screen
    const box = R.cv.parentElement, w = box.clientWidth, h = box.clientHeight;
    const nh = w && h ? Math.max(132, Math.min(260, Math.round(W * h / w))) : 132;
    if (R.bgOn && nh === H) return;
    H = nh; const extra = H - 132, fx = Math.min(26, Math.round(extra * .26)); OY = extra - fx;
    const grow = Math.round(OY * .55); WIN.y = 9 - grow; WIN.h = 36 + grow; WIN.bar = Math.round(WIN.h * .47); GY = 4 - OY + Math.round(OY * .1);
    SPOT.window = {x: WIN.x + 11, y: WIN.y + WIN.h + 2};
    R.cv.width = W; R.cv.height = H;
    const base = buf(); drawRoom(base);
    R.bgOn = light(base, true); R.bgOff = light(base, false); bakeL();
    NOD = true; const base2 = buf(); drawRoom(base2); NOD = false; R.bgOn2 = light(base2, true); R.bgOff2 = light(base2, false);
  }
  addEventListener('resize', () => { if (R.cv) build(); });
  /* ---------------- rain: a 10% chance each time the app is opened, gone when you leave ---------------- */
  const RA = {ctx: null, gain: null, src: null};
  function rainSound() {
    const want = R.rain && R.active && !document.hidden;
    try {
      if (want && !RA.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        const ctx = RA.ctx = new AC(), len = ctx.sampleRate * 4, buf2 = ctx.createBuffer(1, len, ctx.sampleRate), d = buf2.getChannelData(0);
        let last = 0; for (let i = 0; i < len; i++) { const w2 = Math.random() * 2 - 1; last = (last + .04 * w2) / 1.04; d[i] = last * 3.2 + w2 * .05; } // soft brown-ish noise
        const src = RA.src = ctx.createBufferSource(); src.buffer = buf2; src.loop = true;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
        RA.gain = ctx.createGain(); RA.gain.gain.value = 0;
        src.connect(hp); hp.connect(lp); lp.connect(RA.gain); RA.gain.connect(ctx.destination); src.start();
      }
      if (!RA.ctx) return;
      if (want) RA.ctx.resume();
      RA.gain.gain.setTargetAtTime(want ? .16 : 0, RA.ctx.currentTime, want ? 1.2 : .35);
    } catch (e) {}
  }
  function rollRain() { R.rain = Math.random() < .1; R.rainSaid = false; rainSound(); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { R.rain = false; R.rainMix = 0; rainSound(); } else rollRain(); });
  addEventListener('pointerdown', () => { if (R.rain) rainSound(); }, {passive: true});
  window.Room = {
    attach(cv, api) {
      R.cv = cv; R.api = api; R.ctx = cv.getContext('2d');
      build();
      const s = st(); R.lampOn = s.lamp !== false; R.mix = R.lampOn ? 1 : 0;
      R.lastTouch = s.lastTouch || now();
      cv.addEventListener('click', tap);
      rollRain();
      if (!R.raf) R.raf = requestAnimationFrame(frame);
    },
    enter() { // called when the page opens: if nobody touched the room for a while, Moon is already asleep
      if (!R.cv) return; build(); if (!R.raf) R.raf = requestAnimationFrame(frame);
      if (now() - R.lastTouch > 60000 && !R.tp) { R.spot = 'bed'; R.pose = 'sleep'; }
      R.active = true; rainSound();
      if (R.rain && !R.rainSaid && R.pose !== 'sleep') { R.rainSaid = true; setTimeout(() => say('room_rain_start'), 900); }
    },
    leave() { R.active = false; rainSound(); const s = st(); s.lastTouch = R.lastTouch; R.api.save(); },
    geom: () => ({W, H, OY, shelf: {x: 104.5, y: 54}, bed: {x: 22, y: 106}}),
    asleepInBed: () => R.spot === 'bed' && R.pose === 'sleep' && !R.tp,
    coveredInBed: () => !!R.covered && R.spot === 'bed' && R.pose === 'sleep' && !R.tp,
    hold(on, asleep, from, cov) { // Moon goes to a close-up (bookshelf or bed) (on) and comes back (off); asleep = he returns curled up in the bed
      if (!on && asleep) { R.away = false; R.lastTouch = now(); R.spot = 'bed'; R.pose = 'sleep'; R.covered = !!cov; return; }
      R.covered = false;
      if (!on && from === 'bed') { // he was awake in the bed close-up: he stays on the bed for a moment, then hops over to the rug
        R.away = false; R.lastTouch = now(); R.spot = 'bed'; R.pose = 'sit';
        setTimeout(() => { if (R.spot === 'bed' && R.pose === 'sit' && !R.tp && !R.away) teleport('rug', 'sit'); }, 2400); return;
      }
      if (on) { R.away = true; R.tp = null; if (R.pose === 'sleep') R.pose = 'sit'; R.lastTouch = now(); return; }
      R.away = false; R.lastTouch = now(); R.spot = 'shelf'; R.pose = 'sit'; sparkle(SPOT.shelf, 8);
      setTimeout(() => { if (R.spot === 'shelf' && R.pose === 'sit' && !R.tp && !R.away) teleport('rug', 'sit'); }, 1800);
    },
    mix: () => R.mix, candle: () => !!st().candle,
    feed: feedBowl, fullness, food: () => st().food || 0,
    // for testing / screenshots
    _sprite: o => catSit(o).map(r => r.map(k => k && k !== 'eyeGlow' && C[k] ? Array.from(C[k]) : null)),
    _set(o) { Object.assign(R, o); if ('lampOn' in o) R.mix = o.lampOn ? 1 : 0; }, _R: R
  };
})();
