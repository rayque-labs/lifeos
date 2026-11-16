import { useEffect } from 'react'
import './MonolithSplash.css'

export function MonolithSplash({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Fallback if the opening animation is interrupted before animationend.
    const timer = window.setTimeout(onComplete, reduceMotion ? 160 : 2450)
    return () => window.clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="monolith-splash" role="status" aria-label="Iniciando LifeOS"
      onAnimationEnd={event => { if (event.target === event.currentTarget) onComplete() }}>
      <div className="monolith-splash__center" aria-hidden="true">
        <div className="monolith-splash__mark">
          <img src="/lifeos-brand.jpg" alt="" width="1536" height="1536" fetchPriority="high" />
        </div>
        <div className="monolith-splash__name">Life<span>OS</span></div>
      </div>
    </div>
  )
}
