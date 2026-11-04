// compare: 2–4 candidates side by side, aligned attribute rows, one marked as the
// recommendation, a pick button per column. Narrow views stack the columns.

function displayValue(value, lang) {
  if (value === true) return '✓'
  if (value === false) return '–'
  if (value === null || value === undefined || value === '') return '–'
  return String(value)
}

function CompareColumn({ card, column, index, lang, ans, picked, onPick }) {
  const rows = card.rows || []
  const isPicked = picked === column.id
  return jsxs('div', {
    role: 'group',
    'aria-label': column.title + (column.best ? ` (${t(lang, 'recommended')})` : ''),
    className: 'huic-opt',
    'aria-pressed': isPicked ? 'true' : undefined,
    style: {
      flexDirection: 'column',
      cursor: 'default',
      gap: 8,
      borderColor: column.best && !isPicked ? 'color-mix(in srgb, var(--huic-accent) 45%, transparent)' : undefined
    },
    children: [
      column.image ? jsx(CardImage, { src: column.image }) : null,
      jsxs('div', {
        className: 'huic-opt-text',
        children: [
          jsxs('div', {
            className: 'huic-row',
            style: { flexWrap: 'wrap', gap: 6 },
            children: [
              jsx('span', { className: 'huic-opt-label', style: { fontSize: 14 }, children: column.title }),
              column.best ? jsx('span', { className: 'huic-badge huic-best', children: '★ ' + t(lang, 'recommended') }) : null,
              column.badge ? jsx('span', { className: 'huic-badge', children: column.badge }) : null
            ]
          }),
          column.subtitle ? jsx('span', { className: 'huic-opt-desc', children: column.subtitle }) : null
        ]
      }),
      rows.length
        ? jsx(KeyValues, { rows: rows.map(row => ({ label: row.label, value: displayValue(row.values[index], lang) })) })
        : null,
      column.pros && column.pros.length
        ? jsx('ul', {
            'aria-label': t(lang, 'pros'),
            style: { margin: 0, paddingLeft: 0, listStyle: 'none' },
            children: column.pros.map((p, i) =>
              jsxs('li', { children: [jsx('span', { style: { color: 'var(--ui-green, var(--huic-accent))' }, 'aria-hidden': true, children: '+ ' }), p] }, i)
            )
          })
        : null,
      column.cons && column.cons.length
        ? jsx('ul', {
            'aria-label': t(lang, 'cons'),
            style: { margin: 0, paddingLeft: 0, listStyle: 'none' },
            children: column.cons.map((c, i) =>
              jsxs('li', { children: [jsx('span', { style: { color: 'var(--ui-red, var(--ui-text-tertiary))' }, 'aria-hidden': true, children: '– ' }), c] }, i)
            )
          })
        : null,
      ans.showActions
        ? jsx('div', {
            style: { marginTop: 'auto', display: 'flex' },
            children: jsx(Btn, {
              variant: column.best ? 'primary' : 'secondary',
              onClick: () => onPick(column.id),
              label: `${card.selectLabel || t(lang, 'pick')}: ${column.title}`,
              children: card.selectLabel || t(lang, 'pick')
            })
          })
        : null
    ]
  })
}

function CompareCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const picked = ans.answer && ans.answer.data ? ans.answer.data.selected : null
  const onPick = id => ans.submit({ selected: id })
  return jsx(Shell, {
    card,
    display,
    labelId,
    title: card.title,
    children: jsx('div', {
      className: 'huic-grid',
      style: { gridTemplateColumns: `repeat(auto-fit, minmax(${card.columns.length > 3 ? 150 : 170}px, 1fr))` },
      children: card.columns.map((column, index) =>
        jsx(CompareColumn, { card, column, index, lang, ans, picked, onPick }, column.id)
      )
    }),
    after: ans.status
  })
}
