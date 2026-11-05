import assert from 'node:assert/strict'
import { beforeEach, test, mock } from 'node:test'
import { act, buttonByText, click, key, mount, resetHost, testHost, toolResult } from './dom.mjs'
beforeEach(resetHost)

// node:test's MockTimers prints an ExperimentalWarning; keep test output warning-free.
const emitWarning = process.emitWarning
process.emitWarning = (warning, ...rest) => (String(warning).includes('MockTimers') ? undefined : emitWarning.call(process, warning, ...rest))
const card = { type: 'compare', title: 'Bikes', asOf: '8 Nov 2026', columns: [
  { title: 'A', source: { label: 'Shop', url: 'https://shop.at/a' }, pros: ['One', 'Two', 'Three'] },
  { title: 'B', best: true }
], rows: [{ label: 'Price', values: ['€100', '€200'], sources: ['https://shop.at/a', null], best: 0 }] }

test('aligned rows, best, sources and switcher', async () => {
  const { container, unmount } = await mount(toolResult(card))
  for (const row of container.querySelectorAll('[role=row]')) assert.equal(row.children.length, 3)
  assert.deepEqual([...container.querySelectorAll('[role=columnheader] strong')].map(h => h.textContent), ['A', 'B'])
  assert.deepEqual([...container.querySelectorAll('[role=rowheader]')].map(h => h.textContent), ['Price', 'Pros'])
  assert.match(container.querySelector('.huic-compare-best').textContent, /€100/)
  assert.equal(container.querySelector('.huic-compare-best .huic-compare-bestof').textContent, 'Best of 2', 'text marker for narrow views and screen readers')
  assert.equal(container.querySelector('.huic-compare-best .huic-compare-dot').getAttribute('aria-hidden'), 'true')
  assert.equal(container.querySelectorAll('a[href="https://shop.at/a"]').length, 2)
  assert.match(container.textContent, /Prices checked 8 Nov 2026 · 1 sources/)
  const switches = container.querySelectorAll('[role=radio]')
  assert.equal(switches[1].getAttribute('aria-checked'), 'true')
  await key(switches[1], 'ArrowRight')
  assert.equal(switches[0].getAttribute('aria-checked'), 'true')
  await click(buttonByText(container, '+1 more'))
  assert.match(container.textContent, /Three/)
  await unmount()
})

test('no sources note', async () => {
  const { container, unmount } = await mount(toolResult({ type: 'compare', columns: [{ title: 'A' }, { title: 'B' }] }))
  assert.match(container.textContent, /From the model.s knowledge, no web sources/)
  await unmount()
})

test('undo, escape, timeout and unmount cancel', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { container, unmount } = await mount(toolResult(card))
    await click(container.querySelector('button[aria-label="Choose: A"]'))
    assert.equal(testHost.submissions.length, 0)
    assert.ok((document.activeElement) === (buttonByText(container, 'Undo')), 'focus moves to Undo')
    await click(buttonByText(container, 'Undo'))
    assert.ok((document.activeElement) === (container.querySelector('button[aria-label="Choose: A"]')), 'focus returns to Choose')
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 0)
    await click(container.querySelector('button[aria-label="Choose: A"]'))
    await key(window, 'Escape')
    assert.ok(buttonByText(container, 'Undo'), 'Escape outside the card leaves the pick pending')
    const handled = new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    handled.preventDefault()
    await act(async () => { document.activeElement.dispatchEvent(handled) })
    assert.ok(buttonByText(container, 'Undo'), 'an Escape someone already handled is ignored')
    await key(document.activeElement, 'Escape')
    assert.ok((buttonByText(container, 'Undo')) === (undefined))
    assert.ok((document.activeElement) === (container.querySelector('button[aria-label="Choose: A"]')))
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 0)
    await click(container.querySelector('button[aria-label="Choose: B"]'))
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 1)
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 1)
    await unmount()
    const second = await mount(toolResult(card))
    await click(second.container.querySelector('button[aria-label="Choose: A"]'))
    await second.unmount()
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 1)
  } finally { mock.timers.reset() }
})

test('the tinted wash marks the recommendation, then moves to the pick; the badge stays', async () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { container, unmount } = await mount(toolResult(card))
    const washedTitles = () => [...container.querySelectorAll('[role=columnheader].huic-compare-recommended strong')].map(h => h.textContent)
    assert.deepEqual(washedTitles(), ['B'])
    await click(container.querySelector('button[aria-label="Choose: A"]'))
    assert.deepEqual(washedTitles(), ['A'], 'the pending pick is previewed')
    await act(async () => mock.timers.tick(4000))
    assert.deepEqual(washedTitles(), ['A'])
    const headB = [...container.querySelectorAll('[role=columnheader]')][1]
    assert.match(headB.textContent, /Recommended/, 'recommendation keeps its badge')
    assert.match([...container.querySelectorAll('[role=columnheader]')][0].textContent, /Your pick/)
    await unmount()
  } finally { mock.timers.reset() }
})
