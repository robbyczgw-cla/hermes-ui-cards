// A new tall card arrives at the end of the chat while the host follows that end, so only its last
// part is in view. Once it has settled, its top is brought into view, once. Key hints only show while
// the keyboard is in the card.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { act, mount, toolResult, registerPlugin, makeStorage, resetHost } from './dom.mjs'

beforeEach(resetHost)

const SETTLE_WAIT = 700 // > settle time (300 ms) plus polling
const wait = ms => act(() => new Promise(r => setTimeout(r, ms)))

const VIEW = { top: 0, bottom: 800, height: 800 }
let n = 0
function tallChecklist(id = `tall-${n++}`) {
  const items = Array.from({ length: 30 }, (_, i) => ({ id: `i${i}`, text: `Item ${i + 1}` }))
  return toolResult({ type: 'checklist', cardId: id, title: 'Packing list', items })
}

// jsdom has no layout: a chat scroller and a card with the given box (relative to the view).
function layout(container, { cardTop = -900, cardHeight = 1600, atEnd = true } = {}) {
  const scroller = document.createElement('div')
  scroller.style.overflowY = 'auto'
  document.body.appendChild(scroller)
  scroller.appendChild(container)
  const scrollHeight = 5000
  Object.defineProperty(scroller, 'scrollHeight', { value: scrollHeight, configurable: true })
  Object.defineProperty(scroller, 'clientHeight', { value: VIEW.height, configurable: true })
  scroller.scrollTop = atEnd ? scrollHeight - VIEW.height : 1000
  if (scroller.scrollTop !== (atEnd ? scrollHeight - VIEW.height : 1000)) {
    Object.defineProperty(scroller, 'scrollTop', { value: atEnd ? scrollHeight - VIEW.height : 1000, configurable: true, writable: true })
  }
  scroller.getBoundingClientRect = () => ({ ...VIEW, left: 0, right: 600, width: 600 })
  const card = container.querySelector('section.huic')
  card.getBoundingClientRect = () => ({ top: cardTop, bottom: cardTop + cardHeight, height: cardHeight, left: 0, right: 600, width: 600 })
  const calls = []
  card.scrollIntoView = opts => calls.push(opts)
  return { scroller, card, calls }
}

test('a new tall card at the chat end shows its top once it has settled', async () => {
  const m = await mount(tallChecklist())
  const { card, calls } = layout(m.container)
  await wait(SETTLE_WAIT)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].block, 'start')
  assert.equal(calls[0].behavior, 'smooth')
  assert.match(card.style.scrollMarginTop, /^\d+px$/)
  // Re-renders and more time do not scroll again.
  await m.rerender()
  await wait(SETTLE_WAIT)
  assert.equal(calls.length, 1)
  await m.unmount()
})

test("the top lands below the host's sticky prompt", async () => {
  const m = await mount(tallChecklist())
  const { scroller, card, calls } = layout(m.container)
  const sticky = document.createElement('div')
  sticky.style.position = 'sticky'
  sticky.getBoundingClientRect = () => ({ top: 10, bottom: 98, height: 88, left: 0, right: 600, width: 600 })
  scroller.prepend(sticky)
  const before = document.elementsFromPoint
  document.elementsFromPoint = (x, y) => (y < 98 ? [sticky, card] : [card])
  try {
    await wait(SETTLE_WAIT)
    assert.equal(calls.length, 1)
    assert.equal(card.style.scrollMarginTop, '110px') // 98 px covered + 12 px room
  } finally {
    document.elementsFromPoint = before
  }
  await m.unmount()
})

test('reduced motion: the reveal jumps instead of animating', async () => {
  const before = window.matchMedia
  window.matchMedia = q => ({ matches: /reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {} })
  try {
    const m = await mount(tallChecklist())
    const { calls } = layout(m.container)
    await wait(SETTLE_WAIT)
    assert.deepEqual(calls.map(c => c.behavior), ['auto'])
    await m.unmount()
  } finally {
    window.matchMedia = before
  }
})

test('a card seen before in this window is never revealed again (chat switched back)', async () => {
  const result = tallChecklist()
  const first = await mount(result)
  const a = layout(first.container)
  await wait(SETTLE_WAIT)
  assert.equal(a.calls.length, 1)
  await first.unmount()
  const again = await mount(result)
  const b = layout(again.container)
  await wait(SETTLE_WAIT)
  assert.equal(b.calls.length, 0)
  await again.unmount()
})

test('an answered card or one with work in progress is not revealed (reopened chat)', async () => {
  const storage = makeStorage()
  const registration = registerPlugin(storage)
  storage.set('answer.sess-1\u0000answered-tall', { mark: '✓', summary: 'Done', data: {}, at: 1 })
  storage.set('card.sess-1\u0000drafted-tall', { draft: { checked: ['i0'] } })
  for (const id of ['answered-tall', 'drafted-tall']) {
    const m = await mount(tallChecklist(id), { registration })
    const { calls } = layout(m.container)
    await wait(SETTLE_WAIT)
    assert.equal(calls.length, 0, id)
    await m.unmount()
  }
})

test('no reveal when the user scrolled away, scrolls meanwhile, or the card is short or not last', async () => {
  const cases = [
    ['scrolled up', { atEnd: false }],
    ['short card in view', { cardTop: 200, cardHeight: 400 }],
    ['more chat below the card', { cardTop: -900, cardHeight: 1300 }]
  ]
  for (const [name, box] of cases) {
    const m = await mount(tallChecklist())
    const { calls } = layout(m.container, box)
    await wait(SETTLE_WAIT)
    assert.equal(calls.length, 0, name)
    await m.unmount()
  }
  const m = await mount(tallChecklist())
  const { calls } = layout(m.container)
  await act(async () => { window.dispatchEvent(new window.Event('wheel')) })
  await wait(SETTLE_WAIT)
  assert.equal(calls.length, 0, 'wheel during settle')
  await m.unmount()
})

test('a card that keeps moving (text still streaming below) waits until it stands still', async () => {
  const m = await mount(tallChecklist())
  const { card, calls } = layout(m.container)
  let top = -900
  card.getBoundingClientRect = () => ({ top, bottom: top + 1600, height: 1600, left: 0, right: 600, width: 600 })
  for (let i = 0; i < 6; i++) {
    top -= 20
    await wait(120)
    assert.equal(calls.length, 0)
  }
  await wait(SETTLE_WAIT)
  assert.equal(calls.length, 1)
  await m.unmount()
})

test('key hints only show while focus is inside the card', async () => {
  const items = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' }]
  const m = await mount(toolResult({ type: 'choice', question: 'Pick', options: items }))
  const section = m.container.querySelector('section.huic')
  const keys = section.querySelector('.huic-keys')
  assert.ok(keys, 'the card has a key hint')
  const css = section.querySelector('style').textContent
  assert.match(css, /\.huic:not\(:focus-within\) \.huic-keys,\.huic:not\(:focus-within\) \.huic-keys-sep\{display:none\}/)
  const outside = document.createElement('button')
  document.body.appendChild(outside)
  outside.focus()
  // jsdom's computed style does not follow focus, so check the hiding rule's selector itself.
  const hidden = '.huic:not(:focus-within) .huic-keys'
  assert.equal(section.matches(':focus-within'), false)
  assert.equal(keys.matches(hidden), true)
  const option = section.querySelector('button')
  await act(async () => option.focus())
  assert.equal(section.matches(':focus-within'), true)
  assert.equal(keys.matches(hidden), false)
  await act(async () => outside.focus())
  assert.equal(keys.matches(hidden), true)
  outside.remove()
  await m.unmount()
})
