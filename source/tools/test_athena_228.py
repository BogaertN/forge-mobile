"""4.9.228 unit tests: general meaning/agreement pipeline (Nic pt144u).
Different meanings of the same spelling are not disagreement; hop-distance hypernym
agreement lets a real genus count without reopening upper-ontology noise."""
from __future__ import annotations

import hashlib
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "engine"))
os.environ.setdefault("FORGE_OEWN_DIR", os.path.join(ROOT, "verify/fixtures/athena_223/oewn"))

from rmc_engine_v1 import meaning_223 as M  # noqa: E402
from rmc_engine_v1 import self_seed_202 as ss  # noqa: E402


def expect(cond, why=""):
    return {"ok": bool(cond), "why": None if cond else (why or "failed")}


def sha(t):
    return hashlib.sha256(t.encode()).hexdigest()


def doc(url, text, meaning, counts=True):
    return {
        "url": url, "text": text, "sha256": sha(text), "fetched_at": "2026-11-05T00:00:00Z",
        "counts": counts, "meaning": meaning,
    }


def different_meaning_does_not_veto():
    """Pinned planet sense: metal other_meaning is off-sense; NASA + OEWN admit."""
    docs = [
        doc("https://science.nasa.gov/mercury/facts/", "Mercury is the smallest planet in our solar system.",
            {"category": "planet", "known": True, "on_chain": True, "under_chain": False, "sense": None, "other_meaning": None}),
        doc("https://en-word.net/id/oewn-09374305-n", "Mercury is the smallest planet and the nearest to the sun.",
            {"category": "planet", "known": True, "on_chain": True, "under_chain": False, "sense": "09374305-n", "other_meaning": None}),
        doc("https://pubchem.ncbi.nlm.nih.gov/element/80", "Mercury is a chemical element with symbol Hg.",
            {"category": "chemical element", "known": True, "on_chain": False, "under_chain": False, "sense": None, "other_meaning": "14669524-n"}),
    ]
    meaning = {"subject_sense": "09374305-n", "subject_phi": 5, "compatible": []}
    res = ss.evaluate({"question": "What is Mercury?", "documents": docs, "gap": True, "reset": True, "meaning": meaning})
    off = (res.get("trace") or {}).get("meaning", {}).get("off_sense") or []
    ok = (res["rule"] == "SEED-CANDIDATE" and set(res.get("hosts") or []) == {"en-word.net", "nasa.gov"}
          and not (res.get("trace") or {}).get("meaning", {}).get("contradict")
          and any(o.get("other_meaning") == "14669524-n" for o in off))
    return {"name": "different_meaning_does_not_veto", "ok": ok,
            "why": None if ok else json.dumps({k: res.get(k) for k in ("rule", "hosts", "trace")})}


def same_meaning_value_conflict_still_disagrees():
    """Incompatible claims about the same slot remain SEED-DISAGREEMENT."""
    docs = [
        doc("https://physics.nist.gov/cgi-bin/cuu/Value?h", "The Planck constant is 6.62607015 × 10^-34 J Hz^-1 (exact).",
            None),
        doc("https://www.bipm.org/en/measurement-units/si-defining-constants", "The Planck constant is 6.626 070 16 × 10^-34 J s (exact).",
            None),
    ]
    # strip meaning so value slot path runs
    for d in docs:
        d.pop("meaning", None)
    res = ss.evaluate({"question": "What is the Planck constant?", "documents": docs, "gap": True, "reset": True, "loop_phi": 3})
    ok = res["rule"] == "SEED-DISAGREEMENT"
    return {"name": "same_meaning_value_conflict_still_disagrees", "ok": ok, "why": None if ok else res["rule"]}


def unpinned_multi_sense_asks():
    subj = M.resolve_subject("What is Mercury?", table={"concepts": {}, "senses": {}})
    ok = subj.get("state") == "ask" and len(subj.get("candidates") or []) >= 2
    return {"name": "unpinned_multi_sense_asks", "ok": ok,
            "why": None if ok else json.dumps({k: subj.get(k) for k in ("state", "sense", "candidates")})}


def real_genus_hop_distance_counts():
    """Saturn: planet at BFS index 4 but hop 2 must count; depth cap stays 4."""
    assert M.HYPERNYM_AGREE_DEPTH == 4
    chain = M.ancestors("09447520-n")
    dist = M.ancestor_distances("09447520-n")
    planet = "09416900-n"
    rows = [
        expect(planet in chain and chain.index(planet) == 4, "planet still at BFS index 4"),
        expect(dist.get(planet) == 2, "planet hop is 2"),
        expect(M.on_chain("planet", chain), "planet agrees via hop distance"),
        expect(M.chain_sense("planet", chain) == planet, "chain_sense returns planet"),
    ]
    return {"name": "real_genus_hop_distance_counts", "ok": all(r["ok"] for r in rows),
            "why": next((r["why"] for r in rows if not r["ok"]), None)}


def caffeine_component_still_refused():
    chain = M.ancestors("14785301-n")
    dist = M.ancestor_distances("14785301-n")
    ok = (not M.on_chain("component", chain) and dist.get("13831419-n", 99) >= M.HYPERNYM_AGREE_DEPTH)
    # annotate path
    subj = {"sense": "14785301-n", "label": "caffeine", "phi": 3, "attr": None}
    docs = [{"url": "https://pubchem.ncbi.nlm.nih.gov/compound/2519", "text": "Caffeine is a major component of coffee.",
             "role": "source", "verbatim": "Caffeine is a major component of coffee."}]
    M.annotate("What is caffeine?", docs, subj)
    m = docs[0]["meaning"]
    ok = ok and m["category"] == "component" and m["on_chain"] is False
    return {"name": "caffeine_component_still_refused", "ok": ok, "why": None if ok else json.dumps(m)}


def off_sense_oewn_sense_id_ignored():
    """Wrong OEWN sense id for the same spelling is off-sense, not contra."""
    docs = [
        doc("https://science.nasa.gov/moon/facts/", "The Moon is Earth's only natural satellite.",
            {"category": "satellite", "known": True, "on_chain": True, "under_chain": False, "sense": None, "other_meaning": None}),
        doc("https://en-word.net/id/oewn-09381447-n", "The Moon is a natural satellite.",
            {"category": "satellite", "known": True, "on_chain": True, "under_chain": False, "sense": "09381447-n", "other_meaning": None}),
    ]
    meaning = {"subject_sense": "09381255-n", "subject_phi": 9, "compatible": []}
    res = ss.evaluate({"question": "What is the Moon?", "documents": docs, "gap": True, "reset": True, "meaning": meaning})
    off = (res.get("trace") or {}).get("meaning", {}).get("off_sense") or []
    ok = (res["rule"] == "SEED-CORROBORATION" and not (res.get("trace") or {}).get("meaning", {}).get("contradict")
          and any(o.get("sense") == "09381447-n" for o in off))
    return {"name": "off_sense_oewn_sense_id_ignored", "ok": ok,
            "why": None if ok else json.dumps({k: res.get(k) for k in ("rule", "hosts", "trace")})}


def main():
    rows = [
        different_meaning_does_not_veto(),
        same_meaning_value_conflict_still_disagrees(),
        unpinned_multi_sense_asks(),
        real_genus_hop_distance_counts(),
        caffeine_component_still_refused(),
        off_sense_oewn_sense_id_ignored(),
    ]
    print(json.dumps(rows, indent=1))
    sys.exit(0 if all(r["ok"] for r in rows) else 1)


if __name__ == "__main__":
    main()
