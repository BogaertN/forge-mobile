/* governance.js — W1: single permission service (Register A-04, Forge 2.0 Phase 2), switchable open decisions,
 * read-back receipts for memory writes (Register G-04, D-13), and the trace/failure debugger (Register I-10).
 * No reply text is produced here; user-facing replies are derived by derive.js from MSM meanings. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  const canon = o => { if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}'; return JSON.stringify(o); };
  const hash = o => sha256(canon(o));

  /* ---- open decisions D1–D12 (FORGE_FEATURE_PLAN §5): every one is a switch; defaults keep v4.0.0 behaviour; values marked
     built:false are listed but NOT implemented (choosing them changes nothing until the user decides and the feature is built) ---- */
  const SWITCHES = {
    memoryApproval: { decision: 'D10', values: { explicit_request: { built: true }, contested_or_sensitive: { built: true }, every_write: { built: true } }, default: 'explicit_request', effect: 'which memory writes wait for a tap-to-approve on the RMC Memory tab' },
    forgottenTier: { decision: 'D11', values: { WARM: { built: true }, COLD: { built: true } }, default: 'WARM', effect: 'whether user-forgotten facts stay resurrection-eligible (WARM) or forensic-only (COLD)' },
    hardDelete: { decision: 'D11', values: { never: { built: true }, after_retention: { built: false } }, default: 'never', effect: 'forget = move to cold storage; hard delete is not built' },
    retentionDays: { decision: 'D11', values: { none: { built: true } }, default: 'none', effect: 'no automatic expiry of cold storage, dream, ghost or drift archives' },
    echoForge: { decision: 'D6', values: { tool_bench: { built: true }, disabled: { built: true } }, default: 'tool_bench', effect: 'EchoForge = no-LLM tool bench (user decision 2026-10-11); disabled turns every tool off' },
    research: { decision: 'M4', values: { on_request: { built: true }, off: { built: true } }, default: 'on_request', effect: 'tracker-free research and page capture run only when you ask; results are sealed in the vault' },
    fetchPath: { decision: 'M4', values: { direct_cors_only: { built: true }, user_node_or_proxy: { built: true } }, default: 'direct_cors_only', effect: 'sites that are not CORS-readable need your own node/proxy URL; no third-party relay' },
    marketplaceScope: { decision: 'M9', values: { user_originated_only: { built: true }, include_captures: { built: false } }, default: 'user_originated_only', effect: 'only data you created can ever be offered; crawled pages contain other people’s data and copyrighted text' },
    marketplaceTransfer: { decision: 'M9', values: { disabled: { built: true }, live: { built: false } }, default: 'disabled', effect: 'no sale, transfer or payment is built' },
    workbench: { decision: 'D4', values: { fixed_recipes: { built: true }, parked: { built: true } }, default: 'fixed_recipes', effect: 'workbench runs declared recipes only; it auto-parks on any authority beyond its manifest' },
    sharedLayer: { decision: 'N9', values: { off: { built: true }, on: { built: true } }, default: 'off', effect: 'exchange signed, consented claim manifests and tool packages with the shared layer through the shared-layer node key; vault data never enters; incoming items are quarantined evidence' },
    nodeSync: { decision: 'N2', values: { off: { built: true }, sealed_only: { built: true } }, default: 'off', effect: 'Doc 11 sync through your paired home node: off, or sealed loops + dead paths + attribution chain only (never vault content)' },
    hash: { decision: 'D7', values: { sha256: { built: true }, blake3: { built: false } }, default: 'sha256', effect: 'ψ_id and receipt hash function' },
    classifier: { decision: 'D3', values: { off: { built: true }, advisory_evidence: { built: false } }, default: 'off', effect: 'no learned classifier anywhere' },
    localModel: { decision: 'D4b', values: { none: { built: true } }, default: 'none', effect: 'no model proposes anything' },
    vaultProfiles: { decision: 'D8', values: { separate: { built: true }, shared_passphrase: { built: false } }, default: 'separate', effect: 'the vault holds sealed secrets only' },
    derivedStatusText: { decision: 'D5', values: { replies_only: { built: true }, everything: { built: false } }, default: 'replies_only', effect: 'chat replies are derived; UI chrome labels are fixed vocabulary' },
    desktopHost: { decision: 'D1', values: { none: { built: true }, paired_node: { built: false } }, default: 'none', effect: 'no desktop Forge pairing' },
    mobileStatus: { decision: 'D2', values: { prototype: { built: true }, sanctioned_client: { built: false } }, default: 'prototype', effect: 'labelled a prototype outside Forge 1.0 gates' },
  };
  const ACTIONS = {
    'memory.write': { risk: 'state', rollback: 'supersede or forget → cold storage' },
    'memory.forget': { risk: 'state', rollback: 'resurrection gates (WARM tier)' },
    'memory.delete_ui': { risk: 'state', rollback: 'resurrection gates (WARM tier)' },
    'memory.restore': { risk: 'state', rollback: 'forget again' },
    'memory.approve_held': { risk: 'state', rollback: 'forget' },
    'containment.release': { risk: 'state', rollback: 're-quarantine' },
    'hypothesis.write': { risk: 'state', rollback: 'withdraw (status → withdrawn; never read as a fact)' },
    'loop.transition': { risk: 'state', rollback: 'transition table only' },
    'shared.contribute': { risk: 'network', rollback: 'revoke stops future pushes (pulled copies cannot be recalled)' },
    'shared.review': { risk: 'local_write', rollback: 'accepted items are evidence records only; reject keeps an audit row' },
    'shared.sync': { risk: 'network', rollback: 'pulled manifests land in quarantine only' },
    'tool.enable': { risk: 'compute', rollback: 'one-tap rollback to the previous version; disable at any time' },
    'tool.install': { risk: 'compute', rollback: 'installed tools arrive disabled as drafts; remove at any time' },
    'sync.run': { risk: 'network', rollback: 'imports land in synced_items only; never overwrite local records' },
    'memory.seal': { risk: 'local_write', rollback: 'append-only seal record; read-back verified or rolled back' },
    'code.run': { risk: 'compute', rollback: 'pure evaluation of generated expressions with the kernel evaluator; no eval, no I/O' },
    'export.drift': { risk: 'export', rollback: 'read-only package' },
    'vault.reveal': { risk: 'privacy', rollback: 'none (display only, auto-hide)' },
    'vault.write': { risk: 'privacy', rollback: 'vault remove' },
    'export.json': { risk: 'privacy', rollback: 'none' },
    'concept.admit': { risk: 'lexicon', rollback: 'supersede version' },
    'protoforge.run': { risk: 'external', rollback: 'n/a' },
    'external.action': { risk: 'external', rollback: 'n/a' },
    'policy.change': { risk: 'governance', rollback: 'set previous value' },
    'tool.invoke': { risk: 'tool', rollback: 'evidence only (nothing to undo)' },
    'consent.change': { risk: 'privacy', rollback: 'append-only ledger; withdraw' },
    'buyer.record': { risk: 'privacy', rollback: 'record only' },
    'offer.draft': { risk: 'privacy', rollback: 'revoke' },
    'package.build': { risk: 'privacy', rollback: 'supersede; local only' },
    'sale.transfer': { risk: 'external', rollback: 'n/a' },
    'payment': { risk: 'external', rollback: 'n/a' },
    'backup.create': { risk: 'privacy', rollback: 'delete file' },
    'backup.restore': { risk: 'state', rollback: 'pre-restore snapshot' },
    'data.delete_all': { risk: 'state', rollback: 'restore the portable backup exported first' },
    'profile.write': { risk: 'privacy', rollback: 'version history' },
    'feedback.write': { risk: 'state', rollback: 'append-only' },
    'workbench.run': { risk: 'state', rollback: 'park' },
  };
  function PermissionService(store, opts) {
    opts = opts || {}; const now = () => (opts.clock ? opts.clock() : new Date().toISOString());
    const loadPol = () => { const m = store.load('policy'); return Object.assign({}, ...Object.entries(SWITCHES).map(([k, s]) => ({ [k]: s.default })), m && !Array.isArray(m) ? m : {}); };
    function log(entry) { const l = store.load('permissions'); l.push(entry); store.save('permissions', l.slice(-500)); return entry; }
    function decide(action, ctx) {
      ctx = ctx || {}; const pol = loadPol(); const A = ACTIONS[action];
      if (!A) return { decision: 'deny', rule: 'PERM-UNKNOWN-ACTION' };
      if (A.risk === 'external') return { decision: 'deny', rule: action === 'protoforge.run' ? 'PERM-NO-BACKEND' : action === 'sale.transfer' || action === 'payment' ? 'PERM-MARKETPLACE-TRANSFER-NOT-BUILT' : 'PERM-NO-EXTERNAL-CAPABILITY' };
      if (action === 'tool.invoke') { if (pol.echoForge !== 'tool_bench') return { decision: 'deny', rule: 'PERM-D6-TOOL-BENCH-OFF' }; if (!ctx.frameSelected) return { decision: 'deny', rule: 'PERM-TOOL-NOT-FRAME-SELECTED' }; if (!ctx.manifest) return { decision: 'deny', rule: 'PERM-TOOL-NO-MANIFEST' }; if (ctx.manifest.uses_model) return { decision: 'deny', rule: 'PERM-TOOL-USES-MODEL' }; if (ctx.manifest.available === false) return { decision: 'deny', rule: 'PERM-TOOL-UNAVAILABLE' };
        if (ctx.manifest.network) { if (pol.research !== 'on_request') return { decision: 'deny', rule: 'PERM-M4-RESEARCH-OFF' }; if (!ctx.explicit) return { decision: 'deny', rule: 'PERM-M4-NEEDS-EXPLICIT-REQUEST' }; if (!ctx.vaultUnlocked) return { decision: 'deny', rule: 'PERM-VAULT-LOCKED' }; }
        return { decision: 'allow', rule: 'PERM-TOOL-FRAME-SELECTED' }; }
      if (action === 'workbench.run') { if (pol.workbench === 'parked') return { decision: 'deny', rule: 'PERM-D4-WORKBENCH-PARKED' }; return ctx.userTap ? { decision: 'allow', rule: 'PERM-USER-TAP' } : { decision: 'needs_approval', rule: 'PERM-NEEDS-USER-TAP' }; }
      if (ctx.blocked) return { decision: 'deny', rule: 'PERM-UPSTREAM-BLOCK' };
      if (action === 'memory.write' || action === 'memory.forget') {
        if (!ctx.explicit) return { decision: 'deny', rule: 'PERM-NO-EXPLICIT-REQUEST' };
        if (pol.memoryApproval === 'every_write') return { decision: 'needs_approval', rule: 'PERM-D10-EVERY-WRITE' };
        if (pol.memoryApproval === 'contested_or_sensitive' && (ctx.contested || ctx.sensitive)) return { decision: 'needs_approval', rule: 'PERM-D10-CONTESTED-OR-SENSITIVE' };
        return { decision: 'allow', rule: 'PERM-EXPLICIT-REQUEST' }; }
      if (action === 'policy.change') { const s = SWITCHES[ctx.key]; if (!s || !s.values[ctx.value]) return { decision: 'deny', rule: 'PERM-POLICY-UNKNOWN-VALUE' }; if (!s.values[ctx.value].built) return { decision: 'deny', rule: 'PERM-POLICY-NOT-BUILT' }; return ctx.userTap ? { decision: 'allow', rule: 'PERM-POLICY-USER-TAP' } : { decision: 'needs_approval', rule: 'PERM-POLICY-NEEDS-TAP' }; }
      if (action === 'vault.reveal' || action === 'vault.write') return ctx.unlocked ? (ctx.userTap || action === 'vault.write' ? { decision: 'allow', rule: 'PERM-VAULT-UNLOCKED' } : { decision: 'needs_approval', rule: 'PERM-VAULT-TAP' }) : { decision: 'deny', rule: 'PERM-VAULT-LOCKED' };
      if (action === 'shared.contribute' || action === 'shared.review' || action === 'tool.enable' || action === 'tool.install') return ctx.userTap ? { decision: 'allow', rule: 'PERM-USER-TAP' } : { decision: 'needs_approval', rule: 'PERM-NEEDS-USER-TAP' };
      if (action === 'shared.sync') return pol.sharedLayer === 'on' ? { decision: 'allow', rule: 'PERM-SHARED-LAYER-ON' } : { decision: 'deny', rule: 'PERM-SHARED-LAYER-OFF' };
      if (action === 'sync.run') { if (pol.nodeSync !== 'sealed_only') return { decision: 'deny', rule: 'PERM-N2-SYNC-OFF' }; return ctx.userTap ? { decision: 'allow', rule: 'PERM-USER-TAP' } : { decision: 'needs_approval', rule: 'PERM-NEEDS-USER-TAP' }; }
      if (action === 'memory.seal') return ctx.userTap ? { decision: 'allow', rule: 'PERM-USER-TAP' } : { decision: 'needs_approval', rule: 'PERM-NEEDS-USER-TAP' };
      if (action === 'code.run') return ctx.userTap ? { decision: 'allow', rule: 'PERM-USER-TAP' } : { decision: 'needs_approval', rule: 'PERM-NEEDS-USER-TAP' };
      if (action === 'export.drift') return ctx.userTap ? { decision: 'allow', rule: 'PERM-USER-TAP' } : { decision: 'needs_approval', rule: 'PERM-NEEDS-USER-TAP' };
      if (action === 'loop.transition') return { decision: 'allow', rule: 'PERM-LIFECYCLE-TABLE' };
      /* every other state or privacy action needs an explicit user tap (UI confirm) */
      return ctx.userTap ? { decision: 'allow', rule: 'PERM-USER-TAP' } : { decision: 'needs_approval', rule: 'PERM-NEEDS-USER-TAP' };
    }
    function authorize(action, ctx) {
      const d = decide(action, ctx); const pol = loadPol();
      const e = Object.assign({ id: 'perm:' + sha256(action + '|' + now() + '|' + store.load('permissions').length).slice(0, 16), action, at: now(), policy_hash: hash(pol).slice(0, 16), subject: ctx && ctx.subject || null }, d);
      return log(e); }
    /* v4.8.4: the same decision WITHOUT writing the permission log; the caller stores the entry inside a staged generation (atomic restore) */
    function authorizeDeferred(action, ctx) {
      const d = decide(action, ctx); const pol = loadPol();
      return Object.assign({ id: 'perm:' + sha256(action + '|' + now() + '|' + store.load('permissions').length).slice(0, 16), action, at: now(), policy_hash: hash(pol).slice(0, 16), subject: ctx && ctx.subject || null }, d); }
    function setPolicy(key, value, userTap) { const d = authorize('policy.change', { key, value, userTap, subject: key }); if (d.decision !== 'allow') return d; const m = store.load('policy'); store.save('policy', Object.assign({}, m && !Array.isArray(m) ? m : {}, { [key]: value })); return d; }
    return { authorize, authorizeDeferred, decide, policy: loadPol, setPolicy, log: () => store.load('permissions'), switches: SWITCHES, actions: ACTIONS };
  }

  /* ---- read-back receipts (G-04): what was written is re-loaded from the store and hashed; mismatch ⇒ rollback ---- */
  function readback(store, cat, id, expected) {
    const v = store.load(cat); const got = Array.isArray(v) ? v.find(x => x && x.id === id) : null;
    const eh = expected ? hash(expected) : null, gh = got ? hash(got) : null;
    return { store: cat, id, expected_hash: eh, readback_hash: gh, readback: eh && gh && eh === gh ? 'match' : got ? 'mismatch' : 'absent' };
  }

  /* ---- trace / failure debugger (I-10): input → derivation → cognition → containment → manifest → output → Echo → memory ---- */
  function debugTrace(tr) {
    if (!tr) return { stages: [], first_failure: null };
    const has = id => (tr.rules || []).some(r => String(r.id).indexOf(id) === 0);
    const out = tr.msm && tr.msm.meaning ? tr.msm.meaning.kind : null;
    const st = [];
    st.push({ stage: 'input custody', ok: tr.input !== undefined, detail: { privacy: has('PRIV-1') ? 'values sealed at ingestion' : 'no sensitive values', chars: String(tr.input || '').length } });
    const lc = tr.outcome ? tr.outcome.class : null; const lcOk = !(lc === 'reject');
    st.push({ stage: 'language core', ok: lcOk, detail: { outcome: tr.outcome ? tr.outcome.category : null, frame: tr.frame || null, gates: tr.gates || null } });
    const hard = tr.drift && tr.drift.band === 'hard_stop' && tr.blocked && !tr.derivation;
    st.push({ stage: 'cognition (drift, χ)', ok: !hard, detail: tr.drift ? { eps_s: tr.drift.eps_s, band: tr.drift.band, chi: tr.chi || null } : null });
    const later = tr.containment && /^(echo_failed|derivation_failed|forbidden_transition)$/.test(tr.containment.cause || ''); /* routed because a later stage failed: report the cause there */
    st.push({ stage: 'containment route', ok: !tr.containment ? null : later ? null : ['active_stack_candidate', 'correction_queue', 'dream_state_quarantine_candidate'].includes(tr.containment.route), detail: tr.containment || null });
    st.push({ stage: 'manifest (MSM)', ok: !!tr.msm, detail: tr.msm ? { msm_id: tr.msm.msm_id, kind: out, may_write_memory: tr.msm.limits && tr.msm.limits.may_write_memory } : null });
    const dOk = !!tr.derivation && !tr.derivation_error && !(tr.derivation && tr.derivation.forbidden_transition);
    st.push({ stage: 'output derivation', ok: hard ? null : dOk, detail: tr.derivation ? { rules: tr.derivation.rule_count, trail: tr.derivation.phase_trail, forbidden: tr.derivation.forbidden_transition || null } : (tr.derivation_error || null) });
    st.push({ stage: 'Echo', ok: tr.echo ? !!tr.echo.pass : (dOk ? false : null), detail: tr.echo ? { pass: tr.echo.pass, reason: tr.echo.reason || '' } : null });
    const rb = tr.readback || []; st.push({ stage: 'memory + read-back', ok: rb.every(x => x.readback === 'match') && !tr.rollback, detail: { ops: (tr.memory || []).map(m => m.op), readback: rb, rollback: tr.rollback || null, held: tr.held_write || null } });
    const ff = st.find(s => s.ok === false); return { stages: st, first_failure: ff ? ff.stage : null, delivered: !tr.blocked };
  }
  const api = { PermissionService, SWITCHES, ACTIONS, readback, debugTrace, hash, canon };
  if (isNode) module.exports = api; else root.KGov = api;
})(this);
