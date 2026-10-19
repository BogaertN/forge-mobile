/* crawler.js — tracker-free research + page capture (port of forge rmc_engine_v1/research_acquisition.py, preservation branch).
 * Tracker-free: credentials omitted (no cookies), no referrer, no cache, no custom or identifying headers, no third-party scripts
 * (HTML is parsed as inert text, never executed), public URLs only. When a site is not CORS-readable the fetch goes through the user's
 * own path (Forge Node / proxy URL set by the user); with no path the capture is refused, never routed through a third party.
 * Results are candidate evidence only (never truth, never memory) and are sealed into the Identity Vault. No model, no embeddings. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  const VERSION = 'forge-mobile-tracker-free-research-v1 (port of aiweb-forge-governed-research-acquisition-v1)';
  const LIMITS = { MAX_SEARCH_RESULTS: 6, MAX_FETCHED_PAGES: 3, MAX_RESPONSE_BYTES: 450000, MAX_EXCERPT: 900, TIMEOUT_MS: 8000 };
  const STOP = new Set('a an and are as at be can could did do does for from how i in is it me of on or should the this to was were what when where which who why will with would you'.split(' '));
  const boundary = () => ({ version: VERSION, role: 'candidate_evidence_connector', calls_llm: false, embedding_performed: false, cookies_sent: false, referrer_sent: false, custom_headers_sent: false,
    third_party_scripts_executed: false, private_network_targets_blocked: true, robots_txt_honoured: true, noai_noindex_honoured: true, source_is_truth_authority: false, writes_stable_memory: false, stores_in: 'Identity Vault (sealed)' });
  /* public-URL validation (browser cannot resolve DNS, so literal private hosts/IPs and local names are refused) */
  function validateUrl(u) {
    let p; try { p = new URL(String(u).trim()); } catch (e) { throw new Error('research_url_invalid'); }
    if (!/^https?:$/.test(p.protocol)) throw new Error('research_url_must_be_public_http_or_https');
    if (p.username || p.password) throw new Error('research_url_credentials_blocked');
    const h = p.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (/^(localhost|.*\.local|.*\.localhost|.*\.internal|.*\.lan|.*\.home|.*\.arpa)$/.test(h) || !h.includes('.') && !h.includes(':')) throw new Error('research_private_or_non_global_target_blocked');
    const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/); if (m) { const [a, b] = [+m[1], +m[2]]; if (a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) throw new Error('research_private_or_non_global_target_blocked'); }
    if (h.includes(':') && /^(::1?|f[cd]|fe8|::ffff:)/i.test(h)) throw new Error('research_private_or_non_global_target_blocked');
    p.hash = p.hash; return p.toString(); }
  const FETCH_INIT = { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'follow', mode: 'cors' }; /* no headers object at all */
  function Crawler(opts) {
    opts = opts || {}; const doFetch = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    const path = () => (opts.path ? opts.path() : null); /* user's own fetch path: { kind:'node'|'proxy', url } */
    async function get(url, accept) {
      const v = validateUrl(url); const via = path(); const target = via ? via.url.replace(/\/$/, '') + '/fetch?url=' + encodeURIComponent(v) : v;
      if (!doFetch) throw new Error('research_no_fetch_available');
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null; const t = ctl ? setTimeout(() => ctl.abort(), LIMITS.TIMEOUT_MS) : null;
      if (via && via.kind === 'node' && via.rpc) { if (t) clearTimeout(t); let o; try { o = await via.rpc('fetch', { url: v }); } catch (e) { throw new Error('research_path_unreachable'); } if (!o || !o.ok) throw new Error('research_node_' + (o && o.error || 'error'));
        if (o.text.length > LIMITS.MAX_RESPONSE_BYTES) throw new Error('research_response_size_limit_exceeded'); const ctN = String(o.content_type || ''); if (!new RegExp(accept || 'text/html|application/xhtml\\+xml|text/plain|application/json', 'i').test(ctN)) throw new Error('research_content_type_not_admitted');
        return { finalUrl: validateUrl(o.url || v), ct: ctN, text: o.text, via: 'node' }; }
      /* A-RATE (4.9.53, same policy as archives.js): a 429 / 503 is retried after Retry-After (≤ 8 s) or 0.5 s, 1 s — at most 3 attempts */
      let r; for (let a = 0; ; a++) { try { r = await doFetch(target, Object.assign({}, FETCH_INIT, ctl ? { signal: ctl.signal } : {})); } catch (e) { if (t) clearTimeout(t); throw new Error(via ? 'research_path_unreachable' : 'research_not_cors_readable_needs_user_path'); }
        if ((r.status === 429 || r.status === 503) && a < 2) { const ra = Number(r.headers && r.headers.get && r.headers.get('retry-after')); await new Promise(z => setTimeout(z, ra > 0 && ra <= 8 ? ra * 1000 : 500 * Math.pow(2, a))); continue; } break; }
      if (t) clearTimeout(t);
      if (!r.ok) throw new Error('research_http_' + r.status);
      const finalUrl = validateUrl(r.headers.get('x-final-url') || r.url || v); const ct = String(r.headers.get('content-type') || '');
      if (!new RegExp(accept || 'text/html|application/xhtml\\+xml|text/plain|application/json', 'i').test(ct)) throw new Error('research_content_type_not_admitted');
      const text = await r.text(); if (text.length > LIMITS.MAX_RESPONSE_BYTES) throw new Error('research_response_size_limit_exceeded');
      return { finalUrl, ct, text, via: via ? via.kind : 'direct' }; }
    /* robots.txt (User-agent: * and ForgeMobile) — a disallow refuses the capture */
    const robotsCache = new Map(); /* one robots.txt read per origin per crawler (fewer requests, same rule) */
    async function robotsAllows(url) { const u = new URL(url); let txt = ''; if (robotsCache.has(u.origin)) txt = robotsCache.get(u.origin); else { try { txt = (await get(u.origin + '/robots.txt', 'text/plain|text/html|')).text; } catch (e) { return { allowed: true, basis: 'robots_unavailable' }; } robotsCache.set(u.origin, txt); }
      let applies = false, dis = []; for (const line of txt.split(/\r?\n/)) { const m = line.replace(/#.*/, '').trim().match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue; const k = m[1].toLowerCase(), val = m[2].trim();
        if (k === 'user-agent') applies = val === '*' || /forgemobile/i.test(val); else if (applies && k === 'disallow' && val) dis.push(val); }
      const hit = dis.find(d => u.pathname.startsWith(d)); return hit ? { allowed: false, basis: 'robots_disallow ' + hit } : { allowed: true, basis: 'robots_ok' }; }
    return { get, robotsAllows };
  }
  /* inert HTML → text blocks (no DOM, no script execution) */
  function htmlText(html) {
    const title = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const meta = (html.match(/<meta[^>]+name=["']robots["'][^>]*>/gi) || []).join(' ').toLowerCase();
    const body = html.replace(/<(script|style|noscript|template|iframe|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    const blocks = body.split(/<\/?(?:p|div|li|h[1-6]|section|article|br|tr|td|blockquote|pre)[^>]*>/i).map(b => b.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()).filter(b => b.length > 0);
    return { title, blocks, noai: /noai|noimageai/.test(meta), noindex: /noindex/.test(meta) }; }
  const forms = s => { const o = new Set(); for (const w of String(s).toLowerCase().match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) || []) if (w.length > 1 && !STOP.has(w)) o.add(w); return o; };
  /* exact-excerpt resonance scoring — same terms and weights as research_acquisition._relevant_excerpt */
  function relevantExcerpt(query, blocks) {
    const qf = forms(query); const qw = new Set(String(query).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []); const proc = qw.has('how') || qf.has('define'); let best = null, ord = 0;
    for (const b of blocks) for (const sent of b.split(/(?<=[.!?])\s+|\n+/)) { const ex = sent.replace(/\s+/g, ' ').trim(); if (ex.length < 35) continue; const f = forms(ex); const ov = [...qf].filter(x => f.has(x)).sort();
      const cov = ov.length / Math.max(1, qf.size), den = ov.length / Math.max(4, f.size); const lead = [...forms(ex)][0] || ''; const isQ = /\?/.test(ex) || /^["'“‘]?(what|why|how|when|where|who|which)\b/i.test(ex);
      const defn = qf.has(lead) && (/\b(means|refers to|is defined as|are defined as)\b/i.test(ex) || /^["'“‘]?(?:the\s+)?[^.!?]{1,80}\s+(?:is|are)\s+(?!(?:used|related|said|shown|listed|included)\b)/i.test(ex));
      const score = Math.max(0, Math.min(1, 0.66 * cov + 0.14 * den + (!isQ && defn ? 0.16 : 0) + (proc && /\bmust\b|\bsyntax\b|\bstatement\b|\bfollowed by\b/i.test(ex) ? 0.16 : 0) + Math.max(0, 0.13 - 0.0025 * ord) + Math.min(0.06, Math.max(0, (ex.length - 45) / 900)) - (isQ ? 0.26 : 0) - (/^(↑|ISBN|Retrieved )/.test(ex) ? 0.18 : 0)));
      if (!best || score > best.score) best = { excerpt: ex.slice(0, LIMITS.MAX_EXCERPT), score: Math.round(score * 1e6) / 1e6, overlap: ov }; ord++; }
    return best || { excerpt: '', score: 0, overlap: [] }; }
  const stable = (p, o) => p + ':' + sha256(JSON.stringify(o));
  /* Wikipedia (CORS-readable with origin=*) search + extract; generic page capture otherwise */
  async function search(cr, query) { const u = 'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=' + LIMITS.MAX_SEARCH_RESULTS + '&srsearch=' + encodeURIComponent(query);
    const r = await cr.get(u, 'application/json'); const j = JSON.parse(r.text); return ((j.query && j.query.search) || []).map((x, i) => { const body = { rank: i + 1, title: x.title, url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(x.title.replace(/ /g, '_')), search_provider: 'wikipedia_mediawiki', page_title: x.title, search_rank_is_truth_authority: false }; return Object.assign({ search_result_id: stable('web_search_result', body) }, body); }); }
  async function capturePage(cr, query, row, at) { /* en.wikipedia.org/wiki/… pages are read through the CORS-readable MediaWiki extracts API */
    const robots = await cr.robotsAllows(row.url); if (!robots.allowed) throw new Error('research_' + robots.basis.replace(/ .*/, ''));
    let title = row.title || '', blocks, content;
    { const w = String(row.url).match(/^https:\/\/en\.wikipedia\.org\/wiki\/([^?#]+)$/); if (w && row.search_provider !== 'wikipedia_mediawiki') { row = Object.assign({}, row, { search_provider: 'wikipedia_mediawiki', page_title: decodeURIComponent(w[1]).replace(/_/g, ' ') }); } }
    if (row.search_provider === 'wikipedia_mediawiki') { const u = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&origin=*&titles=' + encodeURIComponent(row.page_title); const r = await cr.get(u, 'application/json'); const j = JSON.parse(r.text); const pg = Object.values((j.query && j.query.pages) || {})[0] || {}; content = String(pg.extract || ''); blocks = content.split(/\n+/); title = pg.title || title; }
    else { const r = await cr.get(row.url); content = r.text; if (/html/i.test(r.ct)) { const h = htmlText(content); if (h.noai) throw new Error('research_noai_meta_honoured'); title = h.title || title; blocks = h.blocks; } else blocks = [content]; }
    const ex = query ? relevantExcerpt(query, blocks) : { excerpt: blocks.slice(0, 3).join(' ').slice(0, LIMITS.MAX_EXCERPT), score: null, overlap: [] };
    const rec = { search_result_ref: row.search_result_id || null, url: row.url, title: String(title).slice(0, 240), content_sha256: sha256(content), excerpt: ex.excerpt, excerpt_sha256: sha256(ex.excerpt), resonance_score: ex.score, matched_source_forms: ex.overlap, robots: robots.basis, captured_at: at, candidate_evidence_only: true, canonical: false };
    return Object.assign({ source_receipt_id: stable('web_source_receipt', rec) }, rec, { _text: content.slice(0, LIMITS.MAX_RESPONSE_BYTES) }); }
  async function acquire(cr, query, at) { const errors = []; let rows = []; try { rows = await search(cr, query); } catch (e) { errors.push({ stage: 'search', reason_code: String(e.message) }); }
    const ev = []; for (const row of rows.slice(0, LIMITS.MAX_FETCHED_PAGES)) { try { const c = await capturePage(cr, query, row, at); if (c.excerpt) ev.push(c); } catch (e) { errors.push({ stage: 'capture', reason_code: String(e.message) }); } }
    ev.sort((a, b) => b.resonance_score - a.resonance_score);
    const body = { query_sha256: sha256(String(query)), source_receipt_refs: ev.map(e => e.source_receipt_id), search_result_count: rows.length, evidence_count: ev.length, error_count: errors.length, candidate_evidence_only: true, canonical: false };
    return Object.assign({ acquisition_id: stable('research_acquisition', body), status: ev.length ? 'EVIDENCE_CAPTURED' : 'NO_EVIDENCE_CAPTURED' }, body, { evidence: ev, errors }); }
  /* 4.9.47 question-structured research. The plan comes from the language core's tagged tokens (grammar.js analyse via the kernel): wh / aux / copula /
     determiners are dropped; the head concept is the subject noun (or the object noun when the wh-word is the subject); the predicate is the main verb, or the
     copular complement. Nothing here names a topic: queries, ranking and excerpt choice are computed from that structure only. */
  const CLOSED_T = new Set(['WH', 'AUX', 'COP', 'DET', 'PREP', 'PRON', 'REL', 'CONJ', 'PUNCT', 'NEG', 'MOD', 'POSS', 'QUOTE']);
  function planFromTokens(T, raw) {
    T = (T || []).filter(t => t && t.an && t.an.length); const has = (t, g) => t.an.some(a => a.tag === g); const lem = (t, g) => { const a = t.an.find(x => x.tag === g); return a ? String(a.lemma).toLowerCase() : null; };
    const closed = t => t.an.every(a => CLOSED_T.has(a.tag)) || STOP.has(t.w);
    const nounOf = t => lem(t, 'N') || (has(t, 'UNK') || has(t, 'PROPN') ? t.w.toLowerCase() : null);
    const wh = T.length && has(T[0], 'WH') ? T[0].w : null; const cont = T.filter(t => !closed(t)); let head = null, pred = null, obj = null, predKind = null, headRole = 'object';
    const yn = !wh && T[0] && (has(T[0], 'AUX') || has(T[0], 'COP')); const AX = wh ? T[1] : yn ? T[0] : null; /* yes/no: AUX/COP-initial, same subject + predicate reading */
    if (AX && (has(AX, 'AUX') || has(AX, 'COP'))) { /* wh AUX NP V … | wh COP NP COMPLEMENT */
      const np = cont; if (has(AX, 'COP')) { head = np.length > 1 ? nounOf(np[0]) : np[0] && nounOf(np[0]); if (np.length > 1) { const c = np[np.length - 1]; pred = lem(c, 'ADJ') || nounOf(c); predKind = 'complement'; } }
      else { const vi = np.map((t, i) => (has(t, 'V') && i > 0 ? i : -1)).filter(i => i > 0); const v = vi.length ? vi[0] : np.length - 1; head = np[0] && nounOf(np[0]); headRole = 'subject'; if (np[v] && v > 0) { pred = lem(np[v], 'V') || np[v].w; predKind = 'verb'; } const o = np.slice(v + 1).map(nounOf).filter(Boolean); obj = o.length ? o[o.length - 1] : null; } }
    else if (wh && cont.length && has(cont[0], 'V')) { /* wh-subject V NP: the object noun is the concept asked about */ pred = lem(cont[0], 'V'); predKind = 'verb'; const o = cont.slice(1).map(nounOf).filter(Boolean); head = o.length ? o[o.length - 1] : null; }
    else if (wh && cont.length >= 2 && nounOf(cont[0]) && cont.slice(1).some((t, j) => has(t, 'V') || (has(t, 'UNK') && j === cont.length - 2))) { /* wh NP V … without an auxiliary ("how X Vs"): same subject + verb reading */
      let v = cont.findIndex((t, i) => i > 0 && has(t, 'V')); if (v < 0) v = cont.length - 1; head = nounOf(cont[v - 1]) || nounOf(cont[0]); headRole = 'subject'; pred = lem(cont[v], 'V') || String(cont[v].w).toLowerCase(); predKind = 'verb'; const o = cont.slice(v + 1).map(nounOf).filter(Boolean); obj = o.length ? o[o.length - 1] : null; }
    else { const ns = cont.map(nounOf).filter(Boolean); head = ns.length ? ns[ns.length - 1] : null; const vs = cont.filter(t => has(t, 'V') && !has(t, 'N')); if (vs.length) { pred = lem(vs[0], 'V'); predKind = 'verb'; } }
    if (!head && cont.length) head = String(cont[0].w).toLowerCase(); if (pred === head) pred = null;
    const mods = cont.map(t => lem(t, 'ADJ') || nounOf(t) || lem(t, 'V') || t.w.toLowerCase()).filter(w => w && w !== head && w !== pred && w !== obj);
    return { wh: wh ? wh.toLowerCase() : null, head, headRole, pred, predKind, obj, mods, raw: String(raw || cont.map(t => t.orig || t.w).join(' ')) }; }
  const stem = w => { w = String(w).toLowerCase(); if (w.length > 4) w = /ies$/.test(w) ? w.slice(0, -3) + 'y' : /(s|x|z|ch|sh)es$/.test(w) ? w.slice(0, -2) : /ss$/.test(w) ? w : w.replace(/(ing|ed|s|ation|ion|ment|ence|ance)$/, ''); return w; };
  const stemTitle = (t, plan) => wordsOf(t).map(w => (matches(w, plan.head) ? plan.head : w)).join(' ');
  const wordsOf = s => String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const SUF = /^(e|s|es|d|ed|ing|est|ion|ions|ation|ations|ment|ments|al|ly|ic|ical)$/; /* inflection / derivation tails only (no free compounding) */
  const matches = (w, target) => { w = String(w).toLowerCase(); target = String(target).toLowerCase(); const a = stem(w), b = stem(target); if (a === b || w === target) return true; const [s1, l1] = a.length <= b.length ? [a, b] : [b, a]; return s1.length >= 3 && l1.startsWith(s1) && SUF.test(l1.slice(s1.length)); };
  const anyMatch = (text, forms) => { const ws = wordsOf(text); return forms.some(f => ws.some(w => matches(w, f))); };
  function predForms(plan, lexNouns) { if (!plan.pred) return []; const p = plan.pred, o = new Set([p]); /* inflections of the predicate (morphology, not a topic list) */
    if (plan.predKind === 'verb') { const ing = /ie$/.test(p) ? p.slice(0, -2) + 'ying' : /[^e]e$/.test(p) ? p.slice(0, -1) + 'ing' : p + 'ing'; o.add(ing); o.add(/[^aeiou]y$/.test(p) ? p.slice(0, -1) + 'ies' : p + 's'); o.add(/e$/.test(p) ? p + 'd' : /[^aeiou]y$/.test(p) ? p.slice(0, -1) + 'ied' : p + 'ed');
      for (const n of (lexNouns || [])) o.add(n); for (const x of (plan.forms || [])) o.add(x); }
    return [...o]; }
  const MEDIA = /\b(film|movie|song|single|album|ep|novel|book|video game|game|television|tv series|series|sitcom|episode|band|musical|play|opera|comic|manga|anime|soundtrack|character|franchise|rapper|singer|musician|record label|magazine|newspaper|poem|short story|painting|mythical|mythological|legendary|legend|folklore|fictional|fairy tale|nursery rhyme)\b/i;
  const CAUSAL = /\b(because|due to|caus(?:e|es|ed|ing)|result(?:s|ing)? (?:of|from|in)|as a result|owing to|reason|so that|explain(?:s|ed)?|occurs? when|leads? to|responsible for|meaning that)\b/i;
  const MECH = /\b(by|through|using|via|when|process|mechanism|work(?:s)? by|produce[sd]?|generate[sd]?|allow(?:s)?|enable[sd]?)\b/i;
  /* sentence split that does not cut inside an open parenthesis/quote or after a short abbreviation (lit. / e.g. / c. / St.) */
  const ABBR = /(?:^|[\s(])(?:(?:[A-Z]\.)+[A-Z]|lit|e\.g|i\.e|cf|ca|c|approx|vs|fl|b|d|Dr|Mr|Mrs|Ms|St|Jr|Sr|Mt|No|Vol|[A-Z])\.$/;
  function splitSents(text) { const out = []; let cur = ''; const push = () => { const t = cur.replace(/\s+/g, ' ').trim(); if (t) out.push(t); cur = ''; };
    for (const part of String(text).split(/\n+/)) { for (const x of part.split(/(?<=[.!?])\s+/)) { cur = cur ? cur + ' ' + x : x; const open = (cur.match(/\(/g) || []).length - (cur.match(/\)/g) || []).length; if ((open > 0 || ABBR.test(cur)) && cur.length < 700) continue; push(); } push(); } return out; }
  const NEG = /\b(cannot|can't|not|never|unable|no longer|lost the ability)\b/i; const PRIV = w => /less$|^non-?[a-z]|^un[a-z]{3}/.test(w);
  const DETW = new Set(['the', 'a', 'an', 'his', 'her', 'their', 'its', 'our', 'my', 'your', 's', 'this', 'that', 'of']);
  /* a verb predicate counts only where it is used as a verb (not after a determiner or possessive) */
  const predIn = (ex, pf, plan) => { const ws = wordsOf(ex); if (plan.predKind === 'complement' && ws.some(w => w.startsWith(plan.pred) && /^(r|er|est|st)$/.test(w.slice(plan.pred.length)))) return true; /* comparative of the asked property */ const H = ws.map((w, i) => (matches(w, plan.head) ? i : -1)).filter(i => i >= 0);
    return ws.some((w, i) => { if (!pf.some(f => matches(w, f)) || (plan.predKind === 'verb' && i > 0 && DETW.has(ws[i - 1]) && !(plan.nominals || []).some(n => matches(w, n)))) return false;
      if (plan.predKind !== 'verb' || !H.length) return true; /* the question's structure: subject head before its verb; an object head on either side (active or passive) within one clause span */
      return H.some(h => (plan.headRole === 'subject' ? h < i && i - h <= 5 : Math.abs(i - h) <= 8) && !/[,;:()]/.test(clauseBetween(ex, ws, h, i))); }); };
  const clauseBetween = (ex, ws, a, b) => { const lo = Math.min(a, b), hi = Math.max(a, b); const toks = ex.split(/(?=[\s,;:()])/); let k = -1, out = ''; for (const t of toks) { if (/[\p{L}\p{N}]/u.test(t)) k++; if (k > lo && k <= hi) out += t; } return out.replace(/[\p{L}\p{N}]+[\s]*$/u, ''); };
  const AGENT_G = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+\b/g;
  const AGENT = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+\b/;
  function planQueries(plan, nominals) { const q = []; const add = a => { const s = a.filter(Boolean).join(' ').trim(); if (s && !q.includes(s)) q.push(s); }; const pf = predForms(plan, nominals);
    for (const n of nominals || []) add([plan.head, n]); if (plan.pred) { add([plan.head, plan.pred]); if (plan.predKind === 'verb') add([plan.head, pf[1]]); } if (plan.obj) add([plan.head, plan.pred, plan.obj]); add([plan.head].concat(plan.mods.slice(0, 2))); add([plan.head]); return q.slice(0, 5); }
  function scoreCandidate(plan, c, pf) { const tw = [...new Set(wordsOf(c.title))]; let s = 0; const hT = tw.some(w => matches(w, plan.head)), hI = anyMatch(c.intro || '', [plan.head]);
    if (hT) s += 3; if (tw.length && tw.every(w => matches(w, plan.head) || pf.some(f => matches(w, f)) || STOP.has(w))) s += 2; if (hI) s += 1;
    if (tw.some(w => PRIV(w) && pf.concat([plan.head]).some(f => matches(w.replace(/less$|^non-?|^un/, ''), f) || w.startsWith(f.slice(0, 4))))) s -= 4;
    if (pf.length) { if (tw.some(w => !PRIV(w) && pf.some(f => matches(w, f)))) s += 2; if (anyMatch(c.intro || '', pf)) s += 2; }
    if (plan.obj && anyMatch(c.title + ' ' + (c.intro || ''), [plan.obj])) s += 1; for (const m of plan.mods) if (anyMatch(c.title + ' ' + (c.intro || ''), [m])) s += 0.5;
    s -= 0.4 * tw.filter(w => !STOP.has(w) && !matches(w, plan.head) && !pf.some(f => matches(w, f)) && !(plan.obj && matches(w, plan.obj)) && !plan.mods.some(m => matches(w, m))).length;
    if (/^list of\b/i.test(c.title)) s -= 1.5; if (plan.predKind === 'verb' && !tw.some(w => matches(w, plan.head)) && tw.length && tw.every(w => pf.some(f => matches(w, f)) || STOP.has(w))) s -= 4; /* part of speech: the verb asked about is not the homograph noun page */ if (plan.predKind === 'complement' && new RegExp('^' + plan.head + '[\\s-]+' + plan.pred + '$', 'i').test(stemTitle(c.title, plan))) s -= 4; /* the compound name is a different thing from the predication */ if (plan.wh !== 'who' && /\bborn\b|\(\d{4}[–-]\d{4}\)|\b(company|firm|organi[sz]ation|club|team|studio|broadcaster|brand|channel|airline|retailer|politician|player|actor|actress|writer|author|businessman|entrepreneur|footballer|artist|director|lawyer|peer|journalist|presenter|comedian)\b/i.test(c.description || '')) s -= 4; if (/^\d{3,4}\b/.test(c.title) && !/\d/.test(plan.raw)) s -= 2.5; s -= 0.15 * c.rank;
    return { score: Math.round(s * 1000) / 1000, headOk: hT || hI }; }
  function answerExcerpt(plan, blocks, pf, ctx) { ctx = ctx || {}; let best = null, ord = 0;
    const sents = []; for (const bl of blocks) for (const t of splitSents(bl)) sents.push(t);
    const CUE = plan.wh === 'why' ? CAUSAL : plan.wh === 'how' ? MECH : plan.wh === 'who' ? AGENT : null;
    for (let si = 0; si < sents.length; si++) { const sent = sents[si]; /* an answer window: a short head+predicate sentence joined with the next one when that one carries the wh-cue */
      const nx = sents[si + 1]; const ex = CUE && nx && sent.length < 240 && !CUE.test(sent) && CUE.test(nx) && !/^=/.test(nx) && anyMatch(sent, [plan.head]) && predIn(sent, pf, plan) ? sent + ' ' + nx : sent; ord++; if (ex.length < 25 || ex.length > 520 || !/[.!?]["”’)]?$/.test(ex) || /^=+|\?$|^(↑|ISBN|Retrieved )/.test(ex)) continue;
      const hIn = anyMatch(ex, [plan.head]), pIn = pf.length && predIn(ex, pf, plan), hOk = hIn || ctx.titlePred || (ctx.titleHead && pIn && !!CUE && CUE.test(ex)), pOk = !pf.length || pIn || ctx.titlePred; if (!hIn && !pIn) continue; let s = (hIn ? 2 : 0) + (pIn ? 3 : 0);
      if (plan.predKind === 'complement' && new RegExp('\\b' + plan.head + '[\\s-]+' + plan.pred + '\\b', 'i').test(ex)) s -= 4; /* a compound name (head+property as one noun) is not the predication asked about */
      if (NEG.test(ex) || wordsOf(ex).some(w => PRIV(w) && pf.some(f => matches(w.replace(/less$|^non-?|^un/, ''), f)))) s -= 2.5;
      if (plan.obj && anyMatch(ex, [plan.obj])) s += 1; for (const m of plan.mods) if (anyMatch(ex, [m])) s += 0.5;
      if (plan.wh === 'why' && CAUSAL.test(ex)) s += 1.5; if (plan.wh === 'how' && MECH.test(ex)) s += 1.5; if (/\b(how|why|what|whether)\b/i.test(ex)) s -= 1.5; if (CUE && !CUE.test(ex)) s -= 2; if (new RegExp('(?<!^)\\b' + plan.head.charAt(0).toUpperCase() + plan.head.slice(1) + '\\b').test(ex.slice(1)) && plan.raw === plan.raw.toLowerCase()) s -= 2; /* a capitalised head mid-sentence is a name, not the concept */ if (plan.wh === 'who') { const ag = new Set((ex.slice(1).match(AGENT_G) || [])); s += ag.size ? 1.5 + Math.min(2, 0.5 * (ag.size - 1)) : -1; if (si < 6) s += 1.5; } /* the article lead is its consensus summary */ /* who: name the agents; several credited agents = the honest record */ if (plan.wh === 'what' && /\b(is|are)\b/.test(ex)) s += 0.5;
      s += Math.max(0, 0.6 - 0.01 * ord); if (ex.length > 260) s -= 0.6; if (ex.length > 300) s -= 1.5; if (/^[("'“‘]/.test(ex)) s -= 1.5; if (ex.length > 420) s -= 0.6; if (/["“].{20,}["”]/.test(ex)) s -= 0.5;
      if (!best || s > best.s) best = { s, ex, hOk, pOk }; }
    return best && best.hOk && best.pOk && best.s >= 3.5 ? { excerpt: best.ex.slice(0, LIMITS.MAX_EXCERPT), score: Math.round(best.s * 1000) / 1000, overlap: [plan.head].concat(pf.length ? [plan.pred] : []) } : null; }
  async function acquirePlanned(cr, plan, at, opts) { opts = opts || {}; const errors = []; const nominals = opts.nominals || []; plan = Object.assign({}, plan, { nominals }); const pf = predForms(plan, nominals); const media = MEDIA.test(plan.raw);
    const seen = new Map(); for (const q of planQueries(plan, nominals).slice(0, 3)) { try { (await search(cr, q)).forEach(r => { if (!seen.has(r.title)) seen.set(r.title, Object.assign({}, r, { rank: seen.size + 1 })); }); } catch (e) { errors.push({ stage: 'search', reason_code: String(e.message) }); } if (seen.size >= 24) break; }
    let rows = [...seen.values()].slice(0, 24); /* one metadata request: intro text, short description, disambiguation flag */
    try { const u = 'https://en.wikipedia.org/w/api.php?action=query&prop=extracts|description|pageprops&ppprop=disambiguation&exintro=1&explaintext=1&exlimit=max&redirects=1&format=json&origin=*&titles=' + encodeURIComponent(rows.map(r => r.title).join('|'));
      const j = JSON.parse((await cr.get(u, 'application/json')).text); const pages = Object.values((j.query && j.query.pages) || {}); const by = new Map(pages.map(p => [p.title, p]));
      ((j.query && j.query.redirects) || []).concat((j.query && j.query.normalized) || []).forEach(r => { if (by.has(r.to)) by.set(r.from, by.get(r.to)); });
      rows = rows.map(r => { const p = by.get(r.title) || {}; return Object.assign(r, { intro: String(p.extract || ''), description: String(p.description || ''), disambiguation: !!(p.pageprops && 'disambiguation' in p.pageprops) || /\(disambiguation\)$/.test(r.title) || /may refer to:?\s*$/.test(String(p.extract || '').split('\n')[0]) }); }); }
    catch (e) { errors.push({ stage: 'metadata', reason_code: String(e.message) }); rows.forEach(r => { r.disambiguation = /\(disambiguation\)$/.test(r.title); }); }
    const dropped = []; rows = rows.filter(r => { const why = !/^[\p{L}\p{N}]/u.test(r.title) ? 'not_an_article_title' : r.disambiguation ? 'disambiguation' : !media && (MEDIA.test(r.description) || /\((?:[^)]*\b)?(film|song|album|novel|video game|game|band|TV series|book|play|musical)\)$/i.test(r.title)) ? 'fiction_or_media' : null; if (why) dropped.push({ title: r.title, reason: why }); return !why; });
    /* 4.9.74 SUBJECT GUARD at acquisition (Nic item 4): when the caller gives the question's subject test, an article whose primary entity is not the
       question's entity is dropped before ranking (typed SUBJECT_MISMATCH), so the fetch budget is never spent on it and it is never quoted */
    if (opts.subject) rows = rows.filter(r => { const sm = opts.subject(r.title, r.intro), ok = !!(sm && sm.ok); r.subjectExact = !!(sm && sm.exact); r.answerCandidate = !!(sm && sm.answer); if (!ok) dropped.push({ title: r.title, reason: 'SUBJECT_MISMATCH', intro: String(r.intro || '').slice(0, 400) }); return ok; });
    if (opts.related && plan.pred && plan.predKind === 'verb') { const tw = new Set(); rows.forEach(r => wordsOf(r.title).forEach(w => tw.add(w))); for (const w of tw) if (!pf.some(f => matches(w, f)) && !matches(w, plan.head) && opts.related(w, plan.pred)) pf.push(w); }
    let ranked = rows.map(r => { const sc = scoreCandidate(plan, r, pf); if (r.subjectExact || (r.answerCandidate && pf.length && anyMatch(r.intro || '', pf))) sc.score = Math.round((sc.score + 3) * 1000) / 1000; /* 4.9.74: the article whose primary entity IS the question's entity, or a possible answer-entity article whose intro states the asked relation about the question's subject (ruling 11:15; it still has to qualify with a span after extraction) */ return Object.assign(r, sc); }).filter(r => r.headOk).sort((a, b) => b.score - a.score); { const top = ranked.length ? ranked[0].score : 0; ranked = ranked.filter(r => r.score >= Math.max(3.5, top * 0.45)); } if (opts.debug) opts.debug(ranked.map(r => r.title + ' ' + r.score), dropped);
    const ev = []; for (const row of ranked.slice(0, 6)) { if (ev.length >= LIMITS.MAX_FETCHED_PAGES) break; try { const c = await capturePage(cr, null, row, at); const blocks = String(c._text).split(/\n+/); const twr = wordsOf(row.title); let ex = plan.pred ? answerExcerpt(plan, blocks, pf, { titleHead: twr.some(w => matches(w, plan.head)), titlePred: twr.some(w => !PRIV(w) && pf.some(f => matches(w, f))) }) : relevantExcerpt(plan.raw, blocks);
        if (!ex && plan.pred && twr.length && twr.every(w => matches(w, plan.head))) { const lead = splitSents(blocks.slice(0, 3).join('\n')).find(x => x.length >= 40 && x.length <= 300 && anyMatch(x, [plan.head])); if (lead) ex = { excerpt: lead, score: 3.6, overlap: [plan.head] }; } /* the concept's own article: its lead sentence is a fair answer when no sentence states the predicate */
        if (!ex || !ex.excerpt || (!plan.pred && !anyMatch(ex.excerpt, [plan.head]))) { errors.push({ stage: 'relevance', reason_code: 'no_sentence_answers_the_question', title: row.title }); continue; }
        const rec = Object.assign({}, c, { excerpt: ex.excerpt, excerpt_sha256: sha256(ex.excerpt), resonance_score: Math.round((0.25 * row.score + ex.score) * 1000) / 1000, matched_source_forms: ex.overlap }); delete rec.source_receipt_id; const { _text, ...pub } = rec;
        ev.push(Object.assign({ source_receipt_id: stable('web_source_receipt', pub) }, pub, { _text })); } catch (e) { errors.push({ stage: 'capture', reason_code: String(e.message) }); } }
    ev.sort((a, b) => b.resonance_score - a.resonance_score); if (!ev.length) { const net = errors.find(e => e.stage === 'search' || e.stage === 'capture'); errors.unshift({ stage: net && !ranked.length ? net.stage : 'relevance', reason_code: net && (!ranked.length || errors.every(e => e.stage !== 'relevance')) ? net.reason_code : 'research_no_relevant_source' }); }
    const body = { query_sha256: sha256(String(plan.raw)), plan: { wh: plan.wh, head: plan.head, pred: plan.pred, obj: plan.obj }, source_receipt_refs: ev.map(e => e.source_receipt_id), search_result_count: seen.size, dropped_count: dropped.length, evidence_count: ev.length, error_count: errors.length, candidate_evidence_only: true, canonical: false };
    return Object.assign({ acquisition_id: stable('research_acquisition', body), status: ev.length ? 'EVIDENCE_CAPTURED' : 'NO_EVIDENCE_CAPTURED' }, body, { evidence: ev, errors, dropped }); }
  const api = { planFromTokens, acquirePlanned, planQueries, answerExcerpt, Crawler, validateUrl, htmlText, relevantExcerpt, search, capturePage, acquire, boundary, LIMITS, FETCH_INIT, VERSION };
  if (isNode) module.exports = api; else root.KCrawler = api;
})(typeof self !== 'undefined' ? self : this);
