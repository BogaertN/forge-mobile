"""Deterministic boundary helpers for withdrawn frozen legacy RMC features.

This module does not import or call the frozen legacy LLM renderer or Chroma
connector. It provides refusal records and filesystem-only request
classification for compatibility-facing routes and function signatures.
"""
from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Any, Mapping

ENGINE_VERSION = "aiweb_frozen_legacy_boundary_v1"
ENGINE_MODE = "deterministic_refusal_and_filesystem_only_classification"

FILESYSTEM_ALIASES = frozenset({
    "",
    "filesystem",
    "file",
    "files",
    "fs",
    "local",
    "local_filesystem",
})
FALSE_TOGGLE_VALUES = frozenset({"", "0", "false", "no", "off", "disabled", "none", "null"})
TRUE_TOGGLE_VALUES = frozenset({"1", "true", "yes", "on", "enabled", "enable", "llm", "model"})


@dataclass(frozen=True)
class BoundaryDecision:
    status: str
    reason_code: str
    feature_id: str
    requested: Mapping[str, Any]
    effective_backend: str = "none"

    def as_dict(self) -> dict[str, Any]:
        return {
            "ok": self.status == "OK",
            "status": self.status,
            "reason_code": self.reason_code,
            "feature_id": self.feature_id,
            "requested": dict(self.requested),
            "retrieval_backend_effective": self.effective_backend,
            "runtime_authorized": False,
            "authority": "none",
            "calls_llm": False,
            "calls_model": False,
            "calls_vector_store": False,
            "calls_chroma": False,
            "performs_retrieval": self.status == "OK" and self.effective_backend == "filesystem",
            "writes_files": False,
            "writes_memory": False,
            "executes_shell": False,
            "evidence_validated": False,
            "action_authorized": False,
            "delivery_authorized": False,
            "release_authorized": False,
            "production_readiness_authorized": False,
        }


def _clean(value: Any) -> str:
    return str(value or "").strip().lower().replace("-", "_")


def _nonempty(value: Any) -> bool:
    return value is not None and str(value).strip() != ""


def _toggle_requested(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    cleaned = _clean(value)
    if cleaned in FALSE_TOGGLE_VALUES:
        return False
    if cleaned in TRUE_TOGGLE_VALUES:
        return True
    return bool(cleaned)


def legacy_route_record(feature_id: str, endpoint: str) -> dict[str, Any]:
    """Return a static 410-style retirement record without probing any feature."""
    decision = BoundaryDecision(
        status="BLOCKED",
        reason_code="FROZEN_LEGACY_FEATURE_WITHDRAWN",
        feature_id=str(feature_id),
        requested={"endpoint": str(endpoint)},
    ).as_dict()
    decision.update({
        "http_status": 410,
        "deprecated": True,
        "withdrawn": True,
        "read_only": True,
        "accepted_scope": "static retirement notice only",
        "message": "This frozen legacy compatibility feature is withdrawn from Forge/RMC runtime authority.",
    })
    return decision


def classify_llm_request(
    *,
    enabled: Any = False,
    model_endpoint: Any = None,
    model: Any = None,
    timeout_seconds: Any = None,
    llm_client: Any = None,
) -> dict[str, Any]:
    requested = {
        "enabled": enabled,
        "model_endpoint_supplied": _nonempty(model_endpoint),
        "model_supplied": _nonempty(model),
        "timeout_supplied": _nonempty(timeout_seconds),
        "client_supplied": llm_client is not None,
    }
    prohibited = (
        _toggle_requested(enabled)
        or requested["model_endpoint_supplied"]
        or requested["model_supplied"]
        or requested["timeout_supplied"]
        or requested["client_supplied"]
    )
    if prohibited:
        return BoundaryDecision(
            status="BLOCKED",
            reason_code="FROZEN_LEGACY_LLM_REQUEST_PROHIBITED",
            feature_id="legacy_llm_renderer",
            requested=requested,
        ).as_dict()
    return {
        "ok": True,
        "status": "NOT_REQUESTED",
        "reason_code": "DETERMINISTIC_RENDERING_ONLY",
        "feature_id": "legacy_llm_renderer",
        "requested": requested,
        "runtime_authorized": False,
        "calls_llm": False,
        "calls_model": False,
        "calls_vector_store": False,
        "calls_chroma": False,
        "performs_retrieval": False,
        "writes_files": False,
        "writes_memory": False,
        "executes_shell": False,
        "evidence_validated": False,
        "action_authorized": False,
        "delivery_authorized": False,
        "release_authorized": False,
        "production_readiness_authorized": False,
    }


def classify_retrieval_request(
    source_metadata: Mapping[str, Any] | None = None,
    environ: Mapping[str, str] | None = None,
) -> dict[str, Any]:
    metadata = dict(source_metadata or {})
    env = dict(os.environ if environ is None else environ)
    backend_raw = (
        metadata.get("retrieval_backend")
        or metadata.get("memory_backend")
        or env.get("RMC_MEMORY_RETRIEVAL_BACKEND")
        or "filesystem"
    )
    backend = _clean(backend_raw)
    prohibited_controls = {
        "chroma_collection": metadata.get("chroma_collection"),
        "collection_name": metadata.get("collection_name"),
        "chroma_limit": metadata.get("chroma_limit"),
        "env_chroma_collection": env.get("RMC_CHROMA_COLLECTION"),
        "env_chroma_limit": env.get("RMC_CHROMA_LIMIT"),
    }
    supplied_controls = {k: v for k, v in prohibited_controls.items() if _nonempty(v)}
    requested = {
        "backend": backend_raw,
        "prohibited_controls": supplied_controls,
    }
    if supplied_controls:
        return BoundaryDecision(
            status="BLOCKED",
            reason_code="FROZEN_LEGACY_VECTOR_CONTROL_PROHIBITED",
            feature_id="legacy_vector_retrieval",
            requested=requested,
        ).as_dict()
    if backend not in FILESYSTEM_ALIASES:
        return BoundaryDecision(
            status="BLOCKED",
            reason_code="FROZEN_LEGACY_RETRIEVAL_BACKEND_PROHIBITED",
            feature_id="legacy_vector_retrieval",
            requested=requested,
        ).as_dict()
    return BoundaryDecision(
        status="OK",
        reason_code="FILESYSTEM_RETRIEVAL_ONLY",
        feature_id="filesystem_memory_recall",
        requested=requested,
        effective_backend="filesystem",
    ).as_dict()


def boundary_contract() -> dict[str, Any]:
    return {
        "engine_version": ENGINE_VERSION,
        "engine_mode": ENGINE_MODE,
        "frozen_modules_imported": False,
        "frozen_modules_called": False,
        "filesystem_retrieval_only": True,
        "llm_requests_rejected": True,
        "vector_requests_rejected": True,
        "writes_files": False,
        "writes_memory": False,
        "executes_shell": False,
        "delivery_authorized": False,
        "release_authorized": False,
        "production_readiness_authorized": False,
    }
