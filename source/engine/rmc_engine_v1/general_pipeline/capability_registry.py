"""General Pipeline — centralized bounded capability registry (Build GP-004).

GP-004 production regrounds the General Pipeline around explicit, deterministic
capability contracts. A registered capability may parse and execute only its
declared bounded problem family. It is not an agent, does not write memory,
does not authorize itself from source text, does not render final output, and
does not participate in Identity Vault or Contribution Economy activity.

The registry is deliberately in-memory and stdlib-only in GP-004. Source text
may support use of an already-registered capability, but it can never install,
activate, or expand a capability.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

from .contracts import canonical_hash

GP004_BUILD_ID = "GENERAL-PIPELINE-PRODUCTION-REGROUND-BUILD-GP-004"
GP004_SCHEMA_VERSION = "general_pipeline_capability_registry_v1_build_gp004"


class CapabilityRegistrationError(ValueError):
    """Raised when code attempts to redefine an installed capability contract."""


@dataclass(frozen=True)
class CapabilityContract:
    """Immutable authority boundary for one bounded executable capability."""

    capability_id: str
    domain_id: str
    domain_factory: Callable[[], Any]
    relation_text: str
    source_fingerprints: Tuple[str, ...]
    min_fingerprint_hits: int = 2
    priority: int = 100
    parser_policy: str = "full_input_required"
    executor_policy: str = "deterministic_exact"
    verification_policy: str = "mandatory_exact_verification"
    memory_write_allowed: bool = False
    identity_write_allowed: bool = False
    ct_mint_allowed: bool = False
    final_output_allowed: bool = False

    def __post_init__(self) -> None:
        if not self.capability_id or not self.domain_id:
            raise ValueError("capability_id and domain_id must be non-empty")
        if not callable(self.domain_factory):
            raise ValueError("domain_factory must be callable")
        if self.min_fingerprint_hits < 1:
            raise ValueError("min_fingerprint_hits must be positive")
        if self.min_fingerprint_hits > len(self.source_fingerprints):
            raise ValueError("min_fingerprint_hits cannot exceed fingerprints")
        if any(
            (
                self.memory_write_allowed,
                self.identity_write_allowed,
                self.ct_mint_allowed,
                self.final_output_allowed,
            )
        ):
            raise ValueError(
                "GP-004 capability contracts are computation-only: no writes, "
                "minting, or final-output authority is allowed"
            )

    @property
    def domain_factory_ref(self) -> str:
        return f"{self.domain_factory.__module__}.{self.domain_factory.__qualname__}"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "capability_id": self.capability_id,
            "domain_id": self.domain_id,
            "domain_factory_ref": self.domain_factory_ref,
            "relation_text": self.relation_text,
            "source_fingerprints": list(self.source_fingerprints),
            "min_fingerprint_hits": self.min_fingerprint_hits,
            "priority": self.priority,
            "parser_policy": self.parser_policy,
            "executor_policy": self.executor_policy,
            "verification_policy": self.verification_policy,
            "memory_write_allowed": self.memory_write_allowed,
            "identity_write_allowed": self.identity_write_allowed,
            "ct_mint_allowed": self.ct_mint_allowed,
            "final_output_allowed": self.final_output_allowed,
        }

    def contract_hash(self) -> str:
        return canonical_hash(self.to_dict())

    def instantiate_domain(self) -> Any:
        domain = self.domain_factory()
        if getattr(domain, "domain_id", None) != self.domain_id:
            raise CapabilityRegistrationError(
                f"factory for {self.capability_id!r} produced incompatible domain"
            )
        return domain

    def fingerprint_hits(self, normalized_source_text: str) -> List[str]:
        hits: List[str] = []
        for phrase in self.source_fingerprints:
            pattern = r"\b" + re.escape(phrase) + r"\b"
            if re.search(pattern, normalized_source_text):
                hits.append(phrase)
        return hits


class CapabilityRegistry:
    """One deterministic registry controlled by installed Forge code only."""

    def __init__(self) -> None:
        self._by_id: Dict[str, CapabilityContract] = {}
        self._domain_to_id: Dict[str, str] = {}

    def register(self, contract: CapabilityContract) -> bool:
        existing = self._by_id.get(contract.capability_id)
        if existing is not None:
            if existing.to_dict() == contract.to_dict():
                return False
            raise CapabilityRegistrationError(
                f"conflicting contract for capability_id {contract.capability_id!r}"
            )

        previous_id = self._domain_to_id.get(contract.domain_id)
        if previous_id is not None:
            previous = self._by_id[previous_id]
            if previous.to_dict() == contract.to_dict():
                return False
            raise CapabilityRegistrationError(
                f"domain {contract.domain_id!r} already belongs to {previous_id!r}; "
                "source or plugin code may not replace an installed capability"
            )

        self._by_id[contract.capability_id] = contract
        self._domain_to_id[contract.domain_id] = contract.capability_id
        return True

    def contracts(self) -> List[CapabilityContract]:
        return sorted(
            self._by_id.values(),
            key=lambda item: (item.priority, item.capability_id),
        )

    def get_by_domain(self, domain_id: str) -> Optional[CapabilityContract]:
        capability_id = self._domain_to_id.get(domain_id)
        return self._by_id.get(capability_id) if capability_id else None

    def get_by_id(self, capability_id: str) -> Optional[CapabilityContract]:
        return self._by_id.get(capability_id)

    def instantiate_domains(self) -> List[Any]:
        return [contract.instantiate_domain() for contract in self.contracts()]

    def snapshot(self) -> Dict[str, Any]:
        contracts = [contract.to_dict() for contract in self.contracts()]
        return {
            "build_id": GP004_BUILD_ID,
            "schema_version": GP004_SCHEMA_VERSION,
            "authority": "installed_code_only",
            "source_can_register_capabilities": False,
            "capability_count": len(contracts),
            "capabilities": contracts,
        }

    def registry_hash(self) -> str:
        return canonical_hash(self.snapshot())


_REGISTRY = CapabilityRegistry()


def register_capability(contract: CapabilityContract) -> bool:
    return _REGISTRY.register(contract)


def all_capability_contracts() -> List[CapabilityContract]:
    return _REGISTRY.contracts()


def capability_for_domain(domain_id: str) -> Optional[CapabilityContract]:
    return _REGISTRY.get_by_domain(domain_id)


def capability_for_id(capability_id: str) -> Optional[CapabilityContract]:
    return _REGISTRY.get_by_id(capability_id)


def instantiate_registered_domains() -> List[Any]:
    return _REGISTRY.instantiate_domains()


def registry_snapshot() -> Dict[str, Any]:
    return _REGISTRY.snapshot()


def registry_hash() -> str:
    return _REGISTRY.registry_hash()


def boundary_contract() -> Dict[str, Any]:
    return {
        "build_id": GP004_BUILD_ID,
        "schema_version": GP004_SCHEMA_VERSION,
        "centralized_capability_registry": True,
        "full_input_parse_policy": True,
        "source_can_register_capabilities": False,
        "in_memory_only": True,
        "writes_files": False,
        "writes_memory": False,
        "writes_identity_vault": False,
        "writes_contribution_economy": False,
        "mints_ct": False,
        "creates_routes": False,
        "adds_corpus_ingestion": False,
        "adds_new_language_domain": False,
        "third_party_dependencies_added": [],
    }


__all__ = [
    "GP004_BUILD_ID",
    "GP004_SCHEMA_VERSION",
    "CapabilityRegistrationError",
    "CapabilityContract",
    "register_capability",
    "all_capability_contracts",
    "capability_for_domain",
    "capability_for_id",
    "instantiate_registered_domains",
    "registry_snapshot",
    "registry_hash",
    "boundary_contract",
]
