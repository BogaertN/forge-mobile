# Resonant Key Memory

Key **0.2.0** is what Forge Mobile runs. It keeps spec 0.1's radio model and applies Nic's 25 Nov 2026 research decisions wherever they differ. The draft key in spec 0.1 used BLAKE3, `mana` / `nibandhana`, and a ripple ceiling at 144 Hz. Those are not the runtime key.

Fingerprint (SHA-256, first 4 bytes): `4d1db5d2`.

| Decision | Runtime |
|---|---|
| Ladder | 144/2^k: 2.25, 4.5, 9, 18, 36, 72, 144 |
| Ripple row | 80–220 Hz, carrier 144 inside, as `band_tuning.js` |
| 72 Hz | high gamma: links between items. Φ9 stays the transition |
| Delta slots | kriya, kartr, karma, karana, sampradana, apadana, adhikarana, vidheya, hetu |
| Gamma extras | sambandha, vishaya, upadhi are parts, not delta slots |
| Ids | SHA-256. Concept id plus WordNet 3.0 offset; lemma only if unknown, flagged |
| Symmetric | only predicates `world_rules.js` marks symmetric |
| Sound | audible 1728–3888 Hz by default. Near-ultrasonic is an opt-in with a visible checkbox |
| MAC | required on CLAIM and any other state-changing frame. HELLO is open |
| Peer | paired peers only, once per half-life window, up to 5% half-life stretch, never a publisher |
| Anchors | 1 / 0.5 / 3. 1/3/9 is not the current profile |
| Half-lives | gamma 168 h, theta 4×168 h, delta 52×168 h with floor 0.25, alpha 1 h, beta 15 min, ripple 60 s |
| Cold | amplitude under 0.05 is a cold tier, not a deletion |

Tuning never speaks and never moves C 0.87, Echo 0.85/0.97, or drift 0.35/0.40/0.80. A peer claim stays in `quarantine_peer` until this Forge's own Gilligan admits it. Ask does not write the index; explicit Remember does.

`harmonic-conductor-studio` is not changed here. Packets stay `aiweb.hfield` with `forge_bridge` bound and a separate `forge_memory` object so a later HCS build can keep the field.
