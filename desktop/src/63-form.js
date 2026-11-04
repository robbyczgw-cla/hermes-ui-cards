// form: text, textarea, number, date, time, email, select and toggle fields with
// required fields and checks. Drafts are saved, so a half-filled form survives reopening.

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
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    disabled,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    'aria-required': field.required ? 'true' : undefined
  }
  let control
  if (field.kind === 'toggle') {
    control = jsxs('label', {
      className: 'huic-row',
      htmlFor: id,
      style: { cursor: disabled ? 'default' : 'pointer' },
      children: [
        jsx('input', {
          ...common,
          type: 'checkbox',
          role: 'switch',
          checked: value === true,
          onChange: e => onChange(e.target.checked),
          style: { accentColor: 'var(--huic-accent)', width: 15, height: 15 }
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
        jsx('option', { value: '', children: field.placeholder || '–' }),
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
    className: 'huic-field',
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

  // After a failed submit, move focus to the first field that needs attention.
  useEffect(() => {
    if (!focusTick || !formRef.current) return
    const el = formRef.current.querySelector('[aria-invalid="true"]')
    if (el && el.focus) el.focus()
  }, [focusTick])

  const change = name => value => {
    const next = { ...values, [name]: value }
    setValues(next)
    ans.saveDraft({ values: next })
  }

  const onSubmit = event => {
    event.preventDefault()
    setTried(true)
    if (hasErrors) {
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
    style: { display: 'flex', flexDirection: 'column', gap: 10 },
    children: [
      card.description ? jsx('p', { className: 'huic-sub', style: { margin: 0 }, children: card.description }) : null,
      ...card.fields.map(field =>
        jsx(
          FormField,
          {
            field,
            value: values[field.name] ?? '',
            error: tried ? errors[field.name] : null,
            disabled: ans.locked,
            lang,
            baseId,
            onChange: change(field.name)
          },
          field.name
        )
      ),
      // Enter in a single-line field submits the form; the visible button sits in the footer.
      jsx('button', { type: 'submit', hidden: true, tabIndex: -1, 'aria-hidden': true })
    ]
  })

  const footer = ans.showActions
    ? jsx(Footer, {
        hint: tried && hasErrors ? t(lang, 'errFix') : '',
        children: jsx('button', {
          type: 'submit',
          form: formId,
          className: 'huic-btn huic-btn-primary',
          children: card.submitLabel || t(lang, 'submit')
        })
      })
    : null

  return jsx(Shell, { card, display, labelId, title: card.title, children: body, footer, after: ans.status })
}
