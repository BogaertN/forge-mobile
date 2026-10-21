/* DYNAMICS (4.9.65, M4): cause/effect + rate/time operators and the adverb-scope / measurement-report constructions (dynamics.js), with Echo and
 * the M2 ledger. Cases are written fresh for these mechanisms (generic resources and names, not the held-out file and not one fixed sentence). */
module.exports = ({ C, expect, ROOT }) => {
  const KM = require(ROOT + '/src/kernel.js'), DY = require(ROOT + '/src/dynamics.js'); const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
  const K = () => { const st = {}; return KM.Kernel({ clock: () => '2026-10-18T12:00:00Z', lexicon: LEX, lexiconExt: EXT, store: KM.MemoryStore({ get: k => (k in st ? st[k] : null), set: (k, v) => { st[k] = String(v); }, del: k => { delete st[k]; }, keys: () => Object.keys(st) }) }); };
  const dyn = r => r.trace.echo.pass && (r.trace.rules || []).some(x => /^DYN-/.test(x.id)), run = (f, ts) => ts.map(t => f.process(t));
  C('DYN-RATE', 'a level with constant inflow and outflow: time to fill = (capacity − start) ÷ (in − out), exact, with the stated assumptions (unstated start = empty, said); Echo re-computes it', () => {
    const r = K().process('A 100-gallon tank fills at 5 gallons per minute and drains at 2 gallons per minute. How long does it take to fill?');
    expect(dyn(r) && /= 33 1\/3 minutes\./.test(r.reply) && /assumed “the rates stay constant”/.test(r.reply) && /starts with 0 gallons/.test(r.reply), r.reply);
    const g = K().process('A ledger holds 12 tokens. It loses 3 tokens per hour. How long until it is empty?'); expect(dyn(g) && /= 4 hours\./.test(g.reply), 'generic resource: ' + g.reply);
    const n = K().process('A 60-liter vat fills at 1 liter per minute and leaks 4 liters per minute. How long does it take to fill?'); expect(dyn(n) && /does not reach “60 liters”/.test(n.reply), 'never fills: ' + n.reply);
    const u = K().process('A pool holds 40 liters. It fills at 2 kilograms per minute. How long does it take to fill?'); /* 4.9.78 test edit: gallons vs liters is no longer the incompatible example (qualified = exact, unqualified = ambiguous; r478_suite) */ expect(!/= \d/.test(u.reply) && /no conversion between/.test(u.reply), 'mixed volume units must not be computed (4.9.77 C7: a diagnostic, no number): ' + u.reply); });
  C('DYN-RATE', 'the level after a duration (state equation), a what-if that branches from the STATED scenario (never cumulative), a measurement that conflicts is kept, and a stated lower bound qualifies the answer', () => {
    const f = K(), a = f.process('A tank contains 100 gallons. A pump removes 10 gallons each minute for 3 minutes. How much remains?'); expect(dyn(a) && /= 70 gallons\./.test(a.reply), a.reply);
    const b = f.process('What if it ran 5 minutes?'); expect(dyn(b) && /× 5 minutes = 50 gallons\./.test(b.reply), 'branch: ' + b.reply);
    const c = f.process('I measured 80 gallons after 3 minutes'); expect(dyn(c) && /= 70 gallons\./.test(c.reply) && /reported “80 gallons after 3 minutes”/.test(c.reply) && /conflict/.test(c.reply) && /did not replace my prediction/.test(c.reply), 'measurement: ' + c.reply);
    expect(!f.worldState().relations.length && !f.worldState().entities.length, 'the scenario wrote to the durable world');
    const d = K().process('A reservoir contains 90 units and cannot go below 30 units. A valve removes 15 units each minute. How much remains after 6 minutes?'); expect(dyn(d) && /= 4 minutes\./.test(d.reply) && /reached “30 units”/.test(d.reply) && /stays at 30 units until 6 minutes/.test(d.reply), 'bound: ' + d.reply);
    const e = K().process('A barrel has 10 liters. It gains 3 liters per minute and loses 1 liter per minute. How much is in it after 4 minutes?'); expect(dyn(e) && /= 18 liters\./.test(e.reply), e.reply); });
  C('DYN-REPORTS', 'measurement reports: each value attributed to its source; different values at the same time are an unresolved conflict and are never averaged; equal values agree; different times are not a conflict', () => {
    const a = K().process('Sensor S1 reports 20 C, S2 reports 30 C at the same time; what do we know?'); expect(dyn(a) && /“Sensor S1” reports “20 °C”\. “S2” reports “30 °C”\. I report a conflict\. I do not average the reports\./.test(a.reply), a.reply);
    const b = K().process('Probe P7 reads 4.5 V and probe P8 reads 4.5 V at the same time. What do we know?'); expect(dyn(b) && /The reports agree\./.test(b.reply), b.reply);
    const c = K().process('Gauge G1 shows 12 psi at 9:00, gauge G2 shows 15 psi at 10:00; what do we know?'); expect(dyn(c) && !/conflict/.test(c.reply), 'different times: ' + c.reply); });
  C('DYN-SCOPE', 'a fronted sentence adverb over a subject with a relative clause modifies the MAIN verb (structure dependence): asked about the inner verb the sentence does not say it; about the main verb, yes — for any adverb and verbs', () => {
    const a = K().process('Instinctively, eagles that fly swim. Do eagles fly instinctively?'); expect(dyn(a) && /“instinctively” modifies “swim”/.test(a.reply) && /does not modify “fly”/.test(a.reply) && !/^Yes/.test(a.reply), a.reply);
    const b = K().process('Instinctively, eagles that fly swim. Do eagles swim instinctively?'); expect(dyn(b) && /Yes\. The sentence says “eagles that fly swim instinctively”/.test(b.reply), b.reply);
    const c = K().process('Quietly, dogs that bark run. Do dogs bark quietly?'); expect(dyn(c) && /“quietly” modifies “run”/.test(c.reply) && /does not modify “bark”/.test(c.reply), c.reply);
    const d = K().process('Instinctively, eagles that fly swim.'); expect(dyn(d) && /modifies “swim”/.test(d.reply), 'statement alone: ' + d.reply); });
  C('DYN-CAUSAL', 'causal links are durable-world data: "causes / leads to / triggers" chain through the declared rows (a checked RuleProof, ledger item, the chain shown); a reversed question stays open', () => {
    const f = K(); run(f, ['remember that drizzle leads to puddles', 'remember that puddles cause slips']); const r = f.process('does drizzle cause slips?');
    expect(/^Yes, I infer that drizzle causes slips\. You told me that drizzle leads to puddles\. You told me that puddles cause slips\./.test(r.reply) && r.trace.echo.pass, r.reply);
    expect(f.justifications().some(j => /drizzle causes slips/.test(j.text) && j.status === 'in'), 'no ledger item'); expect(f.worldState().relations.some(x => x.origin === 'derived' && x.pred === 'cause' && x.a === 'drizzle' && x.b === 'slips'), 'durable world lacks the derived causal link');
    expect(!/^Yes/.test(f.process('does slips cause drizzle?').reply), 'reverse causation inferred'); });
  C('DYN-CAUSAL', 'what-if (intervention) over stored links: do(X) follows every chain, a stated prevention qualifies an effect, removing X separates what keeps another stored cause from what has none; stored "if X, Y" chains too; each answer is a ledger item withdrawn when a premise is forgotten', () => {
    const f = K(); run(f, ['remember that frost causes cracks', 'remember that cracks cause leaks', 'remember that insulation prevents leaks', 'remember that impacts cause cracks']);
    const a = f.process('what happens if there is frost?'); expect(dyn(a) && /“frost” causes “cracks”\. “cracks” causes “leaks”\. “insulation” prevents “leaks”\./.test(a.reply), a.reply);
    const b = f.process('what if there is no frost?'); expect(dyn(b) && /“impacts” also causes “cracks”/.test(b.reply) && !/has no other stored cause/.test(b.reply), 'removal with another cause: ' + b.reply);
    const it = f.justifications().find(j => /^without frost/.test(j.text)); expect(it && it.status === 'in' && it.justifications[0].rules.includes('CAUSAL-REMOVE'), 'ledger: ' + JSON.stringify(it && it.text));
    run(f, ['forget that impacts cause cracks', 'yes']); expect(f.justifications().find(j => j.id === it.id).status !== 'in', 'not withdrawn after its premise was forgotten');
    const c = f.process('what if there is no frost?'); expect(dyn(c) && /“cracks” has no other stored cause/.test(c.reply) && /“leaks” has no other stored cause/.test(c.reply), 'after forgetting: ' + c.reply);
    const g = K(); run(g, ['remember that if the valve opens then the pipe fills', 'remember that if the pipe fills then the gauge rises']); const d = g.process('what happens if the valve opens?');
    expect(dyn(d) && /You told me “if the valve opens, the pipe fills”\. You told me “if the pipe fills, the gauge rises”\./.test(d.reply), 'conditional chain: ' + d.reply);
    expect(/the pipe fills; the gauge rises/.test(g.process('why?').reply), 'why? does not read the what-if back'); });
  C('DYN-PURE', 'dynamics.js is exact and data-driven: rationals (no floats), verb classes and time units as data, no domain words, and its check recomputes every decision', () => {
    const src = require('fs').readFileSync(ROOT + '/src/dynamics.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); expect(!/\btank\b|\beagle|\bsensor|parseFloat|Math\.round/.test(src), 'domain word or float arithmetic in dynamics.js');
    const m = DY.read('A drum holds 7 liters. It loses 2 liters per minute. How long until it is empty?', {}); expect(m.result.text === '3 1/2 minutes' && DY.check(m, {}) === true, JSON.stringify(m.result));
    expect(DY.check(Object.assign({}, m, { result: { text: '3 minutes' } }), {}) === false, 'a wrong result passed the check'); });
};
