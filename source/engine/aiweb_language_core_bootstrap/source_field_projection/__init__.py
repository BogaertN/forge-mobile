"""The schema id the grammar-operator registry cites.

The projection engine itself stays in BogaertN/forge. This module does not project a field,
bind a source, or authorize a write. A projection check refuses.
"""
from __future__ import annotations

from dataclasses import dataclass

from ..schema import ValidationReport, issue

SOURCE_FIELD_SCHEMA_ID = "aiweb-source-preserving-resonant-language-field-v1"


@dataclass(frozen=True, slots=True)
class SourceFieldProjectionRecord:
    source_field_schema_id: str = SOURCE_FIELD_SCHEMA_ID


def validate_source_field_projection(record: object) -> ValidationReport:
    del record
    return ValidationReport(
        schema_version="aiweb-language-core-source-field-projection-v1",
        ok=False,
        issues=(issue("projection", "projection_engine_not_in_this_port", "The source-field projection engine stays in BogaertN/forge."),),
    )
