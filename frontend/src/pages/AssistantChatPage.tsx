import { ScreenExecutor } from '../components/ScreenExecutor'
import { useConversation } from '../hooks/useConversation'
import { conversationContext, type ChatMessage } from '../lib/conversation-store'
import { researchWeb, supportsResearch, type ResearchResult } from '../lib/web-research'
import { PhotoCleanup } from '../components/PhotoCleanup'
import { SectionBanner } from '../components/Personalization'
import { saveAIConfig, loadAIConfig, deleteAIConfig } from '../lib/ai-credentials'
import { AI_PROVIDERS, generateAIReply, type AIProvider } from '../lib/ai-providers'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { speakVoice, stopVoice } from '../lib/agent-voice'
import { isAndroid, nativeAssistant } from '../lib/native-assistant'
import { executeMemoryCommand, loadMemoryContext, parseMemoryCommand } from '../lib/toph-memory'
import { useAuth } from '../lib/auth'
import { nativeFiles, type FilePlan } from '../lib/file-actions'
import { EXECUTOR_PROMPT, validateDecision, type PlannedAction } from '../lib/execution-schema'
import { loadConnection, sendWhatsAppMessage } from '../lib/mobile-integrations'
import { executeAssistantAction, parseAssistantAction } from '../lib/assistant-actions'
import { Mic, MicOff, Send, Volume2, VolumeX, Trash2 } from 'lucide-react'

type Message = ChatMessage
type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: RecognitionResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
type PendingExecution = { action: PlannedAction; files?: FilePlan; account: string }
const INTRO: Message = { id: 'intro', role: 'model', text: 'Peça para criar tarefas, listar arquivos, criar uma pasta ou organizar documentos. Toque em Arquivos para autorizar uma pasta. Mudanças terão uma prévia para você confirmar.' }

export function AssistantChatPage({ floating = false }: { floating?: boolean }) {
  const { user } = useAuth()
  const voiceEnabled = useRef(floating)
  const greeted = useRef(false)
  const voiceSessionActive = useRef(false)
  const [voiceSession, setVoiceSession] = useState(0)
  const [voicePaused, setVoicePaused] = useState(false)
  const request = useRef<AbortController | null>(null)
  const { messages, setMessages, clear: clearHistory, ready: historyReady, storageError } = useConversation(user?.email, INTRO)
  const [key, setKey] = useState('')
  const [provider, setProvider] = useState<AIProvider>('gemini')
  const [model, setModel] = useState(AI_PROVIDERS.gemini.model)
  const [endpoint, setEndpoint] = useState(AI_PROVIDERS.gemini.endpoint)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState('')
  const [screenGoal, setScreenGoal] = useState<string | null>(null)
  const [photosOpen, setPhotosOpen] = useState(false)
  const [pending, setPending] = useState<PendingExecution | null>(null)
  const [fileRunning, setFileRunning] = useState(false)
  const executionLock = useRef(false)
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
  useEffect(() => {
    if (!isAndroid) return
    let disposed = false
    const handle = nativeFiles.addListener('progress', event => {
      if (!disposed) setBusy(`Arquivos verificados: ${event.completed}/${event.total} · ${event.current}`)
    })
    return () => { disposed = true; void handle.then(h => h.remove()).catch(() => {}); void nativeFiles.cancel().catch(() => {}) }
  }, [])
  useEffect(() => { setPending(null) }, [user?.email])
  const pauseFloatingMic = () => {
    if (!floating || !isAndroid || !voiceSessionActive.current) return
    voiceSessionActive.current = false
    setListening(false)
    setVoicePaused(true)
    void nativeAssistant.stopListening().catch(() => {})
  }
  const addResult = (text: string) => setMessages(prev => [...prev, { role: 'model', text, local: true, private: true, phase: 'result', context: 'Registro de execução local: houve um resultado. Consulte o painel para detalhes; não repita ações sem novo pedido.' }])
  const chooseFolder = async (forget = false) => {
    if (request.current || executionLock.current || !historyReady) return
    pauseFloatingMic(); setError(''); setPending(null); executionLock.current = true; setBusy('Aguardando acesso à pasta…')
    try { await addResult((await (forget ? nativeFiles.forgetFolder() : nativeFiles.chooseFolder())).summary) }
    catch (e) { setError(e instanceof Error ? e.message : 'Não consegui selecionar a pasta.') }
    finally { executionLock.current = false; setBusy('') }
  }
  const discardPlan = () => {
    setPending(null)
    if (isAndroid) void nativeFiles.discard().catch(() => {})
    void addResult('Plano descartado. Nenhuma mudança foi executada.').catch(() => {})
  }
  const confirmPlan = async () => {
    if (!pending || executionLock.current || request.current || pending.account !== user?.email) return
    executionLock.current = true
    const plan = pending; setPending(null); setError(''); pauseFloatingMic(); setBusy('Executando plano confirmado…')
    try {
      if (plan.files) {
        setFileRunning(true)
        const result = await nativeFiles.execute({ token: plan.files.token })
        const heading = result.error ? 'Execução interrompida.' : result.cancelled ? 'Execução cancelada entre etapas.' : 'Execução concluída.'
        await addResult([heading, `${result.completed.length}/${result.total} etapas verificadas.`, ...result.completed, result.error || '', result.cancelled ? 'As etapas já concluídas foram mantidas.' : ''].filter(Boolean).join('\n'))
      } else if (plan.action.kind === 'whatsapp-send') {
        const connection = await loadConnection('whatsapp', plan.account)
        if (!connection) throw new Error('Configure a conexão WhatsApp em Configurações → Integrações.')
        await addResult(await sendWhatsAppMessage(connection, plan.action.phone, plan.action.text))
      } else await addResult(await executeAssistantAction(plan.action, plan.account))
    } catch (e) { setError(e instanceof Error ? e.message : 'Não consegui concluir a execução.') }
    finally { executionLock.current = false; setFileRunning(false); setBusy('') }
  }
  const prepareAction = async (action: PlannedAction, signal: AbortSignal) => {
    if (action.kind === 'screen-task') {
      if (!floating || !isAndroid) return 'Abra o app desejado, toque na Toph flutuante e use Executar na tela. A execução precisa acontecer no painel sobre o app.'
      pauseFloatingMic(); setScreenGoal(action.goal)
      return 'Abri o executor de tela. Leia os controles, autorize a análise e revise cada ação antes de executar.'
    }
    if (action.kind === 'photos-review') {
      if (!isAndroid) throw new Error('A limpeza de fotos está disponível no APK Android.')
      pauseFloatingMic(); setPhotosOpen(true)
      return 'Abri a revisão de fotos duplicadas. Toque em Autorizar e analisar fotos. Nenhuma imagem foi alterada.'
    }
    if (action.kind === 'files') {
      if (!isAndroid) throw new Error('A organização de arquivos está disponível no APK Android.')
      if (action.operation === 'list') {
        const result = await nativeFiles.listFiles({ query: action.query })
        return [`Pasta: ${result.folder}`, ...result.items.map(item => `${item.directory ? 'Pasta' : 'Arquivo'}: ${item.name}${item.size >= 0 && !item.directory ? ` (${item.size} bytes)` : ''}`), result.items.length ? '' : 'Nenhum item encontrado.'].filter(Boolean).join('\n')
      }
      const files = await nativeFiles.prepare(action)
      if (signal.aborted) { await nativeFiles.discard(); return 'Plano cancelado.' }
      pauseFloatingMic()
      setPending({ action, files, account: user!.email })
      return 'Preparei a prévia. Confira as mudanças abaixo e toque em Confirmar. Nenhum arquivo foi alterado ainda.'
    }
    if (action.kind === 'create-task' || action.kind === 'whatsapp-send') {
      pauseFloatingMic()
      setPending({ action, account: user!.email })
      return 'Confira o pedido abaixo e toque em Confirmar para executar.'
    }
    if (action.kind === 'web-search') throw new Error('Pesquisa deve usar o provedor de IA conectado.')
    return executeAssistantAction(action, user?.email)
  }
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
    if (!text || request.current || executionLock.current || screenGoal !== null || !loaded || !historyReady) return
    if (pending) { setError('Confirme ou descarte o plano atual antes de fazer outro pedido.'); return }
    if (!user) { setError('Entre na sua conta para usar a Toph.'); return }
    const memory = parseMemoryCommand(text)
    if (memory && !user) {
      setError('Entre na sua conta para usar a memória da Toph.')
      return
    }
    const action = memory ? null : parseAssistantAction(text)
    const local = !!(memory || (action && action.kind !== 'web-search'))
    if (!local && AI_PROVIDERS[provider].requiresKey && !key.trim()) {
      const message = 'Conecte uma API de IA para conversar. Os comandos de tarefas já estão disponíveis.'
      setError(message)
      if (floating) await speak(message, true)
      return
    }
    setDraft('')
    setError('')
    const history = [...conversationContext(messages), { role: 'user' as const, text }]
    const status = memory ? 'Atualizando memória…' : action?.kind === 'create-task' ? 'Criando tarefa…' : action?.kind === 'web-search' ? 'Pesquisando fontes na web…' : action ? 'Executando comando…' : 'Preparando resposta…'
    setBusy(status)
    const controller = new AbortController()
    request.current = controller
    const timeout = local ? undefined : window.setTimeout(() => controller.abort('timeout'), 90000)
    const announce = action && !floating ? window.setTimeout(() => {
      if (voiceEnabled.current && !controller.signal.aborted) void speak(status)
    }, 800) : undefined
    try {
      await setMessages(prev => [...prev, { role: 'user', text, local: !!memory || action?.kind === 'bank-balances' || action?.kind === 'screen' }])
      if (controller.signal.aborted) return
      const context = !local && user ? await loadMemoryContext(user.id, text) : []
      let answer: string
      let toolUsed = !!action
      let research: ResearchResult | undefined
      let proposed = false
      const runResearch = async (query: string) => {
        setBusy('Pesquisando fontes na web…')
        research = await researchWeb({ provider, apiKey: key, model, endpoint }, query, controller.signal)
        return research.text
      }
      if (memory && user) answer = await executeMemoryCommand(memory, user.id)
      else if (action?.kind === 'web-search') { answer = await runResearch(action.query) }
      else if (action) {
        proposed = action.kind === 'files' && action.operation !== 'list' || action.kind === 'create-task' || action.kind === 'whatsapp-send'
        answer = ['screen-task', 'files', 'photos-review', 'create-task', 'list-tasks', 'whatsapp-send'].includes(action.kind)
          ? await prepareAction(action as PlannedAction, controller.signal) : await executeAssistantAction(action, user?.email)
      } else {
        const decision = validateDecision(await generateAIReply({ provider, apiKey: key, model, endpoint }, history, controller.signal, context, EXECUTOR_PROMPT))
        if (controller.signal.aborted) return
        if (decision.action?.kind !== 'web-search') window.clearTimeout(timeout)
        toolUsed = !!decision.action
        if (decision.action && !user) throw new Error('Entre na sua conta para executar tarefas.')
        if (decision.action) setBusy('Preparando a execução…')
        proposed = !!decision.action && (decision.action.kind === 'files' && decision.action.operation !== 'list' || decision.action.kind === 'create-task' || decision.action.kind === 'whatsapp-send')
        answer = decision.action?.kind === 'web-search' ? await runResearch(decision.action.query) : decision.action ? await prepareAction(decision.action, controller.signal) : decision.reply
      }
      if (controller.signal.aborted) return
      const privateResult = memory?.kind === 'list' || (toolUsed && !research)
      await setMessages(prev => [...prev, { role: 'model', text: answer, local: local || (toolUsed && !research), private: privateResult, ...(research ? { sources: research.sources, searchHtml: research.searchHtml } : {}), ...(toolUsed ? { phase: proposed ? 'proposal' as const : 'result' as const } : {}), ...(proposed ? { context: 'Foi preparada uma proposta, ainda não executada. Se o painel foi reaberto, gere outra prévia; não assuma confirmação anterior.' } : {}) }])
      if (voiceEnabled.current && action?.kind === 'screen') await speak('Li o texto da tela. Abra o chat da Toph para conferir.', floating)
      else if (voiceEnabled.current && toolUsed && !research) await speak('Confira o resultado e a prévia no painel da Toph.', floating)
      else if (voiceEnabled.current && !privateResult) await speak(answer, floating)
    } catch (reason) {
      const failure = controller.signal.aborted ? (controller.signal.reason === 'timeout' ? 'A IA demorou para responder. O pedido não foi concluído.' : 'Pedido interrompido. Confira o estado antes de tentar novamente.') : (reason instanceof Error ? reason.message : 'Não foi possível executar o pedido.')
      await setMessages(prev => [...prev, { role: 'model', text: failure, local: true, phase: 'error', context: 'A última tentativa foi interrompida ou falhou; não há confirmação de conclusão.' }]).catch(() => {})
      if (controller.signal.reason === 'timeout') setError(failure)
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
    if (!floating || !isAndroid || !loaded || !historyReady || !account) return
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
        if (active && voiceSessionActive.current) timer = window.setTimeout(() => void next(), 350)
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
          const overlay = await nativeAssistant.getOverlayStatus().catch(() => null)
          if (!overlay?.voiceSession) await voiceHandlers.current.speak('Olá! Como posso ajudar?', true)
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
  }, [account, floating, loaded, historyReady, voiceSession])

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
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => {voiceEnabled.current = !voiceEnabled.current; setVoiceMode(voiceEnabled.current); stopVoice()}} className="flex items-center gap-2 rounded-xl border border-[#45454a] px-3 py-2 text-sm">{voiceMode ? <Volume2 size={17}/> : <VolumeX size={17}/>} {floating ? (voiceMode ? 'Voz ligada' : 'Ligar voz') : (voiceMode ? 'Respostas faladas: ativadas' : 'Ativar respostas faladas')}</button><button type="button" aria-label="Limpar conversa" disabled={!!busy || !historyReady} onClick={() => {setPending(null);stopVoice();void clearHistory().catch(() => setError('Não foi possível limpar a conversa.'))}} className="flex items-center gap-2 text-sm text-[#a3a5a9]"><Trash2 size={16}/> {floating ? 'Limpar' : 'Limpar conversa'}</button></div>
    <div aria-live="polite" className="assistant-messages flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-[#34363a] bg-[#151617] p-3">{messages.map((m) => <div key={m.id} className={m.role === 'user' ? 'assistant-user-message ml-auto max-w-[90%] rounded-2xl px-4 py-3' : 'mr-auto max-w-[90%] rounded-2xl bg-[#282a2c] px-4 py-3 text-[#F1F1ED]'}>{m.phase && <p className="mb-1 text-xs text-[#C5FF4A]">{m.phase === 'proposal' ? 'Proposta · exige confirmação nesta sessão' : m.phase === 'error' ? 'Etapa interrompida' : 'Retorno da ferramenta'}</p>}<p className="whitespace-pre-wrap text-sm">{m.text}</p>{m.sources?.length ? <ul className="mt-2 text-xs">{m.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline text-[#C5FF4A]" onClick={event => { if (isAndroid) { event.preventDefault(); void nativeAssistant.openExternal({ url: source.url }).catch(() => setError('Não foi possível abrir a fonte.')) } }}>{source.title}</a></li>)}</ul> : null}{m.searchHtml && <iframe title="Sugestões da Pesquisa Google" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={m.searchHtml} className="mt-2 h-32 w-full border-0"/>}{m.role === 'model' && !m.private && <button type="button" aria-label="Ouvir resposta" className="mt-2 opacity-70" onClick={() => void speak(m.text)}><Volume2 size={15}/></button>}</div>)}{busy && <p className="text-sm text-[#a3a5a9]">{busy}</p>}<div ref={bottom}/></div>
    {isAndroid && <div className="flex flex-wrap gap-2"><button type="button" disabled={!!busy || !!pending} onClick={() => void chooseFolder()} className="rounded-xl border border-[#45454a] px-3 py-2 text-sm disabled:opacity-40">Arquivos · escolher pasta</button><button type="button" disabled={!!busy || !!pending} onClick={() => void chooseFolder(true)} className="rounded-xl border border-[#45454a] px-3 py-2 text-sm disabled:opacity-40">Remover acesso</button></div>}
    {isAndroid && <button type="button" disabled={!!busy || !!pending} onClick={() => { pauseFloatingMic(); setPhotosOpen(true) }} className="self-start rounded-xl border border-[#45454a] px-3 py-2 text-sm disabled:opacity-40">Fotos duplicadas</button>}
    {floating && isAndroid && <button type="button" disabled={!!busy || !!pending || screenGoal !== null} onClick={() => { pauseFloatingMic(); setScreenGoal('') }} className="self-start rounded-xl border border-[#C5FF4A] px-3 py-2 text-sm">Executar na tela</button>}
    {screenGoal !== null && <ScreenExecutor initialGoal={screenGoal} onClose={() => setScreenGoal(null)} onJournal={addResult} />}
    {photosOpen && <PhotoCleanup onClose={() => setPhotosOpen(false)} />}
    {!pending && messages.at(-1)?.phase === 'proposal' && <p className="text-xs text-[#a3a5a9]">Essa prévia pertence à sessão anterior. Peça novamente para conferir o estado atual antes de executar.</p>}
    {pending && <section aria-label="Prévia da execução" className="rounded-xl border border-[#C5FF4A] bg-[#1d1e20] p-3"><p className="font-semibold">Revisar antes de executar</p><p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-sm">{pending.files ? [`Pasta: ${pending.files.folder}`, ...pending.files.steps].join('\n') : pending.action.kind === 'create-task' ? `Criar tarefa: ${pending.action.title}` : pending.action.kind === 'whatsapp-send' ? `Enviar WhatsApp para ${pending.action.phone}\n\n${pending.action.text}` : ''}</p><p className="my-2 text-xs text-[#a3a5a9]">Confira todos os itens. Cancelar durante a execução mantém as etapas já concluídas.</p><div className="flex gap-2"><button type="button" disabled={!!busy} onClick={() => void confirmPlan()} className="rounded-xl bg-[#C5FF4A] px-4 py-2 text-black">Confirmar</button><button type="button" disabled={!!busy} onClick={discardPlan} className="rounded-xl border border-[#45454a] px-4 py-2">Descartar</button></div></section>}
    {!!busy && !pending && <button type="button" onClick={() => { if (fileRunning) { void nativeFiles.cancel(); setBusy('Cancelando após a etapa atual…') } else if (request.current) { request.current.abort(); setBusy('Cancelando…') } }} disabled={!fileRunning && busy === 'Executando plano confirmado…'} className="self-start rounded-xl border border-[#45454a] px-3 py-2 text-sm">Cancelar execução</button>}
    <p className="text-xs text-[#a3a5a9]">{historyReady ? 'Conversa salva neste aparelho · últimas 120 mensagens' : 'Recuperando conversa…'}</p>
    {storageError && <p role="alert" className="text-sm text-[#ff8990]">{storageError}</p>}
    {error && <p role="alert" className="text-sm text-[#ff8990]">{error}</p>}
    {floating && isAndroid && <button type="button" disabled={!!busy || !loaded} onClick={() => { pauseFloatingMic(); void send('analisar a tela') }} className="self-start rounded-xl border border-[#45454a] px-3 py-2 text-sm">Ler tela</button>}
    <p className="text-xs text-[#a3a5a9]">{supportsResearch({ provider, apiKey: key, model, endpoint }) ? 'Pesquisa no chat disponível: diga “pesquise…”; usa a cota do seu provedor.' : 'Pesquisa no chat: selecione Gemini ou Groq GPT-OSS. “No Chrome” apenas abre o navegador.'}</p>
    {!floating && <p className="text-xs text-[#a3a5a9]">Diga “Lembre que…” para guardar algo, “O que você lembra?” para ver e “Limpar memória” para apagar tudo. Algumas notas podem ser usadas nas respostas do provedor de IA configurado.</p>}
    <form onSubmit={e => {e.preventDefault();void send()}} className="flex gap-2"><button type="button" aria-label={listening ? 'Parar microfone' : 'Ativar microfone'} disabled={screenGoal !== null || !!pending || !!busy || (isAndroid && listening && !floating)} onClick={togglePanelMic} className="rounded-xl border border-[#45454a] p-3">{listening ? <MicOff size={20} className="text-[#C5FF4A]"/> : <Mic size={20}/>}</button><input aria-label="Mensagem" onFocus={pauseFloatingMic} value={draft} onChange={e => setDraft(e.target.value)} placeholder="Converse com a assistente…" className="min-w-0 flex-1 rounded-xl border border-[#45454a] bg-[#242628] p-3 text-white"/><button type="submit" disabled={screenGoal !== null || !!busy || !!pending || !loaded || !historyReady || !draft.trim()} aria-label="Enviar mensagem" className="rounded-xl bg-[#C5FF4A] p-3 text-[#101010] disabled:opacity-40"><Send size={20}/></button></form>
    <p className="text-xs text-[#9a9da0]">{floating ? (listening ? 'Ouvindo…' : voicePaused ? 'Microfone pausado. Toque para voltar a ouvir.' : 'Preparando a Toph…') : 'Toque no microfone para ditar.'} {!floating && <Link to="/settings" className="mono-accent underline">Configurar voz e assistente</Link>}</p>
  </div>
}
