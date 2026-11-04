import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { act, mount, toolResult, registerPlugin, makeStorage, click, type, buttonByText, lastReply, resetHost, testHost, mod } from './dom.mjs'

beforeEach(resetHost)

async function altKey(el, keyName) {
  await act(async () => {
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: keyName, altKey: true, bubbles: true }))
  })
}
async function press(el, keyName, extra = {}) {
  await act(async () => {
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: keyName, bubbles: true, ...extra }))
  })
}
const wait = ms => act(() => new Promise(resolve => setTimeout(resolve, ms)))
const titles = c => [...c.querySelectorAll('.huic-plan-title')].map(e => e.textContent)
const live = c => c.querySelector('[aria-live="polite"]').textContent

// ── plan ──

const plan = {
  type: 'plan', title: 'Migrate the database', summary: 'Postgres 14 → 16',
  steps: [
    { title: 'Back up', command: 'pg_dump app > app.sql', risk: 'low' },
    { title: 'Stop workers', optional: true },
    { title: 'Run migration', risk: 'high', detail: 'Takes ~5 min' },
    { title: 'Smoke test', optional: true }
  ]
}

test('plan: Alt+arrows reorder with focus kept and announced, optional steps switch off, notes go into the reply', async () => {
  const m = await mount(toolResult(plan))
  const c = m.container
  assert.deepEqual(titles(c), ['Back up', 'Stop workers', 'Run migration', 'Smoke test'])
  // Only optional steps have a switch; required ones stay on.
  const switches = c.querySelectorAll('input[role="switch"]')
  assert.equal(switches.length, 2)
  assert.equal(switches[0].getAttribute('aria-label'), 'Run step: Stop workers')

  const down = c.querySelector('[data-step="p4"] [data-plan-focus="down"]')
  assert.equal(down.disabled, true, 'last step cannot move down')
  const up = c.querySelector('[data-step="p4"] [data-plan-focus="up"]')
  up.focus()
  await altKey(up, 'ArrowUp')
  assert.deepEqual(titles(c), ['Back up', 'Stop workers', 'Smoke test', 'Run migration'])
  assert.equal(document.activeElement, c.querySelector('[data-step="p4"] [data-plan-focus="up"]'), 'focus stays on the moved step')
  assert.equal(live(c), 'Smoke test moved to position 3 of 4.')
  await click(c.querySelector('[data-step="p4"] [data-plan-focus="up"]'))
  assert.deepEqual(titles(c), ['Back up', 'Smoke test', 'Stop workers', 'Run migration'])
  assert.match(c.querySelector('.huic-foot').textContent, /4 of 4 steps will run · reordered/)

  await click(c.querySelector('[data-step="p2"] input[role="switch"]'))
  assert.ok(c.querySelector('[data-step="p2"]').classList.contains('is-off'))
  assert.match(c.querySelector('[data-step="p2"]').textContent, /skipped/)
  assert.match(c.querySelector('.huic-foot').textContent, /3 of 4 steps will run/)

  const noteBtn = c.querySelector('[data-step="p3"] [data-plan-focus="notebtn"]')
  assert.equal(noteBtn.getAttribute('aria-expanded'), 'false')
  await click(noteBtn)
  const note = c.querySelector('[data-step="p3"] input[data-plan-focus="note"]')
  assert.equal(document.activeElement, note, 'opening a note focuses it')
  assert.equal(note.getAttribute('aria-label'), 'Note for step 4: Run migration')
  await type(note, '  only after 22:00  ')
  // A high-risk step is included: the run button says so with its colour and the hint.
  assert.match(c.querySelector('.huic-foot').textContent, /includes a high-risk step/)
  await click(buttonByText(c, 'Run plan'))
  const r = lastReply()
  assert.equal(r.line1, '✓ Run the plan: 3 of 4 steps · skipped: Stop workers · reordered')
  assert.deepEqual(r.json.steps, [
    { id: 'p1', title: 'Back up', included: true },
    { id: 'p4', title: 'Smoke test', included: true },
    { id: 'p2', title: 'Stop workers', included: false },
    { id: 'p3', title: 'Run migration', included: true, note: 'only after 22:00' }
  ])
  // Locked: no controls, final order and the note stay visible.
  assert.equal(c.querySelectorAll('.huic-plan-ctrl').length, 0)
  assert.equal(buttonByText(c, 'Run plan'), undefined)
  assert.deepEqual(titles(c), ['Back up', 'Smoke test', 'Stop workers', 'Run migration'])
  assert.match(c.textContent, /only after 22:00/)
  assert.match(c.querySelector('.huic-answer').textContent, /Run the plan: 3 of 4 steps/)
  await m.unmount()
})

test('plan: drag the step number onto another step', async () => {
  const m = await mount(toolResult(plan))
  const c = m.container
  const data = { effectAllowed: '', setData() {}, setDragImage() {} }
  const fire = async (el, name, init = {}) => act(async () => {
    const e = new window.Event(name, { bubbles: true, cancelable: true })
    Object.assign(e, { dataTransfer: data, clientY: 0, ...init })
    el.dispatchEvent(e)
  })
  await fire(c.querySelector('[data-step="p1"] .huic-plan-node'), 'dragstart')
  assert.ok(c.querySelector('[data-step="p1"]').classList.contains('is-dragging'))
  await fire(c.querySelector('[data-step="p3"]'), 'dragover', { clientY: 5 })
  assert.ok(c.querySelector('[data-step="p3"]').classList.contains('is-drop-after'))
  await fire(c.querySelector('[data-step="p3"]'), 'drop', { clientY: 5 })
  assert.deepEqual(titles(c), ['Stop workers', 'Run migration', 'Back up', 'Smoke test'])
  assert.equal(c.querySelectorAll('.is-dragging').length, 0)
  await m.unmount()
})

test('plan: order, switches and notes survive reopening; German line 1', async () => {
  const registration = registerPlugin(makeStorage())
  const result = toolResult({ ...plan, lang: 'de' })
  let m = await mount(result, { registration })
  await altKey(m.container.querySelector('[data-step="p2"] [data-plan-focus="down"]'), 'ArrowDown')
  await click(m.container.querySelector('[data-step="p4"] input[role="switch"]'))
  await click(m.container.querySelector('[data-step="p1"] [data-plan-focus="notebtn"]'))
  await type(m.container.querySelector('[data-step="p1"] input[data-plan-focus="note"]'), 'vorher Platz prüfen')
  assert.equal(live(m.container), 'Stop workers ist jetzt an Position 3 von 4.')
  await m.unmount()

  m = await mount(result, { registration })
  const c = m.container
  assert.deepEqual(titles(c), ['Back up', 'Run migration', 'Stop workers', 'Smoke test'])
  assert.equal(c.querySelector('[data-step="p4"] input[role="switch"]').checked, false)
  assert.equal(c.querySelector('[data-step="p1"] input[data-plan-focus="note"]').value, 'vorher Platz prüfen')
  assert.match(c.querySelector('.huic-foot').textContent, /3 von 4 Schritten werden ausgeführt · neu geordnet/)
  await click(buttonByText(c, 'Plan ausführen'))
  assert.equal(lastReply().line1, '✓ Plan ausführen: 3 von 4 Schritten · übersprungen: Smoke test · neu geordnet')
  await m.unmount()
})

test('plan: unchanged plan has a plain line 1; all optional steps off disables Run', async () => {
  let m = await mount(toolResult({ type: 'plan', title: 'Tidy up', steps: [{ title: 'A', optional: true }, { title: 'B', optional: true }], runLabel: 'Go' }))
  for (const s of m.container.querySelectorAll('input[role="switch"]')) await click(s)
  assert.equal(buttonByText(m.container, 'Go').disabled, true)
  assert.match(m.container.querySelector('.huic-foot').textContent, /Switch on at least one step/)
  await click(m.container.querySelector('input[role="switch"]'))
  await click(buttonByText(m.container, 'Go'))
  assert.equal(lastReply().line1, '✓ Run the plan: 1 of 2 steps · skipped: B')
  await m.unmount()
  m = await mount(toolResult({ type: 'plan', title: 'One', steps: [{ title: 'Only step' }] }))
  assert.equal(m.container.querySelectorAll('[data-plan-focus="up"]').length, 0, 'no move buttons for a single step')
  await click(buttonByText(m.container, 'Run plan'))
  assert.equal(lastReply().line1, '✓ Run the plan: 1 of 1 steps')
  await m.unmount()
})

test('plan: no actions without a chat session (no dead buttons)', async () => {
  const m = await mount(toolResult(plan), { sessionId: null })
  assert.equal(m.container.querySelectorAll('.huic-plan-ctrl').length, 0)
  assert.equal(buttonByText(m.container, 'Run plan'), undefined)
  assert.equal(m.container.querySelectorAll('.huic-plan-step').length, 4)
  await m.unmount()
})

// ── review ──

const review = {
  type: 'review', title: 'Suggested replies', summary: 'Pick which drafts to send',
  items: [
    { title: 'Reply to Anna', tag: 'work', preview: 'Hi Anna,\nthanks for the update.' },
    { title: 'Reply to newsletter', detail: 'Unsubscribe request' },
    { title: 'Reply to landlord', preview: 'line 1\nline 2\nline 3\nline 4\nline 5' }
  ]
}

const decisionOf = (c, id) => c.querySelector(`[data-item="${id}"]`).dataset.decision

test('review: bulk, individual decisions, comment, Apply reply with titles', async () => {
  const m = await mount(toolResult(review))
  const c = m.container
  assert.equal(decisionOf(c, 'r1'), 'none')
  assert.match(c.querySelector('.huic-foot').textContent, /3 still open, sent as undecided/)
  await click(buttonByText(c, 'Keep all'))
  assert.deepEqual(['r1', 'r2', 'r3'].map(id => decisionOf(c, id)), ['keep', 'keep', 'keep'])
  assert.equal(live(c), 'All 3 set to Keep.')
  assert.match(c.querySelector('.huic-foot').textContent, /All 3 decided/)
  const drop2 = c.querySelector('[data-item="r2"] [role="radio"].is-drop')
  await click(drop2)
  assert.equal(drop2.getAttribute('aria-checked'), 'true')
  assert.equal(drop2.tabIndex, 0)
  assert.equal(c.querySelector('[data-item="r2"] [role="radio"].is-keep').tabIndex, -1, 'one tab stop per row')
  assert.match(c.querySelector('.huic-rev-counts').textContent, /2 Keep.*1 Drop.*0 Open/)

  // Long previews are clamped behind a disclosure; short ones are not.
  assert.equal(c.querySelector('[data-item="r1"] .huic-rev-link'), null)
  const more = c.querySelector('[data-item="r3"] .huic-rev-link')
  assert.ok(c.querySelector('[data-item="r3"] pre').classList.contains('is-clamped'))
  await click(more)
  assert.equal(more.getAttribute('aria-expanded'), 'true')
  assert.ok(!c.querySelector('[data-item="r3"] pre').classList.contains('is-clamped'))

  await click(c.querySelector('[data-item="r2"] .huic-rev-icon'))
  const note = c.querySelector('[data-item="r2"] .huic-rev-note')
  assert.equal(document.activeElement, note)
  await type(note, 'they never read it ')
  await click(buttonByText(c, 'Apply'))
  const r = lastReply()
  assert.equal(r.line1, '✓ Review done: keep 2, drop 1')
  assert.deepEqual(r.json.keep, ['r1', 'r3'])
  assert.deepEqual(r.json.drop, ['r2'])
  assert.deepEqual(r.json.undecided, [])
  assert.deepEqual(r.json.notes, { r2: 'they never read it' })
  assert.deepEqual(r.json.titles, { r1: 'Reply to Anna', r2: 'Reply to newsletter', r3: 'Reply to landlord' })
  // Locked: stamps instead of controls.
  assert.equal(c.querySelectorAll('[role="radio"]').length, 0)
  assert.equal(buttonByText(c, 'Keep all'), undefined)
  assert.deepEqual([...c.querySelectorAll('.huic-rev-stamp')].map(e => e.textContent), ['Kept', 'Dropped', 'Kept'])
  assert.match(c.textContent, /they never read it/)
  await m.unmount()
})

test('review: arrow keys switch, keep-the-rest, reset, undecided count and German line 1', async () => {
  const m = await mount(toolResult({ ...review, lang: 'de' }))
  const c = m.container
  const keep1 = c.querySelector('[data-item="r1"] [role="radio"].is-keep')
  keep1.focus()
  await press(keep1, 'ArrowRight')
  assert.equal(decisionOf(c, 'r1'), 'drop')
  assert.equal(document.activeElement, c.querySelector('[data-item="r1"] [role="radio"].is-drop'))
  await click(buttonByText(c, 'Restliche 2 behalten'))
  assert.deepEqual(['r1', 'r2', 'r3'].map(id => decisionOf(c, id)), ['drop', 'keep', 'keep'])
  await click(buttonByText(c, 'Zurücksetzen'))
  assert.deepEqual(['r1', 'r2', 'r3'].map(id => decisionOf(c, id)), ['none', 'none', 'none'])
  assert.equal(buttonByText(c, 'Zurücksetzen'), undefined)
  await click(c.querySelector('[data-item="r3"] [role="radio"].is-drop'))
  await click(buttonByText(c, 'Übernehmen'))
  const r = lastReply()
  assert.equal(r.line1, '✓ Durchgesehen: 0 behalten, 1 verwerfen, 2 offen')
  assert.deepEqual(r.json.undecided, ['r1', 'r2'])
  await m.unmount()
})

test('review: defaultDecision, custom labels and draft restore', async () => {
  const registration = registerPlugin(makeStorage())
  const result = toolResult({ ...review, defaultDecision: 'keep', keepLabel: 'Send', dropLabel: 'Skip', applyLabel: 'Send replies' })
  let m = await mount(result, { registration })
  assert.deepEqual(['r1', 'r2', 'r3'].map(id => decisionOf(m.container, id)), ['keep', 'keep', 'keep'])
  await click(m.container.querySelector('[data-item="r2"] [role="radio"].is-drop'))
  await click(m.container.querySelector('[data-item="r1"] .huic-rev-icon'))
  await type(m.container.querySelector('[data-item="r1"] .huic-rev-note'), 'shorter please')
  await m.unmount()
  m = await mount(result, { registration })
  const c = m.container
  assert.deepEqual(['r1', 'r2', 'r3'].map(id => decisionOf(c, id)), ['keep', 'drop', 'keep'])
  assert.equal(c.querySelector('[data-item="r1"] .huic-rev-note').value, 'shorter please')
  assert.equal(c.querySelector('[data-item="r2"] [role="radio"].is-drop').textContent, 'Skip')
  assert.ok(buttonByText(c, 'Send all') && buttonByText(c, 'Skip all'), 'bulk actions use the custom labels')
  await click(buttonByText(c, 'Send replies'))
  assert.equal(lastReply().line1, '✓ Review done: keep 2, drop 1')
  assert.deepEqual(lastReply().json.notes, { r1: 'shorter please' })
  await m.unmount()
})

test('review: 30 long items still send, without the titles map when it would not fit', async () => {
  const long = 'x'.repeat(76)
  const card = { type: 'review', title: 'Files to delete', items: Array.from({ length: 30 }, (_, i) => ({ title: `${i + 1} ${long}` })) }
  const m = await mount(toolResult(card))
  await click(buttonByText(m.container, 'Drop all'))
  for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    await click(m.container.querySelector(`[data-item="r${i}"] .huic-rev-icon`))
    await type(m.container.querySelector(`[data-item="r${i}"] .huic-rev-note`), 'n'.repeat(250))
  }
  await click(buttonByText(m.container, 'Apply'))
  const r = lastReply()
  assert.equal(r.line1, '✓ Review done: keep 0, drop 30')
  assert.equal(r.json.titles, undefined)
  assert.equal(r.json.notes.r1.length, 200, 'comments are capped')
  assert.ok([...r.text].length <= 4000)
  // A short review keeps the titles map.
  const reply = mod.buildReply(mod.validateCard(review).card, { keep: ['r1'], drop: [], undecided: ['r2', 'r3'], notes: {} }, 'en')
  assert.ok(reply.data.titles)
  await m.unmount()
})

// ── calc ──

const loan = {
  type: 'calc', title: 'Loan calculator', currency: 'EUR',
  inputs: [
    { name: 'amount', label: 'Loan amount', default: 250000, min: 1000, unit: '€' },
    { name: 'rate', label: 'Interest rate', kind: 'slider', default: 4.5, min: 0, max: 10, step: 0.05, unit: '%' },
    { name: 'years', label: 'Term', kind: 'select', default: 25, options: [{ label: '10 years', value: 10 }, { label: '15 years', value: 15 }, { label: '20 years', value: 20 }, { label: '25 years', value: 25 }, { label: '30 years', value: 30 }] }
  ],
  outputs: [
    { label: 'Monthly payment', expr: 'amount * (rate / 1200) / (1 - (1 + rate / 1200) ^ (-years * 12))', format: 'currency', emphasis: true },
    { label: 'Total interest', expr: 'amount * (rate / 1200) / (1 - (1 + rate / 1200) ^ (-years * 12)) * years * 12 - amount', format: 'currency', decimals: 0 }
  ]
}

const heroText = c => c.querySelector('.huic-calc-hero-value').textContent
const rowText = c => [...c.querySelectorAll('.huic-calc-row')].map(r => r.textContent)

test('calc: outputs recompute on every change; division by zero shows "–"; Send sends inputs and outputs', async () => {
  const m = await mount(toolResult(loan))
  const c = m.container
  assert.equal(heroText(c), '1,389.58 €')
  assert.deepEqual(rowText(c), ['Total interest166,874 €'])
  const amount = c.querySelector('input[aria-label="Loan amount (€)"]')
  await type(amount, '300,000')
  assert.equal(heroText(c), '1,667.50 €')
  // Rate 0 → (1 - 1^-300) = 0 → division by zero: a dash, never NaN.
  const rateBox = c.querySelector('input[aria-label="Interest rate (%)"]')
  await type(rateBox, '0')
  assert.equal(heroText(c), '–')
  assert.doesNotMatch(c.textContent, /NaN|Infinity/)
  assert.match(c.textContent, /Not possible with these values/)
  const range = c.querySelector('input[type="range"]')
  assert.equal(range.value, '0')
  await type(range, '5')
  assert.equal(rateBox.value, '5')
  // Five options: a native select.
  const select = c.querySelector('select')
  await type(select, '0')
  assert.equal(heroText(c), '3,181.97 €')
  await click(buttonByText(c, 'Send'))
  const r = lastReply()
  assert.equal(r.line1, '✓ Calculated: Monthly payment 3,181.97 €')
  assert.deepEqual(r.json.inputs, { amount: 300000, rate: 5, years: 10 })
  assert.deepEqual(r.json.outputs, [{ label: 'Monthly payment', value: 3181.97 }, { label: 'Total interest', value: 81836 }])
  // Locked: inputs disabled, values kept.
  assert.ok(c.querySelector('select').disabled)
  assert.equal(c.querySelector('input[aria-label="Loan amount (€)"]').value, '300,000')
  assert.equal(buttonByText(c, 'Send'), undefined)
  await m.unmount()
})

test('calc: invalid and out-of-range input marks the field and blocks Send; screen readers hear the new result', async () => {
  const m = await mount(toolResult(loan))
  const c = m.container
  const amount = c.querySelector('input[aria-label="Loan amount (€)"]')
  await type(amount, 'abc')
  assert.equal(amount.getAttribute('aria-invalid'), 'true')
  assert.match(c.textContent, /Enter a number\./)
  assert.equal(heroText(c), '–')
  assert.equal(buttonByText(c, 'Send').disabled, true)
  await type(amount, '500')
  assert.match(c.textContent, /At least 1,000\./)
  await type(amount, '200000')
  assert.equal(amount.getAttribute('aria-invalid'), null)
  assert.equal(buttonByText(c, 'Send').disabled, false)
  await press(amount, 'ArrowUp')
  assert.equal(amount.value, '200001')
  await act(async () => { amount.focus(); amount.blur() })
  assert.equal(amount.value, '200,001', 'grouped again after editing')
  await wait(700)
  assert.match(live(c), /^Monthly payment: 1,111\.6\d €; Total interest: /)
  await m.unmount()
})

const split = {
  type: 'calc', title: 'Split the bill', lang: 'de', currency: 'EUR', note: 'Trinkgeld wird auf alle verteilt.',
  inputs: [
    { name: 'total', label: 'Rechnung', default: 186.4, unit: '€' },
    { name: 'people', label: 'Personen', kind: 'slider', default: 4, min: 1, max: 12, step: 1 },
    { name: 'tip', label: 'Trinkgeld', kind: 'select', default: 0.1, options: [{ label: 'Kein', value: 0 }, { label: '10 %', value: 0.1 }, { label: '15 %', value: 0.15 }] },
    { name: 'roundup', label: 'Auf volle Euro aufrunden', kind: 'toggle', default: 0 }
  ],
  outputs: [
    { label: 'Pro Person', expr: 'if(roundup, ceil(total * (1 + tip) / people), total * (1 + tip) / people)', format: 'currency', emphasis: true },
    { label: 'Trinkgeld', expr: 'tip', format: 'percent', decimals: 0 },
    { label: 'Trinkgeld gesamt', expr: 'total * tip', format: 'currency' }
  ]
}

test('calc: segmented select, toggle, percent and German formats; draft restore', async () => {
  const registration = registerPlugin(makeStorage())
  const result = toolResult(split)
  let m = await mount(result, { registration })
  let c = m.container
  assert.equal(heroText(c), '51,26 €')
  assert.deepEqual(rowText(c), ['Trinkgeld10 %', 'Trinkgeld gesamt18,64 €'])
  const radios = c.querySelectorAll('[role="radiogroup"] [role="radio"]')
  assert.equal(radios.length, 3)
  assert.equal(radios[1].getAttribute('aria-checked'), 'true')
  radios[1].focus()
  await press(radios[1], 'ArrowRight')
  assert.equal(radios[2].getAttribute('aria-checked'), 'true')
  assert.equal(document.activeElement, radios[2])
  assert.equal(heroText(c), '53,59 €')
  await click(c.querySelector('input[role="switch"]'))
  assert.equal(heroText(c), '54,00 €')
  // German decimal comma is understood.
  assert.equal(c.querySelector('input[inputmode="decimal"]').value, '186,4')
  await type(c.querySelector('input[inputmode="decimal"]'), '1.200,5')
  assert.equal(heroText(c), '346,00 €', 'German grouping and decimal comma')
  await type(c.querySelector('input[inputmode="decimal"]'), '200,50')
  assert.equal(heroText(c), '58,00 €')
  await m.unmount()

  m = await mount(result, { registration })
  c = m.container
  assert.equal(c.querySelector('input[inputmode="decimal"]').value, '200,50')
  assert.equal(c.querySelector('input[role="switch"]').checked, true)
  assert.equal(c.querySelectorAll('[role="radio"]')[2].getAttribute('aria-checked'), 'true')
  assert.equal(heroText(c), '58,00 €')
  assert.match(c.textContent, /Trinkgeld wird auf alle verteilt\./)
  await click(buttonByText(c, 'Senden'))
  const r = lastReply()
  assert.equal(r.line1, '✓ Berechnet: Pro Person 58,00 €')
  assert.deepEqual(r.json.inputs, { total: 200.5, people: 4, tip: 0.15, roundup: 1 })
  assert.deepEqual(r.json.outputs, [{ label: 'Pro Person', value: 58 }, { label: 'Trinkgeld', value: 0.15 }, { label: 'Trinkgeld gesamt', value: 30.08 }])
  await m.unmount()
})

test('calc: number and integer formats, units, other currencies and the first output as headline', async () => {
  const card = mod.validateCard({
    type: 'calc', title: 'Paint', currency: 'CHF',
    inputs: [{ name: 'area', label: 'Wall area', default: 37, unit: 'm²' }, { name: 'coats', label: 'Coats', kind: 'slider', default: 2, min: 1, max: 3 }],
    outputs: [
      { label: 'Paint needed', expr: 'area * coats / 10', unit: 'l', decimals: 1 },
      { label: 'Tins', expr: 'ceil(area * coats / 10 / 2.5)', format: 'integer' },
      { label: 'Cost', expr: 'ceil(area * coats / 10 / 2.5) * 39.9', format: 'currency' },
      { label: 'Bad', expr: 'sqrt(0 - area)' }
    ]
  }).card
  const m = await mount(toolResult(card))
  const c = m.container
  assert.equal(heroText(c), '7.4 l')
  assert.deepEqual(rowText(c), ['Tins3', 'Cost119.70 CHF', 'Bad–'])
  await click(buttonByText(c, 'Send'))
  assert.equal(lastReply().line1, '✓ Calculated: Paint needed 7.4 l')
  assert.equal(lastReply().json.outputs[3].value, null)
  await m.unmount()
})

test('calc: inactive chat shows the values but no Send button', async () => {
  const m = await mount(toolResult(loan), { sessionId: null })
  assert.equal(buttonByText(m.container, 'Send'), undefined)
  assert.equal(heroText(m.container), '1,389.58 €')
  assert.equal(testHost.submissions.length, 0)
  await m.unmount()
})
