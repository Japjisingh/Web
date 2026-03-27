<template>
  <div class="live-feed fade-slide-in">
    <!-- Status bar -->
    <div class="live-feed__status-bar">
      <div class="live-feed__connection">
        <StatusDot
          :color="connectionStatus === 'connected' ? 'success' : connectionStatus === 'reconnecting' ? 'warning' : 'danger'"
          :pulse="connectionStatus === 'connected'"
        />
        <span class="live-feed__connection-text">
          {{ connectionStatus === 'connected' ? 'Live' : connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline' }}
        </span>
        <span class="mono live-feed__event-count">{{ events.length }} events</span>
      </div>
      <div class="live-feed__controls">
        <button
          class="live-feed__pause-btn"
          :class="{ 'live-feed__pause-btn--paused': isPaused }"
          @click="isPaused = !isPaused"
        >
          <component :is="isPaused ? Play : Pause" :size="14" />
          {{ isPaused ? 'Resume' : 'Pause' }}
        </button>
        <button class="btn-ghost" style="height: 32px; font-size: 0.75rem" @click="clearEvents">
          Clear
        </button>
      </div>
    </div>

    <!-- Stats summary -->
    <div class="live-feed__stats">
      <div class="live-feed__stat">
        <span class="live-feed__stat-label">Requests/min</span>
        <span class="live-feed__stat-value mono">{{ requestsPerMinute }}</span>
      </div>
      <div class="live-feed__stat">
        <span class="live-feed__stat-label">Avg Latency</span>
        <span class="live-feed__stat-value mono" :style="{ color: avgLatency < 200 ? 'var(--success)' : avgLatency < 500 ? 'var(--warning)' : 'var(--danger)' }">
          {{ avgLatency }}ms
        </span>
      </div>
      <div class="live-feed__stat">
        <span class="live-feed__stat-label">Cache Rate</span>
        <span class="live-feed__stat-value mono text-success">{{ cacheRate }}%</span>
      </div>
      <div class="live-feed__stat">
        <span class="live-feed__stat-label">Error Rate</span>
        <span class="live-feed__stat-value mono" :style="{ color: errorRate > 1 ? 'var(--danger)' : 'var(--text-secondary)' }">
          {{ errorRate }}%
        </span>
      </div>
      <div class="live-feed__stat">
        <span class="live-feed__stat-label">Cost/min</span>
        <span class="live-feed__stat-value mono">£{{ costPerMinute }}</span>
      </div>
    </div>

    <!-- Filter pills -->
    <div class="live-feed__filters">
      <button
        v-for="f in filterOptions"
        :key="f.value"
        class="live-feed__filter-pill"
        :class="{ 'live-feed__filter-pill--active': activeFilter === f.value }"
        @click="activeFilter = activeFilter === f.value ? 'all' : f.value"
      >
        {{ f.label }}
      </button>
    </div>

    <!-- Event stream -->
    <div class="live-feed__stream" ref="streamRef" @mouseenter="hoverPaused = true" @mouseleave="hoverPaused = false">
      <div
        v-for="event in filteredEvents"
        :key="event.id"
        class="live-feed__event"
        :class="{
          'live-feed__event--cached': event.cached,
          'live-feed__event--error': event.status === 'error',
          'row-flash': event.isNew && !event.cached,
          'row-flash-error': event.isNew && event.status === 'error',
        }"
        @click="selectedEvent = selectedEvent?.id === event.id ? null : event"
      >
        <span class="live-feed__event-time mono">{{ formatTime(event.timestamp) }}</span>
        <ModelBadge :model="event.model" :cached="event.cached" />
        <span class="live-feed__event-endpoint mono truncate">{{ event.endpoint }}</span>
        <span class="live-feed__event-tokens mono">{{ event.tokens.input }}→{{ event.tokens.output }}</span>
        <span class="live-feed__event-cost mono">£{{ event.cost }}</span>
        <span
          class="live-feed__event-latency mono"
          :style="{ color: event.latencyMs < 100 ? 'var(--success)' : event.latencyMs < 500 ? 'var(--warning)' : 'var(--danger)' }"
        >
          {{ event.latencyMs }}ms
        </span>
        <span v-if="event.cached" class="live-feed__cache-badge mono">CACHED</span>
        <StatusDot :color="event.status === 'error' ? 'danger' : 'success'" />
      </div>

      <EmptyState
        v-if="filteredEvents.length === 0"
        title="No live events"
        description="Waiting for requests to flow through NeuralGate..."
        icon="activity"
      />
    </div>

    <!-- Event detail -->
    <Transition name="page">
      <div v-if="selectedEvent" class="live-feed__detail card">
        <div class="live-feed__detail-header">
          <h3>Request Detail</h3>
          <button class="btn-ghost" style="padding: 4px" @click="selectedEvent = null">
            <X :size="16" />
          </button>
        </div>
        <div class="live-feed__detail-grid">
          <div class="live-feed__detail-item">
            <span class="live-feed__detail-label">Request ID</span>
            <span class="mono">{{ selectedEvent.id }}</span>
          </div>
          <div class="live-feed__detail-item">
            <span class="live-feed__detail-label">Model</span>
            <ModelBadge :model="selectedEvent.model" />
          </div>
          <div class="live-feed__detail-item">
            <span class="live-feed__detail-label">Endpoint</span>
            <span class="mono">{{ selectedEvent.endpoint }}</span>
          </div>
          <div class="live-feed__detail-item">
            <span class="live-feed__detail-label">Tokens</span>
            <span class="mono">{{ selectedEvent.tokens.input }} input → {{ selectedEvent.tokens.output }} output</span>
          </div>
          <div class="live-feed__detail-item">
            <span class="live-feed__detail-label">Cost</span>
            <span class="mono">£{{ selectedEvent.cost }}</span>
          </div>
          <div class="live-feed__detail-item">
            <span class="live-feed__detail-label">Latency</span>
            <span class="mono">{{ selectedEvent.latencyMs }}ms</span>
          </div>
          <div class="live-feed__detail-item">
            <span class="live-feed__detail-label">Cached</span>
            <span class="mono">{{ selectedEvent.cached ? 'Yes' : 'No' }}</span>
          </div>
          <div class="live-feed__detail-item">
            <span class="live-feed__detail-label">Timestamp</span>
            <span class="mono">{{ new Date(selectedEvent.timestamp).toLocaleString() }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Pause, Play, X } from 'lucide-vue-next'
import type { LiveActivityEvent } from '@neuralgate/shared/types'

definePageMeta({ layout: 'default' })

interface LiveEvent extends LiveActivityEvent {
  isNew?: boolean
}

const streamRef = ref<HTMLElement>()
const isPaused = ref(false)
const hoverPaused = ref(false)
const activeFilter = ref('all')
const selectedEvent = ref<LiveEvent | null>(null)
const connectionStatus = ref<'connected' | 'reconnecting' | 'offline'>('connected')

const filterOptions = [
  { label: 'All', value: 'all' },
  { label: 'Cached', value: 'cached' },
  { label: 'Errors', value: 'errors' },
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-4o Mini', value: 'gpt-4o-mini' },
  { label: 'Claude', value: 'claude' },
  { label: 'Gemini', value: 'gemini' },
]

// Demo events
const events = ref<LiveEvent[]>(generateDemoEvents())

function generateDemoEvents(): LiveEvent[] {
  const models = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet', 'gpt-4o-mini', 'gemini', 'gpt-4o', 'gpt-4o-mini', 'claude-sonnet']
  const endpoints = ['/api/chat', '/api/faq', '/api/generate', '/api/classify', '/api/translate', '/api/summarize', '/api/embed', '/api/review']
  const items: LiveEvent[] = []

  for (let i = 0; i < 50; i++) {
    const model = models[i % models.length]
    const cached = Math.random() > 0.65
    const isError = !cached && Math.random() > 0.95
    const inputTokens = Math.floor(Math.random() * 2000) + 50
    const outputTokens = cached ? 0 : Math.floor(Math.random() * 1500) + 50

    items.push({
      id: crypto.randomUUID(),
      model,
      endpoint: endpoints[i % endpoints.length],
      tokens: { input: inputTokens, output: outputTokens },
      cost: cached ? '0.0000' : (Math.random() * 0.02).toFixed(4),
      latencyMs: cached ? Math.floor(Math.random() * 20) + 5 : Math.floor(Math.random() * 800) + 50,
      cached,
      status: isError ? 'error' : 'success',
      timestamp: new Date(Date.now() - i * 3000),
      isNew: i < 3,
    })
  }
  return items
}

// Simulate live events
let interval: ReturnType<typeof setInterval>
onMounted(() => {
  interval = setInterval(() => {
    if (isPaused.value || hoverPaused.value) return
    const models = ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet', 'gemini']
    const endpoints = ['/api/chat', '/api/faq', '/api/generate', '/api/classify']
    const model = models[Math.floor(Math.random() * models.length)]
    const cached = Math.random() > 0.65
    const inputTokens = Math.floor(Math.random() * 1500) + 50
    const outputTokens = cached ? 0 : Math.floor(Math.random() * 1000) + 50

    const newEvent: LiveEvent = {
      id: crypto.randomUUID(),
      model,
      endpoint: endpoints[Math.floor(Math.random() * endpoints.length)],
      tokens: { input: inputTokens, output: outputTokens },
      cost: cached ? '0.0000' : (Math.random() * 0.015).toFixed(4),
      latencyMs: cached ? Math.floor(Math.random() * 15) + 3 : Math.floor(Math.random() * 600) + 40,
      cached,
      status: Math.random() > 0.97 ? 'error' : 'success',
      timestamp: new Date(),
      isNew: true,
    }

    events.value = [newEvent, ...events.value.slice(0, 99)]
    setTimeout(() => { newEvent.isNew = false }, 1000)
  }, 2000)
})

onUnmounted(() => clearInterval(interval))

const filteredEvents = computed(() => {
  if (activeFilter.value === 'all') return events.value
  if (activeFilter.value === 'cached') return events.value.filter((e) => e.cached)
  if (activeFilter.value === 'errors') return events.value.filter((e) => e.status === 'error')
  return events.value.filter((e) => e.model.includes(activeFilter.value))
})

const requestsPerMinute = computed(() => {
  const oneMinAgo = Date.now() - 60000
  return events.value.filter((e) => new Date(e.timestamp).getTime() > oneMinAgo).length
})

const avgLatency = computed(() => {
  if (events.value.length === 0) return 0
  return Math.round(events.value.reduce((s, e) => s + e.latencyMs, 0) / events.value.length)
})

const cacheRate = computed(() => {
  if (events.value.length === 0) return '0.0'
  return ((events.value.filter((e) => e.cached).length / events.value.length) * 100).toFixed(1)
})

const errorRate = computed(() => {
  if (events.value.length === 0) return '0.0'
  return ((events.value.filter((e) => e.status === 'error').length / events.value.length) * 100).toFixed(1)
})

const costPerMinute = computed(() => {
  const oneMinAgo = Date.now() - 60000
  const recent = events.value.filter((e) => new Date(e.timestamp).getTime() > oneMinAgo)
  return recent.reduce((s, e) => s + parseFloat(e.cost), 0).toFixed(4)
})

function formatTime(ts: Date | string) {
  const d = typeof ts === 'string' ? new Date(ts) : ts
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function clearEvents() {
  events.value = []
}
</script>

<style scoped>
.live-feed {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.live-feed__status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.live-feed__connection {
  display: flex;
  align-items: center;
  gap: 8px;
}

.live-feed__connection-text {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.live-feed__event-count {
  font-size: 0.6875rem;
  color: var(--text-muted);
  margin-left: 8px;
}

.live-feed__controls {
  display: flex;
  gap: 6px;
}

.live-feed__pause-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  transition: all var(--transition-fast);
}

.live-feed__pause-btn:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.live-feed__pause-btn--paused {
  border-color: var(--warning);
  color: var(--warning);
}

/* Stats */
.live-feed__stats {
  display: flex;
  gap: 16px;
}

.live-feed__stat {
  flex: 1;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: var(--card-radius);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.live-feed__stat-label {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.live-feed__stat-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

/* Filters */
.live-feed__filters {
  display: flex;
  gap: 4px;
}

.live-feed__filter-pill {
  padding: 4px 10px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-muted);
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 9999px;
  transition: all var(--transition-fast);
}

.live-feed__filter-pill:hover {
  color: var(--text-secondary);
  border-color: var(--border-strong);
}

.live-feed__filter-pill--active {
  color: var(--primary);
  border-color: var(--primary);
  background: var(--primary-muted);
}

/* Stream */
.live-feed__stream {
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: var(--card-radius);
  overflow-y: auto;
  max-height: calc(100vh - 380px);
}

.live-feed__event {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-base);
  font-size: 0.75rem;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.live-feed__event:hover {
  background: var(--bg-subtle);
}

.live-feed__event--error {
  border-left: 2px solid var(--danger);
}

.live-feed__event--cached {
  border-left: 2px solid var(--success);
}

.live-feed__event-time {
  font-size: 0.6875rem;
  color: var(--text-muted);
  min-width: 64px;
}

.live-feed__event-endpoint {
  flex: 1;
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.live-feed__event-tokens {
  font-size: 0.6875rem;
  color: var(--text-muted);
  min-width: 80px;
  text-align: right;
}

.live-feed__event-cost {
  font-size: 0.6875rem;
  color: var(--text-primary);
  min-width: 60px;
  text-align: right;
}

.live-feed__event-latency {
  font-size: 0.6875rem;
  min-width: 48px;
  text-align: right;
}

.live-feed__cache-badge {
  font-size: 0.5625rem;
  font-weight: 600;
  color: var(--success);
  background: var(--success-muted);
  padding: 1px 6px;
  border-radius: 4px;
}

/* Detail panel */
.live-feed__detail {
  margin-top: 8px;
}

.live-feed__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.live-feed__detail-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
}

.live-feed__detail-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.live-feed__detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.live-feed__detail-label {
  font-size: 0.625rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.live-feed__detail-item .mono {
  font-size: 0.8125rem;
  color: var(--text-primary);
}
</style>
