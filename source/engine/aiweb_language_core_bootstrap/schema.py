"""Deterministic schema helpers for the isolated language-core bootstrap.

This module is standard-library only and has no runtime, network, filesystem,
environment, model, route, UI, memory, delivery, tool, or action authority.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, is_dataclass
import hashlib
import json
from typing import Any, Mapping, Sequence

SCHEMA_VERSION = "aiweb-language-core-bootstrap-v1"


@dataclass(frozen=True, slots=True)
class ValidationIssue:
    field: str
    code: str
    detail: str = ""

    def to_dict(self) -> dict[str, str]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class ValidationReport:
    schema_version: str
    ok: bool
    issues: tuple[ValidationIssue, ...]

    def to_dict(self) -> dict[str, object]:
        return {
            "schema_version": self.schema_version,
            "ok": self.ok,
            "issues": tuple(issue.to_dict() for issue in self.issues),
        }


def canonicalize(value: Any) -> Any:
    """Return a JSON-safe deterministic representation."""

    if is_dataclass(value):
        return canonicalize(asdict(value))
    if isinstance(value, Mapping):
        return {
            str(key): canonicalize(value[key])
            for key in sorted(value, key=lambda item: str(item))
        }
    if isinstance(value, tuple):
        return tuple(canonicalize(item) for item in value)
    if isinstance(value, list):
        return tuple(canonicalize(item) for item in value)
    if isinstance(value, (set, frozenset)):
        return tuple(
            sorted(
                (canonicalize(item) for item in value),
                key=lambda item: json.dumps(
                    item,
                    sort_keys=True,
                    separators=(",", ":"),
                    ensure_ascii=False,
                ),
            )
        )
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    raise TypeError(f"unsupported canonical value type: {type(value).__name__}")


def canonical_json(value: Any) -> str:
    return json.dumps(
        canonicalize(value),
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    )


def stable_record_id(namespace: str, payload: Any) -> str:
    if not isinstance(namespace, str) or not namespace.strip():
        raise ValueError("namespace must be non-empty text")
    digest = hashlib.sha256(
        canonical_json(payload).encode("utf-8")
    ).hexdigest()
    return f"{namespace}:{digest}"


def issue(field: str, code: str, detail: str = "") -> ValidationIssue:
    return ValidationIssue(field=field, code=code, detail=detail)


def require_false(
    *,
    field: str,
    value: bool,
    issues: list[ValidationIssue],
) -> None:
    if value is not False:
        issues.append(issue(field, "must_remain_false"))


def require_true(
    *,
    field: str,
    value: bool,
    issues: list[ValidationIssue],
) -> None:
    if value is not True:
        issues.append(issue(field, "must_remain_true"))


def require_non_empty_text(
    *,
    field: str,
    value: str,
    issues: list[ValidationIssue],
) -> None:
    if not isinstance(value, str) or not value.strip():
        issues.append(issue(field, "required_non_empty_text"))


def require_unique_text_tuple(
    *,
    field: str,
    value: Sequence[str],
    issues: list[ValidationIssue],
    allow_empty: bool = False,
) -> None:
    items = tuple(value)
    if not allow_empty and not items:
        issues.append(issue(field, "required_non_empty_text_tuple"))
        return
    if any(not isinstance(item, str) or not item.strip() for item in items):
        issues.append(issue(field, "invalid_text_tuple"))
    if len(items) != len(set(items)):
        issues.append(issue(field, "duplicate_values"))
