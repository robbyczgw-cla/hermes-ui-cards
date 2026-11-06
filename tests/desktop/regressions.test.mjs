import assert from 'node:assert/strict'
import { beforeEach, test, mock } from 'node:test'
import { atom } from '@hermes/plugin-sdk'
import { host, mod, mount, toolResult, registerPlugin, makeStorage, click, type, buttonByText, lastReply, resetHost, testHost, key } from './dom.mjs'

beforeEach(resetHost)
const React = await import('react')
const { StrictMode, act } = React
const { createRoot } = await import('react-dom/client')
const resultCard = raw => JSON.parse(toolResult(raw)).card
const cp = s => [...s].length

test('schedule answers drop a slot label that only repeats the time', () => {
  const card = resultCard({ type: 'schedule', slots: [{ id: 's1', start: '2026-11-06T20:30', end: '2026-11-06T21:30', label: '20:30 - 21:30' }, { id: 's2', start: '2026-11-06T18:30', label: 'After grooming' }] })
  assert.equal(mod.buildReply(card, { selected: ['s1'] }, 'en').summary, 'Works for me: Fri 6 Nov, 20:30–21:30')
  assert.equal(mod.buildReply(card, { selected: ['s2'] }, 'en').summary, 'Works for me: Fri 6 Nov, 18:30 (After grooming)')
})

test('schedule answers keep the card zone: UTC too, and whole even when the summary is clipped', () => {
  const utc = resultCard({ type: 'schedule', timezone: 'UTC', slots: [{ id: 's1', start: '2026-11-12T14:00' }] })
  assert.equal(mod.buildReply(utc, { selected: ['s1'] }, 'en').summary, 'Works for me: Thu 12 Nov, 14:00 · UTC')
  const slots = Array.from({ length: 20 }, (_, i) => ({ id: `s${i}`, start: '2026-11-12T14:00', end: '2026-11-12T15:00', label: 'L'.repeat(80) }))
  const big = resultCard({ type: 'schedule', multiple: true, timezone: 'Europe/Vienna', slots })
  const reply = mod.buildReply(big, { selected: slots.map(s => s.id) }, 'en')
  assert.ok(reply.summary.endsWith(' · Vienna time'), reply.summary.slice(-40))
  assert.ok(reply.summary.includes('…'), 'the slot list was shortened, not the zone')
  assert.equal(reply.fits, true)
  assert.ok(cp(reply.text) <= 4000)
})

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


// The host's focused session view, as Hermes Desktop shows it: the primary view's runtime id
// (host.state.focusedSessionId) and stored id (host.state.focusedStoredSessionId) — the same atoms
// the transcript's tool-media slot reads to pass `sessionId` (stored id || runtime id).
function focusView(runtimeId, storedId) {
  host.state.focusedSessionId.set(runtimeId)
  host.state.focusedStoredSessionId.set(storedId)
}

function withHostAtoms(fn) {
  return async () => {
    const saved = { ...host.state }
    host.state.focusedSessionId = atom('sess-1')
    host.state.focusedStoredSessionId = atom(null)
    host.state.profile = atom('default')
    host.state.connectionId = atom('local')
    try {
      await fn()
    } finally {
      for (const name of Object.keys(host.state)) if (!(name in saved)) delete host.state[name]
      Object.assign(host.state, saved)
    }
  }
}

const RATING = { type: 'rating', question: 'How useful?', comment: true }
const stars = c => [...c.querySelectorAll('[role="radio"]')]
const checkedStar = c => stars(c).findIndex(s => s.getAttribute('aria-checked') === 'true')
const storedKeys = (storage, part) => [...storage.map.keys()].filter(k => k.includes(part))

test('a card keeps what the user did when its chat id changes from the runtime id to the stored id', withHostAtoms(async () => {
  const storage = makeStorage()
  const registration = registerPlugin(storage)
  const result = toolResult(RATING)
  focusView('runtime-1', null) // a new chat: no stored id yet
  const { container, rerender, unmount } = await mount(result, { registration, sessionId: 'runtime-1' })
  await click(container.querySelectorAll('[role="radio"]')[3])
  await type(container.querySelector('textarea'), 'Very clear')
  focusView('runtime-1', '20261105_stored') // the host stores the chat; the slot re-renders
  await rerender({ sessionId: '20261105_stored' })
  assert.ok(container.querySelectorAll('[role="radio"]')[3].getAttribute('aria-checked') === 'true', 'the picked star survives the id change')
  assert.ok(container.querySelector('textarea').value === 'Very clear')
  assert.ok(buttonByText(container, 'Send').disabled === false)
  await click(buttonByText(container, 'Send'))
  assert.ok(testHost.submissions.at(-1).sessionId === '20261105_stored', 'sent into the chat under its new id')
  await unmount()
  const again = await mount(result, { registration, sessionId: '20261105_stored' })
  assert.match(again.container.textContent, /Your answer/, 'the receipt is kept under the stored id')
  await again.unmount()
}))

test('a draft made under the runtime id is still there when the chat is reopened by its stored id', withHostAtoms(async () => {
  const registration = registerPlugin(makeStorage())
  const result = toolResult(RATING)
  focusView('runtime-2', null)
  const view = await mount(result, { registration, sessionId: 'runtime-2' })
  await click(stars(view.container)[1])
  focusView('runtime-2', '20261105_two')
  await view.rerender({ sessionId: '20261105_two' })
  await view.unmount()
  const again = await mount(result, { registration, sessionId: '20261105_two' })
  assert.ok(checkedStar(again.container) === 1, 'the draft moved with the confirmed id change')
  await again.unmount()
}))

// Review 5, ba61671 regression: the same mounted card moving to ANOTHER chat (a branch made before
// the trunk answered: both histories hold the same tool result) must not take the trunk's state.
test('a branch never inherits the trunk answer through a reused card', withHostAtoms(async () => {
  const storage = makeStorage()
  const registration = registerPlugin(storage)
  const result = toolResult(RATING)
  focusView('rt-trunk', 'trunk')
  const view = await mount(result, { registration, sessionId: 'trunk' })
  await click(stars(view.container)[2])
  await click(buttonByText(view.container, 'Send'))
  assert.match(view.container.textContent, /Your answer/)
  focusView('rt-branch', 'branch') // the user opened the branch; the host reuses the renderer
  await view.rerender({ sessionId: 'branch' })
  assert.ok(view.container.querySelector('.huic-answer') === null, 'the branch card is not answered')
  assert.ok(checkedStar(view.container) === -1, 'nothing picked in the branch')
  assert.ok(storedKeys(storage, 'branch').length === 0, 'nothing copied to the branch keys')
  await click(stars(view.container)[0])
  await click(buttonByText(view.container, 'Send'))
  assert.ok(lastReply().sessionId === 'branch' && lastReply().json.value === 1, 'the branch answers on its own')
  await view.unmount()
}))

test('a branch never inherits the trunk draft or private comment through a reused card', withHostAtoms(async () => {
  const storage = makeStorage()
  const registration = registerPlugin(storage)
  focusView('rt-trunk', 'trunk')
  const view = await mount(toolResult(RATING), { registration, sessionId: 'trunk' })
  await click(stars(view.container)[4])
  await type(view.container.querySelector('textarea'), 'Private A draft')
  focusView('rt-branch', 'branch')
  await view.rerender({ sessionId: 'branch' })
  assert.ok(checkedStar(view.container) === -1, 'no picked star in the branch, not even in memory')
  assert.ok(view.container.querySelector('textarea').value === '', 'the private comment stays in the trunk')
  assert.ok(storedKeys(storage, 'branch').length === 0)
  assert.ok(!JSON.stringify([...storage.map.entries()].filter(([k]) => !k.includes('trunk'))).includes('Private A draft'))
  focusView('rt-trunk', 'trunk')
  await view.rerender({ sessionId: 'trunk' })
  assert.ok(checkedStar(view.container) === 4 && view.container.querySelector('textarea').value === 'Private A draft', 'the trunk keeps its own draft')
  await view.unmount()
}))

test('an id change the host does not show as runtime → stored starts the card afresh', withHostAtoms(async () => {
  for (const [label, setup] of [
    ['focused view has another stored id', () => focusView('runtime-3', 'some-other-chat')],
    ['focused view has another runtime id', () => focusView('runtime-x', '20261105_three')],
    ['a host without the atoms', () => { delete host.state.focusedStoredSessionId }]
  ]) {
    host.state.focusedStoredSessionId = atom(null)
    const storage = makeStorage()
    const registration = registerPlugin(storage)
    focusView('runtime-3', null)
    const view = await mount(toolResult(RATING), { registration, sessionId: 'runtime-3' })
    await click(stars(view.container)[3])
    setup()
    await view.rerender({ sessionId: '20261105_three' })
    assert.ok(checkedStar(view.container) === -1, label)
    assert.ok(storedKeys(storage, '20261105_three').length === 0, label)
    await view.unmount()
  }
}))

test('a profile or source switch starts a mounted card afresh and keeps each owner apart', withHostAtoms(async () => {
  const storage = makeStorage()
  const registration = registerPlugin(storage)
  const result = toolResult(RATING)
  const view = await mount(result, { registration, sessionId: 'copied-chat' })
  await click(stars(view.container)[2])
  await click(buttonByText(view.container, 'Send'))
  assert.match(view.container.textContent, /Your answer/)
  for (const [name, value] of [['profile', 'work'], ['connectionId', 'ssh-box']]) {
    await act(async () => host.state[name].set(value))
    await view.rerender()
    assert.ok(view.container.querySelector('.huic-answer') === null, `${name}: the other owner's receipt is not shown`)
    assert.ok(checkedStar(view.container) === -1, `${name}: nothing picked`)
  }
  await view.unmount()
  host.state.profile.set('default')
  host.state.connectionId.set('local')
  const back = await mount(result, { registration, sessionId: 'copied-chat' })
  assert.match(back.container.textContent, /Your answer/, 'the first owner still has its receipt')
  await back.unmount()
}))

async function pendingIdMove(card, begin, actionLabel) {
  const registration = registerPlugin(makeStorage())
  const result = toolResult(card, { display: { undo: 4 } })
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    focusView('runtime-undo', null)
    const m = await mount(result, { registration, sessionId: 'runtime-undo' })
    await begin(m.container)
    focusView('runtime-undo', 'stored-undo')
    await m.rerender({ sessionId: 'stored-undo' })
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 1)
    assert.equal(testHost.submissions[0].sessionId, 'stored-undo')
    assert.ok(Boolean(m.container.querySelector('.huic-answer')), 'receipt is visible')
    assert.ok(!buttonByText(m.container, actionLabel), 'action is locked')
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 1)
    await m.unmount()
  } finally { mock.timers.reset() }
}

test('compare pending pick follows a confirmed chat id move', withHostAtoms(async () => {
  await pendingIdMove({ type: 'compare', columns: [{ title: 'A' }, { title: 'B' }] }, c => click(c.querySelector('button[aria-label="Choose: A"]')), 'Choose')
}))
test('confirm pending approval follows a confirmed chat id move', withHostAtoms(async () => {
  await pendingIdMove({ type: 'confirm', title: 'Proceed?', action: 'Proceed', risk: { level: 'high', text: 'Risk' } }, c => click(buttonByText(c, 'Yes, go ahead')), 'Yes, go ahead')
}))
test('plan pending run follows a confirmed chat id move', withHostAtoms(async () => {
  await pendingIdMove({ type: 'plan', title: 'Plan', steps: [{ title: 'One' }] }, c => click(buttonByText(c, 'Run plan')), 'Run plan')
}))
test('review pending apply follows a confirmed chat id move', withHostAtoms(async () => {
  await pendingIdMove({ type: 'review', title: 'Review', defaultDecision: 'keep', items: [{ title: 'One' }] }, c => click(buttonByText(c, 'Apply')), 'Apply')
}))
