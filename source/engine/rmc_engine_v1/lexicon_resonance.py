"""Concept placement from the word-loop seed and the Phase Glyph Codex.

No regular expressions. A token is a run of letters. A concept is placed
when one of its surfaces is a seed word (medium signal). A concept with no
seed word is placed by the letter-pulse resultant (weak signal). Letter
placement does not claim the lawful εₙ = 0 lock.

The letter-to-phase map is the Phase Parsing Engine v0.1 Keystroke Phase
Interpreter. It is not the HarperScript visual manifest. Nic 4.9.191 states
θ = (Φ−1)·40°, which is ((n−1)/9)·2π. Numeric μ stays unspecified unless the
word row is tagged "proposal v1" and carries both numbers.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

REFERENCE = Path(__file__).resolve().parent / "reference"
ENGINE = Path(__file__).resolve().parent
DOC_RPMC = "1G-Yj323feeMBklm6sENdawfBBTC1VfdL4slIGtoFRxE"
DOC_CODEX = "1xZWOfEFgYMn10XQtUOyQOQCCIaOwqfTEIcM-bgRHkjk"
DOC_ALGEBRA = "1RoAxjzV9rbxMxbE2Wu-R728O0J3J4W3s6J4lKlkbqzQ"

PAPER_CONSTANTS = {
    "phi_to_angle": {
        "status": "stated",
        "formula": "θ=(Φ−1)·40°",
        "degrees": 40,
        "cite": (
            "Nic 4.9.191. θ=(Φ−1)·40°. 40° = 2π/9, so the radian form is "
            "((n−1)/9)·2π. RPMC §1.4, the Glyph Codex, and Unified Algebra do not state this angle."
        ),
    },
    "epsilon_lawful": {
        "value": 0,
        "status": "stated",
        "cite": (
            "RPMC " + DOC_RPMC + ": εₙ = 0 for a lawful phase-locked transition, "
            "and εₙ > 0 for drift, projection, or echo loss."
        ),
    },
    "mu": {"value": "unspecified", "status": "unspecified", "cite": "No numeric μ in RPMC §1.4, the Glyph Codex, or Unified Algebra."},
    "integrity_example": {
        "codex_octave_lift": 1.0,
        "cite": "Glyph Codex octave lift requires loop.integrity_score >= 1.00. C_min stays 0.87.",
        "C_min": 0.87,
    },
    "docs": {"rpmc": DOC_RPMC, "codex": DOC_CODEX, "algebra": DOC_ALGEBRA},
}

_CACHE: dict[str, Any] | None = None


def _read_json(path: Path, default: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def _read_jsonl(path: Path) -> list[dict]:
    rows = []
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            obj = json.loads(line)
            if isinstance(obj, dict):
                rows.append(obj)
    except Exception:
        return rows
    return rows


def tokens(text: str) -> list[str]:
    """Letter runs only. Apostrophe and hyphen stay inside a token. No regex."""
    out: list[str] = []
    buf: list[str] = []
    for ch in str(text or "").lower():
        if ch.isalpha() or ch in {"'", "-"}:
            buf.append(ch)
        elif buf:
            word = "".join(buf).strip("'-")
            if word:
                out.append(word)
            buf = []
    if buf:
        word = "".join(buf).strip("'-")
        if word:
            out.append(word)
    return out


def _angle(index: int) -> float:
    """Nic 4.9.191: θ = (Φ−1)·40° = ((n−1)/9)·2π."""
    return ((index - 1) / 9.0) * math.tau


PROPOSAL_TAG = "proposal v1"


def proposal_charge(row: dict | None) -> dict[str, Any] | None:
    """ε and μ from a word row apply only when that row is tagged proposal v1.

    A tag without both numbers stays unspecified. Untagged rows return None
    and keep the lawful εₙ = 0 lock or the letter-placement unspecified ε.
    """
    if not isinstance(row, dict):
        return None
    blob = " ".join(str(row.get(key) or "") for key in ("tag", "status", "family", "notes", "authority"))
    if PROPOSAL_TAG not in blob:
        return None
    eps = row.get("eps", row.get("epsilon"))
    mu = row.get("mu")
    numeric = isinstance(eps, (int, float)) and not isinstance(eps, bool) and isinstance(mu, (int, float)) and not isinstance(mu, bool)
    if numeric:
        return {"tagged": True, "eps": eps, "mu": mu, "status": "stated"}
    return {"tagged": True, "eps": "unspecified", "mu": "unspecified", "status": "tagged_without_numbers"}


def resultant(indexes: list[int]) -> tuple[int | None, str]:
    if not indexes:
        return None, "none"
    counts: dict[int, int] = {}
    for n in indexes:
        counts[n] = counts.get(n, 0) + 1
    ranked = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    if len(ranked) == 1 or ranked[0][1] > ranked[1][1]:
        return ranked[0][0], "mode"
    ang = [_angle(n) for n in indexes]
    mean = math.atan2(sum(math.sin(a) for a in ang), sum(math.cos(a) for a in ang)) % math.tau
    best, gap = None, 1e9
    for n in range(1, 10):
        raw = abs(_angle(n) - mean)
        dist = min(raw, math.tau - raw)
        if dist < gap - 1e-12 or (abs(dist - gap) < 1e-12 and (best is None or n < best)):
            gap, best = dist, n
    return best, "circular_mean"


def _load() -> dict[str, Any]:
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    words = {}
    for row in _read_jsonl(REFERENCE / "word_loop_seed_lexicon_v1.jsonl"):
        word = str(row.get("word") or "").lower()
        if word:
            words[word] = row
    letter_file = _read_json(REFERENCE / "letter_phase_map_v1.json", {})
    letters = letter_file.get("letters") or {}
    letter_authority = {
        "map_authority": letter_file.get("map_authority") or "Phase Parsing Engine",
        "not_map_authority": letter_file.get("not_map_authority") or "HarperScript",
        "cite": letter_file.get("cite") or "",
        "signal": "weak_letter_signal",
    }
    codex = _read_json(REFERENCE / "phase_codex_v2_5.json", {})
    phases = codex.get("phases") if isinstance(codex.get("phases"), dict) else {}
    flags = _read_json(REFERENCE / "phase_drift_flags_v2_5.json", {})
    lexicon = _read_json(ENGINE / "concept_lexicon.json", {})
    extra = _read_json(ENGINE / "anchor_concepts.json", {})
    surfaces = {str(k).lower(): str(v) for k, v in (lexicon.get("surfaces") or {}).items()}
    categories = {str(k): str(v) for k, v in (lexicon.get("categories") or {}).items()}
    for word, cid in (extra.get("concepts") or {}).items():
        surfaces.setdefault(str(word).lower(), str(cid))
        categories.setdefault(str(cid), "anchor")
    by_concept: dict[str, list[str]] = {}
    for word, cid in surfaces.items():
        by_concept.setdefault(cid, []).append(word)
    packets = {}
    for cid, surfs in by_concept.items():
        packets[cid] = _place(cid, surfs, words, letters, phases, flags, categories.get(cid, ""), letter_authority)
    _CACHE = {
        "words": words,
        "letters": letters,
        "letter_authority": letter_authority,
        "phases": phases,
        "surfaces": surfaces,
        "categories": categories,
        "by_concept": by_concept,
        "packets": packets,
    }
    return _CACHE


def _place(cid, surfaces, words, letters, phases, flags, category, letter_authority) -> dict[str, Any]:
    hits = []
    charges = []
    for surface in surfaces:
        row = words.get(surface)
        if not row:
            continue
        charged = proposal_charge(row)
        if charged and charged["status"] == "stated":
            charges.append(charged)
        phase = row.get("phase")
        if isinstance(phase, list):
            continue
        phase = str(phase or "")
        if len(phase) == 2 and phase[1] in "123456789":
            hits.append({"word": surface, "phase": int(phase[1]), "operator": row.get("operator")})
    if hits:
        phi, how = resultant([h["phase"] for h in hits])
        authority = "medium_word_signal"
        eps, eps_status = 0, "stated_lawful_phase_lock"
        cite = sorted({h["word"] for h in hits})
    else:
        surface = sorted(surfaces, key=lambda s: (len(s), s))[0] if surfaces else ""
        cited = []
        indexes = []
        for ch in surface.upper():
            spec = letters.get(ch) if isinstance(letters, dict) else None
            if not isinstance(spec, dict):
                continue
            phase = str(spec.get("phase") or "")
            if len(phase) == 2 and phase[1] in "123456789":
                indexes.append(int(phase[1]))
                cited.append(ch + ":" + phase)
        phi, how = resultant(indexes)
        authority = "weak_letter_signal" if phi else "unspecified"
        eps, eps_status = "unspecified", "unspecified"
        cite = cited
    mu, mu_status = "unspecified", "unspecified"
    proposal_status = "not_tagged"
    if charges:
        eps, mu = charges[0]["eps"], charges[0]["mu"]
        eps_status = mu_status = proposal_status = "stated_proposal_v1"
    profile = phases.get("Φ" + str(phi), {}) if phi else {}
    flag = flags.get("Φ" + str(phi)) if phi else None
    return {
        "concept": cid,
        "category": category,
        "Phi": phi,
        "glyph": profile.get("glyph") or "",
        "code_id": profile.get("code_identifier") or "",
        "name": profile.get("phase_name") or "",
        "band": profile.get("harmonic_frequency") or "unspecified",
        "state": profile.get("state_signature") or "",
        "drift_flag": flag if flag else "unspecified",
        "eps": eps,
        "eps_status": eps_status,
        "mu": mu,
        "mu_status": mu_status,
        "proposal_v1": proposal_status,
        "authority": authority,
        "map_authority": letter_authority.get("map_authority"),
        "not_map_authority": letter_authority.get("not_map_authority"),
        "how": how,
        "cite": cite,
        "angle_status": "stated",
        "angle": "θ=(Φ−1)·40°",
        "calls_llm": False,
    }


def packets() -> dict[str, dict]:
    return _load()["packets"]


def packet(cid: str) -> dict[str, Any] | None:
    return packets().get(str(cid))


def _function(cid: str) -> bool:
    cat = _load()["categories"].get(cid, "")
    return cid.startswith("F.") or cid.startswith("I.") or cat in {"function", "social"}


def concepts_in(text: str) -> list[str]:
    found = []
    seen = set()
    surfaces = _load()["surfaces"]
    for token in tokens(text):
        cid = surfaces.get(token)
        if not cid or cid in seen or _function(cid):
            continue
        seen.add(cid)
        found.append(cid)
    return found


def primary_concept(text: str) -> str | None:
    surfaces = _load()["surfaces"]
    found = []
    for token in tokens(text):
        cid = surfaces.get(token)
        if not cid or _function(cid):
            continue
        anchor = 0 if cid.startswith("A.") else 1
        found.append((anchor, -len(token), cid))
    if not found:
        return None
    found.sort()
    return found[0][2]


def concept_in_text(cid: str, text: str) -> bool:
    return cid in concepts_in(text)


def phase_tag(phi: int | None) -> list[str]:
    if not isinstance(phi, int) or not 1 <= phi <= 9:
        return []
    # Codex: naming keeps a prior correction, and projection requires both.
    # The concept phase is the last tag. The set is shared by the question and the fact.
    if phi == 8:
        return ["Φ6", "Φ7", "Φ8"]
    if phi == 7:
        return ["Φ6", "Φ7"]
    return ["Φ" + str(phi)]


def parser_primary(text: str) -> str | None:
    from rmc_engine_v1.phase_parser import parse_phase
    state = (parse_phase(text) or {}).get("phase_state") or {}
    primary = state.get("phase_primary")
    return str(primary) if primary else None


def replaces_keyword_phase(text: str) -> dict[str, Any] | None:
    """The why-keyword phase Φ4 is not a hand-set fact phase.

    A content concept replaces that keyword phase. Other questions keep the
    parser phase so a stored Φ1 fact still phase-matches.
    """
    if parser_primary(text) != "Φ4":
        return None
    return question_phase(text)


def question_phase(text: str) -> dict[str, Any] | None:
    cid = primary_concept(text)
    if not cid:
        return None
    row = packet(cid)
    if not row or not row.get("Phi"):
        return None
    return {"concept": cid, "packet": row, "tags": phase_tag(row["Phi"])}


def apply_lexicon_phase(report: dict[str, Any] | None, text: str) -> dict[str, Any]:
    """Replace a keyword phase path with the concept packet. Drift analysis should see the parser report first."""
    report = report if isinstance(report, dict) else {}
    placed = replaces_keyword_phase(text)
    state = report.get("phase_state") if isinstance(report.get("phase_state"), dict) else {}
    state = dict(state)
    if not placed:
        report = dict(report)
        report["phase_state"] = state
        return report
    tags = placed["tags"]
    state["parser_phase_primary"] = state.get("phase_primary")
    state["parser_phase_path"] = list(state.get("phase_path_hypothesis") or [])
    state["phase_primary"] = tags[-1]
    state["phase_path_hypothesis"] = list(tags)
    state["token_boundary_mode"] = "lexicon_resonance"
    state["lexicon_placement"] = {
        "concept": placed["concept"],
        "Phi": placed["packet"]["Phi"],
        "glyph": placed["packet"]["glyph"],
        "eps": placed["packet"]["eps"],
        "mu": placed["packet"]["mu"],
        "authority": placed["packet"]["authority"],
        "cite": placed["packet"]["cite"],
        "drift_flag": placed["packet"]["drift_flag"],
        "calls_llm": False,
    }
    report = dict(report)
    report["phase_state"] = state
    return report


def word_count() -> int:
    return len(_load()["words"])


def proposal_v1_count() -> int:
    return sum(1 for row in _load()["words"].values() if proposal_charge(row))


def letter_map_authority() -> dict[str, Any]:
    return dict(_load()["letter_authority"])
