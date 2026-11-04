// rating: a keyboard-operable radio scale, with an optional comment.
function RatingCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [picked, setPicked] = useState(null)
  const [comment, setComment] = useState('')
  const value = sent ? sent.value : picked
  const scale = card.scale ?? 5
  const roving = useRovingFocus(scale)
  const choose = n => { if (!ans.locked) setPicked(n) }

  return jsx(Shell, {
    card, display, labelId, title: card.question,
    children: [
      jsx('div', {
        role: 'radiogroup', 'aria-labelledby': labelId,
        style: { display: 'grid', gridTemplateColumns: `repeat(${scale},minmax(0,1fr))`, gap: 3 },
        children: Array.from({ length: scale }, (_, i) => jsx('button', {
          type: 'button', role: 'radio', className: 'huic-opt',
          'aria-label': t(lang, 'rate', { n: i + 1, max: scale }),
          'aria-checked': value === i + 1,
          disabled: ans.locked, tabIndex: i === (value ? value - 1 : 0) ? 0 : -1,
          ref: el => (roving.refs.current[i] = el),
          onKeyDown: roving.onKeyDown(i, next => choose(next + 1)),
          onClick: () => choose(i + 1),
          style: {
            padding: '8px 0', justifyContent: 'center', minWidth: 0,
            fontSize: card.style === 'numbers' ? 14 : 20,
            color: value >= i + 1 ? 'var(--huic-accent)' : 'var(--ui-text-tertiary)'
          },
          children: card.style === 'numbers' ? i + 1 : '★'
        }, i + 1))
      }),
      card.lowLabel || card.highLabel ? jsxs('div', {
        className: 'huic-sub', style: { display: 'flex', justifyContent: 'space-between', gap: 12 },
        children: [jsx('span', { children: card.lowLabel }), jsx('span', { style: { textAlign: 'right' }, children: card.highLabel })]
      }) : null,
      card.comment ? jsxs('label', {
        className: 'huic-field',
        children: [
          jsx('span', { className: 'huic-label', children: t(lang, 'comment') }),
          jsx('textarea', {
            className: 'huic-input', disabled: ans.locked, maxLength: 2000,
            value: sent ? sent.comment || '' : comment, onChange: e => setComment(limitText(e.target.value, 1000))
          })
        ]
      }) : null
    ],
    footer: ans.showActions ? jsx(Footer, {
      children: jsx(Btn, { variant: 'primary', disabled: value === null,
        onClick: () => { if (value !== null) ans.submit({ value, comment }) }, children: t(lang, 'send') })
    }) : null,
    after: ans.status
  })
}
