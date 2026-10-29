"""
forge/rmc_engine_v1/mea/manifest_schema.py

MEA / Forge Discovery Kernel — Problem Manifest Schema.
Patch 275: foundation only.

This module defines the MEA problem manifest M_t and candidate manifest c_i.
It deliberately does not merge with the RMC meaning manifest. RMC renders
meaning for one step; MEA tracks unresolved problem state over time.

Hard boundary for Patch 275:
- stdlib only
- no file writes
- no database writes
- no shell execution
- no LLM calls
- deterministic canonical hashing
"""

from __future__ import annotations

import copy
import hashlib
import json
from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Iterable, List, Optional

MEA_SCHEMA_VERSION = "mea_problem_manifest_v1_patch275"
MEA_PATCH_ID = "Patch 275 — MEA / Forge Discovery Kernel Foundation"


class ClaimStatus(str, Enum):
    """Structural epistemic status for MEA manifests and candidates."""

    RECALL = "recall"
    VERIFIED_CLAIM = "verified_claim"
    DERIVED_CLAIM = "derived_claim"
    HYPOTHESIS = "hypothesis"
    SPECULATIVE_BRANCH = "speculative_branch"
    CONTRADICTION_EXPOSED = "contradiction_exposed"
    TEST_REQUIRED = "test_required"
    REJECTED = "rejected"
    COLD_STORED = "cold_stored"
    NAMED_CONCEPT = "named_concept"
    PARTIAL_RESOLUTION = "partial_resolution"
    RESOLVED_MANIFEST = "resolved_manifest"
    UNCLASSIFIED = "unclassified"


class OutputPermission(str, Enum):
    """Renderer boundary. Patch 275 does not render any MEA output."""

    SEALED = "sealed"
    PROJECTION_ONLY = "projection_only"
    RENDER_ALLOWED = "render_allowed"


class PhaseState(str, Enum):
    """FBSC phase labels available to MEA manifests."""

    PHI1 = "Phi1"
    PHI2 = "Phi2"
    PHI3 = "Phi3"
    PHI4 = "Phi4"
    PHI5 = "Phi5"
    PHI6 = "Phi6"
    PHI7 = "Phi7"
    PHI8 = "Phi8"
    PHI9 = "Phi9"
    UNKNOWN = "unknown"


_OPERATOR_FAMILIES = {"generative", "verification", "composed", "system", "unknown"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _require_non_empty_string(name: str, value: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must be a non-empty string")


def _require_unit_float(name: str, value: float) -> None:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        raise ValueError(f"{name} must be numeric in [0.0, 1.0], got {value!r}")
    if not (0.0 <= float(value) <= 1.0):
        raise ValueError(f"{name} must be in [0.0, 1.0], got {value!r}")


def _normalise_string_list(name: str, values: Optional[Iterable[str]]) -> List[str]:
    if values is None:
        return []
    result: List[str] = []
    for idx, item in enumerate(values):
        if not isinstance(item, str):
            raise ValueError(f"{name}[{idx}] must be a string, got {type(item).__name__}")
        result.append(item.strip())
    return result


@dataclass
class Assumption:
    text: str
    confidence: float = 0.5
    source: Optional[str] = None

    def __post_init__(self) -> None:
        _require_non_empty_string("Assumption.text", self.text)
        _require_unit_float("Assumption.confidence", self.confidence)
        self.confidence = float(self.confidence)
        self.text = self.text.strip()
        if self.source is not None:
            self.source = str(self.source).strip() or None


@dataclass
class DriftState:
    phase_deviation: float = 0.0
    symbolic_entropy: float = 0.0
    semantic_drift: float = 0.0
    constraint_violations: float = 0.0

    def __post_init__(self) -> None:
        for name in ("phase_deviation", "symbolic_entropy", "semantic_drift", "constraint_violations"):
            _require_unit_float(f"DriftState.{name}", getattr(self, name))
            setattr(self, name, float(getattr(self, name)))

    @property
    def total(self) -> float:
        return min(
            1.0,
            (self.phase_deviation + self.symbolic_entropy + self.semantic_drift + self.constraint_violations) / 4.0,
        )


@dataclass
class OperatorTrace:
    operator_id: str
    parameters: Dict[str, Any]
    input_manifest_hash: str
    output_manifest_hash: str
    timestamp: str = field(default_factory=_utc_now)
    operator_family: str = "unknown"

    def __post_init__(self) -> None:
        _require_non_empty_string("OperatorTrace.operator_id", self.operator_id)
        _require_non_empty_string("OperatorTrace.input_manifest_hash", self.input_manifest_hash)
        _require_non_empty_string("OperatorTrace.output_manifest_hash", self.output_manifest_hash)
        if self.operator_family not in _OPERATOR_FAMILIES:
            raise ValueError(f"operator_family must be one of {sorted(_OPERATOR_FAMILIES)}, got {self.operator_family!r}")
        if self.parameters is None:
            self.parameters = {}
        if not isinstance(self.parameters, dict):
            raise ValueError("OperatorTrace.parameters must be a dict")


@dataclass
class MemoryRef:
    memory_key: str
    source: str
    relevance: float = 0.5
    evidence_tier: str = "unverified"

    def __post_init__(self) -> None:
        _require_non_empty_string("MemoryRef.memory_key", self.memory_key)
        _require_non_empty_string("MemoryRef.source", self.source)
        _require_unit_float("MemoryRef.relevance", self.relevance)
        self.relevance = float(self.relevance)
        self.evidence_tier = str(self.evidence_tier or "unverified").strip()


_REQUIRED_FIELDS: Dict[str, tuple[str, bool]] = {
    "problem_id": ("Problem ID", True),
    "goal": ("Goal", True),
    "known_facts": ("Known facts", True),
    "unknowns": ("Unknowns", True),
    "success_conditions": ("Success conditions", True),
    "phase_state": ("Phase state", True),
    "claim_status": ("Claim status", True),
    "output_permissions": ("Output permissions", True),
    "constraints": ("Constraints", False),
    "assumptions": ("Assumptions", False),
    "failure_conditions": ("Failure conditions", False),
}

_HIGH_PROOF_DEBT_THRESHOLD = 0.70


@dataclass
class ProblemManifest:
    """MEA Problem Manifest M_t."""

    problem_id: str = ""
    goal: str = ""
    known_facts: List[str] = field(default_factory=list)
    unknowns: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    assumptions: List[Assumption] = field(default_factory=list)
    contradictions: List[str] = field(default_factory=list)
    success_conditions: List[str] = field(default_factory=list)
    failure_conditions: List[str] = field(default_factory=list)
    phase_state: str = PhaseState.UNKNOWN.value
    phase_path: List[str] = field(default_factory=list)
    drift_state: DriftState = field(default_factory=DriftState)
    proof_debt: float = 1.0
    memory_ancestry: List[MemoryRef] = field(default_factory=list)
    operator_history: List[OperatorTrace] = field(default_factory=list)
    goal_ancestry: List[str] = field(default_factory=list)
    claim_status: str = ClaimStatus.UNCLASSIFIED.value
    output_permissions: str = OutputPermission.SEALED.value
    allowed_tools: List[str] = field(default_factory=list)
    schema_version: str = MEA_SCHEMA_VERSION
    created_at: str = field(default_factory=_utc_now)
    updated_at: str = field(default_factory=_utc_now)

    def __post_init__(self) -> None:
        self.problem_id = str(self.problem_id).strip()
        self.goal = str(self.goal).strip()
        self.known_facts = _normalise_string_list("known_facts", self.known_facts)
        self.unknowns = _normalise_string_list("unknowns", self.unknowns)
        self.constraints = _normalise_string_list("constraints", self.constraints)
        self.contradictions = _normalise_string_list("contradictions", self.contradictions)
        self.success_conditions = _normalise_string_list("success_conditions", self.success_conditions)
        self.failure_conditions = _normalise_string_list("failure_conditions", self.failure_conditions)
        self.phase_path = _normalise_string_list("phase_path", self.phase_path)
        self.goal_ancestry = _normalise_string_list("goal_ancestry", self.goal_ancestry)
        self.allowed_tools = _normalise_string_list("allowed_tools", self.allowed_tools)

        if self.phase_state not in {p.value for p in PhaseState}:
            raise ValueError(f"Invalid phase_state {self.phase_state!r}")
        for idx, phase in enumerate(self.phase_path):
            if phase not in {p.value for p in PhaseState}:
                raise ValueError(f"phase_path[{idx}] has invalid phase {phase!r}")
        if self.claim_status not in {s.value for s in ClaimStatus}:
            raise ValueError(f"Invalid claim_status {self.claim_status!r}")
        if self.output_permissions not in {p.value for p in OutputPermission}:
            raise ValueError(f"Invalid output_permissions {self.output_permissions!r}")
        _require_unit_float("ProblemManifest.proof_debt", self.proof_debt)
        self.proof_debt = float(self.proof_debt)

        if isinstance(self.drift_state, dict):
            self.drift_state = DriftState(**self.drift_state)
        if not isinstance(self.drift_state, DriftState):
            raise ValueError("drift_state must be DriftState")

        self.assumptions = [Assumption(**a) if isinstance(a, dict) else a for a in self.assumptions]
        if any(not isinstance(a, Assumption) for a in self.assumptions):
            raise ValueError("assumptions must contain Assumption objects")

        self.memory_ancestry = [MemoryRef(**m) if isinstance(m, dict) else m for m in self.memory_ancestry]
        if any(not isinstance(m, MemoryRef) for m in self.memory_ancestry):
            raise ValueError("memory_ancestry must contain MemoryRef objects")

        self.operator_history = [OperatorTrace(**o) if isinstance(o, dict) else o for o in self.operator_history]
        if any(not isinstance(o, OperatorTrace) for o in self.operator_history):
            raise ValueError("operator_history must contain OperatorTrace objects")


@dataclass
class CandidateManifest:
    """MEA candidate manifest c_i. Scoring is added in later patches."""

    candidate_id: str = ""
    problem_id: str = ""
    parent_hash: str = ""
    proposed_state: Optional[ProblemManifest] = None
    operator_trace: Optional[OperatorTrace] = None
    proof_debt: float = 1.0
    information_gain: float = 0.0
    convergence: float = 0.0
    goal_ancestry_score: float = 0.0
    operator_cost: float = 0.0
    drift_state: DriftState = field(default_factory=DriftState)
    claim_status: str = ClaimStatus.UNCLASSIFIED.value
    output_permissions: str = OutputPermission.SEALED.value
    gates_passed: bool = False
    gate_notes: List[str] = field(default_factory=list)
    schema_version: str = MEA_SCHEMA_VERSION

    def __post_init__(self) -> None:
        self.candidate_id = str(self.candidate_id).strip()
        self.problem_id = str(self.problem_id).strip()
        self.parent_hash = str(self.parent_hash).strip()
        _require_unit_float("CandidateManifest.proof_debt", self.proof_debt)
        _require_unit_float("CandidateManifest.convergence", self.convergence)
        _require_unit_float("CandidateManifest.goal_ancestry_score", self.goal_ancestry_score)
        _require_unit_float("CandidateManifest.operator_cost", self.operator_cost)
        self.proof_debt = float(self.proof_debt)
        self.convergence = float(self.convergence)
        self.goal_ancestry_score = float(self.goal_ancestry_score)
        self.operator_cost = float(self.operator_cost)
        self.information_gain = float(self.information_gain)
        self.gate_notes = _normalise_string_list("gate_notes", self.gate_notes)
        if self.claim_status not in {s.value for s in ClaimStatus}:
            raise ValueError(f"Invalid claim_status {self.claim_status!r}")
        if self.output_permissions not in {p.value for p in OutputPermission}:
            raise ValueError(f"Invalid output_permissions {self.output_permissions!r}")
        if isinstance(self.drift_state, dict):
            self.drift_state = DriftState(**self.drift_state)
        if self.proposed_state is not None and isinstance(self.proposed_state, dict):
            self.proposed_state = from_dict(self.proposed_state)
        if self.operator_trace is not None and isinstance(self.operator_trace, dict):
            self.operator_trace = OperatorTrace(**self.operator_trace)


@dataclass
class ValidationResult:
    valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def __bool__(self) -> bool:
        return self.valid


def canonical_dict(obj: Any) -> Any:
    """Return deterministic canonical structure used for hashing."""

    excluded = {"created_at", "updated_at"}
    if isinstance(obj, Enum):
        return obj.value
    if is_dataclass(obj):
        raw = asdict(obj)
        return {k: canonical_dict(v) for k, v in sorted(raw.items()) if k not in excluded}
    if isinstance(obj, dict):
        return {str(k): canonical_dict(v) for k, v in sorted(obj.items(), key=lambda item: str(item[0])) if str(k) not in excluded}
    if isinstance(obj, list):
        return [canonical_dict(v) for v in obj]
    return obj


def canonical_hash(manifest: ProblemManifest) -> str:
    payload = json.dumps(canonical_dict(manifest), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def to_dict(manifest: ProblemManifest) -> Dict[str, Any]:
    return asdict(manifest)


def from_dict(data: Dict[str, Any]) -> ProblemManifest:
    d = copy.deepcopy(data)
    if isinstance(d.get("drift_state"), dict):
        d["drift_state"] = DriftState(**d["drift_state"])
    d["assumptions"] = [Assumption(**a) if isinstance(a, dict) else a for a in d.get("assumptions", [])]
    d["memory_ancestry"] = [MemoryRef(**m) if isinstance(m, dict) else m for m in d.get("memory_ancestry", [])]
    d["operator_history"] = [OperatorTrace(**o) if isinstance(o, dict) else o for o in d.get("operator_history", [])]
    return ProblemManifest(**d)


def validate_manifest(manifest: ProblemManifest) -> ValidationResult:
    errors: List[str] = []
    warnings: List[str] = []

    for field_name, (label, critical) in _REQUIRED_FIELDS.items():
        value = getattr(manifest, field_name, None)
        empty = value is None or value == "" or (isinstance(value, list) and len(value) == 0)
        if empty and critical:
            errors.append(f"MISSING required field: {field_name} ({label})")
        elif empty:
            warnings.append(f"EMPTY optional field: {field_name} ({label})")

    if manifest.proof_debt >= _HIGH_PROOF_DEBT_THRESHOLD:
        warnings.append(
            f"proof_debt is high ({manifest.proof_debt:.2f}); claim status should remain hypothesis/test_required or lower until evidence improves."
        )
    if manifest.contradictions:
        warnings.append(f"{len(manifest.contradictions)} unresolved contradiction(s) present")
    if manifest.claim_status == ClaimStatus.VERIFIED_CLAIM.value and manifest.proof_debt >= 0.20:
        errors.append("verified_claim requires proof_debt < 0.20")
    if manifest.claim_status == ClaimStatus.RESOLVED_MANIFEST.value and not manifest.success_conditions:
        errors.append("resolved_manifest requires explicit success_conditions")

    return ValidationResult(valid=not errors, errors=errors, warnings=warnings)


def build_manifest(
    problem_id: str,
    goal: str,
    known_facts: List[str],
    unknowns: List[str],
    *,
    constraints: Optional[List[str]] = None,
    assumptions: Optional[List[Assumption]] = None,
    contradictions: Optional[List[str]] = None,
    success_conditions: Optional[List[str]] = None,
    failure_conditions: Optional[List[str]] = None,
    phase_state: str = PhaseState.UNKNOWN.value,
    phase_path: Optional[List[str]] = None,
    proof_debt: float = 1.0,
    claim_status: str = ClaimStatus.UNCLASSIFIED.value,
    output_permissions: str = OutputPermission.SEALED.value,
    allowed_tools: Optional[List[str]] = None,
    memory_ancestry: Optional[List[MemoryRef]] = None,
    operator_history: Optional[List[OperatorTrace]] = None,
    goal_ancestry: Optional[List[str]] = None,
    drift_state: Optional[DriftState] = None,
) -> ProblemManifest:
    manifest = ProblemManifest(
        problem_id=problem_id,
        goal=goal,
        known_facts=list(known_facts),
        unknowns=list(unknowns),
        constraints=list(constraints or []),
        assumptions=list(assumptions or []),
        contradictions=list(contradictions or []),
        success_conditions=list(success_conditions or []),
        failure_conditions=list(failure_conditions or []),
        phase_state=phase_state,
        phase_path=list(phase_path or []),
        proof_debt=proof_debt,
        claim_status=claim_status,
        output_permissions=output_permissions,
        allowed_tools=list(allowed_tools or []),
        memory_ancestry=list(memory_ancestry or []),
        operator_history=list(operator_history or []),
        goal_ancestry=list(goal_ancestry or []),
        drift_state=drift_state or DriftState(),
    )
    result = validate_manifest(manifest)
    if not result.valid:
        raise ValueError("ProblemManifest validation failed:\n" + "\n".join(f"  - {e}" for e in result.errors))
    return manifest


def build_144hz_test_manifest() -> ProblemManifest:
    """Return the canonical Patch 275 anti-confabulation test fixture."""

    return build_manifest(
        problem_id="144hz_substrate_status",
        goal="Determine provable epistemic status of the 144 Hz claim.",
        known_facts=[
            "144 Hz is the core substrate frequency in FBSC.",
            "No published direct myelin-specific measurement of 144 Hz exists.",
            "90 Hz binding frequency is identified in FBSC.",
            "Golden ratio relationship 144/90 approximately 1.6 is noted in FBSC Volume II.",
        ],
        unknowns=[
            "Direct empirical measurement of 144 Hz in myelin.",
            "Whether 144 Hz is a substrate frequency or derived harmonic.",
        ],
        constraints=[
            "Must cite published data.",
            "Cannot assert as empirical fact without measurement.",
        ],
        success_conditions=[
            "Published myelin measurement found.",
            "144 Hz formally derived as harmonic from published substrate with derivation chain.",
        ],
        failure_conditions=[
            "No measurement exists and no derivation chain holds after full search.",
        ],
        phase_state=PhaseState.PHI5.value,
        proof_debt=0.85,
        claim_status=ClaimStatus.TEST_REQUIRED.value,
        output_permissions=OutputPermission.SEALED.value,
        allowed_tools=["check_evidence", "check_proof_debt", "branch", "hypothesize"],
        goal_ancestry=["Determine provable epistemic status of the 144 Hz claim."],
    )


def foundation_boundary() -> Dict[str, Any]:
    return {
        "patch": MEA_PATCH_ID,
        "schema_version": MEA_SCHEMA_VERSION,
        "layer": "MEA foundation / Forge Discovery Kernel",
        "read_only": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "creates_post_routes": False,
        "modifies_existing_rmc_behavior": False,
        "renderer_integration": False,
        "seal_or_write_routes": False,
    }
