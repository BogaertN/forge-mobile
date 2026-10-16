/* archives.js — trusted public archives for cited lookup (4.9.51). Read-only, no credentials, no cookies, CORS-readable from the browser (each verified
 * with an Origin header on 2026-10-16; see docs). Every result is evidence only, carries its archive, its source class and its URL, and is ranked by the
 * EMN evidence-over-consensus order: primary authority (statute, regulation, court opinion, regulator label, national-library health topic) >
 * peer-reviewed literature > structured reference (Wikidata) > encyclopedia (Wikipedia, handled by crawler.js). Which archives a question reaches is
 * decided by the lookup plan the language core builds from the parse and WordNet classes (kernel.lookupPlan), never by keywords here.
 * A yes/no verdict is given only by a structural check (Wikidata class / property membership) or by an excerpt that states the asked clause;
 * absence of evidence is never a "No". */
(function (root) {
  const RANK = { primary_authority: 4, peer_reviewed: 3, structured_reference: 2, encyclopedia: 1 };
  const ARCHIVES = [
    { id: 'medlineplus', name: 'MedlinePlus', publisher: 'U.S. National Library of Medicine', cls: 'primary_authority', domains: ['medical'], noun: 'health topic', api: 'https://connect.medlineplus.gov/service (ICD-10-CM via clinicaltables.nlm.nih.gov)', cors: 'Access-Control-Allow-Origin: *' },
    { id: 'openfda', name: 'openFDA', publisher: 'U.S. Food and Drug Administration', cls: 'primary_authority', domains: ['medical'], noun: 'drug label', api: 'https://api.fda.gov/drug/label.json', cors: 'Access-Control-Allow-Origin: *' },
    { id: 'pubmed', name: 'PubMed', publisher: 'U.S. National Library of Medicine (NCBI E-utilities)', cls: 'peer_reviewed', domains: ['medical'], noun: 'article', api: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/', cors: 'Access-Control-Allow-Origin: *' },
    { id: 'courtlistener', name: 'CourtListener', publisher: 'Free Law Project', cls: 'primary_authority', domains: ['legal'], noun: 'court opinion', api: 'https://www.courtlistener.com/api/rest/v4/search/', cors: 'Access-Control-Allow-Origin: <requesting origin>' },
    { id: 'ecfr', name: 'eCFR', publisher: 'U.S. Office of the Federal Register', cls: 'primary_authority', domains: ['legal', 'engineering'], noun: 'regulation', api: 'https://www.ecfr.gov/api/search/v1/results', cors: 'Access-Control-Allow-Origin: *' },
    { id: 'openalex', name: 'OpenAlex', publisher: 'OurResearch', cls: 'peer_reviewed', domains: ['engineering', 'science', 'medical', 'legal', 'general'], noun: 'paper', api: 'https://api.openalex.org/works', cors: 'Access-Control-Allow-Origin: *' },
    { id: 'crossref', name: 'Crossref', publisher: 'Crossref', cls: 'peer_reviewed', domains: ['engineering', 'science'], noun: 'paper', api: 'https://api.crossref.org/works', cors: 'Access-Control-Allow-Origin: *' },
    { id: 'wikidata', name: 'Wikidata', publisher: 'Wikimedia Foundation', cls: 'structured_reference', domains: ['*'], noun: 'record', api: 'https://www.wikidata.org/w/api.php', cors: 'Access-Control-Allow-Origin: * (origin=*)' }];
  const BY = Object.fromEntries(ARCHIVES.map(a => [a.id, a]));
  const INIT = { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'follow', mode: 'cors' };
  const strip = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
  const sentences = t => strip(t).split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/).filter(s => s.length > 20 && s.length < 600);
  /* term matching by stem: a term matches a word that starts with its first max(4, len-2) letters (cough ~ coughs, coughing; guilty ~ guilt) */
  const stem = w => String(w).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, Math.max(4, String(w).length - 2));
  const hits = (text, terms) => { const ws = String(text).toLowerCase().split(/[^a-z0-9]+/); return terms.filter(t => { const s = stem(t); return s && ws.some(w => w.startsWith(s)); }).length; };
  function bestSentence(text, terms) { let best = null, bs = -1; for (const s of sentences(text)) { const h = hits(s, terms); if (h > bs) { bs = h; best = s; } } return best ? { s: best, h: bs } : null; }
  async function getJSON(fetchF, url, ms) { const r = await Promise.race([fetchF(url, INIT), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms || 9000))]); if (!r.ok) throw new Error('http_' + r.status); return JSON.parse(await r.text()); }
  const ev = (id, title, url, excerpt, extra) => Object.assign({ archive: id, name: BY[id].name, cls: BY[id].cls, rank: RANK[BY[id].cls], noun: BY[id].noun, title: strip(title).slice(0, 160), url, excerpt: strip(excerpt).slice(0, 600) }, extra || {});
  const topic = p => (p.rel && p.rel.b) || p.entity || (p.isa && p.isa.x) || p.terms[0]; /* the thing the question is about: B in "is A a P of B" */
  const C = {};
  C.medlineplus = async (F, p) => { const t = topic(p); const ct = await getJSON(F, 'https://clinicaltables.nlm.nih.gov/api/conditions/v3/search?terms=' + encodeURIComponent(t) + '&df=primary_name&ef=icd10cm_codes&maxList=3');
    const codes = (ct[2] && ct[2].icd10cm_codes || []).map(c => String(c).split(',')[0]).filter(Boolean); const out = [];
    for (const code of codes.slice(0, 2)) { const m = await getJSON(F, 'https://connect.medlineplus.gov/service?mainSearchCriteria.v.cs=2.16.840.1.113883.6.90&mainSearchCriteria.v.c=' + encodeURIComponent(code) + '&knowledgeResponseType=application/json');
      for (const e of (m.feed && m.feed.entry) || []) { const sum = e.summary && e.summary._value; const b = bestSentence(sum, p.terms); if (b) out.push(ev('medlineplus', e.title && e.title._value, (e.link && e.link[0] && e.link[0].href || '').replace(/\?.*$/, ''), b.s, { score: b.h, text: strip(sum).slice(0, 4000) })); }
      if (out.length) break; } return out; };
  C.openfda = async (F, p) => { if (!p.drug) return []; const d = await getJSON(F, 'https://api.fda.gov/drug/label.json?search=openfda.generic_name:%22' + encodeURIComponent(p.drug) + '%22&limit=1'); const r = d.results && d.results[0]; if (!r) return [];
    const text = ['indications_and_usage', 'warnings', 'adverse_reactions', 'do_not_use', 'stop_use', 'purpose'].map(k => (r[k] || []).join(' ')).join(' '); const b = bestSentence(text, p.terms); return b ? [ev('openfda', (r.openfda && r.openfda.generic_name || [p.drug])[0] + ' drug label', 'https://open.fda.gov/apis/drug/label/', b.s, { score: b.h })] : []; };
  C.pubmed = async (F, p) => { const s = await getJSON(F, 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&sort=relevance&term=' + encodeURIComponent(p.terms.join(' AND '))); const ids = (s.esearchresult && s.esearchresult.idlist) || []; if (!ids.length) return [];
    const m = await getJSON(F, 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=' + ids.join(',')); return ids.map(id => m.result && m.result[id]).filter(Boolean).map(r => ev('pubmed', r.title, 'https://pubmed.ncbi.nlm.nih.gov/' + r.uid + '/', r.title, { score: hits(r.title, p.terms), year: String(r.pubdate || '').slice(0, 4), journal: r.source })); };
  C.courtlistener = async (F, p) => { const d = await getJSON(F, 'https://www.courtlistener.com/api/rest/v4/search/?type=o&q=' + encodeURIComponent(p.terms.join(' '))); return (d.results || []).slice(0, 3).map(r => { const sn = strip((r.opinions && r.opinions[0] && r.opinions[0].snippet) || ''); const b = bestSentence(sn, p.terms); return ev('courtlistener', r.caseName + (r.court ? ' (' + r.court + ')' : ''), 'https://www.courtlistener.com' + r.absolute_url, b ? b.s : sn.slice(0, 300), { score: hits(r.caseName + ' ' + sn, p.terms) }); }); };
  C.ecfr = async (F, p) => { const d = await getJSON(F, 'https://www.ecfr.gov/api/search/v1/results?per_page=3&query=' + encodeURIComponent(p.terms.join(' '))); return (d.results || []).map(r => { const h = r.hierarchy || {}; const ex = strip(r.full_text_excerpt || ''); return ev('ecfr', (r.headings && r.headings.section ? r.headings.section : 'section') + ' (' + h.title + ' CFR ' + h.section + ')', 'https://www.ecfr.gov/current/title-' + h.title + '/section-' + h.section, ex, { score: hits((r.headings && r.headings.section || '') + ' ' + ex, p.terms) }); }); };
  const abstractOf = inv => { if (!inv) return ''; const pos = []; for (const [w, ix] of Object.entries(inv)) for (const i of ix) pos[i] = w; return pos.join(' '); };
  C.openalex = async (F, p) => { const d = await getJSON(F, 'https://api.openalex.org/works?per-page=3&filter=has_abstract:true&search=' + encodeURIComponent(p.terms.join(' '))); return (d.results || []).map(r => { const ab = abstractOf(r.abstract_inverted_index); const b = bestSentence(ab, p.terms); return ev('openalex', r.display_name, r.doi || r.id, b ? b.s : String(r.display_name), { score: hits(r.display_name + ' ' + (b ? b.s : ''), p.terms), year: String(r.publication_year || '') }); }); };
  C.crossref = async (F, p) => { const d = await getJSON(F, 'https://api.crossref.org/works?rows=3&select=DOI,title,abstract,issued&query=' + encodeURIComponent(p.terms.join(' '))); return ((d.message && d.message.items) || []).map(r => { const t = (r.title || [''])[0]; const ab = strip(r.abstract || ''); const b = bestSentence(ab, p.terms); return ev('crossref', t, 'https://doi.org/' + r.DOI, b ? b.s : t, { score: hits(t + ' ' + ab, p.terms) }); }); };
  /* Wikidata: description record + structural yes/no checks (class membership P31/P279*, property membership "A is a P of B") */
  const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*&';
  const wdFind = async (F, q, type) => { const d = await getJSON(F, WD + 'action=wbsearchentities&language=en&limit=3&type=' + (type || 'item') + '&search=' + encodeURIComponent(q)); return d.search || []; };
  const wdGet = async (F, ids) => { const d = await getJSON(F, WD + 'action=wbgetentities&languages=en&props=labels|aliases|claims|descriptions&ids=' + ids.slice(0, 50).join('|')); return d.entities || {}; };
  const vals = (e, p) => ((e && e.claims && e.claims[p]) || []).map(c => c.mainsnak && c.mainsnak.datavalue && c.mainsnak.datavalue.value && c.mainsnak.datavalue.value.id).filter(Boolean);
  const names = e => !e ? [] : [e.labels && e.labels.en && e.labels.en.value].concat(((e.aliases && e.aliases.en) || []).map(a => a.value)).filter(Boolean).map(s => s.toLowerCase());
  const nameHit = (e, forms) => names(e).some(n => forms.some(f => n === f || n === f + 's' || n.replace(/s$/, '') === f));
  C.wikidata = async (F, p) => { const out = []; const q = p.isa ? p.isa.x : p.entity || p.terms[0]; const xs = await wdFind(F, q); if (!xs.length) return out; const x = xs[0];
    out.push(ev('wikidata', x.label + ' (' + x.id + ')', 'https://www.wikidata.org/wiki/' + x.id, x.label + ': ' + (x.description || ''), { score: hits(x.label + ' ' + (x.description || ''), p.terms) }));
    if (p.isa && p.yn) { let frontier = [x.id], seen = new Set([x.id]), path = {}; const yForms = p.isa.y; for (let depth = 0; depth < 4 && frontier.length; depth++) { const es = await wdGet(F, frontier); const next = [];
        for (const id of frontier) { const e = es[id]; if (depth > 0 && nameHit(e, yForms)) { out[0].verdict = { answer: 'Yes', check: 'Wikidata class membership (P31/P279)', via: (e.labels.en || {}).value }; return out; } for (const v of vals(e, 'P31').concat(vals(e, 'P279'))) if (!seen.has(v)) { seen.add(v); next.push(v); path[v] = id; } }
        frontier = next.slice(0, 40); } }
    if (p.rel && p.yn) { const bs = await wdFind(F, p.rel.b); const ps = await wdFind(F, p.rel.p, 'property'); if (bs.length && ps.length) { const es = await wdGet(F, [bs[0].id]); const b = es[bs[0].id];
        for (const pp of ps.slice(0, 2)) { const ids = vals(b, pp.id); if (!ids.length) continue; const ves = await wdGet(F, ids); const m = ids.find(id => nameHit(ves[id], p.rel.a));
          if (m) { out.unshift(ev('wikidata', bs[0].label + ' (' + bs[0].id + '), ' + pp.label + ' (' + pp.id + ')', 'https://www.wikidata.org/wiki/' + bs[0].id + '#' + pp.id, bs[0].label + ' — ' + pp.label + ': ' + ((ves[m].labels.en || {}).value || m), { score: 9, verdict: { answer: 'Yes', check: 'Wikidata property ' + pp.id + ' (' + pp.label + ')' } })); break; } } } }
    return out; };
  /* which archives a plan reaches: by its domains (from the parse + WordNet classes); Wikidata always; OpenAlex for every non-trivial content question */
  function route(plan) { const ds = new Set(plan.domains && plan.domains.length ? plan.domains : ['general']); return ARCHIVES.filter(a => a.domains.includes('*') || a.domains.some(d => ds.has(d))).map(a => a.id).filter(id => id !== 'openfda' || plan.drug); }
  /* a stated clause in an excerpt decides a yes/no question: every key term present and no negation of it → support; the same with "not/no/never" → contradict */
  function excerptVerdict(e, plan) { if (e.verdict) return e.verdict; if (!plan.yn || !plan.key || plan.key.length < 2 || e.rank < RANK.primary_authority) return null;
    /* only a primary authority's own sentence decides, and only when every key term (subject + predicate) falls inside one clause window of 12 words */
    for (const cl of e.excerpt.toLowerCase().split(/[.;:]/)) { const ws = cl.split(/[^a-z0-9]+/).filter(Boolean); for (let i = 0; i < ws.length; i++) { const win = ws.slice(i, i + 12).join(' '); if (hits(win, plan.key) === plan.key.length) { const neg = /\b(not|no|never|cannot|neither|nor)\b/.test(win); return { answer: neg === !!plan.neg ? 'Yes' : 'No', check: e.name + ' states the asked clause' + (neg ? ' (negated)' : '') }; } } }
    return null; }
  const near = (text, key, n) => { const need = Math.min(key.length, 2); const ws = String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); for (let i = 0; i < Math.max(1, ws.length - n + 1); i++) if (hits(ws.slice(i, i + n).join(' '), key) >= need) return true; return false; };
  /* prose: an excerpt that is a list of names / codes (most words capitalised or numeric) states nothing */
  const prose = t => { const ws = String(t).split(/\s+/).filter(Boolean); const caps = ws.filter(w => /^[A-Z0-9(§]/.test(w)).length; return ws.length >= 6 && caps / ws.length < 0.4; };
  /* relevance: two key terms (or all, when fewer) inside one 20-word window of the title or the excerpt (a list that merely contains the words is not about the question) */
  /* sentence: an excerpt is cited as whole sentences — the first sentence that carries the key terms, at most 320 characters; an elided
     fragment ("…") or a run-on title is not a citable statement */
  const sentence = (t, key) => { const ss = String(t).split(/(?<=[.!?])\s+(?=[A-Z])/); const pick = ss.find(x => hits(x, key) >= Math.min(2, key.length)) || ss[0]; return pick.length <= 320 ? pick : null; };
  const relevant = (e, plan) => { const key = plan.key && plan.key.length ? plan.key : plan.terms; if (!e.verdict) { if (/…/.test(e.excerpt)) return false; const one = sentence(e.excerpt, key); if (!one) return false; e.excerpt = one; } if (!e.verdict && !prose(e.excerpt)) return false; return !!e.verdict || near(e.title, key, 20) || near(e.excerpt, key, 20) || (e.archive === 'medlineplus' && hits(e.excerpt, key) >= 1); };
  async function consult(o) { const F = o.fetch || (typeof fetch !== 'undefined' ? fetch : null); const plan = o.plan; if (!F || !plan || !plan.terms || !plan.terms.length) return { evidence: [], consulted: [], errors: [] };
    const ids = route(plan); const errors = []; const res = await Promise.all(ids.map(id => C[id](F, plan).catch(e => { errors.push({ archive: id, reason: String(e && e.message || e) }); return []; })));
    let evidence = [].concat(...res).filter(e => e.excerpt && relevant(e, plan));
    /* A-NOMINAL-RETRY: literature indexes things, not the clause's verb ("asphalt be laid … winter") — when the full term set finds
       nothing, the nominal terms of the parse alone are searched and must co-occur */
    if (!evidence.length && plan.nominal && plan.nominal.length >= 2 && plan.nominal.length < plan.terms.length) { const p2 = Object.assign({}, plan, { terms: plan.nominal, key: plan.nominal.map(x => x.split(' ').pop()) });
      const r2 = await Promise.all(ids.filter(id => id !== 'wikidata').map(id => C[id](F, p2).catch(e => { errors.push({ archive: id, reason: String(e && e.message || e) }); return []; })));
      evidence = [].concat(...r2).filter(e => e.excerpt && relevant(e, p2)); }
    for (const e of evidence) { const v = excerptVerdict(e, plan); if (v) e.verdict = v; }
    evidence.sort((a, b) => (!!b.verdict - !!a.verdict) || (b.rank - a.rank) || (b.score - a.score));
    return { evidence: evidence.slice(0, 4), consulted: ids, errors, verdict: (evidence.find(e => e.verdict) || {}).verdict || null }; }
  const api = { ARCHIVES, RANK, consult, route, hits, stem, _C: C };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KArchives = api;
})(typeof self !== 'undefined' ? self : this);
