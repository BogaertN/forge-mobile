/* KPacks (4.9.213, Release C2): the starter pack, the confirmed-pack import and the shared-knowledge (confirmed_shared) views moved
 * out of kernel.js with the same API (forge.starterView, previewImport, importConfirmedPack, admitImportItem, importView,
 * sharedKnowledgeView, pullHostedSharedPack, writeSharedKnowledge, ...). The kernel passes its store and its NP helpers
 * (nps, entKey, reparseClause). Moved verbatim; no behaviour change. No LLM. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
function Packs(ctx) {
  const { store, nps, entKey, reparseClause, G, sha256 } = ctx;
  /* 4.9.124: a small on-device starter pack. Confirmed on first open. Not memory and not shared knowledge. */
  const STARTER_SCHEMA = 'FORGE-STARTER-PACK/v1', PACK_ST = 'starter_pack', PACK_IM = 'import_pack';
  const STARTER_LINES = [{ id: 'st:spaniel-dog', text: 'a spaniel is a dog' }, { id: 'st:dog-animal', text: 'a dog is an animal' }, { id: 'st:paw-dog', text: 'a paw is part of a dog' }, { id: 'st:dog-coat', text: 'a dog has a coat' }];
  function packRecord(cat) { const v = store.load(cat); return v && !Array.isArray(v) && typeof v === 'object' ? v : null; }
  function starterRecord() { return packRecord(PACK_ST); }
  function starterFacts() { const v = starterRecord(); return v && v.status === 'present' && Array.isArray(v.facts) ? v.facts : []; }
  function starterFact(id, clause) { const ents = [...new Set(nps(clause).filter(n => !n.pron3).map(entKey).filter(Boolean))];
    return { id, kind: 'relation', clause, pred: clause.coord ? 'and' : clause.verb.lemma, subjKey: clause.coord ? null : entKey(clause.subj), entities: ents, status: 'active', sfe: { Phi: 9, rho: 1, Delta: 0, nu: 0, mu: 1.0, eps: 0, tau: [], lambda: 0, chi: 0 }, provenance: { source: PACK_ST, rule: 'STARTER-PACK', turn: null } }; }
  function ensureStarter() { const cur = starterRecord(); if (cur && (cur.status === 'present' || cur.status === 'cleared')) return cur; const facts = [];
    for (const line of STARTER_LINES) { let clause = null; try { clause = reparseClause(line.text); } catch (e) { clause = null; } if (!clause || clause.coord || !clause.verb) return cur; facts.push(starterFact(line.id, clause)); }
    if (facts.length !== STARTER_LINES.length) return cur; const pack = { schema: STARTER_SCHEMA, status: 'present', provenance: PACK_ST, facts }; store.save(PACK_ST, pack); return pack; }
  function starterView() { const v = starterRecord(); const present = !!(v && v.status === 'present'); const facts = present ? (v.facts || []).map(f => { let text = ''; try { text = G.clauseText(f.clause, 'kernel'); } catch (e) { text = ''; } return { id: f.id, text, provenance: PACK_ST }; }) : [];
    return { schema: STARTER_SCHEMA, status: present ? 'present' : 'cleared', provenance: PACK_ST, facts }; }
  function clearStarterKnowledge() { store.save(PACK_ST, { schema: STARTER_SCHEMA, status: 'cleared', provenance: PACK_ST, facts: [] }); return starterView(); }
  /* 4.9.125: on-device import pack. Reuses starterFact literals. Confirmed/projectable admit; contested/quarantine held until tap. Not memory, not shared knowledge. */
  const IMPORT_SCHEMA = 'FORGE-CONFIRMED-PACK/v1', IMPORT_RECEIPT = 'FORGE-IMPORT-RECEIPT/v1';
  const ADMIT_ST = { confirmed: 1, projectable: 1 }, HOLD_ST = { contested: 1, quarantine: 1 };
  /* 4.9.168: minimal resonance packet for RPMC phase-align/combine (Axiom 4; §1 RPM; §3.4 Grace Integral; RSOC SFE {Φ,ε,μ}).
     Every hosted KB / archive ancestor that participates in gather must carry {Phi,eps,mu}. Packets are not canned answers. */
  const RESONANCE_CITE = 'RPMC §1 RPM; Axiom 4; §3.4 Grace Integral; RSOC SFE {Φ,ε,μ}';
  function defaultResonancePacket(standing) {
    const st = String(standing == null ? 'projectable' : standing).toLowerCase();
    if (HOLD_ST[st]) return { Phi: 5, eps: 0.5, mu: 0 }; /* fail-closed: not phase-aligned to origin */
    return { Phi: 9, eps: 0, mu: 1 }; /* committed Return — may combine */
  }
  function normalizeResonancePacket(raw, standing) {
    const s = raw && typeof raw === 'object' ? (raw.sfe && typeof raw.sfe === 'object' ? raw.sfe : raw.resonance && typeof raw.resonance === 'object' ? raw.resonance : raw) : null;
    if (s && Number.isFinite(Number(s.Phi)) && Number.isFinite(Number(s.eps)) && Number.isFinite(Number(s.mu)))
      return { Phi: Number(s.Phi), eps: Number(s.eps), mu: Number(s.mu) };
    return defaultResonancePacket(standing);
  }
  function importRecord() { return packRecord(PACK_IM); }
  function importFacts() { const v = importRecord(); return v && Array.isArray(v.facts) ? v.facts.filter(f => f && f.status === 'active' && f.clause) : []; }
  const normImport = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
  const importId = t => 'im:' + sha256(normImport(t)).slice(0, 16);
  function importFact(id, clause, evidence, standing) { const f = starterFact(id, clause); f.standing = standing; f.evidence = evidence; f.provenance = { source: PACK_IM, rule: 'IMPORT-PACK', turn: null }; return f; }
  function importText(f) { try { return G.clauseText(f.clause, 'kernel'); } catch (e) { return f.text || ''; } }
  function importRow(f) { return { id: f.id, text: f.clause ? importText(f) : (f.text || ''), evidence: f.evidence || '', provenance: PACK_IM }; }
  function importView() { const v = importRecord(); const facts = v && Array.isArray(v.facts) ? v.facts.filter(f => f && f.status === 'active') : []; const held = v && Array.isArray(v.held) ? v.held : [];
    return { provenance: PACK_IM, admitted: facts.map(importRow), held: held.map(importRow) }; }
  function importReceipt(cls, reason, admitted, held) { return { schema: IMPORT_RECEIPT, class: cls, reason: reason || null, shared_kb: false, admitted: admitted || [], held: held || [] }; }
  function saveImport(rec, receipt) { rec.receipts = (rec.receipts || []).concat([receipt]).slice(-40); store.save(PACK_IM, rec); }
  function blankImport() { return { schema: IMPORT_SCHEMA, provenance: PACK_IM, facts: [], held: [], receipts: [] }; }
  function judgeImport(text) { let data; try { data = JSON.parse(String(text || '')); } catch (e) { return { ok: false, reason: 'not_json' }; }
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.schema !== IMPORT_SCHEMA) return { ok: false, reason: 'schema' };
    if (data.shared_kb === true || data.write_shared === true) return { ok: false, reason: 'shared_write' };
    if (!Array.isArray(data.items) || !data.items.length) return { ok: false, reason: 'empty' };
    const seen = new Set(), rows = [];
    for (const it of data.items) { if (!it || typeof it !== 'object') return { ok: false, reason: 'unparsed' };
      const standing = String(it.standing || ''); if (!ADMIT_ST[standing] && !HOLD_ST[standing]) return { ok: false, reason: 'standing' };
      const evidence = typeof it.evidence === 'string' ? it.evidence.trim() : ''; if (!evidence) return { ok: false, reason: 'evidence' };
      const raw = String(it.text || '').trim(), key = normImport(raw); if (!key) return { ok: false, reason: 'unparsed' };
      if (seen.has(key)) return { ok: false, reason: 'duplicate' }; seen.add(key);
      let clause = null; try { clause = reparseClause(raw); } catch (e) { clause = null; }
      if (!clause || clause.coord || !clause.verb) return { ok: false, reason: 'unparsed' };
      rows.push({ standing, evidence, clause, id: importId(raw), hold: !!HOLD_ST[standing] }); }
    return { ok: true, rows }; }
  function previewImport(text) { const j = judgeImport(text); if (!j.ok) return { ok: false, class: 'refused', reason: j.reason };
    const admitted = [], held = []; for (const r of j.rows) (r.hold ? held : admitted).push(importText({ clause: r.clause }));
    return { ok: true, class: 'import', admitted, held, plain: 'admit ' + admitted.join(' | ') + ' held ' + held.join(' | ') }; }
  function importConfirmedPack(text, opts) { opts = opts || {};
    if (opts.userTap !== true) return { ok: false, rule: 'PERM-NEEDS-USER-TAP', receipt: importReceipt('refused', 'needs_tap', [], []) };
    const j = judgeImport(text), cur = importRecord() || blankImport();
    if (!j.ok) { const receipt = importReceipt('refused', j.reason, [], []); saveImport(cur, receipt); return { ok: false, receipt, view: importView() }; }
    cur.schema = IMPORT_SCHEMA; cur.provenance = PACK_IM; cur.facts = cur.facts || []; cur.held = cur.held || [];
    const admitted = [], held = [];
    for (const row of j.rows) { const fact = importFact(row.id, row.clause, row.evidence, row.hold ? row.standing : 'confirmed'), textOut = importText(fact);
      const fi = cur.facts.findIndex(f => f.id === row.id), hi = cur.held.findIndex(f => f.id === row.id);
      if (row.hold) { if (fi >= 0) { admitted.push(importText(cur.facts[fi])); continue; } const heldRow = Object.assign({}, fact, { status: 'held', text: textOut }); if (hi >= 0) cur.held[hi] = heldRow; else cur.held.push(heldRow); held.push(textOut); }
      else { if (hi >= 0) cur.held.splice(hi, 1); if (fi >= 0) cur.facts[fi] = fact; else cur.facts.push(fact); admitted.push(textOut); } }
    const receipt = importReceipt('import', null, admitted, held); saveImport(cur, receipt); if (opts.wipeStarter === true) clearStarterKnowledge();
    return { ok: true, receipt, view: importView() }; }
  function admitImportItem(id, userTap) { if (userTap !== true) return { ok: false, rule: 'PERM-NEEDS-USER-TAP' };
    const cur = importRecord(); if (!cur || !Array.isArray(cur.held)) return { ok: false, rule: 'IMPORT-MISSING' };
    const i = cur.held.findIndex(f => f && f.id === id); if (i < 0) return { ok: false, rule: 'IMPORT-MISSING' };
    const row = cur.held.splice(i, 1)[0]; let clause = row.clause; if (!clause && row.text) { try { clause = reparseClause(row.text); } catch (e) { clause = null; } }
    if (!clause) { cur.held.splice(i, 0, row); return { ok: false, rule: 'IMPORT-UNPARSED' }; }
    const fact = importFact(row.id, clause, row.evidence || '', 'confirmed'), textOut = importText(fact);
    cur.facts = cur.facts || []; const fi = cur.facts.findIndex(f => f.id === fact.id); if (fi >= 0) cur.facts[fi] = fact; else cur.facts.push(fact);
    const receipt = importReceipt('admit', null, [textOut], []); saveImport(cur, receipt); return { ok: true, receipt, view: importView() }; }
  function clearImportPack() { const cur = importRecord() || blankImport(); cur.schema = IMPORT_SCHEMA; cur.provenance = PACK_IM; cur.facts = []; cur.held = []; store.save(PACK_IM, cur); return importView(); }
  /* 4.9.127/128: hosted shared knowledge (packs/confirmed_shared). Read for all into RAM; write needs Nic's key; not phone-DB product brain. */
  const PACK_CS = 'confirmed_shared', CS_RULE = 'CONFIRMED-SHARED', SHARED_KB_WRITE_RULE = 'SHARED-KB-WRITE-KEY-REQUIRED';
  let hostedSharedKb = { schema: IMPORT_SCHEMA, provenance: PACK_CS, facts: [], held: [], receipts: [], hosted: true, phone_db: false };
  let sharedKbWriteKeyHeld = null;
  function setSharedKbWriteKey(key) { const k = String(key == null ? '' : key); if (k.length < 12) { sharedKbWriteKeyHeld = null; return { ok: false, rule: 'SHARED-KB-WRITE-KEY-WEAK' }; } sharedKbWriteKeyHeld = k; return { ok: true }; }
  function clearSharedKbWriteKey() { sharedKbWriteKeyHeld = null; return { ok: true }; }
  function authorizeSharedKbWrite(opts) { opts = opts || {}; const offered = String(opts.writeKey || opts.write_key || opts.productCuratorKey || ''); if (!offered || !sharedKbWriteKeyHeld || offered !== sharedKbWriteKeyHeld) return { ok: false, rule: SHARED_KB_WRITE_RULE }; return { ok: true }; }
  function csRecord() { return packRecord(PACK_CS); }
  function hostedSharedFacts() { return (hostedSharedKb.facts || []).filter(f => f && f.status === 'active' && f.clause); }
  function confirmedSharedFacts() { const hosted = hostedSharedFacts(); if (hosted.length) return hosted; const v = csRecord(); return v && Array.isArray(v.facts) ? v.facts.filter(f => f && f.status === 'active' && f.clause) : []; }
  const csId = t => 'cs:' + sha256(normImport(t)).slice(0, 16);
  function csFact(id, clause, evidence, standing, sfeIn) { const f = starterFact(id, clause); f.standing = standing; f.evidence = evidence; f.sfe = Object.assign({}, f.sfe, normalizeResonancePacket(sfeIn, standing)); f.provenance = { source: PACK_CS, rule: CS_RULE, turn: null }; return f; }
  function csRow(f) { const s = f && f.sfe; return { id: f.id, text: f.clause ? importText(f) : (f.text || ''), evidence: f.evidence || '', provenance: PACK_CS, sfe: s && Number.isFinite(s.Phi) ? { Phi: s.Phi, eps: s.eps, mu: s.mu } : null }; }
  function sharedKnowledgeView() {
    const facts = (hostedSharedKb.facts || []).filter(f => f && f.status === 'active');
    const held = hostedSharedKb.held || [];
    return { provenance: PACK_CS, label: 'shared knowledge', hosted: true, phone_db: false, read_only: !sharedKbWriteKeyHeld, admitted: facts.map(csRow), held: held.map(csRow), letter: hostedSharedKb.letter || null, pack_id: hostedSharedKb.pack_id || null, count: facts.length };
  }
  function confirmedSharedView() { return sharedKnowledgeView(); }
  function blankCs() { return { schema: IMPORT_SCHEMA, provenance: PACK_CS, facts: [], held: [], receipts: [] }; }
  function wipePhoneConfirmedShared() { try { const cur = blankCs(); store.save(PACK_CS, cur); } catch (e) { /* ignore */ } }
  function normalizeCsPack(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (data.schema === IMPORT_SCHEMA && Array.isArray(data.items)) return data;
    if ((data.format === IMPORT_SCHEMA || data.schema === IMPORT_SCHEMA) && Array.isArray(data.facts) && !data.items) {
      const items = [];
      for (const f of data.facts) {
        if (!f || typeof f !== 'object') continue;
        const text = String(f.text || f.claim || '').trim(); if (!text) continue;
        const h = String(f.honesty || '').toLowerCase(), st = String(f.standing || f.claim_status || '').toLowerCase();
        const standing = ADMIT_ST[h] || HOLD_ST[h] ? h : ADMIT_ST[st] || HOLD_ST[st] ? st : 'confirmed';
        const evidence = typeof f.evidence === 'string' && f.evidence.trim() ? f.evidence.trim()
          : [f.category || 'general', 'curator', f.headword || '', f.id || ''].filter(Boolean).join(' · ') || 'curator';
        items.push({ id: f.id, text, standing, evidence });
      }
      return Object.assign({}, data, { schema: IMPORT_SCHEMA, items, provenance: data.provenance || PACK_CS });
    }
    return null;
  }
  function judgeConfirmedShared(text) {
    let data; try { data = typeof text === 'string' ? JSON.parse(String(text || '')) : text; } catch (e) { return { ok: false, reason: 'not_json' }; }
    data = normalizeCsPack(data);
    if (!data) return { ok: false, reason: 'schema' };
    if (data.shared_kb === true || data.write_shared === true) return { ok: false, reason: 'shared_write' };
    if (!Array.isArray(data.items) || !data.items.length) return { ok: false, reason: 'empty' };
    const seen = new Set(), rows = [], skipped = [];
    for (const it of data.items) {
      if (!it || typeof it !== 'object') { skipped.push('shape'); continue; }
      const standing = String(it.standing || 'confirmed'); if (!ADMIT_ST[standing] && !HOLD_ST[standing]) { skipped.push('standing'); continue; }
      const evidence = typeof it.evidence === 'string' ? it.evidence.trim() : ''; if (!evidence) { skipped.push('evidence'); continue; }
      const raw = String(it.text || '').trim(), key = normImport(raw); if (!key) { skipped.push('unparsed'); continue; }
      if (seen.has(key)) { skipped.push('duplicate'); continue; } seen.add(key);
      let clause = null; try { clause = reparseClause(raw); } catch (e) { clause = null; }
      if (!clause || clause.coord || !clause.verb) { skipped.push('unparsed'); continue; }
      const sfe = normalizeResonancePacket(it.sfe || it.resonance || null, standing);
      const askKeys = Array.isArray(it.ask_keys) ? it.ask_keys.filter(x => typeof x === 'string' && x.length > 1 && x.length < 80).slice(0, 12) : [];
      rows.push({ standing, evidence, clause, id: it.id && String(it.id).indexOf('cs:') === 0 ? String(it.id) : csId(raw), hold: !!HOLD_ST[standing], sfe, packet_attached: !(it.sfe || it.resonance), ask_keys: askKeys });
    }
    if (!rows.length) return { ok: false, reason: skipped.includes('unparsed') ? 'unparsed' : 'empty' };
    return { ok: true, rows, meta: { letter: data.letter || null, pack_id: data.pack_id || null, who_confirmed: data.who_confirmed || null, provenance: data.provenance || PACK_CS } };
  }
  function mergeHostedRows(j) {
    hostedSharedKb.schema = IMPORT_SCHEMA; hostedSharedKb.provenance = PACK_CS; hostedSharedKb.hosted = true; hostedSharedKb.phone_db = false;
    hostedSharedKb.facts = hostedSharedKb.facts || []; hostedSharedKb.held = hostedSharedKb.held || [];
    if (j.meta) { if (j.meta.letter) hostedSharedKb.letter = j.meta.letter; if (j.meta.pack_id) hostedSharedKb.pack_id = j.meta.pack_id; if (j.meta.who_confirmed) hostedSharedKb.who_confirmed = j.meta.who_confirmed; }
    const admitted = [], held = [];
    for (const row of j.rows) {
      const fact = csFact(row.id, row.clause, row.evidence, row.hold ? row.standing : (row.standing === 'projectable' ? 'projectable' : 'confirmed'), row.sfe); if (row.ask_keys && row.ask_keys.length) fact.ask_keys = row.ask_keys.slice(); const textOut = importText(fact);
      const fi = hostedSharedKb.facts.findIndex(f => f.id === row.id || normImport(importText(f)) === normImport(textOut));
      const hi = hostedSharedKb.held.findIndex(f => f.id === row.id);
      if (row.hold) {
        if (fi >= 0) { admitted.push(importText(hostedSharedKb.facts[fi])); continue; }
        const heldRow = Object.assign({}, fact, { status: 'held', text: textOut }); if (hi >= 0) hostedSharedKb.held[hi] = heldRow; else hostedSharedKb.held.push(heldRow); held.push(textOut);
      } else {
        if (hi >= 0) hostedSharedKb.held.splice(hi, 1);
        if (fi >= 0) hostedSharedKb.facts[fi] = fact; else hostedSharedKb.facts.push(fact); admitted.push(textOut);
      }
    }
    return { admitted, held };
  }
  /* Read path: everyone may pull hosted packs into session RAM. Never mass-writes phone DB. */
  function pullHostedSharedPack(text) {
    const j = judgeConfirmedShared(text);
    if (!j.ok) return { ok: false, reason: j.reason, receipt: importReceipt('refused', j.reason, [], []), view: sharedKnowledgeView() };
    const { admitted, held } = mergeHostedRows(j);
    wipePhoneConfirmedShared();
    const receipt = importReceipt('import', null, admitted, held); receipt.hosted = true; receipt.phone_db = false; receipt.shared_kb = false;
    hostedSharedKb.receipts = (hostedSharedKb.receipts || []).concat([receipt]).slice(-40);
    return { ok: true, receipt, view: sharedKnowledgeView() };
  }
  /* Write path: Nic's write key required. Mutates session hosted cache only (still not phone-DB product brain). */
  function writeSharedKnowledge(text, opts) {
    opts = opts || {};
    const auth = authorizeSharedKbWrite(opts);
    if (!auth.ok) return { ok: false, rule: auth.rule, receipt: importReceipt('refused', auth.rule, [], []), view: sharedKnowledgeView() };
    return pullHostedSharedPack(text);
  }
  function admitConfirmedShared(text, opts) {
    opts = opts || {};
    /* 4.9.128: productCurator boolean alone is not a write key. Default users: read-only. */
    const auth = authorizeSharedKbWrite(opts);
    if (!auth.ok) {
      if (opts.productCurator === true || opts.product_curator === true) return { ok: false, rule: SHARED_KB_WRITE_RULE, receipt: importReceipt('refused', SHARED_KB_WRITE_RULE, [], []), view: sharedKnowledgeView() };
      if (opts.userTap !== true) return { ok: false, rule: 'PERM-NEEDS-USER-TAP', receipt: importReceipt('refused', 'needs_tap', [], []), view: sharedKnowledgeView() };
      return { ok: false, rule: SHARED_KB_WRITE_RULE, receipt: importReceipt('refused', SHARED_KB_WRITE_RULE, [], []), view: sharedKnowledgeView() };
    }
    return writeSharedKnowledge(text, opts);
  }
  /* 4.9.176: the 4.9.127 admit of a held row, on the session bank. 4.9.128 left this as a refusal that ignored a key already held.
     A tap moves a contested held row into admitted facts. Quarantine stays held. The phone DB and letter packs are not written. */
  function admitConfirmedSharedItem(id, userTap) {
    if (userTap !== true) return { ok: false, rule: 'PERM-NEEDS-USER-TAP', view: sharedKnowledgeView(), phone_db: false, wrote_pack: false };
    if (!sharedKbWriteKeyHeld) return { ok: false, rule: SHARED_KB_WRITE_RULE, view: sharedKnowledgeView(), phone_db: false, wrote_pack: false };
    const held = hostedSharedKb.held || [];
    const i = held.findIndex(f => f && f.id === id);
    if (i < 0) return { ok: false, rule: 'CONFIRMED-SHARED-MISSING', view: sharedKnowledgeView(), phone_db: false, wrote_pack: false };
    const row = held[i];
    const standing = String(row.standing || '').toLowerCase();
    if (standing === 'quarantine' || row.lane === 'quarantine' || row.route === 'dream_state_quarantine_candidate') return { ok: false, rule: 'DREAM-QUARANTINE-NO-TRUTH', view: sharedKnowledgeView(), phone_db: false, wrote_pack: false };
    let clause = row.clause;
    if (!clause && row.text) { try { clause = reparseClause(row.text); } catch (e) { clause = null; } }
    if (!clause || clause.coord || !clause.verb) return { ok: false, rule: 'CONFIRMED-SHARED-UNPARSED', view: sharedKnowledgeView(), phone_db: false, wrote_pack: false };
    held.splice(i, 1);
    const fact = csFact(row.id, clause, row.evidence || '', 'confirmed', row.sfe);
    hostedSharedKb.facts = hostedSharedKb.facts || [];
    const fi = hostedSharedKb.facts.findIndex(f => f.id === fact.id);
    if (fi >= 0) hostedSharedKb.facts[fi] = fact; else hostedSharedKb.facts.push(fact);
    const textOut = importText(fact);
    const receipt = importReceipt('admit', null, [textOut], []);
    receipt.hosted = true; receipt.phone_db = false; receipt.shared_kb = false; receipt.wrote_pack = false;
    hostedSharedKb.receipts = (hostedSharedKb.receipts || []).concat([receipt]).slice(-40);
    wipePhoneConfirmedShared();
    return { ok: true, receipt, view: sharedKnowledgeView(), phone_db: false, wrote_pack: false };
  }
  function clearConfirmedShared() {
    hostedSharedKb = { schema: IMPORT_SCHEMA, provenance: PACK_CS, facts: [], held: [], receipts: [], hosted: true, phone_db: false };
    wipePhoneConfirmedShared();
    return sharedKnowledgeView();
  }
  function clearHostedSharedKnowledge() { return clearConfirmedShared(); }
  return { ensureStarter, starterView, clearStarterKnowledge, previewImport, importConfirmedPack, admitImportItem, clearImportPack, importView, confirmedSharedView, sharedKnowledgeView, pullHostedSharedPack, writeSharedKnowledge, setSharedKbWriteKey, clearSharedKbWriteKey, admitConfirmedShared, admitConfirmedSharedItem, clearConfirmedShared, clearHostedSharedKnowledge, confirmedSharedFacts, PACK_CS, importText, importFacts, starterFacts }; }
const api = { Packs };
if (isNode) module.exports = api; else root.KPacks = api;
})(this);
