import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
export type Photo = { id: string; name: string; path: string; size: number; keep: boolean }
export type PhotoScan = { token: string; groups: Array<{ items: Photo[]; thumbnail: string }>; examined: number; hashed: number; skipped: number; limited: boolean; partial: boolean; duplicateBytes: number }
export const nativePhotos = registerPlugin<{
 scan(options: { reselect?: boolean }): Promise<PhotoScan>
 trash(options: { token: string; ids: string[] }): Promise<{ cancelled: boolean; verified: number; unknown: number }>
 cancel(): Promise<void>
 discard(): Promise<void>
 addListener(event: 'progress', handler: (value: { hashed: number; examined: number }) => void): Promise<PluginListenerHandle>
}>('TophPhotos')
export function formatBytes(value: number) { return `${(value / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` }
