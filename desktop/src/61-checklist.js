// Ticks persist as you go; the header and Done stay in reach in the chat scroll.
Object.assign(STRINGS.en, {
  checklistSaved: 'Saved automatically · {done} of {total}',
  checklistResumed: 'Picked up where you left off'
})
Object.assign(STRINGS.de, {
  checklistSaved: 'Automatisch gespeichert · {done} von {total}',
  checklistResumed: 'Hier geht’s weiter, wo du aufgehört hast'
})

// Long lists stay calm: eyebrow group headings with live counts, custom ticks that draw
// in, done items fade back. Header and Done pin while a tall list scrolls past.
const CHECKLIST_CSS = `
.huic[data-card-type="checklist"]{overflow:visible;background:var(--ui-chat-surface-background,var(--ui-base))}
.huic[data-card-type="checklist"]>.huic-check-head{padding:var(--huic-pad) var(--huic-pad) 8px;background:inherit;border-radius:11px 11px 0 0;display:flex;flex-direction:column;gap:8px}
.huic[data-card-type="checklist"]>.huic-foot{background:inherit;border-radius:0 0 11px 11px}
.huic[data-card-type="checklist"].huic-check-sticky>.huic-check-head{position:sticky;top:0;z-index:3;box-shadow:0 1px 0 var(--huic-line)}
.huic[data-card-type="checklist"].huic-check-sticky>.huic-foot{position:sticky;bottom:0;z-index:2}
.huic[data-card-type="checklist"] .huic-check-count{flex:none;color:var(--ui-text-tertiary);font-size:12px;line-height:16px;font-variant-numeric:tabular-nums}
.huic[data-card-type="checklist"] .huic-check-list{display:flex;flex-direction:column;gap:4px}
.huic[data-card-type="checklist"] .huic-check-group{border:0;margin:0;padding:0;min-width:0}
.huic[data-card-type="checklist"] .huic-check-group+.huic-check-group{margin-top:4px}
.huic[data-card-type="checklist"] .huic-check-group>legend{padding:0;width:100%}
.huic[data-card-type="checklist"] .huic-check-heading{display:flex;align-items:center;gap:6px;min-height:32px;width:100%;margin:0 -8px;width:calc(100% + 16px);border:0;border-radius:var(--huic-r-sm);padding:6px 8px 4px;background:transparent;color:var(--ui-text-tertiary);font:inherit;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;text-align:left;cursor:pointer;transition:background .15s,color .15s}
.huic[data-card-type="checklist"] .huic-check-heading:hover{color:var(--ui-text-secondary);background:var(--ui-row-hover-background,var(--ui-control-hover-background))}
.huic[data-card-type="checklist"] .huic-check-chevron{width:12px;height:12px;flex:none;transition:transform .18s var(--huic-ease)}
.huic[data-card-type="checklist"] .huic-check-heading[aria-expanded="true"] .huic-check-chevron{transform:rotate(90deg)}
.huic[data-card-type="checklist"] .huic-check-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.huic[data-card-type="checklist"] .huic-check-gcount{margin-left:auto;padding-left:8px;font-variant-numeric:tabular-nums;letter-spacing:.02em}
.huic[data-card-type="checklist"] .huic-check-gcount.is-done{color:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="checklist"] .huic-check-gcount.is-done::before{content:"✓ "}
.huic[data-card-type="checklist"] .huic-check-row{align-items:flex-start;gap:10px;min-height:32px;margin:0 -8px;padding:6px 8px;border-radius:var(--huic-r-sm);cursor:pointer;transition:background .12s}
.huic[data-card-type="checklist"] .huic-check-row:hover:has(input:not(:disabled)),.huic[data-card-type="checklist"] .huic-check-heading:hover{background:var(--ui-row-hover-background,var(--ui-control-hover-background))}
.huic[data-card-type="checklist"] .huic-check-row:has(input:disabled){cursor:default}
.huic[data-card-type="checklist"] .huic-check-box{appearance:none;-webkit-appearance:none;display:grid;place-items:center;flex:none;width:16px;height:16px;margin:2px 0 0;border:1.5px solid var(--ui-text-quaternary,var(--huic-line-strong));border-radius:5px;background:transparent;cursor:inherit;transition:background .15s,border-color .15s}
.huic[data-card-type="checklist"] .huic-check-box::after{content:"";width:8px;height:4px;border-left:2px solid var(--huic-on-accent);border-bottom:2px solid var(--huic-on-accent);transform:translateY(-1px) rotate(-45deg) scale(0);transition:transform .2s var(--huic-ease)}
.huic[data-card-type="checklist"] .huic-check-row:hover .huic-check-box:not(:checked):not(:disabled){border-color:var(--huic-accent)}
.huic[data-card-type="checklist"] .huic-check-box:checked{background:var(--huic-accent);border-color:var(--huic-accent)}
.huic[data-card-type="checklist"] .huic-check-box:checked::after{transform:translateY(-1px) rotate(-45deg) scale(1)}
.huic[data-card-type="checklist"] .huic-check-box:disabled{opacity:.7}
.huic[data-card-type="checklist"] .huic-check-text{transition:color .2s}
.huic[data-card-type="checklist"] .huic-check-row.is-checked .huic-check-text{color:var(--ui-text-tertiary);text-decoration:line-through;text-decoration-color:var(--ui-text-quaternary,currentColor)}
.huic[data-card-type="checklist"] .huic-check-row.is-checked .huic-opt-desc{opacity:.7}
.huic[data-card-type="checklist"] .huic-check-resumed{display:flex;align-items:center;gap:6px;margin:0 0 4px;padding:6px 10px;border-radius:var(--huic-r-sm);background:color-mix(in srgb,var(--huic-accent) 7%,transparent);color:var(--ui-text-secondary);font-size:12px;animation:huic-fade .3s var(--huic-ease) both}
.huic[data-card-type="checklist"] .huic-check-resumed::before{content:"↻";color:var(--huic-accent)}
.huic[data-card-type="checklist"] .huic-foot>.huic-hint::before{content:"✓ ";color:var(--ui-green,var(--huic-accent))}
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
    // The real vertical scroller: overflow-y auto/scroll AND taller content than its box
    // (an overflow-x wrapper computes overflow-y:auto too but never scrolls vertically).
    const findRoot = () => {
      for (let el = frame.parentElement; el; el = el.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) return el
      }
      return null
    }
    let root = null
    const update = () => {
      const rect = frame.getBoundingClientRect()
      const viewport = root ? root.getBoundingClientRect() : { top: 0, bottom: window.innerHeight }
      const height = root ? root.clientHeight : window.innerHeight
      const head = frame.querySelector('.huic-check-head')?.offsetHeight || 0
      const foot = frame.querySelector('.huic-foot')?.offsetHeight || 0
      // Only pin tall cards, only with room left for items, once both controls fit in view.
      setSticky(height >= head + foot + 120 && rect.height > height && rect.top + head + foot < viewport.bottom && rect.bottom > viewport.top)
    }
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => refresh()) : null
    const refresh = () => {
      const next = findRoot()
      if (next !== root) { root = next; if (root) observer?.observe(root) }
      update()
    }
    refresh()
    document.addEventListener('scroll', update, { passive: true, capture: true })
    window.addEventListener('resize', refresh)
    observer?.observe(frame)
    return () => {
      document.removeEventListener('scroll', update, { capture: true })
      window.removeEventListener('resize', refresh)
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
      jsx('span', { className: 'huic-check-count', 'aria-hidden': true, children: t(lang, 'progress', { done, total }) })
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
            children: [
              jsx('svg', { className: 'huic-check-chevron', viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true, children: jsx('path', { d: 'm4.5 2.5 3.5 3.5-3.5 3.5', strokeLinecap: 'round', strokeLinejoin: 'round' }) }),
              jsx('span', { className: 'huic-check-name', title: group.name, children: group.name }),
              jsxs('span', { className: cx('huic-check-gcount', groupDone === group.items.length && 'is-done'), children: [jsx('span', { className: 'huic-sr', children: ' · ' }), `${groupDone}/${group.items.length}`] })
            ]
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
                  id: inputId, type: 'checkbox', className: 'huic-check-box', checked: on, disabled: ans.locked,
                  onChange: () => toggle(item.id)
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
          jsx('div', { role: 'group', className: 'huic-check-list', 'aria-labelledby': card.title ? labelId : undefined, children: groups })]
      }),
      ans.showActions ? jsx(Footer, {
        hint: ans.draft?.checked ? t(lang, 'checklistSaved', { done, total }) : undefined,
        children: jsx(Btn, { variant: 'primary', onClick: send, children: card.doneLabel || t(lang, 'done') })
      }) : null,
      ans.status
    ]
  })
}
