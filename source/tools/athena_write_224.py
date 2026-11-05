"""4.9.224 Athena writer skeleton (Nic pt139u/t140u).

Takes SEED-CANDIDATE evaluate results (or re-runs the dry-run fetch+meaning path) and calls
public.athena_anchor_insert one row at a time. Default is dry-run (p_commit=false): the RPC
validates Echo >= 0.97, two independent hosts, source URL, licence, content hash and forces
packet.eps = 0, then returns the row Athena would write WITHOUT inserting.

Real writes need: FORGE_ATHENA_COMMIT=1 AND --commit on the CLI AND Nic's go-ahead. The service
role key is read from SUPABASE_SERVICE_ROLE_KEY in the environment and is never printed.
usage:
  FORGE_OEWN_DIR=... python3 tools/athena_write_224.py --dry-run out.json --anchors=kb.json "What is gravity?" ...
  FORGE_ATHENA_COMMIT=1 python3 tools/athena_write_224.py --commit out.json ...   # refused unless both flags
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

# Refuse --commit before any network or key use unless FORGE_ATHENA_COMMIT=1 (Nic t140u).
if "--commit" in sys.argv and os.environ.get("FORGE_ATHENA_COMMIT") != "1":
    print(json.dumps({"ok": False, "rule": "ATHENA-COMMIT-LOCKED", "hint": "set FORGE_ATHENA_COMMIT=1 only after Nic's go-ahead"}))
    raise SystemExit(2)

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "engine"))
from rmc_engine_v1 import athena_sources_223 as A  # noqa: E402
from rmc_engine_v1 import meaning_223 as M  # noqa: E402
from rmc_engine_v1 import resonance_recall as rr  # noqa: E402
from tools.athena_dryrun_223 import anchored_concepts, run_one  # noqa: E402

ECHO_MEMORY_MIN = 0.97
SUPABASE_URL = os.environ.get("SUPABASE_URL") or "https://hqcvywujrygbnaowgwln.supabase.co"


PUBLISHER_NAMES = {
    "ebi.ac.uk": "ChEBI, EMBL-EBI",
    "bipm.org": "BIPM (Bureau International des Poids et Mesures), SI Brochure",
    "nist.gov": "NIST CODATA",
    "nih.gov": "NCI Thesaurus (NCIt) via PubChem, NIH/NLM",
    "en-word.net": "Open English WordNet",
}


def _attribution(license_: str, source_url: str, origin: str | None) -> str | None:
    """CC BY needs a credit line that names the publisher and the source, not a bare URL (4.9.225)."""
    lic = (license_ or "").lower()
    if "cc by" in lic or lic.startswith("cc-by"):
        host = source_url.split("/")[2].lower() if source_url.count("/") >= 2 else ""
        host = host[4:] if host.startswith("www.") else host
        name = PUBLISHER_NAMES.get(host) or PUBLISHER_NAMES.get(".".join(host.split(".")[-2:])) or origin or host
        return "Credit: %s, %s (%s), licensed %s." % (name, source_url, host, license_)
    return None


def row_from_candidate(result: dict) -> dict | None:
    """Build the kb.anchors insert payload from a dry-run / evaluate SEED-CANDIDATE result."""
    if result.get("evaluate_rule") != "SEED-CANDIDATE":
        return None
    echo = float(result.get("echo") or 0)
    if echo < ECHO_MEMORY_MIN:
        return None
    # Rebuild the evaluate anchor by re-calling evaluate is already done; use fields on result.
    # The dry-run stores anchor_text etc.; for a full anchor we re-evaluate from sources kept.
    return None  # filled by build_row below


def build_row(question: str, evaluate_res: dict, meaning_payload: dict, subject: dict) -> dict:
    anchor = evaluate_res.get("anchor") or {}
    prov = dict(anchor.get("provenance") or {})
    hosts = list(evaluate_res.get("hosts") or prov.get("independent_hosts") or [])
    hosts = sorted({h for h in hosts if h and h != "geonames.org"})
    text = str(anchor.get("text") or "")
    content_sha = str(prov.get("content_sha256") or hashlib.sha256(text.encode()).hexdigest())
    license_ = str(anchor.get("license") or prov.get("license") or "")
    source_url = str(anchor.get("source_url") or prov.get("source_url") or "")
    sense = (meaning_payload or {}).get("subject_sense") or subject.get("sense")
    digest = hashlib.sha256((question + "\n" + text).encode()).hexdigest()[:18]
    attr = _attribution(license_, source_url, prov.get("origin"))
    return {
        "anchor_id": "athena-" + digest,
        "id": "athena-" + digest,
        "text": text,
        "packet": anchor.get("packet"),
        "concepts": anchor.get("concepts") or ([] if not subject.get("concept") else [subject["concept"]]),
        "provenance": prov,
        "contributor": str(anchor.get("contributor") or ("self-seed:" + (prov.get("source") or "athena"))),
        "license": license_,
        "license_url": anchor.get("license_url") or prov.get("license_url"),
        "source_url": source_url,
        "revision": str(anchor.get("revision") or content_sha[:12]),
        "content_sha256": content_sha,
        "fetched_at": prov.get("fetched_at"),
        "asking_question": question,
        "meaning_id": sense,
        "meaning_trace": {
            "schema": "FORGE-ATHENA-MEANING/v1",
            "subject_sense": sense,
            "subject_phi": subject.get("phi"),
            "phi_from": subject.get("phi_from"),
            "agree": ((evaluate_res.get("trace") or {}).get("meaning") or {}).get("agree"),
            "contradict": ((evaluate_res.get("trace") or {}).get("meaning") or {}).get("contradict"),
            "unplaced": ((evaluate_res.get("trace") or {}).get("meaning") or {}).get("unplaced"),
            "claim": evaluate_res.get("claim"),
            "hypernym_agree_depth": M.HYPERNYM_AGREE_DEPTH,
        },
        "independent_hosts": hosts,
        "attribution": attr,
        "archived_from": prov.get("archived_from"),
    }


def call_writer(row: dict, commit: bool) -> dict:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        return {"ok": False, "rule": "ATHENA-NO-SERVICE-KEY", "written": False}
    body = json.dumps({"p_row": row, "p_commit": bool(commit)}).encode()
    req = urllib.request.Request(
        SUPABASE_URL.rstrip("/") + "/rest/v1/rpc/athena_anchor_insert",
        data=body,
        headers={
            "Content-Type": "application/json",
            "apikey": key,
            "Authorization": "Bearer " + key,
            "Prefer": "return=representation",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:800]
        return {"ok": False, "rule": "ATHENA-HTTP-%s" % e.code, "error": err, "written": False}


def process_one(q: str, anchored: dict, table: dict, commit: bool) -> dict:
    from rmc_engine_v1 import self_seed_202 as ss
    concepts = rr.question_concepts(q, set(anchored))
    have = sorted(c for c in concepts if c in anchored)
    gap = not have
    subject = M.resolve_subject(q, table)
    fetched = A.fetch_all(q, subject=subject)
    docs = fetched["documents"]
    meaning = M.annotate(q, docs, subject)
    res = ss.evaluate({"question": q, "documents": docs, "gap": True, "reset": True, "meaning": meaning})
    # mirror dry-run verdict labels for the report
    if not gap:
        verdict = "PINNED (already anchored: " + ", ".join(have) + ")"
    elif subject.get("state") == "ask":
        verdict = "ASK"
    elif res.get("rule") == "SEED-CANDIDATE":
        echo = float(res.get("echo") or 0)
        verdict = "WOULD ADMIT (not written)" if echo >= ECHO_MEMORY_MIN else "HOLD memory write (Echo %.3f < 0.97)" % echo
    else:
        verdict = "HOLD " + str(res.get("rule"))
    out = {
        "question": q, "verdict": verdict, "evaluate_rule": res.get("rule"), "gap": gap,
        "subject": {k: subject.get(k) for k in ("label", "attr", "thing", "state", "sense", "concept", "phi", "phi_from")},
        "claim": res.get("claim"), "hosts": res.get("hosts"), "echo": res.get("echo"),
        "loop_phi": res.get("loop_phi"), "loop_from": res.get("loop_from"),
        "agreement": (res.get("trace") or {}).get("meaning"),
        "writes": False, "commit_requested": commit, "ask": None,
    }
    if subject.get("state") == "ask":
        from tools.athena_dryrun_223 import ask_question
        out["ask"] = ask_question(subject)
        out["candidates"] = subject.get("candidates") or []
    if res.get("rule") != "SEED-CANDIDATE" or not gap or subject.get("state") == "ask":
        out["writer"] = {"ok": False, "rule": "ATHENA-NOT-ADMIT", "written": False}
        return out
    if float(res.get("echo") or 0) < ECHO_MEMORY_MIN:
        out["writer"] = {"ok": False, "rule": "ATHENA-ECHO-LOW", "echo": res.get("echo"), "written": False}
        return out
    if not res.get("anchor"):
        out["writer"] = {"ok": False, "rule": "ATHENA-NO-ANCHOR", "written": False}
        return out
    row = build_row(q, res, meaning, subject)
    out["row"] = {
        "anchor_id": row["anchor_id"], "text": row["text"], "source_url": row["source_url"],
        "license": row["license"], "meaning_id": row["meaning_id"], "independent_hosts": row["independent_hosts"],
        "echo": (row["provenance"] or {}).get("echo"), "Phi": (row["packet"] or {}).get("Phi"),
        "band": ((row["packet"] or {}).get("band") or {}).get("band"),
        "attribution": row["attribution"], "archived_from": row["archived_from"],
        "claim": res.get("claim"),
    }
    writer = call_writer(row, commit=commit)
    out["writer"] = writer
    out["writes"] = bool(writer.get("written"))
    return out


def main() -> None:
    args = sys.argv[1:]
    out_path = None
    anchors_path = None
    commit = False
    dry_run = True
    qs = []
    while args:
        a = args.pop(0)
        if a == "--commit":
            commit = True
            dry_run = False
        elif a == "--dry-run":
            dry_run = True
            commit = False
        elif a.startswith("--anchors="):
            anchors_path = a.split("=", 1)[1]
        elif a.endswith(".json") and out_path is None and not a.startswith("-"):
            out_path = a
        else:
            qs.append(a)
    if commit:
        # belt and braces: both CLI flag and env must be set (Nic t140u: no live writes until go-ahead)
        if os.environ.get("FORGE_ATHENA_COMMIT") != "1":
            print(json.dumps({"ok": False, "rule": "ATHENA-COMMIT-LOCKED", "hint": "set FORGE_ATHENA_COMMIT=1 only after Nic's go-ahead"}))
            sys.exit(2)
        commit = True
    else:
        commit = False
    if not out_path or not qs:
        print("usage: athena_write_224.py [--dry-run|--commit] out.json [--anchors=kb.json] Q...", file=sys.stderr)
        sys.exit(2)
    anchored, n_rows = anchored_concepts(anchors_path)
    table = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
    results = [process_one(q, anchored, table, commit=commit) for q in qs]
    body = {
        "schema": "FORGE-ATHENA-WRITE/224",
        "commit": commit,
        "dry_run": not commit,
        "writes": any(r.get("writes") for r in results),
        "anchors_rows": n_rows,
        "results": results,
    }
    json.dump(body, open(out_path, "w"), indent=1, ensure_ascii=False)
    would = [r for r in results if (r.get("writer") or {}).get("rule") == "ATHENA-DRY-RUN" or (r.get("writer") or {}).get("written")]
    print(json.dumps({
        "ok": True, "commit": commit, "would_write": len(would), "n": len(results),
        "rules": sorted({(r.get("writer") or {}).get("rule") for r in results}),
    }))


if __name__ == "__main__":
    main()
