interface CommandItem {
  id: string
  label: string
  group: string
  icon?: string
  action: () => void
}

const isOpen = ref(false)
const query = ref('')
const items = ref<CommandItem[]>([])

export function useCommandPalette() {
  function register(newItems: CommandItem[]) {
    items.value = [...items.value, ...newItems]
  }

  function open() {
    isOpen.value = true
    query.value = ''
  }

  function close() {
    isOpen.value = false
    query.value = ''
  }

  function toggle() {
    isOpen.value ? close() : open()
  }

  const filtered = computed(() => {
    if (!query.value) return items.value
    const q = query.value.toLowerCase()
    return items.value.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q),
    )
  })

  // Global keyboard shortcut
  if (import.meta.client) {
    onMounted(() => {
      window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault()
          toggle()
        }
        if (e.key === 'Escape' && isOpen.value) {
          close()
        }
      })
    })
  }

  return {
    isOpen: readonly(isOpen),
    query,
    items: filtered,
    register,
    open,
    close,
    toggle,
  }
}
