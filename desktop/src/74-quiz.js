// One question at a time; checking locks that choice before revealing feedback.
function QuizCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const questionId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [progress, setProgress] = useState(() => ({
    index: sent ? card.questions.length - 1 : Math.max(0, Math.min(card.questions.length - 1, ans.draft?.index ?? 0)),
    chosen: sent ? sent.answers.map(a => a.chosen) : card.questions.map((_, i) => ans.draft?.chosen?.[i] ?? null),
    checked: card.questions.map((_, i) => Boolean(sent || ans.draft?.checked?.[i]))
  }))
  const visible = sent ? { index: progress.index, chosen: sent.answers.map(a => a.chosen), checked: card.questions.map(() => true) } : (ans.draft || progress)
  const { index, chosen, checked } = visible
  const q = card.questions[index]
  const headingRef = useRef(null)
  const previous = useRef(index)
  useEffect(() => {
    if (previous.current !== index) headingRef.current?.focus()
    previous.current = index
  }, [index])
  const update = change => {
    if (ans.locked) return
    const next = { ...visible, ...change }
    setProgress(next)
    ans.saveDraft(next)
  }
  const pick = option => {
    if (checked[index] || ans.locked) return
    update({ chosen: chosen.map((v, i) => i === index ? option : v) })
  }
  const roving = useRovingFocus(q.options.length)
  const allChecked = checked.every(Boolean)
  const score = chosen.filter((v, i) => v === card.questions[i].answer).length
  const locked = ans.locked || checked[index]
  return jsx(Shell, {
    card, display, labelId, title: card.title,
    subtitle: `${index + 1} / ${card.questions.length}`,
    children: [
      jsx('h4', { id: questionId, ref: headingRef, tabIndex: -1, className: 'huic-title', children: q.question }),
      jsx('div', {
        role: 'radiogroup', 'aria-labelledby': questionId,
        style: { display: 'flex', flexDirection: 'column', gap: 6 },
        children: q.options.map((option, i) => jsx(OptionTile, {
          option: { label: option }, checked: chosen[index] === i, multiple: false, disabled: locked,
          tabIndex: i === (chosen[index] ?? 0) ? 0 : -1,
          refCb: el => (roving.refs.current[i] = el),
          onKeyDown: roving.onKeyDown(i, pick), onToggle: () => pick(i)
        }, `${index}-${i}`))
      }),
      checked[index] ? jsxs('div', {
        role: 'status', className: 'huic-field',
        children: [
          jsx('b', { children: t(lang, chosen[index] === q.answer ? 'correct' : 'wrong') }),
          q.explanation ? jsx('p', { style: { margin: 0 }, children: q.explanation }) : null
        ]
      }) : null,
      allChecked && index === card.questions.length - 1 ? jsx('p', {
        className: 'huic-title', role: 'status', children: t(lang, 'score', { score, total: card.questions.length })
      }) : null
    ],
    footer: ans.showActions ? jsx(Footer, { children: jsxs(Fragment, { children: [
      index > 0 ? jsx(Btn, { onClick: () => update({ index: index - 1 }), children: t(lang, 'back') }) : null,
      !checked[index] ? jsx(Btn, {
        variant: 'primary', disabled: chosen[index] === null,
        onClick: () => { if (chosen[index] !== null) update({ checked: checked.map((v, i) => i === index ? true : v) }) },
        children: t(lang, 'check')
      }) : index < card.questions.length - 1 ? jsx(Btn, {
        variant: 'primary', onClick: () => update({ index: index + 1 }), children: t(lang, 'next')
      }) : jsx(Btn, {
        variant: 'primary', disabled: !allChecked, onClick: () => { if (allChecked) ans.submit({ chosen }) }, children: t(lang, 'sendScore')
      })
    ] }) }) : null,
    after: ans.status
  })
}
