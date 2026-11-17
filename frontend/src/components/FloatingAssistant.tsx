import { lazy, Suspense, useRef, useState } from 'react'
import { Minus, X } from 'lucide-react'
import { nativeAssistant } from '../lib/native-assistant'
import './FloatingAssistant.css'

const Chat = lazy(() => import('../pages/AssistantChatPage').then(module => ({ default: module.AssistantChatPage })))

export function FloatingAssistant() {
  const panel = useRef<HTMLDivElement>(null)
  const drag = useRef<{ pointer: number; x: number; y: number; left: number; right: number; top: number; bottom: number; offsetX: number; offsetY: number } | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const close = (end: boolean) => { void nativeAssistant.closePanel({ end }) }
  return <div className="assistant-external">
    <button type="button" className="assistant-backdrop" aria-label="Voltar ao aplicativo anterior" onClick={() => close(false)} />
    <div ref={panel} className="assistant-popover" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} role="region" aria-label="Conversa com a Toph"
      onKeyDown={event => { if (event.key === 'Escape') close(false) }}>
      <div className="assistant-popover-bar touch-none"
        onPointerDown={event => {
          if (event.button !== 0 || (event.target instanceof Element && event.target.closest('button'))) return
          const bounds = panel.current?.getBoundingClientRect()
          if (!bounds) return
          drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY,
            left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
            offsetX: offset.x, offsetY: offset.y }
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={event => {
          const origin = drag.current
          if (!origin || origin.pointer !== event.pointerId) return
          setOffset({
            x: origin.offsetX + Math.max(-origin.left, Math.min(window.innerWidth - origin.right, event.clientX - origin.x)),
            y: origin.offsetY + Math.max(-origin.top, Math.min(window.innerHeight - origin.bottom, event.clientY - origin.y)),
          })
        }}
        onLostPointerCapture={() => { drag.current = null }}>
        <span className="assistant-portrait" aria-hidden="true"><img src="/toph-artwork.jpg" alt="" /></span>
        <strong>Toph · LifeOS</strong>
        <button type="button" onClick={() => close(false)} aria-label="Recolher conversa"><Minus size={18} /></button>
        <button type="button" onClick={() => close(true)} aria-label="Encerrar Toph"><X size={19} /></button>
      </div>
      <Suspense fallback={<p className="p-3" role="status">Abrindo a Toph…</p>}><Chat floating /></Suspense>
    </div>
  </div>
}
