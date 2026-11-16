import { useEffect, useState } from 'react'
import { createVoice, deleteVoiceConfig, loadVoiceConfig, saveVoiceConfig, saveVoicePreference, speakVoice, stopVoice, voicePreference } from '../lib/agent-voice'
import { isAndroid } from '../lib/native-assistant'
import { Button, Field, Input, Select } from './ui'

const testPhrase = 'Oi! Eu sou a assistente do LifeOS. Vamos organizar seu dia?'

export function AgentVoiceSettings({ account, userId }: { account: string; userId: number }) {
  const [preference, setPreference] = useState(() => voicePreference(account, userId))
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [apiKey, setKey] = useState('')
  const [voiceId, setVoiceId] = useState('')
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let active = true
    loadVoiceConfig(account).then(config => {
      if (active && config) { setKey(config.apiKey); setVoiceId(config.voiceId) }
    }).catch(() => { if (active) setNotice('Não foi possível ler a voz salva.') })
      .finally(() => { if (active) setLoaded(true) })
    return () => { active = false; stopVoice() }
  }, [account])
  useEffect(() => {
    if (isAndroid || !window.speechSynthesis) return
    const refresh = () => setVoices(window.speechSynthesis.getVoices())
    refresh()
    window.speechSynthesis.addEventListener('voiceschanged', refresh)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', refresh)
  }, [])

  const updatePreference = (next: typeof preference) => {
    saveVoicePreference(account, next)
    setPreference(next)
  }
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setNotice('')
    try { await action() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'A operação de voz falhou.') }
    finally { setBusy(false) }
  }
  const save = (id: string) => saveVoiceConfig(account, { apiKey: apiKey.trim(), voiceId: id })
  return <section className="space-y-3 p-4">
    <h3 className="font-semibold">Voz do assistente</h3>
    <Field label="Tipo de voz">
      <Select disabled={busy} value={preference.mode} onChange={event => {
        stopVoice()
        updatePreference({ ...preference, mode: event.target.value === 'elevenlabs' ? 'elevenlabs' : 'system' })
      }}>
        <option value="system">Voz do sistema</option>
        <option value="elevenlabs">Voz clonada · ElevenLabs</option>
      </Select>
    </Field>
    {preference.mode === 'system' && !isAndroid && <Field label="Voz disponível">
      <Select value={preference.voiceURI} onChange={event => updatePreference({ ...preference, voiceURI: event.target.value })}>
        <option value="">Padrão do aparelho</option>
        {voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
      </Select>
    </Field>}
    {preference.mode === 'elevenlabs' && <>
      <Field label="Chave da ElevenLabs"><Input type="password" autoComplete="off" spellCheck={false} value={apiKey} disabled={!loaded || busy} onChange={event => setKey(event.target.value)} /></Field>
      <Field label="ID da voz"><Input value={voiceId} disabled={!loaded || busy} onChange={event => setVoiceId(event.target.value)} placeholder="Cole um ID ou crie uma voz abaixo" /></Field>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!loaded || busy || !apiKey.trim() || !voiceId.trim()} onClick={() => void run(async () => { await save(voiceId.trim()); setNotice('Voz salva para o chat.') })}>Salvar voz</Button>
        <Button variant="secondary" disabled={!loaded || busy} onClick={() => void run(async () => {
          stopVoice()
          await deleteVoiceConfig(account)
          setKey('')
          setVoiceId('')
          updatePreference({ ...preference, mode: 'system' })
          setNotice('Chave e ID removidos deste aparelho.')
        })}>Remover chave e ID</Button>
      </div>
      <details className="space-y-3">
        <summary className="cursor-pointer font-medium">Criar voz a partir de uma gravação</summary>
        <Field label="Nome da voz"><Input value={name} disabled={busy} maxLength={100} onChange={event => setName(event.target.value)} /></Field>
        <Field label="Áudio de referência (até 10 MB)">
          <input type="file" accept="audio/*" disabled={busy} className="block w-full text-sm" onChange={event => {
            const selected = event.target.files?.[0]
            const valid = selected && (selected.type.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|flac|aac|webm)$/i.test(selected.name)) && selected.size > 0 && selected.size <= 10 * 1024 * 1024
            setFile(valid ? selected : null)
            setConsent(false)
            setNotice(selected && !valid ? 'Escolha um áudio válido de até 10 MB.' : '')
          }} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />
          <span>Tenho autorização para clonar esta voz e enviar a gravação à ElevenLabs.</span>
        </label>
        <Button disabled={!loaded || busy || !apiKey.trim() || !name.trim() || !file || !consent} onClick={() => void run(async () => {
          if (!file || !consent) return
          const result = await createVoice(apiKey.trim(), name.trim(), file)
          setVoiceId(result.voiceId)
          setConsent(false)
          await save(result.voiceId)
          setNotice(result.requiresVerification ? 'Voz criada. Conclua a verificação na ElevenLabs para usar.' : 'Voz criada e salva. Use Ouvir teste para conferir.')
        })}>Criar e salvar voz</Button>
      </details>
    </>}
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" disabled={!loaded || busy} onClick={() => void run(() => speakVoice(testPhrase, account, userId))}>Ouvir teste</Button>
    </div>
    {notice && <p role="status" className="text-sm">{notice}</p>}
  </section>
}
