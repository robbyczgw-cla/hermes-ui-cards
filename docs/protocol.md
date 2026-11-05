# Card protocol

How a card travels from the model to the screen and how the user's answer travels back.
The card shapes themselves are defined in [`hui_cards/cards.schema.json`](../hui_cards/cards.schema.json);
`desktop/cards.d.ts` holds the same shapes as TypeScript types.

## 1. The model presents a card

The model calls the `hui_present` tool with one card:

```json
{"card": {"type": "choice", "id": "trip-style", "question": "What are you in the mood for?",
          "options": [{"label": "City trip"}, {"label": "Hiking"}, {"label": "Spa"}]}}
```

The tool validates the card. A missing required field, a wrong type or a broken limit rejects the
card with an error naming each bad field (`card.options[1].label: required`) so the model can fix
it and call again. Some slips are accepted with a warning instead: an unknown field is dropped
(`allow_other` → "did you mean allowOther?"), `"true"` is read as a boolean. A valid card gets
ids for every option, item, column and slot that has none (`o1`, `i1`, `c1`, `s1`, …) and a
unique `cardId` (`trip-style-3f9a1c`).

What the tool returns depends on where the chat runs:

| Surface | Tool result | What the user sees |
|---|---|---|
| Hermes Desktop / Webapp | `media: "MEDIA:<path>"`, the normalized `card`, `display` settings | The interactive card (if the plugin's Desktop half is on) |
| Desktop / Webapp with the Desktop half off | the same | The Markdown copy of the card as a file attachment |
| Desktop with *Interactive cards* switched off | `text` | The text version (applies to cards created after the switch) |
| API server, *API server card format* `hui`, or `auto` with the Hermes UI+ plugin enabled | `hui`: a fenced ```` ```hui ```` block, plus `text` | The Hermes UI+ app's own card, for the supported variants of 12 types (see `hui_cards/hui_blocks.py`); plan, review, compare, recipe and flashcards always get text |
| CLI, TUI, messaging platforms, the web dashboard chat, other API clients | `text` | Numbered options and a "Reply with …" hint |

On Desktop the model writes one short sentence and the `MEDIA:` line on its own line. If it
forgets the line, the plugin's `transform_llm_output` hook appends it (for cards of the same
session from the last 30 minutes), so the card still appears. If the card file can't be written
the tool returns the text version instead. A Desktop without the card renderer shows the file as an
ordinary attachment instead of a broken card.

## 2. The user answers

Submitting an answer (Send, Done, Choose, Yes/No/Change, Run, Apply, …) sends one message to the
card's chat, exactly as if the user had typed it. Ticking, typing and navigating inside a card stay in
the card (they are saved as a draft) and send nothing:

```
✓ Chose: Spa
[hui-card] {"card":"trip-style-3f9a1c","type":"choice","selected":["o3"],"labels":["Spa"]}
```

- **Line 1** is for people: a mark (`✓` answer, `✗` declined, `✎` change request, `⚠` stuck),
  then a short summary in the card's language (English or German chrome: `card.lang`, else the
  browser/OS language of the Desktop).
- **Line 2** is for the model: `[hui-card] ` followed by compact JSON with `card` (the cardId),
  `type`, and the answer fields below. The model reads this line, not line 1.

| Type | Answer fields | Line 1 (English / German) |
|---|---|---|
| plan | `steps: [{id, title, included, note?}]`; optional steps with `off: true` start excluded | `✓ Run the plan: 5 of 6 steps` / `✓ Plan ausführen: 5 von 6 Schritten` |
| review | `keep`, `drop`, `undecided`: ID arrays; `notes`, `titles?`: ID maps | `✓ Review done: keep 5, drop 3` / `✓ Durchgesehen: 5 behalten, 3 verwerfen` |
| decision | `weights`, `ranking: [{id, label, score}]`, `picked?` | `✓ Decision: A (8.4) ahead of B (7.9)` / `✓ Entscheidung: …` |
| calc | `inputs: {name: value}`, `outputs: [{label, value}]` | `✓ Calculated: Monthly rate 1,234.56 €` / `✓ Berechnet: …` |
| rank | `order: [id]`, `labels: [label]` | `✓ Ranked: A > B > C` / `✓ Reihenfolge: A > B > C` |
| recipe | `servings`, `missing: [{id, item, qty?, unit?}]`, `have: [id]` | `✓ Shopping list for 6: …` / `✓ Einkaufsliste für 6: …` |
| flashcards | `known: [index]`, `again: [index]` (0-based), `rounds`, `practise?: [front]` (fronts of the again cards) | `✓ Flashcards: 8 of 10 known` / `✓ Karteikarten: 8 von 10 gewusst` |
| choice | `selected: [optionId]`, `labels: [label]`, `other?: string` | `✓ Chose: A, B` / `✓ Gewählt: A, B` |
| checklist | `done_ids: [itemId]`, `open_ids: [itemId]`, `done: [text]`, `open: [text]` | `✓ Checklist done: 3 of 5 checked. Still open: X, Y` / `✓ Checkliste fertig: 3 von 5 erledigt. Offen: X, Y` |
| compare | `selected: columnId`, `label` | `✓ Picked: Pixel 10` / `✓ Gewählt: Pixel 10` |
| form | `values: {name: value}`; an untouched toggle without a default is `null` and omitted from line 1; required toggles must be touched | `✓ Form sent: Name: Anna, Date: 2026-11-12` / `✓ Formular gesendet: …` |
| confirm | `decision: "yes" \| "no" \| "change"`, `change?: string` | `✓ Yes, go ahead: <title>` · `✗ No, don't: <title>` · `✎ Change: <text>` / `✓ Ja, mach das: …` · `✗ Nein, lieber nicht: …` · `✎ Ändern: …` |
| rating | `value`, `scale`, `comment?` | `✓ Rated 4 of 5` / `✓ Bewertung: 4 von 5` |
| slider | `value`, `unit?` | `✓ Chose: 300 €` / `✓ Gewählt: 300 €` |
| schedule | `selected: [{id, start, end?, label?}]` or `none: true` | `✓ Slot: Thu 12 Nov, 14:00–15:00` · `✗ None of these slots fit` / `✓ Termin: …` · `✗ Keiner der Termine passt` |
| steps | `completed: true, steps: n` or `stuck: stepNumber, title, note?` (up to 300 code points) | `✓ Done with all 5 steps` · `⚠ Stuck at step 3: <title>` / `✓ Alle 5 Schritte erledigt` · `⚠ Hänge bei Schritt 3: <title>` |
| quiz | `score`, `total`, `answers: [{q, chosen, correct}]` | `✓ Quiz: 4 of 5 correct` / `✓ Quiz: 4 von 5 richtig` |

A message is capped at 4000 Unicode code points, including JSON escaping. Only the
human-readable first line may be shortened; machine-readable values are never truncated.
Checklist replies include both item IDs and the corresponding texts in card order. If
the complete reply would exceed the cap, the reply omits `done` and `open` and instead
includes `done_count` and `open_count` alongside `done_ids` and `open_ids`. The model
can look up those IDs in the tool result. If another answer exceeds the cap, the card
asks the user to shorten it or select fewer items before sending. Text fields accept at
most 300 code points, email 200, textarea 1000, Other 300, and Change and rating comment
1000 each; a smaller card-specified field limit still applies.

## 3. After the answer

- The card shows a receipt of what it sent and locks in this window.
- Drafts and receipts are kept in the Desktop's plugin storage (`localStorage`), keyed by the active
  connection, profile, chat and card, so they survive reopening the chat or restarting the app on that
  computer. Up to 300 drafts and 5,000 receipts are kept (oldest first out; the caps are shared by all
  profiles of that Desktop). Drafts are never synchronized to other devices.
- Answers are also recorded by the plugin's backend (see §5), so other windows and computers connected
  to the same Hermes lock the card once they have checked. This is eventual, not exactly-once: two
  clients that answer before either has seen the other's answer can both send; the backend keeps the
  first answer and tells the model about the second.
- A card without a session is inactive. If submission fails, the card asks the user to open
  the chat, check the Hermes connection, and try again.
- Answered steps retain their current content, copy control, and navigation. Forms show a
  live reply budget near the limit and mark fields to shorten when the reply is too long.
- Text surfaces have no state: the user simply replies with a number or words, and the model
  maps it to the options it saw in the tool result.

## 4. Text version (CLI, TUI, messaging)

Plain text, no Markdown, so it reads the same in a raw terminal and on every messaging platform.
English chrome, German when
`card.lang` starts with `de`. Examples:

```
What are you in the mood for?
1. 🏙️ City trip – Museums, cafés, lots of walking
2. 🥾 Hiking – Fresh air, little programme
3. ♨️ Spa – Thermal baths, sauna
Reply with a number (1–3).
```

```
Delete 14 old log files?
Action: rm ~/logs/*.log.old
Why: they use 2.3 GB
Risk (medium): the files can't be restored
Reply yes, no, or what to change.
```

### Compare sources and picks

A `compare` card can provide `asOf` (up to 40 characters), a column `source`
with a `label` and HTTPS `url`, and a `sources` array on each row. Each source
entry is an HTTPS URL or null and corresponds to the value at the same index.
A row can also set `best` to the zero-based index of its strongest value; this
is independent of the column-level `best` recommendation. Supply real sources,
not invented URLs. Desktop links source chips to those pages and counts unique
URLs. Text surfaces show source domains and the date. On Desktop a pick waits for the
configured undo window (Settings → *Undo time*: 0, 4 or 8 seconds, default 4) before the answer is
sent; Undo or Escape inside the card cancels it, and nothing is sent if the card disappears first.
The same window applies to Run on `plan`, Apply on `review`, and Yes on a medium- or high-risk `confirm`. It undoes the
sending, not work Hermes has already done.

## 5. Answer memory and synchronization

What the backend half does, when, and how the Desktop half uses it.

**Recording.** `hui_present` notes every Desktop card it shows (card id, type, chat). When a later user
message in that chat carries a `[hui-card]` line for that card, `pre_llm_call` records the answer
(mark, line 1, the JSON) in `<HERMES_HOME>/plugin-data/hermes-ui-cards/answers.db` of the active
profile. A chat counts as having shown a card only through a real `hui_present` call with a successful
result for exactly that card id (also through Hermes' `tool_call` bridge). Answers are accepted from the
chat that showed the card, from verified branches of it, and across compaction continuations that
Hermes reports through `post_compaction`. Storage errors fail closed (no memory), never another profile.

**Context for the model.** In the turn that answers a card, the hook adds temporary context: which card,
for a confirm card its exact action and command and what the decision means, a note when the card was
already answered (quoting the first answer), and, when it can count them, how many other messages the
user wrote after the card (the model is told to check the answer still fits and to ask again before
acting on a stale confirm). It does not enforce a fresh approval. A `[hui-card]` line for a card that
this chat never showed gets a note that it approves nothing.

**Reading.** The Desktop half asks `GET /api/plugins/hermes-ui-cards/answers?session=…&cards=…` through
the selected backend (local or remote, behind Hermes' own sign-in), batched per chat:
when a card is shown (its actions stay hidden until this first check settles, at most ~9.5 s); while an
open card is on screen after 30 s, then doubling up to every 10 minutes; after a failure after 5 s,
15 s, 45 s, 2 min, 5 min; on the empty `plugin.hermes-ui-cards.answers.changed` event the backend
broadcasts after each recorded answer, on `gateway.ready`, on a profile or source switch, on window focus
and when the browser comes back online. If the first check fails the card says so ("Couldn't check
whether this card was already answered elsewhere") and offers *Check again*; it still works.
A receipt this window holds is never removed because of what the server says.

**Ownership.** Local state and requests follow the backend this window is connected to right now (its
active connection and profile). In a split view that shows chats of different profiles or backends,
cards of the inactive owner are not synchronized. A new chat's runtime id becoming its stored id keeps a
card's state only when the host itself pairs the two ids (the focused view); any other id change starts
the card afresh.

**Settings.** `GET /api/plugins/hermes-ui-cards/settings` returns compact, accent and undo time; the
Desktop half reads it once per profile/connection and after every save in Settings → Plugins (falling
back to the `plugins.manage` list RPC), so these three apply to cards already on screen. *Interactive
cards*, *Card types* and *API server card format* affect cards created afterwards; a changed *Card types*
list reaches the tool description after a Hermes restart (an empty or unrecognized list means all types).

**Retention.** The 2,000 most recently shown or answered cards (with up to 8 answering chats and 16
member chats each, answer data up to 20,000 bytes) and 5,000 compaction links. Reading does not refresh
retention; nothing expires by time; deleting a chat does not delete its entries. The Markdown card copies
in `cards/` keep the newest 500.
