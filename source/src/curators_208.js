/* curators_208.js (4.9.208): Athena and Gilligan as curators (Nic decision (f), step 4). They replace the old idle mesh on the phone.
 * Gaps: questions that Ask held (not letter coverage). Each gap is persisted on the phone.
 * Athena looks a gap up by RESONANCE. It runs the same deterministic engine Ask uses (rmc_core: resonance packets, measured
 *   drift ε, coherence C, Echo), but the memory holds ONLY trusted anchors (the shipped starter set plus the Supabase anchors
 *   cached on the phone, picked by concept). No word overlap. No Wikipedia, so Wikipedia is never a premise and is never
 *   labelled curated.
 * Athena admits only when the engine admitted: ε ≤ 0.35, C ≥ 0.87, Echo ≥ 0.85. Then the Echo RE-PARSE runs: the candidate
 *   alone is fed back as the only memory, and the engine must re-derive the same sentence for the same question, with Echo
 *   passing. The Pāṇini clause re-parse is recorded with it (informational only).
 * Gilligan guards. It checks the trust of every premise and the numeric ε before any write. The band between 0.35 and 0.40
 *   gets ONE re-measure (no invented correction). The quarantine band (0.40–0.80) is kept and re-measured only when the
 *   anchor set changes (new digest). The hard band is rejected and kept cold.
 * Writes: an admitted row goes to Supabase only through the locked-down writer (KSb.insertAdmitted: signed-in linked
 *   account, writer role, verified device signature). Otherwise the row stays on this phone as PENDING. A pending row is
 *   not fed to Ask as memory.
 * Bands: KMath.classifyDrift (4.9.211 DRIFT-SPEC/v1: ε ≥ 0.80 is hard, inclusive; one χ-correct pass whose re-measure must fall;
 *   the gap's ε trajectory feeds the trend rule; a broken receipt hash chain halts the curators). No LLM. No embeddings. */
(function (root) {
'use strict';
const KEY = 'forge.curation.v1', SCHEMA = 'FORGE-CURATION/v1';
const ENVELOPE = 'FORGE-GAP-ENVELOPE/v1', EXPORT_SCHEMA = 'FORGE-GAP-EXPORT/v1';
const DISCLOSURE = 'This file stays on this device until you move it. It may contain personal questions. The hash detects corruption. It is not a credential and it does not authorize a write.';
const MAX_QUEUE = 60, MAX_ATTEMPTS = 3;
const SECRET_KEY = /proof|signer|password|authorization|credential|api[_-]?key|signature/i;
function canon(o) { if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}'; return JSON.stringify(o); }
function sha256of(s) { const sha = (typeof require === 'function' ? require('./sha256.js').sha256 : (root.KSha && root.KSha.sha256)); return sha(s); }
function stripSecrets(v) {
  if (Array.isArray(v)) return v.map(stripSecrets);
  if (!v || typeof v !== 'object') return v;
  const out = {};
  for (const k of Object.keys(v)) { if (SECRET_KEY.test(k) || /^(token|nonce|secret)$/i.test(k)) continue; const x = stripSecrets(v[k]); if (x !== undefined) out[k] = x; }
  return out;
}
function qframeOf(row, extra) {
  const q = (extra && extra.qframe) || (row && row.qframe) || null;
  if (!q || typeof q !== 'object' || q.valid === false) return null;
  let frame = null;
  if (q.schema === 'forge.qframe/v1' && (q.text || q.rule || q.kriya)) frame = q;
  else if (q.frame && typeof q.frame === 'object') frame = Object.assign({ schema: 'forge.qframe/v1' }, q.frame);
  return frame ? stripSecrets(frame) : null;
}
function simOf(row, extra) {
  const raw = (extra && extra.sim) || null;
  const problem = raw && raw.problem && typeof raw.problem === 'object' ? raw.problem : raw;
  if (!problem || typeof problem !== 'object' || problem.ok === true) return null;
  if (!problem.reason && problem.missing == null) return null;
  const scene = problem.scene && typeof problem.scene === 'object' ? problem.scene : {};
  const facts = Array.isArray(problem.facts) ? problem.facts : [];
  return { schema: problem.schema || 'FORGE-SIM-PROBLEM/v1', ok: false, reason: problem.reason || null, missing: problem.missing == null ? null : problem.missing,
    substance: problem.substance || problem.molecule || null, body: problem.body || (scene.body && scene.body.noun) || null,
    defaulted: Array.isArray(scene.defaulted) ? scene.defaulted.slice() : [],
    facts: facts.filter(f => f && typeof f === 'object').map(f => ({ property: f.property || null, value: f.value, unit: f.unit == null ? null : f.unit, hosts: Array.isArray(f.hosts) ? f.hosts.slice() : [], source: f.source || (f.average ? 'two_publishers' : null) })),
    calls_llm: false };
}
function gapEnvelope(question, row, extra) {
  let frame = qframeOf(row, extra);
  if (frame && !frame.text && question) frame = Object.assign({}, frame, { text: question });
  const sim = simOf(row, extra);
  if (!frame && !sim) return null;
  return { schema: ENVELOPE, question: question, qframe: frame, sim: sim, calls_llm: false, write_authority: false };
}
function openSnapshot(p) {
  if (!p || !p.question) return null;
  const question = norm(p.question);
  const options = Array.isArray(p.options) ? p.options.filter(o => o && typeof o === 'object').map(o => ({ label: o.label || null, sense: o.sense || null, concept: o.concept || null })) : [];
  return { schema: ENVELOPE, lane: 'awaiting_user', key: gapKey(question), question: question,
    continuation: { kind: p.kind || null, question: question, word: p.word || null, options: options },
    calls_llm: false, write_authority: false };
}
function exportDocument(state, openTurn) {
  const src = state && state.schema === SCHEMA ? state : { schema: SCHEMA, queue: [], pending: [], admitted: [], quarantine: [], cold: [], digest: null };
  const copy = (list, lane) => (Array.isArray(list) ? list : []).map(r => { const row = stripSecrets(JSON.parse(JSON.stringify(r))); if (row.gap) row.gap = Object.assign({}, row.gap, { lane: lane, write_authority: false }); return row; });
  const curation = { schema: SCHEMA, queue: copy(src.queue, 'queue'), pending: copy(src.pending, 'pending'), quarantine: copy(src.quarantine, 'quarantine'), cold: copy(src.cold, 'cold'), admitted: copy(src.admitted, 'admitted'), digest: src.digest || null };
  const open = openSnapshot(openTurn);
  const openTurns = [];
  if (open) {
    const lists = ['queue', 'quarantine', 'cold'];
    const hit = lists.reduce((a, k) => a || curation[k].find(r => r.key === open.key), null);
    if (hit && hit.gap && hit.gap.lane !== 'pending') { hit.continuation = open.continuation; hit.awaiting_user = true; }
    else if (!hit) openTurns.push(open);
  }
  const body = { schema: EXPORT_SCHEMA, disclosure: DISCLOSURE, calls_llm: false, supabase_write: false, write_authority: false, curation: curation, open_turns: openTurns };
  body.canonical_sha256 = sha256of(canon(body));
  return body;
}
const QWORD = /^(what|who|whom|whose|why|how|when|where|which|is|are|was|were|do|does|did|can|could|should|would|will)\b/i;
function norm(q) { return String(q || '').replace(/\s+/g, ' ').trim(); }
function gapKey(q) { return norm(q).toLowerCase().replace(/[?.!\s]+$/, ''); }
/* 4.9.211: lanes come from the ONE ordered drift classifier (KMath.classifyDrift, DRIFT-SPEC/v1): forbidden and ε ≥ 0.80 (inclusive)
 * are hard (kept cold), acceleration and θ_admit < ε < 0.40 are the χ-correct lane, 0.40 ≤ ε < 0.80 is quarantine, ε ≤ θ_admit is clean. */
const REGION_LANE = { clean: 'clean', correct: 'correct', acceleration: 'correct', explore: 'quarantine', hard_stop: 'hard', forbidden: 'hard', unmeasured: 'unmeasured' };
function laneOf(eps, KM, region) {
  if (region && REGION_LANE[region]) return REGION_LANE[region];
  if (typeof eps !== 'number' || !isFinite(eps)) return 'unmeasured';
  const r = KM && KM.classifyDrift ? KM.classifyDrift({ eps }).region : (eps <= 0.35 ? 'clean' : eps < 0.40 ? 'correct' : eps < 0.80 ? 'explore' : 'hard_stop');
  return REGION_LANE[r] || 'hard';
}
function Curators(o) {
  o = o || {};
  const now = () => (o.now ? o.now() : Date.now());
  const KM = o.kmath || root.KMath || null;
  const load = () => { try { const s = o.store ? o.store.get(KEY) : null; return s && s.schema === SCHEMA ? s : null; } catch (e) { return null; } };
  let st = load() || { schema: SCHEMA, queue: [], admitted: [], pending: [], quarantine: [], cold: [], simulated: [], log: [], digest: null };
  if (!Array.isArray(st.simulated)) st.simulated = [];
  let busy = false, answering = false, halted = null, inflight = null;
  const save = () => { try { if (o.store) o.store.set(KEY, st); } catch (e) { /* storage full: keep this session */ } };
  const log = (who, rule, extra) => { st.log.push(Object.assign({ at: now(), who, rule }, extra || {})); if (st.log.length > 60) st.log = st.log.slice(-60); };
  const known = k => st.queue.concat(st.admitted, st.pending, st.quarantine, st.cold, st.simulated).some(g => g.key === k);
  async function book(method, rule, facts, flags) {
    if (typeof o.book !== 'function') return null;
    try {
      const booked = await o.book(Object.assign({ ledger: st.ledger || null, method: method, rule: rule, facts: facts || [] }, flags || {}));
      if (booked && booked.ledger) { st.ledger = booked.ledger; if (typeof o.publishLedger === 'function') o.publishLedger(st.ledger); }
      return booked;
    } catch (e) { return null; }
  }
  function noteHeld(question, row, extra) {
    const q = norm(question); const k = gapKey(q);
    if (!q || q.length < 6 || q.length > 200 || !(/\?$/.test(q) || QWORD.test(q))) return { ok: false, rule: 'CURATE-NOT-A-QUESTION' };
    if (row && row.product_reply) return { ok: false, rule: 'CURATE-ALREADY-ANSWERED' };
    if (known(k)) return { ok: false, rule: 'CURATE-GAP-KNOWN' };
    const item = { key: k, question: q, added_at: now(), attempts: 0, source: 'ask_held', held_rule: row && row.route || null };
    const gap = gapEnvelope(q, row, extra);
    if (gap) item.gap = gap;
    st.queue.push(item);
    if (st.queue.length > MAX_QUEUE) st.queue = st.queue.slice(-MAX_QUEUE);
    log('athena', 'CURATE-GAP-QUEUED', { question: q }); save();
    return { ok: true, rule: 'CURATE-GAP-QUEUED' };
  }
  async function measure(question, anchors, extra) {
    /* 4.9.210: cached anchors (pool: true) go to the engine pool; the engine selects them by packet concepts */
    const pool = anchors.filter(a => a && a.pool === true);
    const hosted = typeof o.premises === 'function' ? (o.premises() || []) : [];
    const phone = typeof o.phone === 'function' ? (o.phone() || []) : [];
    const simulation = typeof o.simulation === 'function' ? (o.simulation(question) || []) : [];
    const memory = { receipts: [], phone: phone.filter(r => r && (r.text || r.clause)), hosted: hosted, research: [], simulation: simulation, anchors: anchors.filter(a => !(a && a.pool === true)), pools: pool.length ? [{ name: 'anchors', into: 'anchors', rows: pool }] : [] };
    const row = await o.run(Object.assign({ question, live: true, dry_run: false, memory }, extra || {}));
    const eps = row && typeof row.drift === 'number' ? row.drift : null;
    const region = row && row.admit && row.admit.drift_region;
    return { row, eps, C: row && row.coherence, echo: row && row.echo || {}, lane: laneOf(eps, KM, region), region: region || null };
  }
  /* Echo re-parse: the candidate alone must re-derive itself for the same question, Echo passing; and the grammar must round-trip it */
  async function echoReparse(question, reply, anchor) {
    const solo = Object.assign({}, anchor || {}, { id: (anchor && anchor.id) || 'candidate', text: reply });
    const again = await o.run({ question, live: true, dry_run: false, memory: { receipts: [], phone: [], hosted: [], research: [], anchors: [solo] } });
    const same = !!(again && again.product_reply && again.reply === reply && again.echo && again.echo.pass === true && again.echo.score >= 0.85);
    let clause = null; if (o.reparse) { try { clause = o.reparse(reply); } catch (e) { clause = null; } }
    const grammar = o.reparse ? !!clause : null;
    /* the engine re-derivation with Echo is the gate; the old JS clause grammar is recorded only (it does not parse most encyclopedic sentences) */
    return { ok: same, engine_same: same, echo: again && again.echo ? again.echo.score : null, grammar_round_trip: grammar, grammar_gates: false };
  }
  /* Gilligan's guard before any write */
  function guard(m, anchors) {
    const t = (m.row && m.row.trust) || {};
    const byId = new Map(anchors.map(a => [a.id, a]));
    if (typeof m.eps !== 'number' || m.lane !== 'clean') return { ok: false, rule: 'GILLIGAN-DRIFT-NOT-CLEAN' };
    if (!(m.C >= 0.87) || !(m.echo && m.echo.pass === true && m.echo.score >= 0.85)) return { ok: false, rule: 'GILLIGAN-GATE-NOT-MET' };
    const rest = t.rests_on, anchor = rest ? byId.get(rest) : null;
    const researched = rest && typeof o.premises === 'function' ? (o.premises() || []).find(r => r && r.id === rest) : null;
    if (t.low_trust !== false || t.blocks_admit !== false || t.trusted_anchor !== true || (!anchor && !researched) || (anchor && anchor.trust !== 'trusted')) return { ok: false, rule: 'GILLIGAN-UNTRUSTED-PREMISE', ids: [rest || null] };
    const who = String((anchor && anchor.contributor) || '') + ' ' + String((anchor && anchor.source_url) || '') + ' ' + JSON.stringify((researched && researched.provenance) || {});
    if (/wikipedia|wikimedia|wikidata/i.test(who)) return { ok: false, rule: 'GILLIGAN-WIKIPEDIA-NEVER-PREMISE' };
    return { ok: true, rule: 'GILLIGAN-GUARD-OK', premises: [rest] };
  }
  function pickAnchor(row, anchors) {
    const rest = row && row.trust && row.trust.rests_on;
    const researched = rest && typeof o.premises === 'function' ? (o.premises() || []).find(r => r && r.id === rest) : null;
    return anchors.find(a => a.id === rest) || researched || anchors.find(a => a.text === (row && row.reply)) || null;
  }
  async function curate(gap) {
    if (gap.next_at && now() < gap.next_at) return { to: 'queue', rec: { key: gap.key, question: gap.question, rule: 'ATHENA-BACKOFF', at: now(), calls_llm: false } };
    if (gap.gap && gap.gap.sim && o.research && !gap.researched) {
      let found = null;
      try { found = await o.research(gap); } catch (e) { found = { rule: 'ATHENA-LOOKUP-FAILED', error: String(e && e.message || e).slice(0, 160) }; }
      const rule = found && found.rule;
      if (found && found.ledger) { st.ledger = found.ledger; if (typeof o.publishLedger === 'function') o.publishLedger(st.ledger); }
      if (rule === 'ATHENA-PROPERTY-MISSING') {
        gap.attempts = (gap.attempts || 0) + 1; gap.last_at = now();
        gap.next_at = now() + [15000, 30000, 120000, 600000][Math.min((gap.attempts || 1) - 1, 3)];
        return { to: gap.attempts >= 3 ? 'cold' : 'queue', rec: { key: gap.key, question: gap.question, rule: rule, at: now(), calls_llm: false, gap: gap.gap } };
      }
      gap.researched = true;
      gap.research = found;
      if (rule === 'ATHENA-DISAGREEMENT') { gap.attempts = (gap.attempts || 0) + 1; gap.last_at = now(); return { to: 'quarantine', rec: { key: gap.key, question: gap.question, rule: rule, at: now(), calls_llm: false, gap: gap.gap } }; }
      if (rule === 'ATHENA-PERSONAL') { gap.attempts = (gap.attempts || 0) + 1; gap.last_at = now(); return { to: 'cold', rec: { key: gap.key, question: gap.question, rule: rule, at: now(), calls_llm: false, gap: gap.gap } }; }
      if (rule === 'ATHENA-SIMULATED' && found && found.receipt && found.receipt.ok && typeof o.rememberSimulation === 'function') o.rememberSimulation(gap.question, found.receipt.rows || []);
      else if (!(found && found.proposals && found.proposals.length)) {
        const wait = [15000, 30000, 120000, 600000][Math.min(gap.attempts || 0, 3)];
        gap.next_at = now() + wait;
        gap.attempts = (gap.attempts || 0) + 1; gap.last_at = now();
        return { to: gap.attempts >= 3 ? 'cold' : 'queue', rec: { key: gap.key, question: gap.question, rule: rule || 'ATHENA-NO-AGREEMENT', at: now(), calls_llm: false, gap: gap.gap } };
      } else if (typeof o.rememberResearch === 'function') o.rememberResearch(found.proposals);
    }
    gap.attempts += 1; gap.last_at = now();
    const anchors = (await o.anchorsFor(gap.question)) || [];
    /* 4.9.211: the gap's own ε trajectory feeds the trend rule (ε rising over 3 transitions → correct) */
    const hist = Array.isArray(gap.eps_hist) ? gap.eps_hist.slice(-8) : [];
    let m = await measure(gap.question, anchors, { drift_history: hist });
    let chi = false, fell = null;
    if (m.lane === 'correct') {
      /* ONE χ-correct pass per ψ per turn (DRIFT-SPEC D6a), then re-measure: the drift must FALL or the gap stays in quarantine */
      chi = true; const before = m.eps; log('gilligan', 'GILLIGAN-REMEASURE-ONCE', { question: gap.question, eps: m.eps });
      if (o.refreshAnchors) { try { await o.refreshAnchors(); } catch (e) { /* offline */ } }
      m = await measure(gap.question, (await o.anchorsFor(gap.question)) || anchors, { chi_passes: 1 });
      fell = typeof m.eps === 'number' && typeof before === 'number' && m.eps < before;
      if (!fell && m.lane === 'clean') m = Object.assign({}, m, { lane: 'correct', region: 'correct' });
    }
    if (typeof m.eps === 'number') gap.eps_hist = hist.concat([m.eps]).slice(-8);
    const base = { key: gap.key, question: gap.question, eps: m.eps, C: m.C, echo: m.echo && m.echo.score, lane: m.lane, region: m.region, chi_pass: chi, chi_fell: fell, at: now(), calls_llm: false };
    if (gap.gap) base.gap = gap.gap;
    if (m.lane === 'hard') return { to: 'cold', rec: Object.assign(base, { rule: m.region === 'forbidden' ? 'ATHENA-FORBIDDEN-REJECT' : 'ATHENA-HARD-REJECT' }) };
    if (m.lane === 'quarantine' || m.lane === 'correct') return { to: 'quarantine', rec: Object.assign(base, { rule: m.lane === 'correct' ? (chi && fell === false ? 'GILLIGAN-CHI-DID-NOT-FALL' : 'GILLIGAN-STILL-CORRECT-BAND') : 'ATHENA-QUARANTINE', digest: st.digest }) };
    if (!m.row || !m.row.product_reply || !m.row.reply) return { to: gap.attempts >= MAX_ATTEMPTS ? 'cold' : 'queue', rec: Object.assign(base, { rule: anchors.length ? 'ATHENA-NO-ADMIT' : 'ATHENA-NO-TRUSTED-ANCHOR', reply: null }) };
    const phone = typeof o.phone === 'function' ? (o.phone() || []) : [];
    const rests = m.row.trust && m.row.trust.rests_on;
    const looked = gap.research && (gap.research.method === 'lookup' || gap.research.method === 'simulate' || (gap.research.proposals && gap.research.proposals.length));
    if (!looked && phone.some(r => r && r.id === rests)) gap.research = { rule: 'ATHENA-DERIVED', method: 'derive' };
    const g = guard(m, anchors);
    if (!g.ok) return { to: 'quarantine', rec: Object.assign(base, { rule: g.rule, ids: g.ids || [] }) };
    let echo;
    if (gap.research && gap.research.method === 'simulate') {
      const rows = typeof o.simulation === 'function' ? (o.simulation(gap.question) || []) : [];
      const said = String(m.row.reply || '').toLowerCase();
      const forms = [];
      rows.forEach(r => { if (!r) return; if (r.text) forms.push(String(r.text).toLowerCase()); if (r.sim && r.sim.effect_text) forms.push(String(r.sim.effect_text).toLowerCase()); ((r.sim && r.sim.spoken_atoms) || []).forEach(s => { if (s && s.text) forms.push(String(s.text).toLowerCase()); }); });
      const bare = said.replace(/\.+$/, '');
      const hit = forms.some(t => { const b = t.replace(/\.+$/, ''); return b && (bare.indexOf(b) >= 0 || b.indexOf(bare) >= 0); });
      echo = { ok: !!(m.echo && m.echo.pass === true && m.echo.score >= 0.85 && hit), engine_same: hit, echo: m.echo && m.echo.score, grammar_gates: false };
    } else echo = await echoReparse(gap.question, m.row.reply, pickAnchor(m.row, anchors));
    if (!echo.ok) return { to: 'quarantine', rec: Object.assign(base, { rule: 'ATHENA-ECHO-REPARSE-FAILED', reply: m.row.reply, echo_reparse: echo }) };
    /* 4.9.209: Ask returns the admitted row as a proposal (no auto-write); Athena's curation write takes it through the locked writer */
    const mw = m.row.memory_write || {}; const prop = mw.proposal || mw.hosted_kb;
    const premise = pickAnchor(m.row, anchors);
    const body = prop ? Object.assign({}, prop, { provenance: Object.assign({}, prop.provenance || {}, (premise && premise.provenance) || {}, { curated_by: 'athena+gilligan' }) }) : null;
    const rec = Object.assign(base, { reply: m.row.reply, premises: g.premises, echo_reparse: echo, contributor: 'athena', curated_by: 'athena+gilligan' });
    /* 4.9.211: the lasting write needs the engine's write gate (Φ6 then Φ7, Echo ≥ 0.97 + classes, C ≥ 0.87, clean at θ_admit) */
    if (gap.research && (gap.research.method === 'simulate' || gap.research.method === 'derive')) {
      const method = gap.research.method;
      await book(method, method === 'simulate' ? 'ATHENA-SIMULATED' : 'GILLIGAN-DERIVED', []);
      return { to: 'simulated', rec: Object.assign(rec, { rule: method === 'simulate' ? 'GILLIGAN-SIMULATED' : 'GILLIGAN-DERIVED', may_store_as_fact: false }) };
    }
    if (mw.write_gate && mw.write_gate.ok !== true) { await book('lookup', 'GILLIGAN-WRITE-GATE', []); return { to: 'quarantine', rec: Object.assign(rec, { rule: 'GILLIGAN-WRITE-GATE', failed: mw.write_gate.failed || [] }) }; }
    const agreed = (gap.research && gap.research.proposals) || [];
    if (agreed.length) await book('lookup', 'ATHENA-ADMITTED', agreed, { admitted: true });
    if (!body || !o.insert) return { to: 'pending', rec: Object.assign(rec, { rule: 'CURATE-PENDING-NO-WRITER' }) };
    const w = await o.insert(body);
    /* a broken receipt hash chain halts the curators and quarantines the row (DRIFT-SPEC: a chain break halts and quarantines) */
    if (w && w.rule === 'KB-WRITER-CHAIN-BREAK') { halted = { rule: w.rule, at: now() }; return { to: 'quarantine', rec: Object.assign(rec, { rule: 'GILLIGAN-CHAIN-BREAK-HALT' }) }; }
    if (w && w.ok) return { to: 'admitted', rec: Object.assign(rec, { rule: 'CURATE-WRITTEN', supabase: { id: w.id || null, rule: w.rule || null } }) };
    return { to: 'pending', rec: Object.assign(rec, { rule: (w && w.rule) || 'CURATE-PENDING', body }) };
  }
  async function tick(t) {
    if (halted) return { ok: false, rule: 'CURATE-HALTED-CHAIN-BREAK', since: halted.at };
    if (busy || answering || !o.run || !o.anchorsFor) return { ok: false, rule: busy ? 'CURATE-BUSY' : answering ? 'CURATE-ASK-ANSWERING' : 'CURATE-NO-ENGINE' };
    busy = true;
    try {
      const digest = o.digest ? await o.digest() : null;
      if (digest && digest !== st.digest) { /* Gilligan: a new anchor set re-opens the quarantine once */
        const back = st.quarantine.filter(r => r.digest !== digest); st.quarantine = st.quarantine.filter(r => r.digest === digest);
        for (const r of back) st.queue.push(Object.assign({ key: r.key, question: r.question, added_at: now(), attempts: 0, source: 'gilligan_requarantine' }, r.gap ? { gap: r.gap } : {}));
        if (back.length) log('gilligan', 'GILLIGAN-REOPEN-QUARANTINE', { n: back.length });
        st.digest = digest;
      }
      const gap = st.queue.shift();
      if (!gap) { save(); return { ok: true, rule: 'CURATE-IDLE' }; }
      inflight = gap;
      let out;
      try { out = await curate(gap); } catch (e) { out = { to: gap.attempts >= MAX_ATTEMPTS ? 'cold' : 'queue', rec: { key: gap.key, question: gap.question, rule: 'CURATE-ENGINE-ERROR', error: String(e && e.message || e).slice(0, 200), at: now() } }; }
      if (out && out.rec) out.rec.athena = gap.research && gap.research.rule || null;
      if (out.to === 'queue') st.queue.push(Object.assign(gap, { last: out.rec.rule }));
      else st[out.to].push(out.rec);
      for (const k of ['admitted', 'pending', 'quarantine', 'cold', 'simulated']) if (st[k] && st[k].length > 200) st[k] = st[k].slice(-200);
      log(out.to === 'quarantine' || out.to === 'cold' ? 'gilligan' : 'athena', out.rec.rule, { question: gap.question, eps: out.rec.eps });
      save();
      return { ok: true, rule: out.rec.rule, to: out.to, rec: out.rec };
    } finally { inflight = null; busy = false; }
  }
  /* a pending row is retried through the same locked-down writer (e.g. after sign-in) */
  async function flushPending() {
    if (!o.insert || busy) return { ok: false, rule: 'CURATE-BUSY' };
    const left = []; let written = 0;
    for (const r of st.pending) { if (!r.body) { left.push(r); continue; } const w = await o.insert(r.body); if (w && w.ok) { written++; st.admitted.push(Object.assign({}, r, { rule: 'CURATE-WRITTEN', body: undefined, supabase: { id: w.id || null } })); } else { r.rule = (w && w.rule) || r.rule; left.push(r); } }
    st.pending = left; save(); return { ok: true, written, pending: left.length };
  }
  function status() { return { schema: SCHEMA, queued: st.queue.length + (inflight ? 1 : 0), admitted: st.admitted.length, pending: st.pending.length, quarantine: st.quarantine.length, cold: st.cold.length, last: st.log[st.log.length - 1] || null, digest: st.digest, calls_llm: false }; }
  function state() {
    const copy = JSON.parse(JSON.stringify(st));
    if (inflight && !copy.queue.some(g => g.key === inflight.key)) copy.queue.unshift(JSON.parse(JSON.stringify(inflight)));
    return copy;
  }
  return { noteHeld, tick, flushPending, status, state, setAnswering: on => { answering = on === true; }, laneOf: e => laneOf(e, KM) };
}
const api = { Curators, laneOf, gapKey, SCHEMA, ENVELOPE, EXPORT_SCHEMA, DISCLOSURE, exportDocument, canon, stripSecrets };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KCuratorsLib = api;
})(typeof self !== 'undefined' ? self : this);
