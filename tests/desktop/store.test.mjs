// Answers kept by the plugin's backend (ctx.rest → dashboard/plugin_api.py) and live display
// settings: a card answered elsewhere is locked here, a failing route changes nothing, a save in
// Settings → Plugins re-renders cards already on screen.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { act, buttonByText, click, host, lastReply, makeStorage, mod, mount, resetHost, testHost, toolResult } from './dom.mjs'

beforeEach(resetHost)

const CHOICE = { type: 'choice', question: 'Where to?', options: [{ label: 'Lisbon' }, { label: 'Berlin' }] }

function serverAnswer(cardId, extra = {}) {
  return {
    mark: '✓',
    summary: 'Chose: Lisbon',
    data: { card: cardId, type: 'choice', selected: ['o1'], labels: ['Lisbon'] },
    at: Date.now() - 1000,
    ...extra
  }
}

// A ctx like Hermes Desktop's: storage, register, ctx.rest and ctx.onEvent.
function registration({ rest, storage = makeStorage(), withEvents = true } = {}) {
  const contributions = []
  const listeners = new Map()
  const calls = []
  const ctx = {
    storage,
    register: c => {
      contributions.push(c)
      return () => {}
    },
    os: { writeClipboard: async () => true }
  }
  if (rest) {
    ctx.rest = async (path, opts) => {
      calls.push(path)
      return rest(path, opts)
    }
  }
  if (withEvents) {
    ctx.onEvent = (type, fn) => {
      listeners.set(type, fn)
      return () => listeners.delete(type)
    }
  }
  mod.default.register(ctx)
  const emit = async (type, payload) => {
    await act(async () => {
      listeners.get(type)?.({ type, session_id: '', payload })
      await settle()
    })
  }
  return { ctx, contributions, storage, calls, listeners, emit }
}

async function settle() {
  await mod.serverIdle()
  await new Promise(resolve => setTimeout(resolve, 0))
}

async function mountAndSettle(result, opts) {
  const view = await mount(result, opts)
  await act(async () => settle())
  return view
}

const query = path => Object.fromEntries(new URL(path, 'http://x').searchParams)

test('a card answered on another device is locked with its receipt', async () => {
  const result = toolResult(CHOICE)
  const cardId = JSON.parse(result).cardId
  const reg = registration({
    rest: path => (path.startsWith('/answers') ? { v: 1, answers: { [cardId]: serverAnswer(cardId) }, open: [] } : { v: 1, display: { compact: false, accent: 'app', undo: 4 } })
  })
  const { container, unmount } = await mountAndSettle(result, { registration: reg })
  const answers = reg.calls.filter(p => p.startsWith('/answers'))
  assert.equal(answers.length, 1)
  assert.deepEqual(query(answers[0]), { session: 'sess-1', cards: cardId })
  assert.match(container.querySelector('.huic-answer').textContent, /Chose: Lisbon/)
  assert.ok((buttonByText(container, 'Send')) === (undefined), 'no actions on an answered card')
  assert.equal(container.querySelector('[aria-checked="true"]')?.textContent.includes('Lisbon'), true, 'shows what was picked')
  const stored = reg.storage.get(`answer.sess-1\u0000${cardId}`, null)
  assert.equal(stored.source, 'server')
  await unmount()
  // Reopening the chat within a minute: locked from local storage, no second request.
  const again = await mountAndSettle(result, { registration: { ...reg, contributions: reg.contributions } })
  assert.match(again.container.querySelector('.huic-answer').textContent, /Chose: Lisbon/)
  assert.equal(reg.calls.filter(p => p.startsWith('/answers')).length, 1)
  await again.unmount()
})

test('cards of one chat are asked for in one batched request', async () => {
  const a = toolResult(CHOICE)
  const b = toolResult({ ...CHOICE, question: 'And then?' })
  const reg = registration({ rest: path => (path.startsWith('/answers') ? { answers: {}, open: [] } : {}) })
  const one = await mount(a, { registration: reg })
  const two = await mount(b, { registration: reg })
  await act(async () => settle())
  const answers = reg.calls.filter(p => p.startsWith('/answers'))
  assert.equal(answers.length, 1)
  assert.deepEqual(query(answers[0]).cards.split(','), [JSON.parse(a).cardId, JSON.parse(b).cardId])
  await one.unmount()
  await two.unmount()
})

test('a failing or missing route leaves the card working as before', async () => {
  for (const reg of [
    registration({ rest: () => Promise.reject(new Error('HTTP 404')) }),
    registration({ rest: () => { throw new Error('bridge unavailable') } }),
    registration({ rest: () => ({ nonsense: true }) }),
    registration({ rest: () => null }),
    registration({ withEvents: false }) // an older host: no ctx.rest, no ctx.onEvent
  ]) {
    resetHost()
    const { container, unmount } = await mountAndSettle(toolResult(CHOICE), { registration: reg })
    assert.ok((container.querySelector('.huic-answer')) === (null))
    await click(container.querySelector('[role="radio"]'))
    const send = buttonByText(container, 'Send')
    if (send) await click(send)
    assert.equal(testHost.submissions.length, 1, 'the click is still sent')
    assert.match(lastReply().line1, /Lisbon/)
    assert.ok(container.querySelector('.huic-answer'))
    await unmount()
  }
})

test('after a failure the route is not hammered', async () => {
  const reg = registration({ rest: () => Promise.reject(new Error('HTTP 501')) })
  const one = await mountAndSettle(toolResult(CHOICE), { registration: reg })
  const two = await mountAndSettle(toolResult({ ...CHOICE, question: 'Next?' }), { registration: reg })
  assert.equal(reg.calls.filter(p => p.startsWith('/answers')).length, 1)
  await one.unmount()
  await two.unmount()
})

test('the live answer event makes cards on screen ask their own route', async () => {
  // The event carries no answer (it may reach other profiles' windows): it only makes the cards
  // on screen ask this window's route again, which then knows the answer.
  const result = toolResult(CHOICE)
  const cardId = JSON.parse(result).cardId
  let known = false
  const reg = registration({ rest: path => (path.startsWith('/answers') ? (known ? { answers: { [cardId]: serverAnswer(cardId) }, open: [] } : { answers: {}, open: [cardId] }) : {}) })
  const { container, unmount } = await mountAndSettle(result, { registration: reg })
  assert.ok(container.querySelector('.huic-answer') === null)
  await reg.emit('plugin.hermes-ui-cards.answers.changed', { card: cardId, answer: serverAnswer(cardId) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)); await settle() })
  assert.ok(container.querySelector('.huic-answer') === null, 'an answer inside the event itself is never trusted')
  known = true
  await reg.emit('plugin.hermes-ui-cards.answers.changed', {})
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 320)); await settle() })
  assert.match(container.querySelector('.huic-answer')?.textContent ?? '', /Chose: Lisbon/)
  await unmount()
})

test('server data that does not fit the card is ignored', async () => {
  const result = toolResult(CHOICE)
  const cardId = JSON.parse(result).cardId
  const bad = [
    serverAnswer(cardId, { data: { card: cardId, type: 'checklist', done_ids: [] } }), // wrong type
    serverAnswer(cardId, { data: { card: 'other-1', type: 'choice', selected: ['o1'] } }), // wrong card
    serverAnswer(cardId, { data: { card: cardId, type: 'choice', selected: [{ evil: 1 }] } }), // wrong shape
    serverAnswer(cardId, { data: { card: cardId, type: 'choice' } }), // required field missing
    serverAnswer(cardId, { data: [1, 2] }),
    'junk'
  ]
  for (const answer of bad) {
    const reg = registration({ rest: path => (path.startsWith('/answers') ? { answers: { [cardId]: answer }, open: [] } : {}) })
    const { container, unmount } = await mountAndSettle(result, { registration: reg })
    assert.ok((container.querySelector('.huic-answer')) === (null), JSON.stringify(answer))
    await unmount()
  }
})

test('a hostile receipt is clipped and its mark checked', async () => {
  const result = toolResult(CHOICE)
  const cardId = JSON.parse(result).cardId
  const answer = serverAnswer(cardId, { mark: '<img src=x>', summary: '<b>bold</b> ' + 'x'.repeat(400) })
  const reg = registration({ rest: path => (path.startsWith('/answers') ? { answers: { [cardId]: answer }, open: [] } : {}) })
  const { container, unmount } = await mountAndSettle(result, { registration: reg })
  const bar = container.querySelector('.huic-answer')
  assert.ok(bar, 'locked')
  assert.ok((bar.querySelector('img')) === (null))
  assert.ok((bar.querySelector('b')) === (null), 'no markup from the receipt')
  assert.ok(!bar.textContent.includes('<img'), 'an unknown mark is replaced by ✓')
  assert.ok(bar.textContent.includes('<b>bold</b>'), 'shown as text, not markup')
  assert.ok(reg.storage.get(`answer.sess-1\u0000${cardId}`, null).summary.length <= 300)
  await unmount()
})

test('this window keeps its own receipt when the server has another answer', async () => {
  const result = toolResult(CHOICE)
  const cardId = JSON.parse(result).cardId
  const storage = makeStorage()
  const local = { mark: '✓', summary: 'Chose: Berlin', data: { card: cardId, type: 'choice', selected: ['o2'], labels: ['Berlin'] }, at: Date.now() }
  storage.set(`answer.sess-1\u0000${cardId}`, local)
  const reg = registration({ storage, rest: path => (path.startsWith('/answers') ? { answers: { [cardId]: serverAnswer(cardId) }, open: [] } : {}) })
  const { container, unmount } = await mountAndSettle(result, { registration: reg })
  assert.match(container.querySelector('.huic-answer').textContent, /Chose: Berlin/)
  await unmount()
})

test('a receipt this window holds is never removed by the server, however old', async () => {
  // The server not knowing an answer proves nothing about its delivery (review 4, finding 4).
  const result = toolResult(CHOICE)
  const cardId = JSON.parse(result).cardId
  const key = `answer.sess-1\u0000${cardId}`
  const local = at => ({ mark: '✓', summary: 'Chose: Berlin', data: { card: cardId, type: 'choice', selected: ['o2'], labels: ['Berlin'] }, at })

  const fresh = makeStorage()
  fresh.set(key, local(Date.now() - 60 * 1000))
  let reg = registration({ storage: fresh, rest: () => ({ answers: {}, open: [cardId] }) })
  let view = await mountAndSettle(result, { registration: reg })
  assert.ok(view.container.querySelector('.huic-answer'), 'recent click: still locked (the turn may not have started yet)')
  await view.unmount()

  const unknown = makeStorage()
  unknown.set(key, local(Date.now() - 60 * 60 * 1000))
  reg = registration({ storage: unknown, rest: () => ({ answers: {}, open: [] }) })
  view = await mountAndSettle(result, { registration: reg })
  assert.ok(view.container.querySelector('.huic-answer'), 'server does not know the card: local wins')
  await view.unmount()

  const lost = makeStorage()
  lost.set(key, local(Date.now() - 60 * 60 * 1000))
  lost.set('answerIndex', [`sess-1\u0000${cardId}`])
  reg = registration({ storage: lost, rest: () => ({ answers: {}, open: [cardId] }) })
  view = await mountAndSettle(result, { registration: reg })
  assert.ok(view.container.querySelector('.huic-answer') !== null, 'shown, never answered on the server: still locked here')
  assert.ok(lost.get(key, null) !== null, 'the local receipt is kept')
  await view.unmount()
})

test('a settings save re-renders cards on screen', async () => {
  let display = { compact: false, accent: 'app', undo: 4 }
  const reg = registration({ rest: path => (path === '/settings' ? { v: 1, display } : { answers: {}, open: [] }) })
  const { container, unmount } = await mountAndSettle(toolResult(CHOICE), { registration: reg })
  assert.ok(reg.calls.includes('/settings'), 'read once when the first card shows')
  const section = () => container.querySelector('section.huic')
  assert.equal(section().classList.contains('huic-compact'), false)
  const before = section().style.getPropertyValue('--huic-accent')
  assert.equal(mod.undoDelayMs(), 4000)

  display = { compact: true, accent: 'purple', undo: 8 }
  await reg.emit('plugin.hermes-ui-cards.settings.changed', { written: ['compact', 'accent', 'undo_seconds'] })
  assert.equal(section().classList.contains('huic-compact'), true)
  assert.notEqual(section().style.getPropertyValue('--huic-accent'), before)
  assert.equal(mod.undoDelayMs(), 8000)

  display = { compact: 'yes', accent: 'neon', undo: 5 } // garbage from a broken backend
  await reg.emit('plugin.hermes-ui-cards.settings.changed', { written: [] })
  assert.equal(section().classList.contains('huic-compact'), false)
  assert.equal(section().style.getPropertyValue('--huic-accent'), before)
  assert.equal(mod.undoDelayMs(), 4000)
  await unmount()
})

test('without the route a settings save is read from the plugin list', async () => {
  const original = host.request
  host.request = async (method, params) => {
    assert.equal(method, 'plugins.manage')
    assert.deepEqual(params, { action: 'list' })
    return {
      plugins: [
        { key: 'other', settings_schema: [{ key: 'compact', value: false }] },
        { key: 'hermes-ui-cards', settings_schema: [{ key: 'compact', value: true }, { key: 'accent', value: 'green' }, { key: 'undo_seconds', value: '0' }] }
      ]
    }
  }
  try {
    const reg = registration({ rest: () => Promise.reject(new Error('HTTP 404')) })
    const { container, unmount } = await mountAndSettle(toolResult(CHOICE), { registration: reg })
    assert.equal(container.querySelector('section.huic').classList.contains('huic-compact'), false, 'no list call on start')
    await reg.emit('plugin.hermes-ui-cards.settings.changed', { written: ['compact'] })
    assert.equal(container.querySelector('section.huic').classList.contains('huic-compact'), true)
    assert.equal(mod.undoDelayMs(), 0)
    await unmount()
  } finally {
    host.request = original
  }
})

test('undo delay comes from the tool result until the backend has been read', async () => {
  const reg = registration({ withEvents: false })
  const { unmount } = await mountAndSettle(toolResult(CHOICE, { display: { compact: false, accent: 'app', undo: 0 } }), { registration: reg })
  assert.equal(mod.undoDelayMs(), 0)
  assert.equal(mod.undoDelayMs({ undo: 8 }), 8000)
  await unmount()
})
