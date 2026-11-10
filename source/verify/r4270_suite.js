/* Athena gap fill: one pipeline. A fixture stands in for the publishers. Nothing is written. */
const { spawnSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
function py(code, input) {
  const r = spawnSync('python3', ['-c', code], { cwd: ROOT, encoding: 'utf8', input: input || '', env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }) });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'python').slice(-500));
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
const RUN = `
import json, sys
from rmc_engine_v1.athena_props import fill_gap, tick_gaps
from rmc_engine_v1.sim_device import plan
from rmc_engine_v1.rmc_core import run
req = json.load(sys.stdin)
calls = []
pub_f = req.get("pub_formula") or "C10H16"
che_f = req.get("che_formula") or "C10H16"
def http(url):
    calls.append(url)
    if "pubchem" in url:
        return json.dumps({"PropertyTable": {"Properties": [{"CID": 22311, "MolecularFormula": pub_f, "MolecularWeight": 136.23, "InChIKey": "XMGQYMWWDOXHJM-JTQLQIEISA-N", "IsomericSMILES": "CC1=CCC(CC1)C(=C)C"}]}})
    if "search?" in url:
        return json.dumps({"response": {"docs": [{"obo_id": "CHEBI:15384", "label": "limonene"}]}})
    return json.dumps({"_embedded": {"terms": [{"obo_id": "CHEBI:15384", "annotation": {"generalized_empirical_formula": [che_f], "mass": ["136.23"], "inchi_key_string": ["XMGQYMWWDOXHJM-JTQLQIEISA-N"], "smiles_string": ["CC1=CCC(CC1)C(=C)C"]}}]}})
if req.get("mode") == "agree":
    frame = {"schema": "forge.qframe/v1", "text": "What is the formula of limonene?", "wh": "what", "wh_role": "pred", "kriya": "be", "polarity": "pos", "parsed": True, "kartr": {"head": "formula", "text": "the formula of limonene", "det": "the", "of": {"head": "limonene", "text": "limonene"}}, "pred": {"type": "np", "text": "something", "head": "something", "indef": True}}
    gap = {"question": frame["text"], "qframe": frame, "sim": {"reason": "unknown_substance", "substance": "limonene"}}
    found = fill_gap(gap, http)
    again = plan(gap["question"], frame, found.get("proposals"))
    prop = (found.get("proposals") or [{}])[0]
    fact = {"id": "athena:limonene:formula", "text": "the formula of limonene is " + str(prop.get("value")), "clause": prop.get("frame")}
    spoken = run({"question": gap["question"], "live": True, "frame": frame, "memory": {"hosted": [fact], "phone": [], "anchors": [], "research": [], "receipts": []}})
    gate = ((spoken.get("memory_write") or {}).get("write_gate") or {})
    print(json.dumps({"rule": found.get("rule"), "value": prop.get("value"), "k": prop.get("k"), "gilligan": prop.get("gilligan"), "phone": found.get("phone_remember"), "write": found.get("supabase_write"), "llm": found.get("calls_llm"), "resumed": again.get("ok"), "formula": again.get("formula"), "calls": len(calls), "spoken": spoken.get("product_reply") is True and prop.get("value") in str(spoken.get("reply") or ""), "echo": (spoken.get("echo") or {}).get("pass"), "C": spoken.get("coherence"), "region": (spoken.get("admit") or {}).get("drift_region"), "gate": gate.get("ok"), "named": gate.get("named"), "eps": (gate.get("drift") or {}).get("eps"), "failed": gate.get("failed")}))
elif req.get("mode") == "disagree":
    found = fill_gap({"question": "What is the formula of limonene?", "sim": {"reason": "unknown_substance", "substance": "limonene"}}, http)
    print(json.dumps({"rule": found.get("rule"), "n": len(found.get("proposals") or [])}))
elif req.get("mode") == "personal":
    found = fill_gap({"question": "what is the formula of my sample", "sim": {"reason": "unknown_substance", "substance": "sample"}}, http)
    print(json.dumps({"rule": found.get("rule"), "calls": len(calls)}))
elif req.get("mode") == "sim":
    q = "What happens if you push a 4 kilogram lectern 0.8 meters high and 0.4 meters wide and 0.3 meters deep near the top?"
    frame = {"schema": "forge.qframe/v1", "conditional": True, "cond": {"parsed": True, "kriya": "push", "voice": "active", "karma": {"head": "lectern", "text": "a lectern"}, "stated": [{"num": "4", "unit": "kilogram", "dim": "mass"}, {"num": "0.8", "unit": "meters", "dim": "high"}, {"num": "0.4", "unit": "meters", "dim": "wide"}, {"num": "0.3", "unit": "meters", "dim": "deep"}], "adj": [{"prep": "near", "np": {"head": "top", "text": "the top"}}]}}
    found = fill_gap({"question": q, "qframe": frame})
    print(json.dumps({"rule": found.get("rule"), "method": found.get("method"), "outcome": found.get("outcome"), "calls": len(calls)}))
elif req.get("mode") == "dedup":
    gap = {"question": "What is the formula of limonene?", "sim": {"reason": "unknown_substance", "substance": "limonene"}}
    t1 = tick_gaps([gap, dict(gap)], now=0, http=http)
    t2 = tick_gaps([gap], now=0, http=http, ledger=t1.get("ledger"))
    print(json.dumps({"rules": [x.get("rule") for x in t1["log"]], "second": t2["log"][0]["rule"], "calls": len(calls), "trusted": sorted((t1.get("ledger") or {}).get("sources") or {})}))
`;
function register(C, expect) {
  C('ATHENA', 'two publishers propose the formula and the same question resumes', () => {
    const row = py(RUN, JSON.stringify({ mode: 'agree' }));
    expect(row.rule === 'ATHENA-PROPOSED' && row.value === 'C10H16' && row.k === 2 && row.gilligan === 'GILLIGAN-STRUCTURE-OK' && row.phone === false && row.write === false && row.llm === false && row.resumed === true && row.formula === 'C10H16' && row.spoken === true && row.echo === true && row.C >= 0.87 && row.region === 'clean' && row.gate === true && row.named && row.named.length > 0 && row.eps <= 0.35 && !(row.failed || []).length, JSON.stringify(row));
  });
  C('ATHENA', 'a disagreement is not given a value', () => {
    const row = py(RUN, JSON.stringify({ mode: 'disagree', pub_formula: 'C10H16', che_formula: 'C9H16' }));
    expect(row.rule === 'ATHENA-DISAGREEMENT' && row.n === 0, JSON.stringify(row));
  });
  C('ATHENA', 'a personal question is not looked up', () => {
    const row = py(RUN, JSON.stringify({ mode: 'personal' }));
    expect(row.rule === 'ATHENA-PERSONAL' && row.calls === 0, JSON.stringify(row));
  });
  C('ATHENA', 'a fully measured unknown object is simulated, not invented from a table', () => {
    const row = py(RUN, JSON.stringify({ mode: 'sim' }));
    expect(row.rule === 'ATHENA-SIMULATED' && row.method === 'simulate' && (row.outcome === 'topple' || row.outcome === 'slide' || row.outcome === 'stay') && row.calls === 0, JSON.stringify(row));
  });
  C('ATHENA', 'Neo pauses for Ask, dedupes a repeated gap, and logs a backoff', async () => {
    const Neo = require('../src/neo.js');
    const queued = [];
    let calls = 0;
    const n = Neo.create({
      curators: () => ({
        noteHeld: q => { if (queued.indexOf(q) >= 0) return { ok: false, rule: 'CURATE-GAP-KNOWN' }; queued.push(q); return { ok: true, rule: 'CURATE-GAP-QUEUED' }; },
        tick: async () => { calls += 1; return { rule: 'ATHENA-BACKOFF', to: 'queue', rec: { question: 'What is the formula of limonene?' } }; }
      })
    });
    const first = n.noteHeld('What is the formula of limonene?');
    const again = n.noteHeld('What is the formula of limonene?');
    n.setAnswering(true);
    const paused = await n.tick();
    n.setAnswering(false);
    const ticked = await n.tick();
    const rules = n.log().map(x => x.rule);
    expect(first.ok === true && again.rule === 'CURATE-GAP-KNOWN' && paused.rule === 'NEO-PAUSED' && calls === 1 && ticked.scheduler === 'neo' && ticked.rule === 'ATHENA-BACKOFF' && rules.indexOf('NEO-DEDUPED') >= 0 && rules.indexOf('NEO-PAUSED') >= 0 && rules.indexOf('NEO-RESUMED') >= 0 && rules.indexOf('NEO-BACKOFF') >= 0, JSON.stringify({ first, again, paused, ticked, rules, calls }));
  });
  C('ATHENA', 'one tick dedupes and the next tick backs off', () => {
    const row = py(RUN, JSON.stringify({ mode: 'dedup' }));
    expect(row.rules[0] === 'ATHENA-PROPOSED' && row.rules[1] === 'ATHENA-DEDUPED' && row.second === 'ATHENA-BACKOFF' && row.calls === 3 && row.trusted.indexOf('pubchem') >= 0 && row.trusted.indexOf('chebi') >= 0, JSON.stringify(row));
  });
}
module.exports = register;
if (require.main === module) {
  const jobs = [];
  register((cls, name, fn) => { jobs.push({ cls, name, fn }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  (async () => {
    const results = [];
    for (const j of jobs) {
      let ok = false, why = '';
      try { await j.fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); }
      results.push({ cls: j.cls, name: j.name, ok, why });
    }
    console.log(JSON.stringify(results, null, 1));
    if (results.some(r => !r.ok)) process.exit(1);
  })();
}
