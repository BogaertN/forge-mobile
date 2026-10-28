/* dream_idle.js — 4.9.170 three daemons. Gilligan System Codex is not ported. No OS process pool.
 * Gilligan: gap-fill, connect-dots, novel ideas inside the drift table. Idle ticks only. Yields while Ask is answering.
 * Athena: strict curator. Admits into the hosted KB and re-checks resonance placement. Spawns declared helper tasks only.
 * Neo: Ask surface (Kernel.process). Listed here so the role map is complete. This file does not run Ask.
 * Spawn follows ProtoForge Orchestrator.spawn: a declared task list, undeclared tasks refused, deterministic, no model.
 * Helper tasks in this ship: resonance_place, pack_append. An OS helper pool is a follow-on, not a hidden side path.
 * There is no timer. Pattern Reflection is not Gilligan. No LLM. No open crawl.
 * Bands are kmath.DRIFT_RULING only (≤0.35 project, χ below 0.40, quarantine through 0.80, hard stop above).
 * Stack 6 sandbox_promoter spirit: high integrity may stage a promote-candidate. That route is not
 * dream_state_quarantine_candidate. E-05 bans stay on the quarantine lane (no truth, no stable memory, no projection).
 * Admit defaults on for the idle worker. Explicit admitEnabled:false still pauses (DREAM-IDLE-ADMIT-PAUSED).
 * A lawful promote writes the session hosted KB and appends packs/confirmed_shared/{letter}.json.
 * Pages deploys those files on push to main (.github/workflows/pages.yml → source/tools/publish.sh). This file does not deploy.
 * Explicit eps:null is unmeasured. Number(null)===0 must not count as measured zero or as projectable.
 * Omitted eps may still use the integrity complement. Research is allow-listed or curated extracts only. No open crawl.
 * Grace recenter is χ (chiCorrect) plus the grace integral (graceOverAncestors). ChristPing is not built.
 * The integrity complement is a product skeleton meter. It is not driftFunctional and it is not the Mobile write law.
 * No on-device dream KB. This file is not on the ask path and is not in the phone bundle. */
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
  const PACK_PUBLISH_TRIGGER = 'Athena spawn pack_append (after resonance_place passes) writes packs/confirmed_shared/{letter}.json and index.json. The host calls that admit only while Ask is idle. Push to main runs .github/workflows/pages.yml → source/tools/publish.sh, which ships those files. Gilligan does not publish. Neo does not publish. Nothing here deploys or loops.';
  const DAEMONS = [
    { id: 'daemon:gilligan', role: 'gilligan', duty: 'gap_fill_within_drift', runs: 'idle_only', writes_confirmed_shared: false, spawns_helpers: false },
    { id: 'daemon:athena', role: 'athena', duty: 'strict_curate_admit', runs: 'on_host_admit', writes_confirmed_shared: true, spawns_helpers: true },
    { id: 'daemon:neo', role: 'neo', duty: 'ask_surface', runs: 'kernel_process', writes_confirmed_shared: false, spawns_helpers: false, in_this_file: false }
  ];
  const HELPER_TASKS = ['resonance_place', 'pack_append'];
  const norm = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/\.+$/, '');

  function boundary() {
    return {
      schema: SCHEMA, calls_llm: false, separate_from_ask_path: true, phone_dream_kb: false,
      continuous_admit_default: true, quarantine_writes_confirmed_shared: false, quarantine_writes_packs: false,
      christ_ping: false, always_on: false, idle_gated: true, one_shot_fill: false,
      gap_research: 'idle_only', continuous_curation: 'measurement_and_custody',
      gilligan_codex_ported: false, pattern_reflection_is_gilligan: false, open_crawl: false,
      research: 'allow-listed-or-curated', os_process_pool: false, spawn_pool: 'in_process_declared_tasks',
      roles: { neo: 'ask_surface', gilligan: 'gap_fill_within_drift', athena: 'strict_curate_admit' },
      daemons: DAEMONS.map(d => d.role), helper_tasks: HELPER_TASKS.slice(),
      lifecycle: ['spawn', 'run', 'hibernate', 'retire', 'resurrect'],
      spawn_follow_on: '4.9.171',
      drift_table: 'kmath.DRIFT_RULING', integrity_high: INTEGRITY_HIGH,
      pack_publish_trigger: PACK_PUBLISH_TRIGGER,
      cite: 'Nic drift ruling; E-05 quarantine honesty; Stack 6 sandbox_promoter spirit; 4.9.168 resonance packet; Gilligan/Athena/Neo role map (codex not ported)'
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
      rule: 'GRACE-RECENTER', christ_ping: false, aborted: true, chi: chi, grace: grace,
      eps_before: Number.isFinite(Number(eps)) ? KM.r4(Number(eps)) : null, eps_after: chi.eps_after,
      cite: 'RPMC §3 χ once per path; §3.4 Grace Integral. Hard stop above 0.80 aborts the path. ChristPing is not built.'
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
    return Object.assign({ ok: false, calls_llm: false, wrote_confirmed_shared: false, wrote_pack: false, shared_kb: false, phone_db: false, rule: rule }, extra || {});
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

  /* Declared helper tasks only. Same refusal shape as ProtoForge Orchestrator.spawn (undeclared task refused). In-process. No model. No OS fork. */
  function createAthena(opts) {
    opts = opts || {};
    const now = () => (opts.clock ? opts.clock() : '1970-01-01T00:00:00Z');
    const answering = typeof opts.answering === 'function' ? opts.answering : (() => false);
    const helpers = [];
    const TASKS = {
      resonance_place: payload => athenaGate(payload && (payload.rec || payload)),
      pack_append: payload => {
        const gate = payload && payload.gate;
        if (!gate || gate.ok !== true || gate.role !== 'athena') return refusal('DREAM-ATHENA-GATE-REQUIRED', { role: 'athena' });
        if (!payload.dir || !payload.item) return refusal('DREAM-PACK-DIR-REQUIRED', { role: 'athena' });
        return publishPromotedPack(payload.item, payload.dir);
      }
    };
    function spawn(task, name) {
      if (answering()) return { ok: false, ran: false, rule: 'DREAM-IDLE-BUSY', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena' };
      if (!Object.prototype.hasOwnProperty.call(TASKS, task)) return { ok: false, rule: 'ATHENA-TASK-UNDECLARED', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena', task: task == null ? null : String(task) };
      const id = 'athena-' + (helpers.length + 1);
      const agent = { id: id, schema: 'FORGE-ATHENA-HELPER/v1', role: 'athena_helper', task: task, name: name || (task + '-' + (helpers.length + 1)), status: 'active', calls_llm: false, os_process: false, created: now() };
      helpers.push(agent);
      return { ok: true, agent: agent, calls_llm: false, wrote_pack: false, role: 'athena' };
    }
    function run(id, payload) {
      if (answering()) return { ok: false, ran: false, rule: 'DREAM-IDLE-BUSY', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena' };
      const ag = helpers.find(h => h.id === id);
      if (!ag) return { ok: false, rule: 'ATHENA-HELPER-UNKNOWN', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena' };
      if (ag.status !== 'active') return { ok: false, rule: 'ATHENA-HELPER-NOT-ACTIVE', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena' };
      const out = TASKS[ag.task](payload || {});
      if (!out || out.ok === false) return Object.assign({ ok: false, helper: ag.id, role: 'athena', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false }, out || { rule: 'ATHENA-HELPER-FAILED' });
      return Object.assign({ ok: true, helper: ag.id, role: 'athena', calls_llm: false }, out);
    }
    function transition(id, from, to) {
      const ag = helpers.find(h => h.id === id);
      if (!ag) return { ok: false, rule: 'ATHENA-HELPER-UNKNOWN', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena' };
      if (from.indexOf(ag.status) < 0) return { ok: false, rule: 'ATHENA-HELPER-NOT-ACTIVE', calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena', status: ag.status };
      ag.status = to;
      return { ok: true, agent: Object.assign({}, ag), calls_llm: false, wrote_pack: false, wrote_confirmed_shared: false, role: 'athena' };
    }
    return {
      schema: 'FORGE-ATHENA-CURATOR/v1', role: 'athena', calls_llm: false, os_process: false,
      lifecycle: ['spawn', 'run', 'hibernate', 'retire', 'resurrect'],
      tasks: () => HELPER_TASKS.slice(), spawn: spawn, run: run,
      hibernate: id => transition(id, ['active'], 'hibernated'),
      retire: id => transition(id, ['active', 'hibernated'], 'retired'),
      resurrect: id => transition(id, ['retired'], 'active'),
      helpers: () => helpers.map(h => Object.assign({}, h)),
      daemons: () => DAEMONS.map(d => Object.assign({}, d))
    };
  }

  function createIdleDream(opts) {
    opts = opts || {};
    const now = () => (opts.clock ? opts.clock() : '1970-01-01T00:00:00Z');
    const research = typeof opts.research === 'function' ? opts.research : null;
    let admitEnabled = opts.admitEnabled !== false;
    let answering = false;
    const athena = createAthena({ clock: now, answering: () => answering });
    const queue = [];
    const promote = [];
    const quarantine = [];
    const aborted = [];
    const log = [];
    const seen = new Set();

    function enqueue(gaps) {
      const added = [];
      for (const g of gaps || []) {
        const id = gapId(g);
        if (seen.has(id)) continue;
        seen.add(id);
        const row = Object.assign({ extracts: [], ancestors: [], claim: null, attempts: 0, status: 'open' }, g, { id: id });
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
      return Object.assign({}, gap, extra, { calls_llm: extra && extra.calls_llm === true });
    }

    function tick(o) {
      o = o || {};
      if (o.answering === true || answering) return { ok: false, ran: false, rule: 'DREAM-IDLE-BUSY', calls_llm: false };
      if (!queue.length) return { ok: true, ran: false, rule: 'DREAM-IDLE-EMPTY', calls_llm: false };
      const gap = queue.shift();
      const raw = researchGap(gap);
      const routed = routeMeasurement(raw);
      const rec = Object.assign({ ok: true, ran: true, gap_id: gap.id, kind: gap.kind, at: now() }, routed);
      if (routed.lane === 'hard_reject') {
        gap.status = 'aborted';
        if (rec.recenter) rec.recenter.next_id = queue.length ? queue[0].id : null;
        rec.next_id = queue.length ? queue[0].id : null;
        aborted.push({ id: gap.id, kind: gap.kind, eps: routed.eps, recenter: rec.recenter });
      } else if (routed.lane === 'promote_candidate') {
        gap.status = 'promote_candidate';
        const staged = Object.assign({}, rec, { evidence: evidenceOf(gap, routed), status: 'staged' });
        promote.push(staged);
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

    function place(rec) {
      const spawned = athena.spawn('resonance_place');
      if (!spawned.ok) return spawned;
      return athena.run(spawned.agent.id, { rec: rec });
    }

    function admitRecord(rec, o) {
      o = o || {};
      const enabled = o.admitEnabled === true || (o.admitEnabled == null && admitEnabled);
      if (answering || o.answering === true) return refusal('DREAM-IDLE-BUSY', { role: 'athena' });
      if (!enabled) return refusal('DREAM-IDLE-ADMIT-PAUSED', { staged: true, packet: rec && rec.packet, role: 'athena' });
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
      const placedAgain = place(rec);
      if (!placedAgain.ok) return placedAgain;
      let published = { ok: true, wrote_pack: false, letter: null, path: null, id: null };
      if (pub.enabled) {
        const writer = athena.spawn('pack_append');
        if (!writer.ok) return writer;
        published = athena.run(writer.agent.id, { item: hostedItem(claim, rec, pkt), dir: pub.dir, gate: placedAgain });
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

    function schedule() {
      return { ok: false, ran: false, always_on: false, idle_gated: true, rule: 'DREAM-IDLE-GATED', calls_llm: false, pack_publish_trigger: PACK_PUBLISH_TRIGGER };
    }

    return {
      schema: SCHEMA, boundary: boundary, enqueue: enqueue, tick: tick, run: run, schedule: schedule, admitRecord: admitRecord, admitStaged: admitStaged,
      athena: athena, daemons: () => DAEMONS.map(d => Object.assign({}, d)), helpers: () => athena.helpers(),
      setAdmitEnabled(v) { admitEnabled = v === true; return { ok: true, admitEnabled: admitEnabled, calls_llm: false }; },
      admitEnabled: () => admitEnabled,
      setAnswering(v) { answering = v === true; return { ok: true, answering: answering, calls_llm: false }; },
      promoteCandidates: () => promote.map(p => Object.assign({}, p)),
      quarantine: () => quarantine.map(q => Object.assign({}, q)),
      aborted: () => aborted.map(a => Object.assign({}, a)),
      queued: () => queue.map(g => g.id),
      log: () => log.map(x => Object.assign({}, x))
    };
  }

  const api = { SCHEMA, PACKET_SCHEMA, CITE, INTEGRITY_HIGH, LETTERS, PACK_PUBLISH_TRIGGER, DAEMONS, HELPER_TASKS, boundary, enumerateGaps, measure, routeMeasurement, graceRecenter, resonancePacket, athenaGate, createAthena, createIdleDream };
  if (isNode) module.exports = api; else root.KDreamIdle = api;
})(typeof self !== 'undefined' ? self : this);
