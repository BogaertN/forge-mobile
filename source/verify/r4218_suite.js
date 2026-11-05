/* R4218 (4.9.218): continuous question tuning on the 9 / 144 dial (Nic-approved, pt125u "Build that").
 * 1. The integer phase is the band (40°, 144/9 = 16 Hz). The question's own words tune the decimal inside it: the
 *    amplitude-weighted mean place r of their 4.9.203 components in the Appendix A marker cells, |r| ≤ offset cap 0.40,
 *    surface nudge ≤ 0.45·ε, ε = 0.02 (the 4.9.203 / 4.9.204 constants, unchanged, now approved). Dial offset = r·½ band,
 *    so at most ±0.20 phase (±8°); the band never changes. General: a pure function of the letters, no question list.
 * 2. rank_memory reads the tuned phase: the π/4 window and grace = rpm·cos²δ use the continuous gap.
 * 3. Ask's ε stays /3; the 4.9.217 decimal packet phase, definition-first rank and relation Echo stay; the math,
 *    remembered-fact and Dry-Run paths still work. Cold 60 recorded, not tuned. No LLM, no network. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const py = args => JSON.parse(cp.execFileSync(process.env.PYTHON || 'python3', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').pop());
let C = null;
const chk = () => (C = C || py(['tools/check_218.py']));

T('the question is tuned inside its band: |offset| ≤ 0.20 phase, the band is kept, the dial wraps at Φ1, and the result is deterministic', () => {
  const c = chk();
  expect(c.tunes_ok && c.repeat_same && c.case_same, JSON.stringify({ ok: c.tunes_ok, rep: c.repeat_same, cs: c.case_same }));
  for (const r of c.tunes) {
    expect(r.band >= 1 && r.band <= 9 && Math.abs(r.offset) <= 0.2 + 1e-9 && r.Phi >= 1 && r.Phi < 10 && r.calls_llm === false, JSON.stringify(r).slice(0, 300));
    expect(Math.abs(r.degrees - ((((r.band - 1) * 40 + r.offset * 40) % 360) + 360) % 360) < 1e-3, 'degrees ' + r.q);
  }
  const empty = c.tunes.find(r => r.q === '' && r.band === 5); expect(empty.Phi === 5 && empty.offset === 0 && empty.words.length === 0, 'no words: the band centre');
  expect(c.tunes.some(r => r.offset > 0) && c.tunes.some(r => r.offset < 0 && r.band === 1 && r.Phi > 9), 'both directions; Φ1 − δ is written as Φ9.x on the circle');
});
T('the 4.9.203 / 4.9.204 constants are unchanged and recorded as Nic-approved (drift_policy, config, CONFLICTS, the tuning record)', () => {
  const c = chk();
  expect(c.constants.epsilon === 0.02 && c.constants.offset_cap === 0.4 && c.constants.nudge_span === 0.45 && /Nic, pt125u/.test(c.constants.approved), JSON.stringify(c.constants));
  expect(c.policy.status === 'approved' && c.policy.epsilon === 0.02 && c.policy.offset_cap === 0.4 && c.policy.nudge_span === 0.45 && c.policy.release === '4.9.218', JSON.stringify(c.policy));
  const t = c.tunes[0]; expect(t.epsilon === 0.02 && t.offset_cap === 0.4 && t.nudge_span === 0.45 && /pt125u/.test(t.approved) && t.schema === 'FORGE-QUESTION-TUNING/v1', 'record');
  const qt = read('engine/rmc_engine_v1/question_tuning.py');
  expect(/from rmc_engine_v1\.frequency_203_config import EPSILON, NUDGE_SPAN, OFFSET_CAP/.test(qt) && !/^\s*[A-Za-z_]+\s*=\s*0\.(02|40?|45)\b/m.test(qt), 'constants imported, not restated');
  expect(!/What is|Why is|capital|Moon|Burkina/.test(qt.replace(/"""[\s\S]*?"""/g, '')), 'no question list in the code');
  expect(/D14/.test(read('engine/rmc_engine_v1/drift_policy.py')) && /QUESTION_TUNING = \{/.test(read('engine/rmc_engine_v1/drift_policy.py')), 'drift_policy');
  const conf = read('CONFLICTS.md'); const i = conf.indexOf('## v4.9.218'); const e = conf.slice(i, i + 5000); /* 4.9.219 (4.9.221, 4.9.222, 4.9.223, 4.9.230, 4.9.231, 4.9.232, 4.9.233, 4.9.234, 4.9.235: one more each): later entries sit above; the 4.9.218 entry stays near the top */ expect(i >= 0 && (conf.slice(0, i).match(/^## v/gm) || []).length <= 10 && /ε 0\.02/.test(e) && /0\.40/.test(e) && /0\.45/.test(e) && /pt125u/.test(e), 'CONFLICTS entry at the top');
});
T('rank_memory reads the tuned phase: the station nearest the question wins on grace, and the π/4 window reads the continuous gap', () => {
  // 4.9.219 (DRIFT-SPEC/v1 D15, Nic 2026-11-04) retired the ± phase offset in rank_memory: the question reads its integer
  // phase again and tunes a symbolic Hz inside its named band. question_tuning.tune itself is kept and still tested above.
  const r = chk().recall;
  expect(r.question_band === 1 && r.question_phi === 1 && r.tuning.schema === 'FORGE-BAND-TUNING/v1' && r.tuning.phase === 1, JSON.stringify(r).slice(0, 300));
  const rr = read('engine/rmc_engine_v1/resonance_recall.py');
  expect(/question_band = _question_phi\(phase_report\)/.test(rr) && /tuning = _band_tune\(question or "", question_band\)/.test(rr) && /question_phi = question_band/.test(rr), 'superseded by band tuning');
  expect(/"question_tuning", "asked"/.test(read('engine/rmc_engine_v1/memory_recaller.py')) && /res\.question_tuning/.test(read('src/app.js')), 'recorded on the card');
});
T('what stays: Ask ε /3, decimal packet phase, definition-first rank, relation Echo; the math, remembered-fact and Dry-Run paths work', () => {
  const c = chk();
  expect(/epsilon_s = round\(\(sigma_res \+ d_score \+ delta_phi\) \/ 3\.0, 4\)/.test(read('engine/rmc_engine_v1/drift_engine.py')), '/3');
  const rr = read('engine/rmc_engine_v1/resonance_recall.py');
  expect(/role_locks\.sort\(key=lambda row: \(_trusted\(row\[0\]\), _defines\(row\[0\]\), _resonance\(row\[2\]\)/.test(rr) && /def _phase_value/.test(rr), 'rank and decimal phase');
  expect(c.dna.product_reply && /^DNA, or deoxyribonucleic acid/.test(c.dna.reply) && c.dna.relation.realised === true, 'definition first');
  expect(!c.moon.product_reply && c.moon.relation.realised === false, 'relation Echo holds a mention');
  expect(c.sky.product_reply && c.sky.relation.asked === 'cause', 'cause');
  expect(c.math.product_reply && c.math.reply === '17 times 23 is 391.' && c.math.echo_method === 'computed_quantity_reparse', 'math');
  expect(c.convert.product_reply && c.convert.reply === '5 miles is 8.04672 km.', 'convert');
  expect(c.car.product_reply && c.car.reply === 'My car is red.' && c.car.relation.asked === 'attribute', 'remembered fact');
  for (const k of ['dry_math', 'dry_sky']) expect(c[k].product_reply === false && c[k].writes === false && c[k].calls_llm === false, k);
  for (const k of ['dna', 'moon', 'sky', 'math', 'convert', 'car']) expect(c[k].calls_llm === false && c[k].writes === false, k + ' no write in a cold ask');
});
T('the cold 60 for 4.9.218 is recorded (not tuned) with zero false admits and no admit lost against 4.9.217', () => {
  const c = JSON.parse(read('data/cold_218_results.json')), p = JSON.parse(read('data/cold_217_results.json'));
  expect(c.release === '4.9.218' && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, h: c.held, f: c.false_admits }));
  const old = Object.fromEntries(p.rows.map(r => [r.question, r]));
  for (const r of c.rows) expect(!(old[r.question] && old[r.question].admitted && !r.admitted), 'lost admit: ' + r.question);
  expect(c.admitted >= p.admitted, 'admits ' + c.admitted + ' vs ' + p.admitted);
});
T('version registry names 4.9.218', () => {
  expect(/^4\.9\.(21[8-9]|2[2-9]\d)$/.test(read('VERSION').trim()), 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4218-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4218', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4218', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
