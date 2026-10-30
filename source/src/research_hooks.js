/* Named research hooks. One config.
 * Nic approved these values on 2026-10-30.
 * Resonant Symbolic Operator Calculus Google Doc, Dec 2025.
 * Genesis Node spec gnspec l.6743-6820, l.7510.
 * Geometry, the SPC charge, and the RMC renderer read this object. */
(function (root) {
  const CITE = 'Resonant Symbolic Operator Calculus Google Doc, Dec 2025. Genesis Node spec gnspec l.6743-6820, l.7510.';
  const RESEARCH_HOOKS = {
    mu_min: 0.1,
    mu_max: 10,
    mu_birth: 1.0,
    half_life_hours: 168,
    identity_half_life_hours: 720,
    access_step: 0.05,
    access_cap: 1.0,
    access_bonus_per: 0.01,
    access_bonus_cap: 0.2,
    active_above: 0.1,
    merge_mu_bonus: 0.12,
    sever_mu_loss: 0.08,
    amplify_decay: 2.2,
    amplify_k_min: 1,
    amplify_k_max: 2,
    discharge_eps_factor: 0.3,
    discharge_echo_decay: 1.8,
    phase8_mu: 0,
    eta: 0.003,
    drift_loss: 'amplify',
    cite: CITE
  };

  function spcLambda(halfHours) {
    const half = (halfHours === undefined || halfHours === null || halfHours === '')
      ? RESEARCH_HOOKS.half_life_hours
      : Number(halfHours);
    return Math.LN2 / half;
  }

  function memoryTerm(integral, tHours, identity) {
    const half = identity ? RESEARCH_HOOKS.identity_half_life_hours : RESEARCH_HOOKS.half_life_hours;
    const lambda = Math.LN2 / half;
    const has = !(integral === undefined || integral === null || integral === '')
      && !(tHours === undefined || tHours === null || tHours === '');
    return {
      formula: 'M = exp(-lambda t) * integral A.C dt',
      lambda: lambda,
      half_life_hours: half,
      integral: has ? Number(integral) : null,
      t_hours: has ? Number(tHours) : null,
      value: has ? Math.exp(-lambda * Number(tHours)) * Number(integral) : null,
      mu_min: RESEARCH_HOOKS.mu_min,
      mu_max: RESEARCH_HOOKS.mu_max,
      mu_birth: RESEARCH_HOOKS.mu_birth,
      cite: CITE
    };
  }

  function memoryTermM() {
    return RESEARCH_HOOKS.mu_birth;
  }

  function chargeDecay(c0, tHours, identity) {
    const half = identity ? RESEARCH_HOOKS.identity_half_life_hours : RESEARCH_HOOKS.half_life_hours;
    return Number(c0) * Math.exp(-spcLambda(half) * Number(tHours));
  }

  function accessReport(count) {
    const n = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
    const Gen = (typeof module !== 'undefined' && module.exports) ? require('./genesis_collapse.js') : root.GenesisCollapse;
    const step = Gen.spcAccess(0);
    const bonus = Math.min(step.cap, step.step * n);
    const lift = Math.min(RESEARCH_HOOKS.access_cap, RESEARCH_HOOKS.access_step * n);
    return {
      count: n,
      lift: lift,
      bonus: bonus,
      active_above: RESEARCH_HOOKS.active_above,
      active: Gen.spcActive(lift),
      cite: CITE
    };
  }

  const api = {
    CITE: CITE,
    RESEARCH_HOOKS: RESEARCH_HOOKS,
    memoryTermM: memoryTermM,
    memoryTerm: memoryTerm,
    spcLambda: spcLambda,
    chargeDecay: chargeDecay,
    accessReport: accessReport
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ResearchHooks = api;
})(typeof self !== 'undefined' ? self : this);
