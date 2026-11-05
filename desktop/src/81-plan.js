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
  planKeys: '[Alt]+[↑]/[↓] moves a step up or down',
  planDrag: 'Drag to move',
  planHighRisk: 'includes a high-risk step',
  planNothing: 'Switch on at least one step',
  planStepsLabel: 'Steps of the plan',
  planRequired: 'Required, always runs',
  planPending: 'Running {n} of {total} steps in {s} s',
  planUndo: 'Undo',
  rPlan: 'Go ahead with {n} of {total} steps', rPlanAll: 'Go ahead with the plan ({total} steps)', rPlanOne: 'Go ahead with the plan (1 step)',
  rPlanSkipped: 'skipped: {x}',
  rPlanReordered: 'reordered',
  rPlanNote: 'note on {x}: “{note}”', rPlanNotes: '{n} notes'
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
  planKeys: '[Alt]+[↑]/[↓] schiebt einen Schritt nach oben oder unten',
  planDrag: 'Zum Verschieben ziehen',
  planHighRisk: 'mit riskantem Schritt',
  planNothing: 'Mindestens einen Schritt einschalten',
  planStepsLabel: 'Schritte des Plans',
  planRequired: 'Pflichtschritt, läuft immer',
  planPending: '{n} von {total} Schritten starten in {s} s',
  planUndo: 'Rückgängig',
  rPlan: 'Leg los mit {n} von {total} Schritten', rPlanAll: 'Leg los mit dem Plan ({total} Schritte)', rPlanOne: 'Leg los mit dem Plan (1 Schritt)',
  rPlanSkipped: 'übersprungen: {x}',
  rPlanReordered: 'neu geordnet',
  rPlanNote: 'Notiz zu {x}: „{note}“', rPlanNotes: '{n} Notizen'
})

const PLAN_NOTE_MAX = 200
const PLAN_RISK = { low: ['●', 'riskLow'], medium: ['▲', 'riskMedium'], high: ['⬣', 'riskHigh'] }

const PLAN_CSS = `
.huic[data-card-type="plan"],.huic[data-card-type="review"]{background:var(--ui-chat-surface-background,var(--ui-base));--prc-on-red:#fff;--prc-on-green:#fff}
@supports (color: color(from red xyz-d65 x y z)){.huic[data-card-type="plan"],.huic[data-card-type="review"]{
  --prc-on-red:color(from var(--ui-red) xyz-d65 calc(.9505 * clamp(0, (.1791 - y) * 1000, 1)) clamp(0, (.1791 - y) * 1000, 1) calc(1.089 * clamp(0, (.1791 - y) * 1000, 1)));
  --prc-on-green:color(from var(--ui-green) xyz-d65 calc(.9505 * clamp(0, (.1791 - y) * 1000, 1)) clamp(0, (.1791 - y) * 1000, 1) calc(1.089 * clamp(0, (.1791 - y) * 1000, 1)))}}
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
.huic[data-card-type="plan"] .huic-plan-titlerow{display:flex;align-items:flex-start;gap:10px;min-width:0}
.huic[data-card-type="plan"] .huic-plan-titles{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:3px 8px}
.huic[data-card-type="plan"] .huic-plan-titlerow>input.huic-plan-switch{margin-top:1px}
.huic[data-card-type="plan"] .huic-plan-lock{flex:none;display:grid;place-items:center;width:32px;height:20px;color:var(--ui-text-quaternary,var(--ui-text-tertiary))}
.huic[data-card-type="plan"] .huic-plan-lock svg{width:13px;height:13px}
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
.huic[data-card-type="plan"] input.huic-plan-switch{appearance:none;position:relative;flex:none;width:32px;height:18px;margin:0;border:1px solid var(--ui-stroke-secondary);border-radius:999px;background:var(--ui-bg-quaternary);cursor:pointer;transition:background .15s,border-color .15s}
.huic[data-card-type="plan"] input.huic-plan-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--ui-text-secondary);transition:transform .15s}
.huic[data-card-type="plan"] input.huic-plan-switch:checked{background:var(--huic-accent);border-color:var(--huic-accent)}
.huic[data-card-type="plan"] input.huic-plan-switch:checked::after{transform:translateX(14px);background:var(--huic-on-accent)}
.huic[data-card-type="plan"] input.huic-plan-switch:disabled{cursor:default;opacity:.6}
.huic[data-card-type="plan"] input.huic-plan-switch:focus-visible{outline:2px solid var(--huic-accent);outline-offset:2px}
.huic[data-card-type="plan"] .huic-foot .huic-btn-danger{background:var(--ui-red);color:var(--prc-on-red);box-shadow:none}
.huic[data-card-type="plan"] .huic-foot .huic-btn-danger:hover:not(:disabled){background:color-mix(in srgb,var(--ui-red) 86%,var(--ui-text-primary))}
.huic[data-card-type="plan"] .huic-foot .huic-btn-danger:focus-visible{outline:2px solid var(--ui-red);outline-offset:2px}
.huic[data-card-type="plan"] .huic-foot:has(.huic-plan-pending){padding-top:10px}
.huic[data-card-type="plan"] .huic-plan-pending{position:relative;overflow:hidden;flex:1;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 8px 8px 12px;border-radius:var(--huic-r-md,8px);background:color-mix(in srgb,var(--huic-accent) 8%,transparent);color:var(--ui-text-secondary)}
.huic[data-card-type="plan"] .huic-plan-pending-text{flex:1;min-width:12em}
.huic[data-card-type="plan"] .huic-plan-drain{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--huic-accent);transform-origin:left;animation:huic-plan-drain var(--undo-ms) linear both}
@keyframes huic-plan-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.huic[data-card-type="plan"].is-pending .huic-plan-list,.huic[data-card-type="plan"].is-pending .huic-plan-keys{opacity:.62;transition:opacity .2s}
.huic[data-card-type="plan"].is-answered .huic-plan-step:not(.is-off) .huic-plan-node{background:var(--huic-accent);border-color:var(--huic-accent);color:var(--huic-on-accent)}
.huic[data-card-type="plan"].is-answered .huic-plan-step:not(.is-off)::before{background:color-mix(in srgb,var(--huic-accent) 45%,var(--ui-stroke-tertiary))}
.huic[data-card-type="plan"] .huic-plan-node svg{width:13px;height:13px}
.huic[data-card-type="plan"] .huic-plan-note{min-height:30px;padding:5px 8px;font-size:12.5px;background:color-mix(in srgb,var(--ui-bg-quaternary) 35%,transparent)}
.huic[data-card-type="plan"] .huic-plan-note-text{margin:0;padding:2px 0 2px 9px;border-left:2px solid var(--huic-accent);color:var(--ui-text-secondary);font-size:12.5px;white-space:pre-wrap}
.huic[data-card-type="plan"] .huic-plan-keys{margin:0 0 0 38px;color:var(--ui-text-tertiary);font-size:11.5px}
.huic[data-card-type="plan"] .huic-plan-warn{color:var(--ui-red,var(--ui-text-secondary))}
@container (max-width: 440px){
  .huic[data-card-type="plan"] .huic-plan-step{grid-template-columns:26px minmax(0,1fr)}
  .huic[data-card-type="plan"] .huic-plan-ctrl{grid-column:2;margin-left:-6px}
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
function PlanFrame({ card, display, labelId, frameRef, pinned, css, head, children, footer, after, onKeyDown, className }) {
  return jsxs('section', {
    ref: frameRef,
    className: cx('huic', display?.compact && 'huic-compact', pinned && 'huic-pinned', className),
    onKeyDown,
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
  chevron: 'm6 4 4 4-4 4',
  lock: 'M4.5 7.5h7v5.5h-7zM6 7.5V5.5a2 2 0 0 1 4 0v2'
}

function planIcon(kind) {
  return jsx('svg', {
    viewBox: '0 0 16 16', width: 14, height: 14, fill: 'none', stroke: 'currentColor', strokeWidth: 1.6,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: 'false',
    children: jsx('path', { d: PLAN_ICONS[kind] })
  })
}

// Ids and input names come from the model: keep them in prototype-free maps, so an id like
// "constructor" or a calc input named "__proto__" is an ordinary key. Shared with review and calc.
function planDict(entries) {
  const dict = Object.create(null)
  for (const [key, value] of entries || []) dict[key] = value
  return dict
}
function planOwn(obj, key) {
  return obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined
}
// A copy with one key set (or removed when value is undefined).
function planWith(dict, key, value) {
  const next = planDict(Object.entries(dict))
  if (value === undefined) delete next[key]
  else next[key] = value
  return next
}

function planState(card, source) {
  const ids = card.steps.map(s => s.id)
  const optional = new Set(card.steps.filter(s => s.optional).map(s => s.id))
  const src = source && typeof source === 'object' ? source : {}
  const srcOrder = planOwn(src, 'order'), srcOff = planOwn(src, 'off'), srcNotes = planOwn(src, 'notes')
  const order = Array.isArray(srcOrder) ? srcOrder.filter((id, i, all) => ids.includes(id) && all.indexOf(id) === i) : []
  for (const id of ids) if (!order.includes(id)) order.push(id)
  const off = Array.isArray(srcOff) ? srcOff.filter(id => optional.has(id)) : card.steps.filter(s => s.optional && s.off).map(s => s.id)
  const notes = planDict()
  for (const id of ids) {
    const note = planOwn(srcNotes, id)
    if (typeof note === 'string' && note) notes[id] = limitText(note, PLAN_NOTE_MAX)
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
    notes: planDict(steps.filter(s => typeof s.note === 'string' && s.note).map(s => [s.id, s.note]))
  }
}

// Pending send with an undo window, like compare: Escape or Undo inside the card cancels,
// focus goes to Undo and back to the button that started it; unmounting sends nothing.
function planUseUndo(display, onSend) {
  const [pending, setPending] = useState(null)
  const sendRef = useRef(onSend)
  sendRef.current = onSend
  const timer = useRef(null)
  const undoRef = useRef(null)
  const startRef = useRef(null)
  const returnFocus = useRef(false)
  useEffect(() => () => { clearTimeout(timer.current); timer.current = null }, [])
  useEffect(() => {
    if (pending) undoRef.current?.focus()
    else if (returnFocus.current) { returnFocus.current = false; startRef.current?.focus() }
  }, [pending])
  const start = (payload, info) => {
    if (timer.current) return
    const ms = typeof undoDelayMs === 'function' ? undoDelayMs(display) : 4000
    if (!ms) { onSend(payload); return }
    setPending({ ...info, ms })
    timer.current = setTimeout(() => { timer.current = null; setPending(null); sendRef.current(payload) }, ms)
  }
  const cancel = () => {
    if (!timer.current) return
    clearTimeout(timer.current)
    timer.current = null
    returnFocus.current = true
    setPending(null)
  }
  const onKeyDown = e => {
    if (timer.current && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); cancel() }
  }
  return { pending, start, cancel, onKeyDown, undoRef, startRef }
}

function PlanPendingBar({ say, ms, undoRef, onUndo, lang }) {
  return jsxs('div', { className: 'huic-plan-pending', role: 'status', 'aria-live': 'polite', style: { '--undo-ms': `${ms}ms` }, children: [
    jsx('span', { className: 'huic-plan-pending-text', children: jsx(Countdown, { ms, say }) }),
    jsx(Btn, { ref: undoRef, variant: 'ghost', onClick: onUndo, children: t(lang, 'planUndo') }),
    jsx('span', { className: 'huic-plan-drain', 'aria-hidden': true })
  ] })
}

function PlanCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const frameRef = useRef(null)
  const pinned = planUsePinned(frameRef)
  const ans = useCardAnswer(card, sessionId, lang)
  const [state, setState] = useState(() => planState(card, ans.draft))
  const view = (ans.answer && planFromAnswer(card, ans.answer)) || state
  const [openNotes, setOpenNotes] = useState(() => planDict())
  const [announce, setAnnounce] = useState('')
  const [drag, setDrag] = useState(null)
  const [moved, setMoved] = useState(null)
  const focusAfter = useRef(null)
  const rowRefs = useRef(new Map())
  const byId = useMemo(() => new Map(card.steps.map(s => [s.id, s])), [card])
  const undo = planUseUndo(display, answer => ans.submit(answer))
  const editable = ans.showActions
  const locked = !editable || Boolean(undo.pending)

  // Reordering moves DOM nodes, which can drop focus: put it back on the same control.
  useEffect(() => {
    const target = focusAfter.current
    if (!target) return
    focusAfter.current = null
    const row = rowRefs.current.get(target.id)
    if (!row) return
    let el = row.querySelector(`[data-plan-focus="${target.which}"]`)
    if (!el || el.disabled) el = row.querySelector('[data-plan-focus="up"]:not(:disabled),[data-plan-focus="down"]:not(:disabled)')
    el?.focus()
  })

  const update = next => {
    if (locked) return
    setState(next)
    ans.saveDraft(next)
  }

  const moveTo = (id, to, which) => {
    const from = state.order.indexOf(id)
    if (locked || from < 0 || to < 0 || to >= state.order.length || to === from) return
    const order = state.order.filter(x => x !== id)
    order.splice(to, 0, id)
    update({ ...state, order })
    focusAfter.current = which ? { id, which } : null
    setMoved({ id, n: (moved?.n || 0) + 1 })
    setAnnounce(t(lang, 'planMoved', { x: byId.get(id).title, n: to + 1, total: order.length }))
  }

  const toggle = id => update({ ...state, off: state.off.includes(id) ? state.off.filter(x => x !== id) : [...state.off, id] })
  const setNote = (id, text) => update({ ...state, notes: planWith(state.notes, id, limitText(text, PLAN_NOTE_MAX) || undefined) })
  const noteButton = (id, open) => {
    if (!open) {
      setOpenNotes(prev => planWith(prev, id, true))
      focusAfter.current = { id, which: 'note' }
    } else if (!state.notes[id]) {
      setOpenNotes(prev => planWith(prev, id, undefined))
    } else {
      rowRefs.current.get(id)?.querySelector('[data-plan-focus="note"]')?.focus()
    }
  }

  const onRowKey = (id, index) => e => {
    if (locked || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.nativeEvent?.isComposing) return
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
  const highRisk = included.some(id => byId.get(id).risk === 'high')

  const rows = view.order.map((id, i) => {
    const step = byId.get(id)
    const on = !view.off.includes(id)
    const note = view.notes[id] || ''
    const noteOpen = editable && Boolean(openNotes[id] || note)
    const titleId = `${labelId}-${id}`
    const noteId = `${labelId}-${id}-note`
    const risk = step.risk && PLAN_RISK[step.risk]
    const isDropTarget = drag?.id && drag.over === id && drag.id !== id
    // Right end of the title row: the on/off switch for optional steps, a lock for required ones.
    const toggleSlot = !editable ? null
      : step.optional
        ? jsx('input', {
            type: 'checkbox', role: 'switch', className: 'huic-plan-switch', checked: on, disabled: locked,
            'data-plan-focus': 'switch', 'aria-label': t(lang, 'planInclude', { x: step.title }),
            title: t(lang, 'planInclude', { x: step.title }),
            onChange: () => toggle(id)
          })
        : jsx('span', { className: 'huic-plan-lock', role: 'img', 'aria-label': t(lang, 'planRequired'), title: t(lang, 'planRequired'), children: planIcon('lock') })
    return jsxs('li', {
      ref: el => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id) },
      className: cx('huic-plan-step', !on && 'is-off', step.risk === 'high' && 'is-risk-high',
        drag?.id === id && 'is-dragging', isDropTarget && (drag.after ? 'is-drop-after' : 'is-drop-before'),
        moved?.id === id && (moved.n % 2 ? 'is-moved-a' : 'is-moved-b')),
      'data-step': id,
      'aria-labelledby': titleId,
      onKeyDown: onRowKey(id, i),
      onDragOver: !locked && drag?.id ? e => {
        e.preventDefault()
        const r = e.currentTarget.getBoundingClientRect()
        const after = e.clientY > r.top + r.height / 2
        if (drag.over !== id || drag.after !== after) setDrag({ ...drag, over: id, after })
      } : undefined,
      onDrop: !locked && drag?.id ? e => { e.preventDefault(); dropAt(id) } : undefined,
      children: [
        jsx('span', {
          className: 'huic-plan-node', 'aria-hidden': true,
          draggable: !locked ? 'true' : undefined,
          title: !locked && total > 1 ? t(lang, 'planDrag') : undefined,
          onDragStart: !locked ? e => {
            e.dataTransfer.effectAllowed = 'move'
            try { e.dataTransfer.setData('text/plain', step.title) } catch {}
            const row = rowRefs.current.get(id)
            if (row && e.dataTransfer.setDragImage) e.dataTransfer.setDragImage(row, 14, 14)
            setDrag({ id })
          } : undefined,
          onDragEnd: !locked ? () => setDrag(null) : undefined,
          children: ans.answered && on ? planIcon('check') : i + 1
        }),
        jsxs('div', {
          className: 'huic-plan-main',
          children: [
            jsxs('div', { className: 'huic-plan-titlerow', children: [
              jsxs('div', { className: 'huic-plan-titles', children: [
                jsx('span', { id: titleId, className: 'huic-plan-title', children: step.title }),
                !on ? jsx('span', { className: 'huic-plan-chip', children: t(lang, 'planSkipped') }) : step.optional && !ans.answered ? jsx('span', { className: 'huic-plan-chip', children: t(lang, 'planOptional') }) : null,
                risk ? jsxs('span', { className: cx('huic-plan-chip', `huic-plan-chip-${step.risk}`), children: [jsx('span', { 'aria-hidden': true, children: risk[0] }), t(lang, risk[1])] }) : null
              ] }),
              toggleSlot
            ] }),
            step.detail ? jsx('p', { className: 'huic-plan-detail', children: step.detail }) : null,
            step.command ? jsx(CodeBlock, { code: step.command, lang }) : null,
            noteOpen
              ? jsx('input', {
                  id: noteId, className: 'huic-input huic-plan-note', type: 'text', value: note, disabled: locked,
                  'data-plan-focus': 'note', maxLength: PLAN_NOTE_MAX * 2,
                  placeholder: t(lang, 'planNotePlaceholder'),
                  'aria-label': t(lang, 'planNoteFor', { n: i + 1, x: step.title }),
                  onChange: e => setNote(id, e.target.value),
                  onKeyDown: e => {
                    if (e.key === 'Escape' && !note && !undo.pending) { e.preventDefault(); noteButton(id, true); rowRefs.current.get(id)?.querySelector('[data-plan-focus="notebtn"]')?.focus() }
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
            jsx('button', {
              type: 'button', className: cx('huic-plan-icon', note && 'has-note'), 'data-plan-focus': 'notebtn', disabled: locked,
              'aria-label': t(lang, 'planNoteFor', { n: i + 1, x: step.title }), title: t(lang, 'planNote'),
              'aria-expanded': noteOpen, 'aria-controls': noteOpen ? noteId : undefined,
              onClick: () => noteButton(id, noteOpen),
              children: planIcon('note')
            }),
            total > 1 ? jsx('button', {
              type: 'button', className: 'huic-plan-icon', 'data-plan-focus': 'up', disabled: locked || i === 0,
              'aria-label': t(lang, 'planMoveUp', { x: step.title }), title: 'Alt+↑', 'aria-keyshortcuts': 'Alt+ArrowUp',
              onClick: () => moveTo(id, i - 1, 'up'), children: planIcon('up')
            }) : null,
            total > 1 ? jsx('button', {
              type: 'button', className: 'huic-plan-icon', 'data-plan-focus': 'down', disabled: locked || i === total - 1,
              'aria-label': t(lang, 'planMoveDown', { x: step.title }), title: 'Alt+↓', 'aria-keyshortcuts': 'Alt+ArrowDown',
              onClick: () => moveTo(id, i + 1, 'down'), children: planIcon('down')
            }) : null
          ]
        }) : null
      ]
    }, id)
  })

  const run = () => undo.start({
    steps: view.order.map(id => {
      const note = (view.notes[id] || '').trim()
      return { id, title: byId.get(id).title, included: !view.off.includes(id), ...(note ? { note } : {}) }
    })
  }, { n: included.length })

  const hint = included.length
    ? jsxs(Fragment, { children: [
        t(lang, 'planCount', { n: included.length, total }),
        reordered ? ` · ${t(lang, 'planReordered')}` : '',
        highRisk ? jsxs('span', { className: 'huic-plan-warn', children: [' · ', t(lang, 'planHighRisk')] }) : null
      ] })
    : t(lang, 'planNothing')

  const footer = !editable ? null
    : undo.pending
      ? jsx('div', { className: 'huic-foot', children: jsx(PlanPendingBar, {
          say: s => t(lang, 'planPending', { n: undo.pending.n, total, s }),
          ms: undo.pending.ms, undoRef: undo.undoRef, onUndo: undo.cancel, lang
        }) })
      : jsx(Footer, {
          hint,
          children: jsx(Btn, { ref: undo.startRef, variant: highRisk ? 'danger' : 'primary', disabled: !included.length, onClick: run, children: card.runLabel || t(lang, 'planRun') })
        })

  return jsx(PlanFrame, {
    card, display, labelId, frameRef, pinned, onKeyDown: undo.onKeyDown,
    className: cx(undo.pending && 'is-pending', ans.answered && 'is-answered'),
    head: jsxs('header', { className: 'huic-head', children: [
      jsx('h3', { className: 'huic-title', id: labelId, style: { margin: 0 }, children: card.title }),
      card.summary ? jsx('p', { className: 'huic-sub', style: { margin: '2px 0 0' }, children: card.summary }) : null
    ] }),
    children: [
      jsx('ol', { className: 'huic-plan-list', 'aria-label': t(lang, 'planStepsLabel'), children: rows }, 'list'),
      editable && total > 1 ? jsx(KeyHint, { as: 'p', className: 'huic-plan-keys', text: t(lang, 'planKeys') }, 'keys') : null,
      jsx('div', { className: 'huic-sr', role: 'status', 'aria-live': 'polite', children: announce }, 'live')
    ],
    footer,
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
  let summary = t(lang, on < data.steps.length ? 'rPlan' : on === 1 ? 'rPlanOne' : 'rPlanAll', { n: on, total: data.steps.length })
  if (skipped.length) summary += ` · ${t(lang, 'rPlanSkipped', { x: joinList(skipped) })}`
  if (data.steps.some((s, i) => s.id !== card.steps[i]?.id)) summary += ` · ${t(lang, 'rPlanReordered')}`
  // A note is an instruction, so the person reading the chat should see it too (in full in line 2).
  const noted = data.steps.filter(s => s.included && s.note)
  if (noted.length === 1) summary += ` · ${t(lang, 'rPlanNote', { x: clip(noted[0].title), note: clip(noted[0].note) })}`
  else if (noted.length > 1) summary += ` · ${t(lang, 'rPlanNotes', { n: noted.length })}`
  return { summary }
}
