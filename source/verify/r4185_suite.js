/* R4185 (4.9.185): resonance recall fills the KB. No token-overlap recall.
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

T('recall does not rank by token overlap or a regex extractor', () => {
  const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'resonance_recall.py'), 'utf8');
  expect(!/import re\b/.test(src) && !/re\.(findall|search|match|sub|split)/.test(src), 'regex extractor');
  expect(!/_tokens|jaccard|semantic_overlap|token overlap/.test(src), 'token overlap');
  expect(/phase_align/.test(src) && /FORGE-RESONANCE-PACKET\/v1/.test(src) && /FR\.BE\.COP|frame_for_atom/.test(src), 'resonance and frames');
  const out = py(`
import json
from rmc_engine_v1.resonance_recall import rank_memory
nodes = [
  {"memory_id":"sun","content":"The sun is hot. Its surface is about 5500 degrees Celsius.","confidence":"medium_high","prior_drift_score":0,"phase_tags":["Φ1"],"ancestry":{"receipt_id":"sun"}},
  {"memory_id":"decoy","content":"Hot sun surface degrees celsius celsius celsius about about.","confidence":"medium_high","prior_drift_score":0,"phase_tags":["Φ1"],"ancestry":{"receipt_id":"decoy"}},
  {"memory_id":"web","content":"The sun is a star.","confidence":"low","prior_drift_score":0.5,"quarantined":True,"phase_tags":["Φ1"]}
]
row = rank_memory("How hot is the sun?", nodes, {"phase_primary":"Φ1"})
ids = [n.get("memory_id") for n in row["active"]]
ev = (row["active"][0].get("retrieval_evidence") or [{}])[0] if row["active"] else {}
print(json.dumps({"how": row["how"], "ids": ids, "type": ev.get("type"), "overlap": row["uses_token_overlap"], "llm": row["calls_llm"], "rsoc": row["rsoc"]["status"], "q": len(row["quarantine"])}))
`);
  const row = JSON.parse(out.trim().split('\n').pop());
  expect(row.how === 'frame_role' && row.ids[0] === 'sun' && row.ids.indexOf('decoy') === -1, JSON.stringify(row));
  expect(row.type === 'phase_align' && row.overlap === false && row.llm === false && row.rsoc === 'locked', JSON.stringify(row));
  expect(row.q === 1, 'quarantine counted');
});

T('an admitted answer carries a resonance packet, provenance, and contributor credit', () => {
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ask_183_memory.json'), 'utf8'));
  const row = Core.runSync({ question: 'How hot is the sun?', live: true, memory: seed });
  expect(row.calls_llm === false && row.model_invoked === false, 'llm');
  expect(row.admit.thresholds.C_min === 0.87 && row.echo.min === 0.85, JSON.stringify(row.admit.thresholds));
  expect(row.coherence_components.formula.indexOf('0.24*memory_fit') === 0, row.coherence_components.formula);
  expect(row.product_reply === true && row.reply && row.coherence >= 0.87, JSON.stringify({ c: row.coherence, reply: row.reply, mf: row.coherence_components.memory_fit }));
  const w = row.memory_write;
  expect(w && w.committed === true && w.calls_llm === false, 'write');
  expect(w.packet.schema === 'FORGE-RESONANCE-PACKET/v1' && w.packet.sfe.Phi === 9 && w.packet.sfe.mu === 1, JSON.stringify(w.packet));
  expect(w.provenance.contributor === 'athena' && w.provenance.question === 'How hot is the sun?', JSON.stringify(w.provenance));
  expect(w.phone_kb.text === row.reply && w.hosted_kb.text === row.reply && w.rmc_receipt.text === row.reply, 'stores');
  const banked = w.bank && w.bank.written === false;
  expect(w.supabase.written === false && w.supabase.verified === false, JSON.stringify(w.supabase));
  expect(w.supabase.rule === (banked ? 'KB-WRITER-ALREADY-BANKED' : 'KB-WRITER-CREDENTIALS-PENDING'), JSON.stringify(w.supabase));
  expect(w.gilligan.christping_initiated === false, 'christping');
  expect(row.resonance && row.resonance.method === 'resonance' && row.resonance.uses_token_overlap === false, JSON.stringify(row.resonance && row.resonance.how));
});

T('quarantine is not a premise and a short chain stays under C_min', () => {
  const web = Core.runSync({
    question: 'What is quartz?',
    live: true,
    memory: { research: [{ id: 'web', text: 'Quartz is a hard crystalline mineral made of silicon dioxide.' }] }
  });
  expect(web.world_model.derived_text === '' && web.world_model.observe.quarantined >= 1 && web.world_model.observe.admitted === 0, JSON.stringify(web.world_model.observe));
  expect(web.product_reply === false && !web.memory_write, 'quarantine written');
  const cur = (web.quarantine_curation || [])[0] || {};
  expect(cur.writes === false && cur.rule === 'DREAM-QUARANTINE-NO-TRUTH', JSON.stringify(cur.rule));
  const chain = Core.runSync({
    question: 'What is quartz?',
    live: true,
    memory: { hosted: [{ id: 'q', text: 'Quartz is a mineral.' }, { id: 'm', text: 'A mineral is a solid substance.' }] }
  });
  expect(chain.world_model.derived_text.indexOf('Quartz is a solid substance.') >= 0, chain.world_model.derived_text);
  expect(chain.coherence < 0.87 && chain.product_reply === false, 'C ' + chain.coherence);
});

T('new modules do not call a model', () => {
  const files = ['resonance_recall.py', 'rmc_core.py'];
  const banned = /openai|anthropic|ollama|huggingface|gemini|mistral|completions|api\.x\.ai/;
  for (const name of files) {
    const src = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', name), 'utf8');
    expect(!banned.test(src), name);
  }
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, JSON.stringify(Next.SWITCHES));
});

T('version registry names 4.9.185', () => {
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.193', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.185/.test(conf) && /resonance/.test(conf) && /C_min stays 0\.87/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.185/.test(nb) && /WIRING_185/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.185/.test(readme) && /WIRING_185/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_185.md'), 'utf8');
  expect(/phase-align/.test(doc) && /FORGE-RESONANCE-PACKET/.test(doc) && /0\.87/.test(doc) && /lexicon\.js/.test(doc), 'WIRING');
  const live = fs.readFileSync(path.join(ROOT, '..', 'docs', 'LIVE_TEST_185.md'), 'utf8');
  expect(/60/.test(live) && /cold/.test(live) && /after fill/.test(live), 'LIVE');
  const tgt = JSON.parse(fs.readFileSync(path.join(ROOT, 'verify', 'targeted.json'), 'utf8'));
  expect(tgt.release === '4.9.193' && (tgt.suites[0] === 'r4193_suite.js' || tgt.suites[0] === 'r4191_suite.js' || tgt.suites[0] === 'r4190_suite.js' || tgt.suites[0] === 'r4189_suite.js' || tgt.suites[0] === 'r4188_suite.js' || tgt.suites[0] === 'r4187_suite.js' || tgt.suites[0] === 'r4186_suite.js' || tgt.suites[0] === 'r4185_suite.js'), JSON.stringify({ release: tgt.release, head: tgt.suites[0] }));
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.193' && reg.features.some(f => f.id === 'R4185-RESONANCE-RECALL') && reg.count === reg.features.length, reg.version + ' ' + reg.count);
});

(async () => {
  let failed = 0;
  const rows = [];
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4185', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4185', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
