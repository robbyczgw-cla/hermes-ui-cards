# HUI+ Cards for Hermes

Hermes answers with cards you act on, right in the Hermes Desktop chat: edit its plan before it
runs, compare options, tick off a list, fill in a form, approve a risky step. Each click is sent
back as your next message, and Hermes continues from there.

![A compare card in Hermes Desktop: three laptops side by side with sourced prices, the best value per row marked, and the answered state "Your answer: Picked: MacBook Pro 14"](assets/hero.jpg)

<p>
  <img src="assets/plan-demo.gif" alt="A plan card: an optional risky step is switched off, Run starts a 4 second undo window, then the plan is sent" width="49%">
  <img src="assets/confirm.jpg" alt="A confirm card: the exact command, what stays, a high-risk warning, and the buttons Change, Keep it and Delete" width="49%">
</p>

Demo video (83 s): *link added with the release.*

## Install

Requires **Hermes 0.22.6 or newer** (the version that lets a plugin draw the files its own tool
produces).

1. Install and enable the plugin:

   ```bash
   hermes plugins install robbyczgw-cla/hermes-ui-cards --enable
   ```

   Once it is listed in the plugin catalog, `hermes plugins install hermes-ui-cards --enable` works
   too. Or use the install link: `hermes://plugin/install?repo=robbyczgw-cla/hermes-ui-cards&enable=1`.

2. **Turn on the Desktop half.** Desktop plugins are opt-in. In Hermes Desktop (or the Hermes Webapp)
   open **Capabilities → Plugins**, find *HUI+ Cards* and switch on its **Desktop** half. Without it,
   each card shows up as a small Markdown file attachment instead of a card.

   With a remote backend the Desktop half is not copied from the server: install it from Git in the
   Desktop's plugin dialog with the Desktop target checked.

3. Start a new chat. Try `Show me the hui_present demo for plan`, or just ask for something that
   needs a decision ("help me pack for Japan in January", "migrate the blog to the new server").

## Cards

17 card types. The first seven are the ones that matter most.

| Card | What you do | What Hermes gets |
|---|---|---|
| `plan` | Switch off optional steps, reorder, add a note per step, then Run | The steps to run, in your order, with notes |
| `review` | Keep or drop many drafts at once (replies, files, edits), comment on any | Which to keep, drop or leave open, plus comments |
| `checklist` | Tick items off; ticks are saved as you go | Done and open items |
| `compare` | Read 2–4 options side by side, pick one | Your pick |
| `form` | Fill in fields with required ones and checks | The values |
| `confirm` | Read one action with its reason, risk and exact command; Yes, No or Change | Your decision, or what to change |
| `steps` | Follow a walkthrough with Back and Next; say when you're done or stuck | Done, or where you got stuck and why |
| `decision` | Weigh criteria with sliders; the ranking updates live | Your weights and the ranking, or a pick |
| `calc` | Change inputs; results update live (loan, budget, split a bill) | Inputs and results |
| `rank` | Put items in order (drag or Alt+↑/↓) | The order |
| `choice` | Pick one or several options with a picture or short text each | Your picks |
| `schedule` | Pick a time slot, or "none of these" | The slot |
| `recipe` | Scale servings, tick what you have | A shopping list for what's missing |
| `flashcards` | Flip cards, mark known or again | What you knew and what to practise |
| `rating`, `slider`, `quiz` | Rate, set one number, answer practice questions | The rating, the number, your score |

For a single plain question with a few simple options, Hermes' built-in `clarify` picker is the
right tool; the plugin's skill tells the model so. Most replies are still plain text.

## How it works

1. Hermes calls the `hui_present` tool with one card. The tool checks it against
   [one schema](hui_cards/cards.schema.json); a wrong field comes back as an error that names it, and
   the model fixes it.
2. On Desktop the tool result carries the card, and the plugin's Desktop half draws it in the chat.
3. A click sends one message into the same chat, as if you had typed it:

   ```
   ✓ Picked: MacBook Pro 14 (M6)
   [hui-card] {"card":"laptops-3f9a1c2b7e","type":"compare","selected":"c1","label":"MacBook Pro 14 (M6)"}
   ```

   Line 1 is for you, line 2 is for the model. The full format is in [docs/protocol.md](docs/protocol.md).

Details that make it dependable:

- **Nothing is sent twice.** An answered card shows a receipt and locks. Answers are also kept by the
  plugin's backend, so a card answered in the Webapp is locked in the Desktop app and on a second
  computer too.
- **Undo before it counts.** A pick on `compare`, Run on `plan` and Yes on a medium- or high-risk
  `confirm` wait 4 seconds (Settings: 0, 4 or 8) and can be undone.
- **A card is not an approval bypass.** A Yes on a card is your message to the model. When Hermes then
  runs a command that needs its approval, Hermes still asks.
- **Work in progress is kept.** Checklist ticks, form input and drafts survive reopening the chat.
- **Stale answers are flagged.** If you answer a card after writing other messages, the model is told
  to check that the answer still fits; a confirm then needs a fresh Yes.
- **The card is shown even if the model forgets.** If the reply lacks the card's line, the plugin adds it.
- **Plugin tools are found.** Hermes hides plugin tools behind its tool search by default; on Desktop
  the plugin adds a one-line hint so the model knows cards exist.

## Other surfaces

| Where | What you get |
|---|---|
| Hermes Desktop, Hermes Webapp | Interactive cards |
| CLI, TUI, Telegram, Discord, other messaging, web dashboard chat | A plain-text version with numbered options; you answer by typing |
| Hermes API server with the [Hermes UI+](https://github.com/robbyczgw-cla/hermes-ui-plus) app | 12 of the 17 types as the app's native cards (the rest as text) |
| Desktop with the Desktop half switched off | The text version as a Markdown attachment |

The text version of a confirm card:

```
Delete old log files?
Action: Delete 14 log files older than 30 days in ~/logs
Why: They use 2.3 GB and nothing reads them
Risk (medium): Deleted files can't be restored
Command:
  find ~/logs -name '*.log' -mtime +30 -delete
Reply yes, no, or what to change.
```

## Settings

**Settings → Plugins → hermes-ui-cards.** Changes apply to cards already on screen.

| Setting | Default | Meaning |
|---|---|---|
| Interactive cards | on | Off: Desktop also gets the text version |
| Compact cards | off | Less padding, for narrow split views |
| Accent colour | app | Your theme's accent, or blue, green, orange, purple, red |
| Undo time (seconds) | 4 | 0, 4 or 8 seconds before a pick, Run or risky Yes is sent |
| Card types | all | The types Hermes may use (applies to the tool description after a restart) |
| API server card format | auto | `hui` blocks for the Hermes UI+ app when its plugin is enabled |

Commands: `/cards` (status), `/cards types`, `/cards demo <type>` (the text version of a demo card).
In Desktop, the command palette has *HUI+ Cards: show an example card*.

## Limits

- Cards render in Hermes Desktop and the Hermes Webapp only; everything else gets text.
- One card per tool call.
- Two clients answering the same card within the same second can both send; the backend keeps the
  first answer and tells the model about the second.
- With `plugins.isolation: host`, Desktop detection and the backend routes are untested.
- Card images are loaded from the `https` URLs the model puts on the card (it is told to use only URLs
  it got from a tool or from you).

## Privacy and what the plugin stores

The plugin sends nothing to third parties, has no telemetry and reads no secrets. Exact inventory:

**On the Hermes host**, per profile, in `<HERMES_HOME>/plugin-data/hermes-ui-cards/`:
- `answers.db` (SQLite): for each card shown on Desktop, its id, type and chat, and each answer: the
  mark, line 1 (up to 300 characters) and the answer data, including free text you typed into the
  card (form values, comments, notes). The 2,000 most recently used cards are kept; there is no
  time-based expiry and deleting a chat does not delete its entries.
- `cards/<id>.md`: the text version of each Desktop card plus the card itself (for a confirm card,
  also its action and command). The newest 500 are kept.

**To the model provider**, as temporary context in the turn that answers a card: the card's type,
title and id, for a confirm card its action and command, and notes when the answer is stale or a
duplicate. On Desktop turns, a one-line hint that cards exist. Hermes does not store this context.

**Backend routes** (read-only, under `/api/plugins/hermes-ui-cards/`, behind Hermes' own sign-in):
`GET /answers` returns the answers of one chat's cards to any client signed in to that backend that
knows the chat and card ids; `GET /settings` returns the display settings. After each recorded answer
the plugin broadcasts an empty `answers.changed` event so open windows check again.

**On your computer**, in the Desktop's plugin storage: drafts (up to 300) and receipts (up to 5,000),
separated by connection, profile and chat; nothing expires by time.

**Network requests from the Desktop half** go only to the backend you are connected to, plus card
images, which your Desktop loads directly from the image host (that host sees your IP address).

## Development

```bash
python3 scripts/build.py            # regenerate desktop/plugin.js and desktop/cards.d.ts
python3 scripts/build.py --check    # fail if they are out of date

python3 -m venv .venv && .venv/bin/pip install pytest pyyaml
timeout 300 .venv/bin/python -m pytest tests -q   # Python: schema, tool, hooks, backend, calc parity
npm install && npm test                            # Desktop: jsdom, capped at 300 s and 1 GB

HERMES_BIN=/path/to/hermes python3 tests/e2e/run_e2e.py   # real Hermes + a scripted model
hermes plugins validate .
```

- `hui_cards/cards.schema.json` is the single source of card shapes: the Python validator reads it,
  `scripts/build.py` embeds it in the Desktop half (whose validator gives identical results, checked
  on every fixture and by a seeded fuzz test) and generates `desktop/cards.d.ts`.
- `desktop/src/*.js` are the Desktop sources; `desktop/plugin.js` is generated.
- `calc` formulas are parsed by a small expression parser in both languages; nothing is evaluated
  with `eval`.

## Related

- [hermes-rich-ui](https://github.com/jacobhausler/hermes-rich-ui) draws display cards (tables,
  charts, metrics). HUI+ Cards is for cards you answer; the two work side by side.
- The card format comes from the [Hermes UI+](https://github.com/robbyczgw-cla/hermes-ui-plus) app (MIT).

## License

MIT, see [LICENSE](LICENSE). Changes are listed in [CHANGELOG.md](CHANGELOG.md).
