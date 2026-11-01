"""Resonance recall for the Ask path. No token-overlap rank.

How a row is found
  Predicate-role frame: language_core_debate.frame_for_atom on the atom
  world_model_v1.parse_sentence already returns (contract 1g2034-K §7).
  This module does not add a sentence parser. A wh-karta (what/who/how/…)
  asks the karma. A memory resonates when its karta or karma is that filler.
  One copula hop uses the existing WM-COPULA-CHAIN shape: the matched karma
  is the next fact's karta.
  Concept lexicon: concept_lexicon.json, copied from source/src/lexicon.js
  Doc 4 surfaces that are not function words. A shared entity, attribute, or
  term concept is used only when no frame role locked. Unknown words stay
  unknown. They are not a keyword search.

How a row is ranked
  FORGE-RESONANCE-PACKET/v1 sfe {Phi, eps, mu}.
  source/src/kmath.js phaseAngle, θ=(Φ−1)·40°, and the δ ≤ π/4 merge window (RSOC §3.1.1 ⟁; Nic 4.9.191).
  RPMC §3.4 grace and Axiom 4. rpm weight is μ·exp(−ε).
  source/src/dream_idle.js resonancePacket: projectable Φ9/ε0/μ1,
  quarantine Φ5/ε0.5/μ0. Athena places the packet. Quarantine is not a premise.
  RSOC select: one phase-aligned role lock is the anchor. Several stay open.
  None means recall is empty.

The coherence formula is not in this file.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

from rmc_engine_v1.language_core_debate import frame_for_atom
from rmc_engine_v1.world_model_v1 import parse_sentence

PACKET_SCHEMA = "FORGE-RESONANCE-PACKET/v1"
CITE = (
    "RPMC §1 RPM; Axiom 4; §3.4 Grace Integral; RSOC §3.1.1 ⟁; "
    "source/src/kmath.js phaseAngle; source/src/dream_idle.js resonancePacket; "
    "source/src/lexicon.js Doc 4; language_core_debate.py FR.BE.COP"
)
WH = {"what", "who", "whom", "whose", "why", "how", "when", "where", "which"}
# Nic 4.9.191 confirms the merge window: δ ≤ π/4 (RSOC §3.1.1 ⟁).
PI_OVER_4 = math.pi / 4
_LEXICON: dict[str, Any] | None = None


def _lexicon() -> dict[str, Any]:
    global _LEXICON
    if _LEXICON is None:
        path = Path(__file__).with_name("concept_lexicon.json")
        data = json.loads(path.read_text(encoding="utf-8"))
        extra_path = Path(__file__).with_name("anchor_concepts.json")
        if extra_path.exists():
            extra = json.loads(extra_path.read_text(encoding="utf-8"))
            surfaces = dict(data.get("surfaces") or {})
            categories = dict(data.get("categories") or {})
            for word, cid in (extra.get("concepts") or {}).items():
                surfaces.setdefault(str(word).lower(), str(cid))
                categories.setdefault(str(cid), "anchor")
            data["surfaces"] = surfaces
            data["categories"] = categories
        _LEXICON = data
    return _LEXICON


def _phase_index(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        n = int(value)
        return n if 1 <= n <= 9 else None
    text = str(value).strip()
    if text.startswith("Φ") and len(text) == 2 and text[1] in "123456789":
        return int(text[1])
    if text in "123456789":
        return int(text)
    return None


def _phase_angle(index: int) -> float:
    """Nic 4.9.191: θ = (Φ−1)·40° = ((n−1)/9)·2π."""
    return ((index - 1) / 9.0) * math.tau


def _circular_delta(a: int, b: int) -> float:
    d = abs(_phase_angle(a) - _phase_angle(b)) % math.tau
    return min(d, math.tau - d)


def phase_aligned(a: int | None, b: int | None) -> bool:
    if a is None or b is None:
        return False
    return _circular_delta(a, b) <= PI_OVER_4 + 1e-12


def _norm_role(text: str) -> str:
    parts = str(text or "").strip().lower().strip(" .?!").split()
    if parts and parts[0] in {"the", "a", "an"}:
        parts = parts[1:]
    return " ".join(parts)


def _atom(text: str) -> dict[str, Any] | None:
    parsed = parse_sentence(text)
    if not parsed or parsed.get("parsed") is not True:
        return None
    atom = parsed.get("atom")
    return atom if isinstance(atom, dict) else None


def _frame_roles(text: str) -> dict[str, Any] | None:
    atom = _atom(text)
    if not atom:
        return None
    frame = frame_for_atom(atom)
    args = [str(a) for a in (atom.get("args") or [])]
    filled: dict[str, str] = {}
    for i, role in enumerate(frame.get("roles") or []):
        if i < len(args) and args[i].strip():
            filled[str(role)] = args[i]
    return {"frame": frame.get("id"), "predicate": atom.get("predicate"), "filled": filled}


def asked_filler(question: str) -> dict[str, Any] | None:
    """The role the question opens on FR.BE.COP. A wh-karta asks the karma."""
    roles = _frame_roles(question)
    if not roles or roles.get("predicate") != "is":
        return None
    filled = roles["filled"]
    karta = str(filled.get("karta") or "")
    karma = str(filled.get("karma") or "")
    head = _norm_role(karta).split(" ")[:1]
    if head and head[0] in WH:
        return {"filler": _norm_role(karma), "role": "karma", "frame": roles["frame"]}
    return {"filler": _norm_role(karta), "role": "karta", "frame": roles["frame"]}


def _role_hit(filler: str, text: str) -> dict[str, Any] | None:
    if not filler:
        return None
    roles = _frame_roles(text)
    if not roles:
        return None
    for role in ("karta", "karma"):
        if _norm_role(str((roles["filled"] or {}).get(role) or "")) == filler:
            return {"frame": roles["frame"], "role": role, "filler": filler, "predicate": roles["predicate"]}
    return None


def _anchor_concepts(text: str) -> set[str]:
    """Anchor concepts named by the words of text (anchor_concepts.json), even where the
    general concept lexicon gives the word another concept ("sun": N.WEATHER and A.SUN)."""
    path = Path(__file__).with_name("anchor_concepts.json")
    if not path.exists():
        return set()
    global _ANCHOR_WORDS
    if _ANCHOR_WORDS is None:
        _ANCHOR_WORDS = {str(k).lower(): str(v) for k, v in (json.loads(path.read_text(encoding="utf-8")).get("concepts") or {}).items()}
    found: set[str] = set()
    for raw in str(text or "").lower().split():
        cid = _ANCHOR_WORDS.get(raw.strip(".,;:!?\"'()[]"))
        if cid:
            found.add(cid)
    return found


_ANCHOR_WORDS: dict[str, str] | None = None


def _concept_ids(text: str) -> set[str]:
    surfaces = (_lexicon().get("surfaces") or {})
    found: set[str] = set()
    for raw in str(text or "").lower().split():
        word = raw.strip(".,;:!?\"'()[]")
        cid = surfaces.get(word)
        if cid:
            found.add(str(cid))
    return found


# 4.9.210 (Release A2): word sense and compound names, structurally.
_NAME_GLUE = {"and", "of", "the", "de", "da", "del", "la", "le", "von", "van", "bin", "al"}
_DETERMINERS = {"the", "a", "an", "this", "that", "these", "those", "in", "on", "at", "of", "for", "by", "to", "from", "with"}


def _name_words(text: str) -> list[str]:
    out, buf = [], []
    for ch in str(text or ""):
        if ch.isalnum() or ch in "-'":
            buf.append(ch)
        else:
            if buf:
                out.append("".join(buf).strip("-'"))
            buf = []
            if ch in ".!?;:,()[]\"":
                out.append("|")
    if buf:
        out.append("".join(buf).strip("-'"))
    return [t for t in out if t]


def _capital(tok: str) -> bool:
    return bool(tok) and tok[0].isupper() and tok.lower() not in _DETERMINERS


def compound_names(text: str) -> list[list[str]]:
    """Proper-name compounds in running text: two or more adjacent capitalised words
    ("MOON Jae-in", "Burkina Faso", "Mona Lisa", "National Assembly"), allowing name glue
    ("Bosnia and Herzegovina"). A word inside such a name does not name a general concept
    on its own ("MOON" in "MOON Jae-in" is not the Moon). Sentence-initial determiners
    ("The Moon") are not name parts."""
    toks = _name_words(text)
    names, cur, glue = [], [], []
    for tok in toks + ["|"]:
        if tok != "|" and _capital(tok):
            if cur and glue:
                cur.extend(glue)
            cur.append(tok)
            glue = []
        elif tok != "|" and cur and tok.lower() in _NAME_GLUE and not glue:
            glue = [tok]
        else:
            if len([t for t in cur if _capital(t)]) >= 2:
                names.append(cur)
            cur, glue = [], []
    return names


def compound_id(words: list[str]) -> str:
    return "A." + "".join(ch for ch in "".join(words).upper() if ch.isalnum())


def row_concepts(node: dict[str, Any], text: str | None = None) -> set[str]:
    """A row's packet concepts. An anchor's own curated concepts (its class) come first;
    words are read only outside proper-name compounds, and a compound adds its own id."""
    own: set[str] = set()
    for key in ("concepts",):
        if isinstance(node.get(key), list):
            own |= {str(c) for c in node[key] if c}
    for key in ("concept",):
        if isinstance(node.get(key), str) and node[key]:
            own.add(node[key])
    packet = node.get("packet") if isinstance(node.get("packet"), dict) else {}
    if isinstance(packet.get("concept"), str) and packet.get("concept"):
        own.add(packet["concept"])
    body = clean_text(node) if text is None else text
    names = compound_names(body)
    inside = {t.lower() for name in names for t in name}
    words = " ".join(t for t in _name_words(body) if t != "|" and t.lower() not in inside)
    return own | _concept_ids(words) | _anchor_concepts(words) | {compound_id(n) for n in names}


def question_concepts(question: str, known: set[str] | None = None) -> set[str]:
    """The question's packet concepts. Longest compound first: a span whose compound id
    is a known concept ("burkina faso" -> A.BURKINAFASO) is one name, and its words do not
    also count alone. Then single words: the concept lexicon, the anchor concepts, and
    A.<WORD> when that is a known concept."""
    known = known or set()
    toks = [t.lower() for t in _name_words(question) if t != "|"]
    used = [False] * len(toks)
    found: set[str] = set()
    for size in range(min(8, len(toks)), 1, -1):
        for i in range(0, len(toks) - size + 1):
            if any(used[i:i + size]):
                continue
            cid = compound_id(toks[i:i + size])
            if cid in known:
                found.add(cid)
                for j in range(i, i + size):
                    used[j] = True
    rest = " ".join(t for t, u in zip(toks, used) if not u)
    found |= _concept_ids(rest) | _anchor_concepts(rest)
    for tok in rest.split():
        cid = compound_id([tok])
        if cid in known:
            found.add(cid)
    return found


def _numeric_or_unspecified(value: Any, default: float) -> Any:
    if value == "unspecified":
        return "unspecified"
    try:
        return round(float(value), 6)
    except (TypeError, ValueError):
        return default


def place_packet(row: dict[str, Any], *, quarantined: bool, question: str | None = None) -> dict[str, Any]:
    """Athena resonance placement. The concept packet replaces a hand-set phase."""
    from rmc_engine_v1.lexicon_resonance import concept_in_text, replaces_keyword_phase

    placed = None
    if not quarantined:
        asked = replaces_keyword_phase(question or "")
        text = clean_text(row) if row else ""
        if asked and concept_in_text(asked["concept"], text):
            placed = asked["packet"]
    given = row.get("sfe") if isinstance(row.get("sfe"), dict) else None
    if placed and placed.get("Phi"):
        phi = int(placed["Phi"])
        eps = placed.get("eps")
        mu = placed.get("mu")
        if eps != "unspecified":
            eps = _numeric_or_unspecified(eps, 0.0)
        if mu != "unspecified":
            mu = _numeric_or_unspecified(mu, 1.0)
        basis = placed
    elif given and _phase_index(given.get("Phi")) is not None:
        phi = _phase_index(given.get("Phi"))
        eps = _numeric_or_unspecified(given.get("eps"), 0.5 if quarantined else 0.0)
        mu = _numeric_or_unspecified(given.get("mu"), 0.0 if quarantined else 1.0)
        basis = None
    elif quarantined:
        phi, eps, mu = 5, 0.5, 0.0
        basis = None
    else:
        phi, eps, mu = 9, 0.0, 1.0
        basis = None
    sfe = {"Phi": int(phi), "eps": eps if eps == "unspecified" else round(float(eps), 6), "mu": mu if mu == "unspecified" else round(float(mu), 6)}
    out = {
        "schema": PACKET_SCHEMA,
        "Phi": sfe["Phi"],
        "eps": sfe["eps"],
        "mu": sfe["mu"],
        "sfe": sfe,
        "cite": CITE,
        "placed_by": "athena",
        "standing": "quarantine" if quarantined else "projectable",
    }
    if basis:
        out["glyph"] = basis.get("glyph")
        out["concept"] = basis.get("concept")
        out["authority"] = basis.get("authority")
        out["seed"] = basis.get("cite")
        out["eps_status"] = basis.get("eps_status")
        out["mu_status"] = basis.get("mu_status")
        out["phi_basis"] = "lexicon_resonance"
    return out


def _question_phi(phase_report: dict[str, Any] | None) -> int:
    state: Any = {}
    if isinstance(phase_report, dict):
        state = phase_report.get("phase_state") if isinstance(phase_report.get("phase_state"), dict) else phase_report
    if not isinstance(state, dict):
        return 1
    placed = state.get("lexicon_placement") if isinstance(state.get("lexicon_placement"), dict) else None
    if placed and _phase_index(placed.get("Phi")):
        return int(placed["Phi"])
    return _phase_index(state.get("phase_primary")) or 1


def clean_text(node: dict[str, Any]) -> str:
    content = str(node.get("content") or "").strip()
    if content and not content.startswith("content:"):
        return content
    text = str(node.get("text") or "").strip()
    if text and not text.startswith("content:"):
        return text
    summary = str(node.get("content_summary") or "")
    marker = "text: "
    if marker in summary:
        return summary.split(marker, 1)[1].split(" | ", 1)[0].strip()
    return summary.strip()


def _quarantined(node: dict[str, Any]) -> bool:
    if str(node.get("trust") or "").lower() == "low":
        return True
    if node.get("quarantined") is True:
        return True
    if str(node.get("confidence") or "") == "low":
        return True
    try:
        if float(node.get("prior_drift_score") or 0) >= 0.40:
            return True
    except (TypeError, ValueError):
        pass
    return False


def _hop_nodes(direct: list[dict[str, Any]], pool: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """One copula hop. The locked karma is the next fact's karta."""
    wanted: set[str] = set()
    for node in direct:
        roles = _frame_roles(clean_text(node))
        if not roles or roles.get("predicate") != "is":
            continue
        karma = _norm_role(str((roles["filled"] or {}).get("karma") or ""))
        if karma:
            wanted.add(karma)
    if not wanted:
        return []
    seen = {id(n) for n in direct}
    hops = []
    for node in pool:
        if id(node) in seen or _quarantined(node):
            continue
        roles = _frame_roles(clean_text(node))
        if not roles or roles.get("predicate") != "is":
            continue
        karta = _norm_role(str((roles["filled"] or {}).get("karta") or ""))
        if karta in wanted:
            hops.append(node)
    return hops



def _anchor_key(node: dict[str, Any]) -> tuple:
    """An admitted seed outranks a resonance-placed excerpt and an encyclopedia anchor.

    The longest seed still wins among seeds. An encyclopedia anchor is the lock
    when no seed locked. A placed excerpt is the lock only when neither did.
    """
    seeded = 0 if node.get("anchor_placed") else 1
    encyclopedia = 0 if str(node.get("tier") or node.get("state") or "") == "anchor" else 1
    return (seeded, encyclopedia, len(clean_text(node)), str(node.get("memory_id") or ""))


def _resonance(grace: dict[str, Any] | None) -> int:
    """Phase-resonance strength as an integer key (grace x 10^4), the same number the
    retrieval record shows as phase_align. An integer so both runtimes sort alike."""
    return int(round(float((grace or {}).get("grace") or 0.0) * 10000))


def _trusted(node: dict[str, Any]) -> int:
    """4.9.209: a trusted anchor outranks an unsourced row (Nic plan, Release A item 1).

    Trust is read with the same source_trust rule the trust trace uses. It only
    orders candidates; it never admits one. The gate, Echo and the trust trace
    still decide.
    """
    from rmc_engine_v1.source_trust import trust_tier
    return 1 if trust_tier(node) == "trusted" else 0


def _rsoc(locks):
    """One lock is selected. Several stay open. Zero is sealed."""
    if len(locks) == 1:
        return {
            "calculus": "RSOC/v1",
            "selected": locks[0].get("memory_id"),
            "locked": 1,
            "status": "locked",
            "cite": "RSOC section 3.1.1 align, section 3.2.2 lock",
        }
    if len(locks) > 1:
        return {
            "calculus": "RSOC/v1",
            "selected": None,
            "locked": len(locks),
            "status": "held_open",
            "cite": "RSOC section 3.1.2 hold; ambiguity is not guessed",
        }
    return {"calculus": "RSOC/v1", "selected": None, "locked": 0, "status": "sealed", "cite": "RPMC section 3.4 G = 0 stays sealed"}


def _as_measure(value: Any, unspecified_default: str = "unspecified") -> Any:
    if value == "unspecified":
        return "unspecified"
    try:
        return float(value)
    except (TypeError, ValueError):
        return unspecified_default


def _grace(packet, question_phi):
    phi = _phase_index(packet.get("Phi"))
    eps = _as_measure(packet.get("eps"))
    mu = _as_measure(packet.get("mu"))
    delta = _circular_delta(question_phi, phi) if phi is not None else math.tau
    # Unspecified ε/μ are not invented and do not fail a phase match.
    # A stated number still has to sit in the projectable band.
    eps_ok = eps == "unspecified" or (isinstance(eps, (int, float)) and eps <= 0.35)
    mu_ok = mu == "unspecified" or (isinstance(mu, (int, float)) and mu > 0)
    aligned = phase_aligned(question_phi, phi) and eps_ok and mu_ok
    # rpm weight: kmath.rpmWeight = μ·exp(−ε). Unspecified charge does not invent μ.
    if not aligned:
        weight, grace = 0.0, 0.0
    elif eps == "unspecified" or mu == "unspecified":
        weight, grace = 1.0, math.cos(delta) ** 2
    else:
        weight = mu * math.exp(-max(0.0, eps))
        grace = weight * (math.cos(delta) ** 2)
    return {
        "aligned": aligned,
        "delta": round(delta, 6),
        "grace": round(grace, 6),
        "rpm": round(weight, 6),
        "phi": phi,
    }


def curate_quarantine(question, row, ancestors):
    """Athena holds a quarantined excerpt until an admitted ancestor phase-aligns.

    No ancestor means grace is 0 and the row stays quarantined. That is the
    bootstrap: nothing admitted, nothing to align, nothing written.
    A later admit is a separate gate. This function does not write.
    """
    packet = place_packet(row if isinstance(row, dict) else {}, quarantined=True)
    qphi = 1
    asked = asked_filler(question)
    aligned = []
    for anc in ancestors or []:
        if not isinstance(anc, dict) or _quarantined(anc):
            continue
        ap = anc.get("packet") if isinstance(anc.get("packet"), dict) else place_packet(anc, quarantined=False)
        g = _grace(ap, qphi)
        if g["aligned"]:
            aligned.append({"id": anc.get("memory_id") or anc.get("id"), "grace": g["grace"]})
    role = _role_hit(asked["filler"], clean_text(row)) if asked else None
    kept = bool(aligned) and role is not None and packet["sfe"]["eps"] <= 0.35 and packet["sfe"]["mu"] > 0
    return {
        "ok": kept,
        "rule": "ATHENA-QUARANTINE-TO-ADMIT" if kept else "DREAM-QUARANTINE-NO-TRUTH",
        "packet": packet,
        "ancestors": aligned,
        "grace": round(sum(a["grace"] for a in aligned), 6),
        "role": role,
        "writes": False,
        "calls_llm": False,
        "cite": CITE,
        "reason": "phase-aligned admitted ancestor and a frame-role lock" if kept else "no phase-aligned admitted ancestor, or the frame did not lock; quarantine stays evidence",
    }


def rank_memory(question, nodes, phase_report=None):
    """Return resonant nodes. Quarantine is recorded and not returned as active."""
    question_phi = _question_phi(phase_report)
    asked = asked_filler(question)
    known = set()
    for node in nodes or []:
        if isinstance(node, dict) and isinstance(node.get("concepts"), list):
            known |= {str(c) for c in node["concepts"] if c}
    q_concepts = question_concepts(question, known)
    admitted = []
    quarantined = []
    role_locks = []
    concept_hits = []
    for node in nodes or []:
        if not isinstance(node, dict):
            continue
        text = clean_text(node)
        packet = place_packet(node, quarantined=_quarantined(node), question=question)
        node["packet"] = packet
        node["sfe"] = packet["sfe"]
        if text:
            node["content"] = text
        grace = _grace(packet, question_phi)
        if _quarantined(node):
            quarantined.append({
                "memory_id": node.get("memory_id"),
                "packet": packet,
                "grace": grace,
                "premise": False,
            })
            continue
        if not grace["aligned"]:
            continue
        admitted.append(node)
        hit = _role_hit(asked["filler"], text) if asked else None
        shared = sorted(q_concepts & row_concepts(node, text))
        if hit:
            role_locks.append((node, hit, grace, shared))
        elif shared:
            concept_hits.append((node, shared, grace))

    # 4.9.216 computed tier: the engine's computation receipt for this exact question is the premise of a math
    # question. It locks before the frame-role and concept locks; it still has to phase-align, and the gate and the
    # recomputing Echo still decide. A receipt for another question does not lock.
    computed_locks = []
    if admitted:
        from rmc_engine_v1.computed_math import question_key
        qk = question_key(question or "")
        for node in admitted:
            prov = node.get("provenance") if isinstance(node.get("provenance"), dict) else {}
            if str(node.get("tier") or "").lower() == "computed" and prov.get("question_key") == qk and isinstance(prov.get("receipt"), dict):
                computed_locks.append(node)
    # 4.9.209: an unsourced role lock does not outrank a trusted concept anchor.
    # Before this, any frame-role lock won over every concept hit, so twelve
    # unsourced shared rows ("Zenith marks sky overhead.") beat the NASA anchor.
    best_role = max((_trusted(r[0]) for r in role_locks), default=-1)
    best_concept = max((_trusted(r[0]) for r in concept_hits), default=-1)
    if role_locks and best_concept > best_role:
        role_locks = []
    if computed_locks:
        chosen = [sorted(computed_locks, key=lambda n: str(n.get("memory_id") or ""))[0]]
        how = "computation_receipt"
        rsoc = _rsoc(chosen)
        detail = {chosen[0].get("memory_id"): {"grace": _grace(chosen[0].get("packet") or {}, question_phi), "concepts": ["computed"]}}
        hops = []
    elif role_locks:
        # Several frame locks stay open in the RSOC record. The scorer sees
        # one anchor, the longest phase-aligned lock, so a shorter restatement
        # written later does not dilute memory_fit. Observe still receives every
        # admitted row through admitted_for_observe.
        # Length then id. Grace is recorded, not used as a sort key, so Pyodide
        # and CPython pick the same anchor.
        # 4.9.209: phase resonance (grace = rpm weight x cos^2 of the phase gap, rounded so
        # CPython and Pyodide agree) ranks right after trust; length and id only break ties.
        role_locks.sort(key=lambda row: (_trusted(row[0]), _resonance(row[2])) + _anchor_key(row[0]), reverse=True)
        chosen = [role_locks[0][0]]
        how = "frame_role"
        rsoc = _rsoc([row[0] for row in role_locks])
        if rsoc.get("status") == "held_open":
            rsoc["anchor"] = chosen[0].get("memory_id")
        detail = {row[0].get("memory_id"): {"hit": row[1], "grace": row[2], "concepts": row[3]} for row in role_locks}
        hops = _hop_nodes(chosen, admitted)
    elif concept_hits:
        # A shared color or time word is not the subject. Prefer the fact
        # that shares an anchor concept the question actually named.
        def _concept_key(row):
            shared = row[1]
            specific = sum(1 for cid in shared if str(cid).startswith("A."))
            return (_trusted(row[0]), _resonance(row[2]), specific) + _anchor_key(row[0])
        concept_hits.sort(key=_concept_key, reverse=True)
        chosen = [concept_hits[0][0]]
        how = "concept_lexicon"
        rsoc = _rsoc([row[0] for row in concept_hits])
        if rsoc.get("status") == "held_open":
            rsoc["anchor"] = chosen[0].get("memory_id")
        detail = {row[0].get("memory_id"): {"concepts": row[1], "grace": row[2]} for row in concept_hits}
        hops = []
    else:
        chosen = []
        how = "none"
        rsoc = _rsoc([])
        detail = {}
        hops = []

    active = []
    seen = set()
    for node in chosen + hops:
        if id(node) in seen:
            continue
        seen.add(id(node))
        text = clean_text(node)
        if node.get("anchor_placed"):
            ancestor = str(node.get("anchor_ancestor_text") or "").strip()
            if ancestor and ancestor not in text:
                text = (text + " " + ancestor).strip()
        elif role_locks:
            # A placed excerpt that locked the same role stays with the seed.
            # The seed remains the anchor. The scorer also sees the connection.
            for other, _hit, _grace_row, _shared in role_locks:
                if other is node or not other.get("anchor_placed"):
                    continue
                if str(other.get("trust") or "").lower() == "low":
                    continue
                bit = clean_text(other)
                if bit and bit not in text:
                    text = (text + " " + bit).strip()
        info = detail.get(node.get("memory_id")) or {}
        grace = info.get("grace") or _grace(node.get("packet") or {}, question_phi)
        hop = node not in chosen
        weight = 1.0 if not hop and grace.get("aligned") else (0.72 if hop else round(min(1.0, grace.get("grace") or 0.0), 4))
        out = dict(node)
        # The scorer compares these text fields. Keep the knowledge sentence
        # and leave the receipt path on ancestry, not in the compared text.
        if text:
            out["content"] = text
        # One copy of the sentence. The receipt path stays on ancestry.
        out["content_summary"] = ""
        out["summary"] = ""
        out["memory_role"] = ""
        out["source"] = ""
        out["source_path"] = ""
        out["symbolic_signature"] = ""
        out["chunk_id"] = ""
        out["retrieval_weight"] = round(weight, 4)
        out["retrieval_dimensions"] = {
            "phase_align": round(grace.get("grace") or 0.0, 4),
            "frame_role": 1.0 if info.get("hit") else 0.0,
            "concept": 1.0 if info.get("concepts") else 0.0,
            "copula_hop": 1.0 if hop else 0.0,
        }
        out["retrieval_evidence"] = [{
            "type": "phase_align",
            "phi": grace.get("phi"),
            "question_phi": question_phi,
            "delta": grace.get("delta"),
            "grace": grace.get("grace"),
            "frame": (info.get("hit") or {}).get("frame"),
            "role": (info.get("hit") or {}).get("role"),
            "concepts": info.get("concepts") or [],
            "hop": hop,
        }]
        active.append(out)
    active.sort(key=lambda n: (n.get("retrieval_weight") or 0, str(n.get("memory_id") or "")), reverse=True)
    return {
        "method": "resonance",
        "uses_token_overlap": False,
        "calls_llm": False,
        "question_phi": question_phi,
        "asked": asked,
        "how": how,
        "rsoc": rsoc,
        "active": active,
        "admitted_for_observe": [n for n in (nodes or []) if isinstance(n, dict)],
        "quarantine": quarantined,
        "cite": CITE,
    }
