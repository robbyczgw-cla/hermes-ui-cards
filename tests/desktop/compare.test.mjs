import assert from 'node:assert/strict'
import { beforeEach, test, mock } from 'node:test'
import { act, buttonByText, click, key, mount, resetHost, testHost, toolResult } from './dom.mjs'
beforeEach(resetHost)
const card = { type: 'compare', title: 'Bikes', asOf: '8 Nov 2026', columns: [
  { title: 'A', source: { label: 'Shop', url: 'https://shop.at/a' }, pros: ['One', 'Two', 'Three'] },
  { title: 'B', best: true }
], rows: [{ label: 'Price', values: ['€100', '€200'], sources: ['https://shop.at/a', null], best: 0 }] }

test('aligned rows, best, sources and switcher', async () => {
  const { container, unmount } = await mount(toolResult(card))
  for (const row of container.querySelectorAll('[role=row]')) assert.equal(row.children.length, 3)
  assert.match(container.querySelector('.huic-compare-best').textContent, /€100/)
  assert.equal(container.querySelector('.huic-compare-best [aria-label=best]').textContent, '● ')
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
    await click(buttonByText(container, 'Undo'))
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 0)
    await click(container.querySelector('button[aria-label="Choose: A"]'))
    await key(window, 'Escape')
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
