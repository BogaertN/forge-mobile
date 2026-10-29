"""EchoForge debate as a language-core function. No model.

Citations, each one a Nic source. This module does not add a role, a frame,
or a decision the sources do not already name.

Concept lexicon and frames
  source/src/lexicon.js — Doc 4 concept ids and Doc 5 frames (FR.*.TR roles
  karta, karma; FR.SMELL.OF role vishaya). F.IS is the copula.
  BogaertN/forge aiweb_language_core_bootstrap/predicate_role_frame_registry/schema.py
  — Slice 38A: "LLM explanation is not predicate authority", "unknown predicate
  is not nearest known predicate", llm_allowed is false. The bootstrap registry
  does not assign roles. This function reads the phone Doc 4/5 slice; it does
  not claim the deferred Slice 38 population is installed.

Debate order
  BogaertN/echo-forge orchestrator.py conduct_debate_round — proponent, then
  opponent. generate_agent_response is the model call and is not ported.
  BogaertN/forge echoforge_advisory/runtime.py ROLE_INSTRUCTIONS keys
  "proponent" and "opponent", and the boundary that those roles have no Forge
  authority.

What a surviving claim is
  Contract 1g2034-K §7: a frame names who participates and the relation.
  Contract I1: a template may express a proven proposition; it may not choose it.
  Contract I2: an unfamiliar word is an uninterpreted symbol, not a refusal.
  The challenger objects only when a required role is empty, the proof is
  conflicted, a premise is quarantined, the conclusion adds a content word
  absent from the premises, or the drift disposition is not clean.
"""
from __future__ import annotations

import re
from typing import Any

# Doc 5 roles already used by lexicon.js DOC45 and FR.SMELL.OF. Not a new inventory.
ROLE_KARTA = "karta"
ROLE_KARMA = "karma"
ROLE_VISHAYA = "vishaya"

# lexicon.js F.IS surfaces and DOC45 frames, copied so the engine does not
# import the JS answer path. A concept id is not evidence (lexicon.js note).
COPULA_FRAME = {
    "id": "FR.BE.COP",
    "lemma": "is",
    "kind": "copula",
    "roles": [ROLE_KARTA, ROLE_KARMA],
    "cite": "source/src/lexicon.js F.IS; contract 1g2034-K §7 kāraka participants",
    "executes": False,
    "writes": False,
    "echo": False,
    "llm_allowed": False,
}
NEG_COPULA_FRAME = {
    "id": "FR.BE.NEG",
    "lemma": "is not",
    "kind": "copula",
    "roles": [ROLE_KARTA, ROLE_KARMA],
    "cite": "source/src/lexicon.js F.IS and F.NOT; contract 1g2034-K §5 explicit negative facts",
    "executes": False,
    "writes": False,
    "echo": False,
    "llm_allowed": False,
}
STATED_FRAME = {
    "id": "FR.STATED",
    "lemma": "stated",
    "kind": "evidence",
    "roles": [ROLE_VISHAYA],
    "cite": "source/src/lexicon.js FR.SMELL.OF role vishaya; contract 1g2034-K §4.2 fact atom",
    "executes": False,
    "writes": False,
    "echo": False,
    "llm_allowed": False,
}

# lexicon.js DOC45, the shipped Doc 4/5 slice. Same ids, lemmas, and roles.
DOC45_FRAMES = [
    {"id": "FR.MISPLACE.TR", "lemma": "misplace", "kind": "action", "roles": [ROLE_KARTA, ROLE_KARMA]},
    {"id": "FR.BANDAGE.TR", "lemma": "bandage", "kind": "action", "roles": [ROLE_KARTA, ROLE_KARMA]},
    {"id": "FR.PREHEAT.TR", "lemma": "preheat", "kind": "action", "roles": [ROLE_KARTA, ROLE_KARMA]},
    {"id": "FR.PREHEAT.INCH", "lemma": "preheat", "kind": "process", "roles": [ROLE_KARTA]},
    {"id": "FR.UNPLUG.TR", "lemma": "unplug", "kind": "action", "roles": [ROLE_KARTA, ROLE_KARMA]},
    {"id": "FR.MARINATE.TR", "lemma": "marinate", "kind": "action", "roles": [ROLE_KARTA, ROLE_KARMA]},
    {"id": "FR.SMELL.OF", "lemma": "smell", "kind": "process", "roles": [ROLE_KARTA, ROLE_VISHAYA]},
]
for _frame in DOC45_FRAMES:
    _frame.update({
        "cite": "source/src/lexicon.js DOC45; Doc 4 concept and Doc 5 frame",
        "executes": False,
        "writes": False,
        "echo": False,
        "llm_allowed": False,
    })

# Verbs that appear in the contract §2 sentences and in dream_idle.js ChristPing line.
# Unknown verbs are not mapped onto these (schema.py: unknown predicate is not nearest).
CLOSED_VERBS = ("is not", "is", "owns", "verifies", "remains", "initiates")

FRAMES = [COPULA_FRAME, NEG_COPULA_FRAME, STATED_FRAME] + DOC45_FRAMES


def frame_by_id(frame_id: str) -> dict[str, Any]:
    for frame in FRAMES:
        if frame["id"] == frame_id:
            return dict(frame)
    return dict(STATED_FRAME)


def frame_for_atom(atom: dict[str, Any]) -> dict[str, Any]:
    """Pick the Doc 5 frame for one atom. Do not guess a nearby lemma."""
    predicate = str(atom.get("predicate") or "")
    if predicate == "is" and atom.get("polarity") == "neg":
        return dict(NEG_COPULA_FRAME)
    if predicate == "is":
        return dict(COPULA_FRAME)
    for frame in DOC45_FRAMES:
        if frame["lemma"] == predicate:
            return dict(frame)
    if predicate in ("owns", "verifies", "remains", "initiates"):
        return {
            "id": "FR." + predicate.upper(),
            "lemma": predicate,
            "kind": "relation",
            "roles": [ROLE_KARTA, ROLE_KARMA],
            "cite": "contract 1g2034-K §2 verb in the ownership sentences, or dream_idle.js ChristPing sentence",
            "executes": False,
            "writes": False,
            "echo": False,
            "llm_allowed": False,
        }
    return dict(STATED_FRAME)


def uninterpreted_symbols(text: str, known_surfaces: set[str] | None = None) -> list[str]:
    """Contract I2. Words outside the closed frame lemmas stay symbols."""
    known = set(known_surfaces or ())
    known.update(CLOSED_VERBS)
    known.update(frame["lemma"] for frame in FRAMES)
    out = []
    for word in re.findall(r"[a-z0-9]+", str(text or "").lower()):
        if len(word) <= 2 or word in known:
            continue
        if word not in out:
            out.append(word)
    return out


def _fill_roles(frame: dict[str, Any], atom: dict[str, Any]) -> dict[str, str]:
    args = [str(a) for a in (atom.get("args") or [])]
    roles = list(frame.get("roles") or [])
    filled: dict[str, str] = {}
    if frame["id"] == "FR.STATED":
        filled[ROLE_VISHAYA] = " ".join(args) if args else str(atom.get("text") or "")
        return filled
    for i, role in enumerate(roles):
        if i < len(args) and args[i].strip():
            filled[role] = args[i]
    return filled


def run_debate(claim: dict[str, Any], *, content_tokens) -> dict[str, Any]:
    """Proponent then opponent, over evidence already in the proof.

    conduct_debate_round order. No generate_agent_response. The opponent
    objects; it does not write a new sentence.
    """
    atom = claim.get("atom") if isinstance(claim.get("atom"), dict) else {}
    frame = frame_for_atom(atom)
    filled = _fill_roles(frame, atom)
    missing = [role for role in frame.get("roles") or [] if not str(filled.get(role) or "").strip()]
    premise_tokens: set[str] = set()
    quarantined = False
    for premise in claim.get("premises") or []:
        if not isinstance(premise, dict):
            continue
        premise_tokens |= set(content_tokens(premise.get("text") or ""))
        if premise.get("quarantined") is True:
            quarantined = True
    conclusion_tokens = set(content_tokens(claim.get("text") or ""))
    overclaim = sorted(conclusion_tokens - premise_tokens)
    conflicted = claim.get("status") == "conflicted"
    drift = claim.get("drift") if isinstance(claim.get("drift"), dict) else {}
    drift_disposition = str(drift.get("disposition") or "")
    objections: list[dict[str, str]] = []
    if missing:
        objections.append({"code": "missing_role", "detail": ",".join(missing), "fatal": "true"})
    if conflicted:
        objections.append({"code": "conflicted", "detail": "both polarities derivable", "fatal": "true"})
    if quarantined:
        objections.append({"code": "quarantined_premise", "detail": "research.web or unverified receipt", "fatal": "true"})
    if overclaim:
        objections.append({"code": "overclaim", "detail": ",".join(overclaim), "fatal": "true"})
    if drift_disposition == "hard_stop":
        objections.append({"code": "hard_stop", "detail": str(drift.get("epsilon_s")), "fatal": "true"})
    if drift_disposition == "chi_quarantine":
        objections.append({"code": "chi_quarantine", "detail": str(drift.get("epsilon_s")), "fatal": "true"})
    if claim.get("checker_ok") is not True:
        objections.append({"code": "checker_rejected", "detail": str(claim.get("checker_reason") or ""), "fatal": "true"})
    fatal = [row for row in objections if row.get("fatal") == "true"]
    return {
        "function": "language_core_debate.run_debate",
        "order": ["proponent", "opponent"],
        "cite": [
            "BogaertN/echo-forge orchestrator.py conduct_debate_round",
            "BogaertN/forge echoforge_advisory/runtime.py ROLE_INSTRUCTIONS proponent, opponent",
            "source/src/lexicon.js Doc 4/5 frames",
            "contract 1g2034-K §7 and I1 and I2",
        ],
        "calls_llm": False,
        "model_invoked": False,
        "llm_allowed": False,
        "frame": {k: frame[k] for k in ("id", "lemma", "kind", "roles", "cite") if k in frame},
        "uninterpreted_symbols": uninterpreted_symbols(str(claim.get("text") or "")),
        "proponent": {
            "role": "proponent",
            "also_called": "proposer",
            "frame_id": frame["id"],
            "roles_filled": filled,
            "premise_ids": [p.get("id") for p in (claim.get("premises") or []) if isinstance(p, dict)],
            "authority": False,
        },
        "opponent": {
            "role": "opponent",
            "also_called": "challenger",
            "objections": objections,
            "authority": False,
        },
        "survived": len(fatal) == 0,
    }
