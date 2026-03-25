<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast--${toast.type}`"
        >
          <component :is="icons[toast.type]" :size="16" />
          <span class="toast__message">{{ toast.message }}</span>
          <button class="toast__close" @click="remove(toast.id)">
            <X :size="14" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-vue-next'

const { toasts, remove } = useToast()

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-base);
  border-radius: 8px;
  font-size: 0.8125rem;
  pointer-events: auto;
  animation: toastIn 150ms ease both;
  min-width: 280px;
  max-width: 420px;
}

.toast--success { border-color: var(--success); color: var(--success); }
.toast--error { border-color: var(--danger); color: var(--danger); }
.toast--warning { border-color: var(--warning); color: var(--warning); }
.toast--info { border-color: var(--info); color: var(--info); }
.toast--loading { border-color: var(--primary); color: var(--primary); }

.toast__message {
  flex: 1;
  color: var(--text-primary);
}

.toast__close {
  display: flex;
  align-items: center;
  color: var(--text-muted);
  padding: 2px;
  border-radius: 4px;
}

.toast__close:hover {
  color: var(--text-primary);
  background: var(--bg-overlay);
}

.toast-enter-active { animation: toastIn 150ms ease both; }
.toast-leave-active { transition: all 150ms ease; opacity: 0; transform: translateX(20px); }
</style>
