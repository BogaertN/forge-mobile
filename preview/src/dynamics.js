/* M4 (4.9.65) DYNAMICS: cause/effect + rate/time operators and two grammar constructions, deterministic and exact (BigInt rationals).
 * - RATES: a resource with a level (stated start, capacity, lower bound) changed by constant inflows and outflows (rate = quantity per time unit).
 *   The state equation is level(t) = start + (Σ in − Σ out)·t, bounded by [lower, capacity]; questions ask the time to reach a bound or the level
 *   after a duration. Verb classes, unit words and time units are DATA below; no domain word ("tank", "pump") is read. Every answer states its
 *   assumptions (constant rates, an unstated start). A what-if re-runs the SAME stated scenario with one input changed (a branch, never cumulative);
 *   a measurement that differs from the prediction is reported as a conflict and kept, never silently overwritten.
 * - REPORTS: "S1 reports 20 C, S2 reports 30 C at the same time" — each value attributed to its source; differing values for the same time are a
 *   conflict that stays unresolved (no averaging, no pick).
 * - SCOPE: a fronted sentence adverb + a subject with a relative clause ("Instinctively, eagles that fly swim") — the adverb modifies the MAIN verb,
 *   never the verb inside the relative clause (structure dependence); a question about either verb is answered from that structure.
 * - WHAT-IF: an intervention on a node of the user's stored causal links (durable world): do(X) follows the cause chains; removing X lists what loses
 *   a stored cause and what still has another; a stated prevention qualifies an effect. Read only; the kernel records the answer in the ledger.
 * Nothing here stores, fetches or weighs anything. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
/* ---- exact rationals ---- */
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
const Q = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
const qp = s => { const m = String(s).match(/^(-?)(\d+)(?:\.(\d+))?$/); if (!m) return null; const f = m[3] || ''; return Q(BigInt(m[1] + m[2] + f), 10n ** BigInt(f.length)); };
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d), sub = (a, b) => add(a, Q(-b.n, b.d)), mul = (a, b) => Q(a.n * b.n, a.d * b.d), div = (a, b) => Q(a.n * b.d, a.d * b.n);
const sgn = a => (a.n > 0n ? 1 : a.n < 0n ? -1 : 0), lt = (a, b) => sgn(sub(a, b)) < 0;
let DECIMAL = false; /* 4.9.78: a scenario that applied a decimal-defined unit conversion states its exact terminating values as decimals */
const decOf = a => { let d = a.d, k = 0; while (d % 2n === 0n) { d /= 2n; k++; } let j = 0; while (d % 5n === 0n) { d /= 5n; j++; } if (d !== 1n) return null; const e = BigInt(Math.max(k, j)), neg = a.n < 0n, n = (neg ? -a.n : a.n) * (10n ** e) / a.d; const st = n.toString().padStart(Number(e) + 1, '0'); const w = e ? st.slice(0, -Number(e)) : st, f = e ? st.slice(-Number(e)).replace(/0+$/, '') : ''; return (neg ? '−' : '') + w + (f ? '.' + f : ''); };
const fmtQ = a => { const neg = a.n < 0n, n = neg ? -a.n : a.n, w = n / a.d, r = n % a.d; return (neg ? '−' : '') + (r ? (w ? w + ' ' : '') + r + '/' + a.d : String(w)); }; /* the exact fraction (scenario encoding) */
const fmt = a => { if (DECIMAL && a.d !== 1n) { const x = decOf(a); if (x) return x; } const neg = a.n < 0n, n = neg ? -a.n : a.n, w = n / a.d, r = n % a.d; return (neg ? '−' : '') + (r ? (w ? w + ' ' : '') + r + '/' + a.d : String(w)); };
/* ---- data: words ---- */
const NUMW = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, hundred: 100 };
const TIME = { second: Q(1n, 60n), sec: Q(1n, 60n), minute: Q(1n), min: Q(1n), hour: Q(60n), hr: Q(60n), day: Q(1440n) }; /* in minutes */
const UNIT_ALIAS = { gal: 'gallon', l: 'liter', litre: 'liter', liters: 'liter', litres: 'liter', kg: 'kilogram', unit: 'unit' };
/* 4.9.78 EXACT VOLUME CONVERSIONS (defined values, in liters): applied only between units that are both listed. A unit with several
   definitions (the gallon: US 3.785411784 L or imperial 4.54609 L) is ambiguous unless the turn qualifies it */
const VOL = { liter: Q(1n), milliliter: Q(1n, 1000n), 'cubic-meter': Q(1000n), 'us-gallon': Q(3785411784n, 1000000000n), 'imperial-gallon': Q(454609n, 100000n) };
const AMBIGUOUS_UNIT = { gallon: ['us-gallon', 'imperial-gallon'] };
const UNIT_NAME = { 'us-gallon': 'US gallon', 'imperial-gallon': 'imperial gallon', 'cubic-meter': 'cubic meter' };
const qualifyUnits = low => low.replace(/\b(?:us|u\.s\.|american) (gallon)s?\b/g, (m, u) => 'us-' + u + (/s$/.test(m) ? 's' : '')).replace(/\b(?:imperial|uk|british) (gallon)s?\b/g, (m, u) => 'imperial-' + u + (/s$/.test(m) ? 's' : '')).replace(/\b(?:millilitres?|milliliters?)\b/g, m => 'milliliter' + (/s$/.test(m) ? 's' : '')).replace(/\bcubic (?:metres?|meters?)\b/g, m => 'cubic-meter' + (/s$/.test(m) ? 's' : ''));
const IN_VERBS = ['fill', 'add', 'pour', 'enter', 'gain', 'receive', 'supply', 'flow in', 'pump in', 'arrive', 'restock', 'deliver', 'deposit', 'collect', 'accumulate']; /* level rises */
const OUT_VERBS = ['drain', 'remove', 'leak', 'lose', 'use', 'consume', 'withdraw', 'flow out', 'pump out', 'take out', 'leave', 'empty', 'draw', 'dispatch', 'ship', 'sell', 'spend', 'discharge', 'burn', 'deplete']; /* level falls */
const REPORT_VERBS = ['report', 'read', 'measure', 'show', 'say', 'record', 'indicate'];
const TEMP = { c: '°C', '°c': '°C', celsius: '°C', f: '°F', '°f': '°F', fahrenheit: '°F', k: 'K', kelvin: 'K' };
const sing = w => { w = String(w).toLowerCase(); if (UNIT_ALIAS[w]) return UNIT_ALIAS[w]; if (/ies$/.test(w)) return w.slice(0, -3) + 'y'; if (/(?:ss|us)$/.test(w)) return w; return w.replace(/s$/, ''); };
const plural = (w, q) => (q && q.n === q.d ? w : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(?:s|x|ch|sh)$/.test(w) ? w + 'es' : w + 's');
const verbIn = (txt, list) => list.find(v => { const [h, ...t] = v.split(' '); return new RegExp('\\b' + h + '(?:s|es|ed|ing)?' + (t.length ? ' ' + t.join(' ') : '') + '\\b').test(txt); });
const num = s => (NUMW[s] != null ? Q(BigInt(NUMW[s])) : qp(s));
const NUM = '(\\d+(?:\\.\\d+)?|' + Object.keys(NUMW).join('|') + ')';
/* ---- RATES ---- */
function readRates(raw, last) { const low = qualifyUnits(String(raw).toLowerCase().replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim()), sents = low.split(/(?<=[.;!?])\s+/).map(s => s.replace(/[.;!]+$/, '').trim()).filter(Boolean);
  const qs = sents.filter(s => /\?$/.test(s) || /^(?:how|when|what)\b/.test(s)), facts = sents.filter(s => !qs.includes(s));
  const sc = { subject: null, unit: null, tunit: null, start: null, cap: null, low: null, ins: [], outs: [], lumpIn: [], lumpOut: [], dur: null }; let bad = false;
  let F = Q(1n); /* the factor of the unit last accepted by unitOk, into the scenario's unit */
  const unitOk = u => { u = sing(u); if (TIME[u]) return false; F = Q(1n); if (!sc.unit) sc.unit = u; else if (sc.unit !== u) {
      if (VOL[u] && VOL[sc.unit]) { F = div(VOL[u], VOL[sc.unit]); if (!(sc.conv || []).includes(u)) sc.conv = (sc.conv || []).concat([u]); } /* 4.9.78: an exact, defined conversion */
      else if ((AMBIGUOUS_UNIT[u] && (VOL[sc.unit] || AMBIGUOUS_UNIT[sc.unit])) || (AMBIGUOUS_UNIT[sc.unit] && VOL[u])) sc.ambiguous = AMBIGUOUS_UNIT[u] ? u : sc.unit; /* US or imperial: never assumed */
      else if (!(sc.mixed || []).includes(u)) sc.mixed = (sc.mixed || [sc.unit]).concat([u]); } return true; }; /* C7: a second volume unit is a diagnostic (no conversion is stated), never a silent drop */
  const cv = v => (v && v.n !== undefined ? mul(v, F) : v);
  const rateRe = new RegExp(NUM + '[ -]([a-z]+(?:-[a-z]+)*) (?:per|each|every|a|an|/) ?(second|sec|minute|min|hour|hr|day)s?\\b', 'g');
  for (const s of facts) {
    const capm = s.match(new RegExp('^(?:a|an|the) ' + NUM + '[ -]([a-z]+(?:-[a-z]+)*) ([a-z]+)')) || null; if (capm && !TIME[sing(capm[2])] && unitOk(capm[2])) { sc.cap = cv(num(capm[1])); sc.subject = sc.subject || 'the ' + capm[3]; }
    const cap2 = s.match(new RegExp('(?:capacity of|holds? up to|can hold|holds at most) ' + NUM + ' ([a-z]+(?:-[a-z]+)*)')); if (cap2 && unitOk(cap2[2])) sc.cap = cv(num(cap2[1]));
    const lo = s.match(new RegExp('(?:(?:cannot|can\'t|must not|never) (?:go|fall|drop) below|lower bound of|minimum of|at least) ' + NUM + '[ -]([a-z]+(?:-[a-z]+)*)')); if (lo && unitOk(lo[2])) sc.low = cv(num(lo[1]));
    if (!sc.subject) { const sm = s.match(/^(?:a|an|the) ([a-z]+)\b/); if (sm) sc.subject = 'the ' + sm[1]; }
    for (const cl of s.split(/,? and |, /)) { let m; rateRe.lastIndex = 0; const rm = rateRe.exec(cl) || new RegExp(NUM + ' ([a-z]+(?:-[a-z]+)*) (?:each|every|per|a) (second|sec|minute|min|hour|hr|day)\\b').exec(cl);
      if (rm) { if (!unitOk(rm[2])) { bad = true; continue; } const t = sing(rm[3]); if (!sc.tunit) sc.tunit = t; const r = cv(div(mul(num(rm[1]), TIME[sc.tunit]), TIME[t])); /* per the scenario's time unit */
        const vin = verbIn(cl, IN_VERBS), vout = verbIn(cl, OUT_VERBS); if (vin && !vout) sc.ins.push(r); else if (vout && !vin) sc.outs.push(r); else if (!vin && !vout && /^(?:an? |the )?[a-z]+ [a-z]+s\b/.test(cl.trim())) sc.prod = (sc.prod || []).concat([r]); else bad = true; } /* 4.9.81 DYN-RATE-COUNT: a verb in neither class ("prints 12 pages per minute") is a production rate: it is only counted (below) */
      else if ((m = cl.match(new RegExp('\\b(?:contains?|has|holds?|starts? (?:with|at)|begins? with|is at) ' + NUM + ' ([a-z]+(?:-[a-z]+)*)'))) && !/capacity|up to|at most/.test(cl) && unitOk(m[2])) { sc.start = cv(num(m[1])); sc.holds = /\bholds?\b/.test(m[0]) ? sc.start : null; } /* 4.9.81: "holds N" is a capacity or a content; the question decides (below) */
      else if (/\bis empty\b|\bstarts? empty\b/.test(cl)) sc.start = Q(0n); else if (/\bis full\b|\bstarts? full\b/.test(cl)) sc.start = 'cap';
      else { const vin = verbIn(cl, IN_VERBS), vout = verbIn(cl, OUT_VERBS), lm = cl.match(new RegExp('\\b' + NUM + ' ([a-z]+(?:-[a-z]+)*)\\b'));
        /* 4.9.100: a finite amount on an inflow or outflow verb is a lump, not a rate. A "per" we did not read is not guessed to be either. */
        if ((vin || vout) && (lm || /\b(?:per|each|every)\b/.test(cl))) { if (vin && vout || /\b(?:per|each|every)\b/.test(cl) || !lm || TIME[sing(lm[2])] || !unitOk(lm[2])) bad = true;
          else { const qv = cv(num(lm[1])); if (!qv) bad = true; else if (vin) sc.lumpIn.push(qv); else sc.lumpOut.push(qv); } } }
      const dm = cl.match(new RegExp('\\bfor ' + NUM + ' (second|sec|minute|min|hour|hr|day)s?\\b')); if (dm) sc.dur = [num(dm[1]), sing(dm[2])]; } }
  if (sc.start === 'cap') sc.start = sc.cap;
  if (sc.prod && sc.prod.length) { if (sc.ins.length || sc.outs.length || sc.start != null || sc.cap != null) bad = true; else { sc.ins = sc.prod; sc.counted = true; } }
  const rates = sc.ins.length || sc.outs.length, lumps = sc.lumpIn.length || sc.lumpOut.length;
  if (rates && lumps || lumps && sc.dur) bad = true; /* a rate and a lump, or a lump with a duration, is not one reading */
  if (bad || !rates && !lumps || !qs.length || !sc.unit) return null;
  if (rates && !sc.tunit) return null;
  const q = qs[qs.length - 1]; let ask = null; const qd = q.match(new RegExp('\\b(?:after|in|for) ' + NUM + ' (second|sec|minute|min|hour|hr|day)s?\\b'));
  if (/\bhow long\b|\bwhen\b|\bhow many (?:seconds|minutes|hours|days)\b/.test(q)) ask = /\bempty\b|\brun out\b|\breach (?:zero|0)\b|\blast\b/.test(q) ? 'empty' /* 4.9.81: how long a stock lasts = until it runs out */ : /\bfull\b|\bfill\b|\boverflow\b/.test(q) ? 'fill' : null;
  else if (/\bhow much\b|\bhow many\b|\bwhat (?:is|will be) the (?:level|amount|volume|stock|charge)\b|\bremain/.test(q)) ask = 'after';
  if (!rates && lumps) { if (ask !== 'after' || qd) return null; sc.subject = sc.subject || 'it'; sc.ask = 'remain'; return sc; } /* 4.9.100: timeless conservation; a duration in the question is a rate question */
  if (sc.counted) { if (ask !== 'after') return null; sc.start = Q(0n); }
  if (!ask) return null; if (ask === 'fill' && sc.cap == null && sc.holds != null && sc.start === sc.holds) { sc.cap = sc.holds; sc.start = null; } /* 4.9.81: "holds N" asked to fill is the capacity (the start is unstated) */
  if (qd) sc.dur = [num(qd[1]), sing(qd[2])]; if (ask === 'after' && !sc.dur) return null; sc.subject = sc.subject || 'it'; sc.ask = ask; return sc; }
/* what-if / measurement against the last stated scenario (a branch from the STATED inputs) */
function readFollow(raw, last) { if (!last) return null; const low = String(raw).toLowerCase().replace(/\s+/g, ' ').trim().replace(/[?.!]+$/, '');
  let m = low.match(new RegExp('^what (?:if|about)(?: it| they| the [a-z]+)? (?:ran|runs|run|went|goes|continued|lasted)?(?: for| after)? ' + NUM + ' (second|sec|minute|min|hour|hr|day)s?$'));
  if (m) return Object.assign({}, last, { ask: 'after', dur: [num(m[1]), sing(m[2])], branch: 'duration' });
  m = low.match(new RegExp('^(?:i|we) measured ' + NUM + ' ([a-z]+(?:-[a-z]+)*) after ' + NUM + ' (second|sec|minute|min|hour|hr|day)s?$')) || low.match(new RegExp('^(?:a|the) [a-z0-9 ]+ (?:reports|reads|shows) ' + NUM + ' ([a-z]+(?:-[a-z]+)*) after ' + NUM + ' (second|sec|minute|min|hour|hr|day)s?$'));
  if (m && sing(m[2]) === last.unit) return Object.assign({}, last, { ask: 'after', dur: [num(m[3]), sing(m[4])], measured: num(m[1]), branch: 'measurement' });
  return null; }
const unm = u => UNIT_NAME[u] || u, qty = (v, u) => fmt(v) + ' ' + plural(unm(u), v), rate = (v, sc) => fmt(v) + ' ' + plural(unm(sc.unit), v) + '/' + sc.tunit;
function solveRates(sc) {
  /* C7 / C3 (4.9.77): an incompatible unit or an unstated start for a duration question is a typed diagnostic: no number is produced */
  DECIMAL = !!sc.conv;
  if (sc.ambiguous && !sc.mixed) return { mode: 'rate', subject: sc.subject, diagnostic: 'ambiguous_unit', unit: sc.ambiguous, readings: AMBIGUOUS_UNIT[sc.ambiguous].map(x => UNIT_NAME[x] || x), missing: ['which ' + sc.ambiguous + ' is meant'], assumed: [], scenario: enc(sc), result: null, ask: sc.ask };
  if (sc.mixed) return { mode: 'rate', subject: sc.subject, diagnostic: 'units', units: sc.mixed.map(x => plural(x, Q(2n))), missing: ['unit conversion'], assumed: [], scenario: enc(sc), result: null, ask: sc.ask };
  if (sc.start == null && (sc.ask === 'after' || sc.ask === 'remain')) return { mode: 'rate', subject: sc.subject, diagnostic: 'start', missing: ['the starting amount'], assumed: [], scenario: enc(sc), result: null, ask: sc.ask };
  if (sc.ask === 'remain') { const ins = sc.lumpIn || [], outs = sc.lumpOut || []; if (!ins.length && !outs.length) return null;
    const net = ins.concat(outs.map(x => Q(-x.n, x.d))).reduce(add, Q(0n)), u = sc.unit, lowB = sc.low || Q(0n), v = add(sc.start, net);
    const list = xs => xs.map(x => qty(x, u)).join(' + '), grp = xs => (xs.length > 1 ? '(' + list(xs) + ')' : list(xs));
    let expr = qty(sc.start, u); if (ins.length) expr += ' + ' + grp(ins); if (outs.length) expr += ' − ' + grp(outs);
    const convNote = x => { const d0 = DECIMAL; DECIMAL = true; const t = fmt(div(VOL[x], VOL[sc.unit])); DECIMAL = d0; return '1 ' + unm(x) + ' = ' + t + ' ' + plural(unm(sc.unit), Q(2n)) + ' (exact by definition)'; };
    const assumed = ['only the stated amounts change the stock'].concat((sc.conv || []).map(convNote));
    const out = { mode: 'rate', subject: sc.subject, assumed, scenario: enc(sc), ask: 'remain', expr };
    if (lt(v, lowB)) { assumed.push(sc.low ? 'the stated lower bound' : 'it cannot go below empty'); return Object.assign(out, { result: { text: qty(v, u), unbound: qty(v, u), bound: qty(lowB, u), clamped: true } }); }
    if (sc.cap && lt(sc.cap, v)) { assumed.push('the stock cannot pass its capacity'); return Object.assign(out, { result: { text: qty(v, u), unbound: qty(v, u), bound: qty(sc.cap, u), clamped: true } }); }
    return Object.assign(out, { result: { text: qty(v, u) } }); }
  if (!sc.tunit) return null; /* a conserved stock has no rate; do not invent one on a later turn */
  const net = sc.ins.concat(sc.outs.map(x => Q(-x.n, x.d))).reduce(add, Q(0n)), u = sc.unit, T = sc.tunit, assumed = [sc.ins.length + sc.outs.length > 1 ? 'the rates stay constant' : 'the rate stays constant'].concat((sc.conv || []).map(x => '1 ' + unm(x) + ' = ' + (() => { const d0 = DECIMAL; DECIMAL = true; const t = fmt(div(VOL[x], VOL[sc.unit])); DECIMAL = d0; return t; })() + ' ' + plural(unm(sc.unit), Q(2n)) + ' (exact by definition)'));
  const list = xs => xs.map(x => rate(x, sc)).join(' + '), grp = xs => (xs.length > 1 ? '(' + list(xs) + ')' : list(xs));
  const rising = () => (sc.outs.length ? '(' + list(sc.ins) + ' − ' + list(sc.outs) + ')' : grp(sc.ins)), falling = () => (sc.ins.length ? '(' + list(sc.outs) + ' − ' + list(sc.ins) + ')' : grp(sc.outs));
  const lowB = sc.low || Q(0n); let start = sc.start; if (start == null) { if (sc.ask === 'fill') { start = Q(0n); assumed.push(sc.subject + ' starts with 0 ' + plural(u, Q(2n))); } else return null; }
  const out = { mode: 'rate', subject: sc.subject, assumed, scenario: enc(sc) }, abs = x => (x.n < 0n ? Q(-x.n, x.d) : x);
  const toward = (tgt) => { const gap = sub(tgt, start), up = sgn(gap) > 0; return { expr: (up ? '(' + qty(tgt, u) + ' − ' + qty(start, u) + ')' : '(' + qty(start, u) + ' − ' + qty(tgt, u) + ')') + ' ÷ ' + (up ? rising() : falling()), t: div(abs(gap), abs(net)) }; };
  if (sc.ask === 'fill' || sc.ask === 'empty') { const tgt = sc.ask === 'fill' ? sc.cap : lowB; if (tgt == null) return null; const gap = sub(tgt, start);
    if (sgn(gap) === 0) return Object.assign(out, { expr: qty(start, u) + ' − ' + qty(tgt, u), result: { text: '0 ' + plural(u, Q(2n)) } });
    if (sgn(net) === 0 || sgn(net) !== sgn(gap)) return Object.assign(out, { expr: sc.ins.length && sc.outs.length ? list(sc.ins) + ' − ' + list(sc.outs) : sc.ins.length ? list(sc.ins) : '0 − ' + grp(sc.outs), result: { text: rate(net, sc), never: true }, target: qty(tgt, u) });
    const w = toward(tgt); return Object.assign(out, { expr: w.expr, result: { text: fmt(w.t) + ' ' + plural(T, w.t) } }); }
  const d = div(mul(sc.dur[0], TIME[sc.dur[1]]), TIME[T]), v = add(start, mul(net, d)), bnd = sgn(net) < 0 && lt(v, lowB) ? [lowB, sc.low ? 'the stated lower bound' : 'it cannot go below empty'] : sgn(net) > 0 && sc.cap && lt(sc.cap, v) ? [sc.cap, 'its capacity'] : null;
  if (bnd) { const w = toward(bnd[0]); Object.assign(out, { expr: w.expr, result: { text: fmt(w.t) + ' ' + plural(T, w.t), bound: qty(bnd[0], u) } }); assumed.push('it stays at ' + qty(bnd[0], u) + ' until ' + qty(d, T) + ' (' + bnd[1] + ')'); }
  else Object.assign(out, { expr: sc.counted ? grp(sc.ins) + ' × ' + qty(d, T) : qty(start, u) + (sgn(net) < 0 || (!sc.ins.length) ? ' − ' + falling() : ' + ' + rising()) + ' × ' + qty(d, T), result: { text: qty(v, u) } });
  const final = bnd ? bnd[0] : v; if (sc.measured) { if (fmt(sc.measured) !== fmt(final)) { out.measured = qty(sc.measured, u) + ' after ' + qty(d, T); out.predicted = qty(final, u);
      /* WMS §5.11: a discrepancy is evidence that SOME input of the model may be wrong; each input and an unmodelled flow is a candidate, none is asserted */
      out.explanations = [sc.start != null ? 'the start was not ' + qty(sc.start, u) : null].concat(sc.ins.map(x => 'the inflow was not ' + rate(x, sc)), sc.outs.map(x => 'the outflow was not ' + rate(x, sc)),
        ['the duration was not ' + qty(d, T), lt(sc.measured, final) ? 'an unmodelled outflow' : 'an unmodelled inflow', 'the measurement is wrong']).filter(Boolean); } else out.assumed.push('the measured ' + qty(sc.measured, u) + ' agrees'); }
  return out; }
const enc = sc => JSON.parse(JSON.stringify(sc, (k, v) => (v && typeof v === 'object' && typeof v.n === 'bigint' ? fmtQ(v) : typeof v === 'bigint' ? String(v) : v)));
const dec = sc => { const r = s => { const m = String(s).replace('−', '-').match(/^(-?)(?:(\d+) )?(\d+)(?:\/(\d+))?$/); if (!m) return null; const neg = m[1] ? -1n : 1n; if (m[4]) return Q(neg * (BigInt(m[2] || 0) * BigInt(m[4]) + BigInt(m[3])), BigInt(m[4])); return Q(neg * BigInt(m[3])); };
  return Object.assign({}, sc, { start: sc.start == null ? null : r(sc.start), cap: sc.cap == null ? null : r(sc.cap), low: sc.low == null ? null : r(sc.low), measured: sc.measured == null ? undefined : r(sc.measured), ins: (sc.ins || []).map(r), outs: (sc.outs || []).map(r), lumpIn: (sc.lumpIn || []).map(r), lumpOut: (sc.lumpOut || []).map(r), dur: sc.dur ? [r(sc.dur[0]), sc.dur[1]] : null }); };
/* ---- REPORTS ---- */
function readReports(raw) { const t = String(raw).replace(/\s+/g, ' ').trim(), body = t.replace(/;?\s*(?:what do we know|what can we conclude|what is the [a-z]+|which is (?:right|true|correct))\?*\s*$/i, ''), same = /\bat the same time\b|\bsimultaneously\b/i.test(body);
  const re = new RegExp('(?:^|[,;]\\s*|\\band\\s+|\\.\\s+)(?:(?:the|a)\\s+)?((?:[A-Za-z]+\\s+)?[A-Z][A-Za-z]*\\d+|[A-Z]\\d*)\\s+(' + REPORT_VERBS.map(v => v + 's?').join('|') + ')\\s+(-?\\d+(?:\\.\\d+)?)\\s*(°?[A-Za-z%]+)\\b(?:\\s+at\\s+(\\d{1,2}(?::\\d\\d)?(?:\\s*[ap]m)?))?', 'g');
  const reps = []; let m; while ((m = re.exec(body))) { const u = TEMP[m[4].toLowerCase()] || m[4]; reps.push({ source: m[1].replace(/\s+/g, ' '), value: m[3] + ' ' + u, unit: u, num: m[3], at: m[5] || null }); }
  if (reps.length < 2 || new Set(reps.map(r => r.unit)).size !== 1) return null; const times = new Set(reps.map(r => r.at)); const simultaneous = same || (times.size === 1 && reps[0].at);
  const differ = new Set(reps.map(r => fmt(qp(r.num)))).size > 1; return { mode: 'reports', reports: reps.map(r => ({ source: r.source, value: r.value })), conflict: differ && !!simultaneous, differ, simultaneous: !!simultaneous }; }
/* ---- SCOPE ---- */
function readScope(raw, isVerb) { const sents = String(raw).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/), st = sents[0].replace(/[.!]$/, ''), m = st.match(/^([A-Za-z]+ly),\s+(.+)$/); if (!m) return null;
  const adv = m[1].toLowerCase(), w = m[2].toLowerCase().split(' '), ri = w.findIndex(x => x === 'that' || x === 'who' || x === 'which'); if (ri < 1 || ri > 3) return null;
  const np = w.slice(0, ri).join(' '); let mi = -1; for (let i = ri + 2; i < w.length; i++) if (isVerb(w[i])) { mi = i; break; } if (mi < 0 || !isVerb(w[ri + 1])) return null;
  const inner = w.slice(ri + 1, mi).join(' '), main = w.slice(mi).join(' '), reading = np + ' ' + w[ri] + ' ' + inner + ' ' + main + ' ' + adv, out = { mode: 'scope', adverb: adv, main: w[mi], inner: w[ri + 1], reading };
  const q = (sents[1] || '').toLowerCase().replace(/\?$/, ''); if (q) { const qm = q.match(/^(?:do|does|did) (.+?) ([a-z]+) ([a-z]+ly)$/) || q.match(/^(?:do|does|did) (.+?) ([a-z]+ly) ([a-z]+)$/); if (!qm) return null;
    const [qv, qa] = /ly$/.test(qm[3]) ? [qm[2], qm[3]] : [qm[3], qm[2]], head = np.split(' ').pop(); if (qa !== adv || qm[1].split(' ').pop() !== head) return null;
    const stem = x => x.replace(/(?:es|s)$/, ''); if (stem(qv) === stem(w[mi])) out.answer = 'yes'; else if (stem(qv) === stem(w[ri + 1])) { out.answer = 'unsaid'; out.asked = qm[1] + ' ' + qv + ' ' + adv; } else return null; }
  return out; }
/* ---- WHAT-IF over the durable causal links ---- */
const LINK_BUDGET = 32; /* C12: the most cause links one what-if follows; past it the result is resource_limited and the frontier is kept */
/* WHAT-IF reading (4.9.92; replaces the phrase filters): the question is "what" + (nothing | a verb group whose verb is one of occurrence) +
   "if" + a clause. The node is the longest stored causal node the clause contains (token for token, number aside); the supposition removes it
   when a word outside the node is a negator (closed class: no, not, without, never) or a verb of ending (H.endV, by its WordNet gloss). H comes
   from the kernel's lexicon: H.occur(w) (a verb glossed "come to pass / take place / happen / result"), H.endV(w), H.aux(w) (closed-class
   auxiliary or modal). Without H, only "what if" and the verb "happen" are read (no lexicon: no verb classes). */
const NEGW = new Set(['no', 'not', 'without', 'never']);
function readWhatIf(raw, links, nodes, H) { H = H || {}; const low = String(raw).toLowerCase().replace(/\s+/g, ' ').trim().replace(/[?.!]+$/, ''); const t = low.split(' '); if (t[0] !== 'what' || !links.length) return null;
  const i = t.indexOf('if'); if (i < 1 || i === t.length - 1) return null; const mid = t.slice(1, i); const aux = H.aux || (w => /^(would|will|could|might|does|did|do|can)$/.test(w)); const occur = H.occur || (w => /^happen(s|ed)?$/.test(w));
  if (mid.length && !(mid.slice(0, -1).every(aux) && occur(mid[mid.length - 1]))) return null;
  const c = t.slice(i + 1); const sg = w => w.replace(/(?<=[a-z]{3})s$/, ''); let key = null, at = -1, len = 0;
  for (const n of nodes) { const nw = String(n).split(' ').filter(w => !/^(the|a|an|some)$/.test(w)); if (!nw.length || nw.length <= len) continue; for (let j = 0; j + nw.length <= c.length; j++) if (nw.every((w, k) => sg(c[j + k]) === sg(w))) { key = n; at = j; len = nw.length; break; } }
  if (!key) return null; const outside = c.filter((w, j) => j < at || j >= at + len); const op = outside.some(w => NEGW.has(w) || (H.endV && H.endV(w))) ? 'remove' : 'do';
  const causes = links.filter(l => l.kind === 'cause'), prev = links.filter(l => l.kind === 'prevent'), effects = [], seen = new Set([key]), q = [key];
  let limited = false; while (q.length && !limited) { const x = q.shift(); for (const l of causes.filter(l => l.a === x)) { if (effects.length >= LINK_BUDGET) { limited = true; q.unshift(x); break; } if (!effects.some(e => e.from === l.a && e.to === l.b)) effects.push(Object.assign({ from: l.a, to: l.b, premise: l.premise, text: l.text }, l.form ? { form: l.form } : {})); if (!seen.has(l.b)) { seen.add(l.b); q.push(l.b); } } }
  const prevented = prev.filter(p => seen.has(p.b) && p.b !== key).map(p => ({ by: p.a, what: p.b, premise: p.premise, text: p.text }));
  /* removal: what still has a stored cause chain that does not pass through X, and what loses every stored cause */
  const other = op === 'remove' ? causes.filter(l => seen.has(l.b) && l.b !== key && !seen.has(l.a)).map(l => ({ by: l.a, what: l.b, premise: l.premise, text: l.text })) : [];
  const kept = new Set(), st = other.map(o => o.what); while (st.length) { const x = st.pop(); if (kept.has(x)) continue; kept.add(x); for (const l of causes.filter(l => l.a === x && l.b !== key)) st.push(l.b); }
  const lost = op === 'remove' ? [...seen].filter(n => n !== key && !kept.has(n)) : [];
  /* C2: an association (correlation) is not a mechanism: it is reported, never followed */
  const association = links.filter(l => l.kind === 'association' && (l.a === key || l.b === key)).map(l => ({ a: l.a, b: l.b, premise: l.premise, text: l.text }));
  return Object.assign({ mode: 'whatif', node: key, op, effects, prevented, other, lost, association }, limited ? { status: 'resource_limited', frontier: [...new Set(q)] } : {}); }
function causalLinks(relations, causalOf, conds) { return (conds || []).map(c => Object.assign({ kind: 'cause', form: 'if' }, c)).concat(relations.filter(r => r.origin === 'stated' && r.polarity === 'pos' && causalOf(r.pred)).map(r => ({ a: r.a.replace(/_/g, ' '), b: r.b.replace(/_/g, ' '), kind: causalOf(r.pred), premise: r.premise, text: r.text }))); }
/* the one entry: the first construction that reads the WHOLE input decides; none → null (the input is not a dynamics input) */
function read(raw, env) { const f = readFollow(raw, env.last && dec(env.last)); if (f) { const r = solveRates(f); return r && Object.assign(r, { branch: f.branch }); }
  const sc = readRates(raw); if (sc) return solveRates(sc);
  const rp = readReports(raw); if (rp) return rp; const s = readScope(raw, env.isVerb || (() => false)); if (s) return s;
  if (env.links) { const links = causalLinks(env.links, env.causalOf, env.conds), nodes = [...new Set(links.flatMap(l => [l.a, l.b]))]; return readWhatIf(raw, links, nodes, env.whatIf); } return null; }
/* independent re-verification of a voiced answer (Echo): the decision is recomputed from the material's own inputs */
function check(m, env) { try { if (m.mode === 'rate') { const r = solveRates(dec(m.scenario)); if (m.diagnostic) return !!r && r.diagnostic === m.diagnostic && JSON.stringify(r.missing) === JSON.stringify(m.missing); return !!r && !r.diagnostic && r.expr === m.expr && r.result.text === m.result.text && !!r.result.never === !!m.result.never && JSON.stringify(r.explanations || null) === JSON.stringify(m.explanations || null); }
  if (m.mode === 'reports') { const vs = m.reports.map(r => r.value), differ = new Set(vs).size > 1; return differ === m.differ && m.conflict === (differ && m.simultaneous); }
  if (m.mode === 'scope') return m.main !== m.inner && m.reading.split(' ').pop() === m.adverb;
  if (m.mode === 'whatif') { const links = causalLinks(env.links || [], env.causalOf, env.conds), r = readWhatIf(m.op === 'remove' ? 'what if there is no ' + m.node : 'what happens if ' + m.node, links, [...new Set(links.flatMap(l => [l.a, l.b]))]); return !!r && JSON.stringify(r.effects) === JSON.stringify(m.effects) && JSON.stringify(r.other) === JSON.stringify(m.other) && JSON.stringify(r.association) === JSON.stringify(m.association) && (r.status || null) === (m.status || null); } } catch (e) { return false; } return undefined; }
/* ---- CausalResult (WMS §5.10, forge-causal-result/v1): the typed record of what a dynamics answer is and rests on; the kernel adds the world version ---- */
function causalResult(m, ctx) { const c = ctx || {}, base = { schema: 'forge-causal-result/v1', query_id: c.query_id || null, world_version: c.world_version || null, mechanism_ids: [], premise_refs: [], intervention_refs: [], derived_effects: [], assumptions: (m.assumed || []).slice(), counterevidence_refs: [], competing_models: [], falsifiers: [], missing: [], resource_report: { link_budget: LINK_BUDGET, frontier: m.frontier || [] } };
  if (m.mode === 'rate') { if (m.diagnostic) return Object.assign(base, { mode: 'predict', status: 'unsupported', missing: m.missing.slice(), mechanism_ids: ['DYN-LEVEL'] });
    const rhs = m.result.clamped ? m.result.unbound : m.result.text, eff = { text: m.subject + ': ' + (m.expr + ' = ' + rhs) + (m.result.clamped ? ' (bounded at ' + m.result.bound + ')' : ''), observed: false }, r = Object.assign(base, { mode: 'predict', status: 'conditionally_predicted', mechanism_ids: ['DYN-LEVEL'], derived_effects: [eff], falsifiers: ['a measurement that differs from ' + (m.result.clamped ? m.result.bound : m.result.text)] });
    if (m.measured) Object.assign(r, { mode: 'explain', status: 'candidate_explanation', mechanism_ids: [], counterevidence_refs: ['reported ' + m.measured], competing_models: (m.explanations || []).slice() }); /* C11: the level equation is no longer the asserted mechanism */
    return r; }
  if (m.mode === 'reports') return Object.assign(base, { mode: 'compare', status: m.conflict ? 'underdetermined' : 'entailed_under_assumptions', premise_refs: m.reports.map(r => r.source + ': ' + r.value) });
  if (m.mode === 'scope') return Object.assign(base, { mode: 'deduce', status: 'entailed_under_assumptions', mechanism_ids: ['DYN-SCOPE'] });
  if (m.mode === 'whatif') { const prem = [...new Set(m.effects.concat(m.prevented, m.other).map(e => e.premise).filter(Boolean))];
    if (!m.effects.length && (m.association || []).length) return Object.assign(base, { mode: 'intervene', status: 'unsupported', intervention_refs: [m.node], premise_refs: [...new Set(m.association.map(a => a.premise))], missing: ['a causal mechanism'] });
    return Object.assign(base, { mode: 'intervene', status: m.status === 'resource_limited' ? 'resource_limited' : 'conditionally_predicted', mechanism_ids: ['CAUSAL-' + (m.op === 'remove' ? 'REMOVE' : 'DO')], intervention_refs: [m.node], premise_refs: prem,
      derived_effects: m.effects.map(e => ({ text: e.from + ' → ' + e.to, observed: false })), competing_models: m.other.map(o => o.by + ' also causes ' + o.what), assumptions: ['only the stored links act'] }); }
  return Object.assign(base, { mode: 'deduce', status: 'unsupported' }); }
const DOCS = { rate: 'M4 rate/time: level(t) = start + (Σin − Σout)·t within its bounds; constant rates assumed and stated', reports: 'M4 reports: each value attributed; same-time difference = unresolved conflict, never averaged', scope: 'M4 scope: a fronted adverb modifies the main verb, not the relative clause (structure dependence)', whatif: 'M4 intervention over stored causal links (world_rules causal rows)' };
const api = { read, check, causalResult, LINK_BUDGET, DOCS, solveRates, readRates, readReports, readScope, readWhatIf, causalLinks, fmt, Q, IN_VERBS, OUT_VERBS, REPORT_VERBS, TIME };
if (isNode) module.exports = api; else root.KDynamics = api;
})(typeof self !== 'undefined' ? self : this);
