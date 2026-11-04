// Card state that must survive reopening the chat: the sent answer (no second send)
// and work in progress (checklist ticks, form drafts). Kept in ctx.storage (plugin-
// scoped, on this computer), keyed by session and card; the oldest cards are dropped beyond a cap.

const STORE_CAP = 300
const ANSWER_CAP = 5000
const memoryStorage = () => {
  const map = new Map()
  return {
    get: (key, fallback) => (map.has(key) ? map.get(key) : fallback),
    set: (key, value) => void map.set(key, value),
    remove: key => void map.delete(key)
  }
}

let cardStorage = memoryStorage()
const cardListeners = new Map()

function useStorage(storage) {
  cardStorage = storage || memoryStorage()

}

function readCard(cardId) {
  const value = cardStorage.get(`card.${cardId}`, null)
  const answer = cardStorage.get(`answer.${cardId}`, null)
  return { ...(value && typeof value === 'object' ? value : {}), ...(answer ? { answer } : {}) }
}

function saveAnswer(cardId, answer) {
  cardStorage.set(`answer.${cardId}`, answer)
  const existing = cardStorage.get('answerIndex', [])
  const answers = Array.isArray(existing) ? existing.filter(id => id !== cardId) : []
  answers.push(cardId)
  while (answers.length > ANSWER_CAP) cardStorage.remove(`answer.${answers.shift()}`)
  cardStorage.set('answerIndex', answers)
}

function writeCard(cardId, patch) {
  const next = { ...readCard(cardId), ...patch, touched: Date.now() }
  if (patch.answer) saveAnswer(cardId, patch.answer)
  // Answer tombstones are stored separately so draft eviction cannot remove them.
  const { answer, ...draftRecord } = next
  cardStorage.set(`card.${cardId}`, draftRecord)
  const index = cardStorage.get('index', [])
  const list = Array.isArray(index) ? index.filter(id => id !== cardId) : []
  list.push(cardId)
  while (list.length > STORE_CAP) {
    const old = list.shift()
    cardStorage.remove(`card.${old}`)
  }
  cardStorage.set('index', list)
  for (const fn of cardListeners.get(cardId) || []) fn(next)
  return next
}

function subscribeCard(cardId, fn) {
  if (!cardListeners.has(cardId)) cardListeners.set(cardId, new Set())
  cardListeners.get(cardId).add(fn)
  return () => {
    const set = cardListeners.get(cardId)
    set.delete(fn)
    if (!set.size) cardListeners.delete(cardId)
  }
}

function useCardRecord(cardId) {
  const [record, setRecord] = useState(() => cardId ? readCard(cardId) : {})
  useEffect(() => {
    setRecord(cardId ? readCard(cardId) : {})
    if (cardId) return subscribeCard(cardId, setRecord)
  }, [cardId])
  return record
}

// ── Answers kept by the plugin's backend (dashboard/plugin_api.py) ──
// A card answered in another window, in the Webapp or on another computer is locked here too.
// Each mounted card asks once (batched per chat, cached for SERVER_TTL); the backend's
// `answer.recorded` event locks cards that are already on screen. ctx.storage stays the fast
// path and the offline fallback: without the route (an older Hermes, a remote backend without
// the agent half, a failed request) cards behave exactly as before, silently.
// When the two disagree the server wins: an answer it knows locks the card. A local answer the
// server never received (it tracks the card as shown and unanswered) is released after
// SERVER_GRACE, so a click that got lost on the way does not leave a dead card behind.

const SERVER_TTL = 60 * 1000
const SERVER_GRACE = 10 * 60 * 1000
const SERVER_BATCH = 50
const SERVER_MARKS = ['✓', '✗', '✎', '⚠']
let serverRest = null
const serverChecked = new Map() // key -> time asked
const serverQueue = new Map() // sessionId -> Map(cardId -> card type)
let serverTimer = null
let serverPaused = 0 // no requests before this time (after a failure)
let serverInflight = Promise.resolve()

function useServerAnswers(rest) {
  serverRest = typeof rest === 'function' ? rest : null
  serverChecked.clear()
  serverQueue.clear()
  serverPaused = 0
}

function askServer(sessionId, card) {
  if (!serverRest || !sessionId || !card || typeof card.cardId !== 'string') return
  const key = `${sessionId}\u0000${card.cardId}`
  const now = Date.now()
  if (now < serverPaused || now - (serverChecked.get(key) || 0) < SERVER_TTL) return
  serverChecked.set(key, now)
  if (!serverQueue.has(sessionId)) serverQueue.set(sessionId, new Map())
  serverQueue.get(sessionId).set(card.cardId, card.type)
  if (!serverTimer) serverTimer = setTimeout(() => { serverInflight = flushServer() }, 25)
}

async function flushServer() {
  serverTimer = null
  const rest = serverRest
  const batches = [...serverQueue]
  serverQueue.clear()
  for (const [sessionId, cards] of batches) {
    const ids = [...cards.keys()]
    for (let i = 0; i < ids.length; i += SERVER_BATCH) {
      const chunk = ids.slice(i, i + SERVER_BATCH)
      let reply
      try {
        reply = await rest(`/answers?session=${encodeURIComponent(sessionId)}&cards=${chunk.map(encodeURIComponent).join(',')}`, { timeoutMs: 8000 })
      } catch {
        // Route missing or backend away: keep the local state, try again after a pause.
        serverPaused = Date.now() + SERVER_TTL
        for (const id of chunk) serverChecked.delete(`${sessionId}\u0000${id}`)
        continue
      }
      applyServerReply(sessionId, chunk.map(id => [id, cards.get(id)]), reply)
    }
  }
}

function applyServerReply(sessionId, cards, reply) {
  if (!reply || typeof reply !== 'object') return
  const answers = reply.answers && typeof reply.answers === 'object' ? reply.answers : {}
  const open = new Set(Array.isArray(reply.open) ? reply.open : [])
  for (const [cardId, type] of cards) {
    const key = `${sessionId}\u0000${cardId}`
    if (Object.prototype.hasOwnProperty.call(answers, cardId)) applyServerAnswer(key, cardId, type, answers[cardId])
    else if (open.has(cardId)) releaseLostAnswer(key)
  }
}

const isPlain = v => v !== null && typeof v === 'object' && !Array.isArray(v)
const isScalar = v => v === null || ['string', 'number', 'boolean'].includes(typeof v)
// What the cards read from an answer's data, per type ('!' = required). The data comes from a chat
// message, so it is checked before a card renders it: S string[], N number[], o {key: scalar},
// a [{key: scalar}], s/n/b scalars. Types not listed here are taken as they are.
const ANSWER_SHAPES = {
  choice: { selected: 'S!', labels: 'S', other: 's' },
  checklist: { done_ids: 'S!', open_ids: 'S', done: 'S', open: 'S', done_count: 'n', open_count: 'n' },
  compare: { selected: 's!', label: 's' },
  form: { values: 'o!' },
  confirm: { decision: 's!', change: 's' },
  rating: { value: 'n!', scale: 'n', comment: 's' },
  slider: { value: 'n!', unit: 's' },
  schedule: { selected: 'a', none: 'b' },
  steps: { completed: 'b', steps: 'n', stuck: 'n', title: 's', note: 's' },
  quiz: { score: 'n!', total: 'n!', answers: 'a!' },
  plan: { steps: 'a' },
  review: { keep: 'S', drop: 'S', undecided: 'S', notes: 'o', titles: 'o' },
  decision: { weights: 'o', ranking: 'a', picked: 's' },
  calc: { inputs: 'o', outputs: 'a' },
  rank: { order: 'S', labels: 'S' },
  recipe: { servings: 'n', missing: 'a', have: 'S' },
  flashcards: { known: 'N', again: 'N', rounds: 'n' }
}
const SHAPE_CHECKS = {
  s: v => typeof v === 'string',
  n: v => typeof v === 'number' && Number.isFinite(v),
  b: v => typeof v === 'boolean',
  S: v => Array.isArray(v) && v.every(x => typeof x === 'string'),
  N: v => Array.isArray(v) && v.every(x => typeof x === 'number' && Number.isFinite(x)),
  o: v => isPlain(v) && Object.values(v).every(isScalar),
  a: v => Array.isArray(v) && v.every(x => isPlain(x) && Object.values(x).every(isScalar))
}

function answerDataFits(type, cardId, data) {
  if (!isPlain(data) || data.card !== cardId || data.type !== type) return false
  for (const [field, spec] of Object.entries(ANSWER_SHAPES[type] || {})) {
    if (data[field] === undefined) {
      if (spec.endsWith('!')) return false
    } else if (!SHAPE_CHECKS[spec[0]](data[field])) return false
  }
  return true
}

function applyServerAnswer(key, cardId, type, rec) {
  if (!isPlain(rec) || readCard(key).answer) return // this window's own receipt stays
  if (!answerDataFits(type, cardId, rec.data)) return // not an answer this card can show
  const answer = {
    mark: SERVER_MARKS.includes(rec.mark) ? rec.mark : '✓',
    summary: typeof rec.summary === 'string' ? rec.summary.slice(0, 300) : '',
    data: rec.data,
    at: Number.isFinite(rec.at) && rec.at > 0 ? rec.at : Date.now(),
    source: 'server'
  }
  writeCard(key, { answer })
}

function releaseLostAnswer(key) {
  const answer = cardStorage.get(`answer.${key}`, null)
  if (!answer || answer.source === 'server' || !(Date.now() - (Number(answer.at) || 0) > SERVER_GRACE)) return
  cardStorage.remove(`answer.${key}`)
  const index = cardStorage.get('answerIndex', [])
  if (Array.isArray(index)) cardStorage.set('answerIndex', index.filter(id => id !== key))
  const next = readCard(key)
  for (const fn of cardListeners.get(key) || []) fn(next)
}

// The backend's live event (hui_cards/tool.py broadcasts it when a turn starts with a card answer).
function onAnswerRecorded(event) {
  const payload = event && isPlain(event.payload) ? event.payload : null
  if (!payload || typeof payload.session_id !== 'string' || typeof payload.card !== 'string') return
  const key = `${payload.session_id}\u0000${payload.card}`
  const type = mountedTypes.get(key)
  if (type) applyServerAnswer(key, payload.card, type, payload.answer)
}

// Cards on screen (key -> type), so a live event is applied only to a card this window shows.
const mountedTypes = new Map()

function useServerAnswer(card, sessionId) {
  useEffect(() => {
    if (!sessionId || !card || !card.cardId) return
    const key = `${sessionId}\u0000${card.cardId}`
    mountedTypes.set(key, card.type)
    askServer(sessionId, card)
    return () => { if (mountedTypes.get(key) === card.type) mountedTypes.delete(key) }
  }, [sessionId, card && card.cardId, card && card.type])
}

// Resolves once queued and running answer requests are done (tests, and nothing else waits on it).
async function serverIdle() {
  while (serverTimer) await new Promise(resolve => setTimeout(resolve, 10))
  await serverInflight
}

// ── Display settings (Settings → Plugins), applied live to cards already on screen ──
// A card starts with the `display` its tool result carries; once the backend has been read
// (first card on screen, and after every save in Settings → Plugins) the current values win.

let liveDisplay = null
let lastResultDisplay = null
const displayListeners = new Set()

function setLiveDisplay(display) {
  if (!display) return
  const same = liveDisplay && Object.keys(display).every(k => liveDisplay[k] === display[k])
  liveDisplay = display
  if (!same) for (const fn of displayListeners) fn(display)
}

function useLiveDisplay(initial) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick(n => n + 1)
    displayListeners.add(fn)
    return () => void displayListeners.delete(fn)
  }, [])
  return liveDisplay ? { ...(initial || {}), ...liveDisplay } : initial
}
