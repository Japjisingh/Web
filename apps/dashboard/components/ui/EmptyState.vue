<template>
  <div class="empty-state">
    <div class="empty-state__ghost">
      <div v-for="i in 4" :key="i" class="empty-state__ghost-row">
        <div class="skeleton" :style="{ width: `${40 + Math.random() * 40}%`, height: '12px' }" />
        <div class="skeleton" :style="{ width: `${20 + Math.random() * 20}%`, height: '12px' }" />
        <div class="skeleton" :style="{ width: `${15 + Math.random() * 15}%`, height: '12px' }" />
      </div>
    </div>
    <div class="empty-state__content">
      <component :is="iconComponent" v-if="iconComponent" :size="32" class="empty-state__icon" />
      <h3 class="empty-state__title">{{ title }}</h3>
      <p class="empty-state__description">{{ description }}</p>
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Inbox, Activity, BarChart3, Settings } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  description: string
  icon?: string
}>()

const iconMap: Record<string, unknown> = {
  inbox: Inbox,
  activity: Activity,
  chart: BarChart3,
  settings: Settings,
}

const iconComponent = computed(() => props.icon ? iconMap[props.icon] : Inbox)
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 32px;
}

.empty-state__ghost {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 400px;
  opacity: 0.3;
}

.empty-state__ghost-row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0;
}

.empty-state__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.empty-state__icon {
  color: var(--text-muted);
  margin-bottom: 4px;
}

.empty-state__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state__description {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  max-width: 300px;
}
</style>
