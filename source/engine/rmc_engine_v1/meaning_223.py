"""4.9.223 Athena meaning layer (FORGE-ATHENA-MEANING/v1). Deterministic: Open English WordNet 2025 plus only; no model,
no embeddings, no similarity score.

Agreement between publishers is on MEANING, not on spelling:
  - the subject's meaning is its pinned sense (the curated meaning table, passed in by the caller), else the only noun
    meaning of the asked phrase (longest WordNet multiword lemma first); two or more meanings and no pin -> ask;
  - each source sentence "X is a/an/the <category> ..." gives a category: the head of the predicate noun phrase, the
    longest WordNet noun lemma that ends it ("natural satellite" -> "satellite", "noble gas", "chemical element");
  - a category is ON-CHAIN when one of its senses is the subject sense or one of its hypernym / instance-hypernym
    ancestors (gravity -> force; Moon -> satellite);
  - two categories are COMPATIBLE when they share a sense (synonyms) or one is an ancestor of the other (a more
    specific category: "satellite" under "body");
  - a category that is on the chain of ANOTHER meaning of the same word and not on the pinned one is OFF-SENSE
    for the pinned/resolved meaning (same spelling, different WordNet sense): irrelevant, not a veto
    (4.9.228; Mercury the planet is not contradicted by mercury the element);
  - a category WordNet does not know (azane, methylxanthine) is UNPLACED: it neither agrees nor blocks.
The layer only annotates documents; self_seed_202.evaluate (Python, JS, Pyodide) applies the rule to the annotations.
Lesk-style gloss overlap is logged as an advisory only and never decides."""
from __future__ import annotations

import re
from typing import Any

from rmc_engine_v1 import athena_sources_222 as _src

ANC_LIMIT = 40
GENUS_DEPTH = 2  # a category more specific than the subject's genus (its first two hypernym levels) refines, never contradicts
# 4.9.224 (Nic pt139u/t140u): a category agrees only within HYPERNYM_AGREE_DEPTH hops of the subject sense
# (the sense itself + up to 3 ancestors). WordNet's upper ontology (entity, physical entity, abstraction,
# matter, relation, part/portion) sits deeper and is too general to define a subject; caffeine's
# "component" matched at hop 7/BFS-index 8 and is the case that forced the cap.
# 4.9.228: the cap is shortest-path hop distance, not BFS list index — parallel instance_hypernym parents
# (Saturn → Jovian / superior / outer) must not push the real genus (planet, hop 2) past the cap.
HYPERNYM_AGREE_DEPTH = 4
# Partitive heads that name no category of their own: "a type of star" -> star; "any of various gases" -> gas.
PARTITIVE = {"kind", "type", "sort", "form", "class", "variety", "member", "one", "any", "some", "either", "each", "piece", "part"}
_NP_STOP = {"of", "that", "which", "who", "whom", "whose", "with", "in", "on", "at", "by", "for", "from", "to", "into", "as",
            "and", "or", "but", "where", "when", "made", "used", "consisting", "formed", "having", "found", "produced", "containing",
            "obtained", "occurring", "existing", "between", "about", "around", "than", "like", "such", "including", "orbiting",
            "composed", "derived", "based", "called", "known", "named", "is", "are", "was", "were", "be", "being", "been"}
_DETS = {"a", "an", "the", "any", "one", "some", "each", "either", "its", "our", "their", "earth's", "this", "that",
         "various", "several", "many", "certain", "particular", "specific", "large", "small", "group", "family"}
# question attributes have one fixed meaning (never asked): the OEWN sense each one names
ATTR_SENSES = {"mass": "05031420-n", "capital": "08535783-n", "radius": "05109363-n", "mean radius": "05109363-n",
               "density": "04948630-n", "mean density": "04948630-n", "surface gravity": "11484542-n", "gravity": "11484542-n",
               "escape velocity": "15308772-n"}


def _entries(word: str) -> dict[str, Any]:
    return _src._oewn_entries(word[:1].lower()) if word else {}


def _syn(sid: str) -> dict[str, Any] | None:
    return _src._oewn_synset(sid)


def noun_senses(lemma: str) -> list[str]:
    ent = _entries(lemma).get(lemma) or {}
    return [s["synset"] for s in (ent.get("n") or {}).get("sense") or []]


def _is_noun(word: str) -> bool:
    return any(noun_senses(f) for f in _lemma_forms(word))


def _is_adjective(word: str) -> bool:
    ent = _entries(word).get(word) or {}
    return bool(ent.get("a") or ent.get("s"))


def _is_adverb(word: str) -> bool:
    """An adverb that is not also an adjective or a noun ("naturally", "minimally"; never "heavenly")."""
    ent = _entries(word).get(word) or {}
    if ent:
        return bool(ent.get("r")) and not (ent.get("a") or ent.get("s") or ent.get("n"))
    return word.endswith("ly") and len(word) > 4 and not _is_noun(word)


def _known(word: str) -> bool:
    return any(bool(_entries(f).get(f)) for f in _lemma_forms(word))


def _lemma_forms(word: str) -> list[str]:
    """The noun as written, then plain plural -> singular (gases -> gas, bodies -> body, stars -> star)."""
    out = [word]
    if word.endswith("ies") and len(word) > 4:
        out.append(word[:-3] + "y")
    if word.endswith("es") and len(word) > 3:
        out.append(word[:-2])
    if word.endswith("s") and not word.endswith("ss") and len(word) > 3:
        out.append(word[:-1])
    return out


def ancestors(sid: str) -> list[str]:
    """Hypernym and instance-hypernym closure in a fixed breadth-first order (the sense itself first)."""
    return list(ancestor_distances(sid))


def ancestor_distances(sid: str) -> dict[str, int]:
    """Each hypernym / instance-hypernym ancestor mapped to its shortest-path hop count (the sense itself is 0).
    4.9.228: agreement depth uses hop distance so bushy instance_hypernym fan-outs do not inflate the cap."""
    dist: dict[str, int] = {sid: 0}
    order = [sid]
    i = 0
    while i < len(order) and len(order) < 4000:
        row = _syn(order[i]) or {}
        for nxt in (row.get("hypernym") or []) + (row.get("instance_hypernym") or []):
            if nxt not in dist:
                dist[nxt] = dist[order[i]] + 1
                order.append(nxt)
        i += 1
    return dist


def _forms_of_label(label: str) -> list[str]:
    lab = re.sub(r"^(the|a|an)\s+", "", label.strip(), flags=re.IGNORECASE)
    forms = [lab] if lab[:1].isupper() else [lab, lab.lower()]
    words = lab.split()
    if len(words) == 2:  # "Planck constant" -> "Planck's constant"
        forms.append(words[0] + "'s " + words[1])
    return list(dict.fromkeys(f for f in forms if f))


def resolve_subject(question: str, table: dict[str, Any] | None = None) -> dict[str, Any]:
    """The meaning of the asked subject: pinned, the only meaning, ask (with the candidate meanings), or none."""
    from rmc_engine_v1.self_seed_202 import sentence_placement
    from rmc_engine_v1.lexicon_resonance import packet

    subj = _src.subject_of(question)
    out: dict[str, Any] = {"label": subj["label"], "attr": subj["attr"], "thing": subj["thing"], "state": "none", "sense": None,
                           "candidates": [], "concept": None, "phi": None, "phi_from": None}
    if not subj["label"]:
        return out
    target = subj["thing"] if subj["attr"] else subj["label"]
    if subj["attr"]:
        out["attr_sense"] = ATTR_SENSES.get(subj["attr"])
    bare = re.sub(r"^(the|a|an)\s+", "", target.strip(), flags=re.IGNORECASE)
    concepts = (table or {}).get("concepts") or {}
    pinned = [(cid, r) for cid, r in sorted(concepts.items()) if r.get("surface") == bare.lower() and r.get("sense")]
    if pinned:
        cid, row = pinned[0]
        out.update(state="pinned", sense=row["sense"], concept=cid)
    else:
        senses: list[str] = []
        for form in _forms_of_label(bare):
            senses += noun_senses(form)
            if senses:
                break  # the longest phrase as asked first; never a shorter word inside it
        senses = list(dict.fromkeys(senses))
        if len(senses) == 1:
            out.update(state="resolved", sense=senses[0])
        elif senses:
            out.update(state="ask", candidates=[{"sense": s, "gloss": ((_syn(s) or {}).get("definition") or [""])[0]} for s in senses])
    link = ((table or {}).get("senses") or {}).get(out["sense"] or "") or []
    out["qid"] = _src._qid(link[2] if len(link) > 2 else None) or _src._qid(((_syn(out["sense"]) or {}).get("wikidata")) if out["sense"] else None)
    if out["concept"]:
        row = packet(out["concept"]) or {}
        if isinstance(row.get("Phi"), int):
            out.update(phi=int(row["Phi"]), phi_from="pinned concept " + out["concept"])
    # 4.9.227 (Nic t142u): the retrieval key comes from the subject itself (its pinned concept, else the subject phrase read the
    # way Ask reads a question), never from the concepts of the words inside a source sentence.
    from rmc_engine_v1.resonance_recall import subject_key as _subject_key
    out["key"] = out["concept"] or _subject_key(bare)
    if out["phi"] is None:
        placed = sentence_placement(bare)
        out.update(phi=placed.get("phi"), phi_from=("lexicon concept " + placed["concept"]) if placed.get("concept") else "letter resultant")
    return out


def _predicate(sentence: str) -> str | None:
    from rmc_engine_v1.self_seed_202 import _copula

    parts = _copula(sentence)
    return parts[2] if parts and parts[1] in ("is", "was") else (parts[2] if parts else None)


def category_of(sentence: str) -> dict[str, Any]:
    """Head noun of the predicate noun phrase: {'category': 'satellite', 'phrase': 'the natural satellite', 'known': bool}."""
    pred = _predicate(sentence)
    if not pred:
        return {"category": None, "known": False, "phrase": None}
    words = re.findall(r"[A-Za-z][A-Za-z'\-]*|\d+|[,;:()]", pred)
    low = [w.lower() for w in words]
    i = 0
    while True:  # "any of various ...", "a type of ...", "one of the ..."
        j = i
        while j < len(low) and low[j] in _DETS and low[j] not in PARTITIVE:
            j += 1
        if j + 1 < len(low) and low[j] in PARTITIVE and low[j + 1] == "of":
            i = j + 2
            continue
        if j < len(low) and low[j] in PARTITIVE and j + 1 < len(low) and low[j + 1] not in _NP_STOP:
            i = j + 1
            continue
        i = j
        break
    np: list[str] = []
    for w in low[i:]:
        if w in (",", "and", "or"):
            # "a colorless, odorless gas", "the basic structural and functional unit": a list of modifiers goes on;
            # after a noun the list is a second noun phrase and the first one ends
            if np and (not _is_noun(np[-1]) or (w == "," and _is_adjective(np[-1]))):
                continue
            break
        if w in _NP_STOP or not re.match(r"[a-z]", w):
            break
        if _is_adverb(w):
            if np:
                break
            continue  # "a naturally occurring ..." : a leading adverb is skipped
        if np and re.search(r"(?:ed|ing)$", w) and _is_noun(np[-1]):
            break  # "a pungent gas compounded of ..." / "hormone secreted by ...": a participle after the head noun
        np.append(w)
    while np and np[0] in _DETS:
        np = np[1:]
    while np and _known(np[-1]) and not _is_noun(np[-1]):
        np = np[:-1]  # a trailing modifier with no noun reading ("a colorless") is not a head
    if not np:
        return {"category": None, "known": False, "phrase": None}
    phrase = " ".join(np)
    for start in range(len(np)):  # longest WordNet lemma that ends the noun phrase
        tail = np[start:]
        for k, form in enumerate(_lemma_forms(tail[-1])):
            lemma = " ".join(tail[:-1] + [form])
            if noun_senses(lemma):
                return {"category": lemma, "known": True, "phrase": phrase}
    return {"category": np[-1], "known": False, "phrase": phrase}


def label_category(label: str) -> str | None:
    """A source-ontology label ('hydrides', 'nitrogen hydride') -> the WordNet noun lemma it names, else None."""
    words = [w for w in re.findall(r"[a-z][a-z'\-]*", str(label or "").lower())]
    for start in range(len(words)):
        tail = words[start:]
        for form in _lemma_forms(tail[-1]) if tail else []:
            lemma = " ".join(tail[:-1] + [form])
            if noun_senses(lemma):
                return lemma
    return None


def under_chain(cat: str, chain: list[str]) -> str | None:
    """The genus sense (one of the subject's first GENUS_DEPTH hypernyms) that the category is more specific than."""
    genus = chain[1:1 + GENUS_DEPTH]
    for s in _head_senses(cat):
        up = ancestors(s)
        hit = next((g for g in genus if g in up), None)
        if hit:
            return hit
    return None


def _cat_senses(cat: str) -> list[str]:
    return noun_senses(cat) if cat else []


def _head_senses(cat: str) -> list[str]:
    """The senses in which the category word is the synset's own head word (its first member). 'gas' is read as the
    fluid or the state of matter, never as 'gasoline' or 'natural gas', where it is only an alternative name. Used by the
    looser relations (more specific than the genus, compatible, another meaning) so a rare sense cannot make a match."""
    out = []
    for s in _cat_senses(cat):
        members = (_syn(s) or {}).get("members") or []
        if members and str(members[0]).lower() == cat.lower():
            out.append(s)
    return out


def chain_sense(cat: str, chain: list[str]) -> str | None:
    """The sense of the category that lies on the subject's chain (the nearest one), else None.
    4.9.224/4.9.228: only ancestors within HYPERNYM_AGREE_DEPTH hops of the subject sense count as agreement."""
    if not chain:
        return None
    dist = ancestor_distances(chain[0])
    hits = [s for s in _cat_senses(cat) if s in dist and dist[s] < HYPERNYM_AGREE_DEPTH]
    return min(hits, key=lambda s: dist[s]) if hits else None


def on_chain(cat: str, chain: list[str]) -> bool:
    return chain_sense(cat, chain) is not None


def on_other_chain(cat: str, chain: list[str]) -> bool:
    return any(s in chain for s in _head_senses(cat))


def compatible(cat: str, sense: str) -> bool:
    """A category agrees with an on-chain category sense when they are synonyms (the category has that very sense) or one
    is the more specific of the other (a hypernym path either way). Anchored on the on-chain SENSE, so a category's
    unrelated meanings cannot make it agree. 4.9.224/4.9.228: the path either way is capped at HYPERNYM_AGREE_DEPTH hops."""
    if not cat or not sense:
        return False
    mine = _head_senses(cat)
    if sense in _cat_senses(cat):
        return True
    up = {s for s, d in ancestor_distances(sense).items() if d < HYPERNYM_AGREE_DEPTH}
    for s in mine:
        if s in up:
            return True
        d2 = ancestor_distances(s)
        if sense in d2 and d2[sense] < HYPERNYM_AGREE_DEPTH:
            return True
    return False


def _other_meanings(label: str, sense: str) -> list[str]:
    out: list[str] = []
    for form in _forms_of_label(label):
        for s in noun_senses(form) + noun_senses(form.lower()) + noun_senses(form[:1].upper() + form[1:]):
            if s != sense and s not in out:
                out.append(s)
    return out


def _lesk(gloss_a: str, gloss_b: str) -> int:
    stop = {"the", "a", "an", "of", "and", "or", "in", "to", "is", "that", "with", "by", "for", "as", "on", "from", "its"}
    wa = {w for w in re.findall(r"[a-z]+", gloss_a.lower()) if w not in stop and len(w) > 2}
    wb = {w for w in re.findall(r"[a-z]+", gloss_b.lower()) if w not in stop and len(w) > 2}
    return len(wa & wb)


def annotate(question: str, documents: list[dict[str, Any]], subject: dict[str, Any]) -> dict[str, Any]:
    """Adds doc['meaning'] to each document and returns payload['meaning'] for self_seed_202.evaluate."""
    sense = subject.get("sense") if not subject.get("attr") else None
    chain = ancestors(sense) if sense else []
    others = _other_meanings(subject.get("label") or "", sense) if sense else []
    other_chains = {o: ancestors(o) for o in others}
    gloss = ((_syn(sense) or {}).get("definition") or [""])[0] if sense else ""
    rows: list[dict[str, Any]] = []
    for doc in documents:
        if doc.get("role") not in (None, "source"):
            continue
        cat = category_of(str(doc.get("text") or ""))
        via = None
        if not cat["known"] and doc.get("category_path"):  # the source's own is_a path (ChEBI) up to a word WordNet knows
            for step in doc["category_path"]:
                lemma = label_category(step)
                if lemma:
                    via = {"path": doc["category_path"][:doc["category_path"].index(step) + 1], "source": doc.get("category_path_source")}
                    cat = {"category": lemma, "known": True, "phrase": cat["phrase"]}
                    break
        row: dict[str, Any] = {"category": cat["category"], "phrase": cat["phrase"], "known": cat["known"], "on_chain": False,
                               "under_chain": False, "genus": None, "via": via,
                               "chain_sense": None, "other_meaning": None, "sense": None,
                               "lesk_advisory": _lesk(gloss, str(doc.get("verbatim") or doc.get("text") or ""))}
        if doc.get("source_id") == "oewn":
            row["sense"] = (doc.get("how") or {}).get("synset")
        if sense and cat["known"]:
            row["chain_sense"] = chain_sense(cat["category"], chain)
            row["on_chain"] = row["chain_sense"] is not None
            if not row["on_chain"]:
                g = under_chain(cat["category"], chain)
                row["under_chain"], row["genus"] = g is not None, g
        doc["meaning"] = row
        rows.append(row)
    on = {r["category"]: r["chain_sense"] for r in rows if r["on_chain"]}
    pairs: list[list[str]] = []
    for r in rows:
        if not sense or not r["known"] or r["on_chain"] or r["under_chain"]:
            continue
        hits = sorted(c for c, cs in on.items() if compatible(r["category"], cs))
        pairs += [[r["category"], c] for c in hits if [r["category"], c] not in pairs]
        if not hits:  # off the pinned meaning's chain: a contradiction only when it is another meaning of the same word
            r["other_meaning"] = next((o for o in others if on_other_chain(r["category"], other_chains[o])), None)
    return {"subject_sense": sense, "subject_phi": subject.get("phi"), "phi_from": subject.get("phi_from"),
            "subject_key": [subject["key"]] if subject.get("key") else [],
            "compatible": pairs, "schema": "FORGE-ATHENA-MEANING/v1"}
