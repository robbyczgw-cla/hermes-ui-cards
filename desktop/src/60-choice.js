// choice: 2–6 options, single (radio group) or multiple (checkboxes), optional "Other".
// Options carry number badges: digits pick, Enter sends (same helpers serve schedule and quiz).

Object.assign(STRINGS.en, {
  keyChoose: '{keys} choose · Enter send',
  keyToggle: '{keys} toggle · Enter send',
  keyCheck: '{keys} choose · Enter check',
  keyNext: 'Enter next',
  keySend: 'Enter send'
})
Object.assign(STRINGS.de, {
  keyChoose: '{keys} wählen · Enter senden',
  keyToggle: '{keys} umschalten · Enter senden',
  keyCheck: '{keys} wählen · Enter prüfen',
  keyNext: 'Enter weiter',
  keySend: 'Enter senden'
})

const KEYS_CSS = `
.huic .huic-num{flex:none;display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 4px;border-radius:50%;border:1px solid var(--ui-stroke-secondary);color:var(--ui-text-tertiary);font-size:11px;font-weight:600;line-height:1;font-variant-numeric:tabular-nums;background:transparent}
.huic .huic-num.huic-num-multi{border-radius:5px}
.huic [aria-checked="true"] .huic-num,.huic [aria-checked="true"]>.huic-num{background:var(--huic-accent);border-color:var(--huic-accent);color:var(--ui-chat-surface-background,var(--ui-base,Canvas))}
`

// "1–3" for three options, "1" for one, capped at the nine digit keys.
function keyRange(count) { return count <= 1 ? '1' : `1–${Math.min(count, 9)}` }

function joinHints(...parts) { return parts.filter(Boolean).join(' · ') }

// Digits 1–9 pick option n, Enter on an option is handed to onEnter(index). Never active
// inside text fields. Put it on a wrapper around the options; keys bubble up from the tiles.
function optionKeys({ count, onDigit, onEnter }) {
  return event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target
    const tag = target && target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1
      if (index < count && onDigit) {
        event.preventDefault()
        onDigit(index)
      }
    } else if (event.key === 'Enter' && onEnter) {
      const tile = target && target.closest && target.closest('[data-index]')
      if (!tile) return
      event.preventDefault()
      onEnter(Number(tile.getAttribute('data-index')))
    }
  }
}

function NumBadge({ n, multiple }) {
  return jsx('span', { className: cx('huic-num', multiple && 'huic-num-multi'), 'aria-hidden': true, children: n })
}

const OTHER_ID = '__other'

function pickHint(card, lang) {
  if (!card.multiple) return ''
  const n = card.options.length + (card.allowOther ? 1 : 0)
  const min = card.min ?? 1
  const max = card.max ?? n
  if (min > 1 && max < n) return t(lang, 'pickCount', { min, max })
  if (min > 1) return t(lang, 'pickAtLeast', { min })
  if (max < n) return t(lang, 'pickUpTo', { max })
  return t(lang, 'pickAny')
}

// Arrow keys move between options (roving tabindex), like a native radio group.
function useRovingFocus(count) {
  const refs = useRef([])
  const onKeyDown = (index, onMove) => event => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }
    let next = null
    if (event.key in keys) next = (index + keys[event.key] + count) % count
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = count - 1
    if (next === null) return
    event.preventDefault()
    refs.current[next] && refs.current[next].focus()
    if (onMove) onMove(next)
  }
  return { refs, onKeyDown }
}

const CHOICE_CSS = `
.huic[data-card-type="choice"] .huic-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(172px,1fr));gap:10px;padding:2px}
.huic[data-card-type="choice"] .huic-tile{position:relative;display:block;width:100%;aspect-ratio:4/3;padding:0;overflow:hidden;text-align:left;cursor:pointer;font:inherit;color:inherit;border-radius:11px;border:1px solid var(--ui-stroke-tertiary);background:var(--ui-bg-quaternary);transition:transform .14s,box-shadow .14s,border-color .14s}
.huic[data-card-type="choice"] .huic-tile:hover:not([disabled]){border-color:var(--ui-stroke-secondary)}
.huic[data-card-type="choice"] .huic-tile[aria-checked="true"]{border-color:var(--huic-accent);box-shadow:0 0 0 2px var(--huic-accent);transform:translateY(-2px)}
.huic[data-card-type="choice"] .huic-tile[disabled]{cursor:default}
.huic[data-card-type="choice"] .huic-tile[disabled]:not([aria-checked="true"]){opacity:.6}
.huic[data-card-type="choice"] .huic-tile-media{position:absolute;inset:0;display:block}
.huic[data-card-type="choice"] .huic-tile-media>img{display:block;width:100%;height:100%;object-fit:cover}
.huic[data-card-type="choice"] .huic-tile-ph{position:absolute;inset:0 0 34% 0;display:grid;place-items:center;color:var(--ui-text-tertiary);font-size:34px;font-weight:600;letter-spacing:.02em}
.huic[data-card-type="choice"] .huic-tile-cap{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:1px;padding:22px 10px 8px;background:linear-gradient(to top,color-mix(in srgb,var(--ui-chat-surface-background,var(--ui-base,Canvas)) 90%,transparent),color-mix(in srgb,var(--ui-chat-surface-background,var(--ui-base,Canvas)) 72%,transparent) 55%,transparent)}
.huic[data-card-type="choice"] .huic-tile-label{font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.huic[data-card-type="choice"] .huic-tile-desc{color:var(--ui-text-secondary);font-size:12px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.huic[data-card-type="choice"] .huic-tile>.huic-num{position:absolute;top:8px;left:8px;background:color-mix(in srgb,var(--ui-chat-surface-background,var(--ui-base,Canvas)) 82%,transparent)}
.huic[data-card-type="choice"] .huic-tile>.huic-badge{position:absolute;top:8px;right:8px;max-width:70%;overflow:hidden;text-overflow:ellipsis;background:color-mix(in srgb,var(--ui-chat-surface-background,var(--ui-base,Canvas)) 82%,transparent)}
.huic[data-card-type="choice"] .huic-tile[aria-checked="true"]>.huic-num{background:var(--huic-accent);border-color:var(--huic-accent);color:var(--ui-chat-surface-background,var(--ui-base,Canvas))}
.huic[data-card-type="choice"] .huic-opt-row{align-items:center}
@container (max-width: 440px){.huic[data-card-type="choice"] .huic-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="choice"] .huic-tile[aria-checked="true"]{transform:none}}
`

function optionInitials(label) {
  const words = String(label || '').trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words[1]].map(w => [...w][0]) : [...(words[0] || '?')].slice(0, 2)
  return letters.join('').toUpperCase()
}

// A tile whose picture failed or is missing keeps its shape: neutral block with icon or initials.
function TileMedia({ option }) {
  const [failed, setFailed] = useState(false)
  const shown = option.image && !failed
  return jsx('span', {
    className: 'huic-tile-media',
    'aria-hidden': true,
    children: shown
      ? jsx('img', { src: option.image, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onError: () => setFailed(true) })
      : jsx('span', { className: 'huic-tile-ph', children: option.icon || optionInitials(option.label) })
  })
}

function ImageTile({ option, num, checked, multiple, disabled, onToggle, tabIndex, refCb, onKeyDown, index }) {
  return jsxs('button', {
    type: 'button',
    role: multiple ? 'checkbox' : 'radio',
    'aria-checked': checked ? 'true' : 'false',
    className: 'huic-tile',
    'data-index': index,
    disabled, tabIndex, ref: refCb, onKeyDown, onClick: onToggle,
    title: [option.label, option.description].filter(Boolean).join(' – '),
    children: [
      jsx(TileMedia, { option }),
      num ? jsx(NumBadge, { n: num, multiple }) : null,
      option.badge ? jsx('span', { className: 'huic-badge', children: option.badge }) : null,
      jsxs('span', {
        className: 'huic-tile-cap',
        children: [
          jsx('span', { className: 'huic-tile-label', children: option.label }),
          option.description ? jsx('span', { className: 'huic-tile-desc', children: option.description }) : null
        ]
      })
    ]
  })
}

// state: 'correct' | 'wrong' (quiz feedback) paints the row and swaps the number for ✓ / ✗.
function OptionTile({ option, num, checked, multiple, disabled, ariaDisabled, onToggle, tabIndex, refCb, onKeyDown, index, state }) {
  return jsxs('button', {
    type: 'button',
    role: multiple ? 'checkbox' : 'radio',
    'aria-checked': checked ? 'true' : 'false',
    className: cx('huic-opt', state && `huic-opt-${state}`),
    'data-index': index,
    'aria-disabled': ariaDisabled ? 'true' : undefined,
    disabled, tabIndex, ref: refCb, onKeyDown, onClick: onToggle,
    children: [
      jsxs('span', {
        className: 'huic-row huic-opt-row',
        style: { width: '100%', alignItems: 'flex-start' },
        children: [
          state
            ? jsx('span', { className: 'huic-num huic-num-state', 'aria-hidden': true, children: state === 'correct' ? '✓' : '✗' })
            : num
              ? jsx(NumBadge, { n: num, multiple })
              : jsx('span', { className: cx('huic-dot', multiple && 'huic-square'), 'aria-hidden': true }),
          option.icon ? jsx('span', { className: 'huic-icon', 'aria-hidden': true, children: option.icon }) : null,
          jsxs('span', {
            className: 'huic-opt-text',
            children: [
              jsx('span', { className: 'huic-opt-label', children: option.label }),
              option.description ? jsx('span', { className: 'huic-opt-desc', children: option.description }) : null
            ]
          }),
          option.badge ? jsx('span', { className: 'huic-badge huic-best', children: option.badge }) : null
        ]
      })
    ]
  })
}

function ChoiceCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [picked, setSelected] = useState(() => (sent ? sent.selected || [] : []))
  const selected = sent ? sent.selected || [] : picked
  const [other, setOther] = useState(() => (sent && sent.other) || '')
  const [localOtherOn, setOtherOn] = useState(() => Boolean(sent && sent.other))
  const otherOn = sent ? Boolean(sent.other) : localOtherOn
  const otherRef = useRef(null)

  const options = card.allowOther
    ? [...card.options, { id: OTHER_ID, label: t(lang, 'other'), icon: card.options.some(o => o.icon) ? '✏️' : undefined }]
    : card.options
  const isChecked = id => (id === OTHER_ID ? otherOn : selected.includes(id))
  const focusIndex = Math.max(0, options.findIndex(o => isChecked(o.id)))
  const roving = useRovingFocus(options.length)

  const toggle = id => {
    if (ans.locked) return
    if (card.multiple) {
      if (id === OTHER_ID) setOtherOn(v => !v)
      else setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]))
    } else {
      setOtherOn(id === OTHER_ID)
      setSelected(id === OTHER_ID ? [] : [id])
    }
    if (id === OTHER_ID) setTimeout(() => otherRef.current && otherRef.current.focus(), 0)
  }

  const otherText = otherOn ? other.trim() : ''
  const count = selected.length + (otherText ? 1 : 0)
  const min = card.multiple ? (card.min ?? 1) : 1
  const max = card.multiple ? (card.max ?? options.length) : 1
  const valid = count >= min && count <= max && !(otherOn && !otherText)

  const send = () => {
    if (!valid) return
    ans.submit({ selected: card.options.filter(o => selected.includes(o.id)).map(o => o.id), other: otherText || undefined })
  }

  const keyed = optionKeys({
    count: options.length,
    onDigit: index => {
      if (ans.locked) return
      toggle(options[index].id)
      roving.refs.current[index] && roving.refs.current[index].focus()
    },
    onEnter: index => {
      if (ans.locked) return
      const id = options[index].id
      if (id === OTHER_ID) return otherOn ? send() : toggle(id)
      if (!card.multiple) return void ans.submit({ selected: [id] })
      return valid ? send() : toggle(id)
    }
  })

  const withImages = card.options.some(o => o.image)
  const tiles = options.map((option, index) => {
    const props = {
      option,
      index,
      num: index < 9 ? index + 1 : undefined,
      checked: isChecked(option.id),
      multiple: Boolean(card.multiple),
      disabled: ans.locked,
      tabIndex: card.multiple ? 0 : index === focusIndex ? 0 : -1,
      refCb: el => (roving.refs.current[index] = el),
      onKeyDown: card.multiple ? undefined : roving.onKeyDown(index, next => toggle(options[next].id)),
      onToggle: () => toggle(option.id)
    }
    // "Other" has no picture: in an image grid it becomes a full-width row.
    if (withImages && option.id === OTHER_ID) {
      return jsx('div', { style: { gridColumn: '1 / -1' }, children: jsx(OptionTile, props) }, option.id)
    }
    return jsx(withImages ? ImageTile : OptionTile, props, option.id)
  })
  const list = jsx('div', {
    role: card.multiple ? 'group' : 'radiogroup',
    'aria-labelledby': labelId,
    className: withImages ? 'huic-tiles' : undefined,
    style: withImages ? undefined : { display: 'flex', flexDirection: 'column', gap: 6 },
    children: tiles
  })

  const otherInput =
    otherOn && !ans.locked
      ? jsx('input', {
          ref: otherRef,
          className: 'huic-input',
          value: other,
          maxLength: 600,
          placeholder: t(lang, 'otherPlaceholder'),
          'aria-label': t(lang, 'other'),
          onChange: e => setOther(limitText(e.target.value, 300)),
          onKeyDown: e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              send()
            }
          }
        })
      : null

  return jsx(Shell, {
    card,
    display,
    labelId,
    title: card.question,
    children: jsxs('div', {
      onKeyDown: ans.showActions ? keyed : undefined,
      style: { display: 'flex', flexDirection: 'column', gap: 8 },
      children: [jsx('style', { children: KEYS_CSS + CHOICE_CSS }), list, otherInput]
    }),
    footer: !ans.showActions
      ? null
      : jsx(Footer, {
          hint: joinHints(pickHint(card, lang), t(lang, card.multiple ? 'keyToggle' : 'keyChoose', { keys: keyRange(options.length) })),
          children: jsx(Btn, {
            variant: 'primary',
            disabled: !valid,
            onClick: send,
            children: card.submitLabel || t(lang, 'send')
          })
        }),
    after: ans.status
  })
}
