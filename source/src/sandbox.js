/* Imagination stays inside the sandbox. An atom made here carries a taint.
 * The write barrier refuses that atom at memory, at an admitted fact, and at a mechanism.
 * A question may leave later. The atom does not. No model. */
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const TAINT = 'sandbox';
  const SEALED = ['memory', 'gks_facts', 'admitted_rules', 'admitted_manifests', 'admitted_manifests_k', 'admitted_meta'];
  function sealedCat(cat) {
    const leaf = String(cat || '').split(':').pop();
    return SEALED.indexOf(leaf) >= 0;
  }
  function carries(value, seen) {
    if (value == null || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    if (value.taint === TAINT) return true;
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) if (carries(value[i], seen)) return true;
      return false;
    }
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) if (carries(value[keys[i]], seen)) return true;
    return false;
  }
  function blocked(value) {
    return carries(value, new Set()) ? { ok: false, rule: 'SANDBOX-WRITE-BARRIER', wrote: false, fact: false, may_store_as_fact: false } : null;
  }
  function tag(value) {
    if (value == null || typeof value !== 'object') return { taint: TAINT, value: value, fact: false, may_store_as_fact: false, publisher: false, status: 'hypothesis' };
    if (Array.isArray(value)) return value.map(tag);
    return Object.assign({}, value, { taint: TAINT, fact: false, may_store_as_fact: false, publisher: false, status: value.status || 'hypothesis' });
  }
  function open() {
    const kept = [];
    function atom(body) {
      const row = tag(Object.assign({ kind: 'sandbox_atom' }, body || {}));
      kept.push(row);
      return row;
    }
    return { taint: TAINT, fact: false, may_store_as_fact: false, atom: atom, tag: tag, atoms: () => kept.slice() };
  }
  const api = { TAINT: TAINT, SEALED: SEALED.slice(), sealedCat: sealedCat, carries: value => carries(value, new Set()), blocked: blocked, tag: tag, open: open };
  if (isNode) module.exports = api; else root.KSandbox = api;
})(typeof self !== 'undefined' ? self : this);
