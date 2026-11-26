/* 4.9.267: a creative topic gathers every Athena source before it is composed. */
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
function forge() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T00:00:00Z' }); }
function py(code, input) {
  const env = Object.assign({}, process.env, { PYTHONPATH: [path.join(ROOT, 'engine'), ROOT, path.join(ROOT, '_mathlibs')].join(path.delimiter) });
  const proc = cp.spawnSync('python3', ['-c', code], { cwd: ROOT, input: input || '', env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (proc.status !== 0) throw new Error((proc.stderr || 'python').slice(-700));
  return JSON.parse(proc.stdout.trim().split('\n').pop());
}
function ask(q, phone, gathered) {
  const f = forge();
  const frame = Q.compile(q, f);
  const rows = (phone || []).map((t, i) => ({ id: 'p' + i, text: /[.!?]$/.test(t) ? t : t + '.', clause: Q.clause(t, f), source: 'phone_kb', trust: 'trusted' }));
  if (gathered && Array.isArray(gathered.clauses)) {
    gathered.clauses.forEach(c => { try { c.clause = Q.clause(c.text, f); } catch (e) { c.clause = {}; } });
  }
  const payload = CORE.withClauses({ question: q, frame: frame, live: true, memory: { phone: rows, pools: [], creative_clauses: gathered || null } }, Q, f);
  const code = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\nr=run(json.load(sys.stdin))\nc=r.get("creative") or {}\nprint(json.dumps({"reply":r.get("reply"),"route":r.get("route"),"write":(r.get("memory_write") or {}).get("proposed"),"gather":c.get("gather"),"facts":[{"text":f.get("text"),"fact":f.get("fact"),"single":f.get("single_source"),"n":f.get("source_count")} for f in (c.get("facts") or [])]},default=str))';
  return py(code, JSON.stringify(payload));
}
function register(C, expect) {
  C('R4284', 'every enabled source is queried, and two publishers admit', () => {
    const code = `
import json, sys
from rmc_engine_v1.athena_gather import fan_out, gather
from rmc_engine_v1.athena_sources_222 import FetchMiss
def http(url):
    raise FetchMiss(url)
fanned = fan_out(["What is a quagga?"], http=http, timeout=0.2, budget=8)
docs = [
  {"text": "A quagga is a zebra.", "publisher": "Open English WordNet", "source_id": "oewn", "counts": True, "asked": "What is a quagga?"},
  {"text": "A quagga is a zebra.", "publisher": "NLM", "source_id": "nlm_mesh", "counts": True, "asked": "What is a quagga?"},
  {"text": "A quagga has stripes.", "publisher": "Open English WordNet", "source_id": "oewn", "counts": True, "asked": "What is a quagga?"},
  {"text": "A widgeon is a duck.", "publisher": "NASA", "source_id": "nasa_science", "counts": True, "asked": "What is a widgeon?"},
  {"text": "A widgeon is a duck.", "publisher": "NASA", "source_id": "nasa_spaceplace", "counts": True, "asked": "What is a widgeon?"},
  {"text": "A bottle is 5 meters tall.", "publisher": "NASA", "source_id": "nasa_science", "counts": True, "asked": "What is a bottle?"},
  {"text": "A bottle is 5 meters tall.", "publisher": "NIST", "source_id": "nist_codata", "counts": True, "asked": "What is a bottle?"},
  {"text": "A chair is 0.9 meters tall.", "publisher": "NASA", "source_id": "nasa_science", "counts": True, "asked": "What is a chair?"},
  {"text": "A chair is 0.9 meters tall.", "publisher": "NIST", "source_id": "nist_codata", "counts": True, "asked": "What is a chair?"}
]
got = gather("quagga", documents=docs, lexicon=False)
print(json.dumps({"queried": fanned["queried"], "clauses": got["clauses"], "admitted": got["admitted"], "single": got["single"], "atoms": got["atoms"], "supabase": got["supabase_write"]}))
`;
    const row = py(code);
    expect(row.queried.length >= 13 && row.queried.indexOf('oewn') >= 0 && row.queried.indexOf('nlm_mesh') >= 0 && row.queried.indexOf('wikidata') < 0, JSON.stringify(row.queried));
    const by = {};
    row.clauses.forEach(c => { by[c.text] = c; });
    expect(by['A quagga is a zebra.'].admitted === true && by['A quagga is a zebra.'].source_count === 2 && by['A quagga is a zebra.'].fact === true, JSON.stringify(by['A quagga is a zebra.']));
    expect(by['A widgeon is a duck.'].single_source === true && by['A widgeon is a duck.'].fact === false && by['A widgeon is a duck.'].source_count === 1, JSON.stringify(by['A widgeon is a duck.']));
    expect(by['A bottle is 5 meters tall.'].admitted === false && by['A bottle is 5 meters tall.'].scale === 'held', JSON.stringify(by['A bottle is 5 meters tall.']));
    expect(by['A chair is 0.9 meters tall.'].admitted === true && by['A chair is 0.9 meters tall.'].fact === true, JSON.stringify(by['A chair is 0.9 meters tall.']));
    expect(row.supabase === false, 'no hosted write');
  });
  C('R4284', 'a poem uses admitted and single-source clauses and does not store its text', () => {
    const code = `
import json
from rmc_engine_v1.athena_gather import gather
docs = [
  {"text": "A heron is a bird.", "publisher": "Open English WordNet", "source_id": "oewn", "counts": True, "asked": "What is a heron?"},
  {"text": "A heron is a bird.", "publisher": "NLM", "source_id": "nlm_mesh", "counts": True, "asked": "What is a heron?"},
  {"text": "A marsh is a wetland.", "publisher": "CIA", "source_id": "cia_factbook", "counts": True, "asked": "What is a marsh?"}
]
print(json.dumps(gather("heron", documents=docs, lexicon=False)))
`;
    const gathered = py(code);
    const poem = ask('Write a poem about a heron.', [], gathered);
    expect(poem.route === 'creative' && poem.write === false, JSON.stringify(poem));
    expect(/heron/.test(poem.reply || '') && /bird/.test(poem.reply || ''), poem.reply);
    const single = (poem.facts || []).find(f => f.single === true);
    const admitted = (poem.facts || []).find(f => f.fact === true);
    expect(admitted && admitted.n === 2 && single && single.fact === false, JSON.stringify(poem.facts));
    expect(poem.gather && poem.gather.admitted >= 1 && poem.gather.single >= 1 && poem.gather.creative_persisted === false, JSON.stringify(poem.gather));
  });
  C('R4284', 'a story speaks every gathered clause, admitted and single-source', () => {
    const gathered = {
      topic: 'badger', admitted: 1, single: 3, queried: ['oewn', 'wikipedia'], creative_persisted: false,
      clauses: [
        { text: 'A badger is a mammal.', admitted: true, fact: true, single_source: false, source_count: 2, publishers: ['oewn', 'wikimedia'] },
        { text: 'A badger burrows.', admitted: false, fact: false, single_source: true, source_count: 1, publishers: ['oewn'] },
        { text: 'A badger has strong claws.', admitted: false, fact: false, single_source: true, source_count: 1, publishers: ['oewn'] },
        { text: 'A badger is carnivorous.', admitted: false, fact: false, single_source: true, source_count: 1, publishers: ['oewn'] }
      ]
    };
    const story = ask('Tell a story about a badger.', [], gathered);
    expect(story.route === 'creative' && story.write === false, JSON.stringify(story));
    expect(/mammal/.test(story.reply || '') && /burrow/.test(story.reply || '') && /claw/.test(story.reply || '') && /carnivorous/.test(story.reply || ''), story.reply);
  });
  C('R4284', 'a gloss becomes separate clauses and a later sense wins when a source uses its words', () => {
    const f = forge();
    const lines = Q.glossClauses('badger', 'sturdy carnivorous burrowing mammal with strong claws', f);
    expect(lines.indexOf('A badger is a mammal.') >= 0 && lines.indexOf('A badger burrows.') >= 0 && lines.indexOf('A badger has strong claws.') >= 0 && lines.indexOf('A badger is carnivorous.') >= 0, JSON.stringify(lines));
    const code = `
import json
from rmc_engine_v1.athena_gather import choose_sense
print(json.dumps({
  "lute": choose_sense("lute", "Write a poem about a lute.", ["A lute is a plucked string instrument with a pear-shaped body."]),
  "bare": choose_sense("lute", "Write a poem about a lute.", []),
  "badger": choose_sense("badger", "Tell a story about a badger.", ["Badgers are mammals with strong claws."])
}))
`;
    const row = py(code);
    expect(/plucked|instrument|pear/.test(row.lute.gloss) && row.lute.lexname === 'noun.artifact', JSON.stringify(row.lute));
    expect(row.badger.lexname === 'noun.animal', JSON.stringify(row.badger));
    expect(row.bare.gloss !== row.lute.gloss, 'sources moved the sense');
  });
  C('R4284', 'lexicon atoms name a kind, a part, and a behavior', () => {
    const code = 'import json\nfrom rmc_engine_v1.athena_gather import topic_atoms\nprint(json.dumps({"heron": topic_atoms("heron"), "cask": topic_atoms("cask"), "badger": topic_atoms("badger")}))';
    const row = py(code);
    const roles = (row.heron || []).map(a => a.role);
    expect(roles.indexOf('relation') >= 0 && roles.indexOf('part') >= 0 && roles.indexOf('behavior') >= 0, JSON.stringify(row.heron));
    expect((row.cask || []).some(a => a.head === 'vessel'), JSON.stringify(row.cask));
    expect((row.badger || []).some(a => a.head === 'mammal' || a.head === 'carnivore'), JSON.stringify(row.badger));
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 700); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
