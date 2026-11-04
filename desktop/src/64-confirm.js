// confirm: one action with reason and risk; Yes / No / Change (with a text field).
// This is a message to the model, not an approval bypass: Hermes's own approval
// prompts for dangerous commands still apply when the model then runs the command.

const RISK_KEY = { low: 'riskLow', medium: 'riskMedium', high: 'riskHigh' }
const RISK_BARS = { low: 1, medium: 2, high: 3 }

Object.assign(STRINGS.en, {
  confirmApprovalHint: 'Hermes may still ask for its own approval before running it.',
  confirmCommand: 'Command',
  confirmChangeHint: 'Ctrl/⌘+Enter to send',
  confirmApproved: 'Approved', confirmDeclined: 'Declined', confirmChanged: 'Change requested'
})
Object.assign(STRINGS.de, {
  confirmApprovalHint: 'Hermes fragt vor dem Ausführen möglicherweise noch nach einer eigenen Freigabe.',
  confirmCommand: 'Befehl',
  confirmChangeHint: 'Mit Strg/⌘+Enter senden',
  confirmApproved: 'Freigegeben', confirmDeclined: 'Abgelehnt', confirmChanged: 'Änderung angefragt'
})

// Escalation ladder: low = calm accent, medium = orange outline, high = red fill and a
// tinted panel. The exact command sits in a terminal-like block right above the decision.
const CONFIRM_CSS = `
.huic[data-card-type="confirm"]{--risk:var(--huic-accent)}
.huic[data-card-type="confirm"]:has(.huic-risk-medium){--risk:var(--ui-orange,var(--ui-yellow,var(--huic-accent)))}
.huic[data-card-type="confirm"]:has(.huic-risk-high){--risk:var(--ui-red,var(--huic-accent))}
.huic[data-card-type="confirm"]{--huic-on-risk:var(--huic-on-accent)}
.huic[data-card-type="confirm"] .huic-confirm-receipt>span:first-child{--fill:var(--ui-text-tertiary);--on-fill:var(--huic-on-accent)}
@supports (color: oklch(from red l c h)){
 .huic[data-card-type="confirm"]{--huic-on-risk:oklch(from var(--risk) clamp(0, (0.62 - l) * 1000, 1) 0 0)}
 .huic[data-card-type="confirm"] .huic-confirm-receipt>span:first-child{--on-fill:oklch(from var(--fill) clamp(0, (0.62 - l) * 1000, 1) 0 0)}
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
.huic[data-card-type="confirm"] .huic-confirm-foot .huic-foot>.huic-btn-ghost:first-child{margin-right:auto}
.huic[data-card-type="confirm"] .huic-btn-danger-outline{background:transparent;color:var(--risk);box-shadow:inset 0 0 0 1px var(--risk)}
.huic[data-card-type="confirm"] .huic-btn-danger-outline:hover:not([disabled]){background:color-mix(in srgb,var(--risk) 10%,transparent)}
.huic[data-card-type="confirm"] .huic-btn-danger{background:var(--risk);color:var(--huic-on-risk)}
.huic[data-card-type="confirm"] .huic-btn-danger:hover:not([disabled]){background:color-mix(in srgb,var(--risk) 86%,var(--ui-text-primary))}
.huic[data-card-type="confirm"] .huic-confirm-approval{display:flex;gap:6px;align-items:flex-start;margin:0;padding:0 var(--huic-pad) 12px;color:var(--ui-text-tertiary);font-size:11.5px;line-height:16px}
.huic[data-card-type="confirm"] .huic-confirm-approval svg{flex:none;width:13px;height:13px;margin-top:1px}
.huic[data-card-type="confirm"] .huic-confirm-receipt{align-self:flex-start;display:inline-flex;gap:8px;align-items:center;padding:3px 12px 3px 3px;border-radius:999px;font-size:13px;font-weight:600;line-height:20px;color:var(--ui-text-primary);background:var(--ui-bg-tertiary,var(--ui-bg-quaternary));animation:huic-pop .3s var(--huic-ease) both}
.huic[data-card-type="confirm"] .huic-confirm-receipt>span:first-child{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:11px;background:var(--fill);color:var(--on-fill)}
.huic[data-card-type="confirm"] .huic-confirm-receipt.is-yes{background:color-mix(in srgb,var(--ui-green,var(--huic-accent)) 14%,transparent)}
.huic[data-card-type="confirm"] .huic-confirm-receipt.is-yes>span:first-child{--fill:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="confirm"] .huic-confirm-receipt.is-change{background:color-mix(in srgb,var(--huic-accent) 14%,transparent)}
.huic[data-card-type="confirm"] .huic-confirm-receipt.is-change>span:first-child{--fill:var(--huic-accent)}
.huic[data-card-type="confirm"] .huic-confirm-edit{display:flex;flex-direction:column;gap:6px}
@container (max-width: 440px){
 .huic[data-card-type="confirm"] .huic-confirm-foot .huic-foot>.huic-btn-ghost:first-child:not(:last-child){order:3;flex-basis:100%;margin-right:0}
 .huic[data-card-type="confirm"] .huic-risk-text{flex-basis:100%}
}
`

function ConfirmCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const changeId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const [changing, setChanging] = useState(false)
  const [change, setChange] = useState('')
  const changeRef = useRef(null)
  const changeButtonRef = useRef(null)
  const wasChanging = useRef(false)

  useEffect(() => {
    if (changing && changeRef.current) changeRef.current.focus()
    else if (wasChanging.current) changeButtonRef.current?.focus()
    wasChanging.current = changing
  }, [changing])

  const risk = card.risk
  const decision = ans.answer?.data?.decision
  const receipt = { yes: ['✓', 'confirmApproved'], no: ['✗', 'confirmDeclined'], change: ['✎', 'confirmChanged'] }[decision]
  const body = [
    jsx('style', { children: CONFIRM_CSS }, 'style'),
    receipt ? jsxs('div', { className: cx('huic-confirm-receipt', `is-${decision}`), children: [
      jsx('span', { 'aria-hidden': true, children: receipt[0] }),
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
      : null,
    changing && ans.showActions
      ? jsxs('div', { className: 'huic-confirm-edit', children: [
          jsx('textarea', {
            ref: changeRef,
            className: 'huic-input',
            value: change,
            maxLength: 2000,
            placeholder: t(lang, 'changePlaceholder'),
            'aria-label': t(lang, 'changePlaceholder'),
            'aria-describedby': changeId,
            onChange: e => setChange(limitText(e.target.value, 1000)),
            onKeyDown: e => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && change.trim()) {
                e.preventDefault()
                ans.submit({ decision: 'change', change })
              } else if (e.key === 'Escape') {
                e.preventDefault()
                setChanging(false)
              }
            }
          }),
          jsx('span', { id: changeId, className: 'huic-help', children: t(lang, 'confirmChangeHint') })
        ] }, 'change')
      : null
  ]

  const buttons = changing
    ? [
        jsx(Btn, { variant: 'ghost', onClick: () => setChanging(false), children: t(lang, 'cancel') }, 'cancel'),
        jsx(
          Btn,
          {
            variant: 'primary',
            disabled: !change.trim(),
            onClick: () => ans.submit({ decision: 'change', change }),
            children: t(lang, 'sendChange')
          },
          'send'
        )
      ]
    : [
        card.allowChange !== false
          ? jsx(Btn, { ref: changeButtonRef, variant: 'ghost', onClick: () => setChanging(true), children: t(lang, 'change') }, 'change')
          : null,
        jsx(Btn, { variant: 'secondary', onClick: () => ans.submit({ decision: 'no' }), children: card.cancelLabel || t(lang, 'no') }, 'no'),
        jsx(
          Btn,
          {
            variant: risk?.level === 'high' ? 'danger' : risk?.level === 'medium' ? 'danger-outline' : 'primary',
            onClick: () => ans.submit({ decision: 'yes' }),
            children: card.confirmLabel || t(lang, 'yes')
          },
          'yes'
        )
      ]

  return jsx(Shell, {
    card,
    display,
    labelId,
    title: card.title,
    children: body,
    footer: ans.showActions ? jsxs('div', { className: 'huic-confirm-foot', children: [
      jsx(Footer, { children: buttons }),
      card.command ? jsxs('p', { className: 'huic-confirm-approval', children: [
        jsxs('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true, children: [
          jsx('path', { d: 'M8 1.75 3 3.5v4c0 3.1 2.1 5.4 5 6.75 2.9-1.35 5-3.65 5-6.75v-4z', strokeLinejoin: 'round' }),
          jsx('path', { d: 'm5.75 8 1.6 1.6 2.9-3.2', strokeLinecap: 'round', strokeLinejoin: 'round' })
        ] }),
        jsx('span', { children: t(lang, 'confirmApprovalHint') })
      ] }) : null
    ] }) : null,
    after: ans.status
  })
}
