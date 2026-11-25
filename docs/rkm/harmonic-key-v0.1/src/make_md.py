import json
OUT="/workspace/forge-harmonic-key"
key=json.load(open(f"{OUT}/forge_harmonic_key_v0.1.json"))
C=json.load(open(f"{OUT}/src/computed.json"))
hf=json.load(open(f"{OUT}/example_forge_packet_v0.1.hfield"))
n=C["nums"]; facts=C["facts"]; bands=key["bands"]; t=key["tuning"]
HCS=open(f"{OUT}/src/hcs_result.txt").read().strip()
def hl(s):
    d=s/86400
    if s>=86400*365: return f"{d/365:g} year"
    if s>=86400: return f"{d:g} days"
    if s>=3600: return f"{s/3600:g} hour"
    if s>=60: return f"{s/60:g} min"
    return f"{s} s"
L=[]; A=L.append
A('---\ntitle: "Forge Harmonic Key and Packet Spec"\nsubtitle: "Version 0.1 (draft for review), November 25, 2026"\nauthor: "Prepared for Nic Bogaert, Forge Mobile"\n---\n')
A("""# 0. How to read this

This spec defines three things:

1. **The Harmonic Key.** A fixed table of numbers that every Forge carries. It says what each memory "station" means.
2. **The memory address.** How a memory is placed on that table, and how a question "tunes in" to it like a radio.
3. **The Forge packet.** How two Forges send memories to each other as `.hfield` packets, over a network or over a speaker and microphone.

Every statement carries one of these labels:

- **[Fact]** Established engineering or neuroscience. These are general-knowledge statements, not new citations.
- **[Design]** A choice made in this spec. It can be changed, and the reason is given.
- **[Open]** A question for Nic to decide (collected in section 15).

All example facts, publisher names and instance names are **EXAMPLE DATA** used only to show the encoding. Nothing here is a stored Forge fact.
""")
A("""# 1. Purpose

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
""")
A("""# 2. The brain-band background

**[Fact]** Brain rhythms are usually grouped into bands. The exact edges vary between labs and papers, and the ranges below are the common textbook ones. The links between bands and functions are *associations* that research has found. They are not one-to-one jobs.

- **Delta** (about 1–4 Hz) is prominent in deep sleep and linked to memory consolidation.
- **Theta** (about 4–8 Hz) is linked to sequences, navigation and episodic context.
- **Alpha** (about 8–13 Hz) is widely discussed as a gating or inhibition rhythm, meaning it suppresses what is irrelevant.
- **Beta** (about 13–30 Hz) is linked to holding the current motor or cognitive state.
- **Gamma** (about 30–80 Hz) is linked to binding the features of one item together.
- **Ripples** (sharp-wave ripples) are linked to replay and consolidation of memories. In humans they are usually reported around 80–150 Hz, and in rodents they run faster.

**[Fact]** Slow and fast rhythms nest. The phase of a slow wave modulates the strength of a faster one; this is called phase-amplitude coupling. Theta-gamma coupling is the best-known case.

**About 144 Hz.** The roughly 90 Hz co-ripples from Garrett 2024 that came up in the book review were recorded with electrodes inside the brain, not at the scalp. Even so, the human ripple range reaches up to about 150 Hz. So **[Design]** putting the top carrier at **144 Hz, the ceiling of the ladder**, is a choice that fits inside the measured ripple range, sitting right at the cusp before the very fast range. The spec does not claim 144 Hz is a measured brain constant.
""")
A("""# 3. The ladder: bands and carriers

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
""")
A("| # | Band | Range (Hz) | Carrier (Hz) | Rule | Memory kind | Q band* | Q tune | κ | Half-life | Amp floor |")
A("|---|---|---|---|---|---|---|---|---|---|---|")
for b in bands:
    A(f"| {b['index']} | {b['name']} | {b['range_hz'][0]}–{b['range_hz'][1]} | {b['carrier_hz']:g} | {b['carrier_rule']} | {b['memory_kind']} | {b['q_band_descriptive']} | {b['q_tune']} | {b['kappa']} | {hl(b['half_life_s'])} | {b['amp_floor']} |")
A("| 6 | reserved | (high gamma) | 72 | 144 / 2 | reserved; decoders reject in key 0.1 | – | – | – | – | – |")
A("| 7 | none | – | – | – | means \"no parent\" in the parent field only | – | – | – | – | – |")
A("""
\\*Q band = carrier ÷ band width. It only describes how wide the biological band is. **Q tune** is the design dial that actually controls how sharply each band's memories respond. **κ** controls phase sharpness. Both are used in section 8.

Why the Q tune and κ values were picked **[Design]**:

- **Delta (Q 6, κ 12).** Facts must respond sharply. A wrong clause role should not answer.
- **Theta (Q 3, κ 6).** Context should spread a little, so neighbouring sequence steps come back together.
- **Alpha (Q 8, κ 16).** Gates must be crisp. "Speculative" must never blur into "pass".
- **Beta (Q 4, κ 12).** Working state is moderately sharp.
- **Gamma (Q 4, κ 10).** Binding is moderately sharp.
- **Ripple (Q 3, κ 6).** Replay is broad, because Athena re-checks a neighbourhood.
""")
A("""# 4. Phase slots: 9 slots at 40°, grouped as 3 triads of 120°

**[Design]** Each band has **9 phase slots** spaced 40° apart (0°, 40°, … 320°). The slots are grouped into three triads that start at 0°, 120° and 240°.

Why this layout:

- **It matches `.hfield`.** The `.hfield` format already has a 9-phase profile (`phase_count: 9`). Slot *s* maps to `.hfield` phase *s + 1*.
- **It keeps the book's three-phase structure.** The triad starts are exactly 0°/120°/240°, so the three-phase idea is kept without losing resolution.
- **There are exactly enough clause roles.** Nine slots hold the seven kāraka-style roles, plus the predicate and a qualifier, with no spare slot left over to tempt hardcoding.
- **Neighbours are distinguishable.** With κ = 12, a neighbouring slot (40° away) only gets {p40:.2f} of the response. Two slots away (80°) gets {p80:.1e}.

**Note on HCS anchors.** The `.hfield` anchors (1, 5, 9) and the phase play order [2,1,3,4,5,6,7,9,8] are HCS rendering concepts. Forge copies them unchanged for compatibility and gives them no meaning. The anchor ratios come from the canonical file (1 / 0.5 / 3), not from the design doc's 1/3/9 example. **[Open]** Which of the two is correct?
""".format(p40=n["phi"]["delta"]["40"], p80=n["phi"]["delta"]["80"]))
A("# 5. The Key Matrix (key 0.1.0)\n")
A("Rows are bands and columns are phase slots. Each cell has a **role code**, a one-byte number equal to band × 16 + slot, and a meaning. The same matrix ships as `forge_harmonic_key_v0.1.json` and `.csv`.\n")
A("| Band / Slot | "+" | ".join(f"{s} ({s*40}°)" for s in range(9))+" |"); A("|"+"---|"*10)
for b in bands:
    A(f"| **{b['name']}** ({b['carrier_hz']:g} Hz) | "+" | ".join(f"{s['role_code']} {s['role']}" for s in b["slots"])+" |")
A("\n**What each slot means, band by band:**\n")
for b in bands:
    A(f"- **{b['name']}** (scheme `{b['column_scheme']}`): "+"; ".join(f"{s['slot']} = {s['meaning']}" for s in b["slots"]))
A("""
**Delta columns are kāraka roles.** They form three triads:

- **Core clause (0–2):** kriyā (the relation), kartā (the agent or subject) and karma (the object).
- **Participants (3–5):** karaṇa (the instrument), sampradāna (the recipient) and apādāna (the source).
- **Frame (6–8):** adhikaraṇa (the locus), māna (the measure) and nibandhana (the qualifier).

Gamma carries the parts of one item, such as a value bound to its unit. A gamma item **nests inside** the delta slot it fills.

**Things the matrix deliberately does not contain.** It has no objects, properties or answers, only *roles*. Atoms (for example "moon" or "earth") are never in the key. They live in the facts and travel as hashes.

**Key hashes.**

- Structure hash (BLAKE3): `{sh}`
- Structure fingerprint (first 4 bytes, sent in every acoustic frame): **`{fp}`**
- Full-key hash (structure plus tuning): `{fh}`
""".format(sh=key["structure_hash_blake3"], fp=key["structure_fp"], fh=key["full_hash_blake3"]))
A("""# 6. Address encoding

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
""")
nm={"fact1":"Example fact 1 (EXAMPLE DATA): the speed of light in vacuum is 299,792,458 m/s","fact2":"Example fact 2 (EXAMPLE DATA): the mean distance from the Moon to Earth is about 384,400 km"}
for i,f in enumerate(facts):
    A(f"## 6.{3+i} {nm[f['name']]}\n")
    A(f"Canonical clause:\n\n```\n{f['canonical']}\n```\n")
    A(f"- fact_id = `{f['fact_id']}`")
    A(f"- amplitude {f['amp']} → amp_q {f['amp_q']}; flags VERIFIED_REF")
    A(f"- **Fact record (11 bytes):** `{f['record_hex']}`. That is the address `{f['fact_addr_hex']}` (delta, slot 0, the clause head) followed by the fact id prefix.\n")
    A("| Atom role | Slot / phase | Role code | Address (hex) | atom_id prefix |"); A("|---|---|---|---|---|")
    for a in f["atoms"]:
        u=(' '+a['atom']['u']) if 'u' in a['atom'] else ''
        A(f"| {a['role']} = {a['atom'].get('v')}{u} | {a['slot']} / {a['phase_deg']}° | 0x{a['slot']:02X} | `{a['addr_hex']}` | `{a['atom_id'][:16]}` |")
    if f.get("gamma"):
        A("\n**Nested gamma binding.** The value and the unit of the māna atom are bound as gamma items that ride inside the delta slot 7 window (parent = delta/7):\n")
        A("| Gamma part | Gamma slot | Address (hex) | atom_id prefix |"); A("|---|---|---|---|")
        for g in f["gamma"]:
            A(f"| {g['part']} = {g['atom']['v']} | {g['slot']} ({g['slot']*40}°) | `{g['addr_hex']}` | `{g['atom_id'][:16]}` |")
    A("")
A("""## 6.5 Trace order in theta [Design]

The Forge loop trace `held>neo>athena>gilligan>resumed` is placed on theta slots 0–4, nested in the beta `current_question` window (parent = beta/0). Two rules from the earlier notes become checks on this:

- A trace that **skips a slot or runs out of slot order** counts as drift and is rejected.
- A sequence longer than 9 steps continues in a new theta window with the CONT flag set.
""")
A(f"""# 7. Nesting (fast inside slow)

**[Fact basis, Design use]** A fast item names its slow window through parent_band and parent_slot. When a query has an active slow window, each fast item's response is multiplied by a phase-amplitude coupling term:

N = (1 + m·cos(φ_window − φ_parent)) / (1 + m), with modulation depth m = 0.9.

| Phase offset from the window | 0° | 40° | 80° | 120° | 180° |
|---|---|---|---|---|---|
| N | {n['pac']['0']} | {n['pac']['40']} | {n['pac']['80']} | {n['pac']['120']} | {n['pac']['180']} |

So when Forge tunes to the delta māna window (slot 7), the gamma value and unit riding in that window come back **together**, already bound. One context pulls back its whole connected group.
""")
A("""# 8. Retrieval: the tuning math [Design]

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
""")
names=[b["name"] for b in bands]
A("| query → memory | "+" | ".join(names)+" |"); A("|"+"---|"*(len(names)+1))
for q in names: A(f"| {q} | "+" | ".join(f"{n['crosstalk'][q][m]:.4f}" for m in names)+" |")
A("\n**Phase response Φ by band** (what fraction of the response a memory gets when it sits *x* degrees from the tuned slot):\n")
A("| band | 0° | 40° (next slot) | 80° | 120° | 160° |"); A("|---|---|---|---|---|---|")
for b in names: A(f"| {b} | "+" | ".join(f"{n['phi'][b][d]:.3g}" for d in ("0","40","80","120","160"))+" |")
A2=n['A2_30d']
A(f"""
## 8.1 Worked retrieval example (EXAMPLE DATA)

**The question:** "On average, how far is the Moon from Earth?"

The question is parsed into a delta signature:

- kriyā = distance (slot 0)
- kartā = moon (slot 1)
- apādāna = earth (slot 5)
- nibandhana = mean (slot 8)
- the gap: **māna** (slot 7, REQUEST flag set)

Example fact 2 was admitted with A = 0.8. After 30 days without reinforcement its amplitude has decayed to A = {A2:.3f}.

| Case | M | R = A·M | Result |
|---|---|---|---|
| All 4 known atoms in the right roles | {n['M_exact']:.3f} | {n['R_exact']:.3f} | **Lit**. Read slot 7, which brings the gamma value 384400000 and unit m with it; then Gilligan, then speak if the gates pass |
| One atom stored one slot off (40°) | {n['M_one_adjacent']:.3f} | {A2*n['M_one_adjacent']:.3f} | Near miss (just under 0.5) |
| One atom in a far role (160°, for example Earth as agent instead of source) | {n['M_role_far']:.3f} | {A2*n['M_role_far']:.3f} | Near miss: treated as "atom absent" |
| Only 2 of 4 atoms present | {n['M_partial_2of4']:.3f} | {A2*n['M_partial_2of4']:.3f} | Near miss → Athena lead |
| Same atoms, but the query was tuned to theta | {n['M_theta_query_on_delta']:.3f} | – | Silent (wrong band) |
| A fact 3 years old, sitting at the delta floor A = 0.25, exact match | {n['M_old_fact_floor']:.3f} | {n['R_old_fact_floor']:.3f} | Lit (quieter, still found) |

**Order independence [Design, a test requirement].** Tuning only produces the candidate list. Gilligan judges each candidate on its own. Two things are required:

- Running the gates in any order gives the same verdicts.
- Running a retrieval leaves stored facts byte-for-byte unchanged. Amplitude reinforcement is written as a separate log event after the answer, not during scoring.
""")
e=t['reinforcement_eta']
A(f"""# 9. Decay, reinforcement and keeping everything

**Decay [Design]:** A(t) = max(floor, A₀ · 2^(−Δt / half-life)), using the band's half-life and floor (section 3).

- A delta fact at 1.0 drops to {n['decay_delta_180d']:.3f} after 180 days with no use. It never falls below 0.25, because verified facts are never forgotten through decay.
- A theta context halves in 30 days.

**Reinforcement [Design]:** A ← A + η·(1 − A).

| Event | η |
|---|---|
| Gilligan admits, or re-admits | {e['gilligan_admit']} |
| Used in an answer that passed the gates | {e['answer_passed_gates']} |
| Ripple replay passed the Gilligan re-check | {e['ripple_replay_passed']} |
| A peer Forge referenced it and it resolved to the same fact | {e['peer_reference_resolved']} (capped at {t['peer_reinforcement_cap_per_peer_per_day']} per peer per day, so a peer cannot pump a memory) |

For example, 0.711 + 0.1·(1 − 0.711) = {n['reinforce_from_0711']:.3f}.

**Weakening never deletes [Design, from ProtoForge Phase Memory Architecture].**

- **When Gilligan confirms a contradiction:** the fact's amplitude is halved (×{t['contradiction_amp_multiplier']}), the fact gets the alpha `suppress_contradicted` tag, and the contradicted source gets a strike in the strike ledger.
- **When a fact loses its second independent publisher:** it collapses to `tier_cold`, and its delta floor no longer applies.
- **What collapsed facts keep:** the id, the atoms, the lineage and the reason. They are never deleted.
- **Coming back from a tier:** the fact goes through the ripple stages (re_lookup → gilligan_recheck → readmit). It needs new independent evidence under the same 0.87 / 0.97 gates.
- **Re-admission limit:** at most **{t['readmission_cap']}** re-admissions. The 6th attempt is refused and flagged for Nic's review. Every attempt is logged, and a re-admission with no log entry is refused.

**Append-only log [Design].** Every admit, demote, readmit, peer claim received, and amplitude change is written as a log entry. Each entry is chained by hash: entry_hash = BLAKE3(previous_hash ‖ canonical entry). Restoring from backup must reproduce the same chain head.

**The speculative bin.** Speculative and derived-but-not-admitted items (for example GILLIGAN-SIMULATED / DERIVED with may_store_as_fact = false) live under alpha `speculative`. The speaking path cannot read that bin.
""")
A(f"""# 10. Key versioning

- **Version format.** The key version is semver, `MAJOR.MINOR.PATCH`. This document is **0.1.0**.
- **Structure hash** = BLAKE3 over the bands, carriers, slot count, role codes, address layout and flag list. That is everything a receiver needs to *decode*. Any change to these is a **MAJOR** bump, which gives a new structure fingerprint. Two Forges with different structure fingerprints **refuse** to exchange records.
- **Full hash** = structure plus the tuning values (Q, κ, half-lives, η, thresholds). Changing only the tuning is a **MINOR** bump. Peers with different tuning can still talk, because the tuning only affects local ranking. The difference is reported in the handshake.
- **Distribution.** The key is distributed as `forge_harmonic_key_v0.1.json`. A Forge loads it at start-up, recomputes both hashes, and refuses to run the bridge if they don't match the values in the file.
- Current structure fingerprint: **`{key['structure_fp']}`**.
""")
fm=hf["forge_memory"]
A(f"""# 11. The Forge `.hfield` packet (full JSON mode)

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
{HCS}
```

**Known gap [Open].** HCS's Rust structs don't yet have a `forge_memory` field. HCS can *read* these packets and will validate them, but if HCS re-saves one, the `forge_memory` object is silently dropped (serde ignores unknown fields). The fix is a one-line optional field on `FieldScore` in `hfield-domain`, plus extending `ForgeBridge` with the bound fields.

An abbreviated example follows. The full file is `example_forge_packet_v0.1.hfield`.

```json""")
r1=dict(fm["records"][1]); r1["atoms"]=r1["atoms"][:2]+[{"…":"3 more atoms"}]
ex={"format":hf["format"],"version":hf["version"],
 "packet":{"packet_kind":hf["packet"]["packet_kind"],"source_system":"Forge","target_systems":hf["packet"]["target_systems"],"phase_profile":hf["packet"]["phase_profile"],"payload_layers":hf["packet"]["payload_layers"],"forge_bridge":hf["packet"]["forge_bridge"],"…":"…"},
 "provenance":{"artifact_id":hf["provenance"]["artifact_id"],"custody_model":hf["provenance"]["custody_model"],"forge_trace_ref":hf["provenance"]["forge_trace_ref"],"…":"…"},
 "root_frequency_hz":144.0,"…":"anchors, music (1 view-only track), conductor (empty events)",
 "forge_memory":{"schema":fm["schema"],"key":fm["key"],"message":fm["message"],"records":[r1,{"…":"record for example fact 1"}],
   "trace":{"order":fm["trace"]["order"],"trace_hash_blake3":fm["trace"]["trace_hash_blake3"]},"receiver_policy":fm["receiver_policy"],"payload_hash_blake3":fm["payload_hash_blake3"]}}
A(json.dumps(ex,indent=2,ensure_ascii=False)); A("```\n")
fr={f["type"]:f for f in n["frames"]}; mf=n["mac_frame"]
tot=fr['HELLO']['seconds']+fr['HELLO_ACK']['seconds']+fr['CLAIM']['seconds']+fr['ACK']['seconds']
A(f"""# 12. Acoustic transport (speaker and microphone)

## 12.1 Carrier choice

- **[Fact]** Phone speakers and microphones are poor below about 200 Hz, so the 144 Hz root and the lower logical carriers **cannot** be the physical sound. The 144 Hz root is a logical clock and address root only.
- **[Fact]** Multi-tone FSK (MFSK) tones stay separable (orthogonal) when they are spaced at a whole multiple of 1/T, where T is the length of one symbol.
- **[Design]** The tones are **16-MFSK on the 144 Hz harmonic grid:** tone k = 144 × (12 + k) Hz for k = 0…15, which runs **1728 Hz to 3888 Hz**. That range sits well inside the band where phone speakers and microphones work best. The tones are still tied to the 144 root, and the 144 Hz spacing satisfies the 1/T rule.
- **[Design] Symbol timing:**
  - each tone lasts 4/144 s (27.8 ms, an exact 4 cycles of the root);
  - a 1/144 s (6.9 ms) guard with a raised-cosine ramp follows, to soak up room echo;
  - one symbol is therefore 5/144 s = 34.7 ms and carries 4 bits.
- **Raw speed:** {n['raw_bps']:.1f} bit/s = **{n['raw_Bps']:.1f} bytes/s**, before error correction. That is in the "tens of bytes per second" range expected for data over sound. The exact performance depends on the room and must be measured on real phones.
- **Preamble:** a 0.25 s rising chirp from 1728 to 3888 Hz (for detection and level setting), then 4 sync symbols k = 0, 15, 0, 15.
- **Alternative profiles [Open]:**
  - near-ultrasonic, 17–20 kHz: quieter to people, but less reliable on some phones;
  - voice-call, 144 × (4…19) = 576–2736 Hz, for sending over a phone call. Call audio codecs may still mangle the tones.

## 12.2 Frame layout [Design]

| Bytes | Field | Notes |
|---|---|---|
| 0 | magic + frame version | `0xF1` (high nibble F = Forge harmonic, low nibble = frame version 1) |
| 1 | msg_type | 0x01 HELLO, 0x02 HELLO_ACK, 0x10 CLAIM, 0x11 QUERY, 0x12 ANSWER, 0x20 ACK, 0x21 NACK, 0x7F BYE |
| 2–5 | key structure fingerprint | `{key['structure_fp']}` for key 0.1 |
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
| HELLO | version, caps, nonce | {fr['HELLO']['data_bytes']} | {fr['HELLO']['bytes']} | {fr['HELLO']['seconds']} s |
| HELLO_ACK | nonce echo, nonce, caps | {fr['HELLO_ACK']['data_bytes']} | {fr['HELLO_ACK']['bytes']} | {fr['HELLO_ACK']['seconds']} s |
| CLAIM | 2 fact records (example facts 1 and 2) | {fr['CLAIM']['data_bytes']} | {fr['CLAIM']['bytes']} | {fr['CLAIM']['seconds']} s |
| QUERY | 4 known atoms plus 1 gap (the Moon example) | {fr['QUERY']['data_bytes']} | {fr['QUERY']['bytes']} | {fr['QUERY']['seconds']} s |
| ACK | seq | {fr['ACK']['data_bytes']} | {fr['ACK']['bytes']} | {fr['ACK']['seconds']} s |
| CLAIM + MAC | 1 record, paired session | {mf['data_bytes']} | {mf['bytes']} | {mf['seconds']} s |

Air time includes the preamble. A full handshake plus one two-fact claim and its ACK takes about **{tot:.1f} s**. That is about 10× smaller than sending the two clauses as text, because the frame carries hashes and coordinates instead of words.

Example CLAIM frame (hex, with RS parity):

```
{fr['CLAIM']['hex']}
```

Example QUERY frame. The last record is the gap: delta slot 7 with the REQUEST flag and a zero id.

```
{fr['QUERY']['hex']}
```

**Receiving a CLAIM.**

1. Check RS, CRC, the fingerprint and seq (plus the MAC if paired).
2. Resolve each 8-byte prefix to the full fact id in Supabase.
3. Fetch the clause and **recompute its BLAKE3**; it must equal the id.
4. If the fact is already admitted, it is just attention: a small, capped reinforcement.
5. If the id is unknown, or the sender flags CONTRADICTS, the record goes to alpha `quarantine_peer`. Athena then gets a gap item, and only Gilligan can admit anything.
""")
A("""# 13. Security and trust

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
""")
A("""# 14. Established vs. design: summary

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
""")
open(f"{OUT}/Forge_Harmonic_Key_and_Packet_Spec_v0.1.md","w").write("\n".join(L))
print("ok")
