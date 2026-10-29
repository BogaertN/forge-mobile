"""General Learning-to-Answer Pipeline — typed contracts (Build GP-001).

This module defines the small, explicit data contracts that flow through the
general pipeline. They are intentionally plain dataclasses with canonical
hashing, so every stage is deterministic and auditable in the same spirit as
the existing MEA fixed-point discipline.

Boundaries (Build GP-001):
  - No route, no UI, no network, no LLM.
  - No memory write, no Chroma, no Identity Vault, no CT/ledger activity.
  - The pipeline computes and returns objects in-memory only.

Design intent:
  A *domain* is the unit of growth. Each domain supplies (1) a matcher that
  recognises whether a question belongs to it, (2) a parser that extracts the
  governed quantities, (3) an exact executor that computes the answer with
  exact arithmetic, and (4) the natural-language facts the renderer needs.
  Adding capability means adding a domain, never rewriting the engine.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Any, Dict, List, Optional, Tuple

GENERAL_PIPELINE_BUILD_ID = "GENERAL-LEARNING-TO-ANSWER-PIPELINE-FOUNDATION-BUILD-GP-001"
GENERAL_PIPELINE_SCHEMA_VERSION = "general_pipeline_v1_build_gp001"


def canonical_json(value: Any) -> str:
    """Stable JSON identical in spirit to the engine's canonical_json."""
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, default=str)


def canonical_hash(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def fraction_to_text(value: Fraction) -> str:
    """Render a Fraction as the most natural exact text.

    Integers render without a denominator; other values render as a/b in
    lowest terms (Fraction already normalises)."""
    if value.denominator == 1:
        return str(value.numerator)
    return f"{value.numerator}/{value.denominator}"


@dataclass
class CompiledConcept:
    """One governed concept compiled from instructional source text."""

    concept_id: str
    term: str
    definition: str
    source_ref: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "concept_id": self.concept_id,
            "term": self.term,
            "definition": self.definition,
            "source_ref": self.source_ref,
        }


@dataclass
class CompiledProcedure:
    """One governed solution procedure compiled from instructional source text."""

    procedure_id: str
    domain: str
    relation_text: str
    source_ref: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "procedure_id": self.procedure_id,
            "domain": self.domain,
            "relation_text": self.relation_text,
            "source_ref": self.source_ref,
        }


@dataclass
class SemanticSource:
    """The compiled, hash-bound result of learning from instructional text.

    In Build GP-001 this lives in-memory only; persistence is a later, gated
    build. It carries source ancestry so a later manifest can prove where its
    permitted relations came from.
    """

    source_id: str
    raw_text_hash: str
    concepts: List[CompiledConcept] = field(default_factory=list)
    procedures: List[CompiledProcedure] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "raw_text_hash": self.raw_text_hash,
            "concepts": [c.to_dict() for c in self.concepts],
            "procedures": [p.to_dict() for p in self.procedures],
        }

    def source_hash(self) -> str:
        return canonical_hash(self.to_dict())

    def supports_domain(self, domain: str) -> bool:
        return any(p.domain == domain for p in self.procedures)

    def procedure_for_domain(self, domain: str) -> Optional[CompiledProcedure]:
        for proc in self.procedures:
            if proc.domain == domain:
                return proc
        return None


@dataclass
class ParsedQuestion:
    """A question recognised by a domain matcher and parsed into typed fields.

    `quantities` holds exact Fraction values keyed by role name. `metadata`
    holds non-numeric language facts (object noun, unit word, operation word)
    the renderer will need to speak naturally.
    """

    domain: str
    raw_question: str
    quantities: Dict[str, Fraction] = field(default_factory=dict)
    metadata: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "raw_question": self.raw_question,
            "quantities": {k: fraction_to_text(v) for k, v in sorted(self.quantities.items())},
            "metadata": dict(sorted(self.metadata.items())),
        }


@dataclass
class ExactSolution:
    """The exact computed result plus a replayable verification trace.

    `answer_value` is the exact Fraction answer. `steps` is an ordered list of
    human-checkable arithmetic facts (each already computed exactly). `verified`
    must be True for the governed gate to allow sealing; `information_gain` must
    be positive (an answer that resolves no unknown is recall, not discovery).
    """

    domain: str
    answer_value: Fraction
    answer_unit: str
    steps: List[str] = field(default_factory=list)
    verification_text: str = ""
    verified: bool = False
    information_gain: int = 0  # micro units, 0..1_000_000

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "answer_value": fraction_to_text(self.answer_value),
            "answer_unit": self.answer_unit,
            "steps": list(self.steps),
            "verification_text": self.verification_text,
            "verified": self.verified,
            "information_gain": self.information_gain,
        }


@dataclass
class MeaningManifest:
    """The RMC-side meaning object compiled from a sealed solution.

    This is deliberately separate from the MEA ProblemManifest. The MEA
    manifest is the sealed problem state; this is the communication-ready
    meaning the renderer speaks from. They must not be merged.
    """

    problem_id: str
    claim_status: str
    answer_text: str
    answer_unit: str
    object_noun: str
    operation_word: str
    given_facts: List[str] = field(default_factory=list)
    reasoning_steps: List[str] = field(default_factory=list)
    verification_text: str = ""
    source_ref: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "problem_id": self.problem_id,
            "claim_status": self.claim_status,
            "answer_text": self.answer_text,
            "answer_unit": self.answer_unit,
            "object_noun": self.object_noun,
            "operation_word": self.operation_word,
            "given_facts": list(self.given_facts),
            "reasoning_steps": list(self.reasoning_steps),
            "verification_text": self.verification_text,
            "source_ref": self.source_ref,
        }

    def meaning_hash(self) -> str:
        return canonical_hash(self.to_dict())


__all__ = [
    "GENERAL_PIPELINE_BUILD_ID",
    "GENERAL_PIPELINE_SCHEMA_VERSION",
    "canonical_json",
    "canonical_hash",
    "fraction_to_text",
    "CompiledConcept",
    "CompiledProcedure",
    "SemanticSource",
    "ParsedQuestion",
    "ExactSolution",
    "MeaningManifest",
]
