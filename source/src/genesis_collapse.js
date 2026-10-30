/* χ collapse from the Genesis Node spec, pages 116 and 143–145.
 * Phase names in that spec are not canonical. Canonical names are the
 * Phase Glyph Codex v2.5 set in kmath.js. */
(function (root) {
  const CITE = 'Genesis Node spec pp.116, 143-145. Those phase names are not canonical.';
  const HALF_LIFE_HOURS = 168;
  const LAMBDA = Math.LN2 / HALF_LIFE_HOURS;
  function chiCollapse(state) {
    const row = state || {};
    const drift = Number.isFinite(Number(row.drift)) ? Number(row.drift) : (Number.isFinite(Number(row.eps)) ? Number(row.eps) : 0);
    const entropy = Number.isFinite(Number(row.entropy)) ? Number(row.entropy) : 0;
    return {
      Phi: 1, phase_name: 'Initiation', drift_before: drift,
      drift_residue: drift * 0.22, drift_cleared: drift * 0.78,
      spc_override_residue: { fraction: 0.22, charge: 0.8 },
      entropy: entropy * 0.3, consecutive_drift: 0, writes: false, cite: CITE
    };
  }
  function spcCharge(c0, tHours, identity) {
    const H = (typeof module !== 'undefined' && module.exports) ? require('./research_hooks.js') : root.ResearchHooks;
    return H.chargeDecay(c0, tHours, !!identity);
  }
  function spcAccess(accessTotal) {
    const total = Number.isFinite(Number(accessTotal)) ? Number(accessTotal) : 0;
    return { added: Math.round(Math.min(0.2, total + 0.01) * 1e6) / 1e6, step: 0.01, cap: 0.2 };
  }
  function spcActive(charge) { return Number(charge) > 0.1; }
  function spcGc(charge) { return Number(charge) < 0.05; }
  const api = { chiCollapse, spcCharge, spcAccess, spcActive, spcGc, HALF_LIFE_HOURS, CITE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GenesisCollapse = api;
})(typeof self !== 'undefined' ? self : this);
