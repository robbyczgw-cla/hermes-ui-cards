// The message a card sends back (docs/protocol.md §2): line 1 for people, line 2
// `[hui-card] {json}` for the model. Pure functions, unit-tested.

const REPLY_TAG = '[hui-card]'
const MAX_REPLY = (SCHEMA.limits && SCHEMA.limits.maxReplyChars) || 4000
const SUMMARY_ITEM_MAX = 60

function oneLine(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function clip(value, max = SUMMARY_ITEM_MAX) {
  const s = oneLine(value)
  const chars = [...s]
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

// Naive ISO times are wall-clock times in the card's zone: show them as written.
// Times with an offset are converted into the card's zone (or the local one).
function formatSlot(slot, card, lang) {
  const locale = lang === 'de' ? 'de-DE' : 'en-GB'
  const zone = validTimeZone(card && card.timezone)
  const opts = start => ({
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(isNaiveIso(start) ? {} : zone ? { timeZone: zone } : {})
  })
  const timeOpts = start => ({
    hour: '2-digit',
    minute: '2-digit',
    ...(isNaiveIso(start) ? {} : zone ? { timeZone: zone } : {})
  })
  const start = new Date(slot.start)
  if (Number.isNaN(start.getTime())) return oneLine(slot.label || slot.start)
  let text = new Intl.DateTimeFormat(locale, opts(slot.start)).format(start)
  if (slot.end) {
    const end = new Date(slot.end)
    if (!Number.isNaN(end.getTime())) {
      const sameDay = start.toDateString() === end.toDateString()
      const endText = sameDay
        ? new Intl.DateTimeFormat(locale, timeOpts(slot.end)).format(end)
        : new Intl.DateTimeFormat(locale, opts(slot.end)).format(end)
      text += '–' + endText
    }
  }
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
    default:
      throw new Error(`no reply for card type ${card.type}`)
  }

  return fitReply(mark, summary, data)
}

// Keep the message under the cap: shorten line 1 first, then the longest strings in the data.
function fitReply(mark, summary, data) {
  const render = (s, d) => `${mark} ${s}\n${REPLY_TAG} ${JSON.stringify(d)}`
  let text = render(summary, data)
  if (text.length > MAX_REPLY) {
    summary = clip(summary, 200)
    text = render(summary, data)
  }
  let guard = 0
  while (text.length > MAX_REPLY && guard++ < 200) {
    const longest = longestString(data)
    if (!longest || longest.value.length <= 20) break
    const keep = Math.max(20, longest.value.length - (text.length - MAX_REPLY) - 1)
    longest.set([...longest.value].slice(0, keep).join('') + '…')
    text = render(summary, data)
  }
  return { mark, summary, data, text }
}

function longestString(root) {
  let best = null
  const walk = (node, set) => {
    if (typeof node === 'string') {
      if (!best || node.length > best.value.length) best = { value: node, set }
    } else if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, x => (node[i] = x)))
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) walk(node[k], x => (node[k] = x))
    }
  }
  walk(root, null)
  return best && best.set ? best : null
}
