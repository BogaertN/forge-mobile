/* R4195 (4.9.196): write-once dead path archive, sealed loops, ledger fork.
 * The 4.9.191 breaker and the v4.3 law constants are called. They are not copied.
 * C_min stays 0.87. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const D = require(ROOT + '/src/dpa_195.js');
const LG = require(ROOT + '/src/ledger.js');
const KM = require(ROOT + '/src/kmath.js');
const KMOD = require(ROOT + '/src/kernel.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.dpa_195'], {
    input: JSON.stringify(payload),
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status) throw new Error(String(r.stderr || r.stdout || 'python failed').slice(0, 800));
  return JSON.parse(r.stdout);
}
function same(a, b, pathName) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) > 1e-9) throw new Error((pathName || '') + ' ' + a + ' vs ' + b);
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) throw new Error((pathName || '') + ' length');
    a.forEach((x, i) => same(x, b[i], (pathName || '') + '[' + i + ']'));
    return;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).filter(k => a[k] !== undefined || b[k] !== undefined);
    for (const k of keys) {
      if (a[k] === undefined || b[k] === undefined) throw new Error((pathName || '') + '.' + k + ' missing');
      same(a[k], b[k], (pathName || '') + '.' + k);
    }
    return;
  }
  if (a !== b) throw new Error((pathName || '') + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b));
}
function store() {
  const st = {};
  return KMOD.MemoryStore({ get: k => st[k], set: (k, v) => { st[k] = v; } });
}

T('a rewrite is rejected and drift 0.35 is not archived', () => {
  const row = D.rewriteDemo();
  expect(row.first_ok === true && row.first_rule === 'DPA-APPENDED' && row.kept_psi === 'psi-sky', JSON.stringify(row));
  expect(row.rewrite_ok === false && row.rewrite_rule === 'DPA-REWRITE-REJECTED' && row.length === 1, JSON.stringify(row));
  expect(row.calm_rule === 'DPA-NOT-DEAD' && row.chain_ok === true && row.admit_gate === false && row.calls_llm === false, JSON.stringify(row));
  expect(D.erase().rule === 'DPA-ERASE-REJECTED', 'erase');
  const hard = D.classify(0.81);
  const edge = D.classify(0.8);
  const at = D.classify(0.35);
  const over = D.classify(0.36);
  const skip = D.classify(0.1, { from: 5, to: 8 });
  expect(at.dead === false && over.dead === true && edge.dead === true && edge.hard_stop === false && hard.hard_stop === true, JSON.stringify({ at: at.dead, over: over.dead, edge: edge.hard_stop, hard: hard.hard_stop }));
  expect(skip.forbidden_step === true && skip.dead === true && skip.admit_gate === false && skip.c_min === 0.87 && skip.echo_min === 0.85, JSON.stringify(skip));
  expect(over.spc_above_0_5 === false && D.classify(0.51).spc_above_0_5 === true && D.classify(0.51).spc_logged_only === true && D.classify(0.51).admit_gate === false, 'spc log');
  expect(KM.driftCircuitBreaker(0.36, null, []).consecutive_failures === 1, 'calls the 4.9.191 breaker');
  same(row, py({ op: 'rewrite' }), 'rewrite');
  same(D.classify(0.36), py({ op: 'classify', epsilon_s: 0.36 }), 'class36');
  same(D.classify(0.35), py({ op: 'classify', epsilon_s: 0.35 }), 'class35');
  same(D.classify(0.81), py({ op: 'classify', epsilon_s: 0.81 }), 'class81');
  same(skip, py({ op: 'classify', epsilon_s: 0.1, from: 5, to: 8 }), 'skip');
});

T('the hash chain verifies and a changed record does not', () => {
  const row = D.tamperDemo();
  const seal = D.sealDemo();
  expect(row.honest_ok === true && row.tamper_ok === false && row.tamper_why === 'DPA-SIGNATURE-MISMATCH', JSON.stringify(row));
  expect(seal.seal_ok === true && seal.phase_name === 'Recursion' && seal.question === 'why is the sky blue', JSON.stringify(seal));
  expect(seal.low_rule === 'SEAL-ECHO-BELOW-MIN' && seal.skip_rule === 'SEAL-REFUSED-DEAD-PATH' && seal.rewrite_rule === 'DPA-REWRITE-REJECTED', JSON.stringify(seal));
  expect(seal.length === 1 && seal.chain_ok === true && seal.admit_gate === false && seal.calls_llm === false, JSON.stringify(seal));
  const names = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => KM.CANONICAL_PHASE_NAMES[n]);
  expect(names.join(',') === 'Initiation,Polarity,Desire,Friction,Entropy,Grace,Naming,Power,Recursion', names.join(','));
  same(row, py({ op: 'tamper' }), 'tamper');
  same(seal, py({ op: 'seal' }), 'seal');
  same(D.monitorLines('chain'), py({ op: 'monitor', mode: 'chain' }), 'monitor-chain');
  same(D.monitorLines('rewrite'), py({ op: 'monitor', mode: 'rewrite' }), 'monitor-rewrite');
});

T('a verified fork keeps the existing chain and a second one is already resolved', () => {
  const row = D.forkDemo();
  expect(row.existing_verifies === true && row.forged_verifies === true && row.resolved === true, JSON.stringify(row));
  expect(row.rule === 'LEDGER-FORK-RESOLVED' && row.kept === 'existing' && row.fork === 2 && row.length === 1, JSON.stringify(row));
  expect(row.already === true && row.again_rule === 'LEDGER-FORK-RESOLVED' && row.chain_ok === true, JSON.stringify(row));
  expect(row.forward_rule === 'LEDGER-FAST-FORWARD' && row.forward_added === 1, JSON.stringify(row));
  expect(row.broken_ok === false && row.broken_rule === 'LEDGER-HASH-MISMATCH' && row.admit_gate === false && row.calls_llm === false, JSON.stringify(row));
  const chains = D.demoChains();
  expect(LG.verifyChain(chains.existing).ok && LG.verifyChain(chains.forged).ok, 'ledger verify');
  expect(chains.existing[1].hash === LG.entryHash(chains.existing[1]), 'entry hash is ledger.js');
  let tick = 0;
  const clock = () => new Date(Date.UTC(2026, 9, 30, 16, 0, 0) + (tick++) * 1000).toISOString();
  const random = () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
  const a = LG.Ledger(store(), { clock, random });
  const b = LG.Ledger(store(), { clock, random: () => new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2]) });
  b.append('memory_write', { n: 1 });
  b.append('memory_write', { n: 2 });
  expect(a.merge(b.own()).rule === 'LEDGER-FAST-FORWARD', 'seed');
  const forged = JSON.parse(JSON.stringify(b.own()));
  forged[1].payload_sha256 = 'f'.repeat(64);
  forged[1].hash = LG.entryHash(forged[1]);
  const kept = a.merge(forged);
  expect(kept.rule === 'LEDGER-FORK-KEPT-EXISTING' && kept.fork === 2, JSON.stringify(kept));
  const archive = D.emptyArchive();
  const sealed = D.resolveWithLedger(a, forged, archive);
  expect(sealed.rule === 'LEDGER-FORK-RESOLVED' && sealed.kept === 'existing' && archive.resolutions.length === 1, JSON.stringify({ rule: sealed.rule, kept: sealed.kept }));
  expect(a.foreign()[b.device()][1].hash === b.own()[1].hash, 'existing chain kept');
  const second = D.resolveFork(a.foreign()[b.device()], forged, archive);
  expect(second.already === true && archive.resolutions.length === 1 && D.verifyArchive(archive).resolutions.ok, 'one seal');
  same(row, py({ op: 'fork' }), 'fork');
  same(D.monitorLines('fork'), py({ op: 'monitor', mode: 'fork' }), 'monitor-fork');
});

T('the Ask card shows the rewrite, the chain, and the fork', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/data-dpa195/.test(html) && /src="src\/dpa_195.js"/.test(html) && sw.indexOf('./src/dpa_195.js') >= 0, 'card');
  expect(/data-dpa-195/.test(app), 'ask trace');
  const rewrite = D.monitorLines('rewrite');
  const chain = D.monitorLines('chain');
  const fork = D.monitorLines('fork');
  expect(rewrite.attrs.status === 'DPA-REWRITE-REJECTED' && /not a dead path/.test(rewrite.lines[2]), rewrite.lines.join(' | '));
  expect(chain.attrs.status === 'verified' && chain.attrs.detail === 'DPA-SIGNATURE-MISMATCH' && /Recursion/.test(chain.lines[2]), chain.lines.join(' | '));
  expect(fork.attrs.status === 'LEDGER-FORK-RESOLVED' && /seq 2/.test(fork.lines[1]), fork.lines.join(' | '));
  const stage = py({ op: 'stage', epsilon_s: 0.2 });
  const eng = cp.spawnSync('python3', ['-c', 'import json; from rmc_engine_v1.language_core_engines import run_engines; print(json.dumps(run_engines(0.2, 4)["dpa_195"]))'], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (eng.status) throw new Error(String(eng.stderr || eng.stdout).slice(0, 500));
  const traced = JSON.parse(eng.stdout);
  expect(traced.eligible === false && traced.admit_gate === false && traced.calls_llm === false && traced.rewrite_rule === stage.rewrite_rule, JSON.stringify(traced));
});

T('the stage does not admit and the module does not call a model', () => {
  const calm = D.stage(0.2);
  const hot = D.stage(0.85);
  expect(calm.eligible === false && calm.rewrite_rule === 'DPA-REWRITE-REJECTED' && calm.fork_rule === 'LEDGER-FORK-RESOLVED', JSON.stringify(calm));
  expect(hot.eligible === true && hot.spc_above_0_5 === true && hot.spc_logged_only === true && hot.admit_gate === false && hot.writes === false && hot.calls_llm === false, JSON.stringify(hot));
  expect(calm.c_min === 0.87 && calm.echo_min === 0.85 && calm.money === false, JSON.stringify(calm));
  same(calm, py({ op: 'stage', epsilon_s: 0.2 }), 'stage-calm');
  same(hot, py({ op: 'stage', epsilon_s: 0.85 }), 'stage-hot');
  const js = fs.readFileSync(path.join(ROOT, 'src', 'dpa_195.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'dpa_195.py'), 'utf8');
  expect(!/openai|ollama|anthropic|fetch\(/.test(js) && !/openai|ollama|anthropic/.test(pySrc), 'no model');
  expect(js.indexOf('KM.driftCircuitBreaker') >= 0 && pySrc.indexOf('drift_circuit_breaker') >= 0, 'reuses the breaker');
  expect(js.indexOf('LG.verifyChain') >= 0 && js.indexOf('LG.entryHash') >= 0, 'reuses the ledger');
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
});

T('cold admits stay 48 of 60 and the release is 4.9.196', () => {
  const live = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_195_results.json'), 'utf8'));
  const prior = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_194_results.json'), 'utf8'));
  expect(live.stable === true && live.calls_llm === false, JSON.stringify({ stable: live.stable, llm: live.calls_llm }));
  for (const p of live.passes) {
    expect(p.admitted === 48 && p.held === 12, p.name + ' ' + p.admitted);
    expect(p.rows.every(r => r.dpa_admit_gate === false && r.dpa_calls_llm === false), p.name + ' admit gate');
  }
  const now = new Set(live.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  const then = new Set(prior.passes[0].rows.filter(r => r.admitted).map(r => r.question));
  expect(now.size === 48 && [...now].every(q => then.has(q)) && [...then].every(q => now.has(q)), 'admit set moved');
  const pyodide = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'live_195_pyodide.json'), 'utf8'));
  expect(pyodide.pyodide === '0.27.7' && pyodide.matched === pyodide.cases && pyodide.max_abs_gap === 0 && pyodide.calls_llm === false, JSON.stringify(pyodide));
  const ver = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();
  expect(ver === '4.9.201', ver);
  const conf = fs.readFileSync(path.join(ROOT, 'CONFLICTS.md'), 'utf8');
  expect(/v4\.9\.195/.test(conf) && /C_min stays 0\.87/.test(conf), 'CONFLICTS');
  const nb = fs.readFileSync(path.join(ROOT, '..', 'NEXT_BUILD.md'), 'utf8');
  expect(/4\.9\.195/.test(nb) && /WIRING_195/.test(nb), 'NEXT_BUILD');
  const readme = fs.readFileSync(path.join(ROOT, '..', 'README.md'), 'utf8');
  expect(/4\.9\.195/.test(readme) && /WIRING_195/.test(readme), 'README');
  const doc = fs.readFileSync(path.join(ROOT, '..', 'docs', 'WIRING_195.md'), 'utf8');
  expect(/0\.87/.test(doc) && /No model is called/.test(doc) && /DPA-REWRITE-REJECTED/.test(doc), 'WIRING');
  const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'feature_registry.json'), 'utf8'));
  expect(reg.version === '4.9.201' && reg.features.some(f => f.id === 'R4195-DEAD-PATH-ARCHIVE') && reg.count === reg.features.length && reg.claims.Implemented === 112 && reg.claims.Partial === 195, reg.version + ' ' + reg.count);
  const Next = require(ROOT + '/src/next_layer.js');
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, 'defaults');
  Next.set('dream_idle', true);
  Next.set('economy', true);
  expect(Next.enabled('dream_idle') === true && Next.enabled('economy') === true, 'test-only enable');
  Next.set('dream_idle', false);
  Next.set('economy', false);
  const formula = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'measurement_kernel.py'), 'utf8');
  expect(/0\.24\*memory_fit \+ 0\.20\*phase_validity/.test(formula), 'formula');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4195', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4195', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
