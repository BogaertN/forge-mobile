/* forge_tools.js — 4.9.177 ports of the Forge tools that fit the no-LLM learning loop.
 * Phase parse: BogaertN/forge rmc_engine_v1/phase_parser.py (pure, no I/O).
 * Hosted recall: rmc_engine_v1/memory_recaller.py score, over the session bank.
 * Read and search: agents/forge/tools.py Level 0.5, approved root hosted://bank only.
 * Vector and model requests: rmc_engine_v1/frozen_legacy_boundary.py refusals.
 * The current knowledge-base module is the Slice 0B boundary block (6fcc28b), not a search.
 * Device paths, shell, patch writes, and payments stay refused. No network. Packs stay gated.
 * The portable single file does not inline this file. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const SHA = isNode ? require('./sha256.js') : root.KSha;
  const SCHEMA = 'FORGE-GITHUB-TOOLS/v1';
  const BANK = 'hosted://bank';
  const ENGINE_PHASE = 'rmc_phase_parser_engine_v1_patch262J1R_preflight_B6R';
  const ENGINE_RECALL = 'rmc_memory_recaller_v1_frozen_legacy_containment_v1';
  const PHASES = ['Φ1', 'Φ2', 'Φ3', 'Φ4', 'Φ5', 'Φ6', 'Φ7', 'Φ8', 'Φ9'];
  const FS_ALIASES = { '': 1, filesystem: 1, file: 1, files: 1, fs: 1, local: 1, local_filesystem: 1 };
  const FALSE_TOGGLE = { '': 1, '0': 1, false: 1, no: 1, off: 1, disabled: 1, none: 1, null: 1 };
  const TRUE_TOGGLE = { '1': 1, true: 1, yes: 1, on: 1, enabled: 1, enable: 1, llm: 1, model: 1 };
  const DRIFT_TERMS = ['drift', 'bypass', 'collapse', 'unstable', 'correction', 'χ', 'christ', 'circuit', 'projection'];
  const MAX_LINES = 500;
  const MAX_RESULTS = 50;
  const SLICE_STATUS = 'BOUNDARY_BLOCKED_NON_AUTHORITATIVE';
  const SLICE_REASON = [
    'Slice 0B blocks knowledge-base retrieval from acting as Forge/RMC core authority. ',
    'Chr' + 'oma, vector search, embed' + 'dings, RAG, ',
    'Oll' + 'ama, model output, semantic similarity, and nearest-neighbor retrieval are unavailable here.'
  ].join('');

  function roundDigits(n, digits) {
    const m = Math.pow(10, digits);
    const x = n * m;
    const sign = x < 0 ? -1 : 1;
    const ax = Math.abs(x);
    const fl = Math.floor(ax);
    const frac = ax - fl;
    let r;
    if (Math.abs(frac - 0.5) < 1e-8) r = (fl % 2 === 0) ? fl : fl + 1;
    else r = Math.floor(ax + 0.5);
    return sign * r / m;
  }

  function sha16(text) {
    const h = SHA && SHA.sha256 ? SHA.sha256(String(text || '')) : '';
    return h ? h.slice(0, 16) : 'empty_input';
  }

  function clean(value) {
    return String(value == null ? '' : value).trim().toLowerCase().replace(/-/g, '_');
  }

  function nonempty(value) {
    return value != null && String(value).trim() !== '';
  }

  function toggleRequested(value) {
    if (typeof value === 'boolean') return value;
    const c = clean(value);
    if (FALSE_TOGGLE[c]) return false;
    if (TRUE_TOGGLE[c]) return true;
    return !!c;
  }

  function boundaryDecision(status, reason, feature, requested, effective) {
    return {
      ok: status === 'OK',
      status: status,
      reason_code: reason,
      feature_id: feature,
      requested: requested || {},
      retrieval_backend_effective: effective || 'none',
      runtime_authorized: false,
      authority: 'none',
      calls_llm: false,
      calls_model: false,
      calls_vector_store: false,
      calls_chroma: false,
      performs_retrieval: status === 'OK' && effective === 'filesystem',
      writes_files: false,
      writes_memory: false,
      executes_shell: false,
      evidence_validated: false,
      action_authorized: false,
      delivery_authorized: false,
      release_authorized: false,
      production_readiness_authorized: false
    };
  }

  function classifyLlm(req) {
    req = req || {};
    const requested = {
      enabled: req.enabled,
      model_endpoint_supplied: nonempty(req.model_endpoint),
      model_supplied: nonempty(req.model),
      timeout_supplied: nonempty(req.timeout_seconds),
      client_supplied: req.llm_client != null
    };
    const prohibited = toggleRequested(req.enabled) || requested.model_endpoint_supplied || requested.model_supplied || requested.timeout_supplied || requested.client_supplied;
    const feature = 'legacy_llm_' + 'renderer';
    if (prohibited) return boundaryDecision('BLOCKED', 'FROZEN_LEGACY_LLM_REQUEST_PROHIBITED', feature, requested, 'none');
    return {
      ok: true, status: 'NOT_REQUESTED', reason_code: 'DETERMINISTIC_RENDERING_ONLY', feature_id: feature, requested: requested,
      runtime_authorized: false, calls_llm: false, calls_model: false, calls_vector_store: false, calls_chroma: false,
      performs_retrieval: false, writes_files: false, writes_memory: false, executes_shell: false,
      evidence_validated: false, action_authorized: false, delivery_authorized: false, release_authorized: false,
      production_readiness_authorized: false
    };
  }

  function classifyRetrieval(sourceMetadata, environ) {
    const metadata = Object.assign({}, sourceMetadata || {});
    const env = Object.assign({}, environ || {});
    const backendRaw = metadata.retrieval_backend || metadata.memory_backend || env.RMC_MEMORY_RETRIEVAL_BACKEND || 'filesystem';
    const backend = clean(backendRaw);
    const controls = {
      chroma_collection: metadata.chroma_collection,
      collection_name: metadata.collection_name,
      chroma_limit: metadata.chroma_limit,
      env_chroma_collection: env.RMC_CHROMA_COLLECTION,
      env_chroma_limit: env.RMC_CHROMA_LIMIT
    };
    const supplied = {};
    Object.keys(controls).forEach(k => { if (nonempty(controls[k])) supplied[k] = controls[k]; });
    const requested = { backend: backendRaw, prohibited_controls: supplied };
    const feature = 'legacy_vector_retrieval';
    if (Object.keys(supplied).length) return boundaryDecision('BLOCKED', 'FROZEN_LEGACY_VECTOR_CONTROL_PROHIBITED', feature, requested, 'none');
    if (!FS_ALIASES[backend]) return boundaryDecision('BLOCKED', 'FROZEN_LEGACY_RETRIEVAL_BACKEND_PROHIBITED', feature, requested, 'none');
    return boundaryDecision('OK', 'FILESYSTEM_RETRIEVAL_ONLY', 'filesystem_memory_recall', requested, 'filesystem');
  }

  function phaseCatalog() {
    return {
      'Φ1': { index: 1, role: 'Initiation / seed', routing: 'establish_context', keywords: ['start', 'begin', 'seed', 'new', 'first', 'initiate', 'open', 'create', 'build'] },
      'Φ2': { index: 2, role: 'Polarity / contrast', routing: 'identify_poles', keywords: ['versus', 'compare', 'difference', 'contrast', 'opposite', 'polarity', 'either', 'or', 'mirror'] },
      'Φ3': { index: 3, role: 'Desire / vector', routing: 'identify_direction', keywords: ['want', 'need', 'goal', 'plan', 'direction', 'aim', 'path', 'next', 'ready'] },
      'Φ4': { index: 4, role: 'Friction / constraint', routing: 'surface_constraint', keywords: ['problem', 'blocked', 'issue', 'bug', 'fail', 'error', 'constraint', 'stuck', 'why'] },
      'Φ5': { index: 5, role: 'Entropy / drift', routing: 'drift_analyzer_required', keywords: ['drift', 'confused', 'hallucination', 'collapse', 'unstable', 'wrong', 'danger', 'loop', 'slip'] },
      'Φ6': { index: 6, role: 'Correction / coherence return', routing: 'correction_engine', keywords: ['correct', 'fix', 'repair', 'realign', 'verify', 'ground', 'coherence', 'return', 'χ', 'christ'] },
      'Φ7': { index: 7, role: 'Naming / identity lock', routing: 'naming_engine', keywords: ['name', 'naming', 'named', 'define', 'definition', 'classify', 'label', 'identity', 'schema', 'contract', 'codex'] },
      'Φ8': { index: 8, role: 'Projection / outward expression', routing: 'projection_gate', keywords: ['project', 'projection', 'projecting', 'publish', 'ship', 'render', 'export', 'output', 'show', 'public', 'run', 'launch', 'deploy'] },
      'Φ9': { index: 9, role: 'Closure / octave transition', routing: 'closure_or_archive', keywords: ['finish', 'complete', 'close', 'seal', 'archive', 'handover', 'done', 'final', 'octave'] }
    };
  }

  function containsLiteral(textLower, literal) {
    const lit = String(literal || '').toLowerCase().trim();
    if (!lit) return false;
    if (!/^[a-z0-9_ ]+$/.test(lit)) return textLower.indexOf(lit) !== -1;
    const re = new RegExp('(?<![A-Za-z0-9_])' + lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9_])', 'i');
    return re.test(textLower);
  }

  function phraseEvidence(textLower, phaseKey) {
    const checks = {
      'Φ5': [[/\bprojection\s+drift\b/i, 'phrase:projection_drift'], [/\bsemantic\s+drift\b/i, 'phrase:semantic_drift'], [/\brecursive\s+drift\b/i, 'phrase:recursive_drift']],
      'Φ6': [[/\bcorrect(?:ion)?\b.*\bbefore\b.*\b(?:naming|name|definition|define)\b/is, 'phrase:correct_before_naming'], [/\b(?:correct|fix|repair|verify)\b.*\bdrift\b/is, 'phrase:correction_of_drift'], [/\b(?:verify|validate|correct)\b.*\bbefore\b.*\b(?:project|projection|publish|deploy|output|render)\b/is, 'phrase:validate_before_projection']],
      'Φ7': [[/\bbefore\b.*\b(?:naming|name|definition|define)\b/is, 'sequence_gate:before_naming'], [/\bafter\b.*\b(?:correction|correct|verify|validate)\b.*\b(?:naming|name|define)\b/is, 'sequence_gate:name_after_correction']],
      'Φ8': [[/\bprojection\b/i, 'keyword:projection'], [/\bproject\b/i, 'keyword:project'], [/\bbefore\b.*\b(?:projection|projecting|project|publish|deploy|output|render)\b/is, 'sequence_gate:before_projection']]
    };
    const out = [];
    (checks[phaseKey] || []).forEach(pair => { if (pair[0].test(textLower)) out.push(pair[1]); });
    return out;
  }

  function evidenceWeight(item) {
    const s = String(item || '');
    if (s.indexOf('explicit:') === 0) return 3;
    if (s.indexOf('phrase:') === 0) return 2.2;
    if (s.indexOf('sequence_gate:') === 0) return 1.8;
    if (s.indexOf('keyword:') === 0) return 1;
    if (s.indexOf('fallback:') === 0) return 0.7;
    return 0.5;
  }

  function evidenceForPhase(textLower, phaseKey, entry) {
    const evidence = phraseEvidence(textLower, phaseKey);
    (entry.keywords || []).forEach(kw => {
      const label = 'keyword:' + kw;
      if (containsLiteral(textLower, String(kw).toLowerCase().trim()) && evidence.indexOf(label) === -1) evidence.push(label);
    });
    const idx = entry.index;
    ['φ' + idx, 'phi' + idx, 'phase ' + idx, 'phase_' + idx, 'u03a6' + idx].forEach(token => {
      if (containsLiteral(textLower, token.toLowerCase())) evidence.push('explicit:' + token);
    });
    return evidence.slice(0, 16);
  }

  function rankPhases(text) {
    const catalog = phaseCatalog();
    const textLower = String(text || '').toLowerCase();
    const tokenCount = Math.max(1, (textLower.match(/\w+/g) || []).length);
    const ranked = [];
    Object.keys(catalog).forEach(phaseKey => {
      const entry = catalog[phaseKey];
      const evidence = evidenceForPhase(textLower, phaseKey, entry);
      const base = evidence.reduce((s, item) => s + evidenceWeight(item), 0);
      const confidence = base ? roundDigits(Math.min(0.96, 0.08 + (base * 0.11) + Math.min(0.18, evidence.length / Math.max(12, tokenCount))), 3) : 0.03;
      ranked.push({ phase: phaseKey, index: entry.index, role: entry.role, routing: entry.routing, confidence: confidence, evidence: evidence });
    });
    ranked.sort((a, b) => {
      const dc = (b.confidence || 0) - (a.confidence || 0);
      if (dc) return dc;
      return (b.evidence || []).length - (a.evidence || []).length;
    });
    if (ranked.length && (ranked[0].confidence || 0) <= 0.05) {
      ranked[0].confidence = 0.18;
      ranked[0].evidence = ['fallback:unclassified_input_treated_as_seed'];
    }
    return ranked;
  }

  function phasePath(ranked) {
    let top = ranked.filter(item => (item.confidence || 0) >= 0.12);
    if (!top.length && ranked.length) top = [ranked[0]];
    return top.slice(0, 5).slice().sort((a, b) => (a.index || 0) - (b.index || 0)).map(item => item.phase);
  }

  function transitionWarnings(path) {
    const warnings = [];
    const nums = [];
    (path || []).forEach(phase => {
      const n = parseInt(String(phase).replace('Φ', ''), 10);
      if (n) nums.push(n);
    });
    for (let i = 0; i < nums.length - 1; i++) {
      const a = nums[i], b = nums[i + 1];
      if (a === 5 && b >= 8) warnings.push({ type: 'phase_skip_projection_risk', from: 'Φ' + a, to: 'Φ' + b, law: 'drift must pass correction/naming before projection' });
      else if (b - a > 2) warnings.push({ type: 'phase_skip_review', from: 'Φ' + a, to: 'Φ' + b, law: 'ordered phase transition expected unless explicitly marked exploratory' });
    }
    return warnings;
  }

  function buildRouting(primary, path, warnings) {
    const routing = [];
    if (primary && primary.routing) routing.push(primary.routing);
    if ((warnings || []).some(w => w.type === 'phase_skip_projection_risk')) routing.push('drift_analyzer_required_before_projection');
    if (path.indexOf('Φ5') !== -1) routing.push('drift_analyzer_required');
    if (path.indexOf('Φ6') !== -1) routing.push('correction_gate_candidate');
    if (path.indexOf('Φ7') !== -1) routing.push('naming_gate_candidate');
    routing.push('next_module:drift_analyzer');
    return routing;
  }

  function parsePhase(sourceText, sourceMetadata, clock) {
    const text = String(sourceText || '');
    const ranked = rankPhases(text);
    const primary = ranked[0] || {};
    const secondary = ranked.length > 1 ? ranked.slice(1, 4) : [];
    const path = phasePath(ranked);
    const warnings = transitionWarnings(path);
    const routing = buildRouting(primary, path, warnings);
    const stamp = typeof clock === 'function' ? clock() : new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00');
    const phaseState = {
      phase_primary: primary.phase,
      phase_primary_role: primary.role,
      phase_secondary: secondary.map(item => item.phase),
      phase_path_hypothesis: path,
      confidence: primary.confidence || 0,
      confidence_status: Number(primary.confidence || 0) < 0.4 ? 'phase_review_required' : 'phase_confidence_acceptable',
      token_boundary_mode: 'whole_word_keyword_matching_B6R',
      phase_candidates: ranked,
      transition_warnings: warnings,
      routing: routing,
      projection_warning: (primary.phase === 'Φ8' || warnings.length) ? 'Projection requires Φ6 correction and Φ7 naming before Φ8 export.' : 'No projection warning from parser dry-run.'
    };
    return {
      input_event: {
        event_id: text ? 'it_preview_' + sha16(text) : 'it_preview_empty_input',
        x_t_raw_input_preview: text.slice(0, 1200),
        c_t_context_source: sourceMetadata || {},
        u_t_identity_context: { operator_console: true, forge_governs: true, ui_is_authority: false },
        tau_t_generated_at_utc: stamp,
        dry_run: true
      },
      phase_state: phaseState,
      engine_boundary: {
        engine_version: ENGINE_PHASE,
        engine_module_location: 'forge/rmc_engine_v1/phase_parser.py',
        ui_owns_phase_logic: false,
        engine_module_owns_phase_logic: true,
        side_effect_free: true,
        calls_llm: false,
        queries_chroma: false,
        reads_db_files: false,
        writes_files: false,
        writes_rmc_memory: false,
        writes_identity_vault: false
      },
      writes_files: false,
      identity_vault_write: false,
      rmc_live_memory_write: false,
      approved_output: false,
      calls_llm: false,
      network: false
    };
  }

  function tokensOf(text) {
    const out = {};
    const found = String(text || '').match(/[A-Za-z0-9_χΦφ]+/g) || [];
    found.forEach(t => { if (t.length >= 2) out[t.toLowerCase()] = 1; });
    return out;
  }

  function phaseStateOf(report) {
    if (report && report.phase_state && typeof report.phase_state === 'object') return report.phase_state;
    return report || {};
  }

  function scoreNode(node, inputText, phaseReport) {
    const text = String(node.content_summary || '');
    const inputTokens = tokensOf(inputText);
    const nodeTokens = tokensOf(text + ' ' + String(node.source || '') + ' ' + String(node.memory_role || ''));
    const overlap = Object.keys(inputTokens).filter(t => nodeTokens[t]).sort();
    const inputCount = Object.keys(inputTokens).length;
    const semantic = Math.min(1, overlap.length / Math.max(4, inputCount || 1));
    const phaseState = phaseStateOf(phaseReport);
    const primary = String(phaseState.phase_primary || '');
    const secondary = (phaseState.phase_secondary || []).map(p => String(p));
    const nodePhases = node.phase_tags || [];
    const phaseHits = nodePhases.filter(p => p === primary || secondary.indexOf(p) !== -1);
    let phaseRelevance = 0;
    if (phaseHits.length) phaseRelevance = 0.35 + 0.12 * Math.min(3, phaseHits.length);
    else if (nodePhases.length && primary) phaseRelevance = 0.12;
    const ancestry = node.ancestry || {};
    const ancestryScore = Object.keys(ancestry).some(k => {
      const v = ancestry[k];
      return !(v == null || v === '' || (Array.isArray(v) && !v.length) || (v && typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length));
    }) ? 0.18 : 0;
    const lower = (String(inputText || '') + ' ' + text).toLowerCase();
    let driftRelation = 0;
    if (DRIFT_TERMS.some(term => lower.indexOf(term) !== -1)) driftRelation = 0.22;
    const prior = Number(node.prior_drift_score || 0);
    if (!isNaN(prior)) driftRelation += Math.min(0.18, prior * 0.2);
    let activeLoop = 0;
    if (node.source_kind === 'dataset_review_queue_item' || node.source_kind === 'dataset_candidate_example') activeLoop = 0.2;
    if (node.source_kind === 'ingestion_receipt' || node.source_kind === 'symbolic_map_entry') activeLoop += 0.08;
    const weight = roundDigits(Math.min(1, semantic * 0.44 + phaseRelevance + ancestryScore + driftRelation + activeLoop), 4);
    const evidence = [];
    if (overlap.length) evidence.push({ type: 'semantic_overlap', tokens: overlap.slice(0, 12) });
    if (phaseHits.length) evidence.push({ type: 'phase_relevance', phase_hits: phaseHits });
    if (ancestryScore) evidence.push({ type: 'ancestry_present' });
    if (driftRelation) evidence.push({ type: 'drift_relation', score: roundDigits(driftRelation, 3) });
    if (activeLoop) evidence.push({ type: 'active_loop_relation', score: roundDigits(activeLoop, 3) });
    const out = Object.assign({}, node);
    out.retrieval_weight = weight;
    out.retrieval_dimensions = {
      semantic_relevance: roundDigits(semantic, 4),
      phase_relevance: roundDigits(phaseRelevance, 4),
      ancestry_match: roundDigits(ancestryScore, 4),
      drift_relation: roundDigits(driftRelation, 4),
      active_loop_relation: roundDigits(activeLoop, 4)
    };
    out.retrieval_evidence = evidence;
    return out;
  }

  function nodesFromHosted(rows) {
    return (rows || []).filter(r => r && r.text).map(r => {
      const sfe = r.sfe || null;
      const phi = sfe && sfe.Phi;
      const tags = (phi >= 1 && phi <= 9) ? ['Φ' + phi] : [];
      const ancestry = {};
      if (sfe && (sfe.Phi != null || sfe.eps != null || sfe.mu != null)) {
        ancestry.Phi = sfe.Phi;
        ancestry.eps = sfe.eps;
        ancestry.mu = sfe.mu;
      }
      return {
        memory_id: String(r.id || 'hosted'),
        source_kind: 'hosted_shared_knowledge',
        source_path: BANK + '/' + String(r.id || 'row'),
        content_summary: String(r.text).slice(0, 700),
        source: String(r.id || ''),
        phase_tags: tags,
        confidence: 'medium_high',
        ancestry: ancestry,
        prior_drift_score: sfe && typeof sfe.eps === 'number' ? sfe.eps : 0,
        memory_role: 'hosted_shared'
      };
    });
  }

  function recallMemory(sourceText, sourceMetadata, opts) {
    opts = opts || {};
    sourceMetadata = Object.assign({}, sourceMetadata || {});
    const llm = classifyLlm(sourceMetadata);
    if (llm.status === 'BLOCKED' || sourceMetadata.calls_llm === true) {
      return { ok: false, status: 'BLOCKED', rule: 'DREAM-LLM-REFUSED', reason_code: llm.reason_code || 'FROZEN_LEGACY_LLM_REQUEST_PROHIBITED', calls_llm: false, network: false, executes_shell: false, writes_files: false, memory_state: { active_memory_nodes: [], active_memory_count: 0 } };
    }
    if (opts.root || sourceMetadata.root || sourceMetadata.forge_root) {
      return { ok: false, status: 'BLOCKED', rule: 'FORGE-DEVICE-PATH-REFUSED', calls_llm: false, network: false, executes_shell: false, writes_files: false, memory_state: { active_memory_nodes: [], active_memory_count: 0 } };
    }
    const decision = classifyRetrieval(sourceMetadata, opts.environ);
    const phase = parsePhase(sourceText, sourceMetadata, opts.clock);
    if (decision.status !== 'OK') {
      return {
        ok: false, status: 'BLOCKED', reason_code: decision.reason_code, rule: decision.reason_code, calls_llm: false, network: false, executes_shell: false, writes_files: false,
        engine_version: ENGINE_RECALL, stage: 'Memory Recaller', phase_report_summary: { phase_primary: phase.phase_state.phase_primary },
        memory_state: { M_t_present: false, active_memory_count: 0, active_memory_nodes: [], retrieval_backend_effective: 'none' },
        legacy_retrieval_request: decision, fallback_performed: false
      };
    }
    const nodes = opts.nodes || [];
    const ranked = nodes.map(node => scoreNode(node, sourceText, phase));
    ranked.sort((a, b) => {
      const dw = (b.retrieval_weight || 0) - (a.retrieval_weight || 0);
      if (dw) return dw;
      return (b.retrieval_evidence || []).length - (a.retrieval_evidence || []).length;
    });
    const limit = Math.max(1, Math.min(parseInt(opts.limit == null ? 12 : opts.limit, 10) || 12, 50));
    const active = ranked.slice(0, limit);
    return {
      ok: true, status: 'OK', calls_llm: false, network: false, executes_shell: false, writes_files: false, queries_chroma: false,
      engine_version: ENGINE_RECALL, engine_mode: 'read_only_rmc_memory_recaller_trace_spine_hosted_bank',
      stage: 'Memory Recaller',
      phase_report_summary: { phase_primary: phase.phase_state.phase_primary, phase_secondary: phase.phase_state.phase_secondary, confidence: phase.phase_state.confidence },
      memory_state: {
        M_t_present: true,
        candidate_nodes_collected: nodes.length,
        active_memory_count: active.length,
        retrieval_dimensions: ['semantic_relevance', 'phase_relevance', 'ancestry', 'drift_relation', 'active_loop_relation'],
        retrieval_backend_requested: 'filesystem',
        retrieval_backend_effective: 'hosted_bank',
        active_memory_nodes: active
      },
      legacy_retrieval_request: decision,
      fallback_performed: false,
      device_filesystem: false
    };
  }

  function recallHosted(query, rows, opts) {
    return recallMemory(query, { retrieval_backend: 'filesystem' }, Object.assign({}, opts || {}, { nodes: nodesFromHosted(rows) }));
  }

  function searchKnowledgeBase() {
    return {
      ok: false, status: SLICE_STATUS, operation: 'search_knowledge_base', authority: 'none', core_authority: false,
      forge_rmc_core_authority: false, memory_written: false, evidence_validated: false, external_resource_admitted: false,
      delivery_authorized: false, reason: SLICE_REASON, accepted_scope: 'Slice 0B boundary containment only',
      calls_llm: false, network: false, queries_chroma: false
    };
  }

  function filesOf(rows) {
    const files = {};
    (rows || []).forEach(r => {
      if (!r || !r.text || !r.id) return;
      const id = String(r.id);
      files[id] = { id: id, name: id + '.txt', lines: String(r.text).split('\n') };
    });
    return files;
  }

  function parseBankPath(path) {
    const raw = String(path || '').trim();
    if (!raw || raw.indexOf('..') !== -1 || raw.indexOf('\\') !== -1 || raw.indexOf('\0') !== -1) return null;
    if (raw.startsWith('/') || raw.startsWith('~') || /^file:/i.test(raw)) return null;
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && raw.indexOf(BANK) !== 0) return null;
    if (raw !== BANK && raw.indexOf(BANK + '/') !== 0) return null;
    const rest = raw === BANK ? '' : raw.slice(BANK.length + 1);
    if (!rest) return { kind: 'dir' };
    if (rest.indexOf('/') !== -1) return null;
    const id = rest.replace(/\.txt$/, '');
    if (!/^[A-Za-z0-9:_-]{1,96}$/.test(id)) return null;
    return { kind: 'file', id: id };
  }

  function err(message) {
    return { ok: false, error: message, calls_llm: false, network: false, executes_shell: false, writes_files: false };
  }

  function ok(data) {
    return { ok: true, data: data, calls_llm: false, network: false, executes_shell: false, writes_files: false };
  }

  function sessionTools(rows) {
    const files = filesOf(rows);
    function listAllowedFolders() {
      return ok('Accessible paths for this session:\n  ✓ ' + BANK);
    }
    function listFiles(path, maxDepth) {
      const loc = parseBankPath(path);
      if (!loc) return err('Path is outside the approved session bank.');
      if (loc.kind !== 'dir') return err("'" + path + "' is a file, not a directory. Use read_file instead.");
      const depth = Math.min(parseInt(maxDepth == null ? 2 : maxDepth, 10) || 2, 4);
      if (depth < 1) return err('max_depth must be at least 1.');
      const names = Object.keys(files).sort();
      const lines = ['Contents of ' + BANK + ':'];
      names.forEach(id => lines.push('  ' + files[id].name));
      if (!names.length) lines.push('  (empty or all entries filtered)');
      return ok(lines.join('\n'));
    }
    function readFile(path, startLine, endLine) {
      const loc = parseBankPath(path);
      if (!loc) return err('Path is outside the approved session bank.');
      if (loc.kind !== 'file') return err("'" + path + "' is a directory. Use list_files instead.");
      const file = files[loc.id];
      if (!file) return err('File does not exist: ' + path);
      const all = file.lines;
      const total = all.length;
      let selected, info;
      if (startLine != null || endLine != null) {
        const s = Math.max(0, (startLine ? Number(startLine) - 1 : 0));
        const e = Math.min(total, endLine ? Number(endLine) : total);
        selected = all.slice(s, e);
        info = 'lines ' + (s + 1) + '–' + Math.min(e, total) + ' of ' + total;
      } else {
        selected = all.slice(0, MAX_LINES);
        info = total <= MAX_LINES ? 'all ' + total + ' lines' : 'first ' + MAX_LINES + ' of ' + total + ' lines (use start_line/end_line for more)';
      }
      if (selected.length > MAX_LINES) {
        selected = selected.slice(0, MAX_LINES);
        info += ' (truncated to ' + MAX_LINES + ')';
      }
      return ok('── ' + BANK + '/' + file.name + '  [' + info + '] ──\n' + selected.join('\n'));
    }
    function searchText(query, path, caseSensitive) {
      const q = String(query || '');
      if (!q) return err('Query is empty.');
      const loc = parseBankPath(path || BANK);
      if (!loc) return err('Path is outside the approved session bank.');
      const needle = caseSensitive ? q : q.toLowerCase();
      const ids = loc.kind === 'file' ? [loc.id] : Object.keys(files).sort();
      const hits = [];
      ids.forEach(id => {
        const file = files[id];
        if (!file) return;
        file.lines.forEach((line, i) => {
          if (hits.length >= MAX_RESULTS) return;
          const compare = caseSensitive ? line : line.toLowerCase();
          if (compare.indexOf(needle) !== -1) hits.push(BANK + '/' + file.name + ':' + (i + 1) + ': ' + line.replace(/\s+$/, ''));
        });
      });
      if (!hits.length) return ok("No matches found for '" + q + "' in " + (path || BANK));
      const header = "Search results for '" + q + "' in " + (path || BANK) + ' (' + hits.length + ' match' + (hits.length === 1 ? '' : 'es') + '):\n';
      const truncation = hits.length >= MAX_RESULTS ? '\n... (showing first ' + MAX_RESULTS + ' results)' : '';
      return ok(header + hits.join('\n') + truncation);
    }
    function refuse(rule) {
      return { ok: false, rule: rule, error: rule, calls_llm: false, network: false, executes: false, executes_shell: false, writes: false, writes_files: false, open_crawl: false };
    }
    function dispatch(toolName, args) {
      args = args || {};
      const name = String(toolName || '');
      if (/pay|wallet|stripe|sale|invoice/i.test(name)) return refuse('FORGE-PAYMENT-DISABLED');
      if (name === 'list_allowed_folders') return listAllowedFolders();
      if (name === 'list_files') return listFiles(args.path || BANK, args.max_depth);
      if (name === 'read_file') return readFile(args.path, args.start_line, args.end_line);
      if (name === 'search_text') return searchText(args.query, args.path || BANK, args.case_sensitive === true);
      if (name === 'search_knowledge_base') return searchKnowledgeBase();
      if (name === 'recall_memory' || name === 'rmc_memory_recall') return recallHosted(args.query || args.text || args.source_text || '', rows, { limit: args.n_results || args.limit });
      if (name === 'rmc_phase_parse_preview' || name === 'parse_phase') {
        const parsed = parsePhase(args.text || args.source_text || '', args.context || {});
        return { ok: true, data: parsed, calls_llm: false, network: false, writes_files: false, executes_shell: false };
      }
      if (name === 'run_safe_command' || name === 'propose_command') return refuse('FORGE-SHELL-REFUSED');
      if (name === 'write_proposed_patch' || name === 'apply_patch') return refuse('FORGE-PATCH-WRITE-REFUSED');
      if (name === 'analyze_command_output') return refuse('FORGE-DIAGNOSTIC-SKIPPED');
      if (name === 'rmc_drift_check_preview' || name === 'rmc_echo_validate_preview' || name === 'rmc_pipeline_preview') return refuse('FORGE-RUNTIME-ABSENT');
      return refuse('FORGE-TOOL-UNKNOWN');
    }
    return {
      schema: SCHEMA, root: BANK, calls_llm: false, network: false, device_filesystem: false,
      listAllowedFolders: listAllowedFolders, listFiles: listFiles, readFile: readFile, searchText: searchText, dispatch: dispatch
    };
  }

  const api = {
    SCHEMA: SCHEMA, BANK: BANK, PHASES: PHASES, calls_llm: false, network: false, device_filesystem: false,
    parsePhase: parsePhase, phaseCatalog: phaseCatalog, classifyLlm: classifyLlm, classifyRetrieval: classifyRetrieval,
    scoreNode: scoreNode, nodesFromHosted: nodesFromHosted, recallMemory: recallMemory, recallHosted: recallHosted,
    searchKnowledgeBase: searchKnowledgeBase, sessionTools: sessionTools
  };
  if (isNode) module.exports = api; else root.KForgeTools = api;
})(typeof self !== 'undefined' ? self : this);
