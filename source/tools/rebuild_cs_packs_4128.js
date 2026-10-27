#!/usr/bin/env node
/** Rebuild hosted confirmed_shared A–Z from thickened drafts; items = kernel-admitted only. */
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const SRC = path.join(REPO, 'source');
const DRAFT = process.env.DRAFT_DIR || '/workspace/kernel-papers/oct25/confirmed_shared_packs';
const OUT = path.join(SRC, 'packs/confirmed_shared');
const VERSION = '4.9.128';
const SCHEMA = 'FORGE-CONFIRMED-PACK/v1';
const IDX_SCHEMA = 'FORGE-CONFIRMED-SHARED-INDEX/v1';

const KMOD = require(path.join(SRC, 'src/kernel.js'));
const LEX = require(path.join(SRC, 'data/lexicon.json'));
const EXT = require(path.join(SRC, 'data/lexicon-ext.json'));

const ADMIT_ST = { confirmed: 1, projectable: 1 };
const HOLD_ST = { contested: 1, quarantine: 1 };

function standingOf(f) {
  const h = String(f.honesty || '').toLowerCase();
  const st = String(f.claim_status || f.standing || '').toLowerCase();
  if (ADMIT_ST[h] || HOLD_ST[h]) return h;
  if (ADMIT_ST[st] || HOLD_ST[st]) return st;
  return 'projectable';
}

function toHostedText(claim) {
  let t = String(claim || '').trim();
  if (t.endsWith('.')) t = t.slice(0, -1);
  return t;
}

function evidenceOf(f) {
  return [f.category || 'general', 'product curator', f.headword || '', f.id || ''].filter(Boolean).join(' · ');
}

function mk() {
  return KMOD.Kernel({ lexicon: LEX, lexiconExt: EXT, clock: () => '2026-10-27T22:00:00Z' });
}

/** Return Set of original item ids that admit (reparse has verb, no coord). */
function admittedIds(items, letter) {
  const k = mk();
  const pack = {
    schema: SCHEMA,
    format: SCHEMA,
    pack_id: 'confirmed_shared_letter_' + letter,
    provenance: 'confirmed_shared',
    letter: letter.toUpperCase(),
    who_confirmed: 'product_curator',
    shared_kb: false,
    curated_facts: items.length,
    items
  };
  const r = k.admitConfirmedShared(JSON.stringify(pack), { productCurator: true });
  if (!r || !r.ok) {
    // all unparsed / refused
    const reason = (r && r.receipt && r.receipt.reason) || (r && r.rule) || 'refused';
    return { ids: new Set(), reason, skipped: items.length, admitted: 0, receipt: r && r.receipt };
  }
  // Match admitted rows back to items by normalized text
  const admittedTexts = new Set();
  const view = k.confirmedSharedView();
  for (const row of view.admitted || []) {
    const t = String(row.text || row.claim || '').replace(/\.$/, '').trim().toLowerCase();
    if (t) admittedTexts.add(t);
  }
  // Also use receipt admitted if it carries text
  for (const row of (r.receipt && r.receipt.admitted) || []) {
    const t = String(row.text || row.claim || '').replace(/\.$/, '').trim().toLowerCase();
    if (t) admittedTexts.add(t);
  }
  const ids = new Set();
  for (const it of items) {
    const t = String(it.text || '').replace(/\.$/, '').trim().toLowerCase();
    if (admittedTexts.has(t)) ids.add(it.id);
  }
  // Fallback: if view count matches but ids empty, keep by order from receipt length via re-filter with reparseClause
  if (ids.size === 0 && (view.admitted || []).length) {
    // parseRenderedClause per item
    for (const it of items) {
      let clause = null;
      try { clause = k.reparseClause(it.text); } catch (e) { clause = null; }
      if (clause && clause.verb && !clause.coord) ids.add(it.id);
    }
  }
  return { ids, admitted: ids.size, skipped: items.length - ids.size, receipt: r.receipt };
}

function reparseFilter(items) {
  const k = mk();
  const ids = new Set();
  const skipped = [];
  for (const it of items) {
    let clause = null;
    try { clause = k.reparseClause(it.text); } catch (e) { clause = null; }
    if (clause && clause.verb && !clause.coord) ids.add(it.id);
    else skipped.push({ id: it.id, text: it.text, has: !!clause, verb: !!(clause && clause.verb), coord: !!(clause && clause.coord) });
  }
  return { ids, skipped };
}

const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
const packs = {};
let totalItems = 0, totalCurated = 0;
const skipAll = [];

// Probe API
const probe = mk();
console.error('has parseRenderedClause', typeof probe.parseRenderedClause);
console.error('has reparseClause', typeof probe.reparseClause);
console.error('has judgeConfirmedShared', typeof probe.judgeConfirmedShared);
const sample = probe.parseRenderedClause && probe.parseRenderedClause('Africa is a continent');
console.error('sample parse', sample && { verb: !!sample.verb, coord: !!sample.coord, keys: Object.keys(sample).slice(0, 12) });

for (const L of letters) {
  const draft = JSON.parse(fs.readFileSync(path.join(DRAFT, 'letter_' + L + '.json'), 'utf8'));
  const facts = draft.facts || [];
  const candidates = facts.map(f => ({
    id: f.id,
    text: toHostedText(f.claim),
    standing: standingOf(f),
    evidence: evidenceOf(f)
  }));
  const { ids, skipped } = reparseFilter(candidates);
  const items = candidates.filter(it => ids.has(it.id));
  for (const s of skipped) skipAll.push(Object.assign({ letter: L }, s));
  const curated = facts.length;
  const pack = {
    schema: SCHEMA,
    format: SCHEMA,
    pack_id: 'confirmed_shared_letter_' + L,
    provenance: 'confirmed_shared',
    letter: L.toUpperCase(),
    who_confirmed: 'product_curator',
    shared_kb: false,
    curated_facts: curated,
    items
  };
  fs.writeFileSync(path.join(OUT, L + '.json'), JSON.stringify(pack, null, 1) + '\n');
  packs[L] = { path: L + '.json', letter: L.toUpperCase(), items: items.length, curated_facts: curated };
  totalItems += items.length;
  totalCurated += curated;
  console.error(L, 'curated', curated, 'items', items.length, 'skipped', skipped.length);
}

const index = {
  schema: IDX_SCHEMA,
  provenance: 'confirmed_shared',
  who_confirmed: 'product_curator',
  version: VERSION,
  letters,
  packs,
  total_items: totalItems,
  total_curated: totalCurated
};
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
fs.writeFileSync('/tmp/cs4128_skip_log.json', JSON.stringify(skipAll, null, 1));
console.log(JSON.stringify({ version: VERSION, total_items: totalItems, total_curated: totalCurated, skipped: skipAll.length }, null, 2));
