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

The tool validates the card. An invalid card returns an error naming each bad field
(`card.options[1].label: required`) so the model can fix it and call again. A valid card gets
ids for every option, item, column and slot that has none (`o1`, `i1`, `c1`, `s1`, …) and a
unique `cardId` (`trip-style-3f9a1c`).

What the tool returns depends on where the chat runs:

| Surface | Tool result | What the user sees |
|---|---|---|
| Hermes Desktop | `media: "MEDIA:<path>"`, the normalized `card`, `display` settings | The interactive card |
| CLI, TUI, Telegram, Discord, API, … | `text`: a plain-text version of the card | Numbered options and a "Reply with …" hint |
| Cards turned off in the plugin settings | `text`, as above | Same as above |

On Desktop the model writes one short sentence and the `MEDIA:` line on its own line. If it
forgets the line, the plugin's `transform_llm_output` hook appends it, so the card still appears.
The file behind the path is a Markdown copy of the text version: a Desktop without the card
renderer shows it as an ordinary file attachment instead of a broken card.

## 2. The user answers

A click on the card sends one message to the same chat, exactly as if the user had typed it:

```
✓ Chose: Spa
[hui-card] {"card":"trip-style-3f9a1c","type":"choice","selected":["o3"],"labels":["Spa"]}
```

- **Line 1** is for people: a mark (`✓` answer, `✗` declined, `✎` change request, `⚠` stuck),
  then a short summary in the card's language (English or German chrome, from `card.lang`, else the
  app language).
- **Line 2** is for the model: `[hui-card] ` followed by compact JSON with `card` (the cardId),
  `type`, and the answer fields below. The model reads this line, not line 1.

| Type | Answer fields | Line 1 (English / German) |
|---|---|---|
| choice | `selected: [optionId]`, `labels: [label]`, `other?: string` | `✓ Chose: A, B` / `✓ Gewählt: A, B` |
| checklist | `done: [text]`, `open: [text]` | `✓ Checklist done: 3 of 5 checked. Still open: X, Y` / `✓ Checkliste fertig: 3 von 5 erledigt. Offen: X, Y` |
| compare | `selected: columnId`, `label` | `✓ Picked: Pixel 10` / `✓ Gewählt: Pixel 10` |
| form | `values: {name: value}` | `✓ Form sent: Name: Anna, Date: 2026-11-12` / `✓ Formular gesendet: …` |
| confirm | `decision: "yes" \| "no" \| "change"`, `change?: string` | `✓ Yes, go ahead: <title>` · `✗ No, don't: <title>` · `✎ Change: <text>` / `✓ Ja, mach das: …` · `✗ Nein, lieber nicht: …` · `✎ Ändern: …` |
| rating | `value`, `scale`, `comment?` | `✓ Rated 4 of 5` / `✓ Bewertung: 4 von 5` |
| slider | `value`, `unit?` | `✓ Chose: 300 €` / `✓ Gewählt: 300 €` |
| schedule | `selected: [{id, start, end?, label?}]` or `none: true` | `✓ Slot: Thu 12 Nov, 14:00–15:00` · `✗ None of these slots fit` / `✓ Termin: …` · `✗ Keiner der Termine passt` |
| steps | `completed: true, steps: n` or `stuck: stepNumber, title` | `✓ Done with all 5 steps` · `⚠ Stuck at step 3: <title>` / `✓ Alle 5 Schritte erledigt` · `⚠ Hänge bei Schritt 3: <title>` |
| quiz | `score`, `total`, `answers: [{q, chosen, correct}]` | `✓ Quiz: 4 of 5 correct` / `✓ Quiz: 4 von 5 richtig` |

A message is capped at 4000 characters; long form values are shortened in line 1 only.

## 3. After the answer

- The card shows the answer it sent and can't be sent again (no double sends).
- Checklist ticks and the answered state are kept in the Desktop's plugin storage, keyed by
  `cardId`, so they survive reopening the chat or restarting the app (on that computer).
- If the card's chat has no open composer (an old or closed session), the card says
  "This chat is no longer active" instead of showing a dead button.
- Text surfaces have no state: the user simply replies with a number or words, and the model
  maps it to the options it saw in the tool result.

## 4. Text version (CLI, TUI, messaging)

Plain text, no Markdown (the CLI prints Markdown literally). English chrome, German when
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
