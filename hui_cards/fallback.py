"""Plain-text version of a card.

Used where no interactive card can render (CLI, TUI, Telegram, Discord, API server, cards turned
off) and as the Markdown file behind the Desktop attachment. See docs/protocol.md section 4.

render_text() takes a card as returned by schema.validate_card() (ids assigned, defaults applied)
and returns plain text without Markdown: a title or question line, the content, and as the last
line one hint that tells the user how to answer by typing. It is a pure function, stdlib only,
and never raises: if a renderer fails or the type is unknown, a generic text is returned.

Chrome (labels and hints) is German when card["lang"] starts with "de", else English. The card's
own text stays as the model wrote it.
"""
from __future__ import annotations

from urllib.parse import urlsplit

import datetime
import re

_DE = {
    "recommended": "★ Empfehlung",
    "required": "Pflichtfeld",
    "action": "Aktion",
    "why": "Warum",
    "risk": "Risiko",
    "command": "Befehl",
    "scale": "Skala",
    "range": "Bereich",
    "default": "Standard",
    "timezone": "Zeitzone",
    "unavailable": "nicht verfügbar",
    "yes": "ja",
    "no": "nein",
    "low": "niedrig",
    "medium": "mittel",
    "high": "hoch",
}
_EN = {
    "recommended": "★ Recommended",
    "required": "required",
    "action": "Action",
    "why": "Why",
    "risk": "Risk",
    "command": "Command",
    "scale": "Scale",
    "range": "Range",
    "default": "Default",
    "timezone": "Time zone",
    "unavailable": "not available",
    "yes": "yes",
    "no": "no",
    "low": "low",
    "medium": "medium",
    "high": "high",
}

_WEEKDAYS = {
    "en": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "de": ["Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa.", "So."],
}
_MONTHS = {
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "de": ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."],
}
_WHEN = re.compile(r"^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})")
_OFFSET = re.compile(r"(Z|[+-]\d{2}:\d{2})$")


class _L:
    """Language switch: pick the German or English variant of a string."""

    def __init__(self, card: dict):
        self.de = str(card.get("lang") or "").lower().startswith("de")
        self.lang = "de" if self.de else "en"
        self._t = _DE if self.de else _EN

    def __getitem__(self, key: str) -> str:
        return self._t[key]

    def __call__(self, en: str, de: str) -> str:
        return de if self.de else en


# ── small helpers ──

def _one(value) -> str:
    """One line: all whitespace, newlines included, collapsed to single spaces."""
    return " ".join(str(value).split())


def _block(value) -> str:
    """Long text: keep the line breaks, drop trailing spaces and blank edges."""
    return "\n".join(line.rstrip() for line in str(value).replace("\r\n", "\n").replace("\r", "\n").split("\n")).strip()


def _indent(text: str, pad: str) -> list[str]:
    return [pad + line if line else line for line in text.split("\n")]


def _num(n, L: _L | None = None) -> str:
    if isinstance(n, float) and n.is_integer():
        s = str(int(n))
    else:
        s = str(n)
    return s.replace(".", ",") if L is not None and L.de else s


def _with_unit(n, unit, L: _L) -> str:
    return f"{_num(n, L)} {unit}" if unit else _num(n, L)


def _join(parts, sep=" – ") -> str:
    return sep.join(p for p in parts if p)


def _numbers(k: int, L: _L) -> str:
    return L(f"{k} number" if k == 1 else f"{k} numbers", f"{k} Zahl" if k == 1 else f"{k} Zahlen")


def _example(k: int, n: int) -> str:
    """k pick numbers that all exist among n options, e.g. "1, 3"."""
    k = max(1, min(k, n))
    if k == 2 and n >= 3:
        return "1, 3"
    return ", ".join(str(i) for i in range(1, k + 1))


def _head(card: dict, *keys: str) -> list[str]:
    return [_one(card[k]) for k in keys if card.get(k)]


def _hint_pick_many(n: int, lo, hi, L: _L) -> str:
    if lo is not None and hi is not None and lo == hi:
        how = L("exactly ", "genau ") + _numbers(lo, L)
        k = lo
    elif lo is not None and hi is not None and hi > 1:
        how = L(f"{lo}–{hi} numbers", f"{lo}–{hi} Zahlen")
        k = lo
    elif lo is not None and lo > 1:
        how = L("at least ", "mindestens ") + _numbers(lo, L)
        k = lo
    elif hi is not None and hi >= 1:
        how = L("up to ", "bis zu ") + _numbers(hi, L)
        k = min(2, hi)
    else:
        how = L("one or more numbers", "einer oder mehreren Zahlen")
        k = 2
    return L(f"Reply with {how}, e.g. {_example(k, n)}.", f"Antworte mit {how}, z. B. {_example(k, n)}.")


# ── one renderer per card type; each returns the list of lines ──

def _choice(card: dict, L: _L) -> list[str]:
    options = card.get("options") or []
    lines = _head(card, "question")
    for i, o in enumerate(options, start=1):
        label = _join([_join([_one(o.get("icon", "")), _one(o.get("label", ""))], " "), _one(o.get("description", ""))])
        lines.append(f"{i}. {label}")
    n = len(options)
    if card.get("multiple"):
        hint = _hint_pick_many(n, card.get("min"), card.get("max"), L)
    else:
        hint = L(f"Reply with a number (1–{n}).", f"Antworte mit einer Zahl (1–{n}).")
    if card.get("allowOther"):
        hint += L(" Or write your own.", " Oder schreib etwas Eigenes.")
    return lines + [hint]


def _checklist(card: dict, L: _L) -> list[str]:
    items = card.get("items") or []
    lines = _head(card, "title")
    # Group by category in order of first appearance; items without one form a group without heading.
    # Numbers follow the displayed order so the user's numbers match what they see.
    groups: dict[str, list[dict]] = {}
    for it in items:
        groups.setdefault(_one(it.get("category") or ""), []).append(it)
    grouped = any(groups)
    k = 0
    for heading, members in groups.items():
        if grouped and lines:
            lines.append("")
        if heading:
            lines.append(heading)
        for it in members:
            k += 1
            mark = "☑" if it.get("checked") else "☐"
            lines.append(f"{mark} {k}. " + _join([_one(it.get("text", "")), _one(it.get("note", ""))]))
    ex = "1, 4" if k >= 4 else _example(2, k)
    return lines + [L(f"Reply with the numbers you have done, e.g. {ex}.",
                      f"Antworte mit den Nummern der erledigten Punkte, z. B. {ex}.")]


def _cell(value, L: _L) -> str:
    if value is None:
        return "–"
    if isinstance(value, bool):
        return L["yes"] if value else L["no"]
    if isinstance(value, (int, float)):
        return _num(value, L)
    return _one(value) or "–"


def _compare(card: dict, L: _L) -> list[str]:
    columns = card.get("columns") or []
    rows = card.get("rows") or []
    lines = _head(card, "title")
    for i, col in enumerate(columns):
        lines.append("")
        lines.append(f"{i + 1}. " + _join([_one(col.get("title", "")), _one(col.get("badge", ""))], " · "))
        if col.get("best"):
            lines.append("   " + L["recommended"])
        if col.get("subtitle"):
            lines.append("   " + _one(col["subtitle"]))
        if col.get("source"):
            lines.append("   " + _one(col["source"].get("label", "")) + " [" + (urlsplit(col["source"]["url"]).hostname or "") + "]")
        for row in rows:
            values = row.get("values") or []
            sources = row.get("sources") or []
            source = " [" + (urlsplit(sources[i]).hostname or "") + "]" if i < len(sources) and sources[i] else ""
            lines.append(f"   {_one(row.get('label', ''))}: " + (_cell(values[i], L) if i < len(values) else "–") + source)
        lines += [f"   + {_one(p)}" for p in col.get("pros") or []]
        lines += [f"   – {_one(c)}" for c in col.get("cons") or []]
    if lines and lines[0] == "":
        lines.pop(0)
    if card.get("asOf"):
        lines.append(L("Prices checked ", "Preise geprüft ") + _one(card["asOf"]))
    n = len(columns)
    return lines + [L(f"Reply with the number of your pick (1–{n}).", f"Antworte mit der Nummer deiner Wahl (1–{n}).")]


def _field_info(f: dict, L: _L) -> str:
    kind = f.get("kind")
    unit = _one(f.get("unit") or "")
    lo, hi = f.get("min"), f.get("max")
    info = ""
    if kind == "select":
        info = L("Choose one: ", "Eine Auswahl: ") + ", ".join(_one(o) for o in f.get("options") or [])
    elif kind == "number":
        u = f" {unit}" if unit else ""
        if lo is not None and hi is not None:
            info = L(f"Number from {_num(lo, L)} to {_num(hi, L)}{u}", f"Zahl von {_num(lo, L)} bis {_num(hi, L)}{u}")
        elif lo is not None:
            info = L(f"Number, at least {_num(lo, L)}{u}", f"Zahl, mindestens {_num(lo, L)}{u}")
        elif hi is not None:
            info = L(f"Number, at most {_num(hi, L)}{u}", f"Zahl, höchstens {_num(hi, L)}{u}")
        elif unit:
            info = L(f"Number in {unit}", f"Zahl in {unit}")
        else:
            info = L("Number", "Zahl")
    elif kind == "toggle":
        info = L("yes or no", "ja oder nein")
    elif kind == "date":
        info = L("Date (YYYY-MM-DD)", "Datum (JJJJ-MM-TT)")
    elif kind == "time":
        info = L("Time (HH:MM)", "Uhrzeit (HH:MM)")
    elif kind == "email":
        info = L("Email address", "E-Mail-Adresse")
    d = f.get("default")
    if d is not None and d != "":
        shown = (L["yes"] if d else L["no"]) if isinstance(d, bool) else _cell(d, L)
        if unit and kind == "number":
            shown = f"{shown} {unit}"
        info = _join([info, f"{L['default']}: {shown}"], " · ")
    return info


def _form(card: dict, L: _L) -> list[str]:
    lines = _head(card, "title", "description")
    for i, f in enumerate(card.get("fields") or [], start=1):
        label = _one(f.get("label", ""))
        if f.get("required"):
            label += f" ({L['required']})"
        lines.append(f"{i}. " + _join([label, _one(f.get("help", ""))]))
        info = _field_info(f, L)
        if info:
            lines.append("   " + info)
    return lines + [L('Reply with your answers, one per line, e.g. "1: …"',
                      'Antworte mit deinen Angaben, eine pro Zeile, z. B. "1: …"')]


def _confirm(card: dict, L: _L) -> list[str]:
    lines = _head(card, "title")
    if card.get("action"):
        lines.append(f"{L['action']}: {_one(card['action'])}")
    if card.get("reason"):
        lines.append(f"{L['why']}: {_one(card['reason'])}")
    risk = card.get("risk")
    if isinstance(risk, dict) and risk.get("level"):
        label = f"{L['risk']} ({L[risk['level']] if risk['level'] in ('low', 'medium', 'high') else _one(risk['level'])})"
        lines.append(_join([label, _one(risk.get("text", ""))], ": "))
    if card.get("command"):
        lines.append(f"{L['command']}:")
        lines += _indent(_block(card["command"]), "  ")
    for d in card.get("details") or []:
        lines.append(f"{_one(d.get('label', ''))}: {_one(d.get('value', ''))}")
    if card.get("allowChange", True):
        hint = L("Reply yes, no, or what to change.", "Antworte mit Ja, Nein oder was geändert werden soll.")
    else:
        hint = L("Reply yes or no.", "Antworte mit Ja oder Nein.")
    return lines + [hint]


def _rating(card: dict, L: _L) -> list[str]:
    scale = card.get("scale") or 5
    lo, hi = _one(card.get("lowLabel") or ""), _one(card.get("highLabel") or "")
    lines = _head(card, "question")
    lines.append(f"{L['scale']}: 1" + (f" ({lo})" if lo else "") + f" – {scale}" + (f" ({hi})" if hi else ""))
    if card.get("comment"):
        hint = L(f"Reply with a number from 1 to {scale}, optionally followed by a comment.",
                 f"Antworte mit einer Zahl von 1 bis {scale}, optional mit einem Kommentar.")
    else:
        hint = L(f"Reply with a number from 1 to {scale}.", f"Antworte mit einer Zahl von 1 bis {scale}.")
    return lines + [hint]


def _slider(card: dict, L: _L) -> list[str]:
    lo, hi, unit = card.get("min"), card.get("max"), _one(card.get("unit") or "")
    lo_s, hi_s = _with_unit(lo, unit, L), _with_unit(hi, unit, L)
    lo_l, hi_l = _one(card.get("minLabel") or ""), _one(card.get("maxLabel") or "")
    rng = f"{L['range']}: {lo_s}" + (f" ({lo_l})" if lo_l else "") + f" – {hi_s}" + (f" ({hi_l})" if hi_l else "")
    if card.get("step"):
        rng += L(f", step {_num(card['step'], L)}", f", Schrittweite {_num(card['step'], L)}")
    lines = _head(card, "question") + [rng]
    if card.get("default") is not None:
        lines.append(f"{L['default']}: {_with_unit(card['default'], unit, L)}")
    return lines + [L(f"Reply with a number from {lo_s} to {hi_s}.", f"Antworte mit einer Zahl von {lo_s} bis {hi_s}.")]


def _when(start: str, end, L: _L, show_zone: bool) -> str:
    """"Thu 12 Nov 2026, 14:00–15:00" / "Do. 12. Nov. 2026, 14:00–15:00", no locale libraries."""
    m = _WHEN.match(start)
    if not m:
        return start
    try:
        y, mo, d, hh, mm = (int(g) for g in m.groups())
        wd = _WEEKDAYS[L.lang][datetime.date(y, mo, d).weekday()]
        month = _MONTHS[L.lang][mo - 1]
    except (ValueError, IndexError):
        return start
    day = L(f"{wd} {d} {month} {y}", f"{wd} {d}. {month} {y}")
    out = f"{day}, {hh:02d}:{mm:02d}"
    e = _WHEN.match(end) if end else None
    if e:
        if e.group(1, 2, 3) == m.group(1, 2, 3):
            out += f"–{e.group(4)}:{e.group(5)}"
        else:
            out += " – " + _when(end, None, L, False)
    zone = _OFFSET.search(start) if show_zone else None
    if zone:
        out += " UTC" if zone.group(1) == "Z" else f" UTC{zone.group(1)}"
    return out


def _in_zone(value, zone: str):
    """An ISO time with an offset, converted to `zone` and written without one (the Desktop card
    shows the same wall-clock time). Naive times, unknown zones or missing tz data: unchanged."""
    if not isinstance(value, str) or not zone or not _OFFSET.search(value):
        return value
    try:
        from zoneinfo import ZoneInfo
        local = datetime.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(ZoneInfo(zone))
    except Exception:
        return value
    return local.strftime("%Y-%m-%dT%H:%M")


def _schedule(card: dict, L: _L) -> list[str]:
    """Slots that are not available are listed with "✗" and "(not available)" and get no number,
    so the numbers the user can reply with only ever point at free slots."""
    lines = _head(card, "title")
    zone = _one(card.get("timezone") or "")
    if zone:
        lines.append(f"{L['timezone']}: {zone}")
    k = 0
    for s in card.get("slots") or []:
        start, end = _in_zone(str(s.get("start", "")), zone), _in_zone(s.get("end"), zone)
        # Still carrying an offset (no zone, or one we can't resolve): show it.
        when = _when(start, end, L, not zone or bool(_OFFSET.search(start)))
        extra = _join([_one(s.get("label", "")), _one(s.get("note", ""))])
        if s.get("unavailable"):
            lines.append("✗ " + _join([f"{when} ({L['unavailable']})", extra]))
        else:
            k += 1
            lines.append(f"{k}. " + _join([when, extra]))
    none = _one(card.get("noneLabel") or "")
    if none:
        k_none = k + 1
        lines.append(f"{k_none}. {none}")
        k = k_none
    if k == 0:
        hint = L("No slot is free. Reply with a time that suits you.", "Kein Termin ist frei. Antworte mit einer Zeit, die dir passt.")
    elif card.get("multiple"):
        hint = _hint_pick_many(k, None, None, L)
    elif k == 1:
        hint = L("Reply with 1 to take it.", "Antworte mit 1, um ihn zu nehmen.")
    else:
        hint = L(f"Reply with a number (1–{k}).", f"Antworte mit einer Zahl (1–{k}).")
    return lines + [hint]


def _steps(card: dict, L: _L) -> list[str]:
    lines = _head(card, "title")
    for i, st in enumerate(card.get("steps") or [], start=1):
        prefix = f"{i}. "
        pad = " " * len(prefix)
        lines.append(prefix + _one(st.get("title", "")))
        if st.get("body"):
            lines += _indent(_block(st["body"]), pad)
        if st.get("command"):
            lines += _indent(_block(st["command"]), pad + "  ")
    return lines + [L('Reply "done" when finished, or the number of the step where you got stuck.',
                      'Antworte mit "fertig", wenn du durch bist, oder mit der Nummer des Schritts, bei dem du hängst.')]


def _quiz(card: dict, L: _L) -> list[str]:
    """Never shows the answer or the explanation: those belong to the interactive card."""
    lines = _head(card, "title")
    questions = card.get("questions") or []
    for i, q in enumerate(questions, start=1):
        lines.append(f"{i}. {_one(q.get('question', ''))}")
        for j, o in enumerate(q.get("options") or []):
            lines.append(f"   {chr(ord('A') + j)}) {_one(o)}")
    ex = []
    for i, q in enumerate(questions[:2], start=1):
        letter = "A" if i == 1 else ("C" if len(q.get("options") or []) >= 3 else "B")
        ex.append(f"{i}{letter}")
    ex_s = " ".join(ex) or "1A"
    return lines + [L(f"Reply with your answers, e.g. {ex_s}.", f"Antworte mit deinen Antworten, z. B. {ex_s}.")]


def _plan(card, L):
    lines = _head(card, 'title', 'summary')
    for i, step in enumerate(card['steps'], 1):
        tags = [L('optional', 'optional') if step.get('optional') else '', L[step['risk']] if step.get('risk') else '']
        lines.append(f"{i}. {_one(step['title'])}" + (f" ({', '.join(x for x in tags if x)})" if any(tags) else ''))
        for key in ('detail', 'command'):
            if step.get(key): lines += _indent(_block(step[key]), '   ')
    return lines + [L('Reply "go", or list the step numbers to skip / a new order, e.g. "skip 3" or "2, 1, 3".', 'Antworte mit "Los", den zu überspringenden Schritten oder einer neuen Reihenfolge, z. B. "Schritt 3 überspringen" oder "2, 1, 3".')]

def _review(card, L):
    lines = _head(card, 'title', 'summary')
    for i, item in enumerate(card['items'], 1):
        lines.append(f"{i}. " + _join([_one(item['title']), _one(item.get('tag', '')), _one(item.get('detail', ''))]))
        if item.get('preview'): lines += _indent(_block(item['preview']), '   ')
    return lines + [L('Reply with the numbers to drop, e.g. "drop 2, 5" (everything else is kept).', 'Antworte mit den Nummern zum Verwerfen, z. B. "2, 5 verwerfen" (alles andere bleibt).')]

def _decision(card, L):
    lines = _head(card, 'title', 'note'); criteria = card['criteria']; total = sum(c['weight'] for c in criteria)
    for i, option in enumerate(card['options'], 1):
        score = sum(c['weight'] * option['scores'][c['id']] for c in criteria) / total if total else None
        lines.append(f"{i}. {_one(option['label'])}: " + (f'{score:.1f}'.replace('.', ',') if L.de and score is not None else f'{score:.1f}' if score is not None else '–'))
    lines.append(L('Weights: ', 'Gewichte: ') + ', '.join(f"{_one(c['label'])} {_num(c['weight'], L)}" for c in criteria))
    return lines + [L('Reply with changed weights or a pick.', 'Antworte mit geänderten Gewichten oder deiner Wahl.')]

def calc_format(value, output, card, lang):
    """Format a finite calculator result using decimal half-away-from-zero."""
    import math
    from decimal import Decimal, ROUND_HALF_UP, localcontext

    if value is None or not math.isfinite(value): return '–'
    if value == 0: value = 0.0
    fmt = output.get('format', 'number')
    if fmt == 'percent': value *= 100.0
    if not math.isfinite(value): return '–'
    decimals = output.get('decimals', 0 if fmt == 'integer' else 2)
    with localcontext() as ctx:
        ctx.prec = 400
        rounded = Decimal(str(value)).quantize(Decimal(1).scaleb(-decimals), rounding=ROUND_HALF_UP)
    shown = f'{rounded:,.{decimals}f}'
    de = str(lang or '').lower().startswith('de')
    if de: shown = shown.replace(',', '\0').replace('.', ',').replace('\0', '.')
    if fmt == 'currency':
        code = card.get('currency', 'EUR')
        symbol = ({'EUR': '€', 'USD': '$', 'GBP': '£', 'CAD': 'CA$', 'JPY': '¥', 'AUD': 'AU$'} if de else {'EUR': '€', 'USD': 'US$', 'GBP': '£', 'CAD': 'CA$', 'JPY': 'JP¥', 'AUD': 'A$'}).get(code, code)
        if de: shown += '\u00a0' + symbol
        else:
            negative = shown.startswith('-')
            shown = ('-' if negative else '') + symbol + ('\u00a0' if symbol == code else '') + (shown[1:] if negative else shown)
    if fmt == 'percent': shown += ' %'
    if output.get('unit'): shown += ' ' + _one(output['unit'])
    return shown


def _calc(card, L):
    from .calc_expr import calc_parse, calc_eval
    lines = _head(card, 'title', 'note'); values = {x['name']: x['default'] for x in card['inputs']}
    for item in card['inputs']:
        lines.append(f"{_one(item['label'])} ({item['name']}): {_with_unit(item['default'], item.get('unit'), L)}")
    for output in card['outputs']:
        val = calc_eval(calc_parse(output['expr'], list(values)), values)
        shown = calc_format(val, output, card, 'de' if L.de else 'en')
        lines.append(f"{_one(output['label'])}: {shown}")
    first = card['inputs'][0]
    example = first['name'] + ' ' + _num(first['default'], L)
    return lines + [L(f'Reply with other values, e.g. "{example}".', f'Antworte mit anderen Werten, z. B. "{example}".')]

def _rank(card, L):
    lines = _head(card, 'title', 'prompt')
    for i, item in enumerate(card['items'], 1): lines.append(f"{i}. " + _join([_one(item['label']), _one(item.get('detail', ''))]))
    return lines + [L('Reply with the numbers in your order, e.g. "3, 1, 2".', 'Antworte mit den Nummern in deiner Reihenfolge, z. B. "3, 1, 2".')]

def _recipe(card, L):
    lines = _head(card, 'title'); lines.append(L(f"Servings: {card['servings']}", f"Portionen: {card['servings']}"))
    groups = {}
    for item in card['ingredients']: groups.setdefault(item.get('group', ''), []).append(item)
    for group, items in groups.items():
        if group: lines.append(_one(group))
        for item in items:
            amount = _with_unit(item['qty'], item.get('unit'), L) if 'qty' in item else _one(item.get('unit', ''))
            lines.append(_join([_join([amount, _one(item['item'])], ' '), _one(item.get('note', ''))]))
    for i, step in enumerate(card.get('steps', []), 1):
        lines.append(f"{i}. {_one(step['text'])}" + (L(f" ({step['minutes']} min)", f" ({step['minutes']} Min.)") if 'minutes' in step else ''))
    return lines + [L('Reply with the ingredients you are missing, or a number of servings.', 'Antworte mit den fehlenden Zutaten oder einer Portionszahl.')]

def _flashcards(card, L):
    lines = _head(card, 'title')
    for i, item in enumerate(card['cards'], 1): lines.append(f"{i}. {_one(item['front'])}")
    return lines + [L('Reply with your answers, or "show 3" to see a back.', 'Antworte mit deinen Antworten oder mit "3 zeigen", um eine Rückseite zu sehen.')]


_RENDERERS = {
    "plan": _plan, "review": _review, "decision": _decision, "calc": _calc,
    "rank": _rank, "recipe": _recipe, "flashcards": _flashcards,
    "choice": _choice,
    "checklist": _checklist,
    "compare": _compare,
    "form": _form,
    "confirm": _confirm,
    "rating": _rating,
    "slider": _slider,
    "schedule": _schedule,
    "steps": _steps,
    "quiz": _quiz,
}


def _generic(card, L: _L) -> list[str]:
    lines = []
    if isinstance(card, dict):
        lines = _head(card, "title", "question", "description")
    return lines + [L("Reply with your answer.", "Schreib deine Antwort.")]


def render_text(card: dict) -> str:
    """The plain-text version of one normalized card. Never raises, never returns an empty string."""
    try:
        L = _L(card if isinstance(card, dict) else {})
        render = _RENDERERS.get(card.get("type")) if isinstance(card, dict) else None
        lines = render(card, L) if render else _generic(card, L)
    except Exception:  # a broken card must still give the user something to answer
        try:
            lines = _generic(card, _L(card if isinstance(card, dict) else {}))
        except Exception:
            lines = ["Reply with your answer."]
    return "\n".join(lines)
