import { useEffect, useState } from 'react'
import { deleteLocalVoice, loadLocalVoice, saveLocalVoice } from '../lib/agent-voice'
import { Button, Field, Input } from './ui'

export function LocalVoiceSettings({ account, disabled, run }: {
  account: string
  disabled: boolean
  run: (action: () => Promise<void>) => Promise<void>
}) {
  const [endpoint, setEndpoint] = useState('')
  const [token, setToken] = useState('')
  const [sample, setSample] = useState<File | null>(null)
  const [filename, setFilename] = useState('')
  const [allowed, setAllowed] = useState(false)
  const [status, setStatus] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    loadLocalVoice(account).then(config => {
      if (active && config) { setEndpoint(config.endpoint); setToken(config.token); setFilename(config.filename) }
    }).catch(() => { if (active) setStatus('Não foi possível ler a gravação salva.') })
      .finally(() => { if (active) setLoaded(true) })
    return () => { active = false }
  }, [account])

  return <div className="space-y-3">
    <p className="text-sm opacity-75">A Toph usa uma gravação WAV de 3 a 30 segundos e gera a fala no seu servidor LifeOS.</p>
    <Field label="Endereço do clonador">
      <Input value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://voz.seu-dominio.com" type="url" disabled={disabled} />
    </Field>
    <Field label="Token do servidor">
      <Input value={token} onChange={event => setToken(event.target.value)} autoComplete="off" type="password" disabled={disabled} />
    </Field>
    <Field label="Gravação WAV (até 10 MB)">
      <input type="file" accept=".wav,audio/wav" className="block w-full text-sm" disabled={disabled} onChange={event => {
        setSample(event.target.files?.[0] ?? null)
        setAllowed(false)
        setStatus('')
        event.target.value = ''
      }} />
    </Field>
    {filename && <p className="text-sm">Gravação salva: {filename}</p>}
    {sample && <label className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-1" checked={allowed} disabled={disabled} onChange={event => setAllowed(event.target.checked)} />
      <span>Tenho autorização para usar esta voz e enviar a gravação ao meu servidor LifeOS.</span>
    </label>}
    <div className="flex flex-wrap gap-2">
      <Button disabled={disabled || !loaded || !endpoint.trim() || !sample || !allowed} onClick={() => void run(async () => {
        if (!sample || !allowed) return
        await saveLocalVoice(account, { endpoint, token, file: sample })
        setFilename(sample.name)
        setSample(null)
        setAllowed(false)
        setStatus('Gravação salva. Toque em Ouvir teste para gerar a primeira fala.')
      })}>Salvar gravação</Button>
      {filename && <Button variant="secondary" disabled={disabled || !loaded} onClick={() => void run(async () => {
        await deleteLocalVoice(account)
        setFilename('')
        setToken('')
        setStatus('Gravação removida deste aparelho.')
      })}>Remover gravação</Button>}
    </div>
    {status && <p role="status" className="text-sm">{status}</p>}
  </div>
}
