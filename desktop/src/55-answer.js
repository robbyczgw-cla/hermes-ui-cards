// One answer per card: send it into the card's own chat, remember it, never send twice.

function useCardAnswer(card, sessionId, lang) {
  const key = sessionId ? `${sessionId}\u0000${card.cardId}` : null
  const record = useCardRecord(key)
  const [problem, setProblem] = useState(null) // null | 'inactive' | 'failed' | 'oversize'
  const sending = useRef(false)
  const [focusAnswer, setFocusAnswer] = useState(false)

  const answered = Boolean(record.answer)

  const submit = useCallback(
    answer => {
      if (!key || sending.current || readCard(key).answer) return false
      sending.current = true
      try {
        const reply = buildReply(card, answer, lang)
        if (!reply.fits) { setProblem('oversize'); return false }
        // Fail closed: without the card's own session there is no safe place to send.
        const ok = sessionId ? sdk.host.composer.submit(sessionId, reply.text) === true : false
        if (!ok) {
          setProblem('failed')
          return false
        }
        setProblem(null)
        writeCard(key, {
          answer: { mark: reply.mark, summary: reply.summary, data: reply.data, selection: answer, at: Date.now() }
        })
        setFocusAnswer(true)
        return true
      } finally {
        sending.current = false
      }
    },
    [card, sessionId, lang, key]
  )

  // Work in progress (ticks, drafts) that should survive reopening the chat.
  const saveDraft = useCallback(draft => { if (key) writeCard(key, { draft }) }, [key])

  const locked = answered
  const status = answered
    ? jsx(AnsweredBar, { lang, record: record.answer, focus: focusAnswer })
    : !sessionId || problem === 'failed'
      ? jsx(NoticeBar, {
          text: t(lang, sessionId ? 'sendFailed' : 'inactive'),
          action: jsx(Btn, { variant: 'ghost', onClick: () => setProblem(null), children: t(lang, 'retry') })
        })
      : problem === 'oversize'
        ? jsx(NoticeBar, { text: t(lang, 'oversize') })
      : null

  return {
    record,
    draft: record.draft,
    answer: record.answer,
    answered,
    locked,
    canSend: Boolean(sessionId) && !answered && problem !== 'failed',
    // No dead buttons: actions disappear while the card can't send (answered or chat unavailable).
    showActions: Boolean(sessionId) && !answered && problem !== 'failed',
    submit,
    saveDraft,
    status
  }
}
