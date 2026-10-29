# Wiring report — 4.9.181

The learning loop is still Ask → `research.web` → Athena measure and admit → Gilligan re-curate → hosted session KB → the next Ask. This release indexes each admitted row by the question that produced it, and it simplifies a lead sentence until the grammar can round-trip it. ChristPing stays Gilligan-only. Packs stay gated (`publishPacks` false). No LLM.

The 4.9.180 callers stay in [`WIRING_180.md`](WIRING_180.md).

## Recall and parse

| Step | Caller | What fires |
|---|---|---|
| Question on the admit | `forge.js` before `toolTurn` | A `research.web` result keeps the asked sentence on `meaning.question`. The tool label `[tool research.web]` is not the key. |
| Keys | `claim_parse.js` `topicKeys` | Question subject, answer subject, a known-as alias, a `method:` key, a `mix:` key, and a follow-up (`what about`). |
| Store | `dream_idle.js` `admitRecord` | The keys ride on the hosted row. Letter packs are not written. |
| Recall | `kernel.js` before AQ-1 | `CS-RECALL-ASK-KEY` when a key matches. AQ-1 does not also fire. |
| Lead | `claim_parse.js` `admitText` | The first sentence is preferred. Clauses split on `by which`, relatives, and coordination. A core is kept only when `reparseClause` and `renderClause` agree and its content words are in the source. |
| Gate | `dream_idle.js` | Drift at or under 0.35 and integrity at or above 0.85 still promote. Above 0.80 recenters. An unparsed excerpt stays unparsed. |

## Size

`build.py` does not inline `sonify.js`. The installed site still loads that script. The portable file keeps a fallback so a missing sonifier does not throw. Gzip leave stays at least 5 kB under 570 kB.
