import type { AiRequest, PaginatedResponse } from '@neuralgate/shared/types'

interface RequestFilters {
  provider?: string
  model?: string
  status?: 'success' | 'error' | 'cached'
  minCost?: number
  maxCost?: number
}

export function useRequests() {
  const { request, orgId } = useApi()
  const requests = ref<AiRequest[]>([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(50)
  const filters = reactive<RequestFilters>({})
  const liveMode = ref(false)

  async function fetch() {
    if (!orgId.value) return
    loading.value = true
    try {
      const params: Record<string, string> = {
        page: String(page.value),
        pageSize: String(pageSize.value),
      }
      if (filters.provider) params.provider = filters.provider
      if (filters.model) params.model = filters.model
      if (filters.status === 'cached') params.cached = 'true'

      const res = await request<PaginatedResponse<AiRequest>>(
        `/requests/${orgId.value}`,
        { params },
      )
      requests.value = res.data
      total.value = res.total
    } catch (err) {
      console.error('Failed to fetch requests:', err)
    } finally {
      loading.value = false
    }
  }

  function nextPage() {
    if (page.value * pageSize.value < total.value) {
      page.value++
      fetch()
    }
  }

  function prevPage() {
    if (page.value > 1) {
      page.value--
      fetch()
    }
  }

  function setFilter(key: keyof RequestFilters, value: unknown) {
    ;(filters as Record<string, unknown>)[key] = value
    page.value = 1
    fetch()
  }

  function clearFilters() {
    Object.keys(filters).forEach((k) => {
      ;(filters as Record<string, unknown>)[k] = undefined
    })
    page.value = 1
    fetch()
  }

  // Computed stats from current data
  const stats = computed(() => {
    const data = requests.value
    if (data.length === 0) return null

    const totalCost = data.reduce((s, r) => s + parseFloat(r.costUsd), 0)
    const cachedCount = data.filter((r) => r.cached).length
    const errorCount = data.filter((r) => r.statusCode && r.statusCode >= 400).length
    const avgLatency = data.reduce((s, r) => s + (r.latencyMs || 0), 0) / data.length
    const savedCost = data
      .filter((r) => r.cached)
      .reduce((s, r) => s + parseFloat(r.costUsd), 0)

    return {
      total: total.value,
      cachedPercent: data.length > 0 ? (cachedCount / data.length) * 100 : 0,
      errorPercent: data.length > 0 ? (errorCount / data.length) * 100 : 0,
      avgCost: data.length > 0 ? totalCost / data.length : 0,
      avgLatency: Math.round(avgLatency),
      totalSaved: savedCost,
    }
  })

  // CSV export
  function exportCSV() {
    const headers = ['id', 'provider', 'model', 'endpoint', 'inputTokens', 'outputTokens', 'costUsd', 'latencyMs', 'cached', 'statusCode', 'createdAt']
    const rows = requests.value.map((r) =>
      headers.map((h) => String((r as Record<string, unknown>)[h] ?? '')).join(','),
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `neuralgate-requests-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // JSON export
  function exportJSON() {
    const json = JSON.stringify(requests.value, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `neuralgate-requests-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    requests: readonly(requests),
    loading: readonly(loading),
    total: readonly(total),
    page,
    pageSize,
    filters,
    liveMode,
    stats,
    fetch,
    nextPage,
    prevPage,
    setFilter,
    clearFilters,
    exportCSV,
    exportJSON,
  }
}
