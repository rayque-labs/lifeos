/** Session ledger independent of any panel. Transactions serialize multiple WebViews. */
export type Source = { url: string; title: string }
export type ChatMessage = { id: string; role: 'user' | 'model'; text: string; local?: boolean; private?: boolean; sources?: Source[]; searchHtml?: string; phase?: 'proposal' | 'result' | 'error'; context?: string }
type Meta = { epoch: string; key: CryptoKey; sequence: number }
type Row = { id: string; account: string; epoch: string; sequence: number; iv: Uint8Array<ArrayBuffer>; data: ArrayBuffer }
export const CONVERSATION_CHANNEL = 'lifeos-conversation-updated'
function changed(account: string) {
  if (typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(CONVERSATION_CHANNEL)
  channel.postMessage(account); channel.close()
}
const DB = 'lifeos-conversations'
export const HISTORY_LIMIT = 120
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore('accounts')
      const entries = req.result.createObjectStore('entries', { keyPath: 'id' })
      entries.createIndex('account', 'account')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function transaction<T>(mode: IDBTransactionMode, run: (tx: IDBTransaction, done: (value: T) => void) => void): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(['accounts', 'entries'], mode)
      let value: T
      tx.oncomplete = () => resolve(value)
      tx.onabort = tx.onerror = () => reject(tx.error || Error('Não foi possível salvar a conversa.'))
      try { run(tx, result => { value = result }) } catch (error) { tx.abort(); reject(error) }
    })
  } finally { db.close() }
}
async function ensure(account: string): Promise<Meta> {
  if (!account) throw Error('Conta ausente para salvar a conversa.')
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  return transaction('readwrite', (tx, done) => {
    const store = tx.objectStore('accounts')
    const req = store.get(account)
    req.onsuccess = () => {
      const meta: Meta = req.result ?? { epoch: crypto.randomUUID(), key, sequence: 0 }
      if (!req.result) store.put(meta, account)
      done(meta)
    }
  })
}
export async function loadConversation(account: string): Promise<{ epoch: string; messages: ChatMessage[] }> {
  await ensure(account)
  const snapshot = await transaction<{ meta: Meta; rows: Row[] }>('readonly', (tx, done) => {
    const meta = tx.objectStore('accounts').get(account)
    const rows = tx.objectStore('entries').index('account').getAll(account)
    rows.onsuccess = () => done({ meta: meta.result, rows: rows.result })
  })
  const messages = await Promise.all(snapshot.rows.filter(row => row.epoch === snapshot.meta.epoch).sort((a, b) => a.sequence - b.sequence).map(async row => {
    const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv, additionalData: new TextEncoder().encode(account + ':' + row.epoch + ':' + row.id) }, snapshot.meta.key, row.data)
    return JSON.parse(new TextDecoder().decode(bytes)) as ChatMessage
  }))
  return { epoch: snapshot.meta.epoch, messages }
}
export async function saveConversationMessages(account: string, epoch: string, messages: ChatMessage[]): Promise<void> {
  const meta = await ensure(account)
  if (meta.epoch !== epoch) throw Error('A conversa foi limpa em outra janela. Abra a conversa novamente.')
  const rows = await Promise.all(messages.map(async message => {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const id = account + ':' + message.id
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(account + ':' + epoch + ':' + id) }, meta.key, new TextEncoder().encode(JSON.stringify(message)))
    return { id, account, epoch, iv, data }
  }))
  const saved = await transaction<boolean>('readwrite', (tx, done) => {
    const accounts = tx.objectStore('accounts')
    const entries = tx.objectStore('entries')
    const request = accounts.get(account)
    request.onsuccess = () => {
      const current: Meta = request.result
      if (current.epoch !== epoch) { done(false); return }
      const existing = entries.index('account').getAll(account)
      existing.onsuccess = () => {
        const previous = existing.result as Row[]
        const sequences = new Map(previous.map(row => [row.id, row.sequence]))
        const updated = rows.map(row => ({ ...row, sequence: sequences.get(row.id) ?? ++current.sequence }))
        updated.forEach(row => entries.put(row))
        const merged = new Map(previous.map(row => [row.id, row]))
        updated.forEach(row => merged.set(row.id, row))
        const ordered = [...merged.values()].sort((a, b) => a.sequence - b.sequence)
        ordered.slice(0, Math.max(0, ordered.length - HISTORY_LIMIT)).forEach(row => entries.delete(row.id))
        accounts.put(current, account)
        done(true)
      }
    }
  })
  if (!saved) throw Error('A conversa foi limpa em outra janela.')
  changed(account)
}
export async function clearConversation(account: string): Promise<string> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const result = await transaction<string>('readwrite', (tx, done) => {
    const epoch = crypto.randomUUID()
    tx.objectStore('accounts').put({ epoch, key, sequence: 0 }, account)
    const entries = tx.objectStore('entries')
    const req = entries.index('account').getAllKeys(account)
    req.onsuccess = () => { req.result.forEach(id => entries.delete(id)); done(epoch) }
  })
  changed(account)
  return result
}
/** Tool output remains local; only explicitly safe status summaries enter model context. */
export function conversationContext(messages: ChatMessage[]): { role: 'user' | 'model'; text: string }[] {
  return messages.filter(m => m.id !== 'intro').flatMap(m => {
    if (m.context) return [{ role: m.role, text: m.context }]
    if (m.local || m.private) return []
    return [{ role: m.role, text: m.text }]
  }).slice(-32)
}
