import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

/**
 * Native SQLite mirror of the offline repository's key-value records.
 * Existing localStorage data is imported on first launch; SQLite becomes
 * authoritative on subsequent launches. The web development build stays localStorage-only.
 */
const PREFIX = 'lifeos:offline:v1:'
let connection: SQLiteDBConnection | null = null
let startup: Promise<void> | null = null
let pending: Promise<void> = Promise.resolve()

function currentRecords(): Array<[string, string]> {
  const records: Array<[string, string]> = []
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)
    if (key?.startsWith(PREFIX)) records.push([key, localStorage.getItem(key) || ''])
  }
  return records
}

export function initializeOfflineStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve()
  if (startup) return startup
  startup = (async () => {
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    const db = await sqlite.createConnection('lifeos', false, 'no-encryption', 1, false)
    await db.open()
    await db.execute('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);')
    const result = await db.query('SELECT key, value FROM kv')
    const rows = result.values || []
    if (rows.length > 0) {
      for (const key of Object.keys(localStorage).filter(key => key.startsWith(PREFIX))) localStorage.removeItem(key)
      for (const row of rows) {
        if (typeof row.key === 'string' && typeof row.value === 'string') localStorage.setItem(row.key, row.value)
      }
    } else {
      for (const [key, value] of currentRecords()) await db.run('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value])
    }
    connection = db
  })().catch(error => { startup = null; throw error })
  return startup
}

export async function persistOfflineStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  await initializeOfflineStorage()
  const db = connection
  if (!db) throw new Error('Banco SQLite não inicializado.')
  const snapshot = currentRecords()
  pending = pending.catch(() => undefined).then(async () => {
    // Use the plugin's own transaction API; db.run defaults to managing a transaction.
    // A single executeSet operation avoids nested BEGIN/COMMIT failures on Android.
    await db.executeSet([
      { statement: 'DELETE FROM kv;', values: [] },
      ...snapshot.map(([key, value]) => ({ statement: 'INSERT INTO kv (key, value) VALUES (?, ?);', values: [key, value] })),
    ], true)
  })
  return pending
}
