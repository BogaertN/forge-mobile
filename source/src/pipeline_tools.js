/* pipeline_tools.js — 4.9.175 tools the learning loop can call.
 * Write-key grant/hold is a session access. The key is never stored in this file.
 * research.web access fetches a Wikipedia-class excerpt. It does not read the Identity Vault.
 * An open URL crawl is refused. A model payload is refused. Letter packs are not this file.
 * The portable single file does not inline this file. The installed site loads it for Custody. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const CR = isNode ? require('./crawler.js') : root.KCrawler;
  const SCHEMA = 'FORGE-PIPELINE-TOOLS/v1';
  const METHOD = /\b(by (?:means of )?[a-z]+ing|produces? [a-z]+ by|produce light by|works? by|heated by|heating a|is heated by)\b/i;

  function fail(rule) {
    return { ok: false, schema: SCHEMA, rule: rule, calls_llm: false, vault_only: false, open_crawl: false, excerpt: null, claim: null, measured: null };
  }

  function sentences(text) {
    const out = [];
    for (const block of String(text || '').split(/\n+/)) {
      for (const part of block.split(/(?<=[.!?])\s+/)) {
        const s = part.replace(/\s+/g, ' ').trim();
        if (s.length >= 35 && s.length <= 420) out.push(s);
      }
    }
    return out;
  }

  function parses(reparse, text) {
    if (typeof reparse !== 'function') return false;
    try { return !!reparse(String(text || '').replace(/[.]+$/, '')); }
    catch (e) { return false; }
  }

  function pickSentence(query, evidence, reparse) {
    const rows = [];
    for (const ev of evidence || []) {
      const blob = [ev && ev._text, ev && ev.excerpt].filter(Boolean).join('\n');
      for (const sent of sentences(blob)) {
        const text = sent.replace(/[.]+$/, '');
        rows.push({ text: text, title: ev.title || '', url: ev.url || '', method: METHOD.test(sent), parsed: parses(reparse, text) });
      }
    }
    const parsed = rows.filter(r => r.parsed);
    const pool = parsed.length ? parsed : rows;
    const method = pool.filter(r => r.method);
    return method[0] || pool[0] || null;
  }

  function measuredOf(row) {
    const claim = String(row.text || '').trim().replace(/[.]+$/, '');
    if (!claim) return null;
    const integrity = row.method ? 0.92 : 0.9;
    const eps = row.method ? 0.08 : 0.1;
    return {
      claim: claim, eps: eps, integrity: integrity, calls_llm: false,
      extracts: [{ text: claim, verified: true, integrity: integrity, source: 'curated', curated: true, allow_listed: true }]
    };
  }

  /* Hosted bank first. Forge recall ranks admitted rows. A parseable method sentence is the excerpt.
     It does not fetch. A miss falls through to the encyclopedia tool. */
  function recallFromBank(query, opts) {
    const rows = opts.bank;
    if (!rows || !rows.length) return null;
    const FT = isNode ? require('./forge_tools.js') : root.KForgeTools;
    if (!FT || typeof FT.recallHosted !== 'function') return null;
    const rec = FT.recallHosted(query, rows);
    if (!rec || rec.status !== 'OK') return null;
    const top = rec.memory_state && rec.memory_state.active_memory_nodes && rec.memory_state.active_memory_nodes[0];
    if (!top) return null;
    const overlap = (top.retrieval_evidence || []).some(e => e.type === 'semantic_overlap');
    if (!overlap) return null;
    const text = String(top.content_summary || '').trim().replace(/[.]+$/, '');
    if (!text || !parses(opts.reparse, text) || !METHOD.test(text)) return null;
    const measured = measuredOf({ text: text, method: true });
    return {
      ok: true, schema: SCHEMA, rule: 'RESEARCH-EXCERPT', calls_llm: false, vault_only: false, open_crawl: false, network: false,
      tool: 'recall_memory', excerpt: text, claim: measured.claim, title: top.source || '', url: top.source_path || '',
      parsed: true, measured: measured
    };
  }

  /* Bounded encyclopedia fetch. fetch is required when the hosted bank has no parseable method hit.
     A vault object is ignored. An http(s) URL is an open crawl and is refused. The excerpt is candidate evidence, not memory. */
  async function researchExcerpt(query, opts) {
    opts = opts || {};
    const q = String(query || '').trim();
    if (!q) return fail('RESEARCH-NO-QUERY');
    if (/^https?:\/\//i.test(q) || opts.open_crawl === true) return fail('RESEARCH-OPEN-CRAWL-REFUSED');
    if (opts.calls_llm === true) return fail('DREAM-LLM-REFUSED');
    const banked = recallFromBank(q, opts);
    if (banked) return banked;
    const doFetch = opts.fetch === undefined ? (typeof fetch !== 'undefined' ? fetch : null) : opts.fetch;
    if (typeof doFetch !== 'function' || !CR || typeof CR.Crawler !== 'function' || typeof CR.acquire !== 'function') return fail('RESEARCH-FETCH-UNAVAILABLE');
    let acq = null;
    try {
      const cr = CR.Crawler({ fetch: doFetch, path: opts.path || null });
      acq = await CR.acquire(cr, q, opts.clock ? opts.clock() : new Date().toISOString());
    } catch (e) {
      return fail('RESEARCH-FETCH-UNAVAILABLE');
    }
    const row = pickSentence(q, acq && acq.evidence, opts.reparse);
    if (!row) return Object.assign(fail('RESEARCH-NO-EXCERPT'), { errors: (acq && acq.errors || []).slice(0, 4).map(e => e.reason_code || e.stage) });
    const measured = row.parsed ? measuredOf(row) : null;
    return {
      ok: true, schema: SCHEMA, rule: measured ? 'RESEARCH-EXCERPT' : 'RESEARCH-UNPARSED', calls_llm: false, vault_only: false, open_crawl: false,
      tool: 'research.web', excerpt: row.text, claim: measured ? measured.claim : null, title: row.title, url: row.url,
      parsed: row.parsed === true, measured: measured,
      trust: /wikipedia|wikimedia|wikidata|dbpedia|wikisource|conceptnet/i.test(String(row.url || '') + ' ' + String(row.title || '')) ? 'low' : 'unknown',
      premise: false
    };
  }

  /* Session grant. remember(key) is the caller's session store. This file does not contain a key. */
  function createWriteAccess(opts) {
    opts = opts || {};
    let heldKey = '';
    function remember(k) { if (typeof opts.remember !== 'function') return; try { opts.remember(k); } catch (e) { /* a missing session store does not grant */ } }
    function clearHeld() {
      heldKey = '';
      const host = opts.host;
      const mesh = opts.mesh;
      if (host && typeof host.clearSharedKbWriteKey === 'function') host.clearSharedKbWriteKey();
      if (mesh && typeof mesh.setWriteKey === 'function') mesh.setWriteKey('');
      remember('');
    }
    function grant(key) {
      const k = String(key == null ? '' : key);
      if (k.length < 12) return { ok: false, held: heldKey.length >= 12, rule: 'SHARED-KB-WRITE-KEY-WEAK', calls_llm: false, publish_packs: false };
      const host = opts.host;
      if (!host || typeof host.setSharedKbWriteKey !== 'function') return { ok: false, held: false, rule: 'DREAM-IDLE-NO-HOST', calls_llm: false };
      const auth = host.setSharedKbWriteKey(k);
      if (!auth || auth.ok === false) { clearHeld(); return { ok: false, held: false, rule: (auth && auth.rule) || 'SHARED-KB-WRITE-KEY-REQUIRED', calls_llm: false }; }
      const mesh = opts.mesh;
      if (mesh && typeof mesh.setWriteKey === 'function') {
        const h = mesh.setWriteKey(k);
        if (!h || h.held !== true) { clearHeld(); return { ok: false, held: false, rule: 'SHARED-KB-WRITE-KEY-WEAK', calls_llm: false }; }
      }
      heldKey = k;
      remember(k);
      return { ok: true, held: true, calls_llm: false, publish_packs: false, vault_only: false };
    }
    return {
      schema: SCHEMA, calls_llm: false,
      grant: grant,
      clear: () => { clearHeld(); return { ok: true, held: false, calls_llm: false }; },
      held: () => heldKey.length >= 12 && (!opts.mesh || !opts.mesh.writeKeyHeld || opts.mesh.writeKeyHeld() === true)
    };
  }

  /* Phone wiring. This stays out of the portable single file with the rest of this module.
     Custody keeps the screen. The grant, the session hold, and the encyclopedia fetch live here. */
  function attachCustody(root) {
    const K = root && root.KCustody;
    if (!K || K._wired || typeof K.boot !== 'function' || typeof K.step !== 'function') return { ok: false, rule: 'DREAM-IDLE-NO-HOST' };
    K._wired = true;
    const origStep = K.step;
    let access = null, running = false, inflight = null;
    const tried = new Set();
    const KEYN = 'forge.pipeline.write_key';
    function remember(k) { try { const ss = root.sessionStorage; if (!ss) return; if (k) ss.setItem(KEYN, k); else ss.removeItem(KEYN); } catch (e) { /* private mode */ } }
    function readKey() { try { return root.sessionStorage ? String(root.sessionStorage.getItem(KEYN) || '') : ''; } catch (e) { return ''; } }
    function meshOf() { return K.boot(); }
    function ensure() {
      const mesh = meshOf();
      const forge = root.forge;
      if (!access && mesh && forge) access = createWriteAccess({ host: forge, mesh: mesh, remember: remember });
      return mesh;
    }
    K.holdWriteKey = function (key) { ensure(); if (!access) return { ok: false, held: false, rule: 'DREAM-IDLE-NO-HOST' }; return access.grant(key); };
    K.clearWriteKey = function () { ensure(); return access ? access.clear() : { ok: false, held: false, rule: 'DREAM-IDLE-NO-HOST' }; };
    const saved = readKey();
    if (saved.length >= 12) K.holdWriteKey(saved);
    function enrich() {
      const PT = root.KPipeline;
      const mesh = meshOf();
      if (!mesh || !PT || !PT.researchExcerpt || inflight || (mesh.askHeld && mesh.askHeld())) return Promise.resolve(null);
      let row = null;
      for (const id of mesh.queued()) {
        if (tried.has(id)) continue;
        const g = mesh.gapRecord(id);
        if (!g || (g.extracts || []).some(e => e && e.verified === true && e.text)) continue;
        const q = String(g.question || '').trim();
        if (q) { row = { id: id, question: q }; break; }
      }
      if (!row) return Promise.resolve(null);
      tried.add(row.id);
      const forge = root.forge;
      const view = forge && forge.sharedKnowledgeView ? forge.sharedKnowledgeView() : null;
      inflight = PT.researchExcerpt(row.question, {
        fetch: root.fetch ? root.fetch.bind(root) : null,
        path: forge && forge.fetchPath ? () => forge.fetchPath() : null,
        reparse: forge && forge.reparseClause ? t => forge.reparseClause(t) : null,
        bank: (view && view.admitted) || []
      }).then(hit => {
        inflight = null;
        if (hit && hit.ok && hit.measured && mesh.applyMeasured && mesh.applyMeasured(row.id, hit).ok && mesh.prefer) mesh.prefer(row.id);
        return hit;
      }).catch(() => { inflight = null; return null; });
      return inflight;
    }
    K.step = async function () {
      if (running) return;
      running = true;
      try { await enrich(); origStep(); }
      finally { running = false; }
    };
    const prev = root.afterSay;
    function queueMiss(r) {
      const meaning = r && r.trace && r.trace.msm && r.trace.msm.meaning;
      if (!meaning || meaning.kind === 'tool_started' || meaning.kind === 'recall' || meaning.kind === 'research_answer') return;
      const failed = meaning.kind === 'tool_failed' || (r.trace.outcome && r.trace.outcome.category === 'NO_LAWFUL_CANDIDATE');
      const q = String((r.trace && r.trace.input) || '').replace(/[?\s]+$/, '').trim();
      if (!failed || !q) return;
      const mesh = meshOf();
      if (!mesh) return;
      const sha = root.KSha && root.KSha.sha256 ? root.KSha.sha256(q).slice(0, 12) : String(q.length);
      const id = 'gap:aq1:' + sha;
      mesh.enqueue([{ id: id, kind: 'aq1_miss', question: q, claim: null, extracts: [], calls_llm: false }]);
      if (mesh.prefer) mesh.prefer(id);
    }
    root.afterSay = function (r, el) {
      if (prev) prev(r, el);
      if (r && r.toolJob && typeof r.toolJob.then === 'function') r.toolJob.then(queueMiss);
      else queueMiss(r);
    };
    return { ok: true, calls_llm: false };
  }

  const api = { SCHEMA, METHOD, researchExcerpt, createWriteAccess, attachCustody, calls_llm: false };
  if (isNode) module.exports = api; else root.KPipeline = api;
})(typeof self !== 'undefined' ? self : this);
