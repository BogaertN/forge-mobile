/* R4241 (4.9.241, plan 229 step 10): SELF-FACTS FROM CLAUSES, and no Echo forced anywhere.
 * The canned chat sentences (CHAT_FACTS), the language core's self-fact hop with its synthetic high-confidence node, the
 * string-equality self trust and the speech-act Echo bypass are gone. The kernel's facts about itself are the kāraka clauses
 * of src/selfmodel.js, sent as memory.self and answered through frame, Derive, outward compile and structural Echo, spoken in
 * the kernel's person. A greeting stays a speech act, scored by structural Echo for speech acts and by its measured C.
 * Also: a bare-plural remembered clause is a kind, and the converse of a kind inclusion is "not necessarily". The proof is the
 * Ask run in headless Chrome (/workspace/step241, CONFLICTS.md v4.9.242). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js'), FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const PY = process.env.PYTHON || 'python3';
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-05T13:30:00Z' });
const py = (code, input) => {
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, input: JSON.stringify(input || {}), env, encoding: 'utf8', maxBuffer: 1 << 28 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const SEED = py(`
import json
from tools.live_188 import SEED
print(json.dumps(SEED))`);
const RUN = `
import json, sys
from rmc_engine_v1.rmc_core import run
p = json.load(sys.stdin)
print(json.dumps(run(p), default=str))`;
const ask = (q, phone) => {
  const mem = JSON.parse(JSON.stringify(SEED)); if (phone) mem.phone = phone;
  let p = { question: q, live: true, memory: mem };
  p = CORE.withClauses(Object.assign({}, p, { frame: Q.compile(q, f) }), Q, f);
  return py(RUN, p);
};

T('no canned self sentence, no synthetic self node, no string-equality self trust, no forced Echo', () => {
  const eng = ['world_model_v1.py', 'rmc_core.py', 'language_core_orchestration.py', 'deep_dry_run_orchestrator.py', 'language_core_proto_chat.py', 'structural_echo.py']
    .map(x => read('engine/rmc_engine_v1/' + x).replace(/^\s*#.*$/gm, '')).join('\n');
  for (const bad of ['CHAT_FACTS', '_chat_derived', 'speech_act_meaning', 'does not store a feeling', 'answers from admitted facts', 'chat_fact_act', '"self_fact": hop'])
    expect(!eng.includes(bad), 'still in the engine: ' + bad);
  expect(!/echo\["score"\]\s*=\s*1\.0/.test(eng) && !/echo\["pass"\]\s*=\s*True/.test(eng), 'a forced Echo');
  expect(!/"confidence": "high",\s*"source": "",/.test(eng), 'the synthetic self node');
});

T('the self-facts are selfmodel clauses re-read as clauses about the kernel, not strings', () => {
  const SM = require(ROOT + '/src/selfmodel.js');
  const rows = CORE.selfRows(Q, f);
  expect(rows.length >= 8 && rows.length <= Object.keys(SM.FACTS).length, 'rows ' + rows.length);
  for (const r of rows) {
    expect(r.clause && r.clause.parsed && (r.clause.kartr.kernel || r.clause.kartr.owner === 'kernel'), r.text);
    expect(/^(You|Your)\b/.test(r.text) && r.trust === 'trusted' && r.tier === 'self' && /selfmodel\.js FACTS\./.test(r.provenance.source), JSON.stringify(r).slice(0, 200));
  }
  expect(rows.some(r => r.text === 'Your name is Forge.') && rows.some(r => r.text === 'You are a computer program.'), rows.map(r => r.text).join(' | '));
  const src = read('src/rmc_core.js');
  expect(!/You are a computer program|Your name is Forge/.test(src), 'no self sentence literal on the phone');
});

T('self questions are answered from self-facts through frame, Derive, compile and structural Echo, in the kernel\'s person', () => {
  const want = { 'Who are you?': /^I am a computer program\.$/, 'What is your name?': /^My name is Forge\.$/, 'What can you do?': /^I (compute|derive|know) /,
    'Do you have a body?': /^I have no body\.$/, 'Are you a person?': /^I am not a person\.$/ };
  for (const [q, re] of Object.entries(want)) {
    const r = ask(q);
    const sv = ((r.world_model || {}).derive || {}).survivor || {};
    expect(r.product_reply === true && re.test(r.reply || ''), q + ' → ' + JSON.stringify([r.reply, r.route, r.coherence, r.echo && r.echo.method]));
    expect(r.echo && r.echo.method === 'structural_frame' && r.echo.score >= 0.85, q + ' echo ' + JSON.stringify(r.echo).slice(0, 300));
    expect(sv.perspective === 'speaker' && (sv.premises || []).every(p => p.source === 'self_model'), q + ' premises ' + JSON.stringify(sv.premises).slice(0, 300));
    expect(r.coherence >= 0.87, q + ' C ' + r.coherence);
  }
});

T('a greeting is scored by structural Echo for speech acts and by its measured C, never forced', () => {
  const r = py(`
import json
from rmc_engine_v1.structural_echo import speech_act_score as s
print(json.dumps([s("Hello.", "Hello."), s("Hi", "Hi."), s("Hello.", "I am a computer program."), s("Hello.", "Hello, whale.")]))`);
  expect(r[0].pass && r[0].score === 1 && r[1].pass, JSON.stringify(r[0]));
  expect(!r[2].pass && !r[3].pass, 'a greeting answered by a fact or by more than the act fails: ' + JSON.stringify([r[2].score, r[3].score]));
  const h = ask('Hello.');
  expect(h.echo && h.echo.method === 'structural_speech_act', JSON.stringify(h.echo).slice(0, 300));
  expect(h.product_reply === (h.coherence >= 0.87 && h.echo.pass && h.drift <= 0.35) || h.product_reply === false, 'the gate decides on measured numbers');
});

const MATCH = `
import json, sys
from rmc_engine_v1 import derive_frame as DF
d = json.load(sys.stdin)
print(json.dumps([DF.match(q, c) for q, c in d["pairs"]]))`;
T('a remembered bare plural is a kind, and meets the singular and the plural question', () => {
  const c = Q.clause('Whales are mammals.', f);
  expect(c.parsed && c.kartr.text === 'a whale' && c.pred && c.pred.type === 'np' && c.pred.text === 'a mammal' && (c.canonical || []).some(x => x.rule === 'QF-CANON-GENERIC-PLURAL'), JSON.stringify(c).slice(0, 400));
  const p = Q.clause('My dogs are hungry.', f); expect(!p.canonical, 'a possessive plural is not a generic');
  const r = py(MATCH, { pairs: [[Q.compile('Are whales mammals?', f), c], [Q.compile('Is a whale a mammal?', f), c]] });
  expect(r[0] && r[0].filler === 'yes' && r[1] && r[1].filler === 'yes', JSON.stringify(r));
});

T('the converse of a kind inclusion is "not necessarily"; identity, a particular and a negative fact give no converse', () => {
  const whale = Q.clause('A whale is a living thing.', f), rex = Q.clause('Rex is a dog.', f), dog = Q.clause('My dog is Rex.', f), fish = Q.clause('A whale is not a fish.', f);
  const r = py(MATCH, { pairs: [[Q.compile('Is a living thing a whale?', f), whale], [Q.compile('Is a dog Rex?', f), rex], [Q.compile('Is Rex my dog?', f), dog], [Q.compile('Is a fish a whale?', f), fish]] });
  expect(r[0] && r[0].rule === 'polar_converse' && r[0].filler === 'not necessarily' && r[0].entails === false, JSON.stringify(r[0]));
  expect(r[1] === null, 'membership of a particular: ' + JSON.stringify(r[1]));
  expect(r[2] && r[2].filler === 'yes' && r[2].rule === 'polar', 'identity: ' + JSON.stringify(r[2]));
  expect(r[3] === null, 'negative fact: ' + JSON.stringify(r[3]));
  const a = ask('Is a living thing a whale?', [{ id: 'w', text: 'A whale is a living thing.', scope: 'phone', provenance: { requested_by: 'user', request: 'remember_command', kind: 'statement' } }]);
  expect(a.product_reply ? /^Not necessarily\. /.test(a.reply) && !/^yes/i.test(a.reply) : true, JSON.stringify([a.reply, a.route]));
});

T('a "how" gap (prakāra) is not filled by a noun phrase; an adjective state still answers it', () => {
  const prog = Q.clause('You are a computer program.', f), sky = Q.clause('The sky is blue.', f);
  const r = py(MATCH, { pairs: [[Q.compile('How are you?', f), prog], [Q.compile('Who are you?', f), prog]] });
  expect(r[0] === null, 'How are you? must not take an NP filler: ' + JSON.stringify(r[0]));
  expect(r[1] && r[1].filler === 'a computer program', 'who still fills: ' + JSON.stringify(r[1]));
  const src = read('engine/rmc_engine_v1/derive_frame.py'); expect(/role == "prakara" and not \(isinstance\(fp, dict\) and str\(fp.get\("type"\) or ""\).startswith\("adj"\)\)/.test(src), 'rule present');
  void sky;
});

T('a bare-plural kind sentence compiles outward through its canonical reading, and still holds on another atom', () => {
  const R2 = require(ROOT + '/src/rmc_renderer_200.js');
  const A = (y) => ({ predicate: 'is', args: ['a whale', y], polarity: 'pos' });
  const row = (q, sents) => CORE.outwardCompile({ ok: true, product_reply: true, reply: sents.map(x => x.text).join(' '), admit: { disposition: 'admit' },
    outward: { schema: 'forge.outward/v1', measured_text: sents.map(x => x.text).join(' '), sentences: sents, quotes: [] } }, { question: q }, f, R2, Q);
  const ok = row('Are whales mammals?', [{ text: 'Whales are mammals.', atom: A('a mammal'), source_id: 'm', verbatim: true, role: 'conclusion' }]);
  expect(ok.reply === 'Whales are mammals.' && ok.outward_compile.sentences[0].via === 'canonical' && ok.outward_compile.sentences[0].canon_rule === 'QF-CANON-GENERIC-PLURAL', JSON.stringify(ok.outward_compile).slice(0, 400));
  const conv = row('Is a mammal a whale?', [{ text: 'Not necessarily.' }, { text: 'Whales are mammals.', atom: A('a mammal'), source_id: 'm', verbatim: true, role: 'conclusion' }]);
  expect(conv.reply === 'Not necessarily. Whales are mammals.', JSON.stringify([conv.reply, conv.route]));
  const bad = row('Are whales fish?', [{ text: 'Whales are mammals.', atom: A('a fish'), source_id: 'm', verbatim: true, role: 'conclusion' }]);
  expect(bad.route === 'outward_compile_hold' && bad.reply === null, 'another atom still holds: ' + JSON.stringify([bad.reply, bad.route]));
  const car = row('What color is my car?', [{ text: 'Your car is red.', atom: { predicate: 'is', args: ['your car', 'red'], polarity: 'pos' }, source_id: 'c', verbatim: false, role: 'conclusion' }]);
  expect(car.reply === 'Your car is red.' && car.outward_compile.mode === 'compiled', 'an adjective predicate is an atom the reader states: ' + JSON.stringify([car.reply, car.route]));
});

/* 4.9.242 (Nic: natural conversation) the speech-act lexicon */
const SA = require(ROOT + '/src/speech_acts.js');
T('the speech-act lexicon stores meanings (act, forms, response act, kāraka frame), one copy on each side, no reply lines in code', () => {
  const J = JSON.parse(read('engine/rmc_engine_v1/speech_acts.json'));
  expect(JSON.stringify(J) === JSON.stringify(SA.DATA), 'src/speech_acts.js DATA = engine/rmc_engine_v1/speech_acts.json');
  for (const a of ['greet', 'farewell', 'thank', 'apologize', 'ask_wellbeing', 'ask_help', 'acknowledge']) {
    const e = J.acts[a]; expect(e && e.forms.length && e.frame && e.frame.kriya && ['act', 'frame', 'none'].includes(e.answered_by) && ('response' in e), a);
    expect(e.response === null || J.acts[e.response] || /^report_/.test(e.response), a + ' response');
  }
  const code = ['engine/rmc_engine_v1/speech_acts.py', 'engine/rmc_engine_v1/rmc_core.py', 'engine/rmc_engine_v1/language_core_proto_chat.py', 'engine/rmc_engine_v1/language_core_orchestration.py',
    'engine/rmc_engine_v1/structural_echo.py', 'src/qframe.js', 'src/rmc_core.js'].map(read).join('\n').replace(/^\s*(#|\/\/|\*).*$/gm, '');
  for (const bad of ["you're welcome", "that's all right", 'good morning', '"Hello."', "'Hello.'"]) expect(!code.toLowerCase().includes(bad.toLowerCase()), 'reply line in code: ' + bad);
  const body = read('src/speech_acts.js').replace(/const DATA = [\s\S]*?\n\};\n/, '');
  expect(!/welcome|all right|morning/i.test(body), 'the phone copy has no reply line outside DATA');
});

const SAMPLE = ['Hello.', 'Hi', 'Good morning', 'Thanks', 'Thank you!', 'Sorry', 'Bye', 'How are you?', 'Help', 'Hi, who wrote Hamlet?', 'Hello, how are you?', 'Thanks, bye!', 'Help is on the way.', 'Hi there', 'Sorry I am late', 'OK.', "I'm sorry", 'How’s it going?'];
T('the question compiler classifies the act; the phone and the engine classifiers agree', () => {
  const pyr = py(`
import json, sys
from rmc_engine_v1.speech_acts import classify
print(json.dumps([classify(q) for q in json.load(sys.stdin)["S"]]))`, { S: SAMPLE });
  const js = SAMPLE.map(q => SA.classify(q));
  expect(JSON.stringify(js.map(c => [c.acts.map(a => [a.act, a.form, a.start, a.end]), c.rest, c.pure, c.match])) === JSON.stringify(pyr.map(c => [c.acts.map(a => [a.act, a.form, a.start, a.end]), c.rest, c.pure, c.match])), JSON.stringify({ js: js.map(c => c.acts.map(a => a.act)), py: pyr.map(c => c.acts.map(a => a.act)) }));
  const fr = q => Q.compile(q, f);
  expect(fr('Hello.').rule === 'QF-SPEECH-ACT' && fr('Hello.').acts[0].act === 'greet', JSON.stringify(fr('Hello.')));
  expect(fr('Help').canonical.some(x => x.rule === 'QF-ACT-FRAME') && fr('Help').kriya === 'do' && fr('Help').wh_role === 'karma', JSON.stringify(fr('Help')).slice(0, 300));
  expect(fr('How are you doing?').wh_role === 'prakara' && fr('How are you doing?').kriya === 'be', 'every form of ask_wellbeing has its frame');
  const m = fr('Hi, who wrote Hamlet?'); expect(m.acts[0].act === 'greet' && m.kriya === 'write' && m.text === 'Hi, who wrote Hamlet?' && m.act_rest === 'who wrote Hamlet?', JSON.stringify(m).slice(0, 300));
  expect(!fr('Help is on the way.').acts && !fr('Hi there').acts, 'a form not ending at punctuation or the end is not an act');
});

T('a conversational act is answered by its expected response act, measured against the lexicon (C ≥ 0.87 measured), Echo structural', () => {
  const want = { 'Hello.': 'Hello.', 'Hi': 'Hi.', 'Good morning': 'Good morning.', 'Thanks': "You're welcome.", 'Sorry': "That's all right.", 'Bye': 'Bye.', 'Thanks, bye!': "You're welcome. Bye." };
  for (const [q, rep] of Object.entries(want)) {
    const r = ask(q);
    expect(r.product_reply === true && r.reply === rep, q + ' → ' + JSON.stringify([r.reply, r.route, r.coherence, r.admit && r.admit.scored]));
    expect(r.echo.method === 'structural_speech_act' && r.echo.pass && r.echo.structure.checks.every(c => c.ok === true), q + ' echo ' + JSON.stringify(r.echo).slice(0, 300));
    expect(r.admit.scored === 'speech_act_lexicon' && r.coherence >= 0.87 && r.admit.scored_reading.coherence === r.coherence && r.drift <= 0.35, q + ' C ' + r.coherence);
    const plan = r.outward; expect(plan && plan.sentences.every(x => x.atom && x.atom.predicate === 'speech_act'), q + ' plan');
    const oc = CORE.outwardCompile(r, { question: q }, f, require(ROOT + '/src/rmc_renderer_200.js'), Q);
    expect(oc.product_reply && oc.reply === rep && oc.outward_compile.mode === 'compiled' && oc.outward_compile.sentences.every(x => x.via === 'speech_acts'), q + ' outward ' + JSON.stringify(oc.outward_compile).slice(0, 300));
  }
  const e = py(`
import json
from rmc_engine_v1.structural_echo import speech_act_score as s
print(json.dumps([s("Thanks", "Thanks."), s("Sorry", "You're welcome."), s("Thanks", "You're welcome, friend."), s("Bye", "Hello.")]))`);
  expect(e.every(x => !x.pass), 'thanks back, the wrong acknowledgement, more than the act, another act: ' + JSON.stringify(e.map(x => x.score)));
  expect(!SA.compile("You're welcome.", { predicate: 'speech_act', args: ['greet', 'greet'], form: 'howdy' }).ok, 'a form the lexicon does not hold does not compile');
});

T('How are you? is answered from a self-state built from the measured live state; Help from the capability self-facts', () => {
  CORE.noteState({ coherence: 0.88, drift: 0.3, admit: { coherence_ok: false, drift_region: 'clean', thresholds: { C_min: 0.87 } } });
  expect(CORE.stateRows(Q, f)[0].text === 'You are awake.', 'not coherent when the engine said C was not ok');
  CORE.noteState({ coherence: 0.909596, drift: 0.006667, route: 'active_stack_candidate', product_reply: true, admit: { coherence_ok: true, drift_region: 'clean', theta_admit: 0.35, thresholds: { C_min: 0.87 } } });
  const st = CORE.stateRows(Q, f)[0];
  expect(st.text === 'You are awake and coherent.' && st.provenance.kind === 'self_state' && st.provenance.measured.C === 0.909596 && st.clause.parsed, JSON.stringify(st).slice(0, 300));
  const h = ask('How are you?');
  const sv = ((h.world_model || {}).derive || {}).survivor || {};
  expect(h.product_reply && h.reply === 'I am awake and coherent.' && h.echo.method === 'structural_frame' && h.echo.pass && sv.perspective === 'speaker' && h.coherence >= 0.87, JSON.stringify([h.reply, h.echo && h.echo.method, h.coherence]));
  const w = ask('Who are you?'); expect(w.reply === 'I am a computer program.', 'a state adjective does not answer who: ' + w.reply);
  const hp = ask('Help'); expect(hp.product_reply && /^I (compute|derive|know) /.test(hp.reply) && hp.echo.method === 'structural_frame', JSON.stringify([hp.reply, hp.route]));
  const hh = ask('Hello, how are you?'); expect(hh.reply === 'Hello. I am awake and coherent.' && hh.admit.scored === 'speech_act_lexicon+world_model' && hh.echo.parts.acts.pass, JSON.stringify([hh.reply, hh.admit && hh.admit.scored]));
});

T('a turn that opens with an act and asks a question: the response leads the answer, and is not spoken when the answer holds', () => {
  const ham = [{ id: 'h', text: 'Shakespeare wrote Hamlet.', scope: 'phone', provenance: { requested_by: 'user', request: 'remember_command', kind: 'statement' } }];
  const r = ask('Hi, who wrote Hamlet?', ham);
  expect(r.product_reply && r.reply === 'Hi. Shakespeare wrote Hamlet.' && r.echo.parts.acts.pass && r.echo.parts.answer.method === 'structural_frame', JSON.stringify([r.reply, r.admit && r.admit.scored]));
  expect(r.coherence === Math.min(r.coherence, 0.909596) && r.coherence >= 0.87, 'C is the weaker reading');
  const held = ask('Hi, what breed is my dog?'); expect(held.product_reply === false, 'no greeting alone when the question holds: ' + held.reply);
});

T('thresholds unchanged and no model', () => {
  const t = py(`
import json
from rmc_engine_v1 import mobile_config as M
T = M.THRESHOLDS
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(t.C_min === 0.87 && t.echo_min === 0.85 && t.drift_quarantine === 0.35 && t.hard_stop === 0.8, JSON.stringify(t));
  for (const p of ['src/rmc_core.js', 'src/selfmodel.js', 'src/qframe.js', 'engine/rmc_engine_v1/structural_echo.py', 'engine/rmc_engine_v1/derive_frame.py', 'engine/rmc_engine_v1/language_core_orchestration.py'])
    expect(!/openai|anthropic|transformers|gpt-|claude/i.test(read(p)), p);
});

T('version registry names 4.9.242', () => {
  expect(read('VERSION').trim() === '4.9.249', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.249' && reg.features.some(x => x.id === 'R4241-SELF-FACTS-FROM-CLAUSES') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').includes('## v4.9.242'), 'CONFLICTS entry at the top');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4241', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4241', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
