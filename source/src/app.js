/* R4126-SHELL R4126-COPY R4126-REACH */
(function () {
const $ = s => document.querySelector(s); const $$ = s => document.querySelectorAll(s); const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '\x26amp;', '<': '\x26lt;', '>': '\x26gt;', '"': '\x26quot;' })[c]);
let backend; try { localStorage.setItem('kernel.probe', '1'); backend = { get: k => localStorage.getItem(k), set: (k, v) => localStorage.setItem(k, v), del: k => localStorage.removeItem(k), keys: () => Object.keys(localStorage) }; } catch (e) { backend = null; }
const fmt = iso => { try { return new Date(iso).toLocaleString([], { dateStyle: 'short', timeStyle: 'short', timeZoneName: 'short' }); } catch (e) { return iso; } };
const forge = KForge.ForgeKernel({ store: KKernel.MemoryStore(backend), formatTime: fmt }); window.forge = forge; window.kernel = forge;
const BUILD = window.FORGE_BUILD || { version: 'dev', built: '', tests: null };
$('#buildNote').textContent = 'build ' + BUILD.version + ' · no LLM · forge2 contract spine · reconstructed Doc 2 / MSM-v1';
const lexState = { core: 'loading', ext: 'pending' }; const queue = []; const lexData = {};
async function gunzipBytes(bytes) { if (typeof DecompressionStream === 'undefined') throw new Error('no DecompressionStream'); const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')); return JSON.parse(await new Response(ds).text()); }
const b64bytes = b => Uint8Array.from(atob(b), c => c.charCodeAt(0));
async function loadTier(file, inlineVar) { if (window[inlineVar]) return gunzipBytes(b64bytes(window[inlineVar]));
  try { const r = await fetch('data/' + file + '.json.gz'); if (!r.ok) throw 0; return await gunzipBytes(new Uint8Array(await r.arrayBuffer())); } catch (e) { const r = await fetch('data/' + file + '.json'); if (!r.ok) throw new Error('not found'); return r.json(); } }
function lexBadge() { const st = forge.lexicon.stats(); $('#lexBadge').textContent = 'lexicon: ' + (lexState.core === 'ok' ? st.wordnet_core + ' core' : lexState.core) + (lexState.ext === 'ok' ? ' + ' + st.wordnet_extended + ' ext' : lexState.ext === 'loading' ? ' + ext…' : '') + (lexState.pro === 'ok' ? ' + ' + st.wordnet_complete + ' complete' : lexState.pro === 'loading' ? ' + complete…' : '') + ' + ' + st.controlled + ' ctl'; window.LEX_STATE = lexState; }
async function ensureConfirmedShared(opts) {
  opts = opts || {};
  /* 4.9.128: pull hosted shared knowledge into session RAM (read for all). Never mass-admit A–Z into phone DB. Write needs Nic's key. */
  if (!forge.pullHostedSharedPack && !forge.admitConfirmedShared) return { ok: false, reason: 'api' };
  const view = forge.sharedKnowledgeView ? forge.sharedKnowledgeView() : (forge.confirmedSharedView ? forge.confirmedSharedView() : { admitted: [] });
  if (!opts.force && (view.admitted || []).length) return { ok: true, cached: true, view };
  try {
    let letters = ['a'];
    try { const idx = await fetch('packs/confirmed_shared/index.json', { cache: 'no-store' }); if (idx.ok) { const j = await idx.json(); if (j && Array.isArray(j.letters) && j.letters.length) letters = j.letters.slice(); } } catch (e) { /* offline: keep last-good */ }
    let last = null;
    for (const L of letters) {
      const r = await fetch('packs/confirmed_shared/' + L + '.json', { cache: 'no-store' });
      if (!r.ok) continue;
      const body = await r.text();
      last = forge.pullHostedSharedPack ? forge.pullHostedSharedPack(body) : forge.admitConfirmedShared(body, { productCurator: true });
    }
    if (last && last.ok) return last;
    if ((view.admitted || []).length) return { ok: true, cached: true, view, offline: true };
    return { ok: false, reason: 'fetch', receipt: last && last.receipt };
  } catch (e) {
    if ((view.admitted || []).length) return { ok: true, cached: true, view, offline: true };
    return { ok: false, reason: String(e && e.message || e) };
  }
}
window.ensureConfirmedShared = ensureConfirmedShared;
window.ensureSharedKnowledge = ensureConfirmedShared;
(async () => { try { lexData.core = await loadTier('lexicon', 'KLEX_CORE_GZ'); forge.attachLexicon(lexData.core, 'core'); lexState.core = 'ok'; } catch (e) { lexState.core = 'seed only'; }
  lexBadge(); window.FORGE_READY_MS = Math.round(performance.now()); const q = queue.splice(0); q.forEach(say);
  try { await ensureConfirmedShared(); } catch (e) { /* offline last-good stays */ }
  lexState.ext = 'loading'; lexBadge(); try { lexData.ext = await loadTier('lexicon-ext', 'KLEX_EXT_GZ'); forge.attachLexicon(lexData.ext, 'ext'); lexState.ext = 'ok'; } catch (e) { lexState.ext = 'unavailable'; } lexBadge(); refreshChrome();
  lexState.pro = 'loading'; lexBadge(); try { forge.attachLexicon(await loadTier('lexicon-pro', 'KLEX_PRO_GZ'), 'pro'); lexState.pro = 'ok'; } catch (e) { lexState.pro = 'unavailable'; } lexBadge(); refreshChrome(); })();
function renderIdeasTab() { const box = $('#ideasList'); if (!box) return; box.innerHTML = ideaCard() + '<div class="discover" data-discover="invent-compose">invent a hypothesis · compose that idea · suppose</div>'; }
const RENDER = { echoforge: () => window.renderBench && window.renderBench(), custody: () => window.renderCustody && window.renderCustody(), memory: renderMem, ideas: renderIdeasTab, vault: () => { renderVault(); if (window.renderVaultExtra) window.renderVaultExtra(); }, library: renderLex, audit: renderAudit, status: renderStatus };
function openTab(t) { $$('#tabs button').forEach(x => { x.classList.toggle('on', x.dataset.tab === t); x.setAttribute('aria-selected', x.dataset.tab === t ? 'true' : 'false'); }); $$('.tab').forEach(x => x.classList.toggle('on', x.id === t)); if (RENDER[t]) RENDER[t](); refreshChrome(); window.scrollTo(0, 0); }
window.openTab = openTab; window.openRecovery = () => { openTab('echoforge'); const el = document.getElementById('recovery'); if (el && el.scrollIntoView) el.scrollIntoView(); }; $$('#tabs button').forEach(b => b.onclick = () => openTab(b.dataset.tab));
$('#railBtn').onclick = () => { $('#rail').hidden = false; refreshChrome(); }; $('#railClose').onclick = () => { $('#rail').hidden = true; };
const AB = (f, authorityLabels = KProv.boundaryLabels) => authorityLabels(f && f.authority_boundary).map(l => '<span class="flag ' + (/: yes$| · external$/.test(l) ? 'on' : 'off') + '">' + esc(l) + '</span>').join(''); window.AB = AB; /* 4.9.74: kernel network + tool egress labels, never one network flag */
let lastResult = null; const stats = { routed: 0, held: 0, refused: 0, approval: 0 };
/* Ask speaks only from rmc_engine_v1.rmc_core. forge.process remains the language-core
 * turn function for memory, vault, and the grammar. It is not this screen's answer. */
async function askAnchors() {
  if (window.ASK_187_ANCHORS) return window.ASK_187_ANCHORS;
  try {
    const res = await fetch('data/anchors_187.json', { credentials: 'omit' });
    window.ASK_187_ANCHORS = res.ok ? await res.json() : { anchors: [] };
  } catch (e) { window.ASK_187_ANCHORS = { anchors: [] }; }
  return window.ASK_187_ANCHORS;
}
/* 4.9.210 (Release A2): the phone no longer picks anchors with the shipped word-to-concept index file.
 * Every cached trusted anchor (IndexedDB copy of kb.anchors) goes to the engine as a pool; rmc_core.preselect_pools keeps the
 * anchors whose own curated packet concepts meet the question's (compound names first), and the engine ranks them by phase
 * resonance. Offline with no copy: the starter anchors only. */
async function askAnchorPool() {
  if (!window.KAnchorCache) return [];
  try { await KAnchorCache.ensure(); } catch (e) { /* offline: the cached copy stays */ }
  let rows = [];
  try { rows = await KAnchorCache.all(); } catch (e) { rows = []; }
  return rows.filter(row => row && row.id && row.text).map(row => ({
    /* slim rows (the pool is every cached anchor); the full row stays in the cache and the curators' guard reads it by id */
    id: row.id, text: String(row.text).slice(0, 600), sfe: row.sfe || (row.packet && (row.packet.sfe || { Phi: row.packet.Phi, eps: row.packet.eps, mu: row.packet.mu })),
    concepts: Array.isArray(row.concepts) ? row.concepts : (row.concept ? [row.concept] : []), tier: 'anchor', state: 'anchor', trust: 'trusted',
    contributor: row.contributor, source_url: row.source_url, pool: true,
    meaning_id: row.meaning_id || null /* 4.9.229: the meaning the fact is filed under, so a picked meaning drops the others */
  }));
}
/* 4.9.208: the curators look up with the same trusted anchors Ask uses (starter set + Supabase anchors by concept), nothing else */
window.KAskAnchors = async function (question) {
  const out = [], seen = {};
  const pack = await askAnchors();
  const starter = (pack.anchors || []).map(row => ({ id: row.id, text: row.text, sfe: row.sfe, packet: row.packet, tier: 'anchor', state: 'anchor', trust: 'trusted', provenance: row.provenance, contributor: row.contributor, license: row.license, source_url: row.source_url, revision: row.revision }));
  let extra = []; try { extra = await askAnchorPool(); } catch (e) { extra = []; }
  for (const row of starter.concat(extra)) if (row && row.id && !seen[row.id]) { seen[row.id] = true; out.push(row); }
  return out;
};
const REMEMBERED = 'forge.remembered.v1';
function rememberedRows() { try { const v = JSON.parse(localStorage.getItem(REMEMBERED) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
/* 4.9.242: keep a clause fact in the device world_facts store (SPC decay, contradiction hold). Returns the upsert result. */
function keepWorldFact(body, kind) {
  try {
    const WF = window.KWorldFacts; if (!WF || typeof WF.upsert !== 'function') return { ok: false, rule: 'WORLD-FACTS-MISSING' };
    const clause = body.clause || (window.KQFrame && KQFrame.clause ? KQFrame.clause(body.text, forge) : null);
    let atom = body.atom || null;
    if (!atom && clause && clause.kriya && clause.kartr && (clause.pred || clause.karma)) {
      const pred = (clause.pred && clause.pred.text) || (clause.karma && clause.karma.text) || '';
      atom = { predicate: String(clause.kriya) === 'be' ? 'is' : String(clause.kriya), args: [String(clause.kartr.text || ''), String(pred)], polarity: clause.polarity || 'pos' };
    }
    return WF.upsert(Object.assign({}, body, { clause, atom, kind, source: 'phone_kb', trust: body.trust || 'trusted',
      remembered_at: kind === 'remember' ? (body.remembered_at || new Date().toISOString()) : body.remembered_at,
      admitted_at: kind === 'admitted' ? (body.admitted_at || new Date().toISOString()) : body.admitted_at }));
  } catch (e) { return { ok: false, rule: 'WORLD-FACTS-ERROR', error: String(e && e.message || e) }; }
}
/* 4.9.244: the Simulation Router endpoint. Set by the user (localStorage forge.sim_router, an https URL), else the
 * same-origin /sim mount when the app is served by the router itself (local runner). GitHub Pages has no router. */
function simRouterBase() {
  try { const u = String(localStorage.getItem('forge.sim_router') || '').trim(); if (/^https:\/\/[^\s]+$/.test(u) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(u)) return u.replace(/\/+$/, ''); } catch (e) { /* storage optional */ }
  return /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? location.origin + '/sim' : null;
}
async function simulateViaRouter(question) {
  if (!/^\s*what\s+(?:will\s+)?happens?\s+if\s+/i.test(String(question || ''))) return null;
  const base = simRouterBase();
  if (!base || !window.fetch) return { ok: false, status: 'no_router' };
  const ac = window.AbortController ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), 12000) : null;
  try {
    const r = await fetch(base + '/v1/simulate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: String(question).slice(0, 400) }), signal: ac ? ac.signal : undefined, credentials: 'omit' });
    const j = r.ok ? await r.json() : null;
    window.__lastSim = j;
    return j && j.schema === 'FORGE-SIM-RECEIPT/v1' ? j : { ok: false, status: 'bad_receipt' };
  } catch (e) { return { ok: false, status: 'router_unreachable' }; }
  finally { if (timer) clearTimeout(timer); }
}

async function askMemory(question) {
  const memory = { receipts: [], phone: [], hosted: [], research: [], pools: [] };
  /* 4.9.207 (Nic decision (a)): the hand-written ask_183 test answers are deleted; Ask starts from the phone's own stores.
   * 4.9.209 (Release A): the phone does no lookup of its own here. The large pools (the curated shared packs and the admitted
   * kb.contributions) go to the engine whole; rmc_core.preselect_pools picks candidates by resonance-packet concepts and then
   * ranks them by phase resonance with everything else (before: the last 12 pack rows, then briefly a phrase match). Ask no
   * longer writes receipts, so the receipt store is not fed back; what the user asked to remember is. */
  try {
    const view = forge.sharedKnowledgeView && forge.sharedKnowledgeView();
    const phone = forge.store.load('confirmed_shared');
    const shared = ((view && view.admitted) || []).map(row => ({ id: row.id, text: String(row.text || '').slice(0, 400), tier: 'confirmed_shared', contributor: 'product_curator' }))
      .concat(((phone && phone.facts) || []).map(row => ({ id: row.id, text: String(row.text || '').slice(0, 400), tier: 'confirmed_shared' })));
    memory.pools.push({ name: 'confirmed_shared', into: 'hosted', rows: shared.filter(r => r.id && r.text) });
    /* everything the user asked to remember (newest 64) goes in; the engine's resonance ranking picks */
    memory.phone = memory.phone.concat(rememberedRows().filter(r => r && r.text).slice(-64).map(row => ({ id: row.id, text: String(row.text || '').slice(0, 400), sfe: row.sfe, provenance: row.provenance, contributor: row.contributor, clause: row.clause })));
    /* 4.9.242 (plan 229 step 11): world_facts — admitted and Remember clause facts with native phase, trust and SPC decay.
     * Derive seeds from them next turn. Personal; no hosted write. */
    try {
      const WF = window.KWorldFacts; if (WF && typeof WF.rows === 'function') {
        const seen = new Set(memory.phone.map(r => String(r && r.text || '').toLowerCase()));
        for (const row of WF.rows()) {
          if (!row || !row.text || seen.has(String(row.text).toLowerCase())) continue;
          seen.add(String(row.text).toLowerCase()); memory.phone.push(row);
        }
      }
    } catch (e) {}
  } catch (e) { /* stores can be empty on first open */ }
  /* 4.9.209 (Release A item 3): curated shared facts (admitted kb.contributions), read-only, cached on the phone */
  if (window.KContribCache) {
    try { await KContribCache.ensure(); } catch (e) { /* offline: the cached copy stays */ }
    try {
      const cur = await KContribCache.all();
      memory.pools.push({ name: 'kb_contributions', into: 'hosted', rows: cur.map(row => ({ id: 'kb:' + row.id, text: String(row.text).slice(0, 400), sfe: row.sfe, provenance: row.provenance, contributor: row.contributor, tier: 'confirmed_shared', state: 'admitted' })) });
    } catch (e) { /* the cache is optional */ }
  }
  try {
    const pack = await askAnchors();
    memory.anchors = (pack.anchors || []).map(row => ({
      id: row.id, text: row.text, sfe: row.sfe, packet: row.packet, tier: 'anchor', state: 'anchor', trust: 'trusted',
      provenance: row.provenance, contributor: row.contributor, license: row.license, source_url: row.source_url, revision: row.revision,
      meaning_id: row.meaning_id || null
    }));
  } catch (e) { memory.anchors = []; }
  try {
    const have = new Set((memory.anchors || []).map(r => r.id));
    const pool = (await askAnchorPool()).filter(r => !have.has(r.id));
    if (pool.length) memory.pools.unshift({ name: 'anchors', into: 'anchors', rows: pool });
  } catch (e) { /* no cached copy: the starter anchors only */ }
  return memory;
}
function doc6Tag(gate) {
  const gateTag = gate && gate.state ? '<span class="tag doc6" data-doc6-state="' + esc(gate.state) + '">' + esc(gate.label) + '</span>' : '';
  const gst = String((gate && gate.state) || '').toLowerCase();
  const next = /unsupported|clarification-required|ambiguity|action_blocked|refuse|blocked/.test(gst);
  return gateTag + (next ? '<div class="next-step" data-next-step>Rephrase, or open Memory, Ideas, or Audit.</div>' : '');
}
/* 4.9.209: the explicit write. The engine's proposal for an admitted answer is kept on this phone (lasting memory) and sent to
 * the shared KB only through the locked-down writer (signed-in linked account, writer role, verified device signature);
 * otherwise it stays here, pending. Nothing else in Ask writes. */
let lastAdmitted = null;
async function rememberAnswer(row, how) {
  const mw = row && row.memory_write;
  /* 4.9.211 (DRIFT-SPEC D12 + D8): a lasting write needs the engine's write gate: clean at θ_admit, Φ6 correction then Φ7 naming,
   * Echo ≥ 0.97 plus the categorical classes (negation, certainty, condition), C ≥ 0.87. A failed gate keeps nothing. */
  if (mw && row.product_reply && mw.write_gate && mw.write_gate.ok !== true) return { ok: false, rule: mw.rule || 'MEMORY-WRITE-GATE', gate: mw.write_gate };
  const prop = mw && mw.proposed && mw.proposal;
  if (!prop || !row.product_reply) return { ok: false, rule: 'REMEMBER-NOTHING-ADMITTED' };
  const body = JSON.parse(JSON.stringify(prop));
  body.provenance = Object.assign({}, body.provenance || {}, { requested_by: 'user', request: how === 'tap' ? 'remember_tap' : 'remember_command' });
  const kept = rememberedRows();
  if (!kept.some(x => x && x.text === body.text)) {
    const row = Object.assign({}, body, { clause: body.clause || (window.KQFrame && KQFrame.clause ? KQFrame.clause(body.text, forge) : null), remembered_at: new Date().toISOString() });
    const wf = keepWorldFact(row, 'remember');
    if (wf && wf.ok === false && /^WORLD-FACTS-CONFLICT/.test(wf.rule || '')) return { ok: false, rule: wf.rule, message: wf.message, existing: wf.existing, gate: null };
    kept.push(row); try { localStorage.setItem(REMEMBERED, JSON.stringify(kept.slice(-200))); } catch (e) { /* storage full */ }
  }
  window.FORGE_ADMITTED = window.FORGE_ADMITTED || [];
  if (!window.FORGE_ADMITTED.some(x => x && x.text === body.text)) window.FORGE_ADMITTED.push(body);
  let shared = { ok: false, pending: true, rule: 'KB-WRITER-UNAVAILABLE' };
  if (window.KSb && KSb.insertAdmitted) {
    try { shared = await KSb.insertAdmitted(body, (uid, sha, nonce) => forge.signer && forge.signer.writerProof ? forge.signer.writerProof(uid, sha, nonce) : null); }
    catch (e) { shared = { ok: false, attempted: true, written: false, verified: false, rule: 'KB-WRITER-UNVERIFIED', error: String(e && e.message || e), calls_llm: false }; }
  }
  body.supabase = shared; row.memory_write.supabase = shared; row.memory_write.committed = true; row.memory_write.rule = 'REMEMBER-BY-USER-REQUEST';
  return { ok: true, rule: 'REMEMBER-BY-USER-REQUEST', text: body.text, supabase: shared };
}
/* 4.9.209: "remember (that) <statement>" keeps the user's own statement on this phone (never the shared KB: it is personal and
 * unsourced). Questions are not statements; secrets go to the vault, not plain memory. Ask then reads it back as phone memory
 * and the engine decides (a later contradicting statement makes the derive conflicted, so Ask holds and shows both). */
const REMEMBER_STATEMENT = /^\s*(?:please\s+)?remember\s+(?:that\s+)?(\S.*?)\s*[.!]?\s*$/i;
async function rememberStatement(text) {
  const m = String(text).match(REMEMBER_STATEMENT);
  const said = m ? m[1].trim() : '';
  if (!said) return { ok: false, rule: 'REMEMBER-EMPTY', message: 'Remember what? Say "remember that …" with a statement.' };
  if (/\?$/.test(said) || /^(?:what|who|whom|whose|which|when|where|why|how|is|are|was|were|do|does|did|can|could|will|would|should)\b/i.test(said)) return { ok: false, rule: 'REMEMBER-NOT-A-STATEMENT', message: 'That is a question, not a statement. Ask it, then say "remember this" to keep an admitted answer.' };
  if (window.KPrivacy && KPrivacy.redact && KPrivacy.redact(said).secrets.length) return { ok: false, rule: 'PRIV-SECRET-NOT-KEPT', message: 'That looks like a secret (a password, key or card). It is not kept in plain memory; use the vault.' };
  const sentence = said.charAt(0).toUpperCase() + said.slice(1) + (/[.!]$/.test(said) ? '' : '.');
  const kept = rememberedRows();
  if (kept.some(x => x && String(x.text).toLowerCase() === sentence.toLowerCase())) return { ok: true, rule: 'REMEMBER-ALREADY-KEPT', text: sentence, message: 'Already remembered on this phone: ' + sentence };
  const id = 'rem-' + (window.KSha && KSha.sha256 ? KSha.sha256(sentence.toLowerCase()).slice(0, 12) : String(kept.length + 1));
  /* 4.9.231 (plan 229 step 3): the statement is kept as its kāraka clause beside its text (the kernel's own parser) */
  const clause = window.KQFrame && KQFrame.clause ? KQFrame.clause(sentence, forge) : null;
  const row = { id, text: sentence, clause, scope: 'phone', provenance: { requested_by: 'user', request: 'remember_command', kind: 'statement', said: String(text) }, remembered_at: new Date().toISOString() };
  const wf = keepWorldFact(row, 'remember');
  if (wf && wf.ok === false && /^WORLD-FACTS-CONFLICT/.test(wf.rule || '')) return { ok: false, rule: wf.rule, message: wf.message || 'Held: that contradicts a kept fact.', existing: wf.existing };
  kept.push(row);
  try { localStorage.setItem(REMEMBERED, JSON.stringify(kept.slice(-200))); } catch (e) { return { ok: false, rule: 'REMEMBER-STORAGE-FULL', message: 'Phone storage is full; nothing was kept.' }; }
  return { ok: true, rule: 'REMEMBER-BY-USER-REQUEST', text: sentence, message: 'Remembered on this phone: ' + sentence, world_facts: wf && wf.rule };
}
const REMEMBER_LAST = /^\s*remember\s*(this|that|it|the answer|that answer)?\s*[.!]?\s*$/i;
/* 4.9.226 (Nic pt141u): meaning follow-up. Forge asks which meaning; the next message picks one and the ORIGINAL question is asked again under it.
 * The pending ask lives in this session only. With no ask pending, say() is unchanged. */
let pendingAsk = null;
window.KGapOpen = () => pendingAsk ? { kind: pendingAsk.kind, question: pendingAsk.question, word: pendingAsk.word || null, options: Array.isArray(pendingAsk.options) ? pendingAsk.options : [] } : null;
function askCard(kind, bodyHtml, state) {
  const log = $('#log');
  log.insertAdjacentHTML('beforeend', '<div class="msg bot" data-ask-state="' + state + '" data-followup="' + kind + '"><span class="kind deterministic_route">meaning</span><div data-ask-body>' + bodyHtml + '</div><div class="flags">no LLM · deterministic · nothing stored</div></div>');
  log.lastElementChild.scrollIntoView({ block: 'end' });
}
async function say(text) { if (lexState.core === 'loading') { queue.push(text); return; }
  const log = $('#log'); log.insertAdjacentHTML('beforeend', '<div class="msg user">' + esc(text) + '</div>');
  let qtext = text; let askCtx = {}; let simSpecific = false; let simSupplement = null;
  if (pendingAsk && window.KSenses && KSenses.follow) {
    const f = KSenses.follow(pendingAsk, text);
    if (f.state === 'resolved') {
      const picked = f.option;
      if (pendingAsk.kind === 'sim') {
        qtext = f.run.question; simSpecific = true; simSupplement = f.run.supplement || null; pendingAsk = null;
      } else {
        askCard('picked', 'Taking ' + esc(pendingAsk.word) + ' as: ' + esc(picked.label) + '. Asking again: ' + esc(f.run.question), 'meaning-picked');
        qtext = f.run.question; askCtx = { sense: f.run.sense || null, sensed: f.run.sensed || null, chain: f.run.chain || 0, picked: picked }; pendingAsk = null;
      }
    } else if (f.state === 'again') { pendingAsk = f.pending; askCard('again', esc(f.text), pendingAsk.kind === 'sim' ? 'sim-ask' : 'meaning-ask'); return null; }
    else if (f.state === 'giveup') {
      const w = pendingAsk.word; const sim = pendingAsk.kind === 'sim'; pendingAsk = null;
      askCard('giveup', sim ? ('I could not tell which kind of ' + esc(w) + ' you mean, so I am leaving that question.') : ('I could not tell which ' + esc(w) + ' you mean, so I am leaving that question. Ask it again and name the meaning (for example "the planet").'), sim ? 'sim-ask' : 'meaning-dropped');
      return null;
    }
    else { pendingAsk = null; }
  }
  if (REMEMBER_LAST.test(text)) {
    const r = lastAdmitted ? await rememberAnswer(lastAdmitted, 'command') : { ok: false, rule: 'REMEMBER-NOTHING-ADMITTED' };
    const msg = r.ok ? 'Remembered on this phone: ' + esc(r.text) + ' · shared KB ' + esc(r.supabase && (r.supabase.ok ? r.supabase.rule : (r.supabase.rule + (r.supabase.pending ? ' (kept here, pending)' : ''))))
      : r.gate ? 'Not remembered: the memory write gate failed (' + esc((r.gate.failed || []).join(', ')) + ') · ' + esc(r.rule) + '. Nothing was kept.'
      : 'Nothing to remember yet: no admitted answer in this conversation.';
    log.insertAdjacentHTML('beforeend', '<div class="msg bot" data-ask-state="' + (r.ok ? 'remembered' : 'held') + '"><span class="kind deterministic_route">memory</span><div data-ask-body>' + msg + '</div><div class="flags">explicit request · no LLM</div></div>');
    log.lastElementChild.scrollIntoView({ block: 'end' }); refreshChrome(); return r;
  }
  if (REMEMBER_STATEMENT.test(text)) {
    const r = await rememberStatement(text);
    log.insertAdjacentHTML('beforeend', '<div class="msg bot' + (r.ok ? '' : ' blocked') + '" data-ask-state="' + (r.ok ? 'remembered' : 'held') + '" data-remember-rule="' + esc(r.rule) + '"><span class="kind deterministic_route">memory</span><div data-ask-body>' + esc(r.message) + '</div><div class="flags">explicit request · kept on this phone only · no LLM</div></div>');
    log.lastElementChild.scrollIntoView({ block: 'end' }); refreshChrome(); return r;
  }
  /* 4.9.235 (plan 229 step 7): an unpicked many-meaning subject is ASKED before the engine runs (4.9.229 asked after the
   * engine had already answered, so the card showed a spoken answer's turn ending in a question). The sense ask reads only
   * the question and the sense data (KSenses.planAsk); the engine runs once the meaning is picked, under that meaning. */
  if (!askCtx.sense && window.KSenses && KSenses.planAsk) {
    try {
      if (KSenses.ensure) { try { await KSenses.ensure(); } catch (e) { /* the sense data is optional */ } }
      const pa = KSenses.planAsk(qtext, null, { sensed: askCtx.sensed, chain: askCtx.chain });
      if (pa && pa.kind === 'sense') { pendingAsk = pa; stats.held++; askCard('ask', esc(KSenses.askText(pa, false)), 'meaning-ask'); refreshChrome(); return { ok: true, held: true, reply: null, product_reply: false, meaning_ask: true, asked_before_engine: true, calls_llm: false }; }
    } catch (e) { /* the ask is optional; the engine runs below */ }
  }
  if (window.KCustody && KCustody.noteAsk) KCustody.noteAsk(true);
  let row;
  try {
    const memory = await askMemory(qtext);
    if (window.KPipeline && KPipeline.researchExcerpt) {
      try {
        const hit = await KPipeline.researchExcerpt(qtext, { fetch: window.fetch ? window.fetch.bind(window) : null });
        if (hit && hit.excerpt) {
          const url = String(hit.url || '');
          memory.research.push({ id: 'web-' + memory.research.length, text: String(hit.excerpt).slice(0, 500), url: url || 'https://en.wikipedia.org/', source: 'wikipedia', trust: 'low', quarantined: true, premise: false });
        }
      } catch (e) { /* a missing fetch stays quarantined-empty; it is not an answer */ }
    }
    /* 4.9.244 (plan 229 step 12b): a what-happens-if question goes to the backend Simulation Router (MuJoCo / SymPy).
     * Its receipt is a measured causal premise for this turn only (memory.simulation; never stored). No router → no
     * receipt → the engine holds or uses stored causal facts as before. */
    /* 4.9.245: the simulators run on this phone first (KSimDevice: Pyodide SymPy/SciPy/Biopython/astropy and WASM
     * MuJoCo/RDKit/ngspice). Heavy CFD / Hartree-Fock asks go to the Home PC Simulator if one is set, else they hold. */
    const simReceipt = window.KSimDevice ? await KSimDevice.simulate(qtext, memory, simSpecific, simSupplement) : await simulateViaRouter(qtext);
    if (simReceipt && simReceipt.asked) qtext = simReceipt.asked;
    if (simReceipt && simReceipt.status === 'ask' && simReceipt.ask && window.KSenses) {
      pendingAsk = simReceipt.ask;
      const asked = KSenses.askText(pendingAsk, false);
      stats.held++;
      askCard('sim', esc(asked), 'sim-ask');
      refreshChrome();
      return { ok: true, held: true, reply: asked, product_reply: false, sim_ask: true, calls_llm: false };
    }
    if (simReceipt && simReceipt.ok && Array.isArray(simReceipt.rows)) memory.simulation = simReceipt.rows.slice(0, 6);
    askCtx.sim = simReceipt || null;
    if (!window.KRMCCore || !KRMCCore.run) row = { ok: false, held: true, reply: null, route: 'rmc_client_missing', drift: null, coherence: null, echo: { score: 0, pass: false }, admit: { disposition: 'held' }, stages: [], calls_llm: false };
    else row = await KRMCCore.run(Object.assign({ question: qtext, live: true, dry_run: false, memory: memory }, askCtx.sense ? { sense: askCtx.sense } : {}));
    /* 4.9.206: the old replay of recorded self-seed documents (the fixtures global) is removed from Ask. Recorded demo
     * documents are shown only on the Self-seed card (window.SELF_SEED_DEMO); Ask never treats a recording as research. */
  } finally { if (window.KCustody && KCustody.noteAsk) KCustody.noteAsk(false); }
  if (row && askCtx.sim) { row.sim = { ok: !!askCtx.sim.ok, status: askCtx.sim.status, reason: askCtx.sim.reason || null, receipt_id: askCtx.sim.receipt_id || null, sha256: askCtx.sim.sha256 || null, solver: askCtx.sim.primary_solver || (askCtx.sim.problem && askCtx.sim.problem.solver) || null, where: askCtx.sim.where || null, home_pc_required: !!askCtx.sim.home_pc_required }; }
  lastResult = row;
  /* 4.9.208: a held question becomes a curation gap for Athena (no write happens here) */
  if (window.KCurators && KCurators.noteHeld && row && !row.product_reply) { try {
    let compiled = null;
    try { if (window.KQFrame && window.forge) compiled = window.KQFrame.compile(qtext, window.forge); } catch (e) { compiled = null; }
    const qframe = compiled && compiled.schema === 'forge.qframe/v1' ? compiled : (row.qframe || null);
    row.curation = KCurators.noteHeld(qtext, row, { qframe: qframe, sim: askCtx.sim || null });
  } catch (e) { /* the curators are optional */ } }
  /* 4.9.209 (Nic plan, Release A item 2): an admitted answer writes nothing. No session RAM, no receipt store, no Supabase.
   * The engine's proposal waits for "remember …" or the Remember tap (rememberAnswer). */
  /* 4.9.229's after-the-engine sense ask moved above the engine run (4.9.235): the meaning is asked first, never after an answer. */
  const admitted = !!(row && row.product_reply && row.reply);
  if (admitted) lastAdmitted = row;
  /* 4.9.242: world_facts is written only on explicit Remember (rememberStatement / rememberAnswer tap).
   * A spoken engine answer is NOT auto-persisted — otherwise the short paraphrase becomes phone evidence on the
   * next turn and can outrank the source anchor (Why is the sky blue? held after "The sky looks blue to us." was
   * auto-kept) or feed itself back without deixis (Help speaking "You compute…"). Plan 229 step 11: commit on
   * user tap at the write gate. A spoken answer must not become its own evidence. */

  const rememberBtn = admitted && row.memory_write && row.memory_write.proposed ? '<button type="button" class="small" data-ask-remember>Remember</button>' : '';
  const kd = admitted ? 'deterministic_route' : 'deterministic_hold';
  stats[admitted ? 'routed' : 'held']++;
  const echo = row && row.echo || {};
  /* 4.9.217: the relation the engine's Echo re-parse read (asked relation, realised or not) is shown on the card, with the
   * Pāṇini wording module's own re-parse of the admitted sentence (KPaniniWording through the kernel) as recorded evidence.
   * The engine's Echo decides; this tag never admits or holds. */
  const rel = echo.relation && echo.relation.asked ? echo.relation : null;
  let panini = '';
  if (rel && admitted && window.forge && forge.parseRenderedClause && String(row.reply).length <= 160) { try { panini = forge.parseRenderedClause(row.reply) ? 'parsed' : 'unparsed'; } catch (e) { panini = 'unparsed'; } }
  const relState = rel && rel.realised === true ? 'yes' : rel && rel.realised === false ? 'no' : 'unread';
  const relTag = rel ? '<span class="tag" data-echo-relation="' + esc(rel.asked) + '" data-echo-realised="' + relState + '"' + (panini ? ' data-echo-panini="' + panini + '"' : '') + '>' + esc(rel.asked) + (relState === 'yes' ? ' realised' : relState === 'no' ? ' not realised' : '') + '</span>' : '';
  const admit = row && row.admit && row.admit.disposition;
  const gap = !admitted && askCtx.sim && window.KSimDevice && KSimDevice.propertyHold ? KSimDevice.propertyHold(askCtx.sim) : '';
  const body = admitted ? esc(row.reply) : 'Held. No answer was admitted. route ' + esc(row && row.route) + ' · drift ' + esc(row && row.drift) + ' · C ' + esc(row && row.coherence) + ' · echo ' + esc(echo.score) + ' ' + (echo.pass ? 'pass' : 'fail') + ' · admit ' + esc(admit) + (row && row.admit && row.admit.drift_region ? ' · drift region ' + esc(row.admit.drift_region) : '') + '.' + (gap ? ' <span data-sim-hold="gap">' + esc(gap) + '</span>' : '') + (row && row.sim && row.sim.home_pc_required && window.KSimDevice ? ' <span data-sim-hold="home_pc">' + esc(KSimDevice.holdNote(askCtx.sim)) + '</span>' : '');
  /* 4.9.237 outward compile: the shown reply is R_t (src/rmc_core.js outwardCompile); the source premises are kept as cited quotes */
  const oc = row && row.outward_compile;
  const ocTag = oc ? '<span class="tag" data-outward="' + esc(oc.applied ? oc.mode : (oc.rule || oc.mode || 'none')) + '">' + (oc.applied ? 'outward ' + esc(oc.mode) : esc(oc.rule || ('outward ' + (oc.mode || 'none')))) + '</span>' : '';
  const ocQuotes = admitted && oc && oc.applied && (oc.quotes || []).length ? '<div class="small" data-source-quotes>' + oc.quotes.map(q => '<q data-source-quote="' + esc(q.id) + '">' + esc(q.text) + '</q> <span class="small">(' + esc(q.source) + ')</span>').join(' ') + '</div>' : '';
  /* 4.9.216 computed tier: a math question that was not computed says why (or asks which unit), in the engine's words. */
  const comp = row && row.computed;
  const compNote = !admitted && comp && comp.status !== 'ok' ? ' <span data-computed-held="' + esc(comp.status) + '">' + (comp.clarify ? esc(comp.clarify) : 'Math not computed: ' + esc(comp.reason || comp.rule || comp.status) + '.') + (row.libs && row.libs.error ? ' Math libraries did not load (' + esc(row.libs.error) + ').' : '') + '</span>' : '';
  const compTag = admitted && comp && comp.status === 'ok' && comp.receipt && comp.receipt.receipt_id ? '<span class="tag" data-computed-receipt="' + esc(comp.receipt.receipt_id) + '">computed · ' + esc(comp.receipt.receipt_id) + '</span>' : '';
  log.insertAdjacentHTML('beforeend', '<div class="msg bot' + (admitted ? '' : ' blocked') + '" data-ask-state="' + (admitted ? 'admitted' : 'held') + '"><span class="kind ' + kd + '">' + kd + '</span><span class="tag">ε_s ' + esc(row && row.drift) + '</span><span class="tag">C ' + esc(row && row.coherence) + '</span><span class="tag">Echo ' + (echo.pass ? '✓' : '✗') + '</span>' + compTag + relTag + ocTag + (admitted && row.memory_write && row.memory_write.write_gate && !row.memory_write.write_gate.ok ? '<span class="tag" data-write-gate>not storable: ' + esc((row.memory_write.write_gate.failed || []).join(', ')) + '</span>' : '') + '<div data-ask-body data-answer-source="' + (admitted ? (oc && oc.applied ? 'panini_wording.outward' : 'rmc_engine_v1.output_renderer') : 'hold') + '">' + body + compNote + '</div>' + ocQuotes + doc6Tag(row && row.gate) + '<div class="flags">no LLM · packs gated · money disabled · nothing stored unless you ask</div>' + rememberBtn + '</div>');
  if (rememberBtn) { const card = log.lastElementChild; const btn = card.querySelector('[data-ask-remember]'); btn.onclick = async () => { btn.disabled = true; const r = await rememberAnswer(row, 'tap'); btn.textContent = r.ok ? 'Remembered' + (r.supabase && r.supabase.ok ? ' · shared' : ' · on this phone') : 'Not remembered'; }; }
  log.lastElementChild.scrollIntoView({ block: 'end' });
  renderRmc(qtext, row);
  /* 4.9.221 shadow sense trace (advisory, logged in memory only; never awaited, never read by any gate, changes no answer) */
  if (window.KSenses && KSenses.note) { try { KSenses.note(qtext); } catch (e) { /* the trace is optional */ } }
  /* 4.9.226: a held answer may ask which meaning is meant (an ambiguous unit, or one asked word with 2-4 WordNet meanings). A picked meaning
   * that still holds says so plainly; nothing is guessed. (4.9.235: the meaning ask runs before the engine, above.) */
  if (!admitted && window.KSenses && KSenses.planAsk) {
    try {
      if (askCtx.sense) askCard('held-under-sense', 'Held under that meaning (' + esc(askCtx.sense.word) + ': ' + esc(askCtx.picked.label) + '): no vetted fact is stored for it yet. The question is queued for Athena.', 'meaning-held');
      try { if (KSenses.ensure) await KSenses.ensure(); } catch (e) { /* the sense data is optional */ }
      const pa = KSenses.planAsk(qtext, row, { sensed: askCtx.sensed, chain: askCtx.chain });
      /* 4.9.235: only the unit ask needs the engine's reading (row.computed); the meaning ask ran before the engine. */
      if (pa && pa.kind === 'unit') { pendingAsk = pa; askCard('ask', esc(KSenses.askText(pa, false)), 'meaning-ask'); }
    } catch (e) { /* the ask is optional; the held card above stands */ }
  }
  refreshChrome();
  return row; }
function anchorSample(row) {
  const pack = window.ASK_187_ANCHORS || { anchors: [] };
  const anchors = pack.anchors || [];
  const q = String((row && row.trace && row.trace.input) || '').toLowerCase();
  const reply = String((row && row.reply) || '').toLowerCase();
  const words = reply.split(/[^a-z0-9]+/).filter(w => w.length > 3);
  function score(a) {
    if (!a) return 0;
    const concept = String(a.concept || '').toLowerCase();
    if (!concept || q.indexOf(concept) < 0) return 0;
    const text = String(a.text || '').toLowerCase();
    let s = 10;
    for (const w of words) if (text.indexOf(w) >= 0) s += 1;
    return s;
  }
  const ranked = anchors.filter(a => score(a) > 0).sort((a, b) => score(b) - score(a) || String(a.id).localeCompare(String(b.id)));
  const hit = ranked[0] || anchors.find(a => a && a.packet) || anchors[0];
  if (!hit) return 'No trusted anchor is loaded.';
  const p = hit.packet || {};
  const prov = hit.provenance || {};
  return 'anchor ' + esc(hit.id) + ' · state anchor · trust trusted · Φ ' + esc(p.Phi) + ' · ε ' + esc(p.eps) + ' · μ ' + esc(p.mu) + ' · license ' + esc(hit.license) + ' · revision ' + esc(hit.revision) + ' · ' + esc(hit.contributor) + ' · ' + esc(prov.source_url || hit.source_url) + ' · ' + esc(String(hit.text || '').slice(0, 180));
}
function glyphSpan(ch) { return '<span class="glyph">' + esc(ch || '') + '</span>'; }
function engineStage(row) {
  const eng = (row && row.engines) || (row && row.trace && row.trace.engines) || {};
  const os = eng.protoforge_os_layer || {};
  const br = eng.drift_circuit_breaker || {};
  const tax = eng.drift_taxonomy || {};
  const cor = eng.gilligan_drift_correction || {};
  const rec = eng.gilligan_re_curation || {};
  if (!eng.drift_taxonomy && !os.rule) return '';
  const streak = br.consecutive_failures == null ? '' : ' · consecutive ' + esc(br.consecutive_failures) + '/' + esc(br.consecutive_limit);
  const v43 = eng.drift_v43 || {};
  const v43line = v43.disposition ? '<div class="meta" data-drift-v43>drift v4.3 · ' + esc(v43.disposition) + ' · Φ_act ' + esc(v43.phi_act) + ' ' + esc(v43.phi_act_name) + ' · d_score ' + esc(v43.d_score) + ' · ε_s ' + esc(v43.eps_s) + ' · θ_w ' + esc(v43.theta_w) + ' · step ' + esc(v43.step_flag) + ' · hard fire ' + (v43.categorical_hard_fire ? 'yes' : 'no') + ' · writes off · no LLM</div>' : '';
  const d194 = eng.drift_194 || {};
  const d194line = d194.rsoc ? '<div class="meta" data-drift-194>breaker 4.9.194 · RSOC ' + esc(d194.rsoc) + ' · Genesis ' + esc(d194.gn) + ' · class ' + esc(d194.class) + ' · failsafe ' + esc(d194.failsafe) + ' · archive ' + (d194.archive ? 'yes' : 'no') + ' · write ' + (d194.write_allowed ? 'allowed by the 0.35 law' : 'held') + ' · admit gate off · no LLM</div>' : '';
  const dpa = eng.dpa_195 || {};
  const dpaline = dpa.rewrite_rule ? '<div class="meta" data-dpa-195>dead path 4.9.195 · eligible ' + (dpa.eligible ? 'yes' : 'no') + ' · rewrite ' + esc(dpa.rewrite_rule) + ' · erase ' + esc(dpa.erase_rule) + ' · fork ' + esc(dpa.fork_rule) + ' · SPC 0.5 ' + (dpa.spc_above_0_5 ? 'logged' : 'quiet') + ' · admit gate off · no LLM</div>' : '';
  const tier = eng.tiers_196 || {};
  const tierline = tier.tier ? '<div class="meta" data-tiers-196>tiers 4.9.196 · ' + esc(tier.tier) + ' → ' + esc(tier.half_tier) + ' at ' + esc(tier.half_life_hours) + ' h · dead ' + (tier.dead ? 'yes' : 'no') + ' · deep ' + esc(tier.deep_rule) + ' · SPC 0.5 ' + (tier.spc_above_0_5 ? 'logged' : 'quiet') + ' · admit gate off · no LLM</div>' : '';
  const ppe = eng.ppe_197 || {};
  const shown = (ppe.words || []).map(w => (w.glyph || '') + ' Φ' + w.Phi + ' ' + (w.phase_name || '') + ' ' + (w.word || '') + ' ε ' + w.eps + ' μ ' + w.mu).join(' · ');
  const ppeline = ppe.provenance ? '<div class="meta" data-ppe-197>lexicon 4.9.197 · ' + esc(ppe.map_authority) + ' · ' + esc(ppe.provenance) + ' · birth ε ' + esc(ppe.eps0) + ' μ ' + esc(ppe.mu_init) + ' · M ' + esc(ppe.m_charge) + ' flag ' + esc(ppe.m_flag) + ' · ' + esc(shown) + ' · admit gate off · no LLM</div>' : '';
  const growth = eng.growth_198 || {};
  const grown = (growth.novel || []).map(w => (w.glyph || '') + ' Φ' + w.Phi + ' ' + (w.phase_name || '') + ' ' + (w.word || '') + ' ε ' + w.eps + ' μ ' + w.mu).join(' · ');
  const growthline = growth.provenance ? '<div class="meta" data-growth-198>lexicon growth 4.9.198 · ' + esc(growth.provenance) + ' · novel ' + esc((growth.novel || []).length) + ' · ' + esc(grown) + ' · persisted ' + (growth.persisted ? 'yes' : 'no') + ' · admit gate off · no LLM</div>' : '';
  const geom = eng.geometry_199 || {};
  const geomline = geom.geometry_build ? '<div class="meta" data-geometry-199>geometry 4.9.199 · closure ' + esc(geom.closure_rule) + ' · charge conserved ' + (geom.charge_conserved ? 'yes' : 'no') + ' · membrane ' + (geom.membrane_before_naming ? 'yes' : 'no') + ' · RSOC numbers ' + (geom.rsoc_numbers ? 'yes' : 'no') + ' · UA applied ' + (geom.ua_applied ? 'yes' : 'no') + ' · persisted ' + (geom.persisted ? 'yes' : 'no') + ' · admit gate off · no LLM</div>' : '';
  const rend = eng.rmc_renderer_200 || {};
  const rendline = rend.renderer_build ? '<div class="meta" data-renderer-200>renderer 4.9.200 · closed ' + (rend.response_closed ? 'yes' : 'no') + ' · echo fail [' + esc(rend.failing_echo_output || '') + '] · loop bound ' + (rend.loop_bound ? 'yes' : 'no') + ' · M ' + esc(rend.M) + ' · lambda ' + esc(rend.spc_lambda) + ' · persisted ' + (rend.persisted ? 'yes' : 'no') + ' · admit gate off · no LLM</div>' : '';
  const gilin = eng.gilin_crp_201 || {};
  const gilinline = gilin.gilin_build ? '<div class="meta" data-gilin-201>gilin 4.9.201 · coordinated ' + (gilin.coordinated ? 'yes' : 'no') + ' · CRP admits ' + (gilin.crp_admits ? 'yes' : 'no') + ' · C* admits ' + (gilin.c_star_admits ? 'yes' : 'no') + ' · warn admits ' + (gilin.warn_admits ? 'yes' : 'no') + ' · law witness ' + (gilin.law_witness ? 'yes' : 'no') + ' · admit gate off · no LLM</div>' : '';
  const seed = row && row.self_seed;
  const seedline = seed ? '<div class="meta" data-self-seed-202>self-seed 4.9.202 · ' + esc(seed.rule) + ' · hosts ' + esc((seed.hosts || []).join(', ')) + ' · ' + esc(seed.url || '') + ' · Wikipedia is not an anchor · no LLM</div>' : '';
  return '<div class="meta" data-engine-stage>ProtoForge / Gilligan · ' + esc(os.rule) + ' · state ' + esc(os.state) + ' · glyph ' + glyphSpan(os.glyph) + ' · hook ' + esc(os.hook) + ' · breaker ' + esc(br.rule) + streak + ' · taxonomy ' + esc((tax.active || []).join(', ') || tax.band) + ' · Gilligan ' + esc(cor.rule) + ' · re-curation promoted ' + esc(rec.promoted) + ' · packs ' + (rec.packs_written ? 'written' : 'gated') + ' · money disabled</div>' + v43line + d194line + dpaline + tierline + ppeline + growthline + geomline + rendline + gilinline + seedline;
}
function renderLexiconPackets() {
  const host = $('#lexiconPacketBody');
  if (!host || !window.ResonanceLexicon) return;
  const words = ['sky', 'leaves', 'ocean', 'friction'];
  host.innerHTML = words.map(word => {
    const pkt = ResonanceLexicon.placeWord(word);
    return '<div class="meta" data-lexicon-row="' + esc(word) + '">' + glyphSpan(pkt.glyph) + ' ' + glyphSpan('Φ' + pkt.Phi) + ' · ' + esc(word) + ' · ε ' + esc(pkt.eps) + ' · μ ' + esc(pkt.mu) + ' · ' + esc(pkt.authority) + ' · map ' + esc(pkt.map_authority) + ' · seed ' + esc((pkt.cite || []).slice(0, 4).join(', ')) + '</div>';
  }).join('');
  const angle = (window.KMath && KMath.PAPER_CONSTANTS && KMath.PAPER_CONSTANTS.phi_to_angle) || {};
  const opened = window.KMath && KMath.driftCircuitBreaker ? KMath.driftCircuitBreaker(0.36, null, [0.36, 0.36]) : null;
  const held = window.KMath && KMath.driftCircuitBreaker ? KMath.driftCircuitBreaker(0.36, null, [0.36]) : null;
  host.innerHTML += '<div class="meta" data-lexicon-authority>' + esc(ResonanceLexicon.wordCount()) + ' seed words. Letter map: ' + esc((ResonanceLexicon.letterAuthority() || {}).map_authority) + ', not ' + esc((ResonanceLexicon.letterAuthority() || {}).not_map_authority) + '. θ ' + esc(angle.formula || '') + '. Merge window π/4. Proposal-v1 words with ε/μ: ' + esc(ResonanceLexicon.proposalV1Count()) + '. μ otherwise unspecified. C_min 0.87. Money disabled.</div>'
    + '<div class="meta" data-breaker-check>breaker check · two failures stay ' + esc(held && held.rule) + ' · three ε 0.36 failures ' + esc(opened && opened.rule) + ' · consecutive ' + esc(opened && opened.consecutive_failures) + '/' + esc(opened && opened.consecutive_limit) + '</div>';
}
function renderRmc(text, row) {
  const host = $('#rmcLive'), body = $('#rmcLiveBody');
  if (!host || !body) return;
  host.hidden = false;
  const stages = (row && row.stages) || [];
  const pills = stages.map(s => '<span class="tag" data-stage="' + esc(s.stage_id) + '" data-status="' + esc(s.status) + '">' + s.n + ' ' + esc(s.status) + '</span>').join(' ');
  const late = ((row && row.late_stages) || []).map(s => esc(s.n + ' ' + s.stage_id + ' ' + s.status + (s.reason ? ' · ' + s.reason : ''))).join('<br>');
  const echo = row && row.echo || {};
  const phase = row && row.trace && row.trace.phase || {};
  const wm = row && row.world_model || {};
  const derived = wm.derive || {};
  const survivor = derived.survivor || {};
  const debate = wm.debate || survivor.debate || {};
  const opponent = debate.opponent || {};
  const prov = (survivor.provenance || []).join(', ');
  const eps = survivor.drift && survivor.drift.epsilon_s;
  const chi = survivor.chi || (survivor.drift && survivor.drift.chi) || {};
  const res = row && row.resonance || {};
  const rsoc = res.rsoc || {};
  const asked = res.asked || {};
  const write = row && row.memory_write || {};
  const packet = write.packet || {};
  body.innerHTML = '<div data-rmc-question>' + esc(text) + '</div>'
    + '<div class="meta" data-rmc-summary>route ' + esc(row && row.route) + ' · drift ' + esc(row && row.drift) + ' · C ' + esc(row && row.coherence) + ' · echo ' + esc(echo.score) + ' ' + (echo.pass ? 'pass' : 'fail') + ' · admit ' + esc(row && row.admit && row.admit.disposition) + ' · recall ' + esc(row && row.active_memory_count) + '</div>'
    + '<div data-rmc-stages>' + pills + '</div>'
    + '<div class="meta" data-stage-recall>Recall resonance · ' + esc(res.how || 'none') + ' · question Φ' + esc(res.question_band != null ? res.question_band : res.question_phi) + (res.question_tuning && res.question_tuning.band ? ' · band ' + esc(res.question_tuning.band) + ' ' + esc(res.question_tuning.low) + '–' + esc(res.question_tuning.high) + ' Hz · tuned ' + esc(Number(res.question_tuning.hz).toFixed(2)) + ' Hz (' + esc(res.question_tuning.label) + ')' : '') + ' · frame ' + esc(asked.frame) + ' · role ' + esc(asked.role) + ' ' + esc(asked.filler) + ' · RSOC ' + esc(rsoc.status) + ' · locked ' + esc(rsoc.locked) + '</div>'
    + '<div class="meta" data-stage-observe>Observe · admitted ' + esc(wm.observe && wm.observe.admitted) + ' · quarantined ' + esc(wm.observe && wm.observe.quarantined) + ' · superseded ' + esc(wm.observe && wm.observe.superseded) + ' · root ' + esc(wm.world_root) + '</div>'
    + '<div class="meta" data-stage-derive>Derive ' + esc(derived.status) + ' · ' + esc(derived.reason) + ' · claims ' + esc((derived.claims || []).length) + ' · how ' + esc(survivor.how) + '</div>'
    + '<div class="meta" data-stage-debate>EchoForge debate ' + esc((debate.order || ['proponent', 'opponent']).join(' then ')) + ' · frame ' + esc(debate.frame) + ' · survived ' + esc(debate.survived) + ' · challenger ' + esc((opponent.objections || []).map(o => o.code).join(', ')) + '</div>'
    + '<div class="meta" data-stage-language-core>Language core · ' + esc(row && row.language_core && row.language_core.function) + ' · speech ' + esc(row && row.language_core && row.language_core.speech_act) + ' · hops ' + esc(row && row.language_core && row.language_core.anchors_connected) + ' · gap ' + esc(row && row.language_core && row.language_core.gap) + ' · model ' + ((row && row.language_core && row.language_core.model_invoked) ? 'called' : 'not called') + '</div>'
    + '<div class="meta" data-derived-provenance>provenance ' + esc(prov || 'none') + ' · drift ' + esc(eps) + ' ' + esc(survivor.drift && survivor.drift.disposition) + ' · chi ' + esc(chi.status) + ' · ChristPing ' + (wm.christping_initiated ? 'started' : 'not started') + '</div>'
    + '<div class="meta" data-derived-hops>' + esc(((survivor.hops || []).map(h => (h.n || '') + ' ' + (h.text || '') + ' · ' + ((h.provenance || []).join(',')) + ' · ε ' + (h.drift && h.drift.epsilon_s))).join(' | ')) + '</div>'
    + '<div class="meta" data-derived-text>' + esc(wm.derived_text || '') + '</div>'
    + '<div class="meta" data-memory-write>memory writer ' + (write.committed ? 'committed by your request' : write.proposed ? 'proposal only, not stored (say "remember" or tap Remember)' : 'not committed') + ' · packet ' + esc(packet.schema || 'none') + ' · Φ ' + esc(packet.Phi) + ' · ε ' + esc(packet.eps) + ' · μ ' + esc(packet.mu) + ' · contributor ' + esc(write.provenance && write.provenance.contributor) + ' · supabase ' + esc(write.supabase && write.supabase.rule) + '</div>'
    + '<div class="meta" data-source-trust>trust ' + esc(row && row.trust && row.trust.rule) + ' · low-trust ' + esc(row && row.trust && row.trust.low_trust) + ' · rests on ' + esc(row && row.trust && row.trust.rests_on) + ' · points ' + esc(((row && row.trust && row.trust.points_at) || []).join(', ')) + '</div>'
    + '<div class="meta" data-anchor-sample>' + anchorSample(row) + '</div>'
    + '<div class="meta" data-phase-glyph>phase ' + glyphSpan(phase.primary) + ' ' + glyphSpan(phase.glyph || '') + ' · concept ' + esc(phase.concept) + ' · echo method ' + esc(echo.method) + ' · ' + esc(echo.compares) + '</div>'
    + engineStage(row)
    + '<div class="meta" data-rmc-late>' + late + '</div>'
    + '<div class="meta">' + (row && row.product_reply ? 'Admitted answer from the RMC renderer.' : 'Held. This card is the trace. Stages 14–16 ran. Observe, Derive, and the debate ran in the engine.') + '</div>';
  host.setAttribute('data-ready', '1');
  window.RMC_DRY_LAST = row;
  window.RMC_DRY_LOG = window.RMC_DRY_LOG || [];
  window.RMC_DRY_LOG.push({ question: text, row: row });
}
window.say = say;
window.renderRmc = renderRmc;
$('#f').onsubmit = e => { e.preventDefault(); const v = $('#q').value.trim(); if (v) { say(v); $('#q').value = ''; } };
{ const ask = $('#f') && $('#f').parentElement; if (ask && !$('#exportTurnBtn')) { const bar = document.createElement('div'); bar.className = 'bar'; bar.innerHTML = '<button type="button" id="exportTurnBtn" data-export-turn>Export turn packet</button>'; ask.appendChild(bar); } }
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-export-turn]'); if (!b || !forge.exportTurnPacket) return; const raw = b.getAttribute('data-export-turn'); const card = b.closest('[data-receipt-type]');
  if (raw == null || raw === '') { say('export the turn packet'); return; } const p = forge.exportTurnPacket(+raw); if (!p) return; const kind = card ? card.getAttribute('data-receipt-type') : (p.receipt_type || 'turn'); const blob = new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forge-' + kind + '-turn-' + p.turn + '.json'; a.click(); });
$('#q').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#f').requestSubmit ? $('#f').requestSubmit() : $('#f').onsubmit(e); } };
function refreshChrome() { const m = forge.meta(); const facts = forge.memory().filter(r => r.kind !== 'note').length; const rs = forge.receipts();
  $('#statusBadges').innerHTML = [['Status', lexState.core === 'ok' ? 'ONLINE' : 'LOADING'], ['Trust', 'no LLM · deterministic'], ['Commands', 'all turns via kernel · legacy LLM refused ' + KSpine.LEGACY_LLM.length], ['Next', m.pending ? 'answer the pending question' : 'ask anything']].map(([k, v]) => '<span class="sb"><b>' + k + '</b> ' + esc(v) + '</span>').join('');
  $('#authBoundary').innerHTML = AB(lastResult && lastResult.forge) + '<div class="small" style="width:100%">Understanding is not authorization. Memory writes only on "remember…" or a confirmed "yes".</div>';
  const driftShown = lastResult && lastResult.drift != null ? lastResult.drift : (m.last ? m.last.eps_s + ' ' + m.last.band : '—');
  $('#railState').innerHTML = esc('turns ' + (m.turn || 0) + ' · facts ' + facts + ' · receipts ' + rs.length) + '<br>' + esc('routed ' + stats.routed + ' · held ' + stats.held + ' · approval ' + stats.approval + ' · refused ' + stats.refused) + '<br>' + esc('drift ' + driftShown + ' · χ ' + (m.chi || 0)); }
function renderVault() { const mem = forge.memory().filter(r => r.kind !== 'note'); const me = mem.filter(r => !r.clause.coord && r.subjKey && /^(user|user:|name:)/.test(String(r.subjKey)) || (r.entities || []).some(k => /^user/.test(k)));
  const st = forge.vault.status(); $('#vaultState').textContent = st === 'none' ? 'no passphrase' : st; $('#vaultGo').textContent = st === 'none' ? 'Create vault' : 'Unlock'; renderVaultReset(st); const entries = forge.vault.entries().filter(e => (e.kind || 'secret') === 'secret');
  $('#vaultList').innerHTML = '<h3>About you (' + me.filter(r => !r.sensitive).length + ')</h3>' + (me.filter(r => !r.sensitive).map(r => '<div class="rec">' + esc(KKernel.renderClause(r.clause)) + '<div class="meta">' + esc(r.id + ' · turn ' + r.provenance.turn) + '</div></div>').join('') || '<div class="meta">nothing yet — try “remember that my name is …”</div>') +
    '<h3>Sealed values (' + entries.length + ')</h3>' + (entries.map(e => '<div class="rec">🔒 ' + esc(e.label) + ' <span class="meta">' + esc(e.id + (e.ref ? ' · ' + e.ref : '') + (e.at ? ' · ' + fmt(e.at) : '')) + '</span> <button data-reveal="' + esc(e.id) + '"' + (st !== 'unlocked' ? ' disabled' : '') + '>Reveal</button><span class="meta" id="rv-' + esc(e.id.replace(':', '_')) + '"></span></div>').join('') || '<div class="meta">none — try “remember that my pin is 1234” after creating/unlocking the vault</div>');
  $$('[data-reveal]').forEach(b => b.onclick = async () => { if (!confirm('Reveal this sealed value on screen (it is hidden again in 10 s)?')) return; const el = $('#rv-' + b.dataset.reveal.replace(':', '_')); try { el.textContent = ' → ' + await forge.vault.reveal(b.dataset.reveal); setTimeout(() => { el.textContent = ''; }, 10000); } catch (e) { el.textContent = ' ' + e.message; } }); }
$('#vaultForm').onsubmit = async e => { e.preventDefault(); const p = $('#vaultPass').value; $('#vaultPass').value = ''; try { if (forge.vault.status() === 'none') { await forge.vault.setup(p); $('#vaultMsg').textContent = 'Vault created and unlocked (key kept in memory only).'; } else $('#vaultMsg').textContent = (await forge.vault.unlock(p)) ? 'Unlocked.' : 'Wrong passphrase.'; } catch (x) { $('#vaultMsg').textContent = x.message; } renderVault(); };
/* v4.9.8 vault-only reset (forgotten passphrase): only the sealed vault + passphrase verifier + vault-held device key go */
function renderVaultReset(st) { const host = $('#vaultReset'); if (!host) return; if (st !== 'locked') { host.innerHTML = ''; return; } const O = forge.operator;
  host.innerHTML = '<details><summary class="small">Forgot the passphrase? Reset the vault only</summary><div id="vrPlan"></div></details>';
  host.querySelector('summary').onclick = () => { const p = O.vaultResetPlan(); $('#vrPlan').innerHTML = '<div class="small"><b>Warning:</b> the ' + p.sealed_values_lost + ' sealed value(s) in this vault are lost forever — nobody can decrypt them without the old passphrase. The device signing key goes too, so the device registration must be redone.</div><div class="small"><b>Kept untouched:</b> ' + p.kept.length + ' other stores (memory, knowledge, settings and the rest).</div><input id="vrT" aria-label="type the confirmation" placeholder="type ' + esc(p.confirm_phrase) + '"><button id="vrGo">Reset the vault only</button>';
    $('#vrGo').onclick = () => { const r = O.resetVault({ confirm: $('#vrT').value, userTap: true }); if (!r.ok) { $('#vaultMsg').textContent = r.rule; return; } if (window.KSb && window.KSb.markDeviceRedo) window.KSb.markDeviceRedo(); $('#vaultMsg').textContent = 'Vault reset: ' + r.sealed_values_lost + ' sealed value(s) removed. Choose a new passphrase above, then register this device again in Account.'; renderVault(); if (window.renderAccount) window.renderAccount(); }; }; }
$('#vaultLock').onclick = () => { forge.vault.lock(); $('#vaultMsg').textContent = 'Locked.'; renderVault(); };
/* M5 MEA: manifest proposals with their suite fitness, drift and route; adopt only by tap and only when approvable */
function workingHTML() { const ws = forge.workingFacts ? forge.workingFacts() : []; return '<div class="card"><div class="cardhead">Working facts — this conversation only, not stored (' + ws.length + ')</div>' + (ws.length ? ws.map(w => '<div class="rec"><div>' + (w.text == null ? '🔒 sensitive' : esc(w.text)) + '</div><div class="meta">' + esc(w.id + ' · turn ' + w.turn) + '</div><button data-wfkeep="' + esc(w.id) + '">Remember</button></div>').join('') : '<div class="small">Plain statements are used for this conversation only. Say “remember that …” or tap Remember to keep one.</div>') + '</div>'; }
const meaCy = {}; /* MEA problem lane (4.9.72): session cycles shown in the Memory tab; commit is a tap + confirm */
const meaOpen = {}; /* 4.9.74 MEA panel (step 8): which problems show their full detail (a view toggle, never a write) */
function meaDetailHTML(pid) { const d = forge.meaDetail ? forge.meaDetail(pid) : null; if (!d || !d.ok) return ''; const mu = x => x == null ? '–' : String(x / 1e6), m = d.manifest, row = (k, v) => '<div class="meta"><b>' + esc(k) + '</b> ' + esc(v) + '</div>';
  return '<div class="rec" style="margin-left:8px">' + row('Manifest', (d.proposed ? 'PROPOSED analogue (Nic decides adoption) · ' : '') + (m.domain || '') + ' · Φ' + m.phase_state + ' · ' + m.claim_status.replace(/_/g, ' ') + ' · next ' + m.required_next_action.replace(/_/g, ' ') + ' · output ' + m.output_permissions + ' · hash ' + m.hash.slice(0, 12) + (m.parent_hash ? ' ← ' + m.parent_hash.slice(0, 12) : '')) +
    row('Known facts', m.known_facts.map(f => f.text + ' [' + f.tier + ']').join(' · ')) + row('Derivations', m.derivations.map(x => x.id + ': ' + x.expr).join(' · ') || '–') + row('Success conditions', m.success_conditions.map(x => x.text).join(' · ')) +
    row('Unknown vector', d.unknown_vector.map(u => u.text + ' — ' + (u.resolved ? 'resolved' : u.gap.replace(/_/g, ' '))).join(' · ')) +
    row('Proof debt', 'manifest B ' + mu(d.proof_debt.manifest_micro) + (d.proof_debt.cycle_B_micro != null ? ' · this cycle B ' + mu(d.proof_debt.cycle_B_micro) + ' (' + d.proof_debt.formula + ')' + (d.proof_debt.undischarged.length ? ' · undischarged: ' + d.proof_debt.undischarged.map(q => q.ref + ' [' + q.tier + ']').join(', ') : '') : ' · run a cycle for the per-candidate debt') + ' · ' + d.proof_debt.rule) +
    row('Convergence', d.convergence.map(c => 'cycle ' + c.cycle + ': Φ' + c.phase_state + ' ' + c.claim_status.replace(/_/g, ' ') + ', ' + c.open_unknowns + ' open unknown(s)').join(' → ')) +
    row('Claim-status history', d.claim_history.map(h => 'cycle ' + h.cycle + ': ' + h.claim_status.replace(/_/g, ' ') + (h.claims.length ? ' (' + h.claims.map(c => c.status.replace(/_/g, ' ')).join(', ') + ')' : '')).join(' → ')) +
    (d.candidates.length ? '<div class="meta"><b>Candidates and gates</b></div>' + d.candidates.map(c => '<div class="meta">' + esc(c.op + ' · ' + c.kind + ' · ' + c.route + ' · ' + (c.claim_status || '').replace(/_/g, ' ') + ' — ' + c.claim) + '<br>' + c.gates.map(g => (g.ok ? '✅ ' : '❌ ') + esc(g.gate)).join(' ') + '</div>').join('') : row('Candidates', 'run a cycle to see the candidate set with its gate results')) +
    row('Lineage / audit chain', d.lineage.chain.map(c => c.hash.slice(0, 10)).join(' → ') + ' · operators: ' + (d.lineage.operator_history.map(o => o.glyph || o.operator_id).join(' ') || '–') + ' · receipts: ' + (d.lineage.receipts.map(r => r.id).join(', ') || '–') + (d.lineage.sub_manifests.length ? ' · sub-manifests: ' + d.lineage.sub_manifests.join(', ') : '')) +
    row('Archive', d.archive.length ? d.archive.map(a => (a.claim || a.candidate_id) + ' — ' + (a.reason || a.claim_status) + (a.blocked_on ? ' (blocked on ' + a.blocked_on + ')' : '')).join(' · ') : 'empty') + '</div>'; }
function meaProblemsHTML() { const ps = forge.meaProblems ? forge.meaProblems().filter(p => !p.sub_of) : []; if (!ps.length) return ''; const mu = x => x == null ? '–' : String(x / 1e6);
  return '<div class="card"><div class="cardhead">MEA (Manifest Evolution) — problem manifests (' + ps.length + ')</div>' + ps.map(p => { const cy = meaCy[p.problem_id];
    return '<div class="rec"><div>' + esc(p.goal) + '</div><div class="meta">' + esc(p.problem_id + ' · Φ' + p.phase_state + ' · ' + p.claim_status.replace(/_/g, ' ') + ' · next: ' + p.required_next_action.replace(/_/g, ' ') + ' · cycle ' + p.cycle + (p.draft ? ' · draft (value supplied, not committed)' : '') + (p.sub_manifests.length ? ' · ' + p.sub_manifests.length + ' sub-manifests (⧧)' : '')) + '</div>' +
      '<button data-meaopen="' + esc(p.problem_id) + '">' + (meaOpen[p.problem_id] ? 'Hide details' : 'Details') + '</button> ' + '<button data-meacy="' + esc(p.problem_id) + '">Run cycle</button>' + p.value_unknowns.map(u => ' <button data-measu="' + esc(p.problem_id) + '" data-meau="' + esc(u.id) + '">Supply: ' + esc(u.text) + '</button>').join('') +
      (cy ? '<div class="meta">Candidates (gates → Pareto → lexicographic B↓ L↑ Ω↑ I↑ A↑ ε↓ K↓; the display score is shown only and never ranks):</div>' + cy.candidates.map(c => '<div class="meta">' + esc(c.op + ' · ' + c.kind + ' · ' + c.route + ' · ' + c.claim_status.replace(/_/g, ' ') + (c.rank ? ' · rank ' + c.rank + (c.favoured ? ' (favoured)' : '') : '') + ' · B ' + mu(c.terms.B) + ' · L ' + mu(c.terms.L) + ' · Ω ' + mu(c.terms.Omega) + ' · I ' + mu(c.terms.I) + ' · ε ' + mu(c.terms.eps) + ' · display ' + mu(c.display_score) + (c.gates.some(g => !g.ok) ? ' · failed: ' + c.gates.filter(g => !g.ok).map(g => g.gate).join(', ') : '') + ' — ' + c.claim) + '</div>').join('') +
        (cy.resolution ? '<div class="meta">' + esc('Proposal: ' + cy.resolution.claim_status.replace(/_/g, ' ') + ' · next: ' + cy.resolution.required_next_action.replace(/_/g, ' ') + ' · route ' + cy.resolution.route) + '</div>' + (cy.resolution.route === 'eligible' ? '<button data-meacm="' + esc(p.problem_id) + '">Commit (tap)</button>' : '') : '<div class="meta">' + esc('No proposal' + (cy.stop ? ': ' + cy.stop.rule : '')) + '</div>') : '') + (meaOpen[p.problem_id] ? meaDetailHTML(p.problem_id) : '') + '</div>'; }).join('') +
    '<div class="meta">' + esc('Archive (cold storage): ' + forge.meaArchive().length + ' item(s) · receipts ' + forge.meaReceipts().length) + '</div></div>'; }
function meaHTML() { const cs = forge.meaCandidates ? forge.meaCandidates() : []; if (!cs.length) return '';
  return '<div class="card"><div class="cardhead">Manifest evolution — proposals (' + cs.length + ')</div>' + cs.map(c => { const f = c.fitness; return '<div class="rec"><div>' + esc(c.text) + '</div><div class="meta">' + esc(c.id + ' · ' + c.op + ' · passed ' + f.passed + '/' + f.cases + ' · regressions ' + f.regressions + ' · Echo ' + f.echo + ' · ε_s ' + (f.drift.eps_s_micro / 1e6) + ' (' + f.drift.band + ')' + (f.evidence === 'none' ? ' · no evidence: no case exercises it' : '') + (f.legality && f.legality.length ? ' · illegal: ' + f.legality.join(', ') : '') + ' · ' + f.route + (c.pareto ? ' · Pareto' : '') + ' · ' + c.status) + '</div>' +
    (c.status === 'adopted' ? '<button data-meawd="' + esc(c.id) + '">Withdraw</button>' : f.route === 'approvable' ? '<button data-mea="' + esc(c.id) + '">Adopt</button>' : '<div class="meta">' + (f.route === 'shadow' ? 'shadow only (exploration band)' : f.route === 'no_evidence' ? 'not adoptable: no evidence' : 'not adoptable') + '</div>') + '</div>'; }).join('') + '</div>'; }
/* MEA-K (4.9.75): grammar manifests (lexicon classes, frames, open parser categories). Same contract as the relation-property card: build-time
   fitness, adopt only when approvable and only by tap + confirm; non-approvable candidates are listed with their archive reason. */
function meaKHTML() { const cs = forge.meaCandidatesK ? forge.meaCandidatesK() : []; if (!cs.length) return ''; const ar = forge.meaArchiveK ? forge.meaArchiveK() : []; const why = id => (ar.find(a => a.id === id) || {}).reason;
  return '<div class="card"><div class="cardhead">Grammar evolution (MEA-K) — proposals (' + cs.length + ')</div><div class="meta">Lexicon classes, verb/adjective frames and open word categories only; closed functional words and sentence structure can never change (structure-dependence guard).</div>' + cs.map(c => { const f = c.fitness; return '<div class="rec"><div>' + esc(c.text) + '</div><div class="meta">' + esc(c.id + ' · ' + c.op + ' · ' + c.families.join('+') + ' · passed ' + f.passed + '/' + f.cases + ' · gained ' + f.gained + ' · regressions ' + f.regressions + ' · Echo ' + f.echo + ' · ε_s ' + (f.drift.eps_s_micro / 1e6) + ' (' + f.drift.band + ') · structure guard ' + (f.structure_guard_regressions ? 'BROKEN' : 'intact') + ' · ' + f.route + (c.pareto ? ' · Pareto' : '') + ' · ' + c.status) + '</div>' +
    (c.status === 'adopted' ? '<button data-meakwd="' + esc(c.id) + '">Withdraw</button>' : f.route === 'approvable' ? '<button data-meak="' + esc(c.id) + '">Adopt</button>' : '<div class="meta">' + esc('archived: ' + (why(c.id) || f.route)) + '</div>') + '</div>'; }).join('') +
    (() => { const ms = forge.meaMetaK ? forge.meaMetaK() : []; if (!ms.length) return ''; return '<div class="meta"><b>MEA\'s own data (meta manifests)</b> — budgets, operator schedule and costs, pool sizes. Gates, thresholds and the drift ruling are not data and cannot change.</div>' + ms.map(c => { const f = c.fitness; return '<div class="meta">' + esc(c.text + ' · gained ' + f.gained + ' · regressions ' + f.regressions + ' · ε_s ' + (f.drift.eps_s_micro / 1e6) + ' · ' + f.route + ' · ' + c.status + (f.route !== 'approvable' && why(c.id) ? ' · archived: ' + why(c.id) : '')) + '</div>' + (c.status === 'adopted' ? '<button data-metawd="' + esc(c.id) + '">Withdraw</button>' : f.route === 'approvable' ? '<button data-meta="' + esc(c.id) + '">Adopt</button>' : ''); }).join(''); })() + '</div>'; }
function importCard() { const v = forge.importView ? forge.importView() : { admitted: [], held: [] }; const row = (f, held) => '<div class="rec"><div>' + esc(f.text || '') + '</div><div class="meta">' + (held ? 'Held for tap' : 'admitted') + ' · ' + esc(f.evidence || '') + '</div>' + (held ? '<button type="button" data-import-admit="' + esc(f.id) + '">Admit</button>' : '') + '</div>'; const adm = (v.admitted || []).map(f => row(f, 0)).join('') || '<div class="meta">empty</div>'; const held = (v.held || []).map(f => row(f, 1)).join('') || '<div class="meta">empty</div>'; return '<div class="card" id="importPack" data-import-pack><div class="cardhead">Import pack</div><div class="meta">Paste a pack. Admitted anchors invent and compose. Not memory. Not shared knowledge. Held for tap stays out until Admit. Provenance import_pack.</div><textarea id="importPaste" rows="3"></textarea><input id="importFile" type="file" accept="application/json,.json"><div id="importPreview" class="meta"></div><button id="importGo" type="button">Import confirmed facts</button> <button id="clearImport" type="button">Clear import</button><div class="meta">Admitted</div>' + adm + '<div class="meta">Held for tap</div>' + held + '</div>'; }
function starterCard() { const st = forge.starterView ? forge.starterView() : { status: 'cleared', provenance: 'starter_pack', facts: [] }; const rows = st.status === 'present' ? (st.facts || []).map(f => '<div class="rec"><div>' + esc(f.text || '') + '</div><div class="meta">provenance starter_pack</div></div>').join('') : '<div class="meta">cleared</div>'; const btn = st.status === 'present' ? '<button id="clearStarter" type="button">Clear starter knowledge</button>' : ''; return '<div class="card" data-starter-pack data-starter-onboard><div class="cardhead">Starter knowledge</div><div class="meta">starter_pack · Clear starter knowledge</div><div class="meta">provenance ' + esc(st.provenance || 'starter_pack') + ' · ' + esc(st.status || 'cleared') + '</div>' + rows + btn + '</div>'; }
function confirmedSharedCard() { const v = forge.sharedKnowledgeView ? forge.sharedKnowledgeView() : (forge.confirmedSharedView ? forge.confirmedSharedView() : { admitted: [], held: [], provenance: 'confirmed_shared' }); const n = (v.admitted || []).length; const row = (f, held) => '<div class="rec"><div>' + esc(f.text || '') + '</div><div class="meta">' + (held ? 'Held for tap' : 'hosted shared knowledge') + (f.evidence ? ' · ' + esc(f.evidence) : '') + '</div>' + (held ? '<button type="button" data-cs-admit="' + esc(f.id) + '">Admit</button>' : '') + '</div>'; const rows = n ? (v.admitted || []).slice(0, 12).map(f => row(f, 0)).join('') + (n > 12 ? '<div class="meta">… ' + (n - 12) + ' more</div>' : '') : '<div class="meta">empty · pull hosted packs</div>'; const held = (v.held || []).map(f => row(f, 1)).join('') || '<div class="meta">empty</div>'; return '<div class="card" id="confirmedShared" data-confirmed-shared data-shared-knowledge-hosted><div class="cardhead">Shared knowledge base</div><div class="meta">Hosted packs/confirmed_shared · read for everyone · write needs Nic\'s key · not phone DB · ' + n + ' pulled</div>' + rows + '<div class="meta">Held for tap</div>' + held + '<button id="refreshConfirmedShared" type="button">Refresh shared knowledge</button> <button id="clearConfirmedShared" type="button">Clear session pull</button></div>'; }

function renderMem() { const mem = forge.memory(), cold = forge.cold(), ev = forge.evidence(), ex = forge.examples(), tr = forge.traces(); const facts = mem.filter(r => r.kind !== 'note'), notes = mem.filter(r => r.kind === 'note');
  const sensEv = new Set(mem.concat(cold.map(c => c.record || {})).filter(r => r.sensitive && r.provenance).map(r => r.provenance.evidence)); const echoOk = tr.filter(t => t.echo && t.echo.pass).length, echoN = tr.filter(t => t.echo).length; const au = forge.verifyAudit();
  $('#memHealth').innerHTML = [['facts', facts.length], ['notes', notes.length], ['evidence', ev.length], ['cold Ĉ', cold.length], ['echo pass', echoOk + '/' + echoN], ['audit chain', au.ok ? 'OK' : 'BROKEN']].map(([k, v]) => '<span class="sb"><b>' + k + '</b> ' + esc(v) + '</span>').join('');
  const rec = r => '<div class="rec"><div>' + (r.kind === 'note' ? '📝 ' + esc(r.text) : r.sensitive ? '🔒 ' + esc(KGrammar.npText(r.clause.subj, 'kernel')) + ' — hidden' : esc(KKernel.renderClause(r.clause))) + '</div><div class="meta">' + esc(r.kind + (r.pred ? ' · ' + r.pred : '') + ' · ' + r.id + ' · turn ' + r.provenance.turn + ' · ' + fmt(r.provenance.at) + ' · ' + (r.phase_tag || '') + ' · μ=' + r.sfe.mu) + '</div>' + (r.entities && !r.sensitive ? '<div class="meta">entities: ' + esc(r.entities.join(', ')) + '</div>' : '') + '<button data-del="' + esc(r.id) + '">Forget → cold storage</button></div>';
  $('#memList').innerHTML = starterCard() + confirmedSharedCard() + importCard() + '<div class="small" data-doc7-law>Language corpus ≠ Evidence ≠ Memory ≠ Trace/receipt ≠ Authority records. Presence ≠ truth.</div>' +
    '<div class="card" data-doc7-cat="memory"><div class="cardhead">Active facts (' + facts.length + ') <span class="tag doc7">Memory</span></div>' + (facts.map(rec).join('') || '<div class="meta">empty</div>') + '</div>' +
    '<div class="card" data-doc7-cat="memory"><div class="cardhead">Notes (' + notes.length + ') <span class="tag doc7">Memory</span></div>' + (notes.map(rec).join('') || '<div class="meta">empty</div>') + '</div>' +
    '<div class="card" data-doc7-cat="evidence"><div class="cardhead">Evidence (' + ev.length + ') <span class="tag doc7">Evidence · presence ≠ truth</span></div>' + ev.slice(-20).reverse().map(e => '<div class="rec"><div>' + (sensEv.has(e.id) ? '🔒 sensitive utterance hidden' : esc(e.utterance)) + '</div><div class="meta">' + esc(e.id + ' · turn ' + e.turn + ' · ' + fmt(e.at)) + '</div></div>').join('') + '</div>' +
    '<div class="card" data-doc7-cat="memory"><div class="cardhead">Cold storage Ĉ (' + cold.length + ') <span class="tag doc7">Memory</span></div>' + cold.slice(-20).reverse().map(c => '<div class="rec"><div>' + esc(c.reason) + '</div><div class="meta">' + esc(c.record && c.record.clause && !c.record.sensitive ? KKernel.renderClause(c.record.clause) : c.record && c.record.text ? c.record.text : (c.input || '')) + ' · ' + esc(fmt(c.sealed_at)) + (c.successor ? ' · ' + esc(c.successor.from + '→' + c.successor.to) : '') + '</div></div>').join('') + '</div>' +
    workingHTML() +
    meaProblemsHTML() +
    meaHTML() +
    meaKHTML() +
    containmentHTML() +
    '<div class="card" data-doc7-cat="language_corpus"><div class="cardhead">Language examples (' + ex.length + ') <span class="tag doc7">Language corpus · presence ≠ truth</span></div>' + ex.map(x => '<div class="rec">' + esc(x.concept + ' v' + x.version + ': ' + x.example) + '</div>').join('') + '</div>';
  const clearStarter = $('#clearStarter'); if (clearStarter) clearStarter.onclick = () => { if (!confirm('Clear starter knowledge? Remembered facts stay.')) return; forge.clearStarterKnowledge(); renderMem(); };
  const paste = $('#importPaste'), file = $('#importFile'), preview = $('#importPreview');
  const showPrev = () => { if (!paste || !forge.previewImport) return; const p = forge.previewImport(paste.value || ''); if (preview) preview.textContent = p.ok ? (p.plain || '') : ('Refused: ' + (p.reason || '')); };
  if (paste) paste.oninput = showPrev;
  if (file) file.onchange = () => { const f = file.files && file.files[0]; if (!f || !window.FileReader) return; const rd = new FileReader(); rd.onload = () => { if (paste) paste.value = String(rd.result || ''); showPrev(); }; rd.readAsText(f); };
  const go = $('#importGo'); if (go) go.onclick = () => { if (!confirm('Import pack? Admitted become anchors. Remembered facts stay.')) return; const r = forge.importConfirmedPack(paste ? paste.value : '', { userTap: true }); alert(r.ok ? 'Imported.' : ('Not imported: ' + ((r.receipt && r.receipt.reason) || r.rule || ''))); renderMem(); };
  const clearImport = $('#clearImport'); if (clearImport) clearImport.onclick = () => { if (!confirm('Clear import? Starter and remembered stay.')) return; forge.clearImportPack(); renderMem(); };
  $$('[data-import-admit]').forEach(b => b.onclick = () => { if (!confirm('Admit held sentence? Not memory.')) return; const r = forge.admitImportItem(b.dataset.importAdmit, true); alert(r.ok ? 'Admitted.' : ('Not admitted: ' + (r.rule || ''))); renderMem(); });
  const refreshCs = $('#refreshConfirmedShared'); if (refreshCs) refreshCs.onclick = async () => { await ensureConfirmedShared({ force: true }); renderMem(); };
  const clearCs = $('#clearConfirmedShared'); if (clearCs) clearCs.onclick = () => { if (!confirm('Clear session shared knowledge pull? This does not change the hosted packs.')) return; forge.clearConfirmedShared(); renderMem(); };
  $$('[data-cs-admit]').forEach(b => b.onclick = () => { if (!confirm('Admit held sentence? Not memory.')) return; const r = forge.admitConfirmedSharedItem(b.dataset.csAdmit, true); alert(r.ok ? 'Admitted.' : ('Not admitted: ' + (r.rule || ''))); renderMem(); });
  $$('[data-del]').forEach(b => b.onclick = () => { if (confirm('Forget this record? It moves to cold storage (Doc 7) and stops answering questions.')) { forge.deleteRecord(b.dataset.del, 'RMC Memory tab (explicit tap + confirm)', true); renderMem(); } });
  $$('[data-approve]').forEach(b => b.onclick = () => { const r = forge.commitHeld(b.dataset.approve, true); alert(r.ok ? 'Committed · read-back ' + r.readback.map(x => x.readback).join(', ') : 'Not committed: ' + (r.rule || 'read-back mismatch, rolled back')); renderMem(); });
  $$('[data-reject]').forEach(b => b.onclick = () => { forge.rejectHeld(b.dataset.reject, true); renderMem(); });
  $$('[data-gates]').forEach(b => b.onclick = () => { const g = forge.resurrectPreview(b.dataset.gates); const el = document.getElementById('gate-' + b.dataset.gates); if (el) el.innerHTML = g ? '<b>' + esc(g.decision) + '</b> (tier ' + esc(g.tier) + ')<br>' + g.gates.map(x => (x.pass ? '✅ ' : '❌ ') + esc(x.gate + ' — ' + x.detail)).join('<br>') : ''; });
  $$('[data-res]').forEach(b => b.onclick = () => { if (!confirm('Return this record to processing as a proposal? The seven gates are checked. Nothing is stored.')) return; const r = forge.resurrect(b.dataset.res, true); alert(r.ok ? 'Proposal only. Nothing stored.' : 'Not proposed: ' + r.rule); renderMem(); });
  $$('[data-rscommit]').forEach(b => b.onclick = () => { if (!confirm('Store this proposed record in active memory? This tap is the only store.')) return; const r = forge.commitResurrection(b.dataset.rscommit, true); alert(r.ok ? 'Stored · read-back ' + r.readback.readback : 'Not stored: ' + r.rule); renderMem(); });
  $$('[data-meaopen]').forEach(b => b.onclick = () => { meaOpen[b.dataset.meaopen] = !meaOpen[b.dataset.meaopen]; renderMem(); });
  $$('[data-meacy]').forEach(b => b.onclick = () => { const r = forge.meaCycle(b.dataset.meacy); if (r.ok) meaCy[b.dataset.meacy] = r.cycle; else alert('No cycle: ' + r.rule); renderMem(); });
  $$('[data-measu]').forEach(b => b.onclick = () => { const v = prompt('Value for: ' + b.textContent.replace(/^Supply: /, '') + ' (an exact number)'); if (v == null) return; const r = forge.meaSupply(b.dataset.measu, b.dataset.meau, v.trim()); if (!r.ok) alert('Not supplied: ' + r.rule); delete meaCy[b.dataset.measu]; renderMem(); });
  $$('[data-meacm]').forEach(b => b.onclick = () => { const cy = meaCy[b.dataset.meacm]; if (!cy || !cy.resolution) return; if (!confirm('Commit this proposal (' + cy.resolution.claim_status.replace(/_/g, ' ') + ')? It is recorded with a receipt; later commits can withdraw its claims.')) return; const r = forge.meaCommit(b.dataset.meacm, cy.resolution.candidate_id, true); alert(r.ok ? 'Committed · ' + r.manifest.claim_status.replace(/_/g, ' ') + ' · archived ' + r.archived + ' · withdrawn ' + r.withdrawn : 'Not committed: ' + r.rule); delete meaCy[b.dataset.meacm]; renderMem(); });
  $$('[data-mea]').forEach(b => b.onclick = () => { if (!confirm('Adopt this manifest? It changes which relation properties the reasoner uses. You can withdraw it later.')) return; const r = forge.adoptManifest(b.dataset.mea, true); alert(r.ok ? 'Adopted · receipt ' + r.receipt.slice(0, 12) : 'Not adopted: ' + r.rule); renderMem(); });
  $$('[data-meawd]').forEach(b => b.onclick = () => { if (!confirm('Withdraw this manifest? The shipped rows return; conclusions that used it are withdrawn.')) return; const r = forge.withdrawManifest(b.dataset.meawd, true); alert(r.ok ? 'Withdrawn · ' + r.tms.withdrawn.length + ' ledger item(s) withdrawn' : 'Not withdrawn: ' + r.rule); renderMem(); });
  $$('[data-meak]').forEach(b => b.onclick = () => { if (!confirm('Adopt this grammar manifest? It changes which words fill a lexicon class, frame or open word category. You can withdraw it later.')) return; const r = forge.adoptManifestK(b.dataset.meak, true); alert(r.ok ? 'Adopted · receipt ' + r.receipt.slice(0, 12) + ' · requeued ' + (r.mea_requeue.length + r.meak_requeue.length) + ' archived item(s) as proposals' : 'Not adopted: ' + r.rule); renderMem(); });
  $$('[data-meakwd]').forEach(b => b.onclick = () => { if (!confirm('Withdraw this grammar manifest? The shipped tables return.')) return; const r = forge.withdrawManifestK(b.dataset.meakwd, true); alert(r.ok ? 'Withdrawn' : 'Not withdrawn: ' + r.rule); renderMem(); });
  $$('[data-meta]').forEach(b => b.onclick = () => { if (!confirm('Adopt these MEA settings? They change MEA\'s own budgets / schedule only. You can withdraw them later.')) return; const r = forge.adoptMetaK(b.dataset.meta, true); alert(r.ok ? 'Adopted · receipt ' + r.receipt.slice(0, 12) : 'Not adopted: ' + r.rule); renderMem(); });
  $$('[data-metawd]').forEach(b => b.onclick = () => { if (!confirm('Withdraw these MEA settings? The shipped settings return.')) return; const r = forge.withdrawMetaK(b.dataset.metawd, true); alert(r.ok ? 'Withdrawn' : 'Not withdrawn: ' + r.rule); renderMem(); });
  $$('[data-wfkeep]').forEach(b => b.onclick = () => { const r = forge.promoteWorking(b.dataset.wfkeep, true); alert(r.ok ? 'Remembered · read-back ' + r.readback.map(x => x.readback).join(', ') : 'Not remembered: ' + r.rule + (r.rule === 'MEM-CONTRADICTION-ASK-FIRST' ? ' (it contradicts a stored fact; restate it in the chat and answer the question)' : '')); renderMem(); });
  $$('[data-hyp]').forEach(b => b.onclick = () => { const r = forge.approveHypothesis(b.dataset.hyp, true); alert(r.ok ? (r.admitted ? 'Admitted rule ' + r.admitted + ' · proof replayed' : 'Kept as a hypothesis (not a fact)') : 'Not approved: ' + r.rule); renderMem(); });
  $$('[data-ideacommit]').forEach(b => b.onclick = () => { if (!confirm('Commit this idea record? It stays a hypothesis. It does not write memory, the world, or shared knowledge.')) return; const r = forge.commitIdea(b.getAttribute('data-ideacommit'), true); alert(r.ok ? 'Idea record committed. Nothing was written to memory.' : 'Not committed: ' + r.rule); renderMem(); });
  $$('[data-wd]').forEach(b => b.onclick = () => { if (!confirm('Withdraw this admitted rule? Answers that used it are listed as invalidated.')) return; const r = forge.withdrawRule(b.dataset.wd, true); alert(r.ok ? 'Withdrawn · ' + r.invalidated_proofs.length + ' answer proof(s) invalidated' : 'Not withdrawn: ' + r.rule); renderMem(); });
  $$('[data-dq]').forEach(b => b.onclick = () => { if (confirm('Archive this dream-quarantine entry? It stays in the export but leaves the active quarantine list.')) { forge.releaseDream(b.dataset.dq, true); renderMem(); } });
  const lpb = $('#loopPause'); if (lpb) lpb.onclick = () => { const c = forge.containment.current(); if (c.state === 'paused') forge.containment.resume(); else forge.containment.pause(); renderMem(); }; }
/* GELC: staged/held hypotheses with ONE approve tap; a rule hypothesis is admitted only if its proof replays (kernel admission gate) */
function ideaCard() { const rows = forge.creativeProposals ? forge.creativeProposals().filter(p => p.status === 'proposed') : [];
  const PILL = { projectable: '<span class="pill projectable">projectable</span>', contested: '<span class="pill contested">contested</span>', quarantine: '<span class="pill quarantine">quarantine</span>', hypothesis: '<span class="pill hypothesis">hypothesis</span>' };
  const pill = s => { const t = String(s || 'hypothesis').toLowerCase(); return PILL[/projectable|contested|quarantine|hypothesis/.test(t) ? t : 'hypothesis']; };
  const empty = '<div class="empty-state">none — try invent a hypothesis<div class="next-step" data-next-step>Say “remember that …” or compose that idea</div></div>';
  return '<div class="card"><div class="cardhead">Ideas (' + rows.length + ')</div><div class="small">A spoken idea is a hypothesis or a speculative branch. It is not a stored fact. A tap commits the idea record only when drift is projectable. Composing it, writing it out, or explaining it as a short paragraph develops that idea and keeps that status. It does not write memory, the world, or shared knowledge.</div>' + rows.slice(-8).map(p => '<div class="rec"><div>' + esc(p.claim || '—') + '</div><div class="meta">' + pill(p.claim_status || (p.drift && p.drift.band) || 'hypothesis') + ' ' + esc('N ' + (p.novelty && p.novelty.N != null ? p.novelty.N : 'unbound') + ' · ε_s ' + (p.drift && p.drift.eps_s != null ? p.drift.eps_s : '—') + ' · not a fact') + '</div>' + (p.drift && p.drift.band === 'projectable' ? '<button data-ideacommit="' + esc(p.id) + '">Commit idea record</button>' : '<div class="small">Not projectable. Speaking it does not store it.</div>') + '</div>').join('') + (rows.length ? '' : empty) + '</div>'; }
function hypCard() { const hs = forge.stagedHypotheses().concat(forge.hypotheses().filter(h => h.status === 'held' || h.status === 'quarantined')), ar = forge.admittedRules(), b = h => h.body && h.body.subject ? h.body.subject + ' → ' + h.body.relation + ' → ' + h.body.object : JSON.stringify(h.body);
  return '<div class="card"><div class="cardhead">Hypotheses (' + hs.length + ') · admitted rules (' + ar.length + ')</div>' + hs.slice(-20).map(h => '<div class="rec"><div>' + esc(b(h)) + '</div><div class="meta">' + esc(h.id + ' · ' + (h.status || 'staged') + ' · ε_s ' + (h.detail ? h.detail.eps_s : '—') + (h.detail && h.detail.rule ? ' · rule: ' + h.detail.rule.id : '') + ' · not a fact') + '</div><button data-hyp="' + esc(h.id) + '">' + (h.detail && h.detail.rule ? 'Approve → admit rule (proof-checked)' : 'Approve (keep as hypothesis)') + '</button></div>').join('') +
    ar.map(r => '<div class="rec"><div class="meta">' + esc(r.rule.id + ' · ' + r.status + ' · proof ' + String(r.proof_id).slice(0, 24) + ' · support ' + r.support.length + (r.invalidated_proofs ? ' · invalidated ' + r.invalidated_proofs.length : '')) + '</div>' + (r.status === 'admitted' ? '<button data-wd="' + esc(r.id) + '">Withdraw rule</button>' : '') + '</div>').join('') + (hs.length || ar.length ? '' : '<div class="meta">none — say “explore ideas”</div>') + '</div>'; }
function containmentHTML() { const c = forge.containment.list(), cold = forge.cold(), held = forge.heldWrites().filter(h => h.status === 'held'); const cur = forge.containment.current(); const rv = forge.containment.verifyReceipts();
  const card = (title, body) => '<div class="card"><div class="cardhead">' + title + '</div>' + body + '</div>';
  return card('Held writes awaiting approval (' + held.length + ') <span class="pill">D10: ' + esc(forge.perm.policy().memoryApproval) + '</span>', held.map(h => '<div class="rec"><div>' + esc(h.input) + '</div><div class="meta">' + esc(h.id + ' · ' + h.kind + ' · turn ' + h.turn) + '</div><button data-approve="' + esc(h.id) + '">Approve + commit</button><button data-reject="' + esc(h.id) + '">Reject</button></div>').join('') || '<div class="meta">none</div>') +
    card('Active loop · containment', '<div class="small">current ' + esc(cur.id) + ' — <b>' + esc(cur.state) + '</b> · loops ' + c.loops.length + ' · collapse events ' + c.collapse_events.length + ' · containment receipts ' + rv.count + ' (' + (rv.ok ? 'chain OK' : 'BROKEN') + ')</div><button id="loopPause">' + (cur.state === 'paused' ? 'Resume loop' : 'Pause loop') + '</button>' +
      '<details><summary>Loop lifecycle (' + c.loops.length + ')</summary>' + c.loops.slice(-20).reverse().map(l => '<div class="meta">' + esc(l.id + ': ' + l.transitions.map(t => t.to).join(' → ')) + '</div>').join('') + '</details>' +
      '<details><summary>Collapse events (' + c.collapse_events.length + ')</summary>' + c.collapse_events.slice(-20).reverse().map(e => '<div class="meta">' + esc(e.id + ' · ' + e.cause + ' · ' + e.loop + ' · snapshot ' + (e.snapshot.trace_hash || '').slice(0, 12)) + '</div>').join('') + '</details>') +
    hypCard() + ideaCard() +
    card('Dream quarantine (' + c.dream.length + ')', c.dream.slice(-20).reverse().map(d => '<div class="rec"><div>' + esc(d.clause ? KKernel.renderClause(d.clause) : (d.label || '—')) + '</div><div class="meta">' + esc(d.id + ' · ' + d.status + (d.label && !d.clause ? ' · simulation · counterfactual · not a fact' : '') + ' · never memory, never truth support') + '</div>' + (d.status === 'quarantined' ? '<button data-dq="' + esc(d.id) + '">Archive</button>' : '') + '</div>').join('') || '<div class="meta">empty</div>') +
    card('Ghost loops (' + c.ghost.length + ')', c.ghost.slice(-20).reverse().map(g => '<div class="rec"><div>' + esc(g.input) + '</div><div class="meta">' + esc(g.id + ' · ' + g.reason + ' · gate 7 (capacity) · ' + g.status) + '</div></div>').join('') || '<div class="meta">empty</div>') +
    card('Drift archive (' + c.drift.length + ')', c.drift.slice(-20).reverse().map(d => '<div class="meta">' + esc(d.id + ' · ε_s ' + d.eps_s + ' · ' + d.band + ' · diagnostic only') + '</div>').join('') || '<div class="meta">empty</div>') +
    card('Resurrection (7 gates) — software cold storage', '<div class="small">Software tier. Hardware SPC is not claimed. ChristPing is Gilligan-only on the always-on mesh, not this 7-gate screen. χ is the correction function only. A proposal stores nothing.</div>' + (cold.slice(-20).reverse().map(x => { const proposed = (forge.resurrectionProposals ? forge.resurrectionProposals() : []).some(p => p.id === x.id && p.status === 'proposed'); return '<div class="rec"><div class="meta">' + esc(x.id + ' · tier ' + forge.containment.tierOf(x, forge.perm.policy()) + ' · attempts ' + (x.resurrection_attempts || 0) + (x.status ? ' · ' + x.status : '')) + '</div><button data-gates="' + esc(x.id) + '">Check gates</button>' + (x.record ? '<button data-res="' + esc(x.id) + '">Resurrect</button>' : '') + (proposed ? '<button data-rscommit="' + esc(x.id) + '">Commit</button>' : '') + '<div class="small" id="gate-' + esc(x.id) + '"></div></div>'; }).join('') || '<div class="meta">empty</div>')); }
$('#refreshMem').onclick = renderMem;
$('#exportBtn').onclick = () => { const o = forge.exportJSON(true); if (!o) return; const blob = new Blob([JSON.stringify(o, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'forge-mobile-export.json'; a.click(); };
/* 4.9.215 (Release C4, Nic option B): the Dry-Run tab runs the Python engine (rmc_core through the same rmc_client/Pyodide path as
 * Ask) with dry_run: true. The engine measures stages 1–13 and skips 14–16 (output renderer, Echo validation of the spoken answer,
 * memory write), so nothing is spoken and nothing is written. This function reads the same memory Ask reads (askMemory) and writes
 * nothing: no forge store, no remember, no curation gap, no KB. The old JS pipeline (forge.process) it used to call is deleted. */
let dryRunBusy = false;
async function dryRun(text) {
  const sec = (title, body, attr) => '<div class="card"' + (attr || '') + '><div class="cardhead">' + title + '</div>' + body + '</div>';
  if (!window.KRMCCore || !KRMCCore.run) return sec('Dry-run unavailable', '<div class="small">The engine (rmc_client) is not loaded.</div>', ' data-dryrun="unavailable"');
  const memory = await askMemory(text);
  const row = await KRMCCore.run({ question: text, live: true, dry_run: true, memory: memory });
  if (!row || row.ok === false && !row.stages) return sec('Dry-run failed', '<div class="small">' + esc((row && (row.error || row.status)) || 'no result') + '</div>', ' data-dryrun="error"');
  const admit = row.admit || {}, echo = row.echo || {}, disp = admit.disposition || 'held';
  const stages = (row.stages || []).map(s => '<div class="meta" data-dr-stage="' + esc(s.n) + '" data-status="' + esc(s.status) + '">' + esc(s.n + '. ' + s.stage_id + ' · ' + s.status + (s.reason ? ' · ' + s.reason : '')) + '</div>').join('');
  const cand = echo.output_text || row.claim || '';
  const th = admit.thresholds || {}, yn = b => (b === true ? 'yes' : b === false ? 'no' : '—');
  return sec('Dry-run result · admit gate: ' + esc(disp), '<div data-dr-summary class="small">ε_s ' + esc(row.drift) + ' · C ' + esc(row.coherence) + ' (C_min ' + esc(th.C_min) + ', ' + (admit.coherence_ok ? 'pass' : 'fail') + ')'
      + ' · phase ' + (admit.phase_ok ? 'ok' : 'not ok') + ' · drift region ' + esc(admit.drift_region || '—') + (admit.drift_reason ? ' (' + esc(admit.drift_reason) + ')' : '')
      + ' · hard stop ' + yn(admit.hard_stop) + ' · route ' + esc(row.route) + ' · status ' + esc(row.status) + '</div>'
      + '<div class="small" data-dr-echo>Echo (dry-run, on the unrendered candidate; method ' + esc(echo.method || '—') + '): ' + esc(echo.score) + ' / min ' + esc(echo.min) + ' · ' + (echo.pass ? 'pass' : 'fail') + '</div>'
      + '<div class="small" data-dr-candidate>Candidate (not spoken): ' + (cand ? esc(cand) : '— none') + '</div>'
      + '<div class="small">Stages 14–16 (output renderer, Echo validation of the spoken answer, memory write) are skipped in a dry run, so nothing is spoken, remembered or written. Ask runs all 16. No web research is fetched here.</div>', ' data-dryrun="' + esc(disp) + '"')
    + sec('Engine stage trace (' + (row.stages || []).length + ' stages)', stages || '<div class="meta">no stages</div>')
    + sec('Full dry-run JSON', '<details><summary>show</summary><pre>' + esc(JSON.stringify(row, null, 1)) + '</pre></details>');
}
$('#drForm').onsubmit = async e => { e.preventDefault(); const v = $('#drIn').value.trim(); if (!v || dryRunBusy) return; dryRunBusy = true; $('#drOut').innerHTML = '<div class="meta">running the engine (dry-run)…</div>';
  try { $('#drOut').innerHTML = await dryRun(v); } catch (err) { $('#drOut').innerHTML = '<div class="card blocked"><div class="small">Dry-run failed: ' + esc(String(err && err.message || err)) + '</div></div>'; } finally { dryRunBusy = false; } };
$('#drReset').onclick = () => { $('#drIn').value = ''; $('#drOut').innerHTML = ''; };
window.dryRun = dryRun;
function renderLex() { const f = ($('#lexFilter').value || '').toLowerCase(); const all = forge.lexicon.all();
  const list = all.filter(c => !f || c.id.toLowerCase().includes(f) || c.surfaces.join(' ').includes(f) || c.senses[0].gloss.toLowerCase().includes(f)).slice(0, 80);
  const st = forge.lexicon.stats(); $('#lexCount').textContent = all.filter(c => !c.retired).length + ' controlled concepts · WordNet 3.0: ' + st.wordnet_core + ' core lemmas, ' + st.wordnet_extended + ' extended' + (st.wn_meta ? ' · ' + st.wn_meta['predicate_frames(verb sense × WN frame)'] + ' predicate frames' : '');
  const ws = f && /^[a-z'\-]+$/.test(f) ? forge.lexicon.senses(f) : []; $('#wnList').innerHTML = ws.length ? '<h3>WordNet senses of “' + esc(f) + '”</h3>' + ws.map(x => '<div class="rec"><span class="tag">' + esc(x.pos) + '</span><span class="tag">' + esc(x.lexname) + '</span><span class="tag">' + esc(x.doc8_state) + '</span><div>' + esc(x.gloss) + '</div><div class="meta">' + esc(x.sid + ' · ' + x.provenance + ' · ' + x.license) + '</div></div>').join('') : (f ? '<div class="meta">no WordNet entry for “' + esc(f) + '”</div>' : '');
  $('#lexList').innerHTML = list.map(c => '<div class="rec"><b>' + esc(c.surfaces.join(', ')) + '</b> <span class="tag">' + esc(c.category) + '</span><span class="tag">' + esc(c.status + ' v' + c.version) + '</span><div>' + esc(c.senses[0].gloss) + '</div><div class="meta">' + esc(c.id) + '</div></div>').join(''); }
$('#lexFilter').oninput = renderLex;
function renderAdm() { const q = forge.lexicon.admissions().slice(-12).reverse(); $('#admQueue').innerHTML = q.length ? '<h4>Admission records</h4>' + q.map(x => '<div class="rec"><b>' + esc(x.surface) + '</b> <span class="tag">' + esc(x.state) + '</span><span class="tag">' + esc(x.licence) + '</span><div class="meta">' + esc(x.evidence) + '</div><div class="meta">' + x.checks.map(c => (c.pass ? '✓ ' : '✗ ') + esc(c.rule)).join(' · ') + ' · sha256 ' + esc(x.content_sha256.slice(0, 12)) + '</div>' + (x.state === 'inspected' ? '<button type="button" data-adm-ok="' + esc(x.id) + '">Approve</button><button type="button" data-adm-no="' + esc(x.id) + '">Reject</button>' : '') + '</div>').join('') : ''; }
$('#addC').onsubmit = e => { e.preventDefault(); const r = forge.lexicon.proposeConcept({ surface: $('#cSurf').value, gloss: $('#cGloss').value, category: $('#cCat').value, example: $('#cEx').value, supersede: $('#cSup').checked, licence: $('#cLic').value, evidence: $('#cEvd').value });
  $('#cMsg').textContent = r.ok ? 'Inspected: approve it below to admit it.' : 'Not admitted: ' + r.reason; renderAdm(); };
$('#admQueue').onclick = e => { const ok = e.target.getAttribute('data-adm-ok'), no = e.target.getAttribute('data-adm-no'); if (ok) { const r = forge.lexicon.approveConcept(ok, true); $('#cMsg').textContent = r.ok ? 'Admitted ' + r.concept.id + ' v' + r.concept.version : 'Not admitted: ' + r.reason; renderLex(); } if (no) forge.lexicon.rejectConcept(no, 'user rejected'); renderAdm(); };
setTimeout(renderAdm, 0);
$('#mathDoc').innerHTML = '<div class="cardhead">Notation implemented</div><ul class="small"><li>Φ₁…Φ₉; Φ₅→Φ₈ forbidden (RMC Addendum §4). phase-scheme/rmc-rpmc/v1 is a reconstruction.</li><li>ε_s = (σ_res + D_score + |ΔΦ|)/ρ (drift-measure addendum-3/v1). drift-table nic-2026-10-14/v1: ≤0.35 project, χ correction 0.35–0.40, quarantine 0.40–0.80, hard stop above 0.80.</li><li>χ(t) is the correction function (chi-correction R-CHI-1/v1). ROC/CFBC/RSOC equivalence is SOURCE_NOT_VERIFIED.</li><li>An offline research harness refuses manuscript equivalence. Φ₁–Φ₉ is not proven cognition.</li></ul><label class="small"><input type="checkbox" id="phiToggle"> phase-locked notation</label>';
$('#phiToggle').checked = forge.meta().notation === 'phi'; $('#phiToggle').onchange = e => forge.setNotation(e.target.checked ? 'phi' : 'plain');
$('#gp014Doc').innerHTML = '<div class="cardhead">GP-014 expression lexicon <span class="pill">' + esc(KSpine.GP014.authority_class) + '</span></div><div class="small">' + KSpine.GP014.operator_roles.map(r => '<b>' + esc(r.glyph) + '</b> ' + esc(r.render_role)).join('<br>') + '<br><i>Applied to the derived reply; GP-014 phrase templates are not used.</i></div>';
function renderAudit() { const rs = forge.receipts(); const v = forge.verifyAudit(); const packets = forge.turnPackets();
  $('#auditHead').innerHTML = '<span class="sb"><b>receipts</b> ' + rs.length + '</span><span class="sb"><b>turn packets</b> ' + packets.length + '</span><span class="sb"><b>chain</b> <span class="' + (v.ok ? 'ok' : 'bad') + '">' + (v.ok ? 'VERIFIED' : 'BROKEN') + '</span></span><span class="sb"><b>head</b> ' + esc(v.head ? v.head.slice(-16) : '—') + '</span>';
  const cards = packets.slice(-60).reverse().map(p => KTurnPacket.receiptCard(p)).join('');
  const chain = rs.slice(-60).reverse().map(r => '<div class="card" data-doc7-cat="trace_receipt"><div class="small"><b>turn ' + esc(r.turn) + '</b> · ' + esc(fmt(r.at)) + ' · ' + esc(r.eligibility) + ' · ' + esc(r.echo) + ' · Trace/receipt · presence ≠ truth</div><div class="meta">' + esc(r.receipt_id) + '<br>input ' + esc(r.input_event) + '<br>msm ' + esc(r.msm_manifest) + (r.request_contract ? '<br>contract ' + esc(r.request_contract) : '') + '<br>prev ' + esc(r.previous_receipt || '—') + '</div></div>').join('');
  const panel = KTurnPacket.categoryPanel((() => { const load = c => forge.store.load(c); const v = forge.sharedKnowledgeView ? forge.sharedKnowledgeView() : { count: 0 }; load.host_shared_count = v.count || ((v.admitted || []).length); return load; })());
  const reqCard = window.KReqPacket ? KReqPacket.auditCard() : '';
  /* 4.9.215 (C4): turn packets and turn receipts were written only by the old JS answer path (deleted). Ask writes neither (4.9.209);
   * older rows already on this phone stay listed and the chain stays verifiable. The empty states say so; nothing is invented. */
  const noPackets = '<div class="meta" data-audit-empty="turn_packets">No turn packets. They were written by the old JS answer path, which was removed in 4.9.215. Ask records the engine\'s own stage trace on each answer (and the Dry-Run tab shows it); it does not write turn packets.</div>';
  const noReceipts = '<div class="meta" data-audit-empty="receipts">No turn receipts. The old JS answer path that wrote one receipt per turn was removed in 4.9.215, and Ask writes no receipts (4.9.209). Receipts already on this phone stay listed and verifiable.</div>';
  $('#auditList').innerHTML = reqCard + panel + (cards || noPackets) + (chain || noReceipts); }
$('#verifyAudit').onclick = () => { renderAudit(); openTab('audit'); }; $('#refreshAudit').onclick = renderAudit;
$('#pktVerify').onsubmit = e => { e.preventDefault(); let p; try { p = JSON.parse($('#pktIn').value); } catch (err) { $('#pktOut').textContent = 'That is not JSON.'; return; } const v = KTurnPacket.verify(p, { echo: (t, m, vk) => forge.kernel.echo(t, m, vk) }); $('#pktOut').innerHTML = '<b>' + (v.ok ? 'verified' : 'not verified') + '</b><br>' + v.checks.map(c => esc(c.id + ' ' + c.mode + ' ' + (c.ok == null ? 'recorded' : c.ok ? 'ok' : 'fail') + (c.detail ? ' — ' + c.detail : ''))).join('<br>'); };
function renderStatus() { setTimeout(() => window.renderOperator && window.renderOperator(), 0); const st = forge.lexicon.stats(), m = forge.meta(); const T = BUILD.tests || {};
  $('#statusBody').innerHTML = '<div class="card"><div class="cardhead">Build manifest</div><table>' + [['version', BUILD.version], ['built', BUILD.built], ['kernel', 'Language Core (RMC): deterministic grammar, no LLM'], ['ProtoForge layer', 'Audit / Receipts, the M2 ledger, containment. Foundation layer.'], ['Pattern Reflection', 'not Gilligan. Gilligan is the always-on cold curator. Neo is Ask. Neo is not Neil.'], ['Tool Bench', 'not EchoForge. Storage key echoforge stays.'], ['RMC Echo', 'exact reparse, not EchoForge.'], ['Math honesty', 'Offline research harness. Refuses manuscript equivalence. Nic bands unchanged. Φ1–Φ9 is not proven cognition.'], ['AI.Web layers', 'Foundation layer (ProtoForge disciplines) > Forge > Pattern Reflection (not Gilligan) > RMC Echo (not EchoForge) > Tool Bench (not EchoForge)'], ['contract spine', 'forge2 @262a95eb'], ['MSM', KSpine.MSM_IDS.schema_id + ' (' + KSpine.MSM_IDS.schema_version + ', reconstructed Doc 2 — file not recovered)'], ['request-state registry', KSpine.stateRegistryId()], ['tests', T.total ? (T.pass != null ? T.pass : T.passed) + '/' + T.total + ' passed' + (T.not_run ? ', ' + T.not_run + ' NOT_RUN' : '') + (T.fail ? ', ' + T.fail + ' failed' : '') + ' (' + Object.entries(T.suites || {}).map(([k, v]) => k + ' ' + v).join(', ') + ')' : 'run node verify/run.js']].map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') + '</table></div>' +
    '<div class="card"><div class="cardhead">Kernel state</div><table>' + [['turns', m.turn], ['loop λ', m.loop], ['χ flag', m.chi], ['last drift', m.last ? m.last.eps_s + ' (' + m.last.band + ')' : '—'], ['pending clarification', m.pending ? m.pending.type : 'none'], ['notation', m.notation || 'plain']].map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') + '</table></div>' +
    '<div class="card"><div class="cardhead">Lexicon (Doc 8 tiers)</div><table>' + [['controlled', st.controlled], ['user admitted', st.user_admitted], ['WordNet core', st.wordnet_core + ' (' + lexState.core + ')'], ['WordNet extended', st.wordnet_extended + ' (' + lexState.ext + ')'], ['licence', 'WordNet 3.0 License (Princeton)']].map(([k, v]) => '<tr><td>' + esc(k) + '</td><td>' + esc(v) + '</td></tr>').join('') + '</table></div>' +
    policyHTML() + registryHTML() +
    '<div class="card"><div class="cardhead">API contract / authority</div><div class="flags">' + AB(null) + '</div><div class="small">Service worker: ' + esc(navigator.serviceWorker && navigator.serviceWorker.controller ? 'active' : 'registering / not controlled yet') + ' · storage: ' + (backend ? 'localStorage' : 'memory only') + '</div></div>'; }
function guard() { return KClaims.Guard(window.KFEATURES || { features: [], suites: {} }); }
function registryHTML() { const g = guard(); const all = g.all(); const tot = g.totals(); const cls = st => (st === 'Implemented' ? 'ok' : st === 'Partial' ? 'warn' : 'bad');
  return '<div class="card"><div class="cardhead">Feature registry (claim guard) · ' + all.length + ' features</div><div class="small">' + Object.entries(tot).map(([k, v]) => esc(k) + ' ' + v).join(' · ') + ' — a status is shown only when its linked proof suites passed in this build’s verification run.</div><details><summary>show all</summary><table>' +
    all.map(c => '<tr><td>' + esc(c.id) + '</td><td>' + esc(c.name) + '</td><td><span class="pill ' + cls(c.status) + '">' + esc(c.status) + '</span></td><td class="meta">' + esc(c.proofs.map(p => p.suite + ' ' + p.pass + '/' + p.total).join(', ')) + '</td></tr>').join('') + '</table></details></div>'; }
function policyHTML() { const sw = forge.perm.switches, pol = forge.perm.policy();
  return '<div class="card"><div class="cardhead">Open decisions (switchable; defaults keep v4.0 behaviour)</div><table>' + Object.entries(sw).map(([k, s]) => '<tr><td>' + esc(s.decision + ' ' + k) + '</td><td><select data-pol="' + esc(k) + '">' + Object.entries(s.values).map(([v, o]) => '<option value="' + esc(v) + '"' + (pol[k] === v ? ' selected' : '') + (o.built ? '' : ' disabled') + '>' + esc(v + (o.built ? '' : ' (not built)')) + '</option>').join('') + '</select></td><td class="meta">' + esc(s.effect) + '</td></tr>').join('') + '</table></div>'; }
document.addEventListener('change', e => { const k = e.target && e.target.dataset && e.target.dataset.pol; if (!k) return; const d = forge.perm.setPolicy(k, e.target.value, true); if (d.decision !== 'allow') alert('Not changed: ' + d.rule); renderStatus(); });
function applyClaims() { const g = guard(); $$('[data-claim]').forEach(el => { const c = g.claim(el.dataset.claim); el.title = c.id + ' · ' + c.status + (c.proofs.length ? ' · proofs ' + c.proofs.map(p => p.suite + ' ' + p.pass + '/' + p.total).join(', ') : ''); if (el.classList.contains('ok') && !(c.proven && c.status === 'Implemented')) { el.classList.remove('ok'); el.classList.add('warn'); el.textContent = 'unproven'; } }); }
applyClaims();
renderLexiconPackets();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) { /* 4.9.48 update-on-reload: sw.js bypasses the HTTP cache, a newer worker activates at once (skipWaiting + clients.claim) and the page reloads once onto it; a build-info version check triggers the update */
  const hadCtl = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtl && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => { reg.update().catch(() => {});
    fetch('src/build-info.js', { cache: 'no-store' }).then(r => r.text()).then(t => { const m = t.match(/"commit":\s*"([0-9a-f]+)"/); if (m && window.FORGE_BUILD && m[1] !== window.FORGE_BUILD.commit) reg.update().catch(() => {}); }).catch(() => {}); }).catch(() => {}); }
let deferred; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
$('#installBtn').onclick = () => { if (deferred) { deferred.prompt(); deferred = null; $('#installBtn').hidden = true; } };
window.KUI = { $, $$, esc, fmt, openTab };
refreshChrome();
/* 4.9.206: fill or refresh the offline anchor copy from Supabase shortly after boot (no-op offline; never blocks the UI) */
if (window.KAnchorCache) setTimeout(() => { KAnchorCache.ensure().catch(() => {}); }, 4000);
/* 4.9.209: the curated shared facts too (read-only) */
if (window.KContribCache) setTimeout(() => { KContribCache.ensure().catch(() => {}); }, 5000);
window.KAskRemember = rememberAnswer;
})();
