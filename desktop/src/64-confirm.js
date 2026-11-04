// confirm: one action with reason and risk; Yes / No / Change (with a text field).
// This is a message to the model, not an approval bypass: Hermes's own approval
// prompts for dangerous commands still apply when the model then runs the command.

const RISK_KEY = { low: 'riskLow', medium: 'riskMedium', high: 'riskHigh' }
const RISK_ICON = { low: '●', medium: '▲', high: '⬣' }

function ConfirmCard({ card, sessionId, display, lang }) {
  const labelId = useId()
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
  const body = [
    jsx('p', { style: { margin: 0 }, children: card.action }, 'action'),
    card.reason ? jsx('p', { className: 'huic-sub', style: { margin: 0 }, children: card.reason }, 'reason') : null,
    card.command ? jsx(CodeBlock, { code: card.command, lang }, 'cmd') : null,
    card.details && card.details.length
      ? jsx(
          'dl',
          {
            className: 'huic-kv',
            children: card.details.flatMap((d, i) => [
              jsx('dt', { children: d.label }, `t${i}`),
              jsx('dd', { children: d.value }, `d${i}`)
            ])
          },
          'details'
        )
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
      ? jsx(
          'textarea',
          {
            ref: changeRef,
            className: 'huic-input',
            value: change,
            maxLength: 2000,
            placeholder: t(lang, 'changePlaceholder'),
            'aria-label': t(lang, 'changePlaceholder'),
            onChange: e => setChange(limitText(e.target.value, 1000)),
            onKeyDown: e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && change.trim()) {
                e.preventDefault()
                ans.submit({ decision: 'change', change })
              } else if (e.key === 'Escape') {
                setChanging(false)
              }
            }
          },
          'change'
        )
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
            variant: risk && risk.level === 'high' ? 'danger' : 'primary',
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
    footer: ans.showActions ? jsx(Footer, { children: buttons }) : null,
    after: ans.status
  })
}
