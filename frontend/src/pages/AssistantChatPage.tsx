import { SectionBanner } from '../components/Personalization'
import { saveAIConfig, loadAIConfig, deleteAIConfig } from '../lib/ai-credentials'
import { AI_PROVIDERS, generateAIReply, type AIProvider } from '../lib/ai-providers'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { speakVoice, stopVoice } from '../lib/agent-voice'
import { isAndroid, nativeAssistant } from '../lib/native-assistant'
import { executeMemoryCommand, loadMemoryContext, parseMemoryCommand } from '../lib/toph-memory'
import { useAuth } from '../lib/auth'
import { executeAssistantAction, parseAssistantAction } from '../lib/assistant-actions'
import { Mic, MicOff, Send, Volume2, VolumeX, Trash2 } from 'lucide-react'

type Message = { role: 'user' | 'model'; text: string; local?: boolean; private?: boolean }
type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: RecognitionResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
const INTRO: Message = { role: 'model', text: 'Experimente “Criar tarefa: estudar Clojure” ou “Listar tarefas”.' }

export function AssistantChatPage({ floating = false }: { floating?: boolean }) {
  const { user } = useAuth()
  const voiceEnabled = useRef(floating)
  const greeted = useRef(false)
  const voiceSessionActive = useRef(false)
  const [voiceSession, setVoiceSession] = useState(0)
  const [voicePaused, setVoicePaused] = useState(false)
  const request = useRef<AbortController | null>(null)
  const [messages, setMessages] = useState<Message[]>([INTRO])
  const [key, setKey] = useState('')
  const [provider, setProvider] = useState<AIProvider>('gemini')
  const [model, setModel] = useState(AI_PROVIDERS.gemini.model)
  const [endpoint, setEndpoint] = useState(AI_PROVIDERS.gemini.endpoint)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceMode, setVoiceMode] = useState(floating)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const recognition = useRef<Recognition | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const config = await loadAIConfig()
        if (!active) return
        if (config) { setProvider(config.provider); setModel(config.model); setEndpoint(config.endpoint); setKey(config.apiKey); setSaved(true) }
        else { setSaved(false) }
      } catch { if (active) setError('Não foi possível carregar a configuração salva.') }
      finally { if (active) setLoaded(true) }
    }
    void refresh()
    window.addEventListener('lifeos-ai-config-changed', refresh)
    return () => { active = false; window.removeEventListener('lifeos-ai-config-changed', refresh) }
  }, [])
  const save = async () => {
    try {
      await saveAIConfig({ provider, apiKey: key, model, endpoint })
      setSaved(true); setError('')
    } catch { setError('Não foi possível salvar a API neste dispositivo.') }
  }
  const forget = async () => {
    try {
      await deleteAIConfig()
      setKey(''); setSaved(false); setError('')
    } catch { setError('Não foi possível excluir a chave salva.') }
  }
  useEffect(() => {
    const container = bottom.current?.parentElement
    if (container) container.scrollTop = container.scrollHeight
  }, [messages, busy])
  useEffect(() => () => {
    request.current?.abort()
    recognition.current?.stop()
    stopVoice()
  }, [])
  const speak = async (text: string, waitForEnd = false) => {
    if (!user) return
    try { await speakVoice(text, user.email, user.id, waitForEnd) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível reproduzir a voz.') }
  }
  const send = async (override?: string) => {
    const text = (override ?? draft).trim()
    if (!text || request.current || !loaded) return
    const memory = parseMemoryCommand(text)
    if (memory && !user) {
      setError('Entre na sua conta para usar a memória da Toph.')
      return
    }
    const action = memory ? null : parseAssistantAction(text)
    const local = !!(memory || action)
    if (!local && AI_PROVIDERS[provider].requiresKey && !key.trim()) {
      const message = 'Conecte uma API de IA para conversar. Os comandos de tarefas já estão disponíveis.'
      setError(message)
      if (floating) await speak(message, true)
      return
    }
    setDraft('')
    setError('')
    const history: Message[] = [...messages.filter(m => m !== INTRO && !m.local).map(({ role, text }) => ({ role, text })), { role: 'user', text }]
    setMessages(prev => [...prev, { role: 'user', text, local }])
    const status = memory ? 'Atualizando memória…' : action?.kind === 'create-task' ? 'Criando tarefa…' : action ? 'Executando comando…' : 'Preparando resposta…'
    setBusy(status)
    const controller = new AbortController()
    request.current = controller
    const timeout = local ? undefined : window.setTimeout(() => controller.abort('timeout'), 25000)
    const announce = action && !floating ? window.setTimeout(() => {
      if (voiceEnabled.current && !controller.signal.aborted) void speak(status)
    }, 800) : undefined
    try {
      const context = !local && user ? await loadMemoryContext(user.id, text).catch(() => []) : []
      const answer = memory && user ? await executeMemoryCommand(memory, user.id)
        : action ? await executeAssistantAction(action, user?.email)
        : await generateAIReply({ provider, apiKey: key, model, endpoint }, history, controller.signal, context)
      if (controller.signal.aborted) return
      const privateResult = memory?.kind === 'list' || action?.kind === 'bank-balances' || action?.kind === 'screen'
      setMessages(prev => [...prev, { role: 'model', text: answer, local, private: privateResult }])
      if (voiceEnabled.current && action?.kind === 'screen') await speak('Li o texto da tela. Abra o chat da Toph para conferir.', floating)
      else if (voiceEnabled.current && !privateResult) await speak(answer, floating)
    } catch (reason) {
      if (controller.signal.reason === 'timeout') setError('A IA demorou para responder.')
      else if (!controller.signal.aborted) {
        const message = reason instanceof Error ? reason.message : 'Não foi possível executar o pedido.'
        setError(message)
        if (floating && voiceEnabled.current && action?.kind === 'device') await speak(message, true)
      }
    } finally {
      window.clearTimeout(timeout)
      window.clearTimeout(announce)
      request.current = null
      setBusy('')
    }
  }
  const voiceHandlers = useRef({ send, speak })
  useEffect(() => { voiceHandlers.current = { send, speak } }, [send, speak])
  const account = user?.email

  useEffect(() => {
    if (!floating || !isAndroid || !loaded || !account) return
    let active = true
    voiceSessionActive.current = true
    let timer: number | undefined
    let silentTurns = 0
    const pause = () => {
      setListening(false)
      setVoicePaused(true)
    }
    const next = async () => {
      if (!active || !voiceSessionActive.current) return
      if (document.hidden) { pause(); return }
      try {
        setListening(true)
        const result = await nativeAssistant.listen()
        if (!active || !voiceSessionActive.current) return
        if (document.hidden) { pause(); return }
        setListening(false)
        const text = result.text.trim()
        if (/^(?:encerrar|fechar|parar)(?: (?:a conversa|a top[h]?|de ouvir))?[.!]?$/i.test(text)) {
          pause()
          await nativeAssistant.closePanel({ end: false })
          return
        }
        if (text) {
          silentTurns = 0
          await voiceHandlers.current.send(text)
        } else if (++silentTurns >= 2) {
          pause()
          return
        }
        if (active) timer = window.setTimeout(() => void next(), 350)
      } catch (reason) {
        if (!active) return
        pause()
        setError(reason instanceof Error ? reason.message : 'Não foi possível ouvir. Confira a permissão do microfone.')
      }
    }
    const onVisibility = () => {
      if (!document.hidden) return
      active = false
      window.clearTimeout(timer)
      void nativeAssistant.stopListening().catch(() => {})
      stopVoice()
      pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    timer = window.setTimeout(() => {
      void (async () => {
        if (!greeted.current) {
          greeted.current = true
          await voiceHandlers.current.speak('Olá! Como posso ajudar?', true)
        }
        if (active) await next()
      })()
    }, 0)
    return () => {
      active = false
      voiceSessionActive.current = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearTimeout(timer)
      void nativeAssistant.stopListening().catch(() => {})
      stopVoice()
    }
  }, [account, floating, loaded, voiceSession])

  const toggleListening = async () => {
    if (isAndroid) {
      if (listening) return
      stopVoice()
      setListening(true)
      setError('')
      try {
        const result = await nativeAssistant.dictate()
        if (result.text) setDraft(result.text)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o ditado do Android.')
      } finally {
        setListening(false)
      }
      return
    }
    if (listening) { recognition.current?.stop(); setListening(false); return }
    const w = window as SpeechWindow
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Constructor) { setError('Reconhecimento de fala não disponível neste WebView. Será necessária a integração nativa Android.'); return }
    try {
      const r = new Constructor()
      r.lang = 'pt-BR'; r.continuous = false; r.interimResults = false
      r.onresult = event => { const text = event.results[0]?.[0]?.transcript || ''; setDraft(text); setListening(false) }
      r.onerror = () => { setListening(false); setError('Não foi possível reconhecer a fala. Verifique a permissão do microfone.') }
      r.onend = () => setListening(false)
      recognition.current = r
      r.start(); setListening(true)
    } catch { setError('Não foi possível iniciar o microfone.'); setListening(false) }
  }
  const pauseFloatingMic = () => {
    if (!floating || !isAndroid || !voiceSessionActive.current) return
    voiceSessionActive.current = false
    setListening(false)
    setVoicePaused(true)
    void nativeAssistant.stopListening().catch(() => {})
  }
  const togglePanelMic = () => {
    if (!floating || !isAndroid) { void toggleListening(); return }
    if (voiceSessionActive.current && !voicePaused) { pauseFloatingMic(); return }
    setError('')
    setVoicePaused(false)
    setVoiceSession(value => value + 1)
  }
  return <div className={`mx-auto flex w-full max-w-3xl flex-col gap-3 text-[#F1F1ED] ${floating ? 'assistant-compact' : 'min-h-[65vh]'}`}>
    {!floating && <SectionBanner section="chat" pageHeading />}
    {!floating && isAndroid && <Link to="/settings#toph-flutuante" className="mono-accent self-start text-sm underline">Configurar Toph flutuante</Link>}
    {!floating && <details className="rounded-2xl border border-[#34363a] bg-[#1d1e20] p-4" open>
      <summary className="cursor-pointer font-semibold">Conectar sua IA · {AI_PROVIDERS[provider].label}</summary>
      <p className="mt-2 text-xs text-[#a3a5a9]">Salve sua configuração criptografada neste aparelho para não precisar digitá-la novamente. Você pode substituir ou excluir a chave quando quiser.</p>
      <label className="mt-3 block text-sm">Provedor
        <select aria-label="Provedor de IA" value={provider} onChange={e => { const next = e.target.value as AIProvider; setProvider(next); setModel(AI_PROVIDERS[next].model); setEndpoint(AI_PROVIDERS[next].endpoint); setKey(''); setError('') }} className="mt-1 w-full rounded-xl border border-[#45454a] bg-[#101010] p-3 text-white">{(Object.keys(AI_PROVIDERS) as AIProvider[]).map(p => <option key={p} value={p}>{AI_PROVIDERS[p].label}</option>)}</select>
      </label>
      <label className="mt-2 block text-sm">Modelo
        <input value={model} onChange={e => setModel(e.target.value)} placeholder="Nome exato do modelo" className="mt-1 w-full rounded-xl border border-[#45454a] bg-[#101010] p-3 text-white"/>
      </label>
      {(provider === 'custom' || provider === 'ollama') && <label className="mt-2 block text-sm">URL base da API
        <input value={endpoint} onChange={e => setEndpoint(e.target.value)} placeholder="https://exemplo.com/v1" className="mt-1 w-full rounded-xl border border-[#45454a] bg-[#101010] p-3 text-white"/>
      </label>}
      <label className="mt-2 block text-sm">Chave da API {AI_PROVIDERS[provider].requiresKey ? '(obrigatória)' : '(opcional)'}
        <input type="password" autoComplete="off" spellCheck={false} value={key} onChange={e => setKey(e.target.value)} placeholder="Sua chave pessoal" className="mt-1 w-full rounded-xl border border-[#45454a] bg-[#101010] p-3 text-white"/>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void save()} disabled={!model.trim() || (AI_PROVIDERS[provider].requiresKey && !key.trim())} className="rounded-xl bg-[#C5FF4A] px-4 py-2 font-semibold text-[#101010] disabled:opacity-50">{saved ? 'Atualizar configuração' : 'Salvar configuração'}</button><button type="button" onClick={() => void forget()} className="rounded-xl border border-[#45454a] px-4 py-2">Excluir chave salva</button>{saved && <span className="text-xs text-[#C5FF4A]">Configuração salva neste dispositivo</span>}</div>
      <p className="mt-2 text-xs text-[#a3a5a9]">APIs personalizadas precisam ser compatíveis com /chat/completions e permitir chamadas do aplicativo (CORS). Endereços locais podem não funcionar no celular; localhost aponta para o próprio aparelho. Use somente serviços confiáveis.</p>
    </details>}
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => {voiceEnabled.current = !voiceEnabled.current; setVoiceMode(voiceEnabled.current); stopVoice()}} className="flex items-center gap-2 rounded-xl border border-[#45454a] px-3 py-2 text-sm">{voiceMode ? <Volume2 size={17}/> : <VolumeX size={17}/>} {floating ? (voiceMode ? 'Voz ligada' : 'Ligar voz') : (voiceMode ? 'Respostas faladas: ativadas' : 'Ativar respostas faladas')}</button><button type="button" aria-label="Limpar conversa" disabled={!!busy} onClick={() => {setMessages([INTRO]);setError('');stopVoice()}} className="flex items-center gap-2 text-sm text-[#a3a5a9]"><Trash2 size={16}/> {floating ? 'Limpar' : 'Limpar conversa'}</button></div>
    <div aria-live="polite" className="assistant-messages flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-[#34363a] bg-[#151617] p-3">{messages.map((m,i) => <div key={i} className={m.role === 'user' ? 'assistant-user-message ml-auto max-w-[90%] rounded-2xl px-4 py-3' : 'mr-auto max-w-[90%] rounded-2xl bg-[#282a2c] px-4 py-3 text-[#F1F1ED]'}><p className="whitespace-pre-wrap text-sm">{m.text}</p>{m.role === 'model' && !m.private && <button type="button" aria-label="Ouvir resposta" className="mt-2 opacity-70" onClick={() => void speak(m.text)}><Volume2 size={15}/></button>}</div>)}{busy && <p className="text-sm text-[#a3a5a9]">{busy}</p>}<div ref={bottom}/></div>
    {error && <p role="alert" className="text-sm text-[#ff8990]">{error}</p>}
    {floating && isAndroid && <button type="button" disabled={!!busy || !loaded} onClick={() => { pauseFloatingMic(); void send('analisar a tela') }} className="self-start rounded-xl border border-[#45454a] px-3 py-2 text-sm">Ler tela</button>}
    {!floating && <p className="text-xs text-[#a3a5a9]">Diga “Lembre que…” para guardar algo, “O que você lembra?” para ver e “Limpar memória” para apagar tudo. Algumas notas podem ser usadas nas respostas do provedor de IA configurado.</p>}
    <form onSubmit={e => {e.preventDefault();void send()}} className="flex gap-2"><button type="button" aria-label={listening ? 'Parar microfone' : 'Ativar microfone'} disabled={isAndroid && listening && !floating} onClick={togglePanelMic} className="rounded-xl border border-[#45454a] p-3">{listening ? <MicOff size={20} className="text-[#C5FF4A]"/> : <Mic size={20}/>}</button><input aria-label="Mensagem" onFocus={pauseFloatingMic} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Converse com a assistente…" className="min-w-0 flex-1 rounded-xl border border-[#45454a] bg-[#242628] p-3 text-white"/><button type="submit" disabled={!!busy || !loaded || !draft.trim()} aria-label="Enviar mensagem" className="rounded-xl bg-[#C5FF4A] p-3 text-[#101010] disabled:opacity-40"><Send size={20}/></button></form>
    <p className="text-xs text-[#9a9da0]">{floating ? (listening ? 'Ouvindo…' : voicePaused ? 'Microfone pausado. Toque para voltar a ouvir.' : 'Preparando a Toph…') : 'Toque no microfone para ditar.'} {!floating && <Link to="/settings" className="mono-accent underline">Configurar voz e assistente</Link>}</p>
  </div>
}
