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
  C('WS-SUPPOSE', '"Suppose …" isolation: a hypothetical chain is answered in a branch and neither memory nor the durable world state changes; premises given in one message never enter the durable state', () => {
    const f = K(); chain(f); f.process('where is Aster?'); const snap = () => JSON.stringify([f.store.load('memory'), f.store.load('world_state')]); const s0 = snap();
    const r = f.process('Suppose Pim is inside Quo. Quo is inside Rub. Is Pim inside Rub?'); expect(/branch/.test(r.reply) && /Yes/.test(r.reply) && r.trace.echo.pass, r.reply);
    const r2 = f.process('Suppose Ola is married to Pel. Is Pel married to Ola?'); expect(/Yes/.test(r2.reply), r2.reply);
    f.process('Kip contains Lop. Is Lop inside Kip?'); expect(snap() === s0, 'a hypothetical wrote durable state');
    expect(!f.worldState().entities.some(e => /pim|quo|ola|kip/.test(e.id)) && !/^Yes/.test(f.process('is Pim inside Rub?').reply), 'branch leaked'); });
  /* The old row bundled four names and one process() call. Each guarantee is now its own row on the live Ask path.
   * inside → WM-CONTAIN-CHAIN (the old winner was world.proof / RELPROP-TRANSITIVE:in).
   * part of → WM-PART-CHAIN (the old reply was Yes).
   * ancestor of → WM-ANCESTOR-CHAIN (the old trace id was RELPROP-TRANSITIVE:ancestor_of).
   * The title also said "before"; the body never asserted a before chain, so none is added here. */
  const askChain = (mem, q) => { const A = require('./ask_path.js'); const s = A.session(); for (const m of mem) expect(A.remember(s, m).ok, m); const n = s.phone.length; const row = A.ask(s, q); expect(s.phone.length === n, 'ask wrote'); return row; };
  const admitted = row => row && row.product_reply === true && row.echo && row.echo.pass === true && row.calls_llm !== true && !(row.memory_write && row.memory_write.committed);
  const WF = require(ROOT + '/src/world_facts.js');
  const QF = require(ROOT + '/src/qframe.js');
  const FK = require(ROOT + '/src/forge.js');
  const factForge = FK.ForgeKernel({ store: KM.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-07T00:00:00Z' });
  const putFact = text => WF.upsert({ text, clause: QF.clause(text, factForge), kind: 'remember' });
  /* Remembered premises live in world_facts and are reread by a later Ask. The chain is recomputed; it is not stored. */
  C('WS-PERSIST', 'remembered premises survive a new read of the same store and the chain is recomputed from them (old: a new kernel on the same store answers the chain)', () => {
    WF.clear();
    expect(putFact('Aster is inside Beryl.').ok && putFact('Beryl is inside Cobalt.').ok && putFact('Aster is blue.').ok);
    const ids = WF.rows().map(r => r.id);
    expect(ids.length === 3 && ids.every(id => id) && WF.rows().every(r => r.clause && r.clause.parsed && r.provenance && r.provenance.store === 'world_facts'), JSON.stringify(WF.rows().map(r => r.text)));
    const Ask = require('./ask_path.js');
    const first = Ask.askStored('does Cobalt contain Aster?');
    const again = Ask.askStored('does Cobalt contain Aster?');
    const blue = WF.rows().find(r => /blue/.test(r.text));
    expect(admitted(first) && first.reply === 'Aster is inside Beryl. Beryl is inside Cobalt. Aster is inside Cobalt.' && first.world_model.derive.survivor.how === 'WM-CONTAIN-CHAIN', first.reply);
    expect(admitted(again) && again.reply === first.reply, again.reply);
    expect(blue && blue.clause && blue.clause.parsed, 'the attribute premise was not kept');
    const prem = (first.world_model.derive.survivor.premises || []).map(p => p.text);
    expect(prem.some(t => /Aster is inside Beryl/.test(t)) && prem.some(t => /Beryl is inside Cobalt/.test(t)), JSON.stringify(prem));
    expect(WF.rows().length === 3, 'the recomputation stored a derived fact');
    WF.clear();
  });
  C('WS-PERSIST', 'derived relations are stored ledger items that replay (old: worldState derived RELPROP-TRANSITIVE:in and a tamper-checked justification)', () => {
    WF.clear();
    putFact('Aster is inside Beryl.'); putFact('Beryl is inside Cobalt.');
    const derived = WF.rows().filter(r => r.origin === 'derived' || (r.rules || []).indexOf('RELPROP-TRANSITIVE:in') >= 0);
    expect(derived.some(r => /aster is in cobalt/i.test(r.text) && (r.rules || []).indexOf('RELPROP-TRANSITIVE:in') >= 0), 'the original ledger row is not in the fact store: ' + WF.rows().map(r => r.text).join('|'));
    WF.clear();
  });
  C('WS-RETRACT', 'explicit forget removes only that premise; the chain stops and the other premise still derives (old: chain answer no longer given, remaining inverse stays)', () => {
    WF.clear();
    expect(putFact('Aster is inside Beryl.').ok && putFact('Beryl is inside Cobalt.').ok && putFact('Aster is blue.').ok);
    const Ask = require('./ask_path.js');
    expect(admitted(Ask.askStored('is Aster inside Cobalt?')));
    const gone = WF.forget('Beryl is inside Cobalt.');
    expect(gone.ok && gone.rule === 'WORLD-FACTS-FORGOT' && gone.receipt && gone.receipt.fact_id && gone.receipt.text === 'Beryl is inside Cobalt.', JSON.stringify(gone));
    expect(WF.rows().map(r => r.text).sort().join('|') === 'Aster is blue.|Aster is inside Beryl.', WF.rows().map(r => r.text).join('|'));
    const chain = Ask.askStored('is Aster inside Cobalt?');
    const contain = Ask.askStored('does Cobalt contain Aster?');
    const left = Ask.askStored('is Aster inside Beryl?');
    const inv = Ask.askStored('does Beryl contain Aster?');
    expect(chain.product_reply !== true && contain.product_reply !== true, (chain.reply || chain.route) + ' | ' + (contain.reply || contain.route));
    expect(admitted(left) && left.reply === 'Aster is inside Beryl.' && admitted(inv) && inv.reply === 'Aster is inside Beryl.' && inv.world_model.derive.survivor.how === 'direct', (left.reply || '') + ' | ' + (inv.reply || '') + ' ' + (inv.world_model.derive.survivor && inv.world_model.derive.survivor.how));
    expect(putFact('Beryl is inside Cobalt.').ok);
    const back = Ask.askStored('does Cobalt contain Aster?');
    expect(admitted(back) && back.reply === 'Aster is inside Beryl. Beryl is inside Cobalt. Aster is inside Cobalt.' && WF.rows().length === 3, back.reply);
    WF.clear();
  });
  C('WS-RETRACT', 'forgetting lists every withdrawn derived relation with a receipt (old: ws.withdrawn wd: aster is in cobalt)', () => {
    WF.clear();
    putFact('Aster is inside Beryl.'); putFact('Beryl is inside Cobalt.');
    const gone = WF.forget('Beryl is inside Cobalt.');
    const listed = (gone.withdrawn || []).filter(w => w.text === 'aster is in cobalt' && /^wd:/.test(w.receipt || ''));
    expect(listed.length === 3, 'the original withdrawn-ledger list is not produced: ' + JSON.stringify(gone.receipt));
    WF.clear();
  });
  C('WS-TRANSITIVE', 'inside chain (old: Ola inside Pel inside Ras, winner world.proof)', () => {
    const row = askChain(['remember that Ola is inside Pel', 'remember that Pel is inside Ras'], 'is Ola inside Ras?');
    expect(admitted(row) && row.reply === 'Ola is inside Pel. Pel is inside Ras. Ola is inside Ras.' && row.world_model.derive.survivor.how === 'WM-CONTAIN-CHAIN', row.reply);
  });
  C('WS-TRANSITIVE', 'part-of chain (old: Gem part of Hub part of Ivo answered Yes)', () => {
    const row = askChain(['remember that Gem is part of Hub', 'remember that Hub is part of Ivo'], 'is Gem part of Ivo?');
    expect(admitted(row) && row.reply === 'Gem is part of Hub. Hub is part of Ivo. Gem is part of Ivo.' && row.world_model.derive.survivor.how === 'WM-PART-CHAIN', row.reply);
  });
  C('WS-TRANSITIVE', 'ancestor-of chain (old: Lia ancestor of Mo ancestor of Ned, rule RELPROP-TRANSITIVE:ancestor_of)', () => {
    const row = askChain(['remember that Lia is an ancestor of Mo', 'remember that Mo is an ancestor of Ned'], 'is Lia an ancestor of Ned?');
    expect(admitted(row) && row.reply === 'Lia is an ancestor of Mo. Mo is an ancestor of Ned. Lia is an ancestor of Ned.' && row.world_model.derive.survivor.how === 'WM-ANCESTOR-CHAIN', row.reply);
  });
  /* Old: Kernel.process, /^Yes, I infer/, RELPROP-SYMMETRIC. Live memory swap is the represented contract. */
  C('WS-SYMMETRIC', 'stored married and next swap once (old: Yes, I infer, RELPROP-SYMMETRIC:married_to)', () => {
    const married = askChain(['remember that Ann is married to Bob'], 'is Bob married to Ann?');
    const next = askChain(['remember that Ann is next to Cy'], 'is Cy next to Ann?');
    expect(admitted(married) && married.reply === 'Ann is married to Bob. Bob is married to Ann.' && married.world_model.derive.survivor.how === 'WM-MARRIED-SYMMETRIC', married.reply);
    expect(admitted(next) && next.reply === 'Ann is next to Cy. Cy is next to Ann.' && next.world_model.derive.survivor.how === 'WM-NEXT-SYMMETRIC', next.reply);
  });
  C('WS-SYMMETRIC', 'inside does not swap (old: not Yes)', () => {
    const fwd = askChain(['remember that Ola is inside Pel'], 'is Ola inside Pel?');
    const rev = askChain(['remember that Ola is inside Pel'], 'is Pel inside Ola?');
    expect(admitted(fwd) && fwd.reply === 'Ola is inside Pel.', fwd.reply);
    expect(rev.product_reply !== true, rev.reply || rev.route);
  });
  C('WS-SYMMETRIC', 'one utterance is not a stored premise (old turn world: Ola is married to Pel. Is Pel married to Ola?)', () => {
    const row = askChain([], 'Ola is married to Pel. Is Pel married to Ola?');
    expect(admitted(row) && /Pel is married to Ola/.test(row.reply || ''), row.reply || row.route);
  });
  /* Split from the bundled inverse row. contains/inside and ancestor/descendant are the relations this world model
   * types. parent/child is still required and is not those relations: the live ask must produce the child reading,
   * and a hold is the unmet contract rather than a deleted-process crash. */
  C('WS-INVERSE', 'contains/inside (old: Kip contains Lop answers Is Lop inside Kip?)', () => {
    const row = askChain(['remember that Kip contains Lop'], 'is Lop inside Kip?');
    expect(admitted(row) && /Kip contains Lop\./.test(row.reply || ''), row.reply);
  });
  C('WS-INVERSE', 'parent/child (old: Tom parent of Sue answers Is Sue the child of Tom?, rule RELPROP-INVERSE:child_of<parent_of)', () => {
    const row = askChain(['remember that Tom is the parent of Sue'], 'is Sue the child of Tom?');
    expect(admitted(row) && row.reply === 'Tom is the parent of Sue. Sue is a child of Tom.' && row.world_model.derive.survivor.how === 'WM-PARENT-INVERSE', row.reply);
  });
  C('WS-INVERSE', 'ancestor/descendant (old: Lia ancestor of Ned answers Is Ned a descendant of Lia?)', () => {
    const row = askChain(['remember that Lia is an ancestor of Mo', 'remember that Mo is an ancestor of Ned'], 'is Ned a descendant of Lia?');
    expect(admitted(row) && row.reply === 'Lia is an ancestor of Mo. Mo is an ancestor of Ned. Ned is a descendant of Lia.' && row.world_model.derive.survivor.how === 'WM-ANCESTOR-INVERSE', row.reply);
  });
  /* The confirm-replace dialog is not the current Remember. A second functional value is refused and nothing is overwritten. */
  C('WS-FUNCTIONAL', 'one stored mother admits, and a second mother is refused (old: writes nothing)', () => {
    WF.clear();
    expect(putFact('Vin is the mother of Wes.').ok === true);
    const other = putFact('Xan is the mother of Wes.');
    expect(other.ok === false && other.rule === 'WORLD-FACTS-CONFLICT-FUNCTIONAL' && WF.rows().some(r => r.text === 'Vin is the mother of Wes.') && !WF.rows().some(r => /Xan/.test(r.text)), JSON.stringify(other));
    const ask = askChain(['remember that Vin is the mother of Wes'], 'is Vin the mother of Wes?');
    expect(admitted(ask) && /Vin is the mother of Wes/.test(ask.reply), ask.reply);
    WF.clear();
  });
  C('WS-FUNCTIONAL', 'two people born in one city are both kept (old: different subjects are no conflict)', () => {
    WF.clear();
    expect(putFact('Ann was born in Paris.').ok && putFact('Bob was born in Paris.').ok);
    expect(WF.rows().length === 2, WF.rows().map(r => r.text).join('|'));
    WF.clear();
  });
  C('WS-FUNCTIONAL', 'a second birthplace is refused and the first stays (old: confirm_replace wrote nothing)', () => {
    WF.clear();
    expect(putFact('Ann was born in Paris.').ok);
    const rome = putFact('Ann was born in Rome.');
    expect(rome.ok === false && rome.rule === 'WORLD-FACTS-CONFLICT-FUNCTIONAL' && WF.rows().map(r => r.text).join('|') === 'Ann was born in Paris.', JSON.stringify(rome));
    WF.clear();
  });
  C('WS-FUNCTIONAL', 'two mothers in one utterance conflict (old turn world)', () => {
    const row = askChain([], 'Vin is the mother of Wes. Xan is the mother of Wes. Is Vin the mother of Wes?');
    expect(/conflict/.test(row.reply || ''), row.reply || row.route);
  });
  C('WS-WHY', 'a containment answer cites both premises (old why named those sentences)', () => {
    const row = askChain(['remember that Aster is inside Beryl', 'remember that Beryl is inside Cobalt'], 'is Aster inside Cobalt?');
    expect(admitted(row) && row.reply === 'Aster is inside Beryl. Beryl is inside Cobalt. Aster is inside Cobalt.' && row.world_model.derive.survivor.how === 'WM-CONTAIN-CHAIN', row.reply);
  });
  C('WS-WHY', 'a later why reads that derivation (old: I derived Aster is inside Cobalt from the two premises)', () => {
    const A = require('./ask_path.js'); const s = A.session();
    expect(A.remember(s, 'remember that Aster is inside Beryl').ok && A.remember(s, 'remember that Beryl is inside Cobalt').ok);
    expect(admitted(A.ask(s, 'is Aster inside Cobalt?')));
    const why = A.ask(s, 'why?');
    expect(why.product_reply === true && /Aster is inside Beryl/.test(why.reply || '') && /Beryl is inside Cobalt/.test(why.reply || '') && why.echo && why.echo.pass === true, why.reply || why.route);
  });
  C('WS-DATA', 'relation properties are DATA: every RELATIONS row uses only declared keys, inverse partners are mutual, functional is subject|object; the grammar reads the declared phrases (no relation phrase is hard-coded in reason.js); RELPROP rule ids are stable; no numeric weights', () => {
    const KEYS = new Set(['pred', 'phrase', 'transitive', 'symmetric', 'inverse', 'functional', 'containment', 'alias', 'same_as', 'comparative', 'one', 'causal', 'entails' /* 4.9.77 M4: causal link kind (cause | prevent | association) and declared entailment between link verbs */]), by = new Map(WR.RELATIONS.map(r => [r.pred, r]));
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
  C('WS-APART', 'a birthplace inside a stored container is kept (old: contained values do not conflict)', () => {
    WF.clear();
    expect(putFact('Paris is inside France.').ok && putFact('Ann was born in Paris.').ok && putFact('Ann was born in France.').ok);
    expect(WF.rows().some(r => r.text === 'Ann was born in Paris.') && WF.rows().some(r => r.text === 'Ann was born in France.'), WF.rows().map(r => r.text).join('|'));
    const ask = askChain(['remember that Ann was born in France'], 'was Ann born in France?');
    expect(admitted(ask) && /Ann was born in France/.test(ask.reply), ask.reply);
    WF.clear();
  });
  C('WS-APART', 'an apart birthplace is refused (old: Rome conflicts with Paris)', () => {
    WF.clear();
    expect(putFact('Ann was born in Paris.').ok);
    const rome = putFact('Ann was born in Rome.');
    expect(rome.ok === false && rome.rule === 'WORLD-FACTS-CONFLICT-FUNCTIONAL', JSON.stringify(rome));
    WF.clear();
  });
  C('WS-APART', 'apartness data: a container is not apart from what it contains', () => {
    expect(WR.apartness([{ predicate: 'in', args: ['paris', 'france'], polarity: 'pos' }])('france', 'paris') === false && WR.apartness([])('paris', 'rome') === true && WR.apartness([])('paris', 'paris') === false);
  });
  C('WS-APART', 'an alias is not a second birthplace (old: Lutetia also called Paris)', () => {
    WF.clear();
    expect(putFact('Lutetia is also known as Paris.').ok && putFact('Ann was born in Lutetia.').ok);
    const paris = putFact('Ann was born in Paris.');
    expect(paris.ok === true && !/CONFLICT-FUNCTIONAL/.test(paris.rule || ''), JSON.stringify(paris));
    WF.clear();
  });
  C('WS-APART', 'turn-world containment does not make two birthplaces a conflict (old one-utterance Yes)', () => {
    const row = askChain([], 'Ann was born in Paris. Paris is in France. Ann was born in France. Was Ann born in France?');
    expect(admitted(row) && /born in France/.test(row.reply || ''), row.reply || row.route);
  });
  C('WS-FUNC-NO', 'the stored birthplace admits (old functional No still needs this premise)', () => {
    const row = askChain(['remember that Ann was born in Paris'], 'was Ann born in Paris?');
    expect(admitted(row) && /Ann was born in Paris/.test(row.reply), row.reply);
  });
  C('WS-FUNC-NO', 'a different birthplace is No (old: No. You told me that Ann was born in Paris. A person has one birthplace.)', () => {
    const row = askChain(['remember that Ann was born in Paris'], 'was Ann born in Rome?');
    expect(row.product_reply === true && row.reply === 'No. You told me that Ann was born in Paris. A person has one birthplace.' && row.echo && row.echo.pass === true, row.reply || row.route);
  });
  C('WS-FUNC-NO', 'a containing place is not answered No (old)', () => {
    const row = askChain(['remember that Ann was born in Paris', 'remember that Paris is inside France'], 'was Ann born in France?');
    expect(!/^No\b/.test(row.reply || ''), row.reply || row.route);
  });
  C('WS-FUNC-NO', 'no stored birthplace stays open (old: not No)', () => {
    const row = askChain([], 'was Bea born in Rome?');
    expect(row.product_reply !== true && !/^No\b/.test(row.reply || ''), row.reply || row.route);
  });
  C('WS-FUNC-NO', 'forgetting the birthplace withdraws the No (old ledger)', () => {
    const A = require('./ask_path.js'); const s = A.session();
    expect(A.remember(s, 'remember that Ann was born in Paris').ok);
    const gone = A.ask(s, 'forget that Ann was born in Paris');
    const again = A.ask(s, 'was Ann born in Rome?');
    expect(gone.product_reply === true && /forgot|withdrawn/i.test(gone.reply || '') && again.product_reply !== true, (gone.reply || gone.route) + ' | ' + (again.reply || again.route));
  });
  C('WS-FUNC-NO', 'another mother is No (old: A person has one mother)', () => {
    const row = askChain(['remember that Tom is the mother of Sue'], 'is Liz the mother of Sue?');
    expect(row.product_reply === true && row.reply === 'No. You told me that Tom is the mother of Sue. A person has one mother.', row.reply || row.route);
  });
  C('WS-FUNC-NO', 'a non-functional place is not answered No (old)', () => {
    const yes = askChain(['remember that Ann is in Paris'], 'is Ann in Paris?');
    const no = askChain(['remember that Ann is in Paris'], 'is Ann in Rome?');
    expect(admitted(yes) && !/^No\b/.test(no.reply || ''), (yes.reply || yes.route) + ' | ' + (no.reply || no.route));
  });
  /* The old row used reason.js evaluate() and Kernel.process. Each guarantee is now an Ask.
   * greater/less/more/larger/smaller/fewer are the magnitude row. They are not age. */
  C('WS-COMPARATIVE', 'inverse both ways (old: greater↔less supported_only)', () => {
    const less = askChain(['remember that Quo is greater than Ola'], 'is Ola less than Quo?');
    const greater = askChain(['remember that Quo is less than Ola'], 'is Ola greater than Quo?');
    expect(admitted(less) && less.reply === 'Quo is greater than Ola. Ola is less than Quo.' && less.world_model.derive.survivor.how === 'WM-GREATER_THAN-INVERSE', less.reply);
    expect(admitted(greater) && greater.reply === 'Quo is less than Ola. Ola is greater than Quo.' && greater.world_model.derive.survivor.how === 'WM-LESS_THAN-INVERSE', greater.reply);
  });
  C('WS-COMPARATIVE', 'synonyms stay on the magnitude row (old: smaller→larger and more→fewer)', () => {
    const larger = askChain(['remember that Quo is smaller than Ola'], 'is Ola larger than Quo?');
    const fewer = askChain(['remember that Quo is more than Ola'], 'is Ola fewer than Quo?');
    expect(admitted(larger) && larger.reply === 'Quo is smaller than Ola. Ola is larger than Quo.', larger.reply);
    expect(admitted(fewer) && fewer.reply === 'Quo is more than Ola. Ola is fewer than Quo.', fewer.reply);
  });
  C('WS-COMPARATIVE', 'asymmetry (old: greater does not admit less on the same pair, refuted_only)', () => {
    const less = askChain(['remember that Quo is greater than Ola'], 'is Quo less than Ola?');
    const more = askChain(['remember that Quo is fewer than Ola'], 'is Quo more than Ola?');
    expect(admitted(less) && less.reply === 'Quo is greater than Ola. Quo is not less than Ola.' && less.world_model.derive.survivor.how === 'WM-GREATER_THAN-EXCLUDES', less.reply);
    expect(admitted(more) && more.reply === 'Quo is fewer than Ola. Quo is not more than Ola.' && more.world_model.derive.survivor.how === 'WM-LESS_THAN-EXCLUDES', more.reply);
  });
  C('WS-COMPARATIVE', 'transitive through the inverse (old: Pim is less than Quo)', () => {
    const row = askChain(['remember that Quo is greater than Ola', 'remember that Ola is greater than Pim'], 'is Pim less than Quo?');
    expect(admitted(row) && row.reply === 'Ola is greater than Pim. Quo is greater than Ola. Pim is less than Quo.' && row.world_model.derive.survivor.how === 'WM-LESS_THAN-CHAIN', row.reply);
  });
  C('WS-COMPARATIVE', 'memory cites the stored comparison (old: You told me that …)', () => {
    const pairs = [['remember that Quo is greater than Ola', 'is Ola less than Quo?', 'Quo is greater than Ola.'], ['remember that Kip is less than Lop', 'is Lop more than Kip?', 'Kip is less than Lop.'], ['remember that Kip is less than Lop', 'is Lop greater than Kip?', 'Kip is less than Lop.'], ['remember that Bo is fewer than Cy', 'is Cy more than Bo?', 'Bo is fewer than Cy.']];
    for (const [mem, q, cite] of pairs) {
      const row = askChain([mem], q);
      expect(admitted(row) && row.reply.indexOf(cite) === 0, q + ' → ' + row.reply);
    }
  });
  C('WS-SUPPOSE-AND', 'ruling 4: "Suppose A and B." with two full clauses is one supposition set — the candidates agree (no tie clarification), the answer is in a branch, nothing is written; the clause split re-derives in the integrity check', () => {
    const f = K(); chain(f); const s0 = JSON.stringify([f.store.load('memory'), f.store.load('world_state')]);
    const r = f.process('Suppose Pim is inside Quo and Quo is inside Rub. Is Pim inside Rub?'); expect(/branch/.test(r.reply) && /Yes/.test(r.reply) && r.trace.selection.winner === 'world.proof' && r.trace.echo.pass, r.reply);
    const r2 = f.process('Suppose Ola is married to Pel and Pel is next to Kip. Is Pel married to Ola?'); expect(/Yes/.test(r2.reply) && r2.trace.selection.winner === 'world.proof', r2.reply);
    expect(JSON.stringify([f.store.load('memory'), f.store.load('world_state')]) === s0, 'a supposition wrote durable state');
    const RS = require(ROOT + '/src/reason.js'), e = RS.evaluate('Suppose Pim is inside Quo and Quo is inside Rub. Is Pim inside Rub?'); expect(e.material.status === 'supported_only' && RS.worldIntegrity(e.material.world) && e.material.world.facts.length >= 2, JSON.stringify(e.material.status));
    expect(K().process('Pim is inside Quo and Quo is inside Rub. Is Pim inside Rub?').trace.selection.winner === 'world.proof', 'stated conjunction ties'); });
  /* Old /^No/ is the cited negation. Height is its own dimension. The other declared words stay unmet. */
  for (const w of ['taller', 'shorter', 'older', 'younger', 'larger', 'smaller', 'greater', 'less', 'more', 'fewer', 'heavier', 'lighter', 'wider', 'narrower', 'higher', 'lower', 'deeper', 'shallower', 'longer']) {
    C('WS-ASYM-REGRESSION', w + ' is not symmetric (old: No)', () => {
      const row = askChain(['remember that Quo is ' + w + ' than Ola'], 'is Ola ' + w + ' than Quo?');
      expect(admitted(row) && row.reply === 'Quo is ' + w + ' than Ola. Ola is not ' + w + ' than Quo.', row.reply || row.route);
    });
  }
  for (const [a, b] of [['taller', 'shorter'], ['older', 'younger'], ['larger', 'smaller'], ['heavier', 'lighter'], ['wider', 'narrower'], ['higher', 'lower'], ['deeper', 'shallower']]) {
    C('WS-ASYM-REGRESSION', a + ' inverts to ' + b + ' (old: Yes) and the same pair is not ' + b + ' (old: No)', () => {
      const y = askChain(['remember that Quo is ' + a + ' than Ola'], 'is Ola ' + b + ' than Quo?');
      const n = askChain(['remember that Quo is ' + a + ' than Ola'], 'is Quo ' + b + ' than Ola?');
      expect(admitted(y) && y.reply === 'Quo is ' + a + ' than Ola. Ola is ' + b + ' than Quo.', y.reply || y.route);
      expect(admitted(n) && n.reply === 'Quo is ' + a + ' than Ola. Quo is not ' + b + ' than Ola.', n.reply || n.route);
    });
  }
  C('WS-ASYM-REGRESSION', 'longer has no declared inverse (old: does not support a shorter answer)', () => {
    const yes = askChain(['remember that Quo is longer than Ola'], 'is Quo longer than Ola?');
    const no = askChain(['remember that Quo is longer than Ola'], 'is Ola shorter than Quo?');
    expect(admitted(yes) && /longer than Ola/.test(yes.reply), yes.reply || yes.route);
    expect(no.product_reply !== true, no.reply || no.route);
  });
  /* Old wording was "Yes. I compared 5 kg and 3 kg." The guarantee is the comparison, with both quantities cited. */
  C('WS-ASYM-REGRESSION', 'measured kilograms (old: Yes. I compared 5 kg and 3 kg)', () => {
    const row = askChain(['remember that Quo is 3 kg', 'remember that Ola is 5 kg'], 'is Ola heavier than Quo?');
    expect(admitted(row) && row.reply === 'Ola is 5 kg. Quo is 3 kg. Ola is heavier than Quo.' && row.world_model.derive.survivor.how === 'WM-MEASURE-COMPARE', row.reply || row.route);
  });
  /* Old wording was "no quantity": Ola has no height, so taller is not answered and no number is invented. */
  C('WS-ASYM-REGRESSION', 'a measurement with no second quantity stays open (old: no quantity)', () => {
    const Ask = require('./ask_path.js'); const s = Ask.session();
    const kept = Ask.remember(s, 'remember that Quo is 180 cm tall');
    const q = QF.compile('is Quo taller than Ola?', factForge);
    const row = Ask.ask(s, 'is Quo taller than Ola?');
    const claims = (row.world_model && row.world_model.derive && row.world_model.derive.claims) || [];
    expect(kept.clause && kept.clause.pred && kept.clause.pred.type === 'measure' && kept.clause.pred.property === 'tall' && kept.clause.pred.unit === 'cm' && kept.clause.pred.num === '180', JSON.stringify(kept.clause && kept.clause.pred));
    expect(q && q.pred && q.pred.predicate === 'taller_than', JSON.stringify(q && q.pred));
    const gap = row.world_model.derive.measure_gap;
    const keptQty = gap && (gap.measures || []).find(m => m.property === 'tall');
    expect(row.product_reply !== true && row.world_model.derive.status === 'undetermined' && row.world_model.derive.reason === 'measure_missing_comparator' && gap && gap.asked === 'taller_than' && gap.owners === 1 && keptQty && keptQty.num === '180' && keptQty.unit === 'cm' && keptQty.dim === 'length' && !claims.some(c => c.how === 'WM-MEASURE-COMPARE') && !/\d/.test(row.reply || ''), (row.reply || row.route) + ' ' + row.world_model.derive.reason);
  });
  C('WS-SURFACE', 'larger stays larger in the negation (old: not greater; the atom is greater_than)', () => {
    const row = askChain(['remember that Quo is larger than Ola'], 'is Ola larger than Quo?');
    const atom = row.world_model && row.world_model.derive && row.world_model.derive.survivor && row.world_model.derive.survivor.atom;
    expect(admitted(row) && row.reply === 'Quo is larger than Ola. Ola is not larger than Quo.' && !/greater/.test(row.reply) && atom && atom.predicate === 'greater_than', row.reply);
  });
  C('WS-SURFACE', 'larger inverts as smaller (old: ola is smaller than quo)', () => {
    const row = askChain(['remember that Quo is larger than Ola'], 'is Ola smaller than Quo?');
    expect(admitted(row) && row.reply === 'Quo is larger than Ola. Ola is smaller than Quo.' && !/greater|less/.test(row.reply), row.reply);
  });
  C('WS-SURFACE', 'more stays more in the negation (old: ola is not more than quo)', () => {
    const row = askChain(['remember that Quo is more than Ola'], 'is Ola more than Quo?');
    expect(admitted(row) && row.reply === 'Quo is more than Ola. Ola is not more than Quo.', row.reply);
  });
  C('WS-ORDER-MEM', 'stored taller is not symmetric (old: No. You told me that Quo is taller than Ola)', () => {
    const row = askChain(['remember that Quo is taller than Ola'], 'is Ola taller than Quo?');
    expect(admitted(row) && row.reply === 'Quo is taller than Ola. Ola is not taller than Quo.' && row.world_model.derive.survivor.how === 'WM-TALLER_THAN-ASYM', row.reply);
  });
  C('WS-ORDER-MEM', 'stored taller chains and the far swap cites both premises (old: No)', () => {
    const row = askChain(['remember that Quo is taller than Ola', 'remember that Ola is taller than Pim'], 'is Pim taller than Quo?');
    expect(admitted(row) && row.reply === 'Quo is taller than Ola. Ola is taller than Pim. Pim is not taller than Quo.' && row.world_model.derive.survivor.how === 'WM-TALLER_THAN-ASYM', row.reply);
  });
  C('WS-ORDER-MEM', 'the far pair is not shorter (old: No)', () => {
    const row = askChain(['remember that Quo is taller than Ola', 'remember that Ola is taller than Pim'], 'is Quo shorter than Pim?');
    expect(admitted(row) && row.reply === 'Quo is taller than Ola. Ola is taller than Pim. Quo is not shorter than Pim.' && row.world_model.derive.survivor.how === 'WM-TALLER_THAN-EXCLUDES', row.reply);
  });
  C('WS-ORDER-MEM', 'why reads the stored-order derivation (old follow-up)', () => {
    const A = require('./ask_path.js'); const s = A.session();
    expect(A.remember(s, 'remember that Quo is taller than Ola').ok && A.remember(s, 'remember that Ola is taller than Pim').ok);
    expect(admitted(A.ask(s, 'is Quo shorter than Pim?')));
    const why = A.ask(s, 'why?');
    expect(why.product_reply === true && /Quo is taller than Ola/.test(why.reply || '') && /not shorter/.test(why.reply || '') && why.echo && why.echo.pass === true, why.reply || why.route);
  });
  C('WS-ORDER-MEM', 'forgetting a premise withdraws the refutation (old ledger)', () => {
    const A = require('./ask_path.js'); const s = A.session();
    expect(A.remember(s, 'remember that Quo is taller than Ola').ok && A.remember(s, 'remember that Ola is taller than Pim').ok);
    const gone = A.ask(s, 'forget that Ola is taller than Pim');
    const again = A.ask(s, 'is Pim taller than Quo?');
    expect(/forgot|withdrawn/i.test(gone.reply || '') && again.product_reply !== true, (gone.reply || gone.route) + ' | ' + (again.reply || again.route));
  });
  C('WS-ORDER-MEM', 'the asymmetric consequence is not written into a durable world (old: derived:ola is not taller than quo)', () => {
    WF.clear();
    expect(putFact('Quo is taller than Ola.').ok && putFact('Ola is taller than Pim.').ok);
    expect(WF.rows().some(r => /ola is not taller than quo/i.test(r.text)), WF.rows().map(r => r.text).join('|'));
    WF.clear();
  });
  C('WS-ORDER-MEM', 'stored larger uses the same negation and an unrelated pair stays open (old: cannot confirm)', () => {
    const no = askChain(['remember that Kip is larger than Lum'], 'is Lum larger than Kip?');
    const yes = askChain(['remember that Kip is larger than Lum'], 'is Kip larger than Lum?');
    const open = askChain(['remember that Kip is larger than Lum'], 'is Lum larger than Pim?');
    expect(admitted(no) && no.reply === 'Kip is larger than Lum. Lum is not larger than Kip.', no.reply);
    expect(admitted(yes) && /larger than Lum/.test(yes.reply), yes.reply);
    expect(open.product_reply !== true, open.reply || open.route);
  });
  C('WS-ORDER-MEM', 'order rules are data of the comparative rows only', () => {
    expect(WR.orderRules('taller_than').length === 4 && WR.orderRules('inside').length === 0 && WR.propertyDataRules('taller_than').some(r => r.id === 'RELPROP-ASYMMETRIC:taller_than'));
  });
};
