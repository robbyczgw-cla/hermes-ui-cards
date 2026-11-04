"""The `hui_present` tool and the hooks that keep a Desktop card visible.

Flow (docs/protocol.md):
- validate the card; an invalid card is a tool error that names each bad field
- Hermes Desktop: write a Markdown copy of the card, return `MEDIA:<path>` plus
  the normalized card; the Desktop half draws it from the tool result
- every other surface (CLI, TUI, messaging, API): return the plain-text version
"""
from __future__ import annotations

import json
import os
import secrets
import threading
import time
from pathlib import Path

from .fallback import render_text
from .schema import CARD_TYPES, SCHEMA, validate_card

PLUGIN_ID = "hermes-ui-cards"
TOOL_NAME = "hui_present"
MAX_CARD_FILES = 500
PENDING_TTL_S = 30 * 60
ACCENTS = ["app", "blue", "green", "orange", "purple", "red"]

_settings_reader = None  # set by register(): key, default -> value
_pending: dict[str, list[tuple[float, str]]] = {}
_pending_lock = threading.Lock()


def configure(settings_reader) -> None:
    global _settings_reader
    _settings_reader = settings_reader


def setting(key: str, default):
    if _settings_reader is None:
        return default
    try:
        value = _settings_reader(key, default)
    except Exception:
        return default
    return default if value is None else value


def display_settings() -> dict:
    accent = str(setting("accent", "app"))
    return {
        "compact": bool(setting("compact", False)),
        "accent": accent if accent in ACCENTS else "app",
    }


# ── surface detection ──

def _session_env(name: str) -> str:
    try:
        from gateway.session_context import get_session_env
        return str(get_session_env(name, "") or "")
    except Exception:
        return os.environ.get(name, "")


def current_surface() -> str:
    """Where this turn is shown: "desktop", a messaging platform name, "cli", "tui", … or ""."""
    platform = os.environ.get("HERMES_PLATFORM") or _session_env("HERMES_SESSION_PLATFORM")
    source = _session_env("HERMES_SESSION_SOURCE")
    for ident in (platform, source):
        if ident.strip().lower() == "desktop":
            return "desktop"
    return (platform or source).strip().lower()


# ── card files ──

def cards_dir() -> Path:
    try:
        from plugins.plugin_storage import plugin_data_dir
        root = plugin_data_dir(PLUGIN_ID)
    except Exception:
        home = os.environ.get("HERMES_HOME") or str(Path.home() / ".hermes")
        root = Path(home) / "plugin-data" / PLUGIN_ID
    path = root / "cards"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _prune(directory: Path) -> None:
    files = sorted(directory.glob("*.md"), key=lambda p: p.stat().st_mtime)
    for old in files[:-MAX_CARD_FILES]:
        try:
            old.unlink()
        except OSError:
            pass


def _write_card_file(card: dict, text: str) -> Path:
    directory = cards_dir()
    path = directory / f"{card['cardId']}.md"
    body = text + "\n\n" + "<!-- hermes-ui-cards " + json.dumps(card, ensure_ascii=False) + " -->\n"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(body, encoding="utf-8")
    tmp.replace(path)
    _prune(directory)
    return path


def media_tag(path: Path) -> str:
    value = str(path)
    return f'MEDIA:"{value}"' if any(ch.isspace() for ch in value) else f"MEDIA:{value}"


# ── pending MEDIA lines (for the transform_llm_output safety net) ──

def _remember(session_id: str, tag: str) -> None:
    if not session_id:
        return
    now = time.time()
    with _pending_lock:
        for key in [k for k, v in _pending.items() if v and now - v[-1][0] > PENDING_TTL_S]:
            _pending.pop(key, None)
        _pending.setdefault(session_id, []).append((now, tag))


def take_pending(session_id: str) -> list[str]:
    with _pending_lock:
        entries = _pending.pop(session_id or "", [])
    now = time.time()
    return [tag for ts, tag in entries if now - ts <= PENDING_TTL_S]


def on_turn_start(session_id: str = "", **_kwargs):
    """pre_llm_call: a new turn starts; forget MEDIA lines of a turn that never finished."""
    with _pending_lock:
        _pending.pop(session_id or "", None)
    return None


def ensure_media_lines(response_text: str = "", session_id: str = "", **_kwargs):
    """transform_llm_output: append the MEDIA line of every card this turn presented
    that the reply does not already contain. Returns None when nothing changes."""
    tags = take_pending(session_id)
    if not tags or not isinstance(response_text, str):
        return None
    missing = [t for t in tags if t.split(":", 1)[1].strip('"') not in response_text]
    if not missing:
        return None
    return response_text.rstrip() + "\n\n" + "\n".join(missing)


# ── the tool ──

def _new_card_id(card: dict) -> str:
    return f"{card.get('id') or card['type']}-{secrets.token_hex(3)}"


def _error(message: str, problems: list | None = None, warnings: list | None = None) -> str:
    out: dict = {"error": message}
    if problems:
        out["problems"] = problems
    if warnings:
        out["warnings"] = warnings
    return json.dumps(out, ensure_ascii=False)


DESKTOP_NEXT = (
    "The card is ready. Reply with at most one short sentence, then this line on its own line: {tag}\n"
    "Do not repeat the card's content as text and do not ask the same question again. Then end your turn. "
    "The user's answer arrives as their next message: line 1 is a short summary, line 2 is "
    "'[hui-card] {{json}}' with \"card\": \"{card_id}\" and the answer. Act on line 2."
)
TEXT_NEXT = (
    "Interactive cards can't be shown on this surface. Send the text in `text` as your reply, unchanged "
    "(one short intro sentence before it is fine). The user answers by typing a number or words; map their "
    "reply to the options in this card."
)


def present(args: dict, session_id: str = "", surface: str | None = None) -> str:
    if not isinstance(args, dict):
        return _error("hui_present takes {\"card\": {...}}")
    raw = args.get("card")
    demo = args.get("demo")
    if raw is None and demo is not None:
        from .demos import demo_card
        raw = demo_card(str(demo))
        if raw is None:
            return _error(f"unknown demo \"{demo}\"; use one of: {', '.join(CARD_TYPES)}")
    if raw is None:
        return _error("missing \"card\": pass {\"card\": {\"type\": \"choice\", ...}}")
    card, problems, warnings = validate_card(raw)
    if card is None:
        return _error(f"Card rejected ({len(problems)} problem{'s' if len(problems) != 1 else ''}). "
                      "Fix these fields and call hui_present again.", problems, warnings)
    card = {"cardId": _new_card_id(card), **card}
    text = render_text(card)
    surface = current_surface() if surface is None else surface
    result: dict = {"ok": True, "cardId": card["cardId"], "type": card["type"]}
    if surface == "desktop" and bool(setting("enabled", True)):
        path = _write_card_file(card, text)
        tag = media_tag(path)
        _remember(session_id, tag)
        result.update({
            "media": tag,
            "card": card,
            "display": display_settings(),
            "next": DESKTOP_NEXT.format(tag=tag, card_id=card["cardId"]),
        })
    else:
        result.update({"surface": surface or "text", "text": text, "next": TEXT_NEXT})
    if warnings:
        result["warnings"] = warnings
    return json.dumps(result, ensure_ascii=False)


def handle_present(args, **kwargs) -> str:
    try:
        return present(args, session_id=str(kwargs.get("session_id") or ""))
    except Exception as exc:  # a tool never raises
        return _error(f"hui_present failed: {type(exc).__name__}: {exc}")


# ── what the model reads ──

def _resolved(spec: dict) -> dict:
    if "$ref" not in spec:
        return spec
    merged = dict(SCHEMA["definitions"][spec["$ref"]])
    merged.update({k: v for k, v in spec.items() if k != "$ref"})
    return merged


def _shape(spec: dict) -> str:
    """Compact type notation: options[2-6]{label, icon?}, level: low|medium|high, values[]: string|number."""
    spec = _resolved(spec)
    if "enum" in spec:
        return "|".join(spec["enum"])
    types = spec.get("type")
    types = types if isinstance(types, list) else [types]
    if "array" in types:
        lo, hi = spec.get("minItems"), spec.get("maxItems")
        count = f"{lo}-{hi}" if lo and hi else f"≤{hi}" if hi else ""
        return f"[{count}]" + _shape(spec.get("items", {}))
    if "object" in types:
        req = spec.get("required", [])
        inner = ", ".join(_field(k, v, k in req) for k, v in spec.get("properties", {}).items())
        return "{" + inner + "}"
    if types == ["integer"]:
        return "int"
    fmt = {"datetime": "ISO 8601 like 2026-11-12T14:00", "https-url": "https URL"}.get(spec.get("format"))
    return fmt or "|".join(t for t in types if t)


def _field(name: str, spec: dict, required: bool) -> str:
    shape = _shape(spec)
    mark = "" if required else "?"
    if shape.startswith("[") or shape.startswith("{"):
        return f"{name}{mark}{shape}"
    if shape == "string":
        return f"{name}{mark}"
    if name == "answer":
        return f"{name}{mark}: 0-based option index"
    return f"{name}{mark}: {shape}"


def _signature(ctype: str, spec: dict) -> str:
    req = spec.get("required", [])
    fields = ", ".join(_field(k, v, k in req) for k, v in spec["properties"].items())
    return f"- {ctype}: {spec['summary']} {{{fields}}}"


def tool_description() -> str:
    lines = [
        "Show an interactive card the user answers with a click (Hermes Desktop) or by typing (CLI, "
        "Telegram and other chats get a text version automatically). Use it when the next step needs a "
        "decision or input from the user: pick between options, tick off a list, compare candidates, fill "
        "in details, approve an action. Not for plain answers, facts or explanations: write those as text.",
        "One card per call. After the call, follow the `next` field of the result and end your turn; the "
        "answer comes back as the user's next message with a '[hui-card] {json}' line.",
        "Card types (`?` = optional, strings unless noted, [2-6] = item count; limits are checked and errors name the field):",
    ]
    lines += [_signature(t, s) for t, s in SCHEMA["cards"].items()]
    lines.append("Every card also takes id? (short slug) and lang? (\"en\", \"de\": language of buttons). "
                 "Images: only https URLs you got from a tool or the user, never invented ones. "
                 "Examples of when a card helps and when not: skill_view(\"hermes-ui-cards:hui-cards\").")
    return "\n".join(lines)


def tool_schema() -> dict:
    return {
        "name": TOOL_NAME,
        "description": tool_description(),
        "parameters": {
            "type": "object",
            "properties": {
                "card": {
                    "type": "object",
                    "description": "The card. `type` is one of: " + ", ".join(CARD_TYPES) + ".",
                    "properties": {"type": {"type": "string", "enum": CARD_TYPES}},
                    "required": ["type"],
                },
                "demo": {
                    "type": "string",
                    "enum": CARD_TYPES,
                    "description": "Show a built-in example card of this type instead of `card` (when the "
                                   "user asks to try the plugin).",
                },
            },
        },
    }
