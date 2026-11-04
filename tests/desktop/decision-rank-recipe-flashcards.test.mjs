import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { act, mod, mount, toolResult, click, type, buttonByText, resetHost, lastReply, registerPlugin, testHost } from './dom.mjs'

beforeEach(resetHost)
async function render(t, card, options) {
  const mounted = await mount(toolResult(card), options)
  t.after(mounted.unmount)
  return mounted
}
// Mount, unmount and mount the same card again in the same storage: what reopening a chat does.
async function reopen(t, card) {
  const registration = registerPlugin()
  const result = toolResult(card)
  let current = await mount(result, { registration })
  let open = true
  t.after(async () => { if (open) await current.unmount() })
  return {
    container: current.container,
    again: async () => {
      await current.unmount()
      current = await mount(result, { registration })
      return current.container
    }
  }
}
async function altKey(el, keyName) {
  await act(async () => {
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: keyName, altKey: true, bubbles: true, cancelable: true }))
  })
}
async function pressKey(el, keyName) {
  await act(async () => {
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true }))
  })
}
const texts = list => [...list].map(el => el.textContent)

// ── decision ───────────────────────────────────────────────────────────────
const decision = {
  type: 'decision', title: 'Which laptop?',
  criteria: [{ id: 'price', label: 'Price', weight: 5 }, { id: 'quality', label: 'Build quality', weight: 5 }],
  options: [
    { label: 'Alpha', scores: { price: 9, quality: 3 } },
    { label: 'Beta', scores: { price: 3, quality: 9 }, note: 'Premium feel' },
    { label: 'Gamma', scores: { price: 6, quality: 6 } }
  ]
}
const optionNames = container => [...container.querySelectorAll('.huic-dec-opt .huic-dec-name > span:first-child')].map(e => e.textContent)
const sliderFor = (container, label) => container.querySelector(`input[type=range][aria-label="${label}"]`)

test('decision: weights re-rank the options live, ties are flagged and a leader is marked', async t => {
  const { container } = await render(t, decision)
  assert.deepEqual(optionNames(container), ['Alpha', 'Beta', 'Gamma'], 'equal weights keep the card order')
  assert.ok(container.querySelector('.huic-dec-name .huic-badge').textContent === 'Tied')
  assert.equal(container.querySelector('.huic-dec-lead'), null)
  await type(sliderFor(container, 'Price'), '10')
  await type(sliderFor(container, 'Build quality'), '0')
  assert.deepEqual(optionNames(container), ['Alpha', 'Gamma', 'Beta'])
  assert.equal(container.querySelector('.huic-dec-lead .huic-dec-score').textContent.trim().startsWith('9.0'), true)
  assert.match(container.querySelector('.huic-dec-lead').textContent, /Leader/)
  assert.equal(sliderFor(container, 'Price').getAttribute('aria-valuetext'), 'Weight 10 of 10')
  await type(sliderFor(container, 'Price'), '0')
  await type(sliderFor(container, 'Build quality'), '10')
  assert.deepEqual(optionNames(container), ['Beta', 'Gamma', 'Alpha'])
  await type(sliderFor(container, 'Build quality'), '0')
  assert.match(container.textContent, /All weights are 0/)
})

test('decision: "Send weights" replies with weights and the live ranking, no pick', async t => {
  const { container } = await render(t, decision)
  await type(sliderFor(container, 'Price'), '10')
  await type(sliderFor(container, 'Build quality'), '2')
  await click(buttonByText(container, 'Send weights'))
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Decision: Alpha (8.0) ahead of Gamma (6.0)')
  assert.deepEqual(reply.json.weights, { price: 10, quality: 2 })
  assert.deepEqual(reply.json.ranking, [
    { id: 'o1', label: 'Alpha', score: 8 }, { id: 'o3', label: 'Gamma', score: 6 }, { id: 'o2', label: 'Beta', score: 4 }
  ])
  assert.equal('picked' in reply.json, false)
  assert.equal(reply.json.type, 'decision')
  assert.ok(container.querySelector('.huic-answer'))
  assert.equal(container.querySelectorAll('input[type=range]:disabled').length, 2)
  assert.equal(container.querySelector('.huic-foot'), null)
  assert.equal(testHost.submissions.length, 1)
})

test('decision: picking an option replies with the pick; picking again clears it', async t => {
  const { container } = await render(t, decision)
  const gamma = () => [...container.querySelectorAll('.huic-dec-opt')].find(b => b.textContent.includes('Gamma'))
  await click(gamma())
  assert.equal(gamma().getAttribute('aria-pressed'), 'true')
  assert.ok(buttonByText(container, 'Choose Gamma'))
  await click(gamma())
  assert.equal(gamma().getAttribute('aria-pressed'), 'false')
  assert.ok(buttonByText(container, 'Send weights'))
  await click(gamma())
  await click(buttonByText(container, 'Choose Gamma'))
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Picked: Gamma (6.0)')
  assert.equal(reply.json.picked, 'o3')
  assert.deepEqual(reply.json.weights, { price: 5, quality: 5 })
})

test('decision: German texts and decimal comma', async t => {
  const { container } = await render(t, { ...decision, lang: 'de', submitLabel: 'Gewichte abschicken' })
  assert.match(container.textContent, /Was dir wichtig ist/)
  await type(sliderFor(container, 'Price'), '10')
  await type(sliderFor(container, 'Build quality'), '2')
  assert.equal(sliderFor(container, 'Price').getAttribute('aria-valuetext'), 'Gewicht 10 von 10')
  await click(buttonByText(container, 'Gewichte abschicken'))
  assert.equal(lastReply().line1, '✓ Entscheidung: Alpha (8,0) vor Gamma (6,0)')
})

test('decision: weights and pick are saved as a draft and restored; answered view is locked', async t => {
  const { again, container: first } = await reopen(t, decision)
  let container = first
  await type(sliderFor(container, 'Price'), '9')
  await type(sliderFor(container, 'Build quality'), '1')
  await click([...container.querySelectorAll('.huic-dec-opt')].find(b => b.textContent.includes('Beta')))
  container = await again()
  assert.equal(sliderFor(container, 'Price').value, '9')
  assert.equal(sliderFor(container, 'Build quality').value, '1')
  assert.deepEqual(optionNames(container), ['Alpha', 'Gamma', 'Beta'])
  assert.ok(buttonByText(container, 'Choose Beta'))
  await click(buttonByText(container, 'Choose Beta'))
  container = await again()
  assert.ok(container.querySelector('.huic-answer'))
  assert.equal(sliderFor(container, 'Price').disabled, true)
  assert.equal(sliderFor(container, 'Price').value, '9')
  assert.equal([...container.querySelectorAll('.huic-dec-opt')].every(b => b.disabled), true)
  assert.equal(container.querySelector('.huic-dec-opt[aria-pressed="true"]').textContent.includes('Beta'), true)
  assert.equal(container.querySelector('.huic-foot'), null)
})

test('decision: no actions when the chat cannot send', async t => {
  const { container } = await render(t, decision, { sessionId: null })
  assert.equal(buttonByText(container, 'Send weights'), undefined)
  assert.match(container.querySelector('.huic-notice').textContent, /no longer active/)
})

// ── rank ───────────────────────────────────────────────────────────────────
const rank = {
  type: 'rank', title: 'Rank the features', prompt: 'Most important first.',
  items: [{ label: 'Dark mode', detail: 'For late nights' }, { label: 'Offline sync' }, { label: 'Export to PDF' }, { label: 'Team sharing' }]
}
const rankLabels = container => texts(container.querySelectorAll('.huic-rank-label'))
const moveBtn = (container, label, dir) => container.querySelector(`button[aria-label="${dir === 'up' ? 'Move ' + label + ' up' : 'Move ' + label + ' down'}"]`)

test('rank: Alt+arrows and move buttons reorder, focus stays, moves are announced', async t => {
  const { container } = await render(t, rank)
  assert.deepEqual(rankLabels(container), ['Dark mode', 'Offline sync', 'Export to PDF', 'Team sharing'])
  assert.deepEqual(texts(container.querySelectorAll('.huic-rank-pos')), ['1', '2', '3', '4'])
  const down = moveBtn(container, 'Dark mode', 'down')
  down.focus()
  await altKey(down, 'ArrowDown')
  assert.deepEqual(rankLabels(container), ['Offline sync', 'Dark mode', 'Export to PDF', 'Team sharing'])
  assert.equal(container.querySelector('[role=status][aria-live=polite]').textContent, 'Dark mode moved to position 2 of 4.')
  assert.equal(document.activeElement.getAttribute('aria-label'), 'Move Dark mode down')
  await altKey(document.activeElement, 'ArrowDown')
  assert.deepEqual(rankLabels(container), ['Offline sync', 'Export to PDF', 'Dark mode', 'Team sharing'])
  await altKey(document.activeElement, 'ArrowUp')
  assert.deepEqual(rankLabels(container), ['Offline sync', 'Dark mode', 'Export to PDF', 'Team sharing'])
  await click(moveBtn(container, 'Team sharing', 'up'))
  assert.deepEqual(rankLabels(container), ['Offline sync', 'Dark mode', 'Team sharing', 'Export to PDF'])
  // Plain arrows do nothing; the ends are aria-disabled, not removed from the tab order.
  await pressKey(document.activeElement, 'ArrowUp')
  assert.deepEqual(rankLabels(container), ['Offline sync', 'Dark mode', 'Team sharing', 'Export to PDF'])
  assert.equal(moveBtn(container, 'Offline sync', 'up').getAttribute('aria-disabled'), 'true')
  assert.equal(moveBtn(container, 'Export to PDF', 'down').getAttribute('aria-disabled'), 'true')
  await click(moveBtn(container, 'Offline sync', 'up'))
  assert.deepEqual(rankLabels(container), ['Offline sync', 'Dark mode', 'Team sharing', 'Export to PDF'])
  await altKey(moveBtn(container, 'Export to PDF', 'up'), 'Home')
  assert.deepEqual(rankLabels(container), ['Export to PDF', 'Offline sync', 'Dark mode', 'Team sharing'])
})

test('rank: sending replies with ids and labels in order', async t => {
  const { container } = await render(t, rank)
  await click(moveBtn(container, 'Export to PDF', 'up'))
  await click(moveBtn(container, 'Export to PDF', 'up'))
  await click(buttonByText(container, 'Send order'))
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Ranked: Export to PDF > Dark mode > Offline sync > Team sharing')
  assert.deepEqual(reply.json.order, ['k3', 'k1', 'k2', 'k4'])
  assert.deepEqual(reply.json.labels, ['Export to PDF', 'Dark mode', 'Offline sync', 'Team sharing'])
  assert.ok(container.querySelector('.huic-answer'))
  assert.equal(container.querySelector('.huic-rank-move'), null)
  assert.equal(container.querySelector('.huic-foot'), null)
})

test('rank: long lists are shortened after five, German line 1, unchanged order can be sent', async t => {
  const items = Array.from({ length: 7 }, (_, i) => ({ label: `Item ${i + 1}` }))
  const { container } = await render(t, { type: 'rank', title: 'Reihenfolge', items, lang: 'de' })
  await click(buttonByText(container, 'Reihenfolge senden'))
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Reihenfolge: Item 1 > Item 2 > Item 3 > Item 4 > Item 5 > …')
  assert.equal(reply.json.order.length, 7)
})

test('rank: draft order is restored and a bad draft falls back to the card order', async t => {
  const { again, container: first } = await reopen(t, rank)
  let container = first
  await click(moveBtn(container, 'Team sharing', 'up'))
  await click(moveBtn(container, 'Team sharing', 'up'))
  container = await again()
  assert.deepEqual(rankLabels(container), ['Dark mode', 'Team sharing', 'Offline sync', 'Export to PDF'])
  await click(buttonByText(container, 'Reset order'))
  assert.deepEqual(rankLabels(container), ['Dark mode', 'Offline sync', 'Export to PDF', 'Team sharing'])
  assert.equal(buttonByText(container, 'Reset order'), undefined)
  // a draft that is not a permutation of the items is ignored
  const registration = registerPlugin()
  const result = toolResult(rank)
  const cardId = JSON.parse(result).card.cardId
  registration.storage.set(`card.sess-1\u0000${cardId}`, { draft: { order: ['k1', 'k1', 'zzz'] } })
  const broken = await mount(result, { registration })
  t.after(broken.unmount)
  assert.deepEqual(rankLabels(broken.container), ['Dark mode', 'Offline sync', 'Export to PDF', 'Team sharing'])
})

test('rank: pointer drag on the grip moves a row', async t => {
  const { container } = await render(t, rank)
  const rows = [...container.querySelectorAll('.huic-rank-item')]
  rows.forEach((row, i) => { row.getBoundingClientRect = () => ({ top: i * 50, height: 44, bottom: i * 50 + 44, left: 0, right: 100, width: 100 }) })
  const grip = rows[0].querySelector('.huic-rank-grip')
  grip.setPointerCapture = () => {}
  const pointer = (type, y) => act(async () => {
    const ev = new window.MouseEvent(type, { bubbles: true, clientY: y, button: 0 })
    Object.defineProperty(ev, 'pointerId', { value: 1 })
    grip.dispatchEvent(ev)
  })
  await pointer('pointerdown', 20)
  await pointer('pointermove', 130)
  await pointer('pointerup', 130)
  assert.deepEqual(rankLabels(container), ['Offline sync', 'Export to PDF', 'Dark mode', 'Team sharing'])
  assert.match(container.querySelector('[role=status][aria-live=polite]').textContent, /Dark mode moved to position 3 of 4/)
})

// ── recipe ─────────────────────────────────────────────────────────────────
const recipe = {
  type: 'recipe', title: 'Lasagne', servings: 4,
  ingredients: [
    { item: 'flour', qty: 400, unit: 'g', group: 'Pasta' },
    { item: 'eggs', qty: 3, group: 'Pasta' },
    { item: 'milk', qty: 0.5, unit: 'l', group: 'Béchamel', note: 'whole' },
    { item: 'tomato sauce', qty: 250, unit: 'ml', group: 'Ragù' },
    { item: 'salt' }
  ],
  steps: [{ text: 'Knead the dough.', minutes: 30 }, { text: 'Bake.', minutes: 45 }, { text: 'Serve.' }]
}
const qtys = container => texts(container.querySelectorAll('.huic-rcp-qty'))
const stepper = (container, which) => container.querySelector(`button[aria-label="${which === '+' ? 'More servings' : 'Fewer servings'}"]`)
const ingredientBox = (container, name) => [...container.querySelectorAll('.huic-rcp-ing')].find(l => l.querySelector('.huic-rcp-name').textContent === name).querySelector('input')

test('recipe: servings 4 to 6 scale quantities with fractions, groups and step badges render', async t => {
  const { container } = await render(t, recipe)
  assert.deepEqual(qtys(container), ['400 g', '3', '½ l', '250 ml', ''])
  assert.deepEqual(texts(container.querySelectorAll('.huic-rcp-gname')), ['Pasta', 'Béchamel', 'Ragù', 'Also'])
  assert.equal(container.querySelector('.huic-rcp-count').textContent, '4 servings')
  await click(stepper(container, '+'))
  await click(stepper(container, '+'))
  assert.equal(container.querySelector('.huic-rcp-count').textContent, '6 servings')
  assert.deepEqual(qtys(container), ['600 g', '4½', '¾ l', '375 ml', ''])
  assert.deepEqual(texts(container.querySelectorAll('.huic-rcp-time')), ['30 min', '45 min'])
  assert.match(container.textContent, /about 1 h 15 min/)
  await click(buttonByText(container, 'Original: 4'))
  assert.deepEqual(qtys(container), ['400 g', '3', '½ l', '250 ml', ''])
  for (let i = 0; i < 5; i++) await click(stepper(container, '-'))
  assert.equal(container.querySelector('.huic-rcp-count').textContent, '1 serving')
  assert.equal(stepper(container, '-').disabled, true)
  assert.deepEqual(qtys(container).slice(0, 4), ['100 g', '¾', '⅛ l', '63 ml'])
})

test('recipe: nice rounding for odd factors', async t => {
  const { steps: _omit, ...noSteps } = recipe
  const { container } = await render(t, { ...noSteps, servings: 3, ingredients: [
    { item: 'oil', qty: 1, unit: 'tbsp' }, { item: 'rice', qty: 190, unit: 'g' }, { item: 'pepper', qty: 0.3, unit: 'tsp' }, { item: 'water', qty: 7, unit: 'dl' }
  ] })
  assert.deepEqual(qtys(container), ['1 tbsp', '190 g', '0.3 tsp', '7 dl'], 'original amounts stay exact')
  await click(stepper(container, '+')) // x 4/3
  assert.deepEqual(qtys(container), ['1¼ tbsp', '253 g', '⅜ tsp', '9½ dl'])
})

test('recipe: ticked items leave the shopping list; reply has servings, missing and have', async t => {
  const { container } = await render(t, recipe)
  await click(stepper(container, '+'))
  await click(stepper(container, '+'))
  await click(ingredientBox(container, 'flour'))
  await click(ingredientBox(container, 'salt'))
  assert.match(container.querySelector('.huic-foot').textContent, /3 of 5 still to buy/)
  await click(buttonByText(container, 'Shopping list'))
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Shopping list for 6: 4½ eggs, ¾ l milk, 375 ml tomato sauce')
  assert.deepEqual(reply.json.missing, [
    { id: 'g2', item: 'eggs', qty: 4.5 }, { id: 'g3', item: 'milk', qty: 0.75, unit: 'l' }, { id: 'g4', item: 'tomato sauce', qty: 375, unit: 'ml' }
  ])
  assert.deepEqual(reply.json.have, ['g1', 'g5'])
  assert.equal(reply.json.servings, 6)
  assert.ok(container.querySelector('.huic-answer'))
  assert.equal(ingredientBox(container, 'flour').disabled, true)
  assert.equal(stepper(container, '+').disabled, true)
})

test('recipe: everything ticked says so; long lists are shortened; German; no qty is kept without qty', async t => {
  const { container } = await render(t, { ...recipe, lang: 'de' })
  for (const name of ['flour', 'eggs', 'milk', 'tomato sauce', 'salt']) await click(ingredientBox(container, name))
  assert.match(container.querySelector('.huic-foot').textContent, /Du hast alles da/)
  await click(buttonByText(container, 'Alles da'))
  assert.equal(lastReply().line1, '✓ Alles da für 4 Portionen')
  assert.deepEqual(lastReply().json.missing, [])
  resetHost()
  const many = await render(t, { ...recipe, lang: 'de', ingredients: [...recipe.ingredients, { item: 'basil' }, { item: 'oil', qty: 2, unit: 'EL' }] })
  await click(buttonByText(many.container, 'Einkaufsliste'))
  assert.equal(lastReply().line1, '✓ Einkaufsliste für 4: 400 g flour, 3 eggs, ½ l milk, 250 ml tomato sauce, …')
  assert.deepEqual(lastReply().json.missing.find(m => m.item === 'salt'), { id: 'g5', item: 'salt' })
})

test('recipe: servings and ticks are restored from the draft, locked after sending', async t => {
  const { again, container: first } = await reopen(t, recipe)
  let container = first
  await click(stepper(container, '+'))
  await click(ingredientBox(container, 'eggs'))
  container = await again()
  assert.equal(container.querySelector('.huic-rcp-count').textContent, '5 servings')
  assert.equal(ingredientBox(container, 'eggs').checked, true)
  assert.equal(ingredientBox(container, 'flour').checked, false)
  await click(buttonByText(container, 'Shopping list'))
  container = await again()
  assert.equal(container.querySelector('.huic-rcp-count').textContent, '5 servings')
  assert.equal(ingredientBox(container, 'eggs').checked, true)
  assert.equal(ingredientBox(container, 'eggs').disabled, true)
  assert.ok(container.querySelector('.huic-answer'))
})

// ── flashcards ─────────────────────────────────────────────────────────────
const flash = {
  type: 'flashcards', title: 'Spanish basics',
  cards: [
    { front: 'la casa', back: 'the house' }, { front: 'el perro', back: 'the dog', hint: 'barks' },
    { front: 'el gato', back: 'the cat' }, { front: 'el libro', back: 'the book' }
  ]
}
const faceText = (container, kind) => container.querySelector(`.huic-fc-${kind} .huic-fc-text`).textContent
const cardEl = container => container.querySelector('.huic-fc')
const knew = async container => click(buttonByText(container, '✓ Knew it'))
const again = async container => click(buttonByText(container, '↺ Again'))

test('flashcards: flip with click, Space and Enter; Knew it / Again only after flipping', async t => {
  const { container } = await render(t, flash)
  assert.equal(faceText(container, 'front'), 'la casa')
  assert.equal(cardEl(container).dataset.flipped, 'false')
  assert.equal(buttonByText(container, '✓ Knew it'), undefined)
  await click(cardEl(container))
  assert.equal(cardEl(container).dataset.flipped, 'true')
  assert.equal(cardEl(container).getAttribute('aria-pressed'), 'true')
  assert.equal(container.querySelector('[role=status][aria-live=polite]').textContent, 'Back: the house')
  await pressKey(cardEl(container), ' ')
  assert.equal(cardEl(container).dataset.flipped, 'false')
  await pressKey(cardEl(container), 'Enter')
  assert.equal(cardEl(container).dataset.flipped, 'true')
  await pressKey(cardEl(container), 'ArrowRight')
  assert.equal(faceText(container, 'front'), 'el perro')
  assert.equal(cardEl(container).dataset.flipped, 'false')
  assert.equal(document.activeElement, cardEl(container))
  await pressKey(cardEl(container), 'ArrowLeft') // not flipped: ignored
  assert.equal(faceText(container, 'front'), 'el perro')
  assert.match(container.textContent, /Card 2 of 4/)
})

test('flashcards: hint is revealed on demand', async t => {
  const { container } = await render(t, flash)
  assert.equal(buttonByText(container, 'Show hint'), undefined)
  await click(buttonByText(container, 'Show answer'))
  await knew(container)
  assert.equal(container.querySelector('.huic-fc-hinttext'), null)
  await click(buttonByText(container, 'Show hint'))
  assert.equal(container.querySelector('.huic-fc-hinttext').textContent, 'barks')
  assert.equal(buttonByText(container, 'Show hint'), undefined)
})

test('flashcards: Again cards return in the next round (max 3), then the result is sent', async t => {
  const { container } = await render(t, flash)
  const flipAnd = async fn => { await click(buttonByText(container, 'Show answer')); await fn(container) }
  await flipAnd(knew) // la casa
  await flipAnd(again) // el perro
  await flipAnd(knew) // el gato
  await flipAnd(again) // el libro
  // round 2 holds the two Again cards in order
  assert.match(container.textContent, /Round 2 of 3/)
  assert.match(container.textContent, /Card 1 of 2/)
  assert.equal(faceText(container, 'front'), 'el perro')
  await flipAnd(knew)
  assert.equal(faceText(container, 'front'), 'el libro')
  await flipAnd(again)
  assert.match(container.textContent, /Round 3 of 3/)
  assert.match(container.textContent, /Card 1 of 1/)
  await flipAnd(again)
  // result screen after round 3: one card is still open
  assert.ok(!container.querySelector('.huic-fc'))
  assert.match(container.querySelector('.huic-fc-big').textContent, /3 \/ 4/)
  assert.match(container.textContent, /To practise/)
  assert.match(container.querySelector('.huic-fc-list').textContent, /el libro/)
  assert.equal(container.querySelector('[role=progressbar]').getAttribute('aria-valuenow'), '3')
  await click(buttonByText(container, 'Send result'))
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Flashcards: 3 of 4 known, 1 to practise')
  assert.deepEqual(reply.json, { card: reply.json.card, type: 'flashcards', known: [0, 1, 2], again: [3], rounds: 3, practise: ['el libro'] })
  assert.ok(container.querySelector('.huic-answer'))
  assert.equal(container.querySelector('.huic-foot'), null)
  assert.equal(testHost.submissions.length, 1)
})

test('flashcards: all known ends in one round, German reply without "practise" part', async t => {
  const { container } = await render(t, { ...flash, lang: 'de', cards: flash.cards.slice(0, 2) })
  for (let i = 0; i < 2; i++) {
    await click(buttonByText(container, 'Antwort zeigen'))
    await click(buttonByText(container, '✓ Gewusst'))
  }
  assert.match(container.textContent, /Du hast alle gewusst/)
  await click(buttonByText(container, 'Ergebnis senden'))
  assert.equal(lastReply().line1, '✓ Karteikarten: 2 von 2 gewusst')
  assert.deepEqual([lastReply().json.known, lastReply().json.again, lastReply().json.rounds], [[0, 1], [], 1])
})

test('flashcards: "Start over" resets the progress', async t => {
  const { container } = await render(t, { ...flash, cards: flash.cards.slice(0, 1) })
  await click(buttonByText(container, 'Show answer'))
  await again(container)
  await click(buttonByText(container, 'Show answer'))
  await again(container)
  await click(buttonByText(container, 'Show answer'))
  await again(container)
  assert.ok(container.querySelector('.huic-fc-big'))
  await click(buttonByText(container, 'Start over'))
  assert.match(container.textContent, /Card 1 of 1/)
  assert.equal(faceText(container, 'front'), 'la casa')
})

test('flashcards: progress is saved as a draft and restored; a corrupt draft starts fresh', async t => {
  const { again: reopenCard, container: first } = await reopen(t, flash)
  let container = first
  await click(buttonByText(container, 'Show answer'))
  await knew(container)
  await click(buttonByText(container, 'Show answer'))
  await again(container)
  container = await reopenCard()
  assert.equal(faceText(container, 'front'), 'el gato')
  assert.match(container.textContent, /Card 3 of 4/)
  assert.match(container.textContent, /1 known/)
  assert.match(container.textContent, /1 to repeat/)
  const registration = registerPlugin()
  const result = toolResult(flash)
  const cardId = JSON.parse(result).card.cardId
  registration.storage.set(`card.sess-1\u0000${cardId}`, { draft: { queue: [0, 0], known: [9], again: [], round: 7 } })
  const fresh = await mount(result, { registration })
  t.after(fresh.unmount)
  assert.match(fresh.container.textContent, /Card 1 of 4/)
})

test('flashcards: shuffle changes the order, never the set', async t => {
  const cards = Array.from({ length: 30 }, (_, i) => ({ front: `F${i}`, back: `B${i}` }))
  const { container } = await render(t, { type: 'flashcards', title: 'Many', cards, shuffle: true })
  let seen = []
  for (let i = 0; i < 30; i++) {
    seen.push(faceText(container, 'front'))
    await click(buttonByText(container, 'Show answer'))
    await knew(container)
  }
  assert.equal(new Set(seen).size, 30)
  assert.notDeepEqual(seen, cards.map(c => c.front))
  await click(buttonByText(container, 'Send result'))
  assert.equal(lastReply().json.known.length, 30)
})

test('flashcards: finished deck is read-only when the chat cannot send; flip is accessible by name', async t => {
  const { container } = await render(t, { ...flash, cards: flash.cards.slice(0, 1) }, { sessionId: null })
  assert.match(cardEl(container).getAttribute('aria-label'), /^Front: la casa/)
  await click(buttonByText(container, 'Show answer'))
  await knew(container)
  assert.ok(container.querySelector('.huic-fc-big'))
  assert.equal(buttonByText(container, 'Send result'), undefined)
  assert.ok(container.querySelector('.huic-notice'))
})

test('validator reads explicit undefined fields as absent', async () => {
  const { mod } = await import('./dom.mjs')
  const out = mod.validateCard({ type: 'rank', title: 'Order', items: [{ label: 'A', detail: undefined }, { label: 'B' }], prompt: undefined })
  assert.deepEqual(out.errors, [])
  assert.equal('prompt' in out.card, false)
})
