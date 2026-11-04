Object.assign(STRINGS.en, { compareSources: 'sources', compareChecked: 'Prices checked', compareNoSources: "From the model’s knowledge, no web sources", compareUndo: 'Undo', comparePending: 'Picked {title} · sending in 4 s', compareMore: '+{count} more', compareLess: 'Show less', compareBest: 'best', compareSwitch: 'Compare options' })
Object.assign(STRINGS.de, { compareSources: 'Quellen', compareChecked: 'Preise geprüft', compareNoSources: 'Aus dem Wissen des Modells, ohne Webquellen', compareUndo: 'Rückgängig', comparePending: 'Gewählt: {title} · wird in 4 s gesendet', compareMore: '+{count} weitere', compareLess: 'Weniger anzeigen', compareBest: 'bester Wert', compareSwitch: 'Optionen vergleichen' })

const COMPARE_CSS = `
.huic[data-card-type="compare"] { max-width: 960px; container-type: inline-size; }
.huic[data-card-type="compare"] .huic-compare-table { display: grid; grid-template-columns: var(--compare-grid); }
.huic[data-card-type="compare"] .huic-compare-row { display: contents; }
.huic[data-card-type="compare"] .huic-compare-cell { min-width: 0; padding: 12px; border-bottom: 1px solid var(--ui-border); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.huic[data-card-type="compare"] .huic-compare-label { color: var(--ui-text-secondary); font-size: 12px; }
.huic[data-card-type="compare"] .huic-compare-recommended { background: color-mix(in srgb, var(--huic-accent) 8%, transparent); }
.huic[data-card-type="compare"] .huic-compare-best { color: var(--huic-accent); font-weight: 600; }
.huic[data-card-type="compare"] .huic-compare-source { display: inline-block; margin: 4px 0 0 4px; font-size: 11px; color: var(--ui-text-secondary); text-decoration: underline; }
.huic[data-card-type="compare"] .huic-compare-source:hover { color: var(--huic-accent); }
.huic[data-card-type="compare"] .huic-compare-switch { display: none; gap: 4px; margin-bottom: 10px; }
.huic[data-card-type="compare"] .huic-compare-switch button, .huic[data-card-type="compare"] .huic-compare-more { border: 0; background: transparent; color: var(--huic-accent); cursor: pointer; font: inherit; }
.huic[data-card-type="compare"] .huic-compare-switch button { padding: 6px 10px; border-radius: 6px; }
.huic[data-card-type="compare"] .huic-compare-switch button[aria-checked="true"] { background: color-mix(in srgb, var(--huic-accent) 15%, transparent); font-weight: 600; }
.huic[data-card-type="compare"] button:focus-visible, .huic[data-card-type="compare"] a:focus-visible { outline: 2px solid var(--huic-accent); outline-offset: 2px; }
.huic[data-card-type="compare"] .huic-compare-list { margin: 0; padding: 0; list-style: none; }
.huic[data-card-type="compare"] .huic-compare-footer { color: var(--ui-text-secondary); font-size: 12px; padding: 10px 12px 0; }
.huic[data-card-type="compare"] .huic-compare-pending { padding: 12px; color: var(--ui-text-secondary); }
@container (max-width: 560px) {
 .huic[data-card-type="compare"] .huic-compare-switch { display: flex; }
 .huic[data-card-type="compare"] .huic-compare-table { grid-template-columns: minmax(90px, max-content) minmax(0, 1fr); }
 .huic[data-card-type="compare"] .huic-compare-cell[data-visible="false"] { display: none; }
}
`
function displayValue(value) {
  if (value === true) return '✓'
  if (value === false || value == null || value === '') return '–'
  return String(value)
}
function CompareSource({ url, label }) {
  let domain = ''
  try { domain = new URL(url).hostname } catch { return null }
  return jsx('a', { className: 'huic-compare-source', href: url, target: '_blank', rel: 'noopener noreferrer', onClick: e => {
    if (typeof pluginCtx !== 'undefined' && pluginCtx?.os?.openExternal) { e.preventDefault(); pluginCtx.os.openExternal(url) }
  }, children: '↗ ' + (label || domain) })
}
function CompareCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const [selected, setSelected] = useState(() => Math.max(0, card.columns.findIndex(c => c.best)))
  const [expanded, setExpanded] = useState({})
  const [pending, setPending] = useState(null)
  const timer = useRef(null)
  const switchRefs = useRef([])
  const undo = () => { clearTimeout(timer.current); timer.current = null; setPending(null) }
  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (!pending) return
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); undo() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending])
  const pick = column => {
    if (timer.current) return
    setPending(column)
    timer.current = setTimeout(() => { timer.current = null; setPending(null); ans.submit({ selected: column.id }) }, 4000)
  }
  const cell = (column, i, content, extra = '') => jsx('div', { role: 'cell', className: cx('huic-compare-cell', column.best && 'huic-compare-recommended', extra), 'data-visible': i === selected ? 'true' : 'false', children: content }, column.id || i)
  const row = (label, contents, key) => jsxs('div', { role: 'row', className: 'huic-compare-row', children: [jsx('div', { role: 'rowheader', className: 'huic-compare-cell huic-compare-label', children: label }), ...contents] }, key)
  const urls = new Set(card.columns.map(c => c.source?.url).concat((card.rows || []).flatMap(r => r.sources || [])).filter(Boolean))
  const rows = [row('', card.columns.map((c, i) => cell(c, i, jsxs('div', { children: [c.image ? jsx(CardImage, { src: c.image }) : null, jsx('strong', { children: c.title }), c.subtitle ? jsx('div', { className: 'huic-opt-desc', children: c.subtitle }) : null, c.badge ? jsx('div', { className: 'huic-badge', children: c.badge }) : null, c.best ? jsx('div', { className: 'huic-badge huic-best', children: '★ ' + t(lang, 'recommended') }) : null, c.source ? jsx('div', { children: jsx(CompareSource, { url: c.source.url, label: c.source.label }) }) : null] }))), 'header')]
  for (const [ri, r] of (card.rows || []).entries()) rows.push(row(r.label, card.columns.map((c, i) => cell(c, i, jsxs(Fragment, { children: [r.best === i ? jsx('span', { 'aria-label': t(lang, 'compareBest'), children: '● ' }) : null, displayValue(r.values[i]), r.sources?.[i] ? jsx(CompareSource, { url: r.sources[i] }) : null] }), r.best === i ? 'huic-compare-best' : '')), `row${ri}`))
  for (const kind of ['pros', 'cons']) if (card.columns.some(c => c[kind]?.length)) rows.push(row(t(lang, kind), card.columns.map((c, i) => {
    const items = c[kind] || [], key = `${kind}-${i}`, more = expanded[key]
    return cell(c, i, jsxs(Fragment, { children: [jsx('ul', { className: 'huic-compare-list', children: items.slice(0, more ? items.length : 2).map((v, j) => jsx('li', { children: (kind === 'pros' ? '+ ' : '– ') + v }, j)) }), items.length > 2 ? jsx('button', { type: 'button', className: 'huic-compare-more', 'aria-expanded': !!more, onClick: () => setExpanded({ ...expanded, [key]: !more }), children: more ? t(lang, 'compareLess') : t(lang, 'compareMore', { count: items.length - 2 }) }) : null] }))
  }), kind))
  if (ans.showActions && !pending) rows.push(row('', card.columns.map((c, i) => cell(c, i, jsx(Btn, { variant: c.best ? 'primary' : 'secondary', onClick: () => pick(c), label: `${card.selectLabel || t(lang, 'pick')}: ${c.title}`, children: card.selectLabel || t(lang, 'pick') }))), 'actions'))
  return jsx(Shell, { card, display, labelId, title: card.title, after: ans.status, children: jsxs(Fragment, { children: [jsx('style', { children: COMPARE_CSS }), jsx('div', { className: 'huic-compare-switch', role: 'radiogroup', 'aria-label': t(lang, 'compareSwitch'), children: card.columns.map((c, i) => jsx('button', { type: 'button', role: 'radio', 'aria-checked': i === selected, tabIndex: i === selected ? 0 : -1, ref: el => { switchRefs.current[i] = el }, onClick: () => setSelected(i), onKeyDown: e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + card.columns.length) % card.columns.length; setSelected(next); switchRefs.current[next]?.focus() } }, children: c.title }, c.id || i)) }), jsx('div', { role: 'table', className: 'huic-compare-table', 'aria-label': card.title || 'Compare', style: { '--compare-grid': `minmax(90px, max-content) repeat(${card.columns.length}, minmax(0, 1fr))` }, children: rows }), pending ? jsxs('div', { className: 'huic-compare-pending', role: 'status', 'aria-live': 'polite', children: [t(lang, 'comparePending', { title: pending.title }), ' · ', jsx('button', { type: 'button', className: 'huic-compare-more', onClick: undo, children: t(lang, 'compareUndo') })] }) : null, jsx('div', { className: 'huic-compare-footer', children: urls.size ? [card.asOf ? t(lang, 'compareChecked') + ' ' + card.asOf + ' · ' : '', `${urls.size} ${t(lang, 'compareSources')}`] : t(lang, 'compareNoSources') })] }) })
}
