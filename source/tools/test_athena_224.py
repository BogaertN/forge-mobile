"""4.9.224 unit tests: hypernym depth cap, definition phase from subject meaning, writer dry-run shape."""
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


def hypernym_depth_cap():
    assert M.HYPERNYM_AGREE_DEPTH == 4
    chain = M.ancestors("14785301-n")  # caffeine
    rows = []
    rows.append(expect(M.on_chain("alkaloid", chain), "alkaloid depth 1"))
    rows.append(expect(not M.on_chain("component", chain), "component depth 8 rejected"))
    rows.append(expect(M.on_chain("force", M.ancestors("11484542-n")), "gravity/force"))
    rows.append(expect(M.on_chain("satellite", M.ancestors("09381255-n")), "moon/satellite"))
    return {"name": "hypernym_depth_cap", **{"ok": all(r["ok"] for r in rows), "cases": rows}}


def definition_phase_from_subject_meaning():
    docs = [
        {"url": "https://science.nasa.gov/moon/facts/", "text": "The Moon is Earth's only natural satellite.",
         "sha256": sha("The Moon is Earth's only natural satellite."), "fetched_at": "2026-11-04T00:00:00Z",
         "meaning": {"category": "satellite", "known": True, "on_chain": True, "under_chain": False, "sense": None, "other_meaning": None}},
        {"url": "https://en-word.net/lemma/moon", "text": "Moon is the natural satellite of the Earth.",
         "sha256": sha("Moon is the natural satellite of the Earth."), "fetched_at": "2026-11-04T00:00:00Z",
         "meaning": {"category": "satellite", "known": True, "on_chain": True, "under_chain": False, "sense": "09381255-n", "other_meaning": None}},
    ]
    meaning = {"subject_sense": "09381255-n", "subject_phi": 9, "compatible": []}
    res = ss.evaluate({"question": "What is the Moon?", "documents": docs, "gap": True, "reset": True, "meaning": meaning})
    ok = res["rule"] == "SEED-CANDIDATE" and res["loop_phi"] == 9 and set(res.get("hosts") or []) == {"en-word.net", "nasa.gov"}
    # without meaning payload the 4.9.222 path still holds on phase (Earth words pull Φ3)
    res2 = ss.evaluate({"question": "What is the Moon?", "documents": docs, "gap": True, "reset": True, "loop_phi": 1})
    return {"name": "definition_phase_from_subject_meaning", "ok": ok and res2["rule"] in ("SEED-PHASE", "SEED-CORROBORATION", "SEED-CANDIDATE"),
            "why": None if ok else json.dumps({k: res.get(k) for k in ("rule", "hosts", "loop_phi", "claim")})}


def caffeine_component_rejected_in_annotate():
    # annotate marks component not on_chain under the depth cap
    subj = {"sense": "14785301-n", "label": "caffeine", "phi": 3, "attr": None}
    docs = [{"url": "https://pubchem.ncbi.nlm.nih.gov/compound/2519", "text": "Caffeine is a major component of coffee.",
             "role": "source", "verbatim": "Caffeine is a major component of coffee."}]
    M.annotate("What is caffeine?", docs, subj)
    m = docs[0]["meaning"]
    return {"name": "caffeine_component_rejected", "ok": m["category"] == "component" and m["on_chain"] is False,
            "why": None if m["on_chain"] is False else json.dumps(m)}


def writer_row_shape():
    sys.path.insert(0, ROOT)
    from tools.athena_write_224 import build_row
    anchor = {
        "text": "Gravity is the force by which a planet or other body draws objects toward its center.",
        "license": "public-domain", "license_url": "https://www.nasa.gov/", "source_url": "https://spaceplace.nasa.gov/what-is-gravity/en/",
        "revision": "abc", "contributor": "self-seed:nasa.gov", "concepts": ["A.GRAVITY"],
        "packet": {"schema": "FORGE-RESONANCE-PACKET/v1", "Phi": 1, "eps": 0.0, "mu": 1.0, "sfe": {"Phi": 1, "eps": 0.0, "mu": 1.0},
                   "band": {"phase": 1, "band": "Theta", "hz": 6.0, "r": 0.1, "source": "in_band", "schema": "FORGE-BAND-TUNING/v1"}},
        "provenance": {"echo": 1.0, "content_sha256": sha("Gravity is the force by which a planet or other body draws objects toward its center."),
                       "independent_hosts": ["en-word.net", "nasa.gov"], "source": "nasa.gov", "asking_question": "What is gravity?"},
    }
    res = {"anchor": anchor, "hosts": ["en-word.net", "nasa.gov"], "claim": "meaning|gravity|11484542-n|force", "trace": {"meaning": {"agree": ["en-word.net", "nasa.gov"]}}, "echo": 1.0}
    row = build_row("What is gravity?", res, {"subject_sense": "11484542-n"}, {"sense": "11484542-n", "phi": 1, "concept": "A.GRAVITY", "phi_from": "pinned concept A.GRAVITY"})
    ok = (row["meaning_id"] == "11484542-n" and len(row["independent_hosts"]) == 2 and row["contributor"].startswith("self-seed:")
          and row["content_sha256"] and row["source_url"].startswith("https://") and "geonames.org" not in row["independent_hosts"])
    return {"name": "writer_row_shape", "ok": ok, "anchor_id": row["anchor_id"]}


def commit_locked_without_env():
    # the CLI refuses --commit unless FORGE_ATHENA_COMMIT=1
    import subprocess
    env = {k: v for k, v in os.environ.items() if k != "FORGE_ATHENA_COMMIT"}
    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools/athena_write_224.py"), "--commit", "/tmp/no.json", "What is gravity?"],
                       cwd=ROOT, env=env, capture_output=True, text=True)
    return {"name": "commit_locked_without_env", "ok": r.returncode == 2 and "ATHENA-COMMIT-LOCKED" in r.stdout}


def main():
    rows = [hypernym_depth_cap(), definition_phase_from_subject_meaning(), caffeine_component_rejected_in_annotate(),
            writer_row_shape(), commit_locked_without_env()]
    # flatten depth cases
    out = []
    for r in rows:
        if r["name"] == "hypernym_depth_cap":
            out.append({"name": r["name"], "ok": r["ok"]})
        else:
            out.append({k: r[k] for k in r if k != "cases"})
    print(json.dumps(out, indent=1))
    sys.exit(0 if all(r["ok"] for r in out) else 1)


if __name__ == "__main__":
    main()
