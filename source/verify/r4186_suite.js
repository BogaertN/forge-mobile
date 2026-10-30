/* R4186 (4.9.186): memory-writer insert, Gilligan anchor, multi-hop derive.
 * C_min stays 0.87. The coherence formula is unchanged. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const Core = require(ROOT + '/src/rmc_core.js');
const Next = require(ROOT + '/src/next_layer.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };

function py(code) {
  return cp.execFileSync('python3', ['-c', code], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
}

T('recall and the anchor do not parse with a regex or token overlap', () => {
  for (const name of ['resonance_recall.py', 'gilligan_anchor.py']) {
    const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', name), 'utf8');
    expect(!/import re\b/.test(src) && !/re\.(findall|search|match|sub|split)/.test(src), name + ' regex');
    expect(!/_tokens|jaccard|semantic_overlap|token overlap/.test(src), name + ' token overlap');
  }
  const out = py(`
import json
from rmc_engine_v1.resonance_recall import rank_memory
nodes = [
  {"memory_id":"sun","content":"The sun is hot. Its surface is about 5500 degrees Celsius.","confidence":"medium_high","prior_drift_score":0,"phase_tags":["Φ1"]},
  {"memory_id":"decoy","content":"Hot sun surface degrees celsius celsius celsius about about.","confidence":"medium_high","prior_drift_score":0,"phase_tags":["Φ1"]}
]
row = rank_memory("How hot is the sun?", nodes, {"phase_primary":"Φ1"})
print(json.dumps({"how": row["how"], "id": row["active"][0]["memory_id"], "overlap": row["uses_token_overlap"]}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.how === 'frame_role' && row.id === 'sun' && row.overlap === false, JSON.stringify(row));
});

T('anon cannot insert an unadmitted contribution', () => {
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261029201023_memory_writer_admitted_insert.sql'), 'utf8');
  expect(/revoke insert, update, delete on kb\.contributions from public, anon, authenticated/.test(sql), 'table grants');
  expect(!/grant insert on kb\.contributions/i.test(sql), 'no insert grant');
  expect(/revoke all on function public\.memory_writer_insert[\s\S]*from public, anon/.test(sql), 'anon execute revoked');
  expect(/grant execute on function public\.memory_writer_insert[\s\S]*to authenticated/.test(sql), 'authenticated execute');
  expect(/KB-WRITER-ANON-REFUSED/.test(sql) && /KB-WRITER-UNADMITTED/.test(sql), 'refusals');
  expect(/contributions_admitted_packet/.test(sql) && /state <> 'admitted'/.test(sql), 'admitted shape');
  expect(/Phi/.test(sql) && /provenance/.test(sql) && /contributor/.test(sql), 'packet and credit');
  expect(/security definer/.test(sql) && /set search_path = ''/.test(sql), 'definer search_path');
  expect(!/grant insert \(/.test(sql), 'column insert not restored');
});

T('Gilligan anchors inside the drift bands and does not skip the admit gate', () => {
  const out = py(`
import json
import rmc_engine_v1.gilligan_anchor as g
from rmc_engine_v1.rmc_core import run
bare = run({"question":"What is quartz?","live":True,"memory":{"research":[{"id":"web","text":"Quartz is a hard crystalline mineral made of silicon dioxide."}]}})
cur = bare["quarantine_curation"][0]
linked = run({"question":"What is helium?","live":True,"memory":{
  "hosted":[{"id":"h","text":"Helium is a light noble gas."}],
  "research":[{"id":"web","text":"Helium is a chemical element and a noble gas.","quarantined":True}]
}})
place = linked["quarantine_curation"][0]
def at(eps):
    g._drift_for = lambda *a, **k: {"epsilon_s": eps, "disposition": "measured", "chi": {"status": "recorded"}}
    return g.connect_quarantine("What is quartz?", {"id":"w","text":"Quartz is a rock."}, [{"id":"q","text":"Quartz is a mineral."}])
hard = at(0.91)
chi = at(0.37)
keep = at(0.55)
print(json.dumps({
  "bare": {"rule": cur["rule"], "writes": cur["writes"], "text": bare["world_model"]["derived_text"], "admitted": bare["world_model"]["observe"]["admitted"], "reply": bare["product_reply"]},
  "place": {"rule": place["rule"], "writes": place["writes"], "eligible": place["gate_eligible"], "ping": place["christping_initiated"], "owner": place["christping_owner"], "ask": place["ask_initiated"], "c": linked["coherence"], "reply": linked["product_reply"], "formula": linked["coherence_components"]["formula"]},
  "hard": {"rule": hard["rule"], "ping": hard["christping_initiated"], "owner": hard["christping_owner"], "ask": hard["ask_initiated"], "writes": hard["writes"], "eligible": hard["gate_eligible"]},
  "chi": {"rule": chi["rule"], "ping": chi["christping_initiated"], "eligible": chi["gate_eligible"]},
  "keep": {"rule": keep["rule"], "eligible": keep["gate_eligible"], "writes": keep["writes"]},
  "bands": {"p": g.band_for(0.35), "c": g.band_for(0.36), "q": g.band_for(0.40), "h": g.band_for(0.81)}
}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.bare.rule === 'DREAM-QUARANTINE-NO-TRUTH' && row.bare.writes === false && row.bare.text === '' && row.bare.admitted === 0 && row.bare.reply === false, JSON.stringify(row.bare));
  expect(row.place.rule === 'ATHENA-RESONANCE-PLACE' && row.place.writes === false && row.place.eligible === true && row.place.ping === false && row.place.owner === 'gilligan' && row.place.ask === false, JSON.stringify(row.place));
  expect(row.place.reply === true && row.place.c >= 0.87 && row.place.formula.indexOf('0.24*memory_fit') === 0, JSON.stringify(row.place));
  expect(row.hard.rule === 'GILLIGAN-HARD-STOP' && row.hard.ping === true && row.hard.owner === 'gilligan' && row.hard.ask === false && row.hard.writes === false && row.hard.eligible === false, JSON.stringify(row.hard));
  expect(row.chi.rule === 'GILLIGAN-CHI' && row.chi.ping === false && row.chi.eligible === false, JSON.stringify(row.chi));
  expect(row.keep.rule === 'DREAM-QUARANTINE-KEEP' && row.keep.writes === false && row.keep.eligible === false, JSON.stringify(row.keep));
  expect(row.bands.p === 'projectable' && row.bands.c === 'chi' && row.bands.q === 'quarantine' && row.bands.h === 'hard_stop', JSON.stringify(row.bands));
});

T('multi-hop derive records provenance and drift on every hop', () => {
  const row = Core.runSync({
    question: 'What is quartz?',
    live: true,
    memory: { hosted: [{ id: 'q', text: 'Quartz is a mineral.' }, { id: 'm', text: 'A mineral is a solid substance.' }, { id: 's', text: 'A solid substance is matter.' }] }
  });
  const survivor = row.world_model.derive.survivor;
  expect(row.calls_llm === false && row.world_model.christping_initiated === false, 'llm');
  expect(survivor && survivor.how === 'WM-COPULA-CHAIN', JSON.stringify(survivor && survivor.how));
  expect(survivor.hops.length >= 3, JSON.stringify(survivor.hops.map(h => h.text)));
  expect(survivor.hops.every(h => Array.isArray(h.provenance) && h.provenance.length && h.drift && typeof h.drift.epsilon_s === 'number' && h.chi && h.chi.christping_initiated === false), JSON.stringify(survivor.hops));
  expect(row.world_model.derived_text.indexOf('Quartz is matter.') >= 0 || row.world_model.derived_text.indexOf('Quartz is a solid substance.') >= 0, row.world_model.derived_text);
  expect(row.world_model.derived_text.split('. ').length >= 2, row.world_model.derived_text);
  expect(row.coherence < 0.87 && row.product_reply === false, 'C ' + row.coherence);
  expect(row.admit.thresholds.C_min === 0.87 && row.echo.min === 0.85, 'thresholds');
});

T('the memory writer reports a hosted insert only after readback', () => {
  const out = py(`
import json
from rmc_engine_v1.memory_writer_hosted import commit_hosted
row = {"text":"Helium is a light noble gas.","sfe":{"Phi":9,"eps":0.14,"mu":1},"provenance":{"question":"What is helium?","contributor":"athena","premises":["h"]},"contributor":"athena"}
pending = commit_hosted(row)
def ok_transport(call):
    sent = call["row"]["p_payload"]
    return {"ok": True, "inserted": True, "row": {"id":"row-1","state":"admitted","inserted":True,"verified":True,"payload":sent}}
good = commit_hosted(row, transport=ok_transport)
def bad_transport(call):
    return {"ok": True, "inserted": True, "row": {"id":"row-2","state":"quarantined","payload":{"text":"no","state":"quarantined"}}}
bad = commit_hosted(row, transport=bad_transport)
print(json.dumps({"pending": pending["rule"], "pw": pending["written"], "pv": pending["verified"], "good": good["rule"], "gw": good["written"], "gv": good["verified"], "gid": good.get("id"), "bad": bad["rule"], "bw": bad["written"], "bv": bad["verified"]}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.pending === 'KB-WRITER-CREDENTIALS-PENDING' && row.pw === false && row.pv === false, JSON.stringify(row));
  expect(row.good === 'KB-WRITER-VERIFIED' && row.gw === true && row.gv === true && row.gid === 'row-1', JSON.stringify(row));
  expect(row.bad === 'KB-WRITER-READBACK-FAILED' && row.bw === false && row.bv === false, JSON.stringify(row));
});

T('version registry names 4.9.186 and the switches stay off', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.194', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.186/.test(conf) && /Gilligan/.test(conf) && /C_min stays 0\.87/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.186/.test(nb) && /4\.9\.187/.test(nb) && /WIRING_186/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.186/.test(readme) && /WIRING_186/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_186.md'), 'utf8');
  expect(/Gilligan/.test(doc) && /Athena/.test(doc) && /0\.35/.test(doc) && /0\.87/.test(doc) && /multi-hop/.test(doc), 'WIRING');
  const live = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_186.md'), 'utf8');
  expect(/60/.test(live) && /cold/.test(live) && /pass/.test(live), 'LIVE');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.194' && (tgt.suites[0] === 'r4194_suite.js' || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.194' && reg.features.some(f => f.id === 'R4186-ANCHOR-HOP') && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4186', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4186', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
