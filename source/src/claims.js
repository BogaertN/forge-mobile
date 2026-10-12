/* claims.js — claim guard (Register A-10) over the machine-readable feature registry (B-10).
 * A feature may be shown as Implemented or Partial only if every proof suite linked to it ran and passed in the
 * verification run that produced this build; otherwise the UI shows it as unproven. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const CLAIMABLE = new Set(['Implemented', 'Partial']);
  function Guard(data) {
    data = data || { features: [], suites: {} }; const byId = {}; for (const f of data.features || []) byId[f.id] = f;
    function claim(id) {
      const f = byId[id]; if (!f) return { id, status: 'Unknown', proven: false, proofs: [], reason: 'not in registry' };
      const proofs = (f.proof || []).map(s => { const r = (data.suites || {})[s]; return { suite: s, pass: r ? r.pass : 0, total: r ? r.total : 0 }; });
      const proven = proofs.length > 0 && proofs.every(p => p.total > 0 && p.pass === p.total);
      const status = CLAIMABLE.has(f.claim) ? (proven ? f.claim : 'Unproven') : f.claim;
      return { id, name: f.name, claimed: f.claim, status, proven, proofs, wave: f.wave, note: f.note };
    }
    const all = () => (data.features || []).map(f => claim(f.id));
    const totals = () => all().reduce((a, c) => { a[c.status] = (a[c.status] || 0) + 1; return a; }, {});
    return { claim, all, totals, version: data.version, generated: data.generated };
  }
  const api = { Guard, CLAIMABLE };
  if (isNode) module.exports = api; else root.KClaims = api;
})(this);
