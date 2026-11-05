"""4.9.233 (plan 229 step 5): Derive matches a fact to the question by frame AND by phase/band alignment.

Frame. The phone's question frame (forge.qframe/v1, via question_frame.current()) names the kriyā, the known roles
and the gap (the indefinite pro-form "something"/"someone"). A fact's frame is its clause frame (4.9.232), the roles of
a clause that did not cover every word (role_frame), or the two arguments of an is() atom. A fact answers only when
the kriyā is the same, every known role of the question unifies with the fact's role (same head, the question's words
inside the fact's phrase, the same owner), and the gap role is filled. Copula: "What is X?" reads X as the fact's kartṛ;
a definite X ("the capital of France") may also be the fact's predicate (a specificational copula). A polar question
needs both roles. One relational-noun rule, WM-NAME-OF: "X's name" is the proper-noun predicate of a copula fact on X.

Alignment. The fact's placement (place_row: Φ, ε, μ, band, Hz) against each phase on the question's phase path:
resonance grace rpm·cos²δ with δ ≤ π/4 (resonance_recall._grace), the band relation same/x3/x9/none
(band_tuning.relation), and the 4.9.204 frequency attraction between the fact's Hz and the question's tuned Hz
(frequency_204.attract_dh). A frame match that is not phase-aligned does not answer. Word coverage is only a logged
tie-break. Nothing here calls a model.

4.9.236 — Memory Phase Invariance with Contextual Phase Alignment (Nic). A memory keeps its native content phase
Φ_identity; nothing here rewrites it. Φ_query is the phase of the cognitive operation (retrieval of a stored memory is
Φ7, codex "Naming: identity, aligned declaration"), not of the question's text. ΔΦ = Φ_query − Φ_identity is computed
per ask and never stored. A match answers by G = f(ΔΦ, S, C): S = the frame match (semantic), C = contextual coherence
(replayed proof, debate, no conflict, no quarantine, possessor scope). ΔΦ is one factor, A = (1 + cos ΔΦ)/2, that ranks
and weights; it never vetoes, and it can never create a match: G = 0 whenever S or C fails.
"""
from __future__ import annotations

import math
import re
from typing import Any

RULE_NAME_OF = "WM-NAME-OF"
RULE_OWNER_OF = "WM-OWNER-OF"
# 4.9.236: the phase of each cognitive operation Derive performs. Only one operation runs here: retrieval of stored
# memory (direct facts, the premises a chain is built from, a relational rule over a stored fact). Nic: Φ7 for retrieval.
OPERATION_PHASE = {"retrieve": 7}
PHASE_STEP_DEG = 40.0  # nine phases on the circle
# a first-person memory is the asker's only when it came from the asker's device (personal facts stay on the device)
PERSONAL_SOURCES = frozenset({"phone_kb"})
_FIRST_PERSON = re.compile(r"(?i)\b(i|me|my|mine|myself|our|ours|we|us)\b")
_POSSESSIVE = re.compile(r"(?i)^\s*(my|our|([A-Z][A-Za-z'\-]*)'s)\s+(.+)$")
_DETS = {"the", "a", "an", "some", "this", "that", "these", "those"}
_STOP = {"of", "is", "are", "was", "were", "be", "and", "or", "to", "in", "on", "at", "for", "with", "by", "my", "your",
         "his", "her", "its", "their", "our", "'s", "s"}


def _sing(word: str) -> str:
    w = str(word or "").lower().strip("'")
    if w.endswith("'s"):
        w = w[:-2]
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss") and not w.endswith("us"):
        return w[:-1]
    return w


def _words(text: str) -> set[str]:
    return {_sing(w) for w in re.findall(r"[A-Za-z][A-Za-z'\-]*", str(text or "")) if w.lower() not in _DETS and w.lower() not in _STOP}


def _head(np: dict[str, Any]) -> str:
    head = np.get("head") or np.get("propn")
    if not head:
        ws = [w for w in re.findall(r"[A-Za-z][A-Za-z'\-]*", str(np.get("text") or "")) if w.lower() not in _DETS]
        head = ws[-1] if ws else ""
    return _sing(str(head))


def _owner_user(np: dict[str, Any]) -> bool:
    owner = np.get("owner")
    return owner == "user" or bool(np.get("user")) or bool(re.match(r"(?i)\s*(my|i)\b", str(np.get("text") or "")))


def is_gap(np: Any) -> bool:
    return isinstance(np, dict) and bool(np.get("indef"))


def np_unify(q: Any, f: Any) -> bool:
    """A known question role and a fact role name the same thing."""
    if not isinstance(q, dict) or not isinstance(f, dict) or not str(f.get("text") or "").strip():
        return False
    if _owner_user(q) != _owner_user(f):
        return False
    # 4.9.240: the genitive of-phrase is the possessive ("the name of my dog" = "my dog's name"): one possessor slot
    qo, fo = genitive(q), genitive(f)
    if isinstance(qo, dict) and not (isinstance(fo, dict) and np_unify(qo, fo)):
        return False
    if _head(q) != _head(f):
        return False
    qw, fw = _words(q.get("text")), _words(f.get("text"))
    for sub in ("of", "owner"):
        if isinstance(f.get(sub), dict):
            fw |= _words(f[sub].get("text"))
    return qw <= fw


def genitive(np: Any) -> dict[str, Any] | None:
    """4.9.240: the possessor of a noun phrase, whether written as a possessive ("my dog's name": owner) or as a genitive
    of-phrase ("the name of my dog": of). English grammar, not a list: both name the same possessor slot."""
    if not isinstance(np, dict):
        return None
    if isinstance(np.get("owner"), dict):
        return np["owner"]
    if isinstance(np.get("of"), dict):
        return np["of"]
    return None


_DEFINITE = frozenset({"the", "this", "that", "these", "those", "my", "your", "his", "her", "its", "our", "their"})


def referring(np: Any) -> bool:
    """4.9.240: a noun phrase that names one particular thing: a proper name, a possessive, a definite determiner, the
    speaker or the kernel. An indefinite ("a whale"), a bare plural ("whales") or a bare mass noun names a kind or a
    member of one, not a particular."""
    if not isinstance(np, dict) or not str(np.get("text") or "").strip():
        return False
    if np.get("propn") or np.get("user") or np.get("kernel") or np.get("owner"):
        return True
    return str(np.get("det") or "").lower() in _DEFINITE


def identity(a: Any, b: Any) -> bool:
    """4.9.240: a copula between two referring phrases ("Rex is my dog") states identity, which runs both ways. A copula
    whose predicate (or subject) names a kind or a member of one ("a whale is a living thing") states membership or
    inclusion, which does not: "a living thing is a whale" does not follow."""
    return referring(a) and referring(b)


def _specific(np: dict[str, Any]) -> bool:
    return str(np.get("det") or "").lower() == "the" or isinstance(np.get("of"), dict) or isinstance(np.get("owner"), dict)


def _atom_np(text: str) -> dict[str, Any]:
    t = str(text or "").strip()
    first = t.split()[0].lower() if t.split() else ""
    out = {"text": t, "det": first if first in _DETS else None}
    m = re.match(r"(?i)(.+?)\s+of\s+(.+)$", t)
    if m:
        ws = [w for w in m.group(1).split() if w.lower() not in _DETS]
        out["head"] = ws[-1] if ws else None
        out["of"] = {"text": m.group(2)}
    if t[:1].isupper() and first not in _DETS and len(t.split()) <= 3:
        out["propn"] = t
    return out


# 4.9.238 (Nic): "look" is a linking verb when an attribute is asked ("the sky looks blue" states the sky's colour as it
# appears). It links its subject to a bare complement (no determiner, no owner, not a name), which the phone grammar reads
# as its karma. Only an attribute question may read it as the copula; "What is the sky?" is not answered by how it looks.
LINKING_VERBS = frozenset({"look"})


def _value_rule(kind: Any) -> dict[str, Any] | None:
    """The lexicon's value rule for an attribute noun (concept_lexicon.json values: "a colour word is a value of colour")."""
    from rmc_engine_v1.echo_question import _lex
    lex = _lex()
    cid = (lex.get("surfaces") or {}).get(_sing(str(kind or "")))
    rule = (lex.get("values") or {}).get(cid or "")
    return rule if isinstance(rule, dict) else None


def is_value_of(kind: Any, np: Any) -> bool:
    """The filler is a value of the asked attribute by the lexicon (blue is a colour); never by the question's words."""
    rule = _value_rule(kind)
    if not rule or not isinstance(np, dict) or not str(np.get("text") or "").strip():
        return False
    from rmc_engine_v1.echo_question import _fills_slot
    return bool(_fills_slot(rule, str(np.get("text"))))


def _bare(np: Any) -> bool:
    if not isinstance(np, dict) or not str(np.get("text") or "").strip():
        return False
    first = str(np["text"]).split()[0].lower()
    return first not in _DETS and not np.get("owner") and not np.get("propn") and not np.get("det")


def _complement(fframe: dict[str, Any]) -> dict[str, Any] | None:
    """The subject complement of a copula or linking-verb fact: its predicate, or a linking verb's bare karma."""
    fk = str(fframe.get("kriya") or "").lower()
    if isinstance(fframe.get("pred"), dict) and str(fframe["pred"].get("text") or "").strip():
        return fframe["pred"]
    if fk in LINKING_VERBS and _bare(fframe.get("karma")):
        return fframe["karma"]
    return None


def attribute_of(qframe: dict[str, Any], fframe: dict[str, Any]) -> dict[str, Any] | None:
    """An attribute question over a copula or linking-verb fact. "What color is X?" (gap pred of kind K) and "What is the K
    of X?" (kartṛ "the K of X", gap pred) are answered by a fact "X is/looks V" whose complement V is a value of K by the
    lexicon. X must unify with the fact's kartṛ. A kind with no value rule (breed) is not an attribute here."""
    if (fframe.get("polarity") or "pos") != "pos":
        return None
    qs, qp = qframe.get("kartr"), qframe.get("pred")
    fs = fframe.get("kartr")
    comp = _complement(fframe)
    if not (is_gap(qp) and isinstance(qs, dict) and not is_gap(qs) and comp is not None):
        return None
    linking = str(fframe.get("kriya") or "").lower() in LINKING_VERBS
    if qp.get("kind") and np_unify(qs, fs) and is_value_of(qp["kind"], comp):
        return {"roles": 1, "gap": "pred", "filler": comp.get("text"), "orientation": "kartr=kartr", "rule": "attribute_kind",
                "kind": str(qp["kind"]), "linking": linking}
    of = genitive(qs)  # 4.9.240: "the colour of the sky" and "the sky's colour" name the same possessor
    if of and _specific(qs) and np_unify(of, fs) and is_value_of(_head(qs), comp):
        return {"roles": 1, "gap": "pred", "filler": comp.get("text"), "orientation": "of=kartr", "rule": "attribute_of",
                "kind": _head(qs), "linking": linking}
    return None


def fact_frame(fact: dict[str, Any]) -> tuple[dict[str, Any] | None, str]:
    """The frame a fact is matched on, and where it came from."""
    if isinstance(fact.get("frame"), dict) and fact["frame"].get("kartr"):
        return fact["frame"], "clause"
    if isinstance(fact.get("role_frame"), dict) and fact["role_frame"].get("kartr"):
        return fact["role_frame"], "clause_roles"
    atom = fact.get("atom") or {}
    args = atom.get("args") or []
    if atom.get("predicate") == "is" and len(args) >= 2:
        return {"kriya": "be", "polarity": atom.get("polarity") or "pos", "kartr": _atom_np(args[0]), "pred": _atom_np(args[1])}, "atom"
    if atom.get("predicate") and len(args) >= 2:
        return {"kriya": str(atom["predicate"]), "polarity": atom.get("polarity") or "pos", "kartr": _atom_np(args[0]), "karma": _atom_np(args[1])}, "atom"
    return None, "none"


def chain_frame(first: dict[str, Any], second: dict[str, Any], conclusion: dict[str, Any]) -> dict[str, Any]:
    """A copula-chain conclusion's frame: the first premise's kartṛ and the second premise's predicate."""
    f1, _ = fact_frame(first)
    f2, _ = fact_frame(second)
    args = conclusion.get("args") or ["", ""]
    kartr = (f1 or {}).get("kartr") or _atom_np(args[0])
    pred = (f2 or {}).get("pred") or _atom_np(args[1])
    return {"kriya": "be", "polarity": "pos", "kartr": kartr, "pred": pred, "derived": True}


def match(qframe: dict[str, Any] | None, fframe: dict[str, Any] | None) -> dict[str, Any] | None:
    """Unify the question frame with a fact frame. None when they do not unify."""
    if not isinstance(qframe, dict) or not isinstance(fframe, dict):
        return None
    qk = str(qframe.get("kriya") or "").lower()
    fk = str(fframe.get("kriya") or "").lower()
    if qk in ("own", "have") and fk == "be":
        return owner_of(qframe, fframe)
    if qk == "be" and str(qframe.get("wh_role") or "") == "pred" and (fk == "be" or fk in LINKING_VERBS):
        # 4.9.238: an attribute question is answered by a value of the attribute (lexicon), through "be" or a linking verb
        attr = attribute_of(qframe, fframe)
        if attr:
            return attr
    if not qk or qk != fk:
        return None
    role = str(qframe.get("wh_role") or "")
    qs, qp, qo = qframe.get("kartr"), qframe.get("pred"), qframe.get("karma")
    fs, fp, fo = fframe.get("kartr"), fframe.get("pred"), fframe.get("karma")
    fpol = fframe.get("polarity") or "pos"
    if role == "polarity":
        if qk == "be":
            for a, b, orient in ((fs, fp, "kartr=kartr"), (fp, fs, "kartr=pred")):
                if orient == "kartr=pred" and not identity(fs, fp):
                    continue  # 4.9.240: only an identity runs backwards; kind and membership never do
                if np_unify(qs, a) and np_unify(qp, b):
                    yes = (fpol == (qframe.get("polarity") or "pos"))
                    return {"roles": 2, "gap": None, "filler": "yes" if yes else "no", "orientation": orient, "rule": "polar"}
            return None
        if np_unify(qs, fs) and np_unify(qo, fo):
            return {"roles": 2, "gap": None, "filler": "yes" if fpol == (qframe.get("polarity") or "pos") else "no", "orientation": "kartr,karma", "rule": "polar"}
        return None
    if fpol != "pos":
        return None
    if qk == "be":
        if is_gap(qp) and qp.get("kind") and isinstance(qs, dict) and not is_gap(qs):
            # "what N is X": the filler must itself be shown to be an N (its head is N); a name is not a breed
            if np_unify(qs, fs) and isinstance(fp, dict) and _head(fp) == _sing(str(qp["kind"])):
                return {"roles": 1, "gap": "pred", "filler": fp.get("text"), "orientation": "kartr=kartr", "rule": "copula_kind"}
            return None
        if is_gap(qp) and isinstance(qs, dict) and not is_gap(qs):
            if np_unify(qs, fs) and isinstance(fp, dict):
                return {"roles": 1, "gap": "pred", "filler": fp.get("text"), "orientation": "kartr=kartr", "rule": "copula"}
            if _specific(qs) and np_unify(qs, fp) and isinstance(fs, dict) and identity(fs, fp):
                return {"roles": 1, "gap": "pred", "filler": fs.get("text"), "orientation": "kartr=pred", "rule": "copula_specificational"}
            if _head(qs) == "name" and isinstance(qs.get("owner"), dict) and isinstance(fp, dict) and fp.get("propn") and np_unify(qs["owner"], fs):
                return {"roles": 1, "gap": "pred", "filler": fp.get("text"), "orientation": "owner=kartr", "rule": RULE_NAME_OF}
            return None
        if is_gap(qs) and isinstance(qp, dict) and not is_gap(qp):
            if np_unify(qp, fp) and isinstance(fs, dict):
                return {"roles": 1, "gap": "kartr", "filler": fs.get("text"), "orientation": "pred=pred", "rule": "copula"}
        return None
    if role == "kartr" or is_gap(qs):
        if np_unify(qo, fo) and isinstance(fs, dict):
            return {"roles": 1, "gap": "kartr", "filler": fs.get("text"), "orientation": "karma=karma", "rule": "transitive"}
        return None
    if role == "karma" or is_gap(qo):
        if np_unify(qs, fs) and isinstance(fo, dict):
            return {"roles": 1, "gap": "karma", "filler": fo.get("text"), "orientation": "kartr=kartr", "rule": "transitive"}
    return None


def possessor(np: Any) -> str | None:
    """The owner a possessive noun phrase names: "my dog" → "I", "our dog" → "we", "Nic's dog" → "Nic"."""
    if not isinstance(np, dict):
        return None
    owner = np.get("owner")
    m = _POSSESSIVE.match(str(np.get("text") or ""))
    if owner == "user" or (m and m.group(1).lower() == "my"):
        return "I"
    if m and m.group(1).lower() == "our":
        return "we"
    if isinstance(owner, dict) and str(owner.get("text") or "").strip():
        return str(owner["text"]).strip()
    if m and m.group(2):
        return m.group(2)
    return None


def owner_of(qframe: dict[str, Any], fframe: dict[str, Any]) -> dict[str, Any] | None:
    """WM-OWNER-OF: "who owns/has N?" over an identity copula with a possessive side ("my dog is Rex", "Rex is my dog")
    names the possessor. The other side must unify with N; the possessor is the filler."""
    qs, qo = qframe.get("kartr"), qframe.get("karma")
    if not (is_gap(qs) and isinstance(qo, dict) and not is_gap(qo)) or (fframe.get("polarity") or "pos") != "pos":
        return None
    fs, fp = fframe.get("kartr"), fframe.get("pred")
    for owned, other, orient in ((fs, fp, "karma=pred"), (fp, fs, "karma=kartr")):
        who = possessor(owned)
        # 4.9.240: "whose N is X" carries N as the karma's kind: the possessed side must be an N ("my dog" for "whose dog")
        kind = qo.get("kind") if isinstance(qo, dict) else None
        if kind and _head(owned or {}) != _sing(str(kind)):
            continue
        if who and isinstance(other, dict) and np_unify(qo, other):
            return {"roles": 1, "gap": "kartr", "filler": who, "orientation": orient, "rule": RULE_OWNER_OF,
                    "owned": str(owned.get("text") or ""), "owned_head": _head(owned)}
    return None


def operation(qframe: dict[str, Any] | None) -> str:
    """The cognitive operation Derive performs for a framed question: retrieval of stored memory."""
    return "retrieve"


def phase_factor(phi_identity: Any, phi_query: int) -> dict[str, Any]:
    """ΔΦ between the operation's phase and a memory's native phase, and its weight A = (1 + cos ΔΦ)/2 (relational, never stored)."""
    try:
        pi = int(re.search(r"(\d+)", str(phi_identity)).group(1))
    except Exception:
        return {"phi_identity": None, "delta_phi_deg": None, "A": None}
    steps = abs(pi - int(phi_query)) % 9
    steps = min(steps, 9 - steps)
    delta = steps * PHASE_STEP_DEG
    return {"phi_identity": pi, "delta_phi_deg": delta, "A": round((1.0 + math.cos(math.radians(delta))) / 2.0, 6)}


def _first_person_roles(premise: dict[str, Any]) -> bool:
    """4.9.238: a memory is the asker's own when one of its kāraka roles is first person (I, we, my dog, our house), read from
    its frame (else its atom's arguments). An experiencer adjunct ("the sky looks blue to us") is not a role the memory
    states about the asker, so a source sentence that says "to us" is not made personal by it."""
    frame = premise.get("frame") if isinstance(premise.get("frame"), dict) else None
    if frame is None and isinstance(premise.get("role_frame"), dict):
        frame = premise["role_frame"]
    if frame is not None:
        for key in ("kartr", "karma", "pred"):
            np = frame.get(key)
            if isinstance(np, dict) and (_owner_user(np) or _FIRST_PERSON.search(str(np.get("text") or ""))):
                return True
            if isinstance(np, dict) and isinstance(np.get("owner"), dict) and _owner_user(np["owner"]):
                return True
        return False
    args = ((premise.get("atom") or {}).get("args") or []) if isinstance(premise.get("atom"), dict) else []
    if args and (premise.get("atom") or {}).get("predicate") != "stated":
        return any(_FIRST_PERSON.search(str(a or "")) for a in args)
    return bool(_FIRST_PERSON.search(str(premise.get("text") or "")))


def context_coherence(qframe: dict[str, Any] | None, claim: dict[str, Any], premises: list[dict[str, Any]]) -> dict[str, Any]:
    """C: the match makes sense in this ask's context. Each check is named; C = 1 only when all hold."""
    checks: dict[str, bool] = {
        "proof_replayed": claim.get("checker_ok") is True,
        "debate_survived": (claim.get("debate") or {}).get("survived") is True,
        "not_conflicted": claim.get("status") != "conflicted",
        "not_quarantined": not any(bool(p.get("quarantined")) for p in premises),
    }
    # possessor scope: a first-person memory speaks for the asker only when it lives on the asker's device
    asks_user = any(_owner_user(r) or (isinstance(r, dict) and isinstance(r.get("owner"), dict) and _owner_user(r["owner"]))
                    for r in ((qframe or {}).get("kartr"), (qframe or {}).get("karma"), (qframe or {}).get("pred")) if isinstance(r, dict))
    first = [p for p in premises if _first_person_roles(p)]
    checks["possessor_scope"] = all(str(p.get("source") or "") in PERSONAL_SOURCES for p in first)
    failed = [k for k, v in checks.items() if not v]
    return {"C": 0.0 if failed else 1.0, "checks": checks, "failed": failed}


def gate(qframe: dict[str, Any] | None, matched: dict[str, Any] | None, claim: dict[str, Any], premises: list[dict[str, Any]],
         place: dict[str, Any] | None) -> dict[str, Any]:
    """G = S · C · A. S (frame match) and C (context) decide; A = (1 + cos ΔΦ)/2 only weights. Phase never creates a match."""
    op = operation(qframe)
    phi_q = OPERATION_PHASE[op]
    pf = phase_factor((place or {}).get("Phi"), phi_q)
    S = 1.0 if matched else 0.0
    ctx = context_coherence(qframe, claim, premises)
    A = pf["A"] if pf["A"] is not None else 0.5
    G = round(S * ctx["C"] * A, 6)
    return {"rule": "4.9.236 memory phase invariance with contextual phase alignment", "operation": op, "phi_query": phi_q,
            "phi_identity": pf["phi_identity"], "delta_phi_deg": pf["delta_phi_deg"], "A": A, "A_basis": "measured" if pf["A"] is not None else "no_fact_phase",
            "S": S, "C": ctx["C"], "context_checks": ctx["checks"], "context_failed": ctx["failed"], "G": G,
            "passes": bool(S and ctx["C"]), "delta_stored": False, "identity_rewritten": False}


def question_phases(phase_path: list[Any] | None) -> list[int]:
    out: list[int] = []
    for p in phase_path or []:
        m = re.search(r"(\d+)", str(p))
        if m and 1 <= int(m.group(1)) <= 9 and int(m.group(1)) not in out:
            out.append(int(m.group(1)))
    return out


def alignment(place: dict[str, Any] | None, phase_path: list[Any] | None, question: str) -> dict[str, Any]:
    """Grace, band relation and 4.9.204 attraction of a fact's placement against the question's phases (best phase)."""
    from rmc_engine_v1.band_tuning import band_key, relation, tune
    from rmc_engine_v1.frequency_203_config import HOME
    from rmc_engine_v1.frequency_204 import BETA, MASTER_WINDOW, ZETA, attract_dh
    from rmc_engine_v1.resonance_recall import _grace, _resonance

    place = place if isinstance(place, dict) else {}
    phases = question_phases(phase_path)
    base = {"aligned": False, "question_phases": phases, "fact_phase": place.get("Phi"), "fact_phi_basis": place.get("phi_basis"),
            "fact_band": place.get("band"), "fact_hz": place.get("hz"), "grace": 0.0, "grace_key": 0, "band_relation": "none",
            "band_weight": 0.0, "band_key": 0, "attraction_dh": 0.0, "coupling": 0.0, "question_phi": None, "delta_deg": None}
    if place.get("Phi") is None or not phases:
        base["reason"] = "no fact phase" if place.get("Phi") is None else "no question phase"
        return base
    best = None
    for qphi in phases:
        g = _grace({"Phi": place.get("Phi"), "eps": place.get("eps", "unspecified"), "mu": place.get("mu", "unspecified")}, qphi)
        rel = relation(place.get("Phi"), qphi)
        qband = tune(question, qphi)
        delta = float(g.get("delta") if g.get("delta") is not None else math.tau)
        marker = HOME.get(int(qphi)) or 1
        dh = 0.0
        coupling = 0.0
        if place.get("hz") is not None and qband.get("hz") is not None:
            dh = attract_dh(float(place["hz"]), float(qband["hz"]), marker, delta)
            gap = abs(float(qband["hz"]) - float(place["hz"]))
            coupling = 0.0 if delta > MASTER_WINDOW + 1e-12 else ZETA * math.cos(delta) ** 2 * math.exp(-BETA * gap / marker)
        row = {"aligned": bool(g.get("aligned")), "question_phi": qphi, "delta_deg": round(math.degrees(delta), 3),
               "grace": round(float(g.get("grace") or 0.0), 6), "grace_key": _resonance(g),
               "rpm": g.get("rpm"), "band_relation": rel["relation"], "band_weight": rel["weight"], "band_key": band_key(rel["weight"]),
               "question_band": qband.get("band"), "question_hz": qband.get("hz"), "attraction_dh": dh, "coupling": round(coupling, 6)}
        key = (row["aligned"], row["grace_key"], row["band_key"], row["coupling"])
        if best is None or key > best[0]:
            best = (key, row)
    out = dict(base)
    out.update(best[1])
    out["reason"] = "aligned" if out["aligned"] else "phase not aligned (δ > π/4 or ε/μ outside the band)"
    return out
