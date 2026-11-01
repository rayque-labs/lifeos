import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { CalendarClock, Check, Circle, Clock3, ListFilter, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorMessage, Field, Input, LoadingState, PageHeading, Select, Textarea } from '../components/ui'
import { get, patch, post, remove } from '../lib/api'
import type { Task } from '../lib/types'

const priorityTone = { high: 'red', medium: 'amber', low: 'green' } as const
const statusLabel = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída' } as const
const localDate = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : null
const localInput = (value: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''

type Draft = { title: string; description: string; priority: Task['priority']; category: string; dueAt: string; recurrence: Task['recurrence_rule'] }
const blankDraft: Draft = { title: '', description: '', priority: 'medium', category: '', dueAt: '', recurrence: 'none' }

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(blankDraft)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (status) params.set('status', status)
      setTasks(await get<Task[]>(`/tasks/?${params}`))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as tarefas.') }
    finally { setLoading(false) }
  }, [query, status])
  useEffect(() => { void load() }, [load])

  const beginEdit = (task: Task) => {
    setEditing(task.id); setFormOpen(true)
    setDraft({ title: task.title, description: task.description || '', priority: task.priority, category: task.category || '', dueAt: localInput(task.due_at), recurrence: task.recurrence_rule })
  }
  const cancel = () => { setEditing(null); setDraft(blankDraft); setFormOpen(false) }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true)
    const payload = { title: draft.title, description: draft.description || null, priority: draft.priority,
      category: draft.category || null, due_at: draft.dueAt ? new Date(draft.dueAt).toISOString() : null,
      recurrence_rule: draft.recurrence }
    try {
      if (editing) await patch(`/tasks/${editing}`, payload)
      else await post('/tasks/', payload)
      cancel(); await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a tarefa.') }
    finally { setBusy(false) }
  }
  const changeStatus = async (task: Task) => {
    const next = task.status === 'completed' ? 'pending' : 'completed'
    try { await patch(`/tasks/${task.id}`, { status: next }); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o status.') }
  }
  const deleteTask = async (task: Task) => {
    if (!window.confirm(`Excluir “${task.title}”?`)) return
    try { await remove(`/tasks/${task.id}`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a tarefa.') }
  }

  const pending = tasks.filter(task => task.status !== 'completed').length
  return <>
    <PageHeading title="Tarefas" description={`${pending} tarefa(s) em aberto nesta visualização.`} action={<Button onClick={() => { setDraft(blankDraft); setEditing(null); setFormOpen(value => !value) }}><Plus size={16} />Nova tarefa</Button>} />
    {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
    {formOpen && <Card className="mb-5 !border-[#dce7d8]">
      <div className="mb-4 flex items-start justify-between"><div><h2 className="font-semibold text-[#30483a]">{editing ? 'Editar tarefa' : 'Nova tarefa'}</h2><p className="mt-1 text-xs text-[#859187]">Defina o próximo passo e, se fizer sentido, um prazo.</p></div><button onClick={cancel} aria-label="Fechar" className="rounded-lg p-1.5 text-[#859187] hover:bg-[#f0f3ee]"><X size={18} /></button></div>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <Field label="Título"><Input autoFocus required maxLength={150} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Preparar a apresentação" /></Field>
        <Field label="Categoria"><Input maxLength={80} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} placeholder="Trabalho, casa…" /></Field>
        <Field label="Prioridade"><Select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value as Draft['priority'] })}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></Select></Field>
        <Field label="Prazo"><Input type="datetime-local" value={draft.dueAt} onChange={event => setDraft({ ...draft, dueAt: event.target.value })} /></Field>
        <Field label="Recorrência" hint="Para repetir, informe também um prazo."><Select value={draft.recurrence} onChange={event => setDraft({ ...draft, recurrence: event.target.value as Draft['recurrence'] })}><option value="none">Não se repete</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></Select></Field>
        <div className="md:col-span-2"><Field label="Descrição"><Textarea maxLength={10000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Detalhes que ajudam a começar…" /></Field></div>
        <div className="flex gap-2 md:col-span-2"><Button type="submit" busy={busy}>{editing ? 'Salvar alterações' : 'Criar tarefa'}</Button><Button type="button" variant="secondary" onClick={cancel}>Cancelar</Button></div>
      </form>
    </Card>}
    <Card className="!p-4 sm:!p-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99a59c]" /><Input aria-label="Buscar tarefas" className="pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por título ou descrição" /></label>
        <label className="relative"><ListFilter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#849187]" /><Select aria-label="Filtrar por status" className="min-w-44 pl-9" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos os status</option><option value="pending">Pendentes</option><option value="in_progress">Em andamento</option><option value="completed">Concluídas</option></Select></label>
      </div>
    </Card>
    {loading ? <LoadingState /> : tasks.length === 0 ? <div className="mt-5"><EmptyState title={query || status ? 'Nenhuma tarefa encontrada' : 'Sua lista começa aqui'} description={query || status ? 'Ajuste os filtros ou tente outro termo.' : 'Crie uma tarefa para transformar uma intenção em próximo passo.'} /></div> : <div className="mt-4 space-y-2.5">
      {tasks.map(task => <Card key={task.id} className={`!p-4 transition ${task.completed ? 'opacity-75' : ''}`}><div className="flex items-start gap-3">
        <button aria-label={task.completed ? `Reabrir ${task.title}` : `Concluir ${task.title}`} title={task.completed ? 'Reabrir tarefa' : 'Concluir tarefa'} onClick={() => void changeStatus(task)} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${task.completed ? 'border-[#7da866] bg-[#7da866] text-white' : 'border-[#cbd6cb] text-transparent hover:border-[#729866] hover:text-[#729866]'}`}>{task.completed ? <Check size={14} /> : <Circle size={15} />}</button>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={`text-sm font-semibold ${task.completed ? 'text-[#88938b] line-through' : 'text-[#344a3c]'}`}>{task.title}</h3><Badge tone={priorityTone[task.priority]}>{task.priority === 'high' ? 'Alta' : task.priority === 'low' ? 'Baixa' : 'Média'}</Badge>{task.status === 'in_progress' && <Badge tone="blue">Em andamento</Badge>}{task.category && <Badge>{task.category}</Badge>}{task.recurrence_rule !== 'none' && <Badge tone="blue"><span className="inline-flex items-center gap-1"><RotateCcw size={11} />{task.recurrence_rule}</span></Badge>}</div>
          {task.description && <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[#7e8b81]">{task.description}</p>}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#929e95]">{task.due_at && <span className="inline-flex items-center gap-1"><CalendarClock size={13} />{localDate(task.due_at)}</span>}<span className="inline-flex items-center gap-1"><Clock3 size={13} />{statusLabel[task.status]}</span></div>
        </div>
        <div className="flex shrink-0 gap-1"><button onClick={() => beginEdit(task)} aria-label={`Editar ${task.title}`} title="Editar" className="rounded-lg p-2 text-[#8a988e] hover:bg-[#eff3ed] hover:text-[#456b4b]"><Pencil size={15} /></button><button onClick={() => void deleteTask(task)} aria-label={`Excluir ${task.title}`} title="Excluir" className="rounded-lg p-2 text-[#a4aaa5] hover:bg-[#fff0ed] hover:text-[#a34d3f]"><Trash2 size={15} /></button></div>
      </div></Card>)}
    </div>}
  </>
}
