export type SuggestionFeedback = 'useful' | 'not_now' | 'not_useful'
export type FeedbackRecord = { suggestionId: string; kind: string; response: SuggestionFeedback; recordedAt: number }
const prefix = 'lifeos:agent:feedback:v1:'
const storageKey = (userId: number | string) => prefix + userId
export function readSuggestionFeedback(userId: number | string): FeedbackRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is FeedbackRecord => !!item && typeof item === 'object' && typeof item.suggestionId === 'string' && ['useful','not_now','not_useful'].includes(item.response) && typeof item.recordedAt === 'number').slice(-100)
  } catch { return [] }
}
export function recordSuggestionFeedback(userId: number | string, record: FeedbackRecord): void {
  const records = readSuggestionFeedback(userId)
  localStorage.setItem(storageKey(userId), JSON.stringify([...records, record].slice(-100)))
}
export function clearSuggestionFeedback(userId: number | string): void {
  localStorage.removeItem(storageKey(userId))
}
export function feedbackCooldownMs(userId: number | string): number {
  const last = readSuggestionFeedback(userId).filter(item => item.kind === 'wellbeing').slice(-3)
  if (last.some(item => item.response === 'not_useful')) return 24 * 60 * 60 * 1000
  if (last.some(item => item.response === 'not_now')) return 12 * 60 * 60 * 1000
  return 6 * 60 * 60 * 1000
}
export function allowedSuggestionHour(date = new Date()): boolean {
  const hour = date.getHours()
  return hour >= 8 && hour < 22
}
