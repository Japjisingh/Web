import { Hono } from 'hono'
import { db } from '@neuralgate/database/client'
import {
  organisations, apiKeys, providerCredentials, aiRequests,
  usageSnapshots, optimisationRecommendations, alerts, alertHistory,
  aiAgents, promptLibrary, experiments, verticalConfigs,
} from '@neuralgate/database/schema'
import { eq, desc, and, gte, lte, sql, count } from 'drizzle-orm'

const api = new Hono()

// --- Overview ---
api.get('/overview/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const days = parseInt(c.req.query('days') || '30')
  const since = new Date()
  since.setDate(since.getDate() - days)

  const [stats] = await db
    .select({
      totalRequests: sql<number>`coalesce(sum(${usageSnapshots.totalRequests}), 0)`,
      totalCost: sql<string>`coalesce(sum(${usageSnapshots.totalCostUsd}), 0)`,
      totalSaved: sql<string>`coalesce(sum(${usageSnapshots.savedCostUsd}), 0)`,
      cachedRequests: sql<number>`coalesce(sum(${usageSnapshots.cachedRequests}), 0)`,
      totalTokens: sql<number>`coalesce(sum(${usageSnapshots.totalTokens}), 0)`,
      totalErrors: sql<number>`coalesce(sum(${usageSnapshots.errorCount}), 0)`,
    })
    .from(usageSnapshots)
    .where(eq(usageSnapshots.organisationId, orgId))

  const dailyUsage = await db
    .select({
      date: usageSnapshots.date,
      cost: sql<string>`sum(${usageSnapshots.totalCostUsd})`,
      requests: sql<number>`sum(${usageSnapshots.totalRequests})`,
      saved: sql<string>`sum(${usageSnapshots.savedCostUsd})`,
      cached: sql<number>`sum(${usageSnapshots.cachedRequests})`,
    })
    .from(usageSnapshots)
    .where(eq(usageSnapshots.organisationId, orgId))
    .groupBy(usageSnapshots.date)
    .orderBy(usageSnapshots.date)

  const cacheRate = stats.totalRequests > 0
    ? (stats.cachedRequests / stats.totalRequests * 100).toFixed(1)
    : '0'

  return c.json({
    metrics: {
      totalRequests: stats.totalRequests,
      totalCost: stats.totalCost,
      totalSaved: stats.totalSaved,
      cacheRate,
      totalTokens: stats.totalTokens,
      errorRate: stats.totalRequests > 0
        ? (stats.totalErrors / stats.totalRequests * 100).toFixed(2)
        : '0',
    },
    dailyUsage,
  })
})

// --- Requests ---
api.get('/requests/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const page = parseInt(c.req.query('page') || '1')
  const pageSize = parseInt(c.req.query('pageSize') || '50')
  const model = c.req.query('model')
  const cached = c.req.query('cached')
  const provider = c.req.query('provider')

  const conditions = [eq(aiRequests.organisationId, orgId)]
  if (model) conditions.push(eq(aiRequests.model, model))
  if (cached !== undefined) conditions.push(eq(aiRequests.cached, cached === 'true'))
  if (provider) conditions.push(eq(aiRequests.provider, provider))

  const [totalResult] = await db
    .select({ total: count() })
    .from(aiRequests)
    .where(and(...conditions))

  const rows = await db
    .select()
    .from(aiRequests)
    .where(and(...conditions))
    .orderBy(desc(aiRequests.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return c.json({
    data: rows,
    total: totalResult.total,
    page,
    pageSize,
    hasMore: page * pageSize < totalResult.total,
  })
})

// --- Analytics ---
api.get('/analytics/:orgId', async (c) => {
  const orgId = c.req.param('orgId')

  const byModel = await db
    .select({
      model: usageSnapshots.model,
      totalCost: sql<string>`sum(${usageSnapshots.totalCostUsd})`,
      totalRequests: sql<number>`sum(${usageSnapshots.totalRequests})`,
      totalTokens: sql<number>`sum(${usageSnapshots.totalTokens})`,
    })
    .from(usageSnapshots)
    .where(eq(usageSnapshots.organisationId, orgId))
    .groupBy(usageSnapshots.model)

  const byProvider = await db
    .select({
      provider: usageSnapshots.provider,
      totalCost: sql<string>`sum(${usageSnapshots.totalCostUsd})`,
      totalRequests: sql<number>`sum(${usageSnapshots.totalRequests})`,
    })
    .from(usageSnapshots)
    .where(eq(usageSnapshots.organisationId, orgId))
    .groupBy(usageSnapshots.provider)

  return c.json({ byModel, byProvider })
})

// --- Optimisations ---
api.get('/optimisations/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const rows = await db
    .select()
    .from(optimisationRecommendations)
    .where(eq(optimisationRecommendations.organisationId, orgId))
    .orderBy(desc(optimisationRecommendations.estimatedSavingUsd))

  return c.json(rows)
})

api.patch('/optimisations/:id/apply', async (c) => {
  const id = c.req.param('id')
  await db
    .update(optimisationRecommendations)
    .set({ isApplied: true, status: 'applied', appliedAt: new Date() })
    .where(eq(optimisationRecommendations.id, id))
  return c.json({ success: true })
})

api.patch('/optimisations/:id/dismiss', async (c) => {
  const id = c.req.param('id')
  await db
    .update(optimisationRecommendations)
    .set({ status: 'dismissed' })
    .where(eq(optimisationRecommendations.id, id))
  return c.json({ success: true })
})

// --- API Keys ---
api.get('/api-keys/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.organisationId, orgId))
    .orderBy(desc(apiKeys.createdAt))
  return c.json(rows)
})

api.post('/api-keys/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const body = await c.req.json()
  const crypto = await import('node:crypto')
  const keyRaw = `ng_live_${crypto.randomBytes(24).toString('hex')}`
  const keyHash = crypto.createHash('sha256').update(keyRaw).digest('hex')

  const [created] = await db.insert(apiKeys).values({
    organisationId: orgId,
    name: body.name,
    keyHash,
    keyPrefix: keyRaw.slice(0, 12),
    vertical: body.vertical,
    rateLimitPerMinute: body.rateLimitPerMinute || 60,
    monthlyBudgetCap: body.monthlyBudgetCap,
    allowedProviders: body.allowedProviders,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
  }).returning()

  return c.json({ ...created, key: keyRaw }, 201)
})

api.delete('/api-keys/:id', async (c) => {
  const id = c.req.param('id')
  await db.update(apiKeys).set({ isActive: false }).where(eq(apiKeys.id, id))
  return c.json({ success: true })
})

// --- Providers ---
api.get('/providers/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const rows = await db
    .select({
      id: providerCredentials.id,
      provider: providerCredentials.provider,
      models: providerCredentials.models,
      isActive: providerCredentials.isActive,
      lastTestedAt: providerCredentials.lastTestedAt,
      testStatus: providerCredentials.testStatus,
      createdAt: providerCredentials.createdAt,
    })
    .from(providerCredentials)
    .where(eq(providerCredentials.organisationId, orgId))
  return c.json(rows)
})

api.post('/providers/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const body = await c.req.json()
  // TODO: encrypt API key properly in production
  const [created] = await db.insert(providerCredentials).values({
    organisationId: orgId,
    provider: body.provider,
    encryptedApiKey: body.apiKey,
    models: body.models,
  }).returning()
  return c.json(created, 201)
})

// --- Alerts ---
api.get('/alerts/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const rows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.organisationId, orgId))
    .orderBy(desc(alerts.createdAt))
  return c.json(rows)
})

api.post('/alerts/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const body = await c.req.json()
  const [created] = await db.insert(alerts).values({
    organisationId: orgId,
    type: body.type,
    name: body.name,
    condition: body.condition,
    channels: body.channels,
  }).returning()
  return c.json(created, 201)
})

// --- Agents ---
api.get('/agents/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const rows = await db
    .select()
    .from(aiAgents)
    .where(eq(aiAgents.organisationId, orgId))
    .orderBy(desc(aiAgents.createdAt))
  return c.json(rows)
})

api.post('/agents/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const body = await c.req.json()
  const [created] = await db.insert(aiAgents).values({
    organisationId: orgId,
    name: body.name,
    description: body.description,
    vertical: body.vertical,
    systemPrompt: body.systemPrompt,
    modelPreference: body.modelPreference,
    temperature: body.temperature,
    toolsEnabled: body.toolsEnabled,
  }).returning()
  return c.json(created, 201)
})

api.patch('/agents/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const [updated] = await db
    .update(aiAgents)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(aiAgents.id, id))
    .returning()
  return c.json(updated)
})

// --- Prompt Library ---
api.get('/prompts/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const rows = await db
    .select()
    .from(promptLibrary)
    .where(eq(promptLibrary.organisationId, orgId))
    .orderBy(desc(promptLibrary.useCount))
  return c.json(rows)
})

api.post('/prompts/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const body = await c.req.json()
  const [created] = await db.insert(promptLibrary).values({
    organisationId: orgId,
    name: body.name,
    category: body.category,
    promptTemplate: body.promptTemplate,
    variables: body.variables,
  }).returning()
  return c.json(created, 201)
})

// --- Experiments ---
api.get('/experiments/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const rows = await db
    .select()
    .from(experiments)
    .where(eq(experiments.organisationId, orgId))
    .orderBy(desc(experiments.createdAt))
  return c.json(rows)
})

api.post('/experiments/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const body = await c.req.json()
  const [created] = await db.insert(experiments).values({
    organisationId: orgId,
    name: body.name,
    variantA: body.variantA,
    variantB: body.variantB,
    metric: body.metric,
  }).returning()
  return c.json(created, 201)
})

api.patch('/experiments/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const [updated] = await db
    .update(experiments)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(experiments.id, id))
    .returning()
  return c.json(updated)
})

// --- Settings (Vertical Config) ---
api.get('/settings/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const [config] = await db
    .select()
    .from(verticalConfigs)
    .where(eq(verticalConfigs.organisationId, orgId))
    .limit(1)
  return c.json(config || {})
})

api.patch('/settings/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const body = await c.req.json()
  const [updated] = await db
    .update(verticalConfigs)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(verticalConfigs.organisationId, orgId))
    .returning()
  return c.json(updated)
})

// --- Organisation ---
api.get('/org/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const [org] = await db
    .select()
    .from(organisations)
    .where(eq(organisations.id, orgId))
    .limit(1)
  if (!org) return c.json({ error: 'Organisation not found' }, 404)
  return c.json(org)
})

// --- SSE Live Feed ---
api.get('/live/:orgId', async (c) => {
  const orgId = c.req.param('orgId')
  const { subscribeLiveEvents } = await import('../services/sse')

  return new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const unsubscribe = subscribeLiveEvents(orgId, (event) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        })

        // Heartbeat
        const heartbeat = setInterval(() => {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        }, 30000)

        c.req.raw.signal.addEventListener('abort', () => {
          unsubscribe()
          clearInterval(heartbeat)
          controller.close()
        })
      },
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    },
  )
})

export default api
