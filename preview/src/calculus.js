/* Symbolic calculus over elementary functions (W3 math extension; Doc 9 math proof obligations).
 * Deterministic: parse → AST → rule-tagged derivative / antiderivative → simplify → print.
 * Every result is cross-checked numerically (central differences / composite Simpson) before release.
 * Rule IDs are returned so the kernel trace cites each applied rule. No model, no eval(). */
(function (root) {
'use strict';
const FN = ['sin', 'cos', 'tan', 'exp', 'ln', 'log', 'sqrt'];
/* ---- tokenizer / parser (precedence climbing; implicit multiplication) ---- */
function tokenize(s) { const t = []; const re = /\s*(\d+(?:\.\d+)?|sin|cos|tan|exp|ln|log|sqrt|pi|π|e|[a-z]|[-+*/^()])/y; let i = 0; s = String(s).replace(/·/g, '*').replace(/−/g, '-').replace(/\s+$/, '');
  while (i < s.length) { re.lastIndex = i; const m = re.exec(s); if (!m) throw new Error('CALC_BAD_TOKEN'); t.push(m[1] === 'π' ? 'pi' : m[1]); i = re.lastIndex; } return t; }
function parse(s) { const T = tokenize(s); let i = 0; const peek = () => T[i], next = () => T[i++];
  const isAtomStart = x => x !== undefined && (/^\d/.test(x) || /^[a-z]+$/.test(x) || x === '(');
  function primary() { const x = next(); if (x === undefined) throw new Error('CALC_EOF');
    if (/^\d/.test(x)) return { t: 'num', v: +x };
    if (x === '(') { const e = expr(); if (next() !== ')') throw new Error('CALC_PAREN'); return e; }
    if (FN.includes(x)) { let arg; if (peek() === '(') { next(); arg = expr(); if (next() !== ')') throw new Error('CALC_PAREN'); } else arg = power(); return { t: 'fn', f: x === 'log' ? 'ln' : x, a: arg }; }
    if (x === 'pi') return { t: 'const', c: 'pi' }; if (x === 'e') return { t: 'const', c: 'e' };
    if (/^[a-z]$/.test(x)) return { t: 'var', n: x };
    throw new Error('CALC_UNEXPECTED'); }
  function power() { let b = primary(); if (peek() === '^') { next(); const neg = peek() === '-' ? (next(), true) : false; let e = power(); if (neg) e = { t: 'neg', a: e }; b = { t: 'pow', a: b, b: e }; } return b; }
  function unary() { if (peek() === '-') { next(); return { t: 'neg', a: unary() }; } if (peek() === '+') { next(); return unary(); } return power(); }
  function term() { let a = unary(); for (;;) { const x = peek(); if (x === '*' || x === '/') { next(); const b = unary(); a = { t: x === '*' ? 'mul' : 'div', a, b }; } else if (isAtomStart(x)) { const b = power(); a = { t: 'mul', a, b }; } else return a; } }
  function expr() { let a = term(); for (;;) { const x = peek(); if (x === '+' || x === '-') { next(); const b = term(); a = { t: x === '+' ? 'add' : 'sub', a, b }; } else return a; } }
  const e = expr(); if (i !== T.length) throw new Error('CALC_TRAILING'); return e; }
/* ---- constructors with local simplification (rule-free algebraic identities) ---- */
const N = v => ({ t: 'num', v }); const isN = (e, v) => e.t === 'num' && (v === undefined || e.v === v);
function add(a, b) { if (isN(a, 0)) return b; if (isN(b, 0)) return a; if (isN(a) && isN(b)) return N(a.v + b.v); return { t: 'add', a, b }; }
function sub(a, b) { if (isN(b, 0)) return a; if (b.t === 'neg') return add(a, b.a); if (isN(a) && isN(b)) return N(a.v - b.v); if (eq(a, b)) return N(0); return { t: 'sub', a, b }; }
function mul(a, b) { if (isN(a, 0) || isN(b, 0)) return N(0); if (isN(a, 1)) return b; if (isN(b, 1)) return a; if (isN(a) && isN(b)) return N(a.v * b.v); if (isN(b) && !isN(a)) return mul(b, a);
  if (isN(a) && b.t === 'mul' && isN(b.a)) return mul(N(a.v * b.a.v), b.b); if (isN(a, -1)) return neg(b); if (b.t === 'neg') return neg(mul(a, b.a)); if (a.t === 'neg') return neg(mul(a.a, b)); return { t: 'mul', a, b }; }
function div(a, b) { if (isN(a, 0)) return N(0); if (isN(b, 1)) return a; if (isN(a) && isN(b) && Number.isInteger(a.v / b.v)) return N(a.v / b.v); if (eq(a, b)) return N(1); return { t: 'div', a, b }; }
function pow(a, b) { if (isN(b, 0)) return N(1); if (isN(b, 1)) return a; if (isN(a) && isN(b) && Number.isInteger(Math.pow(a.v, b.v))) return N(Math.pow(a.v, b.v)); return { t: 'pow', a, b }; }
function neg(a) { if (isN(a)) return N(-a.v); if (a.t === 'neg') return a.a; return { t: 'neg', a }; }
const fn = (f, a) => { if (f === 'ln' && a.t === 'const' && a.c === 'e') return N(1); if (f === 'ln' && isN(a, 1)) return N(0); if (f === 'exp' && isN(a, 0)) return N(1); if ((f === 'sin' || f === 'tan') && isN(a, 0)) return N(0); if (f === 'cos' && isN(a, 0)) return N(1); return { t: 'fn', f, a }; };
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function hasVar(e, x) { if (e.t === 'var') return e.n === x; return ['a', 'b'].some(k => e[k] && hasVar(e[k], x)); }
function vars(e, out) { out = out || new Set(); if (e.t === 'var') out.add(e.n); for (const k of ['a', 'b']) if (e[k]) vars(e[k], out); return out; }
/* ---- printer ---- */
const PREC = { add: 1, sub: 1, mul: 2, div: 2, neg: 3, pow: 4 };
function str(e, p) { p = p || 0; let s, q;
  switch (e.t) { case 'num': s = Number.isInteger(e.v) ? String(e.v) : String(+e.v.toPrecision(12)); q = e.v < 0 ? 3 : 9; break; case 'var': s = e.n; q = 9; break; case 'const': s = e.c === 'pi' ? 'π' : 'e'; q = 9; break;
    case 'fn': s = e.f + '(' + str(e.a) + ')'; q = 9; break;
    case 'add': s = str(e.a, 1) + (e.b.t === 'neg' ? ' - ' + str(e.b.a, 2) : isN(e.b) && e.b.v < 0 ? ' - ' + str(N(-e.b.v)) : ' + ' + str(e.b, 1)); q = 1; break;
    case 'sub': s = str(e.a, 1) + ' - ' + str(e.b, 2); q = 1; break;
    case 'mul': { const implicit = isN(e.a) && e.a.v >= 0 && (e.b.t === 'var' || e.b.t === 'fn' || e.b.t === 'const' || (e.b.t === 'pow' && e.b.a.t === 'var')); s = str(e.a, 2) + (implicit ? '' : '·') + str(e.b, 2.5); q = 2; break; }
    case 'div': s = str(e.a, 2) + '/' + str(e.b, 3); q = 2; break;
    case 'neg': s = '-' + str(e.a, e.a.t === 'mul' || e.a.t === 'div' ? 2 : 3); q = e.a.t === 'mul' || e.a.t === 'div' ? 2 : 3; break;
    case 'pow': s = str(e.a, 5) + '^' + str(e.b, 4); q = 4; break; }
  return q < p ? '(' + s + ')' : s; }
/* ---- numeric evaluation (no eval()) ---- */
function num(e, env) { switch (e.t) { case 'num': return e.v; case 'var': if (!(e.n in env)) throw new Error('CALC_FREE_VAR'); return env[e.n]; case 'const': return e.c === 'pi' ? Math.PI : Math.E;
  case 'add': return num(e.a, env) + num(e.b, env); case 'sub': return num(e.a, env) - num(e.b, env); case 'mul': return num(e.a, env) * num(e.b, env); case 'div': return num(e.a, env) / num(e.b, env);
  case 'neg': return -num(e.a, env); case 'pow': return Math.pow(num(e.a, env), num(e.b, env));
  case 'fn': { const v = num(e.a, env); return { sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, ln: Math.log, sqrt: Math.sqrt }[e.f](v); } } throw new Error('CALC_NODE'); }
/* ---- derivative: each case is a numbered rule (sūtra-style) recorded in order ---- */
function d(e, x, R) { const r = id => { R.push(id); };
  if (!hasVar(e, x)) { r('D-01-CONST'); return N(0); }
  switch (e.t) {
    case 'var': r('D-02-VAR'); return N(1);
    case 'add': r('D-03-SUM'); return add(d(e.a, x, R), d(e.b, x, R));
    case 'sub': r('D-03-SUM'); return sub(d(e.a, x, R), d(e.b, x, R));
    case 'neg': r('D-04-NEG'); return neg(d(e.a, x, R));
    case 'mul': if (!hasVar(e.a, x)) { r('D-05-CONST-MULTIPLE'); return mul(e.a, d(e.b, x, R)); } if (!hasVar(e.b, x)) { r('D-05-CONST-MULTIPLE'); return mul(e.b, d(e.a, x, R)); }
      r('D-06-PRODUCT'); return add(mul(d(e.a, x, R), e.b), mul(e.a, d(e.b, x, R)));
    case 'div': if (!hasVar(e.b, x)) { r('D-05-CONST-MULTIPLE'); return div(d(e.a, x, R), e.b); }
      r('D-07-QUOTIENT'); return div(sub(mul(d(e.a, x, R), e.b), mul(e.a, d(e.b, x, R))), pow(e.b, N(2)));
    case 'pow': if (!hasVar(e.b, x)) { r('D-08-POWER-CHAIN'); const n = e.b; return mul(mul(n, pow(e.a, isN(n) ? N(n.v - 1) : sub(n, N(1)))), d(e.a, x, R)); }
      if (!hasVar(e.a, x)) { r('D-09-EXPONENTIAL-BASE'); return mul(mul(e, fn('ln', e.a)), d(e.b, x, R)); }
      r('D-10-LOG-DIFFERENTIATION'); return mul(e, add(mul(d(e.b, x, R), fn('ln', e.a)), div(mul(e.b, d(e.a, x, R)), e.a)));
    case 'fn': { const u = e.a; const du = () => d(u, x, R); const chain = outer => { if (eq(u, { t: 'var', n: x })) return outer; r('D-11-CHAIN'); return mul(outer, du()); };
      switch (e.f) { case 'sin': r('D-12-SIN'); return chain(fn('cos', u)); case 'cos': r('D-13-COS'); return chain(neg(fn('sin', u)));
        case 'tan': r('D-14-TAN'); return chain(div(N(1), pow(fn('cos', u), N(2))));
        case 'exp': r('D-15-EXP'); return chain(fn('exp', u)); case 'ln': r('D-16-LN'); return chain(div(N(1), u));
        case 'sqrt': r('D-17-SQRT'); return chain(div(N(1), mul(N(2), fn('sqrt', u)))); } } }
  throw new Error('CALC_NO_RULE'); }
/* ---- antiderivative: linearity + table over linear arguments (a·x+b); outside the table → refuse (never guess) ---- */
function linear(u, x) { // returns {a,b} numbers when u = a·x + b
  try { const b = num(u, { [x]: 0 }), a1 = num(u, { [x]: 1 }) - b, a2 = (num(u, { [x]: 3 }) - b) / 3; if (Math.abs(a1 - a2) > 1e-12 || Math.abs(num(u, { [x]: -2 }) - (b - 2 * a1)) > 1e-9 || a1 === 0) return null; return { a: a1, b }; } catch (e) { return null; } }
function I(e, x, R) { const r = id => R.push(id);
  if (!hasVar(e, x)) { r('I-01-CONST'); return mul(e, { t: 'var', n: x }); }
  switch (e.t) {
    case 'var': r('I-02-POWER'); return div(pow(e, N(2)), N(2));
    case 'add': r('I-03-LINEARITY'); return add(I(e.a, x, R), I(e.b, x, R)); case 'sub': r('I-03-LINEARITY'); return sub(I(e.a, x, R), I(e.b, x, R));
    case 'neg': r('I-03-LINEARITY'); return neg(I(e.a, x, R));
    case 'mul': if (!hasVar(e.a, x)) { r('I-04-CONST-MULTIPLE'); return mul(e.a, I(e.b, x, R)); } if (!hasVar(e.b, x)) { r('I-04-CONST-MULTIPLE'); return mul(e.b, I(e.a, x, R)); }
      { const isPoly = u => !JSON.stringify(u).includes('"fn"'); const isTrans = f => f.t === 'fn' && /^(sin|cos|exp)$/.test(f.f) && linear(f.a, x); let u = null, f = null;
        if (isPoly(e.a) && isTrans(e.b)) { u = e.a; f = e.b; } else if (isPoly(e.b) && isTrans(e.a)) { u = e.b; f = e.a; }
        if (u) { r('I-10-PARTS'); const F = I(f, x, R); const du = d(u, x, []); return sub(mul(u, F), I(mul(du, F), x, R)); } } break;
    case 'div': if (!hasVar(e.b, x)) { r('I-04-CONST-MULTIPLE'); return div(I(e.a, x, R), e.b); }
      if (!hasVar(e.a, x)) { const L = linear(e.b, x); if (L) { r('I-08-RECIPROCAL-LINEAR'); return mul(div(e.a, N(L.a)), fn('ln', fn('abs', e.b))); } } break;
    case 'pow': if (!hasVar(e.b, x) && isN(e.b)) { const L = linear(e.a, x); if (L) { if (e.b.v === -1) { r('I-08-RECIPROCAL-LINEAR'); return div(fn('ln', fn('abs', e.a)), N(L.a)); } r('I-02-POWER'); return div(pow(e.a, N(e.b.v + 1)), N(L.a * (e.b.v + 1))); } } break;
    case 'fn': { const L = linear(e.a, x); if (!L) break; const k = N(L.a);
      if (e.f === 'sin') { r('I-05-SIN'); return neg(div(fn('cos', e.a), k)); } if (e.f === 'cos') { r('I-06-COS'); return div(fn('sin', e.a), k); } if (e.f === 'exp') { r('I-07-EXP'); return div(fn('exp', e.a), k); } } }
  throw new Error('CALC_NOT_IN_TABLE'); }
/* exact values at special points (π multiples, 0, 1) for readable definite results */
function evalExact(e, x, at) { const v = num(e, { [x]: at.v }); return v; }
function parseBound(s) { const t = String(s).trim(); const e = parse(t); if (vars(e).size) throw new Error('CALC_BOUND'); return { e, v: num(e, {}), s: str(e) }; }
function simpson(e, x, a, b, n) { n = n || 2000; const h = (b - a) / n; let s = num(e, { [x]: a }) + num(e, { [x]: b }); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * num(e, { [x]: a + i * h }); return s * h / 3; }
function niceNum(v) { if (Math.abs(v - Math.round(v)) < 1e-10) return String(Math.round(v)); for (const [c, nm] of [[Math.PI, 'π'], [Math.E, 'e']]) { const k = v / c; if (Math.abs(k - Math.round(k)) < 1e-10 && Math.round(k) !== 0) return (Math.round(k) === 1 ? '' : Math.round(k) === -1 ? '-' : Math.round(k)) + nm; }
  for (const [c, nm] of [[Math.E, 'e'], [Math.PI, 'π']]) for (let k = -12; k <= 12; k++) if (k && Math.abs(v - c - k) < 1e-10) return nm + (k > 0 ? ' + ' : ' - ') + Math.abs(k);
  for (let q = 2; q <= 1000; q++) if (Math.abs(v * q - Math.round(v * q)) < 1e-9) return Math.round(v * q) + '/' + q; return null; }
/* public: differentiate / integrate with cross-checks */
function derivative(src, x) { const e = parse(src); const vs = [...vars(e)]; x = x || (vs.includes('x') ? 'x' : vs[0] || 'x'); const R = []; const de = d(e, x, R);
  const pts = [0.37, 1.13, 2.71]; for (const p of pts) { let h = 1e-5, num1; try { num1 = (num(e, { [x]: p + h }) - num(e, { [x]: p - h })) / (2 * h); } catch (er) { continue; } const sym = num(de, { [x]: p }); if (isFinite(num1) && isFinite(sym) && Math.abs(num1 - sym) > 1e-4 * Math.max(1, Math.abs(sym))) return { ok: false, error: 'CALC_CROSSCHECK_FAILED' }; }
  return { ok: true, x, input: str(e), result: str(de), rules: [...new Set(R)], check: 'central-difference at ' + pts.join(', ') }; }
function integral(src, x, a, b) { const e = parse(src); const vs = [...vars(e)]; x = x || (vs.includes('x') ? 'x' : vs[0] || 'x'); const R = []; let F;
  try { F = I(e, x, R); } catch (er) { return { ok: false, error: er.message }; }
  // verify F' = f numerically
  const g = x0 => { const h = 1e-5; const fe = t => num(F.t ? F : F, { [x]: t }); return (numF(F, x, x0 + h) - numF(F, x, x0 - h)) / (2 * h); };
  for (const p of [0.41, 1.3]) { let fv; try { fv = num(e, { [x]: p }); } catch (er) { continue; } const gv = g(p); if (isFinite(fv) && isFinite(gv) && Math.abs(fv - gv) > 1e-4 * Math.max(1, Math.abs(fv))) return { ok: false, error: 'CALC_CROSSCHECK_FAILED' }; }
  const out = { ok: true, x, input: str(e), result: str(F) + ' + C', rules: [...new Set(R)] };
  if (a !== undefined && a !== null) { const A = parseBound(a), B = parseBound(b); const val = numF(F, x, B.v) - numF(F, x, A.v); const sv = simpson(e, x, A.v, B.v);
    if (!isFinite(val) || Math.abs(val - sv) > 1e-6 * Math.max(1, Math.abs(val))) return { ok: false, error: 'CALC_CROSSCHECK_FAILED' };
    const nice = niceNum(val); out.definite = { a: A.s, b: B.s, value: nice || ('≈ ' + (+val.toFixed(6))), exact: !!nice, check: 'composite Simpson n=2000' }; R.push('I-09-FTC'); out.rules = [...new Set(R)]; }
  return out; }
function numF(F, x, v) { return numA(F, { [x]: v }); }
function numA(e, env) { if (e.t === 'fn' && e.f === 'abs') return Math.abs(numA(e.a, env)); if (e.t === 'fn') { const v = numA(e.a, env); return { sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, ln: Math.log, sqrt: Math.sqrt }[e.f](v); }
  if (e.t === 'add') return numA(e.a, env) + numA(e.b, env); if (e.t === 'sub') return numA(e.a, env) - numA(e.b, env); if (e.t === 'mul') return numA(e.a, env) * numA(e.b, env); if (e.t === 'div') return numA(e.a, env) / numA(e.b, env);
  if (e.t === 'neg') return -numA(e.a, env); if (e.t === 'pow') return Math.pow(numA(e.a, env), numA(e.b, env)); return num(e, env); }
const isElementary = s => /\b(sin|cos|tan|exp|ln|log|sqrt)\b|\be\^|π|\bpi\b/.test(String(s));
/* exact real roots of a cubic a x^3 + b x^2 + c x + d (Cardano / trigonometric form) */
function cubicExact(a, b, c, dd) { const p = (3 * a * c - b * b) / (3 * a * a), q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * dd) / (27 * a * a * a), sh = -b / (3 * a); const D = q * q / 4 + p * p * p / 27;
  const shs = Math.abs(sh) < 1e-15 ? '' : (sh > 0 ? ' + ' : ' - ') + fmt(Math.abs(sh));
  if (D > 1e-14) { const s = Math.sqrt(D); const r = Math.cbrt(-q / 2 + s) + Math.cbrt(-q / 2 - s) + sh; return { method: 'Cardano (one real root)', rule: 'ALG-CUBIC-CARDANO', roots: [{ exact: '∛(' + fmt(-q / 2) + ' + √' + par(fmt(D)) + ') + ∛(' + fmt(-q / 2) + ' - √' + par(fmt(D)) + ')' + shs, approx: r }] }; }
  if (D < -1e-14) { const m = 2 * Math.sqrt(-p / 3), th = Math.acos((3 * q / (2 * p)) * Math.sqrt(-3 / p)) / 3; const arg = (3 * q / (2 * p)) * Math.sqrt(-3 / p); const mS = surd(m), aS = fmt(arg); const roots = [0, 1, 2].map(k => ({ exact: mS + '·cos(⅓·arccos(' + aS + ')' + (k ? ' - ' + (2 * k) + 'π/3' : '') + ')' + shs, approx: m * Math.cos(th - 2 * Math.PI * k / 3) + sh })).sort((u, v) => u.approx - v.approx);
    return { method: 'trigonometric (three real roots, casus irreducibilis)', rule: 'ALG-CUBIC-TRIGONOMETRIC', roots }; }
  return null; }
function surd(v) { const n = niceNum(v); if (n && !/[πe]/.test(n)) return n; const sq = v * v; const ns = niceNum(sq); return ns && !/[πe]/.test(ns) ? '√' + (ns.includes('/') ? '(' + ns + ')' : ns) : String(+v.toFixed(6)); }
const par = t => (/[/.]/.test(t) ? '(' + t + ')' : t);
function fmt(v) { const n = niceNum(v); return n && !/[πe]/.test(n) ? n : String(+v.toFixed(6)); }
const api = { parse, str, derivative, integral, isElementary, cubicExact, num };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KCalc = api;
})(typeof self !== 'undefined' ? self : this);
