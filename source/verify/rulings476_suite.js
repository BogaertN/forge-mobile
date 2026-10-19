/* 4.9.76: Nic's rulings (2026-10-19, carried from the 2026-10-18 MEA rulings), written FIRST:
 * 3. proof debt: an INTERNAL premise is unproven (it counts as debt); a PUBLISHED premise is proven (discharged).
 * 4. two options that BOTH meet their exact conditions are BOTH established: no tie, no split, no single pick.
 * 5. a capability change (MEA-K or meta adoption) requeues quarantined (archived) branches as PROPOSALS only: nothing re-runs, commits or adopts by itself.
 * General checks only. */
module.exports = ({ C, expect, ROOT }) => {
  const P = require(ROOT + '/src/mea_p.js'), KM = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js'), LEX = require(ROOT + '/data/lexicon.json');
  const FKN = () => { const st = {}; let t = 0; return FK.ForgeKernel({ store: KM.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }), clock: () => new Date(Date.UTC(2026, 9, 19, 20, 0, 0) + (t++) * 1000).toISOString(), lexicon: LEX }); };
  const deriveWith = tier => P.normalize({ id: 'syn:debt-' + tier, domain: 'x', manifest: { goal: 'compute the load', phase_state: 4, known_facts: [{ id: 'f1', text: 'the load is 12 kN', tier }, { id: 'f2', text: 'the factor is 3', tier: 'given' }],
    unknowns: [], derivations: [{ id: 'd1', expr: '12*3', claim: 'the design load is {v} kN', uses: ['f1', 'f2'] }], success_conditions: [{ id: 's1', text: 'computed', derivations: ['d1'] }] } });
  C('RULINGS-476', 'ruling 3: an internal premise is unproven (proof debt B > 0); a published premise is proven (B = 0)', () => {
    const b = tier => { const M = deriveWith(tier), cy = P.cycle(M), d = cy.candidates.find(c => c.op === 'derive'); return d && d.terms ? d.terms.B : null; };
    expect(b('internal') > 0, 'internal premise discharged: B=' + b('internal')); expect(b('published') === 0, 'published premise not discharged: B=' + b('published'));
    expect(P.DISCHARGED.includes('published') && !P.DISCHARGED.includes('internal'), 'tier table'); });
  const both = (a, b) => P.normalize({ id: 'syn:both', domain: 'x', manifest: { goal: 'decide which bounds hold', phase_state: 4, known_facts: [{ id: 'f1', text: 'x is 5', tier: 'given' }],
    unknowns: [{ id: 'ux', text: 'x', kind: 'quantity', symbol: 'x', value: '5' }, { id: 'u1', text: 'which bound holds', kind: 'choice', options: [{ id: 'A', text: 'x exceeds 1', assumptions: [], condition: a }, { id: 'B', text: 'x is below 10', assumptions: [], condition: b }] }],
    derivations: [], success_conditions: [{ id: 's1', text: 'known', unknown: 'u1' }] } });
  C('RULINGS-476', 'ruling 4: two options that both meet exact conditions are both established — committed together, no split, no single pick', () => {
    const M = both({ lhs: 'x', op: '>', rhs: '1' }, { lhs: 'x', op: '<', rhs: '10' }), cy = P.cycle(M);
    expect(cy.candidates.filter(c => c.op === 'hypothesize' && c.kind === 'established').length === 2, 'both not established');
    expect(!P.splitNeeded(M, cy, 'u1') && !cy.candidates.some(c => c.op === 'split' && c.route === 'eligible'), 'established options split');
    const cm = P.commit(M, cy, cy.resolution.candidate_id, true), U = cm.manifest.unknowns.find(u => u.id === 'u1');
    expect(cm.ok && cm.children.length === 0 && JSON.stringify(U.resolved_options) === '["A","B"]', 'commit: ' + JSON.stringify({ children: cm.children && cm.children.length, U }));
    const one = both({ lhs: 'x', op: '>', rhs: '1' }, { lhs: 'x', op: '>', rhs: '10' }), c1 = P.cycle(one), m1 = P.commit(one, c1, c1.resolution.candidate_id, true), U1 = m1.manifest.unknowns.find(u => u.id === 'u1');
    expect(m1.ok && U1.resolved_option === 'A' && JSON.stringify(U1.resolved_options) === '["A"]', 'single established option: ' + JSON.stringify(U1)); });
  C('RULINGS-476', 'ruling 5: a capability change requeues every quarantined branch citing it as a PROPOSAL only (route "proposal", adopt false); no problem, candidate or adoption changes by itself', () => {
    const f = FKN(); const P0 = require(ROOT + '/src/mea_p.js');
    const qa = [{ id: 'arc:q1', problem_id: 'p1', claim: 'a shadow branch', route: 'shadow', blocked_on: ['capability:projection'] }, { id: 'arc:q2', problem_id: 'p1', claim: 'a rejected branch', route: 'rejected', blocked_on: ['gate:legality'] }];
    const pure = P0.requeue(qa, 'kernel:grammar:test-capability'); expect(pure.length === 1 && pure[0].archive_id === 'arc:q1' && pure[0].route === 'proposal' && pure[0].adopt === false, 'pure requeue: ' + JSON.stringify(pure));
    f.store.save('mea_archive', qa);
    const before = JSON.stringify([f.store.load('mea_problems'), f.store.load('mea_candidates'), f.store.load('mea_archive'), f.store.load('admitted_manifests_k'), f.store.load('admitted_meta')]);
    const rk = f.meaRequeueK('kernel:grammar:test-capability'); expect(rk.every(x => x.route === 'proposal' && x.adopt === false), 'MEA-K requeue not proposals');
    const rq = f.meaRequeue('kernel:grammar:test-capability'); expect(Array.isArray(rq) && rq.length > 0, 'nothing requeued: ' + JSON.stringify(rq).slice(0, 200));
    expect(rq.every(x => x.route === 'proposal' && x.adopt === false && x.because === 'kernel:grammar:test-capability'), 'not proposals: ' + JSON.stringify(rq[0]));
    expect(JSON.stringify([f.store.load('mea_problems'), f.store.load('mea_candidates'), f.store.load('mea_archive'), f.store.load('admitted_manifests_k'), f.store.load('admitted_meta')]) === before, 'requeue changed state'); });
};
