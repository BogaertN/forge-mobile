/* 4.9.196 storage tiers. PMA §6. No LLM.
 * Hot → Warm (SPC) → Cold → Deep ghost loop.
 * The charge is genesis_collapse.spcCharge. This file does not copy the
 * 168-hour formula. Resurrection is phase_coherent_gates. All seven must pass.
 * A dead path that reaches deep is appended once through dpa_195.
 * It does not admit. dream_idle stays off. */
(function (root) {
  const Gen = (typeof module !== 'undefined' && module.exports) ? require('./genesis_collapse.js') : root.GenesisCollapse;
  const Gates = (typeof module !== 'undefined' && module.exports) ? require('./phase_coherent_gates.js') : root.PhaseCoherentGates;
  const Dpa = (typeof module !== 'undefined' && module.exports) ? require('./dpa_195.js') : root.Dpa195;
  const V43 = (typeof module !== 'undefined' && module.exports) ? require('./drift_v43.js') : root.DriftV43;
  const LAW = V43.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1 }).laws;
  const C_MIN = LAW.C_min;
  const ECHO_MIN = LAW.echo_min;
  const CITE = 'PMA §6 Hot, Warm (SPC), Cold, Deep ghost loop. Charge is genesis_collapse.spc_charge, half-life 168 h (Genesis Node pp.116, 143–145). Active is charge above 0.1. Collection is charge below 0.05. Hot is the active runtime at elapsed 0 while the charge is still active. Warm is the SPC while the charge stays active after time has moved. Cold is not active and not collected. Deep ghost is collection and does not re-enter. Resurrection is phase_coherent_gates. All seven must pass. A dead path that reaches deep is appended once through dpa_195. A rewrite is rejected. An erase is rejected. Codex 0.5, 0.6, and 0.3 cuts are log-only. C_min stays 0.87. Echo stays 0.85. No LLM.';
  const TS = '2026-10-30T17:00:00Z';
  const ORDER = ['hot', 'warm', 'cold', 'deep_ghost'];
  const LABELS = { hot: 'Hot', warm: 'Warm (SPC)', cold: 'Cold', deep_ghost: 'Deep ghost loop' };
  const CLOCK_HOURS = [0, 168, 600, 800];
  const INTERNAL = {
    codex_spc_write: 0.5,
    codex_cold_entropy: 0.6,
    codex_resurrect_entropy: 0.3,
    codex_long_term_drift: 0.3,
    logged_only: true,
    admit: false,
    cite: 'Gilligan Codex 3.3, 3.6, 3.7, 3.15. These cuts do not move a tier and do not admit.'
  };

  function flags() {
    return {
      admit_gate: false,
      writes: false,
      calls_llm: false,
      money: false,
      dream_idle: false,
      economy: false,
      packs_gated: true,
      christping: 'gilligan-only',
      wikipedia_anchor: false,
      c_min: C_MIN,
      echo_min: ECHO_MIN,
      internal: INTERNAL
    };
  }
  function reject(rule) {
    return Object.assign({ ok: false, rule: rule }, flags());
  }
  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function tierAt(c0, hours) {
    const h = num(hours);
    const base = num(c0);
    if (h === null || base === null) return reject('TIER-CLOCK');
    if (h < 0 || base < 0) return reject('TIER-CLOCK-REWIND');
    const charge = Gen.spcCharge(base, h);
    const active = Gen.spcActive(charge) === true;
    const collected = Gen.spcGc(charge) === true;
    let name;
    if (collected) name = 'deep_ghost';
    else if (!active) name = 'cold';
    else if (h <= 0) name = 'hot';
    else name = 'warm';
    return Object.assign({
      ok: true,
      rule: 'TIER-READ',
      tier: name,
      label: LABELS[name],
      charge: charge,
      hours: h,
      c0: base,
      active: active,
      gc: collected,
      half_life_hours: Gen.HALF_LIFE_HOURS,
      cite: CITE
    }, flags());
  }
  function emptyStore() {
    return { schema: 'FORGE-TIERS/v1', items: [], moves: [], archive: Dpa.emptyArchive() };
  }
  function find(store, ident) {
    for (let i = 0; i < store.items.length; i++) if (store.items[i].id === ident) return store.items[i];
    return null;
  }
  function step(body) {
    if (body.from == null && body.to == null) return null;
    return { from: body.from, to: body.to };
  }
  function place(store, spec) {
    const body = spec || {};
    if (!body.id) return reject('TIER-FIELDS');
    if (find(store, String(body.id))) return reject('TIER-REWRITE-REJECTED');
    const base = num(body.c0 == null ? 1 : body.c0);
    if (base === null || base < 0) return reject('TIER-CHARGE');
    const gate = Dpa.classify(body.epsilon_s, step(body));
    const read = tierAt(base, 0);
    const item = {
      id: String(body.id),
      c0: base,
      hours: 0,
      charge: read.charge,
      tier: read.tier,
      epsilon_s: body.epsilon_s,
      phase: body.phase,
      psi: body.psi,
      ts: body.ts,
      entropy: body.entropy,
      from: body.from == null ? null : body.from,
      to: body.to == null ? null : body.to,
      dead: gate.dead,
      sealed: false,
      seal_rule: null
    };
    store.items.push(item);
    store.moves.push({ id: item.id, hours: 0, tier: item.tier, charge: item.charge });
    return Object.assign({
      ok: true,
      rule: 'TIER-PLACED',
      tier: item.tier,
      label: LABELS[item.tier],
      charge: item.charge,
      hours: 0,
      dead: item.dead,
      write_allowed: !item.dead,
      spc_above_0_5: gate.spc_above_0_5,
      spc_logged_only: true,
      cite: CITE
    }, flags());
  }
  function seal(store, item) {
    if (item.psi == null || item.ts == null || item.entropy == null || item.phase == null) {
      item.seal_rule = 'TIER-UNSEALED';
      return 'TIER-UNSEALED';
    }
    const spec = {
      id: item.id,
      psi: item.psi,
      phase: item.phase,
      ts: item.ts,
      entropy: item.entropy,
      epsilon_s: item.epsilon_s,
      reason: 'deep-ghost'
    };
    if (item.from != null) spec.from = item.from;
    if (item.to != null) spec.to = item.to;
    const result = Dpa.appendDeadPath(store.archive, spec);
    if (result.ok) item.sealed = true;
    item.seal_rule = result.rule;
    return result.rule;
  }
  function advance(store, ident, hours) {
    const item = find(store, String(ident));
    if (!item) return reject('TIER-UNKNOWN');
    const h = num(hours);
    if (h === null) return reject('TIER-CLOCK');
    if (h < item.hours) {
      return Object.assign(reject('TIER-CLOCK-REWIND'), { tier: item.tier, hours: item.hours });
    }
    const read = tierAt(item.c0, h);
    const moved = read.tier !== item.tier;
    item.hours = h;
    item.charge = read.charge;
    if (moved) {
      item.tier = read.tier;
      store.moves.push({ id: item.id, hours: h, tier: item.tier, charge: item.charge });
    }
    let sealRule = null;
    if (item.tier === 'deep_ghost') sealRule = seal(store, item);
    return Object.assign({
      ok: true,
      rule: moved ? 'TIER-MOVED' : 'TIER-HELD',
      tier: item.tier,
      label: LABELS[item.tier],
      charge: item.charge,
      hours: h,
      moved: moved,
      active: read.active,
      gc: read.gc,
      dead: item.dead,
      write_allowed: !item.dead,
      seal_rule: sealRule,
      archive_n: store.archive.dead_paths.length,
      cite: CITE
    }, flags());
  }
  function eraseItem(store, ident) {
    const gone = Dpa.erase();
    return Object.assign(reject('TIER-ERASE-REJECTED'), {
      archive_rule: gone.rule,
      kept: store.items.length,
      id: ident == null ? null : ident
    });
  }
  function passingRecord() {
    return {
      phase: 9,
      noise_floor: 0.1,
      chi_threshold: 0.4,
      identity: 'psi-sky',
      resurrection_log_valid: true,
      cycle_count: 1,
      resurrection_limit: 3,
      capacity_ok: true,
      active_drift: false
    };
  }
  function resurrect(record, tier) {
    const gates = Gates.phaseCoherentResurrection(record || {});
    const failed = gates.gates.filter(function (g) { return !g.pass; }).map(function (g) { return g.id; });
    const row = Object.assign({
      gate_ok: gates.ok === true,
      gate_count: gates.gates.length,
      passed: gates.gates.filter(function (g) { return g.pass; }).length,
      failed: failed,
      gates: gates.gates,
      tier: tier,
      cite: gates.cite,
      module_cite: CITE
    }, flags());
    if (tier === 'deep_ghost') { row.ok = false; row.rule = 'TIER-DEEP-NO-REENTRY'; return row; }
    if (tier === 'hot') { row.ok = false; row.rule = 'TIER-HOT-ACTIVE'; return row; }
    if (tier !== 'warm' && tier !== 'cold') { row.ok = false; row.rule = 'TIER-UNKNOWN'; return row; }
    row.ok = gates.ok === true;
    row.rule = gates.ok ? 'TIER-RESURRECTED' : 'TIER-GATES-FAILED';
    return row;
  }
  function body(ident, epsilon, phase, psi, extra) {
    return Object.assign({
      id: ident, c0: 1, epsilon_s: epsilon, phase: phase, psi: psi, ts: TS, entropy: 0.2
    }, extra || {});
  }
  function clockDemo() {
    const store = emptyStore();
    place(store, body('sky', 0.2, 9, 'psi-sky'));
    const rows = CLOCK_HOURS.map(function (h) { return advance(store, 'sky', h); });
    const rewind = advance(store, 'sky', 100);
    const gone = eraseItem(store, 'sky');
    const again = place(store, body('sky', 0.2, 9, 'psi-sky'));
    const loud = emptyStore();
    const hot = place(loud, body('loud', 0.55, 1, 'psi-loud'));
    return Object.assign({
      tiers: rows.map(function (r) { return r.tier; }),
      hours: CLOCK_HOURS.slice(),
      labels: rows.map(function (r) { return r.label; }),
      moves: store.moves.map(function (m) { return m.tier; }),
      half_charge: rows[1].charge,
      active: rows.map(function (r) { return r.active; }),
      gc: rows.map(function (r) { return r.gc; }),
      clock_seal: rows[3].seal_rule,
      rewind_rule: rewind.rule,
      rewind_tier: rewind.tier,
      erase_rule: gone.rule,
      archive_rule: gone.archive_rule,
      kept: gone.kept,
      rewrite_rule: again.rule,
      length: store.items.length,
      loud_tier: hot.tier,
      loud_dead: hot.dead,
      loud_spc: hot.spc_above_0_5,
      loud_write: hot.write_allowed,
      half_life_hours: Gen.HALF_LIFE_HOURS,
      order: ORDER.slice(),
      cite: CITE
    }, flags());
  }
  function resurrectDemo() {
    const good = passingRecord();
    const bad = Object.assign({}, good, { phase: 8 });
    const cap = Object.assign({}, good, { capacity_ok: false });
    const warm = resurrect(good, 'warm');
    const cold = resurrect(good, 'cold');
    const deep = resurrect(good, 'deep_ghost');
    const hot = resurrect(good, 'hot');
    const fail = resurrect(bad, 'warm');
    const capacity = resurrect(cap, 'warm');
    return Object.assign({
      warm_ok: warm.ok,
      warm_rule: warm.rule,
      warm_passed: warm.passed,
      warm_count: warm.gate_count,
      warm_failed: warm.failed,
      cold_ok: cold.ok,
      cold_rule: cold.rule,
      cold_passed: cold.passed,
      deep_ok: deep.ok,
      deep_rule: deep.rule,
      deep_gate_ok: deep.gate_ok,
      deep_passed: deep.passed,
      hot_ok: hot.ok,
      hot_rule: hot.rule,
      fail_ok: fail.ok,
      fail_rule: fail.rule,
      fail_failed: fail.failed,
      capacity_ok: capacity.ok,
      capacity_failed: capacity.failed,
      cite: CITE
    }, flags());
  }
  function deepDemo() {
    const store = emptyStore();
    const early = place(store, body('row-36', 0.36, 1, 'psi-36'));
    const late = advance(store, 'row-36', 800);
    const again = advance(store, 'row-36', 900);
    const checked = Dpa.verifyArchive(store.archive);
    const calm = emptyStore();
    place(calm, body('row-35', 0.35, 1, 'psi-35'));
    const calmLate = advance(calm, 'row-35', 800);
    const skipStore = emptyStore();
    place(skipStore, body('row-58', 0.1, 8, 'psi-58', { from: 5, to: 8 }));
    const skipEarly = advance(skipStore, 'row-58', 0);
    const skipLate = advance(skipStore, 'row-58', 800);
    const gone = eraseItem(store, 'row-36');
    return Object.assign({
      early_tier: early.tier,
      early_dead: early.dead,
      early_write: early.write_allowed,
      late_tier: late.tier,
      seal_rule: late.seal_rule,
      again_rule: again.seal_rule,
      archive_n: again.archive_n,
      chain_ok: checked.ok,
      phase_name: store.archive.dead_paths[0].phase_name,
      calm_tier: calmLate.tier,
      calm_rule: calmLate.seal_rule,
      calm_n: calmLate.archive_n,
      calm_dead: calmLate.dead,
      skip_early_tier: skipEarly.tier,
      skip_dead: skipEarly.dead,
      skip_tier: skipLate.tier,
      skip_rule: skipLate.seal_rule,
      skip_phase: skipStore.archive.dead_paths[0].phase_name,
      skip_n: skipStore.archive.dead_paths.length,
      erase_rule: gone.archive_rule,
      tier_erase: gone.rule,
      kept: gone.kept,
      hard_stop_81: Dpa.classify(0.81).hard_stop,
      hard_stop_80: Dpa.classify(0.8).hard_stop,
      dead_80: Dpa.classify(0.8).dead,
      dead_35: Dpa.classify(0.35).dead,
      dead_36: Dpa.classify(0.36).dead,
      spc_51: Dpa.classify(0.51).spc_above_0_5,
      cite: CITE
    }, flags());
  }
  function stage(epsilon) {
    const gate = Dpa.classify(epsilon, null);
    const now = tierAt(1, 0);
    const half = tierAt(1, Gen.HALF_LIFE_HOURS);
    return Object.assign({
      tier: now.tier,
      half_tier: half.tier,
      half_life_hours: Gen.HALF_LIFE_HOURS,
      dead: gate.dead,
      spc_above_0_5: gate.spc_above_0_5,
      spc_logged_only: true,
      resurrect_rule: 'TIER-RESURRECTED',
      deep_rule: 'TIER-DEEP-NO-REENTRY',
      order: ORDER.slice(),
      cite: CITE
    }, flags());
  }
  function monitorLines(mode) {
    if (mode === 'gates') {
      const row = resurrectDemo();
      return {
        attrs: { mode: 'gates', status: row.warm_rule, detail: row.warm_passed + '/7' },
        lines: [
          'Warm resurrection ' + row.warm_rule + '. Gates passed ' + row.warm_passed + ' of 7.',
          'Cold storage resurrection ' + row.cold_rule + '. Gates passed ' + row.cold_passed + ' of 7.',
          'A phase of 8 fails ' + row.fail_failed[0] + '. Rule ' + row.fail_rule + '.',
          'Deep ghost loop is ' + row.deep_rule + '. The seven gates still ran.',
          'Hot is ' + row.hot_rule + '. It is not stored.',
          'This card does not write memory. dream_idle stays off. No LLM.'
        ]
      };
    }
    if (mode === 'deep') {
      const row = deepDemo();
      return {
        attrs: { mode: 'deep', status: row.again_rule, detail: 'n-' + row.archive_n },
        lines: [
          'Drift 0.36 reaches Deep ghost loop and seals ' + row.seal_rule + '.',
          'A second seal is ' + row.again_rule + '. Archive length ' + row.archive_n + '. Chain verifies: ' + row.chain_ok + '.',
          'Drift 0.35 reaches Deep ghost loop and is ' + row.calm_rule + '.',
          'Phase 5 to phase 8 is a dead path. The sealed phase is ' + row.skip_phase + '.',
          'An erase is ' + row.erase_rule + '. The tier erase is ' + row.tier_erase + '.',
          'This card does not admit. C_min ' + C_MIN + '. No LLM.'
        ]
      };
    }
    const row = clockDemo();
    return {
      attrs: { mode: 'clock', status: row.tiers[row.tiers.length - 1], detail: row.labels[row.labels.length - 1] },
      lines: [
        row.labels[0] + ' at 0 hours. The charge is still active.',
        row.labels[1] + ' at 168 hours. Half-life charge is 0.5.',
        row.labels[2] + ' at 600 hours. The charge is not active and is not collected.',
        row.labels[3] + ' at 800 hours. The charge is collected.',
        'A rewind is ' + row.rewind_rule + '. An erase is ' + row.erase_rule + '.',
        'Drift 0.55 stays ' + row.loud_tier + ' and does not admit. Codex 0.5 is log only. No LLM.'
      ]
    };
  }
  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('tiers196');
    const host = document.getElementById('tiers196Body');
    if (!card || !host) return;
    const view = monitorLines(mode || 'clock');
    card.setAttribute('data-tiers196-mode', view.attrs.mode);
    card.setAttribute('data-tiers196-status', view.attrs.status);
    card.setAttribute('data-tiers196-detail', view.attrs.detail);
    host.textContent = view.lines.join('\n');
  }
  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('tiers196')) return;
    paintMonitor('clock');
    const buttons = document.querySelectorAll('[data-tiers196-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-tiers196-run'));
      });
    }
  }
  function run(payload) {
    const row = payload || {};
    const op = row.op || 'clock';
    if (op === 'tier') return tierAt(row.c0 == null ? 1 : row.c0, row.hours == null ? 0 : row.hours);
    if (op === 'gates') return resurrectDemo();
    if (op === 'deep') return deepDemo();
    if (op === 'stage') return stage(row.epsilon_s);
    if (op === 'monitor') return monitorLines(row.mode || 'clock');
    if (op === 'resurrect') return resurrect(row.record || passingRecord(), String(row.tier || 'warm'));
    return clockDemo();
  }
  const api = {
    CITE: CITE, ORDER: ORDER, LABELS: LABELS, CLOCK_HOURS: CLOCK_HOURS, C_MIN: C_MIN, ECHO_MIN: ECHO_MIN,
    tierAt: tierAt, emptyStore: emptyStore, place: place, advance: advance, eraseItem: eraseItem,
    passingRecord: passingRecord, resurrect: resurrect, clockDemo: clockDemo, resurrectDemo: resurrectDemo,
    deepDemo: deepDemo, stage: stage, monitorLines: monitorLines, paintMonitor: paintMonitor, run: run
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Tiers196 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
