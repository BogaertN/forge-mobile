/* R4207 (4.9.207): the ask_183 test answers are deleted (Nic decision (a), step 3).
 * data/ask_183_memory.json held 52 hand-written hosted rows (ho-*) plus a receipt and a phone row, with no source, licence or
 * revision; every cold-60 proof since 4.9.188 used them as premises (48/60). They are deleted, Ask no longer fetches them,
 * the tools start cold from empty phone/hosted/receipt stores, and the honest cold-60 is recorded without tuning. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const COLD = JSON.parse(read('data/cold_207_results.json'));

T('the test answers are gone: no file, no fetch, no exemption, no tool loads them', () => {
  expect(!fs.existsSync(path.join(ROOT, 'data', 'ask_183_memory.json')), 'file');
  expect(!/ask_183_memory|ASK_183_MEMORY/.test(read('src/app.js')), 'app fetch');
  expect(Object.keys(require(ROOT + '/tools/check_fetches.js').EXEMPT).length === 0, 'fetch exemption');
  for (const f of fs.readdirSync(path.join(ROOT, 'tools')).filter(f => f.endsWith('.py') && f !== 'cold_207.py'))
    expect(!/read_text[^\n]*ask_183_memory|ask_183_memory\.json"\)\.read_text/.test(read('tools/' + f)) && !/"ask_183_memory\.json"/.test(read('tools/' + f)), f);
  expect(/SEED = \{"receipts": \[\], "phone": \[\], "hosted": \[\], "research": \[\]\}/.test(read('tools/live_188.py')), 'cold seed is empty');
});
T('no shipped file carries a hand-written ho-* answer row', () => {
  const ship = require(ROOT + '/tools/shipset.js'); const hits = [];
  for (const f of ship.list(ROOT).filter(f => /\.(json|jsonl)$/.test(f))) { const t = fs.readFileSync(path.join(ROOT, ship.src(f)), 'utf8'); if (/"id"\s*:\s*"ho-[a-z0-9-]+"/.test(t)) hits.push(f); }
  expect(!hits.length, hits.join(', '));
});
T('the honest cold 60 is recorded: 20 admitted, 40 held, 0 false admits, no LLM, the old 48 named as using the deleted answers', () => {
  expect(COLD.release === '4.9.207' && COLD.ask_183_seed === 'deleted' && COLD.of === 60 && COLD.rows.length === 60, 'shape');
  expect(COLD.admitted === 20 && COLD.held === 40 && COLD.false_admits === 0 && COLD.calls_llm === false, JSON.stringify({ a: COLD.admitted, h: COLD.held }));
  expect(COLD.previous_claim.admitted === 48 && /deleted/.test(COLD.previous_claim.note), 'previous claim named');
  expect(COLD.rows.filter(r => r.admitted).every(r => r.reply && r.calls_llm === false && !(r.trust === 'wikipedia' && r.premise)), 'admits');
});
T('the recorded cold 60 is reproduced exactly by a fresh run (deterministic, nothing hand-edited)', () => {
  const code = 'import json,sys; sys.path.insert(0,"engine"); sys.path.insert(0,"."); from tools.audit_204 import run_cold; o=run_cold(); print(json.dumps([[r["question"], bool(r["admitted"]), r.get("reply")] for r in o["rows"]]))';
  const out = JSON.parse(cp.execFileSync(process.env.PYTHON || 'python3', ['-c', code], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 }));
  const rec = COLD.rows.map(r => [r.question, !!r.admitted, r.reply === undefined ? null : r.reply]);
  expect(JSON.stringify(out) === JSON.stringify(rec), 'fresh run differs from data/cold_207_results.json');
});
T('the drift bands and admission thresholds are unchanged', () => {
  const cfg = read('engine/rmc_engine_v1/mobile_config.py'); expect(/0\.35/.test(cfg) && /0\.8/.test(cfg), 'bands');
  const core = read('engine/rmc_engine_v1/rmc_core.py'); expect(/0\.87/.test(core) && /0\.85/.test(core), 'C_min and Echo');
});

(async () => {
  const rows = []; let failed = 0;
  for (const t of tests) {
    try { await t.fn(); rows.push({ cls: 'R4207', name: t.name, ok: true }); }
    catch (e) { failed++; rows.push({ cls: 'R4207', name: t.name, ok: false, why: String(e && e.message || e).slice(0, 900) }); }
  }
  console.log(JSON.stringify(rows, null, 1));
  process.exit(failed ? 1 : 0);
})();
