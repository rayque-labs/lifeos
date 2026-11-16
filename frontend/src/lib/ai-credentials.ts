import type { AIConfig } from './ai-providers'

const DATABASE = 'lifeos-ai-credentials'
const STORE = 'secure'
const KEY = 'encryption-key'
const CREDENTIALS = 'credentials'
type RecordValue = { iv: number[]; encrypted: ArrayBuffer | number[] }
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || Error('Falha ao abrir armazenamento seguro'))
  })
}
async function read<T>(name: string): Promise<T | undefined> {
  const db = await openDB()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(name)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  } finally { db.close() }
}
async function write(name: string, value: unknown): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, name)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
async function remove(name: string): Promise<void> {
  const db = await openDB()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(name)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}
async function getKey(keyName: string): Promise<CryptoKey> {
  const existing = await read<CryptoKey>(keyName)
  if (existing) return existing
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  await write(keyName, key)
  return key
}
export async function saveEncrypted(name: string, keyName: string, config: unknown): Promise<void> {
  const key = await getKey(keyName)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(config))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  await write(name, { iv: Array.from(iv), encrypted } satisfies RecordValue)
}
export async function loadEncrypted<T>(name: string, keyName: string): Promise<T | null> {
  const stored = await read<RecordValue>(name)
  if (!stored) return null
  const key = await read<CryptoKey>(keyName)
  if (!key) throw Error('Chave de criptografia indisponível. Exclua a configuração e salve novamente.')
  const encrypted = Array.isArray(stored.encrypted) ? new Uint8Array(stored.encrypted) : stored.encrypted
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(stored.iv) }, key, encrypted)
  return JSON.parse(new TextDecoder().decode(decrypted)) as T
}
export async function deleteEncrypted(name: string, keyName: string): Promise<void> {
  await remove(name)
  await remove(keyName)
}
export async function saveAIConfig(config: AIConfig): Promise<void> {
  await saveEncrypted(CREDENTIALS, KEY, config)
  window.dispatchEvent(new Event('lifeos-ai-config-changed'))
}
export async function loadAIConfig(): Promise<AIConfig | null> {
  return loadEncrypted<AIConfig>(CREDENTIALS, KEY)
}
export async function deleteAIConfig(): Promise<void> {
  await deleteEncrypted(CREDENTIALS, KEY)
  window.dispatchEvent(new Event('lifeos-ai-config-changed'))
}
