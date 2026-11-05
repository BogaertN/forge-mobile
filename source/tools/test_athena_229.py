"""4.9.229 unit tests (Nic pt146u/t147u): Athena's continuous gap-filling runner and the cause-and-effect spot.

No network, no writes: the Tier-A documents are a recorded fixture (verify/fixtures/athena_229) and the RPC writer is
replaced by a recorder that answers like the dry-run RPC. Prints a JSON list of {name, ok, why}."""
from __future__ import annotations

import copy
import json
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "engine"))
os.environ.setdefault("FORGE_OEWN_DIR", os.path.join(ROOT, "verify/fixtures/athena_223/oewn"))
os.environ.pop("FORGE_ATHENA_COMMIT", None)
os.environ.pop("SUPABASE_SERVICE_ROLE_KEY", None)   # the tests can never reach the live writer

from tools import athena_runner_229 as R  # noqa: E402
from tools import athena_write_224 as W  # noqa: E402
from rmc_engine_v1 import athena_sources_223 as A  # noqa: E402
from rmc_engine_v1 import cause_effect as CE  # noqa: E402
from rmc_engine_v1 import rmc_core  # noqa: E402
from rmc_engine_v1 import world_model_v1 as WM  # noqa: E402

TABLE = json.load(open(os.path.join(ROOT, "data", "concept_senses.json"), encoding="utf-8"))
DOCS = json.load(open(os.path.join(ROOT, "verify/fixtures/athena_229/mercury_docs.json"), encoding="utf-8"))["documents"]
OUT = []


def check(name):
    def wrap(fn):
        try:
            why = fn()
            OUT.append({"name": name, "ok": why is None, "why": why})
        except Exception as exc:  # a crash is a failure with its reason
            OUT.append({"name": name, "ok": False, "why": type(exc).__name__ + ": " + str(exc)[:300]})
        return fn
    return wrap


class Recorder:
    """Stands in for the RPC writer: answers like p_commit=false and records every call."""
    def __init__(self):
        self.calls = []

    def __call__(self, row, commit):
        self.calls.append({"anchor_id": row.get("anchor_id"), "meaning_id": row.get("meaning_id"), "commit": commit, "concepts": row.get("concepts")})
        return {"ok": True, "rule": "ATHENA-DRY-RUN" if not commit else "ATHENA-WRITTEN", "written": bool(commit), "anchor_id": row.get("anchor_id")}


def with_fixture(fn):
    real_fetch, real_writer = A.fetch_all, W.call_writer
    rec = Recorder()
    A.fetch_all = lambda q, subject=None, **k: {"documents": copy.deepcopy(DOCS), "per_source": {}}
    W.call_writer = rec
    try:
        return fn(rec)
    finally:
        A.fetch_all, W.call_writer = real_fetch, real_writer


@check("runner: dry-run is the default and runs a queued item through Athena's write path without committing")
def _():
    def body(rec):
        wl = R.load_worklist({"schema": "FORGE-ATHENA-QUEUE/v1", "items": [{"question": "What is Mercury?", "pin": "mercury=09374305-n", "from": "meaning follow-up"}]})
        state = R.new_state()
        rep = R.run_pass(wl, state, anchored={}, table=TABLE, now=1000.0)
        a = rep["attempted"][0] if rep["attempted"] else {}
        if rep.get("commit") is not False or rep.get("dry_run") is not True:
            return "default is not dry-run: %r" % rep.get("commit")
        if not rec.calls or any(c["commit"] for c in rec.calls):
            return "writer not called through the path, or called with commit: %r" % rec.calls
        if a.get("status") != "would_admit" or a.get("written") or a.get("meaning_id") != "09374305-n":
            return "attempt %r" % {k: a.get(k) for k in ("status", "verdict", "writer_rule", "meaning_id", "why")}
        if rec.calls[0]["concepts"] != ["A.MERCURY"]:
            return "keyed %r" % rec.calls[0]["concepts"]
        g = state["gaps"]["what is mercury"]
        if g["status"] != "would_admit" or g.get("tier") != "provisional" or not state["memory"] or not state["memory"][0]["provisional"]:
            return "state %r" % g
        return None
    return with_fixture(body)


@check("runner: --commit without FORGE_ATHENA_COMMIT is refused before anything runs")
def _():
    called = []
    rep = R.run_pass([{"question": "What is Mercury?", "key": "what is mercury"}], R.new_state(), commit=True,
                     process=lambda *a, **k: called.append(1) or {}, table=TABLE)
    return None if rep.get("rule") == "ATHENA-COMMIT-LOCKED" and not called else "not locked: %r" % rep


@check("runner: a subject with several meanings and no pin is ASK (needs_meaning), never guessed, writer not called")
def _():
    def body(rec):
        state = R.new_state()
        rep = R.run_pass([{"question": "What is Mercury?", "key": "what is mercury"}], state, anchored={}, table=TABLE, now=5.0)
        a = rep["attempted"][0]
        if a["status"] != "needs_meaning" or rec.calls:
            return "got %r calls %r" % (a["status"], rec.calls)
        again, skipped = R.pick([{"question": "What is Mercury?", "key": "what is mercury"}], state, 5)
        if again or "needs_meaning" not in skipped[0]["why"]:
            return "re-picked without a pin"
        with_pin, _ = R.pick([{"question": "What is Mercury?", "key": "what is mercury", "pin": "mercury=09374305-n"}], state, 5)
        return None if with_pin else "a pin did not release the gap"
    return with_fixture(body)


@check("runner: worklists are Athena's held/queued questions (phone curation queue, cold held rows, earlier reports)")
def _():
    cur = R.load_worklist({"schema": "FORGE-CURATION/v1", "queue": [{"question": "What is quartz?"}, {"question": "What is quartz?"}]})
    cold = R.load_worklist({"rows": [{"question": "What is Saturn?", "admitted": False}, {"question": "What is DNA?", "admitted": True}]})
    rep = R.load_worklist({"schema": "FORGE-ATHENA-WRITE/224", "results": [{"question": "How is glass made?", "verdict": "HOLD SEED-NO-SOURCE", "writer": {}},
                                                                           {"question": "What is gravity?", "verdict": "WOULD ADMIT (not written)", "writer": {"written": True}}]})
    junk = R.load_worklist({"schema": "something else", "pages": ["https://example.org"]})
    ok = [x["question"] for x in cur] == ["What is quartz?"] and [x["question"] for x in cold] == ["What is Saturn?"] \
        and [x["question"] for x in rep] == ["How is glass made?"] and junk == []
    return None if ok else "cur %r cold %r rep %r junk %r" % (cur, cold, rep, junk)


HOLD = lambda q, anchored, table, commit=False: {"question": q, "verdict": "HOLD SEED-NO-SOURCE", "evaluate_rule": "SEED-NO-SOURCE", "hosts": ["en-word.net"], "writer": {"rule": "ATHENA-NOT-ADMIT", "written": False}}


@check("runner: a hold is stored warm with its reason; it is NOT retried while nothing new is known (Gate 7), and the log says why")
def _():
    state, logged = R.new_state(), []
    wl = [{"question": "How is glass made?", "key": "how is glass made"}]
    R.run_cycle(wl, state, process=HOLD, table=TABLE, now=0.0, log=logged.append)
    g = state["gaps"]["how is glass made"]
    nxt, skipped = R.pick(wl, state, 5)
    att = [e for e in logged if e["kind"] == "attempt"]
    ok = g["status"] == "held" and g["tier"] == "warm" and g["hold_epoch"] == 0 and g["fingerprint"] and not nxt \
        and "Gate 7" in skipped[0]["why"] and att and att[0]["why"] == "HOLD SEED-NO-SOURCE" and att[0]["commit"] is False
    return None if ok else "state %r skipped %r log %r" % (g, skipped, logged)


@check("runner is recursive: an admitted meaning becomes memory and discovers the next gaps (genus pinned by the inherited sense, kind attributes by sense id)")
def _():
    def body(rec):
        wl = R.load_worklist({"schema": "FORGE-ATHENA-QUEUE/v1", "items": [{"question": "What is Mercury?", "pin": "mercury=09374305-n"}]})
        state, logged = R.new_state(), []
        rep = R.run(wl, state, cycles=4, anchored={}, table=TABLE, now=1.0, log=logged.append)
        disc = {d["question"]: d for d in state["discovered"]}
        genus = disc.get("What is a planet?") or {}
        attr = disc.get("What is the mass of Mercury?") or {}
        tried = [e["question"] for e in logged if e["kind"] == "attempt"]
        if state["loop"]["epoch"] != 1 or len(state["memory"]) != 1:
            return "epoch/memory %r %r" % (state["loop"], state["memory"])
        if genus.get("pin") != "planet=09416900-n" or genus.get("parent") != "what is mercury" or genus.get("depth") != 1 or not genus.get("hypothetical"):
            return "genus %r" % genus
        if attr.get("pin") != "mercury=09374305-n":
            return "attr %r" % attr
        if "What is a planet?" not in tried or rep["stop_reason"] not in ("no_progress", "empty"):
            return "discovered gaps not looped back: tried %r stop %r" % (tried, rep["stop_reason"])
        return None
    return with_fixture(body)


@check("runner Gate 7: a warm hold is resurrected only when new memory echoes it; an identical hold again goes cold (ghost), kept")
def _():
    def body(rec):
        wl = [{"question": "Which is the smallest planet?", "key": "which is the smallest planet"}]
        wl += R.load_worklist({"schema": "FORGE-ATHENA-QUEUE/v1", "items": [{"question": "What is Mercury?", "pin": "mercury=09374305-n"}]})
        state, logged = R.new_state(), []
        R.run(wl, state, cycles=5, anchored={}, table=TABLE, now=1.0, log=logged.append)
        g = state["gaps"]["which is the smallest planet"]
        res = [e for e in logged if e["kind"] == "resurrect"]
        ok = res and res[0]["trigger"]["trigger"] == "echo" and g["tier"] == "ghost" and g["resurrections"] == 1 \
            and "no new evidence" in g["ghost_reason"] and "which is the smallest planet" in state["gaps"]
        return None if ok else "resurrect %r gap %r" % (res, g)
    return with_fixture(body)


@check("runner: a real write (lock open) updates memory M_t+1 so later gaps see it; dry-run never touches the anchored map")
def _():
    def proc(q, anchored, table, commit=False):
        if "A.WIDGET" in anchored:
            return {"question": q, "verdict": "PINNED (already anchored: A.WIDGET)", "writer": {"written": False}}
        return {"question": q, "verdict": "WOULD ADMIT (not written)", "claim": "x", "subject": {"label": "Widget"},
                "row": {"anchor_id": "athena-w", "text": "A widget is a thing.", "concepts": ["A.WIDGET"], "meaning_id": None},
                "writer": {"ok": True, "rule": "ATHENA-WRITTEN" if commit else "ATHENA-DRY-RUN", "written": bool(commit)}}
    wl = [{"question": "What is a widget?", "key": "what is a widget"}, {"question": "Is a widget useful?", "key": "is a widget useful"}]
    dry_anch = {}
    R.run_cycle(wl, R.new_state(), process=proc, anchored=dry_anch, table=TABLE, now=0.0)
    os.environ["FORGE_ATHENA_COMMIT"] = "1"
    try:
        anch, st = {}, R.new_state()
        rep = R.run_cycle(wl, st, process=proc, anchored=anch, table=TABLE, now=0.0, commit=True)
    finally:
        os.environ.pop("FORGE_ATHENA_COMMIT", None)
    st2 = [a["status"] for a in rep["attempted"]]
    ok = dry_anch == {} and anch == {"A.WIDGET": "athena-w"} and st2 == ["written", "already_anchored"] and st["memory"][0]["provisional"] is False
    return None if ok else "dry %r commit %r statuses %r" % (dry_anch, anch, st2)


@check("runner stops: empty worklist; circuit breaker opens after 3 consecutive failures")
def _():
    empty = R.run([], R.new_state(), cycles=3, process=HOLD, table=TABLE, now=0.0)
    def boom(q, anchored, table, commit=False):
        raise OSError("network down")
    wl = [{"question": "Question number %d here?" % i, "key": "q%d" % i} for i in range(5)]
    st = R.new_state()
    br = R.run(wl, st, cycles=3, process=boom, table=TABLE, now=0.0)
    ok = empty["stop_reason"] == "empty" and br["stop_reason"] == "breaker_open" and len(br["cycles"][0]["attempted"]) == 3 \
        and st["loop"]["breaker_until"] == R.BREAKER_RECOVERY_S
    return None if ok else "empty %r breaker %r" % (empty["stop_reason"], br["stop_reason"])


@check("runner is general: no subject is named in its code")
def _():
    src = open(os.path.join(ROOT, "tools/athena_runner_229.py"), encoding="utf-8").read().lower()
    code = src.split('"""', 2)[2]   # skip the docstring
    bad = [w for w in ("mercury", "saturn", "09374305", "planet") if w in code]
    return None if not bad else "hard-coded: %r" % bad


@check("cause-effect hook exists, is a no-op, and a prediction is never stored as a fact")
def _():
    out = CE.predict("What happens if I push the bottle at the top?")
    if out["status"] != "not_implemented" or out["prediction"] is not None or out["admit"] or out["store_as_fact"] or out["writes"]:
        return "hook %r" % out
    if CE.RULES != () or CE.may_store_as_fact(out) or not CE.may_store_as_fact({"text": "Gravity is a force."}):
        return "store rule"
    sim = WM.simulate({"root": "r"}, "push the bottle")
    ce = sim.get("cause_effect") or {}
    if sim.get("status") != "deferred" or ce.get("status") != "not_implemented" or ce.get("prediction") is not None or ce.get("store_as_fact") is not False:
        return "simulate %r" % sim
    return None


@check("cause-effect types: rules over kinds keyed by sense ids; sourced laws need two publishers; derived rules need a proof")
def _():
    rule = {"schema": CE.SCHEMA, "rule_id": "MECH-EXAMPLE", "kind": "causal_transition", "determinism": "deterministic_onset",
            "senses": {"action": ["01875972-v"], "object": ["@rigid_flat_based_object"], "outcomes": {"tip": "01913390-v", "slide": "02095257-v"}},
            "source_class": "derived", "derived_from": ["LAW-A", "LAW-B"], "proof": "PROOF-1", "effects": [{"if": "h_p > w / mu_s", "then": "tip"}]}
    good = CE.validate_rule(rule)
    spelled = CE.validate_rule(dict(rule, senses={"action": ["push"], "object": ["bottle"]}))
    sourced_one = CE.validate_rule(dict(rule, source_class="sourced", evidence_refs=[{"host": "openstax.org"}]))
    no_proof = CE.validate_rule(dict(rule, proof=None))
    ok = good["ok"] and not spelled["ok"] and not sourced_one["ok"] and not no_proof["ok"]
    return None if ok else "good %r spelled %r sourced %r proof %r" % (good, spelled, sourced_one, no_proof)


@check("the Athena writer refuses a prediction as a fact (ATHENA-PREDICTION-NOT-A-FACT), writer not called")
def _():
    from rmc_engine_v1 import self_seed_202 as ss
    real = ss.evaluate
    def fake(payload):
        r = real(payload)
        if r.get("anchor"):
            r["anchor"] = dict(r["anchor"], provenance=dict(r["anchor"].get("provenance") or {}, kind="causal_prediction"))
        return r
    def body(rec):
        t = copy.deepcopy(TABLE)
        W.pin_meaning(t, "mercury=09374305-n")
        ss.evaluate = fake
        try:
            res = W.process_one("What is Mercury?", {}, t, commit=False)
        finally:
            ss.evaluate = real
        return None if (res.get("writer") or {}).get("rule") == "ATHENA-PREDICTION-NOT-A-FACT" and not rec.calls else "writer %r calls %r" % (res.get("writer"), rec.calls)
    return with_fixture(body)


@check("pin: only a WordNet meaning of that word can be pinned (no invented sense ids)")
def _():
    t = copy.deepcopy(TABLE)
    bad = W.pin_meaning(t, "mercury=14905454-n")
    good = W.pin_meaning(t, "mercury=09374305-n")
    return None if (not bad["ok"] and bad["rule"] == "ATHENA-PIN-UNKNOWN-SENSE" and good["ok"] and good["key"] == "A.MERCURY") else "%r %r" % (bad, good)


@check("Ask after a picked meaning: a fact filed under another meaning is off-sense and not a candidate")
def _():
    rows = [{"id": "a-planet", "text": "Mercury is the smallest planet in our solar system and nearest to the Sun.", "concepts": ["A.MERCURY"], "meaning_id": "09374305-n", "trust": "trusted", "state": "anchor"},
            {"id": "a-legacy", "text": "Mercury is a word with no meaning id.", "concepts": ["A.MERCURY"], "trust": "trusted", "state": "anchor"}]
    base = {"question": "What is Mercury?", "memory": {"anchors": [], "pools": [{"name": "anchors", "into": "anchors", "rows": rows}]}}
    god = rmc_core.preselect_pools(dict(base, sense={"word": "Mercury", "sense": "09585833-n", "concept": None, "exclude_concepts": []}))
    planet = rmc_core.preselect_pools(dict(base, sense={"word": "Mercury", "sense": "09374305-n", "concept": None, "exclude_concepts": []}))
    none = rmc_core.preselect_pools(copy.deepcopy(base))
    kept = lambda r: sorted(x["id"] for x in r["memory"].get("anchors") or [])
    ok = kept(god) == ["a-legacy"] and kept(planet) == ["a-legacy", "a-planet"] and kept(none) == ["a-legacy", "a-planet"] \
        and god["_preselect"]["pools"][0].get("off_sense") == ["a-planet"]
    if not ok:
        return "god %r planet %r none %r" % (kept(god), kept(planet), kept(none))
    # rows already in memory (not a pool) follow the same rule
    base2 = {"question": "What is Mercury?", "memory": {"anchors": [dict(rows[0], id="m-planet")], "pools": [{"name": "anchors", "into": "anchors", "rows": rows[1:]}]}}
    god2 = rmc_core.preselect_pools(dict(base2, sense={"word": "Mercury", "sense": "09585833-n", "concept": None, "exclude_concepts": []}))
    ok2 = kept(god2) == ["a-legacy"] and god2["_preselect"].get("off_sense_memory") == ["m-planet"]
    return None if ok2 else "memory rows under another meaning were kept: %r" % kept(god2)


print(json.dumps(OUT, indent=1))
sys.exit(0 if all(r["ok"] for r in OUT) else 1)
