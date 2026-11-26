---
title: "Forge Harmonic Key: Research on the 11 Open Questions"
subtitle: "Version 0.1, November 25, 2026. Companion to Forge_Harmonic_Key_and_Packet_Spec_v0.1"
author: "Prepared for Nic Bogaert, Forge Mobile"
---

# 0. Summary

Nic asked for each of the 11 open questions to be checked first against his own writing and code, and then against outside research, including ideas academia doesn't fully accept. This report does both and ends each question with a recommended answer.

**How to read the evidence labels:**

- **Established:** mainstream, replicated, or plain engineering fact.
- **Minority-but-serious:** published by credible researchers, but not consensus.
- **Fringe / unverified:** not accepted, untested, or shown false. Listed because Nic asked for it, and kept out of anything Forge treats as fact.
- **Nic's own:** Nic's documents or code. Cited first, as decision history, not as outside evidence.

**What these recommendations never touch:** the fixed Forge gates (C_min 0.87, Echo 0.85 to speak and 0.97 to write, drift 0.35 / 0.40 / 0.80), the rule of at least 2 independent publishers per fact, Ask never auto-persisting, and `calls_llm:false`.

## Recommended answers at a glance

| # | Question | Recommendation | Confidence |
|---|---|---|---|
| 1 | Octave ladder or band centers | Keep the 144/2^k octave ladder, but widen the ripple row to **80–220 Hz with 144 inside it**, as `band_tuning.js` already does. Keep the 144-divisor markers for fine tuning | Medium-high |
| 2 | 72 Hz rung | Make it **high/fast gamma, 60–140 Hz family, used as the "hand-off" band**: links *between* items, where gamma links parts *within* one item. The "transition" idea already belongs to Φ9 in Nic's Codex | Medium |
| 3 | Kāraka slot set | **Change 2 of the 9.** Replace the invented `māna` and `nibandhana` with Forge's real roles `vidheya` (predicate complement, which already carries measures) and `hetu` (cause). Other roles move to gamma | Medium-high |
| 4 | Atom identity | Key atoms by **Forge concept id + WordNet 3.0 sense offset**, with CILI ids as the cross-version bridge. Lemma+type only for UNKNOWN-CONCEPT atoms, flagged. Wikidata stays cross-reference only | High |
| 5 | Symmetric relations | Sort the arguments **only for predicates declared symmetric** in `world_rules.js`; never guess symmetry | High |
| 6 | Acoustic profile | **Audible by default.** Near-ultrasonic only as an opt-in profile with a visible indicator | Medium-high |
| 7 | MAC | **Required from day one for any frame that can change state** (claims, queries that queue Athena work, reinforcement). HELLO and pings may be unauthenticated | Medium |
| 8 | Peer reinforcement | **Yes, but only from authenticated peers.** Do it by slowing decay (stretching the half-life), not by raising amplitude, keep the cap, and never count it as a publisher | Medium |
| 9 | HCS `forge_memory` field | **Yes.** An additive optional serde field, plus a bound `ForgeBridge`. Needs Nic's go-ahead for that repo | High |
| 10 | Anchor ratios | **1 / 0.5 / 3 is current** (the HCS "conductor embodied profile"). 1 / 3 / 9 is the older 144/432/1296 "experimental harmonic profile", kept by name | High |
| 11 | Half-lives | Rebase on Nic's **168 h Genesis constant**: gamma = 168 h, theta = 4 × 168 h, delta = 52 × 168 h with the 0.25 floor, beta 15 min, alpha 1 h, ripple 60 s. Use his existing 0.1 active and 0.05 collect thresholds | Medium-low (starting values) |

## What was searched

- **GitHub.** All 16 BogaertN repositories were listed. The 13 public ones were cloned and searched in full; the cloned copies are in `/workspace/oq-research/repos`. The 3 private ones are field-hub, Coffinpop and sniffr-website. They are unrelated to this topic, so they were not opened.
- **Google Drive.** The main Drive (owner "story teller") was searched through its 540-document export on the box, all converted to text. Live searches also ran on the main, second (Nicholas Bogaert), xai and nickbogart900 Drives. The Google Docs connector has no search of its own, and its documents are the same Drive files.
- **Box files** were also searched: `/workspace/hfield-review`, `/workspace/doc-extracts` and the kernel-papers notes.
- **Outside research** used web sources. Every outside source below has a real URL. When a source does not actually address a question, this report says so.

# 1. Octave ladder (144/2^k) or band centers?

## Nic's own writing and code

- **Forge's band table already exists.**
  - **What it says:** [`forge-mobile/preview/src/band_tuning.js`](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/band_tuning.js) (4.9.220) has a 9-row `BAND_TABLE` with "edges on the 144/n ladder". Row 9 is the **"144 Hz carrier", low 80, high 220, centre 144**, so 144 sits inside the row, not at its top edge.
  - **Markers:** the markers are all divisors of 144: 1, 2, 3, 4, 6, 8, 9, 12, 16, 18, 24, 36, 48, 72, 144.
  - **Band relations:** bands relate by ×3 (weight 0.3) and ×9 (weight 0.1), not ×2.
- **The phase home frequencies.** [`frequency_203.js`](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/frequency_203.js) sets `HOME = {1:4, 2:8, 3:12, 4:18, 5:36, 6:48, 7:72, 8:432, 9:1296}`, with marker bands `[3,4,6,8,9,12,16,18,24,36,48,72,144,432,1296]` (all 2^a·3^b). It is marked "proposal v1, awaiting Nic".
- **FBSC Phase Glyph Codex v2.5.** [`forge/rmc_engine_v1/reference/phase_codex_v2_5.json`](https://github.com/BogaertN/forge/blob/main/rmc_engine_v1/reference/phase_codex_v2_5.json) gives:
  - Φ1 Theta 4–7, Φ2 Alpha onset 7–10, Φ3 Alpha-beta 10–14, Φ4 Mid-beta 14–20;
  - Φ5 "Low-Gamma 20–30", which is labelled beta in standard usage;
  - Φ6 Theta-alpha blend 6–9, Φ7 Beta-high beta 18–30, Φ8 High gamma 30–45;
  - **Φ9 "Octave Transition Composite; H9 to H1 loopback"**.
- **Nic's papers put 144 at the opening of the ripple band.** [Beyond the 40 Hz Myth (April 2026)](https://docs.google.com/document/d/10GFjZFgaypl9LWI3_jhdGCgTCiWTlgrcKCzmdnByBMU/edit) says "the ripple band ... begins at 140 Hz and extends to 220 Hz, placing ... 144 Hz ... precisely at the opening of this band". [05_Oscillatory_Depth](https://docs.google.com/document/d/1CxQG2Ss9yoQXi-zr2CGKiyApoh78xfAl1zTraHmjbdk/edit) describes the same stack: 40 Hz surface, about 90 Hz binding, 140–220 Hz substrate.

**Conflicts within Nic's own material:**

- The spec v0.1 ripple row (80–144, with 144 as the *ceiling*) disagrees with `band_tuning.js` (80–220, with 144 *inside*) and with his papers (144 as the *opening*).
- The Codex's own band names disagree with the standard names (Φ5 "Low-Gamma 20–30").
- `frequency_203` puts Φ8 and Φ9 at 432 and 1296, while `band_tuning` puts Φ9 at 144.

## Outside research

- **Ripple frequency ranges (Established).** Human hippocampal ripples are usually filtered at **80–150 Hz**, with centre frequencies around 80–120 Hz. Rodent ripples run about **140–200/220 Hz**. A 2022 consensus statement notes that labs use very different filter bands. Sources:
  - [Liu et al., *Nat Commun* 2022 consensus](https://www.nature.com/articles/s41467-022-33536-x)
  - [Takagi 2023 review](https://journals.sagepub.com/doi/10.1177/15500594211034371)
  - [*Nat Rev Neurosci* 2025](https://www.nature.com/articles/s41583-025-00971-w)
  - [Lever et al. chapter](https://www.ucl.ac.uk/brain-sciences/sites/brain_sciences/files/lever2014.pdf)

  So 144 Hz is a real **cusp**: it is at the top of the human range and the bottom of the rodent range. That supports Nic's "cusp" wording, in the sense of a border between two regimes.
- **Garrett et al. 2024 (Established).** The paper is published in *Nature Human Behaviour*, 8:1988–2002, and reports intracranial co-ripples at about 90 Hz ([paper](https://www.nature.com/articles/s41562-024-01952-2), [PubMed](https://pubmed.ncbi.nlm.nih.gov/37292795/)). Two citation fixes:
  - 05_Oscillatory_Depth cites Garrett as a bioRxiv paper with a different title. Update it to the 2024 *Nature Human Behaviour* paper.
  - That doc also cites Vaz et al. as *Science* 2020, but the volume it gives (363) is the 2019 volume.
- **The octave spacing idea (Minority-but-serious).** Klimesch's "binary hierarchy" proposes that neighbouring band centre frequencies double: about 2.5, 5, 10, 20 and 40 Hz. Non-neighbouring bands can still couple at other whole-number ratios, including ×3 ([Klimesch 2018, *Eur J Neurosci*](https://pmc.ncbi.nlm.nih.gov/articles/PMC6668003/)). That is almost exactly the 144/2^k ladder (2.25, 4.5, 9, 18, 36, 72, 144), just anchored on alpha at 9 Hz instead of 10 Hz.
- **The golden-ratio alternative (Minority-but-serious).** Pletzer, Kerschbaum and Klimesch (2010) argue that resting-state bands are spaced by φ ≈ 1.618 precisely *because* φ prevents phase locking. Integer ratios (2:1, 3:1) are then the coupled, working state ([*Brain Res* 2010](https://pubmed.ncbi.nlm.nih.gov/20350536/)). This matters for Forge. Integer ratios are the right choice for a memory you want to *couple and recall*. φ spacing would be right for channels you want to keep *independent*.

## Recommendation

1. **Keep the octave ladder 144/2^k for the band carriers.** It is the same structure as Klimesch's binary hierarchy, and it gives exact nesting.
2. **Change the ripple row to 80–220 Hz, with the 144 carrier inside it,** to match `band_tuning.js` and Nic's papers. That makes 144 the cusp between the human ripple band (80–150) and the rodent one (140–220).
3. **Keep Nic's existing 144-divisor markers and ×3/×9 relations as the fine-tuning layer inside each band,** so the key reuses `band_tuning.js` instead of competing with it.
4. **Settle the naming conflicts:** standard band names in the key, and Codex phase names (Φ1–Φ9) kept as labels only.

**Confidence:** medium-high.

**Still open:** whether delta and theta carriers should be the off-marker 2.25 and 4.5 Hz, or the on-marker 3 and 6 Hz. The trade-off is pure octave nesting against reusing Nic's 2^a·3^b markers.

# 2. The 72 Hz rung: high gamma or a "transition" band?

## Nic's own writing and code

- **In `band_tuning.js`,** 72 falls inside row 8, "High gamma", 40–80 Hz.
- **In `frequency_203.js`,** 72 is the home frequency of **Φ7 "Naming"**.
- **The HCS design doc** ([Harmonic Conductor Studio](https://docs.google.com/document/d/1PV2R2eEVcpbjKk6trnAhE04Gf0zJwk8ZbenrJLW0Tfs/edit)) uses 72 Hz as the audition-only *lower anchor* (ratio 0.5). It warns that "Seventy-two hertz may ... vanish or sound weak on small hardware".
- **The "transition" idea in Nic's Codex belongs to Φ9** ("Octave Transition Composite; H9 to H1 loopback"), not to 72 Hz.

## Outside research

- **Slow and fast gamma (Established).** Colgin et al. 2009 split hippocampal gamma into slow (about 25–50 Hz) and fast (about 65–140 Hz). Each routes input from a different source, at a different theta phase ([*Nature* 2009](https://www.nature.com/articles/nature08573)). 72 Hz sits inside fast gamma.
- **High-gamma above about 80 Hz (Established).** Activity above about 80 Hz is largely broadband and tracks spiking, rather than being a narrow oscillation ([Ray & Maunsell 2011, *PLoS Biol*](https://journals.plos.org/plosbiology/article?id=10.1371%2Fjournal.pbio.1000610)). So the zone between 60 and 140 Hz really is a hand-off region, between binding gamma and ripples.

## Recommendation

**Name the 72 Hz rung high/fast gamma, and give it the role of linking *between* items.** This is association and hand-off: which bound items belong together, and what to pass to ripple replay. Gamma (36 Hz) keeps binding the parts *within* one item. This puts the "transition" meaning in the slot between binding and replay without stealing Φ9's loopback role.

**Confidence:** medium.

**Still open:** Nic's call on whether Φ7 "Naming" should sit on this rung, as `frequency_203` implies.

# 3. Are the 9 delta kāraka roles right?

## Nic's own writing and code

- **The roles Forge's grammar actually uses.** [`grammar.js` line 298](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/grammar.js) maps prepositions to: `karta`/`kartr`, `karma`, `karana`, `sampradana`, `apadana` and `adhikarana`. It adds non-kāraka relations: `kala` (time), `vishaya` (topic), `sambandha` ("of"), `hetu` (cause) and `upadhi` ("as"). Clauses also carry `vidheya`, the predicate complement. Measures already exist as a predicate type, `{type:'measure', num, unit}`. There is also `prayojana` (purpose).
- **The spec's `māna` and `nibandhana` appear nowhere in Forge's code or in Pāṇini.** They were invented for the v0.1 spec and should be replaced.
- **Doc 5 governs how kāraka terms may be used.** [RMC Predicate–Role Frame Registry v1, Part 1](https://docs.google.com/document/d/1vXF73pMOR9VxcB6RozvzWRfmQT-zsgvJIfNXE6RQrhw/edit), Ruling 7, says kāraka-inspired roles must be "operationally translated, not historically copied": Forge-owned, operationally defined, provenance-bound. It also says the final role inventory is not yet defined.
- **Nic's Pāṇini doc lists working roles.** [Pāṇini's grammar of Sanskrit, the Aṣṭādhyāyī](https://docs.google.com/document/d/1ilQtx-bpiRE7ltLO6YeXCOLu3QyZjb2rtYkV7R_W_OU/edit) lists actor, operation, object, instrument, evidence, claim, source, recipient, location, time, constraint, certainty, negation and requested_output.

## Outside research

- **The computational Pāṇinian scheme (Established).** The IIIT Hyderabad scheme used for the Hindi treebank keeps six kārakas:
  - k1 kartā (agent)
  - k2 karma (object)
  - k3 karaṇa (instrument)
  - k4 sampradāna (recipient)
  - k5 apādāna (source)
  - k7 adhikaraṇa (locus), split into **k7t** time and **k7p** place

  Non-kāraka labels include **r6** (genitive, i.e. sambandha) and **rh / rt** (cause and purpose). Sources: [Begum et al. 2008](https://aclanthology.org/I08-2099.pdf), [LREC 2010](https://lrec-conf.org/proceedings/lrec2010/pdf/854_Paper.pdf), [Hindi CCGbank](https://pmc.ncbi.nlm.nih.gov/articles/PMC6954025/).
- **How many items fit in one slow cycle (Minority-but-serious, widely cited).** Lisman and Jensen's theta-gamma code puts about 4–8 gamma "item slots" inside one theta cycle, often linked to the 7±2 memory span ([*Neuron* 2013](https://ncbi.nlm.nih.gov/pmc/articles/PMC3648857/)). Nine slots is at the top of that range. That's fine for a lookup address, but don't claim it is brain-exact.

## Recommendation

The new delta slot set, in the same three groups:

| Group | Slots |
|---|---|
| Core | 0 kriyā (predicate), 1 kartṛ, 2 karman |
| Participants | 3 karaṇa, 4 sampradāna, 5 apādāna |
| Frame | 6 adhikaraṇa (k7; the time/place subtype goes in a gamma part), **7 vidheya** (predicate complement, including measures; replaces `māna`), **8 hetu** (cause/reason, with prayojana as a subtype; replaces `nibandhana`) |

The remaining relations, **sambandha, vishaya and upadhi, move to gamma parts.** Negation, modality and statistic qualifiers such as "mean" become clause flags or gamma parts, not delta slots. Each slot needs a one-line Forge-owned operational definition, to satisfy Doc 5 Ruling 7.

**The other bands' columns:** theta (sequence order) and ripple (replay stages) already match how the Forge loop works. Alpha's gate states match the Codex's cold-storage and correction-gate ideas. Beta needs no change.

**Confidence:** medium-high.

# 4. Shared atom identity

## Nic's own writing and code

- **Forge's lexicon already has ids.** [`lexicon.js`](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/lexicon.js) says "every entry has a concept id + sense id" (Doc 4), and anything else is in the UNKNOWN-CONCEPT state. [`data/lexicon.json.gz.b64`](https://github.com/BogaertN/forge-mobile/blob/main/data/lexicon.json.gz.b64) is built from **Princeton WordNet 3.0**, keyed by synset offset (for example `13658027n`).
- **Supabase stores SHA-256 hashes.** [`supabase/migrations/20261015000300_kb_core.sql`](https://github.com/BogaertN/forge-mobile/blob/main/supabase/migrations/20261015000300_kb_core.sql) stores `kb.lexicon_concepts(item_id, version, surfaces, senses, ..., content_sha256)` and `kb.facts(... content_sha256)`. The existing hash is **SHA-256, not BLAKE3**.
- **Wikidata needs separate review.** [Forge External Linguistic Resource Acquisition and Licensing Dossier v1, Part 1](https://docs.google.com/document/d/1ySWZQt3ZbetxCAcxDvkaeStTNLRDLmyiWwDK_cNAVq8/edit) says Wikidata-derived proper-noun entries need separate review and are not approved. That matches Nic's Nov 10 rule that Wikidata is a cross-check only.

## Outside research

- **CILI (Established).** The Collaborative Interlingual Index gives each concept a permanent id that works across WordNet versions and languages. Ids are never redefined, only deprecated, and there are map files for PWN 3.0 ([CILI repo](https://github.com/globalwordnet/cili), [GWC 2016 paper](https://doi.org/10.18653/v1/2016.gwc-1.9)).
- **Wikidata merges (Established).** Merged Wikidata items become redirects; there were about 4.1 million redirected items in 2023 ([Wikidata merge help](https://www.wikidata.org/wiki/Help:Merge), [CEUR 2023](https://ceur-ws.org/Vol-3640/paper4.pdf)). That makes QIDs workable as cross-references but risky as primary keys.
- **RDFC-1.0 (Established).** The W3C standard for canonical, hashable statements: it fixes the ordering and then hashes, using SHA-256 by default ([W3C RDFC-1.0](https://www.w3.org/TR/rdf-canon/)).

## Recommendation

- **atom_id** = hash of `{forge_concept_id, wn30_sense_offset, type}`, also storing the matching CILI id where one exists.
- **Lemma+type is a fallback only for UNKNOWN-CONCEPT atoms.** Those are flagged, never verified-ref, and can't light up as delta facts until they're admitted.
- **Wikidata QID stays a cross-reference field only.**
- **Use SHA-256 for fact_id and atom_id,** to match `kb.facts.content_sha256`, rather than BLAKE3. The other option is to keep both, but one hash family is simpler. This changes the spec v0.1 hash examples.

**Confidence:** high.

# 5. Symmetric relations: sorted atoms?

## Nic's own writing and code

- **Forge already declares symmetry per predicate.** [`world_rules.js` lines 23–87](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/world_rules.js) declares symmetric predicates explicitly (`married_to`, `next_to`, `adjacent_to`, `sibling_of`, `alias_of`) and adds the rule p(x,y) → p(y,x). [`mea.js`](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/mea.js) rejects a predicate declared both symmetric and with a distinct inverse.
- **Doc 4 forbids guessing direction.** [Concept Lexicon Part 3, §48.61](https://docs.google.com/document/d/1uXq6sa9vW1N48WZr3CFSwHD6Jmu6vlV1soQIUYW3OCs/edit) says: "Absence of directionality shall not be guessed."

## Outside research

**[Established]** RDFC-1.0 shows the standard pattern: get the same hash for the same meaning by fixing the order first ([W3C](https://www.w3.org/TR/rdf-canon/)). No outside source offers a better rule than "declare, then canonicalize."

## Recommendation

Canonicalize **only declared-symmetric predicates**:

1. Put the two arguments in kartṛ and karman, ordered by atom_id.
2. Set a `SYM` flag.
3. The query compiler applies the same rule, so both question directions land on the same slots.

For distance, declare a symmetric `distance_between` predicate. Don't treat the asymmetric apādāna phrasing as symmetric by default.

**Confidence:** high.

# 6. Acoustic profile

## Nic's own writing

**His writing conflicts on this.**

- **Pro-ultrasonic:** [Waking the Web – Building Neuromorphic AI from Frequency to Freedom](https://docs.google.com/document/d/1IWwAbNI6hHoHBC4GvY_CD5x0KS7wlo31ATG5RmhaCkM/edit), §4.2.1, designs a **17 kHz ultrasonic ping and mesh**: 20 ms echo wait, phase-shift keying, 17 kHz piezo transducers.
- **Against hidden ultrasonics:** the [HCS doc](https://docs.google.com/document/d/1PV2R2eEVcpbjKk6trnAhE04Gf0zJwk8ZbenrJLW0Tfs/edit) safety rules include **"no hidden ultrasonic payloads"**. It also says machine-readable acoustic packets come "later ... with preambles and integrity checks", with v1 output-only, and it names ggwave as a reference.

## Outside research

- **ggwave (Established engineering).** It runs at 8–16 bytes/s, with both audible and ultrasound modes and error correction ([ggwave](https://github.com/ggerganov/ggwave)).
- **Near-ultrasonic on phones (Established).** It works, but depends on the device. It needs per-device calibration ([BatNet, arXiv 2020](https://arxiv.org/abs/2008.00136)), and responses vary a lot between phones ([W&M IoT-J 2019](https://www.cs.wm.edu/~qxlixx/paper/iotj19.pdf)).
- **Covert ultrasonic tracking is a documented privacy abuse** ([Arp et al. 2016, "Bat in the Mobile"](https://mlsec.org/docs/2016-batmobile.pdf)). This backs up the HCS rule.

## Recommendation

- **The audible 1.7–3.9 kHz profile is the default.** It is reliable on phones, people can hear when Forge is "talking", and it satisfies the HCS no-hidden-ultrasonics rule.
- **Near-ultrasonic (17–20 kHz) is an opt-in profile only.** It requires a visible on-screen indicator and a calibration handshake.
- **Same frames in both profiles,** with only the tone grid changing.
- **This keeps Nic's 17 kHz mesh idea alive** without breaking his later safety rule.

**Confidence:** medium-high.

# 7. Pairing and MAC

## Nic's own writing

- **HCS doc:** packets need preambles and integrity checks "so music or ambient noise cannot impersonate a real protocol message".
- **Waking the Web:** the mesh accepts echoes by phase match (|e| < 0.5 rad), which gives no cryptographic authentication.
- **The Identity Vault repos** ([identity-vault](https://github.com/BogaertN/identity-vault), [self-hosted-identity-vault](https://github.com/BogaertN/self-hosted-identity-vault)) give an existing home for pairing keys.

## Outside research

- **NIST (Established).** SP 800-107r1 allows truncated HMAC tags of at least 32 bits, and says 64 bits is a commonly acceptable length ([NIST SP 800-107r1](https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-107r1.pdf)). The spec's 8-byte tag meets that.
- **Pairing over sound already exists (Established).** PairSonic exchanges public keys between nearby devices over sound, using ggwave (listed in the [ggwave README](https://github.com/ggerganov/ggwave)).

## Recommendation

- **A MAC is required from day one on every frame that can change any state:** CLAIM, QUERY (it queues Athena work), ANSWER, and anything that reinforces a memory.
- **Only HELLO, HELLO_ACK and presence pings may travel unauthenticated.**
- **Pairing happens once,** by QR code or a PairSonic-style key exchange, and the key is stored as an Identity-Vault reference.
- **Unpaired peers can still be heard,** but their records go straight to `quarantine_peer` and get no reinforcement.

The cost is about +0.6 s per frame. Being "only for write-starting claims" isn't enough, because claims never write directly anyway. The real risks are queue spam and inflating a memory's amplitude.

**Confidence:** medium.

# 8. Should peer mentions reinforce memories?

## Nic's own writing

**FBSC Vol II, §4.7, "Harmonic Decay Fields and Symbolic Half-Life Protocol"** ([doc](https://docs.google.com/document/d/12-8Pfdn25o9f7KBfxmA_LSAbCZXR4nXPPPMSlFJVd9U/edit)) gives A(t) = A₀·e^(−λt) with λ = ln 2 / τₙ. Decay is *accelerated* by "lack of recursive pings" and "isolation from other phase-matching loops". So in Nic's own theory, peer contact should *slow* decay.

Related ideas in his code:

- `frequency_204.js` ("co-admitted words attract")
- the Codex rule "cold storage is not deletion"

## Outside research

- **The spacing effect (Established).** Reinforcement works best when it's spaced out. The best gap grows with how long you need to remember: about 20–40% of a one-week retention interval, and about 5–10% for one year ([Cepeda et al. 2008](https://pubmed.ncbi.nlm.nih.gov/19076480/)). Repeated mentions bunched together add little.
- **Duolingo's half-life regression (Established, applied).** It models recall as 2^(−Δ/h) and updates the *half-life* h, not the amplitude ([Settles & Meeder 2016](https://aclanthology.org/P16-1174.pdf)).

## Recommendation

- **Yes, peer mentions reinforce, but they stretch the half-life instead of raising the amplitude.** A resolved, MAC-authenticated peer mention extends h by up to 5%.
- **At most once per peer per spacing window.**
- **They never add publishers and never move any gate.**
- **Unauthenticated mentions give nothing.**

**Confidence:** medium.

# 9. Add `forge_memory` to harmonic-conductor-studio?

## Nic's own code

- **HCS's authority rules allow it.** HCS declares `forge_bridge_is_adapter: true` and `mutates_forge: false` (`hfield-domain`).
- **The bridge slot is waiting.** The `forge_bridge` slot is "reserved", and the stub says "reference_only_no_live_forge_execution".
- **Today's test showed the gap.** HCS validates the Forge packet but drops unknown fields when it re-saves.

## Recommendation

**Yes.** Add `#[serde(default, skip_serializing_if = "Option::is_none")] forge_memory: Option<serde_json::Value>` to `FieldScore`, and add the bound fields to `ForgeBridge`. Both are additive, so existing `.hfield` files are unaffected.

This is a code change to Nic's HCS repo, so it needs his explicit go-ahead. Outside research isn't relevant here.

**Confidence:** high.

# 10. Anchor ratios: 1/0.5/3 or 1/3/9?

## Nic's own writing

**The HCS doc settles this itself.**

1. It first proposed the "Three-Anchor Tonal Lattice": A1 = 144, A5 = 432, A9 = 1296, which is ratios 1/3/9.
2. It later corrected that to **`conductor_embodied_profile_v1`**: centre 144, a lower anchor below 144 (72 Hz for auditioning, so ratio 0.5), and an upper anchor at 432 (ratio 3). In its own words: "The old 144 / 432 / 1296 relationship can remain available as a separate experimental harmonic profile ... That is a real and necessary correction."
3. The canonical file `projects/hcs_canonical_reader_packet_v1.hfield` uses 1 / 0.5 / 3.

## Recommendation

**1 / 0.5 / 3 is current.** Keep 1/3/9 under the name "experimental harmonic profile". The Forge memory key gives anchors no meaning, so this affects only rendering.

**Confidence:** high.

# 11. Half-lives

## Nic's own code and writing

- **Forge uses 168 h everywhere.** The **Genesis Node half-life is 168 h** in [`genesis_collapse.js`](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/genesis_collapse.js), [`world_facts.js`](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/world_facts.js) and `frequency_204.js`. The source is cited as "Genesis Node pp.116, 143–145".
- **Its tiers.** [`tiers_196.js`](https://github.com/BogaertN/forge-mobile/blob/main/preview/src/tiers_196.js) treats charge above 0.1 as active and below 0.05 as collected, with clock hours 0 / 168 / 600 / 800, citing "PMA §6 Hot, Warm (SPC), Cold, Deep".
- **The rules around it:** FBSC Vol II §4.7 says a half-life τₙ is specific to each symbol, and the Codex says "cold storage is not deletion".

## Outside research

- **Duolingo's half-life regression (Established, applied)** clips half-lives to the range 15 minutes to 9 months ([Settles & Meeder 2016](https://aclanthology.org/P16-1174.pdf)). That is close to the spec's beta (15 min) and delta (1 year).
- **The spacing results** in section 8 apply here too.
- **The brain doesn't fix these numbers.** Nothing in the brain gives "the" half-life of a band. These are software design values.

## Recommendation

**Rebase the half-lives on Nic's 168 h constant:**

| Band | Half-life |
|---|---|
| Gamma | 168 h (7 days, unchanged) |
| Theta | 4 × 168 h = 28 days (was 30) |
| Delta | 52 × 168 h ≈ 1 year, keeping the 0.25 floor for verified facts |
| Alpha | 1 h |
| Beta | 15 min |
| Ripple | 60 s |

**Use Nic's existing thresholds.** 0.1 counts as active. Below 0.05 (the same number as the spec's near-miss floor) means **demote to cold storage, never delete,** for anything stored in Supabase.

**Confidence:** medium-low. These are starting values to be tuned on real usage logs.

# 12. History and fringe research for the "h-field as fabric" idea

Nic asked to go back to Tesla, Steinmetz and the people around them. Here's what holds up, sorted by evidence level, and what each piece could teach Forge.

| Person / idea | What they actually said or showed | Evidence level | Use for Forge's h-field |
|---|---|---|---|
| **Faraday** (1846, "Thoughts on Ray-Vibrations") | Light might be vibration of the *lines of force themselves*; he "endeavors to dismiss the aether, but not the vibration" ([NASA copy](https://pwg.gsfc.nasa.gov/Education/wfarad1846.html)) | Established history; he called it a speculation | The field itself carries the pattern, with no extra medium needed. A good template: the h-field is the *lines of relation* between facts |
| **Maxwell** (1865 / 1873) | 1865: 20 equations, written component by component; the 1873 *Treatise* recast them partly in quaternion notation; Heaviside reduced them to 4 vector equations ([IEEE ETHW](https://ethw.org/Maxwell%27s_Equations), [Royal Society on Heaviside](https://royalsocietypublishing.org/rsta/article/376/2134/20180229/115694/Oliver-Heaviside-s-electromagnetic-theoryOliver)) | Established | The physics is the same in both notations, so the quaternions don't contain lost physics. Their use for Forge is as a tidy way to *store* phase and amplitude (rotations); the 9-slot phase could be a unit complex number or quaternion |
| **Helmholtz** | Vortex theorems (1858); resonance theory of hearing | Established (hearing theory later refined) | A bank of tuned resonators, each with its own Q, is exactly the "radio tuning" retrieval model |
| **Kelvin** (1867, vortex atoms) | Atoms as knotted vortex rings in an ether; abandoned because they were unstable, but it started knot theory ([Royal Society 2019](https://royalsocietypublishing.org/rsta/article/377/2158/20180451/58118/Vortices-and-atoms-in-the-Maxwellian-eraVortices)) | Disproven as physics; mathematically fruitful | Identity as a *topological* invariant (which knot it is), not a position. This matches hash-keyed identity: the id survives being moved |
| **Bjerknes** (C.A. and V., *Fields of Force*, 1906) | Spheres pulsating in a fluid attract when in phase and repel when out of phase, the reverse of electrical charges ([archive.org](https://archive.org/details/fieldsofforcecou00bjer), [Bjerknes force](https://en.wikipedia.org/wiki/Bjerknes_force)) | Established fluid dynamics (Bjerknes forces are measured on bubbles) | Close to Forge 204's "co-admitted words attract, conflict pairs repel". In-phase memories attract, so it's a real physical precedent for phase-based attraction |
| **Steinmetz** (*Transient Electric Phenomena*, 1909; *Four Lectures on Relativity and Space*, 1923) | Dielectric energy is stored in the space around a conductor, not on it. In 1923 he wrote: **"There is no such thing as the ether"**. A wave doesn't need to be the motion of a medium; it can be a change in an *energy field* stored in space ([archive.org full text](https://archive.org/details/fourlecturesonre00stei), [Transient Phenomena](http://archive.org/details/theorycalctrans00steirich)) | Established history | **Conflict with Nic's [Resonance Over Particles](https://docs.google.com/document/d/1i52J5yzI0hAfBRqUQI7xYsq90C6N9Qw5d2e6Gu_tUaQ/edit),** which lists Steinmetz as backing an ether substrate. But Steinmetz's own picture, a field of stored energy that exists without matter, is the best fit for "h-field as fabric": a field of potential, not a material |
| **Tesla** | His 1937 prepared statement claims a "dynamic theory of gravity", rejects curved space, and calls the ether indispensable ([statement](https://teslauniverse.com/nikola-tesla/articles/prepared-statement-nikola-tesla)); the theory was never published | Fringe / unverified (no published theory) | Inspiration only |
| **Keely** (sympathetic vibratory physics) | After he died in 1898, investigators found hidden high-pressure tubing and a reservoir: his demonstrations were powered by compressed air ([*Scientific American* 1899](https://doi.org/10.1038/scientificamerican02041899-72), [NEH](https://www.neh.gov/humanities/2010/mayjune/curio/the-etheric-force-machine)) | Shown to be fraud | Nothing to adopt |
| **Walter Russell** | 1926 octave-wave periodic chart; never engaged by mainstream science ([archive project's scoreboard](https://charts.walterrussellarchive.org/scoreboard.html)) | Fringe | His octave framing matches the ladder only by analogy |
| **Chladni / Jenny (cymatics)** | Chladni figures are a plate's natural vibration patterns. Jenny's cymatics documents them visually but doesn't establish any further laws ([Smithsonian](https://www.americanhistory.si.edu/acoustics/chladni-plates)) | Chladni: established; wider cymatics claims: fringe | Supports HCS's "render, not source" rule: patterns are views of a mode, and the source data stays separate |
| **Couder & Bush** (walking droplets) | Real experiments: a bouncing droplet is guided by its own wave field, and the bath **stores the droplet's path history** ("path memory"; Me = T_d / [T_F(1 − γ/γ_F)], which grows as forcing nears the Faraday threshold) ([Bush 2015](https://www.annualreviews.org/content/journals/10.1146/annurev-fluid-010814-014506), [Bush & Oza 2021](https://thales.mit.edu/bush/wp-content/uploads/2021/04/BushOza-ROPP.pdf)). The double-slit claim failed to reproduce ([Andersen et al. 2015](https://doi.org/10.1103/physreve.92.013006), [Quanta 2018](https://www.quantamagazine.org/famous-experiment-dooms-pilot-wave-alternative-to-quantum-weirdness-20181011/)) | Established as fluid dynamics; limited as a quantum analog | **The best physical model for an h-field memory.** A decaying wave field that stores the history and steers what comes next, with memory time set by closeness to a threshold. A design idea: tie band half-lives to how close the field sits to its coherence threshold |
| **Superfluid vacuum / analog gravity** (Volovik) | Relativity-like and gravity-like behaviour emerging in superfluid helium ([*The Universe in a Helium Droplet*](https://academic.oup.com/book/11557)) | Minority-but-serious (analog models, not proof) | The modern, respectable version of "aether as fabric". It gives a vocabulary: excitations and modes of a shared medium |

**Bottom line on "h-field as fabric":**

- **As a software design:** treat the h-field as a shared *field of stored potential*, in Steinmetz's sense. Facts are stable topological ids (Kelvin), memories are modes that couple when in phase (Bjerknes), and the field keeps a decaying history that guides retrieval (Bush). All of that can be built today and checked by tests.
- **As physics:** the claim that the h-field *is* the literal ether or spacetime fabric is not supported by any source above. Steinmetz, whom Nic cites, explicitly rejected the ether. Keep that claim as Nic's own hypothesis, outside Forge's fact store.

# 13. Why 9, and the "Kupferberg's constant" hypothesis

**What Nic wrote.** His doc [Hypothesis: Kupferberg's Constant Resolves to 9 ...](https://docs.google.com/document/d/1qfK4v3_c-g4Kwat7mAh_uEoPiNlV3uYIeYY-yRCbN30/edit) argues that 9 is the "terminal symbol of coherence". [Beyond the Simulation](https://docs.google.com/document/d/1t9HrBxGFbKs1_jf4ct9-VeumS2ABm5nIgHt3YHCn3pY/edit) describes a 1–9 cycle with 9 as the attractor.

**What is real math [Established]:**

- **No "Kupferberg's constant" exists** in the mathematical record that was searched. The behaviour described matches **Kaprekar's routine**: sort a 4-digit number's digits high-to-low and low-to-high, subtract, repeat, and you reach **6174** ([MathWorld](https://mathworld.wolfram.com/KaprekarRoutine.html)).
- **Why the results always come back to 9.** Any number has the same remainder mod 9 as its digit sum. A number and any rearrangement of its digits share a digit sum, so their difference is always a multiple of 9. For digits a ≥ b ≥ c ≥ d, the Kaprekar difference is 999(a − d) + 90(b − c). Every non-zero step therefore has digital root 9, and 6174 has digit sum 18.
- **This is a base-10 property.** In base b the same thing happens with b − 1 (in base 12, with 11). So 9's "closure" comes from counting in tens. It isn't a law of phase fields.

**Effect on Forge:** none needed. Nine slots are justified on engineering grounds: the 9-phase `.hfield` profile, the 3×3 layout, and room for the roles. Nine is also a 3-smooth number, which fits Nic's ×3/×9 band relations. The Kaprekar property is a nice mnemonic for Nic's FBSC writing, but it shouldn't be used as a justification inside the key.

# 14. Top surprising findings

1. **Forge already has a band table, and it disagrees with spec v0.1.** `band_tuning.js` uses an 80–220 Hz row with the 144 Hz carrier *inside* it, plus 144-divisor markers related by ×3 and ×9. Nic's own papers put 144 at the *opening* of the ripple band. The research shows 144 really does sit on the border between human ripples (80–150) and rodent ripples (140–220).
2. **Steinmetz explicitly rejected the ether** ("There is no such thing as the ether", 1923), while Tesla insisted on it (1937). Nic's paper groups them together. Even so, Steinmetz's "energy field stored in space", together with Bush's droplet "path memory", is the strongest real precedent for an h-field that works as memory.
3. **Forge's real kāraka roles aren't the spec's.** Forge's grammar already uses 12 role and relation names that line up with the IIIT Pāṇinian treebank (k1–k7, with time and place split, r6, rh). The spec's `māna` and `nibandhana` are inventions. Also, Supabase hashes facts with **SHA-256, not BLAKE3**. Both need fixing in spec v0.2.

Also notable:

- Nic's own writing conflicts on ultrasonics: a 17 kHz mesh in Waking the Web against "no hidden ultrasonic payloads" in the HCS doc.
- Bjerknes's in-phase attraction mirrors Forge 204's attraction model.

# 15. Next step

These answers can be folded into **spec v0.2**:

- ripple row 80–220
- new slots 7 and 8
- SHA-256 ids
- symmetric-predicate rule
- audible default
- MAC rule
- reinforcement by stretching half-life
- half-lives based on 168 h

That needs Nic to approve or change the recommendations above. No Forge code, HCS code or Supabase data was changed in this research.
