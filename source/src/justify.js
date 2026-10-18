/* justify.js — justifications + truth maintenance (M2, 4.9.59). A justification-based TMS (Doyle 1979 JTMS) that keeps EVERY justification of an
 * item (the ATMS habit of de Kleer 1986: a conclusion with a surviving alternative justification stays). Items are the derived things Forge keeps
 * or carries across turns: answer conclusions, staged / approved hypotheses, admitted rules. A justification is data: the exact premise ids (with
 * the premise text as recorded), the rule ids, the selection record that produced it, and a replay recipe; its id is the sha256 of its canonical
 * content, so it replays deterministically. Status is the least fixpoint (well-founded: circular support never keeps an item IN): an item is IN
 * while at least one justification has every premise and rule IN. An item that loses its last justification is marked WITHDRAWN with a receipt
 * (append-only; nothing is deleted). Governed items (hypotheses, admitted rules) never come back on their own: they need a new approval. */
(function (root) {
'use strict';
const isNode = typeof module !== 'undefined' && module.exports;
const { sha256 } = isNode ? require('./sha256.js') : root.KSha;
const SCHEMA = 'FORGE-JUSTIFICATION/v1', ITEMS = 'justifications', RECEIPTS = 'withdrawal_receipts', GOVERNED = new Set(['hypothesis', 'rule']);
const canon = x => { if (x === undefined) return 'null'; if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']'; if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}'; return JSON.stringify(x); };
const norm = t => String(t || '').toLowerCase().replace(/[“”"’‘.,!?;:]/g, ' ').replace(/\b(?:a|an|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
/* the hashed body of a justification: what it rests on, never when it was recorded */
const body = (item, j) => ({ schema: SCHEMA, item, premises: j.premises.map(p => p.id).slice().sort(), rules: j.rules.slice().sort(), replay: j.replay || null });
const jid = (item, j) => 'jus:' + sha256(canon(body(item, j))).slice(0, 24);
const itemId = (kind, key) => ({ conclusion: 'concl:', hypothesis: '', rule: '' }[kind] || 'item:') + (kind === 'conclusion' ? sha256(canon(key)).slice(0, 20) : key);
function Ledger(store, opts) { opts = opts || {}; const clock = opts.clock || (() => new Date().toISOString());
  const items = () => store.load(ITEMS) || [], save = xs => store.save(ITEMS, xs);
  /* add an item (if new) and a justification (if new for it); returns { item, jid, added } */
  function justify(spec, j) { const xs = items(); let it = xs.find(x => x.id === spec.id);
    if (!it) { it = { schema: SCHEMA, id: spec.id, kind: spec.kind, text: spec.text, key: spec.key || null, status: 'in', created_at: clock(), turn: spec.turn == null ? null : spec.turn, justifications: [], history: [] }; if (spec.external) it.external = true; xs.push(it); }
    const J = { id: jid(it.id, j), premises: j.premises.map(p => ({ id: p.id, text: p.text == null ? null : String(p.text) })), rules: j.rules.slice(), derivation_rules: (j.derivation_rules || []).slice(0, 32), selection: j.selection || null, replay: j.replay || null, at: clock(), turn: j.turn == null ? null : j.turn };
    const added = !it.justifications.some(x => x.id === J.id); if (added) it.justifications.push(J); save(xs); return { item: it, jid: J.id, added }; }
  /* least-fixpoint status; isIn(id) answers for ids outside the ledger: { in, status, why } */
  function propagate(isIn, cause) { const xs = items(), byId = new Map(xs.map(x => [x.id, x])), IN = new Set(), ext = new Map();
    const extIn = id => { if (!ext.has(id)) ext.set(id, isIn(id) || { in: true }); return ext.get(id); };
    const ok = id => byId.has(id) ? IN.has(id) : extIn(id).in;
    const pinned = x => GOVERNED.has(x.kind) && x.status === 'withdrawn';
    for (let changed = true; changed;) { changed = false; for (const x of xs) if (!IN.has(x.id) && !pinned(x) && (!x.external || extIn(x.id).in) && x.justifications.some(j => j.premises.every(p => ok(p.id)) && j.rules.every(ok))) { IN.add(x.id); changed = true; } }
    const at = clock(), out = [], back = [], receipts = store.load(RECEIPTS) || [];
    for (const x of xs) { const now = IN.has(x.id) ? 'in' : 'withdrawn'; if (now === x.status) continue; if (now === 'in' && GOVERNED.has(x.kind)) continue;
      const lost = x.justifications.map(j => ({ jid: j.id, out: j.premises.map(p => p.id).concat(j.rules).filter(id => !ok(id)).map(id => byId.has(id) ? { id, status: 'withdrawn', item: true, text: byId.get(id).text } : Object.assign({ id }, extIn(id), { text: (j.premises.find(p => p.id === id) || {}).text || null })) }));
      const r = { id: null, schema: 'FORGE-WITHDRAWAL-RECEIPT/v1', transition: now === 'in' ? 'reinstated' : 'withdrawn', item: x.id, kind: x.kind, text: x.text, at, cause: cause || null, justifications: lost, alternatives_checked: x.justifications.length };
      r.id = 'wd:' + sha256(canon(Object.assign({}, r, { id: undefined }))).slice(0, 24); receipts.push(r); x.status = now; x.history.push({ at, status: now, receipt: r.id }); (now === 'in' ? back : out).push(x); }
    if (out.length || back.length) { save(xs); store.save(RECEIPTS, receipts); }
    return { withdrawn: out.map(x => ({ id: x.id, kind: x.kind, text: x.text })), reinstated: back.map(x => ({ id: x.id, kind: x.kind, text: x.text })), receipts: receipts.slice(receipts.length - out.length - back.length) }; }
  /* deterministic replay: every justification's id re-derives from its content; the caller re-runs its recipe (world re-derivation) */
  function replay(id, rederive) { const it = items().find(x => x.id === id); if (!it) return { ok: false, rule: 'JUST-UNKNOWN' };
    const js = it.justifications.map(j => { const hash_ok = jid(it.id, j) === j.id; const re = rederive ? rederive(j, it) : undefined; return { id: j.id, hash_ok, rederived: re === undefined ? null : !!re }; });
    return { ok: js.length > 0 && js.every(j => j.hash_ok && j.rederived !== false), item: it.id, status: it.status, justifications: js }; }
  const get = id => items().find(x => x.id === id) || null;
  const findByText = t => { const k = norm(t); return items().filter(x => norm(x.text) === k); };
  return { justify, propagate, replay, get, findByText, list: items, receipts: () => store.load(RECEIPTS) || [] }; }
const api = { SCHEMA, ITEMS, RECEIPTS, GOVERNED, Ledger, jid, itemId, canon, norm };
if (isNode) module.exports = api; else root.KJustify = api;
})(this);
