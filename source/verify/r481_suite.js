/* R481 (4.9.81, Nic 2026-10-21 1:44 PM: the "what's left" list in priority order; written FIRST; sentences are NOT from the held-back set). General mechanisms:
 *  V  CONVERSATION: greetings / thanks with a clause; "what colour is it" (attribute noun answered by an adjective of that class); "how do you know that"
 *     after an inference; "why do you think S" (the user's own statement); "say that again"; a counted noun with an appositive list; "X is A, not B".
 *  C  CAUSE: causal chains through a resultative ("A makes N ADJ; ADJ Ns cause Z"); capacity / rate durations; correlation is not causation; counterfactuals stay local.
 *  F  FORGE-SELF: kind / method / capability / storage questions about Forge are answered from its self-facts.
 *  U  RESEARCH SUPPORT: an attribute question ("the main function of X") is supported by a verbatim sentence naming X and a WordNet synonym of the attribute.
 *  P  RANKING of proposed options by WordNet gloss relatedness to the goal.
 *  S  SUBJECTS: capitalised names through "of"; "what kind of N is X" → X; "X in <jurisdiction> law" → X; "which N is the ADJest".
 *  X  an unknown modifier noun keeps its place and determiner ("an extractor fan").
 *  R  self-repair through a pronoun ("I meant she …"). */
const ROOT = require('path').join(__dirname, '..');
const KMOD = require(ROOT + '/src/kernel.js'), LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json'), E = require('./eval_lib.js'), PV = require(ROOT + '/src/provenance.js');
const rows = [], tests = []; const T = (name, fn) => tests.push({ name, fn }); const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const mk = v => KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-21T17:00:00Z', vaultState: v ? () => 'unlocked' : undefined });
const say = (...turns) => { const k = mk(true); let r = null; for (const t of turns) r = k.process(t); return r; };
const kindOf = r => r && r.trace && r.trace.msm && r.trace.msm.meaning && r.trace.msm.meaning.kind;
const isTool = r => !!(r && r.trace && r.trace.tool_request);

const FK = require(ROOT + '/src/forge.js'), AR = require(ROOT + '/src/archives.js'); const { wiki } = require('./fixtures/wikimock.js');
const mkStore = () => { const st = {}; return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } }); };
async function ask(pages, q) { AR._cache.clear(); const f = FK.ForgeKernel({ clock: () => '2026-10-21T18:00:00Z', lexicon: LEX, lexiconExt: EXT, store: mkStore(), vaultIterations: 1000, fetch: wiki(pages) }); await f.vault.setup('correct horse battery'); await f.vault.unlock('correct horse battery'); const r = f.process(q); const t = r.toolJob ? await r.toolJob : null; return { m: t && t.trace && t.trace.msm && t.trace.msm.meaning, reply: String(t ? (t.reply || t.text) : r.reply) }; }
const unatt = r => /could not attach|Please tell me the role|found no verb/.test(r.reply || '');
const qEnt = q => PV.questionEntity(mk(false).lookupPlan(q), q);

/* V */
T('V: a greeting with a well-being question is a phatic turn (no partial structure, no tool)', () => { const r = say('Hi there, how are you?'); expect(!unatt(r) && !isTool(r) && (r.reply || '').length > 0, r.reply); });
T('V: thanks with a clause is a phatic turn', () => { const r = say('Thank you, that helped a lot.'); expect(!unatt(r) && !isTool(r), r.reply); });
T('V: "what colour is it" is answered by the stated adjective of that class', () => { const r = say('My kettle is red.', 'What colour is it?'); expect(/red/.test(r.reply || ''), r.reply); });
T('V: "how do you know that" after an inference names the premises', () => { const r = say('Every dorvel is a plinth. Ana is a dorvel.', 'Is Ana a plinth?', 'And how do you know that?'); expect(/dorvel/.test(r.reply || '') && /plinth/.test(r.reply || ''), r.reply); });
T('V: "why do you think S" cites the user\'s own statement', () => { const r = say('Lena keeps bees.', 'Why do you think Lena keeps bees?'); expect(/you told me|you said|stated/i.test(r.reply || '') && /bees/.test(r.reply || ''), r.reply); });
T('V: "could you say that again, more simply" is a request about the last answer (no partial structure)', () => { const r = say('Could you say that again, more simply?'); expect(!unatt(r) && !isTool(r), r.reply); });
T('V: a counted noun with an appositive list keeps the count', () => { const r = say('Mira has two sisters, Ola and Eva.', 'How many sisters does Mira have?'); expect(/\btwo\b|\b2\b/.test(r.reply || ''), r.reply); });
T('V: "X is A, not B" after "that is wrong" states A and is answered locally', () => { const r = say('No, that is wrong. Brandt is a painter, not a sculptor.', 'What is Brandt?'); expect(!isTool(r) && /painter/.test(r.reply || ''), r.reply); });

/* C */
T('C: a causal chain through a resultative: wind makes the path dusty; dusty paths cause coughing → wind causes coughing', () => { const r = say('Wind makes the path dusty. Dusty paths cause coughing. Does wind cause coughing?'); expect(E.verdict(r) === 'yes', E.verdict(r) + ' | ' + r.reply); });
T('C: capacity and a drain rate give a duration', () => { const r = say('A tank holds 40 litres and a tap drains 8 litres per hour. How long will the tank last?'); expect(/\b5 hours\b/.test(r.reply || ''), r.reply); });
T('C: capacity and a fill rate give a duration', () => { const r = say('A jug holds 6 litres. A hose fills it at 2 litres per minute. How long until it is full?'); expect(/\b3 minutes\b/.test(r.reply || ''), r.reply); });
T('C: a co-variation ("rises when") does not establish causation', () => { const r = say('Umbrella sales rise when colds rise. Do umbrella sales cause colds?'); expect(E.verdict(r) !== 'yes' && !isTool(r), E.verdict(r) + ' | ' + r.reply); });
T('C: a counterfactual about a described system stays local', () => { const r = say('What would happen to the pond if the stream dried up?'); expect(!isTool(r), r.reply); });

/* F */
T('F: "tell me what kind of system you are" is answered from the self-facts', () => { const r = say('Tell me what kind of system you are.'); expect(!unatt(r) && !isTool(r) && /computer program/.test(r.reply || ''), r.reply); });
T('F: "how do you choose what to say" is answered about Forge\'s method', () => { const r = say('How do you choose what to say?'); expect(!unatt(r) && !isTool(r) && /rule/.test(r.reply || ''), r.reply); });
T('F: "what are you able to do for me" lists capabilities locally', () => { const r = say('What are you able to do for me?'); expect(!unatt(r) && !isTool(r), r.reply); });
T('F: "where do you store what I say" names Forge\'s memory', () => { const r = say('Where do you store what I say?'); expect(!unatt(r) && !isTool(r) && /memory/.test(r.reply || ''), r.reply); });

/* U */
const PANC = { 'Pancreas': 'The pancreas is an organ of the digestive system and the endocrine system of vertebrates. Similar in shape to a fish, it acts mainly as a gland. The pancreas plays important roles in digestion and in the regulation of blood sugar. The pancreas is a center of hormone production and is analogous to other glands.' };
T('U: "the main function of X" is supported by a verbatim sentence naming X and a WordNet synonym of "function" (role)', async () => { const x = await ask(PANC, 'What is the main function of the pancreas?'); expect(x.m && x.m.kind === 'research_answer' && !x.m.unsupported, (x.m && x.m.kind) + ' | ' + x.reply); expect(/roles in digestion/.test(x.reply), x.reply); });
T('U: entailment is not loosened: a page that never states the attribute stays unsupported', async () => { const x = await ask({ 'Pancreas': 'The pancreas is an organ of the digestive system and the endocrine system of vertebrates. The pancreas is analogous to other glands.' }, 'What is the main function of the pancreas?'); expect(!x.m || x.m.unsupported || x.m.kind !== 'research_answer', x.reply); });

/* P */
T('P: proposed options are ranked by WordNet gloss relatedness to the goal (heater "supplies warmth" for "keep warm")', () => { const k = mk(true); k.process('The greenhouse has a fan.'); k.process('The greenhouse has a heater.'); const r = k.process('Find a way to keep the greenhouse warm.'); const i = (r.reply || '').indexOf('heater'), j = (r.reply || '').indexOf('fan'); expect(kindOf(r) === 'mea_problem_opened' && i >= 0 && j >= 0 && i < j, kindOf(r) + ' | ' + r.reply); });

/* S */
T('S: a capitalised name continues through "of" ("the International Court of Justice")', () => { const e = qEnt('What does the International Court of Justice do?'); expect(/international court of justice|international court justice/.test(e), e); });
T('S: "what kind of N is X" is about X', () => { const e = qEnt('What kind of metal is zinc?'); expect(e === 'zinc', e); });
T('S: "X in <jurisdiction> law" is about X', () => { const e = qEnt('What is due process in German law?'); expect(/^due process/.test(e), e); });
T('S: "which N is the ADJest" keeps the superlative', () => { const e = qEnt('Which planet is the largest?'); expect(/largest/.test(e), e); });
T('S: the 4.9.80 attribute subject still holds ("the boiling point of ethanol" → ethanol)', () => { const e = qEnt('What is the boiling point of ethanol?'); expect(e === 'ethanol', e); });

/* X */
T('X: an unknown modifier noun keeps its place and determiner', () => { const r = say('The cellar has an extractor fan.'); expect(/an extractor fan/.test(r.reply || ''), r.reply); });

/* R */
T('R: self-repair through a pronoun replaces the earlier statement', () => { const r = say('Lucia lives in Porto.', 'Sorry, I meant she lives in Braga.', 'Where does Lucia live?'); expect(/Braga/.test(r.reply || '') && !/Porto/.test(r.reply || ''), r.reply); });

(async () => { for (const t of tests) { let ok = false, why = ''; try { const v = await t.fn(); ok = v === undefined || v === true; } catch (e) { why = String(e && e.stack || e).slice(0, 700); } rows.push({ cls: 'R480', name: t.name, ok, why }); } process.stdout.write(JSON.stringify(rows)); })();
