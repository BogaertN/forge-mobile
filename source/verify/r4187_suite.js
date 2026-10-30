/* R4187 (4.9.187): stand-ins removed from Ask, trusted anchors, Wikipedia is low trust.
 * C_min stays 0.87. The coherence formula is unchanged. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const zlib = require('zlib');
const ROOT = path.join(__dirname, '..');
const Core = require(ROOT + '/src/rmc_core.js');
const CP = require(ROOT + '/src/claim_parse.js');
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

T('recall still does not parse, and source trust is not a ranker', () => {
  for (const name of ['resonance_recall.py', 'gilligan_anchor.py', 'source_trust.py']) {
    const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', name), 'utf8');
    expect(!/import re\b/.test(src) && !/re\.(findall|search|match|sub|split)/.test(src), name + ' regex');
    expect(!/_tokens|jaccard|semantic_overlap|token overlap/.test(src), name + ' token overlap');
  }
});

T('a Wikipedia-only excerpt never admits', () => {
  const out = py(`
import json
from rmc_engine_v1.rmc_core import run
wiki = {"id":"wiki","text":"Quartz is a hard crystalline mineral made of silicon dioxide.","url":"https://en.wikipedia.org/wiki/Quartz","source":"wikipedia","trust":"low","quarantined":True}
only = run({"question":"What is quartz?","live":True,"memory":{"research":[wiki]}})
anchor = {"id":"enc-quartz","text":"Quartz is a hard crystalline mineral made of silicon dioxide.","tier":"anchor","state":"anchor","trust":"trusted","sfe":{"Phi":9,"eps":0,"mu":1},"contributor":"encyclopedia:openstax","license":"CC BY 4.0","source_url":"https://openstax.org/books/chemistry/pages/1-introduction","revision":"test"}
both = run({"question":"What is quartz?","live":True,"memory":{"anchors":[anchor],"research":[wiki]}})
print(json.dumps({
  "only": {"reply": only["product_reply"], "text": only["reply"], "rule": (only["quarantine_curation"] or [{}])[0].get("rule"), "premise": (only["quarantine_curation"] or [{}])[0].get("premise"), "trust": (only.get("trust") or {}).get("rule")},
  "both": {"reply": both["product_reply"], "text": both["reply"], "rule": (both["quarantine_curation"] or [{}])[0].get("rule"), "premise": (both["quarantine_curation"] or [{}])[0].get("premise"), "points": (both["quarantine_curation"] or [{}])[0].get("points_at"), "rests": (both.get("trust") or {}).get("rests_on"), "block": (both.get("trust") or {}).get("blocks_admit")}
}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.only.reply === false && !row.only.text, JSON.stringify(row.only));
  expect(row.only.rule === 'LOW-TRUST-NO-PREMISE' && row.only.premise === false, JSON.stringify(row.only));
  expect(row.both.rule === 'LOW-TRUST-POINTS-ANCHOR' && row.both.premise === false && row.both.points === 'enc-quartz', JSON.stringify(row.both));
  expect(row.both.block === false, JSON.stringify(row.both));
  if (row.both.reply) expect(String(row.both.text).indexOf('Quartz is a hard crystalline mineral') >= 0 && row.both.rests === 'enc-quartz', JSON.stringify(row.both));
});

T('anchors carry a packet, a license, and are not admitted by storage', () => {
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'anchors_187.json'), 'utf8'));
  expect(pack.count >= 20 && pack.anchors.length === pack.count, 'count ' + pack.count);
  const gz = zlib.gzipSync(fs.readFileSync(path.join(ROOT, 'data', 'anchors_187.json'))).length;
  expect(gz < 80000, 'gzip ' + gz);
  for (const row of pack.anchors) {
    expect(row.state === 'anchor' && row.trust === 'trusted' && row.tier === 'anchor', row.id);
    expect(row.packet && row.packet.schema === 'FORGE-RESONANCE-PACKET/v1' && row.sfe && row.sfe.mu > 0, row.id);
    expect(row.license && row.source_url && row.revision && String(row.contributor).indexOf('encyclopedia:') === 0, row.id);
    expect(!/wikipedia|wikimedia|wikidata|dbpedia|wikisource/i.test(row.source_url + ' ' + row.contributor), row.id);
  }
  expect(pack.anchors.some(a => a.license === 'CC BY 4.0') && pack.anchors.some(a => a.license === 'public-domain'), 'licenses');
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261029223000_anchor_tier_and_writer_grant.sql'), 'utf8');
  expect(/grant usage on schema app to authenticated/.test(sql), 'usage');
  expect(/grant execute on function app\.memory_writer_insert\(text, jsonb, jsonb, jsonb, text, text, jsonb, jsonb, text\) to authenticated/.test(sql), 'execute');
  expect(/create table if not exists kb\.anchors/.test(sql) && /state = 'anchor'/.test(sql), 'table');
  expect(/for select/.test(sql) && /revoke insert, update, delete on kb\.anchors/.test(sql), 'rls');
});

T('Ask stand-ins that produced answers are gone; the language core stays', () => {
  expect(typeof CP.matchAsk !== 'function' && typeof CP.hazardHeadline !== 'function' && typeof CP.applyMixHazard !== 'function', 'stand-ins');
  expect(typeof CP.admitText === 'function' && typeof CP.localDefine === 'function' && typeof CP.topicKeys === 'function', 'kept');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/KRMCCore\.run/.test(app) && !/forge\.process\(/.test(app), 'ask calls rmc');
  const kernel = fs.readFileSync(path.join(ROOT, 'src', 'kernel.js'), 'utf8');
  expect(!/matchAsk/.test(kernel) && !/CS-RECALL-ASK-KEY/.test(kernel), 'kernel shortcut');
  const claim = fs.readFileSync(path.join(ROOT, 'src', 'claim_parse.js'), 'utf8');
  expect(!/chloramine/i.test(claim), 'headline');
});

T('receipt order does not flip the derived sentence', () => {
  const out = py(`
import runpy
runpy.run_path('tools/check_determinism_188.py', run_name='__main__')
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.ok === true && row.files.same === true && row.ids.same === true && row.ids.leaked === false, JSON.stringify(row.files) + ' ' + JSON.stringify(row.ids));
  expect(row.held.stable === true, JSON.stringify(row.held.rows.map(r => ({ q: r.question, same: r.same, a: r.first, b: r.second }))));
});

T('the memory writer keeps derived text when the sentence is already banked', () => {
  const out = py(`
import runpy
runpy.run_path('tools/check_bank_188.py', run_name='__main__')
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.ok === true, JSON.stringify({ writer: row.writer, chain: row.chain, second: row.second }));
});

T('anchor shards are public-domain or CC BY, lazy, and not a parse', () => {
  const store = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'anchor_store.py'), 'utf8');
  expect(!/import re\b/.test(store) && !/re\.(findall|search|match|sub|split)/.test(store), 'anchor_store regex');
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'anchors_188', 'index.json'), 'utf8'));
  expect(index.count >= 2000 && index.shards && index.surfaces, 'count ' + index.count);
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const ship = fs.readFileSync(path.join(ROOT, 'tools', 'shipset.js'), 'utf8');
  expect(!sw.includes('anchors_188/') && !ship.includes('anchors_188/'), 'shards are not precached');
  let largest = 0;
  const bad = [];
  for (const meta of Object.values(index.shards)) {
    const file = path.join(ROOT, 'data', 'anchors_188', meta.file);
    const raw = fs.readFileSync(file);
    largest = Math.max(largest, zlib.gzipSync(raw).length);
    const pack = JSON.parse(raw.toString('utf8'));
    for (const row of pack.anchors) {
      const blob = (row.text + ' ' + row.source_url + ' ' + row.contributor + ' ' + row.license).toLowerCase();
      if (/wikipedia|wikimedia|wikidata|dbpedia|wikisource|by-nc/.test(blob)) bad.push(row.id);
      if (row.license !== 'public-domain' && row.license !== 'CC BY 4.0') bad.push('lic ' + row.id);
      if (!row.packet || row.packet.schema !== 'FORGE-RESONANCE-PACKET/v1' || !(row.sfe && row.sfe.mu > 0)) bad.push('pkt ' + row.id);
    }
  }
  expect(!bad.length, bad.slice(0, 4).join(','));
  expect(largest < 80000, 'shard gzip ' + largest);
  const sql = fs.readFileSync(path.join(ROOT, '..', 'supabase', 'migrations', '20261030143000_seed_kb_anchors.sql'), 'utf8');
  expect(/do not apply/i.test(sql) && /insert into kb\.anchors/.test(sql), 'seed migration');
  const out = py(`
import json
from rmc_engine_v1.anchor_store import select_anchors, clear_cache
clear_cache()
japan = select_anchors("What is the capital of Japan?")
helium = select_anchors("What is helium?")
print(json.dumps({"n": len(japan), "tokyo": japan[0]["text"] if japan else "", "helium": len(helium)}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.n >= 1 && row.n <= 16 && row.tokyo.indexOf('Tokyo is the capital of Japan') === 0 && row.helium === 0, JSON.stringify(row));
});

T('version registry names 4.9.187 and the switches stay off', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.201', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.187/.test(conf) && /C_min stays 0\.87/.test(conf) && /Wikipedia/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.187/.test(nb) && /WIRING_187/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.187/.test(readme) && /WIRING_187/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_187.md'), 'utf8');
  expect(/rmc_core/.test(doc) && /low-trust/.test(doc) && /0\.87/.test(doc), 'WIRING');
  const live = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_187.md'), 'utf8');
  expect(/60/.test(live) && /cold/.test(live), 'LIVE');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.201' && ((tgt.suites[0] === 'r4201_suite.js' || tgt.suites[0] === 'r4200_suite.js' || tgt.suites[0] === 'r4199_suite.js' || tgt.suites[0] === 'r4198_suite.js' || tgt.suites[0] === 'r4197_suite.js' || tgt.suites[0] === 'r4196_suite.js' || tgt.suites[0] === 'r4195_suite.js' || tgt.suites[0] === 'r4194_suite.js') || tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.201' && reg.features.some(f => f.id === 'R4187-ANCHOR-TIER') && reg.count === reg.features.length, reg.version + ' ' + reg.count);
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
  const receipt = fs.readFileSync(path.join(ROOT, '..', 'docs', 'ADMIT_RECEIPT_187.md'), 'utf8');
  expect(/not shipped/.test(receipt) && /C_min/.test(receipt), 'receipt proposal');
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4187', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4187', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
