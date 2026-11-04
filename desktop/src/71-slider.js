Object.assign(STRINGS.en, { keySlider: 'Type a value or drag · Enter send' })
Object.assign(STRINGS.de, { keySlider: 'Wert eintippen oder ziehen · Enter senden' })

// Snap relative to min, just like the native range input, without float noise.
function sliderInitialValue(card) {
  if (card.default !== undefined) return sliderSnap(card, card.default)
  const step = card.step || 1
  const value = card.min + Math.round(((card.max - card.min) / 2) / step) * step
  return Number(Math.min(card.max, Math.max(card.min, value)).toPrecision(12))
}

function sliderSnap(card, raw) {
  const step = card.step || 1
  const clamped = Math.min(card.max, Math.max(card.min, raw))
  // Snap to a step index that stays inside the range (min 0, max 11, step 3 → 9, never 11 or 12),
  // so the typed value always matches what the native range control can show.
  const lastIndex = Math.floor((card.max - card.min) / step + 1e-9)
  const index = Math.min(lastIndex, Math.max(0, Math.round((clamped - card.min) / step)))
  return Number((card.min + index * step).toPrecision(12))
}

function sliderParse(text) {
  const trimmed = String(text).trim().replace(',', '.')
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

const SLIDER_CSS = `
.huic[data-card-type="slider"] .huic-slider-value{display:flex;justify-content:center;align-items:baseline;gap:6px;padding-top:4px}
.huic[data-card-type="slider"] .huic-slider-num{appearance:textfield;-moz-appearance:textfield;min-width:3ch;max-width:100%;padding:0 2px 2px;border:0;border-bottom:1.5px dashed var(--ui-stroke-secondary);border-radius:0;background:transparent;color:inherit;font:inherit;font-size:28px;font-weight:600;line-height:1.2;text-align:center;font-variant-numeric:tabular-nums}
.huic[data-card-type="slider"] .huic-slider-num::-webkit-inner-spin-button,.huic[data-card-type="slider"] .huic-slider-num::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.huic[data-card-type="slider"] .huic-slider-num:hover:not(:disabled){border-bottom-color:var(--ui-text-tertiary)}
.huic[data-card-type="slider"] .huic-slider-num:focus{outline:0;border-bottom:1.5px solid var(--huic-accent)}
.huic[data-card-type="slider"] .huic-slider-num:disabled{border-bottom-color:transparent;opacity:1;-webkit-text-fill-color:currentColor}
.huic[data-card-type="slider"] .huic-slider-unit{font-size:16px;font-weight:500;color:var(--ui-text-secondary)}
.huic[data-card-type="slider"] .huic-range{-webkit-appearance:none;appearance:none;display:block;width:100%;height:6px;margin:12px 0 6px;padding:0;border-radius:999px;background:linear-gradient(to right,var(--huic-accent) var(--fill),var(--ui-bg-quaternary) var(--fill));accent-color:var(--huic-accent);cursor:pointer}
.huic[data-card-type="slider"] .huic-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:var(--huic-accent);border:3px solid var(--ui-chat-surface-background,var(--ui-base,Canvas));box-shadow:0 0 0 1px var(--huic-accent);transition:transform .1s}
.huic[data-card-type="slider"] .huic-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--huic-accent);border:3px solid var(--ui-chat-surface-background,var(--ui-base,Canvas));box-shadow:0 0 0 1px var(--huic-accent)}
.huic[data-card-type="slider"] .huic-range::-moz-range-track{background:transparent}
.huic[data-card-type="slider"] .huic-range:hover:not(:disabled)::-webkit-slider-thumb{transform:scale(1.12)}
.huic[data-card-type="slider"] .huic-range:disabled{cursor:default}
.huic[data-card-type="slider"] .huic-range:focus-visible{outline-offset:6px}
.huic[data-card-type="slider"] .huic-slider-ends{display:flex;justify-content:space-between;gap:12px;margin:0}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="slider"] .huic-range::-webkit-slider-thumb{transition:none}}
`

function SliderCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const [draftValue, setValue] = useState(() => ans.draft?.value ?? sliderInitialValue(card))
  const [text, setText] = useState(null) // null: the field shows the committed value
  const value = ans.answer ? ans.answer.data.value : (ans.draft?.value ?? draftValue)
  const typed = text === null ? null : sliderParse(text)
  const live = typed === null ? value : Math.min(card.max, Math.max(card.min, typed))
  const fill = card.max > card.min ? ((live - card.min) / (card.max - card.min)) * 100 : 0
  const valueText = card.unit ? `${value} ${card.unit}` : String(value)
  const withUnit = n => (card.unit ? `${n} ${card.unit}` : String(n))

  const setCommitted = next => {
    setValue(next)
    ans.saveDraft({ value: next })
  }
  const change = e => {
    if (ans.locked) return
    setText(null)
    setCommitted(Number(e.target.value))
  }
  // Clamp and snap what was typed; an empty or non-numeric field falls back to the current value.
  const commit = () => {
    if (text === null) return { n: value, corrected: false }
    const parsed = sliderParse(text)
    setText(null)
    if (parsed === null) return { n: value, corrected: true }
    const n = sliderSnap(card, parsed)
    if (n !== value) setCommitted(n)
    return { n, corrected: n !== parsed }
  }
  const send = n => ans.submit({ value: n })

  return jsx(Shell, {
    card, display, labelId, title: card.question,
    children: [
      jsx('style', { children: SLIDER_CSS }),
      jsxs('div', {
        className: 'huic-slider-value',
        children: [
          jsx('input', {
            type: 'number', className: 'huic-slider-num', inputMode: 'decimal',
            min: card.min, max: card.max, step: card.step || 1,
            value: ans.locked ? String(value) : (text ?? String(value)),
            disabled: ans.locked, 'aria-labelledby': labelId,
            style: { width: `${Math.max(2, (text ?? String(value)).length) + 0.6}ch` },
            onChange: e => { if (!ans.locked) setText(e.target.value) },
            onBlur: () => { if (!ans.locked) commit() },
            onKeyDown: e => {
              if (e.key !== 'Enter' || ans.locked) return
              e.preventDefault()
              const { n, corrected } = commit()
              if (!corrected && ans.showActions) send(n)
            }
          }),
          card.unit ? jsx('span', { className: 'huic-slider-unit', children: card.unit }) : null
        ]
      }),
      jsx('input', {
        type: 'range', className: 'huic-range', min: card.min, max: card.max, step: card.step || 1, value: live,
        disabled: ans.locked, 'aria-labelledby': labelId, 'aria-valuetext': valueText,
        style: { '--fill': `${fill}%` },
        onChange: change,
        onKeyDown: e => { if (e.key === 'Enter' && ans.showActions) { e.preventDefault(); send(value) } }
      }),
      jsxs('div', {
        className: 'huic-sub huic-slider-ends',
        children: [jsx('span', { children: card.minLabel || withUnit(card.min) }), jsx('span', { style: { textAlign: 'right' }, children: card.maxLabel || withUnit(card.max) })]
      })
    ],
    footer: ans.showActions ? jsx(Footer, {
      hint: t(lang, 'keySlider'),
      children: jsx(Btn, {
        variant: 'primary', onClick: () => send(commit().n), children: card.submitLabel || t(lang, 'send')
      })
    }) : null,
    after: ans.status
  })
}
