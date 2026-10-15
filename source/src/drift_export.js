/* drift_export.js — Hermes Recursive Memory Wrapper: exportable drift-detection toolkit package (schema hermes-drift-toolkit/v1).
 * Contents: drift archive (dead paths), collapse events, ghost-loop counts, the gate thresholds in force (app Addendum bands) side by side with
 * forge coherence_math values (N1), and a checksummed file list. Redacted records only; never vault content. Produced on explicit request. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports; const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));
const THRESHOLDS = { app_addendum: { coherence_warning: 0.50, coherence_collapse: 0.78, echo_min: 0.80, source: 'RMC Implementation Addendum (in force, N1 default)' }, forge_coherence_math: { epsilon_warning: 0.35, epsilon_collapse: 0.72, echo_min: 0.72, source: 'BogaertN/forge rmc_engine_v1/coherence_math.py gate_thresholds()' } };
function build(store, opts) { opts = opts || {}; const at = opts.clock ? opts.clock() : new Date().toISOString();
  const drift = store.load('drift_archive'), coll = store.load('collapse_events'), ghosts = (Array.isArray(store.load('hypotheses')) ? store.load('hypotheses') : []).filter(h => h.route === 'ghost_loop_containment_required'), loops = store.load('loops');
  const eps = drift.map(d => (typeof d.eps_s === 'number' ? d.eps_s : null)).filter(x => x != null);
  const files = { 'drift_archive.json': drift, 'collapse_events.json': coll, 'thresholds.json': THRESHOLDS,
    'metrics.json': { dead_paths: drift.length, collapse_events: coll.length, ghost_loops: ghosts.length, loops_total: loops.length, loops_by_state: loops.reduce((a, l) => { a[l.state] = (a[l.state] || 0) + 1; return a; }, {}), epsilon_mean: eps.length ? +(eps.reduce((a, b) => a + b, 0) / eps.length).toFixed(6) : null } };
  return pack('hermes-drift-toolkit/v1', files, at); }
function pack(schema, files, at) { const manifest = { schema, generated: at || new Date().toISOString(), producer: 'forge-mobile', no_model: true, files: Object.keys(files).sort().map(n => ({ name: n, sha256: sha256(canon(files[n])) })) }; manifest.package_sha256 = sha256(canon(manifest.files)); return { manifest, files }; }
function verify(pkg) { if (!pkg || !pkg.manifest || !/^(hermes-drift-toolkit|forge-evidence-bundle)\/v1$/.test(pkg.manifest.schema)) return false; if (Object.keys(pkg.files).length !== pkg.manifest.files.length) return false; for (const f of pkg.manifest.files) if (sha256(canon(pkg.files[f.name])) !== f.sha256) return false; return sha256(canon(pkg.manifest.files)) === pkg.manifest.package_sha256; }
const api = { build, pack, verify, THRESHOLDS, canon };
if (isNode) module.exports = api; else root.KDrift = api;
})(typeof self !== 'undefined' ? self : this);
