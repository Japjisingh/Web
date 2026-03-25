<template>
  <span class="status-dot" :class="[`status-dot--${color}`, { 'status-dot--pulse': pulse }]">
    <span class="status-dot__inner" />
  </span>
</template>

<script setup lang="ts">
defineProps<{
  color?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
  pulse?: boolean
}>()
</script>

<style scoped>
.status-dot {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 8px;
  height: 8px;
}

.status-dot__inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.status-dot--success .status-dot__inner { background: var(--success); }
.status-dot--warning .status-dot__inner { background: var(--warning); }
.status-dot--danger .status-dot__inner { background: var(--danger); }
.status-dot--info .status-dot__inner { background: var(--info); }
.status-dot--neutral .status-dot__inner { background: var(--text-muted); }

.status-dot--pulse .status-dot__inner {
  animation: pulse 2s ease-in-out infinite;
}

.status-dot--pulse::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 1.5px solid currentColor;
  animation: pulse-ring 2s ease-out infinite;
}

.status-dot--success { color: var(--success); }
.status-dot--warning { color: var(--warning); }
.status-dot--danger { color: var(--danger); }
</style>
