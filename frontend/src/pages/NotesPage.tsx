import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Bookmark, FileText, Pencil, Pin, PinOff, Plus, Search, Tag, Trash2, X } from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorMessage, Field, Input, LoadingState, PageHeading, Textarea } from '../components/ui'
import { get, patch, post, remove } from '../lib/api'
import type { Note } from '../lib/types'

type Draft = { title: string; content: string; category: string; tags: string }
const blank: Draft = { title: '', content: '', category: '', tags: '' }

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(blank)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { const params = new URLSearchParams(); if (query.trim()) params.set('q', query.trim()); setNotes(await get<Note[]>(`/notes/?${params}`)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as notas.') }
    finally { setLoading(false) }
  }, [query])
  useEffect(() => { void load() }, [load])
  const cancel = () => { setDraft(blank); setEditing(null); setFormOpen(false) }
  const edit = (note: Note) => { setEditing(note.id); setDraft({ title: note.title, content: note.content, category: note.category || '', tags: note.tags.join(', ') }); setFormOpen(true) }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    const payload = { title: draft.title, content: draft.content, category: draft.category || null, tags: draft.tags.split(',').map(tag => tag.trim()).filter(Boolean) }
    try { if (editing) await patch(`/notes/${editing}`, payload); else await post('/notes/', payload); cancel(); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a nota.') }
    finally { setBusy(false) }
  }
  const togglePinned = async (note: Note) => {
    try { await patch(`/notes/${note.id}`, { pinned: !note.pinned }); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível fixar a nota.') }
  }
  const deleteNote = async (note: Note) => {
    if (!window.confirm(`Excluir a nota “${note.title}”?`)) return
    try { await remove(`/notes/${note.id}`); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a nota.') }
  }

  return <>
    <PageHeading title="Notas" description="Ideias, referências e lembretes em um espaço pesquisável." action={<Button onClick={() => { setDraft(blank); setEditing(null); setFormOpen(true) }}><Plus size={16} />Nova nota</Button>} />
    {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
    {formOpen && <Card className="mb-5 !border-[#dce7d8]"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-[#30483a]">{editing ? 'Editar nota' : 'Nova nota'}</h2><p className="mt-1 text-xs text-[#859187]">Suas notas são visíveis apenas na sua conta.</p></div><button aria-label="Fechar" onClick={cancel} className="rounded-lg p-1.5 text-[#859187] hover:bg-[#f0f3ee]"><X size={18} /></button></div>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2"><Field label="Título"><Input autoFocus required maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="Um título fácil de encontrar" /></Field><Field label="Categoria"><Input maxLength={80} value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} placeholder="Pessoal, trabalho…" /></Field><div className="md:col-span-2"><Field label="Conteúdo"><Textarea required maxLength={100000} rows={7} value={draft.content} onChange={event => setDraft({ ...draft, content: event.target.value })} placeholder="Escreva livremente…" /></Field></div><Field label="Tags" hint="Separe as tags por vírgula."><Input value={draft.tags} onChange={event => setDraft({ ...draft, tags: event.target.value })} placeholder="ideia, leitura, projeto" /></Field><div className="flex items-end gap-2"><Button type="submit" busy={busy}>{editing ? 'Salvar alterações' : 'Salvar nota'}</Button><Button type="button" variant="secondary" onClick={cancel}>Cancelar</Button></div></form>
    </Card>}
    <Card className="mb-4 !p-4"><label className="relative block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99a59c]" /><Input aria-label="Buscar notas" className="pl-9" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar no título ou conteúdo" /></label></Card>
    {loading ? <LoadingState /> : notes.length === 0 ? <EmptyState title={query ? 'Nenhuma nota encontrada' : 'Seu espaço de ideias está vazio'} description={query ? 'Tente outro termo de busca.' : 'Crie uma nota para guardar algo que queira lembrar.'} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{notes.map(note => <Card key={note.id} className="flex min-h-64 flex-col !p-5"><div className="flex items-start gap-3"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${note.pinned ? 'bg-[#f5efdc] text-[#a28436]' : 'bg-[#edf1ec] text-[#6e8573]'}`}>{note.pinned ? <Bookmark size={17} /> : <FileText size={17} />}</span><div className="min-w-0 flex-1"><h2 className="line-clamp-2 font-semibold text-[#354b3d]">{note.title}</h2><p className="mt-1 text-[11px] text-[#929e95]">{note.category || 'Sem categoria'} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(note.updated_at))}</p></div><button aria-label={note.pinned ? 'Desafixar nota' : 'Fixar nota'} onClick={() => void togglePinned(note)} className="rounded-lg p-1.5 text-[#87948a] hover:bg-[#f5f3eb]">{note.pinned ? <PinOff size={15} /> : <Pin size={15} />}</button></div><p className="mt-4 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#6f7d73] line-clamp-6">{note.content}</p>{note.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{note.tags.map(tag => <Badge key={tag}><span className="inline-flex items-center gap-1"><Tag size={10} />{tag}</span></Badge>)}</div>}<div className="mt-4 flex justify-end gap-1 border-t border-[#eff1ed] pt-3"><Button variant="ghost" onClick={() => edit(note)}><Pencil size={14} />Editar</Button><Button variant="ghost" onClick={() => void deleteNote(note)}><Trash2 size={14} />Excluir</Button></div></Card>)}</div>}
  </>
}
