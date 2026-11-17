import type { AgentPreferences } from './agent-permissions'
export type PerceptionEvent =
  | { kind: 'screen_usage'; minutes: number; observedAt: number }
  | { kind: 'upcoming_event'; title: string; minutesUntil: number; observedAt: number }
  | { kind: 'draft'; text: string; recipientName?: string; observedAt: number }
  | { kind: 'message_notification'; observedAt: number; source: string }
  | { kind: 'financial_summary'; observedAt: number }
export type AgentSuggestion = { id: string; kind: 'wellbeing' | 'planning'; title: string; message: string; observedAt: number; requiresApproval: boolean }
export function perceive(event: PerceptionEvent, preferences: AgentPreferences): AgentSuggestion | null {
  if (event.kind === 'screen_usage' && preferences.screenBreaks && Number.isFinite(event.minutes) && event.minutes >= 90)
    return { id: 'screen-break-' + Math.floor(event.observedAt / 3600000), kind: 'wellbeing', title: 'Que tal uma pausa?', message: 'Você já passou um bom tempo no celular. Quer descansar os olhos, beber água ou caminhar um pouco?', observedAt: event.observedAt, requiresApproval: false }
  if (event.kind === 'upcoming_event' && event.minutesUntil >= 0 && event.minutesUntil <= 60)
    return { id: 'event-' + event.observedAt, kind: 'planning', title: 'Compromisso chegando', message: 'Seu compromisso "' + event.title.slice(0, 100) + '" está próximo. Quer organizar o que falta?', observedAt: event.observedAt, requiresApproval: false }
  // Sensitive sources have no reader yet. Never infer deleted messages or inspect external drafts.
  return null
}
export type ProposedAction = { type: string; description: string; details: Record<string, string>; risk: 'low' | 'medium' | 'high' }
export type PendingApproval = ProposedAction & { approvalId: string; state: 'pending'; createdAt: number }
export function proposeAction(action: ProposedAction): PendingApproval {
  return { ...action, approvalId: crypto.randomUUID(), state: 'pending', createdAt: Date.now() }
}
// A proposed action is never an execution token; backend must enforce approval separately.
