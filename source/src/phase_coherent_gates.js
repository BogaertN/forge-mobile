/* Seven-gate cold-storage resurrection.
 * Phase-Coherent Memory Architecture.
 * dream_idle stays off. This function does not write. */
(function (root) {
  const CITE = 'Phase-Coherent Memory Architecture, seven-gate resurrection. dream_idle stays off.';
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
  function phaseCoherentResurrection(record) {
    const row = record || {};
    let phase = num(row.phase);
    if (phase === null && typeof row.phase_at === 'string' && row.phase_at.slice(-1) === '9') phase = 9;
    const noise = num(row.noise_floor);
    const chi = num(row.chi_threshold);
    const threshold = chi === null ? 0.4 : chi;
    const identity = row.identity;
    const expected = row.identity_expected;
    const identityOk = identity !== undefined && identity !== null && identity !== '' && (expected === undefined || expected === null || expected === '' || identity === expected);
    const log = row.resurrection_log;
    const logOk = row.resurrection_log_valid === true || (log && log.valid === true);
    const cycle = num(row.cycle_count);
    const limit = num(row.resurrection_limit);
    let capacity = row.capacity_ok;
    if (capacity === undefined || capacity === null) {
      const have = num(row.capacity), need = num(row.capacity_required);
      capacity = have !== null && need !== null && have >= need;
    }
    const gates = [
      { n: 1, id: 'phase_timing_phi9', pass: phase === 9, detail: 'phase timing at Φ9' },
      { n: 2, id: 'noise_floor_below_chi', pass: noise !== null && noise < threshold, detail: 'noise floor below the χ threshold' },
      { n: 3, id: 'not_under_active_drift', pass: row.active_drift !== true, detail: 'not under active drift' },
      { n: 4, id: 'identity', pass: identityOk, detail: 'identity present' },
      { n: 5, id: 'resurrection_log_valid', pass: logOk, detail: 'resurrection_log validity' },
      { n: 6, id: 'cycle_count_below_limit', pass: cycle !== null && limit !== null && cycle < limit, detail: 'cycle_count < resurrection_limit' },
      { n: 7, id: 'capacity', pass: capacity === true, detail: 'capacity' }
    ];
    return { ok: gates.every(g => g.pass), gates, writes: false, dream_idle: false, calls_llm: false, cite: CITE };
  }
  const api = { phaseCoherentResurrection, CITE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhaseCoherentGates = api;
})(typeof self !== 'undefined' ? self : this);
