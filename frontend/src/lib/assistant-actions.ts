import { get, post } from './api'
import { isAndroid, nativeAssistant } from './native-assistant'
import { bankSnapshot, loadConnection } from './mobile-integrations'
import type { Task } from './types'

type DeviceControl = Parameters<typeof nativeAssistant.controlDevice>[0]
export type AssistantAction = { kind: 'create-task'; title: string } | { kind: 'list-tasks' } | { kind: 'device'; control: DeviceControl } | { kind: 'bank-balances' }
const apps = 'whatsapp|chrome|agenda|calculadora|keep'
const openApp = new RegExp(`^abr(?:ir|a) (?:o |a )?(${apps})[.!]?$`, 'i')
const scrollApp = new RegExp(`^rola(?:r)?(?: para)? (cima|baixo) n[oa] (${apps})[.!]?$`, 'i')
const typeApp = new RegExp(`^digit(?:ar|e) (.+) n[oa] (${apps})[.!]?$`, 'i')
const tapApp = new RegExp(`^toc(?:ar|a|e) (\\d{1,3})%[ ,]+(\\d{1,3})% n[oa] (${apps})[.!]?$`, 'i')
export const taskChangedEvent = 'lifeos:tasks-changed'

export function parseAssistantAction(input: string): AssistantAction | null {
  const create = input.match(/^(?:criar?|adicionar?)\s+(?:uma\s+)?tarefa(?:\s*:\s*|\s+)(.+)$/i)
  if (create) return { kind: 'create-task', title: create[1].trim() }
  if (/^(?:listar?|mostrar?)\s+(?:(?:as|minhas)\s+)?tarefas[.!?]?$/i.test(input)) return { kind: 'list-tasks' }
  if (/^(?:consultar|mostrar) (?:os )?saldos bancários[.!?]?$/i.test(input)) return { kind: 'bank-balances' }
  const open = input.match(openApp)
  if (open) return { kind: 'device', control: { action: 'open', app: open[1].toLowerCase() } }
  const scroll = input.match(scrollApp)
  if (scroll) return { kind: 'device', control: { action: scroll[1].toLowerCase() === 'cima' ? 'up' : 'down', app: scroll[2].toLowerCase() } }
  const type = input.match(typeApp)
  if (type) return { kind: 'device', control: { action: 'type', text: type[1], app: type[2].toLowerCase() } }
  const tap = input.match(tapApp)
  if (tap) return { kind: 'device', control: { action: 'tap', x: Number(tap[1]), y: Number(tap[2]), app: tap[3].toLowerCase() } }
  return null
}

export async function executeAssistantAction(action: AssistantAction, user?: string) {
  if (action.kind === 'device') {
    if (!isAndroid) throw new Error('Este comando está disponível no app Android.')
    await nativeAssistant.controlDevice(action.control)
    return action.control.action === 'open' ? 'Abri o aplicativo.' : 'Comando encaminhado ao Android.'
  }
  if (action.kind === 'bank-balances') {
    const config = user && await loadConnection('open-finance', user)
    if (!config) throw new Error('Salve uma conexão Open Finance em Configurações → Integrações.')
    const snapshot = await bankSnapshot(config)
    return snapshot.accounts.map(account => {
      const amount = account.balance === null ? 'saldo indisponível' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: account.currency }).format(account.balance)
      return `• ${account.name}: ${amount}`
    }).join('\n') || 'Sem contas disponíveis.'
  }

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
