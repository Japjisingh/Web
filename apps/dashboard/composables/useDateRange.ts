export type DatePreset = 'today' | '7d' | '30d' | '90d' | 'custom'

interface DateRangeState {
  preset: DatePreset
  start: Date
  end: Date
}

const state = ref<DateRangeState>({
  preset: '30d',
  start: new Date(Date.now() - 30 * 86400000),
  end: new Date(),
})

export function useDateRange() {
  function setPreset(preset: DatePreset) {
    const now = new Date()
    const map: Record<string, number> = {
      today: 0,
      '7d': 7,
      '30d': 30,
      '90d': 90,
    }

    if (preset !== 'custom') {
      state.value = {
        preset,
        start: new Date(now.getTime() - (map[preset] || 30) * 86400000),
        end: now,
      }
    }
  }

  function setCustom(start: Date, end: Date) {
    state.value = { preset: 'custom', start, end }
  }

  const days = computed(() =>
    Math.ceil((state.value.end.getTime() - state.value.start.getTime()) / 86400000),
  )

  return {
    dateRange: readonly(state),
    setPreset,
    setCustom,
    days,
  }
}
