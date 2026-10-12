# How replies are generated (v4.0.0) — derivation, not templates

Every user-facing reply (chat, clarifications, refusals, math, bridge/legacy routes) is produced by `src/derive.js`:

1. **MSM meaning** (structured fields chosen by the kernel: e.g. `{kind:'blocked', action, reason}`) → a **vākya plan** (`PLANS[kind]`): a list of clauses with a verbal root (dhātu), kāraka roles (kartā, karman, sampradāna, adhikaraṇa, tadartha…), tense/lakāra, polarity, voice, modality, force. Plans contain no surface sentences; refusals are composed from predicate + blocked authority + `REASON[code]` sub-plans.
2. **Sūtra engine** — 80+ numbered rules in sections with adhikāra headers (§1 saṃjñā, §2 kāraka→vibhakti, §3 lakāra, §4 conflict resolution, §6 repair/agreement, §7 affixation, §8 linearization/sandhi, §M math relations). Each section maps to an RMC phase (Φ1…Φ9). Competing rules are resolved by `choose()`: an apavāda blocks its utsarga (logged as 4.1.2), otherwise the later rule wins (4.1.1). Words are built from roots + affixes with internal markers (e.g. `ed⟨kta⟩`, `s⟨3sg⟩`) that are stripped before the surface.
3. **Trace**: every applied rule (id, phase, adhikāra, note, what it blocked) is recorded in `trace.derivation`, with the phase trail, a forbidden-transition check (Φ4→Φ8, Φ5→Φ8 → output blocked) and the drift values used. The Trace panel lists them.
4. **Echo = analysis by synthesis**: the surface is parsed back with the inverse sūtras; it must yield exactly one analysis whose vākya equals the plan (plus independent math re-verification). Ambiguous → lawful clarification; mismatch → output blocked, no memory write.
5. **Math**: equations and values are emitted as relation sequences (M.1.1 `=`, M.1.2 `≈` apavāda, M.1.3 `⇒`…); RPMC Φ-operator notation (`+_Φ`, `−_Φ`) is a notation switch on the same meaning. GP-014's operator roles (⧙ lock atoms, ⧧ sever) are now checked *over the derived reply*; its phrase templates were removed.

## Worked example — "buy milk"
```
MEANING {"kind":"blocked","action":"buy milk","reason":"OUT_OF_SCOPE"}
VAKYA [{"c":{"v":"ask","tense":"past","pol":"pos","karta":{"pr":"you"},"samp":{"pr":"I"},"roles":{"tadartha":{"n":"action","det":"the","app":{"m":"buy milk"}}}},"force":"decl"},{"c":{"v":"authorize","tense":"pres","pol":"neg","karma":{"pr":"I"},"voice":"pass","comp":{"inf":{"v":"do","tense":"pres","pol":"pos","karma":{"pr":"that"}}}},"force":"decl","conj":"but"},{"c":{"v":"contain","tense":"pres","pol":"neg","karta":{"n":"register","poss":"my"},"karma":{"n":"capability","det":"that"}},"force":"decl"},{"c":{"v":"say","tense":"pres","pol":"pos","karma":{"m":"note: buy milk"},"comp":{"inf":{"v":"keep","tense":"pres","pol":"pos","karma":{"n":"note","det":"a"}}}},"force":"imp","front":[{"role":"tadartha","np":{"n":"example"}}]}]
TEXT You asked me for the action “buy milk”. But I am not authorized to do that. My register does not contain that capability. For example, say “note: buy milk” to keep a note.
TRAIL Φ1→Φ3→Φ2→Φ6→Φ7→Φ1→Φ2→Φ8→Φ4→Φ2→Φ1→Φ2→Φ1→Φ8→Φ1→Φ2→Φ3→Φ2→Φ6→Φ7→Φ1→Φ2→Φ8→Φ3→Φ1→Φ2→Φ8→Φ1→Φ2→Φ3→Φ2→Φ6→Φ7→Φ1→Φ8→Φ1→Φ8→Φ2→Φ1→Φ8→Φ1→Φ3→Φ8→Φ1→Φ3→Φ1→Φ8→Φ9 forbidden null
1. 1.1.1 Φ1 dhātu insertion: the MSM predicate supplies the verbal root — ask
2. 3.1.1 Φ3 laṭ / laṅ (utsarga): the finite verb takes present or past tense — past
3. 2.1.1 Φ2 kartari prathamā: in active voice the kartā is the subject
4. 6.1.2 Φ6 agreement: the first finite element agrees with the subject in person and number — ask ↔ 2pl
5. 7.1.2 Φ7 past / participle: root + ed⟨kta⟩ — ask + ed⟨kta⟩
6. 1.1.3 Φ1 sarvanāma: speaker → I, addressee → you, anaphor → it / they — you
7. 2.1.3 Φ2 pronoun case: the subject takes the nominative form — you → you
8. 8.1.1 Φ8 word order: subject, verb group, objects, predicate, adjuncts, complement
9. 4.1.2 Φ4 apavāda blocks utsarga: a specific rule blocks the general rule it is an exception to — 2.2.4 blocked by apavāda
10. 2.2.5 Φ2 apavāda of 2.2.4: a pronominal sampradāna stays bare before a karman or complement, or after an addressee root (ask / tell / show / give) — sampradāna [blocks 2.2.4]
11. 1.1.3 Φ1 sarvanāma: speaker → I, addressee → you, anaphor → it / they — I
12. 2.1.4 Φ2 pronoun case: a non-subject takes the accusative form — I → me
13. 2.2.1 Φ2 vibhakti: an adjunct role is marked by its preposition (utsarga table) — tadartha
14. 1.1.2 Φ1 prātipadika insertion: a nominal stem for each role filler — action
15. 1.1.5 Φ1 uddhāraṇa: mentioned material is kept verbatim inside “ ” — buy milk
16. 8.3.2 Φ8 final punctuation from force: "." or "?" — .
17. 8.3.1 Φ8 the first letter of the sentence is capitalized
18. 8.1.5 Φ8 a sentence-initial connective (but / so / or) opens the sentence — but
19. 1.1.1 Φ1 dhātu insertion: the MSM predicate supplies the verbal root — authorize
20. 2.3.1 Φ2 negation scope: "not" follows the first element of the verb group
21. 3.1.1 Φ3 laṭ / laṅ (utsarga): the finite verb takes present or past tense — pres
22. 3.1.5 Φ3 passive: be + past participle
23. 2.1.2 Φ2 karmaṇi (apavāda of 2.1.1): in passive voice the karman is the subject
24. 6.1.2 Φ6 agreement: the first finite element agrees with the subject in person and number — be ↔ 1sg
25. 6.1.3 Φ6 suppletion: be → am / is / are / was / were
26. 7.1.2 Φ7 past / participle: root + ed⟨kta⟩ — authorize + ed⟨kta⟩
27. 7.3.3 Φ7 morphophonemics: final e drops before -ed / -ing — authorize
28. 1.1.3 Φ1 sarvanāma: speaker → I, addressee → you, anaphor → it / they — I
29. 2.1.3 Φ2 pronoun case: the subject takes the nominative form — I → I
30. 8.1.1 Φ8 word order: subject, verb group, objects, predicate, adjuncts, complement
31. 3.2.4 Φ3 infinitive: to + bare root (not to + root when negated) — do
32. 1.1.1 Φ1 dhātu insertion: the MSM predicate supplies the verbal root — do
33. 1.1.3 Φ1 sarvanāma: speaker → I, addressee → you, anaphor → it / they — that
34. 2.1.4 Φ2 pronoun case: a non-subject takes the accusative form — that → that
35. 8.3.2 Φ8 final punctuation from force: "." or "?" — .
36. 8.3.1 Φ8 the first letter of the sentence is capitalized
37. 1.1.1 Φ1 dhātu insertion: the MSM predicate supplies the verbal root — contain
38. 2.3.1 Φ2 negation scope: "not" follows the first element of the verb group
39. 3.1.1 Φ3 laṭ / laṅ (utsarga): the finite verb takes present or past tense — pres
40. 2.1.1 Φ2 kartari prathamā: in active voice the kartā is the subject
41. 6.1.1 Φ6 do-support (Φ6 correction): a negated or questioned lexical verb without an auxiliary takes "do" — contain
42. 6.1.2 Φ6 agreement: the first finite element agrees with the subject in person and number — do ↔ 3sg
43. 7.1.1 Φ7 tiṅ 3sg present: root + s⟨3sg⟩ — do + s⟨3sg⟩
44. 7.3.1 Φ7 morphophonemics: s → es after a sibilant or o — do
45. 1.1.2 Φ1 prātipadika insertion: a nominal stem for each role filler — register
46. 8.1.1 Φ8 word order: subject, verb group, objects, predicate, adjuncts, complement
47. 1.1.2 Φ1 prātipadika insertion: a nominal stem for each role filler — capability
48. 8.3.2 Φ8 final punctuation from force: "." or "?" — .
49. 8.3.1 Φ8 the first letter of the sentence is capitalized
50. 2.2.1 Φ2 vibhakti: an adjunct role is marked by its preposition (utsarga table) — tadartha
51. 1.1.2 Φ1 prātipadika insertion: a nominal stem for each role filler — example
52. 8.1.4 Φ8 a fronted adjunct or particle is followed by a comma
53. 1.1.1 Φ1 dhātu insertion: the MSM predicate supplies the verbal root — say
54. 3.1.1 Φ3 laṭ / laṅ (utsarga): the finite verb takes present or past tense — pres
55. 3.2.2 Φ3 imperative: no subject, bare root
56. 8.1.1 Φ8 word order: subject, verb group, objects, predicate, adjuncts, complement
57. 1.1.5 Φ1 uddhāraṇa: mentioned material is kept verbatim inside “ ” — note: buy milk
58. 3.2.4 Φ3 infinitive: to + bare root (not to + root when negated) — keep
59. 1.1.1 Φ1 dhātu insertion: the MSM predicate supplies the verbal root — keep
60. 1.1.2 Φ1 prātipadika insertion: a nominal stem for each role filler — note
61. 8.3.2 Φ8 final punctuation from force: "." or "?" — .
62. 8.3.1 Φ8 the first letter of the sentence is capitalized
63. 9.1.1 Φ9 marker deletion: internal ⟨…⟩ markers are removed before the surface (cf. 1.3.9 tasya lopaḥ)
ECHO {"pass":true,"score":1,"theta":1,"components":{"reparse":1,"unique_analysis":1,"structural_identity":1},"analyses":1,"ambiguous":false,"mode":"structural round trip: inverse sūtras (analysis by synthesis) + inward grammar; no word-overlap measure","cite":"RMC §5.12, §6.7; Doc 3 reversible derivation"}
```

## Tests that keep it this way (`verify/run.js`, class DERIVATION, 79 cases)
- Static scan of every reply source (kernel, forge, derive, forge_spine, infer, kmath, algebra, privacy) fails on any hard-coded English sentence literal (mutation-checked: inserting `'Noted: your fact is stored.'` makes it fail); no `Templates`/`FIXED`/`KIND2T` tables.
- Runtime: every reply delivered anywhere in the suite has a derivation trace, `derivation.surface === reply`, every rule id is a registered sūtra with its section's adhikāra and phase, no forbidden transitions, no `⟨⟩` markers on the surface; each meaning kind re-derives byte-identically from its MSM meaning.
- utsarga–apavāda audits (6.1.4 > 7.1.2, 2.1.2 > 2.1.1, 3.1.2/3.1.3 > 3.1.1, 2.2.2 > 2.2.1, M.1.2 > M.1.1, 8.2.1), refusals vary with action/reason, clarifications vary with fields, Echo catches a one-token fault.

## Privacy (PRIV-1…4)
`src/privacy.js` redacts at ingestion (key–value patterns for pin/password/passcode/card/account/ssn/cvv/iban/api key/token/… and free-standing Luhn card numbers, SSNs, IBANs, AWS/GitHub/Slack keys, JWTs, PEM blocks, long hex/base64). The value becomes the word "sealed" **before** ψ_id, trace, MSM, evidence, memory, receipts, exports, or dry-run see it. The plaintext travels only on a non-enumerable property to the Identity Vault, which encrypts it with AES-GCM-256 (key from PBKDF2-SHA-256, 210k iterations, passphrase never stored). Locked or no vault → the value is dropped and the reply is derived to say so. Legacy plaintext in old stores is redacted on load and the receipt chain is restarted. Admitted lexicon entries containing secrets are refused.
