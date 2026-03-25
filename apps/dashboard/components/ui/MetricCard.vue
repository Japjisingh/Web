<template>
  <div class="card metric-card" :class="{ 'is-loading': loading }">
    <div v-if="loading" class="metric-card__skeleton">
      <div class="skeleton" style="width: 60%; height: 14px; margin-bottom: 12px" />
      <div class="skeleton" style="width: 80%; height: 32px; margin-bottom: 8px" />
      <div class="skeleton" style="width: 100%; height: 40px" />
    </div>
    <template v-else>
      <div class="metric-card__header">
        <span class="metric-card__title">{{ title }}</span>
        <component :is="iconComponent" v-if="iconComponent" :size="16" class="metric-card__icon" />
      </div>
      <div class="metric-card__value mono count-up">
        {{ formattedValue }}
      </div>
      <div class="metric-card__footer">
        <div v-if="sparklineData?.length" class="metric-card__sparkline">
          <SparklineChart :data="sparklineData" :height="40" />
        </div>
        <div v-if="change !== undefined" class="metric-card__change" :style="{ color: changeColor }">
          <span class="mono">{{ change > 0 ? '+' : '' }}{{ changeDisplay }}</span>
          <span v-if="changePeriod" class="metric-card__period">{{ changePeriod }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { TrendingUp, DollarSign, Zap, Database } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  value: number | string
  format?: 'currency' | 'number' | 'percent'
  change?: number
  changePeriod?: string
  sparklineData?: number[]
  loading?: boolean
  icon?: string
}>()

const iconMap: Record<string, unknown> = {
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
  zap: Zap,
  database: Database,
}

const iconComponent = computed(() => props.icon ? iconMap[props.icon] : null)

const formattedValue = computed(() => {
  const val = typeof props.value === 'string' ? parseFloat(props.value) : props.value
  if (isNaN(val)) return props.value

  switch (props.format) {
    case 'currency':
      return val >= 1000
        ? `£${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `£${val.toFixed(2)}`
    case 'percent':
      return `${val.toFixed(1)}%`
    case 'number':
    default:
      return val.toLocaleString('en-GB')
  }
})

const changeDisplay = computed(() => {
  if (props.change === undefined) return ''
  if (props.format === 'percent') return `${props.change.toFixed(1)}pp`
  return `${props.change.toFixed(1)}%`
})

const changeColor = computed(() => {
  if (props.change === undefined) return ''
  // For cost, decrease is good
  if (props.title.toLowerCase().includes('cost')) {
    return props.change < 0 ? 'var(--success)' : 'var(--danger)'
  }
  return props.change > 0 ? 'var(--success)' : 'var(--danger)'
})
</script>

<style scoped>
.metric-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color var(--transition-fast);
}

.metric-card:hover {
  border-color: var(--border-strong);
}

.metric-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.metric-card__title {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-card__icon {
  color: var(--text-muted);
}

.metric-card__value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.metric-card__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  min-height: 40px;
}

.metric-card__sparkline {
  flex: 1;
  min-width: 0;
}

.metric-card__change {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  font-size: 0.8125rem;
  font-weight: 600;
  white-space: nowrap;
}

.metric-card__period {
  font-size: 0.6875rem;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-weight: 400;
}
</style>
