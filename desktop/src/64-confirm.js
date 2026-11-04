// confirm: one action with reason and risk; Yes / No / Change (with a text field).
// This is a message to the model, not an approval bypass: Hermes's own approval
// prompts for dangerous commands still apply when the model then runs the command.

const RISK_KEY = { low: 'riskLow', medium: 'riskMedium', high: 'riskHigh' }
const RISK_ICON = { low: '●', medium: '▲', high: '⬣' }

Object.assign(STRINGS.en, {
  confirmApprovalHint: 'Hermes may still ask for its own approval before running it.',
  confirmChangeHint: 'Ctrl/⌘+Enter to send',
  confirmApproved: 'Approved', confirmDeclined: 'Declined', confirmChanged: 'Change requested'
})
Object.assign(STRINGS.de, {
  confirmApprovalHint: 'Hermes fragt vor dem Ausführen möglicherweise noch nach einer eigenen Freigabe.',
  confirmChangeHint: 'Mit Strg/⌘+Enter senden',
  confirmApproved: 'Freigegeben', confirmDeclined: 'Abgelehnt', confirmChanged: 'Änderung angefragt'
})

const CONFIRM_CSS = `
.huic[data-card-type="confirm"] .huic-risk{flex-wrap:wrap;align-items:baseline;column-gap:6px;row-gap:2px}
.huic[data-card-type="confirm"] .huic-risk-low{color:var(--ui-text-tertiary)}
.huic[data-card-type="confirm"] .huic-risk-medium{color:var(--ui-red,var(--ui-text-primary))}
.huic[data-card-type="confirm"] .huic-risk-high{padding:10px 12px;border-radius:8px;background:color-mix(in srgb,var(--ui-red) 8%,transparent);border:1px solid color-mix(in srgb,var(--ui-red) 18%,transparent)}
.huic[data-card-type="confirm"] .huic-btn-danger-outline{background:transparent;color:var(--ui-red);box-shadow:inset 0 0 0 1px var(--ui-red)}
.huic[data-card-type="confirm"] .huic-btn-danger-outline:hover{background:color-mix(in srgb,var(--ui-red) 8%,transparent)}
.huic[data-card-type="confirm"] .huic-btn-danger{background:var(--ui-red);color:var(--ui-chat-surface-background,var(--ui-base))}
.huic[data-card-type="confirm"] .huic-btn-danger:hover{background:color-mix(in srgb,var(--ui-red) 88%,var(--ui-text-primary))}
.huic[data-card-type="confirm"] .huic-confirm-approval{margin:0;padding:0 var(--huic-pad) 10px;color:var(--ui-text-tertiary);font-size:11px;line-height:1.5}
.huic[data-card-type="confirm"] .huic-confirm-receipt{display:flex;gap:8px;align-items:center;font-size:15px;font-weight:600;padding:8px 0;color:var(--ui-text-primary)}
.huic[data-card-type="confirm"] .huic-confirm-edit{display:flex;flex-direction:column;gap:5px;margin-top:4px}
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
    receipt ? jsxs('div', { className: 'huic-confirm-receipt', children: [
      jsx('span', { 'aria-hidden': true, children: receipt[0] }),
      jsx('span', { children: t(lang, receipt[1]) })
    ] }, 'receipt') : null,
    jsx('p', { style: { margin: 0 }, children: card.action }, 'action'),
    card.reason ? jsx('p', { className: 'huic-sub', style: { margin: 0 }, children: card.reason }, 'reason') : null,
    card.command ? jsx(CodeBlock, { code: card.command, lang }, 'cmd') : null,
    card.details && card.details.length
      ? jsx(KeyValues, { rows: card.details, lang }, 'details')
      : null,
    risk
      ? jsxs(
          'div',
          {
            className: cx('huic-risk', `huic-risk-${risk.level}`),
            children: [
              jsx('span', { 'aria-hidden': true, children: RISK_ICON[risk.level] }),
              jsx('b', { children: t(lang, RISK_KEY[risk.level]) }),
              risk.text ? jsx('span', { style: { color: 'var(--ui-text-secondary)' }, children: risk.text }) : null
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
    footer: ans.showActions ? jsxs('div', { children: [
      jsx(Footer, { children: buttons }),
      card.command ? jsx('p', { className: 'huic-confirm-approval', children: t(lang, 'confirmApprovalHint') }) : null
    ] }) : null,
    after: ans.status
  })
}
