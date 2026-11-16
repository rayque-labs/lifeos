import { get, post } from './api'
import { isAndroid, nativeAssistant } from './native-assistant'
import type { Task } from './types'

export type AssistantAction = { kind: 'create-task'; title: string } | { kind: 'list-tasks' }
export const taskChangedEvent = 'lifeos:tasks-changed'

export function parseAssistantAction(input: string): AssistantAction | null {
  const create = input.match(/^(?:criar?|adicionar?)\s+(?:uma\s+)?tarefa(?:\s*:\s*|\s+)(.+)$/i)
  if (create) return { kind: 'create-task', title: create[1].trim() }
  if (/^(?:listar?|mostrar?)\s+(?:(?:as|minhas)\s+)?tarefas[.!?]?$/i.test(input)) return { kind: 'list-tasks' }
  return null
}

export async function executeAssistantAction(action: AssistantAction) {
  if (action.kind === 'create-task') {
    if (!action.title || action.title.length > 150) throw new Error('Use um título de até 150 caracteres.')
    const saved = await post<Task>('/tasks/', { title: action.title })
    if (isAndroid) await nativeAssistant.markOverlayDataChanged().catch(() => {})
    window.dispatchEvent(new Event(taskChangedEvent))
    return `Criei a tarefa “${saved.title}”.`
  }
  const tasks = await get<Task[]>('/tasks/?sort_by=due_at')
  const pending = tasks.filter(task => !task.completed)
  if (!pending.length) return 'Você está sem tarefas em aberto.'
  const items = pending.slice(0, 5).map(task => `• ${task.title}`)
  return [`Tarefas em aberto (${pending.length}):`, ...items].join('\n')
}
