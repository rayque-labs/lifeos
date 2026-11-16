import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

interface NativeAssistantPlugin {
  consumeLaunch(): Promise<{ active: boolean }>
  addListener(event: 'assistantInvoked', listener: () => void): Promise<PluginListenerHandle>
  openSettings(): Promise<void>
  dictate(): Promise<{ text: string }>
  speak(options: { text: string }): Promise<void>
  stop(): Promise<void>
}

export const isAndroid = Capacitor.getPlatform() === 'android'
export const nativeAssistant = registerPlugin<NativeAssistantPlugin>('LifeOSAssistant')
