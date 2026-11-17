import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type FileAction = { kind: 'files'; operation: 'list' | 'organize' | 'mkdir' | 'write' | 'rename'; query?: string; name?: string; content?: string; source?: string }
export type FilePlan = { token: string; folder: string; steps: string[] }
export type FileProgress = { completed: number; total: number; current: string }
export const nativeFiles = registerPlugin<{
  chooseFolder(): Promise<{ summary: string }>
  forgetFolder(): Promise<{ summary: string }>
  listFiles(options: { query?: string }): Promise<{ folder: string; items: Array<{ name: string; directory: boolean; size: number }> }>
  prepare(options: Omit<FileAction, 'kind'>): Promise<FilePlan>
  execute(options: { token: string }): Promise<{ completed: string[]; total: number; cancelled: boolean; error?: string }>
  discard(): Promise<void>
  cancel(): Promise<void>
  addListener(event: 'progress', handler: (progress: FileProgress) => void): Promise<PluginListenerHandle>
}>('TophFiles')

export function parseFileAction(text: string): FileAction | null {
  if (/^(?:listar?|mostr(?:ar|e|a)|ver) (?:os |meus )?arquivos[.!?]?$/i.test(text)) return { kind: 'files', operation: 'list' }
  if (/^organiz(?:ar|e|a) (?:os |meus )?(?:arquivos|documentos|a pasta)[.!?]?$/i.test(text)) return { kind: 'files', operation: 'organize' }
  const folder = text.match(/^(?:cri(?:ar|e|a)|fa(?:zer|ça)) (?:uma )?pasta(?: chamada)?\s*:?\s+(.+)$/i)
  if (folder) return { kind: 'files', operation: 'mkdir', name: folder[1].trim() }
  const search = text.match(/^(?:procur(?:ar|e|a)|busc(?:ar|a|que)) (?:o )?arquivo\s+(.+)$/i)
  if (search) return { kind: 'files', operation: 'list', query: search[1].trim() }
  return null
}
