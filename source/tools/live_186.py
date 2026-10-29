"""Cold pass and two fill passes of the 60 questions. Research stays quarantined."""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

from rmc_engine_v1.rmc_core import run

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS = json.loads((ROOT / "tools" / "dryrun_182_questions.json").read_text(encoding="utf-8"))["questions"]
SEED = json.loads((ROOT / "data" / "ask_183_memory.json").read_text(encoding="utf-8"))
CACHE = ROOT / "data" / "ask_186_research.json"
UA = "ForgeMobile/4.9.186 (quarantined research excerpt; not an admitted fact)"


def fetch(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def excerpt(question: str) -> dict:
    search = "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=" + urllib.parse.quote(question)
    try:
        found = fetch(search)
    except Exception as exc:
        return {"question": question, "text": "", "error": str(exc)[:160]}
    hits = ((found.get("query") or {}).get("search") or [])
    if not hits:
        return {"question": question, "text": "", "title": ""}
    title = hits[0].get("title") or ""
    page = "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&redirects=1&titles=" + urllib.parse.quote(title)
    try:
        body = fetch(page)
    except Exception as exc:
        return {"question": question, "text": "", "title": title, "error": str(exc)[:160]}
    pages = ((body.get("query") or {}).get("pages") or {})
    text = ""
    for page_body in pages.values():
        text = str(page_body.get("extract") or "")
        title = page_body.get("title") or title
        break
    return {
        "question": question,
        "title": title,
        "url": "https://en.wikipedia.org/wiki/" + title.replace(" ", "_"),
        "text": text[:500],
        "quarantined": True,
        "admitted": False,
    }


def load_research() -> list[dict]:
    if CACHE.exists():
        return json.loads(CACHE.read_text(encoding="utf-8"))["rows"]
    rows = [excerpt(q) for _topic, q in QUESTIONS]
    CACHE.write_text(json.dumps({
        "note": "Quarantined research.web excerpts for the 4.9.186 passes. Not admitted. Not a seed.",
        "rows": rows,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    return rows


def one(question: str, memory: dict) -> dict:
    row = run({"question": question, "live": True, "memory": memory})
    comp = row.get("coherence_components") or {}
    echo = row.get("echo") or {}
    return {
        "question": question,
        "route": row.get("route"),
        "C": row.get("coherence"),
        "memory_fit": comp.get("memory_fit"),
        "drift": row.get("drift"),
        "echo": echo.get("score"),
        "echo_pass": echo.get("pass"),
        "admitted": bool(row.get("product_reply")),
        "reply": row.get("reply"),
        "calls_llm": row.get("calls_llm"),
        "anchor": ((row.get("quarantine_curation") or [{}])[0].get("rule")),
    }


def main() -> None:
    research = {row["question"]: row for row in load_research()}
    extra: list[dict] = []
    seen: set[str] = set()
    passes = []
    for n in range(3):
        rows = []
        admitted = 0
        for topic, question in QUESTIONS:
            memory = json.loads(json.dumps(SEED))
            memory["hosted"] = list(memory.get("hosted") or []) + extra
            web = research.get(question) or {}
            if web.get("text"):
                memory["research"] = [{"id": "web-" + question[:24], "text": web["text"], "quarantined": True}]
            item = one(question, memory)
            item["topic"] = topic
            item["n"] = len(rows) + 1
            rows.append(item)
            if item["admitted"]:
                admitted += 1
                text = item["reply"]
                if text and text not in seen:
                    seen.add(text)
                    extra.append({
                        "id": "admit-" + str(len(extra)),
                        "text": text,
                        "sfe": {"Phi": 9, "eps": item["drift"], "mu": 1},
                        "provenance": {"question": question, "contributor": "athena"},
                        "contributor": "athena",
                    })
        passes.append({
            "pass": n,
            "name": "cold" if n == 0 else "pass " + str(n + 1),
            "admitted": admitted,
            "held": len(rows) - admitted,
            "echo_pass": sum(1 for r in rows if r["echo_pass"]),
            "rows": rows,
        })
        print(passes[-1]["name"], "admitted", admitted, "echo", passes[-1]["echo_pass"], flush=True)
    out = ROOT / "tools" / "live_186_results.json"
    out.write_text(json.dumps({"passes": passes}, ensure_ascii=False), encoding="utf-8")
    print("wrote", out)


if __name__ == "__main__":
    main()
