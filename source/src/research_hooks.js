/* Named research hooks. One config.
 * M is the memory term. spc_lambda is the SPC decay step.
 * Both stay unparameterized. Values are pending research.
 * Set them here. Geometry and the RMC renderer read this object. */
(function (root) {
  const RESEARCH_HOOKS = {
    M: null,
    spc_lambda: null
  };

  function memoryTermM() {
    return RESEARCH_HOOKS.M;
  }

  function spcLambda() {
    const value = RESEARCH_HOOKS.spc_lambda;
    return value === undefined ? null : value;
  }

  const api = {
    RESEARCH_HOOKS: RESEARCH_HOOKS,
    memoryTermM: memoryTermM,
    spcLambda: spcLambda
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ResearchHooks = api;
})(typeof self !== 'undefined' ? self : this);
