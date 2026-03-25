import { createMiddleware } from 'hono/factory'
import crypto from 'node:crypto'
import { db } from '@neuralgate/database/client'
import { apiKeys, organisations } from '@neuralgate/database/schema'
import { eq } from 'drizzle-orm'
import { cacheRedis } from '../lib/redis'

interface ApiKeyContext {
  apiKey: {
    id: string
    organisationId: string
    vertical: string | null
    rateLimitPerMinute: number | null
    allowedProviders: string[] | null
  }
  organisation: {
    id: string
    name: string
    plan: string
    vertical: string
  }
}

export const apiKeyAuth = createMiddleware<{ Variables: ApiKeyContext }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const key = authHeader.slice(7)
  if (!key.startsWith('ng_')) {
    return c.json({ error: 'Invalid API key format' }, 401)
  }

  const keyHash = crypto.createHash('sha256').update(key).digest('hex')

  // Check Redis cache first
  const cached = await cacheRedis.get(`apikey:${keyHash}`)
  if (cached) {
    const data = JSON.parse(cached) as ApiKeyContext
    c.set('apiKey', data.apiKey)
    c.set('organisation', data.organisation)
    return next()
  }

  // Query database
  const result = await db
    .select({
      keyId: apiKeys.id,
      keyOrgId: apiKeys.organisationId,
      keyVertical: apiKeys.vertical,
      keyRateLimit: apiKeys.rateLimitPerMinute,
      keyProviders: apiKeys.allowedProviders,
      keyActive: apiKeys.isActive,
      keyExpires: apiKeys.expiresAt,
      orgId: organisations.id,
      orgName: organisations.name,
      orgPlan: organisations.plan,
      orgVertical: organisations.vertical,
      orgActive: organisations.isActive,
    })
    .from(apiKeys)
    .innerJoin(organisations, eq(apiKeys.organisationId, organisations.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1)

  if (result.length === 0) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  const row = result[0]

  if (!row.keyActive || !row.orgActive) {
    return c.json({ error: 'API key or organisation is deactivated' }, 403)
  }

  if (row.keyExpires && new Date(row.keyExpires) < new Date()) {
    return c.json({ error: 'API key has expired' }, 403)
  }

  const data: ApiKeyContext = {
    apiKey: {
      id: row.keyId,
      organisationId: row.keyOrgId,
      vertical: row.keyVertical,
      rateLimitPerMinute: row.keyRateLimit,
      allowedProviders: row.keyProviders,
    },
    organisation: {
      id: row.orgId,
      name: row.orgName,
      plan: row.orgPlan,
      vertical: row.orgVertical,
    },
  }

  c.set('apiKey', data.apiKey)
  c.set('organisation', data.organisation)

  // Cache for 5 minutes
  await cacheRedis.setex(`apikey:${keyHash}`, 300, JSON.stringify(data))

  // Update last used
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.keyId))

  return next()
})
