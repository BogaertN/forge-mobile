"""Computed trust tier (4.9.216, Nic). No seed answers, no per-question tuning, no LLM.

A math question is read by a small deterministic grammar into a symbolic tree (numbers, the four operations,
percent, powers, roots, one-variable equations, a pair of linear equations, unit conversions). Only what the grammar understands becomes an
expression; nothing is passed to eval or to a parser of the user's raw text. The tree is computed with SymPy
(exact arithmetic, solve for one variable) or with Pint when units are involved (explicit units only; an ambiguous
unit such as "gallon" is held with a clarifying question). The result is written as one answer sentence plus a
computation receipt. The receipt is the premise of the sentence: it goes into memory with tier "computed", and the
normal pipeline and admit gate decide. Echo re-parses the spoken sentence with the same grammar and recomputes it:
the left side must be the asked quantity and the right side its value. Anything the grammar cannot read is held.

understand() needs no library. compute() and echo() need sympy (and pint for units). When a library is missing the
caller reports needs_libs and the phone loads the pinned wheels (data/forge_libs.json) and asks again.
"""
from __future__ import annotations

import hashlib
import json
import re
from fractions import Fraction
from typing import Any

RECEIPT_SCHEMA = "FORGE-COMPUTATION-RECEIPT/v1"
TIER = "computed"
LIBS = {"sympy": ["mpmath", "sympy"], "pint": ["typing_extensions", "platformdirs", "flexcache", "flexparser", "pint"]}
MAX_EXP = 4096          # |exponent| bound for powers
MAX_DIGITS = 4000       # result size bound (digits) before it is held as too large

# ---------------------------------------------------------------- tokens
_NUM_WORDS = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9,
    "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20, "thirty": 30, "forty": 40, "fifty": 50,
    "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90,
}
_SCALES = {"hundred": 100, "thousand": 1000, "million": 10 ** 6, "billion": 10 ** 9, "trillion": 10 ** 12}
_PHRASES = [  # longest first; each becomes one operator token
    ("to the power of", "^"), ("raised to the power of", "^"), ("raised to the", "^"), ("raised to", "^"),
    ("multiplied by", "*"), ("divided by", "/"), ("times", "*"), ("plus", "+"), ("minus", "-"), ("over", "/"),
    ("the square root of", "SQRT"), ("the cube root of", "CBRT"), ("square root of", "SQRT"), ("cube root of", "CBRT"), ("squared", "SQ"), ("cubed", "CU"),
    ("percent of", "PCTOF"), ("per cent of", "PCTOF"), ("% of", "PCTOF"), ("percent", "PCT"), ("per cent", "PCT"),
    ("the sum of", "SUM"), ("sum of", "SUM"), ("the product of", "PROD"), ("product of", "PROD"),
    ("the difference between", "DIFF"), ("the difference of", "DIFF"), ("difference between", "DIFF"),
    ("the quotient of", "QUOT"), ("quotient of", "QUOT"), ("negative", "NEG"),
]
_SYMBOLS = {"+": "+", "-": "-", "−": "-", "–": "-", "*": "*", "×": "*", "·": "*", "/": "/", "÷": "/", "^": "^",
            "(": "(", ")": ")", "=": "=", "%": "PCT", "√": "SQRT", "∛": "CBRT", "²": "SQ", "³": "CU"}
_CUES = ("^", "*", "/", "+", "-", "SQRT", "CBRT", "SQ", "CU", "PCT", "PCTOF", "SUM", "PROD", "DIFF", "QUOT", "=")
_LEAD = re.compile(r"^(?:please\s+|hey\s+|ok\s+)?(?:can you\s+|could you\s+)?(?:tell me\s+)?(?:what is|what's|whats|what are|how much is|"
                   r"calculate|compute|evaluate|work out|find)\s+", re.I)


def _norm(text: str) -> str:
    t = " " + str(text or "").strip().lower() + " "
    t = t.replace("**", "^").replace("what’s", "what's")
    t = re.sub(r"(\d),(?=\d{3}\b)", r"\1", t)          # 1,000 → 1000
    t = re.sub(r"\s+", " ", t).strip()
    return t.rstrip("?.! ").strip()


def _words_to_number(words: list[str]) -> int | None:
    total, cur, seen = 0, 0, False
    for w in words:
        if w in _NUM_WORDS:
            cur += _NUM_WORDS[w]; seen = True
        elif w == "hundred" and seen:
            cur *= 100
        elif w in _SCALES and seen:
            total += cur * _SCALES[w]; cur = 0
        elif w == "and" and seen:
            continue
        else:
            return None
    return total + cur if seen else None


def tokenize(text: str, allow_var: bool = False) -> list[tuple[str, Any]] | None:
    """Tokens: ('num', Fraction, surface) ('op', sym) ('var', name). None when a word is not part of the grammar."""
    s = _norm(text)
    out: list[tuple[str, Any]] = []
    i = 0
    while i < len(s):
        ch = s[i]
        if ch == " ":
            i += 1; continue
        m = re.match(r"\d+(?:\.\d+)?|\.\d+", s[i:])
        if m:
            raw = m.group(0)
            out.append(("num", Fraction(raw), raw))
            i += len(raw)
            if allow_var and i < len(s) and s[i] in "xyzn" and (i + 1 == len(s) or not s[i + 1].isalpha()):
                out.append(("op", "*")); out.append(("var", s[i])); i += 1
            continue
        hit = None
        for phrase, sym in _PHRASES:
            if s.startswith(phrase, i) and (i + len(phrase) == len(s) or not s[i + len(phrase)].isalpha() or phrase.startswith("%")):
                hit = (phrase, sym); break
        if hit:
            out.append(("op", hit[1])); i += len(hit[0]); continue
        if ch in _SYMBOLS:
            out.append(("op", _SYMBOLS[ch])); i += 1; continue
        m = re.match(r"[a-z]+(?:-[a-z]+)*", s[i:])
        if m:
            word = m.group(0)
            parts = word.split("-")
            if all(p in _NUM_WORDS or p in _SCALES for p in parts):
                # a run of number words: twenty-three, one hundred and five
                j = i + len(word); run = parts[:]
                while True:
                    m2 = re.match(r" (and )?([a-z]+(?:-[a-z]+)*)", s[j:])
                    if not m2 or not all(p in _NUM_WORDS or p in _SCALES for p in m2.group(2).split("-")):
                        break
                    run += (["and"] if m2.group(1) else []) + m2.group(2).split("-"); j += len(m2.group(0))
                n = _words_to_number(run)
                if n is None:
                    return None
                out.append(("num", Fraction(n), str(n))); i = j; continue
            if word in ("the", "of") and out and out[-1] == ("op", "^"):
                i += len(word); continue                      # "raised to the 3rd" handled as "raised to"
            if word == "x" and out and out[-1][0] in ("num", "close") and not allow_var:
                out.append(("op", "*")); i += 1; continue   # 3 x 4
            if allow_var and len(word) == 1 and word in "xyzn":
                out.append(("var", word)); i += 1; continue
            if word == "and":
                out.append(("op", "AND")); i += 3; continue
            if word in ("power",) and out and out[-1] == ("op", "^"):
                i += len(word); continue
            return None
        return None
    # "2 ^ 3rd" style ordinals are not in the grammar; everything above is.
    return out


# ---------------------------------------------------------------- grammar (recursive descent → tree)
class _P:
    def __init__(self, toks):
        self.t = toks; self.i = 0

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else None

    def eat(self, sym=None):
        tok = self.peek()
        if tok is None or (sym is not None and tok != ("op", sym)):
            raise ValueError("expected " + str(sym))
        self.i += 1
        return tok

    def at(self, *syms):
        tok = self.peek()
        return tok is not None and tok[0] == "op" and tok[1] in syms

    def expr(self):
        node = self.term()
        while self.at("+", "-"):
            op = self.eat()[1]
            node = ("add" if op == "+" else "sub", node, self.term())
        return node

    def term(self):
        node = self.power()
        while self.at("*", "/", "PCTOF"):
            op = self.eat()[1]
            rhs = self.power()
            if op == "PCTOF":
                raise ValueError("percent needs a number")
            node = ("mul" if op == "*" else "div", node, rhs)
        return node

    def power(self):
        node = self.unary()
        while True:
            if self.at("^"):
                self.eat(); node = ("pow", node, self.unary())
            elif self.at("SQ"):
                self.eat(); node = ("pow", node, ("num", Fraction(2), "2"))
            elif self.at("CU"):
                self.eat(); node = ("pow", node, ("num", Fraction(3), "3"))
            elif self.at("PCT"):
                self.eat()
                if self.at("PCTOF") or (self.peek() is not None and self.peek() == ("op", "AND")):
                    raise ValueError("percent form")
                node = ("pct", node)
            elif self.at("PCTOF"):
                self.eat(); node = ("pctof", node, self.unary())
            else:
                return node

    def unary(self):
        if self.at("-", "NEG"):
            self.eat(); return ("neg", self.unary())
        if self.at("SQRT"):
            self.eat(); return ("root", 2, self.unary_pow())
        if self.at("CBRT"):
            self.eat(); return ("root", 3, self.unary_pow())
        if self.at("SUM", "PROD", "DIFF", "QUOT"):
            op = self.eat()[1]
            a = self.power(); self.eat("AND"); b = self.power()
            return {"SUM": "add", "PROD": "mul", "DIFF": "sub", "QUOT": "div"}[op], a, b
        return self.primary()

    def unary_pow(self):
        node = self.unary()
        while self.at("^", "SQ", "CU"):
            if self.at("^"):
                self.eat(); node = ("pow", node, self.unary())
            elif self.at("SQ"):
                self.eat(); node = ("pow", node, ("num", Fraction(2), "2"))
            else:
                self.eat(); node = ("pow", node, ("num", Fraction(3), "3"))
        return node

    def primary(self):
        tok = self.peek()
        if tok is None:
            raise ValueError("end")
        if tok[0] == "num":
            self.i += 1
            if self.peek() is not None and self.peek()[0] == "op" and self.peek()[1] == "(":
                self.eat("("); inner = self.expr(); self.eat(")")
                return ("mul", tok, inner)
            return tok
        if tok[0] == "var":
            self.i += 1; return tok
        if tok == ("op", "("):
            self.eat("("); inner = self.expr(); self.eat(")")
            return ("paren", inner)
        raise ValueError("unexpected " + str(tok))


def _parse_expr(toks):
    p = _P(toks)
    node = p.expr()
    if p.i != len(toks):
        raise ValueError("left over")
    return node


def _vars(node) -> set[str]:
    if not isinstance(node, tuple):
        return set()
    if node[0] == "var":
        return {node[1]}
    out = set()
    for part in node[1:]:
        out |= _vars(part)
    return out


# ---------------------------------------------------------------- units (explicit only)
_UNITS = {
    # length
    "meter": "meter", "metre": "meter", "m": "meter", "kilometer": "kilometer", "kilometre": "kilometer", "km": "kilometer",
    "centimeter": "centimeter", "centimetre": "centimeter", "cm": "centimeter", "millimeter": "millimeter", "millimetre": "millimeter",
    "mm": "millimeter", "mile": "mile", "mi": "mile", "nautical mile": "nautical_mile", "inch": "inch", "in": "inch",
    "foot": "foot", "feet": "foot", "ft": "foot", "yard": "yard", "yd": "yard",
    # mass
    "gram": "gram", "g": "gram", "kilogram": "kilogram", "kg": "kilogram", "milligram": "milligram", "mg": "milligram",
    "pound": "pound", "lb": "pound", "lbs": "pound", "metric ton": "metric_ton", "tonne": "metric_ton", "short ton": "short_ton",
    "long ton": "long_ton", "stone": "stone", "avoirdupois ounce": "ounce", "ounce of mass": "ounce", "troy ounce": "troy_ounce",
    # volume
    "liter": "liter", "litre": "liter", "l": "liter", "milliliter": "milliliter", "millilitre": "milliliter", "ml": "milliliter",
    "us gallon": "gallon", "imperial gallon": "imperial_gallon", "us quart": "quart", "imperial quart": "imperial_quart",
    "us pint": "pint", "imperial pint": "imperial_pint", "us cup": "cup", "us fluid ounce": "fluid_ounce",
    "imperial fluid ounce": "imperial_fluid_ounce", "cubic meter": "meter ** 3", "cubic centimeter": "centimeter ** 3",
    # area
    "square meter": "meter ** 2", "square kilometer": "kilometer ** 2", "square foot": "foot ** 2", "square feet": "foot ** 2",
    "square mile": "mile ** 2", "acre": "acre", "hectare": "hectare",
    # time
    "second": "second", "s": "second", "sec": "second", "minute": "minute", "min": "minute", "hour": "hour", "hr": "hour", "h": "hour",
    "day": "day", "week": "week",
    # temperature (offset units)
    "celsius": "degree_Celsius", "degree celsius": "degree_Celsius", "degrees celsius": "degree_Celsius", "°c": "degree_Celsius",
    "fahrenheit": "degree_Fahrenheit", "degree fahrenheit": "degree_Fahrenheit", "degrees fahrenheit": "degree_Fahrenheit",
    "°f": "degree_Fahrenheit", "kelvin": "kelvin",
    # energy, power, pressure
    "joule": "joule", "kilojoule": "kilojoule", "kilocalorie": "kilocalorie", "watt": "watt", "kilowatt": "kilowatt",
    "kilowatt hour": "kilowatt_hour", "horsepower": "horsepower", "pascal": "pascal", "kilopascal": "kilopascal", "bar": "bar",
    "atmosphere": "atmosphere",
    # speed
    "miles per hour": "mile / hour", "mph": "mile / hour", "kilometers per hour": "kilometer / hour", "km/h": "kilometer / hour",
    "kph": "kilometer / hour", "meters per second": "meter / second", "m/s": "meter / second", "knot": "knot",
}
_AMBIGUOUS = {
    "gallon": ["US gallon", "imperial gallon"], "quart": ["US quart", "imperial quart"], "pint": ["US pint", "imperial pint"],
    "cup": ["US cup", "metric cup (250 mL)"], "fluid ounce": ["US fluid ounce", "imperial fluid ounce"],
    "ounce": ["avoirdupois ounce (mass)", "troy ounce", "US fluid ounce"], "oz": ["avoirdupois ounce (mass)", "troy ounce", "US fluid ounce"],
    "ton": ["metric ton", "short ton", "long ton"], "calorie": ["small calorie", "kilocalorie (food Calorie)"],
    "year": ["365-day year", "Julian year (365.25 days)"], "month": ["30-day month", "1/12 of a year"],
    "degree": ["degree Celsius", "degree Fahrenheit"], "degrees": ["degrees Celsius", "degrees Fahrenheit"],
}
_UNIT_WORDS = sorted(set(_UNITS) | set(_AMBIGUOUS), key=len, reverse=True)
_PLURAL_SPECIAL = {"feet": "foot", "inches": "inch", "degrees": "degrees", "celsius": "celsius", "fahrenheit": "fahrenheit", "lbs": "lbs", "mph": "mph", "kph": "kph"}


def _unit(phrase: str) -> tuple[str, str, Any]:
    """('ok', pint_name, surface) | ('ambiguous', word, options) | ('unknown', phrase, None)."""
    p = phrase.strip().lower()
    p = re.sub(r"^(?:a|an|the)\s+", "", p)
    cands = [p]
    if p in _PLURAL_SPECIAL:
        cands = [_PLURAL_SPECIAL[p], p]
    else:
        for suf, rep in (("ies", "y"), ("es", ""), ("s", "")):
            if p.endswith(suf) and len(p) > len(suf) + 1:
                cands.append(p[: -len(suf)] + rep)
        # "kilometers per hour" style: plural on the first word
        words = p.split(" ")
        if len(words) > 1 and words[0].endswith("s"):
            cands.append(" ".join([words[0][:-1]] + words[1:]))
    for c in cands:
        if c in _UNITS:
            return "ok", _UNITS[c], c
    for c in cands:
        if c in _AMBIGUOUS:
            return "ambiguous", c, _AMBIGUOUS[c]
    return "unknown", p, None


_CONV = [
    re.compile(r"^(?:convert\s+)?(?P<n>[-\d./ a-z]+?)\s+(?P<u>[a-z°/ ]+?)\s+(?:to|into|in|as)\s+(?P<t>[a-z°/ ]+)$"),
    re.compile(r"^how many\s+(?P<t>[a-z°/ ]+?)\s+(?:are|is)\s+(?:there\s+)?in\s+(?P<n>[-\d./ a-z]+?)\s+(?P<u>[a-z°/ ]+)$"),
    re.compile(r"^how many\s+(?P<t>[a-z°/ ]+?)\s+(?:are|is)\s+(?P<n>[-\d./ a-z]+?)\s+(?P<u>[a-z°/ ]+)$"),
]


def _number_only(text: str) -> Fraction | None:
    toks = tokenize(text)
    if not toks:
        return None
    try:
        tree = _parse_expr(toks)
    except ValueError:
        return None
    if _vars(tree):
        return None
    try:
        return _exact(tree)
    except Exception:
        return None


def _exact(node) -> Fraction:
    """Fraction arithmetic for the plain-number part of a unit question (no powers beyond small ints, no roots)."""
    k = node[0]
    if k == "num":
        return node[1]
    if k == "paren":
        return _exact(node[1])
    if k == "neg":
        return -_exact(node[1])
    a = _exact(node[1]) if k in ("add", "sub", "mul", "div") else None
    if k == "add":
        return a + _exact(node[2])
    if k == "sub":
        return a - _exact(node[2])
    if k == "mul":
        return a * _exact(node[2])
    if k == "div":
        return a / _exact(node[2])
    raise ValueError("not a plain number")


def _one_equation(text: str):
    """One equation as two expression trees, or (None, reason). The reason is the grammar's, not a guessed value."""
    if str(text).count("=") != 1:
        return None, "an equation needs exactly one ="
    left, right = str(text).split("=")
    lt, rt = tokenize(left, allow_var=True), tokenize(right, allow_var=True)
    try:
        if lt is None or rt is None:
            raise ValueError("word")
        return (_parse_expr(lt), _parse_expr(rt)), None
    except ValueError as exc:
        return None, "the equation is outside the math grammar (" + str(exc) + ")"


# ---------------------------------------------------------------- understand (no library needed)
def understand(question: str) -> dict[str, Any] | None:
    """None: not a math question. Otherwise {'status': 'ok'|'unparsed'|'ambiguous_unit', 'kind', 'tree'/..., 'asked'}."""
    q = _norm(question)
    if not q:
        return None
    body = _LEAD.sub("", q).strip()
    has_digit = bool(re.search(r"\d", body)) or bool(re.search(r"\b(" + "|".join(_NUM_WORDS) + r")\b", body))
    # unit conversion
    if has_digit and (body.startswith("convert ") or body.startswith("how many ") or re.search(r"\s(?:to|into|in)\s", body)):
        for rx in _CONV:
            m = rx.match(body)
            if not m:
                continue
            n = _number_only(m.group("n"))
            if n is None:
                continue
            src, dst = _unit(m.group("u")), _unit(m.group("t"))
            if src[0] == "unknown" or dst[0] == "unknown":
                if src[0] == "unknown" and dst[0] == "unknown":
                    continue
                return {"status": "unparsed", "kind": "conversion", "rule": "MATH-UNIT-UNKNOWN",
                        "reason": "unit not in the explicit unit table: " + (src[1] if src[0] == "unknown" else dst[1])}
            for side in (src, dst):
                if side[0] == "ambiguous":
                    return {"status": "ambiguous_unit", "kind": "conversion", "rule": "MATH-UNIT-AMBIGUOUS", "unit": side[1],
                            "options": side[2], "clarify": "Which " + side[1] + " do you mean: " + " or ".join(side[2]) + "?"}
            return {"status": "ok", "kind": "conversion", "value": [n.numerator, n.denominator], "value_surface": _fmt_frac(n),
                    "from": src[1], "from_word": src[2], "to": dst[1], "to_word": dst[2], "lib": "pint",
                    "asked": "the quantity in " + dst[2]}
    # equation: solve 2x + 3 = 11 / solve for x: ... / if ... = ..., what is x
    eq = None
    m = re.match(r"^solve(?:\s+for\s+([a-z]))?\s*[:,]?\s*(.+)$", body)
    if m:
        eq = (m.group(1), m.group(2))
    else:
        m = re.match(r"^if\s+(.+?)\s*,?\s*(?:what is|what's|find|solve for)\s+([a-z])$", q)
        if m:
            eq = (m.group(2), m.group(1))
    if eq is not None:
        want, text = eq
        parts = re.split(r"\s+and\s+", text)
        if len(parts) == 2 and want is None and all(p.count("=") == 1 for p in parts):
            parsed = []
            for part in parts:
                got, err = _one_equation(part)
                if err:
                    return {"status": "unparsed", "kind": "system", "rule": "MATH-UNPARSED", "reason": err}
                parsed.append(got)
            vs: set[str] = set()
            for lhs, rhs in parsed:
                vs |= _vars(lhs) | _vars(rhs)
            if len(vs) != 2:
                return {"status": "unparsed", "kind": "system", "rule": "MATH-UNPARSED", "reason": "two unknowns are needed, found " + (",".join(sorted(vs)) or "none")}
            names = sorted(vs)
            return {"status": "ok", "kind": "system", "equations": parsed, "vars": names, "lib": "sympy", "asked": "the values of " + " and ".join(names)}
        if text.count("=") != 1:
            return {"status": "unparsed", "kind": "equation", "rule": "MATH-UNPARSED", "reason": "an equation needs exactly one ="}
        got, err = _one_equation(text)
        if err:
            return {"status": "unparsed", "kind": "equation", "rule": "MATH-UNPARSED", "reason": err}
        lhs, rhs = got
        vs = _vars(lhs) | _vars(rhs)
        if len(vs) != 1 or (want and want not in vs):
            return {"status": "unparsed", "kind": "equation", "rule": "MATH-UNPARSED", "reason": "one unknown is needed, found " + (",".join(sorted(vs)) or "none")}
        var = (want or next(iter(vs)))
        return {"status": "ok", "kind": "equation", "lhs": lhs, "rhs": rhs, "var": var, "lib": "sympy", "asked": "the value of " + var}
    # percent forms with an unknown percent: "what percent of 80 is 12", "12 is what percent of 80"
    m = re.match(r"^(?:what\s+)?(?:percent|percentage)\s+of\s+(.+?)\s+is\s+(.+)$", body) or None
    m2 = re.match(r"^(.+?)\s+is\s+what\s+(?:percent|percentage)\s+of\s+(.+)$", body)
    if m or m2:
        whole_t, part_t = (m.group(1), m.group(2)) if m else (m2.group(2), m2.group(1))
        tw, tp = tokenize(whole_t), tokenize(part_t)
        try:
            if tw is None or tp is None:
                raise ValueError("word")
            whole, part = _parse_expr(tw), _parse_expr(tp)
        except ValueError:
            return {"status": "unparsed", "kind": "percent_of", "rule": "MATH-UNPARSED", "reason": "outside the math grammar"}
        return {"status": "ok", "kind": "percent_of", "part": part, "whole": whole, "lib": "sympy", "asked": "the percent"}
    toks = tokenize(body)
    cue = toks is not None and any(t[0] == "op" and t[1] in _CUES for t in toks) and any(t[0] == "num" for t in toks)
    if toks is None:
        # a word outside the grammar: math only when an operator cue and a number are present
        rough = re.sub(r"[a-z]+\s*/\s*[a-z]+|[a-z]+", " ", body)  # 4.9.245: a unit ratio (m/s, mol/l) is not a division cue
        loose = re.search(r"\d", body) and (re.search(r"[+*/^×÷=%√]|\d\s*-\s*\d", rough) or re.search(r"\b(plus|minus|times|divided|multiplied|squared|cubed|square root|cube root|percent|power|solve)\b", body))
        if loose and not re.match(r"^what\s+(?:will\s+)?happens?\s+(?:if|when)\b", q):  # 4.9.245: an intervention (π/2 pulse) is a simulation ask, not arithmetic
            return {"status": "unparsed", "kind": "expression", "rule": "MATH-UNPARSED", "reason": "a word in the question is outside the math grammar"}
        return None
    if not cue:
        return None
    try:
        tree = _parse_expr(toks)
    except ValueError as exc:
        return {"status": "unparsed", "kind": "expression", "rule": "MATH-UNPARSED", "reason": "the expression does not parse (" + str(exc) + ")"}
    if _vars(tree):
        return {"status": "unparsed", "kind": "expression", "rule": "MATH-UNPARSED", "reason": "an unknown without an equation"}
    return {"status": "ok", "kind": "expression", "tree": tree, "lib": "sympy", "asked": "the value of " + render(tree)}


# ---------------------------------------------------------------- rendering of the asked quantity
def _fmt_frac(f: Fraction) -> str:
    if f.denominator == 1:
        return str(f.numerator)
    d = f.denominator
    while d % 2 == 0:
        d //= 2
    while d % 5 == 0:
        d //= 5
    if d == 1:
        s = format(f.numerator / f.denominator, "f") if abs(f) < 10 ** 15 else str(float(f))
        # exact terminating decimal
        from decimal import Decimal, getcontext
        getcontext().prec = 60
        s = format(Decimal(f.numerator) / Decimal(f.denominator), "f").rstrip("0").rstrip(".")
        return s
    return str(f.numerator) + "/" + str(f.denominator)


_PREC = {"add": 1, "sub": 1, "mul": 2, "div": 2, "pct": 3, "pctof": 2, "pow": 4, "neg": 3, "root": 5, "num": 9, "var": 9, "paren": 9}


def render(node) -> str:
    """Canonical words for a tree. The answer sentence uses it and Echo parses it back."""
    k = node[0]
    if k == "num":
        return node[2] if isinstance(node[2], str) else _fmt_frac(node[1])
    if k == "var":
        return node[1]
    if k == "paren":
        return "(" + render(node[1]) + ")"
    if k == "neg":
        return "-" + _wrap(node[1], 3)
    if k == "root":
        return ("the square root of " if node[1] == 2 else "the cube root of ") + _wrap(node[2], 5)
    if k == "pct":
        return _wrap(node[1], 9) + "%"
    if k == "pctof":
        return _wrap(node[1], 9) + "% of " + _wrap(node[2], 3)
    if k == "pow":
        if node[2][0] == "num" and node[2][1] in (2, 3) and node[2][2] in ("2", "3"):
            return _wrap(node[1], 5) + (" squared" if node[2][1] == 2 else " cubed")
        return _wrap(node[1], 5) + " to the power of " + _wrap(node[2], 5)
    word = {"add": " plus ", "sub": " minus ", "mul": " times ", "div": " divided by "}[k]
    return _wrap(node[1], _PREC[k]) + word + _wrap(node[2], _PREC[k] + 1)


def _wrap(node, prec) -> str:
    s = render(node)
    return "(" + s + ")" if _PREC.get(node[0], 9) < prec and node[0] != "paren" else s


def _render_eq(node) -> str:
    """Symbol form for an equation side: 2x + 3."""
    k = node[0]
    if k == "num":
        return node[2] if isinstance(node[2], str) else _fmt_frac(node[1])
    if k == "var":
        return node[1]
    if k == "paren":
        return "(" + _render_eq(node[1]) + ")"
    if k == "neg":
        return "-" + _render_eq(node[1])
    if k == "mul" and node[1][0] == "num" and node[2][0] == "var":
        return _render_eq(node[1]) + node[2][1]
    if k == "root":
        return ("√" if node[1] == 2 else "∛") + "(" + _render_eq(node[2]) + ")"
    if k == "pow":
        return _render_eq(node[1]) + "^" + _render_eq(node[2])
    if k in ("pct",):
        return _render_eq(node[1]) + "%"
    if k == "pctof":
        return _render_eq(node[1]) + "% of " + _render_eq(node[2])
    sym = {"add": " + ", "sub": " - ", "mul": " * ", "div": " / "}[k]
    return _render_eq(node[1]) + sym + _render_eq(node[2])


# ---------------------------------------------------------------- compute (sympy / pint)
def libs_missing(kind_lib: str) -> list[str]:
    need = ["sympy"] if kind_lib == "sympy" else ["sympy", "pint"]
    missing = []
    for name in need:
        try:
            __import__(name)
        except Exception:
            missing.append(name)
    return missing


def _sym(node, sp, var=None):
    k = node[0]
    if k == "num":
        return sp.Rational(node[1].numerator, node[1].denominator)
    if k == "var":
        return sp.Symbol(node[1])
    if k == "paren":
        return _sym(node[1], sp)
    if k == "neg":
        return -_sym(node[1], sp)
    if k == "root":
        inner = _sym(node[2], sp)
        return sp.sqrt(inner) if node[1] == 2 else sp.real_root(inner, 3)
    if k == "pct":
        return _sym(node[1], sp) / 100
    if k == "pctof":
        return _sym(node[1], sp) / 100 * _sym(node[2], sp)
    a, b = _sym(node[1], sp), _sym(node[2], sp)
    if k == "add":
        return a + b
    if k == "sub":
        return a - b
    if k == "mul":
        return a * b
    if k == "div":
        if b == 0:
            raise ZeroDivisionError("division by zero")
        return a / b
    if k == "pow":
        if b.is_number and abs(b) > MAX_EXP:
            raise OverflowError("exponent too large")
        if a == 0 and b.is_number and b.is_negative:
            raise ZeroDivisionError("zero to a negative power")
        return a ** b
    raise ValueError(k)


def fmt_value(v, sp) -> tuple[str, bool]:
    """(text, exact). Integers and terminating decimals exact; otherwise an exact form and ≈ 10 significant digits."""
    v = sp.nsimplify(v) if v.is_Float else v
    if v.is_Integer:
        s = str(v)
        if len(s.lstrip("-")) > MAX_DIGITS:
            raise OverflowError("result too large")
        return s, True
    if v.is_Rational:
        f = Fraction(int(v.p), int(v.q))
        s = _fmt_frac(f)
        if "/" in s:
            return s + " (≈ " + _approx(v, sp) + ")", True
        return s, True
    if v.is_real is False or v.has(sp.I):
        raise ValueError("not a real number")
    exact = str(v).replace("sqrt", "√").replace("**", "^").replace("*", "·")
    return exact + " ≈ " + _approx(v, sp), False


def _pct_text(v, sp) -> tuple[str, bool]:
    """A percentage: an integer or terminating decimal as is, otherwise '≈ ' and 10 significant digits."""
    text, exact = fmt_value(v, sp)
    if " (≈ " in text or " ≈ " in text:
        return "≈ " + _approx(v, sp), False
    return text, exact


def _approx(v, sp) -> str:
    s = str(sp.N(v, 10))
    if "." in s and "e" not in s:
        s = s.rstrip("0").rstrip(".")
    return s


def _unit_word(word: str, plural: bool) -> str:
    if not plural:
        return word
    special = {"foot": "feet", "inch": "inches", "celsius": "degrees Celsius", "fahrenheit": "degrees Fahrenheit",
               "degree celsius": "degrees Celsius", "degree fahrenheit": "degrees Fahrenheit", "kelvin": "kelvin",
               "mph": "mph", "kph": "kph", "km": "km", "m": "m", "cm": "cm", "mm": "mm", "kg": "kg", "g": "g", "mg": "mg",
               "lb": "lb", "ml": "mL", "l": "L", "s": "s", "h": "h", "km/h": "km/h", "m/s": "m/s", "°c": "°C", "°f": "°F"}
    if word in special:
        return special[word]
    if " per " in word:
        head, tail = word.split(" per ", 1)
        return _unit_word(head, True) + " per " + tail
    if word.startswith(("square ", "cubic ")) and not word.endswith("s"):
        return word + "s" if not word.endswith("foot") else word[:-4] + "feet"
    if word.endswith(("s", "x", "z")):
        return word
    return word + "s"


def _canon(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"), default=str)


def compute(question: str, u: dict[str, Any] | None = None) -> dict[str, Any]:
    """Compute an understood question. Returns {'status': 'ok', 'sentence', 'receipt', 'row'} or a held status."""
    u = u if u is not None else understand(question)
    if not u:
        return {"status": "not_math"}
    if u.get("status") != "ok":
        return dict(u)
    missing = libs_missing(u["lib"])
    if missing:
        return {"status": "needs_libs", "needs_libs": missing, "kind": u["kind"], "rule": "MATH-LIBS-NOT-LOADED"}
    import sympy as sp
    libs = {"sympy": sp.__version__}
    try:
        if u["kind"] == "expression":
            v = sp.simplify(_sym(u["tree"], sp))
            text, exact = fmt_value(v, sp)
            lhs = render(u["tree"])
            sentence = lhs[0].upper() + lhs[1:] + " is " + text + "."
            result = {"value": str(v), "text": text, "exact": exact}
            expression = str(_sym(u["tree"], sp))
        elif u["kind"] == "percent_of":
            whole, part = _sym(u["whole"], sp), _sym(u["part"], sp)
            if whole == 0:
                raise ZeroDivisionError("percent of zero")
            v = sp.simplify(part / whole * 100)
            text, exact = _pct_text(v, sp)
            sentence = render(u["part"]) + " is " + text + "% of " + render(u["whole"]) + "."
            sentence = sentence[0].upper() + sentence[1:]
            result = {"value": str(v), "text": text + "%", "exact": exact}
            expression = "(" + str(part) + ")/(" + str(whole) + ")*100"
        elif u["kind"] == "equation":
            x = sp.Symbol(u["var"])
            eqn = sp.Eq(_sym(u["lhs"], sp), _sym(u["rhs"], sp))
            sols = sp.solve(eqn, x, dict=False)
            if eqn is sp.true or (isinstance(eqn, bool) and eqn):
                return {"status": "unparsed", "kind": "equation", "rule": "MATH-IDENTITY", "reason": "every value of " + u["var"] + " satisfies it"}
            real = [s for s in sols if s.is_real is not False]
            if not real:
                text = "no real solution"
                sentence = "Solving " + _render_eq(u["lhs"]) + " = " + _render_eq(u["rhs"]) + " gives no real solution for " + u["var"] + "."
            else:
                parts = []
                for s in sorted(real, key=lambda z: float(sp.N(z))):
                    t, _ = fmt_value(sp.nsimplify(s), sp)
                    parts.append(u["var"] + " = " + t)
                text = " or ".join(parts)
                sentence = "Solving " + _render_eq(u["lhs"]) + " = " + _render_eq(u["rhs"]) + " gives " + text + "."
            result = {"solutions": [str(s) for s in real], "text": text, "exact": True}
            expression = str(eqn)
        elif u["kind"] == "system":
            syms = [sp.Symbol(name) for name in u["vars"]]
            eqs = [sp.Eq(_sym(lhs, sp), _sym(rhs, sp)) for lhs, rhs in u["equations"]]
            found = sp.solve(eqs, syms, dict=True)
            shown = " and ".join(_render_eq(lhs) + " = " + _render_eq(rhs) for lhs, rhs in u["equations"])
            real = []
            for sol in found:
                if all(sol[s].is_real is not False for s in syms):
                    real.append(sol)
            if not real:
                text = "no solution"
                sentence = "Solving " + shown + " gives no solution."
            else:
                chunks = []
                for sol in real:
                    bits = []
                    for name, sym in zip(u["vars"], syms):
                        t, _ex = fmt_value(sp.nsimplify(sol[sym]), sp)
                        bits.append(name + " = " + t)
                    chunks.append(" and ".join(bits))
                text = " or ".join(chunks)
                sentence = "Solving " + shown + " gives " + text + "."
            result = {"solutions": [str(sol) for sol in real], "text": text, "exact": True}
            expression = " ; ".join(str(eq) for eq in eqs)
        elif u["kind"] == "conversion":
            import pint
            libs["pint"] = pint.__version__
            ureg = _ureg(pint)
            n = Fraction(u["value"][0], u["value"][1])
            q = ureg.Quantity(float(n), ureg.parse_units(u["from"])) if " " not in u["from"] else ureg.Quantity(float(n), u["from"])
            out = q.to(ureg.parse_units(u["to"]) if " " not in u["to"] else u["to"])
            mag = float(out.magnitude)
            text = _fmt_float(mag)
            approx = repr(mag) != text and float(text) != mag
            sentence = u["value_surface"] + " " + _unit_word(u["from_word"], n != 1) + " is " + ("≈ " if approx else "") + text + " " + _unit_word(u["to_word"], mag != 1) + "."
            result = {"value": mag, "text": text + " " + _unit_word(u["to_word"], mag != 1), "exact": False,
                      "from": u["from"], "to": u["to"]}
            expression = u["value_surface"] + " " + u["from"] + " -> " + u["to"]
        else:
            return {"status": "unparsed", "rule": "MATH-UNPARSED", "reason": "kind"}
    except ZeroDivisionError as exc:
        return {"status": "undefined", "kind": u["kind"], "rule": "MATH-UNDEFINED", "reason": str(exc)}
    except OverflowError as exc:
        return {"status": "too_large", "kind": u["kind"], "rule": "MATH-TOO-LARGE", "reason": str(exc)}
    except Exception as exc:  # outside what can be computed exactly: held, never guessed
        return {"status": "uncomputable", "kind": u["kind"], "rule": "MATH-UNCOMPUTABLE", "reason": type(exc).__name__ + ": " + str(exc)[:160]}
    body = {
        "schema": RECEIPT_SCHEMA, "question": _norm(question), "kind": u["kind"], "asked": u.get("asked"),
        "expression": expression, "result": result, "libraries": libs, "calls_llm": False, "seeded": False,
    }
    rid = "calc:" + hashlib.sha256(_canon(body).encode("utf-8")).hexdigest()[:24]
    receipt = dict(body, receipt_id=rid)
    row = {"id": rid, "text": sentence, "tier": TIER, "trust": "trusted", "computed": True,
           "provenance": {"source": "computation", "receipt": receipt, "question_key": question_key(question)},
           "contributor": "sympy" if u["lib"] == "sympy" else "pint", "license": "computed on this phone"}
    return {"status": "ok", "kind": u["kind"], "sentence": sentence, "receipt": receipt, "row": row, "understood": _public(u)}


_UREG = {}


def _ureg(pint):
    if "r" not in _UREG:
        _UREG["r"] = pint.UnitRegistry(autoconvert_offset_to_baseunit=True, cache_folder=None)
    return _UREG["r"]


def _fmt_float(x: float) -> str:
    s = "%.10g" % x
    if "e" in s:
        return s
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


def _public(u: dict[str, Any]) -> dict[str, Any]:
    out = {k: v for k, v in u.items() if k not in ("tree", "lhs", "rhs", "part", "whole")}
    for k in ("tree", "lhs", "rhs", "part", "whole"):
        if k in u:
            out[k] = _render_eq(u[k]) if k in ("lhs", "rhs") else render(u[k])
    if "equations" in u:
        out["equations"] = [_render_eq(a) + " = " + _render_eq(b) for a, b in u["equations"]]
    return out


def question_key(question: str) -> str:
    return hashlib.sha256(_norm(question).encode("utf-8")).hexdigest()[:24]


# ---------------------------------------------------------------- Echo: the answer answers the asked quantity
def echo(question: str, reply: str, computed: dict[str, Any] | None) -> dict[str, Any]:
    """Re-parse the spoken sentence with the same grammar and recompute it."""
    base = {"method": "computed_quantity_reparse", "min": 0.85, "compares": "spoken_sentence_reparsed_and_recomputed_against_the_asked_quantity",
            "output_text": reply, "calls_llm": False}
    def fail(why):
        return dict(base, score=0.0, **{"pass": False, "reason": why})
    if not computed or computed.get("status") != "ok":
        return fail("the question is math but nothing was computed: " + str((computed or {}).get("rule") or "unparsed"))
    reply = str(reply or "").strip()
    u = understand(question)
    if not reply or not u or u.get("status") != "ok":
        return fail("no reply or the question no longer parses")
    try:
        import sympy as sp
        s = reply.rstrip(".").strip()
        if u["kind"] == "expression":
            if " is " not in s:
                return fail("the reply is not 'quantity is value'")
            lhs_t, val_t = s.rsplit(" is ", 1)
            toks = tokenize(lhs_t)
            if toks is None:
                return fail("the reply's quantity does not parse")
            lhs = _parse_expr(toks)
            if sp.simplify(_sym(lhs, sp) - _sym(u["tree"], sp)) != 0 or render(lhs) != render(u["tree"]):
                return fail("the reply states a different quantity than the one asked")
            want = sp.simplify(_sym(u["tree"], sp))
            got = _value_of(val_t, sp)
            ok = (got is not None and _same(got, want, sp)) or val_t == fmt_value(want, sp)[0]
        elif u["kind"] == "percent_of":
            m = re.match(r"^(.+?) is (.+?)% of (.+)$", s)
            if not m:
                return fail("the reply is not 'part is p% of whole'")
            part, whole = _parse_expr(tokenize(m.group(1))), _parse_expr(tokenize(m.group(3)))
            if render(part) != render(u["part"]) or render(whole) != render(u["whole"]):
                return fail("the reply names a different part or whole")
            want = sp.simplify(_sym(part, sp) / _sym(whole, sp) * 100)
            got = _value_of(m.group(2), sp)
            ok = (got is not None and _same(got, want, sp)) or m.group(2) == _pct_text(want, sp)[0]
        elif u["kind"] == "equation":
            m = re.match(r"^solving (.+?) = (.+?) gives (.+)$", s, re.I)
            if not m:
                return fail("the reply is not 'solving the equation gives the unknown'")
            lt, rt = tokenize(m.group(1), allow_var=True), tokenize(m.group(2), allow_var=True)
            if lt is None or rt is None:
                return fail("the reply's equation does not parse")
            lhs, rhs = _parse_expr(lt), _parse_expr(rt)
            x = sp.Symbol(u["var"])
            same_eq = sp.simplify((_sym(lhs, sp) - _sym(rhs, sp)) - (_sym(u["lhs"], sp) - _sym(u["rhs"], sp))) == 0
            if not same_eq:
                return fail("the reply solves a different equation")
            # Re-solve the equation the reply states and write its solutions with the same formatter; the reply must
            # say exactly that. Each real solution is also substituted back into the asked equation.
            sols = sorted([z for z in sp.solve(sp.Eq(_sym(lhs, sp), _sym(rhs, sp)), x) if z.is_real is not False], key=lambda z: float(sp.N(z)))
            f = _sym(u["lhs"], sp) - _sym(u["rhs"], sp)
            if not sols:
                ok = m.group(3) == "no real solution for " + u["var"]
            else:
                want_text = " or ".join(u["var"] + " = " + fmt_value(sp.nsimplify(z), sp)[0] for z in sols)
                ok = m.group(3) == want_text and all(abs(complex(sp.N(f.subs(x, z), 30))) <= 1e-9 for z in sols)
        elif u["kind"] == "system":
            m = re.match(r"^solving (.+) gives (.+)$", s, re.I)
            if not m:
                return fail("the reply is not 'solving the equations gives the unknowns'")
            pieces = re.split(r"\s+and\s+", m.group(1))
            if len(pieces) != len(u["equations"]):
                return fail("the reply does not state both equations")
            stated = []
            for piece in pieces:
                got, err = _one_equation(piece)
                if err:
                    return fail("the reply's equation does not parse")
                stated.append(got)
            syms = [sp.Symbol(name) for name in u["vars"]]
            asked = [sp.Eq(_sym(lhs, sp), _sym(rhs, sp)) for lhs, rhs in u["equations"]]
            spoken = [sp.Eq(_sym(lhs, sp), _sym(rhs, sp)) for lhs, rhs in stated]
            same = len(asked) == len(spoken) and all(
                sp.simplify((a.lhs - a.rhs) - (b.lhs - b.rhs)) == 0 for a, b in zip(asked, spoken)
            )
            if not same:
                return fail("the reply solves different equations")
            found = [sol for sol in sp.solve(spoken, syms, dict=True) if all(sol[v].is_real is not False for v in syms)]
            if not found:
                ok = m.group(2) == "no solution"
            else:
                chunks = []
                for sol in found:
                    bits = []
                    for name, sym in zip(u["vars"], syms):
                        bits.append(name + " = " + fmt_value(sp.nsimplify(sol[sym]), sp)[0])
                    chunks.append(" and ".join(bits))
                ok = m.group(2) == " or ".join(chunks)
                for sol in found:
                    for eq in asked:
                        if abs(complex(sp.N((eq.lhs - eq.rhs).subs(sol), 30))) > 1e-9:
                            ok = False
        elif u["kind"] == "conversion":
            import pint
            ureg = _ureg(pint)
            m = re.match(r"^(.+?) is (?:≈ )?([-\d.e+]+) (.+)$", s)
            if not m:
                return fail("the reply is not 'quantity is value unit'")
            src_n, src_u = m.group(1).split(" ", 1) if " " in m.group(1) else (m.group(1), "")
            n = _number_only(src_n)
            us, ud = _unit(src_u), _unit(m.group(3))
            if n is None or us[0] != "ok" or ud[0] != "ok" or us[1] != u["from"] or ud[1] != u["to"] or n != Fraction(u["value"][0], u["value"][1]):
                return fail("the reply converts a different quantity or to a different unit")
            q = ureg.Quantity(float(n), u["from"])
            want = float(q.to(u["to"]).magnitude)
            got = float(m.group(2))
            ok = abs(got - want) <= 1e-9 * max(1.0, abs(want)) and _fmt_float(want) == m.group(2)
        else:
            return fail("kind")
    except Exception as exc:
        return fail("re-parse failed: " + type(exc).__name__)
    return dict(base, score=1.0 if ok else 0.0, **{"pass": bool(ok), "reason": "recomputed value matches the asked quantity" if ok else "recomputed value differs"})


def _value_of(text: str, sp):
    t = str(text).strip()
    t = t.split(" (≈")[0].split(" ≈ ")[0].strip()
    if "/" in t and re.fullmatch(r"-?\d+/\d+", t):
        a, b = t.split("/")
        return sp.Rational(int(a), int(b))
    if re.fullmatch(r"-?\d+(?:\.\d+)?", t):
        return sp.Rational(t)
    # Exact symbolic forms (√2, 2^(1/3) ...) are not parsed back: Echo compares them as the formatter's own text for the
    # recomputed value, so no expression from a sentence is ever evaluated.
    return None


def _same(a, b, sp) -> bool:
    try:
        return sp.simplify(a - b) == 0
    except Exception:
        return False
