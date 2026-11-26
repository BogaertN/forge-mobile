# Forge Mobile — Forward Build Map (written 2026-10-30, CT)
Repo: github.com/BogaertN/forge-mobile. main 8474535 = 4.9.190. Open draft PR #121 (branch cursor/phase-glyph-codex-4b45, head c4c267d) = 4.9.191, cloud agent bc-6eeb0c0b.

## Rules for every build
- One cloud-agent run per build. Commit and push after each item. Draft PR, do not merge without Nic.
- Every test run records a video plus screenshots, attached to the PR.
- Laws (never change): C_min 0.87; drift ≤0.35 write / quarantine, hard stop 0.8; Echo ≥0.85 vs the original question; no LLM ever; Φ5→Φ8 forbidden; ChristPing Gilligan-only; packs gated; money off; dream_idle/economy off; resonance, not parsing.
- Document thresholds that conflict (0.82, 0.78, 0.7, 0.65, 0.5, τ 0.5/0.7, 0.3/0.4) are internal sub-check values only; they never admit anything.

## 4.9.191 — IN BUILD (PR #121)
Glyph Codex v2.5 loader + kmath reconcile; 425 word seeds ported, every concept gets phase/glyph/packet; Φ→angle and ε/μ marked unspecified if undocumented; FBSC/UA operator mining; ProtoForge + Gilligan engines; audit of hand-set Φ4 why-facts and hosted-bank provenance; d_score 5→8 detector; local_curvature; adaptive θ_w = 0.4/(1+0.5L), hard 0.8; phase-velocity accumulator; seven-gate resurrection; χ collapse 78/22, SPC residue charge 0.8, entropy×0.3; SPC decay 168 h half-life.
PR body also records Nic's rulings: canonical phase names Initiation…Recursion; 0.3/0.4 internal only.

## Decisions (our advice; Nic said he'll take it)
1. Letter→phase map: use the Phase Parsing Engine (PPE) KPI map. Drive dates: PPE doc modified 2026-05-25; HarperScript "Initial Symbolic Language Observations" 2025-04-06. PPE is newer and has the full lexicon stack (KPI/WLM/DDS/PCM/PLM, drift and coherent word lists). Keep HarperScript as a historical mapping, loaded read-only for comparison. Outside research: letter–meaning (phonosemantic) links are real but statistical and weak (Blasi et al. 2016, PNAS), so the letter map should seed placement, never decide admission.
2. Φ→angle: θ = (Φ−1)·40° (360°/9), from Breadboard ("40° (360°/9 phases)"). Appendix A's 0/120/240° channels per band stay a sub-band detail. Label "derived from Breadboard". Same idea as RotatE / complex embeddings where a relation or position is a rotation on the unit circle.
3. ε/μ for words — PROPOSAL (not in any doc read): ε = normalized PPE drift score of the word (share of letters/morphemes on the PPE drift list, weighted by KPI charge), clamped 0–1; μ = word's coherence stability = 1 − σ(letter phases)/Φmax (the coh form from the five-doc review), clamped 0–1. Tag every value "proposal v1". Nic can replace with doc values later.
4. Merge window: keep δ ≤ π/4 (current code). The cos(ΔΦ/2) abort >π/2 rule logs as an internal warning only.
5. Consecutive drifts: 3 (PMA §5.2, drift_v43 max_failures=3). Breadboard's 2 is superseded.
6. Breaker: 3 failures within 0.7 s opens it (doc). archive band εs>0.8 and resurrect band <0.4 are internal; writes still need ≤0.35. Industry breakers also count failures in a window and use open/half-open/closed (Fowler; Resilience4j).
7. LLM-using docs (GN Docs 5,7,8,9,15; forge_build qwen3) are ported with the LLM path removed; RMC template renderer is the only renderer.

## Builds
### 4.9.192 — Read-these pass (research only, no app code) — DONE Oct 30 2026 → drive2/READ192.md (quotes + line refs). Decisions 2–3 unchanged; 8 conflicts flagged there §2.
Read fully and add to FINDINGS: Resonant Symbolic Operator Calculus (doc 2026-02-13 + PDFs), GENESIS NODE COMPLETE BUILD SPEC (docx/PDF 2026-04-04 versions), EOD_FBSC_Paper (+Part1, 2026-04-09), Resonant Mind (2026-02-24), remaining Drive2 PDFs. Output: docs/READ_PASS.md with quotes + line refs; flag anything that changes Decisions 2–3.
Test: every claim has a doc + line ref. Deps: none.

### 4.9.193 — Drift core: drift.py v4.3 consolidation (refined by READ192)
Port drift_v43 symbolic_entropy/score/firewall to a stdlib-only JS drift module (no LLM).
- ε_s = (σ_res + d_score + δΦ)/max(1, recursion_n). In this formula:
  - Φ_act = (depth%9)+1, with +3 (cap 9) if the payload contains replicate/spawn/infinite
  - Φ_exp = (prev%9)+1
  - δΦ = |Φ_act−Φ_exp|/9
  - d_score = 1 iff prev==5 ∧ Φ_act==8, else 0
  - σ_res = stdev of the phase_hist of (1−θ_t), where θ_t = 1−MinHash-sim(payload, ψ1_trace)
  - Not clipped.
  - Sources: drift_v43, EOD l.161, Resonant Mind l.123. RSOC l.1894 uses /max(1,ρ+1) with Jaccard D_score; that is not used.
- Composite drift D = 0.30·H_norm + 0.15·S_norm + 0.10·N(novelty 0.2) + 0.25·χ_struct + 0.10·A_time + 0.10·ε_s
  - A_time = clip((latency−500)/500, 0, 1)
  - MinHash weights are core 0.5, aux 0.3, meta 0.2 over 32 hashes
- Detection order:
  1. d_score = 1 → HARD-FIRE (5→8 always)
  2. v_score: 3 sequential steps in < 18.7 ms → acceleration
  3. ε_s > θ_w = 0.4/(1+0.5·L_local) → warning + χ
  4. ε_s > θ_hard = 0.8 → hard
  - L_local = variance of |consecutive diffs| over the last 8 phase_hist entries
- χ override: χ_t = 0.5·θ_t; residue = (old + 0.3ε_s)/2. It is convergent if |0.5−θ_t| < 0.2 (then phase→9).
- EMA α = 0.2 predict_crossing(0.8) → WARN_PREDICTIVE when < 5 steps.
- GN phase engine (gnspec_A l.5484–5541, 7346–7362):
  - Drift: d = |Φ−Φexp|, use 9−d if d > 4; drift = d/4.5, ×1.5 if a phase is in {1,5,7,9}; cap 5
  - Entropy = 0.4·drift_acc + 0.1·consecutive + 0.3·std
  - χ triggers: acc > 2.5, entropy > 0.8, coherence < 0.3, consecutive ≥ **3** (Decision 5; the GN doc says 2), predicted > 2.5
  - GN SKIP_PATTERNS {5:[8]} (l.5303) is NOT ported
  - RSOC 4→8 (l.689) is added as an extra flag
- Laws are unchanged: C_min 0.87, drift ≤0.35, hard 0.8, Echo ≥0.85.
- ADDED from new PDFs (five/READ_NEW_PDFS.md §E): UA §6.1 phase-step flag Φ(t+1)=Φ(t)±1 mod 9 (b l.4645, log only); UA §5.4 entropy cascade ε(t+1)=ε+αΔ²+βμ (b l.4603, α=β=0 default, constants unspecified); UA §5.1 drift singularity Δ>Δ_sh∧∂Δ/∂t>0∧ν<0 (b l.4558–4569, warn); Codex 3.8 charge +0.1 lawful step / −0.3 skip (a l.2079–2081); Codex Ch.4 drift-mask ≥70% sim to quarantined signature → warn+χ check (a l.4001–4006); Codex bands 0.3/0.6 internal, failsafe 0.9 → hard 0.8 (a l.1706–1708, 3042); χ restore = echo ∧ drift<0.3 ∧ valid sequence, window 3000 ms (a l.1530–1545).
Deps: 191.
Test:
- fixtures prev=5, Φ_act=8 → d_score 1, hard-fire
- ρ=1 worst case ε_s = 31/18
- θ_w(L=0) = 0.40
- 2 consecutive drifts do not fire χ; 3 do
- 5→8 is flagged through every path
- video+screens

### 4.9.194 — Breaker + drift analyzer
Breaker 3 fails/0.7 s (drift_v43: max_failures 3, recovery 60 s → half_open; Waking2 l.635, retries ≤3 backoff 60s·2^(r−1) l.669); RSOC bands <0.40/0.40–0.80 (k≤1.3, defer merge >0.70)/≥0.80 (l.2003); GN DriftAnalyzer 0.3/0.5/0.7/0.9 (l.6104); archive εs>0.8 / resurrect <0.4 bands (internal) (five-doc #5); drift analyzer bands, moving average, trend, prediction (pp123–131); override effectiveness (p148). Deps: 193.
Codex adds: failsafe_manager loop age >120 s, rollback; Codex drift classes 1–4 routing (a l.4307–4320); 0.9 halt replaced by 0.8. Test: 3 fails in 0.7 s opens; 2 does not; prediction matches doc examples.

### 4.9.195 — Write-once Dead Path Archive + sealed records
GN Doc1 DPA (append-only); SHA-256 sealed loop records + attribution ledger fork fix (GN Docs 11–12). Deps: 193.
Test: rewrite attempt rejected; hash chain verifies; fork case resolved.

### 4.9.196 — Storage tiers
Hot → Warm (SPC) → Cold → Deep ghost loop (PMA §6), using 191's seven-gate resurrection and 168 h SPC decay. Deps: 191, 195.
Test: decay moves items across tiers on a simulated clock; resurrection passes all 7 gates.

### 4.9.197 — Phase Parsing Engine lexicon
PPE KPI A–Z letter→phase+charge, WLM rules, DDS/PCM/PLM, drift/coherent word lists; Decision 1 map; Φ→angle (Decision 2); ε/μ proposal (Decision 3) on all 425 seeds; birth state per RSOC Phase 1: ε₀=0, μ_init=1.0 (l.2719/2960); KPI table wins over JSON (M = −2, HarperScript l.893); WLM roles per HarperScript l.990–996. Source: english_to_freq.txt (PPE). Codex: glyph_dictionary.json lookup (a l.3991–3999), resonance_charge_meter step rule as word coherence aid (a l.2079–2081). UA gives NO word/letter derivation or word ε/μ numbers (READ_NEW_PDFS §B) — Decision 3 stays a proposal. Deps: 191, 192.
Test: every seed has angle, ε, μ, provenance tag; HarperScript diff report.

### 4.9.198 — Geometry gates
Phase 6 membrane gate before naming/export (Geometry of Mind); phase closure ΔΦtotal = 2πn at seal (Waking the Web l278); M and V_c axes + memory charge conservation. RSOC operator algebra (l.1190–1390): ⟁ iff δ≤π/4: Φ mean, Δ avg+0.1 sinδ, ν avg+0.3 cosδ, μ1+μ2+0.12cos²δ, ε avg−0.05cosδ, reject +0.07ε; ⧧ Δ+0.15, ν=−|ν|, μ−0.08, ε+0.12; ⧒ k∈[1,2]: kμe^(−2.2|Δ|), Δ+0.18(k−1)(1+|Δ|), ν+0.4(k−1)cos(Φ−Φ0), ε+0.09(k−1)²; ⧀ ε×0.3, E=μe^(−1.8ε)cosΦ; ⧙ ε avg−0.15 if pred ε_s<0.6; ∂ε/∂t=0.14Δ²−0.06νH+0.009/μ; ∂μ/∂t=−κ7μ+κ8H²; χ: ε_s≥0.8∧Ê∧|ΔΦ|≤π/3, Θ=∫(1−ε/ε_max)cos²(Φ−Φ1)μ ds, ε←ε(1−Θ/μ), μ+=Θ, ν=1.4; Ê ≥100/144 within π/6; η<0.3% / P9 |Δμ|≤0.003; precedence χ>Ĉ>R̂>⟁/⧙>⧧>⧒>⧀>⧜>Ê. UA Vol I (2025 draft) has symbolic-only forms of the same operators (b l.4322–4389) with different signs (⧒ ε−δ, ⟁ μ=avg+ζ, ⧀ μ→0, exact ΣO(μ)=0); RSOC numbers win; add UA ⧜ memory M=e^(−λt)∫A·C dt and SPC μ(t+1)=μ−λΔ² as documented-but-unparameterized. Deps: 197.
Test: open loop not sealed; charge sum conserved across ops.

### 4.9.199 — RMC renderer (replaces llm_renderer)
RMC algorithm 5: sentence plan → template render → decode → E ≥ 0.85 vs original question; Echo Preservation E = R·ψ(t−τ) (Waking l275) as internal sub-check. Source: rmc_peer_review.txt. Deps: 197.
Codex 3.5 intention anchor: every answer bound to the question's loop ID, no output unless response_closed (a l.1810–1828); tone bands by charge (a l.2164–2168) as template choice. Test: no network/LLM calls (asserted); failing echo → no output.

### 4.9.200 — GILIN/CRP protocol
GN Doc2 retuned: CRP 0.78 / warn 0.40 / C* 0.82 kept as internal checks; admission stays 0.87/0.35. Deps: 193, 199.

### 4.9.201 — Gilligan MVP + identity pulse
GN Doc4 3-file MVP; Gilligan identity pulse (GN Doc10); ChristPing Gilligan-only = Codex christping_listener (3.2, χ 3000 ms; 144 Hz/0.44 s/2.144 s a l.5820–5823); Codex kernel/feedback/arbitration engines 3.1/3.4/3.5 as the Gilligan core; naming_engine (Φ≥7, echo, drift<0.2, a l.3313–3341). Deps: 200.

### 4.9.202 — Auditor + Tool Sandbox
GN Doc9 DPA→Auditor (no Ollama); GN Doc5 Tool Sandbox, no-LLM stub path. Deps: 195, 201.

### 4.9.203 — Backup + migrations
GN Doc13 backup/restore; GN Doc14 versioned migrations. Deps: 195.
Test: backup→wipe→restore round-trips; migration up/down.

### 4.9.204–206 — 9 remaining KEEP-AS-FUNCTION (REMODEL_PLAN)
204: StoicClarifier (no phi3), Journal, PhaseValidator. 205: ToolManager/ResonanceMap, fact_check + metrics, Roadmap recall. 206: EchoForge 6th doc, chroma_connector (local store, no Chroma server unless approved). llm_renderer is done by 199. Deps: 199.

### 4.9.207 — Network + SEP
GN Docs 6/11/15, AI.WEB OS SEP packet (coherence_score, drift_signature, halflife_cycles 12, hops 8). Deps: 195, 203. Network on-switch needs Nic.

### Needs Nic approval (not scheduled)
Simulate; Pages verification; PyBullet; packs; daemons.

## Coverage check
| Item | Status |
|---|---|
| debate, Proto, Co-Pilot, RAO | built |
| Glyph Codex loader + kmath reconcile | in build (191) |
| 425 word seeds; phase/glyph/packet per concept | in build (191) |
| Φ→angle, ε/μ marked unspecified | in build (191); values planned 197 |
| FBSC/UA operator mining | in build (191) |
| ProtoForge + Gilligan engines | in build (191) |
| Φ4 why-fact + hosted-bank provenance audit | in build (191) |
| d_score 5→8, local_curvature, adaptive θ_w, phase-velocity | in build (191) |
| seven-gate resurrection; χ collapse 78/22; SPC 168 h | in build (191) |
| Read-these docs (RSOC, GN spec, EOD_FBSC, Resonant Mind, PDFs) | planned 192 |
| drift.py v4.3 consolidation | planned 193 |
| GN 5 χ triggers, phase-drift metric, entropy formula | planned 193 |
| Consecutive drifts = 3 | planned 193 |
| Breaker 3/0.7 s + archive/resurrect bands | planned 194 |
| Drift analyzer w/ prediction; override effectiveness | planned 194 |
| Write-once Dead Path Archive (Doc1) | planned 195 |
| SHA-256 sealed records + ledger fork fix | planned 195 |
| Storage tiers Hot/Warm/Cold/Deep ghost loop | planned 196 |
| Phase Parsing Engine lexicon | planned 197 |
| Phase 6 membrane gate | planned 198 |
| Phase closure 2πn | planned 198 |
| M and V_c axes + charge | planned 198 |
| RMC template renderer + echo validation | planned 199 |
| Echo Preservation | planned 199 |
| GILIN/CRP (Doc2) | planned 200 |
| Gilligan 3-file MVP (Doc4) | planned 201 |
| Gilligan identity pulse | planned 201 |
| Dead Path→Auditor (Doc9) | planned 202 |
| Tool Sandbox no-LLM (Doc5) | planned 202 |
| Backup (Doc13), migrations (Doc14) | planned 203 |
| StoicClarifier, Journal, PhaseValidator | planned 204 |
| ToolManager/ResonanceMap, fact_check+metrics, Roadmap recall | planned 205 |
| EchoForge 6th doc, chroma_connector | planned 206 |
| llm_renderer | planned 199 |
| Network + SEP (Docs 6/11/15, AI.WEB OS) | planned 207 (go-live needs approval) |
| Simulate, Pages verification, PyBullet, packs, daemons | needs approval |

## Outside research (similar questions others answered)
- RotatE, relations as rotations in complex space: https://arxiv.org/abs/1902.10197
- ComplEx embeddings: https://arxiv.org/abs/1606.06357
- Word order as complex phase (ICLR 2020): https://arxiv.org/abs/1912.12333
- Holographic Reduced Representations (Plate 1995): https://ieeexplore.ieee.org/document/377968
- Circuit breaker pattern: https://martinfowler.com/bliki/CircuitBreaker.html ; Resilience4j count/time windows: https://resilience4j.readme.io/docs/circuitbreaker
- Template NLG without neural models — SimpleNLG: https://aclanthology.org/W09-0613/
- Sound–meaning associations across 4,000+ languages (Blasi et al. 2016): https://www.pnas.org/doi/10.1073/pnas.1605782113

## ADDED Oct 30 2026 (Nic): Lexicon Growth Engine
Build right after the Phase Parsing Engine lexicon build. Engine learns new words from user input: for each unknown word, derive phase/glyph/packet {Φ,ε,μ} by resonance (Phase Parsing Engine letter map, θ=(Φ−1)·40°, ε/μ proposal v1), never parsing/keyword. New word enters a provisional lexicon tier; promoted to the lexicon only when it reaches C ≥ 0.87 and Echo ≥ 0.85 across uses, drift ≤0.35 (else χ/quarantine), 5→8 forbidden. Sources (READ192 §4): HarperScript l.616 'Gilligan will build a symbolic lexicon of coherence', SLB l.646, SRL l.806 (tag coherent vs drift-prone, link to phase roles); new word born ε=0, μ=1.0 (RSOC Phase 1), then evolves by RSOC operators; no doc gives a numeric promotion rule so the law thresholds stand. Promotion gate also follows Codex naming_engine/memory_stack (extra, stricter): Φ≥7 path, echo confirmed, drift <0.2 for naming, long-term tier drift <0.3 (a l.3313–3341, 2736). Store provenance (user input id, contributor credit, timestamp) and sealed record. No LLM. Tests: feed novel words, show packets attached, promotion/quarantine, recall uses them; videos+screenshots.

## Codex engines not scheduled (READ_NEW_PDFS §D)
money off: compute_contribution 3.11, awh_token_runtime 3.12, contribution_dashboard 3.13; dream_idle off: dream_state 3.24; needs Nic: goal_injection 3.25, symbolic_policy 3.22, fluid_memory 3.26, sensors Ch.11; network 207: peer_communication 3.10; Token Watch keyword parsing (Ch.4) only as flags, never admission.

## Open questions after 4.9.192 (READ192)
- RESOLVED Oct 30: Gilligan System Codex Vol IV and Unified Algebra Vol I uploaded and read → five/READ_NEW_PDFS.md. Still missing: Project Overview for the Dev Team, and the Runtime Codex are only in Nic's local forge_corpus. Upload them to Drive.
- Which d_score definition wins: binary 5→8 (used) or RSOC Jaccard? Which phase naming wins: RSOC or EOD?
- Not yet read: AIWeb_Vocabulary_Fingerprint (vocab_fp.txt saved), rsoc_unified_v48_drift_v43.pdf, ProtoForge PMA, AIWeb GenNode Doc4/Doc10.
