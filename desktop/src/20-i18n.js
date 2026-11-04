// Button and hint texts. Card content is the model's; only this chrome is translated.
// The language comes from card.lang, else the app's UI language, else English.

const STRINGS = {
  en: {
    send: 'Send',
    done: 'Done',
    pick: 'Choose',
    submit: 'Submit',
    yes: 'Yes, go ahead',
    no: 'No',
    change: 'Change…',
    sendChange: 'Send change',
    cancel: 'Cancel',
    other: 'Other',
    otherPlaceholder: 'Your own answer',
    changePlaceholder: 'What should be different?',
    recommended: 'Recommended',
    pros: 'Pros',
    cons: 'Cons',
    required: 'Required',
    optional: 'optional',
    progress: '{done} of {total} done',
    pickCount: 'Pick {min}–{max}',
    pickAtLeast: 'Pick at least {min}',
    pickUpTo: 'Pick up to {max}',
    pickAny: 'Pick one or more',
    sent: 'Sent',
    answered: 'Your answer',
    inactive: 'This chat is no longer active. Open it to answer.',
    offline: 'Hermes is not connected right now.',
    retry: 'Try again',
    riskLow: 'Low risk',
    riskMedium: 'Medium risk',
    riskHigh: 'High risk',
    errRequired: 'Please fill this in.',
    errNumber: 'Enter a number.',
    errMin: 'At least {min}.',
    errMax: 'At most {max}.',
    errEmail: 'Enter an email address.',
    errTooLong: 'At most {max} characters.',
    errFix: 'Please check the marked fields.',
    yesWord: 'yes',
    noWord: 'no',
    comment: 'Comment (optional)',
    rate: 'Rate {n} of {max}',
    none: 'None of these',
    unavailable: 'not available',
    back: 'Back',
    next: 'Next',
    finish: 'Done',
    stuck: 'Stuck here',
    stepOf: 'Step {n} of {total}',
    check: 'Check',
    correct: 'Correct',
    wrong: 'Not quite',
    score: '{score} of {total} correct',
    sendScore: 'Send result',
    copy: 'Copy',
    copied: 'Copied',
    // reply line 1
    rChose: 'Chose: {x}',
    rOther: 'Other: "{x}"',
    rChecklist: 'Checklist done: {done} of {total} checked.',
    rChecklistAll: 'Checklist done: all {total} checked.',
    rStillOpen: 'Still open: {x}',
    rPicked: 'Picked: {x}',
    rForm: 'Form sent: {x}',
    rYes: 'Yes, go ahead: {x}',
    rNo: "No, don't: {x}",
    rChange: 'Change: {x}',
    rRated: 'Rated {n} of {max}',
    rSlot: 'Slot: {x}',
    rSlots: 'Slots: {x}',
    rNone: 'None of these slots fit',
    rSteps: 'Done with all {n} steps',
    rStuck: 'Stuck at step {n}: {x}',
    rQuiz: 'Quiz: {score} of {total} correct'
  },
  de: {
    send: 'Senden',
    done: 'Fertig',
    pick: 'Auswählen',
    submit: 'Absenden',
    yes: 'Ja, mach das',
    no: 'Nein',
    change: 'Ändern…',
    sendChange: 'Änderung senden',
    cancel: 'Abbrechen',
    other: 'Andere',
    otherPlaceholder: 'Eigene Antwort',
    changePlaceholder: 'Was soll anders sein?',
    recommended: 'Empfehlung',
    pros: 'Vorteile',
    cons: 'Nachteile',
    required: 'Pflichtfeld',
    optional: 'optional',
    progress: '{done} von {total} erledigt',
    pickCount: '{min}–{max} auswählen',
    pickAtLeast: 'Mindestens {min} auswählen',
    pickUpTo: 'Bis zu {max} auswählen',
    pickAny: 'Eine oder mehrere auswählen',
    sent: 'Gesendet',
    answered: 'Deine Antwort',
    inactive: 'Dieser Chat ist nicht mehr aktiv. Öffne ihn, um zu antworten.',
    offline: 'Hermes ist gerade nicht verbunden.',
    retry: 'Nochmal versuchen',
    riskLow: 'Geringes Risiko',
    riskMedium: 'Mittleres Risiko',
    riskHigh: 'Hohes Risiko',
    errRequired: 'Bitte ausfüllen.',
    errNumber: 'Bitte eine Zahl eingeben.',
    errMin: 'Mindestens {min}.',
    errMax: 'Höchstens {max}.',
    errEmail: 'Bitte eine E-Mail-Adresse eingeben.',
    errTooLong: 'Höchstens {max} Zeichen.',
    errFix: 'Bitte die markierten Felder prüfen.',
    yesWord: 'ja',
    noWord: 'nein',
    comment: 'Kommentar (optional)',
    rate: '{n} von {max} bewerten',
    none: 'Keiner davon',
    unavailable: 'nicht verfügbar',
    back: 'Zurück',
    next: 'Weiter',
    finish: 'Fertig',
    stuck: 'Hänge hier',
    stepOf: 'Schritt {n} von {total}',
    check: 'Prüfen',
    correct: 'Richtig',
    wrong: 'Nicht ganz',
    score: '{score} von {total} richtig',
    sendScore: 'Ergebnis senden',
    copy: 'Kopieren',
    copied: 'Kopiert',
    rChose: 'Gewählt: {x}',
    rOther: 'Andere: „{x}“',
    rChecklist: 'Checkliste fertig: {done} von {total} erledigt.',
    rChecklistAll: 'Checkliste fertig: alle {total} erledigt.',
    rStillOpen: 'Offen: {x}',
    rPicked: 'Gewählt: {x}',
    rForm: 'Formular gesendet: {x}',
    rYes: 'Ja, mach das: {x}',
    rNo: 'Nein, lieber nicht: {x}',
    rChange: 'Ändern: {x}',
    rRated: 'Bewertung: {n} von {max}',
    rSlot: 'Termin: {x}',
    rSlots: 'Termine: {x}',
    rNone: 'Keiner der Termine passt',
    rSteps: 'Alle {n} Schritte erledigt',
    rStuck: 'Hänge bei Schritt {n}: {x}',
    rQuiz: 'Quiz: {score} von {total} richtig'
  }
}

function appLanguage() {
  try {
    return (globalThis.navigator && globalThis.navigator.language) || 'en'
  } catch {
    return 'en'
  }
}

function cardLang(card) {
  const raw = (card && typeof card.lang === 'string' && card.lang) || appLanguage()
  return String(raw).toLowerCase().startsWith('de') ? 'de' : 'en'
}

function t(lang, key, vars) {
  const table = STRINGS[lang] || STRINGS.en
  let text = table[key] ?? STRINGS.en[key] ?? key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value))
    }
  }
  return text
}
