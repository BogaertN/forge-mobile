/* toolbench.js — Tool Bench (renamed from "EchoForge" by ruling 9, 2026-10-18; re-enabled 2026-10-11) — the NO-LLM tool bench of the bidirectional language kernel.
 * Every tool is declared by a manifest (inputs, outputs, authority, effect class, network, uses_model:false) and may be invoked only
 * when the kernel has selected one of the predicate frames listed in its manifest; the permission service decides each call; results
 * are EVIDENCE records (never authority) and every invocation is traced in a hash-chained log.  LLM parts of echo-forge stay excluded. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Gv = isNode ? require('./governance.js') : root.KGov; const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  /* Forge 2.0 Build Bible §7.3 side-effect classes, derived from each manifest's effect (every class named by the Bible is listed) */
  const SIDE_EFFECT_CLASSES = ['READ_ONLY', 'TASK_WORKSPACE_WRITE', 'DEPENDENCY_QUARANTINE_WRITE', 'NETWORK_READ', 'NETWORK_WRITE', 'PROJECT_WRITE', 'HOST_WRITE', 'IDENTITY_WRITE', 'MEMORY_CANDIDATE_WRITE', 'MEMORY_PROMOTION', 'ECONOMIC_WRITE', 'DEPLOYMENT'];
  const sideEffects = effect => { const out = []; if (/network_read/.test(effect)) out.push('NETWORK_READ'); if (/vault_write|local_write/.test(effect)) out.push('MEMORY_CANDIDATE_WRITE'); if (!out.length) out.push('READ_ONLY'); return out; };
  const T = (id, frames, effect, inputs, outputs, extra) => Object.assign({ id, frames, effect, side_effects: sideEffects(effect), inputs, outputs, authority: 'evidence_only', uses_model: false, network: /network/.test(effect), available: true }, extra || {});
  const MANIFESTS = [
    T('math.evaluate', ['FR.MATH', 'FR.ALGEBRA'], 'compute', ['expression'], ['exact value'], { source: 'kmath.js / algebra.js (GP-014 checked)' }),
    T('math.solve', ['FR.ALGEBRA', 'FR.MATH'], 'compute', ['equation | expression'], ['roots | factorization | derivative | integral']),
    T('units.convert', ['FR.UNITS'], 'compute', ['quantity', 'unit'], ['converted quantity']),
    T('lexicon.define', ['FR.DEFINE'], 'read', ['word'], ['gloss + provenance']),
    T('memory.query', ['FR.QUESTION', 'FR.WHEN', 'FR.ABOUT', 'FR.MEM.LIST', 'FR.MEM.COUNT', 'FR.NOTE.LIST', 'FR.NOTE.COUNT'], 'read', ['question frame'], ['matching facts with provenance']),
    T('infer.relation', ['FR.QUESTION'], 'read', ['relation question'], ['inference chain (transitive / is-a / family)']),
    T('research.web', ['FR.TOOL.RESEARCH'], 'network_read+vault_write', ['topic'], ['≤3 exact excerpts + source receipts (sealed in vault)'], { source: 'crawler.js (port of research_acquisition.py)' }),
    T('capture.page', ['FR.TOOL.CAPTURE'], 'network_read+vault_write', ['public URL'], ['page excerpt + receipt (sealed in vault)']),
    T('github.read', ['FR.TOOL.GITHUB'], 'network_read', ['owner/repo'], ['top-level file list'], { token: 'read-only fine-grained token sealed in the vault (M1)' }),
    T('sim.preview', ['FR.TOOL.SIM'], 'compute', ['bodies, seed'], ['labelled preview + final state hash (replayable)'], { source: 'sim.js (M7; not a ProtoForge result)' }),
    T('github.symbols', ['FR.TOOL.SYMBOLS'], 'network_read', ['owner/repo'], ['symbol index rows (path, line, name, kind)'], { token: 'read-only token sealed in the vault (M1)', source: 'symbols.js' }),
    T('symbols.find', ['FR.TOOL.SYMFIND'], 'read', ['symbol name'], ['definition sites from the index']),
    T('python.crosscheck', ['FR.TOOL.PYCHECK'], 'network_read+compute', ['last math meaning'], ['agree | disagree (sympy in Pyodide, worker-isolated)'], { source: 'pycheck.js + py_worker.js (lazy; explicit tap)' }),
    T('node.job', ['FR.TOOL.NODE'], 'network_read', ['job spec'], ['job result from the paired Genesis Node (prototype) (no model)'], { source: 'nodeclient.js; tools/forge_node.py' }),
    T('protoforge.drift', ['FR.TOOL.PFDRIFT'], 'compute', ['ε_s series from traces'], ['pattern (DTW), Landauer bounds, trajectory prediction'], { source: 'protoforge.js ← ProtoForge thermodynamic_drift.py' }),
    T('protoforge.agents', ['FR.TOOL.PFAGENT'], 'compute+local_write', ['spawn | input | hibernate | restore | list'], ['deterministic agent result + hash-chained echo log'], { source: 'protoforge.js ← ProtoForge Build Task 1' }),
    T('feed.read', ['FR.TOOL.FEED'], 'network_read+vault_write', ['public RSS/Atom URL'], ['item titles + links (sealed in vault; no HTML rendered)'], { source: 'protoforge.parseFeed ← RUNTIME CODEX Vol III §4.1.1' }),
    T('case.seal', ['FR.CASE.SEAL'], 'vault_write', ['closed case id'], ['case sealed with the Identity Vault key'], { source: 'kernel case files + Identity Vault AES-GCM (plan §2)' }),
    T('case.unseal', ['FR.CASE.UNSEAL'], 'vault_write', ['sealed case id'], ['case restored from the vault'], { source: 'kernel case files + Identity Vault AES-GCM (plan §2)' }),
    T('notes.seal', ['FR.NOTE.SEAL'], 'vault_write', ['note id'], ['vault reference'], { source: 'kernel notes + Identity Vault AES-GCM' }),
    T('user.tool', ['FR.TOOL.USER'], 'compute', ['enabled user tool name', 'text input'], ['tool value (evidence)'], { source: 'toolbuilder.js — ForgeScript in a sandboxed Worker; tested + enabled tools only' }),
    T('ede.explore', ['FR.TOOL.EDE'], 'compute+local_write', ['committed memory (anchors)', 'seed'], ['bounded candidates (pending score) + archived branches (projection blocked)'], { source: 'ede.js ← RMC §5.6 / §8.3 Algorithm 3' }),
    T('sim3d.run', ['FR.TOOL.SIM3D'], 'compute', ['bodies | URDF subset, seed'], ['labelled 3-D preview + hash-chained frames (replayable)'], { source: 'sim3d.js (cannon-es + three.js, vendored MIT); not a PyBullet result' }),
    T('render.form', ['FR.RENDER'], 'compute', ['previous manifest', 'form'], ['artifact in one RMC output form + per-form echo'], { source: 'render.js (RMC multi-output)' }),
    T('patterns.reflect', ['FR.PATTERNS'], 'read', ['traces, memory, feedback'], ['recurring patterns (Pattern Reflection)']),
  ];
  const KIND2TOOL = { ede_result: 'ede.explore', pf_drift: 'protoforge.drift', pf_agent: 'protoforge.agents', rendered: 'render.form', render_none: 'render.form', render_blocked: 'render.form', math: 'math.evaluate', solved: 'math.solve', factored: 'math.solve', system: 'math.solve', calculus: 'math.solve', simplified: 'math.solve', converted: 'units.convert', define: 'lexicon.define', recall: 'memory.query', yesno: 'memory.query', when: 'memory.query', facts: 'memory.query', count: 'memory.query', count_about: 'memory.query', about: 'memory.query', inferred: 'infer.relation', patterns: 'patterns.reflect', sim_result: 'sim.preview', sim_replay: 'sim.preview' };
  function Bench(store, opts) {
    opts = opts || {}; const perm = opts.perm; const now = () => (opts.clock ? opts.clock() : new Date().toISOString());
    const byId = {}; for (const m of MANIFESTS) byId[m.id] = Object.assign({}, m, { manifest_hash: Gv.hash(m) });
    function log(e) { const l = store.load('tool_invocations'); const prev = l.length ? l[l.length - 1].hash : null; e.prev = prev; e.hash = sha256(Gv.canon(e)); l.push(e); store.save('tool_invocations', l.slice(-1000)); return e; }
    /* authorize: the frame must be kernel-selected and listed in the manifest */
    function authorize(id, frame, ctx) {
      const m = byId[id]; ctx = ctx || {}; const frameOk = !!m && !!frame && m.frames.includes(frame);
      const d = perm.authorize('tool.invoke', { manifest: m, frameSelected: frameOk, explicit: ctx.explicit, vaultUnlocked: ctx.vaultUnlocked, subject: id + '@' + (frame || 'none') });
      return { decision: d, manifest: m || null }; }
    function record(id, frame, d, result) { return log({ tool: id, frame, at: now(), permission: d.id, decision: d.decision, rule: d.rule, manifest_hash: byId[id] ? byId[id].manifest_hash : null, result_hash: result === undefined ? null : Gv.hash(result), evidence_refs: (result && result.refs) || [], authority: 'evidence_only' }); }
    function verify() { const l = store.load('tool_invocations'); let prev = null; for (let i = 0; i < l.length; i++) { const e = Object.assign({}, l[i]); const h = e.hash; delete e.hash; if (e.prev !== prev || sha256(Gv.canon(e)) !== h) return { ok: false, broken_at: i }; prev = h; } return { ok: true, count: l.length }; }
    return { manifests: () => Object.values(byId), manifest: id => byId[id] || null, authorize, record, verify, log: () => store.load('tool_invocations'), toolForKind: k => KIND2TOOL[k] || null };
  }
  const api = { Bench, MANIFESTS, KIND2TOOL, SIDE_EFFECT_CLASSES };
  if (isNode) module.exports = api; else root.KTools = api;
})(typeof self !== 'undefined' ? self : this);
