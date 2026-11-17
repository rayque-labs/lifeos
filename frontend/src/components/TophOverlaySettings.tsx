import { useEffect, useState } from 'react'
import { isAndroid, nativeAssistant } from '../lib/native-assistant'
import { Button, Card } from './ui'

export function TophOverlaySettings() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof nativeAssistant.getOverlayStatus>> | null>(null)
  const [controlEnabled, setControlEnabled] = useState(false)
  const [voice, setVoice] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!isAndroid) return
    const refresh = () => { void nativeAssistant.getOverlayStatus().then(setStatus).catch(() => {}); void nativeAssistant.getScreenControlStatus().then(s => setControlEnabled(s.enabled)).catch(() => {}) }
    refresh()
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  if (!isAndroid) return null

  const configure = async () => {
    setBusy(true)
    setNotice('')
    try {
      await nativeAssistant.openSettings()
      setStatus(await nativeAssistant.getOverlayStatus())
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Não foi possível abrir as configurações do Android.')
    } finally {
      setBusy(false)
    }
  }

  const toggle = async () => {
    setBusy(true)
    setNotice('')
    try {
      const { state } = await nativeAssistant.toggleOverlay({ voice })
      const current = await nativeAssistant.getOverlayStatus()
      setStatus({ ...current, running: state === 'started' })
      setNotice(state === 'started' ? (voice ? 'Saia do LifeOS: a Toph saúda e ouve sem abrir a janela. Segure o bonequinho para pausar ou retomar.' : 'Saia do LifeOS para ver a Toph. Toque nela para conversar.') :
        state === 'stopped' ? 'Toph flutuante encerrada.' : 'Autorize Aparecer sobre outros apps para o LifeOS.')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Não foi possível iniciar a Toph flutuante.')
    } finally {
      setBusy(false)
    }
  }

  return <div id="toph-flutuante" className="mb-4 scroll-mt-20">
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">Toph flutuante</h2>
        <p className="text-sm opacity-75">{status?.running ? 'Ativa sobre outros apps.' :
          status && !status.defaultAssistant ? 'Selecione o LifeOS como assistente padrão para ativar a Toph.' :
          'A Toph aparece sobre outros apps. Toque nela para conversar por voz.'}</p>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={voice} disabled={!!status?.running} onChange={e => setVoice(e.target.checked)} />Conversar sem abrir janela</label>
      <p className="text-xs opacity-70">Usa o microfone após ativar e sair do LifeOS. Notificação permite pausar e encerrar. Pausa ao bloquear a tela ou após silêncio. A voz do bonequinho usa a síntese pt-BR do Android; reconhecimento pode usar internet.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => void toggle()}>{status?.running ? 'Encerrar Toph flutuante' : 'Ativar Toph flutuante'}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => void configure()}>Assistente padrão do Android</Button>
      </div>
      <div className="space-y-2 border-t border-[#45454a] pt-3"><h3 className="font-semibold">Execução assistida na tela</h3><p className="text-sm opacity-75">{controlEnabled ? 'Serviço ativado no Android.' : 'Ativação manual necessária em Acessibilidade.'} Identifica controles e permite tocar, digitar e rolar após você revisar cada ação.</p><p className="text-xs opacity-70">A leitura só acontece quando solicitada. Para planejar com IA, o painel pede autorização para enviar o texto observado ao seu provedor. Você pode desativar o serviço a qualquer momento.</p><Button variant="secondary" onClick={() => void nativeAssistant.openScreenControlSettings().catch(() => setNotice('Abra Acessibilidade nas configurações do Android.'))}>Configurar execução assistida</Button></div>
      {notice && <p role="status" className="text-sm">{notice}</p>}
    </Card>
  </div>
}
