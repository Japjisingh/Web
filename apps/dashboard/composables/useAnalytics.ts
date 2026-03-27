interface DailyUsage {
  date: string
  cost: string
  requests: number
  saved: string
  cached: number
}

interface ModelBreakdown {
  model: string
  totalCost: string
  totalRequests: number
  totalTokens: number
}

interface ProviderBreakdown {
  provider: string
  totalCost: string
  totalRequests: number
}

interface OverviewMetrics {
  totalRequests: number
  totalCost: string
  totalSaved: string
  cacheRate: string
  totalTokens: number
  errorRate: string
}

interface ForecastPoint {
  date: string
  projected: string
  low: string
  high: string
}

export function useAnalytics() {
  const { request, orgId } = useApi()
  const { dateRange } = useDateRange()

  const loading = ref(false)
  const metrics = ref<OverviewMetrics | null>(null)
  const dailyUsage = ref<DailyUsage[]>([])
  const byModel = ref<ModelBreakdown[]>([])
  const byProvider = ref<ProviderBreakdown[]>([])
  const forecast = ref<ForecastPoint[]>([])

  async function fetchOverview() {
    if (!orgId.value) return
    loading.value = true
    try {
      const days = Math.ceil(
        (dateRange.value.end.getTime() - dateRange.value.start.getTime()) / 86400000,
      )
      const res = await request<{ metrics: OverviewMetrics; dailyUsage: DailyUsage[] }>(
        `/overview/${orgId.value}`,
        { params: { days: String(days) } },
      )
      metrics.value = res.metrics
      dailyUsage.value = res.dailyUsage
    } catch (err) {
      console.error('Failed to fetch overview:', err)
    } finally {
      loading.value = false
    }
  }

  async function fetchBreakdowns() {
    if (!orgId.value) return
    try {
      const res = await request<{ byModel: ModelBreakdown[]; byProvider: ProviderBreakdown[] }>(
        `/analytics/${orgId.value}`,
      )
      byModel.value = res.byModel
      byProvider.value = res.byProvider
    } catch (err) {
      console.error('Failed to fetch breakdowns:', err)
    }
  }

  async function fetchForecast(days = 30) {
    if (!orgId.value) return
    try {
      const res = await request<{ forecast: ForecastPoint[] }>(
        `/forecast/${orgId.value}`,
        { params: { days: String(days) } },
      )
      forecast.value = res.forecast
    } catch (err) {
      console.error('Failed to fetch forecast:', err)
    }
  }

  // Cost trend: compute daily average and trajectory
  const costTrend = computed(() => {
    if (dailyUsage.value.length < 2) return { direction: 'stable' as const, changePercent: 0 }

    const costs = dailyUsage.value.map((d) => parseFloat(d.cost))
    const midpoint = Math.floor(costs.length / 2)
    const firstHalf = costs.slice(0, midpoint).reduce((s, c) => s + c, 0) / midpoint
    const secondHalf = costs.slice(midpoint).reduce((s, c) => s + c, 0) / (costs.length - midpoint)

    const changePercent = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0

    return {
      direction: changePercent > 2 ? 'increasing' as const : changePercent < -2 ? 'decreasing' as const : 'stable' as const,
      changePercent: Math.round(changePercent * 10) / 10,
    }
  })

  // Savings computation
  const savingsBreakdown = computed(() => {
    const totalSaved = dailyUsage.value.reduce((s, d) => s + parseFloat(d.saved || '0'), 0)
    const totalCost = dailyUsage.value.reduce((s, d) => s + parseFloat(d.cost || '0'), 0)
    const withoutOptimisation = totalCost + totalSaved
    const roi = withoutOptimisation > 0 ? (totalSaved / withoutOptimisation) * 100 : 0

    return {
      actualSpend: totalCost,
      withoutNeuralGate: withoutOptimisation,
      totalSaved,
      roi: Math.round(roi * 10) / 10,
      cachingSaved: totalSaved * 0.47,
      routingSaved: totalSaved * 0.35,
      compressionSaved: totalSaved * 0.18,
    }
  })

  // Projection: project month-end cost
  const projection = computed(() => {
    if (dailyUsage.value.length < 3) return null

    const costs = dailyUsage.value.map((d) => parseFloat(d.cost))
    const avgDaily = costs.reduce((s, c) => s + c, 0) / costs.length
    const today = new Date()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const dayOfMonth = today.getDate()
    const projected = avgDaily * daysInMonth
    const currentSpend = avgDaily * dayOfMonth

    return {
      projected: Math.round(projected * 100) / 100,
      currentSpend: Math.round(currentSpend * 100) / 100,
      dailyAverage: Math.round(avgDaily * 100) / 100,
      daysRemaining: daysInMonth - dayOfMonth,
      percentOfMonth: Math.round((dayOfMonth / daysInMonth) * 100),
    }
  })

  // Sparkline data helpers
  const sparklineData = computed(() => ({
    requests: dailyUsage.value.map((d) => d.requests),
    cost: dailyUsage.value.map((d) => parseFloat(d.cost)),
    saved: dailyUsage.value.map((d) => parseFloat(d.saved || '0')),
    cached: dailyUsage.value.map((d) => d.cached),
  }))

  return {
    loading: readonly(loading),
    metrics: readonly(metrics),
    dailyUsage: readonly(dailyUsage),
    byModel: readonly(byModel),
    byProvider: readonly(byProvider),
    forecast: readonly(forecast),
    costTrend,
    savingsBreakdown,
    projection,
    sparklineData,
    fetchOverview,
    fetchBreakdowns,
    fetchForecast,
  }
}
