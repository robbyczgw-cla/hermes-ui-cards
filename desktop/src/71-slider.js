// Snap relative to min, just like the native range input, without float noise.
function sliderInitialValue(card) {
  if (card.default !== undefined) return card.default
  const step = card.step || 1
  const value = card.min + Math.round(((card.max - card.min) / 2) / step) * step
  return Number(Math.min(card.max, Math.max(card.min, value)).toPrecision(12))
}

function SliderCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const [draftValue, setValue] = useState(() => ans.draft?.value ?? sliderInitialValue(card))
  const value = ans.answer ? ans.answer.data.value : (ans.draft?.value ?? draftValue)
  const valueText = card.unit ? `${value} ${card.unit}` : String(value)
  const change = e => {
    if (ans.locked) return
    const next = Number(e.target.value)
    setValue(next)
    ans.saveDraft({ value: next })
  }
  return jsx(Shell, {
    card, display, labelId, title: card.question,
    children: [
      jsx('output', { 'aria-live': 'polite', style: { fontSize: 28, fontWeight: 600, textAlign: 'center' }, children: valueText }),
      jsx('input', {
        type: 'range', min: card.min, max: card.max, step: card.step || 1, value,
        disabled: ans.locked, 'aria-labelledby': labelId, 'aria-valuetext': valueText,
        onChange: change, style: { width: '100%', margin: '8px 0', accentColor: 'var(--huic-accent)' }
      }),
      jsxs('div', {
        className: 'huic-sub', style: { display: 'flex', justifyContent: 'space-between', gap: 12 },
        children: [jsx('span', { children: card.minLabel || String(card.min) }), jsx('span', { style: { textAlign: 'right' }, children: card.maxLabel || String(card.max) })]
      })
    ],
    footer: ans.showActions ? jsx(Footer, { children: jsx(Btn, {
      variant: 'primary', onClick: () => ans.submit({ value }), children: card.submitLabel || t(lang, 'send')
    }) }) : null,
    after: ans.status
  })
}
