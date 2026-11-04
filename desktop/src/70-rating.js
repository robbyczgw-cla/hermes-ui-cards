// rating: a keyboard-operable radio scale (contiguous stars or a segmented number row),
// an optional comment. Digits rate, Enter sends.

Object.assign(STRINGS.en, { keyRate: '{keys} rate · Enter send', rateEcho: '{n} of {max}' })
Object.assign(STRINGS.de, { keyRate: '{keys} bewerten · Enter senden', rateEcho: '{n} von {max}' })

const RATING_CSS = `
.huic[data-card-type="rating"] .huic-stars{display:flex;flex-wrap:wrap;width:fit-content;max-width:100%}
.huic[data-card-type="rating"] .huic-star{appearance:none;display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:none;color:var(--ui-text-quaternary,var(--ui-text-tertiary));cursor:pointer;transition:color .1s,transform .1s}
.huic[data-card-type="rating"] .huic-star svg{display:block;width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round}
.huic[data-card-type="rating"] .huic-star-on{color:var(--huic-accent)}
.huic[data-card-type="rating"] .huic-star-on svg{fill:currentColor}
.huic[data-card-type="rating"] .huic-star-pre svg{fill-opacity:.4}
.huic[data-card-type="rating"] .huic-star:hover:not([disabled]){transform:scale(1.08)}
.huic[data-card-type="rating"] .huic-star[disabled]{cursor:default}
.huic[data-card-type="rating"] .huic-segs{display:flex;width:100%;border:1px solid var(--ui-stroke-secondary);border-radius:9px;overflow:hidden}
.huic[data-card-type="rating"] .huic-segbtn{appearance:none;flex:1 1 0;min-width:0;padding:7px 0;border:0;border-right:1px solid var(--ui-stroke-tertiary);background:transparent;color:inherit;font:inherit;font-variant-numeric:tabular-nums;cursor:pointer}
.huic[data-card-type="rating"] .huic-segbtn:last-child{border-right:0}
.huic[data-card-type="rating"] .huic-segbtn:hover:not([disabled]){background:var(--ui-control-hover-background)}
.huic[data-card-type="rating"] .huic-segbtn:focus-visible{outline-offset:-2px}
.huic[data-card-type="rating"] .huic-segbtn[aria-checked="true"]{background:var(--huic-accent);color:var(--huic-on-accent,var(--ui-chat-surface-background,var(--ui-base,Canvas)));font-weight:600}
.huic[data-card-type="rating"] .huic-segbtn[disabled]{cursor:default}
.huic[data-card-type="rating"] .huic-rate-meta{display:flex;flex-wrap:wrap;justify-content:space-between;gap:2px 12px;min-height:1.45em}
.huic[data-card-type="rating"] .huic-rate-echo{font-weight:600}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="rating"] .huic-star:hover:not([disabled]){transform:none}}
`

const STAR_PATH = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z'

function RatingCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [picked, setPicked] = useState(null)
  const [comment, setComment] = useState('')
  const [hover, setHover] = useState(null)
  const [focused, setFocused] = useState(null)
  const value = sent ? sent.value : picked
  const scale = card.scale ?? 5
  const numbers = card.style === 'numbers'
  const roving = useRovingFocus(scale)
  const choose = n => { if (!ans.locked) setPicked(n) }
  const send = n => { if (n !== null && n !== undefined) ans.submit({ value: n, comment }) }
  const shown = ans.locked ? value : (hover ?? focused ?? value)

  const onKeyDown = event => {
    if (ans.locked || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    const tag = event.target && event.target.tagName
    if (tag === 'TEXTAREA' || tag === 'INPUT') return
    if (/^[0-9]$/.test(event.key)) {
      const n = event.key === '0' ? 10 : Number(event.key)
      if (n <= scale) {
        event.preventDefault()
        setHover(null)
        choose(n)
        roving.refs.current[n - 1] && roving.refs.current[n - 1].focus()
      }
    } else if (event.key === 'Enter' && event.target.getAttribute && event.target.getAttribute('role') === 'radio') {
      event.preventDefault()
      if (value === null) choose(Number(event.target.getAttribute('data-index')) + 1)
      else send(value)
    }
  }

  const star = i => {
    const n = i + 1
    const on = shown !== null && shown !== undefined && n <= shown
    const preview = on && n > (value || 0)
    return jsx('button', {
      type: 'button', role: 'radio',
      className: numbers ? 'huic-segbtn' : cx('huic-star', on && 'huic-star-on', preview && 'huic-star-pre'),
      'aria-label': t(lang, 'rate', { n, max: scale }),
      'aria-checked': value === n,
      'data-index': i,
      disabled: ans.locked, tabIndex: i === (value ? value - 1 : 0) ? 0 : -1,
      ref: el => (roving.refs.current[i] = el),
      onKeyDown: roving.onKeyDown(i, next => choose(next + 1)),
      onClick: () => choose(n),
      onMouseEnter: () => { if (!ans.locked) setHover(n) },
      onFocus: () => { if (!ans.locked) setFocused(n) },
      onBlur: () => setFocused(null),
      children: numbers ? n : jsx('svg', { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: 'false', children: jsx('path', { d: STAR_PATH }) })
    }, n)
  }

  const endLabel = shown === 1 ? card.lowLabel : shown === scale ? card.highLabel : ''
  const ends = [card.lowLabel ? `1 = ${card.lowLabel}` : '', card.highLabel ? `${scale} = ${card.highLabel}` : ''].filter(Boolean).join(' · ')

  return jsx(Shell, {
    card, display, labelId, title: card.question,
    children: jsxs('div', {
      onKeyDown,
      style: { display: 'flex', flexDirection: 'column', gap: 8 },
      children: [
        jsx('style', { children: RATING_CSS }),
        jsx('div', {
          role: 'radiogroup', 'aria-labelledby': labelId,
          className: numbers ? 'huic-segs' : 'huic-stars',
          onMouseLeave: () => setHover(null),
          children: Array.from({ length: scale }, (_, i) => star(i))
        }),
        jsxs('div', {
          className: 'huic-rate-meta',
          children: [
            jsx('span', {
              className: 'huic-rate-echo',
              children: shown ? t(lang, 'rateEcho', { n: shown, max: scale }) + (endLabel ? ` · ${endLabel}` : '') : ''
            }),
            ends ? jsx('span', { className: 'huic-sub', style: { margin: 0 }, children: ends }) : null
          ]
        }),
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
      ]
    }),
    footer: ans.showActions ? jsx(Footer, {
      hint: t(lang, 'keyRate', { keys: scale === 10 ? '1–0' : keyRange(scale) }),
      children: jsx(Btn, { variant: 'primary', disabled: value === null,
        onClick: () => send(value), children: t(lang, 'send') })
    }) : null,
    after: ans.status
  })
}
