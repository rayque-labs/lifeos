import { saveAIConfig, loadAIConfig, deleteAIConfig } from '../lib/ai-credentials'
import { AI_PROVIDERS, generateAIReply, type AIProvider } from '../lib/ai-providers'
import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, Volume2, VolumeX, Trash2 } from 'lucide-react'

type Message = { role: 'user' | 'model'; text: string }
type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: RecognitionResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
const INTRO: Message = { role: 'model', text: 'Oi! Eu sou a assistente do LifeOS. Podemos conversar por texto ou voz. Para começar, configure sua API de IA.' }

export function AssistantChatPage() {
  const [messages, setMessages] = useState<Message[]>([INTRO])
  const [key, setKey] = useState('')
  const [provider, setProvider] = useState<AIProvider>('gemini')
  const [model, setModel] = useState(AI_PROVIDERS.gemini.model)
  const [endpoint, setEndpoint] = useState(AI_PROVIDERS.gemini.endpoint)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
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
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => () => { recognition.current?.stop(); window.speechSynthesis?.cancel() }, [])
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'pt-BR'
    utterance.rate = 1.02
    window.speechSynthesis.speak(utterance)
  }
  const send = async (override?: string) => {
    const text = (override ?? draft).trim()
    if (!text || busy || !loaded) return
    setDraft('')
    setError('')
    const history: Message[] = [...messages.filter(m => m !== INTRO), { role: 'user', text }]
    setMessages(prev => [...prev, { role: 'user', text }])
    if (AI_PROVIDERS[provider].requiresKey && !key.trim()) { setError('Informe a chave da API para conversar.'); return }
    setBusy(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 25000)
    try {
      const answer = await generateAIReply({ provider, apiKey: key, model, endpoint }, history, controller.signal)
      setMessages(prev => [...prev, { role: 'model', text: answer }])
      if (voiceMode) speak(answer)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Falha ao consultar a IA.') }
    finally { window.clearTimeout(timeout); setBusy(false) }
  }
  const toggleListening = () => {
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
  return <div className="mx-auto flex min-h-[65vh] max-w-3xl flex-col gap-4 text-[#F1F1ED]">
    <div><h1 className="text-2xl font-bold">Assistente LifeOS</h1><p className="text-sm text-[#a3a5a9]">Chat e conversa por voz · Prévia experimental</p></div>
    <details className="rounded-2xl border border-[#34363a] bg-[#1d1e20] p-4" open={!key && AI_PROVIDERS[provider].requiresKey}>
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
    </details>
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => {setVoiceMode(v => !v);window.speechSynthesis?.cancel()}} className="flex items-center gap-2 rounded-xl border border-[#45454a] px-3 py-2 text-sm">{voiceMode ? <Volume2 size={17}/> : <VolumeX size={17}/>} {voiceMode ? 'Respostas faladas: ativadas' : 'Ativar respostas faladas'}</button><button type="button" onClick={() => {setMessages([INTRO]);setError('');window.speechSynthesis?.cancel()}} className="flex items-center gap-2 text-sm text-[#a3a5a9]"><Trash2 size={16}/> Limpar conversa</button></div>
    <div aria-live="polite" className="flex min-h-64 flex-1 flex-col gap-3 rounded-2xl border border-[#34363a] bg-[#151617] p-4">{messages.map((m,i) => <div key={i} className={m.role === 'user' ? 'ml-auto max-w-[90%] rounded-2xl bg-[#C5FF4A] px-4 py-3 text-[#101010]' : 'mr-auto max-w-[90%] rounded-2xl bg-[#282a2c] px-4 py-3 text-[#F1F1ED]'}><p className="whitespace-pre-wrap text-sm">{m.text}</p>{m.role === 'model' && <button type="button" aria-label="Ouvir resposta" className="mt-2 opacity-70" onClick={() => speak(m.text)}><Volume2 size={15}/></button>}</div>)}{busy && <p className="text-sm text-[#a3a5a9]">Pensando…</p>}<div ref={bottom}/></div>
    {error && <p role="alert" className="text-sm text-[#ff8990]">{error}</p>}
    <form onSubmit={e => {e.preventDefault();void send()}} className="flex gap-2"><button type="button" aria-label={listening ? 'Parar microfone' : 'Ditado por voz'} onClick={toggleListening} className="rounded-xl border border-[#45454a] p-3">{listening ? <MicOff size={20} className="text-[#C5FF4A]"/> : <Mic size={20}/>}</button><input aria-label="Mensagem" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Converse com a assistente…" className="min-w-0 flex-1 rounded-xl border border-[#45454a] bg-[#242628] p-3 text-white"/><button type="submit" disabled={busy || !loaded || !draft.trim()} aria-label="Enviar mensagem" className="rounded-xl bg-[#C5FF4A] p-3 text-[#101010] disabled:opacity-40"><Send size={20}/></button></form>
    <p className="text-xs text-[#9a9da0]">A escuta funciona apenas quando você toca no microfone, se o aparelho permitir. Ativação por palavra-chave e assistente padrão do Android exigem uma implementação nativa separada.</p>
  </div>
}
