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

// Read the current display settings from the backend once, when the first card is on screen
// (set by register(); a no-op without the backend route).
let loadDisplay = null
let displayRequested = false
function requestDisplayOnce() {
  if (displayRequested || !loadDisplay) return
  displayRequested = true
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

function CardView({ result, sessionId, fallback }) {
  const parsed = useMemo(() => cardFromResult(result), [result])
  const display = useLiveDisplay(parsed ? parsed.display : null)
  const Component = parsed && CARD_COMPONENTS[parsed.card.type]
  useEffect(() => {
    if (!Component) return
    if (parsed.hasUndo) lastResultDisplay = parsed.display
    requestDisplayOnce()
  }, [Component, parsed])
  if (!Component) return fallback ?? null
  const lang = cardLang(parsed.card)
  return jsx(
    Component,
    {
      card: parsed.card,
      display,
      sessionId: typeof sessionId === 'string' && sessionId ? sessionId : null,
      lang
    },
    `${sessionId || ''}\u0000${parsed.card.cardId}`
  )
}
