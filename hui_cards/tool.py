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
import re
import secrets
import threading
import time
from pathlib import Path

from . import store
from .fallback import render_text
from .schema import CARD_TYPES, SCHEMA, validate_card

PLUGIN_ID = "hermes-ui-cards"
TOOL_NAME = "hui_present"
MAX_CARD_FILES = 500
PENDING_TTL_S = 30 * 60
REPEAT_WAIT_S = 20  # a parallel twin of a hui_present call waits this long for the first one
ACCENTS = store.ACCENTS

_settings_reader = None  # set by register(): key, default -> value
_pending: dict[str, list[tuple[float, str]]] = {}
_pending_lock = threading.Lock()
# session id -> (time, platform) from pre_llm_call. Gateway-owned sessions (the Desktop app
# and the Webapp attached to a gateway) bind HERMES_SESSION_PLATFORM=local for every local
# client, CLI included; only the agent platform the hooks receive says "desktop".
_turn_platform: dict[str, tuple[float, str]] = {}
# session id -> {normalized card JSON: tool result, or an Event while the first call builds it}
# for the running turn (idempotent repeats)
_turn_cards: dict[str, dict[str, "str | threading.Event"]] = {}
CARD_ID_RE = store.CARD_ID_RE
REPLY_RE = store.REPLY_RE


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
    return store.display_settings(setting)


def enabled_types() -> list[str]:
    """The card types Settings → Plugins leaves on (`card_types`), in schema order. Anything that is
    not a list of known types (unset, empty, a typo only) means all types."""
    value = setting("card_types", None)
    if isinstance(value, str):
        value = [part.strip() for part in value.split(",")]
    if not isinstance(value, (list, tuple)):
        return list(CARD_TYPES)
    wanted = {str(v).strip().lower() for v in value if isinstance(v, str)}
    picked = [t for t in CARD_TYPES if t in wanted]
    return picked or list(CARD_TYPES)


# ── surface detection ──

def _session_env(name: str) -> str:
    try:
        from gateway.session_context import get_session_env
        return str(get_session_env(name, "") or "")
    except Exception:
        return os.environ.get(name, "")


def current_surface(session_id: str = "") -> str:
    """Where this turn is shown: "desktop", a messaging platform name, "cli", "tui", … or ""."""
    if session_id:
        with _pending_lock:
            seen = _turn_platform.get(session_id)
        if seen and time.time() - seen[0] <= PENDING_TTL_S and seen[1]:
            return seen[1]
    platform = os.environ.get("HERMES_PLATFORM") or _session_env("HERMES_SESSION_PLATFORM")
    source = _session_env("HERMES_SESSION_SOURCE")
    for ident in (platform, source):
        if ident.strip().lower() == "desktop":
            return "desktop"
    return (platform or source).strip().lower()


# ── card files ──

def cards_dir() -> Path:
    """``cards/`` in this profile's plugin data dir. Errors propagate (no other profile's dir)."""
    path = store.data_root() / "cards"
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


def read_card_file(card_id: str) -> dict | None:
    """The card a Desktop card file holds (the JSON in its trailing comment), or None."""
    if not isinstance(card_id, str) or not CARD_ID_RE.match(card_id):
        return None
    try:
        text = (cards_dir() / f"{card_id}.md").read_text(encoding="utf-8")
        start = text.rindex("<!-- hermes-ui-cards ") + len("<!-- hermes-ui-cards ")
        return json.loads(text[start:text.rindex(" -->")])
    except (OSError, ValueError):
        return None


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


def _message_text(message) -> str:
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return content if isinstance(content, str) else ""


def _messages_since_card(history, card_id: str, user_message: str) -> int | None:
    """User messages typed after the card was shown (the current one excluded), or None if the
    card's tool result is not in the history (compacted away or another session)."""
    if not isinstance(history, list):
        return None
    shown = None
    for index, message in enumerate(history):
        if isinstance(message, dict) and message.get("role") == "tool" and _presented_card_id(_message_text(message)) == card_id:
            shown = index
    if shown is None:
        return None
    later = [m for m in history[shown + 1:] if isinstance(m, dict) and m.get("role") == "user"]
    if later and _message_text(later[-1]).strip() == (user_message or "").strip():
        later = later[:-1]
    return len(later)


def _json_object(value):
    """A dict from a dict or a JSON object string, else None."""
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (ValueError, RecursionError):
            return None
    return value if isinstance(value, dict) else None


def _bridged_tool(args) -> str | None:
    """The tool a ``tool_call`` bridge call ran, read the way Hermes reads it
    (tools/tool_search_validation.normalize_tool_call_entries): ``{"calls": [{name, arguments}]}``
    or the single shape ``{"name", "arguments"}``. A local tool runs only as the one entry of a
    call, so anything else (a batch, no name, unparsable arguments) did not run hui_present."""
    args = _json_object(args)
    if args is None:
        return None
    calls = args.get("calls")
    if calls is None:
        calls = [{"name": args.get("name")}]
    elif isinstance(calls, str):
        try:
            calls = json.loads(calls)
        except (ValueError, RecursionError):
            return None
    if isinstance(calls, dict):
        calls = [calls]
    if not isinstance(calls, list) or len(calls) != 1 or not isinstance(calls[0], dict):
        return None
    name = calls[0].get("name")
    return name.strip() if isinstance(name, str) else None


def _present_call_ids(history) -> set:
    """Ids of the tool calls in this history that ran hui_present: called by name, or through the
    ``tool_call`` bridge with hui_present as the selected tool (not merely mentioned somewhere)."""
    ids = set()
    for message in history:
        if not isinstance(message, dict) or message.get("role") != "assistant":
            continue
        for call in message.get("tool_calls") or []:
            if not isinstance(call, dict):
                continue
            function = call.get("function") if isinstance(call.get("function"), dict) else {}
            name = function.get("name")
            if name == TOOL_NAME or (name == "tool_call" and _bridged_tool(function.get("arguments")) == TOOL_NAME):
                if isinstance(call.get("id"), str) and call["id"]:
                    ids.add(call["id"])
    return ids


# What Hermes keeps of a tool result too large for the context (tools/tool_result_storage.py):
# a pointer plus the result's first characters. A hui_present result starts with ok and cardId.
_PERSISTED_PREVIEW_RE = re.compile(r'\A<persisted-output>\n.*?\nPreview \(first \d+ chars\):\n'
                                   r'\{"ok": true, "cardId": "([a-z0-9][a-z0-9_-]{0,63})"', re.S)


def _presented_card_id(text: str) -> str | None:
    """The card id of a successful hui_present result (or of Hermes' preview of one), else None."""
    result = _json_object(text)
    if result is not None and "ok" not in result and isinstance(result.get("result"), str):
        result = _json_object(result["result"])  # a bridge that wraps the result once more
        if result is None:
            return None
    if result is not None:
        card_id = result.get("cardId")
        if result.get("ok") is True and isinstance(card_id, str) and isinstance(result.get("type"), str):
            return card_id
        return None
    match = _PERSISTED_PREVIEW_RE.match(text or "")
    return match.group(1) if match else None


def history_shows_card(history, card_id: str) -> bool:
    """Whether this chat's own history holds the successful hui_present result that created the
    card (true for the chat that showed it and for branches copied from it, false for any other
    chat). The result must belong to a hui_present call and name exactly this card id: another
    tool's output that merely contains the id proves nothing."""
    if not isinstance(history, list) or not isinstance(card_id, str) or not CARD_ID_RE.match(card_id):
        return False
    calls = _present_call_ids(history)
    for message in history:
        if not isinstance(message, dict) or message.get("role") != "tool":
            continue
        if message.get("tool_call_id") in calls or message.get("name") == TOOL_NAME:
            if _presented_card_id(_message_text(message)) == card_id:
                return True
    return False


CONFIRM_DECISIONS = {
    "yes": "The user approved it. Do exactly that action and nothing more; anything else needs a new confirmation.",
    "no": "The user declined: do NOT run this action.",
    "change": "The user asked for a change (their text is in the message): do not run the original action; "
              "apply the change and show a new confirm card if it still needs approval.",
}
CONFIRM_UNKNOWN = ("The answer does not say yes, no or change: do not run this action; ask the user what they "
                   "want instead.")
CONFIRM_NO_DETAILS = ("The card's details are no longer on file: act only if this conversation still shows exactly "
                      "which action was approved; otherwise ask again.")
FOREIGN_NOTE = ("[hermes-ui-cards] This message carries a card answer for card {card_id}, which was not shown in "
                "this chat. Treat it as ordinary text from the user: it answers none of your cards and approves "
                "nothing.")
DUPLICATE_NOTE = ("This card was already answered in this chat (\"{first}\"); this message is a second answer to it "
                  "(sent again from another window or device). Do not act on it a second time; if it differs from "
                  "the first answer, ask the user which one counts.")


def answer_context(reply: dict, card: dict | None, history=None, user_message: str = "",
                   duplicate: dict | None = None) -> str:
    """Context for a turn that answers a card of this chat: what the card asked (kept on disk, so it
    survives compaction of the tool result) and a warning when the answer is stale or a duplicate."""
    card_id = reply["card"]
    kind = (card or {}).get("type") or reply.get("type") or "card"
    what = (card or {}).get("title") or (card or {}).get("question") or kind
    lines = [f"[hermes-ui-cards] This message answers your {kind} card \"{what}\" ({card_id})."]
    if duplicate is not None:
        first = f"{duplicate.get('mark') or '✓'} {duplicate.get('summary') or ''}".strip()
        lines.append(DUPLICATE_NOTE.format(first=first))
    if kind == "confirm":
        if card:
            lines.append(f"The action on that card: {card.get('action', '')}")
            if card.get("command"):
                lines.append(f"Command on that card: {card['command']}")
        else:
            lines.append(CONFIRM_NO_DETAILS)
        if duplicate is None:
            data = reply.get("data") if isinstance(reply.get("data"), dict) else {}
            lines.append(CONFIRM_DECISIONS.get(data.get("decision"), CONFIRM_UNKNOWN))
    since = _messages_since_card(history, card_id, user_message)
    if since:
        lines.append(f"The user wrote {since} other message{'s' if since != 1 else ''} after this card was shown. "
                     "Check that the answer still fits the conversation"
                     + (" and ask again before you act on it." if kind == "confirm" else "."))
    return "\n".join(lines)


def answer_turn(session_id: str, user_message: str, history=None) -> str | None:
    """A turn that starts with a card message: record the answer for this chat and say which card it
    answers. Only the chat that showed the card (or a verified continuation or branch of it) can answer
    it; for any other chat the line is plain text and the card's details stay private."""
    reply = store.parse_reply(user_message)
    if reply is None:
        return None
    card_id = reply["card"]
    shown_here = history_shows_card(history, card_id)
    card = read_card_file(card_id) if shown_here else None
    try:
        outcome = store.record_answer(session_id, reply, verified=shown_here,
                                      card_type=(card or {}).get("type") or "")
    except Exception:
        outcome = {"status": "failed", "type": "", "record": None}  # fail closed: nothing recorded
    status = outcome["status"]
    if status == "recorded":
        _announce_answer()
    if status in ("recorded", "duplicate") or shown_here:
        if card is None:
            card = read_card_file(card_id)
        if card is not None and not isinstance(card.get("type"), str):
            card = None
        if card is None and outcome.get("type"):
            reply = {**reply, "type": outcome["type"]}
        return answer_context(reply, card, history, user_message,
                              duplicate=outcome["record"] if status == "duplicate" else None)
    return FOREIGN_NOTE.format(card_id=card_id)


DESKTOP_HINT = (
    "[hermes-ui-cards] Before a multi-step job show your plan as a card the user can edit; when the user has "
    "to judge many drafts, tick off a list, compare 2-4 options, fill in details or approve an action with "
    "consequences, show an interactive card with the hui_present tool (through tool_call if it is deferred). "
    "Plain answers and simple either-or questions stay text or clarify."
)


def desktop_hint() -> str:
    types = enabled_types()
    if len(types) == len(CARD_TYPES):
        return DESKTOP_HINT
    return DESKTOP_HINT + " Card types turned on in this install: " + ", ".join(types) + "."


def on_turn_start(session_id: str = "", platform: str = "", user_message: str = "",
                  conversation_history=None, **_kwargs):
    """pre_llm_call: forget MEDIA lines of a turn that never finished; on Desktop remind the model
    that cards exist (Hermes defers plugin tools behind tool_search, so the model would otherwise
    only see the tool's name); when the message answers a card, say which card and what it asked.
    The context is ephemeral: it is not stored in the session."""
    platform = str(platform or "").strip().lower()
    now = time.time()
    with _pending_lock:
        _pending.pop(session_id or "", None)
        _turn_cards.pop(session_id or "", None)
        if session_id and platform:
            for key in [k for k, v in _turn_platform.items() if now - v[0] > PENDING_TTL_S]:
                _turn_platform.pop(key, None)
            _turn_platform[session_id] = (now, platform)
    parts = []
    surface = platform or current_surface(session_id)
    try:
        context = answer_turn(session_id, user_message, conversation_history)
    except Exception:
        context = None
    if context:
        parts.append(context)
    if surface == "desktop" and bool(setting("enabled", True)):
        parts.append(desktop_hint())
    return {"context": "\n\n".join(parts)} if parts else None


def _announce_answer() -> None:
    """Tell the Desktop windows connected right now that answers changed. The event is global (it may
    reach windows of other profiles), so it carries nothing: each window asks its own profile's route
    for the cards it shows."""
    try:
        from hermes_cli.plugin_events import broadcast_plugin_event
        broadcast_plugin_event(PLUGIN_ID, "answers.changed", {})
    except Exception:
        pass


def on_compaction(session_id: str = "", old_session_id: str = "", **_kwargs):
    """post_compaction: Hermes continues the chat ``old_session_id`` as ``session_id``. Its cards stay
    its cards, answered or open, under the new id (and MEDIA lines of a running turn move along)."""
    session_id, old_session_id = str(session_id or ""), str(old_session_id or "")
    if not session_id or not old_session_id or session_id == old_session_id:
        return None
    with _pending_lock:
        if old_session_id in _pending:
            _pending.setdefault(session_id, []).extend(_pending.pop(old_session_id))
        if old_session_id in _turn_cards:
            _turn_cards.setdefault(session_id, {}).update(_turn_cards.pop(old_session_id))
        if old_session_id in _turn_platform and session_id not in _turn_platform:
            _turn_platform[session_id] = _turn_platform[old_session_id]
    try:
        store.link_sessions(session_id, old_session_id)
    except Exception:
        pass  # fail closed: the new id just does not see the old cards' state
    return None


def ensure_media_lines(response_text: str = "", session_id: str = "", **_kwargs):
    """transform_llm_output: append the MEDIA line of every card this turn presented
    that the reply does not already contain. Returns None when nothing changes."""
    tags = take_pending(session_id)
    if not tags or not isinstance(response_text, str):
        return None
    missing = [t for t in tags if not _has_media_line(response_text, t.split(":", 1)[1].strip('"'))]
    if not missing:
        return None
    return response_text.rstrip() + "\n\n" + "\n".join(missing)


def _has_media_line(text: str, path: str) -> bool:
    """Whether `text` delivers `path` as a MEDIA tag (bare or quoted), not just mentions it."""
    quoted = re.escape(path)
    return bool(re.search(rf'MEDIA:(?:"{quoted}"|{quoted})(?![^\s"])', text))


# ── the tool ──

def _new_card_id(card: dict) -> str:
    return f"{card.get('id') or card['type']}-{secrets.token_hex(5)}"


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
HUI_NEXT = (
    "Send the `hui` block as your reply (one short intro sentence before it is fine). "
    "Do not repeat the card or ask the same question again. End your turn. "
    "The user's answer arrives in their next message as a [type:id] line; read and act on it."
)


def _api_hui_enabled() -> bool:
    mode = setting("api_server_format", "auto")
    if mode != "auto":
        return mode == "hui"
    try:
        # Public read-only config API; disabled takes precedence over enabled.
        from hermes_cli.config import load_config_readonly
        plugins = (load_config_readonly() or {}).get("plugins", {}) or {}
        return ("hermes-ui-plus" in (plugins.get("enabled") or [])
                and "hermes-ui-plus" not in (plugins.get("disabled") or []))
    except Exception:
        return False


def _raw_type(raw):
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (ValueError, RecursionError):
            return None
    return raw.get("type") if isinstance(raw, dict) else None


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
    allowed = enabled_types()
    kind = _raw_type(raw)
    if isinstance(kind, str) and kind in CARD_TYPES and kind not in allowed:
        return _error(f"Card type \"{kind}\" is turned off in this install's settings. "
                      f"Use one of the enabled types: {', '.join(allowed)}; or answer as text.")
    card, problems, warnings = validate_card(raw)
    if card is None:
        return _error(f"Card rejected ({len(problems)} problem{'s' if len(problems) != 1 else ''}). "
                      "Fix these fields and call hui_present again.", problems, warnings)
    size = len(json.dumps(card, ensure_ascii=False).encode("utf-8"))
    limit = SCHEMA["limits"]["maxCardBytes"]
    if size > limit:  # ids and defaults count: the Desktop checks the normalized card
        return _error(f"Card rejected: {size} bytes once ids and defaults are added (limit {limit}). "
                      "Shorten texts or split it into two cards.")
    surface = current_surface(session_id) if surface is None else surface
    content_key = json.dumps([card, surface, bool(setting("enabled", True)), display_settings(),
                              _api_hui_enabled() if surface == "api_server" else None],
                             sort_keys=True, ensure_ascii=False)
    if not session_id:
        return _build(card, warnings, session_id, surface)
    # The same card twice in one turn is one card, not two answerable copies, also when the model
    # sends both calls in parallel: the first call reserves the key, a twin waits for its result.
    for _attempt in range(3):
        with _pending_lock:
            turn = _turn_cards.setdefault(session_id, {})
            entry = turn.get(content_key)
            if entry is None:
                slot = turn[content_key] = threading.Event()
                break
        if isinstance(entry, str):
            return entry
        entry.wait(REPEAT_WAIT_S)
    else:
        return _error("hui_present: the same card is still being created by a parallel call; show it once.")
    out = None
    try:
        out = _build(card, warnings, session_id, surface)
        return out
    finally:
        with _pending_lock:
            turn = _turn_cards.get(session_id)
            if turn is not None and turn.get(content_key) is slot:
                if out is None:
                    turn.pop(content_key, None)  # failed: a twin builds it itself
                else:
                    turn[content_key] = out
        slot.set()


def _build(card: dict, warnings: list, session_id: str, surface: str) -> str:
    card = {"cardId": _new_card_id(card), **card}
    if surface == "api_server" and len(card["cardId"]) > 40:
        card["cardId"] = card["cardId"][:29] + card["cardId"][-11:]
    text = render_text(card)
    result: dict = {"ok": True, "cardId": card["cardId"], "type": card["type"]}
    path = None
    if surface == "desktop" and bool(setting("enabled", True)):
        try:
            path = _write_card_file(card, text)
        except OSError:
            path = None  # this profile's data dir is unavailable: the text version still works
    if path is not None:
        tag = media_tag(path)
        if session_id:
            try:
                store.note_shown(session_id, card["cardId"], card["type"])
            except Exception:
                pass  # the card still works; it is only not tracked across devices (fail closed)
        _remember(session_id, tag)
        result.update({
            "media": tag,
            "card": card,
            "display": display_settings(),
            "next": DESKTOP_NEXT.format(tag=tag, card_id=card["cardId"]),
        })
    elif surface == "api_server" and _api_hui_enabled():
        from .hui_blocks import to_hui_node
        node = to_hui_node(card)
        if node is None:
            result.update({"surface": surface, "text": text, "next": TEXT_NEXT})
        else:
            encoded = json.dumps(node, ensure_ascii=False).replace("`", "\\u0060")
            result.update({"surface": surface, "hui": "```hui\n" + encoded + "\n```",
                           "text": text, "next": HUI_NEXT})
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
    if fmt and "null" in types:
        fmt += "|null"
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
    if name == "best" and shape == "int":
        return f"{name}{mark}: 0-based column index of the best value"
    return f"{name}{mark}: {shape}"


def _signature(ctype: str, spec: dict) -> str:
    req = spec.get("required", [])
    fields = ", ".join(_field(k, v, k in req) for k, v in spec["properties"].items())
    return f"- {ctype}: {spec['summary']} {{{fields}}}"


def tool_description() -> str:
    lines = [
        "Interactive cards: checklist, compare, form, steps, confirm. "
        "The user answers with a click in Hermes Desktop or by typing elsewhere (CLI, Telegram and other chats "
        "get a text version automatically). Use it when the next step needs a "
        "decision or input from the user: pick between options, tick off a list, compare candidates, fill "
        "in details, follow a guided walkthrough, approve an action. Not for plain answers, facts or explanations: "
        "write those as text. A single question with a few plain options is the built-in clarify tool's job.",
        "One card per call. After the call, follow the `next` field of the result and end your turn; the "
        "answer comes back as the user's next message with a '[hui-card] {json}' line.",
        "Card types (`?` = optional, strings unless noted, [2-6] = item count; limits are checked and errors name the field):",
    ]
    types = enabled_types()  # read once at registration: Settings changes apply after a Hermes restart
    lines += [_signature(t, s) for t, s in SCHEMA["cards"].items() if t in types]
    lines.append("Every card also takes id? (short slug) and lang? (\"en\", \"de\": language of buttons). "
                 "Images: only https URLs you got from a tool or the user, never invented ones. "
                 "Examples of when a card helps and when not: skill_view(\"hermes-ui-cards:hui-cards\").")
    return "\n".join(lines)


def tool_schema() -> dict:
    types = enabled_types()
    return {
        "name": TOOL_NAME,
        "description": tool_description(),
        "parameters": {
            "type": "object",
            "properties": {
                "card": {
                    "type": "object",
                    "description": "The card. `type` is one of: " + ", ".join(types) + ".",
                    "properties": {"type": {"type": "string", "enum": types}},
                    "required": ["type"],
                },
                "demo": {
                    "type": "string",
                    "enum": types,
                    "description": "Show a built-in example card of this type instead of `card` (when the "
                                   "user asks to try the plugin).",
                },
            },
        },
    }
