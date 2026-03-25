<template>
  <div class="analytics fade-slide-in">
    <!-- Top row: 5 metric cards -->
    <div class="analytics__metrics">
      <div class="card analytics__metric-card">
        <span class="analytics__metric-label">MTD Spend</span>
        <span class="analytics__metric-value mono">&pound;1,240.83</span>
        <span class="analytics__metric-change analytics__metric-change--down">-8.2% vs last month</span>
      </div>
      <div class="card analytics__metric-card">
        <span class="analytics__metric-label">Daily Average</span>
        <span class="analytics__metric-value mono">&pound;49.63</span>
        <span class="analytics__metric-change analytics__metric-change--down">-3.1% vs last month</span>
      </div>
      <div class="card analytics__metric-card">
        <span class="analytics__metric-label">Cost per 1K reqs</span>
        <span class="analytics__metric-value mono">&pound;0.436</span>
        <span class="analytics__metric-change analytics__metric-change--down">-12.7% vs last month</span>
      </div>
      <div class="card analytics__metric-card">
        <span class="analytics__metric-label">Most Expensive Model</span>
        <span class="analytics__metric-value mono">GPT-4o</span>
        <span class="analytics__metric-sub mono">&pound;684.20 (55.1%)</span>
      </div>
      <div class="card analytics__metric-card">
        <span class="analytics__metric-label">Biggest Endpoint</span>
        <span class="analytics__metric-value mono">/api/chat</span>
        <span class="analytics__metric-sub mono">&pound;412.60 (33.2%)</span>
      </div>
    </div>

    <!-- CHART 1: Daily cost with 30-day forecast -->
    <div class="card analytics__daily-chart">
      <div class="card__header">
        <h3 class="card__title">Daily Cost &mdash; 30-Day Forecast</h3>
        <div class="card__tabs">
          <button
            v-for="range in ['30D', '60D', '90D']"
            :key="range"
            class="card__tab"
            :class="{ 'card__tab--active': selectedRange === range }"
            @click="selectedRange = range"
          >
            {{ range }}
          </button>
        </div>
      </div>
      <AreaChart
        :labels="dailyCostLabels"
        :datasets="dailyCostDatasets"
        :height="320"
        :show-legend="true"
      />
      <div class="analytics__budget-annotation">
        <span class="analytics__budget-line" />
        <span class="analytics__budget-text mono">Budget limit &pound;2,000</span>
      </div>
    </div>

    <!-- CHART 2 + CHART 3: Side by side -->
    <div class="analytics__chart-row">
      <!-- Cost by provider (stacked bar) -->
      <div class="card analytics__half-chart">
        <div class="card__header">
          <h3 class="card__title">Cost by Provider</h3>
          <span class="mono" style="font-size: 0.6875rem; color: var(--text-muted)">Last 7 days</span>
        </div>
        <BarChart
          :labels="providerLabels"
          :datasets="providerDatasets"
          :height="300"
          :stacked="true"
        />
      </div>

      <!-- Cost by model (horizontal bar, sorted) -->
      <div class="card analytics__half-chart">
        <div class="card__header">
          <h3 class="card__title">Cost by Model</h3>
          <span class="mono" style="font-size: 0.6875rem; color: var(--text-muted)">MTD</span>
        </div>
        <BarChart
          :labels="modelLabels"
          :datasets="modelDatasets"
          :height="300"
          :horizontal="true"
        />
      </div>
    </div>

    <!-- Budget section -->
    <div class="analytics__budget-row">
      <div class="card analytics__budget-gauge">
        <div class="card__header">
          <h3 class="card__title">Budget Usage</h3>
          <span class="mono" style="font-size: 0.6875rem; color: var(--text-muted)">March 2026</span>
        </div>
        <GaugeChart
          :value="1240"
          :max="2000"
          :height="220"
          label="of &pound;2,000 budget"
        />
        <div class="analytics__budget-details">
          <div class="analytics__budget-detail">
            <span class="text-secondary">Spent</span>
            <span class="mono" style="font-weight: 700">&pound;1,240</span>
          </div>
          <div class="analytics__budget-detail">
            <span class="text-secondary">Remaining</span>
            <span class="mono" style="font-weight: 700; color: var(--success)">&pound;760</span>
          </div>
          <div class="analytics__budget-detail">
            <span class="text-secondary">Projected</span>
            <span class="mono" style="font-weight: 700; color: var(--warning)">&pound;1,920</span>
          </div>
        </div>
      </div>

      <div class="card analytics__budget-breakdown">
        <div class="card__header">
          <h3 class="card__title">Budget Breakdown</h3>
        </div>
        <div class="analytics__breakdown-items">
          <div
            v-for="item in budgetBreakdown"
            :key="item.name"
            class="analytics__breakdown-item"
          >
            <div class="analytics__breakdown-header">
              <span class="analytics__breakdown-name">{{ item.name }}</span>
              <span class="mono" style="font-size: 0.8125rem">&pound;{{ item.spent.toFixed(0) }}</span>
            </div>
            <div class="analytics__breakdown-bar-track">
              <div
                class="analytics__breakdown-bar-fill progress-animate"
                :style="{ width: `${(item.spent / item.budget) * 100}%`, background: item.color }"
              />
            </div>
            <div class="analytics__breakdown-footer">
              <span class="mono text-muted" style="font-size: 0.6875rem">
                {{ ((item.spent / item.budget) * 100).toFixed(0) }}% of &pound;{{ item.budget }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const selectedRange = ref('30D')

// --- Demo data ---

// Daily cost labels: 30 days actual + 30 days forecast
const today = new Date()
const dailyCostLabels = Array.from({ length: 60 }, (_, i) => {
  const d = new Date(today)
  d.setDate(d.getDate() - 29 + i)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
})

// Actual daily cost (30 days)
const actualData = Array.from({ length: 30 }, () => 35 + Math.random() * 25)
// Forecast data (next 30 days) - null for first 30, values for last 30
const forecastMean = Array.from({ length: 30 }, () => 40 + Math.random() * 20)
const forecastUpper = forecastMean.map((v) => v + 8 + Math.random() * 6)
const forecastLower = forecastMean.map((v) => Math.max(0, v - 8 - Math.random() * 6))

const dailyCostDatasets = [
  {
    name: 'Actual Cost',
    data: [...actualData, ...Array(30).fill(null)],
    color: '#5b5ef4',
  },
  {
    name: 'Forecast',
    data: [...Array(29).fill(null), actualData[29], ...forecastMean],
    color: '#8b8ef7',
    dashed: true,
  },
  {
    name: 'Upper Bound',
    data: [...Array(29).fill(null), actualData[29], ...forecastUpper],
    color: 'rgba(139, 142, 247, 0.15)',
    dashed: true,
  },
  {
    name: 'Lower Bound',
    data: [...Array(29).fill(null), actualData[29], ...forecastLower],
    color: 'rgba(139, 142, 247, 0.15)',
    dashed: true,
  },
]

// Cost by provider (stacked bar) - last 7 days
const providerLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const providerDatasets = [
  {
    name: 'OpenAI',
    data: [38, 42, 35, 40, 44, 28, 32],
    color: '#5b5ef4',
  },
  {
    name: 'Anthropic',
    data: [12, 14, 18, 11, 16, 8, 10],
    color: '#f97316',
  },
  {
    name: 'Google',
    data: [5, 4, 6, 7, 5, 3, 4],
    color: '#06b6d4',
  },
  {
    name: 'Mistral',
    data: [3, 2, 4, 3, 2, 1, 2],
    color: '#a855f7',
  },
]

// Cost by model (horizontal bar, sorted by cost)
const modelLabels = [
  'GPT-4o',
  'Claude Sonnet',
  'GPT-4o Mini',
  'Gemini Flash',
  'Mistral Large',
  'Claude Haiku',
  'GPT-3.5 Turbo',
  'Gemini Pro',
]
const modelDatasets = [
  {
    name: 'Cost',
    data: [684, 218, 142, 78, 52, 34, 22, 11],
    color: '#5b5ef4',
  },
]

// Budget breakdown
const budgetBreakdown = [
  { name: 'Chat Completions', spent: 684, budget: 900, color: '#5b5ef4' },
  { name: 'Embeddings', spent: 218, budget: 400, color: '#06b6d4' },
  { name: 'Image Generation', spent: 186, budget: 300, color: '#f97316' },
  { name: 'Fine-tuning', spent: 98, budget: 250, color: '#a855f7' },
  { name: 'Other', spent: 54, budget: 150, color: '#55556a' },
]
</script>

<style scoped>
.analytics {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* --- Top metric cards --- */
.analytics__metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.analytics__metric-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid var(--border-base);
  background: var(--bg-surface);
  border-radius: 8px;
}

.analytics__metric-label {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.analytics__metric-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.analytics__metric-change {
  font-size: 0.6875rem;
  color: var(--text-muted);
}

.analytics__metric-change--down {
  color: var(--success);
}

.analytics__metric-change--up {
  color: var(--danger);
}

.analytics__metric-sub {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* --- Card shared --- */
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
  cursor: pointer;
  border: none;
  background: none;
}

.card__tab:hover {
  color: var(--text-secondary);
}

.card__tab--active {
  color: var(--text-primary);
  background: var(--bg-overlay);
}

/* --- Daily cost chart --- */
.analytics__daily-chart {
  position: relative;
}

.analytics__budget-annotation {
  position: absolute;
  top: 68px;
  left: 50px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.analytics__budget-line {
  flex: 1;
  height: 1px;
  border-top: 2px dashed #f5a623;
  opacity: 0.6;
}

.analytics__budget-text {
  font-size: 0.6875rem;
  color: #f5a623;
  white-space: nowrap;
}

/* --- Chart row (half-width pair) --- */
.analytics__chart-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.analytics__half-chart {
  min-width: 0;
}

/* --- Budget row --- */
.analytics__budget-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16px;
}

.analytics__budget-gauge {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.analytics__budget-details {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 12px;
  width: 100%;
}

.analytics__budget-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 0.8125rem;
}

/* --- Budget breakdown --- */
.analytics__breakdown-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.analytics__breakdown-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.analytics__breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.analytics__breakdown-name {
  font-size: 0.8125rem;
  color: var(--text-primary);
  font-weight: 500;
}

.analytics__breakdown-bar-track {
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.analytics__breakdown-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.analytics__breakdown-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
