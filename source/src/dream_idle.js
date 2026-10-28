/* dream_idle.js — 4.9.169 idle dream / research worker (S1).
 * Separate from Kernel.process (the ask path). Deterministic. No LLM.
 * Gap enumerator + drift/χ lane router + grace recenter + hosted admit pathway.
 * Bands are kmath.DRIFT_RULING only (≤0.35 project, χ below 0.40, quarantine through 0.80, hard stop above).
 * Stack 6 sandbox_promoter spirit: high integrity may stage a promote-candidate. That route is not
 * dream_state_quarantine_candidate. E-05 bans stay on the quarantine lane (no truth, no stable memory, no projection).
 * Continuous admit into hosted confirmed_shared is default-off (DREAM-IDLE-ADMIT-PAUSED). Quarantine never writes it.
 * Grace recenter is χ (chiCorrect) plus the grace integral (graceOverAncestors). ChristPing is not built.
 * The optional integrity complement (ε = 1 − mean verified integrity) is a product skeleton meter when a
 * measurement is omitted. It is not driftFunctional and it is not the Mobile write law.
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
  const norm = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/\.+$/, '');

  function boundary() {
    return {
      schema: SCHEMA, calls_llm: false, separate_from_ask_path: true, phone_dream_kb: false,
      continuous_admit_default: false, quarantine_writes_confirmed_shared: false, christ_ping: false,
      drift_table: 'kmath.DRIFT_RULING', integrity_high: INTEGRITY_HIGH,
      cite: 'Nic drift ruling; E-05 quarantine honesty; Stack 6 sandbox_promoter spirit; 4.9.168 resonance packet'
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

  function measure(m) {
    m = m || {};
    const extracts = (m.extracts || []).filter(e => e && e.verified === true && String(e.text || '').trim());
    let integrity = Number.isFinite(Number(m.integrity)) ? Number(m.integrity) : null;
    if (extracts.length) {
      const vals = extracts.map(e => Number.isFinite(Number(e.integrity)) ? Number(e.integrity) : integrity).filter(n => Number.isFinite(n));
      if (vals.length) integrity = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    if (integrity != null) integrity = KM.r4(Math.min(1, Math.max(0, integrity)));
    let eps = Number.isFinite(Number(m.eps)) ? KM.r4(Math.max(0, Number(m.eps))) : null;
    let meter = eps != null ? 'measured' : null;
    if (eps == null && m.conflict === true) { eps = 0.9; meter = 'conflict'; }
    else if (eps == null && integrity != null && (extracts.length || m.verified === true)) { eps = KM.r4(Math.min(1, Math.max(0, 1 - integrity))); meter = 'integrity_complement'; }
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
    return Object.assign({ ok: false, calls_llm: false, wrote_confirmed_shared: false, shared_kb: false, phone_db: false, rule: rule }, extra || {});
  }

  function createIdleDream(opts) {
    opts = opts || {};
    const now = () => (opts.clock ? opts.clock() : '1970-01-01T00:00:00Z');
    const research = typeof opts.research === 'function' ? opts.research : null;
    let admitEnabled = opts.admitEnabled === true;
    let answering = false;
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

    function admitRecord(rec, o) {
      o = o || {};
      const enabled = o.admitEnabled === true || (o.admitEnabled == null && admitEnabled);
      if (!rec || rec.lane === 'quarantine' || rec.route === 'dream_state_quarantine_candidate') return refusal('DREAM-QUARANTINE-NO-TRUTH');
      if (rec.lane === 'hard_reject' || rec.aborted) return refusal('DREAM-HARD-REJECT-NO-TRUTH');
      if (rec.lane !== 'promote_candidate') return refusal('DREAM-IDLE-NOT-PROMOTE');
      const pkt = rec.packet;
      if (!pkt || pkt.schema !== PACKET_SCHEMA || !pkt.sfe || !Number.isFinite(pkt.sfe.Phi) || !Number.isFinite(pkt.sfe.eps) || !Number.isFinite(pkt.sfe.mu)) return refusal('DREAM-IDLE-PACKET-REQUIRED');
      if (!(pkt.sfe.eps <= KM.DRIFT_RULING.project_max) || !KM.phaseAlignedToOrigin(pkt.sfe.Phi) || !(pkt.sfe.mu > 0)) return refusal('DREAM-IDLE-DRIFT-NOT-PROJECTABLE');
      if (!enabled) return refusal('DREAM-IDLE-ADMIT-PAUSED', { staged: true, packet: pkt });
      const host = o.host || opts.host;
      if (!host || typeof host.writeSharedKnowledge !== 'function') return refusal('DREAM-IDLE-NO-HOST', { packet: pkt });
      const key = o.writeKey || o.write_key || '';
      if (!key) return refusal('SHARED-KB-WRITE-KEY-REQUIRED', { packet: pkt });
      const claim = String(rec.claim || '').trim();
      if (!claim) return refusal('DREAM-IDLE-NO-CLAIM', { packet: pkt });
      const pack = {
        schema: 'FORGE-CONFIRMED-PACK/v1', format: 'FORGE-CONFIRMED-PACK/v1', provenance: 'confirmed_shared',
        letter: 'T', pack_id: 'dream_idle_promote', who_confirmed: 'product_curator', shared_kb: false, phone_db: false,
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
      rec.status = 'admitted';
      rec.truth_support_allowed = true;
      return { ok: true, calls_llm: false, wrote_confirmed_shared: true, shared_kb: true, phone_db: false, rule: 'DREAM-IDLE-ADMITTED', packet: pkt, sfe: row.sfe, id: row.id };
    }

    function admitStaged(o) {
      o = o || {};
      const refused = [];
      for (const q of quarantine) refused.push({ id: q.gap_id, rule: 'DREAM-QUARANTINE-NO-TRUTH', wrote_confirmed_shared: false });
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
      return { ok: wrote && refused.every(x => x.rule === 'DREAM-QUARANTINE-NO-TRUTH' || x.wrote_confirmed_shared === false), calls_llm: false, wrote_confirmed_shared: wrote, admitted: admitted, refused: refused, packets: packets, phone_db: false };
    }

    return {
      schema: SCHEMA, boundary: boundary, enqueue: enqueue, tick: tick, run: run, admitRecord: admitRecord, admitStaged: admitStaged,
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

  const api = { SCHEMA, PACKET_SCHEMA, CITE, INTEGRITY_HIGH, LETTERS, boundary, enumerateGaps, measure, routeMeasurement, graceRecenter, resonancePacket, createIdleDream };
  if (isNode) module.exports = api; else root.KDreamIdle = api;
})(typeof self !== 'undefined' ? self : this);
