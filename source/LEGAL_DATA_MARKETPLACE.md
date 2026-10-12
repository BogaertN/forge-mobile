# Data marketplace — legal requirements (flags, not legal advice)

Status: **plumbing only**. The pieces are:
- per-item consent scopes
- buyer records
- draft offers
- append-only revocation
- encrypted local export packages

Live sale, transfer and payment are **not built**. The permission service hard-denies `sale.transfer` and `payment` with `PERM-MARKETPLACE-TRANSFER-NOT-BUILT`.

Each flag below must be closed by the user with qualified counsel before any live transfer is built. The same list is in `src/consent.js` (`LEGAL`), and every export package records which flags are still open.

| id | law | requirement | where the plumbing stands |
|---|---|---|---|
| GDPR-6-7 | GDPR Art. 6(1)(a), 7 | freely given, specific, informed, unambiguous consent per purpose and per recipient; withdrawable as easily as given; consent records kept | plumbing: per-item, per-scope, per-buyer consent + revocation ledger |
| GDPR-9 | GDPR Art. 9 | explicit consent for special-category data (health, biometrics, beliefs, sex life, etc.) | open: no special-category classifier; sensitive vault secrets are never offerable |
| GDPR-13-14 | GDPR Art. 13–14 | notice: buyer identity, purposes, retention, rights, transfers | plumbing: buyer record fields; notice text not written |
| GDPR-15-17-20 | GDPR Art. 15, 17, 20 | access, erasure, portability (machine-readable export) | plumbing: export packages; erasure at buyer side cannot be enforced technically |
| GDPR-28-44 | GDPR Art. 26/28, 44–49 | controller/processor roles; international transfer safeguards (SCCs/adequacy) | open: buyer jurisdiction recorded only |
| GDPR-35 | GDPR Art. 35 | DPIA for large-scale or high-risk processing | open |
| CCPA-SALE | CCPA/CPRA §1798.140(ad), .120, .135 | “sale” includes any exchange for value; opt-out / limit-use rights; Do-Not-Sell signals (GPC) honoured | plumbing: nothing leaves without per-buyer opt-in; GPC respected by design (no sale) |
| CCPA-SPI | CPRA §1798.121 | sensitive personal information: right to limit use | sensitive vault secrets excluded from offers |
| CCPA-MINORS | CCPA §1798.120(c); COPPA | opt-in for under-16 (parental consent under 13) | open: no age verification |
| DATA-BROKER | California Delete Act (SB 362), Vermont/Texas/Oregon broker laws | an intermediary that sells personal data of people it has no direct relationship with may need broker registration | open: depends on marketplace operator role |
| THIRD-PARTY | GDPR/CCPA (other people’s data) + copyright / site terms | crawled pages and captures contain third-party personal data and copyrighted text; the user cannot consent for others | enforced: captures are NOT offerable (user-originated data only) |
| CONSUMER-PROTECTION | FTC Act §5; EU UCPD; state UDAP | no dark patterns; honest description of what is sold, to whom, for what | plumbing: consent UI is per item and off by default |
| PAYMENTS-TAX | payments / money-transmission / tax reporting | any payout needs a licensed processor, KYC, and tax reporting | not built (payment hard-denied) |

## Design rules enforced in code

- **Only user-originated data can be offered** (notes, documents, profiles you write). The following can never be offered:
  - Crawled pages and research captures, because they contain other people's personal data and copyrighted text (THIRD-PARTY).
  - Sealed secrets.
- **Off by default.** Every scope except `storage` starts `not_authorized`. Each grant needs a tap and writes a hash-chained ledger entry.
- **Withdrawal is as easy as granting.** One tap revokes every offer for the item and marks every package that contains it `superseded_by_revocation`.
- **Packages stay local.** They are AES-GCM encrypted under the vault key and have `transfer: disabled`, `payment: disabled`, and `price: null`.

## Open product decisions

- **M9:** whether a live marketplace is ever built, and in what role (operator, intermediary, or user-to-buyer tool). The role determines broker registration and controller/processor duties.
- **M10:** age verification and special-category screening before any offer.
