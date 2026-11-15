/**
 * Initial offline repository for Tasks and Notes.
 * Temporary browser storage for development; Android SQLite migration follows.
 * Never silently fall back to a network API in offline mode.
 */
type RecordValue = Record<string, unknown> & { id: number }
type Collection = 'tasks' | 'notes' | 'projects' | 'habits'
const prefix = 'lifeos:offline:v1:'
function read(collection: Collection): RecordValue[] {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(prefix + collection) || '[]')
    return Array.isArray(parsed) ? parsed as RecordValue[] : []
  } catch { return [] }
}
function write(collection: Collection, rows: RecordValue[]) {
  localStorage.setItem(prefix + collection, JSON.stringify(rows))
}
function defaults(collection: Collection, input: Record<string, unknown>, id: number): RecordValue {
  if (collection === 'tasks') return {
    id, title: '', description: null, priority: 'medium', category: null, project_id: null,
    due_at: null, status: 'pending', completed: false, recurrence_rule: 'none', ...input,
  }
  if (collection === 'projects') return {
    id, title: '', description: null, objective: null, deadline: null, status: 'active',
    priority: 'medium', progress: 0, total_tasks: 0, completed_tasks: 0, ...input,
  }
  if (collection === 'habits') return {
    id, name: '', description: null, frequency: 'daily', target_per_week: 7,
    active: true, current_streak: 0, consistency_percentage: 0,
    log_count_30_days: 0, checked_in_today: false, ...input,
  }
  const now = new Date().toISOString()
  return { id, title: '', content: '', category: null, tags: [], pinned: false, created_at: now, updated_at: now, ...input }
}
export function offlineRequest<T>(path: string, method: string, body?: unknown): T {
  const url = new URL(path, 'https://lifeos.local')
  const parts = url.pathname.split('/').filter(Boolean)
  const collection = parts[0]
  if (collection !== 'tasks' && collection !== 'notes' && collection !== 'projects' && collection !== 'habits') throw new Error('Módulo ainda não disponível offline: ' + collection)
  if (collection === 'habits' && parts.length === 3 && parts[2] === 'logs') {
    const habitId = Number(parts[1])
    const key = prefix + 'habit-logs:' + habitId
    const logs: Array<{ id: number; habit_id: number; logged_on: string }> = JSON.parse(localStorage.getItem(key) || '[]')
    if (method === 'GET') return logs.filter(log => !url.searchParams.get('from_date') || log.logged_on >= url.searchParams.get('from_date')!) as T
    if (method === 'POST') {
      const date = String((body as { logged_on?: string } | undefined)?.logged_on || new Date().toISOString().slice(0, 10))
      const existing = logs.find(log => log.logged_on === date)
      if (existing) return existing as T
      const created = { id: logs.reduce((max, log) => Math.max(max, log.id), 0) + 1, habit_id: habitId, logged_on: date }
      localStorage.setItem(key, JSON.stringify([...logs, created]))
      return created as T
    }
  }
  if (parts.length > 2) throw new Error('Operação não disponível offline.')
  const rows = read(collection)
  const id = parts[1] ? Number(parts[1]) : null
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  if (method === 'GET') {
    if (id !== null) return rows.find(row => row.id === id) as T
    let result = collection === 'habits' ? rows.map(row => {
      const logs: Array<{ logged_on: string }> = JSON.parse(localStorage.getItem(prefix + 'habit-logs:' + row.id) || '[]')
      const today = new Date().toISOString().slice(0, 10)
      const days30 = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
      return { ...row, checked_in_today: logs.some(log => log.logged_on === today), log_count_30_days: logs.filter(log => log.logged_on >= days30).length }
    }) : rows
    const search = (url.searchParams.get('search') || url.searchParams.get('q') || '').toLowerCase()
    if (search) result = result.filter(row => String(row.title || '').toLowerCase().includes(search))
    for (const filter of ['status', 'priority', 'category', 'active']) {
      const value = url.searchParams.get(filter)
      if (value) result = result.filter(row => String(row[filter]) === value)
    }
    return result as T
  }
  if (method === 'POST' && id === null) {
    const nextId = rows.reduce((max, row) => Math.max(max,row.id),0) + 1
    const created = defaults(collection,payload,nextId)
    write(collection,[...rows,created]); return created as T
  }
  const index = rows.findIndex(row => row.id === id)
  if (index < 0) throw new Error('Registro não encontrado.')
  if (method === 'PATCH' || method === 'PUT') {
    const updated: RecordValue = { ...rows[index], ...payload, id: rows[index].id }
    if (collection === 'tasks') {
      if ('completed' in payload) updated.status = payload.completed ? 'completed' : 'pending'
      else if ('status' in payload) updated.completed = payload.status === 'completed'
    } else updated.updated_at = new Date().toISOString()
    rows[index] = updated;write(collection,rows);return updated as T
  }
  if (method === 'DELETE') { rows.splice(index,1);write(collection,rows);return undefined as T }
  throw new Error('Operação local não suportada.')
}
