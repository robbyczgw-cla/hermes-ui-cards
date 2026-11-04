---
name: hui-cards
description: When to answer with an interactive card (hui_present) instead of text, and how to handle the user's answer.
---

# Interactive cards with hui_present

A card is for the moment the user has to **do** something: decide, tick off, compare, fill in,
approve. Everything else stays text. Most replies are not cards.

## Use a card when

- **You hand over a list to work through** (packing, shopping, release steps) → `checklist`.
  The ticks are saved, so the user can come back later.
- **The user weighs 2–4 candidates** → `compare` with aligned `rows`, at most one `best: true`
  (your recommendation, only if you have a reason).
- **You need several details at once** (booking, a bug report, settings) → `form`.
  Mark only what you really need as `required`.
- **The user follows instructions step by step** (setup, repair, a how-to) → `steps`, one step at a
  time; they tell you when they are done or where they got stuck.
- **You are about to do something with consequences** (delete, send, buy, overwrite) → `confirm`
  with the exact `action`, the `reason`, a `risk` level and the `command` if there is one.
  A Yes on the card is the user's message, not an approval bypass: Hermes still asks for its own
  approval when a command needs it.
- **Several picks, or options that need a picture or a short text each** → `choice`
  (`multiple: true`, `image`, `description`). One plain question with a few simple options is
  what the built-in `clarify` tool does: use `clarify` for that, not a card.
- Also: `schedule` (time slots), `rating` (feedback), `slider` (one number in a range),
  `quiz` (practice questions).

## Don't use a card when

- the answer is information (facts, explanations, code, a summary): write it;
- there is only one sensible option: just do it, or ask in one sentence;
- the user asked an open question ("what do you think about…"): answer it;
- you already showed a card for the same question: wait for the answer.

## After the call

On Desktop, write at most one short sentence and the `MEDIA:` line from the tool result's `next`
field, then **end your turn**. Don't repeat the card's content as text. On other surfaces
(CLI, Telegram, …) the result has a `text` field instead: send that text as your reply.

The answer arrives as the user's next message:

```
✓ Chose: Spa
[hui-card] {"card":"trip-style-3f9a1c","type":"choice","selected":["o3"],"labels":["Spa"]}
```

Read the `[hui-card]` line, act on it, and don't show the same card again. `✗` means declined
(confirm: No, schedule: none fit), `✎` a change request (do what the text says, then ask again
if it still needs approval), `⚠` stuck at a step (help with that step). On text surfaces the
user types a number or words: map them to the options you sent.

## Examples

**Card.** User: "I want a new e-bike, around €3,000. Which one?"
→ `compare` with three models, rows for range, weight, motor and price, `best: true` on the one you
would pick and why in its `subtitle`. After `✓ Picked: …`: where to test-ride or buy it.

**Card.** User: "Clean up my old log files."
→ Check first what would be deleted, then `confirm` with title "Delete 14 old log files?",
`action`, `reason` "They use 2.3 GB", `risk: {level: "medium", text: "Can't be restored"}` and
the exact `command`. Run it only after `✓ Yes, go ahead`.

**Card.** User: "What do I need for a trip to Japan in winter?"
→ A short intro sentence, then a `checklist` grouped by `category` (Documents, Clothes, Tech).

**No card.** User: "What's the difference between TCP and UDP?"
→ Plain text. Nothing to decide or fill in.

**No card.** User: "Rename the variable to `count`."
→ Just do it. One obvious action needs no confirmation card.

**No card, clarify.** You need to know "Python or TypeScript?" before you start.
→ The built-in `clarify` tool. A card adds nothing to a plain either-or question.

## Rules

- One card per call; keep labels short (the card has little space in a split view).
- Write the card in the user's language and set `lang` (`"de"`, `"en"`) so the buttons match.
- Images only from URLs a tool or the user gave you. Never invent URLs.
- An invalid card comes back as an error listing each bad field: fix those fields and call again.
