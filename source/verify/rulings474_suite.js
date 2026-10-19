/* 4.9.74 — Nic's rulings of 2026-10-18 (7:22 PM): the packet is the naming authority (CLEANUP-495 bans ProtoForge controls, not the word);
 * ⧧ splits a tie only when the tied options need different tests/conditions; the 'was inside/within' past atom is the 'was in' proposition
 * (alias class, as for the present tense). General checks only. */
module.exports = ({ C, expect, ROOT }) => {
  const fs = require('fs'), P = require(ROOT + '/src/mea_p.js'), CP = JSON.parse(fs.readFileSync(ROOT + '/data/canonical_problems.json', 'utf8'));
  const KM = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js'), LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
  const FKN = () => { const st = {}; let t = 0; return FK.ForgeKernel({ store: KM.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }), clock: () => new Date(Date.UTC(2026, 9, 18, 20, 0, 0) + (t++) * 1000).toISOString(), lexicon: LEX, lexiconExt: EXT }); };
  const tie = (fa, fb) => P.normalize({ id: 'synthetic:tie', domain: 'x', manifest: { goal: 'decide which supplier shipped the part', phase_state: 4, known_facts: [{ id: 'f1', text: 'one part arrived', tier: 'given' }],
    unknowns: [{ id: 'u1', text: 'which supplier', kind: 'choice', options: [{ id: 'A', text: 'supplier A shipped it', assumptions: [], falsifier: fa }, { id: 'B', text: 'supplier B shipped it', assumptions: [], falsifier: fb }] }],
    derivations: [], success_conditions: [{ id: 's1', text: 'the supplier is known', unknown: 'u1' }] } });
  const run = M => { const cy = P.cycle(M); return { cy, cm: P.commit(M, cy, cy.resolution.candidate_id, true) }; };
  C('RULINGS-474', 'ruling 1: the status panel names the ProtoForge layer; CLEANUP-495 still bans ProtoForge controls in the app screens', () => {
    const app = fs.readFileSync(ROOT + '/src/app.js', 'utf8'); expect(/\['ProtoForge layer', '[^']*Audit \/ Receipts[^']*M2 ledger[^']*containment/.test(app), 'status row');
    const run = fs.readFileSync(ROOT + '/verify/run.js', 'utf8'); expect(/CONTROLS = \/RUN-PROTOFORGE\|pfForm/.test(run), 'controls guard'); });
  C('RULINGS-474', 'ruling 2: a tie between options that need DIFFERENT tests splits into sub-manifests; a tie settled by the SAME test stays in the parent', () => {
    const d = run(tie('the shipping label names A', 'the shipping label names B')); expect(d.cm.ok && d.cm.children.length === 2 && P.splitNeeded(tie('x', 'y'), P.cycle(tie('x', 'y')), 'u1'), 'different tests did not split');
    const s = run(tie('the shipping label', 'the shipping label')); expect(s.cm.ok && s.cm.children.length === 0 && s.cm.manifest.claim_status === 'hypothesis', 'identical tests split: ' + s.cm.children.length);
    const n = P.cycle(tie(undefined, undefined)); expect(!n.resolution && n.candidates.filter(c => c.op === 'hypothesize').every(c => c.route === 'shadow'), 'two untestable options produced a committable resolution'); });
  C('RULINGS-474', 'ruling 2 on the canonical problems: physics (different falsifiers) and chemistry (complementary exact conditions) still split; biology (favoured option) does not', () => {
    const k = d => { const M = P.normalize(CP.problems.find(p => p.domain === d)); return run(M).cm.children.length; }; expect(k('physics') === 2 && k('chemistry') === 2 && k('biology') === 0, [k('physics'), k('chemistry'), k('biology')].join()); });
  C('RULINGS-474', 'past atoms keep the alias class: "X was inside/within Y. Where was X?" quotes the proposition "x was in y" (fuzz seeds 40397980, 135741104)', () => {
    for (const p of ['inside', 'within', 'in']) { const r = FKN().process(`Dikosum was ${p} Segovaf. Where was Dikosum?`).reply; expect(r.includes('“dikosum was in segovaf”'), p + ': ' + r); } });
  /* 4.9.73 CI fuzz job hung to its 30-minute timeout. Cause (reproduced: seed 986631739 = the 2nd fuzz seed after 1366960891): the verifier's own nonce
     generator — a float LCG whose product ran past 2^53, fell into a 220-state cycle, and nonce() looped forever looking for an unused word.
     Not a pipeline hang. Fixed generally: exact Math.imul LCG, bounded nonce(), and a per-seed time limit in tools/fuzz.js that LOGS a hang. */
  C('RULINGS-474', 'fuzz harness: the GELC nonce generator is exact (no short cycle from seed 986631739), nonce() is bounded, and tools/fuzz.js limits and logs each seed', () => {
    const g = fs.readFileSync(ROOT + '/verify/gelc_suite.js', 'utf8'), f = fs.readFileSync(ROOT + '/tools/fuzz.js', 'utf8');
    expect(/Math\.imul\(seed, 1103515245\)/.test(g) && !/seed = \(seed \* 1103515245/.test(g) && /nonce generator exhausted/.test(g), 'generator');
    let seed = 986631739; const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed; }; const seen = new Set(); for (let i = 0; i < 200000; i++) { expect(!seen.has(seed), 'cycle at ' + i); seen.add(seed); rnd(); }
    expect(/timeout: SEED_MS/.test(f) && /HARNESS/.test(f) && /a hang is a pipeline bug/.test(f), 'fuzz timeout'); });
  /* fuzz seed 1449880559 (old generator): "remember that Nuzug is a defin" — "defin" is known only by provisional morphology (de- + fin → verb). */
  C('RULINGS-474', 'a word known only by provisional derivation is taught like an unknown word, and the taught category is then used ("defin": de- + fin)', () => {
    const f = FKN(), r1 = f.process('remember that Nuzug is a defin').reply; expect(/Please answer “noun”/.test(r1), r1); const r2 = f.process('noun').reply; expect(/^I noted that Nuzug is a defin/.test(r2), r2);
    const r3 = f.process('is Nuzug a defin?').reply; expect(/^Yes\./.test(r3), r3); });
  /* found while writing the MEA-K lexicon-class guard: the turn-world pronoun resolver used recency only */
  C('RULINGS-474', 'pronoun gender agreement in the turn world: "The aunt is tall. Is he tall?" is not answered from the aunt; "she" is', () => {
    const yes = r => /(?:^|[.!?] )Yes\b/.test(r.reply); expect(!yes(FKN().process('The aunt is tall. Is he tall?')), 'he took aunt'); expect(yes(FKN().process('The aunt is tall. Is she tall?')), 'she refused aunt');
    expect(yes(FKN().process('The aunt is tall. The uncle is short. Is he short?')) && yes(FKN().process('The aunt is tall. The uncle is short. Is she tall?')), 'two referents');
    expect(yes(FKN().process('Tom is tall. Bob is short. Is he short?')), 'ungendered names keep recency'); });
};
