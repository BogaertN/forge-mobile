"""4.9.229 Athena's recursive, self-improving gap-filling runner (Nic pt146u "the continuous gap filler"; t148u "recursive
self improving"; t149u "read my papers"). Deterministic: no LLM, no self-modifying code, no weights. It improves by what it
KNOWS, not by changing itself: every admitted fact is written back into memory, and that memory decides the next gaps.

Design source (see /workspace/b229/papers/FINDINGS.md; newest paper wins):
  - RMC 08.6 Algorithm 6 Memory Writeback: M_{t+1} = M_t U {trace, manifest, output, validation, feedback}; the next loop
    starts from M_{t+1}; failed / pending events are stored WITH their status and are never authoritative; append-only log.
  - Phase-Coherent Memory Architecture (2026-10-30): a held loop goes warm (SPC) then cold as a Ghost Loop - preserved, never
    deleted; Gate 7 "System Capacity Evolution": a held loop is resurrected only when the system has grown enough to close it
    (resurrection is not a plain retry); resurrection_limit 5; circuit breaker after 3 consecutive failures.
  - Gilligan Agent Core System 17: resurrection is triggered by an echo match between new material and the held loop.
  - Corrected Build Gap List / Roadmap Phase 4: active-loop persistence (loop id, open/closed, unresolved branches, cursor);
    learn only by evidence-bearing promotion; quarantined (warm / ghost / dream) material never feeds Ask or stable memory.
  - EMN: two independent lineages; repetition is not independence; ancestry links so dependents can be found on revision.

One CYCLE:
  1. worklist = queued questions (phone curation queue, Athena queue with meaning pins, earlier held reports, cold held rows)
     + gaps discovered from memory in earlier cycles; every gap keeps its parent and depth (ancestry).
  2. pick the eligible gaps: new ones; a warm hold only when Gate 7 opens for it (the knowledge epoch moved since it was held
     AND new memory echo-matches it, or the source registry changed); needs_meaning waits for a pin (Forge asks, never guesses).
  3. run each through Athena's own path, tools/athena_write_224.process_one (fetch -> meaning agreement (4.9.228) -> evaluate
     -> RPC writer). The runner never writes by itself and never relaxes two-publisher agreement.
  4. writeback: an admitted fact becomes memory (written rows in --commit; dry-run admissions are PROVISIONAL, labelled
     hypothetical, never anchored truth) and the knowledge epoch goes up; a hold is stored warm with its reason and evidence
     fingerprint; a repeated identical hold with no new evidence, or resurrection_limit reached, goes cold (ghost, kept).
  5. discover: from each new memory item derive the next gaps - the genus of the admitted meaning (its sense inherited along
     the WordNet chain, so it is pinned, not guessed), follow-on attributes for that KIND that an enabled publisher answers
     (data/athena_followons_229.json, keyed by sense ids), and proper names in the admitted sentence that memory lacks.
  The run loops cycles until: nothing eligible (empty) | a cycle made no progress (no_progress) | breaker open | cycle bound.

Writes: DRY-RUN by default. A real write needs the existing double lock: FORGE_ATHENA_COMMIT=1 AND --commit. Separate process:
never loaded by the phone page, so it cannot block Ask and nothing is written on page load. The service key is never printed.

usage:
  FORGE_OEWN_DIR=... python3 tools/athena_runner_229.py [--commit] [--cycles=10] [--max-items=5] [--max-depth=3]
      [--loop --interval=600 --passes=N] [--state=state.json] [--log=log.jsonl] [--anchors=kb.json] [--out=report.json] WORKLIST.json ...
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
import re
import sys
import time
from typing import Any, Callable

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "engine"))

SCHEMA = "FORGE-ATHENA-RUNNER/229"
RESURRECTION_LIMIT = 5          # PCMA resurrection_limit
BREAKER_FAILS = 3               # PCMA circuit breaker: consecutive failures
BREAKER_RECOVERY_S = 600        # recovery timeout before the next cycle may run
MAX_ERRORS = 3                  # transient fetch/runner errors before the gap is held warm
MAX_DEPTH = 3                   # bounded recursion: discovery depth from a queued question
MAX_FOLLOWONS = 6               # new gaps from one memory item
MAX_ATTEMPTS = RESURRECTION_LIMIT + 1
DONE = {"written", "already_anchored", "would_admit"}
FOLLOWONS = os.path.join(ROOT, "data", "athena_followons_229.json")
SOURCES = os.path.join(ROOT, "engine", "rmc_engine_v1", "reference", "athena_sources_223.json")
_STOP = {"what", "which", "where", "when", "who", "whom", "whose", "why", "how", "does", "is", "are", "was", "were", "the",
         "a", "an", "of", "in", "on", "at", "to", "for", "and", "or", "it", "its", "our", "their", "this", "that", "with",
         "from", "by", "as", "be", "do", "made", "make", "many", "much", "there"}


def gap_key(q: str) -> str:
    return " ".join(str(q or "").split()).lower().rstrip("?.! ")


def _item(question: Any, pin: Any = None, origin: str = "", parent: str | None = None, depth: int = 0,
          hypothetical: bool = False, why: str | None = None) -> dict[str, Any] | None:
    q = " ".join(str(question or "").split())
    if len(q) < 6 or len(q) > 200:
        return None
    out: dict[str, Any] = {"question": q, "key": gap_key(q), "from": origin, "parent": parent, "depth": int(depth)}
    if isinstance(pin, str) and "=" in pin:
        out["pin"] = pin
    if hypothetical:
        out["hypothetical"] = True
    if why:
        out["why"] = why
    return out


def load_worklist(data: Any, origin: str = "") -> list[dict[str, Any]]:
    """Every supported worklist shape -> [{question, key, pin?, from}] in file order. Unknown shapes give []."""
    items: list[dict[str, Any] | None] = []
    if isinstance(data, list):
        for x in data:
            items.append(_item(x, None, origin) if isinstance(x, str) else _item((x or {}).get("question"), (x or {}).get("pin"), origin) if isinstance(x, dict) else None)
    elif isinstance(data, dict):
        schema = str(data.get("schema") or "")
        if schema == "FORGE-CURATION/v1":
            for g in data.get("queue") or []:
                if isinstance(g, dict):
                    items.append(_item(g.get("question"), g.get("pin"), origin or "phone curation queue"))
        elif schema == "FORGE-ATHENA-QUEUE/v1":
            for g in data.get("items") or []:
                if isinstance(g, dict):
                    items.append(_item(g.get("question"), g.get("pin"), g.get("from") or origin or "athena queue"))
        elif schema.startswith("FORGE-ATHENA-WRITE") or schema.startswith("FORGE-ATHENA-RUNNER"):
            for r in data.get("results") or []:
                if isinstance(r, dict) and not (r.get("writer") or {}).get("written") and str(r.get("verdict") or "").startswith(("HOLD", "ASK")):
                    items.append(_item(r.get("question"), r.get("pin"), origin or "earlier Athena report"))
        elif isinstance(data.get("rows"), list):
            for r in data["rows"]:
                if isinstance(r, dict) and r.get("admitted") is False:
                    items.append(_item(r.get("question"), None, origin or "cold results (held)"))
    seen: set[str] = set()
    out = []
    for it in items:
        if it and it["key"] not in seen:
            seen.add(it["key"])
            out.append(it)
    return out


def new_state() -> dict[str, Any]:
    return {"schema": SCHEMA + "/state",
            "loop": {"id": "athena-gap-loop", "status": "open", "epoch": 0, "cycle": 0, "cursor": None, "stop_reason": None,
                     "breaker_until": 0, "consecutive_failures": 0},
            "gaps": {}, "memory": [], "discovered": []}


def _loop(state: dict[str, Any]) -> dict[str, Any]:
    base = new_state()["loop"]
    lp = state.setdefault("loop", base)
    for k, v in base.items():
        lp.setdefault(k, v)
    state.setdefault("gaps", {})
    state.setdefault("memory", [])
    state.setdefault("discovered", [])
    return lp


def sources_fingerprint(path: str = SOURCES) -> str:
    """What the system can reach: the enabled Tier-A publishers. A change here is 'new sources' for Gate 7."""
    try:
        cfg = json.load(open(path, encoding="utf-8"))
        ids = sorted("%s@%s" % (s.get("id"), s.get("host")) for s in cfg.get("sources") or [] if s.get("enabled"))
    except (OSError, ValueError):
        ids = []
    return hashlib.sha256("|".join(ids).encode()).hexdigest()[:16]


def _enabled_sources(path: str = SOURCES) -> set[str]:
    try:
        return {s.get("id") for s in json.load(open(path, encoding="utf-8")).get("sources") or [] if s.get("enabled")}
    except (OSError, ValueError):
        return set()


def evidence_fingerprint(res: dict[str, Any]) -> str:
    """Same verdict, same rule, same hosts, same contradictions = no new evidence."""
    ag = res.get("agreement") or {}
    parts = [str(res.get("verdict") or ""), str(res.get("evaluate_rule") or ""), ",".join(sorted(res.get("hosts") or [])),
             ",".join(sorted(str(x) for x in ag.get("agree") or [])), json.dumps(ag.get("contradict") or [], sort_keys=True, default=str)]
    return hashlib.sha256("\n".join(parts).encode()).hexdigest()[:16]


def content_words(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z][a-z\-]{2,}", str(text or "").lower()) if w not in _STOP}


def classify(result: dict[str, Any], commit: bool) -> tuple[str, str]:
    verdict = str(result.get("verdict") or "")
    writer = result.get("writer") or {}
    if writer.get("written"):
        return "written", "admitted and written by the Athena writer (%s)" % writer.get("rule")
    if verdict.startswith("PINNED"):
        return "already_anchored", verdict
    if verdict == "ASK":
        return "needs_meaning", "several meanings and none picked: Forge asks, it does not guess"
    if verdict.startswith("WOULD ADMIT"):
        if writer.get("rule") == "ATHENA-DRY-RUN" and writer.get("ok"):
            return "would_admit", "admitted; dry run (writer validated the row, nothing inserted) - provisional memory only"
        return "held", "admitted but the writer said %s" % (writer.get("rule") or "?")
    if verdict == "HOLD RUNNER-ERROR":
        return "error", "fetch/runner error: %s" % (result.get("error") or "?")
    return "held", verdict or str(result.get("evaluate_rule") or "held")


def _since(memory: list[dict[str, Any]], epoch: int) -> list[dict[str, Any]]:
    return [m for m in memory if int(m.get("epoch") or 0) > int(epoch)]


def echo_match(g: dict[str, Any], memory: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Gilligan System 17 echo match: new memory shares a concept or a content word with the held gap."""
    gc = set(g.get("concepts") or [])
    gw = content_words(g.get("question"))
    for m in memory:
        hit_c = gc & set(m.get("concepts") or [])
        hit_w = gw & (content_words(m.get("text")) | content_words(m.get("label")) | content_words(m.get("category")))
        if hit_c or hit_w:
            return {"memory": m.get("anchor_id"), "concepts": sorted(hit_c), "words": sorted(hit_w)}
    return None


def eligibility(it: dict[str, Any], state: dict[str, Any], src_fp: str) -> tuple[bool, str, dict[str, Any] | None]:
    """(eligible, why, resurrection trigger). Gate 7: a held loop comes back only when the system has grown."""
    lp = _loop(state)
    g = state["gaps"].get(it["key"]) or {}
    status, tier = g.get("status"), g.get("tier")
    if not g:
        return True, "new gap", None
    if status in DONE:
        return False, status, None
    if status == "needs_meaning":
        if it.get("pin") and it.get("pin") != g.get("pin"):
            return True, "meaning picked (pin %s)" % it["pin"], {"trigger": "meaning_picked", "pin": it["pin"]}
        return False, "needs_meaning (waiting for the meaning to be picked)", None
    if status == "error":
        return (int(g.get("errors") or 0) < MAX_ERRORS), "transient error retry", None
    if tier == "ghost":
        if g.get("sources_fp") != src_fp:
            return True, "ghost loop: source registry changed", {"trigger": "sources_changed"}
        return False, "ghost loop (cold, preserved): waits for new sources", None
    # warm hold
    if int(g.get("resurrections") or 0) >= RESURRECTION_LIMIT:
        return False, "resurrection_limit reached", None
    if g.get("sources_fp") != src_fp:
        return True, "source registry changed since the hold", {"trigger": "sources_changed"}
    if int(lp["epoch"]) > int(g.get("hold_epoch") or 0):
        echo = echo_match(g, _since(state["memory"], int(g.get("hold_epoch") or 0)))
        if echo:
            return True, "new memory echoes this hold", dict(echo, trigger="echo")
        return False, "warm hold: new memory does not touch it (Gate 7 closed)", None
    return False, "warm hold: no new knowledge since the hold (Gate 7 closed)", None


def pick(worklist: list[dict[str, Any]], state: dict[str, Any], max_items: int, src_fp: str | None = None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """The next gaps to try (shallowest first, then worklist order) and the skipped ones with the reason."""
    src_fp = src_fp or sources_fingerprint()
    ready, skipped = [], []
    for order, it in enumerate(worklist):
        ok, why, trig = eligibility(it, state, src_fp)
        if ok:
            ready.append((int(it.get("depth") or 0), order, dict(it, _why=why, _trigger=trig)))
        else:
            skipped.append({"question": it["question"], "why": why})
    ready.sort(key=lambda x: (x[0], x[1]))
    return [x[2] for x in ready[:max(0, int(max_items))]], skipped


def _article(word: str) -> str:
    return "an" if word[:1].lower() in "aeiou" else "a"


def _followons() -> dict[str, Any]:
    try:
        return json.load(open(FOLLOWONS, encoding="utf-8")).get("kinds") or {}
    except (OSError, ValueError):
        return {}


def discover(mem: dict[str, Any], state: dict[str, Any], known: set[str], depth: int, hypothetical: bool) -> list[dict[str, Any]]:
    """The next gaps implied by one memory item (deterministic, sourced from WordNet + the kinds table, never invented)."""
    from rmc_engine_v1 import meaning_223 as M
    from rmc_engine_v1 import resonance_recall as rr
    if depth + 1 > MAX_DEPTH:
        return []
    parent = mem.get("from_gap")
    out: list[dict[str, Any]] = []

    def add(q: str, pin: str | None, why: str) -> None:
        it = _item(q, pin, "discovered from memory %s" % (mem.get("anchor_id") or parent), parent, depth + 1, hypothetical, why)
        queued = {d.get("key") for d in state.get("discovered") or []}
        if it and it["key"] not in state["gaps"] and it["key"] not in queued and it["key"] != parent and all(o["key"] != it["key"] for o in out):
            out.append(it)

    parts = str(mem.get("claim") or "").split("|")
    sense = mem.get("meaning_id") or (parts[2] if len(parts) >= 4 and parts[0] == "meaning" else None)
    category = parts[3] if len(parts) >= 4 and parts[0] == "meaning" else (mem.get("category") or "")
    surface = parts[1] if len(parts) >= 4 and parts[0] == "meaning" else (mem.get("label") or "")
    label = mem.get("label") or surface
    chain = M.ancestors(sense) if sense else []
    # 1. the genus: "X is a <category>" -> "What is a <category>?" with the category's sense ON the subject's chain
    if category and chain:
        csense = M.chain_sense(category, chain)
        if csense and rr.subject_key(category) not in known:
            add("What is %s %s?" % (_article(category), category), "%s=%s" % (category, csense),
                "genus of an admitted meaning; its sense %s is inherited along the WordNet chain" % csense)
    # 2. follow-on attributes for the KIND (keyed by sense id), only when an enabled publisher can answer them
    if sense and chain:
        dist = M.ancestor_distances(sense)
        enabled = _enabled_sources()
        for kind, spec in sorted(_followons().items()):
            if kind in dist and dist[kind] < M.HYPERNYM_AGREE_DEPTH and enabled & set(spec.get("answered_by") or []):
                for attr in spec.get("attrs") or []:
                    add("What is the %s of %s?" % (attr, label), "%s=%s" % (surface.lower(), sense),
                        "follow-on attribute of kind %s (%s), answerable by %s" % (kind, spec.get("label"), ",".join(sorted(enabled & set(spec.get("answered_by") or [])))))
    # 3. proper names in the admitted sentence that memory lacks (meaning unknown -> it may ASK; never guessed)
    text = str(mem.get("text") or "")
    words = re.findall(r"[A-Za-z][A-Za-z\-]*", text)
    names = [" ".join(n) for n in rr.compound_names(text)]
    names += [w for i, w in enumerate(words) if i > 0 and w[:1].isupper() and w.lower() not in _STOP]
    for n in names:
        key = rr.subject_key(n)
        if key and key not in known and key not in set(mem.get("concepts") or []) and (M.noun_senses(n) or M.noun_senses(n.lower())):
            the = "the " if re.search(r"\bthe\s+" + re.escape(n) + r"\b", text) else ""
            add("What is %s%s?" % (the, n), None, "named in an admitted fact and not in memory")
    return out[:MAX_FOLLOWONS]


def _log(log: Callable[[dict[str, Any]], None] | None, entry: dict[str, Any]) -> None:
    if log:
        log(entry)


def run_cycle(worklist: list[dict[str, Any]], state: dict[str, Any], *, commit: bool = False, max_items: int = 5,
              now: float | None = None, process: Callable[..., dict[str, Any]] | None = None, anchored: dict | None = None,
              table: dict | None = None, log: Callable[[dict[str, Any]], None] | None = None, src_fp: str | None = None) -> dict[str, Any]:
    """One cycle: pick -> Athena's path -> writeback -> discover. Mutates state (and, on a real write, the anchored map)."""
    if commit and os.environ.get("FORGE_ATHENA_COMMIT") != "1":
        return {"ok": False, "rule": "ATHENA-COMMIT-LOCKED", "commit": False, "attempted": []}
    lp = _loop(state)
    now = time.time() if now is None else float(now)
    if float(lp.get("breaker_until") or 0) > now:
        return {"ok": True, "schema": SCHEMA, "commit": bool(commit), "dry_run": not commit, "attempted": [], "skipped": [],
                "breaker_open": True, "progress": False, "counts": {}}
    src_fp = src_fp or sources_fingerprint()
    anchored = anchored if anchored is not None else {}
    if process is None or table is None:
        from tools import athena_write_224 as W
        process = process or W.process_one
        if table is None:
            table = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
    from rmc_engine_v1 import resonance_recall as rr
    lp["cycle"] = int(lp["cycle"]) + 1
    chosen, skipped = pick(worklist, state, max_items, src_fp)
    attempted, discovered, progress, breaker = [], [], False, False
    for it in chosen:
        lp["cursor"] = it["key"]
        trig = it.pop("_trigger", None)
        why_picked = it.pop("_why", "")
        g = state["gaps"].setdefault(it["key"], {"question": it["question"], "attempts": 0, "resurrections": 0, "tier": "active",
                                                  "parent": it.get("parent"), "depth": int(it.get("depth") or 0),
                                                  "hypothetical": bool(it.get("hypothetical")), "from": it.get("from")})
        if trig and trig.get("trigger") in ("echo", "sources_changed"):
            g["resurrections"] = int(g.get("resurrections") or 0) + 1
            g["tier"] = "active"
            progress = True
            _log(log, {"kind": "resurrect", "at": now, "cycle": lp["cycle"], "epoch": lp["epoch"], "question": it["question"],
                       "trigger": trig, "resurrections": g["resurrections"], "rule": "PCMA Gate 7 (system capacity evolution)"})
        tbl = copy.deepcopy(table)
        pin_res = None
        if it.get("pin"):
            from tools import athena_write_224 as W
            pin_res = W.pin_meaning(tbl, it["pin"])
        if pin_res is not None and not pin_res.get("ok"):
            res = {"question": it["question"], "verdict": "HOLD " + pin_res.get("rule", "ATHENA-PIN"), "writer": {"written": False}}
        else:
            try:
                res = process(it["question"], anchored, tbl, commit=commit)
            except Exception as exc:  # a fetch or writer failure is an error for this cycle, never a crash of the runner
                res = {"question": it["question"], "verdict": "HOLD RUNNER-ERROR", "error": type(exc).__name__ + ": " + str(exc)[:200], "writer": {"written": False}}
        status, why = classify(res, commit)
        fp = evidence_fingerprint(res)
        g["attempts"] = int(g.get("attempts") or 0) + 1
        g.update({"last_at": now, "status": status, "why": why, "pin": it.get("pin"), "last_cycle": lp["cycle"]})
        row = res.get("row") or {}
        if status == "error":
            g["errors"] = int(g.get("errors") or 0) + 1
            lp["consecutive_failures"] = int(lp.get("consecutive_failures") or 0) + 1
            if g["errors"] >= MAX_ERRORS:
                g.update({"status": "held", "tier": "warm", "hold_epoch": lp["epoch"], "sources_fp": src_fp, "fingerprint": fp})
        else:
            lp["consecutive_failures"] = 0
        if status in ("written", "would_admit"):
            lp["epoch"] = int(lp["epoch"]) + 1
            provisional = status != "written"
            concepts = list(row.get("concepts") or [])
            mem = {"anchor_id": row.get("anchor_id"), "text": row.get("text"), "claim": row.get("claim") or res.get("claim"),
                   "meaning_id": row.get("meaning_id"), "concepts": concepts, "label": (res.get("subject") or {}).get("label"),
                   "hosts": row.get("independent_hosts") or res.get("hosts"), "epoch": lp["epoch"], "cycle": lp["cycle"],
                   "from_gap": it["key"], "parent": it.get("parent"), "provisional": provisional,
                   "retrieval_permission": "speculative_only (dry run: hypothetical)" if provisional else "support (written row)"}
            state["memory"].append(mem)
            if not provisional:
                for c in concepts:   # M_{t+1}: the written row is now memory for every later gap in this run
                    anchored.setdefault(c, row.get("anchor_id"))
            g.update({"tier": "memory" if not provisional else "provisional", "anchor_id": row.get("anchor_id")})
            progress = True
            _log(log, {"kind": "writeback", "at": now, "cycle": lp["cycle"], "epoch": lp["epoch"], "question": it["question"],
                       "input": {"question": it["question"], "from": it.get("from"), "pin": it.get("pin"), "parent": it.get("parent")},
                       "trace": {"verdict": res.get("verdict"), "evaluate_rule": res.get("evaluate_rule"), "agreement": res.get("agreement")},
                       "manifest": {"claim": mem["claim"], "meaning_id": mem["meaning_id"], "concepts": concepts},
                       "output": {"anchor_id": mem["anchor_id"], "text": mem["text"]},
                       "validation": {"writer_rule": (res.get("writer") or {}).get("rule"), "written": status == "written", "hosts": mem["hosts"]},
                       "feedback": None, "provisional": provisional})
            known = set(anchored) | {c for m in state["memory"] for c in m.get("concepts") or []}
            for new in discover(mem, state, known, int(it.get("depth") or 0), provisional or bool(it.get("hypothetical"))):
                state["discovered"].append(new)
                discovered.append(new)
                _log(log, {"kind": "discover", "at": now, "cycle": lp["cycle"], "epoch": lp["epoch"], "question": new["question"],
                           "pin": new.get("pin"), "parent": new["parent"], "depth": new["depth"], "why": new.get("why"),
                           "hypothetical": bool(new.get("hypothetical"))})
            if discovered:
                progress = True
        elif status == "already_anchored":
            g["tier"] = "memory"
            progress = True
        elif status == "needs_meaning":
            g["tier"] = "unresolved"
            g["concepts"] = sorted(rr.question_concepts(it["question"], set(anchored)))
        elif status == "held":
            repeated = g.get("fingerprint") == fp and g.get("sources_fp") == src_fp
            g.update({"hold_epoch": lp["epoch"], "sources_fp": src_fp, "fingerprint": fp,
                      "concepts": sorted(rr.question_concepts(it["question"], set(anchored)))})
            if repeated or int(g.get("resurrections") or 0) >= RESURRECTION_LIMIT:
                g["tier"] = "ghost"
                g["ghost_reason"] = "repeated identical hold, no new evidence" if repeated else "resurrection_limit reached"
                _log(log, {"kind": "ghost", "at": now, "cycle": lp["cycle"], "question": it["question"], "why": g["ghost_reason"],
                           "rule": "PCMA: warm SPC -> cold archive (Ghost Loop); preserved, never deleted"})
            else:
                g["tier"] = "warm"
        entry = {"kind": "attempt", "at": now, "cycle": lp["cycle"], "epoch": lp["epoch"], "question": it["question"],
                 "from": it.get("from"), "parent": it.get("parent"), "depth": it.get("depth"), "picked_because": why_picked,
                 "pin": it.get("pin"), "commit": bool(commit), "status": status, "tier": g.get("tier"), "why": why,
                 "verdict": res.get("verdict"), "evaluate_rule": res.get("evaluate_rule"),
                 "writer_rule": (res.get("writer") or {}).get("rule"), "written": bool((res.get("writer") or {}).get("written")),
                 "anchor_id": row.get("anchor_id"), "text": row.get("text"), "meaning_id": row.get("meaning_id"),
                 "hosts": res.get("hosts"), "agreement": res.get("agreement"), "ask": res.get("ask"), "error": res.get("error"),
                 "hypothetical": bool(it.get("hypothetical"))}
        attempted.append(entry)
        _log(log, entry)
        if int(lp.get("consecutive_failures") or 0) >= BREAKER_FAILS:
            lp["breaker_until"] = now + BREAKER_RECOVERY_S
            lp["consecutive_failures"] = 0
            breaker = True
            _log(log, {"kind": "breaker", "at": now, "cycle": lp["cycle"], "why": "%d consecutive failures" % BREAKER_FAILS,
                       "recovery_until": lp["breaker_until"]})
            break
    return {"ok": True, "schema": SCHEMA, "commit": bool(commit), "dry_run": not commit, "cycle": lp["cycle"], "epoch": lp["epoch"],
            "attempted": attempted, "skipped": skipped, "discovered": discovered, "progress": progress, "breaker_open": breaker,
            "counts": {s: sum(1 for a in attempted if a["status"] == s) for s in sorted({a["status"] for a in attempted})}}


run_pass = run_cycle   # 4.9.229 first cut name


def run(queued: list[dict[str, Any]], state: dict[str, Any], *, cycles: int = 10, **kw: Any) -> dict[str, Any]:
    """The recursive loop: cycle until nothing is eligible, no progress, the breaker opens, or the cycle bound."""
    lp = _loop(state)
    lp["status"], lp["stop_reason"] = "open", None
    reports = []
    reason = "cycle_bound"
    for _ in range(max(1, int(cycles))):
        seen: set[str] = set()
        worklist = []
        for w in list(queued) + list(state.get("discovered") or []):
            if w["key"] not in seen:
                seen.add(w["key"])
                worklist.append(w)
        rep = run_cycle(worklist, state, **kw)
        reports.append(rep)
        if not rep.get("ok"):
            reason = rep.get("rule") or "error"
            break
        if rep.get("breaker_open"):
            reason = "breaker_open"
            break
        if not rep.get("attempted"):
            reason = "empty"
            break
        if not rep.get("progress"):
            remaining, _ = pick(worklist, state, 1, kw.get("src_fp"))
            if not remaining:   # nothing new to try and nothing grew: a repeated hold with no new evidence ends the loop
                reason = "no_progress"
                break
    lp["stop_reason"] = reason
    lp["status"] = "closed" if reason in ("empty", "no_progress") else "open"
    if kw.get("log"):
        kw["log"]({"kind": "stop", "at": kw.get("now") or time.time(), "cycle": lp["cycle"], "epoch": lp["epoch"], "stop_reason": reason,
                   "tiers": _tiers(state)})
    return {"ok": all(r.get("ok") for r in reports), "schema": SCHEMA, "commit": bool(kw.get("commit")), "dry_run": not kw.get("commit"),
            "stop_reason": reason, "cycles": reports, "epoch": lp["epoch"], "tiers": _tiers(state),
            "memory": state.get("memory"), "discovered": state.get("discovered")}


def _tiers(state: dict[str, Any]) -> dict[str, int]:
    out: dict[str, int] = {}
    for g in (state.get("gaps") or {}).values():
        out[g.get("tier") or "?"] = out.get(g.get("tier") or "?", 0) + 1
    return out


def main(argv: list[str]) -> int:
    commit = loop = False
    interval, passes, max_items, cycles = 600.0, 0, 5, 10
    state_path = log_path = anchors_path = out_path = None
    files = []
    global MAX_DEPTH
    for a in argv:
        if a == "--commit":
            commit = True
        elif a == "--dry-run":
            commit = False
        elif a == "--loop":
            loop = True
        elif a.startswith("--interval="):
            interval = max(30.0, float(a.split("=", 1)[1]))
        elif a.startswith("--passes="):
            passes = int(a.split("=", 1)[1])
        elif a.startswith("--cycles="):
            cycles = int(a.split("=", 1)[1])
        elif a.startswith("--max-items="):
            max_items = int(a.split("=", 1)[1])
        elif a.startswith("--max-depth="):
            MAX_DEPTH = int(a.split("=", 1)[1])
        elif a.startswith("--state="):
            state_path = a.split("=", 1)[1]
        elif a.startswith("--log="):
            log_path = a.split("=", 1)[1]
        elif a.startswith("--anchors="):
            anchors_path = a.split("=", 1)[1]
        elif a.startswith("--out="):
            out_path = a.split("=", 1)[1]
        else:
            files.append(a)
    if commit and os.environ.get("FORGE_ATHENA_COMMIT") != "1":
        print(json.dumps({"ok": False, "rule": "ATHENA-COMMIT-LOCKED", "hint": "set FORGE_ATHENA_COMMIT=1 only after Nic's go-ahead"}))
        return 2
    if not files:
        print(__doc__.split("usage:")[1], file=sys.stderr)
        return 2
    from tools.athena_dryrun_223 import anchored_concepts
    anchored, _ = anchored_concepts(anchors_path)
    table = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
    state = json.load(open(state_path, encoding="utf-8")) if state_path and os.path.exists(state_path) else new_state()

    def log(entry: dict[str, Any]) -> None:
        if log_path:
            with open(log_path, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")

    n = 0
    while True:
        queued: list[dict[str, Any]] = []
        for f in files:   # re-read each pass: new held questions and meaning picks join the queue
            try:
                queued += load_worklist(json.load(open(f, encoding="utf-8")), origin=os.path.basename(f))
            except (OSError, ValueError):
                continue
        rep = run(queued, state, cycles=cycles, commit=commit, max_items=max_items, anchored=anchored, table=table, log=log)
        if state_path:
            json.dump(state, open(state_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False, default=str)
        if out_path:
            json.dump(rep, open(out_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False, default=str)
        print(json.dumps({"ok": rep.get("ok"), "pass": n + 1, "commit": rep.get("commit"), "queued": len(queued),
                          "cycles": len(rep.get("cycles") or []), "epoch": rep.get("epoch"), "stop_reason": rep.get("stop_reason"),
                          "tiers": rep.get("tiers"), "discovered": len(rep.get("discovered") or []),
                          "memory": len(rep.get("memory") or [])}))
        n += 1
        if not loop or (passes and n >= passes):
            return 0
        time.sleep(interval)


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
