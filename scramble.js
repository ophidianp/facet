/* Facet — WCA scramble engine.
 * Random-state: 2x2 (optimal), 3x3 / OH / BLD / FMC (Kociemba two-phase),
 * Pyraminx (optimal + random tips), Skewb (optimal), Clock (uniform dials).
 * Random-move, as TNoodle does: 5x5 (60), 6x6 (80), 7x7 (100), Megaminx (Pochmann).
 * Random-move fallbacks: 4x4 (40) and Square-1, whose random-state solvers are too heavy to ship.
 * Runs as a Web Worker when possible, or on the page as a fallback. */
(function (G) {
  'use strict';
  const IN_WORKER = typeof WorkerGlobalScope !== 'undefined' && G instanceof WorkerGlobalScope;
  if (IN_WORKER && !G.FacetPuzzles) G.importScripts('puzzles.js');
  const PZ = G.FacetPuzzles;

  // Cryptographic randomness where available.
  const rnd = (() => {
    const buf = new Uint32Array(64); let i = 64;
    const c = G.crypto && G.crypto.getRandomValues ? G.crypto : null;
    return (n) => {
      if (!c) return Math.floor(Math.random() * n);
      if (i >= 64) { c.getRandomValues(buf); i = 0; }
      return buf[i++] % n; // n is tiny; modulo bias is negligible (< 1e-8)
    };
  })();
  const pick = (a) => a[rnd(a.length)];

  // ---------- permutation ranking ----------
  const FACT = [1]; for (let i = 1; i <= 12; i++) FACT[i] = FACT[i - 1] * i;
  function permRank(p, n) {
    let r = 0;
    for (let i = 0; i < n; i++) {
      let c = 0;
      for (let j = i + 1; j < n; j++) if (p[j] < p[i]) c++;
      r += c * FACT[n - 1 - i];
    }
    return r;
  }
  function permUnrank(r, n, out) {
    const pool = []; for (let i = 0; i < n; i++) pool.push(i);
    for (let i = 0; i < n; i++) {
      const f = FACT[n - 1 - i], k = Math.floor(r / f); r %= f;
      out[i] = pool.splice(k, 1)[0];
    }
    return out;
  }
  const parity = (p) => { let s = 0; for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[j] < p[i]) s ^= 1; return s; };

  // =====================================================================
  // 3x3x3: Kociemba two-phase
  // =====================================================================
  const K3 = (() => {
    // Corners URF UFL ULB UBR DFR DLF DBL DRB; edges UR UF UL UB DR DF DL DB FR FL BL BR.
    const BASE = {
      U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      R: { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      F: { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
      D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      L: { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
      B: { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
    };
    const FACES = 'URFDLB';
    const identity = () => ({ cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] });
    // a then b
    function mul(a, b) {
      const r = { cp: new Array(8), co: new Array(8), ep: new Array(12), eo: new Array(12) };
      for (let i = 0; i < 8; i++) { r.cp[i] = a.cp[b.cp[i]]; r.co[i] = (a.co[b.cp[i]] + b.co[i]) % 3; }
      for (let i = 0; i < 12; i++) { r.ep[i] = a.ep[b.ep[i]]; r.eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2; }
      return r;
    }
    function inverse(a) {
      const r = identity();
      for (let i = 0; i < 8; i++) { r.cp[a.cp[i]] = i; }
      for (let i = 0; i < 8; i++) r.co[i] = (3 - a.co[r.cp[i]]) % 3;
      for (let i = 0; i < 12; i++) { r.ep[a.ep[i]] = i; }
      for (let i = 0; i < 12; i++) r.eo[i] = a.eo[r.ep[i]];
      return r;
    }
    const MOVES = []; // 18: face*3 + power-1
    for (let f = 0; f < 6; f++) {
      let c = BASE[FACES[f]];
      for (let p = 0; p < 3; p++) { MOVES.push(c); c = mul(c, BASE[FACES[f]]); }
    }
    const MOVE_NAMES = []; for (const f of FACES) MOVE_NAMES.push(f, f + '2', f + "'");
    const P2_MOVES = [0, 1, 2, 9, 10, 11, 4, 7, 13, 16]; // U U2 U' D D2 D' R2 F2 L2 B2
    const IS_P2 = new Uint8Array(18); for (const m of P2_MOVES) IS_P2[m] = 1;

    // ---- coordinates ----
    const getTwist = (c) => { let t = 0; for (let i = 0; i < 7; i++) t = t * 3 + c.co[i]; return t; };
    const setTwist = (c, t) => { let s = 0; for (let i = 6; i >= 0; i--) { c.co[i] = t % 3; s += c.co[i]; t = Math.floor(t / 3); } c.co[7] = (3 - (s % 3)) % 3; };
    const getFlip = (c) => { let t = 0; for (let i = 0; i < 11; i++) t = t * 2 + c.eo[i]; return t; };
    const setFlip = (c, t) => { let s = 0; for (let i = 10; i >= 0; i--) { c.eo[i] = t & 1; s += c.eo[i]; t >>= 1; } c.eo[11] = s & 1; };
    const C = (n, k) => { if (k < 0 || k > n) return 0; let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); };
    function getSlice(c) { let a = 0, x = 0; for (let j = 11; j >= 0; j--) if (c.ep[j] >= 8) { a += C(11 - j, x + 1); x++; } return a; }
    const SLICE_SETS = [];
    (() => {
      for (let m = 0; m < 4096; m++) {
        let bits = 0; for (let k = 0; k < 12; k++) if (m >> k & 1) bits++;
        if (bits !== 4) continue;
        const c = identity(); let s = 8, o = 0;
        for (let k = 0; k < 12; k++) c.ep[k] = (m >> k & 1) ? s++ : o++;
        SLICE_SETS[getSlice(c)] = m;
      }
    })();
    function setSlice(c, idx) { const m = SLICE_SETS[idx]; let s = 8, o = 0; for (let k = 0; k < 12; k++) c.ep[k] = (m >> k & 1) ? s++ : o++; }
    const getCP = (c) => permRank(c.cp, 8);
    const setCP = (c, r) => permUnrank(r, 8, c.cp);
    const getUD = (c) => permRank(c.ep, 8); // only meaningful in phase 2
    const setUD = (c, r) => { permUnrank(r, 8, c.ep); for (let i = 8; i < 12; i++) c.ep[i] = i; };
    const getSP = (c) => permRank([c.ep[8] - 8, c.ep[9] - 8, c.ep[10] - 8, c.ep[11] - 8], 4);
    const setSP = (c, r) => { const p = permUnrank(r, 4, []); for (let i = 0; i < 8; i++) c.ep[i] = i; for (let i = 0; i < 4; i++) c.ep[8 + i] = 8 + p[i]; };

    let T = null;
    function buildMoveTable(size, set, get, moves) {
      const t = new Uint16Array(size * 18);
      for (let i = 0; i < size; i++) {
        const c = identity(); set(c, i);
        for (const m of moves) t[i * 18 + m] = get(mul(c, MOVES[m]));
      }
      return t;
    }
    function bfs(size, start, expand) {
      const d = new Int8Array(size).fill(-1), q = new Int32Array(size);
      let head = 0, tail = 0;
      d[start] = 0; q[tail++] = start;
      while (head < tail) {
        const s = q[head++], nd = d[s] + 1;
        expand(s, (n) => { if (d[n] < 0) { d[n] = nd; q[tail++] = n; } });
      }
      return d;
    }
    function init() {
      if (T) return T;
      const ALL = [...Array(18).keys()];
      const twist = buildMoveTable(2187, setTwist, getTwist, ALL);
      const flip = buildMoveTable(2048, setFlip, getFlip, ALL);
      const slice = buildMoveTable(495, setSlice, getSlice, ALL);
      const cp = buildMoveTable(40320, setCP, getCP, P2_MOVES);
      const ud = buildMoveTable(40320, setUD, getUD, P2_MOVES);
      const sp = buildMoveTable(24, setSP, getSP, P2_MOVES);
      const pTS = bfs(2187 * 495, 0, (s, push) => { const t = (s / 495) | 0, l = s % 495; for (let m = 0; m < 18; m++) push(twist[t * 18 + m] * 495 + slice[l * 18 + m]); });
      const pFS = bfs(2048 * 495, 0, (s, push) => { const f = (s / 495) | 0, l = s % 495; for (let m = 0; m < 18; m++) push(flip[f * 18 + m] * 495 + slice[l * 18 + m]); });
      const pCS = bfs(40320 * 24, 0, (s, push) => { const c = (s / 24) | 0, l = s % 24; for (const m of P2_MOVES) push(cp[c * 18 + m] * 24 + sp[l * 18 + m]); });
      const pUS = bfs(40320 * 24, 0, (s, push) => { const c = (s / 24) | 0, l = s % 24; for (const m of P2_MOVES) push(ud[c * 18 + m] * 24 + sp[l * 18 + m]); });
      return (T = { twist, flip, slice, cp, ud, sp, pTS, pFS, pCS, pUS });
    }

    // allowed to follow `last` (face index, -1 = none)?
    const okAfter = (f, last) => last < 0 || (f !== last && f !== last - 3);

    function solve(cube, maxLen = 21, budgetMs = 2500) {
      const t = init();
      const sol = new Int8Array(32);
      let t0 = Date.now(), nodes = 0, limit = maxLen, gaveUp = false;

      function phase2(cpc, udc, spc, depth, n, last) {
        if (depth === 0) return cpc === 0 && udc === 0 && spc === 0;
        if (Math.max(t.pCS[cpc * 24 + spc], t.pUS[udc * 24 + spc]) > depth) return false;
        for (const m of P2_MOVES) {
          const f = (m / 3) | 0;
          if (!okAfter(f, last)) continue;
          sol[n] = m;
          if (phase2(t.cp[cpc * 18 + m], t.ud[udc * 18 + m], t.sp[spc * 18 + m], depth - 1, n + 1, f)) return true;
        }
        return false;
      }
      function startPhase2(len1) {
        let c = cube;
        for (let i = 0; i < len1; i++) c = mul(c, MOVES[sol[i]]);
        const cpc = getCP(c), udc = getUD(c), spc = getSP(c);
        const last = len1 ? (sol[len1 - 1] / 3) | 0 : -1;
        const hmin = Math.max(t.pCS[cpc * 24 + spc], t.pUS[udc * 24 + spc]);
        for (let d2 = hmin; d2 <= limit - len1; d2++) if (phase2(cpc, udc, spc, d2, len1, last)) return len1 + d2;
        return -1;
      }
      let found = -1;
      function phase1(tw, fl, sl, depth, n, last) {
        if (found >= 0 || gaveUp) return;
        if (depth === 0) {
          if (tw === 0 && fl === 0 && sl === 0 && (n === 0 || !IS_P2[sol[n - 1]])) found = startPhase2(n);
          return;
        }
        if ((++nodes & 4095) === 0 && Date.now() - t0 > budgetMs) { gaveUp = true; return; }
        const h = Math.max(t.pTS[tw * 495 + sl], t.pFS[fl * 495 + sl]);
        if (h > depth) return;
        for (let m = 0; m < 18; m++) {
          const f = (m / 3) | 0;
          if (!okAfter(f, last)) continue;
          sol[n] = m;
          phase1(t.twist[tw * 18 + m], t.flip[fl * 18 + m], t.slice[sl * 18 + m], depth - 1, n + 1, f);
          if (found >= 0 || gaveUp) return;
        }
      }
      const tw = getTwist(cube), fl = getFlip(cube), sl = getSlice(cube);
      for (let d1 = 0; d1 <= limit && found < 0; d1++) {
        phase1(tw, fl, sl, d1, 0, -1);
        if (gaveUp) { gaveUp = false; limit += 2; nodes = 0; d1 = -1; t0 = Date.now(); if (limit > 30) break; }
      }
      if (found < 0) return null;
      return Array.from(sol.slice(0, found));
    }

    function randomCube() {
      const c = identity();
      permUnrank(rnd(40320), 8, c.cp);
      permUnrank(rnd(479001600), 12, c.ep);
      if (parity(c.cp) !== parity(c.ep)) { const t = c.ep[10]; c.ep[10] = c.ep[11]; c.ep[11] = t; }
      setTwist(c, rnd(2187));
      setFlip(c, rnd(2048));
      return c;
    }
    const isSolved = (c) => getCP(c) === 0 && getTwist(c) === 0 && getFlip(c) === 0 && permRank(c.ep, 12) === 0;
    // WCA 4b3: the state must need at least 2 moves.
    function farEnough(c) {
      if (isSolved(c)) return false;
      for (const m of MOVES) if (isSolved(mul(c, m))) return false;
      return true;
    }
    const invert = (seq) => seq.slice().reverse().map((m) => (m / 3 | 0) * 3 + (2 - m % 3));
    const fmt = (seq) => seq.map((m) => MOVE_NAMES[m]).join(' ');
    const seqCube = (names) => names.reduce((c, n) => mul(c, MOVES[MOVE_NAMES.indexOf(n)]), identity());

    function scramble() {
      for (;;) {
        const c = randomCube();
        if (!farEnough(c)) continue;
        const s = solve(c);
        if (s) return fmt(invert(s));
      }
    }
    // WCA FMC: R' U' F <solution> R' U' F, with no cancellation at the joins.
    function scrambleFMC() {
      const pad = seqCube(["R'", "U'", 'F']), padInv = inverse(pad);
      for (;;) {
        const c = randomCube();
        if (!farEnough(c)) continue;
        // pad * X * pad = c  =>  X = padInv * c * padInv
        const s = solve(mul(mul(padInv, c), padInv));
        if (!s) continue;
        const x = invert(s);
        if (!x.length) continue;
        const first = (x[0] / 3) | 0, lastF = (x[x.length - 1] / 3) | 0;
        if (first === 2 || first === 5 || lastF === 1 || lastF === 4) continue; // F/B after F, R/L before R'
        return "R' U' F " + fmt(x) + " R' U' F";
      }
    }
    return { init, solve, scramble, scrambleFMC, mul, identity, inverse, MOVES, MOVE_NAMES, randomCube, invert, fmt, seqCube, isSolved };
  })();

  // =====================================================================
  // Generic orbit solver (2x2, Pyraminx, Skewb), derived from the
  // sticker models in puzzles.js.
  // =====================================================================
  function deriveOrbits(model, sigMoves, solveMoves, ignorePiece) {
    const pos = model.pos, n = pos.length;
    // group stickers by which moves touch them
    const sig = new Array(n).fill('');
    for (const name of sigMoves) { const d = model.moves[name]; for (let i = 0; i < n; i++) sig[i] += d[i] !== i ? '1' : '0'; }
    const groups = new Map();
    for (let i = 0; i < n; i++) { if (!groups.has(sig[i])) groups.set(sig[i], []); groups.get(sig[i]).push(i); }
    let pieces = [...groups.entries()].filter(([s]) => !ignorePiece(s, sigMoves)).map(([, g]) => g);
    // order stickers of each piece counter-clockwise around its outward axis
    pieces = pieces.map((g) => {
      if (g.length < 3) return g;
      const c = [0, 0, 0]; for (const i of g) for (let k = 0; k < 3; k++) c[k] += pos[i][k] / g.length;
      const ax = PZ.norm(c);
      const u0 = PZ.sub(pos[g[0]], c), e1 = PZ.norm(PZ.sub(u0, ax.map((x) => x * PZ.dot(u0, ax)))), e2 = PZ.cross(ax, e1);
      return g.slice().sort((a, b) => {
        const ua = PZ.sub(pos[a], c), ub = PZ.sub(pos[b], c);
        const aa = Math.atan2(PZ.dot(ua, e2), PZ.dot(ua, e1)), ab = Math.atan2(PZ.dot(ub, e2), PZ.dot(ub, e1));
        return ((aa + 7) % (2 * Math.PI)) - ((ab + 7) % (2 * Math.PI));
      });
    });
    const where = new Map(); pieces.forEach((g, p) => g.forEach((s, k) => where.set(s, [p, k])));
    // piece-level effect of each solving move
    const pm = solveMoves.map((name) => {
      const d = model.moves[name], perm = new Array(pieces.length), ori = new Array(pieces.length);
      pieces.forEach((g, j) => { const [i, k] = where.get(d[g[0]]); perm[i] = j; ori[i] = k; });
      return { perm, ori };
    });
    // orbits = connected components of slots, dropping slots nothing changes
    const parent = pieces.map((_, i) => i);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (const m of pm) m.perm.forEach((j, i) => { parent[find(i)] = find(j); });
    const comps = new Map();
    pieces.forEach((_, i) => { const r = find(i); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); });
    const orbits = [];
    for (const slots of comps.values()) {
      const k = pieces[slots[0]].length;
      const moves = pm.map((m) => ({ perm: slots.map((s) => slots.indexOf(m.perm[s])), ori: slots.map((s) => m.ori[s] % k) }));
      const moved = moves.some((m) => m.perm.some((p, i) => p !== i) || m.ori.some((o) => o));
      if (!moved) continue;
      const inv = moves.every((m) => m.ori.reduce((a, b) => a + b, 0) % k === 0);
      orbits.push({ n: slots.length, k, inv, moves });
    }
    return orbits;
  }

  // Each orbit gives up to two coordinates (permutation, orientation by
  // slot); they transform independently, so their move tables stay small.
  function OrbitSolver(orbits, moveNames, moveAxis) {
    const M = moveNames.length;
    const coord = [];
    orbits.forEach((o, oi) => {
      if (o.n > 1 && o.moves.some((m) => m.perm.some((p, i) => p !== i))) {
        const size = FACT[o.n], table = new Int32Array(size * M), p = [], np = new Array(o.n);
        for (let x = 0; x < size; x++) {
          permUnrank(x, o.n, p);
          for (let m = 0; m < M; m++) { const mv = o.moves[m]; for (let i = 0; i < o.n; i++) np[i] = p[mv.perm[i]]; table[x * M + m] = permRank(np, o.n); }
        }
        coord.push({ orbit: oi, kind: 'perm', size, table });
      }
      const od = o.k === 1 ? 0 : o.inv ? o.n - 1 : o.n;
      if (od > 0 && o.moves.some((m) => m.ori.some((v) => v))) {
        const size = o.k ** od, table = new Int32Array(size * M), q = new Array(o.n);
        for (let x = 0; x < size; x++) {
          let c = x, s = 0;
          for (let i = od - 1; i >= 0; i--) { q[i] = c % o.k; c = Math.floor(c / o.k); s += q[i]; }
          if (od < o.n) q[o.n - 1] = (o.k - (s % o.k)) % o.k;
          for (let m = 0; m < M; m++) {
            const mv = o.moves[m]; let r = 0;
            for (let i = 0; i < od; i++) r = r * o.k + (q[mv.perm[i]] + mv.ori[i]) % o.k;
            table[x * M + m] = r;
          }
        }
        coord.push({ orbit: oi, kind: 'ori', size, table });
      }
    });
    const pruning = [];
    function addPruning(idx) {
      const sizes = idx.map((i) => coord[i].size), total = sizes.reduce((a, b) => a * b, 1);
      const d = new Int8Array(total).fill(-1), q = new Int32Array(total);
      let head = 0, tail = 1; d[0] = 0; q[0] = 0;
      const parts = new Array(idx.length);
      while (head < tail) {
        let s = q[head++]; const nd = d[s] + 1;
        for (let j = idx.length - 1; j >= 0; j--) { parts[j] = s % sizes[j]; s = Math.floor(s / sizes[j]); }
        for (let m = 0; m < M; m++) {
          let x = 0;
          for (let j = 0; j < idx.length; j++) x = x * sizes[j] + coord[idx[j]].table[parts[j] * M + m];
          if (d[x] < 0) { d[x] = nd; q[tail++] = x; }
        }
      }
      pruning.push({ idx, sizes, d });
    }
    const h = (st) => {
      let best = 0;
      for (const p of pruning) {
        let x = 0; for (let j = 0; j < p.idx.length; j++) x = x * p.sizes[j] + st[p.idx[j]];
        if (p.d[x] > best) best = p.d[x];
      }
      return best;
    };
    const step = (st, m) => st.map((c, i) => coord[i].table[c * M + m]);
    function randomState(steps = 400) {
      let st = coord.map(() => 0);
      for (let i = 0; i < steps; i++) st = step(st, rnd(M));
      return st;
    }
    function solve(st, maxDepth = 20) {
      const sol = [];
      const search = (s, depth, last) => {
        const hv = h(s);
        if (hv === 0 && s.every((c) => c === 0)) return true;
        if (hv > depth) return false;
        for (let m = 0; m < M; m++) {
          if (moveAxis[m] === last) continue;
          sol.push(m);
          if (search(step(s, m), depth - 1, moveAxis[m])) return true;
          sol.pop();
        }
        return false;
      };
      for (let d = 0; d <= maxDepth; d++) if (search(st, d, -1)) return sol.slice();
      return null;
    }
    return { addPruning, randomState, solve, h, coord };
  }

  const LAZY = {};
  function lazy(name, build) { return LAZY[name] || (LAZY[name] = build()); }

  // inverse of a solution, written with the puzzle's own move names
  function invertNames(sol, names, inverseOf) { return sol.slice().reverse().map((m) => inverseOf(names[m])).join(' '); }

  function orbitPuzzle(name) {
    return lazy(name, () => {
      let model, sigMoves, solveMoves, axis, ignore = () => false, prune;
      if (name === '222') {
        const N2 = PZ.makeCube(2);
        const moves = {}; for (const f of 'RUF') moves[f] = (() => {
          // reuse the NxN engine: sticker map for one quarter turn
          const s = N2.pos.map((_, i) => i);
          const out = N2.apply(s.map(String), f).map(Number); // out[newIndex] = old index
          const d = new Int16Array(s.length); out.forEach((old, ni) => { d[old] = ni; }); return d;
        })();
        model = { pos: N2.pos, moves };
        sigMoves = ['R', 'U', 'F'];
        const powers = { R: ['R', 'R2', "R'"], U: ['U', 'U2', "U'"], F: ['F', 'F2', "F'"] };
        solveMoves = []; axis = [];
        const compose = (d, t) => { let r = d; for (let i = 1; i < t; i++) { const n = new Int16Array(d.length); for (let k = 0; k < d.length; k++) n[k] = d[r[k]]; r = n; } return r; };
        for (const f of 'RUF') powers[f].forEach((nm, p) => { moves[nm] = compose(moves[f], p + 1); solveMoves.push(nm); axis.push(f); });
        prune = [[0]];
      } else if (name === 'pyram') {
        model = PZ.makePyraminx();
        sigMoves = ['U', 'L', 'R', 'B', 'u', 'l', 'r', 'b'];
        ignore = (s) => s.slice(4).includes('1'); // tips are handled separately
        const m = model.moves;
        for (const k of ['U', 'L', 'R', 'B']) { const d = m[k], d2 = new Int16Array(d.length); for (let i = 0; i < d.length; i++) d2[i] = d[d[i]]; m[k + "'"] = d2; }
        solveMoves = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"];
        axis = ['U', 'U', 'L', 'L', 'R', 'R', 'B', 'B'];
        prune = 'all';
      } else if (name === 'skewb') {
        model = PZ.makeSkewb();
        sigMoves = ['U', 'R', 'L', 'B'];
        const m = model.moves;
        for (const k of ['U', 'R', 'L', 'B']) { const d = m[k], d2 = new Int16Array(d.length); for (let i = 0; i < d.length; i++) d2[i] = d[d[i]]; m[k + "'"] = d2; }
        solveMoves = ['U', "U'", 'R', "R'", 'L', "L'", 'B', "B'"];
        axis = ['U', 'U', 'R', 'R', 'L', 'L', 'B', 'B'];
        prune = 'skewb';
      }
      const orbits = deriveOrbits(model, sigMoves, solveMoves, ignore);
      const solver = OrbitSolver(orbits, solveMoves, axis);
      const all = solver.coord.map((_, i) => i);
      if (prune === 'skewb') {
        // centres (one-sticker pieces) paired with each corner orbit
        const ci = orbits.findIndex((o) => o.k === 1);
        const centre = all.filter((i) => solver.coord[i].orbit === ci);
        orbits.forEach((o, oi) => { if (oi !== ci) solver.addPruning(centre.concat(all.filter((i) => solver.coord[i].orbit === oi))); });
      } else solver.addPruning(all);
      return { solver, names: solveMoves, orbits };
    });
  }
  const invQuarter = (nm) => (nm.endsWith("'") ? nm.slice(0, -1) : nm.endsWith('2') ? nm : nm + "'");

  function orbitScramble(name, minLen) {
    const { solver, names } = orbitPuzzle(name);
    for (;;) {
      const st = solver.randomState();
      const sol = solver.solve(st);
      if (sol && sol.length >= minLen) return invertNames(sol, names, invQuarter);
    }
  }

  // =====================================================================
  // Random-move scramblers
  // =====================================================================
  function nxnRandomMoves(N, len) {
    // axis 0 = U/D, 1 = R/L, 2 = F/B; a move = face + depth
    const faces = [['U', 'D'], ['R', 'L'], ['F', 'B']];
    const maxDepth = Math.floor(N / 2);
    const opts = [];
    for (let a = 0; a < 3; a++) for (let s = 0; s < 2; s++) for (let d = 1; d <= maxDepth; d++) {
      // 4x4 style: wide moves only on U, R, F (TNoodle); bigger cubes use all faces
      if (N === 4 && d === 2 && s === 1) continue;
      opts.push({ a, s, d, name: (d > 2 ? d : '') + faces[a][s] + (d > 1 ? 'w' : '') });
    }
    const out = []; let runAxis = -1, used = new Set();
    while (out.length < len) {
      const o = pick(opts);
      if (o.a === runAxis) { if (used.has(o.s + ':' + o.d)) continue; }
      else { runAxis = o.a; used = new Set(); }
      used.add(o.s + ':' + o.d);
      out.push(o.name + pick(['', "'", '2']));
    }
    return out.join(' ');
  }

  function megaminx() {
    const lines = [];
    for (let l = 0; l < 7; l++) {
      const mv = [];
      for (let i = 0; i < 5; i++) { mv.push('R' + pick(['++', '--'])); mv.push('D' + pick(['++', '--'])); }
      mv.push(mv[mv.length - 1] === 'D++' ? 'U' : "U'");
      lines.push(mv.join(' '));
    }
    return lines.join('\n');
  }

  function clockScramble() {
    const turn = (p) => { const v = rnd(12) - 5; return p + Math.abs(v) + (v < 0 ? '-' : '+'); };
    return ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'].map(turn).join(' ') + ' y2 ' + ['U', 'R', 'D', 'L', 'ALL'].map(turn).join(' ');
  }

  function sq1Scramble(twists = 12) {
    let st = PZ.sq1.solved();
    const parts = [];
    while (parts.length < twists) {
      const x = rnd(12) - 5, y = rnd(12) - 5;
      if (x === 0 && y === 0) continue;
      const next = { top: PZ.sq1.turn(st.top, x), bot: PZ.sq1.turn(st.bot, y) };
      if (!PZ.sq1.canSlice(next)) continue;
      st = PZ.sq1.slice(next);
      parts.push(`(${x},${y})`);
    }
    return parts.join(' / ') + ' /';
  }

  // BLD: random orientation (WCA 4b3a), 24 equally likely.
  function orient(scr, wide) {
    const a = pick(['', `${wide}Rw`, `${wide}Rw2`, `${wide}Rw'`, `${wide}Fw`, `${wide}Fw'`]);
    const b = pick(['', `${wide}Uw`, `${wide}Uw2`, `${wide}Uw'`]);
    return [scr, a, b].filter(Boolean).join(' ');
  }

  const EVENTS = {
    '222': { method: 'Random-state', gen: () => orbitScramble('222', 4) },
    '333': { method: 'Random-state', gen: () => K3.scramble() },
    '333oh': { method: 'Random-state', gen: () => K3.scramble() },
    '333bf': { method: 'Random-state', gen: () => orient(K3.scramble(), '') },
    '333fm': { method: 'Random-state', gen: () => K3.scrambleFMC() },
    '444': { method: 'Random-move', gen: () => nxnRandomMoves(4, 40) },
    '444bf': { method: 'Random-move', gen: () => orient(nxnRandomMoves(4, 40), '3') },
    '555': { method: 'Random-move', gen: () => nxnRandomMoves(5, 60) },
    '555bf': { method: 'Random-move', gen: () => orient(nxnRandomMoves(5, 60), '3') },
    '666': { method: 'Random-move', gen: () => nxnRandomMoves(6, 80) },
    '777': { method: 'Random-move', gen: () => nxnRandomMoves(7, 100) },
    minx: { method: 'Random-move', gen: megaminx },
    pyram: {
      method: 'Random-state',
      gen: () => {
        const tips = ['u', 'l', 'r', 'b'].map((t) => pick(['', t, t + "'"])).filter(Boolean);
        return [orbitScramble('pyram', 6), ...tips].join(' ');
      },
    },
    skewb: { method: 'Random-state', gen: () => orbitScramble('skewb', 7) },
    clock: { method: 'Random-state', gen: clockScramble },
    sq1: { method: 'Random-move', gen: () => sq1Scramble() },
  };

  function generate(event) {
    const e = EVENTS[event] || EVENTS['333'];
    return e.gen();
  }
  function warm(event) {
    if (/^333/.test(event)) K3.init();
    else if (event === '222' || event === 'pyram' || event === 'skewb') orbitPuzzle(event);
  }

  const API = { generate, warm, EVENTS, K3, orbitPuzzle, nxnRandomMoves, sq1Scramble, clockScramble };
  G.FacetScramble = API;

  if (IN_WORKER) {
    G.onmessage = (e) => {
      const { id, type, event } = e.data || {};
      try {
        if (type === 'warm') { warm(event); G.postMessage({ id, ok: true }); return; }
        const t0 = Date.now();
        const scramble = generate(event);
        G.postMessage({ id, ok: true, scramble, ms: Date.now() - t0 });
      } catch (err) {
        G.postMessage({ id, ok: false, error: String(err && err.message || err) });
      }
    };
  }
})(typeof self !== 'undefined' ? self : this);
