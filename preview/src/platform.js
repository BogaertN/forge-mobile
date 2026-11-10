/* platform.js — supported-platform contract (Register K-12). The app declares what it needs; check() reports what this browser has.
 * Required = the app refuses to claim the feature without it; optional = the feature is shown as unavailable, never faked. */
(function (root) {
'use strict';
const CONTRACT = { version: 1, supported: ['Chrome/Chromium ≥ 111 on Android', 'Chrome/Edge ≥ 111 desktop', 'Samsung Internet ≥ 22', 'Safari/iOS ≥ 16.4 (no Share Target, no BarcodeDetector)', 'Firefox ≥ 113 (no install prompt)'],
  required: { 'localStorage': g => !!g.localStorage, 'WebCrypto subtle (vault)': g => !!(g.crypto && g.crypto.subtle), 'TextEncoder': g => typeof g.TextEncoder === 'function', 'DecompressionStream (lexicon)': g => typeof g.DecompressionStream === 'function', 'fetch': g => typeof g.fetch === 'function' },
  optional: { 'Service worker (offline)': g => !!(g.navigator && g.navigator.serviceWorker), 'Web Worker (Python cross-check)': g => typeof g.Worker === 'function', 'WebAssembly (Python cross-check)': g => typeof g.WebAssembly === 'object', 'WebAudio (hear trace)': g => typeof (g.AudioContext || g.webkitAudioContext) === 'function', 'Canvas 2D (previews)': g => !!(g.document && g.document.createElement && g.document.createElement('canvas').getContext), 'BarcodeDetector (QR pairing)': g => 'BarcodeDetector' in g, 'Share Target (Android install)': g => !!(g.matchMedia && g.matchMedia('(display-mode: standalone)').matches) } };
function check(g) { g = g || root; const run = o => Object.fromEntries(Object.entries(o).map(([k, f]) => { let v = false; try { v = !!f(g); } catch (e) { v = false; } return [k, v]; }));
  const req = run(CONTRACT.required), opt = run(CONTRACT.optional); return { contract: CONTRACT.version, supported: CONTRACT.supported, required: req, optional: opt, ok: Object.values(req).every(Boolean) }; }
const api = { CONTRACT, check };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KPlatform = api;
})(typeof self !== 'undefined' ? self : this);
