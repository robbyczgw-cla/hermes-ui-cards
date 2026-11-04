function StepsCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const [localIndex, setIndex] = useState(() => Math.max(0, Math.min(card.steps.length - 1, ans.draft?.index ?? 0)))
  const index = ans.draft?.index ?? localIndex
  const headingRef = useRef(null)
  const previous = useRef(index)
  useEffect(() => {
    if (previous.current !== index) headingRef.current?.focus()
    previous.current = index
  }, [index])
  const move = next => {
    if (ans.locked) return
    setIndex(next)
    ans.saveDraft({ index: next })
  }
  const step = card.steps[index]
  const progressText = t(lang, 'stepOf', { n: index + 1, total: card.steps.length })
  return jsx(Shell, {
    card, display, labelId, title: card.title,
    children: ans.locked ? jsx('ol', {
      style: { margin: 0, paddingLeft: 22 },
      children: card.steps.map((s, i) => jsx('li', { children: s.title }, i))
    }) : [
      jsx('span', { className: 'huic-sub', children: progressText }),
      jsx('div', {
        className: 'huic-progress', role: 'progressbar', 'aria-label': progressText,
        'aria-valuemin': 0, 'aria-valuemax': card.steps.length, 'aria-valuenow': index + 1,
        children: jsx('span', { style: { width: `${((index + 1) / card.steps.length) * 100}%` } })
      }),
      jsx('h4', { ref: headingRef, tabIndex: -1, className: 'huic-title', children: step.title }),
      step.body ? jsx('p', { style: { margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, children: step.body }) : null,
      step.command ? jsx(CodeBlock, { code: step.command, lang }) : null,
      step.image ? jsx(CardImage, { src: step.image }, index) : null
    ],
    footer: ans.showActions ? jsx(Footer, { children: jsxs(Fragment, { children: [
      jsx(Btn, { variant: 'ghost', onClick: () => ans.submit({ stuck: index + 1 }), children: t(lang, 'stuck') }),
      jsx(Btn, { disabled: index === 0, onClick: () => move(index - 1), children: t(lang, 'back') }),
      index === card.steps.length - 1
        ? jsx(Btn, { variant: 'primary', onClick: () => ans.submit({ completed: true }), children: card.finishLabel || t(lang, 'finish') })
        : jsx(Btn, { variant: 'primary', onClick: () => move(index + 1), children: t(lang, 'next') })
    ] }) }) : null,
    after: ans.status
  })
}
