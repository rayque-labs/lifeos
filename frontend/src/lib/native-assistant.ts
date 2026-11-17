import { Capacitor, registerPlugin } from '@capacitor/core'

interface NativeAssistantPlugin {
  getPanelMode(): Promise<{ external: boolean }>
  getOverlayStatus(): Promise<{ defaultAssistant: boolean; allowed: boolean; running: boolean }>
  toggleOverlay(): Promise<{ state: 'started' | 'stopped' | 'permission' }>
  closePanel(options: { end: boolean }): Promise<void>
  markOverlayDataChanged(): Promise<void>
  openSettings(): Promise<void>
  inspectScreen(): Promise<{ summary: string }>
  openExternal(options: { url: string }): Promise<void>
  controlDevice(options: { action: 'open' | 'up' | 'down' | 'tap' | 'type' | 'click' | 'search' | 'profile'; app: string; text?: string; x?: number; y?: number }): Promise<{ fallback?: boolean }>
  listen(): Promise<{ text: string }>
  stopListening(): Promise<void>
  dictate(): Promise<{ text: string }>
  speak(options: { text: string; retro?: boolean; wait?: boolean }): Promise<void>
  stop(): Promise<void>
}

export const isAndroid = Capacitor.getPlatform() === 'android'
export const nativeAssistant = registerPlugin<NativeAssistantPlugin>('LifeOSAssistant')
