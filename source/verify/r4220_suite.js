/* R4220 (4.9.220): Athena places each fact she writes (DRIFT-SPEC/v1 D16, Nic 2026-11-04 t132u).
 * 1. The integer phase comes from the fact's content: the lexicon concept packet, else the letter resultant (self_seed placement).
 * 2. The band comes from that phase alone (D15). The decimal is where the fact's symbolic Hz sits in its band:
 *    Φ = band + (hz − low)/(high − low), so band_of(Φ) gives the band back. No per-question table.
 * 3. Self-seed anchors (Python and JS, in parity) and dream_idle promotes carry band + placement; kpacks keeps a
 *    self-consistent placement and drops anything else.
 * 4. Gates unchanged: ε_s ≤ 0.35, Echo 0.97 for memory writes, server recomputes ε, Ask ε /3; the gate's sfe.Phi unchanged.
 * 5. No bulk fill; no live write. Hz symbolic, not measured. No LLM, no network. */
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
const chk = () => (C = C || py(['tools/check_220.py']));
const B = require(path.join(ROOT, 'src/band_tuning.js'));
const S = require(path.join(ROOT, 'src/self_seed_202.js'));

T('a fact gets a decimal phase from its own content, inside the band its phase picks', () => {
  const c = chk();
  for (const [ph, r] of Object.entries(c.by_phase)) expect(r.band_of === Number(ph) && r.in && r.Phi > Number(ph) && r.Phi < Number(ph) + 1, 'phase ' + ph + ' ' + JSON.stringify(r));
  const phases = new Set(c.places.filter(p => p.text).map(p => p.phase));
  expect(phases.size >= 4, 'different facts land in different bands: ' + [...phases]);
  for (const p of c.places) expect(B.bandOf(p.Phi) === p.phase && Math.trunc(p.Phi) === p.phase, 'sector ' + p.text);
  const bt = read('engine/rmc_engine_v1/band_tuning.py');
  expect(!/Moon|Burkina|Mercury|gravity|What is/.test(bt.replace(/"""[\s\S]*?"""/g, '')), 'no per-question or per-subject table');
});
T('the JS port gives the same band, Hz and decimal phase as Python', () => {
  const c = chk();
  for (const p of c.places) {
    const where = S.placement(p.text); const phi = where.phi || 1;
    expect(where.phi === p.phase_int || (where.phi == null && p.phase_int == null), 'placement ' + p.text + ' ' + where.phi + ' vs ' + p.phase_int);
    const j = B.place(p.text, phi);
    expect(j.Phi === p.Phi && j.band.hz === p.hz && j.band.band === p.band, p.text + ' ' + JSON.stringify([j.Phi, j.band.hz, p.Phi, p.hz]));
  }
  expect(B.pyRound(6.29625, 4) === 6.2962 && B.pyRound(0.125, 2) === 0.12 && B.pyRound(0.375, 2) === 0.38 && B.pyRound(-2.5, 0) === -2, 'Python round()');
});
T('self-seed anchors and dream_idle promotes store the band and placement; the gate phase is unchanged', () => {
  const a = chk().anchor_packet;
  expect(a.sfe_Phi === 6 && a.band === 'Theta-alpha blend' && a.placement.schema === 'FORGE-FACT-PLACEMENT/v1' && a.placement.phase === 6 && a.placement.Phi === 6.6667, JSON.stringify(a).slice(0, 300));
  const D = require(path.join(ROOT, 'src/dream_idle.js'));
  const p = D.factPlacement('Ouagadougou is the capital of Burkina Faso.');
  expect(p && p.Phi === 6.6667 && p.band.band === 'Theta-alpha blend', 'dream_idle placement');
  const rp = D.resonancePacket({ eps: 0.1, integrity: 0.9 }, 'projectable');
  expect(rp.sfe.Phi === 9 && !('placement' in rp), 'gate packet unchanged');
  const di = read('src/dream_idle.js');
  expect(/placement: factPlacement\(claim\), sfe: \{ Phi: pkt\.sfe\.Phi/.test(di) && /placement: factPlacement\(claim\)\n/.test(di), 'promote item and hosted item carry placement');
  expect(/band: BandTuning\(\)\.tune\(row\.text, sfe\.Phi\)/.test(read('src/self_seed_202.js')) && /"placement": _band_place\(row\["text"\], sfe\["Phi"\]/.test(read('engine/rmc_engine_v1/self_seed_202.py')), 'self-seed both runtimes');
  expect(/src\/band_tuning\.js/.test(read('index.html')) && /band_tuning\.js/.test(read('sw.js')), 'shipped');
});
T('kpacks keeps a self-consistent placement and drops a forged one', () => {
  const K = read('src/kpacks.js');
  const m = K.match(/function lawfulPlacement\(p\) \{[\s\S]*?\n  \}/); expect(m, 'lawfulPlacement');
  const lawful = new Function(m[0] + '; return lawfulPlacement;')();
  const good = B.place('Lima is the capital of Peru.', 1);
  expect(lawful(good) && lawful(good).Phi === good.Phi, 'good kept');
  expect(lawful(Object.assign({}, good, { Phi: 4.2 })) === null && lawful(Object.assign({}, good, { schema: 'x' })) === null && lawful(null) === null, 'forged dropped');
  expect(/if \(row\.placement\) fact\.placement = row\.placement;/.test(K), 'fact keeps it');
});
T('gates unchanged: eps_s 0.35, Echo 0.97 memory writes, server recompute, Ask /3', () => {
  const w = read('../supabase/functions/memory-writer/writer.js');
  expect(/ADMIT_MAX: 0\.35/.test(w) && /ECHO_MEMORY_MIN: 0\.97/.test(w) && /KB-WRITER-EPS-MISMATCH/.test(w), 'writer');
  expect(/epsilon_s = round\(\(sigma_res \+ d_score \+ delta_phi\) \/ 3\.0, 4\)/.test(read('engine/rmc_engine_v1/drift_engine.py')), '/3');
  expect(!/placement/.test(w), 'the writer does not read placement');
});
T('the Athena dry-run on real gaps writes nothing and only places sourced sentences', () => {
  const t = read('tools/athena_dryrun_220.py');
  expect(/"writes": False/.test(t) && !/insert into|upsert|writeShared|execute_sql|urlopen\(.*method=.POST/i.test(t), 'no writes');
  const d = JSON.parse(read('data/athena_dryrun_220.json'));
  expect(d.length >= 4 && d.every(r => r.writes === false && r.calls_llm === false), 'recorded');
  for (const r of d) if (r.anchor) expect(r.anchor.hosts && r.anchor.hosts.length >= 2 && !/wikipedia/.test(r.anchor.source_url), 'sourced');
});
T('the cold 60 for 4.9.220 is recorded (not tuned): zero false admits and no admit lost against 4.9.219', () => {
  const c = JSON.parse(read('data/cold_220_results.json')), p = JSON.parse(read('data/cold_219_results.json'));
  expect(c.release === '4.9.220' && c.tuned === false && c.of === 60 && c.false_admits === 0 && c.admitted + c.held === 60, JSON.stringify({ a: c.admitted, f: c.false_admits }));
  const old = Object.fromEntries(p.rows.map(r => [r.question, r]));
  for (const r of c.rows) expect(!(old[r.question] && old[r.question].admitted && !r.admitted), 'lost admit: ' + r.question);
});
T('version registry names 4.9.220', () => {
  expect(read('VERSION').trim() === '4.9.233', 'VERSION');
  expect(JSON.stringify(JSON.parse(read('data/feature_registry.json'))).indexOf('R4220-') >= 0, 'registry');
});
(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4220', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4220', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
