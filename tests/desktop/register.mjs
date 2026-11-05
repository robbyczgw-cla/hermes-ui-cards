// Preloaded with `node --import`: maps @hermes/plugin-sdk to a small stand-in so
// desktop/plugin.js runs under node:test without Hermes Desktop.
import { register } from 'node:module'
import { inspect } from 'node:util'

// A failing assert on a jsdom node used to print the whole window graph (circular, huge): on
// 2026-11-05 that took a run to 15 GB. Keep every inspected value small.
Object.assign(inspect.defaultOptions, { depth: 2, maxArrayLength: 20, maxStringLength: 2000, breakLength: 120 })

register('./loader.mjs', import.meta.url)
