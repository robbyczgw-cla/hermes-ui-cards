// Group in the same wall-clock zone used by formatSlot (naive times stay local).
function scheduleDays(card, lang) {
  const groups = new Map()
  for (const slot of card.slots) {
    const zone = slotZone(slot.start, card)
    const day = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', {
      weekday: 'long', year: 'numeric', month: 'short', day: 'numeric', ...(zone ? { timeZone: zone } : {})
    }).format(slotDate(slot.start))
    if (!groups.has(day)) groups.set(day, [])
    groups.get(day).push(slot)
  }
  return [...groups].map(([day, slots]) => ({ day, slots }))
}

function ScheduleCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const [picked, setPicked] = useState([])
  const sent = ans.answer && ans.answer.data
  const selected = sent ? (sent.selected || []).map(s => s.id) : picked
  const available = card.slots.filter(s => !s.unavailable)
  const roving = useRovingFocus(available.length)
  const focusIndex = Math.max(0, available.findIndex(s => selected.includes(s.id)))
  const toggle = slot => {
    if (ans.locked || slot.unavailable) return
    setPicked(card.multiple ? (selected.includes(slot.id) ? selected.filter(id => id !== slot.id) : [...selected, slot.id]) : [slot.id])
  }
  const groups = scheduleDays(card, lang)
  return jsx(Shell, {
    card, display, labelId, title: card.title, subtitle: card.timezone,
    children: jsx('div', {
      role: card.multiple ? 'group' : 'radiogroup',
      'aria-labelledby': card.title ? labelId : undefined, 'aria-label': card.title ? undefined : t(lang, 'pick'),
      style: { display: 'flex', flexDirection: 'column', gap: 8 },
      children: groups.map(group => jsxs('div', {
        style: { display: 'flex', flexDirection: 'column', gap: 6 },
        children: [
          groups.length > 1 ? jsx('h4', { className: 'huic-label', style: { margin: '4px 0' }, children: group.day }) : null,
          group.slots.map(slot => {
            const index = available.findIndex(s => s.id === slot.id)
            return jsx(OptionTile, {
              option: { label: formatSlot(slot, card, lang, { withDay: groups.length < 2 }), description: [slot.label, slot.note, slot.unavailable ? t(lang, 'unavailable') : null].filter(Boolean).join(' · ') },
              checked: selected.includes(slot.id), multiple: Boolean(card.multiple), disabled: ans.locked || slot.unavailable,
              tabIndex: slot.unavailable ? -1 : card.multiple || index === focusIndex ? 0 : -1,
              refCb: el => { if (index >= 0) roving.refs.current[index] = el },
              onKeyDown: card.multiple || slot.unavailable ? undefined : roving.onKeyDown(index, next => toggle(available[next])),
              onToggle: () => toggle(slot)
            }, slot.id)
          })
        ]
      }, group.day))
    }),
    footer: ans.showActions ? jsx(Footer, {
      children: jsxs(Fragment, { children: [
        card.noneLabel ? jsx(Btn, { variant: 'ghost', onClick: () => ans.submit({ none: true }), children: card.noneLabel }) : null,
        jsx(Btn, { variant: 'primary', disabled: !selected.length,
          onClick: () => { if (selected.length) ans.submit({ selected }) }, children: t(lang, 'send') })
      ] })
    }) : null,
    after: ans.status
  })
}
