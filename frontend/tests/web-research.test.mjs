import assert from 'node:assert/strict'
import { test } from 'node:test'
import { researchWeb, parseResearchResponse, supportsResearch, safeSource } from '../src/lib/web-research.ts'
import { validateDecision } from '../src/lib/execution-schema.ts'
const geminiResponse = { candidates: [{ content: { parts: [{ text: 'Resultado pesquisado' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.com/fonte', title: 'Fonte' } }], searchEntryPoint: { renderedContent: '<a href="https://google.com">Pesquisar</a>' } } }] }
test('grounding sources come from metadata, not invented links in model prose', () => {
  assert.equal(parseResearchResponse('gemini', geminiResponse).sources[0].url, 'https://example.com/fonte')
  const result = parseResearchResponse('groq', { choices: [{ message: { content: 'https://inventado.example/' } }] })
  assert.equal(result.sources.length, 0)
  assert.match(result.text, /não retornou links verificáveis/)
  assert.equal(safeSource('javascript:alert(1)', 'bad'), null)
  assert.equal(safeSource('https://user:password@example.com', 'bad'), null)
})
test('supported models do not include retired Compound systems', () => {
  assert.equal(supportsResearch({ provider: 'groq', model: 'groq/compound' }), false)
  assert.equal(supportsResearch({ provider: 'groq', model: 'openai/gpt-oss-120b' }), true)
})
test('Gemini search request enables grounding and only transmits public query', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (url, init) => {
      assert.match(url, /:generateContent$/)
      const body = JSON.parse(init.body)
      assert.deepEqual(body.tools, [{ google_search: {} }])
      assert.equal(body.contents[0].parts[0].text, 'notícias sobre astronomia')
      assert.equal(body.contents.length, 1)
      return new Response(JSON.stringify(geminiResponse))
    }
    const result = await researchWeb({ provider: 'gemini', model: 'gemini-2.5-flash', apiKey: 'test' }, 'notícias sobre astronomia')
    assert.equal(result.sources.length, 1)
  } finally { globalThis.fetch = original }
})
test('Groq uses only browser search and does not request structured output', async () => {
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init.body)
      assert.deepEqual(body.tools, [{ type: 'browser_search' }])
      assert.equal(body.tool_choice, 'required')
      assert.equal(body.response_format, undefined)
      return new Response(JSON.stringify({ choices: [{ message: { content: 'Pesquisei', annotations: [{ type: 'url_citation', url_citation: { url: 'https://example.com', title: 'Fonte' } }] } }] }))
    }
    assert.equal((await researchWeb({ provider: 'groq', model: 'openai/gpt-oss-120b', apiKey: 'test' }, 'astronomia')).sources.length, 1)
    globalThis.fetch = async () => new Response('', { status: 429 })
    await assert.rejects(researchWeb({ provider: 'groq', model: 'openai/gpt-oss-120b', apiKey: 'test' }, 'astronomia'), /HTTP 429/)
  } finally { globalThis.fetch = original }
})
test('planner validates bounded search query', () => {
  assert.equal(validateDecision(JSON.stringify({ reply: 'Pesquisando', action: { kind: 'web-search', query: 'clima hoje' } })).action.kind, 'web-search')
  assert.throws(() => validateDecision(JSON.stringify({ reply: '', action: { kind: 'web-search', query: 'x'.repeat(1001) } })))
})
