// Registration. Cards render only for this package's own hui_present tool
// (the host enforces that ownership); older Desktops without the area skip it
// and keep showing the card's Markdown copy as an attachment.

Object.assign(CARD_COMPONENTS, {
  choice: ChoiceCard,
  checklist: ChecklistCard,
  compare: CompareCard,
  form: FormCard,
  confirm: ConfirmCard,
  rating: RatingCard,
  slider: SliderCard,
  schedule: ScheduleCard,
  steps: StepsCard,
  quiz: QuizCard
})

let pluginCtx = null

const PLUGIN_ID = 'hermes-ui-cards'
const EVENT_SETTINGS = `plugin.${PLUGIN_ID}.settings.changed`
const EVENT_ANSWERS = `plugin.${PLUGIN_ID}.answers.changed`

// Hear a gateway event for as long as the plugin lives (ctx.onEvent is tracked by the host).
function listen(ctx, type, fn) {
  if (typeof ctx.onEvent === 'function') return ctx.onEvent(type, fn)
  if (sdk.host && typeof sdk.host.onEvent === 'function') {
    const stop = sdk.host.onEvent(type, fn)
    if (typeof ctx.onDispose === 'function' && typeof stop === 'function') ctx.onDispose(stop)
    return stop
  }
}

// Settings → Plugins values from the gateway's own plugin list (the RPC that page saves through):
// the fallback when this plugin's backend route is not reachable.
async function displayFromPluginList() {
  if (!sdk.host || typeof sdk.host.request !== 'function') return null
  const listing = await sdk.host.request('plugins.manage', { action: 'list' })
  const rows = listing && Array.isArray(listing.plugins) ? listing.plugins : []
  const row = rows.find(r => r && (r.key === PLUGIN_ID || r.name === PLUGIN_ID))
  if (!row || !Array.isArray(row.settings_schema)) return null
  const value = key => row.settings_schema.find(f => f && f.key === key)?.value
  return { compact: value('compact') === true, accent: value('accent'), undo: Number(value('undo_seconds')) }
}

// Every read is tied to the backend scope it started in; a reply that arrives after a profile or
// connection switch is dropped by setLiveDisplay.
async function refreshDisplay(ctx, { fallback = false } = {}) {
  const scope = backendScope()
  try {
    const reply = await ctx.rest('/settings', { timeoutMs: 8000 })
    if (reply && reply.display && typeof reply.display === 'object') return setLiveDisplay(sanitizeDisplay(reply.display), scope)
  } catch {}
  if (!fallback) return
  try {
    const display = await displayFromPluginList()
    if (display) setLiveDisplay(sanitizeDisplay(display), scope)
  } catch {}
}

// Re-check open cards when this window comes back: reconnect, focus, network, a switch of profile
// or source. A switch also re-renders every card: each one drops what belongs to the old owner
// (state, display values) and reads the new backend's.
function watchReconnects(ctx) {
  const rescope = () => {
    notifyDisplay()
    nudgeServer()
  }
  listen(ctx, 'gateway.ready', rescope)
  if (typeof ctx.addEventListener === 'function' && typeof window !== 'undefined') {
    const soon = () => nudgeServer({ gap: NUDGE_GAP })
    ctx.addEventListener(window, 'focus', soon)
    ctx.addEventListener(window, 'online', soon)
  }
  for (const name of ['profile', 'connectionId']) {
    const atom = sdk.host && sdk.host.state && sdk.host.state[name]
    if (!atom || typeof atom.listen !== 'function') continue
    const stop = atom.listen(rescope)
    if (typeof ctx.onDispose === 'function' && typeof stop === 'function') ctx.onDispose(stop)
  }
}

const DEMO_PROMPT = 'Show me the hui_present demo card for "{type}".'

const plugin = {
  id: 'hermes-ui-cards',
  name: 'HUI+ Cards',
  register(ctx) {
    pluginCtx = ctx
    useStorage(ctx.storage)
    const hasRest = typeof ctx.rest === 'function'
    useServerAnswers(hasRest ? (path, opts) => ctx.rest(path, opts) : null,
      typeof ctx.setTimeout === 'function' ? (fn, ms) => ctx.setTimeout(fn, ms) : null)
    loadDisplay = hasRest ? () => refreshDisplay(ctx) : null
    displayRequested = null
    liveDisplay = null
    lastResultDisplay = null
    listen(ctx, EVENT_ANSWERS, onAnswersChanged)
    if (hasRest) watchReconnects(ctx)
    // A save in Settings → Plugins: re-read and apply to every card on screen. The plugin list is
    // the fallback here (one call per save), not on every start.
    listen(ctx, EVENT_SETTINGS, () => (hasRest ? refreshDisplay(ctx, { fallback: true }) : displayFromPluginList().then(d => d && setLiveDisplay(sanitizeDisplay(d)), () => {})))
    if (typeof sdk.TOOL_MEDIA_RENDERER_AREA !== 'string') return
    ctx.register({
      id: 'cards',
      area: sdk.TOOL_MEDIA_RENDERER_AREA,
      data: { tools: ['hui_present'], render: props => jsx(CardView, props) }
    })
    if (typeof sdk.PALETTE_AREA === 'string') {
      ctx.register({
        id: 'demo',
        area: sdk.PALETTE_AREA,
        data: {
          id: 'hermes-ui-cards.demo',
          label: 'HUI+ Cards: show an example card',
          keywords: ['cards', 'hui', 'demo', 'example'],
          run: () => {
            const sessionId = sdk.host.state.focusedSessionId && sdk.host.state.focusedSessionId.get()
            const sent = sdk.host.composer.submit(sessionId || null, DEMO_PROMPT.replace('{type}', 'checklist'))
            if (!sent) sdk.host.notify({ kind: 'info', message: 'Open a chat first, then run this again.' })
          }
        }
      })
    }
  }
}

export default plugin
export { buildReply, cardFromResult, CardView, formatSlot, readCard, serverIdle, undoDelayMs, useStorage, validateCard }
