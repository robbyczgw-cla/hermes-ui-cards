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

const DEMO_PROMPT = 'Show me the hui_present demo card for "{type}".'

const plugin = {
  id: 'hermes-ui-cards',
  name: 'HUI+ Cards',
  register(ctx) {
    pluginCtx = ctx
    useStorage(ctx.storage)
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
export { buildReply, cardFromResult, CardView, formatSlot, readCard, useStorage, validateCard }
