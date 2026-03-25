<template>
  <Teleport to="body">
    <Transition name="slide-over">
      <div v-if="modelValue" class="slide-over-backdrop" @click.self="$emit('update:modelValue', false)">
        <div class="slide-over-panel">
          <div class="slide-over-header">
            <h2 class="slide-over-title">{{ title }}</h2>
            <button class="slide-over-close" @click="$emit('update:modelValue', false)">
              <X :size="18" />
            </button>
          </div>
          <div class="slide-over-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="slide-over-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{
  modelValue: boolean
  title: string
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped>
.slide-over-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: var(--z-modal);
  display: flex;
  justify-content: flex-end;
}

.slide-over-panel {
  width: 480px;
  max-width: 100%;
  height: 100%;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-base);
  display: flex;
  flex-direction: column;
  animation: slideOverIn 200ms ease both;
}

.slide-over-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-base);
}

.slide-over-title {
  font-size: 1rem;
  font-weight: 600;
}

.slide-over-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.slide-over-close:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.slide-over-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.slide-over-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-base);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.slide-over-enter-active { animation: slideOverIn 200ms ease both; }
.slide-over-leave-active .slide-over-panel { animation: slideOverOut 200ms ease both; }
.slide-over-leave-active { transition: background 200ms ease; background: transparent; }
</style>
