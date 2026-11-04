// form: text, textarea, number, date, time, email, select and toggle fields with
// required fields and checks. Drafts are saved, so a half-filled form survives reopening.

Object.assign(STRINGS.en, {
  formChoose: 'Please choose', formRequiredFilled: '{done} of {total} required filled',
  formDraftSaved: 'Draft saved', formDateFormat: 'Format: dd/mm/yyyy'
})
Object.assign(STRINGS.de, {
  formChoose: 'Bitte wählen', formRequiredFilled: '{done} von {total} Pflichtfeldern ausgefüllt',
  formDraftSaved: 'Entwurf gespeichert', formDateFormat: 'Format: TT.MM.JJJJ'
})

const FORM_CSS = `
.huic[data-card-type="form"] .huic-form-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:10px}
.huic[data-card-type="form"] .huic-form-wide{grid-column:1/-1}
.huic[data-card-type="form"] .huic-field{min-width:0}
.huic[data-card-type="form"] .huic-input{min-width:0;min-height:32px;background:color-mix(in srgb,var(--ui-bg-quaternary) 35%,transparent)}
.huic[data-card-type="form"] input.huic-input,.huic[data-card-type="form"] select.huic-input{height:32px;padding-block:4px}
.huic[data-card-type="form"] select.huic-input option{background:var(--ui-chat-surface-background,var(--ui-base));color:var(--ui-text-primary)}
.huic[data-card-type="form"] .huic-switch-label{display:flex;align-items:center;gap:8px;min-height:32px;cursor:pointer}
.huic[data-card-type="form"] .huic-switch-label:has(:disabled){cursor:default;opacity:.6}
.huic[data-card-type="form"] input.huic-switch{appearance:none;position:relative;flex:none;width:32px;height:18px;margin:0;border:1px solid var(--ui-stroke-secondary);border-radius:999px;background:var(--ui-bg-quaternary);cursor:inherit;transition:background .15s,border-color .15s}
.huic[data-card-type="form"] input.huic-switch::after{content:"";position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:var(--ui-text-secondary);transition:transform .15s}
.huic[data-card-type="form"] input.huic-switch:checked{background:var(--huic-accent);border-color:var(--huic-accent)}
.huic[data-card-type="form"] input.huic-switch:checked::after{transform:translateX(14px);background:var(--ui-chat-surface-background,var(--ui-base))}
.huic[data-card-type="form"] .huic-form-feedback{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1;color:var(--ui-text-tertiary);font-size:12px}
@container (min-width:521px){.huic[data-card-type="form"] .huic-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(prefers-reduced-motion:reduce){.huic[data-card-type="form"] *{transition:none!important}}
`

const TEXT_MAX = { text: 300, email: 200, textarea: 1000 }

function initialFormValues(card) {
  const out = {}
  for (const f of card.fields) {
    if (f.kind === 'toggle') out[f.name] = f.default === true
    else if (f.default !== undefined && f.default !== null) out[f.name] = String(f.default)
    else out[f.name] = ''
  }
  return out
}

function checkField(field, raw, lang) {
  if (field.kind === 'toggle') return null
  const value = String(raw ?? '').trim()
  if (!value) return field.required ? t(lang, 'errRequired') : null
  if (field.kind === 'number') {
    const n = Number(value.replace(',', '.'))
    if (!Number.isFinite(n)) return t(lang, 'errNumber')
    if (field.min !== undefined && n < field.min) return t(lang, 'errMin', { min: field.min })
    if (field.max !== undefined && n > field.max) return t(lang, 'errMax', { max: field.max })
    return null
  }
  if (field.kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return t(lang, 'errEmail')
  const max = TEXT_MAX[field.kind] ? Math.min(field.maxLength || Infinity, TEXT_MAX[field.kind]) : field.maxLength
  if (max && [...value].length > max) return t(lang, 'errTooLong', { max })
  return null
}

function formOutput(card, values) {
  const out = {}
  for (const f of card.fields) {
    const raw = values[f.name]
    if (f.kind === 'toggle') out[f.name] = raw === true
    else if (f.kind === 'number') {
      const s = String(raw ?? '').trim()
      out[f.name] = s ? Number(s.replace(',', '.')) : null
    } else {
      const s = String(raw ?? '').trim()
      out[f.name] = s || null
    }
  }
  return out
}

function FormField({ field, value, error, disabled, lang, onChange, baseId }) {
  const id = `${baseId}-${field.name}`
  const helpId = field.help ? `${id}-help` : undefined
  const errId = error ? `${id}-err` : undefined
  const dateHelpId = field.kind === 'date' ? `${id}-format` : undefined
  const describedBy = [helpId, dateHelpId, errId].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    lang: field.kind === 'date' ? (lang === 'de' ? 'de-DE' : 'en-GB') : undefined,
    disabled,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    'aria-required': field.required ? 'true' : undefined
  }
  let control
  if (field.kind === 'toggle') {
    control = jsxs('label', {
      className: 'huic-switch-label',
      htmlFor: id,
      style: { cursor: disabled ? 'default' : 'pointer' },
      children: [
        jsx('input', {
          ...common,
          type: 'checkbox',
          role: 'switch',
          checked: value === true,
          onChange: e => onChange(e.target.checked),
          className: 'huic-switch'
        }),
        jsx('span', { children: field.label })
      ]
    })
  } else if (field.kind === 'select') {
    control = jsxs('select', {
      ...common,
      className: 'huic-input',
      value,
      onChange: e => onChange(e.target.value),
      children: [
        jsx('option', { value: '', children: field.placeholder || t(lang, 'formChoose') }),
        ...field.options.map(o => jsx('option', { value: o, children: o }, o))
      ]
    })
  } else if (field.kind === 'textarea') {
    control = jsx('textarea', {
      ...common,
      className: 'huic-input',
      value,
      placeholder: field.placeholder,
      maxLength: Math.min(field.maxLength || Infinity, TEXT_MAX.textarea) * 2,
      onChange: e => onChange(limitText(e.target.value, Math.min(field.maxLength || Infinity, TEXT_MAX.textarea)))
    })
  } else {
    const type = { number: 'number', date: 'date', time: 'time', email: 'email' }[field.kind] || 'text'
    control = jsxs('div', {
      className: 'huic-row',
      children: [
        jsx('input', {
          ...common,
          className: 'huic-input',
          type,
          value,
          placeholder: field.placeholder,
          min: field.kind === 'number' ? field.min : undefined,
          max: field.kind === 'number' ? field.max : undefined,
          step: field.kind === 'number' ? field.step ?? 'any' : undefined,
          inputMode: field.kind === 'number' ? 'decimal' : undefined,
          maxLength: type === 'text' || type === 'email' ? Math.min(field.maxLength || Infinity, TEXT_MAX[field.kind]) * 2 : undefined,
          onChange: e => onChange(TEXT_MAX[field.kind] ? limitText(e.target.value, Math.min(field.maxLength || Infinity, TEXT_MAX[field.kind])) : e.target.value)
        }),
        field.unit ? jsx('span', { className: 'huic-help', children: field.unit }) : null
      ]
    })
  }
  return jsxs('div', {
    className: cx('huic-field', ['text', 'textarea'].includes(field.kind) && 'huic-form-wide'),
    children: [
      field.kind === 'toggle'
        ? null
        : jsxs('label', {
            className: 'huic-label',
            htmlFor: id,
            children: [
              field.label,
              field.required
                ? jsxs('span', { className: 'huic-req', children: [' *', jsx('span', { className: 'huic-sr', children: ` (${t(lang, 'required')})` })] })
                : null
            ]
          }),
      control,
      field.help ? jsx('span', { className: 'huic-help', id: helpId, children: field.help }) : null,
      dateHelpId ? jsx('span', { className: 'huic-help', id: dateHelpId, children: t(lang, 'formDateFormat') }) : null,
      error ? jsx('span', { className: 'huic-err', id: errId, children: error }) : null
    ]
  })
}

function FormCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const baseId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const [localValues, setValues] = useState(() => {
    const base = initialFormValues(card)
    if (ans.answer && ans.answer.data && ans.answer.data.values) {
      for (const [k, v] of Object.entries(ans.answer.data.values)) base[k] = typeof v === 'boolean' ? v : v === null ? '' : String(v)
    } else if (ans.draft && ans.draft.values) {
      Object.assign(base, ans.draft.values)
    }
    return base
  })
  const values = ans.answer?.data?.values || ans.draft?.values || localValues
  const [tried, setTried] = useState(false)
  const [focusTick, setFocusTick] = useState(0)
  const formRef = useRef(null)
  const formId = `${baseId}-form`

  const errors = {}
  for (const f of card.fields) {
    const e = checkField(f, values[f.name], lang)
    if (e) errors[f.name] = e
  }
  const hasErrors = Object.keys(errors).length > 0
  const required = card.fields.filter(f => f.required)
  // A switch always has a boolean value; false is a valid answer too.
  const requiredFilled = required.filter(f => f.kind === 'toggle' || String(values[f.name] ?? '').trim() !== '').length
  const reply = buildReply(card, { values: formOutput(card, values) }, lang)
  const remaining = MAX_REPLY - [...reply.text].length
  const ranked = card.fields.map(f => ({ name: f.name, size: [...JSON.stringify(formOutput(card, values)[f.name])].length }))
    .sort((a, b) => b.size - a.size)
  const oversizeFields = new Set()
  if (!reply.fits) {
    let excess = -remaining
    for (const field of ranked) {
      if (field.size <= 4) break
      oversizeFields.add(field.name)
      excess -= field.size - 2
      if (excess <= 0) break
    }
  }

  // After a failed submit, move focus to the first field that needs attention.
  useEffect(() => {
    if (!focusTick || !formRef.current) return
    const el = formRef.current.querySelector('[aria-invalid="true"]')
    if (el && el.focus) el.focus()
  }, [focusTick])

  const change = name => value => {
    if (ans.locked) return
    const next = { ...values, [name]: value }
    setValues(next)
    ans.saveDraft({ values: next })
  }

  const onSubmit = event => {
    event.preventDefault()
    setTried(true)
    if (hasErrors || !reply.fits) {
      setFocusTick(n => n + 1)
      return
    }
    ans.submit({ values: formOutput(card, values) })
  }

  const body = jsxs('form', {
    ref: formRef,
    id: formId,
    noValidate: true,
    onSubmit,
    'aria-labelledby': card.title ? labelId : undefined,
    className: 'huic-form-grid',
    children: [
      card.description ? jsx('p', { className: 'huic-sub huic-form-wide', style: { margin: 0 }, children: card.description }) : null,
      ...card.fields.map(field =>
        jsx(
          FormField,
          {
            field,
            value: values[field.name] ?? '',
            error: oversizeFields.has(field.name) ? t(lang, 'shortenField') : tried ? errors[field.name] : null,
            disabled: ans.locked,
            lang,
            baseId,
            onChange: change(field.name)
          },
          field.name
        )
      ),
      remaining <= MAX_REPLY * 0.15 ? jsx('span', { className: 'huic-help huic-form-wide', 'aria-live': 'polite', children: t(lang, 'charactersLeft', { n: new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-US').format(remaining) }) }) : null,
      // Enter in a single-line field submits the form; the visible button sits in the footer.
      jsx('button', { type: 'submit', hidden: true, tabIndex: -1, 'aria-hidden': true })
    ]
  })

  const footer = ans.showActions
    ? jsx(Footer, {
        hint: jsxs('span', {
          className: 'huic-form-feedback',
          children: [
            required.length ? jsx('span', { 'aria-live': 'polite', children: t(lang, 'formRequiredFilled', { done: requiredFilled, total: required.length }) }) : null,
            ans.draft?.values ? jsx('span', { role: 'status', children: t(lang, 'formDraftSaved') }) : null,
            tried && hasErrors ? jsx('span', { children: t(lang, 'errFix') }) : null
          ]
        }),
        children: jsx('button', {
          type: 'submit',
          form: formId,
          className: 'huic-btn huic-btn-primary',
          children: card.submitLabel || t(lang, 'submit')
        })
      })
    : null

  return jsx(Shell, { card, display, labelId, title: card.title, children: [jsx('style', { children: FORM_CSS }), body], footer, after: ans.status })
}
