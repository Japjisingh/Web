import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { db } from '@neuralgate/database/client'
import { aiRequests, usageSnapshots, optimisationRecommendations } from '@neuralgate/database/schema'
import { eq, sql, and } from 'drizzle-orm'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
})

// Request logging worker
const requestWorker = new Worker(
  'request-processing',
  async (job) => {
    const data = job.data

    await db.insert(aiRequests).values({
      organisationId: data.organisationId,
      apiKeyId: data.apiKeyId,
      provider: data.provider,
      model: data.model,
      endpoint: data.endpoint,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalTokens: data.inputTokens + data.outputTokens,
      costUsd: String(data.cost),
      latencyMs: data.latencyMs,
      statusCode: data.statusCode,
      cached: data.cached,
      cacheKey: data.cacheKey,
    })
  },
  { connection: redis, concurrency: 20 },
)

// Analytics aggregation worker
const analyticsWorker = new Worker(
  'analytics-aggregation',
  async (job) => {
    const { organisationId, date } = job.data

    // Aggregate requests for the given date into usage snapshots
    const stats = await db
      .select({
        provider: aiRequests.provider,
        model: aiRequests.model,
        totalRequests: sql<number>`count(*)`,
        totalTokens: sql<number>`coalesce(sum(${aiRequests.totalTokens}), 0)`,
        totalCost: sql<string>`coalesce(sum(${aiRequests.costUsd}::numeric), 0)`,
        cachedRequests: sql<number>`count(*) filter (where ${aiRequests.cached} = true)`,
        avgLatency: sql<number>`coalesce(avg(${aiRequests.latencyMs}), 0)`,
        errorCount: sql<number>`count(*) filter (where ${aiRequests.statusCode} >= 400)`,
      })
      .from(aiRequests)
      .where(
        and(
          eq(aiRequests.organisationId, organisationId),
          sql`${aiRequests.createdAt}::date = ${date}`,
        ),
      )
      .groupBy(aiRequests.provider, aiRequests.model)

    for (const stat of stats) {
      // Calculate saved cost (cached requests * average cost per request)
      const avgCostPerRequest = stat.totalRequests > 0
        ? parseFloat(stat.totalCost) / stat.totalRequests
        : 0
      const savedCost = stat.cachedRequests * avgCostPerRequest

      await db
        .insert(usageSnapshots)
        .values({
          organisationId,
          date,
          provider: stat.provider,
          model: stat.model,
          totalRequests: stat.totalRequests,
          totalTokens: stat.totalTokens,
          totalCostUsd: stat.totalCost,
          cachedRequests: stat.cachedRequests,
          savedCostUsd: savedCost.toFixed(6),
          avgLatencyMs: Math.round(stat.avgLatency),
          errorCount: stat.errorCount,
        })
    }

    console.log(`Aggregated analytics for ${organisationId} on ${date}`)
  },
  { connection: redis, concurrency: 5 },
)

// Optimisation scanner — runs periodically
async function scanForOptimisations() {
  console.log('Scanning for optimisation opportunities...')

  // Find frequently repeated queries that aren't being cached
  const duplicates = await db
    .select({
      organisationId: aiRequests.organisationId,
      model: aiRequests.model,
      endpoint: aiRequests.endpoint,
      requestCount: sql<number>`count(*)`,
      totalCost: sql<string>`sum(${aiRequests.costUsd}::numeric)`,
    })
    .from(aiRequests)
    .where(
      and(
        eq(aiRequests.cached, false),
        sql`${aiRequests.createdAt} > now() - interval '30 days'`,
      ),
    )
    .groupBy(aiRequests.organisationId, aiRequests.model, aiRequests.endpoint)
    .having(sql`count(*) > 100`)

  for (const dup of duplicates) {
    if (!dup.endpoint) continue
    const estimatedSaving = (parseFloat(dup.totalCost) * 0.34).toFixed(2)

    // Check if recommendation already exists
    const existing = await db
      .select()
      .from(optimisationRecommendations)
      .where(
        and(
          eq(optimisationRecommendations.organisationId, dup.organisationId),
          eq(optimisationRecommendations.type, 'cache'),
          sql`${optimisationRecommendations.metadata}::text like ${`%${dup.endpoint}%`}`,
        ),
      )
      .limit(1)

    if (existing.length === 0) {
      await db.insert(optimisationRecommendations).values({
        organisationId: dup.organisationId,
        type: 'cache',
        title: `Cache ${dup.endpoint} responses`,
        description: `${dup.endpoint} is called ${dup.requestCount} times/month on ${dup.model} without caching.`,
        estimatedSavingUsd: estimatedSaving,
        priority: parseFloat(estimatedSaving) > 200 ? 'high' : 'medium',
        metadata: JSON.stringify({ endpoint: dup.endpoint, model: dup.model }),
      })
    }
  }

  console.log('Optimisation scan complete')
}

// Event handlers
requestWorker.on('completed', (job) => {
  // Silently log
})

requestWorker.on('failed', (job, err) => {
  console.error(`Request logging failed for job ${job?.id}:`, err.message)
})

analyticsWorker.on('failed', (job, err) => {
  console.error(`Analytics aggregation failed for job ${job?.id}:`, err.message)
})

// Run optimisation scan every hour
setInterval(scanForOptimisations, 60 * 60 * 1000)

console.log('NeuralGate Worker started')
console.log('  - Request processing worker: active')
console.log('  - Analytics aggregation worker: active')
console.log('  - Optimisation scanner: every 60 minutes')

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down workers...')
  await requestWorker.close()
  await analyticsWorker.close()
  process.exit(0)
})
