"""Creative gather. Before a poem or a story is composed, Athena asks every enabled
source about the topic and the atoms the lexicon gives that topic.

Admission is the existing rule: two independent publishers, a clause Gilligan can
read, a clean drift measure, and the scale check. One publisher can feed imagery.
That clause is marked single-source and is not a fact. The creative text is not stored.
"""
from __future__ import annotations

import json
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
from pathlib import Path
from typing import Any, Callable

from rmc_engine_v1.athena_props import kind_accepts
from rmc_engine_v1.athena_sources_222 import FetchMiss, UA
from rmc_engine_v1.athena_sources_223 import FETCHERS, render_gloss, source_rows
from rmc_engine_v1.drift_policy import classify_drift, drift_measure
from rmc_engine_v1.self_seed_202 import claim_of

Http = Callable[[str], str]
_LEX: dict[str, Any] | None = None
_EXT: dict[str, Any] | None = None
_PHYSICAL = {
    "noun.animal", "noun.artifact", "noun.object", "noun.location", "noun.plant",
    "noun.substance", "noun.body", "noun.food", "noun.shape",
}
_STOP = {
    "a", "an", "the", "of", "and", "or", "with", "for", "to", "in", "on", "by", "from",
    "that", "which", "its", "their", "as", "at", "into", "over", "under", "than", "more",
    "other", "such", "any", "some", "one", "who", "is", "are", "was", "were", "be", "it",
    "this", "these", "those", "not", "no", "having", "usually", "often",
}
_ROLE = {
    "noun.location": "habitat",
    "noun.substance": "habitat",
    "noun.attribute": "property",
    "noun.quantity": "property",
    "noun.state": "property",
    "noun.body": "part",
    "noun.artifact": "part",
    "noun.animal": "part",
    "noun.plant": "part",
    "noun.food": "part",
    "noun.act": "use",
    "noun.process": "use",
}


def _lex() -> dict[str, Any]:
    global _LEX
    if _LEX is None:
        path = Path(__file__).resolve().parents[2] / "data" / "lexicon.json"
        try:
            _LEX = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            _LEX = {}
    return _LEX


def _ext() -> dict[str, Any]:
    global _EXT
    if _EXT is None:
        path = Path(__file__).resolve().parents[2] / "data" / "lexicon-ext.json"
        _EXT = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return _EXT


def _entries(word: str) -> list[Any]:
    core = (_lex().get("L") or {}).get(word) or []
    extra = (_ext().get("L") or {}).get(word) or []
    return list(core) + list(extra)


def _noun(word: str) -> tuple[str, str, str] | None:
    names = (_lex().get("meta") or {}).get("lexnames") or []
    senses = []
    for entry in _entries(word):
        if not entry or entry[0] != "n" or not entry[1]:
            continue
        for item in entry[1]:
            if not item:
                continue
            sid, idx, gloss = item[0], item[1], item[2]
            kind = names[idx] if isinstance(idx, int) and idx < len(names) else ""
            senses.append((str(sid), str(kind), str(gloss or "")))
    if not senses:
        return None
    physical = [s for s in senses if s[1] in _PHYSICAL]
    return physical[0] if physical else senses[0]


def _verb(word: str) -> bool:
    for entry in _entries(word):
        if entry and entry[0] == "v":
            return True
    return False


def _lemma(sid: str) -> str:
    raw = (_ext().get("N") or {}).get(sid) or (_lex().get("N") or {}).get(sid) or ""
    return str(raw).replace("_", " ").split(",")[0].strip().lower()


def _chain(sid: str, limit: int = 4) -> list[str]:
    out = []
    seen = {sid}
    cur = sid
    core = _lex().get("H") or {}
    extra = _ext().get("H") or {}
    for _ in range(limit):
        nxt = ((extra.get(cur) or core.get(cur) or [None])[0])
        if not nxt or nxt in seen:
            break
        seen.add(nxt)
        lemma = _lemma(nxt)
        if lemma:
            out.append(lemma)
        cur = nxt
    return out


def topic_atoms(topic: str) -> list[dict[str, str]]:
    """Kind, parts, properties, behaviors, habitats and relations from the lexicon entry."""
    head = str(topic or "").strip().lower()
    sense = _noun(head)
    if not sense:
        return []
    sid, _kind_name, gloss = sense
    found: list[dict[str, str]] = []
    seen = {head}

    def add(role: str, word: str, phrase: bool = False) -> None:
        w = str(word or "").strip().lower()
        if not w or w in seen or w in _STOP or (" " in w and not phrase):
            return
        seen.add(w)
        found.append({"role": role, "head": w})

    chain = _chain(sid)
    if chain:
        add("kind", chain[0], phrase=True)
    for rel in chain[1:3]:
        add("relation", rel)
    for raw in gloss.lower().replace(";", " ").replace(",", " ").split():
        word = "".join(ch for ch in raw if ch.isalpha())
        if len(word) < 3 or word in _STOP or word == head:
            continue
        if _verb(word) and not any(entry and entry[0] in {"a", "s"} for entry in _entries(word)):
            add("behavior", word)
            continue
        other = _noun(word)
        if not other:
            continue
        role = _ROLE.get(other[1], "")
        if role:
            add(role, word)
    return found[:6]


def _local_docs(topic: str, atoms: list[dict[str, str]]) -> list[dict[str, Any]]:
    docs = []
    heads = [topic]
    kind = next((a["head"] for a in atoms if a.get("role") == "kind"), "")
    if kind:
        heads.append(kind)
    for head in heads:
        sense = _noun(head)
        if not sense:
            continue
        sid, _name, gloss = sense
        label = head[:1].upper() + head[1:]
        text = render_gloss(label, gloss)
        if not text:
            continue
        docs.append({
            "url": "https://en-word.net/id/oewn-" + sid,
            "text": text,
            "source_id": "oewn",
            "publisher": "Open English WordNet",
            "asked": "What is a " + head + "?",
            "local": True,
        })
    return docs


def _http_once(url: str, timeout: float) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,text/html;q=0.8,*/*;q=0.5"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read(1_000_000)
            return raw.decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            raise FetchMiss(url) from exc
        raise


def _enabled() -> list[tuple[str, dict[str, Any]]]:
    out = []
    for sid, row in source_rows().items():
        if not row.get("enabled") or sid == "wikidata" or sid not in FETCHERS:
            continue
        out.append((sid, row))
    return out


def fan_out(questions: list[str], http: Http | None = None, timeout: float = 2.5, budget: float = 12.0) -> dict[str, Any]:
    """Every enabled connector, for every question, at once. A miss on one source does not stop the others."""
    rows = _enabled()
    jobs = [(q, sid, row) for q in questions for sid, row in rows]
    docs: list[dict[str, Any]] = []
    errors: list[dict[str, str]] = []
    seen: set[str] = set()
    locks: dict[str, threading.Lock] = {}
    for _sid, row in rows:
        locks.setdefault(str(row.get("host") or _sid), threading.Lock())
    end = time.time() + budget

    def run(question: str, sid: str, row: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
        lock = locks[str(row.get("host") or sid)]
        getter = http or (lambda url: _http_once(url, timeout))
        def limited(url: str) -> str:
            with lock:
                return getter(url)
        try:
            if sid == "oewn":
                got = FETCHERS[sid](question, limited, None)
            else:
                got = FETCHERS[sid](question, limited)
        except FetchMiss:
            return [], []
        except Exception as exc:
            return [], [{"source": sid, "error": type(exc).__name__}]
        out = []
        for doc in got or []:
            if not isinstance(doc, dict) or doc.get("role") != "source" or not doc.get("text"):
                continue
            out.append({
                "url": doc.get("url") or "",
                "text": str(doc.get("text")),
                "source_id": sid,
                "publisher": str(doc.get("publisher") or row.get("publisher") or sid),
                "counts": row.get("agreement_counts") is not False,
                "asked": question,
            })
        return out, []

    def take(pair: tuple[list[dict[str, Any]], list[dict[str, str]]]) -> None:
        docs.extend(pair[0])
        errors.extend(pair[1])

    workers = min(8, max(1, len(jobs)))
    try:
        pool = ThreadPoolExecutor(max_workers=workers)
    except Exception:
        pool = None
    if pool is None:
        for question, sid, row in jobs:
            if time.time() > end:
                break
            take(run(question, sid, row))
    else:
        futs = [pool.submit(run, q, sid, row) for q, sid, row in jobs]
        try:
            for fut in as_completed(futs, timeout=budget):
                try:
                    take(fut.result())
                except Exception as exc:
                    errors.append({"source": "gather", "error": type(exc).__name__})
        except TimeoutError:
            for fut in futs:
                fut.cancel()
        try:
            pool.shutdown(wait=False, cancel_futures=True)
        except TypeError:
            pool.shutdown(wait=False)
    kept = []
    for doc in docs:
        key = str(doc.get("publisher") or "") + "\n" + str(doc.get("text") or "")
        if key in seen:
            continue
        seen.add(key)
        kept.append(doc)
    return {"documents": kept, "errors": errors[:24], "queried": [sid for sid, _row in rows], "calls_llm": False}


def _publishers(cluster: list[dict[str, Any]]) -> tuple[int, list[str]]:
    trusted: list[str] = []
    candidate: list[str] = []
    for doc in cluster:
        pub = str(doc.get("publisher") or "").strip()
        if not pub or pub.lower() in {"wikipedia", "wikidata"}:
            continue
        if doc.get("counts", True):
            if pub not in trusted:
                trusted.append(pub)
        elif pub not in candidate:
            candidate.append(pub)
    names = list(trusted)
    # A source that does not count on its own still counts once a trusted publisher agrees.
    if trusted:
        for pub in candidate:
            if pub not in names:
                names.append(pub)
    elif candidate:
        names = candidate[:1]
    return len(names), names


def _height(sentence: str) -> float | None:
    import re
    m = re.search(r"(\d+(?:\.\d+)?)\s*(mm|cm|meters|meter|metres|metre|m)\b", sentence.lower())
    if not m:
        return None
    if not any(w in sentence.lower() for w in ("tall", "high", "height")):
        return None
    n = float(m.group(1))
    unit = m.group(2)
    if unit == "cm":
        n /= 100.0
    elif unit == "mm":
        n /= 1000.0
    return n


def _drift_clean() -> str:
    measured = drift_measure([], None, 1)
    region = classify_drift({"eps": measured["eps"], "path": [], "forbidden": measured["forbidden"]})
    return str(region.get("region") or "")


def admit_documents(topic: str, documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group agreeing clauses. Two publishers admit. One publisher is imagery only."""
    clusters: dict[str, list[dict[str, Any]]] = {}
    drift = _drift_clean()
    for doc in documents:
        if not isinstance(doc, dict) or not doc.get("text"):
            continue
        question = str(doc.get("asked") or ("What is a " + topic + "?"))
        for sentence in [s.strip() for s in str(doc["text"]).split(". ") if s.strip()][:4]:
            if not sentence.endswith("."):
                sentence += "."
            fit = claim_of(question, sentence)
            if not fit or not fit.get("ok") or not fit.get("claim"):
                continue
            row = dict(doc)
            row["text"] = sentence
            clusters.setdefault(str(fit["claim"]), []).append(row)
    clauses = []
    for claim, cluster in clusters.items():
        k, names = _publishers(cluster)
        if k < 1:
            continue
        text = cluster[0]["text"]
        head = topic
        asked = str(cluster[0].get("asked") or "")
        if asked.lower().startswith("what is a "):
            head = asked[9:].strip(" ?").lower() or topic
        height = _height(text)
        scale = "ok"
        if height is not None and not kind_accepts(head, [{"property": "height", "value": height}]):
            scale = "held"
        admitted = k >= 2 and scale == "ok" and drift == "clean"
        single = k == 1 and scale == "ok" and drift == "clean"
        clauses.append({
            "text": text,
            "claim": claim,
            "head": head,
            "source_count": k,
            "publishers": names,
            "admitted": admitted,
            "single_source": single,
            "fact": admitted,
            "gilligan": "GILLIGAN-STRUCTURE-OK",
            "scale": scale,
            "drift": drift,
            "store": "local" if admitted else None,
            "hosted_eligible": admitted,
            "supabase_write": False,
            "calls_llm": False,
        })
    clauses.sort(key=lambda c: (not c["admitted"], -c["source_count"], c["text"]))
    return clauses


def gather(topic: str, http: Http | None = None, documents: list[dict[str, Any]] | None = None,
           timeout: float = 2.5, budget: float = 12.0, lexicon: bool = True, network: bool | None = None) -> dict[str, Any]:
    head = str(topic or "").strip().lower()
    try:
        atoms = topic_atoms(head)
    except Exception:
        atoms = []
    questions = []
    for word in [head] + [a["head"] for a in atoms if a.get("role") != "behavior"]:
        q = "What is a " + word + "?"
        if word and q not in questions:
            questions.append(q)
    do_net = (documents is None) if network is None else bool(network)
    remote = {"documents": [], "errors": [], "queried": []}
    if do_net:
        try:
            remote = fan_out(questions, http=http, timeout=timeout, budget=budget)
        except Exception as exc:
            remote = {"documents": [], "errors": [{"source": "gather", "error": type(exc).__name__ + ": " + str(exc)[:80]}], "queried": []}
    docs = [dict(d) for d in (remote.get("documents") or []) if isinstance(d, dict)]
    for extra in documents or []:
        if isinstance(extra, dict) and extra.get("text"):
            docs.append(dict(extra))
    if lexicon:
        try:
            docs.extend(_local_docs(head, atoms))
        except Exception:
            pass
    clauses = admit_documents(head, docs)
    queried = list(remote.get("queried") or [])
    for doc in docs:
        sid = str(doc.get("source_id") or "")
        if sid and sid not in queried:
            queried.append(sid)
    return {
        "topic": head,
        "atoms": atoms,
        "questions": questions,
        "queried": queried,
        "errors": remote.get("errors") or [],
        "clauses": clauses,
        "admitted": sum(1 for c in clauses if c.get("admitted")),
        "single": sum(1 for c in clauses if c.get("single_source")),
        "calls_llm": False,
        "supabase_write": False,
        "creative_persisted": False,
    }
