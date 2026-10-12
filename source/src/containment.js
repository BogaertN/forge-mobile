/* containment.js — W2 RMC containment (Register E-01…E-11, D-14, G-07), ported from forge rmc_engine_v1
 * containment_router.py (Patch 265), dream_state_quarantine.py / ghost_loop_containment.py / drift_archive.py (Patch 266),
 * spc_cold_storage.py tiers and resurrection_engine.py (Patch 269, ChristPing 7 gates). Deterministic; no reply text. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Gv = isNode ? require('./governance.js') : root.KGov; const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  const hash = Gv.hash;
  const ROUTES = ['active_stack_candidate', 'correction_queue', 'spc_cold_storage_required', 'dream_state_quarantine_candidate', 'drift_archive_only', 'ghost_loop_containment_required'];
  const SEALED = new Set(['spc_cold_storage_required', 'dream_state_quarantine_candidate', 'drift_archive_only', 'ghost_loop_containment_required']);
  /* capacity failures: the runtime could not resolve the turn — not wrong, unresolved (ghost doctrine) */
  const CAPACITY_KINDS = new Set(['no_frame', 'clarify_unknown', 'clarify_echo']);
  const CORRECTION_KINDS = new Set(['clarify_readings', 'clarify_ambiguous', 'clarify_referent', 'clarify_incomplete', 'confirm_replace', 'confirm_forget', 'replaced', 'kept', 'forgotten', 'forget_kept']);
  /* ROUTING LAW (containment_router.py): circuit breaker → SPC (priority); ghost pressure → ghost; must_archive → SPC; dream eligible → dream;
     correction required → correction queue; active; fallback → drift archive.  Exactly one route fires. */
  function route(p) {
    const f = []; let r;
    const breaker = !!(p.sealed || p.forbidden_transition);
    const ghost = !breaker && (CAPACITY_KINDS.has(p.kind) || p.derivation_failed || p.echo_failed);
    const dream = !!p.dream; const elevated = p.band === 'elevated' && !!p.would_write;
    if (breaker) { r = 'spc_cold_storage_required'; f.push(p.sealed ? 'CR-CIRCUIT-BREAKER-HARD-STOP' : 'CR-PHASE-VIOLATION ' + p.forbidden_transition); }
    else if (ghost) { r = 'ghost_loop_containment_required'; f.push('CR-GATE7-CAPACITY ' + (p.derivation_failed ? 'derivation' : p.echo_failed ? 'echo' : p.kind)); }
    else if (dream) { r = 'dream_state_quarantine_candidate'; f.push('CR-DREAM-ELIGIBLE'); }
    else if (elevated) { r = 'drift_archive_only'; f.push('CR-DRIFT-ELEVATED-ARCHIVE'); }
    else if (p.restricted) { r = 'correction_queue'; f.push('CR-CHI-CORRECTION'); }
    else if (CORRECTION_KINDS.has(p.kind)) { r = 'correction_queue'; f.push('CR-CORRECTION-REQUIRED'); }
    else if (p.kind) { r = 'active_stack_candidate'; f.push('CR-ACTIVE'); }
    else { r = 'drift_archive_only'; f.push('CR-FALLBACK'); }
    return { route: r, sealed: SEALED.has(r), may_project: !SEALED.has(r), cause: p.sealed ? 'hard_stop' : p.forbidden_transition ? 'forbidden_transition' : p.derivation_failed ? 'derivation_failed' : p.echo_failed ? 'echo_failed' : null, may_write_memory: r === 'active_stack_candidate' || r === 'correction_queue', rules: f, cite: 'forge rmc_engine_v1/containment_router.py (Patch 265)' };
  }

  /* ---- active-loop lifecycle (D-14 / G-07); transition table is ours — the docs name the states but not the edges (flagged) ---- */
  const LOOP_EDGES = { active: ['paused', 'collapsed', 'closed'], paused: ['active', 'closed'], collapsed: ['quarantined'], quarantined: ['resurrected', 'closed'], resurrected: ['active', 'closed'], closed: [] };
  const TIERS = { WARM: 'resurrection eligible (ChristPing 7 gates)', COLD: 'forensic only', DEEP: 'permanently sealed' };
  const LIMIT = 5, CAPACITY = 0.75;

  function Containment(store, opts) {
    opts = opts || {}; const now = () => (opts.clock ? opts.clock() : new Date().toISOString()); const perm = opts.perm;
    const L = () => { const v = store.load('loops'); return Array.isArray(v) ? v : []; };
    function receipt(kind, body) { const l = store.load('containment_receipts'); const prev = l.length ? l[l.length - 1].hash : null; const e = { kind, at: now(), body, prev }; e.hash = sha256(Gv.canon(e)); l.push(e); store.save('containment_receipts', l.slice(-1000)); return e; }
    function current() { let ls = L(); let a = ls.find(x => x.state === 'active' || x.state === 'paused'); if (!a) { a = { id: 'loop:' + (ls.length + 1), state: 'active', opened_at: now(), transitions: [{ to: 'active', at: now(), rule: 'LOOP-OPEN' }], predecessor: ls.length ? ls[ls.length - 1].id : null }; ls.push(a); store.save('loops', ls); receipt('loop.open', { id: a.id }); } return a; }
    function transition(id, to, why) {
      const ls = L(); const lp = ls.find(x => x.id === id); if (!lp) return { ok: false, rule: 'LOOP-UNKNOWN' };
      if (!(LOOP_EDGES[lp.state] || []).includes(to)) return { ok: false, rule: 'LOOP-ILLEGAL-TRANSITION', from: lp.state, to };
      if (perm) { const d = perm.authorize('loop.transition', { subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; }
      lp.transitions.push({ from: lp.state, to, at: now(), rule: why || 'LOOP-TRANSITION' }); lp.state = to; store.save('loops', ls); receipt('loop.transition', { id, to, why }); return { ok: true, loop: lp }; }
    function put(cat, rec) { const l = store.load(cat); l.push(rec); store.save(cat, l); const rb = Gv.readback(store, cat, rec.id, rec); receipt(cat + '.write', { id: rec.id, readback: rb.readback }); return rb; }

    /* collapse event (E-09): typed lifecycle event with a frozen causal snapshot (hashes only — no content copied) */
    function collapse(tr, cause, snapshotState) {
      const lp = current(); const ev = { id: 'collapse:' + sha256(cause + '|' + (tr.psi_id || tr.turn) + '|' + now()).slice(0, 16), at: now(), turn: tr.turn, cause, loop: lp.id,
        snapshot: { trace_hash: hash({ input: tr.input, rules: tr.rules, drift: tr.drift }), msm_hash: tr.msm ? hash(tr.msm) : null, state_hash: snapshotState ? hash(snapshotState) : null }, predecessor: tr.psi_id || null };
      const rb = put('collapse_events', ev); transition(lp.id, 'collapsed', 'LOOP-COLLAPSE (' + cause + ')'); transition(lp.id, 'quarantined', 'LOOP-SPC-QUARANTINE'); current(); return Object.assign(ev, { readback: rb.readback }); }

    /* apply a routed decision: records go to the destination store, each with a read-back receipt */
    function apply(tr, decision, extra) {
      extra = extra || {}; const lp = current(); const base = { at: now(), turn: tr.turn, loop: lp.id, route: decision.route, rules: decision.rules, msm_id: tr.msm ? tr.msm.msm_id : null };
      const out = { route: decision.route, records: [] };
      if (decision.route === 'dream_state_quarantine_candidate') out.records.push(put('dream_quarantine', Object.assign({ id: 'dream:' + (tr.msm ? tr.msm.msm_id.slice(0, 16) : tr.turn), clause: extra.clause || null, truth_support_allowed: false, stable_memory_allowed: false, projection_allowed: false, status: 'quarantined' }, base)));
      if (decision.route === 'ghost_loop_containment_required') out.records.push(put('ghost_loops', Object.assign({ id: 'ghost:' + sha256(String(tr.input) + '|' + tr.turn + '|' + now()).slice(0, 16), input: tr.input, reason: extra.reason || (tr.msm && tr.msm.meaning ? tr.msm.meaning.kind : 'unresolved'), gate_failed: '7', status: 'held for a future capability', can_reenter: false }, base)));
      if (decision.route === 'drift_archive_only' || (tr.drift && (tr.drift.band === 'elevated' || tr.drift.band === 'hard_stop')))
        out.records.push(put('drift_archive', Object.assign({ id: 'drift:' + sha256(String(tr.input) + '|' + tr.turn + '|' + now()).slice(0, 16), eps_s: tr.drift ? tr.drift.eps_s : null, band: tr.drift ? tr.drift.band : null, components: tr.drift ? tr.drift.components || null : null, diagnostic_only: true, truth_support_allowed: false }, base)));
      if (decision.route === 'spc_cold_storage_required') out.collapse = collapse(tr, extra.cause || 'circuit_breaker', extra.state);
      return out; }

    /* tier assignment (spc_cold_storage.py): breach or limit → DEEP; explicit cold → COLD; otherwise WARM */
    function tierOf(rec, policy) {
      if (rec.breach) return 'DEEP'; if ((rec.resurrection_attempts || 0) >= LIMIT) return 'DEEP';
      if (rec.record && rec.record.status === 'forgotten' && policy && policy.forgottenTier === 'COLD') return 'COLD'; return rec.tier || 'WARM'; }
    /* ChristPing 7-gate evaluation (read-only) — resurrection_engine.py */
    function gates(rec, policy) {
      const r = rec.record || null; const tier = tierOf(rec, policy); const att = rec.resurrection_attempts || 0;
      const eps = r && r.sfe ? r.sfe.eps : (rec.msm && rec.msm.drift ? rec.msm.drift.eps_s : 1);
      const path = r && r.phase_tag ? ['Φ9'] : rec.msm && rec.msm.phase ? String(rec.msm.phase.trajectory || '').split('→') : [];
      const core = r && r.clause ? { clause: r.clause, kind: r.kind } : r && r.text ? { text: r.text } : null;
      const sig = r && r.sfe ? hash({ eps: r.sfe.eps, chi: r.sfe.chi, rho: r.sfe.rho }) : null; const lineage = r ? (r.provenance && r.provenance.msm_id) || r.id : null;
      const G = [];
      G.push({ gate: 'gate_1_spc_tier_warm', pass: tier === 'WARM', detail: 'tier=' + tier });
      G.push({ gate: 'gate_2_resurrection_limit', pass: att < LIMIT, detail: 'attempts_' + att + '_of_' + LIMIT });
      G.push({ gate: 'gate_3_phi9_eligibility', pass: path.some(p => /9/.test(p)), detail: path.length ? 'phase_path ' + path.join('→').slice(0, 60) : 'no_phase_data_defer' });
      G.push({ gate: 'gate_4_invariant_core_present', pass: !!core, detail: core ? 'invariant_core_present' : 'invariant_core_absent' });
      G.push({ gate: 'gate_5_drift_signature_valid', pass: !!sig && !rec.breach, detail: !sig ? 'drift_signature_absent' : rec.breach ? 'breach' : 'signature_present_no_breach' });
      /* Gate 6 is UNDER-SPECIFIED: forge says the production comparator "requires live RPMC harmonic math"; we port its preview rule
         (signature + lineage + invariant core present, no mismatch flag ⇒ tentative MATCH) and label it so */
      const g6 = sig && lineage && core && !rec.resonance_mismatch_flag ? 'MATCH' : sig && !lineage ? 'DEFER' : rec.resonance_mismatch_flag ? 'MISMATCH' : 'DEFER';
      G.push({ gate: 'gate_6_resonance_comparator', pass: g6 === 'MATCH', verdict: g6, detail: 'preview structural comparator (under-specified: RPMC harmonic comparator not defined)' });
      const need = Math.min(1, (eps || 0) * 1.2); G.push({ gate: 'gate_7_system_capacity', pass: path.length <= 12 && CAPACITY >= need, detail: 'capacity ' + CAPACITY + ' vs required ' + need.toFixed(3) });
      let decision; const g7 = G[6].pass;
      if (tier !== 'WARM' || rec.breach || att >= LIMIT) decision = 'deep_archive_seal';
      else if (!g7) decision = 'ghost_loop_containment_required';
      else if (G.every(g => g.pass)) decision = 'resurrection_candidate';
      else decision = 'defer_until_next_phi9_window';
      return { id: rec.id, tier, gates: G, decision, cite: 'forge rmc_engine_v1/resurrection_engine.py (Patch 269)' }; }

    function list() { return { loops: L(), collapse_events: store.load('collapse_events'), dream: store.load('dream_quarantine'), ghost: store.load('ghost_loops'), drift: store.load('drift_archive'), receipts: store.load('containment_receipts') }; }
    function pause() { const lp = current(); return transition(lp.id, 'paused', 'LOOP-PAUSE (operator)'); }
    function resume() { const lp = current(); return lp.state === 'paused' ? transition(lp.id, 'active', 'LOOP-RESUME') : { ok: false, rule: 'LOOP-NOT-PAUSED' }; }
    function closeAndOpen(why) { const lp = current(); const r = transition(lp.id, 'closed', why || 'LOOP-CLOSE'); current(); return r; }
    function touch() { const lp = current(); if (lp.state === 'paused') transition(lp.id, 'active', 'LOOP-RESUME (new turn)'); return current(); }
    function verifyReceipts() { const l = store.load('containment_receipts'); let prev = null; for (let i = 0; i < l.length; i++) { const e = Object.assign({}, l[i]); const h = e.hash; delete e.hash; if (e.prev !== prev || sha256(Gv.canon(e)) !== h) return { ok: false, broken_at: i }; prev = h; } return { ok: true, count: l.length }; }
    return { route, apply, collapse, transition, current, touch, pause, resume, closeAndOpen, gates, tierOf, list, verifyReceipts, receipt };
  }
  const api = { route, Containment, ROUTES, SEALED, LOOP_EDGES, TIERS, LIMIT, CAPACITY };
  if (isNode) module.exports = api; else root.KContain = api;
})(this);
