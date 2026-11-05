/* R4219 (4.9.219): band tuning on the 144/n ladder (DRIFT-SPEC/v1 D15, Nic 2026-11-04, option 4c).
 * 1. drift_policy.BAND_TABLE: every phase has its FBSC Glyph Codex v2.5 named band with edges on the 144/n ladder and no
 *    overlaps, except Φ6 Grace keeps the Codex 6–9 Hz theta–alpha blend; Φ9 is the 144 Hz carrier band (80–220).
 * 2. The phase alone picks the band. The item's words tune a symbolic Hz inside it (ε 0.02, cap 0.40, nudge 0.45).
 * 3. Same band 1.0; ×3 0.3; ×9 0.1 (PCI Appendix A M1) through a 144/n marker; a ranking key only, never an admit.
 * 4. The 4.9.218 ± phase offset is retired; Ask ε /3, decimal packet phase, definition-first rank, relation Echo, math,
 *    remembered-fact and Dry-Run paths stay. Hz are labelled symbolic, not measured. No LLM, no network. */
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
const chk = () => (C = C || py(['tools/check_219.py']));

T('the band table is the Codex v2.5 names on the 144/n ladder: no overlaps except Φ6 Grace 6–9 Hz, Φ9 the 144 Hz carrier', () => {
  const t = chk().table;
  const want = { 1: ['Theta', 4, 8, 6], 2: ['Low alpha', 8, 10, 9], 3: ['Alpha-beta', 10, 14, 12], 4: ['Mid beta', 14, 20, 18], 5: ['High beta', 20, 30, 24],
    6: ['Theta-alpha blend', 6, 9, 8], 7: ['Low gamma', 30, 40, 36], 8: ['High gamma', 40, 80, 48], 9: ['144 Hz carrier', 80, 220, 144] };
  for (const [p, [n, lo, hi, c]] of Object.entries(want)) expect(t[p].name === n && t[p].low === lo && t[p].high === hi && t[p].centre === c && 144 % c === 0, 'row ' + p);
  const chain = [1, 2, 3, 4, 5, 7, 8, 9]; for (let i = 1; i < chain.length; i++) expect(t[chain[i]].low === t[chain[i - 1]].high, 'contiguous ' + chain[i]);
  const m = chk().meta; expect(/symbolic/.test(m.frequency_status) && /not measured/.test(m.frequency_status) && m.harmonic_admits === false, 'symbolic label, no harmonic admit');
  expect(m.harmonic_weights.same === 1 && m.harmonic_weights.x3 === 0.3 && m.harmonic_weights.x9 === 0.1, 'weights');
});
T('the phase alone picks the band, and every item tunes to a symbolic Hz inside its band within the approved cap', () => {
  const c = chk();
  expect(c.tunes_in_band && c.tunes_r_ok && c.repeat_same, JSON.stringify({ i: c.tunes_in_band, r: c.tunes_r_ok, s: c.repeat_same }));
  expect(JSON.stringify(c.decimal_phase_band) === JSON.stringify([1, 1, 4, 9, 6, null, null, null]), 'band_of ' + JSON.stringify(c.decimal_phase_band));
  for (const r of c.sample) expect(r.epsilon === 0.02 && r.offset_cap === 0.4 && r.nudge_span === 0.45 && r.label === 'symbolic Hz (FBSC), not measured' && r.calls_llm === false, 'record');
  const bt = read('engine/rmc_engine_v1/band_tuning.py');
  expect(/from rmc_engine_v1\.frequency_203_config import EPSILON, NUDGE_SPAN, OFFSET_CAP/.test(bt) && !/^\s*[A-Za-z_]+\s*=\s*0\.(02|40?|45)\b/m.test(bt), 'constants imported, not restated');
  expect(!/What is|Why is|capital|Moon|Burkina|kara|karta|concept/.test(bt.replace(/"""[\s\S]*?"""/g, '')), 'no question list, no role or concept input');
});
T('cross-band relations follow the 144/n markers: ×3 and ×9 pairs, everything else none', () => {
  const r = chk().relations;
  const x3 = ['1-3', '1-4', '2-5', '3-7', '4-6', '4-8', '5-6', '5-8', '8-9'], x9 = ['1-7', '2-8', '4-9', '6-8'];
  for (const [k, v] of Object.entries(r)) expect(v === (x3.includes(k) ? 'x3' : x9.includes(k) ? 'x9' : 'none'), k + ' ' + v);
});
T('rank_memory: same band outranks a harmonic band at equal grace; a harmonic-only row is never active', () => {
  const c = chk(), r = c.recall;
  // 4.9.238 (Nic, Memory Phase Invariance): Φ_query is the retrieval operation (Φ7), not the text's Φ9 (kept for band tuning).
  // At equal structure ΔΦ to Φ7 orders the rows: b-z (Φ8.5, 60°, A 0.75) before b-a (Φ9.5, 100°). A row whose phase is far
  // (b-h, Φ3) is no longer dropped: phase is a weight, never a veto, and the frame-role lock (S) is what admits it.
  expect(r.active[0] === 'b-z' && r.question_phi === 7 && r.tuning.band === '144 Hz carrier' && r.tuning.schema === 'FORGE-BAND-TUNING/v1', JSON.stringify(r).slice(0, 400));
  expect(r.evidence['b-z'].A === 0.75 && r.evidence['b-z'].question_text_phi === 9 && r.packets['b-z'].phase === 8 && r.packets['b-a'].phase === 9, 'packets carry Athena bands');
  expect(c.harmonic_only_active.length === 1 && c.harmonic_only_how === 'frame_role', 'a far phase never vetoes');
  const rr = read('engine/rmc_engine_v1/resonance_recall.py');
  expect(/_resonance\(row\[2\]\), _band_key\(_band\(row\[0\]\)\["weight"\]\)\)/.test(rr) && /question_band = question_phi/.test(rr) && !/question_tuning import/.test(rr), 'wired; the ± offset retired');
  expect(/out\["band"\] = _band_tune\(clean_text\(row\)/.test(rr), 'Athena place_packet stores the band');
  expect(/question_tuning\.band/.test(read('src/app.js')) && /question_tuning\.label/.test(read('src/app.js')), 'card shows band and symbolic label');
});
T('what stays: Ask ε /3, definition-first rank, relation Echo; the math, remembered-fact and Dry-Run paths work', () => {
  const c = chk();
  expect(/epsilon_s = round\(\(sigma_res \+ d_score \+ delta_phi\) \/ 3\.0, 4\)/.test(read('engine/rmc_engine_v1/drift_engine.py')), '/3');
  expect(c.dna.product_reply && /^DNA, or deoxyribonucleic acid/.test(c.dna.reply) && c.dna.relation.realised === true, 'definition first');
  expect(!c.moon.product_reply && c.moon.relation.realised === false, 'relation Echo holds a mention');
  expect(c.sky.product_reply && c.math.reply === '17 times 23 is 391.' && c.convert.reply === '5 miles is 8.04672 km.' && c.car.reply === 'My car is red.', 'paths');
  for (const k of ['dry_math', 'dry_sky']) expect(c[k].product_reply === false && c[k].writes === false && c[k].calls_llm === false, k);
});
T('the cold 60 for 4.9.219 is recorded (not tuned): zero false admits and no admit lost against 4.9.218', () => {
  const c = JSON.parse(read('data/cold_219_results.json')), p = JSON.parse(read('data/cold_218_results.json'));
  expect(c.release === '4.9.219' && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.calls_llm === false && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, f: c.false_admits }));
  const old = Object.fromEntries(p.rows.map(r => [r.question, r]));
  for (const r of c.rows) expect(!(old[r.question] && old[r.question].admitted && !r.admitted), 'lost admit: ' + r.question);
  expect(c.admitted >= p.admitted, 'admits');
});
T('version registry names 4.9.219', () => {
  expect(read('VERSION').trim() === '4.9.242', 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4219-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4219', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4219', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
