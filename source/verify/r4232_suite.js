/* R4232 (4.9.232, Nic plan 229 step 4, pt258u): world-model facts from clauses. Observe builds each fact's atom from the
 * kāraka clause the phone parsed (copula be → is(kartṛ, pred); a verb with a karma → lemma(kartṛ, karma)), and falls back to
 * the old regex reading only when there is no clause or the clause dropped words of the sentence. Every world fact carries
 * its placement: meaning id, phase Φ1-9, Codex band, symbolic Hz, 144/432/1296 group (Nic 9:27); a derived fact carries its
 * premises' phases. These checks guard the wiring; the proof is the live Ask run (CONFLICTS.md v4.9.232). */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const LEX = require(ROOT + '/data/lexicon.json'), EXT = require(ROOT + '/data/lexicon-ext.json');
const CLOCK = () => '2026-11-05T10:00:00Z';
const kernel = () => { const K = require(ROOT + '/src/kernel.js'), F = require(ROOT + '/src/forge.js'); return F.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: CLOCK }); };
const clauses = texts => { const Q = require(ROOT + '/src/qframe.js'), f = kernel(); return texts.map(t => Q.clause(t, f)); };
const py = (code, input) => {
  const r = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, input: JSON.stringify(input), env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }), encoding: 'utf8', maxBuffer: 1 << 26 });
  expect(r.status === 0, r.stderr.slice(-800));
  return JSON.parse(r.stdout.trim().split('\n').pop());
};

T('a clause becomes the atom: copula, negated copula, transitive verb; a parse that dropped words falls back', () => {
  const texts = ['Paris is the capital of France.', 'Oxygen is not a metal.', 'Shakespeare wrote Hamlet.', 'Water is made of hydrogen and oxygen.'];
  const out = py(`
import json, sys
from rmc_engine_v1.world_model_v1 import atom_from_clause
rows = json.load(sys.stdin)
print(json.dumps([list(atom_from_clause(r["t"], r["c"])) for r in rows]))`, texts.map((t, i) => ({ t, c: clauses([t])[0] })));
  const [paris, ox, ham, water] = out;
  expect(paris[1] === 'clause' && paris[0].atom.predicate === 'is' && paris[0].atom.args[0] === 'Paris' && /capital of France/.test(paris[0].atom.args[1]) && paris[0].frame.pred.of.text === 'France', JSON.stringify(paris));
  expect(ox[1] === 'clause' && ox[0].atom.polarity === 'neg' && ox[0].atom.args[1] === 'a metal', JSON.stringify(ox));
  expect(ham[1] === 'clause' && ham[0].atom.predicate === 'write' && /hamlet/i.test(ham[0].atom.args[1]), JSON.stringify(ham));
  expect(water[0] === null && /^clause_incomplete/.test(water[1]) && /hydrogen/.test(water[1]), JSON.stringify(water));
});

T('with the regex switched off, three clause facts alone carry a checked two-hop copula chain', () => {
  const text = 'A whale is a mammal. A mammal is an animal. An animal is a living thing.';
  const out = py(`
import json, sys
from rmc_engine_v1 import world_model_v1 as W
c = json.load(sys.stdin)
ev = [{"id": "r1", "text": c["text"], "clause": c["clause"], "place": W.place_row({}, c["text"], False)}]
base, _ = W.seed_self_facts(W.empty_world())
world, tr = W.observe(base, ev, regex_fallback=False)
bare, tr0 = W.observe(base, [{"id": "r2", "text": c["text"]}], regex_fallback=False)
d = W.derive(world, "Is a whale a living thing?", ["Φ1"])
facts = [f for f in world["facts"] if not f.get("self_fact")]
print(json.dumps({"tr": tr["atom_sources"], "tr0": tr0["atom_sources"], "bare": len([f for f in bare["facts"] if not f.get("self_fact")]),
  "facts": [{k: f.get(k) for k in ("atom", "atom_source", "meaning_id", "phase", "band", "hz", "group", "frame")} for f in facts],
  "claims": [{"how": x["how"], "text": x["text"], "ok": x["checker_ok"]} for x in d["claims"]]}))`, { text, clause: clauses([text])[0] });
  expect(out.tr.clause === 3 && out.tr.regex === 0 && out.facts.length === 3, JSON.stringify(out.tr));
  expect(out.bare === 0 && out.tr0.skipped_no_clause === 3, 'no clause, no regex, no fact: ' + JSON.stringify(out.tr0));
  for (const f of out.facts) expect(f.atom_source === 'clause' && f.frame && f.phase >= 1 && f.phase <= 9 && f.band && f.hz > 0 && [144, 432, 1296].includes(f.group), JSON.stringify(f));
  const two = out.claims.find(c => c.how === 'WM-COPULA-CHAIN' && /^a whale is a living thing\.$/i.test(c.text));
  expect(two && two.ok, JSON.stringify(out.claims));
});

T('the turn records where each fact came from and every fact carries its placement', () => {
  const texts = ['Paris is the capital of France.', 'Water is made of hydrogen and oxygen.'];
  const cs = clauses(texts);
  const out = py(`
import json, sys
from rmc_engine_v1.rmc_core import run
rows = json.load(sys.stdin)
mem = {"phone": [{"id": "p%d" % i, "text": r["t"], "clause": r["c"]} for i, r in enumerate(rows)]}
r = run({"question": "What is the capital of France?", "live": True, "dry_run": False, "memory": mem})
print(json.dumps(r["memory_clauses"]))`, texts.map((t, i) => ({ t, c: cs[i] })));
  const use = (out.uses || []).find(u => u.consumer === 'world_model.observe_atoms');
  expect(use && use.atom_sources && use.atom_sources.clause >= 1 && use.atom_sources.regex + use.atom_sources.stated >= 1, JSON.stringify(out.uses));
  expect(use.clause_fallback_reasons && use.clause_fallback_reasons.clause_incomplete >= 1, JSON.stringify(use));
  expect(use.with_phase === use.facts && use.facts >= 2, JSON.stringify(use));
  const src = read('engine/rmc_engine_v1/world_model_v1.py');
  expect(/"placed_by"\] = "derive_premises"/.test(src) && /premise_phases/.test(src), 'derived facts carry premise phases');
  expect(!/\b(llm|openai|anthropic|transformers)\b/i.test(src.replace(/calls_llm|LLM/g, '')), 'no model');
});

T('version registry names 4.9.232', () => {
  expect(read('VERSION').trim() === '4.9.243', 'VERSION');
  const reg = JSON.parse(read('data/feature_registry.json'));
  expect(reg.version === '4.9.243' && reg.features.some(f => f.id === 'R4232-CLAUSE-FACTS') && reg.count === reg.features.length, 'registry');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4232', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4232', name: t.name, ok: false, why: String(e.message || e).slice(0, 500) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
