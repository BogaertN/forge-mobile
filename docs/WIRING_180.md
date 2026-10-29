# Wiring report — 4.9.180

The learning loop is still Ask → `research.web` → Athena measure and admit → Gilligan re-curate → hosted session KB → the next Ask. This release adds the Athena document tools and a parse step on the admit. ChristPing stays Gilligan-only. Packs stay gated (`publishPacks` false). No LLM.

The 4.9.179 callers stay in [`WIRING_179.md`](WIRING_179.md).

## Parse and answers

| Step | Caller | What fires |
|---|---|---|
| ProtoForge definition | `kernel.js` `PF-LOCAL-DEF` | “What is protoforge?” is a local definition. “analyze drift” and “run protoforge” stay `PF_INTERNAL`. |
| Clean and split | `claim_parse.js` `cleanHtml`, `splitSentences` | Tags, entities, and citation marks come off. Sentences split on stops. |
| Subject-predicate | `claim_parse.js` `admitText` | The fullest core that round-trips through `reparseClause` / `renderClause`, and whose words are in the source, becomes the claim. |
| Admit | `dream_idle.js` `admitRecord` | Drift ≤ 0.35 and integrity ≥ 0.85 still promote. A core that does not parse returns `unparsed`. Drift above 0.80 recenters and does not write. |
| Recall | `kernel.js` hosted recall | The next Ask reads the admitted sentence before AQ-1. |
| Chloramine | `forge.js` before generation | A bleach-and-ammonia mix is “Chloramine is a toxic gas.” Nitrogen trichloride or hydrazine is a later name. No procedure. |

## Athena document — seventeen built rows

Doc `1cAGNfVakKlS-mGFb59BAnalJRomDc-w7Vf3Ys1nU6nI`. Module `src/athena_doc.js`. Each row is called from the loop.

| Ref | Name | Caller |
|---|---|---|
| 1.8 | Understanding Athena’s Role in AI.Web’s Ecosystem | `roleMap` from `dream_idle.js` `custody` and `pass` |
| 2.2 | How to Interact with Athena | `interact` from `dream_idle.js` `stepTick` on the gap question |
| 2.4 | Navigating Athena’s Dashboard Interface | `dashboard` from `custody` |
| 5.1 | How Athena AI Knowledge Nodes Work | `node` from `noteAdmit` after a hosted write |
| 5.2 | Private Investor Knowledge Nodes (User-Specific) | `node('private')` in `noteAdmit`. Local store only. |
| 5.3 | Community AI Knowledge Nodes (Shared User Intelligence) | `node('community')` in `noteAdmit`. Rule `COMMUNITY-PACK-GATED`. `publishPacks` false. No letter file. |
| 5.4 | Global AI Knowledge Nodes | `node('global')` in `noteAdmit` only when `defend` says project (drift ≤ 0.35). |
| 5.5 | Investor Warnings & User-Controlled Information Sharing | `setShare` and the warning list inside `noteAdmit` |
| 5.6 | AI-Generated Investor Data Encryption & Cybersecurity | `sealChat` (WebCrypto AES-GCM). No network. |
| 5.8 | How Athena AI Knowledge Nodes Function Like Advanced Cookies | `persist` writes `athena_doc` on the session store |
| 7.4 | AI-Generated Conversational AI Flow Optimization | `tune` from `interact`. Counts lanes. No model. |
| 7.5 | AI-Powered Adaptive Learning for Investor Needs | `adapt` from `noteAdmit`. A weight on the subject. No model. |
| 8.1 | AI-Based Data Encryption for Investor Chats | `sealChat` |
| 8.2 | AI-Powered Secure Data Storage for Investment Insights | ciphertext rows on `state.secure` |
| 8.4 | AI-Powered AI-Web Account Security & Authentication | `setPasscode` / `unlock`. SHA-256 of the code. No third party. |
| 8.10 | AI-Powered AI-Web Cybersecurity Defense System | `defend` on `pass` and `noteAdmit`. χ above 0.35. Hard stop above 0.80. |
| 9.1 | Persistent investor memory and evolving knowledge nodes | `evolve` inside `noteAdmit` when the same claim is seen again |

## Skips

Sixty-seven rows are `skipped` in `source/data/forge_tool_inventory.json` under `athena_doc.items`, each with the reason from the list (payments, tokens, a language model, awards, or media). None of those callers exist.
