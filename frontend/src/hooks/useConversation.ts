import { useCallback, useEffect, useRef, useState } from 'react'
import { CONVERSATION_CHANNEL, clearConversation, loadConversation, saveConversationMessages, type ChatMessage } from '../lib/conversation-store'

type Input = Omit<ChatMessage, 'id'> & { id?: string }
export function useConversation(account: string | undefined, intro: ChatMessage) {
  const [messages, render] = useState<ChatMessage[]>([intro])
  const [ready, setReady] = useState(false)
  const [loadedAccount, setLoadedAccount] = useState('')
  const [sessionEpoch, setSessionEpoch] = useState('')
  const [storageError, setStorageError] = useState('')
  const current = useRef({ account: '', epoch: '', messages: [intro] })
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  useEffect(() => {
    let active = true
    setReady(false); render([intro]); setStorageError('')
    current.current = { account: account || '', epoch: '', messages: [intro] }
    const refresh = async () => {
      if (!account) return
      try {
        await queue.current
        const before = current.current
        const loaded = await loadConversation(account)
        if (!active || current.current !== before) return
        current.current = { account, epoch: loaded.epoch, messages: [intro, ...loaded.messages] }
        render(current.current.messages); setSessionEpoch(loaded.epoch); setLoadedAccount(account); setReady(true)
      } catch { if (active) { setReady(false); setStorageError('Não consegui recuperar a conversa. Reabra o painel; não vou substituir o histórico salvo.') } }
    }
    const visible = () => { if (!document.hidden) void refresh() }
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CONVERSATION_CHANNEL)
    if (channel) channel.onmessage = event => { if (event.data === account) void refresh() }
    void refresh()
    window.addEventListener('focus', visible)
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; channel?.close(); window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible) }
  }, [account, intro])
  const setMessages = useCallback((update: (messages: ChatMessage[]) => Input[]) => {
    const snapshot = current.current
    if (!account || snapshot.account !== account || !snapshot.epoch || snapshot.epoch !== sessionEpoch) return Promise.reject(Error('Aguarde a conversa ser recuperada.'))
    const next = update(snapshot.messages).map(m => ({ ...m, id: m.id ?? crypto.randomUUID() }))
    const changed = next.filter(m => m.id !== 'intro' && JSON.stringify(m) !== JSON.stringify(snapshot.messages.find(old => old.id === m.id)))
    current.current = { ...snapshot, messages: next }
    render(next)
    const saving = queue.current.catch(() => {}).then(() => saveConversationMessages(snapshot.account, snapshot.epoch, changed))
    queue.current = saving.catch(() => { setStorageError('Não foi possível salvar esta etapa. Não feche o painel; confira o armazenamento do aparelho.') })
    return saving
  }, [account, sessionEpoch])
  const clear = useCallback(async () => {
    if (!account) return
    await queue.current
    const epoch = await clearConversation(account)
    if (current.current.account !== account) return
    current.current = { account, epoch, messages: [intro] }
    render([intro]); setSessionEpoch(epoch); setStorageError('')
  }, [account, intro])
  return { messages: loadedAccount === account ? messages : [intro], setMessages, clear, ready: ready && loadedAccount === account, storageError }
}
