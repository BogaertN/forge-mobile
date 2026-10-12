/* operator.js — W4 operator pieces: feedback (H-04), encrypted backup/restore (G-12), operational-identity profiles kept separate from
 * secrets (J-03, D8), Gilligan cross-session pattern reflection (J-06; advisory, never memory), diagnostics (I-10/K-04), and the
 * D4 workbench: fixed recipes with a park kill switch that auto-parks on any authority beyond the recipe manifest. No reply text. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Gv = isNode ? require('./governance.js') : root.KGov; const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
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
    return { feedback, backup, restore, saveProfile, activateProfile, profiles: () => L('profiles'), runRecipe, unpark, RECIPES, diagnostics, gilligan: o => gilligan(store, o) };
  }
  const api = { Operator, gilligan };
  if (isNode) module.exports = api; else root.KOperator = api;
})(typeof self !== 'undefined' ? self : this);
