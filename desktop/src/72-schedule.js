// schedule: slots as chips under day headings (Today / Tomorrow / weekday + date),
// a friendly zone label, digits pick available slots, Enter sends.

const ZONE_DE = {
  Vienna: 'Wien', Zurich: 'Zürich', Prague: 'Prag', Rome: 'Rom', Warsaw: 'Warschau', Copenhagen: 'Kopenhagen',
  Brussels: 'Brüssel', Lisbon: 'Lissabon', Moscow: 'Moskau', Athens: 'Athen', Kiev: 'Kiew', Kyiv: 'Kiew',
  Belgrade: 'Belgrad', Bucharest: 'Bukarest', Mexico_City: 'Mexiko-Stadt', Sao_Paulo: 'São Paulo',
  Tokyo: 'Tokio', Hong_Kong: 'Hongkong', Singapore: 'Singapur', Cairo: 'Kairo', Dubai: 'Dubai'
}

function zoneLabel(zone, lang) {
  if (!zone) return ''
  const raw = String(zone).split('/').pop()
  if (!String(zone).includes('/')) return /^(utc|gmt|z)$/i.test(raw) ? 'UTC' : zone
  if (/^(utc|gmt|uct|universal|zulu)$/i.test(raw)) return 'UTC'
  if (lang === 'de') return `Zeit: ${ZONE_DE[raw] || raw.replace(/_/g, ' ')}`
  return `${raw.replace(/_/g, ' ')} time`
}

Object.assign(STRINGS.en, { today: 'Today', tomorrow: 'Tomorrow' })
Object.assign(STRINGS.de, { today: 'Heute', tomorrow: 'Morgen' })

// Day keys come from slotDay (card zone, naive times stay wall-clock) so grouping,
// "Today" and the heading all agree. "Now" is read in the card zone, else locally.
function scheduleToday(card) {
  const zone = validTimeZone(card.timezone)
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...(zone ? { timeZone: zone } : {}) }).format(new Date())
}
function nextDayKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

function scheduleDays(card, lang) {
  const groups = new Map()
  for (const slot of card.slots) {
    const key = Number.isNaN(slotDate(slot.start).getTime()) ? String(slot.start) : slotDay(slot.start, card)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(slot)
  }
  const today = scheduleToday(card)
  const tomorrow = nextDayKey(today)
  return [...groups].map(([key, slots]) => {
    const zone = slotZone(slots[0].start, card)
    const parsed = slotDate(slots[0].start)
    const date = Number.isNaN(parsed.getTime())
      ? key
      : new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short', ...(zone ? { timeZone: zone } : {}) }).format(parsed)
    const rel = key === today ? t(lang, 'today') : key === tomorrow ? t(lang, 'tomorrow') : ''
    return { key, rel, date, slots }
  })
}

const SCHEDULE_CSS = `
.huic[data-card-type="schedule"] .huic-day{display:flex;flex-direction:column;gap:6px}
.huic[data-card-type="schedule"] .huic-day+.huic-day{margin-top:4px}
.huic[data-card-type="schedule"] .huic-day-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;margin:4px 0 0;font-size:11px;line-height:16px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-tertiary)}
.huic[data-card-type="schedule"] .huic-day-head::after{content:"";flex:1 1 24px;align-self:center;height:1px;background:var(--huic-line)}
.huic[data-card-type="schedule"] .huic-day-rel{color:var(--ui-text-primary)}
.huic[data-card-type="schedule"] .huic-day-date{font-weight:500}
.huic[data-card-type="schedule"] .huic-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:8px}
.huic[data-card-type="schedule"] .huic-chip{display:flex;flex-direction:column;gap:2px;min-width:0;padding:8px 10px;text-align:left;font:inherit;color:inherit;cursor:pointer;border-radius:10px;border:1px solid var(--ui-stroke-tertiary);background:transparent;transition:background .12s,border-color .12s,box-shadow .12s}
.huic[data-card-type="schedule"] .huic-chip:hover:not([disabled]){background:var(--ui-control-hover-background);border-color:var(--ui-stroke-secondary)}
.huic[data-card-type="schedule"] .huic-chip[aria-checked="true"]{border-color:var(--huic-accent);background:color-mix(in srgb,var(--huic-accent) 10%,transparent);box-shadow:0 0 0 1px var(--huic-accent)}
.huic[data-card-type="schedule"] .huic-chip[disabled]{cursor:default}
.huic[data-card-type="schedule"] .huic-chip[disabled]:not([aria-checked="true"]){opacity:.45}
.huic[data-card-type="schedule"] .huic-chip-time{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.huic[data-card-type="schedule"] .huic-chip-off .huic-chip-time{text-decoration:line-through}
.huic[data-card-type="schedule"] .huic-chip-note{color:var(--ui-text-tertiary);font-size:12px;line-height:1.3}
.huic[data-card-type="schedule"] .huic-chip-main{display:flex;align-items:center;gap:7px}
`

function SlotChip({ slot, card, lang, num, multiple, checked, disabled, tabIndex, refCb, onKeyDown, onToggle, index }) {
  const note = [slot.label, slot.note].filter(Boolean).join(' · ')
  return jsxs('button', {
    type: 'button',
    role: multiple ? 'checkbox' : 'radio',
    'aria-checked': checked ? 'true' : 'false',
    className: cx('huic-chip', slot.unavailable && 'huic-chip-off'),
    'data-index': index,
    disabled, tabIndex, ref: refCb, onKeyDown, onClick: onToggle,
    children: [
      jsxs('span', {
        className: 'huic-chip-main',
        children: [
          num ? jsx(NumBadge, { n: num, multiple }) : null,
          jsx('span', { className: 'huic-chip-time', children: formatSlot(slot, card, lang, { withDay: false }) })
        ]
      }),
      note ? jsx('span', { className: 'huic-chip-note', children: note }) : null,
      slot.unavailable ? jsx('span', { className: 'huic-chip-note', children: t(lang, 'unavailable') }) : null
    ]
  })
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
  const send = () => { if (selected.length) ans.submit({ selected }) }
  const keyed = optionKeys({
    count: available.length,
    onDigit: index => {
      if (ans.locked) return
      toggle(available[index])
      roving.refs.current[index] && roving.refs.current[index].focus()
    },
    onEnter: index => {
      if (ans.locked || !available[index]) return
      if (!card.multiple) return void ans.submit({ selected: [available[index].id] })
      return selected.length ? send() : toggle(available[index])
    }
  })
  const groups = scheduleDays(card, lang)
  const zone = zoneLabel(card.timezone, lang)
  return jsx(Shell, {
    card, display, labelId, title: card.title, subtitle: zone || undefined,
    children: jsxs('div', {
      role: card.multiple ? 'group' : 'radiogroup',
      'aria-labelledby': card.title ? labelId : undefined, 'aria-label': card.title ? undefined : t(lang, 'pick'),
      onKeyDown: ans.showActions ? keyed : undefined,
      style: { display: 'flex', flexDirection: 'column', gap: 8 },
      children: [
        jsx('style', { children: KEYS_CSS + SCHEDULE_CSS }),
        ...groups.map(group => jsxs('div', {
          className: 'huic-day',
          children: [
            jsxs('h4', {
              className: 'huic-day-head',
              children: group.rel
                ? [jsx('span', { className: 'huic-day-rel', children: group.rel }), jsx('span', { className: 'huic-day-date', children: group.date })]
                : [jsx('span', { className: 'huic-day-rel', children: group.date })]
            }),
            jsx('div', {
              className: 'huic-chips',
              children: group.slots.map(slot => {
                const index = available.findIndex(s => s.id === slot.id)
                return jsx(SlotChip, {
                  slot, card, lang, index,
                  num: index >= 0 && index < 9 ? index + 1 : undefined,
                  multiple: Boolean(card.multiple),
                  checked: selected.includes(slot.id),
                  disabled: ans.locked || slot.unavailable,
                  tabIndex: slot.unavailable ? -1 : card.multiple || index === focusIndex ? 0 : -1,
                  refCb: el => { if (index >= 0) roving.refs.current[index] = el },
                  onKeyDown: card.multiple || slot.unavailable ? undefined : roving.onKeyDown(index, next => toggle(available[next])),
                  onToggle: () => toggle(slot)
                }, slot.id)
              })
            })
          ]
        }, group.key))
      ]
    }),
    footer: ans.showActions ? jsx(Footer, {
      keys: available.length ? t(lang, card.multiple ? 'keyToggle' : 'keyChoose', { keys: keyRange(available.length) }) : undefined,
      children: jsxs('span', { className: 'huic-foot-group', children: [
        card.noneLabel ? jsx(Btn, { variant: 'ghost', onClick: () => ans.submit({ none: true }), children: card.noneLabel }) : null,
        jsx(Btn, { variant: 'primary', disabled: !selected.length, onClick: send, children: t(lang, 'send') })
      ] })
    }) : null,
    after: ans.status
  })
}
