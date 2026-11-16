type AlarmOptions = { id: number; at: number; title: string; speech: string; category?: string }
type AlarmPlugin = {
  schedule(options: AlarmOptions): Promise<{ exact: boolean }>
  cancel(options: { id: number }): Promise<void>
}
function plugin(): AlarmPlugin | null {
  const host = window as Window & { Capacitor?: { Plugins?: { LifeOSAlarm?: AlarmPlugin } } }
  return host.Capacitor?.Plugins?.LifeOSAlarm ?? null
}

export async function scheduleLifeOSAlarm(options: AlarmOptions): Promise<{ exact: boolean } | null> {
  const nativeAlarm = plugin()
  return nativeAlarm ? nativeAlarm.schedule(options) : null
}
export async function cancelLifeOSAlarm(id: number): Promise<void> {
  const nativeAlarm = plugin()
  if (nativeAlarm) await nativeAlarm.cancel({ id })
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
