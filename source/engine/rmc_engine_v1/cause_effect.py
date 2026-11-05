"""Cause and effect: the named home in the engine (4.9.229, Nic pt146u). A SPOT ONLY: nothing here predicts yet.

Nic (pt146u): "a spot for cause and effect so that it's in the code you don't necessarily need to do it just yet but
just a spot so it's in the code". Design: /workspace/forge-cause-effect-world-model.md (FORGE-CAUSAL-RULE/v1).

What this module fixes in place (the contract later releases must keep):
  * A cause is a RULE over KINDS, not a sentence about one named thing. Its roles (action, object, support, outcomes) are
    keyed by Open English WordNet sense ids ("01875972-v" push, "02879899-n" bottle) or by a named type ("@level_surface")
    that is resolved through the sense graph. Never by spelling.
  * Two record classes for laws and rules:
      - SOURCED laws (source_class "sourced"): two independent trusted publishers agree on meaning plus category
        (the same rule as Athena's facts); Wikidata only as a link.
      - DERIVED rules (source_class "derived"): algebra from sourced laws, carrying derived_from + a replayable proof.
        A derived criterion is never looked up.
    "stated_by_user" and "hypothesis" are the other two classes; neither is a premise for an admitted answer.
  * A PREDICTION IS NEVER STORED AS A FACT. predict() results are branch-local; may_store_as_fact() is always False for
    them. Only an observation ("I pushed it and it slid") can be remembered, through the ordinary memory gate (Echo >= 0.97).
  * Phase/band placement of a rule is an index for filing and recall, never a physical time step.

The first worked case (release C1 in the design) is the bottle on a table: pushed near the top it tips, near the bottom
it slides (h* = w / mu_s). It is NOT implemented here. RULES is empty and predict() returns status "not_implemented".
No LLM, no network, no randomness, no writes.
"""
from __future__ import annotations

import re
from typing import Any, TypedDict

SCHEMA = "FORGE-CAUSAL-RULE/v1"
HOOK_SCHEMA = "FORGE-CAUSE-EFFECT-HOOK/v1"
STATUS = "not_implemented"
SOURCE_CLASSES = ("sourced", "derived", "stated_by_user", "hypothesis")
KINDS = ("causal_transition",)
DETERMINISM = ("deterministic", "deterministic_onset", "set_valued", "qualitative")
SENSE_ID = re.compile(r"^\d{8}-[nvars]$")
TYPE_REF = re.compile(r"^@[a-z][a-z0-9_]*$")


class TypedVariable(TypedDict, total=False):
    name: str
    type: str          # length, force, dimensionless, ...
    role: str


class CausalSenses(TypedDict, total=False):
    action: list[str]            # OEWN verb sense ids
    object: list[str]            # sense ids or @type refs
    support: list[str]
    outcomes: dict[str, str | None]


class CausalRule(TypedDict, total=False):
    """FORGE-CAUSAL-RULE/v1 (design section 2). Rules over kinds, keyed by sense ids."""
    schema: str
    rule_id: str
    version: int
    kind: str
    determinism: str
    senses: CausalSenses
    typed_variables: list[TypedVariable]
    preconditions: list[str]
    intervention: dict[str, Any]
    effects: list[dict[str, Any]]
    frame_conditions: list[str]
    assumptions: list[str]
    source_class: str             # sourced | derived | stated_by_user | hypothesis
    evidence_refs: list[dict[str, Any]]   # sourced: >= 2 independent hosts
    derived_from: list[str]       # derived: law ids
    proof: str | None             # derived: replayable proof id
    validity_scope: str
    falsifiers: list[str]
    placement: dict[str, Any]     # filing index only (not physics)


# The mechanism store. Empty on purpose until C1 (sourced statics laws + the derived tip-or-slide rule, a SHA-pinned pack).
RULES: tuple[CausalRule, ...] = ()


def _sense_ok(x: Any) -> bool:
    return isinstance(x, str) and bool(SENSE_ID.match(x) or TYPE_REF.match(x))


def validate_rule(rule: dict[str, Any]) -> dict[str, Any]:
    """Structural check of a FORGE-CAUSAL-RULE/v1 record. It validates shape only; it admits nothing."""
    errs: list[str] = []
    if not isinstance(rule, dict):
        return {"ok": False, "errors": ["not a record"]}
    if rule.get("schema") != SCHEMA:
        errs.append("schema")
    if not rule.get("rule_id"):
        errs.append("rule_id")
    if rule.get("kind") not in KINDS:
        errs.append("kind")
    if rule.get("determinism") not in DETERMINISM:
        errs.append("determinism")
    senses = rule.get("senses") or {}
    for role in ("action", "object"):
        vals = senses.get(role) or []
        if not vals or not all(_sense_ok(v) for v in vals):
            errs.append("senses." + role + " must be sense ids or @types (never spellings)")
    for name, sid in (senses.get("outcomes") or {}).items():
        if sid is not None and not _sense_ok(sid):
            errs.append("senses.outcomes." + str(name))
    sc = rule.get("source_class")
    if sc not in SOURCE_CLASSES:
        errs.append("source_class")
    if sc == "sourced":
        hosts = {str((e or {}).get("host") or "") for e in rule.get("evidence_refs") or []} - {""}
        if len(hosts) < 2:
            errs.append("a sourced law needs two independent publishers")
    if sc == "derived" and (not rule.get("derived_from") or not rule.get("proof")):
        errs.append("a derived rule needs derived_from and a proof")
    if not rule.get("effects"):
        errs.append("effects")
    return {"ok": not errs, "errors": errs}


def predict(question: str, world: dict[str, Any] | None = None, rules: tuple[CausalRule, ...] | list | None = None) -> dict[str, Any]:
    """The cause-and-effect hook. NOT YET IMPLEMENTED: always returns no prediction and admits nothing.

    Later (C1): parse roles (karta/karma/kriya/adhikarana) to sense ids, retrieve rules structurally by
    (action sense, outcome senses, object type), check preconditions against meaning-keyed facts, replay the derivation,
    and answer exactly or conditionally. The result stays branch-local; it is never written as a fact.
    """
    pool = RULES if rules is None else tuple(rules)
    return {
        "schema": HOOK_SCHEMA,
        "operation": "CauseEffect",
        "status": STATUS,
        "rule": "CAUSE-EFFECT-NOT-YET",
        "question": str(question or ""),
        "world_root": (world or {}).get("root") if isinstance(world, dict) else None,
        "rules_loaded": len(pool),
        "prediction": None,
        "admit": False,
        "store_as_fact": False,
        "writes": False,
        "calls_llm": False,
        "note": "spot only (Nic pt146u); predictions are never stored as facts",
    }


def is_prediction(row: dict[str, Any] | None) -> bool:
    """True for anything produced by this hook (a prediction), wherever it travels."""
    if not isinstance(row, dict):
        return False
    prov = row.get("provenance") if isinstance(row.get("provenance"), dict) else {}
    return (row.get("schema") == HOOK_SCHEMA or prov.get("schema") == HOOK_SCHEMA or row.get("operation") == "CauseEffect"
            or prov.get("kind") == "causal_prediction" or row.get("kind") == "causal_prediction")


def may_store_as_fact(row: dict[str, Any] | None) -> bool:
    """A prediction is never a fact. Everything else is decided by the ordinary gates, not here."""
    return not is_prediction(row)
