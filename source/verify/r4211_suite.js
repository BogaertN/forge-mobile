/* R4211 (4.9.211): Release B, DRIFT-SPEC/v1 resolved (most-recent-document rule; Nic plan, 2026-10-31).
 * One constants module (kmath.js DRIFT_POLICY) mirrored in mobile_config.DRIFT_POLICY and in SQL app.drift_policy(). Ordered checks:
 * forbidden (any ε, any depth) → hard_stop ε ≥ 0.80 (inclusive, first) → acceleration → explore 0.40 ≤ ε < 0.80 → correct
 * θ_admit < ε < 0.40 (one χ-correct pass, the re-measure must fall) → clean ε ≤ θ_admit = min(0.35, 0.4/(1+γL)). Trend k = 3.
 * ε = (σ_circ + D + |ΔΦ|)/max(1, depth), not clipped. The σ_res ≤ 0.35 gate and Athena's 0.78 are dropped (reference only).
 * A lasting write needs Φ6 correction then Φ7 naming, Echo ≥ 0.97 plus the categorical classes, C ≥ 0.87; the server recomputes
 * the trace ε (app.drift_eps) and the memory-writer refuses with KB-WRITER-* codes. A broken receipt chain halts. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const REPO = path.join(ROOT, '..');
const KM = require(ROOT + '/src/kmath.js');
const CU = require(ROOT + '/src/curators_208.js');
const SB = require(ROOT + '/src/sb_sync.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const MIG = fs.readFileSync(path.join(REPO, 'supabase', 'migrations', '20261101010000_drift_policy_211.sql'), 'utf8');
/* a deterministic grid (no randomness): every hist of length 0..3 over a phase sample, every transition, depth 1..3 and 10 */
const GRID = { measure: [], classify: [] };
for (const hist of [[], [1], [5], [5, 6], [9, 1], [5, 6, 7, 8], [1, 6, 7], [2, 9, 4]]) for (const [prev, act] of [[5, 8], [4, 8], [8, 9], [9, 1], [3, 7], [6, 4]]) for (const depth of [1, 2, 3, 10]) GRID.measure.push({ hist, prev, act, depth });
for (const eps of [0, 0.2, 0.35, 0.350001, 0.399999, 0.4, 0.5, 0.799999, 0.8, 0.95, 1.4]) for (const extra of [{}, { path: [5, 8] }, { path: [6, 4] }, { path: [8, 9, 1] }, { path: [1, 6, 7] }, { history: [0.1, 0.11, 0.12, eps] }, { stamps_ms: [0, 5, 10] }, { L: 1 }]) GRID.classify.push(Object.assign({ eps }, extra));
let CHK = null;
const chk = () => (CHK = CHK || JSON.parse(cp.execFileSync(process.env.PYTHON || 'python3', ['tools/check_211.py', JSON.stringify(GRID)], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop()));
const W = () => import(path.join(REPO, 'supabase', 'functions', 'memory-writer', 'writer.js'));
const CLS = { ok: true, classes: { negation: { answer: false, source: false, ok: true }, certainty: { answer: false, source: false, ok: true }, condition: { answer: false, source: false, ok: true } } };
const PROOF = () => ({ drift_input: { hist: [5, 6, 7, 8], prev: 8, act: 9, depth: 1, scheme: 'phase-scheme/rmc/v1' }, drift: { eps: 0.119133, metric_id: 'eps_s/rsoc-v4.8+circ/v1' }, echo: 1, echo_classes: JSON.parse(JSON.stringify(CLS)), coherence: 0.89 });

T('one constants module: kmath DRIFT_POLICY = mobile_config.DRIFT_POLICY = SQL app.drift_policy()', () => {
  const P = KM.DRIFT_POLICY, py = chk().policy;
  const sql = JSON.parse(MIG.match(/create or replace function app\.drift_policy\(\)[\s\S]*?select '(\{[\s\S]*?\})'::jsonb/)[1]);
  for (const k of Object.keys(sql)) expect(JSON.stringify(sql[k]) === JSON.stringify(P[k]), 'sql ' + k);
  for (const k of Object.keys(py)) expect(JSON.stringify(py[k]) === JSON.stringify(P[k]), 'py ' + k + ' ' + JSON.stringify(py[k]) + ' vs ' + JSON.stringify(P[k]));
  expect(P.METRIC_ID === 'eps_s/rsoc-v4.8+circ/v1' && P.DENOMINATOR === 'max1_depth' && P.ADMIT_MAX === 0.35 && P.EXPLORE_MIN === 0.40 && P.HARD_MIN === 0.80 && P.HARD_INCLUSIVE === true, 'bands');
  expect(P.THETA_W_BASE === 0.40 && P.GAMMA === 0.5 && P.ECHO_MIN === 0.85 && P.ECHO_MEMORY_MIN === 0.97 && P.C_MIN === 0.87 && P.LAMBDA_DRIFT === 0.18, 'gates');
  expect(P.CHI_CORRECT_PASSES === 1 && P.CHI_GRACE_PER_LOOP === 1 && P.CHRISTPING_SETTLE_MS === 3330 && P.BREAKER_FAILS === 3 && P.BREAKER_RECOVER_S === 60 && P.RESURRECTION_LIMIT === 5 && P.TREND_K === 3 && P.ACCEL_NV === 3 && P.ACCEL_TAU_MS === 18.7, 'limits');
  expect(JSON.stringify(P.FORBIDDEN) === '{"rmc":[[5,8],[4,8]],"backward":true}' && P.PHASE_SCHEME_ID === 'phase-scheme/rmc/v1', 'forbidden set');
  expect(P.reference_only.athena_membrane_a === 0.78 && P.reference_only.sigma_res_gate === 0.35 && chk().thresholds.resonance_epsilon_role === 'reference_only' && chk().thresholds.hard_stop_inclusive === true, 'dropped gates are reference only');
});
T('ordered checks at the exact edges: 0.35 clean, 0.350001 correct, 0.40 explore, 0.799999 explore, 0.80 hard stop (JS = Python)', () => {
  const r = e => KM.classifyDrift({ eps: e }).region;
  expect(r(0.35) === 'clean' && r(0.350001) === 'correct' && r(0.399999) === 'correct' && r(0.4) === 'explore' && r(0.799999) === 'explore' && r(0.8) === 'hard_stop' && r(1.4) === 'hard_stop', 'edges');
  expect(KM.driftRow(0.8).turn === 'hard_stop' && KM.driftGovernance(0.8).band === 'reject' && KM.driftRow(0.799999).turn === 'elevated', 'the old table agrees');
  const py = chk().classify;
  GRID.classify.forEach((c, i) => { const j = KM.classifyDrift(c); expect(j.region === py[i].region && j.theta_admit === py[i].theta_admit && j.trend === py[i].trend && j.acceleration === py[i].acceleration, 'parity ' + JSON.stringify(c) + ' js ' + j.region + ' py ' + py[i].region); });
  expect(KM.DRIFT_POLICY.CHECK_ORDER.join() === 'forbidden,hard_stop,acceleration,explore,correct,clean', 'order');
});
T('a forbidden transition blocks at any ε and any depth (depth 10, ε 0.1); backward committed steps too', () => {
  const m = KM.driftMeasure({ phaseHistory: [5], transition: { from: 5, to: 8 }, depth: 10 });
  expect(m.d_score === 1 && m.eps < 0.35 && m.forbidden === true && m.rho === 10, JSON.stringify(m));
  expect(KM.classifyDrift({ eps: 0.1, transition: { from: 5, to: 8 } }).region === 'forbidden' && KM.classifyDrift({ eps: 0.1, path: [4, 8] }).region === 'forbidden', '5→8 and 4→8');
  expect(KM.classifyDrift({ eps: 0.1, path: [6, 4] }).region === 'forbidden' && KM.classifyDrift({ eps: 0.1, path: [8, 9, 1] }).region === 'clean', 'backward vs the 9→1 closure');
  const g = chk().gate; expect(g.forbidden_low.disposition === 'forbidden' && g.backward.disposition === 'forbidden' && !g.forbidden_low.applied_to_ask, 'engine gate');
});
T('driftMeasure: circular σ, D over S, |ΔΦ| from the expected successor, N = max(1, depth), not clipped; JS = Python = Edge', async () => {
  const w = await W(); const py = chk().measure;
  GRID.measure.forEach((g, i) => {
    const j = KM.driftMeasure({ phaseHistory: g.hist, transition: { from: g.prev, to: g.act }, depth: g.depth });
    const e = w.driftEps(g.hist, g.prev, g.act, g.depth);
    expect(j.eps === py[i].eps && j.eps === e.eps && j.d_score === py[i].d_score && j.forbidden === py[i].forbidden, 'parity ' + JSON.stringify(g) + ' ' + j.eps + '/' + py[i].eps + '/' + e.eps);
  });
  const big = KM.driftMeasure({ phaseHistory: [5], transition: { from: 5, to: 8 }, depth: 1 });
  expect(big.eps > 1 && big.clipped === false && Math.abs(big.eps - 1.222222) < 1e-9, 'not clipped ' + big.eps);
  expect(KM.driftMeasure({ phaseHistory: [5, 6, 7, 8], transition: { from: 8, to: 9 }, depth: 1 }).eps === 0.119133, 'the write trace');
  expect(/v_eps := \(v_sigma \+ v_d \+ v_dphi\) \/ greatest\(1, coalesce\(p_depth, 1\)\)/.test(MIG) && /sqrt\(greatest\(0\.0, 2 \* \(1 - v_r\)\)\) \/ \(2 \* pi\(\)\)/.test(MIG) && /\(p_prev, p_act\) in \(\(5, 8\), \(4, 8\)\)/.test(MIG), 'SQL mirror');
});
T('θ_admit only tightens, C = 1 − ε, trend k = 3 and v(t) acceleration route to correct; χ-grace is Gilligan-only, once per loop', () => {
  const c = chk();
  expect(KM.thetaAdmit(0) === 0.35 && Math.abs(KM.thetaAdmit(1) - 0.4 / 1.5) < 1e-12 && c.theta[0] === 0.35 && Math.abs(c.theta[1] - 0.4 / 1.5) < 1e-12, 'θ');
  expect(KM.classifyDrift({ eps: 0.3, L: 1 }).region === 'correct' && KM.classifyDrift({ eps: 0.3 }).region === 'clean', 'tighter with curvature');
  expect(KM.coherence(0.2) === 0.8 && KM.coherence(1.4) === 0, 'C');
  expect(KM.trendRising([0.1, 0.11, 0.12, 0.13]) && !KM.trendRising([0.1, 0.11, 0.11, 0.13]) && !KM.trendRising([0.1, 0.11, 0.12]) && c.trend.join() === 'true,false,false', 'trend');
  expect(KM.accelerationFlag([0, 5, 10]).v === 1 && KM.accelerationFlag([0, 10, 20]).v === 0 && c.accel[0].v === 1 && c.accel[1].v === 0, 'acceleration');
  expect(c.gate.trend.disposition === 'correct' && c.gate.accel.disposition === 'correct' && c.gate.accel.drift_region === 'acceleration' && c.gate.breaker.disposition === 'correct', 'engine routes');
  const e = KM.evaluateChiEligibility({ eps: 0.85 }, { dphi_avg: 0.5 }, true, { owner: 'gilligan' });
  expect(e.eligible && e.authorises_write === false && !KM.evaluateChiEligibility({ eps: 0.85 }, { dphi_avg: 0.5 }, true, { owner: 'gilligan', chi_grace_used: 1 }).eligible, 'once per loop');
  expect(KM.evaluateChiEligibility({ eps: 0.5 }, { dphi_avg: 0.5 }, true, { owner: 'athena' }).failed_guards.join() === 'not_hard_stop,gilligan_only' && c.chi[2].failed_guards.join() === 'not_hard_stop,gilligan_only', 'guards');
});
T('the engine admit gate: ordered regions, ≥ 0.80 inclusive, the σ_res ≤ 0.35 gate dropped (reported only)', () => {
  const g = chk().gate;
  expect(g.sigma_big_clean.disposition === 'admit' && g.sigma_big_clean.sigma_res === 0.6 && /dropped/.test(g.sigma_big_clean.sigma_res_gate) && !('resonance_gap_ok' in g.sigma_big_clean), 'σ_res no longer gates');
  expect(g.at_035.disposition === 'admit' && g.at_0351.disposition === 'correct' && g.at_040.disposition === 'quarantine' && g.at_0799.disposition === 'quarantine' && g.at_080.disposition === 'hard_stop' && g.at_080.hard_stop === true, JSON.stringify([g.at_035.disposition, g.at_0351.disposition, g.at_040.disposition, g.at_080.disposition]));
  const core = read('engine/rmc_engine_v1/rmc_core.py');
  expect(/from rmc_engine_v1\.drift_policy import classify_drift/.test(core) && !/gap_ok = gap <= float\(THRESHOLDS\["resonance_epsilon"\]\)/.test(core), 'classifier, no σ gate');
});
T('every ε hard stop in the engine and the phone is inclusive (no "> 0.8" / "> HARD_STOP" left on ε)', () => {
  const files = ['src/athena_doc.js', 'src/drift_194.js', 'src/geometry_199.js', 'src/gilligan_codex.js', 'src/lexicon_growth_198.js', 'src/mea_p.js', 'src/dream_idle.js', 'src/ede.js', 'src/drift_v43.js', 'src/kmath.js', 'src/curators_208.js', 'src/kernel.js',
    'engine/rmc_engine_v1/deep_dry_run_orchestrator.py', 'engine/rmc_engine_v1/drift_194.py', 'engine/rmc_engine_v1/geometry_199.py', 'engine/rmc_engine_v1/gilin_crp_201.py', 'engine/rmc_engine_v1/gilligan_anchor.py', 'engine/rmc_engine_v1/language_core_engines.py',
    'engine/rmc_engine_v1/language_core_orchestration.py', 'engine/rmc_engine_v1/lexicon_growth_198.py', 'engine/rmc_engine_v1/measurement_kernel.py', 'engine/rmc_engine_v1/rmc_renderer_200.py', 'engine/rmc_engine_v1/world_model_v1.py', 'engine/rmc_engine_v1/chi_hardening.py', 'engine/rmc_engine_v1/drift_v43.py', 'engine/rmc_engine_v1/rmc_core.py'];
  const bad = /\b(eps|drift|n|epsilon_s|eps_s)\b\)? > (0\.80?\b|HARD_STOP|HARD\b|THETA_HARD|KM\.DRIFT_RULING\.explore_max|KM\.CHI_HARDENING\.theta_hard|float\((laws|THRESHOLDS)\[["']hard_stop["']\]\))/;
  for (const f of files) read(f).split('\n').forEach((line, i) => expect(!bad.test(line), f + ':' + (i + 1) + ' ' + line.trim().slice(0, 120)));
  const g = chk().gate; expect(g.at_080.drift_region === 'hard_stop', 'engine');
});
T('the write gate: Φ6 correction then Φ7 naming, Echo ≥ 0.97 plus negation/certainty/condition classes, C ≥ 0.87', () => {
  const c = chk();
  const o = c.ocean.write_gate;
  expect(c.ocean.proposed === true && o.ok && o.drift_input.hist.join() === '5,6,7,8' && o.drift_input.prev === 8 && o.drift_input.act === 9 && o.drift_input.depth === 1 && o.drift.eps === 0.119133 && o.drift_status === 'stable' && /^premise:/.test(o.echo_source), JSON.stringify(o).slice(0, 400));
  expect(c.corrected.write_gate.drift_input.depth === 2 && c.corrected.write_gate.drift_status === 'corrected', 'one χ-correct pass is recorded in the depth');
  expect(c.capital.proposed === true && c.capability.proposed === false && c.capability.rule === 'MEMORY-WRITE-GATE-ECHO-CLASSES', JSON.stringify([c.capability.rule]));
  expect(c.negation_lost.failed.join() === 'echo_classes' && c.negation_lost.echo_classes.classes.negation.source === true && c.negation_lost.echo_classes.classes.negation.answer === false, 'a lost negation never becomes memory');
  expect(c.negation_kept.ok && c.source_sentence.ok && c.source_sentence.echo_source === 'premise:p1', 'a kept negation and the containing sentence');
  expect(c.unnamed.failed.indexOf('unnamed') >= 0 && c.low_echo.failed.join() === 'echo', 'no naming, no write; Echo 0.9 < 0.97');
  const a = KM.admitDecision({ hist: [5, 6, 8], prev: 8, act: 9, depth: 1, echo: 1, echo_classes: CLS, coherence: 0.9 });
  expect(!a.ok && a.failed.indexOf('unnamed') >= 0 && KM.admitDecision(Object.assign(PROOF().drift_input, { echo: 1, echo_classes: CLS, coherence: 0.9 })).ok, 'JS mirror');
  expect(JSON.stringify(KM.echoClasses('The ocean is not salty.', 'The ocean is salty.')) === JSON.stringify(c.classes[0]) && JSON.stringify(KM.echoClasses('Salt may come from rocks.', 'Salt may come from rocks and vents.')) === JSON.stringify(c.classes[1]), 'classes JS = Python');
});
T('Remember refuses a failed gate and keeps nothing; the writer sends the drift proof and refuses rows without one', async () => {
  const app = read('src/app.js');
  expect(/mw\.write_gate && mw\.write_gate\.ok !== true\) return \{ ok: false, rule: mw\.rule \|\| 'MEMORY-WRITE-GATE'/.test(app) && /Not remembered: the memory write gate failed/.test(app) && /data-write-gate/.test(app), 'app');
  const st = {}; const ls = { getItem: k => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: k => { delete st[k]; } };
  const c = SB.Client({ storage: ls, fetch: async () => { throw new Error('network used'); }, crypto: require('crypto').webcrypto });
  c.token = async () => 'a.b.c';
  const base = { text: 'x', sfe: { Phi: 1, eps: 0.1, mu: 1 }, provenance: { contributor: 'athena', q: 1 } };
  const src = read('src/sb_sync.js');
  expect(/KB-WRITER-DRIFT-INPUT-REQUIRED/.test(src) && /KB-WRITER-GATE-/.test(src) && /drift_input: wg\.drift_input/.test(src) && /echo_classes: wg\.echo_classes/.test(src), 'sb_sync carries the proof');
  expect(base && typeof c.insertAdmitted === 'function', 'client');
});
T('the memory-writer Edge Function refuses KB-WRITER-* drift codes before the database (and the SQL writer refuses the same)', async () => {
  const w = await W(); const P = PROOF;
  expect(w.driftRefusal(P()) === null, 'a clean write passes ' + w.driftRefusal(P()));
  const v = (f, rule) => { const p = P(); f(p); const got = w.driftRefusal(p); expect(got === rule, rule + ' got ' + got); };
  v(p => { delete p.drift_input; }, 'KB-WRITER-DRIFT-INPUT-REQUIRED');
  v(p => { p.drift_input.scheme = 'x'; }, 'KB-WRITER-DRIFT-INPUT-REQUIRED');
  v(p => { p.drift.eps = 0.1; }, 'KB-WRITER-EPS-MISMATCH');
  v(p => { p.drift_input = { hist: [5], prev: 5, act: 8, depth: 3, scheme: 'phase-scheme/rmc/v1' }; p.drift.eps = w.driftEps([5], 5, 8, 3).eps; }, 'KB-WRITER-FORBIDDEN');
  v(p => { p.drift_input = { hist: [5, 6, 7, 8, 6], prev: 6, act: 9, depth: 1, scheme: 'phase-scheme/rmc/v1' }; p.drift.eps = w.driftEps([5, 6, 7, 8, 6], 6, 9, 1).eps; }, 'KB-WRITER-FORBIDDEN');
  v(p => { p.drift_input = { hist: [5, 6, 7, 8], prev: 8, act: 3, depth: 1, scheme: 'phase-scheme/rmc/v1' }; p.drift.eps = w.driftEps([5, 6, 7, 8], 8, 3, 1).eps; }, 'KB-WRITER-DRIFT');
  v(p => { p.drift_input = { hist: [1, 2, 3, 7], prev: 7, act: 2, depth: 1, scheme: 'phase-scheme/rmc/v1' }; p.drift.eps = w.driftEps([1, 2, 3, 7], 7, 2, 1).eps; }, 'KB-WRITER-HARD-STOP');
  v(p => { p.drift_input = { hist: [5, 6, 8], prev: 8, act: 9, depth: 1, scheme: 'phase-scheme/rmc/v1' }; p.drift.eps = w.driftEps([5, 6, 8], 8, 9, 1).eps; }, 'KB-WRITER-UNNAMED');
  v(p => { p.echo = 0.9; }, 'KB-WRITER-ECHO');
  v(p => { p.echo_classes.classes.negation.ok = false; }, 'KB-WRITER-ECHO');
  v(p => { p.coherence = 0.8; }, 'KB-WRITER-COHERENCE');
  expect(w.driftEps([1, 2, 7, 8], 8, 1, 1).eps >= 0.8, 'hard case is ≥ 0.80');
  const src = fs.readFileSync(path.join(REPO, 'supabase', 'functions', 'memory-writer', 'writer.js'), 'utf8');
  expect(src.indexOf('driftRefusal(args.p_proof)') > 0 && src.indexOf('driftRefusal(args.p_proof)') < src.indexOf('rpc/memory_writer_insert_signed'), 'refused before the RPC');
  for (const code of ['KB-WRITER-CHAIN-BREAK', 'KB-WRITER-DRIFT-INPUT-REQUIRED', 'KB-WRITER-EPS-MISMATCH', 'KB-WRITER-FORBIDDEN', 'KB-WRITER-HARD-STOP', 'KB-WRITER-DRIFT', 'KB-WRITER-UNNAMED', 'KB-WRITER-ECHO', 'KB-WRITER-COHERENCE']) expect(MIG.indexOf("'" + code + "'") > 0, 'SQL ' + code);
  expect(/if not app\.receipts_chain_ok\(\) then/.test(MIG) && /abs\(v_seps - v_claim\) > 0\.000001/.test(MIG) && /v_seps >= 0\.80/.test(MIG) && /v_echo < 0\.97/.test(MIG) && /'eps_server', v_seps/.test(MIG), 'SQL law');
  const t = fs.readFileSync(path.join(REPO, 'supabase', 'tests', 'drift_writer_211_test.sql'), 'utf8');
  expect(/DRIFT_WRITER_RESULTS/.test(t) && /forbidden_depth10_still_d1/.test(t) && /clean_write_ok/.test(t), 'SQL acceptance test');
});
T('Gilligan: lanes from the ordered classifier, one χ-correct pass whose re-measure must fall, write gate, chain break halts', async () => {
  expect(CU.laneOf(0.8) === 'hard' && CU.laneOf(0.79) === 'quarantine' && CU.laneOf(0.36) === 'correct' && CU.laneOf(0.35) === 'clean' && CU.laneOf(0.2, null, 'forbidden') === 'hard', 'lanes');
  const mem = {}; let n = 0; const ins = [];
  const row = (eps, gate) => ({ product_reply: true, reply: 'The sky looks blue.', drift: eps, coherence: 0.9, echo: { pass: true, score: 1 }, admit: { drift_region: KM.classifyDrift({ eps }).region }, trust: {}, memory_write: { proposal: { text: 'The sky looks blue.' }, write_gate: gate } });
  const mk = (seq, insert) => CU.Curators({ store: { get: k => mem[k], set: (k, v) => { mem[k] = JSON.parse(JSON.stringify(v)); } }, kmath: KM, now: () => 1000,
    run: async p => row(seq[Math.min(n++, seq.length - 1)], { ok: true }), anchorsFor: async () => [], insert: async b => { ins.push(b); return insert(b); }, digest: async () => 'd' });
  const a = mk([0.37, 0.37], () => ({ ok: false })); a.noteHeld('Why is the sky blue?', { product_reply: false });
  const r = await a.tick(); expect(r.to === 'quarantine' && r.rule === 'GILLIGAN-CHI-DID-NOT-FALL' && r.rec.chi_pass === true && r.rec.chi_fell === false, JSON.stringify(r).slice(0, 300));
  const src = read('src/curators_208.js');
  expect(/chi_passes: 1/.test(src) && /drift_history: hist/.test(src) && /GILLIGAN-WRITE-GATE/.test(src) && /KB-WRITER-CHAIN-BREAK/.test(src) && /CURATE-HALTED-CHAIN-BREAK/.test(src), 'curator rules');
});
T('Release B leaves the engine result honest: the cold 60 for 4.9.211 is recorded (not tuned)', () => {
  const c = JSON.parse(read('data/cold_211_results.json'));
  expect(/^4\.9\.211$/.test(c.release) && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, h: c.held }));
  expect(fs.existsSync(path.join(REPO, 'docs', 'LIVE_TEST_211.md')), 'report');
});
T('the Pyodide bundle carries drift_policy.py and the new gate; its SRI is pinned', () => {
  const b = JSON.parse(read('data/py/rmc_engine_bundle.json')).files;
  for (const f of ['drift_policy.py', 'mobile_config.py', 'rmc_core.py', 'chi_correction_gate.py']) expect(b['rmc_engine_v1/' + f] === read('engine/rmc_engine_v1/' + f), f);
  const sri = 'sha384-' + require('crypto').createHash('sha384').update(fs.readFileSync(path.join(ROOT, 'data/py/rmc_engine_bundle.json'))).digest('base64');
  expect(read('src/rmc_client.js').indexOf(sri) >= 0, 'SRI ' + sri);
});
T('version registry names 4.9.211', () => {
  expect(/^4\.9\.(21[1-9]|2[2-9]\d)$/.test(read('VERSION').trim()), 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4211-') >= 0, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4211', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4211', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
