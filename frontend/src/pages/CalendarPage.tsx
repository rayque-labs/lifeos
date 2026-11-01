import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Link2, Plus, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorMessage, Field, Input, LoadingState, PageHeading, Select, Textarea } from '../components/ui'
import { get, patch, post, remove } from '../lib/api'
import type { CalendarEvent, Task } from '../lib/types'

type View = 'month' | 'week'
type Draft = { title: string; description: string; startsAt: string; endsAt: string; allDay: boolean; taskId: string }
const emptyDraft: Draft = { title: '', description: '', startsAt: '', endsAt: '', allDay: false, taskId: '' }
const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
const dateTimeInput = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const mondayOf = (date: Date) => { const result = new Date(date.getFullYear(), date.getMonth(), date.getDate()); result.setDate(result.getDate() - (result.getDay() + 6) % 7); return result }
const addDays = (date: Date, days: number) => { const result = new Date(date); result.setDate(result.getDate() + days); return result }
const localLabel = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', options).format(new Date(value))

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<View>('month')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)

  const visibleStart = useMemo(() => view === 'week' ? mondayOf(cursor) : mondayOf(new Date(cursor.getFullYear(), cursor.getMonth(), 1)), [cursor, view])
  const visibleEnd = useMemo(() => view === 'week' ? addDays(visibleStart, 7) : addDays(visibleStart, 42), [visibleStart, view])
  const days = useMemo(() => Array.from({ length: view === 'week' ? 7 : 42 }, (_, index) => addDays(visibleStart, index)), [visibleStart, view])
  const load = useCallback(async () => {
    setLoading(true); setError('')
    const params = new URLSearchParams({ starts_after: visibleStart.toISOString(), starts_before: visibleEnd.toISOString() })
    try {
      const [nextEvents, nextTasks] = await Promise.all([get<CalendarEvent[]>(`/calendar/events/?${params}`), get<Task[]>('/tasks/?sort_by=due_at&sort_order=asc')])
      setEvents(nextEvents); setTasks(nextTasks)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o calendário.') }
    finally { setLoading(false) }
  }, [visibleStart, visibleEnd])
  useEffect(() => { void load() }, [load])

  const dayEvents = useMemo(() => {
    const result = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = dateKey(new Date(event.starts_at))
      result.set(key, [...(result.get(key) || []), event])
    }
    return result
  }, [events])
  const openNew = (day: Date) => {
    const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setDraft({ ...emptyDraft, startsAt: dateTimeInput(start.toISOString()), endsAt: dateTimeInput(end.toISOString()) })
    setEditing(null); setFormOpen(true)
  }
  const openEdit = (event: CalendarEvent) => {
    setEditing(event.id); setFormOpen(true)
    setDraft({ title: event.title, description: event.description || '', startsAt: dateTimeInput(event.starts_at), endsAt: dateTimeInput(event.ends_at), allDay: event.all_day, taskId: event.task_id ? String(event.task_id) : '' })
  }
  const cancel = () => { setFormOpen(false); setEditing(null); setDraft(emptyDraft) }
  const submit = async (formEvent: FormEvent) => {
    formEvent.preventDefault(); setBusy(true); setError('')
    const payload = { title: draft.title, description: draft.description || null, starts_at: new Date(draft.startsAt).toISOString(), ends_at: new Date(draft.endsAt).toISOString(), all_day: draft.allDay, task_id: draft.taskId ? Number(draft.taskId) : null }
    try { if (editing) await patch(`/calendar/events/${editing}`, payload); else await post('/calendar/events/', payload); cancel(); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o evento.') }
    finally { setBusy(false) }
  }
  const deleteEvent = async (event: CalendarEvent) => {
    if (!window.confirm(`Excluir o compromisso “${event.title}”?`)) return
    try { await remove(`/calendar/events/${event.id}`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o evento.') }
  }
  const shift = (delta: number) => setCursor(current => view === 'month' ? new Date(current.getFullYear(), current.getMonth() + delta, 1) : addDays(current, delta * 7))
  const headerLabel = view === 'month'
    ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor)
    : `${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(visibleStart)} – ${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(addDays(visibleEnd, -1))}`

  return <>
    <PageHeading title="Calendário" description="Compromissos e tarefas com horário, em uma agenda sua." action={<Button onClick={() => openNew(cursor)}><Plus size={16} />Novo evento</Button>} />
    {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
    {formOpen && <Card className="mb-5 !border-[#dce7d8]"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-[#30483a]">{editing ? 'Editar compromisso' : 'Novo compromisso'}</h2><p className="mt-1 text-xs text-[#859187]">Datas enviadas com o fuso horário do seu dispositivo.</p></div><button aria-label="Fechar" onClick={cancel} className="rounded-lg p-1.5 text-[#859187] hover:bg-[#f0f3ee]"><X size={18} /></button></div>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><Field label="Título"><Input autoFocus required maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Consulta médica" /></Field><Field label="Vincular tarefa"><Select value={draft.taskId} onChange={event => setDraft({ ...draft, taskId: event.target.value })}><option value="">Sem tarefa vinculada</option>{tasks.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</Select></Field><Field label="Começa em"><Input type="datetime-local" required value={draft.startsAt} onChange={event => setDraft({ ...draft, startsAt: event.target.value })} /></Field><Field label="Termina em"><Input type="datetime-local" required value={draft.endsAt} onChange={event => setDraft({ ...draft, endsAt: event.target.value })} /></Field><div className="md:col-span-2"><Field label="Descrição"><Textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Detalhes do compromisso…" /></Field></div><label className="flex items-center gap-2 text-sm text-[#66766b]"><input type="checkbox" className="h-4 w-4 accent-[#527653]" checked={draft.allDay} onChange={event => setDraft({ ...draft, allDay: event.target.checked })} />Evento de dia inteiro</label><div className="flex gap-2 md:col-span-2"><Button type="submit" busy={busy}>{editing ? 'Salvar alterações' : 'Criar compromisso'}</Button><Button type="button" variant="secondary" onClick={cancel}>Cancelar</Button></div></form>
    </Card>}
    <Card className="!p-4 sm:!p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf0e7] text-[#648063]"><CalendarDays size={18} /></span><div><h2 className="font-semibold capitalize text-[#30483a]">{headerLabel}</h2><p className="text-[11px] text-[#96a198]">{events.length} compromisso(s) neste período</p></div></div><div className="flex items-center gap-1"><Button variant="ghost" className="!px-2.5" aria-label="Período anterior" onClick={() => shift(-1)}><ChevronLeft size={17} /></Button><Button variant="secondary" className="!px-3" onClick={() => setCursor(new Date())}>Hoje</Button><Button variant="ghost" className="!px-2.5" aria-label="Próximo período" onClick={() => shift(1)}><ChevronRight size={17} /></Button><div className="ml-2 flex rounded-xl bg-[#eff2ed] p-1"><button onClick={() => setView('month')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'month' ? 'bg-white text-[#3d5845] shadow-sm' : 'text-[#819087]'}`}>Mês</button><button onClick={() => setView('week')} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${view === 'week' ? 'bg-white text-[#3d5845] shadow-sm' : 'text-[#819087]'}`}>Semana</button></div></div></div>
      <div className="calendar-scroll overflow-x-auto"><div className="min-w-[680px]"><div className="calendar-grid border-b border-[#edf0eb]">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => <div key={day} className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-[.13em] text-[#9aa59c]">{day}</div>)}</div>
        {loading ? <LoadingState /> : <div className="calendar-grid">{days.map(day => { const key = dateKey(day); const items = dayEvents.get(key) || []; const sameMonth = day.getMonth() === cursor.getMonth(); const isToday = key === dateKey(new Date()); return <div key={key} className={`group min-h-28 border-b border-r border-[#edf0eb] p-1.5 sm:min-h-32 ${!sameMonth && view === 'month' ? 'bg-[#fafbf9]' : 'bg-white'}`}>
          <div className="mb-1 flex items-center justify-between"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${isToday ? 'bg-[#244535] font-bold text-white' : sameMonth || view === 'week' ? 'text-[#5d7062]' : 'text-[#b8c0b8]'}`}>{day.getDate()}</span><button aria-label={`Criar evento em ${key}`} title="Criar evento" onClick={() => openNew(day)} className="rounded-md p-1 text-[#a5b0a6] opacity-0 hover:bg-[#eef3eb] hover:text-[#557950] group-hover:opacity-100 focus:opacity-100"><Plus size={13} /></button></div>
          <div className="space-y-1">{items.slice(0, view === 'week' ? 8 : 3).map(event => <button key={event.id} title={`${event.title} · ${localLabel(event.starts_at, { timeStyle: 'short' })}`} onClick={() => openEdit(event)} className="block w-full truncate rounded-md bg-[#e9f2e5] px-1.5 py-1 text-left text-[10px] font-semibold text-[#456345] hover:bg-[#dcebd5]">{event.all_day ? '' : `${localLabel(event.starts_at, { timeStyle: 'short' })} `}{event.title}</button>)}{items.length > (view === 'week' ? 8 : 3) && <span className="block px-1 text-[10px] text-[#86938a]">+{items.length - (view === 'week' ? 8 : 3)} mais</span>}</div>
        </div>})}</div>}</div></div>
      {events.length > 0 && <div className="mt-5 border-t border-[#edf0eb] pt-4"><p className="mb-2 text-xs font-semibold text-[#65766a]">Eventos neste período</p><div className="space-y-2">{events.slice(0, 8).map(event => <div key={event.id} className="flex items-center gap-3 rounded-xl bg-[#f8f9f6] px-3 py-2.5"><span className="h-2 w-2 rounded-full bg-[#84ad69]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#40564a]">{event.title}</p><p className="mt-0.5 text-[11px] text-[#8c9990]">{localLabel(event.starts_at, { dateStyle: 'medium', timeStyle: 'short' })} – {localLabel(event.ends_at, { timeStyle: 'short' })}</p></div>{event.task_id && <Badge tone="blue"><span className="inline-flex items-center gap-1"><Link2 size={10} />Tarefa</span></Badge>}<button onClick={() => void deleteEvent(event)} aria-label={`Excluir ${event.title}`} className="rounded-lg p-2 text-[#a0aaa2] hover:bg-[#fff0ed] hover:text-[#a34d3f]"><Trash2 size={15} /></button></div>)}</div></div>}
      {!loading && events.length === 0 && <div className="mt-4"><EmptyState title="Nenhum compromisso neste período" description="Use o botão + em um dia ou crie um evento para começar sua agenda." /></div>}
    </Card>
  </>
}
