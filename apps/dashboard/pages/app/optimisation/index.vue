<template>
  <div class="savings fade-slide-in">
    <!-- Top Banner -->
    <div class="savings__banner">
      <div class="savings__banner-inner">
        <div class="savings__banner-content">
          <div class="savings__banner-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
          </div>
          <div>
            <h2 class="savings__banner-title">
              We've found <span class="mono">{{ formatCurrency(totalIdentified) }}/month</span> in savings
            </h2>
            <p class="savings__banner-subtitle">
              {{ pendingCount }} recommendations ready to review across your endpoints
            </p>
          </div>
        </div>
        <div class="savings__banner-actions">
          <button class="btn btn--secondary" @click="reviewAll">Review All</button>
          <button class="btn btn--primary" @click="autoApplySafe">Auto-Apply Safe Ones</button>
        </div>
      </div>
    </div>

    <!-- Savings Summary -->
    <div class="savings__summary">
      <div class="card savings__stat-card">
        <span class="savings__stat-label">Identified</span>
        <span class="savings__stat-value mono">{{ formatCurrency(totalIdentified) }}<span class="savings__stat-period">/month</span></span>
        <span class="savings__stat-caption text-muted">Potential monthly savings</span>
      </div>
      <div class="card savings__stat-card">
        <span class="savings__stat-label">Already Saved</span>
        <span class="savings__stat-value savings__stat-value--success mono">{{ formatCurrency(alreadySaved) }}</span>
        <span class="savings__stat-caption text-muted">From applied recommendations</span>
      </div>
      <div class="card savings__stat-card">
        <span class="savings__stat-label">Applied</span>
        <span class="savings__stat-value mono">{{ appliedCount }} <span class="savings__stat-of">of</span> {{ recommendations.length }}</span>
        <span class="savings__stat-caption text-muted">Recommendations actioned</span>
      </div>
    </div>

    <!-- Recommendations Grid -->
    <div class="savings__grid">
      <div
        v-for="rec in recommendations"
        :key="rec.id"
        class="card savings__rec"
        :class="{ 'savings__rec--applied': rec.status === 'applied' }"
      >
        <div class="savings__rec-header">
          <div class="savings__rec-icon" :style="{ background: typeAccent(rec.type) + '14', color: typeAccent(rec.type) }">
            <component :is="typeIcon(rec.type)" />
          </div>
          <span class="savings__rec-type" :style="{ color: typeAccent(rec.type) }">{{ typeLabel(rec.type) }}</span>
          <span
            v-if="rec.status === 'applied'"
            class="savings__rec-badge savings__rec-badge--applied"
          >Applied</span>
          <span
            v-else-if="rec.status === 'dismissed'"
            class="savings__rec-badge savings__rec-badge--dismissed"
          >Dismissed</span>
        </div>

        <h3 class="savings__rec-title">{{ rec.title }}</h3>
        <p class="savings__rec-desc text-secondary">{{ rec.description }}</p>

        <div class="savings__rec-saving">
          <div class="savings__rec-saving-header">
            <span class="text-secondary">Estimated saving</span>
            <span class="mono">{{ formatCurrency(rec.estimatedSaving) }}/mo</span>
          </div>
          <div class="savings__rec-bar-track">
            <div
              class="savings__rec-bar-fill progress-animate"
              :style="{ width: (rec.estimatedSaving / maxSaving * 100) + '%', background: typeAccent(rec.type) }"
            />
          </div>
        </div>

        <div v-if="rec.status === 'applied' && rec.actualSaving != null" class="savings__rec-actual">
          <div class="savings__rec-actual-row">
            <span class="text-secondary">Actual saving</span>
            <span class="mono" :style="{ color: rec.actualSaving >= rec.estimatedSaving ? 'var(--success)' : 'var(--warning)' }">
              {{ formatCurrency(rec.actualSaving) }}/mo
            </span>
          </div>
          <div class="savings__rec-actual-row">
            <span class="text-muted">vs estimated</span>
            <span class="mono text-muted">
              {{ rec.actualSaving >= rec.estimatedSaving ? '+' : '' }}{{ formatCurrency(rec.actualSaving - rec.estimatedSaving) }}
            </span>
          </div>
        </div>

        <div class="savings__rec-actions">
          <template v-if="rec.status === 'pending'">
            <button class="btn btn--primary btn--sm" @click="applyRec(rec.id)">Apply Automatically</button>
            <button class="btn btn--ghost btn--sm" @click="viewDetails(rec.id)">Details</button>
            <button class="btn btn--ghost btn--sm btn--danger-text" @click="dismissRec(rec.id)">Dismiss</button>
          </template>
          <template v-else-if="rec.status === 'applied'">
            <button class="btn btn--ghost btn--sm" @click="viewDetails(rec.id)">View Details</button>
            <button class="btn btn--ghost btn--sm btn--danger-text" @click="revertRec(rec.id)">Revert</button>
          </template>
          <template v-else>
            <button class="btn btn--ghost btn--sm" @click="restoreRec(rec.id)">Restore</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

type RecType = 'cache' | 'model_downgrade' | 'compression' | 'duplicate' | 'expensive_endpoint'
type RecStatus = 'pending' | 'applied' | 'dismissed'

interface Recommendation {
  id: string
  type: RecType
  title: string
  description: string
  estimatedSaving: number
  actualSaving?: number
  status: RecStatus
}

const recommendations = ref<Recommendation[]>([
  {
    id: 'rec-1',
    type: 'cache',
    title: 'Cache FAQ responses',
    description: 'Your /api/faq endpoint returns identical responses for 73% of queries. Enable semantic caching to avoid redundant LLM calls.',
    estimatedSaving: 320,
    actualSaving: 380,
    status: 'applied',
  },
  {
    id: 'rec-2',
    type: 'model_downgrade',
    title: 'Downgrade classification to GPT-4o Mini',
    description: 'The /api/classify endpoint achieves 99.1% accuracy with GPT-4o Mini, matching GPT-4o performance at a fraction of the cost.',
    estimatedSaving: 280,
    actualSaving: 400,
    status: 'applied',
  },
  {
    id: 'rec-3',
    type: 'compression',
    title: 'Compress prompt templates',
    description: 'Your summarisation prompts contain 40% redundant tokens. Apply prompt compression to reduce input token costs across 3 endpoints.',
    estimatedSaving: 190,
    status: 'pending',
  },
  {
    id: 'rec-4',
    type: 'duplicate',
    title: 'Deduplicate embedding requests',
    description: 'Detected 1,240 duplicate embedding calls per day on /api/embed. A local vector cache would eliminate repeat computations.',
    estimatedSaving: 165,
    status: 'pending',
  },
  {
    id: 'rec-5',
    type: 'expensive_endpoint',
    title: 'Optimise /api/review chain',
    description: 'This endpoint uses a 3-step chain with GPT-4o for all steps. Step 1 (extraction) can safely use GPT-4o Mini, cutting cost by 60%.',
    estimatedSaving: 140,
    status: 'pending',
  },
  {
    id: 'rec-6',
    type: 'cache',
    title: 'Cache translation lookups',
    description: 'The /api/translate endpoint re-translates the same 50 phrases repeatedly. A simple key-value cache would eliminate 82% of calls.',
    estimatedSaving: 95,
    actualSaving: 110,
    status: 'applied',
  },
  {
    id: 'rec-7',
    type: 'model_downgrade',
    title: 'Use Gemini Flash for embeddings',
    description: 'Switch /api/embed from text-embedding-3-large to Gemini Flash embeddings. Retrieval quality remains within 0.3% on your evaluation set.',
    estimatedSaving: 50,
    status: 'pending',
  },
])

const totalIdentified = computed(() =>
  recommendations.value.reduce((sum, r) => sum + r.estimatedSaving, 0)
)

const alreadySaved = computed(() =>
  recommendations.value
    .filter(r => r.status === 'applied')
    .reduce((sum, r) => sum + (r.actualSaving ?? r.estimatedSaving), 0)
)

const appliedCount = computed(() =>
  recommendations.value.filter(r => r.status === 'applied').length
)

const pendingCount = computed(() =>
  recommendations.value.filter(r => r.status === 'pending').length
)

const maxSaving = computed(() =>
  Math.max(...recommendations.value.map(r => r.estimatedSaving))
)

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  return `${sign}\u00a3${abs.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const typeAccents: Record<RecType, string> = {
  cache: '#00d97e',
  model_downgrade: '#5b5ef4',
  compression: '#f5a623',
  duplicate: '#f97316',
  expensive_endpoint: '#ff4757',
}

const typeLabels: Record<RecType, string> = {
  cache: 'Caching',
  model_downgrade: 'Model Downgrade',
  compression: 'Compression',
  duplicate: 'Deduplication',
  expensive_endpoint: 'Expensive Endpoint',
}

function typeAccent(type: RecType): string {
  return typeAccents[type]
}

function typeLabel(type: RecType): string {
  return typeLabels[type]
}

function typeIcon(type: RecType) {
  const icons: Record<RecType, object> = {
    cache: {
      template: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
    },
    model_downgrade: {
      template: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>',
    },
    compression: {
      template: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="10" y1="4" x2="10" y2="10"/></svg>',
    },
    duplicate: {
      template: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    },
    expensive_endpoint: {
      template: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    },
  }
  return icons[type]
}

function applyRec(id: string) {
  const rec = recommendations.value.find(r => r.id === id)
  if (rec) {
    rec.status = 'applied'
    rec.actualSaving = Math.round(rec.estimatedSaving * (0.85 + Math.random() * 0.3))
  }
}

function dismissRec(id: string) {
  const rec = recommendations.value.find(r => r.id === id)
  if (rec) rec.status = 'dismissed'
}

function restoreRec(id: string) {
  const rec = recommendations.value.find(r => r.id === id)
  if (rec) rec.status = 'pending'
}

function revertRec(id: string) {
  const rec = recommendations.value.find(r => r.id === id)
  if (rec) {
    rec.status = 'pending'
    rec.actualSaving = undefined
  }
}

function viewDetails(id: string) {
  console.log('View details for', id)
}

function reviewAll() {
  console.log('Review all recommendations')
}

function autoApplySafe() {
  recommendations.value.forEach(rec => {
    if (rec.status === 'pending' && (rec.type === 'cache' || rec.type === 'duplicate')) {
      rec.status = 'applied'
      rec.actualSaving = Math.round(rec.estimatedSaving * (0.9 + Math.random() * 0.2))
    }
  })
}
</script>

<style scoped>
.savings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Entrance animation ── */
.fade-slide-in {
  animation: fadeSlideIn 400ms ease both;
}

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── Progress bar animation ── */
.progress-animate {
  animation: progressGrow 600ms ease both;
  animation-delay: 200ms;
  transform-origin: left;
}

@keyframes progressGrow {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

/* ── Banner ── */
.savings__banner {
  border-radius: 10px;
  padding: 1px;
  background: var(--gradient-brand);
}

.savings__banner-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 20px 24px;
  border-radius: 9px;
  background: var(--bg-surface);
}

.savings__banner-content {
  display: flex;
  align-items: center;
  gap: 16px;
}

.savings__banner-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(91, 94, 244, 0.12);
  color: var(--primary);
  flex-shrink: 0;
}

.savings__banner-title {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.savings__banner-subtitle {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin: 4px 0 0;
}

.savings__banner-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Summary Cards ── */
.savings__summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.savings__stat-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 20px;
}

.savings__stat-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.savings__stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.savings__stat-value--success {
  color: var(--success);
}

.savings__stat-period {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-muted);
}

.savings__stat-of {
  font-size: 0.875rem;
  font-weight: 400;
  color: var(--text-muted);
}

.savings__stat-caption {
  font-size: 0.6875rem;
  margin-top: 2px;
}

/* ── Recommendations Grid ── */
.savings__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.savings__rec {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  transition: border-color var(--transition-fast);
}

.savings__rec:hover {
  border-color: var(--text-muted);
}

.savings__rec--applied {
  border-color: rgba(0, 217, 126, 0.25);
}

.savings__rec--applied:hover {
  border-color: rgba(0, 217, 126, 0.45);
}

/* Rec header */
.savings__rec-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.savings__rec-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
}

.savings__rec-type {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.savings__rec-badge {
  margin-left: auto;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 4px;
}

.savings__rec-badge--applied {
  background: rgba(0, 217, 126, 0.12);
  color: var(--success);
}

.savings__rec-badge--dismissed {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
}

/* Rec body */
.savings__rec-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  line-height: 1.3;
}

.savings__rec-desc {
  font-size: 0.8125rem;
  line-height: 1.5;
  margin: 0;
}

/* Saving bar */
.savings__rec-saving {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.savings__rec-saving-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.75rem;
}

.savings__rec-bar-track {
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.savings__rec-bar-fill {
  height: 100%;
  border-radius: 3px;
}

/* Actual saving */
.savings__rec-actual {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--bg-elevated);
  border-radius: 6px;
}

.savings__rec-actual-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

/* Actions */
.savings__rec-actions {
  display: flex;
  gap: 6px;
  margin-top: auto;
  padding-top: 4px;
}

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: var(--font-ui);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.btn--sm {
  padding: 5px 10px;
  font-size: 0.75rem;
  border-radius: 5px;
}

.btn--primary {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.btn--primary:hover {
  background: #4a4de0;
  border-color: #4a4de0;
}

.btn--secondary {
  background: transparent;
  color: var(--text-primary);
  border-color: var(--border-base);
}

.btn--secondary:hover {
  background: var(--bg-elevated);
  border-color: var(--text-muted);
}

.btn--ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: var(--border-base);
}

.btn--ghost:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.btn--danger-text {
  color: var(--danger);
}

.btn--danger-text:hover {
  color: #fff;
  background: var(--danger);
  border-color: var(--danger);
}

/* ── Utility ── */
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  padding: 20px;
}

.mono {
  font-family: var(--font-mono);
}

.text-secondary { color: var(--text-secondary); }
.text-muted { color: var(--text-muted); }
.text-success { color: var(--success); }
</style>
