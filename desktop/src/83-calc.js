// calc: a live calculator. Inputs (number, slider, select, toggle) feed the outputs, which
// recompute on every change with calcParse/calcEval (10-validate.js, never eval). Impossible
// results (division by zero, sqrt of a negative, log ≤ 0) show "–". "Send" sends inputs and
// outputs. Inputs are kept as a draft until then.

Object.assign(STRINGS.en, {
  calcSend: 'Send',
  calcLive: 'Live',
  calcLiveHint: 'Updates as you change the inputs',
  calcInputs: 'Inputs',
  calcResults: 'Results',
  calcNotPossible: 'Not possible with these values',
  calcFix: 'Fix the marked input to see the result',
  calcSent: 'Sent',
  rCalc: '{label}: {value}'
})
Object.assign(STRINGS.de, {
  calcSend: 'Senden',
  calcLive: 'Live',
  calcLiveHint: 'Rechnet bei jeder Änderung neu',
  calcInputs: 'Eingaben',
  calcResults: 'Ergebnis',
  calcNotPossible: 'Mit diesen Werten nicht möglich',
  calcFix: 'Markierte Eingabe korrigieren, dann gibt es ein Ergebnis',
  calcSent: 'Gesendet',
  rCalc: '{label}: {value}'
})

const CALC_CSS = `
.huic[data-card-type="calc"] .huic-calc{display:grid;grid-template-columns:minmax(0,1fr);gap:16px;align-items:start}
@container (min-width: 540px){.huic[data-card-type="calc"] .huic-calc{grid-template-columns:minmax(0,1.1fr) minmax(210px,.9fr)}}
.huic[data-card-type="calc"] .huic-calc-inputs{display:flex;flex-direction:column;gap:13px;min-width:0}
.huic[data-card-type="calc"] .huic-calc-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.huic[data-card-type="calc"] .huic-calc-labelrow{display:flex;justify-content:space-between;align-items:center;gap:10px;min-width:0}
.huic[data-card-type="calc"] .huic-calc-label{font-weight:500;font-size:12.5px;color:var(--ui-text-secondary)}
.huic[data-card-type="calc"] .huic-calc-box{display:flex;align-items:center;min-width:0;border:1px solid var(--ui-stroke-secondary);border-radius:8px;background:color-mix(in srgb,var(--ui-bg-quaternary) 35%,transparent);transition:border-color .12s,box-shadow .12s}
.huic[data-card-type="calc"] .huic-calc-box:focus-within{border-color:var(--huic-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--huic-accent) 18%,transparent)}
.huic[data-card-type="calc"] .huic-calc-box[data-invalid="true"]{border-color:var(--ui-red)}
.huic[data-card-type="calc"] .huic-calc-box input{flex:1;min-width:0;height:34px;margin:0;padding:0 10px;border:0;background:transparent;color:inherit;font:inherit;font-size:14px;font-variant-numeric:tabular-nums;outline:none}
.huic[data-card-type="calc"] .huic-calc-box input:disabled{color:var(--ui-text-secondary)}
.huic[data-card-type="calc"] .huic-calc-unit{flex:none;padding:0 10px 0 0;color:var(--ui-text-tertiary);font-size:12.5px;white-space:nowrap}
.huic[data-card-type="calc"] .huic-calc-box.is-small{flex:none;width:clamp(96px,38%,150px)}
.huic[data-card-type="calc"] .huic-calc-box.is-small input{height:28px;padding:0 8px;text-align:right;font-size:13px;font-weight:600}
.huic[data-card-type="calc"] .huic-calc-box.is-small .huic-calc-unit{padding-right:8px}
.huic[data-card-type="calc"] .huic-calc-range{-webkit-appearance:none;appearance:none;display:block;width:100%;height:6px;margin:8px 0 2px;padding:0;border-radius:999px;background:linear-gradient(to right,var(--huic-accent) var(--fill),var(--ui-bg-quaternary) var(--fill));accent-color:var(--huic-accent);cursor:pointer}
.huic[data-card-type="calc"] .huic-calc-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--huic-accent);border:3px solid var(--ui-chat-surface-background,var(--ui-base,Canvas));box-shadow:0 0 0 1px var(--huic-accent);transition:transform .1s}
.huic[data-card-type="calc"] .huic-calc-range::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--huic-accent);border:3px solid var(--ui-chat-surface-background,var(--ui-base,Canvas));box-shadow:0 0 0 1px var(--huic-accent)}
.huic[data-card-type="calc"] .huic-calc-range::-moz-range-track{background:transparent}
.huic[data-card-type="calc"] .huic-calc-range:hover:not(:disabled)::-webkit-slider-thumb{transform:scale(1.12)}
.huic[data-card-type="calc"] .huic-calc-range:disabled{cursor:default;opacity:.7}
.huic[data-card-type="calc"] .huic-calc-range:focus-visible{outline-offset:6px}
.huic[data-card-type="calc"] .huic-calc-ends{display:flex;justify-content:space-between;color:var(--ui-text-tertiary);font-size:11px;font-variant-numeric:tabular-nums}
.huic[data-card-type="calc"] .huic-calc-seg{display:flex;flex-wrap:wrap;padding:2px;gap:2px;border-radius:8px;background:var(--ui-bg-quaternary)}
.huic[data-card-type="calc"] .huic-calc-seg button{flex:1 1 auto;min-height:28px;padding:3px 10px;border:0;border-radius:6px;background:transparent;color:var(--ui-text-secondary);font:inherit;font-size:12.5px;font-weight:500;cursor:pointer;transition:background .12s,color .12s}
.huic[data-card-type="calc"] .huic-calc-seg button:hover:not(:disabled){color:var(--ui-text-primary)}
.huic[data-card-type="calc"] .huic-calc-seg button[aria-checked="true"]{background:var(--ui-chat-surface-background,var(--ui-base));color:var(--ui-text-primary);box-shadow:0 0 0 1px var(--ui-stroke-tertiary),0 1px 2px color-mix(in srgb,var(--ui-text-primary) 12%,transparent)}
.huic[data-card-type="calc"] .huic-calc-seg button:disabled{cursor:default}
.huic[data-card-type="calc"] select.huic-input{height:34px;border-radius:8px;background:color-mix(in srgb,var(--ui-bg-quaternary) 35%,transparent)}
.huic[data-card-type="calc"] select.huic-input option{background:var(--ui-chat-surface-background,var(--ui-base));color:var(--ui-text-primary)}
.huic[data-card-type="calc"] .huic-calc-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:32px;cursor:pointer}
.huic[data-card-type="calc"] .huic-calc-toggle:has(:disabled){cursor:default}
.huic[data-card-type="calc"] input.huic-calc-switch{appearance:none;position:relative;flex:none;width:32px;height:18px;margin:0;border:1px solid var(--ui-stroke-secondary);border-radius:999px;background:var(--ui-bg-quaternary);cursor:inherit;transition:background .15s,border-color .15s}
.huic[data-card-type="calc"] input.huic-calc-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--ui-text-secondary);transition:transform .15s}
.huic[data-card-type="calc"] input.huic-calc-switch:checked{background:var(--huic-accent);border-color:var(--huic-accent)}
.huic[data-card-type="calc"] input.huic-calc-switch:checked::after{transform:translateX(14px);background:var(--huic-on-accent)}
.huic[data-card-type="calc"] .huic-calc-out{position:relative;display:flex;flex-direction:column;gap:12px;min-width:0;padding:14px 16px 12px;border-radius:12px;border:1px solid color-mix(in srgb,var(--huic-accent) 26%,var(--ui-stroke-tertiary));background:linear-gradient(155deg,color-mix(in srgb,var(--huic-accent) 12%,transparent),color-mix(in srgb,var(--huic-accent) 3%,transparent) 70%)}
.huic[data-card-type="calc"] .huic-calc-live{position:absolute;top:11px;right:13px;display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--huic-accent)}
.huic[data-card-type="calc"] .huic-calc-live::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;animation:huic-calc-pulse 2.4s ease-in-out infinite}
.huic[data-card-type="calc"] .huic-calc-live.is-sent{gap:3px;color:var(--ui-text-tertiary)}
.huic[data-card-type="calc"] .huic-calc-live.is-sent::before{content:none}
.huic[data-card-type="calc"] .huic-calc-live svg{width:11px;height:11px}
.huic[data-card-type="calc"] .huic-calc.is-sent .huic-calc-box,.huic[data-card-type="calc"] .huic-calc.is-sent select.huic-input{border-color:var(--ui-stroke-tertiary);border-style:dashed;background:transparent;opacity:1}
.huic[data-card-type="calc"] .huic-calc.is-sent select.huic-input{appearance:none;-webkit-appearance:none;color:var(--ui-text-secondary)}
.huic[data-card-type="calc"] .huic-calc.is-sent .huic-calc-range{opacity:.55}
.huic[data-card-type="calc"] .huic-calc.is-sent .huic-calc-seg button[aria-checked="false"]{opacity:.55}
@keyframes huic-calc-pulse{0%,100%{opacity:1}50%{opacity:.3}}
.huic[data-card-type="calc"] .huic-calc-hero{display:flex;flex-direction:column;gap:2px;min-width:0}
.huic[data-card-type="calc"] .huic-calc-hero+.huic-calc-hero{padding-top:10px;border-top:1px solid color-mix(in srgb,var(--huic-accent) 18%,var(--ui-stroke-tertiary))}
.huic[data-card-type="calc"] .huic-calc-hero-label{font-size:12px;color:var(--ui-text-secondary);padding-right:52px}
.huic[data-card-type="calc"] .huic-calc-hero+.huic-calc-hero .huic-calc-hero-label{padding-right:0}
.huic[data-card-type="calc"] .huic-calc-hero-value{display:block;font-size:30px;font-weight:650;line-height:1.15;letter-spacing:-.02em;font-variant-numeric:tabular-nums;color:var(--ui-text-primary)}
.huic.huic-compact[data-card-type="calc"] .huic-calc-hero-value{font-size:24px}
.huic[data-card-type="calc"] .huic-calc-hero-value .huic-calc-suffix{font-size:15px;font-weight:500;letter-spacing:0;color:var(--ui-text-secondary);margin-left:1px}
.huic[data-card-type="calc"] .huic-calc-rows{display:flex;flex-direction:column}
.huic[data-card-type="calc"] .huic-calc-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:6px 0;border-top:1px solid color-mix(in srgb,var(--huic-accent) 18%,var(--ui-stroke-tertiary))}
.huic[data-card-type="calc"] .huic-calc-row>span:first-child{color:var(--ui-text-secondary);min-width:0}
.huic[data-card-type="calc"] .huic-calc-row>span:last-child{font-weight:600;font-variant-numeric:tabular-nums;text-align:right;flex:none;max-width:60%}
.huic[data-card-type="calc"] .huic-calc-na{color:var(--ui-text-tertiary);font-weight:500}
.huic[data-card-type="calc"] .huic-calc-why{margin:0;color:var(--ui-text-tertiary);font-size:11.5px}
.huic[data-card-type="calc"] .huic-calc-pop{animation:huic-calc-pop .3s ease-out}
@keyframes huic-calc-pop{from{opacity:.4;transform:translateY(3px)}to{opacity:1;transform:none}}
.huic[data-card-type="calc"] .huic-calc-note{margin:0;color:var(--ui-text-tertiary);font-size:12px;white-space:pre-wrap}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="calc"] *{transition:none!important;animation:none!important}}
`

function calcLocaleSep(lang) {
  return lang === 'de' ? { group: '.', decimal: ',' } : { group: ',', decimal: '.' }
}

function calcDecimals(output) {
  return output.decimals ?? ((output.format || 'number') === 'integer' ? 0 : 2)
}

// The exact value as a plain decimal string (1e-11 → "0.00000000001"), never rounded.
function calcPlain(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return ''
  const s = String(Object.is(n, -0) ? 0 : n)
  const m = /^(-?)(\d+)(?:\.(\d+))?e([-+]\d+)$/.exec(s)
  if (!m) return s
  const digits = m[2] + (m[3] || ''), point = m[2].length + Number(m[4])
  const body = point <= 0 ? '0.' + '0'.repeat(-point) + digits
    : point >= digits.length ? digits + '0'.repeat(point - digits.length)
      : digits.slice(0, point) + '.' + digits.slice(point)
  return m[1] + body
}

// Editable text for a number: lossless, the locale's decimal sign, grouping only for display.
function calcText(n, lang, grouped) {
  const s = calcPlain(n)
  if (!s) return ''
  const sep = calcLocaleSep(lang)
  let [int, frac] = s.split('.')
  if (grouped) int = int.replace(/\B(?=(\d{3})+(?!\d))/g, sep.group)
  return frac ? int + sep.decimal + frac : int
}

// Decimal rounding, half away from zero, on the decimal digits (like calcFormat, so 2.675 → 2.68).
function calcRoundText(v, d) {
  const s = calcPlain(Math.abs(v))
  const [int, frac = ''] = s.split('.')
  if (frac.length <= d) return calcPlain(v)
  let digits = (int + frac.slice(0, d)).replace(/^0+(?=\d)/, '')
  if (frac[d] >= '5') digits = (BigInt(digits) + 1n).toString()
  digits = digits.padStart(d + 1, '0')
  const out = d ? digits.slice(0, -d) + '.' + digits.slice(-d) : digits
  return (v < 0 && /[1-9]/.test(out) ? '-' : '') + out
}

// The one place that formats an output: the shared formatter (10-validate.js), the same text
// as the CLI fallback. "–" means there is no result.
function calcShown(output, value, card, lang) {
  return calcFormat(value ?? NaN, output, card, lang)
}

// The value the model gets: rounded exactly like the display (percent stays a fraction),
// null whenever the display shows "–".
function calcRound(output, value, card, lang) {
  if (calcShown(output, value, card, lang) === '–') return null
  const percent = (output.format || 'number') === 'percent'
  const n = Number(calcRoundText(percent ? value * 100 : value, calcDecimals(output)) + (percent ? 'e-2' : ''))
  return Number.isFinite(n) ? (n === 0 ? 0 : n) : null
}

// Hero text split so a trailing " %", " €" or unit can be set smaller than the number.
function calcSplit(text) {
  const m = /^(.*\d)[\s\u00a0]+(\D+)$/.exec(text)
  return m ? { num: m[1], suffix: m[2] } : { num: text, suffix: '' }
}

// Typed numbers: "4.5", "4,5", "1,234.5", "1.234,5", "250 000".
function calcNumber(text, lang) {
  let s = String(text ?? '').trim().replace(/[\s  '’_]/g, '')
  if (!s) return null
  const comma = s.lastIndexOf(','), dot = s.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (comma >= 0) s = lang !== 'de' && /^[-+]?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  else if (lang === 'de' && /^[-+]?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  s = s.replace(/^\+/, '').replace(/^−/, '-')
  if (!/^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function calcNiceStep(x) {
  if (!(x > 0)) return 1
  const p = 10 ** Math.floor(Math.log10(x))
  const m = x / p
  return Number(((m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p).toPrecision(6))
}

function calcRangeOf(input) {
  const d = input.default
  const min = input.min ?? Math.min(0, d)
  let max = input.max ?? (d > min ? min + (d - min) * 2 : min + 100)
  if (!(max > min)) max = min + 100
  return { min, max, step: input.step ?? calcNiceStep((max - min) / 200) }
}

function calcKind(input) {
  return input.kind || 'number'
}

// One entry per input, keyed by its name in a prototype-free map (a name like "__proto__" is
// just a key). Number and slider entries keep the text being edited and the exact number it
// stands for; display grouping never changes the number.
function calcEntry(input, v, lang) {
  const kind = calcKind(input)
  if (kind === 'select') return typeof v === 'number' && input.options.some(o => o.value === v) ? v : input.default
  if (kind === 'toggle') return v === 0 || v === 1 ? v : input.default
  if (typeof v === 'string') return { text: v }
  if (v && typeof v === 'object' && typeof v.text === 'string') return Number.isFinite(v.value) ? { text: v.text, value: v.value } : { text: v.text }
  const n = typeof v === 'number' && Number.isFinite(v) ? v : input.default
  return { text: calcText(n, lang, kind === 'number'), value: n }
}

function calcInitial(card, source, lang) {
  return planDict(card.inputs.map(input => [input.name, calcEntry(input, planOwn(source, input.name), lang)]))
}

function calcCheck(input, entry, lang) {
  const kind = calcKind(input)
  if (kind === 'select' || kind === 'toggle') return { value: entry, error: null }
  const n = entry.value ?? calcNumber(entry.text, lang)
  if (n === null) return { value: null, error: t(lang, 'errNumber') }
  if (input.min !== undefined && n < input.min) return { value: null, error: t(lang, 'errMin', { min: calcText(input.min, lang, true) }) }
  if (input.max !== undefined && n > input.max) return { value: null, error: t(lang, 'errMax', { max: calcText(input.max, lang, true) }) }
  return { value: n, error: null }
}

function calcCompute(card, asts, values) {
  return card.outputs.map((o, i) => (Array.isArray(asts[i]) ? calcEval(asts[i], values) : null))
}

function calcHeroIndexes(card) {
  const marked = card.outputs.map((o, i) => (o.emphasis ? i : -1)).filter(i => i >= 0)
  return marked.length ? marked : [0]
}

// A step nudge without binary noise (0.1 + 0.2 → 0.3): no more decimals than the step or value had.
function calcNudged(current, delta) {
  const places = x => (calcPlain(Math.abs(x)).split('.')[1] || '').length
  return Number((current + delta).toFixed(Math.min(20, Math.max(places(current), places(delta)))))
}

function CalcSegments({ input, value, disabled, labelId, onChange }) {
  const pick = (v, el) => { onChange(v); el?.focus() }
  return jsx('div', {
    className: 'huic-calc-seg', role: 'radiogroup', 'aria-labelledby': labelId,
    children: input.options.map((o, i) => jsx('button', {
      type: 'button', role: 'radio', 'aria-checked': o.value === value, disabled,
      tabIndex: o.value === value ? 0 : -1,
      onClick: () => onChange(o.value),
      onKeyDown: e => {
        const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
        if (!dir || e.altKey || e.ctrlKey || e.metaKey) return
        e.preventDefault()
        const n = input.options.length
        const next = (i + dir + n) % n
        pick(input.options[next].value, e.currentTarget.parentElement.children[next])
      },
      children: o.label
    }, i))
  })
}

function CalcInput({ input, entry, error, disabled, lang, baseId, onChange }) {
  const kind = calcKind(input)
  const id = `${baseId}-${input.name}`
  const labelId = `${id}-label`
  const errId = `${id}-err`
  const short = kind === 'select' && input.options.length <= 4 && input.options.every(o => [...o.label].length <= 18)
  // A real <label for> on every native control; segmented selects are named by aria-labelledby.
  const label = short
    ? jsx('span', { id: labelId, className: 'huic-calc-label', children: input.label })
    : jsx('label', { id: labelId, htmlFor: id, className: 'huic-calc-label', children: input.label })
  const unit = input.unit ? jsx('span', { className: 'huic-calc-unit', 'aria-hidden': true, children: input.unit }) : null
  const err = error ? jsx('span', { id: errId, className: 'huic-err', children: error }) : null

  if (kind === 'toggle') {
    return jsx('div', { className: 'huic-calc-field', children: jsxs('label', {
      className: 'huic-calc-toggle', htmlFor: id,
      children: [
        jsx('span', { className: 'huic-calc-label', children: input.label }),
        jsx('input', {
          id, type: 'checkbox', role: 'switch', className: 'huic-calc-switch', checked: entry === 1, disabled,
          onChange: e => onChange(e.target.checked ? 1 : 0)
        })
      ]
    }) })
  }

  if (kind === 'select') {
    return jsxs('div', { className: 'huic-calc-field', children: [
      jsx('span', { className: 'huic-calc-labelrow', children: label }),
      short
        ? jsx(CalcSegments, { input, value: entry, disabled, labelId, onChange })
        : jsx('select', {
            id, className: 'huic-input', disabled, value: String(input.options.findIndex(o => o.value === entry)),
            'aria-labelledby': labelId,
            onChange: e => onChange(input.options[Number(e.target.value)].value),
            children: input.options.map((o, i) => jsx('option', { value: String(i), children: o.label }, i))
          })
    ] })
  }

  const step = input.step ?? (kind === 'slider' ? calcRangeOf(input).step : 1)
  const current = entry.value ?? calcNumber(entry.text, lang)
  const nudge = e => {
    if ((e.key !== 'ArrowUp' && e.key !== 'ArrowDown') || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return
    if (current === null) return
    e.preventDefault()
    let next = calcNudged(current, (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1))
    if (input.min !== undefined) next = Math.max(input.min, next)
    if (input.max !== undefined) next = Math.min(input.max, next)
    onChange({ text: calcText(next, lang, false), value: next })
  }
  const box = small => jsxs('span', {
    className: cx('huic-calc-box', small && 'is-small'), 'data-invalid': error ? 'true' : undefined,
    children: [
      jsx('input', {
        id, type: 'text', inputMode: 'decimal', autoComplete: 'off', spellCheck: false, value: entry.text, disabled,
        'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? errId : undefined,
        'aria-label': input.unit ? `${input.label} (${input.unit})` : undefined,
        onChange: e => onChange({ text: e.target.value.slice(0, 40) }), onKeyDown: nudge,
        // Grouped again after editing ("250,000"); the number itself stays exactly what was typed.
        onBlur: kind === 'number' ? () => {
          if (current !== null && calcText(current, lang, true) !== entry.text) onChange({ text: calcText(current, lang, true), value: current })
        } : undefined
      }),
      unit
    ]
  })

  if (kind === 'slider') {
    const range = calcRangeOf(input)
    const pos = current === null ? range.min : Math.min(range.max, Math.max(range.min, current))
    const fill = `${((pos - range.min) / (range.max - range.min)) * 100}%`
    const shownMin = calcText(range.min, lang, true), shownMax = calcText(range.max, lang, true)
    return jsxs('div', { className: 'huic-calc-field', children: [
      jsxs('span', { className: 'huic-calc-labelrow', children: [label, box(true)] }),
      jsx('input', {
        type: 'range', className: 'huic-calc-range', min: range.min, max: range.max, step: range.step, value: pos, disabled,
        style: { '--fill': fill }, 'aria-labelledby': labelId,
        'aria-valuetext': current === null ? undefined : `${calcText(current, lang, true)}${input.unit ? ' ' + input.unit : ''}`,
        onChange: e => { const v = Number(e.target.value); onChange({ text: calcText(v, lang, false), value: v }) }
      }),
      jsxs('span', { className: 'huic-calc-ends', 'aria-hidden': true, children: [
        jsx('span', { children: input.unit ? `${shownMin} ${input.unit}` : shownMin }),
        jsx('span', { children: input.unit ? `${shownMax} ${input.unit}` : shownMax })
      ] }),
      err
    ] })
  }

  return jsxs('div', { className: 'huic-calc-field', children: [jsx('span', { className: 'huic-calc-labelrow', children: label }), box(false), err] })
}

function CalcCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const baseId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer?.selection?.inputs || ans.answer?.data?.inputs
  const [localRaw, setRaw] = useState(() => calcInitial(card, ans.draft?.inputs, lang))
  const raw = sent ? calcInitial(card, sent, lang) : localRaw
  const [announce, setAnnounce] = useState('')
  const names = useMemo(() => card.inputs.map(i => i.name), [card])
  const asts = useMemo(() => card.outputs.map(o => calcParse(o.expr, names)), [card, names])
  const editable = ans.showActions

  const checks = card.inputs.map(input => calcCheck(input, raw[input.name], lang))
  const invalid = checks.some(c => c.error)
  const values = planDict()
  card.inputs.forEach((input, i) => { if (!checks[i].error) values[input.name] = checks[i].value })
  const results = calcCompute(card, asts, values)
  const shown = card.outputs.map((o, i) => calcShown(o, results[i], card, lang))
  const heroes = calcHeroIndexes(card)
  const rest = card.outputs.map((o, i) => i).filter(i => !heroes.includes(i))
  const impossible = !invalid && shown.some(s => s === '–')
  // Nothing worth sending while the headline result is "–".
  const blank = !invalid && heroes.some(i => shown[i] === '–')

  // Screen readers hear the new results once typing pauses, not on every keystroke.
  const spoken = card.outputs.map((o, i) => `${o.label}: ${shown[i]}`).join('; ')
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const timer = setTimeout(() => setAnnounce(spoken), 600)
    return () => clearTimeout(timer)
  }, [spoken])

  const change = (name, value) => {
    if (!editable) return
    const next = planDict(Object.entries(localRaw))
    next[name] = value
    setRaw(next)
    ans.saveDraft({ inputs: next })
  }

  const send = () => ans.submit({
    inputs: Object.fromEntries(card.inputs.map(i => [i.name, values[i.name]])),
    outputs: card.outputs.map((o, i) => ({ label: o.label, value: calcRound(o, results[i], card, lang) }))
  })

  const valueNode = (i, big) => {
    const text = shown[i]
    const part = big ? calcSplit(text) : { num: text, suffix: '' }
    return jsxs('span', {
      className: cx(big ? 'huic-calc-hero-value' : null, 'huic-calc-pop', text === '–' && 'huic-calc-na'),
      children: [part.num, part.suffix ? ' ' : null, part.suffix ? jsx('span', { className: 'huic-calc-suffix', children: part.suffix }) : null]
    }, text)
  }

  const panel = jsxs('div', {
    className: 'huic-calc-out', role: 'group', 'aria-label': t(lang, 'calcResults'),
    children: [
      editable ? jsx('span', { className: 'huic-calc-live', title: t(lang, 'calcLiveHint'), children: t(lang, 'calcLive') })
        : ans.answered ? jsxs('span', { className: 'huic-calc-live is-sent', children: [planIcon('check'), t(lang, 'calcSent')] }) : null,
      ...heroes.map(i => jsxs('div', { className: 'huic-calc-hero', children: [
        jsx('span', { className: 'huic-calc-hero-label', children: card.outputs[i].label }),
        valueNode(i, true)
      ] }, `h${i}`)),
      rest.length ? jsx('div', { className: 'huic-calc-rows', children: rest.map(i => jsxs('div', {
        className: 'huic-calc-row',
        children: [jsx('span', { children: card.outputs[i].label }), valueNode(i, false)]
      }, i)) }, 'rows') : null,
      invalid ? jsx('p', { className: 'huic-calc-why', children: t(lang, 'calcFix') }, 'why')
        : impossible && !(blank && editable) ? jsx('p', { className: 'huic-calc-why', children: t(lang, 'calcNotPossible') }, 'why') : null
    ]
  })

  return jsx(Shell, {
    card, display, labelId, title: card.title,
    children: [
      jsx('style', { children: CALC_CSS }, 'css'),
      jsxs('div', { className: cx('huic-calc', ans.answered && 'is-sent'), children: [
        jsx('div', { className: 'huic-calc-inputs', role: 'group', 'aria-label': t(lang, 'calcInputs'), children: card.inputs.map((input, i) => jsx(CalcInput, {
          input, entry: raw[input.name], error: checks[i].error, disabled: !editable, lang, baseId,
          onChange: value => change(input.name, value)
        }, input.name)) }),
        panel
      ] }, 'calc'),
      card.note ? jsx('p', { className: 'huic-calc-note', children: card.note }, 'note') : null,
      jsx('div', { className: 'huic-sr', role: 'status', 'aria-live': 'polite', children: announce }, 'live')
    ],
    footer: editable ? jsx(Footer, {
      hint: invalid ? t(lang, 'errFix') : blank ? t(lang, 'calcNotPossible') : undefined,
      children: jsx(Btn, { variant: 'primary', disabled: invalid || blank, onClick: send, children: card.sendLabel || t(lang, 'calcSend') })
    }) : null,
    after: ans.status
  })
}

CARD_COMPONENTS.calc = CalcCard
REPLY_BUILDERS.calc = (card, answer, lang, data) => {
  const sent = answer.inputs || {}
  data.inputs = Object.fromEntries(card.inputs.filter(i => Object.prototype.hasOwnProperty.call(sent, i.name)).map(i => [i.name, sent[i.name]]))
  data.outputs = answer.outputs.map(o => ({ label: o.label, value: o.value ?? null }))
  const i = calcHeroIndexes(card)[0]
  const output = card.outputs[i]
  const value = answer.outputs[i]?.value
  return { summary: t(lang, 'rCalc', { label: clip(output.label, 40), value: calcShown(output, value, card, lang) }) }
}
