// quiz: one question at a time; checking locks that pick before feedback is shown.
// A segmented bar tracks the questions, a result screen shows the score before sending.

Object.assign(STRINGS.en, {
  questionOf: 'Question {n} of {total}',
  quizResult: 'Result',
  seeResult: 'See result',
  correctAnswer: 'Correct answer: {x}'
})
Object.assign(STRINGS.de, {
  questionOf: 'Frage {n} von {total}',
  quizResult: 'Ergebnis',
  seeResult: 'Ergebnis ansehen',
  correctAnswer: 'Richtig: {x}'
})

const QUIZ_CSS = `
.huic[data-card-type="quiz"] h4[tabindex="-1"]:focus{outline:0}
.huic[data-card-type="quiz"] .huic-qsegs{display:flex;gap:4px;margin:2px 0 4px}
.huic[data-card-type="quiz"] .huic-qseg{flex:1 1 0;height:6px;border-radius:999px;background:var(--ui-bg-quaternary);transition:background .15s}
.huic[data-card-type="quiz"] .huic-qseg-cur{background:color-mix(in srgb,var(--huic-accent) 55%,transparent);box-shadow:0 0 0 1.5px var(--ui-chat-surface-background,var(--ui-base,Canvas)),0 0 0 3px var(--ui-stroke-secondary)}
.huic[data-card-type="quiz"] .huic-qseg-ok{background:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="quiz"] .huic-qseg-bad{background:var(--ui-red,var(--ui-text-tertiary))}
.huic[data-card-type="quiz"] .huic-opt-correct{border-color:var(--ui-green,var(--huic-accent));background:color-mix(in srgb,var(--ui-green,var(--huic-accent)) 14%,transparent)}
.huic[data-card-type="quiz"] .huic-opt-wrong{border-color:var(--ui-red,var(--ui-text-tertiary));background:color-mix(in srgb,var(--ui-red,var(--ui-text-tertiary)) 12%,transparent)}
.huic[data-card-type="quiz"] .huic-opt-correct .huic-num-state{background:var(--ui-green,var(--huic-accent));border-color:var(--ui-green,var(--huic-accent));color:var(--ui-chat-surface-background,var(--ui-base,Canvas))}
.huic[data-card-type="quiz"] .huic-opt-wrong .huic-num-state{background:var(--ui-red,var(--ui-text-tertiary));border-color:var(--ui-red,var(--ui-text-tertiary));color:var(--ui-chat-surface-background,var(--ui-base,Canvas))}
.huic[data-card-type="quiz"] .huic-quiz-done .huic-opt{cursor:default}
.huic[data-card-type="quiz"] .huic-quiz-done .huic-opt:not(.huic-opt-correct):not(.huic-opt-wrong){opacity:.6}
.huic[data-card-type="quiz"] .huic-quiz-done .huic-opt:not(.huic-opt-correct):not(.huic-opt-wrong):hover{background:transparent}
.huic[data-card-type="quiz"] .huic-callout{display:flex;flex-direction:column;gap:2px;padding:9px 12px;border-radius:9px;background:var(--ui-bg-quaternary);border-left:3px solid var(--ui-text-tertiary)}
.huic[data-card-type="quiz"] .huic-callout-ok{border-left-color:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="quiz"] .huic-callout-bad{border-left-color:var(--ui-red,var(--ui-text-tertiary))}
.huic[data-card-type="quiz"] .huic-callout-ok b{color:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="quiz"] .huic-callout-bad b{color:var(--ui-red,var(--ui-text-primary))}
.huic[data-card-type="quiz"] .huic-callout p{margin:0;color:var(--ui-text-secondary)}
.huic[data-card-type="quiz"] .huic-score{display:flex;align-items:baseline;gap:8px;margin:2px 0 0}
.huic[data-card-type="quiz"] .huic-score-big{font-size:30px;font-weight:700;line-height:1.1;color:var(--huic-accent);font-variant-numeric:tabular-nums}
.huic[data-card-type="quiz"] .huic-review{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}
.huic[data-card-type="quiz"] .huic-review li{display:flex;gap:8px;align-items:flex-start;padding:7px 10px;border-radius:9px;border:1px solid var(--ui-stroke-tertiary)}
.huic[data-card-type="quiz"] .huic-review-mark{flex:none;width:18px;text-align:center;font-weight:700}
.huic[data-card-type="quiz"] .huic-review-ok .huic-review-mark{color:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="quiz"] .huic-review-bad .huic-review-mark{color:var(--ui-red,var(--ui-text-primary))}
`

function QuizCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const questionId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const total = card.questions.length
  const [progress, setProgress] = useState(() => {
    const checkedNow = card.questions.map((_, i) => Boolean(sent || ans.draft?.checked?.[i]))
    // index === total is the result screen, reachable only once every question is checked.
    const wanted = sent ? total : Math.max(0, Math.min(total, ans.draft?.index ?? 0))
    return {
      index: wanted >= total && !checkedNow.every(Boolean) ? total - 1 : wanted,
      chosen: sent ? sent.answers.map(a => a.chosen) : card.questions.map((_, i) => ans.draft?.chosen?.[i] ?? null),
      checked: checkedNow
    }
  })
  const visible = sent ? { index: total, chosen: sent.answers.map(a => a.chosen), checked: card.questions.map(() => true) } : (ans.draft || progress)
  const { chosen, checked } = visible
  const index = Math.min(visible.index, checked.every(Boolean) ? total : total - 1)
  const inResult = index >= total
  const q = inResult ? null : card.questions[index]
  const headingRef = useRef(null)
  const previous = useRef(index)
  useEffect(() => {
    if (previous.current !== index) headingRef.current?.focus()
    previous.current = index
  }, [index])
  const update = change => {
    if (ans.locked) return
    const next = { ...visible, index, ...change }
    setProgress(next)
    ans.saveDraft(next)
  }
  const roving = useRovingFocus(q ? q.options.length : 1)
  const done = !inResult && checked[index]
  const allChecked = checked.every(Boolean)
  const isRight = i => chosen[i] === card.questions[i].answer
  const score = chosen.filter((v, i) => v === card.questions[i].answer).length
  const pick = option => {
    if (done || ans.locked || inResult) return
    update({ chosen: chosen.map((v, i) => i === index ? option : v) })
  }
  const check = () => { if (!inResult && chosen[index] !== null) update({ checked: checked.map((v, i) => i === index ? true : v) }) }
  const next = () => update({ index: index + 1 })
  const sendResult = () => { if (allChecked) ans.submit({ chosen }) }
  // The one thing Enter does right now.
  const primary = inResult ? sendResult : done ? next : check

  const onKeyDown = event => {
    if (ans.locked || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    const tag = event.target && event.target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    if (event.key === 'Enter') {
      event.preventDefault()
      primary()
    } else if (/^[1-9]$/.test(event.key) && q && !done && Number(event.key) <= q.options.length) {
      event.preventDefault()
      const i = Number(event.key) - 1
      pick(i)
      roving.refs.current[i] && roving.refs.current[i].focus()
    }
  }

  const bar = jsx('div', {
    className: 'huic-qsegs', role: 'progressbar', 'aria-label': card.title || t(lang, 'quizResult'),
    'aria-valuemin': 1, 'aria-valuemax': total, 'aria-valuenow': Math.min(index + 1, total),
    'aria-valuetext': inResult ? t(lang, 'quizResult') : t(lang, 'questionOf', { n: index + 1, total }),
    children: card.questions.map((_, i) => jsx('span', {
      className: cx('huic-qseg', checked[i] ? (isRight(i) ? 'huic-qseg-ok' : 'huic-qseg-bad') : null, i === index && 'huic-qseg-cur')
    }, i))
  })

  let body
  if (inResult) {
    body = [
      jsxs('div', {
        className: 'huic-score', role: 'status',
        children: [
          jsx('span', { className: 'huic-score-big', 'aria-hidden': true, children: `${score}/${total}` }),
          jsx('h4', { id: questionId, ref: headingRef, tabIndex: -1, className: 'huic-title', children: t(lang, 'score', { score, total }) })
        ]
      }),
      jsx('ul', {
        className: 'huic-review',
        children: card.questions.map((item, i) => jsxs('li', {
          className: isRight(i) ? 'huic-review-ok' : 'huic-review-bad',
          children: [
            jsx('span', { className: 'huic-review-mark', 'aria-hidden': true, children: isRight(i) ? '✓' : '✗' }),
            jsxs('span', {
              className: 'huic-opt-text',
              children: [
                jsx('span', { className: 'huic-opt-label', children: item.question }),
                isRight(i) ? null : jsx('span', { className: 'huic-opt-desc', children: t(lang, 'correctAnswer', { x: item.options[item.answer] }) })
              ]
            })
          ]
        }, i))
      })
    ]
  } else {
    body = [
      jsx('h4', { id: questionId, ref: headingRef, tabIndex: -1, className: 'huic-title', children: q.question }),
      jsx('div', {
        role: 'radiogroup', 'aria-labelledby': questionId,
        className: done ? 'huic-quiz-done' : undefined,
        style: { display: 'flex', flexDirection: 'column', gap: 6 },
        children: q.options.map((option, i) => jsx(OptionTile, {
          option: { label: option }, index: i, num: i < 9 ? i + 1 : undefined,
          checked: chosen[index] === i, multiple: false,
          disabled: ans.locked, ariaDisabled: done,
          state: done ? (i === q.answer ? 'correct' : chosen[index] === i ? 'wrong' : undefined) : undefined,
          tabIndex: i === (chosen[index] ?? 0) ? 0 : -1,
          refCb: el => (roving.refs.current[i] = el),
          onKeyDown: roving.onKeyDown(i, pick), onToggle: () => pick(i)
        }, `${index}-${i}`))
      }),
      done ? jsxs('div', {
        role: 'status', className: cx('huic-callout', isRight(index) ? 'huic-callout-ok' : 'huic-callout-bad'),
        children: [
          jsx('b', { children: (isRight(index) ? '✓ ' : '✗ ') + t(lang, isRight(index) ? 'correct' : 'wrong') }),
          q.explanation ? jsx('p', { children: q.explanation }) : null
        ]
      }) : null
    ]
  }

  const hintKey = inResult ? 'keySend' : done ? 'keyNext' : 'keyCheck'
  return jsx(Shell, {
    card, display, labelId, title: card.title,
    subtitle: inResult ? t(lang, 'quizResult') : t(lang, 'questionOf', { n: index + 1, total }),
    children: jsxs('div', {
      onKeyDown: ans.showActions ? onKeyDown : undefined,
      style: { display: 'flex', flexDirection: 'column', gap: 8 },
      children: [jsx('style', { children: KEYS_CSS + QUIZ_CSS }), bar, ...body]
    }),
    footer: ans.showActions ? jsx(Footer, {
      hint: t(lang, hintKey, { keys: keyRange(q ? q.options.length : 0) }),
      children: jsxs(Fragment, { children: [
        index > 0 ? jsx(Btn, { onClick: () => update({ index: index - 1 }), children: t(lang, 'back') }) : null,
        inResult
          ? jsx(Btn, { variant: 'primary', disabled: !allChecked, onClick: sendResult, children: t(lang, 'sendScore') })
          : !done
            ? jsx(Btn, { variant: 'primary', disabled: chosen[index] === null, onClick: check, children: t(lang, 'check') })
            : jsx(Btn, { variant: 'primary', onClick: next, children: t(lang, index < total - 1 ? 'next' : 'seeResult') })
      ] })
    }) : null,
    after: ans.status
  })
}
