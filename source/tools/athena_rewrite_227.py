"""4.9.227 Athena maintenance (Nic t142u): rows Athena wrote under the 4.9.226 keying (concepts read from letter patterns
in the source sentence) are re-run through Athena's own pipeline with the same gates (Echo >= 0.97, two independent
publishers, subject meaning). A subject that re-admits is superseded through app.athena_anchor_supersede (old row
snapshotted in kb.anchor_maintenance, new row's provenance names what it replaced). A subject that no longer admits is
retired through app.athena_anchor_retire and left unwritten. A row already keyed to its subject is left alone.
Never invents text: the replacement is the row Athena's run builds from the fetched sources.

usage: athena_rewrite_227.py [--commit] written_ids.json out.json
--commit needs FORGE_ATHENA_COMMIT=1 too. Dry run by default (the RPCs validate and change nothing)."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, os.path.join(ROOT, "engine"))
sys.path.insert(0, ROOT)

from tools import athena_write_224 as W  # noqa: E402
from rmc_engine_v1 import meaning_223 as M  # noqa: E402

RELEASE = "4.9.227"
PUBLISHABLE_KEY = "sb_publishable_xcWU1fjhcZe0VHEb4LCirA_HlRPjVXI"
REASON_SUPERSEDE = ("4.9.227 re-key: written under 4.9.226, which keyed a definition from concepts in the source sentence "
                    "({old}); Athena re-ran the subject with the same gates and keys it from the subject meaning ({new}).")
REASON_RETIRE = ("4.9.227 re-key: written under 4.9.226 with concepts {old} from the source sentence; Athena's re-run of the "
                 "subject did not admit ({why}), so the row is retired and nothing is written.")


def _rpc(name: str, body: dict) -> dict:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not key:
        return {"ok": False, "rule": "ATHENA-NO-SERVICE-KEY"}
    req = urllib.request.Request(W.SUPABASE_URL.rstrip("/") + "/rest/v1/rpc/" + name, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json", "apikey": key, "Authorization": "Bearer " + key},
                                 method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"ok": False, "rule": "ATHENA-HTTP-%s" % e.code, "error": e.read().decode()[:800]}


def _current(anchor_id: str) -> dict | None:
    url = W.SUPABASE_URL.rstrip("/") + "/rest/v1/kb_anchors?select=id,text,concepts,contributor,packet&id=eq." + anchor_id
    # the public read view, with the app's publishable key (public by design; src/sb_sync.js)
    req = urllib.request.Request(url, headers={"apikey": PUBLISHABLE_KEY})
    with urllib.request.urlopen(req, timeout=60) as resp:
        rows = json.loads(resp.read().decode())
    return rows[0] if rows else None


def rerun(q: str, table: dict) -> dict:
    """Athena's own run for the subject: fetch, annotate, evaluate, build the row. Same gates as athena_write_224."""
    from rmc_engine_v1 import self_seed_202 as ss
    subject = M.resolve_subject(q, table)
    fetched = W.A.fetch_all(q, subject=subject)
    docs = fetched["documents"]
    meaning = M.annotate(q, docs, subject)
    res = ss.evaluate({"question": q, "documents": docs, "gap": True, "reset": True, "meaning": meaning})
    out = {"subject_key": subject.get("key"), "subject_state": subject.get("state"), "rule": res.get("rule"), "echo": res.get("echo"),
           "hosts": res.get("hosts"), "claim": res.get("claim")}
    if subject.get("state") == "ask":
        out["why"] = "the subject has more than one meaning (ask)"
    elif res.get("rule") != "SEED-CANDIDATE":
        out["why"] = str(res.get("rule"))
    elif float(res.get("echo") or 0) < W.ECHO_MEMORY_MIN:
        out["why"] = "Echo %.3f < %.2f" % (float(res.get("echo") or 0), W.ECHO_MEMORY_MIN)
    elif not res.get("anchor"):
        out["why"] = "no anchor"
    else:
        row = W.build_row(q, res, meaning, subject)
        if row.get("concepts") != [subject.get("key")]:
            out["why"] = "the built row is not keyed to its subject (%s)" % row.get("concepts")
        else:
            out["row"] = row
    return out


def main() -> None:
    args = [a for a in sys.argv[1:]]
    commit = "--commit" in args
    args = [a for a in args if a != "--commit"]
    if commit and os.environ.get("FORGE_ATHENA_COMMIT") != "1":
        print(json.dumps({"ok": False, "rule": "ATHENA-COMMIT-LOCKED"}))
        sys.exit(2)
    if len(args) != 2:
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    written = json.load(open(args[0], encoding="utf-8"))
    table = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
    results = []
    for w in written:
        q, old_id = w["q"], w["id"]
        cur = _current(old_id)
        item = {"question": q, "old_id": old_id, "old_concepts": (cur or {}).get("concepts"), "present": bool(cur)}
        if not cur:
            item["action"] = "none (row not present)"
            results.append(item)
            continue
        run = rerun(q, table)
        item["rerun"] = {k: v for k, v in run.items() if k != "row"}
        key = run.get("subject_key")
        if cur.get("concepts") == [key]:
            item["action"] = "keep (already keyed to its subject %s)" % key
        elif run.get("row"):
            row = run["row"]
            reason = REASON_SUPERSEDE.format(old=json.dumps(cur.get("concepts")), new=json.dumps(row.get("concepts")))
            res = _rpc("athena_anchor_supersede", {"p_anchor_id": old_id, "p_row": row, "p_reason": reason, "p_release": RELEASE, "p_commit": commit})
            item.update(action="supersede", new_id=row.get("anchor_id"), new_concepts=row.get("concepts"), same_text=row.get("text") == cur.get("text"),
                        new_text=row.get("text"), rpc=res)
        else:
            reason = REASON_RETIRE.format(old=json.dumps(cur.get("concepts")), why=run.get("why"))
            res = _rpc("athena_anchor_retire", {"p_anchor_id": old_id, "p_reason": reason, "p_release": RELEASE, "p_commit": commit})
            item.update(action="retire", why=run.get("why"), rpc=res)
        results.append(item)
    body = {"schema": "FORGE-ATHENA-REWRITE/227", "commit": commit, "release": RELEASE, "calls_llm": False, "results": results}
    json.dump(body, open(args[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps([{k: r.get(k) for k in ("question", "action", "old_concepts", "new_concepts", "why")} | {"rule": (r.get("rpc") or {}).get("rule")} for r in results], ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
