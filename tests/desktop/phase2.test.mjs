import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { buttonByText, click, host, key, lastReply, makeStorage, mount, registerPlugin, resetHost, testHost, toolResult, type } from './dom.mjs'

beforeEach(resetHost)

const rating = { type: 'rating', question: 'How was it?', scale: 5, comment: true, lowLabel: 'Poor', highLabel: 'Great' }
const slider = { type: 'slider', question: 'Budget?', min: 100, max: 500, step: 50, unit: '€', minLabel: 'Small', maxLabel: 'Large' }
const schedule = {
  type: 'schedule', title: 'Meet up', timezone: 'Europe/Vienna', noneLabel: 'None fits',
  slots: [
    { start: '2026-11-12T14:00', end: '2026-11-12T15:00', label: 'Afternoon', note: 'Video call' },
    { start: '2026-11-12T16:00', unavailable: true },
    { start: '2026-11-13T10:00' }
  ]
}
const steps = {
  type: 'steps', title: 'Set up', steps: [
    { title: 'Install', body: 'Install the package.', command: 'npm install' },
    { title: 'Start', body: 'Start the service.' },
    { title: 'Verify', body: 'Check the service.' }
  ]
}
const quiz = {
  type: 'quiz', title: 'Quick quiz', questions: [
    { question: 'Two plus two?', options: ['Three', 'Four'], answer: 1, explanation: 'Two pairs make four.' },
    { question: 'The red planet?', options: ['Mars', 'Venus'], answer: 0, explanation: 'Mars is the red planet.' }
  ]
}

function assertReply(result, line1, data) {
  const reply = lastReply()
  assert.equal(reply.sessionId, 'sess-1')
  assert.equal(reply.line1, line1)
  assert.deepEqual(reply.json, { card: JSON.parse(result).card.cardId, type: JSON.parse(result).card.type, ...data })
}

async function render(t, result, options) {
  const m = await mount(result, options)
  let mounted = true
  const unmount = async () => { if (mounted) { mounted = false; await m.unmount() } }
  t.after(unmount)
  return { ...m, unmount }
}

test('rating: stars, arrow keys, optional comment, exact reply, locked answer restored', async t => {
  const result = toolResult(rating)
  const registration = registerPlugin(makeStorage())
  const m = await render(t, result, { registration })
  const radios = m.container.querySelectorAll('[role="radio"]')
  assert.equal(radios.length, 5)
  assert.ok(radios[0].querySelector('svg'), 'stars are drawn, not text')
  assert.equal(radios[0].getAttribute('aria-label'), 'Rate 1 of 5')
  assert.equal(buttonByText(m.container, 'Send').disabled, true)
  await key(radios[0], 'End')
  assert.ok((document.activeElement) === (radios[4]))
  await key(radios[4], 'ArrowLeft')
  assert.equal(radios[3].getAttribute('aria-checked'), 'true')
  await type(m.container.querySelector('textarea'), 'Very useful')
  await click(buttonByText(m.container, 'Send'))
  assertReply(result, '✓ Rated 4 of 5: “Very useful”', { value: 4, scale: 5, comment: 'Very useful' })
  assert.ok((buttonByText(m.container, 'Send')) === (undefined))
  assert.ok([...radios].every(r => r.disabled))
  assert.ok(m.container.querySelector('textarea').disabled)
  await click(radios[0])
  assert.equal(testHost.submissions.length, 1)
  await m.unmount()
  const again = await render(t, result, { registration })
  assert.ok((again.container.querySelectorAll('[role="radio"]')[3].getAttribute('aria-checked')) === ('true'))
  assert.equal(again.container.querySelector('textarea').value, 'Very useful')
  assert.ok((again.container.querySelector('.huic-foot')) === (null))
})

test('rating: ten numbered choices and German chrome', async t => {
  const result = toolResult({ ...rating, scale: 10, style: 'numbers', lang: 'de', comment: false })
  const { container } = await render(t, result)
  assert.equal(container.querySelectorAll('[role="radio"]').length, 10)
  const ten = buttonByText(container, '10')
  assert.equal(ten.getAttribute('aria-label'), '10 von 10 bewerten')
  await click(ten)
  await click(buttonByText(container, 'Senden'))
  assertReply(result, '✓ Bewertung: 10 von 10', { value: 10, scale: 10 })
  assert.match(container.textContent, /Deine Antwort/)
})

test('slider: midpoint, accessible live value, draft and sent answer restored', async t => {
  const result = toolResult(slider)
  const registration = registerPlugin(makeStorage())
  const m = await render(t, result, { registration })
  const input = m.container.querySelector('input[type="range"]')
  assert.equal(input.value, '300')
  assert.equal(input.step, '50')
  assert.equal(input.getAttribute('aria-valuetext'), '300 €')
  assert.equal(m.container.querySelector('input[type="number"]').value, '300')
  await type(input, '450')
  assert.equal(m.container.querySelector('input[type="number"]').value, '450')
  await m.unmount()
  const again = await render(t, result, { registration })
  assert.equal(again.container.querySelector('input[type="range"]').value, '450')
  await click(buttonByText(again.container, 'Send'))
  assertReply(result, '✓ Chose: 450 €', { value: 450, unit: '€' })
  assert.ok(again.container.querySelector('input[type="range"]').disabled)
  assert.ok(again.container.querySelector('input[type="number"]').disabled)
  assert.ok((again.container.querySelector('.huic-foot')) === (null))
  await again.unmount()
  const sent = await render(t, result, { registration })
  assert.equal(sent.container.querySelector('input[type="range"]').value, '450')
  assert.equal(sent.container.querySelector('input[type="number"]').value, '450')
  assert.ok(sent.container.querySelector('input[type="range"]').disabled)
})

test('slider: step rounding is relative to min, explicit default takes precedence', async t => {
  const m = await render(t, toolResult({ type: 'slider', question: 'Level', min: 1, max: 10, step: 2 }))
  assert.equal(m.container.querySelector('input[type="range"]').value, '5')
  const result = toolResult({ type: 'slider', question: 'Level', min: 0, max: 1, step: 0.1, default: 0.3 })
  const explicit = await render(t, result)
  assert.equal(explicit.container.querySelector('input[type="range"]').value, '0.3')
  await click(buttonByText(explicit.container, 'Send'))
  assertReply(result, '✓ Chose: 0.3', { value: 0.3 })
})

test('schedule: day groups, unavailable slots disabled, arrows skip them, exact reply and restore', async t => {
  const result = toolResult(schedule)
  const registration = registerPlugin(makeStorage())
  const m = await render(t, result, { registration })
  const radios = m.container.querySelectorAll('[role="radio"]')
  assert.equal(m.container.querySelectorAll('h4').length, 2)
  assert.equal(m.container.querySelector('.huic-head .huic-sub').textContent, 'Vienna time')
  assert.match(radios[0].textContent, /Afternoon · Video call/)
  assert.match(radios[1].textContent, /not available/)
  assert.ok(radios[1].disabled)
  await click(radios[1])
  assert.equal(radios[1].getAttribute('aria-checked'), 'false')
  assert.equal(buttonByText(m.container, 'Send').disabled, true)
  await key(radios[0], 'ArrowDown')
  assert.ok((document.activeElement) === (radios[2]))
  assert.equal(radios[2].getAttribute('aria-checked'), 'true')
  await key(radios[2], 'ArrowUp')
  await click(buttonByText(m.container, 'Send'))
  assertReply(result, '✓ Works for me: Thu 12 Nov, 14:00–15:00 (Afternoon)', {
    selected: [{ id: 's1', start: '2026-11-12T14:00', end: '2026-11-12T15:00', label: 'Afternoon' }]
  })
  assert.ok([...radios].every(r => r.disabled))
  assert.ok((m.container.querySelector('.huic-foot')) === (null))
  await m.unmount()
  const again = await render(t, result, { registration })
  assert.equal(again.container.querySelector('[role="radio"]').getAttribute('aria-checked'), 'true')
  assert.ok((again.container.querySelector('.huic-foot')) === (null))
})

test('schedule: multiple slots use checkboxes and can be toggled', async t => {
  const result = toolResult({ ...schedule, multiple: true })
  const { container } = await render(t, result)
  const boxes = container.querySelectorAll('[role="checkbox"]')
  await click(boxes[0])
  await click(boxes[2])
  await click(boxes[0])
  assert.equal(boxes[0].getAttribute('aria-checked'), 'false')
  await click(boxes[0])
  await click(buttonByText(container, 'Send'))
  assertReply(result, '✓ These work for me: Thu 12 Nov, 14:00–15:00 (Afternoon); Fri 13 Nov, 10:00', {
    selected: [
      { id: 's1', start: '2026-11-12T14:00', end: '2026-11-12T15:00', label: 'Afternoon' },
      { id: 's3', start: '2026-11-13T10:00' }
    ]
  })
})

test('schedule: none fits sends none:true and restores a locked empty selection', async t => {
  const result = toolResult({ ...schedule, slots: schedule.slots.map(s => ({ ...s, unavailable: true })) })
  const registration = registerPlugin(makeStorage())
  const m = await render(t, result, { registration })
  assert.ok([...m.container.querySelectorAll('[role="radio"]')].every(r => r.disabled))
  await click(buttonByText(m.container, 'None fits'))
  assertReply(result, '✗ None of these times work for me', { none: true })
  await m.unmount()
  const again = await render(t, result, { registration })
  assert.ok((again.container.querySelector('.huic-foot')) === (null))
  assert.ok([...again.container.querySelectorAll('[role="radio"]')].every(r => r.getAttribute('aria-checked') === 'false'))
  assert.match(again.container.textContent, /Your answer: None of these times work for me/)
})

test('schedule: day grouping uses the card timezone for offset timestamps', async t => {
  const { container } = await render(t, toolResult({
    type: 'schedule', timezone: 'Europe/Vienna', slots: [{ start: '2026-11-12T23:30Z' }, { start: '2026-11-13T01:00Z' }]
  }))
  assert.equal(container.querySelectorAll('h4').length, 1, 'both slots are on Friday in Vienna')
})

test('steps: one step at a time, navigation, saved position, completion and locked remount', async t => {
  const result = toolResult({ ...steps, finishLabel: 'All set' })
  const registration = registerPlugin(makeStorage())
  const m = await render(t, result, { registration })
  assert.equal(m.container.querySelector('h4').textContent, 'Install')
  assert.equal(m.container.querySelector('pre').textContent, 'npm install')
  assert.ok((buttonByText(m.container, 'Back')) === (undefined))
  await click(buttonByText(m.container, 'Next'))
  assert.equal(m.container.querySelector('h4').textContent, 'Start')
  assert.ok((document.activeElement) === (m.container.querySelector('h4')))
  assert.equal(m.container.querySelector('[role="progressbar"]').getAttribute('aria-valuenow'), '2')
  await click(buttonByText(m.container, 'Back'))
  assert.equal(m.container.querySelector('h4').textContent, 'Install')
  await click(buttonByText(m.container, 'Next'))
  await m.unmount()
  const again = await render(t, result, { registration })
  assert.equal(again.container.querySelector('h4').textContent, 'Start')
  assert.match(again.container.textContent, /Step 2 of 3/)
  await click(buttonByText(again.container, 'Next'))
  assert.ok((buttonByText(again.container, 'Next')) === (undefined))
  await click(buttonByText(again.container, 'All set'))
  assertReply(result, '✓ Done with all 3 steps', { completed: true, steps: 3 })
  assert.equal(again.container.querySelector('h4').textContent, 'Verify')
  assert.ok((buttonByText(again.container, 'All set')) === (undefined))
  await click(buttonByText(again.container, 'Back'))
  assert.equal(again.container.querySelector('h4').textContent, 'Start')
  await again.unmount()
  const sent = await render(t, result, { registration })
  assert.equal(sent.container.querySelector('h4').textContent, 'Start')
  assert.ok(buttonByText(sent.container, 'Next'))
})

test('steps: Stuck here reports the current 1-based step and title', async t => {
  const result = toolResult(steps)
  const { container } = await render(t, result)
  await click(buttonByText(container, 'Next'))
  await click(buttonByText(container, 'Stuck here'))
  await click(buttonByText(container, 'Send'))
  assertReply(result, '⚠ Stuck at step 2: Start', { stuck: 2, title: 'Start' })
  assert.equal(container.querySelector('h4').textContent, 'Start')
  assert.match(container.textContent, /Start the service/ )
  assert.ok((buttonByText(container, 'Stuck here')) === (undefined))
  assert.match(container.textContent, /Your answer: Stuck at step 2: Start/)
  await click(buttonByText(container, 'Back'))
  assert.equal(container.querySelector('pre').textContent, 'npm install')
  assert.ok(buttonByText(container, 'Copy'))
  await click(buttonByText(container, 'Next'))
  assert.equal(container.querySelector('h4').textContent, 'Start')
})

test('quiz: checking reveals feedback, saves progress, scores and restores the locked answer', async t => {
  const result = toolResult(quiz)
  const registration = registerPlugin(makeStorage())
  const m = await render(t, result, { registration })
  assert.equal(buttonByText(m.container, 'Check').disabled, true)
  assert.ok(!m.container.textContent.includes(quiz.questions[0].explanation))
  await key(m.container.querySelector('[role="radio"]'), 'ArrowDown')
  assert.ok((m.container.querySelectorAll('[role="radio"]')[1].getAttribute('aria-checked')) === ('true'))
  assert.ok(!m.container.textContent.includes(quiz.questions[0].explanation))
  await m.unmount()
  const again = await render(t, result, { registration })
  assert.ok((again.container.querySelectorAll('[role="radio"]')[1].getAttribute('aria-checked')) === ('true'))
  assert.ok(!again.container.textContent.includes(quiz.questions[0].explanation))
  await click(buttonByText(again.container, 'Check'))
  assert.match(again.container.textContent, /Correct/)
  assert.match(again.container.textContent, /Two pairs make four/)
  assert.ok([...again.container.querySelectorAll('[role="radio"]')].every(r => r.getAttribute('aria-disabled') === 'true'))
  await click(buttonByText(again.container, 'Next'))
  assert.ok((document.activeElement) === (again.container.querySelector('h4')))
  assert.ok(!again.container.textContent.includes(quiz.questions[1].explanation))
  await click(again.container.querySelectorAll('[role="radio"]')[1])
  await click(buttonByText(again.container, 'Check'))
  assert.match(again.container.textContent, /Not quite/)
  assert.match(again.container.textContent, /Mars is the red planet/)
  assert.match(again.container.textContent, /Not quite/)
  await click(buttonByText(again.container, 'See result'))
  assert.match(again.container.textContent, /1 of 2 correct/)
  await again.unmount()
  const checked = await render(t, result, { registration })
  assert.match(checked.container.textContent, /1 of 2 correct/, 'restored on the result screen')
  await click(buttonByText(checked.container, 'Back'))
  assert.equal(checked.container.querySelector('h4').textContent, 'The red planet?')
  assert.match(checked.container.textContent, /Not quite/)
  await click(buttonByText(checked.container, 'Back'))
  assert.match(checked.container.textContent, /Two pairs make four/)
  assert.ok([...checked.container.querySelectorAll('[role="radio"]')].every(r => r.getAttribute('aria-disabled') === 'true'))
  await click(buttonByText(checked.container, 'Next'))
  await click(buttonByText(checked.container, 'See result'))
  await click(buttonByText(checked.container, 'Send result'))
  assertReply(result, '✓ Quiz: 1 of 2 correct', {
    answers: [{ q: 1, chosen: 1, correct: true }, { q: 2, chosen: 1, correct: false }], score: 1, total: 2
  })
  assert.ok((checked.container.querySelector('.huic-foot')) === (null))
  await checked.unmount()
  const sent = await render(t, result, { registration })
  assert.match(sent.container.textContent, /1 of 2 correct/)
  assert.match(sent.container.textContent, /Correct answer: Mars/)
  assert.equal(sent.container.querySelectorAll('[role="radio"]').length, 0, 'sent quiz shows the result screen')
  assert.ok((sent.container.querySelector('.huic-foot')) === (null))
})
