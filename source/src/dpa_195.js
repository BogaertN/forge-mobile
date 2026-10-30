/* 4.9.195 write-once Dead Path Archive and sealed loop records. Stdlib. No LLM.
 * Append-only. A rewrite is rejected. Nothing is erased.
 * The SHA-256 seal is Codex 3.3: ψ, phase, ts, Codex hash, entropy.
 * The fork decision is ledger.js (GenNode Doc 12). This module seals that decision.
 * It does not admit. C_min and Echo stay the v4.3 law constants. */
(function (root) {
  const KM = (typeof module !== 'undefined' && module.exports) ? require('./kmath.js') : root.KMath;
  const SHA = (typeof module !== 'undefined' && module.exports) ? require('./sha256.js') : root.KSha;
  const V43 = (typeof module !== 'undefined' && module.exports) ? require('./drift_v43.js') : root.DriftV43;
  const LG = (typeof module !== 'undefined' && module.exports) ? require('./ledger.js') : root.KLedger;
  const sha256 = SHA.sha256;
  const LAW = V43.score({ payload: { v: 1 }, prev_phase: 1, recursion_n: 1 }).laws;
  const C_MIN = LAW.C_min;
  const ECHO_MIN = LAW.echo_min;
  const CODEX_ID = 'AIWEB-GIL-CODEX-IV-001';
  const CODEX_HASH = sha256(CODEX_ID);
  const CITE = 'GN Doc 1 dead path archive is append-only. Grace before archival; never erase (RSOC axioms, READ192). Sealed signature is SHA-256 of ψ, phase, ts, Codex hash, and entropy (Gilligan Codex 3.3, a.c l.1611–1624). Codex 3.17 is the tamper-proof chain. A fork keeps the existing verified chain (GenNode Doc 12, ledger.js) and the resolution is sealed. Doc 11 carries sealed loops and dead paths only. Echo below the v4.3 minimum is not sealed. C_min stays 0.87. No LLM.';
  const DEMO_DEVICE = 'dev-0102030405060708';
  const T0 = '2026-10-30T16:00:00Z';
  const T1 = '2026-10-30T16:00:01Z';
  const T2 = '2026-10-30T16:00:02Z';

  const canon = o => (Array.isArray(o) ? '[' + o.map(canon).join(',') + ']' : o && typeof o === 'object' ? '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}' : JSON.stringify(o));

  function flags() {
    return {
      admit_gate: false,
      writes: false,
      calls_llm: false,
      money: false,
      dream_idle: false,
      economy: false,
      packs_gated: true,
      christping: 'gilligan-only',
      wikipedia_anchor: false,
      c_min: C_MIN,
      echo_min: ECHO_MIN
    };
  }
  function phaseName(n) {
    return KM.CANONICAL_PHASE_NAMES[n] || null;
  }
  function classify(epsilon_s, transition) {
    const breaker = KM.driftCircuitBreaker(epsilon_s, transition || null, []);
    const n = typeof epsilon_s === 'number' && isFinite(epsilon_s) ? epsilon_s : null;
    return Object.assign({
      dead: breaker.consecutive_failures >= 1,
      breaker_reason: breaker.reason,
      tripped: breaker.tripped,
      consecutive_failures: breaker.consecutive_failures,
      hard_stop: breaker.reason === 'hard_stop',
      forbidden_step: breaker.reason === 'forbidden_step',
      spc_above_0_5: n != null && n > 0.5,
      spc_logged_only: true,
      cite: CITE
    }, flags());
  }
  function emptyArchive() {
    return { schema: 'FORGE-DPA/v1', dead_paths: [], sealed_loops: [], resolutions: [] };
  }
  function listOf(archive, kind) {
    if (kind === 'sealed_loop') return archive.sealed_loops;
    if (kind === 'ledger_fork') return archive.resolutions;
    return archive.dead_paths;
  }
  function loopSignature(body) {
    return sha256(canon({
      psi: String(body.psi),
      phase: body.phase,
      ts: String(body.ts),
      codex_hash: CODEX_HASH,
      entropy: body.entropy
    }));
  }
  function forkSignature(body) {
    return sha256(canon({
      device: body.device,
      fork_seq: body.fork_seq,
      ours: body.ours,
      theirs: body.theirs,
      kept: 'existing'
    }));
  }
  function linkBody(row) {
    const body = { seq: row.seq, prev: row.prev, id: row.id, kind: row.kind, signature: row.signature };
    if (row.phase_name != null) body.phase_name = row.phase_name;
    if (row.question != null) body.question = row.question;
    if (row.epsilon_s != null) body.epsilon_s = row.epsilon_s;
    if (row.reason != null) body.reason = row.reason;
    if (row.echo != null) body.echo = row.echo;
    return body;
  }
  function linkHash(row) {
    return sha256(canon(linkBody(row)));
  }
  function expectedSignature(row) {
    if (row.kind === 'ledger_fork') return forkSignature(row);
    return loopSignature(row);
  }
  function verifyList(records) {
    let prev = 'genesis';
    const rows = records || [];
    for (let i = 0; i < rows.length; i++) {
      const e = rows[i];
      if (e.seq !== i + 1) return { ok: false, at: i, why: 'DPA-SEQ-GAP', head: prev };
      if (e.prev !== prev) return { ok: false, at: i, why: 'DPA-PREV-MISMATCH', head: prev };
      if (e.kind !== 'ledger_fork' && e.codex_hash !== CODEX_HASH) return { ok: false, at: i, why: 'DPA-CODEX-HASH', head: prev };
      if (expectedSignature(e) !== e.signature) return { ok: false, at: i, why: 'DPA-SIGNATURE-MISMATCH', head: prev };
      if (linkHash(e) !== e.sha256) return { ok: false, at: i, why: 'DPA-HASH-MISMATCH', head: prev };
      prev = e.sha256;
    }
    return { ok: true, n: rows.length, head: prev, why: null, at: null };
  }
  function verifyArchive(archive) {
    const dead = verifyList(archive && archive.dead_paths);
    const loops = verifyList(archive && archive.sealed_loops);
    const forks = verifyList(archive && archive.resolutions);
    return {
      ok: !!(dead.ok && loops.ok && forks.ok),
      dead_paths: dead,
      sealed_loops: loops,
      resolutions: forks,
      cite: CITE
    };
  }
  function reject(rule) {
    return Object.assign({ ok: false, rule: rule, archived: false, record: null }, flags());
  }
  function appendRow(archive, kind, fields) {
    const list = listOf(archive, kind);
    if (list.some(function (row) { return row.id === fields.id; })) return reject('DPA-REWRITE-REJECTED');
    const seq = list.length + 1;
    const prev = list.length ? list[list.length - 1].sha256 : 'genesis';
    const row = Object.assign({ seq: seq, prev: prev, kind: kind, codex_hash: kind === 'ledger_fork' ? undefined : CODEX_HASH }, fields);
    if (kind === 'ledger_fork') row.signature = forkSignature(row);
    else row.signature = loopSignature(row);
    row.sha256 = linkHash(row);
    list.push(row);
    return Object.assign({ ok: true, rule: 'DPA-APPENDED', archived: true, record: row }, flags());
  }
  function appendDeadPath(archive, spec) {
    const body = spec || {};
    const gate = classify(body.epsilon_s, body.from == null && body.to == null ? null : { from: body.from, to: body.to });
    if (!gate.dead) return Object.assign(reject('DPA-NOT-DEAD'), { classify: gate });
    const phase = body.phase;
    const name = phaseName(phase);
    if (!name) return reject('DPA-PHASE');
    if (!body.id || body.psi == null || body.ts == null || body.entropy == null) return reject('DPA-FIELDS');
    const appended = appendRow(archive, 'dead_path', {
      id: String(body.id),
      psi: String(body.psi),
      phase: phase,
      phase_name: name,
      ts: String(body.ts),
      entropy: body.entropy,
      epsilon_s: body.epsilon_s,
      reason: String(body.reason || 'write-law')
    });
    if (appended.ok) appended.classify = gate;
    return appended;
  }
  function sealLoop(archive, spec) {
    const body = spec || {};
    const step = body.from == null && body.to == null ? null : { from: body.from, to: body.to };
    const gate = classify(body.epsilon_s, step);
    if (gate.forbidden_step || gate.dead) return Object.assign(reject('SEAL-REFUSED-DEAD-PATH'), { classify: gate });
    if (typeof body.echo !== 'number' || !(body.echo >= ECHO_MIN)) return Object.assign(reject('SEAL-ECHO-BELOW-MIN'), { echo: body.echo == null ? null : body.echo });
    if (!body.question) return reject('SEAL-QUESTION-REQUIRED');
    const name = phaseName(body.phase);
    if (!name) return reject('DPA-PHASE');
    if (!body.id || body.psi == null || body.ts == null || body.entropy == null) return reject('DPA-FIELDS');
    const appended = appendRow(archive, 'sealed_loop', {
      id: String(body.id),
      psi: String(body.psi),
      phase: body.phase,
      phase_name: name,
      ts: String(body.ts),
      entropy: body.entropy,
      epsilon_s: body.epsilon_s,
      echo: body.echo,
      question: String(body.question),
      reason: 'sealed'
    });
    if (appended.ok) appended.classify = gate;
    return appended;
  }
  function erase() {
    return Object.assign(reject('DPA-ERASE-REJECTED'), { cite: CITE });
  }
  function ledgerEntry(device, seq, prev, payload, at) {
    const e = {
      device: device,
      seq: seq,
      prev: prev,
      kind: 'memory_write',
      payload_sha256: sha256(canon(payload)),
      at: at
    };
    e.hash = LG.entryHash(e);
    return e;
  }
  function demoChains() {
    const first = ledgerEntry(DEMO_DEVICE, 1, 'genesis', { n: 1 }, T0);
    const second = ledgerEntry(DEMO_DEVICE, 2, first.hash, { n: 2 }, T1);
    const existing = [first, second];
    const forged = [first, {
      device: second.device,
      seq: second.seq,
      prev: second.prev,
      kind: second.kind,
      payload_sha256: 'f'.repeat(64),
      at: second.at
    }];
    forged[1].hash = LG.entryHash(forged[1]);
    const longer = existing.concat([ledgerEntry(DEMO_DEVICE, 3, second.hash, { n: 3 }, T2)]);
    return { existing: existing, forged: forged, longer: longer, device: DEMO_DEVICE };
  }
  function resolveFork(existing, incoming, archive) {
    const have = existing || [];
    const next = incoming || [];
    const vEx = LG.verifyChain(have);
    const vIn = LG.verifyChain(next);
    if (!have.length) return Object.assign(reject('LEDGER-EMPTY-EXISTING'), { resolved: false });
    if (!vEx.ok) return Object.assign({ ok: false, resolved: false, rule: vEx.why, at: vEx.at, archived: false, record: null }, flags());
    if (!vIn.ok) return Object.assign({ ok: false, resolved: false, rule: vIn.why, at: vIn.at, archived: false, record: null }, flags());
    if (have[0].device !== next[0].device) return Object.assign(reject('LEDGER-DEVICE-MISMATCH'), { resolved: false });
    const common = Math.min(have.length, next.length);
    let fork = -1;
    for (let i = 0; i < common; i++) if (have[i].hash !== next[i].hash) { fork = i; break; }
    if (fork < 0 && next.length <= have.length) {
      return Object.assign({ ok: true, resolved: true, rule: 'LEDGER-ALREADY-HAVE', archived: false, record: null, added: 0, kept: 'existing' }, flags());
    }
    if (fork < 0) {
      return Object.assign({ ok: true, resolved: true, rule: 'LEDGER-FAST-FORWARD', archived: false, record: null, added: next.length - have.length, kept: 'incoming-extension' }, flags());
    }
    const ours = have[fork].hash;
    const theirs = next[fork].hash;
    const id = 'fork:' + have[0].device + ':' + (fork + 1) + ':' + ours + ':' + theirs;
    const store = archive || emptyArchive();
    const already = store.resolutions.some(function (row) { return row.id === id; });
    if (already) {
      return Object.assign({
        ok: true, resolved: true, already: true, rule: 'LEDGER-FORK-RESOLVED', archived: false, record: null,
        fork: fork + 1, ours: ours, theirs: theirs, kept: 'existing'
      }, flags());
    }
    const appended = appendRow(store, 'ledger_fork', {
      id: id,
      device: have[0].device,
      fork_seq: fork + 1,
      ours: ours,
      theirs: theirs,
      kept: 'existing',
      reason: 'fork'
    });
    return Object.assign({
      ok: true,
      resolved: true,
      already: false,
      rule: 'LEDGER-FORK-RESOLVED',
      archived: true,
      record: appended.record,
      fork: fork + 1,
      ours: ours,
      theirs: theirs,
      kept: 'existing'
    }, flags());
  }
  function resolveWithLedger(ledger, incoming, archive) {
    const merged = ledger.merge(incoming);
    if (!merged.ok) return Object.assign({ ok: false, resolved: false, rule: merged.rule, at: merged.at, archived: false, record: null }, flags());
    if (merged.rule !== 'LEDGER-FORK-KEPT-EXISTING') {
      return Object.assign({ ok: true, resolved: true, archived: false, record: null, kept: merged.rule }, merged, flags());
    }
    const device = incoming[0].device;
    return resolveFork(ledger.foreign()[device], incoming, archive || emptyArchive());
  }
  function rewriteDemo() {
    const archive = emptyArchive();
    const first = appendDeadPath(archive, { id: 'dp-sky', psi: 'psi-sky', phase: 5, ts: T0, entropy: 0.36, epsilon_s: 0.36, reason: 'write-law' });
    const again = appendDeadPath(archive, { id: 'dp-sky', psi: 'psi-rewritten', phase: 5, ts: T1, entropy: 0.36, epsilon_s: 0.36, reason: 'rewrite' });
    const calm = appendDeadPath(archive, { id: 'dp-calm', psi: 'psi-calm', phase: 4, ts: T0, entropy: 0.1, epsilon_s: 0.35, reason: 'at-write-max' });
    const checked = verifyArchive(archive);
    return {
      first_ok: first.ok,
      first_rule: first.rule,
      kept_psi: archive.dead_paths[0] ? archive.dead_paths[0].psi : null,
      rewrite_ok: again.ok,
      rewrite_rule: again.rule,
      length: archive.dead_paths.length,
      calm_rule: calm.rule,
      chain_ok: checked.ok,
      head: checked.dead_paths.head,
      admit_gate: false,
      writes: false,
      calls_llm: false,
      money: false
    };
  }
  function tamperDemo() {
    const archive = emptyArchive();
    appendDeadPath(archive, { id: 'dp-sky', psi: 'psi-sky', phase: 5, ts: T0, entropy: 0.36, epsilon_s: 0.36, reason: 'write-law' });
    const honest = verifyArchive(archive);
    const broken = JSON.parse(JSON.stringify(archive));
    broken.dead_paths[0].psi = 'psi-tampered';
    const found = verifyArchive(broken);
    return {
      honest_ok: honest.ok,
      tamper_ok: found.ok,
      tamper_why: found.dead_paths.why,
      admit_gate: false,
      writes: false,
      calls_llm: false
    };
  }
  function sealDemo() {
    const archive = emptyArchive();
    const sealed = sealLoop(archive, { id: 'loop-sky', psi: 'psi-loop', phase: 9, ts: T2, entropy: 0.1, epsilon_s: 0.2, echo: ECHO_MIN, question: 'why is the sky blue' });
    const low = sealLoop(archive, { id: 'loop-low', psi: 'psi-low', phase: 9, ts: T2, entropy: 0.1, epsilon_s: 0.2, echo: 0.84, question: 'why is the sky blue' });
    const skip = sealLoop(archive, { id: 'loop-skip', psi: 'psi-skip', phase: 8, ts: T2, entropy: 0.1, epsilon_s: 0.1, echo: 0.9, question: 'why is the sky blue', from: 5, to: 8 });
    const again = sealLoop(archive, { id: 'loop-sky', psi: 'psi-other', phase: 9, ts: T2, entropy: 0.1, epsilon_s: 0.2, echo: 0.9, question: 'a different question' });
    const checked = verifyArchive(archive);
    return {
      seal_ok: sealed.ok,
      seal_rule: sealed.rule,
      phase_name: archive.sealed_loops[0] ? archive.sealed_loops[0].phase_name : null,
      question: archive.sealed_loops[0] ? archive.sealed_loops[0].question : null,
      low_rule: low.rule,
      skip_rule: skip.rule,
      rewrite_rule: again.rule,
      length: archive.sealed_loops.length,
      chain_ok: checked.sealed_loops.ok,
      admit_gate: false,
      writes: false,
      calls_llm: false,
      money: false
    };
  }
  function forkDemo() {
    const chains = demoChains();
    const archive = emptyArchive();
    const resolved = resolveFork(chains.existing, chains.forged, archive);
    const again = resolveFork(chains.existing, chains.forged, archive);
    const forward = resolveFork(chains.existing, chains.longer, emptyArchive());
    const broken = chains.forged.map(function (row) { return Object.assign({}, row); });
    broken[1].hash = '0'.repeat(64);
    const refused = resolveFork(chains.existing, broken, emptyArchive());
    const checked = verifyArchive(archive);
    const existingOk = LG.verifyChain(chains.existing);
    const forgedOk = LG.verifyChain(chains.forged);
    return {
      resolved: resolved.resolved,
      rule: resolved.rule,
      fork: resolved.fork,
      kept: resolved.kept,
      already: again.already,
      again_rule: again.rule,
      length: archive.resolutions.length,
      chain_ok: checked.resolutions.ok,
      forward_rule: forward.rule,
      forward_added: forward.added,
      broken_ok: refused.ok,
      broken_rule: refused.rule,
      existing_verifies: existingOk.ok,
      forged_verifies: forgedOk.ok,
      ours: resolved.ours,
      theirs: resolved.theirs,
      admit_gate: false,
      writes: false,
      calls_llm: false,
      money: false
    };
  }
  function stage(epsilon_s) {
    const gate = classify(epsilon_s, null);
    return {
      eligible: gate.dead,
      breaker_reason: gate.breaker_reason,
      spc_above_0_5: gate.spc_above_0_5,
      spc_logged_only: true,
      rewrite_rule: 'DPA-REWRITE-REJECTED',
      erase_rule: 'DPA-ERASE-REJECTED',
      fork_rule: 'LEDGER-FORK-RESOLVED',
      admit_gate: false,
      writes: false,
      calls_llm: false,
      money: false,
      c_min: C_MIN,
      echo_min: ECHO_MIN
    };
  }
  function monitorLines(mode) {
    if (mode === 'chain') {
      const row = tamperDemo();
      const seal = sealDemo();
      return {
        attrs: { mode: 'chain', status: row.honest_ok ? 'verified' : 'broken', detail: row.tamper_why },
        lines: [
          'Honest dead-path chain verifies: ' + row.honest_ok + '.',
          'A changed ψ without a new hash fails. ' + row.tamper_why + '.',
          'Sealed loop chain verifies: ' + seal.chain_ok + '. Phase ' + seal.phase_name + '.',
          'Question stays on the seal: ' + seal.question + '.',
          'Echo below ' + ECHO_MIN + ' is ' + seal.low_rule + '. Φ5 to Φ8 is ' + seal.skip_rule + '.',
          'This card does not admit. C_min ' + C_MIN + '. No LLM.'
        ]
      };
    }
    if (mode === 'fork') {
      const row = forkDemo();
      return {
        attrs: { mode: 'fork', status: row.rule, detail: 'seq-' + row.fork },
        lines: [
          'Existing chain verifies: ' + row.existing_verifies + '. Forged chain verifies: ' + row.forged_verifies + '.',
          'Fork at seq ' + row.fork + ' resolved. Kept ' + row.kept + '. Rule ' + row.rule + '.',
          'A second merge of that fork is already resolved. Length ' + row.length + '.',
          'A longer chain that shares the prefix fast-forwards. Added ' + row.forward_added + '.',
          'A broken hash is ' + row.broken_rule + ' and is not sealed as a fork.',
          'Resolution chain verifies: ' + row.chain_ok + '. No LLM.'
        ]
      };
    }
    const row = rewriteDemo();
    const gone = erase();
    return {
      attrs: { mode: 'rewrite', status: row.rewrite_rule, detail: row.kept_psi },
      lines: [
        'First append ' + row.first_rule + '. ψ kept ' + row.kept_psi + '.',
        'Rewrite of the same id is ' + row.rewrite_rule + '. Length ' + row.length + '.',
        'Drift 0.35 is ' + row.calm_rule + '. It is not a dead path.',
        'Erase is ' + gone.rule + '. The chain still verifies: ' + row.chain_ok + '.',
        'Codex 0.5 SPC trigger is log only. The write law is unchanged.',
        'This card does not write memory. C_min ' + C_MIN + '. No LLM.'
      ]
    };
  }
  function paintMonitor(mode) {
    if (typeof document === 'undefined') return;
    const card = document.getElementById('dpa195');
    const body = document.getElementById('dpa195Body');
    if (!card || !body) return;
    const view = monitorLines(mode || 'rewrite');
    card.setAttribute('data-dpa195-mode', view.attrs.mode);
    card.setAttribute('data-dpa195-status', view.attrs.status);
    card.setAttribute('data-dpa195-detail', view.attrs.detail);
    body.textContent = view.lines.join('\n');
  }
  function bootMonitor() {
    if (typeof document === 'undefined' || !document.getElementById('dpa195')) return;
    paintMonitor('rewrite');
    const buttons = document.querySelectorAll('[data-dpa195-run]');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (ev) {
        paintMonitor(ev.currentTarget.getAttribute('data-dpa195-run'));
      });
    }
  }
  function run(payload) {
    const row = payload || {};
    const op = row.op || 'rewrite';
    if (op === 'classify') return classify(row.epsilon_s, row.from == null && row.to == null ? null : { from: row.from, to: row.to });
    if (op === 'rewrite') return rewriteDemo();
    if (op === 'tamper') return tamperDemo();
    if (op === 'seal') return sealDemo();
    if (op === 'fork') return forkDemo();
    if (op === 'erase') return erase();
    if (op === 'stage') return stage(row.epsilon_s);
    if (op === 'monitor') return monitorLines(row.mode || 'rewrite');
    return rewriteDemo();
  }
  const api = {
    CITE: CITE, CODEX_ID: CODEX_ID, CODEX_HASH: CODEX_HASH, C_MIN: C_MIN, ECHO_MIN: ECHO_MIN,
    canon: canon, classify: classify, emptyArchive: emptyArchive, appendDeadPath: appendDeadPath,
    sealLoop: sealLoop, erase: erase, verifyArchive: verifyArchive, resolveFork: resolveFork,
    resolveWithLedger: resolveWithLedger, demoChains: demoChains, rewriteDemo: rewriteDemo,
    tamperDemo: tamperDemo, sealDemo: sealDemo, forkDemo: forkDemo, stage: stage,
    monitorLines: monitorLines, paintMonitor: paintMonitor, run: run, linkHash: linkHash,
    loopSignature: loopSignature
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Dpa195 = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootMonitor);
    else bootMonitor();
  }
})(typeof self !== 'undefined' ? self : this);
