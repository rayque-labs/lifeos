import { useEffect, useState } from 'react'

type VoiceChoice = { mode: 'system' | 'sample'; voiceURI: string; sampleName: string }
const key = (id: number | string) => 'lifeos:agent:voice:v1:' + id

export function AgentVoiceSettings({ userId }: { userId: number | string }) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [choice, setChoice] = useState<VoiceChoice>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key(userId)) || 'null') as Partial<VoiceChoice> | null
      return { mode: saved?.mode === 'sample' ? 'sample' : 'system', voiceURI: saved?.voiceURI || '', sampleName: saved?.sampleName || '' }
    } catch { return { mode: 'system', voiceURI: '', sampleName: '' } }
  })
  const [preview, setPreview] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const refresh = () => setVoices(window.speechSynthesis.getVoices())
    refresh()
    window.speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const save = (next: VoiceChoice) => {
    setChoice(next)
    localStorage.setItem(key(userId), JSON.stringify(next))
  }
  const play = () => {
    if (!('speechSynthesis' in window)) { setNotice('Síntese de voz não disponível neste aparelho.'); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance('Ei, olha quem apareceu! Bora organizar seu dia? Eu prometo tentar não implicar muito.')
    utterance.lang = 'pt-BR'
    const selected = voices.find(voice => voice.voiceURI === choice.voiceURI)
    if (selected) utterance.voice = selected
    window.speechSynthesis.speak(utterance)
  }
  return <section className="rounded-xl border border-neutral-700 p-3 space-y-3">
    <h3 className="font-semibold">Voz do agente</h3>
    <p className="text-sm opacity-75">Escolha uma voz instalada no dispositivo ou ouça uma referência de áudio. Clonagem de voz ainda não está disponível nesta versão.</p>
    <label className="block text-sm">Tipo de voz
      <select className="mt-2 w-full min-h-11 rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white" value={choice.mode} onChange={event => save({ ...choice, mode: event.target.value as VoiceChoice['mode'] })}>
        <option value="system">Voz do sistema</option>
        <option value="sample">Áudio de referência (somente reprodução)</option>
      </select>
    </label>
    {choice.mode === 'system' ? <>
      <label className="block text-sm">Voz disponível
        <select className="mt-2 w-full min-h-11 rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white" value={choice.voiceURI} onChange={event => save({ ...choice, voiceURI: event.target.value })}>
          <option value="">Padrão do aparelho</option>
          {voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
        </select>
      </label>
      <button type="button" className="min-h-11 rounded-xl bg-[#C5FF4A] px-4 font-semibold text-[#101010]" onClick={play}>Ouvir teste</button>
    </> : <>
      <label className="block text-sm">Escolher áudio de referência (até 10 MB)
        <input className="mt-2 block w-full text-sm" type="file" accept="audio/*" onChange={event => {
          const file = event.target.files?.[0]
          if (!file) return
          if (!file.type.startsWith('audio/') || file.size > 10 * 1024 * 1024) { setNotice('Escolha um arquivo de áudio de até 10 MB.'); return }
          if (preview) URL.revokeObjectURL(preview)
          setPreview(URL.createObjectURL(file))
          save({ ...choice, sampleName: file.name })
          setNotice('Áudio carregado apenas para ouvir. Ele não foi enviado nem clonado.')
        }} />
      </label>
      {preview ? <audio controls src={preview} className="w-full" /> : <p className="text-xs opacity-70">Selecione um arquivo para reproduzir. A seleção não persiste após fechar o aplicativo.</p>}
      <p className="text-xs opacity-70">Para criar falas novas com essa voz, será necessário integrar um serviço de clonagem com consentimento e direitos de uso comprovados.</p>
    </>}
    {notice && <p role="status" className="text-xs">{notice}</p>}
  </section>
}
