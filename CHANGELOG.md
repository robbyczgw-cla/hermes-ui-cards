# Changelog

## 0.1.0 (unreleased)

First version.

- `hui_present` tool: the model shows a card; an invalid card comes back as a tool error that names each
  bad field.
- 17 card types: plan, review, checklist, compare, form, confirm, steps, decision, calc, rank, choice,
  schedule, recipe, flashcards, rating, slider, quiz.
- Hermes Desktop and the Hermes Webapp draw the cards inline in the chat; every click is sent as the next
  message in that chat (a readable line plus a `[hui-card]` JSON line for the model).
- Answered cards show a receipt and can't be sent twice; answers are also kept by a small plugin backend,
  so a card stays locked on every device connected to the same Hermes.
- Undo window (0/4/8 s) for compare picks, plan Run and medium/high-risk confirms.
- The model is told which card an answer belongs to, what a confirm card approved, and when an answer is
  stale; a card shown in another chat approves nothing.
- Drafts (checklist ticks, form input, comments) survive reopening the chat.
- CLI, TUI, messaging and the web dashboard chat get a plain-text version; the Hermes UI+ app gets native
  `hui` blocks for 12 types.
- One schema (`hui_cards/cards.schema.json`) for the Python validator, the Desktop validator (parity-tested)
  and the TypeScript types; `calc` formulas use a small parser in both languages, no `eval`.
- Settings: cards on/off, compact, accent colour, undo time, card types, API server format; changes apply
  to cards on screen. `/cards` command and a command-palette demo.
