/* R4196 (4.9.196): storage tiers. PMA §6.
 * Decay calls the 4.9.191 SPC charge. Resurrection calls the seven gates.
 * A deep ghost seals once through the 4.9.195 archive. C_min stays 0.87. No LLM. */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const Tiers = require(ROOT + '/src/tiers_196.js');
const Gen = require(ROOT + '/src/genesis_collapse.js');
const Gates = require(ROOT + '/src/phase_coherent_gates.js');
const Dpa = require(ROOT + '/src/dpa_195.js');
const Next = require(ROOT + '/src/next_layer.js');
const tests = [];
const T = (name, fn) => tests.push({ name, fn });
const expect = (c, why) => { if (!c) throw new Error(why || 'expectation failed'); };
function py(payload) {
  const r = cp.spawnSync('python3', ['-m', 'rmc_engine_v1.tiers_196'], {
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

T('decay moves one item across Hot, Warm, Cold, and Deep on a simulated clock', () => {
  const row = Tiers.clockDemo();
  expect(JSON.stringify(row.tiers) === JSON.stringify(['hot', 'warm', 'cold', 'deep_ghost']), JSON.stringify(row.tiers));
  expect(JSON.stringify(row.hours) === JSON.stringify([0, 168, 600, 800]), JSON.stringify(row.hours));
  expect(JSON.stringify(row.labels) === JSON.stringify(['Hot', 'Warm (SPC)', 'Cold', 'Deep ghost loop']), JSON.stringify(row.labels));
  expect(JSON.stringify(row.moves) === JSON.stringify(['hot', 'warm', 'cold', 'deep_ghost']), JSON.stringify(row.moves));
  expect(row.active[0] === true && row.active[1] === true && row.active[2] === false && row.active[3] === false, JSON.stringify(row.active));
  expect(row.gc[0] === false && row.gc[1] === false && row.gc[2] === false && row.gc[3] === true, JSON.stringify(row.gc));
  expect(Math.abs(row.half_charge - 0.5) < 1e-9 && Math.abs(row.half_charge - Gen.spcCharge(1, 168)) < 1e-12, String(row.half_charge));
  expect(row.half_life_hours === 168 && row.clock_seal === 'DPA-NOT-DEAD', JSON.stringify({ life: row.half_life_hours, seal: row.clock_seal }));
  expect(row.rewind_rule === 'TIER-CLOCK-REWIND' && row.rewind_tier === 'deep_ghost', JSON.stringify(row.rewind_rule));
  expect(row.erase_rule === 'TIER-ERASE-REJECTED' && row.archive_rule === 'DPA-ERASE-REJECTED' && row.kept === 1, JSON.stringify(row));
  expect(row.rewrite_rule === 'TIER-REWRITE-REJECTED' && row.length === 1, JSON.stringify(row.rewrite_rule));
  expect(row.loud_tier === 'hot' && row.loud_dead === true && row.loud_spc === true && row.loud_write === false, JSON.stringify(row));
  expect(row.admit_gate === false && row.writes === false && row.calls_llm === false && row.money === false && row.dream_idle === false && row.economy === false, JSON.stringify(row));
  expect(row.c_min === 0.87 && row.echo_min === 0.85 && row.packs_gated === true && row.christping === 'gilligan-only' && row.wikipedia_anchor === false, 'laws');
  expect(row.internal.logged_only === true && row.internal.admit === false && row.internal.codex_spc_write === 0.5, 'internal');
  expect(Gen.spcActive(0.1) === false && Gen.spcGc(0.05) === false, 'bands stay in genesis');
  same(row, py({ op: 'clock' }), 'clock');
});

T('resurrection passes all seven gates and deep ghost does not re-enter', () => {
  const row = Tiers.resurrectDemo();
  const direct = Gates.phaseCoherentResurrection(Tiers.passingRecord());
  expect(direct.ok === true && direct.gates.length === 7 && direct.gates.every(g => g.pass), JSON.stringify(direct));
  expect(row.warm_ok === true && row.warm_rule === 'TIER-RESURRECTED' && row.warm_passed === 7 && row.warm_count === 7 && row.warm_failed.length === 0, JSON.stringify(row));
  expect(row.cold_ok === true && row.cold_rule === 'TIER-RESURRECTED' && row.cold_passed === 7, JSON.stringify(row));
  expect(row.deep_ok === false && row.deep_rule === 'TIER-DEEP-NO-REENTRY' && row.deep_gate_ok === true && row.deep_passed === 7, JSON.stringify(row));
  expect(row.hot_ok === false && row.hot_rule === 'TIER-HOT-ACTIVE', JSON.stringify(row));
  expect(row.fail_ok === false && row.fail_rule === 'TIER-GATES-FAILED' && JSON.stringify(row.fail_failed) === JSON.stringify(['phase_timing_phi9']), JSON.stringify(row.fail_failed));
  expect(row.capacity_ok === false && JSON.stringify(row.capacity_failed) === JSON.stringify(['capacity']), JSON.stringify(row.capacity_failed));
  expect(row.writes === false && row.calls_llm === false && row.dream_idle === false && row.admit_gate === false && row.money === false, 'no write');
  const open = Tiers.resurrect(Tiers.passingRecord(), 'warm');
  expect(open.gates.length === 7 && open.gates.every(g => g.pass) && open.cite.indexOf('seven-gate') >= 0, 'calls the 191 gates');
  same(row, py({ op: 'gates' }), 'gates');
  same(open, py({ op: 'resurrect', tier: 'warm' }), 'open');
});

T('a dead path seals once at deep and drift 0.35 does not', () => {
  const row = Tiers.deepDemo();
  expect(row.early_tier === 'hot' && row.early_dead === true && row.early_write === false, JSON.stringify(row));
  expect(row.late_tier === 'deep_ghost' && row.seal_rule === 'DPA-APPENDED' && row.again_rule === 'DPA-REWRITE-REJECTED', JSON.stringify(row));
  expect(row.archive_n === 1 && row.chain_ok === true && row.phase_name === 'Initiation', JSON.stringify(row));
  expect(row.calm_tier === 'deep_ghost' && row.calm_dead === false && row.calm_rule === 'DPA-NOT-DEAD' && row.calm_n === 0, JSON.stringify(row));
  expect(row.skip_early_tier === 'hot' && row.skip_dead === true && row.skip_tier === 'deep_ghost' && row.skip_rule === 'DPA-APPENDED', JSON.stringify(row));
  expect(row.skip_phase === 'Power' && row.skip_n === 1, JSON.stringify(row));
  expect(row.erase_rule === 'DPA-ERASE-REJECTED' && row.tier_erase === 'TIER-ERASE-REJECTED' && row.kept === 1, JSON.stringify(row));
  expect(row.dead_35 === false && row.dead_36 === true && row.dead_80 === true && row.hard_stop_80 === false && row.hard_stop_81 === true, JSON.stringify(row));
  expect(row.spc_51 === true && row.admit_gate === false && row.calls_llm === false && row.c_min === 0.87, 'spc log');
  expect(Dpa.classify(0.36).dead === true && Dpa.classify(0.35).dead === false, 'calls the archive classifier');
  same(row, py({ op: 'deep' }), 'deep');
  const clock = Tiers.monitorLines('clock');
  const gates = Tiers.monitorLines('gates');
  const deep = Tiers.monitorLines('deep');
  expect(clock.attrs.status === 'deep_ghost' && /Half-life charge is 0.5/.test(clock.lines[1]) && /Codex 0.5 is log only/.test(clock.lines[5]), clock.lines.join(' | '));
  expect(gates.attrs.detail === '7/7' && /Gates passed 7 of 7/.test(gates.lines[0]) && /TIER-DEEP-NO-REENTRY/.test(gates.lines[3]), gates.lines.join(' | '));
  expect(deep.attrs.status === 'DPA-REWRITE-REJECTED' && /Power/.test(deep.lines[3]), deep.lines.join(' | '));
  same(clock, py({ op: 'monitor', mode: 'clock' }), 'monitor-clock');
  same(gates, py({ op: 'monitor', mode: 'gates' }), 'monitor-gates');
  same(deep, py({ op: 'monitor', mode: 'deep' }), 'monitor-deep');
});

T('the Ask card shows the clock, the seven gates, and the deep seal', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  expect(/data-tiers196/.test(html) && /src="src\/tiers_196.js"/.test(html) && /src="src\/genesis_collapse.js"/.test(html) && /src="src\/phase_coherent_gates.js"/.test(html), 'card');
  expect(sw.indexOf('./src/tiers_196.js') >= 0 && sw.indexOf('./src/genesis_collapse.js') >= 0, 'worker');
  expect(/data-tiers-196/.test(app), 'ask trace');
  const eng = cp.spawnSync('python3', ['-c', 'import json; from rmc_engine_v1.language_core_engines import run_engines; print(json.dumps(run_engines(0.2, 4)["tiers_196"]))'], {
    cwd: path.join(ROOT, 'engine'),
    env: Object.assign({}, process.env, { PYTHONPATH: path.join(ROOT, 'engine') }),
    encoding: 'utf8',
  });
  if (eng.status) throw new Error(String(eng.stderr || eng.stdout).slice(0, 500));
  const traced = JSON.parse(eng.stdout);
  const stage = py({ op: 'stage', epsilon_s: 0.2 });
  expect(traced.tier === 'hot' && traced.half_tier === 'warm' && traced.admit_gate === false && traced.calls_llm === false && traced.deep_rule === stage.deep_rule, JSON.stringify(traced));
});

T('the module calls the 191 and 195 functions and does not start a dream', () => {
  const js = fs.readFileSync(path.join(ROOT, 'src', 'tiers_196.js'), 'utf8');
  const pySrc = fs.readFileSync(path.join(ROOT, 'engine', 'rmc_engine_v1', 'tiers_196.py'), 'utf8');
  expect(js.indexOf('Gen.spcCharge') >= 0 && js.indexOf('Gates.phaseCoherentResurrection') >= 0 && js.indexOf('Dpa.appendDeadPath') >= 0, 'js reuse');
  expect(pySrc.indexOf('spc_charge') >= 0 && pySrc.indexOf('phase_coherent_resurrection') >= 0 && pySrc.indexOf('append_dead_path') >= 0, 'py reuse');
  expect(!/Math\.exp|math\.exp/.test(js) && !/math\.exp/.test(pySrc), 'decay is not copied');
  expect(!/openai|ollama|anthropic|fetch\(/.test(js) && !/openai|ollama|anthropic/.test(pySrc), 'no model');
  expect(Next.SWITCHES.dream_idle === false && Next.SWITCHES.economy === false, 'defaults');
  Next.set('dream_idle', true);
  Next.set('economy', true);
  expect(Next.enabled('dream_idle') === true && Next.enabled('economy') === true, 'test-only enable');
  const row = Tiers.stage(0.2);
  expect(row.dream_idle === false && row.economy === false && row.tier === 'hot' && row.half_tier === 'warm' && row.dead === false && row.admit_gate === false, JSON.stringify(row));
  Next.set('dream_idle', false);
  Next.set('economy', false);
  expect(Next.enabled('dream_idle') === false && Next.enabled('economy') === false, 'restored');
  const hot = Tiers.stage(0.85);
  expect(hot.dead === true && hot.spc_above_0_5 === true && hot.spc_logged_only === true && hot.admit_gate === false && hot.calls_llm === false, JSON.stringify(hot));
  same(row, py({ op: 'stage', epsilon_s: 0.2 }), 'stage-calm');
  same(hot, py({ op: 'stage', epsilon_s: 0.85 }), 'stage-hot');
  same(Tiers.tierAt(1, 600), py({ op: 'tier', c0: 1, hours: 600 }), 'tier-600');
});

const rows = [];
let failed = 0;
for (const t of tests) {
  try { t.fn(); rows.push({ cls: 'R4196', name: t.name, ok: true }); }
  catch (e) { failed++; rows.push({ cls: 'R4196', name: t.name, ok: false, why: String(e.message || e).slice(0, 900) }); }
}
console.log(JSON.stringify(rows, null, 1));
process.exit(failed ? 1 : 0);
