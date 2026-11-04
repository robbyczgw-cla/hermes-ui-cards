// Preloaded with `node --import`: maps @hermes/plugin-sdk to a small stand-in so
// desktop/plugin.js runs under node:test without Hermes Desktop.
import { register } from 'node:module'

register('./loader.mjs', import.meta.url)
