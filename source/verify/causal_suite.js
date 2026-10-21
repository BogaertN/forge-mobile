/* M4-CAUSAL (4.9.77): the cause/effect engine against WMS §5.10–5.12 and KERNEL_COMPONENTS_SPEC R-WM-2..5, written FIRST.
 * Every dynamics answer carries a CausalResult (forge-causal-result/v1) with mode, status, assumptions, premise refs, effects and a world version;
 * the tank example and its 65-gallon measurement; the same solver for battery and inventory; C1 unseen symbols, C2 association ≠ cause, C3 an
 * unresolved precondition, C4 competing explanations, C5 intervention isolation, C7 dimension diagnostic, C9 premise revision, C10 paraphrase,
 * C12 budget, C13 no action or memory write. General cases with fresh names; no held-out text. */
module.exports = ({ C, expect, ROOT }) => {
  const KM = require(ROOT + '/src/kernel.js'), DY = require(ROOT + '/src/dynamics.js'), LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
  const K = () => { const st = {}; const k = KM.Kernel({ clock: () => '2026-10-19T20:00:00Z', lexicon: LEX, lexiconExt: EXT, store: KM.MemoryStore({ get: x => (x in st ? st[x] : null), set: (x, v) => { st[x] = String(v); }, del: x => { delete st[x]; }, keys: () => Object.keys(st) }) }); k._st = st; return k; };
  const CR = r => r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.causal, run = (f, ts) => ts.map(t => f.process(t));
  const durable = f => JSON.stringify([f.worldState().relations, f.worldState().entities, f._st.facts || null, f._st.rmc_facts || null]);
  C('M4-CAUSAL', 'tank (WMS §5.11): 100 gal − 10 gal/min × 3 min = 70 gal is a CONDITIONAL prediction (CausalResult predict / conditionally_predicted, its assumptions and equation), never stored as observed', () => {
    const f = K(), before = durable(f), r = f.process('A tank contains 100 gallons. A pump removes 10 gallons each minute for 3 minutes. How much remains?'), c = CR(r);
    expect(/= 70 gallons\./.test(r.reply) && r.trace.echo.pass, r.reply);
    expect(c && c.schema === 'forge-causal-result/v1' && c.mode === 'predict' && c.status === 'conditionally_predicted' && c.assumptions.some(a => /constant/.test(a)) && c.derived_effects.length === 1 && /70 gallons/.test(c.derived_effects[0].text) && c.derived_effects[0].observed === false, 'causal result ' + JSON.stringify(c));
    expect(typeof c.world_version === 'string' && c.world_version.length >= 8 && durable(f) === before, 'world written or no version'); });
  C('M4-CAUSAL', 'a measurement that differs (65 gal) stays a separate claim: the prediction is kept, candidate explanations are listed from the model\'s own inputs (start, rate, duration, an unmodelled outflow, the measurement) and none is asserted — no leak is concluded', () => {
    const f = K(); f.process('A tank contains 100 gallons. A pump removes 10 gallons each minute for 3 minutes. How much remains?'); const r = f.process('I measured 65 gallons after 3 minutes'), c = CR(r);
    expect(/= 70 gallons\./.test(r.reply) && /reported “65 gallons after 3 minutes”/.test(r.reply) && /did not replace my prediction/.test(r.reply), r.reply);
    expect(/candidate explanations?/.test(r.reply) && /unmodelled outflow/.test(r.reply) && /the measurement/.test(r.reply) && /the start/.test(r.reply) && /I do not conclude “which one holds”/.test(r.reply) && !/\bleak/.test(r.reply), 'explanations: ' + r.reply);
    expect(c && c.status === 'candidate_explanation' && c.competing_models.length >= 4 && c.counterevidence_refs.length === 1 && /65 gallons/.test(c.counterevidence_refs[0]), JSON.stringify(c));
    const g = K(); g.process('A tank contains 100 gallons. A pump removes 10 gallons each minute for 3 minutes. How much remains?'); const u = g.process('I measured 80 gallons after 3 minutes');
    expect(/unmodelled inflow/.test(u.reply) && !/unmodelled outflow/.test(u.reply), 'a higher reading names an inflow, not an outflow: ' + u.reply); });
  C('M4-CAUSAL', 'the same solver for battery / charge and inventory / stock (WMS §5.11): compound units, other verbs of flow, correct plurals; no domain word in dynamics.js', () => {
    const a = K().process('A battery contains 100 amp-hours. A motor draws 10 amp-hours each hour for 3 hours. How much remains?'); expect(/= 70 amp-hours\./.test(a.reply) && CR(a).status === 'conditionally_predicted', a.reply);
    const b = K().process('A warehouse has 500 crates. A truck dispatches 40 crates each day for 5 days. How many remain?'); expect(/× 5 days = 300 crates\./.test(b.reply), b.reply);
    const src = require('fs').readFileSync(ROOT + '/src/dynamics.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); expect(!/\b(?:tank|battery|warehouse|crate|motor|truck)\b/.test(src), 'domain word in dynamics.js'); });
  C('M4-CAUSAL', 'C7 dimension check: incompatible units block the derivation with a diagnostic naming both units (status unsupported, missing "unit conversion"); no number is produced', () => {
    const r = K().process('A tank contains 100 kilograms. A pump removes 10 liters each minute for 3 minutes. How much remains?'), c = CR(r); /* 4.9.78 test edit: litres ↔ gallons is now an exact (qualified) or ambiguous (unqualified) case (r478_suite); a mass vs a volume stays incompatible */
    expect(/kilograms/.test(r.reply) && /liters/.test(r.reply) && /no conversion/.test(r.reply) && !/= \d/.test(r.reply) && c && c.status === 'unsupported' && c.missing.includes('unit conversion'), r.reply + ' ' + JSON.stringify(c)); });
  C('M4-CAUSAL', 'C3 unresolved precondition: an unstated start for "how much after" yields an unsupported result that asks for the start; nothing is assumed or invented', () => {
    const r = K().process('A pump removes 10 gallons each minute. How much remains after 3 minutes?'), c = CR(r);
    expect(c && c.status === 'unsupported' && c.missing.includes('the starting amount') && /starting amount/.test(r.reply) && !/= \d/.test(r.reply), r.reply + ' ' + JSON.stringify(c)); });
  C('M4-CAUSAL', 'C10 paraphrase: "how much remains / is left / what is the level after" give the same equation and result', () => {
    const base = 'A drum contains 50 liters. A valve removes 4 liters each minute for 5 minutes. ', rs = ['How much remains?', 'How much is left?', 'What is the level after 5 minutes?'].map(q => K().process(base + q));
    expect(rs.every(r => /= 30 liters\./.test(r.reply)) && new Set(rs.map(r => JSON.stringify(CR(r).derived_effects))).size === 1, rs.map(r => r.reply).join(' | ')); });
  C('M4-CAUSAL', 'C2 association is not cause: a stored correlation never authorises an intervention prediction; the what-if says so (status unsupported)', () => {
    const f = K(); run(f, ['remember that rain correlates with umbrellas']); const r = f.process('what happens if there is rain?'), c = CR(r);
    expect(c && c.status === 'unsupported' && /correlat|associat/.test(r.reply) && /does not tell me what an intervention/.test(r.reply) && !/causes “umbrellas”/.test(r.reply), r.reply + ' ' + JSON.stringify(c));
    const g = K(); run(g, ['remember that rain is associated with umbrellas']); const s = g.process('what happens if there is rain?'); expect(CR(s) && CR(s).status === 'unsupported', 'phrase form: ' + s.reply); });
  C('M4-CAUSAL', 'C5 / C13 intervention isolation: a what-if over stored links is mode intervene / conditionally_predicted with its intervention and premise refs; the world version, facts and tool jobs are unchanged', () => {
    const f = K(); run(f, ['remember that frost causes cracks', 'remember that cracks cause leaks']); const v0 = durable(f), r = f.process('what happens if there is frost?'), c = CR(r);
    expect(c && c.mode === 'intervene' && c.status === 'conditionally_predicted' && JSON.stringify(c.intervention_refs) === '["frost"]' && c.premise_refs.length === 2 && c.derived_effects.length === 2, JSON.stringify(c));
    expect(durable(f) === v0 && !r.toolJob && c.world_version === CR(f.process('what happens if there is frost?')).world_version, 'the what-if changed the world or called a tool');
    f.process('remember that ice causes cracks'); expect(CR(f.process('what happens if there is frost?')).world_version !== c.world_version, 'a new stated link must advance the world version'); });
  C('M4-CAUSAL', 'C9 premise revision: forgetting a stored link withdraws the what-if conclusion built on it (JTMS), and the next result no longer cites it', () => {
    const f = K(); run(f, ['remember that frost causes cracks', 'remember that cracks cause leaks']); const c = CR(f.process('what happens if there is frost?'));
    const it = f.justifications().find(j => /^if frost/.test(j.text)); expect(it && it.status === 'in', 'no ledger item');
    run(f, ['forget that cracks cause leaks', 'yes']); expect(f.justifications().find(j => j.id === it.id).status !== 'in', 'not withdrawn');
    const d = CR(f.process('what happens if there is frost?')); expect(d && d.premise_refs.length === 1 && d.derived_effects.length === 1 && c.premise_refs.length === 2, JSON.stringify(d)); });
  C('M4-CAUSAL', 'C1 unseen symbols + C12 budget (pure): a chain of nonce names binds and derives; past the link budget the result is resource_limited with the frontier kept, never "complete"', () => {
    const nm = i => 'zq' + 'bdfgklmnprstvz'[i % 14] + 'aeiou'[i % 5] + i, links = Array.from({ length: 60 }, (_, i) => ({ a: nm(i), b: nm(i + 1), kind: 'cause', premise: 'p' + i, text: nm(i) + ' causes ' + nm(i + 1) })), nodes = [...new Set(links.flatMap(l => [l.a, l.b]))];
    const s = DY.readWhatIf('what happens if there is ' + nm(0), links.slice(0, 5), nodes.slice(0, 6)); expect(s && s.effects.length === 5 && s.status !== 'resource_limited', 'short chain ' + JSON.stringify(s && s.status));
    const m = DY.readWhatIf('what happens if there is ' + nm(0), links, nodes); expect(m && m.status === 'resource_limited' && m.effects.length === DY.LINK_BUDGET && m.frontier.length >= 1, 'budget ' + JSON.stringify(m && { st: m.status, n: m.effects.length, f: m.frontier })); });
  C('M4-CAUSAL', 'C4 competing causes stay explicit: removing one cause names the other stored cause of the same effect (both kept, neither chosen)', () => {
    const f = K(); run(f, ['remember that frost causes cracks', 'remember that impacts cause cracks']); const r = f.process('what if there is no frost?'), c = CR(r);
    expect(/“impacts” also causes “cracks”/.test(r.reply) && c && c.mode === 'intervene' && c.competing_models.some(x => /impacts/.test(x)), r.reply + ' ' + JSON.stringify(c)); });
};
