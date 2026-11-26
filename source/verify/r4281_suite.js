/* 4.9.259: Gilligan admits a clean rule. A later counterexample archives it. These sentences are not the held-out set. */
const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const L = require(ROOT + '/src/learning.js');
const WF = require(ROOT + '/src/world_facts.js');
const M = require(ROOT + '/src/mirror.js');
function forge() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T00:00:00Z' }); }
function ask(q, phone, extra) {
  const f = forge();
  const py = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\np=json.load(sys.stdin)\nr=run(p)\nd=(r.get("world_model") or {}).get("derive") or {}\ns=(d.get("survivor") or {})\natoms=s.get("spoken_atoms") or []\nprint(json.dumps({"reply":r.get("reply"),"product":r.get("product_reply"),"path":r.get("answer_path"),"derived":d.get("derived_text"),"learning":d.get("learning"),"conclusion":atoms[-1] if atoms else None},default=str))';
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: t, source: 'phone_kb', trust: 'trusted' }));
  const frame = Object.assign({}, Q.compile(q, f), extra || {});
  const payload = CORE.withClauses({ question: q, frame: frame, live: true, memory: { phone: rows, pools: [] } }, Q, f);
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error((r.stderr || 'python').slice(-500));
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
function fact(text) {
  const f = forge();
  const clause = Q.clause(text, f);
  return { id: text, text: text, clause: clause, frame: clause };
}
function register(C, expect) {
  C('R4281', 'three verified cases propose a kind property and Gilligan refutes a counterexample', () => {
    L.clear();
    const rows = ['A beetle is an insect.', 'A beetle has wings.', 'A moth is an insect.', 'A moth has wings.', 'An ant is an insect.', 'An ant has wings.'].map(fact);
    const proposed = L.induce(rows);
    expect(proposed.length === 1 && proposed[0].support === 3 && proposed[0].status === 'proposal' && proposed[0].spoken_as_fact === false, JSON.stringify(proposed));
    const clean = L.gilligan(proposed[0], rows, []);
    expect(clean.status === 'validated' && clean.admitted === false, JSON.stringify(clean.status));
    const bad = rows.concat([fact('A louse is an insect.'), fact('A louse has no wings.')]);
    const refused = L.gilligan(proposed[0], bad, []);
    expect(refused.status === 'refuted' && refused.reason === 'counterexample_in_memory', JSON.stringify(refused));
  });
  C('R4281', 'Gilligan auto-admits a rule, Derive speaks it, and a counterexample archives it', () => {
    L.clear();
    const phone = ['A beetle is an insect.', 'A beetle has wings.', 'A moth is an insect.', 'A moth has wings.', 'An ant is an insect.', 'An ant has wings.', 'A flea is an insect.'];
    const spoken = ask('Does a flea have wings?', phone, {});
    expect(spoken.product === true && /wing/.test(spoken.reply || '') && /flea/.test(spoken.reply || ''), JSON.stringify(spoken));
    const wording = forge().outward(spoken.conclusion && spoken.conclusion.text, spoken.conclusion && spoken.conclusion.atom);
    expect(wording.ok === true, JSON.stringify({ step: wording.step, atom: spoken.conclusion && spoken.conclusion.atom, got: wording.clause_atom }));
    expect(spoken.learning && spoken.learning.applied && spoken.learning.applied.rule.support === 3, JSON.stringify(spoken.learning && spoken.learning.applied));
    const live = L.list().rules.find(r => r.id === 'kind-property:insect:wing');
    expect(live && live.status === 'admitted' && live.class === 'learned' && live.hosted === false && live.deleted === false && !live.valid_to, JSON.stringify(live && live.status));
    const held = ask('Does a flea have wings?', phone.concat(['A louse is an insect.', 'A louse has no wings.']), {});
    expect(held.product !== true, JSON.stringify(held));
    const retired = L.list().rules.find(r => r.id === 'kind-property:insect:wing');
    expect(retired && retired.status === 'archived' && retired.valid_to && retired.deleted === false, JSON.stringify(retired && { status: retired.status, valid_to: retired.valid_to, deleted: retired.deleted }));
    expect(L.ledger().some(e => e.rule === 'kind-property:insect:wing' && e.status === 'refuted'), JSON.stringify(L.ledger()));
    expect(L.admittedIds().indexOf('kind-property:insect:wing') < 0, 'archived rule is not admitted');
    const worker = fs.readFileSync(path.join(ROOT, 'src', 'py_worker.js'), 'utf8');
    const askFn = worker.slice(worker.indexOf('async function rmcAsk'), worker.indexOf('async function sim'));
    expect(/ensureRealizer\(arg\)/.test(askFn), 'the ask worker loads the realizer before Derive');
  });
  C('R4281', 'a failed phrasing becomes a frame proposal only after a held-out replay', () => {
    L.clear();
    const f = forge();
    const success = Q.clause('A beetle has wings.', f);
    const noted = L.noteCorrection('beetle wing', 'A beetle has wings.', success);
    expect(noted.ok === true && noted.proposal.status === 'proposal', JSON.stringify(noted));
    const heldOut = Q.clause('A moth has wings.', f);
    const bad = L.validateReplay(noted.proposal.id, 'moth', heldOut);
    expect(bad.ok === false && bad.proposal.status === 'refuted', JSON.stringify(bad.rule));
    L.noteCorrection('beetle wing', 'A beetle has wings.', success);
    const good = L.validateReplay(noted.proposal.id, 'moth wing', heldOut);
    expect(good.ok === true && good.proposal.status === 'admitted' && good.proposal.deleted === false && good.rule === 'LEARN-FRAME-ADMITTED', JSON.stringify(good.rule));
    const learned = Q.compile('gnat wing', f);
    expect(learned.parsed === true && learned.rule === 'QF-LEARNED' && learned.kriya === 'have', JSON.stringify(learned));
    const gone = L.retractFrame(noted.proposal.id);
    expect(gone.ok === true && gone.proposal.status === 'archived' && gone.proposal.valid_to && gone.proposal.deleted === false, JSON.stringify(gone.proposal && gone.proposal.status));
    expect(Q.compile('gnat wing', f).parsed !== true, 'archived mapping is not used');
  });
  C('R4281', 'calibration records a later refutation and does not propose a stricter floor', () => {
    L.clear();
    L.noteAdmitted({ question: 'Is a brin a flarn?', reply: 'A brin is a flarn.', coherence: 0.91, echo: 1, drift: 0.02 });
    expect(L.label('confirmed', 'A brin is a flarn.').ok === true, 'confirm');
    L.noteAdmitted({ question: 'Is a kelm a flarn?', reply: 'A kelm is a flarn.', coherence: 0.9, echo: 1, drift: 0.1 });
    expect(L.label('refuted', 'A kelm is a flarn.').ok === true, 'refute');
    const report = L.calibrationReport();
    const tune = L.proposeStricter();
    expect(report.confirmed === 1 && report.refuted === 1 && report.reliability === 0.5, JSON.stringify(report));
    expect(tune.proposal === 'dropped' && tune.needs_nic === false && tune.applied === false && tune.changes_gates === false && tune.suggested === tune.current, JSON.stringify(tune));
  });
  C('R4281', 'newer agreeing evidence sets valid_to and keeps the old row', () => {
    WF.clear();
    const f = forge();
    const put = WF.upsert({ text: 'Kelm is inside Vor.', clause: Q.clause('Kelm is inside Vor.', f), source: 'hosted' });
    expect(put.ok === true, JSON.stringify(put.rule));
    const one = WF.supersede(put.fact.id, '1920-01-01T00:00:00Z', [{ text: 'Kelm is inside Hast.', source: 'a' }]);
    expect(one.ok === false && one.rule === 'LEARN-SUPERSEDE-NEEDS-TWO', JSON.stringify(one.rule));
    const two = WF.supersede(put.fact.id, '1920-01-01T00:00:00Z', [{ text: 'Kelm is inside Hast.', source: 'a' }, { text: 'Kelm is inside Hast.', source: 'b' }]);
    expect(two.ok === true && two.fact.deleted === false && two.fact.status === 'superseded', JSON.stringify(two));
    const doc = WF.loadRaw();
    expect(doc.facts.some(r => r.id === put.fact.id && r.valid_to === '1920-01-01T00:00:00Z'), 'row kept');
    const now = '2026-11-26T00:00:00Z';
    const old = '2020-01-01T00:00:00Z';
    const doc2 = WF.loadRaw();
    doc2.facts.push({ id: 'aged', text: 'An old hosted fact.', charged_at: old, charge0: 1, updated_at: old, kind: 'remember', Phi: 1 });
    WF.saveRaw(doc2);
    const dec = WF.decayed(WF.loadRaw(), now);
    expect(!dec.facts.some(r => r.id === 'aged') && dec.archive.some(r => r.id === 'aged' && r.deleted === false), JSON.stringify(dec.archive.map(r => r.id)));
    const hosted = L.ageHosted([{ id: 'h1', text: 'A hosted fact.' }, { id: 'h2', text: 'Another hosted fact.', valid_to: '2000-01-01T00:00:00Z' }], now);
    expect(hosted.length === 2 && hosted[1].status === 'expired', JSON.stringify(hosted));
    WF.clear();
  });
  C('R4281', 'mirror idle replay reads the learning loop and does not move a gate', () => {
    L.clear();
    const rows = ['A beetle is an insect.', 'A beetle has wings.', 'A moth is an insect.', 'A moth has wings.', 'An ant is an insect.', 'An ant has wings.'].map(fact);
    const loop = M.closeLoop([{ verified: true, route: 'derived', gate: 'admit', recall_hit: true }], rows, []);
    expect(loop.stage === 'idle' && loop.changes_gates === false && loop.calls_llm === false && loop.calibration && loop.stricter && loop.stricter.applied === false, JSON.stringify(loop));
    expect(loop.settled && loop.settled.admitted.some(r => r.id === 'kind-property:insect:wing') && loop.stricter.proposal === 'dropped' && loop.stricter.needs_nic === false, JSON.stringify(loop.settled && loop.settled.admitted.map(r => r.id)));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
