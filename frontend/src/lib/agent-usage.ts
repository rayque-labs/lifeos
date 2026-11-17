import { perceive, type AgentSuggestion } from './agent-perception'
import { loadAgentPreferences } from './agent-permissions'

type UsageBridge = {
  status(): Promise<{ authorized: boolean }>
  openSettings(): Promise<void>
  getTodayUsage(): Promise<{ minutes: number; observedAt: number }>
}
const usagePlugin = (): UsageBridge | null => {
  const host = window as Window & { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { LifeOSUsage?: UsageBridge } } }
  return host.Capacitor?.Plugins?.LifeOSUsage ?? null
}
export const usageAvailable = () => usagePlugin() !== null
export async function usagePermissionStatus(): Promise<boolean> {
  if (!usageAvailable()) return false
  const usage = usagePlugin()
  return usage ? (await usage.status()).authorized : false
}
export async function openUsageAccessSettings(): Promise<void> {
  if (!usageAvailable()) throw new Error('Disponível apenas no Android.')
  await usagePlugin()!.openSettings()
}
export async function screenTimeSuggestion(userId: number | string): Promise<{ minutes: number; suggestion: AgentSuggestion | null }> {
  if (!usageAvailable() || !await usagePermissionStatus()) throw new Error('Autorize o acesso de uso no Android.')
  const { minutes, observedAt } = await usagePlugin()!.getTodayUsage()
  return { minutes, suggestion: perceive({ kind: 'screen_usage', minutes, observedAt }, loadAgentPreferences(userId)) }
}
