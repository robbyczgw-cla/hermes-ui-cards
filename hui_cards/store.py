"""Server-side card state shared by the agent half (tool + hooks) and the backend routes
(dashboard/plugin_api.py): which cards a chat showed, which of them were answered, and the
display settings the Desktop half applies.

Standard library only and no relative imports: plugin_api.py loads this file by path, because
Hermes imports a plugin's backend as a standalone module, outside the plugin package.

Layout: ``<plugin data dir>/answers/<cardId>.json``, one file per card shown on Desktop:
``{"v": 1, "card": id, "type": t, "shown": {"session": id, "at": ms}, "answers": {session: record}}``
with ``record = {mark, summary, data, at}``. Keyed by card, not by chat: when Hermes continues a
chat under a new session id (compression), an answer given there still matches the card shown
before. Times are milliseconds since the epoch (what the Desktop half compares with Date.now()).
Writes come from the agent process only (present() and pre_llm_call); the routes only read.
Every write is atomic (temporary file + rename), so a reader never sees half a file.
"""
from __future__ import annotations

import json
import os
import re
import secrets
import threading
import time
from pathlib import Path

PLUGIN_ID = "hermes-ui-cards"
MAX_CARDS = 2000              # card files kept; the least recently written go first
MAX_SESSIONS_PER_CARD = 8     # chats that answered one card (a card copied into branches)
MAX_LOOKUP = 100              # card ids one lookup answers
MAX_SESSION_ID = 256
MAX_SUMMARY = 300             # characters of line 1 kept for the receipt
MAX_DATA_BYTES = 6000         # the answer JSON (line 2); larger data is dropped, the receipt stays
MARKS = ("✓", "✗", "✎", "⚠")
CARD_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
REPLY_RE = re.compile(r"^\[hui-card\] (\{.*\})\s*$", re.M)
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f-\x9f\u2028\u2029]+")

ACCENTS = ["app", "blue", "green", "orange", "purple", "red"]
UNDO_CHOICES = (0, 4, 8)
UNDO_DEFAULT = 4

_lock = threading.Lock()


# ── where ──

def data_root() -> Path:
    """``plugin_data_dir`` (follows the active profile on every call), else ``$HERMES_HOME/plugin-data``."""
    try:
        from plugins.plugin_storage import plugin_data_dir
        return plugin_data_dir(PLUGIN_ID)
    except Exception:
        home = os.environ.get("HERMES_HOME") or str(Path.home() / ".hermes")
        root = Path(home) / "plugin-data" / PLUGIN_ID
        root.mkdir(parents=True, exist_ok=True)
        return root


def answers_dir(create: bool = True) -> Path:
    path = data_root() / "answers"
    if create:
        path.mkdir(parents=True, exist_ok=True)
    return path


def _valid_session(session_id) -> bool:
    return isinstance(session_id, str) and 0 < len(session_id) <= MAX_SESSION_ID and session_id.strip() == session_id


def _valid_card(card_id) -> bool:
    return isinstance(card_id, str) and bool(CARD_ID_RE.match(card_id))


def _now_ms() -> int:
    return int(time.time() * 1000)


# ── files ──

def _read(path: Path, card_id: str) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, RecursionError):
        return {}
    if not isinstance(data, dict) or data.get("card") != card_id:
        return {}  # unreadable or an unknown layout: start over
    if not isinstance(data.get("answers"), dict):
        data["answers"] = {}
    return data


def _write(path: Path, data: dict) -> None:
    tmp = path.with_name(f".{path.stem}.{os.getpid()}.{secrets.token_hex(4)}.tmp")
    try:
        tmp.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        os.replace(tmp, path)
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass


def _prune(directory: Path, keep: Path) -> None:
    try:
        files = sorted(directory.glob("*.json"), key=lambda p: p.stat().st_mtime)
    except OSError:
        return
    extra = len(files) - MAX_CARDS
    for old in files:
        if extra <= 0:
            break
        if old == keep:
            continue
        try:
            old.unlink()
            extra -= 1
        except OSError:
            pass


def _update(card_id: str, change):
    """Read-modify-write one card's file under the process lock. ``change(data)`` edits in place."""
    if not _valid_card(card_id):
        return None
    with _lock:
        path = answers_dir() / f"{card_id}.json"
        fresh = not path.exists()
        data = _read(path, card_id) or {"v": 1, "card": card_id, "answers": {}}
        result = change(data)
        answers = data["answers"]
        while len(answers) > MAX_SESSIONS_PER_CARD:
            oldest = min(answers, key=lambda k: (answers[k] or {}).get("at") or 0 if isinstance(answers[k], dict) else 0)
            answers.pop(oldest, None)
        _write(path, data)
        if fresh:
            _prune(path.parent, keep=path)
        return result


# ── what the agent half records ──

def note_shown(session_id: str, card_id: str, card_type: str) -> None:
    """A card was shown in this chat (Desktop). From now on the store knows whether it is answered."""
    if not _valid_session(session_id):
        return

    def change(data):
        if not isinstance(data.get("shown"), dict):
            data["type"] = str(card_type)[:32]
            data["shown"] = {"session": session_id, "at": _now_ms()}

    _update(card_id, change)


def _one_line(value, limit: int) -> str:
    text = _CONTROL_RE.sub(" ", str(value or ""))
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit - 1] + "…"


def parse_reply(user_message) -> dict | None:
    """The answer a card message carries: ``{card, type, mark, summary, data}``, or None.

    Line 2 (``[hui-card] {json}``) is the machine part; line 1 (``✓ summary``) the receipt.
    The message is user input: everything is checked, clipped and re-encoded."""
    if not isinstance(user_message, str) or len(user_message) > 20000:
        return None
    match = REPLY_RE.search(user_message)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
    except (ValueError, RecursionError):
        return None
    if not isinstance(data, dict):
        return None
    card_id = data.get("card")
    if not isinstance(card_id, str) or not CARD_ID_RE.match(card_id):
        return None
    before = [ln.strip() for ln in user_message[:match.start()].split("\n") if ln.strip()]
    first = before[-1] if before else ""
    mark = next((m for m in MARKS if first.startswith(m)), "")
    summary = _one_line(first[len(mark):] if mark else first, MAX_SUMMARY)
    try:
        encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    except (ValueError, TypeError, RecursionError):
        return None
    if len(encoded.encode("utf-8")) > MAX_DATA_BYTES:
        data = {"card": card_id, "type": data.get("type")}
    card_type = data.get("type")
    return {"card": card_id, "type": card_type if isinstance(card_type, str) else "",
            "mark": mark or "✓", "summary": summary, "data": data}


def record_answer(session_id: str, reply: dict, card_type: str = "") -> dict | None:
    """Store the answer this chat gave to one card; returns the stored record (the latest answer wins)."""
    if not _valid_session(session_id) or not isinstance(reply, dict) or not _valid_card(reply.get("card")):
        return None
    record = {"mark": reply.get("mark") if reply.get("mark") in MARKS else "✓",
              "summary": _one_line(reply.get("summary"), MAX_SUMMARY),
              "data": reply.get("data") if isinstance(reply.get("data"), dict) else {},
              "at": _now_ms()}

    def change(data):
        if not data.get("type"):
            data["type"] = str(card_type or reply.get("type") or "")[:32]
        data["answers"][session_id] = record
        return record

    return _update(reply["card"], change)


# ── what the backend route answers ──

def _public(record: dict) -> dict:
    return {
        "mark": record.get("mark") if record.get("mark") in MARKS else "✓",
        "summary": _one_line(record.get("summary"), MAX_SUMMARY),
        "data": record.get("data") if isinstance(record.get("data"), dict) else {},
        "at": record.get("at") if isinstance(record.get("at"), int) else 0,
    }


def lookup(session_id, card_ids) -> dict:
    """``{"answers": {cardId: record}, "open": [cardId]}`` for the given cards of one chat.

    A card counts as answered for this chat when this chat answered it, or when it was shown in this
    chat and answered under another session id (Hermes continues a compressed chat under a new id;
    a branch copies the card). ``open``: shown in this chat and answered nowhere since. A card in
    neither list is unknown here (shown before this version, on another backend, or evicted)."""
    out: dict = {"answers": {}, "open": []}
    if not _valid_session(session_id) or not isinstance(card_ids, (list, tuple)):
        return out
    wanted = [c for c in card_ids[:MAX_LOOKUP] if _valid_card(c)]
    if not wanted:
        return out
    try:
        directory = answers_dir(create=False)  # a lookup never creates anything
    except OSError:
        return out
    for card_id in dict.fromkeys(wanted):
        path = directory / f"{card_id}.json"
        data = _read(path, card_id) if path.exists() else {}
        if not data:
            continue
        answers = {k: v for k, v in data["answers"].items() if isinstance(v, dict)}
        shown = data.get("shown") if isinstance(data.get("shown"), dict) else {}
        mine = answers.get(session_id)
        if mine is None and shown.get("session") == session_id and answers:
            mine = max(answers.values(), key=lambda r: r.get("at") if isinstance(r.get("at"), int) else 0)
        if mine is not None:
            out["answers"][card_id] = _public(mine)
        elif shown.get("session") == session_id:
            out["open"].append(card_id)
    return out


# ── display settings ──

def undo_seconds(value) -> int:
    """``undo_seconds`` as one of 0, 4, 8 (Settings stores the dropdown value as a string)."""
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        return UNDO_DEFAULT
    return number if number in UNDO_CHOICES else UNDO_DEFAULT


def display_settings(setting) -> dict:
    """What the Desktop half applies to every card: ``setting(key, default) -> value``."""
    accent = str(setting("accent", "app"))
    return {
        "compact": setting("compact", False) is True,
        "accent": accent if accent in ACCENTS else "app",
        "undo": undo_seconds(setting("undo_seconds", str(UNDO_DEFAULT))),
    }
