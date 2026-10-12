/* toolbuilder.js — Tool Builder (user request 2026-10-11): users create, change and add EchoForge tools without breaking the app.
 * A tool = a declarative manifest + ForgeScript code (fscript.js safe subset) + its own tests. In the browser each run happens in a fresh
 * sandboxed Worker (tool_worker.js) that is terminated on timeout. Rules: tests are required and must all pass on the exact version before
 * it can be enabled (tap); every save is a new version and one tap rolls back; 3 consecutive runtime failures auto-disable the tool; packages
 * are signed (device ECDSA key) for export/import and the shared-layer marketplace; imports arrive DISABLED and need a permission review plus a
 * test pass before use. Grants beyond pure compute (network, DOM, storage) are refused: ForgeScript has no such capability, and adding one is a
 * new permission-service decision. No prices or payments (economy NOT_AUTHORIZED). Results are evidence only. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha; const FS = isNode ? require('./fscript.js') : root.KFScript;
const SH = isNode ? require('./shared.js') : root.KShared;
const NAME = /^[a-z][a-z0-9-]{1,30}$/; const FAIL_LIMIT = 3; const TIMEOUT_MS = 2000; const GRANTS_SUPPORTED = [];
/* runners: browser → fresh Worker per call; Node (tests) → in-process interpreter with the same limits */
function workerRunner(url) { return (code, input) => new Promise(res => { let w; try { w = new Worker(url); } catch (e) { return res({ ok: false, error: 'TOOL-WORKER-UNAVAILABLE' }); }
  const t = setTimeout(() => { w.terminate(); res({ ok: false, error: 'TOOL-TIMEOUT' }); }, TIMEOUT_MS); w.onmessage = e => { clearTimeout(t); w.terminate(); res(e.data); }; w.onerror = e => { clearTimeout(t); w.terminate(); res({ ok: false, error: 'TOOL-CRASH ' + String(e.message || '').slice(0, 60) }); }; w.postMessage({ code, input, id: 1 }); }); }
const localRunner = async (code, input) => { try { const r = FS.run(code, input); return { ok: true, value: r.value, steps: r.steps }; } catch (e) { return { ok: false, error: String(e.message).slice(0, 120) }; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b) || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)));
function Builder(store, deps) { const { perm, ledger, shared, signer } = deps; const run = deps.runner || localRunner; const now = () => (deps.clock ? deps.clock() : new Date().toISOString());
  const all = () => store.load('user_tools'); const save = l => store.save('user_tools', l); const get = n => all().find(t => t.name === n);
  const vrec = (t, v) => t && t.versions.find(x => x.v === v);
  function validate(def) { if (!def || !NAME.test(def.name || '')) return 'TOOL-NAME'; if (!def.description || String(def.description).length > 300) return 'TOOL-DESCRIPTION';
    if ((def.grants || []).some(g => !GRANTS_SUPPORTED.includes(g))) return 'TOOL-GRANT-UNSUPPORTED'; if (!Array.isArray(def.tests) || !def.tests.length || def.tests.length > 50) return 'TOOL-TESTS-REQUIRED';
    if (def.tests.some(t => !t || typeof t.input !== 'string' || !('expect' in t))) return 'TOOL-TEST-SHAPE'; if (Object.keys(def).some(k => /^(price|payment|wallet|currency)$/i.test(k))) return 'TOOL-ECONOMY-NOT-AUTHORIZED';
    try { FS.parse(def.code); } catch (e) { return 'TOOL-CODE ' + e.message; } return null; }
  function saveVersion(def, origin) { const err = validate(def); if (err) return { ok: false, rule: err.split(' ')[0], detail: err };
    const l = all(); let t = l.find(x => x.name === def.name); if (!t) { t = { name: def.name, id: 'user.' + def.name, versions: [], active: null, enabled: false, failures: 0, history: [] }; l.push(t); }
    const manifest = { id: 'user.' + def.name, name: def.name, description: String(def.description), inputs: def.inputs || ['text'], outputs: def.outputs || ['value'], effect: 'compute', side_effects: ['READ_ONLY'], grants: [], authority: 'evidence_only', uses_model: false, language: 'ForgeScript' };
    const v = (t.versions.length ? t.versions[t.versions.length - 1].v : 0) + 1; const rec = { v, manifest, code: String(def.code), tests: def.tests.map(x => ({ input: x.input, expect: x.expect })), created: now(), origin: origin || 'local', report: null };
    rec.parent = def._parent || (t.versions.length ? t.versions[t.versions.length - 1].parent || null : null); /* lineage survives local edits of a fork */
    rec.sha = sha256(JSON.stringify({ manifest, code: rec.code, tests: rec.tests })); t.versions.push(rec); t.versions = t.versions.slice(-20); t.history.push({ at: now(), event: 'saved v' + v }); save(l); return { ok: true, name: t.name, v, sha: rec.sha }; }
  async function test(name, v) { const l = all(); const t = l.find(x => x.name === name); const r = vrec(t, v || (t && t.versions[t.versions.length - 1].v)); if (!r) return { ok: false, rule: 'TOOL-NO-VERSION' };
    const results = []; for (const c of r.tests) { const o = await run(r.code, c.input); results.push({ input: c.input, expect: c.expect, got: o.ok ? o.value : null, error: o.ok ? null : o.error, pass: o.ok && same(o.value, c.expect) }); }
    r.report = { sha: r.sha, at: now(), passed: results.filter(x => x.pass).length, total: results.length, results }; save(l); return { ok: r.report.passed === r.report.total, report: r.report }; }
  function enable(name, v, o) { o = o || {}; const d = perm.authorize('tool.enable', { userTap: !!o.userTap, subject: name }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const l = all(); const t = l.find(x => x.name === name); const r = vrec(t, v); if (!r) return { ok: false, rule: 'TOOL-NO-VERSION' };
    if (!r.report || r.report.sha !== r.sha || r.report.passed !== r.report.total) return { ok: false, rule: 'TOOL-TESTS-NOT-PASSED' };
    if (t.active && t.active !== v) t.prev = t.active; t.active = v; t.enabled = true; t.failures = 0; t.disabled_reason = null; t.history.push({ at: now(), event: 'enabled v' + v }); save(l); return { ok: true, active: v }; }
  function rollback(name) { const l = all(); const t = l.find(x => x.name === name); if (!t) return { ok: false, rule: 'TOOL-UNKNOWN' };
    const cands = t.versions.filter(r => r.v < (t.active || Infinity) && r.report && r.report.sha === r.sha && r.report.passed === r.report.total); const back = cands[cands.length - 1]; if (!back) return { ok: false, rule: 'TOOL-NO-PREVIOUS-GOOD-VERSION' };
    t.active = back.v; t.enabled = true; t.failures = 0; t.disabled_reason = null; t.history.push({ at: now(), event: 'rolled back to v' + back.v }); save(l); return { ok: true, active: back.v }; }
  function disable(name, reason) { const l = all(); const t = l.find(x => x.name === name); if (!t) return { ok: false, rule: 'TOOL-UNKNOWN' }; t.enabled = false; t.disabled_reason = reason || 'user'; t.history.push({ at: now(), event: 'disabled: ' + t.disabled_reason }); save(l); return { ok: true }; }
  function remove(name) { save(all().filter(t => t.name !== name)); return { ok: true }; }
  async function invoke(name, input) { const t = get(name); if (!t) return { ok: false, rule: 'TOOL-UNKNOWN' }; if (!t.enabled || !t.active) return { ok: false, rule: 'TOOL-NOT-ENABLED' };
    const r = vrec(t, t.active); const o = await run(r.code, String(input).slice(0, 20000)); const l = all(); const tt = l.find(x => x.name === name);
    if (!o.ok) { tt.failures = (tt.failures || 0) + 1; if (tt.failures >= FAIL_LIMIT) { tt.enabled = false; tt.disabled_reason = 'TOOL-AUTO-DISABLED after ' + FAIL_LIMIT + ' failures'; tt.history.push({ at: now(), event: tt.disabled_reason }); } save(l); return { ok: false, rule: o.error, auto_disabled: !tt.enabled }; }
    tt.failures = 0; save(l); if (deps.economy) deps.economy.use('user.' + name + '@' + (r.parent ? r.parent.id : 'v' + t.active), r.parent ? r.parent.creator : (signer.id() || 'local'), 'use');
    return { ok: true, value: o.value, version: t.active, steps: o.steps, creator: r.parent ? r.parent.creator : 'you' }; }
  function packageBody(name, v) { const t = get(name); const r = vrec(t, v || (t && t.active) || (t && t.versions.length && t.versions[t.versions.length - 1].v)); if (!r) return null;
    const lineage = r.parent ? [{ parent: r.parent.id, creator: r.parent.creator }].concat(r.parent.lineage || []).slice(0, 20) : [];
    return { schema: 'emn-tool-package/v1', kind: 'tool_package', lineage, tool: { name: t.name, version: r.v, manifest: r.manifest, code: r.code, tests: r.tests, sha: r.sha }, source: { kind: 'tool_builder' }, created: now(), authority: 'evidence_only' }; }
  async function exportPackage(name, v) { const b = packageBody(name, v); if (!b) return { ok: false, rule: 'TOOL-UNKNOWN' }; const k = await signer.ensure(); if (!k) return { ok: false, rule: 'TOOL-VAULT-LOCKED' };
    const body = Object.assign({}, b, { source: Object.assign({}, b.source, { signer: k.signer, pub: k.pub }) }); const s = await signer.sign(body); return { ok: true, package: Object.assign({ id: 'emn:' + sha256(SH.canon(body)), sig: s.sig }, body) }; }
  async function publish(name, o) { o = o || {}; const d = perm.authorize('shared.contribute', { userTap: !!o.userTap, subject: name }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const t = get(name); if (!t || !t.enabled) return { ok: false, rule: 'TOOL-PUBLISH-NEEDS-ENABLED-TESTED' }; const r = await shared.publish(packageBody(name, t.active)); if (r.ok) ledger.append('tool_publish', r.manifest.id); return r; }
  function review(pkg) { const tt = pkg && pkg.tool; return tt ? { name: tt.name, version: tt.version, effect: tt.manifest && tt.manifest.effect, grants: (tt.manifest && tt.manifest.grants) || [], tests: (tt.tests || []).length, signer: pkg.source && pkg.source.signer, language: 'ForgeScript (no I/O)' } : null; }
  async function importPackage(pkg, o) { o = o || {}; const err = await SH.check(pkg); if (err) return { ok: false, rule: err }; if (pkg.kind !== 'tool_package') return { ok: false, rule: 'TOOL-NOT-A-PACKAGE' };
    const d = perm.authorize('tool.install', { userTap: !!o.userTap, subject: pkg.tool.name }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, review: review(pkg) };
    const tt = pkg.tool; const ex = get(tt.name); const name = ex && !(ex.versions.some(r => /^imported:/.test(r.origin) && r.origin.endsWith(pkg.source.signer))) && ex.versions.some(r => r.origin === 'local') ? tt.name + '-' + pkg.source.signer.slice(4, 8) : tt.name;
    const s = saveVersion({ name, description: tt.manifest.description, inputs: tt.manifest.inputs, outputs: tt.manifest.outputs, grants: tt.manifest.grants, code: tt.code, tests: tt.tests, _parent: { id: pkg.id, creator: pkg.source.signer, lineage: pkg.lineage || [] } }, 'imported:' + pkg.source.signer); if (!s.ok) return s;
    return { ok: true, name, v: s.v, enabled: false, review: review(pkg), next: 'run the tests, then enable' }; }
  async function installFromShared(id, o) { const inbox = store.load('shared_inbox'); const e = inbox.find(x => x.manifest.id === id && x.status === 'quarantined' && x.manifest.kind === 'tool_package'); if (!e) return { ok: false, rule: 'TOOL-NOT-IN-QUARANTINE' };
    const r = await importPackage(e.manifest, o); if (r.ok) { e.status = 'installed_disabled'; e.reviewed = now(); store.save('shared_inbox', inbox); } return r; }
  return { saveVersion, test, enable, rollback, disable, remove, invoke, exportPackage, importPackage, installFromShared, publish, review, list: all, get, FAIL_LIMIT }; }
const api = { Builder, workerRunner, localRunner, NAME, TIMEOUT_MS };
if (isNode) module.exports = api; else root.KToolBuilder = api;
})(typeof self !== 'undefined' ? self : this);
