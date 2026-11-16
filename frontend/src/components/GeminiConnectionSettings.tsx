import { useState } from 'react'

const MODELS = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite — econômico' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — mais capacidade' },
]

export function GeminiConnectionSettings() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(MODELS[0].id)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [reply, setReply] = useState('')
  const test = async () => {
    const key = apiKey.trim()
    if (!key) { setResult('Cole uma chave nova do Google AI Studio para testar.'); return }
    setBusy(true); setResult(''); setReply('')
    try {
      const controller = new AbortController()
      const timer = window.setTimeout(() => controller.abort(), 20000)
      let response: Response
      try {
        response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responda em português brasileiro, com uma frase curta: Olá, LifeOS!' }] }], generationConfig: { maxOutputTokens: 80 } }),
          signal: controller.signal,
          cache: 'no-store',
        })
      } finally { window.clearTimeout(timer) }
      if (response.ok) {
        const data = await response.json()
        const text = (data?.candidates?.[0]?.content?.parts || []).map((part: {text?: string}) => part.text || '').join('').trim()
        setResult('Conexão funcionando! Isso não confirma que o projeto está no plano gratuito. Verifique o nível de cobrança no AI Studio.')
        setReply(text || 'A API respondeu sem texto.')
      } else {
        const status = response.status
        const messages: Record<number, string> = {
          400: 'Requisição recusada. Confira modelo e parâmetros.',
          401: 'Chave inválida ou não autorizada.',
          403: 'Acesso negado. Confira se o Free Tier está habilitado para seu projeto.',
          404: 'Modelo indisponível para esta chave. Selecione outro modelo.',
          429: 'Cota excedida ou limite de requisições atingido.',
        }
        setResult(messages[status] || 'Erro HTTP ' + status + '. Verifique a API e tente novamente.')
      }
    } catch {
      setResult('Falha de conexão ou tempo esgotado. Verifique internet e acesso à API.')
    } finally { setBusy(false) }
  }
  return <section className="rounded-xl border border-neutral-700 p-3 space-y-3">
    <h3 className="font-semibold">Conectar Gemini · API pessoal</h3>
    <p className="text-sm opacity-75">Cada usuário usa sua própria chave. Este teste não grava a chave no LifeOS, no servidor nem no GitHub. Ela fica somente neste formulário até você sair da tela.</p>
    <label className="block text-sm">Modelo
      <select className="mt-2 w-full min-h-11 rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white" value={model} onChange={event => setModel(event.target.value)}>
        {MODELS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    <label className="block text-sm">Chave Gemini (não compartilhe)
      <input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Cole aqui uma chave nova" className="mt-2 w-full min-h-11 rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white" />
    </label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || !apiKey.trim()} className="min-h-11 rounded-xl bg-[#C5FF4A] px-4 font-semibold text-[#101010] disabled:opacity-50" onClick={test}>{busy ? 'Testando…' : 'Testar conexão'}</button>
      <button type="button" className="min-h-11 rounded-xl border border-neutral-600 px-4" onClick={() => { setApiKey(''); setResult('Chave apagada do formulário.'); setReply('') }}>Limpar chave</button>
    </div>
    {result && <p role="status" className="text-sm">{result}</p>}
    {reply && <p className="rounded-lg border border-neutral-700 p-3 text-sm">Resposta da IA: {reply}</p>}
    <p className="text-xs opacity-70">Uma chamada de teste consome cota. O nível gratuito depende do projeto; alguns dados enviados podem ser usados para melhorar produtos do Google. Não use informações pessoais neste teste. Para uso permanente, será necessário armazenamento seguro no Android; não salve chaves no localStorage.</p>
  </section>
}
