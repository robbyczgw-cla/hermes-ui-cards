// recipe: scale the servings, tick what is already at home, send the shopping list for the rest.

Object.assign(STRINGS.en, {
  rcpServings: 'Servings',
  rcpFewer: 'Fewer servings',
  rcpMore: 'More servings',
  rcpServingsN: '{n} servings',
  rcpServingsOne: '1 serving',
  rcpOriginal: 'Original: {n}',
  rcpIngredients: 'Ingredients',
  rcpHaveHint: 'Tick what you already have',
  rcpToBuy: '{n} of {total} still to buy',
  rcpAllHave: 'You have everything',
  rcpSteps: 'Steps',
  rcpOther: 'Also',
  rcpMinutes: '{n} min',
  rcpTotalTime: 'about {x}',
  rcpHave: 'have',
  rcpShopping: 'Shopping list',
  rcpHaveShort: 'Have everything',
  rShopping: 'Shopping list for {servings}: {x}',
  rShoppingMore: '+{n} more',
  rHaveAll: 'Have everything for {servings}'
})
Object.assign(STRINGS.de, {
  rcpServings: 'Portionen',
  rcpFewer: 'Weniger Portionen',
  rcpMore: 'Mehr Portionen',
  rcpServingsN: '{n} Portionen',
  rcpServingsOne: '1 Portion',
  rcpOriginal: 'Original: {n}',
  rcpIngredients: 'Zutaten',
  rcpHaveHint: 'Hake ab, was du schon hast',
  rcpToBuy: '{n} von {total} noch einzukaufen',
  rcpAllHave: 'Du hast alles da',
  rcpSteps: 'Zubereitung',
  rcpOther: 'Außerdem',
  rcpMinutes: '{n} Min.',
  rcpTotalTime: 'etwa {x}',
  rcpHave: 'vorhanden',
  rcpShopping: 'Einkaufsliste',
  rcpHaveShort: 'Alles da',
  rShopping: 'Einkaufsliste für {servings}: {x}',
  rShoppingMore: '+{n} weitere',
  rHaveAll: 'Alles da für {servings}'
})

const RECIPE_CSS = `
.huic[data-card-type="recipe"] .huic-rcp-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px}
.huic[data-card-type="recipe"] .huic-rcp-stepper{display:inline-flex;align-items:center;border:1px solid var(--ui-stroke-secondary);border-radius:999px;overflow:hidden}
.huic[data-card-type="recipe"] .huic-rcp-step{display:grid;place-items:center;width:34px;height:32px;padding:0;border:0;background:transparent;color:var(--ui-text-primary);font:inherit;font-size:18px;line-height:1;cursor:pointer}
.huic[data-card-type="recipe"] .huic-rcp-step:hover:not([disabled]){background:var(--ui-control-hover-background)}
.huic[data-card-type="recipe"] .huic-rcp-step[disabled]{opacity:.35;cursor:default}
.huic[data-card-type="recipe"] .huic-rcp-count{min-width:9ch;padding:0 6px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.huic[data-card-type="recipe"] .huic-rcp-h{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:2px 10px;margin:6px 0 0;padding:0;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-tertiary)}
.huic[data-card-type="recipe"] .huic-rcp-h span{letter-spacing:0;text-transform:none;font-weight:400;font-size:12px}
.huic[data-card-type="recipe"] .huic-rcp-groups{columns:2 250px;column-gap:20px}
.huic[data-card-type="recipe"] .huic-rcp-group{break-inside:avoid;margin:0 0 8px}
.huic[data-card-type="recipe"] .huic-rcp-gname{margin:0 0 2px;padding:0 0 3px;border-bottom:1px solid var(--ui-stroke-tertiary);font-size:12px;font-weight:600;color:var(--ui-text-secondary)}
.huic[data-card-type="recipe"] .huic-rcp-list{list-style:none;margin:0;padding:0}
.huic[data-card-type="recipe"] .huic-rcp-list>li{margin:0;padding:0;display:block}
.huic[data-card-type="recipe"] .huic-rcp-ing{display:flex;align-items:flex-start;gap:9px;padding:5px 6px;margin:0 -6px;border-radius:7px;cursor:pointer}
.huic[data-card-type="recipe"] .huic-rcp-ing:hover:has(input:not(:disabled)){background:var(--ui-control-hover-background)}
.huic[data-card-type="recipe"] .huic-rcp-ing:has(input:disabled){cursor:default}
.huic[data-card-type="recipe"] .huic-rcp-ing input{appearance:none;-webkit-appearance:none;display:grid;place-items:center;flex:none;width:16px;height:16px;margin:2px 0 0;border:1.5px solid var(--ui-text-quaternary,var(--huic-line-strong));border-radius:5px;background:transparent;cursor:inherit;transition:background .15s,border-color .15s}
.huic[data-card-type="recipe"] .huic-rcp-ing input::after{content:"";width:8px;height:4px;border-left:2px solid var(--huic-on-accent);border-bottom:2px solid var(--huic-on-accent);transform:translateY(-1px) rotate(-45deg) scale(0);transition:transform .2s var(--huic-ease)}
.huic[data-card-type="recipe"] .huic-rcp-ing:hover input:not(:checked):not(:disabled){border-color:var(--huic-accent)}
.huic[data-card-type="recipe"] .huic-rcp-ing input:checked{background:var(--huic-accent);border-color:var(--huic-accent)}
.huic[data-card-type="recipe"] .huic-rcp-ing input:checked::after{transform:translateY(-1px) rotate(-45deg) scale(1)}
.huic[data-card-type="recipe"] .huic-rcp-ing input:disabled{opacity:.7}
.huic[data-card-type="recipe"] .huic-rcp-qty{flex:none;min-width:7ch;font-weight:600;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}
.huic[data-card-type="recipe"] .huic-rcp-item{min-width:0;flex:1}
.huic[data-card-type="recipe"] .huic-rcp-note{display:block;color:var(--ui-text-tertiary);font-size:12px}
.huic[data-card-type="recipe"] .huic-rcp-ing.huic-rcp-have .huic-rcp-qty,.huic[data-card-type="recipe"] .huic-rcp-ing.huic-rcp-have .huic-rcp-name{color:var(--ui-text-tertiary);text-decoration:line-through;text-decoration-color:var(--ui-text-quaternary,currentColor)}
.huic[data-card-type="recipe"] .huic-rcp-ing.huic-rcp-have .huic-rcp-note{opacity:.7}
.huic[data-card-type="recipe"] .huic-rcp-steps{list-style:none;counter-reset:rcp;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.huic[data-card-type="recipe"] .huic-rcp-steps>li{counter-increment:rcp;display:flex;gap:10px;align-items:flex-start;margin:0;padding:0}
.huic[data-card-type="recipe"] .huic-rcp-steps>li::before{content:counter(rcp);flex:none;display:grid;place-items:center;width:22px;height:22px;margin-top:1px;border-radius:50%;background:var(--ui-bg-quaternary);color:var(--ui-text-secondary);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
.huic[data-card-type="recipe"] .huic-rcp-steptext{min-width:0;flex:1;white-space:pre-wrap}
.huic[data-card-type="recipe"] .huic-rcp-time{flex:none;display:inline-flex;align-items:center;gap:4px;margin-top:1px;color:var(--ui-text-tertiary);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.huic[data-card-type="recipe"] .huic-rcp-time svg{width:11px;height:11px}
@container (max-width: 440px){
  .huic[data-card-type="recipe"] .huic-rcp-groups{columns:1}
  .huic[data-card-type="recipe"] .huic-rcp-step{width:40px;height:38px}
  .huic[data-card-type="recipe"] .huic-rcp-steps>li{flex-wrap:wrap}
  .huic[data-card-type="recipe"] .huic-rcp-steps>li .huic-rcp-time{margin-left:32px;margin-top:0}
}
`

const RCP_FRACTIONS = { 0.125: '⅛', 0.25: '¼', 0.375: '⅜', 0.5: '½', 0.625: '⅝', 0.75: '¾', 0.875: '⅞' }

// Metric units read better as decimals (0.5 g, 12.5 ml) than as kitchen fractions.
function rcpMetric(unit) { return /^(mg|g|ml)$/i.test(unit || '') }

// Cooking-friendly rounding that stays honest: a step (eighths, quarters, halves) is used only while it is within
// ~10 % of the exact amount, otherwise 2 significant digits. A smaller recipe never needs more than the original.
function rcpNice(value, unit, original) {
  if (!(value > 0)) return 0
  let out
  if (value >= 10) out = Math.round(value)
  else if (rcpMetric(unit)) out = value >= 1 ? Math.round(value * 10) / 10 : Number(value.toPrecision(2))
  else {
    const step = value < 0.5 ? 8 : value < 5 ? 4 : 2
    out = Math.round(value * step) / step
    if (!(out > 0) || Math.abs(out - value) / value > 0.1) out = value >= 1 ? Math.round(value * 10) / 10 : Number(value.toPrecision(2))
  }
  if (original > 0) out = value < original ? Math.min(out, original) : Math.max(out, original)
  return out
}

function rcpScaled(qty, servings, base, unit) {
  if (qty === undefined || qty === null) return undefined
  return servings === base ? qty : rcpNice(qty * servings / base, unit, qty)
}

// 1.5 → "1½", 0.25 → "¼", 400 → "400", 0.3 → "0.3", 0.05 → "0.05" (comma in German).
function rcpFormat(value, lang, metric) {
  const whole = Math.floor(value + 1e-9)
  const frac = Math.round((value - whole) * 1000) / 1000
  if (value >= 0.001 && frac < 0.001) return String(whole)
  if (!metric && RCP_FRACTIONS[frac]) return (whole ? String(whole) : '') + RCP_FRACTIONS[frac]
  let text = String(value >= 1 ? Math.round(value * 100) / 100 : Number(value.toPrecision(2)))
  if (/e/i.test(text)) text = value.toFixed(6).replace(/0+$/, '')
  return lang === 'de' ? text.replace('.', ',') : text
}

function rcpAmount(qty, unit, lang) {
  if (qty === undefined || qty === null) return ''
  const text = rcpFormat(qty, lang, rcpMetric(unit))
  return unit ? `${text} ${unit}` : text
}

function rcpMinutes(minutes, lang) {
  if (minutes < 60) return t(lang, 'rcpMinutes', { n: minutes })
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m ? `${h} h ${t(lang, 'rcpMinutes', { n: m })}` : `${h} h`
}

function rcpServingsText(n, lang) {
  return t(lang, n === 1 ? 'rcpServingsOne' : 'rcpServingsN', { n })
}

function rcpCleanDraft(card, draft, sent) {
  const source = sent || draft || {}
  const servings = Number.isInteger(source.servings) && source.servings >= 1 && source.servings <= 50 ? source.servings : card.servings
  const ids = new Set(card.ingredients.map(i => i.id))
  const have = Array.isArray(source.have) ? source.have.filter(id => ids.has(id)) : []
  return { servings, have: [...new Set(have)] }
}

function RecipeCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const haveHintId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [local, setLocal] = useState(() => rcpCleanDraft(card, ans.draft, null))
  const { servings, have } = sent ? rcpCleanDraft(card, null, sent) : local
  const interactive = !ans.locked
  const haveSet = new Set(have)

  const update = next => {
    setLocal(next)
    ans.saveDraft(next)
  }
  const setServings = n => { if (interactive && n >= 1 && n <= 50) update({ ...local, servings: n }) }
  const toggle = id => {
    if (!interactive) return
    update({ ...local, have: haveSet.has(id) ? have.filter(x => x !== id) : [...have, id] })
  }

  const rows = card.ingredients.map(ing => ({ ing, qty: rcpScaled(ing.qty, servings, card.servings, ing.unit) }))
  const missing = rows.filter(r => !haveSet.has(r.ing.id))
  // Groups in order of first appearance; items without a group sit under no heading.
  const groups = []
  for (const row of rows) {
    const name = row.ing.group || ''
    let g = groups.find(x => x.name === name)
    if (!g) groups.push((g = { name, rows: [] }))
    g.rows.push(row)
  }
  const totalMinutes = (card.steps || []).reduce((sum, s) => sum + (s.minutes || 0), 0)

  const send = () => ans.submit({
    servings,
    missing: missing.map(r => ({ id: r.ing.id, item: r.ing.item, ...(r.qty !== undefined ? { qty: r.qty } : {}), ...(r.ing.unit ? { unit: r.ing.unit } : {}) })),
    have: rows.filter(r => haveSet.has(r.ing.id)).map(r => r.ing.id)
  })

  return jsx(Shell, {
    card, display, labelId, title: card.title,
    children: [
      jsx('style', { children: RECIPE_CSS }),
      jsxs('div', { className: 'huic-rcp-bar', role: 'group', 'aria-label': t(lang, 'rcpServings'), children: [
        jsxs('div', { className: 'huic-rcp-stepper', children: [
          jsx('button', { type: 'button', className: 'huic-rcp-step', 'aria-label': t(lang, 'rcpFewer'), disabled: !interactive || servings <= 1, onClick: () => setServings(servings - 1), children: '−' }),
          jsx('output', { className: 'huic-rcp-count', 'aria-live': 'polite', children: rcpServingsText(servings, lang) }),
          jsx('button', { type: 'button', className: 'huic-rcp-step', 'aria-label': t(lang, 'rcpMore'), disabled: !interactive || servings >= 50, onClick: () => setServings(servings + 1), children: '+' })
        ] }),
        servings !== card.servings && interactive
          ? jsx(Btn, { variant: 'ghost', onClick: () => setServings(card.servings), children: t(lang, 'rcpOriginal', { n: card.servings }) })
          : null
      ] }),
      jsxs('h4', { className: 'huic-rcp-h', children: [
        t(lang, 'rcpIngredients'),
        jsx('span', { id: haveHintId, children: interactive ? t(lang, 'rcpHaveHint') : t(lang, 'rcpToBuy', { n: missing.length, total: rows.length }) })
      ] }),
      jsx('div', { className: 'huic-rcp-groups', children: groups.map(g => jsxs('div', { className: 'huic-rcp-group', children: [
        g.name || groups.length > 1 ? jsx('h5', { className: 'huic-rcp-gname', children: g.name || t(lang, 'rcpOther') }) : null,
        jsx('ul', { className: 'huic-rcp-list', 'aria-describedby': haveHintId, children: g.rows.map(({ ing, qty }) => {
          const has = haveSet.has(ing.id)
          return jsx('li', { children: jsxs('label', { className: cx('huic-rcp-ing', has && 'huic-rcp-have'), children: [
            jsx('input', { type: 'checkbox', checked: has, disabled: !interactive, onChange: () => toggle(ing.id) }),
            jsx('span', { className: 'huic-rcp-qty', children: rcpAmount(qty, ing.unit, lang) }),
            jsxs('span', { className: 'huic-rcp-item', children: [
              jsx('span', { className: 'huic-rcp-name', children: ing.item }),
              ing.note ? jsx('span', { className: 'huic-rcp-note', children: ing.note }) : null
            ] })
          ] }) }, ing.id)
        }) })
      ] }, g.name || '-')) }),
      card.steps && card.steps.length ? jsxs('h4', { className: 'huic-rcp-h', children: [
        t(lang, 'rcpSteps'),
        totalMinutes ? jsx('span', { children: t(lang, 'rcpTotalTime', { x: rcpMinutes(totalMinutes, lang) }) }) : null
      ] }) : null,
      card.steps && card.steps.length ? jsx('ol', { className: 'huic-rcp-steps', children: card.steps.map((s, i) => jsxs('li', { children: [
        jsx('span', { className: 'huic-rcp-steptext', children: s.text }),
        s.minutes ? jsxs('span', { className: 'huic-rcp-time', children: [
          jsxs('svg', { viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true, children: [
            jsx('circle', { cx: 6, cy: 6.5, r: 4.3 }), jsx('path', { d: 'M6 4.2v2.5l1.5 1M4.5 1h3', strokeLinecap: 'round' })
          ] }),
          rcpMinutes(s.minutes, lang)
        ] }) : null
      ] }, i)) }) : null
    ],
    footer: ans.showActions ? jsx(Footer, {
      hint: t(lang, missing.length ? 'rcpToBuy' : 'rcpAllHave', { n: missing.length, total: rows.length }),
      children: jsx(Btn, { variant: 'primary', onClick: send, children: missing.length ? (card.sendLabel || t(lang, 'rcpShopping')) : t(lang, 'rcpHaveShort') })
    }) : null,
    after: ans.status
  })
}

REPLY_BUILDERS.recipe = (card, answer, lang, data) => {
  const byId = new Map(card.ingredients.map(i => [i.id, i]))
  data.servings = answer.servings
  data.missing = answer.missing.filter(m => byId.has(m.id)).map(m => {
    const out = { id: m.id, item: byId.get(m.id).item }
    if (m.qty !== undefined) out.qty = m.qty
    if (m.unit) out.unit = m.unit
    return out
  })
  data.have = answer.have.filter(id => byId.has(id))
  const servings = t(lang, data.servings === 1 ? 'rcpServingsOne' : 'rcpServingsN', { n: data.servings })
  if (!data.missing.length) return { mark: '✓', summary: t(lang, 'rHaveAll', { servings }) }
  const shown = data.missing.length > 6 ? 5 : 6
  const parts = data.missing.slice(0, shown).map(m => clip([rcpAmount(m.qty, m.unit, lang), m.item].filter(Boolean).join(' '), 40))
  const sep = parts.some(p => /,\s/.test(p)) ? '; ' : ', '
  if (data.missing.length > shown) parts.push(t(lang, 'rShoppingMore', { n: data.missing.length - shown }))
  return { mark: '✓', summary: t(lang, 'rShopping', { servings, x: parts.join(sep) }) }
}
CARD_COMPONENTS.recipe = RecipeCard
