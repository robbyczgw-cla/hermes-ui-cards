"""Server-side card state shared by the agent half (tool + hooks) and the backend routes
(dashboard/plugin_api.py): which chat showed a card, which of its chats answered it, and the
display settings the Desktop half applies.

Standard library only and no relative imports: plugin_api.py loads this file by path, because
Hermes imports a plugin's backend as a standalone module, outside the plugin package.

Storage: one SQLite file, ``<plugin data dir of the active profile>/answers.db``. Every write is
one ``BEGIN IMMEDIATE`` transaction, so two processes of one profile (the Desktop backend, a CLI
chat, a branch) never lose each other's update; the routes only read.

A card belongs to the chat that showed it. ``members``: that chat plus any branch whose own
history holds the card's tool result. ``links``: compaction continuations Hermes reported through
the ``post_compaction`` hook (new session id -> old one). An answer counts only from a member or a
continuation of one, and a lookup returns an answer only to sessions on the same continuation
line: another chat that copies a card id gets nothing and locks nothing. The first answer stays;
a second one for the same card on the same line is reported as a duplicate.

Storage errors fail closed: nothing is recorded and a lookup knows nothing. There is never a
fallback to another profile's directory. Times are milliseconds since the epoch (what the Desktop
half compares with Date.now()).
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
from contextlib import contextmanager
from pathlib import Path

PLUGIN_ID = "hermes-ui-cards"
DB_NAME = "answers.db"
MAX_CARDS = 2000              # cards kept; the least recently touched go first
MAX_LINKS = 5000              # compaction links kept
MAX_SESSIONS_PER_CARD = 8     # answering chats per card (a card copied into branches)
MAX_MEMBERS_PER_CARD = 16     # chats a card belongs to (where it was shown + verified branches)
MAX_DEPTH = 64                # compaction links followed from one session
MAX_LOOKUP = 100              # card ids one lookup answers
MAX_SESSION_ID = 256
MAX_SUMMARY = 300             # characters of line 1 kept for the receipt
MAX_MESSAGE = 20000           # characters of a user message parse_reply looks at


def _max_reply_chars() -> int:
    try:
        schema = json.loads((Path(__file__).resolve().parent / "cards.schema.json").read_text(encoding="utf-8"))
        return int(schema["limits"]["maxReplyChars"])
    except (OSError, ValueError, KeyError, TypeError):
        return 4000


# The answer JSON (line 2) kept with the receipt. Desktop caps a reply at maxReplyChars code points;
# UTF-8 needs at most 4 bytes for one and re-encoding never grows it beyond that, so every reply a
# card can send fits. Only a longer hand-made message loses its data (the receipt stays).
MAX_DATA_BYTES = 4 * _max_reply_chars() + 4000
MARKS = ("✓", "✗", "✎", "⚠")
CARD_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
REPLY_RE = re.compile(r"^\[hui-card\] (\{.*\})\s*$", re.M)
_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f-\x9f  ]+")

ACCENTS = ["app", "blue", "green", "orange", "purple", "red"]
UNDO_CHOICES = (0, 4, 8)
UNDO_DEFAULT = 4

_SCHEMA = """
CREATE TABLE IF NOT EXISTS cards (card TEXT PRIMARY KEY, type TEXT NOT NULL, session TEXT NOT NULL,
                                  shown_at INTEGER NOT NULL, touched INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS cards_touched ON cards(touched);
CREATE TABLE IF NOT EXISTS members (card TEXT NOT NULL, session TEXT NOT NULL, at INTEGER NOT NULL,
                                    PRIMARY KEY (card, session));
CREATE TABLE IF NOT EXISTS answers (card TEXT NOT NULL, session TEXT NOT NULL, mark TEXT NOT NULL,
                                    summary TEXT NOT NULL, data TEXT NOT NULL, at INTEGER NOT NULL,
                                    PRIMARY KEY (card, session));
CREATE TABLE IF NOT EXISTS links (session TEXT PRIMARY KEY, parent TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS links_parent ON links(parent);
CREATE INDEX IF NOT EXISTS links_at ON links(at);
"""


# ── where ──

def _hermes_home() -> Path:
    """The active profile's Hermes home: ``get_hermes_home()`` follows the request's profile."""
    try:
        from hermes_constants import get_hermes_home
    except ImportError:  # outside Hermes (tests, tooling): the process' own home
        return Path(os.environ.get("HERMES_HOME") or Path.home() / ".hermes")
    return Path(get_hermes_home())


def data_root() -> Path:
    """``plugin_data_dir`` of the active profile. Its errors propagate: a caller that cannot reach
    this profile's directory fails closed instead of opening another profile's files."""
    try:
        from plugins.plugin_storage import plugin_data_dir
    except ImportError:  # a Hermes without the helper: the same layout under the profile's home
        plugin_data_dir = None
    if plugin_data_dir is not None:
        return Path(plugin_data_dir(PLUGIN_ID))
    root = _hermes_home() / "plugin-data" / PLUGIN_ID
    root.mkdir(parents=True, exist_ok=True)
    return root


def _open(path: Path) -> sqlite3.Connection:
    try:
        from plugins.plugin_storage import plugin_db
    except ImportError:
        plugin_db = None
    if plugin_db is not None:
        conn = plugin_db(PLUGIN_ID, DB_NAME)  # the public helper: WAL with Hermes' own safeguards
    else:
        conn = sqlite3.connect(str(path), timeout=5, check_same_thread=False)
        conn.execute("PRAGMA busy_timeout=5000")
        try:
            conn.execute("PRAGMA journal_mode=WAL")
        except sqlite3.DatabaseError:
            pass  # DELETE journaling still serializes writers
    conn.isolation_level = None  # transactions are explicit below
    return conn


@contextmanager
def _db(write: bool):
    """One transaction on this profile's store; ``None`` for a read when nothing was stored yet."""
    path = data_root() / DB_NAME
    if not write and not path.exists():
        yield None  # a lookup never creates the store
        return
    conn = _open(path)
    try:
        if write:
            conn.executescript(_SCHEMA)  # idempotent; outside the transaction (executescript commits)
            conn.execute("BEGIN IMMEDIATE")  # the write lock first: no lost update between processes
        else:
            conn.execute("BEGIN")
        try:
            yield conn
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        conn.execute("COMMIT")
    finally:
        conn.close()


def _valid_session(session_id) -> bool:
    return isinstance(session_id, str) and 0 < len(session_id) <= MAX_SESSION_ID and session_id.strip() == session_id


def _valid_card(card_id) -> bool:
    return isinstance(card_id, str) and bool(CARD_ID_RE.match(card_id))


def _now_ms() -> int:
    return int(time.time() * 1000)


# ── continuation lines ──

def _ancestors(conn, session_id: str) -> list[str]:
    """The session and the sessions it continues (compaction links, nearest first)."""
    rows = conn.execute(
        "WITH RECURSIVE up(s, d) AS (SELECT ?, 0 UNION SELECT l.parent, up.d + 1 FROM links l "
        "JOIN up ON l.session = up.s WHERE up.d < ?) SELECT s FROM up ORDER BY d", (session_id, MAX_DEPTH)).fetchall()
    return list(dict.fromkeys(r[0] for r in rows))


def _descendants(conn, session_id: str) -> set[str]:
    rows = conn.execute(
        "WITH RECURSIVE down(s, d) AS (SELECT ?, 0 UNION SELECT l.session, down.d + 1 FROM links l "
        "JOIN down ON l.parent = down.s WHERE down.d < ?) SELECT s FROM down", (session_id, MAX_DEPTH)).fetchall()
    return {r[0] for r in rows}


def _line(conn, session_id: str) -> tuple[set[str], set[str]]:
    """(ancestors incl. the session, the whole line: ancestors and continuations)."""
    up = set(_ancestors(conn, session_id))
    return up, up | _descendants(conn, session_id)


def _members(conn, card_id: str) -> set[str]:
    return {r[0] for r in conn.execute("SELECT session FROM members WHERE card = ?", (card_id,))}


def _answers(conn, card_id: str) -> dict[str, dict]:
    out = {}
    for session, mark, summary, data, at in conn.execute(
            "SELECT session, mark, summary, data, at FROM answers WHERE card = ?", (card_id,)):
        try:
            parsed = json.loads(data)
        except (TypeError, ValueError, RecursionError):
            parsed = {}
        out[session] = {"mark": mark, "summary": summary, "data": parsed, "at": at}
    return out


def _visible(answers: dict, session_id: str, line: set[str]) -> dict | None:
    """This chat's own answer, else the first answer given on its continuation line."""
    if session_id in answers:
        return answers[session_id]
    seen = [r for s, r in answers.items() if s in line]
    return min(seen, key=lambda r: r["at"] if isinstance(r.get("at"), int) else 0) if seen else None


def _prune(conn) -> None:
    conn.execute("DELETE FROM cards WHERE card IN (SELECT card FROM cards ORDER BY touched DESC LIMIT -1 OFFSET ?)",
                 (MAX_CARDS,))
    conn.execute("DELETE FROM members WHERE card NOT IN (SELECT card FROM cards)")
    conn.execute("DELETE FROM answers WHERE card NOT IN (SELECT card FROM cards)")
    conn.execute("DELETE FROM links WHERE session IN (SELECT session FROM links ORDER BY at DESC LIMIT -1 OFFSET ?)",
                 (MAX_LINKS,))


def _add_member(conn, card_id: str, session_id: str) -> None:
    conn.execute("INSERT OR IGNORE INTO members (card, session, at) VALUES (?, ?, ?)", (card_id, session_id, _now_ms()))
    conn.execute("DELETE FROM members WHERE card = ? AND session IN (SELECT session FROM members WHERE card = ? "
                 "AND session != (SELECT session FROM cards WHERE card = ?) ORDER BY at DESC LIMIT -1 OFFSET ?)",
                 (card_id, card_id, card_id, MAX_MEMBERS_PER_CARD - 1))


# ── what the agent half records ──

def note_shown(session_id: str, card_id: str, card_type: str) -> None:
    """A card was shown in this chat (Desktop): it belongs to this chat from now on."""
    if not _valid_session(session_id) or not _valid_card(card_id):
        return
    now = _now_ms()
    with _db(write=True) as conn:
        conn.execute("INSERT OR IGNORE INTO cards (card, type, session, shown_at, touched) VALUES (?, ?, ?, ?, ?)",
                     (card_id, str(card_type)[:32], session_id, now, now))
        _add_member(conn, card_id, session_id)
        _prune(conn)


def link_sessions(session_id: str, old_session_id: str) -> bool:
    """Hermes continues the chat ``old_session_id`` as ``session_id`` (compaction). Returns whether
    the link was stored; a link that would close a loop is refused."""
    if not _valid_session(session_id) or not _valid_session(old_session_id) or session_id == old_session_id:
        return False
    with _db(write=True) as conn:
        if session_id in _ancestors(conn, old_session_id):
            return False
        conn.execute("INSERT OR REPLACE INTO links (session, parent, at) VALUES (?, ?, ?)",
                     (session_id, old_session_id, _now_ms()))
        _prune(conn)
    return True


def _one_line(value, limit: int) -> str:
    text = _CONTROL_RE.sub(" ", str(value or ""))
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit - 1] + "…"


def parse_reply(user_message) -> dict | None:
    """The answer a card message carries: ``{card, type, mark, summary, data}``, or None.

    Line 2 (``[hui-card] {json}``) is the machine part; line 1 (``✓ summary``) the receipt.
    The message is user input: everything is checked, clipped and re-encoded."""
    if not isinstance(user_message, str) or len(user_message) > MAX_MESSAGE:
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
        # A lone surrogate (a split emoji) cannot be stored as UTF-8: replace it, keep the rest.
        raw = encoded.encode("utf-8", "surrogatepass")
        data = json.loads(raw.decode("utf-8", "replace"))
    except (ValueError, TypeError, RecursionError):
        return None
    if len(raw) > MAX_DATA_BYTES:
        data = {"card": card_id, "type": data.get("type")}
    card_type = data.get("type")
    return {"card": card_id, "type": card_type if isinstance(card_type, str) else "",
            "mark": mark or "✓", "summary": summary, "data": data}


def record_answer(session_id: str, reply: dict, verified: bool = False, card_type: str = "") -> dict:
    """Record the answer this chat gave to one card. ``verified``: the chat's own history holds the
    card's tool result (a branch, or a card this store lost), so the chat may answer it.

    Returns ``{"status": s, "type": t, "record": r}`` with s one of
    ``recorded`` (stored), ``duplicate`` (this line already answered; ``record`` is that first answer,
    nothing changes), ``foreign`` (the card belongs to another chat: nothing stored),
    ``unknown`` (no such card here), ``invalid``. Storage errors raise: the caller fails closed."""
    if not _valid_session(session_id) or not isinstance(reply, dict) or not _valid_card(reply.get("card")):
        return {"status": "invalid", "type": "", "record": None}
    card_id = reply["card"]
    if not verified and not (data_root() / DB_NAME).exists():
        return {"status": "unknown", "type": "", "record": None}  # nothing shown here yet: create nothing
    now = _now_ms()
    data = reply.get("data") if isinstance(reply.get("data"), dict) else {}
    record = {"mark": reply.get("mark") if reply.get("mark") in MARKS else "✓",
              "summary": _one_line(reply.get("summary"), MAX_SUMMARY), "data": data, "at": now}
    with _db(write=True) as conn:
        row = conn.execute("SELECT type FROM cards WHERE card = ?", (card_id,)).fetchone()
        if row is None:
            if not verified:
                return {"status": "unknown", "type": "", "record": None}
            kind = str(card_type or reply.get("type") or "")[:32]
            conn.execute("INSERT INTO cards (card, type, session, shown_at, touched) VALUES (?, ?, ?, ?, ?)",
                         (card_id, kind, session_id, now, now))
            row = (kind,)
        kind = row[0]
        up, line = _line(conn, session_id)
        if not up & _members(conn, card_id):
            if not verified:
                return {"status": "foreign", "type": kind, "record": None}
            _add_member(conn, card_id, session_id)
        first = _visible(_answers(conn, card_id), session_id, line)
        if first is not None:
            return {"status": "duplicate", "type": kind, "record": _public(first)}
        conn.execute("INSERT OR REPLACE INTO answers (card, session, mark, summary, data, at) VALUES (?, ?, ?, ?, ?, ?)",
                     (card_id, session_id, record["mark"], record["summary"],
                      json.dumps(data, ensure_ascii=False, separators=(",", ":")), now))
        conn.execute("DELETE FROM answers WHERE card = ? AND session IN (SELECT session FROM answers WHERE card = ? "
                     "ORDER BY at DESC LIMIT -1 OFFSET ?)", (card_id, card_id, MAX_SESSIONS_PER_CARD))
        conn.execute("UPDATE cards SET touched = ? WHERE card = ?", (now, card_id))
        _prune(conn)
    return {"status": "recorded", "type": kind, "record": record}


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

    Answered: this chat, or a session on its continuation line, answered the card. Open: the card
    belongs to this chat (or a chat it continues) and nobody on the line answered it yet. A card in
    neither list is unknown here: another chat's card, shown before this version, on another
    backend, evicted, or the store is unreachable (fail closed: the Desktop keeps its local state)."""
    out: dict = {"answers": {}, "open": []}
    if not _valid_session(session_id) or not isinstance(card_ids, (list, tuple)):
        return out
    wanted = list(dict.fromkeys(c for c in card_ids[:MAX_LOOKUP] if _valid_card(c)))
    if not wanted:
        return out
    try:
        with _db(write=False) as conn:
            if conn is None:
                return out
            up, line = _line(conn, session_id)
            for card_id in wanted:
                members = _members(conn, card_id)
                if not members & line:
                    continue  # not this chat's card: say nothing about it
                mine = _visible(_answers(conn, card_id), session_id, line)
                if mine is not None:
                    out["answers"][card_id] = _public(mine)
                elif members & up:
                    out["open"].append(card_id)
    except Exception:  # storage trouble: know nothing rather than guess (and never another profile)
        return {"answers": {}, "open": []}
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
