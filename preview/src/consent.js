/* consent.js — user-owned, opt-in data-marketplace PLUMBING (no sale, no transfer, no payment).
 * Consent scopes mirror forge contribution_economy_v1 Patch 300 ConsentScopeReferenceContract (attribution, storage, public_display,
 * portability, economic_processing) and add per-buyer offers, append-only revocation, and local export packages.
 * Every live transfer / sale / payment action is hard-denied by the permission service.  Legal obligations: LEGAL_DATA_MARKETPLACE.md. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  const Gv = isNode ? require('./governance.js') : root.KGov; const sha256 = isNode ? require('./sha256.js').sha256 : root.KSha.sha256;
  const SCOPES = ['storage', 'attribution', 'public_display', 'portability', 'economic_processing'];
  const DEFAULT = { storage: 'authorized', attribution: 'not_authorized', public_display: 'not_authorized', portability: 'not_authorized', economic_processing: 'not_authorized' };
  const LEGAL = isNode ? require('./legal_flags.js').LEGAL : root.KLegal.LEGAL; /* data table (not reply text) kept in legal_flags.js */
  function Consent(store, opts) {
    opts = opts || {}; const now = () => (opts.clock ? opts.clock() : new Date().toISOString()); const perm = opts.perm; const vault = opts.vault;
    const L = c => { const v = store.load(c); return Array.isArray(v) ? v : []; };
    function ledger(kind, body) { const l = L('consent_ledger'); const prev = l.length ? l[l.length - 1].hash : null; const e = { seq: l.length + 1, kind, at: now(), body, prev }; e.hash = sha256(Gv.canon(e)); l.push(e); store.save('consent_ledger', l); return e; }
    const auth = (action, ctx) => perm.authorize(action, ctx || {});
    const items = () => (vault ? vault.entries().filter(e => e.kind && e.kind !== 'secret') : []);
    const itemKind = id => { const e = (vault ? vault.entries() : []).find(x => x.id === id); return e ? e.kind || 'secret' : null; };
    const offerable = id => { const k = itemKind(id); return k && k !== 'secret' && k !== 'capture' && k !== 'research'; }; /* user-originated data only (THIRD-PARTY rule) */
    function get(id) { const c = L('consent').find(x => x.item === id); return Object.assign({}, DEFAULT, c ? c.scopes : {}); }
    function set(id, scope, value, userTap) {
      if (!SCOPES.includes(scope) || !['authorized', 'not_authorized'].includes(value)) return { ok: false, rule: 'CONSENT-UNKNOWN-SCOPE' };
      if (!itemKind(id)) return { ok: false, rule: 'CONSENT-UNKNOWN-ITEM' };
      if (value === 'authorized' && scope === 'economic_processing' && !offerable(id)) return { ok: false, rule: 'CONSENT-THIRD-PARTY-OR-SECRET-NOT-OFFERABLE' };
      const d = auth('consent.change', { userTap, subject: id }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
      const cs = L('consent'); let c = cs.find(x => x.item === id); if (!c) { c = { item: id, scopes: {} }; cs.push(c); } c.scopes[scope] = value; c.updated = now(); store.save('consent', cs);
      const e = ledger(value === 'authorized' ? 'consent.grant' : 'consent.withdraw', { item: id, scope, value, permission: d.id });
      if (value === 'not_authorized' && (scope === 'economic_processing' || scope === 'portability')) revokeOffers(id, 'consent withdrawn: ' + scope);
      return { ok: true, receipt: e.hash }; }
    function addBuyer(b, userTap) {
      const d = auth('buyer.record', { userTap, subject: b && b.name }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
      if (!b || !b.name || !b.purpose || !b.jurisdiction) return { ok: false, rule: 'BUYER-FIELDS-REQUIRED (name, purpose, jurisdiction)' };
      const rec = { id: 'buyer:' + sha256(b.name + '|' + now()).slice(0, 12), name: String(b.name).slice(0, 120), purpose: String(b.purpose).slice(0, 400), jurisdiction: String(b.jurisdiction).slice(0, 40), contact: String(b.contact || '').slice(0, 200), retention: String(b.retention || 'unspecified'), recorded: now(), status: 'recorded_only_no_transfer' };
      const bs = L('buyers'); bs.push(rec); store.save('buyers', bs); ledger('buyer.record', { buyer: rec.id }); return { ok: true, buyer: rec }; }
    function offer(id, buyerId, userTap) {
      if (!offerable(id)) return { ok: false, rule: 'CONSENT-THIRD-PARTY-OR-SECRET-NOT-OFFERABLE' };
      const c = get(id); if (c.economic_processing !== 'authorized' || c.portability !== 'authorized') return { ok: false, rule: 'OFFER-NEEDS-ECONOMIC-AND-PORTABILITY-CONSENT' };
      if (!L('buyers').some(b => b.id === buyerId)) return { ok: false, rule: 'OFFER-UNKNOWN-BUYER' };
      const d = auth('offer.draft', { userTap, subject: id + '→' + buyerId }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
      const os = L('offers'); const o = { id: 'offer:' + sha256(id + buyerId + now()).slice(0, 12), item: id, buyer: buyerId, scopes: ['economic_processing', 'portability'], status: 'draft_no_transfer', price: null, created: now() }; os.push(o); store.save('offers', os);
      ledger('offer.draft', { offer: o.id, item: id, buyer: buyerId }); return { ok: true, offer: o }; }
    function revokeOffers(id, why) { const os = L('offers'); let n = 0; for (const o of os) if (o.item === id && o.status !== 'revoked') { o.status = 'revoked'; o.revoked = now(); n++; ledger('offer.revoke', { offer: o.id, why }); }
      store.save('offers', os); const ps = L('export_packages'); for (const p of ps) if (p.items.includes(id) && p.status === 'local_only_no_transfer') { p.status = 'superseded_by_revocation'; ledger('package.supersede', { package: p.id, item: id }); } store.save('export_packages', ps); return n; }
    function revoke(offerId, userTap) { const d = auth('consent.change', { userTap, subject: offerId }); if (d.decision !== 'allow') return { ok: false, rule: d.rule }; const o = L('offers').find(x => x.id === offerId); if (!o) return { ok: false, rule: 'OFFER-UNKNOWN' }; set(o.item, 'economic_processing', 'not_authorized', userTap); return { ok: true }; }
    /* export package: a LOCAL, encrypted, manifest-hashed bundle of the consented items for one buyer; transfer is disabled */
    async function buildPackage(buyerId, userTap) {
      const d = auth('package.build', { userTap, subject: buyerId }); if (d.decision !== 'allow') return { ok: false, rule: d.rule };
      if (!vault || vault.status() !== 'unlocked') return { ok: false, rule: 'PERM-VAULT-LOCKED' };
      const os = L('offers').filter(o => o.buyer === buyerId && o.status === 'draft_no_transfer' && get(o.item).economic_processing === 'authorized' && get(o.item).portability === 'authorized');
      if (!os.length) return { ok: false, rule: 'PACKAGE-NOTHING-CONSENTED' };
      const data = []; for (const o of os) data.push({ item: o.item, kind: itemKind(o.item), value: await vault.reveal(o.item), consent: get(o.item) });
      const manifest = { format: 'forge-mobile-data-package-v1', buyer: buyerId, items: os.map(o => o.item), offers: os.map(o => o.id), data_sha256: sha256(Gv.canon(data)), consent_ledger_head: (L('consent_ledger').slice(-1)[0] || {}).hash || null, legal_flags_open: LEGAL.filter(l => /^open/.test(l.status)).map(l => l.id), transfer: 'disabled', payment: 'disabled' };
      const box = await vault.encryptBlob(JSON.stringify({ manifest, data }));
      const p = { id: 'pkg:' + sha256(Gv.canon(manifest)).slice(0, 16), buyer: buyerId, items: manifest.items, manifest, manifest_sha256: sha256(Gv.canon(manifest)), created: now(), status: 'local_only_no_transfer', box };
      const ps = L('export_packages'); ps.push(p); store.save('export_packages', ps); ledger('package.build', { package: p.id, manifest_sha256: p.manifest_sha256 }); return { ok: true, package: p }; }
    const transfer = (pkgId) => { const d = auth('sale.transfer', { subject: pkgId }); return { ok: false, rule: d.rule }; };
    const pay = (pkgId) => { const d = auth('payment', { subject: pkgId }); return { ok: false, rule: d.rule }; };
    function verify() { const l = L('consent_ledger'); let prev = null; for (let i = 0; i < l.length; i++) { const e = Object.assign({}, l[i]); const h = e.hash; delete e.hash; if (e.prev !== prev || sha256(Gv.canon(e)) !== h) return { ok: false, broken_at: i }; prev = h; } return { ok: true, count: l.length }; }
    return { get, set, addBuyer, offer, revoke, revokeOffers, buildPackage, transfer, pay, verify, items, offerable, buyers: () => L('buyers'), offers: () => L('offers'), packages: () => L('export_packages'), ledger: () => L('consent_ledger'), SCOPES, LEGAL };
  }
  const api = { Consent, SCOPES, DEFAULT, LEGAL };
  if (isNode) module.exports = api; else root.KConsent = api;
})(typeof self !== 'undefined' ? self : this);
