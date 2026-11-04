/* band_tuning.js — 4.9.220 JS port of engine/rmc_engine_v1/band_tuning.py (4.9.219 D15) plus the 4.9.220 fact placement.
 * The phase alone picks the band (Codex v2.5 names, edges on the 144/n ladder, Φ6 6–9 Hz blend, Φ9 the 144 Hz carrier).
 * The item's words tune a symbolic Hz inside its band (ε 0.02, cap 0.40, nudge 0.45). place(text, phi) adds the decimal
 * phase: Φ = band + (hz − low)/(high − low), so the decimal always sits inside its own band's 40° sector and band_of(Φ)
 * gives the band back. Same numbers as CPython/Pyodide (pyRound reproduces Python's round()). Hz are symbolic, not
 * measured. No LLM, no network. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const F3 = isNode ? require('./frequency_203.js') : root.Frequency203;
  const F4 = isNode ? require('./frequency_204.js') : root.Frequency204;
  const SCHEMA = 'FORGE-BAND-TUNING/v1';
  const PLACE_SCHEMA = 'FORGE-FACT-PLACEMENT/v1';
  const LABEL = 'symbolic Hz (FBSC), not measured';
  const EPSILON = 0.02, OFFSET_CAP = 0.4, NUDGE_SPAN = 0.45, PLACES = 4;
  const BAND_TABLE = {
    1: { name: 'Theta', low: 4, high: 8, centre: 6, closed: false },
    2: { name: 'Low alpha', low: 8, high: 10, centre: 9, closed: false },
    3: { name: 'Alpha-beta', low: 10, high: 14, centre: 12, closed: false },
    4: { name: 'Mid beta', low: 14, high: 20, centre: 18, closed: false },
    5: { name: 'High beta', low: 20, high: 30, centre: 24, closed: false },
    6: { name: 'Theta-alpha blend', low: 6, high: 9, centre: 8, closed: true },
    7: { name: 'Low gamma', low: 30, high: 40, centre: 36, closed: false },
    8: { name: 'High gamma', low: 40, high: 80, centre: 48, closed: false },
    9: { name: '144 Hz carrier', low: 80, high: 220, centre: 144, closed: true }
  };
  const WEIGHTS = { same: 1, x3: 0.3, x9: 0.1, none: 0 };
  const MARKERS = []; for (let n = 1; n <= 144; n++) if (144 % n === 0) MARKERS.push(144 / n);

  /* Python round(x, n): correctly rounded, ties to even, on the exact binary value. */
  function pyRound(x, n) {
    x = Number(x); if (!Number.isFinite(x)) return x;
    const neg = x < 0; const s = Math.abs(x).toFixed(Math.min(100, n + 60));
    const dot = s.indexOf('.'); const head = s.slice(0, dot + 1 + n); const tail = s.slice(dot + 1 + n);
    let up = false;
    if (tail[0] > '5') up = true;
    else if (tail[0] === '5') { if (/[1-9]/.test(tail.slice(1))) up = true; else { const last = head.replace('.', '').slice(-1); up = (Number(last) % 2) === 1; } }
    let v = Number(head.endsWith('.') ? head.slice(0, -1) : head);
    if (up) v = Number((v + Math.pow(10, -n)).toFixed(n));
    v = neg ? -v : v; return v === 0 ? 0 : v;
  }
  const clamp = v => Math.max(-OFFSET_CAP, Math.min(OFFSET_CAP, v));
  function bandOf(phi) {
    if (typeof phi === 'boolean' || phi == null) return null;
    if (typeof phi === 'string') phi = phi.trim().replace(/^Φ/, '');
    const f = Number(phi); if (phi === '' || !Number.isFinite(f)) return null;
    const n = Math.trunc(f); return BAND_TABLE[n] ? n : null;
  }
  function inBand(phase, hz) { const r = BAND_TABLE[phase]; return r.closed ? (r.low <= hz && hz <= r.high) : (r.low <= hz && hz < r.high); }
  function bandMarkers(phase) { return MARKERS.filter(m => inBand(phase, m)).sort((a, b) => a - b); }
  function components(text) {
    const out = [];
    for (const word of F4.contentWords(text || '')) {
      for (const comp of (F3.wordSignature(word).components || [])) {
        if (comp.master) continue;
        const amp = Number(comp.amp || 0); const band = parseInt(comp.band, 10); const half = F3.voronoiHalf(band);
        if (amp <= 0 || half <= 0) continue;
        out.push({ marker: band, amp: amp, r: clamp((Number(comp.hz) - band) / half) });
      }
    }
    return out;
  }
  function tune(text, phi) {
    const phase = bandOf(phi) || 1; const row = BAND_TABLE[phase];
    const comps = components(text); const inside = comps.filter(c => inBand(phase, c.marker));
    const used = inside.length ? inside : comps; const source = inside.length ? 'in_band' : (comps.length ? 'all_components' : 'none');
    let den = 0, num = 0; for (const c of used) den += c.amp; for (const c of used) num += c.amp * c.r;
    const r = den > 0 ? clamp(num / den) : 0;
    const reach = r >= 0 ? row.high - row.centre : row.centre - row.low;
    const hz = pyRound(row.centre + r * reach, PLACES);
    return { schema: SCHEMA, phase: phase, band: row.name, low: row.low, high: row.high, centre: row.centre, hz: hz, r: pyRound(r, 6), source: source,
      components: used.length, label: LABEL, epsilon: EPSILON, offset_cap: OFFSET_CAP, nudge_span: NUDGE_SPAN, calls_llm: false };
  }
  /* 4.9.220: the fact's decimal phase. The integer is the content placement; the decimal is where its tuned Hz sits in the band. */
  function place(text, phi, basis) {
    const t = tune(text, phi); const row = BAND_TABLE[t.phase];
    let Phi = pyRound(t.phase + (t.hz - row.low) / (row.high - row.low), PLACES);
    if (Phi >= t.phase + 1) Phi = pyRound(t.phase + 0.9999, PLACES);
    if (Phi < t.phase) Phi = t.phase;
    return { schema: PLACE_SCHEMA, Phi: Phi, phase: t.phase, band: t, basis: basis || null, label: LABEL, calls_llm: false };
  }
  function relation(a, b) {
    const pa = bandOf(a), pb = bandOf(b);
    if (pa == null || pb == null) return { relation: 'none', weight: 0 };
    if (pa === pb) return { relation: 'same', weight: WEIGHTS.same };
    const ma = bandMarkers(pa), mb = bandMarkers(pb);
    for (const [kind, f] of [['x3', 3], ['x9', 9]]) if (ma.some(m => mb.indexOf(m * f) >= 0) || mb.some(m => ma.indexOf(m * f) >= 0)) return { relation: kind, weight: WEIGHTS[kind] };
    return { relation: 'none', weight: WEIGHTS.none };
  }
  const api = { SCHEMA, PLACE_SCHEMA, LABEL, BAND_TABLE, MARKERS, WEIGHTS, bandOf, inBand, bandMarkers, tune, place, relation, pyRound };
  if (isNode) module.exports = api; else root.KBandTuning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
