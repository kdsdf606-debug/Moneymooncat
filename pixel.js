/* MoonCat pixel kit — stair-corner boxes, 12×12 icons, tiny cat sprites, pixel moons, starry sky.
   Everything is drawn from little text grids so it stays crisp at any size. */
(function () {
  const enc = s => 'url("data:image/svg+xml,' + encodeURIComponent(s) + '")';
  const open = (w, h, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" ${attrs}>`;

  // rows of characters → <rect>s (horizontal runs merged). map: char → fill | {fill, cls}
  function rects(rows, map) {
    let out = '';
    rows.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        const ch = row[x], m = map[ch];
        if (!m) { x++; continue; }
        let x2 = x; while (x2 < row.length && row[x2] === ch) x2++;
        const fill = typeof m === 'string' ? m : m.fill, cls = typeof m === 'string' ? '' : ` class="${m.cls}"`;
        out += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${fill}"${cls}/>`;
        x = x2;
      }
    });
    return out;
  }

  /* ---------- boxes: 9×9 nine-slice with stair corners; T = moonlit top edge, E = other edges, F = fill ---------- */
  const BOX = ['..TTTTT..', '.TFFFFFT.', 'EFFFFFFFE', 'EFFFFFFFE', 'EFFFFFFFE', 'EFFFFFFFE', 'EFFFFFFFE', '.EFFFFFE.', '..EEEEE..'];
  const box = (F, E, T) => enc(open(9, 9, 'width="9" height="9"') + rects(BOX, { F, E, T: T || E }) + '</svg>');
  const BOXES = {
    card:  ['#0d1430', '#1b2752', '#2f4183'],
    card2: ['#16245a', '#2c3d78', '#5269bd'],
    field: ['#070b1e', '#1b2752', '#141d42'],
    chip:  ['#0a1029', '#1b2752', '#243469'],
    gold:  ['#ffd36a', '#d9a23a', '#fff1b8'],
    moon:  ['#c4e6fb', '#8fb9dc', '#eefaff'],
    frame: ['#070b1e', '#2c3d78', '#6f6ccc'],
    pink:  ['#0d1430', '#7a4660', '#b0647f']
  };
  const root = document.documentElement.style;
  for (const k in BOXES) root.setProperty('--bx-' + k, box(...BOXES[k]));

  /* ---------- icons: 12×12, drawn in currentColor ---------- */
  const mirror = rows => rows.map(r => [...r].reverse().join(''));
  const ICONS = {
    home: ['.....##.....', '....####....', '...##..##...', '..##....##..', '.##......##.', '##........##', '.#........#.', '.#........#.', '.#..####..#.', '.#..#..#..#.', '.#..#..#..#.', '.####..####.'],
    wallet: ['............', '..########..', '.#........#.', '############', '#..........#', '#......#####', '#......#..##', '#......#####', '#..........#', '#..........#', '############', '............'],
    board: ['............', '.#######....', '.#.....##...', '.#......##..', '.#.####..#..', '.#.......#..', '.#.####..#..', '.#.......#..', '.#.###...#..', '.#.......#..', '.#########..', '............'],
    cat: ['............', '.#........#.', '.##......##.', '.###....###.', '.##########.', '.##########.', '.##.####.##.', '.##.####.##.', '.##########.', '..########..', '...######...', '............'],
    gear: ['.....##.....', '.#..####..#.', '.##########.', '..###..###..', '.###....###.', '###......###', '###......###', '.###....###.', '..###..###..', '.##########.', '.#..####..#.', '.....##.....'],
    music: ['............', '....#######.', '....#######.', '....#.....#.', '....#.....#.', '....#.....#.', '....#.....#.', '..###...###.', '.####..####.', '.####..####.', '..##....##..', '............'],
    chart: ['............', '.........##.', '.........##.', '.....##..##.', '.....##..##.', '.....##..##.', '.##..##..##.', '.##..##..##.', '.##..##..##.', '.##..##..##.', '############', '............'],
    star: ['.....##.....', '.....##.....', '....####....', '############', '.##########.', '..########..', '...######...', '..########..', '..###..###..', '.###....###.', '.##......##.', '............'],
    pin: ['............', '...######...', '....####....', '....####....', '....####....', '..########..', '..########..', '.....##.....', '.....##.....', '.....##.....', '.....#......', '............'],
    note: ['............', '..########..', '..#......#..', '..#.####.#..', '..#......#..', '..#.####.#..', '..#......#..', '..#.###..#..', '..#......#..', '..########..', '............', '............'],
    send: ['............', '......#.....', '.......#....', '........#...', '.##########.', '.##########.', '........#...', '.......#....', '......#.....', '............', '............', '............'],
    right: ['............', '....##......', '.....##.....', '......##....', '.......##...', '........##..', '.......##...', '......##....', '.....##.....', '....##......', '............', '............'],
    moon: ['....#####...', '..####......', '.####.......', '.###........', '####........', '####........', '####........', '.###........', '.####.....#.', '..####..###.', '....######..', '............'],
    check: ['............', '............', '..........#.', '.........##.', '........##..', '.#.....##...', '.##...##....', '..##.##.....', '...###......', '....#.......', '............', '............']
  };
  ICONS.left = mirror(ICONS.right);
  function icon(name, size = 24) {
    const g = ICONS[name]; if (!g) return '';
    return open(12, 12, `class="pxi" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"`) + rects(g, { '#': 'currentColor' }) + '</svg>';
  }

  /* ---------- sprites ---------- */
  const PAL = { K: '#0b0b16', R: '#4a4890', H: '#8f8cf0', E: { fill: '#7fd4ff', cls: 'eye' }, e: '#3b9bd9', G: '#ffd36a' };
  const SIT = {
    w: 13, h: 12,
    base: ['.H.....H.....', 'RKR...RKR....', 'RKKRRRKKR....', 'RKKKKKKKR....', 'RKEKKKEKR....', 'RKKKKKKKR....', '.RKKKKKR.....', 'RKKKKKKKR....', 'RKKKGKKKR....', 'RKKKKKKKR....', 'RKKKKKKKR....', '.RRRRRRR.....'],
    f1: ['', '', '', '', '', '', '', '...........R.', '..........RKR', '.........RKR.', '........KKR..', '........RR...'],
    f2: ['', '', '', '', '', '', '', '', '', '.........RRRR', '........KKKKR', '........RRRR.']
  };
  const PEEK = {
    w: 15, h: 8,
    base: ['...H.......H...', '..RKR.....RKR..', '..RKKRRRRRKKR..', '..RKKKKKKKKKR..', '..RKEKKKKKEKR..', 'RRRKKKKKKKKKRRR', 'RKR.........RKR', 'RRR.........RRR']
  };
  const SLEEP = {
    w: 16, h: 9,
    base: ['..H...H.........', '.RKR.RKR........', '.RKKRKKRRRRRR...', 'RKKKKKKKKKKKKR..', 'RKeeKeeKKKKKKKR.', 'RKKKKKKKKKKKKKKR', 'RKKKKKKKKKKRRRKR', '.RKKKKKKKKRKKKR.', '..RRRRRRRRRRRR..']
  };
  const SPRITES = { sit: SIT, peek: PEEK, sleep: SLEEP };
  function sprite(name, scale = 3) {
    const s = SPRITES[name]; if (!s) return '';
    let body = rects(s.base, PAL);
    if (s.f1) body += `<g class="f1">${rects(s.f1, PAL)}</g><g class="f2">${rects(s.f2, PAL)}</g>`;
    return open(s.w, s.h, `class="sp sp-${name}" width="${s.w * scale}" height="${s.h * scale}" aria-hidden="true"`) + body + '</svg>';
  }
  root.setProperty('--sp-sleep', enc(sprite('sleep')));

  /* ---------- pixel moon: frac 1 = full, 0 = new (a shadow slides across, like the sky above) ---------- */
  function moon(frac, scale = 4, n = 13) {
    frac = Math.max(0, Math.min(1, frac));
    const c = n / 2, r = n / 2, rows = [];
    for (let y = 0; y < n; y++) {
      let row = '';
      for (let x = 0; x < n; x++) {
        const dx = x + 0.5 - c, dy = y + 0.5 - c;
        if (dx * dx + dy * dy > r * r) { row += '.'; continue; }
        const sx = x + 0.5 - (c + frac * 2 * r); // shadow disc centre moves right as the moon fills
        const lit = sx * sx + dy * dy > r * r;
        if (!lit) { row += 'D'; continue; }
        const crater = (x === 3 && y === 4) || (x === 4 && y === 8) || (x === 7 && y === 3) || (x === 8 && y === 9) || (x === 6 && y === 6);
        row += crater ? 'C' : (dx + dy) / r < -0.75 ? 'L' : 'M';
      }
      rows.push(row);
    }
    return open(n, n, `class="pxmoon" width="${n * scale}" height="${n * scale}" aria-hidden="true"`) +
      rects(rows, { M: '#c4e6fb', L: '#eefaff', C: '#9fd0f0', D: '#1a2550' }) + '</svg>';
  }

  /* ---------- starry sky behind every page ---------- */
  function sky(cv) {
    const ctx = cv.getContext('2d'), U = 3, COLS = ['#c4e6fb', '#7fd4ff', '#ffe39a', '#ffffff'];
    let stars = [], w = 0, h = 0, shot = null, nextShot = performance.now() + 9000;
    function seed() {
      w = Math.ceil(innerWidth / U); h = Math.ceil(innerHeight / U);
      cv.width = w; cv.height = h;
      let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      stars = [];
      const n = Math.round(w * h / 330);
      for (let i = 0; i < n; i++) stars.push({ x: (rnd() * w) | 0, y: (rnd() * h) | 0, c: COLS[(rnd() * 4) | 0], a: 0.18 + rnd() * 0.5, per: 3 + rnd() * 6, ph: rnd() * 9, big: rnd() < 0.07 });
    }
    function draw(now) {
      const t = now / 1000;
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        const s = ((t + st.ph) % st.per) / st.per;
        const k = s < 0.62 ? 1 : s < 0.74 ? 0.45 : s < 0.88 ? 0.12 : 0.45;
        ctx.globalAlpha = st.a * k; ctx.fillStyle = st.c;
        ctx.fillRect(st.x, st.y, 1, 1);
        if (st.big && k === 1 && s < 0.3) { ctx.globalAlpha = st.a * 0.5; ctx.fillRect(st.x - 1, st.y, 3, 1); ctx.fillRect(st.x, st.y - 1, 1, 3); }
      }
      if (!shot && now > nextShot) { shot = { x: w * (0.3 + Math.random() * 0.7), y: h * Math.random() * 0.35, at: now }; nextShot = now + 22000 + Math.random() * 26000; }
      if (shot) {
        const u = (now - shot.at) / 800;
        if (u >= 1) shot = null;
        else for (let k = 0; k < 6; k++) {
          const uu = u * 1.2 - k * 0.05; if (uu < 0 || uu > 1) continue;
          ctx.globalAlpha = 0.75 - k * 0.12; ctx.fillStyle = k < 2 ? '#ffffff' : '#9ad8ff';
          ctx.fillRect(Math.round(shot.x - 26 * uu), Math.round(shot.y + 16 * uu), 1, 1);
        }
      }
      ctx.globalAlpha = 1;
    }
    let last = 0;
    function loop(now) { if (!document.hidden && now - last > 90) { last = now; draw(now); } requestAnimationFrame(loop); }
    seed(); addEventListener('resize', seed); requestAnimationFrame(loop);
  }

  /* ---------- numbers that tick to their new value ---------- */
  function count(el, to, fmt) {
    const from = typeof el._v === 'number' ? el._v : to;
    el._v = to; clearInterval(el._ct);
    if (from === to || !el.offsetParent) { el.textContent = fmt(to); return; }
    let i = 0; const N = 9;
    el._ct = setInterval(() => {
      i++;
      el.textContent = fmt(i >= N ? to : from + (to - from) * (1 - Math.pow(1 - i / N, 2)));
      if (i >= N) clearInterval(el._ct);
    }, 45);
  }

  /* fill every <i data-ic="…"> and <i data-sp="…"> placeholder in the page */
  function hydrate(scope = document) {
    scope.querySelectorAll('[data-ic]').forEach(el => { el.innerHTML = icon(el.dataset.ic, +el.dataset.s || 24); });
    scope.querySelectorAll('[data-sp]').forEach(el => { el.innerHTML = sprite(el.dataset.sp, +el.dataset.s || 3); });
  }

  window.PX = { icon, sprite, moon, sky, count, hydrate };
})();
