"""RMC Correction Engine + Naming Engine v1.

Patch 262J1R-Preflight-C3R reinforces the next real RMC application stage after
C2R's measured Evolutionary Drift Explorer and Coherence Scorer.

This module consumes S_t coherence scoring output and computes:
    χ_t — correction-route dry-run object with before/after measured drift math.
    N_t — naming dry-run object with deterministic identity proposal and naming
          confidence derived from measured correction stability.

It does not render final language, compile a manifest, approve projection, write
memory, mutate datasets, query Chroma, execute shell, call an LLM, or touch
Identity Vault.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
import re
from typing import Any

from rmc_engine_v1.measurement_kernel import (
    ENGINE_VERSION as MEASUREMENT_KERNEL_VERSION,
    clamp,
    phase_path,
    phase_path_metrics,
    stable_hash,
    stable_id,
)

ENGINE_VERSION = "rmc_correction_naming_engine_v2_patch262J1R_preflight_C3R"
ENGINE_MODE = "read_only_correction_and_naming_engine"
PHASES = [f"Φ{i}" for i in range(1, 10)]


def _utc_now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).replace(microsecond=0).isoformat()


def _clamp(value: Any, low: float = 0.0, high: float = 1.0) -> float:
    return clamp(value, low, high)


def _sha(obj: Any) -> str:
    return stable_hash(obj)


def _stable_id(prefix: str, obj: Any, n: int = 18) -> str:
    return stable_id(prefix, obj, n)


def _as_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    if value in (None, "", {}):
        return []
    return [value]


def correction_naming_boundary() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "engine_module_location": "forge/rmc_engine_v1/correction_naming_engine.py",
        "implements_rmc_stages": [
            "Correction Engine / chi_t",
            "Naming Engine / N_t",
        ],
        "input_contract": "coherence_scorer_report_S_t_with_C2R_measurement_kernel_readings",
        "output_contract": "read_only_correction_plan_and_naming_state_not_manifest_not_rendering",
        "uses_measurement_kernel": True,
        "measurement_kernel_version": MEASUREMENT_KERNEL_VERSION,
        "real_readings_required": [
            "epsilon_s",
            "D_score",
            "sigma_res",
            "phase_delta",
            "phase_path_legal",
            "memory_fit",
            "semantic_distance",
            "novelty_delta",
            "source_confidence",
            "conflict_penalty",
            "projection_gate_penalty",
            "coherence_score",
        ],
        "calls_llm": False,
        "queries_chroma": False,
        "reads_db_files": False,
        "executes_shell": False,
        "writes_files": False,
        "writes_rmc_memory": False,
        "writes_identity_vault": False,
        "mutates_canonical_reference": False,
        "renders_final_language": False,
        "approved_output": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "manifest_allowed": False,
        "note": "C3R computes calibrated correction and naming dry-run states from C2R measured readings. It separates candidate validity from projection-gated score, prevents route conflicts, and does not compile a manifest or render language.",
    }


def _candidate_scores(coherence_report: dict[str, Any]) -> list[dict[str, Any]]:
    scores = coherence_report.get("candidate_scores") if isinstance(coherence_report, dict) else []
    if not isinstance(scores, list):
        return []
    return [s for s in scores if isinstance(s, dict)]


def _selected_score(coherence_report: dict[str, Any]) -> dict[str, Any]:
    selected = coherence_report.get("selected_scored_candidate_preview") if isinstance(coherence_report, dict) else None
    if isinstance(selected, dict) and selected:
        return dict(selected)
    scores = _candidate_scores(coherence_report)
    if not scores:
        return {}
    # Prefer candidates that can at least continue to correction. If none are
    # eligible, choose the highest measured score for containment/correction.
    sorted_scores = sorted(
        scores,
        key=lambda s: (
            bool(s.get("allowed_to_continue_to_correction_engine")),
            float(s.get("coherence_score") or 0.0),
            -float((s.get("measured_evolutionary_drift") or {}).get("epsilon_s") or 1.0),
        ),
        reverse=True,
    )
    return dict(sorted_scores[0])


def _selected_candidate(coherence_report: dict[str, Any], selected_score: dict[str, Any]) -> dict[str, Any]:
    preview = coherence_report.get("selected_candidate_meaning_state_preview") if isinstance(coherence_report, dict) else None
    if isinstance(preview, dict) and preview:
        return dict(preview)
    selected_id = str(selected_score.get("candidate_id") or "")
    source_evo = coherence_report.get("source_evolutionary_drift") if isinstance(coherence_report, dict) else {}
    source_candidate = (source_evo or {}).get("source_candidate_conclusion") if isinstance(source_evo, dict) else {}
    candidates = source_candidate.get("candidate_set") if isinstance(source_candidate, dict) else []
    if isinstance(candidates, list):
        for candidate in candidates:
            if isinstance(candidate, dict) and str(candidate.get("candidate_id") or "") == selected_id:
                return dict(candidate)
    return {}


def _measurement(selected_score: dict[str, Any], selected_candidate: dict[str, Any]) -> dict[str, Any]:
    measured = selected_score.get("measured_evolutionary_drift") if isinstance(selected_score, dict) else {}
    if isinstance(measured, dict) and measured:
        return dict(measured)
    fallback = selected_candidate.get("measurement_kernel") if isinstance(selected_candidate, dict) else {}
    return dict(fallback or {}) if isinstance(fallback, dict) else {}


def _score_components(selected_score: dict[str, Any]) -> dict[str, Any]:
    comps = selected_score.get("score_components") if isinstance(selected_score, dict) else {}
    return dict(comps or {}) if isinstance(comps, dict) else {}


def _phase_path_from(selected_candidate: dict[str, Any], measurement: dict[str, Any]) -> list[str]:
    phase_metrics = measurement.get("phase_metrics") if isinstance(measurement, dict) else {}
    if isinstance(phase_metrics, dict) and phase_metrics.get("phase_path"):
        return phase_path(phase_metrics.get("phase_path"))
    return phase_path(selected_candidate.get("phase_path") if isinstance(selected_candidate, dict) else [])


def _insert_after(path: list[str], after_phase: str, insert_phase: str) -> list[str]:
    if insert_phase in path:
        return path
    out: list[str] = []
    inserted = False
    for p in path:
        out.append(p)
        if p == after_phase and not inserted:
            out.append(insert_phase)
            inserted = True
    if not inserted:
        out.append(insert_phase)
    return out


def _repair_phase_path(path: list[str], measurement: dict[str, Any]) -> dict[str, Any]:
    original = phase_path(path)
    repaired = list(original) if original else []
    if not repaired:
        repaired = ["Φ6"]
    # If drift is present, correction must appear before naming/projection.
    drift_present = "Φ5" in repaired or _clamp(measurement.get("epsilon_s")) > 0.35 or _clamp(measurement.get("D_score")) > 0.45
    projection_present = "Φ8" in repaired
    naming_present = "Φ7" in repaired

    if drift_present and "Φ6" not in repaired:
        if "Φ5" in repaired:
            repaired = _insert_after(repaired, "Φ5", "Φ6")
        else:
            repaired.insert(0, "Φ6")
    if naming_present and "Φ6" in repaired:
        i6 = repaired.index("Φ6")
        i7 = repaired.index("Φ7")
        if i7 < i6:
            repaired.remove("Φ7")
            repaired.insert(repaired.index("Φ6") + 1, "Φ7")
    if projection_present:
        if "Φ6" not in repaired:
            repaired.insert(max(0, repaired.index("Φ8")), "Φ6")
        if "Φ7" not in repaired:
            repaired.insert(max(0, repaired.index("Φ8")), "Φ7")
        # Ensure order Φ6 -> Φ7 -> Φ8.
        before_projection = [p for p in repaired if p != "Φ8"]
        if "Φ6" in before_projection and "Φ7" in before_projection:
            # De-dupe while preserving non export phases, then append export at first intended point.
            cleaned: list[str] = []
            for p in before_projection:
                if p not in cleaned:
                    cleaned.append(p)
            if cleaned.index("Φ7") < cleaned.index("Φ6"):
                cleaned.remove("Φ7")
                cleaned.insert(cleaned.index("Φ6") + 1, "Φ7")
            repaired = cleaned + ["Φ8"]
    # Preserve order, remove duplicates created by repairs.
    deduped: list[str] = []
    for p in repaired:
        if p in PHASES and p not in deduped:
            deduped.append(p)
    repaired = deduped
    original_metrics = phase_path_metrics(original)
    repaired_metrics = phase_path_metrics(repaired)
    return {
        "original_phase_path": original,
        "repaired_phase_path": repaired,
        "original_phase_metrics": original_metrics,
        "repaired_phase_metrics": repaired_metrics,
        "phase_repair_applied": original != repaired or not bool((original_metrics or {}).get("phase_path_legal", True)),
    }


def _taxonomy_pressure(measurement: dict[str, Any], selected_score: dict[str, Any]) -> float:
    taxonomy = measurement.get("drift_taxonomy") if isinstance(measurement, dict) else None
    if isinstance(taxonomy, dict):
        values = []
        for key in ("catastrophic", "recursive", "semantic", "structural", "resonant", "evolutionary", "syntactic"):
            if key in taxonomy:
                values.append(_clamp(taxonomy.get(key)))
        if values:
            return round(max(values), 6)
    status = str(selected_score.get("coherence_status") or "").lower()
    if "weak" in status or "unbounded" in status:
        return 0.55
    if "correction" in status:
        return 0.35
    return 0.20



def _measurement_quality(measurement: dict[str, Any], selected_score: dict[str, Any], repair: dict[str, Any]) -> dict[str, Any]:
    """Compute candidate validity separate from projection-gated coherence.

    C2R's coherence score may be zero because projection/manifest are gated, not
    because the candidate has no internal value. C3R therefore computes a
    candidate-validity score from measured memory/phase/drift fields and keeps
    the projection-gated score separate.
    """
    comps = _score_components(selected_score)
    repaired_metrics = repair.get("repaired_phase_metrics") or {}
    memory_fit = _clamp(measurement.get("memory_fit"))
    semantic_distance = _clamp(measurement.get("semantic_distance"))
    novelty_delta = _clamp(measurement.get("novelty_delta"))
    source_confidence = _clamp(measurement.get("source_confidence"))
    epsilon_s = _clamp(measurement.get("epsilon_s"))
    D_score = _clamp(measurement.get("D_score"))
    phase_validity = _clamp(repaired_metrics.get("phase_validity_score"), 0.0, 1.0)
    operator_legality = _clamp(comps.get("operator_legality"), 0.0, 1.0) if comps else 0.72
    utility_fit = _clamp(comps.get("utility_fit"), 0.0, 1.0) if comps else 0.62
    conflict_penalty = _clamp(comps.get("conflict_penalty"), 0.0, 1.0) if comps else 0.0
    projection_gate_penalty = _clamp(comps.get("projection_gate_penalty"), 0.0, 1.0) if comps else 0.0
    drift_containment = 1.0 - epsilon_s
    novelty_budget = _novelty_budget(measurement, selected_score)
    bounded_novelty_score = 1.0 - min(1.0, abs(novelty_delta - min(novelty_budget, 0.55)) / max(novelty_budget, 0.01))
    semantic_penalty = max(0.0, semantic_distance - 0.62) * 0.55
    novelty_penalty = max(0.0, novelty_delta - novelty_budget) * 0.60
    low_memory_penalty = max(0.0, 0.55 - memory_fit) * 0.50
    drift_pressure_penalty = max(0.0, D_score - 0.48) * 0.35
    conflict_total = (0.36 * conflict_penalty) + (0.26 * projection_gate_penalty)
    candidate_validity_score = _clamp(
        0.20 * memory_fit
        + 0.17 * phase_validity
        + 0.16 * drift_containment
        + 0.14 * source_confidence
        + 0.11 * operator_legality
        + 0.08 * utility_fit
        + 0.08 * bounded_novelty_score
        + 0.06 * (1.0 - semantic_distance)
        - semantic_penalty
        - novelty_penalty
        - low_memory_penalty
        - drift_pressure_penalty
        - conflict_total
    )
    projection_gated_score = _clamp(selected_score.get("coherence_score"))
    support_pressure = _clamp(
        0.38 * semantic_distance
        + 0.28 * novelty_delta
        + 0.22 * (1.0 - memory_fit)
        + 0.12 * conflict_penalty
    )
    return {
        "candidate_validity_score": round(candidate_validity_score, 6),
        "projection_gated_score": round(projection_gated_score, 6),
        "projection_score_interpretation": "projection_gated_score may be zero because manifest/projection remain blocked; candidate_validity_score is the internal correction/naming quality signal.",
        "novelty_budget": round(novelty_budget, 6),
        "bounded_novelty_score": round(_clamp(bounded_novelty_score), 6),
        "support_pressure": round(support_pressure, 6),
        "penalties": {
            "semantic_penalty": round(_clamp(semantic_penalty), 6),
            "novelty_penalty": round(_clamp(novelty_penalty), 6),
            "low_memory_penalty": round(_clamp(low_memory_penalty), 6),
            "drift_pressure_penalty": round(_clamp(drift_pressure_penalty), 6),
            "conflict_total": round(_clamp(conflict_total), 6),
        },
        "components": {
            "memory_fit": round(memory_fit, 6),
            "semantic_distance": round(semantic_distance, 6),
            "novelty_delta": round(novelty_delta, 6),
            "source_confidence": round(source_confidence, 6),
            "epsilon_s": round(epsilon_s, 6),
            "D_score": round(D_score, 6),
            "phase_validity": round(phase_validity, 6),
            "operator_legality": round(operator_legality, 6),
            "utility_fit": round(utility_fit, 6),
            "conflict_penalty": round(conflict_penalty, 6),
            "projection_gate_penalty": round(projection_gate_penalty, 6),
        },
        "formula": "candidate_validity = weighted(memory_fit, phase_validity, drift_containment, source_confidence, operator_legality, utility_fit, bounded_novelty, semantic_proximity) - semantic/novelty/memory/drift/conflict penalties",
    }


def _novelty_budget(measurement: dict[str, Any], selected_score: dict[str, Any]) -> float:
    task = str(
        measurement.get("task_type")
        or selected_score.get("task_type")
        or selected_score.get("candidate_kind")
        or "architecture_design"
    ).lower()
    if "code" in task or "patch" in task:
        return 0.30
    if "definition" in task or "naming" in task:
        return 0.35
    if "scientific" in task or "public" in task or "claim" in task:
        return 0.25
    if "brainstorm" in task or "creative" in task:
        return 0.75
    return 0.55


def _route_decision(measurement: dict[str, Any], post_math: dict[str, Any], repair: dict[str, Any], quality: dict[str, Any]) -> dict[str, Any]:
    post_eps = _clamp(((post_math.get("post_correction_estimate") or {}).get("epsilon_s")))
    validity = _clamp(quality.get("candidate_validity_score"))
    support_pressure = _clamp(quality.get("support_pressure"))
    repaired_legal = bool((repair.get("repaired_phase_metrics") or {}).get("phase_path_legal", False))
    if bool(measurement.get("circuit_breaker")):
        route = "route_to_containment_circuit_breaker"
        action = route
        next_allowed = False
    elif not repaired_legal:
        route = "hold_for_phase_repair_or_archive"
        action = route
        next_allowed = False
    elif post_eps > 0.60 or validity < 0.38:
        route = "hold_for_more_memory_or_archive"
        action = route
        next_allowed = False
    elif support_pressure >= 0.62 or validity < 0.56:
        route = "route_to_naming_engine_cautious_requires_review"
        action = route
        next_allowed = True
    else:
        route = "route_to_naming_engine"
        action = route
        next_allowed = True
    return {
        "recommended_route": route,
        "chi_t_action": action,
        "route_consistent": route == action,
        "next_naming_step_allowed": bool(next_allowed),
        "route_inputs": {
            "post_epsilon_s": round(post_eps, 6),
            "candidate_validity_score": round(validity, 6),
            "support_pressure": round(support_pressure, 6),
            "repaired_phase_path_legal": repaired_legal,
        },
    }

def _correction_strength(measurement: dict[str, Any], selected_score: dict[str, Any], repaired_metrics: dict[str, Any]) -> float:
    memory_fit = _clamp(measurement.get("memory_fit"))
    source_confidence = _clamp(measurement.get("source_confidence"))
    phase_validity = _clamp(repaired_metrics.get("phase_validity_score"), 0.0, 1.0)
    drift_containment = 1.0 - _clamp(measurement.get("epsilon_s"))
    score_components = _score_components(selected_score)
    operator_legality = _clamp(score_components.get("operator_legality"), 0.0, 1.0) if score_components else 0.72
    strength = (
        0.26 * memory_fit
        + 0.22 * source_confidence
        + 0.22 * phase_validity
        + 0.18 * drift_containment
        + 0.12 * operator_legality
    )
    return round(_clamp(strength), 6)


def _post_correction_math(measurement: dict[str, Any], selected_score: dict[str, Any], repair: dict[str, Any]) -> dict[str, Any]:
    repaired_metrics = repair.get("repaired_phase_metrics") or {}
    strength = _correction_strength(measurement, selected_score, repaired_metrics)
    sigma_res = _clamp(measurement.get("sigma_res"))
    pre_D = _clamp(measurement.get("D_score"))
    repaired_delta = _clamp(repaired_metrics.get("max_delta_phi"))
    taxonomy_pressure = _taxonomy_pressure(measurement, selected_score)
    conflict_penalty = _clamp((_score_components(selected_score) or {}).get("conflict_penalty"), 0.0, 1.0)
    projection_penalty = _clamp((_score_components(selected_score) or {}).get("projection_gate_penalty"), 0.0, 1.0)
    residual_penalty = _clamp(0.50 * taxonomy_pressure + 0.30 * conflict_penalty + 0.20 * projection_penalty)
    # Correction can reduce drift only according to measured support. It cannot
    # magically erase taxonomy/conflict/projection penalties.
    post_D = _clamp((pre_D * (1.0 - 0.62 * strength)) + (0.18 * residual_penalty))
    post_epsilon = _clamp((sigma_res + post_D + repaired_delta) / 3.0)
    return {
        "pre_correction": {
            "sigma_res": round(sigma_res, 6),
            "D_score": round(pre_D, 6),
            "delta_phi": round(_clamp((measurement.get("phase_metrics") or {}).get("max_delta_phi")), 6),
            "epsilon_s": round(_clamp(measurement.get("epsilon_s")), 6),
        },
        "post_correction_estimate": {
            "sigma_res": round(sigma_res, 6),
            "D_score": round(post_D, 6),
            "delta_phi": round(repaired_delta, 6),
            "epsilon_s": round(post_epsilon, 6),
            "formula": "post_epsilon_s = (sigma_res + corrected_D_score + corrected_delta_phi) / 3",
        },
        "correction_strength": strength,
        "taxonomy_pressure": round(taxonomy_pressure, 6),
        "residual_penalty": round(residual_penalty, 6),
        "epsilon_reduction": round(_clamp(measurement.get("epsilon_s")) - post_epsilon, 6),
        "D_score_reduction": round(pre_D - post_D, 6),
    }


def _correction_required(measurement: dict[str, Any], selected_score: dict[str, Any], repair: dict[str, Any]) -> bool:
    phase_legal = bool((measurement.get("phase_metrics") or {}).get("phase_path_legal", True))
    return any([
        bool(measurement.get("circuit_breaker")),
        bool(measurement.get("chi_t_required")),
        not phase_legal,
        bool(repair.get("phase_repair_applied")),
        _clamp(measurement.get("epsilon_s")) > 0.35,
        _clamp(measurement.get("D_score")) > 0.48,
        _clamp(measurement.get("semantic_distance")) > 0.82 and _clamp(measurement.get("memory_fit")) < 0.55,
        _clamp((_score_components(selected_score) or {}).get("conflict_penalty")) > 0.20,
        _clamp((_score_components(selected_score) or {}).get("projection_gate_penalty")) > 0.20,
    ])


def _correction_status(measurement: dict[str, Any], selected_score: dict[str, Any], post_math: dict[str, Any], repair: dict[str, Any]) -> str:
    post = post_math.get("post_correction_estimate") or {}
    post_eps = _clamp(post.get("epsilon_s"))
    repaired_legal = bool((repair.get("repaired_phase_metrics") or {}).get("phase_path_legal", False))
    if bool(measurement.get("circuit_breaker")):
        return "blocked_by_circuit_breaker_route_to_containment"
    if not repaired_legal:
        return "correction_failed_phase_path_still_illegal"
    if post_eps <= 0.35:
        return "correction_passes_stable_for_naming_dry_run"
    if post_eps <= 0.60:
        return "correction_partial_requires_naming_caution"
    return "correction_insufficient_route_to_archive_or_more_memory"


def _name_slug(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", str(text or "").strip().lower()).strip("_")
    return cleaned[:64] or "unnamed_rmc_candidate"


def _extract_name_terms(candidate: dict[str, Any], selected_score: dict[str, Any]) -> dict[str, Any]:
    text_parts = [
        str(candidate.get("candidate") or ""),
        str(candidate.get("title") or ""),
        str(candidate.get("candidate_kind") or ""),
        str(selected_score.get("title") or ""),
    ]
    for key in ("memory_links", "supporting_memory", "memory_support"):
        value = candidate.get(key) if isinstance(candidate, dict) else None
        if isinstance(value, list):
            for item in value[:6]:
                if isinstance(item, dict):
                    text_parts.append(str(item.get("title") or item.get("source") or item.get("content_summary") or ""))
                else:
                    text_parts.append(str(item))
    raw = " ".join(text_parts)
    tokens = [t.lower() for t in re.findall(r"[A-Za-z][A-Za-z0-9_\-]*", raw)]
    stop = {
        "candidate", "preview", "dry", "run", "the", "and", "or", "for", "with", "before", "after", "from",
        "into", "this", "that", "what", "how", "does", "must", "should", "active", "input", "event", "state",
        "direct", "preserve", "preserving", "next", "possible", "meaning",
    }
    priority = [
        "drift", "correction", "correct", "naming", "name", "projection", "trace", "memory", "manifest",
        "phase", "coherence", "operator", "candidate", "bounded", "novelty", "echo", "validation",
    ]
    counts: dict[str, int] = {}
    for token in tokens:
        token = token.replace("_", "-").strip("-")
        if len(token) < 3 or token in stop:
            continue
        if token == "correct":
            token = "correction"
        if token == "name":
            token = "naming"
        counts[token] = counts.get(token, 0) + 1
    ranked = sorted(counts, key=lambda t: ((0 if t in priority else 1), priority.index(t) if t in priority else 99, -counts[t], t))
    selected = ranked[:5] or ["trace", "correction", "state"]
    return {"selected_terms": selected, "term_counts": {k: counts[k] for k in selected}, "raw_term_count": len(counts)}


def _proposed_name(candidate: dict[str, Any], repair: dict[str, Any], selected_score: dict[str, Any]) -> str:
    terms = _extract_name_terms(candidate, selected_score).get("selected_terms", [])
    repaired_path = repair.get("repaired_phase_path", []) or []
    label_terms: list[str] = []
    if "Φ5" in repaired_path and "Φ6" in repaired_path:
        label_terms.append("Drift-Corrected")
    elif "Φ6" in repaired_path:
        label_terms.append("Correction-Bound")
    if "Φ7" in repaired_path:
        label_terms.append("Naming")
    if "Φ8" in repaired_path:
        label_terms.append("Projection-Gated")
    for term in terms:
        nice = term.replace("-", " ").title().replace(" ", "-")
        if nice.lower() not in {x.lower() for x in label_terms}:
            label_terms.append(nice)
        if len(label_terms) >= 6:
            break
    return " ".join(label_terms[:6]) or "RMC Corrected Naming State"

def _naming_confidence(measurement: dict[str, Any], selected_score: dict[str, Any], post_math: dict[str, Any], repair: dict[str, Any], quality: dict[str, Any] | None = None) -> dict[str, Any]:
    quality = dict(quality or {})
    post = post_math.get("post_correction_estimate") or {}
    post_stability = 1.0 - _clamp(post.get("epsilon_s"))
    memory_fit = _clamp(measurement.get("memory_fit"))
    semantic_distance = _clamp(measurement.get("semantic_distance"))
    novelty_delta = _clamp(measurement.get("novelty_delta"))
    source_confidence = _clamp(measurement.get("source_confidence"))
    phase_validity = _clamp((repair.get("repaired_phase_metrics") or {}).get("phase_validity_score"))
    candidate_validity = _clamp(quality.get("candidate_validity_score"))
    comps = _score_components(selected_score)
    operator_legality = _clamp(comps.get("operator_legality"), 0.0, 1.0) if comps else 0.72
    conflict_penalty = _clamp(comps.get("conflict_penalty"), 0.0, 1.0) if comps else 0.0
    projection_penalty = _clamp(comps.get("projection_gate_penalty"), 0.0, 1.0) if comps else 0.0
    high_semantic_penalty = max(0.0, semantic_distance - 0.72) * 0.58
    high_novelty_penalty = max(0.0, novelty_delta - _novelty_budget(measurement, selected_score)) * 0.48
    low_memory_penalty = max(0.0, 0.52 - memory_fit) * 0.42
    confidence = _clamp(
        0.28 * candidate_validity
        + 0.20 * post_stability
        + 0.16 * memory_fit
        + 0.12 * source_confidence
        + 0.10 * phase_validity
        + 0.08 * operator_legality
        + 0.06 * (1.0 - semantic_distance)
        - high_semantic_penalty
        - high_novelty_penalty
        - low_memory_penalty
        - 0.18 * conflict_penalty
        - 0.10 * projection_penalty
    )
    return {
        "naming_confidence": round(confidence, 6),
        "formula": "0.28*candidate_validity + 0.20*post_stability + 0.16*memory_fit + 0.12*source_confidence + 0.10*phase_validity + 0.08*operator_legality + 0.06*semantic_proximity - semantic/novelty/memory/conflict/projection penalties",
        "components": {
            "candidate_validity_score": round(candidate_validity, 6),
            "post_stability": round(post_stability, 6),
            "memory_fit": round(memory_fit, 6),
            "semantic_distance": round(semantic_distance, 6),
            "novelty_delta": round(novelty_delta, 6),
            "source_confidence": round(source_confidence, 6),
            "phase_validity": round(phase_validity, 6),
            "operator_legality": round(operator_legality, 6),
            "conflict_penalty": round(conflict_penalty, 6),
            "projection_gate_penalty": round(projection_penalty, 6),
        },
        "penalties": {
            "high_semantic_penalty": round(_clamp(high_semantic_penalty), 6),
            "high_novelty_penalty": round(_clamp(high_novelty_penalty), 6),
            "low_memory_penalty": round(_clamp(low_memory_penalty), 6),
        },
    }

def _make_correction_state(coherence_report: dict[str, Any], selected_score: dict[str, Any], selected_candidate: dict[str, Any]) -> dict[str, Any]:
    measurement = _measurement(selected_score, selected_candidate)
    path = _phase_path_from(selected_candidate, measurement)
    repair = _repair_phase_path(path, measurement)
    post_math = _post_correction_math(measurement, selected_score, repair)
    quality = _measurement_quality(measurement, selected_score, repair)
    required = _correction_required(measurement, selected_score, repair)
    status = _correction_status(measurement, selected_score, post_math, repair)
    correction_allowed = not bool(measurement.get("circuit_breaker"))
    route = _route_decision(measurement, post_math, repair, quality)
    chi_id = _stable_id("chi", {
        "score_set_id": coherence_report.get("score_set_id"),
        "candidate_id": selected_score.get("candidate_id"),
        "repair": repair.get("repaired_phase_path"),
        "post": post_math.get("post_correction_estimate"),
        "quality": quality.get("candidate_validity_score"),
    })
    return {
        "chi_t_id": chi_id,
        "status": status,
        "correction_required": bool(required),
        "correction_user_requested": _input_user_requested_correction(coherence_report),
        "correction_allowed": bool(correction_allowed),
        "candidate_id": selected_score.get("candidate_id"),
        "candidate_validity_score": quality.get("candidate_validity_score"),
        "projection_gated_score": quality.get("projection_gated_score"),
        "score_separation": {
            "candidate_validity_score": quality.get("candidate_validity_score"),
            "projection_gated_score": quality.get("projection_gated_score"),
            "reason": quality.get("projection_score_interpretation"),
        },
        "measured_inputs": {
            "epsilon_s": round(_clamp(measurement.get("epsilon_s")), 6),
            "D_score": round(_clamp(measurement.get("D_score")), 6),
            "sigma_res": round(_clamp(measurement.get("sigma_res")), 6),
            "semantic_distance": round(_clamp(measurement.get("semantic_distance")), 6),
            "memory_fit": round(_clamp(measurement.get("memory_fit")), 6),
            "novelty_delta": round(_clamp(measurement.get("novelty_delta")), 6),
            "source_confidence": round(_clamp(measurement.get("source_confidence")), 6),
        },
        "quality_calibration": quality,
        "phase_repair": repair,
        "correction_math": post_math,
        "recommended_route": route.get("recommended_route"),
        "chi_t_action": route.get("chi_t_action"),
        "route_consistency": route,
        "projection_allowed_after_correction": False,
        "manifest_allowed_after_correction": False,
        "memory_write_allowed_after_correction": False,
        "axiom_binding": {
            "phase_6_closure_before_projection": True,
            "meaning_precedes_rendering": True,
            "no_output_without_trace": True,
        },
    }


def _input_user_requested_correction(coherence_report: dict[str, Any]) -> bool:
    src = coherence_report.get("source_evolutionary_drift") if isinstance(coherence_report, dict) else {}
    cand = (src or {}).get("source_candidate_conclusion") if isinstance(src, dict) else {}
    trace = (cand or {}).get("source_trace_spine") if isinstance(cand, dict) else {}
    raw = ""
    try:
        raw = str((trace.get("input_event") or {}).get("raw_input_preview") or "")
    except Exception:
        raw = ""
    return bool(re.search(r"\b(correct|repair|fix|realign|restore|clarify)\b", raw, re.I))


def _make_naming_state(coherence_report: dict[str, Any], selected_score: dict[str, Any], selected_candidate: dict[str, Any], correction_state: dict[str, Any]) -> dict[str, Any]:
    measurement = _measurement(selected_score, selected_candidate)
    repair = correction_state.get("phase_repair") or {}
    post_math = correction_state.get("correction_math") or {}
    quality = correction_state.get("quality_calibration") or {}
    confidence = _naming_confidence(measurement, selected_score, post_math, repair, quality)
    proposed = _proposed_name(selected_candidate, repair, selected_score)
    slug = _name_slug(proposed)
    repaired_path = repair.get("repaired_phase_path") or []
    corrected_eps = _clamp(((post_math.get("post_correction_estimate") or {}).get("epsilon_s")))
    candidate_validity = _clamp(quality.get("candidate_validity_score"))
    support_pressure = _clamp(quality.get("support_pressure"))
    memory_fit = _clamp(measurement.get("memory_fit"))
    semantic_distance = _clamp(measurement.get("semantic_distance"))
    novelty_delta = _clamp(measurement.get("novelty_delta"))
    route = correction_state.get("recommended_route")
    naming_allowed = bool(
        "Φ6" in repaired_path
        and correction_state.get("correction_allowed") is True
        and candidate_validity >= 0.46
        and confidence.get("naming_confidence", 0.0) >= 0.46
        and corrected_eps <= 0.58
        and route in {"route_to_naming_engine", "route_to_naming_engine_cautious_requires_review"}
        and not bool(measurement.get("circuit_breaker"))
    )
    stable_naming = bool(
        naming_allowed
        and route == "route_to_naming_engine"
        and candidate_validity >= 0.62
        and confidence.get("naming_confidence", 0.0) >= 0.62
        and corrected_eps <= 0.38
        and memory_fit >= 0.55
        and semantic_distance <= 0.78
        and novelty_delta <= _novelty_budget(measurement, selected_score)
        and support_pressure < 0.56
    )
    if stable_naming:
        status = "naming_candidate_stable_internal_only"
        public_status = "candidate_name_stable_but_not_projectable_until_manifest_echo"
    elif naming_allowed:
        status = "naming_candidate_cautious_requires_review"
        public_status = "candidate_name_requires_review_memory_support_and_future_manifest_validation"
    else:
        status = "naming_candidate_blocked"
        public_status = "naming_blocked_until_correction_or_memory_support_improves"
    name_id = _stable_id("nt", {"name": proposed, "candidate_id": selected_score.get("candidate_id"), "chi_t_id": correction_state.get("chi_t_id")})
    derivation = _extract_name_terms(selected_candidate, selected_score)
    return {
        "N_t_id": name_id,
        "status": status,
        "naming_allowed": naming_allowed,
        "stable_naming": stable_naming,
        "candidate_id": selected_score.get("candidate_id"),
        "proposed_name": proposed,
        "machine_name": slug,
        "name_derivation": {
            **derivation,
            "phase_path_used": repaired_path,
            "route_used": route,
            "derived_from_candidate_text": bool(selected_candidate.get("candidate") or selected_candidate.get("title")),
        },
        "definition": str(selected_candidate.get("candidate") or selected_score.get("title") or proposed)[:420],
        "phase_role": "Φ7 naming after Φ6 correction" if "Φ6" in repaired_path else "naming_blocked_missing_correction_phase",
        "phase_path": repaired_path,
        "allowed_use": [
            "internal_trace_label",
            "candidate_identity_handle",
            "future_manifest_input_after_correction_and_coherence_validation",
        ] if naming_allowed else ["review_only", "correction_required_before_use"],
        "forbidden_use": [
            "final_language_rendering",
            "public_projection",
            "memory_write_as_truth",
            "canonical_reference_mutation",
            "identity_vault_authority_claim",
        ],
        "memory_tag_preview": f"rmc/name/{slug}",
        "public_status": public_status,
        "naming_confidence_report": confidence,
        "source_correction_state": {
            "chi_t_id": correction_state.get("chi_t_id"),
            "status": correction_state.get("status"),
            "post_epsilon_s": ((correction_state.get("correction_math") or {}).get("post_correction_estimate") or {}).get("epsilon_s"),
            "candidate_validity_score": correction_state.get("candidate_validity_score"),
            "projection_gated_score": correction_state.get("projection_gated_score"),
            "route_consistent": (correction_state.get("route_consistency") or {}).get("route_consistent"),
        },
        "manifest_allowed_after_naming": False,
        "projection_allowed_after_naming": False,
        "memory_write_allowed_after_naming": False,
        "axiom_binding": {
            "naming_not_projection": True,
            "language_is_output_modality_not_core_state": True,
            "phase_6_before_phase_7_before_phase_8": True,
        },
    }

def run_correction_and_naming(coherence_report: dict[str, Any]) -> dict[str, Any]:
    """Produce χ_t and N_t from measured S_t without rendering or writing."""
    if not isinstance(coherence_report, dict):
        coherence_report = {}
    selected_score = _selected_score(coherence_report)
    selected_candidate = _selected_candidate(coherence_report, selected_score)
    if not selected_score:
        return {
            "status": "BLOCKED",
            "engine_version": ENGINE_VERSION,
            "engine_mode": ENGINE_MODE,
            "stage": "Correction Engine + Naming Engine",
            "failure_code": "RMC_C3_NO_SCORED_CANDIDATE_AVAILABLE",
            "chi_t_present": False,
            "N_t_present": False,
            "manifest_allowed": False,
            "projection_allowed": False,
            "memory_write_allowed": False,
            "boundary": correction_naming_boundary(),
        }
    correction_state = _make_correction_state(coherence_report, selected_score, selected_candidate)
    naming_state = _make_naming_state(coherence_report, selected_score, selected_candidate, correction_state)
    run_id = _stable_id("c3run", {
        "score_set_id": coherence_report.get("score_set_id"),
        "candidate_id": selected_score.get("candidate_id"),
        "chi": correction_state.get("chi_t_id"),
        "name": naming_state.get("N_t_id"),
    })
    correction_passed = str(correction_state.get("status") or "").startswith("correction_passes") or str(correction_state.get("status") or "").startswith("correction_partial")
    naming_allowed = bool(naming_state.get("naming_allowed"))
    return {
        "status": "OK",
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "stage": "Correction Engine + Naming Engine",
        "run_id": run_id,
        "trace_id": coherence_report.get("trace_id"),
        "score_set_id": coherence_report.get("score_set_id"),
        "candidate_set_id": coherence_report.get("candidate_set_id"),
        "selected_candidate_id": selected_score.get("candidate_id"),
        "chi_t_present": True,
        "N_t_present": True,
        "chi_t": correction_state,
        "N_t": naming_state,
        "source_coherence_scorer": coherence_report,
        "C3_summary": {
            "correction_passed_for_dry_run": bool(correction_passed),
            "naming_allowed_for_dry_run": bool(naming_allowed),
            "post_correction_epsilon_s": ((correction_state.get("correction_math") or {}).get("post_correction_estimate") or {}).get("epsilon_s"),
            "naming_confidence": (naming_state.get("naming_confidence_report") or {}).get("naming_confidence"),
            "candidate_validity_score": correction_state.get("candidate_validity_score"),
            "projection_gated_score": correction_state.get("projection_gated_score"),
            "route_consistent": (correction_state.get("route_consistency") or {}).get("route_consistent"),
            "stable_naming": naming_state.get("stable_naming"),
            "manifest_compiler_next": True,
            "manifest_allowed": False,
            "renderer_allowed": False,
            "projection_allowed": False,
            "memory_write_allowed": False,
        },
        "recommended_sequence": [
            "Use χ_t to repair/route measured drift before naming.",
            "Use N_t as an internal identity handle only; naming is not projection.",
            "Next stage should compile μ_t manifest from corrected/named candidate, still before rendering or memory write.",
        ],
        "boundary": correction_naming_boundary(),
        "writes_files": False,
        "identity_vault_write": False,
        "rmc_live_memory_write": False,
        "renders_final_language": False,
        "manifest_allowed": False,
        "projection_allowed": False,
        "memory_write_allowed": False,
        "approved_output": False,
    }
