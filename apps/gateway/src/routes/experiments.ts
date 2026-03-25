import { Hono } from 'hono'
import { apiKeyAuth } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { proxyRequest } from '../services/proxy'
import { db } from '@neuralgate/database/client'
import { experiments } from '@neuralgate/database/schema'
import { eq, and } from 'drizzle-orm'

const experimentRoutes = new Hono()

experimentRoutes.use('*', apiKeyAuth, rateLimit)

// A/B test endpoint
experimentRoutes.post('/:experimentId', async (c) => {
  const apiKey = c.get('apiKey' as never) as { id: string; organisationId: string }
  const experimentId = c.req.param('experimentId')
  const body = await c.req.json()

  const [experiment] = await db
    .select()
    .from(experiments)
    .where(
      and(
        eq(experiments.id, experimentId),
        eq(experiments.organisationId, apiKey.organisationId),
        eq(experiments.status, 'running'),
      ),
    )
    .limit(1)

  if (!experiment) {
    return c.json({ error: 'Experiment not found or not running' }, 404)
  }

  // Route traffic based on split
  const splitThreshold = parseInt(experiment.trafficSplit) / 100
  const useVariantA = Math.random() < splitThreshold
  const variant = useVariantA
    ? (experiment.variantA as Record<string, unknown>)
    : (experiment.variantB as Record<string, unknown>)

  const variantLabel = useVariantA ? 'A' : 'B'

  try {
    const result = await proxyRequest(
      apiKey.organisationId,
      apiKey.id,
      {
        model: (variant.model as string) || body.model || 'gpt-4o-mini',
        messages: body.messages,
        temperature: (variant.temperature as number) ?? body.temperature ?? 0.7,
        max_tokens: body.max_tokens || 2048,
        metadata: {
          experiment_id: experimentId,
          variant: variantLabel,
        },
      },
      `/v1/experiment/${experimentId}`,
    )

    return c.json({
      response: result.response,
      experiment: {
        id: experimentId,
        variant: variantLabel,
      },
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost.toFixed(6),
        latencyMs: result.latencyMs,
        cached: result.cached,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Experiment execution failed'
    return c.json({ error: { message, type: 'experiment_error' } }, 502)
  }
})

export default experimentRoutes
