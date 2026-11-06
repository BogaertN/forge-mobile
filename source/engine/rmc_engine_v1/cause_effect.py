"""Cause and effect (4.9.243, plan 229 step 12): typed causal frames from clauses, and bounded Simulate.

Replaces the 4.9.229 spot (RULES empty, predict not_implemented). Causal English
("X causes Y", "if X then Y", "V-ing NP makes it fall") is read into FORGE-CAUSAL-FRAME/v1
records with provenance. Simulation forward-chains state changes with bounded depth and
reports the chain. PREDICTION IS NEVER STORED AS A FACT. Predictions stay branch-local: may_store_as_fact is always False.

The bottle push (Nic 229 audit) is not special-cased: "it falls" follows only when a
general causal fact (e.g. pushing an object on a table edge makes it fall) is stored or
admitted and unifies with the state and the intervention. With no causal fact, Simulate
holds honestly (undetermined).

No LLM, no network, no randomness, no durable writes.
"""
from __future__ import annotations

import re
from typing import Any, TypedDict

SCHEMA = "FORGE-CAUSAL-RULE/v1"
FRAME_SCHEMA = "FORGE-CAUSAL-FRAME/v1"
HOOK_SCHEMA = "FORGE-CAUSE-EFFECT-HOOK/v1"
STATUS = "ready"
SOURCE_CLASSES = ("sourced", "derived", "stated_by_user", "hypothesis")
KINDS = ("causal_transition",)
DETERMINISM = ("deterministic", "deterministic_onset", "set_valued", "qualitative")
SENSE_ID = re.compile(r"^\d{8}-[nvars]$")
TYPE_REF = re.compile(r"^@[a-z][a-z0-9_]*$")

# Bound on Simulate forward-chaining (contract §5 / §10 finite derivation).
MAX_SIM_DEPTH = 4
MAX_SIM_STEPS = 16


class TypedVariable(TypedDict, total=False):
    name: str
    type: str
    role: str


class CausalSenses(TypedDict, total=False):
    action: list[str]
    object: list[str]
    support: list[str]
    outcomes: dict[str, str | None]


class CausalRule(TypedDict, total=False):
    """FORGE-CAUSAL-RULE/v1. Rules over kinds, keyed by sense ids or @types — never spellings."""
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
    source_class: str
    evidence_refs: list[dict[str, Any]]
    derived_from: list[str]
    proof: str | None
    validity_scope: str
    falsifiers: list[str]
    placement: dict[str, Any]


def _rule(rule_id: str, proof: str, preconditions: list[str], effects: list[dict[str, Any]],
          action: str, outcome: str) -> CausalRule:
    return {
        "schema": SCHEMA,
        "rule_id": rule_id,
        "version": 1,
        "kind": "causal_transition",
        "determinism": "qualitative",
        "senses": {
            "action": [action],
            "object": ["@entity"],
            "support": ["@support"],
            "outcomes": {"effect": outcome},
        },
        "typed_variables": [
            {"name": "$cause", "type": "event", "role": "cause"},
            {"name": "$effect", "type": "event", "role": "effect"},
        ],
        "preconditions": preconditions,
        "intervention": {},
        "effects": effects,
        "frame_conditions": ["unifier=COPULA_RULE_style"],
        "assumptions": ["range_restricted_to_stored_or_admitted_causal_frames"],
        "source_class": "derived",
        "evidence_refs": [],
        "derived_from": ["WM-CAUSAL-SCHEMA"],
        "proof": proof,
        "validity_scope": "phone_and_admitted_causal_frames",
        "falsifiers": ["missing_causal_frame", "intervention_does_not_unify"],
        "placement": {"index": "filing_only"},
    }


# 1–3 hand-written range-restricted rules (plan 229 step 12). Same unifier style as COPULA_RULE:
# body premises unify, head is the derived effect. Content comes from stored/admitted frames, not
# from these skeletons (no bottle special case).
RULES: tuple[CausalRule, ...] = (
    _rule(
        "WM-CAUSES-APPLY",
        "forward_unify_causes",
        ["causal_frame.kind=causes", "holds($cause) OR intervention_matches($cause)"],
        [{"predicate": "holds", "args": ["$effect"]}],
        "@cause",
        "@state_change",
    ),
    _rule(
        "WM-IF-THEN-APPLY",
        "forward_unify_if_then",
        ["causal_frame.kind=if_then", "holds($antecedent) OR intervention_matches($antecedent)"],
        [{"predicate": "holds", "args": ["$consequent"]}],
        "@condition",
        "@consequent",
    ),
    _rule(
        "WM-MAKES-APPLY",
        "forward_unify_makes",
        ["causal_frame.kind=makes", "intervention.action~frame.action", "state.locus~frame.locus"],
        [{"predicate": "holds", "args": ["$effect"]}],
        "@action",
        "@effect",
    ),
)


def _sense_ok(x: Any) -> bool:
    return isinstance(x, str) and bool(SENSE_ID.match(x) or TYPE_REF.match(x))


def validate_rule(rule: dict[str, Any]) -> dict[str, Any]:
    """Structural check of a FORGE-CAUSAL-RULE/v1 record. Validates shape only; admits nothing."""
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


def _norm(text: Any) -> str:
    t = re.sub(r"\s+", " ", str(text or "").strip().lower()).strip(" .,;:!?")
    return re.sub(r"^(the|a|an)\s+", "", t)


def _stem_verb(word: str) -> str:
    w = _norm(word)
    if w.endswith("ying") and len(w) > 4:
        return w[:-4] + "y"
    if w.endswith("ing") and len(w) > 4:
        base = w[:-3]
        if len(base) >= 2 and base[-1] == base[-2] and base[-1] not in "aeiou":
            base = base[:-1]
        return base
    if w.endswith("es") and len(w) > 3:
        return w[:-2]
    if w.endswith("s") and len(w) > 3 and not w.endswith("ss"):
        return w[:-1]
    if w.endswith("ed") and len(w) > 3:
        return w[:-2]
    return w


_GERUND_MAKES = re.compile(
    r"^(.+?ing(?:\s+\S+)*?)\s+makes?\s+(it|them|him|her|that|this|.+?)\s+(.+)$",
    re.I,
)
_CAUSES = re.compile(r"^(.+?)\s+causes?\s+(.+)$", re.I)
_IF_THEN = re.compile(r"^if\s+(.+?)(?:,\s*|\s+then\s+)(.+)$", re.I)
_HAPPENS_IF = re.compile(
    r"^what\s+(?:will\s+)?happen(?:s)?\s+(?:if|when)\s+(.+?)\??$",
    re.I,
)
_IF_WHAT_HAPPENS = re.compile(
    r"^if\s+(.+?),?\s+what\s+(?:will\s+)?happen(?:s)?\??$",
    re.I,
)
_PUSH_IT = re.compile(r"^(?:i\s+|you\s+|we\s+|they\s+)?(push|pushes|pushed|pushing)\s+(it|them|.+)$", re.I)
_SIMPLE_EVENT = re.compile(r"^(?:i\s+|you\s+|it\s+|they\s+)?([a-z]+)(?:\s+(.+))?$", re.I)


def _action_from_gerund_phrase(phrase: str) -> dict[str, Any]:
    """'Pushing an object on the edge of a table' → action, object, locus."""
    words = str(phrase or "").strip().split()
    if not words:
        return {"action": "", "object": "", "locus": "", "phrase": phrase}
    action = _stem_verb(words[0])
    rest = " ".join(words[1:])
    locus = ""
    obj = rest
    m = re.search(r"\b(on|at|under|in|from|off)\s+(.+)$", rest, re.I)
    if m:
        locus = (m.group(1) + " " + m.group(2)).strip()
        obj = rest[: m.start()].strip()
    return {"action": action, "object": obj, "locus": locus, "phrase": phrase}


def parse_clause(text: str) -> dict[str, Any] | None:
    """Read one English causal clause into FORGE-CAUSAL-FRAME/v1. None when it is not causal."""
    sentence = re.sub(r"\s+", " ", str(text or "").strip()).strip(" .")
    if not sentence or len(sentence) > 100000:
        return None
    m = _GERUND_MAKES.match(sentence)
    if m:
        phrase, patient, effect = m.group(1).strip(), m.group(2).strip(), m.group(3).strip()
        bits = _action_from_gerund_phrase(phrase)
        # "makes it fall" → effect "it falls" (3sg); keep a multi-word complement as-is
        verb_bits = effect.split()
        if patient.lower() in ("it", "he", "she") and len(verb_bits) == 1:
            v = verb_bits[0].lower()
            if not v.endswith("s") and not v.endswith("ed") and not v.endswith("ing"):
                effect = v + "s"
        effect_text = (patient + " " + effect).strip()
        return {
            "schema": FRAME_SCHEMA,
            "kind": "makes",
            "text": sentence + ".",
            "cause": bits["phrase"],
            "effect": effect_text,
            "action": bits["action"],
            "object": bits["object"],
            "locus": bits["locus"],
            "patient": patient,
            "effect_verb": _stem_verb(effect.split()[0]) if effect.split() else "",
            "rule_id": "WM-MAKES-APPLY",
        }
    m = _IF_THEN.match(sentence)
    if m:
        ant, cons = m.group(1).strip(), m.group(2).strip()
        bits = _action_from_gerund_phrase(ant) if re.search(r"\bing\b", ant, re.I) else _action_from_gerund_phrase(
            re.sub(r"^(?:you|i|we|they|one)\s+", "", ant, flags=re.I)
        )
        # Prefer verb reading of "you push …" / "I push …"
        mpush = _PUSH_IT.match(ant) or _SIMPLE_EVENT.match(ant)
        action = bits["action"]
        obj = bits["object"]
        locus = bits["locus"]
        if mpush:
            action = _stem_verb(mpush.group(1))
            obj = (mpush.group(2) or "").strip()
            loc_m = re.search(r"\b(on|at|under|in|from|off)\s+(.+)$", obj, re.I)
            if loc_m:
                locus = (loc_m.group(1) + " " + loc_m.group(2)).strip()
                obj = obj[: loc_m.start()].strip()
        return {
            "schema": FRAME_SCHEMA,
            "kind": "if_then",
            "text": sentence + ".",
            "cause": ant,
            "effect": cons,
            "antecedent": ant,
            "consequent": cons,
            "action": action,
            "object": obj,
            "locus": locus,
            "rule_id": "WM-IF-THEN-APPLY",
        }
    m = _CAUSES.match(sentence)
    if m:
        cause, effect = m.group(1).strip(), m.group(2).strip()
        # avoid "because" false positives already stripped; skip if cause looks like a conjunction remnant
        if cause.lower() in ("even", "just", "only"):
            return None
        return {
            "schema": FRAME_SCHEMA,
            "kind": "causes",
            "text": sentence + ".",
            "cause": cause,
            "effect": effect,
            "action": "",
            "object": "",
            "locus": "",
            "rule_id": "WM-CAUSES-APPLY",
        }
    return None


def as_parsed(frame: dict[str, Any]) -> dict[str, Any]:
    """World-model parsed row for Observe: atom + causal_frame + a minimal kāraka frame for Echo."""
    kind = str(frame.get("kind") or "causes")
    cause = str(frame.get("cause") or frame.get("antecedent") or "")
    effect = str(frame.get("effect") or frame.get("consequent") or "")
    predicate = {"causes": "causes", "if_then": "if_then", "makes": "makes"}.get(kind, "causes")
    atom = {"predicate": predicate, "args": [cause, effect], "polarity": "pos"}
    # Effect claim frame used when Simulate answers "what happens": kriyā happen, pred = effect event.
    effect_words = effect.split()
    effect_head = _stem_verb(effect_words[-1]) if effect_words else "happen"
    kartr_text = "it"
    if effect_words and effect_words[0].lower() not in ("it", "they", "he", "she"):
        # "the ground gets wet" / "muddy shoes" — kartṛ is the affected
        if "gets" in [w.lower() for w in effect_words] or "get" in [w.lower() for w in effect_words]:
            kartr_text = " ".join(effect_words[: effect_words.lower().index("gets") if False else 0]) or effect
        kartr_text = effect_words[0] if len(effect_words) == 1 else effect
    # Prefer a clean "it falls" style kartṛ/kriyā when the effect is "it VERB" / "VERB"
    em = re.match(r"^(it|they|he|she)\s+([a-z]+(?:\s+\S+)*)$", effect, re.I)
    if em:
        kartr_text, effect_head = em.group(1), _stem_verb(em.group(2).split()[0])
        kriya = effect_head
        pred = None
        karma = None
    else:
        # "wet ground" / "muddy shoes" / "the ground gets wet"
        gm = re.match(r"^(.+?)\s+(gets?|becomes?|turns?)\s+(.+)$", effect, re.I)
        if gm:
            kartr_text, kriya, pred = gm.group(1), "be", {"text": gm.group(3), "head": _norm(gm.group(3)).split()[-1], "type": "adj"}
            karma = None
        else:
            kriya, pred, karma = "be", {"text": effect, "head": _norm(effect).split()[-1] if effect else "effect", "type": "np"}, None
            kartr_text = cause or "it"
    frame_out: dict[str, Any] = {
        "kriya": kriya if "kriya" in dir() else effect_head,
        "polarity": "pos",
        "kartr": {"text": kartr_text, "head": _norm(kartr_text).split()[-1] if kartr_text else "it"},
        "complete": True,
        "causal": True,
    }
    # rebuild cleanly
    if em:
        frame_out = {
            "kriya": _stem_verb(em.group(2).split()[0]),
            "polarity": "pos",
            "kartr": {"text": em.group(1), "head": em.group(1).lower()},
            "complete": True,
            "causal": True,
        }
    elif re.match(r"^(.+?)\s+(gets?|becomes?|turns?)\s+(.+)$", effect, re.I):
        gm = re.match(r"^(.+?)\s+(gets?|becomes?|turns?)\s+(.+)$", effect, re.I)
        assert gm
        frame_out = {
            "kriya": "be",
            "polarity": "pos",
            "kartr": {"text": gm.group(1), "head": _norm(gm.group(1)).split()[-1]},
            "pred": {"text": gm.group(3), "head": _norm(gm.group(3)).split()[-1], "type": "adj"},
            "complete": True,
            "causal": True,
        }
    else:
        # bare effect noun phrase ("muddy shoes", "wet ground") — copula reading
        frame_out = {
            "kriya": "be",
            "polarity": "pos",
            "kartr": {"text": effect, "head": _norm(effect).split()[-1] if effect else "effect"},
            "pred": {"text": effect, "head": _norm(effect).split()[-1] if effect else "effect", "type": "np"},
            "complete": True,
            "causal": True,
        }
    return {
        "text": frame["text"],
        "atom": atom,
        "parsed": True,
        "frame": frame_out,
        "causal_frame": dict(frame),
        "atom_source": "causal_clause",
    }


def intervention_of(question: str) -> dict[str, Any] | None:
    """Parse 'What happens if …?' into an intervention record."""
    q = re.sub(r"\s+", " ", str(question or "").strip())
    m = _HAPPENS_IF.match(q) or _IF_WHAT_HAPPENS.match(q)
    if not m:
        return None
    raw = m.group(1).strip().rstrip(" .")
    bits = {"action": "", "object": "", "locus": "", "phrase": raw, "raw": raw}
    mpush = _PUSH_IT.match(raw)
    if mpush:
        bits["action"] = _stem_verb(mpush.group(1))
        obj = (mpush.group(2) or "").strip()
        loc_m = re.search(r"\b(on|at|under|in|from|off)\s+(.+)$", obj, re.I)
        if loc_m:
            bits["locus"] = (loc_m.group(1) + " " + loc_m.group(2)).strip()
            bits["object"] = obj[: loc_m.start()].strip()
        else:
            bits["object"] = obj
        return bits
    # "it rains" / "rain falls" / bare event
    sm = _SIMPLE_EVENT.match(raw)
    if sm:
        bits["action"] = _stem_verb(sm.group(1))
        bits["object"] = (sm.group(2) or "").strip()
        # "it rains" → treat action as rain for cause matching
        if bits["action"] in ("rain", "rains", "snow", "snows") or (
            bits["object"] == "" and _stem_verb(sm.group(1)) in ("rain", "snow")
        ):
            bits["action"] = _stem_verb(sm.group(1))
            bits["event"] = bits["action"]
        elif sm.group(1).lower() == "it" and sm.group(2):
            # "it rains"
            bits["action"] = _stem_verb(sm.group(2).split()[0])
            bits["event"] = bits["action"]
            bits["object"] = ""
        return bits
    return bits


def _locus_of_state(fact: dict[str, Any]) -> str:
    atom = fact.get("atom") or {}
    if atom.get("predicate") == "is" and len(atom.get("args") or []) >= 2:
        pred = str(atom["args"][1])
        if re.match(r"^(on|at|under|in|from|off)\b", pred, re.I):
            return _norm(pred)
    return ""


def _subject_of_state(fact: dict[str, Any]) -> str:
    atom = fact.get("atom") or {}
    args = atom.get("args") or []
    if args:
        return str(args[0])
    return str(fact.get("text") or "")


def _frames_from_world(world: dict[str, Any] | None) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """(causal_frame, fact_row) for every admitted non-quarantined fact that is causal."""
    out: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for fact in (world or {}).get("facts") or []:
        if not isinstance(fact, dict):
            continue
        if fact.get("status") and fact.get("status") != "admitted":
            continue
        if fact.get("quarantined") or fact.get("self_fact"):
            continue
        cf = fact.get("causal_frame") if isinstance(fact.get("causal_frame"), dict) else None
        if cf is None:
            cf = parse_clause(str(fact.get("text") or ""))
        if cf:
            out.append((cf, fact))
    return out


def _states_from_world(world: dict[str, Any] | None) -> list[dict[str, Any]]:
    out = []
    for fact in (world or {}).get("facts") or []:
        if not isinstance(fact, dict) or fact.get("quarantined") or fact.get("self_fact"):
            continue
        if fact.get("status") and fact.get("status") != "admitted":
            continue
        if fact.get("causal_frame") or (fact.get("atom") or {}).get("predicate") in ("causes", "makes", "if_then"):
            continue
        out.append(fact)
    return out


def _object_matches(frame_obj: str, state_subj: str) -> bool:
    """General kind match: 'an object' / 'object' / 'something' covers any concrete subject; else head equality."""
    fo, ss = _norm(frame_obj), _norm(state_subj)
    if not fo or fo in ("it", "them", "something", "object", "an object", "a thing", "thing"):
        return bool(ss)
    if not ss:
        return False
    if fo == ss or fo in ss or ss in fo:
        return True
    # head noun: "an object on …" already stripped; "bottle" vs "object"
    fo_h = fo.split()[-1]
    ss_h = ss.split()[-1]
    if fo_h in ("object", "thing", "item") or ss_h in ("object", "thing", "item"):
        return True
    return fo_h == ss_h


def _locus_matches(frame_locus: str, state_locus: str) -> bool:
    fl, sl = _norm(frame_locus), _norm(state_locus)
    if not fl:
        return True
    if not sl:
        return False
    if fl == sl or fl in sl or sl in fl:
        return True
    # edge-of-table paraphrases
    def edge_bits(t: str) -> set[str]:
        return {w for w in re.findall(r"[a-z]+", t) if w not in {"the", "a", "an", "of"}}
    return edge_bits(fl) <= edge_bits(sl) or edge_bits(sl) <= edge_bits(fl)


def _event_matches(cause: str, intervention: dict[str, Any], states: list[dict[str, Any]]) -> bool:
    """Whether a causes/if_then antecedent is active under the intervention + state."""
    c = _norm(cause)
    if not c:
        return False
    event = _norm(intervention.get("event") or intervention.get("action") or "")
    phrase = _norm(intervention.get("phrase") or intervention.get("raw") or "")
    if event and (event == c or event in c or c in event or c.startswith(event) or event.startswith(c)):
        return True
    if phrase and (phrase == c or c in phrase or phrase in c):
        return True
    # state text / subject equals cause ("rain" with state "it is raining" etc.)
    for st in states:
        subj = _norm(_subject_of_state(st))
        text = _norm(st.get("text") or "")
        if c == subj or c in text or subj == c:
            return True
    # "it rains" vs cause "rain" / "Rain"
    if event and _stem_verb(c.split()[0]) == event:
        return True
    return False


def _render_effect(effect: str, subject: str | None = None) -> str:
    e = str(effect or "").strip().rstrip(".")
    if not e:
        return ""
    # Bind pronoun to the state subject when we have one
    if subject and re.match(r"^it\b", e, re.I):
        subj = subject[0].upper() + subject[1:] if subject else subject
        e = re.sub(r"^it\b", subj, e, count=1, flags=re.I)
    if e[0].islower():
        e = e[0].upper() + e[1:]
    return e + ("." if not e.endswith(".") else "")


def _effect_atom_and_frame(effect_text: str, subject: str | None) -> tuple[dict[str, Any], dict[str, Any]]:
    spoken = _render_effect(effect_text, subject)
    body = spoken.rstrip(".")
    em = re.match(r"^(.+?)\s+([a-z]+(?:s|ed|ing)?)$", body, re.I)
    if em and len(body.split()) <= 4:
        kartr, verb = em.group(1), _stem_verb(em.group(2))
        atom = {"predicate": verb, "args": [kartr], "polarity": "pos"}
        frame = {
            "kriya": verb,
            "polarity": "pos",
            "kartr": {"text": kartr, "head": _norm(kartr).split()[-1]},
            "complete": True,
            "causal": True,
        }
        return atom, frame
    gm = re.match(r"^(.+?)\s+(gets?|becomes?|turns?|is)\s+(.+)$", body, re.I)
    if gm:
        kartr, pred = gm.group(1), gm.group(3)
        atom = {"predicate": "is", "args": [kartr, pred], "polarity": "pos"}
        frame = {
            "kriya": "be",
            "polarity": "pos",
            "kartr": {"text": kartr, "head": _norm(kartr).split()[-1]},
            "pred": {"text": pred, "head": _norm(pred).split()[-1], "type": "np"},
            "complete": True,
            "causal": True,
        }
        return atom, frame
    atom = {"predicate": "holds", "args": [body], "polarity": "pos"}
    frame = {
        "kriya": "happen",
        "polarity": "pos",
        "kartr": {"text": "it", "head": "it"},
        "pred": {"text": body, "head": _norm(body).split()[-1] if body else "effect", "type": "np", "indef": False},
        "complete": True,
        "causal": True,
    }
    return atom, frame


def _solver_step(world: dict[str, Any] | None, intervention: dict[str, Any]) -> dict[str, Any] | None:
    """4.9.244 (plan 229 step 12b): a Simulation Router receipt for exactly this intervention is a measured causal
    fact: the solver stepped the compiled scene and the receipt states the outcome. It is used only when its
    intervention key equals this question's (same scene); it is a premise for this turn, never stored as a fact."""
    from rmc_engine_v1.sim_scene import intervention_key

    key = intervention_key(intervention.get("raw") or "")
    struct = None
    try:
        from rmc_engine_v1 import question_frame
        from rmc_engine_v1.sim_karaka import karaka_key, read as karaka_read
        fr = question_frame.current()
        if isinstance(fr, dict):
            struct = karaka_key(karaka_read(str(fr.get("text") or ""), fr))
    except Exception:
        struct = None
    for fact in (world or {}).get("facts") or []:
        if not isinstance(fact, dict) or fact.get("source") != "sim_receipt" or fact.get("quarantined"):
            continue
        sim = fact.get("sim") if isinstance(fact.get("sim"), dict) else {}
        ik = sim.get("intervention_key")
        if not sim.get("effect_text"):
            continue
        if not ik or (ik != key and ik != struct and sim.get("legacy_key") not in (key, struct)):
            continue
        atoms = [a for a in (sim.get("spoken_atoms") or []) if isinstance(a, dict) and a.get("atom") and a.get("text")]
        if atoms:
            spoken = " ".join(str(a.get("text") or "").strip() for a in atoms).strip()
        else:
            # No structured atoms on this receipt. Keep its effect sentence; do not split it back into an atom.
            spoken = str(sim.get("effect_text") or "").strip()
            spoken = spoken if not spoken or spoken.endswith(".") else spoken + "."
            why = str(sim.get("causal_reason") or "").strip()
            if why:
                why = why if why.endswith(".") else why + "."
                if why.lower() not in spoken.lower():
                    spoken = (spoken + " " + why).strip()
        head = next((a for a in atoms if a.get("role") == "effect"), atoms[0] if atoms else None)
        atom = (head or {}).get("atom") or {"predicate": "holds", "args": [spoken], "polarity": "pos"}
        args = [str(x) for x in (atom.get("args") or [])]
        eframe = {"kriya": str(atom.get("predicate") or "happen"), "polarity": atom.get("polarity") or "pos",
                  "kartr": {"text": args[0] if args else "it", "head": _norm(args[0] if args else "it").split()[-1] if args else "it"},
                  "complete": True, "causal": True}
        step = {"n": 1, "rule_id": "WM-SOLVER-RECEIPT", "why": "solver receipt for this scene",
                "cause": intervention.get("raw"), "effect": spoken, "spoken": spoken, "frame": fact.get("causal_frame"),
                "atom": atom, "spoken_atoms": atoms,
                "premises": [fact.get("id")], "solver": sim.get("solver"), "engine": sim.get("engine"),
                "receipt_id": sim.get("receipt_id"), "sha256": sim.get("sha256"), "measurements": sim.get("measurements"),
                "state_before": sim.get("state_before"), "state_after": sim.get("state_after")}
        solved = {
            "status": "supported_only", "reason": "solver_receipt", "chain": [step],
            "prediction": {"text": spoken, "atom": atom, "fact_frame": eframe, "premises": [fact],
                           "how": "WM-SOLVER-RECEIPT", "kind": "causal_prediction", "schema": HOOK_SCHEMA,
                           "spoken_atoms": atoms,
                           "receipt": {k: sim.get(k) for k in ("receipt_id", "sha256", "solver", "engine", "measurements", "outcome")},
                           "state_before": sim.get("state_before"), "state_after": sim.get("state_after"),
                           "may_store_as_fact": False},
            "depth": 1, "rules_fired": ["WM-SOLVER-RECEIPT"], "intervention": intervention, "frames_considered": 1,
        }
        return _spill_from_hold(world, solved, sim)
    return None


def _spill_from_hold(world: dict[str, Any] | None, solved: dict[str, Any], sim: dict[str, Any]) -> dict[str, Any]:
    """A container that topples no longer holds what it held. General over hold/contain, not one noun."""
    if str(sim.get("outcome") or "") != "topple":
        return solved
    patient = _norm(str(sim.get("patient") or ""))
    if not patient:
        return solved
    for fact in _states_from_world(world):
        atom = fact.get("atom") or {}
        if atom.get("predicate") not in ("hold", "contain"):
            continue
        args = [str(a) for a in (atom.get("args") or [])]
        if len(args) < 2:
            continue
        holder = _norm(args[0])
        if patient != holder and patient != holder.split()[-1] and holder.split()[-1] != patient:
            continue
        content = args[1].strip()
        content_np = content if content.lower().startswith(("the ", "a ", "an ")) else "the " + content
        holder_np = args[0].strip()
        low = holder_np.lower()
        if low.startswith("an "):
            holder_np = "the " + holder_np[3:]
        elif low.startswith("a "):
            holder_np = "the " + holder_np[2:]
        elif not low.startswith("the "):
            holder_np = "the " + holder_np
        spill = f"{holder_np[:1].upper()}{holder_np[1:]} spills {content_np}."
        spill_atom = {"predicate": "spill", "args": [holder_np, content_np], "polarity": "pos", "tense": "present"}
        pred = solved["prediction"]
        carried = [a for a in (pred.get("spoken_atoms") or []) if isinstance(a, dict)]
        if not carried and pred.get("text"):
            carried = [{"text": str(pred.get("text")), "atom": None, "verbatim": True, "role": "effect"}]
        if not any(str(a.get("text") or "").lower() == spill.lower() for a in carried):
            carried.append({"text": spill, "atom": spill_atom, "role": "consequence", "verbatim": False,
                            "state_before": sim.get("state_before"),
                            "state_after": dict(sim.get("state_after") or {}, spilled=content_np)})
        pred["spoken_atoms"] = carried
        pred["text"] = " ".join(str(a.get("text") or "").strip() for a in carried).strip()
        step = {"n": len(solved["chain"]) + 1, "rule_id": "WM-CONTAIN-SPILL",
                "why": "a container that topples spills what it holds",
                "cause": sim.get("outcome"), "effect": spill, "spoken": spill, "atom": spill_atom,
                "premises": [fact.get("id")], "patient": patient}
        solved["chain"].append(step)
        solved["rules_fired"] = list(solved.get("rules_fired") or []) + ["WM-CONTAIN-SPILL"]
        solved["depth"] = len(solved["chain"])
        # The hold fact is the chain's second premise, not a solver-receipt premise: the receipt checker
        # requires every WM-SOLVER-RECEIPT premise to carry the receipt sha256. It is grounded beside the
        # proof so the spill sentence is measured against the hold, not copied into the receipt step.
        ground = {k: fact.get(k) for k in ("id", "text", "atom", "source")}
        ground["ground_forms"] = [spill]
        pred.setdefault("ground_premises", []).append(ground)
        pred["may_store_as_fact"] = False
        break
    return solved


def forward_chain(
    world: dict[str, Any] | None,
    intervention: dict[str, Any],
    *,
    max_depth: int = MAX_SIM_DEPTH,
) -> dict[str, Any]:
    """Bounded Simulate: apply stored/admitted causal frames under the intervention; report the chain."""
    solved = _solver_step(world, intervention)
    if solved is not None:
        return solved
    frames = _frames_from_world(world)
    states = _states_from_world(world)
    if not frames:
        return {
            "status": "undetermined",
            "reason": "no_causal_frame",
            "chain": [],
            "prediction": None,
            "depth": 0,
            "rules_fired": [],
        }
    # Seed held events from the intervention
    held: list[str] = []
    if intervention.get("event"):
        held.append(_norm(intervention["event"]))
    if intervention.get("action"):
        held.append(_norm(intervention["action"]))
    if intervention.get("raw"):
        held.append(_norm(intervention["raw"]))

    chain: list[dict[str, Any]] = []
    fired: list[str] = []
    last_spoken = None
    last_atom = None
    last_frame = None
    last_premises: list[dict[str, Any]] = []
    all_premises: list[dict[str, Any]] = []
    subject = None
    # Prefer a state subject whose locus matches a makes-frame locus, else first state subject
    for cf, _fact in frames:
        if cf.get("kind") == "makes" and cf.get("locus"):
            for st in states:
                if _locus_matches(str(cf.get("locus") or ""), _locus_of_state(st)) and _object_matches(
                    str(cf.get("object") or "object"), _subject_of_state(st)
                ):
                    subject = _subject_of_state(st)
                    break
        if subject:
            break
    if subject is None and states:
        subject = _subject_of_state(states[0])

    depth = 0
    while depth < max_depth and len(chain) < MAX_SIM_STEPS:
        depth += 1
        progress = False
        for cf, fact in frames:
            kind = cf.get("kind")
            rule_id = str(cf.get("rule_id") or "")
            effect = str(cf.get("effect") or cf.get("consequent") or "").strip()
            if not effect:
                continue
            effect_key = _norm(effect)
            if any(_norm(step.get("effect")) == effect_key for step in chain):
                continue
            ok = False
            why = ""
            if kind == "makes":
                act = _norm(cf.get("action") or "")
                inter_act = _norm(intervention.get("action") or "")
                if act and inter_act and (act == inter_act or act.startswith(inter_act) or inter_act.startswith(act)):
                    # find unifying state
                    matched_state = None
                    for st in states:
                        if _object_matches(str(cf.get("object") or "object"), _subject_of_state(st)) and _locus_matches(
                            str(cf.get("locus") or ""), _locus_of_state(st)
                        ):
                            matched_state = st
                            break
                    # Also allow intervention object "it" to bind the matched/locus state
                    if matched_state is None and _norm(intervention.get("object") or "") in ("", "it", "them"):
                        for st in states:
                            if _locus_matches(str(cf.get("locus") or ""), _locus_of_state(st)):
                                matched_state = st
                                break
                    if matched_state is not None:
                        ok = True
                        why = "makes+state+intervention"
                        subject = _subject_of_state(matched_state)
                        last_premises = [fact, matched_state]
                        rule_id = rule_id or "WM-MAKES-APPLY"
            elif kind == "causes":
                if _event_matches(str(cf.get("cause") or ""), intervention, states) or _norm(cf.get("cause")) in held:
                    ok = True
                    why = "causes+intervention_or_held"
                    last_premises = [fact]
                    rule_id = rule_id or "WM-CAUSES-APPLY"
            elif kind == "if_then":
                ant = str(cf.get("antecedent") or cf.get("cause") or "")
                # if_then with an action (push…) unifies like makes when a matching state exists
                if cf.get("action") and _norm(cf.get("action")) == _norm(intervention.get("action") or ""):
                    matched_state = None
                    for st in states:
                        if _locus_matches(str(cf.get("locus") or ""), _locus_of_state(st)) and _object_matches(
                            str(cf.get("object") or "object"), _subject_of_state(st)
                        ):
                            matched_state = st
                            break
                    if matched_state is None and not cf.get("locus"):
                        # pure if_then on the intervention alone ("if it rains, …")
                        if _event_matches(ant, intervention, states):
                            ok = True
                            why = "if_then+intervention"
                            last_premises = [fact]
                    elif matched_state is not None:
                        ok = True
                        why = "if_then+state+intervention"
                        subject = _subject_of_state(matched_state)
                        last_premises = [fact, matched_state]
                    rule_id = rule_id or "WM-IF-THEN-APPLY"
                elif _event_matches(ant, intervention, states) or _norm(ant) in held:
                    ok = True
                    why = "if_then+held"
                    last_premises = [fact]
                    rule_id = rule_id or "WM-IF-THEN-APPLY"
            if not ok:
                continue
            spoken = _render_effect(effect, subject)
            atom, eframe = _effect_atom_and_frame(effect, subject)
            step = {
                "n": len(chain) + 1,
                "rule_id": rule_id,
                "why": why,
                "cause": cf.get("cause") or cf.get("antecedent"),
                "effect": effect,
                "spoken": spoken,
                "frame": cf,
                "premises": [p.get("id") for p in last_premises if isinstance(p, dict)],
            }
            chain.append(step)
            fired.append(rule_id)
            for prem in last_premises:
                if isinstance(prem, dict) and prem not in all_premises:
                    all_premises.append(prem)
            held.append(effect_key)
            # Also hold stem of effect for chaining ("wet ground" ↔ causes wet ground)
            held.append(_norm(spoken))
            for w in re.findall(r"[a-z]+", effect_key):
                if len(w) > 3:
                    held.append(w)
            last_spoken, last_atom, last_frame = spoken, atom, eframe
            progress = True
            break
        if not progress:
            break

    if not chain:
        return {
            "status": "undetermined",
            "reason": "no_unifying_causal_frame",
            "chain": [],
            "prediction": None,
            "depth": depth,
            "rules_fired": [],
            "intervention": intervention,
            "frames_considered": len(frames),
        }
    return {
        "status": "supported_only",
        "reason": "forward_chain",
        "chain": chain,
        "prediction": {
            "text": last_spoken,
            "atom": last_atom,
            "fact_frame": last_frame,
            "premises": all_premises or last_premises,
            "how": fired[-1] if fired else "WM-SIMULATE",
            "kind": "causal_prediction",
            "schema": HOOK_SCHEMA,
        },
        "depth": len(chain),
        "rules_fired": fired,
        "intervention": intervention,
        "frames_considered": len(frames),
    }


def predict(
    question: str,
    world: dict[str, Any] | None = None,
    rules: tuple[CausalRule, ...] | list | None = None,
) -> dict[str, Any]:
    """Cause-and-effect hook. Runs bounded Simulate when the question is a happens-if; never stores a fact."""
    pool = RULES if rules is None else tuple(rules)
    intervention = intervention_of(question)
    if intervention is None:
        return {
            "schema": HOOK_SCHEMA,
            "operation": "CauseEffect",
            "status": "not_applicable",
            "rule": "CAUSE-EFFECT-NOT-HAPPENS-IF",
            "question": str(question or ""),
            "world_root": (world or {}).get("root") if isinstance(world, dict) else None,
            "rules_loaded": len(pool),
            "prediction": None,
            "admit": False,
            "store_as_fact": False,
            "writes": False,
            "calls_llm": False,
            "note": "question is not a what-happens-if; Simulate stays idle",
        }
    sim = forward_chain(world, intervention)
    pred = sim.get("prediction")
    return {
        "schema": HOOK_SCHEMA,
        "operation": "CauseEffect",
        "status": sim.get("status") or "undetermined",
        "rule": (pred or {}).get("how") if pred else "CAUSE-EFFECT-UNDETERMINED",
        "question": str(question or ""),
        "world_root": (world or {}).get("root") if isinstance(world, dict) else None,
        "rules_loaded": len(pool),
        "rules_valid": all(validate_rule(r)["ok"] for r in pool),
        "intervention": intervention,
        "simulate": {k: sim[k] for k in ("status", "reason", "chain", "depth", "rules_fired", "frames_considered") if k in sim},
        "prediction": pred,
        "admit": bool(pred),  # still admit-gated by Echo/C in rmc_core
        "store_as_fact": False,
        "writes": False,
        "calls_llm": False,
        "note": "predictions are never stored as facts",
    }


def is_prediction(row: dict[str, Any] | None) -> bool:
    if not isinstance(row, dict):
        return False
    prov = row.get("provenance") if isinstance(row.get("provenance"), dict) else {}
    return (
        row.get("schema") == HOOK_SCHEMA
        or prov.get("schema") == HOOK_SCHEMA
        or row.get("operation") == "CauseEffect"
        or prov.get("kind") == "causal_prediction"
        or row.get("kind") == "causal_prediction"
    )


def may_store_as_fact(row: dict[str, Any] | None) -> bool:
    """A prediction is never a fact. Everything else is decided by the ordinary gates, not here."""
    return not is_prediction(row)
