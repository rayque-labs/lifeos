import { lazy, Suspense } from 'react'
import { Minus, X } from 'lucide-react'
import { nativeAssistant } from '../lib/native-assistant'
import './FloatingAssistant.css'

const Chat = lazy(() => import('../pages/AssistantChatPage').then(module => ({ default: module.AssistantChatPage })))

export function FloatingAssistant() {
  const close = (end: boolean) => { void nativeAssistant.closePanel({ end }) }
  return <div className="assistant-external">
    <button type="button" className="assistant-backdrop" aria-label="Voltar ao aplicativo anterior" onClick={() => close(false)} />
    <div className="assistant-popover" role="region" aria-label="Conversa com a Toph"
      onKeyDown={event => { if (event.key === 'Escape') close(false) }}>
      <div className="assistant-popover-bar">
        <span className="assistant-portrait" aria-hidden="true"><img src="/toph-artwork.jpg" alt="" /></span>
        <strong>Toph · LifeOS</strong>
        <button type="button" onClick={() => close(false)} aria-label="Recolher conversa"><Minus size={18} /></button>
        <button type="button" onClick={() => close(true)} aria-label="Encerrar Toph"><X size={19} /></button>
      </div>
      <Suspense fallback={<p className="p-3" role="status">Abrindo a Toph…</p>}><Chat floating /></Suspense>
    </div>
  </div>
}
