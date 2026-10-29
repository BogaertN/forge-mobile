"""General Learning-to-Answer Pipeline — multi-step word problems (Build GP-003).

Adds one new learned domain WITHOUT modifying any GP-001 or GP-002 file:

  multi_step_count_change : narrative problems where a starting count is changed
                            by a sequence of add/remove events.

  Examples:
    "Sam had 12 apples, bought 8 more, then gave away 5. How many does he have?"
    "There were 20 birds. 7 flew away and then 4 more landed. How many now?"
    "A shelf had 30 books. 12 were borrowed, then 6 were returned. How many?"

It reads the starting amount and each subsequent change (with its direction from
the verb), applies them in order with exact arithmetic, and verifies by
re-summing the signed changes independently. On a verified solve it produces the
same governed, render-ready solution the pipeline already knows how to seal.

Honesty boundary:
  This recognises a bounded family: one starting integer count followed by one or
  more change clauses whose direction is set by a known increase/decrease verb. It
  does NOT do general word-problem understanding (no rates, no comparisons, no
  unknown-position algebra). Unrecognised phrasings are left unmatched so the
  pipeline refuses rather than guessing. Exact integer arithmetic only; no LLM.

Registration (GP-004 reground):
  activate() registers this bounded capability in the centralized capability
  registry. Source text can support the installed capability but cannot install
  or activate it. Parsed narratives must account for every numeric event after
  the starting count; unsupported extra numeric clauses are refused.
"""

from __future__ import annotations

import re
from fractions import Fraction
from typing import List, Optional, Tuple

from .contracts import ParsedQuestion, ExactSolution, fraction_to_text

_RESOLVED_INFORMATION_GAIN = 1_000_000

# Verbs that increase or decrease the running count.
_INCREASE_VERBS = (
    "bought", "buys", "buy", "added", "adds", "add", "gained", "gains", "gain",
    "found", "finds", "got", "gets", "get", "received", "receives", "receive",
    "landed", "arrived", "more", "picked up", "earned", "earns", "collected", "collects",
    "returned", "returns",
)
_DECREASE_VERBS = (
    "gave away", "gave", "gives away", "gives", "give away", "give", "lost", "loses", "lose",
    "sold", "sells", "sell", "ate", "eats", "eat", "eaten", "removed", "removes", "remove",
    "flew away", "dropped", "drops", "drop", "used", "uses", "use", "spent", "spends", "spend",
    "took", "takes", "take", "taken", "borrowed", "borrows", "borrow", "given away",
)

_START_VERBS = ("had", "has", "have", "were", "was", "is", "are", "started with", "begins with", "began with")


def _normalise(text: str) -> str:
    return " ".join(str(text).strip().lower().split())


def _int_token(token: str) -> Optional[int]:
    if re.fullmatch(r"\d+", token.strip()):
        return int(token)
    return None


class MultiStepCountChangeDomain:
    domain_id = "multi_step_count_change"

    def relation_text(self) -> str:
        return "final_count = starting_count + sum of signed change events, by exact arithmetic in order"

    # A change clause: a direction verb and a number in the same clause.
    def _find_changes(self, text: str) -> List[Tuple[str, int, str]]:
        """Return ordered list of (direction, amount, verb), one per clause.

        The narrative is split into clauses on connectors (commas, periods,
        'and', 'then'). Within each clause we find its number and its direction
        verb, regardless of order ("7 flew away" and "bought 8" both work).
        """
        changes: List[Tuple[str, int, str]] = []
        clauses = re.split(r"[.,;]|\band\b|\bthen\b", text)
        for clause in clauses:
            clause = clause.strip()
            if not clause:
                continue
            nums = re.findall(r"\d+", clause)
            if not nums:
                continue
            amount = int(nums[0])
            direction = None
            verb = None
            for v in sorted(_DECREASE_VERBS, key=len, reverse=True):
                if re.search(r"\b" + re.escape(v) + r"\b", clause):
                    direction, verb = "decrease", v
                    break
            if direction is None:
                for v in sorted(_INCREASE_VERBS, key=len, reverse=True):
                    if re.search(r"\b" + re.escape(v) + r"\b", clause):
                        direction, verb = "increase", v
                        break
            if direction is not None:
                changes.append((direction, amount, verb))
        return changes

    def _parse_governed_event_text(self, text: str) -> Optional[List[Tuple[str, int, str]]]:
        """Parse all event clauses and reject any unconsumed narrative clause.

        GP-003 extracted recognized changes from a narrative. GP-004 upgrades
        that boundary: within the bounded count-change form every clause before
        the final question must be a recognized single numeric change event.
        """
        changes: List[Tuple[str, int, str]] = []
        clauses = re.split(r"[.,;]|\band\b|\bthen\b", text)
        filler = {
            "she", "he", "they", "it", "there", "more", "were", "was",
            "is", "are", "has", "have", "does", "do",
        }
        for raw_clause in clauses:
            clause = raw_clause.strip()
            if not clause:
                continue
            numbers = re.findall(r"\d+", clause)
            if len(numbers) != 1:
                return None
            amount = int(numbers[0])
            direction = None
            verb = None
            for candidate in sorted(_DECREASE_VERBS, key=len, reverse=True):
                if re.search(r"\b" + re.escape(candidate) + r"\b", clause):
                    direction, verb = "decrease", candidate
                    break
            if direction is None:
                for candidate in sorted(_INCREASE_VERBS, key=len, reverse=True):
                    if re.search(r"\b" + re.escape(candidate) + r"\b", clause):
                        direction, verb = "increase", candidate
                        break
            if direction is None or verb is None:
                return None

            residual = re.sub(r"\b" + re.escape(verb) + r"\b", " ", clause, count=1)
            residual = re.sub(r"\b\d+\b", " ", residual, count=1)
            words = [word for word in re.findall(r"[a-z]+", residual) if word not in filler]
            if words:
                return None
            changes.append((direction, amount, verb))
        return changes or None

    def _find_start(self, text: str) -> Optional[int]:
        # The starting quantity is the EARLIEST number that follows a start verb
        # (had/has/have/were/was/started with...). We scan all start verbs and
        # keep the match with the smallest position so "had 18 ... 6 were eaten"
        # correctly takes 18, not a later "were N".
        best_pos = None
        best_val = None
        for v in _START_VERBS:
            for m in re.finditer(r"\b" + re.escape(v) + r"\b\D{0,12}?(\d+)", text):
                if best_pos is None or m.start() < best_pos:
                    best_pos = m.start()
                    best_val = int(m.group(1))
        return best_val
        return None

    def matches(self, question: str) -> bool:
        return self.parse(question) is not None

    def parse(self, question: str) -> Optional[ParsedQuestion]:
        q = _normalise(question)
        # Must look like a "how many" count narrative, not a bare expression.
        if "how many" not in q and "how much" not in q:
            return None
        if any(tok in q for tok in (" full", "capacity", "=")):
            return None  # belongs to capacity / equation domains
        start = self._find_start(q)
        if start is None:
            return None
        # Parse the complete bounded narrative: starting object clause,
        # one-or-more governed change clauses, then a numeric-free final query.
        start_pos = q.find(str(start))
        tail = q[start_pos + len(str(start)):]
        first_separator = re.search(r"[.,;]", tail)
        if first_separator is None:
            return None
        initial_object_clause = tail[:first_separator.start()].strip()
        if not re.fullmatch(r"[a-z ]+", initial_object_clause):
            return None
        events_and_query = tail[first_separator.end():].strip()
        final_question = re.search(r"\bhow\s+(?:many|much)\b", events_and_query)
        if final_question is None:
            return None
        event_text = events_and_query[:final_question.start()].strip()
        question_text = events_and_query[final_question.start():].strip()
        if not re.fullmatch(r"how\s+(?:many|much)\s+[a-z ]+[?!.]?", question_text):
            return None
        changes = self._parse_governed_event_text(event_text)
        if not changes:
            return None
        # Encode quantities: start plus each change as c0, c1, ...
        quantities = {"start": Fraction(start)}
        meta = {"item_noun": self._guess_object(q)}
        for idx, (direction, amount, verb) in enumerate(changes):
            signed = amount if direction == "increase" else -amount
            quantities[f"change_{idx}"] = Fraction(signed)
            meta[f"verb_{idx}"] = verb
            meta[f"dir_{idx}"] = direction
        meta["num_changes"] = str(len(changes))
        return ParsedQuestion(
            domain=self.domain_id,
            raw_question=question,
            quantities=quantities,
            metadata=meta,
        )

    def _guess_object(self, q: str) -> str:
        # Best-effort noun: word right after the start count, else generic.
        m = re.search(r"\b(?:had|has|have|were|was)\b\s+\d+\s+([a-z]+)", q)
        if m:
            return m.group(1)
        m2 = re.search(r"(\d+)\s+([a-z]+)", q)
        if m2:
            return m2.group(2)
        return "items"

    def execute(self, parsed: ParsedQuestion) -> ExactSolution:
        start = parsed.quantities["start"]
        n = int(parsed.metadata.get("num_changes", "0"))
        obj = parsed.metadata.get("item_noun", "items")

        running = start
        steps = [f"Start with {fraction_to_text(start)} {obj}."]
        signed_changes = []
        for idx in range(n):
            change = parsed.quantities[f"change_{idx}"]
            verb = parsed.metadata.get(f"verb_{idx}", "")
            direction = parsed.metadata.get(f"dir_{idx}", "")
            signed_changes.append(change)
            before = running
            running = running + change
            amt = fraction_to_text(abs(change))
            if direction == "increase":
                steps.append(f"After {verb} {amt}, the count rises from {fraction_to_text(before)} to {fraction_to_text(running)}.")
            else:
                steps.append(f"After {verb} {amt}, the count falls from {fraction_to_text(before)} to {fraction_to_text(running)}.")

        answer = running

        # A natural closing statement naming the object and final count.
        steps.append(f"That leaves {fraction_to_text(answer)} {obj} in total.")

        # Independent verification: start + sum(signed changes) must equal answer.
        recomputed = start + sum(signed_changes, Fraction(0))
        verified = (recomputed == answer)
        change_sum_text = " ".join(
            (("+ " + fraction_to_text(c)) if c >= 0 else ("- " + fraction_to_text(abs(c))))
            for c in signed_changes
        )
        verification_text = (
            f"Check: {fraction_to_text(start)} {change_sum_text} = {fraction_to_text(recomputed)} {obj}, "
            f"which matches the running total."
        )

        return ExactSolution(
            domain=self.domain_id,
            answer_value=answer,
            answer_unit="",
            steps=steps,
            verification_text=verification_text,
            verified=verified,
            information_gain=_RESOLVED_INFORMATION_GAIN if verified else 0,
        )


def register() -> bool:
    """Register the bounded multi-step word-problem capability. Idempotent."""
    from .capability_registry import CapabilityContract, register_capability
    return register_capability(
        CapabilityContract(
            capability_id="cap.math.multi_step_count_change.v1",
            domain_id=MultiStepCountChangeDomain.domain_id,
            domain_factory=MultiStepCountChangeDomain,
            relation_text=MultiStepCountChangeDomain().relation_text(),
            source_fingerprints=("word problem", "how many", "altogether", "in all", "remaining", "left", "total", "count"),
            min_fingerprint_hits=2,
            priority=40,
        )
    )


__all__ = ["MultiStepCountChangeDomain", "register"]
