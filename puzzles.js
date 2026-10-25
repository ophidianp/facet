/* Facet — puzzle models.
 * Sticker-level simulation for every WCA puzzle we preview, plus SVG net
 * renderers. Loaded by the page and by the scramble worker. */
(function (G) {
  'use strict';

  // ---------- small vector helpers ----------
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // Rotate v about unit axis k by angle t (right-handed, radians).
  function rot(v, k, t) {
    const c = Math.cos(t), s = Math.sin(t), kv = cross(k, v), d = dot(k, v) * (1 - c);
    return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d];
  }

  // dest[i] = where sticker i ends up after rotating the selected stickers.
  function stickerPerm(pos, axis, angle, sel) {
    const n = pos.length, dest = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      if (!sel(pos[i])) { dest[i] = i; continue; }
      const r = rot(pos[i], axis, angle);
      let best = -1, bd = Infinity;
      for (let j = 0; j < n; j++) {
        const d = (pos[j][0] - r[0]) ** 2 + (pos[j][1] - r[1]) ** 2 + (pos[j][2] - r[2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      dest[i] = best;
    }
    return dest;
  }

  function permute(colors, dest, times) {
    let c = colors;
    for (let t = 0; t < times; t++) {
      const out = new Array(c.length);
      for (let i = 0; i < c.length; i++) out[dest[i]] = c[i];
      c = out;
    }
    return c;
  }

  const tokens = (alg) => String(alg || '').trim().split(/\s+/).filter(Boolean);

  // WCA colour scheme (white top, green front).
  const CUBE_COLORS = { U: '#f7f7f2', R: '#e2312d', F: '#1fa64a', D: '#f6d21a', L: '#f78a1d', B: '#1f62d6' };

  // ---------- NxNxN cube ----------
  const FACES = 'URFDLB';
  const FN = { U: [0, 1, 0], R: [1, 0, 0], F: [0, 0, 1], D: [0, -1, 0], L: [-1, 0, 0], B: [0, 0, -1] };
  // right / down vectors for each face as drawn in the net
  const FRD = {
    U: [[1, 0, 0], [0, 0, 1]], D: [[1, 0, 0], [0, 0, -1]], F: [[1, 0, 0], [0, -1, 0]],
    B: [[-1, 0, 0], [0, -1, 0]], R: [[0, 0, -1], [0, -1, 0]], L: [[0, 0, 1], [0, -1, 0]],
  };
  const cubeCache = {};

  function makeCube(N) {
    if (cubeCache[N]) return cubeCache[N];
    const pos = [], face = [], rc = [], key = new Map();
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], n = FN[F], [r, d] = FRD[F];
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const a = 2 * j - (N - 1), b = 2 * i - (N - 1);
        const p = [n[0] * N + r[0] * a + d[0] * b, n[1] * N + r[1] * a + d[1] * b, n[2] * N + r[2] * a + d[2] * b];
        key.set(p.join(','), pos.length);
        pos.push(p); face.push(f); rc.push([i, j]);
      }
    }
    const cache = new Map();
    function permFor(F, lo, hi) {
      const k = F + lo + ':' + hi;
      if (cache.has(k)) return cache.get(k);
      const a = FN[F], dest = new Int16Array(pos.length);
      for (let i = 0; i < pos.length; i++) {
        const p = pos[i], s = dot(a, p);
        const layer = s === N ? 1 : s === -N ? N : (N - 1 - s) / 2 + 1;
        if (layer < lo || layer > hi) { dest[i] = i; continue; }
        const c = cross(a, p); // clockwise seen from outside: v' = -(a x v) + a(a.v)
        dest[i] = key.get([-c[0] + a[0] * s, -c[1] + a[1] * s, -c[2] + a[2] * s].join(','));
      }
      cache.set(k, dest);
      return dest;
    }
    function parse(mv) {
      let m = /^([xyz])(2|'|2')?$/.exec(mv);
      if (m) return { F: { x: 'R', y: 'U', z: 'F' }[m[1]], lo: 1, hi: N, amt: amount(m[2]) };
      m = /^(\d*)([URFDLB])(w?)(2'|2|')?$/.exec(mv);
      if (!m) return null;
      const num = m[1] ? +m[1] : 0;
      if (m[3]) return { F: m[2], lo: 1, hi: Math.min(num || 2, N), amt: amount(m[4]) };
      if (num) return { F: m[2], lo: num, hi: num, amt: amount(m[4]) };
      return { F: m[2], lo: 1, hi: 1, amt: amount(m[4]) };
    }
    function solved() { return face.map((f) => FACES[f]); }
    function apply(state, alg) {
      let s = state;
      for (const t of tokens(alg)) {
        const mv = parse(t);
        if (mv) s = permute(s, permFor(mv.F, mv.lo, mv.hi), mv.amt);
      }
      return s;
    }
    return (cubeCache[N] = { N, pos, face, rc, solved, apply, parse });
  }
  function amount(suf) { return suf === "'" ? 3 : suf === '2' || suf === "2'" ? 2 : 1; }

  // ---------- Skewb ----------
  // Moves follow WCA 12h with white top, green front: the layer around
  // U = ULB, R = DRB, L = DFL, B = DBL. UFR never moves.
  let skewbModel = null;
  function makeSkewb() {
    if (skewbModel) return skewbModel;
    const pos = [], face = [], poly = [];
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], n = FN[F], [r, d] = FRD[F];
      pos.push([3 * n[0], 3 * n[1], 3 * n[2]]); face.push(F);
      poly.push([[0, -1], [1, 0], [0, 1], [-1, 0]]);
      for (const [sr, sd] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        pos.push([3 * n[0] + 2 * (r[0] * sr + d[0] * sd), 3 * n[1] + 2 * (r[1] * sr + d[1] * sd), 3 * n[2] + 2 * (r[2] * sr + d[2] * sd)]);
        face.push(F);
        poly.push([[sr, sd], [0, sd], [sr, 0]]);
      }
    }
    const corners = { U: [-1, 1, -1], R: [1, -1, -1], L: [-1, -1, 1], B: [-1, -1, -1] };
    const moves = {};
    for (const k in corners) {
      const c = corners[k];
      moves[k] = stickerPerm(pos, norm(c), -2 * Math.PI / 3, (p) => dot(p, c) > 0);
    }
    function apply(state, alg) {
      let s = state;
      for (const t of tokens(alg)) {
        const m = /^([URLB])('?)$/.exec(t);
        if (m) s = permute(s, moves[m[1]], m[2] ? 2 : 1);
      }
      return s;
    }
    return (skewbModel = { pos, face, poly, moves, solved: () => face.slice(), apply });
  }

  // ---------- Pyraminx ----------
  // Bottom face horizontal, front face toward the solver (WCA 12e).
  const PYRA_COLORS = { F: '#1fa64a', L: '#e2312d', R: '#1f62d6', D: '#f6d21a' };
  let pyraModel = null;
  function makePyraminx() {
    if (pyraModel) return pyraModel;
    const r = Math.sqrt(8) / 3, h = Math.sqrt(3) / 2;
    const V = { U: [0, 1, 0], L: [-r * h, -1 / 3, r / 2], R: [r * h, -1 / 3, r / 2], B: [0, -1 / 3, -r] };
    // faces: [3D vertices], [2D net vertices]
    const P2 = { U: [0.5, 0], L: [0, h], R: [1, h] };
    const faces = {
      F: [[V.U, V.L, V.R], [P2.U, P2.L, P2.R]],
      L: [[V.U, V.B, V.L], [P2.U, [-0.5, 0], P2.L]],
      R: [[V.U, V.R, V.B], [P2.U, P2.R, [1.5, 0]]],
      D: [[V.L, V.B, V.R], [P2.L, [0.5, 2 * h], P2.R]],
    };
    const pos = [], face = [], poly = [];
    for (const F in faces) {
      const [[A, B, C], [a, b, c]] = faces[F];
      const p3 = (i, j) => [A[0] + (B[0] - A[0]) * i / 3 + (C[0] - A[0]) * j / 3, A[1] + (B[1] - A[1]) * i / 3 + (C[1] - A[1]) * j / 3, A[2] + (B[2] - A[2]) * i / 3 + (C[2] - A[2]) * j / 3];
      const p2 = (i, j) => [a[0] + (b[0] - a[0]) * i / 3 + (c[0] - a[0]) * j / 3, a[1] + (b[1] - a[1]) * i / 3 + (c[1] - a[1]) * j / 3];
      const tris = [];
      for (let i = 0; i <= 2; i++) for (let j = 0; i + j <= 2; j++) tris.push([[i, j], [i + 1, j], [i, j + 1]]);
      for (let i = 0; i <= 1; i++) for (let j = 0; i + j <= 1; j++) tris.push([[i + 1, j], [i, j + 1], [i + 1, j + 1]]);
      for (const t of tris) {
        const q = t.map(([i, j]) => p3(i, j));
        pos.push([(q[0][0] + q[1][0] + q[2][0]) / 3, (q[0][1] + q[1][1] + q[2][1]) / 3, (q[0][2] + q[1][2] + q[2][2]) / 3]);
        face.push(F);
        poly.push(t.map(([i, j]) => p2(i, j)));
      }
    }
    const moves = {};
    for (const k in V) {
      const v = norm(V[k]);
      moves[k] = stickerPerm(pos, v, -2 * Math.PI / 3, (p) => dot(p, v) > 1 / 9);
      moves[k.toLowerCase()] = stickerPerm(pos, v, -2 * Math.PI / 3, (p) => dot(p, v) > 5 / 9);
    }
    function apply(state, alg) {
      let s = state;
      for (const t of tokens(alg)) {
        const m = /^([ULRBulrb])('?)$/.exec(t);
        if (m) s = permute(s, moves[m[1]], m[2] ? 2 : 1);
      }
      return s;
    }
    return (pyraModel = { pos, face, poly, moves, solved: () => face.slice(), apply, h });
  }

  // ---------- Clock ----------
  // front/back 3x3 dials, values 0..11 (0 = 12 o'clock).
  const PIN_BLOCK = { UL: [0, 1, 3, 4], UR: [1, 2, 4, 5], DL: [3, 4, 6, 7], DR: [4, 5, 7, 8] };
  const PIN_SETS = {
    UR: ['UR'], DR: ['DR'], DL: ['DL'], UL: ['UL'], U: ['UL', 'UR'], R: ['UR', 'DR'],
    D: ['DL', 'DR'], L: ['UL', 'DL'], ALL: ['UL', 'UR', 'DL', 'DR'],
  };
  const BACK_CORNER = { 0: 2, 2: 0, 6: 8, 8: 6 };
  const clock = {
    solved: () => ({ f: Array(9).fill(0), b: Array(9).fill(0) }),
    apply(state, alg) {
      let f = state.f.slice(), b = state.b.slice();
      for (const t of tokens(alg)) {
        if (t === 'y2') { [f, b] = [b, f]; continue; }
        const m = /^(UR|DR|DL|UL|U|R|D|L|ALL)(\d)([+-])$/.exec(t);
        if (!m) continue;
        const amt = (m[3] === '+' ? 1 : -1) * +m[2];
        const dials = new Set();
        for (const p of PIN_SETS[m[1]]) for (const d of PIN_BLOCK[p]) dials.add(d);
        for (const d of dials) {
          f[d] = (((f[d] + amt) % 12) + 12) % 12;
          if (d in BACK_CORNER) { const bd = BACK_CORNER[d]; b[bd] = (((b[bd] - amt) % 12) + 12) % 12; }
        }
      }
      return { f, b };
    },
  };

  // ---------- Square-1 ----------
  // Layers are 12 units of 30°, listed clockwise (top seen from above,
  // bottom seen from below) starting at the front end of the slice.
  // Top units 6..11 and bottom units 0..5 form the right half that "/" flips.
  // Pieces: 'c#' corners take two units, 'e#' edges take one.
  const sq1 = {
    solved() {
      return {
        top: ['c0', 'c0', 'e0', 'c1', 'c1', 'e1', 'c2', 'c2', 'e2', 'c3', 'c3', 'e3'],
        bot: ['e4', 'c4', 'c4', 'e5', 'c5', 'c5', 'e6', 'c6', 'c6', 'e7', 'c7', 'c7'],
      };
    },
    turn(layer, x) {
      const out = new Array(12);
      for (let i = 0; i < 12; i++) out[(((i + x) % 12) + 12) % 12] = layer[i];
      return out;
    },
    canSlice: (s) => s.top[11] !== s.top[0] && s.top[5] !== s.top[6] && s.bot[11] !== s.bot[0] && s.bot[5] !== s.bot[6],
    slice(s) {
      const top = s.top.slice(), bot = s.bot.slice();
      for (let i = 0; i < 6; i++) { top[i + 6] = s.bot[i]; bot[i] = s.top[i + 6]; }
      return { top, bot };
    },
    apply(state, alg) {
      let s = { top: state.top.slice(), bot: state.bot.slice() };
      const str = String(alg || '');
      const re = /\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)|\//g;
      let m;
      while ((m = re.exec(str))) {
        if (m[0] === '/') s = sq1.slice(s);
        else s = { top: sq1.turn(s.top, +m[1]), bot: sq1.turn(s.bot, +m[2]) };
      }
      return s;
    },
  };
  // side colours of each sq1 piece (cube colour scheme, white top)
  const SQ1_PIECES = {
    c0: ['U', 'F', 'L'], e0: ['U', 'L'], c1: ['U', 'L', 'B'], e1: ['U', 'B'], c2: ['U', 'B', 'R'], e2: ['U', 'R'], c3: ['U', 'R', 'F'], e3: ['U', 'F'],
    e4: ['D', 'F'], c4: ['D', 'F', 'R'], e5: ['D', 'R'], c5: ['D', 'R', 'B'], e6: ['D', 'B'], c6: ['D', 'B', 'L'], e7: ['D', 'L'], c7: ['D', 'L', 'F'],
  };

  // ---------- SVG renderers ----------
  const f2 = (n) => Math.round(n * 100) / 100;
  function svgOpen(w, h, extra) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f2(w)} ${f2(h)}" class="net" role="img" ${extra || ''}>`;
  }
  const stroke = (w) => `stroke="var(--net-line)" stroke-width="${w}" stroke-linejoin="round"`;

  function drawCube(N, alg) {
    const cube = makeCube(N);
    const st = cube.apply(cube.solved(), alg);
    const off = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
    const gap = 0.12, sz = 1 / N;
    let out = svgOpen(4 + 3 * gap, 3 + 2 * gap, `aria-label="${N}x${N} scramble preview"`);
    for (let i = 0; i < cube.pos.length; i++) {
      const F = FACES[cube.face[i]], [r, c] = cube.rc[i], [ox, oy] = off[F];
      const x = ox * (1 + gap) + c * sz, y = oy * (1 + gap) + r * sz;
      out += `<rect x="${f2(x + sz * 0.04)}" y="${f2(y + sz * 0.04)}" width="${f2(sz * 0.92)}" height="${f2(sz * 0.92)}" rx="${f2(sz * 0.14)}" fill="${CUBE_COLORS[st[i]]}"/>`;
    }
    return out + '</svg>';
  }

  function drawSkewb(alg) {
    const m = makeSkewb(), st = m.apply(m.solved(), alg);
    const off = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
    const gap = 0.1;
    let out = svgOpen(4 + 3 * gap, 3 + 2 * gap, 'aria-label="Skewb scramble preview"');
    for (let i = 0; i < m.pos.length; i++) {
      const [ox, oy] = off[m.face[i]];
      const pts = m.poly[i].map(([x, y]) => `${f2(ox * (1 + gap) + (x + 1) / 2)},${f2(oy * (1 + gap) + (y + 1) / 2)}`).join(' ');
      out += `<polygon points="${pts}" fill="${CUBE_COLORS[st[i]]}" ${stroke(0.035)}/>`;
    }
    return out + '</svg>';
  }

  function drawPyraminx(alg) {
    const m = makePyraminx(), st = m.apply(m.solved(), alg);
    const pad = 0.04;
    let out = svgOpen(2 + 2 * pad, 2 * m.h + 2 * pad, 'aria-label="Pyraminx scramble preview"');
    // separate the four faces a little by shrinking each toward its face centre
    const centres = {};
    for (let i = 0; i < m.pos.length; i++) {
      const F = m.face[i];
      centres[F] = centres[F] || [0, 0, 0];
      for (const p of m.poly[i]) { centres[F][0] += p[0]; centres[F][1] += p[1]; centres[F][2]++; }
    }
    for (let i = 0; i < m.pos.length; i++) {
      const c = centres[m.face[i]], cx = c[0] / c[2], cy = c[1] / c[2];
      const pts = m.poly[i].map(([x, y]) => `${f2(pad + 0.5 + cx + (x - cx) * 0.94)},${f2(pad + cy + (y - cy) * 0.94)}`).join(' ');
      out += `<polygon points="${pts}" fill="${PYRA_COLORS[st[i]]}" ${stroke(0.018)}/>`;
    }
    return out + '</svg>';
  }

  function drawClock(alg) {
    const st = clock.apply(clock.solved(), alg);
    let out = svgOpen(7.4, 3.4, 'aria-label="Clock scramble preview"');
    [[st.f, 0.2, 'var(--clock-front)'], [st.b, 3.8, 'var(--clock-back)']].forEach(([dials, ox, bg]) => {
      out += `<rect x="${ox}" y="0.2" width="3.4" height="3" rx="0.9" fill="${bg}" ${stroke(0.05)}/>`;
      for (let d = 0; d < 9; d++) {
        const cx = ox + 0.7 + (d % 3) * 1, cy = 0.7 + Math.floor(d / 3) * 1;
        out += `<circle cx="${f2(cx)}" cy="${f2(cy)}" r="0.38" fill="var(--clock-face)" ${stroke(0.04)}/>`;
        const a = (dials[d] / 12) * Math.PI * 2;
        out += `<line x1="${f2(cx)}" y1="${f2(cy)}" x2="${f2(cx + Math.sin(a) * 0.3)}" y2="${f2(cy - Math.cos(a) * 0.3)}" stroke="var(--clock-hand)" stroke-width="0.09" stroke-linecap="round"/>`;
        out += `<circle cx="${f2(cx)}" cy="${f2(cy - 0.32)}" r="0.035" fill="var(--clock-hand)" opacity=".5"/>`;
      }
    });
    return out + '</svg>';
  }

  function drawSq1(alg) {
    const st = sq1.apply(sq1.solved(), alg);
    let out = svgOpen(6.8, 3.4, 'aria-label="Square-1 scramble preview"');
    const R = 1.05, Rb = R / Math.cos(Math.PI / 12), Rt = R * Math.SQRT2, K = 1.17;
    // Both layers are drawn as seen from above (bottom x-rayed), front at the
    // bottom of the screen, so the flipping half is on the right for both.
    const layer = (units, cx, cy, isTop) => {
      const pt = (u, r) => {
        const a = (isTop ? u * 30 + 15 : u * 30 - 15) * Math.PI / 180;
        return [cx + (isTop ? -Math.sin(a) : Math.sin(a)) * r, cy + Math.cos(a) * r];
      };
      const poly = (pts, col) => `<polygon points="${pts.map((p) => f2(p[0]) + ',' + f2(p[1])).join(' ')}" fill="${CUBE_COLORS[col]}" ${stroke(0.03)}/>`;
      let s = '';
      for (let i = 0; i < 12; i++) {
        const id = units[i], cols = SQ1_PIECES[id];
        if (id[0] === 'c') {
          if (units[(i + 1) % 12] !== id) continue; // draw each corner once, from its first unit
          const b0 = pt(i, Rb), tip = pt(i + 1, Rt), b1 = pt(i + 2, Rb);
          s += poly([[cx, cy], b0, tip, b1], cols[0]);
          s += poly([b0, tip, pt(i + 1, Rt * K), pt(i, Rb * K)], cols[1]);
          s += poly([tip, b1, pt(i + 2, Rb * K), pt(i + 1, Rt * K)], cols[2]);
        } else {
          const b0 = pt(i, Rb), b1 = pt(i + 1, Rb);
          s += poly([[cx, cy], b0, b1], cols[0]);
          s += poly([b0, b1, pt(i + 1, Rb * K), pt(i, Rb * K)], cols[1]);
        }
      }
      const [x0, y0] = pt(0, Rt * K * 1.04), [x1, y1] = pt(6, Rt * K * 1.04);
      s += `<line x1="${f2(x0)}" y1="${f2(y0)}" x2="${f2(x1)}" y2="${f2(y1)}" stroke="var(--net-slice)" stroke-width="0.05" stroke-dasharray="0.12 0.08"/>`;
      return s;
    };
    out += layer(st.top, 1.7, 1.7, true);
    out += layer(st.bot, 5.1, 1.7, false);
    return out + '</svg>';
  }

  function draw(event, alg) {
    try {
      const N = { '222': 2, '333': 3, '333oh': 3, '333bf': 3, '333fm': 3, '444': 4, '444bf': 4, '555': 5, '555bf': 5, '666': 6, '777': 7 }[event];
      if (N) return drawCube(N, alg);
      if (event === 'skewb') return drawSkewb(alg);
      if (event === 'pyram') return drawPyraminx(alg);
      if (event === 'clock') return drawClock(alg);
      if (event === 'sq1') return drawSq1(alg);
    } catch (e) { /* fall through to no preview */ }
    return '';
  }

  G.FacetPuzzles = { makeCube, makeSkewb, makePyraminx, clock, sq1, draw, permute, tokens, stickerPerm, dot, sub, norm, cross, lerp3 };
})(typeof self !== 'undefined' ? self : this);
