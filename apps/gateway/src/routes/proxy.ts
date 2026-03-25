import { Hono } from 'hono'
import { apiKeyAuth } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { proxyRequest } from '../services/proxy'
import { publishLiveEvent } from '../services/sse'

const proxy = new Hono()

proxy.use('*', apiKeyAuth, rateLimit)

// OpenAI-compatible chat completions
proxy.post('/v1/chat/completions', async (c) => {
  const apiKey = c.get('apiKey' as never) as { id: string; organisationId: string }
  const body = await c.req.json()

  try {
    const result = await proxyRequest(
      apiKey.organisationId,
      apiKey.id,
      body,
      '/v1/chat/completions',
    )

    // Publish live event
    await publishLiveEvent(apiKey.organisationId, {
      id: crypto.randomUUID(),
      model: result.model,
      endpoint: '/v1/chat/completions',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      cost: result.cost.toFixed(6),
      latencyMs: result.latencyMs,
      cached: result.cached,
      status: 'success',
      timestamp: new Date().toISOString(),
    })

    c.header('X-NeuralGate-Cost', result.cost.toFixed(6))
    c.header('X-NeuralGate-Latency', String(result.latencyMs))
    c.header('X-NeuralGate-Cached', String(result.cached))
    c.header('X-NeuralGate-Model', result.model)

    return c.json(result.response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal proxy error'
    return c.json({ error: { message, type: 'proxy_error' } }, 502)
  }
})

// Completions (legacy)
proxy.post('/v1/completions', async (c) => {
  const apiKey = c.get('apiKey' as never) as { id: string; organisationId: string }
  const body = await c.req.json()

  try {
    const result = await proxyRequest(
      apiKey.organisationId,
      apiKey.id,
      body,
      '/v1/completions',
    )
    return c.json(result.response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal proxy error'
    return c.json({ error: { message, type: 'proxy_error' } }, 502)
  }
})

// Embeddings
proxy.post('/v1/embeddings', async (c) => {
  const apiKey = c.get('apiKey' as never) as { id: string; organisationId: string }
  const body = await c.req.json()

  try {
    const result = await proxyRequest(
      apiKey.organisationId,
      apiKey.id,
      body,
      '/v1/embeddings',
    )
    return c.json(result.response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal proxy error'
    return c.json({ error: { message, type: 'proxy_error' } }, 502)
  }
})

export default proxy
