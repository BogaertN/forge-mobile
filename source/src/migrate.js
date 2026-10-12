/* Data migration between app versions. Ordered, idempotent, recorded (before/after store hashes) in the "migrations" store.
 * A migration never deletes user content; it only moves or annotates. Schema 3 = v4.3.0. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SCHEMA = 3;
const obj = v => (v && !Array.isArray(v) && typeof v === 'object' ? v : null);
const STEPS = [
  { to: 1, id: 'MIG-1-POLICY-OUT-OF-META', stores: ['meta', 'policy'], run(s) { const m = obj(s.load('meta')) || {}; if (!m.policy) return 0; const p = obj(s.load('policy')); if (!p || !Object.keys(p).length) s.save('policy', m.policy); delete m.policy; s.save('meta', m); return 1; } },
  { to: 2, id: 'MIG-2-LEXICON-LICENCE-EVIDENCE', stores: ['lexicon_user'], run(s) { const u = s.load('lexicon_user'); let n = 0; for (const c of u) { if (!c.license) { c.license = 'user-owned'; n++; } if (!c.evidence) { c.evidence = 'admitted before 4.3 (direct admission, user authority)'; n++; } } if (n) s.save('lexicon_user', u); return n; } },
  { to: 3, id: 'MIG-3-FETCH-PATH-KIND', stores: ['fetch_path'], run(s) { const f = obj(s.load('fetch_path')); if (!f || !f.url || f.kind) return 0; f.kind = 'proxy'; s.save('fetch_path', f); return 1; } },
];
function hashOf(s, names) { return sha256(JSON.stringify(names.map(n => s.load(n)))).slice(0, 16); }
function migrate(store, at) { const log = obj(store.load('migrations')) || { schema: 0, applied: [] }; const done = [];
  for (const st of STEPS) { if (log.schema >= st.to) continue; const before = hashOf(store, st.stores); let changed = 0, error = null; try { changed = st.run(store); } catch (e) { error = String(e && e.message); }
    const rec = { id: st.id, to: st.to, at: at || new Date().toISOString(), changed, before, after: hashOf(store, st.stores), error }; log.applied.push(rec); done.push(rec); if (error) break; log.schema = st.to; }
  store.save('migrations', log); return { schema: log.schema, target: SCHEMA, applied_now: done }; }
const api = { SCHEMA, STEPS, migrate };
if (isNode) module.exports = api; else root.KMigrate = api;
})(typeof self !== 'undefined' ? self : this);
