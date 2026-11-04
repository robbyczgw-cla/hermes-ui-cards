// Card state that must survive reopening the chat: the sent answer (no second send)
// and work in progress (checklist ticks, form drafts). Kept in ctx.storage (plugin-
// scoped, on this computer), keyed by cardId; the oldest cards are dropped beyond a cap.

const STORE_CAP = 300
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
  return value && typeof value === 'object' ? value : {}
}

function writeCard(cardId, patch) {
  const next = { ...readCard(cardId), ...patch, touched: Date.now() }
  cardStorage.set(`card.${cardId}`, next)
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
  const [record, setRecord] = useState(() => readCard(cardId))
  useEffect(() => {
    setRecord(readCard(cardId))
    return subscribeCard(cardId, setRecord)
  }, [cardId])
  return record
}
