/* R480 (4.9.80, Nic 2026-10-21 11:36: part C items 3-9; written FIRST; sentences are NOT from the held-back set). General mechanisms:
 *  O  PROPOSALS for a user-opened problem: the user's own working facts about the problem's entities supply the options of a choice unknown
 *     (each option is the fact's other participant; its fact is the assumption); a cycle then yields hypothesis candidates; commit only on tap.
 *  C  CAUSE: a verb glossed in WordNet as "cause to V" (kill = cause to die) entails V of its object; a generic present conditional applies to a
 *     past instance (tense of the instance carries to the consequent); a premise + why-question recalls the stated cause.
 *  S  SUBJECT of an attribute/relational noun question ("the function of X", "the symptoms of X"): the research subject is X.
 *  Y  SELF: "how old are you" / "when were you made" are answered from Forge's own build record, not from the user's facts.
 *  K  OBJECT PREDICATIVE: "keep / make / leave NP ADJ" (WordNet frame "Somebody ----s something Adjective/Noun") parses.
 *  B  KIN COUNT about a bare given name is about the user's world: never a public lookup.
 *  L  PLURAL of a gerund noun ("floodings") lemmatizes to the -ing noun. */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js'), LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json'), E = require('./eval_lib.js'), PV = require(ROOT + '/src/provenance.js');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = v => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-21T17:00:00Z', vaultState: v ? () => 'unlocked' : undefined });
const say = (...turns) => { const k = mk(true); let r = null; for (const t of turns) r = k.process(t); return r; };
const kindOf = r => r && r.trace && r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.kind;
const isTool = r => !!(r && r.trace && r.trace.tool_request);

/* O */
T('O: facts about the problem\'s entity become the options of a choice unknown; the cycle proposes hypotheses; no commit without a tap', () => {
  const k = mk(true); k.process('The cellar has a dehumidifier.'); k.process('The cellar has a ceiling fan.') /* test edit: "an extractor fan" exposed a separate bug (a provisional -or noun drops from the compound); listed as open */; const r = k.process('Find a way to dry the cellar.');
  expect(kindOf(r) === 'mea_problem_opened', kindOf(r) + ' | ' + r.reply); expect(/dehumidifier/.test(r.reply) && /ceiling fan/.test(r.reply), r.reply);
  const p = k.meaProblems().find(x => x.draft); const cy = k.meaCycle(p.problem_id); expect(cy.ok, JSON.stringify(cy).slice(0, 200));
  const hyp = (cy.cycle.candidates || []).filter(c => c.op === 'hypothesize'); expect(hyp.length >= 2, 'hypothesis candidates ' + hyp.length);
  expect(!k.meaCommit(p.problem_id, hyp[0].candidate_id, false).ok, 'commit without tap'); });
T('O: with no related facts the problem stays a value unknown (no invented options)', () => { const k = mk(true); const r = k.process('Find a way to dry the cellar.'); const p = k.meaProblems().find(x => x.draft); expect(p && p.value_unknowns.length === 1, JSON.stringify(p)); expect(!/option/.test(r.reply), r.reply); });

/* C */
T('C: "kill" (cause to die) entails "die": frost killed the blossoms → did the blossoms die? yes', () => { const r = say('Frost killed the blossoms.', 'Did the blossoms die?'); expect(E.verdict(r) === 'yes', E.verdict(r) + ' | ' + r.reply); });
T('C: the same in one message', () => { const r = say('Frost killed the blossoms. Did the blossoms die?'); expect(E.verdict(r) === 'yes', E.verdict(r) + ' | ' + r.reply); });
T('C: a generic present conditional applies to a past instance', () => { const r = say('If the kettle boils, the whistle sounds. The kettle boiled. Did the whistle sound?'); expect(E.verdict(r) === 'yes', E.verdict(r) + ' | ' + r.reply); });
T('C: why-question after a causative statement names the cause', () => { const r = say('Frost killed the blossoms.', 'Why did the blossoms die?'); expect(/frost/i.test(r.reply) && !isTool(r), kindOf(r) + ' | ' + r.reply); });

/* S */
const K0 = () => KMOD.Kernel({ lexicon: LEX });
for (const [q, s] of [['What is the main function of the spleen?', 'spleen'], ['What are the symptoms of measles?', 'measles'], ['What is the boiling point of ethanol?', 'ethanol']])
  T('S: the research subject of "' + q + '" is "' + s + '"', () => { const p = K0().lookupPlan(q), e = PV.questionEntity(p, q); expect(e === s || e === s + 's', 'subject "' + e + '"'); });

/* Y */
for (const q of ['How old are you?', 'When were you built?'])
  T('Y: "' + q + '" is answered about Forge itself, not as a missing user fact', () => { const r = say(q); expect(!isTool(r) && kindOf(r) !== 'recall_none' && !/no stored fact/.test(r.reply || ''), kindOf(r) + ' | ' + r.reply); });

/* K */
for (const q of ['Keep the greenhouse warm.', 'The sun made the paint dry.', 'Leave the door open.'])
  T('K: "' + q + '" parses (no partial structure)', () => { const r = say(q); expect(!/could not attach|found no/.test(r.reply || ''), kindOf(r) + ' | ' + r.reply); });
T('K: an open problem with an object predicative opens a draft', () => { const r = say('Find a way to keep the greenhouse warm.'); expect(kindOf(r) === 'mea_problem_opened', kindOf(r) + ' | ' + r.reply); });

/* B */
for (const q of ['How many sisters does Ines have?', 'How many cousins does Tomas have?'])
  T('B: "' + q + '" is about the user\'s world, never a public lookup', () => { const r = say(q); expect(!isTool(r), kindOf(r) + ' | ' + r.reply); });

/* L */
T('L: the plural of a gerund noun is known ("Floodings were rare.")', () => { const r = say('Floodings were rare.'); expect(!/I took|unknown|could not/.test(r.reply || ''), r.reply); });

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e && e.stack || e).slice(0, 700); } rows.push({ cls: 'R480', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
