Object.assign(STRINGS.en, {
  stepsMap: 'Guide steps', stepsWhatHappened: 'What happened?', stepsOptional: 'Optional',
  stepsNotePlaceholder: 'Tell Hermes where you got stuck'
})
Object.assign(STRINGS.de, {
  stepsMap: 'Schritte der Anleitung', stepsWhatHappened: 'Was ist passiert?', stepsOptional: 'Optional',
  stepsNotePlaceholder: 'Sag Hermes, wo du festhängst'
})

const STEPS_CSS = `
.huic[data-card-type="steps"] .huic-steps-map{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 6px;padding:0;list-style:none}
.huic[data-card-type="steps"] .huic-steps-map li{display:block;padding:0;margin:0}
.huic[data-card-type="steps"] .huic-steps-dot{display:grid;place-items:center;min-width:27px;height:27px;border:1px solid var(--ui-stroke-tertiary);border-radius:999px;background:transparent;color:var(--ui-text-secondary);font:inherit;font-size:11px;font-variant-numeric:tabular-nums;cursor:pointer}
.huic[data-card-type="steps"] .huic-steps-dot:hover:not(:disabled){background:var(--ui-control-hover-background)}
.huic[data-card-type="steps"] .huic-steps-dot[aria-current="step"]{background:var(--huic-accent);border-color:var(--huic-accent);color:var(--ui-chat-surface-background,var(--ui-base));font-weight:600}
.huic[data-card-type="steps"] .huic-steps-dot:disabled{color:var(--ui-text-secondary);opacity:.65;cursor:default}
.huic[data-card-type="steps"] .huic-steps-done{border-color:color-mix(in srgb,var(--huic-accent) 40%,var(--ui-stroke-tertiary));color:var(--huic-accent);background:color-mix(in srgb,var(--huic-accent) 7%,transparent)}
.huic[data-card-type="steps"] .huic-steps-left{margin-right:auto;min-width:0}
.huic[data-card-type="steps"] .huic-steps-left button::before{content:'⚠';margin-right:6px}
.huic[data-card-type="steps"] .huic-steps-nav{display:flex;gap:8px;align-items:center;margin-left:auto}
.huic[data-card-type="steps"] .huic-steps-report{padding:12px var(--huic-pad);border-top:1px solid var(--ui-stroke-tertiary);display:flex;flex-direction:column;gap:7px}
.huic[data-card-type="steps"] .huic-steps-report-actions{display:flex;justify-content:flex-end;gap:8px}
`

function StepsCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const noteId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const [localIndex, setIndex] = useState(() => Math.max(0, Math.min(card.steps.length - 1, ans.draft?.index ?? 0)))
  const index = Math.max(0, Math.min(card.steps.length - 1, ans.draft?.index ?? localIndex))
  const [reporting, setReporting] = useState(false)
  const [note, setNote] = useState('')
  const noteRef = useRef(null)
  const stuckRef = useRef(null)
  const wasReporting = useRef(false)
  const headingRef = useRef(null)
  const previous = useRef(index)
  useEffect(() => {
    if (previous.current !== index) headingRef.current?.focus()
    previous.current = index
  }, [index])
  useEffect(() => {
    if (reporting) noteRef.current?.focus()
    else if (wasReporting.current) stuckRef.current?.focus()
    wasReporting.current = reporting
  }, [reporting])
  const move = next => {
    if (next < 0 || next >= card.steps.length) return
    setIndex(next)
    ans.saveDraft({ index: next })
  }
  const sendStuck = () => {
    if (ans.submit({ stuck: index + 1, ...(note.trim() ? { note: note.trim() } : {}) })) setReporting(false)
  }
  const navigate = e => {
    if (!(ans.showActions || ans.answered) || reporting || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.nativeEvent.isComposing) return
    if (e.target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')) return
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      move(index + (e.key === 'ArrowLeft' ? -1 : 1))
    }
  }
  const step = card.steps[index]
  const progressText = t(lang, 'stepOf', { n: index + 1, total: card.steps.length })
  const canNavigate = ans.showActions || ans.answered
  return jsx('div', { onKeyDown: navigate, children: jsx(Shell, {
    card, display, labelId, title: card.title,
    children: [
      jsx('style', { children: STEPS_CSS }),
      jsx('span', { className: 'huic-sub', children: progressText }),
      jsx('div', {
        className: 'huic-progress', role: 'progressbar', 'aria-label': progressText,
        'aria-valuemin': 0, 'aria-valuemax': card.steps.length, 'aria-valuenow': index + 1,
        children: jsx('span', { style: { width: `${((index + 1) / card.steps.length) * 100}%` } })
      }),
      jsx('ol', { className: 'huic-steps-map', 'aria-label': t(lang, 'stepsMap'), children: card.steps.map((item, i) =>
        jsx('li', { children: jsx('button', {
          type: 'button', className: cx('huic-steps-dot', i < index && 'huic-steps-done'),
          title: item.title, 'aria-label': `${t(lang, 'stepOf', { n: i + 1, total: card.steps.length })}: ${item.title}`,
          'aria-current': i === index ? 'step' : undefined,
          disabled: !canNavigate || i > index,
          onClick: () => move(i), children: i + 1
        }) }, i)
      ) }),
      jsx('h4', { ref: headingRef, tabIndex: -1, className: 'huic-title', children: step.title }),
      step.body ? jsx('p', { style: { margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }, children: step.body }) : null,
      step.command ? jsx(CodeBlock, { code: step.command, lang }) : null,
      step.image ? jsx(CardImage, { src: step.image }, index) : null
    ],
    footer: canNavigate ? (reporting && ans.showActions
      ? jsxs('div', { className: 'huic-steps-report', children: [
          jsxs('label', { htmlFor: noteId, className: 'huic-label', children: [t(lang, 'stepsWhatHappened'), ' ', jsx('span', { className: 'huic-req', children: `(${t(lang, 'stepsOptional')})` })] }),
          jsx('input', {
            id: noteId, ref: noteRef, className: 'huic-input', type: 'text', value: note, maxLength: 600,
            placeholder: t(lang, 'stepsNotePlaceholder'), onChange: e => setNote(limitText(e.target.value, 300)),
            onKeyDown: e => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Escape') { e.preventDefault(); setReporting(false) }
              else if (e.key === 'Enter') { e.preventDefault(); sendStuck() }
            }
          }),
          jsxs('div', { className: 'huic-steps-report-actions', children: [
            jsx(Btn, { variant: 'ghost', onClick: () => setReporting(false), children: t(lang, 'cancel') }),
            jsx(Btn, { variant: 'primary', onClick: sendStuck, children: t(lang, 'send') })
          ] })
        ] })
      : jsx(Footer, { children: jsxs(Fragment, { children: [
          ans.showActions ? jsx('span', { className: 'huic-steps-left', children: jsx(Btn, { ref: stuckRef, label: t(lang, 'stuck'), variant: 'ghost', onClick: () => setReporting(true), children: t(lang, 'stuck') }) }) : null,
          jsxs('div', { className: 'huic-steps-nav', children: [
            index > 0 ? jsx(Btn, { onClick: () => move(index - 1), children: t(lang, 'back') }) : null,
            index === card.steps.length - 1
              ? (ans.showActions ? jsx(Btn, { variant: 'primary', onClick: () => ans.submit({ completed: true }), children: card.finishLabel || t(lang, 'finish') }) : null)
              : jsx(Btn, { variant: 'primary', onClick: () => move(index + 1), children: t(lang, 'next') })
          ] })
        ] }) })) : null,
    after: ans.status
  }) })
}
