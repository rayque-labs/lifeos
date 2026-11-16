import { lazy, Suspense, useEffect, useState } from 'react'
import { Minus, X } from 'lucide-react'
import { nativeAssistant } from '../lib/native-assistant'
import './FloatingAssistant.css'

const Chat = lazy(() => import('../pages/AssistantChatPage').then(module => ({ default: module.AssistantChatPage })))

export function FloatingAssistant() {
  const [compact, setCompact] = useState(true)
  useEffect(() => { void nativeAssistant.setCompactVoice({ compact }).catch(() => {}) }, [compact])
  const close = (end: boolean) => { void nativeAssistant.closePanel({ end }) }
  return <div className={compact ? 'fixed inset-x-1 bottom-1 rounded-2xl border border-[#45454a] bg-[#151617] text-white' : 'assistant-external'}>
    {!compact && <button type="button" className="assistant-backdrop" aria-label="Voltar ao aplicativo anterior" onClick={() => close(false)} />}
    <div className={compact ? 'flex flex-col' : 'assistant-popover'} role="region" aria-label="Conversa com a Toph"
      onKeyDown={event => { if (event.key === 'Escape') close(false) }}>
      <div className={compact ? 'flex items-center gap-2 px-3 py-2' : 'assistant-popover-bar'}>
        <span className="assistant-portrait" aria-hidden="true"><img src="/toph-artwork.jpg" alt="" /></span>
        <strong>Toph · LifeOS</strong>
        {compact
          ? <button type="button" className="ml-auto text-sm underline" onClick={() => setCompact(false)}>Chat</button>
          : <button type="button" onClick={() => setCompact(true)} aria-label="Voltar à conversa por voz"><Minus size={18} /></button>}
        <button type="button" onClick={() => close(!compact)} aria-label="Encerrar conversa"><X size={19} /></button>
      </div>
      <Suspense fallback={<p className="p-3" role="status">Abrindo a Toph…</p>}><Chat floating compactVoice={compact} /></Suspense>
    </div>
  </div>
}
