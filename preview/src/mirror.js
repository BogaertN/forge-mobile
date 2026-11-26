/* Mirror reads verified turn receipts and says what it would expect next.
 * Counts only. It does not lower a gate, change the two-publisher rule, touch Gilligan, or write code.
 * n* = 27 is a recursion-depth cap. The log records the depth actually used. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const N_STAR = 27;
  function counts(rows) {
    const out = { route: {}, gate: {}, recall: { hit: 0, miss: 0 }, refuted: 0, n: 0 };
    for (const row of rows || []) {
      if (!row || row.verified !== true) continue;
      out.n += 1;
      const route = String(row.route || 'held');
      out.route[route] = (out.route[route] || 0) + 1;
      const gate = row.gate === 'admit' ? 'admit' : 'hold';
      out.gate[gate] = (out.gate[gate] || 0) + 1;
      if (row.recall_hit === true) out.recall.hit += 1;
      else out.recall.miss += 1;
      if (row.refuted === true) out.refuted += 1;
    }
    return out;
  }
  function top(map) {
    const keys = Object.keys(map || {});
    keys.sort((a, b) => (map[b] - map[a]) || (a < b ? -1 : a > b ? 1 : 0));
    return keys[0] || null;
  }
  function predict(rows) {
    const c = counts(rows);
    const recallN = c.recall.hit + c.recall.miss;
    return {
      route: top(c.route),
      recall_hit: recallN ? c.recall.hit / recallN >= 0.5 : null,
      gate: top(c.gate),
      refutation_risk: c.n ? c.refuted / c.n : 0,
      from: c.n,
      calls_llm: false,
      changes_gates: false
    };
  }
  function splitByDate(rows, at) {
    const train = [], held = [];
    for (const row of rows || []) {
      if (!row || row.verified !== true) continue;
      if (String(row.at || '') < String(at || '')) train.push(row);
      else held.push(row);
    }
    return { train, held };
  }
  function scoreHeldOut(rows, at) {
    const parts = splitByDate(rows, at);
    const guess = predict(parts.train);
    let route = 0, gate = 0, n = 0;
    for (const row of parts.held) {
      n += 1;
      if (guess.route && row.route === guess.route) route += 1;
      const g = row.gate === 'admit' ? 'admit' : 'hold';
      if (guess.gate && g === guess.gate) gate += 1;
    }
    return { train: parts.train.length, held: n, route_hits: route, gate_hits: gate, prediction: guess, calls_llm: false };
  }
  function ablate(receipts) {
    const out = [];
    const rows = receipts || [];
    for (let i = 0; i < rows.length; i++) {
      const kept = rows.filter((_, j) => j !== i);
      const premises = kept.filter(r => r && r.role === 'premise').length;
      out.push({ dropped: rows[i] && rows[i].id, premises_left: premises, gate: rows[i] && rows[i].gate, still_supported: premises > 0, calls_llm: false });
    }
    return { drops: out, changes_gates: false, calls_llm: false };
  }
  function blocked(ledger, pathHash) {
    const hit = (ledger || []).find(e => e && (e.path_hash === pathHash || (e.reason && e.reason.path_hash === pathHash)));
    return { blocked: !!hit, path_hash: pathHash || null, status: hit ? hit.status : null, calls_llm: false };
  }
  function suggest(rows) {
    const c = counts(rows);
    const routes = Object.keys(c.route).sort((a, b) => (c.route[b] - c.route[a]) || (a < b ? -1 : 1));
    return {
      on: true,
      route_priority: routes,
      gap_priority: c.refuted ? ['refuted_path', 'unanswered'] : ['unanswered'],
      hypotheses: routes.slice(0, 3).map(route => ({ rule: 'prefer route ' + route + ' when the verified count leads', status: 'needs_approval', writes_code: false, changes_gates: false })),
      changes_gates: false,
      writes_code: false,
      calls_llm: false
    };
  }
  function depth(n) {
    const asked = Math.max(0, Number(n) || 0);
    const used = Math.min(asked, N_STAR);
    return { cap: N_STAR, depth: used, stopped: asked > N_STAR, calls_llm: false };
  }
  const api = { N_STAR, counts, predict, scoreHeldOut, ablate, blocked, suggest, depth, off: () => ({ on: false, route_priority: [], hypotheses: [], changes_gates: false, calls_llm: false }) };
  if (isNode) module.exports = api; else root.KMirror = api;
})(typeof self !== 'undefined' ? self : this);
