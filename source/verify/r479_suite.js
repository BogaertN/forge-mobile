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

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e && e.stack || e).slice(0, 700); } rows.push({ cls: 'R479', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
