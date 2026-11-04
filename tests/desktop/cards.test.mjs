import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { buttonByText, click, key, lastReply, makeStorage, mount, registerPlugin, resetHost, testHost, toolResult, type, host } from './dom.mjs'

beforeEach(resetHost)

const choiceCard = {
  type: 'choice',
  id: 'trip',
  question: 'What are you in the mood for?',
  options: [{ label: 'City trip', icon: '🏙️' }, { label: 'Hiking' }, { label: 'Spa', description: 'Sauna' }]
}

test('registers one renderer for hui_present only', () => {
  const { contributions } = registerPlugin()
  const renderers = contributions.filter(c => c.area === 'transcript.toolMedia')
  assert.equal(renderers.length, 1)
  assert.deepEqual(renderers[0].data.tools, ['hui_present'])
})

test('choice: click an option, Send → reply in the card chat, then locked', async () => {
  const { container, unmount } = await mount(toolResult(choiceCard))
  const radios = container.querySelectorAll('[role="radio"]')
  assert.equal(radios.length, 3)
  assert.equal(buttonByText(container, 'Send').disabled, true, 'nothing picked yet')
  await click(radios[2])
  assert.equal(radios[2].getAttribute('aria-checked'), 'true')
  await click(buttonByText(container, 'Send'))
  const reply = lastReply()
  assert.equal(reply.sessionId, 'sess-1')
  assert.equal(reply.line1, '✓ Chose: Spa')
  assert.deepEqual(reply.json, { card: reply.json.card, type: 'choice', selected: ['o3'], labels: ['Spa'] })
  assert.match(reply.json.card, /^trip-/)
  // answered: no button left, answer shown, a second click does nothing
  assert.equal(buttonByText(container, 'Send'), undefined)
  assert.match(container.textContent, /Your answer: Chose: Spa/)
  await click(radios[0])
  assert.equal(testHost.submissions.length, 1, 'no second send')
  await unmount()
})

test('choice: arrow keys move the selection like a radio group', async () => {
  const { container, unmount } = await mount(toolResult(choiceCard))
  const radios = container.querySelectorAll('[role="radio"]')
  assert.equal(radios[0].tabIndex, 0)
  assert.equal(radios[1].tabIndex, -1)
  await key(radios[0], 'ArrowDown')
  assert.equal(radios[1].getAttribute('aria-checked'), 'true')
  await unmount()
})

test('choice: multiple with min/max and Other', async () => {
  const card = { ...choiceCard, multiple: true, min: 2, max: 3, allowOther: true }
  const { container, unmount } = await mount(toolResult(card))
  const boxes = container.querySelectorAll('[role="checkbox"]')
  assert.equal(boxes.length, 4, '3 options + Other')
  assert.match(container.textContent, /Pick 2–3/)
  await click(boxes[0])
  assert.equal(buttonByText(container, 'Send').disabled, true, 'below min')
  await click(boxes[3]) // Other
  const input = container.querySelector('input[aria-label="Other"]')
  assert.ok(input)
  assert.equal(buttonByText(container, 'Send').disabled, true, 'Other is empty')
  await type(input, 'Road trip')
  await click(buttonByText(container, 'Send'))
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Chose: City trip, Other: "Road trip"')
  assert.deepEqual(reply.json.selected, ['o1'])
  assert.equal(reply.json.other, 'Road trip')
  await unmount()
})

test('reopening the chat shows the sent answer and does not allow another send', async () => {
  const registration = registerPlugin(makeStorage())
  const result = toolResult(choiceCard)
  const first = await mount(result, { registration })
  await click(first.container.querySelectorAll('[role="radio"]')[1])
  await click(buttonByText(first.container, 'Send'))
  await first.unmount()
  const again = await mount(result, { registration })
  assert.equal(buttonByText(again.container, 'Send'), undefined)
  assert.equal(again.container.querySelectorAll('[role="radio"]')[1].getAttribute('aria-checked'), 'true')
  assert.match(again.container.textContent, /Your answer: Chose: Hiking/)
  await again.unmount()
})

test('a chat that is no longer active shows a notice instead of a dead button', async () => {
  testHost.submitResult = false
  const { container, unmount } = await mount(toolResult(choiceCard))
  await click(container.querySelectorAll('[role="radio"]')[0])
  await click(buttonByText(container, 'Send'))
  assert.match(container.textContent, /Couldn't send. Open this chat and check that Hermes is connected/ )
  assert.equal(buttonByText(container, 'Send'), undefined)
  // after the user opens the chat, "Try again" brings the button back
  testHost.submitResult = true
  await click(buttonByText(container, 'Try again'))
  await click(buttonByText(container, 'Send'))
  assert.equal(lastReply().line1, '✓ Chose: City trip')
  await unmount()
})

test('no session id: fail closed, nothing is sent anywhere', async () => {
  const { container, unmount } = await mount(toolResult(choiceCard), { sessionId: null })
  await click(container.querySelectorAll('[role="radio"]')[0])
  assert.equal(buttonByText(container, 'Send'), undefined)
  assert.equal(testHost.submissions.length, 0)
  assert.match(container.textContent, /no longer active/)
  await unmount()
})

test('a different backend gateway state does not block the addressed session', async () => {
  host.state.gateway.set('connecting')
  const { container, unmount } = await mount(toolResult(choiceCard))
  await click(container.querySelector('[role="radio"]'))
  await click(buttonByText(container, 'Send'))
  assert.equal(lastReply().sessionId, 'sess-1')
  await unmount()
})

test('invalid or foreign results fall back to the built-in attachment', async () => {
  for (const bad of ['not json', JSON.stringify({ error: 'x' }), JSON.stringify({ card: { type: 'choice', cardId: 'x-1', question: 'Q', options: [] } }), JSON.stringify({ card: { type: 'nope', cardId: 'x-2' } }), JSON.stringify({ card: { type: 'choice', question: 'Q', options: [{ label: 'a' }, { label: 'b' }] } })]) {
    const { container, unmount } = await mount(bad)
    assert.ok(container.querySelector('[data-fallback]'), `fallback for ${bad.slice(0, 40)}`)
    await unmount()
  }
})

test('result as an already-parsed object (reopened history) renders too', async () => {
  const { container, unmount } = await mount(JSON.parse(toolResult(choiceCard)))
  assert.equal(container.querySelectorAll('[role="radio"]').length, 3)
  await unmount()
})

test('checklist: ticks survive a remount; Done reports done and open items', async () => {
  const card = {
    type: 'checklist',
    title: 'Packing',
    items: [{ text: 'Passport', category: 'Documents' }, { text: 'Tickets', category: 'Documents', checked: true }, { text: 'Charger' }]
  }
  const registration = registerPlugin(makeStorage())
  const result = toolResult(card)
  const first = await mount(result, { registration })
  assert.match(first.container.textContent, /1 of 3 done/)
  const boxes = first.container.querySelectorAll('input[type="checkbox"]')
  await click(boxes[0])
  assert.match(first.container.textContent, /2 of 3 done/)
  await first.unmount()
  const again = await mount(result, { registration })
  assert.match(again.container.textContent, /2 of 3 done/, 'ticks restored')
  await click(buttonByText(again.container, 'Done'))
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Checklist done: 2 of 3 checked. Still open: Charger')
  assert.deepEqual(reply.json.done, ['Passport', 'Tickets'])
  assert.deepEqual(reply.json.open, ['Charger'])
  assert.ok(again.container.querySelector('input[type="checkbox"]').disabled)
  await again.unmount()
})

test('compare: pick button per column, recommendation marked', async () => {
  const card = {
    type: 'compare',
    title: 'Phones',
    columns: [{ title: 'Pixel 10', best: true }, { title: 'Galaxy S' }],
    rows: [{ label: 'Price', values: ['€899', '€749'] }, { label: '5G', values: [true, false] }]
  }
  const { container, unmount } = await mount(toolResult(card))
  assert.match(container.textContent, /Recommended/)
  const picks = [...container.querySelectorAll('button')].filter(b => b.textContent === 'Choose')
  assert.equal(picks.length, 2)
  assert.equal(picks[1].getAttribute('aria-label'), 'Choose: Galaxy S')
  await click(picks[1])
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Picked: Galaxy S')
  assert.equal(reply.json.selected, 'c2')
  assert.equal(reply.json.label, 'Galaxy S')
  await unmount()
})

test('form: required fields and checks block the send; valid input sends typed values', async () => {
  const card = {
    type: 'form',
    title: 'Book a table',
    fields: [
      { name: 'name', label: 'Name', kind: 'text', required: true },
      { name: 'guests', label: 'Guests', kind: 'number', min: 1, max: 12 },
      { name: 'area', label: 'Area', kind: 'select', options: ['Inside', 'Terrace'] },
      { name: 'kids', label: 'High chair', kind: 'toggle' }
    ]
  }
  const { container, unmount } = await mount(toolResult(card))
  const submit = buttonByText(container, 'Submit')
  await click(submit)
  assert.equal(testHost.submissions.length, 0)
  assert.match(container.textContent, /Please fill this in/)
  const name = container.querySelector('input[aria-required="true"]')
  assert.equal(name.getAttribute('aria-invalid'), 'true')
  await type(name, 'Anna')
  const guests = container.querySelector('input[type="number"]')
  await type(guests, '20')
  await click(submit)
  assert.equal(testHost.submissions.length, 0)
  assert.match(container.textContent, /At most 12/)
  await type(guests, '4')
  await type(container.querySelector('select'), 'Terrace')
  await click(container.querySelector('input[role="switch"]'))
  await click(submit)
  const reply = lastReply()
  assert.equal(reply.line1, '✓ Form sent: Name: Anna, Guests: 4, Area: Terrace, High chair: yes')
  assert.deepEqual(reply.json.values, { name: 'Anna', guests: 4, area: 'Terrace', kids: true })
  await unmount()
})

test('confirm: yes, no and change', async () => {
  const card = {
    type: 'confirm',
    title: 'Delete old logs?',
    action: 'Delete 14 files in ~/logs',
    risk: { level: 'high', text: 'Cannot be undone' },
    command: 'rm ~/logs/*.old'
  }
  let m = await mount(toolResult(card))
  assert.match(m.container.textContent, /High risk/)
  await click(buttonByText(m.container, 'Yes, go ahead'))
  assert.equal(lastReply().line1, '✓ Yes, go ahead: Delete old logs?')
  assert.equal(lastReply().json.decision, 'yes')
  await m.unmount()

  m = await mount(toolResult(card))
  await click(buttonByText(m.container, 'No'))
  assert.equal(lastReply().line1, "✗ No, don't: Delete old logs?")
  await m.unmount()

  m = await mount(toolResult(card))
  await click(buttonByText(m.container, 'Change…'))
  const area = m.container.querySelector('textarea')
  await type(area, 'Only files older than 90 days')
  await click(buttonByText(m.container, 'Send change'))
  assert.equal(lastReply().line1, '✎ Change: Only files older than 90 days')
  assert.deepEqual(lastReply().json, { card: lastReply().json.card, type: 'confirm', decision: 'change', change: 'Only files older than 90 days' })
  await m.unmount()
})

test('German chrome follows card.lang', async () => {
  const { container, unmount } = await mount(toolResult({ ...choiceCard, lang: 'de' }))
  await click(container.querySelectorAll('[role="radio"]')[0])
  await click(buttonByText(container, 'Senden'))
  assert.equal(lastReply().line1, '✓ Gewählt: City trip')
  assert.match(container.textContent, /Deine Antwort/)
  await unmount()
})

test('display settings: compact class and accent variable', async () => {
  const { container, unmount } = await mount(toolResult(choiceCard, { display: { compact: true, accent: 'green' } }))
  const section = container.querySelector('section.huic')
  assert.ok(section.classList.contains('huic-compact'))
  assert.match(section.getAttribute('style'), /--huic-accent:\s*var\(--ui-green/)
  await unmount()
})
