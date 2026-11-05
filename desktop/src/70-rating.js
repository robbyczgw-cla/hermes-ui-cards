// rating: a keyboard-operable radio scale (contiguous stars or a segmented number row),
// an optional comment. Digits rate, Enter sends.

Object.assign(STRINGS.en, { keyRate: '[{keys}] to rate · [Enter] to send', keyRate10: '[1–9] [0] to rate (0 is 10) · [Enter] to send', rateEcho: '{n} of {max}' })
Object.assign(STRINGS.de, { keyRate: '[{keys}] zum Bewerten · [Enter] zum Senden', keyRate10: '[1–9] [0] zum Bewerten (0 ist 10) · [Enter] zum Senden', rateEcho: '{n} von {max}' })

const RATING_CSS = `
.huic[data-card-type="rating"] .huic-stars{display:grid;grid-template-columns:repeat(var(--huic-n),minmax(0,34px));gap:2px;max-width:100%;margin-left:-3px}
.huic[data-card-type="rating"] .huic-star{appearance:none;display:grid;place-items:center;width:100%;height:auto;aspect-ratio:1;padding:0;border:0;border-radius:var(--huic-r-md);background:none;color:var(--huic-accent);cursor:pointer;transition:transform .12s var(--huic-ease)}
.huic[data-card-type="rating"] .huic-star svg{display:block;width:82%;height:82%;fill:color-mix(in srgb,var(--huic-accent) 7%,transparent);stroke:color-mix(in srgb,var(--huic-accent) 55%,var(--ui-text-tertiary));stroke-width:1.4;stroke-linejoin:round;transition:fill .12s,stroke .12s}
.huic[data-card-type="rating"] .huic-star-on svg{fill:var(--huic-accent);stroke:color-mix(in srgb,var(--huic-accent) 70%,var(--ui-text-primary))}
.huic[data-card-type="rating"] .huic-star-pre svg{fill:color-mix(in srgb,var(--huic-accent) 40%,transparent);stroke:var(--huic-accent)}
.huic[data-card-type="rating"] .huic-star:hover:not([disabled]){transform:scale(1.1)}
.huic[data-card-type="rating"] .huic-star:focus-visible{outline-offset:0}
.huic[data-card-type="rating"] .huic-star[disabled]{cursor:default}
.huic[data-card-type="rating"] .huic-star[disabled]:not(.huic-star-on) svg{fill:transparent;stroke:var(--huic-line-strong)}
.huic[data-card-type="rating"] .huic-segs{display:flex;width:100%;border:1px solid var(--ui-stroke-secondary);border-radius:9px;overflow:hidden}
.huic[data-card-type="rating"] .huic-segbtn{appearance:none;flex:1 1 0;min-width:0;padding:7px 0;border:0;border-right:1px solid var(--ui-stroke-tertiary);background:transparent;color:inherit;font:inherit;font-variant-numeric:tabular-nums;cursor:pointer}
.huic[data-card-type="rating"] .huic-segbtn:last-child{border-right:0}
.huic[data-card-type="rating"] .huic-segbtn:hover:not([disabled]):not([aria-checked="true"]){background:var(--ui-control-hover-background)}
.huic[data-card-type="rating"] .huic-segbtn:focus-visible{outline-offset:-2px}
.huic[data-card-type="rating"] .huic-segbtn[aria-checked="true"]{background:var(--huic-accent);color:var(--huic-on-accent,var(--ui-chat-surface-background,var(--ui-base,Canvas)));font-weight:600}
.huic[data-card-type="rating"] .huic-segbtn[disabled]{cursor:default}
.huic[data-card-type="rating"] .huic-rate-row{display:flex;flex-wrap:wrap;align-items:flex-start;gap:4px 14px}
.huic[data-card-type="rating"] .huic-rate-scale{display:flex;flex-direction:column;gap:4px;min-width:0;max-width:100%}
.huic[data-card-type="rating"] .huic-rate-scale.is-numbers{flex:1 1 100%}
.huic[data-card-type="rating"] .huic-rate-ends{display:flex;justify-content:space-between;gap:12px;color:var(--ui-text-tertiary);font-size:12px;line-height:16px}
.huic[data-card-type="rating"] .huic-stars+.huic-rate-ends{padding-right:3px}
.huic[data-card-type="rating"] .huic-rate-echo{display:flex;align-items:center;min-height:34px;font-weight:600;font-variant-numeric:tabular-nums;animation:huic-fade .2s var(--huic-ease) both}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="rating"] .huic-star:hover:not([disabled]){transform:none}}
`

const STAR_PATH = 'M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2 6.3 20.3l1.2-6.4L2.8 9.5l6.4-.8z'

function RatingCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const draft = ans.draft && typeof ans.draft === 'object' ? ans.draft : {}
  const [picked, setPicked] = useState(() => (Number.isInteger(draft.value) ? draft.value : null))
  const [comment, setComment] = useState(() => (typeof draft.comment === 'string' ? draft.comment : ''))
  const [hover, setHover] = useState(null)
  const [focused, setFocused] = useState(null)
  const value = sent ? sent.value : picked
  const scale = card.scale ?? 5
  const numbers = card.style === 'numbers'
  const roving = useRovingFocus(scale)
  const choose = n => {
    if (ans.locked) return
    setPicked(n)
    ans.saveDraft({ value: n, comment })
  }
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
  const endsId = useId()
  const echo = shown ? t(lang, 'rateEcho', { n: shown, max: scale }) + (endLabel ? ` · ${endLabel}` : '') : ''

  return jsx(Shell, {
    card, display, labelId, title: card.question,
    children: jsxs('div', {
      onKeyDown,
      style: { display: 'flex', flexDirection: 'column', gap: 8 },
      children: [
        jsx('style', { children: RATING_CSS }),
        // The end labels sit under the first and last star; screen readers get "1 = …, 5 = …".
        jsxs('div', {
          className: 'huic-rate-row',
          children: [
            jsxs('div', {
              className: cx('huic-rate-scale', numbers && 'is-numbers'),
              children: [
                jsx('div', {
                  role: 'radiogroup', 'aria-labelledby': labelId, 'aria-describedby': ends ? endsId : undefined,
                  className: numbers ? 'huic-segs' : 'huic-stars',
                  style: numbers ? undefined : { '--huic-n': scale },
                  onMouseLeave: () => setHover(null),
                  children: Array.from({ length: scale }, (_, i) => star(i))
                }),
                ends ? jsxs('div', {
                  className: 'huic-rate-ends',
                  children: [
                    jsx('span', { className: 'huic-sr', id: endsId, children: ends }),
                    jsx('span', { 'aria-hidden': true, children: card.lowLabel || '' }),
                    jsx('span', { 'aria-hidden': true, style: { textAlign: 'right' }, children: card.highLabel || '' })
                  ]
                }) : null
              ]
            }),
            jsx('span', { className: 'huic-rate-echo', children: echo }, echo ? 'on' : 'off')
          ]
        }),
        card.comment ? jsxs('label', {
          className: 'huic-field',
          children: [
            jsx('span', { className: 'huic-label', children: t(lang, 'comment') }),
            jsx('textarea', {
              className: 'huic-input', disabled: ans.locked, maxLength: 2000,
              value: sent ? sent.comment || '' : comment, onChange: e => {
                const next = limitText(e.target.value, 1000)
                setComment(next)
                ans.saveDraft({ value: picked, comment: next })
              }
            })
          ]
        }) : null
      ]
    }),
    footer: ans.showActions ? jsx(Footer, {
      keys: scale === 10 ? t(lang, 'keyRate10') : t(lang, 'keyRate', { keys: keyRange(scale) }),
      children: jsx(Btn, { variant: 'primary', disabled: value === null,
        onClick: () => send(value), children: t(lang, 'send') })
    }) : null,
    after: ans.status
  })
}
