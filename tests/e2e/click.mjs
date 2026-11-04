// Mounts the Desktop card renderer for a real hui_present tool result (as Hermes
// Desktop would), ticks the given checklist items, presses Done and prints the
// message the card sends into the chat.
//   node --import ./tests/desktop/register.mjs tests/e2e/click.mjs <result.json> <session-id> <item indexes...>
import { readFileSync } from 'node:fs'

import { buttonByText, click, mount, testHost } from '../desktop/dom.mjs'

const [resultPath, sessionId, ...indexes] = process.argv.slice(2)
const result = JSON.parse(readFileSync(resultPath, 'utf8'))
const view = await mount(result, { sessionId })
if (view.container.querySelector('[data-fallback]')) {
  console.error('renderer fell back to the attachment view: the tool result was not accepted')
  process.exit(2)
}
const boxes = view.container.querySelectorAll('input[type="checkbox"]')
for (const i of indexes) await click(boxes[Number(i)])
await click(buttonByText(view.container, 'Done'))
const sent = testHost.submissions.at(-1)
if (!sent) {
  console.error('the card sent nothing')
  process.exit(3)
}
process.stdout.write(JSON.stringify(sent) + '\n')
await view.unmount()
