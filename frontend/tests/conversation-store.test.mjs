import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConversation, saveConversationMessages, clearConversation, conversationContext, HISTORY_LIMIT } from '../src/lib/conversation-store.ts'
const message = (text) => ({ id: crypto.randomUUID(), role: 'user', text })
test('history survives reopening and is isolated by account', async () => {
  const a = await loadConversation('reopen-a')
  await saveConversationMessages('reopen-a', a.epoch, [message('Meu projeto se chama LifeOS')])
  assert.equal((await loadConversation('reopen-a')).messages[0].text, 'Meu projeto se chama LifeOS')
  assert.deepEqual((await loadConversation('reopen-b')).messages, [])
})
test('concurrent initializations and append operations do not lose either panel', async () => {
  const [a, b] = await Promise.all([loadConversation('race'), loadConversation('race')])
  assert.equal(a.epoch, b.epoch)
  await Promise.all([saveConversationMessages('race', a.epoch, [message('one')]), saveConversationMessages('race', b.epoch, [message('two')])])
  assert.deepEqual(new Set((await loadConversation('race')).messages.map(m => m.text)), new Set(['one', 'two']))
})
test('clear prevents a stale in-flight reply from resurrecting messages', async () => {
  const a = await loadConversation('clear')
  await saveConversationMessages('clear', a.epoch, [message('old')])
  const epoch = await clearConversation('clear')
  await assert.rejects(saveConversationMessages('clear', a.epoch, [message('stale')]))
  assert.notEqual(a.epoch, epoch)
  assert.deepEqual((await loadConversation('clear')).messages, [])
})
test('update is idempotent and history retention is bounded', async () => {
  const a = await loadConversation('limit')
  const rows = Array.from({ length: HISTORY_LIMIT + 10 }, (_, i) => message(String(i)))
  await saveConversationMessages('limit', a.epoch, rows)
  let read = await loadConversation('limit')
  assert.equal(read.messages.length, HISTORY_LIMIT)
  assert.equal(read.messages[0].text, '10')
  const updated = { ...read.messages[0], text: 'edited' }
  await saveConversationMessages('limit', a.epoch, [updated])
  read = await loadConversation('limit')
  assert.equal(read.messages.length, HISTORY_LIMIT)
  assert.equal(read.messages[0].text, 'edited')
})
test('disk rows encrypt text and context excludes private tool data', async () => {
  const db = await new Promise(resolve => { const req = indexedDB.open('lifeos-conversations', 1); req.onsuccess = () => resolve(req.result) })
  const rows = await new Promise(resolve => { const req = db.transaction('entries').objectStore('entries').getAll(); req.onsuccess = () => resolve(req.result) })
  assert.ok(rows.length)
  assert.ok(rows.every(row => row.data instanceof ArrayBuffer && !('text' in row)))
  db.close()
  assert.deepEqual(conversationContext([
    { id: 'intro', role: 'model', text: 'intro' },
    { id: 'u', role: 'user', text: 'oi' },
    { id: 'p', role: 'model', text: 'saldo secreto', local: true, private: true },
    { id: 's', role: 'model', text: 'arquivo privado', local: true, context: 'Plano ainda não executado.' },
  ]), [{ role: 'user', text: 'oi' }, { role: 'model', text: 'Plano ainda não executado.' }])
})
