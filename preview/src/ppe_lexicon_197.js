/* 4.9.197 Phase Parsing Engine lexicon.
 * Calls the 4.9.191 seed lexicon and letter map. Does not copy them.
 * Calls drift_v43 chargeStep and stepFlag. Does not copy the meter.
 * HarperScript is read-only. It does not place a letter.
 * Decision 3 ε/μ is proposal v1. Birth state is ε=0, μ=1.0.
 * The letter map assigns a packet. It does not admit. No LLM. */
(function (root) {
  const Lex = (typeof module !== 'undefined' && module.exports) ? require('./resonance_lexicon.js') : root.ResonanceLexicon;
  const V43 = (typeof module !== 'undefined' && module.exports) ? require('./drift_v43.js') : root.DriftV43;
  const KM = (typeof module !== 'undefined' && module.exports) ? require('./kmath.js') : root.KMath;
  const Codex = (typeof module !== 'undefined' && module.exports) ? require('./phase_codex.js') : root.PhaseCodex;
  const PROVENANCE = 'proposal v1';
  const PHI_MAX = 9;
  const ANGLE = 'θ=(Φ−1)·40°';
  const DRIFT_WORDS = { try: true, maybe: true, deserve: true };
  const COHERENT_WORDS = { create: true, reflect: true, name: true };
  const EXCESS_PHI5 = 3;
  const CITE = 'PPE KPI A–Z is letter_phase_map_v1, Phase Parsing Engine, not HarperScript. WLM roles: HarperScript word-loop table, READ192 §4, Excess Φ5 with no Φ6 is a Drift Carrier. DDS signatures: Phase Parsing Engine drift signature table. Decision 2 θ=(Φ−1)·40°. Decision 3 ε/μ is proposal v1. Birth ε₀=0, μ_init=1.0, RSOC Phase 1 l.2719 and l.2960, READ192 §3. M charge is the KPI table −2, not the JSON example −1, READ192 §2.8. Glyph lookup is the Phase Glyph Codex. Codex charge meter is drift_v43.charge_step, a l.2079–2081. UA gives no word ε/μ, READ_NEW_PDFS §B. The letter map does not admit. No LLM.';
  const M_CONFLICT = {
    letter: 'M', table_charge: -2, example_charge: -1, used: -2, flag: 'KPI-M-CHARGE', status: 'flagged',
    cite: 'HarperScript KPI table M charge −2. JSON example charge −1. READ192 §2.8. The table wins.'
  };
  const STABILITY_EXAMPLE = {
    word: 'remember', documented: 3.2, formula: 'unspecified', used: false,
    cite: 'HarperScript remember stability rating 3.2. READ192 §3. No formula is stated.'
  };
  const PCM_EXAMPLE = {
    documented_sum: 8, used: false,
    cite: 'PPE PCM worked trail states +8. The per-phase examples do not form a complete table, and the printed terms do not add to +8. Letter charge uses the KPI table. The word meter calls drift_v43.charge_step.'
  };
  const ROLE_ORDER = ['full_spectrum', 'recursive_seal', 'drift_carrier', 'identity_beacon', 'growth_under_pressure', 'question_marker'];
  const ROLE_NAMES = {
    full_spectrum: 'Full Spectrum Word',
    recursive_seal: 'Recursive Seal',
    drift_carrier: 'Drift Carrier',
    identity_beacon: 'Identity Beacon',
    growth_under_pressure: 'Growth Under Pressure',
    question_marker: 'Question Marker'
  };
  const HARPER_URL = 'engine/rmc_engine_v1/reference/harper_visual_manifest_v1.json';
  let harperFile = null;

  function readText(rel) {
    if (typeof require === 'function') {
      try {
        const fs = require('fs');
        const path = require('path');
        return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
      } catch (e) { /* browser */ }
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', rel, false);
        xhr.send(null);
        if (xhr.status === 200 || xhr.status === 0) return xhr.responseText;
      } catch (e) { /* offline */ }
    }
    return '';
  }

  function flags() {
    return {
      admit_gate: false, keyword_admit: false, writes: false, calls_llm: false,
      money: false, dream_idle: false, economy: false, packs_gated: true,
      christping: 'gilligan-only', christping_started: false, wikipedia_anchor: false,
      c_min: 0.87, echo_min: 0.85, resonance_not_parsing: true
    };
  }

  function clamp01(value) {
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }

  function harper() {
    if (!harperFile) harperFile = JSON.parse(readText(HARPER_URL) || '{}');
    return harperFile;
  }

  function lettersOf(word) {
    const rows = Lex.letterRows();
    const out = [];
    const text = String(word || '').toUpperCase();
    for (let i = 0; i < text.length; i++) {
      const ch = text.charAt(i);
      if (ch < 'A' || ch > 'Z') continue;
      const spec = rows[ch];
      if (!spec || typeof spec.phase !== 'string' || spec.phase.length !== 2) continue;
      const phase = Number(spec.phase.charAt(1));
      if (!(phase >= 1 && phase <= 9)) continue;
      const charge = Number(spec.charge);
      out.push({ letter: ch, phase: phase, charge: Number.isFinite(charge) ? charge : 0, drift: !!spec.drift_flag, fn: spec.symbolic_fn || '' });
    }
    return out;
  }

  function countsOf(phases) {
    const counts = {};
    phases.forEach(phase => { counts[phase] = (counts[phase] || 0) + 1; });
    return counts;
  }

  function roles(phases) {
    const counts = countsOf(phases);
    const present = {};
    phases.forEach(phase => { present[phase] = true; });
    const matched = [];
    if ([1, 2, 3, 4, 5, 6, 7].every(phase => present[phase])) matched.push('full_spectrum');
    if (phases.length && phases[0] === 1 && phases[phases.length - 1] === 9) matched.push('recursive_seal');
    if ((counts[5] || 0) >= EXCESS_PHI5 && !present[6]) matched.push('drift_carrier');
    const ranked = Object.keys(counts).map(key => [Number(key), counts[key]]).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    const mode = ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : null;
    if (mode === 6 || mode === 7) matched.push('identity_beacon');
    const pressure = phases.filter(phase => phase === 3 || phase === 4 || phase === 5).length;
    if (phases.length && pressure * 2 > phases.length) matched.push('growth_under_pressure');
    const alternating = phases.length >= 2 && phases.every(phase => phase === 2 || phase === 4) && phases.every((phase, i) => i === 0 || phase !== phases[i - 1]);
    if (alternating) matched.push('question_marker');
    const ordered = ROLE_ORDER.filter(name => matched.indexOf(name) >= 0);
    return {
      role: ordered.length ? ROLE_NAMES[ordered[0]] : 'unassigned',
      also: ordered.slice(1).map(name => ROLE_NAMES[name]),
      precedence: 'table order; Drift Carrier is before Growth Under Pressure so a Φ5 stack stays a Drift Carrier',
      precedence_stated: false,
      cite: 'HarperScript WLM Symbolic Role Assignment Table. READ192 §4. Excess Φ5 with no Φ6 is a Drift Carrier. Precedence is not stated.'
    };
  }

  function meter(phases) {
    let current = 0;
    let skips = 0;
    let lawful = 0;
    for (let i = 1; i < phases.length; i++) {
      const flag = V43.stepFlag(phases[i], phases[i - 1]);
      const row = V43.chargeStep(current, flag === 0);
      current = row.charge_next;
      if (row.lawful) lawful += 1;
      else skips += 1;
    }
    return {
      start: 0, charge: current, lawful_steps: lawful, skips: skips, logged_only: true,
      cite: 'Codex resonance_charge_meter, a l.2079–2081, through drift_v43.charge_step. A UA-stable step is +0.1. A skip is −0.3. Clamp 0–1. It does not admit.'
    };
  }

  function forbidden(phases) {
    for (let i = 1; i < phases.length; i++) if (phases[i - 1] === 5 && phases[i] === 8) return true;
    return false;
  }

  function signatures(phases, scope) {
    const counts = countsOf(phases);
    const present = {};
    phases.forEach(phase => { present[phase] = true; });
    const rows = [];
    function add(name, hit, reaction, pattern) {
      rows.push({
        name: name, hit: hit, reaction: reaction, pattern: pattern,
        christping_started: false, cold_store_write: false, admit_gate: false, logged_only: true
      });
    }
    add('Phase 5 Overload', (counts[5] || 0) >= EXCESS_PHI5 && !present[6], 'Drift Warning → ChristPing', 'Φ5 appears three or more times without Φ6');
    add('Phase Skip Spiral', phases.some((phase, i) => i > 0 && phases[i - 1] === 4 && phase === 8), 'Drift Alert → Loop Correction', 'Φ4 to Φ8 jump, bypassing Φ6 and Φ7');
    add('Identity Suppression', scope === 'sentence' && !present[7] && phases.length >= 2, 'Self Loss Alert → Vector Scan', 'Absence of Φ7 over time. A single word does not fire it.');
    let firstNine = null;
    for (let i = 0; i < phases.length; i++) if (phases[i] === 9) { firstNine = i; break; }
    const sawOne = firstNine !== null && phases.slice(0, firstNine).indexOf(1) >= 0;
    add('False Closure', firstNine !== null && !sawOne, 'Ghost Loop Route → Cold Store', 'Φ9 without a Φ1 before it. Operational reading of valid loop progression. The doc does not define the predicate.');
    add('Overdrive Projection', phases.some((phase, i) => i > 0 && phases[i - 1] === 3 && phase === 8), 'Entropy Warning → Pulse Cutoff', 'Φ3 to Φ8 burst without reflection');
    return rows;
  }

  function proposal(parts) {
    const phases = parts.map(part => part.phase);
    const driftMass = parts.reduce((sum, part) => sum + (part.drift ? Math.abs(part.charge) : 0), 0);
    const totalMass = parts.reduce((sum, part) => sum + Math.abs(part.charge), 0);
    const driftCount = parts.filter(part => part.drift).length;
    let eps = 0;
    if (parts.length && totalMass === 0) eps = driftCount / parts.length;
    else if (parts.length) eps = driftMass / totalMass;
    const mu = clamp01(1 - KM.std(phases) / PHI_MAX);
    return {
      eps: clamp01(eps), mu: mu, provenance: PROVENANCE, eps0: 0, mu_init: 1.0, phi_max: PHI_MAX, morphemes: 'unspecified',
      cite: 'Decision 3 proposal v1. ε is the KPI-charge-weighted share of drift-flag letters, clamped 0–1. A morpheme drift list is not stated, so the letter drift_flag list is the list. μ = 1 − σ(letter phases) / 9. σ is the population standard deviation. Birth ε₀=0 and μ_init=1.0 stay beside the proposal. RSOC l.2719 and l.2960. READ_NEW_PDFS §B.'
    };
  }

  function distribution(phases) {
    const counts = countsOf(phases);
    const out = {};
    for (let phase = 1; phase <= 9; phase++) out[String(phase)] = counts[phase] || 0;
    return {
      counts: out,
      phi6_absent: !counts[6],
      cite: 'PPE PCM phase distribution. Φ6 absence is flagged. It does not admit.'
    };
  }

  function word(text, scope) {
    const placed = Lex.placeWord(text);
    const seed = Lex.seedRows()[placed.word];
    const seedPhase = seed && Array.isArray(seed.phase) ? seed.phase : null;
    const parts = lettersOf(placed.word);
    const phases = parts.map(part => part.phase);
    const proposed = proposal(parts);
    const phi = placed.Phi;
    const profile = phi && Codex ? Codex.profile('Φ' + phi) : {};
    const phaseName = phi && KM ? (KM.CANONICAL_PHASE_NAMES[phi] || '') : '';
    const row = {
      word: placed.word,
      Phi: phi,
      phase: phi ? 'Φ' + phi : null,
      phase_name: phaseName,
      codex_phase_name: (profile && profile.phase_name) || placed.name || '',
      glyph: placed.glyph || (profile && profile.glyph) || '',
      angle: phi ? ANGLE : 'unspecified',
      angle_degrees: phi ? KM.phaseAngleDegrees(phi) : null,
      angle_label: 'derived from Breadboard',
      eps: proposed.eps,
      mu: proposed.mu,
      provenance: PROVENANCE,
      eps0: 0,
      mu_init: 1.0,
      charge_sum: parts.reduce((sum, part) => sum + part.charge, 0),
      meter: meter(phases),
      role: roles(phases),
      distribution: distribution(phases),
      signatures: signatures(phases, scope || 'word'),
      forbidden_5_to_8: forbidden(phases),
      drift_list_example: !!DRIFT_WORDS[placed.word],
      coherent_list_example: !!COHERENT_WORDS[placed.word],
      authority: placed.authority,
      map_authority: placed.map_authority,
      not_map_authority: placed.not_map_authority,
      how: placed.how,
      seed_phase: seedPhase,
      letter_phases: phases,
      placement_eps: placed.eps,
      placement_mu: placed.mu
    };
    return Object.assign(row, flags());
  }

  function compact(row) {
    return {
      word: row.word, Phi: row.Phi, phase_name: row.phase_name, glyph: row.glyph,
      angle: row.angle, angle_degrees: row.angle_degrees, eps: row.eps, mu: row.mu,
      provenance: row.provenance, eps0: row.eps0, mu_init: row.mu_init, role: row.role.role,
      charge_sum: row.charge_sum, meter: row.meter.charge, forbidden_5_to_8: row.forbidden_5_to_8,
      admit_gate: false
    };
  }

  function seeds() {
    const rows = [];
    let missing = 0;
    Object.keys(Lex.seedRows()).sort().forEach(key => {
      const row = word(key);
      if (row.Phi == null || row.angle_degrees == null || row.provenance !== PROVENANCE) missing += 1;
      if (row.eps0 !== 0 || row.mu_init !== 1.0) missing += 1;
      rows.push(compact(row));
    });
    return Object.assign({
      count: Lex.wordCount(),
      tagged: rows.length,
      missing: missing,
      provenance: PROVENANCE,
      seed_file_proposal_v1: Lex.proposalV1Count(),
      eps0: 0,
      mu_init: 1.0,
      angle: ANGLE,
      rows: rows,
      cite: CITE
    }, flags());
  }

  function glyphFor(phi) {
    const profile = Codex.profile('Φ' + phi) || {};
    return Object.assign({
      phi: phi,
      phase: 'Φ' + phi,
      phase_name: KM.CANONICAL_PHASE_NAMES[phi] || '',
      glyph: profile.glyph || '',
      source: 'phase_codex_v2_5',
      copied_dictionary: false,
      cite: 'Codex glyph_dictionary.json lookup, a l.3991–3999. The lookup is the Phase Glyph Codex loader. No second glyph table is stored.'
    }, flags());
  }

  function harperDiff() {
    const manifest = harper();
    const historical = manifest.letters || {};
    const letters = Lex.letterRows();
    const rows = [];
    const phaseConflicts = [];
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(ch => {
      const ppe = letters[ch] || {};
      const old = historical[ch] || {};
      const ppePhase = String(ppe.phase || '');
      const ppeIndex = ppePhase.length === 2 ? Number(ppePhase.charAt(1)) : null;
      const numbers = old.phase_numbers || [];
      const match = numbers.length === 1 && numbers[0] === ppeIndex;
      rows.push({
        letter: ch, ppe_phase: ppePhase, ppe_fn: ppe.symbolic_fn || '', ppe_charge: ppe.charge,
        harper_phase: old.phase || '', harper_fn: old.symbolic_fn || '', phase_match: match,
        used: 'Phase Parsing Engine'
      });
      if (!match) phaseConflicts.push(ch);
    });
    return Object.assign({
      map_authority: (Lex.letterAuthority() || {}).map_authority,
      not_map_authority: (Lex.letterAuthority() || {}).not_map_authority,
      historical_loaded: manifest.authority === 'historical',
      historical_places: false,
      phase_conflicts: phaseConflicts,
      phase_conflict_count: phaseConflicts.length,
      m: M_CONFLICT,
      m_table_used: (letters.M || {}).charge === -2,
      rows: rows,
      cite: 'Decision 1. PPE KPI wins. HarperScript visual manifest is read-only. READ192 §2.8.'
    }, flags());
  }

  function examples() {
    const remember = word('remember');
    const transform = word('transform');
    const create = word('create');
    return Object.assign({
      remember_role: remember.role.role,
      remember_example_role: 'Drift Marker / Memory Capsule',
      remember_example_role_used: false,
      remember_eps: remember.eps,
      remember_mu: remember.mu,
      remember_charge_sum: remember.charge_sum,
      remember_phi: remember.Phi,
      remember_phase_name: remember.phase_name,
      remember_glyph: remember.glyph,
      remember_angle_degrees: remember.angle_degrees,
      remember_provenance: remember.provenance,
      remember_eps0: remember.eps0,
      remember_mu_init: remember.mu_init,
      remember_forbidden: remember.forbidden_5_to_8,
      remember_overload: remember.signatures[0].hit,
      remember_christping_started: false,
      transform_role: transform.role.role,
      transform_example_role: 'Harmonic Transition Vector',
      transform_example_role_used: false,
      transform_charge_sum: transform.charge_sum,
      transform_documented_charge: 3,
      transform_charge_flag: 'KPI-M-CHARGE',
      stability: STABILITY_EXAMPLE,
      pcm: PCM_EXAMPLE,
      create_phi: create.Phi,
      create_provenance: create.provenance,
      create_coherent_list: create.coherent_list_example,
      try_drift_list: word('try').drift_list_example,
      try_admit_gate: false,
      ep_forbidden: word('ep').forbidden_5_to_8,
      sky_phi: word('sky').Phi,
      leaves_phi: word('leaves').Phi,
      ocean_phi: word('ocean').Phi,
      cite: CITE
    }, flags());
  }

  function stage(question) {
    const picked = [];
    Lex.tokens(question || '').forEach(token => {
      if (picked.length < 6) picked.push(compact(word(token)));
    });
    if (!picked.length) ['sky', 'leaves', 'ocean'].forEach(name => picked.push(compact(word(name))));
    const diff = harperDiff();
    return Object.assign({
      seeds: Lex.wordCount(),
      provenance: PROVENANCE,
      eps0: 0,
      mu_init: 1.0,
      angle: ANGLE,
      m_charge: M_CONFLICT.used,
      m_example_charge: M_CONFLICT.example_charge,
      m_flag: M_CONFLICT.flag,
      harper_phase_conflicts: diff.phase_conflict_count,
      map_authority: diff.map_authority,
      not_map_authority: diff.not_map_authority,
      words: picked,
      seed_file_proposal_v1: Lex.proposalV1Count(),
      cite: CITE
    }, flags());
  }

  function showNum(value) {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
      return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    }
    return String(value);
  }

  function monitorLines(mode) {
    if (mode === 'harper') {
      const diff = harperDiff();
      return {
        attrs: { mode: 'harper', status: diff.m.flag, detail: String(diff.phase_conflict_count) },
        lines: [
          'Letter map: ' + diff.map_authority + '. Not ' + diff.not_map_authority + '.',
          'M charge used is ' + diff.m.used + '. The JSON example says ' + diff.m.example_charge + '. Flag ' + diff.m.flag + '.',
          'HarperScript phase conflicts: ' + diff.phase_conflicts.join(', ') + '.',
          'The historical manifest does not place a letter.',
          'This card does not admit. C_min 0.87. No LLM.'
        ]
      };
    }
    if (mode === 'drift') {
      const sample = examples();
      return {
        attrs: { mode: 'drift', status: sample.remember_role, detail: '5to8-' + showNum(sample.ep_forbidden) },
        lines: [
          'remember is ' + sample.remember_role + '. Φ' + sample.remember_phi + ' ' + sample.remember_phase_name + ' glyph ' + sample.remember_glyph + '. ε ' + showNum(sample.remember_eps) + ' μ ' + showNum(sample.remember_mu) + ' ' + sample.remember_provenance + '.',
          'Birth state ε ' + sample.remember_eps0 + ' μ ' + sample.remember_mu_init + '. θ ' + sample.remember_angle_degrees + '°.',
          'Phase 5 Overload is logged. ChristPing started: ' + showNum(sample.remember_christping_started) + '.',
          'ep walks Φ5 then Φ8. Forbidden flag ' + showNum(sample.ep_forbidden) + '. It does not admit.',
          'transform charge sum is ' + sample.transform_charge_sum + '. The worked example says ' + sample.transform_documented_charge + ' because it uses M −1. Flag ' + sample.transform_charge_flag + '.',
          'This card does not admit. C_min 0.87. No LLM.'
        ]
      };
    }
    const sample = examples();
    const sky = word('sky');
    const leaves = word('leaves');
    const ocean = word('ocean');
    return {
      attrs: { mode: 'seeds', status: PROVENANCE, detail: String(Lex.wordCount()) },
      lines: [
        Lex.wordCount() + ' seeds. Provenance ' + PROVENANCE + '. Birth ε 0 μ 1.0. θ=(Φ−1)·40°.',
        'sky · Φ' + sky.Phi + ' ' + sky.phase_name + ' · glyph ' + sky.glyph + ' · θ ' + sky.angle_degrees + '° · ε ' + showNum(sky.eps) + ' · μ ' + showNum(sky.mu),
        'leaves · Φ' + leaves.Phi + ' ' + leaves.phase_name + ' · glyph ' + leaves.glyph + ' · θ ' + leaves.angle_degrees + '° · ε ' + showNum(leaves.eps) + ' · μ ' + showNum(leaves.mu),
        'ocean · Φ' + ocean.Phi + ' ' + ocean.phase_name + ' · glyph ' + ocean.glyph + ' · θ ' + ocean.angle_degrees + '° · ε ' + showNum(ocean.eps) + ' · μ ' + showNum(ocean.mu),
        'remember ' + sample.remember_role + ' · create Φ' + sample.create_phi + ' · the 4.9.191 seed file still has ' + Lex.proposalV1Count() + ' proposal tags.',
        'M charge −2 is the table. The example −1 is flagged. This card does not admit. No LLM.'
      ]
    };
  }

  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('ppe197');
    const host = document.getElementById('ppe197Body');
    if (!card || !host) return;
    const view = monitorLines(mode || 'seeds');
    card.setAttribute('data-ppe197-mode', view.attrs.mode);
    card.setAttribute('data-ppe197-status', view.attrs.status);
    card.setAttribute('data-ppe197-detail', view.attrs.detail);
    host.textContent = view.lines.join('\n');
  }

  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('ppe197')) return;
    paintMonitor('seeds');
    const buttons = document.querySelectorAll('[data-ppe197-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-ppe197-run'));
      });
    }
  }

  function run(payload) {
    const row = payload || {};
    const op = row.op || 'seeds';
    if (op === 'word') return word(String(row.word || ''), String(row.scope || 'word'));
    if (op === 'harper') return harperDiff();
    if (op === 'examples') return examples();
    if (op === 'glyph') return glyphFor(Number(row.phi || 1));
    if (op === 'stage') return stage(row.question);
    if (op === 'monitor') return monitorLines(row.mode || 'seeds');
    if (op === 'summary') {
      const full = seeds();
      const copy = Object.assign({}, full, { checked: full.rows.length });
      delete copy.rows;
      return copy;
    }
    return seeds();
  }

  const api = {
    CITE: CITE, PROVENANCE: PROVENANCE, word: word, seeds: seeds, glyphFor: glyphFor,
    harperDiff: harperDiff, examples: examples, stage: stage, monitorLines: monitorLines,
    paintMonitor: paintMonitor, run: run
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Ppe197 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
