import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { mod, mount, toolResult, registerPlugin, makeStorage, click, type, buttonByText, lastReply, resetHost, testHost, key } from './dom.mjs'

beforeEach(resetHost)
const React = await import('react')
const { StrictMode, act } = React
const { createRoot } = await import('react-dom/client')
const resultCard = raw => JSON.parse(toolResult(raw)).card
const cp = s => [...s].length

test('maximum-size replies preserve JSON, or are explicitly rejected when the payload cannot fit', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: `i${i}`, text: `${i}`.padEnd(300, 'x') }))
  const fields = Array.from({ length: 12 }, (_, i) => ({ name: `f${i}`, label: 'L'.repeat(80), kind: 'textarea', maxLength: 2000 }))
  const slots = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, start: '2026-11-12T14:00', end: '2026-11-12T15:00', label: 'L'.repeat(80) }))
  const questions = Array.from({ length: 10 }, () => ({ question: 'Q'.repeat(300), options: Array(6).fill('O'.repeat(80)), answer: 5 }))
  const cases = [
    [{ type: 'choice', question: 'Q'.repeat(300), multiple: true, allowOther: true, options: Array.from({ length: 6 }, (_, i) => ({ id: `o${i}`, label: 'L'.repeat(80) })) }, { selected: Array.from({ length: 6 }, (_, i) => `o${i}`), other: '😀'.repeat(300) }],
    [{ type: 'checklist', items }, { checked: items.slice(0, 25).map(i => i.id) }],
    [{ type: 'compare', columns: [{ id: 'c1', title: 'A'.repeat(80) }, { id: 'c2', title: 'B'.repeat(80) }] }, { selected: 'c1' }],
    [{ type: 'form', fields }, { values: Object.fromEntries(fields.map(f => [f.name, '😀'.repeat(1000)])) }],
    [{ type: 'confirm', title: 'T'.repeat(80), action: 'A'.repeat(300) }, { decision: 'change', change: '😀'.repeat(1000) }],
    [{ type: 'rating', question: 'Q'.repeat(300), scale: 10, comment: true }, { value: 10, comment: '😀'.repeat(1000) }],
    [{ type: 'slider', question: 'Q'.repeat(300), min: 0, max: 100, unit: 'U'.repeat(12) }, { value: 100 }],
    [{ type: 'schedule', multiple: true, slots }, { selected: slots.map(s => s.id) }],
    [{ type: 'steps', steps: Array.from({ length: 12 }, () => ({ title: 'T'.repeat(80) })) }, { stuck: 12 }],
    [{ type: 'quiz', questions }, { chosen: Array(10).fill(5) }]
  ]
  for (const [raw, answer] of cases) {
    const card = resultCard(raw)
    const reply = mod.buildReply(card, answer, 'en')
    const parsed = JSON.parse(reply.text.split('\n')[1].slice('[hui-card] '.length))
    assert.deepEqual(parsed, reply.data, card.type)
    assert.equal(reply.fits, cp(reply.text) <= 4000, card.type)
    if (card.type === 'form') {
      assert.equal(reply.fits, false)
      assert.deepEqual(parsed.values, answer.values)
    } else {
      assert.equal(reply.fits, true, card.type)
    }
    if (card.type === 'checklist') {
      assert.deepEqual(parsed.done_ids, answer.checked)
      assert.equal(parsed.done, undefined)
      assert.equal(parsed.done_count, 25)
      assert.equal(parsed.open_count, 25)
    }
  }
})

test('duplicate checklist text and simultaneous mounts preserve the selected IDs after sending', async () => {
  const result = toolResult({ type: 'checklist', items: [{ text: 'Same' }, { text: 'Same' }] })
  const registration = registerPlugin(makeStorage())
  const a = await mount(result, { registration }), b = await mount(result, { registration })
  await click(a.container.querySelector('input'))
  await click(buttonByText(a.container, 'Done'))
  assert.deepEqual([...b.container.querySelectorAll('input')].map(x => x.checked), [true, false])
  await a.unmount(); await b.unmount()
  const again = await mount(result, { registration })
  assert.deepEqual([...again.container.querySelectorAll('input')].map(x => x.checked), [true, false])
  assert.equal(lastReply().json.done_ids[0], 'i1')
  await again.unmount()
})

test('draft eviction retains the answered tombstone', async () => {
  const storage = makeStorage(), registration = registerPlugin(storage)
  const result = toolResult({ type: 'confirm', title: 'Proceed?', action: 'Proceed' })
  let m = await mount(result, { registration })
  await click(buttonByText(m.container, 'Yes, go ahead'))
  const id = JSON.parse(result).card.cardId
  await m.unmount()
  const storedKey = `sess-1\u0000${id}`
  const ids = [storedKey, ...Array.from({ length: 299 }, (_, i) => `filler${i}`)]
  storage.set('index', ids)
  const other = await mount(toolResult({ type: 'checklist', items: [{ text: 'Other' }] }), { registration })
  await click(other.container.querySelector('input'))
  assert.equal(storage.get(`card.${storedKey}`, null), null)
  await other.unmount()
  m = await mount(result, { registration })
  assert.match(m.container.textContent, /Your answer/)
  assert.ok((buttonByText(m.container, 'Yes, go ahead')) === (undefined))
  await m.unmount()
})

test('oversized form stays editable and does not send or mutate values', async () => {
  const fields = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}`, label: `Field ${i}`, kind: 'textarea', maxLength: 2000 }))
  const m = await mount(toolResult({ type: 'form', fields }))
  const inputs = [...m.container.querySelectorAll('textarea')]
  for (const input of inputs) await type(input, '😀'.repeat(1000))
  assert.equal(buttonByText(m.container, 'Submit').disabled, false)
  await click(buttonByText(m.container, 'Submit'))
  assert.equal(testHost.submissions.length, 0)
  assert.match(m.container.textContent, /Shorten this field/)
  assert.match(m.container.textContent, /characters left/)
  assert.equal(cp(inputs[0].value), 1000)
  await type(inputs[0], 'short')
  await type(inputs[1], 'short')
  assert.equal(buttonByText(m.container, 'Submit').disabled, false)
  await click(buttonByText(m.container, 'Submit'))
  assert.equal(lastReply().json.values.f0, 'short')
  assert.equal(lastReply().json.values.f4, '😀'.repeat(1000))
  await m.unmount()
})

test('naive schedule times remain wall-clock times in a DST gap', async () => {
  const old = process.env.TZ
  process.env.TZ = 'Europe/Vienna'
  try {
    const card = resultCard({ type: 'schedule', timezone: 'Europe/Vienna', slots: [{ start: '2026-03-29T02:30' }] })
    assert.match(mod.formatSlot(card.slots[0], card, 'en'), /02:30/)
    const m = await mount(JSON.stringify({ card }))
    assert.match(m.container.querySelector('[role="radio"]').textContent, /02:30/)
    await m.unmount()
  } finally { if (old === undefined) delete process.env.TZ; else process.env.TZ = old }
})

test('sending and cancelling a change preserve keyboard focus', async () => {
  const m = await mount(toolResult({ type: 'confirm', title: 'Proceed?', action: 'Proceed' }))
  await click(buttonByText(m.container, 'Change…'))
  await key(m.container.querySelector('textarea'), 'Escape')
  assert.ok((document.activeElement) === (buttonByText(m.container, 'Change…')))
  await click(buttonByText(m.container, 'Yes, go ahead'))
  assert.ok((document.activeElement) === (m.container.querySelector('.huic-answer')))
  await m.unmount()
})

test('drafts and answers are isolated by session, including inactive views', async () => {
  const storage = makeStorage(), registration = registerPlugin(storage)
  const result = toolResult({ type: 'form', fields: [{ name: 'bio', label: 'Bio', kind: 'text' }] })
  const a = await mount(result, { registration, sessionId: 'branch-a' })
  const same = await mount(result, { registration, sessionId: 'branch-a' })
  const b = await mount(result, { registration, sessionId: 'branch-b' })
  const inactive = await mount(result, { registration, sessionId: null })
  await type(a.container.querySelector('input'), 'draft A')
  assert.equal(same.container.querySelector('input').value, 'draft A')
  assert.equal(b.container.querySelector('input').value, '')
  assert.equal(inactive.container.querySelector('input').value, '')
  const size = storage.map.size
  await type(inactive.container.querySelector('input'), 'inactive')
  assert.equal(storage.map.size, size)
  await click(buttonByText(a.container, 'Submit'))
  assert.match(same.container.textContent, /Your answer/)
  assert.equal(b.container.querySelector('input').disabled, false)
  assert.equal(inactive.container.querySelector('input').disabled, false)
  await type(b.container.querySelector('input'), 'draft B')
  await click(buttonByText(b.container, 'Submit'))
  assert.equal(lastReply().sessionId, 'branch-b')
  await a.unmount(); await same.unmount(); await b.unmount(); await inactive.unmount()
})

test('German form budget counts the serialized reply and flags oversized fields', async () => {
  const fields = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}`, label: `Feld ${i}`, kind: 'textarea' }))
  const m = await mount(toolResult({ type: 'form', lang: 'de', fields }))
  const inputs = [...m.container.querySelectorAll('textarea')]
  for (const input of inputs.slice(0, 4)) await type(input, '"'.repeat(500))
  assert.match(m.container.textContent, /Noch .* Zeichen/)
  assert.match(m.container.textContent, /Bitte kürzen/)
  assert.equal(buttonByText(m.container, 'Absenden').disabled, false)
  await click(buttonByText(m.container, 'Absenden'))
  assert.equal(testHost.submissions.length, 0)
  await type(inputs[0], 'kurz')
  assert.equal(buttonByText(m.container, 'Absenden').disabled, false)
  await m.unmount()
})

test('form enforces its code point limit and synchronizes an open second view', async () => {
  const result = toolResult({ type: 'form', fields: [{ name: 'bio', label: 'Bio', kind: 'textarea', maxLength: 2000 }] })
  const registration = registerPlugin(makeStorage())
  const a = await mount(result, { registration }), b = await mount(result, { registration })
  await type(a.container.querySelector('textarea'), '😀'.repeat(1200))
  assert.equal(cp(a.container.querySelector('textarea').value), 1000)
  assert.equal(cp(b.container.querySelector('textarea').value), 1000)
  await click(buttonByText(a.container, 'Submit'))
  assert.equal(cp(b.container.querySelector('textarea').value), 1000)
  assert.equal(b.container.querySelector('textarea').disabled, true)
  await a.unmount(); await b.unmount()
})


test('Strict Mode permits only one submit on a rapid repeated click', async () => {
  const registration = registerPlugin(makeStorage())
  const renderer = registration.contributions.find(c => c.area === 'transcript.toolMedia')
  const result = toolResult({ type: 'confirm', title: 'Once?', action: 'Continue' })
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(React.createElement(StrictMode, null, renderer.data.render({ result, sessionId: 'sess-1', fallback: null }))))
  const button = buttonByText(container, 'Yes, go ahead')
  await act(async () => {
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    button.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
  assert.equal(testHost.submissions.length, 1)
  await act(async () => root.unmount())
  container.remove()
})


test('a card keeps what the user did when its chat id changes from the runtime id to the stored id', async () => {
  const { container, rerender, unmount } = await mount(toolResult({ type: 'rating', question: 'How useful?', comment: true }), { sessionId: 'runtime-1' })
  await click(container.querySelectorAll('[role="radio"]')[3])
  await type(container.querySelector('textarea'), 'Very clear')
  await rerender({ sessionId: '20261105_stored' })
  assert.ok(container.querySelectorAll('[role="radio"]')[3].getAttribute('aria-checked') === 'true', 'the picked star survives the id change')
  assert.ok(container.querySelector('textarea').value === 'Very clear')
  assert.ok(buttonByText(container, 'Send').disabled === false)
  await click(buttonByText(container, 'Send'))
  assert.ok(testHost.submissions.at(-1).sessionId === '20261105_stored', 'sent into the chat under its new id')
  await unmount()
})
