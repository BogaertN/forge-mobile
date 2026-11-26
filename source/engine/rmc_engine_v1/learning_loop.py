"""Induction proposals from repeated admitted clauses.

A proposal is not a fact. Gilligan searches the same facts and the refuted ledger
for a counterexample. Derive speaks a conclusion only when that search is clean
and the phone has admitted the rule. The premises are the supporting instances.
"""
from __future__ import annotations

import re
from typing import Any

MIN_SUPPORT = 3


def _norm(text: str) -> str:
    token = re.sub(r"\s+", " ", str(text or "").strip().lower())
    token = re.sub(r"^(the|a|an)\s+", "", token)
    return token.strip(" .")


def _head(np: Any) -> str:
    if not isinstance(np, dict):
        return _norm(np)
    head = np.get("head")
    if isinstance(head, list) and head:
        return _norm(head[-1])
    if isinstance(head, str) and head:
        return _norm(head)
    return _norm(np.get("text"))


def _frame(fact: dict[str, Any]) -> dict[str, Any] | None:
    frame = fact.get("frame") if isinstance(fact.get("frame"), dict) else None
    if frame and frame.get("kartr"):
        return frame
    clause = fact.get("clause") if isinstance(fact.get("clause"), dict) else None
    if clause and clause.get("kartr"):
        return clause
    return None


def _subject(frame: dict[str, Any]) -> str:
    return _head(frame.get("kartr"))


def induce(facts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Many subjects that are one kind and share one property. Support is a count."""
    kinds: dict[str, dict[str, dict[str, Any]]] = {}
    props: dict[str, dict[str, dict[str, Any]]] = {}
    neg: dict[str, set[str]] = {}
    for fact in facts or []:
        if not isinstance(fact, dict) or fact.get("self_fact") or fact.get("quarantined"):
            continue
        frame = _frame(fact)
        if not frame:
            continue
        subj = _subject(frame)
        if not subj:
            continue
        kriya = str(frame.get("kriya") or "")
        pol = str(frame.get("polarity") or "pos")
        if kriya == "be" and pol != "neg":
            pred = frame.get("pred") if isinstance(frame.get("pred"), dict) else {}
            if str(pred.get("type") or "np") in ("np", ""):
                kind = _head(pred)
                if kind and kind != subj:
                    kinds.setdefault(kind, {})[subj] = fact
        elif kriya == "have":
            prop = _head(frame.get("karma"))
            if not prop:
                continue
            karma = frame.get("karma") if isinstance(frame.get("karma"), dict) else {}
            if pol == "neg" or str(karma.get("quant") or "") == "no":
                neg.setdefault(subj, set()).add(prop)
            else:
                props.setdefault(subj, {})[prop] = fact
    proposals = []
    for kind, members in sorted(kinds.items()):
        if len(members) < MIN_SUPPORT:
            continue
        counted: dict[str, list[dict[str, Any]]] = {}
        counters: dict[str, list[str]] = {}
        for subj, kind_fact in members.items():
            for prop, prop_fact in (props.get(subj) or {}).items():
                counted.setdefault(prop, []).append({"subject": subj, "kind": kind_fact, "have": prop_fact})
            for prop in neg.get(subj) or ():
                counters.setdefault(prop, []).append(subj)
        for prop, rows in sorted(counted.items()):
            support = len(rows)
            against = counters.get(prop) or []
            if support < MIN_SUPPORT:
                continue
            rule_id = "kind-property:" + kind + ":" + prop
            proposals.append({
                "id": rule_id,
                "kind": kind,
                "property": prop,
                "support": support,
                "counterexamples": len(against),
                "confidence": round(support / (support + len(against)), 6),
                "instances": [{"subject": row["subject"], "kind_id": row["kind"].get("id"), "have_id": row["have"].get("id"),
                                "kind_text": row["kind"].get("text"), "have_text": row["have"].get("text")} for row in rows],
                "status": "proposal",
                "spoken_as_fact": False,
                "calls_llm": False,
            })
    return proposals


def gilligan(proposal: dict[str, Any], facts: list[dict[str, Any]], ledger: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    """Counterexample search. A hit refutes the proposal. No hit does not admit it."""
    fresh = induce(facts)
    found = next((row for row in fresh if row.get("id") == proposal.get("id")), None)
    if not found:
        return dict(proposal, status="refuted", reason="support_lost", validator="gilligan")
    if found["counterexamples"]:
        return dict(found, status="refuted", reason="counterexample_in_memory", validator="gilligan")
    kind, prop = found["kind"], found["property"]
    for entry in ledger or []:
        if not isinstance(entry, dict) or entry.get("status") not in (None, "refuted"):
            continue
        text = _norm(entry.get("text"))
        if kind in text and prop in text and any(mark in text for mark in (" no ", " not ", "never")):
            return dict(found, status="refuted", reason="refuted_ledger", validator="gilligan", ledger=entry.get("text"))
    return dict(found, status="validated", reason="no_counterexample", validator="gilligan", admitted=False)


def review(facts: list[dict[str, Any]], admitted_ids: list[str] | None, ledger: list[dict[str, Any]] | None,
           qframe: dict[str, Any] | None) -> dict[str, Any]:
    """Proposals always. An application only when the phone admitted a validated rule."""
    proposals = [gilligan(row, facts, ledger) for row in induce(facts)]
    applied = None
    wanted = set(str(i) for i in (admitted_ids or []))
    if isinstance(qframe, dict) and str(qframe.get("kriya") or "") == "have":
        prop = _head(qframe.get("karma"))
        subj = _head(qframe.get("kartr"))
        for row in proposals:
            if row.get("status") != "validated" or row.get("id") not in wanted or row.get("property") != prop:
                continue
            kind_fact = next((f for f in facts if _frame(f) and str((_frame(f) or {}).get("kriya") or "") == "be" and _subject(_frame(f) or {}) == subj and _head((_frame(f) or {}).get("pred")) == row.get("kind")), None)
            if not kind_fact:
                continue
            applied = {"rule": row, "subject_fact": kind_fact, "subject": subj}
            break
    return {"proposals": proposals, "applied": applied, "spoken_as_fact": False, "calls_llm": False, "changes_gates": False}
