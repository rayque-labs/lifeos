/**
 * Initial offline repository for Tasks and Notes.
 * Temporary browser storage for development; Android SQLite migration follows.
 * Never silently fall back to a network API in offline mode.
 */
type RecordValue = Record<string, unknown> & { id: number }
type Collection = 'tasks' | 'notes' | 'projects' | 'habits' | 'events' | 'accounts' | 'categories' | 'transactions'
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
  if (collection === 'events') return { id, title: '', description: null, task_id: null, starts_at: new Date().toISOString(), ends_at: new Date().toISOString(), all_day: false, ...input }
  if (collection === 'accounts') return { id, name: '', currency: 'BRL', opening_balance: '0', balance: '0', ...input }
  if (collection === 'categories') return { id, name: '', kind: 'expense', ...input }
  if (collection === 'transactions') return { id, account_id: 0, category_id: null, kind: 'expense', title: '', amount: '0', occurred_on: new Date().toISOString().slice(0,10), description: null, ...input }
  const now = new Date().toISOString()
  return { id, title: '', content: '', category: null, tags: [], pinned: false, created_at: now, updated_at: now, ...input }
}
function monthSummary(month: string) {
  const transactions = read('transactions').filter(row => String(row.occurred_on).startsWith(month))
  const accounts = read('accounts')
  const currencies = [...new Set(accounts.map(a => String(a.currency)))]
  return { month, currencies: currencies.map(currency => {
    const accountIds = new Set(accounts.filter(a => a.currency === currency).map(a => a.id))
    const items = transactions.filter(t => accountIds.has(Number(t.account_id)))
    const sum = (kind: string) => items.filter(t => t.kind === kind).reduce((n,t) => n + Number(t.amount),0)
    const income = sum('income'), expenses = sum('expense')
    return { currency, income: income.toFixed(2), expenses: expenses.toFixed(2), net: (income - expenses).toFixed(2),
      categories: [] as Array<{category:string;kind:string;total:string}> }
  }) }
}
function enrichedProjects() {
  const tasks = read('tasks')
  return read('projects').map(project => {
    const linked = tasks.filter(task => Number(task.project_id) === project.id)
    const completed = linked.filter(task => task.completed).length
    return { ...project, total_tasks: linked.length, completed_tasks: completed, progress: linked.length ? Math.round(100 * completed / linked.length) : 0 }
  })
}
function dashboard() {
  const now = new Date(), today = now.toISOString().slice(0,10)
  const tasks = read('tasks'), projects = enrichedProjects().filter(p => p.status === 'active')
  const events = read('events').filter(e => String(e.starts_at) >= now.toISOString() && new Date(String(e.starts_at)).getTime() < now.getTime() + 7*86400000)
  const habits = offlineRequest<RecordValue[]>('/habits/', 'GET')
  return { generated_at: now.toISOString(), tasks: {
    total: tasks.length, pending: tasks.filter(t=>t.status==='pending').length,
    in_progress: tasks.filter(t=>t.status==='in_progress').length, completed: tasks.filter(t=>t.completed).length,
    overdue: tasks.filter(t=>!t.completed && t.due_at && String(t.due_at)<now.toISOString()).length,
    due_today: tasks.filter(t=>!t.completed && String(t.due_at||'').startsWith(today)).length
  }, projects: { active: projects.length, average_progress: projects.length ? Math.round(projects.reduce((n,p)=>n+Number(p.progress),0)/projects.length*10)/10 : 0 },
  habits_today: habits, upcoming_events: events.sort((a,b)=>String(a.starts_at).localeCompare(String(b.starts_at))).slice(0,20),
  finance: { accounts: accountRows(), monthly: monthSummary(today.slice(0,7)) } }
}
function accountRows() {
  const transactions = read('transactions')
  return read('accounts').map(account => {
    const total = transactions.filter(t=>Number(t.account_id)===account.id).reduce((n,t)=>n+(t.kind==='income'?1:-1)*Number(t.amount),0)
    return { ...account, balance: (Number(account.opening_balance)+total).toFixed(2) }
  })
}
export function offlineRequest<T>(path: string, method: string, body?: unknown): T {
  const url = new URL(path, 'https://lifeos.local')
  const parts = url.pathname.split('/').filter(Boolean)
  const root = parts[0]
  if (root === 'dashboard' && method === 'GET') return dashboard() as T
  if (root === 'auth') {
    if (parts[1] === 'me' && method === 'PATCH') {
      const user = { id:1, email:'local@lifeos.invalid', full_name:String((body as Record<string,unknown>)?.full_name || 'Meu LifeOS') }
      localStorage.setItem(prefix+'profile',JSON.stringify(user));return user as T
    }
    throw new Error('Contas e senhas não são necessárias no modo local.')
  }
  if (root === 'finance' && parts[1] === 'summary' && parts[2] === 'monthly') return monthSummary(url.searchParams.get('month') || new Date().toISOString().slice(0,7)) as T
  const collection = root === 'calendar' && parts[1] === 'events' ? 'events' : root === 'finance' ? parts[1] : root
  const idPart = root === 'calendar' ? parts[2] : root === 'finance' ? parts[2] : parts[1]
  if (!['tasks','notes','projects','habits','events','accounts','categories','transactions'].includes(collection)) throw new Error('Módulo não disponível offline: '+collection)
  const bucket = collection as Collection
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
  const rows = read(bucket)
  const id = idPart ? Number(idPart) : null
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
  if (method === 'GET') {
    if (id !== null) return rows.find(row => row.id === id) as T
    let result = collection === 'projects' ? enrichedProjects() : collection === 'accounts' ? accountRows() : collection === 'habits' ? rows.map(row => {
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
    if (collection === 'events') {
      const from = url.searchParams.get('starts_after') || url.searchParams.get('from_date') || url.searchParams.get('start')
      const to = url.searchParams.get('starts_before') || url.searchParams.get('to_date') || url.searchParams.get('end')
      if (from) result = result.filter(r=>String(r.starts_at)>=from)
      if (to) result = result.filter(r=>String(r.starts_at)<=to)
    }
    if (collection === 'transactions') result = result.slice(0,Number(url.searchParams.get('limit')||100))
    if (collection === 'tasks' && url.searchParams.get('sort_by') === 'due_at') result = [...result].sort((a,b)=>String(a.due_at||'9999').localeCompare(String(b.due_at||'9999')))
    return result as T
  }
  if (method === 'POST' && id === null) {
    const nextId = rows.reduce((max, row) => Math.max(max,row.id),0) + 1
    const created = defaults(collection,payload,nextId)
    write(bucket,[...rows,created]); return created as T
  }
  const index = rows.findIndex(row => row.id === id)
  if (index < 0) throw new Error('Registro não encontrado.')
  if (method === 'PATCH' || method === 'PUT') {
    const updated: RecordValue = { ...rows[index], ...payload, id: rows[index].id }
    if (collection === 'tasks') {
      if ('completed' in payload) updated.status = payload.completed ? 'completed' : 'pending'
      else if ('status' in payload) updated.completed = payload.status === 'completed'
    } else updated.updated_at = new Date().toISOString()
    rows[index] = updated;write(bucket,rows);return updated as T
  }
  if (method === 'DELETE') { rows.splice(index,1);write(collection,rows);return undefined as T }
  throw new Error('Operação local não suportada.')
}
