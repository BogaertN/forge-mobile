/* R482 (4.9.82, Nic 2026-10-21 3:26 PM: final language-core round; written FIRST; sentences are NOT from the held-back set; only the held-back
 * category and failure type were used: conversation unattached / missing, remember routed to research or missing, cause missing / routed to research,
 * Forge-self unattached, open problem unattached). General mechanisms:
 *  V  CONVERSATION: meta-questions about the previous answer ("how can you be sure about that", "what do you mean by that"); short acknowledgements
 *     and dismissals ("got it", "never mind"); an appraisal of the addressee after thanks; first-person disagreement is a rejection, not a fact;
 *     the perfect copula ("has been sick").
 *  M  REMEMBER: the remember request through other verbs (keep / bear in mind, do not forget, note); naming ("X is called Y" / "what is X called");
 *     "do you remember what I told you about NP"; "never mind what I said about NP".
 *  F  FORGE-SELF: feelings, mistakes, limits, inabilities, maker — answered from self-facts, never blocked or looked up.
 *  C  CAUSE: co-occurrence is not causation (local, not looked up); a stated conditional answers "why".
 *  O  OPEN PROBLEM: "what could we do to V" opens a problem.
 *  X  "has an extractor fan" is one object (the bare-infinitive frame needs a 'somebody' first object). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js'), LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = v => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-21T20:30:00Z', vaultState: v ? () => 'unlocked' : undefined });
const say = (...turns) => { const k = mk(true); let r = null; for (const t of turns) r = k.process(t); return r; };
const kindOf = r => r && r.trace && r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.kind;
const isTool = r => !!(r && r.trace && r.trace.tool_request);
const unatt = r => /could not attach|Please tell me the role|found no verb|found no subject/.test(r.reply || '');
const ok = (r, re) => expect(!unatt(r) && !isTool(r) && (!re || re.test(r.reply || '')), kindOf(r) + ' | ' + r.reply);

/* V */
T('V: "how can you be sure about that" asks for the reason of the last answer', () => { const r = say('Ola keeps goats.', 'Does Ola keep goats?', 'How can you be sure about that?'); ok(r, /told me|goats/); });
T('V: "what do you mean by that" re-states the last answer', () => { const r = say('Ola keeps goats.', 'Does Ola keep goats?', 'What do you mean by that?'); ok(r, /goats/); });
T('V: "got it" is an acknowledgement', () => ok(say('Got it.')));
T('V: "never mind" is a dismissal', () => ok(say('Never mind.')));
T('V: thanks with an appraisal of the addressee', () => ok(say('Thanks a lot, you have been very helpful.')));
T('V: first-person disagreement is a rejection, not a stored fact', () => { const r = say('I disagree.'); expect(kindOf(r) !== 'assert_ack' && !unatt(r), kindOf(r) + ' | ' + r.reply); });
T('V: the perfect copula parses ("has been sick")', () => { const r = say('Pavel has been sick.', 'Has Pavel been sick?'); ok(r, /\bYes\b/); });
/* M */
T('M: "keep in mind that S" stores S; "what is X called" reads the name', () => { const r = say('Keep in mind that my dog is called Rex.', 'What is my dog called?'); ok(r, /Rex/); });
T('M: "do not forget that S" stores S (no lookup for the question)', () => { const r = say('Do not forget that the party is on Sunday.', 'When is the party?'); ok(r, /Sunday/); });
T('M: "bear in mind that S" stores S', () => { const r = say('Bear in mind that Ivo is shy.', 'Is Ivo shy?'); ok(r, /\bYes\b/); });
T('M: "do you remember what I told you about NP" recalls NP', () => { const r = say('Remember that Ivo is shy.', 'Do you remember what I told you about Ivo?'); ok(r, /shy/); });
T('M: "never mind what I said about NP" retracts (asks to confirm)', () => { const r = say('Remember that Ivo is shy.', 'Never mind what I said about Ivo.'); expect(kindOf(r) === 'confirm_forget', kindOf(r) + ' | ' + r.reply); });
/* F */
T('F: "do you have feelings" is answered from self-facts', () => { const r = say('Do you have feelings?'); expect(kindOf(r) === 'self_answer' && /\bNo\b/.test(r.reply || ''), kindOf(r) + ' | ' + r.reply); });
T('F: "can you make mistakes" is a question about Forge, not a blocked action', () => { const r = say('Can you make mistakes?'); expect(kindOf(r) !== 'blocked' && !unatt(r) && !isTool(r), kindOf(r) + ' | ' + r.reply); });
T('F: "what are your limits" is answered from self-facts', () => { const r = say('What are your limits?'); expect(kindOf(r) === 'self_answer', kindOf(r) + ' | ' + r.reply); });
T('F: "what can you not do" parses and is answered from self-facts', () => { const r = say('What can you not do?'); expect(kindOf(r) === 'self_answer', kindOf(r) + ' | ' + r.reply); });
T('F: "who made you" is local', () => ok(say('Who made you?')));
/* C */
T('C: co-occurrence is not causation (local)', () => { const r = say('Ice cream sales and drownings both rise in summer. Does ice cream cause drowning?'); expect(!isTool(r) && !/^Yes/.test(r.reply || ''), kindOf(r) + ' | ' + r.reply); });
T('C: a stated conditional answers "why"', () => { const r = say('If it rains, the road gets wet. It rained. Why is the road wet?'); ok(r, /rain/); });
/* O */
T('O: "what could we do to V" opens a problem', () => { const r = say('What could we do to reduce noise in the city?'); expect(kindOf(r) === 'mea_problem_opened', kindOf(r) + ' | ' + r.reply); });
/* X */
T('X: "has an extractor fan" keeps one object and its determiner in proposed options', () => { const k = mk(true); k.process('The cellar has an extractor fan.'); k.process('The cellar has a heater.'); const r = k.process('Find a way to keep the cellar dry.'); expect(/an extractor fan/.test(r.reply || ''), r.reply); });

/* V2 / M2 (second pass, same rules: new sentences; held-back category and failure type only — conversation unattached / missing, remember
   missing / routed to research) */
T('V2: "sorry, I meant NP" repairs the last statement\'s NP of the same kind', () => { const r = say('Ana lives in Porto.', 'Sorry, I meant Lisbon.', 'Where does Ana live?'); ok(r, /Lisbon/); expect(!/Porto/.test(r.reply), r.reply); });
T('V2: a one-word discourse marker before a comma is read off ("wait, …")', () => { const r = say('Ana lives in Porto.', 'Okay, and where does Ana live?'); ok(r, /Porto/); });
T('V2: "and NP?" re-asks the last question about NP', () => { const r = say('Ana lives in Porto.', 'Bo lives in Faro.', 'Where does Ana live?', 'And Bo?'); ok(r, /Faro/); });
T('V2: "what about NP?" re-asks the last question about NP (local)', () => { const r = say('Ana lives in Porto.', 'Bo lives in Faro.', 'Where does Ana live?', 'What about Bo?'); ok(r, /Faro/); });
T('V2: bare "are you sure?" asks for the reason of the last answer', () => { const r = say('Ola keeps goats.', 'Does Ola keep goats?', 'Are you sure?'); ok(r, /told me|goats/); });
T('V2: "is that correct?" after an answer asks for its reason (local)', () => { const r = say('Ola keeps goats.', 'Does Ola keep goats?', 'Is that correct?'); ok(r, /goats/); });
T('V2: "tell me more" continues about the topic entity', () => { const r = say('Ola keeps goats.', 'Ola lives in Bergen.', 'Does Ola keep goats?', 'Tell me more.'); ok(r, /Bergen/); });
T('V2: evaluative short replies acknowledge ("sounds good", "fair enough", "absolutely")', () => { for (const s of ['Sounds good.', 'Fair enough.', 'Absolutely.']) { const r = say(s); expect(kindOf(r) === 'ack', s + ' → ' + kindOf(r) + ' | ' + r.reply); } });
T('V2: first-person cognition with no object acknowledges ("I understand")', () => { const r = say('I understand.'); expect(kindOf(r) === 'ack', kindOf(r) + ' | ' + r.reply); });
T('V2: "can I ask you something?" is answered as an invitation, not a fact check', () => { const r = say('Can I ask you something?'); ok(r); expect(!/cannot confirm/.test(r.reply), r.reply); });
T('M2: "when" recalls a stated time adjunct of the subject ("moved to Thursday")', () => { const r = say('Remember that the meeting moved to Thursday.', 'When is the meeting?'); ok(r, /Thursday/); });
T('M2: "when does X V" recalls a clock-time adjunct', () => { const r = say('Remember that my train leaves at 9 am.', 'When does my train leave?'); ok(r, /9/); });
T('M2: "when is X" recalls a month in a stated locative predicate', () => { const r = say('Remember that my cousin\'s wedding is in June.', 'When is my cousin\'s wedding?'); ok(r, /June/); });
T('M2: "what is X ADJ to?" (stranded preposition) recalls the complement', () => { const r = say('Remember that Omar is allergic to peanuts.', 'What is Omar allergic to?'); ok(r, /peanuts/); });
T('M2: "how much do I V NP" over the user\'s own fact stays local', () => { const r = say('Remember that I owe Lea twenty euros.', 'How much do I owe Lea?'); ok(r, /twenty/); });

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e && e.stack || e).slice(0, 700); } rows.push({ cls: 'R482', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
