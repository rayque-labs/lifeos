import { useState, type FormEvent } from 'react'
import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, ErrorMessage, Field, Input, PageHeading } from '../components/ui'
import { patch, put } from '../lib/api'
import { useAuth } from '../lib/auth'

export function SettingsPage() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.full_name || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { await patch('/auth/me', { full_name: name }); await refreshUser(); setMessage('Perfil atualizado.') }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o perfil.') }
    finally { setBusy(false) }
  }
  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await put('/auth/password', { current_password: currentPassword, new_password: newPassword })
      await logout(); navigate('/login', { replace: true })
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível alterar a senha.') }
    finally { setBusy(false) }
  }

  return <>
    <PageHeading title="Configurações" description="Seu perfil e as opções de acesso da sua conta." />
    {error && <div className="mb-4"><ErrorMessage message={error} /></div>}
    {message && <p role="status" className="mb-4 rounded-xl border border-[#d8e9cc] bg-[#f0f7e9] px-3.5 py-2.5 text-sm text-[#527544]">{message}</p>}
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf0e7] text-[#648063]"><UserRound size={18} /></span><div><h2 className="font-semibold text-[#30483a]">Perfil</h2><p className="mt-1 text-xs text-[#8c9990]">Informações básicas da sua conta.</p></div></div>
        <form onSubmit={saveProfile} className="space-y-4"><Field label="Nome"><Input required minLength={1} maxLength={120} value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></Field><Field label="E-mail"><div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99a59c]" /><Input className="pl-9" value={user?.email || ''} readOnly aria-readonly="true" /></div></Field><div className="flex items-center gap-2 text-xs text-[#7b897f]"><ShieldCheck size={15} className="text-[#6e9460]" />Conta pessoal protegida por senha.</div><Button type="submit" busy={busy}>Salvar perfil</Button></form>
      </Card>
      <Card><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2ecfa] text-[#8565a1]"><KeyRound size={18} /></span><div><h2 className="font-semibold text-[#30483a]">Senha e segurança</h2><p className="mt-1 text-xs text-[#8c9990]">Tokens ativos são revogados após a troca.</p></div></div>
        <form onSubmit={savePassword} className="space-y-4"><Field label="Senha atual"><Input type="password" required maxLength={128} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></Field><Field label="Nova senha" hint="No mínimo 12 caracteres."><Input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></Field><Button type="submit" variant="secondary" busy={busy}>Alterar senha</Button></form><div className="mt-5 flex items-center justify-between rounded-xl bg-[#f7f8f5] px-3.5 py-3"><div><p className="text-xs font-semibold text-[#526459]">Recuperação de senha</p><p className="mt-0.5 text-[11px] text-[#919d94]">Disponível quando o serviço de e-mail estiver configurado.</p></div><Badge tone="blue">SMTP</Badge></div>
      </Card>
    </div>
  </>
}
