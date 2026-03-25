import type { LiveActivityEvent } from '@neuralgate/shared/types'

const MAX_EVENTS = 100

export function useLiveActivity(orgId: Ref<string>) {
  const events = ref<LiveActivityEvent[]>([])
  const status = ref<'connected' | 'reconnecting' | 'offline'>('offline')
  const paused = ref(false)
  let eventSource: EventSource | null = null
  let reconnectAttempts = 0

  const baseUrl = import.meta.env?.VITE_GATEWAY_URL || 'http://localhost:4000'

  function connect() {
    if (!orgId.value) return

    eventSource = new EventSource(`${baseUrl}/api/live/${orgId.value}`)

    eventSource.onopen = () => {
      status.value = 'connected'
      reconnectAttempts = 0
    }

    eventSource.onmessage = (e) => {
      if (paused.value) return
      try {
        const event = JSON.parse(e.data) as LiveActivityEvent
        events.value = [event, ...events.value.slice(0, MAX_EVENTS - 1)]
      } catch {
        // ignore parse errors
      }
    }

    eventSource.onerror = () => {
      status.value = 'reconnecting'
      eventSource?.close()
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
      reconnectAttempts++
      setTimeout(connect, delay)
    }
  }

  function disconnect() {
    eventSource?.close()
    eventSource = null
    status.value = 'offline'
  }

  watch(orgId, (val) => {
    if (val) {
      disconnect()
      connect()
    }
  }, { immediate: true })

  onUnmounted(disconnect)

  return {
    events: readonly(events),
    status: readonly(status),
    paused,
    connect,
    disconnect,
  }
}
