"""4.9.227 engine tests (Nic t142u): a definition of X is keyed from X; a definitional question about X also
resonates in X's meaning phase and prefers rows that define X. General rules, no subject->answer table."""
from __future__ import annotations

import hashlib
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "engine"))
sys.path.insert(0, ROOT)
os.environ.setdefault("FORGE_OEWN_DIR", os.path.join(ROOT, "verify/fixtures/athena_223/oewn"))

from rmc_engine_v1 import meaning_223 as M  # noqa: E402
from rmc_engine_v1 import self_seed_202 as ss  # noqa: E402
from rmc_engine_v1 import resonance_recall as R  # noqa: E402
from rmc_engine_v1.lexicon_resonance import apply_lexicon_phase  # noqa: E402
from rmc_engine_v1.phase_parser import parse_phase  # noqa: E402


def sha(t):
    return hashlib.sha256(t.encode()).hexdigest()


def case(name, ok, why=None):
    return {"name": name, "ok": bool(ok), "why": None if ok else why}


def subject_key_rule():
    rows = []
    for q, want in (("What is the Moon?", "A.MOON"), ("What is a protein?", "A.PROTEIN"), ("What is the speed of light?", "A.SPEEDOFLIGHT"),
                    ("What is sodium chloride?", "A.SODIUMCHLORIDE")):
        s = M.resolve_subject(q, {})
        rows.append((q, s.get("key") == want, s.get("key")))
    ok = all(r[1] for r in rows)
    return case("the subject key comes from the asked subject (article dropped, words joined), not sentence words", ok, json.dumps(rows))


def anchor_keyed_from_subject():
    # The Moon source sentence mentions Earth; the anchor must still be keyed to the subject, not to EARTH.
    docs = [
        {"url": "https://science.nasa.gov/moon/facts/", "text": "The Moon is Earth's only natural satellite.",
         "sha256": sha("The Moon is Earth's only natural satellite."), "fetched_at": "2026-11-04T00:00:00Z",
         "meaning": {"category": "satellite", "known": True, "on_chain": True, "under_chain": False, "sense": None, "other_meaning": None}},
        {"url": "https://en-word.net/lemma/moon", "text": "Moon is the natural satellite of the Earth.",
         "sha256": sha("Moon is the natural satellite of the Earth."), "fetched_at": "2026-11-04T00:00:00Z",
         "meaning": {"category": "satellite", "known": True, "on_chain": True, "under_chain": False, "sense": "09381255-n", "other_meaning": None}},
    ]
    meaning = {"subject_sense": "09381255-n", "subject_phi": 9, "compatible": [], "subject_key": ["A.MOON"]}
    res = ss.evaluate({"question": "What is the Moon?", "documents": docs, "gap": True, "reset": True, "meaning": meaning})
    a = res.get("anchor") or {}
    ok = res.get("rule") == "SEED-CANDIDATE" and a.get("concepts") == ["A.MOON"] and a.get("concepts_from") == "subject meaning"
    # with no subject key the anchor keeps its older keying (no change for callers that do not resolve a subject)
    m2 = dict(meaning); m2.pop("subject_key")
    a2 = (ss.evaluate({"question": "What is the Moon?", "documents": docs, "gap": True, "reset": True, "meaning": m2}).get("anchor") or {})
    ok2 = a2.get("concepts_from") != "subject meaning"
    return case("an admitted definition of X is keyed to X (Moon -> A.MOON, not A.EARTH); no key, no change", ok and ok2,
                json.dumps({"rule": res.get("rule"), "concepts": a.get("concepts"), "old": a2.get("concepts")}))


def annotate_carries_key():
    subj = M.resolve_subject("What is helium?", {})
    out = M.annotate("What is helium?", [], subj)
    return case("annotate hands the subject key to the evaluator", (out or {}).get("subject_key") == ["A.HELIUM"], json.dumps(out)[:300])


def subject_phase_recorded_not_replacing():
    q = "What is helium?"
    rep = apply_lexicon_phase(parse_phase(q, {}), q)
    st = rep.get("phase_state") or {}
    sp = (st.get("subject_phase") or {}).get("Phi")
    ok = sp == R.subject_phase(["helium"]) and st.get("phase_primary") == (parse_phase(q, {}).get("phase_state") or {}).get("phase_primary")
    rep2 = apply_lexicon_phase(parse_phase("Hello there", {}), "Hello there")
    ok2 = "subject_phase" not in (rep2.get("phase_state") or {})
    return case("a definitional question records its subject phase beside the parser phase; others record nothing", ok and ok2,
                json.dumps({"sp": sp, "primary": st.get("phase_primary")}))


def node(i, text, phi, concepts, defines_text=True):
    return {"memory_id": i, "content": text, "text": text, "concepts": concepts, "trust": "trusted", "tier": "anchor",
            "packet": {"Phi": phi, "eps": 0.0, "mu": 1.0}, "sfe": {"Phi": phi, "eps": 0.0, "mu": 1.0}, "anchor_placed": True}


def settle_rule():
    q = "What is helium?"
    rep = apply_lexicon_phase(parse_phase(q, {}), q)
    sp = rep["phase_state"]["subject_phase"]["Phi"]
    qp = R._phase_index(rep["phase_state"].get("phase_primary"))

    def active(phi, via_q=False):
        return [{"retrieval_dimensions": {"phase_align": 1.0}, "retrieval_evidence": [{"phi": phi, "hop": False}]}]
    moved = R.settle_subject_phase(rep, active(sp))
    kept_q = R.settle_subject_phase(rep, active(qp))
    mixed = R.settle_subject_phase(rep, active(sp) + active(qp))
    far = (sp + 4 - 1) % 9 + 1
    kept_far = R.settle_subject_phase(rep, active(far))
    ok = (moved["phase_state"]["phase_from"] == "subject meaning (recalled definition)"
          and R._phase_index(moved["phase_state"]["phase_primary"]) == sp
          and kept_q["phase_state"].get("phase_from") != "subject meaning (recalled definition)"
          and mixed["phase_state"].get("phase_from") != "subject meaning (recalled definition)"
          and kept_far["phase_state"].get("phase_from") != "subject meaning (recalled definition)")
    return case("the question moves to the subject phase only when every chosen fact is filed there (window); a fact at the question's own phase keeps it",
                ok, json.dumps({"sp": sp, "qp": qp}))


def ask_prefers_subject_definition():
    """End to end: a mention at the question phase and a definition filed at the subject phase. The definition is answered.
    Rows are synthetic; the rule is general (no subject table)."""
    import tools.audit_204 as A
    sp = R.subject_phase(["helium"])
    qp = 1
    rows = [
        {"id": "t227-mention", "text": "Helium balloons float at fairs.", "sfe": {"Phi": qp, "eps": 0.0, "mu": 1.0}, "concepts": ["A.HELIUM"],
         "tier": "anchor", "state": "anchor", "trust": "trusted", "contributor": "test"},
        {"id": "t227-define", "text": "Helium is a noble gas with the atomic symbol He, atomic number 2, and atomic weight 4.003.",
         "sfe": {"Phi": sp, "eps": 0.0, "mu": 1.0}, "concepts": ["A.HELIUM"], "tier": "anchor", "state": "anchor", "trust": "trusted", "contributor": "test"},
    ]
    mem = json.loads(json.dumps(A.SEED)); mem["anchors"] = list(A.starter_rows()); mem["pools"] = [{"name": "anchors", "into": "anchors", "rows": A.anchor_pool() + rows}]
    it = A.one("What is helium?", mem)
    ok = bool(it.get("admitted")) and "noble gas" in str(it.get("reply") or "")
    return case("Ask answers the row that defines X ahead of a mention", ok, json.dumps({"admitted": it.get("admitted"), "reply": it.get("reply")})[:400])


def main():
    out = [subject_key_rule(), anchor_keyed_from_subject(), annotate_carries_key(), subject_phase_recorded_not_replacing(), settle_rule(),
           ask_prefers_subject_definition()]
    print(json.dumps(out, indent=1, ensure_ascii=False))
    sys.exit(0 if all(r["ok"] for r in out) else 1)


if __name__ == "__main__":
    main()
