/* Facet — speedcubing timer. Timer, sessions, WCA statistics, widgets,
 * customization and sync. Scrambles come from scramble.js (Web Worker). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const PZ = window.FacetPuzzles, SCR = window.FacetScramble;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const now = () => performance.now();
  const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const icon = (d, extra = '') => `<svg class="i" viewBox="0 0 24 24" ${extra}>${d}</svg>`;
  const I = {
    down: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    trash: '<path d="M5 7h14M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  };

  // ---------------------------------------------------------------- events
  // WCA 9b formats: ao5 / mo3 / bo3 / bo5. BLD events have no inspection (B1a).
  const EVENTS = [
    { id: '333', name: '3x3x3', code: '3x3', fmt: 'ao5' },
    { id: '222', name: '2x2x2', code: '2x2', fmt: 'ao5' },
    { id: '444', name: '4x4x4', code: '4x4', fmt: 'ao5' },
    { id: '555', name: '5x5x5', code: '5x5', fmt: 'ao5' },
    { id: '666', name: '6x6x6', code: '6x6', fmt: 'mo3' },
    { id: '777', name: '7x7x7', code: '7x7', fmt: 'mo3' },
    { id: '333oh', name: '3x3x3 One-Handed', code: 'OH', fmt: 'ao5' },
    { id: 'clock', name: 'Clock', code: 'CLK', fmt: 'ao5' },
    { id: 'minx', name: 'Megaminx', code: 'MGA', fmt: 'ao5' },
    { id: 'pyram', name: 'Pyraminx', code: 'PYR', fmt: 'ao5' },
    { id: 'skewb', name: 'Skewb', code: 'SKB', fmt: 'ao5' },
    { id: 'sq1', name: 'Square-1', code: 'SQ1', fmt: 'ao5' },
    { id: '333bf', name: '3x3x3 Blindfolded', code: '3BLD', fmt: 'bo5', bld: true },
    { id: '444bf', name: '4x4x4 Blindfolded', code: '4BLD', fmt: 'bo3', bld: true },
    { id: '555bf', name: '5x5x5 Blindfolded', code: '5BLD', fmt: 'bo3', bld: true },
    { id: '333fm', name: '3x3x3 Fewest Moves', code: 'FMC', fmt: 'mo3', bld: true },
  ];
  const EV = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
  const usesMo3 = (ev) => EV[ev] && EV[ev].fmt !== 'ao5';

  const WIDGETS = {
    scramble: 'Scramble preview', stats: 'Statistics', chart: 'Time trend', dist: 'Distribution',
    history: 'Recent solves', consistency: 'Consistency', pbs: 'Personal bests', activity: 'Activity',
  };
  const ACCENTS = [
    ['Mint', '#14b896'], ['Sky', '#2f8cff'], ['Iris', '#7663ff'], ['Rose', '#f0457e'],
    ['Coral', '#ff6a4d'], ['Amber', '#f0a400'], ['Lime', '#7cbf1e'], ['Graphite', '#6f7c8c'],
  ];
  const FONTS = {
    Outfit: { css: 'Outfit:wght@200;300;400;500', w: '0.58em' },
    Onest: { css: 'Onest:wght@300;400;500;600', w: '0.6em' },
    Sora: { css: 'Sora:wght@200;300;400;500', w: '0.66em' },
    'JetBrains Mono': { css: 'JetBrains+Mono:wght@200;300;400;500', w: '0.6em' },
    'Chakra Petch': { css: 'Chakra+Petch:wght@300;400;500', w: '0.58em' },
    Orbitron: { css: 'Orbitron:wght@400;500;600', w: '0.8em' },
    Fraunces: { css: 'Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500', w: '0.6em' },
  };
  const UI_FONTS = { Onest: '"Onest"', Outfit: '"Outfit"', System: 'system-ui, -apple-system' };
  const QUICK_OPTS = [['best', 'Best'], ['mo3', 'Mo3'], ['ao5', 'Ao5'], ['ao12', 'Ao12'], ['ao50', 'Ao50'], ['ao100', 'Ao100'], ['mean', 'Mean'], ['sd', 'σ'], ['count', 'Solves']];

  const DEFAULTS = () => ({
    theme: 'system', accent: '#14b896', bg: 'aurora', glass: 0.42, blur: 22, radius: 22, sheen: true, refract: false,
    fontTimer: 'Outfit', fontUi: 'Onest', timerWeight: 300, timerScale: 1, scrScale: 1,
    input: 'timer', inspection: true, alerts: 'voice', holdMs: 300, update: 'live', precision: 2, focus: true, mouseStart: false,
    quick: ['ao5', 'ao12', 'mean', 'count'], subX: 0, chartWindow: 100,
    layout: 'auto',
    widgets: { desktop: ['scramble', 'stats', 'chart'], tablet: ['scramble', 'stats'], mobile: ['stats'] },
    u: 0,
  });

  // ---------------------------------------------------------------- storage
  const LS_KEY = 'facet:v1', LS_BG = 'facet:bg';
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  };
  const ENTRY_KEY = 'facet:entry';
  function entry() { return ls.get(ENTRY_KEY); }
  function loadDB() {
    let d = null;
    try { d = JSON.parse(ls.get(LS_KEY) || 'null'); } catch { d = null; }
    if (!d || typeof d !== 'object') d = {};
    const def = DEFAULTS();
    d.settings = Object.assign(def, d.settings || {});
    d.settings.widgets = Object.assign(DEFAULTS().widgets, d.settings.widgets || {});
    d.sessions = Array.isArray(d.sessions) ? d.sessions : [];
    d.current = d.current || { event: '333', sessions: {} };
    d.current.sessions = d.current.sessions || {};
    d.deleted = d.deleted || {};
    for (const s of d.sessions) { s.solves = s.solves || []; s.rev = 0; }
    return d;
  }
  const DB = loadDB();
  const S = () => DB.settings;
  let saveTimer = 0, warnedFull = false;
  function saveLocal(immediate) {
    clearTimeout(saveTimer);
    const run = () => {
      const plain = { settings: DB.settings, sessions: DB.sessions.map(({ rev, ...s }) => s), current: DB.current, deleted: DB.deleted };
      if (!ls.set(LS_KEY, JSON.stringify(plain)) && !warnedFull) {
        warnedFull = true;
        toast(Cloud.col ? 'This device ran out of space. Your account copy is still syncing.' : 'This device ran out of space. Export your solves from Customize › Data.');
      }
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 300);
  }

  // ---------------------------------------------------------------- sessions
  const sessionsOf = (ev) => DB.sessions.filter((s) => s.event === ev);
  function newSession(ev, name, auto) {
    const n = sessionsOf(ev).length + 1;
    const s = { id: rid(), name: name || `Session ${n}`, event: ev, created: Date.now(), u: Date.now(), solves: [], rev: 0 };
    if (auto) s.auto = true;
    DB.sessions.push(s);
    return s;
  }
  function ensureCurrent() {
    const ev = EV[DB.current.event] ? DB.current.event : '333';
    DB.current.event = ev;
    let sid = DB.current.sessions[ev];
    let s = DB.sessions.find((x) => x.id === sid && x.event === ev);
    if (!s) {
      s = sessionsOf(ev).sort((a, b) => b.u - a.u)[0] || newSession(ev, 'Session 1', true);
      DB.current.sessions[ev] = s.id;
    }
    return s;
  }
  const cur = () => ensureCurrent();
  function touch(s) {
    s.u = Date.now(); s.rev = (s.rev || 0) + 1; delete s.auto;
    saveLocal(); Cloud.markSession(s.id);
  }
  function touchSettings() {
    DB.settings.u = Date.now(); saveLocal(); Cloud.markMeta();
  }

  // ---------------------------------------------------------------- formatting (WCA 9f1, 9f2)
  function fmt(ms, isAvg) {
    if (ms == null || Number.isNaN(ms)) return '–';
    if (ms === Infinity) return 'DNF';
    const p = S().precision;
    let v = ms;
    if (v >= 600000) {
      v = isAvg ? Math.round(v / 1000) * 1000 : Math.floor(v / 1000) * 1000;
      const m = Math.floor(v / 60000), s = Math.floor((v % 60000) / 1000);
      return `${m}:${String(s).padStart(2, '0')}`;
    }
    if (p === 2) v = isAvg ? Math.round(v / 10) * 10 : Math.floor(v / 10) * 10;
    else v = Math.round(v);
    const m = Math.floor(v / 60000), s = Math.floor((v % 60000) / 1000);
    const frac = p === 2 ? String(Math.floor((v % 1000) / 10)).padStart(2, '0') : String(v % 1000).padStart(3, '0');
    return m ? `${m}:${String(s).padStart(2, '0')}.${frac}` : `${s}.${frac}`;
  }
  const eff = (x) => (x.p === -1 ? Infinity : x.t + (x.p === 2 ? 2000 : 0));
  function fmtSolve(x) {
    if (x.p === -1) return x.t ? `DNF(${fmt(x.t)})` : 'DNF';
    return fmt(eff(x)) + (x.p === 2 ? '+' : '');
  }
  const fmtDate = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fmtDay = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  function fmtDuration(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  }

  // ---------------------------------------------------------------- statistics
  // Ao5: drop best and worst (9f8, 9f9). Mo3: plain mean, any DNF = DNF (9f10, 9f11).
  // Longer rolling averages trim 5% from each end (the csTimer / CubeDesk convention).
  const AVG_N = { mo3: 3, ao5: 5, ao12: 12, ao25: 25, ao50: 50, ao100: 100, ao1000: 1000 };
  const trimOf = (n) => (n === 3 ? 0 : n === 5 ? 1 : Math.ceil(n * 0.05));
  function averageOf(vals) {
    const n = vals.length, k = trimOf(n), a = vals.slice().sort((x, y) => x - y);
    if (a[n - 1 - k] === Infinity) return Infinity;
    let s = 0; for (let i = k; i < n - k; i++) s += a[i];
    return s / (n - 2 * k);
  }
  function rolling(vals, n) {
    const out = new Float64Array(vals.length).fill(NaN);
    if (vals.length < n) return out;
    const k = trimOf(n), win = [];
    const pos = (x) => { let lo = 0, hi = win.length; while (lo < hi) { const m = (lo + hi) >> 1; if (win[m] < x) lo = m + 1; else hi = m; } return lo; };
    for (let i = 0; i < vals.length; i++) {
      win.splice(pos(vals[i]), 0, vals[i]);
      if (i >= n) win.splice(pos(vals[i - n]), 1);
      if (i >= n - 1) {
        if (win[n - 1 - k] === Infinity) out[i] = Infinity;
        else { let s = 0; for (let j = k; j < n - k; j++) s += win[j]; out[i] = s / (n - 2 * k); }
      }
    }
    return out;
  }
  const statCache = new Map();
  function stats(s) {
    const key = s.id, c = statCache.get(key);
    if (c && c.rev === s.rev && c.len === s.solves.length && c.prec === S().precision) return c;
    const vals = s.solves.map(eff);
    const ok = vals.filter((v) => v !== Infinity);
    const mean = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : NaN;
    const sd = ok.length > 1 ? Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / (ok.length - 1)) : NaN;
    let bestI = -1, worstI = -1;
    vals.forEach((v, i) => { if (v !== Infinity && (bestI < 0 || v < vals[bestI])) bestI = i; if (v !== Infinity && (worstI < 0 || v > vals[worstI])) worstI = i; });
    const avgs = {};
    for (const k in AVG_N) {
      const n = AVG_N[k];
      if (n === 1000 && vals.length < 1000) { avgs[k] = { cur: NaN, best: NaN, bestI: -1, roll: null }; continue; }
      const roll = rolling(vals, n);
      let b = NaN, bi = -1;
      for (let i = 0; i < roll.length; i++) if (!Number.isNaN(roll[i]) && (Number.isNaN(b) || roll[i] < b)) { b = roll[i]; bi = i; }
      avgs[k] = { cur: roll.length ? roll[roll.length - 1] : NaN, best: b, bestI: bi, roll };
    }
    const r = {
      rev: s.rev, len: s.solves.length, prec: S().precision, vals,
      n: vals.length, valid: ok.length, dnf: vals.length - ok.length, plus2: s.solves.filter((x) => x.p === 2).length,
      mean, sd, total: s.solves.reduce((a, x) => a + x.t, 0),
      best: bestI >= 0 ? vals[bestI] : NaN, bestI, worst: worstI >= 0 ? vals[worstI] : NaN, avgs,
    };
    statCache.set(key, r);
    return r;
  }
  function eventBests(ev) {
    const out = { single: { v: NaN }, mo3: { v: NaN }, ao5: { v: NaN }, ao12: { v: NaN }, ao50: { v: NaN }, ao100: { v: NaN } };
    for (const s of sessionsOf(ev)) {
      const st = stats(s);
      if (st.bestI >= 0 && !(st.best >= out.single.v)) out.single = { v: st.best, s, i: st.bestI };
      for (const k of ['mo3', 'ao5', 'ao12', 'ao50', 'ao100']) {
        const a = st.avgs[k];
        if (a.bestI >= 0 && a.best !== Infinity && !(a.best >= out[k].v)) out[k] = { v: a.best, s, i: a.bestI };
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- toast
  let toastTimer = 0;
  function toast(msg, action) {
    const t = $('#toast');
    t.innerHTML = esc(msg) + (action ? ` <button class="btn" style="height:26px;margin-left:8px;pointer-events:auto">${esc(action.label)}</button>` : '');
    t.style.pointerEvents = action ? 'auto' : 'none';
    if (action) t.querySelector('button').onclick = () => { action.run(); t.hidden = true; };
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 2600);
  }
  async function copyText(text, label) {
    try { await navigator.clipboard.writeText(text); toast(label || 'Copied'); }
    catch {
      openDialog((d) => {
        d.innerHTML = `<h2>Copy</h2><textarea class="textin" readonly style="min-height:140px">${esc(text)}</textarea><div class="row"><button class="btn" data-close>Done</button></div>`;
        const ta = d.querySelector('textarea'); ta.focus(); ta.select();
      });
    }
  }

  // ---------------------------------------------------------------- scrambles
  const Scr = {
    worker: null, seq: 0, pending: new Map(), queue: {}, prev: [], current: null, busy: false,
    init() {
      try {
        this.worker = new Worker('scramble.js');
        this.worker.onmessage = (e) => {
          const p = this.pending.get(e.data.id);
          if (!p) return;
          this.pending.delete(e.data.id);
          e.data.ok ? p.res(e.data.scramble) : p.rej(new Error(e.data.error));
        };
        this.worker.onerror = (e) => {
          e.preventDefault && e.preventDefault();
          this.worker = null;
          for (const [, p] of this.pending) this.local(p.event).then(p.res, p.rej);
          this.pending.clear();
        };
      } catch { this.worker = null; }
    },
    local(event) { return new Promise((res, rej) => setTimeout(() => { try { res(SCR.generate(event)); } catch (e) { rej(e); } }, 30)); },
    gen(event) {
      if (!this.worker) return this.local(event);
      return new Promise((res, rej) => {
        const id = ++this.seq;
        this.pending.set(id, { res, rej, event });
        this.worker.postMessage({ id, type: 'gen', event });
      });
    },
    fill(event) {
      const q = (this.queue[event] = this.queue[event] || []);
      if (q.length || q.filling) return;
      q.filling = true;
      this.gen(event).then((s) => { q.push(s); }).catch(() => {}).finally(() => { q.filling = false; });
    },
    async next(pushPrev = true) {
      const event = DB.current.event;
      if (pushPrev && this.current && this.current.event === event) { this.prev.push(this.current); if (this.prev.length > 30) this.prev.shift(); }
      const q = (this.queue[event] = this.queue[event] || []);
      let text;
      if (q.length) text = q.shift();
      else {
        this.current = null; renderScramble();
        try { text = await this.gen(event); } catch (e) { text = null; }
        if (DB.current.event !== event) return;
      }
      this.current = text ? { event, text, method: SCR.EVENTS[event].method } : { event, text: 'Could not generate a scramble. Press → to try again.', method: 'Error' };
      renderScramble();
      this.fill(event);
    },
    back() {
      const p = this.prev.pop();
      if (!p) { toast('No earlier scramble'); return; }
      if (this.current && this.current.method !== 'Error') {
        const q = (this.queue[this.current.event] = this.queue[this.current.event] || []);
        if (this.current.method !== 'Custom') q.unshift(this.current.text);
      }
      this.current = p; renderScramble();
    },
    custom(text) {
      if (this.current) this.prev.push(this.current);
      this.current = { event: DB.current.event, text, method: 'Custom' }; renderScramble();
    },
  };

  function renderScramble() {
    const el = $('#scrText'), c = Scr.current;
    const meth = $('#scrMethod');
    if (!c) {
      el.textContent = 'Generating scramble…'; el.classList.add('loading');
      meth.textContent = SCR.EVENTS[DB.current.event].method;
    } else {
      el.textContent = c.text; el.classList.toggle('loading', c.method === 'Error');
      meth.textContent = c.method;
      const len = c.text.length;
      const base = S().layoutResolved === 'mobile' ? [19, 16, 13.5, 12] : [24, 20, 16, 14];
      el.style.setProperty('--scr-size', (len <= 70 ? base[0] : len <= 140 ? base[1] : len <= 300 ? base[2] : base[3]) + 'px');
    }
    meth.classList.toggle('rs', meth.textContent === 'Random-state');
    meth.title = {
      'Random-state': 'Uniformly random puzzle state, solved and inverted (WCA 4b3)',
      'Random-move': 'Random legal moves, as the WCA scrambler does for this puzzle size',
      Custom: 'A scramble you entered',
    }[meth.textContent] || '';
    renderWidgets('scramble');
  }

  // ---------------------------------------------------------------- timer
  const T = { state: 'idle', inspStart: 0, start: 0, raf: 0, holdTimer: 0, ignoreUp: false, pendingInspect: false, inspecting: false, called: {}, last: null, display: '0.00' };
  const timerEl = $('#timer'), app = $('#app');
  const inspectionOn = () => S().inspection && !(EV[DB.current.event] || {}).bld;

  function setTimerText(text, extraClass) {
    if (text === T.display && !extraClass) return;
    T.display = text;
    timerEl.className = 'timer' + (extraClass ? ' ' + extraClass : '');
    timerEl.innerHTML = /^[\d:.]+$/.test(text)
      ? [...text].map((ch) => (ch >= '0' && ch <= '9' ? `<span class="d">${ch}</span>` : `<span class="p">${ch}</span>`)).join('')
      : esc(text);
  }
  function setState(st) {
    T.state = st;
    timerEl.dataset.state = st === 'inspecting' && now() - T.inspStart >= 15000 ? 'inspect-late' : st;
    app.classList.toggle('solving', st === 'running' || st === 'inspecting' || st === 'holding' || st === 'ready');
    renderHint();
  }
  function renderHint() {
    const h = $('#hint'), touch = matchMedia('(pointer: coarse)').matches;
    const key = touch ? 'touch' : '<kbd>Space</kbd>';
    let t = '';
    if (S().input === 'typing') t = 'Type a time and press <kbd>Enter</kbd>. Examples: 1234 = 12.34, 1:05.2, 9.87+, DNF';
    else if (T.state === 'running') t = touch ? 'Tap anywhere to stop' : 'Press any key to stop';
    else if (T.state === 'inspecting' || T.state === 'holding' || T.state === 'ready') t = T.state === 'ready' ? 'Release to start' : `Hold ${key} until green, then release`;
    else if (inspectionOn()) t = touch ? 'Tap to start inspection' : 'Press <kbd>Space</kbd> to start inspection';
    else t = touch ? 'Touch and hold, release to start' : 'Hold <kbd>Space</kbd>, release to start';
    h.innerHTML = t;
  }

  function loop() {
    cancelAnimationFrame(T.raf);
    const tick = () => {
      if (T.state === 'running') {
        const ms = now() - T.start, u = S().update;
        if (u === 'hidden') setTimerText('Solving', 'solving-text');
        else if (u === 'seconds') setTimerText(String(Math.floor(ms / 1000)));
        else setTimerText(fmt(ms));
      } else if (T.inspecting && (T.state === 'inspecting' || T.state === 'holding' || T.state === 'ready')) {
        const e = now() - T.inspStart;
        if (T.state === 'inspecting') {
          setTimerText(e >= 17000 ? 'DNF' : e >= 15000 ? '+2' : String(15 - Math.floor(e / 1000)));
          timerEl.dataset.state = e >= 15000 ? 'inspect-late' : 'inspecting';
        }
        // WCA A3b3 / A3b4: call 8 and 12 seconds
        if (e >= 8000 && !T.called[8]) { T.called[8] = true; alertCall(8); }
        if (e >= 12000 && !T.called[12]) { T.called[12] = true; alertCall(12); }
      } else return;
      T.raf = requestAnimationFrame(tick);
    };
    T.raf = requestAnimationFrame(tick);
  }

  let audioCtx = null;
  function beep(times) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + i * 0.18;
        o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
        o.start(t0); o.stop(t0 + 0.14);
      }
    } catch { /* audio unavailable */ }
  }
  function alertCall(sec) {
    const mode = S().alerts;
    if (mode === 'off') return;
    if (mode === 'voice' && 'speechSynthesis' in window) {
      try {
        const u = new SpeechSynthesisUtterance(sec === 8 ? 'Eight seconds' : 'Twelve seconds');
        u.rate = 1.15; speechSynthesis.cancel(); speechSynthesis.speak(u); return;
      } catch { /* fall back to beep */ }
    }
    beep(sec === 8 ? 1 : 2);
  }

  function pressStart() {
    if (T.state === 'running') { stopSolve(); T.ignoreUp = true; return; }
    if (S().input === 'typing') return;
    if (T.state === 'idle' || T.state === 'stopped') {
      if (inspectionOn()) { T.pendingInspect = true; return; }
      beginHold();
    } else if (T.state === 'inspecting') beginHold();
  }
  function pressEnd() {
    if (T.ignoreUp) { T.ignoreUp = false; return; }
    if (T.state === 'holding') {
      clearTimeout(T.holdTimer);
      setState(T.inspecting ? 'inspecting' : T.prevIdle || 'idle');
      if (!T.inspecting) showIdleTime();
      return;
    }
    if (T.state === 'ready') { startSolve(); return; }
    if (T.pendingInspect) { T.pendingInspect = false; startInspection(); }
  }
  function beginHold() {
    T.prevIdle = T.state === 'stopped' ? 'stopped' : 'idle';
    setState('holding');
    if (!T.inspecting) setTimerText(fmt(0));
    $('#resultActions').hidden = true;
    const ms = S().holdMs;
    const arm = () => { if (T.state === 'holding') setState('ready'); };
    if (ms <= 0) arm(); else T.holdTimer = setTimeout(arm, ms);
  }
  function startInspection() {
    T.inspecting = true; T.inspStart = now(); T.called = {};
    $('#resultActions').hidden = true;
    setState('inspecting'); setTimerText('15'); loop();
    keepAwake();
  }
  function startSolve() {
    let pen = 0, insp = null;
    if (T.inspecting) {
      insp = now() - T.inspStart;
      pen = insp >= 17000 ? -1 : insp >= 15000 ? 2 : 0; // WCA A4d1 / A4d2
    }
    T.inspecting = false; T.inspPen = pen; T.inspMs = insp;
    T.start = now();
    setState('running'); setTimerText(fmt(0)); loop();
    keepAwake();
  }
  function stopSolve() {
    const raw = now() - T.start;
    cancelAnimationFrame(T.raf);
    const t = S().precision === 2 ? Math.floor(raw / 10) * 10 : Math.floor(raw); // WCA 9f1: truncate
    const solve = { id: rid(), t, p: T.inspPen || 0, s: Scr.current ? Scr.current.text : '', d: Date.now() };
    if (T.inspMs != null) solve.i = Math.round(T.inspMs);
    setState('stopped');
    addSolve(solve);
    timerEl.classList.remove('settle'); void timerEl.offsetWidth; timerEl.classList.add('settle');
  }
  function cancelAttempt() {
    clearTimeout(T.holdTimer); cancelAnimationFrame(T.raf);
    T.inspecting = false; T.pendingInspect = false;
    setState('idle'); showIdleTime();
  }
  function showIdleTime() { renderLastResult(); }
  function renderLastResult() {
    const s = cur(), last = s.solves[s.solves.length - 1];
    if (!last) { setTimerText(fmt(0)); $('#resultActions').hidden = true; return; }
    if (last.p === -1) setTimerText('DNF', 'dnf');
    else { setTimerText(fmt(eff(last))); T.display = ''; if (last.p === 2) timerEl.insertAdjacentHTML('beforeend', '<span class="pen">+2</span>'); }
    $('#resultActions').hidden = false;
    syncPenaltyButtons();
  }
  function syncPenaltyButtons() {
    const s = cur(), last = s.solves[s.solves.length - 1];
    $$('#resultActions [data-pen]').forEach((b) => b.setAttribute('aria-pressed', String(!!last && String(last.p) === b.dataset.pen)));
  }

  function addSolve(solve, opts = {}) {
    const s = cur();
    const before = eventBests(s.event);
    s.solves.push(solve);
    touch(s);
    renderLastResult();
    renderStatsAll();
    if (!opts.keepScramble) Scr.next();
    // celebrate personal bests (event-wide, across sessions)
    const after = eventBests(s.event), total = sessionsOf(s.event).reduce((a, x) => a + x.solves.length, 0);
    if (total > 1) {
      const msgs = [];
      if (after.single.v < before.single.v) msgs.push('single');
      for (const k of ['ao5', 'ao12', 'ao100']) if (after[k].v < before[k].v) msgs.push(k.replace('ao', 'Ao'));
      if (msgs.length) { toast(`New personal best ${msgs.join(' + ')}`); timerEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' }); }
    }
  }
  function setPenalty(solve, p, s = cur()) {
    solve.p = p; touch(s);
    if (s.solves[s.solves.length - 1] === solve && T.state !== 'running') showIdleTime();
    renderStatsAll();
  }
  function deleteSolve(solve, s = cur()) {
    const idx = s.solves.indexOf(solve);
    if (idx < 0) return;
    s.solves.splice(idx, 1); touch(s);
    if (T.state === 'stopped' || T.state === 'idle') showIdleTime();
    renderStatsAll();
    toast('Solve deleted', { label: 'Undo', run: () => { s.solves.splice(idx, 0, solve); touch(s); showIdleTime(); renderStatsAll(); } });
  }

  // typing mode (WCA results typed from a stackmat or paper)
  function parseTyped(str) {
    let s = String(str).trim().toLowerCase();
    if (!s) return null;
    if (s.startsWith('dnf')) { const inner = s.replace(/^dnf\(?|\)?$/g, ''); const p = inner ? parseTyped(inner) : null; return { t: p ? p.t : 0, p: -1 }; }
    let pen = 0;
    if (s.endsWith('+')) { pen = 2; s = s.slice(0, -1); }
    let ms;
    if (/^\d+$/.test(s)) {
      // digits only: last two are hundredths (1234 = 12.34, 10345 = 1:03.45)
      const d = s.padStart(3, '0');
      const cs = +d.slice(-2), rest = d.slice(0, -2);
      const sec = rest.length > 2 ? +rest.slice(-2) : +rest, min = rest.length > 2 ? +rest.slice(0, -2) : 0;
      ms = (min * 60 + sec) * 1000 + cs * 10;
    } else {
      const m = /^(?:(\d+):)?(\d+(?:\.\d*)?)$/.exec(s);
      if (!m) return null;
      ms = Math.round(((+m[1] || 0) * 60 + parseFloat(m[2])) * 1000);
    }
    if (!(ms > 0)) return null;
    return { t: S().precision === 2 ? Math.floor(ms / 10) * 10 : ms, p: pen };
  }

  // ---------------------------------------------------------------- input
  const isTextTarget = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  const overlayOpen = () => !!$('#overlay').querySelector(':scope > :not(.out)');
  let spaceDown = false;

  document.addEventListener('keydown', (e) => {
    if (T.state === 'running') {
      e.preventDefault(); stopSolve();
      if (e.code === 'Space' || e.key === ' ') { spaceDown = true; T.ignoreUp = true; }
      return;
    }
    if (e.key === 'Escape') {
      if (overlayOpen()) { closeOverlay(); return; }
      if (app.classList.contains('zen')) { setZen(false); return; }
      if (T.state !== 'idle' && T.state !== 'stopped') { cancelAttempt(); return; }
    }
    if (overlayOpen() || isTextTarget(e.target)) return;
    const mod = e.ctrlKey || e.metaKey;
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (e.repeat || spaceDown) return;
      spaceDown = true; pressStart(); return;
    }
    if (T.state !== 'idle' && T.state !== 'stopped') return;
    const last = cur().solves[cur().solves.length - 1];
    if (mod && last && ['1', '2', '3'].includes(e.key)) { e.preventDefault(); setPenalty(last, { 1: 0, 2: 2, 3: -1 }[e.key]); return; }
    if (mod && last && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); deleteSolve(last); return; }
    if (mod || e.altKey) return;
    if (e.key === 'ArrowRight') { Scr.next(); return; }
    if (e.key === 'ArrowLeft') { Scr.back(); return; }
    if (e.key === 'z' || e.key === 'Z') { setZen(!app.classList.contains('zen')); return; }
    if (e.key === ',') { openSettings(); return; }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') {
      if (!spaceDown) return;
      spaceDown = false;
      if (overlayOpen() || isTextTarget(e.target)) return;
      e.preventDefault(); pressEnd();
    }
  });
  window.addEventListener('blur', () => { if (spaceDown) { spaceDown = false; if (T.state === 'holding') pressEnd(); } });

  const stage = $('#stage');
  let activePointer = null;
  const pointerAllowed = (e) => e.pointerType !== 'mouse' || S().mouseStart;
  stage.addEventListener('pointerdown', (e) => {
    if (T.state === 'running') return; // handled on document
    if (e.target.closest('button, input, a, select, textarea, .result-actions')) return;
    if (!pointerAllowed(e) || S().input === 'typing') return;
    e.preventDefault();
    activePointer = e.pointerId;
    try { stage.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    pressStart();
  });
  const endPointer = (e) => { if (activePointer !== e.pointerId) return; activePointer = null; pressEnd(); };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerdown', (e) => {
    if (T.state !== 'running') return;
    e.preventDefault(); e.stopImmediatePropagation(); stopSolve();
    activePointer = e.pointerId; T.ignoreUp = true;
  }, true);
  document.addEventListener('pointerup', (e) => { if (activePointer === e.pointerId && !stage.contains(e.target)) { activePointer = null; T.ignoreUp = false; } }, true);

  let wakeLock = null;
  async function keepAwake() {
    if (wakeLock || !navigator.wakeLock) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } catch { /* refused */ }
  }

  // ---------------------------------------------------------------- appearance
  function hexToHsl(hex) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex) || [0, '14', 'b8', '96'];
    const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    }
    return { h, s: s * 100, l: l * 100, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
  }
  const hostTheme = document.documentElement.getAttribute('data-theme');
  const loadedFonts = new Set(['Outfit', 'Onest']);
  function ensureFont(name) {
    if (loadedFonts.has(name) || !FONTS[name]) return;
    loadedFonts.add(name);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${FONTS[name].css}&display=swap`;
    document.head.appendChild(l);
  }
  function applySettings() {
    const st = S(), root = document.documentElement.style;
    if (st.theme === 'system') { if (hostTheme) document.documentElement.setAttribute('data-theme', hostTheme); else document.documentElement.removeAttribute('data-theme'); }
    else document.documentElement.setAttribute('data-theme', st.theme);
    const hsl = hexToHsl(st.accent);
    root.setProperty('--accent', st.accent);
    root.setProperty('--accent-soft', `color-mix(in srgb, ${st.accent} 18%, transparent)`);
    root.setProperty('--accent-ink', hsl.lum > 0.55 ? '#0b1210' : '#ffffff');
    root.setProperty('--acc-h', String(Math.round(hsl.h)));
    root.setProperty('--acc-s', Math.round(Math.min(hsl.s, 85)) + '%');
    root.setProperty('--glass-alpha', String(st.glass));
    root.setProperty('--blur', st.blur + 'px');
    root.setProperty('--radius', st.radius + 'px');
    root.setProperty('--timer-scale', String(st.timerScale));
    root.setProperty('--scr-scale', String(st.scrScale));
    root.setProperty('--timer-weight', String(st.timerWeight));
    ensureFont(st.fontTimer);
    root.setProperty('--font-timer', `"${st.fontTimer}", "Segoe UI", system-ui, sans-serif`);
    root.setProperty('--digit-w', (FONTS[st.fontTimer] || FONTS.Outfit).w);
    root.setProperty('--font-ui', `${UI_FONTS[st.fontUi] || UI_FONTS.Onest}, "Segoe UI", system-ui, -apple-system, sans-serif`);
    document.body.classList.toggle('no-sheen', !st.sheen);
    document.body.classList.toggle('refract', !!st.refract && !!(window.CSS && CSS.supports && CSS.supports('backdrop-filter', 'url(#a) blur(1px)')));
    app.classList.toggle('focus', !!st.focus);
    const field = $('#field'), photo = $('#fieldPhoto');
    field.dataset.mode = st.bg;
    const img = st.bg === 'image' ? ls.get(LS_BG) : null;
    photo.hidden = !img;
    photo.style.backgroundImage = img ? `url("${img}")` : '';
    $('#typing').hidden = st.input !== 'typing';
    renderHint();
  }

  // ---------------------------------------------------------------- layout
  function detectLayout() {
    const st = S();
    if (st.layout !== 'auto') return st.layout;
    const w = window.innerWidth, h = window.innerHeight;
    const coarse = matchMedia('(pointer: coarse)').matches;
    if (w > h && Math.min(w, h) >= 600 && w >= 900) return coarse || w < 1180 ? 'tablet' : 'desktop';
    return 'mobile';
  }
  const SLOTS = { desktop: 3, tablet: 2, mobile: 1 };
  function renderLayout() {
    const layout = detectLayout();
    S().layoutResolved = layout;
    app.dataset.layout = layout;
    const container = layout === 'tablet' ? $('#side') : $('#dock');
    const other = layout === 'tablet' ? $('#dock') : $('#side');
    other.innerHTML = '';
    const types = S().widgets[layout].slice(0, SLOTS[layout]);
    while (types.length < SLOTS[layout]) types.push(Object.keys(WIDGETS).find((k) => !types.includes(k)));
    S().widgets[layout] = types;
    const existing = [...container.children];
    if (existing.length !== types.length || existing.some((el, i) => el.dataset.type !== types[i])) {
      container.innerHTML = types.map((t, i) => widgetShell(t, layout, i)).join('');
      $$('.widget', container).forEach(bindWidget);
      var rebuilt = true;
    }
    renderWidgets();
    if (typeof rebuilt !== 'undefined') $$('.w-body', container).forEach((b, i) => { b.style.animationDelay = i * 70 + 'ms'; b.classList.add('enter'); });
    renderScramble();
  }
  function widgetShell(type, layout, i) {
    const opts = Object.entries(WIDGETS).map(([k, v]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${v}</option>`).join('');
    return `<div class="widget glass" data-type="${type}" data-slot="${i}" data-layout="${layout}">
      <div class="w-head"><label class="w-title"><span class="sr">Widget</span><select aria-label="Choose widget">${opts}</select>${icon(I.down)}</label><div class="w-extra"></div></div>
      <div class="w-body"></div></div>`;
  }
  function bindWidget(w) {
    $('select', w).addEventListener('change', (e) => {
      const { layout, slot } = w.dataset;
      S().widgets[layout][+slot] = e.target.value;
      touchSettings();
      renderLayout();
    });
    // swipe between widgets on phones
    if (w.dataset.layout === 'mobile') {
      let sx = null, sy = null;
      w.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
      w.addEventListener('pointerup', (e) => {
        if (sx == null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
          const keys = Object.keys(WIDGETS), i = keys.indexOf(w.dataset.type);
          S().widgets.mobile[0] = keys[(i + (dx < 0 ? 1 : keys.length - 1)) % keys.length];
          touchSettings(); renderLayout();
        }
      });
    }
  }
  const ro = new ResizeObserver((entries) => {
    for (const en of entries) { const w = en.target.closest('.widget'); if (w && (w.dataset.type === 'chart')) renderWidget(w); }
  });
  let resizeT = 0;
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (detectLayout() !== app.dataset.layout) renderLayout(); else renderScramble(); }, 120); });

  // ---------------------------------------------------------------- widgets
  function renderWidgets(only) {
    $$('#dock .widget, #side .widget').forEach((w) => { if (!only || w.dataset.type === only) renderWidget(w); });
  }
  function renderStatsAll() {
    renderQuick();
    renderWidgets();
    $('#sessionLbl').textContent = `${cur().name} · ${cur().solves.length}`;
  }
  function emptyState(msg) {
    return `<div class="empty"><div>${msg}</div><button class="btn" data-sample>Load sample solves</button></div>`;
  }
  function renderWidget(w) {
    const type = w.dataset.type, body = $('.w-body', w), extra = $('.w-extra', w);
    const s = cur(), st = stats(s);
    body.className = 'w-body';
    extra.innerHTML = '';
    try { (WR[type] || WR.stats)(body, extra, s, st, w); } catch (e) { body.innerHTML = `<div class="empty">This widget hit an error: ${esc(e.message)}</div>`; }
    const sb = $('[data-sample]', body);
    if (sb) sb.onclick = loadSamples;
  }
  const WR = {
    scramble(body, extra) {
      const c = Scr.current, ev = DB.current.event;
      extra.textContent = EV[ev].name;
      body.classList.add('center');
      if (!c) { body.innerHTML = '<div class="empty">Generating…</div>'; return; }
      const svg = c.method === 'Error' ? '' : PZ.draw(ev, c.text);
      body.innerHTML = svg ? `<div class="preview">${svg}</div>` : `<div class="empty">No preview for ${esc(EV[ev].name)} yet. Scramble with white on top and green in front.</div>`;
    },
    stats(body, extra, s, st) {
      if (!st.n) { body.classList.add('center'); body.innerHTML = emptyState('Solve to see averages here. Ao5 follows WCA rules: best and worst dropped, one DNF allowed.'); return; }
      extra.textContent = `${st.n} solve${st.n === 1 ? '' : 's'}`;
      const keys = usesMo3(s.event) ? ['mo3', 'ao5', 'ao12', 'ao50', 'ao100'] : ['ao5', 'ao12', 'ao50', 'ao100', 'ao1000'];
      const rows = [`<tr class="clickable" data-single="cur"><td>Single</td><td>${fmt(st.vals[st.n - 1])}</td><td class="best">${fmt(st.best)}</td></tr>`]
        .concat(keys.filter((k) => k !== 'ao1000' || st.n >= 1000).map((k) => {
          const a = st.avgs[k];
          return `<tr class="clickable" data-avg="${k}"><td>${k === 'mo3' ? 'Mo3' : 'Ao' + AVG_N[k]}</td><td>${fmt(a.cur, true)}</td><td class="best">${fmt(a.best, true)}</td></tr>`;
        }));
      body.innerHTML = `<table class="stats-table"><thead><tr><th></th><th>Current</th><th>Best</th></tr></thead><tbody>${rows.join('')}</tbody></table>
        <div class="kv"><div><span class="k">Mean</span><span class="v">${fmt(st.mean, true)}</span></div>
        <div><span class="k">σ</span><span class="v">${Number.isNaN(st.sd) ? '–' : (st.sd / 1000).toFixed(2)}</span></div>
        <div><span class="k">Solved</span><span class="v">${st.valid}/${st.n}</span></div>
        <div><span class="k">+2 / DNF</span><span class="v">${st.plus2} / ${st.dnf}</span></div>
        <div><span class="k">Worst</span><span class="v">${fmt(st.worst)}</span></div>
        <div><span class="k">Time spent</span><span class="v">${fmtDuration(st.total)}</span></div></div>`;
      $$('tr[data-avg]', body).forEach((tr) => tr.addEventListener('click', (e) => {
        const k = tr.dataset.avg, a = st.avgs[k], best = e.target.closest('td.best');
        const end = best ? a.bestI : st.n - 1;
        if (end < AVG_N[k] - 1 || end < 0) return;
        openAverage(s, end, AVG_N[k]);
      }));
      $('tr[data-single]', body).addEventListener('click', (e) => {
        const i = e.target.closest('td.best') ? st.bestI : st.n - 1;
        if (i >= 0) openSolve(s, s.solves[i]);
      });
    },
    chart(body, extra, s, st, w) {
      ro.observe(body);
      const win = S().chartWindow;
      extra.innerHTML = `<div class="legend"><span><i style="background:var(--fg-3)"></i>Single</span><span><i style="background:var(--accent)"></i>${usesMo3(s.event) ? 'Mo3' : 'Ao5'}</span><span><i style="background:var(--series-2)"></i>Ao12</span></div>`;
      if (st.n < 2) { body.classList.add('center'); body.innerHTML = emptyState('Your time trend appears after two solves.'); return; }
      const start = win && st.n > win ? st.n - win : 0;
      const vals = st.vals.slice(start);
      const k1 = usesMo3(s.event) ? 'mo3' : 'ao5';
      const a1 = st.avgs[k1].roll.slice(start), a2 = st.avgs.ao12.roll.slice(start);
      const W = Math.max(200, body.clientWidth - 28), H = Math.max(110, body.clientHeight - 16);
      const fin = vals.filter((v) => v !== Infinity);
      if (!fin.length) { body.innerHTML = '<div class="empty">Every solve in this range is a DNF.</div>'; return; }
      const sorted = fin.slice().sort((a, b) => a - b);
      let lo = sorted[0], hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.97))];
      if (hi - lo < 500) { lo -= 250; hi += 250; }
      const step = niceStep((hi - lo) / 4);
      lo = Math.max(0, Math.floor(lo / step) * step); hi = Math.ceil(hi / step) * step;
      const L = 40, R = 6, Tp = 8, B = 16;
      const x = (i) => L + (vals.length === 1 ? 0 : (i / (vals.length - 1)) * (W - L - R));
      const y = (v) => Tp + (1 - (Math.min(v, hi) - lo) / (hi - lo)) * (H - Tp - B);
      let g = '';
      for (let v = lo; v <= hi + 1; v += step) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${fmtAxis(v)}</text>`;
      const path = (arr) => { let d = '', pen = false; arr.forEach((v, i) => { if (Number.isNaN(v) || v === Infinity) { pen = false; return; } d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1); pen = true; }); return d; };
      let pts = '';
      vals.forEach((v, i) => {
        const gi = start + i;
        if (v === Infinity) pts += `<text x="${x(i)}" y="${Tp + 4}" text-anchor="middle" style="fill:var(--bad)">×</text>`;
        else pts += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${gi === st.bestI ? 4 : 2.2}" fill="${gi === st.bestI ? 'var(--accent)' : 'var(--fg-3)'}" opacity="${gi === st.bestI ? 1 : 0.55}" data-i="${gi}"><title>#${gi + 1}: ${fmtSolve(s.solves[gi])}</title></circle>`;
      });
      const nTicks = Math.min(6, vals.length);
      let xt = '';
      for (let k = 0; k < nTicks; k++) { const i = Math.round((k / Math.max(1, nTicks - 1)) * (vals.length - 1)); xt += `<text x="${x(i)}" y="${H - 2}" text-anchor="middle">${start + i + 1}</text>`; }
      body.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Time trend">${g}${xt}
        <path d="${path(vals)}" fill="none" stroke="var(--fg-3)" stroke-opacity=".35" stroke-width="1"/>
        <path d="${path(a2)}" fill="none" stroke="var(--series-2)" stroke-width="2" stroke-linejoin="round"/>
        <path d="${path(a1)}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round"/>${pts}</svg>`;
      $$('circle[data-i]', body).forEach((c) => { c.style.cursor = 'pointer'; c.addEventListener('click', () => openSolve(s, s.solves[+c.dataset.i])); });
      void w;
    },
    dist(body, extra, s, st) {
      const fin = st.vals.filter((v) => v !== Infinity);
      if (fin.length < 3) { body.classList.add('center'); body.innerHTML = emptyState('A distribution of your times appears after a few solves.'); return; }
      const sorted = fin.slice().sort((a, b) => a - b);
      const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
      let lo = p(0.02), hi = p(0.98);
      const size = binSize(hi - lo);
      lo = Math.floor(lo / size) * size; hi = Math.ceil((hi + 1) / size) * size;
      const bins = [];
      for (let v = lo; v < hi; v += size) bins.push({ v, n: 0 });
      let under = 0, over = 0;
      for (const v of fin) { if (v < lo) under++; else if (v >= hi) over++; else bins[Math.floor((v - lo) / size)].n++; }
      if (under) bins[0].n += under;
      if (over) bins[bins.length - 1].n += over;
      const max = Math.max(...bins.map((b) => b.n));
      const meanBin = Math.floor((st.mean - lo) / size);
      extra.textContent = `${fin.length} solved · ${fmtAxis(size)}s bins`;
      body.innerHTML = `<div class="hist">${bins.map((b, i) => `<div class="row ${i === meanBin ? 'mean' : ''}" title="${fmtAxis(b.v)}–${fmtAxis(b.v + size)} s: ${b.n}"><span class="lab">${fmtAxis(b.v)}+</span><span class="bar" style="width:${(b.n / max) * 100}%"></span><span class="n">${b.n}</span></div>`).join('')}</div>`;
    },
    history(body, extra, s, st) {
      if (!st.n) { body.classList.add('center'); body.innerHTML = emptyState('Your latest solves will be listed here.'); return; }
      const k1 = usesMo3(s.event) ? 'mo3' : 'ao5';
      extra.innerHTML = `<button data-all>See all</button>`;
      $('[data-all]', extra).onclick = () => openSolves();
      const rows = [];
      for (let i = st.n - 1; i >= Math.max(0, st.n - 60); i--) {
        const x = s.solves[i];
        rows.push(`<div class="r" data-i="${i}"><span class="i">${i + 1}</span><span class="t ${x.p === -1 ? 'dnf-t' : ''} ${i === st.bestI ? 'pb-flag' : ''}">${fmtSolve(x)}${x.c ? ' <span class="mark">•</span>' : ''}</span><span class="a">${fmt(st.avgs[k1].roll[i], true)}</span><span class="a">${fmt(st.avgs.ao12.roll[i], true)}</span></div>`);
      }
      body.innerHTML = `<div class="hist-list"><div class="r head"><span>#</span><span>Time</span><span class="a">${k1 === 'mo3' ? 'Mo3' : 'Ao5'}</span><span class="a">Ao12</span></div>${rows.join('')}</div>`;
      $$('.r[data-i]', body).forEach((r) => r.addEventListener('click', () => openSolve(s, s.solves[+r.dataset.i])));
    },
    consistency(body, extra, s, st) {
      const fin = st.vals.filter((v) => v !== Infinity);
      if (fin.length < 5) { body.classList.add('center'); body.innerHTML = emptyState('Consistency needs at least five solved attempts.'); return; }
      const target = S().subX ? S().subX * 1000 : Math.ceil(st.mean / 1000) * 1000;
      const recent = st.vals.slice(-100);
      const under = recent.filter((v) => v < target).length, pct = Math.round((under / recent.length) * 100);
      const sdOf = (arr) => { const f = arr.filter((v) => v !== Infinity); if (f.length < 2) return NaN; const m = f.reduce((a, b) => a + b, 0) / f.length; return Math.sqrt(f.reduce((a, b) => a + (b - m) ** 2, 0) / (f.length - 1)); };
      const sd12 = sdOf(st.vals.slice(-12)), sd50 = sdOf(st.vals.slice(-50));
      const C = 2 * Math.PI * 38;
      extra.textContent = S().subX ? `Target sub-${S().subX}` : `Auto target sub-${target / 1000}`;
      body.innerHTML = `<div class="ring-wrap"><svg class="ring" viewBox="0 0 92 92" role="img" aria-label="${pct}% under ${target / 1000} seconds">
          <circle class="track" cx="46" cy="46" r="38"/><circle class="val" cx="46" cy="46" r="38" stroke-dasharray="${(pct / 100) * C} ${C}"/>
          <text x="46" y="49">${pct}%</text><text class="s" x="46" y="64">SUB-${target / 1000}</text></svg>
        <div class="kv" style="margin:0"><div><span class="k">σ last 12</span><span class="v">${Number.isNaN(sd12) ? '–' : (sd12 / 1000).toFixed(2)}</span></div>
        <div><span class="k">σ last 50</span><span class="v">${Number.isNaN(sd50) ? '–' : (sd50 / 1000).toFixed(2)}</span></div>
        <div><span class="k">Variation</span><span class="v">${((st.sd / st.mean) * 100).toFixed(1)}%</span></div>
        <div><span class="k">Spread</span><span class="v">${fmt(st.best)}–${fmt(st.worst)}</span></div></div></div>
        <p class="note" style="margin:12px 0 0">${under} of your last ${recent.length} attempts were under ${target / 1000} s. Set your own target in Customize › Stats.</p>`;
    },
    pbs(body, extra, s) {
      const b = eventBests(s.event);
      extra.textContent = EV[s.event].name;
      const keys = [['single', 'Single'], ...(usesMo3(s.event) ? [['mo3', 'Mo3']] : []), ['ao5', 'Ao5'], ['ao12', 'Ao12'], ['ao50', 'Ao50'], ['ao100', 'Ao100']];
      if (Number.isNaN(b.single.v)) { body.classList.add('center'); body.innerHTML = emptyState(`Personal bests across all your ${esc(EV[s.event].name)} sessions show here.`); return; }
      body.innerHTML = `<table class="stats-table"><thead><tr><th>Best</th><th>Time</th><th>Date</th></tr></thead><tbody>${keys.map(([k, lab]) => {
        const r = b[k];
        if (Number.isNaN(r.v)) return `<tr><td>${lab}</td><td>–</td><td></td></tr>`;
        const d = r.s.solves[r.i].d;
        return `<tr class="clickable" data-k="${k}"><td>${lab}</td><td class="best">${fmt(r.v, k !== 'single')}</td><td style="color:var(--fg-3);font-size:12.5px">${fmtDay(d)}</td></tr>`;
      }).join('')}</tbody></table><p class="note" style="margin:10px 0 0">Across ${sessionsOf(s.event).length} session${sessionsOf(s.event).length === 1 ? '' : 's'}.</p>`;
      $$('tr[data-k]', body).forEach((tr) => tr.addEventListener('click', () => {
        const r = b[tr.dataset.k];
        if (tr.dataset.k === 'single') openSolve(r.s, r.s.solves[r.i]); else openAverage(r.s, r.i, AVG_N[tr.dataset.k]);
      }));
    },
    activity(body, extra) {
      const days = 14, dayMs = 86400000, today = new Date(); today.setHours(0, 0, 0, 0);
      const t0 = today.getTime() - (days - 1) * dayMs;
      const counts = new Array(days).fill(0); let todayMs = 0, any = false;
      for (const s of DB.sessions) for (const x of s.solves) {
        if (x.d >= t0) { const i = Math.floor((x.d - t0) / dayMs); if (i >= 0 && i < days) { counts[i]++; any = true; if (i === days - 1) todayMs += x.t; } }
      }
      let streak = 0; for (let i = days - 1; i >= 0 && counts[i]; i--) streak++;
      extra.textContent = 'All events · 14 days';
      if (!any) { body.classList.add('center'); body.innerHTML = emptyState('Daily solve counts across every event show up here.'); return; }
      const max = Math.max(...counts);
      body.innerHTML = `<div style="display:grid;grid-template-rows:minmax(0,1fr) auto;gap:10px;height:100%">
        <div class="bars">${counts.map((n, i) => { const d = new Date(t0 + i * dayMs); return `<div class="b ${n ? '' : 'zero'} ${i === days - 1 ? 'today' : ''}" title="${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${n} solves"><span class="col" style="height:${n ? Math.max(4, (n / max) * 100) : 4}%"></span><span class="lab">${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>`; }).join('')}</div>
        <div class="kv" style="margin:0"><div><span class="k">Today</span><span class="v">${counts[days - 1]}</span></div><div><span class="k">Time today</span><span class="v">${fmtDuration(todayMs)}</span></div><div><span class="k">Streak</span><span class="v">${streak} day${streak === 1 ? '' : 's'}</span></div></div></div>`;
    },
  };
  function niceStep(raw) {
    const steps = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 15000, 30000, 60000, 120000, 300000, 600000];
    return steps.find((s) => s >= raw) || 600000;
  }
  function binSize(range) {
    const steps = [100, 200, 250, 500, 1000, 2000, 5000, 10000, 15000, 30000, 60000];
    return steps.find((s) => range / s <= 14) || 60000;
  }
  function fmtAxis(ms) {
    if (ms >= 60000) { const m = Math.floor(ms / 60000), s = Math.round((ms % 60000) / 1000); return `${m}:${String(s).padStart(2, '0')}`; }
    const s = ms / 1000;
    return Number.isInteger(s) ? String(s) : s.toFixed(ms % 100 ? 2 : 1);
  }

  function renderQuick() {
    const s = cur(), st = stats(s), keys = S().quick;
    const out = keys.map((k) => {
      let v;
      if (k === 'best') v = fmt(st.best);
      else if (k === 'mean') v = fmt(st.mean, true);
      else if (k === 'count') v = String(st.n);
      else if (k === 'sd') v = Number.isNaN(st.sd) ? '–' : (st.sd / 1000).toFixed(2);
      else v = fmt(st.avgs[k].cur, true);
      const lab = (QUICK_OPTS.find((q) => q[0] === k) || [k, k])[1];
      return `<div class="q"><span class="k">${lab}</span><span class="v">${v}</span></div>`;
    });
    $('#quick').innerHTML = out.join('');
  }

  // ---------------------------------------------------------------- overlays
  const overlay = $('#overlay');
  let lastFocus = null;
  function closeOverlay() {
    const kids = [...overlay.children].filter((c) => !c.classList.contains('out'));
    if (!kids.length) return;
    kids.forEach((c) => c.classList.add('out'));
    setTimeout(() => kids.forEach((c) => c.remove()), 200);
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch { /* ignore */ } }
  }
  function openPop(anchor, build) {
    lastFocus = document.activeElement;
    overlay.innerHTML = '<div class="scrim clear"></div><div class="pop glass" role="menu"></div>';
    const pop = $('.pop', overlay);
    build(pop);
    const r = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(8, r.left), window.innerWidth - pop.offsetWidth - 8);
    pop.style.left = left + 'px';
    pop.style.setProperty('--origin', `${Math.max(0, r.left + r.width / 2 - left)}px 0`);
    pop.style.top = Math.min(r.bottom + 8, window.innerHeight - pop.offsetHeight - 8) + 'px';
    $('.scrim', overlay).addEventListener('pointerdown', closeOverlay);
    const first = $('button', pop); if (first) first.focus({ preventScroll: true });
  }
  function openSheet(title, build, tabs) {
    lastFocus = document.activeElement;
    overlay.innerHTML = `<div class="scrim"></div><div class="sheet glass" role="dialog" aria-label="${esc(title)}"><div class="sheet-head"><h2>${esc(title)}</h2><div class="grow"></div><button class="iconbtn flat" data-close aria-label="Close">${icon(I.close)}</button></div>${tabs ? '<div class="tabs" role="tablist"></div>' : ''}<div class="sheet-body"></div></div>`;
    $('.scrim', overlay).addEventListener('pointerdown', closeOverlay);
    $('[data-close]', overlay).addEventListener('click', closeOverlay);
    build($('.sheet-body', overlay), $('.tabs', overlay), $('.sheet', overlay));
  }
  function openDialog(build) {
    lastFocus = lastFocus || document.activeElement;
    const keep = overlay.querySelector('.sheet:not(.out)');
    if (!keep) overlay.innerHTML = '';
    $$('.dialog, .dialog-scrim', overlay).forEach((n) => n.remove());
    overlay.insertAdjacentHTML('beforeend', '<div class="scrim dialog-scrim" style="z-index:42"></div><div class="dialog glass" role="dialog"></div>');
    const d = $('.dialog', overlay), sc = $('.dialog-scrim', overlay);
    const close = () => {
      d.classList.add('out'); sc.classList.add('out');
      setTimeout(() => { d.remove(); sc.remove(); }, 200);
      if (!overlay.querySelector(':scope > :not(.out)')) closeOverlay();
    };
    sc.addEventListener('pointerdown', close);
    build(d, close);
    $$('[data-close]', d).forEach((b) => b.addEventListener('click', close));
    return close;
  }
  function confirmDialog(title, msg, label, run) {
    openDialog((d, close) => {
      d.innerHTML = `<h2>${esc(title)}</h2><p class="note" style="margin:0;font-size:14px">${esc(msg)}</p><div class="row"><button class="btn" data-close>Cancel</button><button class="btn danger solid" data-ok>${esc(label)}</button></div>`;
      $('[data-ok]', d).onclick = () => { close(); run(); };
      $('[data-ok]', d).focus();
    });
  }

  function openSolve(s, x) {
    const i = s.solves.indexOf(x);
    if (i < 0) return;
    openDialog((d, close) => {
      const draw = () => {
        d.innerHTML = `<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><div class="big">${esc(fmtSolve(x))}</div><div class="meta">Solve ${i + 1} · ${esc(fmtDate(x.d))}${x.i != null ? ` · inspected ${(x.i / 1000).toFixed(1)} s` : ''}</div></div>
          <div class="segctl" role="group" aria-label="Penalty">${[[0, 'OK'], [2, '+2'], [-1, 'DNF']].map(([p, l]) => `<button data-p="${p}" aria-pressed="${x.p === p}">${l}</button>`).join('')}</div>
          ${x.s ? `<div class="prev">${PZ.draw(s.event, x.s) || ''}</div><div class="scr">${esc(x.s)}</div>` : '<div class="meta">No scramble recorded.</div>'}
          <label class="note" for="cmt">Note</label><textarea id="cmt" class="textin" style="font-family:var(--font-ui);min-height:64px" placeholder="Lockup on the last layer, new algorithm, lucky skip…">${esc(x.c || '')}</textarea>
          <div class="row"><button class="btn danger" data-del>${icon(I.trash)}Delete</button><button class="btn" data-copy>${icon(I.copy)}Copy</button><button class="btn primary" data-close>Done</button></div>`;
        $$('[data-p]', d).forEach((b) => b.onclick = () => { setPenalty(x, +b.dataset.p, s); draw(); });
        $('#cmt', d).addEventListener('change', (e) => { const v = e.target.value.trim(); if (v) x.c = v; else delete x.c; touch(s); renderWidgets(); });
        $('[data-del]', d).onclick = () => { close(); deleteSolve(x, s); };
        $('[data-copy]', d).onclick = () => copyText(`${fmtSolve(x)}   ${x.s}`, 'Solve copied');
        $$('[data-close]', d).forEach((b) => b.addEventListener('click', close));
      };
      draw();
    });
  }
  function openAverage(s, end, n) {
    const list = s.solves.slice(end - n + 1, end + 1), vals = list.map(eff);
    const k = trimOf(n), order = vals.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const trimmed = new Set([...order.slice(0, k), ...order.slice(n - k)].map((o) => o[1]));
    const avg = averageOf(vals), label = n === 3 ? 'Mean of 3' : `Average of ${n}`;
    const lines = list.map((x, i) => `${i + 1}. ${trimmed.has(i) ? '(' + fmtSolve(x) + ')' : fmtSolve(x)}   ${x.s.replace(/\n/g, ' ')}`);
    const text = `${label}: ${fmt(avg, true)}\n${EV[s.event].name} · ${fmtDay(list[list.length - 1].d)}\n\n${lines.join('\n')}`;
    openDialog((d) => {
      d.innerHTML = `<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><div class="big">${fmt(avg, true)}</div><div class="meta">${label} · solves ${end - n + 2}–${end + 1}</div></div>
        <div class="solves-list">${list.map((x, i) => `<div class="r" data-i="${i}"><span class="i">${end - n + 2 + i}</span><span class="t ${x.p === -1 ? 'dnf-t' : ''}">${trimmed.has(i) ? '(' + esc(fmtSolve(x)) + ')' : esc(fmtSolve(x))}</span><span class="a" style="grid-column:span 2;font-family:var(--font-mono);font-size:11.5px;color:var(--fg-3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.s)}</span></div>`).join('')}</div>
        <p class="note" style="margin:0">${n === 3 ? 'Mean of 3: any DNF makes the mean a DNF (WCA 9f11).' : n === 5 ? 'Best and worst are dropped. One DNF counts as the worst; two make the average a DNF (WCA 9f9).' : `The best and worst ${k} are dropped (5% each side). More DNFs than that make it a DNF.`}</p>
        <div class="row"><button class="btn" data-copy>${icon(I.copy)}Copy</button><button class="btn primary" data-close>Done</button></div>`;
      $('[data-copy]', d).onclick = () => copyText(text, 'Average copied');
      $$('.r[data-i]', d).forEach((r) => r.addEventListener('click', () => openSolve(s, list[+r.dataset.i])));
    });
  }

  function openSolves() {
    const s = cur(), st = stats(s);
    openSheet(`${s.name}`, (body) => {
      let shown = 150;
      const k1 = usesMo3(s.event) ? 'mo3' : 'ao5';
      const draw = () => {
        if (!st.n) { body.innerHTML = '<div class="empty" style="margin-top:40px">No solves in this session yet.</div>'; return; }
        const rows = [];
        for (let i = st.n - 1; i >= Math.max(0, st.n - shown); i--) {
          const x = s.solves[i];
          rows.push(`<div class="r" data-i="${i}"><span class="i">${i + 1}</span><span class="t ${x.p === -1 ? 'dnf-t' : ''}">${esc(fmtSolve(x))}</span><span class="a">${fmt(st.avgs[k1].roll[i], true)}</span><span class="a">${fmt(st.avgs.ao12.roll[i], true)}</span>${x.c ? `<span class="c">${esc(x.c)}</span>` : ''}</div>`);
        }
        body.innerHTML = `<p class="note" style="margin:0 0 10px">${EV[s.event].name} · ${st.n} solves · mean ${fmt(st.mean, true)}</p>
          <div class="solves-list"><div class="r" style="cursor:default;border-top:0"><span class="i">#</span><span class="i">TIME</span><span class="i" style="text-align:right">${k1.toUpperCase()}</span><span class="i" style="text-align:right">AO12</span></div>${rows.join('')}</div>
          ${st.n > shown ? '<div style="display:flex;justify-content:center;margin-top:12px"><button class="btn" data-more>Show more</button></div>' : ''}`;
        $$('.r[data-i]', body).forEach((r) => r.addEventListener('click', () => openSolve(s, s.solves[+r.dataset.i])));
        const more = $('[data-more]', body); if (more) more.onclick = () => { shown += 300; draw(); };
      };
      draw();
    });
  }

  // ---------------------------------------------------------------- menus
  function openEventMenu() {
    openPop($('#eventBtn'), (pop) => {
      const groups = [['Cubes', ['333', '222', '444', '555', '666', '777']], ['One-handed & other puzzles', ['333oh', 'clock', 'minx', 'pyram', 'skewb', 'sq1']], ['Blindfolded & fewest moves', ['333bf', '444bf', '555bf', '333fm']]];
      pop.innerHTML = groups.map(([g, ids]) => `<div class="grp">${g}</div>` + ids.map((id) => {
        const n = sessionsOf(id).reduce((a, s) => a + s.solves.length, 0);
        return `<button class="item" role="menuitem" data-ev="${id}" aria-current="${id === DB.current.event}"><span class="ev-code">${EV[id].code}</span>${EV[id].name}<span class="meta">${n || ''}</span></button>`;
      }).join('')).join('');
      $$('[data-ev]', pop).forEach((b) => b.onclick = () => { closeOverlay(); switchEvent(b.dataset.ev); });
    });
  }
  function switchEvent(ev) {
    if (T.state !== 'idle' && T.state !== 'stopped') cancelAttempt();
    DB.current.event = ev; ensureCurrent(); saveLocal();
    Scr.prev = []; Scr.current = null;
    $('#eventLbl').textContent = EV[ev].name; $('#eventCode').textContent = EV[ev].code;
    T.state = 'idle'; showIdleTime(); renderHint();
    renderStatsAll(); Scr.next(false);
  }
  function openSessionMenu() {
    openPop($('#sessionBtn'), (pop) => {
      const ev = DB.current.event, list = sessionsOf(ev).sort((a, b) => b.created - a.created);
      pop.innerHTML = `<div class="grp">${esc(EV[ev].name)} sessions</div>` + list.map((s) => `<button class="item" role="menuitem" data-s="${s.id}" aria-current="${s.id === cur().id}">${esc(s.name)}<span class="meta">${s.solves.length}</span></button>`).join('') +
        `<div class="sep"></div><button class="item" data-new>${icon(I.plus)}New session</button><button class="item" data-rename>${icon(I.edit)}Rename “${esc(cur().name)}”</button><button class="item" data-del style="color:var(--bad)">${icon(I.trash)}Delete “${esc(cur().name)}”</button>`;
      $$('[data-s]', pop).forEach((b) => b.onclick = () => { closeOverlay(); DB.current.sessions[ev] = b.dataset.s; saveLocal(); afterSessionChange(); });
      $('[data-new]', pop).onclick = () => { closeOverlay(); const s = newSession(ev); DB.current.sessions[ev] = s.id; touch(s); afterSessionChange(); toast(`Started ${s.name}`); };
      $('[data-rename]', pop).onclick = () => { closeOverlay(); renameSession(cur()); };
      $('[data-del]', pop).onclick = () => {
        closeOverlay();
        const s = cur();
        confirmDialog(`Delete ${s.name}?`, `This removes ${s.solves.length} solve${s.solves.length === 1 ? '' : 's'} from every device. Export first if you want a copy.`, 'Delete session', () => {
          DB.sessions = DB.sessions.filter((x) => x.id !== s.id); DB.deleted[s.id] = Date.now();
          delete DB.current.sessions[ev]; statCache.delete(s.id);
          saveLocal(); Cloud.markSession(s.id); afterSessionChange(); toast('Session deleted');
        });
      };
    });
  }
  function renameSession(s) {
    openDialog((d, close) => {
      d.innerHTML = `<h2>Rename session</h2><input class="textin" id="sessName" value="${esc(s.name)}" maxlength="60"><div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Save</button></div>`;
      const inp = $('#sessName', d); inp.focus(); inp.select();
      const save = () => { const v = inp.value.trim(); if (v) { s.name = v; touch(s); renderStatsAll(); } close(); };
      $('[data-ok]', d).onclick = save;
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    });
  }
  function afterSessionChange() {
    ensureCurrent();
    T.state = 'idle'; showIdleTime(); renderStatsAll();
  }

  function editScramble() {
    openDialog((d, close) => {
      d.innerHTML = `<h2>Use your own scramble</h2><p class="note" style="margin:0">Paste a scramble from a competition or a friend. The preview uses WCA notation.</p><textarea class="textin" id="scrIn" placeholder="R U R' U' …">${esc(Scr.current ? Scr.current.text : '')}</textarea><div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Use scramble</button></div>`;
      const ta = $('#scrIn', d); ta.focus(); ta.select();
      $('[data-ok]', d).onclick = () => { const v = ta.value.trim(); if (v) Scr.custom(v); close(); };
    });
  }

  function openSyncInfo() {
    const st = Cloud.state;
    openPop($('#syncBtn'), (pop) => {
      const msg = st === 'cloud' ? 'Your solves and settings are saved to your Claude account and stay in sync on every device where you open Facet.'
        : st === 'busy' ? 'Saving your latest changes to your account…'
          : st === 'error' ? Cloud.msg
            : 'Your solves are saved in this browser only. Open Facet signed in to your Claude account to sync them across devices.';
      pop.innerHTML = `<div class="grp">${st === 'cloud' ? 'Synced' : st === 'local' ? 'Saved on this device' : st === 'busy' ? 'Syncing' : 'Sync paused'}</div><p class="note" style="margin:4px 10px 10px;font-size:13.5px">${esc(msg)}</p><button class="item" data-export>${icon(I.download)}Export all solves</button>`;
      $('[data-export]', pop).onclick = () => { closeOverlay(); exportAll(); };
    });
  }

  // ---------------------------------------------------------------- settings
  let settingsTab = 'look';
  function openSettings() {
    if (T.state !== 'idle' && T.state !== 'stopped') return;
    openSheet('Customize', (body, tabs) => {
      const TABS = [['look', 'Look'], ['timer', 'Timer'], ['widgets', 'Widgets'], ['stats', 'Stats'], ['data', 'Data'], ['rules', 'WCA rules']];
      tabs.innerHTML = TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === settingsTab}">${l}</button>`).join('');
      $$('[data-tab]', tabs).forEach((b) => b.onclick = () => { settingsTab = b.dataset.tab; $$('[data-tab]', tabs).forEach((x) => x.setAttribute('aria-selected', String(x === b))); draw(); });
      const draw = () => { body.innerHTML = SETTINGS_TABS[settingsTab](); bindSettings(body, draw); body.scrollTop = 0; };
      draw();
    }, true);
  }
  const seg = (key, opts) => `<div class="segctl" role="group">${opts.map(([v, l]) => `<button data-set="${key}" data-val='${JSON.stringify(v)}' aria-pressed="${JSON.stringify(S()[key]) === JSON.stringify(v)}">${l}</button>`).join('')}</div>`;
  const sw = (key) => `<button class="switch" role="switch" data-toggle="${key}" aria-checked="${!!S()[key]}" aria-label="${key}"></button>`;
  const range = (key, min, max, step, show) => `<div class="range"><input type="range" id="rg-${key}" data-range="${key}" min="${min}" max="${max}" step="${step}" value="${S()[key]}"><output>${show(S()[key])}</output></div>`;
  const row = (title, sub, ctl, stack) => `<div class="set-row ${stack ? 'stack' : ''}"><div class="lab"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div>${ctl}</div>`;
  const RANGE_FMT = {
    glass: (v) => Math.round(v * 100) + '%', blur: (v) => v + 'px', radius: (v) => v + 'px',
    timerScale: (v) => Math.round(v * 100) + '%', scrScale: (v) => Math.round(v * 100) + '%', holdMs: (v) => (v / 1000).toFixed(2) + ' s',
  };
  const SETTINGS_TABS = {
    look: () => `
      <div class="set-group"><h3>Theme</h3>
        ${row('Appearance', '', seg('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]))}
        ${row('Accent', 'Used for averages, inspection and highlights. The background picks up its hue.', `<div class="swatches">${ACCENTS.map(([n, c]) => `<button class="swatch" title="${n}" aria-label="${n}" data-accent="${c}" style="background:${c}" aria-pressed="${S().accent.toLowerCase() === c}"></button>`).join('')}<label class="swatch custom" title="Custom colour"><input type="color" id="accentPick" value="${S().accent}" aria-label="Custom accent"></label></div>`, true)}
        ${row('Background', S().bg === 'image' ? '<button class="btn" id="bgPick" style="margin-top:6px">' + icon(I.upload) + 'Choose image</button>' : 'Aurora drifts slowly; Still holds it in place.', seg('bg', [['aurora', 'Aurora'], ['still', 'Still'], ['solid', 'Solid'], ['image', 'Image']]))}
      </div>
      <div class="set-group"><h3>Glass</h3>
        ${row('Opacity', 'Lower is clearer glass.', range('glass', 0.08, 0.9, 0.01, RANGE_FMT.glass))}
        ${row('Frost', 'How much the background blurs behind panels.', range('blur', 0, 48, 1, RANGE_FMT.blur))}
        ${row('Corner radius', '', range('radius', 4, 34, 1, RANGE_FMT.radius))}
        ${row('Light sheen', 'A soft highlight that follows your pointer across each panel.', sw('sheen'))}
        ${row('Lens refraction', 'Bends the background behind panels like thick glass. Chrome and Edge only; can be heavy on slow devices.', sw('refract'))}
      </div>
      <div class="set-group"><h3>Timer type</h3>
        <div class="fontpick">${Object.keys(FONTS).map((f) => { ensureFont(f); return `<button data-font="${f}" aria-pressed="${S().fontTimer === f}"><span class="sample" style="font-family:'${f}';font-weight:${S().timerWeight}">9.87</span><span class="name">${f}</span></button>`; }).join('')}</div>
        ${row('Weight', '', seg('timerWeight', [[200, 'Thin'], [300, 'Light'], [400, 'Regular'], [500, 'Medium']]))}
        ${row('Timer size', '', range('timerScale', 0.6, 1.5, 0.05, RANGE_FMT.timerScale))}
        ${row('Scramble size', '', range('scrScale', 0.7, 1.6, 0.05, RANGE_FMT.scrScale))}
        ${row('Interface font', '', seg('fontUi', [['Onest', 'Onest'], ['Outfit', 'Outfit'], ['System', 'System']]))}
      </div>`,
    timer: () => `
      <div class="set-group"><h3>Starting</h3>
        ${row('Input', 'Typing lets you enter times from a stackmat or a competition sheet.', seg('input', [['timer', 'Timer'], ['typing', 'Typing']]))}
        ${row('Hold to start', 'How long to hold before the timer turns green. A stackmat needs about half a second.', range('holdMs', 0, 1000, 50, RANGE_FMT.holdMs))}
        ${row('Mouse can start the timer', 'Touch and pen always can. Turn this on for a trackpad or mouse click.', sw('mouseStart'))}
      </div>
      <div class="set-group"><h3>Inspection (WCA A3)</h3>
        ${row('15-second inspection', 'Starting after 15 s adds +2; after 17 s the solve is a DNF. Always off for blindfolded and fewest moves.', sw('inspection'))}
        ${row('8 and 12 second calls', 'What a judge would call out.', seg('alerts', [['voice', 'Voice'], ['beep', 'Beep'], ['off', 'Off']]))}
      </div>
      <div class="set-group"><h3>While solving</h3>
        ${row('Show', '', seg('update', [['live', 'Time'], ['seconds', 'Seconds'], ['hidden', 'Nothing']]))}
        ${row('Hide everything else', 'Only the timer stays on screen until you stop.', sw('focus'))}
        ${row('Precision', 'WCA records singles truncated to hundredths (9f1).', seg('precision', [[2, '0.01 (WCA)'], [3, '0.001']]))}
      </div>
      <div class="set-group"><h3>Keyboard</h3>
        <p class="note" style="margin:0">Space: inspect, hold, start · any key: stop · Esc: cancel · → / ←: next or previous scramble · Ctrl/⌘ + 1, 2, 3: OK, +2, DNF · Ctrl/⌘ + Backspace: delete last solve · Z: focus mode · , : customize</p>
      </div>`,
    widgets: () => {
      const lay = S().layoutResolved;
      const pick = (layout, n) => Array.from({ length: n }, (_, i) => `<select class="selectbox" data-wl="${layout}" data-wi="${i}" aria-label="${layout} widget ${i + 1}">${Object.entries(WIDGETS).map(([k, v]) => `<option value="${k}" ${S().widgets[layout][i] === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`).join('');
      return `<div class="set-group"><h3>Layout</h3>
        ${row('Arrangement', `Auto picks by screen. This screen is using <b>${{ desktop: 'Desktop', tablet: 'Tablet landscape', mobile: 'Phone / portrait' }[lay]}</b>.`, seg('layout', [['auto', 'Auto'], ['desktop', 'Desktop'], ['tablet', 'Tablet'], ['mobile', 'Phone']]), true)}
      </div>
      <div class="set-group"><h3>Desktop · three along the bottom</h3><div class="checks" style="gap:8px">${pick('desktop', 3)}</div></div>
      <div class="set-group"><h3>Tablet landscape · two at the side</h3><div class="checks" style="gap:8px">${pick('tablet', 2)}</div></div>
      <div class="set-group"><h3>Phone and portrait · one at the bottom</h3><div class="checks" style="gap:8px">${pick('mobile', 1)}</div><p class="note">On a phone, swipe the widget sideways to flip through the others.</p></div>`;
    },
    stats: () => `
      <div class="set-group"><h3>Under the timer</h3>
        <div class="checks">${QUICK_OPTS.map(([k, l]) => `<button data-quick="${k}" aria-pressed="${S().quick.includes(k)}">${l}</button>`).join('')}</div>
      </div>
      <div class="set-group"><h3>Targets and charts</h3>
        ${row('Sub-X target', 'Used by the Consistency widget. Leave at 0 to aim just under your session mean.', `<input class="textin" id="subX" type="number" min="0" max="600" step="1" value="${S().subX || 0}" style="width:90px;text-align:right">`)}
        ${row('Time trend shows', '', seg('chartWindow', [[50, 'Last 50'], [100, 'Last 100'], [250, 'Last 250'], [0, 'All']]))}
      </div>
      <div class="set-group"><h3>How averages work</h3><ul class="rules">
        <li><b>Ao5</b> drops the best and worst, then takes the mean of three. One DNF counts as the worst; two make it a DNF. (WCA 9f8, 9f9)</li>
        <li><b>Mo3</b> is the straight mean; any DNF makes it a DNF. Official format for 6x6, 7x7 and FMC. (9f10, 9f11)</li>
        <li><b>Ao12 and longer</b> are not WCA formats. They drop 5% from each end (1 of 12, 3 of 50, 5 of 100), as csTimer and CubeDesk do.</li>
        <li>Averages are rounded to hundredths, and to whole seconds above 10 minutes. (9f2)</li></ul></div>`,
    data: () => `
      <div class="set-group"><h3>Sync</h3>
        <p class="note" style="margin:0">${Cloud.state === 'cloud' || Cloud.state === 'busy' ? 'Solves and settings are saved to your Claude account and sync between your devices.' : Cloud.state === 'error' ? esc(Cloud.msg) : 'Solves are saved in this browser. Open Facet while signed in to Claude to sync between devices.'} Background images stay on the device they were added on.</p>
      </div>
      <div class="set-group"><h3>Account</h3>
        ${row('Sign-in screen', entry() === 'guest' ? 'You are using Facet as a guest on this device.' : 'Solves sync through your Claude account.', '<a class="btn" id="goLogin" href="login.html">Open</a>')}
      </div>
      <div class="set-group"><h3>Backup</h3>
        ${row('Export', 'Every session as a JSON file.', `<button class="btn" id="doExport">${icon(I.download)}Export</button>`)}
        ${row('Import', 'Facet backups and csTimer exports (.txt or .json). Solves are added to new sessions.', `<label class="btn" style="cursor:pointer">${icon(I.upload)}Import<input type="file" id="doImport" accept=".json,.txt,application/json,text/plain" hidden></label>`)}
      </div>
      <div class="set-group"><h3>Clean up</h3>
        ${row(`Clear “${esc(cur().name)}”`, `Removes all ${cur().solves.length} solves in this session but keeps the session.`, '<button class="btn danger" id="doClear">Clear</button>')}
        ${row('Reset appearance', 'Restores the default look and timer options. Solves are kept.', '<button class="btn" id="doReset">Reset</button>')}
      </div>`,
    rules: () => `
      <div class="set-group"><h3>Timing</h3><ul class="rules">
        <li><b>Inspection</b> lasts up to 15 seconds (A3a1). Starting between 15 and 17 s adds <b>+2</b> (A4d1); after 17 s the attempt is a <b>DNF</b> (A4d2).</li>
        <li>A judge calls “8 seconds” and “12 seconds” (A3b3, A3b4). Facet can say it or beep.</li>
        <li>Blindfolded events have no inspection: the solve starts with the attempt (B1a).</li>
        <li>Singles are truncated to hundredths; 10 minutes and over to whole seconds (9f1, 9f2).</li>
        <li>Mark <b>+2</b> when the puzzle was one move from solved, <b>DNF</b> when more (10e3, 10e4).</li></ul></div>
      <div class="set-group"><h3>Scrambles</h3><ul class="rules">
        <li><b>Random-state</b> (a uniformly random position, solved and inverted, as the WCA requires in 4b3): 2x2 (at least 4 moves), 3x3, OH, 3BLD and FMC (Kociemba two-phase, 20 to 21 moves), Pyraminx (at least 6, plus random tips), Skewb (at least 7), Clock.</li>
        <li><b>Random moves</b>, matching the official scrambler: 5x5 (60), 6x6 (80), 7x7 (100), Megaminx (7 lines of R and D moves).</li>
        <li>Blindfolded scrambles end with a random orientation, each of the 24 equally likely (4b3a). FMC scrambles start and end with R' U' F.</li>
        <li><b>Not random-state yet:</b> 4x4 uses 40 random moves and Square-1 uses random legal twists. The WCA uses random-state for both; their solvers are too large to run here.</li>
        <li>Hold the puzzle with white on top and green in front when scrambling.</li></ul></div>`,
  };
  function bindSettings(body, redraw) {
    const set = (k, v, opts = {}) => { S()[k] = v; touchSettings(); applySettings(); if (opts.layout) renderLayout(); if (opts.stats) { statCache.clear(); renderStatsAll(); showIdleTime(); } if (opts.redraw) redraw(); };
    $$('[data-set]', body).forEach((b) => b.onclick = () => {
      const k = b.dataset.set, v = JSON.parse(b.dataset.val);
      const needsRedraw = k === 'bg' || k === 'layout';
      set(k, v, { layout: k === 'layout', stats: k === 'precision' || k === 'chartWindow', redraw: needsRedraw });
      if (!needsRedraw) $$(`[data-set="${k}"]`, body).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      if (k === 'bg' && v === 'image' && !ls.get(LS_BG)) $('#bgPick', body) && $('#bgPick', body).click();
      if (k === 'theme' || k === 'precision' || k === 'chartWindow' || k === 'input') renderWidgets();
      if (k === 'input') { showIdleTime(); if (v === 'typing') setTimeout(() => $('#typeIn').focus(), 50); }
    });
    $$('[data-toggle]', body).forEach((b) => b.onclick = () => { const k = b.dataset.toggle; set(k, !S()[k]); b.setAttribute('aria-checked', String(S()[k])); renderHint(); });
    $$('[data-range]', body).forEach((r) => r.addEventListener('input', () => { const k = r.dataset.range; set(k, +r.value); r.nextElementSibling.textContent = RANGE_FMT[k](+r.value); if (k === 'scrScale' || k === 'timerScale') renderScramble(); }));
    $$('[data-accent]', body).forEach((b) => b.onclick = () => { set('accent', b.dataset.accent, { redraw: true }); renderWidgets(); });
    const pickAccent = $('#accentPick', body);
    if (pickAccent) pickAccent.addEventListener('input', () => { S().accent = pickAccent.value; applySettings(); }), pickAccent.addEventListener('change', () => { set('accent', pickAccent.value, { redraw: true }); });
    $$('[data-font]', body).forEach((b) => b.onclick = () => set('fontTimer', b.dataset.font, { redraw: true }));
    $$('[data-wl]', body).forEach((sel) => sel.onchange = () => { S().widgets[sel.dataset.wl][+sel.dataset.wi] = sel.value; touchSettings(); renderLayout(); });
    $$('[data-quick]', body).forEach((b) => b.onclick = () => {
      const k = b.dataset.quick, q = S().quick.slice(), i = q.indexOf(k);
      if (i >= 0) q.splice(i, 1); else q.push(k);
      q.sort((a, b2) => QUICK_OPTS.findIndex((o) => o[0] === a) - QUICK_OPTS.findIndex((o) => o[0] === b2));
      set('quick', q); b.setAttribute('aria-pressed', String(q.includes(k))); renderQuick();
    });
    const subX = $('#subX', body);
    if (subX) subX.addEventListener('change', () => { set('subX', Math.max(0, Math.min(600, +subX.value || 0))); renderWidgets(); });
    const bgPick = $('#bgPick', body);
    if (bgPick) bgPick.onclick = () => pickBackground(redraw);
    const gl = $('#goLogin', body); if (gl) gl.onclick = () => { try { localStorage.removeItem(ENTRY_KEY); } catch { /* ignore */ } };
    const ex = $('#doExport', body); if (ex) ex.onclick = exportAll;
    const im = $('#doImport', body); if (im) im.onchange = () => { if (im.files[0]) importFile(im.files[0]); im.value = ''; };
    const clr = $('#doClear', body);
    if (clr) clr.onclick = () => confirmDialog(`Clear ${cur().name}?`, `All ${cur().solves.length} solves in this session will be deleted on every device.`, 'Clear session', () => { const s = cur(); s.solves = []; touch(s); showIdleTime(); renderStatsAll(); redraw(); toast('Session cleared'); });
    const rst = $('#doReset', body);
    if (rst) rst.onclick = () => { const keep = { widgets: S().widgets, quick: S().quick, subX: S().subX }; DB.settings = Object.assign(DEFAULTS(), keep); touchSettings(); applySettings(); renderLayout(); renderStatsAll(); redraw(); toast('Appearance reset'); };
  }
  function pickBackground(redraw) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const img = new Image(), url = URL.createObjectURL(f);
      img.onload = () => {
        // downscale so it fits in browser storage
        const scale = Math.min(1, 1920 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let data = c.toDataURL('image/jpeg', 0.82);
        if (data.length > 1800000) data = c.toDataURL('image/jpeg', 0.6);
        URL.revokeObjectURL(url);
        if (!ls.set(LS_BG, data)) { toast('That image is too large to keep. Try a smaller one.'); return; }
        S().bg = 'image'; touchSettings(); applySettings(); if (redraw) redraw();
      };
      img.onerror = () => toast('That file is not an image this browser can read.');
      img.src = url;
    };
    inp.click();
  }

  // ---------------------------------------------------------------- import / export
  async function exportAll() {
    const data = JSON.stringify({ app: 'facet', v: 1, exported: new Date().toISOString(), sessions: DB.sessions.filter((s) => s.solves.length).map(({ rev, auto, ...s }) => s) });
    const name = `facet-solves-${new Date().toISOString().slice(0, 10)}.json`;
    let dl = null;
    try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch { dl = null; }
    if (dl) {
      try { await dl.save({ filename: name, data }); toast('Export saved'); return; }
      catch (e) { if (e && e.code === 'declined') return; }
    }
    openDialog((d) => {
      d.innerHTML = `<h2>Export</h2><p class="note" style="margin:0">Saving files isn't available here. Copy this text and save it as <b>${esc(name)}</b>.</p><textarea class="textin" readonly style="min-height:160px;font-size:11px">${esc(data.length > 400000 ? data.slice(0, 400000) + '…' : data)}</textarea><div class="row"><button class="btn primary" data-cp>${icon(I.copy)}Copy all</button><button class="btn" data-close>Done</button></div>`;
      $('[data-cp]', d).onclick = () => copyText(data, 'Export copied');
    });
  }
  const CSTIMER_EVENTS = { '333': '333', '222so': '222', '222': '222', '444wca': '444', '444': '444', '555wca': '555', '666wca': '666', '777wca': '777', '333oh': '333oh', '333ni': '333bf', '444bld': '444bf', '555bld': '555bf', '333fm': '333fm', clkwca: 'clock', mgmp: 'minx', pyrso: 'pyram', skbso: 'skewb', sqrs: 'sq1' };
  async function importFile(file) {
    let obj;
    try { obj = JSON.parse(await file.text()); } catch { toast('That file is not a Facet or csTimer export.'); return; }
    const added = [];
    if (obj && obj.app === 'facet' && Array.isArray(obj.sessions)) {
      for (const s of obj.sessions) {
        if (!EV[s.event] || !Array.isArray(s.solves)) continue;
        if (DB.sessions.some((x) => x.id === s.id)) continue;
        const ns = { id: s.id || rid(), name: s.name || 'Imported', event: s.event, created: s.created || Date.now(), u: Date.now(), solves: s.solves.filter((x) => x && typeof x.t === 'number').map((x) => ({ id: x.id || rid(), t: x.t, p: x.p === 2 || x.p === -1 ? x.p : 0, s: x.s || '', d: x.d || Date.now(), ...(x.c ? { c: x.c } : {}), ...(x.i != null ? { i: x.i } : {}) })), rev: 0 };
        DB.sessions.push(ns); added.push(ns);
      }
    } else if (obj && typeof obj === 'object' && Object.keys(obj).some((k) => /^session\d+$/.test(k))) {
      let meta = {};
      try { meta = JSON.parse((obj.properties && obj.properties.sessionData) || '{}'); } catch { meta = {}; }
      for (const k of Object.keys(obj)) {
        const m = /^session(\d+)$/.exec(k);
        if (!m || !Array.isArray(obj[k]) || !obj[k].length) continue;
        const info = meta[m[1]] || {}, scr = info.opt && info.opt.scrType;
        const ev = CSTIMER_EVENTS[scr] || '333';
        const solves = obj[k].filter((x) => Array.isArray(x) && Array.isArray(x[0])).map((x) => ({
          id: rid(), t: x[0][1], p: x[0][0] === -1 ? -1 : x[0][0] === 2000 ? 2 : 0, s: x[1] || '', d: (x[3] || 0) * 1000 || Date.now(), ...(x[2] ? { c: String(x[2]) } : {}),
        }));
        const ns = { id: rid(), name: `${info.name != null ? info.name : 'csTimer ' + m[1]} (csTimer)`, event: ev, created: Date.now(), u: Date.now(), solves, rev: 0 };
        DB.sessions.push(ns); added.push(ns);
      }
    } else { toast('That file is not a Facet or csTimer export.'); return; }
    if (!added.length) { toast('Nothing new to import.'); return; }
    added.forEach((s) => Cloud.markSession(s.id));
    saveLocal(true); renderStatsAll();
    const n = added.reduce((a, s) => a + s.solves.length, 0);
    toast(`Imported ${n} solves into ${added.length} session${added.length === 1 ? '' : 's'}`);
  }

  function loadSamples() {
    const ev = DB.current.event;
    const typical = { '333': 14, '222': 5, '444': 52, '555': 100, '666': 190, '777': 290, '333oh': 24, clock: 9, minx: 75, pyram: 6, skewb: 7, sq1: 18, '333bf': 70, '444bf': 360, '555bf': 720, '333fm': 1800 }[ev] || 15;
    const s = newSession(ev, 'Sample solves');
    const n = 60, start = Date.now() - n * 45000;
    for (let i = 0; i < n; i++) {
      const drift = 1 - (i / n) * 0.08;
      const g = Math.sqrt(-2 * Math.log(Math.random() + 1e-9)) * Math.cos(2 * Math.PI * Math.random());
      const t = Math.max(typical * 0.55, typical * drift * (1 + g * 0.12)) * 1000;
      const r = Math.random();
      s.solves.push({ id: rid(), t: Math.floor(t / 10) * 10, p: r < 0.03 ? -1 : r < 0.08 ? 2 : 0, s: '', d: start + i * 45000 });
    }
    DB.current.sessions[ev] = s.id; touch(s); afterSessionChange();
    toast('Loaded 60 sample solves into a new “Sample solves” session');
  }

  // ---------------------------------------------------------------- cloud sync (db capability)
  const CHUNK_BYTES = 150000;
  function chunkify(solves) {
    const out = []; let cur2 = [], size = 0;
    for (const x of solves) {
      const n = JSON.stringify(x).length + 1;
      if (cur2.length && size + n > CHUNK_BYTES) { out.push(cur2); cur2 = []; size = 0; }
      cur2.push(x); size += n;
    }
    if (cur2.length) out.push(cur2);
    return out;
  }
  const Cloud = {
    state: 'local', msg: '', col: null, device: rid(), dirty: new Set(), metaDirty: false, timer: 0, busy: false, written: {}, remoteChunks: {}, lastMetaU: 0, chain: Promise.resolve(),
    set(st, msg) { this.state = st; this.msg = msg || ''; renderSync(); },
    async init() {
      if (entry() === 'guest') return;
      if (!window.claude || typeof window.claude.use !== 'function') return;
      let db = null, user = null;
      try { [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]); } catch { return; }
      if (!db || !user) return;
      let id = null;
      try { id = await user.id(); } catch { id = null; }
      if (!id) return;
      try { this.col = db.collection('data/users/' + id); } catch { this.col = null; return; }
      this.set('busy');
      try { await this.pull(); if (this.state !== 'error') this.set('cloud'); } catch (e) { this.fail(e); return; }
      try { this.col.doc('meta').onSnapshot((snap) => this.onMeta(snap), () => {}); } catch { /* live updates unavailable */ }
    },
    docId: (sid, k) => `c-${sid}-${k}`,
    uploadable: (s) => !(s.auto && !s.solves.length),
    async pull() {
      const snap = await this.col.doc('meta').get();
      if (!snap.exists) { DB.sessions.filter(this.uploadable).forEach((s) => this.dirty.add(s.id)); this.metaDirty = true; await this.flush(); return; }
      await this.merge(snap.data());
    },
    async merge(meta) {
      this.lastMetaU = Math.max(this.lastMetaU, meta.u || 0);
      const rdel = meta.deleted || {}, del = Object.assign({}, DB.deleted);
      for (const k in rdel) del[k] = Math.max(del[k] || 0, rdel[k]);
      DB.deleted = del;
      let changed = false;
      const remote = (meta.sessions || []).filter((r) => !del[r.id]);
      for (const rs of remote) {
        this.remoteChunks[rs.id] = rs.chunks;
        const ls2 = DB.sessions.find((s) => s.id === rs.id);
        if (!ls2 || rs.u > ls2.u) {
          const solves = [];
          for (let k = 0; k < rs.chunks; k++) { const d = await this.col.doc(this.docId(rs.id, k)).get(); if (d.exists) solves.push(...((d.data().solves) || [])); }
          const ns = { id: rs.id, name: rs.name, event: rs.event, created: rs.created, u: rs.u, solves, rev: (ls2 ? ls2.rev : 0) + 1 };
          if (ls2) { Object.assign(ls2, ns); delete ls2.auto; } else DB.sessions.push(ns);
          this.written[rs.id] = chunkify(solves).map((c) => JSON.stringify(c));
          changed = true;
        } else if (ls2.u > rs.u) this.dirty.add(ls2.id);
        else if (!this.written[ls2.id]) this.written[ls2.id] = chunkify(ls2.solves).map((c) => JSON.stringify(c));
      }
      for (const s of DB.sessions) if (!remote.some((r) => r.id === s.id) && !del[s.id] && this.uploadable(s)) this.dirty.add(s.id);
      const before = DB.sessions.length;
      DB.sessions = DB.sessions.filter((s) => !del[s.id]);
      // drop empty auto-created sessions where the account already has sessions for that event
      DB.sessions = DB.sessions.filter((s) => !(s.auto && !s.solves.length && DB.sessions.some((o) => o !== s && o.event === s.event)));
      if (DB.sessions.length !== before) changed = true;
      const rs2 = meta.settings;
      if (rs2 && (rs2.u || 0) > (DB.settings.u || 0)) { DB.settings = Object.assign(DEFAULTS(), rs2); DB.settings.widgets = Object.assign(DEFAULTS().widgets, rs2.widgets || {}); applySettings(); changed = true; }
      else if ((DB.settings.u || 0) > ((rs2 && rs2.u) || 0)) this.metaDirty = true;
      if (Object.keys(del).length !== Object.keys(rdel).length || this.dirty.size) this.metaDirty = true;
      if (changed) { ensureCurrent(); saveLocal(true); statCache.clear(); renderLayout(); renderStatsAll(); if (T.state === 'idle' || T.state === 'stopped') showIdleTime(); $('#eventLbl').textContent = EV[DB.current.event].name; $('#eventCode').textContent = EV[DB.current.event].code; }
      if (this.metaDirty) this.schedule(300);
    },
    onMeta(snap) {
      if (!snap.exists || snap.metadata.hasPendingWrites) return;
      const m = snap.data();
      if (!m || m.by === this.device || (m.u || 0) <= this.lastMetaU) return;
      if (T.state !== 'idle' && T.state !== 'stopped') { setTimeout(() => this.onMeta(snap), 4000); return; }
      this.chain = this.chain.then(() => this.merge(m)).catch((e) => this.fail(e));
    },
    markSession(sid) { if (!this.col) return; this.dirty.add(sid); this.metaDirty = true; this.schedule(); },
    markMeta() { if (!this.col) return; this.metaDirty = true; this.schedule(); },
    schedule(ms = 2500) { if (!this.col) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), ms); },
    async flush() {
      if (!this.col || (!this.dirty.size && !this.metaDirty)) return;
      if (this.busy || (T.state !== 'idle' && T.state !== 'stopped')) { this.schedule(1500); return; }
      this.busy = true; this.set('busy');
      try {
        const ids = [...this.dirty]; this.dirty.clear();
        for (const sid of ids) {
          const s = DB.sessions.find((x) => x.id === sid);
          if (s && !this.uploadable(s)) continue;
          const old = this.written[sid] || [];
          const prevCount = Math.max(old.length, this.remoteChunks[sid] || 0);
          const chunks = s ? chunkify(s.solves).map((c) => JSON.stringify(c)) : [];
          for (let k = 0; k < chunks.length; k++) if (chunks[k] !== old[k]) await this.col.doc(this.docId(sid, k)).set({ solves: JSON.parse(chunks[k]) });
          for (let k = chunks.length; k < prevCount; k++) await this.col.doc(this.docId(sid, k)).delete();
          if (s) { this.written[sid] = chunks; this.remoteChunks[sid] = chunks.length; } else { delete this.written[sid]; delete this.remoteChunks[sid]; }
        }
        const u = Date.now();
        const { layoutResolved, ...settings } = DB.settings;
        await this.col.doc('meta').set({
          v: 1, u, by: this.device, settings, deleted: DB.deleted,
          sessions: DB.sessions.filter((s) => this.uploadable(s)).map((s) => ({ id: s.id, name: s.name, event: s.event, created: s.created, u: s.u, chunks: (this.written[s.id] || []).length })),
        });
        this.lastMetaU = u; this.metaDirty = false;
        this.set('cloud');
      } catch (e) { this.fail(e); } finally { this.busy = false; }
      if (this.state !== 'error' && (this.dirty.size || this.metaDirty)) this.schedule(1500);
    },
    fail(e) {
      const code = e && e.code;
      this.set('error', code === 'quota_exceeded' ? 'Your account storage for Facet is full. Export your solves, then delete old sessions.'
        : code === 'revoked' ? 'Sync is no longer available on this page. Your solves are still saved on this device.'
          : 'Sync paused. Your solves are still saved on this device and will sync when it reconnects.');
      if (code === 'unavailable' || code === 'resource_exhausted' || !code) { this.metaDirty = true; setTimeout(() => { if (this.state === 'error') { this.set('busy'); this.flush(); } }, 15000); }
    },
  };
  function renderSync() {
    const b = $('#syncBtn');
    b.dataset.state = Cloud.state === 'cloud' ? 'cloud' : Cloud.state;
    $('#syncTxt').textContent = { cloud: 'Synced', busy: 'Syncing', error: 'Sync paused', local: 'This device' }[Cloud.state];
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { saveLocal(true); Cloud.flush(); } });

  // ---------------------------------------------------------------- glass motion
  // Highlight that tracks the pointer across any glass panel.
  let glassRaf = 0, gx = 0, gy = 0, gt = null;
  document.addEventListener('pointermove', (e) => {
    const g = e.target.closest && e.target.closest('.glass');
    if (!g) return;
    gt = g; gx = e.clientX; gy = e.clientY;
    if (glassRaf) return;
    glassRaf = requestAnimationFrame(() => {
      glassRaf = 0;
      const r = gt.getBoundingClientRect();
      gt.style.setProperty('--mx', (gx - r.left) + 'px');
      gt.style.setProperty('--my', (gy - r.top) + 'px');
      gt.style.setProperty('--rim-angle', Math.round(110 + ((gx - r.left) / Math.max(1, r.width)) * 70) + 'deg');
    });
  }, { passive: true });

  // Sliding glass thumb under the selected option of segmented controls.
  const THUMBED = '.segctl, .tabs, .result-actions';
  function placeThumb(ctl) {
    let th = ctl.querySelector(':scope > .thumb');
    if (!th) { th = document.createElement('span'); th.className = 'thumb'; th.setAttribute('aria-hidden', 'true'); ctl.prepend(th); ctl.classList.add('has-thumb'); }
    const on = ctl.querySelector(':scope > [aria-pressed="true"], :scope > [aria-selected="true"]');
    if (!on || !on.offsetWidth) { ctl.classList.remove('thumb-on'); return; }
    th.style.width = on.offsetWidth + 'px';
    th.style.transform = `translateX(${on.offsetLeft}px)`;
    if (!ctl.classList.contains('thumb-on')) { ctl.classList.add('thumb-on'); requestAnimationFrame(() => requestAnimationFrame(() => ctl.classList.add('thumb-live'))); }
  }
  let thumbRaf = 0;
  const syncThumbs = () => { thumbRaf = 0; $$(THUMBED).forEach(placeThumb); };
  new MutationObserver(() => { if (!thumbRaf) thumbRaf = requestAnimationFrame(syncThumbs); })
    .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected', 'hidden'] });
  window.addEventListener('resize', () => { if (!thumbRaf) thumbRaf = requestAnimationFrame(syncThumbs); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!thumbRaf) thumbRaf = requestAnimationFrame(syncThumbs); });

  // ---------------------------------------------------------------- zen
  function setZen(on) { app.classList.toggle('zen', on); }

  // ---------------------------------------------------------------- wiring
  $('#eventBtn').onclick = openEventMenu;
  $('#sessionBtn').onclick = openSessionMenu;
  $('#settingsBtn').onclick = openSettings;
  $('#listBtn').onclick = openSolves;
  $('#zenBtn').onclick = () => setZen(true);
  $('#zenExit').onclick = () => setZen(false);
  $('#syncBtn').onclick = openSyncInfo;
  $('#scrNext').onclick = () => Scr.next();
  $('#scrPrev').onclick = () => Scr.back();
  $('#scrEdit').onclick = editScramble;
  $('#scrText').onclick = () => { if (Scr.current && Scr.current.method !== 'Error') copyText(Scr.current.text, 'Scramble copied'); };
  $$('#resultActions [data-pen]').forEach((b) => b.onclick = () => { const s = cur(), last = s.solves[s.solves.length - 1]; if (last) setPenalty(last, +b.dataset.pen); });
  $('#resDelete').onclick = () => { const s = cur(), last = s.solves[s.solves.length - 1]; if (last) deleteSolve(last); };
  $('#resComment').onclick = () => { const s = cur(), last = s.solves[s.solves.length - 1]; if (last) openSolve(s, last); };
  // buttons shouldn't keep focus, or Space would press them instead of starting the timer
  document.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && !overlay.contains(b)) b.blur(); });
  const typeIn = $('#typeIn');
  const addTyped = () => {
    const r = parseTyped(typeIn.value);
    if (!r) { toast('Type a time like 12.34, 1:05.20, 9.87+ or DNF'); return; }
    addSolve({ id: rid(), t: r.t, p: r.p, s: Scr.current ? Scr.current.text : '', d: Date.now() });
    typeIn.value = '';
  };
  typeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } });
  $('#typeAdd').onclick = addTyped;

  // ---------------------------------------------------------------- boot
  ensureCurrent();
  applySettings();
  $('#eventLbl').textContent = EV[DB.current.event].name; $('#eventCode').textContent = EV[DB.current.event].code;
  Scr.init();
  renderLayout();
  renderStatsAll();
  showIdleTime();
  setState('idle');
  renderSync();
  Scr.next(false);
  Cloud.init();
})();
