export type AIProvider = 'gemini' | 'openai' | 'openrouter' | 'groq' | 'deepseek' | 'ollama' | 'custom'
export type AIMessage = { role: 'user' | 'model'; text: string }
export type AIConfig = { provider: AIProvider; apiKey: string; model: string; endpoint: string }
export const AI_PROVIDERS: Record<AIProvider, { label: string; endpoint: string; model: string; requiresKey: boolean }> = {
  gemini: { label: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash', requiresKey: true },
  openai: { label: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', requiresKey: true },
  openrouter: { label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4.1-mini', requiresKey: true },
  groq: { label: 'Groq', endpoint: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', requiresKey: true },
  deepseek: { label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat', requiresKey: true },
  ollama: { label: 'Ollama local', endpoint: 'http://localhost:11434/v1', model: 'llama3.2', requiresKey: false },
  custom: { label: 'API compatível com OpenAI', endpoint: '', model: '', requiresKey: false },
}
const SYSTEM = 'Você é a assistente do LifeOS. Responda em português brasileiro de forma humana, amigável e clara. Não afirme que criou tarefas ou executou ações no celular, pois essas ferramentas não estão disponíveis nesta versão.'
function endpointFor(config: AIConfig) {
  const endpoint = (config.provider === 'custom' || config.provider === 'ollama' ? config.endpoint : AI_PROVIDERS[config.provider].endpoint).trim().replace(/\/+$/, '')
  let url: URL
  try { url = new URL(endpoint) } catch { throw new Error('Endereço da API inválido.') }
  if (url.username || url.password || url.search || url.hash) throw new Error('Use apenas a URL base da API, sem usuário, senha ou parâmetros.')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('A API precisa usar HTTPS, exceto localhost.')
  return endpoint
}
export async function generateAIReply(config: AIConfig, messages: AIMessage[], signal?: AbortSignal): Promise<string> {
  const model = config.model.trim()
  if (!model) throw new Error('Informe o nome do modelo.')
  if (AI_PROVIDERS[config.provider].requiresKey && !config.apiKey.trim()) throw new Error('Informe a chave da API.')
  const base = endpointFor(config)
  let response: Response
  if (config.provider === 'gemini') {
    response = await fetch(base + '/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey.trim() },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents: messages.slice(-16).map(m => ({ role: m.role, parts: [{ text: m.text }] })), generationConfig: { maxOutputTokens: 512 } }),
      signal, cache: 'no-store',
    })
  } else {
    response = await fetch(base + '/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(config.apiKey.trim() ? { Authorization: 'Bearer ' + config.apiKey.trim() } : {}) },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: SYSTEM }, ...messages.slice(-16).map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text }))], max_tokens: 512 }),
      signal, cache: 'no-store',
    })
  }
  if (!response.ok) {
    const codes: Record<number, string> = { 400: 'Requisição rejeitada. Confira modelo e parâmetros.', 401: 'Chave inválida ou não autorizada.', 403: 'Acesso negado pela API.', 404: 'Modelo ou endpoint não encontrado.', 429: 'Limite de uso ou cota atingida.' }
    throw new Error(codes[response.status] || 'API retornou HTTP ' + response.status + '.')
  }
  const data = await response.json()
  const result = config.provider === 'gemini'
    ? (data?.candidates?.[0]?.content?.parts || []).map((part: { text?: string }) => part.text || '').join('')
    : data?.choices?.[0]?.message?.content
  const answer = typeof result === 'string' ? result.trim() : ''
  if (!answer) throw new Error('A API não retornou uma resposta em texto.')
  return answer
}
