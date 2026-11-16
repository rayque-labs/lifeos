import { openUsageAccessSettings, screenTimeSuggestion, usageAvailable, usagePermissionStatus } from '../lib/agent-usage'
import { DEFAULT_AGENT_PREFERENCES, loadAgentPreferences, saveAgentPreferences, type AgentPreferences } from '../lib/agent-permissions'
import { OfflineBackup } from '../components/OfflineBackup'
import { ProfilePhotoEditor } from '../components/Personalization'
import { useState, type FormEvent } from 'react'
import { KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Card, ErrorMessage, Field, Input, PageHeading } from '../components/ui'
import { patch, put } from '../lib/api'
import { useAuth } from '../lib/auth'

export function SettingsPage() {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()
  const [usageInfo, setUsageInfo] = useState('Acesso ao tempo de tela ainda não verificado.')
  const [agentPrefs, setAgentPrefs] = useState<AgentPreferences>(() => user?.id ? loadAgentPreferences(user.id) : { ...DEFAULT_AGENT_PREFERENCES })
  const updateAgentPref = <K extends keyof AgentPreferences>(key: K, value: AgentPreferences[K]) => setAgentPrefs(current => ({ ...current, [key]: value }))
  const saveAgentPrefs = () => { if (!user?.id) return; saveAgentPreferences(user.id, agentPrefs); setMessage('Preferências do agente salvas neste dispositivo. Permissões do Android e conexões externas ainda precisam ser concedidas separadamente.'); setError('') }
  const [name, setName] = useState(user?.full_name || '')
  const [preferredName, setPreferredName] = useState(() => localStorage.getItem('lifeos:preferred-name:v1') || '')
  const [agentName, setAgentName] = useState(() => localStorage.getItem('lifeos:agent-name:v1') || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      if (import.meta.env.VITE_OFFLINE_MODE === 'true') {
        const updated = { ...(user || { id: 1, email: 'local@lifeos.invalid' }), full_name: name.trim() }
        localStorage.setItem('lifeos:offline:v1:profile', JSON.stringify(updated))
      } else {
        await patch('/auth/me', { full_name: name.trim() })
      }
      localStorage.setItem('lifeos:preferred-name:v1', preferredName.trim())
      localStorage.setItem('lifeos:agent-name:v1', agentName.trim())
      await refreshUser()
      setMessage('Perfil e nomes personalizados salvos neste dispositivo.')
    }
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
    <Card><div className="mb-4"><h2 className="font-semibold">Agente proativo · Percepção e permissões</h2><p className="mt-1 text-sm opacity-70">Configure o que o agente poderá sugerir. Ativar uma preferência não concede acesso ao Android, a mensagens ou a bancos.</p></div>
      <div className="space-y-4">
        <label className="block text-sm font-medium">Nível de iniciativa
          <select className="mt-2 w-full rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white" value={agentPrefs.initiative} onChange={event => updateAgentPref('initiative', event.target.value as AgentPreferences['initiative'])}>
            <option value="discreta">Discreta — avisos essenciais</option><option value="moderada">Moderada — sugestões ocasionais</option><option value="ativa">Ativa — sugestões proativas</option>
          </select>
        </label>
        {([
          ['screenBreaks','Sugerir pausas após uso prolongado do celular'],
          ['draftAnalysis','Analisar rascunhos compartilhados voluntariamente'],
          ['messageNotifications','Analisar notificações de mensagens (futuro)'],
          ['financialAnalysis','Analisar dados financeiros autorizados (futuro)'],
        ] as const).map(([key,label]) => <label key={key} className="flex min-h-12 items-center gap-3 text-sm">
          <input type="checkbox" checked={agentPrefs[key]} onChange={event => updateAgentPref(key,event.target.checked)} className="h-5 w-5 accent-lime-400" />
          <span>{label}</span>
        </label>)}
        <p className="text-xs opacity-70">Nenhuma integração externa ou captura de mensagens está ativa nesta versão. Acesso de uso, notificações e Open Finance exigem autorizações próprias. Ações que alteram dados deverão passar por confirmação detalhada.</p>
        <Button type="button" onClick={saveAgentPrefs}>Salvar preferências do agente</Button>
        <div className="rounded-xl border border-neutral-700 p-3 space-y-3">
          <h3 className="font-semibold">Tempo de tela · Android</h3>
          <p className="text-xs opacity-70">O LifeOS consulta somente o total de tempo de uso de hoje, quando você autorizar. Não lê o conteúdo de outros aplicativos.</p>
          <p role="status" className="text-sm">{usageInfo}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={async () => { try { setUsageInfo(await usagePermissionStatus() ? 'Acesso autorizado pelo Android.' : 'Acesso ainda não autorizado.') } catch { setUsageInfo('Não foi possível verificar a permissão.') } }}>Verificar acesso</Button>
            <Button type="button" variant="secondary" onClick={async () => { try { await openUsageAccessSettings(); setUsageInfo('Autorize o LifeOS nas configurações do Android e volte para testar.') } catch { setUsageInfo('Recurso disponível apenas no aplicativo Android.') } }}>Configurar no Android</Button>
            <Button type="button" variant="secondary" onClick={async () => { if (!user?.id) return; try { const result = await screenTimeSuggestion(user.id); setUsageInfo('Uso de hoje: ' + result.minutes + ' minutos. ' + (result.suggestion?.message || 'Nenhuma pausa sugerida agora.')) } catch (reason) { setUsageInfo(reason instanceof Error ? reason.message : 'Falha ao consultar uso.') } }}>Testar sugestão</Button>
          </div>
          {!usageAvailable() && <p className="text-xs opacity-70">No navegador, a leitura de uso não está disponível.</p>}
        </div>
      </div>
    </Card>
    <ProfilePhotoEditor />
    {import.meta.env.VITE_OFFLINE_MODE === 'true' && <div className="mb-5"><OfflineBackup /></div>}
    {<div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf0e7] text-[#648063]"><UserRound size={18} /></span><div><h2 className="font-semibold text-[#30483a]">Perfil</h2><p className="mt-1 text-xs text-[#8c9990]">Informações básicas da sua conta.</p></div></div>
        <form onSubmit={saveProfile} className="space-y-4"><Field label="Nome do usuário"><Input required minLength={1} maxLength={120} value={name} onChange={event => setName(event.target.value)} autoComplete="name" /></Field><Field label="Como seu assistente deve chamar você?"><Input maxLength={60} value={preferredName} onChange={event => setPreferredName(event.target.value)} placeholder="Ex.: Rayque" /></Field><Field label="Nome do seu agente"><Input maxLength={60} value={agentName} onChange={event => setAgentName(event.target.value)} placeholder="Escolha o nome do assistente" /></Field><Field label="E-mail"><div className="relative"><Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99a59c]" /><Input className="pl-9" value={user?.email || ''} readOnly aria-readonly="true" /></div></Field><div className="flex items-center gap-2 text-xs text-[#7b897f]"><ShieldCheck size={15} className="text-[#6e9460]" />Conta pessoal protegida por senha.</div><Button type="submit" busy={busy}>Salvar perfil</Button></form>
      </Card>
      {import.meta.env.VITE_OFFLINE_MODE !== "true" && <Card><div className="mb-5 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2ecfa] text-[#8565a1]"><KeyRound size={18} /></span><div><h2 className="font-semibold text-[#30483a]">Senha e segurança</h2><p className="mt-1 text-xs text-[#8c9990]">Tokens ativos são revogados após a troca.</p></div></div>
        <form onSubmit={savePassword} className="space-y-4"><Field label="Senha atual"><Input type="password" required maxLength={128} autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></Field><Field label="Nova senha" hint="No mínimo 12 caracteres."><Input type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></Field><Button type="submit" variant="secondary" busy={busy}>Alterar senha</Button></form><div className="mt-5 flex items-center justify-between rounded-xl bg-[#f7f8f5] px-3.5 py-3"><div><p className="text-xs font-semibold text-[#526459]">Recuperação de senha</p><p className="mt-0.5 text-[11px] text-[#919d94]">Disponível quando o serviço de e-mail estiver configurado.</p></div><Badge tone="blue">SMTP</Badge></div>
      </Card>}
    </div>}
  </>
}
