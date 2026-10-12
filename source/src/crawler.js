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
      let r; try { r = await doFetch(target, Object.assign({}, FETCH_INIT, ctl ? { signal: ctl.signal } : {})); } catch (e) { throw new Error(via ? 'research_path_unreachable' : 'research_not_cors_readable_needs_user_path'); } finally { if (t) clearTimeout(t); }
      if (!r.ok) throw new Error('research_http_' + r.status);
      const finalUrl = validateUrl(r.headers.get('x-final-url') || r.url || v); const ct = String(r.headers.get('content-type') || '');
      if (!new RegExp(accept || 'text/html|application/xhtml\\+xml|text/plain|application/json', 'i').test(ct)) throw new Error('research_content_type_not_admitted');
      const text = await r.text(); if (text.length > LIMITS.MAX_RESPONSE_BYTES) throw new Error('research_response_size_limit_exceeded');
      return { finalUrl, ct, text, via: via ? via.kind : 'direct' }; }
    /* robots.txt (User-agent: * and ForgeMobile) — a disallow refuses the capture */
    async function robotsAllows(url) { const u = new URL(url); let txt = ''; try { txt = (await get(u.origin + '/robots.txt', 'text/plain|text/html|')).text; } catch (e) { return { allowed: true, basis: 'robots_unavailable' }; }
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
    const blocks = body.split(/<\/?(?:p|div|li|h[1-6]|section|article|br|tr|td|blockquote|pre)[^>]*>/i).map(b => b.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()).filter(b => b.length > 0);
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
  const api = { Crawler, validateUrl, htmlText, relevantExcerpt, search, capturePage, acquire, boundary, LIMITS, FETCH_INIT, VERSION };
  if (isNode) module.exports = api; else root.KCrawler = api;
})(typeof self !== 'undefined' ? self : this);
