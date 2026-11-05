Object.assign(STRINGS.en, { compareSource: 'source', compareSources: 'sources', compareChecked: 'Checked', compareNoSources: 'No sources linked', compareUndo: 'Undo', comparePending: 'Picked {title} · sending in {s} s', compareMore: '+{count} more', compareLess: 'Show less', compareBest: 'best', compareBestOf: 'Best of {n}', compareSwitch: 'Compare options', compareYourPick: 'Your pick' })
Object.assign(STRINGS.de, { compareSource: 'Quelle', compareSources: 'Quellen', compareChecked: 'Stand', compareNoSources: 'Ohne verlinkte Quellen', compareUndo: 'Rückgängig', comparePending: 'Gewählt: {title} · wird in {s} s gesendet', compareMore: '+{count} weitere', compareLess: 'Weniger anzeigen', compareBest: 'bester Wert', compareBestOf: 'Bester von {n}', compareSwitch: 'Optionen vergleichen', compareYourPick: 'Deine Wahl' })

// A real table: full-bleed hairline rows, a quiet tinted column for the recommendation,
// a dot for the best value per row, small source chips. Narrow views switch columns.
const COMPARE_CSS = `
.huic[data-card-type="compare"]{max-width:960px}
.huic[data-card-type="compare"] .huic-compare-table{display:grid;grid-template-columns:var(--compare-grid);margin:0 calc(-1 * var(--huic-pad))}
.huic[data-card-type="compare"] .huic-compare-row{display:contents}
.huic[data-card-type="compare"] .huic-compare-cell{min-width:0;padding:9px 12px;border-top:1px solid var(--huic-line);overflow-wrap:anywhere;font-variant-numeric:tabular-nums;line-height:18px}
.huic[data-card-type="compare"] .huic-compare-row>:first-child{padding-left:var(--huic-pad)}
.huic[data-card-type="compare"] .huic-compare-row>:last-child{padding-right:var(--huic-pad)}
.huic[data-card-type="compare"] .huic-compare-row.is-head>*{border-top:0;padding-top:4px;padding-bottom:12px}
.huic[data-card-type="compare"] .huic-compare-row.is-head+.huic-compare-row>*{border-top-color:var(--huic-line-strong)}
.huic[data-card-type="compare"] .huic-compare-row.is-actions>*{padding-top:12px;padding-bottom:0}
.huic[data-card-type="compare"] .huic-compare-label{min-width:84px;color:var(--ui-text-tertiary);font-size:12px;overflow-wrap:break-word;-webkit-hyphens:auto;hyphens:auto}
.huic[data-card-type="compare"] .huic-compare-recommended{background:color-mix(in srgb,var(--huic-accent) 6%,transparent)}
.huic[data-card-type="compare"] .is-head>.huic-compare-recommended{box-shadow:inset 0 2px 0 var(--huic-accent);border-top-left-radius:2px;border-top-right-radius:2px}
.huic[data-card-type="compare"] .is-actions>.huic-compare-recommended{padding-bottom:12px;border-bottom-left-radius:var(--huic-r-md);border-bottom-right-radius:var(--huic-r-md)}
.huic[data-card-type="compare"] .is-actions>.huic-compare-cell{padding-bottom:12px}
.huic[data-card-type="compare"] .huic-compare-name{display:block;font-size:13.5px;font-weight:600;line-height:19px;color:var(--ui-text-primary)}
.huic[data-card-type="compare"] .huic-compare-subtitle{margin-top:2px;color:var(--ui-text-tertiary);font-size:12px;line-height:17px}
.huic[data-card-type="compare"] .huic-compare-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.huic[data-card-type="compare"] .huic-compare-tags:empty{display:none}
.huic[data-card-type="compare"] .huic-compare-head .huic-img{margin-bottom:8px}
.huic[data-card-type="compare"] .huic-compare-best{font-weight:600;color:var(--ui-text-primary)}
.huic[data-card-type="compare"] .huic-compare-dot{display:inline-block;width:6px;height:6px;margin:0 7px 0 0;border-radius:50%;background:var(--huic-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--huic-accent) 18%,transparent);font-size:0;line-height:0;vertical-align:middle;position:relative;top:-1px}
.huic[data-card-type="compare"] .huic-compare-bestof{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.huic[data-card-type="compare"] .huic-compare-yes{color:var(--ui-green,var(--huic-accent));font-weight:600}
.huic[data-card-type="compare"] .huic-compare-none{color:var(--ui-text-quaternary,var(--ui-text-tertiary))}
.huic[data-card-type="compare"] .huic-compare-source{display:inline-flex;align-items:center;gap:3px;max-width:100%;margin:4px 4px 0 0;padding:0 7px;border:1px solid var(--huic-line);border-radius:999px;font-size:11px;line-height:18px;font-weight:400;color:var(--ui-text-tertiary);text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;transition:color .15s,border-color .15s}
.huic[data-card-type="compare"] .huic-compare-tags .huic-compare-source{margin:0}
.huic[data-card-type="compare"] .huic-compare-cell>.huic-compare-source:first-of-type{margin-left:6px}
.huic[data-card-type="compare"] .huic-compare-source:hover{color:var(--huic-accent);border-color:color-mix(in srgb,var(--huic-accent) 40%,transparent)}
.huic[data-card-type="compare"] .huic-compare-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px}
.huic[data-card-type="compare"] .huic-compare-list li{display:flex;gap:6px;margin:0;padding:0}
.huic[data-card-type="compare"] .huic-compare-sign{flex:none;width:10px;font-weight:600}
.huic[data-card-type="compare"] .huic-compare-sign-pros{color:var(--ui-green,var(--huic-accent))}
.huic[data-card-type="compare"] .huic-compare-sign-cons{color:var(--ui-red,var(--ui-text-tertiary))}
.huic[data-card-type="compare"] .huic-compare-more{margin-top:4px;padding:2px 0;border:0;background:transparent;color:var(--huic-accent);cursor:pointer;font:inherit;font-size:12px}
.huic[data-card-type="compare"] .huic-compare-more:hover{text-decoration:underline;text-underline-offset:2px}
.huic[data-card-type="compare"] .is-actions .huic-btn{width:100%}
.huic[data-card-type="compare"] .huic-compare-pick{display:inline-flex;align-items:center;gap:4px}
.huic[data-card-type="compare"] .huic-compare-pick .huic-ico{width:11px;height:11px;stroke-width:2.2}
.huic[data-card-type="compare"] .huic-compare-switch{display:none;gap:2px;padding:2px;border-radius:var(--huic-r-md);background:var(--ui-bg-tertiary,var(--ui-bg-quaternary))}
.huic[data-card-type="compare"] .huic-compare-switch button{flex:1 1 0;min-width:0;min-height:30px;padding:4px 8px;border:0;border-radius:var(--huic-r-sm);background:transparent;color:var(--ui-text-secondary);cursor:pointer;font:inherit;font-size:12.5px;line-height:16px;transition:background .15s,color .15s}
.huic[data-card-type="compare"] .huic-compare-switch button:hover{color:var(--ui-text-primary)}
.huic[data-card-type="compare"] .huic-compare-switch button[aria-checked="true"]{background:var(--ui-chat-surface-background,var(--ui-bg-elevated));color:var(--ui-text-primary);font-weight:600;box-shadow:0 0 0 1px var(--huic-line-strong)}
.huic[data-card-type="compare"] .huic-compare-meta{display:flex;align-items:center;gap:6px;margin:0 calc(-1 * var(--huic-pad));padding:10px var(--huic-pad) 0;border-top:1px solid var(--huic-line);color:var(--ui-text-tertiary);font-size:12px;line-height:16px}
.huic[data-card-type="compare"] .huic-compare-meta svg{flex:none;width:13px;height:13px}
.huic[data-card-type="compare"] .huic-compare-pending{position:relative;overflow:hidden;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-radius:var(--huic-r-md);background:color-mix(in srgb,var(--huic-accent) 8%,transparent);color:var(--ui-text-secondary)}
.huic[data-card-type="compare"] .huic-compare-pending>span:first-child{flex:1;min-width:12em}
.huic[data-card-type="compare"] .huic-compare-drain{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--huic-accent);transform-origin:left;animation:huic-drain var(--undo-ms) linear both}
@keyframes huic-drain{from{transform:scaleX(1)}to{transform:scaleX(0)}}
.huic[data-card-type="compare"] .huic-compare-row:not(.is-head):not(.is-actions):hover>.huic-compare-cell{background-image:linear-gradient(var(--ui-row-hover-background,transparent),var(--ui-row-hover-background,transparent))}
@container (max-width: 560px){
 .huic[data-card-type="compare"] .huic-compare-switch{display:flex}
 .huic[data-card-type="compare"] .huic-compare-table{grid-template-columns:minmax(84px,32%) minmax(0,1fr)}
 .huic[data-card-type="compare"] .huic-compare-cell[data-visible="false"]{display:none}
 .huic[data-card-type="compare"] .huic-compare-cell[data-visible="true"]{padding-right:var(--huic-pad)}
 .huic[data-card-type="compare"] .huic-compare-dot{display:none}
 .huic[data-card-type="compare"] .huic-compare-bestof{position:static;width:auto;height:auto;overflow:visible;clip:auto;display:inline-block;margin:0 0 2px;padding:0 7px;border-radius:999px;background:color-mix(in srgb,var(--huic-accent) 14%,transparent);color:var(--ui-text-primary);font-size:11px;font-weight:600;line-height:18px;letter-spacing:.01em}
 .huic[data-card-type="compare"] .huic-compare-bestof::after{content:"";display:block}
}
`
function compareValue(value) {
  if (value === true) return jsx('span', { className: 'huic-compare-yes', children: '✓' })
  if (value === false || value == null || value === '') return jsx('span', { className: 'huic-compare-none', children: '–' })
  return String(value)
}
function CompareSource({ url, label }) {
  let domain = ''
  try { domain = new URL(url).hostname.replace(/^www\./, '') } catch { return null }
  return jsx('a', { className: 'huic-compare-source', href: url, target: '_blank', rel: 'noopener noreferrer', title: url, onClick: e => {
    if (typeof pluginCtx !== 'undefined' && pluginCtx?.os?.openExternal) { e.preventDefault(); pluginCtx.os.openExternal(url) }
  }, children: '↗ ' + (label || domain) })
}
function CompareCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const submitRef = useRef(ans.submit)
  submitRef.current = ans.submit
  const [selected, setSelected] = useState(() => Math.max(0, card.columns.findIndex(c => c.best)))
  const [expanded, setExpanded] = useState({})
  const [pending, setPending] = useState(null)
  const timer = useRef(null)
  const switchRefs = useRef([])
  const pickRefs = useRef({})
  const undoRef = useRef(null)
  const returnTo = useRef(null)
  const delay = typeof undoDelayMs === 'function' ? undoDelayMs(display) : 4000
  const undo = () => {
    if (!timer.current) return
    clearTimeout(timer.current); timer.current = null
    returnTo.current = pending?.id ?? null
    setPending(null)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  // Focus follows the pick: to Undo while it can be taken back, then back to its Choose button.
  useEffect(() => {
    if (pending) undoRef.current?.focus()
    else if (returnTo.current != null) { pickRefs.current[returnTo.current]?.focus(); returnTo.current = null }
  }, [pending])
  // Escape only cancels this card's pick, and only from inside the card.
  const onKeyDown = e => {
    if (pending && e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); undo() }
  }
  const pick = column => {
    if (timer.current) return
    if (!delay) return void ans.submit({ selected: column.id })
    setPending(column)
    timer.current = setTimeout(() => { timer.current = null; setPending(null); submitRef.current({ selected: column.id }) }, delay)
  }
  const picked = ans.answer?.selection?.selected
  // The tinted wash marks the recommendation until there is a pick, then moves to the pick
  // (the recommendation keeps only its badge).
  const chosenId = pending ? pending.id : picked
  const washed = column => (chosenId !== undefined ? chosenId === column.id : Boolean(column.best))
  const cell = (column, i, content, extra = '', role = 'cell') => jsx('div', { role, className: cx('huic-compare-cell', washed(column) && 'huic-compare-recommended', extra), 'data-visible': i === selected ? 'true' : 'false', children: content }, column.id || i)
  const row = (label, contents, key, kind) => jsxs('div', { role: 'row', className: cx('huic-compare-row', kind && `is-${kind}`), children: [jsx('div', { role: label ? 'rowheader' : 'cell', className: 'huic-compare-cell huic-compare-label', children: label }), ...contents] }, key)
  const urls = new Set(card.columns.map(c => c.source?.url).concat((card.rows || []).flatMap(r => r.sources || [])).filter(Boolean))
  const head = c => jsxs('div', { className: 'huic-compare-head', children: [
    c.image ? jsx(CardImage, { src: c.image }) : null,
    jsx('strong', { className: 'huic-compare-name', children: c.title }),
    c.subtitle ? jsx('div', { className: 'huic-compare-subtitle', children: c.subtitle }) : null,
    jsxs('div', { className: 'huic-compare-tags', children: [
      picked !== undefined && picked === c.id ? jsxs('span', { className: 'huic-badge huic-best huic-compare-pick', children: [jsx(Icon, { name: 'check' }), t(lang, 'compareYourPick')] }) : null,
      c.best ? jsx('span', { className: 'huic-badge huic-best', children: '★ ' + t(lang, 'recommended') }) : null,
      // The model often writes "Recommended" as the badge of its best column too: show it once.
      c.badge && !(c.best && /^\W*(recommended|empfehlung|empfohlen|best pick|top pick)\W*$/i.test(c.badge)) ? jsx('span', { className: 'huic-badge', title: c.badge, children: c.badge }) : null,
      c.source ? jsx(CompareSource, { url: c.source.url, label: c.source.label }) : null
    ] })
  ] })
  const rows = [row('', card.columns.map((c, i) => cell(c, i, head(c), '', 'columnheader')), 'header', 'head')]
  for (const [ri, r] of (card.rows || []).entries()) rows.push(row(r.label, card.columns.map((c, i) => cell(c, i, jsxs(Fragment, { children: [
    // Wide: a dot beside the best value. Narrow (one column at a time) a dot means nothing,
    // so it becomes a short "Best of 3"; screen readers always get that text.
    r.best === i ? jsx('span', { className: 'huic-compare-dot', 'aria-hidden': true }) : null,
    r.best === i ? jsx('span', { className: 'huic-compare-bestof', children: t(lang, 'compareBestOf', { n: card.columns.length }) }) : null,
    compareValue(r.values[i]),
    r.sources?.[i] ? jsx(CompareSource, { url: r.sources[i] }) : null
  ] }), r.best === i ? 'huic-compare-best' : '')), `row${ri}`))
  for (const kind of ['pros', 'cons']) if (card.columns.some(c => c[kind]?.length)) rows.push(row(t(lang, kind), card.columns.map((c, i) => {
    const items = c[kind] || [], key = `${kind}-${i}`, more = expanded[key]
    return cell(c, i, items.length ? jsxs(Fragment, { children: [
      jsx('ul', { className: 'huic-compare-list', children: items.slice(0, more ? items.length : 2).map((v, j) => jsxs('li', { children: [
        jsx('span', { className: `huic-compare-sign huic-compare-sign-${kind}`, 'aria-hidden': true, children: kind === 'pros' ? '+' : '–' }),
        jsx('span', { children: v })
      ] }, j)) }),
      items.length > 2 ? jsx('button', { type: 'button', className: 'huic-compare-more', 'aria-expanded': !!more, onClick: () => setExpanded({ ...expanded, [key]: !more }), children: more ? t(lang, 'compareLess') : t(lang, 'compareMore', { count: items.length - 2 }) }) : null
    ] }) : compareValue(null))
  }), kind))
  if (ans.showActions && !pending) rows.push(row('', card.columns.map((c, i) => cell(c, i, jsx(Btn, { ref: el => { pickRefs.current[c.id] = el }, variant: c.best ? 'primary' : 'secondary', onClick: () => pick(c), label: `${card.selectLabel || t(lang, 'pick')}: ${c.title}`, children: card.selectLabel || t(lang, 'pick') }))), 'actions', 'actions'))
  const switcher = jsx('div', { className: 'huic-compare-switch', role: 'radiogroup', 'aria-label': t(lang, 'compareSwitch'), children: card.columns.map((c, i) => jsx('button', {
    type: 'button', role: 'radio', 'aria-checked': i === selected, tabIndex: i === selected ? 0 : -1,
    ref: el => { switchRefs.current[i] = el },
    onClick: () => setSelected(i),
    onKeyDown: e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      e.preventDefault()
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + card.columns.length) % card.columns.length
      setSelected(next)
      switchRefs.current[next]?.focus()
    },
    children: c.title
  }, c.id || i)) })
  const pendingBar = pending ? jsxs('div', { className: 'huic-compare-pending', role: 'status', 'aria-live': 'polite', style: { '--undo-ms': `${delay}ms` }, children: [
    jsx('span', { children: jsx(Countdown, { ms: delay, say: s => t(lang, 'comparePending', { title: pending.title, s }) }) }),
    jsx(Btn, { ref: undoRef, variant: 'ghost', onClick: undo, children: t(lang, 'compareUndo') }),
    jsx('span', { className: 'huic-compare-drain', 'aria-hidden': true })
  ] }) : null
  const meta = jsxs('div', { className: 'huic-compare-meta', children: [
    jsxs('svg', { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, 'aria-hidden': true, children: urls.size
      ? [jsx('path', { d: 'M6.5 9.5 9.5 6.5M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1', strokeLinecap: 'round' }, 'l')]
      : [jsx('circle', { cx: 8, cy: 8, r: 6.25 }, 'c'), jsx('path', { d: 'M8 7.25v3.5M8 5.1v.1', strokeLinecap: 'round' }, 'p')] }),
    jsx('span', { children: urls.size ? [card.asOf ? t(lang, 'compareChecked') + ' ' + card.asOf + ' · ' : '', `${urls.size} ${t(lang, urls.size === 1 ? 'compareSource' : 'compareSources')}`] : t(lang, 'compareNoSources') })
  ] })
  return jsx('div', { onKeyDown, children: jsx(Shell, { card, display, labelId, title: card.title, after: ans.status, children: jsxs(Fragment, { children: [
    jsx('style', { children: COMPARE_CSS }),
    switcher,
    jsx('div', { role: 'table', className: 'huic-compare-table', 'aria-label': card.title || 'Compare', style: { '--compare-grid': `fit-content(32%) repeat(${card.columns.length}, minmax(0, 1fr))` }, children: rows }),
    pendingBar,
    meta
  ] }) }) })
}
