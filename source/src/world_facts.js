/* world_facts.js — 4.9.242 PERSISTENT WORLD FACTS (Nic plan 229 step 11). The world model starts empty every turn;
 * this store keeps explicit Remember facts on the device as clause facts so Derive can chain across turns. Spoken answers are not auto-written (a spoken answer must not become its own evidence).
 * Each row carries its text, clause, native phase (Φ, band, Hz), provenance, trust and SPC charge. Charge decays
 * with the Genesis Node half-life (168 h): C(t) = C0 · e^(−λt), λ = ln2 / 168. Collection drops charge below 0.05.
 * Bound: at most MAX rows by charge. A contradictory write (same kartṛ + kriyā, incompatible polarity or a second
 * referring identity) is refused — nothing is overwritten silently. Personal; no hosted writes. No model. */
(function (root) {
  const SCHEMA = 'forge.world_facts/v1';
  const KEY = 'forge.world_facts.v1';
  const MAX = 128;
  const HALF_LIFE_H = 168;
  const LAMBDA = Math.LN2 / HALF_LIFE_H;
  const ACTIVE = 0.1;
  const COLLECT = 0.05;
  const isNode = typeof module !== 'undefined' && module.exports;

  function backend() {
    if (isNode) return null;
    try { localStorage.setItem('forge.world_facts.probe', '1'); localStorage.removeItem('forge.world_facts.probe');
      return { get: k => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v) }; } catch (e) { return null; }
  }
  /* in-node / memory-only tests share one store on the module */
  let MEM = null;
  function loadRaw() {
    const b = backend();
    if (b) { try { const v = JSON.parse(b.get(KEY) || 'null'); if (v && v.schema === SCHEMA && Array.isArray(v.facts)) return v; } catch (e) {} }
    if (MEM && MEM.schema === SCHEMA) return MEM;
    return { schema: SCHEMA, facts: [], updated_at: null, calls_llm: false };
  }
  function saveRaw(doc) {
    doc = Object.assign({}, doc, { schema: SCHEMA, updated_at: new Date().toISOString(), calls_llm: false });
    MEM = doc;
    const b = backend(); if (b) { try { b.set(KEY, JSON.stringify(doc)); } catch (e) { return { ok: false, rule: 'WORLD-FACTS-STORAGE-FULL' }; } }
    return { ok: true, rule: 'WORLD-FACTS-SAVED', n: (doc.facts || []).length };
  }
  function hoursSince(iso, now) {
    const t = Date.parse(iso || '') || 0, n = now ? Date.parse(now) || Date.now() : Date.now();
    return Math.max(0, (n - t) / 3600000);
  }
  function chargeOf(row, now) {
    const c0 = typeof row.charge0 === 'number' ? row.charge0 : 1;
    const base = row.charged_at || row.remembered_at || row.admitted_at || row.updated_at;
    return c0 * Math.exp(-LAMBDA * hoursSince(base, now));
  }
  function decayed(doc, now) {
    const iso = now || new Date().toISOString();
    const facts = (doc.facts || []).map(r => Object.assign({}, r, { charge: chargeOf(r, iso), charge_half_life_h: HALF_LIFE_H, charge_lambda: LAMBDA }))
      .filter(r => r.charge >= COLLECT)
      .sort((a, b) => b.charge - a.charge || String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
      .slice(0, MAX);
    return Object.assign({}, doc, { facts, as_of: iso });
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, ''); }
  function atomKey(row) {
    const a = row.atom; if (a && a.predicate && Array.isArray(a.args) && a.args.length >= 2)
      return [String(a.predicate).toLowerCase(), norm(a.args[0]), String(a.polarity || 'pos')].join('|');
    const c = row.clause; if (c && c.kriya && c.kartr && c.kartr.text)
      return [String(c.kriya).toLowerCase(), norm(c.kartr.text), String(c.polarity || 'pos')].join('|');
    return 'text|' + norm(row.text);
  }
  function predOf(row) {
    const a = row.atom; if (a && Array.isArray(a.args) && a.args[1] != null) return norm(a.args[1]);
    const c = row.clause; if (c && c.pred && c.pred.text) return norm(c.pred.text);
    if (c && c.karma && c.karma.text) return norm(c.karma.text);
    return null;
  }
  function referringClause(c) {
    if (!c || !c.kartr) return false;
    const k = c.kartr;
    return !!(k.propn || k.owner || k.user || k.kernel || /^(the|this|that|my|your|his|her|its|our|their)\b/i.test(String(k.text || '')));
  }
  /* a new fact conflicts with a kept one when they share the atom key (same kriyā, kartṛ, polarity) but name a different
   * predicate/karma — identity and kind membership of one subject do not silently replace each other; opposite polarity
   * of the same args is also a conflict (handled by the key's polarity slot matching a flipped write below). */
  function conflictWith(doc, row) {
    const key = atomKey(row), pred = predOf(row);
    const flipPol = k => k.endsWith('|pos') ? k.slice(0, -3) + 'neg' : (k.endsWith('|neg') ? k.slice(0, -3) + 'pos' : null);
    const flipped = flipPol(key);
    for (const old of doc.facts || []) {
      if (norm(old.text) === norm(row.text)) return null; /* same sentence is a no-op keep */
      const ok = atomKey(old);
      if (flipped && ok === flipped) return { rule: 'WORLD-FACTS-CONFLICT-POLARITY', existing: old };
      if (ok === key) {
        const op = predOf(old);
        if (pred != null && op != null && pred !== op) return { rule: 'WORLD-FACTS-CONFLICT-PREDICATE', existing: old };
      }
    }
    return null;
  }
  function placeOf(row, forge) {
    /* native phase from the row's packet/sfe when present; otherwise a stable default recorded as such */
    const pkt = row.packet || row.sfe || {};
    let Phi = pkt.Phi != null ? Number(pkt.Phi) : (row.phase != null ? Number(row.phase) : null);
    if (!(Phi >= 1 && Phi <= 9)) Phi = 1;
    return { Phi, phase: Phi, band: row.band || (pkt.band && pkt.band.name) || null, hz: row.hz != null ? row.hz : (pkt.hz != null ? pkt.hz : null),
      phi_basis: row.phi_basis || (pkt.Phi != null ? 'row_packet' : 'default_world_fact') };
  }
  function upsert(input, opts) {
    opts = opts || {};
    const now = opts.now || new Date().toISOString();
    const text = String(input && input.text || '').trim(); if (!text) return { ok: false, rule: 'WORLD-FACTS-EMPTY' };
    let doc = decayed(loadRaw(), now);
    const row = {
      id: input.id || ('wf-' + (isNode && require('crypto') ? require('crypto').createHash('sha256').update(norm(text)).digest('hex').slice(0, 12) : String(Date.now()))),
      text, clause: input.clause || null, atom: input.atom || null,
      provenance: Object.assign({}, input.provenance || {}, { kind: input.kind || (input.provenance && input.provenance.kind) || 'world_fact' }),
      trust: input.trust || 'trusted', source: input.source || 'phone_kb', scope: 'phone',
      remembered_at: input.remembered_at || null, admitted_at: input.admitted_at || null,
      charged_at: now, charge0: typeof input.charge0 === 'number' ? input.charge0 : 1,
      updated_at: now, kind: input.kind || 'remember',
    };
    Object.assign(row, placeOf(input));
    const hit = (doc.facts || []).find(f => norm(f.text) === norm(text));
    if (hit) {
      /* refresh charge on re-remember / re-admit; never change the clause silently */
      hit.charged_at = now; hit.charge0 = Math.min(1, (hit.charge0 || 1) + 0.05); hit.updated_at = now;
      hit.last_access = now;
      if (input.clause && !hit.clause) hit.clause = input.clause;
      const saved = saveRaw(Object.assign({}, doc, { facts: doc.facts }));
      if (!saved.ok) return saved;
      return { ok: true, rule: 'WORLD-FACTS-REFRESHED', fact: hit, n: saved.n };
    }
    const conflict = conflictWith(doc, row);
    if (conflict) return { ok: false, rule: conflict.rule, existing: { id: conflict.existing.id, text: conflict.existing.text },
      message: 'Held: that contradicts a fact already kept on this phone (' + conflict.existing.text + '). Nothing was overwritten.' };
    doc.facts = [row].concat(doc.facts || []).slice(0, MAX);
    const saved = saveRaw(doc);
    if (!saved.ok) return saved;
    return { ok: true, rule: 'WORLD-FACTS-ADDED', fact: row, n: saved.n };
  }
  function rows(opts) {
    const now = (opts && opts.now) || new Date().toISOString();
    const doc = decayed(loadRaw(), now);
    return (doc.facts || []).filter(r => r.charge >= ACTIVE).map(r => ({
      id: r.id, memory_id: r.id, text: r.text, clause: r.clause, atom: r.atom,
      tier: 'world_fact', trust: r.trust || 'trusted', source: 'world_facts',
      scope: 'phone', provenance: Object.assign({}, r.provenance || {}, { store: 'world_facts', kind: r.kind || 'world_fact' }),
      phase: r.Phi, packet: { Phi: r.Phi, eps: 0, mu: r.charge, band: r.band, hz: r.hz },
      sfe: { Phi: r.Phi, eps: 0, mu: r.charge }, charge: r.charge, charge_half_life_h: HALF_LIFE_H,
      remembered_at: r.remembered_at, admitted_at: r.admitted_at, updated_at: r.updated_at,
    }));
  }
  function clear() { MEM = { schema: SCHEMA, facts: [], updated_at: new Date().toISOString(), calls_llm: false };
    const b = backend(); if (b) { try { b.set(KEY, JSON.stringify(MEM)); } catch (e) {} } return { ok: true }; }
  function snapshot() { return decayed(loadRaw()); }
  const api = { SCHEMA, KEY, MAX, HALF_LIFE_H, LAMBDA, ACTIVE, COLLECT, loadRaw, saveRaw, decayed, chargeOf, upsert, rows, clear, snapshot, conflictWith, atomKey };
  if (isNode) module.exports = api; else root.KWorldFacts = api;
})(typeof self !== 'undefined' ? self : this);
