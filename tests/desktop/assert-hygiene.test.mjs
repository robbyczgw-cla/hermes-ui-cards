// Guard against the 2026-11-05 incident: a failing assert.equal(<jsdom node>, …) makes node:assert
// inspect the whole jsdom window (circular, huge) and the run grew to 15 GB. Compare DOM nodes only
// through booleans: assert.ok(el === null, msg), assert.ok(document.activeElement === button).
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const here = new URL('.', import.meta.url)
const NODE_LOOKUP = /querySelector(All)?\(|buttonByText\(|activeElement|getElementById\(|\.closest\(/
const SAFE_TAIL = /\)\s*\??\.\s*(textContent|getAttribute|value|checked|disabled|tabIndex|classList|length|hidden|dataset|style|innerHTML|id|tagName|className|matches)\b/

test('tests never pass DOM nodes to assert.equal / deepEqual', () => {
  const bad = []
  for (const name of readdirSync(here).filter(f => f.endsWith('.mjs'))) {
    readFileSync(new URL(name, here), 'utf8').split('\n').forEach((line, i) => {
      const m = line.match(/assert\.(equal|strictEqual|notEqual|notStrictEqual|deepEqual|deepStrictEqual)\((.*)/)
      // Lookups turned into plain values first (texts(...), [...].map(...)) are fine.
      const mapped = Boolean(m) && /\btexts\(|\]\s*\.map\(/.test(m[2])
      if (m && !mapped && NODE_LOOKUP.test(m[2]) && !SAFE_TAIL.test(m[2]) && !/\.(textContent|value|checked|length)\b/.test(m[2])) {
        bad.push(`${name}:${i + 1}: ${line.trim()}`)
      }
    })
  }
  assert.ok(bad.length === 0, 'compare DOM nodes through a boolean instead:\n' + bad.join('\n'))
})
