import { useEffect, useRef, useState } from 'react'
import { nativeAssistant } from '../lib/native-assistant'
import { loadAIConfig } from '../lib/ai-credentials'
import { generateAIReply } from '../lib/ai-providers'
import { SCREEN_PROMPT, SCREEN_STEP_LIMIT, screenPrompt, validateScreenStep, type ScreenSnapshot, type ScreenStep } from '../lib/screen-executor'

type Props = { initialGoal?: string; onClose: () => void; onJournal: (text: string) => Promise<void> }
export function ScreenExecutor({ initialGoal = '', onClose, onJournal }: Props) {
  const [goal, setGoal] = useState(initialGoal)
  const [screen, setScreen] = useState<ScreenSnapshot | null>(null)
  const [step, setStep] = useState<ScreenStep | null>(null)
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [trace, setTrace] = useState<string[]>([])
  const [count, setCount] = useState(0)
  const lock = useRef(false)
  const request = useRef<AbortController | null>(null)
  const active = useRef(true)
  const nativeRunning = useRef(false)
  useEffect(() => {
    active.current = true
    return () => { active.current = false; request.current?.abort(); void nativeAssistant.discardInterface().catch(() => {}) }
  }, [])
  const observe = async () => {
    if (lock.current) return
    lock.current = true; setError(''); setStep(null); setBusy('Lendo controles visíveis…')
    try {
      const observed = await nativeAssistant.observeInterface()
      if (active.current) setScreen(observed)
    } catch (e) { setScreen(null); setError(e instanceof Error ? e.message : 'Não consegui observar a tela.') }
    finally { lock.current = false; setBusy('') }
  }
  const propose = async () => {
    if (lock.current || !screen || !consent || count >= SCREEN_STEP_LIMIT) return
    lock.current = true; setError(''); setStep(null); setBusy('Planejando uma etapa com a tela observada…')
    const controller = new AbortController(); request.current = controller
    const timer = window.setTimeout(() => controller.abort(), 45000)
    try {
      const config = await loadAIConfig()
      if (!config) throw Error('Salve a configuração da sua IA no chat do LifeOS.')
      const raw = await generateAIReply(config, [{ role: 'user', text: screenPrompt(goal, screen, trace) }], controller.signal, [], SCREEN_PROMPT)
      if (!active.current || controller.signal.aborted) return
      const planned = validateScreenStep(raw, screen)
      await onJournal(`Execução na tela — objetivo: ${goal}\n${planned.status === 'action' ? 'Proposta ainda não executada' : planned.status === 'done' ? 'A IA sugere conferir a conclusão' : 'Etapa bloqueada'}: ${planned.reason}`)
      if (active.current) setStep(planned)
    } catch (e) { if (active.current) setError(controller.signal.aborted ? 'Planejamento interrompido. Nenhuma ação foi executada.' : e instanceof Error ? e.message : 'Não consegui planejar.') }
    finally { window.clearTimeout(timer); request.current = null; lock.current = false; if (active.current) setBusy('') }
  }
  const execute = async () => {
    if (lock.current || !screen || step?.status !== 'action' || count >= SCREEN_STEP_LIMIT) return
    lock.current = true; nativeRunning.current = true; setError(''); setBusy('Executando uma ação e conferindo a tela…')
    const chosen = step; const previous = screen; setStep(null); setScreen(null)
    try {
      const result = await nativeAssistant.executeInterfaceAction({ token: previous.token, target: chosen.target, action: chosen.action, text: chosen.text })
      const target = previous.elements.find(e => e.id === chosen.target)
      const description = `${chosen.action === 'type' ? 'Substituir texto' : chosen.action === 'click' ? 'Tocar' : 'Rolar'}: ${target?.label || chosen.target}`
      const detail = !result.accepted ? 'Ação não aceita.' : chosen.action === 'type' && !result.valueVerified ? 'A digitação foi aceita, mas não consegui confirmar o texto no campo. Confira antes de continuar.' : result.verificationError ? `A ação foi aceita, mas não foi possível conferir: ${result.verificationError}` : result.changed ? 'Ação aceita; a tela mudou. Isso ainda não comprova a conclusão do objetivo.' : 'Ação aceita, mas sem mudança visível. Não vou repetir automaticamente.'
      setCount(n => n + 1)
      setTrace(items => [...items, description + ' — ' + detail])
      await onJournal(description + '\n' + detail)
      if (active.current) { setScreen(result.after ?? null); if (!result.changed || result.verificationError) setError(detail) }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'A execução foi interrompida.'
      await onJournal('Execução na tela interrompida: ' + message).catch(() => {})
      if (active.current) setError(message)
    } finally { lock.current = false; nativeRunning.current = false; if (active.current) setBusy('') }
  }
  const target = step?.status === 'action' ? screen?.elements.find(e => e.id === step.target) : null
  return <section aria-label="Executor de tela" className="space-y-3 rounded-xl border border-[#C5FF4A] bg-[#191b1d] p-3">
    <div className="flex items-center justify-between"><strong>Executar na tela · passo {count}/{SCREEN_STEP_LIMIT}</strong><button type="button" disabled={!!busy} onClick={onClose}>Fechar</button></div>
    <p className="text-xs text-[#b5b7ba]">Abra o app desejado e depois a Toph. Este modo lê controles de acessibilidade; não é análise de imagens. Revise cada ação. Não preenche senhas nem confirma permissões do Android.</p>
    <label className="block text-sm">Objetivo<input aria-label="Objetivo na tela" value={goal} maxLength={500} disabled={!!busy || count > 0} onChange={e => { setGoal(e.target.value); setStep(null) }} placeholder="Ex.: procurar uma música no Spotify" className="mt-1 w-full rounded-lg bg-[#303236] p-2"/></label>
    <button type="button" disabled={!!busy} onClick={() => void nativeAssistant.openScreenControlSettings().catch(() => setError('Abra Acessibilidade nas configurações do Android.'))} className="text-sm underline">Ativar Toph · Execução assistida no Android</button>
    <button type="button" disabled={!!busy} onClick={() => void observe()} className="block rounded-lg border border-[#555B66] px-3 py-2">{screen ? 'Atualizar leitura da tela' : 'Ler controles da tela'}</button>
    {screen && <details className="text-xs"><summary>{screen.elements.length} elementos observados{screen.truncated ? ' · leitura parcial' : ''}</summary><ul className="mt-2 max-h-40 overflow-auto">{screen.elements.map(e => <li key={e.id}>{e.label} {e.edit ? '(campo)' : e.click ? '(botão)' : e.scroll ? '(rolagem)' : ''}</li>)}</ul></details>}
    <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={consent} disabled={!!busy} onChange={e => { setConsent(e.target.checked); setStep(null) }}/><span>Usar os textos e controles desta tela no provedor de IA que configurei. Confira o conteúdo acima antes de enviar.</span></label>
    <button type="button" disabled={!!busy || !screen || !consent || !goal.trim() || count >= SCREEN_STEP_LIMIT} onClick={() => void propose()} className="rounded-lg bg-[#C5FF4A] px-3 py-2 text-black disabled:opacity-40">Planejar próxima etapa</button>
    {step && <div className="space-y-2 rounded-lg bg-[#292c30] p-3"><p className="text-sm whitespace-pre-wrap">{step.reason}</p>{step.status === 'action' ? <><p className="text-sm">{step.action === 'click' ? 'Tocar' : step.action === 'type' ? 'Substituir texto em' : step.action === 'scroll-up' ? 'Rolar para cima em' : 'Rolar para baixo em'}: <strong>{target?.label}</strong></p>{step.action === 'type' && <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs">{step.text === '' ? '(esvaziar campo)' : step.text}</pre>}<p className="text-xs">Um toque pode enviar, publicar ou excluir se esse for o botão escolhido. Confira o alvo antes de confirmar.</p><button type="button" disabled={!!busy} onClick={() => void execute()} className="rounded-lg bg-[#C5FF4A] px-3 py-2 text-black">Confirmar esta ação</button><button type="button" disabled={!!busy} onClick={() => setStep(null)} className="ml-3">Descartar</button></> : <><p className="text-xs">{step.status === 'done' ? 'Conclusão sugerida pela IA; confira a evidência na tela.' : 'Sem execução.'}</p>{step.evidence.map(id => <p key={id} className="text-xs">Evidência: {screen?.elements.find(e => e.id === id)?.label}</p>)}</>}</div>}
    {trace.length > 0 && <details><summary className="text-sm">Etapas registradas ({trace.length})</summary><ol className="max-h-40 overflow-auto text-xs">{trace.map((item, i) => <li key={i}>{i + 1}. {item}</li>)}</ol></details>}
    {count >= SCREEN_STEP_LIMIT && <p className="text-xs">Limite de 8 ações atingido. Confira o resultado antes de iniciar outra sessão.</p>}
    {busy && <p role="status" className="text-sm">{busy}</p>}
    {busy && !nativeRunning.current && <button type="button" onClick={() => request.current?.abort()} className="text-sm underline">Cancelar planejamento</button>}
    {error && <p role="alert" className="text-sm text-[#ff8990]">{error}</p>}
  </section>
}
