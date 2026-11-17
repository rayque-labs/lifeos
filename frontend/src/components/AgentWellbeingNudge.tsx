import { useEffect, useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { allowedSuggestionHour, feedbackCooldownMs, recordSuggestionFeedback } from '../lib/agent-feedback'
import { useAuth } from '../lib/auth'
import { screenTimeSuggestion, usageAvailable } from '../lib/agent-usage'
import { loadAgentPreferences } from '../lib/agent-permissions'

const CHECK_MS = 15 * 60 * 1000
const key = (id: number | string) => 'lifeos:agent:wellbeing:last:' + id

/** Foreground-only, opt-in suggestion. Never polls private data or runs in the background. */
export function AgentWellbeingNudge() {
  const { user } = useAuth()
  const [suggestion, setSuggestion] = useState<{ id: string; message: string } | null>(null)
  const respond = (response: 'useful' | 'not_now' | 'not_useful') => {
    if (!user?.id || !suggestion) return
    recordSuggestionFeedback(user.id, { suggestionId: suggestion.id, kind: 'wellbeing', response, recordedAt: Date.now() })
    setSuggestion(null)
  }
  useEffect(() => {
    if (!user?.id || !usageAvailable()) return
    let disposed = false
    let checking = false
    const check = async () => {
      if (disposed || checking || document.visibilityState !== 'visible' || !allowedSuggestionHour()) return
      const prefs = loadAgentPreferences(user.id)
      if (!prefs.screenBreaks) return
      const last = Number(localStorage.getItem(key(user.id)) || 0)
      if (Date.now() - last < feedbackCooldownMs(user.id)) return
      checking = true
      try {
        const { suggestion } = await screenTimeSuggestion(user.id)
        if (!disposed && suggestion) {
          localStorage.setItem(key(user.id), String(Date.now()))
          setSuggestion({ id: suggestion.id, message: suggestion.message })
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
  if (!suggestion) return null
  return <section role="status" aria-live="polite" className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-[#C5FF4A]/40 bg-[#202322] p-4 text-[#f5f5f5] sm:mx-7">
    <Sparkles className="mt-0.5 shrink-0 text-[#C5FF4A]" size={20} />
    <div className="min-w-0 flex-1"><strong className="block text-sm">Uma sugestão do seu agente</strong><p className="mt-1 text-sm leading-6 text-[#d7d7d7]">{suggestion.message}</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => respond('useful')} className="min-h-11 rounded-xl bg-[#C5FF4A] px-3 text-sm font-semibold text-[#101010]">Boa ideia</button><button type="button" onClick={() => respond('not_now')} className="min-h-11 rounded-xl border border-white/20 px-3 text-sm">Agora não</button><button type="button" onClick={() => respond('not_useful')} className="min-h-11 rounded-xl border border-white/20 px-3 text-sm">Não é útil</button></div></div>
    <button type="button" aria-label="Dispensar sugestão" onClick={() => respond('not_now')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#d7d7d7] hover:bg-white/10"><X size={20} /></button>
  </section>
}
