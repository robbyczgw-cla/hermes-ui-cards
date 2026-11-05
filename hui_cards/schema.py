"""Card validation against cards.schema.json.

The schema file is the single source of truth: desktop/plugin.js embeds the same
file and runs a line-for-line port of this validator (desktop/src/10-validate.js).
tests/test_parity.py feeds every fixture through both and requires identical
results, so the model gets the same verdict wherever a card is checked.

validate_card() never raises. It returns (card, errors, warnings):
- errors: the card is rejected; each message names the field path so the model
  can fix exactly that field.
- warnings: the card is accepted; unknown fields were dropped or values coerced.
"""
from __future__ import annotations

import copy
from .calc_expr import calc_parse
import json
import math
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

HERE = Path(__file__).resolve().parent
SCHEMA = json.loads((HERE / "cards.schema.json").read_text(encoding="utf-8"))
CARD_TYPES = list(SCHEMA["cards"])
LIMITS = SCHEMA["limits"]

_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_DATETIME = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})?$")
_PREFIX = {"options": "o", "items": "i", "columns": "c", "slots": "s"}


def _resolve(spec: dict) -> dict:
    """Inline a {"$ref": name} (plus sibling keys, which override)."""
    ref = spec.get("$ref")
    if ref is None:
        return spec
    merged = dict(SCHEMA["definitions"][ref])
    merged.update({k: v for k, v in spec.items() if k != "$ref"})
    return merged


def _types_of(spec: dict) -> list:
    t = spec.get("type")
    return t if isinstance(t, list) else [t]


def _kind(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return type(value).__name__


def _clean_string(value: str) -> str:
    return _CONTROL.sub("", value.replace("\r\n", "\n").replace("\r", "\n")).strip()


def _fmt_num(n) -> str:
    return str(int(n)) if isinstance(n, float) and n.is_integer() else str(n)


class _Ctx:
    def __init__(self):
        self.errors: list[str] = []
        self.warnings: list[str] = []


def _coerce(value, types: list, path: str, ctx: _Ctx):
    """Lenient coercion of the shapes models commonly get wrong. Returns (ok, value)."""
    kind = _kind(value)
    if kind in types or (kind == "integer" and "number" in types):
        return True, value
    if kind == "number" and "integer" in types and math.isfinite(value) and float(value).is_integer():
        return True, int(value)
    if kind == "string":
        s = value.strip()
        if "boolean" in types and s.lower() in ("true", "false"):
            ctx.warnings.append(f"{path}: read the string \"{s}\" as a boolean")
            return True, s.lower() == "true"
        if "integer" in types and re.fullmatch(r"-?\d+", s):
            ctx.warnings.append(f"{path}: read the string \"{s}\" as a number")
            return True, int(s)
        if "number" in types and re.fullmatch(r"-?\d+(\.\d+)?", s):
            ctx.warnings.append(f"{path}: read the string \"{s}\" as a number")
            n = float(s)
            return True, int(n) if n.is_integer() and "." not in s else n
    return False, value


def _check_format(fmt: str, value: str, path: str, ctx: _Ctx) -> bool:
    if fmt == "https-url":
        try:
            parts = urlsplit(value)
        except ValueError:
            parts = None
        if (parts is None or parts.scheme != "https" or "." not in (parts.hostname or "")
                or parts.username or parts.password or re.search(r"\s", value)):
            ctx.errors.append(f"{path}: must be an https:// URL (got \"{value[:60]}\")")
            return False
    elif fmt == "datetime":
        ok = bool(_DATETIME.match(value))
        if ok:
            try:
                datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                ok = False
        if not ok:
            ctx.errors.append(f"{path}: must be an ISO 8601 date and time like 2026-11-12T14:00 (got \"{value[:40]}\")")
            return False
    elif fmt == "no-space":
        if re.search(r"\s", value):
            ctx.errors.append(f"{path}: must be a single emoji without spaces")
            return False
    return True


def _check_value(value, spec: dict, path: str, ctx: _Ctx):
    """Validate one value; returns the cleaned value (or None after an error)."""
    spec = _resolve(spec)
    types = _types_of(spec)
    ok, value = _coerce(value, types, path, ctx)
    if not ok:
        want = " or ".join(types)
        ctx.errors.append(f"{path}: must be {want} (got {_kind(value)})")
        return None
    kind = _kind(value)
    if kind == "string":
        value = _clean_string(value)
        if "minLength" in spec and len(value) < spec["minLength"]:
            ctx.errors.append(f"{path}: must not be empty" if spec["minLength"] == 1
                              else f"{path}: at least {spec['minLength']} characters")
            return None
        if "maxLength" in spec and len(value) > spec["maxLength"]:
            ctx.errors.append(f"{path}: at most {spec['maxLength']} characters (got {len(value)})")
            return None
        if "enum" in spec and value not in spec["enum"]:
            ctx.errors.append(f"{path}: must be one of {', '.join(spec['enum'])} (got \"{value[:40]}\")")
            return None
        if "pattern" in spec and not re.search(spec["pattern"], value):
            ctx.errors.append(f"{path}: \"{value[:40]}\" does not match {spec['pattern']}")
            return None
        if "format" in spec and not _check_format(spec["format"], value, path, ctx):
            return None
    elif kind in ("integer", "number"):
        if not math.isfinite(value):
            ctx.errors.append(f"{path}: must be a finite number")
            return None
        if "minimum" in spec and value < spec["minimum"]:
            ctx.errors.append(f"{path}: must be at least {_fmt_num(spec['minimum'])} (got {_fmt_num(value)})")
            return None
        if "maximum" in spec and value > spec["maximum"]:
            ctx.errors.append(f"{path}: must be at most {_fmt_num(spec['maximum'])} (got {_fmt_num(value)})")
            return None
    elif kind == "array":
        if "minItems" in spec and len(value) < spec["minItems"]:
            ctx.errors.append(f"{path}: needs at least {spec['minItems']} items (got {len(value)})")
            return None
        if "maxItems" in spec and len(value) > spec["maxItems"]:
            ctx.errors.append(f"{path}: at most {spec['maxItems']} items (got {len(value)})")
            return None
        item_spec = spec.get("items", {})
        out = []
        for i, item in enumerate(value):
            before = len(ctx.errors)
            cleaned = _check_value(item, item_spec, f"{path}[{i}]", ctx)
            if len(ctx.errors) == before:
                out.append(cleaned)
        return out
    elif kind == "object":
        return _check_object(value, spec, path, ctx)
    return value


def _check_object(value: dict, spec: dict, path: str, ctx: _Ctx, extra_props: dict | None = None) -> dict:
    props = dict(extra_props or {})
    props.update(spec.get("properties", {}))
    out = {}
    for key in spec.get("required", []):
        if key not in value or value[key] is None:
            ctx.errors.append(f"{path}.{key}: required")
    for key, item in value.items():
        if key not in props and "additionalProperties" in spec:
            before = len(ctx.errors)
            cleaned = _check_value(item, spec["additionalProperties"], f"{path}.{key}", ctx)
            if len(ctx.errors) == before: out[key] = cleaned
            continue
        if key not in props:
            hint = _suggest(key, list(props))
            ctx.warnings.append(f"{path}.{key}: unknown field, ignored{hint}")
            continue
        if item is None and key not in spec.get("required", []):
            continue
        before = len(ctx.errors)
        cleaned = _check_value(item, props[key], f"{path}.{key}", ctx)
        if len(ctx.errors) == before:
            out[key] = cleaned
    for key, pspec in props.items():
        pspec = _resolve(pspec)
        if key not in out and "default" in pspec:
            out[key] = copy.deepcopy(pspec["default"])
    return out


def _camel(name: str) -> str:
    head, *rest = name.split("_")
    return head + "".join(p[:1].upper() + p[1:] for p in rest)


def _edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, start=1):
        cur = [i]
        for j, cb in enumerate(b, start=1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _suggest(key: str, known: list) -> str:
    """A "did you mean" hint: snake_case → camelCase, else the closest name within a small edit distance.
    Kept simple on purpose so desktop/src/10-validate.js can match it exactly."""
    camel = _camel(key)
    if camel in known and camel != key:
        return f" (did you mean \"{camel}\"?)"
    best, best_d = None, None
    for name in known:
        d = _edit_distance(key.lower(), name.lower())
        if best_d is None or d < best_d:
            best, best_d = name, d
    if best is not None and best_d <= max(1, len(key) // 3):
        return f" (did you mean \"{best}\"?)"
    return ""


# ── cross-field rules (x-rules); desktop/src/10-validate.js mirrors each one ──

def _unique_ids(card, key, ctx):
    seen = set()
    for i, item in enumerate(card.get(key, [])):
        ident = item.get("id")
        if ident is None:
            continue
        if ident in seen:
            ctx.errors.append(f"card.{key}[{i}].id: duplicate id \"{ident}\"")
        seen.add(ident)


def _rule(name, card, ctx):
    if name in ("uniqueStepIds", "uniqueCriterionIds", "uniqueIngredientIds"):
        _unique_ids(card, {"uniqueStepIds": "steps", "uniqueCriterionIds": "criteria", "uniqueIngredientIds": "ingredients"}[name], ctx)
    elif name == "planOffOptional":
        for i, step in enumerate(card["steps"]):
            if step.get("off") and not step.get("optional"):
                ctx.errors.append(f"card.steps[{i}].off: only allowed when optional is true")
    elif name == "uniqueOptionIds":
        _unique_ids(card, "options", ctx)
    elif name == "uniqueItemIds":
        _unique_ids(card, "items", ctx)
    elif name == "uniqueColumnIds":
        _unique_ids(card, "columns", ctx)
    elif name == "uniqueSlotIds":
        _unique_ids(card, "slots", ctx)
    elif name == "uniqueInputNames":
        seen = set()
        for i, item in enumerate(card["inputs"]):
            name = item["name"]
            if name in seen: ctx.errors.append(f'card.inputs[{i}].name: duplicate name "{name}"')
            seen.add(name)
    elif name == "scoresMatchCriteria":
        ids = [c["id"] for c in card["criteria"]]
        for i, option in enumerate(card["options"]):
            scores = option["scores"]
            for key in ids:
                if key not in scores: ctx.errors.append(f'card.options[{i}].scores: missing criterion "{key}"')
            for key in scores:
                if key not in ids: ctx.errors.append(f'card.options[{i}].scores: unknown criterion "{key}"')
    elif name == "calcExpressions":
        names = [x["name"] for x in card["inputs"]]
        for i, output in enumerate(card["outputs"]):
            parsed = calc_parse(output["expr"], names)
            if isinstance(parsed, dict): ctx.errors.append(f'card.outputs[{i}].expr: {parsed["message"]} at {parsed["at"]}')
    elif name == "calcInputs":
        for i, item in enumerate(card["inputs"]):
            p = f"card.inputs[{i}]"; lo = item.get("min"); hi = item.get("max"); d = item["default"]
            if lo is not None and hi is not None and lo >= hi: ctx.errors.append(f"{p}.min: must be smaller than max")
            if (lo is not None and d < lo) or (hi is not None and d > hi): ctx.errors.append(f"{p}.default: outside range")
            if "step" in item and item["step"] <= 0: ctx.errors.append(f"{p}.step: must be larger than 0")
            if item["kind"] == "select":
                if "options" not in item: ctx.errors.append(f"{p}.options: required for kind select")
                elif d not in [x["value"] for x in item["options"]]: ctx.errors.append(f"{p}.default: must be one of the options")
            if item["kind"] == "toggle" and d not in (0, 1): ctx.errors.append(f"{p}.default: must be 0 or 1 for kind toggle")
    elif name == "minMaxPicks":
        n = len(card.get("options", []))
        lo, hi = card.get("min"), card.get("max")
        if not card.get("multiple") and (lo is not None or hi is not None):
            ctx.warnings.append("card.min/max: only used with multiple: true, ignored")
            card.pop("min", None)
            card.pop("max", None)
            return
        if lo is not None and lo > n:
            ctx.errors.append(f"card.min: {lo} is more than the {n} options")
        if hi is not None and hi > n:
            card["max"] = n
        if lo is not None and hi is not None and lo > hi:
            ctx.errors.append(f"card.min: {lo} is larger than max {hi}")
    elif name == "rowsMatchColumns":
        n = len(card.get("columns", []))
        for i, row in enumerate(card.get("rows", [])):
            got = len(row.get("values", []))
            if got != n:
                ctx.errors.append(f"card.rows[{i}].values: needs {n} values, one per column (got {got})")
    elif name == "rowSourcesMatchValues":
        for i, row in enumerate(card.get("rows", [])):
            if "sources" in row and len(row["sources"]) != len(row.get("values", [])):
                ctx.errors.append(f"card.rows[{i}].sources: needs {len(row.get('values', []))} sources, one per value (got {len(row['sources'])})")
    elif name == "rowBestInColumns":
        n = len(card.get("columns", []))
        for i, row in enumerate(card.get("rows", [])):
            if "best" in row and row["best"] >= n:
                ctx.errors.append(f"card.rows[{i}].best: {row['best']} is not a column index (0..{n - 1})")
    elif name == "singleBest":
        best = [i for i, c in enumerate(card.get("columns", [])) if c.get("best")]
        if len(best) > 1:
            ctx.errors.append(f"card.columns: only one column may have best: true (got {len(best)})")
    elif name == "uniqueFieldNames":
        seen = set()
        for i, f in enumerate(card.get("fields", [])):
            if f.get("name") in seen:
                ctx.errors.append(f"card.fields[{i}].name: duplicate name \"{f['name']}\"")
            seen.add(f.get("name"))
    elif name == "fieldKindRules":
        for i, f in enumerate(card.get("fields", [])):
            p = f"card.fields[{i}]"
            kind = f.get("kind")
            if kind == "select" and not f.get("options"):
                ctx.errors.append(f"{p}.options: required for kind select")
            if kind != "select" and "options" in f:
                ctx.warnings.append(f"{p}.options: only used with kind select, ignored")
                f.pop("options")
            if "min" in f and "max" in f and f["min"] > f["max"]:
                ctx.errors.append(f"{p}.min: {_fmt_num(f['min'])} is larger than max {_fmt_num(f['max'])}")
            d = f.get("default")
            if d is None:
                continue
            if kind == "toggle" and not isinstance(d, bool):
                ctx.errors.append(f"{p}.default: must be true or false for kind toggle")
            elif kind == "number" and _kind(d) not in ("integer", "number"):
                ctx.errors.append(f"{p}.default: must be a number for kind number")
            elif kind == "select" and d not in (f.get("options") or []):
                ctx.errors.append(f"{p}.default: must be one of the options")
            elif kind not in ("toggle", "number", "select") and not isinstance(d, str):
                ctx.errors.append(f"{p}.default: must be text for kind {kind}")
    elif name == "sliderRange":
        lo, hi = card.get("min"), card.get("max")
        if lo is None or hi is None:
            return
        if lo >= hi:
            ctx.errors.append(f"card.min: {_fmt_num(lo)} must be smaller than max {_fmt_num(hi)}")
            return
        step = card.get("step")
        if step is not None and step <= 0:
            ctx.errors.append("card.step: must be larger than 0")
        d = card.get("default")
        if d is not None and not (lo <= d <= hi):
            ctx.errors.append(f"card.default: {_fmt_num(d)} is outside {_fmt_num(lo)}..{_fmt_num(hi)}")
    elif name == "slotOrder":
        for i, s in enumerate(card.get("slots", [])):
            if "end" in s and _iso(s["end"]) <= _iso(s["start"]):
                ctx.errors.append(f"card.slots[{i}].end: must be after start")
    elif name == "quizAnswers":
        for i, q in enumerate(card.get("questions", [])):
            n = len(q.get("options", []))
            a = q.get("answer")
            if a is not None and n and a >= n:
                ctx.errors.append(f"card.questions[{i}].answer: {a} is not an option index (0..{n - 1})")


def _iso(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt.replace(tzinfo=None) if dt.tzinfo is None else dt.astimezone().replace(tzinfo=None)


def _assign_ids(card: dict) -> None:
    prefixes = dict(_PREFIX)
    if card.get("type") == "plan": prefixes["steps"] = "p"
    if card.get("type") in ("review", "rank"): prefixes["items"] = {"review": "r", "rank": "k"}[card["type"]]
    if card.get("type") == "recipe": prefixes["ingredients"] = "g"
    for key, prefix in prefixes.items():
        items = card.get(key)
        if not isinstance(items, list) or not items or not isinstance(items[0], dict):
            continue
        used = {it["id"] for it in items if "id" in it}
        for i, it in enumerate(items, start=1):
            if "id" not in it:
                ident = f"{prefix}{i}"
                while ident in used:
                    ident += "x"
                it["id"] = ident
                used.add(ident)


def validate_card(raw) -> tuple[dict | None, list, list]:
    """Validate and normalize one card. See the module docstring."""
    ctx = _Ctx()
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return None, ["card: must be a JSON object, got a string that is not JSON"], []
    if not isinstance(raw, dict):
        return None, [f"card: must be an object (got {_kind(raw)})"], []
    size = len(json.dumps(raw, ensure_ascii=False).encode("utf-8"))
    if size > LIMITS["maxCardBytes"]:
        return None, [f"card: too large ({size} bytes, limit {LIMITS['maxCardBytes']}); split it or shorten the text"], []
    ctype = raw.get("type")
    if not isinstance(ctype, str) or ctype not in SCHEMA["cards"]:
        got = f"\"{ctype}\"" if isinstance(ctype, str) else "missing"
        hint = _suggest(ctype, CARD_TYPES) if isinstance(ctype, str) else ""
        return None, [f"card.type: unknown card type {got}{hint}; use one of: {', '.join(CARD_TYPES)}"], []
    spec = SCHEMA["cards"][ctype]
    card = _check_object(raw, spec, "card", ctx, extra_props=SCHEMA["common"]["properties"])
    if not ctx.errors:
        for rule in spec.get("x-rules", []):
            _rule(rule, card, ctx)
    if ctx.errors:
        return None, ctx.errors, ctx.warnings
    _assign_ids(card)
    return card, [], ctx.warnings
