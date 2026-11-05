"""HUI+ Cards backend routes, mounted by Hermes under /api/plugins/hermes-ui-cards/.

The Desktop half reaches them with ctx.rest (Hermes Desktop and the Webapp alike):

- GET /answers?session=<id>&cards=<cardId>,<cardId>  which of these cards the chat (or a chat it
  continues after compaction) already answered, from any window or computer, and which it showed
  but did not answer yet. Cards of other chats are left out; so is everything when this profile's
  store is unreachable (fail closed, never another profile's data).
- GET /settings  the display settings (compact, accent, undo time) to apply to cards already
  on screen after a save in Settings → Plugins

Read-only: the agent half (tool + pre_llm_call hook) writes the records (hui_cards/store.py).
Handlers are plain `def`, so Hermes runs them in a worker thread with the request's profile
scope, never blocking the gateway's event loop. Both routes read that profile only: its plugin
data dir and its config.yaml.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from fastapi import APIRouter

PLUGIN_ID = "hermes-ui-cards"
_STORE_FILE = Path(__file__).resolve().parent.parent / "hui_cards" / "store.py"


def _load_store():
    """hui_cards/store.py by path: Hermes imports this file as a standalone module, outside the
    plugin package, so a relative import is not available."""
    name = "hermes_ui_cards_backend_store"
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, _STORE_FILE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(name, None)
        raise
    return module


store = _load_store()
router = APIRouter()


def _nested(value, *keys):
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def plugin_setting(key: str, default, config: dict | None = None):
    """``plugins.entries.hermes-ui-cards.settings.<key>`` (legacy ``config.<key>``) of the request's
    profile: what ctx.get_config reads on the agent side and Settings → Plugins writes."""
    if config is None:
        try:
            from hermes_cli.config import load_config_readonly
            config = load_config_readonly() or {}
        except Exception:
            return default
    for subtree in ("settings", "config"):
        section = _nested(config, "plugins", "entries", PLUGIN_ID, subtree)
        if isinstance(section, dict) and key in section and section[key] is not None:
            return section[key]
    return default


def answers_payload(session: str, cards: str) -> dict:
    ids = [part.strip() for part in str(cards or "")[:8000].split(",") if part.strip()]
    return {"v": 1, **store.lookup(str(session or ""), ids)}


def settings_payload(config: dict | None = None) -> dict:
    return {"v": 1, "display": store.display_settings(lambda key, default: plugin_setting(key, default, config))}


@router.get("/answers")
def answers(session: str = "", cards: str = ""):
    return answers_payload(session, cards)


@router.get("/settings")
def settings():
    return settings_payload()
