#!/usr/bin/env node
// Evaluate the validator fragment, without loading the Desktop plugin or SDK.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = new URL('../', import.meta.url)
const schema = JSON.parse(readFileSync(new URL('hui_cards/cards.schema.json', root), 'utf8'))
const source = readFileSync(new URL('desktop/src/10-validate.js', root), 'utf8')
const context = vm.createContext({ SCHEMA: schema })
vm.runInContext(source, context, { filename: fileURLToPath(new URL('desktop/src/10-validate.js', root)) })
const validate = vm.runInContext('validateCard', context)

if (process.argv.length < 3) {
  process.stderr.write('Usage: node scripts/validate_js.mjs <file.json>...\n')
  process.exitCode = 2
}
for (const file of process.argv.slice(2)) {
  const raw = JSON.parse(readFileSync(file, 'utf8'))
  process.stdout.write(JSON.stringify({ file, ...validate(raw) }) + '\n')
}
