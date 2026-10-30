/* R4118 (4.9.118): math honesty offline research. Written FIRST.
 * The harness is research-only. It does not change Nic's Mobile drift write law.
 * ROC/CFBC/RSOC manuscript equivalence stays SOURCE_NOT_VERIFIED.
 * Dream/SPC and creative writing are not this release. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [], rows = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const KM = require(ROOT + '/src/kmath.js');

function loadHarness() {
  const p = ROOT + '/research/math_honesty.js';
  if (!fs.existsSync(p)) throw new Error('research/math_honesty.js missing');
  return require(p);
}

T('drift n and rho stay distinguished and are not a manuscript identity', () => {
  const H = loadHarness();
  const report = H.run();
  expect(report.schema === 'FORGE-MATH-HONESTY/v1', report.schema);
  expect(report.product_claim === false && report.proven_cognition === false, 'product claim');
  expect(report.honesty && report.honesty.manuscript === 'SOURCE_NOT_VERIFIED' && report.honesty.research_only === true && report.honesty.phase_scheme === 'reconstruction', JSON.stringify(report.honesty));
  const eq = report.manuscript_equivalence;
  expect(eq && eq.ok === false && eq.status === 'SOURCE_NOT_VERIFIED' && eq.equivalent === false && eq.rule === 'I.1', JSON.stringify(eq));
  expect(report.drift && report.drift.distinguished === true && report.drift.equivalent === false, JSON.stringify(report.drift && { distinguished: report.drift.distinguished, equivalent: report.drift.equivalent }));
  const forms = report.drift.formulations || [];
  const rho = forms.find(f => f.id === 'rho');
  const n3 = forms.find(f => f.id === 'n3');
  const noted = forms.find(f => f.id === 'rsoc-n');
  expect(rho && rho.executed === true && rho.contract === 'drift-measure/addendum-3/v1', JSON.stringify(rho));
  expect(n3 && n3.executed === true && n3.divisor === 3, JSON.stringify(n3));
  expect(noted && noted.executed === false && noted.status === 'SOURCE_NOT_VERIFIED', JSON.stringify(noted));
  const live = KM.driftFunctional({ phaseHistory: [9, 1, 2, 8], transition: { from: 5, to: 8, expected: 6 }, depth: 5 });
  const epsN3 = KM.r4((live.sigma_res + live.D_score + live.dPhi) / 3);
  const row = (report.drift.cases || []).find(c => c.id === 'depth-5');
  expect(row && row.divisor_rho === 5 && row.divisor_n3 === 3 && row.eps_rho === live.eps_s && row.eps_n3 === epsN3, JSON.stringify(row));
  expect(row.eps_rho !== row.eps_n3 && row.band_if_rho !== row.band_if_n3, JSON.stringify(row));
  expect(row.applied_to_write_law === false && row.live_measure === 'rho', JSON.stringify(row));
  expect(row.honesty === 'research-only' && row.manuscript === 'SOURCE_NOT_VERIFIED', JSON.stringify(row));
  const same = (report.drift.cases || []).find(c => c.id === 'depth-3');
  expect(same && same.divisor_rho === 3 && same.eps_rho === same.eps_n3, JSON.stringify(same));
  expect(report.drift.ede && report.drift.ede.executed === true && report.drift.ede.n === 3 && report.drift.ede.equivalent_to_addendum_rho === false, JSON.stringify(report.drift.ede));
  expect(report.drift.static_n3 && report.drift.static_n3.every(s => s.stamps_n_3 === true && s.uses_driftFunctional === false), JSON.stringify(report.drift.static_n3));
  expect(report.mobile_write_law && report.mobile_write_law.project_max === 0.35 && report.mobile_write_law.unchanged === true && report.mobile_write_law.paper_0_4_0_8_adopted === false, JSON.stringify(report.mobile_write_law));
});

T('phase ablation stubs stay unmeasured reconstructions', () => {
  const H = loadHarness();
  const report = H.run();
  const stubs = report.phase_ablation || [];
  expect(stubs.length === 9, 'stubs ' + stubs.length);
  expect(KM.PHASES[1].name === 'Initiation Pulse' && KM.PHASES[1].glyph === '⊙' && KM.PHASES[9].name === 'Recursive Evolution' && KM.PHASES[8].name === 'Power', 'codex phases');
  expect(KM.PHASE_RECONCILIATION.length === 9 && KM.PHASE_RECONCILIATION.every(row => row.authority.indexOf('Codex') >= 0), 'each role change is listed');
  expect(KM.PAPER_CONSTANTS.phi_to_angle.status === 'unspecified' && KM.PAPER_CONSTANTS.mu.value === 'unspecified' && KM.PAPER_CONSTANTS.integrity_example.C_min === 0.87, 'unstated constants stay unspecified');
  for (let i = 0; i < stubs.length; i++) {
    const s = stubs[i];
    expect(s.phase === i + 1 && s.measured === false && s.status === 'stub' && s.delta_eps === null, JSON.stringify(s));
    expect(s.phase_scheme_status === 'reconstruction' && s.manuscript_equivalence === 'SOURCE_NOT_VERIFIED' && s.honesty === 'research-only' && s.proven_cognition === false, JSON.stringify(s));
    expect(s.symbol === KM.PHASES[s.phase].sym, s.symbol);
  }
  expect(report.proven_cognition === false, 'proven cognition');
});

T('echo false rates on recorded surfaces stay research-only', () => {
  const H = loadHarness();
  const fixture = JSON.parse(fs.readFileSync(ROOT + '/research/lc_surfaces.json', 'utf8'));
  expect(fixture.schema === 'FORGE-LC-SURFACE-RECORD/v1', fixture.schema);
  expect(fixture.honesty && fixture.honesty.manuscript === 'SOURCE_NOT_VERIFIED' && fixture.honesty.research_only === true, JSON.stringify(fixture.honesty));
  expect(fixture.surfaces.some(s => s.expected_pass === true) && fixture.surfaces.some(s => s.expected_pass === false), 'both classes');
  const report = H.run();
  const echo = report.echo;
  expect(echo && echo.honesty === 'research-only' && echo.manuscript === 'SOURCE_NOT_VERIFIED' && echo.product_claim === false, JSON.stringify(echo && { honesty: echo.honesty, manuscript: echo.manuscript, product_claim: echo.product_claim }));
  expect(echo.surfaces === fixture.surfaces.length && echo.rows.length === fixture.surfaces.length, echo.surfaces + '/' + fixture.surfaces.length);
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const row of echo.rows) {
    const src = fixture.surfaces.find(s => s.id === row.id);
    expect(src && row.expected_pass === src.expected_pass && row.recorded_in === src.recorded_in, row.id);
    expect(row.actual_pass === row.expected_pass, row.id + ' ' + row.actual_pass);
    if (row.expected_pass && row.actual_pass) tp++;
    else if (row.expected_pass && !row.actual_pass) fn++;
    else if (!row.expected_pass && row.actual_pass) fp++;
    else tn++;
  }
  const pos = tp + fn, neg = tn + fp;
  expect(echo.false_positive === fp && echo.false_negative === fn && echo.true_positive === tp && echo.true_negative === tn, JSON.stringify(echo));
  expect(echo.false_positive_rate === (neg ? fp / neg : null) && echo.false_negative_rate === (pos ? fn / pos : null), 'rates');
  expect(echo.false_positive === 0 && echo.false_negative === 0 && pos > 0 && neg > 0, JSON.stringify({ tp, tn, fp, fn }));
  expect(echo.shared_kb_writes === 0, 'shared KB');
  const LEX = require(ROOT + '/data/lexicon.json');
  const EXT = require(ROOT + '/data/lexicon-ext.json');
  const KMOD = require(ROOT + '/src/kernel.js');
  const posRow = fixture.surfaces.find(s => s.id === 'LC-REMEMBER');
  const negRow = fixture.surfaces.find(s => s.id === 'LC-REMEMBER-FAULT');
  const fresh = KMOD.Kernel({ clock: () => '2026-10-27T15:00:00Z', lexicon: LEX, lexiconExt: EXT });
  const faulted = KMOD.Kernel({ clock: () => '2026-10-27T15:00:00Z', lexicon: LEX, lexiconExt: EXT, renderFault: t => String(t).split(negRow.fault.from).join(negRow.fault.to) });
  expect(fresh.process(posRow.utterance).trace.echo.pass === true, 'recorded pass');
  const denied = faulted.process(negRow.utterance);
  expect(denied.trace.echo.pass === false && denied.blocked === true && faulted.memory().length === 0, 'recorded fault');
  expect((fresh.store.load('shared_knowledge') || []).length === 0, 'fresh shared');
});

T('mobile drift gates stay Nic 0.35 and are not the paper bands', () => {
  expect(KM.DRIFT_RULING.project_max === 0.35 && KM.DRIFT_RULING.explore_min === 0.4 && KM.DRIFT_RULING.explore_max === 0.8, JSON.stringify(KM.DRIFT_RULING));
  const at = eps => KM.turnGovernance(eps);
  expect(at(0.35).may_write_memory === true && at(0.35).may_project === true && at(0.35).route === 'project', JSON.stringify(at(0.35)));
  expect(at(0.36).needs_correction === true && at(0.36).may_write_memory === false && at(0.36).route === 'correct', JSON.stringify(at(0.36)));
  expect(at(0.40).route === 'quarantine' && at(0.40).may_write_memory === false && at(0.80).route === 'quarantine', JSON.stringify(at(0.40)));
  expect(at(0.81).route === 'hard_stop' && at(0.81).may_write_memory === false, JSON.stringify(at(0.81)));
  const H = loadHarness();
  const law = H.run().mobile_write_law;
  expect(law.project_max === 0.35 && law.chi_below === 0.4 && law.quarantine_max === 0.8 && law.hard_stop_above === 0.8 && law.unchanged === true, JSON.stringify(law));
  expect(law.paper_0_4_0_8_adopted === false && law.paper_0_50_0_78_0_80_adopted === false, JSON.stringify(law));
});

T('the research tool prints json and markdown outside the single-file app', () => {
  const cli = path.join(ROOT, 'tools', 'math_honesty.js');
  expect(fs.existsSync(cli), 'CLI missing');
  const jsonRun = cp.spawnSync('node', [cli], { cwd: ROOT, encoding: 'utf8' });
  expect(jsonRun.status === 0, jsonRun.stderr || jsonRun.stdout);
  const report = JSON.parse(jsonRun.stdout);
  expect(report.schema === 'FORGE-MATH-HONESTY/v1' && report.honesty.manuscript === 'SOURCE_NOT_VERIFIED' && report.honesty.research_only === true, jsonRun.stdout.slice(0, 240));
  const mdRun = cp.spawnSync('node', [cli, '--md'], { cwd: ROOT, encoding: 'utf8' });
  expect(mdRun.status === 0 && /SOURCE_NOT_VERIFIED/.test(mdRun.stdout) && /research-only/.test(mdRun.stdout) && /reconstruction/.test(mdRun.stdout), mdRun.stdout.slice(0, 240));
  expect(/not proven cognition/.test(mdRun.stdout) && /0\.35/.test(mdRun.stdout), 'md law');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-math-'));
  const write = cp.spawnSync('node', [cli, '--write', dir], { cwd: ROOT, encoding: 'utf8' });
  expect(write.status === 0, write.stderr);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'math_honesty.json'), 'utf8'));
  const savedMd = fs.readFileSync(path.join(dir, 'MATH_HONESTY.md'), 'utf8');
  expect(saved.schema === report.schema && /SOURCE_NOT_VERIFIED/.test(savedMd), 'written artifacts');
  const page = fs.readFileSync(ROOT + '/index.html', 'utf8');
  const sw = fs.readFileSync(ROOT + '/sw.js', 'utf8');
  const ship = require(ROOT + '/tools/shipset.js').list(ROOT);
  expect(!page.includes('research/math_honesty.js') && !sw.includes('research/math_honesty.js') && !ship.includes('research/math_honesty.js'), 'bundled');
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/Math honesty/.test(app) && /manuscript equivalence/.test(app) && /not proven cognition/.test(app), 'status');
  expect(/SOURCE_NOT_VERIFIED/.test(app) && /0\.35/.test(app) && /0\.40/.test(app) && /0\.80/.test(app), 'math note');
  const committed = JSON.parse(fs.readFileSync(ROOT + '/research/math_honesty.json', 'utf8'));
  expect(JSON.stringify(committed) === JSON.stringify(report), 'committed json drifted');
  expect(fs.readFileSync(ROOT + '/research/MATH_HONESTY.md', 'utf8') === mdRun.stdout, 'committed md drifted');
});

T('version, registry, CONFLICTS, and NEXT_BUILD name 4.9.118 and leave dream and creative writing unstarted', () => {
  const ver = fs.readFileSync(ROOT + '/VERSION', 'utf8').trim();
  const parts = ver.split('.').map(part => parseInt(part, 10));
  expect(parts[0] === 4 && parts[1] === 9 && parts[2] >= 118, ver);
  const reg = JSON.parse(fs.readFileSync(ROOT + '/data/feature_registry.json', 'utf8'));
  expect(reg.version === ver && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  for (const id of ['R4118-DRIFT', 'R4118-ABLATE', 'R4118-ECHO']) {
    const f = reg.features.find(x => x.id === id);
    expect(f && f.claim === 'Partial' && (f.proof || []).includes('R4118') && /4\.9\.118/.test(f.note), id);
    expect(f && /research-only/.test(f.note) && !/Christ function/i.test(f.note), id + ' ' + (f && f.note));
  }
  const a11 = reg.features.find(x => x.id === 'A-11');
  expect(a11 && a11.claim === 'Partial' && /4\.9\.117/.test(a11.note) && /4\.9\.118/.test(a11.note) && /suite level/.test(a11.note), a11 && a11.note);
  const tally = {}; for (const f of reg.features) tally[f.claim] = (tally[f.claim] || 0) + 1;
  expect(reg.claims.Implemented === 112 && reg.claims.Partial === tally.Partial + 1, JSON.stringify(reg.claims) + ' ' + tally.Partial);
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const at = cf.lastIndexOf('## v4.9.118');
  const nxt = cf.indexOf('\n## v', at + 12);
  const sec = cf.slice(at, nxt === -1 ? undefined : nxt);
  expect(/SOURCE_NOT_VERIFIED/.test(sec) && /research-only/.test(sec) && /reconstruction/.test(sec), 'labels');
  expect(/0\.35/.test(sec) && /manuscript equivalence/.test(sec) && /n = 3/.test(sec), 'law');
  expect(/dream/.test(sec) && /creative writing/.test(sec) && /not started|do not start/.test(sec), 'queue');
  expect(/shared KB stays empty|Shared KB stays empty/.test(sec) && !/Christ function/i.test(sec), 'shared');
  const next = fs.readFileSync(ROOT + '/../NEXT_BUILD.md', 'utf8');
  expect(/4\.9\.118/.test(next) && /math honesty/.test(next) && /dream/.test(next) && /creative writing/.test(next) && /Genesis/.test(next), 'NEXT_BUILD');
  expect(/do not start/i.test(next), 'next fence');
  const readme = fs.readFileSync(ROOT + '/../README.md', 'utf8');
  expect(/4\.9\.118/.test(readme) && /4\.9\.117/.test(readme) && /research/.test(readme) && /0\.35/.test(readme), 'README');
  expect(!/false_positive_rate|failing-first|bot instruction/i.test(readme), 'README product');
  const targeted = JSON.parse(fs.readFileSync(ROOT + '/verify/targeted.json', 'utf8'));
  const tp = String(targeted.release || '').split('.').map(part => parseInt(part, 10));
  expect(tp[0] === 4 && tp[1] === 9 && tp[2] >= 118 && targeted.suites.includes('r4118_suite.js') && targeted.suites.includes('r4117_suite.js'), targeted.release);
  expect(!fs.existsSync(ROOT + '/src/creative.js'), 'creative writing started');
  const RP = require(ROOT + '/src/req_packet.js');
  const slice = RP.packet('4.9.118');
  expect(slice && slice.requirements.some(r => r.id === 'R4118-NONEQ'), JSON.stringify(slice && slice.requirements.map(r => r.id)));
  expect(RP.linksMissing(ROOT).length === 0, RP.linksMissing(ROOT).join(' '));
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  expect(/KReqPacket\.auditCard/.test(app), 'audit');
  expect(/R4118-NONEQ/.test(RP.auditCard()), RP.auditCard());
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4118', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4118', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
