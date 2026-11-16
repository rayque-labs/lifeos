import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CheckSquare2, ChevronRight, CircleDot, Database, Flame, Layers2, ListTodo, Target, Wallet } from 'lucide-react'
import { SectionBanner } from '../components/Personalization'
import { Button, ErrorMessage, LoadingState } from '../components/ui'
import { taskChangedEvent } from '../lib/assistant-actions'
import { get } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Dashboard, Task } from '../lib/types'
import './DashboardPage.css'

const shortcuts = [
  { label: 'Rotina', to: '/tasks', icon: CalendarDays },
  { label: 'Hábitos', to: '/habits', icon: CircleDot },
  { label: 'Finanças', to: '/finance', icon: Database },
  { label: 'Projetos', to: '/projects', icon: Layers2 },
]
const day = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })
const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const sameDay = (value: string | null, date: Date) => value && new Date(value).toDateString() === date.toDateString()

function Panel({ title, to, icon: Icon, children }: { title: string; to: string; icon: typeof CalendarDays; children: ReactNode }) {
  return <div className="home-panel">
    <Link className="home-panel-title" to={to}><Icon size={19} /><h2>{title}</h2><ChevronRight size={16} /></Link>
    {children}
  </div>
}

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<{ summary: Dashboard; tasks: Task[] } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1)
    window.addEventListener(taskChangedEvent, refresh)
    return () => window.removeEventListener(taskChangedEvent, refresh)
  }, [])
  useEffect(() => {
    let active = true
    Promise.all([get<Dashboard>('/dashboard/'), get<Task[]>('/tasks/?sort_by=due_at')])
      .then(([summary, tasks]) => { if (active) setData({ summary, tasks }) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar seu painel.') })
    return () => { active = false }
  }, [attempt])

  if (error) return <div className="space-y-3"><ErrorMessage message={error} /><Button onClick={() => { setError(''); setAttempt(value => value + 1) }}>Tentar novamente</Button></div>
  if (!data) return <LoadingState />
  const { summary, tasks } = data
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const name = user?.full_name.trim().split(/\s+/)[0]
  const todayTasks = tasks.filter(task => sameDay(task.due_at, now))
  const focus = todayTasks.find(task => !task.completed && task.priority === 'high') ?? todayTasks.find(task => !task.completed)
  const habits = summary.habits_today.length
  const done = summary.habits_today.filter(habit => habit.checked_in_today).length
  const todayEvents = summary.upcoming_events.filter(event => sameDay(event.starts_at, now))
  const events = todayEvents.length ? todayEvents : summary.upcoming_events
  const balances = new Map<string, number>()
  for (const account of summary.finance.accounts) {
    balances.set(account.currency, (balances.get(account.currency) ?? 0) + Number(account.balance))
  }

  return <div className="monolith-home">
    <div className="home-greeting">
      <h1>{greeting}{name ? `, ${name}` : ''}.</h1>
      <time>{day.format(now)}</time>
    </div>
    <SectionBanner section="dashboard" compact />
    <nav className="home-shortcuts" aria-label="Atalhos">
      {shortcuts.map(({ label, to, icon: Icon }) => <Link key={to} to={to}><Icon size={28} strokeWidth={1.75} /><span>{label}</span></Link>)}
    </nav>
    <div className="home-panels">
      <Panel title="Tarefas de hoje" to="/tasks" icon={ListTodo}>
        {todayTasks.length ? <ul className="home-task-list">{todayTasks.slice(0, 4).map(task =>
          <li key={task.id} className={task.completed ? 'is-done' : ''}>
            {task.completed ? <CheckSquare2 size={17} aria-label="Concluída" /> : <span className="home-task-box" aria-label="Em aberto" />}
            <span className="home-list-name">{task.title}</span>
          </li>)}</ul> : <p className="home-muted">Sem tarefas para hoje.</p>}
      </Panel>
      <Panel title="Hábitos" to="/habits" icon={Flame}>
        <div className="home-habit-ring" style={{ background: `conic-gradient(var(--mono-accent) ${habits ? done / habits * 100 : 0}%, #44464a 0)` }}>
          <div><strong>{done}/{habits}</strong><span>concluídos</span></div>
        </div>
      </Panel>
      <Panel title="Agenda" to="/calendar" icon={CalendarDays}>
        {events.length ? <><p className="home-muted">{todayEvents.length ? `${todayEvents.length} hoje` : 'Próximos'}</p>
          <ul className="home-event-list">{events.slice(0, 2).map(event =>
            <li key={event.id}><time>{event.all_day ? 'Dia todo' : todayEvents.length ? clock.format(new Date(event.starts_at)) : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(event.starts_at))}</time><span className="home-list-name">{event.title}</span></li>)}</ul></>
          : <p className="home-muted">Sem próximos compromissos.</p>}
      </Panel>
      <Panel title="Finanças" to="/finance" icon={Wallet}>
        {balances.size ? <><p className="home-muted">Saldo atual</p>
          {Array.from(balances, ([currency, value]) => <p key={currency} className="home-balance">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(value)}</p>)}</>
          : <p className="home-muted">Adicione uma conta.</p>}
      </Panel>
    </div>
    <Link to="/tasks" className="home-focus"><Target size={28} /><span><strong>Foco do dia</strong><small>{focus?.title ?? 'Veja suas próximas tarefas'}</small></span><ChevronRight size={17} /></Link>
  </div>
}
