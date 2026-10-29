"""
forge/rmc_engine_v1/mea/gate_engine.py

Patch 290 — True MEA Gate Engine Extension Preview.

Reusable, deterministic gate evaluation for MEA generated candidates.
This layer consumes Patch 288 generated candidate previews and Patch 289
score outputs only as evidence. It does not seal, commit, render, write
memory, call an LLM, execute shell commands, touch Chroma, or touch the
Identity Vault.

Core law:
    Gates override scores.
    Scores may rank candidates but cannot rescue a failed hard gate.
    Recall stays reference-only and cannot become discovery.
    Hypothesis/speculative branches cannot become verified claims by score.
    Rejected/tampered candidates are internal containment previews only.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence, Tuple

from .candidate_generator import build_candidate_generator_preview
from .manifest_schema import ClaimStatus, OutputPermission, build_144hz_test_manifest, canonical_hash

GATE_ENGINE_PATCH_ID = "Patch 290 — True MEA Gate Engine Extension Preview"
GATE_ENGINE_SCHEMA_VERSION = "mea_gate_engine_v1_patch290"
GATE_ENGINE_MODE = "controlled_mea_gate_engine_preview_patch290"
GATE_ENGINE_APPROVAL_TOKEN = "APPROVE_MEA_GATE_ENGINE_PREVIEW"
GATE_ENGINE_STATUS_ROUTE = "/api/mea/gate-engine/status"
GATE_ENGINE_PREVIEW_ROUTE = "/api/mea/gate-engine-preview"
GATE_ENGINE_POST_ROUTE = "/api/mea/gate-engine-gate"
GATE_ENGINE_FORMULA = (
    "GateEngine(c_i)=Replay∧¬Tamper∧ProofDebt∧Convergence∧InfoGain∧"
    "Drift∧Phase∧ClaimStatus∧RenderScope∧SealBlocked∧MemoryBlocked; score cannot override gate"
)

GATE_NAMES = (
    "replay_gate",
    "tamper_hash_gate",
    "proof_debt_gate",
    "convergence_gate",
    "information_gain_gate",
    "drift_gate",
    "phase_gate",
    "claim_status_gate",
    "render_scope_gate",
    "seal_permission_gate",
    "memory_permission_gate",
)

SELECTABLE_PREVIEW_STATUSES = {
    ClaimStatus.HYPOTHESIS.value,
    ClaimStatus.SPECULATIVE_BRANCH.value,
    ClaimStatus.TEST_REQUIRED.value,
    ClaimStatus.PARTIAL_RESOLUTION.value,
    ClaimStatus.NAMED_CONCEPT.value,
    ClaimStatus.CONTRADICTION_EXPOSED.value,
}

REFERENCE_ONLY_STATUSES = {ClaimStatus.RECALL.value}
REJECTED_STATUSES = {ClaimStatus.REJECTED.value, ClaimStatus.COLD_STORED.value}

DRIFT_THRESHOLD = 0.35
CONVERGENCE_FLOOR = 0.10
VERIFIED_PROOF_DEBT_LIMIT = 0.20
DERIVED_PROOF_DEBT_LIMIT = 0.40
PREVIEW_PROOF_DEBT_LIMIT = 0.95


def _stable_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _stable_hash(value: Any) -> str:
    return hashlib.sha256(_stable_json(value).encode("utf-8")).hexdigest()


def _as_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, Mapping):
        return dict(value)
    if hasattr(value, "to_dict"):
        return dict(value.to_dict())
    if hasattr(value, "__dict__"):
        return dict(value.__dict__)
    raise TypeError(f"candidate cannot be converted to dict: {type(value).__name__}")


def _round(value: Any, fallback: float = 0.0) -> float:
    try:
        return round(float(value), 6)
    except Exception:
        return round(float(fallback), 6)


def _gate_lookup(candidate: Mapping[str, Any]) -> Dict[str, Mapping[str, Any]]:
    result: Dict[str, Mapping[str, Any]] = {}
    for gate in candidate.get("verification_gates", ()) or ():
        if isinstance(gate, Mapping):
            name = str(gate.get("check_name", ""))
            result[name] = gate
        elif hasattr(gate, "to_dict"):
            payload = gate.to_dict()
            name = str(payload.get("check_name", ""))
            result[name] = payload
    return result


def _score_bundle(candidate: Mapping[str, Any]) -> Mapping[str, Any]:
    bundle = candidate.get("score_bundle") or {}
    return bundle if isinstance(bundle, Mapping) else {}


def _candidate_bool(candidate: Mapping[str, Any], key: str, default: bool = False) -> bool:
    return bool(candidate.get(key, default))


@dataclass(frozen=True)
class GateCheck:
    gate_name: str
    passed: bool
    severity: str
    observed: Any = None
    threshold: Any = None
    detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class GateReport:
    candidate_id: str
    candidate_hash: Optional[str]
    parent_hash: Optional[str]
    claim_status: str
    gate_vector: Tuple[Dict[str, Any], ...]
    hard_gate_passed: bool
    soft_warning_count: int
    soft_warnings: Tuple[str, ...]
    decision: str
    rejection_reason: Optional[str]
    selectable_preview: bool
    reference_only: bool
    user_visible: bool
    seal_blocked: bool
    memory_promotion_blocked: bool
    render_permission: str
    score_can_override_gate: bool
    gate_report_hash: str
    patch_id: str = GATE_ENGINE_PATCH_ID
    schema_version: str = GATE_ENGINE_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _build_gate_checks(candidate: Mapping[str, Any]) -> Tuple[Tuple[GateCheck, ...], Tuple[str, ...]]:
    gates = _gate_lookup(candidate)
    bundle = _score_bundle(candidate)
    claim_status = str(candidate.get("claim_status", ""))
    candidate_id = str(candidate.get("candidate_id", ""))
    replay_report = candidate.get("replay_report") or {}
    replay_report = replay_report if isinstance(replay_report, Mapping) else {}

    verification_passed = _candidate_bool(candidate, "verification_passed", False)
    replay_gate = gates.get("check_replay", {})
    replay_confirmed = bool(replay_report.get("replay_confirmed", replay_gate.get("passed", False)))
    tamper_detected = bool(replay_report.get("tamper_detected", False))

    proof_debt = _round((bundle.get("proof_debt") or {}).get("proof_debt", candidate.get("proof_debt", 1.0)), 1.0)
    information_gain = _round((bundle.get("information_gain") or {}).get("information_gain", 0.0), 0.0)
    convergence = _round((bundle.get("convergence") or {}).get("omega", (bundle.get("convergence") or {}).get("convergence", 0.0)), 0.0)
    operator_cost = _round((bundle.get("operator_cost") or {}).get("operator_cost", 0.0), 0.0)
    drift_gate = gates.get("check_drift", {})
    drift_total = _round(drift_gate.get("observed", 0.0), 0.0)
    draft_hash = candidate.get("draft_hash")
    parent_hash = candidate.get("parent_hash")
    structurally_changed = bool(draft_hash and parent_hash and draft_hash != parent_hash)

    checks = []
    warnings = []

    checks.append(GateCheck(
        "replay_gate",
        replay_confirmed,
        "hard",
        observed=replay_confirmed,
        threshold=True,
        detail="Replay confirmed." if replay_confirmed else "Replay failed or was not confirmed.",
    ))
    checks.append(GateCheck(
        "tamper_hash_gate",
        not tamper_detected,
        "hard",
        observed=tamper_detected,
        threshold=False,
        detail="No tamper/hash mismatch detected." if not tamper_detected else "Tamper/hash mismatch detected.",
    ))

    if claim_status == ClaimStatus.VERIFIED_CLAIM.value:
        pd_passed = proof_debt < VERIFIED_PROOF_DEBT_LIMIT
        pd_threshold = VERIFIED_PROOF_DEBT_LIMIT
    elif claim_status == ClaimStatus.DERIVED_CLAIM.value:
        pd_passed = proof_debt < DERIVED_PROOF_DEBT_LIMIT
        pd_threshold = DERIVED_PROOF_DEBT_LIMIT
    elif claim_status == ClaimStatus.REJECTED.value:
        pd_passed = False
        pd_threshold = 0.0
    else:
        pd_passed = proof_debt <= PREVIEW_PROOF_DEBT_LIMIT
        pd_threshold = PREVIEW_PROOF_DEBT_LIMIT
        if proof_debt >= VERIFIED_PROOF_DEBT_LIMIT:
            warnings.append("High proof debt blocks verified_claim regardless of score.")

    checks.append(GateCheck(
        "proof_debt_gate",
        pd_passed,
        "hard",
        observed=proof_debt,
        threshold=pd_threshold,
        detail="Proof debt compatible with current claim status." if pd_passed else "Proof debt incompatible with current claim status.",
    ))

    is_recall = claim_status == ClaimStatus.RECALL.value
    is_rejected = claim_status == ClaimStatus.REJECTED.value
    convergence_passed = is_recall or is_rejected or convergence >= CONVERGENCE_FLOOR or structurally_changed
    checks.append(GateCheck(
        "convergence_gate",
        convergence_passed,
        "hard",
        observed=convergence,
        threshold=CONVERGENCE_FLOOR,
        detail="Convergence sufficient for preview or candidate is reference/rejected." if convergence_passed else "Convergence below floor.",
    ))

    no_information_gain = information_gain <= 0.0 and not structurally_changed
    information_passed = is_recall or is_rejected or not no_information_gain
    if is_recall and information_gain == 0.0:
        warnings.append("Recall has I(c_i)=0 and remains reference-only, not discovery.")
    checks.append(GateCheck(
        "information_gain_gate",
        information_passed,
        "hard",
        observed={"information_gain": information_gain, "structurally_changed": structurally_changed},
        threshold="non-recall candidates need structural change or I(c_i)>0",
        detail="Information gain/structural change is compatible with claim status." if information_passed else "Non-recall candidate lacks information gain and structural change.",
    ))

    checks.append(GateCheck(
        "drift_gate",
        drift_total <= DRIFT_THRESHOLD,
        "hard",
        observed=drift_total,
        threshold=DRIFT_THRESHOLD,
        detail="Drift is within threshold." if drift_total <= DRIFT_THRESHOLD else "Drift exceeds threshold.",
    ))

    checks.append(GateCheck(
        "phase_gate",
        True,
        "soft",
        observed="preview_pass",
        threshold="phase engine not yet wired",
        detail="Phase gate preview-pass; full phase coherence engine remains future work.",
    ))
    warnings.append("Phase gate uses preview-pass until the dedicated phase coherence engine is wired.")

    allowed_statuses = {
        ClaimStatus.RECALL.value,
        ClaimStatus.HYPOTHESIS.value,
        ClaimStatus.SPECULATIVE_BRANCH.value,
        ClaimStatus.TEST_REQUIRED.value,
        ClaimStatus.PARTIAL_RESOLUTION.value,
        ClaimStatus.NAMED_CONCEPT.value,
        ClaimStatus.CONTRADICTION_EXPOSED.value,
        ClaimStatus.COLD_STORED.value,
        ClaimStatus.REJECTED.value,
        ClaimStatus.DERIVED_CLAIM.value,
        ClaimStatus.VERIFIED_CLAIM.value,
    }
    if claim_status == ClaimStatus.VERIFIED_CLAIM.value:
        status_passed = pd_passed and replay_confirmed and not tamper_detected
    else:
        status_passed = claim_status in allowed_statuses
    checks.append(GateCheck(
        "claim_status_gate",
        status_passed,
        "hard",
        observed=claim_status,
        threshold="known ClaimStatus and compatible with proof/replay",
        detail="Claim status is structurally allowed." if status_passed else "Claim status is not allowed.",
    ))

    if claim_status == ClaimStatus.RECALL.value:
        render_scope_passed = True
        render_detail = "Recall may be shown only as reference-only, not discovery."
    elif claim_status == ClaimStatus.REJECTED.value:
        render_scope_passed = False
        render_detail = "Rejected candidates are internal only."
    elif claim_status == ClaimStatus.VERIFIED_CLAIM.value and proof_debt >= VERIFIED_PROOF_DEBT_LIMIT:
        render_scope_passed = False
        render_detail = "Verified rendering blocked by proof debt."
    else:
        render_scope_passed = replay_confirmed and not tamper_detected and verification_passed
        render_detail = "Selectable preview render scope only; no final user rendering." if render_scope_passed else "Render scope blocked by failed verification."
    checks.append(GateCheck(
        "render_scope_gate",
        render_scope_passed,
        "hard",
        observed=claim_status,
        threshold="preview-only scope",
        detail=render_detail,
    ))

    checks.append(GateCheck(
        "seal_permission_gate",
        False,
        "hard",
        observed=False,
        threshold="blocked in Patch 290",
        detail="Seal permission is explicitly blocked; /api/mea/seal remains unavailable.",
    ))
    checks.append(GateCheck(
        "memory_permission_gate",
        False,
        "hard",
        observed=False,
        threshold="blocked in Patch 290",
        detail="Memory promotion is explicitly blocked in Patch 290.",
    ))

    return tuple(checks), tuple(dict.fromkeys(warnings))


def _decision(candidate: Mapping[str, Any], checks: Sequence[GateCheck]) -> Dict[str, Any]:
    claim_status = str(candidate.get("claim_status", ""))
    blocking_failures = [
        c for c in checks
        if c.severity == "hard" and not c.passed and c.gate_name not in {"seal_permission_gate", "memory_permission_gate"}
    ]

    if claim_status == ClaimStatus.REJECTED.value or blocking_failures:
        return {
            "decision": "REJECTED",
            "selectable_preview": False,
            "reference_only": False,
            "user_visible": False,
            "render_permission": OutputPermission.SEALED.value,
            "rejection_reason": candidate.get("rejection_reason") or (blocking_failures[0].detail if blocking_failures else "rejected"),
        }
    if claim_status == ClaimStatus.RECALL.value:
        return {
            "decision": "REFERENCE_ONLY",
            "selectable_preview": False,
            "reference_only": True,
            "user_visible": True,
            "render_permission": OutputPermission.PROJECTION_ONLY.value,
            "rejection_reason": None,
        }
    if claim_status == ClaimStatus.SPECULATIVE_BRANCH.value:
        return {
            "decision": "PASS_BOUNDED_PREVIEW_ONLY",
            "selectable_preview": True,
            "reference_only": False,
            "user_visible": True,
            "render_permission": OutputPermission.RENDER_ALLOWED.value,
            "rejection_reason": None,
        }
    if claim_status in SELECTABLE_PREVIEW_STATUSES:
        return {
            "decision": "PASS_PREVIEW_ONLY",
            "selectable_preview": True,
            "reference_only": False,
            "user_visible": True,
            "render_permission": OutputPermission.RENDER_ALLOWED.value,
            "rejection_reason": None,
        }
    return {
        "decision": "CONTAINMENT_PREVIEW_ONLY",
        "selectable_preview": False,
        "reference_only": False,
        "user_visible": False,
        "render_permission": OutputPermission.SEALED.value,
        "rejection_reason": "containment status is not selectable",
    }


def build_gate_vector(candidate: Mapping[str, Any]) -> Dict[str, Any]:
    candidate_payload = _as_dict(candidate)
    checks, warnings = _build_gate_checks(candidate_payload)
    blocking_failures = [
        c for c in checks
        if c.severity == "hard" and not c.passed and c.gate_name not in {"seal_permission_gate", "memory_permission_gate"}
    ]
    return {
        "candidate_id": candidate_payload.get("candidate_id"),
        "candidate_hash": candidate_payload.get("candidate_hash"),
        "parent_hash": candidate_payload.get("parent_hash"),
        "claim_status": candidate_payload.get("claim_status"),
        "gates": tuple(c.to_dict() for c in checks),
        "gate_names": tuple(c.gate_name for c in checks),
        "hard_gate_passed": len(blocking_failures) == 0,
        "blocking_failure_count": len(blocking_failures),
        "blocking_failures": tuple(c.to_dict() for c in blocking_failures),
        "soft_warning_count": len(warnings),
        "soft_warnings": warnings,
        "seal_blocked": True,
        "memory_promotion_blocked": True,
        "score_can_override_gate": False,
        "patch_id": GATE_ENGINE_PATCH_ID,
        "schema_version": GATE_ENGINE_SCHEMA_VERSION,
    }


def classify_gate_decision(gate_vector: Mapping[str, Any], candidate: Mapping[str, Any]) -> Dict[str, Any]:
    candidate_payload = _as_dict(candidate)
    checks = tuple(GateCheck(**g) for g in gate_vector.get("gates", ()))
    return _decision(candidate_payload, checks)


def evaluate_candidate_gate(candidate: Mapping[str, Any], context: Optional[Mapping[str, Any]] = None) -> GateReport:
    candidate_payload = _as_dict(candidate)
    gate_vector = build_gate_vector(candidate_payload)
    decision = classify_gate_decision(gate_vector, candidate_payload)
    report_payload = {
        "candidate_id": candidate_payload.get("candidate_id"),
        "candidate_hash": candidate_payload.get("candidate_hash"),
        "parent_hash": candidate_payload.get("parent_hash"),
        "claim_status": candidate_payload.get("claim_status"),
        "gate_vector": gate_vector,
        "decision": decision["decision"],
        "seal_blocked": True,
        "memory_promotion_blocked": True,
        "schema_version": GATE_ENGINE_SCHEMA_VERSION,
    }
    report_hash = _stable_hash(report_payload)
    return GateReport(
        candidate_id=str(candidate_payload.get("candidate_id", "")),
        candidate_hash=candidate_payload.get("candidate_hash"),
        parent_hash=candidate_payload.get("parent_hash"),
        claim_status=str(candidate_payload.get("claim_status", "")),
        gate_vector=tuple(gate_vector.get("gates", ())),
        hard_gate_passed=bool(gate_vector.get("hard_gate_passed", False)),
        soft_warning_count=int(gate_vector.get("soft_warning_count", 0)),
        soft_warnings=tuple(gate_vector.get("soft_warnings", ())),
        decision=str(decision["decision"]),
        rejection_reason=decision.get("rejection_reason"),
        selectable_preview=bool(decision.get("selectable_preview", False)),
        reference_only=bool(decision.get("reference_only", False)),
        user_visible=bool(decision.get("user_visible", False)),
        seal_blocked=True,
        memory_promotion_blocked=True,
        render_permission=str(decision.get("render_permission", OutputPermission.SEALED.value)),
        score_can_override_gate=False,
        gate_report_hash=report_hash,
    )


def evaluate_candidate_set_gate(candidate_set: Iterable[Mapping[str, Any]], context: Optional[Mapping[str, Any]] = None) -> Tuple[GateReport, ...]:
    return tuple(evaluate_candidate_gate(candidate, context=context) for candidate in candidate_set)


def _generated_candidates() -> Tuple[Dict[str, Any], ...]:
    preview = build_candidate_generator_preview()
    candidates = preview.get("candidates") or ()
    return tuple(dict(c) for c in candidates if isinstance(c, Mapping))


def build_gate_engine_preview(endpoint: str = GATE_ENGINE_PREVIEW_ROUTE) -> Dict[str, Any]:
    parent = build_144hz_test_manifest()
    parent_hash = canonical_hash(parent)
    candidates = _generated_candidates()
    reports = evaluate_candidate_set_gate(candidates, context={"parent_hash": parent_hash})
    report_dicts = [report.to_dict() for report in reports]
    gate_hash = _stable_hash({"reports": report_dicts, "schema_version": GATE_ENGINE_SCHEMA_VERSION})
    second_hash = _stable_hash({"reports": [report.to_dict() for report in evaluate_candidate_set_gate(_generated_candidates())], "schema_version": GATE_ENGINE_SCHEMA_VERSION})
    return {
        "status": "OK",
        "endpoint": endpoint,
        "mode": GATE_ENGINE_MODE,
        "current_patch": GATE_ENGINE_PATCH_ID,
        "schema_version": GATE_ENGINE_SCHEMA_VERSION,
        "formula": GATE_ENGINE_FORMULA,
        "preview_type": "generated_candidate_reusable_gate_engine_preview",
        "parent_problem_id": parent.problem_id,
        "parent_hash": parent_hash,
        "candidate_source": "rmc_engine_v1/mea/candidate_generator.py",
        "coherence_source": "rmc_engine_v1/mea/coherence_extension.py",
        "gate_engine_visible": True,
        "candidate_count": len(report_dicts),
        "gate_report_count": len(report_dicts),
        "selectable_preview_count": sum(1 for r in report_dicts if r.get("selectable_preview")),
        "reference_only_count": sum(1 for r in report_dicts if r.get("reference_only")),
        "rejected_count": sum(1 for r in report_dicts if r.get("decision") == "REJECTED"),
        "hard_gate_passed_count": sum(1 for r in report_dicts if r.get("hard_gate_passed")),
        "seal_blocked_count": sum(1 for r in report_dicts if r.get("seal_blocked")),
        "memory_blocked_count": sum(1 for r in report_dicts if r.get("memory_promotion_blocked")),
        "all_seal_blocked": all(r.get("seal_blocked") is True for r in report_dicts),
        "all_memory_blocked": all(r.get("memory_promotion_blocked") is True for r in report_dicts),
        "gate_report_hash": gate_hash,
        "gate_report_hash_stability_proven": gate_hash == second_hash,
        "score_can_override_gates": False,
        "score_can_promote_claim_status": False,
        "score_can_permit_render": False,
        "score_can_permit_seal": False,
        "score_can_promote_memory": False,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "hard_gate_report_adapter_status": "generated_candidate_gate_engine_authoritative_patch290; fixture-era hard_gate_report preserved for backward compatibility",
        "gate_reports": report_dicts,
        "boundary": gate_engine_boundary(),
    }


def build_gate_engine_gate_preview(endpoint: str = GATE_ENGINE_POST_ROUTE) -> Dict[str, Any]:
    payload = build_gate_engine_preview(endpoint=endpoint)
    payload.update({
        "accepted": True,
        "gate_status": "ACCEPTED_PREVIEW_ONLY",
        "seals_candidates": False,
        "promotes_to_memory": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
    })
    return payload


def build_gate_engine_rejection_preview(endpoint: str = GATE_ENGINE_POST_ROUTE) -> Dict[str, Any]:
    return {
        "status": "REJECTED",
        "endpoint": endpoint,
        "mode": GATE_ENGINE_MODE,
        "current_patch": GATE_ENGINE_PATCH_ID,
        "schema_version": GATE_ENGINE_SCHEMA_VERSION,
        "gate_status": "REJECTED",
        "accepted": False,
        "reason_code": "approval_token_required",
        "approval_required": True,
        "expected_approval_token": GATE_ENGINE_APPROVAL_TOKEN,
        "candidate_count": 0,
        "score_can_override_gates": False,
        "non_mutating": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "seal_blocked": True,
        "memory_promotion_blocked": True,
        "live_candidate_commit_active": False,
        "boundary": gate_engine_boundary(),
    }


def evaluate_gate_engine_request(request: Optional[Mapping[str, Any]] = None, endpoint: str = GATE_ENGINE_POST_ROUTE) -> Dict[str, Any]:
    req = request if isinstance(request, Mapping) else {}
    token = str(req.get("approval_token", "") or "")
    if token != GATE_ENGINE_APPROVAL_TOKEN:
        return build_gate_engine_rejection_preview(endpoint=endpoint)
    return build_gate_engine_gate_preview(endpoint=endpoint)


def gate_engine_status(endpoint: str = GATE_ENGINE_STATUS_ROUTE) -> Dict[str, Any]:
    preview = build_gate_engine_preview(endpoint=GATE_ENGINE_PREVIEW_ROUTE)
    return {
        "status": "OK",
        "endpoint": endpoint,
        "mode": GATE_ENGINE_MODE,
        "current_patch": GATE_ENGINE_PATCH_ID,
        "schema_version": GATE_ENGINE_SCHEMA_VERSION,
        "formula": GATE_ENGINE_FORMULA,
        "gate_engine_visible": True,
        "preview_route": GATE_ENGINE_PREVIEW_ROUTE,
        "post_route": GATE_ENGINE_POST_ROUTE,
        "approval_required": True,
        "approval_token": GATE_ENGINE_APPROVAL_TOKEN,
        "gate_names": list(GATE_NAMES),
        "candidate_source": "rmc_engine_v1/mea/candidate_generator.py",
        "coherence_source": "rmc_engine_v1/mea/coherence_extension.py",
        "candidate_count": preview.get("candidate_count"),
        "gate_report_hash_stability_proven": preview.get("gate_report_hash_stability_proven"),
        "score_can_override_gates": False,
        "live_candidate_commit_active": False,
        "candidate_sealing_active": False,
        "memory_promotion_active": False,
        "seal_route_available": False,
        "boundary": gate_engine_boundary(),
    }


def gate_engine_boundary() -> Dict[str, Any]:
    return {
        "patch": GATE_ENGINE_PATCH_ID,
        "schema_version": GATE_ENGINE_SCHEMA_VERSION,
        "layer": "MEA reusable gate engine / generated-candidate gate evaluation preview",
        "read_only": False,
        "non_mutating": True,
        "creates_get_routes": True,
        "creates_post_routes": True,
        "get_routes": [GATE_ENGINE_STATUS_ROUTE, GATE_ENGINE_PREVIEW_ROUTE],
        "post_routes": [GATE_ENGINE_POST_ROUTE],
        "requires_approval_token": True,
        "approval_token": GATE_ENGINE_APPROVAL_TOKEN,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "performs_network_io": False,
        "seeds_live_manifests": False,
        "commits_live_candidates": False,
        "advances_live_manifest": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
        "renders_user_output": False,
        "mutates_existing_rmc_behavior": False,
        "mutates_launcher_behavior": False,
        "mutates_operator_console_ui": False,
        "seal_route_available": False,
        "memory_promotion_route_available": False,
        "score_can_override_gates": False,
        "score_can_promote_claim_status": False,
        "score_can_permit_render": False,
        "score_can_permit_seal": False,
        "score_can_promote_memory": False,
    }
