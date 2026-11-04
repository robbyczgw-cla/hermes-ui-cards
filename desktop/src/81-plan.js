// plan: the agent's plan before it runs. Optional steps can be switched off, every step
// can be moved (drag the number, Alt+↑/↓ or the arrow buttons) and get a note for Hermes.
// "Run plan" sends the final order. Edits are kept as a draft until the plan is sent.

Object.assign(STRINGS.en, {
  planRun: 'Run plan',
  planCount: '{n} of {total} steps will run',
  planReordered: 'reordered',
  planOptional: 'optional',
  planSkipped: 'skipped',
  planInclude: 'Run step: {x}',
  planMoveUp: 'Move up: {x}',
  planMoveDown: 'Move down: {x}',
  planMoved: '{x} moved to position {n} of {total}.',
  planNote: 'Note',
  planNoteFor: 'Note for step {n}: {x}',
  planNotePlaceholder: 'Tell Hermes something about this step',
  planNoteShown: 'Note',
  planKeys: '{keys} moves the step you are on',
  planDrag: 'Drag to move',
  planHighRisk: 'includes a high-risk step',
  planNothing: 'Switch on at least one step',
  planStepsLabel: 'Steps of the plan',
  rPlan: 'Run the plan: {n} of {total} steps',
  rPlanSkipped: 'skipped: {x}',
  rPlanReordered: 'reordered'
})
Object.assign(STRINGS.de, {
  planRun: 'Plan ausführen',
  planCount: '{n} von {total} Schritten werden ausgeführt',
  planReordered: 'neu geordnet',
  planOptional: 'optional',
  planSkipped: 'übersprungen',
  planInclude: 'Schritt ausführen: {x}',
  planMoveUp: 'Nach oben: {x}',
  planMoveDown: 'Nach unten: {x}',
  planMoved: '{x} ist jetzt an Position {n} von {total}.',
  planNote: 'Notiz',
  planNoteFor: 'Notiz zu Schritt {n}: {x}',
  planNotePlaceholder: 'Hinweis für Hermes zu diesem Schritt',
  planNoteShown: 'Notiz',
  planKeys: '{keys} verschiebt den Schritt, auf dem du bist',
  planDrag: 'Zum Verschieben ziehen',
  planHighRisk: 'mit riskantem Schritt',
  planNothing: 'Mindestens einen Schritt einschalten',
  planStepsLabel: 'Schritte des Plans',
  rPlan: 'Plan ausführen: {n} von {total} Schritten',
  rPlanSkipped: 'übersprungen: {x}',
  rPlanReordered: 'neu geordnet'
})

const PLAN_NOTE_MAX = 200
const PLAN_RISK = { low: ['●', 'riskLow'], medium: ['▲', 'riskMedium'], high: ['⬣', 'riskHigh'] }

const PLAN_CSS = `
.huic[data-card-type="plan"],.huic[data-card-type="review"]{background:var(--ui-chat-surface-background,var(--ui-base))}
.huic[data-card-type="plan"]>.huic-foot,.huic[data-card-type="review"]>.huic-foot{background:inherit;border-radius:0 0 11px 11px}
.huic[data-card-type="plan"].huic-pinned>.huic-foot,.huic[data-card-type="review"].huic-pinned>.huic-foot{position:sticky;bottom:0;z-index:2;box-shadow:0 -10px 14px -14px var(--ui-text-primary)}
.huic[data-card-type="plan"] .huic-plan-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.huic[data-card-type="plan"] .huic-plan-step{position:relative;display:grid;grid-template-columns:26px minmax(0,1fr) auto;column-gap:12px;row-gap:4px;padding:7px 0 11px;margin:0;align-items:start}
.huic[data-card-type="plan"] .huic-plan-step::before{content:"";position:absolute;left:12.25px;top:0;bottom:0;width:1.5px;background:var(--ui-stroke-tertiary)}
.huic[data-card-type="plan"] .huic-plan-step:first-child::before{top:20px}
.huic[data-card-type="plan"] .huic-plan-step:last-child::before{bottom:calc(100% - 20px)}
.huic[data-card-type="plan"] .huic-plan-step:only-child::before{display:none}
.huic[data-card-type="plan"] .huic-plan-node{position:relative;z-index:1;display:grid;place-items:center;width:26px;height:26px;border-radius:50%;border:1.5px solid var(--huic-accent);background:var(--ui-chat-surface-background,var(--ui-base));color:var(--huic-accent);font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;user-select:none;transition:box-shadow .15s,background .15s}
.huic[data-card-type="plan"] .huic-plan-node[draggable="true"]{cursor:grab}
.huic[data-card-type="plan"] .huic-plan-node[draggable="true"]:hover{background:color-mix(in srgb,var(--huic-accent) 14%,var(--ui-chat-surface-background,var(--ui-base)))}
.huic[data-card-type="plan"] .huic-plan-step:focus-within .huic-plan-node{box-shadow:0 0 0 4px color-mix(in srgb,var(--huic-accent) 22%,transparent)}
.huic[data-card-type="plan"] .huic-plan-step.is-risk-high .huic-plan-node{border-color:var(--ui-red,var(--huic-accent));color:var(--ui-red,var(--huic-accent))}
.huic[data-card-type="plan"] .huic-plan-step.is-off .huic-plan-node{border-style:dashed;border-color:var(--ui-stroke-secondary);color:var(--ui-text-tertiary)}
.huic[data-card-type="plan"] .huic-plan-step.is-off .huic-plan-title{text-decoration:line-through;color:var(--ui-text-tertiary)}
.huic[data-card-type="plan"] .huic-plan-step.is-off .huic-plan-detail,.huic[data-card-type="plan"] .huic-plan-step.is-off .huic-code-block{opacity:.5}
.huic[data-card-type="plan"] .huic-plan-step.is-dragging{opacity:.4}
.huic[data-card-type="plan"] .huic-plan-step.is-drop-before::after,.huic[data-card-type="plan"] .huic-plan-step.is-drop-after::after{content:"";position:absolute;left:34px;right:0;height:2px;border-radius:2px;background:var(--huic-accent)}
.huic[data-card-type="plan"] .huic-plan-step.is-drop-before::after{top:-1px}
.huic[data-card-type="plan"] .huic-plan-step.is-drop-after::after{bottom:-1px}
.huic[data-card-type="plan"] .huic-plan-step.is-moved-a .huic-plan-main{animation:huic-plan-moved-a .7s ease-out}
.huic[data-card-type="plan"] .huic-plan-step.is-moved-b .huic-plan-main{animation:huic-plan-moved-b .7s ease-out}
@keyframes huic-plan-moved-a{from{background:color-mix(in srgb,var(--huic-accent) 16%,transparent)}to{background:transparent}}
@keyframes huic-plan-moved-b{from{background:color-mix(in srgb,var(--huic-accent) 16%,transparent)}to{background:transparent}}
.huic[data-card-type="plan"] .huic-plan-main{display:flex;flex-direction:column;gap:6px;min-width:0;padding-top:3px;border-radius:6px}
.huic[data-card-type="plan"] .huic-plan-titlerow{display:flex;flex-wrap:wrap;align-items:baseline;gap:3px 8px}
.huic[data-card-type="plan"] .huic-plan-title{font-weight:600}
.huic[data-card-type="plan"] .huic-plan-detail{margin:0;color:var(--ui-text-secondary);font-size:12.5px;white-space:pre-wrap}
.huic[data-card-type="plan"] .huic-plan-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:16px;padding:0 7px;border-radius:999px;border:1px solid var(--ui-stroke-tertiary);color:var(--ui-text-tertiary);white-space:nowrap}
.huic[data-card-type="plan"] .huic-plan-chip-low{color:var(--ui-green,var(--ui-text-secondary))}
.huic[data-card-type="plan"] .huic-plan-chip-medium{color:var(--ui-orange,var(--ui-yellow,var(--ui-text-secondary)));border-color:color-mix(in srgb,var(--ui-orange,var(--ui-text-secondary)) 35%,transparent)}
.huic[data-card-type="plan"] .huic-plan-chip-high{color:var(--ui-red,var(--ui-text-primary));border-color:color-mix(in srgb,var(--ui-red,var(--ui-text-primary)) 40%,transparent);background:color-mix(in srgb,var(--ui-red,transparent) 9%,transparent);font-weight:600}
.huic[data-card-type="plan"] .huic-plan-main .huic-code{max-height:11.5em;overflow:auto}
.huic[data-card-type="plan"] .huic-plan-ctrl{display:flex;align-items:center;gap:2px}
.huic[data-card-type="plan"] .huic-plan-icon{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--ui-text-tertiary);cursor:pointer;font:inherit}
.huic[data-card-type="plan"] .huic-plan-icon:hover:not(:disabled){background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.huic[data-card-type="plan"] .huic-plan-icon:disabled{opacity:.28;cursor:default}
.huic[data-card-type="plan"] .huic-plan-icon[aria-expanded="true"],.huic[data-card-type="plan"] .huic-plan-icon.has-note{color:var(--huic-accent)}
.huic[data-card-type="plan"] .huic-plan-switch-wrap{display:grid;place-items:center;width:42px;height:28px}
.huic[data-card-type="plan"] input.huic-plan-switch{appearance:none;position:relative;flex:none;width:32px;height:18px;margin:0;border:1px solid var(--ui-stroke-secondary);border-radius:999px;background:var(--ui-bg-quaternary);cursor:pointer;transition:background .15s,border-color .15s}
.huic[data-card-type="plan"] input.huic-plan-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--ui-text-secondary);transition:transform .15s}
.huic[data-card-type="plan"] input.huic-plan-switch:checked{background:var(--huic-accent);border-color:var(--huic-accent)}
.huic[data-card-type="plan"] input.huic-plan-switch:checked::after{transform:translateX(14px);background:var(--ui-chat-surface-background,var(--ui-base))}
.huic[data-card-type="plan"] .huic-plan-note{min-height:30px;padding:5px 8px;font-size:12.5px;background:color-mix(in srgb,var(--ui-bg-quaternary) 35%,transparent)}
.huic[data-card-type="plan"] .huic-plan-note-text{margin:0;padding:2px 0 2px 9px;border-left:2px solid var(--huic-accent);color:var(--ui-text-secondary);font-size:12.5px;white-space:pre-wrap}
.huic[data-card-type="plan"] .huic-plan-keys{margin:0 0 0 38px;color:var(--ui-text-tertiary);font-size:11.5px}
.huic[data-card-type="plan"] kbd,.huic[data-card-type="review"] kbd{font:inherit;font-size:10.5px;padding:0 4px;border:1px solid var(--ui-stroke-secondary);border-bottom-width:2px;border-radius:4px;color:var(--ui-text-secondary)}
.huic[data-card-type="plan"] .huic-plan-warn{color:var(--ui-red,var(--ui-text-secondary))}
@container (max-width: 440px){
  .huic[data-card-type="plan"] .huic-plan-step{grid-template-columns:26px minmax(0,1fr)}
  .huic[data-card-type="plan"] .huic-plan-ctrl{grid-column:2;margin-left:-6px}
  .huic[data-card-type="plan"] .huic-plan-switch-wrap:empty{display:none}
  .huic[data-card-type="plan"] .huic-plan-keys{display:none}
}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="plan"] *{transition:none!important;animation:none!important}}
`

// Pin the footer (and an optional head) of tall cards while they scroll through the chat,
// like the checklist does. Shared with the review card.
function planUsePinned(frameRef) {
  const [pinned, setPinned] = useState(false)
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
      const head = frame.querySelector('.huic-pin-head')?.offsetHeight || 0
      const foot = frame.querySelector(':scope>.huic-foot')?.offsetHeight || 0
      setPinned(rect.height > height && rect.top + head + foot < viewport.bottom && rect.bottom > viewport.top)
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
  return pinned
}

// Like Shell, plus a ref and the pinned state for tall cards.
function PlanFrame({ card, display, labelId, frameRef, pinned, css, head, children, footer, after }) {
  return jsxs('section', {
    ref: frameRef,
    className: cx('huic', display?.compact && 'huic-compact', pinned && 'huic-pinned'),
    style: { '--huic-accent': ACCENT_VARS[display?.accent || 'app'] || ACCENT_VARS.app },
    'data-card-type': card.type,
    'aria-labelledby': labelId,
    children: [
      jsx(Style, {}),
      jsx('style', { children: PLAN_CSS }),
      css ? jsx('style', { children: css }) : null,
      head,
      jsx('div', { className: 'huic-body', children }),
      footer || null,
      after || null
    ]
  })
}

const PLAN_ICONS = {
  up: 'm4 10 4-4 4 4',
  down: 'm4 6 4 4 4-4',
  note: 'M2.5 13.5h3l7.2-7.2a1.4 1.4 0 0 0 0-2l-1-1a1.4 1.4 0 0 0-2 0L2.5 10.5v3Z',
  check: 'm3.5 8.5 3 3 6-7',
  cross: 'm4.5 4.5 7 7m0-7-7 7',
  chevron: 'm6 4 4 4-4 4'
}

function planIcon(kind) {
  return jsx('svg', {
    viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
    children: jsx('path', { d: PLAN_ICONS[kind] })
  })
}

function planKeysHint(lang) {
  const text = t(lang, 'planKeys', { keys: '\u0000' }).split('\u0000')
  return [text[0], jsx('kbd', { children: 'Alt' }, 'a'), '+', jsx('kbd', { children: '↑' }, 'u'), '/', jsx('kbd', { children: '↓' }, 'd'), text[1]]
}

function planState(card, source) {
  const ids = card.steps.map(s => s.id)
  const optional = new Set(card.steps.filter(s => s.optional).map(s => s.id))
  const src = source && typeof source === 'object' ? source : {}
  const order = Array.isArray(src.order) ? src.order.filter((id, i, all) => ids.includes(id) && all.indexOf(id) === i) : []
  for (const id of ids) if (!order.includes(id)) order.push(id)
  const off = Array.isArray(src.off) ? src.off.filter(id => optional.has(id)) : []
  const notes = {}
  if (src.notes && typeof src.notes === 'object') {
    for (const id of ids) if (typeof src.notes[id] === 'string' && src.notes[id]) notes[id] = limitText(src.notes[id], PLAN_NOTE_MAX)
  }
  return { order, off, notes }
}

// The sent answer (steps in their final order) back into the editing state, for the locked view.
function planFromAnswer(card, answer) {
  const steps = answer?.selection?.steps || answer?.data?.steps
  if (!Array.isArray(steps)) return null
  return {
    order: steps.map(s => s.id).filter(id => card.steps.some(s => s.id === id)),
    off: steps.filter(s => s.included === false).map(s => s.id),
    notes: Object.fromEntries(steps.filter(s => s.note).map(s => [s.id, s.note]))
  }
}

function PlanCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const frameRef = useRef(null)
  const pinned = planUsePinned(frameRef)
  const ans = useCardAnswer(card, sessionId, lang)
  const [state, setState] = useState(() => planState(card, ans.draft))
  const view = (ans.answer && planFromAnswer(card, ans.answer)) || state
  const [openNotes, setOpenNotes] = useState({})
  const [announce, setAnnounce] = useState('')
  const [drag, setDrag] = useState(null)
  const [moved, setMoved] = useState(null)
  const focusAfter = useRef(null)
  const rowRefs = useRef({})
  const byId = useMemo(() => Object.fromEntries(card.steps.map(s => [s.id, s])), [card])
  const editable = ans.showActions

  // Reordering moves DOM nodes, which can drop focus: put it back on the same control.
  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    const row = rowRefs.current[target.id]
    if (!row) return
    let el = row.querySelector(`[data-plan-focus="${target.which}"]`)
    if (!el || el.disabled) el = row.querySelector('[data-plan-focus="up"]:not(:disabled),[data-plan-focus="down"]:not(:disabled)')
    el?.focus()
  })

  const update = next => {
    setState(next)
    ans.saveDraft(next)
  }

  const moveTo = (id, to, which) => {
    const from = state.order.indexOf(id)
    if (from < 0 || to < 0 || to >= state.order.length || to === from) return
    const order = state.order.filter(x => x !== id)
    order.splice(to, 0, id)
    update({ ...state, order })
    focusAfter.current = which ? { id, which } : null
    setMoved({ id, n: (moved?.n || 0) + 1 })
    setAnnounce(t(lang, 'planMoved', { x: byId[id].title, n: to + 1, total: order.length }))
  }

  const toggle = id => update({ ...state, off: state.off.includes(id) ? state.off.filter(x => x !== id) : [...state.off, id] })
  const setNote = (id, text) => {
    const notes = { ...state.notes }
    const value = limitText(text, PLAN_NOTE_MAX)
    if (value) notes[id] = value
    else delete notes[id]
    update({ ...state, notes })
  }
  const noteButton = (id, open) => {
    if (!open) {
      setOpenNotes(prev => ({ ...prev, [id]: true }))
      focusAfter.current = { id, which: 'note' }
    } else if (!state.notes[id]) {
      setOpenNotes(prev => ({ ...prev, [id]: false }))
    } else {
      rowRefs.current[id]?.querySelector('[data-plan-focus="note"]')?.focus()
    }
  }

  const onRowKey = (id, index) => e => {
    if (!editable || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.nativeEvent?.isComposing) return
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    const which = e.target.closest?.('[data-plan-focus]')?.dataset.planFocus || (e.key === 'ArrowUp' ? 'up' : 'down')
    moveTo(id, index + (e.key === 'ArrowUp' ? -1 : 1), which)
  }

  const dropAt = targetId => {
    if (!drag || !drag.id || targetId === drag.id) { setDrag(null); return }
    const rest = state.order.filter(x => x !== drag.id)
    let to = rest.indexOf(targetId) + (drag.after ? 1 : 0)
    if (to < 0) to = rest.length
    setDrag(null)
    moveTo(drag.id, to, null)
  }

  const total = view.order.length
  const included = view.order.filter(id => !view.off.includes(id))
  const reordered = view.order.some((id, i) => id !== card.steps[i].id)
  const highRisk = included.some(id => byId[id].risk === 'high')

  const rows = view.order.map((id, i) => {
    const step = byId[id]
    const on = !view.off.includes(id)
    const note = view.notes[id] || ''
    const noteOpen = editable && Boolean(openNotes[id] || note)
    const titleId = `${labelId}-${id}`
    const noteId = `${labelId}-${id}-note`
    const risk = step.risk && PLAN_RISK[step.risk]
    const isDropTarget = drag?.id && drag.over === id && drag.id !== id
    return jsxs('li', {
      ref: el => { rowRefs.current[id] = el },
      className: cx('huic-plan-step', !on && 'is-off', step.risk === 'high' && 'is-risk-high',
        drag?.id === id && 'is-dragging', isDropTarget && (drag.after ? 'is-drop-after' : 'is-drop-before'),
        moved?.id === id && (moved.n % 2 ? 'is-moved-a' : 'is-moved-b')),
      'data-step': id,
      'aria-labelledby': titleId,
      onKeyDown: onRowKey(id, i),
      onDragOver: editable && drag?.id ? e => {
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        const after = e.clientY > r.top + r.height / 2
        if (drag.over !== id || drag.after !== after) setDrag({ ...drag, over: id, after })
      } : undefined,
      onDrop: editable && drag?.id ? e => { e.preventDefault(); dropAt(id) } : undefined,
      children: [
        jsx('span', {
          className: 'huic-plan-node', 'aria-hidden': true,
          draggable: editable ? 'true' : undefined,
          title: editable && total > 1 ? t(lang, 'planDrag') : undefined,
          onDragStart: editable ? e => {
            e.dataTransfer.effectAllowed = 'move'
            try { e.dataTransfer.setData('text/plain', step.title) } catch {}
            if (rowRefs.current[id] && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(rowRefs.current[id], 14, 14)
            setDrag({ id })
          } : undefined,
          onDragEnd: editable ? () => setDrag(null) : undefined,
          children: i + 1
        }),
        jsxs('div', {
          className: 'huic-plan-main',
          children: [
            jsxs('div', { className: 'huic-plan-titlerow', children: [
              jsx('span', { id: titleId, className: 'huic-plan-title', children: step.title }),
              !on ? jsx('span', { className: 'huic-plan-chip', children: t(lang, 'planSkipped') }) : step.optional ? jsx('span', { className: 'huic-plan-chip', children: t(lang, 'planOptional') }) : null,
              risk ? jsxs('span', { className: cx('huic-plan-chip', `huic-plan-chip-${step.risk}`), children: [jsx('span', { 'aria-hidden': true, children: risk[0] }), t(lang, risk[1])] }) : null
            ] }),
            step.detail ? jsx('p', { className: 'huic-plan-detail', children: step.detail }) : null,
            step.command ? jsx(CodeBlock, { code: step.command, lang }) : null,
            noteOpen
              ? jsx('input', {
                  id: noteId, className: 'huic-input huic-plan-note', type: 'text', value: note,
                  'data-plan-focus': 'note', maxLength: PLAN_NOTE_MAX * 2,
                  placeholder: t(lang, 'planNotePlaceholder'),
                  'aria-label': t(lang, 'planNoteFor', { n: i + 1, x: step.title }),
                  onChange: e => setNote(id, e.target.value),
                  onKeyDown: e => {
                    if (e.key === 'Escape' && !note) { e.preventDefault(); noteButton(id, true); rowRefs.current[id]?.querySelector('[data-plan-focus="notebtn"]')?.focus() }
                  }
                })
              : !editable && note
                ? jsxs('p', { className: 'huic-plan-note-text', children: [jsx('span', { className: 'huic-sr', children: t(lang, 'planNoteShown') + ': ' }), note] })
                : null
          ]
        }),
        editable ? jsxs('div', {
          className: 'huic-plan-ctrl',
          children: [
            jsx('span', { className: 'huic-plan-switch-wrap', children: step.optional ? jsx('input', {
              type: 'checkbox', role: 'switch', className: 'huic-plan-switch', checked: on,
              'data-plan-focus': 'switch', 'aria-label': t(lang, 'planInclude', { x: step.title }),
              title: t(lang, 'planInclude', { x: step.title }),
              onChange: () => toggle(id)
            }) : null }),
            jsx('button', {
              type: 'button', className: cx('huic-plan-icon', note && 'has-note'), 'data-plan-focus': 'notebtn',
              'aria-label': t(lang, 'planNoteFor', { n: i + 1, x: step.title }), title: t(lang, 'planNote'),
              'aria-expanded': noteOpen, 'aria-controls': noteOpen ? noteId : undefined,
              onClick: () => noteButton(id, noteOpen),
              children: planIcon('note')
            }),
            total > 1 ? jsx('button', {
              type: 'button', className: 'huic-plan-icon', 'data-plan-focus': 'up', disabled: i === 0,
              'aria-label': t(lang, 'planMoveUp', { x: step.title }), title: 'Alt+↑', 'aria-keyshortcuts': 'Alt+ArrowUp',
              onClick: () => moveTo(id, i - 1, 'up'), children: planIcon('up')
            }) : null,
            total > 1 ? jsx('button', {
              type: 'button', className: 'huic-plan-icon', 'data-plan-focus': 'down', disabled: i === total - 1,
              'aria-label': t(lang, 'planMoveDown', { x: step.title }), title: 'Alt+↓', 'aria-keyshortcuts': 'Alt+ArrowDown',
              onClick: () => moveTo(id, i + 1, 'down'), children: planIcon('down')
            }) : null
          ]
        }) : null
      ]
    }, id)
  })

  const send = () => ans.submit({
    steps: view.order.map(id => {
      const note = (view.notes[id] || '').trim()
      return { id, title: byId[id].title, included: !view.off.includes(id), ...(note ? { note } : {}) }
    })
  })

  const hint = included.length
    ? jsxs(Fragment, { children: [
        t(lang, 'planCount', { n: included.length, total }),
        reordered ? ` · ${t(lang, 'planReordered')}` : '',
        highRisk ? jsxs('span', { className: 'huic-plan-warn', children: [' · ', t(lang, 'planHighRisk')] }) : null
      ] })
    : t(lang, 'planNothing')

  return jsx(PlanFrame, {
    card, display, labelId, frameRef, pinned,
    head: jsxs('header', { className: 'huic-head', children: [
      jsx('h3', { className: 'huic-title', id: labelId, style: { margin: 0 }, children: card.title }),
      card.summary ? jsx('p', { className: 'huic-sub', style: { margin: '2px 0 0' }, children: card.summary }) : null
    ] }),
    children: [
      jsx('ol', { className: 'huic-plan-list', 'aria-label': t(lang, 'planStepsLabel'), children: rows }, 'list'),
      editable && total > 1 ? jsx('p', { className: 'huic-plan-keys', children: planKeysHint(lang) }, 'keys') : null,
      jsx('div', { className: 'huic-sr', role: 'status', 'aria-live': 'polite', children: announce }, 'live')
    ],
    footer: editable ? jsx(Footer, {
      hint,
      children: jsx(Btn, { variant: highRisk ? 'danger' : 'primary', disabled: !included.length, onClick: send, children: card.runLabel || t(lang, 'planRun') })
    }) : null,
    after: ans.status
  })
}

CARD_COMPONENTS.plan = PlanCard
REPLY_BUILDERS.plan = (card, answer, lang, data) => {
  data.steps = answer.steps.map(s => {
    const out = { id: s.id, title: s.title, included: s.included !== false }
    const note = String(s.note ?? '').trim()
    if (note) out.note = note
    return out
  })
  const on = data.steps.filter(s => s.included).length
  const skipped = data.steps.filter(s => !s.included).map(s => s.title)
  let summary = t(lang, 'rPlan', { n: on, total: data.steps.length })
  if (skipped.length) summary += ` · ${t(lang, 'rPlanSkipped', { x: joinList(skipped) })}`
  if (data.steps.some((s, i) => s.id !== card.steps[i]?.id)) summary += ` · ${t(lang, 'rPlanReordered')}`
  return { summary }
}
