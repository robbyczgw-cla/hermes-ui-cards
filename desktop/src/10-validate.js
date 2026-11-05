// Port of hui_cards/schema.py. Keep traversal and message order in sync.
// JavaScript numbers do not retain Python's int/float distinction (3 vs 3.0),
// or integers beyond IEEE-754 precision. Callers should use JSON-safe numbers.
// That distinction also affects Python's serialized byte count. Integer-like
// unknown keys follow JS enumeration order; all schema property names retain
// insertion order. Exact parity outside these limits needs a lossless parser
// and an input representation that carries numeric types and object ordering.
const CARD_TYPES = Object.keys(SCHEMA.cards)
const vc_validateCard = (() => {
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
  const object = v => v !== null && typeof v === 'object' && !Array.isArray(v)
  const whitespace = '[\\u0009-\\u000d\\u001c-\\u0020\\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]'
  const stripRE = new RegExp(`^${whitespace}+|${whitespace}+$`, 'g')
  const spaceRE = new RegExp(whitespace)
  const strip = s => s.replace(stripRE, '')
  const clean = s => strip(s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[\x00-\x08\x0b-\x1f\x7f]/g, ''))
  const length = s => [...s].length
  const first = (s, n) => [...s].slice(0, n).join('')
  const kind = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number') : typeof v === 'object' ? 'object' : typeof v
  const resolve = spec => spec.$ref == null ? spec : { ...SCHEMA.definitions[spec.$ref], ...Object.fromEntries(Object.entries(spec).filter(([k]) => k !== '$ref')) }
  const fmt = n => {
    if (Number.isInteger(n)) return BigInt(n).toString()
    return pyJSON(n)
  }

  // json.dumps(..., ensure_ascii=False), including Python's default separators.
  // This is deliberately separate from the card's wire representation.
  // undefined → absent (objects) / null (arrays), like JSON; everything else (also Infinity) unchanged.
  function vc_dropUndefined(v) {
    if (Array.isArray(v)) return v.map(x => (x === undefined ? null : vc_dropUndefined(x)))
    if (v && typeof v === 'object') {
      const out = {}
      for (const [k, x] of Object.entries(v)) {
        // defineProperty: a key named "__proto__" stays a plain field (it is reported as unknown).
        if (x !== undefined) Object.defineProperty(out, k, { value: vc_dropUndefined(x), enumerable: true, writable: true, configurable: true })
      }
      return out
    }
    return v
  }

  function pyJSON(v) {
    if (v === null) return 'null'
    if (typeof v === 'string') return JSON.stringify(v)
    if (typeof v === 'boolean') return v ? 'true' : 'false'
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return Number.isNaN(v) ? 'NaN' : v < 0 ? '-Infinity' : 'Infinity'
      if (Number.isInteger(v)) return BigInt(v).toString()
      const abs = Math.abs(v)
      const s = abs !== 0 && (abs < 1e-4 || abs >= 1e16) ? v.toExponential() : String(v)
      return s.replace(/e([+-]?)(\d+)$/, (_, sign, digits) => `e${sign || '+'}${digits.padStart(2, '0')}`)
    }
    if (Array.isArray(v)) return '[' + v.map(pyJSON).join(', ') + ']'
    return '{' + Object.entries(v).map(([k, item]) => JSON.stringify(k) + ': ' + pyJSON(item)).join(', ') + '}'
  }
  function utf8Length(s) {
    let n = 0
    for (const ch of s) {
      const cp = ch.codePointAt(0)
      n += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4
    }
    return n
  }
  function distance(a, b) {
    a = [...a]; b = [...b]
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
    for (let i = 0; i < a.length; i++) {
      const cur = [i + 1]
      for (let j = 0; j < b.length; j++) cur.push(Math.min(prev[j + 1] + 1, cur[j] + 1, prev[j] + (a[i] !== b[j])))
      prev = cur
    }
    return prev[b.length]
  }
  function suggest(key, known) {
    const [head, ...rest] = key.split('_')
    const camel = head + rest.map(p => first(p, 1).toUpperCase() + [...p].slice(1).join('')).join('')
    if (known.includes(camel) && camel !== key) return ` (did you mean "${camel}"?)`
    let best = null, bestD = null
    for (const name of known) {
      const d = distance(key.toLowerCase(), name.toLowerCase())
      if (bestD === null || d < bestD) { best = name; bestD = d }
    }
    return best !== null && bestD <= Math.max(1, Math.floor(length(key) / 3)) ? ` (did you mean "${best}"?)` : ''
  }
  // Python's \d/int accept Unicode decimal digits as well as ASCII.
  function decimal(s) {
    const zeros = [0x30,0x660,0x6f0,0x7c0,0x966,0x9e6,0xa66,0xae6,0xb66,0xbe6,0xc66,0xce6,0xd66,0xde6,0xe50,0xed0,0xf20,0x1040,0x1090,0x17e0,0x1810,0x1946,0x19d0,0x1a80,0x1a90,0x1b50,0x1bb0,0x1c40,0x1c50,0xa620,0xa8d0,0xa900,0xa9d0,0xa9f0,0xaa50,0xabf0,0xff10,0x104a0,0x10d30,0x11066,0x110f0,0x11136,0x111d0,0x112f0,0x11450,0x114d0,0x11650,0x116c0,0x11730,0x118e0,0x11950,0x11c50,0x11d50,0x11da0,0x16a60,0x16ac0,0x16b50,0x1d7ce,0x1d7d8,0x1d7e2,0x1d7ec,0x1d7f6,0x1e140,0x1e2f0,0x1e950,0x1fbf0]
    return [...s].map(c => { const cp = c.codePointAt(0), z = zeros.find(z => cp >= z && cp <= z + 9); return z === undefined ? c : String(cp - z) }).join('')
  }
  function coerce(value, types, path, ctx) {
    const k = kind(value)
    if (types.includes(k) || (k === 'integer' && types.includes('number'))) return [true, value]
    if (k === 'string') {
      const s = strip(value), numeric = decimal(s)
      if (types.includes('boolean') && ['true', 'false'].includes(s.toLowerCase())) {
        ctx.warnings.push(`${path}: read the string "${s}" as a boolean`)
        return [true, s.toLowerCase() === 'true']
      }
      if ((types.includes('integer') && /^-?\d+$/.test(numeric)) || (types.includes('number') && /^-?\d+(\.\d+)?$/.test(numeric))) {
        ctx.warnings.push(`${path}: read the string "${s}" as a number`)
        return [true, Number(numeric)]
      }
    }
    return [false, value]
  }
  function datetime(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}:\d{2})?$/.exec(s)
    if (!m) return null
    const [y, mo, day, h, min, sec] = m.slice(1, 7).map(n => Number(n || 0))
    const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    const zone = m[8], offset = !zone || zone === 'Z' ? 0 : (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4))) * (zone[0] === '-' ? -1 : 1)
    if (y < 1 || mo < 1 || mo > 12 || day < 1 || day > days[mo - 1] || h > 23 || min > 59 || sec > 59 || Math.abs(offset) >= 1440) return null
    const d = new Date(0)
    d.setUTCFullYear(y, mo - 1, day); d.setUTCHours(h, min, sec, 0)
    return { ms: d.getTime(), fraction: BigInt((m[7] || '').padEnd(6, '0')), zone, offset }
  }
  function iso(s) {
    const dt = datetime(s)
    let ms = dt.ms
    if (dt.zone) {
      const local = new Date(ms - dt.offset * 60000), wall = new Date(0)
      wall.setUTCFullYear(local.getFullYear(), local.getMonth(), local.getDate())
      wall.setUTCHours(local.getHours(), local.getMinutes(), local.getSeconds(), 0)
      ms = wall.getTime()
    }
    return BigInt(ms) * 1000n + dt.fraction
  }
  function ipv6(host) {
    const zone = host.indexOf('%')
    if (zone >= 0) {
      if (zone === host.length - 1 || host.slice(zone + 1).includes('%')) return false
      host = host.slice(0, zone)
    }
    if (host.includes('.')) {
      const cut = host.lastIndexOf(':'), v4 = host.slice(cut + 1).split('.')
      if (v4.length !== 4 || !v4.every(x => /^(0|[1-9]\d{0,2})$/.test(x) && Number(x) < 256)) return false
      host = host.slice(0, cut + 1) + '0:0'
    }
    if (!/^[0-9a-f:]+$/i.test(host) || host.split('::').length > 2) return false
    const parts = host.split('::'), groups = parts.flatMap(p => p === '' ? [] : p.split(':'))
    return groups.every(x => /^[0-9a-f]{1,4}$/i.test(x)) && (parts.length === 2 ? groups.length < 8 : groups.length === 8)
  }
  function httpsURL(s) {
    if (spaceRE.test(s)) return false
    const m = /^https:\/\/([^/?#]*)(?:[/?#]|$)/i.exec(s)
    if (!m) return false
    const netloc = m[1], at = netloc.lastIndexOf('@')
    if (at >= 0 && netloc.slice(0, at).replace(':', '') !== '') return false
    // urlsplit rejects delimiters introduced by NFKC normalization of netloc.
    const normalized = netloc.replace(/[@:#?]/g, '').normalize('NFKC')
    if (/[/?#@:]/.test(normalized)) return false
    const hostport = netloc.slice(at + 1)
    let host
    if (hostport.includes('[') || hostport.includes(']')) {
      const b = /^\[([^\]]*)\](?::.*)?$/.exec(hostport)
      if (!b || !(ipv6(b[1]) || /^v[0-9a-fA-F]+\..+$/.test(b[1]))) return false
      host = b[1]
    } else host = hostport.split(':')[0]
    return host.includes('.')
  }
  function checkFormat(format, value, path, ctx) {
    if (format === 'https-url' && !httpsURL(value)) ctx.errors.push(`${path}: must be an https:// URL (got "${first(value, 60)}")`)
    else if (format === 'datetime' && !datetime(value)) ctx.errors.push(`${path}: must be an ISO 8601 date and time like 2026-11-12T14:00 (got "${first(value, 40)}")`)
    else if (format === 'no-space' && spaceRE.test(value)) ctx.errors.push(`${path}: must be a single emoji without spaces`)
    else return true
    return false
  }
  function checkValue(value, spec, path, ctx) {
    spec = resolve(spec)
    const types = Array.isArray(spec.type) ? spec.type : [spec.type]
    const [ok, coerced] = coerce(value, types, path, ctx)
    value = coerced
    if (!ok) { ctx.errors.push(`${path}: must be ${types.join(' or ')} (got ${kind(value)})`); return null }
    const k = kind(value)
    if (k === 'string') {
      value = clean(value)
      const n = length(value)
      if (own(spec, 'minLength') && n < spec.minLength) { ctx.errors.push(spec.minLength === 1 ? `${path}: must not be empty` : `${path}: at least ${spec.minLength} characters`); return null }
      if (own(spec, 'maxLength') && n > spec.maxLength) { ctx.errors.push(`${path}: at most ${spec.maxLength} characters (got ${n})`); return null }
      if (own(spec, 'enum') && !spec.enum.includes(value)) { ctx.errors.push(`${path}: must be one of ${spec.enum.join(', ')} (got "${first(value, 40)}")`); return null }
      if (own(spec, 'pattern') && !new RegExp(spec.pattern).test(value)) { ctx.errors.push(`${path}: "${first(value, 40)}" does not match ${spec.pattern}`); return null }
      if (own(spec, 'format') && !checkFormat(spec.format, value, path, ctx)) return null
    } else if (k === 'integer' || k === 'number') {
      if (!Number.isFinite(value)) { ctx.errors.push(`${path}: must be a finite number`); return null }
      if (own(spec, 'minimum') && value < spec.minimum) { ctx.errors.push(`${path}: must be at least ${fmt(spec.minimum)} (got ${fmt(value)})`); return null }
      if (own(spec, 'maximum') && value > spec.maximum) { ctx.errors.push(`${path}: must be at most ${fmt(spec.maximum)} (got ${fmt(value)})`); return null }
    } else if (k === 'array') {
      if (own(spec, 'minItems') && value.length < spec.minItems) { ctx.errors.push(`${path}: needs at least ${spec.minItems} items (got ${value.length})`); return null }
      if (own(spec, 'maxItems') && value.length > spec.maxItems) { ctx.errors.push(`${path}: at most ${spec.maxItems} items (got ${value.length})`); return null }
      const out = []
      for (let i = 0; i < value.length; i++) {
        const before = ctx.errors.length, cleaned = checkValue(value[i], spec.items || {}, `${path}[${i}]`, ctx)
        if (ctx.errors.length === before) out.push(cleaned)
      }
      return out
    } else if (k === 'object') return checkObject(value, spec, path, ctx)
    return value
  }
  function checkObject(value, spec, path, ctx, extra = {}) {
    const props = { ...extra, ...spec.properties }, out = {}, required = spec.required || []
    for (const key of required) if (!own(value, key) || value[key] === null) ctx.errors.push(`${path}.${key}: required`)
    for (const [key, item] of Object.entries(value)) {
      if (!own(props, key) && spec.additionalProperties) { const before = ctx.errors.length, cleaned = checkValue(item, spec.additionalProperties, `${path}.${key}`, ctx); if (before === ctx.errors.length) Object.defineProperty(out, key, {value: cleaned, enumerable: true, writable: true, configurable: true}); continue }
      if (!own(props, key)) { ctx.warnings.push(`${path}.${key}: unknown field, ignored${suggest(key, Object.keys(props))}`); continue }
      if (item === null && !required.includes(key)) continue
      const before = ctx.errors.length, cleaned = checkValue(item, props[key], `${path}.${key}`, ctx)
      if (ctx.errors.length === before) Object.defineProperty(out, key, { value: cleaned, enumerable: true, writable: true, configurable: true })
    }
    for (const [key, rawSpec] of Object.entries(props)) {
      const pspec = resolve(rawSpec)
      if (!own(out, key) && own(pspec, 'default')) out[key] = JSON.parse(JSON.stringify(pspec.default))
    }
    return out
  }
  function uniqueIds(card, key, ctx) {
    const seen = new Set()
    for (const [i, item] of (card[key] || []).entries()) {
      if (item.id == null) continue
      if (seen.has(item.id)) ctx.errors.push(`card.${key}[${i}].id: duplicate id "${item.id}"`)
      seen.add(item.id)
    }
  }
  function rule(name, card, ctx) {
    const unique = { uniqueOptionIds: 'options', uniqueItemIds: 'items', uniqueColumnIds: 'columns', uniqueSlotIds: 'slots', uniqueStepIds: 'steps', uniqueCriterionIds: 'criteria', uniqueIngredientIds: 'ingredients' }
    if (own(unique, name)) uniqueIds(card, unique[name], ctx)
    else if (name === 'uniqueInputNames') {
      const seen = new Set(); for (const [i, item] of card.inputs.entries()) { if (seen.has(item.name)) ctx.errors.push(`card.inputs[${i}].name: duplicate name "${item.name}"`); seen.add(item.name) }
    } else if (name === 'scoresMatchCriteria') {
      const ids = card.criteria.map(c => c.id)
      for (const [i, option] of card.options.entries()) { for (const key of ids) if (!own(option.scores,key)) ctx.errors.push(`card.options[${i}].scores: missing criterion "${key}"`); for (const key of Object.keys(option.scores)) if (!ids.includes(key)) ctx.errors.push(`card.options[${i}].scores: unknown criterion "${key}"`) }
    } else if (name === 'calcExpressions') {
      const names = card.inputs.map(x => x.name)
      for (const [i, output] of card.outputs.entries()) { const parsed = calcParse(output.expr,names); if (!Array.isArray(parsed)) ctx.errors.push(`card.outputs[${i}].expr: ${parsed.message} at ${parsed.at}`) }
    } else if (name === 'calcInputs') {
      for (const [i, item] of card.inputs.entries()) {
        const p=`card.inputs[${i}]`, lo=item.min, hi=item.max, d=item.default
        if (lo != null && hi != null && lo >= hi) ctx.errors.push(`${p}.min: must be smaller than max`)
        if ((lo != null && d < lo) || (hi != null && d > hi)) ctx.errors.push(`${p}.default: outside range`)
        if (item.step != null && item.step <= 0) ctx.errors.push(`${p}.step: must be larger than 0`)
        if (item.kind === 'select') { if (!item.options) ctx.errors.push(`${p}.options: required for kind select`); else if (!item.options.some(x => x.value === d)) ctx.errors.push(`${p}.default: must be one of the options`) }
        if (item.kind === 'toggle' && d !== 0 && d !== 1) ctx.errors.push(`${p}.default: must be 0 or 1 for kind toggle`)
      }
    }
    else if (name === 'minMaxPicks') {
      const n = (card.options || []).length, lo = card.min, hi = card.max
      if (!card.multiple && (lo != null || hi != null)) { ctx.warnings.push('card.min/max: only used with multiple: true, ignored'); delete card.min; delete card.max; return }
      if (lo != null && lo > n) ctx.errors.push(`card.min: ${lo} is more than the ${n} options`)
      if (hi != null && hi > n) card.max = n
      if (lo != null && hi != null && lo > hi) ctx.errors.push(`card.min: ${lo} is larger than max ${hi}`)
    } else if (name === 'rowsMatchColumns') {
      const n = (card.columns || []).length
      for (const [i, row] of (card.rows || []).entries()) if ((row.values || []).length !== n) ctx.errors.push(`card.rows[${i}].values: needs ${n} values, one per column (got ${(row.values || []).length})`)
    } else if (name === 'rowSourcesMatchValues') {
      for (const [i, row] of (card.rows || []).entries()) if (row.sources && row.sources.length !== (row.values || []).length) ctx.errors.push(`card.rows[${i}].sources: needs ${(row.values || []).length} sources, one per value (got ${row.sources.length})`)
    } else if (name === 'rowBestInColumns') {
      const n = (card.columns || []).length
      for (const [i, row] of (card.rows || []).entries()) if (row.best != null && row.best >= n) ctx.errors.push(`card.rows[${i}].best: ${row.best} is not a column index (0..${n - 1})`)
    } else if (name === 'singleBest') {
      const n = (card.columns || []).filter(c => c.best).length
      if (n > 1) ctx.errors.push(`card.columns: only one column may have best: true (got ${n})`)
    } else if (name === 'uniqueFieldNames') {
      const seen = new Set()
      for (const [i, f] of (card.fields || []).entries()) {
        if (seen.has(f.name)) ctx.errors.push(`card.fields[${i}].name: duplicate name "${f.name}"`)
        seen.add(f.name)
      }
    } else if (name === 'fieldKindRules') {
      for (const [i, f] of (card.fields || []).entries()) {
        const p = `card.fields[${i}]`, k = f.kind
        if (k === 'select' && !(f.options || []).length) ctx.errors.push(`${p}.options: required for kind select`)
        if (k !== 'select' && own(f, 'options')) { ctx.warnings.push(`${p}.options: only used with kind select, ignored`); delete f.options }
        if (own(f, 'min') && own(f, 'max') && f.min > f.max) ctx.errors.push(`${p}.min: ${fmt(f.min)} is larger than max ${fmt(f.max)}`)
        const d = f.default
        if (d == null) continue
        if (k === 'toggle' && typeof d !== 'boolean') ctx.errors.push(`${p}.default: must be true or false for kind toggle`)
        else if (k === 'number' && typeof d !== 'number') ctx.errors.push(`${p}.default: must be a number for kind number`)
        else if (k === 'select' && !(f.options || []).includes(d)) ctx.errors.push(`${p}.default: must be one of the options`)
        else if (!['toggle', 'number', 'select'].includes(k) && typeof d !== 'string') ctx.errors.push(`${p}.default: must be text for kind ${k}`)
      }
    } else if (name === 'planOffOptional') {
      for (const [i, step] of card.steps.entries()) if (step.off && !step.optional) ctx.errors.push(`card.steps[${i}].off: only allowed when optional is true`)
    } else if (name === 'sliderRange') {
      const lo = card.min, hi = card.max
      if (lo == null || hi == null) return
      if (lo >= hi) { ctx.errors.push(`card.min: ${fmt(lo)} must be smaller than max ${fmt(hi)}`); return }
      if (card.step != null && card.step <= 0) ctx.errors.push('card.step: must be larger than 0')
      if (card.default != null && !(lo <= card.default && card.default <= hi)) ctx.errors.push(`card.default: ${fmt(card.default)} is outside ${fmt(lo)}..${fmt(hi)}`)
    } else if (name === 'slotOrder') {
      for (const [i, s] of (card.slots || []).entries()) if (own(s, 'end') && iso(s.end) <= iso(s.start)) ctx.errors.push(`card.slots[${i}].end: must be after start`)
    } else if (name === 'quizAnswers') {
      for (const [i, q] of (card.questions || []).entries()) {
        const n = (q.options || []).length, a = q.answer
        if (a != null && n && a >= n) ctx.errors.push(`card.questions[${i}].answer: ${a} is not an option index (0..${n - 1})`)
      }
    }
  }
  function assignIds(card) {
    const prefixes = { options: 'o', items: 'i', columns: 'c', slots: 's' }
    if (card.type === 'plan') prefixes.steps = 'p'
    if (card.type === 'review' || card.type === 'rank') prefixes.items = card.type === 'review' ? 'r' : 'k'
    if (card.type === 'recipe') prefixes.ingredients = 'g'
    for (const [key, prefix] of Object.entries(prefixes)) {
      const items = card[key]
      if (!Array.isArray(items) || !items.length || !object(items[0])) continue
      const used = new Set(items.filter(it => own(it, 'id')).map(it => it.id))
      items.forEach((it, i) => {
        if (!own(it, 'id')) {
          let id = `${prefix}${i + 1}`
          while (used.has(id)) id += 'x'
          it.id = id; used.add(id)
        }
      })
    }
  }
  return function validateCard(raw) {
    const ctx = { errors: [], warnings: [] }, reject = errors => ({ card: null, errors, warnings: [] })
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw) } catch { return reject(['card: must be a JSON object, got a string that is not JSON']) }
    }
    if (!object(raw)) return reject([`card: must be an object (got ${kind(raw)})`])
    // A card that reached JS (not JSON) may hold undefined fields: read it as the JSON it stands for.
    raw = vc_dropUndefined(raw)
    const size = utf8Length(pyJSON(raw)), limit = SCHEMA.limits.maxCardBytes
    if (size > limit) return reject([`card: too large (${size} bytes, limit ${limit}); split it or shorten the text`])
    const ctype = raw.type
    if (typeof ctype !== 'string' || !own(SCHEMA.cards, ctype)) {
      const got = typeof ctype === 'string' ? `"${ctype}"` : 'missing', hint = typeof ctype === 'string' ? suggest(ctype, CARD_TYPES) : ''
      return reject([`card.type: unknown card type ${got}${hint}; use one of: ${CARD_TYPES.join(', ')}`])
    }
    const spec = SCHEMA.cards[ctype], card = checkObject(raw, spec, 'card', ctx, SCHEMA.common.properties)
    if (!ctx.errors.length) for (const name of spec['x-rules'] || []) rule(name, card, ctx)
    if (ctx.errors.length) return { card: null, ...ctx }
    assignIds(card)
    return { card, ...ctx }
  }
})()

function validateCard(raw) {
  return vc_validateCard(raw)
}

// Bounded recursive-descent calculator; AST is shared with the Python evaluator.
function calcParse(expr, names) {
  let pos = 0
  const funcs = {min:[1,99],max:[1,99],round:[1,2],floor:[1,1],ceil:[1,1],sqrt:[1,1],abs:[1,1],pow:[2,2],log:[1,1],exp:[1,1],if:[3,3]}
  const fail = (message, at = pos) => { throw {message, at: [...expr.slice(0, at)].length} }
  const skip = () => { while (pos < expr.length && /[ \t\n\r]/.test(expr[pos])) pos++ }
  function parse(level=0, depth=0) {
    if (depth > 32) fail('maximum depth exceeded')
    skip()
    if (level < 3) {
      let left = parse(level+1, depth)
      const ops = [['<=','>=','==','!=','<','>'],['+','-'],['*','/']][level]
      while (true) { skip(); const op = ops.find(x => expr.startsWith(x,pos)); if (!op) break; pos += op.length; left = ['binary',op,left,parse(level+1,depth+1)] }
      return left
    }
    if (level === 3) {
      if (expr.startsWith('-',pos)) { pos++; return ['unary',parse(3,depth+1)] }
      let left = parse(4,depth); skip()
      if (expr.startsWith('^',pos)) { pos++; left=['binary','^',left,parse(3,depth+1)] }
      return left
    }
    skip(); const start = pos
    if (expr[pos] === '(') { pos++; const node=parse(0,depth+1); skip(); if (expr[pos] !== ')') fail('expected ")"'); pos++; return node }
    let m = expr.slice(pos).match(/^(?:\d+(?:\.\d*)?|\.\d+)/)
    if (m) { pos += m[0].length; const v=Number(m[0]); if (!Number.isFinite(v)) fail('invalid number',start); return ['number',v] }
    m=expr.slice(pos).match(/^[A-Za-z_][A-Za-z0-9_]*/)
    if (m) {
      const name=m[0]; pos+=name.length; skip()
      if (expr[pos] === '(') {
        if (!Object.prototype.hasOwnProperty.call(funcs,name)) fail(`unknown function "${name}"`,start)
        pos++; const args=[]; skip()
        if (expr[pos] !== ')') while (true) { args.push(parse(0,depth+1)); skip(); if (expr[pos] !== ',') break; pos++ }
        if (expr[pos] !== ')') fail('expected ")"'); pos++
        const [lo,hi]=funcs[name]; if (args.length<lo || args.length>hi) fail(`wrong number of arguments for "${name}"`,start)
        return ['call',name,args]
      }
      if (!names.includes(name)) fail(`unknown name "${name}"`,start)
      return ['name',name]
    }
    fail('expected expression')
  }
  try { if ([...expr].length > 300) throw {message:'expression too long', at:300}; const result=parse(); skip(); if (pos !== expr.length) fail('unexpected character'); return result } catch (e) { return e }
}
// For floor/ceil, snap within eight binary64 epsilons of a nonzero integer.
// Zero is excluded so tiny nonzero values keep their sign.
function calcIntegerBoundary(value) {
  const lower=Math.floor(value), nearest=value-lower<=0.5 ? lower : lower+1
  return nearest!==0 && Math.abs(value-nearest)<=8*Number.EPSILON*Math.abs(nearest) ? nearest : value
}
function calcEval(ast, values) {
  function ev(n) {
    const [type, op] = n
    let value
    if (type==='number') value=op
    else if (type==='name') value=Object.prototype.hasOwnProperty.call(values,op) ? values[op] : null
    else if (type==='unary') value=-ev(op)
    else if (type==='binary') {
      const a=ev(n[2]), b=ev(n[3])
      switch(op) { case '+':value=a+b; break; case '-':value=a-b; break; case '*':value=a*b; break; case '/':value=a/b; break; case '^':value=Math.pow(a,b); break; case '<':value=+(a<b); break; case '<=':value=+(a<=b); break; case '>':value=+(a>b); break; case '>=':value=+(a>=b); break; case '==':value=+(a===b); break; case '!=':value=+(a!==b); break }
    } else if (op==='if') value=ev(n[2][ev(n[2][0]) ? 1 : 2])
    else {
      const a=n[2].map(ev)
      if (op==='round') {
        const digits=a.length>1?a[1]:0
        if (digits<0) throw new Error('negative digits')
        const f=10**Math.min(digits,12)
        value=Math.floor(a[0]*f+0.5)/f
      } else if (op==='floor' || op==='ceil') value=Math[op](calcIntegerBoundary(a[0]))
      else value=Math[op](...a)
    }
    if (!Number.isFinite(value)) throw new Error('invalid result')
    return value
  }
  try { return ev(ast) } catch { return null }
}

// Decimal half-away-from-zero on the shortest decimal representation of the value.
function calcFormat(value, output, card, lang) {
  if (!Number.isFinite(value)) return '–'
  const fmt=output.format || 'number', decimals=output.decimals ?? (fmt==='integer' ? 0 : 2)
  if (fmt==='percent') value*=100
  if (!Number.isFinite(value)) return '–'
  const negative=value<0, parts=Math.abs(value).toString().toLowerCase().split('e')
  const exponent=Number(parts[1] || 0), digits=parts[0].replace('.', ''), dot=(parts[0].indexOf('.')<0 ? parts[0].length : parts[0].indexOf('.'))+exponent
  const shift=dot+decimals
  let whole
  if (shift<=0) whole='0'
  else whole=(digits+'0'.repeat(Math.max(0,shift-digits.length))).slice(0,shift)
  const next=shift<0 ? '0' : (digits[shift] || '0')
  if (next>='5') whole=(BigInt(whole)+1n).toString()
  whole=whole.padStart(decimals+1,'0')
  let integer=decimals ? whole.slice(0,-decimals) : whole
  const fraction=decimals ? whole.slice(-decimals) : ''
  const de=String(lang || '').toLowerCase().startsWith('de')
  integer=integer.replace(/\B(?=(\d{3})+(?!\d))/g,de ? '.' : ',')
  let shown=(negative ? '-' : '')+integer+(decimals ? (de ? ',' : '.')+fraction : '')
  if (fmt==='currency') {
    const code=card.currency || 'EUR', symbol=(de ? {EUR:'€',USD:'$',GBP:'£',CAD:'CA$',JPY:'¥',AUD:'AU$'} : {EUR:'€',USD:'US$',GBP:'£',CAD:'CA$',JPY:'JP¥',AUD:'A$'})[code] || code
    if (de) shown+='\u00a0'+symbol
    else shown=(negative ? '-' : '')+symbol+(symbol===code ? '\u00a0' : '')+(negative ? shown.slice(1) : shown)
  }
  if (fmt==='percent') shown+=' %'
  if (output.unit) shown+=' '+output.unit
  return shown
}
