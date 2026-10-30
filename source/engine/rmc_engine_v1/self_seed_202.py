"""4.9.202 self-seeding anchors. Stdlib. No model. No per-question rows.

A question Ask holds for no premise and no anchor becomes a research target.
Sentences are placed by the lexicon and kept when they phase-align with the
question loop inside π/4. An anchor needs one tier-1 source or two independent
trusted hosts. The same gates apply: Echo ≥ 0.85 against the question,
drift ≤ 0.35, C ≥ 0.87 on the re-ask, and Φ5→Φ8 is forbidden. Wikipedia is a
pointer, never an anchor. A failure is quarantined and is not retried until
the backoff clock moves.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rmc_engine_v1.chi_hardening import luciferian_d_score
from rmc_engine_v1.echo_question import _tokens as echo_tokens
from rmc_engine_v1.echo_question import echo_against_question
from rmc_engine_v1.lexicon_resonance import packet, primary_concept, resultant, tokens
from rmc_engine_v1.mobile_config import THRESHOLDS

CONFIG = Path(__file__).resolve().parent / "reference" / "trusted_sources_202.json"
C_MIN = float(THRESHOLDS["C_min"])
ECHO_MIN = float(THRESHOLDS["echo_min"])
WRITE_MAX = float(THRESHOLDS["drift_quarantine"])
HARD_STOP = float(THRESHOLDS["hard_stop"])
PI_OVER_4 = math.pi / 4
BACKOFF_BASE = 60.0
UA = "ForgeMobile/4.9.202 (self-seed; no model)"
_BACKOFF: dict[str, dict[str, Any]] = {}
_CONFIG: dict[str, Any] | None = None


def reset_backoff() -> None:
    _BACKOFF.clear()


def load_config() -> dict[str, Any]:
    global _CONFIG
    if _CONFIG is None:
        _CONFIG = json.loads(CONFIG.read_text(encoding="utf-8"))
    return _CONFIG


def phase_aligned(a: int | None, b: int | None) -> bool:
    """Same window as resonance_recall.phase_aligned. The suite locks the two."""
    if a is None or b is None:
        return False
    if not (1 <= int(a) <= 9 and 1 <= int(b) <= 9):
        return False
    left = ((int(a) - 1) / 9.0) * math.tau
    right = ((int(b) - 1) / 9.0) * math.tau
    delta = abs(left - right) % math.tau
    delta = min(delta, math.tau - delta)
    return delta <= PI_OVER_4 + 1e-12


def circular_delta(a: int, b: int) -> float:
    left = ((int(a) - 1) / 9.0) * math.tau
    right = ((int(b) - 1) / 9.0) * math.tau
    delta = abs(left - right) % math.tau
    return min(delta, math.tau - delta)


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def question_key(question: str) -> str:
    return sha256_text(str(question or "").strip().lower())[:16]


def host_of(url: str) -> str:
    raw = str(url or "").strip()
    if "://" not in raw:
        raw = "https://" + raw
    host = urllib.parse.urlparse(raw).netloc.lower()
    if host.startswith("www."):
        host = host[4:]
    return host


def source_for(url: str) -> dict[str, Any] | None:
    host = host_of(url)
    if not host:
        return None
    for row in load_config().get("sources") or []:
        mark = str(row.get("host") or "")
        if host == mark or host.endswith("." + mark):
            return dict(row)
    return None


def is_pointer_host(url: str) -> bool:
    host = host_of(url)
    for mark in load_config().get("pointer_hosts") or []:
        if host == mark or host.endswith("." + mark):
            return True
    return False


def loop_phi(question: str, override: Any = None) -> int:
    if override is not None and str(override) != "":
        try:
            n = int(override)
        except (TypeError, ValueError):
            n = 1
        return n if 1 <= n <= 9 else 1
    from rmc_engine_v1.phase_parser import parse_phase

    state = (parse_phase(question) or {}).get("phase_state") or {}
    primary = str(state.get("phase_primary") or "Φ1")
    if len(primary) == 2 and primary[0] == "Φ" and primary[1] in "123456789":
        return int(primary[1])
    return 1


def _letter_phi(text: str) -> int | None:
    from rmc_engine_v1.lexicon_resonance import _load

    letters = _load().get("letters") or {}
    indexes: list[int] = []
    for tok in tokens(text):
        for ch in tok.upper():
            spec = letters.get(ch) if isinstance(letters, dict) else None
            if not isinstance(spec, dict):
                continue
            phase = str(spec.get("phase") or "")
            if len(phase) == 2 and phase[1] in "123456789":
                indexes.append(int(phase[1]))
    phi, _how = resultant(indexes)
    return phi if isinstance(phi, int) else None


def sentence_placement(text: str) -> dict[str, Any]:
    """Lexicon packet for the sentence. Unknown words use the letter resultant."""
    cid = primary_concept(text)
    phi = None
    if cid:
        row = packet(cid) or {}
        if isinstance(row.get("Phi"), int):
            phi = int(row["Phi"])
    if phi is None:
        phi = _letter_phi(text)
    return {"phi": phi, "concept": cid, "placed_by": "lexicon"}


def split_sentences(text: str) -> list[str]:
    plain = re.sub(r"(?is)<script.*?>.*?</script>|<style.*?>.*?</style>", " ", str(text or ""))
    plain = re.sub(r"(?is)<[^>]+>", " ", plain)
    plain = plain.replace("&nbsp;", " ").replace("&amp;", "&").replace("&#39;", "'")
    plain = re.sub(r"\s+", " ", plain).strip()
    out: list[str] = []
    for part in re.split(r"(?<=[.!?])\s+", plain):
        sentence = part.strip()
        if 35 <= len(sentence) <= 420:
            out.append(sentence)
        if len(out) >= 40:
            break
    return out


def extract_urls(text: str) -> list[str]:
    found = re.findall(r"https?://[^\s<>\"']+", str(text or ""))
    out = []
    seen = set()
    for url in found:
        clean = url.rstrip(").,;]")
        if clean not in seen:
            seen.add(clean)
            out.append(clean)
    return out


def grace_of(loop: int, phi: int | None) -> float:
    if phi is None or not phase_aligned(loop, phi):
        return 0.0
    return round(math.cos(circular_delta(loop, phi)) ** 2, 6)


def safety_of(question: str, sentence: str) -> dict[str, Any]:
    cfg = load_config()
    toks = echo_tokens(question)
    mix = "mix" in toks or "mixing" in str(question or "").lower()
    low = sentence.lower()
    procedure = any(mark in low for mark in (cfg.get("procedure_marks") or []))
    safety = any(mark in low for mark in (cfg.get("safety_marks") or []))
    quantity = re.search(r"\b\d+\s*(cup|tbsp|tablespoon|teaspoon|ml|gram|grams)\b", low) is not None
    if mix and (quantity or (procedure and not safety)):
        return {"ok": False, "rule": "SAFETY-RECIPE", "mix": True}
    return {"ok": True, "rule": "SAFETY-FACT" if mix and safety else "SAFETY-PLAIN", "mix": mix}


def is_gap(row: dict[str, Any] | None) -> bool:
    """Held for no premise and no connected anchor. Echo holds are not gaps."""
    row = row if isinstance(row, dict) else {}
    if row.get("product_reply") or row.get("admitted") is True:
        return False
    if row.get("gap") is True and int(row.get("anchors_connected") or 0) == 0:
        return True
    lang = row.get("language_core") if isinstance(row.get("language_core"), dict) else {}
    if lang.get("gap") is True and int(lang.get("anchors_connected") or 0) == 0:
        return True
    return False


def _backoff_block(question: str, now: float) -> dict[str, Any] | None:
    row = _BACKOFF.get(question_key(question))
    if not row:
        return None
    if float(now) + 1e-9 < float(row["next_at"]):
        return {
            "blocked": True,
            "rule": "SEED-BACKOFF",
            "fails": row["fails"],
            "next_at": row["next_at"],
            "wait": round(float(row["next_at"]) - float(now), 3),
        }
    return None


def _remember_failure(question: str, now: float, rule: str) -> dict[str, Any]:
    key = question_key(question)
    prev = _BACKOFF.get(key) or {"fails": 0}
    fails = int(prev["fails"]) + 1
    wait = BACKOFF_BASE * (2 ** (fails - 1))
    row = {"fails": fails, "next_at": float(now) + wait, "rule": rule}
    _BACKOFF[key] = row
    return {"fails": fails, "next_at": row["next_at"], "wait": wait}


def _clear_failure(question: str) -> None:
    _BACKOFF.pop(question_key(question), None)


def _candidates(question: str, documents: list[dict[str, Any]], loop: int) -> dict[str, Any]:
    kept: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    pointers: list[str] = []
    for doc in documents:
        if not isinstance(doc, dict):
            continue
        url = str(doc.get("url") or "")
        text = str(doc.get("text") or "")
        if doc.get("sha256") and doc.get("sha256") != sha256_text(text):
            skipped.append({"url": url, "rule": "INTEGRITY"})
            continue
        if is_pointer_host(url) or doc.get("role") == "pointer":
            for found in extract_urls(text):
                if source_for(found) and not is_pointer_host(found):
                    pointers.append(found)
            skipped.append({"url": url, "rule": "WIKIPEDIA-POINTER"})
            continue
        src = source_for(url)
        if not src:
            skipped.append({"url": url, "rule": "NOT-ALLOWLISTED"})
            continue
        digest = str(doc.get("sha256") or sha256_text(text))
        fetched = str(doc.get("fetched_at") or "")
        for sentence in split_sentences(text):
            placed = sentence_placement(sentence)
            phi = placed.get("phi")
            if isinstance(phi, int) and luciferian_d_score(loop, phi) == 1.0:
                skipped.append({"url": url, "rule": "FORBIDDEN-5-8", "phi": phi, "loop": loop})
                continue
            if not isinstance(phi, int) or not phase_aligned(loop, phi):
                skipped.append({"url": url, "rule": "PHASE", "phi": phi, "loop": loop})
                continue
            safe = safety_of(question, sentence)
            if not safe["ok"]:
                skipped.append({"url": url, "rule": safe["rule"], "text": sentence[:180]})
                continue
            echo = echo_against_question(question, sentence, rendered=True)
            kept.append({
                "text": sentence,
                "url": url,
                "host": str(src["host"]),
                "tier": int(src["tier"]),
                "trust": int(src["trust"]),
                "license": src["license"],
                "license_url": src["license_url"],
                "phi": phi,
                "concept": placed.get("concept"),
                "grace": grace_of(loop, phi),
                "delta": round(circular_delta(loop, phi), 6),
                "echo": echo["score"],
                "echo_pass": bool(echo["pass"]),
                "sha256": digest,
                "fetched_at": fetched,
                "safety": safe["rule"],
            })
    return {"kept": kept, "skipped": skipped[:24], "pointers": pointers[:12]}


def _clusters(rows: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    clusters: list[list[dict[str, Any]]] = []
    for row in rows:
        placed = False
        for cluster in clusters:
            if all(phase_aligned(row["phi"], other["phi"]) for other in cluster):
                cluster.append(row)
                placed = True
                break
        if not placed:
            clusters.append([row])
    return clusters


def _anchor_from(question: str, row: dict[str, Any], loop: int, support: list[dict[str, Any]]) -> dict[str, Any]:
    digest = sha256_text(question + "\n" + row["text"])[:18]
    sfe = {"Phi": int(row["phi"]), "eps": 0.0, "mu": 1.0}
    hosts = sorted({item["host"] for item in support})
    provenance = {
        "source": row["host"],
        "source_url": row["url"],
        "license": row["license"],
        "license_url": row["license_url"],
        "fetched_at": row["fetched_at"],
        "content_sha256": row["sha256"],
        "asking_question": question,
        "tier": row["tier"],
        "independent_hosts": hosts,
        "lexicon_concept": row["concept"],
        "lexicon_phi": row["phi"],
        "question_loop": loop,
        "delta": row["delta"],
        "echo": row["echo"],
        "wikipedia_anchor": False,
        "contributor": "self-seed:" + row["host"],
        "ingestion_note": "Sentence kept by lexicon phase alignment inside pi/4. Not a hand-written seed.",
    }
    return {
        "id": "self-" + digest,
        "text": row["text"],
        "sfe": sfe,
        "packet": {
            "schema": "FORGE-RESONANCE-PACKET/v1",
            "Phi": sfe["Phi"],
            "eps": 0.0,
            "mu": 1.0,
            "sfe": sfe,
            "placed_by": "athena",
            "standing": "anchor",
            "phi_basis": "lexicon packet phase-aligned with the question loop",
            "concept": row["concept"],
        },
        "tier": "anchor",
        "state": "anchor",
        "trust": "trusted",
        "license": row["license"],
        "license_url": row["license_url"],
        "source_url": row["url"],
        "revision": (row["sha256"] or "")[:12],
        "provenance": provenance,
        "contributor": "self-seed:" + row["host"],
        "concepts": [row["concept"]] if row["concept"] else [],
    }


def evaluate(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = dict(payload or {})
    if payload.get("reset") is True:
        reset_backoff()
    question = str(payload.get("question") or "").strip()
    now = float(payload.get("now") or 0)
    loop = loop_phi(question, payload.get("loop_phi"))
    base = {
        "ok": True,
        "build": "4.9.202",
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
        "c_min": C_MIN,
        "echo_min": ECHO_MIN,
        "write_max": WRITE_MAX,
        "hard_stop": HARD_STOP,
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
    blocked = _backoff_block(question, now)
    if blocked:
        return dict(base, rule="SEED-BACKOFF", gap=True, backoff=blocked, quarantined=True)
    documents = [row for row in (payload.get("documents") or []) if isinstance(row, dict)]
    found = _candidates(question, documents, loop)
    passing = [row for row in found["kept"] if row["echo_pass"]]
    clusters = _clusters(passing)
    trace = {
        "kept": len(found["kept"]),
        "echo_pass": len(passing),
        "clusters": len(clusters),
        "pointers": found["pointers"],
        "skipped": found["skipped"],
        "phases": sorted({row["phi"] for row in found["kept"]}),
    }
    if len(clusters) > 1:
        failure = _remember_failure(question, now, "SEED-DISAGREEMENT")
        return dict(base, rule="SEED-DISAGREEMENT", gap=True, quarantined=True, trace=trace, backoff=failure, route="correction_queue")
    if not clusters:
        reason = "SEED-NO-SOURCE"
        rules = {row.get("rule") for row in found["skipped"]}
        if found["kept"] and not passing:
            reason = "SEED-ECHO"
        elif "FORBIDDEN-5-8" in rules and not found["kept"]:
            reason = "SEED-FORBIDDEN"
        elif "PHASE" in rules and not found["kept"]:
            reason = "SEED-PHASE"
        elif "SAFETY-RECIPE" in rules and not found["kept"]:
            reason = "SEED-SAFETY"
        failure = _remember_failure(question, now, reason)
        return dict(base, rule=reason, gap=True, quarantined=True, trace=trace, backoff=failure)
    cluster = clusters[0]
    hosts = {row["host"] for row in cluster}
    tier1 = [row for row in cluster if row["tier"] == 1]
    if not tier1 and len(hosts) < 2:
        failure = _remember_failure(question, now, "SEED-CORROBORATION")
        return dict(base, rule="SEED-CORROBORATION", gap=True, quarantined=True, trace=trace, backoff=failure, hosts=sorted(hosts))
    cluster.sort(key=lambda row: (row["tier"], row["trust"], -row["grace"], row["url"], row["text"]))
    chosen = cluster[0]
    if chosen["echo"] < ECHO_MIN:
        failure = _remember_failure(question, now, "SEED-ECHO")
        return dict(base, rule="SEED-ECHO", gap=True, quarantined=True, trace=trace, backoff=failure)
    anchor = _anchor_from(question, chosen, loop, cluster)
    _clear_failure(question)
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
        route="anchor",
        corroborated=len(hosts) >= 2 or chosen["tier"] == 1,
    )


def _http_get(url: str, timeout: float) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json,text/html"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read(400000)
        charset = "utf-8"
        ctype = str(resp.headers.get("Content-Type") or "")
        if "charset=" in ctype:
            charset = ctype.split("charset=", 1)[1].split(";", 1)[0].strip() or "utf-8"
        return raw.decode(charset, "replace")


def fetch_documents(question: str, timeout: float = 18.0) -> list[dict[str, Any]]:
    """Trusted-source fetch. Wikipedia is consulted only to find an allowlisted URL."""
    docs: list[dict[str, Any]] = []
    seen: set[str] = set()
    query = " ".join(sorted(echo_tokens(question))) or question
    loc = "https://www.loc.gov/search/?q=" + urllib.parse.quote(query) + "&fo=json&c=4"
    try:
        payload = json.loads(_http_get(loc, timeout))
        for item in payload.get("results") or []:
            ident = str(item.get("id") or "")
            if not source_for(ident) or ident in seen:
                continue
            text = ". ".join([str(item.get("title") or "")] + [str(x) for x in (item.get("description") or [])])
            if len(text) < 35:
                continue
            seen.add(ident)
            docs.append({
                "url": ident,
                "text": text,
                "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                "sha256": sha256_text(text),
                "role": "source",
            })
    except Exception as exc:
        docs.append({"url": loc, "role": "error", "error": type(exc).__name__ + ": " + str(exc)[:160], "text": ""})
    try:
        search = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
            "action": "query", "list": "search", "format": "json", "srlimit": "1", "srsearch": query,
        })
        title = ""
        found = json.loads(_http_get(search, timeout))
        hits = ((found.get("query") or {}).get("search") or [])
        if hits:
            title = str(hits[0].get("title") or "")
        links: list[str] = []
        if title:
            ext = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
                "action": "query", "prop": "extlinks", "format": "json", "ellimit": "200",
                "titles": title, "redirects": "1",
            })
            page = json.loads(_http_get(ext, timeout))
            for block in ((page.get("query") or {}).get("pages") or {}).values():
                for row in block.get("extlinks") or []:
                    links.append(str(row.get("*") or row.get("url") or ""))
        pointer = "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_")) if title else search
        docs.append({
            "url": pointer,
            "text": "\n".join(links),
            "role": "pointer",
            "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "sha256": sha256_text("\n".join(links)),
        })
        fetched = 0
        for url in links:
            if fetched >= 2 or not source_for(url) or is_pointer_host(url) or url.lower().endswith(".pdf"):
                continue
            if host_of(url) in {host_of(doc.get("url") or "") for doc in docs}:
                continue
            try:
                body = _http_get(url, timeout)
            except Exception:
                continue
            if "recaptcha" in body[:400].lower():
                continue
            seen.add(url)
            docs.append({
                "url": url,
                "text": body,
                "role": "source",
                "fetched_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                "sha256": sha256_text(body),
            })
            fetched += 1
    except Exception as exc:
        docs.append({"url": "https://en.wikipedia.org/", "role": "error", "error": type(exc).__name__ + ": " + str(exc)[:160], "text": ""})
    return docs


def stage(question: str | None = None) -> dict[str, Any]:
    """Ask-trace summary. It does not fetch and it does not admit."""
    return {
        "build": "4.9.202",
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
        "c_min": C_MIN,
        "echo_min": ECHO_MIN,
        "write_max": WRITE_MAX,
        "sources": len(load_config().get("sources") or []),
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
