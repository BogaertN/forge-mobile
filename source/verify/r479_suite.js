/* R479 (4.9.79, Nic 2026-10-21: generative language pipeline, gaps found from the held-back failures; written FIRST; DIFFERENT sentences from the
 * held-back set — none of these appears there). Each case tests a general mechanism, not a question:
 *  D  DISCOURSE: premises and a question in one message are read one sentence at a time when the world cannot read a premise as a whole
 *     (a conditional, a causal statement); the answer leads; consecutive acknowledgements aggregate into one derived sentence.
 *  Q  QUANTITY DECISIONS: two routes giving the same quantity in different unit spellings agree (no false "2 readings").
 *  T  TIES OF NON-ANSWERS: when every tied candidate withholds, there is nothing to choose between: no readings are offered. */
const ROOT = require('path').join(__dirname, '..'); const fs = require('fs'), path = require('path');
const KMOD = require(ROOT + '/src/kernel.js'), LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json'), E = require('./eval_lib.js');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const K = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-21T16:00:00Z' });
const say = (...turns) => { const k = K(); let r = null; for (const t of turns) r = k.process(t); return r; };
const kindOf = r => r && r.trace && r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.kind;

/* ---------------- D. discourse ---------------- */
for (const q of ['If the pump fails then the basement floods. The pump fails. Does the basement flood?', 'If the kiln overheats, the glaze cracks. The kiln overheats. Does the glaze crack?', 'When the fuse blows, the alarm sounds. The fuse blows. Does the alarm sound?'] /* test edit: the first version used "go out", whose two readings (motion vs extinguished) are a real particle-verb ambiguity — recorded as an open gap, not a discourse case */)
  T('D: premises and a question in one message are answered from the premises: "' + q + '"', () => { const r = say(q); expect(E.verdict(r) === 'yes', 'verdict ' + E.verdict(r) + ' | ' + r.reply); expect(/^Yes\b/.test(r.reply), 'the answer does not lead: ' + r.reply); });
T('D: a conditional with a negative answer stays negative-or-withheld, never yes', () => { const r = say('If the pump fails then the basement floods. The pump works. Does the basement flood?'); expect(E.verdict(r) !== 'yes', r.reply); });
T('D: the same discourse sent turn by turn and in one message gives the same verdict', () => { const a = say('If the kiln overheats, the glaze cracks.', 'The kiln overheats.', 'Does the glaze crack?'), b = say('If the kiln overheats, the glaze cracks. The kiln overheats. Does the glaze crack?'); expect(E.verdict(a) === E.verdict(b), E.verdict(a) + ' vs ' + E.verdict(b)); });
T('D: consecutive acknowledgements aggregate: one "not stored" sentence for several premises (derived, not repeated per sentence)', () => { const r = say('If the pump fails then the basement floods. The pump fails. Does the basement flood?'); const n = (r.reply.match(/not stored/g) || []).length; expect(n <= 1, n + ' acknowledgements: ' + r.reply); });
T('D: a statement-only discourse still acknowledges every statement (aggregated) and stores nothing', () => { const r = say('The orchard has forty trees. The barn is red.'); expect(/forty trees/.test(r.reply) && /barn is red/.test(r.reply), r.reply); expect((r.reply.match(/not stored/g) || []).length === 1, r.reply); });

/* ---------------- Q. quantity decisions ---------------- */
for (const [q, v] of [['How many minutes are in 3 hours?', '180'], ['How many grams are in 4 kilograms?', '4000'], ['How many seconds are in 5 minutes?', '300']])
  T('Q: "' + q + '" is one answer (' + v + '), not readings', () => { const r = say(q); expect(kindOf(r) !== 'clarify_readings', r.reply); expect(new RegExp('\\b' + v + '\\b').test(r.reply.replace(/,/g, '')), r.reply); });

/* ---------------- T. ties of non-answers ---------------- */
T('T: when every tied candidate withholds, no readings are offered (a withheld answer is not a reading)', () => { const r = say('Snow makes the trail icy. Icy trails cause falls. Does snow cause falls?'); expect(kindOf(r) !== 'clarify_readings', r.reply); });

/* ---------------- P. pronouns and apposition ----------------
 *  P  REFERENCE BY ANSWERABILITY: of several discourse candidates, the one under which the question can be answered is the referent;
 *     CLOSE APPOSITION: "my neighbour Anselm" is one referent (name + description); an unresolved pronoun is never a public lookup. */
const sayV = (...turns) => { const k = KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-21T16:00:00Z', vaultState: () => 'unlocked' }); let r = null; for (const t of turns) r = k.process(t); return r; };
T('P: "where is it" resolves to the candidate the stored fact can answer', () => { const r = say('The ledger is in the safe.', 'Where is it?'); expect(kindOf(r) === 'recall' && /ledger is in the safe/.test(r.reply), r.reply); });
T('P: "where does she teach" after a named person resolves to that person', () => { const r = say('Mireille teaches in Lyon.', 'Where does she teach?'); expect(kindOf(r) === 'recall' && /Lyon/.test(r.reply), r.reply); });
T('P: close apposition "my neighbour Anselm" is parsed (not blocked) and realized with its description', () => { const r = say('My neighbour Anselm repairs clocks.'); expect(!r.blocked && /neighbour Anselm repairs clocks/.test(r.reply || ''), String(r.reply)); });
T('P: a pronoun question after an appositive statement is answered from it', () => { const r = sayV('My neighbour Anselm repairs clocks.', 'What does he repair?'); expect(kindOf(r) === 'recall' && /clocks/.test(r.reply), kindOf(r) + ' | ' + r.reply); });
T('P: an unresolved pronoun question never starts a public lookup, and the pronoun keeps its case', () => { const r = sayV('Where does she work?'); expect(kindOf(r) !== 'tool_started', kindOf(r) + ' | ' + r.reply); expect(!/\babout she\b/.test(r.reply || ''), String(r.reply)); });

/* ---------------- M. open problems → the MEA problem lane ----------------
 *  M  A directive or a "how could/can we …" question whose object is a cognition artefact (WordNet noun.cognition: an explanation, method,
 *     proof, theory) or whose verb is a cognition verb (verb.cognition: solve, prove, estimate), or a purpose infinitive goal ("a way to X"),
 *     is an open problem: it opens a DRAFT problem manifest in the MEA lane (no lookup, nothing committed; a commit needs a tap). */
const kV = () => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-21T16:00:00Z', vaultState: () => 'unlocked' });
const isMea = r => /^mea_/.test(kindOf(r) || '') && !(r.trace && r.trace.tool_request);
for (const q of ['Find a way to cool the server room without power.', 'Propose an explanation for the decline of the oyster beds.', 'How could we prove that the bridge is safe?', 'Devise a method to measure the depth of the lake.'])
  T('M: "' + q + '" opens a draft problem in the MEA lane, not a lookup or a refusal', () => { const k = kV(), r = k.process(q); expect(isMea(r), kindOf(r) + ' | ' + r.reply); const ps = k.meaProblems().filter(p => p.draft); expect(ps.length === 1, 'drafts ' + ps.length); expect(!!r.reply && !/not authorized/.test(r.reply), r.reply); });
for (const q of ['Write a poem about the harbour.', 'Cook the rice.', 'How do I boil an egg?'])
  T('M: "' + q + '" is not an open problem', () => { const r = kV().process(q); expect(!isMea(r), kindOf(r) + ' | ' + r.reply); });
T('M: an opened problem is a draft: nothing is committed without a tap, and the goal comes from the request', () => { const k = kV(); k.process('Find a way to cool the server room without power.'); const p = k.meaProblems().find(x => x.draft); expect(p && /cool the server room/.test(p.goal), JSON.stringify(p)); const cy = k.meaCycle(p.problem_id); expect(cy.ok, JSON.stringify(cy).slice(0, 200)); const c = (cy.cycle.candidates || [])[0]; const cm = k.meaCommit(p.problem_id, c ? c.candidate_id : 'x', false); expect(!cm.ok, JSON.stringify(cm)); });

/* ---------------- A. abbreviations, W. time predicates, U. compound units, F. phatic acts ----------------
 *  A  ORTHOGRAPHY: a period inside an initialism ("U.S.") or after a title abbreviation does not end the sentence.
 *  W  KĀLA AS PREDICATE: "X is on <day>" states X's time; "when is X" asks for it (the time noun's lexical class, not a word list).
 *  U  COMPOUND UNITS: a hyphenated product of two units ("watt-hours") is the product of their dimensions and factors.
 *  F  PHATIC ACTS: a verbless greeting / thanks / farewell is recognised from the WordNet gloss of its head (an expression of greeting,
 *     of gratitude, a farewell) and answered with the matching act, not a parse failure. */
T('A: "Research the U.S. constitution" is one sentence and the research target keeps "U.S. constitution"', () => { const r = sayV('Research the U.S. constitution'); expect(kindOf(r) !== 'sequence', kindOf(r) + ' | ' + r.reply); const tr = r.trace.tool_request; expect(tr && /U\.S\. constitution/.test(tr.input), JSON.stringify(tr)); });
T('A: a title abbreviation does not split a statement ("Mr. Pell sold the boat.")', () => { const r = say('Mr. Pell sold the boat.'); expect(kindOf(r) !== 'sequence' && /Pell sold the boat/.test(r.reply || ''), kindOf(r) + ' | ' + r.reply); });
for (const [f, q, w] of [['The recital is on Friday.', 'When is the recital?', 'Friday'], ['The audit was in March.', 'When was the audit?', 'March']])
  T('W: "' + q + '" after "' + f + '" recalls the time', () => { const r = say(f, q); expect(kindOf(r) === 'recall' && new RegExp(w).test(r.reply), kindOf(r) + ' | ' + r.reply); });
for (const [q, v] of [['How many joules are in 2 watt-hours?', '7200'], ['How many watt-hours are in 36000 joules?', '10']])
  T('U: "' + q + '" = ' + v, () => { const r = say(q); expect(new RegExp('\\b' + v + '\\b').test(String(r.reply).replace(/,/g, '')), kindOf(r) + ' | ' + r.reply); });
for (const q of ['Good evening!', 'Many thanks for the help.', 'Cheers!', 'Farewell, friend.'])
  T('F: "' + q + '" is recognised as a social act, not a parse failure', () => { const r = say(q); expect(kindOf(r) === 'interjection' && !!r.reply && !/could not attach|found no verb/.test(r.reply), kindOf(r) + ' | ' + r.reply); });

/* ---------------- X. alternate names by initialism ----------------
 *  X  A proper-name run in the subject ("United States", "European Union") has its initialism as an alternate name ("U.S.", "US", "EU"): the
 *     initialism form of the full phrase is also tried as a direct title (its redirect reaches the article), and a source whose alternate name
 *     uses the initialism names the same subject. Offline fixture web only. */
const FK = require(ROOT + '/src/forge.js'), AR = require(ROOT + '/src/archives.js'), { wiki } = require('./fixtures/wikimock.js');
async function ask(pages, q, redirects) { if (AR._cache) AR._cache.clear(); const st = {}; const f = FK.ForgeKernel({ clock: () => '2026-10-21T16:00:00Z', lexicon: LEX, lexiconExt: EXT, store: KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }), vaultIterations: 1000, fetch: wiki(pages, redirects) }); await f.vault.setup('correct horse'); await f.vault.unlock('correct horse');
  const r = f.process(q); const t = r.toolJob ? await r.toolJob : null; return { r, t, m: t && t.trace && t.trace.msm && t.trace.msm.meaning, reply: (t && (t.reply || t.text)) || '' }; }
const srcOf = x => x.m && (x.m.source || (x.m.items || [])[0]);
T('X: "research United States tax code" reaches the article that "U.S. tax code" redirects to', async () => {
  const pages = { 'Internal Revenue Code': 'The Internal Revenue Code is the domestic portion of federal statutory tax law in the United States.', 'United States': 'The United States is a country primarily located in North America.', 'Taxation in the United States': 'The United States has separate federal, state, and local governments with taxes imposed at each of these levels.' };
  const x = await ask(pages, 'research United States tax code', { 'U.S. tax code': 'Internal Revenue Code' }); expect(srcOf(x) === 'Internal Revenue Code', 'source ' + JSON.stringify(srcOf(x)) + ' | ' + x.reply); });
T('X: the same mechanism without periods: "research European Union water code" via the redirect "EU water code"', async () => {
  const pages = { 'Water Framework Directive': 'The Water Framework Directive is a directive of the European Union that commits member states to achieve good status of water bodies.', 'European Union': 'The European Union is a supranational political and economic union of member states located in Europe.' };
  const x = await ask(pages, 'research European Union water code', { 'EU water code': 'Water Framework Directive' }); expect(srcOf(x) === 'Water Framework Directive', 'source ' + JSON.stringify(srcOf(x)) + ' | ' + x.reply); });

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e && e.stack || e).slice(0, 700); } rows.push({ cls: 'R479', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
