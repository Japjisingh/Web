import { redis } from '../lib/redis'

const SSE_CHANNEL = 'neuralgate:live'

export interface LiveEvent {
  id: string
  model: string
  endpoint: string
  inputTokens: number
  outputTokens: number
  cost: string
  latencyMs: number
  cached: boolean
  status: 'success' | 'error'
  timestamp: string
}

export async function publishLiveEvent(orgId: string, event: LiveEvent): Promise<void> {
  await redis.publish(`${SSE_CHANNEL}:${orgId}`, JSON.stringify(event))
}

export function subscribeLiveEvents(orgId: string, onMessage: (event: LiveEvent) => void): () => void {
  const sub = redis.duplicate()
  const channel = `${SSE_CHANNEL}:${orgId}`

  sub.subscribe(channel)
  sub.on('message', (_ch: string, message: string) => {
    try {
      onMessage(JSON.parse(message))
    } catch {
      // ignore parse errors
    }
  })

  return () => {
    sub.unsubscribe(channel)
    sub.disconnect()
  }
}
