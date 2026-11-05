import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { mount, toolResult, registerPlugin, makeStorage, click, type, buttonByText, lastReply, resetHost, testHost } from './dom.mjs'

beforeEach(resetHost)

test('checklist groups show counts, collapse when complete, and reopen without changing ticks', async () => {
  const m = await mount(toolResult({ type: 'checklist', items: [
    { text: 'Passport', category: 'Documents', checked: true },
    { text: 'Tickets', category: 'Documents', checked: true },
    { text: 'Socks', category: 'Clothes' }
  ] }))
  const group = buttonByText(m.container, 'Documents · 2/2')
  assert.equal(group.getAttribute('aria-expanded'), 'false')
  const content = document.getElementById(group.getAttribute('aria-controls'))
  assert.equal(content.hidden, true)
  await click(group)
  assert.equal(content.hidden, false)
  assert.equal(group.getAttribute('aria-expanded'), 'true')
  await click(content.querySelector('label'))
  assert.equal(content.querySelector('input').checked, false, 'whole row toggles')
  assert.match(group.textContent, /Documents · 1\/2/)
  await click(buttonByText(m.container, 'Done'))
  assert.deepEqual(lastReply().json.done, ['Tickets'])
  assert.ok(content.querySelector('input').disabled)
  await m.unmount()
})

test('the last tick closes a group and puts focus on its disclosure', async () => {
  const m = await mount(toolResult({ type: 'checklist', items: [{ text: 'Passport', category: 'Documents' }] }))
  await click(m.container.querySelector('input'))
  const heading = m.container.querySelector('[aria-expanded]')
  assert.equal(heading.getAttribute('aria-expanded'), 'false')
  assert.ok((document.activeElement) === (heading))
  assert.ok(m.container.querySelector('.huic-check-row.is-checked'))
  await click(heading)
  assert.equal(heading.getAttribute('aria-expanded'), 'true')
  await m.unmount()
})

test('checklist save feedback and resume hint follow persisted ticks, including unticking all', async () => {
  const registration = registerPlugin(makeStorage())
  const result = toolResult({ type: 'checklist', items: [{ text: 'Passport' }, { text: 'Tickets' }] })
  let m = await mount(result, { registration })
  assert.doesNotMatch(m.container.textContent, /Saved automatically|Picked up/)
  await click(m.container.querySelector('label'))
  assert.match(m.container.textContent, /Saved automatically · 1 of 2/)
  assert.doesNotMatch(m.container.textContent, /Picked up/)
  await m.unmount()
  m = await mount(result, { registration })
  assert.match(m.container.textContent, /Picked up where you left off/)
  assert.equal(m.container.querySelector('input').checked, true)
  await click(m.container.querySelector('label'))
  assert.doesNotMatch(m.container.textContent, /Picked up/)
  assert.match(m.container.textContent, /Saved automatically · 0 of 2/)
  await m.unmount()
})

test('German checklist saving and category counts use German chrome', async () => {
  const m = await mount(toolResult({ type: 'checklist', lang: 'de', items: [{ text: 'Reisepass', category: 'Dokumente' }, { text: 'Ladekabel' }] }))
  await click(m.container.querySelector('input'))
  assert.match(m.container.textContent, /Automatisch gespeichert · 1 von 2/)
  assert.match(m.container.textContent, /Dokumente · 1\/1/)
  await m.unmount()
})

const form = { type: 'form', fields: [
  { name: 'title', label: 'Title', kind: 'text', required: true },
  { name: 'steps', label: 'Steps', kind: 'textarea', required: true },
  { name: 'severity', label: 'Severity', kind: 'select', options: ['Low', 'High'], required: true },
  { name: 'repro', label: 'Can reproduce', kind: 'toggle' },
  { name: 'date', label: 'Date', kind: 'date', required: true }
] }

test('form progress stays live, validation runs on submit, draft and switch values survive reopening', async () => {
  const registration = registerPlugin(makeStorage())
  const result = toolResult(form)
  let m = await mount(result, { registration })
  assert.match(m.container.textContent, /0 of 4 required filled/)
  assert.doesNotMatch(m.container.textContent, /Draft saved/)
  assert.equal(m.container.querySelector('select option').textContent, 'Please choose')
  assert.equal(buttonByText(m.container, 'Submit').disabled, false)
  await click(buttonByText(m.container, 'Submit'))
  assert.equal(testHost.submissions.length, 0)
  assert.match(m.container.textContent, /Please fill this in/)
  assert.ok((document.activeElement) === (m.container.querySelector('input[type="text"]')))
  await type(m.container.querySelector('input[type="text"]'), 'Chat stops scrolling')
  await type(m.container.querySelector('textarea'), 'Open a long conversation')
  assert.match(m.container.textContent, /2 of 4 required filled/)
  assert.match(m.container.textContent, /Draft saved/)
  await click(m.container.querySelector('label.huic-switch-label'))
  assert.equal(m.container.querySelector('[role="switch"]').checked, true)
  await m.unmount()
  m = await mount(result, { registration })
  assert.match(m.container.textContent, /2 of 4 required filled/)
  assert.match(m.container.textContent, /Draft saved/)
  assert.equal(m.container.querySelector('[role="switch"]').checked, true)
  await type(m.container.querySelector('select'), 'High')
  await type(m.container.querySelector('input[type="date"]'), '2026-11-05')
  assert.match(m.container.textContent, /4 of 4 required filled/)
  await click(buttonByText(m.container, 'Submit'))
  assert.equal(lastReply().json.values.repro, true)
  assert.equal(lastReply().json.values.date, '2026-11-05')
  assert.ok(m.container.querySelector('[role="switch"]').disabled)
  assert.ok((buttonByText(m.container, 'Submit')) === (undefined))
  await m.unmount()
})

test('form date fields carry no fixed format hint (the native picker shows the locale), in both languages', async () => {
  for (const [lang, choose, saved] of [
    ['en', 'Please choose', 'Draft saved'],
    ['de', 'Bitte wählen', 'Entwurf gespeichert']
  ]) {
    const m = await mount(toolResult({ ...form, lang }))
    const input = m.container.querySelector('input[type="date"]')
    assert.doesNotMatch(m.container.textContent, /dd\/mm|TT\.MM/)
    assert.equal(input.lang, lang === 'de' ? 'de-DE' : 'en-GB')
    assert.equal(m.container.querySelector('select option').textContent, choose)
    await type(input, '2026-11-05')
    assert.ok(m.container.textContent.includes(saved))
    const full = [...m.container.querySelectorAll('.huic-form-wide')]
    assert.equal(full.filter(el => el.classList.contains('huic-field')).length, 2)
    await m.unmount()
  }
})

test('form: Submit stays quiet until every required field has a value, clicking early still validates', async () => {
  const m = await mount(toolResult({ type: 'form', title: 'Book', submitLabel: 'Book', fields: [
    { name: 'name', label: 'Name', kind: 'text', required: true },
    { name: 'guests', label: 'Guests', kind: 'number', required: true },
    { name: 'note', label: 'Note', kind: 'text' }
  ] }))
  const submit = () => buttonByText(m.container, 'Book')
  assert.ok(!submit().classList.contains('huic-btn-primary'), 'quiet while required fields are empty')
  await click(submit())
  assert.equal(testHost.submissions.length, 0)
  assert.ok(m.container.querySelector('[aria-invalid="true"]'), 'early click marks what is missing')
  await type(m.container.querySelector('input[aria-required="true"]'), 'Anna')
  assert.ok(!submit().classList.contains('huic-btn-primary'))
  await type(m.container.querySelectorAll('input[aria-required="true"]')[1], '4')
  assert.ok(submit().classList.contains('huic-btn-primary'), 'primary once all required are filled')
  await click(submit())
  assert.deepEqual(lastReply().json.values, { name: 'Anna', guests: 4, note: null })
  await m.unmount()

  const optionalOnly = await mount(toolResult({ type: 'form', submitLabel: 'Book', fields: [{ name: 'note', label: 'Note', kind: 'text' }] }))
  assert.ok(buttonByText(optionalOnly.container, 'Book').classList.contains('huic-btn-primary'), 'nothing required: primary from the start')
  await optionalOnly.unmount()
})
