// checklist: ticks are saved as you go (they survive reopening the chat); "Done" reports
// what is checked and what is still open.

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
  const ans = useCardAnswer(card, sessionId, lang)
  const initial = () => {
    if (ans.answer && ans.answer.data) {
      const done = new Set(ans.answer.data.done || [])
      return card.items.filter(i => done.has(i.text)).map(i => i.id)
    }
    if (ans.draft && Array.isArray(ans.draft.checked)) return ans.draft.checked
    return card.items.filter(i => i.checked).map(i => i.id)
  }
  const [checked, setChecked] = useState(initial)

  const toggle = id => {
    if (ans.locked) return
    setChecked(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      ans.saveDraft({ checked: next })
      return next
    })
  }

  const total = card.items.length
  const done = checked.filter(id => card.items.some(i => i.id === id)).length
  const pct = total ? Math.round((done / total) * 100) : 0

  const progress = jsxs('div', {
    className: 'huic-row',
    children: [
      jsx('div', {
        className: 'huic-progress',
        style: { flex: 1 },
        role: 'progressbar',
        'aria-valuemin': 0,
        'aria-valuemax': total,
        'aria-valuenow': done,
        'aria-label': t(lang, 'progress', { done, total }),
        children: jsx('span', { style: { width: `${pct}%` } })
      }),
      jsx('span', { className: 'huic-hint', style: { marginRight: 0 }, 'aria-hidden': true, children: t(lang, 'progress', { done, total }) })
    ]
  })

  const groups = groupItems(card.items).map((group, gi) =>
    jsxs(
      'fieldset',
      {
        style: { border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 },
        children: [
          group.name
            ? jsx('legend', { className: 'huic-label', style: { padding: '6px 0 2px', color: 'var(--ui-text-secondary)' }, children: group.name })
            : null,
          ...group.items.map(item => {
            const on = checked.includes(item.id)
            const inputId = `${labelId}-${item.id}`
            return jsxs(
              'label',
              {
                htmlFor: inputId,
                className: 'huic-row',
                style: {
                  alignItems: 'flex-start',
                  padding: '5px 2px',
                  cursor: ans.locked ? 'default' : 'pointer'
                },
                children: [
                  jsx('input', {
                    id: inputId,
                    type: 'checkbox',
                    checked: on,
                    disabled: ans.locked,
                    onChange: () => toggle(item.id),
                    style: { accentColor: 'var(--huic-accent)', marginTop: 3, width: 15, height: 15, flex: 'none' }
                  }),
                  jsxs('span', {
                    className: 'huic-opt-text',
                    children: [
                      jsx('span', {
                        style: on ? { textDecoration: 'line-through', color: 'var(--ui-text-tertiary)' } : undefined,
                        children: item.text
                      }),
                      item.note ? jsx('span', { className: 'huic-opt-desc', children: item.note }) : null
                    ]
                  })
                ]
              },
              item.id
            )
          })
        ]
      },
      group.name || `g${gi}`
    )
  )

  const send = () => ans.submit({ checked: card.items.filter(i => checked.includes(i.id)).map(i => i.id) })

  return jsx(Shell, {
    card,
    display,
    labelId,
    title: card.title,
    children: [progress, jsx('div', { role: 'group', 'aria-labelledby': card.title ? labelId : undefined, children: groups })],
    footer: ans.showActions
      ? jsx(Footer, {
          children: jsx(Btn, { variant: 'primary', onClick: send, children: card.doneLabel || t(lang, 'done') })
        })
      : null,
    after: ans.status
  })
}
