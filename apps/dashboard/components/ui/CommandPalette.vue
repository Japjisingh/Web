<template>
  <Teleport to="body">
    <Transition name="cmd">
      <div v-if="isOpen" class="cmd-backdrop" @click.self="close">
        <div class="cmd-palette">
          <div class="cmd-input-wrapper">
            <Search :size="16" class="cmd-search-icon" />
            <input
              ref="inputRef"
              v-model="query"
              class="cmd-input"
              placeholder="Search requests, recommendations, navigation..."
              @keydown.escape="close"
              @keydown.enter="executeFirst"
              @keydown.down.prevent="moveDown"
              @keydown.up.prevent="moveUp"
            />
            <kbd class="cmd-kbd">ESC</kbd>
          </div>
          <div class="cmd-results">
            <div v-if="items.length === 0" class="cmd-empty">
              No results found
            </div>
            <template v-else>
              <div
                v-for="(item, idx) in items"
                :key="item.id"
                class="cmd-item"
                :class="{ 'cmd-item--active': selectedIdx === idx }"
                @click="execute(item)"
                @mouseenter="selectedIdx = idx"
              >
                <span class="cmd-item__group">{{ item.group }}</span>
                <span class="cmd-item__label">{{ item.label }}</span>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Search } from 'lucide-vue-next'

const { isOpen, query, items, close } = useCommandPalette()
const inputRef = ref<HTMLInputElement>()
const selectedIdx = ref(0)

watch(isOpen, (val) => {
  if (val) {
    selectedIdx.value = 0
    nextTick(() => inputRef.value?.focus())
  }
})

watch(query, () => { selectedIdx.value = 0 })

function moveDown() {
  selectedIdx.value = Math.min(selectedIdx.value + 1, items.value.length - 1)
}

function moveUp() {
  selectedIdx.value = Math.max(selectedIdx.value - 1, 0)
}

function execute(item: { action: () => void }) {
  item.action()
  close()
}

function executeFirst() {
  if (items.value[selectedIdx.value]) {
    execute(items.value[selectedIdx.value])
  }
}
</script>

<style scoped>
.cmd-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: var(--z-command);
  display: flex;
  justify-content: center;
  padding-top: 20vh;
}

.cmd-palette {
  width: 560px;
  max-height: 400px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cmd-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-base);
}

.cmd-search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.cmd-input {
  flex: 1;
  background: none;
  border: none;
  font-size: 0.9375rem;
  color: var(--text-primary);
  outline: none;
}

.cmd-kbd {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  color: var(--text-muted);
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--border-base);
}

.cmd-results {
  overflow-y: auto;
  padding: 4px;
}

.cmd-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8125rem;
}

.cmd-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.cmd-item--active {
  background: var(--bg-overlay);
}

.cmd-item__group {
  font-size: 0.6875rem;
  color: var(--text-muted);
  min-width: 80px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.cmd-item__label {
  font-size: 0.8125rem;
  color: var(--text-primary);
}

.cmd-enter-active { transition: opacity 80ms ease; }
.cmd-leave-active { transition: opacity 60ms ease; }
.cmd-enter-from, .cmd-leave-to { opacity: 0; }
</style>
