// A reply is measured as it is sent (docs/protocol.md §2): line 1, the attached-context line and the
// JSON with every `@` written as @ (six characters). Optional copies (flashcard fronts, review
// titles) and the compact recipe/checklist forms are chosen on that size, so a valid answer full of
// @mentions still fits the 4,000-code-point cap and is sent.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { buttonByText, click, mod, mount, resetHost, testHost, toolResult } from './dom.mjs'

beforeEach(resetHost)

const card = raw => JSON.parse(toolResult(raw)).card
const MAX = 4000
const size = reply => [...reply.text].length
const sentData = reply => JSON.parse(reply.text.split('\n').at(-1).slice('[hui-card] '.length))

test('flashcards: fronts full of @ are left out when the escaped reply would not fit', () => {
  const raw = { type: 'flashcards', title: 'Mail review', cards: Array.from({ length: 3 }, () => ({ front: '@'.repeat(250), back: 'B' })) }
  const reply = mod.buildReply(card(raw), { known: [], again: [0, 1, 2], rounds: 1 }, 'en')
  assert.equal(reply.fits, true)
  assert.ok(size(reply) <= MAX)
  assert.equal(reply.data.practise, undefined)
  assert.deepEqual(sentData(reply).again, [0, 1, 2], 'the indexes always go')
})

test('flashcards: ordinary @mentions near the cap keep the fronts only while they fit', () => {
  for (const n of [3, 8, 13, 20]) {
    for (const len of [60, 150, 281]) {
      const raw = { type: 'flashcards', title: 'Practise', cards: Array.from({ length: n }, (_, i) => ({ front: `@alice ${i} ` + 'x'.repeat(len - 9), back: 'B' })) }
      const reply = mod.buildReply(card(raw), { known: [], again: Array.from({ length: n }, (_, i) => i), rounds: 1 }, 'en')
      assert.equal(reply.fits, true, `${n} × ${len}`)
      assert.ok(size(reply) <= MAX, `${n} × ${len}`)
    }
  }
  const small = mod.buildReply(card({ type: 'flashcards', title: 'P', cards: [{ front: '@bob hi', back: 'B' }, { front: 'two', back: 'B' }] }), { known: [1], again: [0], rounds: 1 }, 'en')
  assert.deepEqual(small.data.practise, ['@bob hi'], 'kept when there is room')
})

test('flashcards: the real Send result of 13 @mention fronts marked Again for three rounds is sent', async () => {
  const view = await mount(toolResult({ type: 'flashcards', title: 'Practise', cards: Array.from({ length: 13 }, () => ({ front: '@alice ' + 'x'.repeat(281), back: 'B' })) }))
  for (let i = 0; i < 39; i++) {
    await click(buttonByText(view.container, 'Show answer'))
    await click(buttonByText(view.container, '↺ Again'))
  }
  await click(buttonByText(view.container, 'Send result'))
  assert.equal(testHost.submissions.length, 1, 'sent, not refused as too long')
  assert.ok([...testHost.submissions[0].text].length <= MAX)
  assert.equal(sentData({ text: testHost.submissions[0].text }).again.length, 13)
  await view.unmount()
})

test('review: titles full of @ are left out when the escaped reply would not fit', () => {
  const raw = { type: 'review', title: 'Review', items: Array.from({ length: 10 }, (_, i) => ({ id: `i${i}`, title: '@'.repeat(80) })) }
  const reply = mod.buildReply(card(raw), { keep: [], drop: raw.items.map(i => i.id), notes: {} }, 'en')
  assert.equal(reply.fits, true)
  assert.ok(size(reply) <= MAX)
  assert.equal(reply.data.titles, undefined)
  assert.equal(sentData(reply).drop.length, 10)
  const short = mod.buildReply(card({ ...raw, items: raw.items.map(i => ({ ...i, title: '@ann' })) }), { keep: ['i0'], drop: [], notes: {} }, 'en')
  assert.equal(short.data.titles.i0, '@ann', 'kept when there is room')
})

test('recipe: @-heavy ingredients choose the compact form on the escaped size, quantities kept', () => {
  const raw = { type: 'recipe', title: 'Recipe', servings: 2, ingredients: Array.from({ length: 10 }, (_, i) => ({ id: `i${i}`, item: '@'.repeat(80), qty: i + 1, unit: 'g' })) }
  const reply = mod.buildReply(card(raw), { servings: 2, have: [], missing: card(raw).ingredients }, 'en')
  assert.equal(reply.fits, true)
  assert.ok(size(reply) <= MAX)
  const data = sentData(reply)
  assert.ok(data.ingredient_source, 'compact form')
  const qtys = data.missing ? data.missing.map(m => m.qty) : data.missing_indexes.map(e => e[1])
  assert.deepEqual(qtys, raw.ingredients.map(i => i.qty))
})

test('checklist: @-heavy items fall back to counts on the escaped size', () => {
  const items = Array.from({ length: 25 }, (_, i) => ({ id: `i${i}`, text: `${i} ` + '@'.repeat(24) }))
  const reply = mod.buildReply(card({ type: 'checklist', title: 'L', items }), { checked: items.slice(0, 12).map(i => i.id) }, 'en')
  assert.equal(reply.fits, true)
  assert.ok(size(reply) <= MAX)
  assert.equal(reply.data.done, undefined)
  assert.equal(reply.data.done_count, 12)
  assert.equal(sentData(reply).done_ids.length, 12)
})
