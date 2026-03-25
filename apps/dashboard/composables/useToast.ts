interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info' | 'loading'
  message: string
  duration?: number
}

const toasts = ref<Toast[]>([])

export function useToast() {
  function add(type: Toast['type'], message: string, duration = 4000) {
    const id = crypto.randomUUID()
    toasts.value.push({ id, type, message, duration })

    if (duration > 0) {
      setTimeout(() => remove(id), duration)
    }

    return id
  }

  function remove(id: string) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts: readonly(toasts),
    success: (msg: string) => add('success', msg),
    error: (msg: string) => add('error', msg),
    warning: (msg: string) => add('warning', msg),
    info: (msg: string) => add('info', msg),
    loading: (msg: string) => add('loading', msg, 0),
    remove,
  }
}
