// Answers kept by the plugin's backend (ctx.rest → dashboard/plugin_api.py) and live display
// settings: a card answered elsewhere is locked here, a failing route changes nothing, a save in
// Settings → Plugins re-renders cards already on screen.
import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { atom } from '@hermes/plugin-sdk'
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
function registration({ rest, storage = makeStorage(), withEvents = true, timers } = {}) {
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
  if (timers) ctx.setTimeout = timers.setTimeout
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

// ── Review 5 #9: the first lookup gates the actions until it settles ──

// ctx.setTimeout that only records: a test fires the callbacks due by a simulated time.
function manualTimers() {
  const pending = []
  return {
    pending,
    setTimeout: (fn, ms) => {
      const entry = { fn, ms, done: false }
      pending.push(entry)
      return () => { entry.done = true }
    },
    // Simulate `ms` passing: Date.now moves on and the callbacks due by then run.
    async advance(ms) {
      const real = Date.now
      const offset = (Date.now() - real.call(Date)) + ms
      Date.now = () => real.call(Date) + offset
      try {
        await act(async () => {
          for (const entry of pending.filter(e => !e.done && e.ms <= ms)) {
            entry.done = true
            entry.fn()
          }
        })
      } finally {
        Date.now = real
      }
    }
  }
}

// A /answers route whose replies the test releases by hand.
function heldRoute() {
  const held = []
  return {
    held,
    rest: path => (path.startsWith('/answers') ? new Promise(resolve => held.push(resolve)) : {}),
    async release(reply) {
      await act(async () => {
        for (const resolve of held.splice(0)) resolve(reply)
        await settle()
      })
    }
  }
}

const RATE = { type: 'rating', question: 'Useful?' }
const rateAnswer = cardId => ({ mark: '✓', summary: 'Rated 4/5', data: { card: cardId, type: 'rating', value: 4 }, at: Date.now() - 5000 })

test('a slow lookup keeps the actions back until it answers, then the card is locked', async () => {
  const result = toolResult(RATE)
  const cardId = JSON.parse(result).cardId
  const timers = manualTimers()
  const route = heldRoute()
  const reg = registration({ rest: route.rest, timers })
  const view = await mount(result, { registration: reg })
  await act(async () => new Promise(resolve => setTimeout(resolve, 40))) // the batched request leaves
  assert.equal(route.held.length, 1, 'the lookup is in flight')
  await timers.advance(3000) // past the old 2.5 s gate, well inside the 8 s request timeout
  assert.ok(buttonByText(view.container, 'Send') === undefined, 'still no actions while the request runs')
  await route.release({ answers: { [cardId]: rateAnswer(cardId) }, open: [] })
  assert.match(view.container.querySelector('.huic-answer')?.textContent ?? '', /Rated 4\/5/)
  assert.equal(testHost.submissions.length, 0, 'no second answer was sent')
  await view.unmount()
})

test('a lookup that never answers ends at its timeout with an explicit notice and a re-check', async () => {
  const result = toolResult(RATE)
  const cardId = JSON.parse(result).cardId
  const timers = manualTimers()
  const route = heldRoute()
  const reg = registration({ rest: route.rest, timers })
  const view = await mount(result, { registration: reg })
  await act(async () => new Promise(resolve => setTimeout(resolve, 40)))
  await timers.advance(8000)
  assert.ok(buttonByText(view.container, 'Send') === undefined, 'the gate holds up to the request timeout')
  await timers.advance(9600)
  const notice = view.container.textContent
  assert.match(notice, /Couldn't check whether this card was already answered elsewhere/)
  assert.ok(buttonByText(view.container, 'Check again'), 'the user can ask again')
  await click(view.container.querySelectorAll('[role="radio"]')[2])
  assert.ok(buttonByText(view.container, 'Send')?.disabled === false, 'offline, the card still works')
  // Check again: a new request, actions held until it answers.
  await click(buttonByText(view.container, 'Check again'))
  await act(async () => new Promise(resolve => setTimeout(resolve, 40)))
  assert.equal(route.held.length, 2)
  assert.ok(buttonByText(view.container, 'Send') === undefined, 'held again while re-checking')
  await route.release({ answers: { [cardId]: rateAnswer(cardId) }, open: [] })
  assert.match(view.container.querySelector('.huic-answer')?.textContent ?? '', /Rated 4\/5/)
  assert.ok(!/Couldn't check/.test(view.container.textContent), 'the notice goes once the check worked')
  assert.equal(testHost.submissions.length, 0)
  await view.unmount()
})

test('a failed lookup says so; a later successful one clears it', async () => {
  const result = toolResult(RATE)
  let fail = true
  const timers = manualTimers()
  const reg = registration({ timers, rest: path => (path.startsWith('/answers') ? (fail ? Promise.reject(new Error('HTTP 502')) : { answers: {}, open: [JSON.parse(result).cardId] }) : {}) })
  const view = await mountAndSettle(result, { registration: reg })
  assert.match(view.container.textContent, /Couldn't check/)
  assert.ok(view.container.querySelectorAll('[role="radio"]').length === 5)
  fail = false
  await click(buttonByText(view.container, 'Check again'))
  await act(async () => settle())
  assert.ok(!/Couldn't check/.test(view.container.textContent))
  await view.unmount()
})

// ── Review 5 #8: local receipts belong to one source + profile ──

function withOwnerAtoms(fn) {
  return async () => {
    host.state.profile = atom('alpha')
    host.state.connectionId = atom('local')
    try {
      await fn()
    } finally {
      delete host.state.profile
      delete host.state.connectionId
    }
  }
}

test('another profile with the same chat and card ids neither sees the receipt nor skips its lookup', withOwnerAtoms(async () => {
  const result = toolResult(RATE)
  const cardId = JSON.parse(result).cardId
  const storage = makeStorage()
  const reg = registration({ storage, rest: path => (path.startsWith('/answers') ? { answers: {}, open: [cardId] } : {}) })
  const a = await mountAndSettle(result, { registration: reg, sessionId: 'copied' })
  await click(a.container.querySelectorAll('[role="radio"]')[3])
  await click(buttonByText(a.container, 'Send'))
  await a.unmount()
  const asked = () => reg.calls.filter(p => p.startsWith('/answers')).length
  const before = asked()
  await act(async () => host.state.profile.set('beta'))
  const b = await mountAndSettle(result, { registration: reg, sessionId: 'copied' })
  assert.ok(b.container.querySelector('.huic-answer') === null, "profile beta does not show alpha's answer")
  assert.equal(asked(), before + 1, 'beta asks its own route')
  assert.ok(![...storage.map.keys()].some(k => k.includes('beta') && k.startsWith('answer.')), 'nothing written for beta')
  await b.unmount()
  await act(async () => host.state.connectionId.set('ssh-box'))
  await act(async () => host.state.profile.set('alpha'))
  const c = await mountAndSettle(result, { registration: reg, sessionId: 'copied' })
  assert.ok(c.container.querySelector('.huic-answer') === null, 'same profile name on another source: separate too')
  await c.unmount()
  await act(async () => host.state.connectionId.set('local'))
  const back = await mountAndSettle(result, { registration: reg, sessionId: 'copied' })
  assert.ok(back.container.querySelector('.huic-answer') !== null, 'alpha on local keeps its receipt')
  await back.unmount()
}))

test('a profile switch while a card is on screen remounts it under the new owner and re-reads settings', withOwnerAtoms(async () => {
  const result = toolResult(RATE)
  const cardId = JSON.parse(result).cardId
  const reg = registration({ rest: path => (path.startsWith('/answers') ? { answers: {}, open: [cardId] } : { v: 1, display: { compact: false, accent: 'app', undo: 4 } }) })
  const view = await mountAndSettle(result, { registration: reg, sessionId: 'copied' })
  await click(view.container.querySelectorAll('[role="radio"]')[1])
  await click(buttonByText(view.container, 'Send'))
  assert.ok(view.container.querySelector('.huic-answer'))
  const settings = () => reg.calls.filter(p => p === '/settings').length
  const before = settings()
  await act(async () => { host.state.profile.set('beta'); await settle() })
  await act(async () => settle())
  assert.ok(view.container.querySelector('.huic-answer') === null, 'the card on screen drops the old profile receipt')
  assert.ok(settings() > before, "the new profile's display settings are read")
  await view.unmount()
}))

test('gateway.ready re-renders cards so a new activation reads its display settings', async () => {
  let epoch = 1
  const original = mod.default
  const reg = registration({ rest: path => (path.startsWith('/answers') ? { answers: {}, open: [] } : { v: 1, display: { compact: epoch > 1, accent: 'app', undo: 4 } }) })
  const view = await mountAndSettle(toolResult(RATE), { registration: reg })
  assert.equal(view.container.querySelector('section.huic').classList.contains('huic-compact'), false)
  epoch = 2
  host.state.connectionId = atom('other-source') // a reconnect onto another source
  try {
    await reg.emit('gateway.ready', {})
    await act(async () => settle())
    assert.equal(view.container.querySelector('section.huic').classList.contains('huic-compact'), true)
  } finally {
    delete host.state.connectionId
  }
  assert.ok(original === mod.default)
  await view.unmount()
})
