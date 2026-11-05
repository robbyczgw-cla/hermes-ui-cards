// rank: put items in order. Drag the grip, press Alt+↑/↓, or use the move buttons; every move is announced.

Object.assign(STRINGS.en, {
  rankList: 'Your order',
  rankMoveUp: 'Move {x} up',
  rankMoveDown: 'Move {x} down',
  rankMoved: '{x} moved to position {n} of {total}.',
  rankGrabbed: 'Dragging {x}. Position {n} of {total}.',
  rankRank: 'Position {n} of {total}',
  rankHint: 'Drag to reorder', rankKeys: '[Alt]+[↑]/[↓] to move',
  rankSend: 'Send order',
  rankReset: 'Reset order',
  rRanked: 'My order: {x}'
})
Object.assign(STRINGS.de, {
  rankList: 'Deine Reihenfolge',
  rankMoveUp: '{x} nach oben',
  rankMoveDown: '{x} nach unten',
  rankMoved: '{x} auf Platz {n} von {total}.',
  rankGrabbed: '{x} wird verschoben. Platz {n} von {total}.',
  rankRank: 'Platz {n} von {total}',
  rankHint: 'Zum Umordnen ziehen', rankKeys: '[Alt]+[↑]/[↓] zum Verschieben',
  rankSend: 'Reihenfolge senden',
  rankReset: 'Zurücksetzen',
  rRanked: 'Meine Reihenfolge: {x}'
})

const RANK_CSS = `
.huic[data-card-type="rank"] .huic-rank-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.huic[data-card-type="rank"] .huic-rank-item{position:relative;display:flex;align-items:center;gap:10px;margin:0;padding:8px 8px 8px 6px;border:1px solid var(--ui-stroke-tertiary);border-radius:10px;background:var(--ui-chat-surface-background,var(--ui-base,Canvas));transition:border-color .12s,box-shadow .12s}
.huic[data-card-type="rank"] .huic-rank-item:focus-within{border-color:var(--ui-stroke-secondary)}
.huic[data-card-type="rank"] .huic-rank-item.huic-rank-drag{z-index:2;border-color:var(--huic-accent);box-shadow:0 6px 18px color-mix(in srgb,var(--ui-text-primary) 18%,transparent);transition:none}
.huic[data-card-type="rank"] .huic-rank-grip{flex:none;display:grid;place-items:center;width:22px;align-self:stretch;margin:-2px 0;border-radius:6px;color:var(--ui-text-quaternary,var(--ui-text-tertiary));cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.huic[data-card-type="rank"] .huic-rank-grip:hover{color:var(--ui-text-secondary);background:var(--ui-control-hover-background)}
.huic[data-card-type="rank"] .huic-rank-drag .huic-rank-grip{cursor:grabbing}
.huic[data-card-type="rank"] .huic-rank-grip svg{width:12px;height:16px}
.huic[data-card-type="rank"] .huic-rank-pos{flex:none;display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:50%;background:var(--ui-bg-quaternary);color:var(--ui-text-secondary);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
.huic[data-card-type="rank"] .huic-rank-item[data-pos="1"] .huic-rank-pos{background:var(--huic-accent);color:var(--huic-on-accent)}
.huic[data-card-type="rank"] .huic-rank-text{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1}
.huic[data-card-type="rank"] .huic-rank-label{font-weight:500}
.huic[data-card-type="rank"] .huic-rank-detail{color:var(--ui-text-tertiary);font-size:12px}
.huic[data-card-type="rank"] .huic-rank-moves{flex:none;display:flex;flex-direction:column;gap:2px;opacity:0;transition:opacity .12s}
.huic[data-card-type="rank"] .huic-rank-item:hover .huic-rank-moves,.huic[data-card-type="rank"] .huic-rank-item:focus-within .huic-rank-moves,.huic[data-card-type="rank"] .huic-rank-drag .huic-rank-moves{opacity:1}
@media (hover:none){.huic[data-card-type="rank"] .huic-rank-moves{opacity:1}}
.huic[data-card-type="rank"] .huic-rank-move{display:grid;place-items:center;width:28px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--ui-text-secondary);cursor:pointer}
.huic[data-card-type="rank"] .huic-rank-move:hover:not([aria-disabled="true"]){background:var(--ui-control-hover-background);color:var(--ui-text-primary)}
.huic[data-card-type="rank"] .huic-rank-move[aria-disabled="true"]{opacity:.3;cursor:default}
.huic[data-card-type="rank"] .huic-rank-move svg{width:12px;height:12px}
.huic[data-card-type="rank"] .huic-rank-locked .huic-rank-item{padding-left:10px}
@container (max-width: 440px){
  .huic[data-card-type="rank"] .huic-rank-item{gap:8px}
  .huic[data-card-type="rank"] .huic-rank-move{width:32px;height:24px}
}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="rank"] .huic-rank-item{transition:none !important}}
`

// A saved or sent order must be a permutation of the card's items; anything else falls back to the card order.
function rankCleanOrder(card, order) {
  const ids = card.items.map(i => i.id)
  if (Array.isArray(order) && order.length === ids.length && ids.every(id => order.includes(id)) && new Set(order).size === ids.length) return [...order]
  return ids
}

function rankMoved(order, id, to) {
  const from = order.indexOf(id)
  if (from < 0 || to < 0 || to >= order.length || from === to) return order
  const next = order.filter(x => x !== id)
  next.splice(to, 0, id)
  return next
}

function RankChevron({ down }) {
  return jsx('svg', {
    viewBox: '0 0 12 12', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, 'aria-hidden': true,
    children: jsx('path', { d: down ? 'm2.5 4.5 3.5 3.5 3.5-3.5' : 'm2.5 7.5 3.5-3.5 3.5 3.5', strokeLinecap: 'round', strokeLinejoin: 'round' })
  })
}

function RankCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [order, setOrder] = useState(() => rankCleanOrder(card, ans.draft?.order))
  const shown = sent ? rankCleanOrder(card, sent.order) : order
  const byId = useMemo(() => new Map(card.items.map(i => [i.id, i])), [card])
  const [announce, setAnnounce] = useState('')
  const [dragId, setDragId] = useState(null)
  const rowRefs = useRef(new Map())
  const lastTops = useRef(new Map())
  const focusReq = useRef(null)
  const drag = useRef(null)
  const interactive = !ans.locked

  const apply = (next, id, message) => {
    if (next === order) return
    setOrder(next)
    ans.saveDraft({ order: next })
    if (message) setAnnounce(t(lang, 'rankMoved', { x: byId.get(id).label, n: next.indexOf(id) + 1, total: next.length }))
  }
  const moveTo = (id, to, e) => {
    const next = rankMoved(order, id, to)
    if (next === order) return
    const active = typeof document !== 'undefined' ? document.activeElement : null
    if (e && e.currentTarget && e.currentTarget.contains && e.currentTarget.contains(active)) {
      focusReq.current = { id, move: active.getAttribute && active.getAttribute('data-move') }
    }
    apply(next, id, true)
  }
  const onKeyDown = (e, id) => {
    if (!interactive || !e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return
    const index = order.indexOf(id)
    const to = e.key === 'ArrowUp' ? index - 1 : e.key === 'ArrowDown' ? index + 1 : e.key === 'Home' ? 0 : e.key === 'End' ? order.length - 1 : null
    if (to === null) return
    e.preventDefault()
    moveTo(id, to, e)
  }

  // Keep keyboard focus on the same button after the row moved (React may re-insert the node).
  // FLIP: other rows glide to their new place (skipped for reduced motion, and for the row under the pointer).
  const orderKey = shown.join(',')
  useEffect(() => {
    const req = focusReq.current
    focusReq.current = null
    if (req) {
      const row = rowRefs.current.get(req.id)
      const target = row && (row.querySelector(`[data-move="${req.move}"]`) || row.querySelector('[data-move]'))
      if (target && document.activeElement !== target) target.focus()
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map()
    for (const [id, el] of rowRefs.current) {
      if (!el || (drag.current && drag.current.id === id)) continue
      const top = el.getBoundingClientRect().top
      next.set(id, top)
      const before = lastTops.current.get(id)
      if (!reduce && before !== undefined && Math.abs(before - top) > 1 && typeof el.animate === 'function') {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], { duration: 180, easing: 'ease-out' })
      }
    }
    lastTops.current = next
    place()
  }, [orderKey])

  // Pointer drag on the grip: the row follows the pointer, the others make room.
  const place = () => {
    const d = drag.current
    const el = d && rowRefs.current.get(d.id)
    if (!el) return
    el.style.transform = 'none'
    const natural = el.getBoundingClientRect().top
    el.style.transform = `translateY(${d.y - d.grab - natural}px)`
  }
  // The drag listens on the window, not on the grip: React moves the row's DOM node while it is dragged, which
  // releases pointer capture, and a release outside the grip must still end the drag.
  const live = useRef(null)
  const stopListening = useRef(null)
  const dragStart = (e, id) => {
    if (!interactive || drag.current || (e.button !== undefined && e.button !== 0)) return
    const el = rowRefs.current.get(id)
    if (!el) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable: window listeners still follow the pointer */ }
    drag.current = { id, grab: e.clientY - el.getBoundingClientRect().top, y: e.clientY }
    const mine = ev => ev.pointerId === undefined || e.pointerId === undefined || ev.pointerId === e.pointerId
    const onMove = ev => {
      if (!mine(ev)) return
      if (ev.pointerType === 'mouse' && ev.buttons === 0) live.current.end() // released where no event reached us
      else live.current.move(ev)
    }
    const onEnd = ev => { if (mine(ev)) live.current.end() }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    stopListening.current = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      stopListening.current = null
    }
    setDragId(id)
    setAnnounce(t(lang, 'rankGrabbed', { x: byId.get(id).label, n: order.indexOf(id) + 1, total: order.length }))
    e.preventDefault()
  }
  const dragMove = e => {
    const d = drag.current
    if (!d) return
    d.y = e.clientY
    let to = 0
    for (const id of order) {
      if (id === d.id) continue
      const r = rowRefs.current.get(id).getBoundingClientRect()
      if (d.y > r.top + r.height / 2) to++
    }
    const next = rankMoved(order, d.id, to)
    if (next !== order) apply(next, d.id, false)
    else place()
  }
  const dragEnd = () => {
    const d = drag.current
    if (stopListening.current) stopListening.current()
    if (!d) return
    drag.current = null
    const el = rowRefs.current.get(d.id)
    if (el) el.style.transform = ''
    setDragId(null)
    setAnnounce(t(lang, 'rankMoved', { x: byId.get(d.id).label, n: order.indexOf(d.id) + 1, total: order.length }))
  }
  live.current = { move: dragMove, end: dragEnd }
  // Leaving mid-drag (answered elsewhere, card removed): no listener stays behind.
  useEffect(() => () => { if (stopListening.current) stopListening.current(); drag.current = null }, [])
  // A card that becomes locked while a drag is running ends it too.
  useEffect(() => { if (!interactive && drag.current) dragEnd() }, [interactive])

  const changed = shown.some((id, i) => id !== card.items[i].id)
  const send = () => ans.submit({ order, labels: order.map(id => byId.get(id).label) })

  return jsx(Shell, {
    card, display, labelId, title: card.title, subtitle: card.prompt,
    children: [
      jsx('style', { children: RANK_CSS }),
      jsx('ol', {
        className: cx('huic-rank-list', !interactive && 'huic-rank-locked'),
        'aria-label': t(lang, 'rankList'),
        children: shown.map((id, i) => {
          const item = byId.get(id)
          return jsxs('li', {
            ref: el => { if (el) rowRefs.current.set(id, el); else rowRefs.current.delete(id) },
            className: cx('huic-rank-item', dragId === id && 'huic-rank-drag'),
            'data-pos': i + 1,
            onKeyDown: e => onKeyDown(e, id),
            children: [
              interactive ? jsx('div', {
                className: 'huic-rank-grip', 'aria-hidden': true,
                onPointerDown: e => dragStart(e, id),
                children: jsx('svg', {
                  viewBox: '0 0 12 16', fill: 'currentColor',
                  children: [3, 8, 13].flatMap(y => [3, 9].map(x => jsx('circle', { cx: x, cy: y, r: 1.3 }, `${x}-${y}`)))
                })
              }) : null,
              jsx('span', { className: 'huic-rank-pos', 'aria-hidden': true, children: i + 1 }),
              jsxs('span', { className: 'huic-rank-text', children: [
                jsx('span', { className: 'huic-rank-label', children: item.label }),
                item.detail ? jsx('span', { className: 'huic-rank-detail', children: item.detail }) : null
              ] }),
              interactive ? jsxs('span', { className: 'huic-rank-moves', children: [
                jsx('button', {
                  type: 'button', className: 'huic-rank-move', 'data-move': 'up',
                  'aria-label': t(lang, 'rankMoveUp', { x: item.label }), 'aria-disabled': i === 0 ? 'true' : undefined,
                  onClick: e => { if (i > 0) moveTo(id, i - 1, e) },
                  children: jsx(RankChevron, {})
                }),
                jsx('button', {
                  type: 'button', className: 'huic-rank-move', 'data-move': 'down',
                  'aria-label': t(lang, 'rankMoveDown', { x: item.label }), 'aria-disabled': i === shown.length - 1 ? 'true' : undefined,
                  onClick: e => { if (i < shown.length - 1) moveTo(id, i + 1, e) },
                  children: jsx(RankChevron, { down: true })
                })
              ] }) : null,
              jsx('span', { className: 'huic-sr', children: t(lang, 'rankRank', { n: i + 1, total: shown.length }) })
            ]
          }, id)
        })
      }),
      jsx('div', { className: 'huic-sr', role: 'status', 'aria-live': 'polite', children: announce })
    ],
    footer: ans.showActions ? jsx(Footer, {
      hint: t(lang, 'rankHint'),
      keys: t(lang, 'rankKeys'),
      children: jsxs(Fragment, { children: [
        changed ? jsx(Btn, { variant: 'ghost', onClick: () => { const next = card.items.map(i => i.id); setOrder(next); ans.saveDraft({ order: next }); setAnnounce('') }, children: t(lang, 'rankReset') }) : null,
        jsx(Btn, { variant: 'primary', onClick: send, children: card.submitLabel || t(lang, 'rankSend') })
      ] })
    }) : null,
    after: ans.status
  })
}

REPLY_BUILDERS.rank = (card, answer, lang, data) => {
  const byId = new Map(card.items.map(i => [i.id, i]))
  const order = rankCleanOrder(card, answer.order)
  data.order = order
  data.labels = order.map(id => byId.get(id).label)
  const labels = data.labels.slice(0, 5).map((x, i) => `${i + 1}. ${clip(x, 30)}`)
  const sep = labels.some(x => /,\s/.test(x)) ? '; ' : ', '
  return { mark: '✓', summary: t(lang, 'rRanked', { x: labels.join(sep) + (data.labels.length > 5 ? `${sep}…` : '') }) }
}
CARD_COMPONENTS.rank = RankCard
