import { Hono } from 'hono'
import { apiKeyAuth } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { proxyRequest } from '../services/proxy'

const batch = new Hono()

batch.use('*', apiKeyAuth, rateLimit)

batch.post('/', async (c) => {
  const apiKey = c.get('apiKey' as never) as { id: string; organisationId: string }
  const body = await c.req.json()

  const { requests } = body
  if (!Array.isArray(requests) || requests.length === 0) {
    return c.json({ error: 'requests must be a non-empty array' }, 400)
  }

  if (requests.length > 100) {
    return c.json({ error: 'Maximum 100 requests per batch' }, 400)
  }

  // Process with concurrency limit of 10
  const concurrency = 10
  const results: unknown[] = new Array(requests.length)
  let totalCost = 0
  let totalTokens = 0

  for (let i = 0; i < requests.length; i += concurrency) {
    const chunk = requests.slice(i, i + concurrency)
    const promises = chunk.map(async (req: { model: string; messages: unknown[]; [k: string]: unknown }, idx: number) => {
      try {
        const result = await proxyRequest(
          apiKey.organisationId,
          apiKey.id,
          { model: req.model, messages: req.messages, ...req },
          '/v1/batch',
        )
        totalCost += result.cost
        totalTokens += result.inputTokens + result.outputTokens
        results[i + idx] = {
          index: i + idx,
          response: result.response,
          cost: result.cost.toFixed(6),
          tokens: result.inputTokens + result.outputTokens,
          latencyMs: result.latencyMs,
          cached: result.cached,
          status: 'success',
        }
      } catch (err) {
        results[i + idx] = {
          index: i + idx,
          error: err instanceof Error ? err.message : 'Request failed',
          status: 'error',
        }
      }
    })
    await Promise.all(promises)
  }

  return c.json({
    results,
    summary: {
      total: requests.length,
      succeeded: results.filter((r: unknown) => (r as { status: string }).status === 'success').length,
      failed: results.filter((r: unknown) => (r as { status: string }).status === 'error').length,
      totalCost: totalCost.toFixed(6),
      totalTokens,
    },
  })
})

export default batch
