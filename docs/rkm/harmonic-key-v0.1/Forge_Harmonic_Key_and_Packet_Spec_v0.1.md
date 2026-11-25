---
title: "Forge Harmonic Key and Packet Spec"
subtitle: "Version 0.1 (draft for review), November 25, 2026"
author: "Prepared for Nic Bogaert, Forge Mobile"
---

# 0. How to read this

This spec defines three things:

1. **The Harmonic Key.** A fixed table of numbers that every Forge carries. It says what each memory "station" means.
2. **The memory address.** How a memory is placed on that table, and how a question "tunes in" to it like a radio.
3. **The Forge packet.** How two Forges send memories to each other as `.hfield` packets, over a network or over a speaker and microphone.

Every statement carries one of these labels:

- **[Fact]** Established engineering or neuroscience. These are general-knowledge statements, not new citations.
- **[Design]** A choice made in this spec. It can be changed, and the reason is given.
- **[Open]** A question for Nic to decide (collected in section 15).

All example facts, publisher names and instance names are **EXAMPLE DATA** used only to show the encoding. Nothing here is a stored Forge fact.

# 1. Purpose

Forge stores verified facts as structured kāraka clauses made of atoms, in the shared hosted Supabase memory (the "hive mind"). This spec adds a **phase-frequency address layer** on top of those facts:

- **What kind of memory it is** is given by a **band** (delta through the 144 Hz ripple ceiling).
- **Where it sits** is given by a **phase slot** inside the band: the clause role, the step number in a sequence, the gate state, and so on.
- **How strong it is** is given by an **amplitude** that decays unless the memory is reinforced.

A question gets turned into the same kind of address (a "signature"). Memories respond when they are inside the tuning width of that signature. That is the radio-tuning idea.

Because every Forge carries the same key, two Forges only have to exchange **coordinates and hashes**, never the meaning itself. That keeps a message small enough to travel as sound.

**What this layer does not do [Design, hard rule].** The tuning layer only decides *which memories light up and in what order*. It never decides what is true, and it never changes these:

| Rule | Value (unchanged) |
|---|---|
| Gilligan confidence floor | C_min = 0.87 |
| Echo to speak / to write | 0.85 / 0.97 |
| Drift thresholds | 0.35 / 0.40 / 0.80 |
| Independent publishers per fact | at least 2 (Wikipedia pointer only, Wikidata cross-check only) |
| Ask | never auto-persists; only explicit Remember or Athena's gated write path stores facts |
| Reasoner | no LLM (`calls_llm:false`), no template or regex semantics, no hardcoded answers |

A tuning response score is **not** a confidence score and is never compared against C_min or Echo.

# 2. The brain-band background

**[Fact]** Brain rhythms are usually grouped into bands. The exact edges vary between labs and papers, and the ranges below are the common textbook ones. The links between bands and functions are *associations* that research has found. They are not one-to-one jobs.

- **Delta** (about 1–4 Hz) is prominent in deep sleep and linked to memory consolidation.
- **Theta** (about 4–8 Hz) is linked to sequences, navigation and episodic context.
- **Alpha** (about 8–13 Hz) is widely discussed as a gating or inhibition rhythm, meaning it suppresses what is irrelevant.
- **Beta** (about 13–30 Hz) is linked to holding the current motor or cognitive state.
- **Gamma** (about 30–80 Hz) is linked to binding the features of one item together.
- **Ripples** (sharp-wave ripples) are linked to replay and consolidation of memories. In humans they are usually reported around 80–150 Hz, and in rodents they run faster.

**[Fact]** Slow and fast rhythms nest. The phase of a slow wave modulates the strength of a faster one; this is called phase-amplitude coupling. Theta-gamma coupling is the best-known case.

**About 144 Hz.** The roughly 90 Hz co-ripples from Garrett 2024 that came up in the book review were recorded with electrodes inside the brain, not at the scalp. Even so, the human ripple range reaches up to about 150 Hz. So **[Design]** putting the top carrier at **144 Hz, the ceiling of the ladder**, is a choice that fits inside the measured ripple range, sitting right at the cusp before the very fast range. The spec does not claim 144 Hz is a measured brain constant.

# 3. The ladder: bands and carriers

**[Design] Carriers are an octave ladder down from the 144 Hz root:** carrier = 144 / 2^k. This puts exactly one carrier inside every classical band:

- 2.25 Hz (delta)
- 4.5 Hz (theta)
- 9 Hz (alpha)
- 18 Hz (beta)
- 36 Hz (gamma)
- 72 Hz (reserved)
- 144 Hz (ripple ceiling)

Why an octave ladder:

1. Every carrier is a whole multiple of every slower one. So a slow cycle always holds an exact whole number of fast cycles, which makes nesting (section 7) clean.
2. All carriers line up again every 1/2.25 s (about 444 ms).
3. Carriers one octave apart are far enough apart that a band barely hears its neighbours (see the crosstalk table in section 8).

These are **logical** frequencies, meaning numbers used in the addressing and tuning math. They are not played as sound and not measured from anyone's brain.

| # | Band | Range (Hz) | Carrier (Hz) | Rule | Memory kind | Q band* | Q tune | κ | Half-life | Amp floor |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | delta | 1–4 | 2.25 | 144 / 64 | consolidated long-term fact (verified, stored) | 0.75 | 6 | 12 | 1 year | 0.25 |
| 1 | theta | 4–8 | 4.5 | 144 / 32 | sequence / context / trace order | 1.125 | 3 | 6 | 30 days | 0.0 |
| 2 | alpha | 8–13 | 9 | 144 / 16 | gating / suppression of what is irrelevant now | 1.8 | 8 | 16 | 1 hour | 0.0 |
| 3 | beta | 13–30 | 18 | 144 / 8 | active task / rule hold (working state) | 1.059 | 4 | 12 | 15 min | 0.0 |
| 4 | gamma | 30–80 | 36 | 144 / 4 | binding: the parts of one item | 0.72 | 4 | 10 | 7 days | 0.0 |
| 5 | ripple | 80–144 | 144 | 144 / 1 | replay / consolidation (Athena re-check during Neo idle ticks) | 2.25 | 3 | 6 | 1 min | 0.0 |
| 6 | reserved | (high gamma) | 72 | 144 / 2 | reserved; decoders reject in key 0.1 | – | – | – | – | – |
| 7 | none | – | – | – | means "no parent" in the parent field only | – | – | – | – | – |

\*Q band = carrier ÷ band width. It only describes how wide the biological band is. **Q tune** is the design dial that actually controls how sharply each band's memories respond. **κ** controls phase sharpness. Both are used in section 8.

Why the Q tune and κ values were picked **[Design]**:

- **Delta (Q 6, κ 12).** Facts must respond sharply. A wrong clause role should not answer.
- **Theta (Q 3, κ 6).** Context should spread a little, so neighbouring sequence steps come back together.
- **Alpha (Q 8, κ 16).** Gates must be crisp. "Speculative" must never blur into "pass".
- **Beta (Q 4, κ 12).** Working state is moderately sharp.
- **Gamma (Q 4, κ 10).** Binding is moderately sharp.
- **Ripple (Q 3, κ 6).** Replay is broad, because Athena re-checks a neighbourhood.

# 4. Phase slots: 9 slots at 40°, grouped as 3 triads of 120°

**[Design]** Each band has **9 phase slots** spaced 40° apart (0°, 40°, … 320°). The slots are grouped into three triads that start at 0°, 120° and 240°.

Why this layout:

- **It matches `.hfield`.** The `.hfield` format already has a 9-phase profile (`phase_count: 9`). Slot *s* maps to `.hfield` phase *s + 1*.
- **It keeps the book's three-phase structure.** The triad starts are exactly 0°/120°/240°, so the three-phase idea is kept without losing resolution.
- **There are exactly enough clause roles.** Nine slots hold the seven kāraka-style roles, plus the predicate and a qualifier, with no spare slot left over to tempt hardcoding.
- **Neighbours are distinguishable.** With κ = 12, a neighbouring slot (40° away) only gets 0.06 of the response. Two slots away (80°) gets 4.9e-05.

**Note on HCS anchors.** The `.hfield` anchors (1, 5, 9) and the phase play order [2,1,3,4,5,6,7,9,8] are HCS rendering concepts. Forge copies them unchanged for compatibility and gives them no meaning. The anchor ratios come from the canonical file (1 / 0.5 / 3), not from the design doc's 1/3/9 example. **[Open]** Which of the two is correct?

# 5. The Key Matrix (key 0.1.0)

Rows are bands and columns are phase slots. Each cell has a **role code**, a one-byte number equal to band × 16 + slot, and a meaning. The same matrix ships as `forge_harmonic_key_v0.1.json` and `.csv`.

| Band / Slot | 0 (0°) | 1 (40°) | 2 (80°) | 3 (120°) | 4 (160°) | 5 (200°) | 6 (240°) | 7 (280°) | 8 (320°) |
|---|---|---|---|---|---|---|---|---|---|
| **delta** (2.25 Hz) | 0x00 kriya | 0x01 karta | 0x02 karma | 0x03 karana | 0x04 sampradana | 0x05 apadana | 0x06 adhikarana | 0x07 mana | 0x08 nibandhana |
| **theta** (4.5 Hz) | 0x10 seq_1 | 0x11 seq_2 | 0x12 seq_3 | 0x13 seq_4 | 0x14 seq_5 | 0x15 seq_6 | 0x16 seq_7 | 0x17 seq_8 | 0x18 seq_9 |
| **alpha** (9 Hz) | 0x20 pass | 0x21 suppress_irrelevant | 0x22 suppress_contradicted | 0x23 hold_pending | 0x24 speculative | 0x25 ghost | 0x26 tier_cold | 0x27 tier_deep | 0x28 quarantine_peer |
| **beta** (18 Hz) | 0x30 current_question | 0x31 active_rule | 0x32 active_gap | 0x33 constraint | 0x34 expected_type | 0x35 unit_frame | 0x36 peer_session | 0x37 pending_followup | 0x38 reserved_b8 |
| **gamma** (36 Hz) | 0x40 head | 0x41 class | 0x42 attribute | 0x43 value | 0x44 unit | 0x45 part_whole | 0x46 alias | 0x47 publisher | 0x48 evidence |
| **ripple** (144 Hz) | 0x50 replay_request | 0x51 re_lookup | 0x52 re_simulate | 0x53 re_derive | 0x54 gilligan_recheck | 0x55 reinforce | 0x56 demote | 0x57 readmit | 0x58 fixed_point |

**What each slot means, band by band:**

- **delta** (scheme `clause_role`): 0 = predicate / relation (the verb or relation of the clause); 1 = agent / subject; 2 = object / patient; 3 = instrument / means; 4 = recipient / beneficiary; 5 = source / point of departure ('from'); 6 = locus: place, time, medium or context; 7 = measure: value with unit; 8 = qualifier: condition, scope, negation, statistic (mean, max...)
- **theta** (scheme `sequence_position`): 0 = position 1 (Forge loop convention: held Ask); 1 = position 2 (Neo tick); 2 = position 3 (Athena lookup / simulate / derive); 3 = position 4 (Gilligan check); 4 = position 5 (resumed answer); 5 = position 6; 6 = position 7; 7 = position 8; 8 = position 9 (longer sequences continue in a new window, flag CONT)
- **alpha** (scheme `gate_state`): 0 = open gate: eligible for retrieval; 1 = inhibit: off-topic for the current task; 2 = inhibit: contradicted, awaiting Athena re-check; 3 = held Ask waiting for Neo/Athena; 4 = speculative bin: NEVER on the speaking path; 5 = failed / rejected attempt store (kept, never spoken); 6 = collapsed to cold tier (kept, not deleted); 7 = collapsed to deep tier (kept, not deleted); 8 = received peer claim not yet through Gilligan
- **beta** (scheme `task_slot`): 0 = the Ask being answered; 1 = rule or law currently applied; 2 = the gap Athena is filling; 3 = constraint on the answer (units, range, scope); 4 = expected answer type (quantity, entity, yes/no...); 5 = unit system in force; 6 = current Forge-to-Forge session; 7 = follow-up question queued; 8 = reserved
- **gamma** (scheme `binding_part`): 0 = head entity of the item; 1 = type / class; 2 = attribute name; 3 = value; 4 = unit; 5 = part-of / has-part link; 6 = name / alias / surface form; 7 = publisher lineage reference; 8 = evidence hash / timestamp
- **ripple** (scheme `replay_stage`): 0 = Neo schedules a replay; 1 = Athena re-looks-up sources; 2 = Athena re-runs a simulator; 3 = Athena re-derives; 4 = Gilligan re-validates under the same fixed gates; 5 = passed: amplitude reinforced; 6 = failed: collapse one tier; 7 = re-admission attempt (counted, cap 5); 8 = fixed-point check: re-inference gives identical fact set

**Delta columns are kāraka roles.** They form three triads:

- **Core clause (0–2):** kriyā (the relation), kartā (the agent or subject) and karma (the object).
- **Participants (3–5):** karaṇa (the instrument), sampradāna (the recipient) and apādāna (the source).
- **Frame (6–8):** adhikaraṇa (the locus), māna (the measure) and nibandhana (the qualifier).

Gamma carries the parts of one item, such as a value bound to its unit. A gamma item **nests inside** the delta slot it fills.

**Things the matrix deliberately does not contain.** It has no objects, properties or answers, only *roles*. Atoms (for example "moon" or "earth") are never in the key. They live in the facts and travel as hashes.

**Key hashes.**

- Structure hash (BLAKE3): `bfae15f75ea4d911c23ea7cb8da2a1b5d7ff22f74027b1c3bda5ea29f67adfcc`
- Structure fingerprint (first 4 bytes, sent in every acoustic frame): **`bfae15f7`**
- Full-key hash (structure plus tuning): `01813586d0006fcd213e8d2c0adb9b5d25e42138bd32152bbacbedbd1c55dc02`

# 6. Address encoding

## 6.1 The 24-bit address word [Design]

| Bits (MSB→LSB) | Field | Values |
|---|---|---|
| 23–21 (3 bits) | band | 0 delta … 5 ripple, 6 reserved, 7 invalid as a record band |
| 20–17 (4 bits) | slot | 0–8 (9–15 invalid) |
| 16–13 (4 bits) | amp_q | amplitude × 15, rounded (0–15) |
| 12–10 (3 bits) | parent_band | band of the slow window this item rides in; 7 = no parent |
| 9–6 (4 bits) | parent_slot | slot of that window |
| 5–0 (6 bits) | flags | bit5 VERIFIED_REF, bit4 SPECULATIVE, bit3 CONTRADICTS, bit2 REQUEST (this slot is the gap being asked), bit1 CONT (sequence continues past slot 8), bit0 reserved |

A **record** is the 3-byte address plus an 8-byte identifier, 11 bytes in total. The identifier is the first 8 bytes of a fact id (for facts) or of an atom id (for queries).

## 6.2 Hash-keyed ids [Design, adopted from the File8 / memory-core-stacks notes]

- **Canonical clause.** JSON with keys sorted, no spaces, UTF-8, Unicode NFC. Numbers are written as decimal strings in SI units, and `k` is a version tag (`forge.clause.v1`).
- **fact_id = BLAKE3(canonical clause).** Evidence, publishers, amplitude and timestamps are **not** part of the id. Two Forges that verify the same clause from different sources get the same id, which is how the hive mind deduplicates.
- **atom_id = BLAKE3(canonical atom).**
- **Restores.** A restore or sync refuses any fact whose recomputed hash doesn't match its id.
- **[Fact]** With an 8-byte (64-bit) prefix, an accidental collision becomes likely only after about 4 billion facts. Receivers always resolve the prefix to the full 32-byte id in Supabase, and they ask for more bytes if the prefix is ambiguous.

## 6.3 Example fact 1 (EXAMPLE DATA): the speed of light in vacuum is 299,792,458 m/s

Canonical clause:

```
{"k":"forge.clause.v1","roles":{"adhikarana":{"t":"medium","v":"vacuum"},"karta":{"t":"entity","v":"light"},"kriya":{"t":"relation","v":"speed"},"mana":{"t":"quantity","u":"m/s","v":"299792458"}}}
```

- fact_id = `a6822b68cb50a5ef73554dc74098c660353fec442745146fe9548f830a1da432`
- amplitude 1.0 → amp_q 15; flags VERIFIED_REF
- **Fact record (11 bytes):** `01fc20a6822b68cb50a5ef`. That is the address `01fc20` (delta, slot 0, the clause head) followed by the fact id prefix.

| Atom role | Slot / phase | Role code | Address (hex) | atom_id prefix |
|---|---|---|---|---|
| kriya = speed | 0 / 0° | 0x00 | `01fc20` | `b02abf4232119ac2` |
| karta = light | 1 / 40° | 0x01 | `03fc20` | `bdd2a20f751da3db` |
| adhikarana = vacuum | 6 / 240° | 0x06 | `0dfc20` | `08d3f197234d741f` |
| mana = 299792458 m/s | 7 / 280° | 0x07 | `0ffc20` | `64dce1cbedf27915` |

## 6.4 Example fact 2 (EXAMPLE DATA): the mean distance from the Moon to Earth is about 384,400 km

Canonical clause:

```
{"k":"forge.clause.v1","roles":{"apadana":{"t":"entity","v":"earth"},"karta":{"t":"entity","v":"moon"},"kriya":{"t":"relation","v":"distance"},"mana":{"t":"quantity","u":"m","v":"384400000"},"nibandhana":{"t":"qualifier","v":"mean"}}}
```

- fact_id = `ff7075d6a9e63094f2d9580bb37d0db202402f03ceee42f8efada56f00558a55`
- amplitude 0.8 → amp_q 12; flags VERIFIED_REF
- **Fact record (11 bytes):** `019c20ff7075d6a9e63094`. That is the address `019c20` (delta, slot 0, the clause head) followed by the fact id prefix.

| Atom role | Slot / phase | Role code | Address (hex) | atom_id prefix |
|---|---|---|---|---|
| kriya = distance | 0 / 0° | 0x00 | `019c20` | `7f7497471e09bf36` |
| karta = moon | 1 / 40° | 0x01 | `039c20` | `d84eef325a731571` |
| apadana = earth | 5 / 200° | 0x05 | `0b9c20` | `154e511ecfecd9eb` |
| mana = 384400000 m | 7 / 280° | 0x07 | `0f9c20` | `4e67dd79830d5252` |
| nibandhana = mean | 8 / 320° | 0x08 | `119c20` | `d2e0db7e23066214` |

**Nested gamma binding.** The value and the unit of the māna atom are bound as gamma items that ride inside the delta slot 7 window (parent = delta/7):

| Gamma part | Gamma slot | Address (hex) | atom_id prefix |
|---|---|---|---|
| value = 384400000 | 3 (120°) | `8781e0` | `9eb69ae478d4b05d` |
| unit = m | 4 (160°) | `8981e0` | `0fb9ca9a82c6f790` |

## 6.5 Trace order in theta [Design]

The Forge loop trace `held>neo>athena>gilligan>resumed` is placed on theta slots 0–4, nested in the beta `current_question` window (parent = beta/0). Two rules from the earlier notes become checks on this:

- A trace that **skips a slot or runs out of slot order** counts as drift and is rejected.
- A sequence longer than 9 steps continues in a new theta window with the CONT flag set.

# 7. Nesting (fast inside slow)

**[Fact basis, Design use]** A fast item names its slow window through parent_band and parent_slot. When a query has an active slow window, each fast item's response is multiplied by a phase-amplitude coupling term:

N = (1 + m·cos(φ_window − φ_parent)) / (1 + m), with modulation depth m = 0.9.

| Phase offset from the window | 0° | 40° | 80° | 120° | 180° |
|---|---|---|---|---|---|
| N | 1.0 | 0.8892 | 0.6086 | 0.2895 | 0.0526 |

So when Forge tunes to the delta māna window (slot 7), the gamma value and unit riding in that window come back **together**, already bound. One context pulls back its whole connected group.

# 8. Retrieval: the tuning math [Design]

For a query signature *q* and a stored fact *f*, three things are computed:

1. **Band response** (the standard second-order resonance curve): B = 1 / (1 + Q²·(f_m/f_q − f_q/f_m)²), using the memory band's Q tune.
2. **Phase response** (a von Mises curve): Φ(Δφ) = exp(κ·(cos Δφ − 1)), using the band's κ.
3. **Atom match.** For each known query atom, m_i = Φ(Δφ) when the fact contains that atom (Δφ is the gap between the query role and the stored role). An atom the fact doesn't contain gets the floor ε = 0.05.

Then:

- **Match:** M = B · (∏ max(m_i, ε))^(1/n). This is a geometric mean, so a single wrong role pulls the whole match down.
- **Gating:** M is multiplied by N (section 7) when a slow window is active, and by 0.1 when the fact is under an alpha suppress tag.
- **Response:** R = A · M, where A is the amplitude.

M decides **whether** a memory answers, and the amplitude only decides **how loud** it is, i.e. its rank. An old fact sitting at its amplitude floor is still found.

| Result | Rule | What Forge does |
|---|---|---|
| **Lit** | M ≥ 0.5 | candidate goes to Gilligan; can be spoken only if gates pass |
| **Near miss** | 0.05 ≤ M < 0.5 | weak response; handed to Athena as a gap lead; never spoken |
| **Silent** | M < 0.05 | ignored |

**Hard exclusions [Design].** Memories in alpha `speculative`, `ghost` or `quarantine_peer` are removed from the speaking path whatever their score. Athena can still see them.

**Band crosstalk B.** A query tuned to the row band, heard by a memory in the column band:

| query → memory | delta | theta | alpha | beta | gamma | ripple |
|---|---|---|---|---|---|---|
| delta | 1.0000 | 0.0471 | 0.0011 | 0.0010 | 0.0002 | 0.0000 |
| theta | 0.0122 | 1.0000 | 0.0069 | 0.0044 | 0.0010 | 0.0001 |
| alpha | 0.0020 | 0.0471 | 1.0000 | 0.0270 | 0.0044 | 0.0004 |
| beta | 0.0004 | 0.0078 | 0.0069 | 1.0000 | 0.0270 | 0.0018 |
| gamma | 0.0001 | 0.0018 | 0.0011 | 0.0270 | 1.0000 | 0.0078 |
| ripple | 0.0000 | 0.0001 | 0.0001 | 0.0010 | 0.0044 | 1.0000 |

**Phase response Φ by band** (what fraction of the response a memory gets when it sits *x* degrees from the tuned slot):

| band | 0° | 40° (next slot) | 80° | 120° | 160° |
|---|---|---|---|---|---|
| delta | 1 | 0.0604 | 4.94e-05 | 1.52e-08 | 7.78e-11 |
| theta | 1 | 0.246 | 0.00703 | 0.000123 | 8.82e-06 |
| alpha | 1 | 0.0237 | 1.81e-06 | 3.78e-11 | 3.32e-14 |
| beta | 1 | 0.0604 | 4.94e-05 | 1.52e-08 | 7.78e-11 |
| gamma | 1 | 0.0964 | 0.000258 | 3.06e-07 | 3.77e-09 |
| ripple | 1 | 0.246 | 0.00703 | 0.000123 | 8.82e-06 |

## 8.1 Worked retrieval example (EXAMPLE DATA)

**The question:** "On average, how far is the Moon from Earth?"

The question is parsed into a delta signature:

- kriyā = distance (slot 0)
- kartā = moon (slot 1)
- apādāna = earth (slot 5)
- nibandhana = mean (slot 8)
- the gap: **māna** (slot 7, REQUEST flag set)

Example fact 2 was admitted with A = 0.8. After 30 days without reinforcement its amplitude has decayed to A = 0.756.

| Case | M | R = A·M | Result |
|---|---|---|---|
| All 4 known atoms in the right roles | 1.000 | 0.756 | **Lit**. Read slot 7, which brings the gamma value 384400000 and unit m with it; then Gilligan, then speak if the gates pass |
| One atom stored one slot off (40°) | 0.496 | 0.375 | Near miss (just under 0.5) |
| One atom in a far role (160°, for example Earth as agent instead of source) | 0.473 | 0.357 | Near miss: treated as "atom absent" |
| Only 2 of 4 atoms present | 0.224 | 0.169 | Near miss → Athena lead |
| Same atoms, but the query was tuned to theta | 0.012 | – | Silent (wrong band) |
| A fact 3 years old, sitting at the delta floor A = 0.25, exact match | 1.000 | 0.250 | Lit (quieter, still found) |

**Order independence [Design, a test requirement].** Tuning only produces the candidate list. Gilligan judges each candidate on its own. Two things are required:

- Running the gates in any order gives the same verdicts.
- Running a retrieval leaves stored facts byte-for-byte unchanged. Amplitude reinforcement is written as a separate log event after the answer, not during scoring.

# 9. Decay, reinforcement and keeping everything

**Decay [Design]:** A(t) = max(floor, A₀ · 2^(−Δt / half-life)), using the band's half-life and floor (section 3).

- A delta fact at 1.0 drops to 0.710 after 180 days with no use. It never falls below 0.25, because verified facts are never forgotten through decay.
- A theta context halves in 30 days.

**Reinforcement [Design]:** A ← A + η·(1 − A).

| Event | η |
|---|---|
| Gilligan admits, or re-admits | 0.5 |
| Used in an answer that passed the gates | 0.1 |
| Ripple replay passed the Gilligan re-check | 0.2 |
| A peer Forge referenced it and it resolved to the same fact | 0.05 (capped at 0.05 per peer per day, so a peer cannot pump a memory) |

For example, 0.711 + 0.1·(1 − 0.711) = 0.739.

**Weakening never deletes [Design, from ProtoForge Phase Memory Architecture].**

- **When Gilligan confirms a contradiction:** the fact's amplitude is halved (×0.5), the fact gets the alpha `suppress_contradicted` tag, and the contradicted source gets a strike in the strike ledger.
- **When a fact loses its second independent publisher:** it collapses to `tier_cold`, and its delta floor no longer applies.
- **What collapsed facts keep:** the id, the atoms, the lineage and the reason. They are never deleted.
- **Coming back from a tier:** the fact goes through the ripple stages (re_lookup → gilligan_recheck → readmit). It needs new independent evidence under the same 0.87 / 0.97 gates.
- **Re-admission limit:** at most **5** re-admissions. The 6th attempt is refused and flagged for Nic's review. Every attempt is logged, and a re-admission with no log entry is refused.

**Append-only log [Design].** Every admit, demote, readmit, peer claim received, and amplitude change is written as a log entry. Each entry is chained by hash: entry_hash = BLAKE3(previous_hash ‖ canonical entry). Restoring from backup must reproduce the same chain head.

**The speculative bin.** Speculative and derived-but-not-admitted items (for example GILLIGAN-SIMULATED / DERIVED with may_store_as_fact = false) live under alpha `speculative`. The speaking path cannot read that bin.

# 10. Key versioning

- **Version format.** The key version is semver, `MAJOR.MINOR.PATCH`. This document is **0.1.0**.
- **Structure hash** = BLAKE3 over the bands, carriers, slot count, role codes, address layout and flag list. That is everything a receiver needs to *decode*. Any change to these is a **MAJOR** bump, which gives a new structure fingerprint. Two Forges with different structure fingerprints **refuse** to exchange records.
- **Full hash** = structure plus the tuning values (Q, κ, half-lives, η, thresholds). Changing only the tuning is a **MINOR** bump. Peers with different tuning can still talk, because the tuning only affects local ranking. The difference is reported in the handshake.
- **Distribution.** The key is distributed as `forge_harmonic_key_v0.1.json`. A Forge loads it at start-up, recomputes both hashes, and refuses to run the bridge if they don't match the values in the file.
- Current structure fingerprint: **`bfae15f7`**.

# 11. The Forge `.hfield` packet (full JSON mode)

This mode is for network and file transfer, and for archiving. **[Fact, from the HCS source]** The packet is a normal HCS `FieldScore`, so every field the HCS validator requires is kept:

- `format: "aiweb.hfield"` and `version: "0.1.0"`
- packet contract `aiweb.hfield.packet_contract.v1`
- `phase_count: 9` with order `[2,1,3,4,5,6,7,9,8]` and anchor layout `center_1_lower_5_upper_9`
- root 144.0 Hz in both places it appears
- the required payload layers `score, frequency_phase, gesture, field, render, forge_bridge`
- `Forge` in `target_systems`
- an identity-vault reference-only custody model, with no raw private identity exported
- at least one music track (HCS rejects an empty track list)

**What Forge adds [Design]:**

1. **`packet.forge_bridge` is filled in** (no longer `reserved`):
   - `status: "bound"`
   - `bridge_profile: "forge_memory_bridge_v1"`
   - `forge_runtime_ref`
   - `symbolic_trace_ref = blake3:<trace hash>`
   - `validation_ref`
2. **A new payload layer `forge_memory`** and a top-level `forge_memory` object.
3. **The `forge_memory` object holds:**
   - `key`: the key id and version, plus the structure fingerprint and both hashes.
   - `message`: type, session, sequence number, time (UTC), sender and receiver.
   - `records`: for each record, the fact id, the address (as fields and as compact hex), an optional full canonical clause, atom ids by role, and evidence (lineages and an independent-publisher count). It also carries the sender's gate report, which is **informational only**.
   - `trace`: the theta-ordered trace, with its hash.
   - `receiver_policy`: claim only, must pass Gilligan, no auto-persist, and the fixed gates.
   - `payload_hash_blake3`: BLAKE3 of the canonical `forge_memory` object, with this field left out.
4. **One view-only music track** (`forge_root_reference`, a single note near the 144 Hz root), there only to satisfy HCS.
5. **Rendering rule.** Audio and acoustic frames are *renderings* of this object, the same way HCS treats audio as a rendering of the score. The JSON is the source.

**Compatibility check (run today).** The example packet was loaded into the actual HCS Rust code (a copy of `harmonic-conductor-studio` at commit 0f2af29), using `FieldScore` deserialization, `validate_hfield_packet_contract` and `create_forge_packet_bridge_stub_report`:

```
FieldScore deserialize: OK
validate_hfield_packet_contract: status=warning, fatal_errors=[]
create_forge_packet_bridge_stub_report: status=warning, fatal_errors=[]
warnings (expected for an unsigned example): authority receipt reference is not yet bound;
  consent event reference is not yet bound; provenance hash is not yet sealed;
  packet contains no conductor gesture events yet
Note: the first run failed with "packet music track list must not be empty", so the packet
now carries one view-only music track (forge_root_reference) to satisfy HCS.
```

**Known gap [Open].** HCS's Rust structs don't yet have a `forge_memory` field. HCS can *read* these packets and will validate them, but if HCS re-saves one, the `forge_memory` object is silently dropped (serde ignores unknown fields). The fix is a one-line optional field on `FieldScore` in `hfield-domain`, plus extending `ForgeBridge` with the bound fields.

An abbreviated example follows. The full file is `example_forge_packet_v0.1.hfield`.

```json
{
  "format": "aiweb.hfield",
  "version": "0.1.0",
  "packet": {
    "packet_kind": "forge_memory_exchange_packet",
    "source_system": "Forge",
    "target_systems": [
      "Forge",
      "HCS"
    ],
    "phase_profile": {
      "phase_count": 9,
      "phase_order": [
        2,
        1,
        3,
        4,
        5,
        6,
        7,
        9,
        8
      ],
      "anchor_layout": "center_1_lower_5_upper_9",
      "root_frequency_hz": 144.0,
      "communication_mode": "nine_phase_frequency_packet"
    },
    "payload_layers": [
      "score",
      "frequency_phase",
      "gesture",
      "field",
      "render",
      "forge_bridge",
      "forge_memory"
    ],
    "forge_bridge": {
      "status": "bound",
      "bridge_profile": "forge_memory_bridge_v1",
      "forge_runtime_ref": "forge-mobile@4.9.x",
      "symbolic_trace_ref": "blake3:681744de3169d5baeb4d7bb157049b0968cc94ac274905e9a7386f090707ba5d",
      "validation_ref": "gilligan:receiver_must_revalidate"
    },
    "…": "…"
  },
  "provenance": {
    "artifact_id": "forge.packet.3f84ac283846aff0",
    "custody_model": "identity_vault_reference_only",
    "forge_trace_ref": "blake3:681744de3169d5baeb4d7bb157049b0968cc94ac274905e9a7386f090707ba5d",
    "…": "…"
  },
  "root_frequency_hz": 144.0,
  "…": "anchors, music (1 view-only track), conductor (empty events)",
  "forge_memory": {
    "schema": "forge.hfield.memory.v1",
    "key": {
      "key_id": "forge.harmonic_key",
      "key_version": "0.1.0",
      "structure_fp": "bfae15f7",
      "structure_hash_blake3": "bfae15f75ea4d911c23ea7cb8da2a1b5d7ff22f74027b1c3bda5ea29f67adfcc",
      "full_hash_blake3": "01813586d0006fcd213e8d2c0adb9b5d25e42138bd32152bbacbedbd1c55dc02"
    },
    "message": {
      "type": "CLAIM",
      "session": "0x51",
      "seq": 1,
      "sent_at": "2026-11-25T13:40:00Z",
      "sender": "forge.instance.EXAMPLE-A",
      "receiver": "forge.instance.EXAMPLE-B"
    },
    "records": [
      {
        "fact_id": "ff7075d6a9e63094f2d9580bb37d0db202402f03ceee42f8efada56f00558a55",
        "address": {
          "band": "delta",
          "band_index": 0,
          "slot": 0,
          "phase_deg": 0,
          "hfield_phase": 1,
          "role_code": "0x00",
          "amplitude": 0.8,
          "amp_q": 12,
          "parent": null,
          "flags": [
            "VERIFIED_REF"
          ],
          "compact_hex": "019c20"
        },
        "clause": {
          "k": "forge.clause.v1",
          "roles": {
            "kriya": {
              "t": "relation",
              "v": "distance"
            },
            "karta": {
              "t": "entity",
              "v": "moon"
            },
            "apadana": {
              "t": "entity",
              "v": "earth"
            },
            "mana": {
              "t": "quantity",
              "v": "384400000",
              "u": "m"
            },
            "nibandhana": {
              "t": "qualifier",
              "v": "mean"
            }
          }
        },
        "atoms": [
          {
            "role": "kriya",
            "slot": 0,
            "phase_deg": 0,
            "role_code": "0x00",
            "atom_id": "7f7497471e09bf367a6edc35a85b7af29a4c1603511013f971687f0002ed68d3"
          },
          {
            "role": "karta",
            "slot": 1,
            "phase_deg": 40,
            "role_code": "0x01",
            "atom_id": "d84eef325a7315717e8f2909ac0500d252d94e91cd2c8925a8a32038179a4ef3"
          },
          {
            "…": "3 more atoms"
          }
        ],
        "evidence": {
          "lineages": [
            "lineage:EXAMPLE-publisher-A",
            "lineage:EXAMPLE-publisher-B"
          ],
          "independent_publisher_count": 2,
          "note": "placeholder lineages: example data only"
        },
        "sender_gate_report": {
          "note": "informational only; receiver recomputes with its own Gilligan",
          "admitted": true
        }
      },
      {
        "…": "record for example fact 1"
      }
    ],
    "trace": {
      "order": "held>neo>athena>gilligan>resumed",
      "trace_hash_blake3": "681744de3169d5baeb4d7bb157049b0968cc94ac274905e9a7386f090707ba5d"
    },
    "receiver_policy": {
      "content_is_claim": true,
      "must_pass_gilligan": true,
      "auto_persist": false,
      "speak_gate_echo": 0.85,
      "write_gate_echo": 0.97,
      "c_min": 0.87,
      "min_independent_publishers": 2
    },
    "payload_hash_blake3": "3f84ac283846aff00ab8eaa0b8deb9722ec3cc2fcd9a5f4abe8ec2a8ed823a2b"
  }
}
```

# 12. Acoustic transport (speaker and microphone)

## 12.1 Carrier choice

- **[Fact]** Phone speakers and microphones are poor below about 200 Hz, so the 144 Hz root and the lower logical carriers **cannot** be the physical sound. The 144 Hz root is a logical clock and address root only.
- **[Fact]** Multi-tone FSK (MFSK) tones stay separable (orthogonal) when they are spaced at a whole multiple of 1/T, where T is the length of one symbol.
- **[Design]** The tones are **16-MFSK on the 144 Hz harmonic grid:** tone k = 144 × (12 + k) Hz for k = 0…15, which runs **1728 Hz to 3888 Hz**. That range sits well inside the band where phone speakers and microphones work best. The tones are still tied to the 144 root, and the 144 Hz spacing satisfies the 1/T rule.
- **[Design] Symbol timing:**
  - each tone lasts 4/144 s (27.8 ms, an exact 4 cycles of the root);
  - a 1/144 s (6.9 ms) guard with a raised-cosine ramp follows, to soak up room echo;
  - one symbol is therefore 5/144 s = 34.7 ms and carries 4 bits.
- **Raw speed:** 115.2 bit/s = **14.4 bytes/s**, before error correction. That is in the "tens of bytes per second" range expected for data over sound. The exact performance depends on the room and must be measured on real phones.
- **Preamble:** a 0.25 s rising chirp from 1728 to 3888 Hz (for detection and level setting), then 4 sync symbols k = 0, 15, 0, 15.
- **Alternative profiles [Open]:**
  - near-ultrasonic, 17–20 kHz: quieter to people, but less reliable on some phones;
  - voice-call, 144 × (4…19) = 576–2736 Hz, for sending over a phone call. Call audio codecs may still mangle the tones.

## 12.2 Frame layout [Design]

| Bytes | Field | Notes |
|---|---|---|
| 0 | magic + frame version | `0xF1` (high nibble F = Forge harmonic, low nibble = frame version 1) |
| 1 | msg_type | 0x01 HELLO, 0x02 HELLO_ACK, 0x10 CLAIM, 0x11 QUERY, 0x12 ANSWER, 0x20 ACK, 0x21 NACK, 0x7F BYE |
| 2–5 | key structure fingerprint | `bfae15f7` for key 0.1 |
| 6 | session tag | 0x00 during the handshake; afterwards nonce_A[0] XOR nonce_B[0] |
| 7 | seq | frame counter; repeats are dropped |
| 8 | payload length N | max 64 (5 records), to keep frames under about 5 s |
| 9 … 8+N | payload | records (11 bytes each) or handshake fields |
| optional 8 | MAC | first 8 bytes of BLAKE3 keyed hash over bytes 0…8+N, present only when paired (section 13) |
| 2 | CRC-16/CCITT | over everything above; catches a mis-correction |
| 8 | Reed-Solomon parity | RS over GF(256) with 8 parity bytes |

**[Fact]** 8 Reed-Solomon parity bytes can correct **4 wrong bytes**, or **8 bytes known to be lost**. Each byte is two tones, so one bad tone damages at most one byte. **Tested today:** every example frame below was corrupted in 4 bytes and decoded back exactly.

## 12.3 Handshake [Design]

1. **A → HELLO.** Payload: key major, key minor, capability bits (bit0 = can pair or MAC), 4-byte nonce_A.
2. **B checks the fingerprint.**
   - If the fingerprint is the same: **B → HELLO_ACK** carrying nonce_A echoed back, nonce_B and its capabilities. The session tag becomes nonce_A[0] ⊕ nonce_B[0].
   - If the fingerprint is different: **B → NACK** with reason 0x01 KEY_MISMATCH and B's key version. No records are exchanged. The Forges can then swap key files over the network if Nic allows.
3. **Exchange.** CLAIM, QUERY and ANSWER frames, each answered with ACK(seq) or NACK(seq, reason). A frame is resent at most 2 times.
4. **BYE**, or a 10 s silence, ends the session.

## 12.4 Sizes and example frames (generated today; EXAMPLE DATA)

| Frame | Content | Data bytes | With RS | Air time |
|---|---|---|---|---|
| HELLO | version, caps, nonce | 18 | 26 | 2.19 s |
| HELLO_ACK | nonce echo, nonce, caps | 20 | 28 | 2.33 s |
| CLAIM | 2 fact records (example facts 1 and 2) | 33 | 41 | 3.24 s |
| QUERY | 4 known atoms plus 1 gap (the Moon example) | 66 | 74 | 5.53 s |
| ACK | seq | 12 | 20 | 1.78 s |
| CLAIM + MAC | 1 record, paired session | 30 | 38 | 3.03 s |

Air time includes the preamble. A full handshake plus one two-fact claim and its ACK takes about **9.5 s**. That is about 10× smaller than sending the two clauses as text, because the frame carries hashes and coordinates instead of words.

Example CLAIM frame (hex, with RS parity):

```
f110bfae15f751011601fc20a6822b68cb50a5ef019c20ff7075d6a9e6309491334054e7b6e124086f
```

Example QUERY frame. The last record is the gap: delta slot 7 with the REQUEST flag and a zero id.

```
f111bfae15f751023701fc007f7497471e09bf3603fc00d84eef325a7315710bfc00154e511ecfecd9eb11fc00d2e0db7e230662140ffc0400000000000000003394690fb38cd7c1e210
```

**Receiving a CLAIM.**

1. Check RS, CRC, the fingerprint and seq (plus the MAC if paired).
2. Resolve each 8-byte prefix to the full fact id in Supabase.
3. Fetch the clause and **recompute its BLAKE3**; it must equal the id.
4. If the fact is already admitted, it is just attention: a small, capped reinforcement.
5. If the id is unknown, or the sender flags CONTRADICTS, the record goes to alpha `quarantine_peer`. Athena then gets a gap item, and only Gilligan can admit anything.

# 13. Security and trust

- **The message is a claim, not a fact [Design, hard rule].** Nothing heard from another Forge is spoken or written until it passes this Forge's own Gilligan, under the fixed gates and the 2-independent-publisher rule. A peer is **not** a publisher, and a peer saying something never counts as one of the two sources.
- **What the integrity checks prove.** RS and CRC only show the frame arrived without noise damage. The BLAKE3 id only shows the clause is the one the id names. **Neither proves who sent it, or that it is true.**
- **Sound is a broadcast.** Anyone in the room can hear it, record it and play it back. The defences:
  - nonces and sequence numbers per session (a replay of an old session fails the session tag);
  - frames are only references to the shared memory, so a listener learns which facts were mentioned but not private text;
  - **[Open]** whether to require **pairing**. Pairing would share a 32-byte key once, by QR code or network, and then every frame carries an 8-byte BLAKE3-keyed MAC (+8 bytes, about +0.6 s per frame). A full public-key signature (64 bytes, about 4.4 s) is too slow for every frame, but could be sent once per session.
- **A peer can't inflate a memory.** Peer reinforcement is capped (0.05 per peer per day), and peers can't add publishers.
- **Missing references.** If a referenced fact id isn't in Supabase (a forged id, or the receiver is offline), the record stays a pending claim. It is never turned into a guess.
- **No secrets.** No secrets, service keys or Supabase session tokens ever go into a packet or a frame. Identity is a vault *reference* only, as HCS already requires.
- **Strikes are for sources.** The source strike ledger (from the File8 notes) applies to publishers. A peer that keeps sending claims Gilligan rejects can be rate-limited the same way. This only blocks or down-weights. It never moves the gates.

# 14. Established vs. design: summary

| Item | Status |
|---|---|
| Band ranges, associations, phase-amplitude coupling, ripples tied to replay | Fact (ranges are conventions; functions are associations) |
| Human ripples are about 80–150 Hz; the Garrett 2024 ~90 Hz co-ripples were intracranial | Fact (from the earlier review) |
| 144 Hz as the ladder ceiling and the octave carriers 144/2^k | Design |
| 9 slots × 40° in 3 triads, and the role assignments | Design |
| Q tune, κ, half-lives, floors, η, thresholds | Design (starting values, to be tuned on real data) |
| BLAKE3, Reed-Solomon correction limits, CRC, MFSK orthogonality | Fact (engineering) |
| 16-MFSK at 1728–3888 Hz, 34.7 ms symbols, ~14.4 B/s raw | Design; real-room performance not yet measured |
| HCS validator accepts the Forge packet | Tested today (section 11) |
| RS frames survive 4 corrupted bytes | Tested today in software (no real audio yet) |

# 15. Open questions for Nic

1. **The octave ladder.** Keep the carriers at 144/2^k (2.25, 4.5, 9, 18, 36, 144), or put each carrier at its band's center? The ladder gives clean nesting, but puts the ripple carrier at the band's top edge, which is your "cusp."
2. **The 72 Hz rung.** Reserved in 0.1. Use it for high gamma, or for a "transition" band?
3. **Slot roles.** Are the 9 delta roles the right kāraka set (kriyā, kartā, karma, karaṇa, sampradāna, apādāna, adhikaraṇa, māna, nibandhana)? And do the theta, alpha, beta, gamma and ripple columns match how you picture each band?
4. **Shared atom identity.** Both Forges must turn "moon" into the same atom id. Should atoms be keyed by Forge lexicon lemma plus type (as in this draft)? Should Wikidata ids be kept as a cross-reference only?
5. **Symmetric relations.** For example, "distance Moon↔Earth": should it be stored in a canonical order (sorted atoms), so that asking it either way lands on the same slots?
6. **Acoustic profile.** Audible chirps (1.7–3.9 kHz, reliable but you'll hear them), near-ultrasonic (17–20 kHz), or both?
7. **Pairing.** Should a MAC be required from day one, or only for claims that would start a write?
8. **Peer reinforcement.** Should a peer's mention reinforce at all? The draft allows it, capped at 0.05 per peer per day.
9. **HCS update.** Should the `harmonic-conductor-studio` repo get the `forge_memory` field, so HCS round-trips these packets without dropping them?
10. **Anchor ratios.** The canonical file uses 1 / 0.5 / 3, and the design doc's example uses 1 / 3 / 9. Which is correct?
11. **Starting values.** Are the half-lives OK (delta 1 year with a 0.25 floor, theta 30 days, alpha 1 hour, beta 15 minutes, gamma 7 days, ripple 60 s)?

# 16. Files in this package

| File | What it is |
|---|---|
| `Forge_Harmonic_Key_and_Packet_Spec_v0.1.docx` / `.md` | this spec |
| `forge_harmonic_key_v0.1.json` | the key: matrix, tuning, structure, hashes (machine-readable) |
| `forge_harmonic_key_v0.1.csv` | the key matrix, one row per cell (spreadsheet-friendly) |
| `example_forge_packet_v0.1.hfield` | full example Forge packet (EXAMPLE DATA), validated against HCS code |
| `src/gen.py`, `src/make_md.py`, `src/hcs_forge_packet_check.rs` | scripts that regenerate every number, hash and frame here, plus the HCS validation test |
