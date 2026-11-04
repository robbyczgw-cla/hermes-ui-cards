"""Server-side answer memory (hui_cards/store.py), the backend routes (dashboard/plugin_api.py),
the card_types / undo_seconds settings and the hook that records answers."""
import importlib.util
import json
import sys
import threading
import time
import types
from pathlib import Path

import pytest

from hui_cards import store, tool
from hui_cards.command import handle_cards
from hui_cards.schema import CARD_TYPES

ROOT = Path(__file__).resolve().parent.parent

CHOICE = {"type": "choice", "id": "trip", "question": "Where to?",
          "options": [{"label": "Lisbon"}, {"label": "Berlin"}]}


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))
    for name in ("HERMES_PLATFORM", "HERMES_SESSION_PLATFORM", "HERMES_SESSION_SOURCE"):
        monkeypatch.delenv(name, raising=False)
    tool.configure(None)
    tool._pending.clear()
    tool._turn_platform.clear()
    tool._turn_cards.clear()
    yield tmp_path


@pytest.fixture
def events(monkeypatch):
    """Capture broadcast_plugin_event calls (the public hermes_cli.plugin_events API)."""
    sent = []
    package = types.ModuleType("hermes_cli")
    package.__path__ = []
    module = types.ModuleType("hermes_cli.plugin_events")
    module.broadcast_plugin_event = lambda plugin_id, event, payload=None: sent.append((plugin_id, event, payload))
    monkeypatch.setitem(sys.modules, "hermes_cli", package)
    monkeypatch.setitem(sys.modules, "hermes_cli.plugin_events", module)
    return sent


def show(session="s1", card=CHOICE):
    return json.loads(tool.present({"card": card}, session_id=session, surface="desktop"))


def click_message(card_id, line1="✓ Chose: Lisbon", **data):
    return line1 + "\n[hui-card] " + json.dumps({"card": card_id, "type": "choice", "selected": ["o1"],
                                                 "labels": ["Lisbon"], **data}, ensure_ascii=False)


def answer(session, card_id, **kw):
    return tool.on_turn_start(session_id=session, platform="desktop", user_message=click_message(card_id, **kw),
                              conversation_history=[])


# ── recording ──

def test_shown_card_is_open_until_answered_then_answered(events):
    out = show("s1")
    cid = out["cardId"]
    assert store.lookup("s1", [cid]) == {"answers": {}, "open": [cid]}
    answer("s1", cid)
    got = store.lookup("s1", [cid])
    assert got["open"] == []
    rec = got["answers"][cid]
    assert rec["mark"] == "✓" and rec["summary"] == "Chose: Lisbon"
    assert rec["data"]["selected"] == ["o1"] and rec["data"]["card"] == cid
    assert abs(rec["at"] - time.time() * 1000) < 5000
    assert events == [("hermes-ui-cards", "answer.recorded", {"session_id": "s1", "card": cid, "answer": rec})]


def test_other_chats_know_nothing_about_the_card():
    cid = show("s1")["cardId"]
    answer("s1", cid)
    assert store.lookup("other", [cid]) == {"answers": {}, "open": []}


def test_answer_under_a_continued_session_id_still_locks_the_card():
    # Hermes continues a compressed chat under a new session id; the card was shown under the old one.
    cid = show("old-id")["cardId"]
    answer("new-id", cid)
    assert cid in store.lookup("old-id", [cid])["answers"]
    assert cid in store.lookup("new-id", [cid])["answers"]


def test_latest_answer_wins_and_marks_are_kept():
    cid = show("s1")["cardId"]
    answer("s1", cid)
    answer("s1", cid, line1="✗ No, don't: x")
    rec = store.lookup("s1", [cid])["answers"][cid]
    assert rec["mark"] == "✗" and rec["summary"] == "No, don't: x"


def test_cli_answers_are_recorded_without_a_desktop_event(events):
    cid = show("s1")["cardId"]
    tool.on_turn_start(session_id="s1", platform="cli", user_message=click_message(cid), conversation_history=[])
    assert cid in store.lookup("s1", [cid])["answers"]
    assert events == []


def test_text_surfaces_record_nothing(isolated):
    out = json.loads(tool.present({"card": CHOICE}, session_id="s1", surface="telegram"))
    assert store.lookup("s1", [out["cardId"]]) == {"answers": {}, "open": []}
    assert not (isolated / "plugin-data" / "hermes-ui-cards" / "answers").exists()


def test_answers_to_unknown_cards_are_not_recorded(isolated):
    tool.on_turn_start(session_id="s1", platform="desktop", user_message=click_message("ghost-0000000000"))
    answers_dir = isolated / "plugin-data" / "hermes-ui-cards" / "answers"
    assert not answers_dir.exists() or not list(answers_dir.glob("*.json"))


def test_storage_failure_never_breaks_the_turn(monkeypatch):
    cid = show("s1")["cardId"]
    monkeypatch.setattr(store, "_write", lambda *a: (_ for _ in ()).throw(OSError("disk full")))
    ctx = answer("s1", cid)
    assert "This message answers your choice card" in ctx["context"]
    assert json.loads(tool.present({"card": {**CHOICE, "question": "Again?"}}, session_id="s1",
                                   surface="desktop"))["ok"] is True


def test_writes_are_atomic_and_leave_no_temp_files(isolated):
    cid = show("s1")["cardId"]
    for _ in range(5):
        answer("s1", cid)
    directory = isolated / "plugin-data" / "hermes-ui-cards" / "answers"
    assert sorted(p.name for p in directory.iterdir()) == [f"{cid}.json"]
    json.loads((directory / f"{cid}.json").read_text(encoding="utf-8"))


# ── bounds ──

def test_card_files_are_bounded(monkeypatch, isolated):
    monkeypatch.setattr(store, "MAX_CARDS", 3)
    ids = []
    for i in range(6):
        ids.append(f"c-{i}")
        store.note_shown("s1", f"c-{i}", "choice")
        time.sleep(0.01)  # distinct mtimes
    kept = sorted(p.stem for p in (isolated / "plugin-data" / "hermes-ui-cards" / "answers").glob("*.json"))
    assert kept == ["c-3", "c-4", "c-5"]


def test_chats_per_card_are_bounded(monkeypatch):
    monkeypatch.setattr(store, "MAX_SESSIONS_PER_CARD", 2)
    store.note_shown("s0", "c-1", "choice")
    for i in range(4):
        store.record_answer(f"b{i}", {"card": "c-1", "mark": "✓", "summary": str(i), "data": {}})
        time.sleep(0.002)
    data = json.loads((store.answers_dir() / "c-1.json").read_text(encoding="utf-8"))
    assert sorted(data["answers"]) == ["b2", "b3"]


def test_big_answer_data_is_dropped_but_the_receipt_stays():
    msg = "✓ Form sent\n[hui-card] " + json.dumps({"card": "f-1", "type": "form", "values": {"t": "x" * 7000}})
    reply = store.parse_reply(msg)
    assert reply["data"] == {"card": "f-1", "type": "form"} and reply["summary"] == "Form sent"


def test_lookup_answers_at_most_100_cards():
    for i in range(120):
        store.note_shown("s1", f"c-{i}", "choice")
    got = store.lookup("s1", [f"c-{i}" for i in range(120)])
    assert len(got["open"]) == store.MAX_LOOKUP == 100


# ── hostile input ──

@pytest.mark.parametrize("message", [
    None, 42, "", "just text", "[hui-card] {not json", "[hui-card] [1, 2]", "[hui-card] \"str\"",
    "[hui-card] " + "[" * 5000 + "]" * 5000,
    "[hui-card] " + json.dumps({"card": "../../etc/passwd"}),
    "[hui-card] " + json.dumps({"card": "UPPER"}),
    "[hui-card] " + json.dumps({"card": "a" * 65}),
    "[hui-card] " + json.dumps({"card": ["x"]}),
    "x" * 20001 + "\n[hui-card] " + json.dumps({"card": "c-1"}),
])
def test_parse_reply_rejects_hostile_messages(message):
    assert store.parse_reply(message) is None


def test_parse_reply_cleans_the_summary():
    msg = "✓ Chose:\u0000  Spa\x1b[31m   red\n[hui-card] " + json.dumps({"card": "c-1", "type": "choice"})
    reply = store.parse_reply(msg)
    assert reply["summary"] == "Chose: Spa [31m red" and reply["mark"] == "✓"
    long = store.parse_reply("✓ " + "y" * 900 + "\n[hui-card] " + json.dumps({"card": "c-1"}))
    assert len(long["summary"]) == store.MAX_SUMMARY and long["summary"].endswith("…")
    unmarked = store.parse_reply("hello\n[hui-card] " + json.dumps({"card": "c-1"}))
    assert unmarked["mark"] == "✓" and unmarked["summary"] == "hello"


@pytest.mark.parametrize("session", ["", " s1", "s1 ", "x" * 257, None, 5, ["s1"]])
def test_bad_session_ids_store_and_find_nothing(session):
    store.note_shown(session, "c-1", "choice")
    assert store.record_answer(session, {"card": "c-1"}) is None
    assert store.lookup(session, ["c-1"]) == {"answers": {}, "open": []}


def test_lookup_ignores_bad_ids_and_corrupt_files():
    store.note_shown("s1", "c-1", "choice")
    (store.answers_dir() / "c-2.json").write_text("{broken", encoding="utf-8")
    (store.answers_dir() / "c-3.json").write_text(json.dumps({"card": "c-4", "answers": {}}), encoding="utf-8")
    got = store.lookup("s1", ["../c-1", "c-1", "c-2", "c-3", 7, None, "c-1"])
    assert got == {"answers": {}, "open": ["c-1"]}
    assert store.lookup("s1", "c-1") == {"answers": {}, "open": []}  # not a list


def test_a_corrupt_file_is_replaced_on_the_next_write():
    (store.answers_dir() / "c-1.json").write_text("{broken", encoding="utf-8")
    store.note_shown("s1", "c-1", "choice")
    assert store.lookup("s1", ["c-1"])["open"] == ["c-1"]


def test_stored_records_are_sanitized_on_the_way_out():
    (store.answers_dir() / "c-1.json").write_text(json.dumps({
        "card": "c-1", "shown": {"session": "s1", "at": 1},
        "answers": {"s1": {"mark": "<b>", "summary": "a\nb", "data": [1], "at": "soon"}, "s2": "junk"}}),
        encoding="utf-8")
    assert store.lookup("s1", ["c-1"])["answers"]["c-1"] == {"mark": "✓", "summary": "a b", "data": {}, "at": 0}


# ── backend routes (dashboard/plugin_api.py) ──

def _load_api(monkeypatch, config=None):
    try:
        import fastapi  # noqa: F401
    except ImportError:  # the plugin's dev venv has no FastAPI: a stand-in that records the routes
        fake = types.ModuleType("fastapi")

        class APIRouter:
            def __init__(self):
                self.routes = {}

            def get(self, path):
                def deco(fn):
                    self.routes[path] = fn
                    return fn
                return deco
        fake.APIRouter = APIRouter
        monkeypatch.setitem(sys.modules, "fastapi", fake)
    if config is not None:
        package = types.ModuleType("hermes_cli")
        package.__path__ = []
        cfg = types.ModuleType("hermes_cli.config")
        cfg.load_config_readonly = lambda: config
        monkeypatch.setitem(sys.modules, "hermes_cli", package)
        monkeypatch.setitem(sys.modules, "hermes_cli.config", cfg)
    name = "hui_cards_test_plugin_api"
    spec = importlib.util.spec_from_file_location(name, ROOT / "dashboard" / "plugin_api.py")
    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, name, module)
    spec.loader.exec_module(module)
    return module


def _route(module, path):
    for route in getattr(module.router, "routes", []):
        if getattr(route, "path", None) == path:
            return route.endpoint
    return module.router.routes[path]


def test_answers_route(monkeypatch):
    api = _load_api(monkeypatch)
    cid = show("s1")["cardId"]
    other = show("s1", {**CHOICE, "question": "Another?"})["cardId"]
    answer("s1", cid)
    out = _route(api, "/answers")(session="s1", cards=f"{cid}, {other},../x,,")
    assert out["v"] == 1 and list(out["answers"]) == [cid] and out["open"] == [other]
    assert _route(api, "/answers")(session="", cards=cid) == {"v": 1, "answers": {}, "open": []}
    assert _route(api, "/answers")(session="s1", cards="x" * 100000)["answers"] == {}


def test_settings_route_reads_this_plugins_settings(monkeypatch):
    config = {"plugins": {"entries": {"hermes-ui-cards": {"settings": {
        "compact": True, "accent": "purple", "undo_seconds": "8"}}, "other": {"settings": {"accent": "red"}}}}}
    api = _load_api(monkeypatch, config)
    assert _route(api, "/settings")() == {"v": 1, "display": {"compact": True, "accent": "purple", "undo": 8}}


@pytest.mark.parametrize("config", [
    {}, {"plugins": None}, {"plugins": {"entries": {"hermes-ui-cards": "junk"}}},
    {"plugins": {"entries": {"hermes-ui-cards": {"settings": {"accent": "neon", "undo_seconds": "99",
                                                             "compact": "true"}}}}},
])
def test_settings_route_falls_back_to_defaults(monkeypatch, config):
    api = _load_api(monkeypatch, config)
    assert api.settings_payload(config)["display"] == {"compact": False, "accent": "app", "undo": 4}


def test_settings_route_reads_the_legacy_config_subtree(monkeypatch):
    config = {"plugins": {"entries": {"hermes-ui-cards": {"config": {"accent": "green"}}}}}
    api = _load_api(monkeypatch, config)
    assert api.settings_payload(config)["display"]["accent"] == "green"


def test_backend_and_agent_half_share_one_store_file(monkeypatch):
    api = _load_api(monkeypatch)
    assert Path(api.store.__file__).resolve() == Path(store.__file__).resolve()


# ── card_types and undo_seconds ──

def configure(**values):
    tool.configure(lambda key, default: values.get(key, default))


def test_card_types_default_to_all():
    for value in (None, [], "junk-only", ["nope"], {"a": 1}, 7):
        configure(card_types=value)
        assert tool.enabled_types() == CARD_TYPES


def test_card_types_keep_schema_order_and_accept_a_comma_string():
    configure(card_types=["quiz", "Choice ", "nope", 3])
    assert tool.enabled_types() == ["choice", "quiz"]
    configure(card_types="quiz, confirm")
    assert tool.enabled_types() == ["confirm", "quiz"]


def test_disabled_types_are_rejected_with_the_enabled_ones_named():
    configure(card_types=["choice", "confirm"])
    out = json.loads(tool.present({"card": {"type": "checklist", "items": [{"text": "a"}]}}, surface="desktop"))
    assert out["error"].startswith('Card type "checklist" is turned off')
    assert "enabled types: confirm, choice;" in out["error"]
    as_string = json.loads(tool.present({"card": json.dumps({"type": "quiz"})}, surface="desktop"))
    assert 'Card type "quiz" is turned off' in as_string["error"]
    demo = json.loads(tool.present({"demo": "compare"}, surface="desktop"))
    assert 'Card type "compare" is turned off' in demo["error"]
    assert json.loads(tool.present({"card": CHOICE}, surface="desktop"))["ok"] is True


def test_disabled_types_leave_the_tool_description():
    configure(card_types=["choice", "confirm"])
    schema = tool.tool_schema()
    assert "- choice:" in schema["description"] and "- confirm:" in schema["description"]
    assert "- checklist:" not in schema["description"] and "- quiz:" not in schema["description"]
    card = schema["parameters"]["properties"]["card"]
    assert card["properties"]["type"]["enum"] == ["confirm", "choice"]
    assert schema["parameters"]["properties"]["demo"]["enum"] == ["confirm", "choice"]


def test_desktop_hint_names_the_enabled_types_only_when_restricted():
    ctx = tool.on_turn_start(session_id="h1", platform="desktop")["context"]
    assert "turned on in this install" not in ctx
    configure(card_types=["choice", "confirm"])
    ctx = tool.on_turn_start(session_id="h1", platform="desktop")["context"]
    assert ctx.endswith("Card types turned on in this install: confirm, choice.")


def test_cards_command_shows_turned_off_types():
    configure(card_types=["choice", "confirm"])
    status = handle_cards("")
    assert "Types: confirm, choice. Turned off in settings: plan, review, checklist" in status
    assert "demo for confirm" in status
    assert "checklist: " in handle_cards("types") and "(turned off in settings)" in handle_cards("types")
    assert handle_cards("demo compare").startswith("The compare card is turned off")


# ── confirm decisions ──

CONFIRM = {"type": "confirm", "title": "Delete old logs?", "action": "Delete 14 files in ~/logs"}


@pytest.mark.parametrize("decision, expected, forbidden", [
    ("yes", "Do exactly that action and nothing more", "do NOT run"),
    ("no", "The user declined: do NOT run this action.", "Do exactly that action"),
    ("change", "do not run the original action; apply the change and show a new confirm card",
     "Do exactly that action"),
    (None, "does not say yes, no or change: do not run this action", "Do exactly that action"),
    ("maybe", "does not say yes, no or change: do not run this action", "Do exactly that action"),
])
def test_confirm_context_follows_the_decision(decision, expected, forbidden):
    cid = show("c1", CONFIRM)["cardId"]
    data = {"card": cid, "type": "confirm"}
    if decision is not None:
        data["decision"] = decision
    msg = "✓ x\n[hui-card] " + json.dumps(data)
    ctx = tool.on_turn_start(session_id="c1", platform="desktop", user_message=msg,
                             conversation_history=[])["context"]
    assert "Delete 14 files in ~/logs" in ctx
    assert expected in ctx and forbidden not in ctx


# ── parallel identical calls ──

def test_parallel_identical_calls_make_one_card(monkeypatch):
    original = tool._new_card_id

    def slow(card):
        time.sleep(0.05)  # widen the window in which a twin could slip through
        return original(card)
    monkeypatch.setattr(tool, "_new_card_id", slow)
    barrier = threading.Barrier(4)
    results = []

    def call():
        barrier.wait()
        results.append(json.loads(tool.present({"card": CHOICE}, session_id="p1", surface="desktop")))
    threads = [threading.Thread(target=call) for _ in range(4)]
    for th in threads:
        th.start()
    for th in threads:
        th.join(10)
    assert len(results) == 4 and len({r["cardId"] for r in results}) == 1
    assert len(tool.take_pending("p1")) == 1
    assert len(list(tool.cards_dir().glob("*.md"))) == 1


def test_a_failed_first_call_lets_the_twin_build_the_card(monkeypatch):
    calls = []
    original = tool._build

    def flaky(*args):
        calls.append(1)
        if len(calls) == 1:
            raise OSError("disk hiccup")
        return original(*args)
    monkeypatch.setattr(tool, "_build", flaky)
    first = tool.handle_present({"card": CHOICE}, session_id="p2")
    assert "hui_present failed" in json.loads(first)["error"]
    second = json.loads(tool.present({"card": CHOICE}, session_id="p2", surface="desktop"))
    assert second["ok"] is True
