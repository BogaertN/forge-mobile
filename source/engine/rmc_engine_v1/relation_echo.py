"""4.9.217 relation re-parse: does a sentence realise the relation the question asked, about the asked subject?

Echo and the resonance lookup both read sentences with this module. It is a re-parse, not a keyword score.

  1. The question is read into an asked relation and an asked subject. The relations are the Pāṇinian kāraka
     readings the wording step (source/src/panini_wording.js over grammar.js) already uses for English:
       definition   "what/who is X"            X is the kartṛ of FR.BE.COP (the copular frame) and is defined there
       identify     "what is the N of Y", "what is the largest N", "what is my N"
                                                the asked noun phrase fills a side of FR.BE.COP (kartṛ or the predicate)
       attribute    "what colour is X"          X is the kartṛ of FR.BE.COP and the predicate is a value of the slot
       cause        "why …"                     hetu / apādāna: the sentence states a cause, about X
       quantity     "how many / how hot …"      saṅkhyā: the sentence states a number or measure, about X
       location     "where …"                   adhikaraṇa (place): a locative phrase, about X
       time         "when …"                    adhikaraṇa (time): a date or time phrase, about X
       agent        "who painted X"             kartṛ of the asked verb, with X as its karma
       manner       "how does X work"           X takes part in a stated event
     Anything else is "unclassified" and the relation check does not apply (the speech acts, "and what about Mars?").
  2. The sentence is split into clauses and each clause is read with the engine's own copular parse
     (world_model_v1.parse_sentence, the contract §7 atom on FR.BE.COP), extended to are / was / were and the naming
     verbs (refers to, means, is called / known as / defined as). Parentheticals and a comma appositive after the
     subject are not the subject ("DNA, or deoxyribonucleic acid, is …").
  3. A copular clause whose subject is the asked subject DEFINES it (an appositive "X, the N …," is a reduced copula). The predicate kind is recorded: a noun phrase or a
     naming verb is a definition proper (rank 2); an adjective is a copular attribution (rank 1); a passive participle
     ("is located in", "is found") or a progressive is an event, not a definition (rank 0). A clause where the subject
     only appears somewhere else merely mentions it (rank 0).

Word overlap is never the relation decision. Echo keeps the meaning coverage only as the secondary number.
Stdlib, deterministic, no LLM. Both runtimes (CPython, Pyodide) read the same bytes.
"""
from __future__ import annotations

import re
from typing import Any

from rmc_engine_v1.world_model_v1 import parse_sentence

CITE = (
    "Nic 4.9.217 (lookup ranks anchors that define the asked subject; Echo re-parses the answer for the asked relation). "
    "Pāṇinian kāraka readings as in source/src/panini_wording.js and grammar.js (kartṛ, karma, hetu, apādāna, adhikaraṇa, saṅkhyā); "
    "FR.BE.COP from language_core_debate; the copular atom from world_model_v1.parse_sentence (contract 1g2034-K §7)."
)

_DET = {"the", "a", "an"}
_OWNER = {"my": "@owner", "your": "@owner", "our": "@owner"}
_COPULA = ("is", "are", "was", "were")
_NAMING = ("refers to", "is defined as", "are defined as", "is called", "are called", "is known as", "are known as",
           "means", "denotes", "is the name of")
_NEG = {"not", "never", "no"}
_IRREG_PART = {"found", "made", "known", "seen", "given", "built", "held", "born", "taken", "done", "used", "thought",
               "said", "kept", "left", "brought", "caught", "put", "set", "sent", "shown", "grown", "drawn", "worn",
               "written", "spoken", "driven", "eaten", "fallen", "hidden", "broken", "chosen", "frozen", "stolen"}
_NAMING_PART = {"called", "named", "known", "defined", "termed"}
_LOCATIVE = {"in", "at", "on", "near", "inside", "between", "beneath", "under", "above", "within", "located", "lies",
             "situated", "found", "north", "south", "east", "west", "orbit", "orbits", "around"}
_MONTHS = {"january", "february", "march", "april", "may", "june", "july", "august", "september", "october",
           "november", "december"}
_TIME = {"century", "centuries", "ago", "bc", "bce", "ad", "ce", "year", "years", "decade", "today", "yesterday", "during"}
_NUMWORDS = {"zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
             "hundred", "hundreds", "thousand", "thousands", "million", "millions", "billion", "billions", "dozen",
             "half", "twice", "double", "triple"}
_QUANT_ADJ = {"hot", "cold", "far", "long", "big", "old", "tall", "fast", "heavy", "large", "deep", "high", "wide",
              "warm", "small", "short", "bright", "loud"}
_SUPERLATIVE_EXTRA = {"best", "worst", "most", "least", "first", "last", "main", "biggest"}
_POSS = {"has", "have", "had", "owns", "own", "owned", "with", "possesses"}
_IRREG_VERB = {"wrote": "writ", "written": "writ", "write": "writ", "writes": "writ", "painted": "paint",
               "built": "build", "made": "make", "found": "find", "discovered": "discover", "invented": "invent",
               "drew": "draw", "drawn": "draw", "sang": "sing", "sung": "sing", "began": "begin", "begun": "begin",
               "took": "take", "taken": "take", "led": "lead", "founded": "found"}
_STOP = {"the", "and", "for", "with", "from", "that", "this", "what", "which", "when", "where", "who", "whom", "why",
         "how", "are", "was", "were", "you", "your", "does", "did", "can", "could", "into", "about", "have", "has",
         "not", "but", "is", "do", "a", "an", "of", "to", "in", "on", "my", "our", "it"}


def _words(text: str) -> list[str]:
    """Lower-case words. A possessive 's is the owner noun itself ("the Sun's surface" is about the sun)."""
    return [re.sub(r"'s$", "", w) for w in re.findall(r"[a-z0-9]+(?:['’][a-z]+)?", str(text or "").lower().replace("’", "'"))]


def _content(words: list[str]) -> list[str]:
    return [w for w in words if w not in _STOP and len(w) > 1]


def _norm_np(text: str) -> list[str]:
    """A noun phrase as words: determiner dropped, owner pronouns read as one owner (my/your swap on re-reading)."""
    words = _words(text)
    while words and words[0] in _DET:
        words = words[1:]
    return [_OWNER.get(w, w) for w in words]


def _same_np(a: list[str], b: list[str]) -> bool:
    if not a or not b or len(a) != len(b):
        return False
    for x, y in zip(a, b):
        if x == y:
            continue
        # number agreement only ("atoms" defines "atom"); nothing else is folded
        if x + "s" == y or y + "s" == x or x + "es" == y or y + "es" == x:
            continue
        return False
    return True


def _has_word(word: str, words: list[str]) -> bool:
    """A subject word is present as itself, its plural, or the base noun of its -y adjective (salty / salt)."""
    for w in words:
        if w == word or w == word + "s" or w + "s" == word or w == word + "es" or w + "es" == word:
            return True
        if len(word) > 4 and word.endswith("y") and w == word[:-1]:
            return True
    return False


def _strip_parens(text: str) -> str:
    out = str(text or "")
    for _ in range(3):
        out = re.sub(r"\([^()]*\)", " ", out)
    return re.sub(r"\s+", " ", out).strip()


def clauses(text: str) -> list[str]:
    """Sentences, then ';' clauses. A decimal point is not a boundary."""
    out = []
    for sentence in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"'])", str(text or "").strip()):
        for part in sentence.split(";"):
            part = _strip_parens(part).strip(" .!?")
            if part:
                out.append(part)
    return out[:12]


def _subject_head(subj: str) -> str:
    """The subject noun phrase: the part before a comma appositive or aside ("DNA, or deoxyribonucleic acid,")."""
    return subj.split(",")[0].strip() if "," in subj else subj.strip()


def copular(clause: str) -> dict[str, Any] | None:
    """FR.BE.COP on one clause. The engine's parse_sentence reads 'is'; are/was/were and the naming verbs read alike."""
    low = " " + clause.lower() + " "
    best = None
    for verb in _NAMING + _COPULA:
        m = re.search(r"\s" + re.escape(verb) + r"\s", low)
        if m and (best is None or m.start() < best[0] or (m.start() == best[0] and len(verb) > len(best[1]))):
            best = (m.start(), verb)
    if not best:
        return None
    start, verb = best
    subj = clause[: max(0, start)].strip(" ,")
    pred = clause[start + len(verb) + 1:].strip(" ,")
    if verb == "is":
        parsed = parse_sentence(clause)
        atom = (parsed or {}).get("atom") or {}
        if parsed and parsed.get("parsed") and atom.get("predicate") == "is" and len(atom.get("args") or []) == 2:
            subj, pred = str(atom["args"][0]).strip(" ,"), str(atom["args"][1]).strip(" ,")
    if not subj or not pred:
        return None
    pw = _words(pred)
    neg = bool(pw) and pw[0] in _NEG or (verb == "is" and clause.lower().find(" is not ") >= 0 and clause.lower().find(" is not ") <= start)
    while pw and pw[0] in _NEG | {"also", "now", "often", "usually", "generally", "sometimes", "still", "actually", "really", "always"}:
        pw = pw[1:]
    if verb in _NAMING:
        kind = "naming"
    elif not pw:
        kind = "none"
    elif pw[0] in _DET or pw[0] in {"one", "any", "each", "some", "two", "three", "his", "her", "its", "their", "our", "my", "your"} \
            or re.match(r"^\W*(?:[A-Z][\w-]*|[\w-]+['’]s)\b", re.sub(r"^(?:(?:not|also|now|often|usually|generally|sometimes|still|actually|really|always)\s+)+", "", pred)):
        # a determiner, a possessive ("Earth's only natural satellite") or a name opens a noun-phrase predicate
        kind = "np"
    elif pw[0] in _NAMING_PART and (pw[0] in {"called", "named", "termed"} or pw[1:2] == ["as"]):
        # "is called X", "is known as X"; "is known for its rings" is a passive, not a name
        kind = "naming"
    elif pw[0].endswith("ing") and len(pw[0]) > 4:
        kind = "progressive"
    elif (pw[0].endswith("ed") and len(pw[0]) > 3) or pw[0] in _IRREG_PART:
        kind = "passive"
    else:
        kind = "attribute"
    return {"subject": _subject_head(subj), "subject_full": subj, "verb": verb, "predicate": pred, "kind": kind,
            "negated": bool(neg)}


def asked(question: str) -> dict[str, Any]:
    """The relation and subject a question asks for."""
    q = re.sub(r"\s+", " ", str(question or "").strip()).rstrip(" ?.!")
    low = q.lower()
    w = _words(low)
    out = {"relation": "unclassified", "subject": [], "head": "", "about": [], "verb": ""}
    if not w:
        return out
    from rmc_engine_v1.echo_question import _asked_slot
    slot = _asked_slot(question)
    m = re.match(r"^(?:what|which)\s+(\w+)\s+(?:is|are|was|were)\s+(.+)$", low)
    if slot and m and m.group(1) == slot[0]:
        np = _norm_np(m.group(2))
        return {"relation": "attribute", "subject": np, "head": np[-1] if np else "", "about": _content(np),
                "slot": slot[0], "verb": ""}
    m = re.match(r"^(?:what|who)\s+(?:is|are|was|were)\s+(.+)$", low)
    if m:
        np = _norm_np(m.group(1))
        if not np or np[-1] in {"of", "in", "on", "for", "with", "from", "about", "like", "made", "called"} or np[0] in {"it", "that", "this", "there", "you", "i", "we", "they", "he", "she"}:
            return out
        if "of" in np:
            head = np[np.index("of") - 1] if np.index("of") > 0 else np[-1]
            rel = "identify"
        elif np[0] == "@owner" or np[0].endswith("est") or np[0] in _SUPERLATIVE_EXTRA or (len(np) > 1 and np[0] in {"tallest", "longest"}):
            head, rel = np[-1], "identify"
        else:
            head, rel = np[-1], "definition"
        return {"relation": rel, "subject": np, "head": head, "about": _content(np), "verb": ""}
    m = re.match(r"^why\s+(is|are|was|were|do|does|did|can|could|would|will|has|have)\s+(.+)$", low)
    if m:
        rest = _content(_norm_np(m.group(2)))
        about = rest[:-1] if m.group(1) in _COPULA and len(rest) > 1 else rest[:1]
        return {"relation": "cause", "subject": about, "head": about[0] if about else "", "about": about, "verb": ""}
    m = re.match(r"^how\s+(many|much)\s+(.+)$", low) or re.match(r"^how\s+(" + "|".join(sorted(_QUANT_ADJ)) + r")\s+(?:is|are|was|were|does|do|did)?\s*(.+)$", low)
    if m:
        about = _content(_norm_np(m.group(2)))
        return {"relation": "quantity", "subject": about, "head": about[0] if about else "", "about": about, "verb": ""}
    m = re.match(r"^where\s+(is|are|was|were|do|does|did)\s+(.+)$", low)
    if m:
        about = _content(_norm_np(m.group(2)))
        # do-support: the last word is the asked verb ("when did the war end"), not the subject
        about = about[:-1] if m.group(1) in {"do", "does", "did"} and len(about) > 1 else about
        return {"relation": "location", "subject": about, "head": about[0] if about else "", "about": about, "verb": ""}
    m = re.match(r"^when\s+(is|are|was|were|do|does|did)\s+(.+)$", low)
    if m:
        about = _content(_norm_np(m.group(2)))
        # do-support: the last word is the asked verb ("when did the war end"), not the subject
        about = about[:-1] if m.group(1) in {"do", "does", "did"} and len(about) > 1 else about
        return {"relation": "time", "subject": about, "head": about[0] if about else "", "about": about, "verb": ""}
    m = re.match(r"^who\s+(\w+)\s+(.+)$", low)
    if m and m.group(1) not in _COPULA + ("do", "does", "did", "can", "could", "will", "would", "has", "have"):
        about = _content(_norm_np(m.group(2)))
        return {"relation": "agent", "subject": about, "head": about[0] if about else "", "about": about,
                "verb": m.group(1)}
    m = re.match(r"^how\s+(?:do|does|did|is|are|was|were|can)\s+(.+)$", low)
    if m:
        about = _content(_norm_np(m.group(1)))
        about = about[:-1] if len(about) > 1 else about
        return {"relation": "manner", "subject": about, "head": about[0] if about else "", "about": about, "verb": ""}
    return out


def _verb_key(word: str) -> str:
    if word in _IRREG_VERB:
        return _IRREG_VERB[word]
    for suf in ("ing", "ed", "es", "s"):
        if word.endswith(suf) and len(word) - len(suf) >= 4:
            return word[: -len(suf)]
    return word


def _about(ask: dict[str, Any], words: list[str]) -> bool:
    about = [a for a in ask.get("about") or [] if a != "@owner"]
    return bool(about) and all(_has_word(a, words) for a in about)


def define_rank(ask: dict[str, Any], text: str) -> dict[str, Any]:
    """How a sentence stands to a definition / identify question.

    rank 2: a copular clause whose subject is the asked subject with a noun-phrase or naming predicate (it defines it);
            for identify, the asked noun phrase fills a side of the copula.
    rank 1: a copular clause whose subject is the asked subject with an adjective predicate (copular attribution).
    rank 0: the subject is only mentioned (another verb, a passive or progressive, another subject, a negation).
    """
    rel = ask.get("relation")
    if rel not in {"definition", "identify", "attribute"}:
        return {"rank": 0, "frame": None}
    subj = ask.get("subject") or []
    best = {"rank": 0, "frame": None}
    for clause in clauses(text):
        if rel == "definition":
            # an appositive is a reduced copula (samanadhikarana): "Saturn, the sixth planet from the Sun, ..." defines Saturn
            app = re.match(r"^([^,]+),\s*((?:a|an|the)\s[^,]+),", clause, flags=re.IGNORECASE)
            if app and _same_np(_norm_np(app.group(1)), subj):
                return {"rank": 2, "frame": "FR.BE.COP", "role": "karta", "kind": "appositive", "clause": clause[:200]}
        cop = copular(clause)
        if not cop or cop["negated"]:
            continue
        s_np = _norm_np(cop["subject"])
        if rel == "definition":
            if _same_np(s_np, subj) and cop["kind"] in {"np", "naming"}:
                return {"rank": 2, "frame": "FR.BE.COP", "role": "karta", "kind": cop["kind"], "clause": clause[:200]}
            if _same_np(s_np, subj) and cop["kind"] == "attribute" and best["rank"] < 1:
                best = {"rank": 1, "frame": "FR.BE.COP", "role": "karta", "kind": "attribute", "clause": clause[:200]}
        elif rel == "identify":
            p_np = _norm_np(cop["predicate"])
            cw = _words(clause)
            sides = (s_np, p_np)
            for side_i, side in enumerate(sides):
                if ask.get("head") and _has_word(ask["head"], side) and all(_has_word(a, [_OWNER.get(x, x) for x in cw]) for a in ask.get("about") or [] if a != "@owner") \
                        and (subj[0] != "@owner" or "@owner" in side):
                    if cop["kind"] in {"np", "naming", "attribute"}:
                        return {"rank": 2, "frame": "FR.BE.COP", "role": "karta" if side_i == 0 else "karma", "kind": cop["kind"], "clause": clause[:200]}
        else:  # attribute
            if ask.get("head") and s_np and _has_word(ask["head"], s_np[-1:]) and (subj[0] != "@owner" or "@owner" in s_np) \
                    and cop["kind"] in {"attribute", "np"}:
                return {"rank": 2, "frame": "FR.BE.COP", "role": "karta", "kind": cop["kind"], "clause": clause[:200]}
    return best


def realises(question: str, answer: str) -> dict[str, Any]:
    """Echo's relation re-parse. realised None = the question opens no relation this reader classifies."""
    ask = asked(question)
    rel = ask["relation"]
    words = [_OWNER.get(x, x) for x in _words(answer)]
    out: dict[str, Any] = {"asked": rel, "subject": " ".join(ask.get("subject") or []), "realised": None,
                           "method": "relation_reparse", "cite": CITE}
    if rel == "unclassified":
        return out
    if rel in {"definition", "identify"}:
        d = define_rank(ask, answer)
        out["realised"] = d["rank"] >= 1
        out["define_rank"] = d["rank"]
        out["frame"] = d.get("frame")
        out["role"] = d.get("role")
        out["kind"] = d.get("kind")
        return out
    if rel == "attribute":
        from rmc_engine_v1.echo_question import _fills_slot, _asked_slot
        slot = _asked_slot(question)
        d = define_rank(ask, answer)
        out["realised"] = bool(d["rank"] >= 1 and slot and _fills_slot(slot[1], d.get("clause") or ""))
        out["frame"] = d.get("frame")
        return out
    about = _about(ask, words)
    if rel == "cause":
        from rmc_engine_v1.echo_question import states_cause
        stated = states_cause(answer)
        out["realised"] = bool(about and stated)
        out["stated"] = stated
    elif rel == "quantity":
        stated = any(w.isdigit() or re.match(r"^\d", w) or w in _NUMWORDS for w in words)
        out["realised"] = bool(about and stated)
    elif rel == "location":
        out["realised"] = bool(about and any(w in _LOCATIVE for w in words))
    elif rel == "time":
        out["realised"] = bool(about and any(re.match(r"^(1\d{3}|20\d{2})s?$", w) or w in _MONTHS or w in _TIME for w in words))
    elif rel == "agent":
        key = _verb_key(ask.get("verb") or "")
        out["realised"] = bool(about and key and any(_verb_key(w) == key for w in words))
    elif rel == "manner":
        out["realised"] = bool(about)
    out["about"] = about
    return out
