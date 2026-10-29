"""
forge/rmc_engine_v1/mea/replay_engine.py

Patch 278 — MEA Replay Engine.

Implements the read-only replay gate required by Manifest Evolution Algebra:

    Replay(H(M_t), O_k, theta_k) = H(c_i)

A candidate can only be replay-confirmed when the starting manifest, operator
identifier, operator parameters, and expected candidate hash reproduce the same
candidate hash. Patch 278 does not seal candidates, seed live manifests, write
memory, call external tools, or render output.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

from .manifest_schema import ProblemManifest, canonical_hash, to_dict
from .operator_registry import (
    OPERATOR_REGISTRY_PATCH_ID,
    REPLAY_LAW_FORMULA,
    OperatorRegistry,
    build_default_operator_registry,
    operator_registry_boundary,
)

REPLAY_ENGINE_PATCH_ID = "Patch 278 — MEA Replay Engine"
REPLAY_ENGINE_SCHEMA_VERSION = "mea_replay_result_v1_patch278"


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _hash_json(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def canonical_theta_hash(theta_k: Optional[Mapping[str, Any]]) -> str:
    return _hash_json(dict(theta_k or {}))


@dataclass(frozen=True)
class ReplayResult:
    problem_id: str
    formula: str
    starting_manifest_hash: str
    operator_id: str
    theta_hash: str
    expected_candidate_hash: Optional[str]
    produced_candidate_hash: Optional[str]
    operator_registered: bool
    operator_replayable: bool
    parameters_valid: bool
    replay_executed: bool
    hash_match: Optional[bool]
    replay_confirmed: bool
    sealing_permitted_by_replay: bool
    tamper_detected: bool
    errors: Tuple[str, ...] = field(default_factory=tuple)
    warnings: Tuple[str, ...] = field(default_factory=tuple)
    candidate_manifest: Optional[Dict[str, Any]] = None
    operator_definition: Optional[Dict[str, Any]] = None
    parameter_validation: Optional[Dict[str, Any]] = None
    patch_id: str = REPLAY_ENGINE_PATCH_ID
    schema_version: str = REPLAY_ENGINE_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ReplayStepReport:
    step_index: int
    operator_id: str
    theta_hash: str
    input_manifest_hash: str
    output_manifest_hash: Optional[str]
    replay_executed: bool
    errors: Tuple[str, ...] = field(default_factory=tuple)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ReplayPathResult:
    problem_id: str
    formula: str
    starting_manifest_hash: str
    expected_final_hash: Optional[str]
    produced_final_hash: Optional[str]
    replay_executed: bool
    hash_match: Optional[bool]
    replay_confirmed: bool
    sealing_permitted_by_replay: bool
    tamper_detected: bool
    steps: Tuple[ReplayStepReport, ...]
    errors: Tuple[str, ...] = field(default_factory=tuple)
    warnings: Tuple[str, ...] = field(default_factory=tuple)
    final_manifest: Optional[Dict[str, Any]] = None
    patch_id: str = REPLAY_ENGINE_PATCH_ID
    schema_version: str = "mea_replay_path_result_v1_patch278"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def replay_candidate(
    starting_manifest: ProblemManifest,
    operator_id: str,
    theta_k: Optional[Mapping[str, Any]] = None,
    *,
    expected_candidate_hash: Optional[str] = None,
    registry: Optional[OperatorRegistry] = None,
) -> ReplayResult:
    """Replay one deterministic MEA operator against a starting manifest.

    If expected_candidate_hash is omitted, the operator can be previewed but not
    replay-confirmed for sealing. Patch 278 reports that distinction explicitly.
    """

    if not isinstance(starting_manifest, ProblemManifest):
        raise TypeError("starting_manifest must be ProblemManifest")

    active_registry = registry or build_default_operator_registry()
    theta = dict(theta_k or {})
    start_hash = canonical_hash(starting_manifest)
    theta_hash = canonical_theta_hash(theta)
    errors = []
    warnings = []
    produced_hash: Optional[str] = None
    candidate_dict: Optional[Dict[str, Any]] = None
    operator_registered = active_registry.has_operator(operator_id)
    operator_replayable = False
    params_valid = False
    definition_dict: Optional[Dict[str, Any]] = None
    validation_dict: Optional[Dict[str, Any]] = None

    if not operator_registered:
        errors.append(f"unknown operator_id: {operator_id}")
    else:
        definition = active_registry.get(operator_id)
        definition_dict = definition.to_dict()
        operator_replayable = bool(definition.replayable)
        validation = active_registry.validate_parameters(operator_id, theta)
        validation_dict = validation.to_dict()
        params_valid = validation.valid
        errors.extend(validation.errors)
        warnings.extend(validation.warnings)
        if params_valid and operator_replayable:
            try:
                candidate = active_registry.apply(starting_manifest, operator_id, theta)
                candidate_dict = to_dict(candidate)
                produced_hash = canonical_hash(candidate)
            except Exception as exc:
                errors.append(str(exc))

    replay_executed = produced_hash is not None and not errors
    if expected_candidate_hash is None:
        hash_match = None
        if replay_executed:
            warnings.append("expected_candidate_hash missing: replay preview executed, but sealing is not permitted without hash comparison.")
    else:
        hash_match = produced_hash == expected_candidate_hash

    replay_confirmed = bool(replay_executed and expected_candidate_hash is not None and hash_match is True)
    tamper_detected = bool(replay_executed and expected_candidate_hash is not None and hash_match is False)
    if tamper_detected:
        errors.append("replay hash mismatch: theta_k or operator path does not reproduce expected candidate hash")

    return ReplayResult(
        problem_id=starting_manifest.problem_id,
        formula=REPLAY_LAW_FORMULA,
        starting_manifest_hash=start_hash,
        operator_id=operator_id,
        theta_hash=theta_hash,
        expected_candidate_hash=expected_candidate_hash,
        produced_candidate_hash=produced_hash,
        operator_registered=operator_registered,
        operator_replayable=operator_replayable,
        parameters_valid=params_valid,
        replay_executed=replay_executed,
        hash_match=hash_match,
        replay_confirmed=replay_confirmed,
        sealing_permitted_by_replay=replay_confirmed,
        tamper_detected=tamper_detected,
        errors=tuple(errors),
        warnings=tuple(warnings),
        candidate_manifest=candidate_dict,
        operator_definition=definition_dict,
        parameter_validation=validation_dict,
    )


def replay_operator_path(
    starting_manifest: ProblemManifest,
    operator_calls: Sequence[Mapping[str, Any]],
    *,
    expected_final_hash: Optional[str] = None,
    registry: Optional[OperatorRegistry] = None,
) -> ReplayPathResult:
    """Replay a deterministic operator chain without writing the result anywhere."""

    if not isinstance(starting_manifest, ProblemManifest):
        raise TypeError("starting_manifest must be ProblemManifest")
    active_registry = registry or build_default_operator_registry()
    current = starting_manifest
    start_hash = canonical_hash(starting_manifest)
    steps = []
    errors = []
    warnings = []

    for idx, call in enumerate(operator_calls):
        operator_id = str(call.get("operator_id", "")).strip()
        theta_k = dict(call.get("theta_k", {}) or {})
        input_hash = canonical_hash(current)
        result = replay_candidate(current, operator_id, theta_k, registry=active_registry)
        output_hash = result.produced_candidate_hash
        steps.append(
            ReplayStepReport(
                step_index=idx,
                operator_id=operator_id,
                theta_hash=result.theta_hash,
                input_manifest_hash=input_hash,
                output_manifest_hash=output_hash,
                replay_executed=result.replay_executed,
                errors=tuple(result.errors),
            )
        )
        if result.errors:
            errors.extend(f"step {idx}: {err}" for err in result.errors)
            break
        if result.candidate_manifest is None:
            errors.append(f"step {idx}: operator did not produce a candidate manifest")
            break
        from .manifest_schema import from_dict

        current = from_dict(result.candidate_manifest)

    produced_final_hash = canonical_hash(current) if not errors else None
    replay_executed = produced_final_hash is not None and len(steps) == len(operator_calls)
    if expected_final_hash is None:
        hash_match = None
        if replay_executed:
            warnings.append("expected_final_hash missing: path replay preview executed, but sealing is not permitted without final hash comparison.")
    else:
        hash_match = produced_final_hash == expected_final_hash

    replay_confirmed = bool(replay_executed and expected_final_hash is not None and hash_match is True)
    tamper_detected = bool(replay_executed and expected_final_hash is not None and hash_match is False)
    if tamper_detected:
        errors.append("final replay hash mismatch")

    return ReplayPathResult(
        problem_id=starting_manifest.problem_id,
        formula=REPLAY_LAW_FORMULA,
        starting_manifest_hash=start_hash,
        expected_final_hash=expected_final_hash,
        produced_final_hash=produced_final_hash,
        replay_executed=replay_executed,
        hash_match=hash_match,
        replay_confirmed=replay_confirmed,
        sealing_permitted_by_replay=replay_confirmed,
        tamper_detected=tamper_detected,
        steps=tuple(steps),
        errors=tuple(errors),
        warnings=tuple(warnings),
        final_manifest=to_dict(current) if produced_final_hash is not None else None,
    )


def replay_engine_boundary() -> Dict[str, Any]:
    boundary = dict(operator_registry_boundary())
    boundary.update(
        {
            "patch": REPLAY_ENGINE_PATCH_ID,
            "layer": "MEA replay foundation / replay engine",
            "operator_registry_patch": OPERATOR_REGISTRY_PATCH_ID,
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
            "renderer_integration": False,
        }
    )
    return boundary
