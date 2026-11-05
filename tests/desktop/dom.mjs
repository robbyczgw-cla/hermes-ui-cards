// A DOM (jsdom) plus helpers to mount the plugin's card renderer the way Hermes
// Desktop does: it calls render({ file, args, result, sessionId, fallback }).
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
const g = globalThis
g.window = dom.window
g.document = dom.window.document
Object.defineProperty(g, 'navigator', { value: { language: 'en-GB', userAgent: 'node' }, configurable: true, writable: true })
for (const key of ['HTMLElement', 'Node', 'Event', 'KeyboardEvent', 'MouseEvent', 'InputEvent', 'getComputedStyle']) {
  g[key] = dom.window[key]
}
g.IS_REACT_ACT_ENVIRONMENT = true

const React = await import('react')
const { createRoot } = await import('react-dom/client')
const { act } = React
const sdk = await import('@hermes/plugin-sdk')
const mod = await import('../../desktop/plugin.js')
const plugin = mod.default

export const { testHost, host } = sdk
export { act, mod, plugin }

// A fresh in-memory ctx.storage, shared across remounts to simulate reopening a chat.
export function makeStorage() {
  const map = new Map()
  return {
    map,
    get: (k, fallback) => (map.has(k) ? JSON.parse(map.get(k)) : fallback),
    set: (k, v) => void map.set(k, JSON.stringify(v)),
    remove: k => void map.delete(k)
  }
}

export function registerPlugin(storage = makeStorage()) {
  const contributions = []
  const ctx = {
    storage,
    register: c => {
      contributions.push(c)
      return () => {}
    },
    registerMany: cs => cs.forEach(c => contributions.push(c)),
    os: { writeClipboard: async () => true }
  }
  plugin.register(ctx)
  return { ctx, contributions, storage }
}

let nextId = 0
export function toolResult(card, extra = {}) {
  const cardId = card.cardId || `${card.id || card.type}-t${(nextId++).toString(16).padStart(5, '0')}`
  const checked = mod.validateCard(card)
  if (!checked.card) throw new Error('fixture card invalid: ' + checked.errors.join('; '))
  return JSON.stringify({ ok: true, cardId, type: card.type, media: `MEDIA:/tmp/${cardId}.md`, card: { cardId, ...checked.card }, display: { compact: false, accent: 'app' }, ...extra })
}

export async function mount(result, { sessionId = 'sess-1', registration } = {}) {
  const reg = registration || registerPlugin()
  const renderer = reg.contributions.find(c => c.area === 'transcript.toolMedia')
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const fallback = React.createElement('div', { 'data-fallback': true }, 'built-in attachment')
  await act(async () => {
    root.render(renderer.data.render({ file: { path: '/tmp/x.md' }, args: {}, result, sessionId, fallback, toolName: 'hui_present' }))
  })
  return {
    container,
    reg,
    // Render the same tool result again, e.g. after the chat's id changed (runtime → stored id).
    rerender: async (next = {}) => {
      await act(async () => {
        root.render(renderer.data.render({ file: { path: '/tmp/x.md' }, args: {}, result, sessionId, fallback, toolName: 'hui_present', ...next }))
      })
    },
    unmount: async () => {
      await act(async () => root.unmount())
      container.remove()
    }
  }
}

export async function click(el) {
  if (!el) throw new Error('click: element not found')
  await act(async () => {
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
  })
}

// React listens for native input events; set the value through the prototype setter.
export async function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  await act(async () => {
    setter.call(el, value)
    el.dispatchEvent(new window.Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}

export async function key(el, keyName) {
  await act(async () => {
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: keyName, bubbles: true }))
  })
}

export function buttonByText(container, text) {
  return [...container.querySelectorAll('button')].find(b => b.textContent.trim() === text && !b.hidden)
}

export function resetHost() {
  testHost.submissions.length = 0
  testHost.submitResult = true
  testHost.notifications.length = 0
  host.state.gateway.set('open')
}

export function lastReply() {
  const last = testHost.submissions.at(-1)
  if (!last) return null
  const [line1, line2] = last.text.split('\n')
  return { sessionId: last.sessionId, line1, json: JSON.parse(line2.replace(/^\[hui-card\] /, '')), text: last.text }
}
