import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Check, Command, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { post } from '../lib/api'
import { Button, ErrorMessage, Field, Input } from '../components/ui'

type Mode = 'login' | 'register' | 'forgot' | 'reset'

function AuthFrame({ children, title, eyebrow, subtitle }: { children: ReactNode; title: string; eyebrow: string; subtitle: string }) {
  return <main className="grid min-h-screen bg-[#f5f6f1] lg:grid-cols-[1fr_.92fr]">
    <section className="relative hidden overflow-hidden bg-[#203c2e] px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
      <div className="absolute -right-28 top-24 h-96 w-96 rounded-full border border-white/10" />
      <div className="absolute -right-8 top-44 h-80 w-80 rounded-full border border-white/10" />
      <div className="relative flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d9f16f] text-[#203c2e]"><Command size={20} /></span><span className="text-lg font-bold">lifeos</span></div>
      <div className="relative max-w-xl pb-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#d1dfd3]"><span className="h-1.5 w-1.5 rounded-full bg-[#d9f16f]" /> Seu espaço, no seu ritmo</span>
        <h1 className="mt-7 text-5xl font-semibold leading-[1.1] tracking-tight xl:text-6xl">Clareza para o que <span className="text-[#d9f16f]">vem a seguir.</span></h1>
        <p className="mt-6 max-w-md text-base leading-7 text-[#c0d0c3]">Tarefas, projetos, hábitos e ideias em um lugar que acompanha a sua vida.</p>
        <div className="mt-9 flex items-center gap-3 text-sm text-[#d2dfd4]"><ShieldCheck size={17} className="text-[#d9f16f]" /> Seus dados pertencem a você.</div>
      </div>
      <p className="relative text-xs text-[#a8bdad]">Organização pessoal com intenção.</p>
    </section>
    <section className="flex items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-10 flex items-center gap-2 lg:hidden"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#203c2e] text-[#d9f16f]"><Command size={18} /></span><span className="font-bold text-[#203c2e]">lifeos</span></div>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#7b927d]">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[#20352a]">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-[#78867c]">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </div>
    </section>
  </main>
}

export function AuthPage({ mode }: { mode: Mode }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError(''); setMessage(''); setBusy(true)
    try {
      if (mode === 'login') { await login(email, password); navigate('/', { replace: true }) }
      if (mode === 'register') { await register(email, name, password); navigate('/', { replace: true }) }
      if (mode === 'forgot') {
        const result = await post<{ message: string }>('/auth/password-reset/request', { email })
        setMessage(result.message)
      }
      if (mode === 'reset') {
        await post('/auth/password-reset/confirm', { token: params.get('token'), new_password: newPassword })
        setMessage('Senha atualizada. Agora você pode entrar com a nova senha.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível concluir a solicitação.')
    } finally { setBusy(false) }
  }

  const title = mode === 'login' ? 'Boas-vindas de volta' : mode === 'register' ? 'Crie sua conta' : mode === 'forgot' ? 'Recupere o acesso' : 'Escolha uma nova senha'
  const eyebrow = mode === 'login' ? 'Entre no seu espaço' : mode === 'register' ? 'Comece por aqui' : 'Acesso à conta'
  const subtitle = mode === 'login' ? 'Entre para continuar cuidando do que importa.' : mode === 'register' ? 'Um espaço pessoal para organizar sua vida.' : mode === 'forgot' ? 'Se a conta existir, enviaremos instruções para o e-mail informado.' : 'O link é temporário e só pode ser usado uma vez.'

  return <AuthFrame title={title} eyebrow={eyebrow} subtitle={subtitle}>
    <form onSubmit={submit} className="space-y-4">
      {mode === 'register' && <Field label="Nome"><Input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required maxLength={120} placeholder="Como podemos chamar você?" /></Field>}
      {(mode === 'login' || mode === 'register' || mode === 'forgot') && <Field label="E-mail"><Input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254} placeholder="voce@exemplo.com" /></Field>}
      {(mode === 'login' || mode === 'register') && <Field label="Senha" hint={mode === 'register' ? 'Use pelo menos 12 caracteres.' : undefined}><Input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 12 : 1} maxLength={128} placeholder="••••••••••••" /></Field>}
      {mode === 'reset' && <Field label="Nova senha" hint="Use pelo menos 12 caracteres."><Input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" required minLength={12} maxLength={128} placeholder="••••••••••••" /></Field>}
      {error && <ErrorMessage message={error} />}
      {message && <div role="status" className="flex gap-2 rounded-xl border border-[#d8e9cc] bg-[#f0f7e9] px-3.5 py-3 text-sm text-[#527544]"><Check size={17} className="mt-0.5 shrink-0" />{message}</div>}
      <Button type="submit" busy={busy} className="w-full !py-3">{mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : mode === 'forgot' ? 'Enviar instruções' : 'Atualizar senha'}<ArrowRight size={16} /></Button>
    </form>
    <div className="mt-6 flex flex-col gap-3 text-center text-sm text-[#77857b]">
      {mode === 'login' && <><Link className="font-medium text-[#47664f] hover:underline" to="/forgot-password">Esqueci minha senha</Link><p>Ainda não tem conta? <Link className="font-semibold text-[#315b45] hover:underline" to="/register">Criar uma conta</Link></p></>}
      {mode === 'register' && <p>Já tem uma conta? <Link className="font-semibold text-[#315b45] hover:underline" to="/login">Entrar</Link></p>}
      {(mode === 'forgot' || mode === 'reset') && <Link className="font-semibold text-[#315b45] hover:underline" to="/login">Voltar para entrar</Link>}
    </div>
    <p className="mt-9 text-center text-[11px] text-[#a4ada5]">Ao continuar, você acessa somente informações da sua conta.</p>
  </AuthFrame>
}
