import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import type { CalendarEvent } from './types'

// Android local notifications are scheduled by the OS, even when the WebView is closed.
// Stable IDs allow edits/deletes to cancel the exact notifications previously scheduled.
const MAX_REMINDERS = 12
const notificationId = (eventId: number, slot: number) => eventId * 16 + slot + 1

export async function synchronizeEventNotifications(event: CalendarEvent | null, deletedId?: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const id = event?.id ?? deletedId
  if (!id || !Number.isSafeInteger(id) || id < 1 || id > 130000000) return
  const existing = Array.from({ length: MAX_REMINDERS }, (_, index) => ({ id: notificationId(id, index) }))
  await LocalNotifications.cancel({ notifications: existing })
  if (!event) return

  const offsets = [...new Set((event.reminders ?? [0]).filter(n => Number.isFinite(n) && n >= 0))]
    .slice(0, MAX_REMINDERS)
  const start = new Date(event.starts_at).getTime()
  const now = Date.now()
  const notifications = offsets.map((minutes, index) => ({
    id: notificationId(id, index),
    title: event.title,
    body: minutes === 0 ? 'Seu compromisso começa agora.' : `Compromisso em ${minutes} minuto(s).`,
    schedule: { at: new Date(start - minutes * 60000), allowWhileIdle: true },
    extra: { eventId: id, fullScreenRequested: Boolean(event.full_screen_alert), ringtone: event.ringtone || 'classic' },
  })).filter(item => item.schedule.at.getTime() > now)
  if (!notifications.length) return

  const permission = await LocalNotifications.checkPermissions()
  const result = permission.display === 'granted' ? permission : await LocalNotifications.requestPermissions()
  if (result.display !== 'granted') throw new Error('Autorize notificações nas configurações do Android para receber os lembretes.')
  await LocalNotifications.schedule({ notifications })
}
