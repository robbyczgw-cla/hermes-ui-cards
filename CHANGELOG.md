# Changelog

## 0.1.0 (unreleased)

First version.

- `hui_present` tool: the model shows a card; invalid cards come back as a tool error that names each bad field.
- Ten card types: choice, checklist, compare, form, confirm (phase 1) and rating, slider, schedule, steps, quiz.
- Hermes Desktop draws the cards inline in the chat; every click is sent as the next message in that chat
  (a readable line plus a `[hui-card]` JSON line for the model).
- Answered cards show the answer and can't be sent twice; checklist ticks and form drafts survive reopening the chat.
- Cards in a chat that is no longer active say so instead of showing a dead button.
- CLI, TUI, Telegram and other chats get a plain-text version with numbered options.
- One schema (`hui_cards/cards.schema.json`) for the Python validator, the Desktop validator and the TypeScript types.
- Settings: cards on/off, compact cards, accent colour. `/cards` command with status and demo cards.
