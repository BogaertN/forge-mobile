/* 4.9.118 offline research harness. Not a product numerical claim.
 * It reads divisors the code already distinguishes, names phase-ablation stubs,
 * and scores Echo on recorded Language Core surfaces.
 * It does not change Nic's Mobile write law and it does not write the shared KB. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const KM = require('../src/kmath.js');
const EDE = require('../src/ede.js');
const KMOD = require('../src/kernel.js');
const LEX = require('../data/lexicon.json');
const EXT = require('../data/lexicon-ext.json');

const SCHEMA = 'FORGE-MATH-HONESTY/v1';
const CLOCK = () => '2026-10-27T15:00:00Z';
const HONESTY = { manuscript: 'SOURCE_NOT_VERIFIED', phase_scheme: 'reconstruction', research_only: true, label: 'research-only' };
const DRIFT_CASES = [
  { id: 'depth-1', phaseHistory: [9, 1, 2, 8], transition: { from: 5, to: 8, expected: 6 }, depth: 1 },
  { id: 'depth-3', phaseHistory: [9, 1, 2, 8], transition: { from: 5, to: 8, expected: 6 }, depth: 3 },
  { id: 'depth-5', phaseHistory: [9, 1, 2, 8], transition: { from: 5, to: 8, expected: 6 }, depth: 5 }
];
/* The five edges already recorded in verify/w8_suite.js. EDE divides its own components by n = 3. */
const EDE_EDGES = [
  { id: '1', a: 'user/brother', rel: 'cmp:old', b: 'user/sister' },
  { id: '2', a: 'user/sister', rel: 'cmp:old', b: 'user/cousin' },
  { id: '3', a: 'thing:rex', rel: 'isa', b: 'thing:dog' },
  { id: '4', a: 'thing:fido', rel: 'isa', b: 'thing:dog' },
  { id: '5', a: 'thing:dog', rel: 'isa', b: 'thing:animal' }
];

function memStore() {
  const st = {};
  return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } });
}
function stamp(extra) { return Object.assign({ honesty: 'research-only', manuscript: 'SOURCE_NOT_VERIFIED' }, extra || {}); }

function mobileLaw() {
  const r = KM.DRIFT_RULING;
  const unchanged = r.project_max === 0.35 && r.explore_min === 0.4 && r.explore_max === 0.8;
  return {
    project_max: r.project_max,
    chi_below: r.explore_min,
    quarantine_min: r.explore_min,
    quarantine_max: r.explore_max,
    hard_stop_above: r.explore_max,
    unchanged: unchanged,
    paper_0_4_0_8_adopted: false,
    paper_0_50_0_78_0_80_adopted: false,
    cite: r.cite,
    contract: 'drift-table/nic-2026-10-14/v1',
    honesty: 'research-only',
    manuscript: 'SOURCE_NOT_VERIFIED'
  };
}

function staticN3(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  return stamp({ file: rel, stamps_n_3: /n:\s*3/.test(src), divides_by_3: /\/\s*3/.test(src), uses_driftFunctional: /driftFunctional\(/.test(src) });
}

function driftSection() {
  const cases = DRIFT_CASES.map(c => {
    const d = KM.driftFunctional(c);
    const epsN3 = KM.r4((d.sigma_res + d.D_score + d.dPhi) / 3);
    const bandN3 = KM.driftRow(epsN3).turn;
    return stamp({
      id: c.id,
      depth: c.depth,
      divisor_rho: d.rho,
      divisor_n3: 3,
      sigma_res: d.sigma_res,
      D_score: d.D_score,
      dPhi: d.dPhi,
      eps_rho: d.eps_s,
      eps_n3: epsN3,
      band_if_rho: d.band,
      band_if_n3: bandN3,
      same_number: d.eps_s === epsN3,
      same_band: d.band === bandN3,
      live_measure: 'rho',
      applied_to_write_law: false,
      components_note: 'Numerator components are the ones driftFunctional already returns. Dividing them by 3 uses the divisor ede.js, evolve.js, and reason.js stamp. EDE measures different components, so this row is a divisor contrast, not an EDE score.'
    });
  });
  const explored = EDE.explore(EDE_EDGES);
  const sample = [].concat(explored.retained, explored.archived, explored.rejected)[0];
  const ede = stamp({
    code: 'src/ede.js',
    executed: true,
    n: sample.drift.n,
    divisor: 3,
    eps_s: sample.drift.eps_s,
    uses_rho: false,
    equivalent_to_addendum_rho: false,
    recorded_edges: EDE_EDGES.length,
    note: 'EDE stamps n = 3 on its own components. It does not call driftFunctional and it does not divide by ρ.'
  });
  return stamp({
    distinguished: true,
    equivalent: false,
    formulations: [
      stamp({ id: 'rho', executed: true, divisor: 'max(1, depth)', contract: 'drift-measure/addendum-3/v1', where: 'src/kmath.js driftFunctional' }),
      stamp({ id: 'n3', executed: true, divisor: 3, where: 'src/ede.js, src/evolve.js, src/reason.js' }),
      stamp({ id: 'rsoc-n', executed: false, status: 'SOURCE_NOT_VERIFIED', divisor: 'max(1, ρ+1)', where: 'src/kmath.js header; src/ede.js comment', note: 'Noted and not used. This harness does not compute it and does not install it as a gate.' })
    ],
    cases: cases,
    ede: ede,
    static_n3: [staticN3('src/evolve.js'), staticN3('src/reason.js')]
  });
}

function phaseAblation() {
  const ids = Object.keys(KM.PHASES).map(Number).sort((a, b) => a - b);
  return ids.map(n => {
    const p = KM.PHASES[n];
    return {
      phase: n,
      symbol: p.sym,
      name: p.name,
      dropped: true,
      measured: false,
      delta_eps: null,
      status: 'stub',
      phase_scheme_status: KM.MATH_CONTRACTS.phase_scheme_status,
      phase_scheme_id: KM.MATH_CONTRACTS.phase_scheme_id,
      manuscript_equivalence: 'SOURCE_NOT_VERIFIED',
      honesty: 'research-only',
      proven_cognition: false,
      note: 'Ablation is not executed. This stub does not drop the phase from the live kernel and does not claim that Φ1–Φ9 is proven cognition.'
    };
  });
}

function echoSection() {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'lc_surfaces.json'), 'utf8'));
  let shared = 0;
  const rows = fixture.surfaces.map(s => {
    const opts = { clock: CLOCK, lexicon: LEX, lexiconExt: EXT, store: memStore() };
    if (s.fault && s.fault.from) opts.renderFault = t => String(t).split(s.fault.from).join(s.fault.to);
    const k = KMOD.Kernel(opts);
    const r = k.process(s.utterance);
    shared += (k.store.load('shared_knowledge') || []).length;
    return {
      id: s.id,
      utterance: s.utterance,
      expected_pass: s.expected_pass,
      actual_pass: !!(r.trace.echo && r.trace.echo.pass),
      recorded_in: s.recorded_in,
      fault: s.fault || null
    };
  });
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const row of rows) {
    if (row.expected_pass && row.actual_pass) tp++;
    else if (row.expected_pass && !row.actual_pass) fn++;
    else if (!row.expected_pass && row.actual_pass) fp++;
    else tn++;
  }
  const pos = tp + fn, neg = tn + fp;
  return {
    honesty: 'research-only',
    manuscript: 'SOURCE_NOT_VERIFIED',
    product_claim: false,
    fixture: 'research/lc_surfaces.json',
    surfaces: rows.length,
    rows: rows,
    true_positive: tp,
    true_negative: tn,
    false_positive: fp,
    false_negative: fn,
    false_positive_rate: neg ? fp / neg : null,
    false_negative_rate: pos ? fn / pos : null,
    shared_kb_writes: shared,
    note: 'Rates are counts on this recorded set divided by the recorded positives or negatives. A zero here is not a manuscript calibration and not a claim of proven cognition.'
  };
}

function run() {
  let release = '';
  try { release = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim(); } catch (e) { release = ''; }
  return {
    schema: SCHEMA,
    release: release,
    product_claim: false,
    proven_cognition: false,
    honesty: HONESTY,
    manuscript_equivalence: KM.equivalenceClaim('ROC ≡ CFBC ≡ RSOC'),
    mobile_write_law: mobileLaw(),
    drift: driftSection(),
    phase_ablation: phaseAblation(),
    echo: echoSection(),
    answer_path_grace: {
      status: 'wired',
      honesty: 'research-only',
      manuscript: 'SOURCE_NOT_VERIFIED',
      product_claim: false,
      proven_cognition: false,
      note: '4.9.165: answer-path grace is no longer a stub for the RPMC→RSOC factual-miss gate. kernel.js rpmcAncestorCandidates calls kmath.graceOverAncestors (Axiom 4 phase-align + §3.4 graceIntegral; G_MIN=1e-4). Candidates feed AUTH-AQ1/research (RSOC-COMPOSE-EVIDENCE); not a class-dump answer. Does not claim Φ1–Φ9 is proven cognition; does not claim manuscript equivalence.',
      where: ['src/kmath.js graceOverAncestors', 'src/kmath.js graceIntegral', 'src/kernel.js rpmcAncestorCandidates', 'src/forge.js rpmc_priors', 'verify/r4165_suite.js'],
      cite: 'RPMC §3.4 Grace Integral; Axiom 4; Nic t129u–t132u'
    },
    idle_dream_router: {
      status: 'wired',
      honesty: 'research-only',
      manuscript: 'SOURCE_NOT_VERIFIED',
      product_claim: false,
      proven_cognition: false,
      christ_ping: false,
      write_law_unchanged: true,
      continuous_admit_default: true,
      always_on: false,
      quarantine_writes_confirmed_shared: false,
      quarantine_writes_packs: false,
      null_eps_is_unmeasured: true,
      os_process_pool: false,
      integrity_high: 0.85,
      integrity_meter: 'when eps is omitted and a verified extract is present, eps = 1 - mean(integrity). Explicit eps null stays unmeasured and is not Number(null)===0. Product skeleton meter only. Not driftFunctional. Not the Mobile write law.',
      note: '4.9.171 idle dream mesh: Gilligan gap-fill on idle ticks only (answering pauses every helper). Athena maySpawn and mayAdmit. One enforcer per policy domain. Caps 8 living helpers, 4 per parent, 8 spawns per idle window. Spawn, run, hibernate, retire, resurrect stay in-process. Retire writes a hashed cold record. Research resurrection requires drift at or under 0.35 and integrity at least 0.85. Explicit eps null is unmeasured. Every spawn and result is a resonance packet or an idle-dream packet. Quarantine does not write confirmed_shared or packs. No LLM. No OS process pool. ChristPing is not built. Write law unchanged.',
      where: ['src/dream_idle.js', 'src/kmath.js driftGovernance', 'src/kmath.js chiCorrect', 'src/kmath.js graceOverAncestors', 'verify/r4171_suite.js', 'verify/r4170_suite.js'],
      cite: 'Nic drift ruling 2026-10-14; RPMC §3 χ; §3.4 Grace Integral; E-05 quarantine honesty'
    }
  };
}

function markdown(report) {
  const law = report.mobile_write_law;
  const lines = [];
  lines.push('# Math honesty research note');
  lines.push('');
  lines.push('Schema ' + report.schema + '. research-only. Manuscript status SOURCE_NOT_VERIFIED. Phase scheme reconstruction. This is not a product claim. Φ1–Φ9 is not proven cognition.');
  lines.push('');
  lines.push('## Mobile write law');
  lines.push('');
  lines.push('Unchanged. Project and write at or under ' + law.project_max + '. χ correction below ' + law.chi_below + '. Quarantine through ' + law.quarantine_max + '. Hard stop above ' + law.hard_stop_above + '. Paper 0.40/0.80 is not adopted. Paper 0.50/0.78/0.80 is not adopted.');
  lines.push('');
  lines.push('## Drift n versus ρ');
  lines.push('');
  lines.push('The code distinguishes them. They are not equivalent. ρ = max(1, depth) is drift-measure/addendum-3/v1. n = 3 is the divisor ede.js, evolve.js, and reason.js stamp. RSOC n = max(1, ρ+1) is noted and not executed (SOURCE_NOT_VERIFIED). The contrast is research-only and is not applied to the write law.');
  lines.push('');
  lines.push('| id | ρ | n | ε ρ | ε n | band if ρ | band if n |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const c of report.drift.cases) lines.push('| ' + c.id + ' | ' + c.divisor_rho + ' | ' + c.divisor_n3 + ' | ' + c.eps_rho + ' | ' + c.eps_n3 + ' | ' + c.band_if_rho + ' | ' + c.band_if_n3 + ' |');
  lines.push('');
  lines.push('EDE executed with n = ' + report.drift.ede.n + ' on ' + report.drift.ede.recorded_edges + ' recorded edges. That score is not the addendum ρ measure.');
  lines.push('');
  lines.push('## Phase ablation stubs');
  lines.push('');
  lines.push('Nine stubs. measured false. reconstruction. SOURCE_NOT_VERIFIED. No delta is reported.');
  lines.push('');
  for (const s of report.phase_ablation) lines.push('- ' + s.symbol + ' ' + s.name + ': ' + s.status + ', measured ' + s.measured);
  lines.push('');
  lines.push('## Answer-path grace (4.9.165)');
  lines.push('');
  if (report.answer_path_grace) {
    lines.push('status ' + report.answer_path_grace.status + '. ' + (report.answer_path_grace.note || ''));
    lines.push('');
  }
  lines.push('## Idle dream router (4.9.171)');
  lines.push('');
  if (report.idle_dream_router) {
    lines.push('status ' + report.idle_dream_router.status + '. ' + (report.idle_dream_router.note || ''));
    lines.push('');
    lines.push(report.idle_dream_router.integrity_meter || '');
    lines.push('');
  }
  lines.push('## Echo on recorded Language Core surfaces');
  lines.push('');
  const e = report.echo;
  lines.push('research-only. SOURCE_NOT_VERIFIED. Surfaces ' + e.surfaces + '. False positive ' + e.false_positive + ' (rate ' + e.false_positive_rate + '). False negative ' + e.false_negative + ' (rate ' + e.false_negative_rate + '). Shared KB writes ' + e.shared_kb_writes + '. These rates are not a calibrated cognition claim.');
  lines.push('');
  for (const row of e.rows) lines.push('- ' + row.id + ': expected ' + row.expected_pass + ', actual ' + row.actual_pass + '. ' + row.recorded_in);
  lines.push('');
  return lines.join('\n');
}

module.exports = { SCHEMA, HONESTY, run, markdown };
