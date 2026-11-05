// One answer per card: send it into the card's own chat, remember it, never send twice.

Object.assign(STRINGS.en, {
  checkingAnswer: 'Checking whether this card was already answered…',
  checkFailed: "Couldn't check whether this card was already answered elsewhere. Answer here only if you haven't yet.",
  checkAgain: 'Check again'
})
Object.assign(STRINGS.de, {
  checkingAnswer: 'Prüfe, ob diese Karte schon beantwortet wurde …',
  checkFailed: 'Konnte nicht prüfen, ob diese Karte anderswo schon beantwortet wurde. Antworte hier nur, wenn du es noch nicht getan hast.',
  checkAgain: 'Erneut prüfen'
})

const CHECKING_NOTICE_MS = 600 // a quick check shows nothing; a slow one says why the buttons wait

// Seconds a pick waits before it is sent so it can be undone (Settings → Plugins → Undo time:
// 0, 4 or 8). Cards call it when the pick happens, so a changed setting applies at once. Only
// values of the backend this window talks to right now count (never another profile's).
function undoDelayMs(display) {
  const lastResult = lastResultDisplay && lastResultDisplay.scope === backendScope() ? lastResultDisplay.display : null
  const pick = [currentLiveDisplay(), display, lastResult].find(d => d && [0, 4, 8].includes(d.undo))
  return (pick ? pick.undo : 4) * 1000
}

function useCardAnswer(card, sessionId, lang) {
  const owner = ownerScope()
  const key = sessionId ? cardKey(sessionId, card.cardId, owner) : null
  // A new chat's card stays mounted while the chat's runtime id becomes its stored id (CardView
  // keeps it only for a move the host confirms): carry the draft and answer to the new key.
  const previous = useRef({ owner, sessionId })
  if (previous.current.owner !== owner || previous.current.sessionId !== sessionId) {
    if (previous.current.owner === owner) adoptCard(previous.current.sessionId, sessionId, card.cardId, owner)
    previous.current = { owner, sessionId }
  }
  const record = useCardRecord(key)
  // Answered elsewhere (another window, the Webapp, another computer)? Until the lookup settles
  // (at most its timeout) the card offers no actions, so a fresh device cannot send it a second
  // time. A lookup that failed says so on the card, which stays usable.
  const server = useServerAnswer(card, sessionId)
  const syncing = server.syncing
  const [problem, setProblem] = useState(null) // null | 'inactive' | 'failed' | 'oversize'
  const sending = useRef(false)
  const [focusAnswer, setFocusAnswer] = useState(false)
  const [slowCheck, setSlowCheck] = useState(false)

  useEffect(() => {
    if (!syncing) return void setSlowCheck(false)
    const id = setTimeout(() => setSlowCheck(true), CHECKING_NOTICE_MS)
    return () => clearTimeout(id)
  }, [syncing])

  const answered = Boolean(record.answer)

  const submit = useCallback(
    answer => {
      if (!key || sending.current || readCard(key).answer || isSyncing(key)) return false
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
      : syncing && slowCheck
        ? jsx(NoticeBar, { text: t(lang, 'checkingAnswer') })
      : server.failed && !syncing
        ? jsx(NoticeBar, {
            text: t(lang, 'checkFailed'),
            action: jsx(Btn, { variant: 'ghost', onClick: server.recheck, children: t(lang, 'checkAgain') })
          })
      : null

  const canSend = Boolean(sessionId) && !answered && !syncing && problem !== 'failed'
  return {
    record,
    draft: record.draft,
    answer: record.answer,
    answered,
    locked,
    syncing,
    lookupFailed: server.failed,
    canSend,
    // No dead buttons: actions disappear while the card can't send (answered, still checking the
    // server, or chat unavailable).
    showActions: canSend,
    submit,
    saveDraft,
    status
  }
}
