import { useEffect, useState } from 'react'
import './MonolithSplash.css'

/** Intro visual only. The native Android splash should remain instantaneous. */
export function MonolithSplash({ onComplete }: { onComplete: () => void }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(onComplete, reduceMotion ? 150 : 5000)
    return () => window.clearTimeout(timer)
  }, [onComplete])
  return (
    <div className="monolith-splash" role="status" aria-label="Iniciando LifeOS">
      <div className="monolith-splash__center">
        <div className="monolith-splash__float">
          <img src="/lifeos-original.png" alt="" onLoad={() => setReady(true)} onError={onComplete} className={ready ? 'monolith-splash__symbol is-ready' : 'monolith-splash__symbol'} />
        </div>
        <div className="monolith-splash__name" aria-hidden="true">Life<span>OS</span></div>
        <div className="monolith-splash__tag" aria-hidden="true">SEU SISTEMA DE VIDA</div>
      </div>
      <div className="monolith-splash__line" aria-hidden="true"><i /></div>
    </div>
  )
}
