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
