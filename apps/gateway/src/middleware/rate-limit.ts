import { createMiddleware } from 'hono/factory'
import { cacheRedis } from '../lib/redis'

export const rateLimit = createMiddleware(async (c, next) => {
  const apiKey = c.get('apiKey' as never) as { id: string; rateLimitPerMinute: number | null } | undefined
  if (!apiKey?.rateLimitPerMinute) return next()

  const key = `ratelimit:${apiKey.id}:${Math.floor(Date.now() / 60000)}`
  const current = await cacheRedis.incr(key)

  if (current === 1) {
    await cacheRedis.expire(key, 60)
  }

  c.header('X-RateLimit-Limit', String(apiKey.rateLimitPerMinute))
  c.header('X-RateLimit-Remaining', String(Math.max(0, apiKey.rateLimitPerMinute - current)))

  if (current > apiKey.rateLimitPerMinute) {
    return c.json(
      { error: 'Rate limit exceeded', retryAfter: 60 - (Math.floor(Date.now() / 1000) % 60) },
      429,
    )
  }

  return next()
})
