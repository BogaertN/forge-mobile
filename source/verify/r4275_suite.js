/* 4.9.252: the user manual is a knowledge source, a forget is a tombstone, the home PC
 * plans without a service key, and a cymatic plate is a visual of the packet's carriers. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const CORE = require(ROOT + '/src/rmc_core.js');
const R2 = require(ROOT + '/src/rmc_renderer_200.js');
const WF = require(ROOT + '/src/world_facts.js');
const UM = require(ROOT + '/src/user_manual.js');
const CY = require(ROOT + '/src/rkm_cymatic.js');
const GC = require(ROOT + '/src/gilligan_codex.js');
const A = require('./ask_path.js');
function forge() { return FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-26T00:00:00Z' }); }
function askManual(q) {
  const f = forge();
  const py = 'import json,sys\nfrom rmc_engine_v1.rmc_core import run\np=json.load(sys.stdin)\nprint(json.dumps(run(p), default=str))';
  const env = Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') + path.delimiter + ROOT });
  let payload = { question: q, live: true, memory: { phone: [], pools: [] } };
  payload = CORE.withClauses(Object.assign({}, payload, { frame: Q.compile(q, f) }), Q, f);
  const r = cp.spawnSync('python3', ['-c', py], { cwd: ROOT, input: JSON.stringify(payload), env, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) throw new Error((r.stderr || 'python failed').slice(-400));
  const row = JSON.parse(r.stdout.trim().split('\n').pop());
  return CORE.outwardCompile(row, payload, f, R2, Q);
}
function register(C, expect) {
  C('R4275', 'the user manual is ingested as clauses and capability questions are composed from them', () => {
    const f = forge();
    const rows = UM.rows(Q, f);
    expect(UM.SOURCE === 'Forge user manual' && rows.length >= 6 && rows.every(r => r.provenance.source === 'Forge user manual' && r.clause && r.clause.parsed), 'manual rows');
    const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'USER_MANUAL.md'), 'utf8');
    expect(doc.includes('You remember a sentence by an explicit request.') && !/openai|gpt-|claude/i.test(doc), 'the manual names a shipped action');
    const one = askManual('What can you do?');
    const two = askManual('What do you do?');
    const three = askManual('How do I remember something?');
    const four = askManual('Can you run simulations?');
    const parts = String(one.reply || '').split(/(?<=\.)\s+/).filter(Boolean);
    expect(one.product_reply === true && parts.length >= 5 && one.coherence >= 0.87 && one.echo.method === 'structural_frame' && one.echo.score >= 0.85, JSON.stringify([one.reply, one.route, one.coherence]));
    for (const bit of ['remember a sentence', 'simulation', 'derivation', 'packet', 'Athena']) expect(String(one.reply).includes(bit), 'missing ' + bit);
    expect(two.product_reply === true && two.reply === one.reply && two.echo.pass === true, JSON.stringify(two.reply));
    expect(three.product_reply === true && three.reply === 'You remember a sentence by an explicit request.' && three.echo.method === 'structural_frame' && !/shipped behavior/.test(three.reply), JSON.stringify([three.reply, three.route]));
    expect(four.product_reply === true && /^Yes\. /.test(four.reply || '') && /simulation/.test(four.reply || ''), JSON.stringify(four.reply));
    const src = fs.readFileSync(path.join(ROOT, 'src', 'selfmodel.js'), 'utf8');
    expect(!/TODO|placeholder/.test(src), 'the self-model placeholder is gone');
  });
  C('R4275', 'forget retracts the fact, and a later ask is blocked by the refuted ledger', () => {
    WF.clear();
    const s = A.session();
    const rem = A.remember(s, 'remember that a wren is a bird');
    expect(rem.ok, 'remember');
    const up = WF.upsert({ id: 'wren', text: rem.text, clause: rem.clause, source: 'phone_kb', trust: 'trusted', kind: 'remember' });
    expect(up.ok === true, up.rule);
    const gone = A.forget(s, 'forget that a wren is a bird');
    expect(gone.ok === true, gone.rule);
    const kept = WF.loadRaw().facts.find(r => /wren/.test(r.text || ''));
    expect(kept && kept.status === 'retracted' && kept.retracted && kept.retracted.why === 'user_forget' && !WF.rows().some(r => /wren/.test(r.text)), JSON.stringify(kept && kept.status));
    const led = (WF.loadRaw().refuted || []).find(e => /wren/.test(e.text || ''));
    expect(led && /^[0-9a-f]{64}$/.test(led.hash) && led.reason && led.reason.why && led.reason.path, JSON.stringify(led));
    const asked = A.ask(s, 'is a wren a bird?');
    expect(asked.product_reply !== true && asked.route === 'RETRACTED' && asked.trace && asked.trace.status === 'retracted' && asked.reply == null, JSON.stringify([asked.reply, asked.route, asked.trace]));
    const codex = GC.createCodex();
    const write = codex.authorizeWrite({ lane: 'promote_candidate', claim: 'A wren is a bird.', eps: 0.1, integrity: 0.95, goal: 'keep the name', seal: 'wren-loop' });
    expect(write.ok === false && write.rule === 'CODEX-REFUTED' && write.hash === led.hash, JSON.stringify(write));
    const rkm = fs.readFileSync(path.join(ROOT, 'src', 'rkm.js'), 'utf8');
    expect(!/facts\.splice|facts\.pop\(/.test(rkm), 'RKM does not delete a fact');
    WF.clear();
  });
  C('R4275', 'the home PC plans without a hosted write and refuses a service key', () => {
    const env = fs.readFileSync(path.join(ROOT, 'server', 'home_pc', '.env.example'), 'utf8');
    expect(/FORGE_WRITER_BEARER=\s*$/m.test(env) && !/eyJ/.test(env) && !/service_role\s*=/.test(env), 'no credential in the example');
    const unit = fs.readFileSync(path.join(ROOT, 'server', 'home_pc', 'forge-home-pc.service'), 'utf8');
    const install = fs.readFileSync(path.join(ROOT, 'server', 'home_pc', 'install.sh'), 'utf8');
    expect(/python -m server.home_pc.run/.test(unit) && /pybullet|python-copasi|mujoco|pyscf|openmm|neuron/.test(install) && /OpenFOAM/.test(install), 'unit and installer');
    const out = cp.spawnSync('python3', ['-c', `
import json, os
os.environ.pop("FORGE_WRITER_URL", None)
os.environ.pop("FORGE_WRITER_BEARER", None)
from server.home_pc.run import tick_once, writer_refused
plain = tick_once()
os.environ["FORGE_WRITER_BEARER"] = "service_role"
refused = tick_once()
os.environ["FORGE_WRITER_URL"] = "https://example.test/functions/v1/memory-writer"
os.environ["FORGE_WRITER_BEARER"] = "writer-not-a-service-key"
blocked = tick_once()
print(json.dumps({"plain": plain, "refused": refused, "blocked": blocked, "why": writer_refused()}))
`], { cwd: ROOT, encoding: 'utf8' });
    if (out.status !== 0) throw new Error((out.stderr || 'home pc').slice(-400));
    const row = JSON.parse(out.stdout);
    expect(row.plain.rule === 'HOME-PLAN-ONLY' && row.plain.wrote === false && row.refused.rule === 'HOME-WRITER-REFUSED' && row.blocked.rule === 'KB-WRITER-NO-SESSION' && row.blocked.wrote === false, JSON.stringify(row));
    const card = fs.readFileSync(path.join(ROOT, 'src', 'sim_device.js'), 'utf8');
    expect(/Home PC Simulator/.test(card) && /data-settings="home-pc"/.test(card) && /Test Connection/.test(card), 'settings card');
    const neo = fs.readFileSync(path.join(ROOT, 'src', 'neo.js'), 'utf8');
    expect(/does not spawn and it does not write/.test(neo) && !/supabase/.test(neo), 'Neo duty is unchanged');
  });
  C('R4275', 'the cymatic plate is a deterministic visual, and SHA-256 stays the id', () => {
    const packet = { root_frequency_hz: 144, music: [{ hz: 144 }, { id: 'ripple', hz: 36 }] };
    const a = CY.plate(packet, 16);
    const b = CY.plate(packet, 16);
    expect(a.label === 'experimental' && a.decodes === false && a.calls_llm === false && JSON.stringify(a.grid) === JSON.stringify(b.grid) && a.carriers.join(',') === '36,144', JSON.stringify(a.carriers));
    expect(CY.transducer.status === 'not_connected' && CY.transducer.kind === 'condenser_or_piezo' && CY.transducer.drive === null, JSON.stringify(CY.transducer));
    const note = fs.readFileSync(path.join(ROOT, '..', 'docs', 'rkm', 'README.md'), 'utf8');
    expect(/BLAKE3 psi_id is superseded by SHA-256/.test(note) && /25 Nov 2026/.test(note) && /WebCrypto/.test(note), 'the decision is written down');
    expect(fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim() === '4.9.253', 'VERSION');
  });
}
module.exports = register;
if (require.main === module) {
  const results = [];
  register((cls, name, fn) => { let ok = false, why = ''; try { fn(); ok = true; } catch (e) { why = String(e.message || e).slice(0, 500); } results.push({ cls, name, ok, why }); }, (c, m) => { if (!c) throw new Error(m || 'fail'); });
  console.log(JSON.stringify(results, null, 1));
  if (results.some(r => !r.ok)) process.exit(1);
}
