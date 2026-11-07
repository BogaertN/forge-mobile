"""World model v1: Observe, Derive and Simulate (4.9.243 causal forward-chain).

Citations
  Spec 1vBx_Q9K §1.4 — Observe(W_v, E), Derive(W_v, R, Q), Simulate(W_v, R, H, Q).
  Contract 1g2034-K §2 — who owns interpretation, world state, orchestration.
  Contract §4.2 TurnWorld/v1 and §4.3 Proof/v1.
  Contract §5 — finite forward derivation, four-valued result, no explosion.
  Contract §6 — pipeline, including an independent proof replay.
  Contract §7 — simple positive and negative facts.
  Contract §8 — tool output is evidence until admitted. No durable write (I4).
  Contract §10 and source/src/reason.js LIMITS — the bounds already in the phone.
  Contract §13 / plan 229 step 12 — Simulate forward-chains stored causal frames (bounded); predictions are never facts.
  Spec §3.7 and §4.7 — a new observation can supersede; the parent root stays.
  source/engine/rmc_engine_v1/mobile_config.py — C_min 0.87, quarantine 0.35, hard stop 0.80.
  source/engine/rmc_engine_v1/chi_correction_gate.py evaluate_chi_t — χ(t) record.
  source/src/dream_idle.js — only Gilligan initiates ChristPing. This module does not.
  source/engine/rmc_engine_v1/measurement_kernel.py — epsilon and coherence, unchanged.

Derive does not change those formulas and does not write durable memory.
"""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from rmc_engine_v1.chi_correction_gate import evaluate_chi_t
from rmc_engine_v1.language_core_debate import CLOSED_VERBS, run_debate
from rmc_engine_v1.measurement_kernel import coherence_components, measure_candidate
from rmc_engine_v1.mobile_config import THRESHOLDS

# source/src/reason.js LIMITS. Contract §10 requires the slice to enforce bounds.
# These are the bounds already in the phone world path, not a new table.
LIMITS = {
    "MAX_INPUT_CHARS": 100000,
    "MAX_SENTENCES": 24,
    "MAX_ENTITIES": 256,
    "MAX_FACTS": 96,
    "MAX_RULES": 48,
    "MAX_DERIVATIONS": 192,
    "MAX_ROUNDS": 16,
    "MAX_PROOF_DEPTH": 64,
    "MAX_PROOF_STEPS": 160,
    "cite": "source/src/reason.js LIMITS; contract 1g2034-K §10",
}

# Contract §2 sentences, stored as atoms so Observe can supersede them (§4.7).
# The text is the contract sentence, shortened only by taking its first clause.
SELF_FACTS = [
    {
        "id": "self:language-core",
        "subject": "Pāṇinian Language Core",
        "predicate": "owns",
        "args": ["Pāṇinian Language Core", "linguistic interpretation"],
        "text": "Pāṇinian Language Core owns linguistic interpretation.",
        "cite": "contract 1g2034-K §2",
    },
    {
        "id": "self:world-model",
        "subject": "World Model",
        "predicate": "owns",
        "args": ["World Model", "world state and inference"],
        "text": "World Model owns world state and inference.",
        "cite": "contract 1g2034-K §2",
    },
    {
        "id": "self:rmc",
        "subject": "Recursive Manifest Compiler",
        "predicate": "owns",
        "args": ["Recursive Manifest Compiler", "cognitive orchestration"],
        "text": "Recursive Manifest Compiler owns cognitive orchestration.",
        "cite": "contract 1g2034-K §2",
    },
    {
        "id": "self:forge",
        "subject": "Forge",
        "predicate": "owns",
        "args": ["Forge", "authority, permissions, execution, persistence, and presentation"],
        "text": "Forge owns authority, permissions, execution, persistence, and presentation.",
        "cite": "contract 1g2034-K §2",
    },
    {
        "id": "self:echo",
        "subject": "Echo",
        "predicate": "verifies",
        "args": ["Echo", "semantic fidelity between the selected symbolic result and its rendering"],
        "text": "Echo verifies semantic fidelity between the selected symbolic result and its rendering.",
        "cite": "contract 1g2034-K §2",
    },
    {
        "id": "self:echoforge",
        "subject": "EchoForge",
        "predicate": "remains",
        "args": ["EchoForge", "a separate component"],
        "text": "EchoForge remains a separate component.",
        "cite": "contract 1g2034-K §2",
    },
    {
        "id": "self:christping",
        "subject": "Gilligan",
        "predicate": "initiates",
        "args": ["Gilligan", "ChristPing"],
        "text": "Only Gilligan initiates ChristPing.",
        "cite": "source/src/dream_idle.js; Gilligan Agent Core 1HSjAk6UY",
    },
]

# 4.9.241 (plan 229 step 10): there are no canned chat sentences. A question about the kernel is answered from its
# self-facts (src/selfmodel.js FACTS, stored clauses sent as memory.self) through the same frame, Derive, compile and Echo
# path as any fact; a greeting is answered by the reciprocal greeting the question itself carries (language core).

# Locative enclosure. "inside" and "within" are PP predicates of enclosure, and the verb "contain" is the
# same relation from the container. Bare "in" is not this relation: the grammar uses it for location and
# membership as well as enclosure ("Paris is in France", "in the club"), and an idiom ("interested in") is an adjunct.
CONTAIN_PREPS = frozenset({"inside", "within"})

# Contract §5: one range-restricted copula rule. Head variables occur in the body.
COPULA_RULE = {
    "id": "WM-COPULA-CHAIN",
    "class": "forward_chain",
    "cite": "contract 1g2034-K §5 bounded multi-hop forward derivation; §7 simple positive facts",
    "body": [
        {"predicate": "is", "args": ["$x", "$y"], "polarity": "pos"},
        {"predicate": "is", "args": ["$y", "$z"], "polarity": "pos"},
    ],
    "head": {"predicate": "is", "args": ["$x", "$z"], "polarity": "pos"},
    "guard": "distinct $x $z",
}

# Geographic inclusion is copular "in" only when the phone grammar filed both names as lexicon locations
# (noun.location). It is not enclosure and it is not every "in". Residence is the verb live plus adhikarana "in".
GEO_RULE = {
    "id": "WM-GEO-CHAIN",
    "class": "forward_chain",
    "cite": "4.9.249: geo(place, region) chains only for lexicon locations. Bare in is not this relation.",
    "body": [
        {"predicate": "geo", "args": ["$x", "$y"], "polarity": "pos"},
        {"predicate": "geo", "args": ["$y", "$z"], "polarity": "pos"},
    ],
    "head": {"predicate": "geo", "args": ["$x", "$z"], "polarity": "pos"},
    "guard": "distinct $x $z",
}
# A resident of a place lives in a region that place is geographically in. Residence does not run backwards,
# and a geographic fact does not by itself say that someone lives anywhere.
# "X is part of Y" is the noun complement the grammar already parses (head part, of-phrase Y).
# It is not enclosure and not every of-phrase ("the name of my dog").
# "X is an ancestor of Y" is its own nominal. It is not part-of and not containment.
ANCESTOR_RULE = {
    "id": "WM-ANCESTOR-CHAIN",
    "class": "forward_chain",
    "cite": "4.9.249: ancestor(ancestor, person) chains. It is not part-of and it does not run backwards.",
    "body": [
        {"predicate": "ancestor", "args": ["$x", "$y"], "polarity": "pos"},
        {"predicate": "ancestor", "args": ["$y", "$z"], "polarity": "pos"},
    ],
    "head": {"predicate": "ancestor", "args": ["$x", "$z"], "polarity": "pos"},
    "guard": "distinct $x $z",
}
# The declared inverse: ancestor(x, y) is descendant(y, x). One direction, not a symmetric reading.
ANCESTOR_INVERSE = {
    "id": "WM-ANCESTOR-INVERSE",
    "class": "forward_chain",
    "cite": "4.9.249: descendant is the inverse of ancestor. The proof cites the ancestor fact.",
    "body": [{"predicate": "ancestor", "args": ["$x", "$y"], "polarity": "pos"}],
    "head": {"predicate": "descendant", "args": ["$y", "$x"], "polarity": "pos"},
    "guard": "distinct $x $y",
}
# descendant(x, y) chains in that same direction. The inverse is ancestor(y, x), never another descendant.
DESCENDANT_RULE = {
    "id": "WM-DESCENDANT-CHAIN",
    "class": "forward_chain",
    "cite": "4.9.249: descendant(descendant, ancestor) chains. It is not parent-of and it does not run backwards.",
    "body": [
        {"predicate": "descendant", "args": ["$x", "$y"], "polarity": "pos"},
        {"predicate": "descendant", "args": ["$y", "$z"], "polarity": "pos"},
    ],
    "head": {"predicate": "descendant", "args": ["$x", "$z"], "polarity": "pos"},
    "guard": "distinct $x $z",
}
DESCENDANT_INVERSE = {
    "id": "WM-DESCENDANT-INVERSE",
    "class": "forward_chain",
    "cite": "4.9.249: ancestor is the inverse of descendant. The person in the of-phrase is the ancestor.",
    "body": [{"predicate": "descendant", "args": ["$x", "$y"], "polarity": "pos"}],
    "head": {"predicate": "ancestor", "args": ["$y", "$x"], "polarity": "pos"},
    "guard": "distinct $x $y",
}
# parent(parent, child) is child(child, parent). A parent's parent is not a parent. The table does not license ancestor.
PARENT_INVERSE = {
    "id": "WM-PARENT-INVERSE",
    "class": "forward_chain",
    "cite": "4.9.249: child is the inverse of parent. Parent is not transitive.",
    "body": [{"predicate": "parent", "args": ["$x", "$y"], "polarity": "pos"}],
    "head": {"predicate": "child", "args": ["$y", "$x"], "polarity": "pos"},
    "guard": "distinct $x $y",
}
CHILD_INVERSE = {
    "id": "WM-CHILD-INVERSE",
    "class": "forward_chain",
    "cite": "4.9.249: parent is the inverse of child. Child is not transitive.",
    "body": [{"predicate": "child", "args": ["$x", "$y"], "polarity": "pos"}],
    "head": {"predicate": "parent", "args": ["$y", "$x"], "polarity": "pos"},
    "guard": "distinct $x $y",
}
# The relation table marks these four symmetric and not transitive. A shared spouse or sibling licenses nothing further.
def _symmetric_rule(pred: str, cite: str) -> dict[str, Any]:
    return {
        "id": "WM-" + pred.upper() + "-SYMMETRIC",
        "class": "forward_chain",
        "cite": cite,
        "body": [{"predicate": pred, "args": ["$x", "$y"], "polarity": "pos"}],
        "head": {"predicate": pred, "args": ["$y", "$x"], "polarity": "pos"},
        "guard": "distinct $x $y",
    }
MARRIED_SYMMETRIC = _symmetric_rule("married", "4.9.249: married_to is symmetric. It is not transitive and a shared spouse is not a spouse.")
NEXT_SYMMETRIC = _symmetric_rule("next", "4.9.249: next_to is symmetric. The to-complement stays on the adjective. It is not transitive.")
ADJACENT_SYMMETRIC = _symmetric_rule("adjacent", "4.9.249: adjacent_to is symmetric. It is not transitive.")
SIBLING_SYMMETRIC = _symmetric_rule("sibling", "4.9.249: sibling_of is symmetric. A sibling of a sibling is not a sibling.")
SYMMETRIC_RULES = (MARRIED_SYMMETRIC, NEXT_SYMMETRIC, ADJACENT_SYMMETRIC, SIBLING_SYMMETRIC)
# Shipped next_to is not transitive. An adopted manifest may flip that one cell; the guard must see the flip.
NEXT_CHAIN = {
    "id": "WM-NEXT-CHAIN",
    "class": "forward_chain",
    "cite": "4.9.249: next_to chains only when the active relation row says it is transitive. The shipped row does not.",
    "body": [
        {"predicate": "next", "args": ["$x", "$y"], "polarity": "pos"},
        {"predicate": "next", "args": ["$y", "$z"], "polarity": "pos"},
    ],
    "head": {"predicate": "next", "args": ["$x", "$z"], "polarity": "pos"},
    "guard": "distinct $x $z",
}
# before/after are the grammar's kala pair. above/below are the vertical adhikarana pair. They do not cross.
def _order_rule(pred: str, inv: str, domain: str) -> tuple[dict[str, Any], dict[str, Any]]:
    chain = {
        "id": "WM-" + pred.upper() + "-CHAIN",
        "class": "forward_chain",
        "cite": "4.9.249: " + pred + " chains as that preposition when the active row says it is transitive, and only with the same qualifiers. The copular frame does not mark a time, sequence, rank, or quantity sense.",
        "body": [
            {"predicate": pred, "args": ["$x", "$y"], "polarity": "pos"},
            {"predicate": pred, "args": ["$y", "$z"], "polarity": "pos"},
        ],
        "head": {"predicate": pred, "args": ["$x", "$z"], "polarity": "pos"},
        "guard": "distinct $x $z",
        "domain": domain,
    }
    inverse = {
        "id": "WM-" + pred.upper() + "-INVERSE",
        "class": "forward_chain",
        "cite": "4.9.249: " + inv + " is the declared inverse of the preposition " + pred + ". It does not assign a sense the frame did not mark.",
        "body": [{"predicate": pred, "args": ["$x", "$y"], "polarity": "pos"}],
        "head": {"predicate": inv, "args": ["$y", "$x"], "polarity": "pos"},
        "guard": "distinct $x $y",
        "domain": domain,
    }
    return chain, inverse
ORDER_RULES = []
ORDER_CHAIN: dict[str, dict[str, Any]] = {}
ORDER_INVERSE: dict[str, dict[str, Any]] = {}
for _pred, _inv, _domain in (("before", "after", "kala"), ("after", "before", "kala"), ("above", "below", "space"), ("below", "above", "space")):
    _chain, _inverse = _order_rule(_pred, _inv, _domain)
    ORDER_RULES.extend((_chain, _inverse))
    ORDER_CHAIN[_pred] = _chain
    ORDER_INVERSE[_pred] = _inverse
# Each pair is its own dimension. A height atom never chains with age or magnitude.
# heavier/wider/higher/deeper/longer stay untyped: the original rows that need them stay unmet.
CMP_DIM = {"older_than": "age", "younger_than": "age", "greater_than": "magnitude", "less_than": "magnitude", "taller_than": "height", "shorter_than": "height"}
CMP_INVERSE = {"older_than": "younger_than", "younger_than": "older_than", "greater_than": "less_than", "less_than": "greater_than", "taller_than": "shorter_than", "shorter_than": "taller_than"}
# Each declared word's antonym is also a declared word of the inverse row.
CMP_SURFACE_INVERSE = {"older": "younger", "younger": "older", "greater": "less", "less": "greater", "more": "fewer", "fewer": "more", "larger": "smaller", "smaller": "larger", "taller": "shorter", "shorter": "taller"}
CMP_RULES: list[dict[str, Any]] = []
CMP_CHAIN: dict[str, dict[str, Any]] = {}
CMP_INV_RULE: dict[str, dict[str, Any]] = {}
CMP_ASYM: dict[str, dict[str, Any]] = {}
CMP_EXCL: dict[str, dict[str, Any]] = {}
for _pred, _inv in CMP_INVERSE.items():
    _chain = {"id": "WM-" + _pred.upper() + "-CHAIN", "class": "forward_chain", "cite": "4.9.249: " + _pred + " chains inside " + CMP_DIM[_pred] + " only.", "body": [{"predicate": _pred, "args": ["$x", "$y"], "polarity": "pos"}, {"predicate": _pred, "args": ["$y", "$z"], "polarity": "pos"}], "head": {"predicate": _pred, "args": ["$x", "$z"], "polarity": "pos"}, "guard": "distinct $x $z"}
    _inverse = {"id": "WM-" + _pred.upper() + "-INVERSE", "class": "forward_chain", "cite": "4.9.249: " + _inv + " is the inverse of " + _pred + ". It is not another dimension.", "body": [{"predicate": _pred, "args": ["$x", "$y"], "polarity": "pos"}], "head": {"predicate": _inv, "args": ["$y", "$x"], "polarity": "pos"}, "guard": "distinct $x $y"}
    _asym = {"id": "WM-" + _pred.upper() + "-ASYM", "class": "forward_chain", "cite": "4.9.249: " + _pred + " is asymmetric. The swapped pair is not the same comparison.", "body": [{"predicate": _pred, "args": ["$x", "$y"], "polarity": "pos"}], "head": {"predicate": _pred, "args": ["$y", "$x"], "polarity": "neg"}, "guard": "distinct $x $y"}
    _excl = {"id": "WM-" + _pred.upper() + "-EXCLUDES", "class": "forward_chain", "cite": "4.9.249: " + _pred + " excludes " + _inv + " on the same two arguments. It is the same dimension.", "body": [{"predicate": _pred, "args": ["$x", "$y"], "polarity": "pos"}], "head": {"predicate": _inv, "args": ["$x", "$y"], "polarity": "neg"}, "guard": "distinct $x $y"}
    CMP_RULES.extend((_chain, _inverse, _asym, _excl))
    CMP_CHAIN[_pred] = _chain
    CMP_INV_RULE[_pred] = _inverse
    CMP_ASYM[_pred] = _asym
    CMP_EXCL[_pred] = _excl

PART_RULE = {
    "id": "WM-PART-CHAIN",
    "class": "forward_chain",
    "cite": "4.9.249: part(part, whole) chains. It is not containment and it is not symmetric.",
    "body": [
        {"predicate": "part", "args": ["$x", "$y"], "polarity": "pos"},
        {"predicate": "part", "args": ["$y", "$z"], "polarity": "pos"},
    ],
    "head": {"predicate": "part", "args": ["$x", "$z"], "polarity": "pos"},
    "guard": "distinct $x $z",
}

LIVE_RULE = {
    "id": "WM-LIVE-GEO",
    "class": "forward_chain",
    "cite": "4.9.249: live(person, place) and geo(place, region) conclude live(person, region).",
    "body": [
        {"predicate": "live", "args": ["$x", "$y"], "polarity": "pos"},
        {"predicate": "geo", "args": ["$y", "$z"], "polarity": "pos"},
    ],
    "head": {"predicate": "live", "args": ["$x", "$z"], "polarity": "pos"},
    "guard": "distinct $x $z",
}

# One containment rule on the same unifier. in(content, container) chains forward. It is not symmetric.
CONTAIN_RULE = {
    "id": "WM-CONTAIN-CHAIN",
    "class": "forward_chain",
    "cite": "4.9.249: inside/within and the verb contain are in(content, container). Bare in is not enclosure.",
    "body": [
        {"predicate": "in", "args": ["$x", "$y"], "polarity": "pos"},
        {"predicate": "in", "args": ["$y", "$z"], "polarity": "pos"},
    ],
    "head": {"predicate": "in", "args": ["$x", "$z"], "polarity": "pos"},
    "guard": "distinct $x $z",
}

# 4.9.236: one relational rule over a stored identity. "my dog is Rex" (a possessive copula) gives owns(I, Rex).
# The checker replays it by reading the possessor off the premise (derive_frame.possessor); nothing is assumed.
OWNER_RULE = {
    "id": "WM-OWNER-OF",
    "class": "relational",
    "cite": "4.9.236 Nic: model the operation, not the question; a possessive identity names its owner",
    "body": [{"predicate": "is", "args": ["$owned", "$n"], "polarity": "pos"}],
    "head": {"predicate": "owns", "args": ["$o", "$n"], "polarity": "pos"},
    "guard": "possessor($owned) = $o",
}

# 4.9.236: the relational-noun rule as a replayed step. "X is N" with N a proper name gives "X's name is N".
NAME_RULE = {
    "id": "WM-NAME-OF",
    "class": "relational",
    "cite": "4.9.233 WM-NAME-OF, replayed from 4.9.236",
    "body": [{"predicate": "is", "args": ["$x", "$n"], "polarity": "pos"}],
    "head": {"predicate": "is", "args": ["$x's name", "$n"], "polarity": "pos"},
    "guard": "$n is a proper name",
}

# 4.9.243 (plan 229 step 12): causal forward-chain rule shells. Content comes from stored/admitted causal frames
# (cause_effect.parse_clause); Simulate unifies the intervention with those frames. Checker replays by re-running
# the bounded forward-chain — not a bottle special case.
CAUSAL_RULE_IDS = ("WM-CAUSES-APPLY", "WM-IF-THEN-APPLY", "WM-MAKES-APPLY", "WM-SIMULATE", "WM-SOLVER-RECEIPT")
CAUSES_RULE = {
    "id": "WM-CAUSES-APPLY",
    "class": "causal_forward",
    "cite": "4.9.243 plan 229 step 12; cause_effect.forward_chain",
    "body": [{"predicate": "causes", "args": ["$cause", "$effect"], "polarity": "pos"}],
    "head": {"predicate": "holds", "args": ["$effect"], "polarity": "pos"},
    "guard": "intervention_or_held($cause)",
}
IF_THEN_RULE = {
    "id": "WM-IF-THEN-APPLY",
    "class": "causal_forward",
    "cite": "4.9.243 plan 229 step 12; cause_effect.forward_chain",
    "body": [{"predicate": "if_then", "args": ["$ant", "$cons"], "polarity": "pos"}],
    "head": {"predicate": "holds", "args": ["$cons"], "polarity": "pos"},
    "guard": "intervention_or_held($ant)",
}
MAKES_RULE = {
    "id": "WM-MAKES-APPLY",
    "class": "causal_forward",
    "cite": "4.9.243 plan 229 step 12; cause_effect.forward_chain",
    "body": [{"predicate": "makes", "args": ["$action", "$effect"], "polarity": "pos"}],
    "head": {"predicate": "holds", "args": ["$effect"], "polarity": "pos"},
    "guard": "intervention_unifies_action_and_state",
}

# 4.9.244 (plan 229 step 12b): a Simulation Router receipt for this exact intervention states the measured effect.
SOLVER_RULE = {
    "id": "WM-SOLVER-RECEIPT",
    "class": "causal_forward",
    "cite": "4.9.244 plan 229 step 12b; server/sim_router (MuJoCo / SymPy) receipt FORGE-SIM-RECEIPT/v1",
    "body": [{"predicate": "makes", "args": ["$intervention", "$effect"], "polarity": "pos"}],
    "head": {"predicate": "holds", "args": ["$effect"], "polarity": "pos"},
    "guard": "receipt_sha256_and_intervention_key_match",
}

_STOP = {
    "the", "and", "for", "with", "from", "that", "this", "what", "which", "when",
    "where", "who", "whom", "why", "how", "are", "was", "were", "you", "your",
    "does", "did", "can", "could", "into", "about", "have", "has", "not", "but",
}


def content_tokens(text: str) -> set[str]:
    """Same content-token cut the Ask echo uses in rmc_core._tokens."""
    return {w for w in re.findall(r"[a-z0-9]+", str(text or "").lower()) if len(w) > 2 and w not in _STOP}


def _norm(text: str) -> str:
    token = re.sub(r"\s+", " ", str(text or "").strip().lower())
    token = re.sub(r"^(the|a|an)\s+", "", token)
    return token.strip(" .")


def _digest(payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _atom(predicate: str, args: list[str], polarity: str = "pos") -> dict[str, Any]:
    return {"predicate": predicate, "args": list(args), "polarity": polarity}


def parse_sentence(text: str) -> dict[str, Any] | None:
    """Contract §7 simple positive or negative fact. Other sentences stay stated."""
    sentence = re.sub(r"\s+", " ", str(text or "").strip()).strip(" .")
    if not sentence or len(sentence) > LIMITS["MAX_INPUT_CHARS"]:
        return None
    for verb in CLOSED_VERBS:
        match = re.match(r"^(.+?) " + re.escape(verb) + r" (.+)$", sentence, flags=re.IGNORECASE)
        if not match:
            continue
        subj, obj = match.group(1).strip(), match.group(2).strip()
        if not subj or not obj:
            continue
        polarity = "neg" if verb == "is not" else "pos"
        predicate = "is" if verb == "is not" else verb.lower()
        return {"text": sentence + ".", "atom": _atom(predicate, [subj, obj], polarity), "parsed": True}
    return {"text": sentence + ".", "atom": _atom("stated", [sentence], "pos"), "parsed": False}


_CLAUSE_STOP = {"a", "an", "the", "is", "are", "was", "were", "be", "been", "not", "does", "do", "did", "to", "of"}


def _clause_words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9']+", str(text or "").lower()) if w not in _CLAUSE_STOP}


def _np_frame(np: Any) -> dict[str, Any] | None:
    if not isinstance(np, dict) or not str(np.get("text") or "").strip():
        return None
    out = {"text": str(np.get("text")), "head": np.get("head"), "propn": np.get("propn") or None,
           "owner": np.get("owner") if isinstance(np.get("owner"), str) else _np_frame(np.get("owner")),
           "of": _np_frame(np.get("of")), "plural": bool(np.get("plural")), "det": np.get("det"),
           "adjs": list(np.get("adjs")) if isinstance(np.get("adjs"), list) and np.get("adjs") else None,
           "num": np.get("num") if np.get("num") not in (None, "") else None,
           "loc": np.get("loc") is True}
    return {k: v for k, v in out.items() if v not in (None, False, "")}


def role_frame(rec: dict[str, Any] | None) -> dict[str, Any] | None:
    """4.9.233: the roles of a parsed clause that did not cover its sentence. Not an atom; Derive may match on the roles
    it has (a "What is X?" kartṛ), and says the frame was partial."""
    if not isinstance(rec, dict) or not rec.get("parsed"):
        return None
    kartr = _np_frame(rec.get("kartr"))
    verb = str(rec.get("kriya") or "").strip().lower()
    if not kartr or not verb:
        return None
    out = {"kriya": verb, "polarity": "neg" if str(rec.get("polarity") or "pos") == "neg" else "pos", "kartr": kartr, "complete": False}
    pred = rec.get("pred") if isinstance(rec.get("pred"), dict) else None
    if pred and str(pred.get("text") or "").strip():
        out["pred"] = _np_frame(pred) if pred.get("type") == "np" else {"text": str(pred["text"]), "type": pred.get("type")}
    if _np_frame(rec.get("karma")):
        out["karma"] = _np_frame(rec.get("karma"))
    return out


def clause_record(clause: Any, sentence: str) -> dict[str, Any] | None:
    """The clause record of one sentence: the row's clause, or the sentence of a multi-sentence row it was parsed from."""
    from rmc_engine_v1.memory_clauses import norm, sentences
    if not isinstance(clause, dict):
        return None
    for rec in sentences(clause):
        if norm(rec.get("text")) == norm(sentence):
            return rec
    return None


def atom_from_clause(sentence: str, rec: dict[str, Any] | None) -> tuple[dict[str, Any] | None, str]:
    """4.9.232 (plan 229 step 4): the fact's atom from the phone's clause, not a regex.

    A copula clause (kriyā be) with a noun or adjective predicate is is(kartṛ, pred) with the clause's polarity; any other
    verb with a karma is lemma(kartṛ, karma). The clause is used only when its roles cover every content word of the
    sentence: a parse that dropped material ("made of hydrogen and oxygen" read as the adjective "made") is not a fact.
    Returns (parsed, reason); parsed None means the caller falls back to the regex reading.
    """
    if not isinstance(rec, dict):
        return None, "no_clause"
    if not rec.get("parsed"):
        return None, "clause_unparsed"
    kartr = _np_frame(rec.get("kartr"))
    if not kartr:
        return None, "clause_no_kartr"
    verb = str(rec.get("kriya") or "").strip().lower()
    pol = "neg" if str(rec.get("polarity") or "pos") == "neg" else "pos"
    pred = rec.get("pred") if isinstance(rec.get("pred"), dict) else None
    karma = _np_frame(rec.get("karma"))
    live_np = None
    if verb == "live":
        for adj in rec.get("adj") or []:
            if isinstance(adj, dict) and str(adj.get("prep") or "").lower() == "in" and str(adj.get("role") or "") == "adhikarana":
                live_np = _np_frame(adj.get("np"))
                break
    contain_inner = None
    geo_inner = None
    part_of = None
    of_rel = None
    if verb == "be" and isinstance(pred, dict) and str(pred.get("type") or "") == "np" and isinstance(pred.get("of"), dict) and str(pred["of"].get("text") or "").strip():
        head = str(pred.get("head") or "").lower()
        if head == "part":
            part_of = _np_frame(pred.get("of"))
        elif head in ("ancestor", "descendant", "parent", "child", "sibling"):
            of_rel = (head, _np_frame(pred.get("of")))
    to_rel = None
    if verb == "be" and isinstance(pred, dict) and str(pred.get("type") or "") == "adj":
        ahead = str(pred.get("text") or "").strip().lower()
        if ahead in ("married", "next", "adjacent"):
            for adj in rec.get("adj") or []:
                if isinstance(adj, dict) and str(adj.get("prep") or "").lower() == "to" and isinstance(adj.get("np"), dict):
                    to_rel = (ahead, _np_frame(adj.get("np")))
                    break
    cmp_rel = None
    if verb == "be" and isinstance(pred, dict) and str(pred.get("type") or "") == "cmp":
        declared = str(pred.get("predicate") or "")
        than = _np_frame(pred.get("than"))
        surface = str(pred.get("text") or "").strip()
        # A comparative with no declared row (longer) keeps the than-complement for a direct answer.
        # It is not added to a dimension, so it does not chain or invert.
        if than and str(than.get("text") or "").strip() and surface:
            cmp_rel = (declared or surface, than, surface)
    order_np = None
    if verb == "be" and isinstance(pred, dict) and str(pred.get("type") or "") == "pp" and str(pred.get("prep") or "").lower() in ("before", "after", "above", "below"):
        inner = _np_frame(pred.get("np"))
        if inner and str(inner.get("text") or "").strip():
            order_np = (str(pred.get("prep") or "").lower(), inner)
    if verb == "be" and isinstance(pred, dict) and str(pred.get("type") or "") == "pp" and str(pred.get("prep") or "").lower() in CONTAIN_PREPS:
        contain_inner = _np_frame(pred.get("np")) or ({"text": str(pred.get("text")).strip(), "head": str(pred.get("text")).strip()} if str(pred.get("text") or "").strip() else None)
    elif verb == "be" and isinstance(pred, dict) and str(pred.get("type") or "") == "pp" and str(pred.get("prep") or "").lower() == "in":
        inner = _np_frame(pred.get("np"))
        if kartr.get("loc") and isinstance(inner, dict) and inner.get("loc"):
            geo_inner = inner
    if live_np and str(live_np.get("text") or "").strip():
        predicate, obj = "live", str(live_np["text"]).strip()
        arg0 = kartr["text"]
    elif contain_inner and str(contain_inner.get("text") or "").strip():
        # in(content, container). The preposition is the relation, not part of a copula predicate.
        predicate, obj = "in", str(contain_inner["text"]).strip()
        arg0 = kartr["text"]
    elif verb == "contain" and karma and str(karma.get("text") or "").strip():
        # the inverse reading of the same relation: the kartṛ is the container
        predicate, obj = "in", kartr["text"]
        arg0 = str(karma["text"]).strip()
    elif part_of and str(part_of.get("text") or "").strip():
        # part(part, whole). The of-phrase is the whole. Other of-phrases stay copular nominals.
        predicate, obj = "part", str(part_of["text"]).strip()
        arg0 = kartr["text"]
    elif of_rel and of_rel[1] and str(of_rel[1].get("text") or "").strip():
        predicate, obj = of_rel[0], str(of_rel[1]["text"]).strip()
        arg0 = kartr["text"]
    elif to_rel and to_rel[1] and str(to_rel[1].get("text") or "").strip():
        predicate, obj = to_rel[0], str(to_rel[1]["text"]).strip()
        arg0 = kartr["text"]
    elif cmp_rel:
        predicate, obj = cmp_rel[0], str(cmp_rel[1]["text"]).strip()
        arg0 = kartr["text"]
    elif order_np and order_np[1] and str(order_np[1].get("text") or "").strip():
        # The copular preposition is the relation. A verb adjunct is not this atom.
        predicate, obj = order_np[0], str(order_np[1]["text"]).strip()
        arg0 = kartr["text"]
    elif geo_inner and str(geo_inner.get("text") or "").strip():
        # geo(place, region). Both names are lexicon locations. Other copular "in" stays a copula predicate.
        predicate, obj = "geo", str(geo_inner["text"]).strip()
        arg0 = kartr["text"]
    elif verb == "be" and isinstance(pred, dict) and str(pred.get("type") or "") == "pp" and str(pred.get("prep") or "").strip():
        inner = str((pred.get("np") or {}).get("text") or pred.get("text") or "").strip()
        predicate, obj = "is", (str(pred.get("prep")).strip() + " " + inner).strip()
        arg0 = kartr["text"]
    elif verb == "be" and pred and str(pred.get("text") or "").strip():
        predicate, obj = "is", str(pred["text"]).strip()
        arg0 = kartr["text"]
    elif verb and verb != "be" and karma and pol == "pos":
        predicate, obj = verb, karma["text"]
        arg0 = kartr["text"]
    else:
        return None, "clause_shape"
    covered = _clause_words(arg0 + " " + obj + " " + verb + " " + (str(pred.get("prep")) if isinstance(pred, dict) else ""))
    if predicate == "part":
        covered |= _clause_words("part of " + obj)
    if predicate in ("ancestor", "descendant", "parent", "child", "sibling"):
        covered |= _clause_words("an " + predicate + " of " + obj)
    if predicate in ("married", "next", "adjacent"):
        covered |= _clause_words(predicate + " to " + obj)
    if cmp_rel:
        covered |= _clause_words(cmp_rel[2] + " than " + obj)
        if cmp_rel[1].get("user") or str(cmp_rel[1].get("text") or "").lower() in ("i", "me"):
            covered |= {"i", "me", "my", "mine"}
    for adj in (rec.get("adj") if isinstance(rec.get("adj"), list) else []):
        if isinstance(adj, dict):
            covered |= _clause_words(str(adj.get("prep") or "") + " " + str((adj.get("np") or {}).get("text") or ""))
    missing = sorted(w for w in _clause_words(sentence) if w not in covered and not any(w.startswith(c[:4]) for c in covered if len(c) >= 4))
    if missing and verb == "live" and set(missing) <= {"live", "lives", "lived"}:
        missing = []
    if missing and verb != "be" and len(missing) == 1:
        # the surface form of the verb ("wrote" for kriyā write) sits between the kartṛ and the karma
        gap = re.search(re.escape(kartr["text"].lower()) + r"\s+(?:\w+\s+)?([a-z']+)\s+" + re.escape(obj.lower()), str(sentence).lower())
        if gap and gap.group(1) == missing[0]:
            missing = []
    if missing:
        return None, "clause_incomplete:" + ",".join(missing[:4])
    frame = {"kriya": verb, "polarity": pol, "kartr": kartr, "tense": rec.get("tense")}
    adj_list = [a for a in (rec.get("adj") or []) if isinstance(a, dict)]
    if adj_list:
        frame["adj"] = adj_list
    if predicate == "in" and contain_inner:
        frame["pred"] = {"type": "pp", "prep": str(pred.get("prep") or "inside").lower(), "text": obj, "np": contain_inner}
    elif predicate == "in":
        frame["karma"] = karma
    elif predicate == "part" and part_of:
        frame["pred"] = {"type": "np", "text": "part of " + str(part_of.get("text") or ""), "head": "part", "of": part_of}
    elif predicate in ("ancestor", "descendant", "parent", "child", "sibling") and of_rel and of_rel[1]:
        det = "an" if predicate == "ancestor" else "a"
        frame["pred"] = {"type": "np", "text": det + " " + predicate + " of " + str(of_rel[1].get("text") or ""), "head": predicate, "det": det, "of": of_rel[1]}
    elif predicate in ("married", "next", "adjacent") and to_rel and to_rel[1]:
        frame["pred"] = {"type": "adj", "text": predicate}
        kept = [a for a in (frame.get("adj") or []) if str(a.get("prep") or "").lower() != "to"]
        frame["adj"] = kept + [{"prep": "to", "role": "sampradana", "np": to_rel[1]}]
    elif cmp_rel:
        pred_frame = {"type": "cmp", "text": cmp_rel[2], "predicate": cmp_rel[0] if cmp_rel[0] in CMP_DIM or cmp_rel[0] in CMP_INVERSE else None, "than": cmp_rel[1]}
        if cmp_rel[0] in CMP_DIM:
            pred_frame["dimension"] = CMP_DIM[cmp_rel[0]]
        frame["pred"] = pred_frame
    elif predicate in ("before", "after", "above", "below") and order_np and order_np[1]:
        # The preposition is the relation. A copular frame has no kala or adhikarana role on this predicate,
        # so it is not labeled temporal or vertical.
        frame["pred"] = {"type": "pp", "prep": predicate, "text": obj, "np": order_np[1]}
    elif predicate == "geo" and geo_inner:
        frame["pred"] = {"type": "pp", "prep": "in", "text": obj, "np": geo_inner}
    elif predicate == "live" and live_np:
        frame["adj"] = [{"prep": "in", "role": "adhikarana", "np": live_np}]
    elif predicate == "is":
        frame["pred"] = _np_frame(pred) if pred.get("type") == "np" else {"text": obj, "type": pred.get("type")}
    else:
        frame["karma"] = karma
    clean = re.sub(r"\s+", " ", str(sentence or "").strip()).strip(" .")
    return {"text": clean + ".", "atom": _atom(predicate, [arg0, obj], pol), "parsed": True, "frame": frame}, "clause"


def clause_units(clause: Any, sentence: str) -> list[tuple[str, dict[str, Any] | None, str | None]]:
    """4.9.238: the clauses one sentence states. A concessive or causal sentence ("Even though X, Y because Z") is its
    parts (clause_split, the mirror of the phone's splitter), each with the phone's own record of that part when it sent
    one; any other sentence is itself. Returns (text, record, link); link None for an unsplit sentence."""
    from rmc_engine_v1.clause_split import split_clauses
    from rmc_engine_v1.memory_clauses import norm
    rec = clause_record(clause, sentence)
    parts = split_clauses(sentence)
    if len(parts) < 2:
        return [(sentence, rec, None)]
    by_text = {norm(c.get("text")): c for c in ((rec or {}).get("clauses") or []) if isinstance(c, dict)}
    out = []
    for part in parts:
        text = part["text"][:1].upper() + part["text"][1:]
        out.append((text, by_text.get(norm(part["text"])), part["link"]))
    return out


def _sentences(text: str) -> list[str]:
    """Contract §6 step 1. Split on a period between sentences, not on decimals."""
    clean = str(text or "").strip()
    if not clean:
        return []
    parts = re.split(r"(?<=[.])\s+", clean)
    out = []
    for part in parts:
        part = part.strip()
        if part and len(out) < LIMITS["MAX_SENTENCES"]:
            out.append(part)
    return out or [clean]


def empty_world() -> dict[str, Any]:
    world = {
        "schema": "TurnWorld/v1",
        "cite": "contract 1g2034-K §4.2",
        "version": 0,
        "parent_root": None,
        "facts": [],
        "rules": [dict(COPULA_RULE), dict(CONTAIN_RULE), dict(GEO_RULE), dict(LIVE_RULE), dict(PART_RULE), dict(ANCESTOR_RULE), dict(ANCESTOR_INVERSE), dict(DESCENDANT_RULE), dict(DESCENDANT_INVERSE), dict(PARENT_INVERSE), dict(CHILD_INVERSE), dict(MARRIED_SYMMETRIC), dict(NEXT_SYMMETRIC), dict(ADJACENT_SYMMETRIC), dict(SIBLING_SYMMETRIC), dict(NEXT_CHAIN)] + [dict(r) for r in ORDER_RULES] + [dict(r) for r in CMP_RULES] + [dict(OWNER_RULE), dict(NAME_RULE), dict(CAUSES_RULE), dict(IF_THEN_RULE), dict(MAKES_RULE), dict(SOLVER_RULE)],
        "entities": [],
        "branch_id": "observed",
        "limits": {k: v for k, v in LIMITS.items() if k != "cite"},
        "query": None,
    }
    world["root"] = _digest({"facts": world["facts"], "rules": [COPULA_RULE["id"]], "version": 0})
    return world


def _fact_row(fid: str, parsed: dict[str, Any], *, source: str, provenance: list[str], quarantined: bool, cite: str, self_fact: bool = False, subject: str = "") -> dict[str, Any]:
    atom = parsed["atom"]
    return {
        "id": fid,
        "text": parsed["text"],
        "atom": atom,
        "polarity": atom["polarity"],
        "source": source,
        "provenance": list(provenance),
        "quarantined": quarantined,
        "status": "quarantined" if quarantined else "admitted",
        "cite": cite,
        "self_fact": self_fact,
        "subject": subject or (atom["args"][0] if atom.get("args") else ""),
        "parsed": bool(parsed.get("parsed")),
        # 4.9.232: the clause frame the atom came from (None for a regex reading) and the row's placement
        "frame": parsed.get("frame"),
        # 4.9.243: typed causal frame when the clause was causal (Simulate unifies on this)
        "causal_frame": parsed.get("causal_frame"),
        # 4.9.233: the roles of a clause that did not cover the sentence (Derive may match on them, marked partial)
        "role_frame": parsed.get("role_frame"),
        "atom_source": parsed.get("atom_source") or ("clause" if parsed.get("frame") else "regex"),
        "clause_link": parsed.get("clause_link"),
        "sentence": parsed.get("sentence"),
        "place": parsed.get("place"),
        **_place_fields(parsed.get("place")),
    }


def _derived_place(premises: list[dict[str, Any]]) -> dict[str, Any] | None:
    """A conclusion sits where its subject premise sits; the premises' phases are kept so a misaligned hop is visible."""
    placed = [p.get("place") for p in premises if isinstance(p.get("place"), dict)]
    if not placed:
        return None
    out = dict(placed[0])
    out["placed_by"] = "derive_premises"
    out["premise_phases"] = [pl.get("phase") for pl in placed]
    out["premise_meaning_ids"] = [pl.get("meaning_id") for pl in placed]
    return out


def _place_fields(place: Any) -> dict[str, Any]:
    """The placement every world fact carries at top level: meaning id, phase, Codex band, Hz, group."""
    pl = place if isinstance(place, dict) else {}
    return {"meaning_id": pl.get("meaning_id"), "phase": pl.get("phase"), "phase_name": pl.get("phase_name"),
            "band": pl.get("band"), "hz": pl.get("hz"), "group": pl.get("group")}


def seed_self_facts(world: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Self-facts live in the world. They are contract sentences, not answers."""
    facts = []
    trace = []
    for row in SELF_FACTS:
        parsed = {"text": row["text"], "atom": _atom(row["predicate"], list(row["args"]), "pos"), "parsed": True,
                  "atom_source": "self_fact", "place": place_row({}, row["text"], False)}
        facts.append(_fact_row(
            row["id"], parsed, source="self", provenance=[row["cite"]], quarantined=False,
            cite=row["cite"], self_fact=True, subject=row["subject"],
        ))
        trace.append({"op": "seed", "id": row["id"], "cite": row["cite"]})
    nxt = dict(world)
    nxt["facts"] = facts
    nxt["version"] = 0
    nxt["entities"] = sorted({_norm(f["subject"]) for f in facts if f.get("subject")})
    nxt["root"] = _digest({"facts": [(f["id"], f["text"], f["status"]) for f in facts], "version": 0})
    return nxt, trace


def observe(world: dict[str, Any], events: list[dict[str, Any]], *, regex_fallback: bool = True) -> tuple[dict[str, Any], dict[str, Any]]:
    """Spec §1.4 Observe. Spec §4.7 supersession. Contract §8 quarantine is not admission.

    Returns a new world. The parent root is kept. Nothing is written to disk.
    4.9.232: a sentence's atom comes from its clause when the clause covers it; the regex reading is the fallback
    (regex_fallback=False drops it, for the proof that clauses alone carry the facts). Every fact carries the
    event's placement (meaning id, phase, band, Hz, group).
    """
    facts = [dict(f) for f in world.get("facts") or []]
    revisions: list[dict[str, Any]] = []
    admitted = 0
    quarantined = 0
    superseded = 0
    sources = {"clause": 0, "regex": 0, "stated": 0, "causal_clause": 0, "skipped_no_clause": 0}
    fallback_reasons: dict[str, int] = {}
    for event in events:
        if not isinstance(event, dict):
            continue
        if len(facts) >= LIMITS["MAX_FACTS"]:
            revisions.append({"op": "limit", "reason": "MAX_FACTS", "cite": LIMITS["cite"]})
            break
        raw = str(event.get("text") or "").strip()
        if not raw:
            continue
        is_q = bool(event.get("quarantined")) or str(event.get("confidence") or "") == "low" or _f(event.get("prior_drift_score"), 0.0) >= 0.40
        eid = str(event.get("id") or ("ev-" + _digest(raw)[:12]))
        units = [u for sentence in _sentences(raw) for u in clause_units(event.get("clause"), sentence)]
        for sentence, rec, link in units:
            if len(facts) >= LIMITS["MAX_FACTS"]:
                revisions.append({"op": "limit", "reason": "MAX_FACTS", "cite": LIMITS["cite"]})
                break
            parsed, why = atom_from_clause(sentence, rec)
            if parsed is None:
                reason = why.split(":")[0]
                fallback_reasons[reason] = fallback_reasons.get(reason, 0) + 1
                if not regex_fallback:
                    sources["skipped_no_clause"] += 1
                    continue
                parsed = parse_sentence(sentence)
                if not parsed:
                    continue
                parsed = dict(parsed, atom_source="regex" if parsed.get("parsed") else "stated", clause_reason=why, role_frame=role_frame(rec))
            else:
                parsed = dict(parsed, atom_source="clause")
            # 4.9.243: a causal clause ("X causes Y", "if X then Y", "V-ing … makes it fall") is stored as a typed
            # causal frame with provenance; the regex/clause atom is upgraded so Simulate can unify on it.
            from rmc_engine_v1 import cause_effect as _CE
            _cf = _CE.parse_clause(sentence)
            if _cf:
                causal_parsed = _CE.as_parsed(_cf)
                parsed = dict(parsed, **{k: causal_parsed[k] for k in ("atom", "frame", "causal_frame", "parsed")})
                parsed["atom_source"] = "causal_clause"
            sources[parsed["atom_source"]] = sources.get(parsed["atom_source"], 0) + 1
            if link:
                # 4.9.238: one clause of a concessive/causal sentence; the stored sentence stays the quote it came from
                parsed["clause_link"] = link
                parsed["sentence"] = raw
            parsed["place"] = event.get("place") if isinstance(event.get("place"), dict) else None
            norm_text = _norm(parsed["text"])
            if any(_norm(str(f.get("text") or "")) == norm_text and f.get("status") != "superseded" for f in facts):
                revisions.append({"op": "idempotent", "reason": "already-banked", "source": eid})
                continue
            fid = eid + ":" + _digest(parsed["text"])[:10]
            if any(f.get("id") == fid for f in facts):
                continue
            row = _fact_row(
                fid, parsed, source=str(event.get("source") or "receipt"),
                provenance=[eid], quarantined=is_q,
                cite="contract 1g2034-K §8 tool output is evidence until admitted" if is_q else "contract 1g2034-K §4.2 admitted fact",
            )
            # 4.9.244: a Simulation Router receipt row keeps its receipt (solver, measurements, sha256, intervention key)
            if row["source"] == "sim_receipt" and isinstance(event.get("sim"), dict):
                row["sim"] = dict(event["sim"])
                row["may_store_as_fact"] = False
                if event["sim"].get("state_before"):
                    row["state_before"] = event["sim"]["state_before"]
                    row["state_after"] = event["sim"].get("state_after")
            if is_q:
                facts.append(row)
                quarantined += 1
                revisions.append({"op": "quarantine", "id": fid, "source": eid})
                continue
            atom = row["atom"]
            if atom["predicate"] != "stated":
                for old in facts:
                    if not old.get("self_fact") or old.get("status") != "admitted":
                        continue
                    old_atom = old.get("atom") or {}
                    if old_atom.get("predicate") != atom["predicate"]:
                        continue
                    if _norm((old_atom.get("args") or [""])[0]) != _norm(atom["args"][0]):
                        continue
                    if _norm((old_atom.get("args") or ["", ""])[1]) == _norm(atom["args"][1]):
                        continue
                    old["status"] = "superseded"
                    old["superseded_by"] = fid
                    superseded += 1
                    revisions.append({
                        "op": "supersede",
                        "id": old["id"],
                        "by": fid,
                        "cite": "spec 1vBx_Q9K §4.7; parent root kept",
                    })
            facts.append(row)
            admitted += 1
            revisions.append({"op": "admit", "id": fid, "source": eid})
    nxt = dict(world)
    nxt["facts"] = facts
    nxt["version"] = int(world.get("version") or 0) + 1
    nxt["parent_root"] = world.get("root")
    nxt["entities"] = sorted({_norm(str((f.get("atom") or {}).get("args", [""])[0])) for f in facts if (f.get("atom") or {}).get("args")})[: LIMITS["MAX_ENTITIES"]]
    nxt["root"] = _digest({
        "parent": nxt["parent_root"],
        "facts": [(f["id"], f["text"], f["status"]) for f in facts],
        "version": nxt["version"],
    })
    trace = {
        "operation": "Observe",
        "cite": "spec 1vBx_Q9K §1.4 Observe(W_v, E) → (W_v+1, revision_trace)",
        "from_version": world.get("version"),
        "to_version": nxt["version"],
        "parent_root": nxt["parent_root"],
        "root": nxt["root"],
        "admitted": admitted,
        "quarantined": quarantined,
        "superseded": superseded,
        "atom_sources": sources,
        "clause_fallback_reasons": fallback_reasons,
        "regex_fallback": regex_fallback,
        "revisions": revisions[:80],
        "writes_durable_memory": False,
        "calls_llm": False,
    }
    return nxt, trace


def _active(world: dict[str, Any]) -> list[dict[str, Any]]:
    return [f for f in world.get("facts") or [] if f.get("status") == "admitted" and not f.get("quarantined")]


def _bind(atom: dict[str, Any], sub: dict[str, str]) -> dict[str, Any]:
    args = []
    for arg in atom.get("args") or []:
        args.append(sub.get(arg, arg) if str(arg).startswith("$") else arg)
    return _atom(str(atom.get("predicate")), args, str(atom.get("polarity") or "pos"))


def _unify(pattern: dict[str, Any], atom: dict[str, Any], sub: dict[str, str]) -> dict[str, str] | None:
    if pattern.get("predicate") != atom.get("predicate") or pattern.get("polarity") != atom.get("polarity"):
        return None
    nxt = dict(sub)
    for p, a in zip(pattern.get("args") or [], atom.get("args") or []):
        if str(p).startswith("$"):
            prev = nxt.get(p)
            if prev is None:
                nxt[p] = a
            elif _norm(prev) != _norm(a):
                return None
        elif _norm(p) != _norm(a):
            return None
    return nxt


def _match_body(body: list[dict[str, Any]], facts: list[dict[str, Any]]) -> list[tuple[dict[str, str], list[dict[str, Any]]]]:
    """Index facts by predicate. Contract §5 allows indexes that do not change the result."""
    by: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for fact in facts:
        atom = fact.get("atom") or {}
        if atom.get("predicate") == "stated":
            continue
        by.setdefault((str(atom.get("predicate")), str(atom.get("polarity"))), []).append(fact)
    found: list[tuple[dict[str, str], list[dict[str, Any]]]] = []

    def walk(i: int, sub: dict[str, str], chosen: list[dict[str, Any]]) -> None:
        if len(found) >= 32:
            return
        if i >= len(body):
            found.append((dict(sub), list(chosen)))
            return
        pattern = body[i]
        key = (str(pattern.get("predicate")), str(pattern.get("polarity")))
        for fact in by.get(key, []):
            if any(fact.get("id") == c.get("id") for c in chosen):
                continue
            nxt = _unify(pattern, fact.get("atom") or {}, sub)
            if nxt is None:
                continue
            # The shared argument must be the same entity after articles are stripped.
            if i == 1 and _norm(nxt.get("$y", "")) != _norm((fact.get("atom") or {}).get("args", ["", ""])[0]) and _norm(nxt.get("$y", "")) != _norm(sub.get("$y", "")):
                continue
            walk(i + 1, nxt, chosen + [fact])

    walk(0, {}, [])
    # Second-hop unification compares normalized $y to the next fact's subject.
    strict = []
    for sub, chosen in found:
        if len(chosen) < 2:
            continue
        y = _norm(sub.get("$y", ""))
        second_subj = _norm(((chosen[1].get("atom") or {}).get("args") or [""])[0])
        first_obj = _norm(((chosen[0].get("atom") or {}).get("args") or ["", ""])[1])
        if y and y == second_subj and y == first_obj and _norm(sub.get("$x", "")) != _norm(sub.get("$z", "")):
            strict.append((sub, chosen))
    return strict


def check_proof(world: dict[str, Any], proof: dict[str, Any]) -> dict[str, Any]:
    """Contract §4.3 and §6 step 7. Replay. Do not trust a flag on the proof."""
    if not isinstance(proof, dict):
        return {"ok": False, "reason": "proof_missing", "cite": "contract 1g2034-K §4.3"}
    if proof.get("world_root") != world.get("root"):
        return {"ok": False, "reason": "world_root_mismatch", "cite": "contract 1g2034-K §6 step 8"}
    steps = proof.get("steps") or []
    if not isinstance(steps, list) or not steps or len(steps) > LIMITS["MAX_PROOF_STEPS"]:
        return {"ok": False, "reason": "proof_steps", "cite": "contract 1g2034-K §10"}
    facts = {f["id"]: f for f in world.get("facts") or []}
    rules = {r["id"]: r for r in world.get("rules") or []}
    derived: dict[int, dict[str, Any]] = {}
    for step in steps:
        if not isinstance(step, dict):
            return {"ok": False, "reason": "step_shape", "cite": "contract 1g2034-K §4.3"}
        n = int(step.get("n") or 0)
        atom = step.get("atom")
        if not isinstance(atom, dict):
            return {"ok": False, "reason": "step_atom", "cite": "contract 1g2034-K §4.3"}
        kind = step.get("kind")
        if kind == "fact":
            fact = facts.get(step.get("fact_id"))
            if not fact or fact.get("status") != "admitted":
                return {"ok": False, "reason": "fact_not_in_world", "cite": "contract 1g2034-K §4.3"}
            if fact.get("atom") != atom:
                return {"ok": False, "reason": "fact_atom_mismatch", "cite": "contract 1g2034-K §6 step 8"}
        elif kind == "rule":
            rule = rules.get(step.get("rule_id"))
            if not rule:
                return {"ok": False, "reason": "rule_missing", "cite": "contract 1g2034-K §4.3"}
            sub = step.get("substitution") if isinstance(step.get("substitution"), dict) else {}
            premise_ns = step.get("premises") or []
            if rule["id"] in ("WM-OWNER-OF", "WM-NAME-OF"):
                bad = (_replay_owner if rule["id"] == "WM-OWNER-OF" else _replay_name)(step, derived)
                if bad:
                    return {"ok": False, "reason": bad, "cite": OWNER_RULE["cite"]}
                derived[n] = atom
                continue
            if rule["id"] in CAUSAL_RULE_IDS or rule.get("class") == "causal_forward":
                # 4.9.243: replay by confirming each premise fact is in the world and the conclusion atom is present.
                # The forward-chain itself was already produced by cause_effect under the same world; the checker
                # refuses a rule step whose premises are missing or whose atom is empty.
                for pn in premise_ns:
                    prev = derived.get(int(pn))
                    if not prev:
                        return {"ok": False, "reason": "causal_premise_missing", "cite": MAKES_RULE["cite"]}
                if rule["id"] == "WM-SOLVER-RECEIPT":
                    # the premise must be a receipt row carrying its sha256 (64 hex) and the measured effect
                    fids = [s.get("fact_id") for s in steps if isinstance(s, dict) and s.get("kind") == "fact" and int(s.get("n") or 0) in [int(x) for x in premise_ns]]
                    sims = [(facts.get(f) or {}).get("sim") for f in fids]
                    if not sims or not all(isinstance(s, dict) and re.fullmatch(r"[0-9a-f]{64}", str(s.get("sha256") or "")) and s.get("effect_text") for s in sims):
                        return {"ok": False, "reason": "solver_receipt_missing", "cite": SOLVER_RULE["cite"]}
                if not atom.get("predicate") or not (atom.get("args") or atom.get("predicate")):
                    return {"ok": False, "reason": "causal_head_empty", "cite": MAKES_RULE["cite"]}
                derived[n] = atom
                continue
            if len(premise_ns) != len(rule.get("body") or []):
                return {"ok": False, "reason": "premise_count", "cite": "contract 1g2034-K §5"}
            for pattern, pn in zip(rule["body"], premise_ns):
                prev = derived.get(int(pn))
                if not prev:
                    return {"ok": False, "reason": "premise_missing", "cite": "contract 1g2034-K §4.3"}
                bound = _bind(pattern, {k: str(v) for k, v in sub.items()})
                # Compare normalized arguments so "a mineral" and "A mineral" are one entity.
                if bound.get("predicate") != prev.get("predicate") or bound.get("polarity") != prev.get("polarity"):
                    return {"ok": False, "reason": "premise_mismatch", "cite": "contract 1g2034-K §6 step 8"}
                if [_norm(a) for a in bound.get("args") or []] != [_norm(a) for a in prev.get("args") or []]:
                    return {"ok": False, "reason": "premise_mismatch", "cite": "contract 1g2034-K §6 step 8"}
            head = _bind(rule["head"], {k: str(v) for k, v in sub.items()})
            if head.get("predicate") != atom.get("predicate") or head.get("polarity") != atom.get("polarity"):
                return {"ok": False, "reason": "head_mismatch", "cite": "contract 1g2034-K §6 step 8"}
            if [_norm(a) for a in head.get("args") or []] != [_norm(a) for a in atom.get("args") or []]:
                return {"ok": False, "reason": "head_mismatch", "cite": "contract 1g2034-K §6 step 8"}
            if (rule["id"] in ("WM-COPULA-CHAIN", "WM-CONTAIN-CHAIN", "WM-GEO-CHAIN", "WM-LIVE-GEO", "WM-PART-CHAIN", "WM-ANCESTOR-CHAIN", "WM-DESCENDANT-CHAIN", "WM-NEXT-CHAIN", "WM-BEFORE-CHAIN", "WM-AFTER-CHAIN", "WM-ABOVE-CHAIN", "WM-BELOW-CHAIN") or str(rule["id"]).endswith("-CHAIN")) and _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                return {"ok": False, "reason": "guard_distinct", "cite": rule.get("cite") or "contract 1g2034-K §5"}
            if (rule["id"] in ("WM-ANCESTOR-INVERSE", "WM-DESCENDANT-INVERSE", "WM-PARENT-INVERSE", "WM-CHILD-INVERSE", "WM-MARRIED-SYMMETRIC", "WM-NEXT-SYMMETRIC", "WM-ADJACENT-SYMMETRIC", "WM-SIBLING-SYMMETRIC", "WM-BEFORE-INVERSE", "WM-AFTER-INVERSE", "WM-ABOVE-INVERSE", "WM-BELOW-INVERSE") or str(rule["id"]).endswith("-INVERSE") or str(rule["id"]).endswith("-ASYM") or str(rule["id"]).endswith("-SYMMETRIC") or str(rule["id"]).endswith("-EXCLUDES")) and _norm(sub.get("$x", "")) == _norm(sub.get("$y", "")):
                return {"ok": False, "reason": "guard_distinct", "cite": rule.get("cite") or "contract 1g2034-K §5"}
        else:
            return {"ok": False, "reason": "step_kind", "cite": "contract 1g2034-K §4.3"}
        derived[n] = atom
        if len(derived) > LIMITS["MAX_PROOF_DEPTH"]:
            return {"ok": False, "reason": "proof_depth", "cite": "contract 1g2034-K §10"}
    last = steps[-1].get("atom")
    if last != proof.get("conclusion"):
        return {"ok": False, "reason": "conclusion_mismatch", "cite": "contract 1g2034-K §6 step 8"}
    return {"ok": True, "reason": "replayed", "cite": "contract 1g2034-K §6 step 7", "steps": len(steps)}


def _replay_owner(step: dict[str, Any], derived: dict[int, dict[str, Any]]) -> str | None:
    """Replay WM-OWNER-OF: the premise is a positive copula, one side is possessive with possessor $o, the other is $n."""
    from rmc_engine_v1 import derive_frame as DF
    sub = step.get("substitution") if isinstance(step.get("substitution"), dict) else {}
    ns = step.get("premises") or []
    if len(ns) != 1 or not derived.get(int(ns[0])):
        return "premise_missing"
    prev = derived[int(ns[0])]
    args = [str(a) for a in prev.get("args") or []]
    if prev.get("predicate") != "is" or prev.get("polarity") != "pos" or len(args) != 2:
        return "premise_mismatch"
    owned, n = str(sub.get("$owned") or ""), str(sub.get("$n") or "")
    if sorted([_norm(owned), _norm(n)]) != sorted(_norm(a) for a in args):
        return "premise_mismatch"
    if _norm(DF.possessor({"text": owned}) or "") != _norm(str(sub.get("$o") or "")) or not sub.get("$o"):
        return "guard_possessor"
    atom = step.get("atom") or {}
    if atom.get("predicate") != "owns" or atom.get("polarity") != "pos" or \
            [_norm(a) for a in atom.get("args") or []] != [_norm(str(sub["$o"])), _norm(n)]:
        return "head_mismatch"
    return None


def _replay_name(step: dict[str, Any], derived: dict[int, dict[str, Any]]) -> str | None:
    """Replay WM-NAME-OF: the premise is is($x, $n), $n is a proper name, the head is is("$x's name", $n)."""
    sub = step.get("substitution") if isinstance(step.get("substitution"), dict) else {}
    ns = step.get("premises") or []
    if len(ns) != 1 or not derived.get(int(ns[0])):
        return "premise_missing"
    prev = derived[int(ns[0])]
    x, n = str(sub.get("$x") or ""), str(sub.get("$n") or "")
    if prev.get("predicate") != "is" or prev.get("polarity") != "pos" or [_norm(a) for a in prev.get("args") or []] != [_norm(x), _norm(n)]:
        return "premise_mismatch"
    if not re.match(r"^[A-Z][A-Za-z'\-]*(\s+[A-Z][A-Za-z'\-]*){0,2}$", n.strip()):
        return "guard_proper_name"
    atom = step.get("atom") or {}
    if atom.get("predicate") != "is" or atom.get("polarity") != "pos" or \
            [_norm(a) for a in atom.get("args") or []] != [_norm(x + "'s name"), _norm(n)]:
        return "head_mismatch"
    return None


def _rule_words(rule: dict[str, Any]) -> list[str]:
    """The words a relational rule's head adds: its predicate lemma and the non-variable words of its head arguments."""
    head = rule.get("head") or {}
    pred = str(head.get("predicate") or "")
    text = " ".join([pred, pred[:-1] if pred.endswith("s") else pred] + [re.sub(r"\$\w+('s)?", " ", str(a)) for a in head.get("args") or []])
    return sorted(content_tokens(text) - {"is"})


def _licensed(world: dict[str, Any], claim: dict[str, Any], rule: dict[str, Any]) -> dict[str, Any]:
    """Re-run the debate with the rule's own head words licensed (only when the checker replayed the rule)."""
    claim["rule_licensed"] = _rule_words(rule)
    claim["debate"] = run_debate(claim, content_tokens=content_tokens)
    return claim


_FIRST_PERSON_RE = re.compile(r"(?i)\b(i|me|my|mine|myself|our|ours|we|us)\b")
_PERSPECTIVE = {"i": "you", "me": "you", "my": "your", "mine": "yours", "myself": "yourself", "am": "are",
                "i'm": "you're", "we": "you", "us": "you", "our": "your", "ours": "yours", "ourselves": "yourselves"}


_SECOND_PERSON_RE = re.compile(r"(?i)\b(you|your|yours|yourself)\b")
_SPEAKER = {"your": "my", "yours": "mine", "yourself": "myself", "you're": "I'm"}


def to_speaker(sentence: str) -> str:
    """4.9.241: the kernel says a fact the asker states about it ("You are a computer program.") in its own person
    ("I am a computer program."). "you" is I as a subject (sentence start, or before a verb group) and me elsewhere; the
    copula agrees (are → am, were → was). Deixis, not content: no word other than the person forms changes."""
    text = str(sentence or "")
    text = re.sub(r"(?i)\byou are\b", "I am", text)
    text = re.sub(r"(?i)\byou were\b", "I was", text)
    text = re.sub(r"(?i)\b(your|yours|yourself|you're)\b", lambda m: _SPEAKER[m.group(0).lower()], text)
    text = re.sub(r"(?i)^(\s*)you\b", lambda m: m.group(1) + "I", text)
    text = re.sub(r"(?i)\b(and|but|or|that|because|if|when)\s+you\b", lambda m: m.group(1) + " I", text)
    text = re.sub(r"(?i)\byou\b", "me", text)
    return text[:1].upper() + text[1:] if text else text


def to_listener(sentence: str) -> str:
    """Speak an asker's own first-person memory back to them in the second person (deixis, not content)."""
    def swap(m: re.Match) -> str:
        w = m.group(0)
        out = _PERSPECTIVE.get(w.lower(), w)
        cap = m.start() == 0 or (w[:1].isupper() and w.lower() != "i")
        return out[:1].upper() + out[1:] if cap else out
    text = re.sub(r"(?i)\b(i'm|i|me|my|mine|myself|am|we|us|our|ours|ourselves)\b", swap, str(sentence or ""))
    text = re.sub(r"(?i)\byou owns\b", "you own", text)
    return text[:1].upper() + text[1:] if text else text


def _coverage(question: str, text: str) -> float:
    left = content_tokens(question)
    right = content_tokens(text)
    if not left:
        return 0.0
    return len(left & right) / len(left)


def _role_lock(question: str, text: str) -> int:
    """1 when the fact fills the role the question asked. Coverage ties do not outrank it."""
    from rmc_engine_v1.resonance_recall import _role_hit, asked_filler
    asked = asked_filler(question)
    if not asked:
        return 0
    return 1 if _role_hit(asked.get("filler") or "", text) else 0


def _render_atom(atom: dict[str, Any]) -> str:
    """Contract I1 and §9. The template expresses this atom. It does not pick another."""
    args = [str(a) for a in atom.get("args") or []]
    predicate = str(atom.get("predicate") or "")
    if predicate in CMP_DIM and len(args) == 2:
        word = {"older_than": "older", "younger_than": "younger", "greater_than": "greater", "less_than": "less", "taller_than": "taller", "shorter_than": "shorter"}[predicate]
        verb = "is not" if atom.get("polarity") == "neg" else "is"
        return f"{args[0]} {verb} {word} than {args[1]}."
    if predicate in ("before", "after", "above", "below") and len(args) == 2:
        verb = "is not" if atom.get("polarity") == "neg" else "is"
        return f"{args[0]} {verb} {predicate} {args[1]}."
    if predicate in ("married", "next", "adjacent") and len(args) == 2:
        verb = "is not" if atom.get("polarity") == "neg" else "is"
        return f"{args[0]} {verb} {predicate} to {args[1]}."
    if predicate in ("ancestor", "descendant", "parent", "child", "sibling") and len(args) == 2:
        det = "an" if predicate == "ancestor" else "a"
        verb = "is not" if atom.get("polarity") == "neg" else "is"
        return f"{args[0]} {verb} {det} {predicate} of {args[1]}."
    if predicate == "part" and len(args) == 2 and atom.get("polarity") == "neg":
        return f"{args[0]} is not part of {args[1]}."
    if predicate == "part" and len(args) == 2:
        return f"{args[0]} is part of {args[1]}."
    if predicate == "live" and len(args) == 2 and atom.get("polarity") == "neg":
        return f"{args[0]} does not live in {args[1]}."
    if predicate == "live" and len(args) == 2:
        return f"{args[0]} lives in {args[1]}."
    if predicate == "geo" and len(args) == 2 and atom.get("polarity") == "neg":
        return f"{args[0]} is not in {args[1]}."
    if predicate == "geo" and len(args) == 2:
        return f"{args[0]} is in {args[1]}."
    if predicate == "in" and len(args) == 2 and atom.get("polarity") == "neg":
        return f"{args[0]} is not inside {args[1]}."
    if predicate == "in" and len(args) == 2:
        return f"{args[0]} is inside {args[1]}."
    if predicate == "is" and atom.get("polarity") == "neg" and len(args) == 2:
        return f"{args[0]} is not {args[1]}."
    if predicate == "is" and len(args) == 2:
        return f"{args[0]} is {args[1]}."
    if predicate == "owns" and len(args) == 2 and args[0].lower() in ("i", "you", "we", "they"):
        return f"{args[0]} own {args[1]}."
    if predicate in ("owns", "verifies", "remains", "initiates") and len(args) == 2:
        return f"{args[0]} {predicate} {args[1]}."
    if args:
        return args[0] if predicate == "stated" else f"{args[0]} {predicate} {args[1]}." if len(args) > 1 else args[0]
    return ""


def _proof_shell(world: dict[str, Any], conclusion: dict[str, Any], steps: list[dict[str, Any]]) -> dict[str, Any]:
    body = {"world_root": world.get("root"), "conclusion": conclusion, "steps": steps}
    body["proof_id"] = "proof-" + _digest(body)[:16]
    body["checker_version"] = "world_model_v1.check_proof"
    body["cite"] = "contract 1g2034-K §4.3"
    return body


def _direct_proof(world: dict[str, Any], fact: dict[str, Any]) -> dict[str, Any]:
    atom = fact["atom"]
    return _proof_shell(world, atom, [{
        "n": 1, "kind": "fact", "fact_id": fact["id"], "premises": [], "substitution": {}, "atom": atom,
    }])


def _owner_proof(world: dict[str, Any], fact: dict[str, Any], sub: dict[str, str], conclusion: dict[str, Any]) -> dict[str, Any]:
    return _proof_shell(world, conclusion, [
        {"n": 1, "kind": "fact", "fact_id": fact["id"], "premises": [], "substitution": {}, "atom": fact["atom"]},
        {"n": 2, "kind": "rule", "rule_id": "WM-OWNER-OF", "premises": [1], "substitution": sub, "atom": conclusion},
    ])


def _chain_proof(world: dict[str, Any], left: dict[str, Any], right: dict[str, Any], sub: dict[str, str], conclusion: dict[str, Any], rule_id: str = "WM-COPULA-CHAIN") -> dict[str, Any]:
    return _proof_shell(world, conclusion, [
        {"n": 1, "kind": "fact", "fact_id": left["id"], "premises": [], "substitution": {}, "atom": left["atom"]},
        {"n": 2, "kind": "fact", "fact_id": right["id"], "premises": [], "substitution": {}, "atom": right["atom"]},
        {"n": 3, "kind": "rule", "rule_id": rule_id, "premises": [1, 2], "substitution": sub, "atom": conclusion},
    ])


def _premise_weight(premise: dict[str, Any], phase_path: list[Any]) -> float:
    """Recall's measured weight when the row carries one; else its resonance grace with the
    question's opening phase (resonance_recall._grace: rpm x cos^2 of the phase gap); else 0."""
    try:
        if premise.get("retrieval_weight") is not None:
            return round(max(0.0, min(1.0, float(premise.get("retrieval_weight")))), 6)
    except (TypeError, ValueError):
        pass
    packet = premise.get("packet") if isinstance(premise.get("packet"), dict) else None
    phi = None
    for p in phase_path or []:
        digits = "".join(ch for ch in str(p) if ch.isdigit())
        if digits:
            phi = int(digits)
            break
    if packet is None or phi is None:
        return 0.0
    try:
        from rmc_engine_v1.resonance_recall import _grace
        return round(max(0.0, min(1.0, float(_grace(packet, phi).get("grace") or 0.0))), 6)
    except Exception:
        return 0.0


def _drift_for(text: str, premises: list[dict[str, Any]], phase_path: list[Any]) -> dict[str, Any]:
    """measurement_kernel epsilon, unmodified. mobile_config bands decide the disposition."""
    nodes = []
    for premise in premises:
        # 4.9.235 (plan 229 step 7): the premise's own readings (recall weight or resonance grace; its row confidence), not fixed numbers.
        nodes.append({
            "memory_id": premise.get("id"),
            "content_summary": premise.get("text") or "",
            "content": premise.get("text") or "",
            "confidence": "low" if premise.get("quarantined") else (premise.get("confidence") or "medium"),
            "retrieval_weight": _premise_weight(premise, phase_path),
            "source": premise.get("source") or "world",
            "source_kind": "world_premise",
            "prior_drift_score": 0.45 if premise.get("quarantined") else 0.0,
            "phase_tags": phase_path or ["Φ1"],
        })
    path = list(phase_path or ["Φ1"])
    candidate = {
        "candidate_id": "derived-" + _digest(text)[:12],
        "candidate": text,
        "title": text[:180],
        "candidate_kind": "derived_claim",
        "phase_path": path,
        "phase_target": path[-1] if path else "Φ1",
    }
    measured = measure_candidate(
        candidate, {}, memory_nodes=nodes,
        phase_state={"phase_path_hypothesis": path, "phase_primary": path[0] if path else "Φ1"},
    )
    components = coherence_components(candidate, measured)
    eps = float(measured.get("epsilon_s") or 0.0)
    if eps >= float(THRESHOLDS["hard_stop"]):
        disposition = "hard_stop"
    elif eps > float(THRESHOLDS["drift_quarantine"]):
        disposition = "chi_quarantine"
    else:
        disposition = "clean"
    chi = evaluate_chi_t({
        "epsilon_s": eps,
        "candidate_id": candidate["candidate_id"],
        "math_terms": {"chi_required": disposition == "chi_quarantine", "circuit_breaker": disposition == "hard_stop"},
    })
    return {
        "epsilon_s": round(eps, 6),
        "disposition": disposition,
        "bands": {
            "clean_at_or_under": THRESHOLDS["drift_quarantine"],
            "hard_stop_above": THRESHOLDS["hard_stop"],
            "cite": "source/engine/rmc_engine_v1/mobile_config.py",
        },
        "formula": "measurement_kernel.symbolic_epsilon via measure_candidate",
        "coherence_measured": components.get("coherence_score"),
        "coherence_formula": components.get("formula"),
        "coherence_components": {k: components.get(k) for k in (
            "memory_fit", "phase_validity", "drift_containment", "source_confidence",
            "utility_fit", "bounded_novelty_score", "operator_legality",
            "conflict_penalty", "projection_gate_penalty", "coherence_score",
        )},
        "chi": {
            "status": chi.get("status"),
            "chi_required": chi.get("chi_required"),
            "chi_attempted": chi.get("chi_attempted"),
            "route_recommendation": chi.get("route_recommendation"),
            "cite": "rmc_engine_v1.chi_correction_gate.evaluate_chi_t",
            "christping_initiated": False,
            "christping_owner": "gilligan_only",
            "cite_owner": "source/src/dream_idle.js Only Gilligan initiates ChristPing",
        },
        "calls_llm": False,
    }


def _original_premises(chosen: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Facts the hop rests on. A derived row expands to the facts that made it."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(fact: dict[str, Any]) -> None:
        if fact.get("source") == "derive" and fact.get("source_facts"):
            for src in fact.get("source_facts") or []:
                if isinstance(src, dict):
                    add(src)
            return
        fid = str(fact.get("id") or "")
        if fid in seen:
            return
        seen.add(fid)
        out.append(fact)

    for fact in chosen:
        add(fact)
    return out


def _hop_row(text: str, provenance: list[Any], drift: dict[str, Any], n: int) -> dict[str, Any]:
    chi = drift.get("chi") if isinstance(drift.get("chi"), dict) else {}
    return {
        "n": n,
        "text": text,
        "provenance": list(provenance),
        "drift": {"epsilon_s": drift.get("epsilon_s"), "disposition": drift.get("disposition")},
        "chi": {
            "status": chi.get("status"),
            "christping_initiated": False,
            "christping_owner": "gilligan_only",
        },
    }


def _attach_speech(claims: list[dict[str, Any]], topical: list[dict[str, Any]], world: dict[str, Any], phase_path: list[Any]) -> None:
    """Speak the chain, not only the last copula. Each extra sentence is debated first."""
    # The report picks the survivor. Speech is attached to every survivor so
    # that winner still carries the chain.
    for claim in [c for c in claims if c.get("debate", {}).get("survived")]:
        parts: list[str] = []

        def add(text: str) -> None:
            sentence = str(text or "").strip()
            if sentence and sentence not in parts and len(parts) < 4:
                parts.append(sentence)

        for hop in claim.get("hops") or []:
            add(str(hop.get("text") or ""))
        if not parts:
            add(str(claim.get("text") or ""))
        roles: set[str] = set()
        atom = claim.get("atom") or {}
        if atom.get("predicate") == "is":
            roles = {_norm(a) for a in (atom.get("args") or []) if _norm(a)}
        sources: set[str] = set()
        for premise in claim.get("premises") or []:
            if not isinstance(premise, dict):
                continue
            if premise.get("id"):
                sources.add(str(premise.get("id")))
            for pid in premise.get("provenance") or []:
                sources.add(str(pid))
        extras = []
        for fact in topical:
            if fact.get("self_fact") or fact.get("quarantined"):
                continue
            if str(fact.get("text") or "") in parts:
                continue
            prov = {str(pid) for pid in (fact.get("provenance") or [])}
            share_src = bool(prov & sources) or str(fact.get("id") or "") in sources
            fat = fact.get("atom") or {}
            share_role = False
            if fat.get("predicate") == "is" and roles:
                share_role = any(_norm(a) in roles for a in (fat.get("args") or []))
            if share_src or share_role:
                extras.append(fact)
        extras.sort(key=lambda f: (str(f.get("text") or ""), str(f.get("id") or "")))
        for fact in extras:
            if len(parts) >= 4:
                break
            proof = _direct_proof(world, fact)
            checked = check_proof(world, proof)
            sib = _finish_claim(
                world, fact["text"], fact["atom"], [fact], proof, checked, "supported_only", "direct", phase_path,
            )
            if sib.get("debate", {}).get("survived") and (sib.get("drift") or {}).get("disposition") == "clean":
                add(fact["text"])
                hop = (sib.get("hops") or [{}])[0]
                hop = dict(hop)
                hop["n"] = len(claim.get("hops") or []) + 1
                claim.setdefault("hops", []).append(hop)
        claim["spoken"] = " ".join(parts)


def derive(world: dict[str, Any], question: str, phase_path: list[Any] | None = None, qframe: dict[str, Any] | None = None) -> dict[str, Any]:
    """Spec §1.4 Derive. Contract §5 four-valued result. Contract §6 steps 6–8.

    4.9.233 (plan 229 step 5): with the phone's question frame, Derive matches by frame and phase/band alignment
    (_derive_by_frame). Without a frame (an engine-only caller) the older word-coverage ranking runs and says so.
    """
    facts = _active(world)
    # Self-facts answer a question about Forge. They are not topical premises for other questions.
    topical = [f for f in facts if not f.get("self_fact")]
    q_tokens = content_tokens(question)
    claims: list[dict[str, Any]] = []
    incomplete = False
    if len(question) > LIMITS["MAX_INPUT_CHARS"]:
        return _derive_report(world, question, "incomplete", "MAX_INPUT_CHARS", claims, True)
    # 4.9.241: a framed question is matched by its frame even when it has no content word ("Who are you?": kartṛ you,
    # the gap the predicate); token coverage is not what decides it
    if isinstance(qframe, dict) and qframe.get("kriya") and (qframe.get("parsed") or qframe.get("partial")):
        return _derive_by_frame(world, question, phase_path or [], qframe, topical)
    if not q_tokens:
        return _derive_report(world, question, "undetermined", "no content tokens in the question", claims, incomplete)

    # Direct support. Contract acceptance C: a stored fact that answers the query.
    ranked = sorted(topical, key=lambda f: (-_role_lock(question, f["text"]), -_coverage(question, f["text"]), str(f.get("text") or ""), str(f["id"])))
    for fact in ranked[:8]:
        if _coverage(question, fact["text"]) <= 0:
            continue
        proof = _direct_proof(world, fact)
        checked = check_proof(world, proof)
        claims.append(_finish_claim(
            world, fact["text"], fact["atom"], [fact], proof, checked, "supported_only", "direct", phase_path or [],
        ))
        if len(claims) >= 4:
            break

    # Copula chain. Contract §5 multi-hop. One rule, bounded rounds.
    # Each round may use a conclusion from the round before it. Provenance
    # stays the original admitted facts. Drift is recorded on every hop.
    pool = list(topical)
    proof_facts = list(world.get("facts") or [])
    seen: set[tuple[str, str, str]] = set()
    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        if atom.get("predicate") == "is" and len(args) >= 2:
            seen.add((_norm(args[0]), _norm(args[1]), str(atom.get("polarity") or "pos")))
    rounds = 0
    while rounds < LIMITS["MAX_ROUNDS"] and len(claims) < 12:
        rounds += 1
        hops = _match_body(COPULA_RULE["body"], [f for f in pool if not f.get("self_fact")])
        added = 0
        for sub, chosen in hops:
            if len(claims) >= 12:
                incomplete = True
                break
            conclusion = _atom("is", [
                chosen[0]["atom"]["args"][0],
                chosen[1]["atom"]["args"][1],
            ], "pos")
            key = (_norm(conclusion["args"][0]), _norm(conclusion["args"][1]), "pos")
            if key in seen or _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                continue
            text = _render_atom(conclusion)
            if _coverage(question, text) <= 0:
                continue
            proof_world = dict(world)
            proof_world["facts"] = proof_facts
            proof = _chain_proof(proof_world, chosen[0], chosen[1], sub, conclusion)
            checked = check_proof(proof_world, proof)
            premises = _original_premises(chosen)
            claim = _finish_claim(
                world, text, conclusion, premises, proof, checked, "supported_only", "WM-COPULA-CHAIN", phase_path or [],
            )
            hop_rows: list[dict[str, Any]] = []
            for fact in chosen:
                prior = fact.get("hop_trace") if isinstance(fact.get("hop_trace"), list) else None
                if prior:
                    hop_rows.extend(prior)
                    continue
                measured = _drift_for(fact["text"], [fact], phase_path or [])
                hop_rows.append(_hop_row(
                    fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, len(hop_rows) + 1,
                ))
            hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
            for i, hop in enumerate(hop_rows, start=1):
                hop["n"] = i
            claim["hops"] = hop_rows
            claims.append(claim)
            if claim.get("debate", {}).get("survived") is not True:
                continue
            seen.add(key)
            fid = "hop-" + _digest(text)[:12]
            row = _fact_row(
                fid, {"text": text, "atom": conclusion, "parsed": True, "atom_source": "derive", "place": _derived_place(chosen)},
                source="derive", provenance=[p.get("id") for p in premises], quarantined=False,
                cite="contract 1g2034-K §5 bounded multi-hop forward derivation",
            )
            row["source_facts"] = premises
            row["hop_trace"] = hop_rows
            pool.append(row)
            proof_facts = proof_facts + [row]
            added += 1
        if added == 0:
            break

    cclaims, pool, proof_facts, seen, c_incomplete = _contain_chain(world, question, phase_path or [], pool, proof_facts, seen, None)
    claims.extend(cclaims)
    incomplete = incomplete or c_incomplete
    pclaims, pool, proof_facts, p_incomplete = _place_chains(world, question, phase_path or [], pool, proof_facts, None)
    claims.extend(pclaims)
    incomplete = incomplete or p_incomplete
    tclaims, pool, proof_facts, t_incomplete = _part_chain(world, question, phase_path or [], pool, proof_facts, None)
    claims.extend(tclaims)
    incomplete = incomplete or t_incomplete
    aclaims, pool, proof_facts, a_incomplete = _ancestor_chain(world, question, phase_path or [], pool, proof_facts, None)
    sclaims, pool, proof_facts, s_incomplete = _symmetric(world, question, phase_path or [], pool, proof_facts, None)
    oclaims, pool, proof_facts, o_incomplete = _order_chain(world, question, phase_path or [], pool, proof_facts, None)
    mclaims, pool, proof_facts, m_incomplete = _cmp_chain(world, question, phase_path or [], pool, proof_facts, None)
    claims.extend(aclaims)
    claims.extend(sclaims)
    claims.extend(oclaims)
    claims.extend(mclaims)
    incomplete = incomplete or a_incomplete or s_incomplete or o_incomplete or m_incomplete

    # Both polarities. Contract §5. A positive and a negative for the same normalized atom conflict.
    for claim in claims:
        atom = claim["atom"]
        if atom.get("predicate") not in ("is", "in", "live", "geo", "part", "ancestor", "descendant", "parent", "child", "married", "next", "adjacent", "sibling", "before", "after", "above", "below", "older_than", "younger_than", "greater_than", "less_than"):
            continue
        opposite = "neg" if atom.get("polarity") != "neg" else "pos"
        for other in topical:
            oatom = other.get("atom") or {}
            if oatom.get("predicate") != atom.get("predicate") or oatom.get("polarity") != opposite:
                continue
            if [_norm(a) for a in atom.get("args") or []] == [_norm(a) for a in oatom.get("args") or []]:
                claim["status"] = "conflicted"
                claim["debate"] = run_debate(claim, content_tokens=content_tokens)

    survivors = [c for c in claims if c.get("status") != "conflicted" and c.get("debate", {}).get("survived") is True]
    if any(c.get("status") == "conflicted" for c in claims) and not survivors:
        status = "conflicted"
    elif survivors:
        status = "supported_only"
    elif incomplete:
        status = "incomplete"
    elif claims:
        status = "undetermined"
    else:
        status = "undetermined"
    _attach_speech(claims, topical, world, phase_path or [])
    report = _derive_report(world, question, status, "closure" if not incomplete else "MAX_ROUNDS", claims, incomplete)
    return report


def _frame_claim(claim: dict[str, Any], fact_frame: dict[str, Any] | None, source: str, matched: dict[str, Any] | None,
                 aligned: dict[str, Any], question: str) -> dict[str, Any]:
    claim["frame_match"] = dict(matched, frame_source=source, complete=bool((fact_frame or {}).get("complete", True))) if matched else None
    claim["fact_frame"] = fact_frame
    claim["alignment"] = aligned
    # logged tie-break only; never the reason a fact answers
    claim["coverage_tiebreak"] = round(float(_coverage(question, claim.get("text") or "")), 6)
    return claim


def _frame_key(c: dict[str, Any]) -> tuple:
    m = c.get("frame_match") or {}
    a = c.get("alignment") or {}
    return (
        -int(bool(m)), -int(bool((c.get("gate") or {}).get("passes"))), -int(m.get("roles") or 0), -int(bool(m.get("complete"))),
        -float((c.get("gate") or {}).get("G") or 0.0), -int(a.get("band_key") or 0), -float(a.get("coupling") or 0.0),
        len(c.get("provenance") or []), -float(c.get("coverage_tiebreak") or 0.0),
        float((c.get("drift") or {}).get("epsilon_s") or 0.0), str(c.get("text") or ""), str(c.get("proof_id") or ""),
    )


def _cap(sentence: str) -> str:
    t = str(sentence or "").strip()
    t = t[:1].upper() + t[1:] if t else t
    return t if not t or t[-1] in ".!?" else t + "."


def _contain_text(chosen: list[dict[str, Any]], conclusion: dict[str, Any]) -> str:
    """Say the chain in the preposition or verb the premises already used. inside, within and contain are one atom."""
    from rmc_engine_v1 import derive_frame as DF
    preps: list[str] = []
    verbs = False
    for fact in chosen:
        ff, _ = DF.fact_frame(fact)
        if not isinstance(ff, dict):
            continue
        if str(ff.get("kriya") or "").lower() == "contain":
            verbs = True
        pred = ff.get("pred") if isinstance(ff.get("pred"), dict) else None
        prep = str((pred or {}).get("prep") or "").lower()
        if prep in ("inside", "within"):
            preps.append(prep)
    args = [str(a) for a in conclusion.get("args") or []]
    if len(args) < 2:
        return _render_atom(conclusion)
    if preps and not verbs and all(p == preps[0] for p in preps):
        return f"{args[0]} is {preps[0]} {args[1]}."
    if verbs and not preps:
        return f"{args[1]} contains {args[0]}."
    return _render_atom(conclusion)


def _contain_chain(world: dict[str, Any], question: str, phase_path: list[Any], pool: list[dict[str, Any]], proof_facts: list[dict[str, Any]], seen: set[tuple[str, str, str]], qframe: dict[str, Any] | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], set[tuple[str, str, str]], bool]:
    """Forward-chain WM-CONTAIN-CHAIN on the same unifier as the copula rule. Only positive in(content, container) facts.
     A conclusion is not symmetric and a cycle (x inside x) is the distinct guard."""
    from rmc_engine_v1 import derive_frame as DF
    claims: list[dict[str, Any]] = []
    incomplete = False
    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        if atom.get("predicate") == "in" and atom.get("polarity", "pos") == "pos" and len(args) >= 2:
            seen.add((_norm(args[0]), _norm(args[1]), "pos"))
    rounds = 0
    while rounds < LIMITS["MAX_ROUNDS"]:
        rounds += 1
        hops = _match_body(CONTAIN_RULE["body"], [f for f in pool if not f.get("self_fact")])
        added = 0
        for sub, chosen in hops:
            if len(claims) >= 24:
                incomplete = True
                break
            conclusion = _atom("in", [chosen[0]["atom"]["args"][0], chosen[1]["atom"]["args"][1]], "pos")
            key = (_norm(conclusion["args"][0]), _norm(conclusion["args"][1]), "pos")
            if key in seen or _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                continue
            text = _contain_text(chosen, conclusion)
            if qframe is None and _coverage(question, text) <= 0:
                continue
            proof_world = dict(world)
            proof_world["facts"] = proof_facts
            proof = _chain_proof(proof_world, chosen[0], chosen[1], sub, conclusion, "WM-CONTAIN-CHAIN")
            checked = check_proof(proof_world, proof)
            premises = _original_premises(chosen)
            claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", "WM-CONTAIN-CHAIN", phase_path or [])
            hop_rows: list[dict[str, Any]] = []
            for fact in chosen:
                prior = fact.get("hop_trace") if isinstance(fact.get("hop_trace"), list) else None
                if prior:
                    hop_rows.extend(prior)
                    continue
                measured = _drift_for(fact["text"], [fact], phase_path or [])
                hop_rows.append(_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, len(hop_rows) + 1))
            hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
            for i, hop in enumerate(hop_rows, start=1):
                hop["n"] = i
            claim["hops"] = hop_rows
            cframe = DF.contain_frame(conclusion)
            if qframe is not None:
                place = _derived_place(chosen)
                m = DF.match(qframe, cframe)
                _frame_claim(claim, cframe, "chain", m, DF.alignment(place or {"text": text}, phase_path, question), question)
                claim["_place"] = place or {"text": text}
                claim["_premise_rows"] = list(premises)
                claim["intermediate"] = not bool(m)
            claims.append(claim)
            if claim.get("debate", {}).get("survived") is not True:
                continue
            seen.add(key)
            row = _fact_row(
                "hop-" + _digest(text)[:12], {"text": text, "atom": conclusion, "parsed": True, "atom_source": "derive", "place": _derived_place(chosen), "frame": cframe},
                source="derive", provenance=[p.get("id") for p in premises], quarantined=False, cite=CONTAIN_RULE["cite"],
            )
            row["source_facts"] = premises
            row["hop_trace"] = hop_rows
            pool.append(row)
            proof_facts = proof_facts + [row]
            added += 1
        if added == 0:
            break
    return claims, pool, proof_facts, seen, incomplete


def _place_chains(world: dict[str, Any], question: str, phase_path: list[Any], pool: list[dict[str, Any]], proof_facts: list[dict[str, Any]], qframe: dict[str, Any] | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], bool]:
    """WM-GEO-CHAIN and WM-LIVE-GEO. Geographic inclusion is not enclosure and not every copular in.
    Residence composes with a geographic premise; it does not run backwards and it does not chain with itself."""
    from rmc_engine_v1 import derive_frame as DF
    claims: list[dict[str, Any]] = []
    incomplete = False
    seen: set[tuple[str, str, str, str]] = set()
    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        if atom.get("predicate") in ("geo", "live") and atom.get("polarity", "pos") == "pos" and len(args) >= 2:
            seen.add((str(atom.get("predicate")), _norm(args[0]), _norm(args[1]), "pos"))

    def emit(rule: dict[str, Any], chosen: list[dict[str, Any]], sub: dict[str, str], conclusion: dict[str, Any], cframe: dict[str, Any]) -> bool:
        nonlocal incomplete
        if len(claims) >= 24:
            incomplete = True
            return False
        key = (str(conclusion.get("predicate")), _norm(conclusion["args"][0]), _norm(conclusion["args"][1]), "pos")
        if key in seen or _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
            return False
        text = _render_atom(conclusion)
        if qframe is None and _coverage(question, text) <= 0:
            return False
        proof_world = dict(world)
        proof_world["facts"] = proof_facts
        proof = _chain_proof(proof_world, chosen[0], chosen[1], sub, conclusion, rule["id"])
        checked = check_proof(proof_world, proof)
        premises = _original_premises(chosen)
        claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", rule["id"], phase_path or [])
        hop_rows: list[dict[str, Any]] = []
        for fact in chosen:
            prior = fact.get("hop_trace") if isinstance(fact.get("hop_trace"), list) else None
            if prior:
                hop_rows.extend(prior)
                continue
            measured = _drift_for(fact["text"], [fact], phase_path or [])
            hop_rows.append(_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, len(hop_rows) + 1))
        hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
        for i, hop in enumerate(hop_rows, start=1):
            hop["n"] = i
        claim["hops"] = hop_rows
        if qframe is not None:
            place = _derived_place(chosen)
            m = DF.match(qframe, cframe)
            _frame_claim(claim, cframe, "chain", m, DF.alignment(place or {"text": text}, phase_path, question), question)
            claim["_place"] = place or {"text": text}
            claim["_premise_rows"] = list(premises)
            claim["intermediate"] = not bool(m)
        claims.append(claim)
        if claim.get("debate", {}).get("survived") is not True:
            return False
        seen.add(key)
        row = _fact_row(
            "hop-" + _digest(text)[:12],
            {"text": text, "atom": conclusion, "parsed": True, "atom_source": "derive", "place": _derived_place(chosen), "frame": cframe},
            source="derive", provenance=[p.get("id") for p in premises], quarantined=False, cite=rule["cite"],
        )
        row["source_facts"] = premises
        row["hop_trace"] = hop_rows
        pool.append(row)
        proof_facts.append(row)
        return True

    rounds = 0
    while rounds < LIMITS["MAX_ROUNDS"]:
        rounds += 1
        added = 0
        for rule in (GEO_RULE, LIVE_RULE):
            hops = _match_body(rule["body"], [f for f in pool if not f.get("self_fact")])
            for sub, chosen in hops:
                left, right = chosen[0], chosen[1]
                lf, _ = DF.fact_frame(left)
                rf, _ = DF.fact_frame(right)
                if rule["id"] == "WM-GEO-CHAIN":
                    a, _b = DF.geo_places(lf)
                    _c, d = DF.geo_places(rf)
                    if not (isinstance(a, dict) and a.get("loc") and isinstance(d, dict) and d.get("loc")):
                        continue
                    conclusion = _atom("geo", [left["atom"]["args"][0], right["atom"]["args"][1]], "pos")
                    cframe = {"kriya": "be", "polarity": "pos", "kartr": a, "pred": {"type": "pp", "prep": "in", "text": d.get("text"), "np": d}, "derived": True}
                else:
                    person, _place = DF.live_place(lf)
                    _region, dest = DF.geo_places(rf)
                    if not (isinstance(person, dict) and isinstance(dest, dict) and dest.get("loc")):
                        continue
                    conclusion = _atom("live", [left["atom"]["args"][0], right["atom"]["args"][1]], "pos")
                    cframe = {"kriya": "live", "polarity": "pos", "kartr": person, "adj": [{"prep": "in", "role": "adhikarana", "np": dest}], "derived": True}
                if emit(rule, chosen, sub, conclusion, cframe):
                    added += 1
                if incomplete:
                    break
            if incomplete:
                break
        if added == 0 or incomplete:
            break
    return claims, pool, proof_facts, incomplete


def _part_chain(world: dict[str, Any], question: str, phase_path: list[Any], pool: list[dict[str, Any]], proof_facts: list[dict[str, Any]], qframe: dict[str, Any] | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], bool]:
    """WM-PART-CHAIN. Only positive part(part, whole) facts. Not symmetric, and a cycle is the distinct guard."""
    from rmc_engine_v1 import derive_frame as DF
    claims: list[dict[str, Any]] = []
    incomplete = False
    seen: set[tuple[str, str]] = set()
    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        if atom.get("predicate") == "part" and atom.get("polarity", "pos") == "pos" and len(args) >= 2:
            seen.add((_norm(args[0]), _norm(args[1])))
    rounds = 0
    while rounds < LIMITS["MAX_ROUNDS"]:
        rounds += 1
        added = 0
        hops = _match_body(PART_RULE["body"], [f for f in pool if not f.get("self_fact")])
        for sub, chosen in hops:
            if len(claims) >= 24:
                incomplete = True
                break
            if _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                continue
            conclusion = _atom("part", [chosen[0]["atom"]["args"][0], chosen[1]["atom"]["args"][1]], "pos")
            key = (_norm(conclusion["args"][0]), _norm(conclusion["args"][1]))
            if key in seen:
                continue
            left_f, _ = DF.fact_frame(chosen[0])
            right_f, _ = DF.fact_frame(chosen[1])
            part_np = (left_f or {}).get("kartr") if isinstance(left_f, dict) else None
            whole = ((right_f or {}).get("pred") or {}).get("of") if isinstance(right_f, dict) and isinstance((right_f or {}).get("pred"), dict) else None
            if not isinstance(part_np, dict) or not isinstance(whole, dict):
                continue
            text = _render_atom(conclusion)
            if qframe is None and _coverage(question, text) <= 0:
                continue
            cframe = {"kriya": "be", "polarity": "pos", "kartr": part_np, "pred": {"type": "np", "text": "part of " + str(whole.get("text") or ""), "head": "part", "of": whole}, "derived": True}
            proof_world = dict(world)
            proof_world["facts"] = proof_facts
            proof = _chain_proof(proof_world, chosen[0], chosen[1], sub, conclusion, PART_RULE["id"])
            checked = check_proof(proof_world, proof)
            premises = _original_premises(chosen)
            claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", PART_RULE["id"], phase_path or [])
            hop_rows: list[dict[str, Any]] = []
            for fact in chosen:
                prior = fact.get("hop_trace") if isinstance(fact.get("hop_trace"), list) else None
                if prior:
                    hop_rows.extend(prior)
                    continue
                measured = _drift_for(fact["text"], [fact], phase_path or [])
                hop_rows.append(_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, len(hop_rows) + 1))
            hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
            for i, hop in enumerate(hop_rows, start=1):
                hop["n"] = i
            claim["hops"] = hop_rows
            if qframe is not None:
                place = _derived_place(chosen)
                m = DF.match(qframe, cframe)
                _frame_claim(claim, cframe, "chain", m, DF.alignment(place or {"text": text}, phase_path, question), question)
                claim["_place"] = place or {"text": text}
                claim["_premise_rows"] = list(premises)
                claim["intermediate"] = not bool(m)
            claims.append(claim)
            if claim.get("debate", {}).get("survived") is not True:
                continue
            seen.add(key)
            row = _fact_row("hop-" + _digest(text)[:12], {"text": text, "atom": conclusion, "parsed": True, "atom_source": "derive", "place": _derived_place(chosen), "frame": cframe}, source="derive", provenance=[p.get("id") for p in premises], quarantined=False, cite=PART_RULE["cite"])
            row["source_facts"] = premises
            row["hop_trace"] = hop_rows
            pool.append(row)
            proof_facts.append(row)
            added += 1
        if added == 0 or incomplete:
            break
    return claims, pool, proof_facts, incomplete


def _of_frame(kind: str, person: dict[str, Any], other: dict[str, Any]) -> dict[str, Any]:
    det = "an" if kind == "ancestor" else "a"
    return {"kriya": "be", "polarity": "pos", "kartr": person, "pred": {"type": "np", "text": det + " " + kind + " of " + str(other.get("text") or ""), "head": kind, "det": det, "of": other}, "derived": True}


def _ancestor_chain(world: dict[str, Any], question: str, phase_path: list[Any], pool: list[dict[str, Any]], proof_facts: list[dict[str, Any]], qframe: dict[str, Any] | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], bool]:
    """Ancestor chains with ancestor. Descendant is only the inverse, never a part-of or containment hop."""
    from rmc_engine_v1 import derive_frame as DF
    claims: list[dict[str, Any]] = []
    incomplete = False
    seen: set[tuple[str, str, str]] = set()

    def note(pred: str, a: str, b: str) -> None:
        seen.add((pred, _norm(a), _norm(b)))

    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        if atom.get("predicate") in ("ancestor", "descendant", "parent", "child") and atom.get("polarity", "pos") == "pos" and len(args) >= 2:
            note(str(atom.get("predicate")), args[0], args[1])

    def emit(rule: dict[str, Any], chosen: list[dict[str, Any]], sub: dict[str, str], conclusion: dict[str, Any], cframe: dict[str, Any]) -> bool:
        nonlocal incomplete
        if len(claims) >= 24:
            incomplete = True
            return False
        key = (str(conclusion.get("predicate")), _norm(conclusion["args"][0]), _norm(conclusion["args"][1]))
        if key in seen:
            return False
        text = _render_atom(conclusion)
        if qframe is None and _coverage(question, text) <= 0:
            return False
        matched = DF.match(qframe, cframe) if qframe is not None else None
        proof_world = dict(world)
        proof_world["facts"] = proof_facts
        steps = [{"n": i + 1, "kind": "fact", "fact_id": fact["id"], "premises": [], "substitution": {}, "atom": fact["atom"]} for i, fact in enumerate(chosen)]
        steps.append({"n": len(chosen) + 1, "kind": "rule", "rule_id": rule["id"], "premises": list(range(1, len(chosen) + 1)), "substitution": sub, "atom": conclusion})
        proof = _proof_shell(proof_world, conclusion, steps)
        checked = check_proof(proof_world, proof)
        premises = _original_premises(chosen)
        claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", rule["id"], phase_path or [])
        if rule["id"] in ("WM-ANCESTOR-INVERSE", "WM-DESCENDANT-INVERSE", "WM-PARENT-INVERSE", "WM-CHILD-INVERSE"):
            _licensed(world, claim, rule)
        hop_rows: list[dict[str, Any]] = []
        for fact in chosen:
            prior = fact.get("hop_trace") if isinstance(fact.get("hop_trace"), list) else None
            if prior:
                hop_rows.extend(prior)
                continue
            measured = _drift_for(fact["text"], [fact], phase_path or [])
            hop_rows.append(_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, len(hop_rows) + 1))
        hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
        for i, hop in enumerate(hop_rows, start=1):
            hop["n"] = i
        claim["hops"] = hop_rows
        place = _derived_place(chosen)
        if qframe is not None:
            _frame_claim(claim, cframe, "chain", matched, DF.alignment(place or {"text": text}, phase_path, question), question)
            claim["_place"] = place or {"text": text}
            claim["_premise_rows"] = list(premises)
            claim["intermediate"] = not bool(matched)
        claims.append(claim)
        if claim.get("debate", {}).get("survived") is not True:
            return False
        note(str(conclusion.get("predicate")), conclusion["args"][0], conclusion["args"][1])
        row = _fact_row("hop-" + _digest(text)[:12], {"text": text, "atom": conclusion, "parsed": True, "atom_source": "derive", "place": place, "frame": cframe}, source="derive", provenance=[p.get("id") for p in premises], quarantined=False, cite=rule["cite"])
        row["source_facts"] = premises
        row["hop_trace"] = hop_rows
        pool.append(row)
        proof_facts.append(row)
        return True

    rounds = 0
    while rounds < LIMITS["MAX_ROUNDS"]:
        rounds += 1
        added = 0
        hops = _match_body(ANCESTOR_RULE["body"], [f for f in pool if not f.get("self_fact")])
        for sub, chosen in hops:
            if _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                continue
            left_f, _ = DF.fact_frame(chosen[0])
            right_f, _ = DF.fact_frame(chosen[1])
            person = (left_f or {}).get("kartr") if isinstance(left_f, dict) else None
            other = ((right_f or {}).get("pred") or {}).get("of") if isinstance(right_f, dict) and isinstance((right_f or {}).get("pred"), dict) else None
            if not isinstance(person, dict) or not isinstance(other, dict):
                continue
            conclusion = _atom("ancestor", [chosen[0]["atom"]["args"][0], chosen[1]["atom"]["args"][1]], "pos")
            if emit(ANCESTOR_RULE, chosen, sub, conclusion, _of_frame("ancestor", person, other)):
                added += 1
            if incomplete:
                break
        for fact in list(pool):
            atom = fact.get("atom") or {}
            args = atom.get("args") or []
            if atom.get("predicate") != "ancestor" or atom.get("polarity", "pos") != "pos" or len(args) < 2:
                continue
            if _norm(args[0]) == _norm(args[1]):
                continue
            ff, _ = DF.fact_frame(fact)
            pred = (ff or {}).get("pred") if isinstance(ff, dict) else None
            elder = (ff or {}).get("kartr") if isinstance(ff, dict) else None
            younger = pred.get("of") if isinstance(pred, dict) else None
            if not isinstance(elder, dict) or not isinstance(younger, dict):
                continue
            conclusion = _atom("descendant", [args[1], args[0]], "pos")
            sub = {"$x": str(args[0]), "$y": str(args[1])}
            if emit(ANCESTOR_INVERSE, [fact], sub, conclusion, _of_frame("descendant", younger, elder)):
                added += 1
            if incomplete:
                break
        hops = _match_body(DESCENDANT_RULE["body"], [f for f in pool if not f.get("self_fact")])
        for sub, chosen in hops:
            if _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                continue
            left_f, _ = DF.fact_frame(chosen[0])
            right_f, _ = DF.fact_frame(chosen[1])
            person = (left_f or {}).get("kartr") if isinstance(left_f, dict) else None
            other = ((right_f or {}).get("pred") or {}).get("of") if isinstance(right_f, dict) and isinstance((right_f or {}).get("pred"), dict) else None
            if not isinstance(person, dict) or not isinstance(other, dict):
                continue
            conclusion = _atom("descendant", [chosen[0]["atom"]["args"][0], chosen[1]["atom"]["args"][1]], "pos")
            if emit(DESCENDANT_RULE, chosen, sub, conclusion, _of_frame("descendant", person, other)):
                added += 1
            if incomplete:
                break
        for fact in list(pool):
            atom = fact.get("atom") or {}
            args = atom.get("args") or []
            pred_name = str(atom.get("predicate") or "")
            if atom.get("polarity", "pos") != "pos" or len(args) < 2 or _norm(args[0]) == _norm(args[1]):
                continue
            if pred_name not in ("descendant", "parent", "child"):
                continue
            ff, _ = DF.fact_frame(fact)
            pred = (ff or {}).get("pred") if isinstance(ff, dict) else None
            subject = (ff or {}).get("kartr") if isinstance(ff, dict) else None
            complement = pred.get("of") if isinstance(pred, dict) else None
            if not isinstance(subject, dict) or not isinstance(complement, dict):
                continue
            sub = {"$x": str(args[0]), "$y": str(args[1])}
            if pred_name == "descendant":
                conclusion = _atom("ancestor", [args[1], args[0]], "pos")
                fired = emit(DESCENDANT_INVERSE, [fact], sub, conclusion, _of_frame("ancestor", complement, subject))
            elif pred_name == "parent":
                conclusion = _atom("child", [args[1], args[0]], "pos")
                fired = emit(PARENT_INVERSE, [fact], sub, conclusion, _of_frame("child", complement, subject))
            else:
                conclusion = _atom("parent", [args[1], args[0]], "pos")
                fired = emit(CHILD_INVERSE, [fact], sub, conclusion, _of_frame("parent", complement, subject))
            if fired:
                added += 1
            if incomplete:
                break
        if added == 0 or incomplete:
            break
    return claims, pool, proof_facts, incomplete


def _to_frame(kind: str, person: dict[str, Any], other: dict[str, Any]) -> dict[str, Any]:
    return {"kriya": "be", "polarity": "pos", "kartr": person, "pred": {"type": "adj", "text": kind}, "adj": [{"prep": "to", "role": "sampradana", "np": other}], "derived": True}


def _symmetric(world: dict[str, Any], question: str, phase_path: list[Any], pool: list[dict[str, Any]], proof_facts: list[dict[str, Any]], qframe: dict[str, Any] | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], bool]:
    """One swap of a stated symmetric atom. Not a chain, and not a fact invented from a shared partner."""
    from rmc_engine_v1 import derive_frame as DF
    rules = {r["body"][0]["predicate"]: r for r in SYMMETRIC_RULES}
    claims: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        pred = str(atom.get("predicate") or "")
        if pred in rules and atom.get("polarity", "pos") == "pos" and len(args) >= 2:
            seen.add((pred, _norm(args[0]), _norm(args[1])))
    for fact in list(pool):
        if fact.get("source") == "derive" or len(claims) >= 24:
            continue
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        pred = str(atom.get("predicate") or "")
        if pred not in rules or atom.get("polarity", "pos") != "pos" or len(args) < 2 or _norm(args[0]) == _norm(args[1]):
            continue
        key = (pred, _norm(args[1]), _norm(args[0]))
        if key in seen:
            continue
        ff, _ = DF.fact_frame(fact)
        if not isinstance(ff, dict):
            continue
        subject = ff.get("kartr") if isinstance(ff.get("kartr"), dict) else None
        if pred == "sibling":
            other = (ff.get("pred") or {}).get("of") if isinstance(ff.get("pred"), dict) else None
            if not isinstance(subject, dict) or not isinstance(other, dict):
                continue
            cframe = _of_frame("sibling", other, subject)
        else:
            other = None
            for adj in ff.get("adj") or []:
                if isinstance(adj, dict) and str(adj.get("prep") or "").lower() == "to" and isinstance(adj.get("np"), dict):
                    other = adj["np"]
            if not isinstance(subject, dict) or not isinstance(other, dict):
                continue
            cframe = _to_frame(pred, other, subject)
        rule = rules[pred]
        conclusion = _atom(pred, [args[1], args[0]], "pos")
        text = _render_atom(conclusion)
        matched = DF.match(qframe, cframe) if qframe is not None else None
        if qframe is not None and not matched:
            continue
        if qframe is None and _coverage(question, text) <= 0:
            continue
        sub = {"$x": str(args[0]), "$y": str(args[1])}
        proof_world = dict(world)
        proof_world["facts"] = proof_facts
        steps = [{"n": 1, "kind": "fact", "fact_id": fact["id"], "premises": [], "substitution": {}, "atom": fact["atom"]},
                 {"n": 2, "kind": "rule", "rule_id": rule["id"], "premises": [1], "substitution": sub, "atom": conclusion}]
        proof = _proof_shell(proof_world, conclusion, steps)
        checked = check_proof(proof_world, proof)
        premises = _original_premises([fact])
        claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", rule["id"], phase_path or [])
        measured = _drift_for(fact["text"], [fact], phase_path or [])
        hop_rows = [_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, 1),
                    _hop_row(text, [p.get("id") for p in premises], claim["drift"], 2)]
        claim["hops"] = hop_rows
        place = _derived_place([fact])
        if qframe is not None:
            _frame_claim(claim, cframe, "chain", matched, DF.alignment(place or {"text": text}, phase_path, question), question)
            claim["_place"] = place or {"text": text}
            claim["_premise_rows"] = list(premises)
            claim["intermediate"] = False
        claims.append(claim)
        seen.add(key)
    if world.get("next_to_transitive") is True:
        for sub, chosen in _match_body(NEXT_CHAIN["body"], [f for f in pool if not f.get("self_fact")]):
            if _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")) or len(claims) >= 24:
                continue
            left_f, _ = DF.fact_frame(chosen[0])
            right_f, _ = DF.fact_frame(chosen[1])
            person = (left_f or {}).get("kartr") if isinstance(left_f, dict) else None
            other = None
            for adj in ((right_f or {}).get("adj") or []):
                if isinstance(adj, dict) and str(adj.get("prep") or "").lower() == "to" and isinstance(adj.get("np"), dict):
                    other = adj["np"]
            if not isinstance(person, dict) or not isinstance(other, dict):
                continue
            conclusion = _atom("next", [chosen[0]["atom"]["args"][0], chosen[1]["atom"]["args"][1]], "pos")
            key = ("next", _norm(conclusion["args"][0]), _norm(conclusion["args"][1]))
            if key in seen:
                continue
            cframe = _to_frame("next", person, other)
            text = _render_atom(conclusion)
            matched = DF.match(qframe, cframe) if qframe is not None else None
            if qframe is not None and not matched:
                continue
            if qframe is None and _coverage(question, text) <= 0:
                continue
            proof_world = dict(world)
            proof_world["facts"] = proof_facts
            steps = [{"n": i + 1, "kind": "fact", "fact_id": fact["id"], "premises": [], "substitution": {}, "atom": fact["atom"]} for i, fact in enumerate(chosen)]
            steps.append({"n": 3, "kind": "rule", "rule_id": NEXT_CHAIN["id"], "premises": [1, 2], "substitution": sub, "atom": conclusion})
            proof = _proof_shell(proof_world, conclusion, steps)
            checked = check_proof(proof_world, proof)
            premises = _original_premises(chosen)
            claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", NEXT_CHAIN["id"], phase_path or [])
            hop_rows = []
            for fact in chosen:
                measured = _drift_for(fact["text"], [fact], phase_path or [])
                hop_rows.append(_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, len(hop_rows) + 1))
            hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
            claim["hops"] = hop_rows
            place = _derived_place(chosen)
            if qframe is not None:
                _frame_claim(claim, cframe, "chain", matched, DF.alignment(place or {"text": text}, phase_path, question), question)
                claim["_place"] = place or {"text": text}
                claim["_premise_rows"] = list(premises)
                claim["intermediate"] = False
            claims.append(claim)
            seen.add(key)
    return claims, pool, proof_facts, False


def _measured_np(np: Any) -> bool:
    return isinstance(np, dict) and np.get("num") not in (None, "")


def _qual_key(frame: dict[str, Any] | None) -> tuple:
    """Scene and time adjuncts other than the order predicate. Two orders chain only when these match."""
    items = []
    for adj in (frame or {}).get("adj") or []:
        if not isinstance(adj, dict):
            continue
        prep = str(adj.get("prep") or "").lower()
        np = adj.get("np") if isinstance(adj.get("np"), dict) else {}
        text = _norm(str(np.get("text") or ""))
        if prep and text:
            items.append((str(adj.get("role") or ""), prep, text))
    return tuple(sorted(items))


def _order_quals(frame: dict[str, Any] | None) -> list[dict[str, Any]]:
    return [a for a in ((frame or {}).get("adj") or []) if isinstance(a, dict)]


def _order_frame(pred: str, kartr: dict[str, Any], other: dict[str, Any], quals: list[dict[str, Any]]) -> dict[str, Any]:
    return {"kriya": "be", "polarity": "pos", "kartr": kartr, "pred": {"type": "pp", "prep": pred, "text": other.get("text"), "np": other},
            "adj": list(quals), "derived": True}


def _order_text(atom: dict[str, Any], quals: list[dict[str, Any]]) -> str:
    base = _render_atom(atom).rstrip(".")
    extra = []
    for adj in quals:
        prep = str(adj.get("prep") or "")
        np = adj.get("np") if isinstance(adj.get("np"), dict) else {}
        if prep and np.get("text"):
            extra.append(prep + " " + str(np["text"]))
    return base + ((" " + " ".join(extra)) if extra else "") + "."


def _order_chain(world: dict[str, Any], question: str, phase_path: list[Any], pool: list[dict[str, Any]], proof_facts: list[dict[str, Any]], qframe: dict[str, Any] | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], bool]:
    """Chain one order domain. before/after do not mix with above/below, and a different scene or time blocks the hop."""
    from rmc_engine_v1 import derive_frame as DF
    claims: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()

    def note(pred: str, a: str, b: str) -> None:
        seen.add((pred, _norm(a), _norm(b)))

    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        pred = str(atom.get("predicate") or "")
        if pred in ORDER_CHAIN and atom.get("polarity", "pos") == "pos" and len(args) >= 2:
            note(pred, args[0], args[1])

    def emit(rule: dict[str, Any], chosen: list[dict[str, Any]], sub: dict[str, str], conclusion: dict[str, Any], cframe: dict[str, Any], text: str, pool_even_if_unmatched: bool) -> bool:
        if len(claims) >= 24:
            return False
        key = (str(conclusion.get("predicate")), _norm(conclusion["args"][0]), _norm(conclusion["args"][1]))
        if key in seen or _norm(conclusion["args"][0]) == _norm(conclusion["args"][1]):
            return False
        matched = DF.match(qframe, cframe) if qframe is not None else None
        if qframe is not None and not matched and not pool_even_if_unmatched:
            return False
        if qframe is None and _coverage(question, text) <= 0 and not pool_even_if_unmatched:
            return False
        proof_world = dict(world)
        proof_world["facts"] = proof_facts
        steps = [{"n": i + 1, "kind": "fact", "fact_id": fact["id"], "premises": [], "substitution": {}, "atom": fact["atom"]} for i, fact in enumerate(chosen)]
        steps.append({"n": len(chosen) + 1, "kind": "rule", "rule_id": rule["id"], "premises": list(range(1, len(chosen) + 1)), "substitution": sub, "atom": conclusion})
        proof = _proof_shell(proof_world, conclusion, steps)
        checked = check_proof(proof_world, proof)
        premises = _original_premises(chosen)
        claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", rule["id"], phase_path or [])
        if rule["id"].endswith("-INVERSE"):
            _licensed(world, claim, rule)
        hop_rows = []
        for fact in chosen:
            sources = fact.get("source_facts") if fact.get("source") == "derive" and fact.get("source_facts") else [fact]
            for src in sources:
                if not isinstance(src, dict):
                    continue
                measured = _drift_for(src.get("text") or "", [src], phase_path or [])
                hop_rows.append(_hop_row(src.get("text") or "", list(src.get("provenance") or [src.get("id")]), measured, len(hop_rows) + 1))
        hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
        claim["hops"] = hop_rows
        place = _derived_place(chosen)
        if qframe is not None and matched:
            _frame_claim(claim, cframe, "chain", matched, DF.alignment(place or {"text": text}, phase_path, question), question)
            claim["_place"] = place or {"text": text}
            claim["_premise_rows"] = list(premises)
            claim["intermediate"] = False
            claims.append(claim)
        elif qframe is None and _coverage(question, text) > 0:
            claims.append(claim)
        if claim.get("debate", {}).get("survived") is not True:
            return False
        note(str(conclusion.get("predicate")), conclusion["args"][0], conclusion["args"][1])
        row = _fact_row("hop-" + _digest(text)[:12], {"text": text, "atom": conclusion, "parsed": True, "atom_source": "derive", "place": place, "frame": cframe}, source="derive", provenance=[p.get("id") for p in premises], quarantined=False, cite=rule["cite"])
        row["source_facts"] = premises
        row["hop_trace"] = hop_rows
        pool.append(row)
        proof_facts.append(row)
        return True

    def sides(fact: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[dict[str, Any]]]:
        ff, _ = DF.fact_frame(fact)
        if not isinstance(ff, dict):
            return None, None, []
        subject = ff.get("kartr") if isinstance(ff.get("kartr"), dict) else None
        pred = ff.get("pred") if isinstance(ff.get("pred"), dict) else None
        other = pred.get("np") if isinstance(pred, dict) and isinstance(pred.get("np"), dict) else None
        return subject, other, _order_quals(ff)

    rounds = 0
    while rounds < LIMITS["MAX_ROUNDS"]:
        rounds += 1
        added = 0
        for fact in list(pool):
            if fact.get("source") == "derive":
                continue
            atom = fact.get("atom") or {}
            args = atom.get("args") or []
            pred = str(atom.get("predicate") or "")
            if pred not in ORDER_INVERSE or atom.get("polarity", "pos") != "pos" or len(args) < 2 or _norm(args[0]) == _norm(args[1]):
                continue
            subject, other, quals = sides(fact)
            if not isinstance(subject, dict) or not isinstance(other, dict) or _measured_np(subject) or _measured_np(other):
                continue
            rule = ORDER_INVERSE[pred]
            inv = str(rule["head"]["predicate"])
            conclusion = _atom(inv, [args[1], args[0]], "pos")
            sub = {"$x": str(args[0]), "$y": str(args[1])}
            if emit(rule, [fact], sub, conclusion, _order_frame(inv, other, subject, quals), _order_text(conclusion, quals), True):
                added += 1
        for pred, rule in ORDER_CHAIN.items():
            if world.get(pred + "_transitive", True) is not True:
                continue
            for sub, chosen in _match_body(rule["body"], [f for f in pool if not f.get("self_fact")]):
                if _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                    continue
                left_s, left_o, left_q = sides(chosen[0])
                right_s, right_o, right_q = sides(chosen[1])
                if not isinstance(left_s, dict) or not isinstance(right_o, dict) or _qual_key({"adj": left_q}) != _qual_key({"adj": right_q}):
                    continue
                # A numeral is not typed as a quantity dimension, and it does not chain with a thing.
                if any(_measured_np(n) for n in (left_s, left_o, right_s, right_o)):
                    continue
                conclusion = _atom(pred, [chosen[0]["atom"]["args"][0], chosen[1]["atom"]["args"][1]], "pos")
                sub = {"$x": str(chosen[0]["atom"]["args"][0]), "$y": str(chosen[0]["atom"]["args"][1]), "$z": str(chosen[1]["atom"]["args"][1])}
                if emit(rule, chosen, sub, conclusion, _order_frame(pred, left_s, right_o, left_q), _order_text(conclusion, left_q), True):
                    added += 1
        if added == 0:
            break
    return claims, pool, proof_facts, False


def _cmp_text(subject: str, surface: str, other: str, neg: bool = False) -> str:
    return f"{subject} {'is not' if neg else 'is'} {surface} than {other}."


def _cmp_frame(predicate: str, surface: str, kartr: dict[str, Any], other: dict[str, Any], neg: bool = False) -> dict[str, Any]:
    return {"kriya": "be", "polarity": "neg" if neg else "pos", "kartr": kartr,
            "pred": {"type": "cmp", "text": surface, "predicate": predicate, "dimension": CMP_DIM.get(predicate), "than": other}, "derived": True}


def _cmp_chain(world: dict[str, Any], question: str, phase_path: list[Any], pool: list[dict[str, Any]], proof_facts: list[dict[str, Any]], qframe: dict[str, Any] | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], bool]:
    """Age stays age and magnitude stays magnitude. A comparison does not invent a number."""
    from rmc_engine_v1 import derive_frame as DF
    claims: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, str]] = set()

    def note(pred: str, a: str, b: str, pol: str) -> None:
        seen.add((pred, _norm(a), _norm(b), pol))

    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        pred = str(atom.get("predicate") or "")
        if pred in CMP_DIM and len(args) >= 2:
            note(pred, args[0], args[1], str(atom.get("polarity") or "pos"))

    def surface_of(fact: dict[str, Any], fallback: str) -> str:
        ff, _ = DF.fact_frame(fact)
        pred = (ff or {}).get("pred") if isinstance(ff, dict) else None
        return str((pred or {}).get("text") or fallback)

    def sides(fact: dict[str, Any]) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        ff, _ = DF.fact_frame(fact)
        if not isinstance(ff, dict):
            return None, None
        subject = ff.get("kartr") if isinstance(ff.get("kartr"), dict) else None
        pred = ff.get("pred") if isinstance(ff.get("pred"), dict) else None
        other = pred.get("than") if isinstance(pred, dict) and isinstance(pred.get("than"), dict) else None
        return subject, other

    def wanted_surface(predicate: str, source_word: str, antonym: bool) -> str:
        qpred = qframe.get("pred") if isinstance(qframe, dict) else None
        if isinstance(qpred, dict) and str(qpred.get("predicate") or "") == predicate and str(qpred.get("text") or "").strip():
            return str(qpred.get("text")).strip()
        # An inverse or an exclusion speaks the partner word. Asymmetry keeps the same word.
        return CMP_SURFACE_INVERSE.get(source_word, source_word) if antonym else source_word

    def emit(rule: dict[str, Any], chosen: list[dict[str, Any]], sub: dict[str, str], conclusion: dict[str, Any], cframe: dict[str, Any], text: str) -> bool:
        key = (str(conclusion.get("predicate")), _norm(conclusion["args"][0]), _norm(conclusion["args"][1]), str(conclusion.get("polarity") or "pos"))
        if key in seen or _norm(conclusion["args"][0]) == _norm(conclusion["args"][1]) or len(claims) >= 24:
            return False
        matched = DF.match(qframe, cframe) if qframe is not None else None
        proof_world = dict(world)
        proof_world["facts"] = proof_facts
        steps = [{"n": i + 1, "kind": "fact", "fact_id": fact["id"], "premises": [], "substitution": {}, "atom": fact["atom"]} for i, fact in enumerate(chosen)]
        steps.append({"n": len(chosen) + 1, "kind": "rule", "rule_id": rule["id"], "premises": list(range(1, len(chosen) + 1)), "substitution": sub, "atom": conclusion})
        proof = _proof_shell(proof_world, conclusion, steps)
        checked = check_proof(proof_world, proof)
        premises = _original_premises(chosen)
        claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", rule["id"], phase_path or [])
        word = str((cframe.get("pred") or {}).get("text") or "")
        if checked.get("ok") is True and word:
            claim["rule_licensed"] = sorted(set(list(claim.get("rule_licensed") or []) + _rule_words(rule) + [word.lower()]))
            claim["debate"] = run_debate(claim, content_tokens=content_tokens)
        hop_rows = []
        for fact in chosen:
            sources = fact.get("source_facts") if fact.get("source") == "derive" and fact.get("source_facts") else [fact]
            for src in sources:
                if isinstance(src, dict):
                    measured = _drift_for(src.get("text") or "", [src], phase_path or [])
                    hop_rows.append(_hop_row(src.get("text") or "", list(src.get("provenance") or [src.get("id")]), measured, len(hop_rows) + 1))
        hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
        claim["hops"] = hop_rows
        if claim.get("debate", {}).get("survived") is not True:
            return False
        note(str(conclusion.get("predicate")), conclusion["args"][0], conclusion["args"][1], str(conclusion.get("polarity") or "pos"))
        place = _derived_place(chosen)
        row = _fact_row("hop-" + _digest(text)[:12], {"text": text, "atom": conclusion, "parsed": True, "atom_source": "derive", "place": place, "frame": cframe}, source="derive", provenance=[p.get("id") for p in premises], quarantined=False, cite=rule["cite"])
        row["source_facts"] = premises
        pool.append(row)
        proof_facts.append(row)
        if qframe is not None and matched:
            _frame_claim(claim, cframe, "chain", matched, DF.alignment(place or {"text": text}, phase_path, question), question)
            claim["_place"] = place or {"text": text}
            claim["_premise_rows"] = list(premises)
            claim["intermediate"] = False
            claims.append(claim)
        elif qframe is None and _coverage(question, text) > 0:
            claims.append(claim)
        return True

    rounds = 0
    while rounds < LIMITS["MAX_ROUNDS"]:
        rounds += 1
        added = 0
        for fact in list(pool):
            atom = fact.get("atom") or {}
            args = atom.get("args") or []
            pred = str(atom.get("predicate") or "")
            if pred not in CMP_DIM or atom.get("polarity", "pos") != "pos" or len(args) < 2 or _norm(args[0]) == _norm(args[1]):
                continue
            subject, other = sides(fact)
            if not isinstance(subject, dict) or not isinstance(other, dict):
                continue
            word = surface_of(fact, "")
            inv = CMP_INVERSE[pred]
            sub = {"$x": str(args[0]), "$y": str(args[1])}
            # A stated comparison licenses its inverse. A derived comparison does not license a second one:
            # the inverse chain already produced that direction.
            if fact.get("source") != "derive":
                inv_word = wanted_surface(inv, word, True)
                inv_atom = _atom(inv, [args[1], args[0]], "pos")
                if emit(CMP_INV_RULE[pred], [fact], sub, inv_atom, _cmp_frame(inv, inv_word, other, subject), _cmp_text(str(other.get("text") or args[1]), inv_word, str(subject.get("text") or args[0]))):
                    added += 1
            asym_word = wanted_surface(pred, word, False)
            asym = _atom(pred, [args[1], args[0]], "neg")
            if emit(CMP_ASYM[pred], [fact], sub, asym, _cmp_frame(pred, asym_word, other, subject, True), _cmp_text(str(other.get("text") or args[1]), asym_word, str(subject.get("text") or args[0]), True)):
                added += 1
            excl_word = wanted_surface(inv, word, True)
            excl = _atom(inv, [args[0], args[1]], "neg")
            if emit(CMP_EXCL[pred], [fact], sub, excl, _cmp_frame(inv, excl_word, subject, other, True), _cmp_text(str(subject.get("text") or args[0]), excl_word, str(other.get("text") or args[1]), True)):
                added += 1
        for pred, rule in CMP_CHAIN.items():
            for sub, chosen in _match_body(rule["body"], [f for f in pool if not f.get("self_fact")]):
                if _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                    continue
                left_s, _ = sides(chosen[0])
                _, right_o = sides(chosen[1])
                if not isinstance(left_s, dict) or not isinstance(right_o, dict):
                    continue
                if CMP_DIM.get(str((chosen[0].get("atom") or {}).get("predicate"))) != CMP_DIM.get(str((chosen[1].get("atom") or {}).get("predicate"))):
                    continue
                word = surface_of(chosen[0], "")
                conclusion = _atom(pred, [chosen[0]["atom"]["args"][0], chosen[1]["atom"]["args"][1]], "pos")
                bound = {"$x": str(chosen[0]["atom"]["args"][0]), "$y": str(chosen[0]["atom"]["args"][1]), "$z": str(chosen[1]["atom"]["args"][1])}
                if emit(rule, chosen, bound, conclusion, _cmp_frame(pred, word, left_s, right_o), _cmp_text(str(left_s.get("text") or ""), word, str(right_o.get("text") or ""))):
                    added += 1
        if added == 0:
            break
    return claims, pool, proof_facts, False


def _derive_by_frame(world: dict[str, Any], question: str, phase_path: list[Any], qframe: dict[str, Any], topical: list[dict[str, Any]]) -> dict[str, Any]:
    """4.9.233: a fact answers only when its frame unifies with the question frame AND its placement is phase-aligned
    with the question (grace = rpm·cos²δ, δ ≤ π/4); band relation and the 4.9.204 attraction rank the aligned matches;
    word coverage is a logged tie-break. A copula-chain conclusion carries the frame built from its premises."""
    from rmc_engine_v1 import derive_frame as DF

    def placed(row: dict[str, Any]) -> dict[str, Any]:
        return row.get("place") if isinstance(row.get("place"), dict) else place_row({}, str(row.get("text") or ""), bool(row.get("quarantined")))

    claims: list[dict[str, Any]] = []
    incomplete = False
    considered = 0
    direct = []
    for fact in topical:
        ff, src = DF.fact_frame(fact)
        considered += 1
        m = DF.match(qframe, ff)
        if m:
            direct.append((fact, ff, src, m, DF.alignment(placed(fact), phase_path, question)))
    # 4.9.236: ranked by the operation-phase factor A (Φ_query of retrieval against each memory's own Φ), never vetoed by it
    phi_q = DF.OPERATION_PHASE[DF.operation(qframe)]
    direct.sort(key=lambda d: (-int(bool(d[2] == "clause")), -float(DF.phase_factor(placed(d[0]).get("Phi"), phi_q).get("A") or 0.0),
                               -int(d[4].get("band_key") or 0), -float(d[4].get("coupling") or 0.0), str(d[0].get("text") or ""), str(d[0]["id"])))
    for fact, ff, src, m, al in direct[:4]:
        if m.get("rule") == DF.RULE_NAME_OF and len((fact.get("atom") or {}).get("args") or []) == 2:
            x, n = [str(a) for a in fact["atom"]["args"]]
            sub = {"$x": x, "$n": n}
            conclusion = _atom("is", [x + "'s name", n], "pos")
            text = _render_atom(conclusion)
            proof = _proof_shell(world, conclusion, [
                {"n": 1, "kind": "fact", "fact_id": fact["id"], "premises": [], "substitution": {}, "atom": fact["atom"]},
                {"n": 2, "kind": "rule", "rule_id": "WM-NAME-OF", "premises": [1], "substitution": sub, "atom": conclusion}])
            checked = check_proof(world, proof)
            claim = _finish_claim(world, text, conclusion, [fact], proof, checked, "supported_only", DF.RULE_NAME_OF, phase_path)
            _licensed(world, claim, NAME_RULE)
            measured = _drift_for(fact["text"], [fact], phase_path)
            claim["hops"] = [_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, 1),
                             _hop_row(text, [fact.get("id")], claim["drift"], 2)]
        elif m.get("rule") == DF.RULE_OWNER_OF:
            atom_args = [str(a) for a in (fact.get("atom") or {}).get("args") or []]
            owned = next((a for a in atom_args if _norm(a) == _norm(m.get("owned") or "")), m.get("owned") or "")
            n = next((a for a in atom_args if _norm(a) != _norm(owned)), "")
            sub = {"$owned": owned, "$n": n, "$o": str(m.get("filler") or "")}
            conclusion = _atom("owns", [sub["$o"], n], "pos")
            text = _render_atom(conclusion)
            proof = _owner_proof(world, fact, sub, conclusion)
            checked = check_proof(world, proof)
            claim = _finish_claim(world, text, conclusion, [fact], proof, checked, "supported_only", DF.RULE_OWNER_OF, phase_path)
            _licensed(world, claim, OWNER_RULE)
            measured = _drift_for(fact["text"], [fact], phase_path)
            claim["hops"] = [_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, 1),
                             _hop_row(text, [fact.get("id")], claim["drift"], 2)]
        else:
            proof = _direct_proof(world, fact)
            checked = check_proof(world, proof)
            claim = _finish_claim(world, fact["text"], fact["atom"], [fact], proof, checked, "supported_only", "direct", phase_path)
        claim["_place"] = placed(fact)
        claim["_premise_rows"] = [fact]
        claims.append(_frame_claim(claim, ff, src, m, al, question))

    # Copula chain: every conclusion is checked and debated; only a conclusion whose frame unifies with the question can
    # answer. The others stay in the pool as hops (bounded).
    pool = list(topical)
    proof_facts = list(world.get("facts") or [])
    seen: set[tuple[str, str, str]] = set()
    for fact in pool:
        atom = fact.get("atom") or {}
        args = atom.get("args") or []
        if atom.get("predicate") == "is" and len(args) >= 2:
            seen.add((_norm(args[0]), _norm(args[1]), str(atom.get("polarity") or "pos")))
    rounds, chain_claims = 0, 0
    while rounds < LIMITS["MAX_ROUNDS"]:
        rounds += 1
        hops = _match_body(COPULA_RULE["body"], [f for f in pool if not f.get("self_fact")])
        added = 0
        for sub, chosen in hops:
            if chain_claims >= 24:
                incomplete = True
                break
            conclusion = _atom("is", [chosen[0]["atom"]["args"][0], chosen[1]["atom"]["args"][1]], "pos")
            key = (_norm(conclusion["args"][0]), _norm(conclusion["args"][1]), "pos")
            if key in seen or _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                continue
            text = _render_atom(conclusion)
            proof_world = dict(world)
            proof_world["facts"] = proof_facts
            proof = _chain_proof(proof_world, chosen[0], chosen[1], sub, conclusion)
            checked = check_proof(proof_world, proof)
            premises = _original_premises(chosen)
            claim = _finish_claim(world, text, conclusion, premises, proof, checked, "supported_only", "WM-COPULA-CHAIN", phase_path)
            hop_rows: list[dict[str, Any]] = []
            for fact in chosen:
                prior = fact.get("hop_trace") if isinstance(fact.get("hop_trace"), list) else None
                if prior:
                    hop_rows.extend(prior)
                    continue
                measured = _drift_for(fact["text"], [fact], phase_path)
                hop_rows.append(_hop_row(fact["text"], list(fact.get("provenance") or [fact.get("id")]), measured, len(hop_rows) + 1))
            hop_rows.append(_hop_row(text, [p.get("id") for p in premises], claim["drift"], len(hop_rows) + 1))
            for i, hop in enumerate(hop_rows, start=1):
                hop["n"] = i
            claim["hops"] = hop_rows
            cframe = DF.chain_frame(chosen[0], chosen[1], conclusion)
            place = _derived_place(chosen)
            m = DF.match(qframe, cframe)
            _frame_claim(claim, cframe, "chain", m, DF.alignment(place or placed({"text": text}), phase_path, question), question)
            claim["_place"] = place or placed({"text": text})
            claim["_premise_rows"] = list(premises)
            claim["intermediate"] = not bool(m)
            claims.append(claim)
            chain_claims += 1
            if claim.get("debate", {}).get("survived") is not True:
                continue
            seen.add(key)
            row = _fact_row(
                "hop-" + _digest(text)[:12], {"text": text, "atom": conclusion, "parsed": True, "atom_source": "derive", "place": place, "frame": cframe},
                source="derive", provenance=[p.get("id") for p in premises], quarantined=False,
                cite="contract 1g2034-K §5 bounded multi-hop forward derivation",
            )
            row["source_facts"] = premises
            row["hop_trace"] = hop_rows
            pool.append(row)
            proof_facts = proof_facts + [row]
            added += 1
        if added == 0:
            break

    cclaims, pool, proof_facts, seen, c_incomplete = _contain_chain(world, question, phase_path, pool, proof_facts, seen, qframe)
    claims.extend(cclaims)
    chain_claims += len(cclaims)
    incomplete = incomplete or c_incomplete
    pclaims, pool, proof_facts, p_incomplete = _place_chains(world, question, phase_path, pool, proof_facts, qframe)
    claims.extend(pclaims)
    chain_claims += len(pclaims)
    incomplete = incomplete or p_incomplete
    tclaims, pool, proof_facts, t_incomplete = _part_chain(world, question, phase_path, pool, proof_facts, qframe)
    claims.extend(tclaims)
    chain_claims += len(tclaims)
    incomplete = incomplete or t_incomplete
    aclaims, pool, proof_facts, a_incomplete = _ancestor_chain(world, question, phase_path, pool, proof_facts, qframe)
    claims.extend(aclaims)
    chain_claims += len(aclaims)
    incomplete = incomplete or a_incomplete
    sclaims, pool, proof_facts, s_incomplete = _symmetric(world, question, phase_path, pool, proof_facts, qframe)
    claims.extend(sclaims)
    chain_claims += len(sclaims)
    incomplete = incomplete or s_incomplete
    oclaims, pool, proof_facts, o_incomplete = _order_chain(world, question, phase_path, pool, proof_facts, qframe)
    claims.extend(oclaims)
    chain_claims += len(oclaims)
    incomplete = incomplete or o_incomplete
    mclaims, pool, proof_facts, m_incomplete = _cmp_chain(world, question, phase_path, pool, proof_facts, qframe)
    claims.extend(mclaims)
    chain_claims += len(mclaims)
    incomplete = incomplete or m_incomplete

    for claim in claims:
        atom = claim["atom"]
        if atom.get("predicate") not in ("is", "in", "live", "geo", "part", "ancestor", "descendant", "parent", "child", "married", "next", "adjacent", "sibling", "before", "after", "above", "below", "older_than", "younger_than", "greater_than", "less_than"):
            continue
        opposite = "neg" if atom.get("polarity") != "neg" else "pos"
        for other in topical:
            oatom = other.get("atom") or {}
            if oatom.get("predicate") == atom.get("predicate") and oatom.get("polarity") == opposite and \
                    [_norm(a) for a in atom.get("args") or []] == [_norm(a) for a in oatom.get("args") or []]:
                claim["status"] = "conflicted"
                claim["debate"] = run_debate(claim, content_tokens=content_tokens)

    # 4.9.236 gate G = f(ΔΦ, S, C): S (frame) and C (context) decide; ΔΦ weights. Nothing is written back to a memory.
    for claim in claims:
        claim["gate"] = DF.gate(qframe, claim.get("frame_match"), claim, claim.pop("_premise_rows", None) or [], claim.pop("_place", None))
    # A positive derivation and a stored negative of the same atom are a conflict. Neither side is spoken.
    blocked = set()
    for claim in claims:
        if claim.get("status") != "conflicted":
            continue
        atom = claim.get("atom") or {}
        blocked.add((str(atom.get("predicate")), tuple(_norm(a) for a in atom.get("args") or [])))
    for claim in claims:
        atom = claim.get("atom") or {}
        key = (str(atom.get("predicate")), tuple(_norm(a) for a in atom.get("args") or []))
        if key in blocked and isinstance(claim.get("gate"), dict):
            failed = list((claim["gate"].get("context_failed") or []))
            if "conflicted" not in failed:
                failed.append("conflicted")
            claim["gate"] = dict(claim["gate"], passes=False, context_failed=failed)
    matched = [c for c in claims if c.get("frame_match")]
    answers = [c for c in matched if (c.get("gate") or {}).get("passes")]
    if answers:
        status, reason = "supported_only", "frame match (S) and context (C) hold; ΔΦ weighted"
    elif any(c.get("status") == "conflicted" for c in matched):
        status, reason = "conflicted", "the matching facts conflict"
    elif matched and any("possessor_scope" in ((c.get("gate") or {}).get("context_failed") or []) for c in matched):
        status, reason = "undetermined", "frame matched but the memory is not the asker's (possessor scope)"
    elif matched:
        status, reason = "undetermined", "frame matched but no match survived the check and debate"
    else:
        status, reason = ("incomplete", "MAX_ROUNDS") if incomplete else ("undetermined", "no fact frame unifies with the question frame")
    for claim in answers:
        if claim.get("how") in ("WM-COPULA-CHAIN", "WM-CONTAIN-CHAIN", "WM-GEO-CHAIN", "WM-LIVE-GEO", "WM-PART-CHAIN", "WM-ANCESTOR-CHAIN", "WM-ANCESTOR-INVERSE", "WM-DESCENDANT-CHAIN", "WM-DESCENDANT-INVERSE", "WM-PARENT-INVERSE", "WM-CHILD-INVERSE", "WM-MARRIED-SYMMETRIC", "WM-NEXT-SYMMETRIC", "WM-ADJACENT-SYMMETRIC", "WM-SIBLING-SYMMETRIC", "WM-NEXT-CHAIN", "WM-BEFORE-CHAIN", "WM-AFTER-CHAIN", "WM-ABOVE-CHAIN", "WM-BELOW-CHAIN", "WM-BEFORE-INVERSE", "WM-AFTER-INVERSE", "WM-ABOVE-INVERSE", "WM-BELOW-INVERSE") or "_THAN-" in str(claim.get("how") or ""):
            parts = [str(h.get("text") or "") for h in claim.get("hops") or [] if len(h.get("provenance") or []) == 1][:4]
        elif claim.get("how") in (DF.RULE_OWNER_OF, DF.RULE_NAME_OF):
            parts = [str(h.get("text") or "") for h in claim.get("hops") or []][:1]
        else:
            parts = []
        parts.append(str(claim.get("text") or ""))
        fm = claim.get("frame_match") or {}
        if fm.get("rule") == DF.RULE_CONVERSE:
            # 4.9.241: the polarity answer the frame gives ("not necessarily"), then the fact it rests on
            parts.insert(0, _cap(str(fm.get("filler"))))
        personal = any(_FIRST_PERSON_RE.search(p) for p in parts) and all(
            str(p.get("source") or "") in DF.PERSONAL_SOURCES for p in claim.get("premises") or [] if _FIRST_PERSON_RE.search(str(p.get("text") or "")))
        # 4.9.241 (plan 229 step 10): a self-fact is stored as the asker would say it to the kernel ("You are a computer
        # program."); the kernel speaks it in its own person ("I am a computer program."). Deixis, not content.
        selfvoice = any(_SECOND_PERSON_RE.search(p) for p in parts) and bool(claim.get("premises")) and all(
            str(p.get("source") or "") in DF.SELF_SOURCES for p in claim.get("premises") or [] if _SECOND_PERSON_RE.search(str(p.get("text") or "")))
        voice = to_speaker if selfvoice else (to_listener if personal else None)
        claim["spoken"] = " ".join(dict.fromkeys(_cap(voice(p) if voice else p) for p in parts if p.strip()))
        claim["perspective"] = "speaker" if selfvoice else ("listener" if personal else "as_stored")
        # 4.9.237 (plan 229 step 8): each spoken sentence with the atom it states, for the outward compile (panini_wording)
        claim["spoken_atoms"] = _spoken_atoms(world, claim, parts, voice)
    report = _derive_report(world, question, status, reason, claims, incomplete, answers=answers)
    report["match_mode"] = "frame_gate"
    report["frame_trace"] = {
        "rule": "4.9.236 G = f(ΔΦ, S, C): frame unification (S) x context coherence (C), ΔΦ to the operation phase weighted",
        "operation": DF.operation(qframe),
        "phi_query": DF.OPERATION_PHASE[DF.operation(qframe)],
        "gates": [{"text": c.get("text"), **{k: (c.get("gate") or {}).get(k) for k in ("phi_identity", "delta_phi_deg", "A", "S", "C", "G", "passes", "context_failed")}}
                  for c in matched][:6],
        "question_frame": {k: qframe.get(k) for k in ("wh", "wh_role", "kriya", "polarity", "rule")},
        "question_phases": DF.question_phases(phase_path),
        "facts_considered": considered,
        "direct_matches": len(direct),
        "chain_claims": chain_claims,
        "frame_matched": len(matched),
        "aligned": sum(1 for c in matched if (c.get("alignment") or {}).get("aligned")),
        "gated": sum(1 for c in matched if (c.get("gate") or {}).get("passes")),
        "answers": len(answers),
        "unaligned_matches": [{"text": c.get("text"), "fact_phase": (c.get("alignment") or {}).get("fact_phase"),
                               "delta_deg": (c.get("alignment") or {}).get("delta_deg")} for c in matched if not (c.get("alignment") or {}).get("aligned")][:4],
    }
    return report


def _finish_claim(world, text, atom, premises, proof, checked, status, how, phase_path) -> dict[str, Any]:
    drift = _drift_for(text, premises, phase_path)
    claim = {
        "text": text,
        "atom": atom,
        "status": status,
        "how": how,
        "premises": [{
            "id": p["id"], "text": p["text"], "source": p.get("source"),
            "quarantined": bool(p.get("quarantined")), "provenance": p.get("provenance"),
            **({"sim": p["sim"]} if isinstance(p.get("sim"), dict) else {}),
            **({"ground_forms": list(p.get("ground_forms") or [])} if p.get("ground_forms") else {}),
        } for p in premises],
        "provenance": [p["id"] for p in premises],
        "proof_id": proof.get("proof_id"),
        "proof": proof,
        "checker_ok": checked.get("ok") is True,
        "checker_reason": checked.get("reason"),
        "drift": drift,
        "chi": drift.get("chi"),
    }
    claim["hops"] = [{
        "n": 1,
        "text": text,
        "provenance": [p.get("id") for p in premises],
        "drift": {"epsilon_s": drift.get("epsilon_s"), "disposition": drift.get("disposition")},
        "chi": {
            "status": (drift.get("chi") or {}).get("status"),
            "christping_initiated": False,
            "christping_owner": "gilligan_only",
        },
    }]
    claim["debate"] = run_debate(claim, content_tokens=content_tokens)
    return claim


def _derive_report(world, question, status, reason, claims, incomplete, answers=None) -> dict[str, Any]:
    if answers is not None:
        # 4.9.233: frame mode. Only frame-matched, phase-aligned survivors answer; matched claims are listed first.
        survivors = sorted(answers, key=_frame_key)
        claims = sorted(claims, key=_frame_key)
    else:
        survivors = [c for c in claims if c.get("debate", {}).get("survived")]
    survivors.sort(key=_frame_key) if answers is not None else survivors.sort(key=lambda c: (
        -_role_lock(question, c.get("text") or ""),
        -_coverage(question, c.get("text") or ""),
        -len(c.get("provenance") or []),
        float((c.get("drift") or {}).get("epsilon_s") or 0.0),
        str(c.get("text") or ""),
        str(c.get("proof_id") or ""),
    ))
    chosen = survivors[0] if survivors else None
    public_claims = [_public_claim(c) for c in claims[:12]]
    return {
        "operation": "Derive",
        "cite": "spec 1vBx_Q9K §1.4 Derive(W_v, R, Q); contract 1g2034-K §5 and §6 steps 6-8",
        "world_root": world.get("root"),
        "question": question,
        "status": status,
        "reason": reason,
        "incomplete": incomplete,
        "calls_llm": False,
        "writes_durable_memory": False,
        "claims": public_claims,
        "survivor": _public_claim(chosen) if chosen else None,
        "derived_text": (chosen or {}).get("spoken") or (chosen or {}).get("text") or "",
        "derived_atoms": (chosen or {}).get("spoken_atoms") if chosen and (chosen.get("spoken") or chosen.get("text")) else None,
        "proofs": {((c.get("proof") or {}).get("proof_id") or "none"): {"steps": (c.get("proof") or {}).get("steps"), "ok": c.get("checker_ok")} for c in claims[:8]},
    }


def _listener_atom(atom: dict[str, Any] | None, voice: Any) -> dict[str, Any] | None:
    if not isinstance(atom, dict):
        return None
    out = {"predicate": atom.get("predicate"), "args": [str(a) for a in atom.get("args") or []], "polarity": atom.get("polarity") or "pos"}
    if voice:
        # deixis on each argument; the voice capitalises a sentence start, which an argument is not
        def arg(a: str) -> str:
            t = voice(a)
            return t[:1].lower() + t[1:] if t != a or a[:1].islower() else t
        out["args"] = [arg(a) for a in out["args"]]
    return out


def _spoken_atoms(world: dict[str, Any], claim: dict[str, Any], parts: list[str], voice: Any) -> list[dict[str, Any]]:
    """The spoken sentences in order, each with the atom it states: a recalled fact's own atom, or the derived conclusion's.
    A sentence whose atom is a bare 'stated' record (the parser did not read it) carries no atom; it is quoted, not compiled."""
    by_text = {}
    for fact in world.get("facts") or []:
        if isinstance(fact, dict) and fact.get("text") and isinstance(fact.get("atom"), dict):
            by_text.setdefault(str(fact["text"]).strip(), fact)
    out, seen = [], set()
    last = len(parts) - 1
    for i, part in enumerate(parts):
        text = _cap(voice(part) if voice else part)
        if not part.strip() or text in seen:
            continue
        seen.add(text)
        fact = by_text.get(part.strip())
        atom = claim.get("atom") if i == last else (fact or {}).get("atom")
        if isinstance(atom, dict) and atom.get("predicate") == "stated":
            atom = None
        # verbatim: the sentence is a recalled fact's own stored text (a direct answer, or a premise in its stored person)
        out.append({"text": text, "atom": _listener_atom(atom, voice),
                    "source_id": (fact or {}).get("id"), "verbatim": bool(fact) and _cap(part.strip()) == text,
                    "role": "conclusion" if i == last else "premise"})
    return out


def _public_claim(claim: dict[str, Any] | None) -> dict[str, Any] | None:
    if not claim:
        return None
    debate = claim.get("debate") or {}
    return {
        "text": claim.get("text"),
        "status": claim.get("status"),
        "how": claim.get("how"),
        "provenance": claim.get("provenance"),
        "premises": claim.get("premises"),
        "proof_id": claim.get("proof_id"),
        "checker_ok": claim.get("checker_ok"),
        "checker_reason": claim.get("checker_reason"),
        "drift": claim.get("drift"),
        "chi": claim.get("chi"),
        "hops": claim.get("hops") or [],
        "spoken": claim.get("spoken") or claim.get("text"),
        "spoken_atoms": claim.get("spoken_atoms"),
        # 4.9.238: the claim's atom and the frame it was matched on, for Echo by structure (structural_echo)
        "atom": claim.get("atom"),
        "fact_frame": claim.get("fact_frame"),
        "frame_match": claim.get("frame_match"),
        "alignment": claim.get("alignment"),
        "gate": claim.get("gate"),
        "perspective": claim.get("perspective"),
        "coverage_tiebreak": claim.get("coverage_tiebreak"),
        "intermediate": claim.get("intermediate"),
        "debate": {
            "survived": debate.get("survived"),
            "frame": (debate.get("frame") or {}).get("id"),
            "proponent": debate.get("proponent"),
            "opponent": debate.get("opponent"),
            "calls_llm": False,
        },
    }


def _cause_effect_hook(world: dict[str, Any], query: str) -> dict[str, Any]:
    """Cause-and-effect hook (4.9.243). Runs bounded Simulate via cause_effect.predict; never stores a fact."""
    from rmc_engine_v1 import cause_effect

    out = cause_effect.predict(query, world)
    pred = out.get("prediction") if isinstance(out.get("prediction"), dict) else None
    return {
        "status": out.get("status"),
        "rule": out.get("rule"),
        "prediction": pred,
        "admit": bool(out.get("admit")),
        "store_as_fact": False,
        "intervention": out.get("intervention"),
        "simulate": out.get("simulate"),
    }


def simulate(world: dict[str, Any], query: str = "") -> dict[str, Any]:
    """Spec §1.4 Simulate (4.9.243, plan 229 step 12). Forward-chain stored/admitted causal frames under a
    what-happens-if intervention, bounded depth. The result is branch-local — never written as a fact."""
    ce = _cause_effect_hook(world, query)
    pred = ce.get("prediction") if isinstance(ce.get("prediction"), dict) else None
    sim = ce.get("simulate") if isinstance(ce.get("simulate"), dict) else {}
    return {
        "operation": "Simulate",
        "status": ce.get("status") or "undetermined",
        "cite": "spec 1vBx_Q9K §1.4 Simulate; plan 229 step 12; predictions are never facts",
        "world_root": world.get("root"),
        "query": query,
        "hypothetical_result": (pred or {}).get("text") if pred else None,
        "chain": sim.get("chain") or [],
        "depth": sim.get("depth"),
        "rules_fired": sim.get("rules_fired") or [],
        "intervention": ce.get("intervention"),
        "writes_observed": False,
        "store_as_fact": False,
        "calls_llm": False,
        "cause_effect": ce,
    }


def place_row(node: dict[str, Any], text: str, quarantined: bool) -> dict[str, Any]:
    """4.9.231: a recalled row's meaning id, phase, Codex band and symbolic Hz.

    The phase and band are the row's resonance packet (resonance_recall.place_packet, band_tuning.tune) when recall
    placed it; otherwise the same placement is run here. The group is the band's home marker on the 144 Hz ladder
    (frequency_203_config.HOME): the 144/n markers, or the 432 or 1296 overtone. Nothing is invented: a row recall
    did not place and that has no phase of its own gets the placement's own default and says so.
    """
    from rmc_engine_v1.drift_policy import BAND_TABLE
    from rmc_engine_v1.frequency_203_config import HOME
    from rmc_engine_v1.resonance_recall import place_packet

    packet = node.get("packet") if isinstance(node.get("packet"), dict) else None
    placed_by = "recall_packet"
    if not packet:
        packet = place_packet({"text": text, "sfe": node.get("sfe")}, quarantined=quarantined)
        placed_by = "observe_place_packet"
    band = packet.get("band") if isinstance(packet.get("band"), dict) else {}
    try:
        phase = int(float(packet.get("Phi")))
    except (TypeError, ValueError):
        phase = None
    home = HOME.get(phase) if phase else None
    meaning = node.get("meaning_id") if isinstance(node.get("meaning_id"), str) and node.get("meaning_id") else None
    return {
        "meaning_id": meaning or (packet.get("concept") if isinstance(packet.get("concept"), str) else None),
        "meaning_source": "row" if meaning else ("lexicon_concept" if packet.get("concept") else None),
        "Phi": packet.get("Phi"),
        "phase": phase,
        "phase_name": (BAND_TABLE.get(str(phase)) or BAND_TABLE.get(phase) or {}).get("phase_name") if phase else None,
        "band": band.get("band"),
        "band_low": band.get("low"),
        "band_high": band.get("high"),
        "hz": band.get("hz"),
        "home_marker": home,
        "group": None if home is None else (1296 if home == 1296 else 432 if home == 432 else 144),
        "eps": packet.get("eps"),
        "mu": packet.get("mu"),
        "placed_by": placed_by,
        # where the phase came from: the asked concept's lexicon packet, the row's own stored SFE, or the placement's
        # default (Φ9 projectable, Φ5 quarantined) when neither gave one
        "phi_basis": packet.get("phi_basis") or "unrecorded",
        "calls_llm": False,
    }


def _clean_node_text(raw: str) -> str:
    text = str(raw or "")
    match = re.search(r"(?:^|\| )content: (.*?)(?: \| text:| \| filename:|$)", text)
    if match:
        return match.group(1).strip()
    match = re.search(r"(?:^|\| )text: (.*?)(?: \| filename:|$)", text)
    if match:
        return match.group(1).strip()
    return text.strip()


_RELATION_OVERLAY: dict[str, Any] = {}


def set_relation_overlay(overlay: dict[str, Any] | None) -> None:
    """The active relation-table overlay for this turn. Shipped rows leave next_to non-transitive."""
    global _RELATION_OVERLAY
    _RELATION_OVERLAY = dict(overlay) if isinstance(overlay, dict) else {}


def run_world_model(question: str, memory: dict[str, Any] | None = None) -> dict[str, Any]:
    """Observe recalled evidence, Derive, debate; Simulate forward-chains causal frames (4.9.243)."""
    memory = dict(memory or {})
    phase_path = memory.get("phase_path") if isinstance(memory.get("phase_path"), list) else ["Φ1"]
    events = []
    nodes = memory.get("nodes") if isinstance(memory.get("nodes"), list) else []
    rows = memory.get("rows") if isinstance(memory.get("rows"), list) else []
    source_rows = nodes or rows
    from rmc_engine_v1 import memory_clauses
    with_clause = 0
    for node in source_rows:
        if not isinstance(node, dict):
            continue
        text = _clean_node_text(str(node.get("text") or node.get("content") or node.get("content_summary") or ""))
        if not text:
            continue
        prior = _f(node.get("prior_drift_score"), 0.0)
        low = str(node.get("confidence") or "") == "low" or prior >= 0.40 or node.get("quarantined") is True
        nid = str(node.get("id") or node.get("memory_id") or node.get("receipt_id") or "")
        # 4.9.231 (plan 229 step 3): the clause the phone parsed for this recalled row, when it sent one, placed in
        # phase, band and frequency by the same resonance placement recall uses (Nic: every clause carries meaning id,
        # phase, band and frequency).
        place = place_row(node, text, low)
        clause = node.get("clause") if isinstance(node.get("clause"), dict) else memory_clauses.lookup(nid, text)
        if clause is not None and not memory_clauses.valid(clause, text):
            clause = memory_clauses.lookup(None, text)
        if clause is not None:
            with_clause += 1
            clause = memory_clauses.with_place(clause, place)
        events.append({
            "id": nid,
            "clause": clause,
            "place": place,
            "text": text,
            "source": node.get("source") or node.get("source_kind") or "recall",
            "sim": node.get("sim") if isinstance(node.get("sim"), dict) else None,
            "confidence": node.get("confidence"),
            "prior_drift_score": prior,
            "quarantined": low,
        })
    memory_clauses.note("world_model.observe_events", events=len(events), with_clause=with_clause,
                        placed=sum(1 for e in events if (e.get("place") or {}).get("phase")),
                        with_meaning=sum(1 for e in events if (e.get("place") or {}).get("meaning_id")),
                        phi_basis={b: sum(1 for e in events if (e.get("place") or {}).get("phi_basis") == b) for b in ("lexicon_resonance", "row_sfe", "default_projectable", "default_quarantine", "unrecorded")},
                        sample=[{"text": e["text"][:80], "clause": bool(e.get("clause")), **{k: (e.get("place") or {}).get(k) for k in ("meaning_id", "Phi", "phase_name", "band", "hz", "group", "phi_basis")}} for e in events[:6]])
    base, seed_trace = seed_self_facts(empty_world())
    world, observed = observe(base, events)
    overlay = memory.get("relation_overlay") if isinstance(memory.get("relation_overlay"), dict) else _RELATION_OVERLAY
    # Shipped rows: before/after/above/below chain; next_to does not. A manifest may flip a cell.
    for key, default in (("next_to_transitive", False), ("before_transitive", True), ("after_transitive", True), ("above_transitive", True), ("below_transitive", True)):
        world[key] = overlay[key] is True if key in overlay else default
    admitted_facts = [f for f in world.get("facts") or [] if not f.get("self_fact")]
    memory_clauses.note("world_model.observe_atoms", atom_sources=observed.get("atom_sources"),
                        clause_fallback_reasons=observed.get("clause_fallback_reasons"),
                        facts=len(admitted_facts), with_frame=sum(1 for f in admitted_facts if f.get("frame")),
                        with_phase=sum(1 for f in admitted_facts if f.get("phase")),
                        with_meaning=sum(1 for f in admitted_facts if f.get("meaning_id")),
                        sample=[{"text": f["text"][:80], "atom": f["atom"], "atom_source": f.get("atom_source"),
                                 **{k: f.get(k) for k in ("meaning_id", "phase", "band", "hz", "group")}} for f in admitted_facts[:6]])
    # 4.9.233: the phone's question frame (question_frame.current(), checked against this question) drives Derive
    from rmc_engine_v1 import question_frame as _qf
    qframe = _qf.current() if _qf.valid(_qf.current(), question) else None
    derived = derive(world, question, phase_path, qframe)
    if qframe is not None:
        surv = derived.get("survivor") or {}
        _qf.note("world_model.derive", match_mode=derived.get("match_mode"), status=derived.get("status"), reason=derived.get("reason"),
                 trace=derived.get("frame_trace"), survivor=surv.get("text"), frame_match=surv.get("frame_match"),
                 alignment={k: (surv.get("alignment") or {}).get(k) for k in ("aligned", "question_phi", "fact_phase", "delta_deg", "grace", "band_relation", "coupling")} if surv else None,
                 gate={k: (surv.get("gate") or {}).get(k) for k in ("operation", "phi_query", "phi_identity", "delta_phi_deg", "A", "S", "C", "G", "passes")} if surv else None)
    simulated = simulate(world, question)
    # 4.9.243: when Derive has no survivor and Simulate forward-chained a causal prediction, that prediction is the
    # turn's derived claim (still admit-gated by Echo/C; never auto-persisted).
    if not derived.get("survivor") and (simulated.get("cause_effect") or {}).get("prediction"):
        pred = simulated["cause_effect"]["prediction"]
        premises = [p for p in (pred.get("premises") or []) if isinstance(p, dict)]
        text = str(pred.get("text") or "").strip()
        atom = pred.get("atom") if isinstance(pred.get("atom"), dict) else {"predicate": "holds", "args": [text], "polarity": "pos"}
        proof = _proof_shell(world, atom, [
            {"n": i + 1, "kind": "fact", "fact_id": p.get("id"), "premises": [], "substitution": {}, "atom": p.get("atom")}
            for i, p in enumerate(premises)
        ] + ([{
            "n": len(premises) + 1, "kind": "rule", "rule_id": pred.get("how") or "WM-SIMULATE",
            "premises": list(range(1, len(premises) + 1)), "substitution": {}, "atom": atom,
        }] if premises else []))
        checked = check_proof(world, proof) if premises else {"ok": True, "cite": "simulate_no_premises_check"}
        claim = _finish_claim(
            world, text, atom, premises or [{"id": "simulate", "text": text, "source": "simulate"}],
            proof, checked, "supported_only", str(pred.get("how") or "WM-SIMULATE"), phase_path or [],
        )
        claim["fact_frame"] = pred.get("fact_frame")
        claim["frame_match"] = {
            "rule": str(pred.get("how") or "WM-SIMULATE"),
            "filler": text,
            "orientation": "effect",
            "frame_source": "simulate",
            "complete": True,
            "roles": 1,
            "gap": "pred",
        }
        claim["simulate_chain"] = simulated.get("chain") or []
        claim["kind"] = "causal_prediction"
        claim["may_store_as_fact"] = False
        claim["state_before"] = pred.get("state_before")
        claim["state_after"] = pred.get("state_after")
        # A checker-replayed solver receipt is the measured premise. Its retrieval weight is the frame gate
        # (S and C hold because the receipt unified with this intervention and the sha256 replayed). ΔΦ is not in C.
        if str(pred.get("how") or "") == "WM-SOLVER-RECEIPT" and checked.get("ok"):
            claim["gate"] = {"passes": True, "S": 1.0, "C": 1.0, "phi_query": 7, "operation": "WM-SOLVER-RECEIPT"}
        extra = [p for p in (pred.get("ground_premises") or []) if isinstance(p, dict)]
        if extra:
            have = {str(p.get("id")) for p in (claim.get("premises") or []) if isinstance(p, dict)}
            claim["premises"] = list(claim.get("premises") or []) + [p for p in extra if str(p.get("id")) not in have]
        # Speak the chain like a copula hop: each premise (exact stored sentence) then the effect conclusion.
        # measure_spoken then scores hops against their own rows (high C); Echo still reads the effect filler.
        supplied = [a for a in (pred.get("spoken_atoms") or []) if isinstance(a, dict) and str(a.get("text") or "").strip()]
        if supplied:
            # The solver already named each clause's atom. Nothing here splits or re-reads the English.
            spoken_atoms = []
            for i, a in enumerate(supplied):
                sent = str(a.get("text") or "").strip()
                if sent[:1].islower():
                    sent = sent[:1].upper() + sent[1:]
                if not sent.endswith((".", "!", "?")):
                    sent += "."
                atom = a.get("atom") if isinstance(a.get("atom"), dict) and a["atom"].get("predicate") not in ("holds", "stated") else None
                spoken_atoms.append({
                    "text": sent, "atom": atom, "verbatim": atom is None,
                    "source_id": None if atom else (premises[0].get("id") if premises else None),
                    "role": str(a.get("role") or ("conclusion" if i == len(supplied) - 1 else "premise")),
                    "state_before": a.get("state_before", pred.get("state_before")),
                    "state_after": a.get("state_after", pred.get("state_after")),
                })
            spoken = " ".join(a["text"] for a in spoken_atoms)
            claim["text"] = spoken
            claim["spoken_atoms"] = spoken_atoms
            if isinstance(claim.get("frame_match"), dict):
                claim["frame_match"]["filler"] = spoken
        else:
            # A remembered causal chain has no solver atoms. Speak each stored premise, then the effect,
            # so each hop is measured against its own row. These sentences are quoted: they were not
            # built as kāraka atoms by a solver.
            seen_txt = set()
            parts = []
            pred_sents = {_norm(s) for s in _sentences(text)}
            for prem in premises:
                pt = str(prem.get("text") or "").strip()
                if pt and _norm(pt) not in seen_txt and _norm(pt) not in pred_sents:
                    seen_txt.add(_norm(pt))
                    parts.append(pt if pt.endswith((".", "!", "?")) else pt + ".")
            if text and _norm(text) not in seen_txt:
                parts.append(text if text.endswith((".", "!", "?")) else text + ".")
            spoken_atoms = []
            last = len(parts) - 1
            prem_id = premises[0].get("id") if premises else None
            for i, sent in enumerate(parts):
                if sent[:1].islower():
                    sent = sent[:1].upper() + sent[1:]
                spoken_atoms.append({
                    "text": sent, "atom": None, "verbatim": True, "source_id": prem_id,
                    "role": "conclusion" if i == last else "premise",
                })
            claim["text"] = text
            claim["spoken_atoms"] = spoken_atoms
            spoken = " ".join(a["text"] for a in spoken_atoms) if spoken_atoms else text
        derived = dict(derived)
        derived["status"] = "supported_only"
        derived["reason"] = "simulate_forward_chain"
        derived["survivor"] = claim
        derived["derived_text"] = spoken
        derived["derived_atoms"] = claim["spoken_atoms"]
        derived["claims"] = list(derived.get("claims") or []) + [claim]
        derived["match_mode"] = "simulate"
    count = int(memory.get("active_memory_count") or memory.get("active") or len(source_rows) or 0)
    survivor = derived.get("survivor")
    return {
        "layer": "world_model",
        "slot": "reasoning",
        "status": "world_model_v1",
        "schema": "TurnWorld/v1",
        "applied": True,
        "sits_after": "memory_recall",
        "sits_before": "output_renderer",
        "question_sha256_16": hashlib.sha256(str(question or "").encode("utf-8", errors="replace")).hexdigest()[:16],
        "input_memory_count": count,
        "output_memory_count": count,
        "derived_text": derived.get("derived_text") or "",
        "derived_atoms": derived.get("derived_atoms"),
        # 4.9.234 (plan 229 step 6): the RMC reading that ran before the world model, in series
        "upstream": memory.get("upstream") if isinstance(memory.get("upstream"), dict) else None,
        "calls_llm": False,
        "writes_memory": False,
        "writes_durable_memory": False,
        "christping_initiated": False,
        "model_invoked": False,
        "world_root": world.get("root"),
        "parent_root": world.get("parent_root"),
        "world": {
            "schema": world.get("schema"),
            "root": world.get("root"),
            "parent_root": world.get("parent_root"),
            "version": world.get("version"),
            "branch_id": world.get("branch_id"),
            "entities": (world.get("entities") or [])[:24],
            "facts": [{"id": f["id"], "text": f["text"], "status": f["status"], "self_fact": bool(f.get("self_fact")), "provenance": f.get("provenance"), "atom_source": f.get("atom_source"), "frame": f.get("frame"), **_place_fields(f.get("place"))} for f in world.get("facts") or [] if f.get("self_fact") or f.get("status") != "admitted" or (survivor and f["id"] in (survivor.get("provenance") or []))][:24],
            "rules": [{"id": r["id"], "cite": r.get("cite")} for r in world.get("rules") or []],
            "query": {"text": question, "status": derived.get("status")},
        },
        "observe": observed,
        "self_facts": {"seed": seed_trace, "evolvable": True, "cite": "spec 1vBx_Q9K §4.7 supersession keeps the parent root"},
        "derive": {k: derived[k] for k in ("operation", "cite", "status", "reason", "incomplete", "claims", "survivor", "derived_text", "calls_llm") if k in derived},
        "debate": (survivor or {}).get("debate") if survivor else {"survived": False, "calls_llm": False, "order": ["proponent", "opponent"]},
        "proofs": derived.get("proofs") or {},
        "checker": {"ok": bool(survivor and survivor.get("checker_ok")), "cite": "contract 1g2034-K §6 step 7"},
        "simulate": simulated,
        "limits": world.get("limits"),
        "effects": {"network_calls": 0, "tool_executions": 0, "knowledge_writes": 0, "world_writes": 0, "christping_initiated": False},
        "cites": [
            "spec 1vBx_Q9K §1.4",
            "contract 1g2034-K §2 §4.2 §4.3 §5 §6 §7 §8 §13",
            "source/src/reason.js LIMITS",
            "source/engine/rmc_engine_v1/mobile_config.py",
            "source/engine/rmc_engine_v1/chi_correction_gate.py evaluate_chi_t",
            "source/engine/rmc_engine_v1/measurement_kernel.py measure_candidate",
            "source/src/lexicon.js Doc 4 and Doc 5",
            "BogaertN/echo-forge orchestrator.py conduct_debate_round",
            "BogaertN/forge echoforge_advisory/runtime.py",
        ],
    }


def _f(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
