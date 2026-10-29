"""
forge/rmc_engine_v1/mea/unknown_detector.py

MEA unknown-vector detector.
Patch 275: read-only structural inspection only.

The detector exposes what the system does not know without asking an LLM to
interpret it. It inspects required manifest fields, explicit unknowns,
weak assumptions, contradictions, proof debt, and language indicating missing
evidence.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple

from .manifest_schema import ProblemManifest


class GapType(str, Enum):
    MISSING = "missing"
    EXPLICIT_UNKNOWN = "explicit_unknown"
    WEAK = "weak"
    CONTRADICTED = "contradicted"
    UNVERIFIED = "unverified"
    DEPENDENCY_FAILED = "dependency_failed"


_UNVERIFIED_MARKERS: Tuple[str, ...] = (
    "no published",
    "no direct",
    "no empirical",
    "not yet measured",
    "not yet confirmed",
    "no measurement",
    "no study",
    "no data",
    "unconfirmed",
    "hypothesized",
    "hypothesised",
    "assumed",
    "speculated",
    "theoretical only",
    "not experimentally",
    "lacks direct",
    "lacks empirical",
    "lacks measurement",
    "lacking direct",
    "not independently",
)

_WEAK_ASSUMPTION_THRESHOLD = 0.30
_UNVERIFIED_ASSUMPTION_THRESHOLD = 0.15


@dataclass(frozen=True)
class UnknownGap:
    field: str
    gap_type: GapType
    detail: str
    index: Optional[int] = None
    item_text: Optional[str] = None
    severity: str = "warning"
    resolution_hint: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["gap_type"] = self.gap_type.value
        return data


@dataclass
class UnknownVector:
    problem_id: str
    explicit_unknowns: List[str] = field(default_factory=list)
    gaps: List[UnknownGap] = field(default_factory=list)
    summary: str = ""

    @property
    def unknown_count(self) -> int:
        return len(self.explicit_unknowns)

    @property
    def gap_count(self) -> int:
        return len(self.gaps)

    @property
    def has_errors(self) -> bool:
        return any(g.severity == "error" for g in self.gaps)

    @property
    def missing_count(self) -> int:
        return self.count(GapType.MISSING)

    @property
    def explicit_unknown_count(self) -> int:
        return self.count(GapType.EXPLICIT_UNKNOWN)

    @property
    def weak_count(self) -> int:
        return self.count(GapType.WEAK)

    @property
    def contradicted_count(self) -> int:
        return self.count(GapType.CONTRADICTED)

    @property
    def unverified_count(self) -> int:
        return self.count(GapType.UNVERIFIED)

    @property
    def dependency_failed_count(self) -> int:
        return self.count(GapType.DEPENDENCY_FAILED)

    def count(self, gap_type: GapType) -> int:
        return sum(1 for gap in self.gaps if gap.gap_type == gap_type)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "problem_id": self.problem_id,
            "explicit_unknowns": list(self.explicit_unknowns),
            "unknown_count": self.unknown_count,
            "gap_count": self.gap_count,
            "has_errors": self.has_errors,
            "missing_count": self.missing_count,
            "explicit_unknown_count": self.explicit_unknown_count,
            "weak_count": self.weak_count,
            "contradicted_count": self.contradicted_count,
            "unverified_count": self.unverified_count,
            "dependency_failed_count": self.dependency_failed_count,
            "summary": self.summary,
            "gaps": [gap.to_dict() for gap in self.gaps],
        }

    def to_report(self) -> str:
        lines = [
            "=" * 64,
            "MEA Unknown Vector Report",
            "=" * 64,
            f"problem_id                : {self.problem_id}",
            f"summary                   : {self.summary}",
            f"explicit unknowns          : {self.unknown_count}",
            f"structural gaps            : {self.gap_count}",
            f"missing                    : {self.missing_count}",
            f"explicit_unknown           : {self.explicit_unknown_count}",
            f"weak                       : {self.weak_count}",
            f"contradicted               : {self.contradicted_count}",
            f"unverified                 : {self.unverified_count}",
            f"dependency_failed          : {self.dependency_failed_count}",
            f"has_errors                 : {self.has_errors}",
            "",
        ]
        if self.explicit_unknowns:
            lines.append("Explicit unknowns:")
            for idx, item in enumerate(self.explicit_unknowns, 1):
                lines.append(f"  {idx}. {item}")
            lines.append("")
        if self.gaps:
            lines.append("Gaps:")
            for idx, gap in enumerate(self.gaps, 1):
                loc = gap.field if gap.index is None else f"{gap.field}[{gap.index}]"
                lines.append(f"  [{idx:02d}] {gap.severity.upper():7s} {gap.gap_type.value:18s} {loc}")
                lines.append(f"       {gap.detail}")
                if gap.item_text:
                    lines.append(f"       item: {gap.item_text}")
                if gap.resolution_hint:
                    lines.append(f"       hint: {gap.resolution_hint}")
        else:
            lines.append("No gaps detected.")
        lines.append("=" * 64)
        return "\n".join(lines)


def _is_unverified_text(text: str) -> bool:
    lower = text.lower()
    return any(marker in lower for marker in _UNVERIFIED_MARKERS)


def _extract_key_terms(text: str) -> Set[str]:
    stop = {
        "a", "an", "the", "of", "in", "is", "are", "to", "and", "or", "for",
        "that", "this", "was", "be", "been", "by", "it", "its", "as", "at",
        "on", "with", "from", "not", "no", "has", "have", "does", "do", "whether",
        "if", "direct", "empirical", "published",
    }
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {token for token in tokens if len(token) >= 2 and token not in stop}


def _missing_gap(field: str, detail: str, critical: bool, hint: str) -> UnknownGap:
    return UnknownGap(
        field=field,
        gap_type=GapType.MISSING,
        detail=detail,
        severity="error" if critical else "warning",
        resolution_hint=hint,
    )


def detect_unknowns(manifest: ProblemManifest) -> UnknownVector:
    gaps: List[UnknownGap] = []

    explicit_unknowns = [item for item in manifest.unknowns if item.strip()]
    for idx, unknown in enumerate(manifest.unknowns):
        if not unknown.strip():
            gaps.append(UnknownGap(
                field="unknowns",
                gap_type=GapType.MISSING,
                index=idx,
                item_text=unknown,
                detail=f"unknowns[{idx}] is blank.",
                severity="error",
                resolution_hint="Fill or remove the blank unknown entry.",
            ))
        else:
            gaps.append(UnknownGap(
                field="unknowns",
                gap_type=GapType.EXPLICIT_UNKNOWN,
                index=idx,
                item_text=unknown,
                detail="Explicit unresolved question tracked by the MEA problem manifest.",
                severity="info",
                resolution_hint="Reduce this unknown through evidence, derivation, test, branch, or cold-storage decision.",
            ))

    field_checks = [
        ("problem_id", manifest.problem_id, True, "problem_id is empty.", "Assign a stable problem id."),
        ("goal", manifest.goal, True, "goal is empty.", "Set a one-sentence goal."),
        ("known_facts", manifest.known_facts, True, "known_facts is empty.", "Add verified facts or cite memory ancestry."),
        ("unknowns", manifest.unknowns, True, "unknowns is empty.", "Add explicit open questions."),
        ("success_conditions", manifest.success_conditions, True, "success_conditions is empty.", "Define success criteria for convergence scoring."),
        ("constraints", manifest.constraints, False, "constraints is empty.", "Add constraints to limit candidate drift."),
        ("failure_conditions", manifest.failure_conditions, False, "failure_conditions is empty.", "Add cold-storage or failure criteria."),
    ]
    for field_name, value, critical, detail, hint in field_checks:
        empty = value is None or value == "" or (isinstance(value, list) and len(value) == 0)
        if empty:
            gaps.append(_missing_gap(field_name, detail, critical, hint))

    for idx, fact in enumerate(manifest.known_facts):
        if not fact.strip():
            gaps.append(UnknownGap(
                field="known_facts",
                gap_type=GapType.MISSING,
                index=idx,
                item_text=fact,
                detail=f"known_facts[{idx}] is blank.",
                severity="error",
                resolution_hint="Remove blank known_fact or replace it with a verified statement.",
            ))
        elif _is_unverified_text(fact):
            gaps.append(UnknownGap(
                field="known_facts",
                gap_type=GapType.UNVERIFIED,
                index=idx,
                item_text=fact,
                detail="This known_fact states an evidence absence or unresolved empirical gap; it should constrain claim status.",
                severity="warning",
                resolution_hint="Keep as a constraint fact, and route any stronger claim through check_evidence/proof_debt scoring.",
            ))

    for idx, assumption in enumerate(manifest.assumptions):
        if assumption.confidence < _UNVERIFIED_ASSUMPTION_THRESHOLD:
            gaps.append(UnknownGap(
                field="assumptions",
                gap_type=GapType.UNVERIFIED,
                index=idx,
                item_text=assumption.text,
                detail=f"assumption confidence {assumption.confidence:.2f} is effectively ungrounded.",
                severity="warning",
                resolution_hint="Run check_evidence or invert this assumption.",
            ))
        elif assumption.confidence < _WEAK_ASSUMPTION_THRESHOLD:
            gaps.append(UnknownGap(
                field="assumptions",
                gap_type=GapType.WEAK,
                index=idx,
                item_text=assumption.text,
                detail=f"assumption confidence {assumption.confidence:.2f} is weak.",
                severity="info",
                resolution_hint="Gather evidence or mark downstream candidates speculative.",
            ))

    for idx, contradiction in enumerate(manifest.contradictions):
        if not contradiction.strip():
            gaps.append(UnknownGap(
                field="contradictions",
                gap_type=GapType.MISSING,
                index=idx,
                detail=f"contradictions[{idx}] is blank.",
                severity="error",
            ))
        else:
            gaps.append(UnknownGap(
                field="contradictions",
                gap_type=GapType.CONTRADICTED,
                index=idx,
                item_text=contradiction,
                detail="Unresolved contradiction remains in manifest state.",
                severity="warning",
                resolution_hint="Apply check_contradiction or resolve_contradiction.",
            ))

    contradiction_terms = [_extract_key_terms(item) for item in manifest.contradictions]
    for f_idx, fact in enumerate(manifest.known_facts):
        fact_terms = _extract_key_terms(fact)
        for c_idx, terms in enumerate(contradiction_terms):
            overlap = fact_terms & terms
            if len(overlap) >= 3:
                gaps.append(UnknownGap(
                    field="known_facts",
                    gap_type=GapType.CONTRADICTED,
                    index=f_idx,
                    item_text=fact,
                    detail=f"known_facts[{f_idx}] overlaps contradiction[{c_idx}] on {sorted(overlap)}.",
                    severity="warning",
                    resolution_hint="Resolve contradiction before promoting claim status.",
                ))
                break

    unknown_terms = [_extract_key_terms(item) for item in manifest.unknowns]
    for i in range(len(unknown_terms)):
        for j in range(i + 1, len(unknown_terms)):
            overlap = unknown_terms[i] & unknown_terms[j]
            if len(overlap) >= 2:
                gaps.append(UnknownGap(
                    field="unknowns",
                    gap_type=GapType.DEPENDENCY_FAILED,
                    index=i,
                    item_text=manifest.unknowns[i],
                    detail=f"unknowns[{i}] and unknowns[{j}] share terms {sorted(overlap)}; one may depend on the other.",
                    severity="info",
                    resolution_hint="Use split or branch to separate dependency paths.",
                ))

    if manifest.proof_debt >= 0.70:
        gaps.append(UnknownGap(
            field="proof_debt",
            gap_type=GapType.WEAK,
            detail=f"proof_debt={manifest.proof_debt:.2f} is high; verified_claim status is blocked until evidence support improves.",
            severity="warning",
            resolution_hint="Run check_evidence/check_proof_debt in later MEA scoring patches.",
        ))

    severity_rank = {"error": 0, "warning": 1, "info": 2}
    gaps.sort(key=lambda gap: (severity_rank.get(gap.severity, 9), gap.field, gap.index if gap.index is not None else -1, gap.gap_type.value))

    error_count = sum(1 for gap in gaps if gap.severity == "error")
    warning_count = sum(1 for gap in gaps if gap.severity == "warning")
    if error_count:
        summary = f"INVALID: {error_count} error(s), {warning_count} warning(s), {len(explicit_unknowns)} explicit unknown(s)."
    elif warning_count:
        summary = f"VALID_WITH_WARNINGS: {warning_count} warning(s), {len(explicit_unknowns)} explicit unknown(s)."
    else:
        summary = f"VALID: {len(explicit_unknowns)} explicit unknown(s), no warnings."

    return UnknownVector(problem_id=manifest.problem_id, explicit_unknowns=explicit_unknowns, gaps=gaps, summary=summary)
