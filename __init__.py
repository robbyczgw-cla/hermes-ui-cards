"""hermes-ui-cards: interactive answer cards for Hermes.

Registers the `hui_present` tool, the /cards command, the card-writing skill and
two hooks that make sure a Desktop card's MEDIA line reaches the reply. The
Desktop half that draws the cards lives in desktop/plugin.js.
"""
from __future__ import annotations

from pathlib import Path

from .hui_cards import tool
from .hui_cards.command import handle_cards

HERE = Path(__file__).resolve().parent


def register(ctx):
    tool.configure(lambda key, default: ctx.get_config(key, default=default))
    schema = tool.tool_schema()
    ctx.register_tool(
        name=tool.TOOL_NAME,
        toolset="hui-cards",
        schema=schema,
        handler=tool.handle_present,
        description=schema["description"],
        emoji="🃏",
    )
    ctx.register_hook("pre_llm_call", tool.on_turn_start)
    ctx.register_hook("transform_llm_output", tool.ensure_media_lines)
    ctx.register_command(
        "cards",
        handle_cards,
        description="HUI+ Cards: status, card types and demo cards",
        args_hint="[types | demo <type>]",
    )
    skill = HERE / "skills" / "hui-cards" / "SKILL.md"
    if skill.exists():
        ctx.register_skill("hui-cards", skill, description="When and how to answer with an interactive card")
