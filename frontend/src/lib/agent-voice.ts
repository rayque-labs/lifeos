import { deleteEncrypted, loadEncrypted, saveEncrypted } from './ai-credentials'
import { isAndroid, nativeAssistant } from './native-assistant'

type VoiceConfig = { apiKey: string; voiceId: string }
export type VoiceMode = 'system' | 'elevenlabs'
const slot = (user: string) => `voice:${user}`
const keySlot = (user: string) => `voice-key:${user}`
const api = 'https://api.elevenlabs.io/v1'

export const loadVoiceConfig = (user: string) => loadEncrypted<VoiceConfig>(slot(user), keySlot(user))
export const saveVoiceConfig = (user: string, config: VoiceConfig) => saveEncrypted(slot(user), keySlot(user), config)
export const deleteVoiceConfig = (user: string) => deleteEncrypted(slot(user), keySlot(user))

export function voicePreference(user: string, oldUserId?: number | string): { mode: VoiceMode; voiceURI: string } {
  try {
    const raw = localStorage.getItem(`lifeos:voice:${user}`) ?? localStorage.getItem(`lifeos:agent:voice:v1:${oldUserId ?? ''}`)
    const value = JSON.parse(raw ?? 'null')
    return { mode: value?.mode === 'elevenlabs' ? 'elevenlabs' : 'system', voiceURI: value?.voiceURI ?? '' }
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
    const config = await loadVoiceConfig(user)
    if (!config?.apiKey || !config.voiceId) throw new Error('Configure a voz da ElevenLabs em Configurações.')
    const audioData = await voiceRequest(`${api}/text-to-speech/${encodeURIComponent(config.voiceId)}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': config.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    }, request.controller, 45_000)
    if (request.controller.signal.aborted) return
    const url = URL.createObjectURL(audioData)
    const audio = new Audio(url)
    request.stopAudio = () => { audio.pause(); URL.revokeObjectURL(url) }
    const release = () => {
      request.stopAudio?.()
      if (playback === request) playback = undefined
    }
    audio.addEventListener('ended', release, { once: true })
    audio.addEventListener('error', release, { once: true })
    try { await audio.play() }
    catch (error) { release(); throw error }
  } catch (error) {
    if (!request.controller.signal.aborted || playback === request) throw error
  }
}
