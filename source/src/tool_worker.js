/* tool_worker.js — runs ONE user tool in isolation. Network, storage and nested workers are removed before user code is touched; ForgeScript
 * itself has no access to globals either. The page terminates this worker on timeout (crash isolation). */
'use strict';
importScripts('fscript.js');
for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'indexedDB', 'caches', 'importScripts', 'Worker', 'BroadcastChannel']) { try { self[k] = undefined; } catch (e) { /* non-writable: unreachable from ForgeScript anyway */ } }
self.onmessage = e => { const { code, input, id } = e.data || {}; try { const r = self.KFScript.run(code, input); self.postMessage({ id, ok: true, value: r.value, steps: r.steps }); } catch (err) { self.postMessage({ id, ok: false, error: String(err && err.message || err).slice(0, 120) }); } };
