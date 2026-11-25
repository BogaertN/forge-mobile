/* KStore (4.9.212, Release C1): the phone store, moved out of kernel.js with the same API.
 * MemoryStore (generations, quota handling), the store categories, canon(), and Layered(): the route sandbox
 * transaction overlay (TX, nestable) and the case-file namespace in front of a MemoryStore. kernel.js re-exports
 * MemoryStore and canon unchanged (KKernel.MemoryStore, KKernel.canon). No behaviour change. No LLM. */
(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const CATEGORIES = ['shared_outbox', 'shared_inbox', 'shared_knowledge', 'shared_challenges', 'user_tools', 'economy_capsules', 'economy_events', 'usage_events', 'usage_counts', 'reminders', 'request_receipts', 'request_policy_gaps', 'hypotheses', 'admitted_rules', 'ede_calibration', 'economy_seen', 'economy_quarantine', 'pf_echo', 'pf_agents', 'pf_drift_log', 'mea_seals', 'mea_problems', 'mea_candidates', 'mea_archive', 'mea_receipts', 'capsules', 'council', 'promotions', 'device', 'attribution_ledger', 'attribution_foreign', 'ledger_conflicts', 'synced_items', 'sync_log', 'ui_errors', 'rejected_meanings', 'admission_queue', 'sim_runs', 'node_jobs', 'node_pairing', 'symbol_index', 'migrations', 'memory', 'evidence', 'language_examples', 'trace', 'cold_storage', 'resurrection_proposals', 'lexicon_user', 'meta', 'policy', 'permissions', 'held_writes', 'loops', 'collapse_events', 'drift_archive', 'containment_receipts', 'tool_invocations', 'feedback', 'profiles', 'consent', 'buyers', 'offers', 'consent_ledger', 'export_packages', 'jobs', 'workbench_events', 'web_evidence', 'fetch_path', 'justifications', 'withdrawal_receipts', 'world_state', 'world_head', 'world_head_stage', 'admitted_manifests', 'admitted_manifests_k', 'admitted_meta', 'starter_pack', 'import_pack', 'confirmed_shared'];
const ALL_STORES = [...new Set(CATEGORIES.concat(['gks_facts', 'case_index', 'case_ledger', 'proof_exports', 'economy_manifests', 'shared_drafts', 'economy_foreign', 'receipts', 'shared_cursor', 'vault', 'signing_key', 'buyers', 'consent', 'consent_ledger', 'export_packages', 'offers', 'profiles', 'workbench_events', 'device', 'economy_events', 'usage_events', 'attribution_ledger', 'attribution_foreign', 'memory', 'meta', 'migrations', 'policy', 'permissions', 'trace', 'e2ee_queue', 'e2ee_cursor', 'gks_pinned']))].sort();
const GEN_KEY = 'kernel.__gen', GEN_PREV_KEY = 'kernel.__gen_prev';
function MemoryStore(backend) { const mem = {}; const b = backend || { get: k => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null), set: (k, v) => { mem[k] = String(v); }, del: k => { delete mem[k]; }, keys: () => Object.keys(mem) };
  const gen = () => { const v = b.get(GEN_KEY); const n = v == null ? 0 : Number(v); return Number.isInteger(n) && n >= 0 ? n : 0; };
  const pre = g => (g ? 'kernel.g' + g + '.' : 'kernel.');
  const dfl = cat => (cat === 'meta' ? {} : []);
  const rawLoad = (g, cat) => { const v = b.get(pre(g) + cat); return v ? JSON.parse(v) : dfl(cat); };
  function namesIn(g) { const out = new Set(ALL_STORES); if (b.keys) { const p = pre(g); for (const k of b.keys()) { if (!k.startsWith(p)) continue; const c = k.slice(p.length); if (!c || c === 'probe' || c.startsWith('__') || (!g && /^g\d+\./.test(c))) continue; out.add(c); } } return [...out].sort(); }
  function stageGeneration(data, hook) { const from = gen(); const to = from + 1; const names = [...new Set(namesIn(from).concat(Object.keys(data || {})))].sort(); const want = {};
    for (const c of names) want[c] = JSON.stringify(data && Object.prototype.hasOwnProperty.call(data, c) ? data[c] : rawLoad(from, c));
    for (const c of names) b.set(pre(to) + c, want[c]);
    if (hook) hook({ save: (c, v) => b.set(pre(to) + c, JSON.stringify(v)) }); /* test hook: a backend that does not keep what was written */
    const bad = names.filter(c => b.get(pre(to) + c) !== want[c]); return { from, to, names, bad }; }
  function commitGeneration(st) { if (!st || st.bad.length) throw new Error('STAGE-NOT-VERIFIED'); if (gen() !== st.from) throw new Error('STAGE-STALE');
    b.set(GEN_PREV_KEY, JSON.stringify({ prev: st.from, staged: st.to }));
    b.set(GEN_KEY, String(st.to));
    if (b.del && b.keys) { try { for (const k of b.keys()) { const m = /^kernel\.g(\d+)\./.exec(k); const g = m ? Number(m[1]) : (/^kernel\.(?!__|g\d+\.)/.test(k) && k !== 'kernel.probe' ? 0 : -1); if (g >= 0 && g !== st.to && g !== st.from) b.del(k); } } catch (e) { /* collection is optional; the commit already happened */ } }
    return { active: st.to, prev: st.from }; }
  function rollbackGeneration() { const v = b.get(GEN_PREV_KEY); let m = null; try { m = v ? JSON.parse(v) : null; } catch (e) { m = null; }
    if (!m || m.staged !== gen() || !Number.isInteger(m.prev)) return { ok: false, rule: 'RB-NO-PRE-RESTORE-GENERATION' };
    b.set(GEN_KEY, String(m.prev)); try { b.set(GEN_PREV_KEY, JSON.stringify({ prev: null, staged: null, rolled_back_from: m.staged })); } catch (e) { /* pointer already switched */ } return { ok: true, active: m.prev, from: m.staged }; }
  const hasRollback = () => { try { const m = JSON.parse(b.get(GEN_PREV_KEY) || 'null'); return !!(m && m.staged === gen() && Number.isInteger(m.prev)); } catch (e) { return false; } };
  /* 4.9.166: persist must survive QuotaExceeded — never throw uncaught into the UI banner for a routine save (esp. kernel.trace).
     Evict older gen keys / shrink array payloads (trace first), retry; soft cats swallow after last shrink so the answer path still completes. */
  const isQuota = e => !!(e && (/quota/i.test(String(e.name || '') + ' ' + String(e.message || '')) || e.code === 22 || e.code === 1014));
  const SOFT_CATS = new Set(['trace', 'ui_errors', 'jobs', 'sim_runs', 'mea_candidates', 'mea_archive', 'mea_receipts', 'mea_problems', 'mea_seals', 'reminders', 'feedback', 'sync_log', 'request_policy_gaps', 'node_jobs', 'pf_drift_log', 'ede_calibration', 'drift_archive', 'containment_receipts', 'tool_invocations', 'workbench_events', 'web_evidence', 'fetch_path', 'council', 'promotions', 'rejected_meanings', 'loops', 'collapse_events', 'language_examples', 'resurrection_proposals', 'admission_queue', 'shared_challenges', 'shared_cursor', 'shared_drafts', 'shared_outbox', 'shared_inbox', 'capsules', 'proof_exports', 'case_index', 'case_ledger', 'economy_events', 'economy_seen', 'economy_quarantine', 'economy_capsules', 'economy_manifests', 'economy_foreign', 'usage_events', 'usage_counts', 'attribution_ledger', 'attribution_foreign', 'ledger_conflicts', 'synced_items', 'receipts', 'justifications', 'withdrawal_receipts', 'hypotheses', 'admitted_rules', 'pf_echo', 'pf_agents']);
  const compactTrace = t => { if (!t || typeof t !== 'object') return t; return { turn: t.turn, at: t.at, input: typeof t.input === 'string' ? t.input.slice(0, 240) : t.input, rules: Array.isArray(t.rules) ? t.rules.map(r => (r && typeof r === 'object' ? { id: r.id || r, doc: r.doc } : r)).slice(0, 48) : t.rules, outcome: t.outcome, blocked: t.blocked, intent_kind: t.intent_kind, psi_id: t.psi_id, _shrunk: true }; };
  function freeQuotaSpace(skipCat) { if (!(b.del && b.keys)) return; const g = gen(); try {
    for (const k of b.keys()) { const m = /^kernel\.g(\d+)\./.exec(k); const kg = m ? Number(m[1]) : (/^kernel\.(?!__|g\d+\.)/.test(k) && k !== 'kernel.probe' ? 0 : -1);
      if (kg >= 0 && kg !== g) { try { b.del(k); } catch (e) { /* keep freeing */ } } }
    for (const c of ['ui_errors', 'sim_runs', 'jobs', 'mea_candidates', 'web_evidence', 'tool_invocations', 'pf_drift_log', 'sync_log']) {
      if (c === skipCat) continue; const k = pre(g) + c; if (b.get(k) == null) continue; try { b.set(k, JSON.stringify([])); } catch (e) { try { b.del(k); } catch (e2) { /* ignore */ } } }
    if (skipCat !== 'trace') { const tk = pre(g) + 'trace'; const raw = b.get(tk); if (raw) { try { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length > 5) b.set(tk, JSON.stringify(arr.slice(-5).map(compactTrace))); } catch (e) { /* ignore */ } } }
  } catch (e) { /* best-effort eviction */ } }
  function save(cat, val) { const key = pre(gen()) + cat; const put = v => { b.set(key, JSON.stringify(v)); };
    try { put(val); return { ok: true }; }
    catch (e) { if (!isQuota(e)) throw e;
      freeQuotaSpace(cat);
      try { put(val); return { ok: true, freed: true }; } catch (e2) { if (!isQuota(e2)) throw e2; }
      if (Array.isArray(val)) {
        for (const n of [100, 50, 25, 10, 5, 2, 1, 0]) {
          try { let next = val.slice(-n); if (cat === 'trace') next = next.map(compactTrace); put(next); return { ok: true, shrunk: true, kept: next.length }; }
          catch (e3) { if (!isQuota(e3)) throw e3; } }
      }
      if (SOFT_CATS.has(cat) || Array.isArray(val)) return { ok: false, rule: 'STORE-QUOTA-SOFT', cat };
      throw e; } }
  return { load(cat) { return rawLoad(gen(), cat); }, save, categories: CATEGORIES, allStores: ALL_STORES,
    generation: gen, stageGeneration, commitGeneration, rollbackGeneration, hasRollback, generationKeys: g => namesIn(g == null ? gen() : g).map(c => pre(g == null ? gen() : g) + c) }; }
function canon(o) { if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}'; return JSON.stringify(o); }
/* Layered(base0, nsOf): M1 (4.9.57) — every route proposes inside a sandbox; store writes made while a route proposes go to a
   transaction overlay (TX, nestable) and only the selected candidate's overlay is committed. nsOf maps a category to its
   case-file namespace (case:<id>:<store>) while a case is open (4.9.42). */
function Layered(base0, nsOf) { let TX = null;
  const txGet = c => { for (let t = TX; t; t = t.parent) if (t.map.has(c)) return { v: t.map.get(c) }; return null; };
  const baseStore = Object.assign(Object.create(base0), { load: c => { const h = TX && txGet(c); return h ? JSON.parse(h.v) : base0.load(c); }, save: (c, v) => (TX ? void TX.map.set(c, JSON.stringify(v)) : base0.save(c, v)) });
  const store = Object.assign(Object.create(baseStore), { load: c => baseStore.load(nsOf(c)), save: (c, v) => baseStore.save(nsOf(c), v) });
  return { base0, baseStore, store,
    txOpen() { const tx = { parent: TX, map: new Map() }; TX = tx; return tx; },
    txClose(tx) { TX = tx.parent; },
    txCommit(map) { for (const [c, v] of map) { if (TX) TX.map.set(c, v); else base0.save(c, JSON.parse(v)); } } }; }
const api = { CATEGORIES, ALL_STORES, GEN_KEY, GEN_PREV_KEY, MemoryStore, canon, Layered };
if (isNode) module.exports = api; else root.KStore = api;
})(this);
