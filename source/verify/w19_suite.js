/* W19 — construction evidence for FORGE-MOBILE-TURN-WORLD-V1.
 * Fresh user acceptance questions are intentionally not fixtures here. */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const R = require(ROOT + '/src/reason.js'), KMOD = require(ROOT + '/src/kernel.js'), FMOD = require(ROOT + '/src/forge.js'), P = require(ROOT + '/src/privacy.js');
const { sha256 } = require(ROOT + '/src/sha256.js');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (x, why) => { if (!x) throw new Error(why || 'expectation failed'); };
const copy = x => JSON.parse(JSON.stringify(x));
const open = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-13T00:00:00Z' });
const openForge = () => FMOD.ForgeKernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-13T00:00:00Z' });
const evaluate = (s, opts) => R.evaluate(s, opts);
const worldCase = 'Every glimmer is a nova. Every nova is quiet. Rhea is a glimmer. Is Rhea quiet?';

function proofId(p) {
  const b = copy(p); delete b.proof_id;
  return 'proof:sha256:' + sha256(R.canon(b));
}
function resign(p) { p.proof_id = proofId(p); return p; }
function resignCandidate(c) { delete c.candidate_id; delete c.content_hash; c.content_hash = sha256(R.canon(c)); c.candidate_id = 'semantic-candidate:sha256:' + sha256(R.canon(c)); return c; }
function rerootWorld(w) { delete w.world_root; w.query.world_root = null; w.world_root = 'turn-world:sha256:' + sha256(R.canon(w)); w.query.world_root = w.world_root; return w; }
function allFrozen(x) { if (!x || typeof x !== 'object') return true; return Object.isFrozen(x) && Object.values(x).every(allFrozen); }

T('arbitrary unseen symbols reach the same complete reasoning path', () => {
  for (let i = 0; i < 32; i++) {
    const a = 'velnix' + i, b = 'torqua' + i, c = 'mirel' + i, e = 'Entity' + i;
    const q = `Every ${a} is a ${b}. Every ${b} is ${c}. ${e} is a ${a}. Is ${e} ${c}?`;
    const r = evaluate(q), m = r.material;
    expect(r.handled && m.status === 'supported_only', q + ' :: ' + m.status);
    expect(m.query.predicate === c && m.query.args[0] === e.toLowerCase(), JSON.stringify(m.query));
    expect(m.checker.support.ok && m.proofs.support.steps.length === 3, JSON.stringify(m.checker));
  }
});

T('metamorphic symbol renaming preserves status and proof shape', () => {
  const a = evaluate(worldCase).material;
  const b = evaluate('Every quorin is a vexal. Every vexal is lucid. Toma is a quorin. Is Toma lucid?').material;
  expect(a.status === b.status && a.derivation.derivations === b.derivation.derivations, JSON.stringify([a.status, b.status]));
  expect(a.proofs.support.steps.map(x => x.kind).join() === b.proofs.support.steps.map(x => x.kind).join(), 'proof topology changed under renaming');
  expect(a.world.world_root !== b.world.world_root && a.rmc.selected === b.rmc.selected, 'content hash or selection did not behave structurally');
});

T('direct support, direct refutation, conflict and open-world absence are distinct', () => {
  const cases = [
    ['Lio is amber. Is Lio amber?', 'supported_only'],
    ['Lio is not amber. Is Lio amber?', 'refuted_only'],
    ['Lio is amber. Lio is not amber. Is Lio amber?', 'conflicted'],
    ['Lio is cobalt. Is Lio amber?', 'undetermined']
  ];
  for (const [q, status] of cases) expect(evaluate(q).material.status === status, q);
});

T('negative queries preserve polarity rather than swapping the user question', () => {
  const a = evaluate('Lio is not amber. Is Lio not amber?').material;
  const b = evaluate('Lio is amber. Is Lio not amber?').material;
  expect(a.status === 'supported_only' && a.query.polarity === 'neg', JSON.stringify(a.query));
  expect(b.status === 'refuted_only' && b.proofs.refutation.conclusion.polarity === 'pos', JSON.stringify(b.proofs.refutation));
});

T('three-hop closure is complete and every step replays', () => {
  const r = evaluate('Every arin is bel. Every bel is cor. Every cor is dul. Ivo is an arin. Is Ivo dul?').material;
  expect(r.status === 'supported_only' && r.derivation.derivations === 3, JSON.stringify(r.derivation));
  expect(r.proofs.support.steps.length === 4 && r.checker.support.ok, JSON.stringify(r.proofs.support));
});

T('conjunctive rule bodies require every premise', () => {
  const yes = evaluate('If something is glimmer and nova, then it is quiet. Rhea is glimmer. Rhea is nova. Is Rhea quiet?').material;
  const no = evaluate('If something is glimmer and nova, then it is quiet. Rhea is glimmer. Is Rhea quiet?').material;
  expect(yes.status === 'supported_only' && yes.proofs.support.steps.filter(x => x.kind === 'fact').length === 2, JSON.stringify(yes.proofs));
  expect(no.status === 'undetermined' && !no.proofs.support, JSON.stringify(no));
});

T('binary relations and universal class rules are domain-independent', () => {
  const a = evaluate('Every artist admires Luna. Nera is an artist. Does Nera admire Luna?').material;
  const b = evaluate('Every pilot vexes Orin. Sava is a pilot. Does Sava vex Orin?').material;
  expect(a.status === 'supported_only' && b.status === 'supported_only', JSON.stringify([a.status, b.status]));
  expect(a.query.predicate === 'admire' && b.query.predicate === 'vex', JSON.stringify([a.query, b.query]));
});

T('conditional binary relation carries one explicit variable', () => {
  const r = evaluate('If someone admires Sol, then they trust Luna. Nera admires Sol. Does Nera trust Luna?').material;
  expect(r.status === 'supported_only' && r.query.predicate === 'trust', JSON.stringify(r));
  expect(r.proofs.support.steps.some(s => s.kind === 'rule' && s.substitution.$x === 'nera'), JSON.stringify(r.proofs.support));
});

T('explicit negative binary facts refute a positive relation query', () => {
  const r = evaluate('Nera does not admire Sol. Does Nera admire Sol?').material;
  expect(r.status === 'refuted_only' && r.proofs.refutation.conclusion.polarity === 'neg' && r.checker.refutation.ok, JSON.stringify(r));
});

T('paraconsistency is localized and never explodes into an unrelated claim', () => {
  const c = evaluate('Nera is lucid. Nera is not lucid. Is Nera lucid?').material;
  const u = evaluate('Nera is lucid. Nera is not lucid. Orin is calm. Is Orin bright?').material;
  expect(c.status === 'conflicted', c.status);
  expect(u.status === 'undetermined' && !u.proofs.support && !u.proofs.refutation, JSON.stringify(u.proofs));
});

T('cycles terminate at a finite complete closure', () => {
  const r = evaluate('Every arin is bel. Every bel is arin. Ivo is arin. Is Ivo bel?').material;
  expect(r.status === 'supported_only' && r.derivation.complete && r.derivation.derivations === 1 && r.derivation.rounds <= 3, JSON.stringify(r.derivation));
});

T('work exhaustion is incomplete and never mislabeled undetermined', () => {
  const r = evaluate(worldCase, { limits: { MAX_WORK: 1 } }).material;
  expect(r.status === 'incomplete' && !r.derivation.complete && r.derivation.failure === 'WORK_LIMIT', JSON.stringify(r.derivation));
  expect(r.rmc.selected === 'result:incomplete' && r.envelope.answer_proposition === null, JSON.stringify(r.rmc));
});

T('semantic candidate and every nested world object are immutable', () => {
  const i = R.interpret(worldCase), w = R.buildTurnWorld(i.candidate);
  expect(allFrozen(i.candidate) && allFrozen(w), 'candidate or world is mutable');
  expect(R.worldIntegrity(w), w.world_root);
});

T('semantic candidates carry roles entities variables markers and reject content-id drift', () => {
  const c = R.interpret('Every glimmer is quiet. Rhea is not glimmer. Is Rhea quiet?').candidate;
  for (const k of ['atoms', 'relations', 'entities', 'variables', 'markers', 'unresolved_senses', 'ambiguity_reasons', 'content_hash']) expect(Object.prototype.hasOwnProperty.call(c, k), k);
  expect(c.relations.some(x => x.dependencies.some(d => d.role === 'karta')) && c.variables.includes('$x') && c.markers.some(x => x.negation), JSON.stringify(c));
  const forged = copy(c); forged.facts[0].atom.predicate = 'forged';
  let refused = false; try { R.buildTurnWorld(forged); } catch (e) { refused = /WORLD_CANDIDATE_INVALID/.test(String(e)); }
  expect(refused, 'candidate changed beneath its id was admitted');
});

T('resigned candidates with malformed nested fields are refused', () => {
  const base = copy(R.interpret(worldCase).candidate), mutations = [
    c => { c.sources[0].span.start = '0'; }, c => { c.sources[0].id = 7; },
    c => { c.relations[0].dependencies[0].role = 7; }, c => { c.markers[0].negation = 'false'; },
    c => { c.entities[0] = { symbol: c.entities[0] }; }
  ];
  for (const mutate of mutations) { const c = copy(base); mutate(c); resignCandidate(c); let refused = false; try { R.buildTurnWorld(c); } catch (e) { refused = /WORLD_CANDIDATE_INVALID/.test(String(e)); } expect(refused, JSON.stringify(c)); }
});

T('resigned candidates cannot diverge across sources facts indexes roles markers loci or stable ids', () => {
  const base = copy(R.interpret('Every ferin is a gol. Nera is a ferin. Is Nera gol?').candidate), mutations = [
    c => { c.facts[0].atom.predicate = 'attacker_predicate'; },
    c => { c.atoms[0].locus = 'fabricated:locus'; c.relations[0].locus = 'fabricated:locus'; c.markers[0].locus = 'fabricated:locus'; },
    c => { c.markers[c.markers.length - 1].modality = 'asserted'; },
    c => { c.facts[0].id = 'fact:attacker'; },
    c => { c.relations[0].id = 'relation:attacker'; },
    c => { c.sources[0].source = c.sources[0].source.replace('gol', 'zul'); c.sources[0].normalized = c.sources[0].source; }
  ];
  for (const mutate of mutations) { const c = copy(base); mutate(c); resignCandidate(c); let refused = false; try { R.buildTurnWorld(c); } catch (e) { refused = /WORLD_CANDIDATE_INVALID/.test(String(e)); } expect(refused, JSON.stringify(c)); }
});

T('TurnWorld query is bound to its root and declared operation without a hash cycle', () => {
  const w = evaluate('Rhea is quiet. Is Rhea quiet?').material.world;
  expect(w.parent_root === null && w.language_candidate_refs[0] === w.candidate_id, JSON.stringify(w));
  expect(w.query.world_root === w.world_root && w.query.requested_operation === 'derive_signed_atom' && R.worldIntegrity(w), JSON.stringify(w.query));
});

T('rerooted worlds with malformed nested fields are refused', () => {
  const base = copy(evaluate(worldCase).material.world), mutations = [
    w => { w.entities[0] = { symbol: w.entities[0] }; }, w => { w.source_refs[0].id = 7; },
    w => { w.source_refs[0].span.end = '9'; }, w => { w.evidence_refs[0] = { id: w.evidence_refs[0] }; },
    w => { w.provenance_refs[0] = 7; }, w => { w.facts[0].evidence_refs[0] = { id: w.facts[0].evidence_refs[0] }; },
    w => { w.facts[0] = null; }, w => { w.rules[0] = null; }
  ];
  for (const mutate of mutations) { const w = copy(base); mutate(w); rerootWorld(w); expect(!R.worldIntegrity(w), JSON.stringify(w)); }
});

T('rerooted worlds enforce entity closure stable ids and the declared rule vocabulary', () => {
  const base = copy(evaluate(worldCase).material.world), mutations = [
    w => { w.entities = []; },
    w => { w.facts[0].id = 'fact:attacker'; },
    w => { w.rules[0].form = 'attacker_class'; w.rules[0].rule_class = 'attacker_class'; },
    w => { w.candidate_id = 'attacker'; w.language_candidate_refs = ['attacker']; w.provenance_refs = ['attacker']; w.facts.forEach(f => { f.provenance_refs = ['attacker']; }); w.rules.forEach(r => { r.provenance_refs = ['attacker']; }); }
  ];
  for (const mutate of mutations) { const w = copy(base); mutate(w); rerootWorld(w); expect(!R.worldIntegrity(w), JSON.stringify(w)); }
});

T('world schema and explicit candidate entity and proof-depth limits fail closed', () => {
  const m = evaluate(worldCase).material, malformed = copy(m.world); delete malformed.parent_root;
  expect(!R.worldIntegrity(malformed) && R.deriveWorld(malformed).failure === 'WORLD_ROOT_INVALID', JSON.stringify(malformed));
  for (const k of ['MAX_CANDIDATES', 'MAX_ENTITIES', 'MAX_PROOF_DEPTH']) expect(Number.isInteger(m.world.limits[k]) && m.world.limits[k] > 0, k);
  const limited = evaluate(worldCase, { limits: { MAX_PROOF_DEPTH: 2 } }).material;
  expect(limited.status === 'incomplete' && limited.derivation.failure === 'PROOF_LIMIT', JSON.stringify(limited.derivation));
});

T('world root changes with content and is stable for identical content', () => {
  const a = evaluate(worldCase).material.world.world_root;
  const b = evaluate(worldCase).material.world.world_root;
  const c = evaluate('Every glimmer is a nova. Every nova is bright. Rhea is a glimmer. Is Rhea bright?').material.world.world_root;
  expect(a === b && a !== c && /^turn-world:sha256:[0-9a-f]{64}$/.test(a), [a, b, c].join(' '));
});

T('source spans and source custody survive interpretation', () => {
  const i = R.interpret(worldCase).candidate;
  expect(i.sources.length === 4 && i.facts.length === 1 && i.rules.length === 2, JSON.stringify(i));
  for (const s of i.sources) expect(worldCase.slice(s.span.start, s.span.end) === s.source, JSON.stringify(s));
  expect(i.facts[0].source_ref === 'source:3' && i.query.source_ref === 'source:4', JSON.stringify(i));
});

T('duplicate facts are canonicalized without creating false proof weight', () => {
  const m = evaluate('Rhea is quiet. Rhea is quiet. Is Rhea quiet?').material;
  expect(m.world.facts.length === 1 && m.proofs.support.steps.length === 1, JSON.stringify(m));
});

T('proof checker rejects a changed world root', () => {
  const m = evaluate(worldCase).material, w = copy(m.world); w.world_root = w.world_root.replace(/.$/, w.world_root.endsWith('0') ? '1' : '0');
  expect(R.checkProof(w, m.proofs.support).code === 'WORLD_ROOT_INVALID', JSON.stringify(R.checkProof(w, m.proofs.support)));
});

T('proof checker rejects altered fact ancestry even after proof id is recomputed', () => {
  const m = evaluate(worldCase).material, p = copy(m.proofs.support);
  p.steps[0].fact_id = 'fact:forged'; resign(p);
  expect(!R.checkProof(m.world, p).ok && R.checkProof(m.world, p).code === 'FACT_STEP_REPLAY', JSON.stringify(R.checkProof(m.world, p)));
});

T('proof checker rejects altered rule ids, substitutions and premise references', () => {
  const m = evaluate(worldCase).material;
  const mutations = [
    p => { p.steps[p.steps.length - 1].rule_id = 'rule:forged'; },
    p => { p.steps[p.steps.length - 1].substitution.$x = 'forged_entity'; },
    p => { p.steps[p.steps.length - 1].premises[0] = 'step:missing'; }
  ];
  for (const mutate of mutations) { const p = copy(m.proofs.support); mutate(p); resign(p); expect(!R.checkProof(m.world, p).ok, JSON.stringify(R.checkProof(m.world, p))); }
});

T('proof checker rejects an altered conclusion and undeclared fields', () => {
  const m = evaluate(worldCase).material;
  const a = copy(m.proofs.support); a.steps[a.steps.length - 1].conclusion.predicate = 'forged'; resign(a); expect(!R.checkProof(m.world, a).ok, JSON.stringify(R.checkProof(m.world, a)));
  const b = copy(m.proofs.support); b.steps[0].extra = 'forged'; resign(b); expect(R.checkProof(m.world, b).code === 'FACT_STEP_SHAPE', JSON.stringify(R.checkProof(m.world, b)));
});

T('Proof/v1 embeds replay verdict and uniform exact step fields', () => {
  const m = evaluate(worldCase).material, p = m.proofs.support;
  expect(p.check_result && p.check_result.ok && JSON.stringify(p.check_result) === JSON.stringify(m.checker.support), JSON.stringify(p));
  for (const s of p.steps) for (const k of ['premises', 'substitution', 'polarity', 'conclusion']) expect(Object.prototype.hasOwnProperty.call(s, k), s.kind + ':' + k);
  expect(JSON.stringify(p.query) === JSON.stringify(m.world.query), 'proof query is not world-bound');
});

T('proof checker rejects unrelated conclusions unused substitutions and smuggled steps', () => {
  const unrelated = evaluate('Rhea is glimmer. Orin is quiet. Is Rhea quiet?').material;
  const fact = unrelated.world.facts.find(f => f.atom.args[0] === 'orin');
  const p1 = copy(unrelated.proofs.support || evaluate('Orin is quiet. Is Orin quiet?').material.proofs.support);
  p1.world_root = unrelated.world.world_root; p1.query = copy(unrelated.world.query); p1.conclusion = copy(fact.atom);
  p1.steps = [{ kind: 'fact', step_id: 'step:' + fact.id, fact_id: fact.id, premises: [], substitution: {}, polarity: fact.atom.polarity, conclusion: copy(fact.atom) }];
  p1.check_result = { ok: true, code: 'PROOF_REPLAY_ACCEPTED', checker_version: R.CHECKER_VERSION, steps: 1 }; resign(p1);
  expect(!R.checkProof(unrelated.world, p1).ok, JSON.stringify(R.checkProof(unrelated.world, p1)));
  const m = evaluate('Every flint is gleam. Rava is flint. Orin is quiet. Is Rava gleam?').material;
  const p2 = copy(m.proofs.support), last = p2.steps[p2.steps.length - 1]; last.substitution.$unused = 'smuggled'; resign(p2);
  expect(R.checkProof(m.world, p2).code === 'SUBSTITUTION_SHAPE', JSON.stringify(R.checkProof(m.world, p2)));
  const p3 = copy(m.proofs.support), extra = m.world.facts.find(f => f.atom.args[0] === 'orin');
  p3.steps.unshift({ kind: 'fact', step_id: 'step:' + extra.id, fact_id: extra.id, premises: [], substitution: {}, polarity: extra.atom.polarity, conclusion: copy(extra.atom) }); resign(p3);
  expect(R.checkProof(m.world, p3).code === 'UNUSED_STEP', JSON.stringify(R.checkProof(m.world, p3)));
});

T('proof-step exhaustion is incomplete with a typed PROOF_LIMIT', () => {
  const direct = evaluate('Rhea is quiet. Is Rhea quiet?', { limits: { MAX_PROOF_STEPS: 0 } }).material;
  const hop = evaluate('Every glimmer is quiet. Rhea is glimmer. Is Rhea quiet?', { limits: { MAX_PROOF_STEPS: 1 } }).material;
  for (const m of [direct, hop]) expect(m.status === 'incomplete' && m.derivation.failure === 'PROOF_LIMIT' && m.envelope.answer_proposition === null, JSON.stringify(m.derivation));
});

T('the proof checker is implementation-independent from closure generation', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/reason.js'), 'utf8');
  const body = src.slice(src.indexOf('function replayProofCore'), src.indexOf('function resultStatus'));
  expect(!/deriveWorld\s*\(/.test(body) && /instantiate\(/.test(body) && /PREMISE_REPLAY/.test(body), body.slice(0, 300));
});

T('RMC exposes all result candidates and selects exactly one eligible candidate', () => {
  for (const q of [worldCase, 'Rhea is quiet. Rhea is not quiet. Is Rhea quiet?', 'Rhea is glimmer. Is Rhea quiet?']) {
    const r = evaluate(q).material.rmc, eligible = r.candidates.filter(c => c.eligible);
    expect(r.candidates.length === 6 && eligible.length === 1 && eligible[0].id === r.selected, JSON.stringify(r));
  }
});

T('RMC manifest binds its plan exploration gates rejections and reproducibility record', () => {
  const m = evaluate(worldCase).material, r = m.rmc;
  expect(r.plan.length === 4 && r.exploration.complete && r.reproducibility.deterministic && r.candidate_ids.length === r.candidates.length, JSON.stringify(r));
  const changed = copy(r); changed.candidates[0].gates.world_root_valid = false;
  const body = copy(changed); delete body.manifest_id;
  expect(changed.manifest_id !== 'rmc-world-manifest:sha256:' + sha256(R.canon(body)), 'manifest id did not bind gates');
});

T('response envelope binds input, interpretation, world, RMC, proofs and zero authority effects', () => {
  const m = evaluate(worldCase).material, e = m.envelope;
  expect(e.schema === R.ENVELOPE_SCHEMA && e.language_candidate_id === m.interpretation.candidate_id && e.world_root === m.world.world_root && e.rmc_manifest_id === m.rmc.manifest_id, JSON.stringify(e));
  expect(e.proof_ids[0] === m.proofs.support.proof_id && e.checker_verdicts.support.ok, JSON.stringify(e));
  for (const k of ['network_calls', 'tool_executions', 'governed_memory_reads', 'knowledge_writes', 'world_writes', 'file_writes']) expect(e.effects[k] === 0, k + '=' + e.effects[k]);
});

T('the query must be final and trailing assertions are never silently dropped', () => {
  const m = evaluate('Azurin is qevrim. Is Azurin qevrim? Azurin is not qevrim.').material;
  expect(m.kind === 'world_limitation' && m.code === 'QUERY_NOT_FINAL', JSON.stringify(m));
  expect(m.source === 'Azurin is not qevrim.' && m.span.start > 0, JSON.stringify(m));
});

T('sentence overflow returns SENTENCE_LIMIT without dropping the final query', () => {
  const raw = Array.from({ length: 25 }, (_, i) => `E${i} is p${i}.`).join(' ') + ' Is E24 p24?', m = evaluate(raw).material;
  expect(m.kind === 'world_limitation' && m.code === 'SENTENCE_LIMIT' && m.envelope.answer_proposition === null, JSON.stringify(m));
});

T('zero structural budgets return typed limitations and never throw', () => {
  const cases = [['MAX_CANDIDATES', 'Nera is gol. Is Nera gol?'], ['MAX_ENTITIES', 'Nera is gol. Is Nera gol?'], ['MAX_FACTS', 'Nera is gol. Is Nera gol?'], ['MAX_RULES', 'Every ferin is gol. Nera is ferin. Is Nera gol?']];
  for (const [key, raw] of cases) { const m = evaluate(raw, { limits: { [key]: 0 } }).material; expect(m.kind === 'world_limitation' && m.status === 'unsupported_structure' && m.envelope.answer_proposition === null, key + ':' + JSON.stringify(m)); }
});

T('NFC-equivalent input has one canonical world, envelope and kernel trace', () => {
  const nfc = 'Ázurin is qevrim. Is Ázurin qevrim?', nfd = nfc.normalize('NFD');
  const a = evaluate(nfc).material, b = evaluate(nfd).material;
  expect(JSON.stringify(a.envelope) === JSON.stringify(b.envelope), 'world envelope changed across NFC/NFD');
  expect(a.interpretation.candidate_id === b.interpretation.candidate_id && a.world.world_root === b.world.world_root, 'canonical identifiers changed across NFC/NFD');
  const ka = open().process(nfc), kb = open().process(nfd);
  expect(ka.reply === kb.reply && ka.trace.psi_id === kb.trace.psi_id, 'kernel trace changed across NFC/NFD');
});

T('structural limitations carry the complete common envelope with typed no-op fields', () => {
  const m = evaluate('Azurin is qevrim. Could Azurin become zoltek?').material, e = m.envelope;
  const fields = ['language_candidate_id', 'world_root', 'rmc_manifest_id', 'proof_ids', 'checker_verdicts', 'completeness', 'limits'];
  expect(fields.every(k => Object.prototype.hasOwnProperty.call(e, k)), JSON.stringify(e));
  expect(e.language_candidate_id === null && e.world_root === null && e.rmc_manifest_id === null && e.answer_proposition === null, JSON.stringify(e));
  expect(Array.isArray(e.proof_ids) && e.proof_ids.length === 0 && e.checker_verdicts.support.code === 'NOT_RUN_NO_WORLD', JSON.stringify(e));
  expect(e.completeness === 'unsupported_structure' && e.limits.MAX_WORK === R.LIMITS.MAX_WORK, JSON.stringify(e));
});

T('unsupported syntax is a structural limitation, never an unknown-word refusal', () => {
  const r = evaluate('Aster might become luminous unless the veil turns. Could Aster remain obscure?').material;
  expect(r.kind === 'world_limitation' && r.status === 'unsupported_structure' && r.unknown_word === false, JSON.stringify(r));
  expect(!/unknown word|do not know the word/i.test(JSON.stringify(r)), JSON.stringify(r));
});

T('reserved query conjunction is refused instead of becoming one invented predicate', () => {
  const m = evaluate('Nera is quiet. Is Nera quiet and bright?').material;
  expect(m.kind === 'world_limitation' && m.code === 'UNSUPPORTED_QUERY_STRUCTURE', JSON.stringify(m));
  expect(!/quiet_and_bright/.test(JSON.stringify(m)), JSON.stringify(m));
});

T('nested operators and doubled negation are limitations instead of invented predicates', () => {
  const cases = [
    ['Nera is quiet. Is Nera quiet is bright?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Nera is quiet. Is Nera not not quiet?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Nera is quiet. Is Nera is quiet?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Nera admires Sol. Does Nera is Sol?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Nera is quiet is bright. Is Nera bright?', 'UNSUPPORTED_ASSERTION_STRUCTURE'],
    ['Nera does not not admire Sol. Does Nera admire Sol?', 'UNSUPPORTED_ASSERTION_STRUCTURE']
  ];
  for (const [raw, code] of cases) { const m = evaluate(raw).material; expect(m.kind === 'world_limitation' && m.code === code && m.envelope.answer_proposition === null, raw + ':' + JSON.stringify(m)); }
});

T('structural words in content slots are typed limitations, never invented symbols', () => {
  const cases = [
    ['Nera is quiet. Is Nera very not quiet?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Is not Nera quiet?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Does not Nera admire Sol?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Nera is very not quiet. Is Nera quiet?', 'UNSUPPORTED_ASSERTION_STRUCTURE'],
    ['Not Nera admires Sol. Does Nera admire Sol?', 'UNSUPPORTED_ASSERTION_STRUCTURE'],
    ['Nera is quiet. Is Nera quiet was bright?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Nera is quiet. Is Nera quiet has bright?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Is very Nera quiet?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Does very Nera admire Sol?', 'UNSUPPORTED_QUERY_STRUCTURE'],
    ['Nera is quiet. Is Nera never quiet?', 'UNSUPPORTED_QUERY_STRUCTURE']
  ];
  for (const [raw, code] of cases) {
    const r = evaluate(raw), m = r.material;
    expect(r.handled && m.kind === 'world_limitation' && m.code === code && m.status === 'unsupported_structure', raw + ':' + JSON.stringify(m));
    expect(m.envelope.answer_proposition === null && m.envelope.world_root === null && m.unknown_word === false, raw + ':' + JSON.stringify(m.envelope));
  }
});

T('operator boundaries preserve novel content symbols and valid present relations', () => {
  const cases = [
    ['Every veryn is nevera. Ulix has Sol. Ulix is veryn. Is Ulix nevera?', 'supported_only'],
    ['Ulix has Sol. Does Ulix have Sol?', 'supported_only'],
    ['Ulix does not admire Sol. Does Ulix admire Sol?', 'refuted_only'],
    ['Every zalpher is quorin. Mera is zalpher. Is Mera quorin?', 'supported_only']
  ];
  for (const [raw, status] of cases) { const m = evaluate(raw).material; expect(m.kind === 'world_answer' && m.status === status, raw + ':' + JSON.stringify(m)); }
});

T('closed-class words cannot be smuggled into bare symbol slots', () => {
  const cases = [
    'Is because Nera quiet?', 'Does Nera both admire Sol?',
    'Nera is quiet. Is Nera quiet while bright?', 'Nera admires Sol. Does Nera admire without?',
    'Nera is quiet because bright. Is Nera quiet?', 'Because Nera admires Sol. Does Nera admire Sol?',
    'Nera is quiet. Is Nera either quiet?', 'Nera admires Sol. Does Nera admire both?',
    'Nera is quiet. Is Nera quiet nor bright?', 'Nera is quiet. Is Nera quiet unless bright?',
    'Nera is quiet. Is Nera quiet with bright?', 'Nera is quiet. Is Nera quiet of bright?',
    'Nera is quiet. Is Nera quiet to bright?', 'Nera is quiet. Is Nera quiet from bright?',
    'as is quiet. Is as quiet?', 'Nera is within. Is Nera within?',
    'Nera among Sol. Does Nera among Sol?', 'Nera admires against. Does Nera admire against?',
    'above is quiet. Is above quiet?', 'Nera is below. Is Nera below?',
    'Nera outside Sol. Does Nera outside Sol?', 'Nera is merely. Is Nera merely?',
    "Nera isn't Sol. Does Nera isn't Sol?", "can't is quiet. Is can't quiet?",
    'Nera admires whichever. Does Nera admire whichever?'
  ];
  const families = [
    ['ought', "oughtn't"],
    ['astride', 'atop', 'barring', 'excepting', 'pending', 'absent', 'betwixt', 'circa', 'sans', 'unto', 'vis-à-vis'],
    ['whereby', 'whereupon', 'wherein', 'hereafter', 'therewith', 'whence', 'whither', 'whilst', 'supposing'],
    ['indeed', 'alternatively', 'conversely', 'similarly', 'additionally', 'admittedly', 'anyhow', 'finally', 'firstly', 'lastly', 'secondly']
  ];
  for (const word of families.flat()) cases.push(
    `${word} is c9quiet. Is ${word} c9quiet?`,
    `C9nera is ${word}. Is C9nera ${word}?`,
    `C9nera ${word} C9sol. Does C9nera ${word} C9sol?`,
    `C9nera admires ${word}. Does C9nera admire ${word}?`
  );
  for (const raw of cases) { const m = evaluate(raw).material; expect(m.kind === 'world_limitation' && m.status === 'unsupported_structure' && m.envelope.world_root === null, raw + ':' + JSON.stringify(m)); }
});

T('quoted identifiers preserve reserved homographs and multiword content explicitly', () => {
  const cases = [
    ['"Because" is quiet. Is "Because" quiet?', 'supported_only'],
    ['Nera is "quiet while bright". Is Nera "quiet while bright"?', 'supported_only'],
    ['Nera admires "Sol Prime". Does Nera admire "Sol Prime"?', 'supported_only'],
    ['"Every One" is quiet. Is "Every One" quiet?', 'supported_only'],
    ['Nera "has" Sol. Does Nera "has" Sol?', 'supported_only'],
    ['Nera "links to" Sol. Does Nera "links to" Sol?', 'supported_only'],
    ['"ought" is quiet. Is "ought" quiet?', 'supported_only'],
    ['Nera is "astride". Is Nera "astride"?', 'supported_only'],
    ['Nera "whereby" Sol. Does Nera "whereby" Sol?', 'supported_only'],
    ['Nera admires "indeed". Does Nera admire "indeed"?', 'supported_only'],
    ['Every "source class" "links to" "target node". Nera is "source class". Does Nera "links to" "target node"?', 'supported_only'],
    ['If something is "red and blue", then it is "quiet then still". Nera is "red and blue". Is Nera "quiet then still"?', 'supported_only'],
    ['Every becausea7 is whileton9. Entity77 is becausea7. Is Entity77 whileton9?', 'supported_only']
  ];
  for (const [raw, status] of cases) { const m = evaluate(raw).material; expect(m.kind === 'world_answer' && m.status === status, raw + ':' + JSON.stringify(m)); }
});

T('every repeated occurrence of a detected sensitive value is sealed before ingestion', () => {
  const marker = 'w19_fake_sensitive_7x9', red = P.redact('My passphrase is ' + marker + '. Is my passphrase ' + marker + '?');
  expect(!red.text.includes(marker) && (red.text.match(/sealed/g) || []).length === 2, JSON.stringify(red));
  const f = openForge(), r = f.process('My passphrase is ' + marker + '. Is my passphrase ' + marker + '?');
  expect(!JSON.stringify({ result: r, traces: f.traces() }).includes(marker), JSON.stringify(r));
});

T('a broad unsupported why-question does not receive a topical canned answer', () => {
  const r = open().process('Why do artisans invent instruments?');
  expect(((r.msm.meaning.kind === 'world_answer' && r.msm.meaning.why && r.msm.meaning.status === 'undetermined') || r.msm.meaning.kind === 'world_limitation') && r.trace.echo.pass, r.reply || r.block_reason); // v4.9.20: why → checked undetermined (no rule explains it)
  expect(!/retention|causal understanding|learning/i.test(r.reply), r.reply);
});

T('bare supported questions enter an empty TurnWorld instead of a legacy canned route', () => {
  const a = evaluate('Is Rhea quiet?').material, b = open().process('Does Varo admire Luma?');
  expect(a.status === 'undetermined' && a.world.facts.length === 0, JSON.stringify(a));
  expect(b.msm.meaning.kind === 'world_answer' && b.msm.meaning.status === 'undetermined', b.reply);
});

T('oversized world input reaches typed INPUT_LIMIT through Kernel and Forge wrappers', () => {
  const q = 'Rhea is quiet. ' + ' '.repeat(R.LIMITS.MAX_INPUT_CHARS) + 'Is Rhea quiet?';
  for (const r of [open().process(q), openForge().process(q)]) {
    expect(r.msm.meaning.kind === 'world_limitation' && r.msm.meaning.code === 'INPUT_LIMIT', JSON.stringify(r.msm.meaning));
    expect(r.trace.input.length <= 2000 && r.trace.input_truncated && r.trace.input_length === q.length, JSON.stringify(r.trace));
  }
});

T('actual Kernel.process path renders the checked result and exposes the world trace', () => {
  const k = open(), r = k.process(worldCase), m = r.msm.meaning;
  expect(!r.blocked && /^Yes\./.test(r.reply) && /rhea is quiet/i.test(r.reply), r.reply || r.block_reason);
  expect(m.kind === 'world_answer' && m.status === 'supported_only' && r.trace.echo.pass, JSON.stringify(r.trace.echo));
  expect(r.trace.world_model && r.trace.world_model.world_root === m.world.world_root && r.trace.world_model.rmc_manifest_id === m.rmc.manifest_id, JSON.stringify(r.trace.world_model));
  expect(r.trace.world_model.world.facts.length && r.trace.world_model.proofs.support.steps.length && r.trace.world_model.limits && r.trace.world_model.effects.network_calls === 0, JSON.stringify(r.trace.world_model));
  expect(m.envelope.echo.status === 'passed' && m.envelope.echo.pass, JSON.stringify(m.envelope.echo));
});

T('conflict and undetermined states render honestly through Echo', () => {
  const a = open().process('Rhea is quiet. Rhea is not quiet. Is Rhea quiet?');
  const b = open().process('Rhea is glimmer. Is Rhea quiet?');
  expect(a.msm.meaning.status === 'conflicted' && /conflict/i.test(a.reply) && a.trace.echo.pass, a.reply);
  expect(b.msm.meaning.status === 'undetermined' && /additional premise/i.test(b.reply) && b.trace.echo.pass, b.reply);
});

T('turn worlds cannot read governed memory or leak into later turns', () => {
  const k = open(); k.process('remember that Anna is happy');
  const before = JSON.stringify(k.memory());
  const a = k.process('Rhea is cobalt. Is Anna happy?');
  const b = k.process('Rhea is quiet. Is Rhea quiet?');
  const c = k.process('Orin is quiet. Is Rhea quiet?');
  expect(a.msm.meaning.status === 'undetermined', a.reply);
  expect(b.msm.meaning.status === 'supported_only' && c.msm.meaning.status === 'undetermined', [b.reply, c.reply].join(' | '));
  expect(JSON.stringify(k.memory()) === before, 'world path changed governed memory');
  expect(a.msm.meaning.envelope.effects.governed_memory_reads === 0 && c.msm.meaning.envelope.effects.knowledge_writes === 0, JSON.stringify(c.msm.meaning.envelope.effects));
});

T('deterministic replay preserves world, proofs, manifest, envelope and surface', () => {
  const run = () => { const r = open().process(worldCase); return JSON.stringify({ reply: r.reply, world: r.msm.meaning.world, proofs: r.msm.meaning.proofs, rmc: r.msm.meaning.rmc, envelope: r.msm.meaning.envelope }); };
  expect(run() === run(), 'world-model replay differs');
});

T('production reasoner has no model, retrieval, similarity, network, store or runtime-code authority', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/reason.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  expect(!/\b(fetch|XMLHttpRequest|WebSocket|EventSource|openai|anthropic|embedding|vector|cosine|localStorage|sessionStorage|indexedDB|child_process|execSync|spawnSync|eval)\b|new Function\s*\(/i.test(src), 'forbidden authority or side effect');
  expect(!/retention|adaptation|learned|learning candidate/i.test(src), 'topical learning theory remains in answer authority');
});

T('answers are consequences of current rules, not phrase matches or stored replies', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/reason.js'), 'utf8');
  const replies = [];
  for (let i = 0; i < 12; i++) {
    const p = 'sylor' + i, q = 'brin' + i, n = 'Node' + i;
    const r = open().process(`Every ${p} is ${q}. ${n} is ${p}. Is ${n} ${q}?`);
    expect(r.msm.meaning.status === 'supported_only' && r.reply.includes(n.toLowerCase()) && r.reply.includes(q), r.reply);
    expect(!src.includes(n) && !src.includes(p) && !src.includes(q), 'generated fixture embedded in production'); replies.push(r.reply);
  }
  expect(new Set(replies).size === replies.length, 'surface ignored current symbols');
});

T('browser ship path loads the world reasoner before the kernel and the app submits through ForgeKernel', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'), app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8'), forge = fs.readFileSync(path.join(ROOT, 'src/forge.js'), 'utf8');
  expect(html.indexOf('src/reason.js') > 0 && html.indexOf('src/reason.js') < html.indexOf('src/kernel.js'), 'browser load order');
  expect(/ForgeKernel/.test(app) && /\.process\(/.test(app), 'app does not submit through the runtime');
  expect(/Kernel\(/.test(forge), 'ForgeKernel does not wrap the language kernel');
});

T('the actual Trace renderer exposes governed world proof checker limits and effects', () => {
  const app = fs.readFileSync(path.join(ROOT, 'src/app.js'), 'utf8');
  for (const needle of ['t.world_model', 'world_root', 'world.facts', 'world.rules', 'proof.steps', 'wm.checker', 'wm.limits', 'network_calls', 'governed_memory_reads', 'knowledge_writes', 'world_writes']) expect(app.includes(needle), needle);
});

T('representative closure remains bounded', () => {
  const start = process.hrtime.bigint();
  for (let i = 0; i < 100; i++) expect(evaluate(worldCase).material.status === 'supported_only');
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  expect(ms < 4000, ms.toFixed(1) + 'ms');
});

for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'CORE-REASONING', name: t.name, ok: true }); }
  catch (e) { rows.push({ cls: 'CORE-REASONING', name: t.name, ok: false, why: String(e && e.stack || e).slice(0, 1400) }); }
}
process.stdout.write(JSON.stringify(rows));
