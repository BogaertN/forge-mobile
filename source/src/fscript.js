/* fscript.js — ForgeScript: the declared safe subset user tools are written in. It is a small INTERPRETER (no eval, no Function, so it is
 * CSP-safe). It has no I/O: no DOM, network, storage, timers or globals, and nothing outside the whitelisted pure builtins. Steps, string
 * and array sizes are bounded. Grammar: let NAME = expr; · NAME = expr; · if (expr) { … } else { … } · return expr;
 * Expressions: numbers, 'strings', true/false/null, [lists], + - * / % **, == != < <= > >=, && || !, a ? b : c, x[i], x.length, builtin(args). */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const LIMIT = { steps: 200000, str: 100000, arr: 10000, code: 20000 };
const num = x => { if (typeof x !== 'number' || !isFinite(x)) throw new Error('FS-NUMBER'); return x; };
const arr = x => { if (!Array.isArray(x)) throw new Error('FS-LIST'); return x; };
const str = x => { if (typeof x !== 'string') throw new Error('FS-STRING'); return x; };
const BUILTINS = {
  abs: x => Math.abs(num(x)), sqrt: x => Math.sqrt(num(x)), pow: (a, b) => Math.pow(num(a), num(b)), floor: x => Math.floor(num(x)), ceil: x => Math.ceil(num(x)),
  round: (x, d) => { const k = Math.pow(10, d == null ? 0 : num(d)); return Math.round(num(x) * k) / k; }, log: x => Math.log(num(x)), exp: x => Math.exp(num(x)), sin: x => Math.sin(num(x)), cos: x => Math.cos(num(x)), tan: x => Math.tan(num(x)),
  min: (...a) => Math.min(...(a.length === 1 && Array.isArray(a[0]) ? a[0] : a).map(num)), max: (...a) => Math.max(...(a.length === 1 && Array.isArray(a[0]) ? a[0] : a).map(num)),
  sum: a => arr(a).reduce((s, x) => s + num(x), 0), mean: a => (arr(a).length ? BUILTINS.sum(a) / a.length : 0), sort: a => arr(a).slice().sort((x, y) => (typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0)),
  reverse: a => (Array.isArray(a) ? a.slice().reverse() : str(a).split('').reverse().join('')), unique: a => [...new Set(arr(a))], count: (a, x) => (Array.isArray(a) ? a.filter(y => y === x).length : str(a).split(str(x)).length - 1),
  range: (a, b) => { const lo = b == null ? 0 : num(a), hi = b == null ? num(a) : num(b); if (hi - lo > LIMIT.arr) throw new Error('FS-ARRAY-LIMIT'); const o = []; for (let i = lo; i < hi; i++) o.push(i); return o; },
  at: (a, i) => (Array.isArray(a) || typeof a === 'string' ? a[num(i) < 0 ? a.length + i : i] : null), len: x => (Array.isArray(x) || typeof x === 'string' ? x.length : 0),
  upper: s => str(s).toUpperCase(), lower: s => str(s).toLowerCase(), trim: s => str(s).trim(), split: (s, d) => str(s).split(d == null ? ' ' : str(d)).slice(0, LIMIT.arr), join: (a, d) => arr(a).map(String).join(d == null ? ' ' : str(d)),
  words: s => str(s).trim().split(/\s+/).filter(Boolean).slice(0, LIMIT.arr), slice: (x, a, b) => (Array.isArray(x) || typeof x === 'string' ? x.slice(num(a), b == null ? undefined : num(b)) : null), replace: (s, a, b) => str(s).split(str(a)).join(str(b)),
  contains: (x, y) => (Array.isArray(x) ? x.includes(y) : str(x).includes(str(y))), starts: (s, p) => str(s).startsWith(str(p)), ends: (s, p) => str(s).endsWith(str(p)),
  num: s => { const v = Number(String(s).trim()); return isFinite(v) ? v : null; }, text: x => (Array.isArray(x) ? x.map(String).join(', ') : String(x)), fixed: (x, d) => num(x).toFixed(Math.max(0, Math.min(10, num(d)))),
  pi: () => Math.PI, e: () => Math.E, isnum: x => typeof x === 'number' && isFinite(x) };
function tokenize(src) { if (typeof src !== 'string' || src.length > LIMIT.code) throw new Error('FS-CODE-SIZE'); const t = []; let i = 0;
  const re = /\s+|\/\/[^\n]*|(\d+(?:\.\d+)?(?:e[+-]?\d+)?)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|==|!=|<=|>=|&&|\|\||[-+*/%<>!?:;,=()[\]{}.])/y;
  while (i < src.length) { re.lastIndex = i; const m = re.exec(src); if (!m) throw new Error('FS-SYNTAX at ' + i); i = re.lastIndex; if (m[1]) t.push({ t: 'num', v: Number(m[1]) }); else if (m[2]) t.push({ t: 'str', v: m[2].slice(1, -1).replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c)) }); else if (m[3]) t.push({ t: 'id', v: m[3] }); else if (m[4]) t.push({ t: 'op', v: m[4] }); }
  t.push({ t: 'eof' }); return t; }
const KW = new Set(['let', 'return', 'if', 'else', 'true', 'false', 'null']);
function parse(src) { const T = tokenize(src); let p = 0; const peek = () => T[p], next = () => T[p++]; const is = (v) => T[p].t === 'op' && T[p].v === v; const isK = v => T[p].t === 'id' && T[p].v === v;
  const eat = v => { if (!is(v)) throw new Error('FS-SYNTAX expected ' + v); p++; };
  function block() { eat('{'); const b = []; while (!is('}')) { if (peek().t === 'eof') throw new Error('FS-SYNTAX unclosed block'); b.push(stmt()); } eat('}'); return b; }
  function stmt() { if (isK('let')) { p++; const n = next(); if (n.t !== 'id' || KW.has(n.v) || BUILTINS[n.v]) throw new Error('FS-SYNTAX bad name'); eat('='); const e = expr(); if (is(';')) p++; return { s: 'let', n: n.v, e }; }
    if (isK('return')) { p++; const e = expr(); if (is(';')) p++; return { s: 'ret', e }; }
    if (isK('if')) { p++; eat('('); const c = expr(); eat(')'); const a = block(); let b = []; if (isK('else')) { p++; b = isK('if') ? [stmt()] : block(); } return { s: 'if', c, a, b }; }
    if (peek().t === 'id' && T[p + 1].t === 'op' && T[p + 1].v === '=') { const n = next().v; p++; const e = expr(); if (is(';')) p++; return { s: 'set', n, e }; }
    throw new Error('FS-SYNTAX statement'); }
  function expr() { const c = bin(0); if (is('?')) { p++; const a = expr(); eat(':'); const b = expr(); return { k: '?', c, a, b }; } return c; }
  const PREC = [['||'], ['&&'], ['==', '!='], ['<', '<=', '>', '>='], ['+', '-'], ['*', '/', '%']];
  function bin(l) { if (l === PREC.length) return pow(); let a = bin(l + 1); while (peek().t === 'op' && PREC[l].includes(peek().v)) { const o = next().v; a = { k: 'bin', o, a, b: bin(l + 1) }; } return a; }
  function pow() { const a = unary(); if (is('**')) { p++; return { k: 'bin', o: '**', a, b: pow() }; } return a; }
  function unary() { if (is('!') || is('-')) { const o = next().v; return { k: 'un', o, a: unary() }; } return post(); }
  function post() { let a = prim(); for (;;) { if (is('[')) { p++; const i = expr(); eat(']'); a = { k: 'idx', a, i }; } else if (is('.')) { p++; const n = next(); if (n.t !== 'id' || n.v !== 'length') throw new Error('FS-PROPERTY-NOT-ALLOWED'); a = { k: 'len', a }; } else break; } return a; }
  function prim() { const x = next(); if (x.t === 'num') return { k: 'lit', v: x.v }; if (x.t === 'str') return { k: 'lit', v: x.v };
    if (x.t === 'op' && x.v === '(') { const e = expr(); eat(')'); return e; } if (x.t === 'op' && x.v === '[') { const items = []; while (!is(']')) { items.push(expr()); if (is(',')) p++; else break; } eat(']'); return { k: 'list', items }; }
    if (x.t === 'id') { if (x.v === 'true') return { k: 'lit', v: true }; if (x.v === 'false') return { k: 'lit', v: false }; if (x.v === 'null') return { k: 'lit', v: null };
      if (is('(')) { if (!Object.prototype.hasOwnProperty.call(BUILTINS, x.v)) throw new Error('FS-NOT-A-BUILTIN ' + x.v); p++; const args = []; while (!is(')')) { args.push(expr()); if (is(',')) p++; else break; } eat(')'); return { k: 'call', f: x.v, args }; }
      if (KW.has(x.v)) throw new Error('FS-SYNTAX keyword'); return { k: 'var', n: x.v }; }
    throw new Error('FS-SYNTAX unexpected token'); }
  const prog = []; while (peek().t !== 'eof') prog.push(stmt()); if (!prog.some(function has(s) { return s.s === 'ret' || (s.s === 'if' && (s.a.some(has) || s.b.some(has))); })) throw new Error('FS-NO-RETURN'); return prog; }
function run(src, input, lim) { const L = Object.assign({}, LIMIT, lim || {}); const prog = typeof src === 'string' ? parse(src) : src; let steps = 0; const env = new Map([['input', String(input == null ? '' : input)]]);
  const tick = () => { if (++steps > L.steps) throw new Error('FS-STEP-LIMIT'); }; const chk = v => { if (typeof v === 'string' && v.length > L.str) throw new Error('FS-STRING-LIMIT'); if (Array.isArray(v) && v.length > L.arr) throw new Error('FS-ARRAY-LIMIT'); return v; };
  function ev(e) { tick(); switch (e.k) { case 'lit': return e.v; case 'var': if (!env.has(e.n)) throw new Error('FS-UNDEFINED ' + e.n); return env.get(e.n); case 'list': return chk(e.items.map(ev));
    case 'len': { const v = ev(e.a); return Array.isArray(v) || typeof v === 'string' ? v.length : 0; } case 'idx': { const v = ev(e.a), i = ev(e.i); if ((Array.isArray(v) || typeof v === 'string') && typeof i === 'number') { const r = v[i]; return r === undefined ? null : r; } return null; }
    case '?': return ev(e.c) ? ev(e.a) : ev(e.b); case 'un': { const v = ev(e.a); return e.o === '!' ? !v : -num(v); }
    case 'bin': { if (e.o === '&&') return ev(e.a) && ev(e.b); if (e.o === '||') return ev(e.a) || ev(e.b); const a = ev(e.a), b = ev(e.b);
      switch (e.o) { case '+': return chk(typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : Array.isArray(a) && Array.isArray(b) ? a.concat(b) : num(a) + num(b)); case '-': return num(a) - num(b); case '*': return num(a) * num(b); case '/': return num(a) / num(b); case '%': return num(a) % num(b); case '**': return Math.pow(num(a), num(b));
        case '==': return JSON.stringify(a) === JSON.stringify(b); case '!=': return JSON.stringify(a) !== JSON.stringify(b); case '<': return a < b; case '<=': return a <= b; case '>': return a > b; case '>=': return a >= b; } }
    case 'call': return chk(BUILTINS[e.f](...e.args.map(ev))); }
    throw new Error('FS-EVAL'); }
  function exec(b) { for (const s of b) { tick(); if (s.s === 'let' || s.s === 'set') { if (s.s === 'set' && !env.has(s.n)) throw new Error('FS-UNDEFINED ' + s.n); if (s.n === 'input' && s.s === 'let') throw new Error('FS-REDEFINE-INPUT'); env.set(s.n, ev(s.e)); } else if (s.s === 'ret') return { r: ev(s.e) }; else if (s.s === 'if') { const o = exec(ev(s.c) ? s.a : s.b); if (o) return o; } } return null; }
  const o = exec(prog); const v = o ? o.r : null; if (v !== null && typeof v === 'object' && !Array.isArray(v)) throw new Error('FS-RESULT-TYPE'); return { value: v, steps }; }
const api = { parse, run, BUILTINS: Object.keys(BUILTINS), LIMIT };
if (isNode) module.exports = api; else root.KFScript = api;
})(typeof self !== 'undefined' ? self : this);
