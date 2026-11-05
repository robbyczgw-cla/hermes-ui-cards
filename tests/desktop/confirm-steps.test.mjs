import test, { beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { act, mount, toolResult, click, type, key, buttonByText, resetHost, lastReply, registerPlugin, makeStorage, testHost } from './dom.mjs'

beforeEach(resetHost)
// node:test's MockTimers prints an ExperimentalWarning; keep test output warning-free.
const emitWarning = process.emitWarning
process.emitWarning = (warning, ...rest) => (String(warning).includes('MockTimers') ? undefined : emitWarning.call(process, warning, ...rest))
const confirm = { type: 'confirm', title: 'Delete archived logs?', action: 'Remove the archived logs after checking the backup.' }
const steps = { type: 'steps', title: 'Set up Hermes', steps: Array.from({ length: 6 }, (_, i) => ({ title: `Setup ${i + 1}`, body: `Instructions ${i + 1}`, command: `echo step-${i + 1}` })) }
async function render(t, card, options) {
  const mounted = await mount(toolResult(card), options)
  t.after(mounted.unmount)
  return mounted
}

test('confirm: embedded copy preserves a long command and reports success', async t => {
  const command = 'find /srv/hermes/archives/' + 'long-directory/'.repeat(12) + " -type f -name '*.log' -mtime +90 -delete"
  const registration = registerPlugin()
  const copied = []
  registration.ctx.os.writeClipboard = async text => { copied.push(text); return true }
  const { container } = await render(t, { ...confirm, command }, { registration })
  const block = container.querySelector('.huic-code-block')
  assert.equal(block.querySelector('code').textContent, command)
  const copy = block.querySelector('button[aria-label="Copy"]')
  await click(copy)
  assert.deepEqual(copied, [command])
  assert.equal(copy.getAttribute('aria-label'), 'Copied')
  assert.equal(copy.dataset.copied, 'true')
  assert.equal(testHost.submissions.length, 0)
})

test('confirm: failed clipboard write never shows a false copied state', async t => {
  const registration = registerPlugin()
  registration.ctx.os.writeClipboard = async () => { throw new Error('unavailable') }
  const { container } = await render(t, { ...confirm, command: 'echo hello' }, { registration })
  const button = container.querySelector('.huic-copy')
  await click(button)
  assert.equal(button.getAttribute('aria-label'), 'Copy')
  assert.equal(button.dataset.copied, 'false')
})

test('confirm: long details stack and an absolute path copies in full', async t => {
  const path = '/srv/hermes/projects/production/archives/2026/november/long-session-name/logs.jsonl'
  const registration = registerPlugin()
  let copied
  registration.ctx.os.writeClipboard = async text => { copied = text; return true }
  const { container } = await render(t, { ...confirm, details: [
    { label: 'Directory to remove', value: path }, { label: 'Files', value: '12,480' },
    { label: 'Backup', value: 'The verified backup is available in the separate archive storage.' }
  ] }, { registration })
  const rows = container.querySelectorAll('dl>div')
  assert.ok(rows[0].classList.contains('huic-kv-stacked'))
  assert.ok(!rows[1].classList.contains('huic-kv-stacked'))
  assert.ok(rows[2].classList.contains('huic-kv-stacked'))
  const shown = rows[0].querySelector('.huic-kv-path')
  assert.equal(shown.textContent, path, 'a destructive target is shown in full, never middle-truncated')
  await click(rows[0].querySelector('button'))
  assert.equal(copied, path)
})

test('confirm: risk levels choose quiet, outlined or filled danger actions', async t => {
  for (const [level, variant] of [['low', 'primary'], ['medium', 'danger-outline'], ['high', 'danger']]) {
    const { container } = await render(t, { ...confirm, risk: { level, text: 'Consider the impact.' } })
    assert.ok(buttonByText(container, 'Yes, go ahead').classList.contains(`huic-btn-${variant}`))
    assert.ok(container.querySelector(`.huic-risk-${level}`))
    assert.equal(container.querySelector('.huic-confirm-approval'), null)
  }
  const { container } = await render(t, { ...confirm, command: 'echo hello', lang: 'de' })
  assert.match(container.querySelector('.huic-confirm-approval').textContent, /Hermes.*Freigabe/)
})

test('confirm: Change focuses the editor, Escape restores focus, modifier Enter sends once', async t => {
  const { container } = await render(t, confirm)
  const change = buttonByText(container, 'Change…')
  await click(buttonByText(container, 'Change…'))
  let area = container.querySelector('textarea')
  assert.equal(document.activeElement, area)
  assert.equal(document.getElementById(area.getAttribute('aria-describedby')).textContent, 'Ctrl/⌘+Enter to send')
  await type(area, 'Keep the last 90 days')
  await key(area, 'Escape')
  assert.equal(container.querySelector('textarea'), null)
  assert.equal(document.activeElement, buttonByText(container, 'Change…'))
  await click(buttonByText(container, 'Change…'))
  area = container.querySelector('textarea')
  assert.equal(area.value, 'Keep the last 90 days')
  await act(async () => { area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true })) })
  assert.equal(lastReply().json.change, 'Keep the last 90 days')
  assert.equal(container.querySelector('.huic-confirm-receipt').textContent, 'Change requested')
  assert.ok(container.querySelector('.huic-confirm-receipt svg.huic-ico'), 'line icon, no glyph')
  assert.ok(container.querySelector('.huic-answer[role="status"]'))
  assert.equal(testHost.submissions.length, 1)
})

test('confirm: prominent decisions survive a remount and keep the hook receipt', async t => {
  for (const [button, receipt] of [['Yes, go ahead', 'Approved'], ['No', 'Declined']]) {
    const result = toolResult(confirm)
    const registration = registerPlugin(makeStorage())
    const first = await mount(result, { registration })
    await click(buttonByText(first.container, button))
    assert.equal(first.container.querySelector('.huic-confirm-receipt').textContent, receipt)
    await first.unmount()
    const again = await mount(result, { registration })
    t.after(again.unmount)
    assert.equal(again.container.querySelector('.huic-confirm-receipt').textContent, receipt)
    assert.ok(again.container.querySelector('.huic-answer'))
    assert.equal(buttonByText(again.container, button), undefined)
  }
})

test('steps: map disables future steps and arrows navigate with heading focus', async t => {
  const { container } = await render(t, steps)
  const dots = () => [...container.querySelectorAll('.huic-steps-map button')]
  assert.equal(dots().length, 6)
  assert.equal(dots()[0].getAttribute('aria-current'), 'step')
  assert.ok(dots().slice(1).every(dot => dot.disabled))
  assert.equal(buttonByText(container, 'Back'), undefined)
  await key(dots()[0], 'ArrowRight')
  assert.equal(container.querySelector('h4').textContent, 'Setup 2')
  assert.equal(document.activeElement, container.querySelector('h4'))
  await key(container.querySelector('h4'), 'ArrowRight')
  assert.equal(dots()[2].getAttribute('aria-current'), 'step')
  assert.equal(dots()[0].title, 'Setup 1')
  assert.ok(!dots()[0].disabled)
  await click(dots()[0])
  assert.equal(container.querySelector('h4').textContent, 'Setup 1')
  await key(container.querySelector('h4'), 'ArrowLeft')
  assert.equal(container.querySelector('h4').textContent, 'Setup 1')
  assert.equal(testHost.submissions.length, 0)
})

test('steps: optional stuck note is passed intact as answer.note without navigating inside input', async t => {
  const registration = registerPlugin(makeStorage())
  const { container } = await render(t, steps, { registration })
  await click(buttonByText(container, 'Next'))
  const stuck = buttonByText(container, 'Stuck here')
  assert.ok(stuck.closest('.huic-steps-left'))
  await click(stuck)
  const input = container.querySelector('input')
  assert.equal(document.activeElement, input)
  assert.equal(testHost.submissions.length, 0)
  await type(input, '  Permission denied for the configuration directory  ')
  await key(input, 'ArrowLeft')
  assert.equal(container.querySelector('h4').textContent, 'Setup 2')
  await click(buttonByText(container, 'Send'))
  const record = [...registration.storage.map.entries()].find(([key]) => key.startsWith('answer.'))
  assert.equal(JSON.parse(record[1]).selection.note, 'Permission denied for the configuration directory')
  assert.equal(lastReply().json.stuck, 2)
  assert.equal(container.querySelector('h4').textContent, 'Setup 2')
  assert.equal(container.querySelector('code').textContent, 'echo step-2')
  assert.ok(container.querySelector('.huic-copy'))
  await key(container.querySelector('h4'), 'ArrowLeft')
  assert.equal(container.querySelector('h4').textContent, 'Setup 1')
  assert.equal(testHost.submissions.length, 1)
})

test('steps: stuck cancellation returns focus and empty notes may be sent', async t => {
  const { container } = await render(t, steps)
  await click(buttonByText(container, 'Stuck here'))
  await key(container.querySelector('input'), 'Escape')
  assert.equal(document.activeElement, buttonByText(container, 'Stuck here'))
  assert.equal(container.querySelector('input'), null)
  await click(buttonByText(container, 'Stuck here'))
  await key(container.querySelector('input'), 'Enter')
  assert.equal(lastReply().json.stuck, 1)
  assert.equal(container.querySelector('h4').textContent, 'Setup 1')
})

test('steps: completion leaves all content and navigation readable, inactive cards have no dead controls', async t => {
  const { container } = await render(t, steps)
  for (let i = 0; i < 5; i++) await click(buttonByText(container, 'Next'))
  await click(buttonByText(container, 'Done'))
  assert.equal(lastReply().json.completed, true)
  assert.equal(container.querySelector('code').textContent, 'echo step-6')
  await click(container.querySelector('.huic-steps-map button'))
  assert.equal(container.querySelector('code').textContent, 'echo step-1')
  assert.equal(buttonByText(container, 'Stuck here'), undefined)
  const inactive = await render(t, steps, { sessionId: null })
  assert.ok([...inactive.container.querySelectorAll('.huic-steps-map button')].every(dot => dot.disabled))
  assert.equal(inactive.container.querySelector('.huic-foot'), null)
})

test('confirm: medium and high risk Yes waits 4 s with Undo inside the card; low risk sends at once', async t => {
  mock.timers.enable({ apis: ['setTimeout'] })
  t.after(() => mock.timers.reset())
  for (const level of ['medium', 'high']) {
    resetHost()
    const { container, unmount } = await mount(toolResult({ ...confirm, risk: { level } }))
    const yes = () => buttonByText(container, 'Yes, go ahead')
    await click(yes())
    assert.equal(testHost.submissions.length, 0, `${level}: nothing sent yet`)
    assert.match(container.querySelector('.huic-confirm-pending').textContent, /Approved · sending in 4 s/)
    assert.equal(document.activeElement, buttonByText(container, 'Undo'), 'focus moves to Undo')
    await click(buttonByText(container, 'Undo'))
    assert.equal(document.activeElement, yes(), 'focus returns to Yes')
    await act(async () => mock.timers.tick(5000))
    assert.equal(testHost.submissions.length, 0, 'undone: never sent')
    await click(yes())
    await key(window, 'Escape')
    assert.ok(buttonByText(container, 'Undo'), 'Escape outside the card leaves it pending')
    await key(document.activeElement, 'Escape')
    assert.equal(buttonByText(container, 'Undo'), undefined, 'Escape inside the card takes it back')
    await click(yes())
    await act(async () => mock.timers.tick(4000))
    assert.equal(testHost.submissions.length, 1)
    assert.equal(lastReply().json.decision, 'yes')
    assert.equal(container.querySelector('.huic-confirm-receipt').textContent, 'Approved')
    await unmount()
    const again = await mount(toolResult({ ...confirm, title: `Again ${level}`, risk: { level } }))
    await click(buttonByText(again.container, 'Yes, go ahead'))
    await again.unmount()
    await act(async () => mock.timers.tick(5000))
    assert.equal(testHost.submissions.length, 1, 'nothing is sent after unmount')
  }
  resetHost()
  const low = await render(t, { ...confirm, title: 'Low', risk: { level: 'low' } })
  await click(buttonByText(low.container, 'Yes, go ahead'))
  assert.equal(testHost.submissions.length, 1, 'low risk sends immediately')
  const none = await render(t, { ...confirm, title: 'None' })
  await click(buttonByText(none.container, 'Yes, go ahead'))
  assert.equal(testHost.submissions.length, 2, 'no risk level sends immediately')
})

test('confirm: Change opens a labelled box in place of the buttons', async t => {
  const { container } = await render(t, { ...confirm, risk: { level: 'high' } })
  await click(buttonByText(container, 'Change…'))
  const area = container.querySelector('.huic-confirm-edit textarea')
  assert.ok(area)
  assert.equal(container.querySelector(`label[for="${area.id}"]`).textContent, 'What should be different?')
  assert.equal(buttonByText(container, 'Yes, go ahead'), undefined, 'the decision buttons step aside while editing')
  assert.ok(buttonByText(container, 'Send change').disabled)
})

test('steps: the answered footer keeps what was sent as the receipt (Done, or Stuck with the note)', async t => {
  const done = await render(t, { ...steps, finishLabel: 'All set' })
  for (let i = 0; i < 5; i++) await click(buttonByText(done.container, 'Next'))
  await click(buttonByText(done.container, 'All set'))
  assert.equal(done.container.querySelector('.huic-foot .huic-steps-sent').textContent, 'Sent: All set')
  assert.ok(buttonByText(done.container, 'Back'), 'browsing back still works')

  const stuck = await render(t, { ...steps, title: 'Stuck card' })
  await click(buttonByText(stuck.container, 'Next'))
  await click(buttonByText(stuck.container, 'Stuck here'))
  await type(stuck.container.querySelector('.huic-steps-report input'), 'Permission denied')
  await click(buttonByText(stuck.container, 'Send'))
  const receipt = stuck.container.querySelector('.huic-foot .huic-steps-sent.is-stuck')
  assert.match(receipt.textContent, /^Sent: stuck at step 2/)
  assert.equal(receipt.querySelector('q').textContent, 'Permission denied')
})
