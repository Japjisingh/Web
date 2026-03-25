<template>
  <div class="date-picker">
    <button
      v-for="preset in presets"
      :key="preset.value"
      class="date-picker__btn"
      :class="{ 'date-picker__btn--active': dateRange.preset === preset.value }"
      @click="setPreset(preset.value)"
    >
      {{ preset.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
const { dateRange, setPreset } = useDateRange()

const presets = [
  { label: 'Today', value: 'today' as const },
  { label: '7D', value: '7d' as const },
  { label: '30D', value: '30d' as const },
  { label: '90D', value: '90d' as const },
]
</script>

<style scoped>
.date-picker {
  display: flex;
  gap: 2px;
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: 6px;
  padding: 2px;
}

.date-picker__btn {
  padding: 4px 10px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  border-radius: 4px;
  transition: all var(--transition-fast);
}

.date-picker__btn:hover {
  color: var(--text-primary);
  background: var(--bg-overlay);
}

.date-picker__btn--active {
  color: var(--text-primary);
  background: var(--bg-elevated);
}
</style>
