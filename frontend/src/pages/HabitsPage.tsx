import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Activity, CalendarCheck2, Check, Flame, History, Pencil, Plus, Sparkles, Target, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorMessage, Field, Input, LoadingState, PageHeading, Select, Textarea } from '../components/ui'
import { get, patch, post, remove } from '../lib/api'
import type { Habit } from '../lib/types'

type Draft = { name: string; description: string; frequency: 'daily' | 'weekly'; target: number }
type Log = { id: number; logged_on: string; note: string | null }
const blank: Draft = { name: '', description: '', frequency: 'daily', target: 7 }
const utcToday = () => new Date().toISOString().slice(0, 10)

export function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [historyFor, setHistoryFor] = useState<number | null>(null)
  const [history, setHistory] = useState<Log[]>([])
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setHabits(await get<Habit[]>(`/habits/${includeInactive ? '' : '?active=true'}`)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os hábitos.') }
    finally { setLoading(false) }
  }, [includeInactive])
  useEffect(() => { void load() }, [load])
  const cancel = () => { setDraft(blank); setEditing(null); setFormOpen(false) }
  const edit = (habit: Habit) => { setEditing(habit.id); setDraft({ name: habit.name, description: habit.description || '', frequency: habit.frequency, target: habit.target_per_week }); setFormOpen(true) }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const payload = { name: draft.name, description: draft.description || null, frequency: draft.frequency, target_per_week: draft.frequency === 'daily' ? 7 : draft.target }
      if (editing) await patch(`/habits/${editing}`, payload)
      else await post('/habits/', payload)
      cancel(); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o hábito.') }
    finally { setBusy(false) }
  }
  const checkIn = async (habit: Habit) => {
    try { await post(`/habits/${habit.id}/logs`, { logged_on: utcToday() }); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível registrar o hábito.') }
  }
  const toggleActive = async (habit: Habit) => {
    try { await patch(`/habits/${habit.id}`, { active: !habit.active }); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o hábito.') }
  }
  const showHistory = async (habit: Habit) => {
    if (historyFor === habit.id) { setHistoryFor(null); return }
    try { setHistory(await get<Log[]>(`/habits/${habit.id}/logs?from_date=${utcToday().slice(0, 7)}-01`)); setHistoryFor(habit.id) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o histórico.') }
  }
  const deleteHabit = async (habit: Habit) => {
    if (!window.confirm(`Excluir “${habit.name}” e todo o seu histórico?`)) return
    try { await remove(`/habits/${habit.id}`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o hábito.') }
  }

  return <>
    <PageHeading title="Hábitos" description="Construa consistência com pequenos registros ao longo do tempo." action={<Button onClick={() => { setDraft(blank); setEditing(null); setFormOpen(true) }}><Plus size={16} />Novo hábito</Button>} />
    {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
    {formOpen && <Card className="mb-5 !border-[#dce7d8]"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-[#30483a]">{editing ? 'Editar hábito' : 'Criar hábito'}</h2><p className="mt-1 text-xs text-[#859187]">A sequência e a consistência são calculadas a partir dos registros.</p></div><button aria-label="Fechar" onClick={cancel} className="rounded-lg p-1.5 text-[#859187] hover:bg-[#f0f3ee]"><X size={18} /></button></div>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><Field label="Nome"><Input required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Caminhar" /></Field><Field label="Frequência"><Select value={draft.frequency} onChange={event => setDraft({ ...draft, frequency: event.target.value as Draft['frequency'], target: event.target.value === 'daily' ? 7 : 1 })}><option value="daily">Todos os dias</option><option value="weekly">Meta semanal</option></Select></Field>{draft.frequency === 'weekly' && <Field label="Meta por semana"><Select value={draft.target} onChange={event => setDraft({ ...draft, target: Number(event.target.value) })}>{[1, 2, 3, 4, 5, 6, 7].map(value => <option key={value} value={value}>{value} {value === 1 ? 'vez' : 'vezes'} por semana</option>)}</Select></Field>}<div className="md:col-span-2"><Field label="Descrição"><Textarea maxLength={500} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Uma nota para lembrar por que isso importa…" /></Field></div><div className="flex gap-2 md:col-span-2"><Button type="submit" busy={busy}>{editing ? 'Salvar alterações' : 'Criar hábito'}</Button><Button type="button" variant="secondary" onClick={cancel}>Cancelar</Button></div></form>
    </Card>}
    <Card className="mb-4 !p-4"><label className="flex items-center gap-2.5 text-sm text-[#69796e]"><input type="checkbox" className="h-4 w-4 accent-[#527653]" checked={includeInactive} onChange={event => setIncludeInactive(event.target.checked)} />Incluir hábitos pausados</label></Card>
    {loading ? <LoadingState /> : habits.length === 0 ? <EmptyState title="Sua rotina começa com um hábito" description="Escolha uma prática pequena e registre cada vez que você a realiza." /> : <div className="grid gap-4 lg:grid-cols-2">{habits.map(habit => <Card key={habit.id} className={`!p-5 ${!habit.active ? 'opacity-70' : ''}`}><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0ebf7] text-[#8568a1]"><Sparkles size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[#30483a]">{habit.name}</h2>{!habit.active && <Badge>Pausado</Badge>}</div><p className="mt-1 text-xs text-[#859187]">{habit.frequency === 'daily' ? 'Todos os dias' : `${habit.target_per_week} vezes por semana`}{habit.description ? ` · ${habit.description}` : ''}</p></div><div className="flex gap-1"><button aria-label={`Editar ${habit.name}`} onClick={() => edit(habit)} className="rounded-lg p-2 text-[#87948a] hover:bg-[#f0f3ee]"><Pencil size={15} /></button><button aria-label={`Excluir ${habit.name}`} onClick={() => void deleteHabit(habit)} className="rounded-lg p-2 text-[#a4aaa5] hover:bg-[#fff0ed] hover:text-[#a34d3f]"><Trash2 size={15} /></button></div></div>
      <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#f7f8f5] p-3"><span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#909c92]"><Flame size={12} />Sequência</span><p className="mt-1 text-xl font-semibold text-[#405e43]">{habit.current_streak}<span className="ml-1 text-xs font-normal text-[#8b9990]">{habit.frequency === 'daily' ? 'dias' : 'sem.'}</span></p></div><div className="rounded-xl bg-[#f7f8f5] p-3"><span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#909c92]"><Activity size={12} />Consistência</span><p className="mt-1 text-xl font-semibold text-[#405e43]">{habit.consistency_percentage}<span className="ml-0.5 text-xs font-normal">%</span></p></div><div className="rounded-xl bg-[#f7f8f5] p-3"><span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#909c92]"><Target size={12} />30 dias</span><p className="mt-1 text-xl font-semibold text-[#405e43]">{habit.log_count_30_days}<span className="ml-1 text-xs font-normal text-[#8b9990]">registros</span></p></div></div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#eff1ed] pt-4"><Button variant={habit.checked_in_today ? 'secondary' : 'primary'} disabled={!habit.active || habit.checked_in_today} onClick={() => void checkIn(habit)}>{habit.checked_in_today ? <><Check size={15} />Registrado hoje</> : <><CalendarCheck2 size={15} />Registrar hoje</>}</Button><div className="flex gap-2"><Button variant="ghost" onClick={() => void showHistory(habit)}><History size={15} />{historyFor === habit.id ? 'Fechar histórico' : 'Histórico'}</Button><Button variant="ghost" onClick={() => void toggleActive(habit)}>{habit.active ? 'Pausar' : 'Retomar'}</Button></div></div>
      {historyFor === habit.id && <div className="mt-4 rounded-xl bg-[#f7f8f5] p-3"><p className="mb-2 text-xs font-semibold text-[#5e7063]">Registros deste mês</p>{history.length ? <div className="flex flex-wrap gap-2">{history.map(log => <Badge key={log.id} tone="green">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${log.logged_on}T12:00:00`))}</Badge>)}</div> : <p className="text-xs text-[#919e94]">Nenhum registro neste período.</p>}</div>}
    </Card>)}</div>}
  </>
}
