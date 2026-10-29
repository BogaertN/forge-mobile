/* Next-layer switches. Both stay in the shell. Default off.
 * dream_idle explores novel ideas from cold storage.
 * economy credits each KB contributor so a false entry can be traced to whoever added it.
 * Neither switch is the Ask reply. Money stays disabled. */
(function (root) {
'use strict';
const SWITCHES = { dream_idle: false, economy: false };
function enabled(name) { return SWITCHES[name] !== false; }
function set(name, on) { if (Object.prototype.hasOwnProperty.call(SWITCHES, name)) SWITCHES[name] = on !== false; return enabled(name); }
const ABOUT = {
  dream_idle: 'Next layer. Explores novel ideas from cold storage. Not removed.',
  economy: 'Next layer. Credits each KB contributor so a false entry traces to whoever added it. Count only, not money.'
};
const api = { SWITCHES, enabled, set, ABOUT, next_layer: true };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KNextLayer = api;
})(typeof self !== 'undefined' ? self : this);
