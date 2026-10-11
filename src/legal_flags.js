/* legal_flags.js — DATA, not reply text: legal requirements for the opt-in data marketplace (see LEGAL_DATA_MARKETPLACE.md).
 * Each must be closed by the user with qualified counsel before any live transfer is built. Not legal advice. */
(function (root) {
  const isNode = typeof module !== 'undefined' && module.exports;
  /* legal requirement flags — each must be satisfied by a human/legal process before any live sale is ever built */
  const LEGAL = [
    { id: 'GDPR-6-7', law: 'GDPR Art. 6(1)(a), 7', req: 'freely given, specific, informed, unambiguous consent per purpose and per recipient; withdrawable as easily as given; consent records kept', status: 'plumbing: per-item, per-scope, per-buyer consent + revocation ledger' },
    { id: 'GDPR-9', law: 'GDPR Art. 9', req: 'explicit consent for special-category data (health, biometrics, beliefs, sex life, etc.)', status: 'open: no special-category classifier; sensitive vault secrets are never offerable' },
    { id: 'GDPR-13-14', law: 'GDPR Art. 13–14', req: 'notice: buyer identity, purposes, retention, rights, transfers', status: 'plumbing: buyer record fields; notice text not written' },
    { id: 'GDPR-15-17-20', law: 'GDPR Art. 15, 17, 20', req: 'access, erasure, portability (machine-readable export)', status: 'plumbing: export packages; erasure at buyer side cannot be enforced technically' },
    { id: 'GDPR-28-44', law: 'GDPR Art. 26/28, 44–49', req: 'controller/processor roles; international transfer safeguards (SCCs/adequacy)', status: 'open: buyer jurisdiction recorded only' },
    { id: 'GDPR-35', law: 'GDPR Art. 35', req: 'DPIA for large-scale or high-risk processing', status: 'open' },
    { id: 'CCPA-SALE', law: 'CCPA/CPRA §1798.140(ad), .120, .135', req: '“sale” includes any exchange for value; opt-out / limit-use rights; Do-Not-Sell signals (GPC) honoured', status: 'plumbing: nothing leaves without per-buyer opt-in; GPC respected by design (no sale)' },
    { id: 'CCPA-SPI', law: 'CPRA §1798.121', req: 'sensitive personal information: right to limit use', status: 'sensitive vault secrets excluded from offers' },
    { id: 'CCPA-MINORS', law: 'CCPA §1798.120(c); COPPA', req: 'opt-in for under-16 (parental consent under 13)', status: 'open: no age verification' },
    { id: 'DATA-BROKER', law: 'California Delete Act (SB 362), Vermont/Texas/Oregon broker laws', req: 'an intermediary that sells personal data of people it has no direct relationship with may need broker registration', status: 'open: depends on marketplace operator role' },
    { id: 'THIRD-PARTY', law: 'GDPR/CCPA (other people’s data) + copyright / site terms', req: 'crawled pages and captures contain third-party personal data and copyrighted text; the user cannot consent for others', status: 'enforced: captures are NOT offerable (user-originated data only)' },
    { id: 'CONSUMER-PROTECTION', law: 'FTC Act §5; EU UCPD; state UDAP', req: 'no dark patterns; honest description of what is sold, to whom, for what', status: 'plumbing: consent UI is per item and off by default' },
    { id: 'PAYMENTS-TAX', law: 'payments / money-transmission / tax reporting', req: 'any payout needs a licensed processor, KYC, and tax reporting', status: 'not built (payment hard-denied)' },
  ];
  const api = { LEGAL };
  if (isNode) module.exports = api; else root.KLegal = api;
})(typeof self !== 'undefined' ? self : this);
