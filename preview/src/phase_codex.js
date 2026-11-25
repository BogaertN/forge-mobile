/* FBSC Phase Glyph Codex v2.5 loader.
 * Source file: engine/rmc_engine_v1/reference/phase_codex_v2_5.json
 * Authority: Google Doc "FBSC Phase Glyph Codex v2.5"
 * Drive id 1xZWOfEFgYMn10XQtUOyQOQCCIaOwqfTEIcM-bgRHkjk
 * Read-only. No LLM. No memory write. */
(function (root) {
  const CODEX_URL = 'engine/rmc_engine_v1/reference/phase_codex_v2_5.json';
  const FLAGS_URL = 'engine/rmc_engine_v1/reference/phase_drift_flags_v2_5.json';
  const REQUIRED = ['Φ1', 'Φ2', 'Φ3', 'Φ4', 'Φ5', 'Φ6', 'Φ7', 'Φ8', 'Φ9'];
  const FIELDS = ['phase_id', 'index', 'phase_name', 'code_identifier', 'glyph', 'unicode_fallback', 'symbolic_function', 'color_name', 'hex', 'motion_behavior', 'drift_behavior', 'cold_storage_form', 'function_hook', 'state_signature', 'neuromorphic_hook', 'gate_role'];
  let codex = null;
  let flags = null;

  function readText(rel) {
    if (typeof require === 'function') {
      try {
        const fs = require('fs');
        const path = require('path');
        const file = path.join(__dirname, '..', rel);
        return fs.readFileSync(file, 'utf8');
      } catch (e) { /* browser or missing path */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', rel, false);
        xhr.send(null);
        if (xhr.status === 200 || xhr.status === 0) return xhr.responseText;
      } catch (e) { /* offline page */ }
    }
    return null;
  }

  function load() {
    if (codex) return codex;
    const raw = readText(CODEX_URL);
    if (!raw) return {};
    const data = JSON.parse(raw);
    codex = data && typeof data === 'object' ? data : {};
    const flagRaw = readText(FLAGS_URL);
    flags = flagRaw ? JSON.parse(flagRaw) : {};
    return codex;
  }

  function profiles() {
    const data = load();
    const phases = data.phases;
    return phases && typeof phases === 'object' ? phases : {};
  }

  function profile(id) {
    const row = profiles()[String(id)] || {};
    return Object.assign({}, row);
  }

  function driftFlag(id) {
    load();
    if (!flags || !Object.prototype.hasOwnProperty.call(flags, id)) return 'unspecified';
    return flags[id];
  }

  function validate() {
    const data = load();
    const phases = profiles();
    const missing = REQUIRED.filter(p => !phases[p]);
    const fieldFailures = [];
    REQUIRED.forEach(p => {
      const row = phases[p] || {};
      FIELDS.forEach(field => {
        if (row[field] === undefined || row[field] === null || row[field] === '') fieldFailures.push(p + ':' + field);
      });
    });
    return {
      status: !missing.length && !fieldFailures.length ? 'OK' : 'INVALID',
      codex_id: data.codex_id || null,
      version: data.version || null,
      source_document: data.source_document || 'FBSC Phase Glyph Codex v2.5',
      drive_id: '1xZWOfEFgYMn10XQtUOyQOQCCIaOwqfTEIcM-bgRHkjk',
      phase_count: Object.keys(phases).length,
      missing_phases: missing,
      field_failures: fieldFailures,
      calls_llm: false,
      writes_files: false
    };
  }

  function boundary() {
    const validation = validate();
    return {
      engine: 'phase_codex.js',
      source: CODEX_URL,
      authority: 'FBSC Phase Glyph Codex v2.5',
      status: validation.status,
      phase_count: validation.phase_count,
      calls_llm: false,
      writes_memory: false
    };
  }

  const api = { load, profiles, profile, driftFlag, validate, boundary, CODEX_URL, REQUIRED };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PhaseCodex = api;
})(typeof self !== 'undefined' ? self : this);
