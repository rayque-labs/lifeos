import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { FloatingAssistant } from './components/FloatingAssistant'
import { AuthProvider } from './lib/auth'
import { isAndroid, nativeAssistant } from './lib/native-assistant'
import { refreshOfflineStorage } from './lib/native-store'
import { taskChangedEvent } from './lib/assistant-actions'

async function start() {
  const external = isAndroid && (await nativeAssistant.getPanelMode().catch(() => null))?.external
  if (external) document.documentElement.classList.add('assistant-window')
  else if (isAndroid) window.addEventListener('lifeos:overlay-data-changed', () => {
    void refreshOfflineStorage().then(() => window.dispatchEvent(new Event(taskChangedEvent))).catch(console.error)
  })
  createRoot(document.getElementById('root')!).render(
    <StrictMode>{external ? <AuthProvider><FloatingAssistant /></AuthProvider> : <App />}</StrictMode>,
  )
}

void start()
