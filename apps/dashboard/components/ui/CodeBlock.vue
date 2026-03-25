<template>
  <div class="code-block">
    <div v-if="tabs.length > 1" class="code-block__tabs">
      <button
        v-for="tab in tabs"
        :key="tab"
        class="code-block__tab"
        :class="{ 'code-block__tab--active': activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>
    <div class="code-block__header">
      <span class="code-block__lang mono">{{ activeTab || language }}</span>
      <button class="code-block__copy" @click="copyCode">
        <component :is="copied ? Check : Copy" :size="14" />
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>
    <pre class="code-block__pre"><code class="code-block__code mono" v-html="highlightedCode" /></pre>
  </div>
</template>

<script setup lang="ts">
import { Copy, Check } from 'lucide-vue-next'

const props = defineProps<{
  code: string | Record<string, string>
  language?: string
  tabs?: string[]
}>()

const activeTab = ref(props.tabs?.[0] || '')
const copied = ref(false)

const currentCode = computed(() => {
  if (typeof props.code === 'string') return props.code
  return props.code[activeTab.value] || ''
})

// Basic syntax highlighting
const highlightedCode = computed(() => {
  let code = currentCode.value
  // Strings
  code = code.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, '<span style="color: var(--success)">$&</span>')
  // Keywords
  code = code.replace(/\b(const|let|var|function|import|from|export|return|if|else|new|await|async)\b/g, '<span style="color: #c792ea">$&</span>')
  // Comments
  code = code.replace(/(\/\/.*$)/gm, '<span style="color: var(--text-muted)">$&</span>')
  return code
})

async function copyCode() {
  await navigator.clipboard.writeText(currentCode.value)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<style scoped>
.code-block {
  background: var(--bg-surface);
  border: 1px solid var(--border-base);
  border-radius: var(--card-radius);
  overflow: hidden;
}

.code-block__tabs {
  display: flex;
  border-bottom: 1px solid var(--border-base);
  padding: 0 4px;
}

.code-block__tab {
  padding: 8px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  transition: all var(--transition-fast);
}

.code-block__tab:hover { color: var(--text-secondary); }
.code-block__tab--active {
  color: var(--text-primary);
  border-color: var(--primary);
}

.code-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-base);
}

.code-block__lang {
  font-size: 0.6875rem;
  color: var(--text-muted);
  text-transform: uppercase;
}

.code-block__copy {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.6875rem;
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  transition: all var(--transition-fast);
}

.code-block__copy:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.code-block__pre {
  padding: 16px;
  overflow-x: auto;
  margin: 0;
}

.code-block__code {
  font-size: 0.8125rem;
  line-height: 1.6;
  color: var(--text-primary);
}
</style>
