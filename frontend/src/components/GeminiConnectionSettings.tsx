import { useEffect, useState } from 'react'
import { saveAIConfig, loadAIConfig, deleteAIConfig } from '../lib/ai-credentials'
import { AI_PROVIDERS, generateAIReply, type AIProvider } from '../lib/ai-providers'

export function GeminiConnectionSettings() {
  const [provider, setProvider] = useState<AIProvider>('gemini')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(AI_PROVIDERS.gemini.model)
  const [endpoint, setEndpoint] = useState(AI_PROVIDERS.gemini.endpoint)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [reply, setReply] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    let active = true
    void loadAIConfig().then(config => {
      if (!active || !config) return
      setProvider(config.provider); setApiKey(config.apiKey); setModel(config.model); setEndpoint(config.endpoint); setSaved(true)
    }).catch(() => { if (active) setResult('Não foi possível ler a configuração salva.') })
    return () => { active = false }
  }, [])
  const save = async () => {
    try {
      await saveAIConfig({ provider, apiKey: apiKey.trim(), model, endpoint })
      setSaved(true); setResult('Configuração salva e criptografada neste aparelho.')
    } catch { setResult('Falha ao salvar configuração no aparelho.') }
  }
  const forget = async () => {
    try {
      await deleteAIConfig()
      setApiKey(''); setSaved(false); setResult('Chave e configuração excluídas deste aparelho.'); setReply('')
    } catch { setResult('Falha ao excluir a configuração salva.') }
  }
  const test = async () => {
    setBusy(true); setResult(''); setReply('')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 20000)
    try {
      const answer = await generateAIReply({ provider, apiKey: apiKey.trim(), model, endpoint }, [{ role: 'user', text: 'Responda em português brasileiro, com uma frase curta: Olá, LifeOS!' }], controller.signal)
      setResult('Conexão funcionando. Confira os limites e custos no painel do provedor.')
      setReply(answer)
    } catch (error) {
      setResult(error instanceof Error ? error.message : 'Falha na conexão com a API.')
    } finally { window.clearTimeout(timer); setBusy(false) }
  }
  return <section className="rounded-xl border border-neutral-700 p-3 space-y-3">
    <h3 className="font-semibold">Conectar IA · API pessoal</h3>
    <p className="text-sm opacity-75">Escolha o provedor, informe o modelo e teste a conexão. Sua chave pode ser salva criptografada neste aparelho e excluída a qualquer momento. A cobrança depende do serviço escolhido.</p>
    <label className="block text-sm">Provedor
      <select className="mt-2 w-full min-h-11 rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white" value={provider} onChange={event => { const p = event.target.value as AIProvider; setProvider(p); setModel(AI_PROVIDERS[p].model); setEndpoint(AI_PROVIDERS[p].endpoint); setApiKey(''); setResult(''); setReply('') }}>
        {(Object.keys(AI_PROVIDERS) as AIProvider[]).map(p => <option key={p} value={p}>{AI_PROVIDERS[p].label}</option>)}
      </select>
    </label>
    <label className="block text-sm">Modelo
      <input value={model} onChange={event => setModel(event.target.value)} placeholder="Nome do modelo" className="mt-2 w-full min-h-11 rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white"/>
    </label>
    {(provider === 'custom' || provider === 'ollama') && <label className="block text-sm">URL base da API
      <input value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://servidor.exemplo/v1" className="mt-2 w-full min-h-11 rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white"/>
    </label>}
    <label className="block text-sm">Chave da API {AI_PROVIDERS[provider].requiresKey ? '(obrigatória)' : '(opcional)'}
      <input type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Sua chave pessoal" className="mt-2 w-full min-h-11 rounded-xl border border-neutral-600 bg-neutral-900 p-3 text-white"/>
    </label>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy || (AI_PROVIDERS[provider].requiresKey && !apiKey.trim()) || !model.trim()} className="min-h-11 rounded-xl bg-[#C5FF4A] px-4 font-semibold text-[#101010] disabled:opacity-50" onClick={test}>{busy ? 'Testando…' : 'Testar conexão'}</button>
      <button type="button" disabled={!model.trim() || (AI_PROVIDERS[provider].requiresKey && !apiKey.trim())} className="min-h-11 rounded-xl bg-[#C5FF4A] px-4 font-semibold text-[#101010] disabled:opacity-50" onClick={() => void save()}>{saved ? 'Atualizar chave salva' : 'Salvar configuração'}</button>
      <button type="button" className="min-h-11 rounded-xl border border-neutral-600 px-4" onClick={() => void forget()}>Excluir chave salva</button>
    </div>
    {saved && <p className="text-xs text-[#C5FF4A]">Uma configuração de IA está salva neste aparelho.</p>}
    {result && <p role="status" className="text-sm">{result}</p>}
    {reply && <p className="rounded-lg border border-neutral-700 p-3 text-sm">Resposta da IA: {reply}</p>}
    <p className="text-xs opacity-70">Uma chamada de teste consome cota. APIs personalizadas precisam ser compatíveis com OpenAI e permitir CORS. O Ollama local pode exigir configuração de rede e permissões Android. Não use chaves de terceiros nem envie sua chave para endpoints desconhecidos.</p>
  </section>
}
