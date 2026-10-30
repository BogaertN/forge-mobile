"""4.9.203 reference-prose self-seeding. Stdlib. No model. No per-question rows.

The 4.9.202 slot, subject, and claim checks are called unchanged. A pronoun
may stand for the entity only inside that entity's own article or entry.
Two independent hosts must state the same claim value. A period-dated source
may answer an identity or a historical date. A claim where time matters is
flagged and not admitted. A hazard question keeps a safety fact from a
government safety host and drops a recipe. Wikipedia is a pointer.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import rmc_engine_v1.self_seed_202 as seed202
from rmc_engine_v1.chi_hardening import luciferian_d_score
from rmc_engine_v1.echo_question import echo_against_question

CONFIG = Path(__file__).resolve().parent / "reference" / "trusted_sources_203.json"
UA = "ForgeMobile/4.9.203 (self-seed; no model)"
_BACKOFF: dict[str, dict[str, Any]] = {}
_CONFIG: dict[str, Any] | None = None
_SOURCES: list[dict[str, Any]] | None = None


def reset_backoff() -> None:
    _BACKOFF.clear()


def load_config() -> dict[str, Any]:
    global _CONFIG
    if _CONFIG is None:
        _CONFIG = json.loads(CONFIG.read_text(encoding="utf-8"))
    return _CONFIG


def merged_sources() -> list[dict[str, Any]]:
    global _SOURCES
    if _SOURCES is not None:
        return _SOURCES
    rows: dict[str, dict[str, Any]] = {}
    for row in seed202.load_config().get("sources") or []:
        rows[str(row.get("host") or "")] = dict(row)
    for row in load_config().get("sources") or []:
        host = str(row.get("host") or "")
        if host in rows:
            rows[host].update(row)
        else:
            rows[host] = dict(row)
    _SOURCES = [rows[host] for host in rows if host]
    _SOURCES.sort(key=lambda row: (int(row.get("trust") or 99), str(row.get("host"))))
    return _SOURCES


def source_for(url: str) -> dict[str, Any] | None:
    host = seed202.host_of(url)
    if not host:
        return None
    best = None
    best_len = -1
    for row in merged_sources():
        mark = str(row.get("host") or "")
        if host == mark or host.endswith("." + mark):
            if len(mark) > best_len:
                best = row
                best_len = len(mark)
    if not best or best.get("anchor") is False:
        return None
    return dict(best)


def is_catalog_url(url: str) -> bool:
    if not seed202.is_catalog_url(url):
        return False
    low = str(url or "").lower()
    for mark in load_config().get("narrative_url_marks") or []:
        if mark in low:
            return False
    return True


def entity_phrase(question: str) -> list[str]:
    slot = seed202.question_slot(question)
    return seed202.entity_tokens(question, slot)


def own_entry_of(doc: dict[str, Any], entity: list[str]) -> bool:
    if "own_entry" in doc and doc.get("own_entry") is not None:
        return bool(doc.get("own_entry"))
    title = seed202._norm(str(doc.get("title") or doc.get("entry") or ""))
    ent = seed202._norm(" ".join(entity))
    if not ent or not title:
        return False
    return ent == title or ent in title or title in ent


def period_of(title: str, doc: dict[str, Any]) -> int | None:
    if doc.get("period_year"):
        try:
            return int(doc.get("period_year"))
        except (TypeError, ValueError):
            return None
    low = str(title or "").lower()
    for row in load_config().get("period_marks") or []:
        if str(row.get("mark") or "") and str(row.get("mark")).lower() in low:
            return int(row.get("year") or 0) or None
    return None


def for_claim(sentence: str, entity: list[str], own: bool) -> tuple[str, bool]:
    """Pronoun subject becomes the entity only inside the entity's own entry."""
    if not own:
        return sentence, False
    bits = str(sentence or "").split(" ", 1)
    if len(bits) != 2:
        return sentence, False
    head = bits[0].strip(".,;:\"'").lower()
    pronouns = set(load_config().get("pronouns") or [])
    if head not in pronouns:
        return sentence, False
    return " ".join(entity) + " " + bits[1], True


def role_word(question: str) -> str:
    roles = set(seed202.load_config().get("time_roles") or [])
    found = ""
    for word in seed202._words(question):
        if word in roles:
            found = word
    return found


def role_binds(question: str, sentence: str) -> bool:
    role = role_word(question)
    if not role:
        return True
    forms = (load_config().get("role_forms") or {}).get(role) or [role]
    words = set(seed202._words(sentence))
    return any(form in words for form in forms)


def time_sensitive(question: str, slot: str, sentence: str, period: int | None) -> bool:
    words = set(seed202._words(question))
    if words & set(load_config().get("present_marks") or []):
        return True
    if not period:
        return False
    if slot == "identity":
        return False
    if slot == "time":
        years = seed202._years(sentence)
        if len(years) == 1 and int(years[0]) <= int(period):
            return False
        return True
    return True


def safety_host(src: dict[str, Any]) -> bool:
    host = str(src.get("host") or "")
    if host in set(load_config().get("safety_hosts") or []):
        return True
    return str(src.get("kind") or "") == "government-safety"


def _candidates(question: str, documents: list[dict[str, Any]], loop: int) -> dict[str, Any]:
    kept: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    pointers: list[str] = []
    entity = entity_phrase(question)
    slot = seed202.question_slot(question)
    for doc in documents:
        if not isinstance(doc, dict):
            continue
        url = str(doc.get("url") or "")
        text = str(doc.get("text") or "")
        if doc.get("sha256") and doc.get("sha256") != seed202.sha256_text(text):
            skipped.append({"url": url, "rule": "INTEGRITY"})
            continue
        if seed202.is_pointer_host(url) or doc.get("role") == "pointer":
            for found in seed202.extract_urls(text):
                if source_for(found) and not seed202.is_pointer_host(found):
                    pointers.append(found)
            skipped.append({"url": url, "rule": "WIKIPEDIA-POINTER"})
            continue
        src = source_for(url)
        if not src:
            skipped.append({"url": url, "rule": "NOT-ALLOWLISTED"})
            continue
        if is_catalog_url(url):
            skipped.append({"url": url, "rule": "CATALOG"})
            continue
        own = own_entry_of(doc, entity)
        period = period_of(str(doc.get("title") or ""), doc)
        digest = str(doc.get("sha256") or seed202.sha256_text(text))
        fetched = str(doc.get("fetched_at") or "")
        for sentence in seed202.split_sentences(text):
            if seed202.is_caption(sentence):
                skipped.append({"url": url, "rule": "CATALOG", "text": sentence[:180]})
                continue
            placed = seed202.sentence_placement(sentence)
            phi = placed.get("phi")
            if isinstance(phi, int) and luciferian_d_score(loop, phi) == 1.0:
                skipped.append({"url": url, "rule": "FORBIDDEN-5-8", "phi": phi, "loop": loop})
                continue
            if not isinstance(phi, int) or not seed202.phase_aligned(loop, phi):
                skipped.append({"url": url, "rule": "PHASE", "phi": phi, "loop": loop})
                continue
            safe = seed202.safety_of(question, sentence)
            if not safe["ok"]:
                skipped.append({"url": url, "rule": safe["rule"], "text": sentence[:180]})
                continue
            if slot == "effect" and not safety_host(src):
                skipped.append({"url": url, "rule": "SAFETY-HOST", "text": sentence[:180]})
                continue
            check, coref = for_claim(sentence, entity, own)
            fit = seed202.claim_of(question, check)
            if not fit or not fit.get("ok"):
                skipped.append({"url": url, "rule": (fit or {}).get("rule") or "SHAPE", "text": sentence[:180]})
                continue
            if slot == "time" and not role_binds(question, sentence):
                skipped.append({"url": url, "rule": "ROLE", "text": sentence[:180]})
                continue
            stale = time_sensitive(question, str(fit.get("slot") or slot), sentence, period)
            if stale:
                skipped.append({"url": url, "rule": "STALE", "text": sentence[:180], "period_year": period})
                continue
            echo = echo_against_question(question, sentence, rendered=True)
            kept.append({
                "text": sentence,
                "url": url,
                "host": str(src["host"]),
                "tier": int(src["tier"]),
                "trust": int(src["trust"]),
                "license": src.get("license"),
                "license_url": src.get("license_url"),
                "phi": phi,
                "concept": placed.get("concept"),
                "grace": seed202.grace_of(loop, phi),
                "delta": round(seed202.circular_delta(loop, phi), 6),
                "echo": echo["score"],
                "echo_pass": bool(echo["pass"]),
                "sha256": digest,
                "fetched_at": fetched,
                "fetch_sha256": str(doc.get("fetch_sha256") or digest),
                "safety": safe["rule"],
                "slot": fit["slot"],
                "claim": fit["claim"],
                "page_class": "reference",
                "own_entry": own,
                "coreference": coref,
                "period_year": period,
                "stale": False,
                "title": str(doc.get("title") or ""),
            })
    return {"kept": kept, "skipped": skipped, "pointers": pointers[:12]}


def _anchor_from(question: str, row: dict[str, Any], loop: int, support: list[dict[str, Any]]) -> dict[str, Any]:
    anchor = seed202._anchor_from(question, row, loop, support)
    provenance = dict(anchor.get("provenance") or {})
    provenance.update({
        "fetch_sha256": row.get("fetch_sha256") or row.get("sha256"),
        "period_year": row.get("period_year"),
        "stale": False,
        "historical_date": row.get("slot") == "time",
        "own_entry": bool(row.get("own_entry")),
        "coreference": bool(row.get("coreference")),
        "page_class": "reference",
        "title": row.get("title") or "",
        "ingestion_note": "Reference prose. Slot, subject, and claim checks are the 4.9.202 checks. Not a hand-written seed.",
    })
    anchor["provenance"] = provenance
    return anchor


def evaluate(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = dict(payload or {})
    if payload.get("reset") is True:
        reset_backoff()
    question = str(payload.get("question") or "").strip()
    now = float(payload.get("now") or 0)
    loop = seed202.loop_phi(question, payload.get("loop_phi"))
    base = {
        "ok": True,
        "build": "4.9.203",
        "question": question,
        "loop_phi": loop,
        "calls_llm": False,
        "network": False,
        "money": False,
        "dream_idle": False,
        "economy": False,
        "packs_gated": True,
        "christping": "gilligan-only",
        "christping_started": False,
        "wikipedia_anchor": False,
        "resonance_not_parsing": True,
        "coherence_formula_unchanged": True,
        "c_min": seed202.C_MIN,
        "echo_min": seed202.ECHO_MIN,
        "write_max": seed202.WRITE_MAX,
        "hard_stop": seed202.HARD_STOP,
        "admit_gate": False,
        "anchor": None,
        "route": "correction_queue",
    }
    if not question:
        return dict(base, ok=False, rule="SEED-EMPTY")
    gap = payload.get("gap")
    connected = int(payload.get("anchors_connected") or 0)
    if gap is False or (gap is None and connected > 0):
        return dict(base, rule="SEED-NOT-A-GAP", gap=False, anchors_connected=connected)
    row_block = _BACKOFF.get(seed202.question_key(question))
    if row_block and float(now) + 1e-9 < float(row_block["next_at"]):
        return dict(base, rule="SEED-BACKOFF", gap=True, quarantined=True, backoff={
            "blocked": True,
            "rule": "SEED-BACKOFF",
            "fails": row_block["fails"],
            "next_at": row_block["next_at"],
            "wait": round(float(row_block["next_at"]) - float(now), 3),
        })
    documents = [row for row in (payload.get("documents") or []) if isinstance(row, dict)]
    found = _candidates(question, documents, loop)
    passing = [row for row in found["kept"] if row["echo_pass"] and row.get("claim")]
    groups = seed202._claim_groups(passing)
    skip_rules = dict(Counter(str(row.get("rule") or "") for row in found["skipped"]))
    trace = {
        "kept": len(found["kept"]),
        "echo_pass": len(passing),
        "clusters": len(groups),
        "pointers": found["pointers"],
        "skipped": found["skipped"][:24],
        "skip_rules": skip_rules,
        "phases": sorted({row["phi"] for row in found["kept"]}),
    }
    if len(groups) > 1:
        failure = _remember_failure(question, now, "SEED-DISAGREEMENT")
        return dict(base, rule="SEED-DISAGREEMENT", gap=True, quarantined=True, trace=trace, backoff=failure, route="correction_queue")
    if not groups:
        reason = _empty_reason(found)
        failure = _remember_failure(question, now, reason)
        return dict(base, rule=reason, gap=True, quarantined=True, trace=trace, backoff=failure)
    claim, cluster = next(iter(groups.items()))
    hosts = {row["host"] for row in cluster}
    if len(hosts) < 2:
        failure = _remember_failure(question, now, "SEED-CORROBORATION")
        return dict(base, rule="SEED-CORROBORATION", gap=True, quarantined=True, trace=trace, backoff=failure, hosts=sorted(hosts), claim=claim)
    cluster.sort(key=lambda row: (row["tier"], row["trust"], -row["grace"], row["url"], row["text"]))
    chosen = cluster[0]
    if chosen["echo"] < seed202.ECHO_MIN:
        failure = _remember_failure(question, now, "SEED-ECHO")
        return dict(base, rule="SEED-ECHO", gap=True, quarantined=True, trace=trace, backoff=failure)
    anchor = _anchor_from(question, chosen, loop, cluster)
    _BACKOFF.pop(seed202.question_key(question), None)
    return dict(
        base,
        rule="SEED-CANDIDATE",
        gap=True,
        quarantined=False,
        anchor=anchor,
        trace=trace,
        hosts=sorted(hosts),
        tier=chosen["tier"],
        echo=chosen["echo"],
        claim=claim,
        route="anchor",
        corroborated=len(hosts) >= 2,
        period_year=chosen.get("period_year"),
        stale=False,
    )


def _empty_reason(found: dict[str, Any]) -> str:
    rules = {row.get("rule") for row in found["skipped"]}
    if found["kept"] and not any(row.get("echo_pass") for row in found["kept"]):
        return "SEED-ECHO"
    if "BIND" in rules and not found["kept"]:
        return "SEED-BIND"
    if "ROLE" in rules and not found["kept"]:
        return "SEED-ROLE"
    if "STALE" in rules and not found["kept"]:
        return "SEED-STALE"
    if "SHAPE" in rules and not found["kept"]:
        return "SEED-SHAPE"
    if "CATALOG" in rules and not found["kept"]:
        return "SEED-CATALOG"
    if "FORBIDDEN-5-8" in rules and not found["kept"]:
        return "SEED-FORBIDDEN"
    if "PHASE" in rules and not found["kept"]:
        return "SEED-PHASE"
    if "SAFETY-RECIPE" in rules and not found["kept"]:
        return "SEED-SAFETY"
    if "SAFETY-HOST" in rules and not found["kept"]:
        return "SEED-SAFETY-HOST"
    return "SEED-NO-SOURCE"


def _remember_failure(question: str, now: float, rule: str) -> dict[str, Any]:
    key = seed202.question_key(question)
    prev = _BACKOFF.get(key) or {"fails": 0}
    fails = int(prev["fails"]) + 1
    wait = seed202.BACKOFF_BASE * (2 ** (fails - 1))
    row = {"fails": fails, "next_at": float(now) + wait, "rule": rule}
    _BACKOFF[key] = row
    return {"fails": fails, "next_at": row["next_at"], "wait": wait}


def _http(url: str, timeout: float, limit: int) -> tuple[bytes, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,application/atom+xml,text/html,text/plain,*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read(limit)
        return raw, str(resp.headers.get("Content-Type") or "")


def _plain(text: str) -> str:
    plain = re.sub(r"(?is)<script.*?>.*?</script>|<style.*?>.*?</style>", " ", text)
    plain = re.sub(r"(?is)<[^>]+>", " ", plain)
    plain = plain.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#39;", "'").replace("&quot;", '"')
    return re.sub(r"\s+", " ", plain).strip()


def _window(text: str, entity: list[str], limit: int = 14000) -> str:
    if len(text) <= limit:
        return text
    low = text.lower()
    needles = [" ".join(entity)] if entity else []
    needles += [word for word in entity if len(word) > 3]
    idxs: list[int] = []
    for needle in needles:
        start = 0
        while needle and len(idxs) < 4:
            found = low.find(needle, start)
            if found < 0:
                break
            idxs.append(found)
            start = found + len(needle)
    if not idxs:
        return text[:limit]
    parts = []
    for found in idxs:
        parts.append(text[max(0, found - 600): found + 2800])
    return "\n".join(parts)[:limit]


def _entry(text: str, entity: list[str], title: str) -> tuple[str, bool]:
    marks = [str(mark) for mark in (load_config().get("collection_marks") or [])]
    if not any(mark in title.lower() for mark in marks):
        return text, False
    ent = seed202._norm(" ".join(entity))
    if not ent:
        return text, False
    lines = text.splitlines()
    heads: list[tuple[int, str]] = []
    for index, line in enumerate(lines):
        raw = line.strip()
        letters = [ch for ch in raw if ch.isalpha()]
        if not letters or len(raw) > 80 or len(letters) < 3:
            continue
        if sum(1 for ch in letters if ch.isupper()) / len(letters) < 0.8:
            continue
        heads.append((index, seed202._norm(raw)))
    for nth, (index, head) in enumerate(heads):
        if head and (head == ent or ent in head or head in ent):
            end = heads[nth + 1][0] if nth + 1 < len(heads) else min(len(lines), index + 80)
            return " ".join(lines[index:end]), True
    return text, False


def _epub_text(data: bytes) -> str:
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        return ""
    parts: list[str] = []
    total = 0
    for name in archive.namelist():
        lower = name.lower()
        if not lower.endswith((".html", ".htm", ".xhtml", ".txt")):
            continue
        raw = archive.read(name)
        parts.append(raw.decode("utf-8", "replace"))
        total += len(raw)
        if total > 2_000_000:
            break
    return "\n".join(parts)


def _abs(base: str, href: str) -> str:
    return urllib.parse.urljoin(base, href)


def _stamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _mentions(text: str, entity: list[str]) -> bool:
    if not entity:
        return True
    low = text.lower()
    needles = [word for word in entity if len(word) > 2]
    return all(word in low for word in needles) if needles else True


def _body(text: str) -> str:
    """Drop a Project Gutenberg license header so the window is the work."""
    upper = text.upper()
    for mark in (
        "START OF THE PROJECT GUTENBERG EBOOK",
        "START OF THIS PROJECT GUTENBERG EBOOK",
        "START OF THE PROJECT GUTENBERG",
        "START OF THIS PROJECT GUTENBERG",
    ):
        found = upper.find(mark)
        if found >= 0:
            newline = text.find("\n", found)
            return text[newline + 1 if newline >= 0 else found + len(mark):]
    return text


def _store(url: str, text: str, title: str, entity: list[str], own: bool, period: int | None, fetched: str, fetch_sha: str) -> dict[str, Any] | None:
    plain = _body(_plain(text))
    if not _mentions(plain, entity):
        return None
    window = _window(plain, entity)
    src = source_for(url) or {}
    return {
        "url": url,
        "role": "source",
        "text": window,
        "title": title,
        "own_entry": own,
        "period_year": period,
        "fetched_at": fetched,
        "sha256": seed202.sha256_text(window),
        "fetch_sha256": fetch_sha,
        "license": src.get("license"),
        "license_url": src.get("license_url"),
    }


def _gutenberg_acquire(ebook_id: str, entity: list[str], timeout: float, seen: set[str], title: str) -> dict[str, Any] | None:
    book = "https://www.gutenberg.org/ebooks/" + ebook_id + ".opds"
    if book in seen:
        return None
    seen.add(book)
    try:
        feed, _ctype = _http(book, timeout, 200000)
    except Exception:
        return None
    body = feed.decode("utf-8", "replace")
    if not title:
        title_match = re.search(r"<title>(.*?)</title>", body, flags=re.S)
        title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
    acquisitions: list[tuple[int, int, str]] = []
    for tag in re.findall(r"<link\b([^>]*)/?>", body):
        if "opds-spec.org/acquisition" not in tag:
            continue
        href_match = re.search(r'href="([^"]+)"', tag)
        type_match = re.search(r'type="([^"]+)"', tag)
        length_match = re.search(r'length="(\d+)"', tag)
        if not href_match:
            continue
        href = href_match.group(1)
        kind = (type_match.group(1) if type_match else "").lower()
        length = int(length_match.group(1)) if length_match else 9_000_000
        if "plain" in kind or href.endswith(".txt") or "utf-8" in href:
            rank = 0
        elif "html" in kind:
            rank = 1
        elif "epub" in kind and "noimages" in href:
            rank = 2
        elif "epub" in kind:
            rank = 3
        else:
            continue
        acquisitions.append((rank, length, href))
    if not acquisitions:
        return None
    acquisitions.sort()
    target = acquisitions[0][2]
    if target in seen:
        return None
    seen.add(target)
    try:
        data, ctype = _http(target, timeout, 4_000_000)
    except Exception:
        return None
    if "epub" in ctype or ".epub" in target:
        prose = _epub_text(data)
    else:
        prose = data.decode("utf-8", "replace")
    prose, headed = _entry(prose, entity, title)
    own = headed or own_entry_of({"title": title}, entity)
    return _store(target, prose, title, entity, own, period_of(title, {}), _stamp(), hashlib.sha256(data).hexdigest())


def _gutenberg(query: str, entity: list[str], timeout: float, seen: set[str]) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    spec = next(row for row in load_config().get("discovery") or [] if row.get("id") == "gutenberg-opds")
    search = str(spec["url"]).replace("{query}", urllib.parse.quote(query))
    try:
        raw, _ctype = _http(search, timeout, 200000)
    except Exception as exc:
        return [{"url": search, "role": "error", "error": type(exc).__name__ + ": " + str(exc)[:160], "text": ""}]
    xml = raw.decode("utf-8", "replace")
    ranked: list[tuple[int, str, str]] = []
    for entry in re.findall(r"<entry>(.*?)</entry>", xml, flags=re.S):
        title_match = re.search(r"<title>(.*?)</title>", entry, flags=re.S)
        title = re.sub(r"\s+", " ", title_match.group(1)).strip() if title_match else ""
        if title.lower() in {"authors", "subjects", "bookshelves", "books"}:
            continue
        href_match = re.search(r'href="([^"]+/\d+\.opds)"', entry)
        if not href_match:
            continue
        title_words = seed202._norm(title).split()
        hits = sum(1 for word in entity if word and word in title_words)
        if hits <= 0:
            continue
        coverage = hits / max(len(title_words), 1)
        ranked.append((-hits, -coverage, title, _abs(search, href_match.group(1))))
    ranked.sort()
    for _hits, _coverage, title, book in ranked[:3]:
        if book in seen:
            continue
        seen.add(book)
        try:
            feed, _ctype = _http(book, timeout, 200000)
        except Exception:
            continue
        body = feed.decode("utf-8", "replace")
        acquisitions: list[tuple[int, int, str]] = []
        for tag in re.findall(r"<link\b([^>]*)/?>", body):
            if "opds-spec.org/acquisition" not in tag:
                continue
            href_match = re.search(r'href="([^"]+)"', tag)
            type_match = re.search(r'type="([^"]+)"', tag)
            length_match = re.search(r'length="(\d+)"', tag)
            if not href_match:
                continue
            href = href_match.group(1)
            kind = (type_match.group(1) if type_match else "").lower()
            length = int(length_match.group(1)) if length_match else 9_000_000
            if "plain" in kind or href.endswith(".txt") or "utf-8" in href:
                rank = 0
            elif "html" in kind:
                rank = 1
            elif "epub" in kind and "noimages" in href:
                rank = 2
            elif "epub" in kind:
                rank = 3
            else:
                continue
            acquisitions.append((rank, length, href))
        if not acquisitions:
            continue
        acquisitions.sort()
        target = acquisitions[0][2]
        if target in seen:
            continue
        seen.add(target)
        try:
            data, ctype = _http(target, timeout, 4_000_000)
        except Exception:
            continue
        fetched = _stamp()
        if "epub" in ctype or target.endswith(".epub.noimages") or ".epub" in target:
            prose = _epub_text(data)
        else:
            prose = data.decode("utf-8", "replace")
        fetch_sha = hashlib.sha256(data).hexdigest()
        prose, headed = _entry(prose, entity, title)
        own = headed or own_entry_of({"title": title}, entity)
        stored = _store(target, prose, title, entity, own, period_of(title, {}), fetched, fetch_sha)
        if stored:
            docs.append(stored)
    return docs


def _links_from_html(page: str, base: str) -> list[str]:
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', page, flags=re.I)
    out = []
    for href in hrefs:
        if href.startswith("#") or href.startswith("javascript:"):
            continue
        out.append(_abs(base, href))
    return out


def _take_pages(urls: list[str], entity: list[str], timeout: float, seen: set[str], limit: int) -> list[dict[str, Any]]:
    docs = []
    hosts: set[str] = set()
    for url in urls:
        if len(docs) >= limit or url in seen:
            continue
        ebook = re.search(r"gutenberg\.org/ebooks/(\d+)", url or "")
        if ebook and not any(mark in url for mark in (".epub", ".txt", ".opds", ".html")):
            stored = _gutenberg_acquire(ebook.group(1), entity, timeout, seen, "")
            if stored:
                docs.append(stored)
            continue
        src = source_for(url)
        if not src or seed202.is_pointer_host(url) or is_catalog_url(url):
            continue
        if url.lower().endswith(".pdf") or str(src.get("host")) in hosts:
            continue
        try:
            data, ctype = _http(url, timeout, 500000)
        except Exception:
            continue
        if "html" not in ctype and "plain" not in ctype and "json" not in ctype and "xml" not in ctype:
            continue
        text = data.decode("utf-8", "replace")
        if "recaptcha" in text[:400].lower():
            continue
        seen.add(url)
        hosts.add(str(src.get("host")))
        fetched = _stamp()
        title = ""
        title_match = re.search(r"<title>(.*?)</title>", text, flags=re.I | re.S)
        if title_match:
            title = re.sub(r"\s+", " ", title_match.group(1)).strip()
        prose, headed = _entry(text, entity, title)
        own = headed or own_entry_of({"title": title}, entity)
        stored = _store(url, prose, title, entity, own, period_of(title, {}), fetched, hashlib.sha256(data).hexdigest())
        if stored:
            docs.append(stored)
    return docs


def _loc(query: str, entity: list[str], timeout: float, seen: set[str]) -> list[dict[str, Any]]:
    spec = next(row for row in load_config().get("discovery") or [] if row.get("id") == "loc-search")
    url = str(spec["url"]).replace("{query}", urllib.parse.quote(query))
    try:
        raw, _ctype = _http(url, timeout, 400000)
        payload = json.loads(raw.decode("utf-8", "replace"))
    except Exception as exc:
        return [{"url": url, "role": "error", "error": type(exc).__name__ + ": " + str(exc)[:160], "text": ""}]
    urls = []
    for item in payload.get("results") or []:
        ident = str(item.get("url") or item.get("id") or "")
        if ident:
            urls.append(ident)
    return _take_pages(urls, entity, timeout, seen, 2)


def _medline(query: str, entity: list[str], timeout: float, seen: set[str]) -> list[dict[str, Any]]:
    spec = next(row for row in load_config().get("discovery") or [] if row.get("id") == "medline")
    url = str(spec["url"]).replace("{query}", urllib.parse.quote(query))
    try:
        raw, _ctype = _http(url, timeout, 200000)
    except Exception as exc:
        return [{"url": url, "role": "error", "error": type(exc).__name__ + ": " + str(exc)[:160], "text": ""}]
    urls = re.findall(r'<document\b[^>]*\burl="([^"]+)"', raw.decode("utf-8", "replace"))
    return _take_pages(urls, entity, timeout, seen, 2)


def _html_search(spec: dict[str, Any], query: str, entity: list[str], timeout: float, seen: set[str]) -> list[dict[str, Any]]:
    url = str(spec.get("url") or "").replace("{query}", urllib.parse.quote(query))
    try:
        raw, _ctype = _http(url, timeout, 250000)
    except Exception as exc:
        return [{"url": url, "role": "error", "error": type(exc).__name__ + ": " + str(exc)[:160], "text": ""}]
    page = raw.decode("utf-8", "replace")
    return _take_pages(_links_from_html(page, url), entity, timeout, seen, 1)


def _wiki(query: str, entity: list[str], timeout: float, seen: set[str]) -> list[dict[str, Any]]:
    docs: list[dict[str, Any]] = []
    try:
        search = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "list": "search", "format": "json", "srlimit": "1", "srsearch": query,
        })
        raw, _ctype = _http(search, timeout, 100000)
        hits = ((json.loads(raw.decode("utf-8", "replace")).get("query") or {}).get("search") or [])
        title = str(hits[0].get("title") or "") if hits else ""
        links: list[str] = []
        if title:
            ext = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
                "action": "query", "prop": "extlinks", "format": "json", "ellimit": "200",
                "titles": title, "redirects": "1",
            })
            page, _ctype = _http(ext, timeout, 300000)
            for block in ((json.loads(page.decode("utf-8", "replace")).get("query") or {}).get("pages") or {}).values():
                for row in block.get("extlinks") or []:
                    links.append(str(row.get("*") or row.get("url") or ""))
        pointer = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")) if title else search
        body = "\n".join(links)
        docs.append({
            "url": pointer,
            "text": body,
            "role": "pointer",
            "title": title,
            "fetched_at": _stamp(),
            "sha256": seed202.sha256_text(body),
            "own_entry": False,
        })
        docs.extend(_take_pages(links, entity, timeout, seen, 3))
    except Exception as exc:
        docs.append({"url": "https://en.wikipedia.org/", "role": "error", "error": type(exc).__name__ + ": " + str(exc)[:160], "text": ""})
    return docs


def fetch_documents(question: str, timeout: float = 18.0) -> list[dict[str, Any]]:
    """Find reference prose for the question's entity. No per-question URL."""
    entity = entity_phrase(question)
    query = " ".join(entity) or question
    docs: list[dict[str, Any]] = []
    seen: set[str] = set()
    docs.extend(_gutenberg(query, entity, timeout, seen))
    docs.extend(_loc(query, entity, timeout, seen))
    docs.extend(_medline(query, entity, timeout, seen))
    for spec in load_config().get("discovery") or []:
        if spec.get("kind") == "html":
            docs.extend(_html_search(spec, query, entity, timeout, seen))
    docs.extend(_wiki(query, entity, timeout, seen))
    return docs


def stage(question: str | None = None) -> dict[str, Any]:
    return {
        "build": "4.9.203",
        "rule": "SELF-SEED-STAGE",
        "question": question or "",
        "admit_gate": False,
        "calls_llm": False,
        "network": False,
        "money": False,
        "dream_idle": False,
        "economy": False,
        "packs_gated": True,
        "wikipedia_anchor": False,
        "resonance_not_parsing": True,
        "c_min": seed202.C_MIN,
        "echo_min": seed202.ECHO_MIN,
        "write_max": seed202.WRITE_MAX,
        "sources": len(merged_sources()),
        "discovery": [row.get("id") for row in load_config().get("discovery") or []],
    }


def run(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = dict(payload or {})
    op = str(payload.get("op") or "evaluate")
    if op == "stage":
        return stage(str(payload.get("question") or ""))
    if op == "fetch":
        return {"ok": True, "calls_llm": False, "network": True, "documents": fetch_documents(str(payload.get("question") or ""))}
    if op == "reset":
        reset_backoff()
        return {"ok": True, "rule": "SEED-RESET", "calls_llm": False}
    return evaluate(payload)


if __name__ == "__main__":
    import sys

    raw = sys.stdin.read()
    data = json.loads(raw) if raw.strip() else {"op": "stage"}
    json.dump(run(data), sys.stdout)
    sys.stdout.write("\n")
