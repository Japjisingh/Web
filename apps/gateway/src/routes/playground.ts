import { Hono } from 'hono'
import { proxyRequest } from '../services/proxy'

const playground = new Hono()

// Playground runs — authenticated via JWT session (dashboard users)
playground.post('/run', async (c) => {
  // In production, validate JWT session here
  const body = await c.req.json()
  const { organisationId, model, messages, temperature, max_tokens, stream } = body

  if (!organisationId || !model || !messages) {
    return c.json({ error: 'Missing required fields: organisationId, model, messages' }, 400)
  }

  try {
    const result = await proxyRequest(
      organisationId,
      'playground',
      {
        model,
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: max_tokens ?? 2048,
        stream: stream ?? false,
        metadata: { source: 'playground' },
      },
      '/v1/playground/run',
    )

    return c.json({
      response: result.response,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost.toFixed(6),
        latencyMs: result.latencyMs,
        model: result.model,
        cached: result.cached,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Playground execution failed'
    return c.json({ error: { message, type: 'playground_error' } }, 502)
  }
})

export default playground
