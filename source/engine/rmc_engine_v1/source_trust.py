"""Source trust for research.web. This is not recall.

A Wikipedia or Wikimedia host is low trust. The excerpt may point Gilligan
at a topic. It is not a premise and it is not proof. OpenStax (CC BY), US
government public-domain hosts, and a public-domain encyclopedia are trusted.
Host labels are read off the source fields. The body of the excerpt is not
searched.
"""
from __future__ import annotations

from typing import Any

# Host and provider marks. Checked against url, source, and provider fields.
LOW_MARKS = (
    "wikipedia.org",
    "wikimedia.org",
    "wikidata.org",
    "dbpedia.org",
    "wikisource.org",
    "conceptnet.io",
    "wikipedia_mediawiki",
)
TRUSTED_MARKS = (
    "openstax.org",
    "nasa.gov",
    "noaa.gov",
    "weather.gov",
    "usgs.gov",
    "nih.gov",
    "medlineplus.gov",
    "nlm.nih.gov",
    "cdc.gov",
    "nist.gov",
    "cia.gov",
    "gutenberg.org",
)
_FIELDS = (
    "url", "source_url", "source", "title", "provider", "search_provider",
    "host", "license_source", "contributor",
)


def _blob(row: dict[str, Any]) -> str:
    parts = []
    for key in _FIELDS:
        value = row.get(key)
        if value:
            parts.append(str(value))
    return " ".join(parts).lower()


def trust_tier(row: dict[str, Any] | None) -> str:
    """low, trusted, or unknown. Unknown research stays quarantined."""
    row = row if isinstance(row, dict) else {}
    explicit = str(row.get("trust") or "").strip().lower()
    if explicit in ("low", "trusted"):
        return explicit
    blob = _blob(row)
    if any(mark in blob for mark in LOW_MARKS):
        return "low"
    if any(mark in blob for mark in TRUSTED_MARKS):
        return "trusted"
    tier = str(row.get("tier") or row.get("state") or "").lower()
    if tier == "anchor":
        return "trusted"
    return "unknown"


def is_low_trust(row: dict[str, Any] | None) -> bool:
    return trust_tier(row) == "low"
