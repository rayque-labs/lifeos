import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, CheckCircle2, CircleAlert, CircleDollarSign, FolderKanban, ListTodo, RefreshCw, Sparkles } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorMessage, LoadingState, PageHeading } from '../components/ui'
import { get } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Dashboard } from '../lib/types'

const money = (value: string, currency: string) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(Number(value))
const dateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function DashboardPage() {
  const { user } = useAuth()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try { setData(await get<Dashboard>('/dashboard/')) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar seu painel.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  if (loading && !data) return <LoadingState />
  if (error && !data) return <ErrorMessage message={error} />
  if (!data) return null
  const firstName = user?.full_name.split(' ')[0] || 'aí'
  const metrics = [
    { label: 'Tarefas abertas', value: data.tasks.pending + data.tasks.in_progress, detail: `${data.tasks.completed} concluídas`, icon: ListTodo, tone: 'bg-[#e9f3df] text-[#577a43]' },
    { label: 'Em atraso', value: data.tasks.overdue, detail: `${data.tasks.due_today} para hoje`, icon: CircleAlert, tone: 'bg-[#fff0e9] text-[#b36849]' },
    { label: 'Projetos ativos', value: data.projects.active, detail: `${data.projects.average_progress}% de progresso médio`, icon: FolderKanban, tone: 'bg-[#e8eff1] text-[#537b82]' },
    { label: 'Hábitos hoje', value: `${data.habits_today.filter(habit => habit.checked_in_today).length}/${data.habits_today.length}`, detail: 'registros de hoje', icon: Sparkles, tone: 'bg-[#f2ecfa] text-[#8565a1]' },
  ]

  return <>
    <PageHeading title={`Bom dia, ${firstName}`} description="Um retrato simples do que está acontecendo na sua vida hoje." action={<Button variant="secondary" onClick={() => void load()}><RefreshCw size={15} />Atualizar</Button>} />
    {error && <div className="mb-5"><ErrorMessage message={error} /></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(({ label, value, detail, icon: Icon, tone }) => <Card key={label} className="!p-4 sm:!p-5"><div className="flex items-start justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={18} /></span><span className="rounded-full bg-[#f6f7f4] px-2 py-1 text-[10px] font-semibold text-[#9aa49c]">HOJE</span></div><p className="mt-4 text-[13px] font-medium text-[#7e8b81]">{label}</p><p className="mt-1 text-3xl font-semibold tracking-tight text-[#24382d]">{value}</p><p className="mt-1 text-xs text-[#9aa49c]">{detail}</p></Card>)}
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card>
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-[#2c4235]">Ritmo dos projetos</h2><p className="mt-1 text-xs text-[#8b9990]">Progresso calculado a partir das tarefas vinculadas.</p></div><Link to="/projects" className="inline-flex items-center gap-1 text-xs font-semibold text-[#567952]">Ver projetos <ArrowRight size={14} /></Link></div>
        {data.projects.active === 0 ? <div className="mt-5"><EmptyState title="Nenhum projeto ativo" description="Crie um projeto para acompanhar objetivos e tarefas relacionadas." /><Link to="/projects" className="mt-3 inline-block text-sm font-semibold text-[#456b4b]">Criar projeto</Link></div> : <div className="mt-5 space-y-4"><div className="flex justify-between text-sm"><span className="text-[#78867c]">Progresso médio</span><span className="font-semibold text-[#355941]">{data.projects.average_progress}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-[#edf1eb]"><div className="h-full rounded-full bg-[#86b764] transition-all" style={{ width: `${data.projects.average_progress}%` }} /></div><p className="text-xs text-[#9aa49c]">{data.projects.active} projeto(s) ativo(s)</p></div>}
      </Card>
      <Card>
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-[#2c4235]">Hábitos de hoje</h2><p className="mt-1 text-xs text-[#8b9990]">Um registro já conta como progresso.</p></div><Link to="/habits" className="inline-flex items-center gap-1 text-xs font-semibold text-[#567952]">Ver hábitos <ArrowRight size={14} /></Link></div>
        {data.habits_today.length === 0 ? <div className="mt-5"><EmptyState title="Sua rotina começa aqui" description="Cadastre um hábito para acompanhar sua consistência." /></div> : <div className="mt-4 divide-y divide-[#eef1ec]">{data.habits_today.slice(0, 5).map(habit => <div key={habit.id} className="flex items-center gap-3 py-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${habit.checked_in_today ? 'bg-[#e6f1dc] text-[#648e4b]' : 'bg-[#f1f3ef] text-[#a0aaa2]'}`}><CheckCircle2 size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#40564a]">{habit.name}</p><p className="text-[11px] text-[#929e95]">Sequência atual: {habit.current_streak} {habit.frequency === 'daily' ? 'dia(s)' : 'semana(s)'}</p></div><Badge tone={habit.checked_in_today ? 'green' : 'neutral'}>{habit.checked_in_today ? 'Feito' : 'Pendente'}</Badge></div>)}</div>}
      </Card>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-2">
      <Card>
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-[#2c4235]">Próximos compromissos</h2><p className="mt-1 text-xs text-[#8b9990]">Os próximos sete dias.</p></div><Link to="/calendar" className="inline-flex items-center gap-1 text-xs font-semibold text-[#567952]">Abrir calendário <ArrowRight size={14} /></Link></div>
        {data.upcoming_events.length === 0 ? <div className="mt-5"><EmptyState title="Agenda livre por enquanto" description="Seus próximos eventos aparecerão aqui." /></div> : <div className="mt-3 divide-y divide-[#eef1ec]">{data.upcoming_events.slice(0, 4).map(event => <div key={event.id} className="flex gap-3 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf2ee] text-[#63806b]"><CalendarClock size={17} /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-[#40564a]">{event.title}</p><p className="mt-0.5 text-xs text-[#929e95]">{dateTime(event.starts_at)}</p></div></div>)}</div>}
      </Card>
      <Card>
        <div className="flex items-center justify-between"><div><h2 className="font-semibold text-[#2c4235]">Resumo financeiro</h2><p className="mt-1 text-xs text-[#8b9990]">Este mês, separado por moeda.</p></div><Link to="/finance" className="inline-flex items-center gap-1 text-xs font-semibold text-[#567952]">Ver finanças <ArrowRight size={14} /></Link></div>
        {data.finance.monthly.currencies.length === 0 && data.finance.accounts.length === 0 ? <div className="mt-5"><EmptyState title="Sem contas financeiras" description="Adicione uma conta para acompanhar saldos e transações." /></div> : <div className="mt-4 space-y-3">{data.finance.monthly.currencies.map(currency => <div key={currency.currency} className="rounded-xl bg-[#f7f8f5] p-3.5"><div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-semibold text-[#43584a]"><CircleDollarSign size={16} />{currency.currency}</span><span className={`text-sm font-semibold ${Number(currency.net) >= 0 ? 'text-[#5c8150]' : 'text-[#b25f4b]'}`}>{money(currency.net, currency.currency)}</span></div><div className="mt-2 flex gap-5 text-xs text-[#849187]"><span className="inline-flex items-center gap-1"><ArrowUpRight size={13} className="text-[#70a65e]" />{money(currency.income, currency.currency)}</span><span className="inline-flex items-center gap-1"><ArrowDownRight size={13} className="text-[#c37b62]" />{money(currency.expenses, currency.currency)}</span></div></div>)}</div>}
      </Card>
    </div>
  </>
}
