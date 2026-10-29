"""
forge/rmc_engine_v1/mea/live_term_binding.py

MEA-DISCOVERY-KERNEL-LIVE-TERM-BINDING-BUILD-007
Forward-only deterministic binding of measured MEA score terms.

This module does not rewrite the historical Patch 275-299 corridor and does not
modify the Build 005 memory record.  It provides the production forward path by
which a new candidate evaluation must bind every term in the MEA master score to
an inspectable source before it can be considered for sealing.

Core laws
---------
* The historical 144 Hz record remains a bounded hypothesis and is not rescored.
* R is zero unless a candidate explicitly binds a hash-verified Forge MEA memory
  record or another typed ancestry record supplied to this gate.
* I is calculated from verified fact gain, validated unknown narrowing, and
  validated contradiction resolution; a new assumption is not information gain.
* K is calculated only from an executed operator trace bound to registered
  forward-cost identifiers.
* B is derived from typed evidence items; internal trace/theory ancestry cannot
  authorize an empirical verified claim.
* Replay validates reproducibility only; it is never evidence of empirical truth.

Boundary: read only. No files, databases, runtime state, memory, UI, routes,
renderer, LLM, Chroma, Identity Vault, Contribution Economy or ledger effects.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
import hashlib
import json
import re
from typing import Any, Dict, Iterable, Mapping, Optional, Sequence, Tuple

from .evidence_tier_contract import EvidenceAssessment, EvidenceItem, assess_evidence
from .fbsc_operator_crosswalk import phase_binding
from .fixed_point_math_contract import (
    ALL_TERMS,
    BUILD_ID as BUILD006_ID,
    ScoringMode,
    UNIT_SCALE,
    canonical_hash,
    score_terms_fixed_point,
)

BUILD_ID = "MEA-DISCOVERY-KERNEL-LIVE-TERM-BINDING-BUILD-007"
SCHEMA_VERSION = "mea_live_term_binding_v1_build007"
FORMULA = "Score(c_i)=αR+βP+γU+δN+ηI+κOmega+ρA-λD-μB-νK"
INFORMATION_GAIN_FORMULA = "I(c_i)=ΔF+ΔQ+ΔX; K=operator_cost_only"

THRESHOLDS_MICRO = {
    "D_max": 350_000,
    "P_min": 700_000,
    "B_hypothesis_max": 700_000,
    "B_derived_claim_max": 400_000,
    "B_verified_claim_max": 200_000,
    "I_discovery_min_exclusive": 0,
    "Omega_terminal_min_exclusive": 0,
}

# Costs are forward integer measurements; these do not alter historic Patch 278 floats.
OPERATOR_COST_MICRO = {
    "branch": 80_000,
    "hypothesize": 120_000,
    "derive": 140_000,
    "compare": 70_000,
    "check_evidence": 20_000,
    "check_proof_debt": 20_000,
    "check_phase": 10_000,
    "check_drift": 10_000,
    "check_constraint": 10_000,
    "check_replay": 20_000,
    "score_information_gain": 10_000,
    "score_convergence": 10_000,
    "score_goal_ancestry": 10_000,
    "score_operator_cost": 10_000,
}

_LEDGER_SCHEMA = "mea_manifest_memory_jsonl_ledger_entry_v1_build005"
_TOKEN_RE = re.compile(r"[a-z0-9]+", re.IGNORECASE)


def _canonical_json_bytes(value: Mapping[str, Any]) -> bytes:
    return json.dumps(dict(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _hash_mapping(value: Mapping[str, Any]) -> str:
    return hashlib.sha256(_canonical_json_bytes(value)).hexdigest()


def _micro_ratio(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        return 0
    return min(UNIT_SCALE, max(0, (numerator * UNIT_SCALE) // denominator))


def _tokens(value: Any) -> set[str]:
    return {match.group(0).lower() for match in _TOKEN_RE.finditer(str(value or ""))}


def _text_list(value: Any) -> Tuple[str, ...]:
    if not isinstance(value, (list, tuple)):
        return ()
    return tuple(str(item).strip() for item in value if str(item).strip())


def _manifest(value: Mapping[str, Any]) -> Dict[str, Any]:
    if not isinstance(value, Mapping):
        raise TypeError("manifest must be a mapping")
    data = dict(value)
    required = ("problem_id", "goal", "known_facts", "unknowns", "constraints", "phase_state", "phase_path", "claim_status")
    missing = [field for field in required if field not in data]
    if missing:
        raise ValueError(f"manifest missing required fields: {missing}")
    return data


@dataclass(frozen=True)
class LedgerAncestryNode:
    memory_record_hash: str
    entry_hash: str
    problem_id: str
    candidate_id: str
    claim_status: str
    memory_tier: str
    verified: bool
    source_path: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class TermObservation:
    term: str
    value_micro: int
    measurement_basis: str
    evidence: Tuple[str, ...]

    def __post_init__(self) -> None:
        if self.term not in ALL_TERMS:
            raise ValueError(f"unknown MEA term: {self.term!r}")
        if not isinstance(self.value_micro, int) or isinstance(self.value_micro, bool) or not 0 <= self.value_micro <= UNIT_SCALE:
            raise ValueError(f"{self.term} must be integer micro-unit data")

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class LiveTermBindingResult:
    evaluation_id: str
    problem_id: str
    candidate_id: str
    epistemic_claim_status: str
    required_next_action: str
    terms_micro: Dict[str, int]
    term_observations: Tuple[Dict[str, Any], ...]
    score_result: Dict[str, Any]
    evidence_assessment: Dict[str, Any]
    replay_confirmed: bool
    replay_is_truth_evidence: bool
    explicit_memory_ancestry_bound: bool
    explicit_operator_trace_bound: bool
    output_permissions: str
    evidence_rejections: Tuple[str, ...]
    result_hash: str
    schema_version: str = SCHEMA_VERSION
    build_id: str = BUILD_ID

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def verify_mea_manifest_memory_ledger(memory_root: Path) -> Dict[str, Any]:
    """Verify Build 005 hash-chained JSONL and return ancestry nodes."""
    ledger = Path(memory_root) / "hypothesis_test_required_records.jsonl"
    if not ledger.is_file():
        return {"valid": False, "errors": ["ledger_missing"], "nodes": [], "entry_count": 0}
    errors: list[str] = []
    nodes: list[Dict[str, Any]] = []
    previous_hash: Optional[str] = None
    for index, line in enumerate(ledger.read_text(encoding="utf-8").splitlines(), start=1):
        try:
            entry = json.loads(line)
        except Exception:
            errors.append(f"invalid_json_line:{index}")
            continue
        if not isinstance(entry, dict):
            errors.append(f"entry_not_object:{index}")
            continue
        body = {key: value for key, value in entry.items() if key != "entry_hash"}
        record = entry.get("memory_record") if isinstance(entry.get("memory_record"), dict) else {}
        record_body = {key: value for key, value in record.items() if key != "memory_record_hash"}
        entry_hash = str(entry.get("entry_hash", ""))
        record_hash = str(record.get("memory_record_hash", ""))
        if entry.get("schema_version") != _LEDGER_SCHEMA:
            errors.append(f"schema_mismatch:{index}")
        if entry.get("entry_index") != index:
            errors.append(f"entry_index_mismatch:{index}")
        if entry.get("previous_entry_hash") != previous_hash:
            errors.append(f"previous_hash_mismatch:{index}")
        if _hash_mapping(record_body) != record_hash:
            errors.append(f"record_hash_mismatch:{index}")
        if _hash_mapping(body) != entry_hash:
            errors.append(f"entry_hash_mismatch:{index}")
        if not errors:
            nodes.append(LedgerAncestryNode(
                memory_record_hash=record_hash,
                entry_hash=entry_hash,
                problem_id=str(record.get("problem_id", "")),
                candidate_id=str(record.get("candidate_id", "")),
                claim_status=str(record.get("claim_status", "")),
                memory_tier=str(record.get("memory_tier", "")),
                verified=True,
                source_path=str(ledger),
            ).to_dict())
        previous_hash = entry_hash
    return {"valid": not errors, "errors": errors, "nodes": nodes, "entry_count": len(nodes), "ledger_file": str(ledger)}


def _bound_memory_resonance(candidate_contract: Mapping[str, Any], ledger_status: Mapping[str, Any], problem_id: str) -> TermObservation:
    requested = candidate_contract.get("memory_ancestry_bindings", [])
    requested_hashes = {str(item.get("memory_record_hash")) for item in requested if isinstance(item, Mapping)}
    verified_nodes = [node for node in ledger_status.get("nodes", []) if node.get("memory_record_hash") in requested_hashes]
    same_problem = [node for node in verified_nodes if node.get("problem_id") == problem_id]
    if not ledger_status.get("valid") or not same_problem:
        return TermObservation("R", 0, "explicit_hash_verified_mea_memory_ancestry_required", ("No explicit validated same-problem ancestry binding.",))
    # A valid same-problem hypothesis record establishes trace ancestry, not empirical truth.
    value = min(UNIT_SCALE, 300_000 * len(same_problem))
    hashes = tuple(str(node["memory_record_hash"]) for node in same_problem)
    return TermObservation("R", value, "verified_same_problem_mea_manifest_memory_ancestry", hashes)


def _phase_validity(candidate: Mapping[str, Any]) -> TermObservation:
    phase_state = str(candidate.get("phase_state", ""))
    path = _text_list(candidate.get("phase_path"))
    try:
        bound = phase_binding(phase_state)
    except Exception as exc:
        return TermObservation("P", 0, "fbsc_phase_codex_binding_failed", (str(exc),))
    normalized_path = []
    try:
        for phase in path:
            normalized_path.append(phase_binding(phase)["normalized_phase_id"])
    except Exception as exc:
        return TermObservation("P", 0, "fbsc_phase_path_binding_failed", (str(exc),))
    if not normalized_path or normalized_path[-1] != bound["normalized_phase_id"]:
        return TermObservation("P", 0, "phase_path_terminal_state_mismatch", tuple(normalized_path))
    # Phi5 is a valid state but explicitly carries entropy/drift vigilance in the codex.
    value = 880_000 if bound["normalized_phase_id"] == "Φ5" else UNIT_SCALE
    return TermObservation("P", value, "phase_codex_valid_terminal_phase_with_entropy_vigilance", (bound["normalized_phase_id"], str(bound.get("gate_role"))))


def _information_gain(parent: Mapping[str, Any], candidate: Mapping[str, Any], candidate_contract: Mapping[str, Any]) -> Tuple[TermObservation, Dict[str, int]]:
    parent_facts = set(_text_list(parent.get("known_facts")))
    candidate_facts = set(_text_list(candidate.get("known_facts")))
    parent_unknowns = set(_text_list(parent.get("unknowns")))
    candidate_unknowns = set(_text_list(candidate.get("unknowns")))
    parent_contradictions = set(_text_list(parent.get("contradictions")))
    candidate_contradictions = set(_text_list(candidate.get("contradictions")))

    verified_fact_ids = {str(item) for item in candidate_contract.get("verified_fact_additions", [])}
    added_facts = candidate_facts - parent_facts
    delta_f = UNIT_SCALE if added_facts and all(item in verified_fact_ids for item in added_facts) else 0

    narrowing = candidate_contract.get("unknown_narrowing") if isinstance(candidate_contract.get("unknown_narrowing"), Mapping) else {}
    removed = str(narrowing.get("from_unknown", ""))
    narrowed = str(narrowing.get("to_unknown", ""))
    valid_narrowing = bool(removed and narrowed and removed in parent_unknowns and removed not in candidate_unknowns and narrowed in candidate_unknowns)
    delta_q = UNIT_SCALE if valid_narrowing else 0

    resolved = set(str(item) for item in candidate_contract.get("resolved_contradictions", []))
    actually_resolved = (parent_contradictions - candidate_contradictions) & resolved
    delta_x = UNIT_SCALE if actually_resolved else 0
    value = min(UNIT_SCALE, delta_f + delta_q + delta_x)
    evidence = (
        f"delta_f_verified_fact_gain_micro={delta_f}",
        f"delta_q_unknown_reduction_micro={delta_q}",
        f"delta_x_contradiction_resolution_micro={delta_x}",
    )
    return TermObservation("I", value, INFORMATION_GAIN_FORMULA, evidence), {"delta_f": delta_f, "delta_q": delta_q, "delta_x": delta_x}


def _goal_ancestry(parent: Mapping[str, Any], candidate: Mapping[str, Any]) -> TermObservation:
    if str(parent.get("goal", "")) != str(candidate.get("goal", "")):
        return TermObservation("A", 0, "root_goal_changed", ("Candidate goal diverged from parent goal.",))
    parent_chain = list(_text_list(parent.get("goal_ancestry")))
    candidate_chain = list(_text_list(candidate.get("goal_ancestry")))
    if parent_chain and candidate_chain[: len(parent_chain)] != parent_chain:
        return TermObservation("A", 0, "ancestry_prefix_not_preserved", ("Parent ancestry is not a prefix of candidate ancestry.",))
    value = UNIT_SCALE if candidate_chain else 700_000
    return TermObservation("A", value, "goal_and_ancestry_prefix_preserved", tuple(candidate_chain[-2:]))


def _operator_cost(candidate_contract: Mapping[str, Any]) -> TermObservation:
    trace = candidate_contract.get("executed_operator_path", [])
    if not isinstance(trace, (list, tuple)) or not trace:
        return TermObservation("K", 0, "executed_operator_trace_missing", ("No governed executed operator path bound.",))
    unknown = [str(operator) for operator in trace if str(operator) not in OPERATOR_COST_MICRO]
    if unknown:
        return TermObservation("K", UNIT_SCALE, "unknown_operator_cost_rejected", tuple(unknown))
    value = min(UNIT_SCALE, sum(OPERATOR_COST_MICRO[str(operator)] for operator in trace))
    return TermObservation("K", value, "integer_cost_schedule_for_executed_operator_path", tuple(str(item) for item in trace))


def _bounded_novelty(parent: Mapping[str, Any], candidate: Mapping[str, Any]) -> TermObservation:
    before = _tokens(json.dumps(parent, sort_keys=True, ensure_ascii=False))
    after = _tokens(json.dumps(candidate, sort_keys=True, ensure_ascii=False))
    changed = len(after.symmetric_difference(before))
    ratio = _micro_ratio(changed, max(1, len(before | after)))
    # A hypothesis may contain bounded novelty; do not let novelty dominate evidence debt.
    value = min(500_000, ratio)
    return TermObservation("N", value, "token_set_delta_capped_for_hypothesis", (f"changed_tokens={changed}", f"union_tokens={len(before | after)}"))


def _drift_risk(parent: Mapping[str, Any], candidate: Mapping[str, Any], evidence: EvidenceAssessment, replay_confirmed: bool) -> TermObservation:
    penalties = []
    total = 0
    if str(candidate.get("phase_state")) == "Phi5":
        total += 120_000
        penalties.append("phi5_entropy_vigilance=120000")
    removed_constraints = set(_text_list(parent.get("constraints"))) - set(_text_list(candidate.get("constraints")))
    if removed_constraints:
        total += 450_000
        penalties.append("parent_constraint_removed=450000")
    claim = str(candidate.get("claim_status", ""))
    all_text = " ".join(_text_list(candidate.get("assumptions"))) if isinstance(candidate.get("assumptions"), (list, tuple)) else str(candidate.get("assumptions", ""))
    if claim == "verified_claim" and not evidence.verified_empirical_claim_permitted:
        total += 700_000
        penalties.append("unsupported_verified_empirical_upgrade=700000")
    if claim == "hypothesis" and "hypothesis" not in all_text.lower() and "may" not in all_text.lower() and all_text:
        total += 250_000
        penalties.append("unqualified_hypothesis_wording=250000")
    if not replay_confirmed:
        total = UNIT_SCALE
        penalties.append("replay_not_confirmed=1000000")
    return TermObservation("D", min(UNIT_SCALE, total), "phase_constraint_claim_scope_replay_drift_measure", tuple(penalties))


def _convergence(parent: Mapping[str, Any], candidate: Mapping[str, Any], info_parts: Mapping[str, int]) -> TermObservation:
    # A validated unknown narrowing opens a test path but is not a completed success condition.
    if info_parts.get("delta_q") == UNIT_SCALE and str(candidate.get("claim_status")) == "hypothesis":
        return TermObservation("Omega", 400_000, "one_test_required_success_path_opened_not_resolved", ("bounded_unknown_narrowing_confirmed",))
    return TermObservation("Omega", 0, "no_validated_success_condition_progress", ())


def _utility(info: TermObservation, omega: TermObservation, candidate: Mapping[str, Any]) -> TermObservation:
    if str(candidate.get("claim_status")) == "hypothesis" and info.value_micro > 0:
        value = min(UNIT_SCALE, (info.value_micro + omega.value_micro) // 2)
        return TermObservation("U", value, "problem_progress_from_information_gain_and_convergence", (f"I={info.value_micro}", f"Omega={omega.value_micro}"))
    return TermObservation("U", 0, "no_validated_progress", ())



def _validate_evidence_bindings(
    raw_items: Sequence[Any],
    *,
    bound_memory_hashes: set[str],
    theory_registry_root: Optional[Path] = None,
) -> Tuple[Tuple[EvidenceItem, ...], Tuple[str, ...]]:
    """Admit only evidence whose asserted source is actually verifiable here.

    Build 007 has a verified MEA memory ledger. It does not yet have a governed
    on-disk FBSC/theory source registry or an external empirical evidence store.
    Therefore internal theory and external empirical items must be rejected until
    a later governed source-ingestion build supplies those registries.
    """
    from .evidence_tier_contract import EvidenceTier
    accepted: list[EvidenceItem] = []
    rejected: list[str] = []
    for raw in raw_items:
        if not isinstance(raw, Mapping):
            rejected.append("evidence_item_not_mapping")
            continue
        item = EvidenceItem(**dict(raw))
        if item.tier == EvidenceTier.INTERNAL_VERIFIED_TRACE.value:
            if item.source_reference not in bound_memory_hashes:
                rejected.append(f"unbound_internal_trace:{item.evidence_id}")
                continue
            # A trace confirms internal ancestry only; its support is capped.
            accepted.append(EvidenceItem(
                evidence_id=item.evidence_id,
                description=item.description,
                tier=item.tier,
                support_micro=min(item.support_micro, 150_000),
                supports_empirical_fact=False,
                independently_verified=True,
                source_reference=item.source_reference,
            ))
            continue
        if item.tier == EvidenceTier.INTERNAL_THEORY_ANCESTRY.value:
            # No governed local theory registry is present in this baseline.
            rejected.append(f"theory_source_registry_required:{item.evidence_id}")
            continue
        if item.tier in {
            EvidenceTier.EXTERNAL_EMPIRICAL_MEASUREMENT.value,
            EvidenceTier.EXTERNAL_PEER_REVIEWED_DERIVATION.value,
        }:
            rejected.append(f"external_evidence_registry_required:{item.evidence_id}")
            continue
        # Unsourced assertions and unvalidated derivations carry no support.
        accepted.append(EvidenceItem(
            evidence_id=item.evidence_id,
            description=item.description,
            tier=item.tier,
            support_micro=0,
            supports_empirical_fact=False,
            independently_verified=False,
            source_reference=item.source_reference,
        ))
    return tuple(accepted), tuple(rejected)


def evaluate_forward_candidate_terms(
    parent_manifest: Mapping[str, Any],
    candidate_manifest: Mapping[str, Any],
    candidate_contract: Mapping[str, Any],
    *,
    memory_root: Path,
    scoring_mode: str = ScoringMode.RESEARCH_SYNTHESIS.value,
) -> LiveTermBindingResult:
    """Bind all MEA terms to typed, inspectable forward candidate evidence.

    This function performs no seal and no write. It is the only Build 007 path
    eligible for future sealing review; the legacy Patch 289 fallback path is not.
    """
    parent = _manifest(parent_manifest)
    candidate = _manifest(candidate_manifest)
    if str(parent["problem_id"]) != str(candidate["problem_id"]):
        raise ValueError("candidate must preserve problem_id")
    candidate_id = str(candidate_contract.get("candidate_id", "")).strip()
    if not candidate_id:
        raise ValueError("candidate_contract.candidate_id is required")
    replay_confirmed = candidate_contract.get("replay_confirmed") is True
    evidence_items_raw = candidate_contract.get("evidence_items", [])
    ledger = verify_mea_manifest_memory_ledger(Path(memory_root))
    bound_hashes = {
        str(node.get("memory_record_hash"))
        for node in ledger.get("nodes", [])
        if isinstance(node, Mapping)
    }
    evidence_items, evidence_rejections = _validate_evidence_bindings(
        evidence_items_raw if isinstance(evidence_items_raw, (list, tuple)) else [],
        bound_memory_hashes=bound_hashes,
    )
    evidence = assess_evidence(evidence_items, requested_claim_kind=str(candidate_contract.get("requested_claim_kind", "structural_hypothesis")))

    R = _bound_memory_resonance(candidate_contract, ledger, str(candidate["problem_id"]))
    P = _phase_validity(candidate)
    I, info_parts = _information_gain(parent, candidate, candidate_contract)
    Omega = _convergence(parent, candidate, info_parts)
    A = _goal_ancestry(parent, candidate)
    K = _operator_cost(candidate_contract)
    N = _bounded_novelty(parent, candidate)
    D = _drift_risk(parent, candidate, evidence, replay_confirmed)
    B = TermObservation("B", evidence.proof_debt_micro, "typed_evidence_tier_proof_debt", (evidence.evidence_rule,))
    U = _utility(I, Omega, candidate)
    observations = (R, P, U, N, I, Omega, A, D, B, K)
    terms = {item.term: item.value_micro for item in observations}
    score = score_terms_fixed_point(terms, mode=scoring_mode).to_dict()
    required_next = str(candidate_contract.get("required_next_action", "test_required" if candidate.get("claim_status") == "hypothesis" else "review"))
    body = {
        "evaluation_id": str(candidate_contract.get("evaluation_id", f"live_term_binding_{candidate_id}")),
        "problem_id": str(candidate["problem_id"]),
        "candidate_id": candidate_id,
        "epistemic_claim_status": str(candidate["claim_status"]),
        "required_next_action": required_next,
        "terms_micro": terms,
        "term_observations": tuple(item.to_dict() for item in observations),
        "score_result": score,
        "evidence_assessment": evidence.to_dict(),
        "replay_confirmed": replay_confirmed,
        "replay_is_truth_evidence": False,
        "explicit_memory_ancestry_bound": R.value_micro > 0,
        "explicit_operator_trace_bound": K.value_micro > 0 and K.value_micro < UNIT_SCALE,
        "output_permissions": str(candidate.get("output_permissions", "sealed")),
        "evidence_rejections": evidence_rejections,
        "schema_version": SCHEMA_VERSION,
        "build_id": BUILD_ID,
    }
    return LiveTermBindingResult(result_hash=canonical_hash(body), **body)


def live_term_binding_boundary() -> Dict[str, Any]:
    return {
        "build_id": BUILD_ID,
        "schema_version": SCHEMA_VERSION,
        "extends_build006_contract": BUILD006_ID,
        "formula": FORMULA,
        "information_gain_formula": INFORMATION_GAIN_FORMULA,
        "historic_records_preserved": True,
        "historical_scoring_rewritten": False,
        "future_candidates_require_explicit_memory_ancestry_for_R": True,
        "future_candidates_require_executed_operator_path_for_K": True,
        "replay_proves_truth": False,
        "unregistered_theory_sources_can_contribute_B_support": False,
        "unregistered_external_evidence_can_authorize_verified_claim": False,
        "writes_files": False,
        "writes_mea_memory": False,
        "writes_mea_runtime_state": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "writes_ledgers": False,
        "writes_chroma": False,
        "calls_llm": False,
        "renders_user_output": False,
        "creates_http_routes": False,
        "modifies_ui": False,
    }


__all__ = [
    "BUILD_ID", "SCHEMA_VERSION", "FORMULA", "INFORMATION_GAIN_FORMULA", "THRESHOLDS_MICRO",
    "OPERATOR_COST_MICRO", "LedgerAncestryNode", "TermObservation", "LiveTermBindingResult",
    "verify_mea_manifest_memory_ledger", "evaluate_forward_candidate_terms", "live_term_binding_boundary",
]


def _forge_memory_root(forge_root: Path) -> Path:
    return Path(forge_root) / "memory" / "mea_manifest_memory_v1"


def build_historical_live_binding_audit(forge_root: Path) -> Dict[str, Any]:
    """Audit, but never rescore or rewrite, the historical Build 005 record.

    The historical manifest predates Build 007 and has no explicit memory_ancestry
    binding.  Its R term therefore remains unbound for historical migration.  The
    newly persisted memory record may be referenced only by a later candidate.
    """
    root = Path(forge_root)
    state_path = root / "runtime_state" / "mea_problem_manifest_store_v1" / "current_problem_manifest.json"
    if not state_path.is_file():
        raise FileNotFoundError(f"required live MEA state missing: {state_path}")
    state = json.loads(state_path.read_text(encoding="utf-8"))
    manifest = state.get("manifest") if isinstance(state.get("manifest"), dict) else {}
    ledger = verify_mea_manifest_memory_ledger(_forge_memory_root(root))
    ancestry = manifest.get("memory_ancestry", [])
    body = {
        "build_id": BUILD_ID,
        "schema_version": "mea_historical_live_binding_audit_v1_build007",
        "problem_id": state.get("problem_id"),
        "candidate_id": state.get("candidate_id"),
        "historical_claim_status": state.get("claim_status"),
        "historical_proof_debt_text": str(state.get("proof_debt")),
        "historical_memory_ancestry_count": len(ancestry) if isinstance(ancestry, list) else 0,
        "post_build005_memory_ledger_valid": bool(ledger.get("valid")),
        "post_build005_memory_nodes_available_for_future_candidates": ledger.get("entry_count", 0),
        "retroactive_R_binding_permitted": False,
        "retroactive_rescoring_permitted": False,
        "retroactive_resealing_permitted": False,
        "historical_migration_status": "PRESERVED_NOT_MIGRATED_NO_RETROACTIVE_ANCESTRY",
    }
    return {**body, "audit_hash": canonical_hash(body)}


def build_forward_144hz_hypothesis_fixture(forge_root: Path) -> Tuple[Dict[str, Any], Dict[str, Any], Dict[str, Any]]:
    """Build a non-persisted forward fixture using real Build 005 ancestry.

    This is not a new sealed record. It demonstrates the production term-binding
    contract over a candidate whose uncertainty is narrowed into a test-required
    path and whose internal trace ancestry is explicitly linked to the verified
    JSONL memory node.
    """
    from .manifest_schema import build_144hz_test_manifest, to_dict
    from .evidence_tier_contract import EvidenceTier

    parent = to_dict(build_144hz_test_manifest())
    broad_unknown = "Whether 144 Hz is a substrate frequency or derived harmonic."
    narrowed_unknown = "Whether a golden-ratio harmonic derivation for 144 Hz can be independently sourced and validated."
    candidate = json.loads(json.dumps(parent))
    candidate["unknowns"] = [item for item in candidate["unknowns"] if item != broad_unknown] + [narrowed_unknown]
    candidate["assumptions"] = [{
        "text": "Hypothesis: 144 Hz may be derivable as a harmonic relation to 90 Hz, but independent sourcing or measurement is still required.",
        "confidence": 0.35,
        "source": "operator:hypothesize:harmonic_from_90hz_forward_conformed",
    }]
    candidate["claim_status"] = "hypothesis"
    candidate["output_permissions"] = "sealed"
    candidate["phase_state"] = "Phi5"
    candidate["phase_path"] = ["Phi5"]
    candidate["goal_ancestry"] = list(parent.get("goal_ancestry", [])) + ["hypothesize:harmonic_from_90hz_forward_conformed"]
    ledger = verify_mea_manifest_memory_ledger(_forge_memory_root(Path(forge_root)))
    if not ledger.get("valid") or not ledger.get("nodes"):
        raise ValueError("Build 005 memory ancestry is required for forward 144 Hz fixture")
    record_hash = ledger["nodes"][0]["memory_record_hash"]
    contract = {
        "evaluation_id": "forward_144hz_hypothesis_term_binding_v1_build007",
        "candidate_id": "cg_hypothesis_forward_conformed_001",
        "requested_claim_kind": "empirical_substrate_frequency_claim",
        "required_next_action": "test_required",
        "replay_confirmed": True,
        "memory_ancestry_bindings": [{"memory_record_hash": record_hash, "binding_role": "prior_bounded_hypothesis_trace"}],
        "unknown_narrowing": {"from_unknown": broad_unknown, "to_unknown": narrowed_unknown},
        "verified_fact_additions": [],
        "resolved_contradictions": [],
        "executed_operator_path": [
            "branch", "hypothesize", "check_evidence", "check_proof_debt",
            "check_phase", "check_drift", "check_replay",
        ],
        "evidence_items": [
            {
                "evidence_id": "fbsc_90hz_internal_ancestry",
                "description": "Internal FBSC ancestry identifies a 90 Hz reference for bounded structural review.",
                "tier": EvidenceTier.INTERNAL_THEORY_ANCESTRY.value,
                "support_micro": 300_000,
                "supports_empirical_fact": False,
                "independently_verified": False,
                "source_reference": "internal FBSC ancestry",
            },
            {
                "evidence_id": "build005_trace_ancestry",
                "description": "Hash-verified Build 005 hypothesis memory record establishes trace continuity only.",
                "tier": EvidenceTier.INTERNAL_VERIFIED_TRACE.value,
                "support_micro": 150_000,
                "supports_empirical_fact": False,
                "independently_verified": False,
                "source_reference": record_hash,
            },
        ],
    }
    return parent, candidate, contract


# late exports declared after forward fixtures are defined
__all__.extend(["build_historical_live_binding_audit", "build_forward_144hz_hypothesis_fixture"])
