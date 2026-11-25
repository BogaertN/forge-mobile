/* doctor.js — Build Doctor + health checks + recovery runbook (Capability Register I-11/K-14) and temporal resonance diagnostics (E-10):
 * a plain DFT over the per-turn drift ε_s and phase Φ series (no FFT library; n ≤ 64). Scope: CHECKS PLUS FIX INSTRUCTIONS, not auto repair.
 * The doctor never repairs anything itself; each failing check names the runbook step the user can take. Any future auto-fix must have a
 * preview, explicit approval, a backup, a receipt, a read-back and a rollback before it may exist. */
(function (root) {
'use strict';
const RUNBOOK = { schema: 'reload the app; the migration runner re-applies ordered, idempotent migrations', ledger: 'export a support bundle, then restore the last good portable backup (Tool Bench tab → Backup & Recovery)', receipts: 'export a support bundle; request receipts are append-only and a broken link means tampering or storage loss',
  storage: 'export notes and a portable backup (Tool Bench tab → Backup & Recovery), then forget old research captures', tools: 'open Tool Builder, run the tool tests, roll back or re-enable', quarantine: 'review or reject items waiting in the shared-layer quarantine', reminders: 'open the app more often or install it so the browser can wake it', drift: 'rephrase recent requests; sustained high drift means the kernel is guessing less well' };
function dft(xs) { const n = xs.length; if (n < 8) return null; const mu = xs.reduce((a, b) => a + b, 0) / n; const x = xs.map(v => v - mu); let best = { k: 0, power: 0 }; let total = 0;
  for (let k = 1; k <= Math.floor(n / 2); k++) { let re = 0, im = 0; for (let t = 0; t < n; t++) { re += x[t] * Math.cos(2 * Math.PI * k * t / n); im -= x[t] * Math.sin(2 * Math.PI * k * t / n); } const p = (re * re + im * im) / n; total += p; if (p > best.power) best = { k, power: p }; }
  return { n, dominant_period_turns: best.k ? +(n / best.k).toFixed(2) : null, power_share: total ? +(best.power / total).toFixed(4) : 0, mean: +mu.toFixed(4) }; }
function temporal(traces) { const t = traces.slice(-64); const eps = t.map(x => (x.drift && +x.drift.eps_s) || 0), phi = t.map(x => (x.sfe && +x.sfe.Phi) || 9);
  return { method: 'discrete Fourier transform over the last ' + t.length + ' turns (Capability Register E-10)', drift: dft(eps), phase: dft(phi), note: t.length < 8 ? 'needs at least 8 turns' : 'a strong periodic share (> 0.5) means drift recurs on a rhythm; inspect those turns' }; }
function run(f, env) { env = env || {}; const st = f.store; const checks = []; const add = (id, ok, detail) => checks.push({ id, ok: !!ok, detail, runbook: ok ? null : RUNBOOK[id] });
  const mg = st.load('migrations'); const sv = mg && !Array.isArray(mg) ? mg.schema : 0; add('schema', sv >= (env.schema || 1), 'store schema v' + sv + (env.schema ? ' (target v' + env.schema + ')' : ''));
  const lv = f.ledger ? f.ledger.verify() : { ok: true, n: 0 }; add('ledger', lv.ok, 'attribution chain ' + (lv.n || 0) + ' entries');
  const rv = f.requests && f.requests.verify ? f.requests.verify() : { ok: true }; add('receipts', rv.ok !== false, 'request receipts ' + (rv.ok !== false ? 'chain intact' : 'broken at ' + rv.at));
  let bytes = 0; try { bytes = (st.categories || []).reduce((a, c) => a + JSON.stringify(st.load(c)).length, 0); } catch (e) { bytes = -1; } add('storage', bytes < 4.5e6, (bytes >= 0 ? Math.round(bytes / 1024) + ' KB used' : 'unknown') + ' (local storage budget ≈ 5 MB)');
  const tl = f.tools ? f.tools.list() : []; const bad = tl.filter(t => /AUTO-DISABLED/.test(t.disabled_reason || '')); add('tools', !bad.length, tl.length + ' user tools' + (bad.length ? ', auto-disabled: ' + bad.map(t => t.name).join(', ') : ''));
  const q = f.shared ? f.shared.inbox().filter(x => x.status === 'quarantined').length : 0; add('quarantine', q < 50, q + ' shared items waiting for review');
  const now = Date.parse(env.now || new Date().toISOString()); const late = st.load('reminders').filter(r => r.state === 'pending' && Date.parse(r.due) < now - 36e5).length; add('reminders', !late, late + ' reminders overdue by more than an hour');
  const tm = temporal(st.load('trace')); add('drift', !(tm.drift && tm.drift.mean > 0.35), tm.drift ? 'mean ε_s ' + tm.drift.mean + ', dominant period ' + tm.drift.dominant_period_turns + ' turns' : tm.note);
  if (env.sw !== undefined) add('service_worker', env.sw, env.sw ? 'service worker active (offline ready)' : 'no service worker');
  return { ok: checks.every(c => c.ok), checks, temporal: tm, read_only: true, scope: 'checks plus fix instructions; no auto repair' }; }
const api = { run, dft, temporal, RUNBOOK };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KDoctor = api;
})(typeof self !== 'undefined' ? self : this);
