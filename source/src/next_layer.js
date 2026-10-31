/* Next-layer switches. Both stay in the shell. economy defaults off; dream_idle is on since 4.9.208 (the curators).
 * dream_idle explores novel ideas from cold storage.
 * economy credits each KB contributor so a false entry can be traced to whoever added it.
 * Neither switch is the Ask reply. Money stays disabled. */
(function (root) {
'use strict';
const SWITCHES = { dream_idle: true, economy: false }; /* 4.9.208: dream_idle on (Nic decision (f)): Athena and Gilligan curate */
function enabled(name) { return SWITCHES[name] !== false; }
function set(name, on) { if (Object.prototype.hasOwnProperty.call(SWITCHES, name)) SWITCHES[name] = on !== false; return enabled(name); }
const ABOUT = {
  dream_idle: 'On since 4.9.208: Athena and Gilligan curate questions Ask held (app_curators.js). Toggle on the Custody tab.',
  economy: 'Next layer. Credits each KB contributor so a false entry traces to whoever added it. Count only, not money.'
};
const api = { SWITCHES, enabled, set, ABOUT, next_layer: true };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KNextLayer = api;
})(typeof self !== 'undefined' ? self : this);
