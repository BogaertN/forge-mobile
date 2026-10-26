/* R4109 (4.9.109): versioned RSOC operators.
 * A MathContractRegistry lists each formula with a stable id and version.
 * A turn cites the versions it ran. ROC ≡ CFBC ≡ RSOC stays SOURCE_NOT_VERIFIED.
 * The live write law stays Nic's 0.35 table. χ stays the correction function.
 * Written FIRST (failing). */
const fs = require('fs');
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js');
const M = require(ROOT + '/src/kmath.js');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = extra => KMOD.Kernel(Object.assign({ lexicon: require(ROOT + '/data/lexicon.json'), lexiconExt: require(ROOT + '/data/lexicon-ext.json'), clock: () => '2026-10-26T06:40:00Z' }, extra || {}));
const sharedN = k => (k.store.load('shared_knowledge') || []).length;
const SHOWN = 'I derived 1 hypothesis from the problem: (1) “144 Hz is a substrate (fundamental) frequency”. I have not stored the problem. I can only seal it after your confirmation. I archived 4 candidates.';
const WANT = [
  ['drift-measure', 'addendum-3/v1'],
  ['drift-table', 'nic-2026-10-14/v1'],
  ['chi-correction', 'R-CHI-1/v1'],
  ['chi-invoke', 'R-CHI-1/invoke/v1'],
  ['rsoc-select', 'RSOC/v1'],
  ['phase-scheme', 'rmc-rpmc/v1']
];
const has = (list, id, version) => (list || []).some(c => c && c.id === id && c.version === version);

T('the registry cites each operator, and an equivalence claim is refused', () => {
  expect(M.MATH_CONTRACTS && M.MATH_CONTRACTS.schema === 'FORGE-MATH-CONTRACT/v1', 'no MathContractRegistry');
  expect(M.MATH_CONTRACTS.phase_scheme_id === 'phase-scheme/rmc-rpmc/v1' && M.MATH_CONTRACTS.phase_scheme_status === 'reconstruction', JSON.stringify({ id: M.MATH_CONTRACTS.phase_scheme_id, status: M.MATH_CONTRACTS.phase_scheme_status }));
  for (const [id, version] of WANT) {
    const e = M.contract(id);
    expect(e && e.id === id && e.version === version, id + ' ' + JSON.stringify(e));
  }
  expect(M.contract('phase-scheme').status === 'reconstruction', 'phase scheme claimed as a numerical identity');
  const d = M.driftFunctional({ phaseHistory: [9, 9], transition: { from: 7, to: 8, expected: 8 }, depth: 0 });
  expect(d.eps_s === 0 && d.rho === 1, 'drift numbers moved: ' + d.eps_s + ' rho ' + d.rho);
  expect(d.contract && d.contract.id === 'drift-measure' && d.contract.version === 'addendum-3/v1', JSON.stringify(d.contract));
  expect(d.table && d.table.id === 'drift-table' && d.table.version === 'nic-2026-10-14/v1', JSON.stringify(d.table));
  expect(M.DRIFT_RULING.project_max === 0.35 && M.DRIFT_RULING.explore_min === 0.4 && M.DRIFT_RULING.explore_max === 0.8, 'paper bands became the write law');
  const g = M.turnGovernance(0.2, null);
  expect(g.may_write_memory === true && g.band === 'clean' && g.contract && g.contract.id === 'drift-table' && g.contract.version === 'nic-2026-10-14/v1', JSON.stringify(g));
  const mid = M.turnGovernance(0.36, null);
  expect(mid.needs_correction === true && mid.may_write_memory === false && mid.band === 'correct', JSON.stringify(mid));
  const q = M.turnGovernance(0.5, null);
  expect(q.route === 'quarantine' && q.may_write_memory === false && q.band === 'elevated', JSON.stringify(q));
  const hard = M.turnGovernance(0.81, null);
  expect(hard.blocked === true && hard.band === 'hard_stop' && hard.may_write_memory === false, JSON.stringify(hard));
  const chi = M.chiCorrect({ eps: 0.36, ancestors: [{ Phi: 1, eps: 0, mu: 1 }] });
  expect(chi.contract && chi.contract.id === 'chi-correction' && chi.contract.version === 'R-CHI-1/v1', JSON.stringify(chi.contract));
  const inv = M.chiConditions({ eps_s: 0.9, echoTrace: true, chiFlag: 0, dPhiAvg: 0, forbidden: false });
  expect(inv.contract && inv.contract.id === 'chi-invoke' && inv.contract.version === 'R-CHI-1/invoke/v1', JSON.stringify(inv.contract));
  const rs = M.rsocSelect({ D: true }, [{ id: 'name', expect: { D: 1 } }], 0);
  expect(rs.calculus === 'RSOC/v1' && rs.selected === 'name' && rs.contract && rs.contract.id === 'rsoc-select' && rs.contract.version === 'RSOC/v1', JSON.stringify(rs.contract) + ' ' + rs.selected);
  const eq = M.equivalenceClaim('ROC ≡ CFBC ≡ RSOC');
  expect(eq && eq.ok === false && eq.status === 'SOURCE_NOT_VERIFIED' && eq.equivalent === false && eq.rule === 'I.1', JSON.stringify(eq));
  const pair = M.equivalenceClaim('ROC is equivalent to CFBC');
  expect(pair && pair.ok === false && pair.status === 'SOURCE_NOT_VERIFIED' && pair.equivalent === false, JSON.stringify(pair));
  const plain = M.equivalenceClaim('the write law is 0.35');
  expect(plain && plain.ok === true && plain.status === 'not_an_equivalence_claim' && plain.equivalent === false, JSON.stringify(plain));
});
T('a turn cites the operator versions that ran', () => {
  const k = mk();
  const r = k.process('hello');
  expect(r.trace && r.trace.drift && r.trace.drift.contract && r.trace.drift.contract.id === 'drift-measure' && r.trace.drift.contract.version === 'addendum-3/v1', JSON.stringify(r.trace && r.trace.drift && r.trace.drift.contract));
  expect(r.trace.rsoc && r.trace.rsoc.calculus === 'RSOC/v1' && r.trace.rsoc.contract && r.trace.rsoc.contract.id === 'rsoc-select' && r.trace.rsoc.contract.version === 'RSOC/v1', JSON.stringify(r.trace.rsoc && r.trace.rsoc.contract));
  expect(has(r.trace.math_contracts, 'drift-measure', 'addendum-3/v1') && has(r.trace.math_contracts, 'drift-table', 'nic-2026-10-14/v1') && has(r.trace.math_contracts, 'rsoc-select', 'RSOC/v1') && has(r.trace.math_contracts, 'phase-scheme', 'rmc-rpmc/v1'), JSON.stringify(r.trace.math_contracts));
  expect(r.trace.phase_scheme_id === 'phase-scheme/rmc-rpmc/v1', String(r.trace.phase_scheme_id));
  expect(!/Christ function/i.test(JSON.stringify({ c: r.trace.math_contracts, d: r.trace.drift.contract, s: r.trace.rsoc.contract })), 'Christ function on the trace');
  expect(sharedN(k) === 0, 'shared KB written');
  const k2 = mk({ testDrift: () => 0.36 });
  const r2 = k2.process('hello');
  expect(r2.trace.drift.band === 'correct' && r2.trace.drift.governance && r2.trace.drift.governance.needs_correction === true && r2.trace.drift.governance.may_write_memory === false, JSON.stringify(r2.trace.drift.governance));
  expect(r2.trace.correction && r2.trace.correction.contract && r2.trace.correction.contract.id === 'chi-correction' && r2.trace.correction.contract.version === 'R-CHI-1/v1', JSON.stringify(r2.trace.correction && r2.trace.correction.contract));
  expect(has(r2.trace.math_contracts, 'chi-correction', 'R-CHI-1/v1'), JSON.stringify(r2.trace.math_contracts));
  expect(sharedN(k2) === 0, 'shared KB written on correction');
  const k3 = mk({ testDrift: () => 0.9 });
  const r3 = k3.process('hello');
  expect(r3.trace.drift.governance && r3.trace.drift.governance.blocked === true && r3.trace.drift.governance.band === 'hard_stop', JSON.stringify(r3.trace.drift.governance));
  expect(r3.trace.chi && r3.trace.chi.contract && r3.trace.chi.contract.id === 'chi-invoke' && r3.trace.chi.contract.version === 'R-CHI-1/invoke/v1', JSON.stringify(r3.trace.chi && r3.trace.chi.contract));
  expect(has(r3.trace.math_contracts, 'chi-invoke', 'R-CHI-1/invoke/v1'), JSON.stringify(r3.trace.math_contracts));
  expect(sharedN(k3) === 0, 'shared KB written on hard stop');
});
T('the math note does not present Addendum bands or an equivalence as the write law', () => {
  const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8');
  const at = app.indexOf("$('#mathDoc')");
  const doc = app.slice(at, at + 1600);
  expect(/SOURCE_NOT_VERIFIED/.test(doc), 'mathDoc does not label the equivalence');
  expect(/drift-measure/.test(doc) && /addendum-3\/v1/.test(doc), 'drift-measure version missing from mathDoc');
  expect(/drift-table/.test(doc) && /nic-2026-10-14\/v1/.test(doc), 'drift-table version missing from mathDoc');
  expect(/R-CHI-1\/v1/.test(doc) && /correction function/.test(doc), 'χ correction version missing from mathDoc');
  expect(/0\.35/.test(doc) && /0\.40/.test(doc) && /0\.80/.test(doc), 'Nic edges missing from mathDoc');
  expect(!/bands 0\.50 \/ 0\.78 \/ 0\.80/.test(doc), 'mathDoc still presents the Addendum bands as the live bands');
  expect(!/Christ function/i.test(doc), 'Christ function in mathDoc');
  const lab = fs.readFileSync(ROOT + '/src/app_lab.js', 'utf8');
  expect(!/app bands 0\.50 \/ 0\.78 \/ 0\.80/.test(lab), 'the lab still calls 0.50 / 0.78 / 0.80 the app bands');
  expect(/SOURCE_NOT_VERIFIED/.test(lab) && /nic-2026-10-14\/v1/.test(lab), 'the lab does not label the equivalence or the live table');
  const cf = fs.readFileSync(ROOT + '/CONFLICTS.md', 'utf8');
  const sec = cf.slice(cf.lastIndexOf('## v4.9.109'));
  expect(/I\.1/.test(sec) && /SOURCE_NOT_VERIFIED/.test(sec) && /0\.35/.test(sec) && /R-CHI-1\/v1/.test(sec), 'CONFLICTS I.1 section missing');
});
T('guards: the 144 Hz propose, a remember, and the 0.35 write law', () => {
  const k = mk();
  const p = k.process('propose problem physics');
  expect(p.reply === SHOWN, p.reply);
  expect(p.trace.intent_kind === 'PROPOSE_EVIDENCE', p.trace.intent_kind);
  const r = k.process('remember that my car is red');
  expect(r.trace.intent_kind === 'REQUEST_COMMIT' && r.reply === 'I noted that your car is red.', (r.trace.intent_kind || '') + ' ' + r.reply);
  expect(sharedN(k) === 0, 'shared KB written');
  expect(M.DRIFT_RULING.project_max === 0.35, 'project_max moved');
  expect(!/Christ function/i.test(fs.readFileSync(ROOT + '/src/kmath.js', 'utf8')), 'Christ function in kmath');
});

(async () => {
  let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4109', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4109', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 0));
  process.exit(failed ? 1 : 0);
})();
