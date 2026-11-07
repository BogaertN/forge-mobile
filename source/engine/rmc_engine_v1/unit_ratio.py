"""Closed unit table as exact rationals. The factors are the same ones the quantity rules use.
No sentence is read here. A caller supplies a number and a unit name it already parsed."""

from __future__ import annotations

# dimension, factor as a decimal string in the dimension's base (kilogram, metre, second).
_ROWS = (
    ("mass", "0.000001", ("milligram", "mg")),
    ("mass", "0.001", ("gram", "grams", "g")),
    ("mass", "1", ("kilogram", "kilograms", "kg", "kilo")),
    ("mass", "1000", ("tonne", "tonnes")),
    ("mass", "0.028349523125", ("ounce", "ounces", "oz")),
    ("mass", "0.45359237", ("pound", "pounds", "lb", "lbs")),
    ("length", "0.001", ("millimeter", "millimeters", "millimetre", "millimetres", "mm")),
    ("length", "0.01", ("centimeter", "centimeters", "centimetre", "centimetres", "cm")),
    ("length", "1", ("meter", "meters", "metre", "metres", "m")),
    ("length", "1000", ("kilometer", "kilometers", "kilometre", "kilometres", "km")),
    ("length", "0.0254", ("inch", "inches", "in")),
    ("length", "0.3048", ("foot", "feet", "ft")),
    ("length", "0.9144", ("yard", "yards", "yd")),
    ("length", "1609.344", ("mile", "miles", "mi")),
    ("time", "1", ("second", "seconds", "sec", "s")),
    ("time", "60", ("minute", "minutes", "min")),
    ("time", "3600", ("hour", "hours", "hr", "h")),
    ("time", "86400", ("day", "days")),
    ("time", "604800", ("week", "weeks")),
)

# The adjective names the property. The unit's dimension has to be that property's dimension.
# tall is not high, and long is not wide: the same metre does not answer a different property.
PROPERTY = {
    "heavy": ("mass", "heavier_than"),
    "tall": ("length", "taller_than"),
    "long": ("length", "longer_than"),
    "wide": ("length", "wider_than"),
    "high": ("length", "higher_than"),
    "deep": ("length", "deeper_than"),
    "old": ("time", "older_than"),
}


def _dec(text: str) -> tuple[int, int] | None:
    s = str(text or "").strip()
    if not s or s.count(".") > 1:
        return None
    neg = s.startswith("-")
    if neg:
        s = s[1:]
    if not s or not all(ch.isdigit() or ch == "." for ch in s):
        return None
    whole, _, frac = s.partition(".")
    digits = (whole or "0") + frac
    if not digits.isdigit():
        return None
    n, d = int(digits), 10 ** len(frac)
    return (-n, d) if neg else (n, d)


def _mul(a: tuple[int, int], b: tuple[int, int]) -> tuple[int, int]:
    return a[0] * b[0], a[1] * b[1]


def _by_name() -> dict[str, tuple[str, tuple[int, int]]]:
    out = {}
    for dim, factor, names in _ROWS:
        fac = _dec(factor)
        if not fac:
            continue
        for name in names:
            out[name] = (dim, fac)
    return out


_UNIT = _by_name()


def quantity(number: str, unit: str) -> dict[str, str] | None:
    """The number in the dimension's base unit, as a rational. Unknown units are None."""
    row = _UNIT.get(str(unit or "").strip().lower())
    num = _dec(str(number or ""))
    if not row or not num or num[0] < 0:
        return None
    dim, fac = row
    n, d = _mul(num, fac)
    return {"dim": dim, "n": str(n), "d": str(d), "num": str(number).strip(), "unit": str(unit).strip().lower()}


def _cmp(a: dict[str, str], b: dict[str, str]) -> int | None:
    if a.get("dim") != b.get("dim"):
        return None
    try:
        left, right = int(a["n"]) * int(b["d"]), int(b["n"]) * int(a["d"])
    except (KeyError, TypeError, ValueError):
        return None
    return (left > right) - (left < right)


# Inverse words are the declared partners. longer has none, so shorter is not licensed by a length.
_INVERSE = {
    "heavier_than": "lighter_than", "lighter_than": "heavier_than",
    "taller_than": "shorter_than", "shorter_than": "taller_than",
    "wider_than": "narrower_than", "narrower_than": "wider_than",
    "higher_than": "lower_than", "lower_than": "higher_than",
    "deeper_than": "shallower_than", "shallower_than": "deeper_than",
    "older_than": "younger_than", "younger_than": "older_than",
}


def licenses(left: dict, right: dict, head: dict) -> bool:
    """Two positive measure atoms of one property license the true comparative, its declared inverse,
    and the two negations. Same property only. A bare length is not tall, wide, or deep."""
    lq = left.get("quantity") if isinstance(left.get("quantity"), dict) else None
    rq = right.get("quantity") if isinstance(right.get("quantity"), dict) else None
    if not lq or not rq or not lq.get("property") or lq.get("property") != rq.get("property"):
        return False
    order = _cmp(lq, rq)
    if order is None or order == 0:
        return False
    hi, lo = (left, right) if order > 0 else (right, left)
    want = PROPERTY.get(str(hi["quantity"].get("property") or ""))
    if not want:
        return False
    cmp_pred, inv = want[1], _INVERSE.get(want[1])
    hi_name = str((hi.get("args") or [""])[0]).lower()
    lo_name = str((lo.get("args") or [""])[0]).lower()
    args = [str(a).lower() for a in head.get("args") or []]
    if len(args) != 2 or args[0] == args[1]:
        return False
    pred, pol = str(head.get("predicate") or ""), str(head.get("polarity") or "pos")
    if pol == "pos" and pred == cmp_pred and args == [hi_name, lo_name]:
        return True
    if pol == "neg" and pred == cmp_pred and args == [lo_name, hi_name]:
        return True
    if inv and pol == "pos" and pred == inv and args == [lo_name, hi_name]:
        return True
    if inv and pol == "neg" and pred == inv and args == [hi_name, lo_name]:
        return True
    return False
