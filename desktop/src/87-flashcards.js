// flashcards: one card at a time. Flip with Space/Enter/click, then "Knew it" or "Again".
// "Again" cards come back in the next round (3 rounds at most); a result screen sends the outcome.

Object.assign(STRINGS.en, {
  flashFront: 'Front',
  flashBack: 'Back',
  flashFlip: 'Show answer',
  flashFlipHint: 'Press Space to flip',
  flashKnew: 'Knew it',
  flashAgain: 'Again',
  flashHint: 'Show hint',
  flashCardOf: 'Card {n} of {total}',
  flashRound: 'Round {n} of {max}',
  flashKnownCount: '{n} known',
  flashAgainCount: '{n} to repeat',
  flashProgress: '{n} of {total} known',
  flashKeys: 'Space flip · ← Again · → Knew it',
  flashResult: 'Result',
  flashAllKnown: 'You knew them all.',
  flashPractise: 'To practise',
  flashMore: '+{n} more',
  flashRounds: 'after {n} rounds',
  flashHintIs: 'Hint: {x}',
  flashRound1: 'in one round',
  flashRestart: 'Start over',
  flashSend: 'Send result',
  rFlash: 'Flashcards: {k} of {n} known',
  rFlashAgain: ', {a} to practise'
})
Object.assign(STRINGS.de, {
  flashFront: 'Vorne',
  flashBack: 'Hinten',
  flashFlip: 'Antwort zeigen',
  flashFlipHint: 'Leertaste zum Umdrehen',
  flashKnew: 'Gewusst',
  flashAgain: 'Nochmal',
  flashHint: 'Tipp zeigen',
  flashCardOf: 'Karte {n} von {total}',
  flashRound: 'Runde {n} von {max}',
  flashKnownCount: '{n} gewusst',
  flashAgainCount: '{n} zu wiederholen',
  flashProgress: '{n} von {total} gewusst',
  flashKeys: 'Leertaste umdrehen · ← Nochmal · → Gewusst',
  flashResult: 'Ergebnis',
  flashAllKnown: 'Du hast alle gewusst.',
  flashPractise: 'Zum Üben',
  flashMore: '+{n} weitere',
  flashRounds: 'nach {n} Runden',
  flashHintIs: 'Tipp: {x}',
  flashRound1: 'in einer Runde',
  flashRestart: 'Von vorn',
  flashSend: 'Ergebnis senden',
  rFlash: 'Karteikarten: {k} von {n} gewusst',
  rFlashAgain: ', {a} zum Üben'
})

const FLASH_ROUNDS = 3

const FLASH_CSS = `
.huic[data-card-type="flashcards"] .huic-fc-meta{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:2px 12px;margin:0;color:var(--ui-text-tertiary);font-size:12px}
.huic[data-card-type="flashcards"] .huic-fc-meta b{color:var(--ui-text-secondary);font-weight:600}
.huic[data-card-type="flashcards"] .huic-fc-counts{display:flex;gap:10px}
.huic[data-card-type="flashcards"] .huic-fc-scene{position:relative;perspective:1400px;margin:6px 0 10px}
.huic[data-card-type="flashcards"] .huic-fc-scene::before,.huic[data-card-type="flashcards"] .huic-fc-scene::after{content:"";position:absolute;left:10px;right:10px;top:0;bottom:-6px;border:1px solid var(--ui-stroke-tertiary);border-radius:16px;background:var(--ui-chat-surface-background,var(--ui-base,Canvas));display:none}
.huic[data-card-type="flashcards"] .huic-fc-scene[data-left="2"]::before,.huic[data-card-type="flashcards"] .huic-fc-scene[data-left="3"]::before,.huic[data-card-type="flashcards"] .huic-fc-scene[data-left="3"]::after{display:block}
.huic[data-card-type="flashcards"] .huic-fc-scene[data-left="3"]::after{left:20px;right:20px;bottom:-12px}
.huic[data-card-type="flashcards"] .huic-fc-scene[data-left="3"]::before{bottom:-6px}
.huic[data-card-type="flashcards"] .huic-fc{position:relative;z-index:1;display:grid;width:100%;min-height:200px;cursor:pointer;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.3,.75,.25,1);animation:huic-fc-in .22s ease-out;border-radius:16px;-webkit-tap-highlight-color:transparent}
.huic[data-card-type="flashcards"] .huic-fc[data-flipped="true"]{transform:rotateY(180deg)}
.huic[data-card-type="flashcards"] .huic-fc-face{grid-area:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-width:0;padding:34px 22px 22px;border:1px solid var(--ui-stroke-secondary);border-radius:16px;background:var(--ui-chat-surface-background,var(--ui-base,Canvas));text-align:center;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 1px 3px color-mix(in srgb,var(--ui-text-primary) 10%,transparent)}
.huic[data-card-type="flashcards"] .huic-fc-back{transform:rotateY(180deg);border-color:color-mix(in srgb,var(--huic-accent) 45%,var(--ui-stroke-secondary));background:color-mix(in srgb,var(--huic-accent) 7%,var(--ui-chat-surface-background,var(--ui-base,Canvas)))}
.huic[data-card-type="flashcards"] .huic-fc-tag{position:absolute;top:12px;left:0;right:0;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--ui-text-tertiary)}
.huic[data-card-type="flashcards"] .huic-fc-back .huic-fc-tag{color:var(--huic-accent)}
.huic[data-card-type="flashcards"] .huic-fc-text{margin:0;font-size:22px;font-weight:600;line-height:1.3;white-space:pre-wrap}
.huic[data-card-type="flashcards"] .huic-fc-back .huic-fc-text{font-weight:500}
.huic[data-card-type="flashcards"] .huic-fc-long .huic-fc-text{font-size:15px;font-weight:500}
.huic[data-card-type="flashcards"] .huic-fc-hinttext{margin:0;color:var(--ui-text-secondary);font-size:13px;font-style:italic;white-space:pre-wrap}
.huic[data-card-type="flashcards"] .huic-fc-flipmark{position:absolute;right:12px;bottom:9px;color:var(--ui-text-quaternary,var(--ui-text-tertiary));font-size:11px}
.huic[data-card-type="flashcards"] .huic-fc-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.huic[data-card-type="flashcards"] .huic-fc-actions .huic-btn{flex:1 1 0;min-width:120px;max-width:240px;padding:9px 14px}
.huic[data-card-type="flashcards"] .huic-fc-keys{margin:6px 0 0;text-align:center;color:var(--ui-text-tertiary);font-size:11.5px}
.huic[data-card-type="flashcards"] .huic-fc-score{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;margin:2px 0 0}
.huic[data-card-type="flashcards"] .huic-fc-big{font-size:34px;font-weight:700;line-height:1.1;color:var(--huic-accent);font-variant-numeric:tabular-nums}
.huic[data-card-type="flashcards"] .huic-fc-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.huic[data-card-type="flashcards"] .huic-fc-list li{display:flex;gap:8px;align-items:baseline;margin:0;padding:6px 10px;border:1px solid var(--ui-stroke-tertiary);border-radius:9px}
.huic[data-card-type="flashcards"] .huic-fc-list li>span:first-child{flex:none;color:var(--ui-text-tertiary);font-weight:700}
.huic[data-card-type="flashcards"] .huic-fc-list li small{display:block;color:var(--ui-text-tertiary);font-size:12px}
.huic[data-card-type="flashcards"] .huic-fc-h{margin:2px 0 0;font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-tertiary)}
@keyframes huic-fc-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@container (max-width: 440px){
  .huic[data-card-type="flashcards"] .huic-fc-text{font-size:19px}
  .huic[data-card-type="flashcards"] .huic-fc-face{padding:32px 16px 20px}
  .huic[data-card-type="flashcards"] .huic-fc-actions .huic-btn{min-width:0}
}
@media (prefers-reduced-motion: reduce){
  .huic[data-card-type="flashcards"] .huic-fc{transition:none !important;animation:none !important;transform:none !important}
  .huic[data-card-type="flashcards"] .huic-fc-back{transform:none}
  .huic[data-card-type="flashcards"] .huic-fc:not([data-flipped="true"]) .huic-fc-back,.huic[data-card-type="flashcards"] .huic-fc[data-flipped="true"] .huic-fc-front{display:none}
  .huic[data-card-type="flashcards"] .huic-fc[data-flipped="true"] .huic-fc-back{backface-visibility:visible;-webkit-backface-visibility:visible}
}
`

function flashShuffled(n, shuffle) {
  const order = Array.from({ length: n }, (_, i) => i)
  if (shuffle) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
  }
  return order
}

function flashInit(card) {
  const queue = flashShuffled(card.cards.length, card.shuffle === true)
  return { queue, known: [], again: [], round: 1, roundTotal: queue.length }
}

// One answer: Knew it → known; Again → waits for the next round. Done when the queue is empty.
function flashStep(state, knew) {
  const [current, ...rest] = state.queue
  const known = knew ? [...state.known, current] : state.known
  const again = knew ? state.again : [...state.again, current]
  if (rest.length) return { ...state, queue: rest, known, again }
  if (again.length && state.round < FLASH_ROUNDS) return { queue: again, known, again: [], round: state.round + 1, roundTotal: again.length }
  return { ...state, queue: [], known, again }
}

// A saved state must split the cards exactly into queue, known and again; otherwise start fresh.
function flashCleanState(card, saved) {
  const n = card.cards.length
  const ints = a => Array.isArray(a) && a.every(x => Number.isInteger(x) && x >= 0 && x < n)
  if (saved && ints(saved.queue) && ints(saved.known) && ints(saved.again)) {
    const all = [...saved.queue, ...saved.known, ...saved.again]
    const round = saved.round
    if (all.length === n && new Set(all).size === n && Number.isInteger(round) && round >= 1 && round <= FLASH_ROUNDS) {
      return { queue: saved.queue, known: saved.known, again: saved.again, round, roundTotal: Number.isInteger(saved.roundTotal) && saved.roundTotal >= saved.queue.length ? saved.roundTotal : saved.queue.length }
    }
  }
  return flashInit(card)
}

function FlashFace({ kind, text, hint, lang, long }) {
  return jsxs('div', {
    className: cx('huic-fc-face', kind === 'front' ? 'huic-fc-front' : 'huic-fc-back', long && 'huic-fc-long'),
    'aria-hidden': true,
    children: [
      jsx('span', { className: 'huic-fc-tag', children: t(lang, kind === 'front' ? 'flashFront' : 'flashBack') }),
      jsx('p', { className: 'huic-fc-text', children: text }),
      hint ? jsx('p', { className: 'huic-fc-hinttext', children: hint }) : null
    ]
  })
}

function FlashcardsCard({ card, sessionId, display, lang }) {
  const labelId = useId()
  const ans = useCardAnswer(card, sessionId, lang)
  const sent = ans.answer && ans.answer.data
  const [state, setState] = useState(() => flashCleanState(card, ans.draft))
  const [flipped, setFlipped] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [announce, setAnnounce] = useState('')
  const cardRef = useRef(null)
  const n = card.cards.length

  const done = Boolean(sent) || state.queue.length === 0
  const known = sent ? sent.known : state.known
  const again = sent ? sent.again : state.again
  const rounds = sent ? sent.rounds : state.round
  const current = state.queue[0]
  const cur = card.cards[current]

  // Keep the keyboard on the card after each answer so Space keeps flipping. The key is the card's own identity
  // (card + round), so the same card coming back in the next round gets the focus again; at the end the result does.
  const focusCard = useRef(false)
  const resultRef = useRef(null)
  const sendRef = useRef(null)
  const cardKey = done ? 'done' : `${current}-${state.round}`
  useEffect(() => {
    if (focusCard.current) (done ? (sendRef.current || resultRef.current) : cardRef.current)?.focus()
    focusCard.current = false
  }, [cardKey])

  const flip = () => {
    if (done) return
    const next = !flipped
    setFlipped(next)
    setAnnounce(next ? `${t(lang, 'flashBack')}: ${cur.back}` : hintOpen && cur.hint ? t(lang, 'flashHintIs', { x: cur.hint }) : '')
  }
  const showHint = () => {
    setHintOpen(true)
    setAnnounce(t(lang, 'flashHintIs', { x: cur.hint }))
    cardRef.current?.focus() // the button disappears; the keyboard stays on the card
  }
  const answer = knew => {
    if (!flipped || done) return
    const next = flashStep(state, knew)
    focusCard.current = true
    setFlipped(false)
    setHintOpen(false)
    setAnnounce('')
    setState(next)
    ans.saveDraft(next)
  }
  const restart = () => {
    const next = flashInit(card)
    setState(next)
    setFlipped(false)
    setHintOpen(false)
    ans.saveDraft(next)
  }
  const send = () => ans.submit({ known: [...known].sort((a, b) => a - b), again: [...again].sort((a, b) => a - b), rounds })
  const onCardKey = e => {
    if (e.nativeEvent.isComposing || e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip() }
    else if (flipped && e.key === 'ArrowLeft') { e.preventDefault(); answer(false) }
    else if (flipped && e.key === 'ArrowRight') { e.preventDefault(); answer(true) }
  }

  const progressLabel = t(lang, 'flashProgress', { n: known.length, total: n })
  const roundDone = state.roundTotal - state.queue.length
  const long = !done && ([...cur.front].length > 80 || [...cur.back].length > 80)

  const study = done ? null : [
    jsxs('p', { className: 'huic-fc-meta', children: [
      jsxs('span', { children: [
        state.round > 1 ? jsx('b', { children: `${t(lang, 'flashRound', { n: state.round, max: FLASH_ROUNDS })} · ` }) : null,
        t(lang, 'flashCardOf', { n: roundDone + 1, total: state.roundTotal })
      ] }),
      jsxs('span', { className: 'huic-fc-counts', children: [
        jsx('span', { children: `✓ ${t(lang, 'flashKnownCount', { n: known.length })}` }),
        state.again.length ? jsx('span', { children: `↺ ${t(lang, 'flashAgainCount', { n: state.again.length })}` }) : null
      ] })
    ] }),
    jsx('div', {
      className: 'huic-progress', role: 'progressbar', 'aria-label': progressLabel,
      'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': known.length,
      children: jsx('span', { style: { width: `${(known.length / n) * 100}%` } })
    }),
    jsx('div', {
      className: 'huic-fc-scene', 'data-left': Math.min(3, state.queue.length),
      children: jsxs('div', {
        ref: cardRef, className: 'huic-fc', role: 'button', tabIndex: 0,
        'data-flipped': flipped, 'aria-pressed': flipped,
        'aria-label': `${t(lang, 'flashFront')}: ${cur.front}. ${hintOpen && cur.hint ? `${t(lang, 'flashHintIs', { x: cur.hint })}. ` : ''}${t(lang, 'flashFlipHint')}`,
        onClick: flip, onKeyDown: onCardKey,
        children: [
          jsx(FlashFace, { kind: 'front', text: cur.front, hint: hintOpen ? cur.hint : null, lang, long }),
          jsx(FlashFace, { kind: 'back', text: cur.back, lang, long })
        ]
      }, `${current}-${state.round}`)
    }),
    jsx('div', { className: 'huic-sr', role: 'status', 'aria-live': 'polite', children: announce }),
    jsx('div', {
      className: 'huic-fc-actions',
      children: flipped
        ? jsxs(Fragment, { children: [
            jsx(Btn, { onClick: () => answer(false), children: `↺ ${t(lang, 'flashAgain')}` }),
            jsx(Btn, { variant: 'primary', onClick: () => answer(true), children: `✓ ${t(lang, 'flashKnew')}` })
          ] })
        : jsxs(Fragment, { children: [
            cur.hint && !hintOpen ? jsx(Btn, { variant: 'ghost', onClick: showHint, children: t(lang, 'flashHint') }) : null,
            jsx(Btn, { variant: 'primary', onClick: flip, children: t(lang, 'flashFlip') })
          ] })
    }),
    jsx('p', { className: 'huic-fc-keys', children: t(lang, 'flashKeys') })
  ]

  const practise = [...again].sort((a, b) => a - b)
  const result = done ? [
    jsxs('div', { className: 'huic-fc-score', ref: resultRef, tabIndex: -1, children: [
      jsx('span', { className: 'huic-fc-big', children: `${known.length} / ${n}` }),
      jsx('span', { className: 'huic-sub', children: `${t(lang, 'flashProgress', { n: known.length, total: n })}, ${t(lang, rounds > 1 ? 'flashRounds' : 'flashRound1', { n: rounds })}` })
    ] }),
    jsx('div', {
      className: 'huic-progress', role: 'progressbar', 'aria-label': progressLabel,
      'aria-valuemin': 0, 'aria-valuemax': n, 'aria-valuenow': known.length,
      children: jsx('span', { style: { width: `${(known.length / n) * 100}%` } })
    }),
    practise.length
      ? jsxs('div', { children: [
          jsx('h4', { className: 'huic-fc-h', children: t(lang, 'flashPractise') }),
          jsx('ul', { className: 'huic-fc-list', children: practise.slice(0, 8).map(i => jsxs('li', { children: [
            jsx('span', { 'aria-hidden': true, children: '↺' }),
            jsxs('span', { children: [card.cards[i].front, jsx('small', { children: card.cards[i].back })] })
          ] }, i)) }),
          practise.length > 8 ? jsx('p', { className: 'huic-sub', children: t(lang, 'flashMore', { n: practise.length - 8 }) }) : null
        ] })
      : jsx('p', { style: { margin: 0 }, role: 'status', children: `🎉 ${t(lang, 'flashAllKnown')}` })
  ] : null

  return jsx(Shell, {
    card, display, labelId, title: card.title,
    children: jsxs(Fragment, { children: [jsx('style', { children: FLASH_CSS }), ...(done ? result : study)] }),
    footer: done && ans.showActions ? jsx(Footer, {
      children: jsxs(Fragment, { children: [
        jsx(Btn, { variant: 'ghost', onClick: restart, children: t(lang, 'flashRestart') }),
        jsx(Btn, { ref: sendRef, variant: 'primary', onClick: send, children: t(lang, 'flashSend') })
      ] })
    }) : null,
    after: ans.status
  })
}

REPLY_BUILDERS.flashcards = (card, answer, lang, data) => {
  const n = card.cards.length
  const ok = a => Array.isArray(a) && a.every(i => Number.isInteger(i) && i >= 0 && i < n)
  data.known = ok(answer.known) ? answer.known : []
  data.again = ok(answer.again) ? answer.again : []
  data.rounds = Number.isInteger(answer.rounds) ? answer.rounds : 1
  let summary = t(lang, 'rFlash', { k: data.known.length, n })
  if (data.again.length) summary += t(lang, 'rFlashAgain', { a: data.again.length })
  // The fronts too (indexes are 0-based, the text version counts from 1), but only while the whole reply
  // stays under the cap; the indexes and rounds are always sent.
  if (data.again.length) {
    const practise = data.again.map(i => card.cards[i].front)
    const withFronts = `✓ ${summary}\n${REPLY_TAG} ${JSON.stringify({ ...data, practise })}`
    if ([...withFronts].length <= MAX_REPLY) data.practise = practise
  }
  return { mark: '✓', summary }
}
CARD_COMPONENTS.flashcards = FlashcardsCard
