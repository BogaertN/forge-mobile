/* Symbolic math used by the kernel. Every formula cites its source document.
 *   RMC Addendum (2026-09) §3 — newest operational definitions (preferred on conflict):
 *     ε_s = (σ_res + D_score + |ΔΦ|) / ρ ; σ_res = circular deviation of phase history (4.9.67 ruling 2);
 *     D_score = 1.0 for Φ5→Φ8 else 0 ; |ΔΦ| = |actual − expected| / 9 ; ρ = max(1, depth)
 *     bands: the Addendum's 0.50/0.78/0.80 bands are SUPERSEDED (4.9.66 K1) by Nic's drift ruling — see DRIFT_TABLE below
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
/* K1 (4.9.66): THE one drift threshold table. Every path (turn governance, containment, learned objects, MEA, EDE, hypotheses) reads it,
   through driftBand() / driftGovernance(). Nic's ruling (2026-10-14, reaffirmed 2026-10-18):
     ε_s ≤ 0.35        → 'clean'     / projectable : may be projected or approved; the only band in which memory may be written
     0.35 < ε_s < 0.40 → 'correct'   / correct     : needs correction (the χ correction step); never written this turn
     0.40 ≤ ε_s ≤ 0.80 → 'elevated'  / explore     : quarantine-only exploration (drift archive); never written, never projected
     ε_s > 0.80        → 'hard_stop' / reject      : hard stop (Ĉ archival unless χ lawfully fires)
   'turn' is the name the turn trace carries, 'gov' the name learned objects carry; same rows, same edges.
   A forbidden phase transition (FORBIDDEN) is a SEPARATE yes/no gate — it blocks at any ε_s (see forbiddenTransition()).
   0.72 (forge coherence_math) is a reference value only (drift_export.js); it is not a gate. */
const DRIFT_RULING = Object.freeze({ project_max: 0.35, explore_min: 0.4, explore_max: 0.8, cite: 'Nic ruling 2026-10-14 (RMC §8.3 θ; RSOC 0.4–0.8 novelty band)' });
const DRIFT_TABLE = Object.freeze([
  Object.freeze({ turn: 'clean', gov: 'projectable', test: e => e <= DRIFT_RULING.project_max, may_project: true, may_write_memory: true, quarantine: false }),
  Object.freeze({ turn: 'correct', gov: 'correct', test: e => e < DRIFT_RULING.explore_min, may_project: false, may_write_memory: false, quarantine: true, correction: true }),
  Object.freeze({ turn: 'elevated', gov: 'explore', test: e => e <= DRIFT_RULING.explore_max, may_project: false, may_write_memory: false, quarantine: true, explore: true }),
  Object.freeze({ turn: 'hard_stop', gov: 'reject', test: () => true, may_project: false, may_write_memory: false, quarantine: true, hard_stop: true })]);
const driftRow = eps => DRIFT_TABLE.find(r => r.test(eps));
const BANDS = DRIFT_TABLE; /* back-compat export name */
/* 4.9.67 ruling 1 (Nic): committed meanings move FORWARD only (RPMC; 9→1 is the lawful closure step, not a step back). A Φ−1 step back is
   allowed only inside quarantine exploration (MEA / drift archive; never touches memory) — t.quarantine marks such a path. */
const phaseNext = n => (n % 9) + 1, phasePrev = n => ((n + 7) % 9) + 1;
const isBackward = t => !!(t && t.to !== t.from && t.to !== phaseNext(t.from) && ((t.from - t.to + 9) % 9) < ((t.to - t.from + 9) % 9));
function phaseStep(t) { if (!t) return { ok: false, why: 'no transition' }; if (FORBIDDEN.some(([a, b]) => t.from === a && t.to === b)) return { ok: false, why: 'forbidden Φ' + t.from + '→Φ' + t.to };
  if (isBackward(t)) return t.quarantine && t.to === phasePrev(t.from) ? { ok: true, why: 'Φ−1 step back inside quarantine exploration (never touches memory)', quarantine_only: true } : { ok: false, why: 'backward Φ' + t.from + '→Φ' + t.to + (t.quarantine ? ' (only a single Φ−1 step is allowed in quarantine)' : ' on a committed path (forward only)') };
  /* 4.9.71 ruling 3 (Nic): a committed meaning may not skip over the Φ5 collapse, Φ6 χ or Φ7 naming gate when that gate applies to it (t.gates
     lists the applying gate phases); every other forward skip stays lawful */
  if (t.to !== phaseNext(t.from) && !t.quarantine && Array.isArray(t.gates)) { const over = []; for (let k = phaseNext(t.from); k !== t.to; k = phaseNext(k)) over.push(k);
    const hit = over.filter(k => GATE_PHASES[k] && t.gates.includes(k)); if (hit.length) return { ok: false, why: 'forward skip Φ' + t.from + '→Φ' + t.to + ' passes over the ' + hit.map(k => 'Φ' + k + ' ' + GATE_PHASES[k]).join(', ') + ' gate (committed meaning)' }; }
  return { ok: true, why: t.to === phaseNext(t.from) ? 'lawful successor' : 'forward' }; }
const GATE_PHASES = Object.freeze({ 5: 'collapse', 6: 'χ', 7: 'naming' });
const isForbidden = t => !!t && !phaseStep(t).ok;
/* the phase law over a whole trail (consecutive repeats are one phase): every step must be lawful under phaseStep */
function phaseLaw(trail, o) { const t = (trail || []).filter((n, i, a) => i === 0 || n !== a[i - 1]), v = []; for (let i = 1; i < t.length; i++) { const r = phaseStep({ from: t[i - 1], to: t[i], quarantine: !!(o && o.quarantine), gates: o && o.gates }); if (!r.ok) v.push('Φ' + t[i - 1] + '→Φ' + t[i] + ': ' + r.why); } return { ok: !v.length, violations: v, trail: t.join(''), rule: 'forward only (RPMC); Φ−1 only in quarantine (4.9.67 ruling 1); no skip over an applying Φ5/Φ6/Φ7 gate (4.9.71 ruling 3)', gates: (o && o.gates) || [] }; }

/* 4.9.67 ruling 2 (Nic): σ_res is a CIRCULAR statistic — Φ9 is adjacent to Φ1. Mardia's angular deviation √(2(1−R̄)) over the phase angles
   θ = 2π(Φ−1)/9, divided by 2π so that for a tight cluster it equals the old linear std of Φ/9 (same scale, same thresholds); R̄ = mean resultant length. */
function circStd(phases) { if (phases.length < 2) return 0; let c = 0, si = 0; for (const p of phases) { const th = ((p - 1) / 9) * 2 * Math.PI; c += Math.cos(th); si += Math.sin(th); }
  const R = Math.min(1, Math.sqrt(c * c + si * si) / phases.length); return Math.sqrt(Math.max(0, 2 * (1 - R))) / (2 * Math.PI); }
function std(xs) { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); }
const r4 = x => Math.round(x * 1e4) / 1e4;

/* Drift functional, RMC Addendum §3. phaseHistory = terminal phase index of recent turns
 * (σ_res circular since 4.9.67: Mardia angular deviation / 2π, Φ9 adjacent to Φ1; equals the linear std of Φ/9 for tight clusters). */
function driftFunctional({ phaseHistory, transition, depth }) {
  const sigma_res = circStd(phaseHistory);
  const D_score = isForbidden(transition) ? 1.0 : 0.0;
  const dPhi = transition ? Math.abs(transition.to - transition.expected) / 9 : 0;
  const rho = Math.max(1, depth || 0);
  const eps = (sigma_res + D_score + dPhi) / rho;
  const band = driftRow(eps).turn;
  return { eps_s: r4(eps), sigma_res: r4(sigma_res), D_score, dPhi: r4(dPhi), rho, band, forbidden_transition: D_score === 1,
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
function chiConditions({ eps_s, echoTrace, chiFlag, dPhiAvg, forbidden }) {
  const c = { 'ε_s > 0.80 (hard stop) or forbidden transition': !!driftRow(eps_s).hard_stop || !!forbidden, 'Ê(τ) = 1': !!echoTrace, 'χ flag = 0': chiFlag === 0, '|ΔΦ_avg| ≤ π/3': dPhiAvg <= Math.PI / 3 };
  return { fire: Object.values(c).every(Boolean), conditions: c, cite: 'RSOC §3.2; RMC Addendum §4' };
}
/* χ(t) update, RSOC §3.2.1 / §4.2.2: Δ←0, ν←1.4, ε←ε(1−Θ̂), μ←μ+0.9Θ, χ←1 (the RSOC route at a hard stop; restricted meaning only).
   4.9.67 ruling 5: Θ is a SUM over the trace τ, so the old ε(1 − Θ/μ) gave Θ/μ > 1 and collapsed ε to 0; ε now uses the normalised
   Θ̂ = Θ/(μ·|τ|) ∈ [0, 1) — the mean grace weight per step (same normalisation as the canonical χ, chiCorrect). */
function applyChi(sfe, Theta) {
  const den = Math.max(sfe.mu, 1e-12) * Math.max(1, (sfe.tau || []).length), th = Math.min(1, Math.max(0, Theta / den));
  return Object.assign({}, sfe, { Delta: 0, nu: 1.4, eps: r4(sfe.eps * (1 - th)), mu: r4(sfe.mu + 0.9 * Theta), chi: 1 });
}
/* 4.9.67 ruling 5 (Nic): the CANONICAL χ correction, built from RPMC's qualitative contract and RSOC's grace kernel.
   RPMC §3: χ acts at most ONCE per ψ, only through a Grace Integral over PHASE-ALIGNED ANCESTORS, and restores the ψ toward its origin
   (echo(χψ) = ψ₁); RSOC §3.2.1: each ancestor s contributes (1 − ε(s)/ε_max)·cos²(Φ(s) − Φ₁)·μ(s). Built here:
     aligned ancestors A = prior states whose phase angle is within π/4 of Φ₁ (RSOC's own ⟁ alignment tolerance δ ≤ π/4; on the circle
       that is Φ9, Φ1, Φ2 — Φ9 is a completed, echo-validated return);
     Θ̂ = Σ_A (1 − ε/ε_max)·cos²(Φ − Φ₁)·μ / Σ_A μ ∈ [0, 1)  — the grace integral NORMALISED by the ancestors' own charge, so it does not grow
       with the length of the trace or the scale of μ (the old ε(1 − Θ/μ) summed Θ over the whole trace, Θ/μ > 1, and collapsed ε to 0);
     ε′ = max(ε·(1 − Θ̂), ε̄_A)  — bounded twice: Θ̂ < 1 (cos²(40°) < 1 for Φ9/Φ2 ancestors) and the ψ is never corrected below the μ-weighted
       mean drift ε̄_A of the ancestors it is corrected toward (you cannot become more coherent than your evidence of coherence);
     no aligned ancestor → no grace (G = 0 < G_min): not applied; already applied for this ψ → not applied (non-repeatable);
     App B.12 validation: the corrected drift must be LOWER, otherwise the correction routes to archive (applied: false). No new constants. */
function chiCorrect({ eps, ancestors, applied, epsMax = 0.8 }) {
  const base = { eps_before: eps, cite: 'RPMC §3 (once per ψ, phase-aligned ancestors); RSOC §3.2.1 grace kernel; RMC App B.12 (drift must fall or archive)' };
  if (applied) return Object.assign(base, { applied: false, eps_after: eps, reason: 'χ already applied for this ψ (non-repeatable)' });
  const A = (ancestors || []).filter(a => a && Number.isFinite(a.Phi) && Number.isFinite(a.eps) && Math.abs(Math.atan2(Math.sin(phaseAngle(a.Phi)), Math.cos(phaseAngle(a.Phi)))) <= Math.PI / 4 + 1e-12);
  if (!A.length) return Object.assign(base, { applied: false, eps_after: eps, aligned: 0, reason: 'no phase-aligned ancestor (G = 0): no grace' });
  let num = 0, den = 0, em = 0; for (const a of A) { const mu = Number.isFinite(a.mu) && a.mu > 0 ? a.mu : 1; num += Math.max(0, 1 - Math.min(a.eps, epsMax) / epsMax) * Math.cos(phaseAngle(a.Phi)) ** 2 * mu; den += mu; em += a.eps * mu; }
  const theta = num / den, floor = em / den, after = Math.max(eps * (1 - theta), floor);
  const out = Object.assign(base, { aligned: A.length, Theta_hat: r4(theta), floor: r4(floor), eps_after: r4(after), formula: 'ε′ = max(ε(1 − Θ̂), ε̄_A) = max(' + eps + '·(1 − ' + r4(theta) + '), ' + r4(floor) + ') = ' + r4(after) });
  if (!(after < eps)) return Object.assign(out, { applied: false, eps_after: eps, reason: 'corrected drift not lower → archive (App B.12)' });
  return Object.assign(out, { applied: true }); }
/* 4.9.67 ruling 6: RSOC ↔ RMC/RPMC phase mapping — PROPOSED, a RECONSTRUCTION from the papers (no paper states it).
   RSOC (Dec 2025): 1 Initiation, 2 Echo, 3 Desire, 4 Fracture, 5 Grace, 6 Naming, 7 Harmony, 8 Completion, 9 Seeding.
   Anchors: ψ_id is fixed at Phase 1 in both; RSOC's "fracture–grace–naming (4–5–6)" sequence is RMC's Friction → Entropy/Grace → Naming
   (RMC splits RSOC's Grace into Φ5 drift measurement + Φ6 χ correction); RSOC's ⧙ lock "typically at Phase 6 (Naming)" is RMC's Φ7 naming;
   RSOC's forbidden ascent 3/4 → 8 (skipping 4–5–6) is RMC's forbidden Φ4/Φ5 → Φ8, so Completion = Projection (8); Seeding (octave, next
   cycle) = Return (9, closure 9→1). Harmony (7) has no RMC phase of its own: it is the echo-validated state between naming and projection. */
const PHASE_MAP_RSOC_TO_RMC = Object.freeze({ status: 'reconstruction', 1: [1], 2: [2], 3: [3], 4: [4], 5: [5, 6], 6: [7], 7: [7, 8], 8: [8], 9: [9],
  names: { 1: 'Initiation', 2: 'Echo', 3: 'Desire', 4: 'Fracture', 5: 'Grace', 6: 'Naming', 7: 'Harmony', 8: 'Completion', 9: 'Seeding' } });
/* ⟁ Merge, RSOC §3.1.1 (δ ≤ π/4): μ′ = μ₁+μ₂+ζcos²δ, ε′=(ε₁+ε₂)/2 − 0.05cosδ, Δ′=(Δ₁+Δ₂)/2+0.1 sinδ */
function merge(a, b, zeta = 0.12) {
  const d = Math.abs(phaseAngle(a.Phi) - phaseAngle(b.Phi));
  if (d > Math.PI / 4 || a.chi !== b.chi) return { ok: false, cite: 'RSOC §3.1.1' };
  return { ok: true, cite: 'RSOC §3.1.1', sfe: Object.assign({}, a, {
    rho: Math.max(a.rho, b.rho), Delta: r4((a.Delta + b.Delta) / 2 + 0.1 * Math.sin(d)), nu: r4((a.nu + b.nu) / 2 + 0.3 * Math.cos(d)),
    mu: r4(a.mu + b.mu + zeta * Math.cos(d) ** 2), eps: r4(Math.max(0, (a.eps + b.eps) / 2 - 0.05 * Math.cos(d))),
    tau: a.tau.concat(b.tau).slice(-144), chi: a.chi | b.chi }) };
}
/* RSOC selection calculus (RSOC Dec 2025 ch.3; v4.9.32–33): the speech rule / route chosen is the one candidate RSOC can ⧙-lock.
   Condition dims are SFEs at angle 0 (holds) or π (fails); a candidate's expectation SFE ⟁-fuses with the evidence SFE only when circular δ ≤ π/4
   (§3.1.1). A rejected fusion leaves residue (+0.07 ε each side) and an unfused composite cannot lock. ⧙ needs χ=0 and ε_s < 0.6 (§3.2.2),
   ε_s = (ε + |Δ| + (1 − H))/max(1, ρ) (§3.3.1). Exactly one lock is lawful; none or several throws (fail closed). Pure, deterministic. */
const cdist = (a, b) => { const d = Math.abs(a - b) % TWO_PI; return Math.min(d, TWO_PI - d); };
function rsocSelect(ev, cands, chi) { const ops = [], E = {}, res = []; for (const d of Object.keys(ev)) E[d] = { th: ev[d] ? 0 : Math.PI, mu: 1, eps: 0 };
  for (const c of cands) { let mu = 0, eps = 0, Dl = 0, rho = 0, n = 0, H = 0, resid = 0;
    for (const d of Object.keys(c.expect)) { const x = c.expect[d] ? 0 : Math.PI, dl = cdist(x, E[d].th), ok = dl <= Math.PI / 4;
      ops.push({ op: '⟁', c: c.id, dim: d, delta: r4(dl), ok }); if (!ok) { resid++; eps += 0.07; continue; }
      mu += 1 + 1 + 0.12 * Math.cos(dl) ** 2; eps = Math.max(0, eps - 0.05 * Math.cos(dl)); Dl += 0.1 * Math.sin(dl); H += Math.cos(dl); n++; rho = 1; }
    const eps_s = r4((eps + Math.abs(Dl) + (1 - (n ? H / n : 0))) / Math.max(1, rho)), lock = !resid && n > 0 && chi === 0 && eps_s < 0.6;
    ops.push({ op: '⧙', c: c.id, ok: lock, eps_s }); res.push({ id: c.id, mu: r4(mu), eps_s, residue: resid, locked: lock }); }
  const L = res.filter(r => r.locked); if (L.length !== 1) throw new Error('RSOC_NO_UNIQUE_LOCK:' + L.length);
  return { calculus: 'RSOC/v1', selected: L[0].id, candidates: res, ops, cite: 'RSOC §3.1.1 ⟁, §3.1.2/§3.2.2 ⧙, §3.3' }; }
/* RSOC reading admission (inward language, v4.9.33): an unlawful reading is a rejected ⟁ (δ = π); coincident readings ⟁-fuse (δ = 0);
   one survivor is ⧙-locked; several are ⧧-held open (ambiguity preserved, never guessed). */
function rsocAdmit(xs, lawful, key) { const out = [], seen = new Set(); let f = 0, x = 0;
  for (const r of xs) { if (!lawful(r)) { x++; continue; } const k = key(r); if (seen.has(k)) { f++; continue; } seen.add(k); out.push(r); }
  return { kept: out, ops: { '⟁': f, '⟁✗': x, '⧙': out.length === 1 ? 1 : 0, '⧧': out.length > 1 ? out.length : 0 } }; }
/* RPM weight of one memory node, RPMC Full Protocol §1: ΦMₙ·exp(−εₙ). Display only — never used to choose meaning. */
const rpmWeight = sfe => r4(sfe.mu * Math.exp(-sfe.eps));
/* Candidate coherence, RMC §5.7: Score(c) = αM + βP + γU + δN − λD */
function score(c, w = { a: 1, b: 1, g: 1, d: 1, l: 1 }) {
  const s = w.a * c.M + w.b * c.P + w.g * c.U + w.d * c.N - w.l * c.D;
  return { score: r4(s), formula: `Score = ${w.a}·${r4(c.M)} + ${w.b}·${r4(c.P)} + ${w.g}·${r4(c.U)} + ${w.d}·${r4(c.N)} − ${w.l}·${r4(c.D)} = ${r4(s)}`, cite: 'RMC §5.7' };
}

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
/* Learned-object governance (EDE, hypotheses, MEA, evolve, reason) — same table. Unmeasured ε_s never projects. */
function driftGovernance(eps) { const ok = typeof eps === 'number' && isFinite(eps) && eps >= 0, row = ok ? driftRow(eps) : null;
  const band = !ok ? 'unmeasured' : row.gov;
  return { eps_s: ok ? r4(eps) : null, band, may_project: !!(row && row.may_project), may_explore: band === 'explore', quarantine: band !== 'projectable', ruling: DRIFT_RULING.cite }; }
/* Turn governance (K1): what a turn at this ε_s and transition may do. The forbidden-transition gate is independent of ε_s. */
function turnGovernance(eps, transition) { const forbidden = isForbidden(transition), ok = typeof eps === 'number' && isFinite(eps) && eps >= 0, row = ok ? driftRow(eps) : DRIFT_TABLE[3];
  const route = forbidden ? 'blocked_forbidden_transition' : row.hard_stop ? 'hard_stop' : row.explore ? 'quarantine' : row.correction ? 'correct' : 'project';
  return { band: row.turn, route, forbidden, may_project: !forbidden && row.may_project, may_write_memory: !forbidden && row.may_write_memory, needs_correction: !forbidden && !!row.correction,
    quarantine: forbidden || row.quarantine, blocked: forbidden || !!row.hard_stop, ruling: DRIFT_RULING.cite }; }
const api = { GATE_PHASES, phaseLaw, chiCorrect, circStd, phaseStep, phaseNext, phasePrev, isBackward, PHASE_MAP_RSOC_TO_RMC, DRIFT_RULING, DRIFT_TABLE, driftRow, driftGovernance, turnGovernance, isForbidden, Q, PHASES, FORBIDDEN, BANDS, driftFunctional, graceIntegral, chiConditions, applyChi, merge, rsocSelect, rsocAdmit, cdist, rpmWeight, score, computeExpr, phaseAngle, r4 };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KMath = api;
})(this);
