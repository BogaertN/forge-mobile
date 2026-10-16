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
  /* A-RATE (4.9.52): a 429 / 503 is retried after the server's Retry-After (or 0.5 s, 1 s, 2 s), at most 3 attempts; answers are cached per URL for one
     hour (memory, per session) so a repeated or follow-up question does not hit the archive again */
  const CACHE = new Map(), TTL = 3600e3; const wait = ms => new Promise(r => setTimeout(r, ms));
  async function getJSON(fetchF, url, ms) { const c = CACHE.get(url); if (c && Date.now() - c.at < TTL) return c.v;
    for (let a = 0; ; a++) { const r = await Promise.race([fetchF(url, INIT), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms || 9000))]);
      if ((r.status === 429 || r.status === 503) && a < 2) { const ra = Number(r.headers && r.headers.get && r.headers.get('retry-after')); await wait(ra > 0 && ra < 10 ? ra * 1000 : 500 * Math.pow(2, a)); continue; }
      if (!r.ok) throw new Error('http_' + r.status); const v = JSON.parse(await r.text()); CACHE.set(url, { at: Date.now(), v }); if (CACHE.size > 400) CACHE.delete(CACHE.keys().next().value); return v; } }
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
  C.courtlistener = async (F, p) => { const d = await getJSON(F, 'https://www.courtlistener.com/api/rest/v4/search/?type=o&highlight=on&q=' + encodeURIComponent(p.terms.join(' '))); return (d.results || []).slice(0, 3).map(r => { const sn = strip((r.opinions && r.opinions[0] && r.opinions[0].snippet) || ''); const b = bestSentence(sn, p.terms); return ev('courtlistener', r.caseName + (r.court ? ' (' + r.court + ')' : ''), 'https://www.courtlistener.com' + r.absolute_url, b ? b.s : sn.slice(0, 300), { score: hits(r.caseName + ' ' + sn, p.terms) }); }); };
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
  C.wikidata = async (F, p) => { const out = []; const q = p.isa ? p.isa.x : p.object || p.entity || p.terms[0]; const xs = await wdFind(F, q); if (!xs.length) return out; const x = xs[0];
    out.push(ev('wikidata', x.label + ' (' + x.id + ')', 'https://www.wikidata.org/wiki/' + x.id, x.label + ': ' + (x.description || ''), { score: hits(x.label + ' ' + (x.description || ''), p.terms) }));
    if (p.isa && p.yn) { let frontier = [x.id], seen = new Set([x.id]), path = {}; const yForms = p.isa.y; for (let depth = 0; depth < 4 && frontier.length; depth++) { const es = await wdGet(F, frontier); const next = [];
        for (const id of frontier) { const e = es[id]; if (depth > 0 && nameHit(e, yForms)) { out[0].verdict = { answer: 'Yes', check: 'Wikidata class membership (P31/P279)', via: (e.labels.en || {}).value }; return out; } for (const v of vals(e, 'P31').concat(vals(e, 'P279'))) if (!seen.has(v)) { seen.add(v); next.push(v); path[v] = id; } }
        frontier = next.slice(0, 40); } }
    if (p.rel && p.yn) { const bs = await wdFind(F, p.rel.b); const ps = await wdFind(F, p.rel.p, 'property'); if (bs.length && ps.length) { const es = await wdGet(F, [bs[0].id]); const b = es[bs[0].id];
        for (const pp of ps.slice(0, 2)) { const ids = vals(b, pp.id); if (!ids.length) continue; const ves = await wdGet(F, ids); const m = ids.find(id => nameHit(ves[id], p.rel.a));
          if (m) { out.unshift(ev('wikidata', bs[0].label + ' (' + bs[0].id + '), ' + pp.label + ' (' + pp.id + ')', 'https://www.wikidata.org/wiki/' + bs[0].id + '#' + pp.id, bs[0].label + ' — ' + pp.label + ': ' + ((ves[m].labels.en || {}).value || m), { score: 9, verdict: { answer: 'Yes', check: 'Wikidata property ' + pp.id + ' (' + pp.label + ')' } })); break; } } } }
    /* WD-VALUE (4.9.52): who / when / where / how-ADJ questions read the answer as a property value of the object's record: the property is found by
       Wikidata's own property search on the asked verb (write → author), or, for a degree adjective, the quantity claim whose label shares the
       adjective's root onset (deep ~ depth, long ~ length); the value is the answer, typed and cited */
    if (/^(person|date|place|quantity)$/.test(p.atype) && p.asked && p.object) { const xs2 = p.object === q ? xs : await wdFind(F, p.object); if (xs2.length) { const it = xs2[0]; const es = await wdGet(F, [it.id]); const e = es[it.id]; let props = [];
        if (p.atype === 'quantity') { const qp = Object.keys((e && e.claims) || {}).filter(k => e.claims[k].some(c => c.mainsnak && c.mainsnak.datatype === 'quantity')); if (qp.length) { const pe = await wdGet(F, qp.slice(0, 50)); const onset = x => { let i = 0; while (i < x.length && i < p.asked.length && x[i] === p.asked[i]) i++; return i; };
            const sc = qp.map(id => ({ id, label: (pe[id] && pe[id].labels.en || {}).value || id, n: Math.max(0, ...names(pe[id]).flatMap(n => n.split(' ')).map(onset)) })).filter(x => x.n >= 2).sort((a, b) => b.n - a.n); if (sc.length && (sc.length < 2 || sc[0].n > sc[1].n)) props = [sc[0]]; } }
        else props = (await wdFind(F, p.asked, 'property')).slice(0, 4).map(x => ({ id: x.id, label: x.label }));
        for (const pp of props) { const cl = ((e && e.claims && e.claims[pp.id]) || []).filter(c => c.mainsnak && c.mainsnak.datavalue); if (!cl.length) continue; const dv = cl[0].mainsnak.datavalue; let txt = null, unit = '';
          if (dv.type === 'wikibase-entityid') { const ids = cl.slice(0, 3).map(c => c.mainsnak.datavalue.value.id); const ve = await wdGet(F, ids); txt = ids.map(id => (ve[id] && ve[id].labels.en || {}).value).filter(Boolean).join(', '); }
          else if (dv.type === 'time') txt = String(dv.value.time).replace(/^\+/, '').replace(/T.*$/, '').replace(/-00-00$/, '').replace(/-00$/, '');
          else if (dv.type === 'quantity') { const u = String(dv.value.unit || '').split('/').pop(); if (/^Q\d+$/.test(u)) { const ue = await wdGet(F, [u]); unit = ' ' + ((ue[u] && ue[u].labels.en || {}).value || ''); } txt = String(Number(dv.value.amount)) + unit; }
          else if (dv.type === 'string') txt = dv.value;
          if (txt) { out.unshift(ev('wikidata', it.label + ' (' + it.id + '), ' + pp.label + ' (' + pp.id + ')', 'https://www.wikidata.org/wiki/' + it.id + '#' + pp.id, it.label + ' — ' + pp.label + ': ' + txt, { score: 9, value: txt, vtype: dv.type === 'wikibase-entityid' ? (p.atype === 'person' ? 'person' : 'item') : dv.type })); break; } } } }
    return out; };
  /* which archives a plan reaches: by its domains (from the parse + WordNet classes); Wikidata always; OpenAlex for every non-trivial content question */
  function route(plan) { const ds = new Set(plan.domains && plan.domains.length ? plan.domains : ['general']); return ARCHIVES.filter(a => a.domains.includes('*') || a.domains.some(d => ds.has(d))).map(a => a.id).filter(id => id !== 'openfda' || plan.drug); }
  /* V-POLARITY (4.9.52): a sentence answers "is S P?" when the subject term and the asked predicate (or one of its lexical negators, from WordNet glosses:
     acquit = "pronounce not guilty") stand in one clause within 8 words. Negation counts only in its scope — between the subject and the predicate or
     directly before the predicate ("found not guilty"); a negator word reverses polarity; a hedged or consensus clause (should, may, might, could, feel,
     believe, consensus, generally) states no verdict (EMN: consensus is not evidence). Absence never means No. */
  const NEGW = /^(not|no|never|neither|nor|cannot|without)$/, HEDGE = /^(should|may|might|could|would|feel|feels|believe|believed|consensus|generally|perhaps|possibly|whether|if)$/;
  function textVerdict(e, plan) { if (!plan.yn || !plan.pred) return null; const subj = stem(plan.entity ? plan.entity.split(' ').pop() : plan.terms[0]); const ps = stem(plan.pred), negs = (plan.negators || []).map(stem);
    for (const [from, src] of [['excerpt', e.excerpt], ['title', e.archive === 'wikidata' ? '' : e.title]]) for (const cl of String(src || '').toLowerCase().split(/[.;:?!]| but | however /)) { const ws = cl.split(/[^a-z0-9']+/).filter(Boolean);
      let si = ws.findIndex(w => w.startsWith(subj)); if (si < 0 && hits(e.title, [subj])) si = ws.findIndex(w => /^(he|she|it|they)$/.test(w)); if (si < 0) continue; /* the document's topic is the antecedent of a pronoun subject */
      const args = (plan.args || []).filter(a => stem(a) !== subj); if (args.length && hits(cl + ' ' + e.title, args) < args.length) continue; /* every nominal argument of the asked clause is mentioned */
      for (let k = Math.max(0, si - 8); k < Math.min(ws.length, si + 9); k++) { const isP = ws[k].startsWith(ps), isN = negs.some(n => ws[k].startsWith(n)); if (!isP && !isN) continue;
        const span = ws.slice(Math.min(si, k), Math.max(si, k) + 1); if (k < si) continue; if (span.some(w => HEDGE.test(w)) || ws.slice(0, si).some(w => HEDGE.test(w))) break; /* a hedged clause states nothing; other clauses may */
        const verbal = span.slice(1, -1).concat(ws.slice(Math.max(0, Math.min(si, k) - 2), Math.min(si, k))).some(w => /^(is|are|was|were|be|been|being|am|has|have|had|does|do|did)$/.test(w) || (/(ed|ing)$/.test(w) && w.length > 4 && !w.startsWith(subj)) || (plan.predForms || []).includes(w));
        if (!verbal && !isN) continue; /* a noun phrase ("tomato fruit development") predicates nothing: a verb or copula must link subject and predicate */
        const scopeNeg = (k > si ? span.slice(1, -1) : ws.slice(Math.max(0, k - 2), k)).some(w => NEGW.test(w)) || (k > 0 && NEGW.test(ws[k - 1]));
        const neg = isN !== scopeNeg; return { answer: neg === !!plan.neg ? 'Yes' : 'No', check: e.name + ' states ' + ws.slice(Math.min(si, k), Math.max(si, k) + 1).join(' ') + (isN ? ', where ' + ws[k] + ' means not ' + plan.pred : ''), from }; } }
    return null; }
  function excerptVerdict(e, plan) { return e.verdict || textVerdict(e, plan); }
  /* ANS-FIT (4.9.52): does an excerpt bind the question's typed gap? person → a personal name (two capitalised words outside the asked object) or a
     person value; date → a year or a dated day; quantity → a number with a unit; cause → a causal connective; method → an instrumental phrase;
     verdict → a polarity-bearing statement of the asked clause; description → a predicating clause. */
  const UNITS = { length: 'm|km|cm|mm|ft|feet|foot|metres?|meters?|miles?|kilometres?|kilometers?|inches|in|yards?|fathoms?|storeys?|stories|floors', mass: 'kg|g|lbs?|pounds?|tons?|tonnes?|grams?|kilograms?', time: 'years?|months?|weeks?|days?|hours?|minutes?|seconds?', temperature: '°[cf]|degrees?|kelvin|k', speed: 'km/h|mph|m/s|knots?', strength: 'psi|pa|kpa|mpa|gpa|n|kn|mn|newtons?|ksi' };
  const unitRe = dims => new RegExp('\\b\\d[\\d,.]*\\s?(?:' + (dims && dims.length ? dims.map(d => UNITS[d]).join('|') : Object.values(UNITS).join('|') + '|percent|%') + ')(?![a-z])', 'i');
  const UNIT = /\b\d[\d,.]*\s?(?:m|km|cm|mm|ft|feet|foot|metres?|meters?|miles?|kilometres?|kilometers?|inches|in|kg|g|lbs?|pounds?|tons?|tonnes?|psi|pa|kpa|mpa|gpa|n|kn|mn|°[cf]|degrees?|percent|%|years?|months?|days?|hours?|minutes?|seconds?|storeys?|stories|floors)\b/i;
  function fit(e, plan) { const t = String(e.excerpt || ''); const a = plan.atype || 'description';
    if (e.value) return a === 'person' ? e.vtype === 'person' : a === 'date' ? e.vtype === 'time' : a === 'quantity' ? e.vtype === 'quantity' : a === 'place' ? e.vtype === 'item' : false;
    if (a === 'verdict') return !!excerptVerdict(e, plan);
    if (a === 'person' && plan.askedForms && plan.askedForms.length && new RegExp('\\b[A-Z][a-z]{2,}(?:\\s[A-Z][a-z]+)?\\s(?:[a-z]+ly\\s)?(?:' + plan.askedForms.join('|') + ')\\b|\\b(?:' + plan.askedForms.join('|') + ')\\sby\\s[A-Z][a-z]+').test(t)) return true; /* "Jefferson largely wrote …" / "written by Jefferson" */
    if (a === 'person') { const obj = new Set(String(plan.object || '').split(' ').map(x => x.toLowerCase())); return /(?:[a-z,;]\s)([A-Z][a-z]+(?:\s[A-Z]\.)?\s[A-Z][a-z]+)/.test(t.replace(/\b[A-Z][a-z]+\b/g, w => obj.has(w.toLowerCase()) ? 'x' : w)); }
    if (a === 'date') return /\b(1[0-9]{3}|20[0-9]{2})\b/.test(t);
    if (a === 'quantity') return unitRe(plan.dims).test(t);
    if (a === 'cause') return /\b(because|due to|caused by|causes?|result(?:s|ed)? (?:of|from)|leads? to|owing to)\b/i.test(t);
    if (a === 'method') return /\b(by (?:means of )?[a-z]+ing|using|uses?|through (?:a|an|the)|via|works by|consists of)\b/i.test(t);
    return /\b(is|are|was|were|means|refers|provides|requires|shall|must)\b/i.test(t); }
  /* ASSESS: excerpts that fit lead; source class breaks ties only among them; contradicting verdicts are reported with their ranks and the EMN
     rule (the higher authority decides; equal authorities leave the answer undetermined) */
  function assess(evidence, plan) { for (const e of evidence) { if (!e.verdict) { const v = textVerdict(e, plan); if (v) e.verdict = v; } e.fit = fit(e, plan); }
    const r = evidence.slice().sort((a, b) => (b.fit - a.fit) || (b.rank - a.rank) || ((b.score || 0) - (a.score || 0)));
    const vs = r.filter(e => e.verdict); const yes = vs.filter(e => e.verdict.answer === 'Yes').sort((a, b) => b.rank - a.rank), no = vs.filter(e => e.verdict.answer === 'No').sort((a, b) => b.rank - a.rank);
    let verdict = null, conflict = null; if (yes.length && no.length) { const y = yes[0], n = no[0]; const win = y.rank > n.rank ? y : n.rank > y.rank ? n : null; conflict = { yes: y, no: n, winner: win }; verdict = win ? win.verdict : null; }
    else if (vs.length) verdict = vs.sort((a, b) => b.rank - a.rank)[0].verdict;
    const lead = conflict ? (conflict.winner || conflict.yes) : (verdict ? r.find(e => e.verdict === verdict) : r[0]); const ranked = lead ? [lead].concat(r.filter(e => e !== lead)) : r;
    return { lead: lead || null, ranked, verdict, conflict, fits: !!(lead && lead.fit) }; }
  const near = (text, key, n) => { const need = Math.min(key.length, 2); const ws = String(text).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean); for (let i = 0; i < Math.max(1, ws.length - n + 1); i++) if (hits(ws.slice(i, i + n).join(' '), key) >= need) return true; return false; };
  /* prose: an excerpt that is a list of names / codes (most words capitalised or numeric) states nothing */
  const prose = t => { const ws = String(t).split(/\s+/).filter(Boolean); const caps = ws.filter(w => /^[A-Z0-9(§]/.test(w)).length; return ws.length >= 6 && caps / ws.length < 0.4; };
  /* relevance: two key terms (or all, when fewer) inside one 20-word window of the title or the excerpt (a list that merely contains the words is not about the question) */
  /* sentence: an excerpt is cited as whole sentences — the first sentence that carries the key terms, at most 320 characters; an elided
     fragment ("…") or a run-on title is not a citable statement */
  const sentence = (t, key) => { const ss = String(t).split(/(?<=[.!?])\s+(?=[A-Z])/); const pick = ss.find(x => hits(x, key) >= Math.min(2, key.length)) || ss[0]; return pick.length <= 320 ? pick : null; };
  const relevant = (e, plan) => { const key = plan.key && plan.key.length ? plan.key : plan.terms; if (!e.verdict) { if (/…/.test(e.excerpt)) return false; const one = sentence(e.excerpt, key); if (!one) return false; e.excerpt = one; } if (!e.verdict && !prose(e.excerpt)) return false; if (!e.verdict && e.rank >= RANK.primary_authority && e.archive !== 'medlineplus' && hits(e.title + ' ' + e.excerpt, key) < key.length) return false; /* A-PRIMARY-ALL: a primary authority must carry every key term */ return !!e.verdict || near(e.title, key, 20) || near(e.excerpt, key, 20) || (e.archive === 'medlineplus' && hits(e.excerpt, key) >= 1); };
  async function consult(o) { const F = o.fetch || (typeof fetch !== 'undefined' ? fetch : null); const plan = o.plan; if (!F || !plan || !plan.terms || !plan.terms.length) return { evidence: [], consulted: [], errors: [] };
    const ids = route(plan); const errors = []; const res = await Promise.all(ids.map(id => C[id](F, plan).catch(e => { errors.push({ archive: id, reason: String(e && e.message || e) }); return []; })));
    let evidence = [].concat(...res).filter(e => e.excerpt && relevant(e, plan));
    /* A-NOMINAL-RETRY: literature indexes things, not the clause's verb ("asphalt be laid … winter") — when the full term set finds
       nothing, the nominal terms of the parse alone are searched and must co-occur */
    if (!evidence.length && plan.nominal && plan.nominal.length >= 2 && plan.nominal.length < plan.terms.length) { const p2 = Object.assign({}, plan, { terms: plan.nominal, key: plan.nominal.map(x => x.split(' ').pop()) });
      const r2 = await Promise.all(ids.filter(id => id !== 'wikidata').map(id => C[id](F, p2).catch(e => { errors.push({ archive: id, reason: String(e && e.message || e) }); return []; })));
      evidence = [].concat(...r2).filter(e => e.excerpt && relevant(e, p2)); }
    const as = assess(evidence, plan);
    return { evidence: as.ranked.slice(0, 5), consulted: ids, errors, verdict: as.verdict, conflict: as.conflict, fits: as.fits }; }
  const api = { ARCHIVES, RANK, consult, assess, fit, textVerdict, route, hits, stem, _C: C, _cache: CACHE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KArchives = api;
})(typeof self !== 'undefined' ? self : this);
