import crypto from 'node:crypto'
import { cacheRedis } from './redis'

export function generateCacheKey(model: string, messages: unknown[]): string {
  const payload = JSON.stringify({ model, messages })
  return `cache:${crypto.createHash('sha256').update(payload).digest('hex')}`
}

export async function getCachedResponse(key: string): Promise<string | null> {
  return cacheRedis.get(key)
}

export async function setCachedResponse(
  key: string,
  response: string,
  ttlSeconds = 86400,
): Promise<void> {
  await cacheRedis.setex(key, ttlSeconds, response)
}

export async function invalidateCache(pattern: string): Promise<number> {
  const keys = await cacheRedis.keys(pattern)
  if (keys.length === 0) return 0
  return cacheRedis.del(...keys)
}
