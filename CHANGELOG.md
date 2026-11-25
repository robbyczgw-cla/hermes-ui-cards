# Changelog

## 0.1.1

- README links the demo video and says up front to turn on the Desktop half.
- The Python validator agrees with the Desktop validator under Python 3.14 (hour 24 and uppercase
  IPvFuture hosts are rejected on both sides).
- Answer memory and Markdown card copies expire after 90 days without use: an expired card is no longer
  returned from that moment; the rows go at plugin start, on a process' first lookup and on every write.
- An answer to a card the store no longer knows is never read as a certain first approval: the model is
  told it may be a repeat, and an earlier answer still in the chat history makes it a duplicate (also
  when another branch restored the card or the per-card answer cap dropped the row); without the card in
  the chat history it is a neutral note instead of "not shown in this chat".
- The store's link pruning uses one recursive term (SQLite older than 3.34 rejected the earlier form).
- On the surface `gui` (a Hermes GUI client the hook does not identify as Desktop/Webapp, e.g. Hermes
  Mobile) checklist items are Markdown checkboxes (still numbered for typed answers); the text
  instruction asks the model not to talk about cards or the surface.
- Tests: the cross-process store tests skip where a sandbox denies multiprocessing; tested with Hermes
  0.22.7, 0.23.1 and 0.23.4.

## 0.1.0

First version.

- `hui_present` tool: the model shows a card; a card with a missing or broken field comes back as a tool
  error that names each bad field (small slips are accepted with a warning).
- 17 card types: plan, review, checklist, compare, form, confirm, steps, decision, calc, rank, choice,
  schedule, recipe, flashcards, rating, slider, quiz.
- Hermes Desktop and the Hermes Webapp draw the cards inline in the chat; submitting a card sends one
  message to that chat (a readable line plus a `[hui-card]` JSON line for the model, after Hermes'
  `--- Attached Context ---` line: the chat bubble collapses to the readable line once the reply is
  done).
- The Desktop hint that cards exist is added when none of the last 20 user messages carries it (or its
  text changed), not on every turn: Hermes stores hook context with each message and resends it.
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
