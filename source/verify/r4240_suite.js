/* R4240 (4.9.240, plan 229): the converse false accept and four paraphrase parse misses, fixed in the grammar, not per question.
 * (1) A yes/no copula question reads a fact backwards only when the fact is an identity between two referring phrases
 *     ("Rex is my dog"); kind and membership ("a whale is a living thing") never run backwards. Structural Echo checks each
 *     question role at the position it fills and fails a swapped reading that is not an identity.
 * (2) Canonical frames (src/qframe.js): agent-of ("the author of X" = "who writes X"), genitive of-phrase = possessive,
 *     whose = owner, bare plural generic = singular kind. Phase stays a tie-breaker only (Nic, 4.9.239).
 * The proof is the Ask run in headless Chrome (/workspace/step240, CONFLICTS.md v4.9.240). */
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
const PY = process.env.PYTHON || 'python3';
const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
const f = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-05T12:00:00Z' });
const py = (code, input) => {
  const r = cp.spawnSync(PY, ['-c', code], { cwd: ROOT, input: JSON.stringify(input || {}), env, encoding: 'utf8', maxBuffer: 1 << 28 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};
const strip = n => n && typeof n === 'object' ? { text: n.text, head: n.head, owner: n.owner && typeof n.owner === 'object' ? strip(n.owner) : n.owner || null, det: n.det || null, indef: !!n.indef, propn: n.propn || null, adjs: n.adjs || null } : n || null;
const core = fr => JSON.stringify({ kriya: fr.kriya, wh_role: fr.wh_role, speech_act: fr.speech_act, polarity: fr.polarity, kartr: strip(fr.kartr), karma: strip(fr.karma && Object.assign({}, fr.karma, { kind: undefined })), pred: strip(fr.pred) });
const clause = s => Q.clause(s, f);

T('each paraphrase compiles to the frame of its original, through a recorded canonical rule', () => {
  for (const [a, b, rule] of [['Who is the author of Hamlet?', 'Who wrote Hamlet?', 'QF-CANON-AGENT-OF'], ['What is the name of my dog?', "What is my dog's name?", 'QF-CANON-GENITIVE'],
    ['Whose dog is Rex?', 'Who owns Rex?', 'QF-CANON-WHOSE'], ['Are whales living things?', 'Is a whale a living thing?', 'QF-CANON-GENERIC-PLURAL']]) {
    const fa = Q.compile(a, f), fb = Q.compile(b, f);
    expect(core(fa) === core(fb), a + '\n' + core(fa) + '\n' + core(fb));
    expect((fa.canonical || []).some(c => c.rule === rule) && !fb.canonical, a + ' canonical ' + JSON.stringify(fa.canonical));
  }
});

T('the rules are general: other agent nouns, other genitives, other plurals; non-agent nouns stay copular', () => {
  const own = Q.compile('Who is the owner of Rex?', f); expect(own.kriya === 'own' && own.wh_role === 'kartr' && own.karma.text === 'Rex', core(own));
  const yn = Q.compile('Is Shakespeare the author of Hamlet?', f); expect(yn.kriya === 'write' && yn.kartr.text === 'Shakespeare' && yn.wh_role === 'polarity', core(yn));
  const cap = Q.compile('What is the capital of France?', f); expect(cap.kriya === 'be' && cap.kartr.head === 'capital' && cap.kartr.owner.text === 'France', core(cap));
  const mam = Q.compile('Are whales mammals?', f); expect(mam.declarative === 'a whale is a mammal', mam.declarative);
  const big = Q.compile('Are the dogs hungry?', f); expect(!big.canonical, 'a definite plural is not a generic');
  const w = Q.compile('Whose cat is Tom?', f); expect(w.kriya === 'own' && w.karma.text === 'Tom' && w.karma.kind === 'cat', core(w));
});

const MATCH = `
import json, sys
from rmc_engine_v1 import derive_frame as DF
d = json.load(sys.stdin)
print(json.dumps([DF.match(q, c) for q, c in d["pairs"]]))`;
T('a yes/no copula reads a fact backwards only for an identity', () => {
  const whale = clause('A whale is a living thing.'), dog = clause('My dog is Rex.');
  const r = py(MATCH, { pairs: [[Q.compile('Is a living thing a whale?', f), whale], [Q.compile('Is a whale a living thing?', f), whale], [Q.compile('Is Rex my dog?', f), dog], [Q.compile('Is my dog Rex?', f), dog]] });
  /* 4.9.241: the converse of a kind inclusion is answered "not necessarily" from the frame (rule polar_converse), never yes */
  expect(r[0] && r[0].rule === 'polar_converse' && r[0].filler === 'not necessarily', 'converse of a kind inclusion: ' + JSON.stringify(r[0]));
  expect(r[1] && r[1].filler === 'yes' && r[1].orientation === 'kartr=kartr', JSON.stringify(r[1]));
  expect(r[2] && r[2].filler === 'yes' && r[2].orientation === 'kartr=pred', 'identity runs backwards: ' + JSON.stringify(r[2]));
  expect(r[3] && r[3].filler === 'yes', JSON.stringify(r[3]));
});

T('structural Echo catches a swap even if a matcher let it through, and passes the identity swap', () => {
  const whale = clause('A whale is a living thing.'), dog = clause('My dog is Rex.');
  const r = py(`
import json, sys
from rmc_engine_v1 import derive_frame as DF, structural_echo as SE
d = json.load(sys.stdin)
real = DF.match
def forced(q, c):  # a matcher that (wrongly) allows every swap, as before 4.9.240
    return {"roles": 2, "gap": None, "filler": "yes", "orientation": "kartr=pred", "rule": "polar"}
out = []
for q, c, force in d["cases"]:
    DF.match = forced if force else real
    claim = {"fact_frame": c, "atom": {"pred": "be", "args": [c["kartr"]["text"], c["pred"]["text"]], "polarity": "pos"}}
    s = SE.score(q, claim, c["text"] + ".")
    out.append({"pass": s and s.get("score", 0) >= 0.85, "score": s and s.get("score"), "fails": [x["check"] for x in ((s or {}).get("structure") or {}).get("checks", []) if not x["ok"]]})
DF.match = real
print(json.dumps(out))`, { cases: [[Q.compile('Is a living thing a whale?', f), whale, true], [Q.compile('Is a living thing a whale?', f), whale, false], [Q.compile('Is Rex my dog?', f), dog, false]] });
  expect(!r[0].pass && r[0].fails.includes('orientation'), 'forced swap: ' + JSON.stringify(r[0]));
  expect(!r[1].pass && r[1].fails.includes('orientation'), 'a converse stated without "not necessarily" fails (4.9.241): ' + JSON.stringify(r[1]));
  expect(r[2].pass, 'identity swap passes: ' + JSON.stringify(r[2]));
});

T('the genitive of-phrase and the possessive meet in the engine both ways', () => {
  const r = py(MATCH, { pairs: [[Q.compile('What is the name of my dog?', f), clause("My dog's name is Rex.")], [Q.compile("What is France's capital?", f), clause('Paris is the capital of France.')],
    [Q.compile('Whose cat is Rex?', f), clause('My dog is Rex.')], [Q.compile('Whose dog is Rex?', f), clause('My dog is Rex.')]] });
  expect(r[0] && r[0].filler === 'Rex', JSON.stringify(r[0]));
  expect(r[1] && r[1].filler === 'Paris', JSON.stringify(r[1]));
  expect(r[2] === null, 'whose cat: Rex is a dog, not a cat');
  expect(r[3] && r[3].rule === 'WM-OWNER-OF', JSON.stringify(r[3]));
});

T('thresholds unchanged, phase still a tie-breaker, no model', () => {
  const t = py(`
import json
from rmc_engine_v1 import mobile_config as M
T = M.THRESHOLDS
print(json.dumps({k: T.get(k) for k in ("C_min", "echo_min", "drift_quarantine", "hard_stop")}))`);
  expect(t.C_min === 0.87 && t.echo_min === 0.85 && t.drift_quarantine === 0.35 && t.hard_stop === 0.8, JSON.stringify(t));
  for (const p of ['src/qframe.js', 'engine/rmc_engine_v1/derive_frame.py', 'engine/rmc_engine_v1/structural_echo.py'])
    expect(!/openai|anthropic|transformers|gpt-|claude/i.test(read(p)), p);
  expect(!/question ===|text === ['"](who|what|whose|are)/i.test(read('src/qframe.js')), 'no question literal');
});

T('version registry names 4.9.240', () => {
  expect(read('VERSION').trim() === '4.9.241', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.241' && reg.features.some(x => x.id === 'R4240-CANONICAL-FRAMES') && reg.count === reg.features.length, 'registry');
  expect(read('CONFLICTS.md').indexOf('## v4.9.240') >= 0 && (read('CONFLICTS.md').slice(0, read('CONFLICTS.md').indexOf('## v4.9.240')).match(/^## v/gm) || []).length <= 1, 'CONFLICTS entry near the top (4.9.241 sits above)');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4240', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4240', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
