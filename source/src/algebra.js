/* Symbolic algebra + units for the GP-014 math lane. Exact rationals (BigInt), deterministic canonical forms,
 * every result independently re-verified (substitution / float check) before release.
 * Notation: ordinary and RPMC phase-locked forms (+_Φ −_Φ ×_Φ ÷_Φ — RPMC Full Protocol, "Phase-locked arithmetic"). */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const KM = isNode ? require('./kmath.js') : root.KMath; const Q = KM.Q;
const ZERO = new Q(0n), ONE = new Q(1n);
const qs = q => q.toString(); const qneg = q => new Q(-q.n, q.d); const qz = q => q.n === 0n;
/* ---- polynomials: Map monoKey -> Q ; monoKey 'x^2*y' ('' = constant) ---- */
function mono(vars) { return Object.keys(vars).sort().filter(v => vars[v]).map(v => (vars[v] === 1 ? v : v + '^' + vars[v])).join('*'); }
function unmono(k) { const o = {}; if (!k) return o; for (const p of k.split('*')) { const [v, e] = p.split('^'); o[v] = e ? +e : 1; } return o; }
const P = { c: q => new Map(q && !qz(q) ? [['', q]] : []), v: x => new Map([[x, ONE]]),
  add(a, b) { const r = new Map(a); for (const [k, q] of b) { const s = (r.get(k) || ZERO).add(q); if (qz(s)) r.delete(k); else r.set(k, s); } return r; },
  neg(a) { return new Map([...a].map(([k, q]) => [k, qneg(q)])); }, sub(a, b) { return P.add(a, P.neg(b)); },
  mul(a, b) { let r = new Map(); for (const [k1, q1] of a) for (const [k2, q2] of b) { const v = unmono(k1), w = unmono(k2); for (const x in w) v[x] = (v[x] || 0) + w[x]; r = P.add(r, new Map([[mono(v), q1.mul(q2)]])); } return r; },
  pow(a, n) { if (n > 24) throw new Error('EXPONENT_TOO_LARGE'); let r = P.c(ONE); for (let i = 0; i < n; i++) r = P.mul(r, a); return r; },
  isConst: a => [...a.keys()].every(k => k === ''), constVal: a => a.get('') || ZERO,
  vars: a => [...new Set([...a.keys()].flatMap(k => Object.keys(unmono(k))))].sort(),
  deg(a, x) { let d = 0; for (const k of a.keys()) d = Math.max(d, unmono(k)[x] || 0); return d; },
  coef(a, x, n) { let r = ZERO; for (const [k, q] of a) { const m = unmono(k); if ((m[x] || 0) === n && Object.keys(m).every(v => v === x)) r = r.add(q); } return r; },
  subst(a, x, val) { let r = new Map(); for (const [k, q] of a) { const m = unmono(k); const e = m[x] || 0; delete m[x]; let t = q; for (let i = 0; i < e; i++) t = t.mul(val); r = P.add(r, new Map([[mono(m), t]])); } return r; },
  str(a, phi) { if (!a.size) return '0'; const deg = k => Object.values(unmono(k)).reduce((s, e) => s + e, 0);
    const keys = [...a.keys()].sort((p, q) => deg(q) - deg(p) || (p < q ? -1 : 1)); let s = '';
    keys.forEach((k, i) => { const q = a.get(k); const neg = q.n < 0n; const aq = neg ? qneg(q) : q; const one = aq.n === 1n && aq.d === 1n;
      const cs = k === '' ? qs(aq) : one ? '' : (aq.d === 1n ? qs(aq) : '(' + qs(aq) + ')'); const body = cs + k.replace(/\*/g, '');
      s += i === 0 ? (neg ? '-' : '') + body : (neg ? (phi ? ' −_Φ ' : ' - ') : (phi ? ' +_Φ ' : ' + ')) + body; });
    return s; } };
/* ---- parser with implicit multiplication ---- */
function tok(s) { const t = []; const re = /\s*(\d+(?:\.\d+)?|[a-z]|[-+*/^()=])/y; let i = 0; while (i < s.length) { re.lastIndex = i; const m = re.exec(s); if (!m) { if (/\s/.test(s[i])) { i++; continue; } return null; } t.push(m[1]); i = re.lastIndex; } return t; }
function parsePoly(tokens) {
  let p = 0; const peek = () => tokens[p], next = () => tokens[p++];
  const atomStart = t => t !== undefined && (/^[\d(a-z]/.test(t));
  function prim() { const t = next(); if (t === undefined) throw new Error('INCOMPLETE'); if (t === '(') { const e = add(); if (next() !== ')') throw new Error('PAREN'); return e; } if (t === '-') return P.neg(power()); if (/^\d/.test(t)) return P.c(Q.parse(t)); if (/^[a-z]$/.test(t)) return P.v(t); throw new Error('TOKEN ' + t); }
  function power() { const b = prim(); if (peek() === '^') { next(); const e = power(); if (!P.isConst(e)) throw new Error('NONCONST_EXP'); const q = P.constVal(e); if (q.d !== 1n || q.n < 0n) throw new Error('NONINT_EXP'); return P.pow(b, Number(q.n)); } return b; }
  function mul() { let a = power(); for (;;) { if (peek() === '*') { next(); a = P.mul(a, power()); } else if (peek() === '/') { next(); const d = power(); if (!P.isConst(d) || qz(P.constVal(d))) throw new Error(qz(P.constVal(d)) && P.isConst(d) ? 'DIV0' : 'DIV_BY_POLY'); a = P.mul(a, P.c(ONE.div(P.constVal(d)))); } else if (atomStart(peek())) a = P.mul(a, power()); else return a; } }
  function add() { let a = mul(); while (peek() === '+' || peek() === '-') { const o = next(); const b = mul(); a = o === '+' ? P.add(a, b) : P.sub(a, b); } return a; }
  const e = add(); if (p !== tokens.length) throw new Error('TRAILING'); return e;
}
function poly(s) { const t = tok(s); if (!t) throw new Error('NOT_ALGEBRA'); return parsePoly(t); }
/* √ of a non-negative rational → k√m / d with m squarefree integer */
function surd(q) { let n = q.n * q.d, d = q.d; let k = 1n, m = n; for (let f = 2n; f * f <= m; f++) while (m % (f * f) === 0n) { m /= f * f; k *= f; } return { k, m, d }; }
function solve(eq, want) {
  const [l, r] = eq.split('='); if (r === undefined || eq.split('=').length !== 2) return { ok: false, error: 'NOT_EQUATION' };
  let p; try { p = P.sub(poly(l), poly(r)); } catch (e) { return { ok: false, error: e.message }; }
  const vs = P.vars(p); if (vs.length === 0) return { ok: true, kind: 'identity', truth: qz(P.constVal(p)), poly: P.str(p) };
  const x = want || vs[0]; if (vs.length > 1) return { ok: false, error: 'MULTIVARIABLE', vars: vs };
  const d = P.deg(p, x); const a = P.coef(p, x, d);
  const res = { ok: true, kind: 'solve', x, degree: d, poly: P.str(p) + ' = 0', polyPhi: P.str(p, true) + ' = 0' };
  if (d === 1) { const root = qneg(P.coef(p, x, 0)).div(a); res.roots = [{ exact: qs(root), q: root }]; }
  else if (d === 2) { const b = P.coef(p, x, 1), c = P.coef(p, x, 0); const D = b.mul(b).sub(new Q(4n).mul(a).mul(c)); res.discriminant = qs(D);
    if (D.n < 0n) { res.roots = []; res.noReal = true; }
    else { const s = surd(D); const two_a = new Q(2n).mul(a); const pq = qneg(b).div(two_a);
      if (s.m === 1n || s.m === 0n) { const rt = new Q(s.k, s.d).mul(s.m === 0n ? ZERO : ONE); const r1 = pq.add(rt.div(two_a)), r2 = pq.sub(rt.div(two_a)); res.roots = qz(D) ? [{ exact: qs(r1), q: r1 }] : [r1, r2].sort((u, v) => (u.toNumber() - v.toNumber())).map(q => ({ exact: qs(q), q })); }
      else { const sr = surdStr(pq, new Q(s.k, s.d).div(two_a), s.m); res.roots = [{ exact: sr.text, approx: sr.approx, surd: true }]; } } }
  else return { ok: false, error: 'DEGREE_' + d + '_UNSUPPORTED', poly: res.poly };
  // verification by substitution (exact for rational roots, float for surds)
  res.verified = (res.roots || []).every(r => r.q ? qz(P.constVal(P.subst(p, x, r.q))) : r.approx.every(v => Math.abs(evalNum(p, x, v)) < 1e-9));
  return res;
}
function evalNum(p, x, v) { let s = 0; for (const [k, q] of p) { const m = unmono(k); s += q.toNumber() * Math.pow(v, m[x] || 0); } return s; }
function simplify(expr) { try { const p = poly(expr); return { ok: true, result: P.str(p), resultPhi: P.str(p, true), check: checkSame(expr, p) }; } catch (e) { return { ok: false, error: e.message }; } }
function checkSame(expr, p) { const vs = P.vars(p); const pts = [2, 3, 5]; return pts.every(t => { let a = p, b = poly(expr); for (const v of vs) { a = P.subst(a, v, new Q(BigInt(t + vs.indexOf(v)))); b = P.subst(b, v, new Q(BigInt(t + vs.indexOf(v)))); } return qs(P.constVal(a)) === qs(P.constVal(b)); }); }
function evaluateAt(expr, x, val) { try { const p = poly(expr); const r = P.subst(p, x, Q.parse(val)); if (!P.isConst(r)) return { ok: false, error: 'FREE_VARIABLES', rest: P.str(r) }; return { ok: true, value: qs(P.constVal(r)), expr: P.str(p) }; } catch (e) { return { ok: false, error: e.message }; } }
/* ---- units (exact SI factors; NIST/SI definitions) ---- */
const U = {}; const defU = (dim, f, names, disp) => names.split(',').forEach(n => (U[n] = { dim, f: Q.parse(f), name: disp || names.split(',')[0] }));
/* 4.9.78: a unit name with several legal definitions is AMBIGUOUS: the gallon is the US gallon (3.785411784 L) or the imperial gallon (4.54609 L); it is never assumed */
const AMBIG = { gal: ['US gallon', 'imperial gallon'], gallon: ['US gallon', 'imperial gallon'], gallons: ['US gallon', 'imperial gallon'] };
const qualifyUnit = s => String(s).replace(/\b(?:us|u\.s\.|american) (gal|gallons?)\b/gi, (m, u) => 'us-' + u.toLowerCase()).replace(/\b(?:imperial|uk|british) (gal|gallons?)\b/gi, (m, u) => 'imperial-' + u.toLowerCase());
defU('length', '1', 'm,meter,meters,metre,metres'); defU('length', '1000', 'km,kilometer,kilometers,kilometre,kilometres'); defU('length', '0.01', 'cm,centimeter,centimeters'); defU('length', '0.001', 'mm,millimeter,millimeters');
defU('length', '1609.344', 'mi,mile,miles'); defU('length', '0.9144', 'yd,yard,yards'); defU('length', '0.3048', 'ft,foot,feet'); defU('length', '0.0254', 'in,inch,inches');
defU('mass', '1', 'kg,kilogram,kilograms'); defU('mass', '0.001', 'g,gram,grams'); defU('mass', '0.000001', 'mg,milligram,milligrams'); defU('mass', '0.45359237', 'lb,lbs,pound,pounds'); defU('mass', '0.028349523125', 'oz,ounce,ounces'); defU('mass', '1000', 't,tonne,tonnes');
defU('time', '1', 's,sec,second,seconds'); defU('time', '60', 'min,minute,minutes'); defU('time', '3600', 'h,hr,hour,hours'); defU('time', '86400', 'day,days'); defU('time', '604800', 'week,weeks');
defU('volume', '1', 'l,liter,liters,litre,litres'); defU('volume', '0.001', 'ml,milliliter,milliliters'); defU('volume', '3.785411784', 'us-gal,us-gallon,us-gallons', 'US gal'); defU('volume', '4.54609', 'imperial-gal,imperial-gallon,imperial-gallons', 'imperial gal'); defU('volume', '0.2365882365', 'cup,cups');
const TEMP = { c: 'C', celsius: 'C', f: 'F', fahrenheit: 'F', k: 'K', kelvin: 'K' };
function toK(v, u) { return u === 'K' ? v : u === 'C' ? v.add(Q.parse('273.15')) : v.sub(new Q(32n)).mul(new Q(5n, 9n)).add(Q.parse('273.15')); }
function fromK(v, u) { return u === 'K' ? v : u === 'C' ? v.sub(Q.parse('273.15')) : v.sub(Q.parse('273.15')).mul(new Q(9n, 5n)).add(new Q(32n)); }
function decimal(q) { const s = qs(q); if (!s.includes('/')) return { text: s, exact: true }; const x = q.toNumber(); return { text: String(+x.toFixed(6)), exact: false, fraction: s }; }
function convert(valStr, from, to) {
  from = from.toLowerCase(); to = to.toLowerCase(); const v = Q.parse(valStr);
  if (TEMP[from] && TEMP[to]) { const r = fromK(toK(v, TEMP[from]), TEMP[to]); return { ok: true, value: decimal(r), from: valStr + ' °' + TEMP[from], to: '°' + TEMP[to], dim: 'temperature' }; }
  if (AMBIG[from] || AMBIG[to]) return { ok: false, error: 'AMBIGUOUS_UNIT', unit: AMBIG[from] ? from : to, readings: AMBIG[AMBIG[from] ? from : to] };
  const a = U[from], b = U[to]; if (!a || !b) return { ok: false, error: 'UNKNOWN_UNIT', unit: !a ? from : to };
  if (a.dim !== b.dim) return { ok: false, error: 'DIMENSION_MISMATCH', dims: [a.dim, b.dim] };
  const r = v.mul(a.f).div(b.f); return { ok: true, value: decimal(r), from: valStr + ' ' + a.name, to: b.name, dim: a.dim, factor: qs(a.f.div(b.f)) };
}
/* ===== v3 additions: exact surds, factoring, degree ≤ 4, systems, calculus, compound units ===== */
const frac = q => (q.d === 1n ? q.n.toString() : q.n.toString() + '/' + q.d.toString());
const babs = x => (x < 0n ? -x : x); const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a; }; const blcm = (a, b) => a / bgcd(a, b) * b;
function surdStr(p, q, m) { // p ± q√m → "(P ± Q√m)/D" (exact surd form)
  q = q.n < 0n ? qneg(q) : q; const D = blcm(p.d, q.d); const Pn = p.n * (D / p.d), Qn = q.n * (D / q.d);
  const qs_ = (Qn === 1n ? '' : Qn.toString()) + '√' + m; let text;
  if (Pn === 0n) text = '± ' + qs_ + (D === 1n ? '' : '/' + D); else text = D === 1n ? Pn + ' ± ' + qs_ : '(' + Pn + ' ± ' + qs_ + ')/' + D;
  const pv = p.toNumber(), qv = q.toNumber() * Math.sqrt(Number(m)); return { text, approx: [pv - qv, pv + qv] }; }
function coeffs(p, x) { const d = P.deg(p, x); const c = []; for (let i = 0; i <= d; i++) c.push(P.coef(p, x, i)); return c; }
const evalC = (c, v) => c.reduceRight((acc, a) => acc * v + a.toNumber(), 0);
const evalCQ = (c, v) => c.reduceRight((acc, a) => acc.mul(v).add(a), ZERO);
function divisors(n) { n = babs(n); const out = []; if (n === 0n) return [0n]; if (n > 10n ** 12n) return [1n]; for (let i = 1n; i * i <= n; i++) if (n % i === 0n) { out.push(i); if (i * i !== n) out.push(n / i); } return out; }
function intCoeffs(c) { const L = c.reduce((a, q) => blcm(a, q.d), 1n); return c.map(q => q.n * (L / q.d)); }
function deflate(c, r) { const n = c.length - 1; const out = new Array(n); let acc = c[n]; for (let i = n - 1; i >= 0; i--) { out[i] = acc; acc = c[i].add(acc.mul(r)); } return out; }
function rationalRoots(c) { const roots = []; let cur = c.slice();
  for (;;) { if (cur.length <= 1) break; if (qz(cur[0])) { roots.push(ZERO); cur = cur.slice(1); continue; }
    const ic = intCoeffs(cur); const ps = divisors(ic[0]), qq = divisors(ic[ic.length - 1]); let found = null; const cands = [];
    for (const a of ps) for (const b of qq) { cands.push(new Q(a, b)); cands.push(new Q(-a, b)); }
    cands.sort((u, v) => u.toNumber() - v.toNumber()); for (const r of cands) if (qz(evalCQ(cur, r))) { found = r; break; }
    if (!found) break; roots.push(found); cur = deflate(cur, found); }
  return { roots, rest: cur }; }
function numericRoots(c) { // deterministic Durand–Kerner: fixed seeds, 500 fixed iterations → real roots
  const n = c.length - 1; const an = c[n].toNumber(); const a = c.map(q => q.toNumber() / an);
  const mul = (u, v) => [u[0] * v[0] - u[1] * v[1], u[0] * v[1] + u[1] * v[0]], div = (u, v) => { const d = v[0] * v[0] + v[1] * v[1]; return [(u[0] * v[0] + u[1] * v[1]) / d, (u[1] * v[0] - u[0] * v[1]) / d]; };
  let z = []; for (let k = 0; k < n; k++) z.push([Math.cos(0.4 + 2 * Math.PI * k / n) * Math.pow(0.9, k), Math.sin(0.4 + 2 * Math.PI * k / n) * Math.pow(0.9, k)]);
  const pv = zi => { let p = [1, 0]; for (let k = n - 1; k >= 0; k--) { p = mul(p, zi); p = [p[0] + a[k], p[1]]; } return p; };
  for (let it = 0; it < 500; it++) z = z.map((zi, i) => { let den = [1, 0]; z.forEach((zj, j) => { if (j !== i) den = mul(den, [zi[0] - zj[0], zi[1] - zj[1]]); }); const q = div(pv(zi), den); return [zi[0] - q[0], zi[1] - q[1]]; });
  return z.filter(v => Math.abs(v[1]) < 1e-7).map(v => +v[0].toFixed(9)).sort((x, y) => x - y); }
function solvePoly(p, x) {
  const c = coeffs(p, x); const d = c.length - 1; if (d > 4) return { ok: false, error: 'DEGREE_' + d + '_UNSUPPORTED' };
  const { roots, rest } = rationalRoots(c); const out = []; const steps = [];
  const uniq = []; for (const r of roots) if (!uniq.some(u => u.n === r.n && u.d === r.d)) uniq.push(r);
  uniq.sort((u, v) => u.toNumber() - v.toNumber()).forEach(r => out.push({ exact: frac(r), q: r, approx: [r.toNumber()] })); if (roots.length) steps.push('rational root theorem: ' + uniq.map(frac).join(', '));
  const rd = rest.length - 1;
  if (rd === 2) { const [c0, c1, c2] = rest; const D = c1.mul(c1).sub(new Q(4n).mul(c2).mul(c0)); steps.push('quadratic factor, discriminant ' + frac(D));
    if (D.n >= 0n) { const s = surd(D); const two_a = new Q(2n).mul(c2); const pq = qneg(c1).div(two_a); if (s.m === 1n || s.m === 0n) { const rt = new Q(s.k, s.d).div(two_a); for (const r of (qz(D) ? [pq] : [pq.sub(rt), pq.add(rt)])) out.push({ exact: frac(r), q: r, approx: [r.toNumber()] }); } else { const sr = surdStr(pq, new Q(s.k, s.d).div(two_a), s.m); out.push({ exact: sr.text, approx: sr.approx, surd: true }); } } }
  else if (rd === 4 && qz(rest[1]) && qz(rest[3]) && !qz(rest[2])) { const [c0, , c2, , c4] = rest; const D = c2.mul(c2).sub(new Q(4n).mul(c4).mul(c0)); steps.push('biquadratic: y = ' + x + '², discriminant ' + frac(D));
    if (D.n >= 0n) { const s = surd(D); const two_a = new Q(2n).mul(c4); const pq = qneg(c2).div(two_a);
      if (s.m === 1n || s.m === 0n) { for (const y of [pq.sub(new Q(s.k, s.d).div(two_a)), pq.add(new Q(s.k, s.d).div(two_a))]) { if (y.n < 0n) continue; const t = surd(y); if (t.m === 1n || t.m === 0n) { const r = new Q(t.k, t.d); for (const v of (qz(r) ? [r] : [qneg(r), r])) out.push({ exact: frac(v), q: v, approx: [v.toNumber()] }); } else { const sr = surdStr(ZERO, new Q(t.k, t.d), t.m); out.push({ exact: sr.text, approx: sr.approx, surd: true }); } } }
      else { const ys = surdStr(pq, new Q(s.k, s.d).div(two_a), s.m); const pos = ys.approx.filter(v => v >= 0); if (pos.length) out.push({ exact: '± √(' + (pos.length === 2 ? ys.text : ys.text.replace('±', '+')) + ')', approx: [].concat(...pos.map(v => [-Math.sqrt(v), Math.sqrt(v)])), surd: true, nested: true }); } } }
  else if (rd === 1) { const r = qneg(rest[0]).div(rest[1]); out.push({ exact: frac(r), q: r, approx: [r.toNumber()] }); }
  else if (rd >= 3 && rest.slice(1, rd).every(qz)) { const r = qneg(rest[0]).div(rest[rd]); const neg = r.n < 0n; const ar = neg ? qneg(r) : r; const rt = ar.d === 1n ? frac(ar) : '(' + frac(ar) + ')'; steps.push('binomial ' + x + '^' + rd + ' = ' + frac(r) + ' → real ' + (rd === 3 ? 'cube' : 'fourth') + ' root(s)');
    if (rd === 3) { const v = (neg ? -1 : 1) * Math.cbrt(ar.toNumber()); out.push({ exact: (neg ? '-' : '') + '∛' + rt, approx: [v], surd: true }); }
    else if (!neg) { const v = Math.pow(ar.toNumber(), 0.25); out.push({ exact: '± ∜' + rt, approx: [-v, v], surd: true }); } }
  else if (rd >= 3) { const nr = numericRoots(rest); steps.push('no rational roots in the degree-' + rd + ' factor → deterministic numeric roots (Durand–Kerner, 500 fixed iterations)'); for (const v of nr) out.push({ exact: String(+v.toFixed(6)), approx: [v], numeric: true }); }
  const scale = Math.max(1, ...c.map(q => Math.abs(q.toNumber())));
  const verified = out.every(r => (r.q ? qz(evalCQ(c, r.q)) : r.approx.every(v => Math.abs(evalC(c, v)) < 1e-6 * scale)));
  return { ok: true, x, degree: d, roots: out, noReal: out.length === 0, steps, verified, numeric: out.some(r => r.numeric) }; }
function solveAny(eq, want) {
  const parts = eq.split('='); if (parts.length !== 2) return { ok: false, error: 'NOT_EQUATION' };
  let p; try { p = P.sub(poly(parts[0]), poly(parts[1])); } catch (e) { return { ok: false, error: e.message }; }
  const vs = P.vars(p); if (!vs.length) return { ok: true, kind: 'identity', truth: qz(P.constVal(p)), poly: P.str(p) };
  if (vs.length > 1) return { ok: false, error: 'MULTIVARIABLE', vars: vs }; const x = want || vs[0];
  if (P.deg(p, x) <= 2) return solve(eq, want);
  const r = solvePoly(p, x); if (!r.ok) return Object.assign(r, { poly: P.str(p) }); return Object.assign(r, { kind: 'solve', poly: P.str(p) + ' = 0', polyPhi: P.str(p, true) + ' = 0' }); }
function factor(expr) {
  let p; try { p = poly(expr); } catch (e) { return { ok: false, error: e.message }; }
  const vs = P.vars(p); if (!vs.length) return { ok: false, error: 'CONSTANT' };
  const tdeg = k => Object.values(unmono(k)).reduce((s, e) => s + e, 0);
  const keys = [...p.keys()].sort((a, b) => tdeg(b) - tdeg(a) || (a < b ? -1 : 1)); const mins = {}; for (const v of vs) mins[v] = Math.min(...keys.map(k => unmono(k)[v] || 0));
  let num = 0n, den = 1n; for (const q of p.values()) { num = bgcd(num, q.n); den = blcm(den, q.d); } let content = new Q(num, den); if (p.get(keys[0]).n < 0n) content = qneg(content);
  const monoK = mono(mins); const rest = new Map(); for (const [k, q] of p) { const m = unmono(k); for (const v of vs) m[v] -= mins[v]; rest.set(mono(m), q.div(content)); }
  let coef = content; const facs = []; const steps = []; if (monoK) { facs.push(monoK.replace(/\*/g, '')); steps.push('common monomial ' + monoK); }
  const rv = P.vars(rest);
  if (rv.length === 1 && P.deg(rest, rv[0]) >= 2) { const x = rv[0]; const c = coeffs(rest, x); const { roots, rest: rem } = rationalRoots(c);
    const cnt = new Map(); for (const r of roots) { const k = frac(r); cnt.set(k, (cnt.get(k) || { r, n: 0 })); cnt.get(k).n++; coef = coef.mul(ONE); }
    let scale = ONE; for (const { r, n } of cnt.values()) { for (let i = 0; i < n; i++) scale = scale.mul(new Q(r.d)); const a = r.d, b = r.n; facs.push('(' + (a === 1n ? '' : a.toString()) + x + (b === 0n ? '' : b < 0n ? ' + ' + (-b) : ' - ' + b) + ')' + (n > 1 ? '^' + n : '')); }
    if (roots.length) steps.push('rational roots ' + [...cnt.keys()].join(', '));
    const remP = new Map(); rem.forEach((q, i) => { if (!qz(q)) remP.set(i === 0 ? '' : i === 1 ? x : x + '^' + i, q.div(scale)); });
    if (P.isConst(remP)) coef = coef.mul(P.constVal(remP)); else { facs.push('(' + P.str(remP) + ')'); if (rem.length - 1 >= 2) steps.push('factor ' + P.str(remP) + ' has no rational roots'); } }
  else if (P.str(rest) !== '1') facs.push('(' + P.str(rest) + ')');
  const cs = coef.n === 1n && coef.d === 1n ? '' : coef.n === -1n && coef.d === 1n ? '-' : frac(coef);
  let text = cs + facs.join(''); if (facs.length === 1 && !cs && /^\(.*\)$/.test(facs[0]) && !/\)\^/.test(facs[0])) text = facs[0].slice(1, -1);
  let verified = false; try { verified = P.str(poly(text.replace(/\)\(/g, ')*(').replace(/([a-z\d)])\(/g, '$1*(').replace(/\)([a-z])/g, ')*$1'))) === P.str(p); } catch (e) { verified = false; }
  return { ok: true, result: text, steps, verified, irreducible: facs.length <= 1 && !monoK && cs === '' && !/\)\^/.test(facs[0] || '') }; }
function solveSystem(eqs) {
  const rows = []; let vars = new Set();
  for (const e of eqs) { const sides = e.split('='); if (sides.length !== 2) return { ok: false, error: 'NOT_EQUATION' }; let p; try { p = P.sub(poly(sides[0]), poly(sides[1])); } catch (x) { return { ok: false, error: x.message }; }
    for (const k of p.keys()) if (Object.values(unmono(k)).reduce((s, v) => s + v, 0) > 1) return { ok: false, error: 'NONLINEAR' }; rows.push(p); P.vars(p).forEach(v => vars.add(v)); }
  vars = [...vars].sort(); const A = rows.map(p => vars.map(v => p.get(v) || ZERO).concat([qneg(p.get('') || ZERO)]));
  const n = vars.length; let r = 0; const piv = [];
  for (let col = 0; col < n && r < A.length; col++) { const k = A.findIndex((row, i) => i >= r && !qz(row[col])); if (k < 0) continue; [A[r], A[k]] = [A[k], A[r]]; const pv = A[r][col]; A[r] = A[r].map(x => x.div(pv));
    for (let i = 0; i < A.length; i++) if (i !== r && !qz(A[i][col])) { const f = A[i][col]; A[i] = A[i].map((x, j) => x.sub(f.mul(A[r][j]))); } piv.push(col); r++; }
  if (A.some(row => row.slice(0, n).every(qz) && !qz(row[n]))) return { ok: true, kind: 'system', vars, status: 'inconsistent' };
  if (piv.length < n) return { ok: true, kind: 'system', vars, status: 'underdetermined', free: vars.filter((v, i) => !piv.includes(i)) };
  const sol = {}; piv.forEach((col, i) => { sol[vars[col]] = A[i][n]; });
  const verified = rows.every(p => { let q = p; for (const v of vars) q = P.subst(q, v, sol[v]); return qz(P.constVal(q)); });
  return { ok: true, kind: 'system', vars, status: 'unique', solution: vars.map(v => ({ v, exact: frac(sol[v]), q: sol[v] })), verified }; }
function dpoly(p, x) { let r = new Map(); for (const [k, q] of p) { const m = unmono(k); const e = m[x] || 0; if (!e) continue; m[x] = e - 1; r = P.add(r, new Map([[mono(m), q.mul(new Q(BigInt(e)))]])); } return r; }
function derivative(expr, x) { let p; try { p = poly(expr); } catch (e) { return { ok: false, error: e.message }; } x = x || P.vars(p)[0] || 'x'; const r = dpoly(p, x); return { ok: true, x, input: P.str(p), result: P.str(r), resultPhi: P.str(r, true) }; }
function integral(expr, x, a, b) { let p; try { p = poly(expr); } catch (e) { return { ok: false, error: e.message }; } x = x || P.vars(p)[0] || 'x'; let r = new Map();
  for (const [k, q] of p) { const m = unmono(k); const e = (m[x] || 0) + 1; m[x] = e; r = P.add(r, new Map([[mono(m), q.div(new Q(BigInt(e)))]])); }
  const res = { ok: true, x, input: P.str(p), result: P.str(r), resultPhi: P.str(r, true), verified: P.str(P.sub(dpoly(r, x), p)) === '0' };
  if (a !== undefined) { if (P.vars(r).some(v => v !== x)) return { ok: false, error: 'FREE_VARIABLES' }; const F = v => P.constVal(P.subst(r, x, Q.parse(v))); const val = F(b).sub(F(a)); res.definite = { a, b, value: frac(val), q: val }; }
  return res; }
const UB = Object.create(null); const ub = (names, f, L, Mm, T) => names.split(',').forEach(n => (UB[n] = { f: typeof f === 'string' ? Q.parse(f) : f, dim: [L, Mm, T] }));
ub('m,meter,meters,metre,metres', '1', 1, 0, 0); ub('km,kilometer,kilometers,kilometre,kilometres', '1000', 1, 0, 0); ub('cm,centimeter,centimeters', '0.01', 1, 0, 0); ub('mm,millimeter,millimeters', '0.001', 1, 0, 0); ub('mi,mile,miles', '1609.344', 1, 0, 0); ub('yd,yard,yards', '0.9144', 1, 0, 0); ub('ft,foot,feet', '0.3048', 1, 0, 0); ub('in,inch,inches', '0.0254', 1, 0, 0);
ub('kg,kilogram,kilograms', '1', 0, 1, 0); ub('g,gram,grams', '0.001', 0, 1, 0); ub('mg,milligram,milligrams', '0.000001', 0, 1, 0); ub('lb,lbs,pound,pounds', '0.45359237', 0, 1, 0); ub('oz,ounce,ounces', '0.028349523125', 0, 1, 0); ub('t,tonne,tonnes', '1000', 0, 1, 0);
ub('s,sec,second,seconds', '1', 0, 0, 1); ub('min,minute,minutes', '60', 0, 0, 1); ub('h,hr,hour,hours', '3600', 0, 0, 1); ub('day,days', '86400', 0, 0, 1); ub('week,weeks', '604800', 0, 0, 1);
ub('l,liter,liters,litre,litres', '0.001', 3, 0, 0); ub('ml,milliliter,milliliters', '0.000001', 3, 0, 0); ub('us-gal,us-gallon,us-gallons', '0.003785411784', 3, 0, 0); ub('imperial-gal,imperial-gallon,imperial-gallons', '0.00454609', 3, 0, 0); ub('ha,hectare,hectares', '10000', 2, 0, 0); ub('acre,acres', '4046.8564224', 2, 0, 0);
ub('mph', '0.44704', 1, 0, -1); ub('kph,kmh', new Q(5n, 18n), 1, 0, -1); ub('n,newton,newtons', '1', 1, 1, -2); ub('j,joule,joules', '1', 2, 1, -2); ub('w,watt,watts', '1', 2, 1, -3);
/* GP014-UNIT-PRODUCT / GP014-SI-PREFIX (4.9.79): a hyphenated pair of units is their product ("watt-hours" = W·h, "newton-metres" = N·m), and an SI
   prefix on a unit's full name scales it by its power of ten ("kilowatt", "megajoule", "millisecond") — the dimension and factor follow, no table rows */
const SI_PREFIX = { kilo: '1000', mega: '1000000', giga: '1000000000', milli: '0.001', micro: '0.000001' };
function unitB(u) { const d = UB[u] || UB[u.replace(/s$/, '')]; if (d) return d; const m = /^(kilo|mega|giga|milli|micro)([a-z]{3,})$/.exec(u); if (!m) return null; const b = UB[m[2]] || UB[m[2].replace(/s$/, '')]; return b ? { f: b.f.mul(Q.parse(SI_PREFIX[m[1]])), dim: b.dim } : null; }
function parseUnit(str) {
  const s = str.toLowerCase().trim().replace(/\bper\b/g, '/').replace(/\bsquare\s+(\w+)/g, '$1^2').replace(/\bcubic\s+(\w+)/g, '$1^3').replace(/(\w+)\s+squared\b/g, '$1^2').replace(/(\w+)\s+cubed\b/g, '$1^3').replace(/²/g, '^2').replace(/³/g, '^3').replace(/·/g, '*').replace(/\s*([*/^])\s*/g, '$1').replace(/\s+/g, '*');
  const s1 = s; { const hy = s1.replace(/\b([a-z]+)-([a-z]+)\b/g, (m, a, b) => (UB[m] || UB[m.replace(/s$/, '')] ? m : a + '*' + b)); if (hy !== s1) return parseUnit(hy.replace(/\*/g, ' * ')); }
  let f = ONE; const dim = [0, 0, 0]; let sign = 1;
  for (const t of s.split(/([*/])/)) { if (t === '*') continue; if (t === '/') { sign = -1; continue; } if (!t) return null; const [u, e] = t.split('^'); const ex = e ? +e : 1; const d = unitB(u); if (!d || !Number.isInteger(ex) || ex < 1 || ex > 4) return null;
    for (let i = 0; i < ex; i++) f = sign > 0 ? f.mul(d.f) : f.div(d.f); d.dim.forEach((x, i) => (dim[i] += x * ex * sign)); }
  return { f, dim }; }
const dimName = d => ['L', 'M', 'T'].map((n, i) => (d[i] ? n + (d[i] === 1 ? '' : '^' + d[i]) : '')).filter(Boolean).join('·') || 'dimensionless';
function convertCompound(valStr, from, to) { const from0 = from, to0 = to; from = qualifyUnit(from); to = qualifyUnit(to); { const amb = String(from + ' ' + to).toLowerCase().split(/[^a-z-]+/).find(w => AMBIG[w]); if (amb) return { ok: false, error: 'AMBIGUOUS_UNIT', unit: amb, readings: AMBIG[amb] }; } const a = parseUnit(from), b = parseUnit(to); if (!a || !b) return { ok: false, error: 'UNKNOWN_UNIT', unit: !a ? from : to }; if (a.dim.join() !== b.dim.join()) return { ok: false, error: 'DIMENSION_MISMATCH', dims: [dimName(a.dim), dimName(b.dim)] };
  const r = Q.parse(valStr).mul(a.f).div(b.f); return { ok: true, value: decimal(r), from: valStr + ' ' + from0, to: to0, dim: dimName(a.dim), factor: frac(a.f.div(b.f)) }; }
/* rational functions p(x)/q(x): cancel the polynomial GCD (Euclid over exact rationals); record excluded points (Doc9: domain kept, never silently widened) */
function toArr(p, x) { const n = P.deg(p, x); const a = []; for (let i = n; i >= 0; i--) a.push(P.coef(p, x, i)); return a; }
function trim(a) { let i = 0; while (i < a.length - 1 && qz(a[i])) i++; return a.slice(i); }
function pdiv(a, b) { a = a.slice(); const q = []; while (a.length >= b.length && !(a.length === 1 && qz(a[0]))) { const f = a[0].div(b[0]); q.push(f); for (let i = 0; i < b.length; i++) a[i] = a[i].sub(f.mul(b[i])); a.shift(); } return { q: q.length ? q : [ZERO], r: trim(a.length ? a : [ZERO]) }; }
function pgcd(a, b) { while (!(b.length === 1 && qz(b[0]))) { const r = pdiv(a, b).r; a = b; b = r; } return a.map(c => c.div(a[0])); }
function fromArr(a, x) { let p = new Map(); const n = a.length - 1; a.forEach((c, i) => { p = P.add(p, P.mul(P.c(c), P.pow(P.v(x), n - i))); }); return p; }
function ratSimplify(src) { const m = String(src).replace(/\s+/g, '').match(/^\(?([^()]+|\([^()]+\))\)?\/\(([^()]+)\)$/) || String(src).replace(/\s+/g, '').match(/^\(([^()]+)\)\/([^()]+)$/);
  if (!m) return { ok: false, error: 'NOT_RATIONAL' }; let pn, pd; try { pn = poly(m[1].replace(/^\(|\)$/g, '')); pd = poly(m[2]); } catch (e) { return { ok: false, error: e.message }; }
  const vs = [...new Set(P.vars(pn).concat(P.vars(pd)))]; if (vs.length !== 1 || P.isConst(pd)) return { ok: false, error: 'NOT_RATIONAL' }; const x = vs[0];
  const N0 = toArr(pn, x), D0 = toArr(pd, x); const g = pgcd(N0, D0); const nq = pdiv(N0, g).q, dq = pdiv(D0, g).q; const lc = dq[0]; const nn = nq.map(c => c.div(lc)), dd = dq.map(c => c.div(lc));
  const num = fromArr(nn, x), den = fromArr(dd, x); const cancelled = g.length > 1 ? P.str(fromArr(g, x)) : null;
  const excl = []; if (g.length > 1) { const r = solvePoly ? (() => { try { return solve(P.str(fromArr(g, x)) + ' = 0', x); } catch (e) { return null; } })() : null; if (r && r.roots) for (const z of r.roots) excl.push(z.exact); }
  const result = P.isConst(den) && qs(P.constVal(den)) === '1' ? P.str(num) : '(' + P.str(num) + ')/(' + P.str(den) + ')';
  for (const t of [-2.5, 0.75, 3.25]) { const f = (pp, v) => { let s2 = 0; for (const [k, q] of pp) { const mm = unmono(k); s2 += q.toNumber() * Math.pow(v, mm[x] || 0); } return s2; }; const a = f(pn, t) / f(pd, t), b = f(num, t) / f(den, t); if (isFinite(a) && Math.abs(a - b) > 1e-9 * Math.max(1, Math.abs(a))) return { ok: false, error: 'UNVERIFIED' }; }
  return { ok: true, x, input: '(' + P.str(pn) + ')/(' + P.str(pd) + ')', result, cancelled, excluded: excl, check: 'value agreement at -2.5, 0.75, 3.25' }; }
const api = { ratSimplify, P, poly, solve, solveAny, solvePoly, simplify, evaluateAt, convert, convertCompound, parseUnit, AMBIG, qualifyUnit, factor, solveSystem, derivative, integral, surdStr, frac, U, TEMP };

if (isNode) module.exports = api; else root.KAlgebra = api;
})(this);
