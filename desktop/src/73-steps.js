Object.assign(STRINGS.en, {
  stepsMap: 'Guide steps', stepsWhatHappened: 'What happened?', stepsOptional: 'Optional',
  stepsNotePlaceholder: 'Tell Hermes where you got stuck',
  stepsSentStuck: 'Sent: stuck at step {n}'
})
Object.assign(STRINGS.de, {
  stepsMap: 'Schritte der Anleitung', stepsWhatHappened: 'Was ist passiert?', stepsOptional: 'Optional',
  stepsNotePlaceholder: 'Sag Hermes, wo du festhängst',
  stepsSentStuck: 'Gesendet: komme bei Schritt {n} nicht weiter'
})

// A calm guide: one connected track (the progress bar is its line), the current step as
// an eyebrow + title, content that fades in per step, Next carries an arrow.
const STEPS_CSS = `
.huic[data-card-type="steps"] .huic-steps-track{--dot:26px;position:relative;margin:0 0 4px}
.huic[data-card-type="steps"] .huic-steps-track>.huic-progress{position:absolute;left:calc(var(--dot) / 2);right:calc(var(--dot) / 2);top:calc(var(--dot) / 2 - 1px);height:2px}
.huic[data-card-type="steps"] .huic-steps-map{position:relative;display:flex;justify-content:space-between;gap:4px;margin:0;padding:0;list-style:none}
.huic[data-card-type="steps"] .huic-steps-map li{display:block;padding:0;margin:0}
.huic[data-card-type="steps"] .huic-steps-dot{position:relative;display:grid;place-items:center;width:var(--dot);height:var(--dot);padding:0;border:1px solid var(--huic-line-strong);border-radius:999px;background:var(--ui-chat-surface-background,var(--ui-base));color:var(--ui-text-tertiary);font:inherit;font-size:11px;font-weight:500;font-variant-numeric:tabular-nums;cursor:pointer;transition:background .2s,border-color .2s,color .2s,box-shadow .2s}
.huic[data-card-type="steps"] .huic-steps-dot:hover:not(:disabled){border-color:var(--huic-accent);color:var(--ui-text-primary)}
.huic[data-card-type="steps"] .huic-steps-dot[aria-current="step"]{background:var(--huic-accent);border-color:var(--huic-accent);color:var(--huic-on-accent);font-weight:600;box-shadow:0 0 0 4px color-mix(in srgb,var(--huic-accent) 16%,transparent)}
.huic[data-card-type="steps"] .huic-steps-dot:disabled{cursor:default}
.huic[data-card-type="steps"] .huic-steps-dot.huic-steps-done{border-color:color-mix(in srgb,var(--huic-accent) 45%,var(--huic-line));color:var(--huic-accent);background:color-mix(in srgb,var(--huic-accent) 10%,var(--ui-chat-surface-background,var(--ui-base)));font-size:0}
.huic[data-card-type="steps"] .huic-steps-done::before{content:"";width:8px;height:4px;border-left:1.75px solid currentColor;border-bottom:1.75px solid currentColor;transform:translate(0,-1px) rotate(-45deg)}
.huic[data-card-type="steps"] .huic-steps-content{display:flex;flex-direction:column;gap:8px;animation:huic-fade .28s var(--huic-ease) both}
.huic[data-card-type="steps"] .huic-steps-content>.huic-code-block,.huic[data-card-type="steps"] .huic-steps-content>.huic-img{margin-top:4px}
.huic[data-card-type="steps"] .huic-steps-title{margin:-6px 0 0;font-size:15px;line-height:22px;font-weight:600;letter-spacing:-.01em;outline:none}
.huic[data-card-type="steps"] .huic-steps-body{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ui-text-secondary);line-height:1.6}
.huic[data-card-type="steps"] .huic-steps-left{margin-right:auto;min-width:0}
.huic[data-card-type="steps"] .huic-steps-left .huic-ico{font-size:16px;stroke-width:1.4}
.huic[data-card-type="steps"] .huic-steps-nav{display:flex;gap:8px;align-items:center;margin-left:auto}
.huic[data-card-type="steps"] .huic-steps-next::after{content:"→";transition:transform .15s var(--huic-ease)}
.huic[data-card-type="steps"] .huic-steps-next:hover::after{transform:translateX(2px)}
.huic[data-card-type="steps"] .huic-steps-report{padding:12px var(--huic-pad);border-top:1px solid var(--huic-line);background:color-mix(in srgb,var(--ui-orange,var(--huic-accent)) 5%,transparent);box-shadow:inset 3px 0 0 var(--ui-orange,var(--huic-accent));display:flex;flex-direction:column;gap:8px;animation:huic-fade .2s var(--huic-ease) both}
.huic[data-card-type="steps"] .huic-steps-report-actions{display:flex;justify-content:flex-end;gap:8px}
.huic[data-card-type="steps"] .huic-steps-sent{display:flex;align-items:center;gap:8px;min-width:0;margin-right:auto;padding:3px 12px 3px 3px;border-radius:999px;background:color-mix(in srgb,var(--huic-accent) 12%,transparent);font-size:12.5px;line-height:18px;animation:huic-pop .3s var(--huic-ease) both}
.huic[data-card-type="steps"] .huic-steps-sent>i{flex:none;display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--huic-accent);color:var(--huic-on-accent);font-size:12px}
.huic[data-card-type="steps"] .huic-steps-sent>i .huic-ico{stroke-width:2.2}
.huic[data-card-type="steps"] .huic-steps-sent b{font-weight:600}
.huic[data-card-type="steps"] .huic-steps-sent q{color:var(--ui-text-secondary);quotes:"“" "”";overflow-wrap:anywhere}
.huic[data-card-type="steps"] .huic-steps-sent.is-stuck{background:color-mix(in srgb,var(--ui-orange,var(--huic-accent)) 12%,transparent);border-radius:var(--huic-r-md);padding:5px 12px 5px 5px;align-items:flex-start}
.huic[data-card-type="steps"] .huic-steps-sent.is-stuck>i{background:var(--ui-orange,var(--huic-accent));color:${huicOnColor('var(--ui-orange, var(--huic-accent))')}}
.huic[data-card-type="steps"] .huic-steps-sent-text{display:flex;flex-direction:column;min-width:0;padding-top:2px}
@container (max-width: 440px){
 .huic[data-card-type="steps"] .huic-steps-track{--dot:22px}
 .huic-steps-frame[data-many] .huic-steps-map{gap:2px}
 .huic[data-card-type="steps"] .huic-steps-left .huic-btn{padding-inline:8px}
}
@container (max-width: 340px){.huic-steps-frame[data-many] .huic-steps-track{--dot:18px}.huic-steps-frame[data-many] .huic-steps-dot{font-size:9.5px}}
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
  // Answered and stuck: the footer keeps the note that was sent (the answer bar only names the step).
  // Done needs nothing extra; the answer bar below already says it.
  const sentAs = ans.answer?.selection
  const sentReceipt = !ans.answered || !sentAs?.stuck ? null
    : jsxs('span', { className: 'huic-steps-sent is-stuck', children: [
        jsx('i', { 'aria-hidden': true, children: jsx(Icon, { name: 'question' }) }),
        jsxs('span', { className: 'huic-steps-sent-text', children: [
          jsx('b', { children: t(lang, 'stepsSentStuck', { n: sentAs.stuck }) }),
          sentAs.note ? jsx('q', { children: sentAs.note }) : null
        ] })
      ] })
  return jsx('div', { onKeyDown: navigate, 'data-many': card.steps.length > 8 ? '' : undefined, className: 'huic-steps-frame', children: jsx(Shell, {
    card, display, labelId, title: card.title,
    children: [
      jsx('style', { children: STEPS_CSS }),
      jsxs('div', { className: 'huic-steps-track', children: [
        jsx('div', {
          className: 'huic-progress', role: 'progressbar', 'aria-label': progressText,
          'aria-valuemin': 0, 'aria-valuemax': card.steps.length, 'aria-valuenow': index + 1,
          children: jsx('span', { style: { width: `${(index / (card.steps.length - 1)) * 100}%` } })
        }),
        jsx('ol', { className: 'huic-steps-map', 'aria-label': t(lang, 'stepsMap'), children: card.steps.map((item, i) =>
          jsx('li', { children: jsx('button', {
            type: 'button', className: cx('huic-steps-dot', i < index && 'huic-steps-done'),
            title: item.title, 'aria-label': `${t(lang, 'stepOf', { n: i + 1, total: card.steps.length })}: ${item.title}`,
            'aria-current': i === index ? 'step' : undefined,
            disabled: !canNavigate || i > index,
            onClick: () => move(i), children: i + 1
          }) }, i)
        ) })
      ] }),
      jsxs('div', { className: 'huic-steps-content', children: [
        jsx('span', { className: 'huic-eyebrow', children: progressText }),
        jsx('h4', { ref: headingRef, tabIndex: -1, className: 'huic-title huic-steps-title', children: step.title }),
        step.body ? jsx('p', { className: 'huic-steps-body', children: step.body }) : null,
        step.command ? jsx(CodeBlock, { code: step.command, lang, prompt: true }) : null,
        step.image ? jsx(CardImage, { src: step.image }, index) : null
      ] }, index)
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
          sentReceipt,
          ans.showActions ? jsx('span', { className: 'huic-steps-left', children: jsx(Btn, { ref: stuckRef, label: t(lang, 'stuck'), variant: 'ghost', onClick: () => setReporting(true), children: jsxs(Fragment, { children: [jsx(Icon, { name: 'help' }), t(lang, 'stuck')] }) }) }) : null,
          jsxs('div', { className: 'huic-steps-nav', children: [
            index > 0 ? jsx(Btn, { onClick: () => move(index - 1), children: t(lang, 'back') }) : null,
            index === card.steps.length - 1
              ? (ans.showActions ? jsx(Btn, { variant: 'primary', onClick: () => ans.submit({ completed: true }), children: card.finishLabel || t(lang, 'finish') }) : null)
              : jsx(Btn, { variant: 'primary', className: 'huic-steps-next', onClick: () => move(index + 1), children: t(lang, 'next') })
          ] })
        ] }) })) : null,
    after: ans.status
  }) })
}
