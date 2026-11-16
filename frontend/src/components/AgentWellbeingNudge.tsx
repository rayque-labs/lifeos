import { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { screenTimeSuggestion, usageAvailable } from '../lib/agent-usage'
import { loadAgentPreferences } from '../lib/agent-permissions'

const COOLDOWN_MS = 6 * 60 * 60 * 1000
const CHECK_MS = 15 * 60 * 1000
const key = (id: number | string) => 'lifeos:agent:wellbeing:last:' + id

/** Foreground-only, opt-in suggestion. Never polls private data or runs in the background. */
export function AgentWellbeingNudge() {
  const { user } = useAuth()
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!user?.id || !usageAvailable()) return
    let disposed = false
    let checking = false
    const check = async () => {
      if (disposed || checking || document.visibilityState !== 'visible') return
      const prefs = loadAgentPreferences(user.id)
      if (!prefs.screenBreaks) return
      const last = Number(localStorage.getItem(key(user.id)) || 0)
      if (Date.now() - last < COOLDOWN_MS) return
      checking = true
      try {
        const { suggestion } = await screenTimeSuggestion(user.id)
        if (!disposed && suggestion) {
          localStorage.setItem(key(user.id), String(Date.now()))
          setMessage(suggestion.message)
        }
      } catch {
        // No Android permission, or no usage service: do not interrupt or ask repeatedly.
      } finally { checking = false }
    }
    void check()
    const interval = window.setInterval(() => { void check() }, CHECK_MS)
    document.addEventListener('visibilitychange', check)
    return () => { disposed = true; window.clearInterval(interval); document.removeEventListener('visibilitychange', check) }
  }, [user?.id])
  if (!message) return null
  return <section role="status" aria-live="polite" className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-[#C5FF4A]/40 bg-[#202322] p-4 text-[#f5f5f5] sm:mx-7">
    <Sparkles className="mt-0.5 shrink-0 text-[#C5FF4A]" size={20} />
    <div className="min-w-0 flex-1"><strong className="block text-sm">Uma sugestão do seu agente</strong><p className="mt-1 text-sm leading-6 text-[#d7d7d7]">{message}</p></div>
    <button type="button" aria-label="Dispensar sugestão" onClick={() => setMessage('')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#d7d7d7] hover:bg-white/10"><X size={20} /></button>
  </section>
}
