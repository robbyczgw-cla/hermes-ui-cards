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

// A new chat starts with a runtime session id and gets its stored id a moment later: carry what
// the user already did (draft, answer) over to the new key instead of starting the card again.
function adoptCard(fromKey, toKey) {
  if (!fromKey || !toKey || fromKey === toKey) return
  const old = readCard(fromKey)
  const cur = readCard(toKey)
  const patch = {}
  if (old.answer && !cur.answer) patch.answer = old.answer
  if (old.draft && !cur.draft) patch.draft = old.draft
  if (Object.keys(patch).length) writeCard(toKey, patch)
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
// Each mounted card asks its chat's backend once (batched per chat, cached for SERVER_TTL) and
// its actions wait for that first answer (at most SYNC_WAIT), so a fresh device cannot send a
// card twice. The backend's `answers.changed` event carries nothing (it reaches every window,
// also other profiles'); it only makes the cards on screen ask again, through this window's own
// profile-scoped route. While a card is on screen and open it is checked again with backoff
// (POLL_*), after a failed request (RETRY_MS), on reconnect and when the window gets focus.
// ctx.storage stays the fast path and the offline fallback: without the route (an older Hermes,
// a remote backend without the agent half, a failed request) cards behave exactly as before.
// When the two disagree the server can only add a lock: a receipt this window holds is never
// removed (the server not knowing an answer proves nothing about its delivery).

const SERVER_TTL = 60 * 1000
const SERVER_BATCH = 50
const SYNC_WAIT = 2500 // actions wait at most this long for the first server answer
const POLL_MIN = 30 * 1000
const POLL_MAX = 10 * 60 * 1000
const RETRY_MS = [5000, 15000, 45000, 120000, 300000]
const NUDGE_GAP = 5000 // focus/online re-checks at most this often
const SERVER_MARKS = ['✓', '✗', '✎', '⚠']
let serverRest = null
const serverChecked = new Map() // key -> time asked
const serverQueue = new Map() // sessionId -> Map(cardId -> card type)
const serverSync = new Map() // key -> deadline: first answer pending, actions wait
const syncListeners = new Map() // key -> Set(fn)
let serverTimer = null
let serverBlocked = 0 // no requests before this time (after a failure)
let serverFailures = 0
let serverInflight = Promise.resolve()
let serverScope = ''
let pollDelay = POLL_MIN
let reconcileTimer = null // { at, stop }
let lastNudge = 0
// Timers for the slow re-checks: ctx.setTimeout (cleared with the plugin) once registered.
let schedule = (fn, ms) => {
  const id = setTimeout(fn, ms)
  if (id && typeof id.unref === 'function') id.unref()
  return () => clearTimeout(id)
}

// Which backend ctx.rest reaches right now: the active profile plus the host's activation counter
// (a source or connection swap). A reply that comes back under another scope is dropped.
function backendScope() {
  let profile = ''
  let epoch = ''
  try {
    const atom = sdk.host && sdk.host.state && sdk.host.state.profile
    if (atom && typeof atom.get === 'function') profile = String(atom.get() ?? '')
  } catch {}
  try {
    if (typeof sdk.gatewayActivationEpoch === 'function') epoch = String(sdk.gatewayActivationEpoch())
  } catch {}
  return `${profile}\u0000${epoch}`
}

function useServerAnswers(rest, timer) {
  serverRest = typeof rest === 'function' ? rest : null
  if (typeof timer === 'function') schedule = timer
  if (reconcileTimer) reconcileTimer.stop()
  reconcileTimer = null
  serverChecked.clear()
  serverQueue.clear()
  for (const key of [...serverSync.keys()]) endSync(key)
  serverBlocked = 0
  serverFailures = 0
  pollDelay = POLL_MIN
  serverScope = backendScope()
}

// Another profile or connection: what this window learned belongs to the old backend.
function followScope() {
  const scope = backendScope()
  if (scope === serverScope) return false
  serverScope = scope
  serverChecked.clear()
  serverQueue.clear()
  serverBlocked = 0
  serverFailures = 0
  pollDelay = POLL_MIN
  return true
}

function isSyncing(key) {
  const deadline = serverSync.get(key)
  return deadline !== undefined && Date.now() < deadline
}

function endSync(key) {
  if (!serverSync.delete(key)) return
  for (const fn of syncListeners.get(key) || []) fn()
}

function subscribeSync(key, fn) {
  if (!syncListeners.has(key)) syncListeners.set(key, new Set())
  syncListeners.get(key).add(fn)
  return () => {
    const set = syncListeners.get(key)
    set.delete(fn)
    if (!set.size) syncListeners.delete(key)
  }
}

// Whether a card mounted now would ask the server (then its actions wait for the reply).
function wouldAsk(key) {
  followScope()
  return Boolean(serverRest) && !readCard(key).answer && Date.now() >= serverBlocked &&
    Date.now() - (serverChecked.get(key) || 0) >= SERVER_TTL
}

function askServer(sessionId, cardId, type, force = false) {
  if (!serverRest || !sessionId || typeof cardId !== 'string') return false
  followScope()
  const key = `${sessionId}\u0000${cardId}`
  const now = Date.now()
  if (readCard(key).answer || now < serverBlocked) return false
  if (!force && now - (serverChecked.get(key) || 0) < SERVER_TTL) return false
  serverChecked.set(key, now)
  if (!serverQueue.has(sessionId)) serverQueue.set(sessionId, new Map())
  serverQueue.get(sessionId).set(cardId, type)
  if (!serverTimer) serverTimer = setTimeout(() => { serverInflight = flushServer() }, 25)
  return true
}

async function flushServer() {
  serverTimer = null
  const rest = serverRest
  const scope = serverScope
  const batches = [...serverQueue]
  serverQueue.clear()
  let failed = false
  for (const [sessionId, cards] of batches) {
    const ids = [...cards.keys()]
    for (let i = 0; i < ids.length; i += SERVER_BATCH) {
      const chunk = ids.slice(i, i + SERVER_BATCH)
      let reply
      try {
        reply = await rest(`/answers?session=${encodeURIComponent(sessionId)}&cards=${chunk.map(encodeURIComponent).join(',')}`, { timeoutMs: 8000 })
      } catch {
        reply = undefined
        failed = true
      }
      const keys = chunk.map(id => `${sessionId}\u0000${id}`)
      if (rest !== serverRest || scope !== backendScope()) {
        for (const key of keys) endSync(key) // asked another backend: drop it, the new scope asks again
        continue
      }
      if (reply === undefined) {
        // Route missing or backend away: keep the local state, try again later.
        for (const key of keys) serverChecked.delete(key)
      } else {
        applyServerReply(sessionId, chunk.map(id => [id, cards.get(id)]), reply)
      }
      for (const key of keys) endSync(key)
    }
  }
  if (failed) {
    serverBlocked = Date.now() + RETRY_MS[Math.min(serverFailures, RETRY_MS.length - 1)]
    serverFailures += 1
    scheduleReconcile(serverBlocked - Date.now())
  } else if (batches.length) {
    serverFailures = 0
    scheduleReconcile(pollDelay)
    pollDelay = Math.min(pollDelay * 2, POLL_MAX)
  }
}

function applyServerReply(sessionId, cards, reply) {
  if (!reply || typeof reply !== 'object') return
  const answers = reply.answers && typeof reply.answers === 'object' ? reply.answers : {}
  for (const [cardId, type] of cards) {
    const key = `${sessionId}\u0000${cardId}`
    if (Object.prototype.hasOwnProperty.call(answers, cardId)) applyServerAnswer(key, cardId, type, answers[cardId])
  }
}

// ── Re-checks of open cards on screen ──

// Cards on screen (key -> type): the ones a re-check asks for.
const mountedTypes = new Map()

function openMounted() {
  return [...mountedTypes].filter(([key]) => !readCard(key).answer)
}

function scheduleReconcile(ms) {
  if (!serverRest || !openMounted().length) return
  const at = Date.now() + Math.max(0, ms)
  if (reconcileTimer && reconcileTimer.at <= at) return // an earlier check is already due
  if (reconcileTimer) reconcileTimer.stop()
  const timer = { at, stop: () => {} }
  timer.stop = schedule(() => {
    if (reconcileTimer === timer) reconcileTimer = null
    reconcile()
  }, Math.max(0, ms)) || (() => {})
  reconcileTimer = timer
}

function reconcile() {
  const open = openMounted()
  if (!open.length) {
    pollDelay = POLL_MIN // nothing to watch: no polling until a card shows again
    return
  }
  if (Date.now() < serverBlocked) return scheduleReconcile(serverBlocked - Date.now())
  for (const [key, type] of open) {
    const cut = key.indexOf('\u0000')
    askServer(key.slice(0, cut), key.slice(cut + 1), type, true)
  }
}

// Something may have changed (the backend's event, reconnect, focus): check open cards soon.
function nudgeServer({ soon = 250, gap = 0 } = {}) {
  const now = Date.now()
  if (gap && now - lastNudge < gap) return
  lastNudge = now
  pollDelay = POLL_MIN
  if (reconcileTimer) {
    reconcileTimer.stop()
    reconcileTimer = null
  }
  scheduleReconcile(Math.max(soon, serverBlocked - now))
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

// The backend's live event (hui_cards/tool.py announces every recorded answer). It carries no
// answer: whatever it holds is ignored, the cards on screen ask their own route.
function onAnswersChanged() {
  nudgeServer()
}

// A mounted card: ask the server once, and say whether its actions still wait for that answer.
function useServerAnswer(card, sessionId) {
  const key = sessionId && card && card.cardId ? `${sessionId}\u0000${card.cardId}` : null
  const [, setTick] = useState(0)
  // Decided during the first render, so a card that will ask never shows actions before the reply.
  if (key && !serverSync.has(key) && !mountedTypes.has(key) && wouldAsk(key)) serverSync.set(key, Date.now() + SYNC_WAIT)
  useEffect(() => {
    if (!key) return
    mountedTypes.set(key, card.type)
    const stop = subscribeSync(key, () => setTick(n => n + 1))
    const asked = askServer(sessionId, card.cardId, card.type)
    if (!asked) endSync(key)
    const expire = serverSync.has(key) ? schedule(() => endSync(key), Math.max(0, serverSync.get(key) - Date.now())) : null
    if (asked) scheduleReconcile(pollDelay)
    return () => {
      stop()
      if (expire) expire()
      endSync(key)
      if (mountedTypes.get(key) === card.type) mountedTypes.delete(key)
    }
  }, [key, card && card.type])
  return key ? isSyncing(key) : false
}

// Resolves once queued and running answer requests are done (tests, and nothing else waits on it).
async function serverIdle() {
  while (serverTimer) await new Promise(resolve => setTimeout(resolve, 10))
  await serverInflight
}

// ── Display settings (Settings → Plugins), applied live to cards already on screen ──
// A card starts with the `display` its tool result carries; once the backend of the current
// profile has been read (first card on screen, after every save in Settings → Plugins, after a
// profile switch) its values win. Values read for another profile or connection are never used.

let liveDisplay = null // { scope, display }
let lastResultDisplay = null // { scope, display }
const displayListeners = new Set()

function currentLiveDisplay() {
  return liveDisplay && liveDisplay.scope === backendScope() ? liveDisplay.display : null
}

function setLiveDisplay(display, scope = backendScope()) {
  if (!display || scope !== backendScope()) return // read for another backend: drop it
  const before = currentLiveDisplay()
  const same = before && Object.keys(display).every(k => before[k] === display[k])
  liveDisplay = { scope, display }
  if (!same) for (const fn of displayListeners) fn(display)
}

function notifyDisplay() {
  for (const fn of displayListeners) fn(currentLiveDisplay())
}

function useLiveDisplay(initial) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick(n => n + 1)
    displayListeners.add(fn)
    return () => void displayListeners.delete(fn)
  }, [])
  const live = currentLiveDisplay()
  return live ? { ...(initial || {}), ...live } : initial
}
