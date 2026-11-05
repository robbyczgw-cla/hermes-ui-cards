// form: text, textarea, number, date, time, email, select and toggle fields with
// required fields and checks. Drafts are saved, so a half-filled form survives reopening.

Object.assign(STRINGS.en, {
  formChoose: 'Please choose', formRequiredFilled: '{done} of {total} required filled',
  formNotSet: 'Not set', formDraftSaved: 'Draft saved', formDateFormat: 'Format: dd/mm/yyyy', formOptional: 'optional'
})
Object.assign(STRINGS.de, {
  formChoose: 'Bitte wählen', formRequiredFilled: '{done} von {total} Pflichtfeldern ausgefüllt',
  formNotSet: 'Nicht festgelegt', formDraftSaved: 'Entwurf gespeichert', formDateFormat: 'Format: TT.MM.JJJJ', formOptional: 'optional'
})

// A guided intake, not a web form: numbered questions down a rail that tick off as they
// are answered, settings-style rows (question left, answer right) and a meter for what's required.
const FORM_CSS = `
.huic[data-card-type="form"] .huic-form-grid{display:flex;flex-direction:column;counter-reset:huic-q}
.huic[data-card-type="form"] .huic-form-intro{margin:0 0 4px;color:var(--ui-text-secondary);font-size:13px;line-height:19px}
.huic[data-card-type="form"] .huic-field{position:relative;display:grid;grid-template-columns:20px minmax(0,1fr);column-gap:12px;row-gap:8px;align-items:start;min-width:0;padding:12px 0;border-top:1px solid var(--huic-line)}
.huic[data-card-type="form"] .huic-field:first-of-type{border-top:0;padding-top:4px}
.huic[data-card-type="form"] .huic-form-intro+.huic-field{border-top:1px solid var(--huic-line);padding-top:12px}
.huic[data-card-type="form"] .huic-field::before{content:"";position:absolute;left:9.5px;top:0;bottom:0;width:1px;background:var(--huic-line)}
.huic[data-card-type="form"] .huic-field:first-of-type::before{top:16px}
.huic[data-card-type="form"] .huic-field:last-of-type::before{bottom:auto;height:16px}
.huic[data-card-type="form"] .huic-form-marker{position:relative;z-index:1;grid-row:1 / span 2;display:grid;place-items:center;width:20px;height:20px;margin-top:0;border:1px solid var(--huic-line-strong);border-radius:50%;background:var(--ui-chat-surface-background,var(--ui-base));color:var(--ui-text-tertiary);font-size:10.5px;font-weight:600;font-variant-numeric:tabular-nums;transition:background .2s,border-color .2s,color .2s}
.huic[data-card-type="form"] .huic-form-marker::before{counter-increment:huic-q;content:counter(huic-q)}
.huic[data-card-type="form"] [data-state="done"]>.huic-form-marker{background:var(--huic-accent);border-color:var(--huic-accent);color:var(--huic-on-accent)}
.huic[data-card-type="form"] [data-state="done"]>.huic-form-marker::before{content:"";width:8px;height:4px;border-left:1.75px solid currentColor;border-bottom:1.75px solid currentColor;transform:translateY(-1px) rotate(-45deg)}
.huic[data-card-type="form"] [data-state="error"]>.huic-form-marker{border-color:var(--ui-red);color:var(--ui-red);background:color-mix(in srgb,var(--ui-red) 10%,var(--ui-chat-surface-background,var(--ui-base)))}
.huic[data-card-type="form"] [data-state="error"]>.huic-form-marker::before{content:"!"}
.huic[data-card-type="form"] .huic-form-lead{display:flex;flex-direction:column;gap:2px;min-width:0;padding-top:1px}
.huic[data-card-type="form"] .huic-form-control{display:flex;flex-direction:column;gap:4px;min-width:0;grid-column:2}
.huic[data-card-type="form"] .huic-label{font-size:13px;line-height:18px;font-weight:500;color:var(--ui-text-primary)}
.huic[data-card-type="form"] .huic-form-optional{margin-left:6px;color:var(--ui-text-tertiary);font-size:11.5px;font-weight:400}
.huic[data-card-type="form"] .huic-input{min-width:0;min-height:34px}
.huic[data-card-type="form"] input.huic-input,.huic[data-card-type="form"] select.huic-input{height:34px;padding-block:4px}
.huic[data-card-type="form"] .huic-form-short{max-width:240px}
.huic[data-card-type="form"] .huic-select{position:relative;display:block;min-width:0}
.huic[data-card-type="form"] .huic-select>select{appearance:none;-webkit-appearance:none;padding-right:30px;cursor:pointer}
.huic[data-card-type="form"] .huic-select::after{content:"";position:absolute;right:12px;top:50%;width:6px;height:6px;border-right:1.5px solid var(--ui-text-tertiary);border-bottom:1.5px solid var(--ui-text-tertiary);transform:translateY(-70%) rotate(45deg);pointer-events:none}
.huic[data-card-type="form"] select.huic-input option{background:var(--ui-chat-surface-background,var(--ui-base));color:var(--ui-text-primary)}
.huic[data-card-type="form"] .huic-form-unit{flex:none;white-space:nowrap;color:var(--ui-text-tertiary);font-size:12px}
.huic[data-card-type="form"] .huic-switch-label{grid-column:2;display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:22px;cursor:pointer}
.huic[data-card-type="form"] .huic-switch-label>span{font-weight:500;line-height:18px}
.huic[data-card-type="form"] .huic-switch-label:has(:disabled){cursor:default;opacity:.75}
.huic[data-card-type="form"] input.huic-switch{appearance:none;position:relative;flex:none;width:34px;height:20px;margin:0;border:1px solid var(--huic-line-strong);border-radius:999px;background:var(--ui-bg-tertiary,var(--ui-bg-quaternary));cursor:inherit;transition:background .18s,border-color .18s}
.huic[data-card-type="form"] input.huic-switch::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--ui-text-tertiary);transition:transform .18s var(--huic-ease),background .18s}
.huic[data-card-type="form"] input.huic-switch[aria-checked="mixed"]::after{transform:translateX(7px)}
.huic[data-card-type="form"] .huic-form-unset{color:var(--ui-text-tertiary);font-size:11.5px;font-weight:400;margin-left:6px}
.huic[data-card-type="form"] input.huic-switch:checked{background:var(--huic-accent);border-color:var(--huic-accent)}
.huic[data-card-type="form"] input.huic-switch:checked::after{transform:translateX(14px);background:var(--huic-on-accent)}
.huic[data-card-type="form"] .huic-form-feedback{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;color:var(--ui-text-tertiary);font-size:12px}
.huic[data-card-type="form"] .huic-form-meter{display:flex;gap:3px;max-width:160px}
.huic[data-card-type="form"] .huic-form-meter>i{flex:1;height:4px;max-width:28px;border-radius:999px;background:var(--huic-line-strong);transition:background .25s var(--huic-ease)}
.huic[data-card-type="form"] .huic-form-meter>i.on{background:var(--huic-accent)}
.huic[data-card-type="form"] .huic-form-status{display:flex;flex-wrap:wrap;column-gap:8px}
.huic[data-card-type="form"] .huic-form-status>span+span::before{content:"·";margin-right:8px;color:var(--ui-text-quaternary,var(--ui-text-tertiary))}
.huic[data-card-type="form"] .huic-form-status>.huic-err{color:var(--ui-red)}
.huic[data-card-type="form"] .huic-form-submit{transition:background .25s var(--huic-ease),color .25s var(--huic-ease),box-shadow .25s var(--huic-ease)}
@container (min-width:521px){
 .huic[data-card-type="form"] .huic-field{grid-template-columns:20px minmax(0,38%) minmax(0,1fr)}
 .huic[data-card-type="form"] .huic-form-marker{grid-row:auto}
 .huic[data-card-type="form"] .huic-form-control{grid-column:3}
 .huic[data-card-type="form"] .huic-switch-label{grid-column:2 / span 2}
 .huic[data-card-type="form"] .huic-form-lead{padding-top:7px}
 .huic[data-card-type="form"] .huic-field>.huic-form-marker{margin-top:7px}
 .huic[data-card-type="form"] .huic-field.is-toggle>.huic-form-marker{margin-top:0}
 .huic[data-card-type="form"] .huic-field:first-of-type::before{top:23px}
 .huic[data-card-type="form"] .huic-field:last-of-type::before{height:23px}
}
`

const TEXT_MAX = { text: 300, email: 200, textarea: 1000 }

function initialFormValues(card) {
  const out = {}
  for (const f of card.fields) {
    if (f.kind === 'toggle') out[f.name] = f.default === undefined ? null : f.default
    else if (f.default !== undefined && f.default !== null) out[f.name] = String(f.default)
    else out[f.name] = ''
  }
  return out
}

function checkField(field, raw, lang) {
  if (field.kind === 'toggle') return field.required && typeof raw !== 'boolean' ? t(lang, 'errRequired') : null
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
    if (f.kind === 'toggle') out[f.name] = typeof raw === 'boolean' ? raw : null
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

function FormField({ field, value, error, disabled, lang, onChange, baseId, state, optional }) {
  const id = `${baseId}-${field.name}`
  const helpId = field.help ? `${id}-help` : undefined
  const errId = error ? `${id}-err` : undefined
  // No format hint for dates: the native picker shows the user's own locale format, a fixed
  // hint (dd/mm/yyyy) would contradict it. The value sent is always ISO (YYYY-MM-DD).
  const dateHelpId = undefined
  const describedBy = [helpId, dateHelpId, errId].filter(Boolean).join(' ') || undefined
  const common = {
    id,
    lang: field.kind === 'date' ? (lang === 'de' ? 'de-DE' : 'en-GB') : undefined,
    disabled,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
    'aria-required': field.required ? 'true' : undefined
  }
  const short = ['number', 'date', 'time', 'select'].includes(field.kind)
  let control
  if (field.kind === 'toggle') {
    control = jsxs('label', {
      className: 'huic-switch-label',
      htmlFor: id,
      style: { cursor: disabled ? 'default' : 'pointer' },
      children: [
        jsxs('span', { children: [field.label, value == null ? jsx('span', { className: 'huic-form-unset', children: t(lang, 'formNotSet') }) : null] }),
        jsx('input', {
          ...common,
          type: 'checkbox',
          role: 'checkbox',
          'aria-checked': value == null ? 'mixed' : value,
          checked: value === true,
          onChange: e => onChange(e.target.checked),
          className: 'huic-switch'
        })
      ]
    })
  } else if (field.kind === 'select') {
    control = jsx('span', {
      className: 'huic-select huic-form-short',
      children: jsxs('select', {
        ...common,
        className: 'huic-input',
        value,
        onChange: e => onChange(e.target.value),
        children: [
          // After sending, an empty choice reads as what it is: not set (not a prompt to choose).
          jsx('option', { value: '', children: disabled && !value ? t(lang, 'formNotSet') : field.placeholder || t(lang, 'formChoose') }),
          ...field.options.map(o => jsx('option', { value: o, children: o }, o))
        ]
      })
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
      className: cx('huic-row', short && 'huic-form-short'),
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
        field.unit ? jsx('span', { className: 'huic-form-unit', children: field.unit }) : null
      ]
    })
  }
  const help = [
    field.help ? jsx('span', { className: 'huic-help', id: helpId, children: field.help }, 'help') : null,
    null
  ]
  return jsxs('div', {
    className: cx('huic-field', ['text', 'textarea'].includes(field.kind) && 'huic-form-wide', field.kind === 'toggle' && 'is-toggle'),
    'data-state': state,
    children: [
      jsx('span', { className: 'huic-form-marker', 'aria-hidden': true }),
      field.kind === 'toggle'
        ? control
        : jsxs('div', {
            className: 'huic-form-lead',
            children: [
              jsxs('label', {
                className: 'huic-label',
                htmlFor: id,
                children: [
                  field.label,
                  field.required ? jsx('span', { className: 'huic-sr', children: ` (${t(lang, 'required')})` }) : null,
                  optional ? jsx('span', { className: 'huic-form-optional', children: t(lang, 'formOptional') }) : null
                ]
              }),
              ...help
            ]
          }),
      field.kind === 'toggle'
        ? (help.some(Boolean) || error ? jsxs('div', { className: 'huic-form-control', children: [...help, error ? jsx('span', { className: 'huic-err', id: errId, children: error }) : null] }) : null)
        : jsxs('div', { className: 'huic-form-control', children: [control, error ? jsx('span', { className: 'huic-err', id: errId, children: error }) : null] })
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
      for (const [k, v] of Object.entries(ans.answer.data.values)) base[k] = typeof v === 'boolean' ? v : v === null ? null : String(v)
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
  const filled = f => f.kind === 'toggle' ? typeof values[f.name] === 'boolean' : String(values[f.name] ?? '').trim() !== ''
  const requiredFilled = required.filter(filled).length
  const shownError = f => oversizeFields.has(f.name) ? t(lang, 'shortenField') : tried ? errors[f.name] : null
  const fieldState = f => shownError(f) ? 'error' : filled(f) && !errors[f.name] ? 'done' : 'idle'
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
      card.description ? jsx('p', { className: 'huic-form-intro', children: card.description }) : null,
      ...card.fields.map(field =>
        jsx(
          FormField,
          {
            field,
            value: field.kind === 'toggle' ? values[field.name] : values[field.name] ?? '',
            state: fieldState(field),
            optional: required.length > 0 && !field.required && field.kind !== 'toggle',
            error: shownError(field),
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
            required.length ? jsx('span', { className: 'huic-form-meter', 'aria-hidden': true, children: required.map(f => jsx('i', { className: filled(f) ? 'on' : undefined }, f.name)) }) : null,
            jsxs('span', { className: 'huic-form-status', children: [
              required.length ? jsx('span', { 'aria-live': 'polite', children: t(lang, 'formRequiredFilled', { done: requiredFilled, total: required.length }) }) : null,
              ans.draft?.values ? jsx('span', { role: 'status', children: t(lang, 'formDraftSaved') }) : null,
              tried && hasErrors ? jsx('span', { className: 'huic-err', children: t(lang, 'errFix') }) : null
            ] })
          ]
        }),
        // Quiet until every required field has a value, then the primary action; clicking
        // early still works (it marks what is missing).
        children: jsx('button', {
          type: 'submit',
          form: formId,
          className: cx('huic-btn huic-form-submit', requiredFilled === required.length && 'huic-btn-primary'),
          'data-ready': requiredFilled === required.length ? 'true' : 'false',
          children: card.submitLabel || t(lang, 'submit')
        })
      })
    : null

  return jsx(Shell, { card, display, labelId, title: card.title, children: [jsx('style', { children: FORM_CSS }), body], footer, after: ans.status })
}
