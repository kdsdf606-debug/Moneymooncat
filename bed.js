/* Moon's bed — a close-up of the plush donut bed, reached from the room by a slow camera push-in toward the bed.
   The scene is its own small pixel canvas (100 wide: a tighter crop than the room, so everything is ~20% bigger on screen). Everything that moves is a function of
   continuous numbers (one settle clock, springs, breathing), so every change of pose is a blend, never a swap of frames.

   Bed.attach({cv, room, box, back, vig, say(text, {x,y}), words(key), lampMix(), candle(), geom(), hold(on), onClose()})
   Bed.open() / Bed.close()
*/
(function () {
  'use strict';
  const W = 100, FPS = 30; // FPS is the default; the loop drops to 20 / 15 on slow phones and eases to 20 while Moon sleeps
  let H = 200;
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const C = {};
  Object.entries({
    wall: '#141a3c', wall2: '#171f46', wallDot: '#1c2550', trim: '#2f4183', trimD: '#1b2752', trimL: '#3e52a0', panel: '#10163a', panelL: '#1a2250',
    floor: '#1d1a3a', floor2: '#221f45', gap: '#120f26', floorL: '#2a2652',
    frame: '#2f4183', frameL: '#4a5db0', sky0: '#070b1e', sky1: '#0c1430', sky2: '#142049', sky3: '#1d2c63', sill: '#3b4c95',
    moon0: '#e6f6ff', moon1: '#c4e6fb', moon2: '#9fd0f0', moonDark: '#1a2550', star: '#ffffff', starB: '#9ad8ff', starG: '#ffe39a',
    curt: '#3a2a5c', curtD: '#291e44', curtL: '#4b3a73', rod: '#a8823a',
    wood: '#2c2344', woodD: '#1c162f', woodL: '#3a2f58', woodH: '#54467d',
    bk1: '#c4e6fb', bk2: '#ffd36a', bk3: '#ff9fb5', bk4: '#8fd9c4', bk5: '#8f8cf0', bk6: '#5d6a9a', bk7: '#a8823a',
    brass: '#a8823a', brassL: '#ffd36a', brassD: '#5a4a2a', shadeOn: '#ffe7a8', shadeOn2: '#ffd36a', shadeOff: '#4a3d2c', shadeOff2: '#3a2f22',
    leaf: '#3f7a5a', leafL: '#5fa37a', leafD: '#2a5240', pot: '#6b3f2a', potL: '#8a5236',
    page: '#e6f0ff', page2: '#c4e6fb', ink: '#0c1430', pink: '#ff9fb5', pinkL: '#ffc4d2', pinkD: '#b05a7a', blush: '#7a3a5c',
    // the bed: a ramp from deep shadow to the soft highlight of the plush
    b0: '#1f1942', b1: '#2c2455', b2: '#3a3169', b3: '#4a3f7a', b4: '#5d51a0', b5: '#7a6dc4', b6: '#a69cf0', b7: '#cfc9ff',
    // the cushion inside
    c0: '#241d4a', c1: '#312960', c2: '#40367a', c3: '#51468f', c4: '#6558a6', c5: '#7b6ebb',
    // the cat
    cat: '#0b0b16', catHi: '#13132c', catHi2: '#1b1b3b', catR: '#34337a', catRL: '#6563c4', catRd: '#1f1e4c', inner: '#1d1d38',
    earIn: '#3a2a5c', earIn2: '#5a3f7a', eye: '#7fd4ff', eyeL: '#d4f3ff', eyeD: '#3b9bd9', pupil: '#0a1030', glint: '#ffffff', gold: '#ffd36a', gold2: '#ffb347',
    collar: '#3b3a78', collarL: '#5a59b0', nose: '#c97aa8', warmRim: '#8a5a8c', anger: '#ff7a8f',
    plB: '#454e82', plBd: '#333b68', plR: '#833f55', plRd: '#612e41', plL: '#b9ac8f', plLd: '#8f846c'
  }).forEach(([k, v]) => (C[k] = hex(v)));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const sstep = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const eio = k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const eio2 = k => { k = clamp(k, 0, 1); return k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }; // softer ease for body motion
  const seg = (v, a, b) => eio2((v - a) / (b - a)); // one slice of a long clock
  const mulc = (c, k) => [Math.min(255, Math.round(c[0] * k)), Math.min(255, Math.round(c[1] * k)), Math.min(255, Math.round(c[2] * k))];
  const mixc = (a, b, k) => [Math.round(lerp(a[0], b[0], k)), Math.round(lerp(a[1], b[1], k)), Math.round(lerp(a[2], b[2], k))];
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const bay = (x, y) => (BAY[y & 3][x & 3] + .5) / 16;
  const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const now = () => Date.now();
  const gust = t => Math.max(0, Math.sin(t * .11 + 1) * Math.sin(t * .29 + .5)); // the same soft breeze as the room and the shelf
  const breeze = t => .55 + .9 * gust(t);
  const RAMP_BED = [C.b0, C.b1, C.b2, C.b3, C.b4, C.b5, C.b6, C.b7], RAMP_CUSH = [C.c0, C.c1, C.c2, C.c3, C.c4, C.c5];
  const ramp = (R, v, x, y) => { const t = clamp(v, 0, .9999) * (R.length - 1), i0 = Math.floor(t), f = t - i0; return R[f < .34 ? i0 : f > .66 ? i0 + 1 : (bay(x, y) < (f - .34) / .32 ? i0 + 1 : i0)]; }; // banded gradient: a narrow ordered-dither zone between two tones

  /* ---------------- raster helpers ---------------- */
  const buf = () => new Uint8ClampedArray(W * H * 4);
  function set(b, x, y, c, a = 255) {
    x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H || !c) return;
    const i = (y * W + x) * 4;
    if (a >= 255) { b[i] = c[0]; b[i + 1] = c[1]; b[i + 2] = c[2]; b[i + 3] = 255; }
    else { const k = a / 255; b[i] = b[i] * (1 - k) + c[0] * k; b[i + 1] = b[i + 1] * (1 - k) + c[1] * k; b[i + 2] = b[i + 2] * (1 - k) + c[2] * k; b[i + 3] = 255; }
  }
  const rect = (b, x, y, w, h, c, a) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(b, x + i, y + j, c, a); };
  const ell = (b, cx, cy, rx, ry, c, a) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1) set(b, x, y, c, a); };

  /* ---------------- layout: everything hangs off the bed, whatever height the screen gives ---------------- */
  const L = {cx: 33, by: 126, ex: 47, ey: 16, th: 11, exi: 28.2, eyi: 9.6, floorY: 115, win: {x: 64, y: 22, w: 34, h: 54}, lamp: {x: 21, top: 44}};
  const S = {
    cv: null, ctx: null, api: null, base: null, fg: null, out0: null, out: null, LFon: null, LFoff: null, LAon: null, LAoff: null,
    state: 'closed', fps: 30, curFps: 30, cost: 0, nF: 0, t0: 0, raf: 0, lastF: -1, parts: [], built: false, stars: [], moon: null, flame: null, lampXY: null
  };
  function layout() {
    L.by = H - 32; // the bed sits at the very front-left: its lower rim runs off the bottom of the screen
    L.floorY = L.by - 70; // where the wall meets the floor, as far behind the bed as in the room
    // the window is as big as it looks in the room (zoomed in), pushed to the far right of the screen; its top is cropped by the screen edge
    const wh = Math.round(clamp(L.floorY * .9, 70, 130)), sillY = Math.round(L.floorY * .74);
    L.win = {x: W - 56, w: 50, h: wh, y: sillY - wh};
    L.deco = {cx: 7, sy: 46}; // the wall shelf with the candle, left of the window (the room's left-hand wall things)
    // the floor lamp stands where it does in the room (measured from the zoomed-out view): left of the bed, behind its rim; its base is in front of the skirting, its shade high up
    L.lamp = {x: Math.round(L.cx - .53 * L.ex), top: L.by - 132, base: L.by - 41};
  }

  /* ---------------- static scene: wall, floor, window, shelf edge, lamp, and the bed itself ---------------- */
  function drawWall(b) {
    const fy = L.floorY;
    for (let y = 0; y < fy; y++) for (let x = 0; x < W; x++) {
      let c = (x + (y >> 3)) % 12 < 6 ? C.wall : C.wall2;
      if ((x % 12 === 6 && y % 8 === 4) || (x % 12 === 0 && y % 8 === 0)) c = C.wallDot;
      set(b, x, y, c);
    }
    // wainscot: a dark panelled band, then the skirting board
    const wt = fy - 20;
    rect(b, 0, wt, W, 16, C.panel); rect(b, 0, wt, W, 1, C.trimL); rect(b, 0, wt + 1, W, 1, C.trim); rect(b, 0, wt + 2, W, 1, C.trimD);
    for (let px = -6; px < W; px += 24) { rect(b, px + 3, wt + 5, 18, 9, C.panelL); rect(b, px + 4, wt + 6, 16, 7, C.panel); }
    rect(b, 0, fy - 4, W, 4, C.trim); rect(b, 0, fy - 4, W, 1, C.trimL); rect(b, 0, fy - 1, W, 1, C.trimD);
  }
  function drawFloor(b) {
    const fy = L.floorY;
    for (let y = fy; y < H; y++) {
      const row = Math.floor((y - fy) / 9), ry = (y - fy) % 9;
      for (let x = 0; x < W; x++) {
        const off = (row & 1) * 9, bx = Math.floor((x + off) / 18), rx = (x + off) % 18;
        let c = hash(bx, row) > .5 ? C.floor : C.floor2;
        if (ry === 0) c = C.gap; else if (rx === 0) c = C.gap; else if (ry === 1) c = C.floorL;
        else if (ry === 2 && bay(x, y) > .55) c = C.floorL;
        set(b, x, y, c);
      }
    }
    for (let k = 0; k < 7; k++) rect(b, 0, fy + k, W, 1, C.gap, 150 - k * 22); // the wall casts a soft shade on the boards
  }
  function drawWindow(b) {
    const w = L.win, x0 = w.x, y0 = w.y;
    rect(b, x0 - 2, y0 - 2, w.w + 4, w.h + 4, C.frame); rect(b, x0 - 2, y0 - 2, w.w + 4, 1, C.frameL); rect(b, x0 - 2, y0 - 2, 1, w.h + 4, C.frameL);
    const g = [C.sky0, C.sky1, C.sky2, C.sky3];
    for (let j = 0; j < w.h; j++) for (let i = 0; i < w.w; i++) { const t = (j / w.h) ** 1.25 * 3, k0 = Math.floor(t); set(b, x0 + i, y0 + j, g[bay(i, j) < t - k0 ? Math.min(3, k0 + 1) : k0]); }
    // the real moon phase, with a soft halo
    const age = (((now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % 29.530588853 + 29.530588853) % 29.530588853, ph = age / 29.530588853;
    const mx = x0 + Math.round(w.w * .58), my = Math.max(y0 + Math.round(clamp(w.h * .24, 10, 15)), 17), mr = 7;
    for (let j = -12; j <= 12; j++) for (let i = -12; i <= 12; i++) { const d = Math.hypot(i + .5, j + .5); if (d > mr && d < 12) { const a = (1 - (d - mr) / (12 - mr)) ** 2 * 60; if (bay(i + 40, j + 40) < a / 60) set(b, mx + i, my + j, C.sky3, a * 2.2); } }
    for (let j = -7; j <= 7; j++) for (let i = -7; i <= 7; i++) {
      const dx = i + .5, dy = j + .5; if (dx * dx + dy * dy > mr * mr) continue;
      const k = Math.cos(ph * 2 * Math.PI), xr = Math.sqrt(mr * mr - dy * dy), lit = ph < .5 ? dx > -k * xr : dx < k * xr;
      set(b, mx + i, my + j, lit ? (dx + dy < -3 ? C.moon0 : (dx * dx + dy * dy > mr * mr * .7 ? C.moon2 : C.moon1)) : C.moonDark);
    }
    S.moon = {x: mx, y: my};
    // a far-away town at the bottom of the window, a few lit windows
    let x = 0, seed = 5; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    while (x < w.w) { const bw = 4 + ((rnd() * 5) | 0), bh = 4 + ((rnd() * 7) | 0); rect(b, x0 + x, y0 + w.h - bh, Math.min(bw, w.w - x), bh, [8, 12, 36]); if (bh > 5 && rnd() < .6) set(b, x0 + x + 1 + ((rnd() * (bw - 2)) | 0), y0 + w.h - bh + 2 + ((rnd() * (bh - 3)) | 0), C.starG, 200); x += bw; }
    // stars (twinkle live), kept clear of the bars
    S.stars = []; seed = 21;
    for (let k = 0; k < 26; k++) { const sx = 1 + ((rnd() * (w.w - 2)) | 0), sy = 1 + ((rnd() * (w.h * .6)) | 0); if (Math.abs(sx - w.w / 2) < 2 || Math.abs(sy - w.h * .56) < 2 || y0 + sy < 3) continue; if (Math.hypot(sx - (mx - x0), sy - (my - y0)) < 10) continue; S.stars.push({x: x0 + sx, y: y0 + sy, ph: rnd() * 6, big: rnd() < .25}); }
    // bars + sill
    rect(b, x0 + (w.w >> 1) - 1, y0, 2, w.h, C.frame); rect(b, x0, y0 + Math.round(w.h * .56) - 1, w.w, 2, C.frame); rect(b, x0 + (w.w >> 1) - 1, y0, 1, w.h, C.frameL); rect(b, x0, y0 + Math.round(w.h * .56) - 1, w.w, 1, C.frameL);
    rect(b, x0 - 5, y0 + w.h + 2, w.w + 10, 3, C.sill); rect(b, x0 - 5, y0 + w.h + 2, w.w + 10, 1, C.frameL); rect(b, x0 - 4, y0 + w.h + 5, w.w + 8, 1, C.trimD);
    rect(b, x0 - 8, y0 - 6, w.w + 16, 2, C.rod); set(b, x0 - 9, y0 - 6, C.brassL); set(b, x0 + w.w + 8, y0 - 6, C.brassL); set(b, x0 - 8, y0 - 6, C.brassL);
  }
  function drawWallDecor(b) { // the things hanging on the room's wall: the shelf with a candle, a card and a jar (the left side of the room's wall)
    const d = L.deco, sy = d.sy;
    // shelf: a board on two brackets, running off the left edge
    rect(b, 0, sy, 31, 2, C.woodL); rect(b, 0, sy, 31, 1, C.woodH); rect(b, 0, sy + 2, 31, 1, C.woodD);
    rect(b, 3, sy + 3, 2, 4, C.woodD); rect(b, 24, sy + 3, 2, 4, C.woodD); rect(b, 3, sy + 3, 1, 3, C.wood); rect(b, 24, sy + 3, 1, 3, C.wood);
    rect(b, d.cx - 2, sy - 9, 5, 9, [214, 208, 196]); rect(b, d.cx - 2, sy - 9, 1, 9, [240, 236, 226]); rect(b, d.cx + 2, sy - 9, 1, 9, [160, 156, 150]); set(b, d.cx, sy - 10, C.ink); // the candle
    rect(b, 14, sy - 8, 7, 8, [140, 150, 164]); rect(b, 14, sy - 8, 7, 1, [176, 186, 198]); rect(b, 15, sy - 7, 5, 6, [112, 122, 140]); set(b, 17, sy - 5, [74, 84, 108]); set(b, 18, sy - 4, [74, 84, 108]); set(b, 16, sy - 6, [74, 84, 108]); // the little card
    rect(b, 23, sy - 6, 8, 6, [196, 112, 128]); rect(b, 23, sy - 6, 8, 1, [228, 150, 164]); rect(b, 23, sy - 1, 8, 1, [140, 72, 96]); // the jar
  }
  function drawLampStatic(b) { // the floor lamp's pole and foot (brass, like the room's lamp, but drawn with more detail because we are close); the shade is drawn live (it glows)
    const lx = L.lamp.x, top = L.lamp.top + 14, fy = L.lamp.base;
    const hi = [206, 164, 76], mid = [160, 123, 54], dk = [108, 82, 38], dd = [66, 50, 26], gl = [255, 226, 140];
    const row = (y, half, o = {}) => { // one row of a round brass piece: lit on the left, shaded on the right
      for (let i = -half; i <= half; i++) {
        let c = i <= -half + 1 ? hi : i < -half * .25 ? mid : i < half * .6 ? mid : dk;
        if (i === half) c = dd; if (o.top && i > -half + 1 && i < half - 1) c = i < 0 ? hi : mid; if (o.bot) c = i < half * .3 ? dk : dd;
        if (o.glint && i === -half + 2) c = gl;
        set(b, lx + i, y, c);
      }
    };
    ell(b, lx + 1, fy, 17, 2.8, C.gap, 120); ell(b, lx + 1, fy, 13, 1.8, C.gap, 120); // the shadow the foot throws on the floor
    for (let y = top; y < fy - 10; y++) { set(b, lx - 1, y, ((y - top) % 9 === 3) ? gl : hi); set(b, lx, y, mid); set(b, lx + 1, y, dk); } // the pole: three px, lit on the left
    const bead = y => { row(y, 3, {top: true}); row(y + 1, 3); row(y + 2, 2, {bot: true}); }; // small turned rings along the pole
    bead(top + 1); bead(Math.round((top + fy) / 2) - 1); bead(fy - 22);
    for (let k = 0; k < 6; k++) row(fy - 11 + k, 2 + (k >> 1) + (k > 3 ? 1 : 0), k === 0 ? {top: true} : {}); // the neck flares out into the foot
    row(fy - 5, 6, {top: true, glint: true}); row(fy - 4, 9, {glint: true}); row(fy - 3, 12, {glint: true}); row(fy - 2, 13); row(fy - 1, 12, {bot: true}); row(fy, 10, {bot: true}); // the flat, wide iron foot, stepped
  }


  /* ---- the gramophone: the SAME design as the room's (a low record cabinet right of the lamp, a box with a crank, a slim neck and a brass horn opening up-left),
     drawn at the room's zoom factor so it sits exactly where it does in the room: next to the lamp and behind the bed. Room coords (25,111 = the bed's centre) map to this scene by
     x = L.cx + (rx - 25) * k, with the cabinet's floor line (room y 90) standing 33 px above the bed's centre. The record, tonearm and notes are live. ---- */
  const GR = {k: 1, X: x => x, Y: y => y};
  function grMap() { // it stands against the wall, further from the camera than the bed, so it is drawn smaller than the bed's scale (GR_FAR); its left foot stays right beside the lamp's foot
    const kb = L.ex / 22, k = kb * GR_FAR, by = L.by - 33, ax = L.cx + (20 - 25) * kb; GR.k = k; GR.X = rx => ax + (rx - 20) * k; GR.Y = ry => by + (ry - 90) * k; GR.ry = y => 90 + (y + .5 - by) / k; GR.rx = x => 20 + (x + .5 - ax) / k; }
  const GR_FAR = .8;
  function drawGramophone(b) {
    grMap(); const k = GR.k, X = GR.X, Y = GR.Y;
    const rr = (x, y, w, h, c, a) => { const x0 = Math.round(X(x)), y0 = Math.round(Y(y)); rect(b, x0, y0, Math.max(1, Math.round(X(x + w)) - x0), Math.max(1, Math.round(Y(y + h)) - y0), c, a); };
    ell(b, X(32), Y(91), 15 * k, 1.6 * k, C.gap, 130); ell(b, X(32), Y(91), 11 * k, 1 * k, C.gap, 110); // the shadow it throws on the floor
    // the low cabinet: a lit top edge, a nook of record sleeves on the left, a small door with a brass knob on the right
    rr(20, 76, 24, 2, C.woodL); rr(20, 76, 24, .6, C.woodH); rr(20, 78, 24, 1, C.woodD); rr(21, 79, 22, 9, C.wood); rr(21, 79, 1, 9, C.woodL); rr(43 - 1, 79, 1, 9, C.woodD);
    rr(23, 80, 9, 7, C.woodD);
    [C.bk2, C.bk5, C.bk1, C.bk3, C.bk6, C.bk4, C.bk7].forEach((c, i) => { rr(24 + i, 81 + (i % 3 === 1 ? 1 : 0), 1, 6 - (i % 3 === 1 ? 1 : 0), c); rr(24 + i, 81 + (i % 3 === 1 ? 1 : 0), .5, 6 - (i % 3 === 1 ? 1 : 0), mulc(c, 1.15)); });
    rr(29, 81, 1, 1, C.page2); // one sleeve pulled a little out
    rr(33, 80, 8, 7, C.woodD); rr(34, 81, 6, 5, C.wood); rr(34, 81, 6, 1, C.woodL); rr(35, 83, 1, 1, C.brassL); rr(35.5, 83.5, .6, .6, C.brassD);
    rr(22, 88, 2, 2, C.woodD); rr(40, 88, 2, 2, C.woodD); rr(20, 90, 24, 1, C.gap);
    // the gramophone box, with a brass band and a small dial
    rr(25, 70, 13, 6, C.woodD); rr(25, 70, 13, 1, C.woodL); rr(26, 71, 11, 4, C.wood); rr(26, 71, 11, .6, C.woodL); rr(26, 73, 11, 1, C.brass); rr(31, 73, 1, 1, C.brassL); rr(25, 75, 1, 1, C.brassD); rr(37, 75, 1, 1, C.brassD);
    rr(37, 71.5, .6, 4, C.woodD); // a seam in the box
    // the crank on the right side
    rr(38, 72, 1, 1, C.brassD); rr(39, 72, 1, 1, C.brassD); rr(40, 71, 1, 1, C.brassD); rr(40, 70, 1, 1, C.brass); rr(41, 70, 1, 1, C.brassL);
    // a mug next to it, like in the room
    rr(40, 73, 3, 3, C.bk1); rr(43, 74, 1, 1, C.bk1); rr(40, 73, 1, 1, C.page2); rr(40, 75, 3, .6, mulc(C.bk1, .7));
    // the slim brass neck, then the horn: a cone that opens up and to the left, with a dark bell
    rr(30, 66, 2, 4, C.brassD); rr(30, 66, 1, 2, C.brass);
    const p0 = [31, 66], p1 = [20.5, 54.5], Ln = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), d = [(p1[0] - p0[0]) / Ln, (p1[1] - p0[1]) / Ln], nn = [-d[1], d[0]], rad = u => .9 + 6 * u ** 2.1;
    const R1 = rad(1) + .6, mx = p1[0], my = p1[1];
    const x0 = Math.floor(X(10)), x1 = Math.ceil(X(36)), y0 = Math.floor(Y(42)), y1 = Math.ceil(Y(69));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const rx = GR.rx(x), ry = GR.ry(y), qx = rx - p0[0], qy = ry - p0[1], u = (qx * d[0] + qy * d[1]) / Ln, v = qx * nn[0] + qy * nn[1];
      if (u >= 0 && u <= 1) { const r = rad(u); if (Math.abs(v) <= r) { const kk = v / r; let c = C.brass; if (kk < -.72 || kk > .7) c = C.brassD; else if (kk > -.5 && kk < -.12) c = C.brassL; if (r > 2.5 && Math.abs(Math.abs(kk) - .42) < .09) c = C.brassD; set(b, x, y, c); } }
      const ox = rx - mx, oy = ry - my, aa = ox * nn[0] + oy * nn[1], cc = ox * d[0] + oy * d[1], e = (rr_, ry_) => (aa / rr_) ** 2 + (cc / ry_) ** 2 <= 1;
      if (e(R1, R1 * .5)) set(b, x, y, e(R1 - 3.6, R1 * .5 - 1.6) ? C.gap : e(R1 - 1.8, R1 * .5 - 1.1) ? C.woodD : e(R1 - .9, R1 * .5 - .7) ? C.brassD : C.brassL);
    }
  }
  function drawGramophoneLive(b, t, on, dt) { // the record spins (easing in and out like a real platter), the tonearm lies on it while playing and rests aside when quiet
    const k = GR.k, X = GR.X, Y = GR.Y, cx = X(31.5), cy = Y(69);
    S.spin = (S.spin || 0) + ((on ? 1 : 0) - (S.spin || 0)) * Math.min(1, .06 * dt * 24); S.ang = (S.ang || 0) + S.spin * .55 * dt * 24;
    const A = S.ang, px = (x, y, c, a) => set(b, X(x), Y(y), c, a);
    ell(b, cx, cy, 6.6 * k, 1.9 * k, C.pupil); ell(b, cx, cy, 5.6 * k, 1.5 * k, C.cat);
    for (let a = 0; a < 80; a++) { const q = a / 80 * Math.PI * 2; set(b, cx + Math.cos(q) * 4.2 * k, cy + Math.sin(q) * 1.1 * k, C.catR, 120); } // grooves
    for (const [d, al] of [[0, 230], [.25, 140], [.5, 70]]) { const q = A - d; set(b, cx + Math.cos(q) * 5 * k, cy + Math.sin(q) * 1.35 * k, C.catRL, al); set(b, cx + Math.cos(q) * 5 * k + 1, cy + Math.sin(q) * 1.35 * k, C.catRL, al * .6); set(b, cx + Math.cos(q + Math.PI) * 3.4 * k, cy + Math.sin(q + Math.PI) * .9 * k, C.catR, al * .7); }
    ell(b, cx, cy, 1.9 * k, .9 * k, C.gold2); ell(b, cx, cy, 1.1 * k, .5 * k, C.gold); set(b, cx + Math.cos(A) * 1.2 * k, cy + Math.sin(A) * .5 * k, C.brassD); set(b, cx, cy - .5 * k, C.page);
    const piv = [37, 67]; rect(b, Math.round(X(37)), Math.round(Y(67)), 2, 2, C.brassL); rect(b, Math.round(X(37)), Math.round(Y(68)), 2, 2, C.brassD);
    const arm = on ? [[36, 67], [35, 67], [34, 68], [33, 68]] : [[37, 66], [37, 65], [36, 64], [36, 63]];
    arm.forEach(([x, y], i) => rect(b, Math.round(X(x)), Math.round(Y(y)), 2, 2, i === arm.length - 1 ? C.page2 : C.brass));
  }

  /* ---- the bed: plush donut (outer ellipse, ring of bolster, hollow with a quilted cushion) ---- */
  function bedPx(b, fg, x, y, c, front) { set(b, x, y, c); if (front && fg) set(fg, x, y, c); }
  function drawBed(b, fg) {
    const cx = L.cx, cy = L.by, ex = L.ex, ey = L.ey, th = L.th, exi = L.exi, eyi = L.eyi, wallH = 7;
    // the shadow it throws on the floor
    for (const [grow, a] of [[10, 50], [6, 80], [3, 110]]) ell(b, cx + 2, cy + th + 5, ex + grow, 8 + grow * .35, C.gap, a);
    for (let y = Math.floor(cy - ey - 2); y <= cy + ey + th + 3; y++) for (let x = Math.floor(cx - ex - 1); x <= cx + ex + 1; x++) {
      const dx = (x + .5 - cx) / ex; if (dx < -1 || dx > 1) continue;
      const s = Math.sqrt(1 - dx * dx), yy = y + .5, top = cy - ey * s, bot = cy + th + ey * s + (((x * 7) % 5) === 0 ? .6 : 0);
      if (yy < top || yy > bot) continue;
      const dyo = (yy - cy) / ey, r = Math.sqrt(dx * dx + dyo * dyo), front = yy >= cy;
      let c;
      if (r <= 1) {
        if (r < .6) { // the hollow
          const ux = (x + .5 - cx) / exi, yb = cy - eyi * Math.sqrt(Math.max(0, 1 - ux * ux)), ri = Math.sqrt(ux * ux + ((yy - cy) / eyi) ** 2);
          if (yy < cy && yy - yb < wallH) { // the inside face of the back rim
            const w2 = (yy - yb) / wallH; let v = .66 - .4 * w2 + (hash(x, y) < .08 ? .1 : 0); if (yy - yb < 1.2) v += .2;
            c = ramp(RAMP_BED, v, x, y);
          } else {
            let v = .62 - .3 * clamp((ri - .3) / .7, 0, 1); if (yy < cy) v -= .2 * clamp(1 - (yy - yb - wallH) / 5, 0, 1); v -= .28 * sstep((ri - .72) / .28);
            if (hash(x, y) < .03) v += .08;
            // quilted tufts on a diamond lattice
            for (let j = -1; j <= 1; j++) { const py = Math.round(cy + 1 + (Math.round((yy - cy - 1) / 5) + j) * 5), qx = Math.round((x - cx - (((py - cy) / 5) & 1) * 5) / 10) * 10 + cx + ((((py - cy) / 5) & 1) * 5); if (x === qx && y === py) v -= .3; else if (x === qx - 1 && y === py - 1) v += .12; }
            c = ramp(RAMP_CUSH, v, x, y);
          }
        } else { // the ring: the cross-section of a fat tube, brightest along its crest
          const q = (r - .6) / .4, phi = Math.PI * q, rdx = dx / Math.max(r, .05);
          let v = .3 + .62 * Math.sin(phi) ** 1.15 + .1 * -Math.cos(phi) * rdx + (front ? .06 : 0);
          if (q < .1) v -= .12; if (q > .88) v -= .1;
          if (hash(x, y) < .035) v += .08;
          const a = Math.atan2(dyo * .9, dx) / (Math.PI / 10), fr = Math.abs(a - Math.round(a)); // quilt seams
          if (fr * (Math.PI / 10) * r * 26 < .62 && q > .12 && q < .86 && ((x + y) & 1) === 0) v -= .16;
          if (yy - top < 1.3 && !front) v += .22; // the lit lip along the far edge
          c = ramp(RAMP_BED, v, x, y);
        }
      } else { // the side of the bolster below the crest (front only)
        const w = clamp((yy - (cy + ey * s)) / th, 0, 1);
        let v = .62 - .52 * Math.pow(w, .8) + (hash(x, y) < .035 ? .08 : 0);
        if (w < .1) v -= .14; // the crease where top meets side
        if (((x - cx + 900) % 11) === 0 && w > .12 && w < .9 && (y & 1) === 0) v -= .14; // vertical quilting
        if (bot - yy < 1.3) v = Math.min(v, .08);
        c = ramp(RAMP_BED, v, x, y);
      }
      bedPx(b, fg, x, y, c, front && r >= .6);
    }
  }
  function pillow(b, x0, y0, w, h, col, o = {}) {
    const R = [mulc(col, .4), mulc(col, .6), mulc(col, .8), col, mulc(col, 1.15), mulc(col, 1.32)];
    const pw = o.p || 2.5, inside = (x, y) => { const ex = (x + .5 - x0) / (w / 2), ey = (y + .5 - y0) / (h / 2); return Math.abs(ex) ** pw + Math.abs(ey) ** pw <= 1; };
    for (let y = Math.floor(y0 - h / 2) - 1; y <= y0 + h / 2 + 1; y++) for (let x = Math.floor(x0 - w / 2) - 1; x <= x0 + w / 2 + 1; x++) {
      if (!inside(x, y)) continue;
      const ex = (x + .5 - x0) / (w / 2), ey = (y + .5 - y0) / (h / 2), edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const topEdge = !inside(x, y - 1), botEdge = !inside(x, y + 1);
      let v = .56 + .3 * (1 - ex * ex - ey * ey) - .16 * ey + .08 * ex; // puffy: bright in the middle and toward the top
      const deep = inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1) && inside(x - 2, y) && inside(x + 2, y) && inside(x, y - 2) && inside(x, y + 2);
      if (!edge && !deep) v += topEdge ? 0 : .1; // piping: a lighter seam just inside the border
      if (!edge && deep && ((x + y * 3) % 7 === 0) && Math.abs(ey) < .5) v -= .05; // a few stitches
      if (edge) v = topEdge ? .86 : botEdge ? .08 : .3;
      set(b, x, y, ramp(R, v, x, y));
    }
  }
  function moonPillow(b, cx, cy) {
    ell(b, cx, cy, 8, 8, C.gold2); ell(b, cx - .6, cy - .6, 7.3, 7.3, C.gold); ell(b, cx + 3.4, cy - 2.3, 6.4, 6.6, C.b2);
    for (let a = 0; a < 12; a++) { const t = Math.PI * (.62 + a * .075); set(b, cx + Math.cos(t) * 7.2, cy + Math.sin(t) * 7.2 * .98, C.brassL); }
    set(b, cx - 4, cy - 3, C.page); set(b, cx - 5, cy - 1, C.page, 200); set(b, cx - 3, cy + 3, C.gold2); set(b, cx - 4, cy + 2, C.gold2);
  }
  function drawPillows(b) {
    const cx = L.cx, cy = L.by;
    pillow(b, cx - 28, cy - 15, 27, 19, C.bk5);
    pillow(b, cx + 27, cy - 16.5, 23, 16, mulc(C.bk1, .88));
    moonPillow(b, cx - 6, cy - 19);
    // the round pink pillow with the star button, resting against the blue one (front right, as in the room)
    const px = cx + 37, py = cy - 10;
    ell(b, px + .5, py + 6.4, 8.6, 1.8, C.gap, 120); // the little shadow it throws on the cushion below
    pillow(b, px, py, 15, 12.5, C.pink, {p: 2});
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if (i * j === 0) set(b, px + i, py + j, i === 0 && j === 0 ? C.starG : mulc(C.pink, .55)); // the star button: a dimple in the stuffing, a gold centre
    set(b, px, py, C.starG); set(b, px - 1, py - 1, mulc(C.starG, .8), 120); set(b, px + 1, py + 1, mulc(C.starG, .8), 120);
    for (let a = 0; a < 6; a++) { const q = -2.6 + a * .38; set(b, px + Math.cos(q) * 5.2, py + Math.sin(q) * 4.1, mulc(C.pink, 1.3), 150); } // a soft highlight along the top-left
  }
  /* the blanket is a dark wool plaid: dusk-blue ground, a wide faded burgundy band, a thin faded cream line and a dark thin line, repeated every 22 px in both directions (a tartan).
     a = distance along the cloth, b = across it. Where two wide bands cross the colour deepens; where two cream lines cross it lightens. */
  function plaidCol(a, b) {
    const P = 22, band = f => { f = ((Math.floor(f) % P) + P) % P; return f < 6 ? 2 : f === 9 ? 3 : (f === 13 || f === 14) ? 1 : 0; };
    const A = band(a), B = band(b);
    if (A === 3 || B === 3) return A === 3 && B === 3 ? C.plL : C.plLd;
    if (A === 2 && B === 2) return C.plRd;
    if (A === 2 || B === 2) return C.plR;
    if (A === 1 || B === 1) return C.plBd;
    return C.plB;
  }
  /* wool plaid blanket draped over the front-right rim: it follows the curve of the bolster on top, then hangs straight down the side
     (wavy hem, short thread fringe). A tap puts it over Moon. */
  function drawBlanketDrape(b, fg, p) {
    p = p || 0; const cx = L.cx, cy = L.by, ex = L.ex, ey = L.ey, th = lerp(L.th, 2, p), tA = .92, tB = 1.42; // p = 0 hangs full length; p = 1 it is pulled almost all the way over Moon, only a short tab stays at the rim
    const x0 = Math.floor(cx + ex * Math.cos(tB)) - 3, x1 = Math.ceil(cx + ex * Math.cos(tA)) + 3;
    const cell = (x, y) => { // -> {c} when (x, y) is cloth, else null
      const dx = (x + .5 - cx) / ex, yy = y + .5; if (dx <= 0 || dx >= 1) return null;
      const dyo = (yy - cy) / ey, r = Math.sqrt(dx * dx + dyo * dyo), th2 = Math.atan2(dyo, dx), s = Math.sqrt(1 - dx * dx), eb = cy + ey * s;
      const wv = .03 * Math.sin(r * 15 + th2 * 4), rin = .54 + .025 * Math.sin(th2 * 13);
      let g;
      if (r <= 1 && yy >= cy && r >= rin && th2 >= tA + wv && th2 <= tB - wv) g = (r - rin) * 21; // on the crest, running outward
      else if (yy > eb && dx >= Math.cos(tB) - (yy - eb) * .004 + .012 * Math.sin(yy * .8) && dx <= Math.cos(tA) + (yy - eb) * .004 + .012 * Math.sin(yy * .6 + 2) && yy <= cy + th + ey * s + 3 + Math.sin(x * .9) * .8 + ((x & 3) === 1 ? .9 : 0)) g = (1 - rin) * 21 + (yy - eb); // hanging down the side
      else return null;
      return g;
    };
    for (let y = Math.floor(cy); y <= cy + ey + th + 7; y++) for (let x = x0; x <= x1; x++) {
      const g = cell(x, y); if (g === null) continue;
      const gi = Math.floor(g), knit = (x + gi) & 1;
      let c = plaidCol(g + 1.2 * Math.sin((x - x0) * .5), (x - x0) * 1.15 + 1.4 * Math.sin(g * .3));
      const edge = cell(x - 1, y) === null || cell(x + 1, y) === null || cell(x, y - 1) === null || cell(x, y + 1) === null;
      // folds: a soft shadow between the cloth lying on top and the part hanging down, and a crease or two
      const dx = (x + .5 - cx) / ex, dyo = (y + .5 - cy) / ey, r = Math.sqrt(dx * dx + dyo * dyo);
      let k = 1; if (r > .93 && r <= 1.02) k = .8; if (r < .62) k = 1.1; if (r >= .7 && r <= .86) k = 1.08; const fold = Math.sin((x - x0) * .85 + g * .06); k *= 1 + .1 * fold; if (g > 14) k *= 1 - Math.min(.2, (g - 14) * .02);
      c = mulc(c, k * (knit ? .94 : 1));
      if (edge) c = mulc(c, .72);
      if (cell(x, y - 1) === null && r < .7) c = mulc(c, 1.3); // the rolled edge lying on the cushion
      if (cell(x, y + 1) === null && g > 12) c = C.plBd; // the hem (a dark binding)
      bedPx(b, fg, x, y, c, true);
    }
    // tassels and the soft shadow under the hem
    for (let x = x0; x <= x1; x++) {
      let yb = -1; for (let y = Math.floor(cy + ey + th + 8); y > cy; y--) if (cell(x, y) !== null) { yb = y; break; }
      if (yb < 0) continue;
      { const f = 2 + ((x * 7 + 3) % 3 === 0 ? 1 : 0); for (let q = 1; q <= f; q++) bedPx(b, fg, x, yb + q, (x + q) & 1 ? C.plLd : C.plL, true); } // short fringe: thin threads of faded cream
      for (let k = 1; k <= 2; k++) set(b, x, yb + 2 + k, C.gap, 90 - k * 30);
    }
  }
  function drawRug(b) { // the round braided rug beside the bed (to its right, cut by the screen edge), like the one in the room
    const cx = L.cx + 74, cy = L.by + 10, rx = 58, ry = 27, BAND = [[39, 41, 56], [50, 53, 72], [62, 66, 89], [50, 53, 72], [39, 41, 56], [74, 71, 114], [50, 53, 72], [62, 66, 89]];
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(W - 1, cx + rx); x++) {
      const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry, r = Math.sqrt(dx * dx + dy * dy); if (r > 1) continue;
      const band = Math.min(7, Math.floor(r * 8)), f = r * 8 - band, ang = Math.atan2(dy, dx), k = Math.floor((ang + Math.PI) / (Math.PI * 2) * (46 + band * 16) + f * 2.2);
      let c = BAND[band]; if (f < .2 || f > .86) c = BAND[0]; else if ((k & 1) && f > .35 && f < .7) c = band === 5 ? [90, 95, 126] : mulc(c, 1.18);
      if (r > .965) c = [34, 35, 46]; if (r > .9 && r <= .965 && ((x + y) & 3) === 0) c = mulc(c, .8);
      set(b, x, y, c);
    }
    for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2 + .3, x = Math.round(cx + Math.cos(t) * rx * .58), y = Math.round(cy + Math.sin(t) * ry * .58); set(b, x, y, C.starG); set(b, x - 1, y, [90, 95, 126]); set(b, x + 1, y, [90, 95, 126]); set(b, x, y - 1, [90, 95, 126]); set(b, x, y + 1, [90, 95, 126]); }
  }
  function drawWire(b) { // the wire of the string lights across the top of the wall
    for (let x = 0; x < W; x++) set(b, x, garlandY(x), [42, 47, 85]);
  }
  function drawScene(b, fg) {
    drawWall(b); drawWire(b); drawFloor(b); drawRug(b); drawWindow(b); drawWallDecor(b); drawLampStatic(b);
    drawBed(b, fg); drawPillows(b);
  }
  /* the drape is baked in DN steps (0 = hanging, DN = pulled over Moon): each step is stored as the pixels that differ from the bare scene */
  const DN = 12;
  function bakeDrapes() {
    S.drapes = [];
    for (let k = 0; k <= DN; k++) {
      const b2 = S.base.slice(), f2 = S.fg0.slice(); drawBlanketDrape(b2, f2, k / DN);
      const ob = [], of = [];
      for (let i = 0; i < b2.length; i += 4) { if (b2[i] !== S.base[i] || b2[i + 1] !== S.base[i + 1] || b2[i + 2] !== S.base[i + 2] || b2[i + 3] !== S.base[i + 3]) ob.push(i, b2[i], b2[i + 1], b2[i + 2], b2[i + 3]); if (f2[i] !== S.fg0[i] || f2[i + 1] !== S.fg0[i + 1] || f2[i + 2] !== S.fg0[i + 2] || f2[i + 3] !== S.fg0[i + 3]) of.push(i, f2[i], f2[i + 1], f2[i + 2], f2[i + 3]); }
      S.drapes.push({b: Int32Array.from(ob), f: Int32Array.from(of)});
    }
    S.dStep = -1;
  }
  function applyDrape(b) { // the current drape step onto the frame (b) and onto the front-rim layer (S.fg)
    const k = clamp(Math.round(K.ce * DN), 0, DN), d = S.drapes[k];
    if (S.dStep !== k) { S.dStep = k; S.fg.set(S.fg0); const f = d.f; for (let i = 0; i < f.length; i += 5) { const o = f[i]; S.fg[o] = f[i + 1]; S.fg[o + 1] = f[i + 2]; S.fg[o + 2] = f[i + 3]; S.fg[o + 3] = f[i + 4]; } }
    const q = d.b; for (let i = 0; i < q.length; i += 5) { const o = q[i]; b[o] = q[i + 1]; b[o + 1] = q[i + 2]; b[o + 2] = q[i + 3]; b[o + 3] = q[i + 4]; }
  }

  /* ---------------- light: a warm lamp on the left, or cool moonlight from the window when the lamp is off ---------------- */
  function bakeLight() {
    const n = W * H; S.LFon = new Float32Array(n); S.LFoff = new Float32Array(n); S.LAon = new Float32Array(n * 3); S.LAoff = new Float32Array(n * 3);
    const lx = L.lamp.x, ly = L.lamp.top + 12, wx = L.win.x + L.win.w / 2, wy = L.win.y + L.win.h * .35;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, vig = Math.max(.52, 1 - .5 * (((x - W * .42) / (W * .7)) ** 2 + ((y - H * .66) / (H * .72)) ** 2)); // the soft darkening at the corners, centred on the bed (front-left)
      const d = Math.hypot((x - lx) * .9, (y - ly) * .75), warm = Math.max(0, 1 - d / 125) ** 1.35;
      S.LFon[i] = (.94 + .46 * warm) * vig; S.LAon[i * 3] = 30 * warm; S.LAon[i * 3 + 1] = 16 * warm; S.LAon[i * 3 + 2] = 0;
      const wd = Math.hypot(x - wx, (y - wy) * .7), mo = Math.max(0, 1 - wd / 140);
      S.LFoff[i] = (.46 + .2 * mo) * vig; S.LAoff[i * 3] = 0; S.LAoff[i * 3 + 1] = 6 * mo; S.LAoff[i * 3 + 2] = 18 * mo;
    }
  }
  function applyLight(src, dst, mix, masked) {
    const n = W * H, on = S.LFon, off = S.LFoff, ao = S.LAon, af = S.LAoff;
    for (let p = 0; p < n; p++) {
      const i = p * 4; if (masked && !src[i + 3]) continue;
      const f = off[p] + (on[p] - off[p]) * mix, q = p * 3;
      dst[i] = Math.min(255, src[i] * f + af[q] + (ao[q] - af[q]) * mix);
      dst[i + 1] = Math.min(255, src[i + 1] * f + af[q + 1] + (ao[q + 1] - af[q + 1]) * mix);
      dst[i + 2] = Math.min(255, src[i + 2] * f + af[q + 2] + (ao[q + 2] - af[q + 2]) * mix);
      dst[i + 3] = 255;
    }
  }

  /* ---------------- things that move gently in the scene ---------------- */
  function vineS(b, x0, y0, len, ph, dir, t, br) {
    let x = x0;
    for (let k = 0; k <= len; k++) {
      x = x0 + dir * 1.2 * Math.sin(k * .28 + ph) + br * 1.3 * Math.pow(k / len, 1.2) * Math.sin(t * .8 + ph + k * .08);
      set(b, Math.round(x), y0 + k, C.leafD);
      if (k >= 2 && (k - 2) % 3 === 0) { const sd = (((k - 2) / 3) & 1) ? 1 : -1; ell(b, x + sd * 2, y0 + k, 1.8, 1.2, ((k >> 1) & 1) ? C.leafL : C.leaf); }
    }
    ell(b, x, y0 + len + 1, 1.4, 1.6, C.leaf);
  }
  function drawCurtains(b, t) {
    const w = L.win, br = breeze(t), x0 = w.x, hh = w.h + 10, ty = Math.round(hh * .56);
    for (const side of [-1, 1]) {
      const sway = Math.sin(t * .7 + (side > 0 ? 1.7 : 0)) * .8 * br + br * .35;
      for (let j = 0; j < hh; j++) {
        const u = j / hh, width = Math.round(11 - 4.5 * Math.exp(-(((j - ty) / 7) ** 2)) + u * 1.5), off = sway * Math.pow(u, 1.6) * side;
        for (let i = 0; i < width; i++) {
          const x = side < 0 ? x0 - 8 + i : x0 + w.w + 8 - 1 - i, fold = (i + (j > ty ? 1 : 0)) % 4;
          let c = fold === 0 ? C.curtD : fold === 2 ? C.curtL : C.curt;
          if (j > hh - 3) c = C.curtD; if (i === 0 || i === width - 1) c = C.curtD; if (i === 1 && fold !== 0) c = C.curtL;
          set(b, x + off, w.y - 4 + j, c);
        }
        if (j === ty) for (let i = 0; i < width; i++) set(b, (side < 0 ? x0 - 8 + i : x0 + w.w + 8 - 1 - i) + off, w.y - 4 + j, i === 0 ? C.brassL : C.brass);
      }
    }
    for (const k of S.stars) { const tw = Math.sin(t * 1.6 + k.ph); if (tw > -.35) set(b, k.x, k.y, tw > .55 ? C.star : C.starB, 255 * clamp((tw + .35) * 1.6, 0, 1)); }
  }
  function drawLampShade(b, t, lm) {
    const lx = L.lamp.x, top = L.lamp.top, on = lm > .5;
    for (let j = 0; j < 14; j++) { const half = 5 + j * .62; for (let i = -Math.round(half); i <= Math.round(half); i++) {
      const edge = Math.abs(i) >= Math.round(half) - 0;
      const c = on ? (j > 11 ? C.shadeOn2 : ((i + j) % 6 === 0 ? C.shadeOn2 : C.shadeOn)) : (j > 11 ? C.shadeOff2 : ((i + j) % 6 === 0 ? C.shadeOff2 : C.shadeOff));
      set(b, lx + i, top + j, edge ? (on ? C.shadeOn2 : C.shadeOff2) : c); } }
    for (let i = -5; i <= 5; i++) set(b, lx + i, top - 1, on ? C.brassL : C.brassD); set(b, lx, top - 2, C.brassD);
  }
  function drawHanging(b, t) { // the hanging plant is far overhead: only the tips of its trailing vines dip into the top of the screen (no pot, no hanger)
    const br = breeze(t), px = 38;
    vineS(b, px - 5, -14, 26, .4, 1, t, br); vineS(b, px - 1, -16, 34, 2.1, -1, t, br); vineS(b, px + 4, -12, 22, 3.7, 1, t, br); vineS(b, px + 7, -10, 16, 5.1, -1, t, br);
  }
  function garlandY(x) { return 2 + Math.round(5.5 * Math.sin((x % 60) / 60 * Math.PI)); }
  function drawGarland(lit, t, lm) { // warm bulbs that breathe; a thin wire is baked into the wall
    const cols = [C.starG, C.pink, C.starB, C.shadeOn2];
    for (let k = 0; k < 11; k++) {
      const x = 5 + k * 11, y = garlandY(x) + 1, c = cols[k % 4], on = .55 + .45 * Math.sin(t * 1.3 + k * 1.7), glow = (1 - lm * .5) * (.7 + .3 * on);
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const a = Math.max(0, 1 - Math.hypot(i, j) / 4.4) * 50 * glow; if (a > 2) set(lit, x + i, y + j, c, a); }
      set(lit, x, y, c, 255 * (.7 + .3 * on)); set(lit, x, y - 1, C.brassD);
    }
  }
  function drawGlows(lit, t, lm) {
    // the lamp's glow under the shade
    if (lm > .02) { const lx = L.lamp.x, ly = L.lamp.top + 14; for (let j = 0; j < 22; j++) for (let i = -16; i <= 16; i++) { const a = Math.max(0, 1 - Math.hypot(i * .9, j * 1.25) / 18) * 70 * lm * (.92 + .08 * Math.sin(t * 3)); if (a > 2) set(lit, lx + i, ly + j, C.shadeOn2, a); } }
    // candle on the sill
    if (S.flame && S.api.candle && S.api.candle()) {
      const {x, y} = S.flame, f = Math.sin(t * 13) > 0;
      for (let j = -9; j <= 8; j++) for (let i = -9; i <= 9; i++) { const a = Math.max(0, 1 - Math.hypot(i, j * 1.1) / 10) * 70; if (a > 3) set(lit, x + i, y + j, C.shadeOn2, a); }
      set(lit, x, y + 1, C.shadeOn2); set(lit, x, y, f ? C.shadeOn : C.brassL); set(lit, x, y - 1, f ? C.shadeOn : C.shadeOn2);
    }
  }
  function drawBeam(lit, t, lm) { // a shaft of moonlight from the window onto the bed, with dust floating in it
    const w = L.win, y1 = w.y + w.h + 6, yEnd = L.by + L.th + 6, slope = -.36, str = .1 + .1 * (1 - lm);
    for (let y = y1; y < Math.min(H, yEnd); y++) {
      const u = (y - y1) / (yEnd - y1), xl = w.x + 4 + (y - y1) * slope, xr = w.x + w.w - 3 + (y - y1) * slope * .9, a = str * (1 - u) ** .8 * 255 * .55, cxm = (xl + xr) / 2;
      for (let x = Math.ceil(xl); x < xr; x++) {
        const edge = Math.min(x - xl, xr - x), k = clamp(edge / 4, 0, 1), gap = Math.abs(x - cxm) < 1.2 ? .35 : 1; // the window's centre bar leaves a thin shadow
        set(lit, x, y, C.moon1, a * k * gap);
      }
    }
    const lo = w.x + 4, wdt = w.w - 7;
    for (let k = 0; k < 9; k++) { const u = (t * .03 + k / 9) % 1, y = y1 + u * (yEnd - y1), x = lo + ((k * 37) % wdt) + y * slope * .9 * 0 + (y - y1) * slope + Math.sin(t * .6 + k * 2) * 2.5; set(lit, x, y, C.page, 150 * Math.sin(u * Math.PI) * (.6 + .4 * (1 - lm))); }
  }

  /* ---------------- Moon, close up: a cat built from soft shapes that morph between "sitting up" and "curled asleep" ---------------- */
  const CAT = {OX: 60, OY: 128, X0: 10, Y0: 66, LW: 100, LH: 78};
  const LB = new Uint8Array(CAT.LW * CAT.LH), SP = new Uint8ClampedArray(CAT.LW * CAT.LH * 4);
  const ID = {ear: 1, ear2: 2, body: 3, haunch: 3, neck: 3, tail: 6, paw: 7, collar: 8, head: 9};
  const bnd = (f, x0, y0, x1, y1) => (f.b = [x0, y0, x1, y1], f);
  const capT = (ax, ay, bx, by, ra, rb) => { const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1, m = Math.max(ra, rb); return bnd((x, y) => { let u = ((x - ax) * dx + (y - ay) * dy) / L2; u = u < 0 ? 0 : u > 1 ? 1 : u; const cx = ax + dx * u, cy = ay + dy * u, r = ra + (rb - ra) * u; return (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r; }, Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m); };
  const ellT = (cx, cy, rx, ry, ang = 0, fz = 0) => { const c = Math.cos(ang), s = Math.sin(ang), m = Math.max(rx, ry) * (1 + fz); return bnd((x, y) => { const dx = x - cx, dy = y - cy, u = dx * c + dy * s, v = -dx * s + dy * c; return (u / rx) ** 2 + (v / ry) ** 2 <= 1 + (fz ? (hash(Math.floor(x), Math.floor(y)) - .5) * fz * 2 : 0); }, cx - m, cy - m, cx + m, cy + m); };
  const triT = (a, b2, c) => bnd((x, y) => { const s = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]); const d1 = s(a, b2), d2 = s(b2, c), d3 = s(c, a); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); }, Math.min(a[0], b2[0], c[0]), Math.min(a[1], b2[1], c[1]), Math.max(a[0], b2[0], c[0]), Math.max(a[1], b2[1], c[1]));
  const inTri = (x, y, a, b2, c) => { const s = (p, q) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]); const d1 = s(a, b2), d2 = s(b2, c), d3 = s(c, a); return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0)); };
  function paint(id, test) {
    let i0 = 0, i1 = CAT.LW, j0 = 0, j1 = CAT.LH; const bb = test.b;
    if (bb) { i0 = clamp(Math.floor(CAT.OX + bb[0] - CAT.X0) - 1, 0, CAT.LW); i1 = clamp(Math.ceil(CAT.OX + bb[2] - CAT.X0) + 1, 0, CAT.LW); j0 = clamp(Math.floor(CAT.OY - bb[3] - CAT.Y0) - 1, 0, CAT.LH); j1 = clamp(Math.ceil(CAT.OY - bb[1] - CAT.Y0) + 1, 0, CAT.LH); }
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const lx = i + .5 + CAT.X0 - CAT.OX, ly = CAT.OY - (j + .5 + CAT.Y0); if (test(lx, ly)) LB[j * CAT.LW + i] = id; }
  }
  const putPx = (i, j, c, a = 255) => { if (i < 0 || j < 0 || i >= CAT.LW || j >= CAT.LH) return; const k = (j * CAT.LW + i) * 4; if (a >= 255) { SP[k] = c[0]; SP[k + 1] = c[1]; SP[k + 2] = c[2]; SP[k + 3] = 255; } else { const f = a / 255; SP[k] = SP[k + 3] ? SP[k] * (1 - f) + c[0] * f : c[0]; SP[k + 1] = SP[k + 3] ? SP[k + 1] * (1 - f) + c[1] * f : c[1]; SP[k + 2] = SP[k + 3] ? SP[k + 2] * (1 - f) + c[2] * f : c[2]; SP[k + 3] = Math.max(SP[k + 3], a); } };
  const lbAt = (i, j) => (i < 0 || j < 0 || i >= CAT.LW || j >= CAT.LH) ? 0 : LB[j * CAT.LW + i];
  const toPx = (lx, ly) => [Math.round(CAT.OX + lx - CAT.X0), Math.round(CAT.OY - ly - CAT.Y0)]; // local (y up) -> label buffer pixel

  function shade(dim, lm) { // label buffer (LB) -> coloured sprite (SP): rim light on the lit edges, soft banding on top, a contour where a front part overlaps another
    SP.fill(0); const LW = CAT.LW, LH = CAT.LH;
    const warm = mixc(C.catRd, C.warmRim, .75 * lm);
    for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) {
      const id = LB[j * LW + i]; if (!id) continue;
      const up = lbAt(i, j - 1), dn = lbAt(i, j + 1), lf = lbAt(i - 1, j), rt = lbAt(i + 1, j);
      let c = C.cat, run = 0; while (run < 4 && lbAt(i, j - 1 - run) === id) run++;
      const topEdge = !up, leftEdge = !lf, rightEdge = !rt, botEdge = !dn;
      if (topEdge) c = (id === ID.ear || id === ID.ear2) ? C.catR : C.catRL;
      else if (rightEdge) c = C.catR;
      else if (leftEdge) c = lm > .3 ? warm : C.catR;
      else if (botEdge) c = C.catRd;
      else if ((up && up < id) || (lf && lf < id) || (rt && rt < id) || (dn && dn < id)) c = id === ID.collar ? C.collar : C.inner;
      else if (id !== ID.collar) { if (run === 1) c = bay(i, j) > .35 ? C.catHi2 : C.catHi; else if (run === 2 && bay(i, j) > .5) c = C.catHi; else if (run === 3 && bay(i, j) > .85) c = C.catHi; else if (id !== ID.paw && hash(i + CAT.X0, j + CAT.Y0) < .035) c = C.catHi2; } // a little fur
      if (id === ID.collar && !topEdge) c = (up !== id) ? C.collarL : C.collar; if (id === ID.collar && topEdge) c = C.collarL;
      const k = (j * LW + i) * 4; SP[k] = c[0] * dim; SP[k + 1] = c[1] * dim; SP[k + 2] = c[2] * dim; SP[k + 3] = 255;
    }
  }

  const K = { // the cat's state
    tau: 0, goal: 0, dir: 1, lid: 0, blinkT: -1, blinkAt: 2.2, lookX: 0, lookY: 0, lookTX: 0, lookTY: 0, lookAt: 2.5, tw1: 0, tw2: 0, twAt: 4, flick: 0, flickAt: 6,
    br: 0, zAt: 1.5, happyUntil: 0, clock: 0, headC: [60, 100], idleT: 0,
    bph: 0, ce: 0, cover: 0, coverGoal: 0, cvel: {v: 0}, peek: 0, drag: null, press: null, lockUntil: 0, said: 0, // the blanket: cover 0 = open .. 1 = over his back; ce = what is actually on him (needs him curled)
    taps: [], angryUntil: 0, sulkUntil: 0, sulkOn: false, squintUntil: 0, purrUntil: 0, nuzUntil: 0, purr: 0, nuz: 0, ann: 0, ang: 0, hide: 0, hvel: {v: 0}, lashAt: 0, eyeRow: 0, headBot: 0, dream: 0, dreamOn: false, dreamUntil: 0, dreamAt: 22, dreamBeat: 0, dreamTalk: 0, yawn: 0, yawnUntil: 0, dsm: 1, sqx: 0, sqv: 0, exh: 0, shake: 0 // petting: smooth 0..1 moods (purr, leaning in, annoyed, angry) and how far the blanket is pulled over his face (hide)
  };
  const CM = new Uint8Array(CAT.LW * CAT.LH); // where the blanket cloth is (label coordinates), also used for touch
  const smoothDamp = (cur, goal, vo, st, dt) => { const om = 2 / st, x = om * dt, e = 1 / (1 + x + .48 * x * x + .235 * x * x * x), ch = cur - goal, tmp = (vo.v + om * ch) * dt; vo.v = (vo.v - om * tmp) * e; return goal + (ch + tmp) * e; }; // critically damped: eases in and out, never overshoots
  const EYE_OPEN = ['.dddd.', 'deeeed', 'eeeeee', 'eellee', '.llll.'];

  function renderCat(t, lm) {
    LB.fill(0);
    const tau = K.tau, bB = seg(tau, 0, .74), bHx = seg(tau, .16, .82), bHy = seg(tau, .06, .9), bT = seg(tau, .26, 1), bP = seg(tau, .2, .8), bE = seg(tau, .46, 1), sl = seg(tau, .5, .9);
    const br = Math.sin(K.bph) * lerp(.4, .8, bB) * (1 - .25 * K.ce) * (1 + 1.3 * K.exh), A = lerp;
    const bump = (v, a, b) => Math.sin(Math.PI * clamp((v - a) / (b - a), 0, 1)), dn = K.dsm, up = 1 - K.dsm;
    // settling down: a small breath in first (anticipation), the head nods and sinks; getting up: a long stretch (chest down and forward, rump up) before he sits tall
    const lift = dn * 1.5 * bump(tau, 0, .22), nod = dn * 2.6 * bump(tau, .05, .3), nod2 = dn * 1.2 * bump(tau, .3, .5);
    const str = up * bump(tau, .12, .86), str2 = str * str * (3 - 2 * str); // str2: the stretch holds its pose a little before it lets go
    const sq = K.sqx * .25; // landing / standing-up squash (spring)
    // body
    const bodyRy = br * .5 + K.purr * Math.sin(t * 31.4) * .3; // purring is a fine tremble of the body (the blanket follows the body, so it trembles too)
    paint(ID.body, ellT(A(0, 5, bB) - 4.5 * str2, A(14, 9.5, bB) - 2.5 * str2, A(11.2, 27, bB) * (1 - sq * .4), A(14.5, 10.5, bB) * (1 + sq) + bodyRy + lift * .6 - 2.5 * str2, .62 * str2, .05));
    paint(ID.body, ellT(A(0, 1.5, bB) - 3 * str2, A(21, 6, bB) - 2.8 * str2, A(9, 25, bB) * (1 - sq * .4), A(8, 8, bB) * (1 + sq) + bodyRy * .6 - 1.5 * str2, .3 * str2, .05));
    paint(ID.body, ellT(A(0, 8, bB) - 5 * str2, A(12, 14.5, bB) + bodyRy + lift * .3 - 4 * str2, A(7, 17, bB), A(6, 6, bB), 0, .05));
    // haunches
    paint(ID.haunch, ellT(A(-9.3, 22, bB), A(5.4, 5.5, bB) + 7 * str2, A(7, 9.5, bB), A(5.8, 8.5, bB) * (1 + sq) + bodyRy * .4, 0, .04));
    paint(ID.haunch, ellT(A(9.3, 14, bB), A(5.4, 3, bB) + 7 * str2, A(7, 6.5, bB), A(5.8, 4.5, bB) * (1 + sq), 0, .04));
    // neck / chest
    paint(ID.neck, ellT(A(0, -5, bB) - 6 * str2, A(23, 8.5, bB) - 9 * str2 - nod * .5, A(9.2, 10, bB), A(8.5, 8.5, bB), 0, .04));
    // head position: it sinks first, then slides to the side; looking around turns it a touch
    const shk = Math.sin(t * 38) * K.shake, hx = A(0, -11.5, bHx) + K.lookX * A(.9, .3, bB) + K.nuz * A(.4, 1.1, bB) - 10 * str2 - nod * .35 + shk * 1.3, hy = A(34.5, 6.8, bHy) + br * .35 + K.lookY * A(.4, 0, bB) + lift - nod - nod2 - 14 * str2 + K.sqx * 1.2;
    const tilt = A(0, -.1, bHx) + K.lookX * .05 * (1 - bB) + K.nuz * .07 + nod * .05 + .12 * str2 + shk * .05; // nuz: he leans his cheek into the hand
    const ca = Math.cos(tilt), sa = Math.sin(tilt), hw = (u, v) => [hx + u * ca - v * sa, hy + u * sa + v * ca];
    // front legs / paws
    const legL = hw(0, 0); void legL;
    const lg = (sd) => { const x = A(sd * 4.4, sd < 0 ? -19.5 : -5.5, bP) - 13 * str2 * (sd < 0 ? 1 : .85), yy = A(1.7, sd < 0 ? -.4 : -.8, bP) - .4 * str2; return [x, yy]; };
    for (const sd of [-1, 1]) {
      const [px0, py0] = lg(sd), px = px0 + K.dream * bP * Math.sin(t * 8 + sd) * .5, py = py0 + K.dream * bP * Math.sin(t * 8 + (sd < 0 ? 0 : 2.2)) * .9; // dreaming: the paws paddle a little
      if (bP < .999) paint(ID.body, capT(sd * A(4.4, 6, bP) - 6 * str2, A(20, 8, bP) - 8 * str2, px, py + 1.2, 2.6, 2.3));
      paint(ID.paw, ellT(px, py, A(3.7, 5.6, bP), A(2.3, 3.2, bP), 0, .03));
    }
    // tail: from the right haunch, around the front, tip curling up
    const TS = [[11, 3.6], [14.6, 2.2], [17, -.4], [17.4, -2.8], [15.4, -4.8], [11.4, -6], [5.6, -6.4], [-.6, -6.3], [-6.6, -5.4], [-11.2, -3.6], [-14, -.8], [-14.4, 2.2], [-12.6, 4.4], [-10, 5.4]];
    const TC = [[27, 6], [30.4, 3.4], [31, .6], [28.8, -1.4], [24, -2.8], [17, -3.5], [9, -3.9], [1, -4], [-7, -3.6], [-14, -3], [-20, -2], [-24.4, 0], [-26.4, 2.6], [-26, 5.6]];
    const N = TS.length, tp = [], sway = lerp(1, .35, bT);
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1), x = A(TS[i][0], TC[i][0], bT), y = A(TS[i][1], TC[i][1], bT), nx = i < N - 1 ? A(TS[i + 1][0], TC[i + 1][0], bT) - x : x - tp[i - 1][0], ny = i < N - 1 ? A(TS[i + 1][1], TC[i + 1][1], bT) - y : y - tp[i - 1][1], nl = Math.hypot(nx, ny) || 1;
      const wob = (Math.sin(t * 1.3 - i * .5) * .5 + Math.sin(t * .7 + i * .3) * .3) * (u ** 1.5) * 1.6 * sway + K.flick * Math.sin(u * 5 - t * 14) * u * 1.4;
      tp.push([x - ny / nl * wob, y + nx / nl * wob]);
    }
    for (let i = 0; i < N - 1; i++) paint(ID.tail, capT(tp[i][0], tp[i][1], tp[i + 1][0], tp[i + 1][1], lerp(2.7, 2.0, i / (N - 1)), lerp(2.7, 2.0, (i + 1) / (N - 1))));
    // collar
    paint(ID.collar, ellT(A(0, hx + .2, bB * .9 + .1 * bHx), A(24, hy - 9.2, bHy) + br * .1, A(6.6, 7.1, bB), A(1.6, 1.7, bB), 0));
    // ears: they stand up when awake and relax outward and down while he sleeps
    const earA = sd => A(.1, .66, bE) + (sd < 0 ? K.tw1 : K.tw2) * .3 + K.ang * .26 + K.ann * .1 + K.hide * .12, earPts = []; // cross: ears go back and flat
    for (const sd of [-1, 1]) {
      const a0 = hw(sd * 12.2, 3.8), b0 = hw(sd * 3.8, 9.4), mid = [(a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2], T0 = hw(sd * 10.6, 18.5 - A(0, 1.2, bE)), ang = -sd * earA(sd) * -1 * -1;
      const rot = (p, c0, q) => { const dx = p[0] - c0[0], dy = p[1] - c0[1], cc = Math.cos(q), ss = Math.sin(q); return [c0[0] + dx * cc - dy * ss, c0[1] + dx * ss + dy * cc]; };
      const T = rot(T0, mid, sd < 0 ? earA(sd) : -earA(sd)); earPts.push([a0, b0, T, sd]);
      paint(sd < 0 ? ID.ear : ID.ear2, triT(a0, b0, T));
    }
    // the head: a round face with fuller cheeks and a soft chin, a little cheek fluff
    paint(ID.head, ellT(hx, hy, 13.2, 10.2, tilt, .04));
    for (const sd of [-1, 1]) { const c = hw(sd * 7.2, -2.8); paint(ID.head, ellT(c[0], c[1], 7, 6.6, tilt, .04)); }
    { const c = hw(0, -5.4); paint(ID.head, ellT(c[0], c[1], 7.4, 5.6, tilt, .04)); }
    for (const sd of [-1, 1]) paint(ID.head, triT(hw(sd * 12.6, -.6), hw(sd * 16.4, -4.2), hw(sd * 11.4, -6.2)));
    shade(.8 + .2 * lm, lm);
    // inner ears
    for (const [a0, b0, T, sd] of earPts) {
      const P1 = [a0[0] + (T[0] - a0[0]) * .24 + (b0[0] - a0[0]) * .2, a0[1] + (T[1] - a0[1]) * .24 + (b0[1] - a0[1]) * .2], P2 = [b0[0] + (T[0] - b0[0]) * .24 + (a0[0] - b0[0]) * .2, b0[1] + (T[1] - b0[1]) * .24 + (a0[1] - b0[1]) * .2], P3 = [T[0] + ((a0[0] + b0[0]) / 2 - T[0]) * .3, T[1] + ((a0[1] + b0[1]) / 2 - T[1]) * .3];
      const bx = Math.min(P1[0], P2[0], P3[0]), ex2 = Math.max(P1[0], P2[0], P3[0]), by2 = Math.min(P1[1], P2[1], P3[1]), ey2 = Math.max(P1[1], P2[1], P3[1]);
      for (let ly = Math.floor(by2) - 1; ly <= ey2 + 1; ly++) for (let lx = Math.floor(bx) - 1; lx <= ex2 + 1; lx++) {
        const [i, j] = toPx(lx, ly); const id = lbAt(i, j); if (id !== ID.ear && id !== ID.ear2) continue;
        if (!inTri(lx + .5 * 0, ly, P1, P2, P3)) continue;
        const k = (ey2 - ly) / Math.max(1, ey2 - by2); putPx(i, j, k > .62 && bay(i, j) > .4 ? C.earIn2 : C.earIn);
      }
    }
    // face
    const sleepy = sl, lid = clamp(Math.max(K.lid, K.blinkT >= 0 ? Math.sin(clamp(K.blinkT / .16, 0, 1) * Math.PI) : 0), 0, 1), happy = K.happyUntil > now();
    const muzzle = (sd) => { const c = hw(sd * 2.9, -4.7); for (let ly = c[1] - 3; ly <= c[1] + 3; ly++) for (let lx = c[0] - 4; lx <= c[0] + 4; lx++) { if (((lx - c[0]) / 3.3) ** 2 + ((ly - c[1]) / 2.5) ** 2 > 1) continue; const [i, j] = toPx(lx, ly); if (lbAt(i, j) === ID.head) putPx(i, j, C.inner); } };
    muzzle(-1); muzzle(1);
    for (const sd of [-1, 1]) { // blush
      const c = hw(sd * 8.6, -2.2), [i, j] = toPx(c[0], c[1]); for (let dj = 0; dj < 2; dj++) for (let di = -1; di <= 1; di++) putPx(i + di, j + dj, C.blush, 120 + 70 * sleepy);
    }
    const lookPx = [Math.round(K.lookX * 1.1), Math.round(K.lookY * .6)];
    for (const sd of [-1, 1]) {
      const c = hw(sd * 5.5, .6), [ci, cj] = toPx(c[0], c[1]), i0 = ci - 3, j0 = cj - 2, n = Math.round(lid * 5);
      K.eyeRow = j0;
      const gl = K.ang > .4, hr = q => gl ? (sd < 0 ? q : 5 - q) * .5 - .2 : -1; // glaring: the lid slopes down toward the nose (rows above hr(q) are hidden)
      if (happy && !gl && (n < 3 || K.tau > .6)) { for (const [di, dj] of [[0, 3], [1, 2], [2, 2], [3, 2], [4, 2], [5, 3]]) putPx(i0 + di, j0 + dj - 1, C.eyeL); continue; } // happy squint ∩∩ (also while asleep: he stays curled, only the face smiles)
      if (n >= 4) { for (const [di, dj] of [[0, 2], [5, 2], [1, 3], [2, 3], [3, 3], [4, 3]]) putPx(i0 + di, j0 + dj, C.catRL); if (n >= 5) putPx(i0 + (sd < 0 ? -1 : 6), j0 + 3, C.catRd); continue; }
      for (let r = n; r < 5; r++) for (let q = 0; q < 6; q++) {
        const ch = EYE_OPEN[r][q]; if (ch === '.' || r < hr(q)) continue;
        putPx(i0 + q, j0 + r, ch === 'd' ? C.eyeD : ch === 'e' ? C.eye : C.eyeL);
      }
      // pupil (2x3) with a glint; the lid hides what it covers
      const px0 = i0 + 2 + clamp(lookPx[0], -1, 1), py0 = j0 + 1 + clamp(lookPx[1], 0, 1);
      for (let r = 0; r < 3; r++) for (let q = 0; q < 2; q++) if (py0 + r >= j0 + n && py0 + r - j0 >= hr(px0 + q - i0)) putPx(px0 + q, py0 + r, C.pupil);
      if (py0 >= j0 + n && py0 - j0 >= hr(px0 - i0)) putPx(px0, py0, C.glint); putPx(i0 + 4, j0 + 3, C.eyeL);
      if (n > 0) for (let q = 1; q < 5; q++) putPx(i0 + q, j0 + n - 1, C.catRL, 230); // the lid's edge
      if (gl) for (let q = 0; q < 6; q++) { const r0 = Math.ceil(hr(q)); if (r0 > 0) putPx(i0 + q, j0 + r0 - 1, C.catRL, 230); } // the angry brow line
    }
    { // nose, mouth and the forehead crescent
      const nc = hw(0, -3.1), [ni, nj] = toPx(nc[0], nc[1]); putPx(ni - 1, nj, C.nose); putPx(ni, nj, C.nose); putPx(ni + 1, nj, C.nose); putPx(ni, nj + 1, C.nose);
      for (const [di, dj] of [[-1, 2], [-2, 3], [1, 2], [2, 3]]) putPx(ni + di, nj + dj, C.catR, 230);
      if (happy) for (const [di, dj] of [[-1, 3], [0, 3], [1, 3]]) putPx(ni + di, nj + dj, C.catR, 200);
      if (K.yawn > .25) { const w = K.yawn > .7 ? 2 : 1; for (let dj = 2; dj <= 3 + (K.yawn > .7 ? 1 : 0); dj++) for (let di = -w; di <= w; di++) putPx(ni + di, nj + dj, dj === 2 ? C.pinkD : C.blush); } // a yawn
      const cc = hw(0, 7.4), [ci, cj] = toPx(cc[0], cc[1]); putPx(ci, cj, C.gold); putPx(ci - 1, cj + 1, C.gold2); putPx(ci + 1, cj + 1, C.gold2); putPx(ci - 2, cj + 2, C.gold2, 200); putPx(ci + 2, cj + 2, C.gold2, 200);
    }
    // whiskers: a little longer than before, drooping while he sleeps
    for (const sd of [-1, 1]) for (const [ang, len] of [[.2, 8], [0, 8.5], [-.24, 7]]) for (let q = 1; q <= len; q++) {
      const u = 9.4 + q, v = -3.6 + (ang * q * 1 + (-.12 - .12 * bB) * q * .5) * 1.0 + K.dream * Math.sin(t * 6 + q * .3 + sd) * .35, w = hw(sd * u, v), [i, j] = toPx(w[0], w[1]);
      if (!lbAt(i, j)) putPx(i, j, C.catR, 190 - q * 15);
    }
    // charm on the collar
    { const cc = hw(0, -9.6), [i, j] = toPx(A(0, hx, bHy * .6), cc[1] - 1 - A(0, 1, bB)); putPx(i, j, C.gold); putPx(i, j + 1, C.gold2); putPx(i - 1, j, C.glint, 190); }
    K.headC = [CAT.OX + hx, CAT.OY - hy]; K.headBot = toPx(hx, hy)[1] + 11;
  }
  function drawCat(lit, alpha = 1) {
    for (let j = 0; j < CAT.LH; j++) for (let i = 0; i < CAT.LW; i++) { const k = (j * CAT.LW + i) * 4; if (SP[k + 3]) set(lit, CAT.X0 + i, CAT.Y0 + j, [SP[k], SP[k + 1], SP[k + 2]]); }
  }

  /* ---------------- the cat's brain: sit, glance around, blink, then settle into the bed (one clock: K.tau, 0 = up, 1 = curled) ---------------- */
  function say(key, dy) { const w = S.api.words && S.api.words(key); if (w) S.api.say(w, {x: clamp(K.headC[0], 18, 102) / W, y: (K.headC[1] - (dy || 16)) / H}); }
  function hearts() { for (let i = 0; i < 3; i++) S.parts.push({x: K.headC[0] - 4 + i * 4, y: K.headC[1] - 12, vx: (i - 1) * 3, vy: -12, life: 1.3, t: -i * .14, c: C.pink, kind: 'heart'}); }
  function updateCat(dt, t) {
    const n = now();
    if (S.sleepAt && n >= S.sleepAt && S.state === 'open') { S.sleepAt = 0; K.goal = 1; say('bed_settle'); }
    // the settle clock: it takes about 3.2 s to curl up and 2.2 s to sit back up; every part of the pose is a smooth function of it
    const sp = K.goal > K.tau ? 1 / 4.4 : 1 / 3;
    const tau0 = K.tau;
    K.tau = K.goal > K.tau ? Math.min(K.goal, K.tau + dt * sp) : Math.max(K.goal, K.tau - dt * sp);
    K.dsm += ((K.goal > K.tau || (K.goal === K.tau && K.tau > .5) ? 1 : 0) - K.dsm) * (1 - Math.exp(-dt * 7)); // 1 = settling down, 0 = getting up (smooth, so the two choreographies cross-fade)
    if (tau0 < .985 && K.tau >= .985) { K.sqv -= 3.4; K.exh = 1; } // he lands in the cushion: a soft squash, then a long first sigh
    if (tau0 > .03 && K.tau <= .03) { K.sqv += 1.8; K.shake = 1; K.tw1 = 1; K.tw2 = 1; } // he is up again: a quick shake of the head
    K.sqv += (-85 * K.sqx - 6.5 * K.sqv) * dt; K.sqx += K.sqv * dt; // spring (a couple of soft wobbles)
    K.exh *= Math.exp(-dt / 2.6); K.shake *= Math.exp(-dt * 3.2);
    // the blanket: taps, drags and the slide itself all move this one number
    if (K.drag) { K.cover += (K.drag.target - K.cover) * (1 - Math.exp(-dt * 22)); K.cvel.v = 0; }
    else { K.cover = clamp(smoothDamp(K.cover, K.coverGoal, K.cvel, K.coverGoal > K.cover ? .42 : .38, dt), 0, 1); if (Math.abs(K.cover - K.coverGoal) < .003 && Math.abs(K.cvel.v) < .02) { K.cover = K.coverGoal; K.cvel.v = 0; } }
    K.ce = Math.min(K.cover, seg(K.tau, .5, .95));
    const pr = K.press; if (pr && !pr.onB && !pr.fired && !pr.cancel && n - pr.t >= 600 && K.goal === 1 && n >= K.sulkUntil && zoneAt(pr.x, pr.y)) { pr.fired = true; wake(n); } // long press on Moon = wake him
    // petting moods ease in and out (never snap): purr, leaning into the hand, half-awake grumpy, glaring
    const ez = (v, on, up, dn) => v + ((on ? 1 : 0) - v) * (1 - Math.exp(-dt * (on ? up : dn)));
    K.purr = ez(K.purr, n < K.purrUntil, 9, 2.2); K.nuz = ez(K.nuz, n < K.nuzUntil, 6, 3);
    K.ann = ez(K.ann, n < K.squintUntil && n >= K.angryUntil, 7, 3); K.ang = ez(K.ang, n < K.angryUntil, 12, 4);
    if (n < K.angryUntil && (K.lashAt -= dt) <= 0) { K.flick = 1.7; K.lashAt = .3; } // the tail lashes
    // sulking: the blanket is pulled up over his eyes (only once it is fully over his back), and comes down again when he has calmed down
    if (K.sulkOn && n >= K.sulkUntil) { K.sulkOn = false; K.taps = []; K.peek = .8; K.tw1 = 1; K.tw2 = 1; say('bed_forgive'); }
    const hg = 0; // the blanket never goes over his face: only two states, off or on his back
     K.hide = clamp(smoothDamp(K.hide, hg, K.hvel, hg ? .9 : 1.1, dt), 0, 1); if (!hg && K.hide < .004 && Math.abs(K.hvel.v) < .02) { K.hide = 0; K.hvel.v = 0; }
    if (!K.drag && K.cover === K.coverGoal && K.said !== K.coverGoal) { // it has arrived: Moon says something
      const was = K.said; K.said = K.coverGoal;
      if (K.coverGoal === 1) say('bed_blanket_on'); else if (K.coverGoal === .5) say('bed_blanket_half');
      else { say('bed_blanket_off'); if (was > 0) { K.peek = 1; K.tw1 = 1; K.tw2 = 1; K.flick = 1; } }
    }
    K.peek = Math.max(0, K.peek - dt / 2.4);
    K.bph += dt * 2 * Math.PI / (lerp(3.4, 4.6, seg(K.tau, 0, .74)) * (1 + .45 * K.ce)); // slower, deeper breathing the more he is tucked in
    K.lid = (.55 * seg(K.tau, .1, .5) + .45 * seg(K.tau, .5, .85)) * (1 - .75 * sstep(K.peek * 1.6));
    K.yawn = ez(K.yawn, n < K.yawnUntil, 5, 3); K.lid = lerp(lerp(lerp(K.lid, .6, K.ann), 0, K.ang), 1, K.yawn * .9); // annoyed: eyes half open; cross: wide open
    // blinking, glancing (only while he is still awake enough)
    const awake = 1 - seg(K.tau, .2, .6);
    if (K.blinkT >= 0) { K.blinkT += dt; if (K.blinkT > .16) K.blinkT = -1; }
    else if ((K.blinkAt -= dt) <= 0) { K.blinkT = 0; K.blinkAt = 2 + Math.random() * 3.2 + (1 - awake) * 3; }
    if ((K.lookAt -= dt) <= 0) { const r = Math.random(); K.lookTX = r < .5 ? 0 : r < .8 ? 1 : -.8; K.lookTY = r < .5 ? 0 : r < .8 ? -1 : 1; K.lookAt = 1.8 + Math.random() * 3; }
    const lk = 1 - Math.exp(-dt * 6); K.lookX += (K.lookTX * awake - K.lookX) * lk; K.lookY += (K.lookTY * awake - K.lookY) * lk;
    // ears and tail
    K.tw1 *= Math.exp(-dt * 9); K.tw2 *= Math.exp(-dt * 9); K.flick *= Math.exp(-dt * 3);
    if ((K.twAt -= dt) <= 0) { if (Math.random() < .5) K.tw1 = 1; else K.tw2 = 1; K.twAt = 3 + Math.random() * 6; }
    if ((K.flickAt -= dt) <= 0) { K.flick = 1; K.flickAt = 5 + Math.random() * 8; }
    // dreaming: every 20-40 s, once he is deeply asleep, a few seconds of twitching ears, a wagging tail, paddling paws, moving whiskers (and maybe a mumble)
    const calmSleep = K.goal === 1 && K.tau > .97 && !K.sulkOn && n >= K.angryUntil && K.purr < .1;
    if (calmSleep && !K.dreamOn && (K.dreamAt -= dt) <= 0) { K.dreamOn = true; K.dreamUntil = n + 4000 + Math.random() * 2500; K.dreamBeat = 0; K.dreamTalk = Math.random() < .5 ? n + 1400 + Math.random() * 1500 : 0; }
    if (K.dreamOn && (!calmSleep || n >= K.dreamUntil)) { K.dreamOn = false; K.dreamAt = 20 + Math.random() * 20; K.dreamTalk = 0; }
    K.dream = ez(K.dream, K.dreamOn, 2.5, 2);
    if (K.dreamOn) {
      if ((K.dreamBeat -= dt) <= 0) { if (Math.random() < .5) K.tw1 = 1; else K.tw2 = 1; if (Math.random() < .6) K.flick = Math.max(K.flick, .8); K.dreamBeat = .7 + Math.random() * .8; }
      if (K.dreamTalk && n >= K.dreamTalk) { K.dreamTalk = 0; say('bed_dream'); }
    }
    // sleepy z's
    if (K.tau > .97 && (K.zAt -= dt) <= 0) { S.parts.push({x: K.headC[0] + 8, y: K.headC[1] - 8, vx: 3.2, vy: -5.5, life: 3.2, t: 0, c: C.moon1, kind: 'z'}); K.zAt = (2.2 + Math.random() * 1.2) * (1 + .6 * K.ce); }
  }


  /* ---------------- the blanket over Moon: the cloth hugs his body (so it rises and falls with his breathing), its edge leads the way ---------------- */
  const DIL = []; for (let dy = -3; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5.8 || (dy === -3 && Math.abs(dx) <= 1)) DIL.push([dx, dy]);
  function edgeX(ys, ce) { return lerp(L.cx + 40, L.cx - 3.5, ce) - (ys - (CAT.OY - 8)) * .4 + Math.sin(ys * .55) * .9; } // the leading edge leans: the front corner goes first
  function drawBlanket(lit, lm) {
    CM.fill(0); const ce = K.ce; if (ce < .008) return;
    const LW = CAT.LW, LH = CAT.LH, top = new Int16Array(LW).fill(-1);
    const hid = K.hide, hsh = hid * 30, cut = lerp(K.headBot + 1, K.eyeRow - 1, hid); // hid > 0: the cloth also climbs over his face, up to just above the eyes (ears stay out)
    for (let j = 0; j < LH; j++) {
      const ys = CAT.Y0 + j + .5; for (let i = 0; i < LW; i++) {
        const id = LB[j * LW + i], isHead = id === ID.head || id === ID.ear || id === ID.ear2;
        if (isHead && !(hid > .01 && id === ID.head && j >= cut + Math.sin(i * .55) * .7)) continue;
        if (CAT.X0 + i + .5 < edgeX(ys, ce) - hsh) continue;
        let hit = isHead; if (!hit) for (let q = 0; q < DIL.length; q++) { const ii = i + DIL[q][0], jj = j + DIL[q][1]; if (ii >= 0 && jj >= 0 && ii < LW && jj < LH && (LB[jj * LW + ii] === ID.body || LB[jj * LW + ii] === ID.tail)) { hit = true; break; } }
        if (hit) { CM[j * LW + i] = 1; if (top[i] < 0) top[i] = j; }
      }
    }
    const jLim = Math.min(LH - 1, CAT.OY + 8 - CAT.Y0); // the skirt: cloth runs down to the rim, where the hanging part takes over
    for (let i = 0; i < LW; i++) { if (top[i] < 0) continue; let jb = -1; for (let j = jLim; j >= 0; j--) if (CM[j * LW + i]) { jb = j; break; } for (let j = jb + 1; j <= jLim && jb >= 0; j++) CM[j * LW + i] = 1; }
    // a soft shadow where the cloth lifts off his fur
    for (let j = 0; j < LH; j++) for (let i = 0; i < LW - 3; i++) if (!CM[j * LW + i] && LB[j * LW + i] && (CM[j * LW + i + 1] || CM[j * LW + i + 2]) && LB[j * LW + i] !== ID.head) set(lit, CAT.X0 + i, CAT.Y0 + j, [6, 5, 22], 120);
    for (let j = 0; j < LH; j++) for (let i = 0; i < LW; i++) {
      if (!CM[j * LW + i]) continue;
      const xs = CAT.X0 + i, ys = CAT.Y0 + j, g = xs + .5 - edgeX(ys + .5, ce) + hsh, d = j - top[i];
      const knit = (xs + ys) & 1;
      let c = plaidCol(g + 1.6 * Math.sin(ys * .16 + g * .05), ys + 1.3 * Math.sin(g * .2 + xs * .05)), k = .92 - Math.min(.3, d * .035) + .09 * Math.sin(xs * .42 + ys * .22) - (knit ? .05 : 0); // soft folds; the weave shows as a fine checker
      if (g < 1.4) { c = C.plLd; k = .95; } else if (g < 2.4) { k = 1.02; } // the rolled leading edge, bound with a thin cream hem
      else if (((xs * .8 + ys * .7) % 11) < 1 && g > 5) k *= .84; // creases
      const edge = !CM[j * LW + i - 1] || !CM[j * LW + i + 1] || !CM[(j - 1) * LW + i] || !CM[(j + 1) * LW + i];
      if (d < 1) k = 1.2; else if (edge) k *= .74;
      const p = ys * W + xs, f = S.LFoff[p] + (S.LFon[p] - S.LFoff[p]) * lm, q = p * 3;
      set(lit, xs, ys, [Math.min(255, c[0] * k * f + S.LAoff[q] + (S.LAon[q] - S.LAoff[q]) * lm), Math.min(255, c[1] * k * f + S.LAoff[q + 1] + (S.LAon[q + 1] - S.LAoff[q + 1]) * lm), Math.min(255, c[2] * k * f + S.LAoff[q + 2] + (S.LAon[q + 2] - S.LAoff[q + 2]) * lm)]);
    }
  }

  /* ---------------- one frame ---------------- */
  function drawFrame(t, dt) {
    dt = dt || 1 / FPS; const lm = S.api.lampMix ? S.api.lampMix() : 1, b = S.out0; b.set(S.base);
    const music = !!(S.api.music && S.api.music());
    applyDrape(b);
    drawCurtains(b, t); drawLampShade(b, t, lm); drawHanging(b, t); drawGramophone(b); drawGramophoneLive(b, t, music, dt); // drawn live, after the curtains: it stands in front of the wall and the curtain
    const lit = S.out; applyLight(b, lit, lm);
    drawGarland(lit, t, lm); drawGlows(lit, t, lm);
    // Moon's soft weight pressing into the cushion
    const bB = seg(K.tau, 0, .74), sx = L.cx + lerp(0, 2, bB), sy = L.by + 3, srx = lerp(13, 30, bB), sry = lerp(4, 8, bB);
    for (const [g, a] of [[4, 40], [2, 70], [0, 100]]) ell(lit, sx, sy, srx + g, sry + g * .4, [10, 8, 30], a);
    renderCat(t, lm); drawCat(lit); drawBlanket(lit, lm);
    applyLight(S.fg, S.fgLit, lm, true);
    for (let p = 0, n = W * H; p < n; p++) if (S.fg[p * 4 + 3]) { const i = p * 4; lit[i] = S.fgLit[i]; lit[i + 1] = S.fgLit[i + 1]; lit[i + 2] = S.fgLit[i + 2]; }
    drawBeam(lit, t, lm);
    if (music && t - S.noteAt > 1.7) { S.noteAt = t; const hx = GR.X(20.5), hy = GR.Y(54.5); S.parts.push({x: hx - 1 + (Math.random() - .5) * 8, y: hy - 6, vx: -3.5 - Math.random() * 4, vy: -8 - Math.random() * 4, life: 3.2, t: 0, c: C.page2, kind: 'note', ph: Math.random() * 6}); }
    S.parts = S.parts.filter(q => (q.t += dt) < q.life);
    for (const q of S.parts) {
      if (q.t < 0) continue; q.x += q.vx * dt; q.y += q.vy * dt; const a = 255 * Math.min(1, (q.life - q.t) / 1.2) * Math.min(1, q.t * 3 + .2);
      if (q.kind === 'note') { const nx = q.x + Math.sin(q.t * 2 + q.ph) * 2; [[2, 0], [3, 0], [2, 1], [2, 2], [1, 3], [0, 3], [1, 4], [0, 4], [2, 3]].forEach(([i, j]) => set(lit, nx + i, q.y + j, q.c, a * .8)); }
      else if (q.kind === 'z') { const zx = q.x + Math.sin(q.t * 1.6) * 1.6, big = q.t > 1.2; [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]].forEach(([i, j]) => { set(lit, zx + i, q.y + j, q.c, a * .85); if (big) set(lit, zx + i + 1, q.y + j, q.c, a * .3); }); }
      else if (q.kind === 'anger') { const s = 1 + (Math.sin(q.t * 11) > 0 ? 1 : 0), cx = q.x + 2, cy = q.y + 2; for (const sx of [-1, 1]) for (const sy of [-1, 1]) [[s + 1, s + 1], [s, s + 1], [s + 1, s]].forEach(([i, j]) => set(lit, cx + sx * i, cy + sy * j, C.anger, a)); } // the little anger mark: four corners that pulse
      else if (q.kind === 'heart') [[0, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [1, 3]].forEach(([i, j]) => set(lit, q.x + i, q.y + j, q.c, a));
    }
    S.ctx.putImageData(new ImageData(lit, W, H), 0, 0);
  }

  /* ---------------- camera: a slow push-in from the room toward the bed (the bed in the room becomes the bed in the scene) ---------------- */
  function applyCam(e) { // e: 0 = the room, 1 = the bed
    const g = S.api.geom(), cw = S.cv.clientWidth, ch = S.cv.clientHeight; if (!cw) return;
    const px = g.bed.x / g.W * cw, py = (g.bed.y + g.OY) / g.H * ch; // the bed in the room (screen px)
    const tx = L.cx / W * cw, ty = L.by / H * ch, Z = L.ex / 22 * ((g.W || 120) / W), s = Math.exp(Math.log(Z) * e); // where the bed ends up, and how much bigger it gets
    const rx = lerp(px, tx, e), ry = lerp(py, ty, e);
    S.api.room.style.transformOrigin = '0 0'; S.api.room.style.transform = `translate(${(rx - s * px).toFixed(1)}px,${(ry - s * py).toFixed(1)}px) scale(${s.toFixed(4)})`;
    const k = s / Z; // the scene starts at the size of the room's bed and grows with it, so the two line up while they cross-fade
    S.cv.style.transformOrigin = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`; S.cv.style.transform = `translate(${(rx - tx).toFixed(1)}px,${(ry - ty).toFixed(1)}px) scale(${k.toFixed(4)})`;
    S.cv.style.opacity = sstep((e - .42) / .42).toFixed(3); S.api.room.style.opacity = e < .5 ? 1 : (1 - sstep((e - .5) / .38)).toFixed(3);
    if (S.api.vig) S.api.vig.style.opacity = (Math.sin(Math.min(1, e) * Math.PI) * .7).toFixed(3);
  }
  function loop() {
    if (S.state === 'closed') { S.raf = 0; return; }
    S.raf = requestAnimationFrame(loop);
    const n = now(), t = n / 1000;
    if (S.state === 'opening' || S.state === 'closing') {
      const dur = S.state === 'opening' ? 1250 : 900, u = clamp((n - S.t0) / dur, 0, 1), e = eio(S.state === 'opening' ? u : 1 - u);
      applyCam(e);
      if (u >= 1) { if (S.state === 'opening') { S.state = 'open'; ready(); } else finishClose(); }
      if (S.state === 'closed') return;
    }
    // frame pacing: 30 fps normally; 20 while he sleeps; 20 or 15 for good if this phone keeps taking too long per frame
    const calm = K.tau > .97 && K.goal === 1 && !K.drag && Math.abs(K.cover - K.coverGoal) < .003, fps = Math.min(S.fps, calm ? 20 : 30);
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
  function ready() { S.cv.style.opacity = 1; S.cv.style.transform = 'none'; S.api.room.style.opacity = 0; S.api.vig && (S.api.vig.style.opacity = 0); S.api.back.hidden = false; if (K.goal !== 1) S.sleepAt = now() + 1400; }

  /* ---------------- input: pet Moon (he stays asleep), tug the blanket (taps elsewhere do nothing) ---------------- */
  const SPAN = 43.5; // how far the leading edge travels (scene px) from open to fully over his back
  function onBlanket(px, py) {
    const cx = L.cx, by = L.by;
    if (px >= cx + 5 && px <= cx + 40 && py >= by + 1 && py <= by + L.ey + lerp(L.th, 2, K.ce) + 8) return true; // the part hanging over the rim (it shrinks as the blanket is pulled over Moon)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = Math.floor(px) - CAT.X0 + dx, j = Math.floor(py) - CAT.Y0 + dy; if (i >= 0 && j >= 0 && i < CAT.LW && j < CAT.LH && CM[j * CAT.LW + i]) return true; }
    return false;
  }
  /* ---- petting: where the finger lands decides the reaction. Petting never wakes him: he stays curled, only his face, ears, tail and purr answer ---- */
  function zoneAt(px, py) { // reads the label buffer of the frame on screen: ears / head / cheek / back / belly / tail / paw (null = the finger missed him)
    const ci = Math.floor(px) - CAT.X0, cj = Math.floor(py) - CAT.Y0; let best = 0, bd = 99, bj = 0;
    for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
      const i = ci + di, j = cj + dj, id = lbAt(i, j); if (!id) continue;
      const sx = CAT.X0 + i, sy = CAT.Y0 + j; if (sx >= 0 && sx < W && sy >= 0 && sy < H && S.fg[(sy * W + sx) * 4 + 3]) continue; // hidden behind the front rim of the bed
      const d = Math.hypot(di, dj) - (id === ID.ear || id === ID.ear2 ? .8 : id === ID.head ? .4 : 0); // small parts are easier to hit
      if (d < bd) { bd = d; best = id; bj = j; }
    }
    if (!best || bd > 2.6) return null;
    if (best === ID.ear || best === ID.ear2) return 'ears';
    if (best === ID.head) return CAT.Y0 + bj + .5 > K.headC[1] + 2.5 ? 'cheek' : 'head';
    if (best === ID.collar) return 'cheek';
    if (best === ID.tail) return 'tail';
    if (best === ID.paw) return 'paw';
    let j0 = 99, j1 = -1; for (let j = 0; j < CAT.LH; j++) for (let i = 0; i < CAT.LW; i++) if (LB[j * CAT.LW + i] === ID.body) { if (j < j0) j0 = j; j1 = j; }
    return bj > j0 + (j1 - j0) * .62 ? 'belly' : 'back'; // the lower, front part of the body is the belly
  }
  function pet(z, n) {
    const asleep = K.goal === 1;
    K.happyUntil = n + (z === 'ears' || z === 'tail' ? 900 : 1700);
    if (z === 'ears') { K.tw1 = 1; K.tw2 = 1; }
    else if (z === 'tail') { K.flick = 1.3; K.tw1 = 1; }
    else if (z === 'belly') { K.flick = 1; K.tw2 = 1; K.purrUntil = n + 1200; }
    else if (z === 'paw') { K.tw1 = .8; hearts(); }
    else { K.purrUntil = n + (z === 'cheek' ? 3000 : 2400); if (z !== 'back') hearts(); if (z === 'cheek') K.nuzUntil = n + 1900; if (z === 'head') K.tw1 = .7; }
    if (!asleep) S.sleepAt = n + 1300; // if he was still sitting up, he curls up after a moment
    const talk = asleep && (z === 'head' || z === 'cheek' || z === 'back') && Math.random() < .28;
    say(talk ? 'bed_sleeptalk' : z === 'head' ? 'bed_pet' : 'bed_pet_' + z);
  }
  function tapAt(px, py) { // Moon himself
    if (S.state !== 'open') return;
    const n = now(), z = zoneAt(px, py); if (!z) return; // a tap beside him does nothing
    if (n < K.sulkUntil) { K.flick = 1; say('bed_sulk_poke'); return; } // sulking: he does not want to be touched
    K.taps = K.taps.filter(t => n - t < 3200).concat(n);
    if (z === 'belly') K.taps.push(n); // the belly counts double
    if (n < K.angryUntil) { // still cross and touched again: the blanket goes over his eyes
      K.angryUntil = 0; K.taps = []; K.sulkOn = true; K.sulkUntil = n + 7500; K.coverGoal = 1; K.said = 1; K.goal = 1; S.sleepAt = 0; K.drag = null; K.happyUntil = 0; K.purrUntil = 0; K.squintUntil = 0; say('bed_sulk'); return;
    }
    if (K.taps.length >= 5) { K.taps = []; K.angryUntil = n + 2800; K.lashAt = 0; K.happyUntil = 0; K.purrUntil = 0; K.squintUntil = 0; K.nuzUntil = 0; S.parts.push({x: K.headC[0] + 9, y: K.headC[1] - 15, vx: 0, vy: -1.2, life: 2.6, t: 0, c: C.anger, kind: 'anger'}); say('bed_angry'); return; }
    if (K.taps.length === 4) { K.squintUntil = n + 1600; K.happyUntil = 0; K.purrUntil = 0; K.tw1 = 1; K.tw2 = 1; K.flick = 1; say('bed_annoyed'); return; }
    pet(z, n);
  }
  function wake(n) { // a long press on Moon wakes him: a yawn, a stretch (he sits up, the blanket slides off), then he curls up again by himself
    K.goal = 0; K.dreamOn = false; K.dreamAt = 20 + Math.random() * 20; K.yawnUntil = n + 1800; K.tw1 = 1; K.tw2 = 1; K.happyUntil = 0; K.purrUntil = 0; K.taps = [];
    if (K.cover > .05) { K.peek = .7; K.said = 0; K.coverGoal = 0; }
    S.sleepAt = n + 7000; say('bed_wake');
  }
  function down(px, py) { if (S.state === 'open') K.press = {x: px, y: py, onB: now() >= K.sulkUntil && onBlanket(px, py), t: now(), fired: false, moved: false, c0: K.coverGoal, last: px, vx: 0}; }
  function move(px, py) { // dragging the blanket: the cloth follows the finger one to one
    const p = K.press; if (p && !p.onB && Math.hypot(px - p.x, py - p.y) > 4) p.cancel = true; // a finger that slides off Moon is not a long press
    if (!p || !p.onB) return;
    // no dragging any more: the blanket is only ever tapped (a finger that slides about on it does nothing)
  }
  function up(px, py) {
    const p = K.press; K.press = null; if (!p) return;
    if (p.fired) return; // the press already woke him
    if (p.onB && Math.hypot(px - p.x, py - p.y) > 6) return; // a finger that was dragged over the blanket does nothing
    if (p.onB) { // a plain tap on the blanket: over him, or off again (locked for a moment so quick double taps don't fight the slide)
      if (now() < K.lockUntil) return; K.lockUntil = now() + 350;
      if (K.coverGoal < .5) { K.coverGoal = 1; if (K.goal !== 1) K.goal = 1; S.sleepAt = 0; } else K.coverGoal = 0; // he wears it at once
    } else tapAt(px, py);
  }
  function ev(e) { const r = S.cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }

  /* ---------------- build / open / close ---------------- */
  function build() {
    const box = S.api.box, w = box.clientWidth, h = box.clientHeight;
    const nh = w && h ? clamp(Math.round(W * h / w), 168, 270) : 200;
    if (S.built && nh === H) return;
    H = nh; S.cv.width = W; S.cv.height = H; layout();
    CAT.OX = L.cx; CAT.OY = L.by + 2; CAT.X0 = L.cx - 50; CAT.Y0 = L.by - 64;
    S.base = buf(); S.fg = buf(); S.fg0 = buf(); S.fgLit = buf(); S.out0 = buf(); S.out = buf();
    drawScene(S.base, S.fg0); S.fg.set(S.fg0); bakeDrapes(); bakeLight();
    S.flame = {x: L.deco.cx, y: L.deco.sy - 11}; // the flame of the candle on the wall shelf (drawn live)
    S.built = true;
  }
  function open() {
    if (S.state !== 'closed') return;
    build();
    const wasAsleep = !!(S.api.asleep && S.api.asleep()), wasCovered = wasAsleep && !!(S.api.covered && S.api.covered()); // read before hold(true): if he was curled up in the bed in the room, the close-up starts with him asleep
    S.state = 'opening'; S.t0 = now(); S.lastF = -1; S.sleepAt = 0; S.parts = []; S.noteAt = -9; S.cost = 0;
    Object.assign(K, {tau: wasAsleep ? 1 : 0, goal: wasAsleep ? 1 : 0, lid: 0, blinkT: -1, blinkAt: 2, lookX: 0, lookY: 0, lookTX: 0, lookTY: 0, lookAt: 2.5, tw1: 0, tw2: 0, flick: 0, zAt: 1.5, happyUntil: 0, bph: 0, ce: 0, cover: wasCovered ? 1 : 0, coverGoal: wasCovered ? 1 : 0, cvel: {v: 0}, peek: 0, drag: null, press: null, lockUntil: 0, said: wasCovered ? 1 : 0, taps: [], angryUntil: 0, sulkUntil: 0, sulkOn: false, squintUntil: 0, purrUntil: 0, nuzUntil: 0, purr: 0, nuz: 0, ann: 0, ang: 0, hide: 0, hvel: {v: 0}, lashAt: 0, dream: 0, dreamOn: false, dreamUntil: 0, dreamAt: 22, dreamBeat: 0, dreamTalk: 0, yawn: 0, yawnUntil: 0, dsm: wasAsleep ? 1 : 0, sqx: 0, sqv: 0, exh: 0, shake: 0});
    S.api.hold(true); S.cv.hidden = false; S.cv.style.opacity = 0; S.api.back.hidden = true;
    updateCat(1 / FPS, now() / 1000); drawFrame(now() / 1000, 1 / FPS); applyCam(0);
    if (!wasAsleep) setTimeout(() => S.state === 'open' && say('bed_in'), 1450);
    if (!S.raf) S.raf = requestAnimationFrame(loop);
  }
  function close(instant) {
    if (S.state === 'closed' || S.state === 'closing') return;
    S.api.back.hidden = true; S.sleepAt = 0;
    if (instant) { finishClose(true); return; }
    S.state = 'closing'; S.t0 = now(); S.cv.style.transform = 'none';
  }
  function finishClose() {
    S.state = 'closed'; S.cv.hidden = true; S.cv.style.opacity = 0; S.cv.style.transform = ''; S.cv.style.transformOrigin = '';
    S.api.room.style.transform = ''; S.api.room.style.opacity = ''; S.api.room.style.transformOrigin = ''; S.api.vig && (S.api.vig.style.opacity = 0);
    S.api.hold(false, K.tau > .5, K.cover > .5 && K.coverGoal === 1); S.api.onClose && S.api.onClose();
  }
  window.Bed = {
    attach(api) { S.api = api; S.cv = api.cv; S.ctx = S.cv.getContext('2d'); S.cv.hidden = true; S.cv.addEventListener('pointerdown', e => { try { S.cv.setPointerCapture(e.pointerId); } catch (_) {} down(...ev(e)); });
      S.cv.addEventListener('pointermove', e => { if (K.press) move(...ev(e)); });
      S.cv.addEventListener('pointerup', e => up(...ev(e)));
      S.cv.addEventListener('pointercancel', () => { K.press = null; }); api.back.addEventListener('click', () => close()); },
    open, close, isOpen: () => S.state !== 'closed',
    _sim: {build, step(dt, t) { updateCat(dt, t); drawFrame(t, dt); }, tap: tapAt, down, move, up, init(h) { S.state = 'open'; S.built = false; if (h) S.api.box = {clientWidth: 360, clientHeight: Math.round(360 * h / W)}; build(); }},
    _S: S, _K: K, _L: L
  };
})();
