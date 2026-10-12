/* Symbolic math used by the kernel. Every formula cites its source document.
 *   RMC Addendum (2026-09) §3 — newest operational definitions (preferred on conflict):
 *     ε_s = (σ_res + D_score + |ΔΦ|) / ρ ; σ_res = std-dev of phase history;
 *     D_score = 1.0 for Φ5→Φ8 else 0 ; |ΔΦ| = |actual − expected| / 9 ; ρ = max(1, depth)
 *     bands: <0.50 clean · 0.50–<0.78 elevated · 0.78–<0.80 intervention · ≥0.80 hard stop
 *   RSOC (Dec 2025) §2.2 SFE ψ=(Φ,ρ,Δ,ν,μ|ψ_id,τ,ε,λ,χ); §3.1 operators; §3.2 χ(t), Θ(t)
 *   RPMC Full Protocol §1.4 phase constants Φ1..Φ9; RPM(x,t)=Σ ΦMₙ·exp(−εₙ)+χ(t)·Θ
 *   RMC §5.7 Score(c)=αM+βP+γU+δN−λD (α=β=γ=δ=λ=1 in the RMC worked example)
 *   RMC §6.7 θ_echo_text = 0.85, θ_echo_memory = 0.97
 * Conflicts (documented, newest preferred): RSOC uses bands 0.40/0.80 and n=max(1,ρ+1);
 * RSOC phase names (Echo, Fracture, Grace@5, Naming@6 …) differ from RPMC/RMC; we use RPMC/RMC. */
(function (root) {
const TWO_PI = 2 * Math.PI;
const PHASES = {
  1: { sym: 'Φ₁', name: 'Initiation', role: 'input received; ψ_id fixed' },
  2: { sym: 'Φ₂', name: 'Polarity', role: 'negation / contrast / scope operators detected' },
  3: { sym: 'Φ₃', name: 'Desire', role: 'purpose and speech act recovered' },
  4: { sym: 'Φ₄', name: 'Friction', role: 'Verbal Cognition Gates + constraints' },
  5: { sym: 'Φ₅', name: 'Entropy', role: 'drift ε_s measured; only lawful collapse point' },
  6: { sym: 'Φ₆', name: 'Grace / Correction', role: 'χ(t) test; correction routing' },
  7: { sym: 'Φ₇', name: 'Naming', role: 'manifest compiled + ψ_id assigned' },
  8: { sym: 'Φ₈', name: 'Projection', role: 'render to controlled English' },
  9: { sym: 'Φ₉', name: 'Return', role: 'Echo Ê round-trip; memory write; loop closure' },
};
const FORBIDDEN = [[5, 8], [4, 8]]; // RMC Addendum §4 (Φ5→Φ8); RSOC Axiom 2 (4→8 "Luciferian ascent")
const BANDS = [
  { max: 0.50, name: 'clean' }, { max: 0.78, name: 'elevated' },
  { max: 0.80, name: 'intervention' }, { max: Infinity, name: 'hard_stop' }];

function std(xs) { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); }
const r4 = x => Math.round(x * 1e4) / 1e4;

/* Drift functional, RMC Addendum §3. phaseHistory = terminal phase index of recent turns
 * (normalised Φ/9 so σ_res ∈ [0,1] — normalisation is our inference; Addendum leaves it open). */
function driftFunctional({ phaseHistory, transition, depth }) {
  const sigma_res = std(phaseHistory.map(p => p / 9));
  const D_score = transition && FORBIDDEN.some(([a, b]) => transition.from === a && transition.to === b) ? 1.0 : 0.0;
  const dPhi = transition ? Math.abs(transition.to - transition.expected) / 9 : 0;
  const rho = Math.max(1, depth || 0);
  const eps = (sigma_res + D_score + dPhi) / rho;
  const band = BANDS.find(b => eps < b.max).name;
  return { eps_s: r4(eps), sigma_res: r4(sigma_res), D_score, dPhi: r4(dPhi), rho, band,
    formula: `ε_s = (σ_res + D_score + |ΔΦ|)/ρ = (${r4(sigma_res)} + ${D_score} + ${r4(dPhi)})/${rho} = ${r4(eps)}`,
    cite: 'RMC Implementation Addendum §3' };
}
/* Phase angle Φ ∈ [0,2π) for discrete index n (RSOC §2.2: "equivalently the discrete phase index 1–9") */
const phaseAngle = n => ((n - 1) / 9) * TWO_PI;

/* Θ(t) grace integral, RSOC §3.2.1: Θ = ∫ (1 − ε(s)/ε_max)·cos²(Φ(s) − Φ₁)·μ(s) ds  (discrete sum, ds = 1 step) */
function graceIntegral(tau, eps, mu, epsMax = 0.8) { // eps: number or per-step array ε(s)
  let th = 0;
  tau.forEach((n, i) => { const e = Array.isArray(eps) ? eps[i] : eps; const c = Math.max(0, 1 - Math.min(e, epsMax) / epsMax); th += c * Math.cos(phaseAngle(n) - phaseAngle(1)) ** 2 * mu; });
  return r4(th);
}
/* χ(t) invocation conditions, RSOC §3.2 (all four required) */
function chiConditions({ eps_s, echoTrace, chiFlag, dPhiAvg }) {
  const c = { 'ε_s ≥ 0.8': eps_s >= 0.8, 'Ê(τ) = 1': !!echoTrace, 'χ flag = 0': chiFlag === 0, '|ΔΦ_avg| ≤ π/3': dPhiAvg <= Math.PI / 3 };
  return { fire: Object.values(c).every(Boolean), conditions: c, cite: 'RSOC §3.2; RMC Addendum §4' };
}
/* χ(t) update, RSOC §3.2.1 / §4.2.2: Δ←0, ν←1.4, ε←ε(1−Θ/μ_total), μ←μ+0.9Θ, χ←1 */
function applyChi(sfe, Theta) {
  const muT = Math.max(sfe.mu, 1e-12);
  return Object.assign({}, sfe, { Delta: 0, nu: 1.4, eps: r4(sfe.eps * Math.max(0, 1 - Theta / muT)), mu: r4(sfe.mu + 0.9 * Theta), chi: 1 });
}
/* ⟁ Merge, RSOC §3.1.1 (δ ≤ π/4): μ′ = μ₁+μ₂+ζcos²δ, ε′=(ε₁+ε₂)/2 − 0.05cosδ, Δ′=(Δ₁+Δ₂)/2+0.1 sinδ */
function merge(a, b, zeta = 0.12) {
  const d = Math.abs(phaseAngle(a.Phi) - phaseAngle(b.Phi));
  if (d > Math.PI / 4 || a.chi !== b.chi) return { ok: false, cite: 'RSOC §3.1.1' };
  return { ok: true, cite: 'RSOC §3.1.1', sfe: Object.assign({}, a, {
    rho: Math.max(a.rho, b.rho), Delta: r4((a.Delta + b.Delta) / 2 + 0.1 * Math.sin(d)), nu: r4((a.nu + b.nu) / 2 + 0.3 * Math.cos(d)),
    mu: r4(a.mu + b.mu + zeta * Math.cos(d) ** 2), eps: r4(Math.max(0, (a.eps + b.eps) / 2 - 0.05 * Math.cos(d))),
    tau: a.tau.concat(b.tau).slice(-144), chi: a.chi | b.chi }) };
}
/* RPM weight of one memory node, RPMC Full Protocol §1: ΦMₙ·exp(−εₙ). Display only — never used to choose meaning. */
const rpmWeight = sfe => r4(sfe.mu * Math.exp(-sfe.eps));
/* Candidate coherence, RMC §5.7: Score(c) = αM + βP + γU + δN − λD */
function score(c, w = { a: 1, b: 1, g: 1, d: 1, l: 1 }) {
  const s = w.a * c.M + w.b * c.P + w.g * c.U + w.d * c.N - w.l * c.D;
  return { score: r4(s), formula: `Score = ${w.a}·${r4(c.M)} + ${w.b}·${r4(c.P)} + ${w.g}·${r4(c.U)} + ${w.d}·${r4(c.N)} − ${w.l}·${r4(c.D)} = ${r4(s)}`, cite: 'RMC §5.7' };
}
const THETA_ECHO = { text: 0.85, memory: 0.97, cite: 'RMC §6.7' };

/* ---------- GP-014 math lane: exact rational arithmetic, independently re-verified ---------- */
function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; }
class Q { constructor(n, d = 1n) { if (d === 0n) throw new Error('DIV0'); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; this.n = n / g; this.d = d / g; }
  static parse(s) { if (s.includes('.')) { const [i, f] = s.split('.'); return new Q(BigInt(i + f), 10n ** BigInt(f.length)); } return new Q(BigInt(s)); }
  add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); } sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Q(this.n * o.n, this.d * o.d); } div(o) { if (o.n === 0n) throw new Error('DIV0'); return new Q(this.n * o.d, this.d * o.n); }
  toNumber() { return Number(this.n) / Number(this.d); } toJSON() { return this.toString(); }
  toString() { if (this.d === 1n) return this.n.toString(); let d = this.d; while (d % 2n === 0n) d /= 2n; while (d % 5n === 0n) d /= 5n;
    if (d === 1n) { const x = this.toNumber(); return String(+x.toPrecision(15)); } return `${this.n}/${this.d}`; } }
function isqrt(n) { if (n < 0n) return null; if (n < 2n) return n; let x = BigInt(Math.floor(Math.sqrt(Number(n)))); while (x * x > n) x--; while ((x + 1n) * (x + 1n) <= n) x++; return x; }
function tokenizeExpr(s) {
  const t = []; const re = /\s*(\d+(?:\.\d+)?|sqrt|[-+*/^()])/y; let m; let i = 0;
  while (i < s.length) { re.lastIndex = i; m = re.exec(s); if (!m) { if (/\s/.test(s[i])) { i++; continue; } return null; } t.push(m[1]); i = re.lastIndex; }
  return t;
}
function parseExpr(tokens) { // recursive descent → AST
  let p = 0; const peek = () => tokens[p], next = () => tokens[p++];
  function prim() { const t = next(); if (t === undefined) throw new Error('INCOMPLETE');
    if (t === '(') { const e = add(); if (next() !== ')') throw new Error('PAREN'); return { op: 'group', a: e }; }
    if (t === '-') return { op: 'neg', a: unary() }; if (t === 'sqrt') return { op: 'sqrt', a: unary() };
    if (/^\d/.test(t)) return { op: 'num', v: t }; throw new Error('TOKEN ' + t); }
  function unary() { return prim(); }
  function pow() { let b = unary(); if (peek() === '^') { next(); return { op: '^', a: b, b: pow() }; } return b; }
  function mul() { let a = pow(); while (peek() === '*' || peek() === '/') { const o = next(); a = { op: o, a, b: pow() }; } return a; }
  function add() { let a = mul(); while (peek() === '+' || peek() === '-') { const o = next(); a = { op: o, a, b: mul() }; } return a; }
  const e = add(); if (p !== tokens.length) throw new Error('TRAILING'); return e;
}
function evalQ(e) { // exact; returns {q} or {approx:number, irrational:true}
  switch (e.op) {
    case 'num': return { q: Q.parse(e.v) }; case 'group': return evalQ(e.a);
    case 'neg': { const a = evalQ(e.a); return a.q ? { q: new Q(-a.q.n, a.q.d) } : { approx: -a.approx, irrational: true }; }
    case 'sqrt': { const a = evalQ(e.a); if (a.q) { if (a.q.n < 0n) throw new Error('SQRT_NEG'); const rn = isqrt(a.q.n), rd = isqrt(a.q.d); if (rn * rn === a.q.n && rd * rd === a.q.d) return { q: new Q(rn, rd) }; return { approx: Math.sqrt(a.q.toNumber()), irrational: true }; } return { approx: Math.sqrt(a.approx), irrational: true }; }
    default: { const a = evalQ(e.a), b = evalQ(e.b);
      if (a.q && b.q) { if (e.op === '+') return { q: a.q.add(b.q) }; if (e.op === '-') return { q: a.q.sub(b.q) }; if (e.op === '*') return { q: a.q.mul(b.q) }; if (e.op === '/') return { q: a.q.div(b.q) };
        if (e.op === '^') { if (b.q.d !== 1n || b.q.n > 64n || b.q.n < -64n) return { approx: Math.pow(a.q.toNumber(), b.q.toNumber()), irrational: true }; let r = new Q(1n); const k = b.q.n < 0n ? -b.q.n : b.q.n; for (let i = 0n; i < k; i++) r = r.mul(a.q); return { q: b.q.n < 0n ? new Q(1n).div(r) : r }; } }
      const x = a.q ? a.q.toNumber() : a.approx, y = b.q ? b.q.toNumber() : b.approx; if (e.op === '/' && y === 0) throw new Error('DIV0');
      return { approx: { '+': x + y, '-': x - y, '*': x * y, '/': x / y, '^': Math.pow(x, y) }[e.op], irrational: true }; } }
}
function evalF(e) { // independent float evaluator (verification path)
  switch (e.op) { case 'num': return parseFloat(e.v); case 'group': return evalF(e.a); case 'neg': return -evalF(e.a); case 'sqrt': return Math.sqrt(evalF(e.a));
    case '+': return evalF(e.a) + evalF(e.b); case '-': return evalF(e.a) - evalF(e.b); case '*': return evalF(e.a) * evalF(e.b); case '/': return evalF(e.a) / evalF(e.b); case '^': return Math.pow(evalF(e.a), evalF(e.b)); }
}
const OPSYM = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^' };
const PHASE_OPSYM = { '+': '+_Φ', '-': '−_Φ', '*': '×_Φ', '/': '÷_Φ', '^': '^' };
function pretty(e, sym = OPSYM) { switch (e.op) { case 'num': return e.v; case 'group': return '(' + pretty(e.a, sym) + ')'; case 'neg': return '−' + pretty(e.a, sym); case 'sqrt': return '√' + pretty(e.a, sym); default: return pretty(e.a, sym) + ' ' + sym[e.op] + ' ' + pretty(e.b, sym); } }
function computeExpr(src) {
  const toks = tokenizeExpr(src); if (!toks || !toks.length) return { ok: false, error: 'NOT_EXPRESSION' };
  let ast; try { ast = parseExpr(toks); } catch (e) { return { ok: false, error: 'PARSE:' + e.message }; }
  let r; try { r = evalQ(ast); } catch (e) { return { ok: false, error: e.message, ast, pretty: pretty(ast) }; }
  const f = evalF(ast); const v = r.q ? r.q.toNumber() : r.approx;
  const verified = Number.isFinite(f) && Math.abs(f - v) <= 1e-9 * Math.max(1, Math.abs(f));
  const exact = !!r.q; const value = exact ? r.q.toString() : String(+v.toFixed(6));
  return { ok: verified, exact, value, approx: !exact, ast, pretty: pretty(ast), phaseForm: pretty(ast, PHASE_OPSYM), verify: { rational: exact ? r.q.toString() : null, float: f, agree: verified }, cite: 'GP-014 math lane; RPMC O_phase {+_Φ,−_Φ,×_Φ,÷_Φ}' };
}
const api = { Q, PHASES, FORBIDDEN, BANDS, driftFunctional, graceIntegral, chiConditions, applyChi, merge, rpmWeight, score, THETA_ECHO, computeExpr, phaseAngle, r4 };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KMath = api;
})(this);
