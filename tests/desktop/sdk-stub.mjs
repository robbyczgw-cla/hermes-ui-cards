// Stand-in for the parts of @hermes/plugin-sdk the plugin touches. Tests drive it
// through `testHost`: composer answers, gateway state, captured submissions.
import { useSyncExternalStore } from 'react'

export const TOOL_MEDIA_RENDERER_AREA = 'transcript.toolMedia'
export const PALETTE_AREA = 'palette'

export function atom(initial) {
  let value = initial
  const subs = new Set()
  return {
    get: () => value,
    set(next) {
      value = next
      for (const fn of subs) fn(value)
    },
    subscribe(fn) {
      subs.add(fn)
      fn(value)
      return () => subs.delete(fn)
    },
    listen(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    }
  }
}

export function useValue(store) {
  return useSyncExternalStore(fn => store.listen(fn), store.get, store.get)
}

export const testHost = {
  submissions: [],
  submitResult: true,
  notifications: []
}

export const host = {
  state: {
    gateway: atom('open'),
    busyBySession: atom({}),
    focusedSessionId: atom('sess-1')
  },
  composer: {
    submit(sessionId, text) {
      testHost.submissions.push({ sessionId, text })
      return testHost.submitResult
    },
    focus() {}
  },
  notify(n) {
    testHost.notifications.push(n)
    return 'n1'
  }
}
