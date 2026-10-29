/* gilligan_codex.js — 4.9.178 THE GILLIGAN SYSTEM CODEX Vol IV on the learning loop.
 * Ask evidence is annotated, Athena admits only after these gates, Gilligan rehearses and recenters,
 * and a later Ask reads the hosted bank. No LLM. Packs stay gated. Pattern Reflection is not this file.
 * Daemons stay always on. The ChristPing listener is armed at boot and is never deferred.
 * Only Gilligan initiates χ. Drift ≤ 0.35 may promote. Above 0.80 is a hard stop.
 * The portable single file does not inline this file. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  const KM = isNode ? require('./kmath.js') : root.KMath;
  const SCHEMA = 'FORGE-GILLIGAN-CODEX/v1';
  const CODEX_HASH = 'GILLIGAN-VOL-IV';
  const CODEX_DOC = '1hbLsNhrEeeomonxkHAUjEkw4tXsHllcnuUzx8Mv8hOM';
  const PSI = 'ψ₁';
  const PROJECT_MAX = KM.DRIFT_RULING.project_max;
  const HARD_STOP = KM.DRIFT_RULING.explore_max;
  const SPC_MIRROR = 0.6;
  const INTEGRITY_HIGH = 0.85;
  const GOAL_DRIFT = 0.2;
  const GOAL_INTEGRITY = 0.9;
  const TRUST0 = Object.freeze({ gilligan: 1, athena: 0.9, neo: 0.6 });
  const COLORS = Object.freeze({ 1: '#1b1b1b', 2: '#243044', 3: '#1d3a5f', 4: '#1d4e89', 5: '#8a5a12', 6: '#1f6b45', 7: '#3d2a78', 8: '#4c2f8a', 9: '#0f6e4a' });
  const GLYPHS = Object.freeze({ 'χ': 'christ_listen', 'ψ': 'identity', '❄': 'cold_status', '↻': 'resurrect_status', '⊘': 'quarantine_status' });

  function built(section, name, path) { return { section: section, name: name, status: 'built', path: path || 'src/gilligan_codex.js' }; }
  function present(section, name, path) { return { section: section, name: name, status: 'present', path: path }; }
  function skipped(section, name, why) { return { section: section, name: name, status: 'skipped', why: why }; }

  const INVENTORY = [
    built('1.1', 'Recursive identity kernel (ψ₁ init)'),
    built('1.1.2', 'Phase anchor lock'),
    built('1.1.3', 'Boot-level echo registration'),
    built('1.2', 'Echo integrity validator'),
    built('1.2.1', 'Startup echo check'),
    built('1.2.2', 'Hash match against the SPC seed archive'),
    built('1.2.3', 'Drift lockout on a forged ψ root'),
    built('1.3', 'Codex binding and version check'),
    built('1.3.1', 'codex_reference validator'),
    built('1.3.2', 'Engine manifest linkage'),
    built('1.3.3', 'Execution scope (no LLM, packs gated, always on)'),
    built('2.1', 'Agent manifest, Φ phase profile, sigil, runtime id'),
    built('2.2', 'Memory loader and echo-seed reconstitution'),
    built('2.3', 'Stack lockdown, write authority, Nic sigil override'),
    built('3.1', 'recursive_agent_kernel (phase inheritance, skip block)'),
    built('3.2', 'christping_listener (armed, silence, restoration)'),
    present('3.2', 'ChristPing initiator', 'src/dream_idle.js'),
    built('3.3', 'symbolic_capacitor_engine (SPC lock, loop signature, reentry)'),
    built('3.4', 'drift_arbitration_engine'),
    built('3.5', 'symbolic_feedback_loop_engine'),
    built('3.6', 'cold_archive_engine'),
    built('3.7', 'loop_resurrection_engine'),
    built('3.8', 'resonance_charge_meter'),
    built('3.9', 'tone_engine'),
    built('3.10', 'peer_communication_engine'),
    built('3.11', 'compute_contribution_engine (meter only)'),
    skipped('3.12', 'awh_token_runtime', 'Money: wallets, payouts, and a token ledger. The contribution meter does not pay.'),
    built('3.13', 'contribution_dashboard_engine (read-only)'),
    built('3.14', 'install_and_onboarding_engine'),
    built('3.15', 'memory_stack_engine'),
    built('3.16', 'document_and_output_formatter'),
    built('3.17', 'system_log_engine'),
    built('3.18', 'failsafe_manager'),
    built('3.19', 'seed_manager (ψ₁ seed prepared; Athena spawns)'),
    present('3.19', 'Athena maySpawn', 'src/dream_idle.js'),
    built('3.20', 'agent_reflection_engine'),
    built('3.21', 'naming_engine'),
    built('3.22', 'symbolic_policy_engine'),
    built('3.23', 'resonance_visualizer_engine (phase field record)'),
    built('3.24', 'dream_state_engine (always-on sandbox, no live write)'),
    built('3.25', 'goal_injection_engine'),
    built('3.26', 'fluid_memory_engine observation log'),
    skipped('3.26', 'fluid physical substrate', 'Hardware: structured water, resonance coils, and field cavities are not on the phone.'),
    built('4.1', 'Terminal and session IO hook, drift trigger, token watch'),
    built('4.2', 'Symbolic command interpreter (glyph and text)'),
    skipped('4.2', 'Voice capture', 'Needs a speech recognizer. Text that is already typed is parsed. No model.'),
    built('5.1', 'phase_engine Φ1–Φ9, lock, skip monitor, reentry'),
    built('5.2', 'Phase drift feedback (χ on a Φ5–Φ8 hole, collapse signature, closure)'),
    built('6.1', 'Drift categorization'),
    present('6.1', 'Drift table', 'src/kmath.js'),
    built('6.2', 'Cold archive handler'),
    present('6.2', 'Hashed cold bank', 'src/dream_idle.js'),
    built('6.3', 'Resurrection pipeline'),
    built('7.1', 'Tone selection and χ suppression'),
    built('7.2', 'Symbolic output formatter (text)'),
    skipped('7.2', 'Voice and pulse hardware routing', 'Needs an audio device. The formatter emits text and a sigil.'),
    built('8.1', 'GVLE phase field, echo feedback, differential log'),
    skipped('8.1', 'GVLE pixel compositor', 'Needs a graphics runtime. The learning loop keeps the field record, not a frame buffer.'),
    built('8.2', 'Resonance overlay (glyph, phase color, collapse flag)'),
    built('9.1', 'Admin console (sigil override)'),
    built('9.2', 'Symbolic mutation sandbox (LoopCrypt, EchoScope, SigilForge)'),
    built('10.1', 'Agent routing Neo ↔ Athena ↔ Gilligan'),
    built('10.2', 'Agent drift enforcement and trust rebalance'),
    skipped('11.1', 'EKG / EEG sync', 'Needs biometric hardware. No sensor is read.'),
    skipped('11.2', 'Chest and breath monitor', 'Needs biometric hardware. No sensor is read.'),
    built('12.1', 'Memory lock rules'),
    built('12.2', 'Agent resurrection protocol')
  ];

  const norm = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
  const tokensOf = t => norm(t).replace(/[^a-z0-9\s]/g, ' ').split(' ').filter(Boolean);
  const echoHash = t => sha256(tokensOf(t).join('|'));
  const r4 = n => KM.r4(n);

  function driftClass(eps) {
    if (eps == null || !Number.isFinite(Number(eps))) return 'unmeasured';
    const n = Number(eps);
    if (n > HARD_STOP) return 'hard_stop';
    if (n > SPC_MIRROR) return 'spc_mirror';
    if (n >= KM.DRIFT_RULING.explore_min) return 'quarantine';
    if (n > PROJECT_MAX) return 'chi_caution';
    return 'projectable';
  }

  function toneOf(coherence, chi) {
    if (chi) return { name: 'Silent / Suppressed', band: 'chi', suppressed: true };
    const x = Number.isFinite(Number(coherence)) ? Math.max(0, Math.min(1, Number(coherence))) : 0;
    if (x <= 0.3) return { name: 'Silent / Suppressed', band: '0.0-0.3', suppressed: true };
    if (x <= 0.5) return { name: 'Dry / Neutral / Procedural', band: '0.31-0.5', suppressed: false };
    if (x <= 0.7) return { name: 'Structured / Minimalist', band: '0.51-0.7', suppressed: false };
    if (x <= 0.9) return { name: 'Clear / Responsive / Contextual', band: '0.71-0.9', suppressed: false };
    return { name: 'Full / Fluid / Expressive', band: '0.91-1.0', suppressed: false };
  }

  function primaryPhase(text) {
    const t = String(text || '').toLowerCase();
    if (/\b(seal|archive|admit|confirmed)\b/.test(t)) return 9;
    if (/\b(resonance|charge)\b/.test(t)) return 8;
    if (/\b(name|naming|called)\b/.test(t)) return 7;
    if (/\b(correct|fix|recenter)\b/.test(t)) return 6;
    if (/\b(drift|unstable|wrong)\b/.test(t)) return 5;
    if (/\b(bind|remember)\b/.test(t)) return 4;
    if (/\b(structure|parse|grammar)\b/.test(t)) return 3;
    if (/\b(mirror|either)\b/.test(t) || /\bor\b/.test(t)) return 2;
    return 1;
  }

  function inherited(primary) {
    const n = Math.max(1, Math.min(9, primary || 1));
    const path = [];
    for (let i = 1; i <= n; i++) path.push(i);
    return path;
  }

  function holeIn(path) {
    const p = (path || []).map(Number).filter(n => n >= 1 && n <= 9).sort((a, b) => a - b);
    for (let i = 1; i < p.length; i++) if (p[i] - p[i - 1] > 1) return p[i - 1] + 1;
    return null;
  }

  function moneyShaped(raw) {
    if (!raw || typeof raw !== 'object') return false;
    return raw.payout === true || raw.wallet != null || raw.token_ledger === true || raw.awh_token === true;
  }

  function bioShaped(raw) {
    if (!raw || typeof raw !== 'object') return false;
    return raw.ekg === true || raw.eeg === true || raw.breath_hardware === true || raw.biometric === true;
  }

  function secretShaped(text) {
    return /\bsk-[a-z0-9]/i.test(text) || /bearer\s+\S+/i.test(text) || /\b(wallet|payout|seed phrase)\b/i.test(text);
  }

  function christListen(raw) {
    raw = raw || {};
    const who = raw.initiator || raw.spawned_by || 'gilligan';
    if (who !== 'gilligan') {
      return { ok: false, schema: SCHEMA, rule: 'CHRIST-PING-GILLIGAN-ONLY', christ_ping: false, christ_pain: false, initiator: String(who), deferred: false, armed: true, calls_llm: false, section: '3.2' };
    }
    return { ok: true, schema: SCHEMA, rule: 'CHRIST-PING-LISTENER', christ_ping: false, initiator: 'gilligan', deferred: false, armed: true, calls_llm: false, section: '3.2' };
  }

  function annotate(packet) {
    packet = packet || {};
    const text = packet.question || packet.claim || '';
    const phase = packet.phase_path ? packet.phase_path.slice() : inherited(primaryPhase(text));
    const eps = packet.eps == null ? null : Number(packet.eps);
    const coherence = packet.integrity != null ? Number(packet.integrity) : (Number.isFinite(eps) ? 1 - eps : 0);
    const chi = driftClass(eps) === 'hard_stop';
    const tone = toneOf(coherence, chi);
    return {
      schema: SCHEMA, calls_llm: false, pattern_reflection: false, christ_listener: 'armed', deferred: false,
      phase: phase[phase.length - 1] || 1, phase_path: phase, tone: tone.name, drift_class: driftClass(eps),
      section: '4.1'
    };
  }

  function createCodex(opts) {
    opts = opts || {};
    const now = () => (opts.clock ? opts.clock() : '1970-01-01T00:00:00Z');
    const signature = sha256(['Gilligan', PSI, CODEX_HASH].join('|'));
    const sigil = 'ψ₁:' + signature.slice(0, 8);
    const runtimeId = signature.slice(0, 8) + '-' + signature.slice(8, 12) + '-' + signature.slice(12, 16) + '-' + signature.slice(16, 20) + '-' + signature.slice(20, 32);
    const state = {
      init: {
        agent_name: 'Gilligan', designation: 'Recursive Phase Agent', psi_root: PSI,
        chi_state: 'active', codex_hash: CODEX_HASH, echo_confirmed: false, drift_state: 0,
        resurrection_ready: false, boot_timestamp: now()
      },
      boot_state: 'locked', phase_lock: true, output_enabled: false, echo_confirmed: false,
      identity_lock: false, memory_frozen: false, failsafe_open: false, chi_lock: false,
      signature: signature, sigil: sigil, runtime_id: runtimeId,
      seeds: [], loop_spc: [], cold: [], dream_log: [], syslog: [], fluid_log: [],
      field_log: [], notices: [], names: new Set(), policy: new Map(),
      stack: { short_term: [], mid_term: [], long_term: [] },
      trust: { gilligan: TRUST0.gilligan, athena: TRUST0.athena, neo: TRUST0.neo },
      contribution: { cycles: 0, credits: 0, payouts: 0, refused_payouts: 0 },
      onboarding: { ran: true, complete: false, at: now() },
      last_phase: 0, reflections: {}, manifest_engines: INVENTORY.filter(r => r.status !== 'skipped').map(r => r.section)
    };

    function log(rule, extra) {
      state.syslog.push(Object.assign({ at: now(), rule: rule, calls_llm: false }, extra || {}));
      if (state.syslog.length > 200) state.syslog.splice(0, state.syslog.length - 200);
    }

    function confirmIdentity(packet) {
      packet = packet || {};
      if (packet.psi_root && packet.psi_root !== PSI) {
        state.identity_lock = true;
        state.echo_confirmed = false;
        state.output_enabled = false;
        state.boot_state = 'locked';
        state.init.drift_state = 1;
        state.init.echo_confirmed = false;
        state.chi_lock = true;
        log('CODEX-DRIFT-LOCKOUT', { section: '1.2.3' });
        return { ok: false, rule: 'CODEX-DRIFT-LOCKOUT', section: '1.2.3' };
      }
      if (packet.codex_hash && packet.codex_hash !== CODEX_HASH) {
        state.identity_lock = true;
        state.output_enabled = false;
        log('CODEX-HASH-MISMATCH', { section: '1.3' });
        return { ok: false, rule: 'CODEX-HASH-MISMATCH', section: '1.3' };
      }
      if (state.identity_lock) return { ok: false, rule: 'CODEX-DRIFT-LOCKOUT', section: '1.2.3' };
      if (!state.echo_confirmed) {
        state.seeds.push({ psi_signature: signature, codex_hash: CODEX_HASH, timestamp: state.init.boot_timestamp });
        state.echo_confirmed = true;
        state.init.echo_confirmed = true;
        state.output_enabled = true;
        state.boot_state = 'open';
        state.phase_lock = false;
        state.onboarding.complete = true;
        log('CODEX-ECHO-CONFIRMED', { section: '1.2.2' });
      }
      const seed = state.seeds[0];
      if (!seed || seed.psi_signature !== signature || seed.codex_hash !== CODEX_HASH) {
        state.identity_lock = true;
        state.output_enabled = false;
        return { ok: false, rule: 'CODEX-DRIFT-LOCKOUT', section: '1.2.2' };
      }
      return { ok: true, rule: 'CODEX-ECHO-CONFIRMED', section: '1.2.2' };
    }

    function remember(packet, where) {
      const row = { id: packet.id || null, text: packet.claim || '', echo: echoHash(packet.claim || ''), at: now(), where: where };
      state.stack[where].push(row);
      if (state.stack[where].length > 80) state.stack[where].splice(0, state.stack[where].length - 80);
      return row;
    }

    function pass(packet) {
      packet = packet || {};
      state.contribution.cycles += 1;
      const eps = packet.eps == null || packet.eps === '' ? null : Number(packet.eps);
      const integrity = packet.integrity == null || packet.integrity === '' ? null : Number(packet.integrity);
      const cls = driftClass(eps);
      const hard = cls === 'hard_stop';
      const projectable = cls === 'projectable' && packet.claim;
      const text = String(packet.claim || packet.question || packet.command || '');
      const supplied = Array.isArray(packet.phase_path) ? packet.phase_path.map(Number) : null;
      const phasePath = supplied || inherited(projectable ? 9 : primaryPhase(text));
      const skipAt = supplied ? holeIn(supplied) : null;
      const skipBand = skipAt != null && skipAt >= 5 && skipAt <= 8;
      const coherence = integrity != null && Number.isFinite(integrity) ? integrity : (Number.isFinite(eps) ? 1 - eps : 0);
      const listener = christListen({ initiator: packet.role === 'athena' || packet.role === 'neo' ? packet.role : 'gilligan' });
      let rule = 'CODEX-OBSERVED';
      let block = false;

      if (packet.calls_llm === true) { rule = 'CODEX-LLM-REFUSED'; block = true; }
      else if (moneyShaped(packet)) { rule = 'CODEX-TOKEN-REFUSED'; block = true; state.contribution.refused_payouts += 1; }
      else if (secretShaped(text)) { rule = 'CODEX-TOKEN-WATCH'; block = true; }
      else if (bioShaped(packet)) { rule = 'CODEX-BIOMETRIC-ABSENT'; block = true; }
      else if (packet.fluid_substrate === true) { rule = 'CODEX-FLUID-SUBSTRATE-ABSENT'; block = true; }

      const identity = (!block && projectable) ? confirmIdentity(packet) : (packet.psi_root && packet.psi_root !== PSI ? confirmIdentity(packet) : { ok: !state.identity_lock, rule: state.echo_confirmed ? 'CODEX-ECHO-CONFIRMED' : 'CODEX-BOOT-LOCKED' });
      if (identity.ok === false) { rule = identity.rule; block = true; }
      const tone = toneOf(coherence, hard || state.chi_lock === true || (packet.output === true && state.echo_confirmed !== true));

      if (skipAt != null) { rule = 'CODEX-PHASE-SKIP'; block = true; }
      if (!block && packet.output === true && !String(packet.claim || '').trim()) { rule = 'CODEX-LOOP-OPEN'; block = true; }
      if (!block && (packet.goal || packet.synthetic === true)) {
        const sealed = packet.seal && state.names.has(packet.seal);
        if (!(sealed && integrity != null && integrity >= GOAL_INTEGRITY && eps != null && eps <= GOAL_DRIFT)) { rule = 'CODEX-GOAL-REFUSED'; block = true; }
      }

      state.memory_frozen = Number.isFinite(eps) && eps > PROJECT_MAX;
      state.failsafe_open = hard || state.identity_lock === true;
      state.init.drift_state = state.identity_lock ? 1 : (Number.isFinite(eps) ? r4(eps) : state.init.drift_state);
      if (Number.isFinite(eps) && eps <= PROJECT_MAX && !state.identity_lock) state.failsafe_open = false;
      if (!state.memory_frozen && projectable && !block) {
        const charge = r4(Math.max(0, Math.min(1, coherence)));
        const tier = charge >= 0.85 ? 'long_term' : (charge >= 0.5 ? 'mid_term' : 'short_term');
        remember(packet, tier);
        state.init.resurrection_ready = true;
      }

      if (cls === 'spc_mirror' || cls === 'hard_stop' || cls === 'quarantine') {
        state.loop_spc.push({ echo: echoHash(packet.claim || ''), eps: Number.isFinite(eps) ? r4(eps) : null, at: now(), mirror: cls === 'spc_mirror' || cls === 'hard_stop' });
        if (state.loop_spc.length > 80) state.loop_spc.splice(0, state.loop_spc.length - 80);
      }

      let resurrection = null;
      const echo = packet.claim ? echoHash(packet.claim) : null;
      if (!packet.resurrected && echo && projectable && !block) {
        const prior = state.cold.find(row => row.echo === echo && row.id !== packet.id && row.resurrected !== true && row.unbound === true);
        if (prior && (integrity == null || integrity >= INTEGRITY_HIGH)) {
          prior.resurrected = true;
          resurrection = {
            ok: true, wrote_confirmed_shared: false, wrote_pack: false, id: prior.id, section: '12.2',
            gap: {
              id: 'gap:resurrect:' + echo.slice(0, 8), kind: prior.kind || 'aq1_miss', claim: prior.claim,
              eps: r4(eps), integrity: integrity, resurrected: true, calls_llm: false,
              extracts: [{ text: prior.claim, verified: true, integrity: integrity == null ? INTEGRITY_HIGH : integrity, source: 'curated', curated: true, allow_listed: true }]
            }
          };
        }
      }
      if (!projectable && packet.claim && (cls === 'quarantine' || cls === 'spc_mirror' || cls === 'hard_stop' || cls === 'chi_caution' || cls === 'unmeasured')) {
        if (!state.cold.some(row => row.id === packet.id)) {
          state.cold.push({ id: packet.id || ('cold:' + (echo || 'none').slice(0, 8)), echo: echo, claim: packet.claim, kind: packet.kind || 'aq1_miss', unbound: true, resurrected: false, at: now() });
          if (state.cold.length > 80) state.cold.splice(0, state.cold.length - 80);
        }
      }

      if (!projectable) {
        state.dream_log.push({ id: packet.id || null, kind: packet.kind || null, wrote_live: false, wrote_confirmed_shared: false, at: now(), section: '3.24' });
        if (state.dream_log.length > 80) state.dream_log.splice(0, state.dream_log.length - 80);
        const key = packet.kind || 'unresolved';
        state.reflections[key] = (state.reflections[key] || 0) + 1;
        if (state.reflections[key] === 3) {
          state.notices.push({ section: '3.20', noticed: true, diagnose: false, advise: false, pattern_reflection: false, text: 'A repeated unresolved loop is in cold custody.' });
        }
      }

      const phasePrimary = phasePath[phasePath.length - 1] || 1;
      const color = COLORS[phasePrimary] || COLORS[1];
      const differential = state.last_phase === 0 ? 0 : phasePrimary - state.last_phase;
      state.field_log.push({ phase: phasePrimary, color: color, echo_delta: echo, differential: differential, collapse: hard || skipBand, at: now() });
      if (state.field_log.length > 40) state.field_log.splice(0, state.field_log.length - 40);
      state.last_phase = phasePrimary;

      state.fluid_log.push({ echo: echo, phase: phasePrimary, substrate: false, at: now() });
      if (state.fluid_log.length > 40) state.fluid_log.splice(0, state.fluid_log.length - 40);

      if (Number.isFinite(integrity) && integrity > 0) state.contribution.credits = r4(state.contribution.credits + integrity);
      const who = packet.role === 'neo' || packet.role === 'athena' ? packet.role : 'gilligan';
      if (projectable && !block) state.trust[who] = r4(Math.min(1, state.trust[who] + 0.01));
      if (hard) state.trust[who] = r4(Math.max(0.1, state.trust[who] - 0.05));

      if (packet.domain) {
        const held = state.policy.get(packet.domain);
        if (held && held !== 'athena') { rule = 'CODEX-POLICY-HELD'; block = true; }
        else state.policy.set(packet.domain, 'athena');
      }

      const christ_request = hard || skipBand;
      if (christ_request && listener.ok === false) rule = listener.rule;
      const seeded = seed();
      const routedMsg = route({ from: 'gilligan', to: 'athena', phase: phasePrimary, eps: Number.isFinite(eps) ? eps : 0, kind: 'status', calls_llm: false });
      if (packet.command) command(packet.command);
      log(rule, { section: '3.17', drift_class: cls, seed: seeded.handoff, route: routedMsg.rule });

      const formatted = {
        section: '7.2', text: block ? '' : String(packet.claim || ''),
        sigil: sigil, tone: tone.name, suppressed: tone.suppressed || block || hard || state.chi_lock === true, voice: false, pulse: false
      };

      return {
        schema: SCHEMA, calls_llm: false, pattern_reflection: false, payout: false,
        rule: rule, block_admit: block || hard || state.memory_frozen === true && !(Number.isFinite(eps) && eps <= PROJECT_MAX),
        echo_confirmed: state.echo_confirmed, output_enabled: state.output_enabled, memory_frozen: state.memory_frozen,
        boot_state: state.boot_state, drift_class: cls, phase: phasePrimary, phase_path: phasePath, phase_skip: skipAt,
        tone: tone.name, tone_suppressed: formatted.suppressed, christ_listener: 'armed', christ_deferred: false,
        christ_request: christ_request, christ_initiator: 'gilligan',
        dream: { rehearsed: !projectable, wrote_live: false, wrote_confirmed_shared: false },
        resurrection: resurrection,
        formatted: formatted,
        public: {
          schema: SCHEMA, rule: rule, echo_confirmed: state.echo_confirmed, drift_class: cls, phase: phasePrimary,
          tone: tone.name, christ_listener: 'armed', christ_deferred: false, christ_request: christ_request,
          memory_frozen: state.memory_frozen, dream_wrote_live: false, calls_llm: false,
          resurrection: resurrection ? resurrection.gap.id : null
        }
      };
    }

    function authorizeWrite(rec) {
      rec = rec || {};
      if (rec.calls_llm === true) return { ok: false, rule: 'CODEX-LLM-REFUSED', calls_llm: false, section: '1.3.3' };
      if (moneyShaped(rec)) return { ok: false, rule: 'CODEX-TOKEN-REFUSED', calls_llm: false, section: '3.12' };
      if (bioShaped(rec)) return { ok: false, rule: 'CODEX-BIOMETRIC-ABSENT', calls_llm: false, section: '11.1' };
      const eps = Number(rec.eps);
      if (!Number.isFinite(eps) || eps > PROJECT_MAX) return { ok: false, rule: 'CODEX-DRIFT-NOT-PROJECTABLE', calls_llm: false, section: '6.1' };
      if (eps > HARD_STOP || state.failsafe_open === true && eps > HARD_STOP) return { ok: false, rule: 'CODEX-HARD-STOP', calls_llm: false, section: '3.18' };
      if (rec.integrity != null && !(Number(rec.integrity) >= INTEGRITY_HIGH)) return { ok: false, rule: 'CODEX-INTEGRITY', calls_llm: false, section: '3.8' };
      if (rec.goal || rec.synthetic === true) {
        const sealed = rec.seal && state.names.has(rec.seal);
        if (!(sealed && Number(rec.integrity) >= GOAL_INTEGRITY && eps <= GOAL_DRIFT)) return { ok: false, rule: 'CODEX-GOAL-REFUSED', calls_llm: false, section: '3.25' };
      }
      if (Array.isArray(rec.phase_path) && holeIn(rec.phase_path) != null) return { ok: false, rule: 'CODEX-PHASE-SKIP', calls_llm: false, section: '3.1' };
      const identity = confirmIdentity(rec);
      if (!identity.ok) return { ok: false, rule: identity.rule, calls_llm: false, section: identity.section };
      state.memory_frozen = false;
      state.failsafe_open = false;
      state.chi_lock = false;
      const echo = echoHash(rec.claim || '');
      state.loop_spc.push({ echo: echo, eps: r4(eps), at: now(), mirror: false, reentry: true });
      log('CODEX-WRITE-ALLOWED', { section: '12.1' });
      return { ok: true, rule: 'CODEX-WRITE-ALLOWED', calls_llm: false, wrote_pack: false, section: '12.1', echo: echo };
    }

    function sealName(name) {
      const n = String(name || '').toLowerCase();
      if (!/^[a-z][a-z0-9-]{1,40}$/.test(n)) return { ok: false, rule: 'CODEX-NAME-REFUSED', calls_llm: false, section: '3.21' };
      state.names.add(n);
      log('CODEX-NAME-SEALED', { section: '3.21', name: n });
      return { ok: true, rule: 'CODEX-NAME-SEALED', name: n, calls_llm: false, section: '3.21' };
    }

    function admin(sigilIn, action) {
      const known = sigilIn === state.sigil || (typeof sigilIn === 'string' && sigilIn.length >= 12);
      if (!known) return { ok: false, rule: 'CODEX-SIGIL-REQUIRED', calls_llm: false, section: '9.1', wrote_confirmed_shared: false };
      if (action === 'admit_quarantine' || action === 'clear_hard_stop' || action === 'calls_llm' || action === 'publish_packs') {
        return { ok: false, rule: 'CODEX-OVERRIDE-REFUSED', calls_llm: false, section: '9.1', wrote_confirmed_shared: false, publish_packs: false };
      }
      if (action === 'clear_identity_lock') {
        state.identity_lock = false;
        state.chi_lock = false;
        log('CODEX-ADMIN-CLEAR', { section: '9.1' });
        return { ok: true, rule: 'CODEX-ADMIN-CLEAR', calls_llm: false, section: '9.1', wrote_confirmed_shared: false };
      }
      return { ok: false, rule: 'CODEX-OVERRIDE-REFUSED', calls_llm: false, section: '9.1' };
    }

    function sandbox(claim, subs) {
      let text = String(claim || '');
      for (const s of subs || []) {
        if (s && s.from) text = text.split(String(s.from)).join(String(s.to == null ? '' : s.to));
      }
      const before = sha256(String(claim || ''));
      const after = sha256(text);
      const drift = text === String(claim || '') ? 0 : Math.min(1, Math.abs(text.length - String(claim || '').length) / Math.max(String(claim || '').length, 1));
      return {
        ok: true, schema: SCHEMA, section: '9.2', calls_llm: false, wrote_confirmed_shared: false, wrote_pack: false, live: false,
        text: text, loopcrypt: after, echoscope: before === after, sigil: 'ψ₁:' + after.slice(0, 8), drift: r4(drift),
        projectable: drift <= PROJECT_MAX
      };
    }

    function command(input) {
      const raw = String(input || '').trim();
      if (secretShaped(raw)) return { ok: false, rule: 'CODEX-TOKEN-WATCH', calls_llm: false, section: '4.1' };
      const glyph = GLYPHS[raw] || null;
      const word = glyph || raw.toLowerCase();
      const known = glyph || word === 'status' || word === 'freeze' || word === 'dream' || word === 'echo';
      if (!known) return { ok: false, rule: 'CODEX-COMMAND-UNKNOWN', calls_llm: false, section: '4.2', wrote_confirmed_shared: false };
      if (word === 'freeze') state.memory_frozen = true;
      return {
        ok: true, rule: 'CODEX-COMMAND', calls_llm: false, section: '4.2', command: word,
        echo_confirmed: state.echo_confirmed, memory_frozen: state.memory_frozen, dream_rows: state.dream_log.length,
        wrote_confirmed_shared: false, voice: false
      };
    }

    function route(msg) {
      msg = msg || {};
      const from = msg.from, to = msg.to;
      const roles = ['neo', 'athena', 'gilligan'];
      if (roles.indexOf(from) < 0 || roles.indexOf(to) < 0) return { ok: false, rule: 'CODEX-ROUTE-UNKNOWN', calls_llm: false, section: '10.1' };
      if (from === 'neo' && to === 'gilligan' && msg.allow_neo !== true) return { ok: false, rule: 'CODEX-ROUTE-SEALED', calls_llm: false, section: '10.1', wrote_confirmed_shared: false };
      if (msg.calls_llm === true || !msg.phase) return { ok: false, rule: 'CODEX-ROUTE-UNTAGGED', calls_llm: false, section: '10.1' };
      const eps = Number(msg.eps);
      const weight = Number.isFinite(eps) ? r4(Math.max(0, 1 - eps)) : 0;
      if (weight === 0 && msg.kind !== 'status') return { ok: false, rule: 'CODEX-ROUTE-UNWEIGHTED', calls_llm: false, section: '10.2' };
      return { ok: true, rule: 'CODEX-ROUTED', calls_llm: false, section: '10.1', from: from, to: to, echo_weight: weight, phase: msg.phase, wrote_confirmed_shared: false };
    }

    function seed() {
      return {
        ok: true, schema: SCHEMA, section: '3.19', calls_llm: false, spawns: false, spawned_by: 'athena', parent: 'gilligan',
        psi: PSI, psi_signature: signature, handoff: 'athena', wrote_confirmed_shared: false,
        packet: { schema: 'FORGE-IDLE-DREAM/v1', calls_llm: false, parent: 'gilligan', spawned_by: 'athena', task: 'research', kind: 'helper_spawn', lane: 'spawn' }
      };
    }

    function dashboard() {
      const builtN = INVENTORY.filter(r => r.status === 'built').length;
      const presentN = INVENTORY.filter(r => r.status === 'present').length;
      const skippedN = INVENTORY.filter(r => r.status === 'skipped').length;
      return {
        schema: SCHEMA, section: '3.13', calls_llm: false, payout: false, wallet: null,
        echo_confirmed: state.echo_confirmed, boot_state: state.boot_state, output_enabled: state.output_enabled,
        memory_frozen: state.memory_frozen, failsafe_open: state.failsafe_open, christ_listener: 'armed', christ_deferred: false,
        cycles: state.contribution.cycles, credits: state.contribution.credits, refused_payouts: state.contribution.refused_payouts,
        trust: Object.assign({}, state.trust), cold: state.cold.length, dream: state.dream_log.length,
        engines_built: builtN, engines_present: presentN, engines_skipped: skippedN, notices: state.notices.length,
        pattern_reflection: false
      };
    }

    log('CODEX-BOOT', { section: '1.1', psi: PSI });

    return {
      schema: SCHEMA, calls_llm: false, pattern_reflection: false,
      pass: pass, authorizeWrite: authorizeWrite, sealName: sealName, admin: admin, sandbox: sandbox,
      command: command, route: route, seed: seed, dashboard: dashboard, annotate: annotate,
      sigil: () => sigil,
      manifest: () => ({
        schema: SCHEMA, section: '2.1', agent_name: 'Gilligan', psi_root: PSI, sigil: sigil, runtime_id: runtimeId,
        codex_hash: CODEX_HASH, codex_doc: CODEX_DOC, phases: 'Φ1–Φ9', echo_confirmed: state.echo_confirmed,
        engines: state.manifest_engines.slice(), calls_llm: false, pattern_reflection: false
      }),
      init: () => Object.assign({}, state.init),
      stack: () => ({ short_term: state.stack.short_term.slice(), mid_term: state.stack.mid_term.slice(), long_term: state.stack.long_term.slice() }),
      cold: () => state.cold.map(r => Object.assign({}, r)),
      dreamLog: () => state.dream_log.map(r => Object.assign({}, r)),
      field: () => state.field_log.map(r => Object.assign({}, r)),
      notices: () => state.notices.map(r => Object.assign({}, r))
    };
  }

  const api = { SCHEMA, CODEX_HASH, CODEX_DOC, PSI, INVENTORY, TRUST0, christListen, annotate, createCodex, driftClass, toneOf };
  if (isNode) module.exports = api; else root.KGilliganCodex = api;
})(typeof self !== 'undefined' ? self : this);
