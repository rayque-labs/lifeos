// Runs the actual offline worker bundle without a microphone or paid API.
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { saveAIConfig } from '../src/lib/ai-credentials.ts'
import { loadConversation } from '../src/lib/conversation-store.ts'
const originalFetch = globalThis.fetch
const events = []
globalThis.window = globalThis
globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) }
globalThis.localStorage = { getItem: () => null }
globalThis.dispatchEvent = () => {}
globalThis.TophVoice = { ready() { events.push('ready') }, reply(text, failed) { events.push({ text, failed }) } }
await saveAIConfig({ provider: 'groq', model: 'openai/gpt-oss-120b', apiKey: 'test-only', endpoint: '' })
const html = await readFile(new URL('../dist/voice-session.html', import.meta.url), 'utf8')
const source = html.match(/src="([^"]+\.js)"/)[1]
const script = pathToFileURL(resolve(new URL('../dist', import.meta.url).pathname, '.' + source)).href
const requests = []
let planned = { reply: 'Seu projeto se chama Aurora.', action: null }
globalThis.fetch = async (_url, options) => {
  requests.push(JSON.parse(options.body))
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(planned) } }] }))
}
try {
  await import(script)
  assert.equal(events[0], 'ready')
  await window.tophVoiceTurn('Meu projeto se chama Aurora')
  assert.equal(events.at(-1).failed, false)
  assert.equal((await loadConversation('local@lifeos.invalid')).messages.length, 2)
  // Recreate the worker, as after stopping and starting the Android service.
  await import(script + '?reopened')
  await window.tophVoiceTurn('Como se chama meu projeto?')
  assert.ok(requests.at(-1).messages.some(m => m.content === 'Meu projeto se chama Aurora'))
  planned = { reply: 'Proponho criar a pasta.', action: { kind: 'files', operation: 'mkdir', name: 'Aurora' } }
  await window.tophVoiceTurn('Crie a pasta Aurora')
  assert.match(events.at(-1).text, /precisa do painel/)
  assert.equal((await loadConversation('local@lifeos.invalid')).messages.at(-1).phase, 'proposal')
  assert.equal(requests.length, 3, 'voice proposals do not call mutation endpoints')
  await window.tophVoiceTurn('Lembre que prefiro música instrumental')
  assert.match(events.at(-1).text, /Guardei/)
  globalThis.fetch = async () => new Response('', { status: 401 })
  await window.tophVoiceTurn('Oi')
  assert.equal(events.at(-1).failed, true)
  assert.equal((await loadConversation('local@lifeos.invalid')).messages.at(-1).phase, 'error')
  console.log('Voice worker integration: persistence, reopen context, panel handoff, memory, API failure passed')
} finally { globalThis.fetch = originalFetch }
