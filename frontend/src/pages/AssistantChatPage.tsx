import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, Volume2, VolumeX, Trash2 } from 'lucide-react'

type Message = { role: 'user' | 'model'; text: string }
type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> }
type Recognition = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((event: RecognitionResult) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
const INTRO: Message = { role: 'model', text: 'Oi! Eu sou a assistente do LifeOS. Podemos conversar por texto ou voz. Para começar, conecte sua própria chave Gemini.' }

export function AssistantChatPage() {
  const [messages, setMessages] = useState<Message[]>([INTRO])
  const [key, setKey] = useState('')
  const [model, setModel] = useState(MODELS[0])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [listening, setListening] = useState(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [error, setError] = useState('')
  const recognition = useRef<Recognition | null>(null)
  const bottom = useRef<HTMLDivElement>(null)
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
    if (!text || busy) return
    setDraft('')
    setError('')
    const history: Message[] = [...messages.filter(m => m !== INTRO), { role: 'user', text }]
    setMessages(prev => [...prev, { role: 'user', text }])
    if (!key.trim()) { setError('Informe sua chave Gemini para conversar. Ela permanece apenas nesta tela.'); return }
    setBusy(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 25000)
    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key.trim() },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: 'Você é a assistente do LifeOS. Responda em português brasileiro, de forma humana, amigável, clara e concisa. Não diga que criou tarefas, compromissos ou executou ações no celular: você não possui essas ferramentas nesta versão.' }] },
          contents: history.slice(-16).map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          generationConfig: { maxOutputTokens: 512 }
        }), signal: controller.signal, cache: 'no-store'
      })
      if (!response.ok) throw new Error('Gemini respondeu HTTP ' + response.status + '. Verifique a chave, o modelo e a cota.')
      const data = await response.json()
      const answer = (data?.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text || '').join('').trim()
      if (!answer) throw new Error('A IA não retornou uma resposta.')
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
    <details className="rounded-2xl border border-[#34363a] bg-[#1d1e20] p-4" open={!key}>
      <summary className="cursor-pointer font-semibold">Conectar sua API Gemini</summary>
      <p className="mt-2 text-xs text-[#a3a5a9]">Sua chave fica somente na memória desta tela; não é salva no histórico nem no GitHub. Use uma chave própria e restrita. Não compartilhe segredos no chat.</p>
      <input type="password" autoComplete="off" placeholder="Chave da API Gemini" aria-label="Chave Gemini" value={key} onChange={e => setKey(e.target.value)} className="mt-3 w-full rounded-xl border border-[#45454a] bg-[#101010] p-3 text-white" />
      <select aria-label="Modelo Gemini" value={model} onChange={e => setModel(e.target.value)} className="mt-2 w-full rounded-xl border border-[#45454a] bg-[#101010] p-3 text-white">{MODELS.map(m => <option key={m} value={m}>{m}</option>)}</select>
    </details>
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => {setVoiceMode(v => !v);window.speechSynthesis?.cancel()}} className="flex items-center gap-2 rounded-xl border border-[#45454a] px-3 py-2 text-sm">{voiceMode ? <Volume2 size={17}/> : <VolumeX size={17}/>} {voiceMode ? 'Respostas faladas: ativadas' : 'Ativar respostas faladas'}</button><button type="button" onClick={() => {setMessages([INTRO]);setError('');window.speechSynthesis?.cancel()}} className="flex items-center gap-2 text-sm text-[#a3a5a9]"><Trash2 size={16}/> Limpar conversa</button></div>
    <div aria-live="polite" className="flex min-h-64 flex-1 flex-col gap-3 rounded-2xl border border-[#34363a] bg-[#151617] p-4">{messages.map((m,i) => <div key={i} className={m.role === 'user' ? 'ml-auto max-w-[90%] rounded-2xl bg-[#C5FF4A] px-4 py-3 text-[#101010]' : 'mr-auto max-w-[90%] rounded-2xl bg-[#282a2c] px-4 py-3 text-[#F1F1ED]'}><p className="whitespace-pre-wrap text-sm">{m.text}</p>{m.role === 'model' && <button type="button" aria-label="Ouvir resposta" className="mt-2 opacity-70" onClick={() => speak(m.text)}><Volume2 size={15}/></button>}</div>)}{busy && <p className="text-sm text-[#a3a5a9]">Pensando…</p>}<div ref={bottom}/></div>
    {error && <p role="alert" className="text-sm text-[#ff8990]">{error}</p>}
    <form onSubmit={e => {e.preventDefault();void send()}} className="flex gap-2"><button type="button" aria-label={listening ? 'Parar microfone' : 'Ditado por voz'} onClick={toggleListening} className="rounded-xl border border-[#45454a] p-3">{listening ? <MicOff size={20} className="text-[#C5FF4A]"/> : <Mic size={20}/>}</button><input aria-label="Mensagem" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Converse com a assistente…" className="min-w-0 flex-1 rounded-xl border border-[#45454a] bg-[#242628] p-3 text-white"/><button type="submit" disabled={busy || !draft.trim()} aria-label="Enviar mensagem" className="rounded-xl bg-[#C5FF4A] p-3 text-[#101010] disabled:opacity-40"><Send size={20}/></button></form>
    <p className="text-xs text-[#9a9da0]">A escuta funciona apenas quando você toca no microfone, se o aparelho permitir. Ativação por palavra-chave e assistente padrão do Android exigem uma implementação nativa separada.</p>
  </div>
}
