// confirm: one action with reason and risk; Yes / No / Change (with a text field).
// This is a message to the model, not an approval bypass: Hermes's own approval
// prompts for dangerous commands still apply when the model then runs the command.

const RISK_KEY = { low: 'riskLow', medium: 'riskMedium', high: 'riskHigh' }
const RISK_BARS = { low: 1, medium: 2, high: 3 }

Object.assign(STRINGS.en, {
  confirmApprovalHint: 'Hermes may still ask for its own approval before running it.',
  confirmCommand: 'Command',
  confirmChangeHint: '[Ctrl]/[⌘]+[Enter] to send',
  confirmApproved: 'Approved', confirmDeclined: 'Declined', confirmChanged: 'Change requested',
  confirmChangeExample: 'For example: keep the last 90 days',
  confirmPending: 'Approved · sending in {s} s', confirmUndo: 'Undo'
})
Object.assign(STRINGS.de, {
  confirmApprovalHint: 'Hermes fragt vor dem Ausführen möglicherweise noch nach einer eigenen Freigabe.',
  confirmCommand: 'Befehl',
  confirmChangeHint: '[Strg]/[⌘]+[Enter] zum Senden',
  confirmApproved: 'Freigegeben', confirmDeclined: 'Abgelehnt', confirmChanged: 'Änderung angefragt',
  confirmChangeExample: 'Zum Beispiel: die letzten 90 Tage behalten',
  confirmPending: 'Freigegeben · wird in {s} s gesendet', confirmUndo: 'Rückgängig'
})

// Escalation ladder: low = calm accent, medium = orange outline, high = red fill and a
// tinted panel. The exact command sits in a terminal-like block right above the decision.
const CONFIRM_CSS = `
.huic[data-card-type="confirm"]{--risk:var(--huic-accent)}
.huic[data-card-type="confirm"]:has(.huic-risk-medium){--risk:var(--ui-orange,var(--ui-yellow,var(--huic-accent)))}
.huic[data-card-type="confirm"]:has(.huic-risk-high){--risk:var(--ui-red,var(--huic-accent))}
.huic[data-card-type="confirm"]{--huic-on-risk:var(--huic-on-accent);--risk-hover:color-mix(in srgb,var(--risk) 86%,var(--ui-text-primary))}
.huic[data-card-type="confirm"] .huic-confirm-receipt>span:first-child{--fill:var(--ui-text-tertiary);--on-fill:var(--huic-on-accent)}
${HUIC_RELATIVE}{
 .huic[data-card-type="confirm"]{--huic-on-risk:${huicOnColor('var(--risk)')};--risk-hover:color-mix(in srgb,var(--risk) 86%,${huicOnColor('var(--risk)', true)})}
 .huic[data-card-type="confirm"] .huic-confirm-receipt>span:first-child{--on-fill:${huicOnColor('var(--fill)')}}
}
.huic[data-card-type="confirm"] .huic-confirm-action{margin:0;font-size:13.5px;line-height:20px;color:var(--ui-text-primary)}
.huic[data-card-type="confirm"] .huic-confirm-reason{margin:-8px 0 0;color:var(--ui-text-tertiary);font-size:12.5px;line-height:18px}
.huic[data-card-type="confirm"] .huic-confirm-command{display:flex;flex-direction:column;gap:6px}
.huic[data-card-type="confirm"] .huic-confirm-command .huic-code-block{box-shadow:inset 0 0 0 1px var(--huic-line),inset 2px 0 0 color-mix(in srgb,var(--risk) 70%,transparent)}
.huic[data-card-type="confirm"] .huic-risk{display:flex;flex-wrap:wrap;align-items:center;column-gap:8px;row-gap:2px;font-size:12.5px;line-height:18px}
.huic[data-card-type="confirm"] .huic-risk>b{font-weight:600}
.huic[data-card-type="confirm"] .huic-risk-text{color:var(--ui-text-secondary);flex:1 1 12em;min-width:0}
.huic[data-card-type="confirm"] .huic-risk-low{color:var(--ui-text-secondary)}
.huic[data-card-type="confirm"] .huic-risk-medium,.huic[data-card-type="confirm"] .huic-risk-high{padding:10px 12px;border-radius:var(--huic-r-md);color:var(--risk);background:color-mix(in srgb,var(--risk) 9%,transparent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--risk) 22%,transparent)}
.huic[data-card-type="confirm"] .huic-risk-meter{display:inline-flex;align-items:flex-end;gap:2px;height:12px;flex:none}
.huic[data-card-type="confirm"] .huic-risk-meter>i{display:block;width:4px;border-radius:1px;background:color-mix(in srgb,currentColor 22%,transparent)}
.huic[data-card-type="confirm"] .huic-risk-meter>i:nth-child(1){height:6px}
.huic[data-card-type="confirm"] .huic-risk-meter>i:nth-child(2){height:9px}
.huic[data-card-type="confirm"] .huic-risk-meter>i:nth-child(3){height:12px}
.huic[data-card-type="confirm"] .huic-risk-meter>i.on{background:currentColor}
.huic[data-card-type="confirm"] .huic-risk-low .huic-risk-meter{color:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="confirm"] .huic-confirm-foot .huic-foot{flex-wrap:wrap-reverse}
.huic[data-card-type="confirm"] .huic-confirm-foot .huic-foot>.huic-btn-ghost:first-child{margin-right:auto}
.huic[data-card-type="confirm"] .huic-confirm-decide{display:flex;gap:8px;margin-left:auto;max-width:100%}
.huic[data-card-type="confirm"] .huic-confirm-decide>.huic-btn{min-width:0}
.huic[data-card-type="confirm"] .huic-btn-danger-outline{background:transparent;color:var(--risk);box-shadow:inset 0 0 0 1px var(--risk)}
.huic[data-card-type="confirm"] .huic-btn-danger-outline:hover:not([disabled]){background:color-mix(in srgb,var(--risk) 10%,transparent)}
.huic[data-card-type="confirm"] .huic-btn-danger{background:var(--risk);color:var(--huic-on-risk)}
.huic[data-card-type="confirm"] .huic-btn-danger:hover:not([disabled]){background:var(--risk-hover)}
.huic[data-card-type="confirm"] .huic-confirm-approval{display:flex;gap:6px;align-items:flex-start;margin:0;padding:0 var(--huic-pad) 12px;color:var(--ui-text-tertiary);font-size:11.5px;line-height:16px}
.huic[data-card-type="confirm"] .huic-confirm-approval svg{flex:none;width:13px;height:13px;margin-top:1px}
.huic[data-card-type="confirm"] .huic-confirm-receipt{align-self:flex-start;display:inline-flex;gap:8px;align-items:center;padding:3px 12px 3px 3px;border-radius:999px;font-size:13px;font-weight:600;line-height:20px;color:var(--ui-text-primary);background:var(--ui-bg-tertiary,var(--ui-bg-quaternary));animation:huic-pop .3s var(--huic-ease) both}
.huic[data-card-type="confirm"] .huic-confirm-receipt>span:first-child{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:11px;background:var(--fill);color:var(--on-fill)}
.huic[data-card-type="confirm"] .huic-confirm-receipt.is-yes{background:color-mix(in srgb,var(--ui-green,var(--huic-accent)) 14%,transparent)}
.huic[data-card-type="confirm"] .huic-confirm-receipt.is-yes>span:first-child{--fill:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="confirm"] .huic-confirm-receipt.is-change{background:color-mix(in srgb,var(--huic-accent) 14%,transparent)}
.huic[data-card-type="confirm"] .huic-confirm-receipt.is-change>span:first-child{--fill:var(--huic-accent)}
.huic[data-card-type="confirm"] .huic-confirm-receipt .huic-ico{width:12px;height:12px;stroke-width:2}
.huic[data-card-type="confirm"] .huic-confirm-edit{display:flex;flex-direction:column;gap:8px;padding:12px var(--huic-pad);border-top:1px solid var(--huic-line);background:color-mix(in srgb,var(--huic-accent) 5%,transparent);box-shadow:inset 3px 0 0 var(--huic-accent);animation:huic-fade .2s var(--huic-ease) both}
.huic[data-card-type="confirm"] .huic-confirm-edit .huic-label{display:flex;align-items:center;gap:6px}
.huic[data-card-type="confirm"] .huic-confirm-edit .huic-label .huic-ico{color:var(--huic-accent);font-size:14px}
.huic[data-card-type="confirm"] .huic-confirm-edit textarea{min-height:76px;background:var(--ui-chat-surface-background,var(--ui-base))}
.huic[data-card-type="confirm"] .huic-confirm-edit-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.huic[data-card-type="confirm"] .huic-confirm-edit-row>.huic-help{margin-right:auto}
.huic[data-card-type="confirm"] .huic-confirm-pending{position:relative;overflow:hidden;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px var(--huic-pad);border-top:1px solid var(--huic-line);background:color-mix(in srgb,var(--risk) 8%,transparent);color:var(--ui-text-primary)}
.huic[data-card-type="confirm"] .huic-confirm-pending>span:first-child{flex:1 1 12em;min-width:0;display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}
.huic[data-card-type="confirm"] .huic-confirm-pending>span:first-child>.huic-ico{color:var(--risk);font-size:15px}
.huic[data-card-type="confirm"] .huic-confirm-drain{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--risk);transform-origin:left;animation:huic-confirm-drain var(--undo-ms) linear both}
@keyframes huic-confirm-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@container (max-width: 440px){
 .huic[data-card-type="confirm"] .huic-risk-text{flex-basis:100%}
}
`

// Undo window for medium and high risk: Yes waits (Settings → Undo time, default 4 s) so a
// slip can be taken back; low risk, No and Change send at once.
function ConfirmCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const changeId = useId()
  const changeLabelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const submitRef = useRef(ans.submit)
  submitRef.current = ans.submit
  const [changing, setChanging] = useState(false)
  const [change, setChange] = useState('')
  const [pending, setPending] = useState(null) // { ms } while an approval can still be undone
  const changeRef = useRef(null)
  const changeButtonRef = useRef(null)
  const yesRef = useRef(null)
  const undoRef = useRef(null)
  const timer = useRef(null)
  const wasChanging = useRef(false)
  const wasPending = useRef(false)

  useEffect(() => {
    if (changing && changeRef.current) changeRef.current.focus()
    else if (wasChanging.current) changeButtonRef.current?.focus()
    wasChanging.current = changing
  }, [changing])
  // Focus follows the approval: to Undo while it can be taken back, back to Yes after Undo.
  useEffect(() => {
    if (pending) undoRef.current?.focus()
    else if (wasPending.current && !ans.answered) yesRef.current?.focus()
    wasPending.current = Boolean(pending)
  }, [pending, ans.answered])
  useEffect(() => () => clearTimeout(timer.current), [])

  const risk = card.risk
  const guarded = risk?.level === 'medium' || risk?.level === 'high'
  const approve = () => {
    if (timer.current) return
    const ms = guarded ? (typeof undoDelayMs === 'function' ? undoDelayMs(display) : 4000) : 0
    if (!ms) return void ans.submit({ decision: 'yes' })
    setPending({ ms })
    timer.current = setTimeout(() => { timer.current = null; setPending(null); submitRef.current({ decision: 'yes' }) }, ms)
  }
  const undo = () => {
    if (!timer.current) return
    clearTimeout(timer.current); timer.current = null
    setPending(null)
  }
  // Escape only takes back this card's approval, and only from inside the card.
  const onKeyDown = e => {
    if (pending && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); undo() }
  }
  const sendChange = () => { if (change.trim()) ans.submit({ decision: 'change', change }) }

  const decision = ans.answer?.data?.decision
  const receipt = { yes: ['check', 'confirmApproved'], no: ['cross', 'confirmDeclined'], change: ['pencil', 'confirmChanged'] }[decision]
  const body = [
    jsx('style', { children: CONFIRM_CSS }, 'style'),
    receipt ? jsxs('div', { className: cx('huic-confirm-receipt', `is-${decision}`), children: [
      jsx('span', { 'aria-hidden': true, children: jsx(Icon, { name: receipt[0] }) }),
      jsx('span', { children: t(lang, receipt[1]) })
    ] }, 'receipt') : null,
    jsx('p', { className: 'huic-confirm-action', children: card.action }, 'action'),
    card.reason ? jsx('p', { className: 'huic-confirm-reason', children: card.reason }, 'reason') : null,
    card.command ? jsxs('div', { className: 'huic-confirm-command', children: [
      jsx('span', { className: 'huic-eyebrow', children: t(lang, 'confirmCommand') }),
      jsx(CodeBlock, { code: card.command, lang, prompt: true })
    ] }, 'cmd') : null,
    card.details && card.details.length
      ? jsx(KeyValues, { rows: card.details, lang }, 'details')
      : null,
    risk
      ? jsxs(
          'div',
          {
            className: cx('huic-risk', `huic-risk-${risk.level}`),
            children: [
              jsx('span', { className: 'huic-risk-meter', 'aria-hidden': true, children: [1, 2, 3].map(n => jsx('i', { className: n <= RISK_BARS[risk.level] ? 'on' : undefined }, n)) }),
              jsx('b', { children: t(lang, RISK_KEY[risk.level]) }),
              risk.text ? jsx('span', { className: 'huic-risk-text', children: risk.text }) : null
            ]
          },
          'risk'
        )
      : null
  ]

  // The change request takes the footer's place: a labelled box right where Change… was.
  const editor = jsxs('div', { className: 'huic-confirm-edit', children: [
    jsxs('label', { className: 'huic-label', id: changeLabelId, htmlFor: changeId + '-area', children: [jsx(Icon, { name: 'pencil' }), t(lang, 'changePlaceholder')] }),
    jsx('textarea', {
      id: changeId + '-area',
      ref: changeRef,
      className: 'huic-input',
      value: change,
      maxLength: 2000,
      placeholder: t(lang, 'confirmChangeExample'),
      'aria-describedby': changeId,
      onChange: e => setChange(limitText(e.target.value, 1000)),
      onKeyDown: e => {
        if (e.nativeEvent.isComposing) return
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && change.trim()) {
          e.preventDefault()
          sendChange()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          setChanging(false)
        }
      }
    }),
    jsxs('div', { className: 'huic-confirm-edit-row', children: [
      jsx(KeyHint, { id: changeId, text: t(lang, 'confirmChangeHint'), className: 'huic-help' }),
      jsx(Btn, { variant: 'ghost', onClick: () => setChanging(false), children: t(lang, 'cancel') }),
      jsx(Btn, { variant: 'primary', disabled: !change.trim(), onClick: sendChange, children: t(lang, 'sendChange') })
    ] })
  ] })

  const pendingBar = pending ? jsxs('div', { className: 'huic-confirm-pending', role: 'status', 'aria-live': 'polite', style: { '--undo-ms': `${pending.ms}ms` }, children: [
    jsxs('span', { children: [jsx(Icon, { name: 'check' }), t(lang, 'confirmPending', { s: Math.round(pending.ms / 1000) })] }),
    jsx(Btn, { ref: undoRef, variant: 'secondary', onClick: undo, children: jsxs(Fragment, { children: [jsx(Icon, { name: 'undo' }), t(lang, 'confirmUndo')] }) }),
    jsx('span', { className: 'huic-confirm-drain', 'aria-hidden': true })
  ] }) : null

  const buttons = [
    card.allowChange !== false
      ? jsx(Btn, { ref: changeButtonRef, variant: 'ghost', onClick: () => setChanging(true), children: t(lang, 'change') }, 'change')
      : null,
    // No and Yes stay together; when the row is too narrow, Change… moves below them.
    jsxs('span', { className: 'huic-confirm-decide', children: [
      jsx(Btn, { variant: 'secondary', onClick: () => ans.submit({ decision: 'no' }), children: card.cancelLabel || t(lang, 'no') }),
      jsx(Btn, {
        ref: yesRef,
        variant: risk?.level === 'high' ? 'danger' : risk?.level === 'medium' ? 'danger-outline' : 'primary',
        onClick: approve,
        children: card.confirmLabel || t(lang, 'yes')
      })
    ] }, 'decide')
  ]

  const approval = card.command ? jsxs('p', { className: 'huic-confirm-approval', children: [
    jsxs('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true, children: [
      jsx('path', { d: 'M8 1.75 3 3.5v4c0 3.1 2.1 5.4 5 6.75 2.9-1.35 5-3.65 5-6.75v-4z', strokeLinejoin: 'round' }),
      jsx('path', { d: 'm5.75 8 1.6 1.6 2.9-3.2', strokeLinecap: 'round', strokeLinejoin: 'round' })
    ] }),
    jsx('span', { children: t(lang, 'confirmApprovalHint') })
  ] }) : null

  return jsx('div', { onKeyDown, children: jsx(Shell, {
    card,
    display,
    labelId,
    title: card.title,
    children: body,
    footer: ans.showActions ? jsxs('div', { className: 'huic-confirm-foot', children: [
      pending ? pendingBar : changing ? editor : jsx(Footer, { children: buttons }),
      approval
    ] }) : null,
    after: ans.status
  }) })
}
