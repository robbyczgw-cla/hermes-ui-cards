---
name: hui-cards
description: When to answer with an interactive card (hui_present) instead of text, and how to handle the user's answer.
---

# Interactive cards with hui_present

A card is for the moment the user has to **do** something: decide, tick off, compare, fill in,
approve, edit your plan. Everything else stays text. Most replies are not cards.

## Use a card when

- **You are about to run a multi-step job** (migration, refactor, cleanup, trip booking) → `plan`.
  The user switches off `optional` steps, reorders, adds notes, then runs it. Mark risky steps
  with `risk`, show real `command`s. Run exactly the steps that come back, in that order.
- **You drafted many things the user must judge** (replies, file deletions, suggested edits) →
  `review`: one pass of Keep/Drop with comments instead of ten questions.
- **You hand over a list to work through** (packing, shopping, release steps) → `checklist`.
- **The user weighs 2–4 candidates** → `compare` with aligned `rows`, `best` per row and at most
  one column `best: true` (only if you have a reason).
- **You need several details at once** (booking, a bug report, settings) → `form`.
  Mark only what you really need as `required`.
- **The user follows instructions step by step** (setup, repair) → `steps`.
- **You are about to do one thing with consequences** (delete, send, buy, overwrite) → `confirm`
  with the exact `action`, the `reason`, a `risk` level and the `command`. Use a verb on the button
  (`confirmLabel: "Delete 14 files"`), not a generic "Yes". A Yes on the card is the user's message,
  not an approval bypass: Hermes still asks for its own approval when a command needs it.
- **Numbers the user wants to play with** (loan, budget, split a bill, unit conversion) → `calc`.
- **Criteria with weights** → `decision`; **an order of priorities** → `rank`;
  **cooking for a different number of people** → `recipe`; **learning by heart** → `flashcards`.
- **Several picks, or options that need a picture or a short text each** → `choice`
  (`multiple: true`, `image`, `description`). One plain question with a few simple options is
  what the built-in `clarify` tool does: use `clarify` for that, not a card.
- Also: `schedule` (time slots), `rating`, `slider` (one number), `quiz`.

## Don't use a card when

- the answer is information (facts, explanations, code, a summary): write it;
- there is only one sensible option: just do it, or ask in one sentence;
- the user asked an open question ("what do you think about…"): answer it;
- you already showed a card for the same question: wait for the answer.

## After the call

On the HUI+ app, a result may contain `hui`: send that block as your reply. The user's
answers then arrive as `[type:id]` lines (such as `[choice:id]` or `[form:id]`); read and
act on them like the `[hui-card]` answer below.

On Desktop, write at most one short sentence and the `MEDIA:` line from the tool result's `next`
field, then **end your turn**. Don't repeat the card's content as text. On other surfaces
(CLI, Telegram, …) the result has a `text` field instead: send that text as your reply.

The answer arrives as the user's next message:

```
✓ Chose: Spa
[hui-card] {"card":"trip-style-3f9a1c","type":"choice","selected":["o3"],"labels":["Spa"]}
```

Read the `[hui-card]` line, act on it, and don't show the same card again. `✗` means declined
(confirm: No — do not run it), `✎` a change request (do what the text says, then show a new confirm
if it still needs approval), `⚠` stuck at a step (help with that step, the note says what happened).
On text surfaces the user types a number or words: map them to the options you sent.

## Chains: one card leads to the next

A good flow asks one thing at a time and carries the answer forward: `compare` → `calc` with the
picked price prefilled → `plan` for the job → `confirm` for the one risky step the user kept for
later → `checklist` of what is left. Put earlier answers into the next card (titles, defaults,
`details`) so the user never types something twice.

## Facts on cards

- Values you looked up get `rows[].sources` (the https URL you actually read) and `asOf` (the date
  you checked). Never set `asOf` or sources for figures from memory: a compare card without sources
  says "From the model's knowledge" by itself, which is honest and fine.
- Images only from URLs a tool or the user gave you. Never invent URLs.
- `calc` formulas must not break on edge values: guard divisions, e.g. a loan payment
  `if(rate == 0, amount / months, amount * r / (1 - (1 + r) ^ -months))`.

## Examples

**Card.** User: "Migrate our Postgres 14 database to 16 this weekend."
→ Check the setup first, then `plan` with backup, stop workers, `pg_upgrade` (risk high, the exact
command), smoke test, and "delete the old cluster" as an `optional` step. Run what comes back.

**Card.** User: "Answer my unread mails, I'll check them."
→ Draft the replies, then `review` with one item per reply (`preview` = the text). Send only the kept
ones; rewrite those with a comment.

**Card.** User: "I want a laptop for programming, around €1,500. Which one?"
→ Search, then `compare` with three models, sourced prices and `asOf`, `best` per row, your pick as
`best: true` with the reason in its `subtitle`.

**Card.** User: "Clean up my old log files."
→ Check what would be deleted, then `confirm` "Delete 14 old log files?" with `reason`, `risk:
{level: "medium", text: "Can't be restored"}`, the exact `command` and `confirmLabel: "Delete them"`.

**No card.** User: "What's the difference between TCP and UDP?" → Plain text.

**No card.** User: "Rename the variable to `count`." → Just do it.

**No card, clarify.** You need "Python or TypeScript?" before you start → the built-in `clarify` tool.

## Rules

- One card per call; keep labels short (the card has little space in a split view).
- Write the card in the user's language and set `lang` (`"de"`, `"en"`) so the buttons match.
- An invalid card comes back as an error listing each bad field: fix those fields and call again.
