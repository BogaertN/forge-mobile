/* 4.9.198 Lexicon Growth Engine.
 * Unknown words get a packet from the 4.9.197 letter map. No keyword scan.
 * Birth state is ε=0, μ=1.0, tagged proposal v1. Operators wait for 4.9.199.
 * Provisional until C≥0.87 and Echo≥0.85 across uses and drift<0.3.
 * A name seals at Φ≥7, echo confirmed, drift<0.2, through the 4.9.195 archive.
 * Drift above the write law quarantines. Φ5→Φ8 never promotes. Mask ≥0.70 denies.
 * No LLM. */
(function (root) {
  const Lex = (typeof module !== 'undefined' && module.exports) ? require('./resonance_lexicon.js') : root.ResonanceLexicon;
  const Ppe = (typeof module !== 'undefined' && module.exports) ? require('./ppe_lexicon_197.js') : root.Ppe197;
  const V43 = (typeof module !== 'undefined' && module.exports) ? require('./drift_v43.js') : root.DriftV43;
  const KM = (typeof module !== 'undefined' && module.exports) ? require('./kmath.js') : root.KMath;
  const Dpa = (typeof module !== 'undefined' && module.exports) ? require('./dpa_195.js') : root.Dpa195;
  const SHA = (typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.KSha;
  const sha256 = SHA.sha256;
  const LAW = V43.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1 }).laws;
  const C_MIN = LAW.C_min;
  const ECHO_MIN = LAW.echo_min;
  const WRITE_MAX = LAW.write_max;
  const HARD_STOP = LAW.hard_stop;
  const MEMORY_DRIFT = 0.3;
  const NAMING_DRIFT = 0.2;
  const NAMING_PHI = 7;
  const USES_MIN = 2;
  const STORAGE_KEY = 'kernel.lexicon_growth_198';
  const PROVENANCE = 'proposal v1';
  const ANGLE = 'θ=(Φ−1)·40°';
  const CITE = 'Lexicon Growth Engine. HarperScript l.616. SLB l.646. SRL l.806. Birth ε=0 μ=1.0 is RSOC Phase 1. Promotion needs C≥0.87 and Echo≥0.85 across uses, and drift<0.3 (Codex memory stack 3.15, a l.2736). A name seals only at Φ≥7 with echo confirmed and drift<0.2 (Codex naming_engine 3.21, a l.3313–3341) through the 4.9.195 archive. Drift above the write law is χ quarantine. A Φ5→Φ8 letter walk is flagged and never promoted. Drift-mask similarity ≥0.70 denies (Codex Ch.4, a l.4001–4006). Phase and glyph come from the 4.9.197 letter map. θ=(Φ−1)·40°. The value tag is proposal v1. RSOC operator evolution is 4.9.199 and is not applied. No LLM.';

  function flags() {
    return {
      admit_gate: false, keyword_admit: false, writes: false, calls_llm: false,
      money: false, dream_idle: false, economy: false, packs_gated: true,
      christping: 'gilligan-only', christping_started: false, wikipedia_anchor: false,
      c_min: C_MIN, echo_min: ECHO_MIN, write_max: WRITE_MAX, hard_stop: HARD_STOP,
      memory_drift_max: MEMORY_DRIFT, naming_drift_max: NAMING_DRIFT, naming_phi_min: NAMING_PHI,
      uses_min: USES_MIN, mask_threshold: V43.MASK_SIM, resonance_not_parsing: true,
      operators_applied: false, geometry_build: '4.9.199', coherence_formula_unchanged: true
    };
  }

  function num(value, fallback) {
    if (typeof value === 'boolean' || value === null || value === undefined || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function empty() {
    return { schema: 'FORGE-LEXICON-GROWTH/v1', words: {}, seen: {}, archive: Dpa.emptyArchive() };
  }

  function uniqueTokens(text) {
    const out = [];
    const seen = {};
    Lex.tokens(text).forEach(function (token) {
      if (!seen[token]) { seen[token] = true; out.push(token); }
    });
    return out;
  }

  function aligned(a, b) {
    if (!(a >= 1 && a <= 9 && b >= 1 && b <= 9)) return false;
    const gap = Math.abs(KM.phaseAngle(a) - KM.phaseAngle(b));
    const tau = Math.PI * 2;
    const wrapped = Math.min(gap, tau - gap);
    return wrapped <= KM.MERGE_WINDOW + 1e-12;
  }

  function birthPacket(token) {
    const row = Ppe.word(token);
    return {
      word: row.word, Phi: row.Phi, phase_name: row.phase_name, glyph: row.glyph || '',
      angle: row.Phi ? ANGLE : 'unspecified', angle_degrees: row.angle_degrees,
      eps: 0, mu: 1, provenance: PROVENANCE, eps0: 0, mu_init: 1,
      eps_proposal: row.eps, mu_proposal: row.mu, how: row.how, authority: row.authority,
      forbidden_5_to_8: !!row.forbidden_5_to_8, letter_phases: row.letter_phases.slice(),
      schema: 'FORGE-RESONANCE-PACKET/v1'
    };
  }

  function chainOk(store) {
    return !!Dpa.verifyArchive(store.archive).ok;
  }

  function statsOf(entry) {
    const uses = entry.uses;
    let cMin = uses[0].C;
    let echoMin = uses[0].echo;
    let driftMax = uses[0].drift;
    let questionsMatch = true;
    uses.forEach(function (use) {
      if (use.C < cMin) cMin = use.C;
      if (use.echo < echoMin) echoMin = use.echo;
      if (use.drift > driftMax) driftMax = use.drift;
      if (use.question !== entry.question) questionsMatch = false;
    });
    return {
      cMin: cMin, echoMin: echoMin, driftMax: driftMax, questionsMatch: questionsMatch,
      namingPhi: entry.packet.Phi >= NAMING_PHI,
      namingEcho: questionsMatch && echoMin >= ECHO_MIN,
      namingDrift: driftMax < NAMING_DRIFT
    };
  }

  function view(entry, store) {
    const packet = entry.packet;
    const stats = statsOf(entry);
    const shown = {
      schema: packet.schema, Phi: packet.Phi, eps: packet.eps, mu: packet.mu, glyph: packet.glyph,
      angle: packet.angle, angle_degrees: packet.angle_degrees, phase_name: packet.phase_name,
      provenance: packet.provenance, eps0: packet.eps0, mu_init: packet.mu_init,
      eps_proposal: packet.eps_proposal, mu_proposal: packet.mu_proposal, how: packet.how, authority: packet.authority
    };
    return {
      word: entry.word, tier: entry.tier, known: false, usable: entry.tier === 'promoted', source: 'growth',
      packet: shown, Phi: packet.Phi, phase_name: packet.phase_name, glyph: packet.glyph,
      angle_degrees: packet.angle_degrees, eps: packet.eps, mu: packet.mu, provenance: packet.provenance,
      forbidden_5_to_8: packet.forbidden_5_to_8, letter_phases: packet.letter_phases.slice(),
      uses: entry.uses.length,
      uses_detail: entry.uses.map(function (use) {
        return {
          content_id: use.content_id, contributor: use.contributor, timestamp: use.timestamp,
          question: use.question, C: use.C, echo: use.echo, drift: use.drift, counts: use.question === entry.question
        };
      }),
      c_min: stats.cMin, echo_min: stats.echoMin, drift_max: stats.driftMax, questions_match: stats.questionsMatch,
      promoted: entry.tier === 'promoted', sealed: entry.sealed, quarantined: entry.tier === 'quarantine',
      denied: entry.tier === 'denied', chi: entry.chi, hard_stop: entry.hard_stop, mask_hit: entry.mask_hit,
      content_id: entry.content_id, input_id: entry.birth_input_id, contributor: entry.contributor,
      timestamp: entry.timestamp, question: entry.question, naming_phi: stats.namingPhi,
      naming_echo: stats.namingEcho, naming_drift: stats.namingDrift, seal_rule: entry.seal_rule,
      seal_sha256: entry.seal_sha256, archive_kind: entry.archive_kind, archive_rule: entry.archive_rule,
      archive_sha256: entry.archive_sha256, chain_ok: chainOk(store)
    };
  }

  function knownView(token) {
    const row = Ppe.word(token);
    return {
      word: row.word, known: true, tier: 'lexicon', source: 'seed', usable: true,
      Phi: row.Phi, phase_name: row.phase_name
    };
  }

  function archiveQuarantine(store, entry, use) {
    if (entry.archive_kind) return;
    const phase = entry.packet.Phi;
    if (!(phase >= 1 && phase <= 9)) {
      entry.archive_rule = 'DPA-PHASE';
      return;
    }
    const appended = Dpa.appendDeadPath(store.archive, {
      id: 'quarantine:' + entry.word, psi: entry.content_id, phase: phase,
      ts: use.timestamp, entropy: use.drift, epsilon_s: use.drift, reason: 'quarantine'
    });
    entry.archive_kind = appended.ok ? 'dead_path' : null;
    entry.archive_rule = appended.rule;
    entry.archive_sha256 = appended.record ? appended.record.sha256 : null;
  }

  function sealName(store, entry, stats) {
    if (entry.sealed) return;
    const appended = Dpa.sealLoop(store.archive, {
      id: 'lexicon:' + entry.word, psi: entry.content_id, phase: entry.packet.Phi,
      ts: entry.uses[entry.uses.length - 1].timestamp, entropy: stats.driftMax, epsilon_s: stats.driftMax,
      echo: stats.echoMin, question: entry.question
    });
    entry.seal_rule = appended.rule;
    entry.sealed = !!appended.ok;
    entry.seal_sha256 = appended.record ? appended.record.sha256 : null;
    if (appended.ok) {
      entry.archive_kind = 'sealed_loop';
      entry.archive_rule = appended.rule;
      entry.archive_sha256 = appended.record.sha256;
    }
  }

  function evaluate(store, entry) {
    if (entry.tier === 'quarantine' || entry.tier === 'denied') return;
    const stats = statsOf(entry);
    const hard = entry.uses.some(function (use) { return use.drift > HARD_STOP; });
    if (stats.driftMax > WRITE_MAX) {
      entry.tier = 'quarantine';
      entry.chi = true;
      entry.hard_stop = hard;
      archiveQuarantine(store, entry, entry.uses[entry.uses.length - 1]);
      return;
    }
    if (entry.uses.some(function (use) { return use.mask_hit; })) {
      entry.tier = 'denied';
      entry.mask_hit = true;
      entry.hard_stop = false;
      entry.chi = false;
      return;
    }
    entry.hard_stop = false;
    entry.chi = false;
    const ready = !entry.packet.forbidden_5_to_8 && entry.uses.length >= USES_MIN && stats.cMin >= C_MIN && stats.namingEcho && stats.driftMax < MEMORY_DRIFT && entry.packet.Phi >= 1;
    entry.tier = ready ? 'promoted' : 'provisional';
    if (ready && stats.namingPhi && stats.namingEcho && stats.namingDrift) sealName(store, entry, stats);
  }

  function classify(store, text) {
    const known = [];
    const novel = [];
    uniqueTokens(text).forEach(function (token) {
      if (Lex.seedRows()[token]) known.push(knownView(token));
      else novel.push(token);
    });
    return { known: known, novel: novel };
  }

  function observe(store, spec) {
    const body = spec || {};
    const text = String(body.text == null ? '' : body.text);
    const question = body.question == null ? text : String(body.question);
    const contributor = body.contributor ? String(body.contributor) : 'user';
    const timestamp = body.timestamp ? String(body.timestamp) : '1970-01-01T00:00:00Z';
    const measuredC = num(body.C, 0);
    const echo = num(body.echo, 0);
    const drift = num(body.drift, 0);
    const collapsed = Array.isArray(body.collapsed) ? body.collapsed : [];
    const contentId = sha256(text);
    const split = classify(store, text);
    if (store.seen[contentId]) {
      return Object.assign({
        idempotent: true, content_id: contentId, text: text,
        words: split.novel.filter(function (token) { return store.words[token]; }).map(function (token) { return view(store.words[token], store); }),
        known: split.known
      }, flags());
    }
    store.seen[contentId] = true;
    split.novel.forEach(function (token) {
      if (!store.words[token]) {
        store.words[token] = {
          word: token, tier: 'provisional', packet: birthPacket(token), uses: [],
          contributor: contributor, timestamp: timestamp, question: question, birth_input_id: contentId,
          content_id: sha256('growth\n' + token), sealed: false, seal_rule: null, seal_sha256: null,
          archive_kind: null, archive_rule: null, archive_sha256: null, chi: false, hard_stop: false, mask_hit: false
        };
      }
      const entry = store.words[token];
      const mask = V43.driftMask(token, collapsed);
      entry.uses.push({
        content_id: contentId, contributor: contributor, timestamp: timestamp, question: question,
        C: measuredC, echo: echo, drift: drift, mask_hit: !!mask.hit
      });
      if (mask.hit) entry.mask_hit = true;
      evaluate(store, entry);
    });
    return Object.assign({
      idempotent: false, content_id: contentId, text: text,
      words: split.novel.map(function (token) { return view(store.words[token], store); }),
      known: split.known
    }, flags());
  }

  function recall(store, probe) {
    const body = probe || {};
    let phi = null;
    let probeWord = '';
    if (body.phi != null && body.phi !== '') {
      const n = Number(body.phi);
      if (n >= 1 && n <= 9) phi = n;
    } else if (body.text) {
      const tokens = Lex.tokens(body.text);
      probeWord = tokens[0] || '';
      if (probeWord) phi = Ppe.word(probeWord).Phi;
    }
    const hits = [];
    Object.keys(store.words).sort().forEach(function (word) {
      const entry = store.words[word];
      if (entry.tier !== 'promoted') return;
      if (!aligned(phi, entry.packet.Phi)) return;
      hits.push({
        word: entry.word, Phi: entry.packet.Phi, phase_name: entry.packet.phase_name, glyph: entry.packet.glyph,
        eps: entry.packet.eps, mu: entry.packet.mu, provenance: entry.packet.provenance, tier: entry.tier, usable: true
      });
    });
    return Object.assign({
      phi: phi, probe_word: probeWord, method: 'phase_align', keyword_rank: false, window: 'π/4', hits: hits
    }, flags());
  }

  function place(store, word) {
    const key = String(word || '').toLowerCase();
    if (!key) {
      return Object.assign({
        word: '', source: 'absent', usable: false, tier: null, Phi: null, phase_name: null, glyph: '',
        eps: null, mu: null, provenance: null, angle_degrees: null, forbidden_5_to_8: false, sealed: false
      }, flags());
    }
    if (Lex.seedRows()[key]) {
      const row = Ppe.word(key);
      return Object.assign({
        word: key, source: 'seed', usable: true, tier: 'lexicon', Phi: row.Phi, phase_name: row.phase_name,
        glyph: row.glyph || '', eps: row.eps, mu: row.mu, provenance: row.provenance,
        angle_degrees: row.angle_degrees, forbidden_5_to_8: !!row.forbidden_5_to_8, sealed: false
      }, flags());
    }
    const entry = store.words[key];
    if (!entry) {
      return Object.assign({
        word: key, source: 'absent', usable: false, tier: null, Phi: null, phase_name: null, glyph: '',
        eps: null, mu: null, provenance: null, angle_degrees: null, forbidden_5_to_8: false, sealed: false
      }, flags());
    }
    return Object.assign({
      word: key, source: 'growth', usable: entry.tier === 'promoted', tier: entry.tier, Phi: entry.packet.Phi,
      phase_name: entry.packet.phase_name, glyph: entry.packet.glyph, eps: entry.packet.eps, mu: entry.packet.mu,
      provenance: entry.packet.provenance, angle_degrees: entry.packet.angle_degrees,
      forbidden_5_to_8: entry.packet.forbidden_5_to_8, sealed: entry.sealed
    }, flags());
  }

  function save(store, backend) {
    const raw = JSON.stringify(store);
    if (backend && typeof backend.set === 'function') backend.set(STORAGE_KEY, raw);
    return raw;
  }

  function load(raw, backend) {
    let text = raw;
    if ((text == null || text === '') && backend && typeof backend.get === 'function') text = backend.get(STORAGE_KEY);
    if (!text) return empty();
    try {
      const parsed = JSON.parse(text);
      if (!parsed || parsed.schema !== 'FORGE-LEXICON-GROWTH/v1' || !parsed.words || !parsed.archive) return empty();
      if (!parsed.seen) parsed.seen = {};
      return parsed;
    } catch (e) {
      return empty();
    }
  }

  function script(steps) {
    let store = empty();
    const log = [];
    (steps || []).forEach(function (step) {
      const op = step && step.op;
      if (op === 'observe') log.push(Object.assign({ op: 'observe' }, observe(store, step)));
      else if (op === 'recall') log.push(Object.assign({ op: 'recall' }, recall(store, step)));
      else if (op === 'place') log.push(Object.assign({ op: 'place' }, place(store, step.word)));
      else if (op === 'restart') {
        const raw = save(store, null);
        store = load(raw, null);
        log.push({ op: 'restart', words: Object.keys(store.words).sort(), chain_ok: chainOk(store) });
      }
    });
    return Object.assign({
      log: log,
      words: Object.keys(store.words).sort().map(function (word) { return view(store.words[word], store); })
    }, flags(), { store: store });
  }

  function publicScript(steps) {
    const ran = script(steps);
    const copy = Object.assign({}, ran);
    delete copy.store;
    return copy;
  }

  function stage(question) {
    const split = classify(empty(), question || '');
    const novel = [];
    split.novel.forEach(function (token) {
      if (novel.length >= 6) return;
      const packet = birthPacket(token);
      novel.push({
        word: packet.word, Phi: packet.Phi, phase_name: packet.phase_name, glyph: packet.glyph,
        angle: packet.angle, angle_degrees: packet.angle_degrees, eps: packet.eps, mu: packet.mu,
        provenance: packet.provenance, eps0: packet.eps0, mu_init: packet.mu_init,
        forbidden_5_to_8: packet.forbidden_5_to_8, tier: 'provisional'
      });
    });
    return Object.assign({
      question: String(question || ''), novel: novel, known: split.known.map(function (row) { return row.word; }),
      novel_count: split.novel.length, known_count: split.known.length, persisted: false,
      provenance: PROVENANCE, eps0: 0, mu_init: 1, angle: ANGLE, cite: CITE
    }, flags());
  }

  function showNum(value) {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (value == null) return 'none';
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
      return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    }
    return String(value);
  }

  function obs(text, question, timestamp, measuredC, echo, drift, collapsed) {
    return {
      op: 'observe', text: text, question: question, contributor: 'nic', timestamp: timestamp,
      C: measuredC, echo: echo, drift: drift, collapsed: collapsed || []
    };
  }

  function runDemo(mode) {
    if (mode === 'promote') {
      const ran = script([
        obs('create hnv', 'what is hnv', '2026-10-30T18:00:00Z', 0.9, 0.9, 0.19),
        obs('hnv.', 'what is hnv', '2026-10-30T18:00:01Z', 0.9, 0.9, 0.19)
      ]);
      const word = ran.words.filter(function (row) { return row.word === 'hnv'; })[0];
      return {
        persist: true, store: ran.store,
        attrs: { mode: 'promote', status: word.tier, detail: word.sealed ? 'sealed' : 'open' },
        lines: [
          'hnv uses ' + word.uses + ' tier ' + word.tier + ' sealed ' + showNum(word.sealed) + '.',
          'Φ' + word.Phi + ' ' + word.phase_name + ' glyph ' + word.glyph + ' θ ' + showNum(word.angle_degrees) + '° ε ' + showNum(word.eps) + ' μ ' + showNum(word.mu) + ' ' + word.provenance + '.',
          'Naming gate Φ ' + showNum(word.naming_phi) + ' echo ' + showNum(word.naming_echo) + ' drift ' + showNum(word.naming_drift) + '.',
          'Seal ' + (word.seal_sha256 || 'none') + ' rule ' + (word.seal_rule || 'none') + ' chain ' + showNum(word.chain_ok) + '.',
          'Contributor ' + word.contributor + ' input ' + word.input_id + ' at ' + word.timestamp + '.',
          'This card does not admit. C_min 0.87. No LLM.'
        ]
      };
    }
    if (mode === 'quarantine') {
      const ran = script([
        obs('zz', 'what is zz', '2026-10-30T18:01:00Z', 0.9, 0.9, 0.36),
        obs('ep', 'what is ep', '2026-10-30T18:01:01Z', 0.9, 0.9, 0.1),
        obs('ep.', 'what is ep', '2026-10-30T18:01:02Z', 0.9, 0.9, 0.1),
        obs('qq', 'what is qq', '2026-10-30T18:01:03Z', 0.9, 0.9, 0.1, ['qq']),
        obs('qq.', 'what is qq', '2026-10-30T18:01:04Z', 0.9, 0.9, 0.1, ['qq'])
      ]);
      const zz = ran.words.filter(function (row) { return row.word === 'zz'; })[0];
      const ep = ran.words.filter(function (row) { return row.word === 'ep'; })[0];
      const qq = ran.words.filter(function (row) { return row.word === 'qq'; })[0];
      return {
        persist: true, store: ran.store,
        attrs: { mode: 'quarantine', status: zz.tier, detail: qq.tier },
        lines: [
          'zz drift ' + showNum(zz.drift_max) + ' tier ' + zz.tier + ' χ ' + showNum(zz.chi) + ' ChristPing started ' + showNum(ran.christping_started) + '.',
          'Dead path ' + (zz.archive_rule || 'none') + ' chain ' + showNum(zz.chain_ok) + ' promoted ' + showNum(zz.promoted) + '.',
          'ep forbidden ' + showNum(ep.forbidden_5_to_8) + ' tier ' + ep.tier + ' promoted ' + showNum(ep.promoted) + '.',
          'qq mask ' + showNum(qq.mask_hit) + ' tier ' + qq.tier + ' promoted ' + showNum(qq.promoted) + '.',
          'This card does not admit. C_min 0.87. No LLM.'
        ]
      };
    }
    if (mode === 'recall') {
      const ran = script([
        obs('hnv', 'what is hnv', '2026-10-30T18:02:00Z', 0.9, 0.9, 0.19),
        obs('hnv.', 'what is hnv', '2026-10-30T18:02:01Z', 0.9, 0.9, 0.19),
        { op: 'recall', text: 'h' },
        { op: 'recall', text: 'zzzz' },
        { op: 'place', word: 'hnv' },
        { op: 'place', word: 'create' }
      ]);
      const near = ran.log[2];
      const far = ran.log[3];
      const placed = ran.log[4];
      const seeded = ran.log[5];
      const nearHit = near.hits.map(function (hit) { return hit.word; }).join(', ') || 'none';
      const farHit = far.hits.map(function (hit) { return hit.word; }).join(', ') || 'none';
      return {
        persist: true, store: ran.store,
        attrs: { mode: 'recall', status: nearHit, detail: far.method },
        lines: [
          'Probe ' + near.probe_word + ' phase Φ' + showNum(near.phi) + '. Hits ' + nearHit + '. Method phase align. Keyword rank ' + showNum(near.keyword_rank) + '.',
          'Probe ' + far.probe_word + ' phase Φ' + showNum(far.phi) + '. Hits ' + farHit + '.',
          'hnv placement usable ' + showNum(placed.usable) + ' ε ' + showNum(placed.eps) + ' μ ' + showNum(placed.mu) + '.',
          'create placement source ' + seeded.source + ' usable ' + showNum(seeded.usable) + '.',
          'This card does not admit. C_min 0.87. No LLM.'
        ]
      };
    }
    if (mode === 'restart') {
      const ran = script([
        obs('hnv', 'what is hnv', '2026-10-30T18:03:00Z', 0.9, 0.9, 0.19),
        obs('hnv.', 'what is hnv', '2026-10-30T18:03:01Z', 0.9, 0.9, 0.19),
        { op: 'restart' },
        obs('hnv', 'what is hnv', '2026-10-30T18:03:00Z', 0.9, 0.9, 0.19)
      ]);
      const word = ran.words.filter(function (row) { return row.word === 'hnv'; })[0];
      const replay = ran.log[ran.log.length - 1];
      return {
        persist: true, store: ran.store,
        attrs: { mode: 'restart', status: word.tier, detail: showNum(replay.idempotent) },
        lines: [
          'Round trip keeps ' + word.word + ' tier ' + word.tier + ' sealed ' + showNum(word.sealed) + ' uses ' + word.uses + '.',
          'Replay idempotent ' + showNum(replay.idempotent) + ' uses ' + replay.words[0].uses + '.',
          'Chain ' + showNum(word.chain_ok) + '. Local key ' + STORAGE_KEY + '.',
          'This card does not admit. C_min 0.87. No LLM.'
        ]
      };
    }
    const ran = script([obs('create hnv', 'what is hnv', '2026-10-30T18:00:00Z', 0.9, 0.9, 0.1)]);
    const word = ran.words.filter(function (row) { return row.word === 'hnv'; })[0];
    const known = ran.log[0].known[0];
    return {
      persist: false, store: ran.store,
      attrs: { mode: 'packets', status: word.tier, detail: word.phase_name },
      lines: [
        'Known ' + known.word + ' stays in the seed lexicon.',
        'Novel ' + word.word + ' tier ' + word.tier + ' Φ' + word.Phi + ' ' + word.phase_name + ' glyph ' + word.glyph + ' θ ' + showNum(word.angle_degrees) + '° ε ' + showNum(word.eps) + ' μ ' + showNum(word.mu) + ' ' + word.provenance + '.',
        'Birth ε ' + showNum(word.packet.eps0) + ' μ ' + showNum(word.packet.mu_init) + '. Uses ' + word.uses + '. Promoted ' + showNum(word.promoted) + '.',
        'Input ' + word.input_id + ' contributor ' + word.contributor + ' at ' + word.timestamp + '.',
        'This card does not admit. C_min 0.87. No LLM.'
      ]
    };
  }

  function monitorLines(mode) {
    const ran = runDemo(mode || 'packets');
    return { attrs: ran.attrs, lines: ran.lines };
  }

  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('growth198');
    const host = document.getElementById('growth198Body');
    if (!card || !host) return;
    const ran = runDemo(mode || 'packets');
    card.setAttribute('data-growth198-mode', ran.attrs.mode);
    card.setAttribute('data-growth198-status', ran.attrs.status);
    card.setAttribute('data-growth198-detail', ran.attrs.detail);
    host.textContent = ran.lines.join('\n');
    if (ran.persist && typeof localStorage !== 'undefined') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ran.store)); } catch (e) { /* private mode */ }
    }
  }

  function restoredLines(store) {
    const words = Object.keys(store.words || {}).sort().map(function (word) { return view(store.words[word], store); });
    const head = words[0];
    return {
      attrs: { mode: 'restored', status: head ? head.tier : 'empty', detail: String(words.length) },
      lines: [
        'Restored ' + words.length + ' local words from ' + STORAGE_KEY + '.',
        head ? (head.word + ' tier ' + head.tier + ' sealed ' + showNum(head.sealed) + ' uses ' + head.uses + '.') : 'No words stored.',
        'Chain ' + showNum(head ? head.chain_ok : true) + '. This card does not admit. No LLM.'
      ]
    };
  }

  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('growth198')) return;
    let restored = null;
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) restored = load(localStorage.getItem(STORAGE_KEY), null);
    } catch (e) { restored = null; }
    if (restored && Object.keys(restored.words || {}).length) {
      const viewRestored = restoredLines(restored);
      const card = document.getElementById('growth198');
      const host = document.getElementById('growth198Body');
      card.setAttribute('data-growth198-mode', viewRestored.attrs.mode);
      card.setAttribute('data-growth198-status', viewRestored.attrs.status);
      card.setAttribute('data-growth198-detail', viewRestored.attrs.detail);
      host.textContent = viewRestored.lines.join('\n');
    } else paintMonitor('packets');
    const buttons = document.querySelectorAll('[data-growth198-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-growth198-run'));
      });
    }
  }

  function run(payload) {
    const row = payload || {};
    const op = row.op || 'summary';
    if (op === 'script') return publicScript(row.steps || []);
    if (op === 'stage') return stage(row.question);
    if (op === 'monitor') return monitorLines(row.mode || 'packets');
    if (op === 'recall') return recall(empty(), row);
    return Object.assign({
      storage_key: STORAGE_KEY, provenance: PROVENANCE, angle: ANGLE, cite: CITE, seeds: Lex.wordCount()
    }, flags());
  }

  const api = {
    CITE: CITE, PROVENANCE: PROVENANCE, STORAGE_KEY: STORAGE_KEY, empty: empty, observe: observe,
    recall: recall, place: place, save: save, load: load, script: publicScript, stage: stage,
    monitorLines: monitorLines, paintMonitor: paintMonitor, run: run, aligned: aligned
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Growth198 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
