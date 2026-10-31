# Wiring 4.9.204 — frequency tuning

The math is in `docs/FREQUENCY_204.md` and in `source/engine/rmc_engine_v1/frequency_204_config.py`. It is proposal v1 and it is waiting on Nic. JavaScript is `source/src/frequency_204.js`. The two match on the suite script.

## What moves

4.9.203 still builds the starting decimals from spelling. A tuned word keeps that signature and adds a hertz offset on the non-master carriers. The 144 Hz glyph master, θ = (Φ−1)·40°, is copied through. Tuning does not write Φ.

## When a pull is stored

A lawful admit has C at least 0.87, Echo at least 0.85 against the question, and drift at or under 0.35. The tuning tick has to be phase 6. The content words of that admit then attract on shared band markers. The closed class of function words is not an admit rule. It only decides which tokens sat in the sentence.

Refuted pairs, Φ5↔Φ8 pairs, and pairs that tried to tune outside phase 6 repel. A tick that is not phase 6 writes nothing and files the membrane violation. The next phase-6 tick applies the repulsion. Asking to step a word from Φ5 to Φ8 is refused, and the stored phase stays 5.

Wikipedia and Wikimedia do not create a pull. A drift above 0.35 quarantines the tuning write. A drift at or above 0.8 is a hard stop. The tuning step itself is capped the same way: the written drift is at most 0.35, and a raw step at or above 0.8 is not written.

## The force

Attraction is 0.12 · cos²δ · e^(−2.2|Δ|) times the hertz gap, and only when the master phases are inside π/4. Repulsion uses the fracture scale 0.08 with the same decay, and the sign is outward. δ is the master-phase difference. It is not updated.

Spacing has two parts. Inside d_eq = 0.5 · ε · marker the attract step is replaced by an outward spring of the same 0.12 scale, so a pair can sit inside ε without sharing one hertz. Between the other words in the same tick, a weak 0.004 term pushes them apart. A word that moved on an earlier admit is not pushed again just because a new sentence arrived.

## Memory

Each pull stores the admit id, the words, the per-band hertz, the drift, and whether χ was set. The weight at age t hours is e^(−ln2 · t / 168). Retracting the admit id drops those pulls. The migration `supabase/migrations/20261031090000_frequency_tuning_204.sql` is flagged and not applied.

## What this build does not do

It does not admit. It does not change the coherence formula, C_min, Echo, or the write law. It does not call a model. Money, packs, dream_idle, economy, and ChristPing are unchanged. ChristPing stays Gilligan-only and is not started.
