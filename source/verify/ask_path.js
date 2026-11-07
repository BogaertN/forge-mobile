/* Production Ask entry for verifiers. Same stages as src/app.js say(), without the DOM.
 * A question is compiled by src/qframe.js, sent through src/rmc_client.js to rmc_engine_v1,
 * then outward-compiled by src/rmc_core.js. Explicit remember stores a kāraka clause on the
 * session phone list only. Ask does not append to that list and does not write Supabase.
 * The memory is the page's: phone rows plus the shipped confirmed_shared packs and the starter
 * anchors. An empty pool would hide a hold that only shows up once those rows are present.
 * Kernel.process is not called. No model. */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const K = require(ROOT + '/src/kernel.js');
const FK = require(ROOT + '/src/forge.js');
const Q = require(ROOT + '/src/qframe.js');
const R = require(ROOT + '/src/rmc_client.js');
const Core = require(ROOT + '/src/rmc_core.js');
const Priv = require(ROOT + '/src/privacy.js');
const WR = require(ROOT + '/src/world_rules.js');
const LEX = require(ROOT + '/data/lexicon.json');
const EXT = require(ROOT + '/data/lexicon-ext.json');
const REMEMBER = /^\s*(?:please\s+)?remember\s+(?:that\s+)?(\S.*?)\s*[.!]?\s*$/i;
let forge = null;
function kernel() { return forge || (forge = FK.ForgeKernel({ store: K.MemoryStore(), lexicon: LEX, lexiconExt: EXT, clock: () => '2026-11-07T00:00:00Z' })); }
function session() { return { phone: [] }; }
function copulaClash(rows, clause) {
  const c = clause;
  if (!c || !c.parsed || !c.kriya || !c.kartr || !c.pred) return false;
  const subj = String(c.kartr.text || '').toLowerCase();
  const pred = String((c.pred.np && c.pred.np.text) || c.pred.text || '').toLowerCase();
  if (!subj || !pred || c.pred.type === 'cmp' || c.pred.type === 'pp' || c.pred.type === 'measure') return false;
  return rows.some(r => {
    const o = r && r.clause;
    if (!o || !o.parsed || !o.kartr || !o.pred) return false;
    const os = String(o.kartr.text || '').toLowerCase();
    const op = String((o.pred.np && o.pred.np.text) || o.pred.text || '').toLowerCase();
    return os === subj && op && op !== pred && o.pred.type !== 'cmp' && o.pred.type !== 'pp';
  });
}
function stageHold(f, row, rule) {
  const hw = f.store.load('held_writes');
  const id = 'held:' + row.id;
  if (!hw.some(x => x.id === id && x.status === 'held')) hw.push({ id, status: 'held', kind: 'phone_statement', text: row.text, clause: row.clause, input: row.text, sensitive: !!row.sensitive, perm_rule: rule, at: '2026-11-07T00:00:00Z' });
  f.store.save('held_writes', hw);
  return id;
}
/* Explicit Remember is the only statement write. The permission service decides it. A secret is stored only as the redacted sentence. */
function remember(s, text, kernelOpt) {
  const m = String(text).match(REMEMBER);
  const said = m ? m[1].trim() : '';
  if (!said) return { ok: false, rule: 'REMEMBER-EMPTY' };
  if (/\?$/.test(said) || /^(?:what|who|whom|whose|which|when|where|why|how|is|are|was|were|do|does|did|can|could|will|would|should)\b/i.test(said)) return { ok: false, rule: 'REMEMBER-NOT-A-STATEMENT' };
  const f = kernelOpt || kernel();
  const red = Priv.redact(said);
  const sensitive = red.secrets.length > 0;
  if (sensitive && f.perm.policy().memoryApproval !== 'contested_or_sensitive') {
    f.perm.authorize('memory.write', { explicit: true, userTap: true, sensitive: true, subject: 'sealed value' });
    return { ok: false, held: false, sealing: false, rule: 'PRIV-SECRET-NOT-KEPT', permission: null, reply: null };
  }
  const body = sensitive ? red.text : said;
  const sentence = body.charAt(0).toUpperCase() + body.slice(1) + (/[.!]$/.test(body) ? '' : '.');
  const clause = Q.clause(sentence, f);
  const contested = copulaClash(s.phone, clause);
  const d = f.perm.authorize('memory.write', { explicit: true, userTap: true, sensitive, contested, subject: sentence });
  const row = { id: 'rem-' + s.phone.length, text: sentence, clause, tier: 'phone', trust: 'trusted', scope: 'phone', sensitive, provenance: { requested_by: 'user', request: 'remember_command', kind: 'statement', actor: 'user' } };
  if (d.decision === 'needs_approval') {
    const id = stageHold(f, row, d.rule);
    return { ok: false, held: true, sealing: false, rule: d.rule, permission: d, held_id: id, reply: 'Held for approval: ' + sentence + ' Nothing was stored.', text: sentence };
  }
  if (d.decision !== 'allow') return { ok: false, held: false, sealing: false, rule: d.rule, permission: d, reply: null, text: sentence };
  s.phone.push(row);
  if (kernelOpt) {
    const mem = f.store.load('memory');
    mem.push({ id: row.id, kind: 'statement', text: row.text, clause: row.clause, status: 'active', sensitive, provenance: row.provenance });
    f.store.save('memory', mem);
  }
  return { ok: true, held: false, sealing: false, rule: 'REMEMBER-BY-USER-REQUEST', permission: d, text: sentence, clause };
}
function confirmHeld(kernelOpt) {
  const f = kernelOpt || kernel();
  const held = (f.heldWrites() || []).filter(h => h.status === 'held');
  if (!held.length) return { ok: false, held: false, rule: 'HELD-UNKNOWN', reply: null };
  return { ok: false, held: true, sealing: false, rule: held[held.length - 1].perm_rule, reply: 'Held for approval. The kept fact was not replaced.' };
}
let POOLS = null;
function productionPools() {
  if (POOLS) return POOLS;
  const dir = path.join(ROOT, 'packs', 'confirmed_shared');
  const idx = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const shared = [];
  for (const L of idx.letters || []) {
    const pack = JSON.parse(fs.readFileSync(path.join(dir, L + '.json'), 'utf8'));
    for (const item of pack.items || []) {
      if (item && item.id && item.text) shared.push({ id: item.id, text: String(item.text).slice(0, 400), tier: 'confirmed_shared', contributor: 'product_curator', sfe: item.sfe || null });
    }
  }
  const anchors = [];
  try {
    const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'anchors_187.json'), 'utf8'));
    for (const row of pack.anchors || []) {
      if (row && row.id && row.text) anchors.push({ id: row.id, text: row.text, sfe: row.sfe, packet: row.packet, tier: 'anchor', state: 'anchor', trust: 'trusted', provenance: row.provenance, contributor: row.contributor });
    }
  } catch (e) { /* starter pack absent: the shared pool still goes */ }
  POOLS = { shared, anchors };
  return POOLS;
}
function ask(s, question, extra) {
  extra = extra && typeof extra === 'object' ? extra : {};
  const f = kernel();
  const frame = Q.compile(question, f);
  if (!extra._whyReplay && Core.bareWhy(frame)) {
    const prior = s.prior;
    const beforeWhy = s.phone.length;
    if (!prior || prior.rejected || !prior.question) return Core.whyHold('no_admitted_derivation');
    const fresh = ask(s, prior.question, Object.assign({}, extra, { _whyReplay: true }));
    if (s.phone.length !== beforeWhy) throw new Error('why appended phone memory');
    if (!Core.sameWhy(prior, fresh)) { s.prior = null; return Core.whyHold('stale_derivation'); }
    fresh.followup = { kind: 'why', of: prior.question, how: prior.how };
    return fresh;
  }
  const before = s.phone.length;
  const prod = extra.isolated === true ? { shared: [], anchors: [] } : productionPools();
  const pools = [{ name: 'confirmed_shared', into: 'hosted', rows: prod.shared.concat(extra.sharedRows || []) }];
  if (extra.anchorRows && extra.anchorRows.length) pools.unshift({ name: 'anchors', into: 'anchors', rows: extra.anchorRows });
  const flag = (pred) => { const info = WR.relInfo(pred); return !!(info && info.row && info.row.transitive); };
  const memory = { receipts: [], phone: s.phone.slice(), hosted: [], anchors: extra.anchors || prod.anchors, research: [], self: [], pools, relation_overlay: { next_to_transitive: flag('next_to'), before_transitive: flag('before'), after_transitive: flag('after'), above_transitive: flag('above'), below_transitive: flag('below') } };
  const payload = Core.withClauses({ question, frame, live: true, dry_run: false, memory }, Q, f);
  let row = R.askSync(payload);
  row = Core.outwardCompile(row, payload, f, null);
  if (s.phone.length !== before) throw new Error('ask appended phone memory');
  if (!extra._whyReplay) {
    const snap = Core.whySnapshot(row, question);
    s.prior = snap && !snap.rejected ? snap : null;
  }
  return row;
}
function askStored(question) {
  const WF = require(ROOT + '/src/world_facts.js');
  const s = session();
  s.phone = WF.rows().filter(r => r && r.text).map(r => ({ id: r.id, text: r.text, clause: r.clause, tier: 'phone', trust: 'trusted', scope: 'phone', provenance: r.provenance }));
  const n = WF.rows().length;
  const row = ask(s, question);
  if (WF.rows().length !== n) throw new Error('ask stored a fact');
  return row;
}
module.exports = { session, remember, confirmHeld, ask, askStored, kernel, productionPools };
