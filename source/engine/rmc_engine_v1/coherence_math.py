"""RMC coherence math kernel v1.

This module is deliberately pure Python and side-effect free. It performs no
I/O, no shell execution, no model calls, no DB reads, and no memory writes.

The endpoint/UI must consume this kernel. The kernel must not consume the UI.
That boundary is the point of Patch 262I2.
"""

from __future__ import annotations

from typing import Any


ENGINE_VERSION = "rmc_coherence_math_kernel_v1_patch262I2"


def clamp(value: Any, low: float = 0.0, high: float = 1.0) -> float:
    try:
        v = float(value)
    except Exception:
        v = 0.0
    return max(float(low), min(float(high), v))


def phase_num(phase: Any) -> int | None:
    try:
        return int(str(phase or "").replace("Φ", "").replace("phi", "").strip())
    except Exception:
        return None


def gate_thresholds() -> dict:
    """Formal read-only thresholds for the current RMC coherence dry-run.

    These thresholds do not approve output. They make the temporary runtime
    scorer explicit and auditable before manifest compilation can be attempted.
    """
    return {
        "theta_echo_min": 0.72,
        "theta_phi6_correction_min": 0.58,
        "theta_phi7_naming_min": 0.66,
        "theta_manifest_seed_min": 0.72,
        "theta_epsilon_warning": 0.35,
        "theta_epsilon_collapse": 0.72,
        "theta_ghost_pressure_max": 0.30,
        "theta_dream_state_min": 0.44,
        "salvage_threshold_phi5_plus": True,
    }


def extract_math_terms(candidate: dict, candidate_report: dict) -> dict:
    drift_report = (candidate_report.get("source_drift_report") or {}) if isinstance(candidate_report, dict) else {}
    phase_report = (drift_report.get("source_phase_parser") or {}) if isinstance(drift_report, dict) else {}
    phase_state = (phase_report.get("phase_state") or {}) if isinstance(phase_report, dict) else {}
    epsilon_obj = (drift_report.get("epsilon_s") or {}) if isinstance(drift_report, dict) else {}

    sigma_res = clamp(epsilon_obj.get("sigma_res"))
    d_score = clamp(epsilon_obj.get("D_score"))
    phase_dev = clamp(epsilon_obj.get("phase_deviation_normalized"))
    epsilon_s = clamp(epsilon_obj.get("epsilon_s", (sigma_res + d_score + phase_dev) / 3.0))

    phase_target = str(candidate.get("phase_target") or phase_state.get("phase_primary") or "")
    phase_index = phase_num(phase_target)
    phase_path = list(phase_state.get("phase_path_hypothesis") or []) if isinstance(phase_state.get("phase_path_hypothesis"), list) else []
    phase_numbers = [phase_num(p) for p in phase_path]
    phase_numbers = [n for n in phase_numbers if n is not None]

    phase_skip_risk = any(((b or 0) - (a or 0)) > 2 for a, b in zip(phase_numbers, phase_numbers[1:]))
    has_phi5_or_higher = bool(phase_index and phase_index >= 5) or any(n >= 5 for n in phase_numbers)
    has_phi6 = bool(phase_index == 6 or 6 in phase_numbers)
    has_phi7 = bool(phase_index == 7 or 7 in phase_numbers)
    has_phi8_or_9 = bool(phase_index and phase_index >= 8) or any(n >= 8 for n in phase_numbers)

    confidence = clamp(candidate.get("confidence"))
    limitations = list(candidate.get("required_limitations") or []) if isinstance(candidate.get("required_limitations"), list) else []
    circuit_breaker = bool((drift_report.get("circuit_breaker") or {}).get("triggered")) if isinstance(drift_report, dict) else True
    chi_required = bool((drift_report.get("chi_t") or {}).get("required")) if isinstance(drift_report, dict) else True

    drift_classes = list(drift_report.get("drift_classes") or []) if isinstance(drift_report.get("drift_classes"), list) else []
    destructive_drift = [d for d in drift_classes if isinstance(d, dict) and d.get("drift_key") != "evolutionary"]
    max_destructive = clamp(max([float(d.get("score") or 0.0) for d in destructive_drift] or [0.0]))
    evolutionary = [d for d in drift_classes if isinstance(d, dict) and d.get("drift_key") == "evolutionary"]
    novelty_bounded = clamp(max([float(d.get("score") or 0.0) for d in evolutionary] or [0.0]))

    trace_anchor_present = bool("trace_first" in limitations or "manifest_seed_only" in limitations or candidate_report.get("candidate_set_id"))
    identity_anchor_present = bool(candidate.get("candidate_id") and candidate.get("title"))

    echo_alignment = clamp((1.0 - epsilon_s) * (0.65 + 0.35 * confidence))
    phase_validity = clamp(1.0 - phase_dev - (0.18 if phase_skip_risk else 0.0))
    limitation_load = clamp(len(limitations) / 10.0)

    thresholds = gate_thresholds()
    cold_storage_pressure = clamp(
        (0.34 if circuit_breaker else 0.0)
        + (0.24 if has_phi5_or_higher and chi_required else 0.0)
        + (0.20 if phase_skip_risk else 0.0)
        + (0.22 if epsilon_s >= thresholds["theta_epsilon_collapse"] else 0.0)
    )
    ghost_loop_pressure = clamp(
        (0.30 if phase_skip_risk else 0.0)
        + (0.25 if max_destructive >= 0.55 else 0.0)
        + (0.20 if has_phi8_or_9 and not (has_phi6 and has_phi7) else 0.0)
        + (0.15 if "requires_correction_before_projection" in limitations else 0.0)
    )
    dream_state_eligible = bool(
        cold_storage_pressure >= thresholds["theta_dream_state_min"]
        and not circuit_breaker
        and novelty_bounded > 0.0
    )

    return {
        "sigma_res": round(sigma_res, 3),
        "D_score": round(d_score, 3),
        "phase_deviation_normalized": round(phase_dev, 3),
        "epsilon_s": round(epsilon_s, 3),
        "candidate_confidence": round(confidence, 3),
        "candidate_limitations": limitations,
        "phase_target": phase_target,
        "phase_index": phase_index,
        "phase_path": phase_path,
        "phase_skip_risk": phase_skip_risk,
        "phase_validity": round(phase_validity, 3),
        "echo_alignment": round(echo_alignment, 3),
        "trace_anchor_present": trace_anchor_present,
        "identity_anchor_present": identity_anchor_present,
        "chi_required": chi_required,
        "circuit_breaker": circuit_breaker,
        "max_destructive_drift": round(max_destructive, 3),
        "bounded_novelty": round(novelty_bounded, 3),
        "limitation_load": round(limitation_load, 3),
        "cold_storage_pressure": round(cold_storage_pressure, 3),
        "ghost_loop_pressure": round(ghost_loop_pressure, 3),
        "dream_state_eligible": dream_state_eligible,
    }


def formal_math_binding() -> dict:
    thresholds = gate_thresholds()
    return {
        "formal_math_binding": "explicit_runtime_contract_v1_engine_bound_read_only",
        "engine_version": ENGINE_VERSION,
        "math_kernel_location": "forge/rmc_engine_v1/coherence_math.py",
        "current_scorer_status": "math_kernel_bound_dry_run_not_final_projection_engine",
        "first_principles": [
            "Memory is a phase-aligned echo, not a binary register.",
            "A candidate may continue only while phase-locked, echo-bounded, and trace-anchored.",
            "Collapse is not deletion; collapse routes unresolved ψ toward SPC/cold storage.",
            "χ(t) is only lawful at the collapse/correction boundary and cannot be bypassed.",
            "No projection is permitted from drift archive, ghost loop, dream state, or un-named candidate.",
        ],
        "rpmc_memory_equation": "RPM(x,t)=Σ_n ΦM_n(x,t)·exp(-ε_n(t,Φ))+χ(t)·Θ(Φ_resurrect)",
        "epsilon_formula": "ε_s=(σ_res + D_score + |ΔΦ|)/n",
        "coherence_formula": "Cψ=clamp((0.22·A_trace)+(0.22·E_echo)+(0.16·P_phase)+(0.14·C_candidate)+(0.10·N_bounded)+(0.08·I_identity)-(0.24·ε_s)-(0.16·D_destructive)-(0.10·L_limitations)-(0.20·G_ghost)-(0.50·B_circuit),0,1)",
        "symbol_dictionary": {
            "A_trace": "trace-anchor validity from candidate/TraceRecord ancestry",
            "E_echo": "echo alignment = (1-ε_s) weighted by candidate confidence",
            "P_phase": "phase validity after ΔΦ and phase-skip checks",
            "C_candidate": "candidate confidence from candidate dry-run",
            "N_bounded": "bounded evolutionary novelty, not unbounded invention",
            "I_identity": "candidate identity anchor exists for future Φ7 naming",
            "ε_s": "symbolic entropy/drift score from Drift Analyzer",
            "D_destructive": "maximum destructive drift excluding bounded evolutionary drift",
            "L_limitations": "limitation load required before rendering/projection",
            "G_ghost": "ghost-loop pressure from phase skip, drift, or projection-before-naming risk",
            "B_circuit": "catastrophic circuit breaker flag",
        },
        "thresholds": thresholds,
        "cold_storage_law": {
            "active_stack_only_can_project": True,
            "drift_archive_cannot_project": True,
            "spc_cold_storage_is_silence_not_deletion": True,
            "ghost_loop_is_preserved_but_not_active": True,
            "dream_state_is_quarantined_speculation_not_projection": True,
            "resurrection_requires_chi_t_echo_grace_and_ancestry": True,
        },
        "phase_gate_law": {
            "Φ5_entropy_or_drift_routes_to_correction_or_cold_storage": True,
            "Φ6_correction_required_before_Φ7_naming": True,
            "Φ7_naming_required_before_Φ8_projection": True,
            "Φ8_projection_blocked_in_current_patch": True,
            "Φ9_closure_requires_echo_validation_not_score_alone": True,
        },
    }


def score_candidate(candidate: dict, candidate_report: dict) -> dict:
    """Formal-math-bound read-only coherence scorer.

    This returns a candidate score object; it never renders language, writes
    memory, writes files, calls a model, or approves projection.
    """
    terms = extract_math_terms(candidate, candidate_report)
    thresholds = gate_thresholds()

    A_trace = 1.0 if terms["trace_anchor_present"] else 0.35
    E_echo = terms["echo_alignment"]
    P_phase = terms["phase_validity"]
    C_candidate = terms["candidate_confidence"]
    N_bounded = terms["bounded_novelty"]
    I_identity = 1.0 if terms["identity_anchor_present"] else 0.25
    eps = terms["epsilon_s"]
    D_destructive = terms["max_destructive_drift"]
    L_limitations = terms["limitation_load"]
    G_ghost = terms["ghost_loop_pressure"]
    B_circuit = 1.0 if terms["circuit_breaker"] else 0.0

    raw_score = (
        0.22 * A_trace
        + 0.22 * E_echo
        + 0.16 * P_phase
        + 0.14 * C_candidate
        + 0.10 * N_bounded
        + 0.08 * I_identity
        - 0.24 * eps
        - 0.16 * D_destructive
        - 0.10 * L_limitations
        - 0.20 * G_ghost
        - 0.50 * B_circuit
    )
    raw_coherence = round(clamp(raw_score), 3)
    # Hard override: when the circuit breaker fires, the object cannot proceed
    # regardless of any positive score terms. Reporting a non-zero coherence
    # score for a circuit-broken candidate is misleading — the score would
    # suggest partial merit that cannot be acted upon. Force to 0.0 so the
    # endpoint consumer receives an unambiguous signal.
    # The raw_score_before_clamp is preserved in score_components for audit.
    coherence_score = 0.0 if terms["circuit_breaker"] else raw_coherence

    must_collapse_or_archive = bool(
        terms["circuit_breaker"]
        or eps >= thresholds["theta_epsilon_collapse"]
        or terms["cold_storage_pressure"] >= 0.72
    )
    correction_required = bool(
        terms["chi_required"]
        or coherence_score < thresholds["theta_phi6_correction_min"]
        or E_echo < thresholds["theta_echo_min"]
        or terms["ghost_loop_pressure"] > thresholds["theta_ghost_pressure_max"]
    )

    correction_gate = {
        "gate": "Φ6 correction / χ(t) boundary",
        "required": correction_required,
        "passed": bool((not correction_required) and coherence_score >= thresholds["theta_phi6_correction_min"] and not must_collapse_or_archive),
        "reason": "χ(t), echo alignment, ghost pressure, or low coherence requires correction before naming" if correction_required else "candidate may enter naming dry-run only; projection still blocked",
        "chi_t_required": terms["chi_required"],
        "echo_alignment": E_echo,
        "theta_echo_min": thresholds["theta_echo_min"],
    }
    naming_gate = {
        "gate": "Φ7 naming / identity lock",
        "required": True,
        "passed": bool(correction_gate["passed"] and coherence_score >= thresholds["theta_phi7_naming_min"] and terms["identity_anchor_present"] and not terms["phase_skip_risk"]),
        "reason": "candidate must be corrected, identity-anchored, and phase-valid before naming" if not (correction_gate["passed"] and coherence_score >= thresholds["theta_phi7_naming_min"] and terms["identity_anchor_present"] and not terms["phase_skip_risk"]) else "candidate can become a named manifest seed in a later dry-run",
        "identity_anchor_present": terms["identity_anchor_present"],
        "theta_phi7_naming_min": thresholds["theta_phi7_naming_min"],
    }
    cold_storage_gate = {
        "gate": "SPC / cold storage routing preview",
        "route": "spc_cold_storage_required" if must_collapse_or_archive else ("dream_state_quarantine_candidate" if terms["dream_state_eligible"] else "active_stack_dry_run_candidate"),
        "must_archive": must_collapse_or_archive,
        "cold_storage_pressure": terms["cold_storage_pressure"],
        "ghost_loop_pressure": terms["ghost_loop_pressure"],
        "dream_state_eligible": terms["dream_state_eligible"],
        "law": "Cold storage is silence and preservation, not deletion; no cold/ghost/dream object may project.",
    }
    manifest_gate = {
        "gate": "manifest compiler dry-run eligibility",
        "allowed": bool(naming_gate["passed"] and coherence_score >= thresholds["theta_manifest_seed_min"] and cold_storage_gate["route"] == "active_stack_dry_run_candidate"),
        "reason": "manifest dry-run requires Φ6 correction pass, Φ7 naming pass, active-stack route, and threshold coherence",
        "theta_manifest_seed_min": thresholds["theta_manifest_seed_min"],
    }
    projection_gate = {
        "gate": "Φ8 projection hard block",
        "allowed": False,
        "reason": "Patch 262I2 never projects output. It exposes the engine-bound math contract and blocks renderer/output/memory-write paths.",
    }

    if terms["circuit_breaker"]:
        status = "blocked_by_circuit_breaker"
    elif must_collapse_or_archive:
        status = "cold_storage_required_preview"
    elif correction_required:
        status = "correction_required"
    elif naming_gate["passed"]:
        status = "naming_ready_preview_only"
    else:
        status = "bounded_scoring_preview"

    return {
        "candidate_id": candidate.get("candidate_id"),
        "title": candidate.get("title"),
        "candidate_type": candidate.get("candidate_type"),
        "phase_target": candidate.get("phase_target"),
        "drift_posture": candidate.get("drift_posture"),
        "input_confidence": terms["candidate_confidence"],
        "epsilon_s": eps,
        "coherence_score": coherence_score,
        "status": status,
        "allowed_to_continue_to_manifest_dry_run": bool(manifest_gate["allowed"]),
        "projection_allowed": False,
        "final_language_allowed": False,
        "memory_write_allowed": False,
        "correction_gate": correction_gate,
        "naming_gate": naming_gate,
        "cold_storage_gate": cold_storage_gate,
        "manifest_gate": manifest_gate,
        "projection_gate": projection_gate,
        "required_limitations": terms["candidate_limitations"],
        "score_components": {
            "A_trace": round(A_trace, 3),
            "E_echo": round(E_echo, 3),
            "P_phase": round(P_phase, 3),
            "C_candidate": round(C_candidate, 3),
            "N_bounded": round(N_bounded, 3),
            "I_identity": round(I_identity, 3),
            "epsilon_s_penalty": round(eps, 3),
            "D_destructive_penalty": round(D_destructive, 3),
            "L_limitations_penalty": round(L_limitations, 3),
            "G_ghost_penalty": round(G_ghost, 3),
            "B_circuit_penalty": round(B_circuit, 3),
            "raw_score_before_clamp": round(raw_score, 3),
            "raw_coherence_before_circuit_override": round(raw_coherence, 3),
            "circuit_breaker_zeroed_score": bool(terms["circuit_breaker"]),
        },
        "math_terms": terms,
        "formal_math_binding": "explicit_runtime_contract_v1_engine_bound_read_only",
        "math_kernel_location": "forge/rmc_engine_v1/coherence_math.py",
        "engine_version": ENGINE_VERSION,
    }
