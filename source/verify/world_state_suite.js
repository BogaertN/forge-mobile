/* WORLD STATE (4.9.60, M3 part 1): durable world state + relation properties declared as data. The durable world is rebuilt from the user's
 * active stored facts only (entities, relations, attributes with provenance premise / turn / source); relations derived through the DECLARED
 * properties (world_rules.js RELATIONS: transitive, symmetric, inverse pairs, functional) are M2 ledger items, so retraction keeps the state
 * consistent. The turn world ("Suppose …", premises in one message) gets the same rules sourced to the sentence and never writes here. */
module.exports = ({ C, expect, K, ROOT }) => {
  const fs = require('fs'), KM = require(ROOT + '/src/kernel.js'), WR = require(ROOT + '/src/world_rules.js');
  const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
  const shared = st => KM.Kernel({ clock: () => '2026-10-11T20:45:00Z', lexicon: LEX, lexiconExt: EXT, store: KM.MemoryStore({ get: k => (k in st ? st[k] : null), set: (k, v) => { st[k] = String(v); }, del: k => { delete st[k]; }, keys: () => Object.keys(st) }) });
  const run = (f, ts) => ts.map(t => f.process(t));
  const rels = f => f.worldState().relations.map(r => r.origin + ':' + r.text.toLowerCase());
  const chain = f => run(f, ['remember that Aster is inside Beryl', 'remember that Beryl is inside Cobalt']);
  const yes = r => /^Yes/.test(r.reply) && r.trace.echo.pass;
  C('WS-PERSIST', 'durable world state: entities, stated relations and attributes carry provenance (premise = stored fact id, turn, source); derived relations are ledger items justified by memory premises + RELPROP rule ids that re-derive on replay (tampering detected); a NEW kernel on the same store answers the chain and sees the same state', () => {
    const st = {}, f = shared(st); chain(f); f.process('remember that Aster is blue'); const ws = f.worldState();
    expect(ws.schema === 'FORGE-WORLD-STATE/v1' && ['ent:aster', 'ent:beryl', 'ent:cobalt'].every(id => ws.entities.some(e => e.id === id && e.premises.length >= 1 && /^mem:/.test(e.first.premise))), JSON.stringify(ws.entities).slice(0, 300));
    const st1 = ws.relations.filter(r => r.origin === 'stated'); expect(st1.length === 2 && st1.every(r => /^mem:/.test(r.premise) && r.source === 'stored fact' && typeof r.text === 'string' && 'turn' in r), JSON.stringify(st1).slice(0, 300));
    expect(ws.attributes.some(a => a.entity === 'aster' && /^mem:/.test(a.premise)), JSON.stringify(ws.attributes));
    const d = ws.relations.find(r => r.origin === 'derived' && r.text === 'aster is in cobalt'); expect(d && d.premises.length === 2 && d.rules.includes('RELPROP-TRANSITIVE:in'), JSON.stringify(ws.relations).slice(0, 400));
    const it = f.justifications().find(x => x.id === d.item); expect(it && it.kind === 'relation' && it.status === 'in' && it.justifications[0].premises.every(p => /^mem:/.test(p.id)) && it.justifications[0].replay.kind === 'relprop', JSON.stringify(it).slice(0, 300));
    expect(rels(f).includes('derived:cobalt contains aster'), 'inverse not derived');
    for (const x of f.justifications().filter(i => i.kind === 'relation')) { const r = f.replayJustification(x.id); expect(r.ok && r.justifications.every(j => j.hash_ok && j.rederived === true), 'relation replay ' + JSON.stringify(r)); }
    { const xs = f.store.load('justifications'), t = xs.find(i => i.id === d.item); t.justifications[0].rules = ['RELPROP-SYMMETRIC:in']; f.store.save('justifications', xs); expect(!f.replayJustification(d.item).ok, 'tampered relation replayed'); }
    const g = shared(st); expect(JSON.stringify(g.worldState().relations) === JSON.stringify(ws.relations), 'state differs in a new session');
    const r = g.process('does Cobalt contain Aster?'); expect(yes(r) && /Aster is inside Beryl/.test(r.reply) && /Beryl is inside Cobalt/.test(r.reply), r.reply);
    expect(f.categories.includes('world_state') && /CASE_CATS = new Set\(\[[^\]]*'world_state'/.test(fs.readFileSync(ROOT + '/src/kernel.js', 'utf8')), 'world_state not case-scoped'); });
  C('WS-RETRACT', 'retraction consistency: forgetting one premise withdraws every derived relation resting on it (listed with its receipt, never silently dropped), the chain answer is no longer given, and remembering it again restores the derived relations', () => {
    const f = K(); chain(f); expect(yes(f.process('is Aster inside Cobalt?')));
    run(f, ['forget that Beryl is inside Cobalt', 'yes']); const ws = f.worldState();
    expect(!rels(f).some(t => /cobalt/.test(t) && /^derived/.test(t)) && rels(f).includes('derived:beryl contains aster'), JSON.stringify(rels(f)));
    expect(['aster is in cobalt', 'cobalt contains aster', 'cobalt contains beryl'].every(t => ws.withdrawn.some(w => w.text === t && /^wd:/.test(w.receipt) && f.withdrawalReceipts().some(r => r.id === w.receipt))), JSON.stringify(ws.withdrawn).slice(0, 400));
    expect(!/^Yes/.test(f.process('is Aster inside Cobalt?').reply) && !/^Yes/.test(f.process('does Cobalt contain Aster?').reply));
    f.process('remember that Beryl is inside Cobalt'); expect(rels(f).includes('derived:aster is in cobalt') && yes(f.process('does Cobalt contain Aster?')), 'not restored'); });
  C('WS-SUPPOSE', '"Suppose …" isolation: a hypothetical chain is answered in a branch and neither memory nor the durable world state changes; premises given in one message never enter the durable state', () => {
    const f = K(); chain(f); f.process('where is Aster?'); const snap = () => JSON.stringify([f.store.load('memory'), f.store.load('world_state')]); const s0 = snap();
    const r = f.process('Suppose Pim is inside Quo. Quo is inside Rub. Is Pim inside Rub?'); expect(/branch/.test(r.reply) && /Yes/.test(r.reply) && r.trace.echo.pass, r.reply);
    const r2 = f.process('Suppose Ola is married to Pel. Is Pel married to Ola?'); expect(/Yes/.test(r2.reply), r2.reply);
    f.process('Kip contains Lop. Is Lop inside Kip?'); expect(snap() === s0, 'a hypothetical wrote durable state');
    expect(!f.worldState().entities.some(e => /pim|quo|ola|kip/.test(e.id)) && !/^Yes/.test(f.process('is Pim inside Rub?').reply), 'branch leaked'); });
  C('WS-TRANSITIVE', 'transitive (inside / part of / ancestor of / before …) in the turn world and in durable memory, with the property rule named', () => {
    const t = K().process('Ola is inside Pel. Pel is inside Ras. Is Ola inside Ras?'); expect(yes(t) && t.trace.selection.winner === 'world.proof', t.reply);
    const p = K().process('Gem is part of Hub. Hub is part of Ivo. Is Gem part of Ivo?'); expect(yes(p), p.reply);
    const f = K(); run(f, ['remember that Lia is an ancestor of Mo', 'remember that Mo is an ancestor of Ned']); const r = f.process('is Lia an ancestor of Ned?');
    expect(yes(r) && r.trace.rules.some(x => x.id === 'INF-RELPROP' && x.rules_used.includes('RELPROP-TRANSITIVE:ancestor_of')), r.reply + JSON.stringify(r.trace.rules.map(x => x.id))); });
  C('WS-SYMMETRIC', 'symmetric (married to / next to) in the turn world and in durable memory', () => {
    expect(yes(K().process('Ola is married to Pel. Is Pel married to Ola?')));
    const f = K(); run(f, ['remember that Ann is married to Bob', 'remember that Ann is next to Cy']); const a = f.process('is Bob married to Ann?'), b = f.process('is Cy next to Ann?');
    expect(yes(a) && yes(b) && a.reply === 'Yes, I infer that Bob is married to Ann. You told me that Ann is married to Bob. I used 1 rule.' && a.trace.rules.find(x => x.id === 'INF-RELPROP').rules_used.includes('RELPROP-SYMMETRIC:married_to'), a.reply);
    expect(!/^Yes/.test(K().process('Ola is inside Pel. Is Pel inside Ola?').reply), 'inside treated as symmetric'); });
  C('WS-INVERSE', 'inverse pairs (contains/inside, parent/child, ancestor/descendant) in the turn world and in durable memory', () => {
    expect(yes(K().process('Kip contains Lop. Is Lop inside Kip?')));
    const f = K(); run(f, ['remember that Tom is the parent of Sue', 'remember that Lia is an ancestor of Mo', 'remember that Mo is an ancestor of Ned']);
    const a = f.process('is Sue the child of Tom?'), b = f.process('is Ned a descendant of Lia?'); expect(yes(a) && yes(b), a.reply + ' / ' + b.reply);
    expect(a.trace.rules.find(x => x.id === 'INF-RELPROP').rules_used.includes('RELPROP-INVERSE:child_of<parent_of'), JSON.stringify(a.trace.rules.find(x => x.id === 'INF-RELPROP'))); });
  C('WS-FUNCTIONAL', 'functional relations: a second different value is a real contradiction — the turn world reports conflicting proofs; durable memory asks before replacing and writes nothing; one value alone is no conflict', () => {
    const t = K().process('Vin is the mother of Wes. Xan is the mother of Wes. Is Vin the mother of Wes?'); expect(/conflict/.test(t.reply), t.reply);
    expect(yes(K().process('Vin is the mother of Wes. Is Vin the mother of Wes?')), 'single value conflicted');
    const f = K(); f.process('remember that Ann was born in Paris'); const m0 = JSON.stringify(f.store.load('memory')); const r = f.process('remember that Ann was born in Rome');
    expect(r.msm.meaning.kind === 'confirm_replace' && r.trace.rules.some(x => x.id === 'MEM-CONFLICT-FUNCTIONAL-RELATION') && JSON.stringify(f.store.load('memory')) === m0, r.reply);
    const g = K(); run(g, ['remember that Ann was born in Paris', 'remember that Bob was born in Paris']); expect(g.store.load('memory').filter(x => x.status === 'active').length === 2, 'different subjects conflicted'); });
  C('WS-WHY', '"why?" after a durable chain answer explains the chain from the recorded premises (Echo re-verified); after a turn-world chain it names the sentences', () => {
    const f = K(); chain(f); f.process('is Aster inside Cobalt?'); const w = f.process('why?');
    expect(w.reply === 'I derived “Aster is inside Cobalt” from “Aster is inside Beryl” and “Beryl is inside Cobalt”. It uses 1 rule.' && w.trace.echo.pass && w.trace.selection.winner === 'justify.followup', w.reply);
    f.process('does Cobalt contain Aster?'); const w2 = f.process('why?'); expect(/from “Aster is inside Beryl” and “Beryl is inside Cobalt”/.test(w2.reply) && w2.trace.echo.pass, w2.reply);
    const g = K(); g.process('Ola is inside Pel. Pel is inside Ras. Is Ola inside Ras?'); const w3 = g.process('why?'); expect(/from “Ola is inside Pel” and “Pel is inside Ras”/.test(w3.reply), w3.reply); });
  C('WS-DATA', 'relation properties are DATA: every RELATIONS row uses only declared keys, inverse partners are mutual, functional is subject|object; the grammar reads the declared phrases (no relation phrase is hard-coded in reason.js); RELPROP rule ids are stable; no numeric weights', () => {
    const KEYS = new Set(['pred', 'phrase', 'transitive', 'symmetric', 'inverse', 'functional', 'containment', 'alias', 'same_as', 'comparative', 'one']), by = new Map(WR.RELATIONS.map(r => [r.pred, r]));
    expect(Object.isFrozen(WR.RELATIONS) && WR.RELATIONS.length >= 20, 'table');
    for (const r of WR.RELATIONS) { expect(Object.keys(r).every(k => KEYS.has(k)) && Object.values(r).every(v => typeof v !== 'number'), JSON.stringify(r));
      if (r.inverse) expect(by.has(r.inverse) && by.get(r.inverse).inverse === r.pred, 'inverse not mutual ' + r.pred); if (r.functional) expect(['subject', 'object'].includes(r.functional), r.pred); }
    /* 4.9.71 ruling 2: a same_as row is a pure predicate alias — it names an existing non-alias row and carries no property of its own */
    for (const r of WR.RELATIONS.filter(x => x.same_as)) expect(Object.keys(r).length === 2 && by.has(r.same_as) && !by.get(r.same_as).same_as, 'alias row ' + JSON.stringify(r));
    for (const p of ['inside', 'in', 'part_of', 'ancestor_of', 'greater_than']) expect(WR.relInfo(p) && (WR.relInfo(p).row.transitive || p === 'greater_than'), p);
    for (const p of ['married_to', 'next_to']) expect(by.get(p).symmetric === true, p); expect(by.get('contain').inverse === 'in' && WR.relInfo('inside').row === by.get('in') && by.get('parent_of').inverse === 'child_of');
    const rs = fs.readFileSync(ROOT + '/src/reason.js', 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); for (const r of WR.RELATIONS) { if (r.containment) expect(['inner', 'outer'].includes(r.containment) && r.transitive, r.pred); if (r.functional) expect(r.one && typeof r.one.who === 'string' && typeof r.one.has === 'string', 'functional row without its one-value reason ' + r.pred); }
    for (const w of ['greater', 'more', 'larger']) expect(WR.COMPARATIVES.get(w) === 'greater_than', w); for (const w of ['less', 'smaller', 'fewer']) expect(WR.COMPARATIVES.get(w) === 'less_than', w);
    for (const r of WR.RELATIONS.filter(x => x.phrase)) expect([].concat(r.phrase).every(ph => !rs.includes("'" + ph + "'")) && !rs.includes("'" + r.pred + "'"), 'hard-coded in reason.js: ' + r.pred);
    expect(JSON.stringify(WR.propertyDataRules('inside').map(r => r.id)) === JSON.stringify(WR.propertyDataRules('inside').map(r => r.id)) && WR.propertyDataRules('married_to').map(r => r.id).join() === 'RELPROP-SYMMETRIC:married_to', JSON.stringify(WR.propertyDataRules('married_to').map(r => r.id)));
    expect(!/require\(['"]\.\/sb_sync/.test(fs.readFileSync(ROOT + '/src/kernel.js', 'utf8')), 'kernel imports sb_sync'); });
  /* 4.9.61 rulings 1–4 */
  C('WS-APART', 'ruling 1: two values of a functional relation conflict ONLY when apart — neither contains the other through the containment rows (transitively, either direction) and they are not declared aliases; in the turn world and in memory', () => {
    const t = s => K().process(s);
    expect(yes(t('Ann was born in Paris. Paris is in France. Ann was born in France. Was Ann born in France?')), 'contained values conflicted');
    expect(yes(t('Ann was born in Lyon. Lyon is inside Rhone. Rhone is inside France. Ann was born in France. Was Ann born in Lyon?')), 'transitive containment conflicted');
    expect(yes(t('Ann was born in Lutetia. Lutetia is also called Paris. Ann was born in Paris. Was Ann born in Paris?')), 'aliases conflicted');
    expect(/conflict/.test(t('Ann was born in Paris. Ann was born in Rome. Was Ann born in Rome?').reply), 'apart values did not conflict');
    expect(/conflict/.test(t('Ann was born in Paris. Paris is in France. Lyon is in France. Ann was born in Lyon. Was Ann born in Lyon?').reply), 'siblings under one container are apart');
    const f = K(); run(f, ['remember that Paris is in France', 'remember that Ann was born in Paris']); const r = f.process('remember that Ann was born in France');
    expect(r.msm.meaning.kind !== 'confirm_replace' && !r.trace.rules.some(x => x.id === 'MEM-CONFLICT-FUNCTIONAL-RELATION') && f.store.load('memory').filter(x => x.status === 'active').length === 3, r.reply);
    const g = K(); run(g, ['remember that Lutetia is also known as Paris', 'remember that Ann was born in Lutetia']); expect(!g.process('remember that Ann was born in Paris').trace.rules.some(x => x.id === 'MEM-CONFLICT-FUNCTIONAL-RELATION'), 'stored alias conflicted');
    const h = K(); run(h, ['remember that Paris is in France', 'remember that Ann was born in Paris']); expect(h.process('remember that Ann was born in Rome').trace.rules.some(x => x.id === 'MEM-CONFLICT-FUNCTIONAL-RELATION'), 'apart value not asked');
    expect(WR.apartness([{ predicate: 'in', args: ['paris', 'france'], polarity: 'pos' }])('france', 'paris') === false && WR.apartness([])('paris', 'rome') === true && WR.apartness([])('paris', 'paris') === false, 'apartness'); });
  C('WS-FUNC-NO', 'ruling 2: a functional relation answers "No" when a stored value is apart from the asked one, stating the reason from the data; recorded in the ledger (why? reads it back) and withdrawn when the premise is forgotten; everything else stays open-world', () => {
    const f = K(); f.process('remember that Ann was born in Paris'); const r = f.process('Was Ann born in Rome?');
    expect(r.reply === 'No. You told me that Ann was born in Paris. A person has one birthplace.' && r.trace.echo.pass && r.trace.rules.some(x => x.id === 'INF-FUNCTIONAL-NO' && x.rules_used.includes('RELPROP-FUNCTIONAL:born_in')), r.reply);
    const it = f.justifications().find(x => x.text === 'Ann was not born in Rome'); expect(it && it.status === 'in' && it.justifications[0].premises.length === 1 && /^mem:/.test(it.justifications[0].premises[0].id) && it.justifications[0].rules.includes('RELPROP-FUNCTIONAL:born_in'), JSON.stringify(f.justifications().map(x => x.text)));
    const w = f.process('why?'); expect(w.reply === 'I derived “Ann was not born in Rome” from “Ann was born in Paris”. It uses 2 rules.' && w.trace.echo.pass, w.reply);
    f.process('remember that Paris is in France'); expect(!/^No/.test(f.process('Was Ann born in France?').reply), 'a containing value answered no');
    expect(!/^No/.test(f.process('Was Bea born in Rome?').reply), 'no stored value answered no');
    run(f, ['forget that Ann was born in Paris', 'yes']); expect(f.justifications().find(x => x.id === it.id).status === 'withdrawn' && f.withdrawalReceipts().some(x => x.item === it.id), 'not withdrawn');
    { const r2 = f.process('Was Ann born in Rome?'); expect(!/^(?:No|Yes)\b/.test(r2.reply), 'still decided after the premise left: ' + r2.reply); }
    const g = K(); g.process('remember that Tom is the mother of Sue'); expect(g.process('is Liz the mother of Sue?').reply === 'No. You told me that Tom is the mother of Sue. A person has one mother.');
    const h = K(); h.process('remember that Ann is in Paris'); expect(!/^No/.test(h.process('is Ann in Rome?').reply), 'a non-functional relation answered no'); });
  C('WS-COMPARATIVE', 'ruling 3: "less / smaller / fewer than" and "more / greater / larger than" from the data table, inverse in both directions, asymmetric, transitive; turn world and memory', () => {
    const st = t => require(ROOT + '/src/reason.js').evaluate(t).material.status;
    expect(st('Quo is greater than Ola. Is Ola less than Quo?') === 'supported_only' && st('Quo is less than Ola. Is Ola greater than Quo?') === 'supported_only', 'inverse');
    expect(st('Quo is smaller than Ola. Is Ola larger than Quo?') === 'supported_only' && st('Quo is more than Ola. Is Ola fewer than Quo?') === 'supported_only', 'synonyms');
    expect(st('Quo is greater than Ola. Is Quo less than Ola?') === 'refuted_only' && st('Quo is fewer than Ola. Is Quo more than Ola?') === 'refuted_only', 'asymmetry');
    expect(st('Quo is greater than Ola. Ola is greater than Pim. Is Pim less than Quo?') === 'supported_only', 'transitive through the inverse');
    const f = K(); run(f, ['remember that Quo is greater than Ola', 'remember that Kip is less than Lop', 'remember that Bo is fewer than Cy']);
    for (const [q, cite] of [['is Ola less than Quo?', 'Quo is greater than Ola'], ['is Lop more than Kip?', 'Kip is less than Lop'], ['is Lop greater than Kip?', 'Kip is less than Lop'], ['is Cy more than Bo?', 'Bo is fewer than Cy']]) { const r = f.process(q); expect(yes(r) && r.reply.includes('You told me that ' + cite + '.'), q + ' → ' + r.reply); } });
  C('WS-SUPPOSE-AND', 'ruling 4: "Suppose A and B." with two full clauses is one supposition set — the candidates agree (no tie clarification), the answer is in a branch, nothing is written; the clause split re-derives in the integrity check', () => {
    const f = K(); chain(f); const s0 = JSON.stringify([f.store.load('memory'), f.store.load('world_state')]);
    const r = f.process('Suppose Pim is inside Quo and Quo is inside Rub. Is Pim inside Rub?'); expect(/branch/.test(r.reply) && /Yes/.test(r.reply) && r.trace.selection.winner === 'world.proof' && r.trace.echo.pass, r.reply);
    const r2 = f.process('Suppose Ola is married to Pel and Pel is next to Kip. Is Pel married to Ola?'); expect(/Yes/.test(r2.reply) && r2.trace.selection.winner === 'world.proof', r2.reply);
    expect(JSON.stringify([f.store.load('memory'), f.store.load('world_state')]) === s0, 'a supposition wrote durable state');
    const RS = require(ROOT + '/src/reason.js'), e = RS.evaluate('Suppose Pim is inside Quo and Quo is inside Rub. Is Pim inside Rub?'); expect(e.material.status === 'supported_only' && RS.worldIntegrity(e.material.world) && e.material.world.facts.length >= 2, JSON.stringify(e.material.status));
    expect(K().process('Pim is inside Quo and Quo is inside Rub. Is Pim inside Rub?').trace.selection.winner === 'world.proof', 'stated conjunction ties'); });
  /* 4.9.63 rulings on the 4.9.62 decisions */
  C('WS-ASYM-REGRESSION', 'ruling 5 (regression): "Quo is taller than Ola. Is Ola taller than Quo?" is "No" by asymmetry with a valid world root. Root cause: the measured-quantity evaluator took every dimensional comparison and, with no measurement, answered "no quantity" while the stated comparative was ignored; it now defers to the relational world when non-measurement premises are stated. Every declared comparative and the measured path are checked', () => {
    const RS = require(ROOT + '/src/reason.js'), say = t => K().process(t);
    for (const w of ['taller', 'shorter', 'older', 'younger', 'heavier', 'lighter', 'wider', 'narrower', 'higher', 'lower', 'deeper', 'shallower', 'longer', 'larger', 'smaller', 'greater', 'less']) {
      const t = 'Quo is ' + w + ' than Ola. Is Ola ' + w + ' than Quo?', r = say(t), e = RS.evaluate(t);
      expect(/^No\./.test(r.reply) && r.trace.echo.pass && r.trace.selection.winner === 'world.proof' && e.material.status === 'refuted_only' && RS.worldIntegrity(e.material.world), w + ': ' + r.reply); }
    const inv = [['taller', 'shorter'], ['older', 'younger'], ['heavier', 'lighter'], ['wider', 'narrower'], ['higher', 'lower'], ['deeper', 'shallower'], ['larger', 'smaller']];
    for (const [a, b] of inv) { const y = say('Quo is ' + a + ' than Ola. Is Ola ' + b + ' than Quo?'), n = say('Quo is ' + a + ' than Ola. Is Quo ' + b + ' than Ola?'); expect(/^Yes\./.test(y.reply) && /^No\./.test(n.reply) && y.trace.echo.pass && n.trace.echo.pass, a + '/' + b + ': ' + y.reply + ' | ' + n.reply); }
    expect(/^Yes\./.test(say('Quo is older than Ola. Ola is older than Pim. Is Pim younger than Quo?').reply), 'transitive through the inverse');
    expect(/^Yes\. I compared “5 kg” and “3 kg”\./.test(say('Quo is 3 kg. Ola is 5 kg. Is Ola heavier than Quo?').reply), 'measured comparison changed');
    expect(/no quantity/.test(say('Quo is 180 cm tall. Is Quo taller than Ola?').reply), 'measurement-only premises must still ask for the missing quantity');
    expect(/does not support/.test(say('Quo is longer than Ola. Is Ola shorter than Quo?').reply), 'longer has no declared inverse: open-world, never a guessed answer'); });
  C('WS-SURFACE', 'ruling 3: a turn-world comparative is said with the user\'s own word (larger stays larger, smaller stays smaller); the row predicate stays the atom and Echo re-reads the word to it', () => {
    const r = K().process('Quo is larger than Ola. Is Ola larger than Quo?'); expect(/“ola is not larger than quo”/.test(r.reply) && !/greater/.test(r.reply) && r.trace.echo.pass, r.reply);
    const s = K().process('Quo is larger than Ola. Is Ola smaller than Quo?'); expect(/“ola is smaller than quo”/.test(s.reply) && s.trace.echo.pass, s.reply);
    const m = K().process('Quo is more than Ola. Is Ola more than Quo?'); expect(/“ola is not more than quo”/.test(m.reply) && m.trace.echo.pass, m.reply);
    const RS = require(ROOT + '/src/reason.js'), e = RS.evaluate('Quo is larger than Ola. Is Ola larger than Quo?'); expect(e.material.world.query.atom.predicate === 'greater_than' && e.material.query_text === 'ola is larger than quo', e.material.query_text); });
  C('WS-ORDER-MEM', 'ruling 4: stored comparatives get the same order rules (asymmetry, inverse, transitivity) as the turn world: a checked "No" with its premises, recorded in the ledger, read back by "why?", withdrawn when a premise is forgotten', () => {
    const f = K(); run(f, ['remember that Quo is taller than Ola', 'remember that Ola is taller than Pim']);
    const a = f.process('is Ola taller than Quo?'); expect(/^No\. You told me that Quo is taller than Ola\. I used 1 rule\./.test(a.reply) && a.trace.echo.pass && a.trace.rules.some(x => x.id === 'INF-ORDER-NO' && x.rules_used.includes('RELPROP-ASYMMETRIC:taller_than')), a.reply);
    const b = f.process('is Pim taller than Quo?'); expect(/^No\./.test(b.reply) && /Quo is taller than Ola/.test(b.reply) && /Ola is taller than Pim/.test(b.reply) && b.trace.echo.pass, b.reply);
    const c = f.process('is Quo shorter than Pim?'); expect(/^No\./.test(c.reply) && c.trace.echo.pass, c.reply);
    const w = f.process('why?'); expect(/Quo is not shorter than Pim/.test(w.reply) && /Quo is taller than Ola/.test(w.reply) && w.trace.echo.pass, w.reply);
    const it = f.justifications().find(x => /quo is not shorter than pim/i.test(x.text) && x.justifications.some(j => j.rules.includes('INF-ORDER-NO'))); expect(it && it.status === 'in' && it.justifications[0].rules.includes('INF-ORDER-NO'), JSON.stringify(it));
    run(f, ['forget that Ola is taller than Pim', 'yes']); const it2 = f.justifications().find(x => x.id === it.id); expect(it2.status !== 'in', 'not withdrawn: ' + JSON.stringify(it2));
    expect(/cannot confirm/i.test(f.process('is Pim taller than Quo?').reply), 'withdrawn premise still refutes');
    expect(rels(f).includes('derived:ola is not taller than quo'), 'the durable world lacks the asymmetric consequence: ' + JSON.stringify(rels(f)));
    const g = K(); g.process('remember that Kip is larger than Lum'); const d = g.process('is Lum larger than Kip?'); expect(/^No\. You told me that Kip is larger than Lum\./.test(d.reply) && d.trace.echo.pass, d.reply);
    expect(/^Yes/.test(g.process('is Kip larger than Lum?').reply) && /cannot confirm/i.test(g.process('is Lum larger than Pim?').reply), 'open-world elsewhere');
    const WR = require(ROOT + '/src/world_rules.js'); expect(WR.orderRules('taller_than').length === 4 && WR.orderRules('inside').length === 0 && WR.propertyDataRules('taller_than').some(r => r.id === 'RELPROP-ASYMMETRIC:taller_than'), 'order rules are data of the comparative rows only'); });
};
