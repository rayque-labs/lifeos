import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Minus, X } from 'lucide-react'
import './FloatingAssistant.css'

const Chat = lazy(() => import('../pages/AssistantChatPage').then(module => ({ default: module.AssistantChatPage })))
const size = 54
const margin = 10
type Position = { x: number; y: number }
const bound = ({ x, y }: Position): Position => ({
  x: Math.max(margin, Math.min(x, window.innerWidth - size - margin)),
  y: Math.max(margin, Math.min(y, window.innerHeight - size - margin)),
})

export function FloatingAssistant({ request, onClose }: { request: number; onClose: () => void }) {
  const [dismissedRequest, setDismissedRequest] = useState<number | null>(null)
  const expanded = dismissedRequest !== request
  const [position, setPosition] = useState(() => bound({ x: 14, y: window.innerHeight - 160 }))
  const belowBubble = position.y < window.innerHeight / 2
  const panelAnchor = belowBubble
    ? { top: position.y + size + 8, maxHeight: `calc(100dvh - ${position.y + size + 18}px)` }
    : { bottom: `calc(100dvh - ${position.y - 8}px)`, maxHeight: position.y - 18 }
  const drag = useRef<{ pointer: number; x: number; y: number; origin: Position; moved: boolean } | null>(null)
  const toggleButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const resize = () => setPosition(bound)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const start = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !event.isPrimary) return
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, origin: position, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.moved && Math.hypot(dx, dy) < 6) return
    current.moved = true
    setPosition(bound({ x: current.origin.x + dx, y: current.origin.y + dy }))
  }
  const collapse = () => {
    setDismissedRequest(request)
    toggleButton.current?.focus()
  }

  return <>
    <button ref={toggleButton} type="button" className="assistant-bubble"
      style={{ left: position.x, top: position.y }} aria-expanded={expanded} aria-controls="floating-conversation"
      aria-label={expanded ? 'Recolher conversa do assistente' : 'Abrir conversa do assistente'}
      onPointerDown={start} onPointerMove={move} onPointerCancel={() => { drag.current = null }}
      onClick={event => {
        const moved = event.detail !== 0 && drag.current?.moved
        drag.current = null
        if (!moved) setDismissedRequest(expanded ? request : null)
      }}><Bot size={28} strokeWidth={1.8} /></button>
    <div id="floating-conversation" className="assistant-popover" role="region" aria-label="Conversa com o LifeOS" hidden={!expanded}
      style={{ ...panelAnchor, left: `clamp(10px, ${position.x}px, calc(100vw - var(--assistant-width) - 10px))` }}
      onKeyDown={event => { if (event.key === 'Escape') collapse() }}>
      <div className="assistant-popover-bar">
        <Bot size={20} /><strong>Assistente LifeOS</strong>
        <Link to="/assistant" onClick={collapse}>Configurar IA</Link>
        <button type="button" onClick={collapse} aria-label="Recolher conversa"><Minus size={18} /></button>
        <button type="button" onClick={onClose} aria-label="Encerrar conversa"><X size={19} /></button>
      </div>
      <Suspense fallback={<p className="p-3" role="status">Abrindo o assistente…</p>}><Chat floating /></Suspense>
    </div>
  </>
}
