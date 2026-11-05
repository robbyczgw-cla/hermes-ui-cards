import importlib.util
import json
import sys
from pathlib import Path

import pytest
import yaml

from hui_cards import tool
from hui_cards.command import handle_cards
from hui_cards.demos import DEMOS
from hui_cards.schema import CARD_TYPES, validate_card

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


def run(args, surface, session_id="s1"):
    return json.loads(tool.present(args, session_id=session_id, surface=surface))


def test_desktop_returns_media_card_and_writes_markdown_copy(isolated):
    out = run({"card": CHOICE}, "desktop")
    assert out["ok"] is True and out["type"] == "choice"
    assert out["cardId"].startswith("trip-") and len(out["cardId"]) == len("trip-") + 10
    assert out["card"]["cardId"] == out["cardId"]
    assert [o["id"] for o in out["card"]["options"]] == ["o1", "o2"]
    assert out["display"] == {"compact": False, "accent": "app", "undo": 4}
    assert out["media"].startswith("MEDIA:")
    path = Path(out["media"][len("MEDIA:"):])
    assert path.parent == isolated / "plugin-data" / "hermes-ui-cards" / "cards"
    text = path.read_text(encoding="utf-8")
    assert text.startswith("Where to?\n1. Lisbon\n2. Berlin\n")
    assert out["media"] in out["next"]
    assert "error" not in out  # Desktop treats a result with `error` as a failed call


def test_text_surfaces_get_plain_text_and_no_file(isolated):
    for surface in ("telegram", "cli", "tui", "discord", "api_server", ""):
        out = run({"card": CHOICE}, surface)
        assert "media" not in out and "card" not in out
        assert out["text"].endswith("Reply with a number (1–2).")
        assert out["surface"] == (surface or "text")
    assert not (isolated / "plugin-data").exists()


def test_cards_switched_off_gives_text_on_desktop_too():
    tool.configure(lambda key, default: False if key == "enabled" else default)
    out = run({"card": CHOICE}, "desktop")
    assert "media" not in out and "text" in out


def test_display_settings_are_sanitized():
    tool.configure(lambda key, default: {"compact": True, "accent": "neon", "undo_seconds": "5"}.get(key, default))
    assert run({"card": CHOICE}, "desktop")["display"] == {"compact": True, "accent": "app", "undo": 4}
    tool.configure(lambda key, default: {"compact": "yes", "undo_seconds": "0"}.get(key, default))
    assert tool.display_settings() == {"compact": False, "accent": "app", "undo": 0}
    tool.configure(lambda key, default: {"undo_seconds": 8}.get(key, default))  # an int from config.yaml
    assert tool.display_settings()["undo"] == 8


def test_invalid_card_is_an_error_that_names_the_fields():
    out = run({"card": {"type": "choice", "question": "Q", "options": [{"label": "only one"}]}}, "desktop")
    assert out["error"].startswith("Card rejected (1 problem)")
    assert out["problems"] == ["card.options: needs at least 2 items (got 1)"]
    out = run({"card": {"type": "chioce"}}, "cli")
    assert 'did you mean "choice"' in out["problems"][0]


def test_warnings_are_passed_to_the_model():
    out = run({"card": {**CHOICE, "allow_other": True}}, "desktop")
    assert out["warnings"] == ['card.allow_other: unknown field, ignored (did you mean "allowOther"?)']


def test_card_given_as_json_string():
    assert run({"card": json.dumps(CHOICE)}, "cli")["ok"] is True


@pytest.mark.parametrize("args", [None, [], "x", {}, {"card": None}, {"card": 3}, {"demo": "nope"}])
def test_bad_arguments_never_raise(args):
    out = json.loads(tool.handle_present(args))
    assert "error" in out


@pytest.mark.parametrize("card_type", CARD_TYPES)
def test_every_type_has_a_valid_demo(card_type):
    card, errors, warnings = validate_card(DEMOS[card_type])
    assert errors == [] and warnings == []
    out = run({"demo": card_type}, "desktop")
    assert out["type"] == card_type


def test_surface_detection(monkeypatch):
    assert tool.current_surface() == ""
    monkeypatch.setenv("HERMES_SESSION_SOURCE", "desktop")
    assert tool.current_surface() == "desktop"
    monkeypatch.setenv("HERMES_SESSION_SOURCE", "tui")
    assert tool.current_surface() == "tui"
    monkeypatch.setenv("HERMES_SESSION_PLATFORM", "telegram")
    assert tool.current_surface() == "telegram"


def test_gateway_local_sessions_use_the_hook_platform(monkeypatch):
    # Desktop and Webapp sessions owned by a gateway look like CLI sessions from the tool
    # (platform "local", no source); pre_llm_call tells them apart.
    monkeypatch.setenv("HERMES_SESSION_PLATFORM", "local")
    assert tool.current_surface("local-abc") == "local"
    tool.on_turn_start(session_id="local-abc", platform="desktop")
    assert tool.current_surface("local-abc") == "desktop"
    out = json.loads(tool.handle_present({"card": CHOICE}, session_id="local-abc"))
    assert "media" in out
    tool.on_turn_start(session_id="local-cli", platform="cli")
    out = json.loads(tool.handle_present({"card": CHOICE}, session_id="local-cli"))
    assert "text" in out and "media" not in out
    # an unknown session falls back to the environment
    assert tool.current_surface("other") == "local"


def test_media_line_safety_net():
    out = run({"card": CHOICE}, "desktop", session_id="abc")
    tag = out["media"]
    # the model forgot the line → appended once
    fixed = tool.ensure_media_lines(response_text="Pick one:", session_id="abc")
    assert fixed == f"Pick one:\n\n{tag}"
    assert tool.ensure_media_lines(response_text="Pick one:", session_id="abc") is None
    # the model wrote it → unchanged
    tag2 = run({"card": CHOICE}, "desktop", session_id="abc")["media"]
    assert tool.ensure_media_lines(response_text=f"Here:\n{tag2}", session_id="abc") is None
    # other sessions and text surfaces are left alone
    run({"card": CHOICE}, "telegram", session_id="tg")
    assert tool.ensure_media_lines(response_text="hi", session_id="tg") is None
    assert tool.ensure_media_lines(response_text="hi", session_id="other") is None


def test_turn_start_hint_only_on_desktop(monkeypatch):
    assert tool.on_turn_start(session_id="a", platform="desktop") == {"context": tool.DESKTOP_HINT}
    assert tool.on_turn_start(session_id="a", platform="telegram") is None
    assert tool.on_turn_start(session_id="a", platform="cli") is None
    monkeypatch.setenv("HERMES_SESSION_SOURCE", "desktop")
    assert tool.on_turn_start(session_id="b", platform="") == {"context": tool.DESKTOP_HINT}
    tool.configure(lambda key, default: False if key == "enabled" else default)
    assert tool.on_turn_start(session_id="a", platform="desktop") is None
    assert len(tool.DESKTOP_HINT) < 400


def test_first_sentence_fits_the_tool_search_listing():
    first = tool.tool_description().split(". ")[0] + "."
    assert len(first) <= 60, first


def test_unfinished_turn_does_not_leak_into_the_next():
    run({"card": CHOICE}, "desktop", session_id="abc")
    tool.on_turn_start(session_id="abc")
    assert tool.ensure_media_lines(response_text="next turn", session_id="abc") is None


def test_media_tag_quotes_paths_with_spaces(tmp_path):
    assert tool.media_tag(Path("/a b/c.md")) == 'MEDIA:"/a b/c.md"'
    assert tool.media_tag(Path("/a/c.md")) == "MEDIA:/a/c.md"


def test_old_card_files_are_pruned(monkeypatch):
    monkeypatch.setattr(tool, "MAX_CARD_FILES", 3)
    for i in range(5):
        run({"card": {**CHOICE, "question": f"Where to, {i}?"}}, "desktop")
    assert len(list(tool.cards_dir().glob("*.md"))) == 3


def test_tool_description_stays_small():
    schema = tool.tool_schema()
    assert schema["name"] == "hui_present"
    # Plugin tools are deferred behind tool_search: the full text is only loaded on tool_describe.
    assert len(json.dumps(schema)) < 7000
    for card_type in CARD_TYPES:
        assert f"- {card_type}:" in schema["description"]


def test_cards_command():
    assert "Types: " + ", ".join(CARD_TYPES) + "." in handle_cards("")
    assert "Types: plan, review, checklist, compare, form, confirm, steps" in handle_cards("")
    assert handle_cards("types").count("\n") == len(CARD_TYPES) - 1
    demo = handle_cards("demo compare")
    assert "Home internet: which plan?" in demo and "hui_present demo for compare" in demo
    on_desktop = handle_cards("demo compare", platform="desktop")
    assert on_desktop.startswith("Commands can't draw cards. Send")
    assert "Capabilities → Plugins" in handle_cards("", platform="desktop")
    assert handle_cards("demo nope").startswith("Unknown card type")
    assert handle_cards("bogus").startswith("Usage:")


def _load_plugin():
    name = "hermes_plugins_test_hui_cards"
    spec = importlib.util.spec_from_file_location(name, ROOT / "__init__.py",
                                                  submodule_search_locations=[str(ROOT)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


class FakeCtx:
    def __init__(self):
        self.tools, self.hooks, self.commands, self.skills = [], [], [], []

    def register_tool(self, **kw):
        self.tools.append(kw)

    def register_hook(self, name, fn, **kw):
        self.hooks.append(name)

    def register_command(self, name, handler, **kw):
        self.commands.append(name)

    def register_skill(self, name, path, **kw):
        self.skills.append((name, Path(path)))

    def get_config(self, key, default=None):
        return default


def test_register_matches_the_manifest():
    manifest = yaml.safe_load((ROOT / "plugin.yaml").read_text(encoding="utf-8"))
    ctx = FakeCtx()
    _load_plugin().register(ctx)
    assert [t["name"] for t in ctx.tools] == manifest["provides_tools"]
    assert sorted(ctx.hooks) == sorted(manifest["provides_hooks"])
    assert ctx.commands == ["cards"]
    assert all(path.exists() for _, path in ctx.skills)
    assert manifest["requires_hermes"] == ">=0.22.6"
    assert set(manifest["config_schema"]) == {"enabled", "compact", "accent", "undo_seconds", "card_types", "api_server_format"}
    assert manifest["config_schema"]["accent"]["choices"] == tool.ACCENTS
    undo = manifest["config_schema"]["undo_seconds"]
    # A str with choices is what Settings → Plugins draws as a dropdown (an int with choices is a free number box).
    assert undo["type"] == "str" and undo["choices"] == ["0", "4", "8"] and undo["default"] == "4"
    assert manifest["config_schema"]["card_types"]["type"] == "list"
    assert manifest["config_schema"]["card_types"]["default"] == CARD_TYPES  # keep in step with the schema


def test_same_card_twice_in_one_turn_is_one_card():
    first = run({"card": CHOICE}, "desktop", session_id="s9")
    again = run({"card": CHOICE}, "desktop", session_id="s9")
    assert again["cardId"] == first["cardId"]
    assert tool.take_pending("s9") == [first["media"]]  # one MEDIA line, not two
    tool.on_turn_start(session_id="s9", platform="desktop")
    assert run({"card": CHOICE}, "desktop", session_id="s9")["cardId"] != first["cardId"]  # next turn: new card


def test_media_line_must_be_a_real_tag():
    out = run({"card": CHOICE}, "desktop", session_id="m1")
    path = out["media"][len("MEDIA:"):]
    fixed = tool.ensure_media_lines(response_text=f"Card saved at {path}", session_id="m1")
    assert fixed.endswith(out["media"])
    run({"card": {**CHOICE, "question": "Other?"}}, "desktop", session_id="m2")
    tag = tool._pending["m2"][0][1]
    assert tool.ensure_media_lines(response_text=f'Here:\nMEDIA:"{tag[6:]}"', session_id="m2") is None
    assert tool._has_media_line("MEDIA:/a/b.md", "/a/b.md")
    assert not tool._has_media_line("MEDIA:/a/b.md.bak", "/a/b.md")


def test_size_limit_counts_ids_and_defaults():
    items = [{"text": "x" * 300, "note": "y" * 150} for _ in range(50)]
    out = run({"card": {"type": "checklist", "items": items}}, "desktop")
    assert "error" in out and "once ids and defaults are added" in out["error"]


def _answer(card_id: str, **data) -> str:
    return "✓ something\n[hui-card] " + json.dumps({"card": card_id, **data})


def test_answer_context_names_the_card_and_the_confirmed_action():
    card = {"type": "confirm", "title": "Delete old logs?", "action": "Delete 14 files in ~/logs",
            "command": "find ~/logs -mtime +30 -delete"}
    out = run({"card": card}, "desktop", session_id="c1")
    ctx = tool.on_turn_start(session_id="c1", platform="desktop",
                             user_message=_answer(out["cardId"], type="confirm", decision="yes"),
                             conversation_history=[])["context"]
    assert f'confirm card "Delete old logs?" ({out["cardId"]})' in ctx
    assert "Delete 14 files in ~/logs" in ctx and "find ~/logs -mtime +30 -delete" in ctx
    assert "other message" not in ctx


def test_stale_confirm_answer_is_flagged():
    card = {"type": "confirm", "title": "Delete?", "action": "Delete it"}
    out = run({"card": card}, "desktop", session_id="c2")
    answer = _answer(out["cardId"], type="confirm", decision="yes")
    history = [
        {"role": "user", "content": "clean up"},
        {"role": "assistant", "content": "", "tool_calls": []},
        {"role": "tool", "content": json.dumps(out)},
        {"role": "assistant", "content": "Please confirm"},
        {"role": "user", "content": "No, leave them"},
        {"role": "assistant", "content": "OK"},
        {"role": "user", "content": answer},
    ]
    ctx = tool.answer_context(answer, history)
    assert "wrote 1 other message after this card" in ctx and "ask again before you act" in ctx


def test_answer_context_ignores_unknown_or_hostile_ids():
    assert tool.answer_context(_answer("../../etc/passwd"), []) is None
    assert tool.answer_context(_answer("nope-000"), []) is None
    assert tool.answer_context("just text", []) is None
    assert tool.answer_context("[hui-card] {not json", []) is None
