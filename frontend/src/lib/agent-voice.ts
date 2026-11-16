import { deleteEncrypted, loadEncrypted, saveEncrypted } from './ai-credentials'
import { isAndroid, nativeAssistant } from './native-assistant'

type VoiceConfig = { apiKey: string; voiceId: string }
export type VoiceMode = 'system' | 'lifeos' | 'elevenlabs'
export type LocalVoiceConfig = { endpoint: string; token: string; sample: string; filename: string }
type LocalVoiceInput = { endpoint: string; token: string; file: File }
const slot = (user: string) => `voice:${user}`
const keySlot = (user: string) => `voice-key:${user}`
const api = 'https://api.elevenlabs.io/v1'

export const loadVoiceConfig = (user: string) => loadEncrypted<VoiceConfig>(slot(user), keySlot(user))
export const saveVoiceConfig = (user: string, config: VoiceConfig) => saveEncrypted(slot(user), keySlot(user), config)
export const deleteVoiceConfig = (user: string) => deleteEncrypted(slot(user), keySlot(user))

const localSlot = (user: string) => `local-voice:${user}`
const localKey = (user: string) => `local-voice-key:${user}`
export const loadLocalVoice = (user: string) => loadEncrypted<LocalVoiceConfig>(localSlot(user), localKey(user))
export const deleteLocalVoice = (user: string) => deleteEncrypted(localSlot(user), localKey(user))

export async function saveLocalVoice(user: string, { endpoint, token, file }: LocalVoiceInput) {
  let url: URL
  try { url = new URL(endpoint.trim()) } catch { throw new Error('Informe o endereço do servidor de voz.') }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))) {
    throw new Error('Use HTTPS para o servidor de voz ou HTTP no endereço local 127.0.0.1.')
  }
  if (!loopback && !token.trim()) throw new Error('Informe o token do seu servidor de voz.')
  if (!/\.wav$/i.test(file.name) || file.size < 1024 || file.size > 10 * 1024 * 1024) {
    throw new Error('Selecione uma gravação WAV válida de até 10 MB.')
  }
  const sample = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1])
    reader.onerror = () => reject(new Error('Não foi possível ler a gravação.'))
    reader.readAsDataURL(file)
  })
  await saveEncrypted(localSlot(user), localKey(user), {
    endpoint: url.href.replace(/\/+$/, ''), token: token.trim(), sample, filename: file.name,
  } satisfies LocalVoiceConfig)
}

export function voicePreference(user: string, oldUserId?: number | string): { mode: VoiceMode; voiceURI: string } {
  try {
    const raw = localStorage.getItem(`lifeos:voice:${user}`) ?? localStorage.getItem(`lifeos:agent:voice:v1:${oldUserId ?? ''}`)
    const value = JSON.parse(raw ?? 'null')
    return { mode: value?.mode === 'elevenlabs' || value?.mode === 'lifeos' ? value.mode : 'system', voiceURI: value?.voiceURI ?? '' }
  } catch { return { mode: 'system', voiceURI: '' } }
}

export function saveVoicePreference(user: string, preference: ReturnType<typeof voicePreference>) {
  localStorage.setItem(`lifeos:voice:${user}`, JSON.stringify(preference))
}

async function assertResponse(response: Response) {
  if (response.ok) return
  const messages: Record<number, string> = {
    401: 'A chave da ElevenLabs é inválida ou expirou.',
    402: 'O plano ou saldo da ElevenLabs não permite esta solicitação.',
    403: 'Confira as permissões da chave e do plano da ElevenLabs.',
    404: 'A voz não está disponível na sua conta ElevenLabs.',
    422: 'A ElevenLabs não aceitou o áudio ou os parâmetros enviados.',
    429: 'Limite da ElevenLabs atingido. Confira sua cota.',
  }
  throw new Error(messages[response.status] ?? `A ElevenLabs retornou um erro (${response.status}).`)
}

async function voiceRequest(url: string, init: RequestInit, controller: AbortController, timeout: number) {
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    await assertResponse(response)
    return await response.blob()
  } catch (error) {
    if (controller.signal.aborted) throw new Error('A solicitação de voz foi interrompida.')
    throw error
  } finally { window.clearTimeout(timer) }
}

export async function createVoice(apiKey: string, name: string, file: File) {
  const form = new FormData()
  form.set('name', name)
  form.append('files[]', file)
  const response = await voiceRequest(`${api}/voices/add`, {
    method: 'POST', headers: { 'xi-api-key': apiKey }, body: form,
  }, new AbortController(), 60_000)
  const payload = JSON.parse(await response.text()) as { voice_id?: string; requires_verification?: boolean }
  if (!payload.voice_id) throw new Error('A ElevenLabs não retornou o identificador da voz.')
  return { voiceId: payload.voice_id, requiresVerification: !!payload.requires_verification }
}

function splitSpeech(text: string): string[] {
  const chunks: string[] = []
  let remaining = text.trim()
  while (remaining.length > 350) {
    const head = remaining.slice(0, 350)
    const boundary = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '))
    const space = head.lastIndexOf(' ')
    const at = boundary > 100 ? boundary + 1 : space > 0 ? space : Array.from(head).slice(0, -1).join('').length
    chunks.push(remaining.slice(0, at))
    remaining = remaining.slice(at).trimStart()
  }
  if (remaining) chunks.push(remaining)
  return chunks
}

async function requestLocalSpeech(config: LocalVoiceConfig, sample: Blob, text: string, controller: AbortController) {
  const form = new FormData()
  form.set('audio', sample, config.filename)
  form.set('text', text)
  form.set('permission_confirmed', 'true')
  const timer = window.setTimeout(() => controller.abort(), 120_000)
  try {
    const response = await fetch(`${config.endpoint}/preview`, {
      method: 'POST',
      headers: config.token ? { Authorization: `Bearer ${config.token}` } : undefined,
      body: form, signal: controller.signal, redirect: 'error',
    })
    if (!response.ok) {
      const error = await response.json().catch(() => null) as { detail?: unknown } | null
      throw new Error(typeof error?.detail === 'string' ? error.detail : `O clonador LifeOS retornou erro (${response.status}).`)
    }
    if (!response.headers.get('content-type')?.startsWith('audio/')) throw new Error('O servidor não retornou áudio.')
    return await response.blob()
  } catch (error) {
    if (controller.signal.aborted) throw new Error('A geração de voz foi interrompida ou excedeu dois minutos.')
    if (error instanceof TypeError) throw new Error('Não foi possível conectar ao clonador LifeOS. Confira o endereço e se o servidor está ligado.')
    throw error
  } finally { window.clearTimeout(timer) }
}

let playback: { controller: AbortController; stopAudio?: () => void } | undefined

export function stopVoice() {
  playback?.controller.abort()
  playback?.stopAudio?.()
  playback = undefined
  if (isAndroid) void nativeAssistant.stop().catch(() => {})
  else window.speechSynthesis?.cancel()
}

export async function speakVoice(text: string, user: string, oldUserId?: number | string) {
  stopVoice()
  const request: NonNullable<typeof playback> = { controller: new AbortController() }
  playback = request
  const { mode, voiceURI } = voicePreference(user, oldUserId)
  try {
    if (mode === 'system') {
      if (isAndroid) { await nativeAssistant.speak({ text }); return }
      if (!window.speechSynthesis) throw new Error('A voz do sistema está indisponível neste navegador.')
      const speech = new SpeechSynthesisUtterance(text)
      speech.lang = 'pt-BR'
      speech.voice = window.speechSynthesis.getVoices().find(voice => voice.voiceURI === voiceURI) ?? null
      window.speechSynthesis.speak(speech)
      return
    }
    if (mode === 'lifeos') {
      const config = await loadLocalVoice(user)
      if (!config) throw new Error('Configure o clonador LifeOS em Configurações.')
      const bytes = Uint8Array.from(atob(config.sample), character => character.charCodeAt(0))
      const sample = new Blob([bytes], { type: 'audio/wav' })
      for (const chunk of splitSpeech(text)) {
        if (request.controller.signal.aborted) return
        const audio = await requestLocalSpeech(config, sample, chunk, request.controller)
        await playAudio(audio, request, true)
      }
      return
    }
    const config = await loadVoiceConfig(user)
    if (!config?.apiKey || !config.voiceId) throw new Error('Configure a voz da ElevenLabs em Configurações.')
    const audioData = await voiceRequest(`${api}/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': config.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    }, request.controller, 45_000)
    await playAudio(audioData, request, false)
  } catch (error) {
    if (!request.controller.signal.aborted || playback === request) throw error
  }
}

async function playAudio(audioData: Blob, request: NonNullable<typeof playback>, waitForEnd: boolean) {
  const signal = request.controller.signal
  if (signal.aborted) return
  const url = URL.createObjectURL(audioData)
  const audio = new Audio(url)
  const done = new Promise<void>(resolve => {
    const finish = () => {
      audio.pause()
      URL.revokeObjectURL(url)
      signal.removeEventListener('abort', finish)
      request.stopAudio = undefined
      resolve()
    }
    request.stopAudio = finish
    signal.addEventListener('abort', finish, { once: true })
    audio.addEventListener('ended', finish, { once: true })
    audio.addEventListener('error', finish, { once: true })
  })
  try {
    await audio.play()
    if (waitForEnd) await done
  } catch (error) {
    request.stopAudio?.()
    throw error
  }
}
