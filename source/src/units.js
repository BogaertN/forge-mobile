/* Bare mass copulas use the phone's unit table (src/algebra.js). A name is mass only when that
 * table already files it under mass. Centimetres stay length, so "180 cm" is not a height. */
(function (root) {
  function table() {
    const alg = typeof require === 'function' ? require('./algebra.js') : root.KAlgebra;
    return alg && alg.U ? alg.U : {};
  }
  function isMass(w) { const row = table()[String(w || '').toLowerCase()]; return !!(row && row.dim === 'mass'); }
  function massNames() { const U = table(); return Object.keys(U).filter(n => U[n] && U[n].dim === 'mass'); }
  const api = { isMass: isMass, massNames: massNames };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KUnits = api;
})(typeof self !== 'undefined' ? self : this);
