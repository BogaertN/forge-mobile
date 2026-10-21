/* LIVE483 (4.9.83, Nic 2026-10-21 4:41 PM: the live probe is the primary measure; these offline tests pin the failure CLASSES found in it, with
 * sentences that are NOT in the private live probe set). Classes:
 *  a/e  SUBJECT-CLAUSE: in a wh-question with an inverted auxiliary, the subject is the noun phrase between the auxiliary and the predicate; a
 *       passive participle, a bare verb or a predicate adjective after it is the predicate, never part of the subject ("how are bricks made" →
 *       bricks; "why are flamingos pink" → flamingos); "what V-s NP" (subject gap) asks about the object NP.
 *  b    TOKEN-ALNUM: a word mixing letters and digits (a formula, an ordinal, a model name) is one token. */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js'), G = require(ROOT + '/src/grammar.js'), PV = require(ROOT + '/src/provenance.js'), LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const K = KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-21T22:00:00Z' });
const ent = q => { const p = Object.assign({}, K.lookupPlan(q), { question: q }); return PV.questionEntity(p, q); };
const is = (q, want) => { const e = ent(q); expect(e === want, q + ' → ' + JSON.stringify(e) + ' (want ' + want + ')'); };
T('a: passive participle after the subject is the predicate (how are bricks made)', () => is('How are bricks made?', 'bricks'));
T('a: passive participle, singular (how is glass produced)', () => is('How is glass produced?', 'glass'));
T('a: passive participle with a determiner (how was the bridge built)', () => is('How was the bridge built?', 'bridge'));
T('e: predicate adjective after the subject (why are flamingos pink)', () => is('Why are flamingos pink?', 'flamingos'));
T('e: predicate adjective with a determiner (why is the ocean salty → ocean)', () => is('Why is the desert hot?', 'desert'));
T('e: do-support bare verb is the predicate (how does a compass work)', () => is('How does a compass work?', 'compass'));
T('e: do-support verb + object: subject is the first NP (how do bats find food)', () => is('How do bats find food?', 'bats'));
T('e: subject gap "what V-s NP" asks about the object (what causes tides)', () => is('What causes tides?', 'tides'));
T('e: a compound subject stays whole (how are solar panels made)', () => is('How are solar panels made?', 'solar panels'));
T('e: a nationality adjective inside the subject is not the predicate (what does the Italian navy do)', () => is('What does the Italian navy do?', 'italian navy'));
T('e: an unknown head noun still bounds the subject (why are axolotls pink)', () => is('Why are axolotls pink?', 'axolotls'));
T('e: an unknown bare verb at the end is the predicate (why do dogs pant)', () => is('Why do dogs pant?', 'dogs'));
T('e: "what is NP of …" keeps the whole NP (no clause split after what-is)', () => { const e = ent('What is the melting point of copper?'); expect(e && /copper/.test(e) && !/^melting$/.test(e), JSON.stringify(e)); });
T('b: a formula is one token (CH4)', () => { const t = G.tokenize('What is CH4?').map(x => x.w); expect(t.includes('ch4'), JSON.stringify(t)); });
T('b: an ordinal is one token (19th)', () => { const t = G.tokenize('the 19th century').map(x => x.w); expect(t.includes('19th'), JSON.stringify(t)); });
T('b: the entity of a formula question is the formula', () => is('What is CH4?', 'ch4'));
T('b: the entity keeps its ordinal (what is the 26th amendment)', () => is('What is the 26th amendment?', '26th amendment'));
/* QUERY COMPILER (qcompile.js): roles, drift-band expansions, drift-scored matching */
const QC = require(ROOT + '/src/qcompile.js'); const comp = (q, s) => QC.compile(K.lookupPlan(q), q, K.lexicon, s || ent(q));
T('QC: roles — subject, predicate root, asked relation (how are tiles glazed)', () => { const C = comp('How are tiles glazed?'); expect(C.roles.subject === 'tiles' && C.roles.predicate === 'glaze' && C.roles.asked === 'method', JSON.stringify(C.roles)); });
T('QC: a numeral word expansion is inside the band (22nd → twenty-second)', () => { const C = comp('What is the 22nd amendment?'); const e = C.expansions.find(x => x.form === 'twenty-second amendment'); expect(e && e.used && e.drift <= 0.35, JSON.stringify(C.expansions)); });
T('QC: an expansion beyond the band is recorded and not used', () => { const C = comp('What is a lighthouse?'); expect(C.expansions.every(x => x.used === (x.drift <= 0.35)), JSON.stringify(C.expansions)); });
T('QC: a redirect (alternate name) matches within the band, above the exact title', () => { const C = comp('What is NH3?'); const a = QC.subjectDrift(C, { title: 'Ammonia', aliases: ['NH3'], excerpt: 'Ammonia is a compound.' }); expect(a.drift > 0 && a.drift <= 0.35 && a.basis === 'alias', JSON.stringify(a)); });
T('QC: a narrower title (extra modifier) or a qualified sense drifts more than the subject\'s own article', () => { const C = comp('What is a glacier?'); const own = QC.subjectDrift(C, { title: 'Glacier', excerpt: '' }).drift, nar = QC.subjectDrift(C, { title: 'Rock glacier', excerpt: '' }).drift, sen = QC.subjectDrift(C, { title: 'Glacier (band)', excerpt: '' }).drift; expect(own < nar && own < sen, [own, nar, sen].join(' ')); });
T('QC: the lowest-drift sentence fills the asked relation (how are dunes formed)', () => { const C = comp('How are dunes formed?'); const b = QC.bestSentence(C, 'Dunes are popular with tourists. Dunes are formed by wind that carries sand and drops it behind an obstacle. Small dunes may move each year.', 0, ['dune']); expect(b && /wind/.test(b.sentence) && b.drift === 0, JSON.stringify(b)); });
T('QC: every candidate above the band refuses (unmatched title)', () => { const C = comp('What is a glacier?'); expect(QC.subjectDrift(C, { title: 'Volcano', excerpt: 'A volcano is a rupture.' }).drift > 0.35); });
(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e && e.message || e).slice(0, 400); } rows.push({ cls: 'LIVE483', name: t.name, ok, why }); }
  if (process.argv.includes('--human')) { for (const r of rows) if (!r.ok) console.log('FAIL', r.name, '|', r.why); console.log(rows.filter(r => r.ok).length + '/' + rows.length); } else console.log(JSON.stringify(rows)); })();
