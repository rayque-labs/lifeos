import { registerPlugin } from '@capacitor/core'

type AlarmOptions = { id: number; at: number; title: string; speech: string }
type AlarmPlugin = {
  schedule(options: AlarmOptions): Promise<{ exact: boolean }>
  cancel(options: { id: number }): Promise<void>
}
const nativeAlarm = registerPlugin<AlarmPlugin>('LifeOSAlarm')

export async function scheduleLifeOSAlarm(options: AlarmOptions): Promise<{ exact: boolean } | null> {
  if (!('Capacitor' in window)) return null
  return nativeAlarm.schedule(options)
}
export async function cancelLifeOSAlarm(id: number): Promise<void> {
  if (!('Capacitor' in window)) return
  await nativeAlarm.cancel({ id })
}

export function alarmSpeech(title: string, category?: string | null): string {
  const value = (title + ' ' + (category || '')).toLocaleLowerCase('pt-BR')
  if (/rem[eé]dio|medicamento|m[eé]dico|consulta|emerg[eê]ncia/.test(value))
    return 'Atenção. Chegou a hora de ' + title + '. Esse compromisso é importante.'
  if (/trein|academia|exerc[ií]cio|corrida/.test(value))
    return 'Ah, olha só... chegou a hora de ' + title + '. Vai levantar ou deixar a promessa para o ano que vem?'
  if (/conta|boleto|pagamento|pagar/.test(value))
    return 'Ih... chegou a hora de ' + title + '. Melhor resolver antes que esse boleto crie raízes, hein?'
  return 'Opa, temos um compromisso: ' + title + '. Eu lembrei. Agora é sua vez!'
}
