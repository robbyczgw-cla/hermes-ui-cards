// decision: weight the criteria, watch the options re-rank live, then pick one or send the weights.

Object.assign(STRINGS.en, {
  decCriteria: 'What matters to you',
  decRanking: 'Ranking',
  decWeight: 'Weight {n} of 10',
  decLeader: 'Leader',
  decTied: 'Tied',
  decTiedNote: 'Tied at the top for these weights',
  decScoreOf: 'Score {s} of 10',
  decRankOf: 'Rank {n} of {total}',
  decNoWeights: 'All weights are 0. Raise at least one to rank.',
  decHint: 'Move the sliders and the ranking updates. Tap an option to pick it.',
  decSendWeights: 'Send weights',
  decChoose: 'Choose {x}',
  decPicked: 'Picked',
  decReset: 'Reset weights',
  rDecision: 'Decision: {a} ({as}) ahead of {b} ({bs})',
  rDecisionPicked: 'Picked: {x} ({s})',
  rDecisionTie: 'Tie: {a} and {b} ({s})',
  rDecisionTieMore: 'Tie: {a}, {b} and {n} more ({s})',
  rDecisionNone: 'No weights set'
})
Object.assign(STRINGS.de, {
  decCriteria: 'Was dir wichtig ist',
  decRanking: 'Rangfolge',
  decWeight: 'Gewicht {n} von 10',
  decLeader: 'Vorn',
  decTied: 'Gleichauf',
  decTiedNote: 'Mit diesen Gewichten gleichauf an der Spitze',
  decScoreOf: 'Wert {s} von 10',
  decRankOf: 'Platz {n} von {total}',
  decNoWeights: 'Alle Gewichte sind 0. Erhöhe mindestens eines, um zu ordnen.',
  decHint: 'Verschiebe die Regler, die Rangfolge passt sich an. Tippe eine Option an, um sie zu wählen.',
  decSendWeights: 'Gewichte senden',
  decChoose: '{x} wählen',
  decPicked: 'Gewählt',
  decReset: 'Gewichte zurücksetzen',
  rDecision: 'Entscheidung: {a} ({as}) vor {b} ({bs})',
  rDecisionPicked: 'Gewählt: {x} ({s})',
  rDecisionTie: 'Gleichauf: {a} und {b} ({s})',
  rDecisionTieMore: 'Gleichauf: {a}, {b} und {n} weitere ({s})',
  rDecisionNone: 'Keine Gewichte gesetzt'
})

const DECISION_CSS = `
.huic[data-card-type="decision"] .huic-dec-section{margin:0;padding:0;border:0;display:flex;flex-direction:column;gap:2px;min-width:0}
.huic[data-card-type="decision"] .huic-dec-h{margin:0 0 4px;padding:0;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-tertiary)}
.huic[data-card-type="decision"] .huic-dec-crit{display:grid;grid-template-columns:minmax(0,11fr) minmax(0,12fr) 3ch;align-items:center;gap:4px 12px;padding:4px 0}
.huic[data-card-type="decision"] .huic-dec-crit-label{font-weight:500;min-width:0}
.huic[data-card-type="decision"] .huic-dec-crit-val{white-space:nowrap;font-weight:600;font-variant-numeric:tabular-nums;text-align:right;color:var(--huic-accent)}
.huic[data-card-type="decision"] .huic-dec-range{-webkit-appearance:none;appearance:none;display:block;width:100%;height:6px;margin:8px 0;padding:0;border-radius:999px;background:linear-gradient(to right,var(--huic-accent) var(--fill),var(--ui-bg-quaternary) var(--fill));accent-color:var(--huic-accent);cursor:pointer}
.huic[data-card-type="decision"] .huic-dec-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:var(--huic-accent);border:3px solid var(--ui-chat-surface-background,var(--ui-base,Canvas));box-shadow:0 0 0 1px var(--huic-accent);transition:transform .1s}
.huic[data-card-type="decision"] .huic-dec-range::-moz-range-thumb{width:12px;height:12px;border-radius:50%;background:var(--huic-accent);border:3px solid var(--ui-chat-surface-background,var(--ui-base,Canvas));box-shadow:0 0 0 1px var(--huic-accent)}
.huic[data-card-type="decision"] .huic-dec-range::-moz-range-track{background:transparent}
.huic[data-card-type="decision"] .huic-dec-range:hover:not(:disabled)::-webkit-slider-thumb{transform:scale(1.12)}
.huic[data-card-type="decision"] .huic-dec-range:disabled{cursor:default}
.huic[data-card-type="decision"] .huic-dec-range:focus-visible{outline-offset:6px}
.huic[data-card-type="decision"] .huic-dec-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.huic[data-card-type="decision"] .huic-dec-list>li{margin:0;padding:0;display:block}
.huic[data-card-type="decision"] .huic-dec-opt{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:2px 10px;width:100%;padding:9px 11px;border-radius:10px;border:1px solid var(--ui-stroke-tertiary);background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .12s,border-color .12s}
.huic[data-card-type="decision"] .huic-dec-opt:hover:not([disabled]){background:var(--ui-control-hover-background)}
.huic[data-card-type="decision"] .huic-dec-opt[disabled]{cursor:default}
.huic[data-card-type="decision"] .huic-dec-opt[aria-pressed="true"]{border-color:var(--huic-accent);background:color-mix(in srgb,var(--huic-accent) 10%,transparent)}
.huic[data-card-type="decision"] .huic-dec-lead{border-color:color-mix(in srgb,var(--huic-accent) 55%,var(--ui-stroke-tertiary))}
.huic[data-card-type="decision"] .huic-dec-rank{grid-row:1/3;align-self:start;display:inline-grid;place-items:center;width:22px;height:22px;margin-top:1px;border-radius:50%;border:1px solid var(--ui-stroke-secondary);font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ui-text-tertiary)}
.huic[data-card-type="decision"] .huic-dec-lead .huic-dec-rank{background:var(--huic-accent);border-color:var(--huic-accent);color:var(--huic-on-accent)}
.huic[data-card-type="decision"] .huic-dec-name{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;min-width:0;font-weight:600}
.huic[data-card-type="decision"] .huic-dec-score{font-size:18px;font-weight:700;line-height:1.1;font-variant-numeric:tabular-nums;text-align:right}
.huic[data-card-type="decision"] .huic-dec-score small{font-size:11px;font-weight:500;color:var(--ui-text-tertiary)}
.huic[data-card-type="decision"] .huic-dec-lead .huic-dec-score{color:var(--huic-accent)}
.huic[data-card-type="decision"] .huic-dec-bar{grid-column:2/4;height:6px;border-radius:999px;background:var(--ui-bg-quaternary);overflow:hidden;margin-top:2px}
.huic[data-card-type="decision"] .huic-dec-bar>span{display:block;height:100%;border-radius:999px;background:color-mix(in srgb,var(--huic-accent) 45%,var(--ui-text-tertiary));transition:width .25s ease}
.huic[data-card-type="decision"] .huic-dec-lead .huic-dec-bar>span{background:var(--huic-accent)}
.huic[data-card-type="decision"] .huic-dec-note{grid-column:2/4;color:var(--ui-text-tertiary);font-size:12px}
.huic[data-card-type="decision"] .huic-dec-warn{margin:0;color:var(--ui-text-tertiary);font-size:12px}
@container (max-width: 440px){
  .huic[data-card-type="decision"] .huic-dec-crit{grid-template-columns:minmax(0,1fr) 3ch}
  .huic[data-card-type="decision"] .huic-dec-crit-label{grid-column:1}
  .huic[data-card-type="decision"] .huic-dec-crit-val{grid-column:2;grid-row:1}
  .huic[data-card-type="decision"] .huic-dec-range{grid-column:1/3;grid-row:2;margin:4px 0 6px}
  .huic[data-card-type="decision"] .huic-dec-score{font-size:16px}
}
@media (prefers-reduced-motion: reduce){.huic[data-card-type="decision"] .huic-dec-bar>span,.huic[data-card-type="decision"] .huic-dec-range::-webkit-slider-thumb{transition:none !important}}
`

function decScoreNumber(value) { return Math.round(value * 10) / 10 }

function decScoreText(value, lang) {
  const text = decScoreNumber(value).toFixed(1)
  return lang === 'de' ? text.replace('.', ',') : text
}

// weights: {criterionId: int}. Sum(weight * score) / sum(weight); 0 when every weight is 0.
function decRank(card, weights) {
  const total = card.criteria.reduce((sum, c) => sum + (weights[c.id] || 0), 0)
  const rows = card.options.map((o, index) => {
    const raw = total > 0 ? card.criteria.reduce((sum, c) => sum + (weights[c.id] || 0) * (o.scores[c.id] || 0), 0) / total : 0
    return { option: o, index, raw, score: decScoreNumber(raw) }
  })
  rows.sort((a, b) => b.raw - a.raw || a.index - b.index)
  return { rows, total }
}

function decCleanWeights(card, source) {
  const out = {}
  for (const c of card.criteria) {
    const v = source && typeof source === 'object' ? source[c.id] : undefined
    out[c.id] = Number.isInteger(v) && v >= 0 && v <= 10 ? v : c.weight
  }
  return out
}

function DecisionCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const headId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [state, setState] = useState(() => {
    const picked = ans.draft?.picked
    return {
      weights: decCleanWeights(card, ans.draft?.weights),
      picked: card.options.some(o => o.id === picked) ? picked : null
    }
  })
  const weights = sent ? decCleanWeights(card, sent.weights) : state.weights
  const picked = sent ? (sent.picked || null) : state.picked
  const { rows, total } = decRank(card, weights)
  const tied = rows.length > 1 && rows[0].score === rows[1].score && total > 0
  const changed = card.criteria.some(c => weights[c.id] !== c.weight)

  const update = next => {
    setState(next)
    ans.saveDraft({ weights: next.weights, picked: next.picked })
  }
  const setWeight = (id, value) => {
    if (ans.locked) return
    update({ ...state, weights: { ...state.weights, [id]: value } })
  }
  const pick = id => {
    if (ans.locked) return
    update({ ...state, picked: state.picked === id ? null : id })
  }

  // FLIP: rows glide to their new place when the ranking changes (skipped for reduced motion).
  const itemRefs = useRef(new Map())
  const lastTops = useRef(new Map())
  const orderKey = rows.map(r => r.option.id).join(',')
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map()
    for (const [id, el] of itemRefs.current) {
      if (!el) continue
      const top = el.getBoundingClientRect().top
      next.set(id, top)
      const before = lastTops.current.get(id)
      if (!reduce && before !== undefined && Math.abs(before - top) > 1 && typeof el.animate === 'function') {
        el.animate([{ transform: `translateY(${before - top}px)` }, { transform: 'none' }], { duration: 220, easing: 'ease-out' })
      }
    }
    lastTops.current = next
  }, [orderKey])

  const send = () => {
    const ranking = rows.map(r => ({ id: r.option.id, label: r.option.label, score: r.score }))
    ans.submit({ weights, ranking, ...(picked ? { picked } : {}) })
  }
  const pickedRow = rows.find(r => r.option.id === picked)

  return jsx(Shell, {
    card, display, labelId, title: card.title, subtitle: card.note,
    children: [
      jsx('style', { children: DECISION_CSS }),
      jsxs('fieldset', {
        className: 'huic-dec-section',
        children: [
          jsx('legend', { className: 'huic-dec-h', id: headId, children: t(lang, 'decCriteria') }),
          ...card.criteria.map(c => {
            const w = weights[c.id]
            return jsxs('div', {
              className: 'huic-dec-crit',
              children: [
                jsx('span', { className: 'huic-dec-crit-label', 'aria-hidden': true, children: c.label }),
                jsx('input', {
                  type: 'range', className: 'huic-dec-range', min: 0, max: 10, step: 1, value: w,
                  disabled: ans.locked, 'aria-label': c.label,
                  'aria-valuetext': t(lang, 'decWeight', { n: w }),
                  style: { '--fill': `${w * 10}%` },
                  onChange: e => setWeight(c.id, Number(e.target.value))
                }),
                jsx('span', { className: 'huic-dec-crit-val', 'aria-hidden': true, children: w })
              ]
            }, c.id)
          })
        ]
      }, 'criteria'),
      jsxs('div', {
        className: 'huic-dec-section',
        children: [
          jsx('h4', { className: 'huic-dec-h', children: t(lang, 'decRanking') }),
          total === 0 ? jsx('p', { className: 'huic-dec-warn', role: 'status', children: t(lang, 'decNoWeights') }) : null,
          jsx('ol', {
            className: 'huic-dec-list', 'aria-label': t(lang, 'decRanking'),
            children: rows.map((r, i) => {
              const lead = i === 0 && total > 0 && !tied
              const o = r.option
              return jsx('li', {
                ref: el => { if (el) itemRefs.current.set(o.id, el); else itemRefs.current.delete(o.id) },
                children: jsxs('button', {
                  type: 'button',
                  className: cx('huic-dec-opt', lead && 'huic-dec-lead'),
                  'aria-pressed': picked === o.id,
                  disabled: ans.locked,
                  onClick: () => pick(o.id),
                  children: [
                    jsx('span', { className: 'huic-dec-rank', 'aria-hidden': true, children: i + 1 }),
                    jsxs('span', { className: 'huic-dec-name', children: [
                      jsx('span', { children: o.label }),
                      lead ? jsx('span', { className: 'huic-badge huic-best', children: t(lang, 'decLeader') }) : null,
                      i === 0 && tied ? jsx('span', { className: 'huic-badge', children: t(lang, 'decTied') }) : null,
                      picked === o.id ? jsx('span', { className: 'huic-badge huic-best', children: `✓ ${t(lang, 'decPicked')}` }) : null
                    ] }),
                    jsxs('span', { className: 'huic-dec-score', 'aria-hidden': true, children: [
                      decScoreText(r.raw, lang), jsx('small', { children: ' /10' })
                    ] }),
                    jsx('span', { className: 'huic-sr', children: `${t(lang, 'decRankOf', { n: i + 1, total: rows.length })}. ${t(lang, 'decScoreOf', { s: decScoreText(r.raw, lang) })}` }),
                    jsx('span', { className: 'huic-dec-bar', 'aria-hidden': true, children: jsx('span', { style: { width: `${r.raw * 10}%` } }) }),
                    o.note ? jsx('span', { className: 'huic-dec-note', children: o.note }) : null
                  ]
                })
              }, o.id)
            })
          })
        ]
      }, 'ranking')
    ],
    footer: ans.showActions ? jsx(Footer, {
      hint: t(lang, 'decHint'),
      children: jsxs(Fragment, { children: [
        changed ? jsx(Btn, {
          variant: 'ghost',
          onClick: () => update({ ...state, weights: decCleanWeights(card, null) }),
          children: t(lang, 'decReset')
        }) : null,
        jsx(Btn, {
          variant: 'primary', onClick: send,
          children: pickedRow ? t(lang, 'decChoose', { x: pickedRow.option.label }) : (card.submitLabel || t(lang, 'decSendWeights'))
        })
      ] })
    }) : null,
    after: ans.status
  })
}

REPLY_BUILDERS.decision = (card, answer, lang, data) => {
  const optionById = new Map(card.options.map(o => [o.id, o]))
  data.weights = {}
  for (const c of card.criteria) data.weights[c.id] = answer.weights[c.id]
  data.ranking = answer.ranking.map(r => ({ id: r.id, label: r.label, score: r.score }))
  if (answer.picked && optionById.has(answer.picked)) data.picked = answer.picked
  const sc = r => decScoreText(r.score, lang)
  if (data.picked) {
    const row = data.ranking.find(r => r.id === data.picked)
    return { mark: '✓', summary: t(lang, 'rDecisionPicked', { x: clip(row.label), s: sc(row) }) }
  }
  // Honest line 1: no weights → no ranking; equal top scores → a tie, not an order the numbers don't support.
  if (!Object.values(data.weights).some(w => w > 0)) return { mark: '✓', summary: t(lang, 'rDecisionNone') }
  const [a, b] = data.ranking
  const tiedAtTop = data.ranking.filter(r => r.score === a.score)
  if (tiedAtTop.length > 2) return { mark: '✓', summary: t(lang, 'rDecisionTieMore', { a: clip(a.label, 24), b: clip(b.label, 24), n: tiedAtTop.length - 2, s: sc(a) }) }
  if (tiedAtTop.length === 2) return { mark: '✓', summary: t(lang, 'rDecisionTie', { a: clip(a.label, 30), b: clip(b.label, 30), s: sc(a) }) }
  return { mark: '✓', summary: t(lang, 'rDecision', { a: clip(a.label, 30), as: sc(a), b: clip(b.label, 30), bs: sc(b) }) }
}
CARD_COMPONENTS.decision = DecisionCard
