"""General Learning-to-Answer Pipeline — source compiler (Build GP-004).

Turns instructional source text into a hash-bound SemanticSource whose governed
procedures may reference only capabilities already installed in the centralized
capability registry.

Authority boundary:
  - Source text NEVER registers or activates executable capability.
  - Installed code registers bounded capabilities.
  - Source text may provide supporting ancestry for an already registered
    capability when its limited GP-004 fingerprint rule is satisfied.
  - Result correctness still requires capability execution, verification, gate,
    meaning compilation, and Echo approval.

This remains an in-memory, non-corpus prototype stage: no persistence, no
retrieval index, no Chroma, no memory write, no Identity Vault, no CT/ledger.
"""

from __future__ import annotations

from typing import List

# Importing domains registers the two GP-001 installed capabilities. GP-002 and
# GP-003 are added only by their explicit activate() entry points.
from . import domains as _installed_foundation_domains  # noqa: F401
from .capability_registry import all_capability_contracts
from .contracts import (
    SemanticSource,
    CompiledConcept,
    CompiledProcedure,
    canonical_hash,
)


def _raw_hash(text: str) -> str:
    return canonical_hash({"raw_text": text})


def compile_source(source_text: str, source_ref: str) -> SemanticSource:
    """Compile source support only for installed bounded capabilities.

    This GP-004 compiler intentionally does not perform open-ended knowledge
    extraction. It creates a source-backed procedure only where installed Forge
    code already declares an executable/verified capability contract.
    """
    text = str(source_text)
    norm = " ".join(text.lower().split())
    raw_text_hash = _raw_hash(text)
    source_id = canonical_hash({"raw_text_hash": raw_text_hash, "source_ref": source_ref})[:24]

    concepts: List[CompiledConcept] = []
    procedures: List[CompiledProcedure] = []

    for contract in all_capability_contracts():
        hits = contract.fingerprint_hits(norm)
        if len(hits) < contract.min_fingerprint_hits:
            continue
        procedures.append(
            CompiledProcedure(
                procedure_id=canonical_hash({"d": contract.domain_id, "s": source_id})[:16],
                domain=contract.domain_id,
                relation_text=contract.relation_text,
                source_ref=source_ref,
            )
        )
        for term in hits:
            concepts.append(
                CompiledConcept(
                    concept_id=canonical_hash(
                        {"t": term, "s": source_id, "c": contract.capability_id}
                    )[:16],
                    term=term,
                    definition=f"term used by installed capability {contract.capability_id}",
                    source_ref=source_ref,
                )
            )

    return SemanticSource(
        source_id=source_id,
        raw_text_hash=raw_text_hash,
        concepts=concepts,
        procedures=procedures,
    )


__all__ = ["compile_source"]
