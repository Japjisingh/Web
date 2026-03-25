<template>
  <div class="overview fade-slide-in">
    <!-- Hero metrics row -->
    <div class="grid-cols-4">
      <MetricCard
        title="Total Requests"
        :value="metrics.totalRequests"
        format="number"
        :change="12.4"
        change-period="vs last period"
        :sparkline-data="sparklines.requests"
        icon="trending-up"
        :loading="loading"
      />
      <MetricCard
        title="Total Cost"
        :value="metrics.totalCost"
        format="currency"
        :change="-8.2"
        change-period="vs last period"
        icon="dollar-sign"
        :sparkline-data="sparklines.cost"
        :loading="loading"
      />
      <MetricCard
        title="Total Saved"
        :value="metrics.totalSaved"
        format="currency"
        :change="23.1"
        change-period="vs no optimisation"
        icon="zap"
        :sparkline-data="sparklines.saved"
        :loading="loading"
      />
      <MetricCard
        title="Cache Hit Rate"
        :value="metrics.cacheRate"
        format="percent"
        :change="4.1"
        change-period="vs last period"
        icon="database"
        :sparkline-data="sparklines.cache"
        :loading="loading"
      />
    </div>

    <!-- Second row: Chart + Live feed -->
    <div class="overview__row-2">
      <div class="card overview__main-chart">
        <div class="card__header">
          <h3 class="card__title">Cost Over Time</h3>
          <div class="card__tabs">
            <button
              v-for="tab in ['By Day', 'By Model', 'By Provider']"
              :key="tab"
              class="card__tab"
              :class="{ 'card__tab--active': costView === tab }"
              @click="costView = tab"
            >
              {{ tab }}
            </button>
          </div>
        </div>
        <AreaChart
          v-if="!loading"
          :labels="dailyLabels"
          :datasets="costDatasets"
          :height="280"
          :stacked="true"
        />
        <div v-else class="skeleton" style="width: 100%; height: 280px" />
      </div>

      <div class="card overview__live-panel">
        <div class="card__header">
          <h3 class="card__title">
            Live Activity
            <StatusDot color="success" :pulse="true" />
          </h3>
          <span class="mono" style="font-size: 0.6875rem; color: var(--text-muted)">
            {{ demoEvents.length }} events
          </span>
        </div>
        <div class="overview__live-feed">
          <div
            v-for="event in demoEvents"
            :key="event.id"
            class="overview__live-row"
            :class="{
              'row-flash': event.isNew,
              'overview__live-row--error': event.status === 'error'
            }"
          >
            <ModelBadge :model="event.model" :cached="event.cached" />
            <span class="overview__live-endpoint truncate mono">{{ event.endpoint }}</span>
            <span class="overview__live-tokens mono">{{ event.tokens }}</span>
            <span class="overview__live-cost mono">{{ event.cost }}</span>
            <span class="overview__live-latency mono" :style="{ color: getLatencyColor(event.latencyMs) }">
              {{ event.latencyMs }}ms
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Third row: Savings + Donut + Health -->
    <div class="overview__row-3">
      <div class="card overview__savings">
        <div class="card__header">
          <h3 class="card__title">Savings Breakdown</h3>
          <span class="mono" style="font-size: 0.6875rem; color: var(--text-muted)">MTD</span>
        </div>
        <div class="overview__savings-numbers">
          <div class="overview__savings-line">
            <span class="text-secondary">Actual spend</span>
            <span class="mono" style="font-size: 1.25rem; font-weight: 700">£1,240</span>
          </div>
          <div class="overview__savings-line">
            <span class="text-secondary">Without NeuralGate</span>
            <span class="mono text-muted">£2,130</span>
          </div>
          <div class="overview__savings-divider" />
          <div class="overview__savings-line">
            <span class="text-secondary">Total saved</span>
            <span class="mono text-success" style="font-size: 1.25rem; font-weight: 700">£890</span>
          </div>
        </div>
        <div class="overview__savings-bars">
          <div class="overview__savings-bar">
            <div class="overview__savings-bar-header">
              <span>Caching</span><span class="mono">£420</span>
            </div>
            <div class="overview__savings-bar-track">
              <div class="overview__savings-bar-fill progress-animate" style="width: 47%; background: var(--success)" />
            </div>
          </div>
          <div class="overview__savings-bar">
            <div class="overview__savings-bar-header">
              <span>Routing</span><span class="mono">£310</span>
            </div>
            <div class="overview__savings-bar-track">
              <div class="overview__savings-bar-fill progress-animate" style="width: 35%; background: var(--primary)" />
            </div>
          </div>
          <div class="overview__savings-bar">
            <div class="overview__savings-bar-header">
              <span>Compression</span><span class="mono">£160</span>
            </div>
            <div class="overview__savings-bar-track">
              <div class="overview__savings-bar-fill progress-animate" style="width: 18%; background: var(--warning)" />
            </div>
          </div>
        </div>
        <p class="overview__roi mono">ROI: 71.8% <span class="text-success">↑ from 68.2% last month</span></p>
      </div>

      <div class="card overview__model-usage">
        <div class="card__header">
          <h3 class="card__title">Model Usage</h3>
        </div>
        <DonutChart :data="modelUsageData" :height="200" center-text="8 models" />
      </div>

      <div class="card overview__provider-health">
        <div class="card__header">
          <h3 class="card__title">Provider Health</h3>
        </div>
        <div class="overview__providers">
          <div v-for="p in providerHealth" :key="p.name" class="overview__provider-row">
            <StatusDot :color="p.status" :pulse="p.status === 'success'" />
            <span class="overview__provider-name">{{ p.name }}</span>
            <span class="mono text-secondary">{{ p.uptime }}</span>
            <span class="mono" :style="{ color: getLatencyColor(p.latency) }">{{ p.latency }}ms</span>
          </div>
        </div>
        <p class="overview__health-updated text-muted" style="font-size: 0.6875rem; margin-top: 12px">
          Last checked 12s ago
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const loading = ref(false)
const costView = ref('By Day')

// Demo data
const metrics = reactive({
  totalRequests: 2847293,
  totalCost: 1240.83,
  totalSaved: 890.40,
  cacheRate: 34.2,
})

const sparklines = {
  requests: [78, 85, 92, 88, 95, 102, 110],
  cost: [48, 42, 45, 38, 35, 40, 37],
  saved: [22, 28, 35, 41, 52, 68, 78],
  cache: [28, 30, 31, 33, 32, 34, 35],
}

const dailyLabels = Array.from({ length: 30 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - 29 + i)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
})

const costDatasets = [
  {
    name: 'API Cost',
    data: Array.from({ length: 30 }, () => 30 + Math.random() * 20),
    color: '#5b5ef4',
  },
  {
    name: 'Cache Savings',
    data: Array.from({ length: 30 }, () => 10 + Math.random() * 15),
    color: '#00d97e',
  },
]

const demoEvents = ref([
  { id: '1', model: 'gpt-4o', endpoint: '/api/chat', tokens: '512→1024', cost: '£0.0038', latencyMs: 284, cached: false, status: 'success', isNew: false },
  { id: '2', model: 'gpt-4o-mini', endpoint: '/api/faq', tokens: '128→256', cost: '£0.0002', latencyMs: 92, cached: true, status: 'success', isNew: false },
  { id: '3', model: 'claude-sonnet', endpoint: '/api/generate', tokens: '1024→2048', cost: '£0.0120', latencyMs: 567, cached: false, status: 'success', isNew: false },
  { id: '4', model: 'gpt-4o-mini', endpoint: '/api/classify', tokens: '64→32', cost: '£0.0001', latencyMs: 45, cached: true, status: 'success', isNew: false },
  { id: '5', model: 'gpt-4o', endpoint: '/api/summarize', tokens: '2048→512', cost: '£0.0058', latencyMs: 892, cached: false, status: 'error', isNew: false },
  { id: '6', model: 'gemini', endpoint: '/api/translate', tokens: '256→256', cost: '£0.0001', latencyMs: 124, cached: false, status: 'success', isNew: false },
  { id: '7', model: 'gpt-4o-mini', endpoint: '/api/embed', tokens: '512→0', cost: '£0.0001', latencyMs: 67, cached: true, status: 'success', isNew: false },
  { id: '8', model: 'claude-sonnet', endpoint: '/api/review', tokens: '4096→1024', cost: '£0.0275', latencyMs: 1240, cached: false, status: 'success', isNew: false },
])

const modelUsageData = [
  { name: 'GPT-4o', value: 42, color: '#5b5ef4' },
  { name: 'GPT-4o Mini', value: 28, color: '#3b82f6' },
  { name: 'Claude Sonnet', value: 15, color: '#f97316' },
  { name: 'Gemini Flash', value: 8, color: '#06b6d4' },
  { name: 'Others', value: 7, color: '#55556a' },
]

const providerHealth = [
  { name: 'OpenAI', uptime: '99.98%', latency: 42, status: 'success' as const },
  { name: 'Anthropic', uptime: '99.95%', latency: 67, status: 'success' as const },
  { name: 'Google', uptime: '100%', latency: 38, status: 'success' as const },
  { name: 'Mistral', uptime: '99.90%', latency: 89, status: 'success' as const },
]

function getLatencyColor(ms: number): string {
  if (ms < 100) return 'var(--success)'
  if (ms < 500) return 'var(--warning)'
  return 'var(--danger)'
}
</script>

<style scoped>
.overview {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Row 2 */
.overview__row-2 {
  display: grid;
  grid-template-columns: 65fr 35fr;
  gap: 16px;
}

.card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.card__title {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.card__tabs {
  display: flex;
  gap: 2px;
  background: var(--bg-elevated);
  border-radius: 4px;
  padding: 2px;
}

.card__tab {
  padding: 3px 8px;
  font-size: 0.6875rem;
  color: var(--text-muted);
  border-radius: 3px;
  transition: all var(--transition-fast);
}

.card__tab:hover { color: var(--text-secondary); }
.card__tab--active { color: var(--text-primary); background: var(--bg-overlay); }

/* Live feed */
.overview__live-panel {
  display: flex;
  flex-direction: column;
}

.overview__live-feed {
  flex: 1;
  overflow-y: auto;
  max-height: 300px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.overview__live-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 0.75rem;
  border-bottom: 1px solid var(--border-base);
}

.overview__live-row--error {
  border-left: 2px solid var(--danger);
  padding-left: 6px;
}

.overview__live-endpoint { flex: 1; font-size: 0.6875rem; color: var(--text-secondary); }
.overview__live-tokens { font-size: 0.6875rem; color: var(--text-muted); }
.overview__live-cost { font-size: 0.6875rem; min-width: 56px; text-align: right; }
.overview__live-latency { font-size: 0.6875rem; min-width: 48px; text-align: right; }

/* Row 3 */
.overview__row-3 {
  display: grid;
  grid-template-columns: 40fr 30fr 30fr;
  gap: 16px;
}

/* Savings */
.overview__savings-numbers {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.overview__savings-line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.8125rem;
}

.overview__savings-divider {
  height: 1px;
  background: var(--border-base);
  margin: 4px 0;
}

.overview__savings-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.overview__savings-bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.overview__savings-bar-track {
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.overview__savings-bar-fill {
  height: 100%;
  border-radius: 3px;
}

.overview__roi {
  margin-top: 16px;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

/* Provider health */
.overview__providers {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.overview__provider-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8125rem;
}

.overview__provider-name {
  flex: 1;
  color: var(--text-primary);
  font-weight: 500;
}
</style>
