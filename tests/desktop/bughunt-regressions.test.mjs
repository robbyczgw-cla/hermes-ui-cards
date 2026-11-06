import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { act, mod, plugin, mount, toolResult, registerPlugin, makeStorage, resetHost, click, type, buttonByText, lastReply, testHost } from './dom.mjs'
beforeEach(resetHost)

test('invalid date and time defaults are rejected', () => {
  for (const [kind, value] of [['date', '2026-02-30'], ['time', '25:60']]) {
    assert.equal(mod.validateCard({type:'form', fields:[{name:'x',label:'X',kind,required:true,default:value}]}).card, null)
  }
})
test('schedule renders accepted offset minute overflow safely', async () => {
  const m = await mount(toolResult({type:'schedule',slots:[{start:'2026-11-12T14:00+01:60'}]}))
  assert.match(m.container.textContent, /2026-11-12T14:00\+01:60/)
  await m.unmount()
})
test('malformed restored flashcards remain renderable', async () => {
  for (const [index, data] of [{known:[],again:[99],rounds:1}, {}, {known:[0],again:[0],rounds:1}, {known:[0],again:[],rounds:4}].entries()) {
    const cardId = `flash-malformed-${index}-0123456789`
    const reg = registerPlugin(makeStorage())
    reg.ctx.rest = async path => path.startsWith('/answers') ? {answers:{[cardId]:{data:{card:cardId,type:'flashcards',...data},summary:'Again',at:Date.now()}}} : {}
    plugin.register(reg.ctx)
    const m = await mount(toolResult({type:'flashcards',title:'Study',cardId,cards:[{front:'One',back:'Two'}]}),{registration:reg})
    await act(async () => { await mod.serverIdle() })
    assert.ok(m.container.querySelector('[data-card-type=flashcards]'))
    await m.unmount()
  }
})
test('large recipe sends every missing ingredient', async () => {
  const ingredients = Array.from({length:40},(_,i)=>({id:`g${i+1}`,item:`Ingredient ${i+1} `+'x'.repeat(64)}))
  const m = await mount(toolResult({type:'recipe',title:'Banquet',servings:4,ingredients}))
  await click(buttonByText(m.container, 'Shopping list'))
  assert.equal(lastReply().json.missing.length, 40)
  await m.unmount()
})
test('server restored compare marks the selected column', async () => {
  const cardId = 'compare-server-0123456789', reg = registerPlugin(makeStorage())
  reg.ctx.rest = async path => path.startsWith('/answers') ? {answers:{[cardId]:{data:{card:cardId,type:'compare',selected:'b',label:'B'},summary:'Chose: B',at:Date.now()}}} : {}
  plugin.register(reg.ctx)
  const m = await mount(toolResult({type:'compare',cardId,columns:[{id:'a',title:'A',best:true},{id:'b',title:'B'}]}),{registration:reg})
  await act(async () => { await mod.serverIdle() })
  assert.match([...m.container.querySelectorAll('[role=columnheader]')][1].textContent, /Your pick/)
  assert.equal(m.container.querySelector('[role=columnheader].huic-compare-recommended strong').textContent, 'B')
  await m.unmount()
})
test('choice counts Other in min and max', async () => {
  const card = {type:'choice',question:'Pick',multiple:true,allowOther:true,min:3,max:3,options:[{label:'A'},{label:'B'}]}
  assert.equal(mod.validateCard(card).card?.max, 3)
  const m = await mount(toolResult(card))
  for (const box of m.container.querySelectorAll('[role=checkbox]')) await click(box)
  await type(m.container.querySelector('input'), 'C')
  await click(buttonByText(m.container, 'Send'))
  assert.equal(lastReply().json.selected.length, 2)
  assert.equal(lastReply().json.other, 'C')
  await m.unmount()
})
test('composing Enter does not send Other', async () => {
  const m = await mount(toolResult({type:'choice',question:'Pick',allowOther:true,options:[{label:'A'},{label:'B'}]}))
  await click([...m.container.querySelectorAll('[role=radio]')].at(-1))
  await type(m.container.querySelector('input'), 'partial')
  await act(async () => m.container.querySelector('input').dispatchEvent(new window.KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true})))
  assert.equal(testHost.submissions.length, 0)
  await m.unmount()
})
test('flipped flashcard names its visible back', async () => {
  const m = await mount(toolResult({type:'flashcards',title:'Study',cards:[{front:'Front word',back:'Back meaning'}]}))
  await click(buttonByText(m.container,'Show answer'))
  assert.match(m.container.querySelector('.huic-fc').getAttribute('aria-label'), /Back: Back meaning/)
  await m.unmount()
})

test('compact recipe preserves scaled quantities and restores owned ingredients', async () => {
  const ingredients = Array.from({length:40},(_,i)=>({id:`g${i}_${'x'.repeat(35)}`,item:`Ingredient ${i+1} `+'x'.repeat(64),qty:1.25,unit:'cup'}))
  const registration = registerPlugin(makeStorage())
  const result = toolResult({type:'recipe',title:'Banquet',servings:4,ingredients})
  let m = await mount(result, {registration})
  await click(m.container.querySelector('input[type=checkbox]'))
  await click(m.container.querySelector('button[aria-label="More servings"]'))
  await click(buttonByText(m.container, 'Shopping list'))
  const data = lastReply().json
  const missing = data.missing_indexes || data.missing
  assert.equal(missing.length, 39)
  if (data.missing_indexes) assert.deepEqual(data.missing_indexes[0], [1, 1.5])
  else assert.equal(missing[0].qty, 1.5)
  await m.unmount()
  m = await mount(result, {registration})
  assert.equal(m.container.querySelector('input[type=checkbox]').checked, true)
  assert.match(m.container.querySelector('.huic-rcp-count').textContent, /5 servings/)
  await m.unmount()
})

test('historical invalid date and time drafts cannot be submitted', async () => {
  for (const [kind, bad, good] of [['date', '2026-02-30', '2026-02-28'], ['time', '25:60', '12:30']]) {
    resetHost()
    const storage = makeStorage(), registration = registerPlugin(storage), cardId = `form-old-${kind}-0123456789`
    storage.set(`card.sess-1\u0000${cardId}`, { draft: { values: { x: bad } } })
    const m = await mount(toolResult({type:'form',cardId,fields:[{name:'x',label:'X',kind,required:true}]}), {registration})
    const input = m.container.querySelector(`input[type=${kind}]`)
    assert.equal(input.value, '')
    assert.match(m.container.textContent, /0 of 1 required filled/)
    await click(buttonByText(m.container, 'Submit'))
    assert.equal(testHost.submissions.length, 0)
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    await type(input, good)
    assert.match(m.container.textContent, /1 of 1 required filled/)
    await click(buttonByText(m.container, 'Submit'))
    assert.equal(lastReply().json.values.x, good)
    await m.unmount()
  }
})

test('choice can require six options plus Other', async () => {
  const card = {type:'choice',question:'Pick seven',multiple:true,allowOther:true,min:7,max:7,options:Array.from({length:6},(_,i)=>({label:`Option ${i+1}`}))}
  assert.equal(mod.validateCard(card).card?.max, 7)
  const withoutOther = mod.validateCard({...card,allowOther:false})
  assert.equal(withoutOther.card, null)
  const m = await mount(toolResult(card))
  for (const box of m.container.querySelectorAll('[role=checkbox]')) await click(box)
  await type(m.container.querySelector('input'), 'Seventh')
  await click(buttonByText(m.container, 'Send'))
  assert.equal(lastReply().json.selected.length, 6)
  assert.equal(lastReply().json.other, 'Seventh')
  await m.unmount()
})
