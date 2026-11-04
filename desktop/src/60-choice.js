// choice: 2–6 options, single (radio group) or multiple (checkboxes), optional "Other".

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

function OptionTile({ option, checked, multiple, disabled, onToggle, tabIndex, refCb, onKeyDown }) {
  return jsxs('button', {
    type: 'button',
    role: multiple ? 'checkbox' : 'radio',
    'aria-checked': checked ? 'true' : 'false',
    className: 'huic-opt',
    disabled,
    tabIndex,
    ref: refCb,
    onKeyDown,
    onClick: onToggle,
    style: option.image ? { flexDirection: 'column' } : undefined,
    children: [
      option.image ? jsx(CardImage, { src: option.image }) : null,
      jsxs('span', {
        className: 'huic-row',
        style: { width: '100%', alignItems: 'flex-start' },
        children: [
          jsx('span', { className: cx('huic-dot', multiple && 'huic-square'), 'aria-hidden': true }),
          option.icon ? jsx('span', { className: 'huic-icon', 'aria-hidden': true, children: option.icon }) : null,
          jsxs('span', {
            className: 'huic-opt-text',
            children: [
              jsx('span', { className: 'huic-opt-label', children: option.label }),
              option.description ? jsx('span', { className: 'huic-opt-desc', children: option.description }) : null
            ]
          })
        ]
      })
    ]
  })
}

function ChoiceCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [selected, setSelected] = useState(() => (sent ? sent.selected || [] : []))
  const [other, setOther] = useState(() => (sent && sent.other) || '')
  const [otherOn, setOtherOn] = useState(() => Boolean(sent && sent.other))
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

  const grid = card.options.some(o => o.image)
  const list = jsx('div', {
    role: card.multiple ? 'group' : 'radiogroup',
    'aria-labelledby': labelId,
    className: grid ? 'huic-grid' : undefined,
    style: grid ? undefined : { display: 'flex', flexDirection: 'column', gap: 6 },
    children: options.map((option, index) =>
      jsx(
        OptionTile,
        {
          option,
          checked: isChecked(option.id),
          multiple: Boolean(card.multiple),
          disabled: ans.locked,
          tabIndex: card.multiple ? 0 : index === focusIndex ? 0 : -1,
          refCb: el => (roving.refs.current[index] = el),
          onKeyDown: card.multiple ? undefined : roving.onKeyDown(index, next => toggle(options[next].id)),
          onToggle: () => toggle(option.id)
        },
        option.id
      )
    )
  })

  const otherInput =
    otherOn && !ans.locked
      ? jsx('input', {
          ref: otherRef,
          className: 'huic-input',
          value: other,
          maxLength: 300,
          placeholder: t(lang, 'otherPlaceholder'),
          'aria-label': t(lang, 'other'),
          onChange: e => setOther(e.target.value),
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
    children: [list, otherInput],
    footer: !ans.showActions
      ? null
      : jsx(Footer, {
          hint: pickHint(card, lang),
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
