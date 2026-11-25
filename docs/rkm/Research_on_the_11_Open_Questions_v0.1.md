# Forge Harmonic Key: research on the 11 open questions

25 November 2026. Companion to spec 0.1. Nic chose to proceed with these answers. They override the draft.

1. Keep the octave ladder. Widen ripple to 80–220 Hz with 144 inside, matching `band_tuning.js`.
2. 72 Hz is high gamma: links between items. Gamma at 36 Hz binds parts within one item. Transition stays Φ9.
3. Delta slots use Forge's grammar names: kriya, kartr, karma, karana, sampradana, apadana, adhikarana, vidheya, hetu. sambandha, vishaya, and upadhi are gamma parts.
4. Atom ids are Forge concept id plus the WordNet 3.0 sense offset. Lemma plus type is only a flagged fallback. Wikidata is a cross-check only. SHA-256, matching `content_sha256`.
5. Sort arguments only for predicates declared symmetric in `world_rules.js`.
6. Acoustic is audible by default. Near-ultrasonic is opt-in, with a visible indicator.
7. A MAC is required on any frame that can change state. HELLO and presence stay open. Pair by a shared key (shown for QR, or carried in a later acoustic exchange).
8. Peer reinforcement only from a paired peer, once per half-life window, as at most a 5 percent stretch of the half-life. Never a publisher. Never moves a gate.
9. The HCS `forge_memory` field belongs in BogaertN/harmonic-conductor-studio. This run does not change that repo. Packets stay compatible with a later optional field.
10. Anchors 1 / 0.5 / 3 are current. 1 / 3 / 9 stays the named experimental profile and is not what this key uses.
11. Half-lives from the 168 hour constant: gamma 168 h, theta 4×168 h, delta 52×168 h with a 0.25 floor for verified facts, alpha 1 h, beta 15 min, ripple 60 s. Below 0.05 is cold storage, not deletion.

Nothing in these answers changes the fixed gates, the two-publisher rule, or `calls_llm: false`.
