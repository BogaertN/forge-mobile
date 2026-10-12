/* operator.js — W4 operator pieces: feedback (H-04), encrypted backup/restore (G-12), operational-identity profiles kept separate from
 * secrets (J-03, D8), Gilligan cross-session pattern reflection (J-06; advisory, never memory), diagnostics (I-10/K-04), and the
 * D4 workbench: fixed recipes with a park kill switch that auto-parks on any authority beyond the recipe manifest. No reply text. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Gv = isNode ? require('./governance.js') : root.KGov; const PV = isNode ? require('./privacy.js') : root.KPrivacy; const MG = isNode ? require('./migrate.js') : root.KMigrate; const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  const STOP = new Set('i me my you your the a an is are was were be to of and or in on at for with that this it its he she they we our his her their what who when where which how do does did not no yes'.split(' '));
  /* Gilligan (GenNode Doc 10): recurring entities across sessions + repeated unknown words + feedback marked wrong. Counts only. */
  function gilligan(store, opts) {
    opts = opts || {}; const min = opts.min || 3; const mem = (store.load('memory') || []).filter(r => r.status === 'active' && !r.sensitive);
    const ent = {}; for (const r of mem) for (const e of r.entities || []) { const w = String(e).replace(/^.*:/, ''); if (w && !STOP.has(w) && !/sealed/.test(w)) ent[w] = (ent[w] || 0) + 1; }
    const tr = store.load('trace') || []; const unk = {}; for (const t of tr) for (const w of (t.msm && t.msm.uncertainty && t.msm.uncertainty.unknown_concepts) || []) unk[w] = (unk[w] || 0) + 1;
    const fb = (store.load('feedback') || []).filter(f => f.verdict === 'wrong').length;
    const P = [];
    for (const [w, n] of Object.entries(ent).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) if (n >= min) P.push({ type: 'recurring_entity', word: w, count: n });
    for (const [w, n] of Object.entries(unk).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))) if (n >= 2) P.push({ type: 'repeated_unknown_word', word: w, count: n });
    if (fb >= 2) P.push({ type: 'replies_marked_wrong', word: 'wrong', count: fb });
    return { patterns: P.slice(0, 6), basis: { facts: mem.length, traces: tr.length, feedback_wrong: fb, threshold: min }, authority: 'reflection_only (never memory, never truth)' }; }
  function Operator(store, opts) {
    opts = opts || {}; const perm = opts.perm; const now = () => (opts.clock ? opts.clock() : new Date().toISOString()); const vault = opts.vault;
    const L = c => { const v = store.load(c); return Array.isArray(v) ? v : []; };
    function feedback(turn, verdict, userTap) { if (!['helpful', 'wrong', 'unclear'].includes(verdict)) return { ok: false, rule: 'FB-UNKNOWN-VERDICT' };
      const d = perm.authorize('feedback.write', { userTap, subject: 'trace:' + turn }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
      const t = L('trace').find(x => x.turn === turn); const f = { id: 'fb:' + turn + ':' + L('feedback').length, turn, verdict, at: now(), msm_id: t && t.msm ? t.msm.msm_id : null, kind: t && t.msm && t.msm.meaning ? t.msm.meaning.kind : null, rules: t ? (t.derivation ? t.derivation.rule_count : null) : null };
      const fs = L('feedback'); fs.push(f); store.save('feedback', fs); return { ok: true, feedback: f, readback: Gv.readback(store, 'feedback', f.id, f).readback }; }
    /* encrypted backup: every store, AES-GCM under the vault key; manifest hash checked on restore; restore keeps a pre-restore snapshot */
    async function backup(categories, userTap) { const d = perm.authorize('backup.create', { userTap }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; if (!vault || vault.status() !== 'unlocked') return { ok: false, rule: 'PERM-VAULT-LOCKED' };
      const data = {}; for (const c of categories) data[c] = store.load(c); const manifest = { format: 'forge-mobile-backup-v1', created: now(), categories, data_sha256: sha256(Gv.canon(data)) };
      const box = await vault.encryptBlob(JSON.stringify({ manifest, data })); return { ok: true, file: { format: manifest.format, created: manifest.created, manifest_sha256: sha256(Gv.canon(manifest)), box } }; }
    async function restore(file, userTap) { const d = perm.authorize('backup.restore', { userTap }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; if (!vault || vault.status() !== 'unlocked') return { ok: false, rule: 'PERM-VAULT-LOCKED' };
      let o; try { o = JSON.parse(await vault.decryptBlob(file.box)); } catch (e) { return { ok: false, rule: 'BACKUP-DECRYPT-FAILED' }; }
      if (sha256(Gv.canon(o.data)) !== o.manifest.data_sha256 || sha256(Gv.canon(o.manifest)) !== file.manifest_sha256) return { ok: false, rule: 'BACKUP-MANIFEST-MISMATCH' };
      const snap = {}; for (const c of o.manifest.categories) snap[c] = store.load(c);
      for (const c of o.manifest.categories) store.save(c, o.data[c]);
      const bad = o.manifest.categories.filter(c => Gv.hash(store.load(c)) !== Gv.hash(o.data[c]));
      if (bad.length) { for (const c of Object.keys(snap)) store.save(c, snap[c]); return { ok: false, rule: 'RB-READBACK-MISMATCH-ROLLBACK', bad }; }
      return { ok: true, restored: o.manifest.categories.length, readback: 'match' }; }
    /* ---- portable Backup & Recovery (v4.8.3) ----
     * Format forge-mobile-portable-backup v1: a plaintext header (format, format_version, app_schema, created, store list, manifest hash) and an
     * AES-GCM box whose KDF parameters and salt travel WITH the file (PBKDF2-SHA-256), so a fresh install opens it before any local vault exists.
     * The restored Identity Vault store keeps its own salt and opens with the vault passphrase it had on the original device.
     * Restore is atomic: the file is opened and verified (passphrase, hashes, schema, migration in a staging copy) BEFORE anything on this
     * device is touched; a failed read-back writes the pre-restore snapshot back. Forge cannot recover a lost passphrase. */
    const STORES = () => (store.allStores || opts.categories || []).filter(c => c !== 'restore_rollback');
    const dflt = c => (c === 'meta' ? {} : []); let lastExport = null;
    async function portableBackup(pass, o) { o = o || {}; const pr = PV.passphraseProblem(pass); if (pr) return { ok: false, rule: 'BACKUP-PASSPHRASE-RULE', detail: pr };
      const d = perm.authorize('backup.create', { userTap: !!o.userTap }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
      const stores = STORES(); const data = {}; for (const c of stores) data[c] = store.load(c); const mig = store.load('migrations'); const app_schema = mig && !Array.isArray(mig) && mig.schema ? mig.schema : MG.SCHEMA;
      const manifest = { format: 'forge-mobile-portable-backup', format_version: 1, app_schema, created: now(), stores, data_sha256: sha256(Gv.canon(data)) };
      const box = await PV.portableSeal(pass, JSON.stringify({ manifest, data }), { iterations: o.iterations }); lastExport = { at: manifest.created, manifest_sha256: sha256(Gv.canon(manifest)) };
      return { ok: true, file: { format: manifest.format, format_version: 1, app_schema, created: manifest.created, stores, manifest_sha256: lastExport.manifest_sha256, box } }; }
    /* v4.8.4: strict header validation BEFORE any key derivation or decoding (types, ranges, sizes, store list) */
    function fileProblem(file) { const L = PV.PORTABLE_LIMITS; if (!file || typeof file !== 'object' || Array.isArray(file)) return 'BACKUP-FORMAT'; if (file.format !== 'forge-mobile-portable-backup') return 'BACKUP-FORMAT';
      if (!PORTABLE_VERSIONS.includes(file.format_version)) return 'BACKUP-FORMAT-VERSION';
      if (!Object.keys(file).every(k => ['format', 'format_version', 'app_schema', 'created', 'stores', 'manifest_sha256', 'box'].includes(k))) return 'BACKUP-MALFORMED-HEADER';
      if (!Number.isInteger(file.app_schema) || file.app_schema < 0 || file.app_schema > 10000) return 'BACKUP-MALFORMED-HEADER'; if (typeof file.created !== 'string' || file.created.length > 64) return 'BACKUP-MALFORMED-HEADER';
      if (typeof file.manifest_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(file.manifest_sha256)) return 'BACKUP-MALFORMED-HEADER';
      if (!Array.isArray(file.stores)) return 'BACKUP-MALFORMED-HEADER'; if (file.stores.length > L.stores_max) return 'BACKUP-LIMIT-STORE-COUNT'; if (!file.stores.every(c => typeof c === 'string' && /^[a-z0-9_]{1,64}$/.test(c)) || new Set(file.stores).size !== file.stores.length) return 'BACKUP-MALFORMED-HEADER';
      const bp = PV.boxProblem(file.box); if (bp) return bp; let n = 0; try { n = JSON.stringify(file).length; } catch (e) { return 'BACKUP-MALFORMED-HEADER'; } if (n > L.file_bytes) return 'BACKUP-LIMIT-FILE-SIZE'; return null; }
    function parsePortableText(text) { try { return { ok: true, file: PV.parseBounded(text) }; } catch (e) { return { ok: false, rule: String(e.message || 'BACKUP-MALFORMED-FILE') }; } }
    async function openPortable(file, pass) { const fp = fileProblem(file); if (fp) return { err: fp };
      let txt; try { txt = await PV.portableOpen(pass, file.box); } catch (e) { const m = String(e && e.message); return { err: /^BACKUP-/.test(m) ? m : 'BACKUP-WRONG-PASSPHRASE-OR-CORRUPT' }; }
      if (PV.jsonDepth(txt) > PV.PORTABLE_LIMITS.json_depth) return { err: 'BACKUP-LIMIT-JSON-DEPTH' };
      let o; try { o = JSON.parse(txt); } catch (e) { return { err: 'BACKUP-WRONG-PASSPHRASE-OR-CORRUPT' }; }
      if (!o || typeof o !== 'object' || !o.data || typeof o.data !== 'object' || Array.isArray(o.data)) return { err: 'BACKUP-MANIFEST-MISMATCH' };
      if (Object.keys(o.data).length > PV.PORTABLE_LIMITS.stores_max) return { err: 'BACKUP-LIMIT-STORE-COUNT' }; if (!Object.keys(o.data).every(c => file.stores.includes(c))) return { err: 'BACKUP-MANIFEST-MISMATCH' };
      if (!o || !o.manifest || !o.data || sha256(Gv.canon(o.data)) !== o.manifest.data_sha256 || sha256(Gv.canon(o.manifest)) !== file.manifest_sha256) return { err: 'BACKUP-MANIFEST-MISMATCH' };
      if (!(o.manifest.app_schema >= 0) || o.manifest.app_schema > MG.SCHEMA) return { err: 'BACKUP-SCHEMA-NEWER-THAN-APP' };
      const stage = JSON.parse(JSON.stringify(o.data)); const ss = { load: c => (stage[c] === undefined ? dflt(c) : JSON.parse(JSON.stringify(stage[c]))), save: (c, v) => { stage[c] = JSON.parse(JSON.stringify(v)); } };
      const m0 = ss.load('migrations'); if (!m0 || Array.isArray(m0) || (m0.schema || 0) !== o.manifest.app_schema) ss.save('migrations', Object.assign({ applied: [] }, m0 && !Array.isArray(m0) ? m0 : {}, { schema: o.manifest.app_schema }));
      const mr = MG.migrate(ss, now()); if (mr.applied_now.some(x => x.error)) return { err: 'BACKUP-MIGRATION-FAILED' };
      return { manifest: o.manifest, data: stage, migrated: mr.applied_now.map(x => x.id) }; }
    const PORTABLE_VERSIONS = [1];
    async function inspectPortable(file, pass) { const r = await openPortable(file, pass); return r.err ? { ok: false, rule: r.err } : { ok: true, app_schema: r.manifest.app_schema, stores: Object.keys(r.data).length, created: r.manifest.created, migrations: r.migrated }; }
    function writeAll(data) { for (const c of Object.keys(data)) store.save(c, data[c]); return Object.keys(data).filter(c => Gv.hash(store.load(c)) !== Gv.hash(data[c])); }
    /* v4.8.4 atomic restore with STAGED, VERSIONED storage: the verified, migrated target is written as a complete NEW generation and read back;
     * rollback metadata is written; then ONE active-generation pointer is switched (the commit). The permission decision is recorded inside the
     * staged generation, so a failure or crash at ANY write before the pointer switch leaves the old generation active and byte-identical. */
    async function portableRestore(file, pass, o) { o = o || {}; const r = await openPortable(file, pass); if (r.err) return { ok: false, rule: r.err, changed: false };
      if (!store.stageGeneration) return { ok: false, rule: 'RESTORE-STORE-NOT-GENERATIONAL', changed: false };
      const pe = perm.authorizeDeferred ? perm.authorizeDeferred('backup.restore', { userTap: !!o.userTap }) : perm.authorize('backup.restore', { userTap: !!o.userTap });
      if (pe.decision !== 'allow') return { ok: false, rule: pe.rule, changed: false };
      const target = JSON.parse(JSON.stringify(r.data)); delete target.restore_rollback;
      if (perm.authorizeDeferred) { const pl = Array.isArray(target.permissions) ? target.permissions : store.load('permissions'); target.permissions = pl.concat([pe]).slice(-500); }
      const before = store.generation(); let st;
      try { st = store.stageGeneration(target, o.faultyWrite);
        if (st.bad.length) return { ok: false, rule: 'RB-READBACK-MISMATCH-ROLLBACK', bad: st.bad, rolled_back: store.generation() === before, changed: false };
        store.commitGeneration(st); }
      catch (e) { return { ok: false, rule: /quota/i.test(String(e && (e.name + ' ' + e.message))) ? 'RESTORE-QUOTA-ABORTED' : 'RESTORE-WRITE-ABORTED', rolled_back: store.generation() === before, changed: store.generation() !== before, detail: String(e && e.message || e).slice(0, 120) }; }
      return { ok: true, restored: Object.keys(r.data).length, migrated: r.migrated, readback: 'match', generation: st.to, rollback: 'available (previous generation ' + st.from + ' kept unmodified)' }; }
    function rollbackRestore(o) { o = o || {}; if (!store.hasRollback || !store.hasRollback()) return { ok: false, rule: 'RB-NO-PRE-RESTORE-SNAPSHOT' };
      const d = perm.authorizeDeferred ? perm.authorizeDeferred('backup.restore', { userTap: !!o.userTap, subject: 'rollback' }) : perm.authorize('backup.restore', { userTap: !!o.userTap, subject: 'rollback' });
      if (d.decision !== 'allow') { if (perm.authorizeDeferred) perm.authorize('backup.restore', { userTap: !!o.userTap, subject: 'rollback' }); return { ok: false, rule: d.rule }; }
      const r = store.rollbackGeneration(); if (!r.ok) return r; if (perm.authorizeDeferred) store.save('permissions', store.load('permissions').concat([d]).slice(-500)); return { ok: true, generation: r.active, readback: 'match' }; }
    /* Delete all local data: export first, typed confirmation, lists exactly what is removed */
    const DELETE_PHRASE = 'DELETE ALL';
    function deletePlan() { const stores = STORES().map(c => { const v = store.load(c); return { store: c, items: Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0 }; });
      return { stores, browser: ['localStorage keys kernel.<store> for every store listed', 'localStorage UI flags (forge_*)', 'service-worker caches (app shell and reminder mirror)', 'the device signing key (inside the vault store)'], not_removed: ['copies already shared to the shared layer or a home node', 'backup files you downloaded'], confirm_phrase: DELETE_PHRASE, export_first: true, exported: lastExport }; }
    function deleteAll(o) { o = o || {}; if (!lastExport) return { ok: false, rule: 'DELETE-EXPORT-FIRST' }; if (o.confirm !== DELETE_PHRASE) return { ok: false, rule: 'DELETE-CONFIRMATION-MISMATCH' };
      const d = perm.authorize('data.delete_all', { userTap: !!o.userTap }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; const plan = deletePlan();
      for (const p of plan.stores) store.save(p.store, dflt(p.store)); return { ok: true, removed: plan.stores.map(p => p.store), plan }; }
    /* operational identity profiles (Self-Hosted Identity Vault doc): preferences/rules/context; NOT secrets; versioned */
    const PROFILE_FIELDS = ['display_name', 'preferred_style', 'working_hours', 'project_goals', 'agent_rules', 'notation'];
    function saveProfile(p, userTap) { const d = perm.authorize('profile.write', { userTap, subject: p && p.name }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
      if (!p || !p.name) return { ok: false, rule: 'PROFILE-NAME-REQUIRED' }; const fields = {}; for (const k of PROFILE_FIELDS) if (p[k] !== undefined) fields[k] = String(p[k]).slice(0, 500);
      const PV = isNode ? require('./privacy.js') : root.KPrivacy; if (PV.redact(Object.values(fields).join(' \n ')).secrets.length) return { ok: false, rule: 'PROFILE-SECRET-REFUSED (secrets belong in the vault)' };
      const ps = L('profiles'); const prev = ps.filter(x => x.name === p.name); const rec = { id: 'profile:' + p.name + ':v' + (prev.length + 1), name: p.name, version: prev.length + 1, fields, at: now(), active: false };
      ps.push(rec); store.save('profiles', ps); return { ok: true, profile: rec, readback: Gv.readback(store, 'profiles', rec.id, rec).readback }; }
    function activateProfile(id, userTap) { const d = perm.authorize('profile.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; const ps = L('profiles'); if (!ps.some(x => x.id === id)) return { ok: false, rule: 'PROFILE-UNKNOWN' }; for (const x of ps) x.active = x.id === id; store.save('profiles', ps); return { ok: true }; }
    /* D4 workbench: fixed recipes; each declares the actions it may take; anything else auto-parks the workbench */
    const RECIPES = {
      'tidy-held-writes': { authority: ['memory.approve_held'], about: 'list held writes older than a day (read) — approval stays per item' },
      'verify-chains': { authority: [], about: 'verify audit, containment, tool and consent hash chains (read only)' },
      'export-snapshot': { authority: ['export.json'], about: 'produce a JSON export (redacted)' },
    };
    function runRecipe(name, steps, userTap) {
      const r = RECIPES[name]; if (!r) return { ok: false, rule: 'WB-UNKNOWN-RECIPE' };
      const d = perm.authorize('workbench.run', { userTap, subject: name }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
      for (const s of steps || []) if (!r.authority.includes(s)) { perm.setPolicy('workbench', 'parked', true); store.save('workbench_events', L('workbench_events').concat([{ at: now(), recipe: name, attempted: s, result: 'auto-parked' }])); return { ok: false, rule: 'WB-AUTHORITY-EXCEEDED-PARKED', attempted: s }; }
      store.save('workbench_events', L('workbench_events').concat([{ at: now(), recipe: name, steps: steps || [], result: 'ran' }])); return { ok: true }; }
    function unpark(userTap) { return perm.setPolicy('workbench', 'fixed_recipes', userTap); }
    /* diagnostics: one row per check; no reply text */
    function diagnostics(extra) { const rows = []; const add = (check, ok, detail) => rows.push({ check, ok, detail });
      for (const [k, f] of Object.entries(extra || {})) { try { const r = f(); add(k, r.ok !== false, r); } catch (e) { add(k, false, String(e.message)); } }
      const sizes = {}; let total = 0; for (const c of (opts.categories || [])) { const n = JSON.stringify(store.load(c) || []).length; sizes[c] = n; total += n; } add('store sizes', total < 4.5e6, { total_chars: total, largest: Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 3) });
      const mem = L('memory').filter(r => r.status === 'active'); const seen = {}; let dup = 0; for (const r of mem) { const k = r.clause ? Gv.hash(r.clause) : r.text; if (seen[k]) dup++; seen[k] = 1; } add('duplicate active facts', dup === 0, { duplicates: dup });
      const tr = L('trace').slice(-20); add('drift monitor (last 20)', !tr.some(t => t.drift && t.drift.band === 'hard_stop'), { eps_s: tr.map(t => t.drift ? t.drift.eps_s : null) });
      return { at: now(), rows, ok: rows.every(r => r.ok) }; }
    return { feedback, backup, restore, portableBackup, inspectPortable, parsePortableText, portableRestore, rollbackRestore, deletePlan, deleteAll, DELETE_PHRASE, saveProfile, activateProfile, profiles: () => L('profiles'), runRecipe, unpark, RECIPES, diagnostics, gilligan: o => gilligan(store, o) };
  }
  const api = { Operator, gilligan };
  if (isNode) module.exports = api; else root.KOperator = api;
})(typeof self !== 'undefined' ? self : this);
