import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateScreenStep, screenPrompt } from '../src/lib/screen-executor.ts'
import { validateDecision } from '../src/lib/execution-schema.ts'
const screen = { token: 'native-secret-token', app: 'com.android.chrome', fingerprint: 'hash', truncated: false, elements: [
  { id: 'e0', label: 'Pesquisar', click: true, edit: false, scroll: false },
  { id: 'e1', label: 'Consulta', click: true, edit: true, scroll: false },
  { id: 'e2', label: 'Lista', click: false, edit: false, scroll: true },
] }
const parse = value => validateScreenStep(JSON.stringify(value), screen)
test('screen planner cannot invent targets, gestures or native tokens', () => {
  for (const value of [{ target: 'other', action: 'click' }, { target: 'e0', action: 'shell' }, { target: 'e0', action: 'tap', x: 10, y: 20 }]) {
    assert.throws(() => parse({ status: 'action', reason: 'test', ...value }))
  }
  const valid = parse({ status: 'action', reason: 'Abrir pesquisa', action: 'click', target: 'e0', token: 'injected', confirmed: true })
  assert.deepEqual(valid, { status: 'action', reason: 'Abrir pesquisa', action: 'click', target: 'e0' })
})
test('type and scroll must match observed element capabilities', () => {
  assert.throws(() => parse({ status: 'action', reason: 'x', action: 'type', target: 'e0', text: 'x' }))
  assert.throws(() => parse({ status: 'action', reason: 'x', action: 'scroll-down', target: 'e1' }))
  assert.equal(parse({ status: 'action', reason: 'x', action: 'type', target: 'e1', text: 'Bossa nova' }).text, 'Bossa nova')
  assert.throws(() => parse({ status: 'action', reason: 'x', action: 'type', target: 'e1', text: 'x'.repeat(1001) }))
})
test('completion needs evidence from this actual observation', () => {
  assert.throws(() => parse({ status: 'done', reason: 'Pronto', evidence: [] }))
  assert.throws(() => parse({ status: 'done', reason: 'Pronto', evidence: ['unknown'] }))
  assert.equal(parse({ status: 'done', reason: 'Texto exibido', evidence: ['e0'] }).status, 'done')
  assert.equal(parse({ status: 'blocked', reason: 'Faça login manualmente' }).status, 'blocked')
})
test('model receives bounded observations but no executable token', () => {
  const request = screenPrompt('Pesquisar música', screen, Array(20).fill('step'))
  assert.equal(request.includes('native-secret-token'), false)
  assert.equal(JSON.parse(request).completedSteps.length, 8)
  assert.throws(() => screenPrompt('x'.repeat(501), screen, []))
})
test('chat routes screen requests to review only', () => {
  assert.deepEqual(validateDecision(JSON.stringify({ reply: 'Abrir executor', action: { kind: 'screen-task', goal: 'Procurar música', click: 'e0', confirm: true } })).action, { kind: 'screen-task', goal: 'Procurar música' })
})
