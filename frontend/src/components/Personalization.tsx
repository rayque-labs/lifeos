import { useEffect, useState, type ChangeEvent } from 'react'
import { Camera, ImagePlus, RotateCcw, Trash2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import './Personalization.css'

export const sections = {
  dashboard: { label: 'Início', subtitle: 'Seu espaço. Seu ritmo.', presets: ['pulse','orbit','horizon'] },
  tasks: { label: 'Tarefas', subtitle: 'Um passo de cada vez.', presets: ['grid','pulse','horizon'] },
  projects: { label: 'Projetos', subtitle: 'Transforme planos em conquistas.', presets: ['horizon','grid','orbit'] },
  habits: { label: 'Hábitos', subtitle: 'Consistência cria resultados.', presets: ['orbit','pulse','grid'] },
  notes: { label: 'Notas', subtitle: 'Ideias merecem espaço.', presets: ['grid','horizon','orbit'] },
  calendar: { label: 'Agenda', subtitle: 'Organize o que importa.', presets: ['horizon','orbit','pulse'] },
  finance: { label: 'Finanças', subtitle: 'Clareza para suas decisões.', presets: ['pulse','grid','horizon'] },
} as const
export type Section = keyof typeof sections
type ImageValue = { type: 'preset'; value: string } | { type: 'image'; value: string }
const eventName = 'lifeos:personalization'
function key(userId: string, field: string) { return 'lifeos:monolith:' + userId + ':' + field }
function read(userId: string, field: string): ImageValue | null {
  try { const raw = localStorage.getItem(key(userId,field)); if (!raw) return null
    const parsed = JSON.parse(raw) as ImageValue
    return (parsed.type === 'preset' || parsed.type === 'image') && typeof parsed.value === 'string' ? parsed : null
  } catch { return null }
}
function write(userId: string, field: string, value: ImageValue | null) {
  if (value) localStorage.setItem(key(userId,field), JSON.stringify(value))
  else localStorage.removeItem(key(userId,field))
  window.dispatchEvent(new Event(eventName))
}
function usePersonalization(field: string) {
  const { user } = useAuth()
  const userId = user?.email || 'guest'
  const [value,setValue] = useState<ImageValue | null>(() => read(userId,field))
  useEffect(() => {
    const sync = () => setValue(read(userId,field))
    sync(); window.addEventListener(eventName,sync); window.addEventListener('storage',sync)
    return () => { window.removeEventListener(eventName,sync); window.removeEventListener('storage',sync) }
  },[userId,field])
  return { value, set: (v: ImageValue | null) => { try { write(userId,field,v); setValue(v); return true } catch { return false } } }
}
async function compressImage(file: File, square = false): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem válida.')
  if (file.size > 12 * 1024 * 1024) throw new Error('A imagem deve ter até 12 MB.')
  const objectUrl = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = objectUrl
    await img.decode()
    const canvas = document.createElement('canvas')
    const maxW = square ? 320 : 1200, maxH = square ? 320 : 440
    canvas.width = maxW; canvas.height = maxH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Não foi possível processar a imagem.')
    const scale = Math.max(maxW/img.naturalWidth,maxH/img.naturalHeight)
    const w = img.naturalWidth*scale,h = img.naturalHeight*scale
    ctx.drawImage(img,(maxW-w)/2,(maxH-h)/2,w,h)
    return canvas.toDataURL('image/webp',.78)
  } finally { URL.revokeObjectURL(objectUrl) }
}
export function SectionBanner({ section }: { section: Section }) {
  const info = sections[section]
  const field = 'banner:' + section
  const { value, set } = usePersonalization(field)
  const [editing,setEditing] = useState(false)
  const [error,setError] = useState('')
  const preset = value?.type === 'preset' ? value.value : info.presets[0]
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try { const image = await compressImage(file); if (!set({type:'image',value:image})) throw new Error('Armazenamento local cheio. Tente uma imagem menor.'); setError(''); setEditing(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao carregar imagem.') }
  }
  return <div className="mono-banner-wrap">
    <div className={`mono-banner mono-banner--${section} mono-art-${preset}`} style={value?.type==='image'?{backgroundImage:`linear-gradient(90deg,#000b,#0003),url("${value.value}")`,backgroundSize:'cover',backgroundPosition:'center'}:undefined}>
      <div className="mono-banner__art" aria-hidden="true"><i/><i/><i/></div>
      <div className="mono-banner__copy"><span className="mono-banner__eyebrow">LIFEOS / {info.label.toUpperCase()}</span><h2>{info.label}</h2><p>{info.subtitle}</p></div>
      <button className="mono-banner__edit" type="button" onClick={() => setEditing(!editing)} aria-expanded={editing} aria-label={`Personalizar banner de ${info.label}`}><Camera size={16}/> Personalizar</button>
    </div>
    {editing && <div className="mono-banner-options">
      <div><strong>Escolha um estilo</strong><p>Ou envie uma imagem da galeria.</p></div>
      <div className="mono-banner-options__choices">{info.presets.map(p => <button key={p} type="button" onClick={() => {set({type:'preset',value:p});setError('')}} className={`mono-banner-swatch mono-art-${p} ${value?.type!=='image' && preset===p?'is-active':''}`} aria-label={`Estilo ${p}`} title={p} />)}</div>
      <label className="mono-image-action"><ImagePlus size={16}/> Escolher imagem<input type="file" accept="image/*" onChange={upload} hidden/></label>
      <button type="button" className="mono-image-action" onClick={() => {set(null);setError('')}}><RotateCcw size={15}/> Restaurar</button>
    </div>}
    {error && <p className="mono-image-error" role="alert">{error}</p>}
  </div>
}
export function ProfilePhoto({ size = 'small' }: { size?: 'small'|'large' }) {
  const { user } = useAuth()
  const { value } = usePersonalization('avatar')
  const initials = (user?.full_name || 'L').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()
  return <span className={`mono-avatar mono-avatar--${size}`}>{value?.type==='image' ? <img src={value.value} alt="Foto de perfil"/> : initials}</span>
}
export function ProfilePhotoEditor() {
  const { value,set } = usePersonalization('avatar')
  const [error,setError] = useState('')
  const upload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try { const image = await compressImage(file,true); if (!set({type:'image',value:image})) throw new Error('Sem espaço para salvar a foto neste dispositivo.');setError('') }
    catch(reason) { setError(reason instanceof Error ? reason.message : 'Erro ao carregar foto.') }
  }
  return <div className="mono-profile-editor">
    <ProfilePhoto size="large"/>
    <div><h3>Foto de perfil</h3><p>Adicione, troque ou remova sua foto.</p>
      <div className="mono-profile-actions"><label className="mono-image-action"><Camera size={15}/>{value?.type==='image'?'Trocar foto':'Adicionar foto'}<input type="file" accept="image/*" onChange={upload} hidden/></label>
      {value?.type==='image' && <button className="mono-image-action" type="button" onClick={() => {set(null);setError('')}}><Trash2 size={15}/> Remover foto</button>}</div>
      {error && <p className="mono-image-error" role="alert">{error}</p>}
    </div>
  </div>
}
