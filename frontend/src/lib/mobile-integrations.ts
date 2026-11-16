import { deleteEncrypted, loadEncrypted, saveEncrypted } from './ai-credentials'
import { isAndroid, nativeAssistant } from './native-assistant'

type ConnectionKind = 'whatsapp' | 'open-finance'
export type Connection = { url: string; token: string; instance?: string }
export type FinanceSnapshot = {
  accounts: Array<{ id: string; name: string; balance: number | null; currency: string }>
  transactions: Array<{ id: string; description: string; amount: number; currency: string; date: string }>
}

function integrationKeys(kind: ConnectionKind, user: string) {
  return [`integration:${kind}:${user}`, `integration-key:${kind}:${user}`] as const
}

export function loadConnection(kind: ConnectionKind, user: string) {
  return loadEncrypted<Connection>(...integrationKeys(kind, user))
}

export function removeConnection(kind: ConnectionKind, user: string) {
  return deleteEncrypted(...integrationKeys(kind, user))
}

export async function storeConnection(kind: ConnectionKind, user: string, config: Connection) {
  const normalized = normalizeConnection(config, kind === 'whatsapp')
  await saveEncrypted(...integrationKeys(kind, user), normalized)
  return normalized
}

function normalizeConnection(config: Connection, instanceRequired: boolean): Connection {
  let url: URL
  try { url = new URL(config.url.trim()) } catch { throw new Error('Informe um endereço HTTPS válido.') }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Informe a URL base HTTPS do seu servidor.')
  }
  if (!config.token.trim()) throw new Error('Informe a chave ou token do servidor.')
  if (instanceRequired && !config.instance?.trim()) throw new Error('Informe a instância existente da Evolution.')
  return { url: url.href.replace(/\/+$/, ''), token: config.token.trim(), instance: config.instance?.trim() }
}

async function getJson<T>(url: string, headers: Record<string, string>, body?: object): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(url, { headers, method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined, signal: controller.signal, redirect: 'error', cache: 'no-store' })
    if (response.status === 401 || response.status === 403) throw new Error('Chave inválida ou acesso não autorizado pelo servidor.')
    if (response.status === 404) throw new Error('Rota ou instância não encontrada no servidor.')
    if (!response.ok) throw new Error(`O servidor retornou um erro (${response.status}).`)
    return await response.json() as T
  } catch (error) {
    if (error instanceof TypeError || controller.signal.aborted) {
      throw new Error('Não foi possível alcançar o servidor. Confira o HTTPS, a rede e a origem permitida.')
    }
    throw error
  } finally { window.clearTimeout(timeout) }
}

export function phoneDigits(value: string) {
  const digits = value.replace(/\D/g, '')
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error('Informe país, DDD e número. Exemplo de formato: +55 31 9xxxx-xxxx.')
  return digits
}

export async function whatsAppPairingCode(config: Connection, phone: string) {
  const connection = normalizeConnection(config, true)
  const number = phoneDigits(phone)
  const data = await getJson<{ pairingCode?: unknown }>(
    `${connection.url}/instance/connect/${encodeURIComponent(connection.instance!)}?number=${number}`,
    { apikey: connection.token },
  )
  if (typeof data.pairingCode !== 'string' || !data.pairingCode.trim()) {
    throw new Error('A Evolution ainda não retornou um código. Confira se a instância é Baileys v2, se está desconectada e tente novamente.')
  }
  return data.pairingCode
}

export async function whatsAppStatus(config: Connection) {
  const connection = normalizeConnection(config, true)
  const data = await getJson<{ instance?: { state?: string } }>(
    `${connection.url}/instance/connectionState/${encodeURIComponent(connection.instance!)}`,
    { apikey: connection.token },
  )
  if (data.instance?.state === 'open') return 'WhatsApp conectado.'
  if (data.instance?.state === 'connecting') return 'Aguardando conclusão do pareamento.'
  return 'WhatsApp desconectado.'
}

export async function whatsAppChats(config: Connection) {
  const connection = normalizeConnection(config, true)
  const data = await getJson<unknown>(
    `${connection.url}/chat/findChats/${encodeURIComponent(connection.instance!)}`,
    { apikey: connection.token, 'Content-Type': 'application/json' }, { take: 20 },
  )
  if (!Array.isArray(data)) throw new Error('Esta versão da Evolution retornou um formato de conversas desconhecido.')
  return data.slice(0, 20).flatMap(raw => {
    if (!raw || typeof raw !== 'object' || typeof raw.remoteJid !== 'string') return []
    const id = raw.remoteJid as string
    const number = /^([0-9]{8,15})@s\.whatsapp\.net$/.exec(id)?.[1]
    const text = raw.lastMessage?.message?.conversation ?? raw.lastMessage?.message?.extendedTextMessage?.text
    return [{
      id,
      number,
      name: typeof raw.pushName === 'string' && raw.pushName ? raw.pushName : number ?? 'Conversa',
      preview: typeof text === 'string' ? text.slice(0, 240) : '',
    }]
  })
}

export async function openHttps(url: string) {
  if (isAndroid) await nativeAssistant.openExternal({ url })
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export async function openWhatsAppDraft(phone: string, text: string) {
  const number = phoneDigits(phone)
  if (!text.trim()) throw new Error('Escreva o rascunho primeiro.')
  await openHttps(`https://wa.me/${number}?text=${encodeURIComponent(text.trim())}`)
}

export async function bankSnapshot(config: Connection) {
  const connection = normalizeConnection(config, false)
  const data = await getJson<FinanceSnapshot>(`${connection.url}/open-finance/snapshot`, {
    Authorization: `Bearer ${connection.token}`,
  })
  if (!Array.isArray(data.accounts) || !Array.isArray(data.transactions)) throw new Error('Resposta bancária inválida.')
  return data
}
