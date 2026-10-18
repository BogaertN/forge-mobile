/* 4.9.72 — MEA (Manifest Evolution) problem lane: problem manifests are DATA (hypothesis space, likelihood expressions, exact conditions, derivations);
 * one generic machinery runs every problem: operators (derive, hypothesize ⧒, split ⧧, merge ⟁) → hard gates → Pareto → lexicographic rank
 * (B↓ L↑ Ω↑ I↑ A↑ ε↓ K↓, then id) → claim status → tap-only commit → archive (cold storage) / requeue → RMC handoff. No invented weights: the
 * display score is shown only. The three canonical problems and a synthetic fourth run end-to-end; expected outcomes are read only here. */
module.exports = ({ C, expect, ROOT }) => {
  const fs = require('fs'), P = require(ROOT + '/src/mea_p.js'), CP = JSON.parse(fs.readFileSync(ROOT + '/data/canonical_problems.json', 'utf8'));
  const prob = d => P.normalize(CP.problems.find(p => p.domain === d)), run = M => { const cy = P.cycle(M); const cm = P.commit(M, cy, cy.resolution && cy.resolution.candidate_id, true); return { cy, cm }; };
  const by = (cy, f) => cy.candidates.filter(f), opt = (cy, o) => cy.candidates.find(c => c.op === 'hypothesize' && c.option === o);
  const SYN = { id: 'synthetic:route-window', domain: 'logistics', manifest: { goal: 'decide which route fits a 30-minute window', phase_state: 4,
    known_facts: [{ id: 'f1', text: 'route A is 12 km at 30 km/h', tier: 'given' }, { id: 'f2', text: 'route B is 20 km at 60 km/h', tier: 'given' }],
    unknowns: [{ id: 'u1', text: 'which route fits', kind: 'choice', options: [
      { id: 'A', text: 'route A fits', assumptions: [], condition: { lhs: '12/30*60', op: '<=', rhs: '30' }, falsifier: 'a timed run over 30 minutes' },
      { id: 'B', text: 'route B fits', assumptions: [], condition: { lhs: '20/60*60', op: '<=', rhs: '30' }, falsifier: 'a timed run over 30 minutes' },
      { id: 'C', text: 'a hidden shortcut exists', assumptions: [] }] }],
    derivations: [{ id: 'd1', expr: '12/30*60', claim: 'route A takes {v} minutes', uses: ['f1'] }, { id: 'd2', expr: '20/60*60', claim: 'route B takes {v} minutes', uses: ['f2'] }],
    success_conditions: [{ id: 's1', text: 'a fitting route is known', unknown: 'u1' }] } };
  C('MEAP', 'schema + content hash: normalize is deterministic, validate passes, editing a field changes the hash', () => {
    for (const p of CP.problems) { const a = P.normalize(p), b = P.normalize(JSON.parse(JSON.stringify(p))); expect(a.hash === b.hash && !P.validate(a).length, p.id); const e = JSON.parse(JSON.stringify(a)); e.goal += ' x'; expect(P.manifestHash(e) !== a.hash, 'hash ignores goal'); } });
  C('MEAP', 'replay: every candidate re-generates to its own id from (H(M), operator, θ); the cycle is deterministic', () => {
    const M = prob('chemistry'), a = P.cycle(M), b = P.cycle(M); expect(a.cycle_hash === b.cycle_hash, 'cycle not deterministic');
    for (const c of a.candidates) expect(c.gates.find(g => g.gate === 'REPLAY').ok, 'replay ' + c.op); });
  C('MEAP', 'gates: a forged candidate (edited claim) fails TAMPER/REPLAY; a skipped phase fails PHASE; an unsupported discharged premise fails EVIDENCE', () => {
    const M = prob('physics'), cy = P.cycle(M), d = cy.candidates.find(c => c.op === 'derive'), g = (c, ctx) => P.gates(c, M, Object.assign({ pool: cy.candidates }, ctx)).filter(x => !x.ok).map(x => x.gate);
    const f = JSON.parse(JSON.stringify(d)); f.claim = '144/90 = 2'; expect(g(f).includes('TAMPER'), 'forged passes: ' + g(f)); f.candidate_id = P.candHash(f); expect(g(f).includes('REPLAY'), 're-hashed forgery passes replay: ' + g(f));
    const s = JSON.parse(JSON.stringify(d)); s.phase_path = [M.phase_state, M.phase_state + 3]; s.candidate_id = P.candHash(s); expect(g(s).includes('PHASE'), 'phase skip passes: ' + g(s));
    const h = JSON.parse(JSON.stringify(opt(cy, 'substrate'))); h.premises[0].tier = 'empirical_measurement'; h.candidate_id = P.candHash(h); expect(g(h).includes('EVIDENCE'), 'unsupported evidence passes: ' + g(h)); });
  C('MEAP', 'claim law: verified_claim needs an empirical premise; derived/resolved need zero proof debt; I = 0 is never a resolved manifest', () => {
    const M = prob('physics'), cy = P.cycle(M), c = JSON.parse(JSON.stringify(cy.candidates.find(x => x.op === 'derive'))), t = P.terms(c, M);
    const fail = (cls, tt) => P.gates(c, M, { pool: cy.candidates, terms: tt || t, cls: { claim_status: cls } }).filter(x => !x.ok).map(x => x.gate);
    expect(fail('verified_claim').includes('CLAIM'), 'verified without empirical evidence'); expect(fail('resolved_manifest', Object.assign({}, t, { B: 1 })).includes('CLAIM'), 'resolved with debt');
    expect(fail('resolved_manifest', Object.assign({}, t, { I: 0 })).includes('I_ZERO'), 'I = 0 resolved'); });
  C('MEAP', 'selection: Pareto then lexicographic keys; the display score never decides the order (permuting it changes nothing)', () => {
    const M = prob('biology'), cy = P.cycle(M), hs = by(cy, c => c.op === 'hypothesize' && c.route === 'eligible'); const r1 = P.rank(hs).map(x => x.id);
    const hs2 = hs.map(c => Object.assign({}, c, { display_score: -c.display_score * 1000 })); expect(JSON.stringify(P.rank(hs2).map(x => x.id)) === JSON.stringify(r1), 'display score changed the rank');
    expect(P.LEX_ORDER.map(x => x[0]).join(',') === 'B,L,Omega,I,A,eps,K', 'lex order ' + P.LEX_ORDER.map(x => x[0])); const src = fs.readFileSync(ROOT + '/src/mea_p.js', 'utf8');
    expect(!/\b0\.\d+\s*\*\s*t\./.test(src) && !/weight\s*[:=]\s*0?\.\d/.test(src), 'a numeric weight appears in mea_p.js'); });
  C('MEAP', 'commit is tap-only and needs this cycle: no tap, a stale cycle, or a non-resolution candidate are refused', () => {
    const M = prob('physics'), cy = P.cycle(M); expect(P.commit(M, cy, cy.resolution.candidate_id, false).rule === 'MEA-TAP-REQUIRED', 'no tap');
    expect(!P.commit(M, cy, cy.candidates[0].candidate_id, true).ok, 'non-resolution committed'); const M2 = P.supply(prob('chemistry'), 'u1', '16').manifest;
    expect(!P.commit(M2, cy, cy.resolution.candidate_id, true).ok, 'stale cycle committed'); });
  C('MEAP', 'domain-general: mea_p.js names no domain, option or expected outcome; the kernel lane has no per-problem branch', () => {
    const src = fs.readFileSync(ROOT + '/src/mea_p.js', 'utf8'); for (const w of ['expected_outcome', 'physics', 'chemistry', 'biology', 'myelin', 'harmonic', 'O2', 'H2', 'X-linked', 'XLD', '144']) expect(!src.includes(w), 'mea_p.js mentions ' + w);
    const ks = fs.readFileSync(ROOT + '/src/kernel.js', 'utf8'); expect(!/canon:(physics|chemistry|biology)/.test(ks), 'kernel names a canonical problem'); });
  C('MEAP', 'physics (144 Hz): ratios derived exactly; substrate vs harmonic tie (no favoured option) → ⧧ two sub-manifests; status hypothesis + test_required', () => {
    const M = prob('physics'), ex = CP.problems.find(p => p.domain === 'physics').expected_outcome, { cy, cm } = run(M);
    expect(by(cy, c => c.op === 'derive' && c.claim_status === 'derived_claim').map(c => c.value).sort().join(',') === '1.6,144', 'derived ' + by(cy, c => c.op === 'derive').map(c => c.value));
    expect(cy.slates.u2 && cy.slates.u2.favoured === null, 'an option was favoured: ' + JSON.stringify(cy.slates.u2 && cy.slates.u2.ranking));
    expect(cm.ok && cm.manifest.claim_status === 'hypothesis' && cm.manifest.required_next_action === 'test_required' && cm.children.length === 2, 'commit ' + JSON.stringify([cm.ok, cm.rule, cm.manifest && cm.manifest.claim_status, cm.children && cm.children.length]));
    expect(cm.children.every(ch => ch.output_permissions === 'sealed' && ch.goal_ancestry.includes(M.problem_id) && ch.claim_status === 'hypothesis'), 'sub-manifest lineage');
    expect(!['resolved_manifest', 'verified_claim', 'named_concept'].includes(cm.manifest.claim_status) && ex, 'promoted'); });
  C('MEAP', 'chemistry (limiting reagent): threshold derived; yields conditional → partial_resolution; supplying m(O2)=16 g establishes O2, eliminates H2 (archived), derives 18.02 g → resolved_manifest', () => {
    const M = prob('chemistry'), { cy, cm } = run(M); expect(cm.ok && cm.manifest.claim_status === 'partial_resolution' && cm.manifest.required_next_action === 'test_required', 'first ' + (cm.manifest && cm.manifest.claim_status));
    expect(by(cy, c => c.kind === 'conditional').length === 2 && by(cy, c => c.kind === 'derived')[0].value === '2000/63', 'conditional/threshold');
    const s = P.supply(cm.manifest, 'u1', '16'); expect(s.ok, 'supply'); const r2 = run(s.manifest);
    expect(opt(r2.cy, 'O2').kind === 'established' && opt(r2.cy, 'H2').kind === 'eliminated' && opt(r2.cy, 'H2').route === 'archived', 'O2/H2 ' + opt(r2.cy, 'O2').kind + '/' + opt(r2.cy, 'H2').kind);
    expect(r2.cm.ok && r2.cm.manifest.claim_status === 'resolved_manifest' && r2.cm.manifest.proof_debt_micro === 0, 'second ' + JSON.stringify([r2.cm.rule, r2.cm.manifest && r2.cm.manifest.claim_status]));
    const h = P.handoff(r2.cm.manifest).params; expect(h.established.join() === 'O2 is limiting' && h.eliminated.join() === 'H2 is limiting' && h.derived.some(x => /18\.02 g/.test(x)), 'handoff ' + JSON.stringify(h));
    expect(r2.cm.archive.some(a => a.claim === 'H2 is limiting') && r2.cm.withdrawn.length > 0 && r2.cm.withdrawn.every(w => /^wd:/.test(w.receipt)), 'archive/withdrawn'); });
  C('MEAP', 'biology (inheritance): XLD and AD tie on proof debt, the exact likelihood decides → XLD favoured; AR/XLR carry the extra carrier assumption; hypothesis + test_required (never established)', () => {
    const M = prob('biology'), { cy, cm } = run(M), sl = cy.slates.u1, fav = cy.candidates.find(c => c.candidate_id === sl.favoured);
    expect(fav && fav.option === 'XLD' && sl.ranking[1].decided_by === 'L', 'favoured ' + (fav && fav.option) + ' by ' + sl.ranking[1].decided_by);
    expect(opt(cy, 'AR').terms.B > opt(cy, 'AD').terms.B && opt(cy, 'XLR').terms.B > opt(cy, 'XLD').terms.B, 'carrier assumption adds proof debt');
    expect(cm.ok && cm.manifest.claim_status === 'hypothesis' && cm.manifest.required_next_action === 'test_required' && !cm.children.length, 'commit ' + (cm.manifest && cm.manifest.claim_status)); });
  C('MEAP', 'synthetic 4th problem (no canonical data): same machinery; conditions decide exactly (A 24 min fits, B 20 min fits → both established, no tie-break invented); an unfalsifiable option is quarantined Φ−1 as a speculative branch', () => {
    const M = P.normalize(SYN); expect(!P.validate(M).length, 'valid ' + P.validate(M)); const cy = P.cycle(M);
    expect(opt(cy, 'A').kind === 'established' && opt(cy, 'B').kind === 'established', 'A/B ' + opt(cy, 'A').kind + '/' + opt(cy, 'B').kind);
    const c = opt(cy, 'C'); expect(c.quarantine && c.claim_status === 'speculative_branch' && c.phase_path[1] === M.phase_state - 1 && c.route === 'shadow', 'speculative ' + JSON.stringify([c.claim_status, c.phase_path, c.route]));
    const cm = P.commit(M, cy, cy.resolution.candidate_id, true); expect(cm.ok && cm.archive.some(a => a.claim === c.claim && a.blocked_on.includes('capability:projection')) && !cm.manifest.claims.some(x => x.text === c.claim), 'quarantined branch committed or not archived');
    expect(P.requeue(cm.archive, 'kernel:manifest:test').some(r => r.claim === c.claim), 'kernel capability change does not requeue the shadow branch');
    expect(by(cy, x => x.op === 'derive').map(x => x.value).sort().join() === '20,24', 'derive'); });
  C('MEAP', 'archive (cold storage) + requeue: blocked items carry typed blocked_on; requeue only proposes (rerun_cycle) and adopting a grammar manifest returns proposals, never a commit', () => {
    const { cm: c1 } = run(prob('chemistry')), { cm } = run(P.supply(c1.manifest, 'u1', '16').manifest); expect(cm.archive.length && cm.archive.every(a => Array.isArray(a.blocked_on) && a.blocked_on.length), 'untyped archive ' + JSON.stringify(cm.archive.map(a => a.blocked_on)));
    const rq = P.requeue(cm.archive, 'value:u1'); expect(rq.length >= 1 && rq.every(r => r.proposal === 'rerun_cycle'), 'requeue ' + JSON.stringify(rq)); expect(!P.requeue(cm.archive, 'value:zz').length, 'requeue matched an unrelated capability'); });
};
