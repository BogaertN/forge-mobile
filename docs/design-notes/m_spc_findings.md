# M (μ) and SPC decay λ — findings (read-only search, 2026-10-30)

## (2) SPC decay λ — FOUND (defined in code spec)
- drive2/gnspec_docx.txt l.6743-6763 (Genesis Node spec, SymbolicPhaseCapacitor.calculate_current_charge):
  "Charge decays exponentially: C(t) = C₀ * e^(-λt) where λ = ln(2) / half_life"
  `decay_constant = np.log(2) / self.half_life_hours`; plus `access_bonus = min(access_count*0.01, 0.2)`; access() adds +0.05 (cap 1.0).
- l.6818-6820: `DEFAULT_HALF_LIFE_HOURS = 168.0  # 1 week`, `DEFAULT_DECAY_RATE = 0.05`, `DEFAULT_CHARGE_THRESHOLD = 0.1`
- l.7510: identity-vector SPC `half_life_hours=720.0  # 30 days`; l.7586 test override 1.0 h.
=> λ = ln2/168 h = 0.004126 /h (≈1.146e-6 /s). Active until charge <0.1 → ~558 h (~23 d) from C₀=1 without access.
Other candidates (not in conflict, different mechanisms):
- five/b.c.txt (Unified Algebra Vol I) §4.4: "μ(t+1) = μ(t) – λ × Δ²  Where λ is the leakage constant" (no number) — drift-driven per-tick leak.
- §4.3 discharge "μ′ = μ × e^(–κt)", κ set by Φ8 pressure (no number).
- READ192.md l.142: "memory charge C = ∫ψ dt·e^(−λt)".
- SEP packet halflife_cycles 12 (FINDINGS.md l.40) — network packet, not SPC.
- DEFAULT_DECAY_RATE 0.05 is stored but unused by the formula — minor inconsistency.
- gn2.txt DEFAULT_DECAY_TIMEOUT_S 30.0 = agent decay timer, not SPC.
- GitHub (BogaertN): no half_life/memory_charge hits; echo-forge resonance_map.py decay_node_strengths(decay_rate=0.01) is unrelated node strength decay.

## (1) Memory term μ / M — formula FOUND, no numeric constant beyond μ_init
- b.c.txt §4.1: "C(t) = {μ(t), ρ(t), τ(t), ψ(t)} … μ(t): current memory charge"
- §4.2: "μ(t) = μ₀ + ∫₀ᵗ [ψ × C(t)] dt" (C = coherence preservation coefficient)
- Memory Charge Axis: "Range: 0 → Mₘₐₓ (bounded by SPC or IRN capacity) … Too much = overload, Too little = decay"
- §6.2 conservation: ∑O(μ)=0 in closed loop; ⟁ merge μ = μ1+μ2(+0.1 per BUILD_MAP RSOC l.1190-1390).
- RSOC birth μ_init = 1.0 normalised (l.2719/2960); Coherence Engine variant 1.0–5.0.
- No Mₘₐₓ value found. Caveat: ρ in chi_conv.txt is also called "memory charge" — naming overlap.

## Proposed derived values (where undefined)
- Per-tick λ_tick for 18.7 ms tick: λ·Δt = 0.004126/3600·0.0187 = 2.14e-8 per tick (use ln2/(168·3600/0.0187) ).
- Leak constant (§4.4): choose λ_leak so that at drift limit Δ=0.35 a full μ=1 empties over the 0.7 s breaker window: per tick λ_leak·0.35² ·(0.7/0.0187≈37.4 ticks)=1 → λ_leak ≈ 0.218. At hard-stop 0.8 empties in ~7 ticks. Proposal, not doc.
- Mₘₐₓ proposal: 5.0 (top of Coherence Engine μ_init range); overload → ⧀ discharge.
- Discrete μ update: μ_{k+1} = μ_k + C_k·Δt (when C ≥ 0.87) − λ_leak·Δ_k²·Δt-normalised.

## Importance
- SPC λ: medium-high for Warm-tier movement (Hot→Warm→Cold) and resurrection eligibility; value is defined, so just adopt 168 h / 720 h identity.
- μ: medium; drives memory_fit and merges, but birth 1.0 + accumulation formula suffice; Mₘₐₓ and leak constant are the only gaps, low risk for current behaviour.

## Not done
Live Drive/Docs connector searches were not re-run; results above come from local extracts of those Drive docs (drive2/, five/). Unread PDFs (Vocabulary_Fingerprint, rsoc_unified_v48_drift_v43.pdf, GN Doc4/Doc10, PCM Architecture) not re-checked.

---
## Pass 2: live Drive full-text searches (read-only), 2026-10-30
Searched user-Google-drive and user-Google-drive--second with fullText and title queries. The Docs content is reachable through the Drive read_file tool, so the Docs connector was not called separately. Nothing was modified.

### Docs read
- AIWeb_Vocabulary_Fingerprint (1LiA85jZ…): no μ or SPC constants. It has one decay figure for SEP packets: "temporal_decay (halflife_cycles: 12), hops_remaining: 8 default". That is a mesh-hop half-life, not an SPC half-life.
- rsoc_unified_v48_drift_v43.pdf and RSOC_Proof_v4.8_with_Companion.pdf: the only "capacity" is "Imin = 2500 bits (working memory capacity)" in the n*≈26–27 derivation. There is no μ_max, κ or λ_leak.
- AIWeb_GenNode_Doc4_Gilligan (1Kifr4xV…, second Drive, now found) and Doc10: no hits.
- ProtoForge_Phase_Memory_Architecture: κ here means the resurrection *context* ("If κ does not change invariants: I(ψ′)=I_t"). It is not a discharge rate, so the two uses of κ conflict.
- Symbolic Fluid Memory: "Memory depth (μ): how long an unresolved loop can be stored symbolically before decaying". It also says "Harmonic signature (λ): symbolic frequency fingerprint". That is another conflicting use of the symbol λ.
- Capacitor Discharge Records (1viKR6na…): narrative logs only ("passive discharge and symbolic loop leak"), no constants.
- The source of the μ_max snippet is "Structured Evolution- GPT chat.txt" (1ibiBlr2…): "If μ ≥ μₘₐₓ: Then dμ/dt = –κμ(t)". It is symbolic only.

### NEW numeric constants: Resonant Symbolic Operator Calculus (Google Doc 1Ma6QGau…, Dec 2025)
- Discharge operator Ĉ (Phase 8): "μ′ = 0 … ε′ = ε × 0.3 … Echo pulse: E = μ × e^(−γ ε) × cos(Φ_global) (γ = 1.8)". Lawful discharge is a **step to zero**, not a continuous exponential κ.
- Amplify ⧒: "μ′ = k × μ × e^(−β |Δ|) (β = 2.2) … k ∈ [1.0, 2.0]". This is the canonical drift-based loss of μ.
- Fracture ⧧: "μ′₁ + μ′₂ = μ − 0.08 (small severance tax)".
- Merge: "μ′ = μ₁ + μ₂ + ζ × cos(δ)² (fusion bonus ζ = 0.12 nominal)". Lock: "μ′ = μ₁ + μ₂".
- Conservation: "μ′ + μ_folded = μ_original ± η".
- SPC hardware: "linear V_μ range 0.1–5 V (corresponding to μ 0.1–10 μC)"; "Measured retention: 99.8 % after 1000 write-erase cycles"; "memory in RSOC truly eternal". Also an EDS RC network "(R = 10 kΩ, C = 1 nF) … locks … below 0.22 V_0 (78 % decay limit)". "1024 SPCs (2 MB capacity)".

### How this changes the proposals
1. **M_max**: the only numeric bound anywhere is the SPC hardware range of μ 0.1–10. I now propose **μ_max = 10** with μ_min = 0.1, in place of my earlier 5.0. If μ is normalised with μ_init = 1.0, then 10 = 10× birth charge.
2. **λ_leak in μ(t+1)=μ(t)−λΔ²**: no value exists. RSOC's canonical drift loss is multiplicative, e^(−2.2|Δ|). Matching the two at the drift ceiling Δ=0.35 gives 1−e^(−0.77)=0.537 of μ lost. With μ=1 that means λ≈0.537/0.1225 ≈ **4.4 per unit μ** if read as one amplify step. The less aggressive per-tick reading keeps the earlier ≈0.218. Recommendation: replace the additive law with RSOC's e^(−βΔ) form, β=2.2.
3. **κ**: in the RSOC doc, discharge is instantaneous (μ′=0, echo E=μe^(−1.8ε)). For a continuous κ above μ_max, use the 0.7 s breaker as the time constant: Set κ = 1/0.7 s ≈ **1.43 s⁻¹**, so excess μ decays 63% within one breaker window. Note that κ also means "resurrection context" in ProtoForge PMA.
4. **SPC λ**: no new software half-life was found. 168 h stands. The hardware claims "eternal" storage (99.8% retention), which is consistent with the long 720 h identity tier. The 12-cycle half-life belongs to SEP packets, so it should not be confused with SPC.
5. **Importance**: unchanged for λ (medium-high). μ moves to **medium-high**, because RSOC wires μ directly into echo strength (E) and conservation checks, not just bookkeeping.

### Not read (size)
File8: Memory (6 MB) and FBSC Vol II (2.5 MB) were listed in full-text hits but not grepped.
