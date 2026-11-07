import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { act, buttonByText, click, key, lastReply, mount, resetHost, testHost, toolResult, type } from './dom.mjs'

beforeEach(resetHost)

async function render(t, result, options) {
  const m = await mount(result, options)
  t.after(() => m.unmount())
  return m
}

const choice = { type: 'choice', question: 'Pick one', options: [{ label: 'Alpha' }, { label: 'Beta', badge: 'Best value' }, { label: 'Gamma' }] }
const quiz = {
  type: 'quiz', title: 'Quiz', questions: [
    { question: 'Two plus two?', options: ['Three', 'Four'], answer: 1, explanation: 'Two pairs make four.' },
    { question: 'The red planet?', options: ['Mars', 'Venus'], answer: 0 }
  ]
}

test('choice: number badges, digit selects, Enter sends, hint promises only Enter', async t => {
  const result = toolResult(choice)
  const { container } = await render(t, result)
  const radios = container.querySelectorAll('[role="radio"]')
  assert.deepEqual([...radios].map(r => r.querySelector('.huic-num').textContent), ['1', '2', '3'])
  assert.match(container.querySelector('.huic-hint').textContent, /^Enter to send$/)
  assert.deepEqual([...container.querySelectorAll('.huic-hint .huic-keys kbd')].map(k => k.textContent), ['Enter'], 'only Enter is promised (the host sends typed digits to its composer)')
  assert.match(container.textContent, /Best value/)
  await key(radios[0], '3')
  assert.equal(radios[2].getAttribute('aria-checked'), 'true')
  assert.ok((document.activeElement) === (radios[2]))
  await key(radios[2], 'Enter')
  assert.equal(lastReply().line1, '✓ Chose: Gamma')
  assert.equal(testHost.submissions.length, 1)
  await key(radios[2], 'Enter')
  assert.equal(testHost.submissions.length, 1, 'no second send')
})

test('choice: multiple toggles by digit, Enter sends only a valid selection; German hint', async t => {
  const result = toolResult({ ...choice, lang: 'de', multiple: true, min: 2 })
  const { container } = await render(t, result)
  const boxes = container.querySelectorAll('[role="checkbox"]')
  assert.match(container.querySelector('.huic-hint').textContent, /Enter zum Senden$/)
  // The pick rule is for everyone; only the shortcuts sit in .huic-keys (hidden on touch screens and narrow views).
  const hint = container.querySelector('.huic-hint')
  assert.match(hint.textContent, /^Mindestens 2 auswählen/)
  assert.ok(!/Mindestens/.test(hint.querySelector('.huic-keys').textContent))
  await key(boxes[0], '1')
  await key(boxes[0], 'Enter')
  assert.equal(testHost.submissions.length, 0, 'below min: Enter toggles instead of sending')
  assert.equal(boxes[0].getAttribute('aria-checked'), 'false')
  await key(boxes[0], '1')
  await key(boxes[0], '3')
  await key(boxes[2], 'Enter')
  assert.equal(lastReply().json.selected.length, 2)
})

test('choice: digits are ignored while typing in the Other field', async t => {
  const { container } = await render(t, toolResult({ ...choice, allowOther: true }))
  await click(container.querySelectorAll('[role="radio"]')[3])
  const input = container.querySelector('input')
  await key(input, '1')
  assert.ok((container.querySelectorAll('[role="radio"]')[0].getAttribute('aria-checked')) === ('false'))
})

test('choice with images: tiles, badge, broken or missing image keeps a placeholder', async t => {
  const card = { type: 'choice', question: 'Plan?', options: [
    { label: 'Starter', image: 'https://example.invalid/x.jpg', badge: 'Cheap' },
    { label: 'Team plan', icon: '👥' },
    { label: 'Plain', image: 'https://example.invalid/y.jpg' }
  ] }
  const { container } = await render(t, toolResult(card))
  const tiles = container.querySelectorAll('.huic-tile')
  assert.equal(tiles.length, 3)
  assert.match(tiles[0].textContent, /Cheap/)
  const img = tiles[0].querySelector('img')
  assert.ok(img, 'image renders first')
  await act(async () => { img.dispatchEvent(new window.Event('error')) })
  assert.ok((tiles[0].querySelector('img')) === (null))
  assert.equal(tiles[0].querySelector('.huic-tile-ph').textContent, '', 'no initials: a neutral placeholder')
  assert.ok(tiles[0].querySelector('.huic-tile-ph svg.huic-ico'), 'line picture icon on the placeholder')
  assert.equal(tiles[1].querySelector('.huic-tile-ph').textContent, '👥')
  assert.ok((tiles[2].querySelector('.huic-tile-ph')) === (null), 'still loading, shown with neutral background')
  assert.ok(tiles[0].querySelector('.huic-tile-label'), 'label stays visible on the placeholder')
})

test('rating: digits rate (0 is ten), hover previews, Enter sends, echo names the choice', async t => {
  const result = toolResult({ type: 'rating', question: 'How?', scale: 5, lowLabel: 'Poor', highLabel: 'Great' })
  const { container } = await render(t, result)
  const stars = container.querySelectorAll('[role="radio"]')
  assert.match(container.querySelector('.huic-hint').textContent, /^Enter to send$/)
  assert.match(container.textContent, /1 = Poor · 5 = Great/)
  await act(async () => { stars[1].dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true })) })
  assert.equal(container.querySelectorAll('.huic-star-on').length, 2, 'hover fills up to the pointer')
  assert.equal(container.querySelector('.huic-rate-echo').textContent, '2 of 5')
  await key(stars[0], '5')
  assert.equal(container.querySelector('.huic-rate-echo').textContent, '5 of 5 · Great')
  await key(stars[4], 'Enter')
  assert.equal(lastReply().line1, '✓ Rated 5 of 5')
})

test('rating: numbers style is a segmented row; 0 means ten', async t => {
  const { container } = await render(t, toolResult({ type: 'rating', question: 'NPS?', scale: 10, style: 'numbers' }))
  assert.ok(container.querySelector('.huic-segs'))
  await key(container.querySelector('[role="radio"]'), '0')
  assert.ok((container.querySelectorAll('[role="radio"]')[9].getAttribute('aria-checked')) === ('true'))
})

test('slider: typed value clamps and snaps on blur; Enter corrects first, then sends', async t => {
  const result = toolResult({ type: 'slider', question: 'Budget?', min: 100, max: 500, step: 50, unit: '€' })
  const { container } = await render(t, result)
  const num = container.querySelector('input[type="number"]')
  const range = container.querySelector('input[type="range"]')
  await type(num, '9999')
  await act(async () => { num.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })) })
  assert.equal(num.value, '500')
  assert.equal(range.value, '500')
  await type(num, '263')
  await key(num, 'Enter')
  assert.equal(num.value, '250', 'snapped to the step, not sent yet')
  assert.equal(testHost.submissions.length, 0)
  await key(num, 'Enter')
  assert.equal(lastReply().line1, '✓ Chose: 250 €')
  assert.ok(num.disabled)
})

test('slider: the filled track follows the value and empty input falls back', async t => {
  const { container } = await render(t, toolResult({ type: 'slider', question: 'Level', min: 0, max: 10 }))
  const num = container.querySelector('input[type="number"]')
  const range = container.querySelector('input[type="range"]')
  assert.equal(range.style.getPropertyValue('--fill'), '50%')
  await type(num, '')
  await act(async () => { num.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })) })
  assert.equal(num.value, '5')
})

const schedule = {
  type: 'schedule', title: 'Call', timezone: 'Europe/Vienna', slots: [
    { start: '2026-11-12T14:00', end: '2026-11-12T15:00' },
    { start: '2026-11-12T16:00', unavailable: true },
    { start: '2026-11-13T10:00' }
  ]
}

test('schedule: chips with numbers skip unavailable slots; digit and Enter work; friendly zone', async t => {
  const result = toolResult(schedule)
  const { container } = await render(t, result)
  const chips = container.querySelectorAll('[role="radio"]')
  assert.equal(container.querySelector('.huic-head .huic-sub').textContent, 'Vienna time')
  assert.equal(chips[1].disabled, true, 'unavailable chip is not focusable')
  assert.ok((chips[1].querySelector('.huic-num')) === (null))
  assert.equal(chips[2].querySelector('.huic-num').textContent, '2', 'numbers count available slots only')
  assert.match(container.querySelector('.huic-hint').textContent, /Enter to send$/)
  await key(chips[0], '2')
  assert.equal(chips[2].getAttribute('aria-checked'), 'true')
  await key(chips[2], 'Enter')
  assert.equal(lastReply().line1, '✓ Works for me: Fri 13 Nov, 10:00 · Vienna time')
})

test('schedule: German zone label and day headings', async t => {
  const { container } = await render(t, toolResult({ ...schedule, lang: 'de' }))
  assert.equal(container.querySelector('.huic-head .huic-sub').textContent, 'Zeit: Wien')
  const heads = [...container.querySelectorAll('h4')].map(h => h.textContent)
  assert.equal(heads.length, 2)
  assert.match(heads[0], /Donnerstag/)
})

test('schedule: today and tomorrow are named', async t => {
  const day = n => new Intl.DateTimeFormat('en-CA').format(new Date(Date.now() + n * 864e5))
  const { container } = await render(t, toolResult({
    type: 'schedule', slots: [{ start: `${day(0)}T10:00` }, { start: `${day(1)}T10:00` }, { start: `${day(5)}T10:00` }]
  }))
  const heads = [...container.querySelectorAll('h4')].map(h => h.textContent)
  assert.match(heads[0], /^Today/)
  assert.match(heads[1], /^Tomorrow/)
  assert.doesNotMatch(heads[2], /Today|Tomorrow/)
})

test('quiz: keyboard flow, tile feedback, result screen, send', async t => {
  const result = toolResult(quiz)
  const { container } = await render(t, result)
  const segs = () => [...container.querySelectorAll('.huic-qseg')].map(s => s.className.replace('huic-qseg', '').trim())
  assert.equal(segs().length, 2)
  assert.match(container.querySelector('.huic-hint').textContent, /Enter to check$/)
  const first = container.querySelector('[role="radio"]')
  await key(first, '1')
  await key(first, 'Enter')
  const tiles = () => [...container.querySelectorAll('[role="radio"]')]
  assert.ok(tiles()[1].className.includes('huic-opt-correct'))
  assert.ok(tiles()[0].className.includes('huic-opt-wrong'))
  assert.ok(tiles()[1].classList.contains('huic-opt-correct') && tiles()[1].querySelector('.huic-num svg.huic-ico'), 'correct: line check icon')
  assert.ok(tiles()[0].classList.contains('huic-opt-wrong') && tiles()[0].querySelector('.huic-num svg.huic-ico'), 'wrong: line cross icon')
  assert.deepEqual(segs()[0].split(' ').includes('huic-qseg-bad'), true)
  assert.match(container.querySelector('.huic-callout').textContent, /Not quite.*Two pairs make four/)
  assert.match(container.querySelector('.huic-hint').textContent, /Enter to continue/)
  await key(tiles()[0], '2')
  assert.ok(tiles()[0].className.includes('huic-opt-wrong'), 'locked after check')
  await key(tiles()[0], 'Enter')
  const q2 = container.querySelector('[role="radio"]')
  await key(q2, '1')
  await key(q2, 'Enter')
  assert.ok(container.querySelector('.huic-callout-ok'))
  await key(q2, 'Enter')
  assert.match(container.querySelector('h4').textContent, /1 of 2 correct/)
  assert.match(container.textContent, /Correct answer: Four/)
  assert.equal(testHost.submissions.length, 0)
  await click(buttonByText(container, 'Send result'))
  assert.equal(lastReply().line1, '✓ Quiz: 1 of 2 correct')
})


test('slider: typed and default values snap to a step inside the range', async () => {
  const { mod } = await import('./dom.mjs')
  const card = { type: 'slider', question: 'How many?', min: 0, max: 11, step: 3, default: 10 }
  const { container, unmount } = await mount(toolResult(card))
  const range = container.querySelector('input[type="range"]')
  assert.equal(range.value, '9', 'default 10 shows as 9 (the nearest step that fits)')
  const box = container.querySelector('input[type="number"]')
  await type(box, '11')
  await act(async () => { box.dispatchEvent(new window.FocusEvent('blur', { bubbles: true })); box.dispatchEvent(new window.Event('focusout', { bubbles: true })) })
  assert.equal(container.querySelector('input[type="range"]').value, '9')
  await unmount()
})
