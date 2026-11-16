export type AgentCapability = 'screenBreaks' | 'draftAnalysis' | 'messageNotifications' | 'financialAnalysis'
export type Initiative = 'discreta' | 'moderada' | 'ativa'
export type AgentPreferences = { initiative: Initiative; screenBreaks: boolean; draftAnalysis: boolean; messageNotifications: boolean; financialAnalysis: boolean }
export const DEFAULT_AGENT_PREFERENCES: AgentPreferences = {
  initiative: 'ativa', screenBreaks: true, draftAnalysis: true,
  messageNotifications: true, financialAnalysis: true,
}
const prefix = 'lifeos:agent:preferences:v1:'
const userKey = (id: number | string) => prefix + String(id)
export function loadAgentPreferences(userId: number | string): AgentPreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(userKey(userId)) || 'null')
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_AGENT_PREFERENCES }
    return {
      initiative: ['discreta','moderada','ativa'].includes(saved.initiative) ? saved.initiative : 'ativa',
      screenBreaks: saved.screenBreaks === true,
      draftAnalysis: saved.draftAnalysis === true,
      messageNotifications: saved.messageNotifications === true,
      financialAnalysis: saved.financialAnalysis === true,
    }
  } catch { return { ...DEFAULT_AGENT_PREFERENCES } }
}
export function saveAgentPreferences(userId: number | string, preferences: AgentPreferences) {
  localStorage.setItem(userKey(userId), JSON.stringify(preferences))
}
export type AgentPermission = { capability: AgentCapability; granted: boolean; source: 'app-preference'; deviceAuthorized: false }
export function getPermissionSnapshot(userId: number | string): AgentPermission[] {
  const prefs = loadAgentPreferences(userId)
  return (['screenBreaks','draftAnalysis','messageNotifications','financialAnalysis'] as const)
    .map(capability => ({ capability, granted: prefs[capability], source: 'app-preference' as const, deviceAuthorized: false as const }))
}
// Preferences express intent, NOT Android OS authorization or OAuth scopes.
export function canReadExternalSource(): false { return false }
