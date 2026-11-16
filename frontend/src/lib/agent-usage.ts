import { Capacitor, registerPlugin } from '@capacitor/core'
import { perceive, type AgentSuggestion } from './agent-perception'
import { loadAgentPreferences } from './agent-permissions'

type UsageBridge = {
  status(): Promise<{ authorized: boolean }>
  openSettings(): Promise<void>
  getTodayUsage(): Promise<{ minutes: number; observedAt: number }>
}
const usage = registerPlugin<UsageBridge>('LifeOSUsage')
export const usageAvailable = () => Capacitor.isNativePlatform()
export async function usagePermissionStatus(): Promise<boolean> {
  if (!usageAvailable()) return false
  return (await usage.status()).authorized
}
export async function openUsageAccessSettings(): Promise<void> {
  if (!usageAvailable()) throw new Error('Disponível apenas no Android.')
  await usage.openSettings()
}
export async function screenTimeSuggestion(userId: number | string): Promise<{ minutes: number; suggestion: AgentSuggestion | null }> {
  if (!usageAvailable() || !await usagePermissionStatus()) throw new Error('Autorize o acesso de uso no Android.')
  const { minutes, observedAt } = await usage.getTodayUsage()
  return { minutes, suggestion: perceive({ kind: 'screen_usage', minutes, observedAt }, loadAgentPreferences(userId)) }
}
