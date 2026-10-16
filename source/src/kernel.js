(function (root) {
const isNode = typeof module !== 'undefined' && module.exports;
const L = isNode ? require('./lexicon.js') : root.KLexicon;
const M = isNode ? require('./kmath.js') : root.KMath;
const A = isNode ? require('./algebra.js') : root.KAlgebra;
const CA = isNode ? require('./calculus.js') : root.KCalc;
const SIM = isNode ? require('./sim.js') : root.KSim; const HY = isNode ? require('./hypothesis.js') : root.KHyp; const RD = isNode ? require('./render.js') : root.KRender; const PF = isNode ? require('./protoforge.js') : root.KProtoForge; const EDE = isNode ? require('./ede.js') : root.KEDE; const SY = isNode ? require('./symbols.js') : root.KSymbols;
const G = isNode ? require('./grammar.js') : root.KGrammar;
const D = isNode ? require('./derive.js') : root.KDerive;
const IF = isNode ? require('./infer.js') : root.KInfer;
const R = isNode ? require('./reason.js') : root.KReason;
const WR = isNode ? require('./world_rules.js') : root.KWorldRules; const EVO = isNode ? require('./evolve.js') : root.KEvolve; const KN = isNode ? require('./knowledge.js') : root.KKnow;
const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const TB = isNode ? require('./toolbench.js') : root.KTools;
const OP = isNode ? require('./operator.js') : root.KOperator;

const CATEGORIES = ['shared_outbox', 'shared_inbox', 'shared_knowledge', 'shared_challenges', 'user_tools', 'economy_capsules', 'economy_events', 'usage_events', 'usage_counts', 'reminders', 'request_receipts', 'request_policy_gaps', 'hypotheses', 'admitted_rules', 'ede_calibration', 'economy_seen', 'economy_quarantine', 'pf_echo', 'pf_agents', 'pf_drift_log', 'mea_seals', 'capsules', 'council', 'promotions', 'device', 'attribution_ledger', 'attribution_foreign', 'ledger_conflicts', 'synced_items', 'sync_log', 'ui_errors', 'rejected_meanings', 'admission_queue', 'sim_runs', 'node_jobs', 'node_pairing', 'symbol_index', 'migrations', 'memory', 'evidence', 'language_examples', 'trace', 'cold_storage', 'lexicon_user', 'meta', 'policy', 'permissions', 'held_writes', 'loops', 'collapse_events', 'drift_archive', 'containment_receipts', 'tool_invocations', 'feedback', 'profiles', 'consent', 'buyers', 'offers', 'consent_ledger', 'export_packages', 'jobs', 'workbench_events', 'web_evidence', 'fetch_path'];
const ALL_STORES = [...new Set(CATEGORIES.concat(['gks_facts', 'case_index', 'economy_manifests', 'shared_drafts', 'economy_foreign', 'receipts', 'shared_cursor', 'vault', 'signing_key', 'buyers', 'consent', 'consent_ledger', 'export_packages', 'offers', 'profiles', 'workbench_events', 'device', 'economy_events', 'usage_events', 'attribution_ledger', 'attribution_foreign', 'memory', 'meta', 'migrations', 'policy', 'permissions', 'trace', 'e2ee_queue', 'e2ee_cursor', 'gks_pinned']))].sort();
const GEN_KEY = 'kernel.__gen', GEN_PREV_KEY = 'kernel.__gen_prev';
function MemoryStore(backend) { const mem = {}; const b = backend || { get: k => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null), set: (k, v) => { mem[k] = String(v); }, del: k => { delete mem[k]; }, keys: () => Object.keys(mem) };
  const gen = () => { const v = b.get(GEN_KEY); const n = v == null ? 0 : Number(v); return Number.isInteger(n) && n >= 0 ? n : 0; };
  const pre = g => (g ? 'kernel.g' + g + '.' : 'kernel.');
  const dfl = cat => (cat === 'meta' ? {} : []);
  const rawLoad = (g, cat) => { const v = b.get(pre(g) + cat); return v ? JSON.parse(v) : dfl(cat); };
  function namesIn(g) { const out = new Set(ALL_STORES); if (b.keys) { const p = pre(g); for (const k of b.keys()) { if (!k.startsWith(p)) continue; const c = k.slice(p.length); if (!c || c === 'probe' || c.startsWith('__') || (!g && /^g\d+\./.test(c))) continue; out.add(c); } } return [...out].sort(); }
  function stageGeneration(data, hook) { const from = gen(); const to = from + 1; const names = [...new Set(namesIn(from).concat(Object.keys(data || {})))].sort(); const want = {};
    for (const c of names) want[c] = JSON.stringify(data && Object.prototype.hasOwnProperty.call(data, c) ? data[c] : rawLoad(from, c));
    for (const c of names) b.set(pre(to) + c, want[c]);
    if (hook) hook({ save: (c, v) => b.set(pre(to) + c, JSON.stringify(v)) }); /* test hook: a backend that does not keep what was written */
    const bad = names.filter(c => b.get(pre(to) + c) !== want[c]); return { from, to, names, bad }; }
  function commitGeneration(st) { if (!st || st.bad.length) throw new Error('STAGE-NOT-VERIFIED'); if (gen() !== st.from) throw new Error('STAGE-STALE');
    b.set(GEN_PREV_KEY, JSON.stringify({ prev: st.from, staged: st.to }));
    b.set(GEN_KEY, String(st.to));
    if (b.del && b.keys) { try { for (const k of b.keys()) { const m = /^kernel\.g(\d+)\./.exec(k); const g = m ? Number(m[1]) : (/^kernel\.(?!__|g\d+\.)/.test(k) && k !== 'kernel.probe' ? 0 : -1); if (g >= 0 && g !== st.to && g !== st.from) b.del(k); } } catch (e) { /* collection is optional; the commit already happened */ } }
    return { active: st.to, prev: st.from }; }
  function rollbackGeneration() { const v = b.get(GEN_PREV_KEY); let m = null; try { m = v ? JSON.parse(v) : null; } catch (e) { m = null; }
    if (!m || m.staged !== gen() || !Number.isInteger(m.prev)) return { ok: false, rule: 'RB-NO-PRE-RESTORE-GENERATION' };
    b.set(GEN_KEY, String(m.prev)); try { b.set(GEN_PREV_KEY, JSON.stringify({ prev: null, staged: null, rolled_back_from: m.staged })); } catch (e) { /* pointer already switched */ } return { ok: true, active: m.prev, from: m.staged }; }
  const hasRollback = () => { try { const m = JSON.parse(b.get(GEN_PREV_KEY) || 'null'); return !!(m && m.staged === gen() && Number.isInteger(m.prev)); } catch (e) { return false; } };
  return { load(cat) { return rawLoad(gen(), cat); }, save(cat, val) { b.set(pre(gen()) + cat, JSON.stringify(val)); }, categories: CATEGORIES, allStores: ALL_STORES,
    generation: gen, stageGeneration, commitGeneration, rollbackGeneration, hasRollback, generationKeys: g => namesIn(g == null ? gen() : g).map(c => pre(g == null ? gen() : g) + c) }; }
function canon(o) { if (Array.isArray(o)) return '[' + o.map(canon).join(',') + ']'; if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(o[k])).join(',') + '}'; return JSON.stringify(o); }
const clone = o => JSON.parse(JSON.stringify(o));
const r4 = M.r4;

const CAT2POS = { entity: 'n', term: 'n', time: 'n', attribute: 'a', action: 'v', math: 'v' };
function Lexicon(store) {
  const seed = L.SEED_CONCEPTS.map(c => Object.assign({}, c, { surfaces: c.surfaces.map(x => x.toLowerCase()) }));
  const user = store.load('lexicon_user'); const wn = { core: null, ext: null };
  const all = () => seed.concat(user);
  let ix; const reindex = () => { ix = Object.create(null); for (const c of all()) { if (c.retired) continue; for (const s of c.surfaces) (ix[s] = ix[s] || []).push(c); } }; reindex();
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const wnEntry = l => (wn.core && own(wn.core.L, l) && wn.core.L[l]) || (wn.ext && own(wn.ext.L, l) && wn.ext.L[l]) || null;
  const controlled = w => (ix[w] || []).filter(c => c.category !== 'function' && c.category !== 'number');
  function hasPos(l, p) { const e = wnEntry(l); if (e && e.some(x => x[0] === p)) return true; if (e) return false; return controlled(l).some(c => c.surfaces[0] === l && (CAT2POS[c.category] === p || (p === 'n' && c.category === 'social'))); }
  function senses(l) { const out = []; const tier = wn.core && own(wn.core.L, l) ? 'core' : 'extended'; const LN = wn.core ? wn.core.meta.lexnames : [];
    for (const [p, ss, q] of wnEntry(l) || []) for (const [id, lx, gl, fr] of ss) out.push({ sid: 'wn30:' + id, pos: p, lexname: LN[lx] || lx, gloss: gl, frames: [...fr].map(ch => ch.charCodeAt(0) - 48), tier, quarantined_other: q, provenance: 'Princeton WordNet 3.0', license: 'WordNet 3.0 License', doc8_state: tier === 'core' ? 'admitted (SemCor-attested)' : 'admitted-extended (lower assurance)' });
    return out; }
  function lookup(w) { if (/^\d+(\.\d+)?$/.test(w)) return [{ id: 'NUM.LITERAL', category: 'number', senses: [{ sid: 'NUM.LITERAL.s1', gloss: 'numeral ' + w }] }]; const b = w.replace(/'s$/, ''); return ix[w] || ix[b] || []; }
  function addConcept({ surface, gloss, category, example, supersede }) {
    surface = String(surface || '').trim().toLowerCase(); gloss = String(gloss || '').trim();
    if (!/^[a-z][a-z'\-]{0,40}$/.test(surface) || !gloss) return { ok: false, reason: 'surface must be one lowercase word and gloss is required' };
    { const Pv = typeof P !== 'undefined' ? P : (isNode ? require('./privacy.js') : root.KPrivacy); if (Pv.redact(surface + ' ' + (gloss || '')).secrets.length) return { ok: false, reason: 'PRIV: the entry contains a sensitive value; admitted concepts are stored in plaintext, so it is refused' }; }
    const existing = lookup(surface).filter(c => c.id !== 'NUM.LITERAL');
    if (existing.length && !supersede) return { ok: false, conflict: existing.map(c => ({ id: c.id, status: c.status, gloss: c.senses[0].gloss })), reason: 'surface already exists; adding requires explicit supersede (new version), never silent overwrite' };
    if (existing.some(c => c.status === 'seed')) return { ok: false, reason: 'seed (controlled) concepts cannot be superseded from the UI', conflict: existing.map(c => ({ id: c.id, status: c.status })) };
    const prev = existing.find(c => c.status === 'user-admitted'); const id = prev ? prev.id : 'U.' + surface.toUpperCase().replace(/[^A-Z]/g, '_'); const version = prev ? prev.version + 1 : 1; const at = new Date().toISOString();
    const c = { id, senses: [{ sid: id + '.s' + version, gloss }], surfaces: [surface], category: category || 'entity', source: 'user-admitted', status: 'user-admitted', version, provenance: 'user', license: 'user-owned', doc8_state: 'admitted (user authority)', history: prev ? prev.history.concat([{ version: prev.version, gloss: prev.senses[0].gloss, retired_at: at }]) : [], admitted_at: at };
    if (prev) prev.retired = true; user.push(c); store.save('lexicon_user', user); reindex();
    if (example) { const ex = store.load('language_examples'); ex.push({ concept: id, version, example, at }); store.save('language_examples', ex); }
    return { ok: true, concept: c };
  }
  const LICENCES = ['user-owned', 'CC0-1.0', 'public-domain', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'WordNet-3.0'];
  const shaQ = t => sha256(t);
  function proposeConcept(o) { const q = store.load('admission_queue'); const surface = String(o.surface || '').trim().toLowerCase(), gloss = String(o.gloss || '').trim();
    const rec = { id: 'adm:' + (q.length + 1) + ':' + surface, surface, gloss, category: o.category || 'entity', example: o.example || '', licence: String(o.licence || ''), evidence: String(o.evidence || '').trim().slice(0, 500), supersede: !!o.supersede, state: 'quarantined', proposed_at: new Date().toISOString(), checks: [] };
    rec.content_sha256 = shaQ(JSON.stringify([rec.surface, rec.gloss, rec.licence, rec.evidence])); q.push(rec); store.save('admission_queue', q); return inspectConcept(rec.id); }
  function inspectConcept(id) { const q = store.load('admission_queue'); const rec = q.find(x => x.id === id); if (!rec) return { ok: false, reason: 'no such admission record' }; if (rec.state !== 'quarantined') return { ok: false, reason: 'already ' + rec.state, record: rec };
    const Pv = typeof P !== 'undefined' ? P : (isNode ? require('./privacy.js') : root.KPrivacy); const existing = lookup(rec.surface).filter(c => c.id !== 'NUM.LITERAL');
    const checks = [['ADM-SURFACE-FORM', /^[a-z][a-z'\-]{0,40}$/.test(rec.surface) && !!rec.gloss], ['ADM-LICENCE-ADMITTED', LICENCES.includes(rec.licence)], ['ADM-EVIDENCE-PRESENT', rec.evidence.length >= 3],
      ['ADM-PRIVACY', !Pv.redact(rec.surface + ' ' + rec.gloss + ' ' + rec.evidence).secrets.length], ['ADM-NO-SILENT-OVERWRITE', !existing.length || rec.supersede], ['ADM-SEED-PROTECTED', !existing.some(c => c.status === 'seed')], ['ADM-HASH', rec.content_sha256 === shaQ(JSON.stringify([rec.surface, rec.gloss, rec.licence, rec.evidence]))]];
    rec.checks = checks.map(([rule, pass]) => ({ rule, pass })); rec.state = checks.every(c => c[1]) ? 'inspected' : 'rejected'; if (rec.state === 'rejected') rec.reason = checks.filter(c => !c[1]).map(c => c[0]).join(', '); rec.inspected_at = new Date().toISOString(); store.save('admission_queue', q);
    return { ok: rec.state === 'inspected', record: rec, reason: rec.reason || null }; }
  function approveConcept(id, userTap) { const q = store.load('admission_queue'); const rec = q.find(x => x.id === id); if (!rec || rec.state !== 'inspected') return { ok: false, reason: 'only an inspected record can be approved' }; if (userTap !== true) return { ok: false, reason: 'ADM-USER-TAP-REQUIRED' };
    const r = addConcept({ surface: rec.surface, gloss: rec.gloss, category: rec.category, example: rec.example, supersede: rec.supersede }); if (!r.ok) { rec.state = 'rejected'; rec.reason = r.reason; store.save('admission_queue', q); return r; }
    const c = user.find(x => x.id === r.concept.id && x.version === r.concept.version); if (c) { c.license = rec.licence; c.evidence = rec.evidence; c.admission = rec.id; c.content_sha256 = rec.content_sha256; c.doc8_state = 'admitted (quarantine → inspected → user-approved)'; store.save('lexicon_user', user); reindex(); }
    rec.state = 'admitted'; rec.admitted_at = new Date().toISOString(); rec.concept = r.concept.id + ' v' + r.concept.version; store.save('admission_queue', q); return { ok: true, concept: c || r.concept, record: rec }; }
  function rejectConcept(id, reason) { const q = store.load('admission_queue'); const rec = q.find(x => x.id === id); if (!rec || rec.state === 'admitted') return { ok: false }; rec.state = 'rejected'; rec.reason = String(reason || 'user rejected'); store.save('admission_queue', q); return { ok: true, record: rec }; }
  const exc = x => (wn.core && own(wn.core.exc, x) ? wn.core.exc[x] : undefined);
  const known = w => !!(G.CL[w] || wnEntry(w) || ix[w] || G.lemmatize(w, { hasPos, exc, controlled }).length);
  const isName = w => { const e = wnEntry(w); return !!(e && e.some(([p, ss]) => p === 'n' && ss.some(s => s[1] === 15 || s[1] === 18))); };
  const lexnameOf = l => { const e = wnEntry(l); if (!e) return null; const n = e.find(x => x[0] === 'n'); return n && wn.core ? wn.core.meta.lexnames[n[1][0][1]] : null; };
  const coreNoun = w => !!(wn.core && own(wn.core.L, w) && wn.core.L[w].some(e => e[0] === 'n') && !isName(w));
  return { LICENCES, proposeConcept, inspectConcept, approveConcept, rejectConcept, admissions: () => store.load('admission_queue'), lookup, addConcept, all, controlled, hasPos, senses, known, isName, lexnameOf, exc, coreNoun,
    attach(data, tier) { wn[tier] = data; },
    stats() { return { controlled: all().filter(c => !c.retired).length, user_admitted: user.length, wordnet_core: wn.core ? Object.keys(wn.core.L).length : 0, wordnet_extended: wn.ext ? Object.keys(wn.ext.L).length : 0, wn_meta: wn.core ? wn.core.meta.stats : null }; },
    count: () => all().filter(c => !c.retired).length + (wn.core ? Object.keys(wn.core.L).length : 0) + (wn.ext ? Object.keys(wn.ext.L).length : 0), wn };
}

const NUMW = Object.assign(Object.create(null), { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000 });
function mathSurface(s) {
  let t = s.replace(/^(?:what is|what are|calculate|compute|evaluate|how much is|what does)\s+/, '').replace(/\s+(?:equal|equals|make)$/, '');
  t = t.replace(/^(add|sum) (.+?) (?:and|to) (.+)$/, '($2) + ($3)').replace(/^subtract (.+?) from (.+)$/, '($2) - ($1)').replace(/^multiply (.+?) (?:by|and) (.+)$/, '($1) * ($2)').replace(/^divide (.+?) by (.+)$/, '($1) / ($2)');
  t = t.replace(/\bthe square root of\b|\bsquare root of\b|\bsqrt of\b|√/g, ' sqrt ').replace(/(\S+) percent of (\S+)/g, '($1/100*$2)')
    .replace(/\bmultiplied by\b|\btimes\b|×/g, ' * ').replace(/\bdivided by\b|\bover\b|÷/g, ' / ').replace(/\bplus\b/g, ' + ').replace(/\bminus\b|−/g, ' - ')
    .replace(/\bto the power of\b|\braised to\b/g, ' ^ ').replace(/\bsquared\b/g, ' ^ 2 ').replace(/\bcubed\b/g, ' ^ 3 ');
  t = t.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[- ](one|two|three|four|five|six|seven|eight|nine)\b/g, (m, a, b) => String(NUMW[a] + NUMW[b]));
  t = t.replace(/\b([a-z]+)\b/g, w => (w in NUMW ? String(NUMW[w]) : w)).replace(/\s+/g, ' ').trim();
  if (!/\d/.test(t) || /[a-z]/.test(t.replace(/sqrt/g, ''))) return null; if (!/[-+*/^]|sqrt/.test(t)) return null; return t;
}
const algebraText = s => s.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/²/g, '^2').replace(/\s+/g, ' ').trim();

const SENSITIVE = /\b(pin|password|passcode|passphrase|secret|code|ssn|passport|cvv|cvc|iban|token|key|login|combination|card number|account number|routing number|security number|license number|licence number|seed phrase|recovery phrase)\b/;
const P = isNode ? require('./privacy.js') : root.KPrivacy;
const Gv = isNode ? require('./governance.js') : root.KGov; const CT = isNode ? require('./containment.js') : root.KContain;
const SINGLE_ATTR = new Set('name age birthday address phone email job colour color favorite favourite capital height weight number surname nickname'.split(' '));
const EXCLUSIVE = [new Set('red blue green yellow black white orange purple pink brown gray grey silver gold'.split(' ')), new Set(['alive', 'dead']), new Set(['married', 'single', 'divorced']), new Set(['open', 'closed']), new Set(['true', 'false']), new Set(['hot', 'cold', 'warm']), new Set(['happy', 'sad']), new Set(['young', 'old'])];
const SINGLE_VERB = new Set(['live', 'reside', 'work']);
const WEATHER = new Set(['rain', 'snow', 'hail', 'drizzle', 'thunder', 'pour']);
const BYPASS = /\b(ignore (all |any |your |the |previous |prior )*(rules|instructions|validation|checks)|bypass|skip (the )?(validation|echo|checks?)|without (checking|validation|echo)|jailbreak|developer mode|disable (your )?(rules|echo|validation)|system prompt|pretend (you are|to be)|override (your )?(rules|safety))\b/;

function Kernel(opts) {
  opts = opts || {};
  /* private case files (4.9.42, plan §2): while a case is open, the case-scoped stores are a separate namespace case:<id>:<store>; nothing outside the case
     sees them, and the shared layer reads only the global namespace (SHARED-CASEFILE-NEVER-SHARED). At rest a closed case is sealed with the vault key. */
  const baseStore = opts.store || MemoryStore(); let caseNS = null, pendingCase; const CASE_CATS = new Set(['memory', 'evidence', 'cold_storage', 'reminders', 'trace']);
  const nsOf = c => (caseNS && CASE_CATS.has(c) ? caseNS + ':' + c : c);
  const store = Object.assign(Object.create(baseStore), { load: c => baseStore.load(nsOf(c)), save: (c, v) => baseStore.save(nsOf(c), v) });
  /* GKS shared facts: the build-manifest seed plus facts ingested from a verified GKS snapshot (store gks_facts); read-only premises with provenance */
  const gksFacts = () => { const st = baseStore.load('gks_facts') || []; return KN.SEED.filter(f => !st.some(x => x.id === f.id)).concat(st).filter(f => f.status !== 'retracted'); };
  /* nouns of shared-fact subjects are lexicon entries supplied by the shared layer (grow by lexicon, not by phrases) */
  let gksN = null, gksNSig = ''; const GKS_N = () => { const fs = gksFacts(), sig = fs.length + ':' + (fs[fs.length - 1] || {}).id; if (gksN && sig === gksNSig) return gksN; gksNSig = sig; gksN = new Set(); for (const f of fs) for (const t of [f.subject].concat(f.aliases || []).join(' ').toLowerCase().split(/\s+/)) if (!G.CL[t]) gksN.add(t); return gksN; };
  const npKey = n => { const y = JSON.parse(JSON.stringify(G.material(n))); delete y.det; delete y.plural; delete y.adjs; return canon(Object.assign(y, { adjs: (G.material(n).adjs || []) })); };
  let gksIdx = null, gksSig = '';
  const gksIndex = () => { const fs = gksFacts(), sig = fs.map(f => f.id + f.status).join('|'); if (gksIdx && sig === gksSig) return gksIdx; gksSig = sig;
    gksIdx = fs.map(f => { const keys = [f.subject].concat(f.aliases || []).map(t => npOnly(G.tokenize(t))).filter(Boolean).map(npKey); let clause = null; try { const d = derive(G.tokenize(f.text.replace(/[.]$/, ''))); clause = d.parses.length === 1 ? d.parses[0].node.clause : null; } catch (e) { clause = null; } return { f, keys, clause }; }); return gksIdx; };
  const lex = Lexicon(store);
  if (opts.lexicon) lex.attach(opts.lexicon, 'core'); if (opts.lexiconExt) lex.attach(opts.lexiconExt, 'ext');
  let meta = Object.assign({ turn: 0, loop: 1, chi: 0, phaseHistory: [], last: null, discourse: [], alias: {}, pending: null, notation: 'plain', reasoning: null }, store.load('meta'));
  const saveMeta = () => store.save('meta', meta);
  const now = () => (opts.clock ? opts.clock() : new Date().toISOString());
  const perm = opts.perm || Gv.PermissionService(store, { clock: now }); const cont = CT.Containment(store, { clock: now, perm }); const bench = TB.Bench(store, { clock: now, perm });
  const fmtTime = opts.formatTime || (iso => iso.replace('T', ' ').slice(0, 16) + ' UTC');
  const glex = { hasPos: (l, p) => lex.hasPos(l, p) || (p === 'v' && SELF_V.has(l)) || (p === 'n' && (SELF_N.has(l) || GKS_N().has(l))), /* Forge's own self-query words are lexicon entries of the kernel (closed class), so they parse even with no WordNet lexicon */ exc: lex.exc, controlled: lex.controlled, known: w => lex.known(w) || GKS_N().has(String(w).toLowerCase()), isName: lex.isName, coreNoun: lex.coreNoun };
  const activeFacts = () => store.load('memory').filter(r => r.kind !== 'note' && r.status === 'active');
  const notes = () => store.load('memory').filter(r => r.kind === 'note' && r.status === 'active');
  const content = toks => toks.filter(t => !/^[?.!]$/.test(t.w));
  const isUnk = (t, i) => G.analyse(t, i, glex).every(a => a.tag === 'UNK');
  const unknownToks = toks => [...new Set(toks.filter(isUnk).map(t => t.w))];

  function canonPred(c) { // P-BARE-CANON: bare nominal predicate ≡ adjectival predicate with the same words (one material meaning)
    if (!c || typeof c !== 'object') return c; if (c.coord) { c.coord.forEach(canonPred); return c; }
    const bare = x => x.head && !x.det && !x.owner && !x.quant && !x.num && !x.of && !x.rel;
    if (c.pred && c.pred.type === 'np') { const n = c.pred.np; if (bare(n)) c.pred = { type: 'adj', words: (n.adjs || []).concat(n.surface || n.head) }; else if (n.conj && n.conj.every(bare)) c.pred = { type: 'adj', words: [].concat(...n.conj.map((x, i) => (i ? [n.op] : []).concat(x.adjs || [], x.surface || x.head))) }; }
    if (c.cond) canonPred(c.cond); if (c.roles && c.roles.karma && c.roles.karma.clause) canonPred(c.roles.karma.clause); if (c.subj && c.subj.rel) canonPred(c.subj.rel);
    return c;
  }
  function canonNPs(c) { // NP-ADJ-NOUN-CANON: leading compound members that are adjectives are modifiers (one material meaning)
    const fixNP = n => { if (!n || typeof n !== 'object') return; if (n.clause) return walk(n.clause); if (n.head && n.head.length > 1) { while (n.head.length > 1 && lex.hasPos(n.head[0], 'a')) { n.adjs = (n.adjs || []).concat([(n.surface || n.head)[0]]); n.head = n.head.slice(1); if (n.surface) n.surface = n.surface.slice(1); } }
      if (n.conj) n.conj.forEach(fixNP); if (n.owner && typeof n.owner === 'object') fixNP(n.owner); if (n.of) fixNP(n.of); if (n.rel) walk(n.rel); };
    const walk = x => { if (!x) return; if (x.coord) return x.coord.forEach(walk); fixNP(x.subj); if (x.pred && x.pred.np) fixNP(x.pred.np); Object.values(x.roles || {}).forEach(fixNP); (x.adj || []).forEach(a => fixNP(a.np)); walk(x.cond); };
    walk(c); return c; }
  const animNP = n => !!n && (n.pron === 'user' || n.pron === 'kernel' || (n.pron3 && n.pron3 !== 'it') || (n.propn && featsOf(n).anim) || (n.head && featsOf(n).anim) || (n.conj && n.conj.every(animNP)));
  const okKaraka = c => !c || (c.coord ? c.coord.every(okKaraka) : !(c.roles && c.roles.sampradana && c.roles.karma && !animNP(c.roles.sampradana)) && okKaraka(c.cond)); // K-SAMPRADANA-ANIMACY (Doc5: recipient is a sentient participant)
  function derive(toks) { const P = G.Parser(content(toks), glex); const all = P.sentence().map(r => ({ node: { type: r.node.type, clause: canonNPs(canonPred(clone(r.node.clause))) }, rules: r.rules.filter(Boolean) })), A = M.rsocAdmit(all, r => okKaraka(r.node.clause), r => canon(G.material(r.node))); for (const k in A.ops) rsIn[k] = (rsIn[k] || 0) + A.ops[k]; return { parses: A.kept, T: P.T }; }
  let rsIn = {};
  const swap = Object.assign(Object.create(null), { my: 'your', your: 'my', i: 'you', me: 'you', you: 'i', mine: 'yours', yours: 'mine', myself: 'yourself', yourself: 'myself', am: 'are' });
  const swapToks = text => G.tokenize(text).map(t => Object.assign(swap[t.w] ? { w: swap[t.w], orig: swap[t.w], i0: t.i0 } : t, { rendered: true }));
  /* held-reading ancestry (Pāṇini paper D6 L6861–6893; RSOC ⧧ hold → ⧙ after clarification): a clause whose reading the user chose keeps its natural
     surface; on re-parse, the user's own earlier choice (not a frequency guess) selects among the readings */
  const heldKeys = () => new Set(heldNow.concat(activeFacts().filter(r => r.clause && r.clause.resolved_reading).map(r => canon(G.material(r.clause))))); let heldNow = [];
  function reparseClause(text) { const d = derive(swapToks(text)); if (!d.parses.length) return null; const ks = new Set(d.parses.map(p => canon(G.material(p.node.clause)))); if (ks.size === 1) return d.parses[0].node.clause;
    const H = heldKeys(), hit = d.parses.filter(p => H.has(canon(G.material(p.node.clause)))); return hit.length && new Set(hit.map(p => canon(G.material(p.node.clause)))).size === 1 ? hit[0].node.clause : null; }
  function npOnly(toks) { toks = content(toks); const P = G.Parser(toks, glex); const r = P.np(0).filter(x => x.i === toks.length); return r.length ? clone(r[0].node) : null; }
  const reparseNP = text => npOnly(swapToks(text));
  const parseNP = text => npOnly(G.tokenize(text));

  function entKey(n) { if (!n) return null; let k;
    if (n.pron === 'user') k = 'user'; else if (n.pron === 'kernel') k = 'kernel'; else if (n.propn) k = 'name:' + n.propn.toLowerCase(); else if (n.quote !== undefined) k = 'quote:' + n.quote;
    else if (n.conj) k = 'conj:' + n.conj.map(entKey).join('+'); else if (n.num && !n.head) k = 'num:' + n.num;
    else { const own = n.owner === 'user' ? 'user/' : n.owner === 'kernel' ? 'kernel/' : n.owner && typeof n.owner === 'object' && !n.owner.pron3 ? entKey(n.owner) + '/' : ''; k = (own || 'thing:') + (n.head || []).join(' ') + (n.of ? ' of ' + entKey(n.of) : ''); }
    return meta.alias[k] || k; }
  const entKeys = n => (n && n.conj ? n.conj.map(entKey) : [entKey(n)]);
  function featsOf(n) { if (n.propn) { const ln = lex.isName(n.propn.toLowerCase()) ? lex.lexnameOf(n.propn.toLowerCase()) : null; return ln === 'noun.location' ? { g: 'n', anim: false, n: 'sg' } : { g: 'u', anim: true, n: 'sg' }; } if (n.conj) return { g: 'u', anim: true, n: 'pl' }; const h = n.head && n.head[n.head.length - 1]; if (!h) return { g: 'n', anim: false, n: 'sg' };
    const num = n.plural ? 'pl' : 'sg'; if (G.FEMALE.has(h)) return { g: 'f', anim: true, n: num }; if (G.MALE.has(h)) return { g: 'm', anim: true, n: num };
    const ln = lex.lexnameOf(h); if (G.PERSONISH.has(h) || ln === 'noun.person') return { g: 'u', anim: true, n: num }; return { g: 'n', anim: false, animal: ln === 'noun.animal', n: num }; }
  function nps(c, out) { out = out || []; if (!c) return out; if (c.coord) { c.coord.forEach(x => nps(x, out)); return out; }
    const visit = n => { if (!n || typeof n !== 'object') return; if (n.clause) { nps(n.clause, out); return; } out.push(n); if (n.conj) n.conj.forEach(visit); if (n.owner && typeof n.owner === 'object') visit(n.owner); if (n.of) visit(n.of); if (n.rel) nps(Object.assign({}, n.rel, { subj: null }), out); };
    visit(c.subj); if (c.pred && c.pred.np) visit(c.pred.np); for (const v of Object.values(c.roles || {})) visit(v); for (const a of c.adj || []) if (a.np) visit(a.np); if (c.cond) nps(c.cond, out); return out; }
  let refBind = null;
  function resolveRefs(c, rules) {
    const problems = [];
    const fix = (holder, key, ctx) => { const n = holder[key]; if (!n || typeof n !== 'object') return; const viaOwner = !n.pron3 && n.owner && n.owner.pron3; if (!n.pron3 && !viaOwner) { if (n.conj) n.conj.forEach((x, i) => fix(n.conj, i, ctx)); return; }
      const pr = n.pron3 || n.owner.pron3; const w = { his: 'he', him: 'he', her: 'she', its: 'it', their: 'they', them: 'they' }[pr] || pr;
      if (w === 'it' && ctx && ctx.verb && (WEATHER.has(ctx.verb.lemma) || (ctx.verb.lemma === 'be' && ctx.pred && ctx.pred.type === 'adj' && /^(late|early|cold|hot|warm|sunny|raining|dark|windy)$/.test(ctx.pred.words[0])))) { rules.push({ id: 'REF-EXPLETIVE-IT', doc: 'Doc6 §23 (non-referential "it")' }); return; }
      if (['we', 'us', 'our'].includes(pr)) { problems.push({ word: pr, options: [] }); rules.push({ id: 'REF-UNRESOLVED', doc: 'Doc6 §23', note: pr }); return; }
      if (refBind && refBind.pr === pr) { const ante = Object.assign(clone(refBind.np), { resolvedFrom: pr }); if (viaOwner) n.owner = ante; else holder[key] = ante; rules.push({ id: 'REF-BOUND-BY-CLARIFICATION', doc: 'Doc6 §30, §34; Pāṇini paper D6 L6861–6893 (held candidate keeps its ancestry)', note: pr + ' → ' + G.npText(refBind.np, 'kernel') + refBind.note }); return; }
      const cands = []; const seen = new Set();
      for (const d of meta.discourse.filter(d => (d.turn || 0) >= meta.turn - 2)) { const ok = w === 'it' ? !d.f.anim : w === 'they' ? d.f.n === 'pl' : d.f.anim && (d.f.g === 'u' || d.f.g === (w === 'she' ? 'f' : 'm')); if (ok && !seen.has(d.key)) { seen.add(d.key); cands.push(d); } }
      if (cands.length === 1) { const ante = Object.assign(clone(cands[0].np), { resolvedFrom: pr }); if (viaOwner) n.owner = ante; else holder[key] = ante; rules.push({ id: 'REF-RESOLVED-UNIQUE', doc: 'Doc6 §23; Doc3 §19', note: pr + ' → ' + cands[0].key }); }
      else { problems.push({ word: pr, options: cands.map(x => G.npText(x.np, 'kernel')) }); rules.push({ id: cands.length ? 'REF-AMBIGUITY-HELD-OPEN' : 'REF-UNRESOLVED', doc: 'Doc6 §23, §29', note: pr + ': ' + cands.length + ' candidates' }); } };
    const walk = cl => { if (!cl) return; if (cl.coord) return cl.coord.forEach(walk); fix(cl, 'subj', cl); if (cl.pred && cl.pred.np) fix(cl.pred, 'np', cl); for (const k of Object.keys(cl.roles || {})) { if (cl.roles[k] && cl.roles[k].clause) walk(cl.roles[k].clause); else fix(cl.roles, k, cl); } for (const a of cl.adj || []) if (a.np) fix(a, 'np', cl); if (cl.cond) walk(cl.cond); };
    walk(c); return problems.length ? { clarify: problems[0] } : { ok: true };
  }
  function pushDiscourse(c) { const add = []; for (const n of nps(c)) { if (n.pron || n.pron3 || n.quote !== undefined || (n.num && !n.head)) continue; if ((n.propn && G.TIMEW.has(n.propn.toLowerCase())) || (n.head && n.head.length === 1 && G.TIMEW.has(n.head[0]))) continue; const k = entKey(n); if (!k || add.some(a => a.key === k)) continue; const np = clone(n); delete np.rel; delete np.resolvedFrom; add.push({ key: k, np, f: featsOf(n), turn: meta.turn }); }
    meta.discourse = add.concat(meta.discourse.filter(d => !add.some(a => a.key === d.key))).slice(0, 8); }

  function senseInfo(c) { if (!c || c.coord || !c.verb || c.verb.lemma === 'be') return null; const ss = lex.senses(c.verb.lemma).filter(s => s.pos === 'v'); if (!ss.length) return { status: 'controlled-or-unknown', rule: 'K-SENSE-CONTROLLED' };
    const FR = lex.wn.core ? lex.wn.core.meta.verb_frames : {}; const anim = c.subj && (c.subj.pron || c.subj.propn || featsOf(c.subj).anim); const obj = c.roles && c.roles.karma; const objAnim = obj && !obj.clause && (obj.pron || obj.propn || featsOf(obj).anim);
    const fits = s => s.frames.some(f => { const fr = FR[f] || ''; if (!fr) return false; if (anim && !/^Somebody/.test(fr)) return false; if (!anim && /^Somebody/.test(fr)) return false; if (obj && obj.clause) return /CLAUSE/.test(fr); if (obj) return objAnim ? /----s somebody/.test(fr) : /----s something/.test(fr); return /----s$/.test(fr) || /----s PP$/.test(fr) || /----s (to|on) /.test(fr); });
    const ok = ss.filter(fits); const pick = ok.length ? ok : ss;
    return { status: pick.length === 1 ? 'selected' : 'held-open', rule: ok.length ? 'K-SENSE-FRAME-FILTER' : 'K-SENSE-NO-FRAME-MATCH', candidates: pick.map(s => s.sid + ' ' + s.gloss).slice(0, 6), total: ss.length }; }

  const predOf = c => (c && c.verb ? c.verb.lemma : null);
  /* stored facts as binary relation edges (typed relations first, then any two-entity clause) — the anchors of exploration and the facts admitted rules run over */
  function ruleEdges(mem) { const edges = INF.relEdges(mem).map(e => Object.assign({}, e)); const typed = new Set(edges.map(e => e.id));
    for (const r of mem) { if (typed.has(r.id) || !r.entities || r.entities.length !== 2 || r.clause.coord || r.clause.cond) continue; edges.push({ id: r.id, a: r.entities[0], b: r.entities[1], rel: r.pred === 'be' ? 'isa' : r.pred, neg: r.clause.verb && r.clause.verb.pol === 'neg' }); } return edges; }
  const ruleFacts = mem => ruleEdges(mem).map(e => ({ id: e.id, atom: { predicate: e.rel, args: [e.a, e.b], polarity: e.neg ? 'neg' : 'pos' } }));
  const admittedRules = () => store.load('admitted_rules').filter(r => r.status === 'admitted').map(r => r.rule);
  /* GELC promotion gate: the rule must be range-restricted, must PROVE its own claim from stored facts (RuleProof replayed by the independent checker),
     and the rule together with every admitted rule must derive nothing whose opposite is stated. A high score or a tap alone never admits. */
  function admissionCheck(rule, claim) { const facts = ruleFacts(activeFacts().filter(r => !r.sensitive)), all = admittedRules().concat([rule]); let rw;
    try { rw = R.ruleWorld(facts, all); } catch (e) { return { ok: false, rule: 'ADM-UNSAFE-RULE' }; }
    const F = facts.filter(f => canon(f.atom) !== canon(claim)); let pr = null; try { pr = R.ruleWorld(F, all).prove(claim); } catch (e) { pr = null; } /* held out: the claim must follow from the OTHER facts through the rule */
    if (!pr || !pr.rule_ids.includes(rule.id) || !R.checkRuleProof(F, all, pr).ok) return { ok: false, rule: 'ADM-NO-REPLAYED-SUPPORT' };
    const stated = new Set(facts.map(f => canon(f.atom))), bad = rw.atoms().filter(a => stated.has(canon(Object.assign({}, a, { polarity: a.polarity === 'neg' ? 'pos' : 'neg' }))));
    return bad.length ? { ok: false, rule: 'ADM-CONTRADICTS-STATED', conflicts: bad } : { ok: true, proof: pr, support: pr.fact_ids }; }
  const roleKey = c => { const o = {}; for (const [k, v] of Object.entries(c.roles || {})) o[k] = v && v.clause ? canon(G.material(v.clause)) : entKey(v); for (const a of c.adj || []) (o['adj:' + (a.prep || a.role)] = o['adj:' + (a.prep || a.role)] || []).push(a.np ? entKey(a.np) : a.time || a.adv); return o; };
  const restr = n => n && !n.conj && (n.rel || n.relObj) ? canon(G.material(n.rel || n.relObj)) : null; /* LL-RESTRICTOR-EXACT: a relative clause restricts its head ("eagles that can fly" ≠ "eagles that fly"); a question restrictor must equal the stored one — no inflation from a looser or different restrictor */
  const subjMatch = (qs, rs) => { if (!qs) return true; if (rs && restr(qs) !== null && restr(qs) !== restr(rs)) return false; /* a restricted fact never answers an unrestricted yes/no (see exact) */ const b = entKeys(rs); return entKeys(qs).every(k => b.includes(k)); };
  let sideRules = []; let pendingRender = null; let stagedHyps = [];
  const QCLASS = q => (q === 'every' || q === 'each' || q === 'all') ? 'univ' : q || null;
  function scopeOf(c) { if (!c || c.coord || !c.subj || QCLASS(c.subj.quant) !== 'univ') return null; const k = c.roles && c.roles.karma; if (!k || k.clause || !(k.det === 'a' || k.det === 'an' || k.quant === 'some')) return null;
    return { selected: '∀x∃y', preserved: ['∃y∀x'], rule: 'LL-QSCOPE-SURFACE' }; }
  const wantsSame = q => Object.values(q.roles || {}).some(v => v && !v.clause && (v.adjs || []).includes('same'));
  function predEq(q, c) { if (!q.pred && !c.pred) return true; if (!q.pred || !c.pred) return false; const qn = q.pred.np, cn = c.pred.np; if (qn && cn) return canon(entKeys(qn)) === canon(entKeys(cn)) || canon(qn.head) === canon(cn.head); return canon(G.material(q.pred)) === canon(G.material(c.pred)); }
  function singularPred(pred) { if (!pred || pred.type !== 'adj' || (pred.words || []).length !== 1) return pred; const w = pred.words[0]; const lem = (lex.lemmas ? lex.lemmas(w, 'n') : []).find(l => l !== w) || (/s$/.test(w) && lex.senses(w.replace(/s$/, '')).some(x => x.pos === 'n') ? w.replace(/s$/, '') : null);
    return lem ? { type: 'np', np: { adjs: [], head: [lem], plural: false, surface: [lem], det: /^[aeiou]/.test(lem) ? 'an' : 'a' } } : pred; }
  function virtualFacts(facts) { const out = []; const plain = facts.filter(r => !r.clause.coord && !r.clause.cond);
    for (const r of facts) { const c = r.clause; if (c.coord) { if (c.op === 'and' || !c.op) for (const part of c.coord) if (!part.coord && !part.cond) out.push({ clause: part, from: [r.id], rule: 'INF-CONJ-ELIM', doc: 'Doc6 §21 (P and Q ⊢ P)' }); continue; }
      if (c.subj && c.subj.conj && c.subj.op === 'and' && !c.cond) for (const part of c.subj.conj) out.push({ clause: Object.assign({}, c, { subj: part, pred: singularPred(c.pred) }), from: [r.id], rule: 'INF-COORD-DISTRIBUTE', doc: 'Doc3 coordination (collective “and” predicate distributes over conjuncts; Doc6 §21)' });
      if (c.cond && c.verb.mod === 'asserted') { const m = plain.find(f => canon(G.material(f.clause)) === canon(G.material(c.cond))); if (m) { const cc = Object.assign({}, c); delete cc.cond; out.push({ clause: cc, from: [r.id, m.id], rule: 'INF-MODUS-PONENS', doc: 'Doc6 §21 (if P then Q; P ⊢ Q)' }); } } }
    return out; }
  /* karmaṇi ≡ kartari (Pāṇini 1.4.49 kāraka invariance; Doc5): a passive with an explicit kartā has the same kāraka structure as its active; matching
     compares the kāraka-normal (active) form, the stored surface is never rewritten */
  function actv(c) { if (!c || c.coord || !c.verb || c.verb.voice !== 'passive' || !c.roles || !c.roles.karta || c.roles.karma) return c; const roles = Object.assign({}, c.roles); const ag = roles.karta; delete roles.karta; roles.karma = c.subj;
    const verb = Object.assign({}, c.verb); delete verb.voice; delete verb.form; return Object.assign({}, c, { subj: ag, roles, verb }); }
  function matches(q, gap, r) { const c = actv(r.clause); q = actv(q); if (c.coord) return false; if (predOf(q) !== predOf(c)) return false; if (q.subj && c.subj && QCLASS(q.subj.quant) !== QCLASS(c.subj.quant)) return false; if (wantsSame(q) && scopeOf(c)) { sideRules.push({ id: 'LL-QSCOPE-INVERSE-NOT-ENTAILED', doc: 'Doc3 scope; Doc6 §27 no hidden inference', note: '∃y∀x was preserved, not selected' }); return false; } if (gap !== 'subj' && !subjMatch(q.subj, c.subj)) return false;
    const qk = roleKey(q), rk = roleKey(c); for (const [k, v] of Object.entries(qk)) { if (!(k in rk)) return false; if (canon(v) !== canon(rk[k]) && !(Array.isArray(v) && v.every(x => rk[k].includes(x)))) return false; }
    if (gap === 'subj' && q.pred && canon(G.material(q.pred)) !== canon(G.material(c.pred))) return false;
    if (gap && gap.startsWith('role:')) { const role = gap.slice(5); if (role === 'karma') return !!(c.roles && c.roles.karma); return (c.adj || []).some(a => a.role === role) || (role === 'adhikarana' && c.pred && (c.pred.type === 'pp' || c.pred.type === 'adv')); }
    if (gap === 'pred') return !!c.pred; return true; }
  const factsAbout = key => activeFacts().filter(r => r.entities.some(e => e === key || e.startsWith(key + '/') || e.includes('+' + key) || e.includes(key + '+')));
  /* self-query lexical classes (4.9.38): words, not phrases — the parse supplies the frame */
  const SELF_COGN = new Set(['know', 'remember', 'recall']), SELF_SAY = new Set(['tell', 'say', 'mention']), SELF_SHOW = new Set(['list', 'show', 'display', 'read', 'give']);
  const SELF_MEAN_V = new Set(['mean', 'define', 'explain']), SELF_MEAN_N = new Set(['meaning', 'definition']);
  const SELF_V = new Set(['repeat', 'echo', 'print', 'output', 'help', 'use', 'do', 'remember', 'recall', 'tell', 'say', 'mention', 'list', 'show', 'display', 'mean', 'define', 'explain', 'text']), /* capability-frame verbs: verb-class entries read only in the capability frame position (not added to the general parse, where e.g. "sealed" stays adjectival) */ CAP_V = new Set(['edit', 'change', 'update', 'tag', 'link', 'delete', 'remove', 'forget', 'search', 'find', 'seal', 'remind', 'explore', 'simulate', 'preview', 'run', 'analyze', 'analyse', 'check', 'spawn', 'hibernate', 'restore', 'send', 'research', 'look', 'read', 'follow', 'capture', 'clip', 'save', 'index', 'replay', 'reflect', 'start', 'reset', 'convert', 'differentiate', 'integrate', 'solve', 'simplify', 'expand', 'factor', 'factorise', 'factorize', 'evaluate', 'compute', 'use', 'list', 'show', 'store', 'keep', 'memorize', 'memorise', 'write', 'erase', 'note', 'open', 'close']), SELF_N = new Set(['colour', 'color', 'reminder', 'status', 'drift', 'phase', 'help', 'command', 'time', 'day', 'date', 'term', 'fact', 'thing', 'memory', 'note', 'meaning', 'definition']);
  const SELF_EXT = new Set('send email mail text message post share publish tweet purchase order pay book open launch run execute install download upload call browse search play stream navigate translate schedule'.split(' ')); /* external-effect verb class (lexical) */
  const SELF_STATUS_N = new Set(['status', 'drift', 'phase']), SELF_HELP_N = new Set(['help', 'command']), SELF_TIME_N = new Set(['time', 'day', 'date']);
  const SELF_QUOTE_V = new Set(['say', 'repeat', 'echo', 'print', 'output']);
  const COLOUR = new Set('red orange yellow green blue purple violet pink brown black white grey gray silver gold beige turquoise navy maroon cyan magenta'.split(' ')), ATTR_CLASS = { colour: COLOUR, color: COLOUR }; /* closed value class for the attribute noun colour */
  const MEM_V = new Set(['remember', 'store', 'save', 'keep', 'memorize', 'memorise']); /* memory-write directive verb class */
  const SELF_PERC = new Set(['see', 'notice', 'observe', 'spot']);
  const SELF_REC = { fact: 'facts', thing: 'facts', memory: 'facts', note: 'notes', reminder: 'reminders' };
  const SELF_CAPS = new Set(['remember', 'recall', 'note', 'calculate', 'compute', 'define', 'explain', 'count', 'list', 'help', 'add', 'multiply', 'subtract', 'divide', 'solve', 'simplify', 'convert']);
  const LIFECYCLE = new Set(['propose', 'install', 'uninstall', 'fail', 'revert', 'deploy', 'approve', 'reject', 'release', 'withdraw', 'cancel', 'complete', 'succeed', 'pass']);
  function lifecycle(c) { if (!c || c.coord || !c.verb || c.verb.pol !== 'pos' || c.verb.tense !== 'past' || (c.roles && c.roles.karma && (c.roles.karma.clause || c.roles.karma.inf || c.roles.karma.ger))) return null; const l = c.verb.lemma, pt = c.verb.particle;
    return LIFECYCLE.has(l) && !pt ? l : l === 'roll' && pt === 'back' ? 'roll back' : null; }
  const holder = c => (c.verb.voice !== 'passive' && c.roles && c.roles.karma ? c.roles.karma : c.subj); // the status-bearing entity: the karma of an active, the surface subject otherwise
  function conflicts(c) { if (c.coord) return []; const out = [];
    const noPol = x => { const y = clone(G.material(x)); y.verb.pol = null; return canon(y); };
    for (const r of activeFacts()) { const o = r.clause; if (o.coord || predOf(o) !== predOf(c) || !subjMatch(c.subj, o.subj) || canon(G.material(o.cond || null)) !== canon(G.material(c.cond || null))) continue;
      if (canon(G.material(o)) === canon(G.material(c))) continue;
      if (noPol(o) === noPol(c)) { out.push({ r, why: 'MEM-CONFLICT-POLARITY' }); continue; }
      if (o.verb.pol !== 'pos' || c.verb.pol !== 'pos' || o.verb.mod !== c.verb.mod) continue;
      if (predOf(c) === 'be' && o.pred && c.pred) { const head = c.subj.head ? c.subj.head[c.subj.head.length - 1] : null;
        if (head && SINGLE_ATTR.has(head) && o.pred.type !== 'pp' && c.pred.type !== 'pp') out.push({ r, why: 'MEM-CONFLICT-SINGLE-VALUED-ATTRIBUTE' });
        else if (o.pred.type === 'adj' && c.pred.type === 'adj' && EXCLUSIVE.some(s => o.pred.words.every(w => s.has(w)) && c.pred.words.every(w => s.has(w)))) out.push({ r, why: 'MEM-CONFLICT-EXCLUSIVE-CLASS' }); }
      else if (SINGLE_VERB.has(predOf(c)) && (o.adj || []).some(a => a.role === 'adhikarana') && (c.adj || []).some(a => a.role === 'adhikarana') && !(c.adj || []).some(a => a.role === 'kala')) out.push({ r, why: 'MEM-CONFLICT-SINGLE-VALUED-VERB' }); }
    return out; }
  const hasMod = c => (c.coord ? c.coord.some(hasMod) : c.verb && c.verb.mod !== 'asserted');
  const setMod = (c, m) => { if (c.coord) c.coord.forEach(x => setMod(x, m)); else if (c.verb) { c.verb.mod = m; if (c.verb.tense === 'future') c.verb.tense = 'present'; } };
  function describe(c) { if (c.coord) return c.coord.map(describe).join(' + '); const r = ['subject: ' + G.npText(c.subj, 'kernel'), 'verb: ' + c.verb.lemma]; if (c.pred && c.pred.type === 'adjinf') r.push('predicate: ' + G.clauseText({ subj: { propn: 'X' }, verb: { lemma: 'be', tense: 'present', pol: 'pos', mod: 'asserted' }, pred: c.pred }, 'kernel').slice(5), (c.pred.ctrl === 'karta' ? 'kartā of ' : 'karma of ') + c.pred.inf.verb.lemma + ': ' + G.npText(c.subj, 'kernel') + (c.pred.ctrl === 'karta' ? ' (it does the ' + c.pred.inf.verb.lemma + 'ing)' : ' (it undergoes the ' + c.pred.inf.verb.lemma + 'ing)')); else if (c.pred) r.push('predicate: ' + (c.pred.type === 'adj' ? c.pred.words.join(' ') : (c.pred.prep ? c.pred.prep + ' ' : '') + G.npText(c.pred.np, 'kernel'))); for (const [k, v] of Object.entries(c.roles || {})) r.push(k + ': ' + (v.clause ? '[clause]' : G.npText(v, 'kernel'))); for (const a of c.adj || []) r.push(a.role + ': ' + (a.time || a.adv || a.prep + ' ' + G.npText(a.np, 'kernel'))); const relT = []; for (const n of nps(c)) for (const rc of [n.rel, n.relObj]) if (rc && rc.verb) relT.push(rc.verb.lemma + ' (' + rc.verb.tense + ')'); if (relT.length) r.push('relative verb: ' + relT.join(', ')); r.push('tense: ' + c.verb.tense); return r.join(', '); }
  const ruleDoc = id => /^K-/.test(id) ? 'Doc5 karaka roles' : /^LL-/.test(id) ? 'Doc3 Language Law' : /^M-/.test(id) ? 'Doc4 morphology / WordNet exceptions' : /^TAG-/.test(id) ? 'Doc4 lexicon tagging' : /^(NP|V|P|G)-/.test(id) ? 'Doc3 / R0 derivation' : 'kernel';

  const META = [
  ];
  const entWord = e => String(e).toLowerCase().replace(/^.*[:/]/, '');
  const clauseWords = (x, out) => { if (typeof x === 'string') out.add(x.toLowerCase()); else if (x && typeof x === 'object') for (const v of Object.values(x)) clauseWords(v, out); return out; };
  function asksAboutStored(text) { // a bare question is a memory question only when one of its open-class words names something in a stored fact
    const ws = G.tokenize(String(text)).map(t => String(t.w).toLowerCase()).filter(w => /^[a-z][a-z'-]*$/.test(w) && !G.CL[w]); if (!ws.length) return false;
    return activeFacts().some(r => { const have = clauseWords(r.clause, new Set((r.entities || []).map(entWord))); return ws.some(w => have.has(w)); }); }
  function evaluate(raw, low, ctx) {
    if (!ctx.raw) { ctx.raw = raw; ctx.low = low; }
    const rules = [], g = { expectancy: 'pass', congruity: 'pass', connectedness: 'pass', purpose: 'pass' };
    const res = (outcome, material, extra) => Object.assign({ outcome, material, gates: g, rules, frame: 'none', act: 'unknown' }, extra || {});
    const worldResult = rr => { rules.push(...(rr.rules || [])); if (rr.reasoningState) ctx.reasoningState = rr.reasoningState; return res(rr.outcome, rr.material, { frame: rr.frame, act: rr.act, uncertainty: rr.uncertainty, reasoningCandidates: rr.reasoningCandidates, reasoningState: rr.reasoningState }); };
    if (ctx.worldPreflight && ctx.worldPreflight.handled) return worldResult(ctx.worldPreflight);
    const clarifyUnknown = ws => { if (/\?\s*$/.test(ctx.raw || raw) || /^(?:who|whom|what|which|where|when|why|how|is|are|does|do)\b/i.test(ctx.low || low)) { const rr = R.evaluate(ctx.raw || raw, { bareWh: true }); if (rr.handled) return worldResult(rr); } g.connectedness = 'unknown-concept'; rules.push({ id: 'LX-UNKNOWN', doc: 'Doc4 unknown-concept state; Doc3 §41', note: ws.join(', ') }); return res('CLARIFICATION_REQUIRED', { kind: 'clarify_unknown', words: ws }, { frame: ctx.frame || 'FR.UNKNOWN', act: 'unknown' }); };
    if (meta.pending) { const p = meta.pending; /* 4.9.41 reconnect grammar for a held question (no phrase set): a polarity particle (closed class), or a VP whose
         verb class decides polarity (replace/do/overwrite → yes; keep/retain → no) over the held item (pronoun it/that, or "the old one"); an ordinal/cardinal
         (closed class or digit), optionally "the", optionally a pro-noun (one/sense/reading/option/meaning), selects the held reading by position */
      const aw = low.split(' '), AFF = new Set(['yes', 'yeah', 'yep', 'ok', 'okay', 'sure', 'correct']), NEGP = new Set(['no', 'nope']), heldNP = r => (r.length === 1 && /^(?:it|that)$/.test(r[0])) || (r.length >= 2 && r[0] === 'the' && r[r.length - 1] === 'one' && r.length <= 3);
      const yes = (aw.length === 1 && AFF.has(aw[0])) || (/^(?:replace|do|overwrite)$/.test(aw[0]) && heldNP(aw.slice(1))), no = (aw.length === 1 && NEGP.has(aw[0])) || (/^(?:keep|retain)$/.test(aw[0]) && heldNP(aw.slice(1)));
      const ordW = { first: 1, one: 1, second: 2, two: 2, third: 3, three: 3, fourth: 4, four: 4, fifth: 5, five: 5, sixth: 6, six: 6 }; const ow = aw[0] === 'the' ? aw.slice(1) : aw;
      const n = ow.length >= 1 && ow.length <= 2 && (/^\d$/.test(ow[0]) || ordW[ow[0]]) && (ow.length === 1 || /^(?:one|sense|reading|option|meaning)$/.test(ow[1])) ? +(/^\d$/.test(ow[0]) ? ow[0] : ordW[ow[0]]) : null;
      if (p.type === 'replace' && (yes || no)) { meta.pending = null; rules.push({ id: 'G-REENTRY-' + (yes ? 'CONFIRM' : 'DECLINE'), doc: 'Doc6 §34 (re-entry)' }); if (yes) return res('SELECTED_MEANING', { kind: 'replaced', clause: p.clause }, { frame: 'FR.CONFIRM', act: 'answer', write: { clause: p.clause, supersede: p.oldIds }, auth: 'explicit confirmation' }); return res('SELECTED_MEANING', { kind: 'kept', clause: p.old }, { frame: 'FR.CONFIRM', act: 'answer' }); }
      if (p.type === 'sense' && n) { meta.pending = null; const s = p.senses[n - 1]; rules.push({ id: s ? 'G-REENTRY-SENSE-CHOSEN' : 'G-REENTRY-OUT-OF-RANGE', doc: 'Doc6 §30', note: s ? s.sid : String(n) }); if (!s) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_ambiguous', word: p.word, senses: p.senses.map(x => x.gloss) }, { frame: 'FR.DEFINE', act: 'question' }); return res('SELECTED_MEANING', { kind: 'define', term: p.word, gloss: s.gloss, source: s.source }, { frame: 'FR.DEFINE', act: 'question', evidenceRefs: [s.sid] }); }
      if (p.type === 'forget' && (yes || no)) { meta.pending = null; rules.push({ id: 'G-REENTRY-' + (yes ? 'CONFIRM' : 'DECLINE'), doc: 'Doc6 §34 (re-entry)' }); const recs = activeFacts().filter(r => p.ids.includes(r.id));
        if (yes && recs.length) { rules.push({ id: 'AUTH-FORGET-CONFIRMED', doc: 'Doc7 (lawful delete = move to cold storage with provenance; never erase)' }); return res('SELECTED_MEANING', { kind: 'forgotten', items: recs.map(r => r.clause) }, { frame: 'FR.FORGET', act: 'answer', write: { forget: recs.map(r => r.id) }, auth: 'explicit confirmation' }); }
        return res('SELECTED_MEANING', { kind: 'forget_kept' }, { frame: 'FR.FORGET', act: 'answer' }); }
      if (p.type === 'reading' && n) { meta.pending = null; if (!p.count || n > p.count) { rules.push({ id: 'G-REENTRY-OUT-OF-RANGE', doc: 'Doc6 §30', note: String(n) }); return res('CLARIFICATION_REQUIRED', { kind: 'clarify_readings', readings: p.readings }, { frame: p.frame, act: p.act }); }
        rules.push({ id: 'G-REENTRY-READING-CHOSEN', doc: 'Doc6 §30, §34 (user selects among preserved readings)', note: 'reading ' + n + ' of ' + p.count }); ctx.chosenReading = n; ctx.raw = p.raw; ctx.low = p.low; return evaluate(p.raw, p.low, ctx); }
      if (p.type === 'teach') { const km = low.match(/^(?:(?:it|they|that|this|those)(?: is|'s| are) )?(?:an? )?(noun|verb|adjective|name)s?\.?$/); if (km) { meta.pending = null; const cat = { noun: 'entity', name: 'entity', verb: 'action', adjective: 'attribute' }[km[1]];
          for (const w0 of p.words) { const w = km[1] === 'verb' ? w0.replace(/([^aeiou])ies$/, '$1y').replace(/(ch|sh|x|z|ss)es$/, '$1').replace(/([^s])s$/, '$1').replace(/([^aeiou])ied$/, '$1y').replace(/([^e])ed$/, '$1') : w0, pr = lex.proposeConcept({ surface: w, gloss: 'taught in chat as a ' + km[1], category: cat, licence: 'user-owned', evidence: 'chat: ' + p.raw }); const ap = pr.ok ? lex.approveConcept(pr.record.id, true) : pr; if (!ap.ok) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_unknown', words: [w] }, { frame: 'FR.UNKNOWN', act: 'unknown' }); }
          rules.push({ id: 'LX-TEACH-ADMITTED', doc: 'lexicon gate (quarantine → inspected → approved by the typed answer); local, never shared', note: p.words.join(', ') + ' = ' + km[1] }); ctx.raw = p.raw; ctx.low = p.low; return evaluate(p.raw, p.low, ctx); } }
      if (p.type === 'referent') { const tk = content(G.tokenize(String(raw).replace(/[.!?]+\s*$/, ''))), np = n && p.options && p.options[n - 1] ? null : G.Parser(tk, glex).np(0).filter(x => x.i === tk.length);
        const opt = n && p.options && p.options[n - 1] ? G.Parser(content(G.tokenize(p.options[n - 1])), glex).np(0).filter(x => x.i === content(G.tokenize(p.options[n - 1])).length) : null, pick = (opt && opt.length === 1 ? opt : np && np.length === 1 ? np : null);
        if (pick) { meta.pending = null; rules.push({ id: 'G-REENTRY-REFERENT-BOUND', doc: 'Doc6 §30, §34; ⧧ hold ancestry (RSOC §3.1.1)', note: p.word + (p.reading ? ' in reading ' + p.reading + ' of ' + p.count : '') }); refBind = { pr: p.word, np: clone(pick[0].node), note: p.reading ? ' (held reading ' + p.reading + ' of ' + p.count + ')' : ' (held option)' }; ctx.chosenReading = p.reading || undefined; ctx.raw = p.raw; ctx.low = p.low;
          try { return evaluate(p.raw, p.low, ctx); } finally { refBind = null; } } }
      meta.pending = null; }
    if (/^(yes|yeah|yep|ok|okay|sure|correct|no|nope|wrong)$/.test(low)) return res('SELECTED_MEANING', { kind: 'ack' }, { frame: 'FR.ACK', act: 'answer' });
    /* LC-CAP-FRAME (4.9.40): capability entry points are capability frames read from sentence structure, not command regexes. A frame is
       [please] [can/could/will/would you] V(lemma in the frame's verb class, a lexicon verb) [particle] [sampradāna] [(DET) (modifier N)* N(head in the frame's noun class)] OPERAND,
       or the bare NP (DET) (mod)* N(head) OPERAND (optionally under "what is" / "find"). Only the OPERAND — a number, a repo slug, a URL, an expression — is
       read by the engine's own operand grammar (spec.re); the words that select the capability are lexical classes in a structural position. */
    const CAP_DET = new Set(['the', 'a', 'an', 'my', 'this', 'that', 'your', 'our', 'all']);
    const capF = (src, sp) => { const ws = String(src).trim().replace(/[\s?.!]+$/, '').split(/\s+/), L = k => (ws[k] || '').toLowerCase().replace(/[,:]$/, ''); let i = 0;
      if (L(i) === 'please') i++; if (/^(?:can|could|will|would)$/.test(L(i)) && L(i + 1) === 'you') i += 2; if (L(i) === 'please') i++;
      const nAt = (k, set) => { const w = L(k); return set.some(n => w === n || w === n + 's' || w === n + 'es' || (/y$/.test(n) && w === n.slice(0, -1) + 'ies')); };
      const mods = j => { while (sp.mods && sp.mods.includes(L(j))) j++; return j; };
      const tail = k => { const r = ws.slice(k).join(' ').replace(/^[,:]\s*/, ''); return (sp.sp ? (r ? ' ' + r : '') : r).match(sp.re); };
      const obj = k => { if (!sp.obj) return k; let j = k; if (CAP_DET.has(L(j))) j++; j = mods(j); if (nAt(j, sp.obj)) return j + 1; return sp.objOpt ? k : -1; };
      let mm = null, head = null;
      if (sp.v && sp.v.includes(L(i)) && (glex.hasPos(L(i), 'v') || CAP_V.has(L(i)))) { let j = i + 1; if (sp.part) j = L(j) === sp.part ? j + 1 : -1; if (j >= 0 && sp.samp) j = L(j) === sp.samp ? j + 1 : -1; if (j >= 0) j = obj(j); if (j >= 0) { mm = tail(j); head = L(i); } }
      if (!mm && sp.np) { let j = i; if (sp.whis && L(j) === 'what' && /^(?:is|are)$/.test(L(j + 1))) j += 2; else if (sp.whis && L(j) === 'find') j++; if (CAP_DET.has(L(j))) j++; const j0 = j; j = mods(j); if ((!sp.reqMod || j > j0) && nAt(j, sp.np)) { mm = tail(j + 1); head = L(j); } }
      if (!mm && sp.bare && i === 0) { mm = tail(0); if (mm) { mm.head = ''; return mm; } }
      if (!mm) return null; mm.head = head; rules.push({ id: 'LC-CAP-FRAME', doc: 'capability frame: verb class + structural object position; operand read by the engine', note: (sp.id || '') + (head ? ' ← ' + head : '') }); return mm; };
    /* private case files (plan §2): "open (the|a new) case ID" / "close the case" are capability frames; an open case switches the case-scoped stores */
    { const co = capF(raw, { id: 'case.open', v: ['open', 'start'], obj: ['case'], mods: ['new'], re: /^([A-Za-z0-9][\w-]{0,40})$/ }); if (co) { const id = co[1].toLowerCase(), sb = baseStore.load('case:' + id + ':sealed');
        if (sb && !Array.isArray(sb) && sb.ct) { rules.push({ id: 'CASE-SEALED', doc: 'plan §2: a closed case is sealed with the vault key; unseal it first' }); return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'blocked', action: 'open the case ' + id, reason: 'CASE_SEALED' }, { frame: 'FR.CASE', act: 'request' }); }
        rules.push({ id: 'CASE-OPEN', doc: 'plan §2 case namespace case:<id> (facts invisible outside the case)', note: id }); return res('SELECTED_MEANING', { kind: 'case_opened', id }, { frame: 'FR.CASE', act: 'request', effect: 'case_open:' + id }); } }
    if (caseNS && capF(low, { id: 'case.close', v: ['close', 'leave', 'exit'], obj: ['case'], re: /^(?:[a-z0-9][\w-]{0,40})?$/ })) { rules.push({ id: 'CASE-CLOSE', doc: 'plan §2', note: caseNS }); return res('SELECTED_MEANING', { kind: 'case_closed', id: caseNS.slice(5) }, { frame: 'FR.CASE', act: 'request', effect: 'case_close' }); }
    if (capF(low, { id: 'newloop', v: ['start'], part: 'over', re: /^$/ }) || capF(low, { id: 'newloop', v: ['reset', 'start'], obj: ['loop'], mods: ['new'], re: /^$/ }) || capF(low, { id: 'newloop', np: ['loop'], mods: ['new'], reqMod: true, re: /^$/ })) return res('SELECTED_MEANING', { kind: 'loop' }, { frame: 'FR.NEWLOOP', act: 'request', effect: 'newloop' });
    for (const [id, act, re, fn, x] of META) if (re.test(low)) { if (x && x.rule) rules.push({ id: x.rule, doc: 'Doc7; Doc6 §37' }); return res((x && x.outcome) || 'SELECTED_MEANING', fn(), Object.assign({ frame: id, act }, x && x.effect ? { effect: x.effect } : {})); }
    if (opts.commandMeaning) { const cm = opts.commandMeaning(raw); if (cm) { rules.push({ id: 'CMD-LEGACY-LLM-' + cm.leg.kind.toUpperCase(), doc: 'forge agents/forge/llm_authority.py (explicit command; routed through the kernel)', note: cm.leg.command });
      return res(cm.leg.kind === 'refused' ? 'REFUSAL_RELEVANT' : 'SELECTED_MEANING', cm.material, { frame: 'FR.COMMAND.LEGACY', act: 'request' }); } }
    { const wt = ctx.worldText || raw; const rr = R.evaluate(wt, { allowBareQuery: !asksAboutStored(wt) }); if (rr.handled) return worldResult(rr); } // world grammar → world reasoner; a bare question goes to memory only when it names a stored entity (unrelated memory never changes the route)
    const phi = meta.notation === 'phi';
    const calc = (() => { const ops = /^(.+?)(?: with respect to ([a-z]))?(?: from (-?[\w./π]+) to (-?[\w./π]+))?$/; let c = capF(low, { id: 'calculus', v: ['differentiate', 'integrate'], re: /^([\s\S]+)$/ }) || capF(low, { id: 'calculus', np: ['derivative', 'integral', 'antiderivative'], whis: true, re: /^of ([\s\S]+)$/ }), dv;
      if (!c) { const ws = low.replace(/^please /, '').split(' '), d = /^d\/d([a-z])$/.exec(ws[0] || ''); if (d && ws.length > 1) { c = [low, ws.slice(1).join(' ')]; c.head = 'd/d'; dv = d[1]; rules.push({ id: 'LC-CAP-FRAME', doc: 'operator notation d/dx (operand grammar)', note: 'calculus ← d/d' + dv }); } }
      if (!c) return null; const o = String(c[1]).match(ops); if (!o) return null; const h = c.head === 'd/d' || c.head === 'differentiate' ? 'differentiate' : c.head === 'integrate' ? 'integrate' : c.head.replace(/s$/, '');
      return [low, /^(?:derivative|integral|antiderivative)$/.test(h) ? h : undefined, dv, o[1], o[2], o[3], o[4], h]; })();
    if (calc && (CA.isElementary([calc[3], calc[5] || '', calc[6] || ''].join(' ')) || /\/\s*\(?[^)]*[a-z]|\^\s*\(?[a-z]/.test(calc[3]))) { const isD = calc[1] === 'derivative' || calc[7] === 'differentiate'; const x = calc[2] || calc[4] || null; const body = calc[3].replace(/\s*d[a-z]$/, '');
      let r; try { r = isD ? CA.derivative(body, x) : CA.integral(body, x, calc[5], calc[6]); } catch (e) { r = { ok: false, error: 'MALFORMED' }; }
      if (!r.ok) { rules.push({ id: 'CALC-REFUSED', doc: 'calculus.js (no guess outside the rule table)', note: r.error }); return res('INCONGRUENT_REJECTED', { kind: 'refuse', reason: r.error === 'CALC_NOT_IN_TABLE' ? (isD ? 'CALC_SCOPE' : 'INTEGRAL_SCOPE') : 'MALFORMED_EXPR' }, { frame: 'FR.ALGEBRA', act: 'request' }); }
      rules.push(...r.rules.map(id => ({ id: 'CALC-' + id, doc: 'calculus.js ordered rule table (sūtra-style)' })), { id: 'CALC-NUMERIC-CROSSCHECK', doc: 'Doc9 verification', note: r.definite ? r.definite.check : r.check || 'antiderivative re-differentiated numerically' });
      return res('SELECTED_MEANING', Object.assign({ kind: 'calculus', engine: 'sym', op: isD ? 'derivative' : 'integral', x: r.x, input: r.input, result: r.definite ? r.definite.value : r.result.replace(/ \+ C$/, '') }, !isD && r.definite ? { a: r.definite.a, b: r.definite.b } : {}), { frame: 'FR.ALGEBRA', act: 'request', math: r }); }
    if (calc && !/[a-z]{2,}/.test(algebraText(calc[3]).replace(/^\(|\)$/g, ''))) { const isD = calc[1] === 'derivative' || calc[7] === 'differentiate'; const x = calc[2] || calc[4] || null; const body = algebraText(calc[3]).replace(/ d[a-z]$/, '');
      rules.push({ id: isD ? 'GP014-DERIVATIVE-POWER-RULE' : 'GP014-INTEGRAL-POWER-RULE', doc: 'GP-014 math lane (polynomial calculus, exact rationals)' });
      const r = isD ? A.derivative(body, x) : A.integral(body, x, calc[5], calc[6]);
      if (!r.ok) return res('INCONGRUENT_REJECTED', { kind: 'refuse', reason: r.error === 'FREE_VARIABLES' ? 'DEFINITE_ONE_VAR' : r.error === 'DIV_BY_POLY' ? 'CALC_SCOPE' : 'MALFORMED_EXPR' }, { frame: 'FR.ALGEBRA', act: 'request' });
      rules.push({ id: isD ? 'GP014-RECOMPUTED' : 'GP014-VERIFIED-BY-DIFFERENTIATION', doc: 'Doc9 verification' });
      return res('SELECTED_MEANING', Object.assign({ kind: 'calculus', op: isD ? 'derivative' : 'integral', x: r.x, input: r.input, result: r.definite ? r.definite.value : r.result }, !isD && r.definite ? { a: r.definite.a, b: r.definite.b } : {}), { frame: 'FR.ALGEBRA', act: 'request', math: r }); }
    const sysm = capF(low, { id: 'system', v: ['solve'], obj: ['system'], objOpt: true, re: /^(.+=.+?)(?:,| and|;)\s*(.+=.+)$/ });
    if (sysm) { const eqs = sysm[1].split(/,|;| and /).concat(sysm[2].split(/,|;| and /)).map(x => algebraText(x)).filter(Boolean);
      if (eqs.length >= 2 && eqs.every(x => /=/.test(x) && !/[a-z]{2,}/.test(x))) { rules.push({ id: 'GP014-LINEAR-SYSTEM-GAUSS', doc: 'GP-014; exact Gauss–Jordan over ℚ' }); const r = A.solveSystem(eqs);
        if (!r.ok) return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: r.error === 'NONLINEAR' ? 'NONLINEAR_SYSTEM' : 'MALFORMED_SYSTEM' }, { frame: 'FR.ALGEBRA', act: 'request', math: r });
        if (r.status === 'inconsistent') return res('SELECTED_MEANING', { kind: 'refuse', reason: 'INCONSISTENT_SYSTEM' }, { frame: 'FR.ALGEBRA', act: 'request', math: r });
        if (r.status === 'underdetermined') return res('CLARIFICATION_REQUIRED', { kind: 'refuse', reason: 'UNDERDETERMINED', free: r.free }, { frame: 'FR.ALGEBRA', act: 'request', math: r });
        if (!r.verified) return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: 'UNVERIFIED' }, { frame: 'FR.ALGEBRA', act: 'request', math: r });
        rules.push({ id: 'GP014-VERIFIED-BY-SUBSTITUTION', doc: 'Doc9 verification' });
        return res('SELECTED_MEANING', { kind: 'system', eqs: eqs.map(q => q.split('=').map(z => A.P.str(A.poly(z))).join(' = ')), sol: r.solution.map(z => ({ v: z.v, exact: z.exact })) }, { frame: 'FR.ALGEBRA', act: 'request', math: r }); } }
    const alg = (() => { const a = capF(low, { id: 'algebra', v: ['solve', 'simplify', 'expand', 'factor', 'factorise', 'factorize'], re: /^(?:for ([a-z]) )?(?:the equation |the expression )?(.+?)(?: for ([a-z]))?$/ }); return a ? [a[0], a.head, a[1], a[2], a[3]] : null; })();
    if (alg || (/^[\d\sa-z^()+\-*/=.]+=[\d\sa-z^()+\-*/.]+$/.test(low) && /\b[a-z]\b|\d[a-z]\b/.test(low) && !/[a-z]{2,}/.test(low))) {
      const verb = alg ? alg[1] : 'solve', body = algebraText(alg ? alg[3] : low), x = alg ? alg[2] || alg[4] : null; rules.push({ id: 'GP014-ALGEBRA-' + verb.toUpperCase(), doc: 'GP-014 math lane; RPMC O_phase' });
      if (/[a-z]{2,}/.test(body.replace(/sqrt/g, ''))) { const unk = unknownToks(content(G.tokenize(body))); if (unk.length) return clarifyUnknown(unk); return res('INCONGRUENT_REJECTED', { kind: 'refuse', reason: 'MALFORMED_EXPR' }, { frame: 'FR.ALGEBRA', act: 'request' }); }
      if (/^factori?[sz]?e?$/.test(verb) && !body.includes('=')) { const r = A.factor(body); rules.push({ id: 'GP014-FACTOR-RATIONAL-ROOTS', doc: 'GP-014; rational root theorem + common monomial' });
        if (!r.ok) return res('INCONGRUENT_REJECTED', { kind: 'refuse', reason: r.error === 'CONSTANT' ? 'NO_VARIABLE' : r.error === 'DIV0' ? 'DIV0' : 'MALFORMED_EXPR' }, { frame: 'FR.ALGEBRA', act: 'request' });
        if (!r.verified) return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: 'UNVERIFIED_FACTOR' }, { frame: 'FR.ALGEBRA', act: 'request', math: r });
        rules.push({ id: 'GP014-VERIFIED-BY-EXPANSION', doc: 'Doc9 verification' }); return res('SELECTED_MEANING', { kind: 'factored', input: A.P.str(A.poly(body)), result: r.result, irreducible: !!r.irreducible }, { frame: 'FR.ALGEBRA', act: 'request', math: r }); }
      if (verb === 'solve' || body.includes('=')) { const r = A.solveAny(body, x);
        if (!r.ok) { g.congruity = r.error; return res(r.error === 'MULTIVARIABLE' ? 'CLARIFICATION_REQUIRED' : 'REFUSAL_RELEVANT', { kind: 'refuse', reason: r.error === 'MULTIVARIABLE' ? 'MULTIVARIABLE' : /DEGREE/.test(r.error) ? 'DEGREE_LIMIT' : r.error === 'DIV0' ? 'DIV0' : r.error === 'NOT_EQUATION' ? 'NOT_EQUATION' : 'BAD_EQUATION', vars: r.vars }, { frame: 'FR.ALGEBRA', act: 'request', math: r }); }
        if (r.kind === 'identity') return res('SELECTED_MEANING', { kind: 'refuse', reason: r.truth ? 'IDENTITY_EQ' : 'FALSE_EQ' }, { frame: 'FR.ALGEBRA', act: 'request', math: r });
        if (!r.verified) { g.congruity = 'verification failed'; return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: 'UNVERIFIED' }, { frame: 'FR.ALGEBRA', act: 'request', math: r }); }
        rules.push({ id: 'GP014-VERIFIED-BY-SUBSTITUTION', doc: 'Doc9 verification' });
        const closed = closedCubic(r); if (closed) rules.push({ id: closed.rule, doc: 'calculus.js exact cubic (Cardano / trigonometric form)', note: closed.method + '; agrees with the numeric roots to 1e-9' });
        return res('SELECTED_MEANING', Object.assign(closed ? { closed: closed.roots.map(z => z.exact) } : {}, { kind: 'solved', poly: r.poly, polyPhi: r.polyPhi, x: r.x, roots: (r.roots || []).map(z => z.exact), noReal: !!r.noReal, phi }, r.discriminant !== undefined ? { discriminant: r.discriminant } : {}, (r.roots || []).some(z => z.numeric) ? { numeric: r.roots.map(z => !!z.numeric) } : {}), { frame: 'FR.ALGEBRA', act: 'request', math: r }); }
      if (verb === 'simplify' && /\//.test(body)) { const rs = A.ratSimplify(body); if (rs.ok) { rules.push({ id: 'ALG-RATIONAL-GCD-CANCEL', doc: 'algebra.js Euclid over ℚ[x]', note: rs.cancelled ? 'cancelled ' + rs.cancelled : 'already lowest terms' }, { id: 'ALG-RATIONAL-DOMAIN-KEPT', doc: 'Doc9 (domain never silently widened)', note: rs.excluded.length ? rs.x + ' ≠ ' + rs.excluded.join(', ') : 'none' }, { id: 'GP014-VERIFIED-BY-SUBSTITUTION', doc: 'Doc9 verification', note: rs.check });
          return res('SELECTED_MEANING', { kind: 'simplified', op: verb, rational: true, input: rs.input, result: rs.result, excluded: rs.excluded, x: rs.x, resultPhi: rs.result, phi }, { frame: 'FR.ALGEBRA', act: 'request', math: rs }); } }
      const r = A.simplify(body); if (!r.ok || !r.check) return res('INCONGRUENT_REJECTED', { kind: 'refuse', reason: r.error === 'DIV0' ? 'DIV0' : 'MALFORMED_EXPR' }, { frame: 'FR.ALGEBRA', act: 'request' });
      return res('SELECTED_MEANING', { kind: 'simplified', op: verb, result: r.result, resultPhi: r.resultPhi, phi }, { frame: 'FR.ALGEBRA', act: 'request', math: r }); }
    const EV_OP = /^(.+?) (?:when|if|for|where|with) ([a-z]) (?:=|is|equals) (-?\d+(?:\.\d+)?)$/; const ev = capF(low, { id: 'evaluate', v: ['evaluate', 'compute'], re: EV_OP }) || (/^what is /.test(low) ? low.slice(8).match(EV_OP) : null) || low.match(EV_OP);
    if (ev && /[a-z]/.test(ev[1]) && !/[a-z]{2,}/.test(algebraText(ev[1]))) { const r = A.evaluateAt(algebraText(ev[1]), ev[2], ev[3]); rules.push({ id: 'GP014-SUBSTITUTE', doc: 'GP-014' }); if (r.ok) { const e = r.expr + ' at ' + ev[2] + ' = ' + ev[3]; return res('SELECTED_MEANING', { kind: 'math', expr: e, exprPhi: A.P.str(A.poly(algebraText(ev[1])), true) + ' at ' + ev[2] + ' = ' + ev[3], value: r.value, approx: false, phi }, { frame: 'FR.ALGEBRA', act: 'question', math: r }); } }
    const MEAS = /^(-?\d+(?:\.\d+)?) ?(°?[a-z]+) (?:to|in|into) (°?[a-z]+)$/, MEAS2 = /^(-?\d+(?:\.\d+)?) ?([a-z°²³/^*\d ]+?) (?:to|into|in) ([a-z°²³/^*\d ]+?)$/; /* measure phrase = operand grammar; "convert" is a capability verb, "how many U in Q" a wh-quantity question over a measure phrase */
    const lw = low.split(' '), hmq = lw[0] === 'how' && lw[1] === 'many' ? lw.slice(2).join(' ').match(/^(°?[a-z]+) (?:are )?(?:in|is) (-?\d+(?:\.\d+)?) ?(°?[a-z]+)$/) : null;
    let cv = capF(low, { id: 'units', v: ['convert'], bare: true, re: MEAS }); const hm = hmq; if (!cv && hm) cv = [hm[0], hm[2], hm[3], hm[1]];
    if (cv) { const f = cv[2].replace('°', ''), t = cv[3].replace('°', ''); if (A.U[f] || A.TEMP[f]) { const r = A.convert(cv[1], f, t); rules.push({ id: 'GP014-UNIT-CONVERSION', doc: 'GP-014; exact SI definitions' });
      if (!r.ok) return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: r.error === 'DIMENSION_MISMATCH' ? 'DIM_MISMATCH' : 'UNKNOWN_UNIT', dims: r.dims, unit: r.unit }, { frame: 'FR.UNITS', act: 'question', math: r });
      return res('SELECTED_MEANING', Object.assign({ kind: 'converted', from: r.from, value: r.value.text, to: r.to }, r.value.exact ? {} : { fraction: r.value.fraction }), { frame: 'FR.UNITS', act: 'question', math: r }); } }
    const cu = capF(low, { id: 'units', v: ['convert'], bare: true, re: MEAS2 }) || (/^what is /.test(low) ? low.slice(8).match(MEAS2) : null);
    if (cu && (/[/^²³*]|\bper\b|\bsquare\b|\bcubic\b|squared|\bmph\b|\bkph\b|\bkmh\b/.test(cu[2] + ' ' + cu[3]) || (A.parseUnit(cu[2]) && A.parseUnit(cu[3])))) { const pa = A.parseUnit(cu[2]), pb = A.parseUnit(cu[3]);
      if (pa && pb) { rules.push({ id: 'GP014-COMPOUND-UNITS', doc: 'GP-014; dimension vectors (L, M, T) with exact SI factors' }); const r = A.convertCompound(cu[1], cu[2].trim(), cu[3].trim());
        if (!r.ok) return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: 'DIM_MISMATCH', dims: r.dims }, { frame: 'FR.UNITS', act: 'question', math: r });
        return res('SELECTED_MEANING', Object.assign({ kind: 'converted', from: r.from, value: r.value.text, to: r.to }, r.value.exact ? {} : { fraction: r.value.fraction }), { frame: 'FR.UNITS', act: 'question', math: r }); }
      return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: 'UNKNOWN_UNIT', unit: (pa ? cu[3] : cu[2]).trim() }, { frame: 'FR.UNITS', act: 'question' }); }
    const ms = mathSurface(low);
    if (ms) { const r = M.computeExpr(ms); rules.push({ id: 'GP014-MATH-LANE', doc: 'GP-014; RPMC O_phase', note: 'expr ' + ms });
      if (!r.ok && r.error === 'DIV0') { g.congruity = 'division by zero'; rules.push({ id: 'RPMC-DIV-PHASE-INVALID', doc: 'RPMC Full Protocol ÷_Φ' }); return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: 'DIV0_PHI' }, { frame: 'FR.MATH', act: 'question', math: r }); }
      if (!r.ok) { g.congruity = 'not a well-formed expression'; return res('INCONGRUENT_REJECTED', { kind: 'refuse', reason: 'MALFORMED_EXPR' }, { frame: 'FR.MATH', act: 'question', math: r }); }
      return res('SELECTED_MEANING', { kind: 'math', expr: r.pretty, exprPhi: r.phaseForm, value: r.value, approx: r.approx, phi }, { frame: 'FR.MATH', act: 'question', math: r, uncertainty: r.approx ? 'approximate (irrational)' : 'none' }); }
    let m;
    /* FR.NOTE.ADD by directive parse (4.9.39; no phrase list): the act is read from the verb group — V "note" | V+PART "write/jot down" | light verb
       "make/take/add" + "a note" | "remind" + me (sampradāna) + "to" — and its complement is MENTIONED text (kept verbatim, not parsed). A timed reminder
       ("… in N minutes") is the reminder capability below, not a note. */
    let noteAt = -1, remindTo = false; { const tk = G.tokenize(raw); let i = tk[0] && tk[0].w === 'please' ? 1 : 0; const P = tk.length > i ? G.Parser(tk.slice(i), glex) : null; const V = (j, l) => P && P.at(j, 'V').some(x => x.f === 'base' && x.lemma === l);
      if (P && P.at(0, 'V').some(x => x.f === 'base' && x.lemma === 'note') && !(tk[i + 1] && /^(that|this|it)$/.test(tk[i + 1].w) && false)) noteAt = i + 1;
      else if (P && (V(0, 'write') || V(0, 'jot')) && tk[i + 1] && tk[i + 1].w === 'down') noteAt = i + 2;
      else if (P && (V(0, 'make') || V(0, 'take') || V(0, 'add')) && tk[i + 1] && tk[i + 1].w === 'a' && tk[i + 2] && tk[i + 2].w === 'note') noteAt = i + 3;
      else if (P && V(0, 'remind') && tk[i + 1] && tk[i + 1].w === 'me' && tk[i + 2] && tk[i + 2].w === 'to' && tk.length > i + 3 && !/\bin \d{1,4} (?:minutes?|min|hours?|days?)[.!]?$/i.test(raw.trim())) { noteAt = i + 3; remindTo = true; }
      if (noteAt >= 0) { if (tk[noteAt] && tk[noteAt].w === 'that') noteAt++; if (tk[noteAt] && tk[noteAt].w === ':') noteAt++; } }
    if (noteAt >= 0) { const tk = G.tokenize(raw); m = [null, tk.length > noteAt ? 'x' : null]; let cut = 0; { let n = 0, re = /"[^"]*"|[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-]*(?:'(?!s\b)[a-z]+)?|'s\b|\d+(?:\.\d+)?|[?,;:.!]/g, mm; const src = raw.replace(/[’‘]/g, "'"); while ((mm = re.exec(src)) && n < noteAt) { n++; cut = mm.index + mm[0].length; } }
      const txt = raw.slice(cut).replace(/^[:\s]+/, '').replace(/[.!]$/, '').replace(/"/g, "'");
      if (!txt.trim()) m[1] = null;
      if (!m[1]) { g.expectancy = 'missing text'; return res('INCOMPLETE_PRESERVED', { kind: 'clarify_incomplete', act: 'note', missing: 'NOTE_TEXT' }, { frame: 'FR.NOTE.ADD', act: 'request' }); }
      if (ctx.negAct) { rules.push({ id: 'LL-NEG-ACT-SCOPE', doc: 'Doc3 §15' }); return res('SELECTED_RESTRICTED_MEANING', { kind: 'neg_act', act: 'note' }, { frame: 'FR.NOTE.ADD', act: 'request' }); }
      rules.push({ id: 'G-DIRECTIVE-NOTE', doc: 'Doc5 §15 directive; complement = mentioned text' }); if (remindTo) rules.push({ id: 'CAP-REMINDER-AS-NOTE', doc: 'Doc5 §17 (no clock/notification capability; kept as a note)' });
      rules.push({ id: 'AUTH-EXPLICIT-NOTE', doc: 'Doc7' }); return res('SELECTED_MEANING', { kind: 'note_added', n: notes().length + 1, text: txt }, { frame: 'FR.NOTE.ADD', act: 'request', write: { note: txt } }); }
    /* FR.SAY by directive parse (4.9.39): a quotative verb (SELF_QUOTE_V, lemma-tagged V base) opens the directive — at the start, or as the second
       conjunct after and/then (a coordinated directive) — with optional "after me" (sampradāna) and "that"; its complement is MENTIONED text */
    let sayAt = -1; { const tk = G.tokenize(raw); const P = tk.length ? G.Parser(tk, glex) : null; const qv = j => P && P.at(j, 'V').some(x => x.f === 'base' && SELF_QUOTE_V.has(x.lemma));
      let j = tk[0] && tk[0].w === 'please' ? 1 : 0; if (qv(j)) sayAt = j + 1; else { for (let k = 1; k < tk.length - 1; k++) if (/^(and|then)$/.test(tk[k].w)) { let q = k + 1; if (tk[q] && tk[q].w === 'then') q++; if (tk[q] && tk[q].w === 'just') q++; if (qv(q) && /^(say|output|print)$/.test(tk[q].w)) { sayAt = q + 1; break; } } }
      if (sayAt >= 0) { if (tk[sayAt] && tk[sayAt].w === 'after' && tk[sayAt + 1] && tk[sayAt + 1].w === 'me') sayAt += 2; if (tk[sayAt] && tk[sayAt].w === 'that') sayAt++; if (!tk[sayAt] || (tk[sayAt].w !== ':' && sayAt === tk.length)) sayAt = -1; else if (tk[sayAt].w === ':') sayAt++; } if (sayAt >= tk.length) sayAt = -1; }
    if (sayAt >= 0) { let cut = 0; { let n = 0, re = /"[^"]*"|[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\-]*(?:'(?!s\b)[a-z]+)?|'s\b|\d+(?:\.\d+)?|[?,;:.!]/g, mm; const src = raw.replace(/[’‘]/g, "'"); while (n < sayAt && (mm = re.exec(src))) { n++; cut = mm.index + mm[0].length; } }
      const txt = raw.slice(cut).replace(/^[:\s]+/, '').replace(/^"|"$/g, '').replace(/[.!]$/, '').replace(/"/g, "'"); rules.push({ id: 'G-DIRECTIVE-QUOTATIVE', doc: 'Doc5 §15 directive; complement = mentioned text' });
      if (ctx.negAct) return res('SELECTED_RESTRICTED_MEANING', { kind: 'neg_act', act: 'say' }, { frame: 'FR.SAY', act: 'request' });
      const unk = unknownToks(content(G.tokenize(txt)).filter(t => !/^[A-Z]/.test(t.orig) || true));
      rules.push({ id: unk.length ? 'RMC-UNNAMEABLE-PROJECTION' : 'RMC-QUOTATION-NAMED', doc: 'RMC Addendum §4; RPMC §1.4 (Φ7 naming precedes Φ8)', note: unk.length ? 'content cannot be named at Φ7 → attempted Φ5→Φ8' : 'quotation named at Φ7 as a quotation; lawful Φ6→Φ7→Φ8' });
      return res('SELECTED_MEANING', { kind: 'quoted', text: txt }, { frame: 'FR.SAY', act: 'request', forbiddenPath: unk.length > 0, literal: unk }); }
    if ((m = capF(raw, { id: 'tool', v: ['use', 'run'], obj: ['tool'], re: /^([a-z][a-z0-9-]{1,30})\s+(?:on|with|for)\s+([\s\S]{1,2000})$/i })) && !ctx.negAct) { const name = m[1].toLowerCase();
      rules.push({ id: 'EF-FRAME-USERTOOL', doc: 'Tool Builder (ForgeScript in a sandboxed worker; evidence only)' }); return res('SELECTED_MEANING', { kind: 'tool_started', tool: 'user.' + name, target: name, noun: 'tool', local: true }, { frame: 'FR.TOOL.USER', act: 'request', toolRequest: { tool: 'user.tool', input: JSON.stringify({ name, input: m[2].trim() }) } }); }
    { const nl = notes(); const pick = n => nl[n - 1]; const upd = (rec, f) => { const all = store.load('memory'); const r = all.find(x => x.id === rec.id); f(r); r.updated_at = now(); store.save('memory', all); return r; };
      if ((m = capF(raw, { id: 'note.edit', v: ['edit', 'change', 'update'], obj: ['note'], re: /^(\d{1,4})\s+to\s*:?\s*(.{1,500}?)$/i })) && !ctx.negAct) { const r = pick(+m[1]); if (!r) return res('SELECTED_MEANING', { kind: 'note_missing', n: +m[1] }, { frame: 'FR.NOTE.EDIT', act: 'request' });
        const t = m[2].replace(/"/g, "'"); upd(r, x => { (x.history = x.history || []).push({ text: x.text, at: now() }); x.text = t; }); rules.push({ id: 'AUTH-EXPLICIT-NOTE-EDIT', doc: 'Doc7; prior text kept in history' }); return res('SELECTED_MEANING', { kind: 'note_edited', n: +m[1], text: t }, { frame: 'FR.NOTE.EDIT', act: 'request' }); }
      if ((m = capF(raw, { id: 'note.tag', v: ['tag'], obj: ['note'], re: /^(\d{1,4})\s+(?:with|as)\s+#?([a-z0-9][a-z0-9-]{0,30})$/i })) && !ctx.negAct) { const r = pick(+m[1]); if (!r) return res('SELECTED_MEANING', { kind: 'note_missing', n: +m[1] }, { frame: 'FR.NOTE.TAG', act: 'request' });
        const tag = m[2].toLowerCase(); upd(r, x => { x.tags = Array.from(new Set((x.tags || []).concat(tag))); }); rules.push({ id: 'AUTH-EXPLICIT-NOTE-TAG', doc: 'Doc7' }); return res('SELECTED_MEANING', { kind: 'note_tagged', n: +m[1], tag }, { frame: 'FR.NOTE.TAG', act: 'request' }); }
      if ((m = capF(raw, { id: 'note.link', v: ['link'], obj: ['note'], re: /^(\d{1,4})\s+to\s+(?:my\s+)?(.{1,80}?)$/i })) && !ctx.negAct) { const r = pick(+m[1]); if (!r) return res('SELECTED_MEANING', { kind: 'note_missing', n: +m[1] }, { frame: 'FR.NOTE.LINK', act: 'request' });
        const ent = m[2].toLowerCase().trim(); const hits = store.load('memory').filter(x => x.status === 'active' && x.kind !== 'note' && (x.entities || []).some(e => String(e).toLowerCase().endsWith(ent))); upd(r, x => { x.links = Array.from(new Set((x.links || []).concat(hits.map(h => h.id)))); });
        rules.push({ id: 'AUTH-EXPLICIT-NOTE-LINK', doc: 'Doc7; links are memory ids, not copies' }); return res('SELECTED_MEANING', { kind: 'note_linked', n: +m[1], count: hits.length, target: m[2].trim() }, { frame: 'FR.NOTE.LINK', act: 'request' }); }
      if ((m = capF(raw, { id: 'note.forget', v: ['delete', 'remove', 'forget'], obj: ['note'], re: /^(\d{1,4})$/ })) && !ctx.negAct) { const r = pick(+m[1]); if (!r) return res('SELECTED_MEANING', { kind: 'note_missing', n: +m[1] }, { frame: 'FR.NOTE.FORGET', act: 'request' });
        upd(r, x => { x.status = 'forgotten'; x.forgotten_at = now(); }); rules.push({ id: 'AUTH-NOTE-FORGET-RECOVERABLE', doc: 'D11 forgotten facts recoverable, no hard delete' }); return res('SELECTED_MEANING', { kind: 'note_forgotten', n: +m[1] }, { frame: 'FR.NOTE.FORGET', act: 'request' }); }
      if ((m = capF(raw, { id: 'note.search', v: ['search', 'find'], obj: ['note'], re: /^(?:for|about|tagged)\s+#?(.{1,80}?)$/i }))) { const q = m[1].toLowerCase(); const hits = nl.map((r, i) => ({ r, i })).filter(({ r }) => r.text.toLowerCase().includes(q) || (r.tags || []).includes(q.replace(/^#/, '')));
        rules.push({ id: 'G-NOTE-SEARCH', doc: 'substring over text + exact tag' }); return res('SELECTED_MEANING', { kind: 'notes_found', query: m[1], items: hits.map(({ r, i }) => 'note ' + (i + 1) + ': ' + r.text) }, { frame: 'FR.NOTE.SEARCH', act: 'question' }); }
      if ((m = capF(raw, { id: 'note.seal', v: ['seal'], obj: ['note'], re: /^(\d{1,4})(?:\s+in(?:to)? (?:the |my )?vault)?$/i })) && !ctx.negAct) { const r = pick(+m[1]); if (!r) return res('SELECTED_MEANING', { kind: 'note_missing', n: +m[1] }, { frame: 'FR.NOTE.SEAL', act: 'request' });
        rules.push({ id: 'EF-FRAME-NOTESEAL', doc: 'Identity Vault seal (AES-GCM); plain text replaced by a vault reference' }); return res('SELECTED_MEANING', { kind: 'tool_started', tool: 'notes.seal', target: 'note ' + m[1], noun: 'note' }, { frame: 'FR.NOTE.SEAL', act: 'request', toolRequest: { tool: 'notes.seal', input: r.id } }); }
    }
    if ((m = capF(raw, { id: 'remind', v: ['remind'], samp: 'me', re: /^(?:to|about)\s+(.{1,300}?)\s+in\s+(\d{1,4})\s+(minute|minutes|min|hour|hours|day|days)$/i })) && !ctx.negAct) {
      const mult = /^h/i.test(m[3]) ? 3600e3 : /^d/i.test(m[3]) ? 864e5 : 60e3; const due = new Date(Date.parse(now()) + (+m[2]) * mult); const rs = store.load('reminders'); const rec = { id: 'rem:' + (rs.length + 1), text: m[1].trim(), due: due.toISOString(), state: 'pending', created: now() }; const hh = due.getHours(), mm = due.getMinutes(); const when = due.getFullYear() + '-' + String(due.getMonth() + 1).padStart(2, '0') + '-' + String(due.getDate()).padStart(2, '0') + ' ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); rec.when = when; rs.push(rec); store.save('reminders', rs.slice(-500));
      rules.push({ id: 'AUTH-EXPLICIT-REMINDER', doc: 'Doc7 explicit local write (reminder)' }); return res('SELECTED_MEANING', { kind: 'reminder_set', text: rec.text, when }, { frame: 'FR.REMIND', act: 'request' }); }
    if ((m = capF(low, { id: 'explore', v: ['explore'], obj: ['idea'], mods: ['adjacent', 'new'], re: /^(?:for (formal definitions?|coding|patch(?:es)?|architecture|brainstorming|creative brainstorming|public claims?|scientific claims?))?(?: ?with seed (\d{1,9}))?$/ }))) { const TM = { formal: 'formal_definition', coding: 'coding_patch', patch: 'coding_patch', architecture: 'architecture', brainstorming: 'creative_brainstorming', creative: 'creative_brainstorming', public: 'public_scientific_claim', scientific: 'public_scientific_claim' }; const taskMode = m[1] ? TM[m[1].split(' ')[0]] : 'creative_brainstorming'; m = [m[0], m[2]]; const mem = store.load('memory').filter(r => r.status === 'active' && r.clause);
      const edges = ruleEdges(mem);
      for (const e of edges) { const r = mem.find(x => x.id === e.id); e.held = !!(r && r.sense && r.sense.status === 'held-open'); e.phi = r && r.sfe && r.sfe.Phi ? r.sfe.Phi : 9; }
      const out = EDE.explore(edges, { seed: m[1] ? +m[1] : 1, task_mode: taskMode }); const lab = k => (/^user\//.test(k) ? 'your ' + k.slice(5) : k === 'user' ? 'you' : String(k).replace(/^[a-z]+:/, '')); const rl = r => (/^cmp:/.test(r) ? r.slice(4) + 'er than' : r === 'isa' ? 'is a' : r === 'partof' ? 'part of' : /^shares:/.test(r) ? 'shares “' + rl(r.slice(7)) + '” with' : r.replace('∘', ' then '));
      stagedHyps = out.retained.filter(c => M.driftGovernance(c.drift.eps_s).may_project).map(c => HY.make({ kind: 'relation', route: HY.ROUTES.ede, body: c.claim, provenance: { source: 'ede.explore', turn: meta.turn, msm_id: null, loop: meta.loop }, parents: (c.anchor_ids || []).slice(), support: (c.anchor_ids || []).slice(), falsifiers: [], status: 'staged', detail: { branch_id: c.branch_id, novelty: c.novelty ? c.novelty.N : null, eps_s: c.drift ? c.drift.eps_s : null, task_mode: taskMode, rule: c.creation_operator === 'adjacent_synthesis' && !/∘/.test(c.claim.relation) ? WR.transitiveRule(c.claim.relation) : null, claim_atom: { predicate: c.claim.relation, args: [c.claim.subject, c.claim.object], polarity: 'pos' } } }));
      { const cal = store.load('ede_calibration'); const seen = new Set(cal.map(x => x.branch_id)); for (const [list, oc] of [[out.retained, 'retained'], [out.archived, 'archived'], [out.rejected, 'rejected']]) for (const c of list) if (c.N_base && !seen.has(c.branch_id)) { cal.push(Object.assign({ at: now() }, EDE.calibrationRecord(c, oc))); seen.add(c.branch_id); } store.save('ede_calibration', cal.slice(-2000)); }
      const da = store.load('drift_archive'); for (const c of out.archived) if (!da.some(x => x.id === 'ede:' + c.branch_id)) da.push({ id: 'ede:' + c.branch_id, at: now(), kind: 'ede_branch', eps_s: c.drift.eps_s, drift_band: c.drift.governance.band, quarantine: true, novelty: c.novelty.N, projection_status: 'blocked', failure_reason: c.failure_reason, anchors: c.anchor_ids }); store.save('drift_archive', da.slice(-1000));
      /* GELC S3–S4: rule induction over the same stored facts; only promotable rules are staged (memory only), the rest stay quarantined in drift_archive */
      const evo = EVO.evolve(ruleFacts(mem.filter(r => !r.sensitive)), { seed: m[1] ? +m[1] : 1 }), prom = evo.population.filter(p => p.route === 'promotable').slice(0, 6);
      stagedHyps = stagedHyps.concat(prom.map(p => HY.make({ kind: 'rule', route: HY.ROUTES.ede, body: p.text, provenance: { source: 'gelc.evolve', turn: meta.turn, msm_id: null, loop: meta.loop }, parents: p.covers.map(c => c.fact), support: p.covers.map(c => c.proof_id), counterevidence: p.contradicts, falsifiers: [], status: 'staged', detail: { rule: p.rule, claim_atom: p.covers[0].atom, eps_s: p.drift.eps_s, op: p.op, gen: p.gen, covers: p.covers.length, population_hash: evo.population_hash } })));
      { const da2 = store.load('drift_archive'); for (const p of evo.population) if (p.route === 'quarantine' || p.route === 'conflicted') { if (!da2.some(x => x.id === 'gelc:' + p.id)) da2.push({ id: 'gelc:' + p.id, at: now(), kind: 'gelc_rule', text: p.text, eps_s: p.drift.eps_s, drift_band: p.drift.band, quarantine: true, route: p.route, projection_status: 'blocked', counterevidence: p.contradicts }); } store.save('drift_archive', da2.slice(-1000)); }
      rules.push({ id: 'GELC-EVOLVE', doc: 'evolve.js (WM Spec A.3 induction; RMC §8.3)', note: evo.explored + ' rules explored · ' + prom.length + ' promotable · population ' + evo.population_hash.slice(0, 12) });
      rules.push({ id: 'EDE-ALG3', doc: 'RMC §5.6 Evolutionary Drift Explorer; §8.3 Algorithm 3 (N_min 0.15, N_max 0.75, θ 0.35)', note: out.anchors + ' anchors · ' + out.explored + ' explored · ' + out.retained.length + ' retained · ' + out.archived.length + ' archived' });
      return res('SELECTED_MEANING', { kind: 'ede_result', explored: out.explored || 0, archived: out.archived.length, items: out.retained.slice(0, 6).map(c => lab(c.claim.subject) + ' → ' + rl(c.claim.relation) + ' → ' + lab(c.claim.object)), rules: prom.map(p => p.text.replace(/\b[a-z]+:/g, '')) }, { frame: 'FR.TOOL.EDE', act: 'request' }); }
    const SIM3D = /^(?:an? )?(?:in )?3-?d(?: physics)?(?: (?:simulation|preview))?(?: of)?(?: (\d{1,2}))?(?: (boxes|spheres|cylinders|bodies))?(?: with seed (\d{1,9}))?$/;
    if ((m = capF(low, { id: 'sim3d', v: ['simulate', 'preview', 'run'], obj: ['simulation', 'preview'], objOpt: true, mods: ['physics'], np: ['simulation', 'preview'], bare: true, re: SIM3D }))) { const shape = m[2] && m[2] !== 'bodies' ? m[2].replace(/s$/, '').replace(/e$/, 'e') : undefined; const arg = JSON.stringify({ count: m[1] ? +m[1] : 4, shape: shape === 'boxe' ? 'box' : shape, seed: m[3] ? +m[3] : 1 });
      rules.push({ id: 'EF-FRAME-SIM3D', doc: '3-D preview: cannon-es 0.20.0 + three.js r169 (vendored, MIT); PyBullet defaults g=−9.81, dt=1/240' }); return res('SELECTED_MEANING', { kind: 'tool_started', tool: 'sim3d.run', target: '3-D preview', noun: 'scene', local: true }, { frame: 'FR.TOOL.SIM3D', act: 'request', toolRequest: { tool: 'sim3d.run', input: arg } }); }
    if (capF(low, { id: 'pf', v: ['analyze', 'analyse', 'check'], obj: ['drift'], re: /^(?:pattern)?$/ }) || capF(low, { id: 'pf', v: ['spawn'], obj: ['agent'], mods: ['echo', 'writer'], re: /^[\s\S]*$/ }) || capF(low, { id: 'pf', v: ['hibernate', 'restore', 'run', 'send'], obj: ['agent'], re: /^pf-\d[\s\S]*$/ }) || capF(low, { id: 'pf', v: ['list'], obj: ['agent'], re: /^$/ }) || low.split(/[^a-z-]+/).some(w => /^proto-?forge$/.test(w))) { /* ProtoForge: frames over its own nouns (agent, drift) or a mention of its name */
      rules.push({ id: 'PF-INTERNAL-ONLY', doc: 'ProtoForge is Forge\'s internal tool chest; no user command lane invokes it' }); return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'blocked', action: low.replace(/^please /, '').replace(/\bmy\b/g, 'your'), reason: 'PF_INTERNAL' }, { frame: 'FR.PF.INTERNAL', act: 'request' }); }
    { const tw = raw.trim().split(/\s+/), tm = tw.length > 3 && /^(?:for|of)$/i.test(tw[tw.length - 3]) && /^turn$/i.test(tw[tw.length - 2]) && /^\d{1,6}$/.test(tw[tw.length - 1]) ? [null, tw.slice(0, -3).join(' '), tw[tw.length - 1]] : null; /* PP operand: (for|of) turn NUM */ const form = RD.parseRequest(tm ? tm[1] : raw); if (form) { const tl = store.load('trace'); const last = tl.slice().reverse().find(t => t.msm && t.msm.meaning && !/^render/.test(t.msm.meaning.kind) && t.output && (!tm || t.turn === +tm[2]));
      if (!last) { rules.push({ id: 'RMC-RENDER-NO-MANIFEST', doc: 'RMC 01 output forms' }); return res('SELECTED_MEANING', { kind: 'render_none', form }, { frame: 'FR.RENDER', act: 'request' }); }
      const art = RD.render(form, last, last.output, ENV); pendingRender = art; rules.push({ id: 'RMC-RENDER-' + form.toUpperCase().replace('.', '-'), doc: 'RMC 00 §output forms; RMC 01 (one manifest, many forms; Echo per form)', note: art.echo.mode });
      return res('SELECTED_MEANING', { kind: 'rendered', form, turn: last.turn, pass: !!art.echo.pass }, { frame: 'FR.RENDER', act: 'request' }); } }
    if ((m = capF(raw, { id: 'research', v: ['research'], re: /^(.{2,160}?)$/ }) || capF(raw, { id: 'research', v: ['look'], part: 'up', re: /^(.{2,160}?)$/ }) || capF(raw, { id: 'research', v: ['search'], obj: ['web'], re: /^for\s+(.{2,160}?)$/i }) || capF(raw, { id: 'research', v: ['find'], obj: ['source'], re: /^(?:on|about)\s+(.{2,160}?)$/i })) && !ctx.negAct) { rules.push({ id: 'EF-FRAME-RESEARCH', doc: 'EchoForge tool bench; forge research_acquisition.py' }); const topic = m[1].replace(/["“”]/g, "'").trim(); return res('SELECTED_MEANING', { kind: 'tool_started', tool: 'research.web', target: topic, noun: 'topic' }, { frame: 'FR.TOOL.RESEARCH', act: 'request', toolRequest: { tool: 'research.web', input: topic } }); }
    if ((m = capF(raw, { id: 'feed', v: ['read', 'check', 'follow'], obj: ['feed', 'newsfeed'], mods: ['rss', 'atom', 'news'], re: /^(https?:\/\/\S{3,400})$/i })) && !ctx.negAct) { const u = m[1].replace(/[)\].,]+$/, ''); rules.push({ id: 'EF-FRAME-FEED', doc: 'RUNTIME CODEX Vol III §4.1.1 RSS feeds (tracker-free; evidence only)' }); return res('SELECTED_MEANING', { kind: 'tool_started', tool: 'feed.read', target: u, noun: 'feed' }, { frame: 'FR.TOOL.FEED', act: 'request', toolRequest: { tool: 'feed.read', input: u } }); }
    if ((m = capF(raw, { id: 'capture', v: ['capture', 'clip', 'save'], obj: ['page', 'webpage'], objOpt: true, mods: ['web'], re: /^(https?:\/\/\S{3,400})$/i })) && !ctx.negAct) { rules.push({ id: 'EF-FRAME-CAPTURE', doc: 'EchoForge tool bench; Register A-07 page capture' }); return res('SELECTED_MEANING', { kind: 'tool_started', tool: 'capture.page', target: m[1].replace(/[)\].,]+$/, ''), noun: 'page' }, { frame: 'FR.TOOL.CAPTURE', act: 'request', toolRequest: { tool: 'capture.page', input: m[1].replace(/[)\].,]+$/, '') } }); }
    if ((m = capF(raw, { id: 'symbols', v: ['index'], obj: ['symbol'], re: /^(?:in|of)\s+(?:the\s+)?(?:repo(?:sitory)?\s+)?([\w.-]+\/[\w.-]+)$/i })) && !ctx.negAct) { rules.push({ id: 'EF-FRAME-SYMBOLS', doc: 'EchoForge tool bench; mobile plan symbol index' }); return res('SELECTED_MEANING', { kind: 'tool_started', tool: 'github.symbols', target: m[1], noun: 'repository' }, { frame: 'FR.TOOL.SYMBOLS', act: 'request', toolRequest: { tool: 'github.symbols', input: m[1] } }); }
    if ((m = (() => { const w = raw.trim().replace(/[\s?]+$/, '').split(/\s+/); /* wh-locative question over a passive participle: where COP NAME defined */ return w.length === 4 && /^where$/i.test(w[0]) && /^(?:is|are)$/i.test(w[1]) && /^defined$/i.test(w[3]) ? w[2].match(/^([A-Za-z_$][\w$]{0,80})$/) : null; })())) { const hits = SY.find(store.load('symbol_index'), m[1]); rules.push({ id: 'EF-FRAME-SYMFIND', doc: 'symbol index (exact name match)', note: hits.length + ' hit(s)' });
      return res('SELECTED_MEANING', hits.length ? { kind: 'tool_result', tool: 'symbols.find', noun: 'definition', items: hits.map(h => h.repo + '/' + h.path + ':' + h.line + ' (' + h.kind + ')'), sealed: false } : { kind: 'tool_failed', tool: 'symbols.find', reason: 'no indexed definition' }, { frame: 'FR.TOOL.SYMFIND', act: 'question' }); }
    const SIMOP = /^(?: of)?(?: (\d{1,2}))?(?: (?:balls|bodies))?(?: with seed (\d{1,9}))?$/;
    if ((m = capF(low, { id: 'sim', v: ['simulate', 'preview'], obj: ['simulation', 'preview'], objOpt: true, mods: ['physics'], sp: true, re: SIMOP }) || capF(low, { id: 'sim', v: ['run'], obj: ['simulation', 'preview'], mods: ['physics'], sp: true, re: SIMOP }) || capF(low, { id: 'sim', np: ['simulation', 'preview'], mods: ['physics'], sp: true, re: SIMOP }))) { const r = SIM.run({ bodies: m[1] ? +m[1] : undefined, seed: m[2] ? +m[2] : undefined }); const runs = store.load('sim_runs'); const id = 'sim:' + (runs.length + 1); runs.push({ id, params: r.params, final_hash: r.final_hash, energy: r.energy, label: r.label, engine: r.engine }); store.save('sim_runs', runs.slice(-100));
      rules.push({ id: 'EF-FRAME-SIM', doc: 'M7 browser physics preview (sim.js; labelled preview)', note: id + ' seed ' + r.params.seed + ' · ' + r.params.steps + ' steps' }); return res('SELECTED_MEANING', { kind: 'sim_result', bodies: r.bodies, hash: r.final_hash.slice(0, 12), sim: id }, { frame: 'FR.TOOL.SIM', act: 'request' }); }
    if ((m = capF(low, { id: 'replay', v: ['replay'], obj: ['simulation', 'preview'], mods: ['last'], sp: true, re: /^(?: (\d+))?$/ }))) { const runs = store.load('sim_runs').filter(x => x.kind !== '3d'); const rec = m[1] ? runs.find(x => x.id === 'sim:' + m[1]) : runs[runs.length - 1]; if (rec) { const rp = SIM.replay(rec); rules.push({ id: 'EF-SIM-REPLAY', doc: 'M7 replay = re-run from stored seed + params; compare final hash', note: rec.id + (rp.ok ? ' match' : ' MISMATCH') }); return res('SELECTED_MEANING', { kind: 'sim_replay', ok: rp.ok, sim: rec.id }, { frame: 'FR.TOOL.SIM', act: 'request' }); } }
    if ((m = capF(raw, { id: 'files', v: ['list', 'show'], obj: ['file'], re: /^in\s+(?:the\s+)?(?:repo(?:sitory)?\s+)?([\w.-]+\/[\w.-]+)$/i })) && !ctx.negAct) { rules.push({ id: 'EF-FRAME-GITHUB', doc: 'EchoForge tool bench; M1 read-only GitHub' }); return res('SELECTED_MEANING', { kind: 'tool_started', tool: 'github.read', target: m[1], noun: 'repository' }, { frame: 'FR.TOOL.GITHUB', act: 'request', toolRequest: { tool: 'github.read', input: m[1] } }); }
    if (capF(low, { id: 'patterns', v: ['reflect'], re: /^(?:on (?:our|my) conversations?)?$/ }) || capF(low, { id: 'patterns', v: ['run'], obj: ['gilligan'], re: /^$/ }) || (() => { const w = low.replace(/\?$/, '').split(' '); /* Q-WH-DET over a perception verb with kartā Forge: what N(pattern) do you V(see|notice) */ return w.length === 5 && w[0] === 'what' && /^patterns?$/.test(w[1]) && w[2] === 'do' && w[3] === 'you' && SELF_PERC.has(w[4]); })()) { const g = OP.gilligan(store); rules.push({ id: 'EF-FRAME-PATTERNS', doc: 'GenNode Doc 10 Gilligan (reflection only)', note: g.patterns.length + ' patterns over ' + g.basis.facts + ' facts / ' + g.basis.traces + ' traces' }); return res('SELECTED_MEANING', { kind: 'patterns', items: g.patterns.map(p => p.word + ' (' + p.count + ')') }, { frame: 'FR.PATTERNS', act: 'question' }); }
    /* FR.EXTERNAL by parse (4.9.39; no first-word match): a directive — bare imperative, or "can/could/will/would you V …" (kartā Forge) — whose verb lemma
       (lemmatised, tagged V base) is in the external-effect class SELF_EXT, and whose VP parses over the whole rest, is understood and blocked (understanding ≠
       permission, Pāṇini paper D5/D6). A prohibition ("do not send …") needs only the verb: its scope is the act. */
    { const tk = content(G.tokenize(raw)); let i = 0; if (tk[i] && tk[i].w === 'please') i++; if (tk[i] && /^(can|could|will|would)$/.test(tk[i].w) && tk[i + 1] && tk[i + 1].w === 'you') i += 2; if (tk[i] && tk[i].w === 'please') i++;
      const body = tk.slice(i), P = body.length ? G.Parser(body, glex) : null, v = P && P.at(0, 'V').find(a => a.f === 'base' && SELF_EXT.has(a.lemma)) && !P.at(0, 'PRON').length;
      if (v) { const lem = P.at(0, 'V').find(a => a.f === 'base' && SELF_EXT.has(a.lemma)).lemma;
        if (ctx.negAct) return res('SELECTED_RESTRICTED_MEANING', { kind: 'neg_act', act: body[0].w }, { frame: 'FR.EXTERNAL', act: 'request' });
        const vps = P.vp(0).filter(x => x.i === body.length && x.node.verb && x.node.verb.lemma === lem);
        if (vps.length) { rules.push({ id: 'G-IMPERATIVE', doc: 'Doc5 §15 (directive; VP parsed over the whole rest)' }, { id: 'CAP-UNSUPPORTED-EXTERNAL', doc: 'Doc1; Doc5 §17; Doc8 (external-effect verb class SELF_EXT)' });
          const at = low.indexOf(body[0].w), tl = low.slice(at < 0 ? 0 : at).replace(/[?.!]+\s*$/, ''), ti = raw.toLowerCase().lastIndexOf(tl);
          return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'blocked', action: (ti >= 0 && raw.length - ti - tl.length <= 1 ? raw.substr(ti, tl.length) : tl).replace(/\bmy\b/gi, 'your'), reason: 'NO_EXTERNAL' }, { frame: 'FR.EXTERNAL', act: 'request' }); } } }
    if ((() => { const tk = content(G.tokenize(raw)); return tk.length === 3 && tk[0].w === 'what' && (G.CL[tk[1].w] || []).includes('COP') && /^(it|this|that|they)$/.test(tk[2].w); })()) { /* Q-WH-COPULA over a bare deictic/anaphor with no antecedent: the referent is unresolved (parse: WH COP PRON) */ const low2 = 'what is ' + content(G.tokenize(raw))[2].w; low = low2; rules.push({ id: 'LL-REF-UNRESOLVED', doc: 'Doc6 §23' }); g.connectedness = 'unresolved referent'; return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: low.split(' ')[2], options: [] }, { frame: 'FR.DEFINE', act: 'question' }); }
    return grammarFrames(raw, low, ctx, rules, g, res, clarifyUnknown);
  }

  function grammarFrames(raw, low, ctx, rules, g, res, clarifyUnknown) {
    let toks = content(G.tokenize(raw.replace(/^\s*please[,\s]+/i, '').replace(/[,\s]+please[.!?]?\s*$/i, '')));
    let instead = false; if (toks.length && toks[toks.length - 1].w === 'instead') { toks = toks.slice(0, -1); instead = true; }
    if (toks.length && /^(actually|correction)$/.test(toks[0].w)) { toks = toks.slice(toks[1] && /^[,:]$/.test(toks[1].w) ? 2 : 1); instead = true; }
    const w0 = toks[0] ? toks[0].w : '';
    const dreamLen = /^(suppose|imagine|hypothetically)$/.test(w0) ? 1 : (w0 === 'what' && toks[1] && toks[1].w === 'if') || (w0 === 'let' && toks[1] && /^(us|'s)$/.test(toks[1].w)) ? 2 : (w0 === 'i' && toks[1] && /^(dreamed|dreamt|imagined)$/.test(toks[1].w)) ? 2 : 0;
    if (dreamLen && !ctx.negAct) { let body = toks.slice(dreamLen); if (w0 === 'let' && body[0] && body[0].w === 'say') body = body.slice(1); if (body[0] && /^[,:]$/.test(body[0].w)) body = body.slice(1); if (body[0] && body[0].w === 'that') body = body.slice(1);
      if (body.length >= 2) { ctx.dream = true; ctx.dreamVerb = /^(imagine|imagined|dreamed|dreamt)$/.test(w0 === 'i' ? toks[1].w : w0) ? 'imagine' : 'suppose'; rules.push({ id: 'CT-DREAM-FRAME', doc: 'RMC containment; forge dream_state_quarantine.py (Patch 266)', note: 'speculative frame: ' + toks.slice(0, dreamLen).map(t => t.w).join(' ') }); return declarative(body, 'FR.DREAM', 'assertion', false); } }
    const ask = /^(can|could|will|would)$/.test(w0) && toks.length > 3 && toks[1] && toks[1].w === 'you' && toks[2] && MEM_V.has(toks[2].w);
    if (MEM_V.has(w0) || ask) {
      let body = toks.slice(ask ? 3 : 1); if (body[0] && body[0].w === 'that') body = body.slice(1);
      if (body.length && /^(maybe|perhaps|possibly|probably)$/.test(body[0].w)) { body = body.slice(1); if (body[0] && body[0].w === ',') body = body.slice(1); rules.push({ id: 'LL-MOD-HEDGE', doc: 'Doc3 §18' }); ctx.hedge = true; }
      if (body.length >= 2 && body[0].w === 'i' && /^(think|believe|guess|suppose)$/.test(body[1].w)) { body = body.slice(body[2] && body[2].w === 'that' ? 3 : 2); rules.push({ id: 'LL-MOD-HEDGE', doc: 'Doc3 §18' }); ctx.hedge = true; }
      if (!body.length) { g.expectancy = 'missing content'; rules.push({ id: 'G-EXP-MISSING-ROLE', doc: 'Doc6 §11' }); return res('INCOMPLETE_PRESERVED', { kind: 'clarify_incomplete', act: 'remember', missing: 'REMEMBER_WHAT' }, { frame: 'FR.REMEMBER', act: 'request' }); }
      if (body[0].w === 'to') { rules.push({ id: 'G-REMEMBER-TO-AS-NOTE', doc: 'Doc5 §15' }); if (ctx.negAct) return res('SELECTED_RESTRICTED_MEANING', { kind: 'neg_act', act: 'note' }, { frame: 'FR.NOTE.ADD', act: 'request' }); const txt = body.slice(1).map(t => t.orig).join(' '); return res('SELECTED_MEANING', { kind: 'note_added', n: notes().length + 1, text: txt }, { frame: 'FR.NOTE.ADD', act: 'request', write: { note: txt } }); }
      return declarative(body, 'FR.REMEMBER', 'request', true);
    }
    if (/^(forget|delete|erase|remove)$/.test(w0) && toks.length > 1) { // FR.FORGET — lawful delete with confirmation (Doc7: cold storage, never erasure)
      let body = toks.slice(1); let recs = []; const fb = () => { rules.push({ id: 'AUTH-DELETE-SCOPE', doc: 'Doc7; Doc6 §36.15 (only stored facts can be forgotten, with confirmation)' }); return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'blocked', action: toks.map(t => (/^(my|me|i|myself)$/.test(t.w) ? swap[t.w] : t.orig)).join(' ').replace(/^\w/, c => c.toLowerCase()), reason: 'FORGET_SCOPE' }, { frame: 'FR.FORGET', act: 'request' }); };
      if (ctx.negAct) return res('SELECTED_RESTRICTED_MEANING', { kind: 'neg_act', act: 'forget' }, { frame: 'FR.FORGET', act: 'request' });
      const ab = body[0].w === 'everything' && body[1] && body[1].w === 'about' ? body.slice(2) : null;
      if (ab) { const P = G.Parser(content(ab), glex); const n = P.np(0).filter(x => x.i === content(ab).length); if (!n.length) return fb(); const subj = clone(n[0].node); const q = { subj, verb: { lemma: 'be' } }; const rr = resolveRefs(q, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.FORGET', act: 'request' });
        const keys = entKeys(q.subj); recs = activeFacts().filter(r => (r.entities || []).some(k => keys.includes(k))); rules.push({ id: 'FR-FORGET-ABOUT-ENTITY', doc: 'Doc7' }); if (!recs.length) return res('SELECTED_MEANING', { kind: 'recall_none', subj: q.subj }, { frame: 'FR.FORGET', act: 'request' }); }
      else { if (body[0].w === 'that') body = body.slice(1); const unk = unknownToks(body); if (unk.length) return clarifyUnknown(unk); const d = derive(body); if (!d.parses.length) return fb();
        if (d.parses.length > 1) { rules.push({ id: 'G-STRUCTURAL-AMBIGUITY-PRESERVED', doc: 'Doc3 §40; Doc6 §29' }); return res('AMBIGUITY_PRESERVED', { kind: 'clarify_readings', readings: d.parses.slice(0, 4).map(p => describe(p.node.clause)) }, { frame: 'FR.FORGET', act: 'request' }); }
        const cl = d.parses[0].node.clause; const rr = resolveRefs(cl, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.FORGET', act: 'request' });
        const k0 = canon(G.material(cl)); recs = activeFacts().filter(r => canon(G.material(r.clause)) === k0); rules.push({ id: 'FR-FORGET-EXACT-FACT', doc: 'Doc7 (exact structural match only)' });
        if (!recs.length) return res('SELECTED_MEANING', { kind: 'recall_none', subj: cl.subj || { propn: 'that' } }, { frame: 'FR.FORGET', act: 'request' }); }
      meta.pending = { type: 'forget', ids: recs.map(r => r.id) }; rules.push({ id: 'AUTH-FORGET-ASK-CONFIRM', doc: 'Doc7; Doc6 §30 (deletion needs explicit confirmation)' });
      return res('CLARIFICATION_REQUIRED', { kind: 'confirm_forget', items: recs.map(r => r.clause) }, { frame: 'FR.FORGET', act: 'request' }); }
    /* SELF-QUERY by structure (4.9.38; Nic: no keyword routes). A question or directive about Forge's own records is recognised from the PARSE, not from a
       phrase: the kāraka frame (kartā = Forge or the user, a cognition / saying / showing / meaning verb from the lexical classes below, the gapped kāraka,
       the viṣaya adjunct) selects the record query. Growth is by adding words to a class, never by adding a phrase. */
    const PREP_END = r => (G.CL[r[r.length - 1].w] || []).includes('PREP');
    /* GKS-PREMISE (4.9.42): a wh-copula question whose subject NP is structurally identical (same material NP, determiner aside) to a shared fact's subject
       is answered from the shared layer, phrased by its source class. A private fact about the same subject that agrees answers as private recall; one that
       disagrees yields gks_conflict with both sources (neither overwrites the other). A challenged fact is phrased as an unverified claim. */
    function gksAnswer(subj) { const k = npKey(subj); const hits = gksIndex().filter(e => e.keys.includes(k)); if (!hits.length) return null;
      const phr = f => ({ id: f.id, text: f.text, source: f.source.citation, cls: f.status === 'challenged' ? 'weak_unverified' : f.source.class });
      const lin = KN.lineages(hits.map(h => h.f)); const priv = activeFacts().filter(r => !r.sensitive && r.clause && !r.clause.coord && r.clause.verb && r.clause.verb.lemma === 'be' && r.clause.subj && npKey(r.clause.subj) === k);
      if (priv.length) { const fc = hits[0].clause; if (fc && priv.some(r => canon(G.material(r.clause.pred || {})) === canon(G.material(fc.pred || {})))) return null;
        rules.push({ id: 'GKS-CONFLICT-PRIVATE', doc: 'plan §1: private and shared facts never overwrite each other; both sources reported', note: priv[0].id + ' ↔ ' + lin[0].id });
        return res('SELECTED_MEANING', { kind: 'gks_conflict', clause: priv[0].clause, fact: phr(lin[0]) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: [priv[0].id, lin[0].id] }); }
      rules.push({ id: 'GKS-PREMISE', doc: 'shared fact as premise with provenance (EMN: lineage counted once; signature = publisher, not truth)', note: lin.map(f => f.id + ' ← ' + f.source.citation).join('; ') });
      return res('SELECTED_MEANING', { kind: 'gks_fact', items: lin.map(phr) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: lin.map(f => f.id), premises: lin.map(f => ({ id: f.id, kind: 'shared', class: f.source.class, citation: f.source.citation, url: f.source.url, body_sha256: f.body_sha256, status: f.status })) }); }
    function metaQ(q, gap, wh) { if (!q || q.coord || !q.verb) return null; const L = q.verb.lemma, ro = q.roles || {}, isK = n => n && n.pron === 'kernel', isU = n => n && n.pron === 'user';
      const vis = (q.adj || []).find(a => a.role === 'vishaya' && a.np); const recN = n => n && !n.conj && n.head && n.head.length === 1 && SELF_REC[n.head[0]] && !n.propn ? SELF_REC[n.head[0]] : null;
      const about = np => { const rr = resolveRefs({ subj: np, verb: { lemma: 'be' } }, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.ABOUT', act: 'question' });
        const key = entKey(np); const fs = factsAbout(key); const v = fs.filter(r => !r.sensitive); rules.push({ id: 'MEM-QUERY-ENTITY', doc: 'Doc7; exact entity key (no similarity); frame read from the parse (Q-SELF-COGNITION)', note: key + ' → ' + fs.length }); ctx.clauseForDiscourse = { subj: np, verb: { lemma: 'be' } };
        return res('SELECTED_MEANING', Object.assign({ kind: 'about', subj: np, items: v.map(r => r.clause) }, fs.length - v.length ? { hidden: fs.length - v.length } : {}), { frame: 'FR.ABOUT', act: 'question', evidenceRefs: v.map(r => r.id) }); };
      const list = what => { rules.push({ id: 'Q-SELF-LIST', doc: 'Doc7; record noun class (SELF_REC) read from the parse' }); if (what === 'notes') return res('SELECTED_MEANING', { kind: 'notes', items: notes().map(n => n.text) }, { frame: 'FR.NOTE.LIST', act: 'request' }); if (what === 'reminders') { rules.push({ id: 'G-REMINDER-LIST', doc: 'reminders store' }); return res('SELECTED_MEANING', { kind: 'reminders', items: store.load('reminders').filter(r => r.state === 'pending').map(r => r.text + ' — ' + (r.when || r.due)) }, { frame: 'FR.REMIND', act: 'question' }); }
        const fs = activeFacts(), v = fs.filter(r => !r.sensitive), m = { kind: 'facts', items: v.map(r => r.clause) }; if (fs.length - v.length) m.hidden = fs.length - v.length; return res('SELECTED_MEANING', m, { frame: 'FR.MEM.LIST', act: 'question' }); };
      /* Forge's own state, by noun class and frame (4.9.39; replaces the META phrase list): help / status / terms / time */
      const hd = n => n && !n.conj && n.head ? n.head : null, own = n => !n.owner || n.owner === 'kernel';
      const help = () => { rules.push({ id: 'Q-SELF-HELP', doc: 'Doc5 §17 capability registry; frame from the parse' }); return res('SELECTED_MEANING', { kind: 'help' }, { frame: 'FR.HELP', act: 'request' }); };
      const status = () => { rules.push({ id: 'Q-SELF-STATUS', doc: 'RMC drift ε_s; frame from the parse (status noun class)' }); const l = meta.last || { eps_s: 0, band: 'clean', phase: 9 }; return res('SELECTED_MEANING', { kind: 'status', eps: l.eps_s, band: l.band, phase: M.PHASES[l.phase].sym, chi: meta.chi }, { frame: 'FR.STATUS', act: 'question' }); };
      const terms = () => { rules.push({ id: 'Q-SELF-TERMS', doc: 'Doc4 controlled terms; frame from the parse' }); return res('SELECTED_MEANING', { kind: 'terms', items: lex.all().filter(x => x.category === 'term' && !x.retired).map(x => x.surfaces[0]) }, { frame: 'FR.TERMS', act: 'question' }); };
      const isStatusNP = n => hd(n) && own(n) && hd(n).every(h => SELF_STATUS_N.has(h)) && !n.det, isHelpNP = n => hd(n) && !n.owner && hd(n).length === 1 && SELF_HELP_N.has(hd(n)[0]) && !n.det;
      if (gap === 'np' && isHelpNP(q.subj)) return help();
      if (gap === 'np' && isStatusNP(q.subj)) return status();
      if (gap === 'imp' && L === 'help' && !Object.keys(ro).length) return help();
      if (gap === 'imp' && SELF_SHOW.has(L) && ro.karma && hd(ro.karma) && hd(ro.karma).every(h => SELF_STATUS_N.has(h)) && own(ro.karma)) return status();
      if (gap === 'imp' && SELF_SHOW.has(L) && ro.karma && hd(ro.karma) && hd(ro.karma).join(' ') === 'term' && ro.karma.plural) return terms();
      if (gap === 'pred' && wh === 'what' && q.subj && q.subj.owner === 'kernel' && hd(q.subj) && hd(q.subj).every(h => SELF_STATUS_N.has(h))) return status();
      if (wh === 'what' && gap === 'role:karma' && isK(q.subj) && q.verb.mod === 'able' && L === 'do' && !ro.karma) return help();
      if (gap === 'manner' && isU(q.subj) && L === 'use' && ro.karma && (isK(ro.karma) || ro.karma.det === 'this' || ro.karma.indef === 'this' || ro.karma.pron3 === 'this')) return help();
      /* wh-determiner reading ("what N …"): the gap is "the N" in its base position (wh.det) */
      if (gap === 'whdet') { const N = wh; if (SELF_STATUS_N.has(N) && isK(q.subj)) return status(); if (N === 'term' && isK(q.subj) && SELF_COGN.has(L)) return terms();
        if (SELF_TIME_N.has(N) && q.subj && q.subj.pron3 === 'it' && q.verb.lemma === 'be') { rules.push({ id: 'EV-NO-CLOCK-AUTHORITY', doc: 'Doc7; Doc6 §37; frame from the parse (time noun class)' }); return res('REFUSAL_RELEVANT', { kind: 'refuse', reason: 'NO_TIME_SOURCE' }, { frame: 'FR.TIME', act: 'question' }); } return null; }
      /* cognition: "what do you know / remember (about NP)", "tell me (everything) about NP" (imperative: kartā = Forge) */
      if (isK(q.subj) && SELF_COGN.has(L) && (gap === 'role:karma' || gap === 'imp') && !ro.karma) { rules.push({ id: 'Q-SELF-COGNITION', doc: 'Doc5 kāraka: kartā = Forge, karma gapped, viṣaya = topic' }); return vis ? about(vis.np) : list('facts'); }
      if (gap === 'imp' && SELF_SAY.has(L) && isU(ro.sampradana || ro.karma) && vis && (!ro.karma || ro.karma.indef || isU(ro.karma))) { rules.push({ id: 'Q-SELF-COGNITION', doc: 'Doc5 kāraka: directive “tell me … about NP”' }); return about(vis.np); }
      if (gap === 'imp' && SELF_SAY.has(L) && ro.sampradana && isU(ro.sampradana) && ro.karma && ro.karma.indef && !vis) { rules.push({ id: 'Q-SELF-COGNITION', doc: 'Doc5' }); return list('facts'); }
      /* provenance: "when did I tell you / say / mention (that CLAUSE | about NP)" — kartā = user, saying verb, kāla gapped */
      if (gap === 'role:kala' && isU(q.subj) && SELF_SAY.has(L)) { let recs = []; const k = ro.karma && ro.karma.clause;
        if (k) { const rr = resolveRefs(k, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.WHEN', act: 'question' }); recs = activeFacts().filter(r => matches(k, null, r)); }
        const tn = vis ? vis.np : ro.karma && !ro.karma.clause && !isK(ro.karma) ? ro.karma : null; if (!recs.length && tn) recs = factsAbout(entKey(tn));
        const hidden = recs.filter(r => r.sensitive).length; recs = recs.filter(r => !r.sensitive); rules.push({ id: 'MEM-QUERY-PROVENANCE-TIME', doc: 'Doc7 provenance; frame read from the parse (kartā user, saying verb, kāla gap)', note: recs.length + ' record(s)' + (hidden ? ', ' + hidden + ' sensitive withheld' : '') });
        if (!recs.length) return res('SELECTED_MEANING', { kind: 'recall_none', subj: tn || (k && k.subj) || { propn: 'that' } }, { frame: 'FR.WHEN', act: 'question' });
        return res('SELECTED_MEANING', { kind: 'when', items: recs.map(r => ({ clause: r.clause, turn: r.provenance.turn, when: fmtTime(r.provenance.at) })) }, { frame: 'FR.WHEN', act: 'question', evidenceRefs: recs.map(r => r.id) }); }
      /* showing: "list / show (me) my facts / notes" */
      if (gap === 'imp' && SELF_SHOW.has(L) && recN(ro.karma)) return list(recN(ro.karma));
      /* "what are my notes" / "what do you remember" handled above; copular list */
      if (((gap === 'pred' && wh === 'what' && q.verb.lemma === 'be') || gap === 'np') && recN(q.subj) && (q.subj.owner === 'user' || q.subj.plural) && !(q.subj.owner && q.subj.owner !== 'user')) return list(recN(q.subj));
      /* meaning: "what does X mean", "define / explain X", "what is (a|the) X", "what is the meaning of X" */
      const generic = n => n && !n.conj && !n.owner && !n.rel && !n.relObj && !n.of && !n.quant && !n.num && n.head && n.head.length === 1 && (!n.adjs || !n.adjs.length) && (!n.det || /^(a|an|the)$/.test(n.det));
      const meaningOf = n => n && n.head && n.head.length === 1 && SELF_MEAN_N.has(n.head[0]) && n.of && generic(n.of) ? n.of : null;
      let term = null; if (wh === 'what' && gap === 'role:karma' && L === 'mean' && q.subj && q.subj.quote !== undefined && /^[a-z][a-z'-]*$/i.test(q.subj.quote)) return defineWord(q.subj.quote.toLowerCase()) || (!lex.known(q.subj.quote.toLowerCase()) ? clarifyUnknown([q.subj.quote.toLowerCase()]) : null);
      if (wh === 'what' && gap === 'role:karma' && SELF_MEAN_V.has(L) && L === 'mean' && generic(q.subj)) term = q.subj;
      else if (gap === 'imp' && SELF_MEAN_V.has(L) && L !== 'mean' && generic(ro.karma) && !ro.sampradana) term = ro.karma;
      else if (gap === 'pred' && wh === 'what' && q.verb.lemma === 'be') term = meaningOf(q.subj) || (generic(q.subj) ? q.subj : null);
      else if (gap === 'np') term = meaningOf(q.subj);
      if (term) return defineWord((term.surface || term.head)[0].toLowerCase(), term.head[0]);
      /* capability: "can you V …" — kartā = Forge, modal of ability: the verb is checked against the capability registry (CAPS), never a phrase */
      if (!wh && gap === null && isK(q.subj) && q.verb.mod === 'able' && q.verb.pol === 'pos') { const reg = SELF_CAPS.has(L), bare = !Object.keys(ro).length && !(q.adj || []).length;
        if (reg && bare) { rules.push({ id: 'Q-SELF-CAPABILITY', doc: 'Doc5 §17 capability registry; frame from the parse (kartā Forge, mod able)' }); return res('SELECTED_MEANING', { kind: 'help' }, { frame: 'FR.CAPABILITY', act: 'question' }); }
        if (!reg) { rules.push({ id: 'CAP-UNSUPPORTED', doc: 'Doc5 §17; frame from the parse' }); return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'blocked', action: G.vpText(Object.assign({}, q, { verb: Object.assign({}, q.verb, { mod: 'asserted', tense: 'none', nf: 'inf' }) }), q.subj, 'kernel').replace(/^to /, ''), reason: 'NOT_REGISTERED' }, { frame: 'FR.CAPABILITY', act: 'question' }); } }
      return null; }
    function defineWord(w, lemma) { const ctl = lex.lookup(w).concat(lemma && lemma !== w ? lex.lookup(lemma) : []).filter((c, i, a) => c.id !== 'NUM.LITERAL' && c.category !== 'function' && a.findIndex(x => x.id === c.id) === i);
      if (ctl.length === 1) { const k = ctl[0]; rules.push({ id: 'LX-CONTROLLED-FIRST', doc: 'Doc4; Doc5 §12.28; Doc8 (controlled terms precede external resources); frame from the parse (Q-SELF-MEANING)', note: k.id }); return res('SELECTED_MEANING', { kind: 'define', term: w, gloss: k.senses[0].gloss, source: k.source || 'seed lexicon' }, { frame: 'FR.DEFINE', act: 'question', evidenceRefs: ['lexicon:' + k.id] }); }
      if (ctl.length > 1) { rules.push({ id: 'LL-AMBIGUITY-PRESERVED', doc: 'Doc3 §40; Doc6 §29', note: ctl.map(x => x.id).join(' | ') }); meta.pending = { type: 'sense', word: w, senses: ctl.map(x => ({ sid: x.id, gloss: x.senses[0].gloss.replace(/\.$/, ''), source: x.source || 'seed lexicon' })) }; return res('AMBIGUITY_PRESERVED', { kind: 'clarify_ambiguous', word: w, senses: ctl.map(x => x.senses[0].gloss.replace(/\.$/, '')) }, { frame: 'FR.DEFINE', act: 'question' }); }
      return null; }
    const qr = questionReadings(); if (qr) return qr;
    { const P1 = G.Parser(toks, glex); /* directive with implicit kartā Forge ("tell me about X", "define X", "show my notes"): read as the clause "you V …" */
      if (P1.at(0, 'V').some(a => a.f === 'base')) for (const pz of derive([{ w: 'you', orig: 'you' }].concat(toks)).parses) { const mq = metaQ(pz.node.clause, 'imp', null); if (mq) { rules.push({ id: 'G-IMPERATIVE', doc: 'Doc5 §15 (directive speech act; implicit kartā)' }); return mq; } }
      const n = P1.np(0).filter(x => x.i === toks.length); if (n.length === 1) { const mq = metaQ({ subj: clone(n[0].node), verb: { lemma: 'be', tense: 'present', pol: 'pos', mod: 'asserted' } }, 'np', null); if (mq) return mq; } }
    const P0 = G.Parser(toks, glex); const isImp = toks.length && P0.at(0, 'V').some(a => a.f === 'base') && (!P0.at(0, 'N').length || (toks[1] && /^(a|an|the|my|your|this|that|these|those|it|them|me|his|her|its|their)$/.test(toks[1].w))) || /^(go|come|tell|give|make|take|get|bring|let|show|find|write|read|call|help|put|turn|stop|start|wake|cook|clean|wash|fix|close|check|look|listen|watch|eat|drink)$/.test(w0);
    if (isImp && !derive(toks).parses.length) { const vp = P0.vp(0).filter(v => v.i === toks.length);
      if (vp.length) { rules.push({ id: 'G-IMPERATIVE', doc: 'Doc5 §15 (directive speech act)' }, ...vp[0].rules.filter(Boolean).map(id => ({ id, doc: ruleDoc(id) })), { id: 'AUTH-UNDERSTOOD-NOT-AUTHORIZED', doc: 'Doc1; Doc6 §36.15' });
        if (ctx.negAct) return res('SELECTED_RESTRICTED_MEANING', { kind: 'neg_act', act: vp[0].node.verb.lemma }, { frame: 'FR.IMPERATIVE', act: 'request' });
        return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'blocked', action: toks.map(t => (/^(my|me|i|myself)$/.test(t.w) ? swap[t.w] : t.orig)).join(' ').replace(/^\w/, c => c.toLowerCase()), reason: 'OUT_OF_SCOPE' }, { frame: 'FR.IMPERATIVE', act: 'request' }); } }
    const unk = unknownToks(toks); if (unk.length) return clarifyUnknown(unk);
    return declarative(toks, 'FR.ASSERT', 'assertion', false);

    function declarative(body, frame, act, remember) {
      const ub = unknownToks(body); if (ub.length && remember && ub.length <= 3) { meta.pending = { type: 'teach', raw: ctx.raw, low: ctx.low, words: ub }; g.connectedness = 'unknown-concept'; rules.push({ id: 'LX-TEACH-ASK', doc: 'WM v1 Contract (memory commands may require known vocabulary): ask, then admit through the lexicon gate', note: ub.join(', ') }); return res('CLARIFICATION_REQUIRED', { kind: 'clarify_teach', words: ub }, { frame, act }); }
      if (ub.length) return clarifyUnknown(ub);
      const d = derive(body); rules.push({ id: 'G-DERIVATION', doc: 'Doc3; R0 (Paninian derivation)', note: d.parses.length + ' distinct derivation(s)' });
      if (!d.parses.length) { g.expectancy = 'no derivation'; rules.push({ id: 'G-NO-DERIVATION', doc: 'Doc6 §36.19' }); return res('NO_LAWFUL_CANDIDATE', { kind: 'no_frame' }, { frame, act }); }
      if (d.parses.length > 1 && !(ctx.chosenReading && ctx.chosenReading <= Math.min(4, d.parses.length))) { rules.push({ id: 'G-STRUCTURAL-AMBIGUITY-PRESERVED', doc: 'Doc3 §40; Doc6 §29' }); const readings = d.parses.slice(0, 4).map(p => describe(p.node.clause)); meta.pending = { type: 'reading', raw: ctx.raw, low: ctx.low, frame, act, count: readings.length, readings }; return res('AMBIGUITY_PRESERVED', { kind: 'clarify_readings', readings }, { frame, act }); }
      const parse = d.parses[ctx.chosenReading ? ctx.chosenReading - 1 : 0]; rules.push(...parse.rules.map(id => ({ id, doc: ruleDoc(id) })));
      const cl = parse.node.clause; if (ctx.hedge) setMod(cl, 'possible'); if (ctx.chosenReading) cl.resolved_reading = ctx.chosenReading;
      const rr = resolveRefs(cl, rules); if (rr.clarify) { g.connectedness = 'referent'; meta.pending = { type: 'referent', raw: ctx.raw, low: ctx.low, frame, act, word: rr.clarify.word, options: rr.clarify.options, reading: ctx.chosenReading || 0, count: d.parses.length }; return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame, act }); } if (cl.resolved_reading) heldNow = [canon(G.material(cl))];
      const sense = senseInfo(cl); if (sense) rules.push({ id: sense.rule, doc: 'Doc5 frames (WordNet verb frames); Doc6 §16–17, §19', note: sense.status + ' · ' + (sense.candidates || []).length + ' candidate sense(s)' });
      ctx.clauseForDiscourse = cl;
      if (ctx.dream) { rules.push({ id: 'CT-DREAM-QUARANTINE', doc: 'forge dream_state_quarantine.py: truth_support_allowed=false, stable_memory_allowed=false' }); return res('SELECTED_RESTRICTED_MEANING', { kind: 'dream_held', clause: cl, verb: ctx.dreamVerb || 'suppose' }, { frame, act, sense, contain: 'dream' }); }
      if (!remember && ctx.privacy) { rules.push({ id: 'PRIV-2.1 SECRET-NOT-KEPT', doc: 'Doc7; Doc6 §36.15', note: 'value sealed at ingestion; no remember request → dropped' }); return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'secret_dropped', subjNP: cl.coord ? null : cl.subj, subj: cl.coord ? 'that' : G.npText(cl.subj, 'kernel') }, { frame, act, sense }); }
      if (!remember) { rules.push({ id: 'AUTH-ASSERT-NOT-STORE', doc: 'Doc1; Doc6 §36.15 (understanding is not authorization)' }); return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'assert_ack', clause: cl }, { frame, act, sense }); }
      if (ctx.negAct) { rules.push({ id: 'LL-NEG-ACT-SCOPE', doc: 'Doc3 §15', note: 'negation scopes over the request act → no write' }); return res('SELECTED_RESTRICTED_MEANING', { kind: 'neg_act', act: 'store' }, { frame, act }); }
      rules.push({ id: 'AUTH-EXPLICIT-REMEMBER', doc: 'Doc7', note: 'explicit user request authorizes memory.write' });
      const same = activeFacts().find(r => canon(G.material(r.clause)) === canon(G.material(cl)));
      if (same) return res('SELECTED_MEANING', { kind: 'merged', clause: cl }, { frame, act, write: { clause: cl, mergeWith: same.id }, sense });
      /* latest status (Pāṇini paper L2736–2751 time/status preservation; D3 §24 supersession): a lifecycle predicate (proposed / installed / failed /
         rolled back …) about the same subject is one status-bearing fact; the newer statement is the current status, the older moves to cold storage with
         its history (never deleted, never shown as an equal current fact) */
      { const st = lifecycle(cl); const old = st ? activeFacts().filter(r => r.clause && !r.clause.coord && lifecycle(r.clause) && subjMatch(holder(cl), holder(r.clause)) && canon(G.material(r.clause)) !== canon(G.material(cl))) : [];
        if (old.length) { rules.push({ id: 'MEM-STATUS-SUPERSEDE', doc: 'Pāṇini paper L2736–2751; Doc3 §24', note: old.map(r => lifecycle(r.clause)).join(' → ') + ' → ' + st + ' (current)' }); return res('SELECTED_MEANING', { kind: 'replaced', clause: cl, was: old[old.length - 1].clause }, { frame, act, write: { clause: cl, supersede: old.map(r => r.id) }, sense }); } }
      const cf = conflicts(cl);
      if (cf.length) { rules.push({ id: cf[0].why, doc: 'Doc7; Doc3 §24 (correction/supersession)', note: 'conflicts with ' + cf.map(x => x.r.id).join(', ') });
        if (instead) { rules.push({ id: 'MEM-EXPLICIT-CORRECTION', doc: 'Doc3 §24' }); return res('SELECTED_MEANING', { kind: 'replaced', clause: cl }, { frame, act, write: { clause: cl, supersede: cf.map(x => x.r.id) }, sense }); }
        meta.pending = { type: 'replace', clause: cl, old: cf[0].r.clause, oldIds: cf.map(x => x.r.id) }; rules.push({ id: 'MEM-CONTRADICTION-ASK', doc: 'Doc6 §30 (clarify, never silently overwrite)' });
        return res('CLARIFICATION_REQUIRED', { kind: 'confirm_replace', old: cf[0].r.clause, clause: cl }, { frame, act }); }
      if (ctx.privacy && ctx.privacy.vault !== 'unlocked') { rules.push({ id: 'PRIV-2.2 VAULT-' + String(ctx.privacy.vault).toUpperCase(), doc: 'Doc7; forge Identity Vault', note: 'no unlocked vault → the value is not kept anywhere' }); return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'vault_locked', state: ctx.privacy.vault, subjNP: cl.coord ? null : cl.subj, subj: cl.coord ? 'that' : G.npText(cl.subj, 'kernel') }, { frame, act, sense }); }
      if (ctx.privacy && !cl.coord) { rules.push({ id: 'PRIV-2.3 SEAL', doc: 'Doc7; forge Identity Vault' }); return res('SELECTED_MEANING', { kind: 'stored_sensitive', subjNP: cl.subj, subj: G.npText(cl.subj, 'kernel') }, { frame, act, write: { clause: cl, supersede: [] }, sense }); }
      if (!cl.coord && SENSITIVE.test(G.npText(cl.subj, 'user').toLowerCase())) { rules.push({ id: 'PRIV-SENSITIVE-ACK-MASKED', doc: 'Doc7 (sensitive values sealed; never echoed); forge Identity Vault' }); return res('SELECTED_MEANING', { kind: 'stored_sensitive', subjNP: cl.subj, subj: G.npText(cl.subj, 'kernel') }, { frame, act, write: { clause: cl, supersede: [] }, sense }); }
      return res('SELECTED_MEANING', { kind: 'stored', clause: cl }, { frame, act, write: { clause: cl, supersede: [] }, sense, uncertainty: hasMod(cl) ? 'hedged by user' : 'none' });
    }
    function questionReadings() {
      if (toks.length < 2) return null; const w = toks[0].w;
      /* LL-STRUCTURE-DEPENDENCE (Chomsky, Princeton/Wayne State transcripts; Moro): the fronted auxiliary belongs to the ROOT clause — it is restored right after
         the complete subject NP (a hierarchical position), never after the n-th word and never inside a relative clause: "can eagles that fly swim" asks
         whether eagles that fly can swim, not whether eagles that can fly swim */
      const insertAt = (base, aux) => { const out = []; for (let k = 1; k < base.length; k++) { const ps = derive(base.slice(0, k).concat([aux], base.slice(k))).parses; if (!ps.length) continue;
        const subj = G.Parser(base.slice(0, k), glex).np(0).filter(x => x.i === k).map(x => canon(G.material(x.node)));
        for (const p of ps) { const c = p.node && p.node.clause; if (c && c.subj && !c.coord && !c.cond && !subj.includes(canon(G.material(c.subj)))) continue; out.push(p); } } return out; };
      let reads = [], gap = null, qrule = null, wdR = null;
      if (w === 'what' && toks.length > 3 && /^(is|are|was|were|did|does|do|will|can|could|might)$/.test(toks[1].w) && /^(do|doing|done)$/.test(toks[toks.length - 1].w)) { // Q-WH-PRO-VERB-DO: "what is X doing / what did X do"
        const mid = toks.slice(2, -1); const P = G.Parser(mid, glex); const n = P.np(0).filter(x => x.i === mid.length);
        if (n.length && n[0].node.pron === 'kernel' && /^(can|could)$/.test(toks[1].w)) { rules.push({ id: 'Q-SELF-HELP', doc: 'Doc5 §17; frame from the parse (kartā Forge, ability modal, pro-verb do)' }); return res('SELECTED_MEANING', { kind: 'help' }, { frame: 'FR.HELP', act: 'request' }); }
        if (n.length) { const subj = clone(n[0].node); rules.push({ id: 'Q-WH-PRO-VERB-DO', doc: 'Doc5 §15; Doc3 (pro-verb "do" questions the event)' }); const q = { subj, verb: { lemma: null } }; const rr = resolveRefs(q, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.QUESTION', act: 'question' });
          ctx.clauseForDiscourse = { subj: q.subj, verb: { lemma: 'be' } }; const recs = activeFacts().filter(r => !r.clause.coord && predOf(r.clause) !== 'be' && subjMatch(q.subj, r.clause.subj) && !r.sensitive);
          rules.push({ id: 'MEM-RECALL-STRUCTURAL', doc: 'Doc7', note: 'event gap → ' + recs.length });
          return recs.length ? res('SELECTED_MEANING', { kind: 'recall', items: recs.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: recs.map(r => r.id) }) : res('SELECTED_MEANING', { kind: 'recall_none', subj: q.subj }, { frame: 'FR.QUESTION', act: 'question' }); } }
      if (/^(do|does|did|is|are|was|were|will|can|could|might|may|should|has|have)$/.test(w) && toks.length > 2) { reads = insertAt(toks.slice(1), toks[0]); qrule = 'Q-YN-INVERSION'; }
      else if (w === 'why' && /^(do|does|did|is|are|was|were|will|can|could|might|has|have)$/.test(toks[1].w) && toks.length > 3) { // Q-WH-WHY: the reason is only what the user stated with "because"
        const rs = insertAt(toks.slice(2), toks[1]); const uq = []; const sn = new Set(); for (const r of rs) { const kk = canon(G.material(r.node)); if (!sn.has(kk)) { sn.add(kk); uq.push(r); } }
        if (!uq.length) { const unk = unknownToks(toks); if (unk.length) return clarifyUnknown(unk); return null; }
        if (uq.length > 1) { rules.push({ id: 'G-STRUCTURAL-AMBIGUITY-PRESERVED', doc: 'Doc3 §40; Doc6 §29' }); return res('AMBIGUITY_PRESERVED', { kind: 'clarify_readings', readings: uq.slice(0, 4).map(p => describe(p.node.clause)) }, { frame: 'FR.QUESTION', act: 'question' }); }
        const q = uq[0].node.clause; rules.push({ id: 'Q-WH-WHY', doc: 'Doc5 §15; reasons only from stated "because" clauses (Doc6 §27 no hidden inference)' }, ...uq[0].rules.filter(Boolean).map(id => ({ id, doc: ruleDoc(id) })));
        const rr = resolveRefs(q, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.QUESTION', act: 'question' }); ctx.clauseForDiscourse = q;
        const core = c => { const y = Object.assign({}, c); delete y.sub; return canon(G.material(y)); }; const qk = core(q);
        const hits = activeFacts().filter(r => !r.sensitive && !r.clause.coord && core(r.clause) === qk);
        const why = hits.filter(r => r.clause.sub && r.clause.sub.conj === 'because'); rules.push({ id: 'MEM-RECALL-STRUCTURAL', doc: 'Doc7', note: 'why → ' + why.length + ' stated reason(s) / ' + hits.length + ' fact(s)' });
        if (why.length) return res('SELECTED_MEANING', { kind: 'recall', items: why.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: why.map(r => r.id) });
        if (hits.length) return res('SELECTED_MEANING', { kind: 'no_reason', clause: hits[0].clause }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: [hits[0].id] });
        return res('SELECTED_MEANING', { kind: 'recall_none', subj: q.subj || { propn: 'that' } }, { frame: 'FR.QUESTION', act: 'question' }); }
      else if (w === 'what' && toks.length > 3 && G.Parser(toks.slice(1, 2), glex).at(0, 'N').length && /^(is|are|was|were|do|does|did|can)$/.test(toks[2].w) && (wdR = (() => { /* Q-WH-DET: "what N AUX/COP …" — reconstruct "the N" in the gap, parse, read the frame */
        const N = G.Parser(toks.slice(1, 2), glex).at(0, 'N')[0].lemma, aux = toks[2], rest = toks.slice(3), theN = [{ w: 'the', orig: 'the' }, toks[1]];
        let rs = []; if (rest.length) for (let k = rest.length; k >= 1 && !rs.length; k--) rs = insertAt(rest.slice(0, k).concat(theN, rest.slice(k)), aux); /* the gap is the first position (from the right) where “the N” yields a parse */
        const cs = rs.map(r => r.node.clause).filter(c => c && !c.coord); if (cs.length) { rules.push({ id: 'Q-WH-DET', doc: 'Doc5 §15 (wh-determiner phrase restored to its base position)' }); for (const c of cs) for (const nl of G.Parser(toks.slice(1, 2), glex).at(0, 'N').map(x => x.lemma)) { const mq = metaQ(c, 'whdet', nl); if (mq) return mq; } }
        /* Q-WH-ATTRIBUTE (4.9.41): "what N COP NP" where N names an attribute with a lexical value class (ATTR_CLASS): only a stored adjectival predicate whose
           word is in that class answers; any other predicate ("fast") is not a value of the attribute, so the answer is "no stored fact", never a guess */
        if (ATTR_CLASS[N] && /^(?:is|are|was|were)$/.test(aux.w) && rest.length) { const np = npOnly(rest); if (np) { const cls = ATTR_CLASS[N]; rules.push({ id: 'Q-WH-ATTRIBUTE', doc: 'Doc5 §15; attribute noun → value class (lexical)', note: N });
          const hits = activeFacts().filter(r => !r.sensitive && r.clause && !r.clause.coord && r.clause.verb.lemma === 'be' && r.clause.verb.pol === 'pos' && r.clause.pred && r.clause.pred.type === 'adj' && r.clause.pred.words.length === 1 && cls.has(r.clause.pred.words[0]) && subjMatch(np, r.clause.subj));
          return hits.length ? res('SELECTED_MEANING', { kind: 'recall', items: hits.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: hits.map(r => r.id) }) : res('SELECTED_MEANING', { kind: 'recall_none', subj: np, attr: N }, { frame: 'FR.QUESTION', act: 'question' }); } }
        return null; })())) return wdR;
      else if (w === 'how' && toks[1].w === 'many' && toks.length > 2) { /* Q-WH-HOW-MANY (quantity of the gapped karma): "how many N (AUX NP V …)" — N must be a record noun (SELF_REC); the clause, if any, must parse with N as its karma */
        const n = G.Parser(toks.slice(2, 3), glex).np(0).filter(x => x.i === 1)[0]; const what = n && n.node.head && SELF_REC[n.node.head[0]]; if (!what) return null; const tail = toks.slice(3);
        let ok = !tail.length, ab = null, q = null; if (tail.length) { const rs = /^(do|does|did)$/.test(tail[0].w) ? insertAt(tail.slice(1), tail[0]) : []; const u = rs.map(r => r.node.clause).filter(c => c && !c.coord && c.verb && (SELF_COGN.has(c.verb.lemma) || c.verb.lemma === 'have') && !(c.roles && c.roles.karma)); if (u.length) { q = u[0]; ok = true; const v = (q.adj || []).find(a => a.role === 'vishaya' && a.np); ab = v ? v.np : null; } }
        if (!ok) return null; rules.push({ id: 'Q-WH-HOW-MANY', doc: 'Doc5 (quantity of the gapped karma); record noun class SELF_REC' });
        if (ab) { const rr = resolveRefs({ subj: ab, verb: { lemma: 'be' } }, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.MEM.COUNT', act: 'question' }); const fs = factsAbout(entKey(ab)); rules.push({ id: 'MEM-QUERY-COUNT', doc: 'Doc7' }); return res('SELECTED_MEANING', { kind: 'count_about', n: fs.length, subj: ab }, { frame: 'FR.MEM.COUNT', act: 'question' }); }
        return what === 'notes' ? res('SELECTED_MEANING', { kind: 'count', n: notes().length, what: 'note' }, { frame: 'FR.NOTE.COUNT', act: 'question' }) : res('SELECTED_MEANING', { kind: 'count', n: activeFacts().length, what: 'fact' }, { frame: 'FR.MEM.COUNT', act: 'question' }); }
      else if (w === 'how' && toks.length > 2) { // Q-WH-HOW: "how ADJ is NP" (degree), "how is NP" (state), "how did NP V …" (manner/instrument)
        let i = 1, adjW = null; if (!/^(is|are|was|were|do|does|did)$/.test(toks[1].w)) { adjW = toks[1].w; i = 2; } if (!toks[i]) return null;
        const aux = toks[i].w, rest = toks.slice(i + 1);
        if (/^(is|are|was|were)$/.test(aux) && rest.length) { const n = G.Parser(rest, glex).np(0).filter(x => x.i === rest.length); if (!n.length) return null;
          const q = { subj: clone(n[0].node), verb: { lemma: 'be', tense: /^(was|were)$/.test(aux) ? 'past' : 'present', pol: 'pos', mod: 'asserted' } }; rules.push({ id: adjW ? 'Q-WH-HOW-DEGREE' : 'Q-WH-HOW-STATE', doc: 'Doc5 §15 (how-question over the predicate)' });
          const rr = resolveRefs(q, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.QUESTION', act: 'question' }); ctx.clauseForDiscourse = q;
          const hits = activeFacts().filter(r => !r.sensitive && !r.clause.coord && r.clause.verb.lemma === 'be' && r.clause.pred && subjMatch(q.subj, r.clause.subj) && (adjW ? JSON.stringify(G.material(r.clause.pred)).includes('"' + adjW + '"') : r.clause.pred.type === 'adj'));
          rules.push({ id: 'MEM-RECALL-STRUCTURAL', doc: 'Doc7', note: 'how → ' + hits.length });
          return hits.length ? res('SELECTED_MEANING', { kind: 'recall', items: hits.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: hits.map(r => r.id) }) : res('SELECTED_MEANING', { kind: 'recall_none', subj: q.subj }, { frame: 'FR.QUESTION', act: 'question' }); }
        if (!adjW && /^(do|does|did)$/.test(aux)) { const rs = insertAt(rest, toks[i]); if (rs.length !== 1) return null; const q = rs[0].node.clause; { const mq = metaQ(q, 'manner', null); if (mq) return mq; } rules.push({ id: 'Q-WH-HOW-MANNER', doc: 'Doc5 karaṇa (instrument/means)' }); const rr = resolveRefs(q, rules); if (rr.clarify) return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.QUESTION', act: 'question' });
          const hits = activeFacts().filter(r => !r.sensitive && !r.clause.coord && predOf(r.clause) === predOf(q) && subjMatch(q.subj, r.clause.subj) && ((r.clause.adj || []).some(a => a.role === 'karana' || a.role === 'prakara') || (r.clause.sub && r.clause.sub.conj === 'because'))); /* 4.9.38: a stored manner adverb (prakāra) answers how */
          return hits.length ? res('SELECTED_MEANING', { kind: 'recall', items: hits.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: hits.map(r => r.id) }) : res('SELECTED_MEANING', { kind: 'recall_none', subj: q.subj }, { frame: 'FR.QUESTION', act: 'question' }); }
        return null; }
      else if (/^(what|who|whom|where|when|which)$/.test(w)) {
        const w1 = toks[1].w, rest = toks.slice(2);
        if (/^(is|are|was|were)$/.test(w1) && rest.length) { const P = G.Parser(rest, glex); const n = P.np(0).filter(x => x.i === rest.length);
          if (n.length) { const subj = clone(n[0].node); { const mq = n.length === 1 || w === 'what' ? metaQ({ subj, verb: { lemma: 'be', tense: 'present', pol: 'pos', mod: 'asserted' } }, 'pred', w) : null; if (mq) return mq; } if (w === 'what' || w === 'who') { const ga = gksAnswer(subj); if (ga) return ga; } return answer({ subj, verb: { lemma: 'be', tense: /^(was|were)$/.test(w1) ? 'past' : 'present', pol: 'pos', mod: 'asserted' } }, w === 'where' ? 'role:adhikarana' : w === 'when' ? 'role:kala' : 'pred', 'Q-WH-COPULA', n[0].rules); } }
        if (/^(do|does|did|will|can|might|could|would|should)$/.test(w1)) { reads = insertAt(rest, toks[1]); gap = w === 'where' ? 'role:adhikarana' : w === 'when' ? 'role:kala' : 'role:karma'; qrule = 'Q-WH-DO-SUPPORT';
          /* use/mention (Doc4): in “what does X mean” X may be any word MENTIONED, not used — read it as a quoted mention NP when it has no nominal reading */
          if (!reads.length && rest.length === 2 && SELF_MEAN_V.has(rest[1].w)) { reads = insertAt([{ w: '"' + rest[0].w + '"', orig: '"' + rest[0].w + '"' }, rest[1]], toks[1]); if (reads.length) rules.push({ id: 'LX-MENTION-NP', doc: 'Doc4 use/mention: a word asked about is mentioned, not used' }); } }
        else if (/^(who|what|which)$/.test(w)) { reads = derive([{ w: 'zgapz', orig: 'Zgapz' }].concat(toks.slice(1))).parses; gap = 'subj'; qrule = 'Q-WH-SUBJECT-GAP'; }
      } else return null;
      if (!reads.length) { const unk = unknownToks(toks); if (unk.length) return clarifyUnknown(unk); return null; }
      const uniq = []; const seen = new Set(); for (const r of reads) { const k = canon(G.material(r.node)); if (!seen.has(k)) { seen.add(k); uniq.push(r); } }
      if (uniq.length > 1) { const keep = uniq.filter(r => !(r.node.clause && r.node.clause.pred && r.node.clause.pred.type === 'pp' && r.node.clause.pred.prep === 'of')); if (keep.length && keep.length < uniq.length) { rules.push({ id: 'LL-COPULA-OF-APAVADA', doc: 'Doc3 apavāda: a bare “of” phrase is not a copular predicate when a nominal reading exists' }); uniq.splice(0, uniq.length, ...keep); } }
      if (uniq.length > 1) { rules.push({ id: 'G-STRUCTURAL-AMBIGUITY-PRESERVED', doc: 'Doc3 §40; Doc6 §29' }); return res('AMBIGUITY_PRESERVED', { kind: 'clarify_readings', readings: uniq.slice(0, 4).map(p => describe(p.node.clause)) }, { frame: 'FR.QUESTION', act: 'question' }); }
      const q = uniq[0].node.clause; if (gap === 'subj') q.subj = null;
      if (gap === 'role:karma' && q.roles && q.roles.karma) { if (/^(what|which)$/.test(toks[0].w) && animNP(q.roles.karma) && !q.roles.sampradana) { q.roles = { sampradana: q.roles.karma }; rules.push({ id: 'Q-WH-KARMA-SHIFT', doc: 'Doc5 (animate first object = sampradāna when karma is the gap)' }); } else gap = null; }
      { const mq = metaQ(q, gap, G.CL[toks[0].w] && G.CL[toks[0].w].includes('WH') ? toks[0].w : null); if (mq) return mq; }
      return answer(q, gap, qrule, uniq[0].rules);
    }
    function inferYN(q, negFact) {
      if (!q || q.coord || !q.subj || q.verb.mod !== 'asserted' || q.verb.tense === 'future' || q.cond) return null;
      const facts = activeFacts().filter(r => !r.sensitive); const byId = id => facts.find(r => r.id === id);
      for (const v of virtualFacts(facts)) { const c = v.clause; if (predOf(c) !== predOf(q) || !subjMatch(q.subj, c.subj) || !predEq(q, c)) continue; const qk = roleKey(q), rk = roleKey(c); if (Object.keys(qk).some(k => !(k in rk) || canon(qk[k]) !== canon(rk[k]))) continue;
        rules.push({ id: v.rule, doc: v.doc, note: v.from.length + ' stored fact(s)' }); const stepsC = v.from.map(byId).filter(Boolean);
        if (c.verb.pol !== q.verb.pol) return res('SELECTED_MEANING', { kind: 'yesno', answer: 'no', items: stepsC.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: v.from });
        return res('SELECTED_MEANING', { kind: 'inferred', answer: 'yes', claim: q, steps: stepsC.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: v.from }); }
      const posQ = Object.assign({}, q, { verb: Object.assign({}, q.verb, { pol: 'pos' }) });
      const done = (rule, steps, wn, pf) => { rules.push(Object.assign({ id: rule, doc: 'infer.js (Doc5 roles; Doc6 §21, §27 lawful inference)', note: steps.length + ' stored fact(s)' + (wn ? ' + WordNet ' + wn.length + ' step(s)' : '') }, pf ? { proof: pf.proof_id, check: pf.check.code } : {}));
        const stepsC = steps.map(id => byId(id)).filter(Boolean);
        const qNeg = q.verb.pol === 'neg';
        if (negFact || qNeg) { const neg = negFact || facts.map(r => r.clause).find(c => !c.coord && canon(G.material(Object.assign({}, c, { verb: Object.assign({}, c.verb, { pol: 'pos' }) }))) === canon(G.material(posQ)) && c.verb.pol === 'neg');
          if (neg) { rules.push({ id: 'INF-NEG-CONSISTENCY', doc: 'Doc3 §15; Doc7 contradiction → ask' }); return res('CLARIFICATION_REQUIRED', Object.assign({ kind: 'inferred', answer: 'contradiction', claim: posQ, neg, steps: stepsC.map(r => r.clause) }, wn ? { wn } : {}), { frame: 'FR.QUESTION', act: 'question', evidenceRefs: steps }); }
          if (qNeg) return res('SELECTED_MEANING', { kind: 'yesno', answer: 'no', items: stepsC.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: steps }); }
        return res('SELECTED_MEANING', Object.assign({ kind: 'inferred', answer: 'yes', claim: posQ, steps: stepsC.map(r => r.clause) }, wn ? { wn } : {}, pf ? { admitted: pf.rule_ids.length } : {}), { frame: 'FR.QUESTION', act: 'question', evidenceRefs: steps }); };
      const a = entKey(q.subj);
      let tgt = null; if (q.verb.lemma === 'be' && q.pred && q.pred.type === 'pp' && /^(in|at|inside|within)$/.test(q.pred.prep)) tgt = q.pred.np; else if (/^(live|reside|stay)$/.test(q.verb.lemma)) { const ad = (q.adj || []).find(x => x.role === 'adhikarana'); if (ad) tgt = ad.np; }
      if (tgt && a) { const p = INF.locPath(facts, a, entKey(tgt)); if (p && p.length >= 2) return done('INF-LOC-TRANSITIVE', p.map(e => e.id), null, INF.lastProof()); }
      { const rp = INF.relPath(facts, q); if (rp && rp.path.length >= 1) return done('INF-REL-TRANSITIVE-' + rp.rel.replace(/^cmp:.*/, 'COMPARATIVE').toUpperCase(), rp.path.map(e => e.id), null, INF.lastProof()); }
      { const AR = admittedRules(), ents = [...new Set(nps(q).filter(n => !n.pron3).map(entKey).filter(Boolean))]; if (AR.length && ents.length === 2) { const F = ruleFacts(facts); try { const pr = R.ruleWorld(F, AR).prove({ predicate: predOf(q) === 'be' ? 'isa' : predOf(q), args: ents, polarity: 'pos' });
        if (pr && R.checkRuleProof(F, AR, pr).ok) { const out = done('GELC-ADMITTED-RULE', pr.fact_ids, null, pr); rules.find(x => x.id === 'GELC-ADMITTED-RULE').rules_used = pr.rule_ids.slice(); return out; } } catch (e) { /* an unsafe stored rule never answers */ } } }
      if (q.verb.lemma === 'be' && q.pred && q.pred.type === 'np' && q.pred.np && q.pred.np.head && !q.pred.np.owner && !q.pred.np.propn) { const target = INF.npHead(q.pred.np);
        const generic = q.subj.head && !q.subj.owner && !q.subj.propn && (q.subj.det === 'a' || q.subj.det === 'an' || q.subj.plural);
        const starts = generic ? [{ cls: INF.npHead(q.subj), id: null }] : INF.classesOf(facts, a).filter(c => !c.neg);
        for (const st of starts) for (const dj of INF.disjoint(facts)) { const ra = INF.classReach(facts, st.cls, dj.a); const rb = dj.b === target ? { via: [] } : INF.classReach(facts, target, dj.b);
          if (ra && ra.status === 'yes' && rb && (rb.status === 'yes' || !rb.status)) { const steps = [st.id].concat(ra.via, [dj.id], rb.via || []).filter(Boolean); rules.push({ id: 'INF-ISA-DISJOINT', doc: 'infer.js negative universal (Doc6 §21)', note: steps.length + ' stored fact(s)' });
            return res('SELECTED_MEANING', { kind: 'yesno', answer: 'no', items: steps.map(id => facts.find(r => r.id === id)).filter(Boolean).map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: steps }); } }
        for (const st of starts) { const r = INF.classReach(facts, st.cls, target); if (!r) continue;
          if (r.status === 'mixed') { rules.push({ id: 'INF-ISA-SENSE-DISAGREEMENT', doc: 'Doc4; Doc6 §29 (no guess across senses)', note: r.wn.senses.map(x => x.sid + (x.reaches ? '✓' : '✗')).join(' ') }); return res('CLARIFICATION_REQUIRED', { kind: 'depends', word: st.cls === r.chain[0] || !r.chain.length ? st.cls : r.chain[0], reach: r.wn.senses.filter(x => x.reaches).length, n: r.wn.senses.length, target }, { frame: 'FR.QUESTION', act: 'question' }); }
          const steps = [st.id].concat(r.via).filter(Boolean); if (!steps.length && !r.wn) continue;
          if (r.wn && r.wn.paths[0].length < 2 && !r.via.length) continue;
          return done(r.via.length ? 'INF-ISA-STORED' : 'INF-ISA-WORDNET', steps, r.wn ? r.wn.paths[0] : null, r.proof); } }
      if (q.verb.lemma === 'be' && q.pred && q.pred.type === 'np' && q.pred.np && q.pred.np.owner && INF.FAMILY[INF.npHead(q.pred.np)] && a) { const role = INF.npHead(q.pred.np); const want = INF.FAMILY[role];
        const b = typeof q.pred.np.owner === 'object' ? entKey(q.pred.np.owner) : q.pred.np.owner; const hits = INF.famRel(facts, a, b).filter(h => h.rel === want);
        if (hits.length) { const gReq = INF.GENDER_OF_ROLE[role]; if (gReq) { const gs = INF.genderStated(facts, a); if (gs !== gReq) { rules.push({ id: 'INF-FAMILY-GENDER-UNSTATED', doc: 'gender only from explicit user statements' }); return res('SELECTED_MEANING', { kind: 'refuse', reason: 'GENDER_UNSTATED', want }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: hits[0].via }); } }
          return done(hits[0].rule, hits[0].via, null, hits[0].proof); } }
      return null; }
    function answer(q, gap, qrule, prules) {
      rules.push({ id: qrule, doc: 'Doc5 §15 (question speech act); Doc3' }, ...prules.filter(Boolean).map(id => ({ id, doc: ruleDoc(id) })));
      if (q.subj) { const rr = resolveRefs(q, rules); if (rr.clarify) { g.connectedness = 'referent'; return res('CLARIFICATION_REQUIRED', { kind: 'clarify_referent', word: rr.clarify.word, options: rr.clarify.options }, { frame: 'FR.QUESTION', act: 'question' }); } }
      if (q.subj) ctx.clauseForDiscourse = q;
      let recs = activeFacts().filter(r => matches(q, gap, r));
      if (!recs.length && gap) { const fs = activeFacts().filter(r => !r.sensitive); const vs = virtualFacts(fs).filter(v => matches(q, gap, { clause: v.clause })); if (vs.length) { rules.push({ id: vs[0].rule, doc: vs[0].doc, note: 'wh-recall through a one-step derivation' }); recs = vs.map(v => ({ id: v.from[0], clause: v.clause, entities: [] })); } }
      if (!recs.length && gap === 'pred' && q.subj) recs = activeFacts().filter(r => !r.clause.coord && r.clause.verb.lemma === 'be' && r.clause.pred && r.clause.pred.np && entKeys(r.clause.pred.np).includes(entKey(q.subj)));
      rules.push({ id: 'MEM-RECALL-STRUCTURAL', doc: 'Doc7; RPMC (exact structural match; RPM weight displayed, never decides)', note: (gap || 'yes/no') + ' → ' + recs.length + ' record(s)' });
      const sens = recs.filter(r => r.sensitive); if (sens.length || (!gap && activeFacts().some(r => r.sensitive && subjMatch(q.subj, r.clause.subj) && predOf(r.clause) === predOf(q)))) { rules.push({ id: 'LL-OUTPUT-BOUNDARY-PRIVATE', doc: 'Doc3 §20' }); return res('UNDERSTOOD_ACTION_BLOCKED', { kind: 'blocked', action: 'show ' + (q.subj ? G.npText(q.subj, 'kernel') : 'that record'), reason: 'SENSITIVE_RECORD' }, { frame: 'FR.QUESTION', act: 'question' }); }
      if (gap) { if (!recs.length) return res('SELECTED_MEANING', { kind: 'recall_none', subj: q.subj || { propn: 'that' } }, { frame: 'FR.QUESTION', act: 'question' }); return res('SELECTED_MEANING', { kind: 'recall', items: recs.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: recs.map(r => r.id) }); }
      ctx.qVoice = q.verb && q.verb.voice === 'passive' && q.roles && q.roles.karta ? 'passive' : 'active';
      const rel = activeFacts().filter(r => !r.clause.coord && predOf(r.clause) === predOf(q) && subjMatch(actv(q).subj, actv(r.clause).subj));
      if (!rel.length && lifecycle(q)) { const now = activeFacts().filter(r => !r.clause.coord && lifecycle(r.clause) && subjMatch(holder(q), holder(r.clause)));
        if (now.length) { const hist = store.load('cold_storage').filter(x => x.record && x.record.clause && lifecycle(x.record.clause) === lifecycle(q) && subjMatch(holder(q), holder(x.record.clause)));
          rules.push({ id: 'MEM-STATUS-LATEST', doc: 'Pāṇini paper L2736–2751; Doc3 §24', note: (hist.length ? lifecycle(q) + ' (history) → ' : '') + lifecycle(now[now.length - 1].clause) + ' (current)' });
          return res('SELECTED_MEANING', { kind: 'status_now', was: hist.length ? hist[hist.length - 1].record.clause : null, now: now[now.length - 1].clause }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: now.map(r => r.id) }); } }
      if (!rel.length) { const inf = inferYN(q); if (inf) return inf; return res('SELECTED_MEANING', { kind: 'recall_none', subj: q.subj, clause: q }, { frame: 'FR.QUESTION', act: 'question', uncertainty: 'undetermined' }); }
      const strip = c0 => { const c = actv(c0); return canon({ p: predOf(c), s: entKeys(c.subj), r: roleKey(c), pr: c.pred ? (c.pred.np ? { t: c.pred.type, prep: c.pred.prep || null, k: entKeys(c.pred.np) } : G.material(c.pred)) : null }); };
      const sub = (qc, rc) => { qc = actv(qc); rc = actv(rc); if (predOf(qc) !== predOf(rc) || !subjMatch(qc.subj, rc.subj)) return false; const qk = roleKey(qc), rk = roleKey(rc); for (const [k2, v] of Object.entries(qk)) { if (!(k2 in rk)) return false; if (canon(v) !== canon(rk[k2]) && !(Array.isArray(v) && v.every(x => rk[k2].includes(x)))) return false; }
        if (qc.pred) { if (!rc.pred) return false; if (qc.pred.np && rc.pred.np) return canon(entKeys(qc.pred.np)) === canon(entKeys(rc.pred.np)); return canon(G.material(qc.pred)) === canon(G.material(rc.pred)); } return true; }; // LL-YN-SUBSET (question roles ⊆ stored roles)
      const scopeOk = rc => { if (q.subj && rc.subj && QCLASS(q.subj.quant) !== QCLASS(rc.subj.quant)) { rules.push({ id: 'LL-QUANT-MISMATCH', doc: 'Doc3 quantifiers (no inference across quantifiers)' }); return false; } if (wantsSame(q) && scopeOf(rc)) { rules.push({ id: 'LL-QSCOPE-INVERSE-NOT-ENTAILED', doc: 'Doc3 scope; Doc6 §27', note: '∃y∀x preserved, not selected' }); return false; } return true; };
      const exact = rel.filter(r => (strip(r.clause) === strip(q) || sub(q, r.clause)) && scopeOk(r.clause) && restr(actv(q).subj) === restr(actv(r.clause).subj)); let ans = 'unconfirmed', shown = rel;
      if (exact.length) { shown = exact; const r = exact[0].clause; if (r.verb.mod === q.verb.mod && !r.cond) { if (r.verb.mod !== 'asserted') rules.push({ id: 'LL-MODAL-SAME-FORCE', doc: 'Doc3 modality (same modal force only; no modal promotion)' }); ans = r.verb.pol === q.verb.pol ? 'yes' : 'no'; } }
      if (exact.length && ans === 'no') { const inf = inferYN(q, exact[0].clause); if (inf) return inf; }
      if (!exact.length || ans === 'unconfirmed') { const inf = inferYN(q); if (inf) return inf; }
      rules.push({ id: exact.length ? 'LL-NEG-POLARITY-COMPARE' : 'NO-INFERENCE-ACROSS-VALUES', doc: exact.length ? 'Doc3 §15, §18' : 'Doc6 §27 (no hidden inference; no lawful inference rule reached the claim)' });
      return res('SELECTED_MEANING', { kind: 'yesno', answer: ans, items: shown.map(r => r.clause) }, { frame: 'FR.QUESTION', act: 'question', evidenceRefs: shown.map(r => r.id) });
    }
  }

  const ENV = { reparseClause: t => reparseClause(t), reparseNP: t => reparseNP(t), reverify: (m, text) => m && m.kind === 'world_answer' ? worldReverify(m, text) : mathReverify(m) };
  /* world answers: the proposition quoted in the surface is re-parsed by the world grammar and must be the checked query (or its
     opposite) of that status, and the proof it cites is replayed again against its own (branch-scoped) world */
  function worldReverify(m, text) { if (m.pron) { const pm = String(text).match(/^([\s\S]*?) The pronoun means “([^”]+)”\. It can mean “([^”]+)”\.([\s\S]*)$/), sy = s => String(s).replace(/_/g, ' ');
      if (!pm || pm[2] !== sy(m.pron.chosen) || pm[3] !== sy(m.pron.also)) return false; m = Object.assign({}, m); delete m.pron; text = pm[1] + pm[4]; }
    if (m.qty) { try { return R.qtyCheck(m.qty, text); } catch (e) { return false; } }
    if (m.wh) return whReverify(m, text); if (m.why) return whyReverify(m, text); if (m.conj) return conjReverify(m, text); try { const syms = [m.query.predicate].concat(m.query.args).filter(x => /_/.test(x) && !/_(?:than|v)$/.test(x));
      const parse = t => { let u = t; for (const x of syms) u = u.split(x.replace(/_/g, ' ')).join(x); const at = R.parseAtomic(u, false, new Set([m.query.predicate])); if (at) R.alignVerbs(Object.assign({}, m.query), [at]); return at; };
      const said = (String(text).match(/“([^”]+)”/g) || []).map(q => parse(q.slice(1, -1))); if (!said.length || said.some(a => !a)) return false;
      const q = R.canon(m.query), o = R.canon(R.opposite(m.query)), ks = said.map(a => R.canon(a));
      const want = m.status === 'supported_only' ? [q] : m.status === 'refuted_only' ? [o] : m.status === 'conflicted' || m.status === 'undetermined' ? [q, o] : null; if (!want) return undefined;
      if (ks.length !== want.length || ks.some((k, i) => k !== want[i])) return false;
      const pf = m.status === 'supported_only' ? m.proofs.support : m.status === 'refuted_only' ? m.proofs.refutation : null; return pf ? !!R.checkProof(m.world, pf).ok : true; } catch (e) { return false; } }
  /* a wh answer quotes only checked bindings (each re-parsed and its own proof replayed in its own world); with no binding it may quote only the question */
  function whReverify(m, text) { try { const qs = (String(text).match(/“([^”]+)”/g) || []).map(q => q.slice(1, -1)), a = m.wh.answers;
      if (!a.length) return qs.length === 1 && qs[0] === m.wh.question; if (qs.length !== a.length) return false; if (m.wh.count && !new RegExp('\\bcounted ' + a.length + ' ').test(text)) return false;
      return a.every((x, i) => { if (x.status !== 'supported_only') return qs[i] === x.text; const sub = { kind: 'world_answer', status: 'supported_only', query: x.query, proofs: { support: x.proof }, world: x.world }; return worldReverify(sub, '“' + qs[i] + '”') === true; }); } catch (e) { return false; } }
  /* why: the first quote is the question's proposition (its proof replayed when supported); the rest must be exactly the proof's own premises or the branch-checked hypotheses */
  /* a conjunctive answer quotes exactly its deciding parts: each supported/refuted part's proof is replayed in its own world; undetermined parts are quoted as asked */
  function conjReverify(m, text) { try { const qs = (String(text).match(/“([^”]+)”/g) || []).map(q => q.slice(1, -1)), p = m.conj.parts; return qs.length === p.length && p.every((x, i) => x.status === 'undetermined' ? qs[i] === x.text : worldReverify({ kind: 'world_answer', status: x.status, query: x.query, proofs: x.proofs, world: x.world }, '“' + qs[i] + '”') === true); } catch (e) { return false; } }
  function whyReverify(m, text) { try { const w = m.why, qs = (String(text).match(/“([^”]+)”/g) || []).map(q => q.slice(1, -1)); if (qs[0] !== w.query_text) return false;
      if (w.status === 'supported_only' && !R.checkProof(w.world, w.proof).ok) return false; const rest = w.status === 'supported_only' ? (w.premises.length === 1 && w.premises[0] === w.query_text && !w.rules ? [] : w.premises) : w.hypotheses;
      return qs.length === 1 + rest.length && rest.every((x, i) => qs[i + 1] === x); } catch (e) { return false; } }
  function mathReverify(m) { try {
    if (m.kind === 'math') return reverifyMath(m.expr, m.value, m.approx);
    if (m.kind === 'solved' && m.closed) { const z = CA.cubicExact(...[3, 2, 1, 0].map(i => A.P.coef(A.poly(String(m.poly).split('=')[0]), m.x, i).toNumber())); if (!z || z.roots.map(t => t.exact).join('|') !== m.closed.join('|')) return false; }
    if (m.kind === 'solved') return reverifySolve(m.poly, m.noReal ? 'no real solution' : m.roots.map((r, i) => m.x + (m.numeric && m.numeric[i] ? ' ≈ ' : ' = ') + r).join(' or '));
    if (m.kind === 'factored') { const f = A.factor(algebraText(m.input)); return !!(f.ok && (m.irreducible ? f.irreducible : f.result === m.result)); }
    if (m.kind === 'system') { const r = A.solveSystem(m.eqs.map(algebraText)); return !!(r.ok && r.status === 'unique' && m.sol.every(z => r.solution.some(y => y.v === z.v && y.exact === z.exact))); }
    if (m.kind === 'calculus' && m.engine === 'sym') { const d = m.op === 'derivative' ? CA.derivative(m.input, m.x) : CA.integral(m.input, m.x, m.a, m.b); return !!(d.ok && (m.op === 'derivative' ? d.result === m.result : m.a !== undefined ? d.definite.value === m.result : d.result.replace(/ \+ C$/, '') === m.result)); }
    if (m.kind === 'calculus') { if (m.op === 'derivative') { const d = A.derivative(algebraText(m.input), m.x); return !!(d.ok && d.result === m.result); }
      const d = m.a !== undefined ? A.integral(algebraText(m.input), m.x, m.a, m.b) : A.integral(algebraText(m.input), m.x); return !!(d.ok && d.verified && (m.a !== undefined ? d.definite.value === m.result : d.result === m.result)); }
    if (m.kind === 'simplified' && m.rational) { const rs = A.ratSimplify(m.input); return !!(rs.ok && rs.result === m.result && rs.excluded.join() === (m.excluded || []).join()); }
    if (m.kind === 'simplified') return reverifySimplify(m.result);
  } catch (e) { return false; } return undefined; }
  function echo(text, material, vk) { return D.echo(text, material, ENV, vk); }

  function closedCubic(r) { try { if (!r || !r.roots || !r.roots.some(z => z.numeric)) return null; const p = A.poly(String(r.poly).split('=')[0]); const x = r.x; if (A.P.deg(p, x) !== 3) return null;
      const c = [3, 2, 1, 0].map(i => A.P.coef(p, x, i).toNumber()); const z = CA.cubicExact(c[0], c[1], c[2], c[3]); if (!z || z.roots.length !== r.roots.length) return null;
      const ap = r.roots.map(t => parseFloat(t.exact)).sort((a, b) => a - b); if (!z.roots.every((t, i) => Math.abs(t.approx - ap[i]) < 1e-5)) return null; return z; } catch (e) { return null; } }
  function reverifyMath(expr, value, approx) {
    const at = expr.match(/^(.+) at ([a-z]) = (-?[\d.]+)$/); if (at) { const r = A.evaluateAt(algebraText(at[1].replace(/\+_Φ/g, '+').replace(/−_Φ/g, '-')), at[2], at[3]); return !!(r.ok && r.value === value); }
    const e = expr.replace(/×_Φ|×/g, '*').replace(/÷_Φ|÷/g, '/').replace(/\+_Φ/g, '+').replace(/−_Φ|−/g, '-').replace(/√/g, ' sqrt ').replace(/\^_Φ/g, '^');
    const r = M.computeExpr(e); return !!(r.ok && (approx ? Math.abs(parseFloat(r.value) - parseFloat(value)) < 1e-6 : r.value === value)); }
  function reverifySolve(eq, ans) { const e = algebraText(eq.replace(/\+_Φ/g, '+').replace(/−_Φ/g, '-').replace(/ = 0$/, '')); let p; try { p = A.poly(e); } catch (x) { return false; }
    if (/^no real solution/.test(ans)) { const s = A.solveAny(e + '=0'); return !!(s.ok && s.noReal); }
    return ans.split(' or ').every(part => { const m = part.match(/^([a-z]) (=|≈) (.+)$/); if (!m) return false; const val = m[3]; m[2] = val;
      if (/[±√∛∜]/.test(val) || m[0].includes('≈')) { const s = A.solveAny(e + '=0', m[1]); return !!(s.ok && s.verified && s.roots.some(z => z.exact === val)); }
      let v; try { const [n, d] = m[2].split('/'); v = d ? new M.Q(BigInt(n), BigInt(d)) : M.Q.parse(n); } catch (x) { return false; } const r = A.P.subst(p, m[1], v); return A.P.isConst(r) && A.P.constVal(r).n === 0n; }); }
  function reverifySimplify(t) { try { A.poly(algebraText(t.replace(/\+_Φ/g, '+').replace(/−_Φ/g, '-'))); return true; } catch (e) { return false; } }

  const OUTCOME_CLASS = { SELECTED_MEANING: 'selected', SELECTED_RESTRICTED_MEANING: 'selected', AMBIGUITY_PRESERVED: 'ambiguous', CLARIFICATION_REQUIRED: 'clarify', INCOMPLETE_PRESERVED: 'clarify', UNSUPPORTED_PRESERVED: 'refuse',
    INCONGRUENT_REJECTED: 'reject', DISCONNECTED_REJECTED: 'reject', NO_LAWFUL_CANDIDATE: 'reject', REFUSAL_RELEVANT: 'refuse', UNDERSTOOD_ACTION_BLOCKED: 'understood-but-blocked', PURPOSE_UNRECOVERABLE: 'refuse' };
  const INF = IF.Infer({ lex, entKey: n => entKey(n), entKeys: n => entKeys(n), G });

  let curSecrets = [];
  function ellipsis(raw) {
    const one = t => { try { const d = derive(G.tokenize(t)); return d.parses.length === 1 ? d.parses[0].node.clause : null; } catch (e) { return null; } };
    const okPred = c => c && !c.coord && !c.cond && !(c.verb.lemma === 'be' && c.pred && c.pred.type === 'np');
    /* 4.9.41 VP ellipsis by structure (no phrase template): a memory directive V(remember|note) "that" S1 [,] "and" "so" AUX NP — the inverted pro-VP
       "so AUX" licenses copying S1's VP onto NP; or V "that" NP AUX "too" — the stranded auxiliary copies the last stored VP. AUX is the closed AUX/COP class. */
    const tk = G.tokenize(String(raw).replace(/[.!]+\s*$/, '')).filter(t => t.w !== '.' && t.w !== '!'), W = tk.map(t => t.w), O = tk.map(t => t.orig);
    const isAux = w => (G.CL[w] || []).some(t => t === 'AUX' || t === 'COP'); const dirV = W.length > 4 && /^(?:remember|note)$/.test(W[0]) && W[1] === 'that';
    if (!dirV) return null; const dv = O[0];
    for (let k = W.length - 3; k > 2; k--) if (W[k] === 'and' && W[k + 1] === 'so' && isAux(W[k + 2]) && k + 3 < W.length) { const np = npOnly(tk.slice(k + 3)); if (!np) continue;
      const s1 = O.slice(2, W[k - 1] === ',' ? k - 1 : k).join(' ').replace(/\s+([,'])/g, '$1'); const c = one(s1); if (!okPred(c)) return { note: 'antecedent not copyable (copular NP or ambiguous) → left unresolved' };
      return { raw: dv + ' that ' + G.npText(c.subj, 'user') + ' and ' + O.slice(k + 3).join(' ') + ' ' + G.vpText(c, { plural: true, head: ['x'] }, 'user'), note: 'so-does: predicate copied from the first conjunct' }; }
    if (W[W.length - 1] === 'too' && isAux(W[W.length - 2]) && W.length > 4) { const npT = tk.slice(2, -2); if (!npOnly(npT)) return null; const np = O.slice(2, -2).join(' ');
      const last = store.load('memory').filter(r => r.status === 'active' && r.kind === 'relation' && r.clause && !r.sensitive).slice(-1)[0]; const c = last && last.clause;
      if (!okPred(c)) return { note: 'no copyable antecedent clause → nothing copied' };
      const sub = one(np + ' ' + G.vpText(c, { head: ['x'] }, 'user')); if (!sub) return { note: 'copied clause did not parse uniquely → nothing copied' };
      return { raw: dv + ' that ' + np + ' ' + G.vpText(c, sub.subj, 'user'), note: 'too: predicate copied from the last stored fact ' + last.id }; }
    return null; }
  function appositive(raw) { const m = String(raw).match(/^(remember that |note that )?(.+?), (who|which) ([^,]+), (.+?)([.!?]?)$/i); if (!m) return null; const np = m[2].trim(); if (np.split(/\s+/).length > 5) return null;
    return { raw: (m[1] || '') + np + ' ' + m[5] + ', and ' + np + ' ' + m[4] + m[6], note: m[3].toLowerCase() + '-clause split' }; }
  function tagQuestion(raw) {
    const m = raw.match(/^\s*(.+?),\s*(isn't|aren't|wasn't|weren't|doesn't|don't|didn't|is|are|was|were|does|do|did)\s+(it|he|she|they|you|i|we)\s*\?*\s*$/i); if (!m) return null;
    const body = m[1]; const cm = body.match(/^(.+?)\s+(is|are|was|were)\s+(.+)$/i);
    let c = null; try { const d = derive(G.tokenize(body)); c = d.parses.length === 1 ? d.parses[0].node.clause : null; } catch (e) { c = null; }
    if (!c || c.coord) return { note: 'tag question over an unparsed or ambiguous statement → left as typed' };
    if (c.verb.lemma === 'be' && cm) return { raw: cm[2].toLowerCase() + ' ' + cm[1] + ' ' + cm[3] + '?', note: 'copular tag → ' + cm[2].toLowerCase() + '-inversion' };
    if (c.verb.lemma && c.verb.lemma !== 'be' && !c.verb.aspect && c.verb.mod === 'asserted') { const aux = c.verb.tense === 'past' ? 'did' : c.verb.f === 'pres3' ? 'does' : 'do';
      return { raw: aux + ' ' + G.npText(c.subj, 'user') + ' ' + G.vpText(c, { plural: true, head: ['x'] }, 'user') + '?', note: 'lexical-verb tag → do-support inversion' }; }
    return { note: 'tag question form not covered → left as typed' }; }
  /* a multi-sentence message the one-query world grammar cannot take (query not final, first-person query) is read sentence by sentence;
     the user's own first-person statements in it are kept (as “remember that …”) so a later question in the same message can use them */
  const SEQ_CODES = /^(?:QUERY_NOT_FINAL|UNSUPPORTED_QUERY_STRUCTURE|MULTIPLE_QUERIES|SENTENCE_LIMIT)$/;
  function process(input) { if (pendingCase !== undefined) { caseNS = pendingCase; pendingCase = undefined; if (caseNS) { const ix = baseStore.load('case_index'); const id = caseNS.slice(5); if (!ix.includes(id)) baseStore.save('case_index', ix.concat([id])); } } const txt = String(input || '').normalize('NFC'), parts = txt.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
    if (parts.length > 1 && parts.length <= 400 && !P.redact(txt).secrets.length) { let rr = null; try { rr = R.evaluate(txt, { allowBareQuery: true }); } catch (e) { rr = null; }
      if (rr && rr.handled && rr.material && SEQ_CODES.test(rr.material.code || '')) { const outs = parts.map(p => process1(/^(?:i|my|i'm|i’m)\b/i.test(p) && !/\?$/.test(p) ? 'remember that ' + p.replace(/^my\b/, 'my') : p));
        return combine(outs, { id: 'LL-SEQUENTIAL-SENTENCES', doc: 'Doc5 discourse (one sentence at a time)', note: rr.material.code + ' → ' + parts.length + ' sentences' }); } }
    /* scope attachment (Pāṇini paper D3 scope; L2736–2751 negation/action preservation): independent clauses joined by ";" are separate scope domains, so a
       prohibition ("do not install X") binds only its own clause ("explain its failure" is read on its own). A that-complement (remember/note …) runs to the end. */
    const sc = txt.split(/;\s+/).map(x => x.trim()).filter(Boolean);
    if (sc.length > 1 && sc.length <= 20 && !/^(?:please )?(?:remember|note|keep in mind)\b/i.test(txt) && !P.redact(txt).secrets.length) { const outs = sc.map(p => process1(p)); outs.forEach((o, i) => o.trace.rules.push({ id: 'LL-CLAUSE-SCOPE', doc: 'Pāṇini paper D3 (scope); D5 L5552–5560', note: 'clause ' + (i + 1) + '/' + sc.length + (o.trace.msm && o.trace.msm.purpose.negated_act ? ': prohibition scoped here only' : '') }));
      return combine(outs, { id: 'LL-CLAUSE-SEQUENCE', doc: 'Doc5 discourse', note: sc.length + ' clauses' }); }
    return process1(input); }
  function combine(outs, rule) { const last = outs[outs.length - 1]; last.trace.rules.push(rule);
        const reply = outs.map(o => o.reply).filter(Boolean).join(' '), ms = outs.map(o => o.trace.msm && o.trace.msm.meaning);
        const trace = Object.assign({}, last.trace, { derivation: { plan: 'sequence', rules: [].concat(...outs.map(o => (o.trace.derivation && o.trace.derivation.rules) || [])), parts: outs.map(o => o.trace.derivation), surface: reply } });
        if (ms.every(Boolean) && last.trace.msm) trace.msm = Object.assign({}, last.trace.msm, { meaning: { kind: 'sequence', parts: ms } });
        return Object.assign({}, last, { reply, blocked: outs.some(o => o.blocked), trace, parts: outs }); }
  function process1(input) {
    meta.turn += 1; rsIn = {}; heldNow = []; const turn = meta.turn; const at = now(); const normalizedInput = String(input || '').normalize('NFC'), inputLength = normalizedInput.length;
    const red = P.redact(normalizedInput), fullInput = red.text; curSecrets = red.secrets; input = fullInput; const vaultState = red.secrets.length ? (opts.vaultState ? opts.vaultState() : 'none') : null;
    const psi_id = sha256(canon({ turn, loop: meta.loop, input: fullInput }));
    const trace = { turn, at, input, input_length: inputLength, input_truncated: fullInput.length > input.length, input_sha256: sha256(fullInput), psi_id, psi_id_note: 'SHA-256 substitutes for BLAKE3 (RSOC §2.1)', loop_lambda: meta.loop, phases: [], rules: [], gates: null, candidates: [], outcome: null, msm: null, drift: null, chi: null, echo: null, memory: [], output: null, blocked: false };
    const Ph = (n, note) => trace.phases.push({ phase: n, sym: M.PHASES[n].sym, name: M.PHASES[n].name, note });
    const low0 = input.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[.!?]+\s*$/, '').replace(/\s+/g, ' ').trim();
    let low = low0.replace(/\bwhat's\b/g, 'what is').replace(/\bwho's\b/g, 'who is').replace(/\bdon't\b/g, 'do not').replace(/\bcan't\b|\bcannot\b/g, 'can not').replace(/\bi'm\b/g, 'i am');
    let raw = input;
    /* fronted topic (Pāṇini paper D3 topic/scope; Doc5 viṣaya): "About NP, REST" — the PREP+NP must parse as a phrase before the comma. A pronoun in REST
       that agrees with the topic is bound to it (anaphora to the topic); otherwise the topic is the viṣaya adjunct of REST (topicalisation = the same
       clause with the PP moved). The fronting is remembered so speech may answer in the same order (RSOC ⧒, Echo-gated). */
    let topicFront = null; { const tk = G.tokenize(raw.replace(/[.!?]+\s*$/, '')), ci = tk.findIndex(t => t.w === ',');
      /* "As for NP," is the same topic displacement (G-DISPLACE): the topic marker is two words; it is unambiguous, so it is also read for statements,
         but only when a pronoun in the rest is bound to it (the copy); otherwise the clause is left as is */
      /* 4.9.40 (one displacement mechanism): the fronted phrase is recognised by the grammar's own fronted() — the same G-DISPLACE rule that reads
         statements — not by a marker-word list: an "as for" topic, or a fronted PP whose kāraka role is viṣaya (about/regarding/concerning are PREPs with that role) */
      const fr = ci > 1 ? G.Parser(content(tk), glex).fronted(0).find(f => f.j === ci + 1 && (f.topic || (f.xp && f.xp.length === 1 && f.xp[0].role === 'vishaya' && f.xp[0].np))) : null;
      const asFor = !!(fr && fr.topic), o = asFor ? 2 : 1;
      if (fr && ci > o && ci < tk.length - 1) { const np = clone(fr.topic || fr.xp[0].np);
        const qf = w => (G.CL[w] || []).some(t => ['WH', 'AUX', 'COP', 'MOD'].includes(t)); /* interrogative clause class (Doc5): the topic frame is read for questions */
        if (np && qf(tk[ci + 1].w)) { /* statements: the grammar's own G-DISPLACE-TOPIC binds the copy (also inside that-clauses) */ const rest = tk.slice(ci + 1).map(t => t.orig), tt = tk.slice(o, ci).map(t => t.orig).join(' '), isQ = qf(tk[ci + 1].w), hd = (np.head || []).concat(np.propn ? [] : []).join(' ').toLowerCase();
          const fe = featsOf(np), fem = fe.g === 'f' || fe.g === 'u';
          const pro = fe.n === 'pl' ? /^(they|them)$/i : fe.g === 'f' ? /^(she|her)$/i : fe.g === 'm' ? /^(he|him)$/i : fe.g === 'u' ? /^(she|her|he|him)$/i : /^it$/i; const pi = rest.findIndex(w => pro.test(w));
          let r2; if (pi >= 0 && !(fem && /^her$/i.test(rest[pi]) && pi + 1 < rest.length && /^[a-z]/i.test(rest[pi + 1]) && !/^(about|to|for|with|in|on)$/i.test(rest[pi + 1]))) { r2 = rest.slice(); r2[pi] = tt; } else r2 = isQ ? rest.concat(['about', tt]) : null;
          if (r2) { raw = r2.join(' ').replace(/\s+([?,])/g, '$1'); topicFront = { np: tt, bound: pi >= 0, marker: asFor ? 'as for' : tk[0].w.toLowerCase() };
          low = raw.toLowerCase().replace(/[’‘]/g, "'").replace(/[.!?]+\s*$/, '').replace(/\bwhat's\b/g, 'what is').replace(/\s+/g, ' ').trim(); } } } }
    Ph(1, 'input received (' + G.tokenize(input).length + ' tokens); ψ_id fixed');
    const ctx = { privacy: red.secrets.length ? { count: red.secrets.length, labels: red.secrets.map(x => x.label), vault: vaultState } : null, worldPreflight: inputLength > 2000 ? R.evaluate(fullInput, { allowBareQuery: !asksAboutStored(fullInput), inputLength }) : null }; if (topicFront) { ctx.topicFront = topicFront; trace.rules.push({ id: 'LL-TOPIC-FRONTED', doc: 'Pāṇini paper D3 (topic/scope); Doc5 viṣaya', note: (topicFront.bound ? 'pronoun bound to topic ' : 'topic as viṣaya ') + '“' + topicFront.np + '” → “' + raw + '”' }); } if (red.secrets.length) trace.rules.push(...red.rules.map(id => ({ id, doc: 'Doc7 privacy; forge Identity Vault', note: 'value replaced by “sealed” at ingestion' })), { id: 'PRIV-1.3 vault ' + vaultState, doc: 'Doc7' }); const na = low.match(/^(?:please )?(?:do not|never)(?: please)? (.+)$/);
    /* LL-NEG-ACT (4.9.41): negation attaches to the imperative — closed-class "do not"/"never" + a V-base head (POS from the lexicon, or a kernel verb class); no content-verb list */
    if (na && (G.Parser(content(G.tokenize(na[1])), glex).at(0, 'V').some(a => a.f === 'base') || CAP_V.has(na[1].split(' ')[0]) || SELF_EXT.has(na[1].split(' ')[0]))) { ctx.negAct = true; low = na[1]; raw = raw.replace(/^\s*(?:please )?(?:do not|don't|never)(?: please)?\s+/i, ''); trace.rules.push({ id: 'LL-NEG-ACT', doc: 'Doc3 §15', note: 'negation scopes over the requested act' }); }
    const ops = { negation: /\bnot\b|\bnever\b|n't\b/.test(low0), condition: /\bif\b|\bunless\b/.test(low0), modality: /\b(might|may|maybe|perhaps|possibly|probably|must|should|could)\b/.test(low0), quantifier: /\b(all|every|each|some|none)\b/.test(low0), past: /\b(was|were|did)\b/.test(low0), future: /\bwill\b/.test(low0) };
    const depth = Object.values(ops).filter(Boolean).length;
    const bypass = BYPASS.test(low0); if (bypass) trace.rules.push({ id: 'ADV-BYPASS-ATTEMPT', doc: 'RMC Addendum §4 (projection that bypasses correction and naming)', note: 'request to skip validation = attempted Φ5→Φ8' });
    if (bypass) { const kept = raw.split(/(?<=[.!?;])\s+/).filter(x => !BYPASS.test(x.toLowerCase())); if (kept.length) ctx.worldText = kept.join(' '); } // the bypass sentence is flagged, never reasoned over
    Ph(2, 'scope operators: ' + (Object.keys(ops).filter(k => ops[k]).join(', ') || 'none') + (ctx.negAct ? '; NEGATED ACT' : ''));
    { const Ap = appositive(raw); if (Ap) { trace.rules.push({ id: 'LL-APPOSITIVE-RELATIVE', doc: 'Doc5 relative-clause frame (non-restrictive: both propositions asserted)', note: Ap.note }); raw = Ap.raw; low = raw.toLowerCase().replace(/[.!?]+\s*$/, ''); } }
    { const Tq = tagQuestion(raw); if (Tq) { trace.rules.push({ id: 'LL-TAG-QUESTION', doc: 'Doc5 §15 speech acts (tag = yes/no question)', note: Tq.note }); if (Tq.raw) { raw = Tq.raw; low = Tq.raw.toLowerCase().replace(/[.!?]+\s*$/, ''); } } }
    { const E = ellipsis(raw); if (E) { trace.rules.push({ id: 'LL-ELLIPSIS-VP', doc: 'Doc 3 ellipsis; Register F-11', note: E.note }); if (E.raw) { raw = E.raw; low = E.raw.toLowerCase().replace(/[.!?]+\s*$/, ''); } } }
    let sel; try { sel = evaluate(raw, low, ctx); }
    catch (e) { sel = { outcome: 'NO_LAWFUL_CANDIDATE', material: { kind: 'no_frame' }, gates: { expectancy: 'derivation error' }, rules: [{ id: 'G-DERIVATION-ERROR', doc: 'Doc6 §35', note: String(e && e.message).slice(0, 80) }], frame: 'none', act: 'unknown' }; }
    const worldTurn = /^FR\.WORLD/.test(sel.frame || '');
    if (bypass && worldTurn) { trace.bypass_flag = true; trace.rules.push({ id: 'ADV-BYPASS-FLAGGED', doc: 'bypass phrase flagged; the checked world result stands' }); } else if (bypass) sel.forbiddenPath = true;
    Ph(3, 'purpose: ' + sel.act + ' via ' + sel.frame);
    trace.rules.push(...(sel.rules || [])); trace.gates = sel.gates; trace.outcome = { category: sel.outcome, class: OUTCOME_CLASS[sel.outcome] || 'reject', cite: 'Doc6 §36' }; if (sel.sense) trace.sense = sel.sense;
    Ph(4, 'gates → ' + sel.outcome + ' (' + trace.outcome.class + ')');
    const attempted = sel.forbiddenPath ? { from: 5, to: 8, expected: 6 } : { from: 7, to: 8, expected: 8 };
    const drift = M.driftFunctional({ phaseHistory: meta.phaseHistory.slice(-8).concat([9]), transition: attempted, depth });
    trace.drift = Object.assign(drift, { attempted_transition: M.PHASES[attempted.from].sym + '→' + M.PHASES[attempted.to].sym, expected_next: M.PHASES[attempted.expected].sym, calibration: 'expected = lawful successor T(Φn,Φn+1) for the speech act; D_score=1 only for an attempted Φ5→Φ8 (unnameable projection or bypass)' });
    const needsMem = /QUESTION|ABOUT|WHEN/.test(sel.frame || ''); const filled = ['SELECTED_MEANING', 'SELECTED_RESTRICTED_MEANING', 'UNDERSTOOD_ACTION_BLOCKED', 'REFUSAL_RELEVANT'].includes(sel.outcome);
    sel.scoreTerms = { M: needsMem ? (/recall|yesno|about|when/.test(sel.material.kind) ? 1 : 0.5) : 1, P: sel.forbiddenPath ? 0 : 1, U: filled ? 1 : sel.outcome === 'NO_LAWFUL_CANDIDATE' ? 0 : 0.5, N: sel.write ? 1 : 0, D: Math.min(1, drift.eps_s) };
    const sc = M.score(sel.scoreTerms); trace.candidates = sel.reasoningCandidates ? sel.reasoningCandidates.map(c => Object.assign({ frame: sel.frame, outcome: sel.outcome }, clone(c))) : [{ frame: sel.frame, outcome: sel.outcome, score: sc.formula }];
    Ph(5, drift.formula + ' → ' + drift.band);
    const sfe = { Phi: 5, rho: drift.rho, Delta: r4((attempted.to - attempted.expected) / 9), nu: 0, mu: 1.0, eps: drift.eps_s, tau: trace.phases.map(p => p.phase), lambda: meta.loop, chi: meta.chi };
    let restricted = false, sealed = false;
    /* RSOC turn governance (v4.9.32): the route is the candidate RSOC ⧙-locks, not an if-chain. Dims: D drift below intervention, X χ(t) conditions, W world turn */
    const hi = drift.band === 'hard_stop' || drift.band === 'intervention'; let cc = null, Theta = 0;
    if (hi) { const echoTrace = !(sel.literal && sel.literal.length) && !(sel.rules || []).some(r => r.id === 'LX-UNKNOWN');
      const traj = trace.phases.map(p => p.phase).concat(sel.forbiddenPath ? [8] : []); const dAvg = traj.reduce((a, n, i) => a + Math.abs(n - (i + 1)) * (2 * Math.PI / 9), 0) / traj.length;
      cc = M.chiConditions({ eps_s: drift.eps_s, echoTrace, chiFlag: meta.chi, dPhiAvg: dAvg }); Theta = M.graceIntegral(sfe.tau, sfe.tau.map(n => (n < 5 ? 0 : sfe.eps)), sfe.mu);
      trace.chi = Object.assign(cc, { Theta, Theta_formula: 'Θ = Σ (1 − ε/ε_max)·cos²(Φ(s) − Φ₁)·μ(s) = ' + Theta + ' (RSOC §3.2.1)', dPhi_avg: r4(dAvg) }); }
    const RS = M.rsocSelect({ D: !hi, X: !!(cc && cc.fire), W: worldTurn }, [{ id: 'name', expect: { D: 1 } }, { id: 'grace', expect: { D: 0, X: 1 } }, { id: 'keep_world', expect: { D: 0, X: 0, W: 1 } }, { id: 'archive', expect: { D: 0, X: 0, W: 0 } }], 0), route = RS.selected;
    trace.rsoc = { calculus: RS.calculus, route, candidates: RS.candidates, ops: RS.ops.filter(o => o.ok || o.op === '⧙').map(o => o.op + (o.dim ? '(' + o.c + ',' + o.dim + ')' : '(' + o.c + ')') + (o.ok ? '' : '✗')), inward: rsIn, claim: sel.material && sel.material.rsoc ? sel.material.rsoc.selected : null, outward: null, cite: RS.cite };
    trace.rules.push({ id: 'RSOC-ROUTE-' + route.toUpperCase(), doc: 'RSOC ch.3 (⟁ fusion, ⧙ lock)', note: 'turn ⧙ ' + route });
    if (hi) {
      if (route === 'grace') { Object.assign(sfe, M.applyChi(sfe, Theta)); meta.chi = 1; restricted = true; trace.chi.result = 'χ(t) fired: Δ←0, ν←1.4, ε←ε(1−Θ/μ), μ←μ+0.9Θ, χ←1; re-routed Φ6→Φ7 with restricted meaning (RMC Addendum §4)'; trace.rules.push({ id: 'CHI-GRACE-REROUTE', doc: 'RSOC §3.2; RMC Addendum §4' }); Ph(6, 'χ(t) fired; restricted meaning'); }
      else if (route === 'keep_world') { trace.chi.result = 'χ(t) not applied: world turn keeps its checked result; nothing sealed or written'; trace.rules.push({ id: 'WORLD-NO-PERSISTENT-SEAL', doc: 'a world turn never mutates persistent state' }); Ph(6, 'χ(t) skipped (world turn; no persistent seal)'); }
      else { sealed = true; trace.chi.result = 'χ(t) blocked → Ĉ controlled archival: state sealed into cold storage, output = 0 (RSOC Axiom 5; RPMC collapse protocol)'; trace.rules.push({ id: 'C-HAT-ARCHIVE', doc: 'RSOC §3.1 Ĉ; RPMC Output(ψ)=0' }); Ph(6, 'χ(t) blocked → Ĉ archival; HARD STOP'); }
    } else Ph(6, 'χ(t) not required (band ' + drift.band + ')');
    const k = sel.material.kind;
    const capability = sel.write ? (sel.write.note ? 'notes.write' : 'memory.write') : /recall|yesno|facts|notes|count|about|when/.test(k) ? 'memory.read' : /math|solved|simplified|converted/.test(k) ? 'math.gp014' : k === 'define' ? 'lexicon.read' : k === 'blocked' ? 'external/unsupported' : 'conversation';
    const msm = { msm_version: 'MSM-v1 (fields inferred from Docs 1, 3, R0 — Doc 2 file not located)', msm_id: psi_id, status: sealed ? 'sealed (Ĉ)' : 'named',
      purpose: { speech_act: sel.act, frame: sel.frame, negated_act: !!ctx.negAct }, meaning: sel.material,
      uncertainty: { level: sel.uncertainty || (trace.outcome.class === 'selected' ? 'none' : trace.outcome.class), unknown_concepts: sel.material.words || [], sense: sel.sense ? sel.sense.status : 'n/a' },
      limits: { authority: sel.write ? (sel.auth || 'explicit user request') : 'none', may_write_memory: !!sel.write && !sealed && !restricted && drift.band === 'clean', may_project: !sealed,
        restrictions: [].concat(restricted ? ['correction-restricted (χ)'] : [], drift.band === 'bounded' ? ['bounded-drift limitation (ε_s ≥ 0.20)'] : [], drift.band === 'elevated' ? ['elevated drift: no memory write'] : []) },
      capability_relation: { capability, status: k === 'blocked' ? 'blocked' : 'supported' }, evidence: { refs: sel.evidenceRefs || [], user_utterance_turn: turn }, trace_ref: 'trace:' + turn, phase: null, drift: { eps_s: drift.eps_s, band: drift.band } };
    if (restricted) msm.meaning = { kind: 'refuse', reason: 'BYPASS' };
    trace.msm = msm;
    cont.touch(); const routeOf = x => { const rt = CT.route(Object.assign({ sealed, restricted, kind: msm.meaning.kind, band: drift.band, would_write: !!sel.write, dream: sel.contain === 'dream' }, x || {})); trace.containment = rt; trace.rules.push(...rt.rules.map(id => ({ id, doc: rt.cite }))); if (!rt.may_write_memory) msm.limits.may_write_memory = false; return rt; };
    routeOf();
    { const tid = sel.toolRequest ? sel.toolRequest.tool : (msm.meaning.kind === 'tool_result' || msm.meaning.kind === 'tool_failed' ? msm.meaning.tool : bench.toolForKind(msm.meaning.kind));
      if (tid && !sealed && !restricted) { const az = bench.authorize(tid, sel.frame, { explicit: true, vaultUnlocked: (opts.vaultState ? opts.vaultState() : 'none') === 'unlocked' }); trace.tool = { tool: tid, frame: sel.frame, permission: az.decision.id, decision: az.decision.decision, rule: az.decision.rule, manifest_hash: az.manifest ? az.manifest.manifest_hash : null, authority: 'evidence_only' };
        trace.rules.push({ id: az.decision.rule, doc: 'EchoForge tool bench manifest ' + tid + '; Register A-04' });
        if (az.decision.decision !== 'allow') { bench.record(tid, sel.frame, az.decision); msm.meaning = { kind: 'tool_denied', tool: tid, rule: az.decision.rule }; trace.tool_request = null; routeOf(); }
        else if (sel.toolRequest) trace.tool_request = { tool: tid, input: sel.toolRequest.input, frame: sel.frame, permission: az.decision.id };
        else bench.record(tid, sel.frame, az.decision, msm.meaning); } }
    if (msm.limits.may_write_memory && sel.write) { const contested = (sel.write.supersede || []).length > 0 || sel.auth === 'explicit confirmation';
      const d = perm.authorize(sel.write.forget ? 'memory.forget' : 'memory.write', { explicit: true, contested, sensitive: !!ctx.privacy, subject: psi_id }); trace.permission = d; trace.rules.push({ id: d.rule, doc: 'Register A-04 permission service; decision ' + d.decision });
      if (d.decision === 'needs_approval') { const held = { id: 'held:' + psi_id.slice(0, 16), at, turn, input, write: sel.write, msm_id: psi_id, sfe, auth: sel.auth || null, kind: msm.meaning.kind, sensitive: !!ctx.privacy, perm: d.id, status: 'held' };
        const hw = store.load('held_writes'); hw.push(held); store.save('held_writes', hw); trace.held_write = Gv.readback(store, 'held_writes', held.id, held);
        msm.meaning = { kind: 'write_held', sensitive: !!ctx.privacy }; msm.limits.may_write_memory = false; sel.write = null; curSecrets = []; meta.pending = null; }
      else if (d.decision !== 'allow') { msm.limits.may_write_memory = false; sel.write = null; } }
    if (sealed) { const cold = store.load('cold_storage'); cold.push({ id: psi_id, sealed_at: at, reason: 'hard stop ε_s=' + drift.eps_s, msm, sfe, input, tier: bypass ? 'DEEP' : 'WARM', breach: !!bypass, resurrection_attempts: 0 }); store.save('cold_storage', cold); meta.pending = null;
      trace.rsoc.ops.push('Ĉ'); Ph(7, 'naming withheld (sealed)'); trace.blocked = true; trace.block_reason = 'Hard stop: ε_s = ' + drift.eps_s + ' ≥ 0.80 and χ(t) unavailable → Ĉ archival.'; return finish(trace, 6, null, msm, sfe); }
    Ph(7, 'manifest named ψ_id ' + psi_id.slice(0, 12) + '…');
    { const mk = canon(msm.meaning); if (meta.spoken && meta.spoken.m === mk && meta.spoken.loop === meta.loop) msm.meaning = Object.assign({}, msm.meaning, { field: { last: meta.spoken.text } }); if (ctx.topicFront) msm.meaning = Object.assign({}, msm.meaning, { field: Object.assign({}, msm.meaning.field, { topic: ctx.topicFront }) }); if (ctx.qVoice) msm.meaning = Object.assign({}, msm.meaning, { field: Object.assign({}, msm.meaning.field, { voice: ctx.qVoice }) }); trace.rsoc.meaning_key = mk; } // the local field: what Forge last said for this same meaning (RSOC ⧒ phase alignment cos(Φ − Φ₀))
    let real; try { real = D.realizeMeaning(msm.meaning, ENV); } catch (e) { trace.derivation_error = String(e && e.message); }
    if (!real) { routeOf({ derivation_failed: true }); trace.blocked = true; trace.block_reason = 'Derivation failed (' + trace.derivation_error + ') — no sūtra sequence derives this meaning; output blocked.'; meta.pending = null; Ph(9, 'derivation FAIL → output blocked'); return finish(trace, 9, null, msm, sfe); }
    let text = real.text; trace.derivation = real.derivation; trace.rsoc.outward = real.derivation.rsoc || null; if (opts.renderFault) text = opts.renderFault(text, msm);
    Ph(8, 'derived by ' + real.derivation.rule_count + ' sūtra applications (' + real.derivation.distinct_rules + ' distinct); trail ' + real.derivation.phase_trail);
    if (real.derivation.forbidden_transition) { routeOf({ forbidden_transition: real.derivation.forbidden_transition }); trace.blocked = true; trace.block_reason = 'Derivation phase trail contains a forbidden transition (' + real.derivation.forbidden_transition + ').'; meta.pending = null; Ph(9, 'forbidden derivation path → blocked'); return finish(trace, 9, null, msm, sfe); }
    let ev = (!opts.renderFault && real.echo && real.text === text) ? real.echo : echo(text, msm.meaning, real.vakya); trace.echo = ev; trace.rsoc.phrasing = real.derivation.phrasing || null;
    if (!ev.pass && ev.ambiguous && !opts.renderFault && msm.meaning.kind !== 'clarify_echo') { // lawful re-routing: an ambiguous outward reading becomes a clarification (Doc6 §29), never a guess and never a write
      trace.rules.push({ id: 'ECHO-AMBIGUITY-CLARIFY', doc: 'Doc6 §29; RMC §6.7', note: ev.reason }); trace.echo_first = ev; trace.meaning_first = msm.meaning; const alt = { kind: 'clarify_echo' }; const r2 = D.realizeMeaning(alt, ENV); const ev2 = echo(r2.text, alt);
      if (ev2.pass) { msm.meaning = alt; msm.limits.may_write_memory = false; trace.outcome = { category: 'CLARIFICATION_REQUIRED', class: 'clarify', cite: 'Doc6 §36' }; text = r2.text; trace.derivation = r2.derivation; ev = ev2; trace.echo = ev2; meta.pending = null; sel.write = null; routeOf(); } }
    if (!ev.pass) { routeOf({ echo_failed: true }); trace.blocked = true; trace.block_reason = 'Echo validation failed (' + (ev.reason || '') + '; components ' + JSON.stringify(ev.components) + ') — output blocked, no memory write.'; meta.pending = null; trace.rsoc.ops.push('Ê=0'); Ph(9, 'Echo FAIL → output blocked'); return finish(trace, 9, null, msm, sfe); }
    if ((msm.meaning.kind === 'world_answer' || msm.meaning.kind === 'world_limitation') && msm.meaning.envelope) {
      msm.meaning.envelope.echo = { status: 'passed', pass: true, mode: ev.mode, score: ev.score, theta: ev.theta };
      trace.world_model = { status: msm.meaning.status, interpretation: clone(msm.meaning.interpretation || null), world: clone(msm.meaning.world || null), world_root: msm.meaning.world && msm.meaning.world.world_root || null, derivation: clone(msm.meaning.derivation || null), proofs: clone(msm.meaning.proofs || null), rmc: clone(msm.meaning.rmc || null), rmc_manifest_id: msm.meaning.rmc && msm.meaning.rmc.manifest_id || null, checker: clone(msm.meaning.checker || null), limits: clone(msm.meaning.envelope.limits), effects: clone(msm.meaning.envelope.effects), echo: clone(msm.meaning.envelope.echo) };
    }
    if (sel.effect && /^case_open:/.test(sel.effect)) pendingCase = 'case:' + sel.effect.slice(10); if (sel.effect === 'case_close') pendingCase = null;
    if (sel.effect === 'newloop') { meta.loop += 1; meta.chi = 0; cont.closeAndOpen('LOOP-CLOSE (start over)'); }
    if (msm.limits.may_write_memory && sel.write) { const res = commitWrite(sel, msm, sfe, turn, at, input); trace.memory = res.ops; trace.readback = res.readback;
      if (res.rollback) { trace.rollback = res.rollback; trace.rules.push({ id: 'RB-READBACK-MISMATCH-ROLLBACK', doc: 'Register G-04 (post-write readback); C-05 rollback' }); msm.meaning = { kind: 'write_failed' }; curSecrets = [];
        const r3 = D.realizeMeaning(msm.meaning, ENV); const ev3 = echo(r3.text, msm.meaning); text = r3.text; trace.derivation = r3.derivation; trace.echo = ev3; ev = ev3; trace.memory = []; } }
    if (ctx.clauseForDiscourse) pushDiscourse(ctx.clauseForDiscourse);
    if (sel.reasoningState) meta.reasoning = Object.assign(clone(sel.reasoningState), { turn: meta.turn });
    meta.spoken = { m: trace.rsoc.meaning_key, text, loop: meta.loop };
    trace.rsoc.ops.push('Ê=1', 'R̂(Φ₇→Φ₈)', 'R̂(Φ₈→Φ₉)', ...(trace.memory.length ? ['⧜'] : []), '⧀');
    Ph(9, 'Echo pass (' + ev.score + ' ≥ ' + ev.theta + ')' + (trace.memory.length ? '; memory: ' + trace.memory.map(m => m.op).join(', ') : ''));
    return finish(trace, 9, text, msm, sfe);
  }
  let lastWritten = [];
  function commitWrite(sel, msm, sfe, turn, at, input) {
    const snap = { memory: store.load('memory'), evidence: store.load('evidence'), cold_storage: store.load('cold_storage') }; const ops = write(sel, msm, sfe, turn, at, input);
    const readback = lastWritten.map(w => (w.absent ? (store.load(w.cat).some(x => x.id === w.absent) ? { store: w.cat, id: w.absent, readback: 'still present' } : { store: w.cat, id: w.absent, readback: 'match', expected: 'absent' }) : Gv.readback(store, w.cat, w.rec.id, w.rec)));
    if (readback.every(x => x.readback === 'match')) return { ops, readback };
    for (const c of Object.keys(snap)) store.save(c, snap[c]); const restored = Object.keys(snap).every(c => Gv.hash(store.load(c)) === Gv.hash(snap[c]));
    return { ops, readback, rollback: { restored, stores: Object.keys(snap), pre_hash: Gv.hash(snap).slice(0, 16) } }; }
  function write(sel, msm, sfe, turn, at, input) {
    const mem = store.load('memory'), evd = store.load('evidence'), cold = store.load('cold_storage'); const ops = []; const W = []; lastWritten = W; const pushW = (cat, rec) => W.push({ cat, rec: clone(rec) });
    const evId = 'ev:' + msm.msm_id.slice(0, 16); evd.push({ id: evId, utterance: input, turn, at, msm_id: msm.msm_id, category: 'user statement' }); pushW('evidence', evd[evd.length - 1]); ops.push({ op: 'evidence.add', id: evId });
    const node = { Phi: 9, rho: sfe.rho, Delta: 0, nu: 0, mu: 1.0, eps: sfe.eps, tau: sfe.tau, lambda: sfe.lambda, chi: sfe.chi };
    if (sel.write.forget) { for (const id of sel.write.forget) { const i = mem.findIndex(x => x.id === id); if (i < 0) continue; const old = mem[i]; old.status = 'forgotten'; old.forgotten_by = msm.msm_id; cold.push({ id: old.id, sealed_at: at, reason: 'forgotten at user request (confirmed, turn ' + turn + ')', record: old, successor: { kind: 'lifecycle_transition', from: 'accepted', to: 'archived', rule: 'forge2 APPEND_ONLY_SUCCESSOR_LAWS_V1 §Lifecycle transition' }, tier: 'WARM', resurrection_attempts: 0 }); mem.splice(i, 1); pushW('cold_storage', cold[cold.length - 1]); W.push({ cat: 'memory', absent: id }); ops.push({ op: 'fact.forget → Ĉ cold storage', id }); }
      store.save('memory', mem); store.save('evidence', evd); store.save('cold_storage', cold); return ops; }
    if (sel.write.note) { mem.push({ id: 'mem:' + msm.msm_id.slice(0, 16), kind: 'note', text: sel.write.note, status: 'active', sfe: node, phase_tag: 'Φ₉', provenance: { source: 'user', turn, at, msm_id: msm.msm_id, evidence: evId } }); ops.push({ op: 'note.add (⧜)' }); pushW('memory', mem[mem.length - 1]); }
    else if (sel.write.mergeWith) { const r = mem.find(x => x.id === sel.write.mergeWith); const mg = M.merge(r.sfe, node); if (mg.ok) r.sfe = mg.sfe; r.provenance.reinforced = (r.provenance.reinforced || []).concat([{ turn, at, evidence: evId }]); pushW('memory', r); ops.push({ op: mg.ok ? 'fact.merge ⟁ (μ ' + mg.sfe.mu + ')' : 'fact.reinforce (⟁ rejected: χ flags differ)', cite: mg.cite }); }
    else { const c = sel.write.clause;
      for (const id of sel.write.supersede || []) { const i = mem.findIndex(x => x.id === id); if (i >= 0) { const old = mem[i]; old.status = 'superseded'; old.superseded_by = msm.msm_id; cold.push({ id: old.id, sealed_at: at, reason: 'superseded by ' + msm.msm_id.slice(0, 12), record: old, tier: 'WARM', resurrection_attempts: 0 }); mem.splice(i, 1); pushW('cold_storage', cold[cold.length - 1]); W.push({ cat: 'memory', absent: id }); ops.push({ op: 'fact.supersede → Ĉ cold storage', id }); } }
      if (!c.coord && c.verb.lemma === 'be' && c.subj.head && c.subj.head[c.subj.head.length - 1] === 'name' && c.subj.owner && c.pred && c.pred.type === 'np' && c.pred.np.propn) { const tgt = typeof c.subj.owner === 'object' ? entKey(c.subj.owner) : c.subj.owner; meta.alias['name:' + c.pred.np.propn.toLowerCase()] = tgt; ops.push({ op: 'alias ' + c.pred.np.propn + ' ≡ ' + tgt + ' (Doc6 §23)' }); }
      const ents = [...new Set(nps(c).filter(n => !n.pron3).map(entKey).filter(Boolean))];
      const subjTxt = c.coord ? '' : G.npText(c.subj, 'user').toLowerCase();
      { const sc = scopeOf(c); if (sc) sideRules.push({ id: sc.rule, doc: 'Doc3 scope; MSM-v1 rejected-meaning record', note: sc.selected + ' selected; ' + sc.preserved.join(',') + ' preserved' }); }
      mem.push({ id: 'mem:' + msm.msm_id.slice(0, 16), kind: 'relation', clause: c, scope: scopeOf(c), pred: c.coord ? 'and' : c.verb.lemma, subjKey: c.coord ? null : entKey(c.subj), entities: ents, sensitive: SENSITIVE.test(subjTxt), sense: sel.sense || null, status: 'active', sfe: node, phase_tag: 'Φ₉ committed (named at Φ₇)', provenance: { source: 'user', turn, at, msm_id: msm.msm_id, evidence: evId, rule: sel.auth ? 'G-REENTRY-CONFIRM' : 'AUTH-EXPLICIT-REMEMBER' } });
      ops.push({ op: 'relation.write (⧜)' }); pushW('memory', mem[mem.length - 1]); }
    store.save('memory', mem); store.save('evidence', evd); store.save('cold_storage', cold); return ops;
  }
  /* explicit result state (Pāṇini paper D5 L5552–5560, D6 L6956–6977): understanding is never permission. draft ≠ send, inspect ≠ install,
     remember-request ≠ memory-write, support ≠ prove are kept apart as separate fields of the manifest. */
  const MEANING_STATE = { selected: 'understood', 'understood-but-blocked': 'understood', refuse: 'understood', ambiguous: 'held_open', clarify: 'unresolved', reject: 'not_understood' };
  function resultState(trace, msm) { const k = msm.meaning && msm.meaning.kind, wrote = (trace.memory || []).length > 0;
    return { meaning: trace.blocked ? 'blocked_before_release' : MEANING_STATE[trace.outcome && trace.outcome.class] || 'not_understood',
      action: k === 'blocked' ? 'blocked:' + (msm.meaning.reason || 'unauthorized') : k === 'neg_act' ? 'withheld:prohibited' : k === 'write_held' ? 'held_for_approval' : wrote ? 'memory_written' : k === 'assert_ack' ? 'not_stored' : k === 'tool_denied' ? 'blocked:tool' : 'none',
      claim: msm.meaning && msm.meaning.status && /world/.test(k) ? msm.meaning.status : null, unresolved: k === 'clarify_unknown' || k === 'clarify_teach' ? msm.meaning.words : k === 'clarify_referent' ? [msm.meaning.word] : null, cite: 'Pāṇini paper D5/D6: understanding ≠ permission' }; }
  function finish(trace, terminal, text, msm, sfe) { if (sideRules.length) { const seen = new Set(trace.rules.map(r => r.id)); for (const r of sideRules) if (!seen.has(r.id)) trace.rules.push(r); sideRules = []; }
    msm.phase = { trajectory: trace.phases.map(p => p.sym).join('→'), terminal: M.PHASES[terminal].sym }; msm.state = resultState(trace, msm);
    if (trace.containment && !opts.noContainment) { try { const c = cont.apply(trace, trace.containment, { clause: msm.meaning && msm.meaning.clause, cause: trace.containment.cause, state: { turn: meta.turn, loop: meta.loop, chi: meta.chi } }); trace.containment_applied = { route: c.route, records: c.records, collapse: c.collapse ? c.collapse.id : null }; } catch (e) { trace.containment_error = String(e && e.message); } } trace.output = text; trace.sfe = Object.assign({}, sfe, { Phi: terminal });
    const mem = store.load('memory'); const rec = (msm.evidence.refs || []).map(id => mem.find(r => r.id === id)).filter(Boolean);
    trace.rpm = rec.map(r => ({ id: r.id, mu: r.sfe.mu, eps: r.sfe.eps, weight: M.rpmWeight(r.sfe), formula: 'ΦM·exp(−ε) = ' + r.sfe.mu + '·exp(−' + r.sfe.eps + ') (RPMC §1; display only)' }));
    meta.phaseHistory.push(terminal); meta.phaseHistory = meta.phaseHistory.slice(-9); meta.last = { eps_s: trace.drift.eps_s, band: trace.drift.band, phase: terminal }; saveMeta();
    const tr = store.load('trace'); tr.push(trace); store.save('trace', tr.slice(-200));
    const outR = { reply: text, blocked: trace.blocked, block_reason: trace.block_reason || null, outcome: trace.outcome, trace, msm };
    const sealOk = curSecrets.length && !trace.blocked && msm.meaning && msm.meaning.kind === 'stored_sensitive';
    Object.defineProperty(outR, 'secrets', { value: sealOk ? curSecrets.map(x => ({ label: x.label, value: x.value, ref: 'mem:' + msm.msm_id.slice(0, 16), at: trace.at })) : [], enumerable: false }); curSecrets = [];
    if (pendingRender) { const pr = pendingRender; pendingRender = null; Object.defineProperty(outR, 'render', { value: pr, enumerable: false }); trace.render = { form: pr.form, echo: !!(pr.echo && pr.echo.pass), sha256: sha256(String(pr.content)) }; }
    return outR;
  }
  function commitHeld(id, userTap) {
    const hw = store.load('held_writes'); const h = hw.find(x => x.id === id && x.status === 'held'); if (!h) return { ok: false, rule: 'HELD-UNKNOWN' };
    const d = perm.authorize('memory.approve_held', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
    const res = commitWrite({ write: h.write, auth: h.auth, sense: null }, { msm_id: h.msm_id }, h.sfe, h.turn, now(), h.input);
    h.status = res.rollback ? 'failed (rolled back)' : 'approved'; h.decided_at = now(); h.permission = d.id; store.save('held_writes', hw);
    cont.receipt('held.' + (res.rollback ? 'rollback' : 'commit'), { id, readback: res.readback.map(x => x.readback) }); return { ok: !res.rollback, ops: res.ops, readback: res.readback, rollback: res.rollback || null }; }
  function rejectHeld(id, userTap) { const hw = store.load('held_writes'); const h = hw.find(x => x.id === id && x.status === 'held'); if (!h) return { ok: false, rule: 'HELD-UNKNOWN' }; if (!userTap) return { ok: false, rule: 'PERM-NEEDS-USER-TAP' }; h.status = 'rejected'; h.decided_at = now(); store.save('held_writes', hw); cont.receipt('held.reject', { id }); return { ok: true }; }
  function resurrectPreview(id) { const c = store.load('cold_storage').find(x => x.id === id); return c ? cont.gates(c, perm.policy()) : null; }
  function resurrect(id, userTap) {
    const cs = store.load('cold_storage'); const c = cs.find(x => x.id === id); if (!c) return { ok: false, rule: 'RS-UNKNOWN' };
    const ev = cont.gates(c, perm.policy()); c.resurrection_attempts = (c.resurrection_attempts || 0) + 1; c.last_gate_eval = { at: now(), decision: ev.decision };
    if (ev.decision !== 'resurrection_candidate') { if (ev.decision === 'deep_archive_seal') c.tier = 'DEEP'; store.save('cold_storage', cs); cont.receipt('resurrection.' + ev.decision, { id }); return { ok: false, rule: 'RS-' + ev.decision.toUpperCase(), gates: ev }; }
    const d = perm.authorize('memory.restore', { userTap, subject: id }); if (d.decision !== 'allow') { store.save('cold_storage', cs); return { ok: false, rule: d.rule, gates: ev }; }
    const mem = store.load('memory'); if (mem.some(r => r.id === c.record.id)) return { ok: false, rule: 'RS-ALREADY-ACTIVE', gates: ev };
    if (c.record.clause) { const cf = conflicts(c.record.clause); if (cf.length) { store.save('cold_storage', cs); return { ok: false, rule: 'RS-CONFLICTS-ACTIVE-FACT', conflicts: cf.map(x => x.r.id), gates: ev }; } }
    const psi = clone(c.record); psi.status = 'active'; psi.resurrected = { at: now(), from: c.id, attempts: c.resurrection_attempts, note: 'ψ′ — constituted by collapse history (resurrection_engine.py)' }; delete psi.forgotten_by; delete psi.superseded_by;
    const snap = { memory: clone(mem), cold_storage: clone(cs) }; mem.push(psi); c.status = 'resurrected'; c.resurrected_at = now(); store.save('memory', mem); store.save('cold_storage', cs);
    const rb = Gv.readback(store, 'memory', psi.id, psi); if (rb.readback !== 'match') { store.save('memory', snap.memory); store.save('cold_storage', snap.cold_storage); return { ok: false, rule: 'RB-READBACK-MISMATCH-ROLLBACK', readback: rb }; }
    cont.receipt('resurrection.commit', { id, readback: rb.readback, permission: d.id }); return { ok: true, gates: ev, readback: rb, record: psi.id }; }
  function releaseDream(id, userTap) { const r = cont.hypotheses.view('dream').find(x => x.id === id && x.status === 'quarantined'); if (!r) return { ok: false, rule: 'DQ-UNKNOWN' }; const d = perm.authorize('containment.release', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; cont.hypotheses.setStatus(id, 'archived', 'archived by operator'); cont.receipt('dream.archive', { id }); return { ok: true }; }
  function approveHypothesis(id, userTap) { const h = stagedHyps.find(x => x.id === id) || cont.hypotheses.list().find(x => x.id === id && x.status !== 'promoted' && x.status !== 'withdrawn'); if (!h) return { ok: false, rule: 'HYP-NOT-STAGED' };
    const g = HY.governance(h); if (typeof HY.epsOf(h) === 'number' && !g.may_project) return { ok: false, rule: 'HYP-DRIFT-NOT-PROJECTABLE', governance: g };
    const rule = h.detail && h.detail.rule, adm = rule ? admissionCheck(rule, h.detail.claim_atom) : null; if (adm && !adm.ok) return adm;
    const d = perm.authorize('hypothesis.write', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const w = cont.hypotheses.get(id) ? { ok: true, id } : cont.hypotheses.put(h, { kind: 'approval_receipt', approved: true, decision: d.decision, rule: d.rule, receipt: d.id || null }); if (!w.ok) return w; cont.receipt('hypotheses.approve', { id });
    if (!rule) return w; const ar = store.load('admitted_rules'); if (!ar.some(r => r.rule.id === rule.id && r.status === 'admitted')) ar.push({ id: 'adm:' + sha256(canon(rule)).slice(0, 16), rule, hypothesis: id, proof_id: adm.proof.proof_id, support: adm.support, eps_s: HY.epsOf(h), status: 'admitted', admitted_at: now(), receipt: d.id || null });
    store.save('admitted_rules', ar); cont.hypotheses.setStatus(id, 'promoted', 'proof-checked promotion to an admitted rule'); cont.receipt('rules.admit', { id: rule.id, hypothesis: id, proof: adm.proof.proof_id }); return Object.assign({}, w, { admitted: rule.id, proof: adm.proof.proof_id }); }
  /* GELC S5: withdrawal is a governed write; every answer whose replayed proof used the rule is listed as invalidated (the audit trace itself is never edited) */
  function withdrawRule(id, userTap) { const ar = store.load('admitted_rules'), r = ar.find(x => (x.id === id || x.rule.id === id) && x.status === 'admitted'); if (!r) return { ok: false, rule: 'ADM-UNKNOWN' };
    const d = perm.authorize('hypothesis.write', { userTap, subject: r.id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule, decision: d.decision };
    const inv = store.load('trace').flatMap(t => (t.rules || []).filter(x => x.id === 'GELC-ADMITTED-RULE' && (x.rules_used || []).includes(r.rule.id)).map(x => ({ turn: t.turn, proof: x.proof })));
    Object.assign(r, { status: 'withdrawn', withdrawn_at: now(), invalidated_proofs: inv }); store.save('admitted_rules', ar); if (cont.hypotheses.get(r.hypothesis)) cont.hypotheses.setStatus(r.hypothesis, 'withdrawn', 'admitted rule withdrawn by the user');
    cont.receipt('rules.withdraw', { id: r.rule.id, invalidated: inv.length }); return { ok: true, withdrawn: r.rule.id, invalidated_proofs: inv }; }
  /* case API (plan §2): seal/unseal at rest with the Identity Vault key (AES-GCM via vault.encryptBlob) — never a shared key */
  const caseState = () => (pendingCase !== undefined ? pendingCase : caseNS);
  async function caseSeal(id, vault) { id = String(id).toLowerCase(); if (caseState() === 'case:' + id) return { ok: false, rule: 'CASE-OPEN-CLOSE-FIRST' }; if (!vault || vault.status() !== 'unlocked') return { ok: false, rule: 'CASE-VAULT-LOCKED' };
    const data = {}; for (const c of CASE_CATS) data[c] = baseStore.load('case:' + id + ':' + c); const box = await vault.encryptBlob(JSON.stringify(data)); baseStore.save('case:' + id + ':sealed', box); for (const c of CASE_CATS) baseStore.save('case:' + id + ':' + c, []); return { ok: true, rule: 'CASE-SEALED-VAULT' }; }
  async function caseUnseal(id, vault) { id = String(id).toLowerCase(); const box = baseStore.load('case:' + id + ':sealed'); if (!box || Array.isArray(box) || !box.ct) return { ok: false, rule: 'CASE-NOT-SEALED' }; if (!vault || vault.status() !== 'unlocked') return { ok: false, rule: 'CASE-VAULT-LOCKED' };
    const data = JSON.parse(await vault.decryptBlob(box)); for (const c of CASE_CATS) baseStore.save('case:' + id + ':' + c, data[c] || []); baseStore.save('case:' + id + ':sealed', []); return { ok: true }; }
  /* GKS fact ingestion (plan §1): body.facts from a snapshot the caller verified with the GKS pin/verify module (publisher key + hash + signature). The signature is
     recorded as who published, never as truth; invalid entries (no citation, popularity fields, no lineage root) are rejected individually. */
  function ingestShared(body, verified) { const r = KN.ingest(body, verified); if (!r.ok) return r; const cur = (baseStore.load('gks_facts') || []).filter(f => !r.facts.some(n => n.id === f.id)); baseStore.save('gks_facts', cur.concat(r.facts)); return { ok: true, admitted: r.facts.map(f => f.id), rejected: r.rejected }; }
  function challengeShared(id, ev) { const all = baseStore.load('gks_facts') || [], i = all.findIndex(f => f.id === id), f = i >= 0 ? all[i] : KN.SEED.find(x => x.id === id); if (!f) return { ok: false, rule: 'GKS-NO-SUCH-FACT' };
    const c = KN.challenge(f, ev); if (!c.ok) return c; if (i >= 0) all[i] = c.fact; else all.push(c.fact); baseStore.save('gks_facts', all); return c; }
  /* proof export (plan §3): explicit user action; self-contained, re-verifiable offline (tools/verify_proof.js); case exports are labelled confidential */
  function exportProof(turn) { const tl = store.load('trace'); const t = turn == null ? tl.filter(x => x.msm && x.output).slice(-1)[0] : tl.find(x => x.turn === turn); if (!t || !t.msm || !t.msm.meaning) return { ok: false, rule: 'PROOF-NO-TURN' };
    const mem = store.load('memory'), refs = (t.msm.evidence && t.msm.evidence.refs) || []; const prem = [];
    for (const id of refs) { const g = gksFacts().find(f => f.id === id); if (g) { prem.push({ id, kind: 'shared', class: g.source.class, citation: g.source.citation, url: g.source.url || null, lineage_root: g.lineage_root, status: g.status, body_sha256: g.body_sha256, fact: g }); continue; }
      const r = mem.find(x => x.id === id); if (r && r.sensitive) return { ok: false, rule: 'PROOF-SENSITIVE-PREMISE' }; prem.push(r ? { id, kind: caseNS ? 'case' : 'private', clause: r.clause, at: r.created_at || r.at || null } : { id, kind: 'unresolved' }); }
    const body = { schema: 'FORGE-PROOF/v1', turn: t.turn, at: t.at, question: t.input, answer: t.output, meaning: t.msm.meaning, outcome: t.outcome, rules: (t.rules || []).map(r => r.id), echo: t.echo ? { pass: !!t.echo.pass, mode: t.echo.mode || null } : null, premises: prem, confidential: caseNS ? 'Confidential — case ' + caseNS.slice(5) : null, checker: 'derive.js realize + inverse analysis (Echo); knowledge.js validate/bodyHash' };
    return { ok: true, bundle: Object.assign(body, { sha256: sha256(canon(body)) }) }; }
  return { process, caseState, caseSeal, caseUnseal, exportProof, gksFacts, ingestShared, challengeShared, withdrawRule, lexicon: lex, store, echo, perm, containment: cont, bench, commitHeld, rejectHeld, heldWrites: () => store.load('held_writes'), resurrect, resurrectPreview, releaseDream, approveHypothesis, admittedRules: () => store.load('admitted_rules'), stagedHypotheses: () => stagedHyps.map(h => JSON.parse(JSON.stringify(h))), hypotheses: () => cont.hypotheses.list(), realize: m => D.realizeMeaning(m, ENV), deriveEnv: ENV, meta: () => meta, setNotation(n) { meta.notation = n === 'phi' ? 'phi' : 'plain'; saveMeta(); },
    attachLexicon(data, tier) { lex.attach(data, tier); },
    memory: () => store.load('memory'), cold: () => store.load('cold_storage'), evidence: () => store.load('evidence'), traces: () => store.load('trace'), examples: () => store.load('language_examples'),
    deleteRecord(id, reason, userTap) { if (userTap === false) return false; const pd = perm.authorize('memory.delete_ui', { userTap: true, subject: id }); if (pd.decision !== 'allow') return false; const mem = store.load('memory'); const i = mem.findIndex(r => r.id === id); if (i < 0) return false; const r = mem.splice(i, 1)[0]; r.status = 'forgotten'; store.save('memory', mem); const cold = store.load('cold_storage'); cold.push({ id: r.id, sealed_at: now(), reason: 'forgotten from the Memory screen (explicit tap + confirm)', record: r, successor: { kind: 'lifecycle_transition', from: 'accepted', to: 'archived', rule: 'forge2 APPEND_ONLY_SUCCESSOR_LAWS_V1 §Lifecycle transition' }, tier: 'WARM', resurrection_attempts: 0 }); store.save('cold_storage', cold); const tr = store.load('trace'); tr.push({ turn: 'ui', at: now(), input: '[Memory screen] delete ' + id, rules: [{ id: 'AUTH-UI-DELETE', doc: 'Doc7 (explicit user action)', note: reason || '' }], deleted: { id, kind: r.kind } }); store.save('trace', tr); return true; },
    categories: CATEGORIES, exportAll() { const o = {}; for (const c of CATEGORIES) o[c] = store.load(c); return o; }, reparseClause, derive: t => derive(G.tokenize(t)), renderClause: c => G.clauseText(c, 'kernel') };
}
function compat(c) { const v = c.verb || {}; return Object.assign({}, c, { _ast: c, pol: v.pol, mod: v.mod, tense: v.tense, val: c.pred ? (c.pred.type === 'adj' ? c.pred.words.join(' ') : (c.pred.prep ? c.pred.prep + ' ' : '') + G.npText(c.pred.np, 'kernel')) : G.vpText(c, c.subj, 'kernel'), cond: c.cond ? G.clauseText(c.cond, 'kernel') : null }); }
let _ck = null; const ck = () => (_ck = _ck || Kernel({ lexicon: isNode ? (() => { try { return require('../data/lexicon.json'); } catch (e) { return null; } })() : root.KLEX_CORE }));
const api = { Kernel, MemoryStore, mathSurface, canon,
  renderClause: c => G.clauseText(c._ast || c, 'kernel'),
  parseClause: s => { const d = ck().derive(s); return d.parses[0] ? compat(d.parses[0].node.clause) : null; },
  parseRenderedClause: t => { const c = ck().reparseClause(t); return c ? compat(c) : null; } };
if (isNode) module.exports = api; else root.KKernel = api;
})(this);
