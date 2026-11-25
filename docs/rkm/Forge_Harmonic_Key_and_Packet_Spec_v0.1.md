# Forge Harmonic Key and Packet Spec

Version 0.1 draft, 25 November 2026, prepared for Nic Bogaert. Forge Mobile runs key 0.2.0 (`docs/rkm/README.md`). Where this draft and the research decisions differ, the research decisions win.

The tuning layer chooses which memories light up and in what order. It does not decide what is true. Gilligan stays at C 0.87, Echo 0.85 to speak and 0.97 to write, drift 0.35 / 0.40 / 0.80. At least two independent publishers. Ask never auto-persists. No LLM.

A memory address is a band, a phase slot, and an amplitude. A question emits the same kind of signature. A memory answers when its match is at least 0.5. Strength only ranks. A near miss (0.05 to 0.5) is an Athena lead and is not spoken. Speculative, ghost, and peer-quarantine rows never reach the speaking path.

Carriers are 144/2^k. Nine slots at 40 degrees. Fast items name the slow window they ride in. Nesting uses phase-amplitude coupling with depth 0.9.

The packet format is `aiweb.hfield`, root 144, phase count 9, order 2,1,3,4,5,6,7,9,8, anchors 1 / 0.5 / 3, `forge_bridge` bound, and a `forge_memory` object. Received records are claims. A peer is not a publisher.

Acoustic frames are 16 tones from 1728 Hz to 3888 Hz, Reed-Solomon with 8 parity bytes, and a MAC on every state-changing frame. HELLO has no MAC. The audible profile is the default.

Ids are SHA-256 of a canonical clause or atom. The log is append-only and hash-chained. Re-admission stops at 5 and requires a log entry. A retrieval does not change the stored facts; reinforcement is a later log event.
