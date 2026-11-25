/* Resonant Key Memory (key 0.2.0). An index over structured clauses, not a second store of truth.
 * Nic t315u, 25 Nov 2026: the research decisions override spec 0.1. SHA-256, not BLAKE3.
 * Bands follow band_tuning.js (ripple 80–220 Hz, 144 inside). 72 Hz is high gamma, links between items.
 * Delta slots use the grammar's role names. Tuning never speaks and never moves a gate. calls_llm is false. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const SHA = isNode ? require('./sha256.js') : root.KSha;
  const SCHEMA = 'FORGE-RKM/v1';
  const KEY_ID = 'forge.harmonic_key';
  const KEY_VERSION = '0.2.0';
  const H = 168 * 3600;
  const DELTA = ['kriya', 'kartr', 'karma', 'karana', 'sampradana', 'apadana', 'adhikarana', 'vidheya', 'hetu'];
  const GAMMA = ['head', 'class', 'attribute', 'value', 'unit', 'part_whole', 'alias', 'publisher', 'evidence'];
  const THETA = ['held', 'neo', 'athena', 'gilligan', 'resumed', 'seq_6', 'seq_7', 'seq_8', 'seq_9'];
  const ALPHA = ['pass', 'suppress_irrelevant', 'suppress_contradicted', 'hold_pending', 'speculative', 'ghost', 'tier_cold', 'tier_deep', 'quarantine_peer'];
  const SILENT = { speculative: true, ghost: true, quarantine_peer: true };
  const BANDS = [
    { index: 0, name: 'delta', range: [1, 4], carrier: 2.25, q: 6, kappa: 12, half: 52 * H, floor: 0.25, kind: 'verified fact' },
    { index: 1, name: 'theta', range: [4, 8], carrier: 4.5, q: 3, kappa: 6, half: 4 * H, floor: 0, kind: 'sequence' },
    { index: 2, name: 'alpha', range: [8, 13], carrier: 9, q: 8, kappa: 16, half: 3600, floor: 0, kind: 'gate' },
    { index: 3, name: 'beta', range: [13, 30], carrier: 18, q: 4, kappa: 12, half: 900, floor: 0, kind: 'task' },
    { index: 4, name: 'gamma', range: [30, 80], carrier: 36, q: 4, kappa: 10, half: H, floor: 0, kind: 'binding within one item' },
    { index: 5, name: 'ripple', range: [80, 220], carrier: 144, q: 3, kappa: 6, half: 60, floor: 0, kind: 'replay' },
    { index: 6, name: 'high_gamma', range: [60, 140], carrier: 72, q: 4, kappa: 10, half: H, floor: 0, kind: 'links between items' }
  ];
  const LIT = 0.5, NEAR = 0.05, EPS = 0.05, PAC = 0.9, COLLECT = 0.05, ACTIVE = 0.1;
  const FLAGS = { VERIFIED_REF: 32, SPECULATIVE: 16, CONTRADICTS: 8, REQUEST: 4, CONT: 2 };
  function canon(o) {
    if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']';
    if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}';
    return JSON.stringify(o);
  }
  function sha(s) { return SHA.sha256(typeof s === 'string' ? s : canon(s)); }
  function shaBytes(list) { return SHA.sha256Bytes(list); }
  function hexToBytes(h) { const o = []; for (let i = 0; i < h.length; i += 2) o.push(parseInt(h.slice(i, i + 2), 16)); return o; }
  function bytesToHex(b) { return Array.from(b).map(x => (x & 255).toString(16).padStart(2, '0')).join(''); }
  const structure = { key_id: KEY_ID, key_version: KEY_VERSION, root_hz: 144, slots: 9, spacing_deg: 40, hash: 'sha256', ripple: [80, 220], high_gamma_hz: 72, phi9: 'transition', anchors: [1, 0.5, 3], delta: DELTA, gamma_extra: ['sambandha', 'vishaya', 'upadhi'], bands: BANDS.map(b => ({ name: b.name, carrier: b.carrier, range: b.range, q: b.q, kappa: b.kappa, half: b.half, floor: b.floor })) };
  const structureHash = sha(canon(structure));
  const structureFp = structureHash.slice(0, 8);
  const fullHash = sha(canon(Object.assign({ structure: structureHash }, { lit: LIT, near: NEAR, eps: EPS, pac: PAC, collect: COLLECT })));
  if (structureFp !== structureHash.slice(0, 8)) throw new Error('RKM-KEY-FINGERPRINT');
  const bandBy = name => BANDS.find(b => b.name === name);
  function pack(band, slot, ampQ, parentBand, parentSlot, flags) {
    const w = ((band & 7) << 21) | ((slot & 15) << 17) | ((ampQ & 15) << 13) | ((parentBand & 7) << 10) | ((parentSlot & 15) << 6) | (flags & 63);
    return w.toString(16).padStart(6, '0');
  }
  function phaseFit(deg, kappa) { const r = deg * Math.PI / 180; return Math.exp(kappa * (Math.cos(r) - 1)); }
  function bandFit(fm, fq, q) { if (!fm || !fq) return 0; const x = fm / fq; return 1 / (1 + q * q * Math.pow(x - 1 / x, 2)); }
  function coupling(deg) { return (1 + PAC * Math.cos(deg * Math.PI / 180)) / (1 + PAC); }
  function headOf(np) {
    if (!np) return '';
    if (Array.isArray(np.head)) return String(np.head[0] || '');
    if (np.head) return String(np.head);
    if (np.text) return String(np.text).replace(/^(a|an|the)\s+/i, '').split(/\s+/)[0];
    return '';
  }
  function atomOf(value, forge) {
    const lemma = String(value || '').toLowerCase();
    let sid = null;
    try { const ss = forge && forge.lexicon && forge.lexicon.senses ? forge.lexicon.senses(lemma) : []; if (ss && ss[0]) sid = ss[0].sid; } catch (e) { sid = null; }
    const unknown = !sid;
    const body = { k: 'forge.atom.v1', concept: sid || ('unknown:' + lemma), wn30: sid || null, type: unknown ? 'unknown' : 'lexicon', unknown: unknown };
    return { atom_id: sha(canon(body)), lemma: lemma, unknown: unknown, concept: body.concept, calls_llm: false };
  }
  function symmetricPred(name) {
    const WR = isNode ? require('./world_rules.js') : root.KWorldRules;
    const rows = WR && WR.RELATIONS ? WR.RELATIONS : [];
    return rows.some(r => r && r.symmetric === true && r.pred === name);
  }
  function rolesOf(clause, forge) {
    const roles = {};
    if (!clause || !clause.parsed) return roles;
    if (clause.kriya) roles.kriya = { t: 'relation', v: String(clause.kriya) };
    const put = (role, np) => { const v = headOf(np); if (v) roles[role] = { t: 'entity', v: v }; };
    put('kartr', clause.kartr); put('karma', clause.karma);
    const k = clause.karakas || {};
    put('karana', k.karana); put('sampradana', k.sampradana); put('apadana', k.apadana); put('adhikarana', k.adhikarana); put('hetu', k.hetu);
    if (clause.pred && clause.pred.type === 'measure') roles.vidheya = { t: 'quantity', v: String(clause.pred.num), u: String(clause.pred.unit || '') };
    else if (clause.pred) { const v = headOf(clause.pred.np || clause.pred) || String(clause.pred.text || ''); if (v) roles.vidheya = { t: 'entity', v: v }; }
    if (symmetricPred(roles.kriya && roles.kriya.v) && roles.kartr && roles.karma) {
      const a = atomOf(roles.kartr.v, forge).atom_id, b = atomOf(roles.karma.v, forge).atom_id;
      if (a > b) { const s = roles.kartr; roles.kartr = roles.karma; roles.karma = s; roles.sym = true; }
    }
    return roles;
  }
  function atomsOf(roles, forge) {
    const out = [];
    DELTA.forEach((role, slot) => {
      const cell = roles[role]; if (!cell) return;
      const atom = atomOf(cell.v, forge);
      out.push({ role: role, slot: slot, phase_deg: slot * 40, atom_id: atom.atom_id, unknown: atom.unknown, value: cell.v, unit: cell.u || null });
      if (role === 'vidheya' && cell.u) {
        out.push({ role: 'unit', band: 'gamma', slot: 4, parent_slot: slot, atom_id: atomOf(cell.u, forge).atom_id, value: cell.u });
        out.push({ role: 'value', band: 'gamma', slot: 3, parent_slot: slot, atom_id: atomOf(cell.v, forge).atom_id, value: cell.v });
      }
    });
    return out;
  }
  function factIdOf(roles) { return sha(canon({ k: 'forge.clause.v1', roles: roles })); }
  function amplitude(rec, now) {
    const band = bandBy(rec.band || 'delta');
    const dt = Math.max(0, (now || 0) - (rec.t0 || 0)) / 1000;
    const floor = rec.verified && rec.alpha === 'pass' ? band.floor : 0;
    const stretched = rec.half_life_s || band.half;
    return Math.max(floor, rec.A0 * Math.pow(2, -dt / stretched));
  }
  function create(o) {
    o = o || {};
    const KEY = 'forge.rkm.v1';
    const load = () => { try { const s = o.store ? o.store.get(KEY) : null; return s && s.schema === SCHEMA ? s : null; } catch (e) { return null; } };
    let st = load() || { schema: SCHEMA, fp: structureFp, facts: [], claims: [], leads: [], links: [], log: [], head: sha('genesis'), context: sha('context').slice(0, 12), paired: {}, clock: 0 };
    if (st.fp && st.fp !== structureFp) st = { schema: SCHEMA, fp: structureFp, facts: [], claims: [], leads: [], links: [], log: [], head: sha('genesis'), context: st.context || sha('context').slice(0, 12), paired: st.paired || {}, clock: st.clock || 0 };
    let clock = typeof st.clock === 'number' ? st.clock : 0;
    const now = () => (o.now ? o.now() : 0) + clock;
    const save = () => { st.clock = clock; st.fp = structureFp; try { if (o.store) o.store.set(KEY, JSON.parse(JSON.stringify(st))); } catch (e) { /* full */ } };
    function log(kind, extra) {
      const entry = Object.assign({ n: st.log.length, kind: kind, at: now(), prev: st.head, calls_llm: false }, extra || {});
      entry.hash = sha(canon(entry));
      st.log.push(entry); st.head = entry.hash;
      if (st.log.length > 400) st.log = st.log.slice(-400);
      return entry;
    }
    function addressOf(bandName, slot, A, parentBand, parentSlot, flags) {
      const b = bandBy(bandName);
      const ampQ = Math.max(0, Math.min(15, Math.round(A * 15)));
      return { band: bandName, band_index: b.index, slot: slot, phase_deg: slot * 40, amp_q: ampQ, parent_band: parentBand, parent_slot: parentSlot, flags: flags, compact_hex: pack(b.index, slot, ampQ, parentBand == null ? 7 : bandBy(parentBand).index, parentSlot || 0, flags), calls_llm: false };
    }
    function noteRemember(row, forge) {
      const roles = rolesOf(row && row.clause, forge || o.forge);
      if (!roles.kriya && !roles.kartr) return { ok: false, rule: 'RKM-NO-CLAUSE', calls_llm: false };
      const id = factIdOf(roles);
      if (st.facts.some(f => f.fact_id === id)) return { ok: true, rule: 'RKM-ALREADY', fact_id: id, calls_llm: false };
      const theta = st.facts.filter(f => f.context === st.context).length % 9;
      const atoms = atomsOf(roles, forge || o.forge);
      const place = root.KBandTuning && root.KBandTuning.place ? root.KBandTuning.place(row.text || '', 1) : null;
      const rec = { fact_id: id, text: row.text || '', roles: roles, atoms: atoms, band: 'delta', slot: 0, A0: 1, t0: now(), verified: true, alpha: 'pass', context: st.context, theta_slot: theta, half_life_s: bandBy('delta').half, placement: place, reads: 0, readmit: 0 };
      rec.address = addressOf('delta', 0, 1, 'theta', theta, FLAGS.VERIFIED_REF);
      st.facts.forEach(prev => {
        const shared = rec.atoms.some(a => prev.atoms.some(b => b.atom_id === a.atom_id && b.role !== 'kriya'));
        if (shared) st.links.push({ band: 'high_gamma', carrier: 72, a: prev.fact_id, b: id, role: 'between', calls_llm: false });
      });
      st.facts.push(rec);
      log('admit', { fact_id: id, address: rec.address.compact_hex });
      save();
      return { ok: true, rule: 'RKM-ADDRESSED', fact_id: id, address: rec.address, theta_slot: theta, calls_llm: false };
    }
    function queryAtoms(clause, forge) { return atomsOf(rolesOf(clause, forge || o.forge), forge || o.forge).filter(a => !a.band); }
    function scoreOne(fact, query, qBand) {
      const mem = bandBy(fact.band || 'delta');
      const qq = bandBy(qBand || 'delta');
      const B = bandFit(mem.carrier, qq.carrier, mem.q);
      const known = query.filter(a => a.role);
      if (!known.length) return { M: 0, R: 0, A: amplitude(fact, now()) };
      let prod = 1;
      known.forEach(q => {
        const hit = fact.atoms.find(a => a.atom_id === q.atom_id);
        const m = hit ? phaseFit((q.slot - hit.slot) * 40, mem.kappa) : EPS;
        prod *= Math.max(m, EPS);
      });
      let M = B * Math.pow(prod, 1 / known.length);
      if (fact.alpha && fact.alpha !== 'pass') M *= 0.1;
      const A = amplitude(fact, now());
      return { M: M, R: A * M, A: A };
    }
    function recall(clause, forge) {
      const before = sha(canon(st.facts));
      const query = queryAtoms(clause, forge);
      const rows = st.facts.map(f => Object.assign({ fact: f }, scoreOne(f, query, 'delta')));
      if (sha(canon(st.facts)) !== before) throw new Error('RKM-RECALL-MUTATED');
      const speakable = rows.filter(r => !SILENT[r.fact.alpha]);
      const lit = speakable.filter(r => r.M >= LIT).sort((a, b) => b.R - a.R);
      const near = speakable.filter(r => r.M >= NEAR && r.M < LIT).sort((a, b) => b.M - a.M);
      const chain = [];
      if (lit[0]) {
        const ctx = lit[0].fact.context;
        st.facts.filter(f => f.context === ctx).sort((a, b) => a.theta_slot - b.theta_slot).forEach(f => chain.push({ fact_id: f.fact_id, theta_slot: f.theta_slot, text: f.text, address: f.address.compact_hex }));
      }
      const lead = !lit.length && near.length ? { rule: 'RKM-ATHENA-LEAD', M: near[0].M, fact_id: near[0].fact.fact_id, spoken: false, calls_llm: false } : null;
      return { ok: true, lit: lit.map(r => ({ fact_id: r.fact.fact_id, text: r.fact.text, M: r.M, R: r.R, A: r.A, address: r.fact.address.compact_hex, theta_slot: r.fact.theta_slot })), near: near.map(r => ({ fact_id: r.fact.fact_id, M: r.M, text: r.fact.text })), chain: chain, lead: lead, store_hash: before, calls_llm: false };
    }
    function commitLead(lead) {
      if (!lead) return { ok: false, rule: 'RKM-NO-LEAD' };
      st.leads.push(Object.assign({ at: now() }, lead));
      log('athena_lead', { fact_id: lead.fact_id, M: lead.M }); save();
      return { ok: true, rule: 'RKM-ATHENA-LEAD', spoken: false, calls_llm: false };
    }
    function reinforce(factId, eta) {
      const f = st.facts.find(x => x.fact_id === factId); if (!f) return { ok: false, rule: 'RKM-ABSENT' };
      const A = amplitude(f, now());
      f.A0 = A + (eta == null ? 0.1 : eta) * (1 - A); f.t0 = now(); f.reads += 1;
      log('reinforce', { fact_id: factId, A: f.A0 }); save();
      return { ok: true, A: f.A0, calls_llm: false };
    }
    function advance(ms) { clock += ms; st.clock = clock; save(); return { ok: true, now: clock, calls_llm: false }; }
    function peerStretch(factId, peer) {
      if (!st.paired[peer]) return { ok: false, rule: 'RKM-PEER-UNPAIRED', calls_llm: false };
      const f = st.facts.find(x => x.fact_id === factId); if (!f) return { ok: false, rule: 'RKM-ABSENT' };
      const window = (f.half_life_s || bandBy('delta').half) * 1000;
      if (f.peer_at != null && now() - f.peer_at < window) return { ok: false, rule: 'RKM-PEER-WINDOW', calls_llm: false };
      f.half_life_s = (f.half_life_s || bandBy('delta').half) * 1.05; f.peer_at = now();
      log('peer_stretch', { fact_id: factId, peer: peer, half: f.half_life_s }); save();
      return { ok: true, half_life_s: f.half_life_s, publisher: false, calls_llm: false };
    }
    function readmit(factId) {
      const f = st.facts.find(x => x.fact_id === factId); if (!f) return { ok: false, rule: 'RKM-ABSENT' };
      const prior = st.log.filter(e => e.kind === 'readmit' && e.fact_id === factId).length;
      if (prior >= 5) return { ok: false, rule: 'RKM-READMIT-CAP', calls_llm: false };
      const entry = log('readmit', { fact_id: factId, n: prior + 1 });
      if (!entry.hash) return { ok: false, rule: 'RKM-READMIT-NO-LOG' };
      f.readmit = prior + 1; f.alpha = 'pass'; f.A0 = 1; f.t0 = now(); save();
      return { ok: true, n: f.readmit, calls_llm: false };
    }
    function acceptTrace(events) {
      const names = (events || []).map(e => e && (e.event || e)).filter(n => THETA.indexOf(n) >= 0);
      if (names.length !== 5) return { ok: false, rule: 'RKM-TRACE-INCOMPLETE', calls_llm: false };
      for (let i = 0; i < 5; i++) if (names[i] !== THETA[i]) return { ok: false, rule: 'RKM-TRACE-ORDER', calls_llm: false };
      return { ok: true, slots: names.map((n, i) => ({ event: n, slot: i })), calls_llm: false };
    }
    function exportPacket() {
      const mem = { schema: 'forge.hfield.memory.v1', key: { key_id: KEY_ID, key_version: KEY_VERSION, structure_fp: structureFp, structure_hash_sha256: structureHash, full_hash_sha256: fullHash }, message: { type: 'CLAIM', sent_at: new Date(now() || Date.now()).toISOString() }, records: st.facts.map(f => ({ fact_id: f.fact_id, address: f.address, roles: f.roles, text: f.text, theta_slot: f.theta_slot, context: f.context, verified: !!f.verified })), receiver_policy: { content_is_claim: true, must_pass_gilligan: true, auto_persist: false, peer_is_publisher: false, c_min: 0.87, echo_speak: 0.85, echo_write: 0.97 } };
      mem.payload_hash_sha256 = sha(canon(mem));
      return { format: 'aiweb.hfield', version: KEY_VERSION, root_frequency_hz: 144, packet: { packet_kind: 'forge_memory_exchange_packet', source_system: 'Forge', target_systems: ['Forge', 'HCS'], phase_profile: { phase_count: 9, phase_order: [2, 1, 3, 4, 5, 6, 7, 9, 8], anchor_layout: 'center_1_lower_5_upper_9', anchor_ratios: [1, 0.5, 3], root_frequency_hz: 144 }, payload_layers: ['score', 'frequency_phase', 'gesture', 'field', 'render', 'forge_bridge', 'forge_memory'], forge_bridge: { status: 'bound', bridge_profile: 'forge_memory_bridge_v1', validation_ref: 'gilligan:receiver_must_revalidate' } }, music: [{ id: 'forge_root_reference', hz: 144, view_only: true }], forge_memory: mem, calls_llm: false };
    }
    function importPacket(pkt) {
      const mem = pkt && (pkt.forge_memory || (pkt.packet && pkt.packet.forge_memory));
      const fp = mem && mem.key && mem.key.structure_fp;
      if (!mem || fp !== structureFp) return { ok: false, rule: 'RKM-KEY-MISMATCH', calls_llm: false };
      const claims = [];
      (mem.records || []).forEach(r => {
        const claim = { fact_id: r.fact_id, address: r.address, roles: r.roles, text: r.text, theta_slot: r.theta_slot, context: r.context, alpha: 'quarantine_peer', verified: false, A0: 0.2, t0: now(), band: 'delta', atoms: atomsOf(r.roles || {}, o.forge), publisher: false };
        st.claims.push(claim); claims.push({ fact_id: claim.fact_id, address: claim.address && claim.address.compact_hex, alpha: 'quarantine_peer' });
        log('peer_claim', { fact_id: r.fact_id });
      });
      save();
      return { ok: true, rule: 'RKM-CLAIM-HELD', claims: claims, persisted: false, calls_llm: false };
    }
    function pair(id, keyHex) { st.paired[id] = keyHex; log('pair', { peer: id }); save(); return { ok: true, peer: id, calls_llm: false }; }
    function state() { return JSON.parse(JSON.stringify(st)); }
    function storeHash() { return sha(canon({ facts: st.facts, claims: st.claims, head: st.head })); }
    return { noteRemember, recall, commitLead, reinforce, advance, peerStretch, readmit, acceptTrace, exportPacket, importPacket, pair, amplitude: (id) => { const f = st.facts.find(x => x.fact_id === id); return f ? amplitude(f, now()) : null; }, state, storeHash, now, save, key: { fp: structureFp, structureHash, fullHash, version: KEY_VERSION } };
  }
  const api = { SCHEMA, KEY_VERSION, structureFp, structureHash, fullHash, BANDS, DELTA, create, phaseFit, bandFit, coupling, LIT, NEAR, COLLECT, ACTIVE, canon, sha, shaBytes, hexToBytes, bytesToHex, pack, FLAGS, calls_llm: false };
  if (isNode) module.exports = api; else root.KRKM = api;
})(typeof self !== 'undefined' ? self : this);
