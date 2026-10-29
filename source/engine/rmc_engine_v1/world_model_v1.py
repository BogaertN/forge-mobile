"""World model v1: Observe and Derive. Simulate is deferred.

Citations
  Spec 1vBx_Q9K §1.4 — Observe(W_v, E), Derive(W_v, R, Q), Simulate(W_v, R, H, Q).
  Contract 1g2034-K §2 — who owns interpretation, world state, orchestration.
  Contract §4.2 TurnWorld/v1 and §4.3 Proof/v1.
  Contract §5 — finite forward derivation, four-valued result, no explosion.
  Contract §6 — pipeline, including an independent proof replay.
  Contract §7 — simple positive and negative facts.
  Contract §8 — tool output is evidence until admitted. No durable write (I4).
  Contract §10 and source/src/reason.js LIMITS — the bounds already in the phone.
  Contract §13 — simulation and counterfactuals are deferred.
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
        "rules": [dict(COPULA_RULE)],
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
    }


def seed_self_facts(world: dict[str, Any]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """Self-facts live in the world. They are contract sentences, not answers."""
    facts = []
    trace = []
    for row in SELF_FACTS:
        parsed = {"text": row["text"], "atom": _atom(row["predicate"], list(row["args"]), "pos"), "parsed": True}
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


def observe(world: dict[str, Any], events: list[dict[str, Any]]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Spec §1.4 Observe. Spec §4.7 supersession. Contract §8 quarantine is not admission.

    Returns a new world. The parent root is kept. Nothing is written to disk.
    """
    facts = [dict(f) for f in world.get("facts") or []]
    revisions: list[dict[str, Any]] = []
    admitted = 0
    quarantined = 0
    superseded = 0
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
        for sentence in _sentences(raw):
            if len(facts) >= LIMITS["MAX_FACTS"]:
                revisions.append({"op": "limit", "reason": "MAX_FACTS", "cite": LIMITS["cite"]})
                break
            parsed = parse_sentence(sentence)
            if not parsed:
                continue
            fid = eid + ":" + _digest(parsed["text"])[:10]
            if any(f.get("id") == fid for f in facts):
                continue
            row = _fact_row(
                fid, parsed, source=str(event.get("source") or "receipt"),
                provenance=[eid], quarantined=is_q,
                cite="contract 1g2034-K §8 tool output is evidence until admitted" if is_q else "contract 1g2034-K §4.2 admitted fact",
            )
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
            if rule["id"] == "WM-COPULA-CHAIN" and _norm(sub.get("$x", "")) == _norm(sub.get("$z", "")):
                return {"ok": False, "reason": "guard_distinct", "cite": "contract 1g2034-K §5"}
        else:
            return {"ok": False, "reason": "step_kind", "cite": "contract 1g2034-K §4.3"}
        derived[n] = atom
        if len(derived) > LIMITS["MAX_PROOF_DEPTH"]:
            return {"ok": False, "reason": "proof_depth", "cite": "contract 1g2034-K §10"}
    last = steps[-1].get("atom")
    if last != proof.get("conclusion"):
        return {"ok": False, "reason": "conclusion_mismatch", "cite": "contract 1g2034-K §6 step 8"}
    return {"ok": True, "reason": "replayed", "cite": "contract 1g2034-K §6 step 7", "steps": len(steps)}


def _coverage(question: str, text: str) -> float:
    left = content_tokens(question)
    right = content_tokens(text)
    if not left:
        return 0.0
    return len(left & right) / len(left)


def _render_atom(atom: dict[str, Any]) -> str:
    """Contract I1 and §9. The template expresses this atom. It does not pick another."""
    args = [str(a) for a in atom.get("args") or []]
    predicate = str(atom.get("predicate") or "")
    if predicate == "is" and atom.get("polarity") == "neg" and len(args) == 2:
        return f"{args[0]} is not {args[1]}."
    if predicate == "is" and len(args) == 2:
        return f"{args[0]} is {args[1]}."
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


def _chain_proof(world: dict[str, Any], left: dict[str, Any], right: dict[str, Any], sub: dict[str, str], conclusion: dict[str, Any]) -> dict[str, Any]:
    return _proof_shell(world, conclusion, [
        {"n": 1, "kind": "fact", "fact_id": left["id"], "premises": [], "substitution": {}, "atom": left["atom"]},
        {"n": 2, "kind": "fact", "fact_id": right["id"], "premises": [], "substitution": {}, "atom": right["atom"]},
        {"n": 3, "kind": "rule", "rule_id": "WM-COPULA-CHAIN", "premises": [1, 2], "substitution": sub, "atom": conclusion},
    ])


def _drift_for(text: str, premises: list[dict[str, Any]], phase_path: list[Any]) -> dict[str, Any]:
    """measurement_kernel epsilon, unmodified. mobile_config bands decide the disposition."""
    nodes = []
    for premise in premises:
        nodes.append({
            "memory_id": premise.get("id"),
            "content_summary": premise.get("text") or "",
            "content": premise.get("text") or "",
            "confidence": "low" if premise.get("quarantined") else "medium_high",
            "retrieval_weight": 0.8,
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
    if eps > float(THRESHOLDS["hard_stop"]):
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


def derive(world: dict[str, Any], question: str, phase_path: list[Any] | None = None) -> dict[str, Any]:
    """Spec §1.4 Derive. Contract §5 four-valued result. Contract §6 steps 6–8."""
    facts = _active(world)
    # Self-facts answer a question about Forge. They are not topical premises for other questions.
    topical = [f for f in facts if not f.get("self_fact")]
    q_tokens = content_tokens(question)
    claims: list[dict[str, Any]] = []
    incomplete = False
    if not q_tokens:
        return _derive_report(world, question, "undetermined", "no content tokens in the question", claims, incomplete)
    if len(question) > LIMITS["MAX_INPUT_CHARS"]:
        return _derive_report(world, question, "incomplete", "MAX_INPUT_CHARS", claims, True)

    # Direct support. Contract acceptance C: a stored fact that answers the query.
    ranked = sorted(topical, key=lambda f: (-_coverage(question, f["text"]), str(f["id"])))
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
    hops = _match_body(COPULA_RULE["body"], topical)
    rounds = 0
    for sub, chosen in hops:
        rounds += 1
        if rounds > LIMITS["MAX_ROUNDS"] or len(claims) >= 12:
            incomplete = True
            break
        conclusion = _bind(COPULA_RULE["head"], sub)
        # Keep the surface spans from the premises so the sentence is their words.
        conclusion = _atom("is", [
            (chosen[0]["atom"]["args"][0]),
            (chosen[1]["atom"]["args"][1]),
        ], "pos")
        text = _render_atom(conclusion)
        if _coverage(question, text) <= 0:
            continue
        proof = _chain_proof(world, chosen[0], chosen[1], sub, conclusion)
        checked = check_proof(world, proof)
        claims.append(_finish_claim(
            world, text, conclusion, chosen, proof, checked, "supported_only", "WM-COPULA-CHAIN", phase_path or [],
        ))

    # Both polarities. Contract §5. A positive and a negative for the same normalized atom conflict.
    for claim in claims:
        atom = claim["atom"]
        if atom.get("predicate") != "is":
            continue
        opposite = "neg" if atom.get("polarity") != "neg" else "pos"
        for other in topical:
            oatom = other.get("atom") or {}
            if oatom.get("predicate") != "is" or oatom.get("polarity") != opposite:
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
    return _derive_report(world, question, status, "closure" if not incomplete else "MAX_ROUNDS", claims, incomplete)


def _finish_claim(world, text, atom, premises, proof, checked, status, how, phase_path) -> dict[str, Any]:
    drift = _drift_for(text, premises, phase_path)
    claim = {
        "text": text,
        "atom": atom,
        "status": status,
        "how": how,
        "premises": [{"id": p["id"], "text": p["text"], "source": p.get("source"), "quarantined": bool(p.get("quarantined")), "provenance": p.get("provenance")} for p in premises],
        "provenance": [p["id"] for p in premises],
        "proof_id": proof.get("proof_id"),
        "proof": proof,
        "checker_ok": checked.get("ok") is True,
        "checker_reason": checked.get("reason"),
        "drift": drift,
        "chi": drift.get("chi"),
    }
    claim["debate"] = run_debate(claim, content_tokens=content_tokens)
    return claim


def _derive_report(world, question, status, reason, claims, incomplete) -> dict[str, Any]:
    survivors = [c for c in claims if c.get("debate", {}).get("survived")]
    survivors.sort(key=lambda c: (
        -_coverage(question, c.get("text") or ""),
        -len(c.get("provenance") or []),
        float((c.get("drift") or {}).get("epsilon_s") or 0.0),
        str(c.get("proof_id")),
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
        "derived_text": (chosen or {}).get("text") or "",
        "proofs": {((c.get("proof") or {}).get("proof_id") or "none"): {"steps": (c.get("proof") or {}).get("steps"), "ok": c.get("checker_ok")} for c in claims[:8]},
    }


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
        "debate": {
            "survived": debate.get("survived"),
            "frame": (debate.get("frame") or {}).get("id"),
            "proponent": debate.get("proponent"),
            "opponent": debate.get("opponent"),
            "calls_llm": False,
        },
    }


def simulate(world: dict[str, Any], query: str = "") -> dict[str, Any]:
    """Spec §1.4 names Simulate. Contract §13 defers it. No hypothetical is written."""
    return {
        "operation": "Simulate",
        "status": "deferred",
        "cite": "spec 1vBx_Q9K §1.4 Simulate; contract 1g2034-K §13 deferred counterfactual and causal simulation; spec §6 not this slice",
        "world_root": world.get("root"),
        "query": query,
        "hypothetical_result": None,
        "writes_observed": False,
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


def run_world_model(question: str, memory: dict[str, Any] | None = None) -> dict[str, Any]:
    """Observe recalled evidence, Derive, debate. Simulate stays deferred."""
    memory = dict(memory or {})
    phase_path = memory.get("phase_path") if isinstance(memory.get("phase_path"), list) else ["Φ1"]
    events = []
    nodes = memory.get("nodes") if isinstance(memory.get("nodes"), list) else []
    rows = memory.get("rows") if isinstance(memory.get("rows"), list) else []
    source_rows = nodes or rows
    for node in source_rows:
        if not isinstance(node, dict):
            continue
        text = _clean_node_text(str(node.get("text") or node.get("content") or node.get("content_summary") or ""))
        if not text:
            continue
        prior = _f(node.get("prior_drift_score"), 0.0)
        low = str(node.get("confidence") or "") == "low" or prior >= 0.40 or node.get("quarantined") is True
        events.append({
            "id": str(node.get("id") or node.get("memory_id") or node.get("receipt_id") or ""),
            "text": text,
            "source": node.get("source") or node.get("source_kind") or "recall",
            "confidence": node.get("confidence"),
            "prior_drift_score": prior,
            "quarantined": low,
        })
    base, seed_trace = seed_self_facts(empty_world())
    world, observed = observe(base, events)
    derived = derive(world, question, phase_path)
    simulated = simulate(world, question)
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
            "facts": [{"id": f["id"], "text": f["text"], "status": f["status"], "self_fact": bool(f.get("self_fact")), "provenance": f.get("provenance")} for f in world.get("facts") or [] if f.get("self_fact") or f.get("status") != "admitted" or (survivor and f["id"] in (survivor.get("provenance") or []))][:24],
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
