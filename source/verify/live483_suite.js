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
T('b: a formula is one token (CH4)', () => { const t = G.tokenize('What is CH4?').map(x => x.w); expect(t.includes('ch4'), JSON.stringify(t)); });
T('b: an ordinal is one token (19th)', () => { const t = G.tokenize('the 19th century').map(x => x.w); expect(t.includes('19th'), JSON.stringify(t)); });
T('b: the entity of a formula question is the formula', () => is('What is CH4?', 'ch4'));
T('b: the entity keeps its ordinal (what is the 26th amendment)', () => is('What is the 26th amendment?', '26th amendment'));
(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e && e.message || e).slice(0, 400); } rows.push({ cls: 'LIVE483', name: t.name, ok, why }); }
  if (process.argv.includes('--human')) { for (const r of rows) if (!r.ok) console.log('FAIL', r.name, '|', r.why); console.log(rows.filter(r => r.ok).length + '/' + rows.length); } else console.log(JSON.stringify(rows)); })();
