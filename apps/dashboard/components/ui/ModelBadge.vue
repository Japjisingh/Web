<template>
  <span class="model-badge mono" :style="{ background: bgColor, color: textColor }">
    {{ label }}
  </span>
</template>

<script setup lang="ts">
const props = defineProps<{
  model: string
  cached?: boolean
}>()

const MODEL_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  'gpt-4o': { bg: '#5b5ef420', text: '#8b8ef9', label: 'GPT-4o' },
  'gpt-4o-mini': { bg: '#3b82f620', text: '#60a5fa', label: 'GPT-4o Mini' },
  'gpt-4-turbo': { bg: '#8b5cf620', text: '#a78bfa', label: 'GPT-4 Turbo' },
  'claude-opus': { bg: '#f59e0b20', text: '#fbbf24', label: 'Claude Opus' },
  'claude-sonnet': { bg: '#f9731620', text: '#fb923c', label: 'Claude Sonnet' },
  'claude-haiku': { bg: '#fb923c20', text: '#fdba74', label: 'Claude Haiku' },
  'gemini': { bg: '#06b6d420', text: '#22d3ee', label: 'Gemini' },
  'mistral': { bg: '#ff700020', text: '#ff9940', label: 'Mistral' },
  'cached': { bg: '#00d97e20', text: '#00d97e', label: 'CACHED' },
}

function getStyle(model: string) {
  if (props.cached) return MODEL_STYLES.cached
  for (const [key, style] of Object.entries(MODEL_STYLES)) {
    if (model.toLowerCase().includes(key)) return style
  }
  return { bg: 'var(--bg-overlay)', text: 'var(--text-secondary)', label: model }
}

const style = computed(() => getStyle(props.model))
const bgColor = computed(() => style.value.bg)
const textColor = computed(() => style.value.text)
const label = computed(() => props.cached ? 'CACHED' : style.value.label)
</script>

<style scoped>
.model-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1.4;
}
</style>
