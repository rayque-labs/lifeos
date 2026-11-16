import { deleteEncrypted, loadEncrypted, saveEncrypted } from './ai-credentials'

type MemoryCommand = { kind: 'list' | 'clear' } | { kind: 'save' | 'forget'; text: string }

const MAX_MEMORIES = 30
const MAX_LENGTH = 240
let pending: Promise<unknown> = Promise.resolve()

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function parseMemoryCommand(message: string): MemoryCommand | null {
  const command = normalize(message).replace(/[?!.]+$/, '')
  if (/^(o que (voce )?lembra|listar memorias|mostrar memorias)$/.test(command)) return { kind: 'list' }
  if (/^(limpar memoria|esquecer tudo)$/.test(command)) return { kind: 'clear' }

  const save = /^lembre(?:-se)?\s+que(?:\s+|$)/i.exec(message)
  if (save) return { kind: 'save', text: message.slice(save[0].length).trim() }

  const forget = /^esqueca(?:\s+que)?(?:\s+|$)/.exec(normalize(message))
  if (forget) return { kind: 'forget', text: command.slice(forget[0].length).trim() }
  return null
}

function memoryKeys(accountId: string) {
  const name = 'toph-memory:' + accountId
  return [name, name + ':key'] as const
}

export function executeMemoryCommand(command: MemoryCommand, accountId: string): Promise<string> {
  const run = pending.then(async () => {
    const [name, key] = memoryKeys(accountId)
    if (command.kind === 'clear') {
      await deleteEncrypted(name, key)
      return 'Memória apagada neste aparelho.'
    }

    const notes = await loadEncrypted<string[]>(name, key) ?? []
    if (command.kind === 'list') {
      return notes.length ? notes.map((note, index) => `${index + 1}. ${note}`).join('\n') : 'Minha memória está vazia.'
    }
    if (command.kind === 'save') {
      if (!command.text || command.text.length > MAX_LENGTH) return 'Diga o que devo lembrar em até 240 caracteres.'
      if (notes.some(note => normalize(note) === normalize(command.text))) return 'Já guardei essa informação.'
      if (notes.length >= MAX_MEMORIES) return 'A memória tem 30 itens. Apague um com “Esqueça” para guardar outro.'
      await saveEncrypted(name, key, [...notes, command.text])
      return 'Guardei essa informação neste aparelho.'
    }
    if (command.kind === 'forget') {
      const index = /^\d+$/.test(command.text)
        ? Number(command.text) - 1
        : notes.findIndex(note => normalize(note).replace(/[?!.]+$/, '') === command.text)
      if (index < 0 || index >= notes.length) return 'Use “O que você lembra?” e depois diga “Esqueça” seguido do número do item.'
      await saveEncrypted(name, key, notes.filter((_, noteIndex) => noteIndex !== index))
      return 'Esqueci esse item.'
    }
    return 'Comando de memória inválido.'
  })
  pending = run.catch(() => undefined)
  return run
}

export async function loadMemoryContext(accountId: string, message: string): Promise<string[]> {
  await pending
  const notes = await loadEncrypted<string[]>(...memoryKeys(accountId)) ?? []
  const words = new Set(normalize(message).match(/[a-z0-9]{4,}/g) ?? [])
  return notes.map((note, index) => ({
    note,
    index,
    score: [...new Set(normalize(note).match(/[a-z0-9]{4,}/g) ?? [])].filter(word => words.has(word)).length,
  })).filter(({ note, score }) => score > 0 || /^(prefiro|gosto de|minha preferencia)\b/.test(normalize(note)))
    .sort((a, b) => b.score - a.score || b.index - a.index).slice(0, 5).map(({ note }) => note)
}
