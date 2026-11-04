"""The /cards slash command: status, card types and demo cards as text."""
from __future__ import annotations

from .demos import DEMOS, demo_card
from .fallback import render_text
from .schema import CARD_TYPES, SCHEMA, validate_card
from .tool import current_surface, setting

VERSION = "0.1.0"

USAGE = "Usage: /cards · /cards types · /cards demo <type>"


def _status(surface: str) -> str:
    on = bool(setting("enabled", True))
    if surface == "desktop":
        where = ("Hermes Desktop/Webapp: cards are drawn by the plugin's Desktop half. If a card shows up "
                 "as a .md file instead, turn the Desktop half on in Capabilities → Plugins (it is off by "
                 "default) and reload.")
    else:
        where = "This chat gets the text version of each card (numbered options)."
    lines = [
        f"HUI+ Cards {VERSION}: cards are {'on' if on else 'off (text only)'}.",
        where,
        "Types: " + ", ".join(CARD_TYPES) + ".",
        "Try it: send \"Show me the hui_present demo for checklist\" as a message (any type works), "
        "or /cards demo <type> for the text version.",
        "Settings: Settings → Plugins → hermes-ui-cards (cards on/off, compact, accent colour).",
    ]
    return "\n".join(lines)


def handle_cards(raw_args: str = "", platform: str = "", session_id: str = "", **_kwargs) -> str:
    args = (raw_args or "").split()
    platform = str(platform or "").lower()
    surface = "desktop" if platform == "desktop" else current_surface(session_id)
    if not args or args[0] in ("help", "status"):
        return _status(surface) + "\n" + USAGE
    if args[0] == "types":
        return "\n".join(f"{t}: {s['summary']}" for t, s in SCHEMA["cards"].items())
    if args[0] == "demo":
        kind = args[1] if len(args) > 1 else "checklist"
        raw = demo_card(kind)
        if raw is None:
            return f"Unknown card type \"{kind}\". Types: {', '.join(DEMOS)}."
        card, _errors, _warnings = validate_card(raw)
        ask = f"\"Show me the hui_present demo for {kind}\""
        if surface == "desktop":
            return (f"Commands can't draw cards. Send {ask} as a message to get it as an interactive card. "
                    f"Its text version:\n\n" + render_text(card))
        return render_text(card) + f"\n\nIn Hermes Desktop or the Webapp, send {ask} to get it as an interactive card."
    return USAGE
