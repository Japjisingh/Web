<template>
  <div class="requests fade-slide-in">
    <!-- Stats bar -->
    <div class="requests__stats">
      <div class="requests__stat">
        <span class="requests__stat-label">Total</span>
        <span class="requests__stat-value mono">{{ stats.total.toLocaleString() }}</span>
      </div>
      <div class="requests__stat-divider" />
      <div class="requests__stat">
        <span class="requests__stat-label">Cached</span>
        <span class="requests__stat-value mono text-success">{{ stats.cachedPct }}%</span>
      </div>
      <div class="requests__stat-divider" />
      <div class="requests__stat">
        <span class="requests__stat-label">Errors</span>
        <span class="requests__stat-value mono text-danger">{{ stats.errorPct }}%</span>
      </div>
      <div class="requests__stat-divider" />
      <div class="requests__stat">
        <span class="requests__stat-label">Avg Cost</span>
        <span class="requests__stat-value mono">&pound;{{ stats.avgCost }}</span>
      </div>
      <div class="requests__stat-divider" />
      <div class="requests__stat">
        <span class="requests__stat-label">Avg Latency</span>
        <span class="requests__stat-value mono" :style="{ color: getLatencyColor(stats.avgLatency) }">{{ stats.avgLatency }}ms</span>
      </div>
      <div class="requests__stat-divider" />
      <div class="requests__stat">
        <span class="requests__stat-label">Saved</span>
        <span class="requests__stat-value mono text-success">&pound;{{ stats.saved }}</span>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="requests__filters">
      <div class="requests__filter-group">
        <span class="requests__filter-label">Provider</span>
        <div class="requests__pills">
          <button
            v-for="provider in providers"
            :key="provider"
            class="requests__pill"
            :class="{ 'requests__pill--active': activeProviders.has(provider) }"
            @click="toggleProvider(provider)"
          >
            {{ provider }}
          </button>
        </div>
      </div>

      <div class="requests__filter-group">
        <span class="requests__filter-label">Model</span>
        <select v-model="selectedModel" class="requests__select">
          <option value="">All Models</option>
          <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <div class="requests__filter-group">
        <span class="requests__filter-label">Status</span>
        <div class="requests__pills">
          <button
            v-for="s in statusFilters"
            :key="s"
            class="requests__pill"
            :class="{ 'requests__pill--active': activeStatuses.has(s) }"
            @click="toggleStatus(s)"
          >
            {{ s }}
          </button>
        </div>
      </div>

      <div class="requests__filter-spacer" />

      <div class="requests__live-toggle">
        <span class="requests__filter-label">Live Mode</span>
        <button
          class="requests__live-btn"
          :class="{ 'requests__live-btn--active': liveMode }"
          @click="liveMode = !liveMode"
        >
          <StatusDot v-if="liveMode" color="success" :pulse="true" />
          <component :is="liveMode ? RadioIcon : RadioIcon" :size="14" />
          {{ liveMode ? 'On' : 'Off' }}
        </button>
      </div>
    </div>

    <!-- Data table -->
    <DataTable
      :columns="columns"
      :rows="filteredRows"
      :total="demoRequests.length"
      @row-click="toggleExpand"
    >
      <template #cell-time="{ row }">
        <span class="mono text-secondary" style="font-size: 0.75rem">{{ formatRelativeTime(row.timestamp as number) }}</span>
      </template>

      <template #cell-endpoint="{ row }">
        <span class="mono" style="font-size: 0.75rem; color: var(--text-primary)">{{ row.endpoint }}</span>
      </template>

      <template #cell-model="{ row }">
        <ModelBadge :model="row.model as string" :cached="row.cached as boolean" />
      </template>

      <template #cell-tokens="{ row }">
        <span class="mono" style="font-size: 0.75rem; color: var(--text-secondary)">
          {{ row.tokensIn }}<span class="text-muted">&rarr;</span>{{ row.tokensOut }}
        </span>
      </template>

      <template #cell-cost="{ row }">
        <span class="mono" style="font-size: 0.75rem">&pound;{{ (row.cost as number).toFixed(4) }}</span>
      </template>

      <template #cell-latency="{ row }">
        <span class="mono" style="font-size: 0.75rem" :style="{ color: getLatencyColor(row.latency as number) }">
          {{ row.latency }}ms
        </span>
      </template>

      <template #cell-cache="{ row }">
        <span
          v-if="row.cached"
          class="requests__cache-badge"
        >
          HIT
        </span>
        <span v-else class="requests__cache-badge requests__cache-badge--miss">MISS</span>
      </template>

      <template #cell-status="{ row }">
        <div class="requests__status-cell">
          <StatusDot :color="row.status === 'success' ? 'success' : row.status === 'cached' ? 'info' : 'danger'" />
          <span style="font-size: 0.75rem">{{ row.statusCode }}</span>
        </div>
      </template>
    </DataTable>

    <!-- Expanded detail panel (inline, below table row) -->
    <Transition name="detail-slide">
      <div v-if="expandedRow" class="requests__detail" :key="(expandedRow as any).id">
        <div class="requests__detail-header">
          <div class="requests__detail-title">
            <span class="mono" style="font-size: 0.875rem; font-weight: 600">{{ expandedRow.endpoint }}</span>
            <ModelBadge :model="expandedRow.model as string" :cached="expandedRow.cached as boolean" />
            <StatusDot :color="expandedRow.status === 'success' ? 'success' : 'danger'" />
          </div>
          <button class="requests__detail-close" @click="expandedRow = null">
            <XIcon :size="16" />
          </button>
        </div>
        <div class="requests__detail-grid">
          <div class="requests__detail-section">
            <h4 class="requests__detail-section-title">Request Info</h4>
            <div class="requests__detail-row">
              <span class="text-secondary">Request ID</span>
              <span class="mono">{{ expandedRow.id }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Timestamp</span>
              <span class="mono">{{ new Date(expandedRow.timestamp as number).toLocaleString() }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Provider</span>
              <span>{{ expandedRow.provider }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Model</span>
              <span class="mono">{{ expandedRow.model }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Endpoint</span>
              <span class="mono">{{ expandedRow.endpoint }}</span>
            </div>
          </div>
          <div class="requests__detail-section">
            <h4 class="requests__detail-section-title">Performance</h4>
            <div class="requests__detail-row">
              <span class="text-secondary">Latency</span>
              <span class="mono" :style="{ color: getLatencyColor(expandedRow.latency as number) }">{{ expandedRow.latency }}ms</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Tokens In</span>
              <span class="mono">{{ expandedRow.tokensIn }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Tokens Out</span>
              <span class="mono">{{ expandedRow.tokensOut }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Cost</span>
              <span class="mono">&pound;{{ (expandedRow.cost as number).toFixed(4) }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Cache</span>
              <span :class="expandedRow.cached ? 'text-success' : 'text-muted'">{{ expandedRow.cached ? 'Hit' : 'Miss' }}</span>
            </div>
          </div>
          <div class="requests__detail-section">
            <h4 class="requests__detail-section-title">Savings</h4>
            <div class="requests__detail-row">
              <span class="text-secondary">Original Cost</span>
              <span class="mono">&pound;{{ ((expandedRow.cost as number) + (expandedRow.saved as number)).toFixed(4) }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Optimised Cost</span>
              <span class="mono">&pound;{{ (expandedRow.cost as number).toFixed(4) }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Saved</span>
              <span class="mono text-success">&pound;{{ (expandedRow.saved as number).toFixed(4) }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">Status Code</span>
              <span class="mono">{{ expandedRow.statusCode }}</span>
            </div>
            <div class="requests__detail-row">
              <span class="text-secondary">User Agent</span>
              <span class="mono text-muted" style="font-size: 0.6875rem">{{ expandedRow.userAgent }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { Radio as RadioIcon, X as XIcon } from 'lucide-vue-next'

definePageMeta({ layout: 'default' })

// --- Providers & models ---
const providers = ['OpenAI', 'Anthropic', 'Google', 'Mistral'] as const
const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'claude-sonnet', 'claude-haiku', 'gemini', 'mistral'] as const

// --- Filter state ---
const activeProviders = ref(new Set<string>(providers))
const selectedModel = ref('')
const activeStatuses = ref(new Set<string>(['success', 'error', 'cached']))
const liveMode = ref(false)
const expandedRow = ref<Record<string, unknown> | null>(null)

const statusFilters = ['success', 'error', 'cached'] as const

function toggleProvider(p: string) {
  const s = activeProviders.value
  if (s.has(p)) { s.delete(p) } else { s.add(p) }
  activeProviders.value = new Set(s)
}

function toggleStatus(s: string) {
  const set = activeStatuses.value
  if (set.has(s)) { set.delete(s) } else { set.add(s) }
  activeStatuses.value = new Set(set)
}

function toggleExpand(row: Record<string, unknown>) {
  expandedRow.value = expandedRow.value?.id === row.id ? null : row
}

// --- Table columns ---
const columns = [
  { key: 'time', label: 'Time', width: '110px', sortable: true },
  { key: 'endpoint', label: 'Endpoint', minWidth: '140px', sortable: true },
  { key: 'model', label: 'Model', width: '130px', sortable: true },
  { key: 'tokens', label: 'Tokens', width: '110px', align: 'right' as const, sortable: true },
  { key: 'cost', label: 'Cost', width: '90px', align: 'right' as const, sortable: true },
  { key: 'latency', label: 'Latency', width: '90px', align: 'right' as const, sortable: true },
  { key: 'cache', label: 'Cache', width: '70px', align: 'center' as const },
  { key: 'status', label: 'Status', width: '80px', align: 'center' as const },
]

// --- Demo data: 20 sample rows ---
const now = Date.now()
const demoRequests = ref<Record<string, unknown>[]>([
  { id: 'req_01a', timestamp: now - 12000, endpoint: '/api/chat/completions', model: 'gpt-4o', provider: 'OpenAI', tokensIn: 512, tokensOut: 1024, cost: 0.0038, latency: 284, cached: false, status: 'success', statusCode: 200, saved: 0.0012, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_02b', timestamp: now - 34000, endpoint: '/api/faq/answer', model: 'gpt-4o-mini', provider: 'OpenAI', tokensIn: 128, tokensOut: 256, cost: 0.0002, latency: 18, cached: true, status: 'cached', statusCode: 200, saved: 0.0009, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_03c', timestamp: now - 67000, endpoint: '/api/generate', model: 'claude-sonnet', provider: 'Anthropic', tokensIn: 1024, tokensOut: 2048, cost: 0.0120, latency: 567, cached: false, status: 'success', statusCode: 200, saved: 0.0035, userAgent: 'neuralgate-sdk/1.4.1' },
  { id: 'req_04d', timestamp: now - 120000, endpoint: '/api/classify', model: 'gpt-4o-mini', provider: 'OpenAI', tokensIn: 64, tokensOut: 32, cost: 0.0001, latency: 12, cached: true, status: 'cached', statusCode: 200, saved: 0.0004, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_05e', timestamp: now - 185000, endpoint: '/api/summarize', model: 'gpt-4o', provider: 'OpenAI', tokensIn: 2048, tokensOut: 512, cost: 0.0058, latency: 892, cached: false, status: 'error', statusCode: 429, saved: 0.0000, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_06f', timestamp: now - 240000, endpoint: '/api/translate', model: 'gemini', provider: 'Google', tokensIn: 256, tokensOut: 256, cost: 0.0001, latency: 124, cached: false, status: 'success', statusCode: 200, saved: 0.0008, userAgent: 'neuralgate-sdk/1.4.0' },
  { id: 'req_07g', timestamp: now - 310000, endpoint: '/api/embed', model: 'gpt-4o-mini', provider: 'OpenAI', tokensIn: 512, tokensOut: 0, cost: 0.0001, latency: 14, cached: true, status: 'cached', statusCode: 200, saved: 0.0003, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_08h', timestamp: now - 420000, endpoint: '/api/review', model: 'claude-sonnet', provider: 'Anthropic', tokensIn: 4096, tokensOut: 1024, cost: 0.0275, latency: 1240, cached: false, status: 'success', statusCode: 200, saved: 0.0098, userAgent: 'neuralgate-sdk/1.4.1' },
  { id: 'req_09i', timestamp: now - 510000, endpoint: '/api/chat/completions', model: 'gpt-4-turbo', provider: 'OpenAI', tokensIn: 768, tokensOut: 1536, cost: 0.0180, latency: 720, cached: false, status: 'success', statusCode: 200, saved: 0.0062, userAgent: 'neuralgate-sdk/1.3.9' },
  { id: 'req_10j', timestamp: now - 600000, endpoint: '/api/sentiment', model: 'mistral', provider: 'Mistral', tokensIn: 96, tokensOut: 16, cost: 0.0001, latency: 89, cached: false, status: 'success', statusCode: 200, saved: 0.0002, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_11k', timestamp: now - 780000, endpoint: '/api/chat/completions', model: 'gpt-4o', provider: 'OpenAI', tokensIn: 1024, tokensOut: 2048, cost: 0.0072, latency: 410, cached: false, status: 'success', statusCode: 200, saved: 0.0018, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_12l', timestamp: now - 900000, endpoint: '/api/extract', model: 'claude-haiku', provider: 'Anthropic', tokensIn: 2048, tokensOut: 128, cost: 0.0005, latency: 92, cached: false, status: 'success', statusCode: 200, saved: 0.0022, userAgent: 'neuralgate-sdk/1.4.1' },
  { id: 'req_13m', timestamp: now - 1020000, endpoint: '/api/generate', model: 'gemini', provider: 'Google', tokensIn: 512, tokensOut: 1024, cost: 0.0003, latency: 210, cached: false, status: 'success', statusCode: 200, saved: 0.0015, userAgent: 'neuralgate-sdk/1.4.0' },
  { id: 'req_14n', timestamp: now - 1200000, endpoint: '/api/chat/completions', model: 'gpt-4o-mini', provider: 'OpenAI', tokensIn: 256, tokensOut: 512, cost: 0.0001, latency: 15, cached: true, status: 'cached', statusCode: 200, saved: 0.0006, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_15o', timestamp: now - 1500000, endpoint: '/api/moderate', model: 'gpt-4o-mini', provider: 'OpenAI', tokensIn: 128, tokensOut: 8, cost: 0.0000, latency: 38, cached: false, status: 'success', statusCode: 200, saved: 0.0001, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_16p', timestamp: now - 1800000, endpoint: '/api/translate', model: 'mistral', provider: 'Mistral', tokensIn: 384, tokensOut: 400, cost: 0.0002, latency: 156, cached: false, status: 'error', statusCode: 500, saved: 0.0000, userAgent: 'neuralgate-sdk/1.4.0' },
  { id: 'req_17q', timestamp: now - 2100000, endpoint: '/api/summarize', model: 'claude-sonnet', provider: 'Anthropic', tokensIn: 3072, tokensOut: 512, cost: 0.0095, latency: 480, cached: false, status: 'success', statusCode: 200, saved: 0.0040, userAgent: 'neuralgate-sdk/1.4.1' },
  { id: 'req_18r', timestamp: now - 2700000, endpoint: '/api/chat/completions', model: 'gpt-4o', provider: 'OpenAI', tokensIn: 640, tokensOut: 896, cost: 0.0032, latency: 310, cached: false, status: 'success', statusCode: 200, saved: 0.0011, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_19s', timestamp: now - 3300000, endpoint: '/api/embed', model: 'gpt-4o-mini', provider: 'OpenAI', tokensIn: 1024, tokensOut: 0, cost: 0.0001, latency: 22, cached: true, status: 'cached', statusCode: 200, saved: 0.0005, userAgent: 'neuralgate-sdk/1.4.2' },
  { id: 'req_20t', timestamp: now - 3600000, endpoint: '/api/generate', model: 'gpt-4-turbo', provider: 'OpenAI', tokensIn: 1536, tokensOut: 2048, cost: 0.0240, latency: 1100, cached: false, status: 'success', statusCode: 200, saved: 0.0085, userAgent: 'neuralgate-sdk/1.3.9' },
])

// --- Computed stats ---
const stats = computed(() => {
  const rows = demoRequests.value
  const total = rows.length
  const cachedCount = rows.filter(r => r.cached).length
  const errorCount = rows.filter(r => r.status === 'error').length
  const avgCost = rows.reduce((s, r) => s + (r.cost as number), 0) / total
  const avgLatency = Math.round(rows.reduce((s, r) => s + (r.latency as number), 0) / total)
  const saved = rows.reduce((s, r) => s + (r.saved as number), 0)
  return {
    total,
    cachedPct: ((cachedCount / total) * 100).toFixed(1),
    errorPct: ((errorCount / total) * 100).toFixed(1),
    avgCost: avgCost.toFixed(4),
    avgLatency,
    saved: saved.toFixed(2),
  }
})

// --- Filtered rows ---
const filteredRows = computed(() => {
  return demoRequests.value.filter(row => {
    if (!activeProviders.value.has(row.provider as string)) return false
    if (selectedModel.value && row.model !== selectedModel.value) return false
    if (!activeStatuses.value.has(row.status as string)) return false
    return true
  })
})

// --- Helpers ---
function getLatencyColor(ms: number): string {
  if (ms < 100) return 'var(--success)'
  if (ms < 500) return 'var(--warning)'
  return 'var(--danger)'
}

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
</script>

<style scoped>
.requests {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* --- Stats bar --- */
.requests__stats {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 12px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: var(--card-radius);
  overflow-x: auto;
}

.requests__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0 20px;
  white-space: nowrap;
}

.requests__stat-label {
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-family: var(--font-ui);
}

.requests__stat-value {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.requests__stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border-base);
  flex-shrink: 0;
}

/* --- Filter bar --- */
.requests__filters {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: var(--card-radius);
  flex-wrap: wrap;
}

.requests__filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.requests__filter-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  white-space: nowrap;
}

.requests__filter-spacer {
  flex: 1;
}

.requests__pills {
  display: flex;
  gap: 4px;
}

.requests__pill {
  padding: 4px 10px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 9999px;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.requests__pill:hover {
  color: var(--text-primary);
  border-color: var(--border-strong);
}

.requests__pill--active {
  color: var(--primary);
  background: rgba(91, 94, 244, 0.1);
  border-color: var(--primary);
}

.requests__select {
  appearance: none;
  padding: 4px 28px 4px 10px;
  font-size: 0.6875rem;
  font-family: var(--font-mono);
  color: var(--text-primary);
  background: var(--bg-elevated) url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2388889f' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 10px center;
  border: 1px solid var(--border-base);
  border-radius: 6px;
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.requests__select:hover,
.requests__select:focus {
  border-color: var(--border-strong);
  outline: none;
}

.requests__select option {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

/* Live toggle */
.requests__live-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.requests__live-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 9999px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.requests__live-btn:hover {
  border-color: var(--border-strong);
}

.requests__live-btn--active {
  color: var(--success);
  background: rgba(0, 217, 126, 0.08);
  border-color: var(--success);
}

/* --- Cache badge --- */
.requests__cache-badge {
  display: inline-block;
  padding: 1px 6px;
  font-size: 0.625rem;
  font-weight: 600;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  border-radius: 4px;
  background: rgba(0, 217, 126, 0.12);
  color: var(--success);
}

.requests__cache-badge--miss {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

/* --- Status cell --- */
.requests__status-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  color: var(--text-secondary);
}

/* --- Detail panel --- */
.requests__detail {
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: var(--card-radius);
  padding: 20px;
}

.requests__detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-base);
}

.requests__detail-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.requests__detail-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border-base);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.requests__detail-close:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
  border-color: var(--border-strong);
}

.requests__detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.requests__detail-section-title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.requests__detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 4px 0;
  font-size: 0.8125rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.requests__detail-row:last-child {
  border-bottom: none;
}

/* --- Transition --- */
.detail-slide-enter-active,
.detail-slide-leave-active {
  transition: all 200ms ease;
}

.detail-slide-enter-from,
.detail-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* --- Utility text classes --- */
.text-success { color: var(--success); }
.text-danger { color: var(--danger); }
.text-muted { color: var(--text-muted); }
.text-secondary { color: var(--text-secondary); }
.mono { font-family: var(--font-mono); }

/* --- Responsive --- */
@media (max-width: 768px) {
  .requests__stats {
    gap: 0;
    padding: 10px 12px;
  }

  .requests__stat {
    padding: 0 12px;
  }

  .requests__filters {
    flex-direction: column;
    align-items: flex-start;
  }

  .requests__filter-spacer {
    display: none;
  }

  .requests__detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
