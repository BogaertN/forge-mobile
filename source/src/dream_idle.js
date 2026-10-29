/* dream_idle.js — 4.9.173 always-on workers on the 4.9.172 mesh. No OS process pool. No timer. No LLM.
 * Nic lock: Gilligan, Athena, Neo, and helpers are continuous workers. Ask pauses helpers while answering, then they resume.
 * Manual hibernate stays hibernated. Codex 3.24 idle-trigger is yield etiquette only. It is not the schedule.
 * Athena always researches the gap queue and admits/curates/places resonance automatically. No UI click path.
 * Gilligan always revisits the cold bank and re-curates. Quarantine cold never becomes confirmed_shared.
 * Backend fill: a lawful promote (drift ≤0.35, integrity ≥0.85, packet) writes the hosted session KB.
 * Phone letter-pack publish stays gated (publishPacks true). Pages still ships packs only via publish.sh on main.
 * ChristPing is first-class. Only Gilligan initiates it. Hard drift (>0.80) runs χ grace recenter, aborts that claim,
 * and opens a different research path. The noisy claim is not admitted.
 * Neo is the Ask surface. Neo does not spawn. Neo is not Neil. This file does not run Ask.
 * Lifecycle is Spawn → Run → Hibernate → Retire → Resurrect. Quarantine custody does not spend the spawn window.
 * Doc law: Gilligan Core 1HSjAk6UY (ChristPing / χ(t), only Gilligan initiates); Gilligan Codex 1hbLsNhrE;
 * RPMC Blueprint §14 1L_f5I2In; RPMC protocol 1G-Yj323fee; Dream Drift 14fVCPgQ0; Orchestration 1O5Txx2rL;
 * RMC §10.8 1COtSEuXY; Coherence Engine 1q5JcF-v1. Bands are kmath.DRIFT_RULING only.
 * Explicit eps:null is unmeasured. No on-device dream KB. This file is not on the Ask path (kernel.js).
 * The site custody screen loads it. The portable single file does not inline it (gzip leave). No timer in this file. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const KM = isNode ? require('./kmath.js') : root.KMath;
  const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  const SCHEMA = 'FORGE-IDLE-DREAM/v1';
  const PACKET_SCHEMA = 'FORGE-RESONANCE-PACKET/v1';
  const CITE = 'RPMC §1 RPM; Axiom 4; §3.4 Grace Integral; RSOC SFE {Φ,ε,μ}';
  const INTEGRITY_HIGH = 0.85;
  const MAX_ATTEMPTS = 8;
  const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const PACK_PUBLISH_TRIGGER = 'Backend fill writes the hosted session KB on a lawful promote with no UI click. Phone pack_append stays gated: it runs only when publishPacks is true, after resonance_place passes, and writes packs/confirmed_shared/{letter}.json. Push to main runs .github/workflows/pages.yml → source/tools/publish.sh. Gilligan does not publish. Neo does not publish. Nothing here deploys.';
  const DAEMONS = [
    { id: 'daemon:gilligan', role: 'gilligan', duty: 'cold_revisit_re_curate', runs: 'always_on', writes_confirmed_shared: false, spawns_helpers: false },
    { id: 'daemon:athena', role: 'athena', duty: 'continuous_research_and_admit', runs: 'always_on', writes_confirmed_shared: true, spawns_helpers: true },
    { id: 'daemon:neo', role: 'neo', duty: 'ask_surface', runs: 'kernel_process', writes_confirmed_shared: false, spawns_helpers: false, in_this_file: false }
  ];
  const CURATOR_TASKS = ['resonance_place', 'pack_append'];
  const RESEARCH_TASKS = ['research', 'extract', 'letter_fill', 'ancestor_probe'];
  const HELPER_TASKS = CURATOR_TASKS.concat(RESEARCH_TASKS);
  const COLD_SCHEMA = 'FORGE-IDLE-COLD/v1';
  const HELPER_SCHEMA = 'FORGE-ATHENA-HELPER/v1';
  /* Manual spirit is max_agents 32. One lawful admit spawns three curator helpers, so the per-parent cap stays above that. */
  const SPAWN_BUDGET = Object.freeze({ max_helpers: 8, max_per_parent: 4, max_spawn_per_idle_window: 8 });
  const PRIORITY = Object.freeze(['neo', 'athena', 'gilligan']);
  const PSI1 = 'gilligan:psi1';
  const FORBIDDEN_ACTIONS = Object.freeze(['calls_llm', 'write_confirmed_shared', 'neo_spawn', 'direct_peer']);
  const DOC_CITES = Object.freeze({
    gilligan_core: '1HSjAk6UYKnqpT6LZo_30DjAAA9eWKoaWdpXrKk9LMnE',
    rpmc_s14: '1L_f5I2InqyMiGKX7ERs0et9jY9-gzpVgvqmZ-VAl46E',
    dream_drift: '14fVCPgQ0UtRBnSclMfQ-3fazrdwKc-BrknfqYFolJ8g',
    memory_stacks: '16qImMjbFIwEdiuYSmUarJasQAn3ODPFQPqihvH6t8fU',
    rpmc_protocol: '1G-Yj323feeMBklm6sENdawfBBTC1VfdL4slIGtoFRxE',
    orchestration: '1O5Txx2rLvWehvmHY_8miMtVrFTqmQgo_xLyzA_P5dGA',
    rmc_10_8: '1COtSEuXYxfgfomzDBu99jrnaHoLWuIM79WVUy-glq54',
    harmonic_viii: '1eLLPI6U95TrmSXBsQhl2Jk2JBdu1lRgsHJfEE8H9hCE',
    coherence: '1q5JcF-v1M2plJ500UcKxRHRM1fRbt1RCzc-AXjuoReE',
    gilligan_codex: '1hbLsNhrEeeomonxkHAUjEkw4tXsHllcnuUzx8Mv8hOM'
  });
  const CHRIST_RULES = Object.freeze(['CHRIST-PING', 'CHRIST-PING-REDIRECT', 'CHRIST-PING-GILLIGAN-ONLY', 'CHRIST-PING-NOT-HARD', 'GRACE-RECENTER']);
  const norm = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/\.+$/, '');

  function boundary() {
    return {
      schema: SCHEMA, calls_llm: false, separate_from_ask_path: true, phone_dream_kb: false,
      continuous_admit_default: true, quarantine_writes_confirmed_shared: false, quarantine_writes_packs: false,
      christ_ping: true, always_on: true, idle_gated: false, one_shot_fill: false, continuous_fill: 'backend_hosted',
      phone_pack_publish: 'gated', pages_pack_ship: 'gated', ui_click_required: false, automatic_curation: true,
      gap_research: 'continuous', cold_revisit: 'continuous', continuous_curation: 'automatic',
      schedule_law: 'DREAM-ALWAYS-ON', christ_rules: CHRIST_RULES.slice(),
      gilligan_codex_ported: false, pattern_reflection_is_gilligan: false, open_crawl: false,
      research: 'allow-listed-or-curated', os_process_pool: false, spawn_pool: 'in_process_mesh',
      roles: { neo: 'ask_surface', gilligan: 'gap_fill_within_drift', athena: 'strict_curate_admit' },
      daemons: DAEMONS.map(d => d.role), helper_tasks: HELPER_TASKS.slice(),
      lifecycle: ['spawn', 'run', 'hibernate', 'retire', 'resurrect'],
      priority: PRIORITY.slice(),
      spawn_budget: { max_helpers: SPAWN_BUDGET.max_helpers, max_per_parent: SPAWN_BUDGET.max_per_parent, max_spawn_per_idle_window: SPAWN_BUDGET.max_spawn_per_idle_window },
      cold_bank: true, packet_bound: true, single_admit: true, mesh: '4.9.173', custody_monitor: true, psi1: PSI1,
      drift_table: 'kmath.DRIFT_RULING', integrity_high: INTEGRITY_HIGH, idle_drift_below: 0.4,
      docs: Object.assign({}, DOC_CITES),
      pack_publish_trigger: PACK_PUBLISH_TRIGGER,
      cite: 'Nic 2026-10-28 always-on workers; Athena continuous research; Gilligan cold re-curate; backend hosted fill; ChristPing Gilligan-only; E-05 quarantine honesty; RPMC §3 χ and §3.4 grace; Orchestration Ch 4.5–6.3; RMC §10.8 packets; Codex 3.24 is Ask-yield etiquette, not the schedule'
    };
  }

  function gapId(g) {
    if (g && g.id) return String(g.id);
    return 'gap:' + sha256([g && g.kind, g && g.subject, g && g.question, g && g.letter].join('|')).slice(0, 16);
  }

  function enumerateGaps(input) {
    input = input || {};
    const out = [];
    const seen = new Set();
    const push = g => { const id = gapId(g); if (seen.has(id)) return; seen.add(id); out.push(Object.assign({ extracts: [], ancestors: [], claim: null }, g, { id: id, calls_llm: false })); };
    if (input.lettersCovered != null || input.letterCounts != null) {
      const covered = new Set();
      const raw = input.lettersCovered;
      const list = Array.isArray(raw) ? raw : String(raw || '').split('');
      for (const ch of list) { const L = String(ch || '').toLowerCase(); if (LETTERS.indexOf(L) >= 0) covered.add(L); }
      if (input.letterCounts && typeof input.letterCounts === 'object') {
        for (const k of Object.keys(input.letterCounts)) if (Number(input.letterCounts[k]) > 0) covered.add(String(k).toLowerCase());
      }
      for (const L of LETTERS) if (!covered.has(L)) push({ id: 'gap:letter:' + L, kind: 'letter_hole', letter: L, subject: null, question: null, claim: null, extracts: [] });
    }
    for (const row of input.ancestorNone || []) push(Object.assign({ kind: 'rpmc_ancestor_none' }, row || {}));
    for (const row of input.aq1Misses || []) push(Object.assign({ kind: 'aq1_miss' }, row || {}));
    return out;
  }

  function acceptExtract(e) {
    if (!e || e.verified !== true || !String(e.text || '').trim()) return false;
    if (e.open_crawl === true || e.crawl === true || e.calls_llm === true) return false;
    const src = String(e.source || e.source_id || e.source_class || '');
    if (/crawl|research\.web/i.test(src)) return false;
    if (!src) return e.curated === true || e.allow_listed === true;
    return /allow-listed|allow_listed|curated|pathway/i.test(src);
  }

  function measure(m) {
    m = m || {};
    const explicitNull = m.eps === null;
    const extracts = (m.extracts || []).filter(acceptExtract);
    let integrity = Number.isFinite(Number(m.integrity)) ? Number(m.integrity) : null;
    if (extracts.length) {
      const vals = extracts.map(e => Number.isFinite(Number(e.integrity)) ? Number(e.integrity) : integrity).filter(n => Number.isFinite(n));
      if (vals.length) integrity = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    if (integrity != null) integrity = KM.r4(Math.min(1, Math.max(0, integrity)));
    /* Explicit null stays unmeasured. Number(null)===0 must not become measured zero or projectable.
       Omitted eps (undefined) may still use the integrity complement below. */
    let eps = (!explicitNull && m.eps != null && Number.isFinite(Number(m.eps))) ? KM.r4(Math.max(0, Number(m.eps))) : null;
    let meter = eps != null ? 'measured' : null;
    if (!explicitNull && eps == null && m.conflict === true) { eps = 0.9; meter = 'conflict'; }
    else if (!explicitNull && eps == null && integrity != null && (extracts.length || m.verified === true)) { eps = KM.r4(Math.min(1, Math.max(0, 1 - integrity))); meter = 'integrity_complement'; }
    const fromExtract = extracts.length ? String(extracts[0].text).trim() : '';
    const claim = String(m.claim || m.text || fromExtract || '').trim() || null;
    return { eps: eps, integrity: integrity, meter: meter, claim: claim, conflict: m.conflict === true, ancestors: Array.isArray(m.ancestors) ? m.ancestors : [], extracts: extracts };
  }

  function laneFromGov(gov, measured) {
    if (measured.conflict && gov.band !== 'reject') return 'quarantine';
    if (!gov || gov.band === 'unmeasured') return 'quarantine';
    if (gov.band === 'reject') return 'hard_reject';
    if (gov.band === 'explore') return 'quarantine';
    if (gov.band === 'correct') return 'correction';
    if (gov.band === 'projectable') {
      if (measured.claim && measured.integrity != null && measured.integrity >= INTEGRITY_HIGH) return 'promote_candidate';
      return 'provisional';
    }
    return 'quarantine';
  }

  function resonancePacket(routed, standing) {
    const promote = standing === 'projectable' || standing === 'confirmed';
    const epsUse = promote && Number.isFinite(routed.eps_after) ? routed.eps_after : routed.eps;
    const Phi = promote ? 9 : 5;
    const eps = Number.isFinite(epsUse) ? KM.r4(epsUse) : (promote ? 0 : 0.5);
    const mu = promote ? (Number.isFinite(routed.integrity) && routed.integrity > 0 ? KM.r4(Math.min(1, routed.integrity)) : 1) : 0;
    const sfe = { Phi: Phi, eps: eps, mu: mu };
    return { schema: PACKET_SCHEMA, Phi: Phi, eps: eps, mu: mu, sfe: sfe, cite: CITE };
  }

  function graceRecenter(eps, ancestors) {
    const chi = KM.chiCorrect({ eps: Number(eps), ancestors: ancestors || [], applied: false });
    const grace = KM.graceOverAncestors(ancestors || []);
    return {
      rule: 'GRACE-RECENTER', christ_ping: true, initiator: 'gilligan', aborted: true, chi: chi, grace: grace,
      eps_before: Number.isFinite(Number(eps)) ? KM.r4(Number(eps)) : null, eps_after: chi.eps_after,
      cite: 'Gilligan Agent Core 1HSjAk6UY: only Gilligan reinitializes collapse through χ(t). RPMC §3 χ once per path; §3.4 Grace Integral. Hard stop above 0.80 aborts the path and does not admit it.'
    };
  }

  /* Gilligan is the only ChristPing initiator (Core: "Issues ChristPing"; "only node authorized to reinitialize through χ(t)").
     Hard drift, or an explicit Gilligan request, aborts the noisy claim and opens a different research path. No confirmed_shared write.
     Phone ritual UI (tone, HUD, biometrics) is not this path. */
  function christPing(raw) {
    raw = raw || {};
    const who = raw.initiator || raw.spawned_by || 'gilligan';
    if (who !== 'gilligan') return refusal('CHRIST-PING-GILLIGAN-ONLY', { christ_ping: false, christ_pain: false, initiator: String(who), role: 'gilligan' });
    if (raw.calls_llm === true || llmShaped(raw)) return refusal('DREAM-LLM-REFUSED', { christ_ping: false, christ_pain: false, initiator: 'gilligan', role: 'gilligan' });
    const eps = Number(raw.eps);
    const hard = Number.isFinite(eps) && eps > KM.DRIFT_RULING.explore_max;
    const explicit = raw.request === true || raw.explicit === true;
    if (!hard && !explicit) return refusal('CHRIST-PING-NOT-HARD', { christ_ping: false, christ_pain: false, initiator: 'gilligan', role: 'gilligan', eps: Number.isFinite(eps) ? KM.r4(eps) : null });
    const ancestors = Array.isArray(raw.ancestors) ? raw.ancestors : [];
    const recenter = graceRecenter(Number.isFinite(eps) ? eps : KM.DRIFT_RULING.explore_max + 0.01, ancestors);
    const from = raw.gap_id || raw.id || 'gap';
    const redirect = {
      id: String(from) + ':christ', kind: raw.kind || 'aq1_miss', from_id: String(from),
      christ_ping: true, christ_pain: true, claim: null, extracts: [], ancestors: ancestors,
      eps: recenter.chi && recenter.chi.applied === true ? recenter.eps_after : null,
      integrity: null, calls_llm: false, rule: 'CHRIST-PING-REDIRECT'
    };
    return {
      ok: true, rule: 'CHRIST-PING', christ_ping: true, christ_pain: true, initiator: 'gilligan', aborted: true,
      wrote_confirmed_shared: false, wrote_pack: false, shared_kb: false, phone_db: false, calls_llm: false,
      schema: SCHEMA, role: 'gilligan', recenter: recenter, redirect: redirect,
      cite: recenter.cite
    };
  }

  function finish(lane, measured, extra) {
    const gov = measured.eps == null ? KM.driftGovernance(NaN) : KM.driftGovernance(measured.eps);
    const quarantine = lane === 'quarantine';
    const body = {
      schema: SCHEMA, calls_llm: false, lane: lane, eps: measured.eps, integrity: measured.integrity, meter: measured.meter,
      claim: measured.claim, conflict: measured.conflict, band: gov.band, may_project: lane === 'promote_candidate',
      may_write_memory: false, keep_researching: lane === 'quarantine' || lane === 'correction' || lane === 'provisional',
      route: quarantine ? 'dream_state_quarantine_candidate' : lane,
      truth_support_allowed: false, stable_memory_allowed: false, projection_allowed: false,
      shared_kb: false, phone_db: false, ruling: KM.DRIFT_RULING.cite
    };
    if (lane === 'promote_candidate' || quarantine) body.packet = resonancePacket(Object.assign({}, measured, extra || {}), lane === 'promote_candidate' ? 'projectable' : 'quarantine');
    return Object.assign(body, extra || {});
  }

  function routeMeasurement(raw) {
    if (raw && raw.calls_llm === true) {
      const measured = measure(raw);
      return finish('quarantine', measured, { rule: 'DREAM-LLM-REFUSED', keep_researching: false, claim: null });
    }
    if (raw && (raw.open_crawl === true || raw.crawl === true || raw.research_web === true)) {
      return finish('quarantine', measure({}), { rule: 'DREAM-OPEN-CRAWL-REFUSED', keep_researching: false, claim: null });
    }
    if (raw && raw.rule === 'DREAM-RESEARCH-FAILED') {
      return finish('quarantine', measure({}), { rule: 'DREAM-RESEARCH-FAILED', keep_researching: true, claim: null });
    }
    if (raw && raw.rule === 'DREAM-RESEARCH-CONTRACT') {
      return finish('quarantine', measure({}), { rule: 'DREAM-RESEARCH-CONTRACT', keep_researching: false, claim: null });
    }
    const measured = measure(raw);
    const gov = measured.eps == null ? KM.driftGovernance(NaN) : KM.driftGovernance(measured.eps);
    let lane = laneFromGov(gov, measured);
    if (measured.eps == null) return finish(lane, measured, { rule: 'DREAM-UNMEASURED', keep_researching: true });
    if (gov.band === 'correct') {
      const chi = KM.chiCorrect({ eps: measured.eps, ancestors: measured.ancestors, applied: false });
      if (chi.applied) {
        const after = KM.r4(chi.eps_after);
        const gov2 = KM.driftGovernance(after);
        const measured2 = Object.assign({}, measured, { eps: after });
        lane = laneFromGov(gov2, measured2);
        return finish(lane, measured2, { eps_before: measured.eps, eps_after: after, chi: chi, chi_pass: 1, keep_researching: lane !== 'promote_candidate' });
      }
      return finish('correction', measured, { chi: chi, chi_pass: 1, keep_researching: true, rule: 'DREAM-CHI-ONCE' });
    }
    if (lane === 'hard_reject') {
      const recenter = graceRecenter(measured.eps, measured.ancestors);
      return finish('hard_reject', measured, { recenter: recenter, aborted: true, keep_researching: false, rule: 'GRACE-RECENTER' });
    }
    if (lane === 'quarantine') return finish('quarantine', measured, { keep_researching: true, rule: 'DREAM-QUARANTINE-KEEP' });
    if (lane === 'provisional') return finish('provisional', measured, { keep_researching: true, rule: 'DREAM-PROVISIONAL' });
    return finish('promote_candidate', measured, { keep_researching: false, rule: 'DREAM-PROMOTE-CANDIDATE' });
  }

  function evidenceOf(gap, measured) {
    const src = (gap && (gap.evidence || (gap.extracts && gap.extracts[0] && (gap.extracts[0].source || gap.extracts[0].source_id)))) || 'allow-listed';
    return 'dream-idle · verified extract · ' + String(src);
  }

  function refusal(rule, extra) {
    return Object.assign({ ok: false, schema: SCHEMA, calls_llm: false, wrote_confirmed_shared: false, wrote_pack: false, shared_kb: false, phone_db: false, rule: rule }, extra || {});
  }

  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v == null ? null : v);
  }

  function llmShaped(raw) {
    if (!raw || typeof raw !== 'object') return false;
    if (raw.calls_llm === true) return true;
    return Object.keys(raw).some(k => /^(prompt|completion|messages|llm)$/i.test(k));
  }

  /* Allow-listed extracts only. Explicit eps null stays null. A model-shaped payload is a hard refuse. */
  function applyResearchContract(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, rule: 'DREAM-RESEARCH-CONTRACT', body: { calls_llm: false, rule: 'DREAM-RESEARCH-CONTRACT', eps: null, claim: null, extracts: [], ancestors: [] } };
    }
    if (llmShaped(raw)) {
      return { ok: false, rule: 'DREAM-LLM-REFUSED', body: { calls_llm: true, rule: 'DREAM-LLM-REFUSED', eps: null, claim: null, extracts: [], ancestors: [] } };
    }
    if (Array.isArray(raw.extracts) && raw.extracts.length && raw.extracts.every(e => !acceptExtract(e))) {
      return { ok: false, rule: 'DREAM-RESEARCH-CONTRACT', body: { calls_llm: false, rule: 'DREAM-RESEARCH-CONTRACT', eps: null, claim: null, extracts: [], ancestors: [], conflict: false } };
    }
    const body = Object.assign({}, raw, { calls_llm: false });
    if (raw.eps === null) body.eps = null;
    if (Array.isArray(raw.extracts)) body.extracts = raw.extracts.filter(acceptExtract);
    return { ok: true, rule: null, body: body };
  }

  function packetOf(spec) {
    if (!spec || typeof spec !== 'object') return null;
    if (spec.schema === PACKET_SCHEMA || spec.schema === SCHEMA) return spec;
    if (spec.packet && (spec.packet.schema === PACKET_SCHEMA || spec.packet.schema === SCHEMA)) return spec.packet;
    return null;
  }

  function packetLawful(pkt) {
    if (!pkt || pkt.calls_llm === true) return false;
    if (pkt.schema === PACKET_SCHEMA) {
      const sfe = pkt.sfe || pkt;
      return Number.isFinite(Number(sfe.Phi)) && Number.isFinite(Number(sfe.eps)) && Number.isFinite(Number(sfe.mu));
    }
    return pkt.schema === SCHEMA;
  }

  function driftStatus(eps) {
    if (eps == null || !Number.isFinite(Number(eps))) return 'unmeasured';
    const n = Number(eps);
    if (n > KM.DRIFT_RULING.explore_max) return 'hard_reject';
    if (n >= KM.DRIFT_RULING.explore_min) return 'quarantine';
    if (n > KM.DRIFT_RULING.project_max) return 'chi';
    return 'projectable';
  }

  function manifestFor(task, eps) {
    return {
      source_trace: PSI1, phase_path: ['spawn'], drift_status: driftStatus(eps),
      projection_status: 'not_projectable', requested_action: task, forbidden_actions: FORBIDDEN_ACTIONS.slice()
    };
  }

  function domainKey(task, gapId) {
    const g = gapId || 'unbound';
    if (task === 'resonance_place') return 'policy:admit';
    if (task === 'pack_append') return 'policy:pack_publish';
    if (task === 'research' || task === 'extract') return 'policy:gap_research:' + g;
    if (task === 'letter_fill') return 'policy:letter_fill:' + g;
    if (task === 'ancestor_probe') return 'policy:ancestor_probe:' + g;
    return 'policy:other:' + String(task || 'none');
  }

  function readSpec(spec) {
    spec = spec || {};
    const direct = spec.schema === SCHEMA || spec.schema === PACKET_SCHEMA;
    const pkt = direct ? spec : (spec.packet || null);
    const eps = direct ? spec.eps : (spec.eps !== undefined ? spec.eps : (pkt ? pkt.eps : undefined));
    return {
      task: spec.task || (pkt && pkt.task) || null,
      parent: spec.parent || (pkt && pkt.parent) || 'athena',
      spawned_by: spec.spawned_by || (pkt && pkt.spawned_by) || 'athena',
      parent_id: spec.parent_id || (pkt && pkt.parent_id) || null,
      gap_id: spec.gap_id || (pkt && (pkt.gap_id || null)) || null,
      name: spec.name || null,
      packet: direct ? spec : pkt,
      chi_active: spec.chi_active === true || (pkt && pkt.chi_active === true),
      eps: eps,
      kind: spec.kind || (pkt && pkt.kind) || null,
      letter: spec.letter || (pkt && pkt.letter) || null,
      calls_llm: spec.calls_llm === true || (pkt && pkt.calls_llm === true)
    };
  }

  function claimLetter(claim) {
    const ch = String(claim || '').trim().charAt(0).toLowerCase();
    return LETTERS.indexOf(ch) >= 0 ? ch : null;
  }

  function defaultPackDir() {
    if (!isNode) return null;
    try {
      const fs = require('fs');
      const path = require('path');
      const dir = path.join(__dirname, '..', 'packs', 'confirmed_shared');
      return fs.existsSync(path.join(dir, 'index.json')) ? dir : null;
    } catch (e) { return null; }
  }

  function packPublishPlan(opts, o) {
    o = o || {};
    if (o.publishPacks === false || opts.publishPacks === false) return { enabled: false, dir: null };
    return { enabled: true, dir: o.packDir || opts.packDir || defaultPackDir() };
  }

  function hostedItem(claim, rec, pkt) {
    return {
      id: 'cs:dream-' + sha256(norm(claim)).slice(0, 12),
      text: claim,
      standing: 'projectable',
      evidence: rec.evidence || evidenceOf(null),
      sfe: { Phi: pkt.sfe.Phi, eps: pkt.sfe.eps, mu: pkt.sfe.mu }
    };
  }

  function publishPromotedPack(item, dir) {
    if (!isNode) return { ok: false, wrote_pack: false, rule: 'DREAM-PACK-NODE-ONLY' };
    const fs = require('fs');
    const path = require('path');
    const letter = claimLetter(item.text);
    if (!letter) return { ok: false, wrote_pack: false, rule: 'DREAM-PACK-LETTER' };
    const file = path.join(dir, letter + '.json');
    const indexFile = path.join(dir, 'index.json');
    if (!fs.existsSync(file) || !fs.existsSync(indexFile)) return { ok: false, wrote_pack: false, rule: 'DREAM-PACK-MISSING' };
    let pack, index;
    try {
      pack = JSON.parse(fs.readFileSync(file, 'utf8'));
      index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
    } catch (e) { return { ok: false, wrote_pack: false, rule: 'DREAM-PACK-PARSE' }; }
    if (!pack || !Array.isArray(pack.items)) return { ok: false, wrote_pack: false, rule: 'DREAM-PACK-SHAPE' };
    const key = norm(item.text);
    const hit = pack.items.find(it => it && (it.id === item.id || norm(it.text) === key));
    if (hit) {
      const same = hit.sfe && hit.sfe.Phi === item.sfe.Phi && hit.sfe.eps === item.sfe.eps && hit.sfe.mu === item.sfe.mu;
      if (!same) {
        hit.sfe = { Phi: item.sfe.Phi, eps: item.sfe.eps, mu: item.sfe.mu };
        hit.standing = 'projectable';
        if (item.evidence) hit.evidence = item.evidence;
        fs.writeFileSync(file, JSON.stringify(pack, null, 1) + '\n');
        return { ok: true, wrote_pack: true, duplicate: true, recurate: true, letter: letter, path: letter + '.json', id: hit.id || item.id };
      }
      return { ok: true, wrote_pack: false, duplicate: true, recurate: false, letter: letter, path: letter + '.json', id: hit.id || item.id };
    }
    pack.items.push(item);
    if (Number.isFinite(Number(pack.curated_facts))) pack.curated_facts = Number(pack.curated_facts) + 1;
    fs.writeFileSync(file, JSON.stringify(pack, null, 1) + '\n');
    if (!index.packs) index.packs = {};
    if (!index.packs[letter]) index.packs[letter] = { path: letter + '.json', letter: letter.toUpperCase(), items: 0, curated_facts: 0 };
    index.packs[letter].items = pack.items.length;
    if (Number.isFinite(Number(pack.curated_facts))) index.packs[letter].curated_facts = pack.curated_facts;
    else if (Number.isFinite(Number(index.packs[letter].curated_facts))) index.packs[letter].curated_facts = Number(index.packs[letter].curated_facts) + 1;
    if (Number.isFinite(Number(index.total_items))) index.total_items = Number(index.total_items) + 1;
    if (Number.isFinite(Number(index.total_curated))) index.total_curated = Number(index.total_curated) + 1;
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 1) + '\n');
    return { ok: true, wrote_pack: true, duplicate: false, recurate: false, letter: letter, path: letter + '.json', id: item.id, items: pack.items.length };
  }

  /* Athena strict gate. Quarantine, null ε, a missing packet, or a non-projectable packet never passes. */
  function athenaGate(rec) {
    if (!rec || rec.lane === 'quarantine' || rec.route === 'dream_state_quarantine_candidate' || rec.open_crawl === true || rec.crawl === true || rec.research_web === true || rec.calls_llm === true) return refusal('DREAM-QUARANTINE-NO-TRUTH', { role: 'athena' });
    if (rec.lane === 'hard_reject' || rec.aborted) return refusal('DREAM-HARD-REJECT-NO-TRUTH', { role: 'athena' });
    if (rec.lane !== 'promote_candidate') return refusal('DREAM-IDLE-NOT-PROMOTE', { role: 'athena' });
    if (rec.eps == null || !Number.isFinite(Number(rec.eps))) return refusal('DREAM-ATHENA-UNMEASURED', { role: 'athena' });
    const pkt = rec.packet;
    if (!pkt || pkt.schema !== PACKET_SCHEMA || !pkt.sfe || !Number.isFinite(pkt.sfe.Phi) || !Number.isFinite(pkt.sfe.eps) || !Number.isFinite(pkt.sfe.mu)) return refusal('DREAM-IDLE-PACKET-REQUIRED', { role: 'athena' });
    if (!(Number(rec.eps) <= KM.DRIFT_RULING.project_max) || !(pkt.sfe.eps <= KM.DRIFT_RULING.project_max) || !KM.phaseAlignedToOrigin(pkt.sfe.Phi) || !(pkt.sfe.mu > 0)) return refusal('DREAM-IDLE-DRIFT-NOT-PROJECTABLE', { role: 'athena' });
    if (rec.integrity != null && !(Number(rec.integrity) >= INTEGRITY_HIGH)) return refusal('DREAM-ATHENA-INTEGRITY', { role: 'athena' });
    return { ok: true, role: 'athena', athena: 'admit', packet: pkt, calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false };
  }

  /* Idle orchestrator. One registry. Athena authorizes. Gilligan does not spawn. Neo does not spawn. */
  function createAthena(opts) {
    opts = opts || {};
    const now = () => (opts.clock ? opts.clock() : '1970-01-01T00:00:00Z');
    const externalAsk = typeof opts.answering === 'function' ? opts.answering : null;
    const budget = {
      max_helpers: opts.budget && Number.isFinite(Number(opts.budget.max_helpers)) ? Number(opts.budget.max_helpers) : SPAWN_BUDGET.max_helpers,
      max_per_parent: opts.budget && Number.isFinite(Number(opts.budget.max_per_parent)) ? Number(opts.budget.max_per_parent) : SPAWN_BUDGET.max_per_parent,
      max_spawn_per_idle_window: opts.budget && Number.isFinite(Number(opts.budget.max_spawn_per_idle_window)) ? Number(opts.budget.max_spawn_per_idle_window) : SPAWN_BUDGET.max_spawn_per_idle_window
    };
    let latch = false;
    let wasHeld = false;
    let seq = 0;
    let spawnsThisWindow = 0;
    const helpers = [];
    const ancestry = [];
    const cold = [];
    const integrations = [];
    const spc = [];
    const admitted = new Set();
    const inFlight = new Set();
    const TASKS = {
      resonance_place: payload => athenaGate(payload && (payload.rec || payload)),
      pack_append: payload => {
        const gate = payload && payload.gate;
        if (!gate || gate.ok !== true || gate.role !== 'athena') return refusal('DREAM-ATHENA-GATE-REQUIRED', { role: 'athena' });
        if (!payload.dir || !payload.item) return refusal('DREAM-PACK-DIR-REQUIRED', { role: 'athena' });
        const published = publishPromotedPack(payload.item, payload.dir);
        return Object.assign({ schema: SCHEMA, calls_llm: false, wrote_confirmed_shared: false }, published);
      },
      research: payload => runResearch('research', payload),
      extract: payload => runResearch('extract', payload),
      letter_fill: payload => runResearch('letter_fill', payload),
      ancestor_probe: payload => runResearch('ancestor_probe', payload)
    };
    function askHeld() { return latch || (externalAsk ? externalAsk() === true : false); }
    function living() { return helpers.filter(h => h.status !== 'retired'); }
    function domainHeld(key, exceptId) { return living().some(h => h.domain === key && h.id !== exceptId); }
    function parentCount(key) { return living().filter(h => (h.parent_id || h.parent) === key).length; }
    function busyRefusal() {
      return { ok: false, ran: false, schema: SCHEMA, rule: 'DREAM-IDLE-BUSY', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena' };
    }
    function logPhase(phase, agent, extra) {
      if (agent) {
        if (!agent.phase_path) agent.phase_path = [];
        agent.phase_path.push(phase);
      }
      ancestry.push(Object.assign({ phase: phase, phase_index: phase === 'spawn' ? 'init' : phase, id: agent && agent.id, parent: agent && agent.parent, parent_id: agent && agent.parent_id || null, task: agent && agent.task, psi1: PSI1, at: now(), calls_llm: false }, extra || {}));
      if (ancestry.length > 400) ancestry.splice(0, ancestry.length - 400);
    }
    function writeSpc(agent, kind) {
      spc.push({
        schema: 'FORGE-IDLE-SPC/v1', id: agent.id, kind: kind, psi1: PSI1, intent: agent.task,
        override: PRIORITY.slice(), gap_id: agent.gap_id || null, at: now(), calls_llm: false, wrote_confirmed_shared: false
      });
    }
    function pauseAll() {
      for (const ag of helpers) {
        if (ag.status !== 'active') continue;
        ag.status = 'hibernated';
        ag.active = false;
        ag.hold = 'ask';
        logPhase('hibernate', ag, { hold: 'ask' });
      }
    }
    function resumeAsk() {
      for (const ag of helpers) {
        if (ag.hold !== 'ask' || ag.status !== 'hibernated') continue;
        ag.status = 'active';
        ag.active = true;
        ag.hold = null;
        logPhase('resume', ag, { hold: 'ask' });
      }
    }
    function noteAsk(busy) {
      latch = busy === true;
      const held = askHeld();
      if (held) pauseAll();
      else resumeAsk();
      if (wasHeld && !held) spawnsThisWindow = 0;
      wasHeld = held;
      return { ok: true, answering: held, calls_llm: false, role: 'neo', schema: SCHEMA };
    }
    function guardAsk() {
      if (!askHeld()) return false;
      pauseAll();
      wasHeld = true;
      return true;
    }
    function coldRoute(stack) {
      const lane = stack && stack.lane;
      const rule = stack && stack.rule;
      const eps = stack && stack.eps;
      if (lane === 'quarantine' || lane === 'hard_reject' || rule === 'DREAM-QUARANTINE-NO-TRUTH' || rule === 'DREAM-HARD-REJECT-NO-TRUTH' || rule === 'DREAM-QUARANTINE-KEEP' || (Number.isFinite(Number(eps)) && Number(eps) >= KM.DRIFT_RULING.explore_min)) return 'dream_state_quarantine_candidate';
      return 'cold_archive';
    }
    function coldIntact(row) {
      if (!row || row.schema !== COLD_SCHEMA || typeof row.bytes !== 'string' || typeof row.sha256 !== 'string') return false;
      if (sha256(row.bytes) !== row.sha256) return false;
      if (!row.body || canon(row.body) !== row.bytes) return false;
      if (row.body.calls_llm === true || row.wrote_confirmed_shared === true || row.body.wrote_confirmed_shared === true) return false;
      return true;
    }
    function writeCold(agent) {
      const stack = agent.stack || { packet: agent.packet || null, eps: null, eps_unmeasured: false, integrity: null, lane: 'spawn', calls_llm: false, curator: CURATOR_TASKS.indexOf(agent.task) >= 0 };
      const route = coldRoute(stack);
      const body = {
        schema: COLD_SCHEMA, id: agent.id, task: agent.task, parent: agent.parent, parent_id: agent.parent_id, gap_id: agent.gap_id,
        domain: agent.domain, stack: stack, memory: agent.memory || [], route: route,
        truth_support_allowed: false, stable_memory_allowed: false, projection_allowed: false,
        wrote_confirmed_shared: false, wrote_pack: false, calls_llm: false, retired_at: now()
      };
      const bytes = canon(body);
      const row = { schema: COLD_SCHEMA, id: agent.id, sha256: sha256(bytes), bytes: bytes, body: body, route: route, wrote_confirmed_shared: false, wrote_pack: false, calls_llm: false, retired_at: body.retired_at };
      cold.push(row);
      if (route === 'dream_state_quarantine_candidate' && typeof opts.onQuarantine === 'function') opts.onQuarantine(row);
      return row;
    }
    function latestCold(id) {
      for (let i = cold.length - 1; i >= 0; i--) if (cold[i].id === id) return cold[i];
      return null;
    }
    function resurrectGates(agent, body) {
      if (agent.calls_llm === true || (body && body.calls_llm === true)) return refusal('DREAM-LLM-REFUSED', { role: 'athena' });
      if (CURATOR_TASKS.indexOf(agent.task) >= 0) return null;
      const stack = (body && body.stack) || {};
      if (stack.eps_unmeasured === true || stack.eps == null || !Number.isFinite(Number(stack.eps))) return refusal('DREAM-RESURRECT-UNMEASURED', { role: 'athena' });
      if (Number(stack.eps) > KM.DRIFT_RULING.project_max) return refusal('ATHENA-RESURRECT-DRIFT', { role: 'athena' });
      if (!Number.isFinite(Number(stack.integrity)) || Number(stack.integrity) < INTEGRITY_HIGH) return refusal('ATHENA-RESURRECT-INTEGRITY', { role: 'athena' });
      return null;
    }
    function remember(agent, result) {
      const hasEps = result && Object.prototype.hasOwnProperty.call(result, 'eps');
      const eps = hasEps ? result.eps : null;
      agent.stack = {
        packet: (result && result.packet) || agent.packet || null,
        eps: eps == null ? null : eps,
        eps_unmeasured: eps == null,
        integrity: result && result.integrity != null && Number.isFinite(Number(result.integrity)) ? Number(result.integrity) : null,
        claim: result && result.claim || null,
        lane: result && result.lane || null,
        rule: result && result.rule || null,
        calls_llm: false,
        curator: CURATOR_TASKS.indexOf(agent.task) >= 0
      };
      agent.memory.push({ phase: 'run', at: now(), rule: agent.stack.rule, lane: agent.stack.lane });
    }
    function reintegrate(agent, result) {
      if (!agent.gap_id) return { ok: true, skipped: true, schema: SCHEMA, rule: 'DREAM-REINTEGRATE-NO-GAP', calls_llm: false, wrote_confirmed_shared: false };
      if (integrations.some(x => x.helper_id === agent.id)) return { ok: true, duplicate: true, schema: SCHEMA, rule: 'DREAM-REINTEGRATE-ONCE', calls_llm: false, wrote_confirmed_shared: false };
      const row = {
        schema: SCHEMA, gap_id: agent.gap_id, helper_id: agent.id, parent: agent.parent, at: now(),
        lane: result.lane || null, rule: result.rule || null, packet: result.packet || null,
        eps: result && Object.prototype.hasOwnProperty.call(result, 'eps') ? result.eps : null,
        calls_llm: false, wrote_confirmed_shared: false, wrote_pack: result.wrote_pack === true
      };
      integrations.push(row);
      if (typeof opts.onReintegrate === 'function') opts.onReintegrate(row);
      logPhase('reintegrate', agent, { gap_id: agent.gap_id, rule: row.rule });
      return { ok: true, rule: 'DREAM-REINTEGRATED', integration: row, calls_llm: false, schema: SCHEMA, wrote_confirmed_shared: false };
    }
    function runResearch(task, payload) {
      const raw = payload && (payload.gap || payload.rec || payload) || {};
      if (task === 'letter_fill' && raw.kind !== 'letter_hole' && !raw.letter) return refusal('ATHENA-TASK-MISMATCH', { role: 'athena', task: task });
      if (task === 'ancestor_probe' && raw.kind !== 'rpmc_ancestor_none' && !Array.isArray(raw.ancestors)) return refusal('ATHENA-TASK-MISMATCH', { role: 'athena', task: task });
      if (task === 'extract' && !(raw.extracts || []).some(acceptExtract)) return routeMeasurement({ rule: 'DREAM-RESEARCH-CONTRACT', calls_llm: false, eps: null, claim: null, extracts: [] });
      const gated = applyResearchContract(raw);
      return routeMeasurement(gated.body);
    }
    function maySpawn(spec) {
      const s = readSpec(spec);
      if (guardAsk()) return busyRefusal();
      if (s.calls_llm || llmShaped(spec) || (s.packet && llmShaped(s.packet))) return refusal('DREAM-LLM-REFUSED', { role: 'athena' });
      if (s.parent === 'neo' || s.spawned_by === 'neo') return refusal('NEO-DOES-NOT-SPAWN', { role: 'athena' });
      if (s.spawned_by === 'gilligan') return refusal('GILLIGAN-DOES-NOT-SPAWN', { role: 'athena' });
      if (!packetLawful(s.packet)) return refusal('DREAM-PACKET-REQUIRED', { role: 'athena' });
      if (HELPER_TASKS.indexOf(s.task) < 0) return refusal('ATHENA-TASK-UNDECLARED', { role: 'athena', task: s.task == null ? null : String(s.task) });
      if (CURATOR_TASKS.indexOf(s.task) < 0) {
        if (s.chi_active) return refusal('ATHENA-SPAWN-CHI', { role: 'athena' });
        if (s.eps != null && Number.isFinite(Number(s.eps)) && Number(s.eps) > KM.DRIFT_RULING.explore_max) return refusal('ATHENA-SPAWN-HARD-REJECT', { role: 'athena' });
        /* Codex 3.24: dream rehearsal starts only while drift is under 0.4. Quarantine-band work stays in custody. */
        if (s.eps != null && Number.isFinite(Number(s.eps)) && Number(s.eps) >= KM.DRIFT_RULING.explore_min) return refusal('ATHENA-SPAWN-DRIFT', { role: 'athena' });
      }
      const domain = domainKey(s.task, s.gap_id || s.letter);
      if (domainHeld(domain, null)) return refusal('ATHENA-DOMAIN-HELD', { role: 'athena', domain: domain });
      if (living().length >= budget.max_helpers) return refusal('ATHENA-SPAWN-CAP', { role: 'athena', max_helpers: budget.max_helpers });
      const pkey = s.parent_id || s.parent || 'athena';
      if (parentCount(pkey) >= budget.max_per_parent) return refusal('ATHENA-SPAWN-PARENT-CAP', { role: 'athena', max_per_parent: budget.max_per_parent });
      if (spawnsThisWindow >= budget.max_spawn_per_idle_window) return refusal('ATHENA-SPAWN-WINDOW-CAP', { role: 'athena', max_spawn_per_idle_window: budget.max_spawn_per_idle_window });
      return { ok: true, role: 'athena', athena: 'spawn', task: s.task, domain: domain, parent: s.parent, calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, packet: s.packet, schema: SCHEMA };
    }
    function spawnHelper(spec) {
      const decision = maySpawn(spec);
      if (!decision.ok) return decision;
      const s = readSpec(spec);
      seq += 1;
      const curator = CURATOR_TASKS.indexOf(s.task) >= 0;
      const eps = s.eps === undefined ? null : s.eps;
      const manifest = manifestFor(s.task, eps);
      const packet = Object.assign({}, s.packet, { psi1: PSI1, manifest: manifest });
      const agent = {
        id: 'athena-' + seq, schema: HELPER_SCHEMA, role: 'athena_helper', task: s.task,
        name: s.name || (s.task + '-' + seq), status: 'active', active: true, calls_llm: false, os_process: false, created: now(),
        parent: s.parent, parent_id: s.parent_id, spawned_by: 'athena', gap_id: s.gap_id, domain: decision.domain,
        packet: packet, hold: null, psi1: PSI1, override: PRIORITY.slice(), intent: s.task,
        drift_index: { eps: eps, status: driftStatus(eps), cite: KM.DRIFT_RULING.cite },
        phase_path: [],
        stack: {
          packet: packet, eps: eps,
          eps_unmeasured: !curator && (eps === null || eps === undefined),
          integrity: null, lane: 'spawn', calls_llm: false, curator: curator
        },
        memory: [{ phase: 'init', at: now(), packet_schema: packet.schema, psi1: PSI1, intent: s.task }]
      };
      helpers.push(agent);
      spawnsThisWindow += 1;
      writeSpc(agent, 'seed');
      logPhase('spawn', agent, { packet_schema: packet.schema, phase_index: 'init', psi1: PSI1 });
      return { ok: true, agent: Object.assign({}, agent), calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena', schema: SCHEMA, packet: packet };
    }
    function spawn(task, name) {
      const pkt = { schema: SCHEMA, calls_llm: false, task: task, parent: 'athena', spawned_by: 'athena', kind: 'helper_spawn', lane: 'spawn' };
      return spawnHelper({ task: task, name: typeof name === 'string' ? name : null, parent: 'athena', spawned_by: 'athena', packet: pkt });
    }
    function forkHelper(id, extra) {
      if (guardAsk()) return busyRefusal();
      const ag = helpers.find(h => h.id === id);
      if (!ag) return refusal('ATHENA-HELPER-UNKNOWN', { role: 'athena' });
      if (ag.status !== 'active' && ag.status !== 'hibernated') return refusal('ATHENA-HELPER-NOT-ACTIVE', { role: 'athena', status: ag.status });
      extra = extra || {};
      const gap = extra.gap_id || ((ag.gap_id || ag.id) + ':fork');
      const child = spawnHelper({
        task: ag.task, parent: ag.parent, parent_id: ag.id, spawned_by: 'athena', gap_id: gap,
        name: (ag.name || ag.task) + ':fork', eps: ag.stack ? ag.stack.eps : null,
        packet: Object.assign({}, ag.packet || {}, { schema: (ag.packet && ag.packet.schema) || SCHEMA, gap_id: gap, parent_id: ag.id, forked_from: ag.id, calls_llm: false })
      });
      if (!child.ok) return child;
      const born = helpers.find(h => h.id === child.agent.id);
      if (born && ag.stack) {
        born.stack = Object.assign({}, ag.stack, { forked_from: ag.id });
        born.memory = (ag.memory || []).map(row => Object.assign({}, row));
        born.memory.push({ phase: 'fork', at: now(), forked_from: ag.id });
        born.drift_index = ag.drift_index ? Object.assign({}, ag.drift_index) : born.drift_index;
      }
      logPhase('fork', born || ag, { forked_from: ag.id });
      return Object.assign({}, child, { forked_from: ag.id, calls_llm: false, wrote_confirmed_shared: false });
    }
    function run(id, payload) {
      if (guardAsk()) return busyRefusal();
      const ag = helpers.find(h => h.id === id);
      if (!ag) return refusal('ATHENA-HELPER-UNKNOWN', { role: 'athena' });
      if (ag.status !== 'active') return refusal('ATHENA-HELPER-NOT-ACTIVE', { role: 'athena', status: ag.status });
      payload = payload || {};
      if (payload.peer || payload.direct || payload.target_helper) {
        logPhase('refuse', ag, { rule: 'ORCH-UNMEDIATED' });
        return refusal('ORCH-UNMEDIATED', { role: 'athena', helper: ag.id });
      }
      const out = TASKS[ag.task] ? TASKS[ag.task](payload) : refusal('ATHENA-TASK-UNDECLARED', { role: 'athena' });
      const result = Object.assign({ ok: false, helper: ag.id, role: 'athena', calls_llm: false, schema: SCHEMA, wrote_pack: false, wrote_confirmed_shared: false }, out || { rule: 'ATHENA-HELPER-FAILED' });
      if (!out || out.ok == null) {
        const refuse = !out || result.rule === 'DREAM-LLM-REFUSED' || result.rule === 'DREAM-RESEARCH-CONTRACT' || result.rule === 'DREAM-OPEN-CRAWL-REFUSED' || result.rule === 'ATHENA-HELPER-FAILED';
        result.ok = !refuse;
      }
      result.calls_llm = false;
      remember(ag, result);
      if (result.eps != null && Number(result.eps) > KM.DRIFT_RULING.explore_max) ag.isolated = true;
      logPhase('run', ag, { rule: result.rule || null, ok: result.ok === true });
      if (ag.gap_id) reintegrate(ag, result);
      if (payload.child) {
        const childSpec = Object.assign({ parent_id: ag.id, spawned_by: 'athena', parent: ag.parent || 'athena' }, payload.child);
        result.child = spawnHelper(childSpec);
      }
      return result;
    }
    function hibernateHelper(id) {
      const ag = helpers.find(h => h.id === id);
      if (!ag) return refusal('ATHENA-HELPER-UNKNOWN', { role: 'athena' });
      if (ag.status !== 'active') return refusal('ATHENA-HELPER-NOT-ACTIVE', { role: 'athena', status: ag.status });
      ag.status = 'hibernated';
      ag.active = false;
      ag.hold = null;
      logPhase('hibernate', ag, {});
      return { ok: true, agent: Object.assign({}, ag), calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena', schema: SCHEMA };
    }
    function retireHelper(id) {
      const ag = helpers.find(h => h.id === id);
      if (!ag) return refusal('ATHENA-HELPER-UNKNOWN', { role: 'athena' });
      if (ag.status !== 'active' && ag.status !== 'hibernated') return refusal('ATHENA-HELPER-NOT-ACTIVE', { role: 'athena', status: ag.status });
      const row = writeCold(ag);
      ag.status = 'retired';
      ag.active = false;
      ag.hold = null;
      logPhase('retire', ag, { cold_sha256: row.sha256, route: row.route });
      return { ok: true, agent: Object.assign({}, ag), calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena', schema: SCHEMA, cold: { schema: COLD_SCHEMA, sha256: row.sha256, route: row.route, wrote_confirmed_shared: false } };
    }
    function resurrectHelper(id) {
      if (guardAsk()) return busyRefusal();
      const ag = helpers.find(h => h.id === id);
      if (!ag) return refusal('ATHENA-HELPER-UNKNOWN', { role: 'athena' });
      if (ag.status !== 'retired') return refusal('ATHENA-HELPER-NOT-ACTIVE', { role: 'athena', status: ag.status });
      const row = latestCold(id);
      if (!row || !coldIntact(row)) return refusal('ATHENA-RESURRECT-INTEGRITY', { role: 'athena' });
      const gate = resurrectGates(ag, row.body);
      if (gate) return gate;
      if (domainHeld(ag.domain, ag.id)) return refusal('ATHENA-DOMAIN-HELD', { role: 'athena', domain: ag.domain });
      if (living().length >= budget.max_helpers) return refusal('ATHENA-SPAWN-CAP', { role: 'athena', max_helpers: budget.max_helpers });
      ag.status = 'active';
      ag.active = true;
      ag.hold = null;
      logPhase('resurrect', ag, { cold_sha256: row.sha256 });
      return { ok: true, agent: Object.assign({}, ag), calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena', schema: SCHEMA };
    }
    function mayAdmit(candidate) {
      if (guardAsk()) return busyRefusal();
      const id = candidate && (candidate.gap_id || candidate.id) || null;
      if (id && (admitted.has(id) || inFlight.has(id))) return refusal('ATHENA-ADMIT-ONCE', { role: 'athena', gap_id: id });
      const gate = athenaGate(candidate);
      if (!gate.ok) return gate;
      return Object.assign({ gap_id: id, schema: SCHEMA }, gate);
    }
    function beginAdmit(id) {
      if (!id) return null;
      if (admitted.has(id) || inFlight.has(id)) return refusal('ATHENA-ADMIT-ONCE', { role: 'athena', gap_id: id });
      inFlight.add(id);
      return null;
    }
    function finishAdmit(id, ok) {
      if (!id) return { ok: true, calls_llm: false };
      inFlight.delete(id);
      if (ok) admitted.add(id);
      return { ok: true, admitted: admitted.has(id), calls_llm: false, gap_id: id };
    }
    /* Quarantine and hard-reject custody. Hashed cold row. Does not spawn and does not spend the window. */
    function noteCustody(rec, rule) {
      const lane = (rec && rec.lane) || 'quarantine';
      const body = {
        schema: COLD_SCHEMA, id: 'custody:' + String((rec && (rec.gap_id || rec.id)) || sha256(String(rule || 'custody')).slice(0, 12)),
        task: 'custody', parent: 'athena', parent_id: null, gap_id: rec && (rec.gap_id || rec.id) || null, domain: 'policy:custody',
        stack: {
          packet: rec && rec.packet || null, eps: rec && rec.eps != null ? rec.eps : null, eps_unmeasured: !rec || rec.eps == null,
          integrity: rec && rec.integrity != null ? rec.integrity : null, claim: rec && rec.claim || null,
          lane: lane, rule: rule || 'DREAM-QUARANTINE-NO-TRUTH', calls_llm: false, curator: false
        },
        memory: [], route: 'dream_state_quarantine_candidate',
        truth_support_allowed: false, stable_memory_allowed: false, projection_allowed: false,
        wrote_confirmed_shared: false, wrote_pack: false, calls_llm: false, retired_at: now(), spawn_counted: false
      };
      const bytes = canon(body);
      const row = { schema: COLD_SCHEMA, id: body.id, sha256: sha256(bytes), bytes: bytes, body: body, route: body.route, wrote_confirmed_shared: false, wrote_pack: false, calls_llm: false, retired_at: body.retired_at, spawn_counted: false };
      cold.push(row);
      return row;
    }
    function exportCold() {
      return JSON.stringify(cold.map(r => ({
        schema: r.schema, id: r.id, sha256: r.sha256, bytes: r.bytes, body: r.body, route: r.route,
        wrote_confirmed_shared: false, wrote_pack: false, calls_llm: false, retired_at: r.retired_at
      })));
    }
    function loadCold(json) {
      let rows;
      try { rows = typeof json === 'string' ? JSON.parse(json) : json; }
      catch (e) { return refusal('ATHENA-RESURRECT-INTEGRITY', { role: 'athena' }); }
      if (!Array.isArray(rows)) return refusal('ATHENA-RESURRECT-INTEGRITY', { role: 'athena' });
      for (const row of rows) if (!coldIntact(row)) return refusal('ATHENA-RESURRECT-INTEGRITY', { role: 'athena', wrote_confirmed_shared: false });
      cold.length = 0;
      for (const row of rows) cold.push(row);
      return { ok: true, calls_llm: false, loaded: cold.length, wrote_confirmed_shared: false, schema: COLD_SCHEMA };
    }
    function copyAgent(h) { return Object.assign({}, h, { memory: (h.memory || []).slice(), stack: h.stack ? Object.assign({}, h.stack) : null }); }
    return {
      schema: 'FORGE-ATHENA-CURATOR/v1', orchestrator: 'FORGE-IDLE-ORCHESTRATOR/v1', role: 'athena', calls_llm: false, os_process: false,
      lifecycle: ['spawn', 'run', 'hibernate', 'retire', 'resurrect'],
      priority: PRIORITY.slice(),
      tasks: () => HELPER_TASKS.slice(),
      spawn: spawn, run: run, forkHelper: forkHelper,
      hibernate: hibernateHelper, retire: retireHelper, resurrect: resurrectHelper,
      spawnHelper: spawnHelper, hibernateHelper: hibernateHelper, retireHelper: retireHelper, resurrectHelper: resurrectHelper,
      listActive: () => helpers.filter(h => h.status === 'active').map(copyAgent),
      helpers: () => helpers.map(copyAgent),
      ancestry: () => ancestry.map(a => Object.assign({}, a)),
      spcLog: () => spc.map(row => Object.assign({}, row, { override: (row.override || []).slice() })),
      coldBank: () => cold.map(r => Object.assign({}, r, { body: r.body, wrote_confirmed_shared: false })),
      integrations: () => integrations.map(r => Object.assign({}, r)),
      exportCold: exportCold, loadCold: loadCold,
      maySpawn: maySpawn, mayAdmit: mayAdmit, beginAdmit: beginAdmit, finishAdmit: finishAdmit, noteCustody: noteCustody,
      noteAsk: noteAsk, setAnswering: v => noteAsk(v === true), askHeld: askHeld,
      budget: () => ({ max_helpers: budget.max_helpers, max_per_parent: budget.max_per_parent, max_spawn_per_idle_window: budget.max_spawn_per_idle_window, living: living().length, spawns_this_window: spawnsThisWindow }),
      daemons: () => DAEMONS.map(d => Object.assign({}, d)),
      admitted: () => Array.from(admitted)
    };
  }

  function createIdleDream(opts) {
    opts = opts || {};
    const now = () => (opts.clock ? opts.clock() : '1970-01-01T00:00:00Z');
    const research = typeof opts.research === 'function' ? opts.research : null;
    let admitEnabled = opts.admitEnabled !== false;
    let answering = false;
    const gaps = new Map();
    const athena = createAthena({
      clock: now, answering: () => answering, budget: opts.budget,
      onReintegrate: row => {
        const g = gaps.get(row.gap_id);
        if (!g) return;
        if (!g.integrations) g.integrations = [];
        if (g.integrations.some(x => x.helper_id === row.helper_id)) return;
        g.integrations.push(row);
      },
      onQuarantine: row => {
        quarantine.push({
          schema: SCHEMA, gap_id: 'cold:' + row.id, lane: 'quarantine', route: 'dream_state_quarantine_candidate',
          rule: 'DREAM-QUARANTINE-KEEP', status: 'quarantined', calls_llm: false,
          wrote_confirmed_shared: false, wrote_pack: false, truth_support_allowed: false,
          stable_memory_allowed: false, projection_allowed: false, cold_sha256: row.sha256, shared_kb: false, phone_db: false
        });
      }
    });
    const queue = [];
    const promote = [];
    const quarantine = [];
    const aborted = [];
    const log = [];
    const christLog = [];
    const coldSeen = new Set();
    const seen = new Set();

    function enqueue(items) {
      const added = [];
      for (const g of items || []) {
        const id = gapId(g);
        if (seen.has(id)) continue;
        seen.add(id);
        const row = Object.assign({ extracts: [], ancestors: [], claim: null, attempts: 0, status: 'open', integrations: [] }, g, { id: id });
        gaps.set(id, row);
        queue.push(row);
        added.push(id);
      }
      return { ok: true, calls_llm: false, added: added, queued: queue.length };
    }

    function researchGap(gap) {
      let extra = {};
      if (research) {
        try { extra = research(gap) || {}; }
        catch (e) { return { calls_llm: false, rule: 'DREAM-RESEARCH-FAILED', eps: null, claim: null, conflict: false, ancestors: [], extracts: [] }; }
      }
      const merged = Object.assign({}, gap, extra);
      if (extra && extra.calls_llm === true) merged.calls_llm = true;
      return applyResearchContract(merged).body;
    }

    function hostReady(o) {
      o = o || {};
      const host = o.host || opts.host;
      const key = o.writeKey || o.write_key || opts.writeKey || opts.write_key || '';
      return !!(admitEnabled && host && typeof host.writeSharedKnowledge === 'function' && key && o.autoFill !== false && opts.autoFill !== false);
    }

    function fillBackend(staged, o) {
      o = o || {};
      if (!hostReady(o)) return { ok: false, ran: false, rule: 'DREAM-BACKEND-FILL-IDLE', wrote_confirmed_shared: false, wrote_pack: false, calls_llm: false, phone_db: false };
      const packs = o.publishPacks === true || opts.publishPacks === true;
      return admitRecord(staged, { host: o.host || opts.host, writeKey: o.writeKey || o.write_key || opts.writeKey || opts.write_key, publishPacks: packs, packDir: o.packDir || opts.packDir, answering: false });
    }

    function coldKept(row) {
      const stack = (row && row.body && row.body.stack) || {};
      if (!row || row.route === 'dream_state_quarantine_candidate' || row.wrote_confirmed_shared === true) return true;
      if (stack.lane === 'quarantine' || stack.lane === 'hard_reject') return true;
      if (stack.rule === 'DREAM-QUARANTINE-NO-TRUTH' || stack.rule === 'DREAM-HARD-REJECT-NO-TRUTH' || stack.rule === 'DREAM-QUARANTINE-KEEP' || stack.rule === 'GRACE-RECENTER' || stack.rule === 'CHRIST-PING') return true;
      return false;
    }

    function revisitCold(o) {
      const rows = athena.coldBank();
      let row = null;
      for (const r of rows) { if (!coldSeen.has(r.sha256)) { row = r; break; } }
      if (!row) return { ok: true, ran: false, role: 'gilligan', rule: 'GILLIGAN-COLD-QUIET', calls_llm: false, wrote_confirmed_shared: false, wrote_pack: false, shared_kb: false, phone_db: false };
      coldSeen.add(row.sha256);
      if (coldKept(row)) return { ok: true, ran: true, role: 'gilligan', rule: 'GILLIGAN-COLD-KEEP', cold_id: row.id, calls_llm: false, wrote_confirmed_shared: false, wrote_pack: false, shared_kb: false, phone_db: false };
      const stack = row.body.stack || {};
      const measured = routeMeasurement({ eps: stack.eps, integrity: stack.integrity, claim: stack.claim, extracts: [], ancestors: stack.ancestors || [], calls_llm: false });
      if (measured.lane !== 'promote_candidate' || !measured.claim || !(Number(measured.integrity) >= INTEGRITY_HIGH)) {
        return { ok: true, ran: true, role: 'gilligan', rule: 'GILLIGAN-COLD-KEEP', cold_id: row.id, lane: measured.lane, calls_llm: false, wrote_confirmed_shared: false, wrote_pack: false, shared_kb: false, phone_db: false };
      }
      const staged = Object.assign({}, measured, { gap_id: (row.body && row.body.gap_id) || row.id, id: (row.body && row.body.gap_id) || row.id, status: 'staged', evidence: 'dream-idle · cold re-curate · ' + row.id });
      const fill = fillBackend(staged, o);
      return {
        ok: true, ran: true, role: 'gilligan', rule: 'GILLIGAN-COLD-RECURATE', cold_id: row.id, lane: 'promote_candidate',
        calls_llm: false, wrote_confirmed_shared: fill.wrote_confirmed_shared === true, wrote_pack: fill.wrote_pack === true,
        shared_kb: fill.wrote_confirmed_shared === true, phone_db: false, backend_fill: { ok: fill.ok === true, rule: fill.rule, wrote_confirmed_shared: fill.wrote_confirmed_shared === true, wrote_pack: fill.wrote_pack === true, phone_db: false }
      };
    }

    function noteChrist(ping) {
      if (!ping) return;
      christLog.push({ rule: ping.rule, christ_ping: ping.christ_ping === true, christ_pain: ping.christ_pain === true, initiator: ping.initiator || null, wrote_confirmed_shared: false, at: now(), calls_llm: false });
      if (christLog.length > 80) christLog.splice(0, christLog.length - 80);
    }

    const pulse = { research: 0, athena_admits: 0, gilligan_admits: 0, staged: 0, quarantine: 0, hard: 0, cold_recurate: 0, cold_keep: 0, cold_quiet: 0, novel: 0, christ: 0, packs: 0, last_step: null, last_athena: null, last_cold: null };
    let kbSeen = null;
    function summarize(rec) {
      return { rule: rec.rule || null, lane: rec.lane || null, gap_id: rec.gap_id || null, kind: rec.kind || null, role: rec.role || rec.researcher || null, ran: rec.ran === true, wrote_confirmed_shared: rec.wrote_confirmed_shared === true, always_on: true, idle_gated: false };
    }
    function noteStep(rec) {
      if (!rec) return;
      const cold = rec.role === 'gilligan' ? rec : (rec.cold && rec.cold.role === 'gilligan' ? rec.cold : null);
      if (cold) {
        pulse.last_cold = summarize(cold);
        if (cold.rule === 'GILLIGAN-COLD-RECURATE') pulse.cold_recurate++;
        else if (cold.rule === 'GILLIGAN-COLD-KEEP') pulse.cold_keep++;
        else if (cold.rule === 'GILLIGAN-COLD-QUIET') pulse.cold_quiet++;
        if (cold.wrote_confirmed_shared === true) pulse.gilligan_admits++;
        if (cold.wrote_pack === true) pulse.packs++;
      }
      if (rec.christ_ping === true) pulse.christ++;
      if (rec.role === 'gilligan') { pulse.last_step = summarize(rec); return; }
      pulse.last_step = summarize(rec);
      if (rec.researcher === 'athena') pulse.last_athena = pulse.last_step;
      if (rec.ran === true && rec.researcher === 'athena') {
        pulse.research++;
        if (rec.wrote_confirmed_shared === true) pulse.athena_admits++;
        else if (rec.lane === 'promote_candidate') pulse.staged++;
        else if (rec.lane === 'quarantine') pulse.quarantine++;
        else if (rec.lane === 'hard_reject') pulse.hard++;
        if (rec.kind === 'letter_hole' || rec.kind === 'rpmc_ancestor_none' || rec.kind === 'aq1_miss') pulse.novel++;
        if (rec.wrote_pack === true || (rec.backend_fill && rec.backend_fill.wrote_pack === true)) pulse.packs++;
      }
    }
    /* Read-only snapshot of this mesh. Does not tick. The phone timer lives in app_custody.js. */
    function custody(o) {
      o = o || {};
      const b = boundary();
      const kb = o.kb_count == null || o.kb_count === '' ? null : Number(o.kb_count);
      const kbN = Number.isFinite(kb) ? kb : null;
      if (kbSeen == null && kbN != null) kbSeen = kbN;
      const delta = kbN != null && kbSeen != null ? kbN - kbSeen : null;
      const novelOpen = queue.filter(g => g.kind === 'letter_hole' || g.kind === 'rpmc_ancestor_none' || g.kind === 'aq1_miss').length;
      return {
        schema: 'FORGE-CUSTODY-MONITOR/v1', calls_llm: false, always_on: true, idle_gated: false, ui_click_required: false,
        schedule_law: b.schedule_law, phone_pack_publish: b.phone_pack_publish, pages_pack_ship: b.pages_pack_ship,
        publish_packs: opts.publishPacks === true, continuous_fill: b.continuous_fill, automatic_curation: true,
        researcher: 'athena', cold_curator: 'gilligan', ask: 'neo', neo_is_neil: false, answering: answering,
        daemons: DAEMONS.map(d => ({ role: d.role, duty: d.duty, runs: d.runs })),
        queued: queue.length, novel_open: novelOpen, cold_rows: athena.coldBank().length, christ_pings: pulse.christ,
        athena: { role: 'athena', duty: 'continuous_research_and_admit', runs: 'always_on', research_ticks: pulse.research, admits: pulse.athena_admits, staged: pulse.staged, quarantine: pulse.quarantine, hard_reject: pulse.hard, last: pulse.last_athena },
        gilligan: { role: 'gilligan', duty: 'cold_revisit_re_curate', runs: 'always_on', cold_recurate: pulse.cold_recurate, cold_keep: pulse.cold_keep, cold_quiet: pulse.cold_quiet, novel_ticks: pulse.novel, novel_open: novelOpen, christ_pings: pulse.christ, admits: pulse.gilligan_admits, last: pulse.last_cold },
        kb: { count: kbN, delta: delta, admits: pulse.athena_admits + pulse.gilligan_admits, hosted: true, phone_db: false, pack_stuffed: pulse.packs > 0 },
        last_step: pulse.last_step
      };
    }
    function tick(o) { const rec = stepTick(o); noteStep(rec); return rec; }
    function stepTick(o) {
      o = o || {};
      const busy = o.answering === true || answering;
      athena.noteAsk(busy);
      if (busy || athena.askHeld()) return { ok: false, ran: false, schema: SCHEMA, always_on: true, idle_gated: false, rule: 'DREAM-IDLE-BUSY', calls_llm: false, researcher: 'athena' };
      if (athena.listActive().some(h => h.task === 'resonance_place' || h.task === 'pack_append')) {
        return { ok: false, ran: false, schema: SCHEMA, always_on: true, idle_gated: false, rule: 'DREAM-ATHENA-PRIORITY', calls_llm: false, researcher: 'athena' };
      }
      const cold = revisitCold(o);
      if (!queue.length) {
        if (cold.ran) return Object.assign({ schema: SCHEMA, always_on: true, idle_gated: false, researcher: 'athena', cold_curator: 'gilligan' }, cold);
        return { ok: true, ran: false, schema: SCHEMA, always_on: true, idle_gated: false, rule: 'DREAM-IDLE-EMPTY', calls_llm: false, cold: cold, researcher: 'athena', cold_curator: 'gilligan' };
      }
      if (queue[0] && athena.listActive().some(h => h.gap_id && h.gap_id === queue[0].id)) {
        queue.push(queue.shift());
        return { ok: true, ran: false, schema: SCHEMA, rule: 'DREAM-HELPER-OWNS-GAP', calls_llm: false };
      }
      const gap = queue.shift();
      const raw = researchGap(gap);
      const routed = routeMeasurement(raw);
      const rec = Object.assign({ ok: true, ran: true, gap_id: gap.id, kind: gap.kind, at: now(), always_on: true, idle_gated: false, researcher: 'athena', cold_curator: 'gilligan', cold: cold, calls_llm: false }, routed);
      if (routed.lane === 'hard_reject') {
        const ping = christPing({ initiator: 'gilligan', eps: routed.eps, ancestors: gap.ancestors, gap_id: gap.id, kind: gap.kind });
        noteChrist(ping);
        rec.christ = ping;
        rec.christ_ping = true;
        rec.recenter = ping.recenter || rec.recenter;
        rec.rule = 'GRACE-RECENTER';
        rec.aborted = true;
        rec.wrote_confirmed_shared = false;
        rec.shared_kb = false;
        gap.status = 'aborted';
        if (rec.recenter) rec.recenter.next_id = queue.length ? queue[0].id : null;
        rec.next_id = queue.length ? queue[0].id : null;
        if (ping.redirect) enqueue([ping.redirect]);
        aborted.push({ id: gap.id, kind: gap.kind, eps: routed.eps, recenter: rec.recenter, christ_ping: true, redirect_id: ping.redirect && ping.redirect.id });
      } else if (routed.lane === 'promote_candidate') {
        gap.status = 'promote_candidate';
        const staged = Object.assign({}, rec, { evidence: evidenceOf(gap, routed), status: 'staged' });
        promote.push(staged);
        if (hostReady(o)) {
          const fill = fillBackend(staged, o);
          rec.backend_fill = { ok: fill.ok === true, rule: fill.rule, wrote_confirmed_shared: fill.wrote_confirmed_shared === true, wrote_pack: fill.wrote_pack === true, phone_db: false };
          rec.wrote_confirmed_shared = fill.wrote_confirmed_shared === true;
          rec.wrote_pack = fill.wrote_pack === true;
          rec.shared_kb = fill.wrote_confirmed_shared === true;
          rec.phone_db = false;
          if (fill.ok) rec.rule = 'DREAM-BACKEND-FILL';
        }
      } else {
        gap.attempts = (gap.attempts || 0) + 1;
        gap.status = routed.lane;
        if (routed.lane === 'quarantine') quarantine.push(Object.assign({}, rec, { status: 'quarantined' }));
        if (gap.attempts < (opts.maxAttempts || MAX_ATTEMPTS)) queue.push(gap);
        rec.next_id = queue.length ? queue[0].id : null;
      }
      log.push(rec);
      if (log.length > 200) log.splice(0, log.length - 200);
      return rec;
    }

    function run(o) {
      o = o || {};
      const n = Math.max(0, Math.min(64, o.steps || 1));
      const steps = [];
      for (let i = 0; i < n; i++) {
        const t = tick({ answering: o.answering });
        steps.push(t);
        if (!t.ran) break;
      }
      return { ok: true, calls_llm: false, steps: steps };
    }

    function curatorPacket(task, rec) {
      const gap = rec && (rec.gap_id || rec.id) || null;
      return { schema: SCHEMA, calls_llm: false, task: task, parent: 'athena', spawned_by: 'athena', kind: 'helper_spawn', lane: 'spawn', gap_id: gap };
    }

    function place(rec) {
      const spawned = athena.spawnHelper({ task: 'resonance_place', parent: 'athena', spawned_by: 'athena', gap_id: rec && (rec.gap_id || rec.id) || null, packet: curatorPacket('resonance_place', rec) });
      if (!spawned.ok) return spawned;
      const out = athena.run(spawned.agent.id, { rec: rec });
      athena.retire(spawned.agent.id);
      return out;
    }

    function admitRecord(rec, o) {
      o = o || {};
      const enabled = o.admitEnabled === true || (o.admitEnabled == null && admitEnabled);
      if (answering || o.answering === true || athena.askHeld()) return refusal('DREAM-IDLE-BUSY', { role: 'athena' });
      if (!enabled) return refusal('DREAM-IDLE-ADMIT-PAUSED', { staged: true, packet: rec && rec.packet, role: 'athena' });
      const gate = athenaGate(rec);
      if (!gate.ok) {
        if (gate.rule === 'DREAM-QUARANTINE-NO-TRUTH' || gate.rule === 'DREAM-HARD-REJECT-NO-TRUTH') athena.noteCustody(rec, gate.rule);
        return gate;
      }
      const admitId = rec && (rec.gap_id || rec.id) || null;
      const held = athena.beginAdmit(admitId);
      if (held) return held;
      let wrote = false;
      try {
      const placed = place(rec);
      if (!placed.ok) return placed;
      const pkt = placed.packet || (rec && rec.packet);
      const host = o.host || opts.host;
      if (!host || typeof host.writeSharedKnowledge !== 'function') return refusal('DREAM-IDLE-NO-HOST', { packet: pkt });
      const key = o.writeKey || o.write_key || '';
      if (!key) return refusal('SHARED-KB-WRITE-KEY-REQUIRED', { packet: pkt });
      const claim = String(rec.claim || '').trim();
      if (!claim) return refusal('DREAM-IDLE-NO-CLAIM', { packet: pkt });
      const pub = packPublishPlan(opts, o);
      const letter = claimLetter(claim);
      if (pub.enabled) {
        if (!pub.dir) return refusal('DREAM-PACK-DIR-REQUIRED', { packet: pkt });
        if (!letter) return refusal('DREAM-PACK-LETTER', { packet: pkt });
      }
      const pack = {
        schema: 'FORGE-CONFIRMED-PACK/v1', format: 'FORGE-CONFIRMED-PACK/v1', provenance: 'confirmed_shared',
        letter: letter ? letter.toUpperCase() : 'T', pack_id: 'dream_idle_promote', who_confirmed: 'product_curator', shared_kb: false, phone_db: false,
        items: [{ id: 'cs:dream-' + sha256(norm(claim)).slice(0, 12), text: claim, standing: 'projectable', evidence: rec.evidence || evidenceOf(null), sfe: { Phi: pkt.sfe.Phi, eps: pkt.sfe.eps, mu: pkt.sfe.mu }, resonance: { schema: PACKET_SCHEMA, Phi: pkt.sfe.Phi, eps: pkt.sfe.eps, mu: pkt.sfe.mu } }]
      };
      const res = host.writeSharedKnowledge(JSON.stringify(pack), { writeKey: key });
      if (!res || res.ok !== true) return refusal((res && (res.rule || res.reason)) || 'DREAM-IDLE-ADMIT-FAILED', { packet: pkt, response_ok: false });
      let row = null;
      if (typeof host.sharedKnowledgeView === 'function') {
        const view = host.sharedKnowledgeView();
        row = (view.admitted || []).find(x => norm(x.text) === norm(claim));
      }
      if (!row || !row.sfe || !Number.isFinite(row.sfe.Phi)) return refusal('DREAM-IDLE-ADMIT-UNCONFIRMED', { packet: pkt });
      if (host.store && typeof host.store.load === 'function') {
        const phone = host.store.load('confirmed_shared');
        if (phone && Array.isArray(phone.facts) && phone.facts.length) return refusal('DREAM-IDLE-PHONE-DB', { packet: pkt });
      }
      wrote = true;
      const placedAgain = place(rec);
      if (!placedAgain.ok) return placedAgain;
      let published = { ok: true, wrote_pack: false, letter: null, path: null, id: null };
      if (pub.enabled) {
        const writer = athena.spawnHelper({ task: 'pack_append', parent: 'athena', spawned_by: 'athena', gap_id: admitId, packet: curatorPacket('pack_append', rec) });
        if (!writer.ok) return writer;
        published = athena.run(writer.agent.id, { item: hostedItem(claim, rec, pkt), dir: pub.dir, gate: placedAgain });
        athena.retire(writer.agent.id);
        if (!published.ok) return refusal(published.rule || 'DREAM-PACK-PUBLISH-FAILED', { packet: pkt, wrote_pack: false, role: 'athena' });
      }
      rec.status = 'admitted';
      rec.truth_support_allowed = true;
      return {
        ok: true, calls_llm: false, wrote_confirmed_shared: true, wrote_pack: published.wrote_pack === true,
        shared_kb: true, phone_db: false, rule: 'DREAM-IDLE-ADMITTED', packet: pkt, sfe: row.sfe, id: row.id,
        pack_letter: published.letter || null, pack_path: published.path || null, pack_id: published.id || null,
        pack_duplicate: published.duplicate === true, pack_publish_trigger: PACK_PUBLISH_TRIGGER
      };
      } finally {
        athena.finishAdmit(admitId, wrote);
      }
    }

    function admitStaged(o) {
      o = o || {};
      const refused = [];
      for (const q of quarantine) refused.push({ id: q.gap_id, rule: 'DREAM-QUARANTINE-NO-TRUTH', wrote_confirmed_shared: false, wrote_pack: false });
      const packets = promote.filter(p => p.packet).map(p => p.packet);
      const enabled = o.admitEnabled === true || (o.admitEnabled == null && admitEnabled);
      if (!enabled) return refusal('DREAM-IDLE-ADMIT-PAUSED', { staged: promote.length, packets: packets, refused: refused, admitted: [] });
      const admitted = [];
      for (const p of promote) {
        if (p.status === 'admitted') continue;
        const r = admitRecord(p, o);
        if (r.ok) admitted.push(r);
        else refused.push(Object.assign({ id: p.gap_id }, r));
      }
      const wrote = admitted.length > 0 && admitted.every(a => a.wrote_confirmed_shared === true);
      if (!admitted.length) return refusal(refused.length ? refused[0].rule : 'DREAM-IDLE-NO-CANDIDATE', { packets: packets, refused: refused, admitted: [] });
      const wrotePack = admitted.some(a => a.wrote_pack === true);
      return { ok: wrote && refused.every(x => x.rule === 'DREAM-QUARANTINE-NO-TRUTH' || x.wrote_confirmed_shared === false), calls_llm: false, wrote_confirmed_shared: wrote, wrote_pack: wrotePack, admitted: admitted, refused: refused, packets: packets, phone_db: false, pack_publish_trigger: PACK_PUBLISH_TRIGGER };
    }

    function schedule(o) {
      o = o || {};
      if (o.answering === true) answering = true;
      if (o.answering === false) answering = false;
      const busy = o.answering === true || answering;
      athena.noteAsk(busy);
      if (busy || athena.askHeld()) {
        return { ok: true, ran: false, always_on: true, idle_gated: false, paused_for_ask: true, rule: 'DREAM-ASK-PAUSE', calls_llm: false, mode: 'continuous', researcher: 'athena', cold_curator: 'gilligan', ui_click_required: false, resume: 'ask_clear' };
      }
      const step = tick(Object.assign({}, o, { answering: false }));
      return { ok: true, ran: step.ran === true, always_on: true, idle_gated: false, rule: 'DREAM-ALWAYS-ON', calls_llm: false, mode: 'continuous', researcher: 'athena', cold_curator: 'gilligan', ui_click_required: false, step: step, pack_publish_trigger: PACK_PUBLISH_TRIGGER };
    }

    return {
      schema: SCHEMA, boundary: boundary, enqueue: enqueue, tick: tick, run: run, schedule: schedule, custody: custody, admitRecord: admitRecord, admitStaged: admitStaged,
      athena: athena, orchestrator: athena, daemons: () => DAEMONS.map(d => Object.assign({}, d)), helpers: () => athena.helpers(),
      spawnHelper: athena.spawnHelper, forkHelper: athena.forkHelper, retireHelper: athena.retireHelper, hibernateHelper: athena.hibernateHelper, resurrectHelper: athena.resurrectHelper,
      listActive: athena.listActive, maySpawn: athena.maySpawn, mayAdmit: athena.mayAdmit, ancestry: athena.ancestry, coldBank: athena.coldBank,
      setAdmitEnabled(v) { admitEnabled = v === true; return { ok: true, admitEnabled: admitEnabled, calls_llm: false }; },
      admitEnabled: () => admitEnabled,
      setAnswering(v) { answering = v === true; athena.noteAsk(answering); return { ok: true, answering: answering, calls_llm: false }; },
      promoteCandidates: () => promote.map(p => Object.assign({}, p)),
      quarantine: () => quarantine.map(q => Object.assign({}, q)),
      aborted: () => aborted.map(a => Object.assign({}, a)),
      queued: () => queue.map(g => g.id),
      log: () => log.map(x => Object.assign({}, x)),
      christLog: () => christLog.map(x => Object.assign({}, x)),
      gapRecord(id) {
        const g = gaps.get(id);
        return g ? Object.assign({}, g, { integrations: (g.integrations || []).map(x => Object.assign({}, x)) }) : null;
      }
    };
  }

  const api = { SCHEMA, PACKET_SCHEMA, COLD_SCHEMA, HELPER_SCHEMA, CITE, INTEGRITY_HIGH, LETTERS, PACK_PUBLISH_TRIGGER, DAEMONS, HELPER_TASKS, CURATOR_TASKS, RESEARCH_TASKS, SPAWN_BUDGET, PRIORITY, PSI1, DOC_CITES, CHRIST_RULES, boundary, enumerateGaps, measure, routeMeasurement, graceRecenter, christPing, resonancePacket, athenaGate, applyResearchContract, createAthena, createIdleOrchestrator: createAthena, createIdleDream };
  if (isNode) module.exports = api; else root.KDreamIdle = api;
})(typeof self !== 'undefined' ? self : this);
