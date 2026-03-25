import { Hono } from 'hono'
import { apiKeyAuth } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { proxyRequest } from '../services/proxy'
import { db } from '@neuralgate/database/client'
import { aiAgents } from '@neuralgate/database/schema'
import { eq, and, sql } from 'drizzle-orm'

const agents = new Hono()

agents.use('*', apiKeyAuth, rateLimit)

// Run an agent
agents.post('/:agentId/run', async (c) => {
  const apiKey = c.get('apiKey' as never) as { id: string; organisationId: string }
  const agentId = c.req.param('agentId')
  const body = await c.req.json()

  // Look up agent config
  const [agent] = await db
    .select()
    .from(aiAgents)
    .where(
      and(
        eq(aiAgents.id, agentId),
        eq(aiAgents.organisationId, apiKey.organisationId),
        eq(aiAgents.isActive, true),
      ),
    )
    .limit(1)

  if (!agent) {
    return c.json({ error: 'Agent not found or inactive' }, 404)
  }

  // Build request with agent config
  const messages = [
    ...(agent.systemPrompt ? [{ role: 'system', content: agent.systemPrompt }] : []),
    ...(body.messages || [{ role: 'user', content: body.input || '' }]),
  ]

  try {
    const result = await proxyRequest(
      apiKey.organisationId,
      apiKey.id,
      {
        model: agent.modelPreference || 'gpt-4o-mini',
        messages,
        temperature: agent.temperature ? parseFloat(agent.temperature) : 0.7,
        max_tokens: body.max_tokens || 2048,
      },
      `/v1/agents/${agentId}/run`,
    )

    // Increment call count
    await db
      .update(aiAgents)
      .set({ totalCalls: sql`${aiAgents.totalCalls} + 1` })
      .where(eq(aiAgents.id, agentId))

    return c.json({
      response: result.response,
      agent: { id: agent.id, name: agent.name },
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cost: result.cost.toFixed(6),
        latencyMs: result.latencyMs,
        cached: result.cached,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent execution failed'
    return c.json({ error: { message, type: 'agent_error' } }, 502)
  }
})

export default agents
