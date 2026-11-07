// The tool media renderer: turns a hui_present tool result into a card.
// The result is untrusted (it may come from an older version or a hand-edited
// history), so it is validated again with the same schema; anything that does not
// pass falls back to the host's built-in attachment view, never a broken card.

const CARD_COMPONENTS = {}
const CARD_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

function parseResult(result) {
  if (typeof result === 'string') {
    try {
      return JSON.parse(result)
    } catch {
      return null
    }
  }
  return result && typeof result === 'object' ? result : null
}

function sanitizeDisplay(display) {
  const out = { compact: false, accent: 'app', undo: 4 }
  if (display && typeof display === 'object') {
    if (display.compact === true) out.compact = true
    if (typeof display.accent === 'string' && ACCENT_VARS[display.accent]) out.accent = display.accent
    if ([0, 4, 8].includes(display.undo)) out.undo = display.undo
  }
  return out
}

// Read the current display settings from the backend once per profile/connection, when the first
// card of that scope is on screen (set by register(); a no-op without the backend route).
let loadDisplay = null
let displayRequested = null // the scope already asked
function requestDisplayOnce() {
  const scope = backendScope()
  if (displayRequested === scope || !loadDisplay) return
  displayRequested = scope
  loadDisplay()
}

function cardFromResult(result) {
  const parsed = parseResult(result)
  if (!parsed || !parsed.card || typeof parsed.card !== 'object' || Array.isArray(parsed.card)) return null
  const { cardId, ...rest } = parsed.card
  if (typeof cardId !== 'string' || !CARD_ID_RE.test(cardId)) return null
  const checked = validateCard(rest)
  if (!checked.card) return null
  const hasUndo = Boolean(parsed.display && [0, 4, 8].includes(parsed.display.undo))
  return { card: { cardId, ...checked.card }, display: sanitizeDisplay(parsed.display), hasUndo }
}

// Which mounted instance shows the card: a new one whenever the owner (source + profile) changes
// or the chat id changes other than by a confirmed runtime → stored move (confirmSessionMove), so
// nothing the user did in one chat or profile shows up in another. The confirmed move keeps the
// instance: what the user just picked in a new chat stays on screen.
function useCardIdentity(sessionId) {
  const owner = ownerScope()
  const seen = useRef(null)
  const prev = seen.current
  if (!prev) {
    seen.current = { owner, sessionId, generation: 0 }
  } else if (prev.owner !== owner || prev.sessionId !== sessionId) {
    const kept = prev.owner === owner && confirmSessionMove(prev.sessionId, sessionId)
    seen.current = { owner, sessionId, generation: kept ? prev.generation : prev.generation + 1 }
  }
  return seen.current.generation
}

// The first time this window draws a card that has no answer and no work in progress here, it is
// new: its top is brought into view once it has settled (useArrivalReveal). Marked during render,
// before the reveal effect runs; a card seen before (chat switched back, re-render) is never marked.
const seenCards = new Set()
function useArrivalMark(parsed, chatId) {
  useState(() => {
    if (!parsed || !chatId) return null
    const { cardId } = parsed.card
    if (seenCards.has(cardId)) return null
    seenCards.add(cardId)
    const record = readCard(cardKey(chatId, cardId))
    if (record.answer || record.draft) return null
    markArrival(cardId, () => {
      const key = cardKey(chatId, cardId)
      if (readCard(key).answer) return 'closed' // answered meanwhile, here or on another device
      return isSyncing(key) ? 'wait' : 'open'
    })
    return null
  })
}

function CardView({ result, sessionId, fallback }) {
  const parsed = useMemo(() => cardFromResult(result), [result])
  const chatId = typeof sessionId === 'string' && sessionId ? sessionId : null
  useArrivalMark(parsed, chatId)
  const hostRef = useRef(null)
  useArrivalReveal(hostRef, parsed ? parsed.card.cardId : null)
  const generation = useCardIdentity(chatId)
  const display = useLiveDisplay(parsed ? parsed.display : null)
  const Component = parsed && CARD_COMPONENTS[parsed.card.type]
  useEffect(() => {
    if (Component && parsed.hasUndo) lastResultDisplay = { scope: backendScope(), display: parsed.display }
  }, [Component, parsed])
  useEffect(() => {
    if (Component) requestDisplayOnce() // every render: a profile switch reads that profile's values
  })
  if (!Component) return fallback ?? null
  const lang = cardLang(parsed.card)
  // A wrapper without a box of its own (display: contents), so the arrival reveal can find the card.
  return jsx('div', {
    ref: hostRef,
    className: 'huic-host',
    style: { display: 'contents' },
    children: jsx(
      Component,
      {
        card: parsed.card,
        display,
        sessionId: chatId,
        lang
      },
      // Not keyed by the chat id: a new chat's id changes from its runtime id to its stored id while
      // the card is on screen, and remounting then would drop what the user just did.
      `${parsed.card.cardId}\u0000${generation}`
    )
  })
}
