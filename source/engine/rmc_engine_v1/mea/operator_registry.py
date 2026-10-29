"""
forge/rmc_engine_v1/mea/operator_registry.py

Patch 278 — MEA Replay Engine.

Formalizes the first read-only FBSC Manifest Algebra operator registry for the
Forge Discovery Kernel. The registry defines deterministic operator metadata,
parameter schemas for theta_k, cost assignments, and pure callable functions used
by the replay engine.

Patch 278 boundary:
- stdlib only
- deterministic and side-effect free
- no file writes
- no database writes
- no shell execution
- no LLM calls
- no network calls
- no live manifest seeding
- no candidate sealing
- no memory promotion
"""

from __future__ import annotations

import copy
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Callable, Dict, Iterable, Mapping, Optional, Sequence, Tuple

from .manifest_schema import (
    Assumption,
    ClaimStatus,
    OutputPermission,
    ProblemManifest,
    canonical_hash,
    from_dict,
    to_dict,
)
from .operator_cost_scorer import DEFAULT_OPERATOR_COST_SCHEDULE

OPERATOR_REGISTRY_PATCH_ID = "Patch 278 — MEA Replay Engine"
OPERATOR_REGISTRY_SCHEMA_VERSION = "mea_operator_registry_v1_patch278"
REPLAY_LAW_FORMULA = "Replay(H(M_t), O_k, theta_k) = H(c_i)"

_OPERATOR_FAMILIES = ("generative", "verification", "composed", "system")
_PARAMETER_TYPES = ("str", "float", "int", "bool", "list", "dict")


def _round(value: float) -> float:
    return round(float(value), 6)


def _clamp_unit(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _clean_string(value: Any) -> str:
    return str(value or "").strip()


def _dedupe_append(values: Sequence[str], item: str) -> Tuple[str, ...]:
    cleaned = [_clean_string(v) for v in values if _clean_string(v)]
    new_item = _clean_string(item)
    if new_item and new_item not in cleaned:
        cleaned.append(new_item)
    return tuple(cleaned)


def _without_exact(values: Sequence[str], item: str) -> Tuple[str, ...]:
    target = _clean_string(item).lower()
    return tuple(_clean_string(v) for v in values if _clean_string(v) and _clean_string(v).lower() != target)


def _clone_manifest(manifest: ProblemManifest) -> ProblemManifest:
    if not isinstance(manifest, ProblemManifest):
        raise TypeError("operator input must be a ProblemManifest")
    return from_dict(to_dict(manifest))


def _replace_manifest(manifest: ProblemManifest, **updates: Any) -> ProblemManifest:
    data = copy.deepcopy(to_dict(manifest))
    data.update(updates)
    return from_dict(data)


def _canonical_param_payload(parameters: Mapping[str, Any]) -> str:
    return json.dumps(parameters, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def canonical_parameter_hash(parameters: Optional[Mapping[str, Any]]) -> str:
    """Return a deterministic sha-like digest for theta_k without importing hashlib here.

    This uses the same JSON canonicalization shape as replay_engine, while keeping
    the registry free of runtime file/network behavior. replay_engine performs the
    actual cryptographic digest for reports.
    """

    import hashlib

    payload = _canonical_param_payload(dict(parameters or {}))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class ParameterSpec:
    name: str
    value_type: str
    required: bool = False
    default: Any = None
    minimum: Optional[float] = None
    maximum: Optional[float] = None
    allowed_values: Tuple[Any, ...] = field(default_factory=tuple)
    description: str = ""

    def __post_init__(self) -> None:
        if not _clean_string(self.name):
            raise ValueError("ParameterSpec.name must be non-empty")
        if self.value_type not in _PARAMETER_TYPES:
            raise ValueError(f"ParameterSpec.value_type must be one of {_PARAMETER_TYPES}")

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class OperatorDefinition:
    operator_id: str
    family: str
    cost: float
    parameter_schema: Tuple[ParameterSpec, ...]
    callable_name: str
    replayable: bool = True
    description: str = ""

    def __post_init__(self) -> None:
        if not _clean_string(self.operator_id):
            raise ValueError("OperatorDefinition.operator_id must be non-empty")
        if self.family not in _OPERATOR_FAMILIES:
            raise ValueError(f"OperatorDefinition.family must be one of {_OPERATOR_FAMILIES}")
        object.__setattr__(self, "cost", _clamp_unit(self.cost))

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["parameter_schema"] = [p.to_dict() for p in self.parameter_schema]
        return data


@dataclass(frozen=True)
class ParameterValidationResult:
    valid: bool
    normalized_parameters: Dict[str, Any]
    errors: Tuple[str, ...] = field(default_factory=tuple)
    warnings: Tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


OperatorCallable = Callable[[ProblemManifest, Mapping[str, Any]], ProblemManifest]


def _coerce_value(spec: ParameterSpec, value: Any) -> Any:
    if spec.value_type == "str":
        coerced = _clean_string(value)
        if spec.required and not coerced:
            raise ValueError(f"{spec.name} must be a non-empty string")
        return coerced
    if spec.value_type == "float":
        if isinstance(value, bool):
            raise ValueError(f"{spec.name} must be float-compatible")
        coerced = float(value)
        if spec.minimum is not None and coerced < spec.minimum:
            raise ValueError(f"{spec.name} must be >= {spec.minimum}")
        if spec.maximum is not None and coerced > spec.maximum:
            raise ValueError(f"{spec.name} must be <= {spec.maximum}")
        return coerced
    if spec.value_type == "int":
        if isinstance(value, bool):
            raise ValueError(f"{spec.name} must be int-compatible")
        coerced = int(value)
        if spec.minimum is not None and coerced < spec.minimum:
            raise ValueError(f"{spec.name} must be >= {spec.minimum}")
        if spec.maximum is not None and coerced > spec.maximum:
            raise ValueError(f"{spec.name} must be <= {spec.maximum}")
        return coerced
    if spec.value_type == "bool":
        if not isinstance(value, bool):
            raise ValueError(f"{spec.name} must be boolean")
        return value
    if spec.value_type == "list":
        if not isinstance(value, list):
            raise ValueError(f"{spec.name} must be a list")
        return list(value)
    if spec.value_type == "dict":
        if not isinstance(value, dict):
            raise ValueError(f"{spec.name} must be a dict")
        return dict(value)
    raise ValueError(f"unsupported parameter type {spec.value_type}")


def _validate_parameters(definition: OperatorDefinition, parameters: Optional[Mapping[str, Any]]) -> ParameterValidationResult:
    raw = dict(parameters or {})
    schema = {spec.name: spec for spec in definition.parameter_schema}
    errors = []
    warnings = []
    normalized: Dict[str, Any] = {}

    for spec in definition.parameter_schema:
        if spec.name in raw:
            try:
                value = _coerce_value(spec, raw[spec.name])
                if spec.allowed_values and value not in spec.allowed_values:
                    errors.append(f"{spec.name} must be one of {list(spec.allowed_values)!r}")
                else:
                    normalized[spec.name] = value
            except Exception as exc:
                errors.append(str(exc))
        elif spec.required:
            errors.append(f"missing required parameter: {spec.name}")
        elif spec.default is not None:
            normalized[spec.name] = spec.default

    for key in sorted(raw):
        if key not in schema:
            errors.append(f"unexpected parameter: {key}")

    if not definition.replayable:
        errors.append(f"operator is registered but not replayable in Patch 278: {definition.operator_id}")

    return ParameterValidationResult(valid=not errors, normalized_parameters=normalized, errors=tuple(errors), warnings=tuple(warnings))


# ─── Deterministic read-only operator functions ────────────────────────────

def _op_noop(manifest: ProblemManifest, parameters: Mapping[str, Any]) -> ProblemManifest:
    return _clone_manifest(manifest)


def _op_branch(manifest: ProblemManifest, parameters: Mapping[str, Any]) -> ProblemManifest:
    branch_label = parameters["branch_label"]
    branch_goal = _clean_string(parameters.get("branch_goal")) or manifest.goal
    branch_unknown = _clean_string(parameters.get("branch_unknown"))
    goal_ancestry = _dedupe_append(manifest.goal_ancestry, f"branch:{branch_label}")
    unknowns = _dedupe_append(manifest.unknowns, branch_unknown) if branch_unknown else tuple(manifest.unknowns)
    return _replace_manifest(
        manifest,
        goal=branch_goal,
        unknowns=list(unknowns),
        goal_ancestry=list(goal_ancestry),
        claim_status=ClaimStatus.SPECULATIVE_BRANCH.value,
        output_permissions=OutputPermission.SEALED.value,
    )


def _op_hypothesize(manifest: ProblemManifest, parameters: Mapping[str, Any]) -> ProblemManifest:
    hypothesis_id = parameters["hypothesis_id"]
    hypothesis_text = _clean_string(parameters.get("hypothesis_text")) or hypothesis_id
    confidence = _clamp_unit(float(parameters.get("confidence", 0.35)))
    assumptions = list(to_dict(manifest).get("assumptions", []))
    assumptions.append(Assumption(text=hypothesis_text, confidence=confidence, source=f"operator:hypothesize:{hypothesis_id}"))
    goal_ancestry = _dedupe_append(manifest.goal_ancestry, f"hypothesize:{hypothesis_id}")
    return _replace_manifest(
        manifest,
        assumptions=assumptions,
        goal_ancestry=list(goal_ancestry),
        claim_status=ClaimStatus.HYPOTHESIS.value,
        output_permissions=OutputPermission.SEALED.value,
    )


def _op_derive(manifest: ProblemManifest, parameters: Mapping[str, Any]) -> ProblemManifest:
    derived_fact = parameters["derived_fact"]
    resolves_unknown = _clean_string(parameters.get("resolves_unknown"))
    proof_debt_delta = _clamp_unit(float(parameters.get("proof_debt_delta", 0.10)))
    known_facts = _dedupe_append(manifest.known_facts, derived_fact)
    unknowns = _without_exact(manifest.unknowns, resolves_unknown) if resolves_unknown else tuple(manifest.unknowns)
    goal_ancestry = _dedupe_append(manifest.goal_ancestry, "derive:structured_fact")
    return _replace_manifest(
        manifest,
        known_facts=list(known_facts),
        unknowns=list(unknowns),
        goal_ancestry=list(goal_ancestry),
        proof_debt=_round(max(0.0, manifest.proof_debt - proof_debt_delta)),
        claim_status=ClaimStatus.DERIVED_CLAIM.value,
        output_permissions=OutputPermission.SEALED.value,
    )


def _op_compare(manifest: ProblemManifest, parameters: Mapping[str, Any]) -> ProblemManifest:
    comparison_note = parameters["comparison_note"]
    contradiction = _clean_string(parameters.get("contradiction"))
    known_facts = _dedupe_append(manifest.known_facts, f"Comparison: {comparison_note}")
    contradictions = _dedupe_append(manifest.contradictions, contradiction) if contradiction else tuple(manifest.contradictions)
    goal_ancestry = _dedupe_append(manifest.goal_ancestry, "compare:evidence_paths")
    status = ClaimStatus.CONTRADICTION_EXPOSED.value if contradiction else manifest.claim_status
    return _replace_manifest(
        manifest,
        known_facts=list(known_facts),
        contradictions=list(contradictions),
        goal_ancestry=list(goal_ancestry),
        claim_status=status,
        output_permissions=OutputPermission.SEALED.value,
    )


_CALLABLES: Dict[str, OperatorCallable] = {
    "noop_recall": _op_noop,
    "check_phase": _op_noop,
    "check_constraint": _op_noop,
    "check_evidence": _op_noop,
    "check_proof_debt": _op_noop,
    "detect_unknowns": _op_noop,
    "score_information_gain": _op_noop,
    "score_convergence": _op_noop,
    "score_goal_ancestry": _op_noop,
    "score_operator_cost": _op_noop,
    "replay": _op_noop,
    "branch": _op_branch,
    "hypothesize": _op_hypothesize,
    "derive": _op_derive,
    "compare": _op_compare,
}


def _schema(*specs: ParameterSpec) -> Tuple[ParameterSpec, ...]:
    return tuple(specs)


def _definition(operator_id: str, family: str, callable_name: str, parameter_schema: Tuple[ParameterSpec, ...], *, replayable: bool = True, description: str = "") -> OperatorDefinition:
    return OperatorDefinition(
        operator_id=operator_id,
        family=family,
        cost=float(DEFAULT_OPERATOR_COST_SCHEDULE.get(operator_id, DEFAULT_OPERATOR_COST_SCHEDULE.get("unknown", 0.50))),
        parameter_schema=parameter_schema,
        callable_name=callable_name,
        replayable=replayable,
        description=description,
    )


_DEFAULT_DEFINITIONS: Tuple[OperatorDefinition, ...] = (
    _definition("noop_recall", "verification", "noop_recall", _schema(), description="Return the starting manifest unchanged for recall/non-discovery replay checks."),
    _definition("check_phase", "verification", "check_phase", _schema(), description="Verify phase coherence without mutating the manifest in Patch 278."),
    _definition("check_constraint", "verification", "check_constraint", _schema(), description="Verify constraints without mutating the manifest in Patch 278."),
    _definition("check_evidence", "verification", "check_evidence", _schema(), description="Verify evidence references without external lookup in Patch 278."),
    _definition("check_proof_debt", "verification", "check_proof_debt", _schema(), description="Verify proof-debt constraints without changing the manifest."),
    _definition("detect_unknowns", "verification", "detect_unknowns", _schema(), description="Replay-compatible unknown-vector check; output state is unchanged."),
    _definition("score_information_gain", "verification", "score_information_gain", _schema(), description="Replay-compatible information-gain check; output state is unchanged."),
    _definition("score_convergence", "verification", "score_convergence", _schema(), description="Replay-compatible convergence check; output state is unchanged."),
    _definition("score_goal_ancestry", "verification", "score_goal_ancestry", _schema(), description="Replay-compatible goal ancestry check; output state is unchanged."),
    _definition("score_operator_cost", "verification", "score_operator_cost", _schema(), description="Replay-compatible operator cost check; output state is unchanged."),
    _definition("replay", "verification", "replay", _schema(), description="Meta replay operator; output state is unchanged."),
    _definition(
        "branch",
        "generative",
        "branch",
        _schema(
            ParameterSpec("branch_label", "str", required=True, description="Deterministic branch label."),
            ParameterSpec("branch_goal", "str", default="", description="Optional narrowed branch goal."),
            ParameterSpec("branch_unknown", "str", default="", description="Optional branch-specific unknown."),
        ),
        description="Create a deterministic branch manifest without writing it to live memory.",
    ),
    _definition(
        "hypothesize",
        "generative",
        "hypothesize",
        _schema(
            ParameterSpec("hypothesis_id", "str", required=True, description="Stable hypothesis identifier."),
            ParameterSpec("hypothesis_text", "str", default="", description="Human-readable hypothesis text."),
            ParameterSpec("confidence", "float", default=0.35, minimum=0.0, maximum=1.0, description="Hypothesis confidence, not proof."),
        ),
        description="Add a hypothesis assumption while keeping proof debt explicit.",
    ),
    _definition(
        "derive",
        "generative",
        "derive",
        _schema(
            ParameterSpec("derived_fact", "str", required=True, description="Derived fact text."),
            ParameterSpec("resolves_unknown", "str", default="", description="Exact unknown to remove if this derivation resolves it."),
            ParameterSpec("proof_debt_delta", "float", default=0.10, minimum=0.0, maximum=1.0, description="Conservative proof debt reduction."),
        ),
        description="Add a derived fact and optionally resolve an exact unknown.",
    ),
    _definition(
        "compare",
        "generative",
        "compare",
        _schema(
            ParameterSpec("comparison_note", "str", required=True, description="Comparison result."),
            ParameterSpec("contradiction", "str", default="", description="Optional contradiction exposed by the comparison."),
        ),
        description="Add a deterministic comparison note and optional contradiction.",
    ),
    _definition("external_search", "system", "noop_recall", _schema(), replayable=False, description="Registered for cost accounting only; no network search in Patch 278."),
    _definition("run_simulation", "system", "noop_recall", _schema(), replayable=False, description="Registered for cost accounting only; no simulation execution in Patch 278."),
    _definition("llm_generate", "system", "noop_recall", _schema(), replayable=False, description="Registered for cost accounting only; no LLM calls in Patch 278."),
)


class OperatorRegistry:
    """Deterministic, read-only operator registry for MEA replay."""

    def __init__(self, definitions: Iterable[OperatorDefinition] = _DEFAULT_DEFINITIONS) -> None:
        self._definitions = {definition.operator_id: definition for definition in definitions}

    def has_operator(self, operator_id: str) -> bool:
        return _clean_string(operator_id) in self._definitions

    def get(self, operator_id: str) -> OperatorDefinition:
        key = _clean_string(operator_id)
        if key not in self._definitions:
            raise KeyError(f"unknown operator_id: {operator_id}")
        return self._definitions[key]

    def list_definitions(self) -> Tuple[OperatorDefinition, ...]:
        return tuple(self._definitions[key] for key in sorted(self._definitions))

    def cost_schedule(self) -> Dict[str, float]:
        return {definition.operator_id: definition.cost for definition in self.list_definitions()}

    def validate_parameters(self, operator_id: str, parameters: Optional[Mapping[str, Any]]) -> ParameterValidationResult:
        return _validate_parameters(self.get(operator_id), parameters)

    def apply(self, manifest: ProblemManifest, operator_id: str, parameters: Optional[Mapping[str, Any]]) -> ProblemManifest:
        definition = self.get(operator_id)
        validation = _validate_parameters(definition, parameters)
        if not validation.valid:
            raise ValueError("; ".join(validation.errors))
        callable_fn = _CALLABLES.get(definition.callable_name)
        if callable_fn is None:
            raise ValueError(f"operator callable is missing: {definition.callable_name}")
        return callable_fn(manifest, validation.normalized_parameters)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "patch_id": OPERATOR_REGISTRY_PATCH_ID,
            "schema_version": OPERATOR_REGISTRY_SCHEMA_VERSION,
            "replay_law_formula": REPLAY_LAW_FORMULA,
            "operator_count": len(self._definitions),
            "operators": [definition.to_dict() for definition in self.list_definitions()],
            "boundary": operator_registry_boundary(),
        }


def build_default_operator_registry() -> OperatorRegistry:
    return OperatorRegistry()


def get_operator_definition(operator_id: str) -> OperatorDefinition:
    return build_default_operator_registry().get(operator_id)


def list_operator_definitions() -> Tuple[OperatorDefinition, ...]:
    return build_default_operator_registry().list_definitions()


def validate_operator_parameters(operator_id: str, parameters: Optional[Mapping[str, Any]]) -> ParameterValidationResult:
    return build_default_operator_registry().validate_parameters(operator_id, parameters)


def apply_registered_operator(manifest: ProblemManifest, operator_id: str, parameters: Optional[Mapping[str, Any]]) -> ProblemManifest:
    return build_default_operator_registry().apply(manifest, operator_id, parameters)


def operator_registry_summary() -> Dict[str, Any]:
    registry = build_default_operator_registry()
    definitions = registry.list_definitions()
    return {
        "patch_id": OPERATOR_REGISTRY_PATCH_ID,
        "schema_version": OPERATOR_REGISTRY_SCHEMA_VERSION,
        "replay_law_formula": REPLAY_LAW_FORMULA,
        "operator_count": len(definitions),
        "replayable_operator_count": sum(1 for item in definitions if item.replayable),
        "non_replayable_operator_count": sum(1 for item in definitions if not item.replayable),
        "operator_ids": [item.operator_id for item in definitions],
        "cost_schedule": registry.cost_schedule(),
        "boundary": operator_registry_boundary(),
    }


def operator_registry_boundary() -> Dict[str, Any]:
    return {
        "patch": OPERATOR_REGISTRY_PATCH_ID,
        "layer": "MEA replay foundation / operator registry",
        "read_only": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_chroma": False,
        "writes_identity_vault": False,
        "calls_llm": False,
        "executes_shell": False,
        "creates_post_routes": False,
        "seeds_live_manifests": False,
        "seals_candidates": False,
        "promotes_to_memory": False,
    }
