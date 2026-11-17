import { loadAIConfig } from './lib/ai-credentials'
import { generateAIReply } from './lib/ai-providers'
import { loadConversation, saveConversationMessages, conversationContext, type ChatMessage } from './lib/conversation-store'
import { loadMemoryContext, executeMemoryCommand, parseMemoryCommand } from './lib/toph-memory'
import { researchWeb } from './lib/web-research'
import { EXECUTOR_PROMPT, validateDecision } from './lib/execution-schema'

declare global {
  interface Window {
    TophVoice: { ready(): void; reply(text: string, failed: boolean): void }
    tophVoiceTurn: (text: string) => Promise<void>
    tophVoiceCancel: () => void
  }
}
let running: AbortController | null = null
window.tophVoiceCancel = () => running?.abort()
window.tophVoiceTurn = async (text: string) => {
  if (running || !text.trim()) return
  const controller = new AbortController()
  running = controller
  const timeout = window.setTimeout(() => controller.abort(), 90000)
  let account = ''
  let epoch = ''
  const save = async (message: Omit<ChatMessage, 'id'>) => saveConversationMessages(account, epoch, [{ ...message, id: crypto.randomUUID() }])
  try {
    if (import.meta.env.VITE_OFFLINE_MODE !== 'true') throw Error('Abra o painel para conversar na versão conectada ao servidor.')
    const profile = JSON.parse(localStorage.getItem('lifeos:offline:v1:profile') || 'null')
    account = profile?.email || 'local@lifeos.invalid'
    const accountId = typeof profile?.id === 'number' ? profile.id : 1
    const session = await loadConversation(account)
    epoch = session.epoch
    const memory = parseMemoryCommand(text)
    await save({ role: 'user', text, local: !!memory })
    let answer: string
    let spoken: string
    let extra: Partial<ChatMessage> = {}
    if (memory) {
      answer = await executeMemoryCommand(memory, accountId)
      spoken = memory.kind === 'list' ? 'Sua memória está registrada no chat. Abra o painel para conferir.' : answer
      extra = { local: true, private: memory.kind === 'list' }
    } else {
      const config = await loadAIConfig()
      if (!config) throw Error('Salve uma configuração de IA no chat do LifeOS para conversar por voz.')
      const history = [...conversationContext(session.messages), { role: 'user' as const, text }]
      const context = await loadMemoryContext(accountId, text)
      const decision = validateDecision(await generateAIReply(config, history, controller.signal, context, EXECUTOR_PROMPT))
      if (controller.signal.aborted) throw Error('Conversa interrompida.')
      if (decision.action?.kind === 'web-search') {
        const result = await researchWeb(config, decision.action.query, controller.signal)
        answer = result.text; spoken = answer
        extra = { sources: result.sources, searchHtml: result.searchHtml, phase: 'result' }
      } else if (decision.action) {
        answer = decision.reply + '\nToque na Toph e peça a execução no painel para conferir a prévia. Nenhuma alteração foi feita por esta conversa de voz.'
        spoken = 'Esse pedido precisa do painel. Toque em mim para conferir e confirmar a execução.'
        extra = { phase: 'proposal', context: 'Foi sugerida uma ação por voz. Não foi executada; requer novo pedido no painel.' }
      } else { answer = decision.reply; spoken = answer }
    }
    if (controller.signal.aborted) throw Error('Conversa interrompida.')
    await save({ role: 'model', text: answer, ...extra })
    window.TophVoice.reply(spoken, false)
  } catch (error) {
    const message = controller.signal.aborted ? 'Pedido interrompido. Nenhuma nova execução será iniciada.' : error instanceof Error ? error.message : 'Não consegui responder agora.'
    if (account && epoch) await save({ role: 'model', text: message, local: true, phase: 'error' }).catch(() => {})
    window.TophVoice.reply(message, true)
  } finally { window.clearTimeout(timeout); running = null }
}
window.TophVoice.ready()
