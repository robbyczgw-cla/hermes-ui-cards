// One answer per card: send it into the card's own chat, remember it, never send twice.

function useCardAnswer(card, sessionId, lang) {
  const record = useCardRecord(card.cardId)
  const gateway = sdk.useValue ? sdk.useValue(sdk.host.state.gateway) : 'open'
  const [problem, setProblem] = useState(null) // null | 'inactive' | 'offline'
  const sending = useRef(false)

  const answered = Boolean(record.answer)
  const offline = typeof gateway === 'string' && gateway !== 'open'

  const submit = useCallback(
    answer => {
      if (sending.current || readCard(card.cardId).answer) return false
      if (offline) {
        setProblem('offline')
        return false
      }
      sending.current = true
      try {
        const reply = buildReply(card, answer, lang)
        // Fail closed: without the card's own session there is no safe place to send.
        const ok = sessionId ? sdk.host.composer.submit(sessionId, reply.text) === true : false
        if (!ok) {
          setProblem('inactive')
          return false
        }
        setProblem(null)
        writeCard(card.cardId, {
          answer: { mark: reply.mark, summary: reply.summary, data: reply.data, at: Date.now() }
        })
        return true
      } finally {
        sending.current = false
      }
    },
    [card, sessionId, lang, offline]
  )

  // Work in progress (ticks, drafts) that should survive reopening the chat.
  const saveDraft = useCallback(draft => writeCard(card.cardId, { draft }), [card.cardId])

  const locked = answered
  const status = answered
    ? jsx(AnsweredBar, { lang, record: record.answer })
    : problem === 'inactive'
      ? jsx(NoticeBar, {
          text: t(lang, 'inactive'),
          action: jsx(Btn, { variant: 'ghost', onClick: () => setProblem(null), children: t(lang, 'retry') })
        })
      : offline || problem === 'offline'
        ? jsx(NoticeBar, { text: t(lang, 'offline') })
        : null

  return {
    record,
    draft: record.draft,
    answer: record.answer,
    answered,
    locked,
    canSend: !answered && !offline && problem !== 'inactive',
    // No dead buttons: actions disappear while the card can't send (answered, chat gone, offline).
    showActions: !answered && !offline && problem !== 'inactive',
    submit,
    saveDraft,
    status
  }
}
