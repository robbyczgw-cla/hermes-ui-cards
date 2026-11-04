// Ticks persist as you go; the header and Done stay in reach in the chat scroll.
Object.assign(STRINGS.en, {
  checklistSaved: 'Saved automatically · {done} of {total}',
  checklistResumed: 'Picked up where you left off'
})
Object.assign(STRINGS.de, {
  checklistSaved: 'Automatisch gespeichert · {done} von {total}',
  checklistResumed: 'Hier geht’s weiter, wo du aufgehört hast'
})

const CHECKLIST_CSS = `
.huic[data-card-type="checklist"]{overflow:visible;background:var(--ui-chat-surface-background,var(--ui-base))}
.huic[data-card-type="checklist"]>.huic-check-head{padding:var(--huic-pad) var(--huic-pad) 8px;background:inherit;border-radius:11px 11px 0 0;display:flex;flex-direction:column;gap:8px}
.huic[data-card-type="checklist"]>.huic-foot{background:inherit;border-radius:0 0 11px 11px}
.huic[data-card-type="checklist"].huic-check-sticky>.huic-check-head{position:sticky;top:0;z-index:3}
.huic[data-card-type="checklist"].huic-check-sticky>.huic-foot{position:sticky;bottom:0;z-index:2}
.huic[data-card-type="checklist"] .huic-check-group{border:0;margin:0;padding:0;min-width:0}
.huic[data-card-type="checklist"] .huic-check-group>legend{padding:0;width:100%}
.huic[data-card-type="checklist"] .huic-check-heading{display:flex;align-items:center;gap:6px;min-height:28px;width:100%;border:0;border-radius:5px;padding:6px 0 2px;background:transparent;color:var(--ui-text-secondary);font:inherit;font-size:12.5px;font-weight:500;text-align:left;cursor:pointer}
.huic[data-card-type="checklist"] .huic-check-chevron{width:12px;flex:none;transition:transform .15s}
.huic[data-card-type="checklist"] .huic-check-heading[aria-expanded="true"] .huic-check-chevron{transform:rotate(90deg)}
.huic[data-card-type="checklist"] .huic-check-row{align-items:flex-start;min-height:28px;padding:5px 2px;border-radius:5px;cursor:pointer;transition:background .12s,opacity .15s}
.huic[data-card-type="checklist"] .huic-check-row:hover:has(input:not(:disabled)),.huic[data-card-type="checklist"] .huic-check-heading:hover{background:var(--ui-control-hover-background)}
.huic[data-card-type="checklist"] .huic-check-row:has(input:disabled){cursor:default}
.huic[data-card-type="checklist"] .huic-check-row.is-checked .huic-opt-text{opacity:.6}
.huic[data-card-type="checklist"] .huic-check-row.is-checked .huic-check-text{text-decoration:line-through}
.huic[data-card-type="checklist"] .huic-check-resumed{margin:0;color:var(--ui-text-tertiary);font-size:12px}
@media(prefers-reduced-motion:reduce){.huic[data-card-type="checklist"] *{transition:none!important}}
`

function groupItems(items) {
  if (!items.some(i => i.category)) return [{ name: null, items }]
  const groups = []
  const byName = new Map()
  for (const item of items) {
    const name = item.category || null
    if (!byName.has(name)) {
      const group = { name, items: [] }
      byName.set(name, group)
      groups.push(group)
    }
    byName.get(name).items.push(item)
  }
  return groups
}

function ChecklistCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const frameRef = useRef(null)
  const [sticky, setSticky] = useState(false)
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let scrollRoot = frame.parentElement
    while (scrollRoot && !/(auto|scroll)/.test(getComputedStyle(scrollRoot).overflowY)) scrollRoot = scrollRoot.parentElement
    const scroller = scrollRoot || window
    const update = () => {
      const rect = frame.getBoundingClientRect()
      const viewport = scrollRoot ? scrollRoot.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
      const height = scrollRoot ? scrollRoot.clientHeight : window.innerHeight
      const head = frame.querySelector('.huic-check-head')?.offsetHeight || 0
      const foot = frame.querySelector('.huic-foot')?.offsetHeight || 0
      // Only pin tall cards once enough of the card is visible for both controls.
      setSticky(rect.height > height && rect.top + head + foot < viewport.bottom && rect.bottom > viewport.top)
    }
    update()
    scroller.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    observer?.observe(frame)
    if (scrollRoot) observer?.observe(scrollRoot)
    return () => {
      scroller.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer?.disconnect()
    }
  }, [])
  const ans = useCardAnswer(card, sessionId, lang)
  const initial = () => {
    if (ans.answer && ans.answer.data) {
      return ans.answer.selection?.checked || ans.answer.data.done_ids || ans.draft?.checked || []
    }
    if (ans.draft && Array.isArray(ans.draft.checked)) return ans.draft.checked
    return card.items.filter(i => i.checked).map(i => i.id)
  }
  const [localChecked, setChecked] = useState(initial)
  const checked = ans.answer ? initial() : ans.draft?.checked || localChecked
  const [expanded, setExpanded] = useState({})
  const [resumed, setResumed] = useState(() => !ans.answer && ans.draft?.checked?.some(id => card.items.some(i => i.id === id)) === true)
  const groupButtons = useRef({})
  const grouped = groupItems(card.items)

  const toggle = id => {
    if (ans.locked) return
    const next = checked.includes(id) ? checked.filter(x => x !== id) : [...checked, id]
    const group = grouped.find(g => g.name && g.items.some(i => i.id === id))
    // Keep keyboard focus in reach when the last tick closes a group.
    if (group && expanded[group.name] !== true && group.items.every(i => next.includes(i.id))) groupButtons.current[group.name]?.focus()
    setChecked(next)
    setResumed(false)
    ans.saveDraft({ checked: next })
  }

  const total = card.items.length
  const done = card.items.filter(i => checked.includes(i.id)).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const progress = jsxs('div', {
    className: 'huic-row',
    children: [
      jsx('div', {
        className: 'huic-progress', style: { flex: 1 }, role: 'progressbar',
        'aria-valuemin': 0, 'aria-valuemax': total, 'aria-valuenow': done,
        'aria-label': t(lang, 'progress', { done, total }),
        children: jsx('span', { style: { width: `${pct}%` } })
      }),
      jsx('span', { className: 'huic-hint', style: { marginRight: 0, flexBasis: 'auto', flexShrink: 0 }, 'aria-hidden': true, children: t(lang, 'progress', { done, total }) })
    ]
  })

  const groups = grouped.map((group, gi) => {
    const groupDone = group.items.filter(i => checked.includes(i.id)).length
    const open = !group.name || (expanded[group.name] ?? groupDone < group.items.length)
    const groupId = `${labelId}-group-${gi}`
    return jsxs('fieldset', {
      className: 'huic-check-group',
      children: [
        group.name ? jsx('legend', {
          children: jsxs('button', {
            type: 'button', className: 'huic-check-heading', 'aria-expanded': open, 'aria-controls': groupId,
            ref: el => { groupButtons.current[group.name] = el },
            onClick: () => setExpanded(prev => ({ ...prev, [group.name]: !open })),
            children: [jsx('span', { className: 'huic-check-chevron', 'aria-hidden': true, children: '›' }), `${group.name} · ${groupDone}/${group.items.length}`]
          })
        }) : null,
        jsx('div', {
          id: groupId, hidden: !open,
          children: group.items.map(item => {
            const on = checked.includes(item.id)
            const inputId = `${labelId}-${item.id}`
            return jsxs('label', {
              htmlFor: inputId, className: cx('huic-row', 'huic-check-row', on && 'is-checked'),
              children: [
                jsx('input', {
                  id: inputId, type: 'checkbox', checked: on, disabled: ans.locked,
                  onChange: () => toggle(item.id),
                  style: { accentColor: 'var(--huic-accent)', marginTop: 3, width: 15, height: 15, flex: 'none' }
                }),
                jsxs('span', {
                  className: 'huic-opt-text',
                  children: [jsx('span', { className: 'huic-check-text', children: item.text }), item.note ? jsx('span', { className: 'huic-opt-desc', children: item.note }) : null]
                })
              ]
            }, item.id)
          })
        })
      ]
    }, group.name || `g${gi}`)
  })

  const send = () => ans.submit({ checked: card.items.filter(i => checked.includes(i.id)).map(i => i.id) })
  return jsxs('section', {
    ref: frameRef,
    className: cx('huic', display?.compact && 'huic-compact', sticky && 'huic-check-sticky'),
    style: { '--huic-accent': ACCENT_VARS[display?.accent || 'app'] || ACCENT_VARS.app },
    'data-card-type': card.type, 'aria-labelledby': card.title ? labelId : undefined, 'aria-label': card.title ? undefined : card.type,
    children: [
      jsx(Style, {}), jsx('style', { children: CHECKLIST_CSS }),
      jsxs('header', {
        className: 'huic-check-head',
        children: [card.title ? jsx('h3', { className: 'huic-title', id: labelId, children: card.title }) : null, progress]
      }),
      jsxs('div', {
        className: 'huic-body', style: { paddingTop: 0 },
        children: [resumed ? jsx('p', { className: 'huic-check-resumed', role: 'status', children: t(lang, 'checklistResumed') }) : null,
          jsx('div', { role: 'group', 'aria-labelledby': card.title ? labelId : undefined, children: groups })]
      }),
      ans.showActions ? jsx(Footer, {
        hint: ans.draft?.checked ? t(lang, 'checklistSaved', { done, total }) : undefined,
        children: jsx(Btn, { variant: 'primary', onClick: send, children: card.doneLabel || t(lang, 'done') })
      }) : null,
      ans.status
    ]
  })
}
