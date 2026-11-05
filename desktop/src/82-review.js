// review: many small keep/drop decisions in one card. Each row has a Keep/Drop switch
// (arrow keys move between the two), an optional comment and a preview; the head with the
// tally and the bulk actions stays in reach on long lists. Decisions are kept as a draft.

Object.assign(STRINGS.en, {
  reviewKeep: 'Keep',
  reviewDrop: 'Drop',
  reviewApply: 'Apply', reviewPending: 'Applying in {s} s',
  reviewOpen: 'Open',
  reviewKeepAll: 'Keep all',
  reviewDropAll: 'Drop all',
  reviewKeepRest: 'Keep the other {n}',
  reviewAllAs: '{x} all',
  reviewRestAs: '{x} the other {n}',
  reviewReset: 'Reset',
  reviewDecision: 'Decision for {x}',
  reviewComment: 'Comment',
  reviewCommentFor: 'Comment on {x}',
  reviewCommentPlaceholder: 'Why? (optional, for Hermes)',
  reviewMore: 'Show all',
  reviewLess: 'Show less',
  reviewStillOpen: '{n} still open',
  reviewAskOpen: '{n} still open — send anyway? They go to Hermes as undecided.',
  reviewSendAnyway: 'Send anyway',
  reviewBack: 'Back',
  reviewAllDecided: 'All {n} decided',
  reviewBulkDone: 'All {n} set to {x}.',
  reviewRestDone: '{n} more set to {x}.',
  reviewResetDone: 'Decisions reset.',
  reviewItemsLabel: 'Items to review',
  reviewKept: 'Kept', reviewDropped: 'Dropped', reviewUndecided: 'Undecided',
  rReview: 'Review done: keep {keep}, drop {drop}',
  rReviewOpen: ', {n} undecided'
})
Object.assign(STRINGS.de, {
  reviewKeep: 'Behalten',
  reviewDrop: 'Verwerfen',
  reviewApply: 'Übernehmen', reviewPending: 'Wird in {s} s übernommen',
  reviewOpen: 'Offen',
  reviewKeepAll: 'Alle behalten',
  reviewDropAll: 'Alle verwerfen',
  reviewKeepRest: 'Restliche {n} behalten',
  reviewAllAs: 'Alle: {x}',
  reviewRestAs: 'Restliche {n}: {x}',
  reviewReset: 'Zurücksetzen',
  reviewDecision: 'Entscheidung für {x}',
  reviewComment: 'Kommentar',
  reviewCommentFor: 'Kommentar zu {x}',
  reviewCommentPlaceholder: 'Warum? (optional, für Hermes)',
  reviewMore: 'Alles zeigen',
  reviewLess: 'Weniger zeigen',
  reviewStillOpen: '{n} noch offen',
  reviewAskOpen: '{n} noch offen – trotzdem senden? Sie gehen als offen an Hermes.',
  reviewSendAnyway: 'Trotzdem senden',
  reviewBack: 'Zurück',
  reviewAllDecided: 'Alle {n} entschieden',
  reviewBulkDone: 'Alle {n} auf {x} gesetzt.',
  reviewRestDone: 'Weitere {n} auf {x} gesetzt.',
  reviewResetDone: 'Entscheidungen zurückgesetzt.',
  reviewItemsLabel: 'Einträge zum Durchsehen',
  reviewKept: 'Behalten', reviewDropped: 'Verworfen', reviewUndecided: 'Offen',
  rReview: 'Durchgesehen: {keep} behalten, {drop} verwerfen',
  rReviewOpen: ', {n} offen'
})

const REVIEW_NOTE_MAX = 200

const REVIEW_CSS = `
.huic[data-card-type="review"] .huic-rev-pending{flex:1;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;background:color-mix(in srgb,var(--huic-accent) 8%,transparent)}
.huic[data-card-type="review"] .huic-rev-pending span{flex:1}
.huic[data-card-type="review"] .huic-btn-danger-outline{color:var(--ui-orange,var(--ui-yellow,var(--huic-accent)));box-shadow:inset 0 0 0 1px currentColor}

.huic[data-card-type="review"]>.huic-pin-head{padding:var(--huic-pad) var(--huic-pad) 10px;background:inherit;border-radius:11px 11px 0 0;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--ui-stroke-tertiary)}
.huic[data-card-type="review"].huic-pinned>.huic-pin-head{position:sticky;top:0;z-index:3;box-shadow:0 10px 14px -14px var(--ui-text-primary)}
.huic[data-card-type="review"] .huic-rev-tally{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.huic[data-card-type="review"] .huic-rev-bar{display:flex;flex:1 1 140px;height:6px;border-radius:999px;overflow:hidden;background:var(--ui-bg-quaternary)}
.huic[data-card-type="review"] .huic-rev-bar>span{display:block;height:100%;transition:width .2s}
.huic[data-card-type="review"] .huic-rev-bar>.is-keep{background:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="review"] .huic-rev-bar>.is-drop{background:var(--ui-red,var(--ui-text-secondary))}
.huic[data-card-type="review"] .huic-rev-counts{display:flex;gap:10px;font-size:12px;color:var(--ui-text-secondary);font-variant-numeric:tabular-nums;white-space:nowrap}
.huic[data-card-type="review"] .huic-rev-counts b{font-weight:600;color:var(--ui-text-primary)}
.huic[data-card-type="review"] .huic-rev-counts>span{display:inline-flex;align-items:center;gap:4px}
.huic[data-card-type="review"] .huic-rev-counts i{margin-right:1px}
.huic[data-card-type="review"] .huic-rev-counts i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:1px;font-style:normal}
.huic[data-card-type="review"] .huic-rev-counts .is-keep i{background:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="review"] .huic-rev-counts .is-drop i{background:var(--ui-red,var(--ui-text-secondary))}
.huic[data-card-type="review"] .huic-rev-counts .is-open i{border:1.5px solid var(--ui-stroke-secondary)}
.huic[data-card-type="review"] .huic-rev-bulk{display:flex;gap:6px;flex-wrap:wrap}
.huic[data-card-type="review"] .huic-rev-bulk .huic-btn{padding:3px 10px;font-size:12px}
.huic[data-card-type="review"] .huic-rev-bulk .huic-rev-reset{margin-left:auto}
.huic[data-card-type="review"]>.huic-body{padding-top:2px}
.huic[data-card-type="review"] .huic-rev-list{list-style:none;margin:0 calc(var(--huic-pad) * -1);padding:0}
.huic[data-card-type="review"] .huic-rev-item{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;align-items:start;margin:0;padding:9px var(--huic-pad) 9px calc(var(--huic-pad) + 2px);border-bottom:1px solid var(--ui-stroke-tertiary);transition:background .15s}
.huic[data-card-type="review"] .huic-rev-item:last-child{border-bottom:0}
.huic[data-card-type="review"] .huic-rev-item::before{content:"";position:absolute;left:0;top:8px;bottom:8px;width:3px;border-radius:0 3px 3px 0;background:transparent;transition:background .15s}
.huic[data-card-type="review"] .huic-rev-item[data-decision="keep"]::before{background:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="review"] .huic-rev-item[data-decision="drop"]::before{background:var(--ui-red,var(--ui-text-secondary))}
.huic[data-card-type="review"] .huic-rev-item[data-decision="drop"]{background:color-mix(in srgb,var(--ui-red,var(--ui-text-secondary)) 4%,transparent)}
.huic[data-card-type="review"] .huic-rev-item[data-decision="drop"] .huic-rev-title{text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--ui-red,currentColor) 60%,transparent);color:var(--ui-text-secondary)}
.huic[data-card-type="review"] .huic-rev-item[data-decision="drop"] .huic-rev-preview{opacity:.6}
.huic[data-card-type="review"] .huic-rev-main{display:flex;flex-direction:column;gap:4px;min-width:0}
.huic[data-card-type="review"] .huic-rev-titlerow{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px}
.huic[data-card-type="review"] .huic-rev-title{font-weight:600}
.huic[data-card-type="review"] .huic-rev-detail{margin:0;color:var(--ui-text-secondary);font-size:12.5px;white-space:pre-wrap}
.huic[data-card-type="review"] .huic-rev-preview{margin:2px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
.huic[data-card-type="review"] .huic-rev-preview.is-prose{padding:1px 0 1px 10px;border-left:2px solid var(--ui-stroke-tertiary);color:var(--ui-text-secondary);font-size:13px;line-height:1.5}
.huic[data-card-type="review"] .huic-rev-preview.is-code{font-family:var(--font-mono,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);font-size:11.5px;line-height:1.5;padding:6px 9px;border-radius:7px;background:var(--ui-inline-code-background,var(--ui-bg-quaternary));color:var(--ui-inline-code-foreground,var(--ui-text-secondary))}
.huic[data-card-type="review"] .huic-rev-preview.is-clamped{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden}
.huic[data-card-type="review"] .huic-rev-link{align-self:flex-start;padding:0;border:0;background:transparent;color:var(--huic-accent);font:inherit;font-size:12px;cursor:pointer}
.huic[data-card-type="review"] .huic-rev-link:hover{text-decoration:underline}
.huic[data-card-type="review"] .huic-rev-note{min-height:30px;padding:5px 8px;font-size:12.5px;background:color-mix(in srgb,var(--ui-bg-quaternary) 35%,transparent)}
.huic[data-card-type="review"] .huic-rev-note-text{margin:0;padding:1px 0 1px 9px;border-left:2px solid var(--huic-accent);color:var(--ui-text-secondary);font-size:12.5px;white-space:pre-wrap}
.huic[data-card-type="review"] .huic-rev-side{display:flex;align-items:center;gap:4px}
.huic[data-card-type="review"] .huic-rev-seg{display:inline-flex;padding:2px;gap:2px;border-radius:8px;background:var(--ui-bg-quaternary)}
.huic[data-card-type="review"] .huic-rev-seg button{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:26px;padding:3px 10px;border:0;border-radius:6px;background:transparent;color:var(--ui-text-secondary);font:inherit;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .12s,color .12s}
.huic[data-card-type="review"] .huic-rev-seg button:hover{color:var(--ui-text-primary)}
.huic[data-card-type="review"] .huic-rev-seg button[aria-checked="true"].is-keep{background:var(--ui-green,var(--huic-accent));color:var(--prc-on-green)}
.huic[data-card-type="review"] .huic-rev-seg button[aria-checked="true"].is-drop{background:var(--ui-red,var(--ui-text-secondary));color:var(--prc-on-red)}
.huic[data-card-type="review"] .huic-rev-seg button:focus-visible{outline:2px solid var(--huic-accent);outline-offset:1px}
.huic[data-card-type="review"] .huic-rev-ask{flex-wrap:wrap}
.huic[data-card-type="review"] .huic-rev-ask-text{flex:1 1 14em;color:var(--ui-text-primary)}
.huic[data-card-type="review"].is-answered .huic-rev-item[data-decision="none"] .huic-rev-title{color:var(--ui-text-secondary)}
.huic[data-card-type="review"] .huic-rev-stamp svg{width:12px;height:12px}
.huic[data-card-type="review"] .huic-rev-icon{display:grid;place-items:center;width:28px;height:28px;padding:0;border:0;border-radius:7px;background:transparent;color:var(--ui-text-tertiary);cursor:pointer}
.huic[data-card-type="review"] .huic-rev-icon:hover{background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.huic[data-card-type="review"] .huic-rev-icon[aria-expanded="true"],.huic[data-card-type="review"] .huic-rev-icon.has-note{color:var(--huic-accent)}
.huic[data-card-type="review"] .huic-rev-stamp{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:600;padding:1px 8px;border-radius:999px;white-space:nowrap;color:var(--ui-text-tertiary);background:var(--ui-bg-quaternary)}
.huic[data-card-type="review"] .huic-rev-stamp.is-keep{color:var(--ui-green,var(--huic-accent));background:color-mix(in srgb,var(--ui-green,var(--huic-accent)) 12%,transparent)}
.huic[data-card-type="review"] .huic-rev-stamp.is-drop{color:var(--ui-red,var(--ui-text-secondary));background:color-mix(in srgb,var(--ui-red,var(--ui-text-secondary)) 12%,transparent)}
.huic-compact[data-card-type="review"] .huic-rev-item{padding-block:6px}
@container (max-width: 440px){
  .huic[data-card-type="review"] .huic-rev-item{grid-template-columns:minmax(0,1fr)}
  .huic[data-card-type="review"] .huic-rev-side{justify-content:space-between}
  .huic[data-card-type="review"] .huic-rev-seg{flex:1}
  .huic[data-card-type="review"] .huic-rev-seg button{flex:1}
  .huic[data-card-type="review"] .huic-rev-bulk .huic-rev-reset{margin-left:0}
}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="review"] *{transition:none!important}}
`

function reviewDefaults(card) {
  const d = card.defaultDecision
  return planDict(d === 'keep' || d === 'drop' ? card.items.map(i => [i.id, d]) : [])
}

function reviewState(card, source) {
  const src = source && typeof source === 'object' ? source : null
  const srcDecisions = planOwn(src, 'decisions'), srcNotes = planOwn(src, 'notes')
  const decisions = srcDecisions && typeof srcDecisions === 'object' ? planDict() : reviewDefaults(card)
  const notes = planDict()
  for (const item of card.items) {
    const decision = planOwn(srcDecisions, item.id)
    if (decision === 'keep' || decision === 'drop') decisions[item.id] = decision
    const note = planOwn(srcNotes, item.id)
    if (typeof note === 'string' && note) notes[item.id] = limitText(note, REVIEW_NOTE_MAX)
  }
  return { decisions, notes }
}

function reviewFromAnswer(card, answer) {
  const a = answer?.selection || answer?.data
  if (!a || !Array.isArray(a.keep)) return null
  const decisions = planDict()
  for (const id of a.keep) decisions[id] = 'keep'
  for (const id of a.drop || []) decisions[id] = 'drop'
  const notes = planDict()
  for (const item of card.items) {
    const note = planOwn(a.notes, item.id)
    if (typeof note === 'string' && note) notes[item.id] = note
  }
  return { decisions, notes }
}

function reviewLong(text) {
  return [...text].length > 220 || text.split('\n').length > 3
}

// Previews are prose (a draft reply) unless they look like code: a shell line, a fence or a path.
function reviewIsCode(text) {
  return /^\s*\$\s/.test(text) || text.includes('```') ||
    /(^|[\s("'`])(~|\.{1,2})?\/[\w.-]+\/[\w.\/-]*/.test(text) || /(^|[\s("'`])~\/[\w.-]+/.test(text) ||
    /(^|\s)[A-Za-z]:\\[\w.\\ -]+/.test(text) || /(^|\s)[\w.-]+\/[\w.\/-]+\.[A-Za-z]{1,8}\b/.test(text)
}

function ReviewCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const frameRef = useRef(null)
  const pinned = planUsePinned(frameRef)
  const ans = useCardAnswer(card, sessionId, lang)
  const [state, setState] = useState(() => reviewState(card, ans.draft))
  const view = (ans.answer && reviewFromAnswer(card, ans.answer)) || state
  const [openNotes, setOpenNotes] = useState(() => planDict())
  const [expanded, setExpanded] = useState(() => planDict())
  const [announce, setAnnounce] = useState('')
  const [confirming, setConfirming] = useState(false)
  const focusNote = useRef(null)
  const rowRefs = useRef(new Map())
  const undo = planUseUndo(display, answer => ans.submit(answer))
  const applyRef = undo.startRef
  const goRef = useRef(null)
  const backFocus = useRef(false)
  const editable = ans.showActions && !undo.pending
  const destructive = card.items.some(i => /delete|löschen/i.test(i.tag || '')) || [card.keepLabel, card.dropLabel, card.applyLabel].some(label => /^\s*(delete|remove|drop|löschen|entfernen)\b/i.test(label || ''))
  // Custom labels are used everywhere: buttons, bulk actions, tally, announcements, stamps.
  const custom = Boolean(card.keepLabel || card.dropLabel)
  const keepLabel = card.keepLabel || t(lang, 'reviewKeep')
  const dropLabel = card.dropLabel || t(lang, 'reviewDrop')
  const decisionLabel = d => (d === 'keep' ? keepLabel : dropLabel)

  useEffect(() => {
    if (!focusNote.current) return
    rowRefs.current.get(focusNote.current)?.querySelector('.huic-rev-note')?.focus()
    focusNote.current = null
  })

  const keep = card.items.filter(i => view.decisions[i.id] === 'keep')
  const drop = card.items.filter(i => view.decisions[i.id] === 'drop')
  const open = card.items.length - keep.length - drop.length
  const total = card.items.length
  const defaults = reviewDefaults(card)
  const changed = card.items.some(i => (state.decisions[i.id] || null) !== (defaults[i.id] || null))
  const asking = editable && confirming && open > 0

  useEffect(() => {
    if (asking) goRef.current?.focus()
    else if (backFocus.current) { backFocus.current = false; applyRef.current?.focus() }
  }, [asking])

  const update = next => {
    setState(next)
    ans.saveDraft(next)
  }
  const decide = (id, decision) => update({ ...state, decisions: planWith(state.decisions, id, decision) })
  const bulk = decision => {
    update({ ...state, decisions: planDict(card.items.map(i => [i.id, decision])) })
    setAnnounce(t(lang, 'reviewBulkDone', { n: card.items.length, x: decisionLabel(decision) }))
  }
  const keepRest = () => {
    const rest = card.items.filter(i => !state.decisions[i.id])
    const decisions = planDict(Object.entries(state.decisions))
    for (const i of rest) decisions[i.id] = 'keep'
    update({ ...state, decisions })
    setAnnounce(t(lang, 'reviewRestDone', { n: rest.length, x: keepLabel }))
  }
  const reset = () => {
    update({ ...state, decisions: reviewDefaults(card) })
    setAnnounce(t(lang, 'reviewResetDone'))
  }
  const setNote = (id, text) => update({ ...state, notes: planWith(state.notes, id, limitText(text, REVIEW_NOTE_MAX) || undefined) })
  const noteButton = (id, isOpen) => {
    if (!isOpen) {
      setOpenNotes(prev => planWith(prev, id, true))
      focusNote.current = id
    } else if (!state.notes[id]) setOpenNotes(prev => planWith(prev, id, undefined))
    else rowRefs.current.get(id)?.querySelector('.huic-rev-note')?.focus()
  }

  // Two options in a radio group: one tab stop, arrow keys switch and select.
  const segment = (item, decision) => {
    const titleId = `${labelId}-${item.id}`
    const radio = (value, label, icon) => jsxs('button', {
      type: 'button', role: 'radio', className: `is-${value}`,
      'aria-checked': decision === value, 'aria-label': `${label} ${item.title}`,
      tabIndex: decision === value || (!decision && value === 'keep') ? 0 : -1,
      onClick: () => decide(item.id, value),
      onKeyDown: e => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey) return
        e.preventDefault()
        const other = value === 'keep' ? 'drop' : 'keep'
        decide(item.id, other)
        e.currentTarget.parentElement.querySelector(`.is-${other}`)?.focus()
      },
      children: [planIcon(icon), label]
    }, value)
    return jsxs('div', {
      className: 'huic-rev-seg', role: 'radiogroup',
      'aria-label': t(lang, 'reviewDecision', { x: item.title }),
      'aria-describedby': titleId,
      children: [radio('keep', keepLabel, 'check'), radio('drop', dropLabel, 'cross')]
    })
  }

  const rows = card.items.map(item => {
    const decision = view.decisions[item.id] || null
    const note = view.notes[item.id] || ''
    const noteOpen = editable && Boolean(openNotes[item.id] || note)
    const titleId = `${labelId}-${item.id}`
    const noteId = `${labelId}-${item.id}-note`
    const previewId = `${labelId}-${item.id}-preview`
    const long = item.preview && reviewLong(item.preview)
    const isOpen = Boolean(expanded[item.id])
    const code = item.preview && reviewIsCode(item.preview)
    return jsxs('li', {
      ref: el => { if (el) rowRefs.current.set(item.id, el); else rowRefs.current.delete(item.id) },
      className: 'huic-rev-item', 'data-decision': decision || 'none', 'data-item': item.id,
      children: [
        jsxs('div', { className: 'huic-rev-main', children: [
          jsxs('div', { className: 'huic-rev-titlerow', children: [
            jsx('span', { id: titleId, className: 'huic-rev-title', children: item.title }),
            item.tag ? jsx('span', { className: 'huic-badge', children: item.tag }) : null
          ] }),
          item.detail ? jsx('p', { className: 'huic-rev-detail', children: item.detail }) : null,
          item.preview ? jsx(code ? 'pre' : 'p', { id: previewId, className: cx('huic-rev-preview', code ? 'is-code' : 'is-prose', long && !isOpen && 'is-clamped'), children: item.preview }) : null,
          long ? jsx('button', {
            type: 'button', className: 'huic-rev-link', 'aria-expanded': isOpen, 'aria-controls': previewId,
            onClick: () => setExpanded(prev => planWith(prev, item.id, isOpen ? undefined : true)),
            children: t(lang, isOpen ? 'reviewLess' : 'reviewMore')
          }) : null,
          noteOpen
            ? jsx('input', {
                id: noteId, className: 'huic-input huic-rev-note', type: 'text', value: note, maxLength: REVIEW_NOTE_MAX * 2,
                placeholder: t(lang, 'reviewCommentPlaceholder'), 'aria-label': t(lang, 'reviewCommentFor', { x: item.title }),
                onChange: e => setNote(item.id, e.target.value),
                onKeyDown: e => {
                  if (e.key === 'Escape' && !note) { e.preventDefault(); setOpenNotes(prev => planWith(prev, item.id, undefined)); rowRefs.current.get(item.id)?.querySelector('.huic-rev-icon')?.focus() }
                }
              })
            : !editable && note
              ? jsxs('p', { className: 'huic-rev-note-text', children: [jsx('span', { className: 'huic-sr', children: t(lang, 'reviewComment') + ': ' }), note] })
              : null
        ] }),
        editable
          ? jsxs('div', { className: 'huic-rev-side', children: [
              segment(item, decision),
              jsx('button', {
                type: 'button', className: cx('huic-rev-icon', note && 'has-note'),
                'aria-label': t(lang, 'reviewCommentFor', { x: item.title }), title: t(lang, 'reviewComment'),
                'aria-expanded': noteOpen, 'aria-controls': noteOpen ? noteId : undefined,
                onClick: () => noteButton(item.id, noteOpen),
                children: planIcon('note')
              })
            ] })
          : jsx('div', { className: 'huic-rev-side', children: jsxs('span', {
              className: cx('huic-rev-stamp', decision && `is-${decision}`),
              children: decision
                ? [planIcon(decision === 'keep' ? 'check' : 'cross'), custom ? decisionLabel(decision) : t(lang, decision === 'keep' ? 'reviewKept' : 'reviewDropped')]
                : [t(lang, 'reviewUndecided')]
            }) })
      ]
    }, item.id)
  })

  const send = () => {
    const notes = Object.fromEntries(card.items.map(i => [i.id, (view.notes[i.id] || '').trim()]).filter(([, note]) => note))
    setConfirming(false)
    undo.start({
      keep: keep.map(i => i.id),
      drop: drop.map(i => i.id),
      undecided: card.items.filter(i => !view.decisions[i.id]).map(i => i.id),
      notes
    })
  }
  // Undecided items are sent as "undecided", but only after asking once.
  const apply = () => (open ? setConfirming(true) : send())
  const back = () => { backFocus.current = true; setConfirming(false) }
  const onKeyDown = e => {
    undo.onKeyDown(e)
    if (asking && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); back() }
  }

  const pct = n => `${(n / total) * 100}%`
  const head = jsxs('header', { className: 'huic-pin-head', children: [
    jsxs('div', { children: [
      jsx('h3', { className: 'huic-title', id: labelId, style: { margin: 0 }, children: card.title }),
      card.summary ? jsx('p', { className: 'huic-sub', style: { margin: '2px 0 0' }, children: card.summary }) : null
    ] }),
    jsxs('div', { className: 'huic-rev-tally', children: [
      jsxs('div', { className: 'huic-rev-bar', 'aria-hidden': true, children: [
        jsx('span', { className: 'is-keep', style: { width: pct(keep.length) } }),
        jsx('span', { className: 'is-drop', style: { width: pct(drop.length) } })
      ] }),
      jsxs('div', { className: 'huic-rev-counts', children: [
        jsxs('span', { className: 'is-keep', children: [jsx('i', {}), keepLabel, ' ', jsx('b', { children: keep.length })] }),
        jsxs('span', { className: 'is-drop', children: [jsx('i', {}), dropLabel, ' ', jsx('b', { children: drop.length })] }),
        jsxs('span', { className: 'is-open', children: [jsx('i', {}), t(lang, 'reviewOpen'), ' ', jsx('b', { children: open })] })
      ] })
    ] }),
    editable && total > 1 ? jsxs('div', { className: 'huic-rev-bulk', children: [
      jsx(Btn, { onClick: () => bulk('keep'), children: card.keepLabel ? t(lang, 'reviewAllAs', { x: keepLabel }) : t(lang, 'reviewKeepAll') }),
      jsx(Btn, { onClick: () => bulk('drop'), children: card.dropLabel ? t(lang, 'reviewAllAs', { x: dropLabel }) : t(lang, 'reviewDropAll') }),
      open && open < total ? jsx(Btn, { variant: 'ghost', onClick: keepRest, children: card.keepLabel ? t(lang, 'reviewRestAs', { x: keepLabel, n: open }) : t(lang, 'reviewKeepRest', { n: open }) }) : null,
      changed ? jsx('span', { className: 'huic-rev-reset', children: jsx(Btn, { variant: 'ghost', onClick: reset, children: t(lang, 'reviewReset') }) }) : null
    ] }) : null
  ] })

  const askId = `${labelId}-ask`
  const footer = !ans.showActions ? null
    : undo.pending ? jsx(Footer, { children: jsxs('div', { className: 'huic-rev-pending', role: 'status', 'aria-live': 'polite', children: [jsx('span', { children: t(lang, 'reviewPending', { s: Math.round(undo.pending.ms / 1000) }) }), jsx(Btn, { ref: undo.undoRef, variant: 'ghost', onClick: undo.cancel, children: t(lang, 'planUndo') })] }) })
    : asking
      ? jsxs('div', { className: 'huic-foot huic-rev-ask', role: 'group', 'aria-labelledby': askId, children: [
          jsx('span', { id: askId, className: 'huic-hint huic-rev-ask-text', children: t(lang, 'reviewAskOpen', { n: open }) }),
          jsx(Btn, { variant: 'ghost', onClick: back, children: t(lang, 'reviewBack') }),
          jsx(Btn, { ref: goRef, variant: destructive ? 'danger-outline' : 'primary', onClick: send, children: t(lang, 'reviewSendAnyway') })
        ] })
      : jsx(Footer, {
          hint: open ? t(lang, 'reviewStillOpen', { n: open }) : t(lang, 'reviewAllDecided', { n: total }),
          children: jsx(Btn, { ref: applyRef, variant: destructive ? 'danger-outline' : 'primary', onClick: apply, children: card.applyLabel || t(lang, 'reviewApply') })
        })

  return jsx(PlanFrame, {
    card, display, labelId, frameRef, pinned, css: REVIEW_CSS, head, onKeyDown,
    className: ans.answered && 'is-answered',
    children: [
      jsx('ul', { className: 'huic-rev-list', 'aria-label': t(lang, 'reviewItemsLabel'), children: rows }, 'list'),
      jsx('div', { className: 'huic-sr', role: 'status', 'aria-live': 'polite', children: announce }, 'live')
    ],
    footer,
    after: ans.status
  })
}

CARD_COMPONENTS.review = ReviewCard
REPLY_BUILDERS.review = (card, answer, lang, data) => {
  const ids = new Set(card.items.map(i => i.id))
  data.keep = answer.keep.filter(id => ids.has(id))
  data.drop = answer.drop.filter(id => ids.has(id))
  data.undecided = (answer.undecided || []).filter(id => ids.has(id))
  data.notes = Object.fromEntries(Object.entries(answer.notes || {})
    .map(([id, text]) => [id, String(text ?? '').trim()]).filter(([id, note]) => ids.has(id) && note))
  let summary = t(lang, 'rReview', { keep: data.keep.length, drop: data.drop.length })
  if (data.undecided.length) summary += t(lang, 'rReviewOpen', { n: data.undecided.length })
  // Titles help the model, but only while the whole reply stays under the cap.
  const titles = Object.fromEntries(card.items.map(i => [i.id, i.title]))
  const withTitles = `✓ ${summary}\n${REPLY_TAG} ${JSON.stringify({ ...data, titles })}`
  if ([...withTitles].length <= MAX_REPLY) data.titles = titles
  return { summary }
}
