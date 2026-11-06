# Changelog

## 0.1.0 (unreleased)

First version.

- `hui_present` tool: the model shows a card; a card with a missing or broken field comes back as a tool
  error that names each bad field (small slips are accepted with a warning).
- 17 card types: plan, review, checklist, compare, form, confirm, steps, decision, calc, rank, choice,
  schedule, recipe, flashcards, rating, slider, quiz.
- Hermes Desktop and the Hermes Webapp draw the cards inline in the chat; submitting a card sends one
  message to that chat (a readable line plus a `[hui-card]` JSON line for the model).
- Answered cards show a receipt and lock; a small plugin backend records answers, so other windows and
  devices on the same Hermes lock the card once they have checked (eventual, not exactly-once).
- Undo window (0/4/8 s) for compare picks, plan Run, review Apply and medium/high-risk confirms, with a
  visible countdown (screen readers hear the start value once).
- The model is told which card an answer belongs to, what a confirm card approved, and (when the history
  shows it) that an answer is stale; a card shown in another chat approves nothing.
- Drafts (checklist ticks, form input, comments) survive reopening the chat.
- CLI, TUI, messaging and the web dashboard chat get a plain-text version; the Hermes UI+ app gets native
  `hui` blocks for the supported variants of 12 types.
- One schema (`hui_cards/cards.schema.json`) for the Python validator, the Desktop validator (parity-tested)
  and the TypeScript types; `calc` formulas use a small parser in both languages, no `eval`.
- Settings: cards on/off, compact, accent colour, undo time, card types, API server format; compact,
  accent and undo time apply to cards already on screen. `/cards` command and a command-palette demo.
- Answer lines read like a person wrote them and use the card's own words (review keep/drop labels,
  a quoted plan note, the schedule's time zone, plural kitchen units in recipes).
