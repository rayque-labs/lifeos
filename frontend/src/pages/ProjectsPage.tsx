import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, CalendarDays, FolderKanban, Pencil, Plus, Trash2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, ErrorMessage, Field, Input, LoadingState, PageHeading, Select, Textarea } from '../components/ui'
import { get, patch, post, remove } from '../lib/api'
import type { Project } from '../lib/types'

type Draft = { title: string; description: string; objective: string; deadline: string; status: string; priority: string }
const blank: Draft = { title: '', description: '', objective: '', deadline: '', status: 'active', priority: 'medium' }

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setProjects(await get<Project[]>('/projects/')) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os projetos.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])
  const cancel = () => { setEditing(null); setFormOpen(false); setDraft(blank) }
  const edit = (project: Project) => {
    setEditing(project.id); setFormOpen(true)
    setDraft({ title: project.title, description: project.description || '', objective: project.objective || '', deadline: project.deadline || '', status: project.status, priority: project.priority })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    const payload = { ...draft, description: draft.description || null, objective: draft.objective || null, deadline: draft.deadline || null }
    try { if (editing) await patch(`/projects/${editing}`, payload); else await post('/projects/', payload); cancel(); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar o projeto.') }
    finally { setBusy(false) }
  }
  const deleteProject = async (project: Project) => {
    if (!window.confirm(`Excluir o projeto “${project.title}”? As tarefas serão mantidas sem projeto.`)) return
    try { await remove(`/projects/${project.id}`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o projeto.') }
  }

  return <>
    <PageHeading title="Projetos" description="Conecte tarefas a objetivos que levam mais de um passo." action={<Button onClick={() => { setDraft(blank); setEditing(null); setFormOpen(true) }}><Plus size={16} />Novo projeto</Button>} />
    {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
    {formOpen && <Card className="mb-5 !border-[#dce7d8]"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-[#30483a]">{editing ? 'Editar projeto' : 'Novo projeto'}</h2><p className="mt-1 text-xs text-[#859187]">O progresso será calculado pelas tarefas vinculadas.</p></div><button aria-label="Fechar" onClick={cancel} className="rounded-lg p-1.5 text-[#859187] hover:bg-[#f0f3ee]"><X size={18} /></button></div>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><Field label="Nome"><Input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} required maxLength={150} placeholder="Ex.: Reforma da cozinha" /></Field><Field label="Objetivo"><Input value={draft.objective} onChange={event => setDraft({ ...draft, objective: event.target.value })} maxLength={500} placeholder="O que significa concluir este projeto?" /></Field><Field label="Prazo"><Input type="date" value={draft.deadline} onChange={event => setDraft({ ...draft, deadline: event.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Prioridade"><Select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })}><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option></Select></Field><Field label="Status"><Select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}><option value="active">Ativo</option><option value="paused">Pausado</option><option value="completed">Concluído</option><option value="archived">Arquivado</option></Select></Field></div><div className="md:col-span-2"><Field label="Descrição"><Textarea value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} placeholder="Contexto e escopo do projeto…" /></Field></div><div className="flex gap-2 md:col-span-2"><Button type="submit" busy={busy}>{editing ? 'Salvar alterações' : 'Criar projeto'}</Button><Button type="button" variant="secondary" onClick={cancel}>Cancelar</Button></div></form>
    </Card>}
    {loading ? <LoadingState /> : projects.length === 0 ? <EmptyState title="Nenhum projeto por enquanto" description="Agrupe tarefas relacionadas e acompanhe seu progresso em um só lugar." /> : <div className="grid gap-4 lg:grid-cols-2">{projects.map(project => <Card key={project.id} className="flex flex-col !p-5 sm:!p-6"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf0e7] text-[#648063]"><FolderKanban size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[#30483a]">{project.title}</h2><Badge tone={project.status === 'active' ? 'green' : project.status === 'completed' ? 'blue' : 'neutral'}>{project.status === 'active' ? 'Ativo' : project.status === 'completed' ? 'Concluído' : project.status === 'paused' ? 'Pausado' : 'Arquivado'}</Badge></div><p className="mt-1 text-xs text-[#849187]">{project.objective || project.description || 'Objetivo ainda não definido.'}</p></div><div className="flex shrink-0 gap-1"><button aria-label={`Editar ${project.title}`} onClick={() => edit(project)} className="rounded-lg p-2 text-[#87948a] hover:bg-[#f0f3ee]"><Pencil size={15} /></button><button aria-label={`Excluir ${project.title}`} onClick={() => void deleteProject(project)} className="rounded-lg p-2 text-[#a4aaa5] hover:bg-[#fff0ed] hover:text-[#a34d3f]"><Trash2 size={15} /></button></div></div>
      <div className="mt-6 flex items-end justify-between"><div><span className="text-2xl font-semibold text-[#355941]">{project.progress}%</span><span className="ml-2 text-xs text-[#8c9990]">concluído</span></div><span className="text-xs text-[#8c9990]">{project.completed_tasks} de {project.total_tasks} tarefas</span></div><div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#edf1eb]"><div className="h-full rounded-full bg-[#8ab56b] transition-all" style={{ width: `${project.progress}%` }} /></div>
      <div className="mt-5 flex items-center justify-between border-t border-[#eff1ed] pt-4">{project.deadline ? <span className="inline-flex items-center gap-1.5 text-xs text-[#87948a]"><CalendarDays size={14} />Prazo {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${project.deadline}T12:00:00`))}</span> : <span className="text-xs text-[#a2aaa3]">Sem prazo definido</span>}<Link to={`/tasks?project_id=${project.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#547850]">Ver tarefas <ArrowUpRight size={14} /></Link></div>
    </Card>)}</div>}
  </>
}
