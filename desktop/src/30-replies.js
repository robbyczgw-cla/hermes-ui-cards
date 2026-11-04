// The message a card sends back (docs/protocol.md §2): line 1 for people, line 2
// `[hui-card] {json}` for the model. Pure functions, unit-tested.

const REPLY_TAG = '[hui-card]'
const REPLY_BUILDERS = {}
const MAX_REPLY = (SCHEMA.limits && SCHEMA.limits.maxReplyChars) || 4000
const SUMMARY_ITEM_MAX = 60

function oneLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function clip(value, max = SUMMARY_ITEM_MAX) {
  const s = oneLine(value)
  const chars = [...s]
  if (max <= 0) return ''
  return chars.length > max ? chars.slice(0, max - 1).join('') + '…' : s
}

function joinList(items) {
  const parts = items.map(x => clip(x))
  // An item with its own comma ("Parmesan, grated") would read as two: use "; " then.
  return parts.join(parts.some(p => /,\s/.test(p)) ? '; ' : ', ')
}

function isNaiveIso(value) {
  return typeof value === 'string' && !/(Z|[+-]\d{2}:\d{2})$/.test(value)
}

function validTimeZone(zone) {
  if (!zone) return undefined
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
    return zone
  } catch {
    return undefined
  }
}

// A naive timestamp is a wall-clock value, independent of the machine's zone.
function slotDate(value) {
  if (!isNaiveIso(value)) return new Date(value)
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/.exec(value)
  if (!m) return new Date(NaN)
  const date = new Date(0)
  date.setUTCFullYear(+m[1], +m[2] - 1, +m[3])
  date.setUTCHours(+m[4], +m[5], +(m[6] || 0), 0)
  return date
}
function slotZone(value, card) {
  return isNaiveIso(value) ? 'UTC' : validTimeZone(card && card.timezone)
}
function slotDay(value, card) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: slotZone(value, card) }).format(slotDate(value))
}
// withDay: false under a day heading (schedule card), where the date would repeat.
function formatSlot(slot, card, lang, { withDay = true } = {}) {
  const locale = lang === 'de' ? 'de-DE' : 'en-GB'
  const format = (value, day) => new Intl.DateTimeFormat(locale, {
    ...(day ? { weekday: 'short', day: 'numeric', month: 'short' } : {}),
    hour: '2-digit', minute: '2-digit', timeZone: slotZone(value, card)
  }).format(slotDate(value))
  if (Number.isNaN(slotDate(slot.start).getTime())) return oneLine(slot.label || slot.start)
  let text = format(slot.start, withDay)
  if (slot.end && !Number.isNaN(slotDate(slot.end).getTime()))
    text += '–' + format(slot.end, slotDay(slot.start, card) !== slotDay(slot.end, card))
  return text
}

function formValueText(field, value, lang) {
  if (field.kind === 'toggle') return value ? t(lang, 'yesWord') : t(lang, 'noWord')
  if (value === '' || value === null || value === undefined) return '–'
  return field.unit ? `${value} ${field.unit}` : String(value)
}

// answer: the type-specific fields (see docs/protocol.md). Returns { mark, summary, data, text }.
function buildReply(card, answer, lang) {
  const L = lang || cardLang(card)
  let mark = '✓'
  let summary = ''
  const data = { card: card.cardId, type: card.type }

  switch (card.type) {
    case 'choice': {
      const picked = card.options.filter(o => answer.selected.includes(o.id))
      data.selected = picked.map(o => o.id)
      data.labels = picked.map(o => o.label)
      const parts = [...data.labels]
      if (answer.other) {
        data.other = oneLine(answer.other)
        parts.push(t(L, 'rOther', { x: clip(answer.other) }))
      }
      summary = t(L, 'rChose', { x: joinList(parts) })
      break
    }
    case 'checklist': {
      const done = card.items.filter(i => answer.checked.includes(i.id))
      const open = card.items.filter(i => !answer.checked.includes(i.id))
      data.done_ids = done.map(i => i.id)
      data.open_ids = open.map(i => i.id)
      data.done = done.map(i => i.text)
      data.open = open.map(i => i.text)
      summary = open.length
        ? `${t(L, 'rChecklist', { done: done.length, total: card.items.length })} ${t(L, 'rStillOpen', {
            x: joinList(data.open)
          })}`
        : t(L, 'rChecklistAll', { total: card.items.length })
      break
    }
    case 'compare': {
      const col = card.columns.find(c => c.id === answer.selected)
      data.selected = col.id
      data.label = col.title
      summary = t(L, 'rPicked', { x: clip(col.title) })
      break
    }
    case 'form': {
      data.values = {}
      const parts = []
      for (const field of card.fields) {
        const value = answer.values[field.name]
        data.values[field.name] = value === undefined ? null : value
        if (value === '' || value === null || value === undefined) continue
        parts.push(`${clip(field.label, 30)}: ${clip(formValueText(field, value, L), 40)}`)
      }
      summary = t(L, 'rForm', { x: parts.join(', ') || '–' })
      break
    }
    case 'confirm': {
      data.decision = answer.decision
      if (answer.decision === 'yes') {
        summary = t(L, 'rYes', { x: clip(card.title) })
      } else if (answer.decision === 'no') {
        mark = '✗'
        summary = t(L, 'rNo', { x: clip(card.title) })
      } else {
        mark = '✎'
        data.change = String(answer.change ?? '').trim()
        summary = t(L, 'rChange', { x: clip(answer.change, 120) })
      }
      break
    }
    case 'rating': {
      data.value = answer.value
      data.scale = card.scale
      if (answer.comment && String(answer.comment).trim()) data.comment = String(answer.comment).trim()
      summary = t(L, 'rRated', { n: answer.value, max: card.scale })
      if (data.comment) summary += `: “${clip(data.comment)}”`
      break
    }
    case 'slider': {
      data.value = answer.value
      if (card.unit) data.unit = card.unit
      summary = t(L, 'rChose', { x: card.unit ? `${answer.value} ${card.unit}` : String(answer.value) })
      break
    }
    case 'schedule': {
      if (answer.none) {
        mark = '✗'
        data.none = true
        summary = t(L, 'rNone')
      } else {
        const picked = card.slots.filter(s => answer.selected.includes(s.id))
        data.selected = picked.map(s => {
          const out = { id: s.id, start: s.start }
          if (s.end) out.end = s.end
          if (s.label) out.label = s.label
          return out
        })
        const texts = picked.map(s => (s.label ? `${formatSlot(s, card, L)} (${s.label})` : formatSlot(s, card, L)))
        summary = t(L, picked.length > 1 ? 'rSlots' : 'rSlot', { x: texts.join('; ') })
      }
      break
    }
    case 'steps': {
      if (answer.stuck) {
        mark = '⚠'
        data.stuck = answer.stuck
        data.title = card.steps[answer.stuck - 1].title
        if (answer.note && String(answer.note).trim()) data.note = String(answer.note).trim()
        summary = t(L, 'rStuck', { n: answer.stuck, x: clip(data.title) })
      } else {
        data.completed = true
        data.steps = card.steps.length
        summary = t(L, 'rSteps', { n: card.steps.length })
      }
      break
    }
    case 'quiz': {
      data.answers = card.questions.map((q, i) => ({
        q: i + 1,
        chosen: answer.chosen[i],
        correct: answer.chosen[i] === q.answer
      }))
      data.score = data.answers.filter(a => a.correct).length
      data.total = card.questions.length
      summary = t(L, 'rQuiz', { score: data.score, total: data.total })
      break
    }
    default: {
      // Card types in their own files (81-…js) register a builder: (card, answer, lang, data) => { mark?, summary }.
      const extra = REPLY_BUILDERS[card.type]
      if (!extra) throw new Error(`no reply for card type ${card.type}`)
      const built = extra(card, answer, L, data)
      if (built.mark) mark = built.mark
      summary = built.summary
    }
  }

  let reply = fitReply(mark, summary, data)
  if (card.type === 'checklist' && !reply.fits) {
    delete data.done
    delete data.open
    data.done_count = data.done_ids.length
    data.open_count = data.open_ids.length
    reply = fitReply(mark, summary, data)
  }
  return reply
}

// Preserve the machine payload; only the human-readable summary may be shortened.
function fitReply(mark, summary, data) {
  const suffix = `\n${REPLY_TAG} ${JSON.stringify(data)}`
  const available = MAX_REPLY - [...`${mark} ${suffix}`].length
  summary = clip(summary, Math.max(0, available))
  const text = `${mark} ${summary}${suffix}`
  return { mark, summary, data, text, fits: [...text].length <= MAX_REPLY }
}
