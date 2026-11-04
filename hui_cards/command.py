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
    where = ("Hermes Desktop: cards show as interactive cards." if surface == "desktop"
             else "This chat gets the text version of each card (numbered options).")
    lines = [
        f"HUI+ Cards {VERSION}: cards are {'on' if on else 'off (text only)'}.",
        where,
        "Types: " + ", ".join(CARD_TYPES) + ".",
        "Try it: /cards demo choice, or ask \"Show me the hui_present demo for compare\".",
        "Settings: Settings → Plugins → hermes-ui-cards (cards on/off, compact, accent colour).",
    ]
    return "\n".join(lines)


def handle_cards(raw_args: str = "", **_kwargs) -> str:
    args = (raw_args or "").split()
    if not args or args[0] in ("help", "status"):
        return _status(current_surface()) + "\n" + USAGE
    if args[0] == "types":
        return "\n".join(f"{t}: {s['summary']}" for t, s in SCHEMA["cards"].items())
    if args[0] == "demo":
        kind = args[1] if len(args) > 1 else "choice"
        raw = demo_card(kind)
        if raw is None:
            return f"Unknown card type \"{kind}\". Types: {', '.join(DEMOS)}."
        card, _errors, _warnings = validate_card(raw)
        hint = (f"\n\nTo see it as an interactive card in Hermes Desktop, ask: "
                f"\"Show me the hui_present demo for {kind}\".")
        return render_text(card) + hint
    return USAGE
